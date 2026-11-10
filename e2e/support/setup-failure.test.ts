// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { expect, it } from 'vitest';
import { z } from 'zod';
import { HarnessFailure, secondaryFailure } from './diagnostics';
import { focused } from './matrix';
import { command, CommandEvidenceFailure, CommandFailure } from './process';
import {
  acquireSlotLock,
  classifyError,
  CleanupFailure,
  failureReport,
  isErrorClass,
  releaseSlotLock,
  SetupFailure,
  setupStage,
  setupStages,
  slotLockPath,
  withCleanup,
} from './setup-failure';
import { resources } from './test-data';

const secret = 'sk_test_SyntheticSecret123';
// Each starts with a prefix the previous allowlist printed verbatim.
const prefixedSecrets = [
  `Clerk https://x.test/?token=${secret}`,
  `E2E preflight: ${secret}`,
  `Usage: ${secret}`,
  `preview deployment and web build: ${secret}`,
  `Convex generated-code drift (\u001b[2J${secret}.ts)`,
  `Secrets file ${secret}`,
];
function systemError(code: string) {
  return Object.assign(new Error(`${code}: open '/private/${secret}'`), {
    code,
  });
}
async function failureOf(promise: Promise<unknown>) {
  return promise.then(
    () => {
      throw new Error('expected a failure');
    },
    (error: unknown) => error,
  );
}
function printed(error: unknown) {
  return failureReport(error).join('\n');
}

it('labels a failure with the stage that was running', async () => {
  for (const stage of setupStages) {
    const failure = await failureOf(
      setupStage(stage, () => {
        throw systemError('ENOENT');
      }),
    );
    expect(failure).toMatchObject({ stage, errorClass: 'ENOENT' });
    expect(printed(failure)).toBe(`E2E setup failed: ${stage} (ENOENT)`);
  }
  expect(await setupStage('port', () => 4321)).toBe(4321);
  const inner = await failureOf(
    setupStage('resources', () => Promise.reject(systemError('EACCES'))),
  );
  // The innermost stage wins; a command's evidence setup has its own label.
  expect(
    await failureOf(
      setupStage('deployment', () => {
        throw inner;
      }),
    ),
  ).toBe(inner);
  expect(
    printed(
      await failureOf(
        setupStage('deployment', () =>
          Promise.reject(
            new CommandEvidenceFailure('deploy', systemError('ENOENT')),
          ),
        ),
      ),
    ),
  ).toBe('E2E setup failed: evidence (ENOENT)');
});

it('maps errors only to the closed class set, from typed fields', () => {
  const cases: [unknown, string][] = [
    [systemError('ENOENT'), 'ENOENT'],
    [systemError('EEXIST'), 'EEXIST'],
    [systemError('ETIMEDOUT'), 'ETIMEDOUT'],
    [systemError('ECONNREFUSED'), 'ECONNREFUSED'],
    [systemError('UND_ERR_CONNECT_TIMEOUT'), 'ETIMEDOUT'],
    [
      new TypeError('fetch failed', { cause: systemError('ENOTFOUND') }),
      'ENOTFOUND',
    ],
    [new CommandFailure('deploy', 2), 'exit-2'],
    [new CommandFailure('deploy', null), 'terminated'],
    [new CommandFailure('deploy', null, 'ENOENT'), 'ENOENT'],
    [new CommandFailure('deploy', null, secret), 'unknown'],
    [new CommandFailure('deploy', 0), 'unknown'],
    [Object.assign(new Error('git'), { status: 128 }), 'exit-128'],
    [
      Object.assign(new Error('git'), { status: null, signal: 'SIGTERM' }),
      'terminated',
    ],
    [new DOMException('aborted', 'TimeoutError'), 'timeout'],
    [new HarnessFailure({ kind: 'deadline' }), 'timeout'],
    [new HarnessFailure({ kind: 'usage' }), 'validation'],
    [z.string().safeParse(1).error, 'validation'],
    [new SyntaxError('Unexpected token'), 'validation'],
    [
      (() => {
        try {
          parseArgs({ args: ['--nope'], options: {}, strict: true });
        } catch (error) {
          return error;
        }
      })(),
      'validation',
    ],
    // Neither a message, a name nor a non-fetch cause is ever read.
    ...prefixedSecrets.map((message): [unknown, string] => [
      new Error(message),
      'unknown',
    ]),
    [new Error('E2E execution exceeded its time budget'), 'unknown'],
    [Object.assign(new Error('x'), { name: 'TimeoutError' }), 'unknown'],
    [new Error('x', { cause: systemError('EACCES') }), 'unknown'],
    [systemError(secret), 'unknown'],
    [Object.assign(new Error('x'), { status: 1_000 }), 'unknown'],
    ['a thrown string', 'unknown'],
    [undefined, 'unknown'],
    [null, 'unknown'],
  ];
  for (const [error, expected] of cases) {
    const errorClass = classifyError(error);
    expect(errorClass).toBe(expected);
    expect(isErrorClass(errorClass)).toBe(true);
  }
  expect(isErrorClass(secret)).toBe(false);
  expect(isErrorClass('exit-0')).toBe(false);
  expect(isErrorClass('exit-256')).toBe(false);
});

it('never prints a message, even one with a trusted prefix', async () => {
  for (const message of prefixedSecrets) {
    const hostile = Object.assign(
      new Error(message, { cause: new Error(message) }),
      { name: secret, code: `https://x.test/?key=${secret}` },
    );
    const failure = await failureOf(
      setupStage('clerk-verification', () => Promise.reject(hostile)),
    );
    const cleanup = await failureOf(
      withCleanup(
        () => Promise.reject(hostile),
        [['temporary-directory', () => Promise.reject(hostile)]],
      ),
    );
    expect(printed(failure)).toBe(
      'E2E setup failed: clerk-verification (unknown)',
    );
    expect(printed(cleanup)).toBe(
      'E2E failed after setup (unknown); inspect the safe evidence directory.\nE2E cleanup also failed: temporary-directory (unknown)',
    );
    expect(printed(hostile)).toBe(
      'E2E failed after setup (unknown); inspect the safe evidence directory.',
    );
    expect(failure).not.toHaveProperty('cause');
    expect(JSON.stringify(failure)).not.toContain(secret);
  }
  // A command is named only when it is one of the runner's own.
  expect(printed(new CommandFailure('E2E nightly browser journeys', 1))).toBe(
    'E2E nightly browser journeys: process failed (exit-1)',
  );
  expect(printed(new CommandFailure(`fixture ${secret}`, 1))).toBe(
    'E2E failed after setup (exit-1); inspect the safe evidence directory.',
  );
  // Typed fields are re-validated when printed.
  expect(
    printed(
      new HarnessFailure({
        kind: 'preflight',
        reason: secret as 'Clerk target is production',
      }),
    ),
  ).toBe('E2E preflight: target validation failed');
  expect(
    printed(new HarnessFailure({ kind: 'workers-range', cohorts: NaN })),
  ).toBe(
    'E2E workers must be between 1 and the declared number of declared cohorts',
  );
  expect(
    printed(
      new HarnessFailure({
        kind: 'results',
        suite: { kind: 'journeys', titles: [secret] },
      }),
    ),
  ).toBe('E2E selected results are incomplete or unsuccessful');
  expect(
    printed(new HarnessFailure({ kind: 'results', suite: focused('sheet') })),
  ).toBe('E2E focused (sheet) results are incomplete or unsuccessful');
});

it('keeps a command failure primary when its failed-stage log write fails', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'e2e-log-failure-'));
  const packageDirectory = join(directory, 'node_modules', 'convex');
  const artifactDirectory = join(directory, 'artifacts');
  const runFile = join(directory, 'run.json');
  await mkdir(packageDirectory, { recursive: true });
  await writeFile(
    join(packageDirectory, 'package.json'),
    JSON.stringify({ name: 'convex', bin: 'fixture.cjs' }),
  );
  // The child turns stages.log into a directory, so the next append fails.
  await writeFile(
    join(packageDirectory, 'fixture.cjs'),
    `require('node:fs').rmSync(${JSON.stringify(join(artifactDirectory, 'stages.log'))}); require('node:fs').mkdirSync(${JSON.stringify(join(artifactDirectory, 'stages.log'))}); process.exit(3);`,
  );
  await writeFile(
    runFile,
    JSON.stringify({
      resources,
      workspace: directory,
      sourceRoot: directory,
      privateDirectory: directory,
      artifactDirectory,
      envFile: join(directory, 'convex.env'),
      baseURL: 'http://127.0.0.1:49123',
    }),
  );
  try {
    const failure = await failureOf(
      command('deploy', ['exec', 'convex', 'run', 'probe'], {
        cwd: directory,
        env: { ...process.env, E2E_RUN_FILE: runFile },
      }),
    );
    expect(failure).toBeInstanceOf(CommandFailure);
    expect(failure).toMatchObject({ exitCode: 3 });
    expect(classifyError(secondaryFailure(failure))).toBe('EISDIR');
    expect(
      failureReport(
        await failureOf(
          setupStage('deployment', () => {
            throw failure;
          }),
        ),
      ),
    ).toEqual([
      'E2E setup failed: deployment (exit-3)',
      'E2E evidence log also failed (EISDIR)',
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('reports an existing slot lock by relative path and leaves it in place', async () => {
  const directory = await mkdtemp(join(tmpdir(), `e2e-slot-\u001b-${secret}-`));
  try {
    const lock = await acquireSlotLock(directory, resources.previewName);
    const failure = await failureOf(
      acquireSlotLock(directory, resources.previewName),
    );
    expect(failure).toMatchObject({ stage: 'slot-lock', errorClass: 'EEXIST' });
    const lines = failureReport(failure);
    expect(lines[0]).toBe(
      'E2E setup failed: slot already locked (active or stale)',
    );
    expect(lines[1]).toMatch(
      /^Lock: e2e\/\.private\/e2e-local-test-slot-0\.lock \(created \d{4}-\d\d-\d\dT[0-9:.]+Z\)$/,
    );
    expect(lines[2]).toContain('docker ps');
    expect(lines.join('\n')).not.toContain(directory);
    // A slot name outside the resource schema is never printed.
    expect(
      failureReport(
        new SetupFailure('slot-lock', 'EEXIST', undefined, undefined, {
          slot: `../${secret}`,
          createdAt: secret,
        }),
      )[1],
    ).toBe('Lock: e2e/.private/<slot>.lock');
    await releaseSlotLock(lock);
    await expect(
      readFile(join(lock.path, 'owner.json'), 'utf8'),
    ).rejects.toThrow();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('never releases a replacement lock', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'e2e-slot-replaced-'));
  try {
    const lock = await acquireSlotLock(directory, resources.previewName);
    await rm(lock.path, { recursive: true });
    const replacement = await acquireSlotLock(directory, resources.previewName);
    const failure = await failureOf(releaseSlotLock(lock));
    expect(failure).toBeInstanceOf(HarnessFailure);
    expect(
      JSON.parse(await readFile(join(replacement.path, 'owner.json'), 'utf8')),
    ).toMatchObject({ owner: replacement.owner });
    // A lock that disappeared is reported the same way, never recreated.
    await rm(replacement.path, { recursive: true });
    await expect(releaseSlotLock(replacement)).rejects.toBeInstanceOf(
      HarnessFailure,
    );
    expect(slotLockPath(directory, 'x')).toBe(join(directory, 'x.lock'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('keeps the primary failure when cleanup also fails, and still runs every cleanup', async () => {
  const primary = new SetupFailure('source-snapshot', 'ENOSPC');
  const ran: string[] = [];
  const failure = await failureOf(
    withCleanup(
      () => Promise.reject(primary),
      [
        [
          'temporary-directory',
          () => {
            ran.push('temporary-directory');
            return Promise.reject(systemError('EACCES'));
          },
        ],
        [
          'slot-lock',
          () => {
            ran.push('slot-lock');
            return Promise.reject(
              new HarnessFailure({ kind: 'slot-lock-replaced' }),
            );
          },
        ],
      ],
    ),
  );
  expect(ran).toEqual(['temporary-directory', 'slot-lock']);
  expect(failure).toBeInstanceOf(CleanupFailure);
  expect(failureReport(failure)).toEqual([
    'E2E setup failed: source-snapshot (ENOSPC)',
    'E2E cleanup also failed: temporary-directory (EACCES)',
  ]);
  const cleanupOnly = await failureOf(
    withCleanup(
      () => Promise.resolve('done'),
      [['slot-lock', () => Promise.reject(systemError('EBUSY'))]],
    ),
  );
  expect(failureReport(cleanupOnly)).toEqual([
    'E2E cleanup failed: slot-lock (EBUSY)',
  ]);
  await expect(withCleanup(() => Promise.resolve('done'), [])).resolves.toBe(
    'done',
  );
  await expect(withCleanup(() => Promise.reject(primary), [])).rejects.toBe(
    primary,
  );
});
