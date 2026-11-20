// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';
import {
  resources,
  deploymentFixture,
  threeCohortResources,
} from './test-data';
import { requiredTests, selectSuite, suites, type Suite } from './matrix';

// Lists what the real configuration selects, with the real journey files.
async function listSelected(suite: Suite) {
  const directory = await mkdtemp(join(tmpdir(), 'e2e-config-test-'));
  try {
    const path = join(directory, 'run.json');
    await writeFile(
      path,
      JSON.stringify({
        suite,
        resources,
        fixture: deploymentFixture,
        workspace: process.cwd(),
        sourceRoot: process.cwd(),
        privateDirectory: directory,
        artifactDirectory: join(directory, 'artifacts'),
        envFile: join(directory, 'convex.env'),
        baseURL: 'http://127.0.0.1:49123',
        // The runner's clock (deadline.ts).
        deadline: Date.now() + 600_000,
        browserStopAt: Date.now() + 540_000,
      }),
    );
    return spawnSync(
      'pnpm',
      ['exec', 'playwright', 'test', '--list', '--reporter=list'],
      {
        encoding: 'utf8',
        env: { ...process.env, E2E_RUN_FILE: path },
        timeout: 15_000,
      },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

// `[project] › file:line:column › title` for each listed test.
const listed = (stdout: string) =>
  stdout
    .split('\n')
    .flatMap((line) => {
      const match = /\[([^\]]+)\] › ([^:]+):\d+:\d+ › (.+)$/.exec(line.trim());
      return match ? [[match[2]!, match[1]!, match[3]!]] : [];
    })
    .sort();

it.each([
  ['mandatory', suites.mandatory],
  [
    'mandatory with focused groups and live',
    selectSuite({
      suites: ['mandatory', 'focused', 'live'],
      groups: ['week-upkeep', 'sheet'],
    })!,
  ],
  ['nightly', suites.nightly],
  [
    'a journey',
    selectSuite({ journeys: ['players share a Staged Action Choice'] })!,
  ],
] as const)(
  'discovers exactly the %s selection without credentials',
  async (_name, suite) => {
    const result = await listSelected(suite);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(listed(result.stdout)).toEqual(
      requiredTests(suite)
        .map(([file, project, title]) => [file, project, title])
        .sort(),
    );
    expect(result.stdout).toContain(
      `Total: ${requiredTests(suite).length} tests`,
    );
  },
  20_000,
);

it('discovers the release suite: authentication and its one journey, no routine journey', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'e2e-config-release-'));
  try {
    const path = join(directory, 'run.json');
    await writeFile(
      path,
      JSON.stringify({
        suite: suites.release,
        resources,
        fixture: deploymentFixture,
        workspace: process.cwd(),
        sourceRoot: process.cwd(),
        privateDirectory: directory,
        artifactDirectory: join(directory, 'artifacts'),
        envFile: join(directory, 'convex.env'),
        baseURL: 'http://127.0.0.1:49123',
        deadline: Date.now() + 600_000,
        browserStopAt: Date.now() + 540_000,
      }),
    );
    const result = spawnSync(
      'pnpm',
      ['exec', 'playwright', 'test', '--list', '--reporter=list'],
      {
        encoding: 'utf8',
        env: { ...process.env, E2E_RUN_FILE: path },
        timeout: 15_000,
      },
    );
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain('[authentication]');
    expect(result.stdout).toContain('[release-qualification]');
    expect(result.stdout).toContain('catalog-release.spec.ts');
    expect(result.stdout).not.toContain('private-character.spec.ts');
    expect(result.stdout).not.toContain('character-navigation.spec.ts');
    expect(result.stdout).not.toContain('[chromium-tablet]');
    expect(result.stdout).toContain('Total: 2 tests');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 20_000);

it.each([
  ['accepts', threeCohortResources, 3, 0],
  ['refuses', resources, 2, 1],
] as const)(
  '%s one Playwright worker per declared cohort',
  async (_label, declared, workers, status) => {
    const directory = await mkdtemp(join(tmpdir(), 'e2e-config-cohorts-'));
    try {
      const path = join(directory, 'run.json');
      await writeFile(
        path,
        JSON.stringify({
          suite: suites.nightly,
          workers,
          resources: declared,
          fixture: {
            ...deploymentFixture,
            workers: declared.workers.map((worker) => ({
              ...worker,
              capability: deploymentFixture.workers[0]!.capability,
            })),
          },
          workspace: process.cwd(),
          sourceRoot: process.cwd(),
          privateDirectory: directory,
          artifactDirectory: join(directory, 'artifacts'),
          envFile: join(directory, 'convex.env'),
          baseURL: 'http://127.0.0.1:49123',
          // The runner's clock (deadline.ts).
          deadline: Date.now() + 600_000,
          browserStopAt: Date.now() + 540_000,
        }),
      );
      const result = spawnSync(
        'pnpm',
        ['exec', 'playwright', 'test', '--list', '--reporter=list'],
        {
          encoding: 'utf8',
          env: { ...process.env, E2E_RUN_FILE: path },
          timeout: 15_000,
        },
      );
      expect(result.status, result.stdout + result.stderr).toBe(status);
      if (status === 0)
        expect(result.stdout).toContain(
          `Total: ${requiredTests(suites.nightly).length} tests`,
        );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
  20_000,
);

it('refuses a run file without the runner clock, so Playwright never sets its own', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'e2e-config-clock-'));
  try {
    const path = join(directory, 'run.json');
    await writeFile(
      path,
      JSON.stringify({
        resources,
        fixture: deploymentFixture,
        workspace: process.cwd(),
        sourceRoot: process.cwd(),
        privateDirectory: directory,
        artifactDirectory: join(directory, 'artifacts'),
        envFile: join(directory, 'convex.env'),
        baseURL: 'http://127.0.0.1:49123',
      }),
    );
    const result = spawnSync(
      'pnpm',
      ['exec', 'playwright', 'test', '--list', '--reporter=list'],
      {
        encoding: 'utf8',
        env: { ...process.env, E2E_RUN_FILE: path },
        timeout: 15_000,
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain(
      'Run E2E through pnpm test:e2e with an explicit resource declaration',
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
