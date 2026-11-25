// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import setup, {
  changedStoreFiles,
  checkPinnedStore,
} from './pinned-store-guard';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

const git = (root: string, ...args: string[]) =>
  execFileSync('git', args, { cwd: root, stdio: 'pipe' });

/** A checkout whose store holds two committed files, and a batch file beside it. */
async function checkout() {
  const root = await mkdtemp(join(tmpdir(), 'pinned-store-guard-'));
  roots.push(root);
  await mkdir(join(root, 'tests/fixtures/pinned/pf1'), { recursive: true });
  await mkdir(join(root, 'tests/fixtures/feats-340'), { recursive: true });
  await writeFile(join(root, 'tests/fixtures/pinned/pf1/a.yaml'), 'a: 1\n');
  await writeFile(join(root, 'tests/fixtures/pinned/pf1/b.yaml'), 'b: 1\n');
  await writeFile(join(root, 'tests/fixtures/feats-340/c.json'), '{}\n');
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
    'store',
  );
  return root;
}

it('passes a run that left the store as the index has it, whatever else it changed or added', async () => {
  const root = await checkout();
  await writeFile(join(root, 'tests/fixtures/feats-340/c.json'), '[]\n');
  await writeFile(join(root, 'tests/fixtures/pinned/pf1/new.yaml'), 'n: 1\n');

  expect(changedStoreFiles(root)).toEqual([]);
  expect(() => checkPinnedStore(root)).not.toThrow();
});

it('fails a run that edited or deleted a store file, naming each', async () => {
  const root = await checkout();
  await writeFile(join(root, 'tests/fixtures/pinned/pf1/a.yaml'), 'a: 2\n');
  await unlink(join(root, 'tests/fixtures/pinned/pf1/b.yaml'));

  expect(changedStoreFiles(root)).toEqual([
    'tests/fixtures/pinned/pf1/a.yaml',
    'tests/fixtures/pinned/pf1/b.yaml',
  ]);
  expect(() => checkPinnedStore(root)).toThrow(
    /tests\/fixtures\/pinned\/pf1\/a\.yaml\n.*tests\/fixtures\/pinned\/pf1\/b\.yaml/s,
  );
});

it('returns, as the globalSetup entry, a teardown that checks the project root when the run ends', async () => {
  const root = await checkout();
  const teardown = setup({ config: { root } });
  expect(teardown).not.toThrow();
  await writeFile(join(root, 'tests/fixtures/pinned/pf1/a.yaml'), 'a: 2\n');

  expect(teardown).toThrow(/tests\/fixtures\/pinned\/pf1\/a\.yaml/);
});

it('fails when it cannot ask Git, rather than passing unchecked', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pinned-store-guard-'));
  roots.push(root);

  expect(() => checkPinnedStore(root)).toThrow(/could not check/);
});
