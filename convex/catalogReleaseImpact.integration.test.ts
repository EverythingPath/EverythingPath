// @vitest-environment edge-runtime
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { makeFunctionReference } from 'convex/server';
import type { Id } from './_generated/dataModel';
import type { CatalogReleaseStatus } from '../src/lib/catalog/release-validators';
import { convexTest } from 'convex-test';
import { beforeAll, expect, test } from 'vitest';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';

import { api, internal } from './_generated/api';
import schema from './schema';
import { markCatalogImpactDirty } from './lib/catalogReleaseImpact';
import { candidateDefinition } from './lib/catalogCandidateDefinition';
import { computeFingerprint } from '../scripts/catalog/admission';
import { resolveCharacterSheetArchetypes } from '../src/lib/character-sheet-archetypes';
import {
  runCatalogReleaseImpactCommand,
  type CatalogReleaseImpactCommandAdapter,
} from '../scripts/catalog/release-impact-command';
import { impactAdapter } from '../tests/catalog-release-fixture';
import castingTables from '../scripts/catalog/reviewed-casting-tables.json';
import { representativeClassCatalog } from './lib/representativeClassCatalog';
import { representativeRaceCatalog } from './lib/representativeRaceCatalog';
import { buildCatalogRelease } from '../scripts/catalog/release';
import {
  parseReleaseJson,
  canonicalReleaseJson,
  releaseByteCount,
} from '../src/lib/catalog/release-schema';
import type { ReleaseRow } from '../src/lib/catalog/release-schema';
import { retainedPriorCalculationIdentity } from '../src/lib/catalog/calculation-identities';
import { catalogRuntimeCompatibility } from '../src/lib/catalog/runtime-compatibility';
import resourcesData from '../src/lib/catalog/data/resources.json';
import { buildLegalPageData } from '../src/lib/catalog/legal-page-data';
import { legalResourcesSchema } from '../src/lib/catalog/legal-types';
const writeBatch = makeFunctionReference<
  'mutation',
  { releaseNumber: number; batchIndex: number; rows: unknown },
  CatalogReleaseStatus
>('catalogRelease:writeBatch');
const modules = import.meta.glob('./**/*.ts');
beforeAll(() => refuseRepeatedPaginatedQueries(schema, modules));

// #755: a deployment runs one paginated query per function, and the guard
// above refuses a second as it does. Each operator function is held to that.
async function startWithDirtyCharacter() {
  const prepared = await fixture();
  const { t, owner, scope } = prepared;
  await prepare(t);
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 1,
  });
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 14 },
    operationId: 'pending',
  });
  return { ...prepared, runId };
}

test('status counts pending and failed work with at most one paginated query', async () => {
  const { t, runId } = await startWithDirtyCharacter();
  expect(
    await t.query(internal.catalogReleaseImpact.status, { runId }),
  ).toMatchObject({
    isDiscoveryComplete: false,
    pendingCount: 1,
    failedCount: 0,
    isReady: false,
  });
});

test('evaluate reads a Character’s impact inputs with at most one paginated query', async () => {
  const { t, scope, runId } = await startWithDirtyCharacter();
  const evaluation = await t.query(internal.catalogReleaseImpact.evaluate, {
    runId,
    characterId: scope.characterId,
  });
  expect(evaluation.result).toEqual({ kind: 'unaffected' });
});

test('complete re-evaluates and records a Character’s result with at most one paginated query', async () => {
  const { t, scope, runId } = await startWithDirtyCharacter();
  const evaluation = await t.query(internal.catalogReleaseImpact.evaluate, {
    runId,
    characterId: scope.characterId,
  });
  expect(
    await t.mutation(internal.catalogReleaseImpact.complete, {
      runId,
      characterId: scope.characterId,
      evaluation,
    }),
  ).toBe(true);
  const unaffected = await t.query(internal.catalogReleaseImpact.inspectWork, {
    runId,
    state: 'unaffected',
    paginationOpts: {
      cursor: null,
      numItems: 1,
      maximumRowsRead: 1,
      maximumBytesRead: 512000,
    },
  });
  expect(unaffected.page.map((work) => work.characterId)).toEqual([
    scope.characterId,
  ]);
});

test('finish seals a discovered run with no outstanding work with at most one paginated query', async () => {
  const { t } = await fixture();
  await prepare(t);
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 1,
  });
  // The discovery stages have their own test below.
  await t.run((ctx) =>
    ctx.db.patch('catalogImpactRun', runId, { isDiscoveryComplete: true }),
  );
  expect(
    await t.mutation(internal.catalogReleaseImpact.finish, { runId }),
  ).toBe(true);
});

test.each(['retained', 'campaigns'] as const)(
  'the last %s discovery batch runs at most one paginated query',
  async (stage) => {
    const { t } = await fixture();
    await prepare(t);
    const runId = await t.mutation(internal.catalogReleaseImpact.start, {
      releaseNumber: 1,
    });
    await t.run((ctx) =>
      ctx.db.patch('catalogImpactRun', runId, {
        discoveryStage: stage,
        cursor: null,
      }),
    );
    await discover(t, runId);
    const status = await t.query(internal.catalogReleaseImpact.status, {
      runId,
    });
    expect(status).toMatchObject({ isDiscoveryComplete: true });
    expect(status.discoveryError).toBeUndefined();
  },
);

test('cleanup removes one table’s rows per call after the work rows, with at most one paginated query', async () => {
  const { t, campaignId } = await fixture();
  await prepare(t);
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 1,
  });
  await t.mutation(internal.catalogReleaseImpact.abandon, { runId });
  await t.run(async (ctx) => {
    await ctx.db.insert('catalogCampaignFacts', {
      runId,
      campaignId,
      baseGeneration: 0,
      generation: 0,
      changedCount: 0,
    });
    await ctx.db.insert('catalogImpactEdge', {
      runId,
      from: 'key:old',
      to: 'key:older',
    });
    await ctx.db.insert('catalogImpactChange', {
      runId,
      key: 'key:old',
      hasChanged: true,
      hasSpellDependencies: false,
    });
  });
  const results: boolean[] = [];
  for (let step = 0; step < 4; step++)
    results.push(
      await t.mutation(internal.catalogReleaseImpact.cleanup, { runId }),
    );
  expect(results).toEqual([false, false, false, true]);
  expect(
    await t.run((ctx) => ctx.db.get('catalogImpactRun', runId)),
  ).toBeNull();
});

// Read bounds count Convex-encoded bytes, where every number takes 9 bytes, as
// the bounded paginated reads they replace did; canonical JSON is smaller here.
const mebibyte = 1_048_576;

test('representative resources over 1 MiB in Convex bytes fail discovery even when their JSON is smaller', async () => {
  const { t } = await fixture();
  await prepare(t);
  const payload = Object.fromEntries(
    [1, 2, 3, 4, 5, 6].map((table) => [`table${table}`, Array(8192).fill(0)]),
  );
  expect(3 * releaseByteCount(payload)).toBeLessThan(mebibyte);
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 1,
  });
  await t.run(async (ctx) => {
    const release = await ctx.db
      .query('catalogRelease')
      .withIndex('by_releaseNumber', (q) => q.eq('releaseNumber', 1))
      .unique();
    if (!release) throw new Error('Release 1 is missing');
    for (const kind of ['class', 'race', 'archetype'])
      await ctx.db.insert('catalogReleaseRow', {
        releaseId: release._id,
        batchIndex: 0,
        kind: 'resource',
        key: `builtin:representative-${kind}-catalog`,
        payload,
      });
  });
  await discover(t, runId);
  expect(
    await t.query(internal.catalogReleaseImpact.status, { runId }),
  ).toMatchObject({
    discoveryError:
      'Prepared release resources failed: Release exceeds representative resource limit',
  });
});

test('status truncates its failed count at 1 MiB of Convex bytes even when the rows’ JSON is smaller', async () => {
  const { t, scope, runId } = await startWithDirtyCharacter();
  const failedRows = 1000;
  const work = await t.run(async (ctx) => {
    for (let row = 0; row < failedRows; row++)
      await ctx.db.insert('catalogImpactWork', {
        runId,
        characterId: scope.characterId,
        revision: 1,
        state: 'failed',
        factGeneration: 1,
        facts: {
          characterId: scope.characterId,
          level: 1,
          racialHitDice: 1,
          actualHitDice: 1,
          strength: 9,
          dexterity: 9,
          constitution: 9,
          intelligence: 9,
          wisdom: 9,
          charisma: 9,
          isActive: true,
        },
        error: 'e'.repeat(610),
      });
    return ctx.db
      .query('catalogImpactWork')
      .withIndex('by_runId_and_state', (q) =>
        q.eq('runId', runId).eq('state', 'failed'),
      )
      .take(failedRows);
  });
  expect(releaseByteCount(work)).toBeLessThan(mebibyte);
  const status = await t.query(internal.catalogReleaseImpact.status, {
    runId,
  });
  expect(status).toMatchObject({ hasTruncatedCounts: true });
  expect(status.failedCount).toBeLessThan(failedRows);
});

test('ordinary edits keep the shared impact run unchanged and tolerate a missing run', async () => {
  const { t, owner, scope, campaignId } = await fixture();
  const secondId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Second',
    kind: 'pc',
    operationId: 'second',
  });
  await prepare(t);
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 1,
  });
  const before = await t.run((ctx) => ctx.db.get('catalogImpactRun', runId));
  const controlBefore = await t.run((ctx) =>
    ctx.db
      .query('catalogImpactControl')
      .withIndex('by_key', (q) => q.eq('key', 'global'))
      .unique(),
  );
  await Promise.all(
    [scope.characterId, secondId].map((characterId) =>
      owner.mutation(api.characterSheet.editBaseScores, {
        organizationId: 'org',
        characterId,
        scores: { strength: 15 },
        operationId: `edit-${characterId}`,
      }),
    ),
  );
  expect(await t.run((ctx) => ctx.db.get('catalogImpactRun', runId))).toEqual(
    before,
  );
  expect(
    await t.run((ctx) =>
      ctx.db
        .query('catalogImpactControl')
        .withIndex('by_key', (q) => q.eq('key', 'global'))
        .unique(),
    ),
  ).toEqual(controlBefore);
  const writeTables = await t.run(async (ctx) => {
    const tables: string[] = [];
    const db = new Proxy(ctx.db, {
      get(target, method) {
        if (['patch', 'insert', 'replace', 'delete'].includes(String(method)))
          return (...args: unknown[]) => {
            tables.push(String(args[0]));
            const writer: unknown = Reflect.get(target, method);
            if (typeof writer !== 'function')
              throw new Error('Missing database writer');
            return Reflect.apply(writer, target, args);
          };
        return Reflect.get(target, method);
      },
    });
    for (const characterId of [scope.characterId, secondId])
      await markCatalogImpactDirty({ ...ctx, db }, characterId);
    return tables;
  });
  expect(writeTables).toEqual(['catalogImpactWork', 'catalogImpactWork']);
  expect(
    await t.query(internal.catalogReleaseImpact.status, { runId }),
  ).toMatchObject({ pendingCount: 2 });
  await t.run((ctx) => ctx.db.delete('catalogImpactRun', runId));
  await expect(
    owner.mutation(api.characterSheet.editBaseScores, {
      ...scope,
      scores: { strength: 17 },
      operationId: 'missing-run',
    }),
  ).resolves.toBeDefined();
  expect(
    await t.query(internal.catalogReleaseImpact.status, { runId }),
  ).toMatchObject({
    isReady: false,
    discoveryError: expect.stringContaining('missing'),
  });
});

test('ready evidence clears tracking and cleanup retains the latest ready run while removing superseded rows in bounded batches', async () => {
  const { t, owner, scope } = await fixture();
  await prepare(t);
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 1,
  });
  await discover(t, runId);
  const evaluation = await t.query(internal.catalogReleaseImpact.evaluate, {
    runId,
    characterId: scope.characterId,
  });
  expect(evaluation.result).toEqual({ kind: 'unaffected' });
  await t.mutation(internal.catalogReleaseImpact.complete, {
    runId,
    characterId: scope.characterId,
    evaluation,
  });
  expect(
    await t.mutation(internal.catalogReleaseImpact.finish, { runId }),
  ).toBe(true);
  expect(
    await t.run((ctx) =>
      ctx.db
        .query('catalogImpactControl')
        .withIndex('by_key', (q) => q.eq('key', 'global'))
        .unique(),
    ),
  ).toBeNull();
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 16 },
    operationId: 'after-ready',
  });
  expect(
    await t.query(internal.catalogReleaseImpact.status, { runId }),
  ).toMatchObject({ isReady: false, pendingCount: 1 });
  expect(
    await t.mutation(internal.catalogReleaseImpact.cleanup, { runId }),
  ).toBe(true);
  expect(
    await t.run((ctx) => ctx.db.get('catalogImpactRun', runId)),
  ).not.toBeNull();
  const nextRun = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 1,
  });
  expect(nextRun).not.toBe(runId);
  await discover(t, nextRun);
  const nextEvaluation = await t.query(internal.catalogReleaseImpact.evaluate, {
    runId: nextRun,
    characterId: scope.characterId,
  });
  await t.mutation(internal.catalogReleaseImpact.complete, {
    runId: nextRun,
    characterId: scope.characterId,
    evaluation: nextEvaluation,
  });
  await t.mutation(internal.catalogReleaseImpact.finish, { runId: nextRun });
  await t.run(async (ctx) => {
    for (let index = 0; index < 75; index++)
      await ctx.db.insert('catalogImpactEdge', {
        runId,
        from: `old:${index}`,
        to: 'key:old',
      });
  });
  expect(
    await t.mutation(internal.catalogReleaseImpact.cleanup, { runId }),
  ).toBe(false);
  for (let index = 0; index < 10; index++)
    if (await t.mutation(internal.catalogReleaseImpact.cleanup, { runId }))
      break;
  expect(
    await t.run((ctx) => ctx.db.get('catalogImpactRun', runId)),
  ).toBeNull();
  expect(
    await t.run((ctx) =>
      ctx.db
        .query('catalogImpactEdge')
        .withIndex('by_runId_and_from', (q) => q.eq('runId', runId))
        .take(1),
    ),
  ).toEqual([]);
  await expect(
    t.mutation(internal.catalogReleaseImpact.complete, {
      runId,
      characterId: scope.characterId,
      evaluation,
    }),
  ).rejects.toThrow();
});

test('cleanup refuses a still-current active run instead of reporting remaining batches', async () => {
  const { t } = await fixture();
  await prepare(t);
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 1,
  });
  await expect(
    t.mutation(internal.catalogReleaseImpact.cleanup, { runId }),
  ).rejects.toThrow(
    'Catalog impact run is still active; finish or abandon it before cleanup',
  );
  expect(
    await t.run((ctx) => ctx.db.get('catalogImpactRun', runId)),
  ).toMatchObject({ lifecycle: 'active' });
  await t.mutation(internal.catalogReleaseImpact.abandon, { runId });
  for (let step = 0; step < 10; step++)
    if (await t.mutation(internal.catalogReleaseImpact.cleanup, { runId }))
      break;
  expect(
    await t.run((ctx) => ctx.db.get('catalogImpactRun', runId)),
  ).toBeNull();
});

test('abandon refuses ready evidence so cleanup keeps retaining it', async () => {
  const { t, scope } = await fixture();
  await prepare(t);
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 1,
  });
  await discover(t, runId);
  const evaluation = await t.query(internal.catalogReleaseImpact.evaluate, {
    runId,
    characterId: scope.characterId,
  });
  await t.mutation(internal.catalogReleaseImpact.complete, {
    runId,
    characterId: scope.characterId,
    evaluation,
  });
  expect(
    await t.mutation(internal.catalogReleaseImpact.finish, { runId }),
  ).toBe(true);
  await expect(
    t.mutation(internal.catalogReleaseImpact.abandon, { runId }),
  ).rejects.toThrow('Ready Catalog impact evidence cannot be abandoned');
  expect(
    await t.mutation(internal.catalogReleaseImpact.cleanup, { runId }),
  ).toBe(true);
  expect(
    await t.run((ctx) => ctx.db.get('catalogImpactRun', runId)),
  ).toMatchObject({ lifecycle: 'ready' });
  expect(
    await t.run((ctx) =>
      ctx.db
        .query('catalogImpactWork')
        .withIndex('by_runId_and_characterId', (q) => q.eq('runId', runId))
        .take(1),
    ),
  ).toHaveLength(1);
});

test('changing more than 128 Spells on one class list keeps its casters within the keyed dependency limit', async () => {
  const { t, owner, scope } = await fixture();
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const wizard = sheet?.catalogEntries.find(
    (row) => row.detail.kind === 'class' && row.ruleIdentity === 'wizard',
  );
  const level = sheet?.entries.find((row) => row.kind === 'classLevel');
  if (!wizard || !level) throw new Error('Missing wizard');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: wizard._id,
    hpGained: 5,
    operationId: 'wizard',
  });
  const spellCount = 160;
  const spellRows = (spellLevel: number) =>
    Array.from({ length: spellCount }, (_, index) => {
      const key = `pf1/ListSpell${index}`;
      return {
        kind: 'definition' as const,
        key,
        payload: {
          ...featPayload(key),
          pack: 'spells',
          detail: {
            kind: 'spell',
            levels: { wizard: spellLevel },
            grantedLevels: {},
            school: 'evocation',
            subschools: [],
            descriptors: [],
          },
        },
      };
    });
  const base = await prepare(t, spellRows(1), 1);
  await t.run((ctx) =>
    ctx.db.insert('catalogReleaseControl', {
      key: 'global',
      releaseNumber: 1,
      schemaIdentity: catalogRuntimeCompatibility.schema,
      calculationIdentity: catalogRuntimeCompatibility.calculation,
    }),
  );
  await prepare(t, spellRows(2), 2, {
    baseRelease: {
      releaseNumber: 1,
      artifactFingerprint: base.manifest.artifactFingerprint,
    },
  });
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 2,
  });
  for (let step = 0; ; step++) {
    if (step > 2000) throw new Error('Discovery did not finish');
    if (await t.mutation(internal.catalogReleaseImpact.discover, { runId }))
      break;
  }
  expect(
    await t.run(
      async (ctx) =>
        (
          await ctx.db
            .query('catalogImpactEdge')
            .withIndex('by_runId_and_from', (q) =>
              q.eq('runId', runId).eq('from', 'casting:wizard'),
            )
            .collect()
        ).length,
    ),
  ).toBe(spellCount);
  const evaluation = await t.query(internal.catalogReleaseImpact.evaluate, {
    runId,
    characterId: scope.characterId,
  });
  expect(evaluation.result).toMatchObject({ kind: 'ready' });
});

// Magic Tactics Toolbox: the Questioner investigator casts from the bard
// list. CRB p. 251: Charm Person is a 1st-level bard spell and a
// mind-affecting charm that is on no investigator list.
test('an Archetype that casts from another class’s list follows that list’s changed Spells', async () => {
  const { t, owner, scope } = await fixture();
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const named = (name: string) => {
    const row = sheet?.catalogEntries.find((entry) => entry.name === name);
    if (!row) throw new Error(`Missing ${name}`);
    return row._id;
  };
  const level = sheet?.entries.find((row) => row.kind === 'classLevel');
  if (!level) throw new Error('Missing Class Level');
  const investigator = named('Investigator');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: investigator,
    operationId: 'investigator',
  });
  const charmPerson = (descriptors: string[]) => ({
    kind: 'definition' as const,
    key: 'pf1/charm-person',
    payload: {
      externalKey: 'pf1/charm-person',
      upstreamKey: 'pf1/charm-person',
      pack: 'spells',
      name: 'Charm Person',
      detail: {
        kind: 'spell',
        levels: { bard: 1, sorcerer: 1, wizard: 1 },
        grantedLevels: {},
        school: 'enchantment',
        subschools: ['charm'],
        descriptors,
      },
      description: '',
      sources: [{ book: 'Pathfinder RPG Core Rulebook', pages: '251' }],
      modifiers: [],
      unsupported: [],
    },
  });
  const base = await prepare(t, [charmPerson([])], 1);
  await t.run((ctx) =>
    ctx.db.insert('catalogReleaseControl', {
      key: 'global',
      releaseNumber: 1,
      schemaIdentity: catalogRuntimeCompatibility.schema,
      calculationIdentity: catalogRuntimeCompatibility.calculation,
    }),
  );
  // The next release adds the reviewed mind-affecting descriptor.
  await prepare(t, [charmPerson(['mind-affecting'])], 2, {
    baseRelease: {
      releaseNumber: 1,
      artifactFingerprint: base.manifest.artifactFingerprint,
    },
  });
  async function readReasons() {
    const runId = await t.mutation(internal.catalogReleaseImpact.start, {
      releaseNumber: 2,
    });
    await discover(t, runId);
    const evaluation = await t.query(internal.catalogReleaseImpact.evaluate, {
      runId,
      characterId: scope.characterId,
    });
    await t.mutation(internal.catalogReleaseImpact.abandon, { runId });
    return evaluation.result.kind === 'ready'
      ? evaluation.result.reasons
      : evaluation.result.kind;
  }
  // The investigator's own list never offers Charm Person.
  expect(await readReasons()).toBe('unaffected');
  await owner.mutation(api.characterSheet.setArchetypeSelected, {
    ...scope,
    classEntryId: investigator,
    catalogEntryId: named('Questioner'),
    selected: true,
    operationId: 'questioner',
  });
  expect(await readReasons()).toEqual(['key:pf1/charm-person']);
});

test('discovery records duplicate identities as an operator failure and batches prepared Characters past legacy rows', async () => {
  const { t, scope } = await fixture();
  await t.run(async (ctx) => {
    const character = await ctx.db.get('character', scope.characterId);
    if (!character) throw new Error('Missing Character');
    const { _id, _creationTime, ...body } = character;
    for (let index = 0; index < 200; index++)
      await ctx.db.insert('character', { ...body, sheetMode: undefined });
    for (let index = 0; index < 20; index++)
      await ctx.db.insert('character', body);
    for (let index = 0; index < 2; index++)
      await ctx.db.insert('catalogEntry', {
        scope: 'global',
        name: 'Duplicate',
        ruleIdentity: 'pf1/Duplicate',
        stacksWithItself: false,
        sources: [],
        modifiers: [],
        detail: { kind: 'feat' },
      });
  });
  await prepare(t, [
    {
      kind: 'definition',
      key: 'pf1/Duplicate',
      payload: featPayload('pf1/Duplicate'),
    },
  ]);
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 1,
  });
  await expect(
    t.mutation(internal.catalogReleaseImpact.discover, { runId }),
  ).resolves.toBe(true);
  expect(
    await t.query(internal.catalogReleaseImpact.status, { runId }),
  ).toMatchObject({
    failedCount: 1,
    discoveryError: expect.stringContaining('pf1/Duplicate'),
  });
});

test('a legacy Character is notPrepared rather than deleted', async () => {
  const { t, scope } = await fixture();
  await prepare(t);
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 1,
  });
  await discover(t, runId);
  await t.run((ctx) =>
    ctx.db.patch('character', scope.characterId, { sheetMode: undefined }),
  );
  const evaluation = await t.query(internal.catalogReleaseImpact.evaluate, {
    runId,
    characterId: scope.characterId,
  });
  expect(evaluation.result).toEqual({ kind: 'notPrepared' });
  await t.mutation(internal.catalogReleaseImpact.complete, {
    runId,
    characterId: scope.characterId,
    evaluation,
  });
  const page = await t.query(internal.catalogReleaseImpact.inspectWork, {
    runId,
    state: 'notPrepared',
    paginationOpts: {
      cursor: null,
      numItems: 10,
      maximumRowsRead: 10,
      maximumBytesRead: 512000,
    },
  });
  expect(page.page.map((row) => row.characterId)).toEqual([scope.characterId]);
});

test.each([
  { name: 'global', isGlobal: true },
  { name: 'private imported', isGlobal: false },
])(
  'reverse Spell discovery handles 2000 $name browser rows and legacy IDs while keeping copies independent',
  async ({ isGlobal }) => {
    const { t, owner, scope, campaignId } = await fixture();
    const copyCharacterId = await owner.mutation(api.characterSheet.create, {
      organizationId: 'org',
      campaignId,
      name: 'Copy caster',
      kind: 'pc',
      operationId: 'copy-caster',
    });
    for (const characterId of [scope.characterId, copyCharacterId]) {
      const sheet = withSheetCatalog(
        await owner.query(api.characterSheet.read, {
          organizationId: 'org',
          characterId,
        }),
      );
      const wizard = sheet?.catalogEntries.find(
        (row) => row.detail.kind === 'class' && row.ruleIdentity === 'wizard',
      );
      const level = sheet?.entries.find((row) => row.kind === 'classLevel');
      if (!wizard || !level) throw new Error('Missing wizard');
      await owner.mutation(api.characterSheet.editClassLevel, {
        organizationId: 'org',
        characterId,
        entryId: level._id,
        classEntryId: wizard._id,
        hpGained: 5,
        operationId: `wizard-${characterId}`,
      });
    }
    await t.run(async (ctx) => {
      const wizard = await ctx.db
        .query('catalogEntry')
        .withIndex('by_characterId_and_ruleIdentity', (q) =>
          q.eq('characterId', scope.characterId).eq('ruleIdentity', 'wizard'),
        )
        .unique();
      const copyWizard = await ctx.db
        .query('catalogEntry')
        .withIndex('by_characterId_and_ruleIdentity', (q) =>
          q.eq('characterId', copyCharacterId).eq('ruleIdentity', 'wizard'),
        )
        .unique();
      if (!wizard || !copyWizard) throw new Error('Missing wizard');
      for (let index = 0; index < 2000; index++) {
        const ruleIdentity = `pf1/Browser${index}`;
        const spellId = await ctx.db.insert('catalogEntry', {
          scope: isGlobal ? 'global' : 'character',
          characterId: isGlobal ? undefined : scope.characterId,
          importedSpell: isGlobal ? undefined : true,
          browseOnly: isGlobal ? undefined : true,
          name: ruleIdentity,
          ruleIdentity,
          stacksWithItself: false,
          modifiers: [],
          sources: [],
          detail: {
            kind: 'spell',
            levels: { cleric: 1 },
            school: 'evocation',
            description: '',
          },
        });
        await ctx.db.insert('spellCatalogIndex', {
          characterId: scope.characterId,
          catalogEntryId: spellId,
          castingClassId: wizard._id,
          ...(index === 1999 ? {} : { ruleIdentity }),
          levels: { cleric: 1 },
          level: 1,
          school: 'evocation',
          name: ruleIdentity,
          available: false,
        });
        if (index === 1999) {
          const copyId = await ctx.db.insert('catalogEntry', {
            scope: 'character',
            characterId: copyCharacterId,
            copiedFrom: spellId,
            name: ruleIdentity,
            ruleIdentity,
            stacksWithItself: false,
            modifiers: [],
            sources: [],
            detail: {
              kind: 'spell',
              levels: { cleric: 1 },
              school: 'evocation',
              description: '',
            },
          });
          await ctx.db.insert('spellCatalogIndex', {
            characterId: copyCharacterId,
            catalogEntryId: copyId,
            castingClassId: copyWizard._id,
            ruleIdentity,
            levels: { cleric: 1 },
            level: 1,
            school: 'evocation',
            name: ruleIdentity,
            available: false,
          });
        }
      }
    });
    await prepare(t, [
      {
        kind: 'definition',
        key: 'pf1/Browser1999',
        payload: {
          ...featPayload('pf1/Browser1999'),
          pack: 'spells',
          detail: {
            kind: 'spell',
            levels: { cleric: 2 },
            grantedLevels: { domain: { fire: 1 } },
            school: 'evocation',
            subschools: [],
            descriptors: [],
          },
        },
      },
    ]);
    const runId = await t.mutation(internal.catalogReleaseImpact.start, {
      releaseNumber: 1,
    });
    await discover(t, runId);
    const evaluation = await t.query(internal.catalogReleaseImpact.evaluate, {
      runId,
      characterId: scope.characterId,
    });
    expect(evaluation.result).toMatchObject({
      kind: 'ready',
      reasons: ['key:pf1/Browser1999'],
    });
    const copyEvaluation = await t.query(
      internal.catalogReleaseImpact.evaluate,
      {
        runId,
        characterId: copyCharacterId,
      },
    );
    expect(copyEvaluation.result).toEqual({ kind: 'unaffected' });
  },
);

test('a failed recalculation clears previously prepared facts and reasons', async () => {
  const { t, owner, scope } = await fixture();
  const targetId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Target',
      ruleIdentity: 'pf1/StaleFacts',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'feat' },
    }),
  );
  await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: targetId,
    operationId: 'target',
  });
  await prepare(t, [
    {
      kind: 'definition',
      key: 'pf1/StaleFacts',
      payload: featPayload('pf1/StaleFacts', [
        { target: 'ability.str', bonusType: 'enhancement', value: 2 },
      ]),
    },
  ]);
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 1,
  });
  await discover(t, runId);
  const ready = await t.query(internal.catalogReleaseImpact.evaluate, {
    runId,
    characterId: scope.characterId,
  });
  expect(ready.result).toMatchObject({ kind: 'ready', hasFactsChanged: true });
  await t.mutation(internal.catalogReleaseImpact.complete, {
    runId,
    characterId: scope.characterId,
    evaluation: ready,
  });
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 16 },
    operationId: 'redirty',
  });
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', targetId, { detail: { kind: 'trait' } }),
  );
  const failed = await t.query(internal.catalogReleaseImpact.evaluate, {
    runId,
    characterId: scope.characterId,
  });
  expect(failed.result).toMatchObject({ kind: 'failed' });
  await t.mutation(internal.catalogReleaseImpact.complete, {
    runId,
    characterId: scope.characterId,
    evaluation: failed,
  });
  const page = await t.query(internal.catalogReleaseImpact.inspectWork, {
    runId,
    state: 'failed',
    paginationOpts: {
      cursor: null,
      numItems: 10,
      maximumRowsRead: 10,
      maximumBytesRead: 512000,
    },
  });
  expect(page.page).toHaveLength(1);
  expect(page.page[0]).not.toHaveProperty('facts');
  expect(page.page[0]).not.toHaveProperty('hasFactsChanged');
  expect(page.page[0]).not.toHaveProperty('reasons');
});

test('unreferenced customizations stay outside candidate validation', async () => {
  const { t, scope } = await fixture();
  await t.run(async (ctx) => {
    const badTarget = await ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Unused target',
      ruleIdentity: 'pf1/Unused',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'feat' },
    });
    await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: scope.characterId,
      name: 'Unused customization',
      ruleIdentity: 'local:unused',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'feat' },
      grants: [{ catalogEntryId: badTarget }],
    });
  });
  await prepare(t, [
    {
      kind: 'definition',
      key: 'pf1/Unused',
      payload: featPayload('pf1/Unused', [
        { target: 'ability.str', bonusType: 'enhancement', value: 2.5 },
      ]),
    },
  ]);
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 1,
  });
  await discover(t, runId);
  const evaluation = await t.query(internal.catalogReleaseImpact.evaluate, {
    runId,
    characterId: scope.characterId,
  });
  expect(evaluation.result).toEqual({ kind: 'unaffected' });
  await t.mutation(internal.catalogReleaseImpact.complete, {
    runId,
    characterId: scope.characterId,
    evaluation,
  });
  expect(
    await t.mutation(internal.catalogReleaseImpact.finish, { runId }),
  ).toBe(true);
});

test('one discovery transaction processes a prepared Character batch without scanning legacy Characters', async () => {
  const { t, scope } = await fixture();
  await t.run(async (ctx) => {
    const character = await ctx.db.get('character', scope.characterId);
    if (!character) throw new Error('Missing Character');
    const { _id, _creationTime, ...body } = character;
    for (let index = 0; index < 200; index++)
      await ctx.db.insert('character', { ...body, sheetMode: undefined });
    for (let index = 0; index < 20; index++)
      await ctx.db.insert('character', body);
  });
  await prepare(t);
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 1,
  });
  for (let step = 0; step < 20; step++) {
    const run = await t.run((ctx) => ctx.db.get('catalogImpactRun', runId));
    if (run?.discoveryStage === 'sheets') break;
    await t.mutation(internal.catalogReleaseImpact.discover, { runId });
  }
  expect(
    await t.mutation(internal.catalogReleaseImpact.discover, { runId }),
  ).toBe(false);
  expect(
    await t.query(internal.catalogReleaseImpact.status, { runId }),
  ).toMatchObject({ isDiscoveryComplete: false, pendingCount: 21 });
  // A separate bounded page inherits generations for empty militia campaigns.
  expect(
    await t.mutation(internal.catalogReleaseImpact.discover, { runId }),
  ).toBe(true);
});

test('a Spell browser reference created after reverse discovery uses the latest live identity', async () => {
  const { t, owner, scope } = await fixture();
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const wizard = sheet?.catalogEntries.find(
    (row) => row.detail.kind === 'class' && row.ruleIdentity === 'wizard',
  );
  const level = sheet?.entries.find((row) => row.kind === 'classLevel');
  if (!wizard || !level) throw new Error('Missing wizard');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: wizard._id,
    hpGained: 5,
    operationId: 'wizard',
  });
  await prepare(t, [
    {
      kind: 'definition',
      key: 'pf1/LateBrowser',
      payload: {
        ...featPayload('pf1/LateBrowser'),
        pack: 'spells',
        detail: {
          kind: 'spell',
          levels: { cleric: 2 },
          grantedLevels: {},
          school: 'evocation',
          subschools: [],
          descriptors: [],
        },
      },
    },
  ]);
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 1,
  });
  await discover(t, runId);
  await owner.mutation(internal.characterSheetSpells.installPreparedCatalog, {
    ...scope,
    spells: [
      {
        ...featPayload('pf1/LateBrowser'),
        pack: 'spells',
        detail: {
          kind: 'spell',
          levels: { cleric: 1 },
          grantedLevels: {},
          school: 'evocation',
          subschools: [],
          descriptors: [],
        },
      },
    ],
    operationId: 'late-browser-import',
  });
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 16 },
    operationId: 'late-index-edit',
  });
  const evaluation = await t.query(internal.catalogReleaseImpact.evaluate, {
    runId,
    characterId: scope.characterId,
  });
  expect(evaluation.result).toMatchObject({
    kind: 'ready',
    reasons: ['key:pf1/LateBrowser'],
    facts: { strength: 16 },
  });
});

test('a recorded frozen Spell copy without a casting list remains independent from other Spell releases', async () => {
  const { t, scope } = await fixture();
  await t.run(async (ctx) => {
    const originalId = await ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Origin',
      ruleIdentity: 'pf1/FrozenSpell',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: {
        kind: 'spell',
        levels: { cleric: 1 },
        school: 'evocation',
        description: '',
      },
    });
    const copyId = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: scope.characterId,
      copiedFrom: originalId,
      name: 'Frozen Spell',
      ruleIdentity: 'pf1/FrozenSpell',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: {
        kind: 'spell',
        levels: { cleric: 1 },
        school: 'evocation',
        description: '',
      },
    });
    await ctx.db.insert('characterSheetEntry', {
      characterId: scope.characterId,
      catalogEntryId: copyId,
      kind: 'spell',
      active: true,
      state: { kind: 'spell', level: 1 },
    });
  });
  await prepare(t, [
    {
      kind: 'definition',
      key: 'pf1/OtherClericSpell',
      payload: {
        ...featPayload('pf1/OtherClericSpell'),
        pack: 'spells',
        detail: {
          kind: 'spell',
          levels: { cleric: 2 },
          grantedLevels: {},
          school: 'evocation',
          subschools: [],
          descriptors: [],
        },
      },
    },
  ]);
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 1,
  });
  await discover(t, runId);
  const evaluation = await t.query(internal.catalogReleaseImpact.evaluate, {
    runId,
    characterId: scope.characterId,
  });
  expect(evaluation.result).toEqual({ kind: 'unaffected' });
});

test('hundreds of unrelated changed definitions do not cap candidate readiness', async () => {
  const { t, scope } = await fixture();
  await prepare(
    t,
    Array.from({ length: 300 }, (_, index) => ({
      kind: 'definition' as const,
      key: `pf1/Unrelated${index}`,
      payload: featPayload(`pf1/Unrelated${index}`),
    })),
  );
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 1,
  });
  await discover(t, runId);
  const evaluation = await t.query(internal.catalogReleaseImpact.evaluate, {
    runId,
    characterId: scope.characterId,
  });
  expect(evaluation.result).toEqual({ kind: 'unaffected' });
  await t.mutation(internal.catalogReleaseImpact.complete, {
    runId,
    characterId: scope.characterId,
    evaluation,
  });
  expect(
    await t.mutation(internal.catalogReleaseImpact.finish, { runId }),
  ).toBe(true);
});

async function fixture() {
  const t = convexTest(schema, modules);
  const campaignId = await t.run(async (ctx) => {
    await ctx.db.insert('user', {
      tokenIdentifier: 'test|owner',
      orgIds: [{ orgId: 'org', role: 'member' }],
    });
    return ctx.db.insert('campaign', {
      name: 'Impact fixture',
      description: '',
      organizationId: 'org',
      ownerId: 'test|owner',
      e2eFixture: {
        namespace: 'impact',
        version: 1,
        workerKey: '0',
        caseKey: 'impact',
        campaignKey: 'impact',
      },
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'test|owner' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Vessa',
    kind: 'pc',
    operationId: 'create',
  });
  return {
    t,
    owner,
    campaignId,
    scope: { organizationId: 'org', characterId },
  };
}

async function prepare(
  t: ReturnType<typeof convexTest>,
  rows: ReleaseRow[] = [],
  releaseNumber = 1,
  options: Partial<
    Pick<
      Parameters<typeof buildCatalogRelease>[0],
      'baseRelease' | 'compatibility'
    >
  > = {},
) {
  const notices = buildLegalPageData({
    registry: {},
    resources: legalResourcesSchema.parse(resourcesData),
    requiredNotices: [],
    permanentNoticeSuperset: [],
  }).permanentNoticeSuperset;
  const artifact = await buildCatalogRelease({
    releaseNumber,
    ...options,
    compatibility: options.compatibility ?? catalogRuntimeCompatibility,
    inputs: {
      upstream: {},
      remaps: {},
      curation: {},
      localData: {},
      parsers: {},
      sanitizers: {},
      ruleResources: {},
      legal: {},
      attribution: {},
    },
    rows: [
      ...rows,
      ...['content', 'resources', 'holds', 'retirement', 'curation'].map(
        (key) => ({
          kind: 'report' as const,
          key,
          payload: { gatePassed: true, coverageComplete: true, passed: true },
        }),
      ),
      ...[
        'requiredNotices',
        'permanentNoticeSuperset',
        'registry',
        'resources',
      ].map((key) => ({
        kind: 'legal' as const,
        key,
        payload:
          key === 'resources'
            ? resourcesData
            : key === 'registry'
              ? {}
              : key === 'permanentNoticeSuperset'
                ? notices
                : [],
      })),
    ],
  });
  await t.mutation(internal.catalogRelease.begin, {
    manifest: artifact.manifest,
  });
  for (const [batchIndex, batch] of artifact.batches.entries())
    await t.mutation(writeBatch, { releaseNumber, batchIndex, rows: batch });
  await t.mutation(internal.catalogRelease.finalize, { releaseNumber });
  return artifact;
}

test('registering before discovery captures ordinary edits and clears only their matching candidate revision', async () => {
  const { t, owner, scope } = await fixture();
  await prepare(t);
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 1,
  });
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 14 },
    operationId: 'during-discovery',
  });
  expect(
    await t.query(internal.catalogReleaseImpact.status, { runId }),
  ).toMatchObject({ isDiscoveryComplete: false, pendingCount: 1 });
  const first = await t.query(internal.catalogReleaseImpact.evaluate, {
    runId,
    characterId: scope.characterId,
  });
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 16 },
    operationId: 'during-calculation',
  });
  expect(
    await t.mutation(internal.catalogReleaseImpact.complete, {
      runId,
      characterId: scope.characterId,
      evaluation: first,
    }),
  ).toBe(false);
  const current = await t.query(internal.catalogReleaseImpact.evaluate, {
    runId,
    characterId: scope.characterId,
  });
  expect(
    await t.mutation(internal.catalogReleaseImpact.complete, {
      runId,
      characterId: scope.characterId,
      evaluation: current,
    }),
  ).toBe(true);
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated.abilities.strength.score,
  ).toBe(16);
  expect(
    await t.query(internal.catalogReleaseImpact.status, { runId }),
  ).toMatchObject({ pendingCount: 0 });
});

function featPayload(
  key: string,
  modifiers: { target: string; bonusType: string; value: number }[] = [],
) {
  return {
    externalKey: key,
    upstreamKey: key,
    pack: 'feats',
    name: key,
    detail: { kind: 'feat', featTypes: [], repeatable: 'unreviewed' },
    description: '',
    sources: [],
    modifiers,
    unsupported: [],
  };
}
async function discover(
  t: ReturnType<typeof convexTest>,
  runId: Id<'catalogImpactRun'>,
) {
  for (let step = 0; step < 100; step++)
    if (await t.mutation(internal.catalogReleaseImpact.discover, { runId }))
      return;
  throw new Error('Discovery did not finish');
}

test('reviewed ID-based Grants retain live global dependencies without invented imported Grant bodies', async () => {
  const { t, owner, scope } = await fixture();
  const { carrierId } = await t.run(async (ctx) => {
    const targetId = await ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Granted strength',
      ruleIdentity: 'pf1/Strength',
      stacksWithItself: false,
      sources: [],
      modifiers: [
        { target: 'ability.str', bonusType: 'enhancement', value: 2 },
      ],
      detail: { kind: 'feat' },
    });
    const carrierId = await ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Carrier',
      ruleIdentity: 'pf1/Carrier',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'feat' },
      grants: [{ catalogEntryId: targetId }],
    });
    return { carrierId };
  });
  await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: carrierId,
    operationId: 'carrier',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated.abilities.strength.score,
  ).toBe(12);
  await prepare(t, [
    {
      kind: 'definition',
      key: 'pf1/Carrier',
      payload: featPayload('pf1/Carrier'),
    },
    {
      kind: 'definition',
      key: 'pf1/Strength',
      payload: featPayload('pf1/Strength', [
        { target: 'ability.str', bonusType: 'enhancement', value: 4 },
      ]),
    },
  ]);
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 1,
  });
  await discover(t, runId);
  const result = await t.query(internal.catalogReleaseImpact.evaluate, {
    runId,
    characterId: scope.characterId,
  });
  expect(result.result).toMatchObject({
    kind: 'ready',
    facts: { strength: 14 },
    hasFactsChanged: true,
  });
  expect(
    await t.mutation(internal.catalogReleaseImpact.complete, {
      runId,
      characterId: scope.characterId,
      evaluation: result,
    }),
  ).toBe(true);
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated.abilities.strength.score,
  ).toBe(12);
});

test('a held feat whose rule-identity prerequisites change marks its sheet without disturbing unchanged feat details', async () => {
  const { t, owner, scope } = await fixture();
  const detail = {
    kind: 'feat' as const,
    featTypes: ['combat'],
    repeatable: 'no' as const,
  };
  const { powerAttackId, cleaveId } = await t.run(async (ctx) => ({
    powerAttackId: await ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'pf1/PowerAttack',
      ruleIdentity: 'pf1/PowerAttack',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail,
      prerequisites: [{ ability: 'strength', min: 13 }],
    }),
    cleaveId: await ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'pf1/Cleave',
      ruleIdentity: 'pf1/Cleave',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail,
      prerequisites: [{ feat: 'pf1/PowerAttack' }],
    }),
  }));
  for (const catalogEntryId of [powerAttackId, cleaveId])
    await owner.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId,
      operationId: `select-${catalogEntryId}`,
    });
  const payload = (
    key: string,
    prerequisites: ({ ability: 'strength'; min: number } | { feat: string })[],
  ) => ({
    ...featPayload(key),
    detail,
    prerequisites,
  });
  await prepare(t, [
    {
      kind: 'definition',
      key: 'pf1/PowerAttack',
      payload: payload('pf1/PowerAttack', [{ ability: 'strength', min: 15 }]),
    },
    {
      kind: 'definition',
      key: 'pf1/Cleave',
      payload: payload('pf1/Cleave', [{ feat: 'pf1/PowerAttack' }]),
    },
  ]);
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 1,
  });
  await discover(t, runId);
  const evaluation = await t.query(internal.catalogReleaseImpact.evaluate, {
    runId,
    characterId: scope.characterId,
  });
  expect(evaluation.result).toMatchObject({
    kind: 'ready',
    reasons: [powerAttackId, 'key:pf1/PowerAttack'].sort(),
  });
});

test('retained Grants and live references in a local Catalog Copy follow changed global bodies', async () => {
  const { t, owner, scope } = await fixture();
  const ids = await t.run(async (ctx) => {
    const target = await ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Target',
      ruleIdentity: 'pf1/Target',
      stacksWithItself: false,
      sources: [],
      modifiers: [
        { target: 'ability.str', bonusType: 'enhancement', value: 2 },
      ],
      detail: { kind: 'feat' },
    });
    const carrier = await ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Carrier',
      ruleIdentity: 'pf1/NewCarrier',
      grants: [{ catalogEntryId: target }],
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'feat' },
    });
    const copy = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: scope.characterId,
      name: 'Independent copy',
      ruleIdentity: 'pf1/Copy',
      copiedFrom: carrier,
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'feat' },
      grants: [{ catalogEntryId: target }],
    });
    return { target, carrier, copy };
  });
  await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: ids.carrier,
    operationId: 'select-carrier',
  });
  await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: ids.copy,
    operationId: 'select-copy',
  });
  await prepare(t, [
    {
      kind: 'definition',
      key: 'pf1/NewCarrier',
      payload: featPayload('pf1/NewCarrier'),
    },
    {
      kind: 'definition',
      key: 'pf1/Target',
      payload: featPayload('pf1/Target', [
        { target: 'ability.str', bonusType: 'enhancement', value: 4 },
      ]),
    },
  ]);
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 1,
  });
  await discover(t, runId);
  const candidate = await t.query(internal.catalogReleaseImpact.evaluate, {
    runId,
    characterId: scope.characterId,
  });
  expect(candidate.result).toMatchObject({
    kind: 'ready',
    facts: { strength: 14 },
    hasFactsChanged: true,
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated.abilities.strength.score,
  ).toBe(12);
});

test('new sheets and dependencies added after their discovery cursor are reconciled from their latest edits', async () => {
  const { t, owner, scope, campaignId } = await fixture();
  const target = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'New dependency',
      ruleIdentity: 'pf1/NewDependency',
      stacksWithItself: false,
      sources: [],
      modifiers: [
        { target: 'ability.str', bonusType: 'enhancement', value: 2 },
      ],
      detail: { kind: 'feat' },
    }),
  );
  await prepare(t, [
    {
      kind: 'definition',
      key: 'pf1/NewDependency',
      payload: featPayload('pf1/NewDependency', [
        { target: 'ability.str', bonusType: 'enhancement', value: 4 },
      ]),
    },
  ]);
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 1,
  });
  await discover(t, runId);
  await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: target,
    operationId: 'new-dependency',
  });
  const newId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'New sheet',
    kind: 'pc',
    operationId: 'after-cursor',
  });
  await owner.mutation(api.characterSheet.selectEntry, {
    organizationId: 'org',
    characterId: newId,
    catalogEntryId: target,
    operationId: 'new-sheet-dependency',
  });
  await owner.mutation(api.characterSheet.editBaseScores, {
    organizationId: 'org',
    characterId: newId,
    scores: { strength: 15 },
    operationId: 'new-sheet-score',
  });
  expect(
    await t.query(internal.catalogReleaseImpact.status, { runId }),
  ).toMatchObject({ isDiscoveryComplete: true, pendingCount: 2 });
  for (const [characterId, strength] of [
    [scope.characterId, 14],
    [newId, 19],
  ] as const) {
    const evaluation = await t.query(internal.catalogReleaseImpact.evaluate, {
      runId,
      characterId,
    });
    expect(evaluation.result).toMatchObject({
      kind: 'ready',
      facts: { strength },
    });
    await t.mutation(internal.catalogReleaseImpact.complete, {
      runId,
      characterId,
      evaluation,
    });
  }
  expect(
    await t.query(internal.catalogReleaseImpact.status, { runId }),
  ).toMatchObject({ isReady: true });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, {
        organizationId: 'org',
        characterId: newId,
      }),
    )?.calculated.abilities.strength.score,
  ).toBe(17);
});

test('candidate failures never reject active edits and bounded retry does not certify unavailable facts', async () => {
  const { t, owner, scope } = await fixture();
  const target = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Fractional candidate',
      ruleIdentity: 'pf1/Fractional',
      stacksWithItself: false,
      sources: [],
      modifiers: [
        { target: 'ability.str', bonusType: 'enhancement', value: 2 },
      ],
      detail: { kind: 'feat' },
    }),
  );
  await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: target,
    operationId: 'target',
  });
  await prepare(t, [
    {
      kind: 'definition',
      key: 'pf1/Fractional',
      payload: featPayload('pf1/Fractional', [
        { target: 'ability.str', bonusType: 'enhancement', value: 2.5 },
      ]),
    },
  ]);
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 1,
  });
  await discover(t, runId);
  const failed = await t.query(internal.catalogReleaseImpact.evaluate, {
    runId,
    characterId: scope.characterId,
  });
  expect(failed.result).toMatchObject({ kind: 'failed' });
  await t.mutation(internal.catalogReleaseImpact.complete, {
    runId,
    characterId: scope.characterId,
    evaluation: failed,
  });
  expect(
    await t.query(internal.catalogReleaseImpact.status, { runId }),
  ).toMatchObject({ isReady: false, failedCount: 1, pendingCount: 0 });
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 16 },
    operationId: 'active-valid',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated.abilities.strength.score,
  ).toBe(18);
  expect(
    await t.query(internal.catalogReleaseImpact.status, { runId }),
  ).toMatchObject({ failedCount: 0, pendingCount: 1 });
  await t.mutation(internal.catalogReleaseImpact.retry, {
    runId,
    characterId: scope.characterId,
  });
  expect(
    (
      await t.query(internal.catalogReleaseImpact.evaluate, {
        runId,
        characterId: scope.characterId,
      })
    ).result,
  ).toMatchObject({ kind: 'failed' });
});

test('oversized keyed discovery is an operator-visible failure while live edits stay available', async () => {
  const { t, owner, scope } = await fixture();
  await prepare(t, [
    {
      kind: 'definition',
      key: 'pf1/OversizedSpell',
      payload: {
        externalKey: 'pf1/OversizedSpell',
        upstreamKey: 'pf1/OversizedSpell',
        pack: 'spells',
        name: 'Oversized spell',
        detail: {
          kind: 'spell',
          levels: Object.fromEntries(
            Array.from({ length: 129 }, (_, i) => [`class${i}`, 1]),
          ),
          grantedLevels: {},
          school: 'evocation',
          subschools: [],
          descriptors: [],
        },
        description: '',
        sources: [],
        modifiers: [],
        unsupported: [],
      },
    },
  ]);
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 1,
  });
  await discover(t, runId);
  expect(
    await t.query(internal.catalogReleaseImpact.status, { runId }),
  ).toMatchObject({ isReady: false, failedCount: 1 });
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 18 },
    operationId: 'while-discovery-failed',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated.abilities.strength.score,
  ).toBe(18);
});

test('a copy with no retained reference is unaffected when only its provenance origin changes', async () => {
  const { t, owner, scope } = await fixture();
  const copy = await t.run(async (ctx) => {
    const original = await ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Origin',
      ruleIdentity: 'pf1/Origin',
      stacksWithItself: false,
      sources: [],
      modifiers: [
        { target: 'ability.str', bonusType: 'enhancement', value: 2 },
      ],
      detail: { kind: 'feat' },
    });
    return ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: scope.characterId,
      name: 'Copy',
      ruleIdentity: 'pf1/Origin',
      copiedFrom: original,
      stacksWithItself: false,
      sources: [],
      modifiers: [
        { target: 'ability.str', bonusType: 'enhancement', value: 2 },
      ],
      detail: { kind: 'feat' },
    });
  });
  await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: copy,
    operationId: 'copy',
  });
  await prepare(t, [
    {
      kind: 'definition',
      key: 'pf1/Origin',
      payload: featPayload('pf1/Origin', [
        { target: 'ability.str', bonusType: 'enhancement', value: 4 },
      ]),
    },
  ]);
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 1,
  });
  await discover(t, runId);
  expect(
    (
      await t.query(internal.catalogReleaseImpact.evaluate, {
        runId,
        characterId: scope.characterId,
      })
    ).result,
  ).toEqual({ kind: 'unaffected' });
});

test('private initialization, archive and deletion dirty the same candidate work without requiring a militia', async () => {
  const { t, owner, scope } = await fixture();
  await t.run(async (ctx) => {
    const user = await ctx.db
      .query('user')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', 'test|owner'),
      )
      .unique();
    if (!user) throw new Error('Missing fixture user');
    await ctx.db.patch('user', user._id, { characterSheetDemo: true });
  });
  await prepare(t);
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 1,
  });
  const characterId = await owner.mutation(api.characterSheet.create, {
    name: 'Private',
    kind: 'pc',
    operationId: 'private-create',
  });
  expect(
    await t.query(internal.catalogReleaseImpact.status, { runId }),
  ).toMatchObject({ pendingCount: 1 });
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 12 },
    operationId: 'before-archive',
  });
  const before = await t.query(internal.catalogReleaseImpact.evaluate, {
    runId,
    characterId: scope.characterId,
  });
  await owner.mutation(api.characterSheet.archive, {
    ...scope,
    isActive: false,
    operationId: 'archive',
  });
  expect(
    await t.mutation(internal.catalogReleaseImpact.complete, {
      runId,
      characterId: scope.characterId,
      evaluation: before,
    }),
  ).toBe(false);
  await owner.mutation(api.characterSheet.deletePrivate, {
    characterId,
    operationId: 'private-delete',
  });
  const deleted = await t.query(internal.catalogReleaseImpact.evaluate, {
    runId,
    characterId,
  });
  expect(deleted.result).toEqual({ kind: 'deleted' });
  expect(
    await t.mutation(internal.catalogReleaseImpact.complete, {
      runId,
      characterId,
      evaluation: deleted,
    }),
  ).toBe(true);
});

test('obsolete runs and changed comparison bases fence both discovery and delayed candidate results', async () => {
  const { t, owner, scope } = await fixture();
  await prepare(t);
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 1,
  });
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 12 },
    operationId: 'dirty',
  });
  const evaluation = await t.query(internal.catalogReleaseImpact.evaluate, {
    runId,
    characterId: scope.characterId,
  });
  await prepare(t, [], 2);
  const nextRun = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 2,
  });
  await expect(
    t.mutation(internal.catalogReleaseImpact.discover, { runId }),
  ).rejects.toThrow('superseded');
  await expect(
    t.mutation(internal.catalogReleaseImpact.complete, {
      runId,
      characterId: scope.characterId,
      evaluation,
    }),
  ).rejects.toThrow('superseded');
  await t.run((ctx) =>
    ctx.db.insert('catalogReleaseControl', {
      key: 'global',
      releaseNumber: 1,
      schemaIdentity: catalogRuntimeCompatibility.schema,
      calculationIdentity: catalogRuntimeCompatibility.calculation,
    }),
  );
  await expect(
    t.mutation(internal.catalogReleaseImpact.discover, { runId: nextRun }),
  ).rejects.toThrow('comparison base');
});

test('release impact operator writes share maintenance and stale Write Epoch fencing', async () => {
  const { t, owner, scope } = await fixture();
  await prepare(t);
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 1,
  });
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 12 },
    operationId: 'dirty',
  });
  const evaluation = await t.query(internal.catalogReleaseImpact.evaluate, {
    runId,
    characterId: scope.characterId,
  });
  const migration = await t.mutation(internal.initialMigration.start, {
    operationId: 'gate-impact',
    expectedEpoch: 0,
    frontendBuild: 'build',
    catalogManifest: 'manifest',
    maintenanceBudgetMs: 60000,
  });
  const writes = [
    () => t.mutation(internal.catalogReleaseImpact.start, { releaseNumber: 1 }),
    () => t.mutation(internal.catalogReleaseImpact.discover, { runId }),
    () =>
      t.mutation(internal.catalogReleaseImpact.complete, {
        runId,
        characterId: scope.characterId,
        evaluation,
      }),
    () =>
      t.mutation(internal.catalogReleaseImpact.retry, {
        runId,
        characterId: scope.characterId,
      }),
    () => t.mutation(internal.catalogReleaseImpact.retryDiscovery, { runId }),
  ];
  for (const write of writes)
    await expect(write()).rejects.toThrow('MAINTENANCE');
  await t.mutation(internal.initialMigration.abortBeforeActivation, {
    runId: migration.runId,
    epoch: migration.epoch,
  });
  for (const write of writes)
    await expect(write()).rejects.toThrow('RELOAD_REQUIRED');
  expect(
    await t.mutation(internal.catalogReleaseImpact.complete, {
      runId,
      characterId: scope.characterId,
      evaluation,
      writeEpoch: 2,
    }),
  ).toBe(true);
});

test('dormant local definitions keep their live global dependency in release impact discovery', async () => {
  const { t, scope } = await fixture();
  await t.run(async (ctx) => {
    const target = await ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Dormant dependency',
      ruleIdentity: 'pf1/DormantTarget',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'feat' },
    });
    const localId = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: scope.characterId,
      name: 'Future local Grant',
      ruleIdentity: 'homebrew:future',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'feat' },
      grants: [{ catalogEntryId: target }],
    });
    await ctx.db.insert('characterSheetEntry', {
      characterId: scope.characterId,
      catalogEntryId: localId,
      kind: 'feat',
      active: false,
      state: { kind: 'feat' },
    });
  });
  await prepare(t, [
    {
      kind: 'definition',
      key: 'pf1/DormantTarget',
      payload: featPayload('pf1/DormantTarget', [
        { target: 'ability.str', bonusType: 'enhancement', value: 2 },
      ]),
    },
  ]);
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 1,
  });
  await discover(t, runId);
  const result = await t.query(internal.catalogReleaseImpact.evaluate, {
    runId,
    characterId: scope.characterId,
  });
  expect(result.result).toMatchObject({
    kind: 'ready',
    facts: { strength: 10 },
    hasFactsChanged: false,
  });
});

test('keyed Spell Effect links follow the old and new release graph independently of sheet ID references', async () => {
  const { t, owner, scope } = await fixture();
  const effect = await t.run(async (ctx) => {
    await ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'pf1/KeyedSpell',
      ruleIdentity: 'pf1/KeyedSpell',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: {
        kind: 'spell',
        levels: { wizard: 1 },
        school: 'evocation',
        description: '',
      },
    });
    return ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'pf1/KeyedEffect',
      ruleIdentity: 'pf1/KeyedEffect',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: {
        kind: 'spellEffect',
        lastsOverOneDay: true,
        defaultCasterLevel: 1,
      },
    });
  });
  // This supported personal effect carries the global ID as an ordinary condition dependency.
  await owner.mutation(api.characterSheet.createPersonalAdjustment, {
    ...scope,
    name: 'Keyed effect dependency',
    modifiers: [
      {
        target: 'ability.str',
        bonusType: 'enhancement',
        value: 2,
        condition: { whileActive: effect },
      },
    ],
    operationId: 'keyed-source',
  });
  await prepare(t, [
    {
      kind: 'definition',
      key: 'pf1/KeyedEffect',
      payload: {
        ...featPayload('pf1/KeyedEffect'),
        detail: {
          kind: 'spellEffect',
          lastsOverOneDay: true,
          defaultCasterLevel: 1,
          spellKey: 'pf1/KeyedSpell',
        },
      },
    },
    {
      kind: 'definition',
      key: 'pf1/KeyedSpell',
      payload: {
        ...featPayload('pf1/KeyedSpell'),
        pack: 'spells',
        detail: {
          kind: 'spell',
          levels: { wizard: 2 },
          grantedLevels: { domain: { fire: 1 } },
          school: 'evocation',
          subschools: [],
          descriptors: [],
        },
      },
    },
  ]);
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 1,
  });
  await discover(t, runId);
  expect(
    (
      await t.query(internal.catalogReleaseImpact.evaluate, {
        runId,
        characterId: scope.characterId,
      })
    ).result,
  ).toMatchObject({
    kind: 'ready',
    reasons: expect.arrayContaining(['key:pf1/KeyedSpell']),
  });
});

// #720: the importer maps a race's size into its release body. Halfling,
// CRB p. 26: "Halflings are Small creatures".
test('a race candidate definition carries its release body size', async () => {
  const { t } = await fixture();
  const halfling = 'pf1/Hf31mrYb3uucNyLO';
  const definitionId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Halfling',
      ruleIdentity: halfling,
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'race', racialTraits: [], racialHitDice: 0 },
    }),
  );
  await prepare(t, [
    {
      kind: 'definition',
      key: halfling,
      payload: {
        ...featPayload(halfling),
        pack: 'races',
        name: 'Halfling',
        detail: {
          kind: 'race',
          racialHitDice: 0,
          size: 'small',
          creatureTypes: ['humanoid'],
          creatureSubtypes: ['halfling'],
          racialTraits: [],
        },
      },
    },
  ]);
  const candidate = await t.run(async (ctx) => {
    const release = await ctx.db
      .query('catalogRelease')
      .withIndex('by_releaseNumber', (q) => q.eq('releaseNumber', 1))
      .unique();
    const definition = await ctx.db.get('catalogEntry', definitionId);
    if (!release || !definition) throw new Error('Missing release fixture');
    return candidateDefinition(ctx, release, definition);
  });
  expect(candidate.detail).toEqual({
    kind: 'race',
    racialTraits: [],
    racialHitDice: 0,
    size: 'small',
    creatureTypes: ['humanoid'],
    creatureSubtypes: ['halfling'],
  });
});

// #716 P4: Eldritch Knight's advances as the PCGen mapper reads them
// (cr_classes.lst:415-423): none at level 1, one arcane at each of 2–10.
test('a prestige class candidate definition carries its release body casting advances', async () => {
  const { t } = await fixture();
  const eldritchKnight = 'everythingpath/eldritch-knight';
  const progression = {
    hitDie: 10,
    bab: 'full' as const,
    saves: {
      fort: 'good' as const,
      ref: 'poor' as const,
      will: 'poor' as const,
    },
    skillRanksPerLevel: 2,
  };
  const definitionId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Eldritch Knight',
      ruleIdentity: eldritchKnight,
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: {
        kind: 'class',
        classKind: 'prestige',
        ...progression,
        classSkills: [],
        featuresByLevel: [],
        picksByLevel: [],
      },
    }),
  );
  const castingAdvances = Array.from({ length: 9 }, (_, index) => ({
    classLevel: index + 2,
    kinds: ['arcane' as const],
  }));
  await prepare(t, [
    {
      kind: 'definition',
      key: eldritchKnight,
      payload: {
        ...featPayload(eldritchKnight),
        pack: 'roleplaying_game/core_rulebook',
        name: 'Eldritch Knight',
        detail: {
          kind: 'class',
          classKind: 'prestige',
          tag: 'eldritchKnight',
          ...progression,
          classSkills: ['skill.clm'],
          featuresByLevel: [],
          castingAdvances,
        },
      },
    },
  ]);
  const candidate = await t.run(async (ctx) => {
    const release = await ctx.db
      .query('catalogRelease')
      .withIndex('by_releaseNumber', (q) => q.eq('releaseNumber', 1))
      .unique();
    const definition = await ctx.db.get('catalogEntry', definitionId);
    if (!release || !definition) throw new Error('Missing release fixture');
    return candidateDefinition(ctx, release, definition);
  });
  expect(candidate.detail).toMatchObject({
    kind: 'class',
    classKind: 'prestige',
    castingAdvances,
  });
});

// #716 P5: Archer (APG p.104) as the PCGen archetype mapper writes it, by
// stable keys: Bravery's Foundry key at 2 and 6 (CRB p.55, Table 3-9), and
// Hawkeye at 2. The candidate names the stored IDs, and its part change the
// row's durable part.
test('an archetype candidate definition names stored IDs for its release body keys', async () => {
  const { t } = await fixture();
  const keys = {
    fighter: 'pf1/WLqBCT5DqmGAx8Wd',
    bravery: 'pf1/h0Brxw6khcjlEf1T',
    hawkeye: 'everythingpath/fighter-archer-hawkeye',
    archer: 'everythingpath/fighter-archer',
  };
  const ids = await t.run(async (ctx) => {
    const feature = (ruleIdentity: string) =>
      ctx.db.insert('catalogEntry', {
        scope: 'global',
        name: ruleIdentity,
        ruleIdentity,
        stacksWithItself: false,
        sources: [],
        modifiers: [],
        detail: { kind: 'classFeature' },
      });
    const bravery = await feature(keys.bravery);
    const hawkeye = await feature(keys.hawkeye);
    const fighter = await ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Fighter',
      ruleIdentity: keys.fighter,
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: {
        kind: 'class',
        classKind: 'base',
        hitDie: 10,
        bab: 'full',
        saves: { fort: 'good', ref: 'poor', will: 'poor' },
        skillRanksPerLevel: 2,
        classSkills: [],
        featuresByLevel: [
          { classLevel: 2, catalogEntryId: bravery },
          { classLevel: 6, catalogEntryId: bravery },
        ],
        picksByLevel: [],
      },
    });
    const archer = await ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Archer',
      ruleIdentity: keys.archer,
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: {
        kind: 'archetype',
        classEntryIds: [fighter],
        replaces: [],
        adds: [],
      },
    });
    return { bravery, hawkeye, fighter, archer };
  });
  await prepare(t, [
    {
      kind: 'definition',
      key: keys.archer,
      payload: {
        ...featPayload(keys.archer),
        pack: 'roleplaying_game/advanced_players_guide',
        name: 'Archer',
        detail: {
          kind: 'archetype',
          classKeys: [keys.fighter],
          replaces: [
            { classLevel: 2, externalKey: keys.bravery, scope: 'whole' },
          ],
          adds: [{ classLevel: 2, externalKey: keys.hawkeye }],
          featureChanges: [
            { externalKey: keys.bravery, scope: 'part', classLevel: 6 },
          ],
          classSkillsAdded: ['skill.acr'],
        },
      },
    },
  ]);
  const candidate = await t.run(async (ctx) => {
    const release = await ctx.db
      .query('catalogRelease')
      .withIndex('by_releaseNumber', (q) => q.eq('releaseNumber', 1))
      .unique();
    const definition = await ctx.db.get('catalogEntry', ids.archer);
    if (!release || !definition) throw new Error('Missing release fixture');
    return candidateDefinition(ctx, release, definition);
  });
  expect(candidate.detail).toEqual({
    kind: 'archetype',
    classEntryIds: [ids.fighter],
    replaces: [{ classLevel: 2, catalogEntryId: ids.bravery, scope: 'whole' }],
    adds: [{ classLevel: 2, catalogEntryId: ids.hawkeye }],
    featureChanges: [
      {
        featureIdentity: keys.bravery,
        scope: 'part',
        part: `6:${keys.bravery}`,
      },
    ],
    classSkillsAdded: ['skill.acr'],
  });
});

// #716 P5: a whole Bravery change and a part change of its 6th-level
// increment conflict (PRD §7: whole-feature alterations conflict with any
// affected part). Both increments gain their parent in release 1, with the
// archetypes; a release 2 may then retire the increments, whose retained
// bodies keep their parent and part.
async function braveryConflict({
  retireIncrements,
}: {
  retireIncrements: boolean;
}) {
  const { t } = await fixture();
  const parent = 'everythingpath/fighter-bravery';
  const keys = {
    fighter: 'pf1/WLqBCT5DqmGAx8Wd',
    second: 'everythingpath/fighter-bravery-2',
    sixth: 'everythingpath/fighter-bravery-6',
    whole: 'everythingpath/fighter-whole-bravery',
    part: 'everythingpath/fighter-sixth-bravery',
  };
  const ids = await t.run(async (ctx) => {
    const base = (ruleIdentity: string) => ({
      scope: 'global' as const,
      name: ruleIdentity,
      ruleIdentity,
      stacksWithItself: false,
      sources: [],
      modifiers: [],
    });
    const feature = (key: string) =>
      ctx.db.insert('catalogEntry', {
        ...base(key),
        detail: { kind: 'classFeature' },
      });
    const second = await feature(keys.second);
    const sixth = await feature(keys.sixth);
    const fighter = await ctx.db.insert('catalogEntry', {
      ...base(keys.fighter),
      detail: {
        kind: 'class',
        classKind: 'base',
        hitDie: 10,
        bab: 'full',
        saves: { fort: 'good', ref: 'poor', will: 'poor' },
        skillRanksPerLevel: 2,
        classSkills: [],
        featuresByLevel: [
          { classLevel: 2, catalogEntryId: second },
          { classLevel: 6, catalogEntryId: sixth },
        ],
        picksByLevel: [],
      },
    });
    const archetype = (key: string) =>
      ctx.db.insert('catalogEntry', {
        ...base(key),
        detail: {
          kind: 'archetype',
          classEntryIds: [fighter],
          replaces: [],
          adds: [],
        },
      });
    return {
      fighter,
      second,
      sixth,
      whole: await archetype(keys.whole),
      part: await archetype(keys.part),
    };
  });
  const increment = (key: string, part: string): ReleaseRow => ({
    kind: 'definition',
    key,
    payload: {
      ...featPayload(key),
      detail: { kind: 'classFeature', parentFeature: parent, part },
    },
  });
  const archetype = (
    key: string,
    featureChange:
      | { externalKey: string; scope: 'whole' }
      | { externalKey: string; scope: 'part'; classLevel: number },
  ): ReleaseRow => ({
    kind: 'definition',
    key,
    payload: {
      ...featPayload(key),
      detail: {
        kind: 'archetype',
        classKeys: [keys.fighter],
        replaces: [],
        adds: [],
        featureChanges: [featureChange],
      },
    },
  });
  const archetypes = [
    archetype(keys.whole, { externalKey: keys.second, scope: 'whole' }),
    archetype(keys.part, {
      externalKey: keys.sixth,
      scope: 'part',
      classLevel: 6,
    }),
  ];
  const increments = [increment(keys.second, '2'), increment(keys.sixth, '6')];
  const base = await prepare(t, [...increments, ...archetypes]);
  if (retireIncrements) {
    await t.run((ctx) =>
      ctx.db.insert('catalogReleaseControl', {
        key: 'global',
        releaseNumber: 1,
        schemaIdentity: catalogRuntimeCompatibility.schema,
        calculationIdentity: catalogRuntimeCompatibility.calculation,
      }),
    );
    // Release 2 retires both increments and keeps their last usable bodies,
    // as the release builder does (scripts/catalog/release.ts:530-537).
    const retirements = increments.map(
      ({ key, payload }): ReleaseRow => ({
        kind: 'report',
        key: `retirement:${key}`,
        payload: {
          externalKey: key,
          kind: 'definition',
          state: 'retired',
          lastUsableDefinition: payload,
          definitionFingerprint: computeFingerprint(payload),
        },
      }),
    );
    await prepare(t, [...archetypes, ...retirements], 2, {
      baseRelease: {
        releaseNumber: 1,
        artifactFingerprint: base.manifest.artifactFingerprint,
      },
    });
  }
  const releaseNumber = retireIncrements ? 2 : 1;
  const candidates = await t.run(async (ctx) => {
    const release = await ctx.db
      .query('catalogRelease')
      .withIndex('by_releaseNumber', (q) =>
        q.eq('releaseNumber', releaseNumber),
      )
      .unique();
    if (!release) throw new Error('Missing release fixture');
    const read = async (id: Id<'catalogEntry'>) => {
      const definition = await ctx.db.get('catalogEntry', id);
      if (!definition) throw new Error('Missing definition fixture');
      return candidateDefinition(ctx, release, definition);
    };
    return Promise.all(
      [ids.fighter, ids.second, ids.sixth, ids.whole, ids.part].map(read),
    );
  });
  const changes = candidates.flatMap(({ detail }) =>
    detail.kind === 'archetype' ? (detail.featureChanges ?? []) : [],
  );
  const resolved = resolveCharacterSheetArchetypes({
    entries: [
      ...Array.from({ length: 6 }, (_, index) => ({
        _id: `level-${index + 1}`,
        kind: 'classLevel' as const,
        active: true as const,
        state: {
          kind: 'classLevel' as const,
          classEntryId: ids.fighter,
          position: index + 1,
          hpGained: 10,
        },
      })),
      ...[ids.whole, ids.part].map((catalogEntryId) => ({
        _id: `selection-${catalogEntryId}`,
        kind: 'archetype' as const,
        catalogEntryId,
        active: true,
        state: { kind: 'archetype' as const },
      })),
    ],
    catalogEntries: candidates.map(({ _id, name, ruleIdentity, detail }) => ({
      _id,
      name,
      ruleIdentity,
      modifiers: [],
      detail,
    })),
  });
  return {
    parent,
    changes,
    conflicts: resolved.conflicts.map(({ featureIdentity, part }) => [
      featureIdentity,
      part,
    ]),
  };
}

for (const [retireIncrements, name] of [
  [false, 'the same release'],
  [true, 'retained bodies after a release retires them'],
] as const)
  test(`archetype candidates take feature parents and parts from ${name}`, async () => {
    const { parent, changes, conflicts } = await braveryConflict({
      retireIncrements,
    });
    expect(changes).toEqual([
      { featureIdentity: parent, scope: 'whole' },
      { featureIdentity: parent, scope: 'part', part: '6' },
    ]);
    expect(conflicts).toEqual([[parent, null]]);
  });

// #716 P5: an archetype feature increment keeps its durable parent and part.
test('a class feature candidate definition carries its release body parent and part', async () => {
  const { t } = await fixture();
  const key = 'everythingpath/fighter-archer-hawkeye';
  const id = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Hawkeye',
      ruleIdentity: key,
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'classFeature' },
    }),
  );
  await prepare(t, [
    {
      kind: 'definition',
      key,
      payload: {
        ...featPayload(key),
        name: 'Hawkeye',
        detail: {
          kind: 'classFeature',
          parentFeature: 'everythingpath/fighter-archer-hawkeye',
          part: '2',
        },
      },
    },
  ]);
  const candidate = await t.run(async (ctx) => {
    const release = await ctx.db
      .query('catalogRelease')
      .withIndex('by_releaseNumber', (q) => q.eq('releaseNumber', 1))
      .unique();
    const definition = await ctx.db.get('catalogEntry', id);
    if (!release || !definition) throw new Error('Missing release fixture');
    return candidateDefinition(ctx, release, definition);
  });
  expect(candidate.detail).toEqual({
    kind: 'classFeature',
    parentFeature: 'everythingpath/fighter-archer-hawkeye',
    part: '2',
  });
});

test('the real reconciliation command uses candidate casting resources while seed defaults and active state stay intact', async () => {
  const { t, owner, scope } = await fixture();
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const wizard = before?.catalogEntries.find(
    (row) => row.detail.kind === 'class' && row.ruleIdentity === 'wizard',
  );
  const level = before?.entries.find((row) => row.kind === 'classLevel');
  if (!wizard || !level) throw new Error('Missing fixture class');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: wizard._id,
    hpGained: 5,
    operationId: 'wizard',
  });
  const candidateTables = structuredClone(castingTables);
  const firstRow = candidateTables.tables['prepared-full'].rows[0];
  if (!firstRow) throw new Error('Missing casting fixture row');
  firstRow.spellsPerDay[1] = 7;
  await prepare(t, [
    {
      kind: 'resource',
      key: 'builtin:casting-tables',
      payload: {
        definitions: candidateTables,
        sourceFingerprint: 'a'.repeat(64),
        compatibility: catalogRuntimeCompatibility,
      },
    },
    {
      kind: 'resource',
      key: 'builtin:representative-class-catalog',
      payload: {
        definitions: parseReleaseJson(
          JSON.parse(canonicalReleaseJson(representativeClassCatalog)),
        ),
        sourceFingerprint: 'a'.repeat(64),
        compatibility: catalogRuntimeCompatibility,
      },
    },
    {
      kind: 'resource',
      key: 'builtin:representative-race-catalog',
      payload: {
        definitions: parseReleaseJson(
          JSON.parse(canonicalReleaseJson(representativeRaceCatalog)),
        ),
        sourceFingerprint: 'a'.repeat(64),
        compatibility: catalogRuntimeCompatibility,
      },
    },
  ]);
  const active = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 1,
  });
  await discover(t, runId);
  const evaluation = await t.query(internal.catalogReleaseImpact.evaluate, {
    runId,
    characterId: scope.characterId,
  });
  expect(evaluation.result).toMatchObject({
    kind: 'ready',
    castingEvidence: expect.arrayContaining([
      { classTag: 'wizard', spellLevel: 1, base: 7, total: 7 },
    ]),
  });
  expect(
    active?.calculated.spellcastings[0]?.slots.find(
      (slot) => slot.spellLevel === 1,
    )?.base,
  ).toBe(1);
  const result = await runCatalogReleaseImpactCommand({
    releaseNumber: 1,
    adapter: impactAdapter(t),
  });
  expect(result).toMatchObject({
    stopped: 'ready',
    status: { isReady: true, pendingCount: 0, failedCount: 0 },
  });
  const work = await t.query(internal.catalogReleaseImpact.inspectWork, {
    runId: result.runId,
    state: 'ready',
    paginationOpts: {
      cursor: null,
      numItems: 10,
      maximumRowsRead: 10,
      maximumBytesRead: 512000,
    },
  });
  expect(work.page).toEqual([
    expect.objectContaining({
      characterId: scope.characterId,
      hasFactsChanged: false,
      reasons: expect.arrayContaining(['resource:builtin:casting-tables']),
    }),
  ]);
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
  ).toEqual(active);
});

test('the real command resumes discovery and re-evaluates a raced worker result without restoring an earlier edit', async () => {
  const { t, owner, scope, campaignId } = await fixture();
  const target = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Command target',
      ruleIdentity: 'pf1/CommandTarget',
      stacksWithItself: false,
      sources: [],
      modifiers: [
        { target: 'ability.str', bonusType: 'enhancement', value: 2 },
      ],
      detail: { kind: 'feat' },
    }),
  );
  await prepare(t, [
    {
      kind: 'definition',
      key: 'pf1/CommandTarget',
      payload: featPayload('pf1/CommandTarget', [
        { target: 'ability.str', bonusType: 'enhancement', value: 4 },
      ]),
    },
  ]);
  const adapter = impactAdapter(t);
  let newCharacterId: Id<'character'> | undefined;
  let raced = false;
  const interleaved: CatalogReleaseImpactCommandAdapter = {
    ...adapter,
    discover: async (args) => {
      const done = await adapter.discover(args);
      if (!newCharacterId) {
        newCharacterId = await owner.mutation(api.characterSheet.create, {
          organizationId: 'org',
          campaignId,
          name: 'During discovery',
          kind: 'pc',
          operationId: 'new-during-discovery',
        });
        await owner.mutation(api.characterSheet.selectEntry, {
          organizationId: 'org',
          characterId: newCharacterId,
          catalogEntryId: target,
          operationId: 'new-ref-during-discovery',
        });
      }
      return done;
    },
    evaluate: async (args) => {
      const result = await adapter.evaluate(args);
      if (args.characterId === scope.characterId && !raced) {
        raced = true;
        await owner.mutation(api.characterSheet.selectEntry, {
          ...scope,
          catalogEntryId: target,
          operationId: 'during-worker',
        });
        await owner.mutation(api.characterSheet.editBaseScores, {
          ...scope,
          scores: { strength: 16 },
          operationId: 'keep-current-edit',
        });
      }
      return result;
    },
  };
  const partial = await runCatalogReleaseImpactCommand({
    releaseNumber: 1,
    adapter: interleaved,
    maxSteps: 1,
  });
  expect(partial.stopped).toBe('limit');
  const final = await runCatalogReleaseImpactCommand({
    releaseNumber: 1,
    adapter: interleaved,
  });
  expect(final).toMatchObject({
    runId: partial.runId,
    stopped: 'ready',
    staleCompletionCount: 1,
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated.abilities.strength.score,
  ).toBe(18);
  const work = await t.query(internal.catalogReleaseImpact.inspectWork, {
    runId: final.runId,
    state: 'ready',
    paginationOpts: {
      cursor: null,
      numItems: 10,
      maximumRowsRead: 10,
      maximumBytesRead: 512000,
    },
  });
  expect(work.page.map((row) => row.facts?.strength).sort()).toEqual([14, 20]);
});

test('a resolver-only candidate uses a supported coherent prior release and keeps intervening active edits', async () => {
  const { t, owner, scope } = await fixture();
  const priorIdentity = retainedPriorCalculationIdentity;
  const base = await prepare(t, [], 1, {
    compatibility: {
      schema: catalogRuntimeCompatibility.schema,
      calculation: priorIdentity,
    },
  });
  await t.run((ctx) =>
    ctx.db.insert('catalogReleaseControl', {
      key: 'global',
      releaseNumber: 1,
      schemaIdentity: catalogRuntimeCompatibility.schema,
      calculationIdentity: priorIdentity,
    }),
  );
  await prepare(t, [], 2, {
    baseRelease: {
      releaseNumber: 1,
      artifactFingerprint: base.manifest.artifactFingerprint,
    },
  });
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 2,
  });
  await discover(t, runId);
  const earlier = await t.query(internal.catalogReleaseImpact.evaluate, {
    runId,
    characterId: scope.characterId,
  });
  expect(earlier.result).toMatchObject({
    kind: 'ready',
    hasFactsChanged: false,
    reasons: ['calculation'],
  });
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 17 },
    operationId: 'resolver-only-active-edit',
  });
  expect(
    await t.mutation(internal.catalogReleaseImpact.complete, {
      runId,
      characterId: scope.characterId,
      evaluation: earlier,
    }),
  ).toBe(false);
  const current = await t.query(internal.catalogReleaseImpact.evaluate, {
    runId,
    characterId: scope.characterId,
  });
  expect(current.result).toMatchObject({
    kind: 'ready',
    facts: { strength: 17 },
    hasFactsChanged: false,
    reasons: ['calculation'],
  });
  expect(
    await t.mutation(internal.catalogReleaseImpact.complete, {
      runId,
      characterId: scope.characterId,
      evaluation: current,
    }),
  ).toBe(true);
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated.abilities.strength.score,
  ).toBe(17);
});

test('discarded release metadata still consumes the candidate read budget and never blocks a valid active edit', async () => {
  const { t, owner, scope } = await fixture();
  await t.run(async (ctx) => {
    const references = [];
    for (let index = 0; index < 4; index++)
      references.push({
        catalogEntryId: await ctx.db.insert('catalogEntry', {
          scope: 'global',
          name: `pf1/Large${index}`,
          ruleIdentity: `pf1/Large${index}`,
          stacksWithItself: false,
          sources: [],
          modifiers: [],
          detail: { kind: 'feat' },
        }),
      });
    const localId = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: scope.characterId,
      name: 'Large dormant graph',
      ruleIdentity: 'local:large-graph',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'feat' },
      grants: references,
    });
    await ctx.db.insert('characterSheetEntry', {
      characterId: scope.characterId,
      catalogEntryId: localId,
      kind: 'feat',
      active: false,
      state: { kind: 'feat' },
    });
  });
  await prepare(
    t,
    Array.from({ length: 4 }, (_, index) => ({
      kind: 'definition' as const,
      key: `pf1/Large${index}`,
      payload: {
        ...featPayload(`pf1/Large${index}`, [
          { target: 'ability.str', bonusType: 'enhancement', value: 2 },
        ]),
        description: 'x'.repeat(350000),
      },
    })),
  );
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 1,
  });
  await discover(t, runId);
  const evaluation = await t.query(internal.catalogReleaseImpact.evaluate, {
    runId,
    characterId: scope.characterId,
  });
  expect(evaluation.result).toMatchObject({
    kind: 'failed',
    error: expect.stringContaining('byte limit'),
  });
  await t.mutation(internal.catalogReleaseImpact.complete, {
    runId,
    characterId: scope.characterId,
    evaluation,
  });
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 18 },
    operationId: 'active-through-budget-failure',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated.abilities.strength.score,
  ).toBe(18);
});
