import { execFileSync } from 'node:child_process';

/**
 * The pinned store's write guard, Vitest's `globalSetup` (vitest.config.ts):
 * when the run ends, it fails the run if any tracked file under
 * `tests/fixtures/pinned` differs from the index, naming each. The store is
 * append-only (tests/fixtures/pinned/README.md), and earlier batches' fixture
 * trees link into it, so a test that writes through such a link (a tree copied
 * without `dereference: true`, a write to a fixture path) would change it.
 * The check asks Git, so it holds whatever spelling the writer used. Files the
 * index lacks are additions, which the store allows.
 */
const store = 'tests/fixtures/pinned';

/** The tracked store files whose working-tree state differs from the index (edited, deleted or retyped). */
export function changedStoreFiles(root: string): string[] {
  return execFileSync(
    'git',
    ['diff', '--no-ext-diff', '--no-renames', '--name-only', '-z', '--', store],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  )
    .split('\0')
    .filter(Boolean)
    .sort();
}

/** Throws naming every store file the run changed; also throws when Git cannot be asked. */
export function checkPinnedStore(root: string) {
  let changed: string[];
  try {
    changed = changedStoreFiles(root);
  } catch (error) {
    throw new Error(
      `Pinned store guard: could not check ${store} with git diff in ${root}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (changed.length)
    throw new Error(
      `Pinned store guard: the test run changed ${changed.length} file(s) in the append-only store ${store} (its README). A test wrote into it, most likely through a fixture link copied without \`dereference: true\`. Restore them with \`git checkout -- ${store}\`:\n${changed.join('\n')}`,
    );
}

/** The `globalSetup` entry: Vitest passes its project and calls the returned teardown when the run ends. */
export default function setup(project: { config: { root: string } }) {
  return () => checkPinnedStore(project.config.root);
}
