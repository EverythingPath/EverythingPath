// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  describeHarnessFailure,
  HarnessFailure,
} from '../e2e/support/diagnostics';
import { classifyError } from '../e2e/support/setup-failure';
import {
  checkLocalBackendHost,
  discardLocalBackend,
  isLocalBackendRunning,
  localBackendCleanupReserveMs,
  localBackendImage,
  startLocalBackend,
} from '../scripts/local-convex/backend';

const developmentName = 'ep-dev-0123456789ab';
const containerSchema = z.object({
  name: z.string(),
  label: z.string(),
  hostIp: z.string(),
  image: z.string(),
  port: z.string(),
  sitePort: z.string(),
  running: z.boolean(),
});
const stateSchema = z.object({
  log: z.array(z.array(z.string())),
  daemon: z.boolean(),
  imagePresent: z.boolean(),
  pullSucceeds: z.boolean(),
  container: containerSchema.nullable(),
  failing: z.array(z.string()),
  slow: z.record(z.string(), z.number()),
  createLosesClient: z.boolean(),
  startLosesClient: z.boolean(),
  adminKey: z.string(),
});
type State = z.infer<typeof stateSchema>;

// A Docker client and daemon: every invocation reads and writes the daemon's
// state, as real Docker would, and logs its arguments before acting.
const fakeDocker = `#!/usr/bin/env node
const fs = require('node:fs');
const file = process.env.EP_TEST_DOCKER_STATE;
const load = () => JSON.parse(fs.readFileSync(file, 'utf8'));
const save = (state) => fs.writeFileSync(file, JSON.stringify(state));
const args = process.argv.slice(2);
const command = args[0] === 'image' ? 'image ' + args[1] : args[0];
let state = load();
state.log.push(args);
save(state);
const slow = state.slow[command];
if (slow) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, slow);
state = load();
const out = (text) => process.stdout.write(text);
if (!state.daemon || state.failing.includes(command)) process.exit(1);
const c = state.container;
switch (command) {
  case 'version': out('27.0.0'); break;
  case 'image inspect': if (!state.imagePresent) process.exit(1); out('sha256:image'); break;
  case 'pull': if (!state.pullSucceeds) process.exit(1); state.imagePresent = true; break;
  case 'ps': out(c ? 'container-id' : ''); break;
  case 'inspect': {
    const format = args[2];
    if (format.includes('Labels')) out(c.label);
    else if (format.includes('HostIp')) out(c.hostIp);
    else if (format.includes('3210/tcp') && format.includes('HostPort')) out(c.port);
    else if (format.includes('3211/tcp') && format.includes('HostPort')) out(c.sitePort);
    else if (format.includes('.Config.Image')) out(c.image);
    else if (format.includes('.State.Running')) out(String(c.running));
    else process.exit(2);
    break;
  }
  case 'create': {
    const value = (flag, index = 0) => args.filter((_, i) => args[i - 1] === flag)[index];
    const port = (i) => value('--publish', i).split(':');
    state.container = {
      name: value('--name'),
      label: value('--label').split('=')[1],
      hostIp: port(0)[0],
      port: port(0)[1],
      sitePort: port(1)[1],
      image: args[args.length - 1],
      running: false,
    };
    if (state.createLosesClient) { save(state); process.exit(1); }
    out('container-id');
    break;
  }
  case 'start':
    c.running = true;
    if (state.startLosesClient) { save(state); process.exit(1); }
    break;
  case 'exec': out(state.adminKey); break;
  case 'stop': c.running = false; break;
  case 'rm': state.container = null; break;
  default: process.exit(3);
}
save(state);
`;

let root: string;
let statePath: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'local-convex-docker-'));
  statePath = join(root, 'state.json');
  await writeFile(join(root, 'docker'), fakeDocker, { mode: 0o700 });
  vi.stubEnv('PATH', `${root}:${process.env.PATH}`);
  vi.stubEnv('EP_TEST_DOCKER_STATE', statePath);
  await setState({});
});
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await rm(root, { recursive: true, force: true });
});

async function setState(state: Partial<State>) {
  const initial: State = {
    log: [],
    daemon: true,
    imagePresent: true,
    pullSucceeds: true,
    container: null,
    failing: [],
    slow: {},
    createLosesClient: false,
    startLosesClient: false,
    adminKey: 'ep-instance|0123abcd',
  };
  await writeFile(statePath, JSON.stringify({ ...initial, ...state }));
}
async function readState() {
  return stateSchema.parse(JSON.parse(await readFile(statePath, 'utf8')));
}
const commands = async () =>
  (await readState()).log.map((args) =>
    args[0] === 'image' ? `image ${args[1]}` : (args[0] ?? ''),
  );

// The backend answers on its URL with the name it was started with.
function serveBackend({
  ready = true,
  instanceName,
  isInstanceHanging = false,
  instanceStatus = 200,
}: {
  instanceStatus?: number;
  ready?: boolean;
  instanceName?: string;
  isInstanceHanging?: boolean;
} = {}) {
  vi.stubGlobal(
    'fetch',
    async (url: string, init: RequestInit = {}): Promise<Response> => {
      if (url.endsWith('/version')) {
        if (ready) return new Response('ok');
        // An unready backend accepts the connection and never answers.
        return new Promise((_, reject) =>
          init.signal?.addEventListener('abort', () =>
            reject(new Error('aborted')),
          ),
        );
      }
      if (url.endsWith('/instance_name')) {
        // A hanging request rejects with its signal's reason, as fetch does.
        if (isInstanceHanging)
          return new Promise((_, reject) =>
            init.signal?.addEventListener('abort', () => {
              const reason: unknown = init.signal?.reason;
              // AbortSignal.timeout's reason is a TimeoutError DOMException.
              reject(reason instanceof Error ? reason : new Error('aborted'));
            }),
          );
        const { container } = await readState();
        return new Response(instanceName ?? container?.name ?? '', {
          status: instanceStatus,
        });
      }
      throw new Error(`unexpected request ${url}`);
    },
  );
}
const existing = (overrides: Partial<z.infer<typeof containerSchema>> = {}) =>
  setState({
    container: {
      name: developmentName,
      label: developmentName,
      hostIp: '127.0.0.1',
      image: localBackendImage,
      port: '43210',
      sitePort: '43211',
      running: false,
      ...overrides,
    },
  });
async function failure(promise: Promise<unknown>) {
  const error = await promise.then(
    () => undefined,
    (caught: unknown) => caught,
  );
  if (!(error instanceof HarnessFailure)) throw new Error('expected failure');
  return error;
}

it('removes the daemon-created container and volume when the create client fails', async () => {
  await setState({ createLosesClient: true });
  const error = await failure(
    startLocalBackend({ directory: join(root, 'private') }),
  );
  expect(error.diagnostic).toMatchObject({ reason: 'docker' });
  const state = await readState();
  expect(state.container).toBeNull();
  expect(state.log.at(-1)).toEqual([
    'rm',
    '--force',
    '--volumes',
    'container-id',
  ]);
  await expect(
    readFile(join(root, 'private', 'backend.env')),
  ).rejects.toMatchObject({ code: 'ENOENT' });
});

it('starts a new E2E container on loopback and writes private credentials', async () => {
  serveBackend();
  const backend = await startLocalBackend({ directory: join(root, 'private') });
  expect(backend.url).toMatch(/^http:\/\/127\.0\.0\.1:[0-9]+$/);
  expect(await commands()).toEqual([
    'version',
    'image inspect',
    'ps',
    'create',
    'start',
    'exec',
  ]);
  expect(await readFile(backend.adminKeyFile, 'utf8')).toBe(
    'ep-instance|0123abcd',
  );
  await backend.stop();
  expect((await readState()).log.at(-1)).toEqual([
    'rm',
    '--force',
    '--volumes',
    'container-id',
  ]);
});

it('removes a new E2E container whose start fails', async () => {
  await setState({ failing: ['start'] });
  const error = await failure(
    startLocalBackend({ directory: join(root, 'private') }),
  );
  expect(error.diagnostic).toMatchObject({ reason: 'start' });
  const state = await readState();
  expect(state.container).toBeNull();
  expect(state.log.at(-1)).toContain('--volumes');
});

it('removes a new development container whose start fails but never its data volume', async () => {
  await setState({ failing: ['start'] });
  const error = await failure(
    startLocalBackend({ directory: root, developmentName }),
  );
  expect(error.message).toContain('a retry picks new ports');
  const state = await readState();
  expect(state.container).toBeNull();
  expect(state.log.at(-1)).toEqual(['rm', '--force', 'container-id']);
  const create = state.log.find((args) => args[0] === 'create') ?? [];
  expect(create).toContain(
    `type=volume,source=${developmentName}-data,target=/convex/data`,
  );
});

it.each([
  [
    'a failed instance check',
    { instanceName: 'ep-dev-ffffffffffff' },
    'instance',
  ],
  ['an invalid admin key', {}, 'admin-key'],
] as const)(
  'stops an existing development container it started after %s',
  async (_case, backend, reason) => {
    await existing();
    if (reason === 'admin-key')
      await setState({
        ...(await readState()),
        adminKey: 'not a key',
      });
    serveBackend(backend);
    const error = await failure(
      startLocalBackend({ directory: root, developmentName }),
    );
    expect(error.diagnostic).toMatchObject({ reason });
    const state = await readState();
    expect(state.container).toMatchObject({ running: false });
    expect(state.log.at(-1)?.slice(0, 1)).toEqual(['stop']);
    await expect(readFile(join(root, 'local-admin.key'))).rejects.toMatchObject(
      { code: 'ENOENT' },
    );
  },
);

it('leaves an already running development container running when its check fails', async () => {
  await existing({ running: true });
  serveBackend({ instanceName: 'ep-dev-ffffffffffff' });
  await failure(startLocalBackend({ directory: root, developmentName }));
  expect(await commands()).not.toContain('stop');
  expect((await readState()).container).toMatchObject({ running: true });
});

it.each([
  [
    'another owner',
    { label: 'someone-else' },
    'ownership',
    `docker rm ${developmentName}`,
  ],
  [
    'non-loopback ports',
    { hostIp: '0.0.0.0' },
    'ports',
    `docker rm ${developmentName}\` (its data volume ${developmentName}-data is kept)`,
  ],
  [
    'another image',
    { image: 'convex-backend:other' },
    'image-changed',
    `docker rm ${developmentName}\` (its data volume ${developmentName}-data is kept)`,
  ],
] as const)(
  'refuses an existing development container with %s and names the recovery',
  async (_case, container, reason, recovery) => {
    await existing(container);
    const error = await failure(
      startLocalBackend({ directory: root, developmentName }),
    );
    expect(error.diagnostic).toMatchObject({ reason });
    expect(error.message).toContain(recovery);
    expect(await commands()).not.toContain('start');
    expect(await commands()).not.toContain('rm');
  },
);

it('names the recovery when an existing development container cannot start', async () => {
  await existing();
  await setState({ ...(await readState()), failing: ['start'] });
  const error = await failure(
    startLocalBackend({ directory: root, developmentName }),
  );
  expect(error.diagnostic).toMatchObject({ reason: 'start-existing' });
  expect(error.message).toContain(`docker rm ${developmentName}`);
  expect((await readState()).container).not.toBeNull();
});

it('caps a slow Docker call at the run deadline less the cleanup reserve', async () => {
  await setState({ slow: { ps: 20_000 } });
  const started = Date.now();
  const error = await failure(
    startLocalBackend({
      directory: join(root, 'private'),
      deadline: started + localBackendCleanupReserveMs + 1_500,
    }),
  );
  expect(error.diagnostic).toMatchObject({ reason: 'timeout' });
  expect(classifyError(error)).toBe('timeout');
  expect(Date.now() - started).toBeLessThan(5_000);
  expect(await commands()).not.toContain('create');
}, 15_000);

it('ends readiness at the run deadline and removes the container', async () => {
  serveBackend({ ready: false });
  const started = Date.now();
  const error = await failure(
    startLocalBackend({
      directory: join(root, 'private'),
      deadline: started + localBackendCleanupReserveMs + 2_000,
    }),
  );
  expect(error.diagnostic).toMatchObject({ reason: 'timeout' });
  expect(Date.now() - started).toBeLessThan(6_000);
  expect((await readState()).container).toBeNull();
}, 15_000);

it('refuses to start without the cleanup reserve', async () => {
  const error = await failure(
    startLocalBackend({
      directory: join(root, 'private'),
      deadline: Date.now() + localBackendCleanupReserveMs - 1,
    }),
  );
  expect(error.diagnostic).toMatchObject({ reason: 'timeout' });
  expect(await commands()).toEqual([]);
});

it.each(['docker call', 'readiness'] as const)(
  'aborts promptly when interrupted during its %s and removes what it created',
  async (phase) => {
    if (phase === 'docker call') await setState({ slow: { start: 20_000 } });
    serveBackend({ ready: false });
    const controller = new AbortController();
    const started = Date.now();
    const pending = failure(
      startLocalBackend({
        directory: join(root, 'private'),
        signal: controller.signal,
      }),
    );
    await expect.poll(commands).toContain('start');
    setTimeout(() => controller.abort(), 200);
    const error = await pending;
    expect(error.diagnostic).toMatchObject({ reason: 'interrupted' });
    expect(classifyError(error)).toBe('terminated');
    expect(Date.now() - started).toBeLessThan(5_000);
    expect((await readState()).container).toBeNull();
  },
  15_000,
);

it('reports a failed stop as its own failure', async () => {
  serveBackend();
  const backend = await startLocalBackend({ directory: join(root, 'private') });
  await setState({ ...(await readState()), failing: ['rm'] });
  const error = await failure(backend.stop());
  expect(error.diagnostic).toMatchObject({ reason: 'stop' });
  expect(error.message).toContain(`docker rm -f -v ${backend.name}`);
});

it('stops an existing container whose start the daemon completed although its client failed', async () => {
  await existing();
  await setState({ ...(await readState()), startLosesClient: true });
  const error = await failure(
    startLocalBackend({ directory: root, developmentName }),
  );
  expect(error.diagnostic).toMatchObject({ reason: 'start-existing' });
  const state = await readState();
  expect(state.container).toMatchObject({ running: false });
  expect(state.log.at(-1)?.slice(0, 1)).toEqual(['stop']);
});

it('stops a container whose start was interrupted after the daemon may have started it', async () => {
  await existing();
  await setState({ ...(await readState()), slow: { start: 20_000 } });
  const controller = new AbortController();
  const pending = failure(
    startLocalBackend({
      directory: root,
      developmentName,
      signal: controller.signal,
    }),
  );
  await expect.poll(commands).toContain('start');
  controller.abort();
  const error = await pending;
  expect(error.diagnostic).toMatchObject({ reason: 'interrupted' });
  expect(await commands()).toContain('stop');
}, 15_000);

it('reports an instance check that reaches the deadline as a timeout, not a mismatch', async () => {
  serveBackend({ isInstanceHanging: true });
  const started = Date.now();
  const error = await failure(
    startLocalBackend({
      directory: join(root, 'private'),
      deadline: started + localBackendCleanupReserveMs + 1_500,
    }),
  );
  expect(error.diagnostic).toMatchObject({ reason: 'timeout' });
  expect(classifyError(error)).toBe('timeout');
  expect((await readState()).container).toBeNull();
}, 15_000);

it('reports an instance check interrupted by Ctrl+C as terminated', async () => {
  serveBackend({ isInstanceHanging: true });
  const controller = new AbortController();
  const pending = failure(
    startLocalBackend({
      directory: join(root, 'private'),
      signal: controller.signal,
    }),
  );
  await expect.poll(commands).toContain('start');
  setTimeout(() => controller.abort(), 200);
  const error = await pending;
  expect(error.diagnostic).toMatchObject({ reason: 'interrupted' });
  expect(classifyError(error)).toBe('terminated');
}, 15_000);

it('reports only a real name mismatch as a validation failure', async () => {
  serveBackend({ instanceName: 'ep-e2e-ffffffff-ffff-ffff-ffff-ffffffffffff' });
  const error = await failure(
    startLocalBackend({ directory: join(root, 'private') }),
  );
  expect(error.diagnostic).toMatchObject({ reason: 'instance' });
  expect(classifyError(error)).toBe('validation');
});

it('shares one cleanup deadline across the rollback’s ps, inspect and removal', async () => {
  // Each recovery call is slow; together they exceed the reserve.
  await setState({
    createLosesClient: true,
    slow: { ps: 900, inspect: 900, rm: 900 },
  });
  const error = await failure(
    startLocalBackend({
      directory: join(root, 'private'),
      cleanupReserveMs: 2_000,
    }),
  );
  const state = await readState();
  expect(state.log.map((args) => args[0])).toEqual([
    'version',
    'image',
    'ps',
    'create',
    'ps',
    'inspect',
    'rm',
  ]);
  // The removal got only what was left of the reserve and was killed.
  expect(state.container).not.toBeNull();
  expect(error.also).toMatchObject({ reason: 'stop-after-failure' });
  expect(error.message).toBe('A Docker command for local Convex failed');
  expect(describeHarnessFailure(error).join('\n')).toMatch(
    /docker rm -f -v ep-e2e-/,
  );
}, 15_000);

it('checks the Docker daemon and pulls a missing pinned image without starting a container', async () => {
  await setState({ imagePresent: false });
  await checkLocalBackendHost({ deadline: Date.now() + 60_000 });
  expect(await readState()).toMatchObject({
    imagePresent: true,
    container: null,
  });
  expect((await readState()).log).toEqual([
    ['version', '--format', '{{.Server.Version}}'],
    ['image', 'inspect', '--format', '{{.Id}}', localBackendImage],
    ['pull', '--quiet', localBackendImage],
  ]);
});

it.each([
  ['an unreachable daemon', { daemon: false }, 'docker-unavailable'],
  [
    'an image that cannot be pulled',
    { imagePresent: false, pullSucceeds: false },
    'image',
  ],
] as const)(
  'fails the host check clearly for %s',
  async (_case, state, reason) => {
    await setState(state);
    const error = await failure(checkLocalBackendHost());
    expect(error.diagnostic).toMatchObject({ reason });
    expect(await commands()).not.toContain('create');
  },
);

it('reports an unsuccessful instance response as unreachable, not as a mismatch', async () => {
  // A 503 carries the right name in its body, yet says nothing about identity.
  serveBackend({ instanceStatus: 503 });
  const error = await failure(
    startLocalBackend({ directory: join(root, 'private') }),
  );
  expect(error.diagnostic).toMatchObject({ reason: 'instance-unreachable' });
  expect(classifyError(error)).not.toBe('validation');
  expect((await readState()).container).toBeNull();
});

// #754: a prepared E2E environment's container is stopped, not removed, and
// a later `--reuse` run resumes it with a fresh admin-key file.
const preparedName = 'ep-e2e-11111111-1111-1111-1111-111111111111';
it('keeps a prepared E2E container stopped with its volume and resumes it later', async () => {
  serveBackend();
  const first = await startLocalBackend({ directory: join(root, 'first') });
  await first.stop({ keep: true });
  let state = await readState();
  expect(state.log.at(-1)).toEqual(['stop', '--time', '10', 'container-id']);
  expect(state.container).toMatchObject({ running: false });
  await setState({ ...state, log: [] });
  const resumed = await startLocalBackend({
    directory: join(root, 'second'),
    reuseName: first.name,
  });
  expect(resumed.name).toBe(first.name);
  expect(resumed.url).toBe(first.url);
  expect(await commands()).not.toContain('create');
  expect(await commands()).toContain('start');
  expect(await readFile(resumed.adminKeyFile, 'utf8')).toBe(
    'ep-instance|0123abcd',
  );
  expect(resumed.adminKeyFile.startsWith(join(root, 'second'))).toBe(true);
  // Removing it later takes its anonymous volume too.
  await discardLocalBackend(first.name);
  state = await readState();
  expect(state.container).toBeNull();
  expect(state.log.at(-1)).toEqual([
    'rm',
    '--force',
    '--volumes',
    'container-id',
  ]);
});

it('refuses to resume a prepared container that is gone or not ours, and creates none', async () => {
  serveBackend();
  const missing = await failure(
    startLocalBackend({ directory: root, reuseName: preparedName }),
  );
  expect(missing.diagnostic).toMatchObject({ reason: 'missing' });
  await existing({ name: preparedName, label: 'someone-else' });
  const foreign = await failure(
    startLocalBackend({ directory: root, reuseName: preparedName }),
  );
  expect(foreign.diagnostic).toMatchObject({ reason: 'ownership' });
  expect(await commands()).not.toContain('create');
  expect(await commands()).not.toContain('rm');
});

it('reports whether a prepared container is running, only for our own label', async () => {
  expect(await isLocalBackendRunning(preparedName)).toBe(false);
  await existing({ name: preparedName, label: preparedName, running: true });
  expect(await isLocalBackendRunning(preparedName)).toBe(true);
  await existing({ name: preparedName, label: preparedName, running: false });
  expect(await isLocalBackendRunning(preparedName)).toBe(false);
  // Another owner's container is not ours to judge, so it counts as running
  // and is never discarded automatically.
  await existing({ name: preparedName, label: 'someone-else', running: false });
  expect(await isLocalBackendRunning(preparedName)).toBe(true);
  await discardLocalBackend(preparedName);
  expect((await readState()).container).not.toBeNull();
});
