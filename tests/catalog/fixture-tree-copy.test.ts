// @vitest-environment node
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';

// Earlier batches' fixture trees hold relative links into the pinned store
// (tests/fixtures/pinned/README.md, "Earlier batches' links"). A test that
// copies such a tree and edits the copy must pass `dereference: true`, so the
// copy holds files: without it, `cp` copies each link as a link to its
// target's absolute path, and an edit of the copy lands in the store.
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

it('copies a fixture tree with a link into the store as files, so editing the copy leaves the store unchanged', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fixture-tree-copy-'));
  roots.push(root);
  const store = join(root, 'pinned/pf1/packs/feats');
  const batch = join(root, 'batch/pf1/packs/feats');
  await mkdir(store, { recursive: true });
  await mkdir(batch, { recursive: true });
  await writeFile(join(store, 'dodge.yaml'), 'name: Dodge\n');
  await symlink(
    '../../../../pinned/pf1/packs/feats/dodge.yaml',
    join(batch, 'dodge.yaml'),
  );
  const copy = join(root, 'copy');

  await cp(join(root, 'batch'), copy, { recursive: true, dereference: true });
  await writeFile(join(copy, 'pf1/packs/feats/dodge.yaml'), 'name: Edited\n');

  expect(await readFile(join(store, 'dodge.yaml'), 'utf8')).toBe(
    'name: Dodge\n',
  );
  expect(await readFile(join(copy, 'pf1/packs/feats/dodge.yaml'), 'utf8')).toBe(
    'name: Edited\n',
  );
});
