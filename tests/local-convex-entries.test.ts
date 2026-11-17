// @vitest-environment node
// The CLI entries themselves (`pnpm dev`, the orchestration codegen): each
// module runs its handler on import, so each test imports its entry once with
// its dependencies mocked, then reads what it wrote to stderr and its exit
// code. Modules are not reset, so the failure classes are the entry's own.
import type * as FileSystem from 'node:fs/promises';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HarnessFailure } from '../e2e/support/diagnostics';
import { startLocalBackend } from '../scripts/local-convex/backend';
import { runLocalDevelopment } from '../scripts/local-convex/development';
import type * as Development from '../scripts/local-convex/development';

const secretKey = 'sk_test_ENTRYSECRET';
const publishableKey = `pk_test_${Buffer.from('fixture.clerk.accounts.dev$').toString('base64')}`;
const deployKey = 'preview:team:project|ENTRYDEPLOYSECRET';

// The entry's own `.env` reads get fixture keys; no real env file is read.
vi.mock('node:fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof FileSystem>();
  return {
    ...original,
    readFile: ((path: unknown, ...rest: unknown[]) =>
      path === '.env' || path === '.env.local'
        ? Promise.resolve(
            path === '.env'
              ? `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${publishableKey}\nCLERK_SECRET_KEY=${secretKey}\n`
              : '',
          )
        : (original.readFile as (...args: unknown[]) => unknown)(
            path,
            ...rest,
          )) as typeof original.readFile,
  };
});
vi.mock('../e2e/support/clerk', () => ({
  verifyClerkApplication: vi.fn(async () => undefined),
}));
vi.mock('../scripts/local-convex/development', async (importOriginal) => ({
  ...(await importOriginal<typeof Development>()),
  runLocalDevelopment: vi.fn(),
}));
vi.mock('../scripts/local-convex/backend', () => ({
  startLocalBackend: vi.fn(),
}));

// Startup was interrupted, and its rollback could not stop or remove `name`.
const interruptedWithLeftover = (name: string) =>
  new HarnessFailure(
    { kind: 'local-backend', reason: 'interrupted' },
    undefined,
    { kind: 'local-backend', reason: 'stop-after-failure', name },
  );

let stderr: string[];
let listeners: { SIGINT: number; SIGTERM: number };
const originalArgv = process.argv;
beforeEach(() => {
  stderr = [];
  vi.spyOn(process.stderr, 'write').mockImplementation((text) => {
    stderr.push(String(text));
    return true;
  });
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  listeners = {
    SIGINT: process.listenerCount('SIGINT'),
    SIGTERM: process.listenerCount('SIGTERM'),
  };
  process.exitCode = undefined;
  vi.stubEnv('CONVEX_DEPLOY_KEY', deployKey);
  vi.stubEnv('CLERK_SECRET_KEY', secretKey);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  process.argv = originalArgv;
  process.exitCode = undefined;
  // The entries' own signal handlers outlive their run.
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    for (const listener of process.listeners(signal).slice(listeners[signal]))
      process.removeListener(signal, listener);
});

async function runEntry(path: string) {
  await import(path);
  await expect.poll(() => process.exitCode, { timeout: 10_000 }).toBeDefined();
  const output = stderr.join('');
  for (const secret of [secretKey, publishableKey, deployKey, 'ENTRYSECRET'])
    expect(output).not.toContain(secret);
  return { output, exitCode: process.exitCode };
}

it('pnpm dev: an interrupted start prints the stop and the container its rollback left, and exits 130', async () => {
  const name = 'ep-dev-0123456789ab';
  process.argv = [process.argv[0] ?? 'node', 'scripts/local-convex/dev.ts'];
  vi.mocked(runLocalDevelopment).mockImplementation(async ({ signal }) => {
    process.emit('SIGINT');
    expect(signal.aborted).toBe(true);
    throw interruptedWithLeftover(name);
  });
  const { output, exitCode } = await runEntry('../scripts/local-convex/dev');
  expect(exitCode).toBe(130);
  expect(output).toBe(
    [
      'Local development stopped.',
      `Local development failed: The local Convex container could not be stopped or removed after the failure above. Remove it with \`docker rm -f ${name}\` (its data volume ${name}-data is kept).`,
      '',
    ].join('\n'),
  );
});

it('local codegen: an interrupted start prints the interruption and the container its rollback left, and exits 1', async () => {
  const name = 'ep-e2e-11111111-1111-1111-1111-111111111111';
  vi.mocked(startLocalBackend).mockImplementation(async () => {
    process.emit('SIGINT');
    throw interruptedWithLeftover(name);
  });
  const { output, exitCode } = await runEntry(
    '../scripts/local-convex/codegen',
  );
  expect(exitCode).toBe(1);
  expect(output).toBe(
    [
      'Stopping local code generation, please wait.',
      'Local code generation was interrupted.',
      'Its Docker backend could not be removed either:',
      `The local Convex container could not be stopped or removed after the failure above. Remove it with \`docker rm -f -v ${name}\`.`,
      '',
    ].join('\n'),
  );
});
