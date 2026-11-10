// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it } from 'vitest';
import { runCapturedProcess } from '../../scripts/catalog/process';
import { mergeAppendOnlyTable } from '../../scripts/catalog/table-merge';

const temporary: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporary
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

const replacements = 'scripts/catalog/reviewed-change-replacements.ts';
const bindings = 'tests/catalog/cross-batch-bindings.ts';

/**
 * Real versions of the two tables, recovered with `git show <commit>:<path>`:
 * eddbefa1 (#399, the base both #400 and #549 started from), 21babb10 (#430),
 * a4ba996b (#400 as landed), 3a253efd (#549 before its rebase) and 468026e3
 * (#549 after its hand-resolved rebase onto #400). #400's own commit before
 * its rebase is gone, so 400-before-rebase is eddbefa1 plus the rows #400
 * added (git diff 21babb10 a4ba996b).
 */
const version = (table: string, name: string) =>
  readFile(
    join('tests/fixtures/catalog-table-merge', table, `${name}.txt`),
    'utf8',
  );

it('unions #400 and #430 into the replacements table #400 landed with', async () => {
  const table = 'reviewed-change-replacements';
  const result = await mergeAppendOnlyTable({
    path: replacements,
    base: await version(table, 'eddbefa1'),
    ours: await version(table, '21babb10'),
    theirs: await version(table, '400-before-rebase'),
  });
  expect(result.conflicts).toEqual([]);
  expect(result.text).toBe(await version(table, 'a4ba996b'));
});

it('unions #549 into both tables as its hand-resolved rebase onto #400 did', async () => {
  for (const [table, path] of [
    ['reviewed-change-replacements', replacements],
    // #549 also extended the reason of a base row #400 left unchanged.
    ['cross-batch-bindings', bindings],
  ] as const) {
    const result = await mergeAppendOnlyTable({
      path,
      base: await version(table, 'eddbefa1'),
      ours: await version(table, 'a4ba996b'),
      theirs: await version(table, '3a253efd'),
    });
    expect(result.conflicts).toEqual([]);
    expect(result.text).toBe(await version(table, '468026e3'));
  }
});

it('leaves a row changed on both sides, a removed row and a change outside the table unresolved', async () => {
  const table = 'cross-batch-bindings';
  const [base, ours, theirs] = await Promise.all(
    ['eddbefa1', 'a4ba996b', '3a253efd'].map((name) => version(table, name)),
  );
  const merge = (sides: { ours?: string; theirs?: string }) =>
    mergeAppendOnlyTable({
      path: bindings,
      base,
      ours: sides.ours ?? ours!,
      theirs: sides.theirs ?? theirs!,
    });
  const elementalAssault =
    'danglingCatalogLinks row Compendium.pf-content.pf-racial-traits.Item.UsBkDqNJ8C119TCb';
  // #549 extends this reason; here ours extends it too, differently.
  const changed = await merge({
    ours: ours!.replace(
      '(#548) link it.',
      '(#548) and (Sonic, Race Builder) (#550) link it.',
    ),
  });
  expect(changed).toEqual({
    conflicts: [`${elementalAssault}: changed differently by ours and theirs.`],
  });
  const removed = await merge({
    ours: ours!.replace(
      /\n {2}\{\n {4}uuid: 'Compendium\.pf-content\.pf-items\.Item\.Zf3UVfrbf2UPJ9ZC',\n[^}]*\},/,
      '',
    ),
  });
  expect(removed).toEqual({
    conflicts: [
      'danglingCatalogLinks row Compendium.pf-content.pf-items.Item.Zf3UVfrbf2UPJ9ZC: removed by ours.',
    ],
  });
  const outside = await merge({
    theirs: theirs!.replace(
      'const dangling = new Set(',
      'const danglingUuids = new Set(',
    ),
  });
  expect(outside).toEqual({
    conflicts: [`theirs changed ${bindings} outside danglingCatalogLinks.`],
  });
});

function git(cwd: string, ...args: string[]) {
  return spawnSync(
    'git',
    [
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      '-c',
      'commit.gpgsign=false',
      ...args,
    ],
    { cwd, encoding: 'utf8', env: { ...process.env, GIT_EDITOR: 'true' } },
  );
}

it('merges both tables while #549 rebases onto #400, and stops on a row both changed', async () => {
  const root = await mkdtemp(join(tmpdir(), 'catalog-table-merge-'));
  temporary.push(root);
  const checkout = async (name: string, edit = (text: string) => text) => {
    for (const [table, path] of [
      ['reviewed-change-replacements', replacements],
      ['cross-batch-bindings', bindings],
    ] as const) {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), edit(await version(table, name)));
    }
  };
  const merge = () =>
    runCapturedProcess({
      command: process.execPath,
      args: [
        '--import',
        fileURLToPath(import.meta.resolve('tsx')),
        resolve('scripts/catalog-merge.ts'),
      ],
      cwd: root,
    });
  expect(git(root, 'init', '-q', '-b', 'main').status).toBe(0);
  await checkout('eddbefa1');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'batch 399');
  git(root, 'checkout', '-q', '-b', 'cur/549');
  await checkout('3a253efd');
  git(root, 'commit', '-q', '-am', 'batch 549');
  git(root, 'checkout', '-q', 'main');
  await checkout('a4ba996b');
  git(root, 'commit', '-q', '-am', 'batch 400');
  git(root, 'checkout', '-q', 'cur/549');
  expect(git(root, 'rebase', 'main').status).not.toBe(0);

  const resolved = merge();
  expect(resolved.stderr).toBe('');
  expect(resolved.status).toBe(0);
  expect(resolved.stdout).toBe(`Merged ${replacements}\nMerged ${bindings}\n`);
  expect(await readFile(join(root, replacements), 'utf8')).toBe(
    await version('reviewed-change-replacements', '468026e3'),
  );
  expect(await readFile(join(root, bindings), 'utf8')).toBe(
    await version('cross-batch-bindings', '468026e3'),
  );
  git(root, 'add', '.');
  // The whole result, so a failure shows Git's output.
  expect(git(root, 'rebase', '--continue')).toMatchObject({ status: 0 });

  // A later batch from #400 extends the same reason #549 extended.
  git(root, 'checkout', '-q', '-b', 'cur/550', 'main');
  await checkout('a4ba996b', (text) =>
    text.replace(
      '(#548) link it.',
      '(#548) and (Sonic, Race Builder) (#550) link it.',
    ),
  );
  git(root, 'commit', '-q', '-am', 'batch 550');
  expect(git(root, 'rebase', 'cur/549').status).not.toBe(0);
  const conflicted = await readFile(join(root, bindings), 'utf8');
  const refused = merge();
  expect(refused.status).toBe(1);
  expect(refused.stdout).toBe('');
  expect(refused.stderr).toContain(
    `${bindings}:\n  danglingCatalogLinks row Compendium.pf-content.pf-racial-traits.Item.UsBkDqNJ8C119TCb: changed differently by ours and theirs.`,
  );
  expect(await readFile(join(root, bindings), 'utf8')).toBe(conflicted);
  git(root, 'rebase', '--abort');
}, 60_000);
