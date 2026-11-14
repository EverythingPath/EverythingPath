// @vitest-environment node
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HarnessFailure } from '../e2e/support/diagnostics';
import type { LocalBackend } from '../scripts/local-convex/backend';
import {
  describeDevelopmentExit,
  describeDevelopmentFailure,
  DevelopmentStopFailure,
  runLocalDevelopment,
  type DevelopmentDependencies,
} from '../scripts/local-convex/development';

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'local-development-'));
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});
afterEach(async () => {
  vi.restoreAllMocks();
  for (const pid of spawned) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      /* Already gone. */
    }
  }
  spawned = [];
  await rm(root, { recursive: true, force: true });
});

let spawned: number[] = [];
function alive(pid: number) {
  try {
    process.kill(pid, 0);
  } catch {
    return false;
  }
  try {
    return !/^\d+ \(.*\) Z/.test(readFileSync(`/proc/${pid}/stat`, 'utf8'));
  } catch {
    return false;
  }
}

// A service: its leader starts a grandchild in the same process group that
// ignores SIGTERM and writes its pid to `<label>.pid`, then the leader either
// exits on SIGTERM (`serve`) or exits 1 on its own (`crash`).
const service = (label: string, behaviour: 'serve' | 'crash') => `
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const child = spawn(process.execPath, ['-e', ${JSON.stringify(`
process.on('SIGTERM', () => {});
require('node:fs').writeFileSync(${JSON.stringify(join('PIDDIR', `${label}.pid`))}, String(process.pid));
setInterval(() => {}, 1000);
`)}], { stdio: 'ignore' });
process.on('SIGTERM', () => process.exit(143));
const wait = setInterval(() => {
  if (!fs.existsSync(${JSON.stringify(join('PIDDIR', `${label}.pid`))})) return;
  clearInterval(wait);
  ${behaviour === 'crash' ? 'process.exit(1);' : 'setInterval(() => {}, 1000);'}
}, 20);
`;

function harness({
  failing = [],
  crash = false,
}: { failing?: string[]; crash?: boolean } = {}) {
  const commands: string[][] = [];
  const stop = vi.fn<() => Promise<void>>(async () => undefined);
  const backend = (directory: string): LocalBackend => ({
    name: 'ep-dev-0123456789ab',
    url: 'http://127.0.0.1:3210',
    siteUrl: 'http://127.0.0.1:3211',
    envFile: join(directory, 'convex.env'),
    adminKeyFile: join(directory, 'local-admin.key'),
    stop,
  });
  const use: DevelopmentDependencies = {
    startLocalBackend: vi.fn<DevelopmentDependencies['startLocalBackend']>(
      async ({ directory }) => backend(directory),
    ),
    syncLocalIdentities: vi.fn(async () => 3),
    runFunction: vi.fn(),
    spawnPnpm: ({ args, options }) => {
      commands.push(args);
      const label = args.join(' ');
      const script = label.startsWith('exec convex dev --env-file')
        ? service('convex', 'serve')
        : label === 'dev:web'
          ? service('web', crash ? 'crash' : 'serve')
          : `process.exit(${failing.includes(args[3] ?? '') ? 1 : 0})`;
      const child = spawn(
        process.execPath,
        ['-e', script.replaceAll('PIDDIR', root)],
        { ...options, cwd: root, stdio: 'ignore' },
      );
      if (child.pid) spawned.push(child.pid);
      return child;
    },
  };
  return { use, stop, commands };
}
const develop = (
  use: DevelopmentDependencies,
  mode: 'serve' | 'setup',
  signal = new AbortController().signal,
) =>
  runLocalDevelopment({
    root,
    mode,
    environment: { ...process.env },
    secretKey: 'sk_test_fixture',
    clerkHost: 'fixture.clerk.accounts.dev',
    signal,
    use,
  });
const servicePid = async (label: string) => {
  await expect
    .poll(() => readFile(join(root, `${label}.pid`), 'utf8').catch(() => ''), {
      timeout: 10_000,
    })
    .not.toBe('');
  const pid = Number(await readFile(join(root, `${label}.pid`), 'utf8'));
  spawned.push(pid);
  return pid;
};

it('stops the backend it started when a setup step fails, and starts no service', async () => {
  const { use, stop, commands } = harness({ failing: ['set'] });
  await expect(develop(use, 'serve')).rejects.toThrow('exec failed (1)');
  expect(commands.map((args) => args.slice(0, 4))).toEqual([
    ['exec', 'convex', 'env', 'set'],
  ]);
  expect(stop).toHaveBeenCalledOnce();
});

it('leaves a healthy setup-mode backend running for the next start', async () => {
  const { use, stop, commands } = harness();
  await develop(use, 'setup');
  expect(commands.map((args) => args.slice(0, 4))).toEqual([
    ['exec', 'convex', 'env', 'set'],
    ['exec', 'convex', 'dev', '--once'],
  ]);
  expect(use.syncLocalIdentities).toHaveBeenCalledOnce();
  expect(stop).not.toHaveBeenCalled();
});

it('runs no command when stopped during backend startup', async () => {
  const { use, stop, commands } = harness();
  const controller = new AbortController();
  use.startLocalBackend = ({ signal }) =>
    new Promise((_, reject) => {
      signal?.addEventListener('abort', () =>
        reject(
          new HarnessFailure({ kind: 'local-backend', reason: 'interrupted' }),
        ),
      );
      controller.abort();
    });
  await expect(develop(use, 'serve', controller.signal)).rejects.toThrow(
    'interrupted',
  );
  expect(commands).toEqual([]);
  expect(stop).not.toHaveBeenCalled();
});

it.skipIf(process.platform === 'win32')(
  'on Ctrl+C reaps both services’ whole process groups before stopping the backend',
  async () => {
    const { use, stop } = harness();
    const controller = new AbortController();
    const groupsAtStop: boolean[] = [];
    stop.mockImplementation(async () => {
      groupsAtStop.push(alive(convex), alive(web));
    });
    const running = develop(use, 'serve', controller.signal);
    const [convex, web] = [await servicePid('convex'), await servicePid('web')];
    controller.abort();
    await expect(running).rejects.toThrow('stopped');
    expect(groupsAtStop).toEqual([false, false]);
    expect(stop).toHaveBeenCalledOnce();
  },
  30_000,
);

it.skipIf(process.platform === 'win32')(
  'reaps a crashed service’s group after its leader exits, then stops the other service and the backend',
  async () => {
    const { use, stop } = harness({ crash: true });
    const running = develop(use, 'serve');
    const [convex, web] = [await servicePid('convex'), await servicePid('web')];
    await expect(running).rejects.toThrow('dev:web failed (1)');
    expect(alive(web)).toBe(false);
    expect(alive(convex)).toBe(false);
    expect(stop).toHaveBeenCalledOnce();
  },
  40_000,
);

const stopFailure = new HarnessFailure({
  kind: 'local-backend',
  reason: 'stop',
  name: 'ep-dev-0123456789ab',
});

it('keeps a setup failure primary and also names a backend it could not stop', async () => {
  const { use, stop } = harness({ failing: ['set'] });
  stop.mockRejectedValueOnce(stopFailure);
  const error = await develop(use, 'serve').catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(DevelopmentStopFailure);
  expect(describeDevelopmentFailure(error)).toEqual([
    'Local development failed. Check Docker, Clerk development keys, and the local backend.',
    'Local development failed: The local Convex container could not be stopped or removed; check `docker ps -a --filter label=dev.everythingpath.local-convex` ("Local Convex on this machine" in e2e/README.md). Remove it with `docker rm -f ep-dev-0123456789ab` (its data volume ep-dev-0123456789ab-data is kept).',
  ]);
});

it('keeps a stop request primary and also reports a backend it could not stop', async () => {
  const { use, stop } = harness();
  stop.mockRejectedValueOnce(stopFailure);
  const controller = new AbortController();
  use.syncLocalIdentities = async () => {
    controller.abort();
    return 0;
  };
  const error = await develop(use, 'serve', controller.signal).catch(
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(DevelopmentStopFailure);
  expect((error as DevelopmentStopFailure).stopFailure).toBe(stopFailure);
});

it('reports a failed stop after an otherwise clean exit', async () => {
  const { use, stop } = harness();
  stop.mockRejectedValueOnce(stopFailure);
  // Every command and service exits cleanly at once.
  use.spawnPnpm = ({ options }) =>
    spawn(process.execPath, ['-e', 'process.exit(0)'], {
      ...options,
      cwd: root,
      stdio: 'ignore',
    });
  await expect(develop(use, 'serve')).rejects.toBe(stopFailure);
});

const recovery =
  'Remove it with `docker rm -f ep-dev-0123456789ab` (its data volume ep-dev-0123456789ab-data is kept).';

it('prints the container an interrupted startup’s rollback left running, with its recovery', async () => {
  const { use } = harness();
  const controller = new AbortController();
  // Startup was interrupted, and its rollback could not stop the container.
  use.startLocalBackend = () => {
    controller.abort();
    return Promise.reject(
      new HarnessFailure(
        { kind: 'local-backend', reason: 'interrupted' },
        undefined,
        {
          kind: 'local-backend',
          reason: 'stop-after-failure',
          name: 'ep-dev-0123456789ab',
        },
      ),
    );
  };
  const error = await develop(use, 'serve', controller.signal).catch(
    (caught: unknown) => caught,
  );
  const exit = describeDevelopmentExit({
    error,
    isStopped: controller.signal.aborted,
  });
  expect(exit.exitCode).toBe(130);
  expect(exit.lines[0]).toBe('Local development stopped.');
  expect(exit.lines[1]).toContain(
    'could not be stopped or removed after the failure above',
  );
  expect(exit.lines[1]).toContain(recovery);
});

it('prints a stop failure after Ctrl+C, and only the stop line without one', async () => {
  const stopped = new DevelopmentStopFailure(
    new Error('Local development stopped'),
    stopFailure,
  );
  expect(describeDevelopmentExit({ error: stopped, isStopped: true })).toEqual({
    lines: ['Local development stopped.', expect.stringContaining(recovery)],
    exitCode: 130,
  });
  expect(
    describeDevelopmentExit({
      error: new Error('Local development stopped'),
      isStopped: true,
    }),
  ).toEqual({ lines: ['Local development stopped.'], exitCode: 130 });
});
