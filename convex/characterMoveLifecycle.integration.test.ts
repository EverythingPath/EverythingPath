// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { beforeAll, afterEach, beforeEach, expect, test, vi } from 'vitest';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';
import { api } from './_generated/api';
import type { FunctionReturnType } from 'convex/server';
import type { Id } from './_generated/dataModel';
import schema from './schema';
import { acceptedCampaignSetup } from '../tests/rules/accepted-campaign';
import { initializationEdits } from '../tests/rules/initialization-edits';

const modules = import.meta.glob('./**/*.ts');
beforeAll(() => refuseRepeatedPaginatedQueries(schema, modules));
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function fixture() {
  const t = convexTest(schema, modules);
  const { userId, campaignId, destinationCampaignId } = await t.run(
    async (ctx) => {
      const userId = await ctx.db.insert('user', {
        tokenIdentifier: 'owner',
        orgIds: [
          { orgId: 'org', role: 'member' },
          { orgId: 'destination', role: 'member' },
        ],
      });
      const common = {
        description: '',
        ownerId: 'owner',
        e2eFixture: {
          namespace: 'move-lifecycle',
          version: 1,
          workerKey: '0',
          caseKey: 'lifecycle',
          campaignKey: 'lifecycle',
        },
      };
      return {
        userId,
        campaignId: await ctx.db.insert('campaign', {
          ...common,
          name: 'A',
          organizationId: 'org',
        }),
        destinationCampaignId: await ctx.db.insert('campaign', {
          ...common,
          name: 'B',
          organizationId: 'destination',
        }),
      };
    },
  );
  const owner = t.withIdentity({ tokenIdentifier: 'owner' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Vessa',
    kind: 'pc',
    operationId: 'create',
  });
  return { t, owner, userId, campaignId, destinationCampaignId, characterId };
}

async function prepareMove(
  owner: Awaited<ReturnType<typeof fixture>>['owner'],
  characterId: Id<'character'>,
  destinationCampaignId: Id<'campaign'>,
  operationId: string,
) {
  const command = { characterId, operationId };
  let progress = await owner.mutation(api.characterMoves.start, {
    ...command,
    destinationCampaignId,
  });
  for (let step = 0; step < 100 && progress.state === 'preparing'; step++)
    progress = await owner.mutation(api.characterMoves.resume, command);
  expect(progress.state).toBe('ready');
  return command;
}

async function completeMove(
  setup: Awaited<ReturnType<typeof fixture>>,
  operationId: string,
) {
  const command = await prepareMove(
    setup.owner,
    setup.characterId,
    setup.destinationCampaignId,
    operationId,
  );
  expect(
    await setup.owner.mutation(api.characterMoves.resume, command),
  ).toMatchObject({ state: 'completed' });
  await setup.t.finishAllScheduledFunctions(() => vi.runAllTimers());
}

test('move commands honor maintenance, reopened epochs and legacy authority without changing the sheet', async () => {
  const { t, owner, characterId, destinationCampaignId } = await fixture();
  const command = await prepareMove(
    owner,
    characterId,
    destinationCampaignId,
    'gated',
  );
  const before = await owner.query(api.characterSheet.read, { characterId });
  const controlId = await t.run(async (ctx) => {
    const runId = await ctx.db.insert('initialMigrationRun', {
      operationId: 'maintenance',
      epoch: 0,
      state: 'maintenance',
      frontendBuild: 'build',
      catalogManifest: 'catalog',
      startedAt: 0,
      deadline: 60000,
    });
    return ctx.db.insert('initialMigrationControl', {
      key: 'character-sheet',
      closed: true,
      epoch: 0,
      authority: 'legacy',
      runId,
    });
  });
  const commands = (writeEpoch: number) => [
    () =>
      owner.mutation(api.characterMoves.start, {
        characterId,
        destinationCampaignId,
        operationId: 'blocked',
        writeEpoch,
      }),
    () => owner.mutation(api.characterMoves.resume, { ...command, writeEpoch }),
    () => owner.mutation(api.characterMoves.cancel, { ...command, writeEpoch }),
  ];
  for (const invoke of commands(0))
    await expect(invoke()).rejects.toThrow('MAINTENANCE');
  expect(await owner.query(api.characterSheet.read, { characterId })).toEqual(
    before,
  );
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, {
      closed: false,
      epoch: 1,
    }),
  );
  for (const invoke of commands(0))
    await expect(invoke()).rejects.toThrow('RELOAD_REQUIRED');
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, { authority: 'sheet' }),
  );
  for (const invoke of commands(1))
    await expect(invoke()).rejects.toThrow('RELOAD_REQUIRED');
  expect(await owner.query(api.characterSheet.read, { characterId })).toEqual(
    before,
  );
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, { authority: 'legacy' }),
  );
  expect(
    await owner.mutation(api.characterMoves.resume, {
      ...command,
      writeEpoch: 1,
    }),
  ).toMatchObject({ state: 'completed' });
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
});

test('production campaigns refuse a move and loss of destination access holds a prepared move waiting', async () => {
  const { t, owner, userId, campaignId, destinationCampaignId, characterId } =
    await fixture();
  const before = await owner.query(api.characterSheet.read, { characterId });
  const productionCampaignId = await t.run((ctx) =>
    ctx.db.insert('campaign', {
      name: 'Production',
      description: '',
      organizationId: 'org',
      ownerId: 'owner',
    }),
  );
  await expect(
    owner.mutation(api.characterMoves.start, {
      characterId,
      destinationCampaignId: productionCampaignId,
      operationId: 'production-target',
    }),
  ).rejects.toThrow("aren't available");
  const source = await t.run((ctx) => ctx.db.get('campaign', campaignId));
  if (!source?.e2eFixture) throw new Error('Missing source fixture');
  await t.run((ctx) =>
    ctx.db.patch('campaign', campaignId, { e2eFixture: undefined }),
  );
  await expect(
    owner.mutation(api.characterMoves.start, {
      characterId,
      destinationCampaignId,
      operationId: 'production-source',
    }),
  ).rejects.toThrow("aren't available");
  await t.run((ctx) =>
    ctx.db.patch('campaign', campaignId, { e2eFixture: source.e2eFixture }),
  );
  expect(await owner.query(api.characterSheet.read, { characterId })).toEqual(
    before,
  );
  const command = await prepareMove(
    owner,
    characterId,
    destinationCampaignId,
    'revoked-destination',
  );
  await t.run((ctx) =>
    ctx.db.patch('user', userId, {
      orgIds: [{ orgId: 'org', role: 'member' }],
    }),
  );
  const waiting = {
    state: 'waiting',
    waitingReason: 'destinationUnavailable',
  };
  expect(
    await owner.mutation(api.characterMoves.resume, command),
  ).toMatchObject(waiting);
  expect(await owner.query(api.characterSheet.read, { characterId })).toEqual(
    before,
  );
  expect(await owner.query(api.characterMoves.status, command)).toMatchObject(
    waiting,
  );
  expect(
    await owner.mutation(api.characterMoves.cancel, command),
  ).toMatchObject({ state: 'cancelled' });
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
});

test('moving one Companion endpoint interrupts the link while preserving both sheets and supporting source state', async () => {
  const setup = await fixture();
  const { owner, campaignId, destinationCampaignId, characterId } = setup;
  const companionId = await owner.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Bryn',
    kind: 'npc',
    operationId: 'companion',
  });
  const sheet = await owner.query(api.characterSheet.read, { characterId });
  const classLevel = sheet?.entries.find(
    (entry) => entry.kind === 'classLevel',
  );
  if (!classLevel) throw new Error('Missing supporting Class Level');
  const relationshipId = await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: characterId,
    companionCharacterId: companionId,
    kind: 'cohort',
    sources: [
      {
        key: 'bond',
        label: 'Class bond',
        enabled: true,
        sheetEntryId: classLevel._id,
      },
      { key: 'unused', label: 'Dormant support', enabled: false },
    ],
    operationId: 'link',
  });
  const before = await owner.query(api.companionRelationships.list, {
    characterId,
  });
  const companionBefore = await owner.query(api.characterSheet.read, {
    characterId: companionId,
  });
  const associatedBefore = await owner.query(api.characterSheet.read, {
    characterId,
  });
  expect(before).toMatchObject([{ relationshipId, status: 'active' }]);
  await completeMove(
    { ...setup, characterId: companionId },
    'separate-companion',
  );
  expect(
    await owner.query(api.companionRelationships.list, { characterId }),
  ).toEqual(
    before.map((relationship) => ({
      ...relationship,
      status: 'interrupted',
      interruption: 'access',
      lastOperationId: 'separate-companion',
    })),
  );
  expect(
    await owner.query(api.companionRelationships.list, {
      characterId: companionId,
    }),
  ).toMatchObject([
    {
      relationshipId,
      status: 'interrupted',
      interruption: 'access',
      endpoint: { characterId, name: 'Vessa' },
      sources: before[0]?.sources,
    },
  ]);
  const companionAfter = await owner.query(api.characterSheet.read, {
    characterId: companionId,
  });
  const associatedAfter = await owner.query(api.characterSheet.read, {
    characterId,
  });
  expect(associatedAfter?.character.campaignId).toBe(campaignId);
  expect(companionAfter?.character.campaignId).toBe(destinationCampaignId);
  // Only the cohort's leader-dependent values change (#417): the leader's
  // inputs are unavailable while the link is interrupted.
  expect(companionBefore?.calculated.cohort?.leadership?.maximumLevel).toBe(0);
  expect(companionAfter?.calculated.cohort).toMatchObject({
    equivalence: { value: 1 },
    leadership: { characterLevel: { value: null }, maximumLevel: null },
  });
  expect(withoutCohortResults(companionAfter)).toEqual(
    withoutCohortResults(companionBefore),
  );
  expect(withoutCohortResults(associatedAfter)).toEqual(
    withoutCohortResults(associatedBefore),
  );
});

type SheetRead = FunctionReturnType<typeof api.characterSheet.read>;
/** A sheet read without its cohort calculation, inputs and warnings. */
function withoutCohortResults(sheet: SheetRead) {
  if (!sheet) return sheet;
  const withoutWarnings = <
    T extends {
      cohort: unknown;
      warnings: { subject: string }[];
      calculationWarnings: { subject: string }[];
      warningsForAcceptance: { subject: string }[];
    },
  >(
    calculated: T,
  ) => ({
    ...calculated,
    cohort: null,
    warnings: calculated.warnings.filter(({ subject }) => subject !== 'cohort'),
    calculationWarnings: calculated.calculationWarnings.filter(
      ({ subject }) => subject !== 'cohort',
    ),
    warningsForAcceptance: calculated.warningsForAcceptance.filter(
      ({ subject }) => subject !== 'cohort',
    ),
  });
  return {
    entries: sheet.entries,
    catalogEntries: sheet.catalogEntries,
    calculated: withoutWarnings(sheet.calculated),
    permanentCalculated: withoutWarnings(sheet.permanentCalculated),
  };
}

test('after leaving the campaign whose homebrew race it customized, discarding the statistics leaves the race unset', async () => {
  const setup = await fixture();
  const { t, owner, characterId, campaignId } = setup;
  // Campaign homebrew a player saves to the source campaign's catalog.
  const raceId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId,
      name: 'Homebrew race',
      ruleIdentity: 'homebrew-race',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'race', racialTraits: [], racialHitDice: 0 },
    }),
  );
  await owner.mutation(api.characterSheet.selectRace, {
    characterId,
    catalogEntryId: raceId,
    operationId: 'race',
  });
  const race = (
    await owner.query(api.characterSheet.read, { characterId })
  )?.entries.find((entry) => entry.kind === 'race');
  if (!race) throw new Error('Missing selected race');
  await owner.mutation(api.characterSheet.editRaceStatistics, {
    characterId,
    entryId: race._id,
    racialHitDice: 2,
    operationId: 'racial-statistics',
  });
  await completeMove(setup, 'leave-homebrew');
  await owner.mutation(api.characterSheet.discardRaceStatistics, {
    characterId,
    entryId: race._id,
    operationId: 'discard',
  });
  const after = await owner.query(api.characterSheet.read, { characterId });
  expect(after?.entries.some((entry) => entry.kind === 'race')).toBe(false);
  expect(
    after?.catalogEntries.some((entry) => entry.racialStatisticsCopy),
  ).toBe(false);
  expect(after?.calculated.hitDice).toBe(1);
});

test('departure preserves a racial-statistics copy and the finished week Resolution Record', async () => {
  const setup = await fixture();
  const { t, owner, characterId, campaignId } = setup;
  const raceId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId,
      name: 'Homebrew race',
      ruleIdentity: 'homebrew-race',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'race', racialTraits: [], racialHitDice: 0 },
    }),
  );
  await owner.mutation(api.characterSheet.selectRace, {
    characterId,
    catalogEntryId: raceId,
    operationId: 'race',
  });
  const race = (
    await owner.query(api.characterSheet.read, { characterId })
  )?.entries.find((entry) => entry.kind === 'race');
  if (!race) throw new Error('Missing selected race');
  await owner.mutation(api.characterSheet.editRaceStatistics, {
    characterId,
    entryId: race._id,
    racialHitDice: 2,
    operationId: 'racial-statistics',
  });
  const saved = await owner.query(api.characterSheet.read, { characterId });
  const privateRace = saved?.catalogEntries.find(
    (entry) => entry.racialStatisticsCopy,
  );
  expect(privateRace).toMatchObject({
    scope: 'character',
    characterId,
    racialStatisticsCopy: true,
    copiedFrom: raceId,
    detail: { racialHitDice: 2 },
  });
  const militiaSetup = acceptedCampaignSetup(characterId);
  const options = await owner.query(api.canonicalSetup.options, { campaignId });
  const person = options?.characters.find(
    (entry) => entry.characterId === characterId,
  );
  if (!person) throw new Error('Missing reviewed militia Character');
  const { name: _name, ...facts } = person;
  militiaSetup.state.militiaSnapshot.characters = [facts];
  const key = await owner.mutation(api.canonicalSetup.initialize, {
    campaignId,
    initializationId: 'finished-week',
    setup: militiaSetup,
  });
  for (const [baseRevision, edit] of initializationEdits(
    'patrol',
    characterId,
  ).entries())
    await owner.mutation(api.canonicalDraftPersistence.edit, {
      campaignId: key.campaignId,
      militiaId: key.militiaId,
      operation: {
        draftId: key.draftId,
        operationId: `edit-${baseRevision}`,
        baseRevision,
        edit,
      },
    });
  const preview = await owner.query(api.canonicalDraftPersistence.preview, key);
  expect(preview.status).toBe('ready');
  await owner.mutation(api.canonicalDraftPersistence.confirm, {
    ...key,
    operation: { operationId: 'confirm', reviewed: preview.reviewed },
  });
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  const historyArgs = { campaignId, week: 9 };
  const history = await owner.query(api.canonicalHistory.read, historyArgs);
  const listing = await owner.query(api.canonicalHistory.list, { campaignId });
  expect(history?.record).toBeDefined();
  const beforeMove = await owner.query(api.characterSheet.read, {
    characterId,
  });
  await completeMove(setup, 'leave-frozen-week');
  const after = await owner.query(api.characterSheet.read, { characterId });
  expect(
    after?.catalogEntries.find((entry) => entry._id === privateRace?._id),
  ).toEqual(privateRace);
  expect(after?.entries.find((entry) => entry._id === race._id)).toEqual(
    beforeMove?.entries.find((entry) => entry._id === race._id),
  );
  expect(after?.calculated.hitDice).toBe(beforeMove?.calculated.hitDice);
  expect(await owner.query(api.canonicalHistory.read, historyArgs)).toEqual(
    history,
  );
  expect(await owner.query(api.canonicalHistory.list, { campaignId })).toEqual(
    listing,
  );
});
