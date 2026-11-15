import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { globTargets, type GlobCall } from './affected-tests/glob';
import {
  moduleResolver,
  namedFiles,
  scanModule,
  type Files,
} from './affected-tests/scan';

/**
 * `pnpm -s test:affected --base <ref>`: the Vitest test files a change can
 * reach, one per line, from a reverse dependency graph over `src`, `convex`,
 * `scripts`, `tests` and `e2e`. It is a best-effort check before review; the
 * gate's full suite is the guarantee. The change is
 * `git diff --no-renames --name-only <base>...HEAD` plus uncommitted and
 * untracked files, less the light lane's eligible paths
 * (`light_lane.py eligible`), which the Vitest reader guard keeps every test
 * from reading.
 *
 * Traced or refused: each dependency form below is either traced or makes the
 * result `everything` (nothing printed, exit 3: run the full suite).
 * - Static imports and re-exports, literal `import()`/`require()` and
 *   `vi.mock`-style calls (`ts.preProcessFile` and the AST; type-only ones
 *   load nothing). An import that resolves to `x.d.ts` also reaches `x.js`.
 * - `import.meta.glob` calls in the grammar `affected-tests/glob.ts` states;
 *   any other glob call, anywhere, is refused. `!` exclusions are ignored (a
 *   glob reaches every file an include matches), which can only over-select.
 * - Path strings: any other string literal in any module that names an
 *   existing file, whatever characters it has, relative to the module or to
 *   the repository root, with or without an extension
 *   (`readFileSync('src/a b.ts')`, a spawned
 *   `new URL('../scripts/x.ts', import.meta.url)`, a config's `setupFiles`).
 * - The Vitest configuration: `vitest.*`, `tsconfig.json` and every file they
 *   import or name by path, transitively. A change there is refused, and so is
 *   any change while a module there loads a module it cannot name.
 * - A changed path that nothing imports or names and is no module (JSON, CSS,
 *   a deleted or renamed path, anything outside the five roots) is refused.
 *
 * Residual, not traced: files a test reads or spawns through a computed path
 * or a directory scan (`readdir`, globbing libraries, joins of variables). A
 * module outside the configuration that loads a module it cannot name is
 * listed for every change, but what it loads is not.
 */
export type AffectedTestsInput = {
  /** Repository-relative path -> source text, or null for a file that is not a module. */
  files: Files;
  changed: readonly string[];
  compilerOptions: ts.CompilerOptions;
  /** Changed paths the light lane admits (`light_lane.py eligible`). */
  laneEligible?: ReadonlySet<string>;
};

export type AffectedTests =
  | { kind: 'tests'; tests: string[] }
  | { kind: 'everything'; path: string; because: string };

export type { GlobCall };

export type ImportGraph = {
  files: Files;
  /** Path -> the paths it loads or names. */
  imports: Map<string, Set<string>>;
  /** Path -> the paths that load or name it. */
  importers: Map<string, Set<string>>;
  globs: GlobCall[];
  /** Modules that load a module they cannot name, so may load any. */
  unnamedImports: Set<string>;
  configInputs: Set<string>;
};

const graphRoots = ['src', 'convex', 'scripts', 'tests', 'e2e'];
const configFiles = ['vitest.*', 'tsconfig.json'];
const vitestConfig = /^vitest\.[^/]+\.[cm]?[jt]s$/;

// vitest.config.ts `test.include`.
const vitestTest =
  /^(?:src\/.*\.test\.tsx?|convex\/.*\.test\.ts|tests\/.*\.test\.ts|e2e\/support\/.*\.test\.ts)$/;

const isModule = (files: Files, path: string) =>
  typeof files.get(path) === 'string' && !path.endsWith('.d.ts');

// Every path reachable from `starts` along `edges`, the starts included.
function reach(
  starts: Iterable<string>,
  edges: ReadonlyMap<string, ReadonlySet<string>>,
): Set<string> {
  const seen = new Set<string>();
  const queue = [...starts];
  for (let path = queue.pop(); path !== undefined; path = queue.pop()) {
    if (seen.has(path)) continue;
    seen.add(path);
    queue.push(...(edges.get(path) ?? []));
  }
  return seen;
}

function reverse(
  edges: ReadonlyMap<string, ReadonlySet<string>>,
): Map<string, Set<string>> {
  const reversed = new Map<string, Set<string>>();
  for (const [path, targets] of edges)
    for (const target of targets)
      reversed.set(target, (reversed.get(target) ?? new Set()).add(path));
  return reversed;
}

export function buildGraph(
  files: Files,
  compilerOptions: ts.CompilerOptions,
): ImportGraph {
  const resolveModule = moduleResolver(files, compilerOptions);
  const paths = [...files.keys()];
  const imports = new Map<string, Set<string>>();
  const globs: GlobCall[] = [];
  const unnamedImports = new Set<string>();
  for (const [path, source] of files) {
    if (source === null || !isModule(files, path)) continue;
    const scan = scanModule(path, source);
    const targets = new Set([
      ...scan.modules.flatMap((specifier) => resolveModule(specifier, path)),
      ...scan.globs.flatMap((call) => globTargets(call, paths)),
      ...scan.paths.flatMap((text) =>
        namedFiles(path, text, files, resolveModule),
      ),
    ]);
    targets.delete(path);
    imports.set(path, targets);
    globs.push(...scan.globs);
    if (scan.importsUnnamed) unnamedImports.add(path);
  }
  const configs = paths.filter((path) => vitestConfig.test(path));
  const configInputs = reach([...configs, 'tsconfig.json'], imports);
  return {
    files,
    imports,
    importers: reverse(imports),
    globs,
    unnamedImports,
    configInputs,
  };
}

function untraced(
  graph: ImportGraph,
  changed: readonly string[],
): AffectedTests | undefined {
  const config = changed.find((path) => graph.configInputs.has(path));
  if (config)
    return {
      kind: 'everything',
      path: config,
      because: 'a Vitest configuration input',
    };
  const loader = [...graph.configInputs]
    .sort()
    .find((path) => graph.unnamedImports.has(path));
  if (loader)
    return {
      kind: 'everything',
      path: loader,
      because:
        'a Vitest configuration input loads a module it cannot name, so every test may load any changed path',
    };
  const other = changed.find(
    (path) => !isModule(graph.files, path) && !graph.importers.has(path),
  );
  if (other)
    return {
      kind: 'everything',
      path: other,
      because:
        'not a module in the graph and nothing imports or names it (a deleted or renamed path, a file read through a computed path, or one outside the graph)',
    };
  const glob = graph.globs.find((call) => call.patterns === null);
  if (glob)
    return {
      kind: 'everything',
      path: glob.file,
      because:
        'calls an import.meta.glob outside the supported grammar and options, so it may load any changed path',
    };
  return undefined;
}

export function selectTests(
  graph: ImportGraph,
  changed: readonly string[],
  laneEligible: ReadonlySet<string> = new Set(),
): AffectedTests {
  const traced = changed.filter((path) => !laneEligible.has(path));
  if (traced.length === 0) return { kind: 'tests', tests: [] };
  const everything = untraced(graph, traced);
  if (everything) return everything;
  const starts = [...traced, ...graph.unnamedImports];
  const tests = [...reach(starts, graph.importers)]
    .filter((path) => vitestTest.test(path) && graph.files.has(path))
    .sort();
  return { kind: 'tests', tests };
}

export function affectedTests(input: AffectedTestsInput): AffectedTests {
  const graph = buildGraph(input.files, input.compilerOptions);
  return selectTests(graph, input.changed, input.laneEligible);
}

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 28 })
    .split('\n')
    .filter(Boolean);

const codeFile = /\.(?:[cm]?[jt]sx?)$/;

/** The graph roots' and Vitest configuration files of the working tree at `top`. */
export function readGraphInput(
  top: string,
): Pick<AffectedTestsInput, 'files' | 'compilerOptions'> {
  const files = new Map<string, string | null>();
  const listed = git(
    top,
    'ls-files',
    '--cached',
    '--others',
    '--exclude-standard',
    '--',
    ...graphRoots,
    ...configFiles,
  );
  for (const path of listed) {
    const absolute = join(top, path);
    if (!existsSync(absolute)) continue;
    const read = codeFile.test(path) && !path.endsWith('.d.ts');
    files.set(path, read ? readFileSync(absolute, 'utf8') : null);
  }
  const config: unknown = ts.readConfigFile(
    join(top, 'tsconfig.json'),
    (path) => ts.sys.readFile(path),
  ).config;
  const { options } = ts.convertCompilerOptionsFromJson(
    typeof config === 'object' && config !== null && 'compilerOptions' in config
      ? config.compilerOptions
      : {},
    top,
  );
  return { files, compilerOptions: options };
}

/** The `paths` the light lane admits; none when its rule cannot be asked. */
export function laneEligible(
  top: string,
  paths: readonly string[],
): Set<string> {
  try {
    const output = execFileSync(
      'python3',
      ['-B', join(top, 'scripts/orchestration/light_lane.py'), 'eligible'],
      {
        input: paths.map((path) => `${path}\0`).join(''),
        encoding: 'utf8',
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
      },
    );
    return new Set(output.split('\0').filter(Boolean));
  } catch {
    process.stderr.write(
      'test:affected: light_lane.py eligible failed; no path is exempt\n',
    );
    return new Set();
  }
}

function readRepository(cwd: string, base: string): AffectedTestsInput {
  const top = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd,
    encoding: 'utf8',
  }).trim();
  const changed = [
    ...new Set([
      ...git(top, 'diff', '--no-renames', '--name-only', `${base}...HEAD`),
      ...git(top, 'diff', '--no-renames', '--name-only', 'HEAD'),
      ...git(top, 'ls-files', '--others', '--exclude-standard'),
    ]),
  ];
  return {
    ...readGraphInput(top),
    changed,
    laneEligible: laneEligible(top, changed),
  };
}

function main(args: readonly string[]) {
  const at = args.indexOf('--base');
  const base = at >= 0 ? args[at + 1] : undefined;
  if (!base || args.length !== 2) {
    process.stderr.write('usage: pnpm -s test:affected --base <ref>\n');
    process.exit(2);
  }
  const input = readRepository(process.cwd(), base);
  const result = affectedTests(input);
  if (result.kind === 'everything') {
    process.stderr.write(
      `test:affected: ${result.path}: ${result.because}; every test may be affected, so run the full suite\n`,
    );
    process.exit(3);
  }
  process.stdout.write(result.tests.map((path) => `${path}\n`).join(''));
  process.stderr.write(
    `test:affected: ${result.tests.length} test files from ${input.changed.length} changed paths against ${base}\n`,
  );
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
)
  main(process.argv.slice(2));
