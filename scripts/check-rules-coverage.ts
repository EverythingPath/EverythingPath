import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { coverageCatalog } from '../tests/rules/coverage-catalog.ts';
import {
  checkCoverage,
  renderCoverageReport,
} from '../tests/rules/check-coverage.ts';
import { collectServiceEvidence } from '../tests/rules/service-evidence.ts';
import { sourceFingerprint } from '../e2e/support/source-evidence.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'coverage');
const temporary = mkdtempSync(join(tmpdir(), 'militia-rules-'));
const resultsPath = join(temporary, 'results.json');
const corpusPaths = [
  'docs/ai/ironfang-militia/militia-rules.md',
  'docs/ai/ironfang-militia/militia-tables.md',
];
const resultsSchema = z.object({
  success: z.boolean(),
  testResults: z.array(
    z.object({
      name: z.string(),
      status: z.string(),
      assertionResults: z.array(
        z.object({ fullName: z.string(), status: z.string() }),
      ),
    }),
  ),
});

try {
  const { values } = parseArgs({
    options: {
      strict: { type: 'boolean' },
      'browser-report': { type: 'string' },
    },
    strict: true,
  });
  const testedSource = sourceFingerprint(root);
  mkdirSync(output, { recursive: true });
  // Always collect fresh results. A prior passing report cannot mask a failed
  // collection, interrupted run, or renamed/missing test in this checkout.
  rmSync(join(output, 'rules-report.md'), { force: true });
  rmSync(join(output, 'rules-tests.json'), { force: true });
  rmSync(join(output, 'rules-evidence.json'), { force: true });
  const run = spawnSync(
    'pnpm',
    [
      '-s',
      'test',
      '--reporter=default',
      '--reporter=json',
      `--outputFile.json=${resultsPath}`,
    ],
    {
      cwd: root,
      stdio: 'inherit',
    },
  );
  if (run.error) throw run.error;
  const results = resultsSchema.parse(
    JSON.parse(readFileSync(resultsPath, 'utf8')),
  );
  const files = Object.fromEntries(
    [
      ...new Set([
        ...corpusPaths,
        ...coverageCatalog.sources.map((source) => source.path),
      ]),
    ].map((path) => [path, readFileSync(resolve(root, path), 'utf8')]),
  );
  // Safe cast: coverageCatalog.sources lists tests/rules/audit-inventory.json,
  // so the `files` read above holds its text.
  const audit = z
    .object({ entries: z.array(z.object({ id: z.string() })) })
    .parse(JSON.parse(files['tests/rules/audit-inventory.json']!));
  const auditIds = audit.entries.map((entry) => entry.id);
  if (
    auditIds.length !== 95 ||
    new Set(auditIds).size !== 95 ||
    auditIds.some((id) => !coverageCatalog.auditIds.includes(id)) ||
    coverageCatalog.auditIds.some((id) => !auditIds.includes(id))
  ) {
    throw new Error(
      'Catalog must retain all 95 entries from the #54 audit snapshot',
    );
  }
  let serviceResults;
  const serviceErrors: string[] = [];
  if (values['browser-report']) {
    try {
      serviceResults = collectServiceEvidence(
        JSON.parse(readFileSync(resolve(values['browser-report']), 'utf8')),
        testedSource,
      );
    } catch {
      serviceErrors.push(
        'Browser report missing, malformed, unsuccessful, or from different source; rerun the nightly E2E suite.',
      );
    }
  }
  const result = checkCoverage(coverageCatalog, results, files, {
    strict: values.strict,
    serviceResults,
    corpusPaths,
    requiredCases: z
      .array(z.string())
      .parse(
        JSON.parse(
          readFileSync(
            resolve(root, 'tests/rules/case-inventory.json'),
            'utf8',
          ),
        ),
      ),
  });
  result.errors.push(...serviceErrors);
  if (sourceFingerprint(root) !== testedSource)
    result.errors.push(
      'Source changed during verification; rerun against stable source',
    );
  if (run.status !== 0)
    result.errors.push(`Test process exited ${run.status ?? run.signal}`);
  writeFileSync(
    join(output, 'rules-report.md'),
    renderCoverageReport(coverageCatalog, result) +
      `\n## Run evidence\n\nSource fingerprint: \`${testedSource}\`.\n\nService evidence: ${serviceResults ? 'complete first-attempt browser run for this source' : 'not established'}.\n`,
  );
  writeFileSync(
    join(output, 'rules-evidence.json'),
    JSON.stringify(
      {
        sourceFingerprint: testedSource,
        generatedAt: new Date().toISOString(),
        strict: values.strict ?? false,
        serviceEvidence: Boolean(serviceResults),
        ...result,
      },
      null,
      2,
    ) + '\n',
  );
  writeFileSync(
    join(output, 'rules-tests.json'),
    JSON.stringify(results, null, 2) + '\n',
  );
  process.stdout.write(
    `Rules coverage: ${result.covered.length} covered, ${result.gaps.length} explicit gaps, ${result.errors.length} errors. Report: coverage/rules-report.md\n`,
  );
  if (result.errors.length) {
    process.stderr.write(result.errors.join('\n') + '\n');
    process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
