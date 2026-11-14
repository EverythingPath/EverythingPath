// @vitest-environment node
import { spawn } from 'node:child_process';
import { createServer, type IncomingMessage } from 'node:http';
import {
  readdir,
  readFile,
  mkdtemp,
  rm,
  writeFile,
  mkdir,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { failureReport } from './setup-failure';
import { CommandFailure, fixtureCall, fixtureRetry, type Run } from './process';
import { fixtureCredentials, resources } from './test-data';

// #754: a fixture call's arguments carry the cohort capability, so they reach
// the Convex CLI through stdin, never through any process's argv. These tests
// run the installed `convex` CLI (1.45.0) for real against a loopback server:
// no network leaves the machine and nothing is deployed.

const secret = fixtureCredentials.token;
const scope = {
  namespace: resources.previewName,
  version: 1,
  workerKey: 'worker-0',
  caseKey: 'smoke' as const,
  ...fixtureCredentials,
};

let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'e2e-fixture-arguments-'));
  // The CLI reports a crash to Sentry unless `CI` is set; keep it offline.
  vi.stubEnv('CI', 'true');
  // A read's transport retries (#754) would otherwise wait for seconds.
  vi.spyOn(fixtureRetry, 'sleep').mockResolvedValue(undefined);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await rm(directory, { recursive: true, force: true });
});

/** Every process's command line on this machine that contains `value`. */
async function commandLinesContaining(value: string) {
  const found: string[] = [];
  for (const pid of await readdir('/proc')) {
    if (!/^[0-9]+$/.test(pid)) continue;
    const cmdline = await readFile(`/proc/${pid}/cmdline`, 'utf8').catch(
      () => '',
    );
    if (cmdline.includes(value)) found.push(pid);
  }
  return found;
}

async function readBody(request: IncomingMessage) {
  let body = '';
  for await (const chunk of request) body += String(chunk);
  return body;
}

/** A loopback stand-in for the deployment's `/api/function`. */
async function deployment(
  respond: (body: { path: string; args: unknown }) => object,
) {
  const requests: { path: string; args: unknown; leakingPids: string[] }[] = [];
  const server = createServer((request, response) => {
    void (async () => {
      const body = JSON.parse(await readBody(request)) as {
        path: string;
        args: unknown;
      };
      // While the real CLI waits for this response, no command line may
      // hold the capability: not the wrapper's, not the CLI's, not ours.
      requests.push({
        path: body.path,
        args: body.args,
        leakingPids: await commandLinesContaining(secret),
      });
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(respond(body)));
    })();
  });
  await new Promise<void>((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve()),
  );
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  return {
    url: `http://127.0.0.1:${address.port}`,
    requests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** A local-backend run whose env file points the CLI at `url`. */
async function localRun(url: string): Promise<Run> {
  const envFile = join(directory, 'convex.env');
  await writeFile(
    envFile,
    `CONVEX_SELF_HOSTED_URL=${url}\nCONVEX_SELF_HOSTED_ADMIN_KEY=synthetic-admin-key\n`,
    { mode: 0o600 },
  );
  const run = {
    backend: 'local',
    resources,
    workspace: process.cwd(),
    sourceRoot: process.cwd(),
    privateDirectory: directory,
    artifactDirectory: join(directory, 'artifacts'),
    envFile,
    baseURL: 'http://127.0.0.1:49123',
    workers: 1,
  } satisfies Partial<Run>;
  const runFile = join(directory, 'run.json');
  await writeFile(runFile, JSON.stringify(run), { mode: 0o600 });
  // Evidence: `command()` logs every fixture call into the artifacts.
  vi.stubEnv('E2E_RUN_FILE', runFile);
  return run as Run;
}

/** Everything a failed call leaves where a person or an upload can see it. */
async function reports(error: unknown) {
  const artifacts = join(directory, 'artifacts');
  const files = await readdir(artifacts).catch(() => [] as string[]);
  return [
    String(error),
    error instanceof Error ? (error.stack ?? '') : '',
    JSON.stringify(error),
    failureReport(error).join('\n'),
    ...(await Promise.all(
      files.map((file) => readFile(join(artifacts, file), 'utf8')),
    )),
  ].join('\n');
}

it('the real Convex CLI parses `run <function> <json>` from stdin, and no command line holds the capability', async () => {
  const server = await deployment(() => ({
    status: 'success',
    value: { campaignKey: 'smoke-campaign' },
    logLines: [],
  }));
  try {
    const run = await localRun(server.url);
    await expect(fixtureCall(run, 'inspectCase', scope)).resolves.toEqual({
      campaignKey: 'smoke-campaign',
    });
    expect(server.requests).toEqual([
      {
        path: 'e2eFixtures:inspectCase',
        args: scope,
        leakingPids: [],
      },
    ]);
  } finally {
    await server.close();
  }
}, 60_000);

// #774: each call is still its own CLI process and its own request, but the
// processes share Node's compile cache (NODE_COMPILE_CACHE) in the run's
// private directory, so later calls skip compiling the CLI bundle.
it('runs every call as its own CLI process and request, sharing one compile cache in the private directory', async () => {
  let reads = 0;
  const server = await deployment(() => ({
    status: 'success',
    value: { read: ++reads },
    logLines: [],
  }));
  try {
    const run = await localRun(server.url);
    // Every read is fresh: the second sees the deployment's second answer.
    await expect(fixtureCall(run, 'inspectCase', scope)).resolves.toEqual({
      read: 1,
    });
    await expect(fixtureCall(run, 'inspectCase', scope)).resolves.toEqual({
      read: 2,
    });
    expect(server.requests).toHaveLength(2);
    const cache = join(directory, 'node-compile-cache');
    const files = (
      await readdir(cache, { recursive: true, withFileTypes: true })
    )
      .filter((entry) => entry.isFile())
      .map((entry) => join(entry.parentPath, entry.name));
    expect(files.length).toBeGreaterThan(0);
    // Compiled code only: no call's arguments are ever written there.
    for (const file of files)
      expect((await readFile(file)).includes(secret)).toBe(false);
    // Nor is it evidence the run uploads.
    expect(await readdir(join(directory, 'artifacts'))).not.toContain(
      'node-compile-cache',
    );
  } finally {
    await server.close();
  }
}, 60_000);

it('keeps the capability out of the reports when the deployment echoes the arguments in its error', async () => {
  const server = await deployment(({ args }) => ({
    status: 'error',
    errorMessage: `ArgumentValidationError: Value does not match validator. ${JSON.stringify(args)}`,
    logLines: [],
  }));
  try {
    const run = await localRun(server.url);
    const error = await fixtureCall(run, 'inspectCase', scope).catch(
      (failure: unknown) => failure,
    );
    expect(error).toBeInstanceOf(CommandFailure);
    expect((error as CommandFailure).diagnostics).toContain(
      'Convex argument validation failed',
    );
    expect(await reports(error)).not.toContain(secret);
  } finally {
    await server.close();
  }
}, 60_000);

it('keeps the capability out of the reports when the CLI cannot reach the deployment', async () => {
  // Nothing listens on this port once the server is closed.
  const server = await deployment(() => ({}));
  await server.close();
  const run = await localRun(server.url);
  const error = await fixtureCall(run, 'inspectCase', scope).catch(
    (failure: unknown) => failure,
  );
  expect(error).toBeInstanceOf(CommandFailure);
  expect(await reports(error)).not.toContain(secret);
}, 60_000);

/** A workspace whose `convex` package entry is `entry`, for wrapper failures. */
async function stubWorkspace(entry: string | null): Promise<Run> {
  const packageDirectory = join(directory, 'node_modules', 'convex');
  await mkdir(packageDirectory, { recursive: true });
  await writeFile(
    join(packageDirectory, 'package.json'),
    JSON.stringify({ name: 'convex', bin: { convex: 'cli.mjs' } }),
  );
  if (entry !== null) await writeFile(join(packageDirectory, 'cli.mjs'), entry);
  const run = await localRun('http://127.0.0.1:9');
  return { ...run, workspace: directory };
}

it.each([
  [
    'oversized arguments, which also closes the pipe early',
    { ...scope, padding: 'x'.repeat(3 * 1024 * 1024) },
    'process.stdout.write("unreachable")',
  ],
  ['a CLI that cannot load', scope, null],
  [
    'a CLI that fails and prints its arguments',
    scope,
    'console.error("Failed to parse arguments as JSON: " + process.argv[4]); process.exit(1);',
  ],
])(
  'keeps the capability out of the reports for %s',
  async (_label, args, entry) => {
    const run = await stubWorkspace(entry);
    const error = await fixtureCall(
      run,
      'inspectCase',
      args as typeof scope,
    ).catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(CommandFailure);
    expect((error as CommandFailure).exitCode).not.toBe(0);
    expect(await reports(error)).not.toContain(secret);
  },
  60_000,
);

it('the wrapper hands the CLI exactly `[node, cli, run, function, json, ...flags]`', async () => {
  const run = await stubWorkspace(
    'process.stdout.write(JSON.stringify(process.argv.slice(1)));',
  );
  const output = (await fixtureCall(run, 'inspectCase', scope)) as string[];
  expect(output).toEqual([
    join(directory, 'node_modules', 'convex', 'cli.mjs'),
    'run',
    'e2eFixtures:inspectCase',
    JSON.stringify(scope),
    '--env-file',
    run.envFile,
  ]);
});

it('a fixture call spawns no process whose argv holds its arguments', async () => {
  const run = await stubWorkspace(
    // Hold the call open so its command line can be read.
    'setTimeout(() => process.stdout.write("{}"), 1500);',
  );
  const call = fixtureCall(run, 'inspectCase', scope);
  let sawWrapper = false;
  const deadline = Date.now() + 1200;
  while (Date.now() < deadline) {
    expect(await commandLinesContaining(secret)).toEqual([]);
    expect(await commandLinesContaining(JSON.stringify(scope))).toEqual([]);
    sawWrapper ||=
      (await commandLinesContaining('convex-run-stdin.mjs')).length > 0;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  await call;
  expect(sawWrapper).toBe(true);
});

// The direct spawn test: the wrapper itself, run as the harness runs it.
it('the wrapper refuses arguments that are not one JSON object without echoing them', async () => {
  const wrapper = join(process.cwd(), 'e2e', 'support', 'convex-run-stdin.mjs');
  for (const input of [`[${JSON.stringify(secret)}]`, `${secret}`]) {
    const child = spawn(
      process.execPath,
      [
        wrapper,
        join(directory, 'missing.mjs'),
        'run',
        'e2eFixtures:inspectCase',
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => (output += String(chunk)));
    child.stderr.on('data', (chunk: Buffer) => (output += String(chunk)));
    child.stdin.end(input);
    const code = await new Promise<number | null>((resolve) =>
      child.on('close', resolve),
    );
    expect(code).toBe(86);
    expect(output).not.toContain(secret);
  }
});

// #754 review P1: the CLI reports crashes to Sentry unless `CI` is set (and
// `VERCEL` is not "1"); a report could carry the arguments. The wrapper opts
// the fixture child out itself, whatever the harness's own environment.
it('opts the fixture CLI out of crash reporting in its own process only', async () => {
  vi.stubEnv('CI', '');
  vi.stubEnv('VERCEL', '1');
  const run = await stubWorkspace(
    'process.stdout.write(JSON.stringify({ ci: process.env.CI ?? null, vercel: process.env.VERCEL ?? null }));',
  );
  expect(await fixtureCall(run, 'inspectCase', scope)).toEqual({
    ci: 'true',
    vercel: null,
  });
  // The harness's own environment is unchanged.
  expect(process.env.CI).toBe('');
  expect(process.env.VERCEL).toBe('1');
});
