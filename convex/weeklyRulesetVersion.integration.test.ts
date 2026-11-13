// @vitest-environment edge-runtime
import { afterEach, expect, test, vi } from 'vitest';
import type { FunctionReturnType, WithoutSystemFields } from 'convex/server';
import { api, internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import type { ReleaseTest } from '../tests/catalog-release-fixture';
import {
  closedAndBackfilled,
  frontendBuild,
} from '../tests/initial-migration-fixture';
import { initializationEdits } from '../tests/rules/initialization-edits';
import { seedAcceptedCampaign } from './lib/acceptedCampaignFixture';

// #413 f6b2: Weekly Resolution uses Ruleset Version 10 exactly when the
// deployment is under sheet authority with an activation that records it.

afterEach(() => vi.useRealTimers());

const modules = import.meta.glob('./**/*.ts');

type Member = ReturnType<ReleaseTest['withIdentity']>;
type Key = Awaited<ReturnType<typeof seedAcceptedCampaign>>['key'];
type StoredRun = WithoutSystemFields<Doc<'initialMigrationRun'>>;
type Reviewed = FunctionReturnType<
  typeof api.canonicalDraftPersistence.preview
>['reviewed'];

/** The worked rehearsal week, which leaves week 9 ready to confirm. */
async function prepareWeek(member: Member, key: Key, characterId: string) {
  for (const [baseRevision, edit] of initializationEdits(
    'patrol',
    characterId,
  ).entries())
    await member.mutation(api.canonicalDraftPersistence.edit, {
      campaignId: key.campaignId,
      militiaId: key.militiaId,
      operation: {
        draftId: key.draftId,
        operationId: `${key.campaignId}:edit-${baseRevision}`,
        baseRevision,
        edit,
      },
    });
}

function history(member: Member, campaignId: Id<'campaign'>) {
  return member.query(api.canonicalHistory.read, { campaignId, week: 9 });
}

test('under sheet authority after activation a week resolves under version 10, while a week confirmed before keeps version 9 when read back or replayed', async () => {
  let earlier!: {
    key: Key;
    confirmation: { operationId: string; reviewed: Reviewed };
    record: { rulesetVersion: number };
    history: Awaited<ReturnType<typeof history>>;
  };
  let pending!: { key: Key; reviewed: Reviewed };
  const { t, member, receipt, args } = await closedAndBackfilled(modules, {
    whileOpen: async ({ t, member, seeded }) => {
      // One campaign confirms week 9 before activation.
      await prepareWeek(member, seeded.key, seeded.characterId);
      const preview = await member.query(
        api.canonicalDraftPersistence.preview,
        seeded.key,
      );
      expect(preview.reviewed.rulesetVersion).toBe(9);
      const confirmation = {
        operationId: 'confirm-before-activation',
        reviewed: preview.reviewed,
      };
      const confirmed = await member.mutation(
        api.canonicalDraftPersistence.confirm,
        { ...seeded.key, operation: confirmation },
      );
      expect(confirmed.record.rulesetVersion).toBe(9);
      // Draft retirement finishes while open, so the closed gate holds no job.
      await t.finishAllScheduledFunctions(() => vi.runAllTimers());
      earlier = {
        key: seeded.key,
        confirmation,
        record: confirmed.record,
        history: await history(member, seeded.key.campaignId),
      };
      // Another reviews week 9 before activation and confirms it after.
      const second = await member.run(async (ctx) =>
        seedAcceptedCampaign(
          ctx,
          await ctx.db.insert('campaign', {
            name: 'Second campaign',
            ownerId: 'gm',
            organizationId: 'org',
            description: '',
          }),
        ),
      );
      await prepareWeek(member, second.key, second.characterId);
      const reviewed = await member.query(
        api.canonicalDraftPersistence.preview,
        second.key,
      );
      expect(reviewed).toMatchObject({
        status: 'ready',
        reviewed: { rulesetVersion: 9 },
      });
      pending = { key: second.key, reviewed: reviewed.reviewed };
    },
  });
  const run = { runId: receipt.runId, epoch: receipt.epoch };
  await t.mutation(internal.initialMigration.activate, args);
  await t.mutation(internal.initialMigration.publish, {
    ...run,
    activationId: args.activationId,
    page: 0,
  });
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  await t.mutation(internal.initialMigration.smoke, { ...run, smokeId: 's' });
  const { epoch: writeEpoch } = await t.mutation(
    internal.initialMigration.reopen,
    { ...run, observedFrontendBuild: frontendBuild },
  );

  // The week confirmed before activation reads back and replays unchanged.
  expect(await history(member, earlier.key.campaignId)).toEqual(
    earlier.history,
  );
  expect(earlier.history?.record.rulesetVersion).toBe(9);
  const replay = await member.mutation(api.canonicalDraftPersistence.confirm, {
    ...earlier.key,
    operation: earlier.confirmation,
    writeEpoch,
  });
  expect(replay.record).toEqual(earlier.record);

  // A review under version 9 no longer confirms; a fresh one, over the same
  // facts, records version 10.
  await expect(
    member.mutation(api.canonicalDraftPersistence.confirm, {
      ...pending.key,
      operation: { operationId: 'confirm-stale', reviewed: pending.reviewed },
      writeEpoch,
    }),
  ).rejects.toThrow('Reviewed weekly source changed');
  const fresh = await member.query(
    api.canonicalDraftPersistence.preview,
    pending.key,
  );
  expect(fresh).toMatchObject({
    status: 'ready',
    reviewed: { rulesetVersion: 10, sourceKey: pending.reviewed.sourceKey },
  });
  const confirmed = await member.mutation(
    api.canonicalDraftPersistence.confirm,
    {
      ...pending.key,
      operation: { operationId: 'confirm-after', reviewed: fresh.reviewed },
      writeEpoch,
    },
  );
  expect(confirmed.record.rulesetVersion).toBe(10);
  expect(
    (await history(member, pending.key.campaignId))?.record.rulesetVersion,
  ).toBe(10);
  // The earlier campaign's next week is resolved under version 10 too.
  const next = await member.query(api.canonicalDraftPersistence.workspace, {
    campaignId: earlier.key.campaignId,
  });
  if (!next) throw new Error('Missing next week');
  expect(
    (await member.query(api.canonicalDraftPersistence.preview, next.key))
      .reviewed.rulesetVersion,
  ).toBe(10);
});

test.each([
  { authority: 'legacy', activation: 'none', version: 9 },
  { authority: 'legacy', activation: 'versioned', version: 9 },
  { authority: 'sheet', activation: 'none', version: 9 },
  { authority: 'sheet', activation: 'unversioned', version: 9 },
  { authority: 'sheet', activation: 'versioned', version: 10 },
  { authority: 'sheet', activation: 'reopened', version: 10 },
  { authority: 'sheet', activation: 'repairing', version: 10 },
  { authority: 'no control row', activation: 'none', version: 9 },
] as const)(
  'under $authority authority with activation $activation the week resolves under version $version',
  async ({ authority, activation, version }) => {
    const { t, member, seeded, receipt, args } =
      await closedAndBackfilled(modules);
    await t.mutation(internal.initialMigration.activate, args);
    await t.run(async (ctx) => {
      const stored = await ctx.db.get('initialMigrationRun', receipt.runId);
      if (stored?.state !== 'activated') throw new Error('Missing activation');
      const { _id, _creationTime, ...activated } = stored;
      const { activation: record, publication, smoke, ...fields } = activated;
      const { rulesetVersion, ...unversioned } = record;
      expect(rulesetVersion).toBe(10);
      expect([publication, smoke]).toHaveLength(2);
      const passed = {
        smokeId: 's',
        epoch: stored.epoch,
        checkedAt: 1,
        outcome: 'passed' as const,
      };
      const runs: Record<typeof activation, StoredRun> = {
        none: { ...fields, state: 'maintenance' },
        versioned: activated,
        // An activation stored before #413 f6b2 records no version.
        unversioned: { ...activated, activation: unversioned },
        reopened: {
          ...activated,
          state: 'reopened',
          smoke: passed,
          reopenedAt: 1,
        },
        repairing: {
          ...activated,
          state: 'repairing',
          smoke: null,
          reopenedAt: 1,
          closedForRepairAt: 2,
        },
      };
      await ctx.db.replace('initialMigrationRun', _id, runs[activation]);
      const control = await ctx.db
        .query('initialMigrationControl')
        .withIndex('by_key', (q) => q.eq('key', 'character-sheet'))
        .unique();
      if (!control) throw new Error('Missing control');
      if (authority === 'no control row')
        await ctx.db.delete('initialMigrationControl', control._id);
      else
        await ctx.db.patch('initialMigrationControl', control._id, {
          authority,
        });
    });
    const preview = await member.query(
      api.canonicalDraftPersistence.preview,
      seeded.key,
    );
    expect(preview.reviewed.rulesetVersion).toBe(version);
  },
);

test('an activation records only version 10', async () => {
  const { t, receipt, args } = await closedAndBackfilled(modules);
  await t.mutation(internal.initialMigration.activate, args);
  await expect(
    t.run(async (ctx) => {
      const stored = await ctx.db.get('initialMigrationRun', receipt.runId);
      if (stored?.state !== 'activated') throw new Error('Missing activation');
      const { _id, _creationTime, ...activated } = stored;
      await ctx.db.replace('initialMigrationRun', _id, {
        ...activated,
        activation: {
          ...activated.activation,
          // @ts-expect-error an activation records version 10
          rulesetVersion: 9,
        },
      });
    }),
  ).rejects.toThrow('Validator error');
});
