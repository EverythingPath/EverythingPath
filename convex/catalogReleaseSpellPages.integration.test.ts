/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { beforeAll, expect, test } from 'vitest';
import {
  observePaginatedPages,
  refuseRepeatedPaginatedQueries,
} from '../tests/convex-paginated-queries';
import { preloadCalledConvexModules } from '../tests/convex-modules';
import {
  activationArgs,
  allocateReleaseIdentities,
  impactAdapter,
  prepare,
  releaseFixture,
  type ReleaseTest,
} from '../tests/catalog-release-fixture';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import {
  buildWizardSpellbook,
  fillToRows,
  importedSpell,
  readPinnedSpells,
  type PinnedSpell,
} from '../tests/level-twelve-sheets';
import type { ReleaseRow } from '../src/lib/catalog/release-schema';
import { catalogReleaseLimits } from '../src/lib/catalog/release-limits';
import { runCatalogReleaseImpactCommand } from '../scripts/catalog/release-impact-command';
import { documentBoundViolations } from '../tests/catalog/convex-value-bounds';
import type { Id } from './_generated/dataModel';
import { api, internal } from './_generated/api';
import schema from './schema';

// #413 F2: a first Catalog Release stages every Spell, because allocated
// identities carry no bodies (F1). The launch scope holds 1,183 Spells; this
// release holds 1,536. It prepares, reconciles and activates, and every
// Spell browser page reads a bounded page, all under Convex's enforced
// transaction limits (convex-test `transactionLimits: true`).

const modules = import.meta.glob('./**/*.ts');
beforeAll(() => refuseRepeatedPaginatedQueries(schema, modules));
preloadCalledConvexModules({ modules, testFile: import.meta.url });

const spellCount = 1_536;
const wizardSpellCount = 1_280;
const schools = ['abj', 'con', 'div', 'enc', 'evo', 'ill', 'nec', 'trs'];

/** Spell `index`: the first 1,280 on the wizard list, 128 at each level 0–9. */
function pagedSpell(index: number) {
  const key = `pf1/paged-spell-${String(index).padStart(4, '0')}`;
  const levels: Record<string, number> = {
    ...(index < wizardSpellCount ? { wizard: index % 10 } : {}),
    ...(index % 3 === 0 ? { cleric: index % 7 } : {}),
  };
  if (!Object.keys(levels).length) levels.cleric = index % 7;
  return {
    key,
    name: `Paged Spell ${String(index).padStart(4, '0')}`,
    levels,
    school: schools[index % schools.length] ?? 'evo',
  };
}
const spells = Array.from({ length: spellCount }, (_, index) =>
  pagedSpell(index),
);

function spellRow(spell: ReturnType<typeof pagedSpell>): ReleaseRow {
  return {
    kind: 'definition',
    key: spell.key,
    payload: {
      externalKey: spell.key,
      upstreamKey: spell.key,
      pack: 'spells',
      name: spell.name,
      detail: {
        kind: 'spell',
        levels: spell.levels,
        grantedLevels: {},
        school: spell.school,
        subschools: [],
        descriptors: [],
      },
      description: `${spell.name} description.`,
      sources: [{ book: 'PZO1110', pages: '1' }],
      modifiers: [],
      unsupported: [],
    },
  };
}

/**
 * The Wizard's browser index holds every allocated Spell, as rows built from
 * the bodiless identities: no list level, so nothing is offered before the
 * release is selected.
 */
async function indexAllocatedSpells(
  t: ReleaseTest,
  characterId: Id<'character'>,
  castingClassId: Id<'catalogEntry'>,
) {
  for (let offset = 0; offset < spellCount; offset += 256)
    await t.run(async (ctx) => {
      for (const spell of spells.slice(offset, offset + 256)) {
        const identity = await ctx.db
          .query('catalogEntry')
          .withIndex('by_scope_and_ruleIdentity', (q) =>
            q.eq('scope', 'global').eq('ruleIdentity', spell.key),
          )
          .unique();
        if (!identity) throw new Error(`Missing identity ${spell.key}`);
        await ctx.db.insert('spellCatalogIndex', {
          characterId,
          castingClassId,
          catalogEntryId: identity._id,
          ruleIdentity: spell.key,
          name: identity.name,
          level: null,
          school: '',
          levels: {},
          available: false,
          recorded: false,
        });
      }
    });
}

async function releasedWizard() {
  const fixture = await releaseFixture(modules, { transactionLimits: true });
  const { t, owner, scope } = fixture;
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const wizard = sheet?.catalogEntries.find((row) => row.name === 'Wizard');
  const level = sheet?.entries.find((row) => row.kind === 'classLevel');
  if (!wizard || !level) throw new Error('Missing Wizard');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: wizard._id,
    operationId: 'wizard',
  });
  await prepare(t, spells.map(spellRow));
  await allocateReleaseIdentities(t);
  await indexAllocatedSpells(t, scope.characterId, wizard._id);
  const result = await runCatalogReleaseImpactCommand({
    adapter: impactAdapter(t),
    releaseNumber: 1,
    maxSteps: 50_000,
  });
  return { ...fixture, wizard, result };
}

type Owner = Awaited<ReturnType<typeof releaseFixture>>['owner'];
type BrowseFilters = {
  organizationId: string;
  characterId: Id<'character'>;
  castingClassId: Id<'catalogEntry'>;
  spellLevel?: number;
  includeOtherLists?: boolean;
  search?: string;
};

/**
 * Every browser row, page by page to the end. Each call makes progress: its
 * page holds a row, its cursor moves, or it is done (#413 F2 fix r1).
 */
async function readEveryRow(owner: Owner, args: BrowseFilters) {
  const rows: { name: string; ruleIdentity: string }[] = [];
  let cursor: string | null = null;
  for (let call = 0; call < 400; call++) {
    const page: {
      page: { name: string; ruleIdentity: string }[];
      isDone: boolean;
      continueCursor: string;
    } = await owner.query(api.characterSheetSpells.browse, {
      ...args,
      catalogReleaseNumber: 1,
      paginationOpts: { cursor, numItems: 25 },
    });
    expect(page.page.length).toBeLessThanOrEqual(25);
    expect(
      page.page.length > 0 || page.isDone || page.continueCursor !== cursor,
    ).toBe(true);
    rows.push(...page.page);
    if (page.isDone) return rows;
    cursor = page.continueCursor;
  }
  throw new Error('Spell browser did not finish');
}

async function readEveryPage(owner: Owner, args: BrowseFilters) {
  return (await readEveryRow(owner, args)).map((row) => row.name);
}

test('a first release of 1,536 staged Spells reconciles, activates and serves every Spell page within Convex limits', async () => {
  const { t, owner, scope, wizard, result } = await releasedWizard();
  expect(result).toMatchObject({
    stopped: 'ready',
    status: { isReady: true, failedCount: 0 },
  });
  const metadata = await t.run(async (ctx) => {
    const release = await ctx.db
      .query('catalogRelease')
      .withIndex('by_releaseNumber', (q) => q.eq('releaseNumber', 1))
      .unique();
    if (!release) throw new Error('Missing release');
    return (
      await ctx.db
        .query('catalogReleaseSpellIndex')
        .withIndex('by_releaseId_and_classTag_and_name', (q) =>
          q.eq('releaseId', release._id).eq('classTag', '*'),
        )
        .take(spellCount + 1)
    ).length;
  });
  expect(metadata).toBe(spellCount);
  // The Wizard's list and its browser index reach every staged Spell; the
  // list and the Character each name a bounded few and stand for the rest.
  const work = await t.run((ctx) =>
    ctx.db
      .query('catalogImpactWork')
      .withIndex('by_runId_and_characterId', (q) =>
        q.eq('runId', result.runId).eq('characterId', scope.characterId),
      )
      .unique(),
  );
  expect(work?.state).toBe('ready');
  expect(work?.reasons).toEqual(
    expect.arrayContaining([
      'casting:wizard',
      `character:${scope.characterId}`,
    ]),
  );
  expect(work?.reasons?.length).toBeLessThanOrEqual(
    2 * catalogReleaseLimits.listedSpellReasons + 2,
  );
  // convex-test enforces neither the 1 MiB document nor the 8,192-value
  // array limit: every run, work and Spell metadata row stays inside both.
  expect(
    await t.run(async (ctx) => [
      ...(await ctx.db.query('catalogImpactRun').take(8)).flatMap((row) =>
        documentBoundViolations('catalogImpactRun', row),
      ),
      ...(await ctx.db.query('catalogImpactWork').take(64)).flatMap((row) =>
        documentBoundViolations('catalogImpactWork', row),
      ),
      ...(await ctx.db.query('catalogReleaseSpellIndex').take(4_096)).flatMap(
        (row) => documentBoundViolations('catalogReleaseSpellIndex', row),
      ),
    ]),
  ).toEqual([]);
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(result.runId),
  );
  const filters = { ...scope, castingClassId: wizard._id };
  const info = await owner.query(api.characterSheetSpells.browserInfo, {
    ...filters,
    catalogReleaseNumber: 1,
  });
  expect(info).toMatchObject({
    levels: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    schools: [...schools].sort(),
    catalogReleaseNumber: 1,
  });
  let listed = 0;
  for (const level of info.levels) {
    const names = await readEveryPage(owner, {
      ...filters,
      spellLevel: level,
    });
    const expected = spells
      .filter((spell) => spell.levels.wizard === level)
      .map((spell) => spell.name);
    // The prepared sheet's own Spells are not in the release.
    const paged = names.filter((name) => name.startsWith('Paged Spell '));
    expect(new Set(names).size).toBe(names.length);
    expect([...paged].sort()).toEqual([...expected].sort());
    listed += paged.length;
  }
  expect(listed).toBe(wizardSpellCount);
  // Other lists add the Spells off the wizard list, at their lowest level.
  const level3 = await readEveryPage(owner, {
    ...filters,
    spellLevel: 3,
    includeOtherLists: true,
  });
  expect(
    level3.filter((name) => name.startsWith('Paged Spell ')).sort(),
  ).toEqual(
    spells
      .filter((spell) =>
        spell.levels.wizard === undefined
          ? Math.min(...Object.values(spell.levels)) === 3
          : spell.levels.wizard === 3,
      )
      .map((spell) => spell.name)
      .sort(),
  );
  expect(
    await readEveryPage(owner, { ...filters, search: 'Paged Spell 0042' }),
  ).toContain('Paged Spell 0042');
}, 600_000);

/**
 * Pinned Spells a Wizard 12 can record (its list at levels 0 to 6), in file
 * order: the browser's listed phase reads each recorded one.
 */
function pinnedWizardSpells(count: number) {
  const spells = readPinnedSpells().filter(
    (spell) => (spell.levels.wizard ?? 7) <= 6,
  );
  if (spells.length < count)
    throw new Error(`Only ${spells.length} pinned wizard Spells`);
  return spells.slice(0, count);
}

/**
 * A Wizard 12 with `staged` published Spells installed and the first
 * `recorded` recorded, under an activated first release that changes each.
 */
async function releasedSpellbook({
  staged,
  recorded,
  rows,
}: {
  /** A count of recordable Spells, or the Spells themselves, in order. */
  staged: number | readonly PinnedSpell[];
  recorded: number;
  /** Sheet rows to fill to with gear, after the spellbook. */
  rows?: number;
}) {
  const fixture = await releaseFixture(modules, { transactionLimits: true });
  const { t, scope } = fixture;
  const spellbook: readonly PinnedSpell[] =
    typeof staged === 'number' ? pinnedWizardSpells(staged) : staged;
  const { castingClassId } = await buildWizardSpellbook(fixture, scope, {
    spells: spellbook,
    recorded,
  });
  if (rows !== undefined) await fillToRows(t, scope.characterId, rows);
  await prepare(
    t,
    spellbook.map((spell) => ({
      kind: 'definition' as const,
      key: spell.key,
      payload: importedSpell(spell, `${spell.name}, as published.`),
    })),
  );
  await allocateReleaseIdentities(t);
  const result = await runCatalogReleaseImpactCommand({
    adapter: impactAdapter(t),
    releaseNumber: 1,
    maxSteps: 20_000,
  });
  expect(result).toMatchObject({
    stopped: 'ready',
    status: { isReady: true, failedCount: 0 },
  });
  const usage = (
    await t.query(internal.catalogReleaseImpact.evaluate, {
      runId: result.runId,
      characterId: scope.characterId,
    })
  ).usage;
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(result.runId),
  );
  return { ...fixture, castingClassId, spellbook, usage };
}

/** Each of `spells` appears exactly once among `rows`. */
function expectEachOnce(
  rows: readonly { ruleIdentity: string }[],
  spells: readonly PinnedSpell[],
) {
  const keys = new Set(spells.map((spell) => spell.key));
  const shown = rows
    .map((row) => row.ruleIdentity)
    .filter((key) => keys.has(key));
  expect(shown.length).toBe(new Set(shown).size);
  expect(shown.sort()).toEqual([...keys].sort());
}

test('a large recorded spellbook pages through the listed Spells to the end, each Spell once', async () => {
  // The standards r1 case: 160 staged Spells, 130 of them recorded.
  const { owner, scope, castingClassId, spellbook } = await releasedSpellbook({
    staged: 160,
    recorded: 130,
  });
  const filters = { ...scope, castingClassId };
  expectEachOnce(await readEveryRow(owner, filters), spellbook);
  // The level with the most of them, through the level-filtered ranges.
  const atLevel = (level: number) =>
    spellbook.filter((spell) => spell.levels.wizard === level);
  const spellLevel = [0, 1, 2, 3, 4, 5, 6].reduce((best, level) =>
    atLevel(level).length > atLevel(best).length ? level : best,
  );
  expectEachOnce(
    await readEveryRow(owner, { ...filters, spellLevel }),
    atLevel(spellLevel),
  );
}, 600_000);

test('a spellbook at the sheet row limit pages through every recorded Spell within Convex limits', async () => {
  const recorded = 200;
  const { owner, scope, castingClassId, spellbook, usage } =
    await releasedSpellbook({
      staged: recorded + 30,
      recorded,
      rows: catalogReleaseLimits.sheetRows,
    });
  expect(usage?.sheetRows).toBe(catalogReleaseLimits.sheetRows);
  const filters = { ...scope, castingClassId };
  expectEachOnce(await readEveryRow(owner, filters), spellbook);
  const info = await owner.query(api.characterSheetSpells.browserInfo, {
    ...filters,
    catalogReleaseNumber: 1,
  });
  expect(info.levels).toEqual([0, 1, 2, 3, 4, 5, 6]);
}, 600_000);

/** Whether a word of `name` starts with `prefix`, as a one-term search. */
function matchesPrefix(name: string, prefix: string) {
  return name
    .toLowerCase()
    .split(/\s+/)
    .some((word) => word.startsWith(prefix));
}

test('a release search past 256 matches pages to the end, each match once, with a large recorded spellbook', async () => {
  // 335 of the 1,255 pinned published Spells have a word starting with "s",
  // more than a page's 256 release rows. They are staged with the first 130
  // recordable Spells, which are recorded (the standards r1 spellbook).
  const recordable = pinnedWizardSpells(130);
  const keys = new Set(recordable.map((spell) => spell.key));
  const published = [
    ...recordable,
    ...readPinnedSpells().filter(
      (spell) => !keys.has(spell.key) && matchesPrefix(spell.name, 's'),
    ),
  ];
  const matches = published.filter((spell) => matchesPrefix(spell.name, 's'));
  expect(matches.length).toBeGreaterThan(catalogReleaseLimits.spellPageRows);
  const { owner, scope, castingClassId } = await releasedSpellbook({
    staged: published,
    recorded: recordable.length,
  });
  const filters = { ...scope, castingClassId };
  for (const includeOtherLists of [true, false]) {
    // The unsearched browser is the oracle: search shows its matches.
    const browsed = (
      await readEveryRow(owner, { ...filters, includeOtherLists })
    ).filter((row) => matchesPrefix(row.name, 's'));
    const searched = await readEveryRow(owner, {
      ...filters,
      includeOtherLists,
      search: 's',
    });
    const shown = published.filter((spell) =>
      browsed.some((row) => row.ruleIdentity === spell.key),
    );
    expect(shown.length).toBe(browsed.length);
    expectEachOnce(searched, shown);
    if (includeOtherLists) expect(shown).toEqual(matches);
    // Recorded matches are listed once, not again by the search.
    expect(
      searched.filter((row) =>
        recordable.some(
          (spell) =>
            spell.key === row.ruleIdentity && matchesPrefix(spell.name, 's'),
        ),
      ).length,
    ).toBe(recordable.filter((spell) => matchesPrefix(spell.name, 's')).length);
  }
}, 900_000);

/** Each of `spells`' stored definitions holds an 11,200-byte description. */
async function storeLongDescriptions(
  t: ReleaseTest,
  characterId: Id<'character'>,
  spells: readonly PinnedSpell[],
) {
  await t.run(async (ctx) => {
    for (const spell of spells) {
      const stored = await ctx.db
        .query('catalogEntry')
        .withIndex('by_characterId_and_ruleIdentity', (q) =>
          q.eq('characterId', characterId).eq('ruleIdentity', spell.key),
        )
        .unique();
      if (!stored) throw new Error(`Missing ${spell.key}`);
      await ctx.db.patch('catalogEntry', stored._id, {
        description: 'x'.repeat(11_200),
      });
    }
  });
}

type SearchPage = {
  page: { name: string; ruleIdentity: string }[];
  isDone: boolean;
  continueCursor: string;
};

/**
 * The F2 spec r2 probe: 60 published off-list Spells whose stored
 * definitions each hold an 11,200-byte description, searched for `s` on the
 * Wizard's own list beside five on-list matches (`shown`). Each match reads
 * its definition, so a page's byte budget runs out inside one native search
 * page.
 */
async function searchUnderBytePressure() {
  const offList = readPinnedSpells()
    .filter(
      (spell) =>
        spell.levels.wizard === undefined && matchesPrefix(spell.name, 's'),
    )
    .slice(0, 60);
  const onList = readPinnedSpells()
    .filter(
      (spell) =>
        (spell.levels.wizard ?? 7) <= 6 && matchesPrefix(spell.name, 's'),
    )
    .slice(0, 5);
  expect(offList).toHaveLength(60);
  const { t, owner, scope, castingClassId } = await releasedSpellbook({
    staged: [...onList, ...offList],
    recorded: 0,
  });
  await storeLongDescriptions(t, scope.characterId, offList);
  const filters = { ...scope, castingClassId };
  const browsed = (await readEveryRow(owner, filters)).filter((row) =>
    matchesPrefix(row.name, 's'),
  );
  const shown = onList.filter((spell) =>
    browsed.some((row) => row.ruleIdentity === spell.key),
  );
  expect(shown).toHaveLength(onList.length);
  const browse = (
    cursor: string | null,
    endCursor?: string,
    maximumRowsRead?: number,
  ): Promise<SearchPage> =>
    owner.query(api.characterSheetSpells.browse, {
      ...filters,
      search: 's',
      catalogReleaseNumber: 1,
      paginationOpts: { cursor, numItems: 25, endCursor, maximumRowsRead },
    });
  return { browse, offList, shown };
}

test('a release search under byte pressure keeps its progress inside a search page, to the end', async () => {
  // The call stops inside a native search page and the next resumes after
  // the last match it read.
  const { browse, offList, shown } = await searchUnderBytePressure();
  const pages: string[] = [];
  let cursor: string | null = null;
  let calls = 0;
  for (; calls < 40; calls++) {
    const page = await browse(cursor);
    expect(
      page.page.length > 0 || page.isDone || page.continueCursor !== cursor,
    ).toBe(true);
    // A reactive rerun up to the page's end shows the same rows and ends
    // where it did, inside a search page too.
    if (!page.isDone)
      expect(await browse(cursor, page.continueCursor)).toEqual(page);
    pages.push(...page.page.map((row) => row.ruleIdentity));
    if (page.isDone) break;
    cursor = page.continueCursor;
  }
  // 60 definitions of 11,200 bytes, about 11 a call (half a 256,000-byte page).
  expect(calls).toBeGreaterThan(5);
  expectEachOnce(
    pages.map((ruleIdentity) => ({ ruleIdentity })),
    shown,
  );
  expect(pages.some((key) => offList.some((spell) => spell.key === key))).toBe(
    false,
  );
}, 600_000);

/** `cursor` as the Spell browser wrote it before it recorded the page size. */
function withoutPageSize(cursor: string) {
  return cursor.replace(/^(release-search:\d+:\d+)\/\d+:/, '$1:');
}

test('a release search cursor written before the page size was recorded resumes, each Spell once, within the row budget', async () => {
  // Followups-413 fix r2: a browser open across the cursor change holds
  // `release-search:<n>:<skip>:<cursor>` cursors. Each one resumes where it
  // was, as a cursor or as a reactive end, inside the row budget.
  const { browse, offList, shown } = await searchUnderBytePressure();
  const numItems = 25;
  const pageRows: number[] = [];
  const readPages = async (cursor: string | null, endCursor?: string) => {
    pageRows.length = 0;
    const page = await browse(cursor, endCursor);
    // One native page a call, at most the matches the cursor read and a
    // page more, inside the page's row budget.
    expect(pageRows.length).toBeLessThanOrEqual(1);
    const skip = Number(
      /^release-search:\d+:(\d+)/.exec(cursor ?? '')?.[1] ?? 0,
    );
    for (const rows of pageRows) {
      expect(rows).toBeLessThanOrEqual(skip + numItems);
      expect(rows).toBeLessThanOrEqual(catalogReleaseLimits.spellPageRows);
    }
    return page;
  };
  /** Each call's cursor and page, from `cursor` to the end. */
  const walk = async (cursor: string | null) => {
    const calls: { cursor: string | null; page: SearchPage }[] = [];
    for (let call = 0; call < 40; call++) {
      const page = await readPages(cursor);
      expect(
        page.page.length > 0 || page.isDone || page.continueCursor !== cursor,
      ).toBe(true);
      calls.push({ cursor, page });
      if (page.isDone) return calls;
      cursor = page.continueCursor;
    }
    throw new Error('Spell browser did not finish');
  };
  const rowsOf = (calls: readonly { page: SearchPage }[]) =>
    calls.flatMap(({ page }) => page.page);
  const stopObserving = observePaginatedPages((rows) => pageRows.push(rows));
  try {
    const current = await walk(null);
    const written = current.flatMap(({ cursor }) =>
      cursor ? [withoutPageSize(cursor)] : [],
    );
    // The shapes an open browser holds: inside the first native page, inside
    // a later one, and at the start of a later one.
    expect(
      written.some((cursor) => /^release-search:1:[1-9]\d*:$/.test(cursor)),
    ).toBe(true);
    expect(
      written.some((cursor) => /^release-search:1:[1-9]\d*:./.test(cursor)),
    ).toBe(true);
    expect(written.some((cursor) => /^release-search:1:0:./.test(cursor))).toBe(
      true,
    );
    // The first search cursor resumes the whole search.
    expectEachOnce(rowsOf(await walk('release-search:1:0:')), shown);
    for (const [index, call] of current.entries()) {
      if (!call.cursor) continue;
      const before = rowsOf(current.slice(0, index));
      const resumed = await walk(withoutPageSize(call.cursor));
      const rows = [...before, ...rowsOf(resumed)];
      expectEachOnce(rows, shown);
      expect(
        rows.some((row) =>
          offList.some((spell) => spell.key === row.ruleIdentity),
        ),
      ).toBe(false);
      // A reactive rerun ending at such a cursor shows the page it did and
      // ends there, from either form of its own cursor.
      const previous = current[index - 1];
      if (!previous) continue;
      const end = withoutPageSize(call.cursor);
      for (const cursor of new Set([
        previous.cursor,
        previous.cursor && withoutPageSize(previous.cursor),
      ]))
        expect(await readPages(cursor ?? null, end)).toEqual({
          ...previous.page,
          continueCursor: end,
        });
    }
  } finally {
    stopObserving();
  }
  // A cursor whose skipped matches fill the row budget cannot resume
  // inside it: the stock hook restarts on InvalidCursor.
  await expect(browse('release-search:1:256:')).rejects.toThrow(
    /InvalidCursor/,
  );
  await expect(browse('release-search:1:30:', undefined, 30)).rejects.toThrow(
    /InvalidCursor/,
  );
  // A cursor with its size keeps the read limit it had.
  await expect(
    browse('release-search:1:30/40:', undefined, 30),
  ).rejects.toThrow('Spell browser page exceeds its read resource limit');
  for (const cursor of [
    'release-search:1:x:',
    'release-search:1:7',
    'release-search:1:5/3:',
    'release-search:1:0/0:',
    'release-search:1:1/x:',
    'release-search:1:-1:',
  ])
    await expect(browse(cursor)).rejects.toThrow(
      /^(?!.*InvalidCursor).*Invalid Spell browser cursor/s,
    );
}, 900_000);

test('a release search under sustained byte pressure reads one bounded search page a call, to the end', async () => {
  // The followups-413 r1 probe: 280 off-list Spells matching the search,
  // each with an 11,200-byte stored definition, among 20 of the Wizard's
  // own. A call stops inside its native search page, and the next used to
  // read that page again with a page more, so the page grew with the search
  // until one call read 258 metadata rows, past the page's 256-row budget.
  // Now a resumed call reads the same page again at its size.
  const pinned = readPinnedSpells();
  const template = pinned.find((spell) => spell.levels.wizard === undefined);
  if (!template) throw new Error('No pinned off-list Spell');
  const offList = Array.from({ length: 280 }, (_, index) => {
    const number = String(index).padStart(3, '0');
    return {
      ...template,
      key: `pf1/search-pressure-${number}`,
      name: `Sigil Pressure ${number}`,
    };
  });
  const onList = pinned
    .filter(
      (spell) =>
        (spell.levels.wizard ?? 7) <= 6 && matchesPrefix(spell.name, 's'),
    )
    .slice(0, 20);
  expect(onList).toHaveLength(20);
  const { t, owner, scope, castingClassId } = await releasedSpellbook({
    staged: [...onList, ...offList],
    recorded: 0,
  });
  await storeLongDescriptions(t, scope.characterId, offList);
  type Page = {
    page: { name: string; ruleIdentity: string }[];
    isDone: boolean;
    continueCursor: string;
  };
  const numItems = 25;
  const pageRows: number[] = [];
  let widestPage = 0;
  const browse = async (
    cursor: string | null,
    endCursor?: string,
  ): Promise<Page> => {
    pageRows.length = 0;
    const page: Page = await owner.query(api.characterSheetSpells.browse, {
      ...scope,
      castingClassId,
      search: 's',
      catalogReleaseNumber: 1,
      paginationOpts: { cursor, numItems, endCursor },
    });
    expect(pageRows.length).toBeLessThanOrEqual(1);
    widestPage = Math.max(widestPage, ...pageRows);
    return page;
  };
  const stopObserving = observePaginatedPages((rows) => pageRows.push(rows));
  const pages: string[] = [];
  let calls = 0;
  try {
    let cursor: string | null = null;
    for (; calls < 100; calls++) {
      const page = await browse(cursor);
      expect(
        page.page.length > 0 || page.isDone || page.continueCursor !== cursor,
      ).toBe(true);
      if (!page.isDone)
        expect(await browse(cursor, page.continueCursor)).toEqual(page);
      pages.push(...page.page.map((row) => row.ruleIdentity));
      if (page.isDone) break;
      cursor = page.continueCursor;
    }
  } finally {
    stopObserving();
  }
  // One native search page a call, at most the page's items: well inside
  // the page's 256-row budget, however far the search has gone.
  expect(widestPage).toBeLessThanOrEqual(numItems);
  // About 11 of the 280 definitions a call (half a 256,000-byte page).
  expect(calls).toBeGreaterThan(20);
  expect(calls).toBeLessThan(100);
  expectEachOnce(
    pages.map((ruleIdentity) => ({ ruleIdentity })),
    onList,
  );
  expect(pages.some((key) => key.startsWith('pf1/search-pressure-'))).toBe(
    false,
  );
}, 900_000);
