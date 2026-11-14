// @vitest-environment node
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { z } from 'zod';
import {
  command,
  CommandFailure,
  isolateCases,
  parseFixtureResponse,
  withIsolationCanary,
} from './process';
import { resources } from './test-data';

it('runs the workspace-installed Convex fixture CLI without a package-manager subprocess', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'e2e-installed-cli-'));
  const packageDirectory = join(directory, 'node_modules', 'convex');
  await mkdir(packageDirectory, { recursive: true });
  await writeFile(
    join(packageDirectory, 'package.json'),
    JSON.stringify({ name: 'convex', bin: { convex: 'fixture.cjs' } }),
  );
  await writeFile(
    join(packageDirectory, 'fixture.cjs'),
    'process.stdout.write(JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd(), token: process.env.CONVEX_OVERRIDE_ACCESS_TOKEN }));',
  );
  try {
    const output = await command(
      'fixture CLI probe',
      ['exec', 'convex', 'run', 'fixture:inspect'],
      {
        // The arguments travel on stdin (#754) and reach the CLI unchanged.
        input: '{"literal":"$() spaced"}',
        cwd: directory,
        env: {
          NODE_ENV: 'test',
          PATH: '',
          CONVEX_DEPLOY_KEY: 'preview:test|synthetic-key',
          CONVEX_OVERRIDE_ACCESS_TOKEN: 'synthetic-personal-token',
        },
      },
    );
    expect(JSON.parse(output)).toEqual({
      args: ['run', 'fixture:inspect', '{"literal":"$() spaced"}'],
      cwd: directory,
      token: 'preview:test|synthetic-key',
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('handles silent null fixture results without hiding missing query results', () => {
  expect(parseFixtureResponse('seedIdentityProjection', '')).toBeNull();
  expect(parseFixtureResponse('cleanupCase', '\n')).toBeNull();
  expect(parseFixtureResponse('loseMembership', '')).toBeNull();
  expect(parseFixtureResponse('deleteAccount', '')).toBeNull();
  expect(() => parseFixtureResponse('resetCase', '')).toThrow(
    'invalid response',
  );
  expect(() => parseFixtureResponse('inspectCase', '')).toThrow(
    'invalid response',
  );
  expect(parseFixtureResponse('resetCase', '{"campaignId":"test"}')).toEqual({
    campaignId: 'test',
  });
});

it('persists safe service diagnostics while a process is still running and closes it on timeout', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'e2e-process-test-'));
  const packageDirectory = join(directory, 'node_modules', 'convex');
  await mkdir(packageDirectory, { recursive: true });
  await writeFile(
    join(packageDirectory, 'package.json'),
    JSON.stringify({ name: 'convex', bin: 'fixture.cjs' }),
  );
  await writeFile(
    join(packageDirectory, 'fixture.cjs'),
    'process.stderr.write("ArgumentValidationError: opaque-provider-secret\\n"); setInterval(() => {}, 1000);',
  );
  const runFile = join(directory, 'run.json');
  const artifactDirectory = join(directory, 'artifacts');
  await writeFile(
    runFile,
    JSON.stringify({
      resources,
      workspace: process.cwd(),
      sourceRoot: process.cwd(),
      privateDirectory: directory,
      artifactDirectory,
      envFile: join(directory, 'convex.env'),
      baseURL: 'http://127.0.0.1:49123',
    }),
  );
  try {
    const running = command(
      'production application server',
      ['exec', 'convex', 'run', 'fixture:wait'],
      {
        cwd: directory,
        env: { ...process.env, E2E_RUN_FILE: runFile },
        timeoutMs: 2000,
      },
    );
    // Attach the rejection handler before observing the file, avoiding an
    // unhandled timeout rejection if a heavily loaded worker is delayed.
    const completed = running.then(
      () => 'unexpected success',
      (error: unknown) => (error instanceof Error ? error.message : 'failed'),
    );
    await expect
      .poll(
        async () =>
          await readFile(
            join(artifactDirectory, 'diagnostics.log'),
            'utf8',
          ).catch(() => ''),
        { timeout: 1500 },
      )
      .toBe(
        'production application server: Convex argument validation failed\n',
      );
    expect(await completed).toContain('process failed');
    expect(
      await readFile(join(artifactDirectory, 'stages.log'), 'utf8'),
    ).toContain('failed');
    expect(
      await readFile(join(artifactDirectory, 'diagnostics.log'), 'utf8'),
    ).not.toContain('opaque-provider-secret');
    const timingText = await readFile(
      join(artifactDirectory, 'timings.jsonl'),
      'utf8',
    );
    expect(timingText).not.toContain('opaque-provider-secret');
    const timings = z
      .array(
        z.object({
          commandId: z.string(),
          stage: z.string(),
          status: z.string(),
          elapsedMs: z.number(),
        }),
      )
      .parse(
        timingText
          .trim()
          .split('\n')
          .map((line): unknown => JSON.parse(line)),
      );
    expect(timings).toMatchObject([
      { stage: 'production application server', status: 'started' },
      { stage: 'production application server', status: 'failed' },
    ]);
    expect(timings[1]!.commandId).toBe(timings[0]!.commandId);
    expect(timings[1]!.elapsedMs).toBeGreaterThan(timings[0]!.elapsedMs);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 10_000);

it('rejects a process that exits successfully after its deadline', async () => {
  await expect(
    command(
      'deadline test',
      [
        'exec',
        'node',
        '-e',
        'process.on("SIGTERM", () => process.exit(0)); setInterval(() => {}, 1000);',
      ],
      { cwd: process.cwd(), timeoutMs: 1000 },
    ),
  ).rejects.toThrow('process failed');
}, 10_000);

it('binds child CLI authentication to the declared preview key instead of a personal login', async () => {
  const output = await command(
    'preview authentication probe',
    [
      'exec',
      'node',
      '-e',
      'process.stdout.write(process.env.CONVEX_OVERRIDE_ACCESS_TOKEN ?? "personal-login-fallback")',
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CONVEX_DEPLOY_KEY:
          'preview:test-team:test-project|synthetic-preview-key',
        CONVEX_OVERRIDE_ACCESS_TOKEN: 'synthetic-personal-token',
      },
    },
  );
  expect(output).toBe('preview:test-team:test-project|synthetic-preview-key');
});

it('sends the running test cases with every reset for the isolation canary', () => {
  const scope = { namespace: 'n', workerKey: 'worker-1', token: 't' };
  isolateCases(['existingMilitia', 'isolation']);
  try {
    expect(
      withIsolationCanary('resetCase', { ...scope, caseKey: 'isolation' }),
    ).toMatchObject({ isolatedWith: ['isolation', 'existingMilitia'] });
    expect(
      withIsolationCanary('resetAndInitialize', {
        scope: { ...scope, caseKey: 'existingMilitia' },
        draftId: 'draft',
      }),
    ).toMatchObject({ isolatedWith: ['existingMilitia', 'isolation'] });
    const inspect = { ...scope, caseKey: 'isolation' };
    expect(withIsolationCanary('inspectCase', inspect)).toBe(inspect);
    isolateCases([]);
    expect(
      withIsolationCanary('resetCase', { ...scope, caseKey: 'smoke' }),
    ).toMatchObject({ isolatedWith: ['smoke'] });
    expect(() =>
      withIsolationCanary('resetCase', { ...scope, caseKey: 'unknown' }),
    ).toThrow();
  } finally {
    isolateCases([]);
  }
});

// A command whose `convex run` is a local script: the process the command
// starts (the group leader) runs `script`, without a pnpm wrapper.
async function scriptedCommand(script: string) {
  const directory = await mkdtemp(join(tmpdir(), 'e2e-process-group-'));
  const packageDirectory = join(directory, 'node_modules', 'convex');
  await mkdir(packageDirectory, { recursive: true });
  await writeFile(
    join(packageDirectory, 'package.json'),
    JSON.stringify({ name: 'convex', bin: 'fixture.cjs' }),
  );
  await writeFile(join(packageDirectory, 'fixture.cjs'), script);
  return directory;
}
// A grandchild in the same process group that records signals in `log`,
// writes its pid to `pid` and, unless told to stop on `signal`, keeps running.
const grandchild = (signal: string) => `
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const grandchild = ${JSON.stringify(`
const fs = require('node:fs');
const [log, pid] = process.argv.slice(1);
for (const name of ['SIGINT', 'SIGTERM'])
  process.on(name, () => {
    fs.appendFileSync(log, 'grandchild ' + name + '\\n');
    if (name === '${signal}') process.exit(1);
  });
fs.writeFileSync(pid, String(process.pid));
setInterval(() => {}, 1000);
`)};
spawn(process.execPath, ['-e', grandchild, path.resolve('log'), path.resolve('pid')], { stdio: 'ignore' });
`;
function alive(pid: number) {
  try {
    process.kill(pid, 0);
  } catch {
    return false;
  }
  // An exited process its new parent has not yet reaped is gone too.
  try {
    return !/^\d+ \(.*\) Z/.test(readFileSync(`/proc/${pid}/stat`, 'utf8'));
  } catch {
    return false;
  }
}

it.skipIf(process.platform === 'win32')(
  'kills and reaps the whole process group before settling, even a grandchild that ignores SIGTERM',
  async () => {
    const directory = await scriptedCommand(
      `${grandchild('none')}
process.on('SIGTERM', () => process.exit(143));
setInterval(() => {}, 1000);`,
    );
    try {
      const pidFile = join(directory, 'pid');
      const settled = command(
        'fixture group probe',
        ['exec', 'convex', 'run', 'probe'],
        {
          cwd: directory,
          timeoutMs: 1000,
        },
      ).then(
        () => 'unexpected success',
        (error: unknown) => (error instanceof Error ? error.message : 'failed'),
      );
      await expect
        .poll(() => readFile(pidFile, 'utf8').catch(() => ''))
        .not.toBe('');
      const pid = Number(await readFile(pidFile, 'utf8'));
      expect(await settled).toContain('process failed');
      // SIGTERM reached the grandchild, and SIGKILL followed it.
      expect(await readFile(join(directory, 'log'), 'utf8')).toBe(
        'grandchild SIGTERM\n',
      );
      expect(alive(pid)).toBe(false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
  20_000,
);

it.skipIf(process.platform === 'win32')(
  'interrupts the whole process group with SIGINT before its hard timeout',
  async () => {
    const directory = await scriptedCommand(
      `${grandchild('SIGINT')}
for (const name of ['SIGINT', 'SIGTERM'])
  process.on(name, () => {
    fs.appendFileSync('log', 'child ' + name + '\\n');
    // Playwright finishes its report before it exits.
    setTimeout(() => process.exit(130), 300);
  });
setInterval(() => {}, 1000);`,
    );
    try {
      const pidFile = join(directory, 'pid');
      const started = performance.now();
      const settled = command(
        'fixture interrupt probe',
        ['exec', 'convex', 'run', 'probe'],
        { cwd: directory, interruptAfterMs: 1000, timeoutMs: 15_000 },
      ).then(
        () => 'unexpected success',
        (error: unknown) => (error instanceof Error ? error.message : 'failed'),
      );
      await expect
        .poll(() => readFile(pidFile, 'utf8').catch(() => ''))
        .not.toBe('');
      expect(await settled).toBe(
        'fixture interrupt probe: process failed (terminated)',
      );
      expect(performance.now() - started).toBeLessThan(10_000);
      const log = (await readFile(join(directory, 'log'), 'utf8'))
        .trim()
        .split('\n')
        .sort();
      expect(log).toEqual(['child SIGINT', 'grandchild SIGINT']);
      expect(alive(Number(await readFile(pidFile, 'utf8')))).toBe(false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
  20_000,
);

it.skipIf(process.platform === 'win32').each(['SIGINT', 'SIGTERM'] as const)(
  'turns its own %s into the same graceful interrupt and waits for the group',
  async (signal) => {
    const directory = await scriptedCommand(
      `${grandchild('SIGINT')}
process.on('SIGINT', () => {
  fs.appendFileSync('log', 'child SIGINT\\n');
  setTimeout(() => process.exit(130), 300);
});
setInterval(() => {}, 1000);`,
    );
    try {
      const probe = spawn(
        process.execPath,
        [
          '--import',
          'tsx',
          join(import.meta.dirname, 'testing', 'command-probe.ts'),
          directory,
        ],
        { stdio: ['ignore', 'pipe', 'inherit'] },
      );
      let stdout = '';
      probe.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
      const exited = new Promise((done) => probe.on('close', done));
      const pidFile = join(directory, 'pid');
      await expect
        .poll(() => readFile(pidFile, 'utf8').catch(() => ''), {
          timeout: 10_000,
        })
        .not.toBe('');
      const started = performance.now();
      probe.kill(signal);
      expect(await exited).toBe(0);
      expect(performance.now() - started).toBeLessThan(5000);
      expect(stdout).toBe(
        'E2E mandatory browser journeys: process failed (terminated)\n',
      );
      expect(
        (await readFile(join(directory, 'log'), 'utf8'))
          .trim()
          .split('\n')
          .sort(),
      ).toEqual(['child SIGINT', 'grandchild SIGINT']);
      expect(alive(Number(await readFile(pidFile, 'utf8')))).toBe(false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
  20_000,
);

it('never re-creates a removed evidence directory with a late stage entry', async () => {
  // A server still shutting down after the wrapper copied and deleted the
  // evidence (run 1 of #729 left a one-line stages.log behind).
  const directory = await scriptedCommand(
    `setTimeout(() => process.exit(1), 300);`,
  );
  const artifactDirectory = join(directory, 'e2e-artifacts', 'run');
  const runFile = join(directory, 'run.json');
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
    const settled = command(
      'production application server',
      ['exec', 'convex', 'run', 'probe'],
      { cwd: directory, env: { ...process.env, E2E_RUN_FILE: runFile } },
    ).catch((error: unknown) => error);
    await expect
      .poll(() =>
        readFile(join(artifactDirectory, 'stages.log'), 'utf8').catch(() => ''),
      )
      .toBe('production application server: started\n');
    await rm(join(directory, 'e2e-artifacts'), { recursive: true });
    expect(await settled).toBeInstanceOf(Error);
    await expect(
      readFile(join(artifactDirectory, 'stages.log')),
    ).rejects.toThrow('ENOENT');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it.skipIf(process.platform === 'win32')(
  'stops a descendant that keeps the output pipe open as soon as the command exits',
  async () => {
    // The grandchild inherits stdout, so the pipe stays open after the
    // command's own process exits successfully.
    const directory = await scriptedCommand(`
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const holder = spawn(process.execPath, ['-e', "require('fs').writeFileSync('pid', String(process.pid)); setInterval(() => {}, 1000);"], { stdio: ['ignore', 'inherit', 'inherit'] });
const wait = setInterval(() => {
  if (!fs.existsSync('pid')) return;
  clearInterval(wait);
  process.stdout.write('done');
  process.exit(0);
}, 20);`);
    try {
      const started = performance.now();
      const output = await command(
        'fixture pipe probe',
        ['exec', 'convex', 'run', 'probe'],
        { cwd: directory, timeoutMs: 15_000 },
      );
      expect(output).toBe('done');
      expect(performance.now() - started).toBeLessThan(5000);
      expect(
        alive(Number(await readFile(join(directory, 'pid'), 'utf8'))),
      ).toBe(false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
  20_000,
);

it('keeps only the requested tail of a failed command’s output, redacted before it is truncated', async () => {
  const secret = `0123${'ab'.repeat(30)}`;
  // The secret spans the 1000-character cut; a short fragment of it would
  // survive both value and hex matching if the cut came first.
  const directory = await scriptedCommand(`
for (let line = 1; line <= 5; line++) console.log('out ' + line);
console.log('x'.repeat(990) + ${JSON.stringify(secret)});
console.error('convex/example.ts:3:5 - error TS2322: Type mismatch.');
process.exit(1);`);
  try {
    const failure = (outputTail?: {
      lines: number;
      redactLine: (line: string) => string;
    }) =>
      command('fixture tail probe', ['exec', 'convex', 'run', 'probe'], {
        cwd: directory,
        outputTail,
      }).catch((error: unknown) => error);
    const kept = await failure({
      lines: 3,
      redactLine: (line) => line.split(secret).join('[redacted]'),
    });
    expect(kept).toBeInstanceOf(CommandFailure);
    const tail = (kept as CommandFailure).outputTail ?? [];
    expect(tail).toHaveLength(3);
    expect(tail).toContain(
      'convex/example.ts:3:5 - error TS2322: Type mismatch.',
    );
    expect(tail.join('\n')).not.toContain(secret.slice(0, 10));
    expect(tail).toContain(`${'x'.repeat(990)}[redacted]`);
    expect((kept as CommandFailure).message).toBe(
      'fixture tail probe: process failed (1)',
    );
    expect(((await failure()) as CommandFailure).outputTail).toBeUndefined();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('carries the fixed diagnostic categories of a failed command, never its output', async () => {
  const directory = await scriptedCommand(`
console.error('Error: [CONVEX M(e2eFixtures:resetCase)] [Request ID: 5f1c] Server Error');
console.error('Uncaught Error: E2E isolation canary: 1 foreign member and 0 outsider campaigns in worker-0');
process.exit(1);`);
  try {
    const failure = await command(
      'fixture canary probe',
      ['exec', 'convex', 'run', 'probe'],
      { cwd: directory },
    ).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(CommandFailure);
    expect((failure as CommandFailure).diagnostics).toEqual([
      'application or service reported an error',
      'E2E cohort isolation check failed',
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
