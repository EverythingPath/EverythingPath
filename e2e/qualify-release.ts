import { join } from 'node:path';
import { loadRun, savePrivate } from './support/process';
import { qualifyRelease } from './support/release-qualification';
import { failureReport } from './support/setup-failure';

// The release-qualification suite's setup (#753); the runner starts it after
// the preview is bound and before the browsers. Only fixed failure lines are
// printed or kept, as the runner does.
try {
  await qualifyRelease();
} catch (error) {
  const lines = failureReport(error);
  process.stderr.write(`${lines.join('\n')}\n`);
  try {
    const run = await loadRun();
    await savePrivate(
      join(run.artifactDirectory, 'release-qualification-failure.txt'),
      `${lines.join('\n')}\n`,
    );
  } catch {
    // The runner reports the failed stage either way.
  }
  process.exitCode = 1;
}
