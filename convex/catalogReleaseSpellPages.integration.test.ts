/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { beforeAll, expect, test } from 'vitest';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';
import { preloadCalledConvexModules } from '../tests/convex-modules';
import {
  activationArgs,
  impactAdapter,
  prepare,
  releaseFixture,
  type ReleaseTest,
} from '../tests/catalog-release-fixture';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import type { AllocationBatch } from '../src/lib/catalog/identity-allocation';
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

async function allocateAll(t: ReleaseTest) {
  let cursor: string | null = null;
  for (;;) {
    const batch: AllocationBatch = await t.mutation(
      internal.catalogIdentityAllocation.allocate,
      { releaseNumber: 1, cursor },
    );
    if (batch.isDone) return;
    cursor = batch.continueCursor;
  }
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
  await allocateAll(t);
  await indexAllocatedSpells(t, scope.characterId, wizard._id);
  const result = await runCatalogReleaseImpactCommand({
    adapter: impactAdapter(t),
    releaseNumber: 1,
    maxSteps: 50_000,
  });
  return { ...fixture, wizard, result };
}

async function readEveryPage(
  owner: Awaited<ReturnType<typeof releaseFixture>>['owner'],
  args: {
    organizationId: string;
    characterId: Id<'character'>;
    castingClassId: Id<'catalogEntry'>;
    spellLevel?: number;
    includeOtherLists?: boolean;
    search?: string;
  },
) {
  const names: string[] = [];
  let cursor: string | null = null;
  for (let call = 0; call < 200; call++) {
    const page: {
      page: { name: string }[];
      isDone: boolean;
      continueCursor: string;
    } = await owner.query(api.characterSheetSpells.browse, {
      ...args,
      catalogReleaseNumber: 1,
      paginationOpts: { cursor, numItems: 25 },
    });
    expect(page.page.length).toBeLessThanOrEqual(25);
    names.push(...page.page.map((row) => row.name));
    if (page.isDone) return names;
    cursor = page.continueCursor;
  }
  throw new Error('Spell browser did not finish');
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
