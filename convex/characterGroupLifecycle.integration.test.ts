// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { beforeAll, afterEach, beforeEach, expect, test, vi } from 'vitest';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';
import { preloadCalledConvexModules } from '../tests/convex-modules';
import { acceptedCampaignSetup } from '../tests/rules/accepted-campaign';
import { initializationEdits } from '../tests/rules/initialization-edits';
import { api, internal } from './_generated/api';
import { appendResolutionRecord } from './lib/canonicalDraftStorage';
import { initializeCharacterSheet } from './lib/characterSheet';
import { defaultAbilityScores } from '../src/lib/character-sheet';
import type { WeeklyDraftEdit } from '../src/lib/weekly-draft-contract';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');
beforeAll(() => refuseRepeatedPaginatedQueries(schema, modules));
preloadCalledConvexModules({ modules, testFile: import.meta.url });
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function fixture() {
  const t = convexTest(schema, modules);
  const { ownerId, memberId, campaignId } = await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert('user', {
      tokenIdentifier: 'owner',
      orgIds: [{ orgId: 'org', role: 'member' }],
      characterSheetDemo: true,
    });
    const memberId = await ctx.db.insert('user', {
      tokenIdentifier: 'member',
      orgIds: [{ orgId: 'org', role: 'member' }],
    });
    for (const userId of [ownerId, memberId])
      await ctx.db.insert('organizationMembership', {
        userId,
        organizationId: 'org',
      });
    return {
      ownerId,
      memberId,
      campaignId: await ctx.db.insert('campaign', {
        name: 'Ironfang',
        description: '',
        organizationId: 'org',
        ownerId: 'member',
      }),
    };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'owner' });
  const member = t.withIdentity({ tokenIdentifier: 'member' });
  // Creation order must not make the Companion return ahead of its master.
  const { companionId, associatedId } = await t.run(async (ctx) => {
    async function create(name: string, kind: 'pc' | 'npc') {
      const characterId = await ctx.db.insert('character', {
        campaignId,
        name,
        kind,
        description: '',
        ownerId: 'owner',
        isActive: true,
        level: 1,
        ...defaultAbilityScores,
      });
      // Real production initialization has no demonstration browse catalog.
      // Enable prepared access only after those ordinary sheets exist.
      await initializeCharacterSheet(ctx, {
        characterId,
        operationId: `create-${name}`,
        updatedBy: 'owner',
      });
      return characterId;
    }
    const companionId = await create('Bryn', 'npc');
    const associatedId = await create('Vessa', 'pc');
    await ctx.db.patch('campaign', campaignId, {
      e2eFixture: {
        namespace: 'group-lifecycle',
        version: 1,
        workerKey: '0',
        caseKey: 'returns',
        campaignKey: 'ironfang',
      },
    });
    return { companionId, associatedId };
  });
  const relationshipId = await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: associatedId,
    companionCharacterId: companionId,
    kind: 'cohort',
    sources: [{ key: 'bond', label: 'Companion bond', enabled: true }],
    operationId: 'link',
  });
  return {
    t,
    owner,
    member,
    ownerId,
    memberId,
    campaignId,
    companionId,
    associatedId,
    relationshipId,
  };
}

async function readIfAccessible(
  viewer: Awaited<ReturnType<typeof fixture>>['owner'],
  characterId: Awaited<ReturnType<typeof fixture>>['associatedId'],
) {
  try {
    return await viewer.query(api.characterSheet.read, { characterId });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Character not found'))
      return null;
    throw error;
  }
}

test('campaign deletion returns an older Companion with its associated Character in one publication', async () => {
  const { t, owner, member, campaignId, associatedId, companionId } =
    await fixture();
  await member.mutation(api.campaignDeletions.request, { campaignId });
  // Invoke the scheduled interface one transaction at a time so a partial
  // publication is observable. Its identity is scheduling setup, not an assertion.
  const deletion = await t.run((ctx) =>
    ctx.db
      .query('campaignDeletion')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
      .unique(),
  );
  if (!deletion) throw new Error('Missing scheduled deletion');
  for (let step = 0; step < 100; step++) {
    await t.mutation(internal.campaignDeletions.drive, {
      deletionId: deletion._id,
      round: deletion.round,
    });
    const status = await member.query(api.campaignDeletions.status, {
      campaignId,
    });
    expect(status?.remaining).not.toBe(1);
    if (status?.state === 'deleted') break;
  }
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  for (const characterId of [associatedId, companionId])
    expect(
      (await owner.query(api.characterSheet.read, { characterId }))?.character
        .campaignId,
    ).toBeUndefined();
  expect(
    await owner.query(api.companionRelationships.list, {
      characterId: associatedId,
    }),
  ).toMatchObject([
    { status: 'active', endpoint: { characterId: companionId } },
  ]);
});

test('account deletion fences the whole prepared move before a member takes the surviving Characters', async () => {
  const {
    t,
    owner,
    member,
    ownerId,
    memberId,
    campaignId,
    associatedId,
    companionId,
  } = await fixture();
  const command = { characterId: associatedId, operationId: 'account-group' };
  let progress = await owner.mutation(api.characterMoves.start, command);
  for (let step = 0; step < 100 && progress.state === 'preparing'; step++)
    progress = await owner.mutation(api.characterMoves.resume, command);
  expect(progress.state).toBe('ready');
  const deletionId = await t.run(async (ctx) => {
    await ctx.db.delete('user', ownerId);
    return ctx.db.insert('accountDeletion', {
      tokenIdentifier: 'owner',
      state: 'deleting',
    });
  });
  // The child is handled first; its ownership change must fence root work too.
  await t.mutation(internal.accountDeletions.step, {
    deletionId,
    characterId: companionId,
  });
  await t.mutation(internal.accountDeletions.step, {
    deletionId,
    characterId: associatedId,
  });
  for (const characterId of [associatedId, companionId]) {
    expect(
      await member.query(api.characterSheet.read, { characterId }),
    ).toMatchObject({ owner: null, character: { campaignId } });
    await member.mutation(api.character.reassignOwner, {
      characterId,
      campaignId,
      ownerUserId: memberId,
      operationId: `take-${characterId}`,
    });
  }
  expect(
    await member.mutation(api.characterMoves.resume, command),
  ).toMatchObject({ state: 'cancelled', cancelReason: 'ownershipChanged' });
  for (const characterId of [associatedId, companionId])
    expect(
      (await member.query(api.characterSheet.read, { characterId }))?.character
        .campaignId,
    ).toBe(campaignId);
  await expect(
    owner.query(api.characterMoves.status, command),
  ).rejects.toThrow();
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
});

test('external organization deletion returns the same-owner group and retains the ownerless campaign for recovery', async () => {
  const { t, owner, member, campaignId, associatedId, companionId } =
    await fixture();
  const ownerlessId = await member.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Unassigned survivor',
    kind: 'npc',
    operationId: 'create-survivor',
  });
  await t.run((ctx) =>
    ctx.db.patch('character', ownerlessId, { ownerId: undefined }),
  );
  await t.mutation(internal.organizationDeletions.recordProviderDeletion, {
    organizationId: 'org',
  });
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  for (const characterId of [associatedId, companionId])
    expect(
      (await owner.query(api.characterSheet.read, { characterId }))?.character
        .campaignId,
    ).toBeUndefined();
  expect(
    await owner.query(api.companionRelationships.list, {
      characterId: associatedId,
    }),
  ).toMatchObject([{ status: 'active' }]);
  await expect(
    member.query(api.characterSheet.read, { characterId: ownerlessId }),
  ).rejects.toThrow('Character not found');
  expect(
    await member.query(api.organizationDeletions.status, {
      organizationId: 'org',
    }),
  ).toBeNull();
  expect(
    await t.query(internal.organizationDeletions.listRecovery, {
      organizationId: 'org',
    }),
  ).toEqual([
    {
      campaignId,
      campaignName: 'Ironfang',
      characters: [
        {
          characterId: ownerlessId,
          name: 'Unassigned survivor',
          ownerId: null,
        },
      ],
    },
  ]);
});

test('a set-aside departure holds the complete same-owner group until its retry returns both sheets', async () => {
  const { t, owner, member, ownerId, campaignId, associatedId, companionId } =
    await fixture();
  const departureId = await t.run(async (ctx) => {
    await ctx.db.patch('user', ownerId, { orgIds: [] });
    const departureId = await ctx.db.insert('organizationDeparture', {
      userId: ownerId,
      organizationId: 'org',
      round: 1,
      state: 'returning',
    });
    await ctx.db.insert('organizationDepartureCharacter', {
      departureId,
      userId: ownerId,
      organizationId: 'org',
      characterId: associatedId,
      failures: 3,
      setAside: true,
      lastFailure: 'Interrupted return',
    });
    return departureId;
  });
  const command = { departureId, round: 1 };
  await t.mutation(internal.organizationDepartures.drive, command);
  for (const characterId of [associatedId, companionId]) {
    expect(await readIfAccessible(owner, characterId)).toBeNull();
    expect(
      (await member.query(api.characterSheet.read, { characterId }))?.character
        .campaignId,
    ).toBe(campaignId);
  }
  expect(
    await owner.query(api.organizationDepartures.listReturning, {}),
  ).toEqual([{ organizationId: 'org', setAside: 1 }]);
  for (let step = 0; step < 100; step++) {
    await t.mutation(internal.organizationDepartures.drive, {
      ...command,
      characterId: associatedId,
    });
    const sheets = await Promise.all(
      [associatedId, companionId].map((characterId) =>
        readIfAccessible(owner, characterId),
      ),
    );
    expect(sheets[0] === null).toBe(sheets[1] === null);
    if (sheets.every((sheet) => sheet !== null)) break;
  }
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(
    await owner.query(api.companionRelationships.list, {
      characterId: associatedId,
    }),
  ).toMatchObject([
    { status: 'active', endpoint: { characterId: companionId } },
  ]);
});

test('another session interrupts a prepared group and restoring its relationship cannot revive stale movement', async () => {
  const {
    owner,
    member,
    campaignId,
    associatedId,
    companionId,
    relationshipId,
  } = await fixture();
  const command = { characterId: associatedId, operationId: 'leave-group' };
  let progress = await owner.mutation(api.characterMoves.start, command);
  for (let step = 0; step < 100 && progress.state === 'preparing'; step++)
    progress = await owner.mutation(api.characterMoves.resume, command);
  expect(progress.state).toBe('ready');
  await member.mutation(api.companionRelationships.interrupt, {
    relationshipId,
    operationId: 'interrupt-group',
  });
  expect(
    await owner.mutation(api.characterMoves.resume, command),
  ).toMatchObject({
    state: 'cancelled',
    cancelReason: 'groupChanged',
  });
  await member.mutation(api.companionRelationships.restore, {
    relationshipId,
    operationId: 'restore-group',
  });
  expect(
    await owner.mutation(api.characterMoves.resume, command),
  ).toMatchObject({ state: 'cancelled' });
  for (const characterId of [associatedId, companionId])
    expect(
      (await owner.query(api.characterSheet.read, { characterId }))?.character
        .campaignId,
    ).toBe(campaignId);
  expect(
    await owner.query(api.companionRelationships.list, {
      characterId: associatedId,
    }),
  ).toMatchObject([
    {
      status: 'active',
      lastOperationId: 'restore-group',
      sources: [{ key: 'bond', enabled: true }],
    },
  ]);
});

test('a group departure corrects both militia assignments and draft choices once while preserving frozen and superseded history', async () => {
  const { t, owner, member, campaignId, associatedId, companionId } =
    await fixture();
  const setup = acceptedCampaignSetup(associatedId);
  const options = await owner.query(api.canonicalSetup.options, { campaignId });
  setup.state.militiaSnapshot.characters = (options?.characters ?? []).map(
    ({ name: _name, ...facts }) => facts,
  );
  setup.state.militiaSnapshot.roster.people = [
    { characterId: associatedId, kind: 'pc', hitDice: 1 },
    { characterId: companionId, kind: 'npc', hitDice: 1 },
  ];
  setup.state.militiaSnapshot.roster.officers = [
    { characterId: associatedId, role: 'commandant' },
    { characterId: companionId, role: 'marshal' },
  ];
  const patrol = setup.state.militiaSnapshot.roster.teams[0];
  if (!patrol) throw new Error('Missing patrol');
  setup.state.militiaSnapshot.roster.teams.push({
    ...patrol,
    teamId: 'second-patrol',
    name: 'Second patrol',
    status: 'active',
    managerCharacterId: companionId,
  });
  const key = await owner.mutation(api.canonicalSetup.initialize, {
    campaignId,
    initializationId: 'group-militia',
    setup,
  });
  const sourceScope = { campaignId, militiaId: key.militiaId };
  const edits = initializationEdits('patrol', associatedId);
  for (const [baseRevision, edit] of edits.entries())
    await owner.mutation(api.canonicalDraftPersistence.edit, {
      campaignId,
      militiaId: key.militiaId,
      operation: {
        draftId: key.draftId,
        operationId: `finish-${baseRevision}`,
        baseRevision,
        edit,
      },
    });
  const preview = await owner.query(api.canonicalDraftPersistence.preview, key);
  expect(preview.status).toBe('ready');
  const confirmation = await owner.mutation(
    api.canonicalDraftPersistence.confirm,
    {
      ...key,
      operation: {
        operationId: 'finish-group-week',
        reviewed: preview.reviewed,
      },
    },
  );
  // Seed a valid append-only correction chain; all observations below use
  // the same historical interfaces players use to inspect each record.
  await owner.run((ctx) =>
    appendResolutionRecord(ctx, {
      campaignId,
      militiaId: key.militiaId,
      record: {
        ...confirmation.record,
        recordId: 'group-history-correction',
        provenance: 'historical_correction',
        supersedesRecordId: confirmation.record.recordId,
      },
    }),
  );
  const currentKey = { ...key, draftId: confirmation.successor.draftId };
  const choices: WeeklyDraftEdit[] = [
    { kind: 'add_slot', slotId: 'root-role' },
    {
      kind: 'stage',
      slotId: 'root-role',
      choice: {
        choiceId: 'root-role',
        actionId: 'change_officer_role',
        characterId: associatedId,
        fromRole: 'commandant',
        toRole: 'strategist',
      },
    },
    { kind: 'add_slot', slotId: 'companion-role' },
    {
      kind: 'stage',
      slotId: 'companion-role',
      choice: {
        choiceId: 'companion-role',
        actionId: 'change_officer_role',
        characterId: companionId,
        fromRole: 'marshal',
        toRole: 'ambassador',
      },
    },
  ];
  for (const [baseRevision, edit] of choices.entries())
    await owner.mutation(api.canonicalDraftPersistence.edit, {
      campaignId,
      militiaId: key.militiaId,
      operation: {
        draftId: currentKey.draftId,
        operationId: `stage-${baseRevision}`,
        baseRevision,
        edit,
      },
    });
  const historyArgs = { campaignId, week: 9 };
  const history = await member.query(api.canonicalHistory.read, historyArgs);
  const originalArgs = {
    ...historyArgs,
    recordId: confirmation.record.recordId,
  };
  const original = await member.query(api.canonicalHistory.read, originalArgs);
  expect(history?.audit).toHaveLength(2);
  expect(original?.record).toEqual(confirmation.record);
  const destinationCampaignId = await t.run(async (ctx) => {
    const source = await ctx.db.get('campaign', campaignId);
    if (!source) throw new Error('Missing source campaign');
    const { _id: _id, _creationTime: _created, ...fields } = source;
    return ctx.db.insert('campaign', { ...fields, name: 'Destination' });
  });
  const empty = acceptedCampaignSetup(associatedId);
  empty.state.militiaSnapshot.characters = [];
  empty.state.militiaSnapshot.roster.people = [];
  empty.state.militiaSnapshot.roster.officers = [];
  empty.state.militiaSnapshot.roster.teams = [];
  empty.state.context.carriedEvents = [];
  const destinationKey = await owner.mutation(api.canonicalSetup.initialize, {
    campaignId: destinationCampaignId,
    initializationId: 'empty-destination',
    setup: empty,
  });
  const destinationScope = {
    campaignId: destinationCampaignId,
    militiaId: destinationKey.militiaId,
  };
  const destinationBefore = await member.query(
    api.canonicalLedger.read,
    destinationScope,
  );
  const command = {
    characterId: associatedId,
    operationId: 'move-militia-group',
  };
  let progress = await owner.mutation(api.characterMoves.start, {
    ...command,
    destinationCampaignId,
  });
  for (let step = 0; step < 100 && progress.state === 'preparing'; step++)
    progress = await owner.mutation(api.characterMoves.resume, command);
  expect(progress.state).toBe('ready');
  const sourceBefore = await member.query(
    api.canonicalLedger.read,
    sourceScope,
  );
  expect(sourceBefore.state.militiaSnapshot.roster.people).toHaveLength(2);
  expect(
    await owner.mutation(api.characterMoves.resume, command),
  ).toMatchObject({ state: 'completed' });
  const sourceAfter = await member.query(api.canonicalLedger.read, sourceScope);
  expect(sourceAfter.revision).toBe(sourceBefore.revision + 2);
  expect(sourceAfter.state.militiaSnapshot.characters).toEqual([]);
  expect(sourceAfter.state.militiaSnapshot.roster.people).toEqual([]);
  expect(sourceAfter.state.militiaSnapshot.roster.officers).toEqual([]);
  expect(
    sourceAfter.state.militiaSnapshot.roster.teams.map(
      (team) => team.managerCharacterId,
    ),
  ).toEqual([null, null]);
  const draft = await member.query(
    api.canonicalDraftPersistence.observe,
    currentKey,
  );
  expect(draft.draft?.activity.slots.map((slot) => slot.choice)).toMatchObject([
    { choiceId: 'root-role', reviewRequired: true },
    { choiceId: 'companion-role', reviewRequired: true },
  ]);
  expect(
    (await member.query(api.canonicalDraftPersistence.preview, currentKey))
      .requirements,
  ).toEqual(
    expect.arrayContaining(['root-role:review', 'companion-role:review']),
  );
  const destinationAfter = await member.query(
    api.canonicalLedger.read,
    destinationScope,
  );
  // Arrival adds ordinary ledger facts, while militia participation remains
  // an explicit choice: no roster, officer or manager assignment is added.
  expect(destinationAfter.state.militiaSnapshot.roster).toEqual(
    destinationBefore.state.militiaSnapshot.roster,
  );
  expect(
    destinationAfter.state.militiaSnapshot.characters.map(
      (person) => person.characterId,
    ),
  ).toEqual(expect.arrayContaining([associatedId, companionId]));
  expect(await member.query(api.canonicalHistory.read, historyArgs)).toEqual(
    history,
  );
  expect(await member.query(api.canonicalHistory.read, originalArgs)).toEqual(
    original,
  );
  expect(
    await owner.mutation(api.characterMoves.resume, command),
  ).toMatchObject({ state: 'completed' });
  expect(await member.query(api.canonicalLedger.read, sourceScope)).toEqual(
    sourceAfter,
  );
  expect(
    await member.query(api.canonicalDraftPersistence.observe, currentKey),
  ).toEqual(draft);
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
});
