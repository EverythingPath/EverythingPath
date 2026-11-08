// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');
const hostAuditFiles = [
  ...new Set(
    (
      JSON.parse(
        readFileSync(
          path.join(root, 'scripts/orchestration/host-audits.json'),
          'utf8',
        ),
      ) as { tests: { file: string }[] }
    ).tests.map((test) => test.file),
  ),
].sort();

const repoFiles = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
)
  .split('\0')
  .filter(Boolean);

// The files the test-hygiene block covers, by its own `files` patterns.
async function findHygieneBoundary(eslint: ESLint, files: string[]) {
  const config = (
    (await import(
      pathToFileURL(path.join(root, 'eslint.config.mjs')).href
    )) as {
      default: { name?: string; files?: string[] }[];
    }
  ).default;
  const patterns = config.find((block) => block.name === 'test-hygiene')?.files;
  if (!patterns?.length)
    throw new Error('No test-hygiene block in the config.');
  const boundary: string[] = [];
  for (const file of files)
    if (
      patterns.some((pattern) => path.matchesGlob(file, pattern)) &&
      !(await eslint.isPathIgnored(path.join(root, file)))
    )
      boundary.push(file);
  return boundary;
}

const hygieneRules = ['local/test-hygiene', 'no-restricted-syntax'];

// The files where a test-hygiene rule is off, by rule.
async function findHygieneExemptions(eslint: ESLint, files: string[]) {
  const exempt = Object.fromEntries(
    hygieneRules.map((rule) => [rule, [] as string[]]),
  );
  for (const file of files) {
    const config = (await eslint.calculateConfigForFile(
      path.join(root, file),
    )) as { rules: Record<string, [number, ...unknown[]]> } | undefined;
    for (const rule of hygieneRules)
      if (config?.rules[rule]?.[0] === 0) exempt[rule]?.push(file);
  }
  for (const list of Object.values(exempt)) list.sort();
  return exempt;
}

const forEachRule = (files: string[]) =>
  Object.fromEntries(hygieneRules.map((rule) => [rule, files]));

describe('the test-hygiene exception for gate-host audits', () => {
  it('covers exactly the files in scripts/orchestration/host-audits.json', async () => {
    const eslint = new ESLint({ cwd: root });
    const boundary = await findHygieneBoundary(eslint, repoFiles);

    for (const file of hostAuditFiles) {
      expect(existsSync(path.join(root, file))).toBe(true);
      expect(boundary).toContain(file);
    }
    expect(await findHygieneExemptions(eslint, boundary)).toEqual(
      forEachRule(hostAuditFiles),
    );
  }, 60_000);

  it.each<[string, string]>([
    ['src/probe.test.ts', 'local/test-hygiene'],
    ['src/probe.test.tsx', 'no-restricted-syntax'],
    ['scripts/probe.test.mjs', 'local/test-hygiene'],
    ['scripts/probe.test.mjs', 'no-restricted-syntax'],
  ])(
    'reports an exemption outside the list for %s with %s off',
    async (probe, rule) => {
      const eslint = new ESLint({
        cwd: root,
        overrideConfig: { files: [probe], rules: { [rule]: 'off' } },
      });
      const boundary = await findHygieneBoundary(eslint, [...repoFiles, probe]);

      expect(await findHygieneExemptions(eslint, boundary)).toEqual({
        ...forEachRule(hostAuditFiles),
        [rule]: [...hostAuditFiles, probe].sort(),
      });
    },
    60_000,
  );
});
