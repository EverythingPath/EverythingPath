/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { beforeAll, expect, test } from 'vitest';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';
import { preloadCalledConvexModules } from '../tests/convex-modules';
import {
  impactAdapter,
  prepare,
  releaseFixture,
  type ReleaseTest,
} from '../tests/catalog-release-fixture';
import {
  buildCleric12,
  buildWizard12,
  importedSpell,
  pinnedSpellsAt,
  publishedRows,
  type PinnedSpell,
} from '../tests/level-twelve-sheets';
import type { AllocationBatch } from '../src/lib/catalog/identity-allocation';
import { catalogReleaseLimits } from '../src/lib/catalog/release-limits';
import { runCatalogReleaseImpactCommand } from '../scripts/catalog/release-impact-command';
import type { Id } from './_generated/dataModel';
import { internal } from './_generated/api';
import schema from './schema';
import { complete, evaluate } from './catalogReleaseImpact';

// #413 F2 (#732 P-11): release reconciliation's row, definition and
// relationship limits, measured on level-12 builds from published content
// and held to a quarter of Convex's transaction limits.

const modules = import.meta.glob('./**/*.ts');
beforeAll(() => refuseRepeatedPaginatedQueries(schema, modules));
preloadCalledConvexModules({ modules, testFile: import.meta.url });

const MiB = 1 << 20;
/** Convex's transaction limits (convex-test's defaults, `transactionLimits: true`). */
const convexLimits = {
  bytesRead: 16 * MiB,
  documentsRead: 32_000,
  databaseQueries: 4_096,
  bytesWritten: 16 * MiB,
  documentsWritten: 16_000,
};
const metrics = Object.keys(convexLimits).filter(
  (metric): metric is keyof typeof convexLimits =>
    Object.hasOwn(convexLimits, metric),
);

/** A registered function's handler, to run inside one measured transaction. */
function handlerOf(registered: unknown) {
  const handler: unknown = Reflect.get(Object(registered), '_handler');
  if (typeof handler !== 'function') throw new Error('Not a Convex function');
  return handler;
}

/**
 * What `evaluate` and then `complete` read and write for one dirty
 * Character, each in its own transaction, as Convex transaction metrics.
 */
async function measureWorker(
  t: ReleaseTest,
  runId: Id<'catalogImpactRun'>,
  characterId: Id<'character'>,
) {
  await t.mutation(internal.catalogReleaseImpact.retry, {
    runId,
    characterId,
  });
  const measured = async (registered: unknown, args: object) =>
    await t.run(async (ctx) => {
      const before = await ctx.meta.getTransactionMetrics();
      const result: unknown = await Reflect.apply(
        handlerOf(registered),
        undefined,
        [ctx, args],
      );
      const after = await ctx.meta.getTransactionMetrics();
      const used = Object.fromEntries(
        metrics.map((metric) => [
          metric,
          after[metric].used - before[metric].used,
        ]),
      );
      return { result: JSON.stringify(result), used };
    });
  const evaluation = await t.query(internal.catalogReleaseImpact.evaluate, {
    runId,
    characterId,
  });
  const read = await measured(evaluate, { runId, characterId });
  const written = await measured(complete, { runId, characterId, evaluation });
  expect(written.result).toBe('true');
  return { evaluate: read.used, complete: written.used };
}

/** Each worker transaction's use is within `share` of every Convex limit. */
function expectWithin(
  measured: Awaited<ReturnType<typeof measureWorker>>,
  share: number,
) {
  for (const used of [measured.evaluate, measured.complete])
    for (const metric of metrics)
      expect(used[metric] ?? 0).toBeLessThanOrEqual(
        convexLimits[metric] * share,
      );
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
 * A first release of everything the sheets use, with both 1st-level class
 * lists, so each list has more changed Spells than reconciliation names.
 */
async function prepareFirstRelease(t: ReleaseTest, spells: PinnedSpell[]) {
  const unique = new Map(
    [
      ...spells,
      ...pinnedSpellsAt('wizard', 1, 117),
      ...pinnedSpellsAt('cleric', 1, 64),
    ].map((spell) => [spell.key, spell]),
  );
  await prepare(t, [
    ...publishedRows(),
    ...[...unique.values()].map((spell) => ({
      kind: 'definition' as const,
      key: spell.key,
      payload: importedSpell(spell, `${spell.name}, as published.`),
    })),
  ]);
  await allocateAll(t);
  return runCatalogReleaseImpactCommand({
    adapter: impactAdapter(t),
    releaseNumber: 1,
    maxSteps: 20_000,
  });
}

async function usageOf(
  t: ReleaseTest,
  runId: Id<'catalogImpactRun'>,
  characterId: Id<'character'>,
) {
  const evaluation = await t.query(internal.catalogReleaseImpact.evaluate, {
    runId,
    characterId,
  });
  expect(evaluation.result.kind).toBe('ready');
  return evaluation.usage;
}

test('a typical Wizard 12 and a Cleric 12 reconcile within a quarter of Convex limits, with each limit’s use measured', async () => {
  const fixture = await releaseFixture(modules, { transactionLimits: true });
  const { t, scope, create } = fixture;
  const wizard = await buildWizard12(fixture, scope);
  const clericId = await create('Cleric');
  await buildCleric12(fixture, { ...scope, characterId: clericId });
  const result = await prepareFirstRelease(t, wizard.spellbook);
  expect(result).toMatchObject({
    stopped: 'ready',
    status: { isReady: true, failedCount: 0 },
  });
  const wizardUsage = await usageOf(t, result.runId, scope.characterId);
  const clericUsage = await usageOf(t, result.runId, clericId);
  const wizardWorker = await measureWorker(t, result.runId, scope.characterId);
  const clericWorker = await measureWorker(t, result.runId, clericId);
  expectWithin(wizardWorker, 1 / 4);
  expectWithin(clericWorker, 1 / 4);
  // Measured (2026-11-12); the limits leave each at most two-thirds used.
  expect({
    wizard: { usage: wizardUsage, ...wizardWorker },
    cleric: { usage: clericUsage, ...clericWorker },
  }).toMatchInlineSnapshot(`
      {
        "cleric": {
          "complete": {
            "bytesRead": 98336,
            "bytesWritten": 4349,
            "databaseQueries": 455,
            "documentsRead": 358,
            "documentsWritten": 2,
          },
          "evaluate": {
            "bytesRead": 92859,
            "bytesWritten": 0,
            "databaseQueries": 450,
            "documentsRead": 353,
            "documentsWritten": 0,
          },
          "usage": {
            "definitions": 48,
            "keyedDependencies": 81,
            "keyedRelationships": 32,
            "relationships": 57,
            "sheetRows": 54,
          },
        },
        "wizard": {
          "complete": {
            "bytesRead": 514379,
            "bytesWritten": 8666,
            "databaseQueries": 889,
            "documentsRead": 1280,
            "documentsWritten": 2,
          },
          "evaluate": {
            "bytesRead": 504585,
            "bytesWritten": 0,
            "databaseQueries": 884,
            "documentsRead": 1275,
            "documentsWritten": 0,
          },
          "usage": {
            "definitions": 155,
            "keyedDependencies": 147,
            "keyedRelationships": 32,
            "relationships": 132,
            "sheetRows": 129,
          },
        },
      }
    `);
  for (const usage of [wizardUsage, clericUsage]) {
    if (!usage) throw new Error('Missing usage');
    expect(usage.sheetRows * 1.5).toBeLessThanOrEqual(
      catalogReleaseLimits.sheetRows,
    );
    expect(
      Math.max(usage.definitions, usage.keyedDependencies) * 1.5,
    ).toBeLessThanOrEqual(catalogReleaseLimits.dependencies);
    expect(
      Math.max(usage.relationships, usage.keyedRelationships) * 1.5,
    ).toBeLessThanOrEqual(catalogReleaseLimits.relationships);
  }
}, 300_000);

test('a sheet at the row limit reconciles with each worker transaction within a quarter of Convex limits', async () => {
  const fixture = await releaseFixture(modules, { transactionLimits: true });
  const { t, scope } = fixture;
  const wizard = await buildWizard12(fixture, scope);
  await fillToRows(t, scope.characterId, catalogReleaseLimits.sheetRows);
  const result = await prepareFirstRelease(t, wizard.spellbook);
  expect(result).toMatchObject({ stopped: 'ready' });
  expect(await usageOf(t, result.runId, scope.characterId)).toMatchObject({
    sheetRows: catalogReleaseLimits.sheetRows,
  });
  const measured = await measureWorker(t, result.runId, scope.characterId);
  expectWithin(measured, 1 / 4);
  expect(measured).toMatchInlineSnapshot(`
      {
        "complete": {
          "bytesRead": 564163,
          "bytesWritten": 8666,
          "databaseQueries": 889,
          "documentsRead": 1534,
          "documentsWritten": 2,
        },
        "evaluate": {
          "bytesRead": 554369,
          "bytesWritten": 0,
          "databaseQueries": 884,
          "documentsRead": 1529,
          "documentsWritten": 0,
        },
      }
    `);
}, 300_000);

test('a sheet near the definition limit keeps each worker transaction within half of Convex limits', async () => {
  const fixture = await releaseFixture(modules, { transactionLimits: true });
  const { t, scope } = fixture;
  const wizard = await buildWizard12(fixture, scope);
  await addDistinctGear(t, scope.characterId, 96);
  const result = await prepareFirstRelease(t, wizard.spellbook);
  expect(result).toMatchObject({ stopped: 'ready' });
  const usage = await usageOf(t, result.runId, scope.characterId);
  expect(usage?.definitions).toBeGreaterThan(
    catalogReleaseLimits.dependencies - 16,
  );
  expect(usage?.definitions).toBeLessThanOrEqual(
    catalogReleaseLimits.dependencies,
  );
  // Index ranges grow with definitions; at the limit they stay under half.
  const measured = await measureWorker(t, result.runId, scope.characterId);
  expectWithin(measured, 1 / 2);
  expect({ usage, ...measured }).toMatchInlineSnapshot(`
      {
        "complete": {
          "bytesRead": 594595,
          "bytesWritten": 8666,
          "databaseQueries": 1849,
          "documentsRead": 1664,
          "documentsWritten": 2,
        },
        "evaluate": {
          "bytesRead": 584801,
          "bytesWritten": 0,
          "databaseQueries": 1844,
          "documentsRead": 1659,
          "documentsWritten": 0,
        },
        "usage": {
          "definitions": 251,
          "keyedDependencies": 243,
          "keyedRelationships": 32,
          "relationships": 228,
          "sheetRows": 225,
        },
      }
    `);
}, 300_000);

test('an oversized sheet is reported by Character and limit and still blocks the release while others reconcile', async () => {
  const fixture = await releaseFixture(modules, { transactionLimits: true });
  const { t, scope, create } = fixture;
  const wizard = await buildWizard12(fixture, scope);
  const largeId = await create('Hoarder');
  await fillToRows(t, largeId, catalogReleaseLimits.sheetRows + 1);
  const result = await prepareFirstRelease(t, wizard.spellbook);
  expect(result).toMatchObject({
    stopped: 'failed',
    status: {
      isReady: false,
      failedCount: 1,
      failures: [
        {
          characterId: largeId,
          error: `Sheet exceeds the ${catalogReleaseLimits.sheetRows}-row release impact limit`,
        },
      ],
    },
  });
  expect(
    (
      await t.query(internal.catalogReleaseImpact.evaluate, {
        runId: result.runId,
        characterId: scope.characterId,
      })
    ).result.kind,
  ).toBe('ready');
  expect(
    await t.mutation(internal.catalogReleaseImpact.finish, {
      runId: result.runId,
    }),
  ).toBe(false);
}, 300_000);

/** Adds published gear until the sheet holds `rows` rows. */
async function fillToRows(
  t: ReleaseTest,
  characterId: Id<'character'>,
  rows: number,
) {
  await t.run(async (ctx) => {
    const existing = await ctx.db
      .query('characterSheetEntry')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .take(rows + 1);
    const gear = await ctx.db
      .query('catalogEntry')
      .withIndex('by_scope_and_ruleIdentity', (q) =>
        q.eq('scope', 'global').eq('ruleIdentity', 'pf1/item-bedroll'),
      )
      .unique();
    const bedroll =
      gear?._id ??
      (await ctx.db.insert('catalogEntry', {
        scope: 'global',
        name: 'Bedroll',
        ruleIdentity: 'pf1/item-bedroll',
        stacksWithItself: false,
        modifiers: [],
        sources: [{ book: 'PZO1110' }],
        detail: { kind: 'item', consumable: false },
      }));
    for (let row = existing.length; row < rows; row++)
      await ctx.db.insert('characterSheetEntry', {
        characterId,
        kind: 'item',
        active: true,
        catalogEntryId: bedroll,
        state: { kind: 'item' },
      });
  });
}

/** Adds `count` distinct trade goods, each its own global definition. */
async function addDistinctGear(
  t: ReleaseTest,
  characterId: Id<'character'>,
  count: number,
) {
  await t.run(async (ctx) => {
    for (let index = 0; index < count; index++) {
      const catalogEntryId = await ctx.db.insert('catalogEntry', {
        scope: 'global',
        name: `Trade good ${index}`,
        ruleIdentity: `pf1/item-trade-good-${index}`,
        stacksWithItself: false,
        modifiers: [],
        sources: [{ book: 'PZO1110' }],
        detail: { kind: 'item', consumable: false },
      });
      await ctx.db.insert('characterSheetEntry', {
        characterId,
        kind: 'item',
        active: true,
        catalogEntryId,
        state: { kind: 'item' },
      });
    }
  });
}
