import type { readGraphInput } from '../../scripts/affected-tests';
import { globTargets } from '../../scripts/affected-tests/glob';
import {
  moduleResolver,
  namedFiles,
  scanModule,
  type ModuleScan,
} from '../../scripts/affected-tests/scan';

/**
 * Clause (a) of pbl-inventory-slim in its final form (root decision r2, D1):
 * the legal-record loader is not reachable from the launch inventory's
 * command or `mvp:status`. Decided with the repository graph's own functions
 * (`scripts/affected-tests.ts`), with no analysis of import forms.
 */
export const legalRecordLoader = 'scripts/catalog/legal-records.ts';
export const launchInventoryEntries = [
  'scripts/catalog-launch-inventory.ts',
  'scripts/mvp-status.ts',
] as const;
/**
 * Reachable modules that load a module they cannot name or call a glob the
 * graph cannot read, each with its reason. None does today.
 */
export const unnamedLoads: ReadonlyMap<string, string> = new Map();

type GraphInput = ReturnType<typeof readGraphInput>;

/**
 * R: every module the entries reach over the graph's module edges and the
 * targets of its readable `import.meta.glob` calls, with each one's scan.
 */
function reachable({ files, compilerOptions }: GraphInput) {
  const resolve = moduleResolver(files, compilerOptions);
  const paths = [...files.keys()];
  const scans = new Map<string, ModuleScan | undefined>();
  const queue: string[] = [...launchInventoryEntries];
  for (let path = queue.pop(); path !== undefined; path = queue.pop()) {
    if (scans.has(path)) continue;
    const source = files.get(path);
    const scan =
      typeof source === 'string' ? scanModule(path, source) : undefined;
    scans.set(path, scan);
    queue.push(
      ...(scan?.modules ?? []).flatMap((specifier) => resolve(specifier, path)),
      ...(scan?.globs ?? []).flatMap((call) => globTargets(call, paths)),
    );
  }
  return { scans, resolve };
}

/** A quoted string: `'` or `"` to the line's end, or backticks; `\\` escapes. */
const quotedString =
  /(['"])((?:\\.|(?!\1)[^\\\r\n])*)\1|`((?:\\[\s\S]|[^\\`])*)`/y;

/** The content of the quoted string opening at `at`, unless it is interpolated. */
function quotedAt(source: string, at: number) {
  if (!'\'"`'.includes(source[at] ?? '')) return undefined;
  quotedString.lastIndex = at;
  const [, , quoted, template] = quotedString.exec(source) ?? [];
  return quoted ?? (template?.includes('${') ? undefined : template);
}

/**
 * The lines of a module's source text holding a quoted string that resolves
 * to the loader, wherever it stands (code, a type, a JSDoc block, a comment).
 * Every quote is tried as an opening one, so a stray apostrophe cannot pair
 * with a real string's quote and hide it.
 */
function namingLines(source: string, names: (text: string) => boolean) {
  const lines = new Set<number>();
  for (let at = 0, line = 1; at < source.length; at += 1) {
    if (source[at] === '\n') line += 1;
    const text = quotedAt(source, at);
    if (text && names(text)) lines.add(line);
  }
  return [...lines];
}

/**
 * Why the loader may be read from the entries: (1) it is reachable; (2) a
 * reachable module names it, with the line; (3) a reachable module loads a
 * module it cannot name or calls an unreadable glob, unless `unnamedLoads`
 * lists it. Empty when none holds.
 */
export function loaderReachProblems(graph: GraphInput) {
  const { scans, resolve } = reachable(graph);
  const names = (from: string) => (text: string) =>
    resolve(text, from).includes(legalRecordLoader) ||
    namedFiles(from, text, graph.files, resolve).includes(legalRecordLoader);
  const problems: string[] = [];
  if (scans.has(legalRecordLoader))
    problems.push(`${legalRecordLoader}: reachable from the entries`);
  for (const [path, scan] of [...scans].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const source = graph.files.get(path);
    if (!scan || typeof source !== 'string') continue;
    for (const line of namingLines(source, names(path)))
      problems.push(`${path}:${line}: names the loader`);
    if (
      (scan.importsUnnamed ||
        scan.globs.some(({ patterns }) => patterns === null)) &&
      !unnamedLoads.has(path)
    )
      problems.push(`${path}: loads a module it cannot name`);
  }
  return { reached: new Set(scans.keys()), problems };
}
