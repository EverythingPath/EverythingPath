// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import ts from 'typescript';
import {
  affectedTests,
  buildGraph,
  laneEligible,
  readGraphInput,
  selectTests,
  type ImportGraph,
} from '../scripts/affected-tests';

const compilerOptions: ts.CompilerOptions = {
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  module: ts.ModuleKind.ESNext,
  allowJs: true,
  resolveJsonModule: true,
  allowImportingTsExtensions: true,
  paths: { '~/*': ['./src/*'], '@convex/*': ['./convex/*'] },
};

// A small repository: path -> source text, or null for a file that is not a
// module (JSON, CSS).
const files = new Map<string, string | null>([
  ['src/lib/a.ts', 'export const a = 1;\n'],
  ['src/lib/b.ts', "import { a } from './a';\nexport const b = a;\n"],
  ['src/lib/b.test.ts', "import { b } from './b';\n"],
  ['src/lib/c.ts', "import React from 'react';\nexport const c = 2;\n"],
  ['src/lib/c.test.tsx', "import { c } from './c.ts';\n"],
  ['src/lib/types.ts', 'export type T = { n: number };\n'],
  [
    'src/lib/typed.test.ts',
    "import type {\n  T,\n} from './types';\nexport type { T as U } from './types';\n",
  ],
  ['src/styles/globals.css', null],
  ['tests/alias.test.ts', "import { a } from '~/lib/a.ts';\n"],
  [
    'convex/fn.ts',
    "import data from '../tests/fixtures/data.json';\nexport default data;\n",
  ],
  ['convex/fn.test.ts', "const fn = await import('./fn');\n"],
  ['tests/fixtures/data.json', null],
  [
    'tests/mocked.test.ts',
    'vi.mock(\'@convex/fn\', () => ({}));\nconst real = await vi.importActual("~/lib/c");\n',
  ],
  ['e2e/support/helper.ts', "export * from '../../src/lib/b';\n"],
  ['e2e/support/helper.test.ts', "import './helper';\n"],
  ['e2e/flow.spec.ts', "import { b } from '../src/lib/b';\n"],
  ['scripts/tool.ts', "import { b } from '../src/lib/b.ts';\n"],
  ['convex/other.ts', 'export const other = 3;\n'],
  [
    'tests/glob.test.ts',
    "const modules = import.meta.glob('../convex/{fn,other}.ts');\n",
  ],
  [
    'convex/modules.test.ts',
    'const modules = import.meta.glob("./**/*.ts");\n',
  ],
  [
    'tests/validators.test.ts',
    "const modules = import.meta.glob<Record<string, unknown>>([\n  '../convex/**/*.{ts,js}',\n  '!../convex/**/*.test.ts',\n  '!../convex/other.ts',\n]);\n",
  ],
  ['tests/cycle-one.ts', "import './cycle-two';\nexport const one = 1;\n"],
  ['tests/cycle-two.ts', "import './cycle-one';\n"],
  ['tests/cycle.test.ts', "import { one } from './cycle-one';\n"],
  [
    'vitest.config.ts',
    "import path from 'node:path';\nimport { guard } from './tests/guard';\nexport default { test: { reporters: ['default', './tests/reporter.ts'], setupFiles: ['./vitest.setup.ts'] }, resolve: { alias: { '~': path.resolve(__dirname, './src') } } };\n",
  ],
  ['vitest.setup.ts', "import '@testing-library/jest-dom/vitest';\n"],
  ['tests/guard.ts', "import { a } from '../src/lib/a';\n"],
  ['tests/reporter.ts', "import { format } from './reporter-format';\n"],
  ['tests/reporter-format.ts', 'export const format = 1;\n'],
  ['tests/fixtures/orphan.json', null],
  ['tsconfig.json', null],
]);

const affected = (...changed: string[]) =>
  affectedTests({ files, changed, compilerOptions });

const affectedWith = (
  extra: Record<string, string | null>,
  ...changed: string[]
) =>
  affectedTests({
    files: new Map([...files, ...Object.entries(extra)]),
    changed,
    compilerOptions,
  });

describe('affectedTests', () => {
  it('lists the tests that reach a changed file through imports and aliases', () => {
    expect(affected('src/lib/b.ts')).toEqual({
      kind: 'tests',
      tests: ['e2e/support/helper.test.ts', 'src/lib/b.test.ts'],
    });
  });

  it('includes a changed test file itself, once', () => {
    expect(affected('src/lib/c.test.tsx', 'src/lib/c.ts')).toEqual({
      kind: 'tests',
      tests: ['src/lib/c.test.tsx', 'tests/mocked.test.ts'],
    });
  });

  it('follows dynamic imports, Vitest module mocks and globs to a changed module', () => {
    expect(affected('convex/fn.ts')).toEqual({
      kind: 'tests',
      tests: [
        'convex/fn.test.ts',
        'convex/modules.test.ts',
        'tests/glob.test.ts',
        'tests/mocked.test.ts',
        'tests/validators.test.ts',
      ],
    });
  });

  it('follows import.meta.glob patterns, as convex-test module maps use them', () => {
    expect(affected('convex/other.ts')).toEqual({
      kind: 'tests',
      tests: [
        'convex/modules.test.ts',
        'tests/glob.test.ts',
        'tests/validators.test.ts',
      ],
    });
  });

  it('reads typed glob calls with arrays, reaching what their ! exclusions name too', () => {
    expect(affected('convex/fn.test.ts')).toEqual({
      kind: 'tests',
      tests: [
        'convex/fn.test.ts',
        'convex/modules.test.ts',
        'tests/validators.test.ts',
      ],
    });
    expect(affectedWith({ 'convex/new.js': '' }, 'convex/new.js')).toEqual({
      kind: 'tests',
      tests: ['tests/validators.test.ts'],
    });
  });

  it('fails safe on a glob whose pattern it cannot read', () => {
    for (const source of [
      'const modules = import.meta.glob(pattern);\n',
      "const modules = import.meta.glob(['../convex/*.ts', pattern]);\n",
      'const modules = import.meta.glob(`../${dir}/*.ts`);\n',
      "const modules = import.meta.glob('~/lib/*.ts');\n",
      'const glob = import.meta.glob;\n',
      "const modules = import.meta.globEager('../convex/*.ts');\n",
    ])
      expect(
        affectedWith({ 'tests/dynamic.test.ts': source }, 'scripts/tool.ts'),
      ).toEqual({
        kind: 'everything',
        path: 'tests/dynamic.test.ts',
        because: expect.stringContaining('import.meta.glob') as string,
      });
  });

  it('always lists a test that imports a module it cannot name', () => {
    const loader = {
      'tests/loader.test.ts': 'await import(path);\n',
      'tests/requirer.test.ts': 'require(name);\n',
      'tests/mocker.test.ts': 'vi.mock(name);\n',
    };
    expect(affectedWith(loader, 'convex/other.ts')).toEqual({
      kind: 'tests',
      tests: [
        'convex/modules.test.ts',
        'tests/glob.test.ts',
        'tests/loader.test.ts',
        'tests/mocker.test.ts',
        'tests/requirer.test.ts',
        'tests/validators.test.ts',
      ],
    });
  });

  it('ignores type-only imports and re-exports, which tests never load', () => {
    expect(affected('src/lib/types.ts')).toEqual({ kind: 'tests', tests: [] });
  });

  it('lists no Playwright spec and stops at import cycles', () => {
    expect(affected('tests/cycle-two.ts')).toEqual({
      kind: 'tests',
      tests: ['tests/cycle.test.ts'],
    });
  });

  it('lists nothing for a module no test imports', () => {
    expect(affected('scripts/tool.ts')).toEqual({ kind: 'tests', tests: [] });
  });

  it('fails safe on a changed path that is not a module and nothing names: fixtures, styles, other files', () => {
    for (const path of [
      'tests/fixtures/orphan.json',
      'src/styles/globals.css',
      'docs/notes.md',
      'scripts/orchestration/prep-lib.sh',
      'package.json',
    ])
      expect(affected('scripts/tool.ts', path)).toEqual({
        kind: 'everything',
        path,
        because: expect.stringContaining('not a module') as string,
      });
  });

  it('fails safe on a deleted or renamed module, imported or globbed', () => {
    const importer = {
      'src/lib/gone.test.ts': "import { gone } from './gone';\n",
    };
    expect(affectedWith(importer, 'src/lib/gone.ts')).toMatchObject({
      kind: 'everything',
      path: 'src/lib/gone.ts',
    });
    // A rename lists the old path too (git diff --no-renames).
    expect(affected('convex/gone.ts', 'convex/other.ts')).toMatchObject({
      kind: 'everything',
      path: 'convex/gone.ts',
    });
  });

  // Synthetic lane-eligible paths that name no real file: a real one named
  // here would make the light lane refuse every edit to that file.
  const eligibleA = 'docs/agents/synthetic-eligible-a.md';
  const eligibleB = '.claude/agents/synthetic-eligible-b.md';

  it('exempts light-lane eligible paths, which no test reads', () => {
    const changed = [eligibleA, eligibleB, 'src/lib/c.ts'];
    expect(
      affectedTests({
        files,
        changed,
        compilerOptions,
        laneEligible: new Set([eligibleA, eligibleB]),
      }),
    ).toEqual({
      kind: 'tests',
      tests: ['src/lib/c.test.tsx', 'tests/mocked.test.ts'],
    });
    expect(affected(eligibleA)).toMatchObject({
      kind: 'everything',
      path: eligibleA,
    });
  });

  it('reports every test affected when a Vitest configuration input changes', () => {
    expect(affected('src/lib/b.ts', 'src/lib/a.ts')).toEqual({
      kind: 'everything',
      path: 'src/lib/a.ts',
      because: 'a Vitest configuration input',
    });
    expect(affected('tsconfig.json')).toMatchObject({
      kind: 'everything',
      path: 'tsconfig.json',
    });
    expect(affected('vitest.setup.ts').kind).toBe('everything');
  });

  it('counts modules a Vitest config names by string, and their imports, as configuration inputs', () => {
    for (const path of ['tests/reporter.ts', 'tests/reporter-format.ts'])
      expect(affected(path)).toEqual({
        kind: 'everything',
        path,
        because: 'a Vitest configuration input',
      });
    // An alias names a directory, not a module the config loads.
    expect(affected('src/lib/c.ts').kind).toBe('tests');
  });
});

describe('affectedTests: unnamed loaders in the Vitest configuration', () => {
  const loaders = {
    import: 'const name = "./src/lib/" + "c";\nawait import(name);\n',
    require: 'require(name);\n',
    'vi.mock': 'vi.mock(name);\n',
  };

  it.each(Object.entries(loaders))(
    'fails safe on an unnamed %s in a setup file',
    (_, loader) => {
      expect(
        affectedWith({ 'vitest.setup.ts': loader }, 'src/lib/c.ts'),
      ).toEqual({
        kind: 'everything',
        path: 'vitest.setup.ts',
        because: expect.stringContaining('cannot name') as string,
      });
    },
  );

  it.each(Object.entries(loaders))(
    'fails safe on an unnamed %s in a helper the setup file imports',
    (_, loader) => {
      expect(
        affectedWith(
          {
            'vitest.setup.ts': "import './tests/setup-helper';\n",
            'tests/setup-helper.ts': loader,
          },
          'src/lib/c.ts',
        ),
      ).toEqual({
        kind: 'everything',
        path: 'tests/setup-helper.ts',
        because: expect.stringContaining('cannot name') as string,
      });
    },
  );
});

describe('affectedTests: configuration strings in imported modules', () => {
  it('counts the files a config imported by vitest.config.ts names as configuration inputs', () => {
    const shared = {
      'vitest.config.ts':
        "import { shared } from './tests/shared-config';\nexport default shared;\n",
      'tests/shared-config.ts':
        "export const shared = { test: { setupFiles: ['./tests/setup.ts'] } };\n",
      'tests/setup.ts': "import { b } from '../src/lib/b';\n",
    };
    for (const path of ['tests/shared-config.ts', 'tests/setup.ts'])
      expect(affectedWith(shared, path)).toEqual({
        kind: 'everything',
        path,
        because: 'a Vitest configuration input',
      });
  });

  it('counts a setup file whose name has a space, and what it imports, as configuration inputs', () => {
    const spaced = {
      'vitest.config.ts':
        "export default { test: { setupFiles: ['./tests/setup file.ts'] } };\n",
      'tests/setup file.ts': "import { b } from '../src/lib/b';\n",
    };
    for (const path of ['tests/setup file.ts', 'src/lib/b.ts'])
      expect(affectedWith(spaced, path)).toEqual({
        kind: 'everything',
        path,
        because: 'a Vitest configuration input',
      });
  });
});

describe('affectedTests: import.meta.glob grammar', () => {
  const user = { 'convex/user.ts': 'export const user = 1;\n' };
  const globbing = (call: string) => ({
    ...user,
    'tests/user-glob.test.ts': `const modules = ${call};\n`,
  });

  it.each([
    "import.meta.glob('../convex/use[r].ts')",
    "import.meta.glob('../convex/[cu]*.ts')",
    "import.meta.glob('../convex/@(user|campaign).ts')",
    "import.meta.glob('../convex/+(user).ts')",
    "import.meta.glob('../convex/!(other).ts')",
    "import.meta.glob('../convex/use?.ts')",
    "import.meta.glob('../convex/\\\\user.ts')",
    "import.meta.glob('../convex/{user,{fn,other}}.ts')",
    "import.meta.glob('../convex/{a..z}*.ts')",
    "import.meta.glob('../convex/u**.ts')",
    "import.meta.glob('./use*.ts', { base: '../convex' })",
    "import.meta.glob('../convex/*.ts', { exhaustive: true })",
    "import.meta.glob('../convex/*.ts', { as: 'raw' })",
    "import.meta.glob('../convex/*.ts', options)",
    "import.meta.glob('../convex/*.ts', { ...options })",
    "import.meta.glob('../convex/*.ts', { eager: true }, extra)",
  ])('fails safe on %s', (call) => {
    expect(affectedWith(globbing(call), 'convex/user.ts')).toEqual({
      kind: 'everything',
      path: 'tests/user-glob.test.ts',
      because: expect.stringContaining('import.meta.glob') as string,
    });
  });

  it.each([
    "import.meta.glob('../convex/use*.ts')",
    "import.meta.glob('../convex/{user,other}.ts', { eager: true, import: 'default', query: '?raw' })",
    "import.meta.glob(['../convex/**/*.ts', '!../convex/fn.ts'], { eager: false })",
    "import.meta.glob('/convex/*.ts')",
  ])('reads %s', (call) => {
    expect(affectedWith(globbing(call), 'convex/user.ts')).toEqual({
      kind: 'tests',
      tests: [
        'convex/modules.test.ts',
        'tests/user-glob.test.ts',
        'tests/validators.test.ts',
      ],
    });
  });

  it('ignores ! exclusions, which Vite matches differently (dotfiles), so a glob never drops a file Vite loads', () => {
    expect(
      affectedWith(
        {
          'src/.hidden.ts': 'export const hidden = 1;\n',
          'tests/hidden-glob.test.ts':
            "const modules = import.meta.glob(['../src/.*.ts', '!../src/*.ts']);\n",
        },
        'src/.hidden.ts',
      ),
    ).toEqual({ kind: 'tests', tests: ['tests/hidden-glob.test.ts'] });
  });
});

describe('affectedTests: paths named by string', () => {
  it('lists a test that reads a module by a root-relative path', () => {
    expect(
      affectedWith(
        {
          'tests/fingerprint.test.ts':
            "import { readFileSync } from 'node:fs';\nreadFileSync('src/lib/types.ts');\n",
        },
        'src/lib/types.ts',
      ),
    ).toEqual({ kind: 'tests', tests: ['tests/fingerprint.test.ts'] });
  });

  it('lists a test that reads a file whatever characters its literal name has', () => {
    const long = `src/${'n'.repeat(300)}.ts`;
    for (const path of ['src/a b.ts', 'src/a:b.ts', long, 'LICENSE'])
      expect(
        affectedWith(
          {
            [path]: path.endsWith('.ts') ? 'export const a = 1;\n' : null,
            'tests/reader.test.ts': `import { readFileSync } from 'node:fs';\nreadFileSync(${JSON.stringify(path)});\n`,
          },
          path,
        ),
      ).toEqual({ kind: 'tests', tests: ['tests/reader.test.ts'] });
  });

  it('lists a test that spawns an entrypoint named relative to itself, and what it imports', () => {
    const spawner = {
      'tests/spawn.test.ts':
        "execFileSync(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('../scripts/tool.ts', import.meta.url))]);\n",
    };
    for (const path of ['scripts/tool.ts', 'src/lib/b.ts'])
      expect(affectedWith(spawner, path)).toMatchObject({
        kind: 'tests',
        tests: expect.arrayContaining(['tests/spawn.test.ts']) as string[],
      });
  });

  it('lists a test that names a module without its extension, or a helper that names it', () => {
    expect(
      affectedWith(
        {
          'tests/paths.ts': "export const tool = 'scripts/tool';\n",
          'tests/paths.test.ts': "import { tool } from './paths';\n",
        },
        'scripts/tool.ts',
      ),
    ).toEqual({ kind: 'tests', tests: ['tests/paths.test.ts'] });
  });

  it('traces a non-module file a module names or imports, and fails safe on one nothing names', () => {
    expect(
      affectedWith(
        {
          'tests/scope.json': null,
          'tests/scope.test.ts':
            "const scope = readFileSync(new URL('./scope.json', import.meta.url));\n",
        },
        'tests/scope.json',
      ),
    ).toEqual({ kind: 'tests', tests: ['tests/scope.test.ts'] });
    expect(affected('tests/fixtures/data.json')).toEqual({
      kind: 'tests',
      tests: [
        'convex/fn.test.ts',
        'convex/modules.test.ts',
        'tests/glob.test.ts',
        'tests/mocked.test.ts',
        'tests/validators.test.ts',
      ],
    });
    expect(affected('tests/fixtures/orphan.json')).toMatchObject({
      kind: 'everything',
      path: 'tests/fixtures/orphan.json',
    });
  });

  it('traces imports TypeScript does not resolve: aliased styles and ?raw queries', () => {
    const styled = {
      'src/app/layout.tsx':
        "import '~/styles/globals.css';\nimport notes from './notes.md?raw';\n",
      'src/app/notes.md': null,
      'src/app/layout.test.tsx': "import './layout';\n",
    };
    for (const path of ['src/styles/globals.css', 'src/app/notes.md'])
      expect(affectedWith(styled, path)).toEqual({
        kind: 'tests',
        tests: ['src/app/layout.test.tsx'],
      });
  });

  it('reaches a generated JavaScript module through the declaration its importers resolve to', () => {
    const generated = {
      'convex/_generated/api.d.ts': null,
      'convex/_generated/api.js': 'export const api = {};\n',
      'tests/api.test.ts': "import { api } from '../convex/_generated/api';\n",
    };
    for (const path of [
      'convex/_generated/api.js',
      'convex/_generated/api.d.ts',
    ])
      expect(affectedWith(generated, path)).toMatchObject({
        kind: 'tests',
        tests: expect.arrayContaining(['tests/api.test.ts']) as string[],
      });
  });
});

describe('affectedTests against this repository', () => {
  const top = fileURLToPath(new URL('..', import.meta.url));
  let graph: ImportGraph;
  const select = (...changed: string[]) =>
    selectTests(graph, changed, laneEligible(top, changed));

  beforeAll(() => {
    const { files, compilerOptions } = readGraphInput(top);
    graph = buildGraph(files, compilerOptions);
  }, 120_000);

  it('lists the tests that read a calculation module by path or spawn a CLI', () => {
    for (const [path, reader] of [
      [
        'src/lib/character-sheet-conditions.ts',
        'tests/catalogRuntimeCompatibility.test.ts',
      ],
      [
        'src/lib/character-sheet.ts',
        'tests/catalogRuntimeCompatibility.test.ts',
      ],
      [
        'scripts/catalog-launch-inventory.ts',
        'tests/catalog/launch-document.test.ts',
      ],
    ] as const) {
      const result = select(path);
      expect(result.kind).toBe('tests');
      expect(result.kind === 'tests' && result.tests).toContain(reader);
    }
  });

  it('lists the readers of a changed scope, stylesheet and expected fixture, which name them', () => {
    for (const [path, reader] of [
      [
        'scripts/catalog/scopes/campaign-mvp-v1.json',
        'tests/catalog/launch-core.test.ts',
      ],
      ['src/styles/globals.css', 'src/styles/globals.test.ts'],
      [
        'tests/fixtures/curation/expected/pipeline.json',
        'tests/catalog/curation.test.ts',
      ],
    ] as const) {
      const result = select(path);
      expect(result.kind).toBe('tests');
      expect(result.kind === 'tests' && result.tests).toContain(reader);
    }
  });

  it('fails safe on a non-module file nothing names, and on a deleted one', () => {
    // Found at run time, so that this file names neither.
    const unnamed = [...graph.files.keys()]
      .filter(
        (path) =>
          graph.files.get(path) === null &&
          path.endsWith('.json') &&
          !graph.importers.has(path) &&
          !graph.configInputs.has(path),
      )
      .sort();
    expect(unnamed.length).toBeGreaterThan(0);
    for (const path of [unnamed[0] ?? '', `tests/fixtures/${'gone'}.json`])
      expect(select(path)).toMatchObject({ kind: 'everything', path });
  });

  it('exempts light-lane eligible paths only', () => {
    // Synthetic, as above: eligibility is decided from the path alone.
    expect(
      select(
        'docs/agents/synthetic-eligible-c.md',
        '.claude/agents/synthetic-eligible-d.md',
      ),
    ).toEqual({ kind: 'tests', tests: [] });
  });

  it('selects the Convex validator guard, which globs Convex modules with exclusions, for a Convex change', () => {
    const result = select('convex/user.ts');
    expect(result.kind).toBe('tests');
    expect(result.kind === 'tests' && result.tests).toContain(
      'tests/convex-function-validators.test.ts',
    );
  });

  it('parses every import.meta.glob in the graph roots into edges or lists it as a fallback', () => {
    const listed = execFileSync(
      'git',
      ['ls-files', '--', 'src', 'convex', 'scripts', 'tests', 'e2e'],
      { cwd: top, encoding: 'utf8', maxBuffer: 1 << 28 },
    )
      .split('\n')
      .filter(
        (path) => /\.[cm]?[jt]sx?$/.test(path) && !path.endsWith('.d.ts'),
      );
    const found: string[] = [];
    for (const path of listed) {
      const source = readFileSync(join(top, path), 'utf8');
      if (!source.includes('import.meta')) continue;
      const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest);
      const visit = (node: ts.Node): void => {
        if (
          ts.isPropertyAccessExpression(node) &&
          ts.isMetaProperty(node.expression) &&
          node.name.text.startsWith('glob')
        )
          found.push(`${path}:${node.getStart(file)}`);
        ts.forEachChild(node, visit);
      };
      visit(file);
    }
    const recorded = graph.globs.map((call) => `${call.file}:${call.position}`);
    expect(found.length).toBeGreaterThan(100);
    expect(recorded.sort()).toEqual(found.sort());
    const validators = graph.globs.filter(
      (call) => call.file === 'tests/convex-function-validators.test.ts',
    );
    expect(validators).toHaveLength(1);
    expect(validators[0]?.patterns).toContain('!../convex/_generated/**');
    expect(graph.globs.filter((call) => call.patterns === null)).toEqual([]);
  });

  it('counts every file a Vitest config names by string as a configuration input', () => {
    const configs = execFileSync('git', ['ls-files', '--', 'vitest.*'], {
      cwd: top,
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean);
    const named = configs.flatMap((config) =>
      [
        ...readFileSync(join(top, config), 'utf8').matchAll(
          /(['"`])([^'"`\n]+)\1/g,
        ),
      ]
        .map(([, , literal]) =>
          posix.join(posix.dirname(config), literal ?? ''),
        )
        .filter((path) => {
          try {
            return statSync(join(top, path)).isFile();
          } catch {
            return false;
          }
        }),
    );
    expect(named).toEqual(
      expect.arrayContaining([
        'tests/duration-budget-reporter.ts',
        'vitest.setup.ts',
      ]),
    );
    for (const path of named)
      expect(select(path)).toEqual({
        kind: 'everything',
        path,
        because: 'a Vitest configuration input',
      });
  });
});
