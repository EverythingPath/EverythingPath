import { readDevelopmentEnvironment } from './clerk-environment';
import {
  describeTrialExit,
  discardOwnerTrial,
  parseTrialArguments,
  runOwnerTrial,
  trialInstance,
} from './owner-trial';

// Ctrl+C or SIGTERM stops every service group, then the backend; a second
// signal only repeats the request while that cleanup finishes.
const stop = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    if (!stop.signal.aborted)
      process.stdout.write('Stopping the owner trial, please wait.\n');
    stop.abort();
  });

async function main() {
  const { discard } = parseTrialArguments(process.argv.slice(2));
  const root = process.cwd();
  if (discard)
    return discardOwnerTrial({ root, name: trialInstance(root).name });
  const { environment, secretKey, clerkHost } =
    await readDevelopmentEnvironment();
  await runOwnerTrial({
    root,
    environment,
    secretKey,
    clerkHost,
    signal: stop.signal,
  });
}

main().then(
  () => {
    if (stop.signal.aborted) process.exitCode = 130;
  },
  (error: unknown) => {
    const { lines, exitCode } = describeTrialExit({
      error,
      isStopped: stop.signal.aborted,
    });
    process.stderr.write(`${lines.join('\n')}\n`);
    process.exitCode = exitCode;
  },
);
