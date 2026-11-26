import { posix } from 'node:path';
import ts from 'typescript';
import { globPatterns, isImportMetaGlob, type GlobCall } from './glob';

/** What one module loads, for `scripts/affected-tests.ts`. */
export type ModuleScan = {
  /** Specifiers it imports, re-exports or loads by literal. */
  modules: string[];
  globs: GlobCall[];
  /** It loads a module it cannot name (`import(x)`, `require(x)`, `vi.mock(x)`). */
  importsUnnamed: boolean;
  /** Other string literals that may name a file (`'src/a.ts'`, `'../b'`). */
  paths: string[];
};

/** Path -> source text, or null for a file that is not a module. */
export type Files = ReadonlyMap<string, string | null>;

/** The files a specifier names from a module: none, one, or a declaration and its JavaScript. */
export type Resolve = (specifier: string, from: string) => string[];

const root = '/repo';
const toAbsolute = (path: string) => `${root}/${path}`;
const toRelative = (path: string) => posix.relative(root, path);
const declaration = /\.d\.([cm]?)ts$/;

/** Module resolution over the in-memory file map, as tsconfig.json resolves. */
export function moduleResolver(
  files: Files,
  compilerOptions: ts.CompilerOptions,
): Resolve {
  const directories = new Set<string>();
  for (const path of files.keys())
    for (let dir = posix.dirname(path); dir !== '.'; dir = posix.dirname(dir))
      directories.add(dir);
  const host: ts.ModuleResolutionHost = {
    fileExists: (path) => files.has(toRelative(path)),
    readFile: (path) => files.get(toRelative(path)) ?? undefined,
    directoryExists: (path) =>
      path === root || directories.has(toRelative(path)),
  };
  const options = { ...compilerOptions, baseUrl: root };
  const cache = ts.createModuleResolutionCache(root, (name) => name, options);
  const typescript = (specifier: string, from: string) => {
    const resolved = ts.resolveModuleName(
      specifier,
      toAbsolute(from),
      options,
      host,
      cache,
    ).resolvedModule?.resolvedFileName;
    const path = resolved && toRelative(resolved);
    return path && files.has(path) ? path : undefined;
  };
  return (specifier, from) => {
    // Vite drops `?raw`, `?url` and the like before it loads the file.
    const file = specifier.replace(/[?#].*$/, '');
    const path =
      typescript(specifier, from) ??
      typescript(file, from) ??
      fileTargets(file, from, options.paths).find((path) => files.has(path));
    if (!path) return [];
    // `api.d.ts` types `api.js`, which is what Vite loads.
    const runtime = path.replace(declaration, '.$1js');
    return runtime !== path && files.has(runtime) ? [path, runtime] : [path];
  };
}

// The files a specifier TypeScript does not resolve (CSS, `?raw` imports)
// may name: relative to `from`, root-relative, or through a `paths` alias.
function fileTargets(
  specifier: string,
  from: string,
  paths: ts.MapLike<string[]> = {},
): string[] {
  if (specifier.startsWith('.'))
    return [posix.join(posix.dirname(from), specifier)];
  if (specifier.startsWith('/')) return [posix.normalize(specifier.slice(1))];
  return Object.entries(paths).flatMap(([alias, targets]) => {
    const [prefix = '', suffix] = alias.split('*');
    const matches =
      suffix === undefined
        ? specifier === alias
        : specifier.startsWith(prefix) && specifier.endsWith(suffix);
    const middle = specifier.slice(
      prefix.length,
      specifier.length - (suffix?.length ?? 0),
    );
    return matches
      ? targets.map((target) => posix.normalize(target.replace('*', middle)))
      : [];
  });
}

const typeOnly = /^\s*(?:import|export)\s+type\s[^;]*;/gm;
const vitestModuleCalls = new Set([
  'mock',
  'doMock',
  'unmock',
  'doUnmock',
  'importActual',
  'importMock',
]);

const literal = (node: ts.Node | undefined) =>
  node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : undefined;

// The module a call loads: `import(x)`, `require(x)`, `vi.mock(x)` and the
// like; undefined for any other call.
function loadedModule(
  call: ts.CallExpression,
): { specifier?: string } | undefined {
  const callee = call.expression;
  const loads =
    callee.kind === ts.SyntaxKind.ImportKeyword ||
    (ts.isIdentifier(callee) && callee.text === 'require') ||
    (ts.isPropertyAccessExpression(callee) &&
      ts.isIdentifier(callee.expression) &&
      callee.expression.text === 'vi' &&
      vitestModuleCalls.has(callee.name.text));
  if (!loads) return undefined;
  const [argument] = call.arguments;
  // `vi.mock(import(<path>))`: the inner import is its own call.
  if (argument && ts.isCallExpression(argument) && loadedModule(argument))
    return {};
  return { specifier: literal(argument) };
}

// A string literal that is not a module specifier (those are `modules`, and
// type-only ones load nothing). Any characters: `namedFiles` keeps only the
// ones naming an existing file.
const isSpecifier = (node: ts.Node) =>
  ts.isImportDeclaration(node) ||
  ts.isExportDeclaration(node) ||
  ts.isExternalModuleReference(node) ||
  ts.isLiteralTypeNode(node) ||
  ts.isModuleDeclaration(node);

function pathString(node: ts.Node): string | undefined {
  const text = literal(node);
  return text !== undefined && text !== '' && !isSpecifier(node.parent)
    ? text
    : undefined;
}

export function scanModule(path: string, source: string): ModuleScan {
  const modules = ts
    .preProcessFile(source.replace(typeOnly, ''), true, true)
    .importedFiles.map((file) => file.fileName);
  const scan: ModuleScan = {
    modules,
    globs: [],
    importsUnnamed: false,
    paths: [],
  };
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node): void => {
    if (isImportMetaGlob(node))
      scan.globs.push({
        file: path,
        position: node.getStart(file),
        patterns: globPatterns(node),
      });
    const loaded = ts.isCallExpression(node) ? loadedModule(node) : undefined;
    if (loaded && 'specifier' in loaded) {
      if (loaded.specifier === undefined) scan.importsUnnamed = true;
      else scan.modules.push(loaded.specifier);
    }
    const named = pathString(node);
    if (named !== undefined) scan.paths.push(named);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return scan;
}

/**
 * The files a path string in `from` names: relative to `from`'s directory or
 * to the repository root (where tests run and Vitest resolves config paths),
 * whatever characters it has. A literal with a `/` or an extension may also
 * name a module without its extension; a directory names only its index
 * module. (A bare word such as `'user'` names only a file of that exact name.)
 */
export function namedFiles(
  from: string,
  text: string,
  files: Files,
  resolveModule: Resolve,
): string[] {
  const candidates = new Set([
    posix.join(posix.dirname(from), text),
    posix.normalize(text.replace(/^\/+/, '')),
  ]);
  const pathShaped = text.includes('/') || /\.\w+$/.test(text);
  return [...candidates].flatMap((candidate) =>
    files.has(candidate)
      ? [candidate]
      : pathShaped
        ? resolveModule(`./${candidate}`, 'package.json')
        : [],
  );
}
