import { parseArgs } from 'node:util';
import { readDevelopmentEnvironment } from './clerk-environment';
import { describeDevelopmentExit, runLocalDevelopment } from './development';

// Ctrl+C or SIGTERM stops every service group, then the backend; a second
// signal only repeats the request while that cleanup finishes.
const stop = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    if (!stop.signal.aborted)
      process.stdout.write('Stopping local development, please wait.\n');
    stop.abort();
  });

async function main() {
  const { values } = parseArgs({
    options: {
      setup: { type: 'boolean' },
      sync: { type: 'boolean' },
    },
    strict: true,
  });
  const { environment, secretKey, clerkHost } =
    await readDevelopmentEnvironment();
  await runLocalDevelopment({
    root: process.cwd(),
    mode: values.setup || values.sync ? 'setup' : 'serve',
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
    const { lines, exitCode } = describeDevelopmentExit({
      error,
      isStopped: stop.signal.aborted,
    });
    process.stderr.write(`${lines.join('\n')}\n`);
    process.exitCode = exitCode;
  },
);
