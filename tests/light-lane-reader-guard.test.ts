// @vitest-environment node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, test } from 'vitest';
import {
  isLaneEligible,
  lightLaneReaderGuardPlugin,
} from './light-lane-reader-guard';

// The light landing lane's runtime reader guard. Reads happen in a child
// process with the guard installed, so this file itself reads no lane-eligible
// file (the guard in this suite's setup would fail it).
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const guard = pathToFileURL(
  path.join(root, 'tests/light-lane-reader-guard.ts'),
).href;

function guarded(body: string) {
  const script = `
    const { installReaderGuard, readerGuardViolations } = await import(${JSON.stringify(guard)});
    installReaderGuard(${JSON.stringify(root)});
    const fs = await import('node:fs');
    const report = (value) => console.log(JSON.stringify(value));
    ${body}
  `;
  return spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      '--disable-warning=ExperimentalWarning',
      '--input-type=module',
      '-e',
      script,
    ],
    { cwd: root, encoding: 'utf8' },
  );
}

function expectRefused(body: string, file: string) {
  const result = guarded(body);
  expect(result.status, result.stdout + result.stderr).not.toBe(0);
  expect(result.stderr).toContain(
    `light lane reader guard: a test read ${file}`,
  );
}

describe('the light lane reader guard', () => {
  const agents = 'AGENTS.md';
  const runbook = 'docs/agents/orchestration/runbook.md';

  test('refuses a path built at run time, the review r1 construction', () => {
    expectRefused(
      `fs.readFileSync(['AGENTS', 'md'].join('.'), 'utf8');`,
      agents,
    );
  });

  test('refuses fs/promises, streams, opens and copies of lane-eligible files', () => {
    const file = JSON.stringify(runbook);
    expectRefused(
      `await (await import('node:fs/promises')).readFile(${file});`,
      runbook,
    );
    expectRefused(
      `await new Promise((done, fail) => fs.readFile(${file}, (error) => (error ? fail(error) : done())));`,
      runbook,
    );
    expectRefused(`fs.createReadStream(${file});`, runbook);
    expectRefused(`fs.closeSync(fs.openSync(${file}, 'r'));`, runbook);
    expectRefused(
      `await (await (await import('node:fs/promises')).open(${file})).close();`,
      runbook,
    );
    expectRefused(
      `fs.copyFileSync(${file}, ${JSON.stringify(path.join(root, 'node_modules/.light-lane-guard-copy'))});`,
      runbook,
    );
  });

  test('refuses the named ESM export, absolute and URL paths, and the symlinked skills path', () => {
    expectRefused(
      `const { readFileSync } = await import('node:fs'); readFileSync(${JSON.stringify(agents)});`,
      agents,
    );
    expectRefused(
      `fs.readFileSync(${JSON.stringify(path.join(root, agents))});`,
      agents,
    );
    expectRefused(
      `fs.readFileSync(new URL(${JSON.stringify(pathToFileURL(path.join(root, agents)).href)}));`,
      agents,
    );
    expectRefused(
      `fs.readFileSync(${JSON.stringify('.claude/skills/code-review/SKILL.md')});`,
      '.agents/skills/code-review/SKILL.md',
    );
  });

  test('records a read the test caught, so the setup still fails the test', () => {
    const result = guarded(
      `try { fs.readFileSync(${JSON.stringify(agents)}); } catch {} report(readerGuardViolations());`,
    );
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([agents]);
  });

  test('leaves other files, outside paths and descriptors alone', () => {
    const result = guarded(`
      fs.readFileSync('package.json');
      fs.readFileSync('README.md');
      fs.readFileSync(${JSON.stringify('docs/catalog-import/README.md')});
      fs.closeSync(fs.openSync('vitest.config.ts', 'r'));
      report(readerGuardViolations());
    `);
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([]);
  });

  test('refuses Vite module loads, including ?raw imports', () => {
    const plugin = lightLaneReaderGuardPlugin(root);
    const load = plugin.load as (this: unknown, id: string) => unknown;
    const context = {
      error(message: string): never {
        throw new Error(message);
      },
    };
    expect(() => load.call(context, path.join(root, agents) + '?raw')).toThrow(
      `light lane reader guard: a test read ${agents}`,
    );
    expect(() => load.call(context, path.join(root, runbook))).toThrow(
      `light lane reader guard: a test read ${runbook}`,
    );
    expect(load.call(context, path.join(root, 'src/main.ts'))).toBeNull();
    expect(load.call(context, '\0virtual:module')).toBeNull();
    expect(plugin.enforce).toBe('pre');
  });

  test('matches the rule allowlist', () => {
    for (const eligible of [
      agents,
      'CLAUDE.md',
      'docs/standards.md',
      '.claude/settings.json',
      '.gitignore',
      runbook,
      'docs/product/a/b.md',
      '.agents/skills/x/y.md',
      '.claude/agents/coder.md',
    ]) {
      expect(isLaneEligible(eligible), eligible).toBe(true);
    }
    for (const other of [
      'README.md',
      'docs/ai/x.md',
      'docs/agents/x.txt',
      '.claude/agents/sub/x.md',
      '.claude/settings.local.json',
      '.agents/skills/x/run.sh',
      'src/a.ts',
    ]) {
      expect(isLaneEligible(other), other).toBe(false);
    }
  });
});
