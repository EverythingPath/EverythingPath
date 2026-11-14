// @vitest-environment node
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// pnpm -s lint:paths (scripts/lint-paths.ts) in a small repository with its
// own ESLint configuration, typed program and suppressions, and the real
// lint:eslint:app, lint:eslint:tests and lint:eslint:convex scripts, so each
// leg runs with the flags the full lint uses.
const repo = resolve(__dirname, '..');
const script = join(repo, 'scripts', 'lint-paths.ts');
const compilerOptions = {
  strict: true,
  target: 'es2022',
  module: 'esnext',
  moduleResolution: 'bundler',
  noEmit: true,
};
const floating = (from: string) =>
  `import { load } from '${from}';\nexport function run() {\n  load();\n}\n`;
const files: Record<string, string> = {
  'eslint.config.mjs': `import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
export default defineConfig([
  globalIgnores(['ignored/**']),
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.base],
    languageOptions: { parserOptions: { projectService: true } },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      // Every file ESLint lints reports this warning, so the files in a
      // leg's output are the files that leg linted.
      'no-restricted-syntax': ['warn', { selector: 'Program', message: 'linted' }],
    },
  },
]);
`,
  'tsconfig.json': JSON.stringify({
    compilerOptions,
    include: ['**/*.ts'],
    exclude: ['convex', 'node_modules'],
  }),
  'convex/tsconfig.json': JSON.stringify({
    compilerOptions,
    include: ['**/*.ts'],
  }),
  'eslint-suppressions.json': JSON.stringify({
    'src/suppressed.ts': {
      '@typescript-eslint/no-floating-promises': { count: 1 },
    },
    'src/fixed.ts': { '@typescript-eslint/no-floating-promises': { count: 1 } },
  }),
  'src/load.ts': 'export async function load() {\n  return 1;\n}\n',
  // A typed finding across files: the promise's type comes from load.ts.
  'src/use.ts': floating('./load'),
  'src/suppressed.ts': floating('./load'),
  // Its suppression no longer occurs: only a lint of this file reports it.
  'src/fixed.ts': 'export const fixed = 1;\n',
  'src/clean.ts': 'export const clean = 1;\n',
  'src/old.ts': 'export const old = 1;\n',
  'src/moved.ts': 'export const moved = 1;\n',
  'convex/helpers.ts': 'export async function load() {\n  return 2;\n}\n',
  'convex/bad.ts': floating('./helpers'),
  'convex/fn.ts': 'export const fn = 1;\n',
  // In the root program, so a typed finding across files, but the tests leg's.
  'tests/bad.ts': floating('../src/load'),
  'tests/clean.ts': 'export const clean = 1;\n',
  'ignored/skip.ts': floating('../src/load'),
  'README.md': '# fixture\n',
};

let root: string;
let scripts: Record<string, string>;
beforeAll(async () => {
  ({ scripts } = JSON.parse(
    await readFile(join(repo, 'package.json'), 'utf8'),
  ) as { scripts: Record<string, string> });
  // ESLint names files by the real path of its working directory.
  root = await realpath(await mkdtemp(join(tmpdir(), 'lint-paths-')));
  await symlink(join(repo, 'node_modules'), join(root, 'node_modules'));
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({
      type: 'module',
      scripts: {
        'lint:eslint:app': scripts['lint:eslint:app'],
        'lint:eslint:tests': scripts['lint:eslint:tests'],
        'lint:eslint:convex': scripts['lint:eslint:convex'],
      },
    }),
  );
  for (const [file, text] of Object.entries(files)) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), text);
  }
  git('init', '-q', '-b', 'main');
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
});
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

function git(...args: string[]) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.invalid',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.invalid',
    },
  });
}

function lintPaths(...args: string[]) {
  const { status, stdout, stderr } = spawnSync(
    process.execPath,
    ['--import', 'tsx', script, ...args],
    { cwd: root, encoding: 'utf8' },
  );
  return { status, output: stdout + stderr };
}

// The command a leg runs: its full lint's script with the target replaced by
// the files.
function leg(
  name: 'app' | 'tests' | 'convex',
  target: string,
  named: string[],
) {
  return `$ ${(scripts[`lint:eslint:${name}`] ?? '').replace(` ${target} `, ` ${named.join(' ')} `)}`;
}

// The files each leg's ESLint reported, repository-relative and sorted, read
// from the output after that leg's heading: every linted file reports the
// fixture configuration's `linted` warning.
function linted(output: string) {
  const [, ...parts] = output.split(
    /^lint:paths: the (app|tests|Convex) leg lints .*$/m,
  );
  const legs: Record<string, string[]> = {};
  for (let i = 0; i + 1 < parts.length; i += 2)
    legs[parts[i] ?? ''] = (parts[i + 1] ?? '')
      .split('\n')
      .filter((line) => line.startsWith(`${root}/`))
      .map((line) => line.slice(root.length + 1))
      .sort();
  return legs;
}

describe('lint:paths', () => {
  it('reports a typed finding that depends on another file', () => {
    const { status, output } = lintPaths('src/use.ts');

    expect(status).toBe(1);
    expect(output).toContain(leg('app', '.', ['src/use.ts']));
    expect(output).toMatch(
      /src\/use\.ts\n(?:.*\n)*?.*@typescript-eslint\/no-floating-promises/,
    );
    expect(output).not.toContain('Convex leg');
  }, 60_000);

  it('honours a suppression in a file it lints, and leaves an unlisted file’s suppression alone', async () => {
    const before = await readFile(
      join(root, 'eslint-suppressions.json'),
      'utf8',
    );

    const run = lintPaths('src/suppressed.ts', 'src/clean.ts');
    expect(run.status).toBe(0);
    // It linted src/suppressed.ts, so the suppression is what passed it; and
    // not src/fixed.ts, whose unused suppression stays in place.
    expect(linted(run.output)).toEqual({
      app: ['src/clean.ts', 'src/suppressed.ts'],
    });
    expect(await readFile(join(root, 'eslint-suppressions.json'), 'utf8')).toBe(
      before,
    );
    // Without its suppression the same file fails.
    await writeFile(
      join(root, 'eslint-suppressions.json'),
      JSON.stringify({
        'src/fixed.ts': JSON.parse(before)['src/fixed.ts'],
      }),
    );
    try {
      const bare = lintPaths('src/suppressed.ts', 'src/clean.ts');
      expect(bare.status).toBe(1);
      expect(bare.output).toMatch(
        /src\/suppressed\.ts\n(?:.*\n)*?.*no-floating-promises/,
      );
    } finally {
      await writeFile(join(root, 'eslint-suppressions.json'), before);
    }
    // The full lint fails on src/fixed.ts's unused suppression, and so does a
    // lint that names it.
    expect(lintPaths('src/fixed.ts')).toMatchObject({
      status: 2,
      output: expect.stringContaining(
        'suppressions left that do not occur anymore',
      ),
    });
  }, 60_000);

  it('runs convex/ in the Convex leg, and fails when either leg fails', () => {
    const convex = lintPaths('convex/bad.ts', 'src/clean.ts');
    expect(convex.status).toBe(1);
    expect(convex.output).toContain(leg('app', '.', ['src/clean.ts']));
    expect(convex.output).toContain(leg('convex', 'convex', ['convex/bad.ts']));
    expect(convex.output).toMatch(
      /convex\/bad\.ts\n(?:.*\n)*?.*no-floating-promises/,
    );
    expect(convex.output).toContain('the Convex leg failed');

    const app = lintPaths('src/use.ts', 'convex/fn.ts');
    expect(app.status).toBe(1);
    expect(app.output).toContain(leg('convex', 'convex', ['convex/fn.ts']));
    expect(app.output).toContain('the app leg failed');

    expect(lintPaths('convex/fn.ts', 'src/clean.ts').status).toBe(0);
  }, 90_000);

  it('runs tests/ in the tests leg, which the app leg ignores, and fails when it fails', () => {
    const tests = lintPaths('tests/bad.ts', 'src/clean.ts');
    expect(tests.status).toBe(1);
    expect(tests.output).toContain(leg('app', '.', ['src/clean.ts']));
    expect(tests.output).toContain(leg('tests', 'tests', ['tests/bad.ts']));
    expect(tests.output).toMatch(
      /tests\/bad\.ts\n(?:.*\n)*?.*no-floating-promises/,
    );
    expect(tests.output).toContain('the tests leg failed');
    expect(tests.output).not.toContain('the app leg failed');
  }, 60_000);

  it('passes each leg exactly the files named for it', () => {
    const app = lintPaths('src/load.ts', 'src/clean.ts', 'src/suppressed.ts');
    expect(app.status).toBe(0);
    expect(linted(app.output)).toEqual({
      app: ['src/clean.ts', 'src/load.ts', 'src/suppressed.ts'],
    });

    const convex = lintPaths('convex/fn.ts', 'convex/helpers.ts');
    expect(convex.status).toBe(0);
    expect(linted(convex.output)).toEqual({
      Convex: ['convex/fn.ts', 'convex/helpers.ts'],
    });

    const mixed = lintPaths(
      'convex/fn.ts',
      'src/clean.ts',
      'tests/clean.ts',
      'convex/helpers.ts',
      'src/load.ts',
    );
    expect(mixed.status).toBe(0);
    expect(linted(mixed.output)).toEqual({
      app: ['src/clean.ts', 'src/load.ts'],
      tests: ['tests/clean.ts'],
      Convex: ['convex/fn.ts', 'convex/helpers.ts'],
    });
  }, 90_000);

  it('skips and names an ignored, deleted or non-script path, and with nothing left says so', () => {
    const { status, output } = lintPaths(
      'ignored/skip.ts',
      'src/gone.ts',
      'README.md',
    );

    expect(status).toBe(0);
    expect(output).toContain(
      'skipped ignored/skip.ts: ignored by the ESLint configuration',
    );
    expect(output).toContain('skipped src/gone.ts: not found (deleted?)');
    expect(output).toContain(
      'skipped README.md: not a JavaScript or TypeScript file',
    );
    expect(output).toContain('nothing to lint');
    expect(output).not.toContain('$ ');
  }, 60_000);

  it('refuses a directory, which it would not expand', () => {
    expect(lintPaths('src')).toMatchObject({
      status: 2,
      output: expect.stringContaining('src is a directory'),
    });
  }, 30_000);

  it('with --since, lints the files added, modified or renamed since that commit, and names the deleted ones', async () => {
    const base = git('rev-parse', 'HEAD').trim();
    await writeFile(join(root, 'src/clean.ts'), 'export const clean = 2;\n');
    await writeFile(join(root, 'convex/new.ts'), 'export const fresh = 1;\n');
    git('add', 'convex/new.ts');
    await rm(join(root, 'src/old.ts'));
    await rename(join(root, 'src/moved.ts'), join(root, 'src/renamed.ts'));
    git('add', '-A', 'src');
    git('commit', '-q', '-m', 'change');
    await writeFile(join(root, 'src/untracked.ts'), 'export const u = 1;\n');
    await writeFile(join(root, 'notes.md'), 'notes\n');

    const { status, output } = lintPaths('--since', base);

    expect(status).toBe(0);
    expect(output).toContain(
      leg('app', '.', ['src/clean.ts', 'src/renamed.ts', 'src/untracked.ts']),
    );
    expect(output).toContain(leg('convex', 'convex', ['convex/new.ts']));
    expect(linted(output)).toEqual({
      app: ['src/clean.ts', 'src/renamed.ts', 'src/untracked.ts'],
      Convex: ['convex/new.ts'],
    });
    expect(output).toContain('skipped src/old.ts: deleted');
    expect(output).toContain(
      'skipped notes.md: not a JavaScript or TypeScript file',
    );
    expect(output).not.toContain('src/moved.ts');
  }, 60_000);

  it('refuses more files than its memory class covers, and points at the full lint', async () => {
    const many = Array.from({ length: 51 }, (_, n) => `many/f${n}.ts`);
    await mkdir(join(root, 'many'));
    for (const file of many)
      await writeFile(join(root, file), 'export const n = 1;\n');

    const { status, output } = lintPaths(...many);

    expect(status).toBe(2);
    expect(output).toContain('51 files to lint, more than 50');
    expect(output).toContain('run the full lint: pnpm -s lint');
    expect(output).not.toContain('$ ');
    await rm(join(root, 'many'), { recursive: true });
  }, 30_000);
});
