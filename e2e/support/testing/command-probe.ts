// Test-only entry point: runs one interruptible command (the browser stage's
// options) on <directory>'s convex stand-in, so a test can signal this
// process the way a supervisor would. Prints the command's outcome.
import { command } from '../process';

const [directory = ''] = process.argv.slice(2);
try {
  await command('E2E mandatory browser journeys', ['exec', 'convex', 'run'], {
    cwd: directory,
    interruptAfterMs: 60_000,
    timeoutMs: 120_000,
  });
  process.stdout.write('passed\n');
} catch (error) {
  process.stdout.write(
    `${error instanceof Error ? error.message : 'failed'}\n`,
  );
}
