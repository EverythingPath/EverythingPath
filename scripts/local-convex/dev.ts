import { readFile } from 'node:fs/promises';
import { parseArgs, parseEnv } from 'node:util';
import { verifyClerkApplication } from '../../e2e/support/clerk';
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
  const environment = { ...process.env };
  for (const file of ['.env', '.env.local']) {
    const contents = await readFile(file, 'utf8').catch((error: unknown) => {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      )
        return '';
      throw error;
    });
    Object.assign(environment, parseEnv(contents));
  }
  const publishableKey = environment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';
  const secretKey = environment.CLERK_SECRET_KEY ?? '';
  const clerkHost = Buffer.from(
    publishableKey.slice('pk_test_'.length),
    'base64',
  )
    .toString('utf8')
    .replace(/\$$/, '');
  if (
    !publishableKey.startsWith('pk_test_') ||
    !secretKey.startsWith('sk_test_') ||
    !/^[a-z0-9-]+\.clerk\.accounts\.dev$/.test(clerkHost)
  )
    throw new Error(
      'Local development requires Clerk development keys in .env or .env.local',
    );
  await verifyClerkApplication({ resources: { clerkHost }, secretKey });
  // Never inherit a deployment selector or override from a shell or .env file.
  for (const key of Object.keys(environment))
    if (key.startsWith('CONVEX_')) environment[key] = '';
  delete environment.E2E_RUN_FILE;
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
