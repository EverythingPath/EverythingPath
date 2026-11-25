// Usage: tsx e2e/finalize-evidence.ts <e2e-artifacts directory> <exit code>
// After every run process has exited: finalizes the run's checkpoint and
// prints its one-line result (support/run-summary.ts). Used by
// scripts/orchestration/e2e-branch.sh.
import { finalizeRunEvidence } from './support/run-summary';

const [directory, exitCode = '?'] = process.argv.slice(2);
if (!directory) {
  process.stderr.write(
    'Usage: tsx e2e/finalize-evidence.ts <e2e-artifacts directory> <exit code>\n',
  );
  process.exitCode = 64;
} else {
  process.stdout.write(
    `${await finalizeRunEvidence({ directory, exitCode })}\n`,
  );
}
