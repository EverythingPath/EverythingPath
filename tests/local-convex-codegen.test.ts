// @vitest-environment node
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { HarnessFailure } from '../e2e/support/diagnostics';
import { CommandFailure, command } from '../e2e/support/process';
import type * as ProcessModule from '../e2e/support/process';
import { startLocalBackend } from '../scripts/local-convex/backend';
import {
  describeCodegenFailure,
  generateLocalBindings,
} from '../scripts/local-convex/generate';

vi.mock('../e2e/support/process', async (importOriginal) => ({
  ...(await importOriginal<typeof ProcessModule>()),
  command: vi.fn(),
}));
vi.mock('../scripts/local-convex/backend', () => ({
  startLocalBackend: vi.fn(),
}));

const instanceSecret = 'ab'.repeat(32);
const backendName = 'ep-e2e-11111111-1111-1111-1111-111111111111';
const adminKey = `${backendName}|01${'cd'.repeat(20)}`;
let root: string;
let scratch: string;
const stop = vi.fn<() => Promise<void>>();
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'codegen-source-'));
  await mkdir(join(root, 'convex'));
  await mkdir(join(root, 'node_modules'));
  await writeFile(join(root, 'package.json'), '{}');
  await writeFile(join(root, '.env.local'), 'CONVEX_DEPLOYMENT=dev:owner\n');
  stop.mockResolvedValue();
  vi.mocked(startLocalBackend).mockImplementation(async ({ directory }) => {
    scratch = directory;
    const envFile = join(directory, 'convex.env');
    await writeFile(envFile, 'local credentials');
    await writeFile(join(directory, 'local-admin.key'), `${adminKey}\n`);
    return {
      name: 'test-local',
      url: 'http://127.0.0.1:3210',
      siteUrl: 'http://127.0.0.1:3211',
      envFile,
      adminKeyFile: join(directory, 'local-admin.key'),
      stop,
    };
  });
  vi.mocked(command).mockResolvedValue('');
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(root, { recursive: true, force: true });
});

async function expectCleaned() {
  expect(stop).toHaveBeenCalledOnce();
  await expect(readFile(join(scratch, 'convex.env'))).rejects.toMatchObject({
    code: 'ENOENT',
  });
  expect(await readFile(join(root, '.env.local'), 'utf8')).toBe(
    'CONVEX_DEPLOYMENT=dev:owner\n',
  );
}

it('pushes only to its disposable backend and isolates CLI env writes from the checkout', async () => {
  for (const key of [
    'CONVEX_DEPLOY_KEY',
    'CONVEX_DEPLOYMENT',
    'CONVEX_OVERRIDE_ACCESS_TOKEN',
    'CONVEX_SELF_HOSTED_URL',
    'CONVEX_SELF_HOSTED_ADMIN_KEY',
    'NEXT_PUBLIC_CONVEX_URL',
    'CLERK_SECRET_KEY',
    'E2E_RUN_FILE',
  ])
    vi.stubEnv(key, 'must-not-reach-cli');
  vi.mocked(command).mockImplementation(async (_stage, args, options) => {
    expect(args.slice(-2)).toEqual(['--env-file', join(scratch, 'convex.env')]);
    expect(Object.values(options.env ?? {})).not.toContain(
      'must-not-reach-cli',
    );
    expect(options.cwd).toBe(scratch);
    const config = z
      .object({ functions: z.string() })
      .parse(JSON.parse(await readFile(join(scratch, 'convex.json'), 'utf8')));
    expect(resolve(scratch, config.functions)).toBe(join(root, 'convex'));
    await writeFile(join(scratch, '.env.local'), 'generated local URL');
    return '';
  });
  await generateLocalBindings(root);
  expect(
    vi.mocked(command).mock.calls.map(([, args]) => args.slice(0, 4)),
  ).toEqual([
    ['exec', 'convex', 'env', 'set'],
    ['exec', 'convex', 'dev', '--once'],
  ]);
  await expectCleaned();
});

const failed = () =>
  generateLocalBindings(root).then(
    () => [],
    (error: unknown) => describeCodegenFailure(error),
  );

it('removes credentials and the backend after a failed push without retrying elsewhere', async () => {
  vi.mocked(command)
    .mockResolvedValueOnce('')
    .mockRejectedValueOnce(new Error('push failed'));
  expect((await failed())[0]).toContain('convex dev --once');
  expect(command).toHaveBeenCalledTimes(2);
  await expectCleaned();
});

it.each([
  ['whole', ''],
  // The admin key spans the 1000-character cut; only 20 of its hex
  // characters would remain, below the hex filter's 32, if the cut came first.
  ['cut at the truncation point', 'x'.repeat(920)],
])(
  'shows a build failure’s CLI output, without the admin key or instance secret (%s)',
  async (_case, padding) => {
    vi.mocked(command).mockImplementation(async (stage, _args, options) => {
      if (stage !== 'local codegen dev') return '';
      // As command() keeps the tail: redact each whole line, then truncate.
      const keep = (line: string) =>
        options.outputTail?.redactLine(line).slice(0, 1_000) ?? '';
      throw new CommandFailure(stage, 1, undefined, [
        keep(
          "convex/characterAttacks.ts:12:7 - error TS2322: Type 'string' is not assignable to type 'number'.",
        ),
        keep(`${padding}Using admin key ${adminKey}`),
        keep(`INSTANCE_SECRET=${instanceSecret}`),
      ]);
    });
    const printed = (await failed()).join('\n');
    expect(printed).toContain(
      'Local code generation failed in `convex dev --once`',
    );
    expect(printed).toContain('Convex CLI dev --once: exit 1');
    expect(printed).toContain('convex/characterAttacks.ts:12:7 - error TS2322');
    expect(printed).not.toContain(adminKey.slice(0, 20));
    expect(printed).not.toContain('cdcdcd');
    expect(printed).not.toContain(instanceSecret.slice(0, 8));
    await expectCleaned();
  },
);

it('keeps a build failure primary, names the backend it could not remove, and still deletes its credentials', async () => {
  vi.mocked(command)
    .mockResolvedValueOnce('')
    .mockRejectedValueOnce(new CommandFailure('local codegen dev', 1));
  stop.mockRejectedValueOnce(
    new HarnessFailure({
      kind: 'local-backend',
      reason: 'stop',
      name: backendName,
    }),
  );
  const printed = await failed();
  expect(printed[0]).toContain('in `convex dev --once`');
  expect(printed).toContain('Its Docker backend could not be removed either:');
  expect(printed.at(-1)).toContain(`docker rm -f -v ${backendName}`);
  await expectCleaned();
});

it('reports a backend it could not remove after a successful push', async () => {
  stop.mockRejectedValueOnce(
    new HarnessFailure({
      kind: 'local-backend',
      reason: 'stop',
      name: backendName,
    }),
  );
  const printed = await failed();
  expect(printed[0]).toBe(
    'Local code generation succeeded, but its Docker backend could not be removed.',
  );
  expect(printed.at(-1)).toContain(`docker rm -f -v ${backendName}`);
  await expectCleaned();
});

it('reports a Docker failure as such, distinct from a build failure', async () => {
  vi.mocked(startLocalBackend).mockRejectedValueOnce(
    new HarnessFailure({ kind: 'local-backend', reason: 'docker-unavailable' }),
  );
  expect(await failed()).toEqual([
    'Local code generation failed while starting its Docker backend (not a build error).',
    'Docker is not reachable; start the Docker daemon and retry',
  ]);
  expect(command).not.toHaveBeenCalled();
});

it('waits for interrupted startup to settle, then removes its backend without a push', async () => {
  const start = vi.mocked(startLocalBackend).getMockImplementation()!;
  vi.mocked(startLocalBackend).mockImplementation(async (options) => {
    process.emit('SIGTERM');
    return start(options);
  });
  await expect(generateLocalBindings(root)).rejects.toThrow('interrupted');
  expect(command).not.toHaveBeenCalled();
  await expectCleaned();
});

it('stops after interruption during a command and still cleans up', async () => {
  vi.mocked(command).mockImplementationOnce(async () => {
    process.emit('SIGINT');
    return '';
  });
  await expect(generateLocalBindings(root)).rejects.toThrow('interrupted');
  expect(command).toHaveBeenCalledOnce();
  await expectCleaned();
});

it('reports interruption during final cleanup as a failed gate', async () => {
  stop.mockImplementationOnce(async () => {
    process.emit('SIGTERM');
  });
  await expect(generateLocalBindings(root)).rejects.toThrow('interrupted');
  await expectCleaned();
});

it('keeps an interruption primary and names the container its startup rollback left running', async () => {
  vi.mocked(startLocalBackend).mockImplementationOnce(async () => {
    process.emit('SIGINT');
    throw new HarnessFailure(
      { kind: 'local-backend', reason: 'interrupted' },
      undefined,
      {
        kind: 'local-backend',
        reason: 'stop-after-failure',
        name: backendName,
      },
    );
  });
  const printed = await failed();
  expect(printed[0]).toBe('Local code generation was interrupted.');
  expect(printed).toContain('Its Docker backend could not be removed either:');
  expect(printed.at(-1)).toContain(`docker rm -f -v ${backendName}`);
  expect(command).not.toHaveBeenCalled();
});
