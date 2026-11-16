// @vitest-environment node
import { execFileSync } from 'node:child_process';
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import {
  boundCopy,
  cli,
  linkPinnedCopies,
  readFixtureTree,
} from '../../scripts/catalog/link-pinned-copies';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

const git = (root: string, ...args: string[]) =>
  execFileSync('git', args, { cwd: root, stdio: 'pipe' });

const dodge = 'tests/fixtures/feats-1/pf1/packs/feats/dodge.yaml';
const patrol = 'tests/fixtures/feats-1/supporting-sources/patrol.yaml';
const own = 'tests/fixtures/feats-1/own.yaml';
const otherDodge = 'tests/fixtures/feats-2/pf1/packs/feats/dodge.yaml';

/** A checkout with a store of three files and copies of them in two batches, the bound copy among them. */
async function checkout() {
  const root = await mkdtemp(join(tmpdir(), 'link-pinned-copies-'));
  roots.push(root);
  const files: Record<string, string> = {
    'tests/fixtures/pinned/pf1/packs/feats/dodge.yaml': 'name: Dodge\n',
    'tests/fixtures/pinned/pf1-content/src/pf-feats/patrol.yaml':
      'name: Combat Patrol\n',
    [boundCopy.path.replace(
      'tests/fixtures/catalog/',
      'tests/fixtures/pinned/',
    )]: 'name: A Shining Beacon\n',
    [dodge]: 'name: Dodge\n',
    [patrol]: 'name: Combat Patrol\n',
    [own]: 'name: Dodge, cut down\n',
    [otherDodge]: 'name: Dodge\n',
    [boundCopy.path]: 'name: A Shining Beacon\n',
  };
  for (const [path, text] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), text);
  }
  git(root, 'init', '-q');
  git(root, 'add', '-A');
  git(
    root,
    '-c',
    'user.name=t',
    '-c',
    'user.email=t@example.invalid',
    'commit',
    '-qm',
    'fixtures',
  );
  return root;
}

it('replaces each copy by a relative link to its pinned file, keeping its bytes, and leaves the bound copy and other files', async () => {
  const root = await checkout();

  const result = linkPinnedCopies(root, {});

  expect(result).toEqual({
    linked: [dodge, patrol, otherDodge],
    pending: [],
    already: [],
  });
  expect(await readlink(join(root, dodge))).toBe(
    '../../../../pinned/pf1/packs/feats/dodge.yaml',
  );
  expect(await readlink(join(root, patrol))).toBe(
    '../../pinned/pf1-content/src/pf-feats/patrol.yaml',
  );
  expect(await readFile(join(root, patrol), 'utf8')).toBe(
    'name: Combat Patrol\n',
  );
  expect((await lstat(join(root, boundCopy.path))).isFile()).toBe(true);
  expect((await lstat(join(root, own))).isFile()).toBe(true);
  git(root, 'add', '-A');
  const tree = readFixtureTree(root);
  expect(tree.copies).toEqual([]);
  expect(tree.allowed.map(({ path }) => path)).toEqual([boundCopy.path]);
  expect(tree.links.map(({ path }) => path).sort()).toEqual(
    [dodge, otherDodge, patrol].sort(),
  );
  expect(tree.linkProblems).toEqual([]);
});

it('links one batch folder with a directory, by name or by path', async () => {
  const root = await checkout();

  expect(linkPinnedCopies(root, { dir: 'feats-2' }).linked).toEqual([
    otherDodge,
  ]);
  expect((await lstat(join(root, dodge))).isFile()).toBe(true);
  expect(
    linkPinnedCopies(root, { dir: 'tests/fixtures/feats-1' }).linked,
  ).toEqual([dodge, patrol]);
});

it('is idempotent: a second run, before or after staging, links nothing', async () => {
  const root = await checkout();
  linkPinnedCopies(root, {});

  expect(linkPinnedCopies(root, {})).toEqual({
    linked: [],
    pending: [],
    already: [dodge, patrol, otherDodge],
  });
  git(root, 'add', '-A');
  expect(linkPinnedCopies(root, {})).toEqual({
    linked: [],
    pending: [],
    already: [],
  });
});

it('only reports the copies left to link with check, writing nothing', async () => {
  const root = await checkout();

  expect(linkPinnedCopies(root, { check: true })).toEqual({
    linked: [],
    pending: [dodge, patrol, otherDodge],
    already: [],
  });
  expect((await lstat(join(root, dodge))).isFile()).toBe(true);
});

it('refuses a pinned store that differs from the index, linking nothing', async () => {
  const root = await checkout();
  await writeFile(
    join(root, 'tests/fixtures/pinned/pf1/packs/feats/dodge.yaml'),
    'name: Edited\n',
  );

  expect(() => linkPinnedCopies(root, {})).toThrow(
    /tests\/fixtures\/pinned\/pf1\/packs\/feats\/dodge\.yaml/,
  );
  expect((await lstat(join(root, patrol))).isFile()).toBe(true);
});

it('refuses a copy whose bytes no longer equal its pinned file, linking nothing', async () => {
  const root = await checkout();
  await writeFile(join(root, otherDodge), 'name: Dodge, edited\n');

  expect(() => linkPinnedCopies(root, {})).toThrow(
    /feats-2\/pf1\/packs\/feats\/dodge\.yaml/,
  );
  expect((await lstat(join(root, dodge))).isFile()).toBe(true);
});

it('refuses a directory outside the batches or without tracked files', async () => {
  const root = await checkout();

  expect(() => linkPinnedCopies(root, { dir: 'pinned' })).toThrow(/batch/);
  expect(() => linkPinnedCopies(root, { dir: 'feats-9' })).toThrow(/batch/);
  expect(() => linkPinnedCopies(root, { dir: '../feats-1' })).toThrow(/batch/);
});

it('exits 1 from check while copies remain, 0 once they are linked, and 2 on a bad argument', async () => {
  const root = await checkout();

  expect(cli(['--check'], root)).toMatchObject({ code: 1 });
  expect(cli([], root)).toMatchObject({ code: 0 });
  expect(cli(['--check'], root)).toMatchObject({ code: 0 });
  expect(cli(['--dir'], root)).toMatchObject({ code: 2 });
  expect(cli(['--force'], root)).toMatchObject({ code: 2 });
});
