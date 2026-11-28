// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { afterEach, expect, test, vi } from 'vitest';
import { api, internal } from './_generated/api';
import schema from './schema';
import { seedAcceptedCampaign } from './lib/acceptedCampaignFixture';
import { initializationEdits } from '../tests/rules/initialization-edits';
const modules = import.meta.glob('./**/*.ts');
afterEach(() => vi.useRealTimers());

async function fixture() {
  const t = convexTest(schema, modules);
  const member = t.withIdentity({ tokenIdentifier: 'test|player' });
  const seeded = await member.run((ctx) => seedAcceptedCampaign(ctx));
  return { t, member, ...seeded };
}

test('[retirement.preserve] accepted campaign confirms through one authority and stale paths cannot change successor or history', async () => {
  vi.useFakeTimers();
  const { t, member, key, characterId, setup } = await fixture();
  const before = await member.query(api.canonicalDraftPersistence.workspace, {
    campaignId: key.campaignId,
  });
  expect(before?.snapshot).toEqual(setup.state.militiaSnapshot);
  const edits = initializationEdits('patrol', characterId);
  for (const [baseRevision, edit] of edits.entries())
    await member.mutation(api.canonicalDraftPersistence.edit, {
      campaignId: key.campaignId,
      militiaId: key.militiaId,
      operation: {
        draftId: key.draftId,
        operationId: `edit-${baseRevision}`,
        baseRevision,
        edit,
      },
    });
  const preview = await member.query(
    api.canonicalDraftPersistence.preview,
    key,
  );
  expect(preview.status).toBe('ready');
  await member.mutation(api.canonicalDraftPersistence.confirm, {
    ...key,
    operation: { operationId: 'confirm', reviewed: preview.reviewed },
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const current = await member.query(api.canonicalDraftPersistence.workspace, {
    campaignId: key.campaignId,
  });
  const history = await member.query(api.canonicalHistory.read, {
    campaignId: key.campaignId,
    week: 9,
  });
  expect(history).not.toBeNull();
  for (const endpoint of [
    internal.cutover.initialize,
    internal.cutover.resumeLegacy,
    internal.cutover.prepare,
    internal.legacyRetirement.batch,
  ])
    await expect(t.mutation(endpoint, {})).rejects.toThrow(
      'Open the current militia week',
    );
  await expect(
    member.mutation(api.weekBoard.saveWeekBoardState, {}),
  ).rejects.toThrow('Open the current militia week');
  expect(
    await member.query(api.canonicalDraftPersistence.workspace, {
      campaignId: key.campaignId,
    }),
  ).toEqual(current);
  expect(
    await member.query(api.canonicalHistory.read, {
      campaignId: key.campaignId,
      week: 9,
    }),
  ).toEqual(history);
  expect(await t.run((ctx) => ctx.db.get('militia', key.militiaId))).toEqual(
    expect.objectContaining({ name: 'Campaign', campaignId: key.campaignId }),
  );
  const militia = await t.run((ctx) => ctx.db.get('militia', key.militiaId));
  expect(Object.keys(militia!).sort()).toEqual([
    '_creationTime',
    '_id',
    'campaignId',
    'name',
  ]);
});

test('[ledger.shared] members share corrections with revision protection and preserve carried references', async () => {
  const { t, member, key, characterId } = await fixture();
  const scope = { campaignId: key.campaignId, militiaId: key.militiaId };
  const ledger = await member.query(api.canonicalLedger.read, scope);
  await expect(
    member.mutation(api.canonicalLedger.save, {
      ...scope,
      expectedRevision: ledger.revision,
      snapshot: {
        ...ledger.state.militiaSnapshot,
        roster: { ...ledger.state.militiaSnapshot.roster, teams: [] },
      },
      reason: 'Remove targeted team',
    }),
  ).rejects.toThrow('Keep entities referenced by carried events');
  const snapshot = { ...ledger.state.militiaSnapshot, treasuryCopper: 20000 };
  await member.mutation(api.canonicalLedger.save, {
    ...scope,
    expectedRevision: ledger.revision,
    snapshot,
    reason: 'Table reward',
  });
  const other = t.withIdentity({ tokenIdentifier: 'test|gm' });
  expect(
    (await other.query(api.canonicalLedger.read, scope)).state.militiaSnapshot,
  ).toEqual(snapshot);
  await expect(
    other.mutation(api.canonicalLedger.save, {
      ...scope,
      expectedRevision: ledger.revision,
      snapshot: ledger.state.militiaSnapshot,
      reason: 'Stale correction',
    }),
  ).rejects.toThrow();
  await expect(
    t
      .withIdentity({ tokenIdentifier: 'outsider' })
      .mutation(api.canonicalLedger.save, {
        ...scope,
        expectedRevision: ledger.revision + 1,
        snapshot,
        reason: 'Outside campaign',
      }),
  ).rejects.toThrow();
  expect(
    (await member.query(api.canonicalLedger.read, scope)).state.militiaSnapshot,
  ).toEqual(snapshot);
  await member.mutation(api.character.updateCharacter, {
    organizationId: 'org',
    characterId,
    patch: { charisma: 20 },
  });
  const updated = await member.query(api.canonicalLedger.read, scope);
  expect(updated.state.militiaSnapshot.characters[0]?.charisma).toBe(20);
  expect(updated.state.militiaSnapshot.treasuryCopper).toBe(20000);
  expect(updated.state.context).toEqual(ledger.state.context);
  expect(updated.state.week).toBe(9);
});

test('retained paused control still blocks writes without hiding campaign state', async () => {
  const { t, member, key } = await fixture();
  expect(await member.query(api.cutover.status, {})).toBe('canonical');
  await t.run((ctx) =>
    ctx.db.insert('campaignCutover', {
      key: 'weekly-draft',
      status: 'paused',
      operationId: 'retained-pause',
      oldRelease: 'old',
      newRelease: 'canonical',
      campaignIds: [key.campaignId],
      pausedAt: 0,
    }),
  );
  expect(await member.query(api.cutover.status, {})).toBe('paused');
  await expect(
    member.mutation(api.campaign.createCampaign, {
      name: 'Blocked',
      description: '',
      organizationId: 'org',
    }),
  ).rejects.toThrow(
    'Editing is paused for maintenance. Saved information remains available.',
  );
  await expect(
    member.mutation(api.canonicalDraftPersistence.edit, {
      campaignId: key.campaignId,
      militiaId: key.militiaId,
      operation: {
        draftId: key.draftId,
        operationId: 'blocked',
        baseRevision: 0,
        edit: { kind: 'add_slot', slotId: 'blocked' },
      },
    }),
  ).rejects.toThrow(
    'Editing is paused for maintenance. Saved information remains available.',
  );
  expect(
    await member.query(api.canonicalDraftPersistence.workspace, {
      campaignId: key.campaignId,
    }),
  ).not.toBeNull();
});
