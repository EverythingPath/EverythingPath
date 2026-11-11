// @vitest-environment node
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';
import { deploymentFixture, resources } from './test-data';
import { finalizeProgress } from './progress';
import { evaluateResults } from './results';
import { browserProjects, requiredTests, suites, type Suite } from './matrix';

// The mandatory suite's projects as Playwright config source: the real
// names, files and title patterns, without browser options (the stub
// journeys open no page).
function projectSource(suite: Suite) {
  return browserProjects(suite)
    .map(({ name, testMatch, dependencies, retries, grep }) => {
      const patterns = grep
        ? `,grep:[${[grep]
            .flat()
            .map((pattern) => `new RegExp(${JSON.stringify(pattern.source)})`)
            .join(',')}]`
        : '';
      return `{...${JSON.stringify({ name, testMatch, dependencies, retries })}${patterns}}`;
    })
    .join(',');
}

// Exercise the actual reporter/Playwright protocol without browser or service
// dependencies. These synthetic bodies test result handling, not authentication.
// `retry-*` fails that journey's first attempt; `missing-*` leaves it out.
const target = {
  access: 'access.spec.ts',
  membership: 'membership-loss.spec.ts',
  workspace: 'canonical-workspace.spec.ts',
} as const;
it.each([
  'passed',
  'skipped',
  'focused',
  'quarantined',
  'retry-access',
  'missing-membership',
  'retry-membership',
  'missing-workspace',
  'retry-workspace',
] as const)(
  'the reporter and Playwright agree on a %s mandatory journey',
  async (mode) => {
    const directory = await mkdtemp(join(tmpdir(), 'e2e-reporter-test-'));
    const runFile = join(directory, 'run.json');
    const artifactDirectory = join(directory, 'artifacts');
    const playwright = JSON.stringify(
      resolve('node_modules/@playwright/test/index.mjs'),
    );
    const [kind, name] = mode.split('-') as [string, keyof typeof target];
    try {
      await writeFile(
        runFile,
        JSON.stringify({
          resources,
          fixture: deploymentFixture,
          workspace: directory,
          sourceRoot: process.cwd(),
          privateDirectory: directory,
          artifactDirectory,
          envFile: join(directory, 'convex.env'),
          baseURL: 'http://localhost:49123',
        }),
      );
      await writeFile(
        join(directory, 'auth.setup.ts'),
        `import { test } from ${playwright}; test('prepare fresh role sessions', () => {});`,
      );
      // Every file of the suite with all its tests, other suites' Workspace
      // journeys included, so the project patterns must select.
      const files = new Map<string, string[]>();
      for (const [file, , title] of requiredTests(suites.nightly))
        if (file !== 'auth.setup.ts')
          files.set(file, [...new Set([...(files.get(file) ?? []), title])]);
      for (const [file, titles] of files) {
        if (kind === 'missing' && file === target[name]) continue;
        const isTarget = (title: string) =>
          file === target[name] &&
          title ===
            requiredTests(suites.mandatory).find(([f]) => f === file)?.[2];
        const body = (title: string) =>
          kind === 'retry' && isTarget(title)
            ? "if (info.retry === 0) throw new Error('Synthetic first attempt failure');"
            : '';
        const modifier = (title: string) =>
          file === target.access && isAccess(title)
            ? mode === 'skipped'
              ? '.skip'
              : mode === 'focused'
                ? '.only'
                : ''
            : '';
        const options = (title: string) =>
          mode === 'quarantined' && isAccess(title)
            ? `{ tag: '@quarantined' },`
            : '';
        await writeFile(
          join(directory, file),
          `import { test } from ${playwright}; test.describe.configure({ mode: 'parallel' }); ${titles
            .map(
              (title) =>
                `test${modifier(title)}(${JSON.stringify(title)}, ${options(title)} async ({}, info) => { ${body(title)} });`,
            )
            .join(' ')}`,
        );
      }
      const config = join(directory, 'playwright.config.ts');
      await writeFile(
        config,
        `export default {
        testDir: ${JSON.stringify(directory)}, workers: 1, forbidOnly: true,
        retries: 1, reporter: [[${JSON.stringify(resolve('e2e/support/reporter.ts'))}]],
        projects: [${projectSource(suites.mandatory)}],
      };`,
      );
      const result = spawnSync(
        'pnpm',
        ['exec', 'playwright', 'test', '--config', config],
        {
          env: { ...process.env, E2E_RUN_FILE: runFile },
          encoding: 'utf8',
          timeout: 15_000,
        },
      );
      const report: unknown = JSON.parse(
        await readFile(join(artifactDirectory, 'report.json'), 'utf8'),
      );
      expect(result.status, result.stdout + result.stderr).toBe(
        mode === 'passed' ? 0 : 1,
      );
      expect(evaluateResults(report)).toBe(mode === 'passed');
      if (mode === 'passed') {
        // Playwright ran only the mandatory suite's journeys (the result
        // check above names each), and the report names the scope it was
        // evaluated against.
        expect(report).toMatchObject({
          suite: suites.mandatory,
          tests: { length: requiredTests(suites.mandatory).length },
        });
        // Every attempt records the cohort that ran it; authentication prepares all.
        expect(report).toMatchObject({
          evidence: expect.arrayContaining([
            expect.objectContaining({
              project: 'authentication',
              workerKey: null,
            }),
            expect.objectContaining({
              project: 'mandatory',
              workerKey: 'worker-0',
            }),
          ]),
        });
      }
      expect(
        await readFile(join(artifactDirectory, 'report.html'), 'utf8'),
      ).toContain(`E2E ${mode === 'passed' ? 'passed' : 'failed'}`);
      if (kind === 'retry')
        expect(report).toMatchObject({
          tests: expect.arrayContaining([
            expect.objectContaining({
              file: target[name],
              results: [
                { status: 'failed', retry: 0 },
                { status: 'passed', retry: 1 },
              ],
            }),
          ]),
        });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
  20_000,
);

const isAccess = (title: string) =>
  title === requiredTests(suites.mandatory)[1]![2];

it('keeps safe completed-attempt evidence when the runner is killed before onEnd', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'e2e-interrupted-reporter-'));
  const artifactDirectory = join(directory, 'artifacts');
  const runFile = join(directory, 'run.json');
  try {
    await writeFile(
      runFile,
      JSON.stringify({
        resources,
        workspace: directory,
        sourceRoot: process.cwd(),
        privateDirectory: directory,
        artifactDirectory,
        envFile: join(directory, 'convex.env'),
        baseURL: 'http://localhost:49123',
      }),
    );
    const playwright = JSON.stringify(
      resolve('node_modules/@playwright/test/index.mjs'),
    );
    await writeFile(
      join(directory, 'interrupted.spec.ts'),
      `import {test} from ${playwright}; test('completed service timeout',async()=>{test.setTimeout(50);await new Promise(()=>{});}); test('later work',async()=>{await new Promise(()=>{});});`,
    );
    const config = join(directory, 'playwright.config.ts');
    await writeFile(
      config,
      `export default {testDir:${JSON.stringify(directory)},workers:1,retries:0,reporter:[[${JSON.stringify(resolve('e2e/support/reporter.ts'))}]],projects:[{name:'canonical-persistence',testMatch:'interrupted.spec.ts'}]};`,
    );
    await new Promise<void>((resolveDone, reject) => {
      const child = spawn(
        process.execPath,
        [
          resolve('node_modules/@playwright/test/cli.js'),
          'test',
          '--config',
          config,
        ],
        {
          env: { ...process.env, E2E_RUN_FILE: runFile },
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: process.platform !== 'win32',
        },
      );
      let observed = false;
      let output = '';
      const kill = () => {
        if (child.pid && process.platform !== 'win32')
          process.kill(-child.pid, 'SIGKILL');
        else child.kill('SIGKILL');
      };
      const deadline = setTimeout(kill, 8000);
      child.stdout.on('data', (chunk: Buffer) => {
        output += chunk.toString();
        if (
          !observed &&
          output.includes(
            'timedOut: canonical-persistence: completed service timeout',
          )
        ) {
          observed = true;
          kill();
        }
      });
      child.on('error', reject);
      child.on('close', () => {
        clearTimeout(deadline);
        if (observed) resolveDone();
        else reject(new Error('Completed timeout was not reported'));
      });
    });
    const checkpoint = JSON.parse(
      await readFile(join(artifactDirectory, 'progress.json'), 'utf8'),
    ) as unknown;
    expect(checkpoint).toMatchObject({
      status: 'running',
      evidence: [
        {
          project: 'canonical-persistence',
          status: 'timedOut',
          retry: 0,
          errors: [expect.stringContaining('50ms')],
        },
      ],
    });
    expect(evaluateResults(checkpoint, suites.mandatory)).toBe(false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 10000);

it('records sanitized per-step timings, including the step a timeout interrupts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'e2e-step-reporter-'));
  const artifactDirectory = join(directory, 'artifacts');
  const runFile = join(directory, 'run.json');
  try {
    await writeFile(
      runFile,
      JSON.stringify({
        resources,
        // A reused preparation's evidence says so (#754).
        preparation: 'reused',
        workspace: directory,
        sourceRoot: process.cwd(),
        privateDirectory: directory,
        artifactDirectory,
        envFile: join(directory, 'convex.env'),
        baseURL: 'http://localhost:49123',
      }),
    );
    const playwright = JSON.stringify(
      resolve('node_modules/@playwright/test/index.mjs'),
    );
    // A passing step with a nested step and an assertion, a step whose title
    // carries a secret, and a step still running when the test times out.
    await writeFile(
      join(directory, 'steps.spec.ts'),
      `import { test, expect } from ${playwright};
      test('timed journey', async () => {
        test.setTimeout(1500);
        await test.step('members open the week', async () => {
          await test.step('the player opens the list', async () => {
            await new Promise((done) => setTimeout(done, 120));
          });
          expect(1).toBe(1);
        });
        await test.step('reads token=sk_test_secretvalue', async () => {});
        await test.step('the player follows / legacy links', () => new Promise(() => {}));
      });`,
    );
    const config = join(directory, 'playwright.config.ts');
    await writeFile(
      config,
      `export default {testDir:${JSON.stringify(directory)},workers:1,retries:0,reporter:[[${JSON.stringify(resolve('e2e/support/reporter.ts'))}]],projects:[{name:'chromium-tablet',testMatch:'steps.spec.ts'}]};`,
    );
    const result = spawnSync(
      'pnpm',
      ['exec', 'playwright', 'test', '--config', config],
      {
        env: { ...process.env, E2E_RUN_FILE: runFile },
        encoding: 'utf8',
        timeout: 15_000,
      },
    );
    expect(result.status, result.stdout + result.stderr).toBe(1);
    for (const file of ['progress.json', 'report.json']) {
      const text = await readFile(join(artifactDirectory, file), 'utf8');
      expect(JSON.parse(text), file).toMatchObject({ preparation: 'reused' });
      const { evidence } = JSON.parse(text) as {
        evidence: {
          status: string;
          steps: {
            step: string;
            start: number;
            duration: number | null;
            status: string;
          }[];
        }[];
      };
      expect(evidence).toHaveLength(1);
      expect(evidence[0]!.status).toBe('timedOut');
      const steps = evidence[0]!.steps;
      // Only the journey's own steps, never its assertion or fixtures.
      expect(steps.map(({ step, status }) => [step, status])).toEqual([
        ['members open the week', 'passed'],
        ['members open the week > the player opens the list', 'passed'],
        ['reads tokenredacted', 'passed'],
        ['the player follows  legacy links', 'interrupted'],
      ]);
      const [week, list, , interrupted] = steps;
      expect(list!.duration).toBeGreaterThanOrEqual(100);
      expect(week!.duration).toBeGreaterThanOrEqual(list!.duration!);
      expect(list!.start).toBeGreaterThanOrEqual(week!.start);
      // The interrupted step never finished; its start shows it ran from
      // after the first step until the 1.5 s timeout.
      expect(interrupted!.duration).toBeNull();
      expect(interrupted!.start).toBeGreaterThanOrEqual(
        week!.start + week!.duration!,
      );
      expect(interrupted!.start).toBeLessThan(1500);
      expect(text).not.toContain('secretvalue');
      expect(text).not.toContain('sk_test');
      // No locations, errors or parameters: exactly these four fields.
      for (const step of steps)
        expect(Object.keys(step).sort()).toEqual([
          'duration',
          'start',
          'status',
          'step',
        ]);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 20_000);

// One finished, one running and one unstarted test in a single worker,
// returned once `awaitedStarts` attempts have begun. If that never happens,
// Playwright is killed and awaited and the scratch directory removed before
// the failure is rethrown.
async function threeTestRun({
  awaitedStarts = 2,
  startTimeoutMs = 10_000,
  hasBrokenConfig = false,
}: {
  awaitedStarts?: number;
  startTimeoutMs?: number;
  hasBrokenConfig?: boolean;
} = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'e2e-incomplete-run-'));
  const artifactDirectory = join(directory, 'artifacts');
  let child: ReturnType<typeof spawn> | undefined;
  let exited: Promise<unknown> = Promise.resolve();
  const signal = (signal: NodeJS.Signals) => {
    try {
      if (child?.pid && process.platform !== 'win32')
        process.kill(-child.pid, signal);
      else child?.kill(signal);
    } catch {
      /* Playwright's group has already exited. */
    }
    return exited;
  };
  let isReady = false;
  try {
    const runFile = join(directory, 'run.json');
    await writeFile(
      runFile,
      JSON.stringify({
        resources,
        workspace: directory,
        sourceRoot: process.cwd(),
        privateDirectory: directory,
        artifactDirectory,
        envFile: join(directory, 'convex.env'),
        baseURL: 'http://localhost:49123',
      }),
    );
    const playwright = JSON.stringify(
      resolve('node_modules/@playwright/test/index.mjs'),
    );
    await writeFile(
      join(directory, 'incomplete.spec.ts'),
      `import {test} from ${playwright};
    test('first journey finishes', () => {});
    test('second journey is cut off', async () => { test.setTimeout(0); await new Promise(() => {}); });
    test('third journey never starts', () => {});`,
    );
    const config = join(directory, 'playwright.config.ts');
    await writeFile(
      config,
      hasBrokenConfig
        ? `throw new Error('config does not load');`
        : `export default {testDir:${JSON.stringify(directory)},workers:1,retries:0,reporter:[[${JSON.stringify(resolve('e2e/support/reporter.ts'))}]],projects:[{name:'chromium-tablet',testMatch:'incomplete.spec.ts'}]};`,
    );
    const spawned = spawn(
      process.execPath,
      [
        resolve('node_modules/@playwright/test/cli.js'),
        'test',
        '--config',
        config,
      ],
      {
        env: { ...process.env, E2E_RUN_FILE: runFile },
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: process.platform !== 'win32',
      },
    );
    child = spawned;
    exited = new Promise((done) => spawned.on('close', done));
    const progress = async () =>
      JSON.parse(
        await readFile(join(artifactDirectory, 'progress.json'), 'utf8').catch(
          () => '{}',
        ),
      ) as { started?: unknown[] };
    await expect
      .poll(async () => (await progress()).started?.length ?? 0, {
        timeout: startTimeoutMs,
      })
      .toBe(awaitedStarts);
    isReady = true;
  } finally {
    // The original failure propagates; the run and its scratch never stay.
    if (!isReady)
      try {
        await signal('SIGKILL');
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
  }
  return { directory, artifactDirectory, signal };
}

it('cleans up its own Playwright run and scratch files when it never reaches the awaited start', async () => {
  const scratch = async () =>
    (await readdir(tmpdir())).filter((name) =>
      name.startsWith('e2e-incomplete-run-'),
    );
  const before = await scratch();
  // Only three tests exist, so a fourth start never comes.
  await expect(
    threeTestRun({ awaitedStarts: 4, startTimeoutMs: 1500 }),
  ).rejects.toThrow();
  expect(await scratch()).toEqual(before);
}, 20_000);

it('keeps the original failure and cleans up when Playwright exits before any test', async () => {
  const scratch = async () =>
    (await readdir(tmpdir())).filter((name) =>
      name.startsWith('e2e-incomplete-run-'),
    );
  const before = await scratch();
  // A config that fails to load: Playwright and its group are gone at once.
  await expect(
    threeTestRun({ hasBrokenConfig: true, startTimeoutMs: 3000 }),
  ).rejects.toThrow('expected +0 to be 2');
  expect(await scratch()).toEqual(before);
}, 20_000);
const incompleteLists = {
  completed: [
    {
      project: 'chromium-tablet',
      title: 'first journey finishes',
      status: 'passed',
    },
  ],
  interrupted: [
    { project: 'chromium-tablet', title: 'second journey is cut off' },
  ],
  unstarted: [
    { project: 'chromium-tablet', title: 'third journey never starts' },
  ],
};

it('saves the planned tests and each start, so a killed run still ends with a final status', async () => {
  const { directory, artifactDirectory, signal } = await threeTestRun();
  try {
    // Killed outright: Playwright's own report is never written.
    await signal('SIGKILL');
    const checkpoint = join(artifactDirectory, 'progress.json');
    expect(JSON.parse(await readFile(checkpoint, 'utf8'))).toMatchObject({
      status: 'running',
    });
    await expect(
      readFile(join(artifactDirectory, 'report.json'), 'utf8'),
    ).rejects.toThrow();
    await finalizeProgress(artifactDirectory);
    const final = JSON.parse(await readFile(checkpoint, 'utf8')) as unknown;
    expect(final).toMatchObject({ status: 'interrupted', ...incompleteLists });
    expect(evaluateResults(final, suites.mandatory)).toBe(false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 20_000);

it('lists completed, interrupted and unstarted tests when SIGINT stops the run', async () => {
  const { directory, artifactDirectory, signal } = await threeTestRun();
  try {
    await signal('SIGINT');
    const checkpoint = join(artifactDirectory, 'progress.json');
    expect(JSON.parse(await readFile(checkpoint, 'utf8'))).toMatchObject({
      status: 'interrupted',
      ...incompleteLists,
    });
    // The runner leaves a final status as it is.
    await finalizeProgress(artifactDirectory);
    expect(JSON.parse(await readFile(checkpoint, 'utf8'))).toMatchObject({
      status: 'interrupted',
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 20_000);

it('records an interrupted run that never planned a test', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'e2e-unplanned-run-'));
  try {
    await finalizeProgress(directory);
    expect(
      JSON.parse(await readFile(join(directory, 'progress.json'), 'utf8')),
    ).toEqual({
      status: 'interrupted',
      errors: 0,
      planned: [],
      started: [],
      evidence: [],
      completed: [],
      interrupted: [],
      unstarted: [],
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
