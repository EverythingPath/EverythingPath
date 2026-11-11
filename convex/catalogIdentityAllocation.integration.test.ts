/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { beforeAll, expect, test } from 'vitest';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';
import { preloadCalledConvexModules } from '../tests/convex-modules';
import {
  prepare,
  releaseFixture,
  type ReleaseTest,
} from '../tests/catalog-release-fixture';
import type { AllocationBatch } from '../src/lib/catalog/identity-allocation';
import type { ReleaseRow } from '../src/lib/catalog/release-schema';
import { internal } from './_generated/api';
import schema from './schema';

// #413 F1: the identity allocator's conflicts and refusals on small
// synthetic releases. The real pinned bodies, interruption and readiness
// are proven at the scope seam (catalogReleaseScope.integration.test.ts).

const modules = import.meta.glob('./**/*.ts');
beforeAll(() => refuseRepeatedPaginatedQueries(schema, modules));
preloadCalledConvexModules({ modules, testFile: import.meta.url });

const feat = { kind: 'feat', featTypes: [], repeatable: 'no' };
function definition(
  key: string,
  name: string,
  detail: { kind: string } & Record<
    string,
    string | number | boolean | string[]
  >,
): ReleaseRow {
  return {
    kind: 'definition',
    key,
    payload: {
      externalKey: key,
      upstreamKey: key,
      pack: 'test',
      name,
      detail,
      description: 'The unpublished body.',
      sources: [{ book: 'Test' }],
      modifiers: [],
      unsupported: [],
    },
  };
}
const racialTrait = (key: string, raceKeys: string[]) =>
  definition(key, 'Trait', {
    kind: 'racialTrait',
    bonusSkillRanksPerLevel: 0,
    raceKeys,
  });

async function allocateAll(t: ReleaseTest, releaseNumber = 1) {
  const batches = [];
  let cursor: string | null = null;
  for (;;) {
    const batch: AllocationBatch = await t.mutation(
      internal.catalogIdentityAllocation.allocate,
      { releaseNumber, cursor },
    );
    batches.push(batch);
    if (batch.isDone) return batches;
    cursor = batch.continueCursor;
  }
}
async function globals(t: ReleaseTest, keys: string[]) {
  return t.run(async (ctx) => {
    const found: string[] = [];
    for (const key of keys)
      if (
        await ctx.db
          .query('catalogEntry')
          .withIndex('by_scope_and_ruleIdentity', (q) =>
            q.eq('scope', 'global').eq('ruleIdentity', key),
          )
          .first()
      )
        found.push(key);
    return found;
  });
}

test('an unresolved reference, a reference of the wrong kind and a kind with no stored shape are reported, and those bodies get no identity', async () => {
  const { t } = await releaseFixture(modules);
  await prepare(t, [
    // Sorts last, so it is still only a release body when referenced.
    definition('test/z-feat', 'Feat', feat),
    // Names a key that is neither stored nor in the release.
    racialTrait('test/orphan', ['test/missing-race']),
    // Names the release's feat where the adapter needs a race.
    racialTrait('test/wrong', ['test/z-feat']),
    definition('test/effect', 'Effect', {
      kind: 'spellEffect',
      defaultCasterLevel: 1,
      lastsOverOneDay: false,
    }),
  ]);
  const [batch] = await allocateAll(t);
  expect(batch).toMatchObject({ allocatedCount: 1, existingCount: 0 });
  expect(batch?.conflicts).toEqual([
    {
      kind: 'unsupported',
      key: 'test/effect',
      reason: 'No stored identity shape for kind spellEffect',
    },
    {
      kind: 'unresolvedReference',
      key: 'test/orphan',
      reference: 'test/missing-race',
    },
    {
      kind: 'referenceKind',
      key: 'test/wrong',
      reference: 'test/z-feat',
      expectedKind: 'race',
      found: { source: 'release', kind: 'feat' },
    },
  ]);
  expect(
    await globals(t, [
      'test/z-feat',
      'test/orphan',
      'test/wrong',
      'test/effect',
    ]),
  ).toEqual(['test/z-feat']);
});

test('allocation refuses a release that is not prepared, a superseded preparation and a closed write gate', async () => {
  const { t } = await releaseFixture(modules);
  await expect(allocateAll(t)).rejects.toThrow(
    'Catalog Release does not exist',
  );
  await prepare(t, [definition('test/feat', 'Feat', feat)]);
  // A newer numbered candidate supersedes release 1's preparation.
  await prepare(t, [], 2);
  await expect(allocateAll(t, 1)).rejects.toThrow(
    'Catalog Release preparation was superseded',
  );
  await t.run(async (ctx) => {
    const runId = await ctx.db.insert('initialMigrationRun', {
      operationId: 'gate',
      epoch: 0,
      state: 'maintenance',
      frontendBuild: 'test',
      catalogManifest: 'test',
      startedAt: 0,
      deadline: 1,
    });
    await ctx.db.insert('initialMigrationControl', {
      key: 'character-sheet',
      epoch: 0,
      closed: true,
      authority: 'legacy',
      runId,
    });
  });
  await expect(allocateAll(t, 2)).rejects.toThrow('MAINTENANCE');
  expect(await globals(t, ['test/feat'])).toEqual([]);
});
