import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { sourceFingerprint } from '../e2e/support/source-evidence.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const { values } = parseArgs({
  options: { 'browser-report': { type: 'string' } },
  strict: true,
});
const fingerprint = sourceFingerprint(root);
const output = resolve(root, 'coverage');
mkdirSync(output, { recursive: true });
const manifest = resolve(output, 'acceptance.json');
rmSync(manifest, { force: true });
rmSync(resolve(output, 'rules-evidence.json'), { force: true });
// Always run every check and retain failure evidence. An omitted or stale browser
// report remains a strict-gate failure; this command never deploys anything.
const checks = [
  ['typecheck'],
  ['lint'],
  ['test:build'],
  [
    'rules:complete',
    ...(values['browser-report']
      ? ['--browser-report', resolve(values['browser-report'])]
      : []),
  ],
].map((args) => {
  const run = spawnSync('pnpm', ['-s', ...args], {
    cwd: root,
    stdio: 'inherit',
  });
  return {
    command: `pnpm -s ${args[0]}`,
    exitCode: run.status,
    signal: run.signal,
    passed: !run.error && run.status === 0,
  };
});
const unchanged = sourceFingerprint(root) === fingerprint;
let rulesEvidence: unknown = null;
try {
  rulesEvidence = JSON.parse(
    readFileSync(resolve(output, 'rules-evidence.json'), 'utf8'),
  );
} catch {
  // A startup/collection failure still produces an unsuccessful acceptance record.
}
const passed =
  unchanged && rulesEvidence !== null && checks.every((check) => check.passed);
writeFileSync(
  manifest,
  JSON.stringify(
    {
      sourceFingerprint: fingerprint,
      generatedAt: new Date().toISOString(),
      status: passed ? 'passed' : 'not-ready',
      sourceUnchanged: unchanged,
      checks,
      rulesEvidence,
    },
    null,
    2,
  ) + '\n',
);
process.stdout.write(
  `Acceptance: ${passed ? 'passed' : 'NOT READY'}. Evidence: coverage/acceptance.json; human review: coverage/rules-report.md\n`,
);
if (!passed) process.exitCode = 1;
