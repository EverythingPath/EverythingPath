// @vitest-environment node
import { readFile, readdir, writeFile } from 'node:fs/promises';
import type * as NodeOs from 'node:os';
import { basename, dirname, join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { z } from 'zod';
import type { runT3ReviewCodeMode } from '../../scripts/catalog/t3-review-code-mode';
import { afterEach, expect, expectTypeOf, it, vi } from 'vitest';
import { captureT3Inputs } from '../../scripts/catalog/t3-review-evidence';
import type { requireTemporaryDirectoryOutside } from '../../scripts/catalog/t3-review-evidence';
import {
  cleanUp,
  completeRound,
  fixture,
  repoRoot,
  scratch,
  seen,
  slow,
  snapshot,
} from './t3-review-harness';

/**
 * Round commands as processes: every documented round command and every
 * bridge action declines a TMPDIR that is, is inside or contains its round or
 * the directory holding it; the launcher and tsx alone start them alike; the
 * emitted code-mode source, the shell's quoting of a round's path, and the
 * completion bridge's bounded report read. These run the real bridge and
 * record step; the TMPDIR rule's variations run in this process (the rule
 * itself, and the bridge's actions through t3-bridge-in-process.ts), as do the
 * documentation runner's classifier cases.
 */
/**
 * The system temporary directory as this process reads it: as node reads it,
 * unless a test sets `later`, when every read in a bridge action after its
 * first gives `later` (`reads` counts an action's reads; the test resets it).
 */
const temporaryReads = vi.hoisted(() => ({
  reads: 0,
  later: undefined as string | undefined,
}));
vi.mock('node:os', async (importOriginal) => {
  const os = await importOriginal<typeof NodeOs>();
  const tmpdir = () => {
    const read = os.tmpdir();
    temporaryReads.reads++;
    return temporaryReads.later !== undefined && temporaryReads.reads > 1
      ? temporaryReads.later
      : read;
  };
  return { ...os, default: { ...os, tmpdir }, tmpdir };
});
// The tests that run real bridge processes take the limit CI gives them,
// locally too (each start is a node process under tsx).
vi.setConfig({ testTimeout: slow });
afterEach(cleanUp);
// Fix r6, Spec 3, fix r9, Standards 2, and fix r10, both axes: the system
// temporary directory can be the round bind operates on, inside it or contain
// it, or be the directory holding the round (the runs directory), inside it
// (another round there) or contain it. Bind then declines before it creates a
// transport directory, naming the variable, and nothing in or around the round
// changes, the other round's full listing included (the bridge runs tsx with
// its disk cache off, so tsx writes nothing there either). Nothing is inferred
// from file names: a completed round kept elsewhere, outside the directory
// holding this one, is not refused, and the transport directory made there is
// removed.
it.each([
  { where: 'the round', declined: "this round's directory" },
  { where: 'a subdirectory of the round', declined: "this round's directory" },
  { where: "the round's parent", declined: "this round's directory" },
  { where: "the round's grandparent", declined: "this round's directory" },
  {
    where: 'another completed round beside it',
    declined: 'the directory holding this round',
  },
  { where: 'a completed round kept elsewhere', declined: undefined },
])(
  'binds or declines with TMPDIR at $where (declined: $declined)',
  async ({ where, declined }) => {
    const { root, dir, config } = await fixture();
    const { mkdir } = await import('node:fs/promises');
    const { syntheticTools, syntheticDirectReturn, syntheticStatus } =
      await import('./t3-code-mode-fixture');
    const own = syntheticDirectReturn(syntheticStatus());
    let tmp = dir;
    if (where === 'a subdirectory of the round') {
      tmp = join(dir, 'tmp');
      await mkdir(tmp);
    }
    if (where === "the round's parent") tmp = root;
    if (where === "the round's grandparent") tmp = dirname(root);
    if (where.includes('completed round')) {
      tmp = join(where.includes('beside') ? root : await scratch(), 'other');
      await captureT3Inputs({
        dir: tmp,
        reviewedCommit: 'c'.repeat(40),
        seen,
        caller: { threadId: 'synthetic:parent' },
        config,
      });
      await (await syntheticTools({ dir: tmp })).execute('dispatch');
      await completeRound({ root: dirname(tmp), dir: tmp });
    }
    // The other round beside it is in the round's parent's listing.
    const before = await snapshot(root);
    // Only another round's listing: the grandparent is the test's TMPDIR.
    const other = declined ? undefined : await snapshot(tmp);
    // The rule once through the real bridge, with the process's own TMPDIR.
    const world = await syntheticTools({
      dir,
      tmp,
      bridge: where === 'the round' ? 'process' : 'in-process',
    });
    if (declined) {
      const what = declined.includes('holding') ? root : dir;
      await expect(world.bind(own)).rejects.toThrow(
        `The system temporary directory (TMPDIR, ${tmp}) is ${declined} (${what}), inside it or contains it; nothing done.`,
      );
      expect(await snapshot(root)).toEqual(before);
      // With TMPDIR elsewhere the same return binds.
      await expect(
        (
          await syntheticTools({ dir, tmp: await scratch('t3-transport-') })
        ).bind(own),
      ).resolves.toEqual({ bound: true });
    } else {
      await expect(world.bind(own)).resolves.toEqual({ bound: true });
      expect(await snapshot(tmp)).toEqual(other);
    }
  },
  slow,
);
// Fix r10, both axes: the rule itself, in this process, by real path. A round
// scope protects the round and the directory holding it (by the round's real
// path and by the path given); an archives scope protects each archive, the
// runs directory and the directory holding each archive. A directory elsewhere,
// or a link to one, is accepted. Fix r11, both axes: TMPDIR, the round and the
// runs directory are each resolved once, by the file system (a link before a
// `..` is followed first), and the check gives back what it resolved, which
// is what the command then uses.
it('declines a TMPDIR at, inside or containing a round or the directory holding it, by real path, and accepts one elsewhere', async () => {
  const { mkdir, symlink } = await import('node:fs/promises');
  const { requireTemporaryDirectoryOutside } =
    await import('../../scripts/catalog/t3-review-evidence');
  const base = await scratch();
  const runs = join(base, 'runs');
  const round = join(runs, 'round');
  const sibling = join(runs, 'sibling');
  const elsewhere = join(base, 'elsewhere');
  const linked = join(base, 'linked');
  for (const path of [
    join(round, 'x'),
    join(sibling, 'tmp'),
    join(elsewhere, 'nested'),
    join(elsewhere, 'completed'),
    linked,
  ])
    await mkdir(path, { recursive: true });
  // A link elsewhere to the sibling round; another to the runs directory; a
  // link in the runs directory to a directory elsewhere (the reviewers' case).
  await symlink(sibling, join(elsewhere, 'to-sibling'));
  await symlink(runs, join(linked, 'runs'));
  await symlink(join(elsewhere, 'nested'), join(runs, 'link'));
  // Fix r13, standards 1: a round given as an entry in the runs directory that
  // links to a directory kept elsewhere: the directory holding the entry as
  // given (where its sibling rounds are) and the one holding its target are
  // both protected.
  const kept = join(base, 'kept');
  await mkdir(join(kept, 'target'), { recursive: true });
  await mkdir(join(kept, 'other'));
  await symlink(join(kept, 'target'), join(runs, 'entry'));
  const entryScope = { kind: 'round' as const, round: join(runs, 'entry') };
  // Written out, not joined: join would collapse `link/..` as text.
  const through = (link: string, rest: string) => `${link}/../${rest}`;
  const roundScope = { kind: 'round' as const, round };
  const archives = { kind: 'archives' as const, runs, runIds: ['round'] };
  const cases = [
    { scope: roundScope, tmp: round, hit: `this round's directory (${round})` },
    {
      scope: roundScope,
      tmp: base,
      hit: `this round's directory (${round})`,
    },
    {
      scope: roundScope,
      tmp: sibling,
      hit: `the directory holding this round (${runs})`,
    },
    {
      scope: roundScope,
      tmp: join(elsewhere, 'to-sibling'),
      at: sibling,
      hit: `the directory holding this round (${runs})`,
    },
    // A link into the runs directory, then `..`: the sibling, by the file
    // system (as text, a directory elsewhere that does not exist).
    {
      scope: roundScope,
      tmp: through(join(elsewhere, 'to-sibling'), 'sibling'),
      at: sibling,
      hit: `the directory holding this round (${runs})`,
    },
    // The round given through a link: the directory holding its real path.
    {
      scope: { kind: 'round' as const, round: join(linked, 'runs', 'round') },
      tmp: join(sibling, 'tmp'),
      hit: `the directory holding this round (${runs})`,
    },
    // The round given through a link, then `..` (the bridge's capture has a
    // new round): by the file system, in the runs directory.
    ...['round', 'fresh'].map((name) => ({
      scope: {
        kind: 'round' as const,
        round: through(join(elsewhere, 'to-sibling'), name),
      },
      tmp: join(sibling, 'tmp'),
      hit: `the directory holding this round (${runs})`,
    })),
    {
      scope: entryScope,
      tmp: join(sibling, 'tmp'),
      hit: `the directory holding this round as given (${runs})`,
    },
    {
      scope: entryScope,
      tmp: join(kept, 'other'),
      hit: `the directory holding this round (${kept})`,
    },
    {
      scope: entryScope,
      tmp: elsewhere,
      resolved: { temporary: elsewhere, directory: join(kept, 'target') },
    },
    {
      scope: roundScope,
      tmp: elsewhere,
      resolved: { temporary: elsewhere, directory: round },
    },
    // The reviewers' case: through the link in the runs directory, then `..`,
    // TMPDIR is a directory elsewhere, which the command then uses.
    {
      scope: roundScope,
      tmp: through(join(runs, 'link'), 'completed'),
      resolved: { temporary: join(elsewhere, 'completed'), directory: round },
    },
    {
      scope: { kind: 'round' as const, round: join(linked, 'runs', 'fresh') },
      tmp: elsewhere,
      resolved: { temporary: elsewhere, directory: join(runs, 'fresh') },
    },
    {
      scope: archives,
      tmp: join(round, 'x'),
      hit: `an archive this verifies (${round})`,
    },
    {
      scope: archives,
      tmp: sibling,
      hit: `the runs directory this verifies (${runs})`,
    },
    {
      scope: { ...archives, runIds: [] },
      tmp: runs,
      hit: `the runs directory this verifies (${runs})`,
    },
    {
      scope: { ...archives, runs: through(join(linked, 'runs'), 'runs') },
      tmp: sibling,
      hit: `the runs directory this verifies (${runs})`,
    },
    {
      scope: archives,
      tmp: elsewhere,
      resolved: { temporary: elsewhere, directory: runs },
    },
    {
      scope: { ...archives, runs: join(linked, 'runs') },
      tmp: elsewhere,
      resolved: { temporary: elsewhere, directory: runs },
    },
  ];
  try {
    for (const { scope, tmp, at = tmp, hit, resolved } of cases) {
      vi.stubEnv('TMPDIR', tmp);
      const checked = requireTemporaryDirectoryOutside(scope, 'retry');
      if (hit === undefined)
        await expect(checked, tmp).resolves.toEqual(resolved);
      else
        await expect(checked, tmp).rejects.toThrow(
          `The system temporary directory (TMPDIR, ${at}) is ${hit}, inside it or contains it; nothing done.`,
        );
    }
  } finally {
    vi.unstubAllEnvs();
  }
});
// Fix r11, both axes: bind makes its transport directories under TMPDIR's
// real path, the one the check accepted. In the reviewers' case (TMPDIR
// through a link in the runs directory to a directory elsewhere, then `..`)
// that is the directory elsewhere, and the completed round beside this one,
// the name the value reads as text, keeps its full listing and its own
// modification time; an ordinary link elsewhere is followed the same way.
it.each([
  { where: 'the reviewers’ link-then-`..` case', completedSibling: true },
  { where: 'a link elsewhere', completedSibling: false },
])(
  'makes the transport directories under the real path of TMPDIR given as $where',
  async ({ completedSibling }) => {
    const { root, dir, config } = await fixture();
    const { mkdir, realpath, stat, symlink } = await import('node:fs/promises');
    const { syntheticTools, syntheticDirectReturn, syntheticStatus } =
      await import('./t3-code-mode-fixture');
    const elsewhere = await realpath(await scratch());
    let tmp = join(elsewhere, 'link');
    let real = join(elsewhere, 'target');
    await mkdir(real);
    await symlink(real, tmp);
    const sibling = join(root, 'completed');
    if (completedSibling) {
      await mkdir(join(elsewhere, 'nested'));
      real = join(elsewhere, 'completed');
      await mkdir(real);
      await symlink(join(elsewhere, 'nested'), join(root, 'link'));
      tmp = `${root}/link/../completed`;
      await captureT3Inputs({
        dir: sibling,
        reviewedCommit: 'c'.repeat(40),
        seen,
        caller: { threadId: 'synthetic:parent' },
        config,
      });
      await (await syntheticTools({ dir: sibling })).execute('dispatch');
      await completeRound({ root, dir: sibling });
    }
    const untouched = async () =>
      completedSibling
        ? {
            listing: await snapshot(sibling),
            mtimeNs: (await stat(sibling, { bigint: true })).mtimeNs,
          }
        : undefined;
    const before = await untouched();
    const outputs: string[] = [];
    const world = await syntheticTools({
      dir,
      tmp,
      mutateExec: async (_args, run) => {
        const ran = await run();
        outputs.push(ran.output);
        return ran;
      },
    });
    await expect(
      world.bind(syntheticDirectReturn(syntheticStatus())),
    ).resolves.toEqual({ bound: true });
    // Each bridge call's output: a JSON line, or its message when it fails.
    const made = outputs.flatMap((output) => {
      const parsed = z
        .object({ offer: z.string(), evidence: z.string() })
        .partial()
        .safeParse(output.startsWith('{') ? JSON.parse(output) : undefined);
      const { offer, evidence } = parsed.success ? parsed.data : {};
      return [offer, evidence].filter((path) => path !== undefined);
    });
    expect(made).toHaveLength(2);
    for (const path of made) {
      expect(dirname(path)).toBe(real);
      expect(basename(path)).toMatch(/^t3-review-transport-[A-Za-z0-9]{6}$/);
    }
    expect(await untouched()).toEqual(before);
  },
  slow,
);
// Fix r12, both axes: each bridge action reads TMPDIR once, at its entry
// check, and makes, reads and removes its transport directories under the
// directory that check accepted: a later reading of TMPDIR in the same action
// (here, another accepted directory) is never consulted, so bind's staged
// return and evidence are made in, read from and removed from the first.
it('makes, reads and removes the transport directories under the TMPDIR each bridge action checked first', async () => {
  const { dir } = await fixture();
  const { readdir, realpath } = await import('node:fs/promises');
  const { syntheticTools, syntheticDirectReturn, syntheticStatus } =
    await import('./t3-code-mode-fixture');
  const first = await realpath(await scratch('t3-transport-'));
  const later = await realpath(await scratch('t3-transport-'));
  const outputs: string[] = [];
  const world = await syntheticTools({
    dir,
    tmp: first,
    mutateExec: async (_args, run) => {
      temporaryReads.reads = 0;
      const ran = await run();
      outputs.push(ran.output);
      return ran;
    },
  });
  temporaryReads.later = later;
  try {
    await expect(
      world.bind(syntheticDirectReturn(syntheticStatus())),
    ).resolves.toEqual({ bound: true });
  } finally {
    temporaryReads.later = undefined;
  }
  const made = outputs.flatMap((output) => {
    const parsed = z
      .object({ offer: z.string(), evidence: z.string() })
      .partial()
      .safeParse(output.startsWith('{') ? JSON.parse(output) : undefined);
    const { offer, evidence } = parsed.success ? parsed.data : {};
    return [offer, evidence].filter((path) => path !== undefined);
  });
  expect(made).toHaveLength(2);
  for (const path of made) expect(dirname(path)).toBe(first);
  // Publish read both and removed both, where they were made.
  expect(await readdir(first)).toEqual([]);
  expect(await readdir(later)).toEqual([]);
});
const launcher = 'scripts/catalog/start-without-tsx-cache.mjs';
/**
 * Where a documented line names the bridge or the record step, and how:
 * `command`, a round command it starts (the bridge, or the record step with
 * --capture-t3, --bind-t3, --complete-t3, --t3-run or --verify); `other`, a
 * command it starts with no round action; `reference`, a name that nothing
 * before it in its code starts (prose, or code beginning with the name).
 */
type Documented = {
  source: string;
  line: number;
  kind: 'command' | 'other' | 'reference';
  command: string;
};
/** Any name of either entry point: its path or file name, .ts or .mjs. */
const entryName = /(?:catalog-record-review|t3-review-bridge)\.[cm]?[jt]s\b/g;
const roundAction = /--(?:capture-t3|bind-t3|complete-t3|t3-run|verify)\b/;
/** The span from `from` to the next `close` at or after `at`, or the line's end. */
function spanTo(
  line: string,
  { from, close, at }: { from: number; close: string; at: number },
) {
  const end = line.indexOf(close, at);
  return { from, to: end < 0 ? line.length : end };
}
/** In prose, the inline code span holding `at`, else none (prose names). */
function inlineCodeAround(line: string, at: number) {
  const ticks = [...line.slice(0, at)].filter((c) => c === '`').length;
  return ticks % 2 === 0
    ? undefined
    : spanTo(line, { from: line.lastIndexOf('`', at) + 1, close: '`', at });
}
/**
 * In a code block, the quoted string holding the name from `at` to `end` when
 * it holds more than the path that ends with the name (a command handed as a
 * string, as to bash -c); else, the name unquoted or a quoted path, spaces and
 * all (`node "/a b/scripts/x.ts" --verify`), the whole line.
 */
function blockCodeAround(line: string, at: number, end: number) {
  let quote: { char: string; from: number } | undefined;
  for (const [index, char] of [...line.slice(0, at)].entries())
    if (quote === undefined && (char === "'" || char === '"'))
      quote = { char, from: index };
    else if (char === quote?.char) quote = undefined;
  const whole = { from: 0, to: line.length };
  if (quote === undefined) return whole;
  const quoted = spanTo(line, { from: quote.from + 1, close: quote.char, at });
  const path =
    quoted.to === end || !/\s/.test(line.slice(quoted.from, quoted.to));
  return path ? whole : quoted;
}
/**
 * TEXT's lines with their 1-based numbers, each marked as in a code block or
 * not; the fences themselves are left out, and a block line ending in a
 * backslash continues on the next. `code` reads all of TEXT as one block.
 */
function textLines(text: string, code: boolean) {
  const lines = text.split('\n');
  const read: { line: string; number: number; block: boolean }[] = [];
  let block = code;
  for (let index = 0; index < lines.length; index++) {
    const number = index + 1;
    let line = lines[index] ?? '';
    if (!code && /^\s*(?:```|~~~)/.test(line)) {
      block = !block;
      continue;
    }
    while (block && line.endsWith('\\') && index + 1 < lines.length)
      line = `${line.slice(0, -1)} ${(lines[++index] ?? '').trim()}`;
    read.push({ line, number, block });
  }
  return read;
}
/**
 * One name of an entry point at `at` on `line`, classified by the code around
 * it: the code before the name (from the start of its word) is its launcher,
 * the code after it its arguments.
 */
function classifyName(
  line: string,
  { at, name, block }: { at: number; name: string; block: boolean },
) {
  let start = at;
  while (start > 0 && !/[\s`'"]/.test(line[start - 1] ?? '')) start--;
  const around = block
    ? blockCodeAround(line, start, at + name.length)
    : inlineCodeAround(line, start);
  if (around === undefined)
    return { kind: 'reference' as const, command: name };
  const command = line.slice(around.from, around.to).trim();
  if (line.slice(around.from, start).trim() === '')
    return { kind: 'reference' as const, command };
  const round =
    name.startsWith('t3-review-bridge') ||
    roundAction.test(line.slice(start, around.to));
  return { kind: round ? ('command' as const) : ('other' as const), command };
}
/**
 * Every place TEXT names the bridge or the record step, however it is
 * launched: each name of either entry point (`entryName`), wherever it stands
 * (`textLines`), classified by the code around it (`classifyName`): in a code
 * block, the quoted string holding it or else the whole line; in prose, the
 * inline code span holding it or else nothing. `code` reads all of TEXT as one
 * code block (the CLI help, a package script).
 */
function documentedNames(
  source: string,
  text: string,
  { code = false } = {},
): Documented[] {
  return textLines(text, code).flatMap(({ line, number, block }) =>
    [...line.matchAll(entryName)].map((match) => ({
      source,
      line: number,
      ...classifyName(line, { at: match.index, name: match[0], block }),
    })),
  );
}
/**
 * The one documented way to start a round command (pnpm exec may run it; either
 * path may be a quoted word of its own).
 */
const launched =
  /^(?:pnpm exec )?node (["']?)scripts\/catalog\/start-without-tsx-cache\.mjs\1 (["']?)scripts\/(?:catalog-record-review|catalog\/t3-review-bridge)\.ts\2(?: |$)/;
// Fix r9, r10 and r11, both axes: how the documentation runner classifies a
// name of either entry point, by the code around it. In prose: outside an
// inline code span, a reference; inside one, that span is the code. In a code
// block: the whole line (continued lines joined), when the name is unquoted or
// is in a quoted path (a quoted word of its own, or a quoted string with
// spaces that ends where the name ends); the quoted string, when the name is
// in one holding more after it (a quoted command). Code that begins with the
// name is a reference; else the bridge, or the record step with a round
// action, is a round command, and the rest other.
it.each([
  {
    where: 'prose',
    text: 'Run catalog-record-review.ts --verify.',
    kind: 'reference',
    command: 'catalog-record-review.ts',
  },
  {
    where: 'a code span',
    text: 'Run `node l.mjs scripts/catalog-record-review.ts --verify`.',
    kind: 'command',
    command: 'node l.mjs scripts/catalog-record-review.ts --verify',
  },
  {
    where: 'a code span beginning with the name',
    text: 'See `scripts/catalog-record-review.ts`.',
    kind: 'reference',
    command: 'scripts/catalog-record-review.ts',
  },
  {
    where: 'a code block',
    text: '```\nnode --import tsx scripts/catalog-record-review.ts --verify\n```',
    kind: 'command',
    command: 'node --import tsx scripts/catalog-record-review.ts --verify',
  },
  {
    where: 'a quoted entry path',
    text: '```\nnode --import tsx "scripts/catalog-record-review.ts" --verify\n```',
    kind: 'command',
    command: 'node --import tsx "scripts/catalog-record-review.ts" --verify',
  },
  {
    where: 'a quoted entry path with a variable',
    text: "```\nnode l.mjs '$WT/scripts/catalog/t3-review-bridge.ts' '{}'\n```",
    kind: 'command',
    command: "node l.mjs '$WT/scripts/catalog/t3-review-bridge.ts' '{}'",
  },
  // Fix r11, both axes: a quoted entry path with spaces is a path, not a
  // command: the quoted string ends where the name ends.
  {
    where: 'a quoted entry path with spaces',
    text: '```\nnode --import tsx "/tmp/Review Checkout/scripts/catalog-record-review.ts" --verify\n```',
    kind: 'command',
    command:
      'node --import tsx "/tmp/Review Checkout/scripts/catalog-record-review.ts" --verify',
  },
  {
    where: 'a single-quoted entry path with spaces',
    text: "```\nnode l.mjs '/a b/scripts/catalog/t3-review-bridge.ts' '{}'\n```",
    kind: 'command',
    command: "node l.mjs '/a b/scripts/catalog/t3-review-bridge.ts' '{}'",
  },
  {
    where: 'a quoted entry path with spaces in a continued line',
    text: '```\nnode l.mjs "/a b/scripts/catalog-record-review.ts" \\\n  --t3-run x\n```',
    kind: 'command',
    command: 'node l.mjs "/a b/scripts/catalog-record-review.ts"  --t3-run x',
  },
  {
    where: 'a quoted command',
    text: "```\nbash -c 'node l.mjs scripts/catalog-record-review.ts --t3-run x'\n```",
    kind: 'command',
    command: 'node l.mjs scripts/catalog-record-review.ts --t3-run x',
  },
  {
    where: 'a continued line',
    text: '```\nnode l.mjs scripts/catalog-record-review.ts \\\n  --verify\n```',
    kind: 'command',
    command: 'node l.mjs scripts/catalog-record-review.ts  --verify',
  },
  {
    where: 'a command with no round action',
    text: '```\nnode l.mjs scripts/catalog-record-review.ts --list\n```',
    kind: 'other',
    command: 'node l.mjs scripts/catalog-record-review.ts --list',
  },
  {
    where: 'a code line beginning with the name',
    text: '```\nscripts/catalog-record-review.ts --verify\n```',
    kind: 'reference',
    command: 'scripts/catalog-record-review.ts --verify',
  },
])('classifies a documented name in $where', ({ text, kind, command }) => {
  expect(
    documentedNames('doc.md', text).map(({ kind, command }) => ({
      kind,
      command,
    })),
  ).toEqual([{ kind, command }]);
});
// Fix r10: a quoted path is the same launch.
it.each([
  'node scripts/catalog/start-without-tsx-cache.mjs scripts/catalog-record-review.ts --verify',
  'pnpm exec node "scripts/catalog/start-without-tsx-cache.mjs" "scripts/catalog-record-review.ts" --verify',
  "node 'scripts/catalog/start-without-tsx-cache.mjs' scripts/catalog/t3-review-bridge.ts '{}'",
])('accepts the launcher form %s', (command) => {
  expect(command).toMatch(launched);
});
const runNode = async (
  args: string[],
  tmp: string,
  {
    env = {},
    cwd = repoRoot,
  }: { env?: Record<string, string | undefined>; cwd?: string } = {},
) => {
  const { execFile } = await import('node:child_process');
  return new Promise<{ failed: boolean; stdout: string; stderr: string }>(
    (resolve) => {
      execFile(
        process.execPath,
        args,
        {
          cwd,
          // tsx's cache switch is absent unless the launcher sets it.
          env: {
            ...process.env,
            TSX_DISABLE_CACHE: undefined,
            TMPDIR: tmp,
            ...env,
          },
          maxBuffer: 1 << 24,
        },
        (error, stdout, stderr) =>
          resolve({ failed: error !== null, stdout, stderr }),
      );
    },
  );
};
/** The decline of a TMPDIR that is, is inside or contains a round. */
const temporaryDeclined = 'The system temporary directory (TMPDIR, ';
/**
 * A completed round archived under a runs directory as a committed T3
 * receipt's run, so it is the round every round command below operates on:
 * --verify of this checkout verifies it among its archives.
 */
async function archivedRound() {
  const { rename } = await import('node:fs/promises');
  const { root, dir: captured, config } = await fixture();
  const { syntheticTools } = await import('./t3-code-mode-fixture');
  await (await syntheticTools({ dir: captured })).execute('dispatch');
  await completeRound({ root, dir: captured });
  const committed = z
    .object({
      receipts: z.array(z.object({ runId: z.string(), evidence: z.unknown() })),
    })
    .parse(
      JSON.parse(
        await readFile(
          join(repoRoot, 'scripts/catalog/review-receipts.json'),
          'utf8',
        ),
      ),
    );
  const runId = committed.receipts.find(
    ({ evidence }) => evidence !== undefined,
  )?.runId;
  if (runId === undefined) throw Error('No committed T3 receipt.');
  const { mkdir } = await import('node:fs/promises');
  await mkdir(join(root, 'runs'));
  const dir = join(root, 'runs', runId);
  await rename(captured, dir);
  return { root, dir, config, runs: join(root, 'runs') };
}
/**
 * Runs each round command as documented, with TMPDIR at a completed round,
 * which is the round every one of them operates on (capture's new directory
 * lies inside it, --verify verifies it): each declines, naming TMPDIR, and
 * leaves the round's full listing unchanged, and a loader of the bridge's
 * code-mode helper gives a helper whose every operation declines the same
 * way. Returns the round actions run.
 */
async function exerciseRoundCommands(commands: Documented[]) {
  const { root, dir, config, runs } = await archivedRound();
  const { syntheticTools, syntheticStatus } =
    await import('./t3-code-mode-fixture');
  const files = await scratch();
  await writeFile(join(files, 'config.json'), JSON.stringify(config));
  await writeFile(
    join(files, 'status.json'),
    JSON.stringify(syntheticStatus()),
  );
  await writeFile(join(files, 'ids.txt'), 'synthetic decision\n');
  const fresh = join(dir, 'new-round');
  // Each placeholder of the help and each shell word of the documents.
  const values: Record<string, string> = {
    '<dir>': dir,
    '<new durable dir>': fresh,
    '<archived dir>': dir,
    '<json>': join(files, 'config.json'),
    '<tool response>': JSON.stringify({ threadId: 'synthetic:parent' }),
    '<delegate_task response json>': join(dir, 'dispatch-return.json'),
    '<task_status response json>': join(files, 'status.json'),
    '<full report>': join(root, 'report.md'),
    '<file>': join(files, 'ids.txt'),
    '$EP_ORCH/runs/$RUN_ID': dir,
    '$EP_ORCH/runs': runs,
    $IDS: join(files, 'ids.txt'),
    $WT: repoRoot,
  };
  // What a placeholder after these options stands for, whatever its name.
  const after: Record<string, string> = { '--root': repoRoot, '--runs': runs };
  const argv = ({ command, source, line }: Documented) => {
    const words =
      command
        .replace(/^pnpm exec /, '')
        .replace(/[[\]]/g, '')
        .match(/<[^>]*>|"[^"]*"|'[^']*'|\S+/g) ?? [];
    return words.map((word, index) => {
      const unquoted = /^(["']).*\1$/.test(word) ? word.slice(1, -1) : word;
      if (!unquoted.startsWith('<') && !unquoted.includes('$')) return unquoted;
      const value = after[words[index - 1] ?? ''] ?? values[unquoted];
      if (value === undefined)
        throw Error(`No value for ${unquoted}: ${source}:${line}: ${command}`);
      return value;
    });
  };
  const before = await snapshot(root);
  const actions: string[] = [];
  for (const documented of commands) {
    const where = `${documented.source}:${documented.line}: ${documented.command}`;
    expect(documented.command, `${where} starts another way`).toMatch(launched);
    const action =
      /--code-mode|--(?:capture|bind|complete)-t3\b|--t3-run\b|--verify\b/.exec(
        documented.command,
      )?.[0];
    expect(action, where).toBeDefined();
    actions.push(action ?? '');
    const [node, ...args] = argv(documented);
    expect(node, where).toBe('node');
    // --verify's default runs directory is the one holding the round.
    const ran = await runNode(args, dir, { env: { EP_ORCH: root } });
    if (action === '--code-mode') {
      expect(ran.failed, `${where}: ${ran.stderr}`).toBe(false);
      // Safe cast: the emitted expression is the checked-in portable helper.
      const run = runInNewContext(ran.stdout, {
        TextEncoder: undefined,
      }) as typeof runT3ReviewCodeMode;
      const { tools } = await syntheticTools({ dir, tmp: dir });
      const context = { tools, root: repoRoot, dir };
      const returned: unknown = JSON.parse(
        await readFile(join(dir, 'dispatch-return.json'), 'utf8'),
      );
      for (const call of [
        () =>
          run({
            ...context,
            dir: fresh,
            operation: 'capture',
            config: join(files, 'config.json'),
          }),
        () => run({ ...context, operation: 'prepare' }),
        () => run({ ...context, operation: 'bind', returned }),
        () =>
          run({
            ...context,
            operation: 'complete',
            report: join(root, 'report.md'),
          }),
      ])
        await expect(call(), where).rejects.toThrow(temporaryDeclined);
    } else {
      expect(ran.failed, where).toBe(true);
      expect(ran.stdout, where).toBe('');
      expect(ran.stderr, where).toContain(temporaryDeclined);
    }
    expect(await snapshot(root), where).toEqual(before);
  }
  return [...new Set(actions)].sort();
}
/**
 * Copies of the repository's Markdown that names the bridge or the record
 * step, which scripts/orchestration/t3-review-commands.test.sh (the workflow
 * suite) hands over: no test of this suite may read a lane-eligible file
 * itself (operations.md, "Light landing lane"), so in the full suite the next
 * test runs the help's commands alone, and the workflow suite checks that the
 * runner read every line of the documents naming either (EP_T3_EXERCISED
 * lists each with how it is classified).
 */
async function documentedInFiles(base: string) {
  const { relative } = await import('node:path');
  const names: Documented[] = [];
  for (const entry of await readdir(base, {
    recursive: true,
    withFileTypes: true,
  }))
    if (entry.isFile() && entry.name.endsWith('.md')) {
      const path = join(entry.parentPath, entry.name);
      names.push(
        ...documentedNames(relative(base, path), await readFile(path, 'utf8')),
      );
    }
  return names.sort(
    (a, b) => a.source.localeCompare(b.source, 'en') || a.line - b.line,
  );
}
// Fix r7, r8 and r9, both axes: every documented round command, however it is
// launched, is the launcher's form and, run as documented with TMPDIR at the
// round it operates on, declines naming TMPDIR and leaves the round
// unchanged. The commands are read from the record step's help, as the CLI
// prints it, from the package scripts, and from the documents when they are
// handed over.
it(
  'runs every round command of the record step help, and of the documents the workflow suite hands over, with TMPDIR at the round it operates on, which declines and leaves the round unchanged',
  async () => {
    const help = await runNode(
      [launcher, 'scripts/catalog-record-review.ts', '--help'],
      await scratch('t3-transport-'),
    );
    expect(help.failed, help.stderr).toBe(false);
    // A package script would be a launch the runner cannot start as written.
    const { scripts } = z
      .object({ scripts: z.record(z.string(), z.string()) })
      .parse(
        JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8')),
      );
    const packaged = Object.entries(scripts).flatMap(([name, script]) =>
      documentedNames(`package.json scripts.${name}`, script, { code: true }),
    );
    expect(
      packaged.filter(({ kind }) => kind !== 'other'),
      'a package script that starts a round command or names one: teach this runner its pnpm form first',
    ).toEqual([]);
    const documents = process.env.EP_T3_DOCUMENTS;
    const documented =
      documents === undefined ? [] : await documentedInFiles(documents);
    const named = [
      ...documentedNames('--help', help.stdout, { code: true }),
      ...documented,
    ];
    const actions = await exerciseRoundCommands(
      named.filter(({ kind }) => kind === 'command'),
    );
    // The help's five round commands, and the runbook's loader when the
    // documents are handed over.
    expect(actions).toEqual([
      '--bind-t3',
      '--capture-t3',
      ...(documents === undefined ? [] : ['--code-mode']),
      '--complete-t3',
      '--t3-run',
      '--verify',
    ]);
    const exercised = process.env.EP_T3_EXERCISED;
    if (exercised)
      await writeFile(
        exercised,
        documented
          .map(({ source, line, kind }) => `${source}:${line} ${kind}\n`)
          .join(''),
      );
  },
  slow,
);
// Fix r9, root's correction of fix r8: a round command started under tsx
// alone, its disk cache on, runs as before; its output and exit status are
// those of the same command through the launcher (tsx's disk cache aside).
it.each([
  ['scripts/catalog/t3-review-bridge.ts', '--code-mode'],
  ['scripts/catalog-record-review.ts', '--bind-t3', 'x', '--dispatch', 'y'],
  ['scripts/catalog-record-review.ts', '--t3-run', 'x', '--ids', 'y'],
  ['scripts/catalog-record-review.ts', '--verify', '--runs', 'no-such-runs'],
])(
  'runs %s under tsx alone, its disk cache on, as through the launcher',
  async (entry, ...args) => {
    const tmp = await scratch('t3-transport-');
    const alone = await runNode(['--import', 'tsx', entry, ...args], tmp);
    const through = await runNode([launcher, entry, ...args], tmp);
    expect(alone).toEqual(through);
    expect(alone.stderr).not.toContain(launcher);
  },
  slow,
);
// Fix r9 and r10, both axes: every round command of the record step
// (--capture-t3, --bind-t3, --complete-t3, --t3-run) and every bridge action
// declines a TMPDIR that is the round it operates on, inside it or contains it
// (capture's round is the new directory it is given), or is inside the
// directory holding it (another round beside it), naming the variable, before
// doing anything, and changes nothing. --verify's cases are in review-receipts-verify.test.ts.
it(
  'declines every round command with TMPDIR at its round, inside it or containing it, naming the variable and changing nothing',
  async () => {
    const { root, dir, config } = await fixture();
    const { mkdir } = await import('node:fs/promises');
    const { syntheticTools, syntheticStatus } =
      await import('./t3-code-mode-fixture');
    await (await syntheticTools({ dir })).execute('dispatch');
    await completeRound({ root, dir });
    const files = await scratch();
    const configPath = join(files, 'config.json');
    await writeFile(configPath, JSON.stringify(config));
    const statusPath = join(files, 'status.json');
    await writeFile(statusPath, JSON.stringify(syntheticStatus()));
    const ids = join(files, 'ids.txt');
    await writeFile(ids, 'synthetic decision\n');
    const fresh = join(dir, 'new-round');
    await mkdir(join(dir, 'tmp'));
    const caller = { threadId: 'synthetic:parent' };
    const returned: unknown = JSON.parse(
      await readFile(join(dir, 'dispatch-return.json'), 'utf8'),
    );
    const record = (...args: string[]) => [
      launcher,
      'scripts/catalog-record-review.ts',
      ...args,
    ];
    const bridge = (args: Record<string, unknown>) => [
      launcher,
      'scripts/catalog/t3-review-bridge.ts',
      JSON.stringify(args),
    ];
    const status = syntheticStatus();
    const commands: { name: string; round: string; args: string[] }[] = [
      {
        name: '--capture-t3',
        round: fresh,
        args: record(
          '--capture-t3',
          fresh,
          '--config',
          configPath,
          '--caller-json',
          JSON.stringify(caller),
          '--root',
          repoRoot,
        ),
      },
      {
        name: '--bind-t3',
        round: dir,
        args: record(
          '--bind-t3',
          dir,
          '--dispatch',
          join(dir, 'dispatch-return.json'),
        ),
      },
      {
        name: '--complete-t3',
        round: dir,
        args: record(
          '--complete-t3',
          dir,
          '--status',
          statusPath,
          '--report',
          join(root, 'report.md'),
        ),
      },
      {
        name: '--t3-run',
        round: dir,
        args: record('--t3-run', dir, '--ids', ids, '--root', repoRoot),
      },
      ...[
        {
          action: 'capture',
          dir: fresh,
          root: repoRoot,
          config: configPath,
          caller,
        },
        { action: 'prepare', dir, caller },
        { action: 'offer', dir, returned },
        { action: 'stage', dir, returned },
        { action: 'check', dir, offer: files, response: status },
        { action: 'discard', dir, offer: files },
        { action: 'next', dir, response: status, observations: [] },
        { action: 'bind', dir, response: status, observations: [] },
        { action: 'publish', dir, offer: files, evidence: files },
        {
          action: 'complete',
          dir,
          response: status,
          report: join(root, 'report.md'),
        },
      ].map((args) => ({
        name: `the bridge's ${args.action}`,
        round: args.dir,
        args: bridge(args),
      })),
    ];
    // Another round beside this one, in the directory holding it.
    const sibling = join(root, 'sibling');
    await mkdir(sibling);
    const before = await snapshot(root);
    // Every command with TMPDIR at its round (capture's new one does not
    // exist yet: at its parent) and at a directory two levels above it; one
    // raw command and one bridge action at every placement, another round
    // beside this one included, since all share one check (each start is a
    // node process under tsx, and this file's CI shard is near its time
    // limit; the rule's variations run in process above).
    const everywhere = new Set(['--t3-run', "the bridge's prepare"]);
    for (const { name, round, args } of commands)
      for (const tmp of everywhere.has(name)
        ? [
            round,
            join(round, 'tmp'),
            dirname(round),
            dirname(dirname(round)),
            sibling,
          ]
        : [round === fresh ? dirname(round) : round, dirname(dirname(round))]) {
        const where = `${name} with TMPDIR at ${tmp}`;
        const ran = await runNode(args, tmp);
        expect(ran.failed, where).toBe(true);
        expect(ran.stdout, where).toBe('');
        expect(ran.stderr, where).toContain(
          tmp === sibling
            ? `${temporaryDeclined}${tmp}) is the directory holding this round (${root}), inside it or contains it; nothing done.`
            : `${temporaryDeclined}${tmp}) is this round's directory (${round}), inside it or contains it; nothing done.`,
        );
        expect(await snapshot(root), where).toEqual(before);
      }
    // A TMPDIR at a completed round kept elsewhere, outside the directory
    // holding this round, is outside the rule: --t3-run goes on to its own
    // checks (this round's reviewed commit is not HEAD).
    const other = join(await scratch(), 'other');
    const { cp } = await import('node:fs/promises');
    await cp(dir, other, { recursive: true });
    const ran = await runNode(commands[3]?.args ?? [], other);
    expect(ran.stderr).not.toContain(temporaryDeclined);
    expect(ran.stderr).toContain(
      'Current HEAD differs from the T3 reviewed commit.',
    );
    expect(await snapshot(root)).toEqual(before);
  },
  slow,
);
// Fix r12, both axes: --verify's default runs directory, $EP_ORCH/runs, is
// resolved by the file system, as an explicit --runs is and as --t3-run's
// documented round $EP_ORCH/runs/$RUN_ID is, so with an EP_ORCH through a link
// and then `..` (the reviewers' value) both commands look at the same runs
// directory: each declines a TMPDIR inside it, naming that directory.
it(
  "resolves --verify's default runs directory as --t3-run resolves its round, for an EP_ORCH through a link and then ..",
  async () => {
    const { mkdir, realpath, symlink } = await import('node:fs/promises');
    const base = await realpath(await scratch());
    const runs = join(base, 'other', 'orch', 'runs');
    await mkdir(join(runs, 'round'), { recursive: true });
    await mkdir(join(runs, 'tmp'));
    await mkdir(join(base, 'other', 'nested'));
    await mkdir(join(base, 'work', 'orch', 'runs'), { recursive: true });
    await symlink(join(base, 'other', 'nested'), join(base, 'work', 'link'));
    // Written out, not joined: join would collapse `link/..` as text.
    const orch = `${base}/work/link/../orch`;
    const ids = join(base, 'ids.txt');
    await writeFile(ids, 'synthetic decision\n');
    const record = (...args: string[]) => [
      launcher,
      'scripts/catalog-record-review.ts',
      ...args,
    ];
    for (const args of [
      record('--verify'),
      record('--t3-run', `${orch}/runs/round`, '--ids', ids),
    ]) {
      const ran = await runNode(args, join(runs, 'tmp'), {
        env: { EP_ORCH: orch },
      });
      expect(ran.failed, args[2]).toBe(true);
      expect(ran.stderr, args[2]).toContain(
        `${temporaryDeclined}${join(runs, 'tmp')}) is the ${args[2] === '--verify' ? 'runs directory this verifies' : 'directory holding this round'} (${runs}), inside it or contains it; nothing done.`,
      );
    }
  },
  slow,
);
// Fix r13, both axes: --verify's default runs directory is the base's for
// every EP_ORCH the base accepts (unset, empty, relative, absolute): the
// base's join($EP_ORCH ?? $root/../ep-orch, 'runs'), from the working
// directory, is the runs directory whose TMPDIR inside it is declined.
it.each([
  { orch: 'unset', value: () => undefined },
  { orch: 'empty', value: () => '' },
  { orch: 'relative', value: () => join('relative', 'orch') },
  { orch: 'absolute', value: (base: string) => join(base, 'absolute', 'orch') },
])(
  "takes --verify's default runs directory as the base does with EP_ORCH $orch",
  async ({ value }) => {
    const { copyFile, mkdir, realpath } = await import('node:fs/promises');
    const { resolve } = await import('node:path');
    const base = await realpath(await scratch());
    const work = join(base, 'work');
    const root = join(work, 'checkout');
    const receipts = 'scripts/catalog/review-receipts.json';
    await mkdir(dirname(join(root, receipts)), { recursive: true });
    await copyFile(join(repoRoot, receipts), join(root, receipts));
    const orch = value(base);
    // The base's expression (0158082f), from the working directory.
    const runs = resolve(
      work,
      join(orch ?? resolve(root, '../ep-orch'), 'runs'),
    );
    await mkdir(join(runs, 'tmp'), { recursive: true });
    const ran = await runNode(
      [
        join(repoRoot, launcher),
        join(repoRoot, 'scripts/catalog-record-review.ts'),
        '--verify',
        '--root',
        root,
      ],
      join(runs, 'tmp'),
      { env: { EP_ORCH: orch }, cwd: work },
    );
    expect(ran.failed).toBe(true);
    expect(ran.stderr).toContain(
      `${temporaryDeclined}${join(runs, 'tmp')}) is the runs directory this verifies (${runs}), inside it or contains it; nothing done.`,
    );
  },
  slow,
);
// Fix r9, Standards 4: the temporary-directory check takes what the command
// operates on, named by its kind.
it('types the temporary-directory scope by its kind', () => {
  type Scope = Parameters<typeof requireTemporaryDirectoryOutside>[0];
  const accepts = (scope: Scope) => scope.kind;
  const check = () => [
    accepts({ kind: 'round', round: 'r' }),
    accepts({ kind: 'archives', runs: 'runs', runIds: ['a'] }),
    // @ts-expect-error the scope is named by its kind
    accepts({ round: 'r' }),
    // @ts-expect-error the scope is named by its kind
    accepts({ runs: 'runs', runIds: [] }),
    // @ts-expect-error a round scope names its round
    accepts({ kind: 'round', runs: 'runs', runIds: [] }),
    // @ts-expect-error an archives scope names its runs and run ids
    accepts({ kind: 'archives', round: 'r' }),
  ];
  expectTypeOf(check).returns.toEqualTypeOf<Scope['kind'][]>();
});
it('executes the emitted code-mode source with injected callable tools', async () => {
  const { dir } = await fixture();
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const { syntheticTools } = await import('./t3-code-mode-fixture');
  const adapter = await syntheticTools({ dir, bridge: 'process' });
  const { stdout } = await promisify(execFile)('node', [
    'scripts/catalog/start-without-tsx-cache.mjs',
    'scripts/catalog/t3-review-bridge.ts',
    '--code-mode',
  ]);
  // Safe cast: the emitted expression is the checked-in portable helper; this test exercises its actual JavaScript emission.
  const emitted = runInNewContext(stdout, {
    TextEncoder: undefined,
  }) as typeof runT3ReviewCodeMode;
  const context = { tools: adapter.tools, root: process.cwd(), dir };
  await expect(emitted({ ...context, operation: 'prepare' })).resolves.toEqual({
    ready: true,
  });
  const returned = await adapter.direct.delegate_task(
    JSON.parse(await readFile(join(dir, 'request.json'), 'utf8')),
  );
  await expect(
    emitted({ ...context, operation: 'bind', returned }),
  ).resolves.toEqual({ bound: true });
  // The emitted source builds its {} in another realm, so compare the bytes sent.
  expect(JSON.stringify(adapter.configures)).toBe('[{},{}]');
  // Only bind takes a return; the emitted JavaScript checks it too.
  for (const operation of ['capture', 'prepare', 'complete'] as const) {
    const args = { ...context, operation, returned };
    // @ts-expect-error called as untyped JavaScript could call it
    await expect(emitted(args)).rejects.toThrow('Only bind takes a dispatch');
  }
});
it('persists literal quotes and shell metacharacters in round paths and task text', async () => {
  const { dir, root } = await fixture({
    prefix: "O'Connor's literal $(printf bad) `printf bad` $HOME. ",
  });
  const { rename } = await import('node:fs/promises');
  const literalDir = join(root, "round ' $(printf bad) `printf bad`");
  await rename(dir, literalDir);
  const { syntheticTools } = await import('./t3-code-mode-fixture');
  // The shell's quoting: only a real bridge command goes through it.
  await (
    await syntheticTools({ dir: literalDir, bridge: 'process' })
  ).execute('dispatch');
  const binding = JSON.parse(
    await readFile(join(literalDir, 'dispatch.json'), 'utf8'),
  );
  expect(binding.original.text).toContain(
    "O'Connor's literal $(printf bad) `printf bad` $HOME.",
  );
});
it('bounds report-file reads in the actual completion bridge before writing outputs', async () => {
  const { dir } = await fixture();
  const { syntheticTools } = await import('./t3-code-mode-fixture');
  const adapter = await syntheticTools({ dir, bridge: 'process' });
  await adapter.execute('dispatch');
  const report = join(dir, 'oversized-report.md');
  await writeFile(report, Buffer.alloc(1000001, 'x'));
  const before = await snapshot(dir);
  await expect(adapter.execute('complete', report)).rejects.toThrow(
    'Review file exceeds',
  );
  expect(await snapshot(dir)).toEqual(before);
});
