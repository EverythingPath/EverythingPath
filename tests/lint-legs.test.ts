// @vitest-environment node
import { spawnSync } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ESLint } from 'eslint';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// The full lint's ESLint legs (package.json lint:eslint): the app without
// tests/** and convex/**, tests, and convex, each in its own process so that
// none holds the type data of the whole repository's lint.
const repo = path.resolve(__dirname, '..');
const legScripts = [
  'lint:eslint:app',
  'lint:eslint:tests',
  'lint:eslint:convex',
] as const;

async function packageScripts(dir: string) {
  // Safe cast: package.json is an object with a scripts object.
  return (
    JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    }
  ).scripts;
}

// A leg's ESLint target and ignore patterns, read from its script. Any other
// option than the shared suppressions file fails the read, since it could
// change which files the leg lints.
function legOf(script: string) {
  const words = [...script.matchAll(/'([^']*)'|(\S+)/g)].map(
    ([, quoted, plain]) => quoted ?? plain ?? '',
  );
  const eslint = words.findIndex((word) =>
    word.endsWith('/eslint/bin/eslint.js'),
  );
  const options = words.slice(eslint + 2);
  const ignore: string[] = [];
  const rest: string[] = [];
  for (let i = 0; i < options.length; i++)
    if (options[i] === '--ignore-pattern') ignore.push(options[++i] ?? '');
    else rest.push(options[i] ?? '');
  expect(eslint).toBeGreaterThan(0);
  expect(rest).toEqual(['--suppressions-location', 'eslint-suppressions.json']);
  return { target: words[eslint + 1] ?? '', ignore };
}

// The files ESLint resolves for a target and ignore patterns, from its own
// file resolution (the configuration's files and ignores, the ignore
// patterns, the default extensions), repository-relative and sorted. A parser
// that throws stands in for every file's own, so no file is parsed and no
// program is built: each resolved file reports one parsing error.
const unparsed = {
  meta: { name: 'unparsed' },
  parse(): never {
    throw new Error('not parsed');
  },
};
async function resolved(leg: { target: string; ignore: string[] }) {
  const eslint = new ESLint({
    cwd: repo,
    ignorePatterns: leg.ignore,
    overrideConfig: { languageOptions: { parser: unparsed } },
  });
  const results = await eslint.lintFiles([leg.target]);
  for (const result of results)
    expect(result.messages.map(({ message }) => message)).toEqual([
      'Parsing error: not parsed',
    ]);
  return results
    .map(({ filePath }) =>
      path.relative(repo, filePath).split(path.sep).join('/'),
    )
    .sort();
}

describe('the full lint’s legs on this repository', () => {
  it('lint every file the single app leg linted exactly once between the app and tests legs, and with convex every file the configuration lints', async () => {
    const scripts = await packageScripts(repo);
    const [app, tests, convex] = await Promise.all(
      legScripts.map((name) => resolved(legOf(scripts[name] ?? ''))),
    );
    // The app leg before mq-typecheck-split: node ... eslint.js .
    // --ignore-pattern 'convex/**' --suppressions-location ...
    const single = await resolved({ target: '.', ignore: ['convex/**'] });
    const everything = await resolved({ target: '.', ignore: [] });
    const twice = (a: string[], b: string[]) => a.filter((f) => b.includes(f));

    expect(tests?.length).toBeGreaterThan(500);
    expect(tests?.every((file) => file.startsWith('tests/'))).toBe(true);
    expect(app?.some((file) => file.startsWith('tests/'))).toBe(false);
    expect(twice(app ?? [], tests ?? [])).toEqual([]);
    expect([...(app ?? []), ...(tests ?? [])].sort()).toEqual(single);
    expect(twice(single, convex ?? [])).toEqual([]);
    expect([...single, ...(convex ?? [])].sort()).toEqual(everything);
  }, 120_000);

  it('are all run by lint:eslint, lint:fix and lint', async () => {
    const scripts = await packageScripts(repo);
    for (const name of ['lint:eslint', 'lint:fix'])
      for (const leg of legScripts)
        expect(scripts[name]).toMatch(new RegExp(`pnpm -s ${leg}( |;|$)`));
    expect(scripts.lint).toContain('pnpm -s lint:eslint ');
  });
});

// The legs in a small repository with its own configuration, typed programs
// and suppressions, and this repository's lint:eslint scripts, so each leg
// runs with the flags the full lint uses.
const floating = (from: string) =>
  `import { load } from '${from}';\nexport function run() {\n  load();\n}\n`;
const compilerOptions = {
  strict: true,
  target: 'es2022',
  module: 'esnext',
  moduleResolution: 'bundler',
  noEmit: true,
};
const suppressions = {
  'src/fixed.ts': { '@typescript-eslint/no-floating-promises': { count: 1 } },
  'tests/fixed.ts': { '@typescript-eslint/no-floating-promises': { count: 1 } },
};
const files: Record<string, string> = {
  'eslint.config.mjs': `import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
export default defineConfig([
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.base],
    languageOptions: { parserOptions: { projectService: true } },
    rules: { '@typescript-eslint/no-floating-promises': 'error' },
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
  'src/load.ts': 'export async function load() {\n  return 1;\n}\n',
  'src/clean.ts': 'export const clean = 1;\n',
  'src/fixed.ts': 'export const fixed = 1;\n',
  'tests/clean.ts': 'export const clean = 1;\n',
  'tests/fixed.ts': 'export const fixed = 1;\n',
  'convex/load.ts': 'export async function load() {\n  return 2;\n}\n',
};

let root: string;
beforeAll(async () => {
  const scripts = await packageScripts(repo);
  root = await realpath(await mkdtemp(path.join(tmpdir(), 'lint-legs-')));
  await symlink(
    path.join(repo, 'node_modules'),
    path.join(root, 'node_modules'),
  );
  await writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({
      type: 'module',
      scripts: Object.fromEntries(
        ['lint:eslint', ...legScripts].map((name) => [name, scripts[name]]),
      ),
    }),
  );
  for (const [file, text] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), text);
  }
});
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

function pnpm(...args: string[]) {
  const { status, stdout, stderr } = spawnSync('pnpm', ['-s', ...args], {
    cwd: root,
    encoding: 'utf8',
  });
  return { status, output: stdout + stderr };
}

// Runs with a finding in each named file, then removes them.
async function withFindings(named: string[], run: () => void) {
  for (const file of named)
    await writeFile(
      path.join(root, file),
      floating(file.startsWith('convex/') ? './load' : '../src/load'),
    );
  try {
    run();
  } finally {
    for (const file of named) await rm(path.join(root, file));
  }
}

describe('the full lint’s legs', () => {
  it('report a finding under tests/ in the tests leg only, and fail lint:eslint', async () => {
    await writeFile(
      path.join(root, 'eslint-suppressions.json'),
      JSON.stringify({}),
    );
    expect(pnpm('lint:eslint').status).toBe(0);

    await withFindings(['tests/bad.ts'], () => {
      const tests = pnpm('lint:eslint:tests');
      expect(tests.status).toBe(1);
      expect(tests.output).toMatch(
        /tests\/bad\.ts\n(?:.*\n)*?.*no-floating-promises/,
      );
      expect(pnpm('lint:eslint:app')).toMatchObject({ status: 0, output: '' });
      expect(pnpm('lint:eslint').status).toBe(1);
    });
  }, 90_000);

  it('report a finding outside tests/ in the app leg only, and fail lint:eslint whichever leg failed', async () => {
    await writeFile(
      path.join(root, 'eslint-suppressions.json'),
      JSON.stringify({}),
    );
    await withFindings(['src/bad.ts'], () => {
      const app = pnpm('lint:eslint:app');
      expect(app.status).toBe(1);
      expect(app.output).toMatch(
        /src\/bad\.ts\n(?:.*\n)*?.*no-floating-promises/,
      );
      expect(pnpm('lint:eslint:tests')).toMatchObject({
        status: 0,
        output: '',
      });
      expect(pnpm('lint:eslint').status).toBe(1);
    });
    await withFindings(['convex/bad.ts'], () => {
      expect(pnpm('lint:eslint').status).toBe(1);
    });
  }, 90_000);

  it('share one suppressions file, and a leg prunes only its own files’ entries', async () => {
    const file = path.join(root, 'eslint-suppressions.json');
    await writeFile(file, JSON.stringify(suppressions));
    // Both entries are unused: each fails its own leg, not the other.
    expect(pnpm('lint:eslint:tests').output).toContain(
      'suppressions left that do not occur anymore',
    );

    // The files the suppressions file names.
    const named = async () =>
      // Safe cast: ESLint writes this file as an object keyed by file path.
      Object.keys(JSON.parse(await readFile(file, 'utf8')) as object);
    expect(pnpm('lint:eslint:tests', '--prune-suppressions').status).toBe(0);
    expect(await named()).toEqual(['src/fixed.ts']);
    expect(pnpm('lint:eslint:app', '--prune-suppressions').status).toBe(0);
    expect(await named()).toEqual([]);
  }, 90_000);
});
