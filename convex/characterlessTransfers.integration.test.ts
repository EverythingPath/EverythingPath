// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { beforeAll, afterEach, beforeEach, expect, test, vi } from 'vitest';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';
import schema from './schema';
import { api, internal } from './_generated/api';
import {
  deploymentFixture,
  fixtureCredentials,
} from '../e2e/support/test-data';
import type { FixtureScope } from '../e2e/fixtures/catalog';
import type { DraftOperation } from '../src/lib/weekly-draft-persistence-contract';
import { CANONICAL_WEEKLY_RULESET_VERSION } from '../src/lib/canonical-weekly-resolution';

// Transfers without a character (#158) through the real public edit,
// preview and Confirmation paths.

const edit = api.canonicalDraftPersistence.edit;
const observe = api.canonicalDraftPersistence.observe;
const modules = import.meta.glob('./**/*.ts');
beforeAll(() => refuseRepeatedPaginatedQueries(schema, modules));
const fixtureScope: FixtureScope = {
  namespace: deploymentFixture.namespace,
  version: 1,
  workerKey: 'worker-0',
  caseKey: 'canonicalPersistence',
  ...fixtureCredentials,
};
beforeEach(() => {
  vi.stubEnv('E2E_ENABLED', 'true');
  vi.stubEnv('E2E_FIXTURE_CONFIG', JSON.stringify(deploymentFixture));
  vi.stubEnv('CONVEX_CLOUD_URL', deploymentFixture.convexUrl);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

const total = (diceTotal: number, sides: number) => ({
  diceTotal,
  diceCount: 1,
  sides,
  provenance: { kind: 'table' as const },
  modifiers: [],
});

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.e2eFixtures.seedIdentityProjection, fixtureScope);
  await t.mutation(internal.e2eFixtures.resetCase, { ...fixtureScope, now: 2 });
  const key = await t.mutation(
    internal.canonicalPersistenceFixtures.initializeUpkeep,
    { scope: fixtureScope, draftId: 'transfers' },
  );
  const user = await t.run((ctx) => ctx.db.query('user').first());
  if (!user) throw new Error('Missing fixture member');
  const member = t.withIdentity({ tokenIdentifier: user.tokenIdentifier });
  const operation = (
    baseRevision: number,
    operationId: string,
    intent: DraftOperation['edit'],
  ) => ({
    campaignId: key.campaignId,
    militiaId: key.militiaId,
    operation: {
      draftId: key.draftId,
      operationId,
      baseRevision,
      edit: intent,
    },
  });
  return { t, key, member, operation };
}

test('[rules.U05.persistence] actorless transfers persist, replay and confirm under the current Ruleset Version, refusing a transfer that names a character', async () => {
  vi.useFakeTimers();
  const { t, key, member, operation } = await setup();
  const deposit = {
    transferId: 'deposit',
    direction: 'deposit' as const,
    copper: 7,
  };
  const withdrawal = {
    transferId: 'withdrawal',
    direction: 'withdraw' as const,
    copper: 250,
  };
  const add = operation(0, 'add-deposit', {
    kind: 'upkeep_transfer',
    transfer: deposit,
  });
  expect((await member.mutation(edit, add)).acceptedRevision).toBe(1);
  expect((await member.mutation(edit, add)).acceptedRevision).toBe(1);
  await member.mutation(
    edit,
    operation(1, 'add-withdrawal', {
      kind: 'upkeep_transfer',
      transfer: withdrawal,
    }),
  );
  const accepted = await member.query(observe, key);
  await expect(
    member.mutation(
      edit,
      operation(2, 'add-actor', {
        kind: 'upkeep_transfer',
        transfer: {
          ...withdrawal,
          transferId: 'actor',
          characterId: 'other',
        } as typeof withdrawal,
      }),
    ),
  ).rejects.toThrow();
  expect(await member.query(observe, key)).toEqual(accepted);
  expect(accepted.draft?.upkeep.treasuryTransfers).toEqual([
    deposit,
    withdrawal,
  ]);

  // With nobody left in an officer role the transfers still resolve.
  await t.run(async (ctx) => {
    const state = await ctx.db.query('canonicalMilitiaState').unique();
    if (!state) throw new Error('Missing source');
    await ctx.db.patch('canonicalMilitiaState', state._id, {
      snapshot: {
        ...state.snapshot,
        roster: { ...state.snapshot.roster, officers: [] },
      },
    });
  });
  await member.mutation(
    edit,
    operation(2, 'check', {
      kind: 'upkeep_roll',
      field: 'check',
      roll: total(16, 20),
    }),
  );
  await member.mutation(
    edit,
    operation(3, 'training', {
      kind: 'upkeep_roll',
      field: 'training',
      roll: total(3, 6),
    }),
  );
  const preview = await member.query(
    api.canonicalDraftPersistence.preview,
    key,
  );
  expect(preview.requirements).toEqual([]);
  expect(preview.reviewed.rulesetVersion).toBe(
    CANONICAL_WEEKLY_RULESET_VERSION,
  );
  expect(preview.outcome?.militiaSnapshot.treasuryCopper).toBe(4757);

  // A review made under the previous version is not confirmed.
  await expect(
    member.mutation(api.canonicalDraftPersistence.confirm, {
      ...key,
      operation: {
        operationId: 'old-review',
        reviewed: { ...preview.reviewed, rulesetVersion: 5 },
      },
    }),
  ).rejects.toThrow();
  const receipt = await member.mutation(api.canonicalDraftPersistence.confirm, {
    ...key,
    operation: { operationId: 'confirm', reviewed: preview.reviewed },
  });
  expect(receipt.record.rulesetVersion).toBe(CANONICAL_WEEKLY_RULESET_VERSION);
  expect(receipt.record.source.upkeep.treasuryTransfers).toEqual([
    deposit,
    withdrawal,
  ]);
  const state = await t.run((ctx) =>
    ctx.db.query('canonicalMilitiaState').unique(),
  );
  expect(state?.snapshot.treasuryCopper).toBe(4757);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
});
