import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, posix, resolve } from 'node:path';
import { z } from 'zod';
import {
  pcgenPin,
  pins,
  type Repository,
} from '../../scripts/catalog/inventory.ts';

/** A repository with files in the store: the Foundry pins, PCGen (`pcgenPin`) and the PRD capture (`prdPin`). */
export type StoreRepository = Repository | 'pcgen' | 'prd';

/** Shared, append-only store of pinned upstream files; see its README. */
export const pinnedStore = resolve('tests/fixtures/pinned');

/** The local PCGen checkout the store's PCGen files come from (read-only). */
export const pcgenCheckout = join(
  homedir(),
  `repos/everythingpath/.ep-cache/pcgen-${pcgenPin.commit.slice(0, 8)}`,
);

/** Whether the PCGen checkout is present at `pcgenPin`; tests over the whole PCGen tree skip otherwise. */
export function pcgenCheckoutIsAtPin() {
  try {
    return (
      execFileSync('git', ['-C', pcgenCheckout, 'rev-parse', 'HEAD'], {
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .toString()
        .trim() === pcgenPin.commit
    );
  } catch {
    return false;
  }
}

/** Resolves a file in the store by its repository and original upstream path; throws if the store lacks it. */
export function pinnedPath(repo: StoreRepository, path: string) {
  if (!Object.hasOwn(pins, repo) && repo !== 'pcgen' && repo !== 'prd')
    throw new Error(`Repository ${repo} has no pin.`);
  if (
    !path ||
    path.includes('\\') ||
    posix.isAbsolute(path) ||
    posix.normalize(path) !== path ||
    path.split('/').includes('..')
  )
    throw new Error(`Unsafe pinned path: ${repo}/${path}`);
  const resolved = join(pinnedStore, repo, path);
  if (!existsSync(resolved))
    throw new Error(`Pinned store lacks ${repo}/${path}.`);
  return resolved;
}

/** Reads a pinned file as UTF-8 text; throws naming the file if the store lacks it. */
export async function readPinned(repo: StoreRepository, path: string) {
  return readFile(pinnedPath(repo, path), 'utf8');
}

const manifestPacks = z.object({
  packs: z.array(z.object({ name: z.string() })),
});

/** Splits a store key such as `pf1/packs/feats/x.yaml` into a store repository and a path inside its pack (or PCGen data) directory. */
function parseTreeFile(file: string) {
  const [repo = '', ...rest] = file.split('/');
  const path = rest.join('/');
  if (!Object.hasOwn(pins, repo) && repo !== 'pcgen')
    throw new Error(`Repository ${repo} has no pin: ${file}`);
  const directory =
    repo === 'pcgen' ? pcgenPin.directory : pins[repo as Repository].directory;
  if (
    !path.startsWith(`${directory}/`) ||
    path.split('/').length < directory.split('/').length + 2
  )
    throw new Error(`Unsafe pinned path outside ${repo}/${directory}: ${file}`);
  return {
    file,
    repo: repo as Repository | 'pcgen',
    source: pinnedPath(repo as StoreRepository, path),
    path,
  };
}

/**
 * Builds a fresh pair of import checkouts under the OS temp directory from the
 * store: both full manifests, every declared pack folder, and the listed
 * `<repo>/<path>` files. Pass `systemPath`/`contentPath` to `importCatalog`.
 * Listed `pcgen/…` files go to a PCGen checkout whose data folder
 * (`pcgenPin.directory`) is `pcgenPath`, for the PCGen reader.
 * `sha256` maps listed files to their expected digests, as recorded in a
 * batch's legal inventory.
 */
export async function materializePinnedTree(
  files: readonly string[],
  opts: { sha256?: Record<string, string> } = {},
) {
  const parsed = files.map(parseTreeFile);
  const expected = opts.sha256 ?? {};
  for (const file of Object.keys(expected))
    if (!files.includes(file))
      throw new Error(`sha256 names a file that is not listed: ${file}`);
  const root = await mkdtemp(join(tmpdir(), 'pinned-sources-'));
  const roots = {
    pf1: join(root, 'pf1'),
    'pf1-content': join(root, 'pf1-content'),
    pcgen: join(root, 'pcgen'),
  };
  const dispose = () => rm(root, { recursive: true, force: true });
  try {
    for (const repo of Object.keys(pins) as Repository[]) {
      const { manifest, directory } = pins[repo];
      const text = await readPinned(repo, manifest);
      await mkdir(dirname(join(roots[repo], manifest)), { recursive: true });
      await writeFile(join(roots[repo], manifest), text);
      for (const { name } of manifestPacks.parse(JSON.parse(text)).packs)
        await mkdir(join(roots[repo], directory, name), { recursive: true });
    }
    for (const { file, repo, source, path } of parsed) {
      const bytes = await readFile(source);
      const digest = expected[file];
      if (
        digest !== undefined &&
        createHash('sha256').update(bytes).digest('hex') !== digest
      )
        throw new Error(`sha256 mismatch for ${file}.`);
      const target = join(roots[repo], path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, bytes);
    }
  } catch (error) {
    await dispose();
    throw error;
  }
  return {
    systemPath: roots.pf1,
    contentPath: roots['pf1-content'],
    pcgenPath: join(roots.pcgen, pcgenPin.directory),
    dispose,
  };
}
