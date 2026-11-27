import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { join, posix } from 'node:path';

/**
 * The module enumeration guard 3 (`legal-record-guard.test.ts`) and the
 * readers allowlist (`legal-record-readers.test.ts`) both run over, so the
 * two read the same modules.
 */
export const moduleFile = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

/** A Git command's NUL-separated output, empty entries dropped. */
export const git = (root: string, ...args: string[]) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 })
    .split('\0')
    .filter(Boolean);

/**
 * Every JS or TS module of the checkout at `root` that Git tracks (and those
 * it would: untracked files not ignored), in every directory of the
 * repository; the guard reads them all. `files` maps each regular file to its
 * source text. A link at a module path (a fixture linked into the pinned
 * store) is not read as its own module: its target is. `links` maps each link
 * to its target where the target is itself in `files` (and in the index when
 * the link is), so nothing escapes the guard through a link; `problems` names
 * every other link: outside the repository, to a directory, a non-module,
 * another link or a file Git does not track.
 */
export function trackedModules(root: string) {
  const files = new Map<string, string>();
  const found = new Map<string, string>();
  for (const path of git(
    root,
    'ls-files',
    '-z',
    '--cached',
    '--others',
    '--exclude-standard',
  )) {
    if (!moduleFile.test(path)) continue;
    const stat = lstatSync(join(root, path), { throwIfNoEntry: false });
    if (stat?.isFile()) files.set(path, readFileSync(join(root, path), 'utf8'));
    else if (stat?.isSymbolicLink()) found.set(path, linkTarget(root, path));
  }
  return { files, ...checkLinks(root, files, found) };
}

/** The repository path a link at `path` resolves to (`../…` when outside). */
const linkTarget = (root: string, path: string) =>
  posix.relative(
    root,
    posix.resolve(
      root,
      posix.dirname(path),
      readlinkSync(join(root, path), 'utf8'),
    ),
  );

/** Splits the links `found` into those covered by a target in `files`, and problems. */
function checkLinks(
  root: string,
  files: Map<string, string>,
  found: Map<string, string>,
) {
  const indexed = new Set(git(root, 'ls-files', '-z', '--cached'));
  const links = new Map<string, string>();
  const problems: string[] = [];
  for (const [path, target] of found)
    if (target === '..' || target.startsWith('../'))
      problems.push(`${path}: links to ${target}, outside the repository`);
    else if (!files.has(target) || (indexed.has(path) && !indexed.has(target)))
      problems.push(
        `${path}: links to ${target}, which is not a module Git tracks`,
      );
    else links.set(path, target);
  return { links, problems };
}

/** Whether the guard reads `path`: as a file, or through a link's target. */
export const covers = (
  { files, links }: ReturnType<typeof trackedModules>,
  path: string,
) => files.has(path) || links.has(path);
