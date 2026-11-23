import { execFileSync } from 'node:child_process';
import {
  lstatSync,
  readFileSync,
  readlinkSync,
  symlinkSync,
  unlinkSync,
} from 'node:fs';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readBlobTexts } from '../lib/git-blobs';

/**
 * The per-batch copies of pinned upstream files and the links that replace
 * them (tests/fixtures/pinned/README.md, "Earlier batches' links").
 *
 * A copy is a tracked regular file under `tests/fixtures/<batch>/` whose Git
 * blob equals a tracked file in `tests/fixtures/pinned/`: byte-identical by
 * the blob id, so the index is read and no file is hashed. It is read from
 * `git ls-files -s`, the state a commit records.
 */
const fixtures = 'tests/fixtures/';
const pinnedStore = 'tests/fixtures/pinned/';

/** The one copy that stays a file. */
export const boundCopy = {
  path: 'tests/fixtures/catalog/pf1-content/src/pf-traits/A_Shining_Beacon__Iomedae__01vYmsu0vnfOmlEN.yaml',
  reason:
    'An input of the verification projection (scripts/catalog/selection-import-rules.ts names it): the gate re-hashes its Git blob, which for a link would be the link text.',
} as const;

export type PinnedCopy = {
  /** The copy's repository path. */
  path: string;
  /** The pinned file it equals. */
  pinned: string;
  /** The link that replaces it: `pinned` relative to the copy's folder. */
  target: string;
};

export type FixtureLink = { path: string; target: string };

export type FixtureTree = {
  /** Copies to link, by path. */
  copies: PinnedCopy[];
  /** Copies that stay files (`boundCopy`). */
  allowed: PinnedCopy[];
  /** Every tracked symlink under `tests/fixtures`. */
  links: FixtureLink[];
  /** One line per link that is absolute, leaves the store, has no tracked file as its target or sits in the store. */
  linkProblems: string[];
};

type Entry = { mode: string; blob: string; path: string };

const git = (root: string, args: string[]) =>
  execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

function trackedEntries(root: string): Entry[] {
  return git(root, ['ls-files', '-s', '-z', '--', fixtures])
    .split('\0')
    .filter(Boolean)
    .map((line) => {
      const [meta = '', path = ''] = line.split('\t');
      const [mode = '', blob = ''] = meta.split(' ');
      return { mode, blob, path };
    });
}

const segmentsInCommon = (a: string, b: string) => {
  const left = a.split('/').reverse();
  const right = b.split('/').reverse();
  let count = 0;
  while (count < left.length && left[count] === right[count]) count += 1;
  return count;
};

/** The pinned file a copy links to: of several with its bytes, the one that shares most of its path, then the first. */
function pinnedFor(
  copy: string,
  [first, ...rest]: readonly [string, ...string[]],
) {
  return rest.reduce((best, candidate) => {
    const order =
      segmentsInCommon(copy, candidate) - segmentsInCommon(copy, best) ||
      (candidate < best ? 1 : -1);
    return order > 0 ? candidate : best;
  }, first);
}

function linkProblem(
  link: FixtureLink,
  files: ReadonlySet<string>,
  links: ReadonlySet<string>,
) {
  if (link.path.startsWith(pinnedStore))
    return 'the store holds no link; it is a file';
  if (posix.isAbsolute(link.target)) return 'its target is absolute';
  const resolved = posix.join(posix.dirname(link.path), link.target);
  if (!resolved.startsWith(pinnedStore))
    return `its target ${resolved} is outside ${pinnedStore}`;
  if (links.has(resolved)) return `its target ${resolved} is itself a link`;
  if (!files.has(resolved))
    return `its target ${resolved} is no tracked file in the store`;
  return undefined;
}

export function readFixtureTree(root: string): FixtureTree {
  const entries = trackedEntries(root);
  const stored = new Map<string, [string, ...string[]]>();
  const files = new Set<string>();
  for (const { mode, blob, path } of entries) {
    if (mode === '120000' || !path.startsWith(pinnedStore)) continue;
    const known = stored.get(blob);
    if (known) known.push(path);
    else stored.set(blob, [path]);
    files.add(path);
  }
  const symlinks = entries.filter(({ mode }) => mode === '120000');
  // A link's blob is its target.
  const targets = readBlobTexts(
    root,
    symlinks.map(({ blob }) => blob),
  );
  const links = symlinks.map(({ blob, path }) => ({
    path,
    // A blob Git did not print reads as no target, which linkProblem names.
    target: targets.get(blob) ?? '',
  }));
  const linked = new Set(links.map(({ path }) => path));
  const found = entries.flatMap(({ mode, blob, path }) => {
    const candidates = stored.get(blob);
    if (mode === '120000' || path.startsWith(pinnedStore) || !candidates)
      return [];
    const pinned = pinnedFor(path, candidates);
    return [
      { path, pinned, target: posix.relative(posix.dirname(path), pinned) },
    ];
  });
  return {
    copies: found.filter(({ path }) => path !== boundCopy.path),
    allowed: found.filter(({ path }) => path === boundCopy.path),
    links,
    linkProblems: links.flatMap((link) => {
      const problem = linkProblem(link, files, linked);
      return problem ? [`${link.path} -> ${link.target}: ${problem}`] : [];
    }),
  };
}

export type LinkResult = {
  /** Copies replaced by a link in this run. */
  linked: string[];
  /** With `check`: copies a run would link. */
  pending: string[];
  /** Copies whose working-tree file is already the right link (not yet staged). */
  already: string[];
};

/** `tests/fixtures/<batch>/` for a batch folder given by name or path; refuses the store and anything else. */
function batchPrefix(dir: string, entries: readonly Entry[]) {
  const name = dir.replace(/^tests\/fixtures\//, '').replace(/\/+$/, '');
  const prefix = `${fixtures}${name}/`;
  if (
    !/^[^/]+$/.test(name) ||
    name === '.' ||
    name === '..' ||
    prefix === pinnedStore ||
    !entries.some(({ path }) => path.startsWith(prefix))
  )
    throw new Error(
      `--dir ${dir} is no batch folder with tracked files under ${fixtures} (the pinned store is not one).`,
    );
  return prefix;
}

function isLinkTo(path: string, target: string) {
  try {
    return lstatSync(path).isSymbolicLink() && readlinkSync(path) === target;
  } catch {
    return false;
  }
}

function refuseDirtyStore(root: string) {
  const dirty = git(root, [
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
    '--',
    pinnedStore,
  ]);
  if (dirty)
    throw new Error(
      `The pinned store differs from the index; commit or restore it first, nothing was linked:\n${dirty}`,
    );
}

function refuseChangedCopies(root: string, copies: readonly PinnedCopy[]) {
  const changed = copies.filter(({ path, pinned }) => {
    const copy = join(root, path);
    return (
      !lstatSync(copy).isFile() ||
      !readFileSync(copy).equals(readFileSync(join(root, pinned)))
    );
  });
  if (changed.length)
    throw new Error(
      `These copies are no longer byte-identical files of their pinned file; nothing was linked:\n${changed.map(({ path, pinned }) => `${path} (${pinned})`).join('\n')}`,
    );
}

/**
 * Replaces each copy (under `dir` when given) by a relative link to its pinned
 * file, after checking the store is clean and each copy's bytes still equal
 * the pinned file's; refuses before writing anything. The bound copy is never
 * touched. With `check` it writes nothing and returns the copies left.
 */
export function linkPinnedCopies(
  root: string,
  { dir, check = false }: { dir?: string; check?: boolean },
): LinkResult {
  const prefix =
    dir === undefined ? fixtures : batchPrefix(dir, trackedEntries(root));
  const selected = readFixtureTree(root).copies.filter(({ path }) =>
    path.startsWith(prefix),
  );
  const already = selected.filter(({ path, target }) =>
    isLinkTo(join(root, path), target),
  );
  const todo = selected.filter((copy) => !already.includes(copy));
  const paths = (copies: readonly PinnedCopy[]) =>
    copies.map(({ path }) => path);
  if (check)
    return { linked: [], pending: paths(todo), already: paths(already) };
  refuseDirtyStore(root);
  refuseChangedCopies(root, todo);
  for (const { path, target } of todo) {
    unlinkSync(join(root, path));
    symlinkSync(target, join(root, path));
  }
  return { linked: paths(todo), pending: [], already: paths(already) };
}

const usage =
  'usage: pnpm catalog:link-copies [--dir <batch>] [--check]  (from the repository root)';

function parseArgs(args: readonly string[]) {
  const options: { dir?: string; check?: boolean } = {};
  for (let at = 0; at < args.length; at += 1) {
    const arg = args[at];
    if (arg === '--check') options.check = true;
    else if (arg === '--dir' && args[at + 1] && options.dir === undefined)
      options.dir = args[(at += 1)];
    else return undefined;
  }
  return options;
}

/** The command: exit 0 when done (or, with --check, nothing is left to link), 1 when copies remain or it refuses, 2 on a bad argument. */
export function cli(args: readonly string[], root: string) {
  const options = parseArgs(args);
  if (!options) return { code: 2, message: usage };
  let result: LinkResult;
  try {
    result = linkPinnedCopies(root, options);
  } catch (error) {
    return {
      code: 1,
      message: error instanceof Error ? error.message : String(error),
    };
  }
  const scope = options.dir ?? 'tests/fixtures';
  if (options.check)
    return {
      code: result.pending.length ? 1 : 0,
      message: `catalog:link-copies: ${result.pending.length} copies of pinned files to link under ${scope}${result.pending.map((path) => `\n${path}`).join('')}`,
    };
  return {
    code: 0,
    message: `catalog:link-copies: linked ${result.linked.length} copies under ${scope} (${result.already.length} already linked); stage them with git add`,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { code, message } = cli(process.argv.slice(2), process.cwd());
  (code ? process.stderr : process.stdout).write(`${message}\n`);
  process.exitCode = code;
}
