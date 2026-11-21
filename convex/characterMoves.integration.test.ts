// @vitest-environment edge-runtime
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { convexTest } from 'convex-test';
import { expect, test, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { preloadCalledConvexModules } from '../tests/convex-modules';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';
import { makeFunctionReference } from 'convex/server';
import { api, internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import type { WeeklyDraftEdit } from '../src/lib/weekly-draft-contract';
import schema from './schema';
import { writeCatalogDefinition } from './lib/catalogCopies';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const modules = import.meta.glob('./**/*.ts');
preloadCalledConvexModules({ modules, testFile: import.meta.url });
beforeAll(() => refuseRepeatedPaginatedQueries(schema, modules));
const start = makeFunctionReference<
  'mutation',
  {
    characterId: Id<'character'>;
    destinationCampaignId?: Id<'campaign'>;
    operationId: string;
  },
  unknown
>('characterMoves:start');
async function fixture() {
  const t = convexTest(schema, modules);
  const campaigns = await t.run(async (ctx) => {
    for (const name of ['owner', 'member'])
      await ctx.db.insert('user', {
        tokenIdentifier: `test|${name}`,
        orgIds: [{ orgId: 'org', role: 'member' }],
        characterSheetDemo: true,
      });
    const ids = [];
    for (const name of ['A', 'B'])
      ids.push(
        await ctx.db.insert('campaign', {
          name,
          description: '',
          organizationId: 'org',
          ownerId: 'test|owner',
          e2eFixture: {
            namespace: 'moves',
            version: 1,
            workerKey: '0',
            caseKey: name,
            campaignKey: name,
          },
        }),
      );
    return ids;
  });
  const owner = t.withIdentity({ tokenIdentifier: 'test|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'test|member' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    campaignId: campaigns[0],
    organizationId: 'org',
    name: 'Vessa',
    kind: 'pc',
    operationId: 'create',
  });
  return { t, owner, member, characterId, campaigns };
}

function selectedCatalogId(
  entries: readonly Doc<'characterSheetEntry'>[] | undefined,
  id: string,
) {
  const entry = entries?.find((row) => row._id === id);
  return entry && 'catalogEntryId' in entry ? entry.catalogEntryId : undefined;
}

test('only the current owner can prepare a move and inaccessible destinations leave the Character unchanged', async () => {
  const { t, owner, member, characterId } = await fixture();
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  await expect(
    member.mutation(start, { characterId, operationId: 'member' }),
  ).rejects.toThrow('Only the current owner');
  const destinationCampaignId = await t.run((ctx) =>
    ctx.db.insert('campaign', {
      name: 'Other',
      description: '',
      organizationId: 'other',
      ownerId: 'other',
    }),
  );
  await expect(
    owner.mutation(start, {
      characterId,
      destinationCampaignId,
      operationId: 'outsider',
    }),
  ).rejects.toThrow('access');
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId }),
    ),
  ).toEqual(before);
});

test('preparation remains private and completion keeps identity when leaving and joining another campaign', async () => {
  const { owner, member, characterId, campaigns } = await fixture();
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  const command = { characterId, operationId: 'leave' };
  const preparing = await owner.mutation(api.characterMoves.start, command);
  expect(preparing).toMatchObject({ state: 'preparing' });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId }),
    ),
  ).toEqual(before);
  let progress = preparing;
  for (let i = 0; i < 20 && progress.state !== 'completed'; i++)
    progress = await owner.mutation(api.characterMoves.resume, command);
  expect(progress.state).toBe('completed');
  const after = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  expect(after?.character).toMatchObject({
    _id: characterId,
    sheetMode: 'full',
  });
  expect(after?.campaign).toBeNull();
  expect(after?.entries).toEqual(before?.entries);
  await expect(
    member.query(api.characterSheet.read, { characterId }),
  ).rejects.toThrow('Character not found');
  expect(await owner.mutation(api.characterMoves.resume, command)).toEqual(
    progress,
  );
  const join = {
    characterId,
    destinationCampaignId: campaigns[1],
    operationId: 'join',
  };
  progress = await owner.mutation(api.characterMoves.start, join);
  for (let i = 0; i < 20 && progress.state !== 'completed'; i++)
    progress = await owner.mutation(api.characterMoves.resume, {
      characterId,
      operationId: join.operationId,
    });
  expect(progress.state).toBe('completed');
  expect(
    withSheetCatalog(
      await member.query(api.characterSheet.read, { characterId }),
    )?.campaign?.campaignId,
  ).toBe(campaigns[1]);
});

test('a homebrew dependency is copied only at publication and survives a round trip with saved state', async () => {
  const { t, owner, characterId, campaigns } = await fixture();
  const catalogEntryId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId: campaigns[0],
      name: 'Strong heart',
      ruleIdentity: 'heart',
      sourceKey: 'heart-source',
      stacksWithItself: false,
      modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 2 }],
      sources: [],
      detail: { kind: 'feat' },
    }),
  );
  await owner.mutation(api.characterSheet.selectEntry, {
    characterId,
    catalogEntryId,
    operationId: 'select',
    notes: 'Keep my choice',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  let progress = await owner.mutation(api.characterMoves.start, {
    characterId,
    destinationCampaignId: campaigns[1],
    operationId: 'to-B',
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId }),
    ),
  ).toEqual(before);
  for (let i = 0; i < 20 && progress.state !== 'completed'; i++)
    progress = await owner.mutation(api.characterMoves.resume, {
      characterId,
      operationId: 'to-B',
    });
  expect(progress.state).toBe('completed');
  const after = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  expect(after?.calculated.abilities).toEqual(before?.calculated.abilities);
  const carried = after?.catalogEntries.find(
    (row) => row.copiedFrom === catalogEntryId,
  );
  expect(carried).toMatchObject({
    scope: 'character',
    characterId,
    ruleIdentity: 'heart',
    sourceKey: 'heart-source',
  });
  expect(after?.entries.find((row) => row.kind === 'feat')).toMatchObject({
    _id: before?.entries.find((row) => row.kind === 'feat')?._id,
    catalogEntryId: carried?._id,
  });
  progress = await owner.mutation(api.characterMoves.start, {
    characterId,
    destinationCampaignId: campaigns[0],
    operationId: 'to-A',
  });
  for (let i = 0; i < 20 && progress.state !== 'completed'; i++)
    progress = await owner.mutation(api.characterMoves.resume, {
      characterId,
      operationId: 'to-A',
    });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId }),
    )?.entries,
  ).toEqual(after?.entries);
});

/** Start a move and resume through discovery, one page each, to its first staged batch. */
async function stageFirstBatch(
  owner: Awaited<ReturnType<typeof fixture>>['owner'],
  command: {
    characterId: Id<'character'>;
    operationId: string;
    destinationCampaignId?: Id<'campaign'>;
  },
) {
  let progress = await owner.mutation(api.characterMoves.start, command);
  for (let i = 0; i < 8 && progress.prepared === 0; i++)
    progress = await owner.mutation(api.characterMoves.resume, {
      characterId: command.characterId,
      operationId: command.operationId,
    });
  return progress;
}

async function completeMove(
  owner: Awaited<ReturnType<typeof fixture>>['owner'],
  characterId: Awaited<ReturnType<typeof fixture>>['characterId'],
  operationId: string,
  destinationCampaignId?: Awaited<
    ReturnType<typeof fixture>
  >['campaigns'][number],
) {
  let progress = await owner.mutation(api.characterMoves.start, {
    characterId,
    operationId,
    destinationCampaignId,
  });
  for (let i = 0; i < 150 && progress.state !== 'completed'; i++)
    progress = await owner.mutation(api.characterMoves.resume, {
      characterId,
      operationId,
    });
  expect(progress.state).toBe('completed');
  return progress;
}

test('bounded preparation keeps staged work across a sheet edit and a failed batch can resume without exposing staged rows', async () => {
  const { t, owner, member, characterId, campaigns } = await fixture();
  await t.run(async (ctx) => {
    for (let i = 0; i < 70; i++)
      await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        name: `Unused ${i}`,
        ruleIdentity: `unused-${i}`,
        stacksWithItself: false,
        modifiers: [],
        sources: [],
        detail: { kind: 'manual' },
      });
  });
  const before = await owner.query(api.catalogCopies.list, { characterId });
  const operationId = 'bounded';
  const first = await stageFirstBatch(owner, {
    characterId,
    destinationCampaignId: campaigns[1],
    operationId,
  });
  expect(first.prepared).toBe(32);
  const next = await owner.mutation(api.characterMoves.resume, {
    characterId,
    operationId,
  });
  expect(next.prepared - first.prepared).toBe(32);
  await member.mutation(api.characterSheet.editBaseScores, {
    characterId,
    operationId: 'concurrent',
    scores: {
      strength: 15,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
  });
  const restarted = await owner.mutation(api.characterMoves.resume, {
    characterId,
    operationId,
  });
  expect(restarted.generation).toBe(0);
  expect(restarted.prepared).toBeGreaterThan(next.prepared);
  expect(await owner.query(api.catalogCopies.list, { characterId })).toEqual(
    before,
  );
  const user = await t.run((ctx) =>
    ctx.db
      .query('user')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', 'test|owner'),
      )
      .unique(),
  );
  if (!user) throw new Error('Owner missing');
  await t.run((ctx) => ctx.db.patch('user', user._id, { orgIds: [] }));
  await expect(
    owner.mutation(api.characterMoves.resume, { characterId, operationId }),
  ).rejects.toThrow('Character not found');
  expect(
    withSheetCatalog(
      await member.query(api.characterSheet.read, { characterId }),
    )?.campaign?.campaignId,
  ).toBe(campaigns[0]);
  await t.run((ctx) =>
    ctx.db.patch('user', user._id, {
      orgIds: [{ orgId: 'org', role: 'member' }],
    }),
  );
  let progress = restarted;
  for (let i = 0; i < 150 && progress.state !== 'completed'; i++)
    progress = await owner.mutation(api.characterMoves.resume, {
      characterId,
      operationId,
    });
  const after = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  expect(after?.campaign?.campaignId).toBe(campaigns[1]);
  expect(after?.calculated.abilities.strength.score).toBe(15);
});

test('the new owner can start while the former owner has unfinished private preparation', async () => {
  const { t, owner, member, characterId, campaigns } = await fixture();
  await owner.mutation(api.characterMoves.start, {
    characterId,
    destinationCampaignId: campaigns[1],
    operationId: 'former-owner',
  });
  const newOwner = await t.run((ctx) =>
    ctx.db
      .query('user')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', 'test|member'),
      )
      .unique(),
  );
  if (!newOwner || !campaigns[0]) throw new Error('Missing fixture');
  await member.mutation(api.character.reassignOwner, {
    characterId,
    campaignId: campaigns[0],
    ownerUserId: newOwner._id,
    operationId: 'claim',
  });
  await expect(
    owner.mutation(api.characterMoves.resume, {
      characterId,
      operationId: 'former-owner',
    }),
  ).rejects.toThrow('Only the current owner');
  await completeMove(member, characterId, 'new-owner', campaigns[1]);
  expect(
    withSheetCatalog(
      await member.query(api.characterSheet.read, { characterId }),
    )?.character.ownerId,
  ).toBe('test|member');
});

test('global future Grants retain the source preference while global definitions stay live', async () => {
  const { t, owner, characterId, campaigns } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  const fighter = initial?.catalogEntries.find(
    (row) => row.ruleIdentity === 'fighter',
  );
  const level = initial?.entries.find((row) => row.kind === 'classLevel');
  if (
    fighter?.detail.kind !== 'class' ||
    !('featuresByLevel' in fighter.detail) ||
    !level
  )
    throw new Error('Missing fighter');
  const detail = fighter.detail;
  const { featureId, classId } = await t.run(async (ctx) => {
    const fields = {
      name: 'Future strength',
      ruleIdentity: 'future-strength',
      stacksWithItself: false,
      sources: [],
      detail: { kind: 'classFeature' as const },
    };
    const featureId = await ctx.db.insert('catalogEntry', {
      ...fields,
      scope: 'global',
      modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 1 }],
    });
    await ctx.db.insert('catalogEntry', {
      ...fields,
      scope: 'campaign',
      campaignId: campaigns[0],
      copiedFrom: featureId,
      campaignPreference: true,
      modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 2 }],
    });
    await ctx.db.insert('catalogEntry', {
      ...fields,
      scope: 'campaign',
      campaignId: campaigns[1],
      copiedFrom: featureId,
      campaignPreference: true,
      modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 8 }],
    });
    const classId = await ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Live fighter',
      ruleIdentity: 'live-fighter',
      stacksWithItself: false,
      modifiers: [],
      sources: [],
      detail: {
        ...detail,
        featuresByLevel: [{ classLevel: 2, catalogEntryId: featureId }],
      },
    });
    return { featureId, classId };
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId,
    entryId: level._id,
    classEntryId: classId,
    operationId: 'choose-class',
  });
  await completeMove(owner, characterId, 'future-move', campaigns[1]);
  await owner.mutation(api.characterSheet.addClassLevel, {
    characterId,
    classEntryId: classId,
    operationId: 'level-two',
  });
  const after = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  expect(after?.calculated.abilities.strength.score).toBe(12);
  expect(after?.catalogEntries.find((row) => row._id === classId)?.scope).toBe(
    'global',
  );
  expect(
    after?.catalogEntries.find(
      (row) =>
        row.scope === 'character' && row.ruleIdentity === 'future-strength',
    ),
  ).toMatchObject({
    scope: 'character',
    modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 2 }],
  });
  const carriedId = after?.character.carriedCatalogReferences?.[featureId];
  const futureChoice = await owner.mutation(api.characterSheet.selectEntry, {
    characterId,
    catalogEntryId: featureId,
    operationId: 'explicit-destination-choice',
  });
  const explicitlySelected = withSheetCatalog(
    await owner.query(api.characterSheet.read, {
      characterId,
    }),
  );
  expect(
    explicitlySelected?.catalogEntries.find(
      (row) =>
        row._id === selectedCatalogId(explicitlySelected.entries, futureChoice),
    ),
  ).toMatchObject({
    scope: 'campaign',
    campaignId: campaigns[1],
    modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 8 }],
  });
  await completeMove(
    owner,
    characterId,
    'preserve-established-alias',
    campaigns[0],
  );
  const returned = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  expect(returned?.character.carriedCatalogReferences?.[featureId]).toBe(
    carriedId,
  );
  expect(
    returned?.catalogEntries.find((row) => row._id === carriedId),
  ).toMatchObject({
    modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 2 }],
  });
});

test('accepted warnings and off entries remain unchanged across a move', async () => {
  const { owner, characterId, campaigns } = await fixture();
  await owner.mutation(api.characterSheet.editCreationSettings, {
    characterId,
    operationId: 'point-buy',
    settings: { abilityMethod: { kind: 'pointBuy', budget: 5 } },
  });
  await owner.mutation(api.characterSheet.editBaseScores, {
    characterId,
    operationId: 'scores',
    scores: {
      strength: 18,
      dexterity: 18,
      constitution: 18,
      intelligence: 18,
      wisdom: 18,
      charisma: 18,
    },
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  const warning = before?.calculated.warnings.find(
    (row) => row.check === 'pointBuy',
  );
  if (!warning) throw new Error('Warning missing');
  await owner.mutation(api.characterSheet.acceptWarning, {
    characterId,
    operationId: 'accept',
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
  });
  const accepted = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  await completeMove(owner, characterId, 'accepted-move', campaigns[1]);
  const after = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  expect(after?.acceptedWarnings).toEqual(accepted?.acceptedWarnings);
  expect(after?.calculated.warnings).toEqual(accepted?.calculated.warnings);
});

test('departure removes roster, officer and manager assignments with a correction and marks affected choices for review', async () => {
  const { t, owner, member, characterId, campaigns } = await fixture();
  const { acceptedCampaignSetup } =
    await import('../tests/rules/accepted-campaign');
  const setup = acceptedCampaignSetup(characterId);
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  if (!sheet || !campaigns[0]) throw new Error('Missing sheet');
  const facts = sheet.permanentCalculated;
  setup.state.militiaSnapshot.characters = [
    {
      characterId,
      level: facts.level,
      strength: facts.abilities.strength.score,
      dexterity: facts.abilities.dexterity.score,
      constitution: facts.abilities.constitution.score,
      intelligence: facts.abilities.intelligence.score,
      wisdom: facts.abilities.wisdom.score,
      charisma: facts.abilities.charisma.score,
      isActive: true,
    },
  ];
  const key = await owner.mutation(api.canonicalSetup.initialize, {
    campaignId: campaigns[0],
    initializationId: 'move-militia',
    setup,
  });
  await owner.mutation(api.canonicalDraftPersistence.edit, {
    campaignId: key.campaignId,
    militiaId: key.militiaId,
    operation: {
      draftId: key.draftId,
      operationId: 'add-slot',
      baseRevision: 0,
      edit: { kind: 'add_slot', slotId: 'slot-1' },
    },
  });
  await owner.mutation(api.canonicalDraftPersistence.edit, {
    campaignId: key.campaignId,
    militiaId: key.militiaId,
    operation: {
      draftId: key.draftId,
      operationId: 'stage-role',
      baseRevision: 1,
      edit: {
        kind: 'stage',
        slotId: 'slot-1',
        choice: {
          choiceId: 'role',
          actionId: 'change_officer_role',
          characterId,
          fromRole: 'commandant',
          toRole: 'marshal',
        },
      },
    },
  });
  await owner.mutation(api.canonicalDraftPersistence.edit, {
    campaignId: key.campaignId,
    militiaId: key.militiaId,
    operation: {
      draftId: key.draftId,
      operationId: 'add-rolled-slot',
      baseRevision: 2,
      edit: { kind: 'add_slot', slotId: 'slot-2' },
    },
  });
  await owner.mutation(api.canonicalDraftPersistence.edit, {
    campaignId: key.campaignId,
    militiaId: key.militiaId,
    operation: {
      draftId: key.draftId,
      operationId: 'stage-rolled-slot',
      baseRevision: 3,
      edit: {
        kind: 'stage',
        slotId: 'slot-2',
        choice: {
          choiceId: 'gold',
          actionId: 'earn_gold',
          rolls: {
            check: {
              diceTotal: 12,
              diceCount: 1,
              sides: 20,
              provenance: { kind: 'table' },
              modifiers: [],
            },
          },
        },
      },
    },
  });
  await owner.mutation(api.canonicalDraftPersistence.edit, {
    campaignId: key.campaignId,
    militiaId: key.militiaId,
    operation: {
      draftId: key.draftId,
      operationId: 'add-second-character-slot',
      baseRevision: 4,
      edit: { kind: 'add_slot', slotId: 'slot-3' },
    },
  });
  await owner.mutation(api.canonicalDraftPersistence.edit, {
    campaignId: key.campaignId,
    militiaId: key.militiaId,
    operation: {
      draftId: key.draftId,
      operationId: 'stage-second-character-slot',
      baseRevision: 5,
      edit: {
        kind: 'stage',
        slotId: 'slot-3',
        choice: {
          choiceId: 'second-role',
          actionId: 'change_officer_role',
          characterId,
          fromRole: 'marshal',
          toRole: 'ambassador',
        },
      },
    },
  });
  const observation = await owner.query(
    api.canonicalDraftPersistence.observe,
    key,
  );
  const selected = observation.draft?.activity.slots.find(
    (slot) => slot.choice?.choiceId === 'role',
  );
  expect(selected).toBeDefined();
  await completeMove(owner, characterId, 'leave-militia');
  const ledger = await member.query(api.canonicalLedger.read, {
    campaignId: key.campaignId,
    militiaId: key.militiaId,
  });
  expect(ledger.state.militiaSnapshot.characters).toEqual([]);
  expect(ledger.state.militiaSnapshot.roster.people).toEqual([]);
  expect(ledger.state.militiaSnapshot.roster.officers).toEqual([]);
  expect(
    ledger.state.militiaSnapshot.roster.teams.every(
      (team) => team.managerCharacterId === null,
    ),
  ).toBe(true);
  const after = await member.query(api.canonicalDraftPersistence.observe, key);
  expect(
    after.draft?.activity.slots.find((slot) => slot.choice?.choiceId === 'role')
      ?.choice,
  ).toMatchObject({ choiceId: 'role', reviewRequired: true });
  expect(
    (await member.query(api.canonicalDraftPersistence.preview, key))
      .requirements,
  ).toContain('role:review');
  const flaggedChoice = after.draft?.activity.slots.find(
    (slot) => slot.slotId === 'slot-2',
  )?.choice;
  if (!flaggedChoice) throw new Error('Missing flagged choice');
  await member.mutation(api.canonicalDraftPersistence.edit, {
    campaignId: key.campaignId,
    militiaId: key.militiaId,
    operation: {
      draftId: key.draftId,
      operationId: 'review-departure',
      baseRevision: after.revision,
      edit: {
        kind: 'detail',
        slotId: 'slot-2',
        choiceId: flaggedChoice.choiceId,
        choice: flaggedChoice,
      },
    },
  });
  const reviewed = await member.query(
    api.canonicalDraftPersistence.observe,
    key,
  );
  const { reviewRequired: _review, ...expectedChoice } = flaggedChoice;
  expect(
    reviewed.draft?.activity.slots.find((slot) => slot.slotId === 'slot-2')
      ?.choice,
  ).toEqual(expectedChoice);
  expect(
    (await member.query(api.canonicalDraftPersistence.preview, key))
      .requirements,
  ).not.toContain('gold:review');
  const clearReceipt = await member.mutation(
    api.canonicalDraftPersistence.edit,
    {
      campaignId: key.campaignId,
      militiaId: key.militiaId,
      operation: {
        draftId: key.draftId,
        operationId: 'clear-first-obsolete-choice',
        baseRevision: after.revision,
        edit: { kind: 'clear', slotId: 'slot-1', choiceId: 'role' },
      },
    },
  );
  expect(
    clearReceipt.observation.draft?.activity.slots.find(
      (slot) => slot.slotId === 'slot-1',
    )?.choice,
  ).toBeNull();
  expect(
    clearReceipt.observation.draft?.activity.slots.find(
      (slot) => slot.slotId === 'slot-3',
    )?.choice,
  ).toMatchObject({ choiceId: 'second-role', reviewRequired: true });
  await expect(
    member.mutation(api.canonicalDraftPersistence.edit, {
      campaignId: key.campaignId,
      militiaId: key.militiaId,
      operation: {
        draftId: key.draftId,
        operationId: 'new-invalid-flagged-choice',
        baseRevision: clearReceipt.observation.revision,
        edit: {
          kind: 'stage',
          slotId: 'slot-1',
          choice: {
            choiceId: 'invalid',
            actionId: 'change_officer_role',
            characterId: 'foreign-character',
            fromRole: 'marshal',
            toRole: 'ambassador',
            reviewRequired: true,
          },
        },
      },
    }),
  ).rejects.toThrow('Invalid draft entity reference');
  const gold = reviewed.draft?.activity.slots.find(
    (slot) => slot.slotId === 'slot-2',
  )?.choice;
  if (gold?.actionId !== 'earn_gold' || !gold.rolls?.check)
    throw new Error('Missing reviewed roll');
  await member.mutation(api.canonicalDraftPersistence.edit, {
    campaignId: key.campaignId,
    militiaId: key.militiaId,
    operation: {
      draftId: key.draftId,
      operationId: 'new-roll',
      baseRevision: clearReceipt.observation.revision,
      edit: {
        kind: 'detail',
        slotId: 'slot-2',
        choiceId: gold.choiceId,
        choice: {
          ...gold,
          rolls: {
            ...gold.rolls,
            check: { ...gold.rolls.check, diceTotal: 13 },
          },
        },
      },
    },
  });
  await expect(
    member.mutation(api.canonicalDraftPersistence.edit, {
      campaignId: key.campaignId,
      militiaId: key.militiaId,
      operation: {
        draftId: key.draftId,
        operationId: 'stale-checkpoint-roll',
        baseRevision: after.revision,
        edit: {
          kind: 'detail',
          slotId: 'slot-2',
          choiceId: gold.choiceId,
          choice: {
            ...gold,
            rolls: {
              ...gold.rolls,
              check: { ...gold.rolls.check, diceTotal: 14 },
            },
          },
        },
      },
    }),
  ).rejects.toThrow('Target changed');
  const checkpoints = () =>
    t.run((ctx) =>
      ctx.db
        .query('canonicalDraftSourceReview')
        .withIndex('by_draftId_and_revision', (q) =>
          q.eq('draftId', key.draftId),
        )
        .collect(),
    );
  expect(await checkpoints()).toHaveLength(1);
  await t.mutation(internal.canonicalDraftPersistence.retireClosedDraft, {
    draftId: key.draftId,
    afterRevision: 0,
  });
  expect(await checkpoints()).toHaveLength(1);
  await t.run(async (ctx) => {
    const row = await ctx.db
      .query('canonicalWeeklyDraft')
      .withIndex('by_draftId', (q) => q.eq('draftId', key.draftId))
      .unique();
    if (!row) throw new Error('Missing draft');
    await ctx.db.patch('canonicalWeeklyDraft', row._id, {
      status: 'closed',
      draft: null,
      initialDraft: undefined,
    });
  });
  await t.mutation(internal.canonicalDraftPersistence.retireClosedDraft, {
    draftId: key.draftId,
    afterRevision: 0,
  });
  expect(await checkpoints()).toEqual([]);
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(
    await t.run((ctx) =>
      ctx.db
        .query('canonicalDraftOperation')
        .withIndex('by_draftId_and_operationId', (q) =>
          q.eq('draftId', key.draftId).eq('operationId', 'new-roll'),
        )
        .unique(),
    ),
  ).toMatchObject({ operationId: 'new-roll' });
});

test('cancelling an inaccessible destination leaves the sheet unchanged and permits a different move', async () => {
  const { t, owner, characterId, campaigns } = await fixture();
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  const operationId = 'cancelled-target';
  await owner.mutation(api.characterMoves.start, {
    characterId,
    operationId,
    destinationCampaignId: campaigns[1],
  });
  const destinationCampaignId = campaigns[1];
  if (!destinationCampaignId) throw new Error('Missing destination');
  await t.run((ctx) =>
    ctx.db.patch('campaign', destinationCampaignId, {
      organizationId: 'other',
    }),
  );
  expect(
    await owner.mutation(api.characterMoves.cancel, {
      characterId,
      operationId,
    }),
  ).toMatchObject({ state: 'cancelled' });
  expect(
    await owner.query(api.characterMoves.status, { characterId, operationId }),
  ).toMatchObject({ state: 'cancelled' });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId }),
    ),
  ).toEqual(before);
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  await completeMove(owner, characterId, 'leave-after-cancel');
  await owner.mutation(api.characterSheet.deletePrivate, {
    characterId,
    operationId: 'delete-after-move',
  });
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  await expect(
    owner.query(api.characterMoves.status, { characterId }),
  ).rejects.toThrow('Character not found');
});

test('source spell discovery advances bounded pages without loading unrelated spell payloads', async () => {
  const { t, owner, characterId, campaigns } = await fixture();
  await t.run(async (ctx) => {
    for (let i = 0; i < 160; i++)
      await ctx.db.insert('catalogEntry', {
        scope: 'campaign',
        campaignId: campaigns[0],
        name: `Unrelated ${i}`,
        ruleIdentity: `unrelated-spell-${i}`,
        stacksWithItself: false,
        modifiers: [],
        sources: [],
        detail: {
          kind: 'spell',
          levels: { 'unrelated-list': 1 },
          description: 'Large unrelated description '.repeat(2000),
        },
      });
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  const operationId = 'bounded-discovery';
  let progress = await owner.mutation(api.characterMoves.start, {
    characterId,
    operationId,
  });
  expect(progress).toMatchObject({ state: 'preparing', prepared: 0 });
  for (let i = 0; i < 3; i++) {
    progress = await owner.mutation(api.characterMoves.resume, {
      characterId,
      operationId,
    });
    expect(progress.prepared).toBe(0);
  }
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId }),
    ),
  ).toEqual(before);
  for (let i = 0; i < 150 && progress.state !== 'completed'; i++)
    progress = await owner.mutation(api.characterMoves.resume, {
      characterId,
      operationId,
    });
  const after = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  expect(after?.campaign).toBeNull();
  expect(
    after?.catalogEntries.some((row) =>
      row.ruleIdentity.startsWith('unrelated-spell-'),
    ),
  ).toBe(false);
});

// A Convex deployment refuses a second paginated query in one function, so
// discovery takes one Spell page per transaction even when a page is empty.
test('a move through scan phases without Spells takes one discovery page per transaction', async () => {
  const { owner, characterId, campaigns } = await fixture();
  const operationId = 'empty-phases';
  let progress = await owner.mutation(api.characterMoves.start, {
    characterId,
    destinationCampaignId: campaigns[1],
    operationId,
  });
  expect(progress).toMatchObject({ state: 'preparing', prepared: 0 });
  for (let i = 0; i < 150 && progress.state !== 'completed'; i++)
    progress = await owner.mutation(api.characterMoves.resume, {
      characterId,
      operationId,
    });
  expect(progress.state).toBe('completed');
});

test('oversized carried-reference maps refuse publication and retain the old sheet and catalog', async () => {
  const { t, owner, characterId, campaigns } = await fixture();
  await t.run(async (ctx) => {
    const carried = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Historical carried choice',
      ruleIdentity: 'historical-choice',
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: { kind: 'feat' },
    });
    const carriedCatalogReferences: Record<string, typeof carried> = {};
    for (let i = 0; i < 1024; i++) {
      const original = await ctx.db.insert('catalogEntry', {
        scope: 'global',
        name: `Historical source ${i}`,
        ruleIdentity: `historical-${i}`,
        sources: [],
        modifiers: [],
        stacksWithItself: false,
        detail: { kind: 'feat' },
      });
      carriedCatalogReferences[original] = carried;
    }
    await ctx.db.patch('character', characterId, { carriedCatalogReferences });
    const catalogEntryId = await ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId: campaigns[0],
      name: 'Required new choice',
      ruleIdentity: 'required-new',
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: { kind: 'feat' },
    });
    await ctx.db.patch('catalogEntry', carried, {
      grants: [{ catalogEntryId }],
    });
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  const ownCount = await t.run((ctx) =>
    ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .collect(),
  );
  const command = {
    characterId,
    destinationCampaignId: campaigns[1],
    operationId: 'map-limit',
  };
  let progress = await owner.mutation(api.characterMoves.start, command);
  const resumeCommand = { characterId, operationId: command.operationId };
  for (let i = 0; i < 100 && progress.state !== 'ready'; i++)
    progress = await owner.mutation(api.characterMoves.resume, resumeCommand);
  expect(progress.state).toBe('ready');
  await expect(
    owner.mutation(api.characterMoves.resume, resumeCommand),
  ).rejects.toThrow(
    'This Character has too many carried catalog selections to move. Remove unused selections, then try again.',
  );
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId }),
    ),
  ).toEqual(before);
  expect(
    await t.run((ctx) =>
      ctx.db
        .query('catalogEntry')
        .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
        .collect(),
    ),
  ).toEqual(ownCount);
});

test('removing a carried selection preserves its dependency and a new global choice uses destination preferences', async () => {
  const { t, owner, characterId, campaigns } = await fixture();
  const { originalId, sourceId, destinationId } = await t.run(async (ctx) => {
    const fields = {
      name: 'Preferred talent',
      ruleIdentity: 'preferred-talent',
      modifiers: [],
      sources: [],
      stacksWithItself: false,
      detail: { kind: 'condition' as const },
    };
    const originalId = await ctx.db.insert('catalogEntry', {
      ...fields,
      scope: 'global',
    });
    const sourceId = await ctx.db.insert('catalogEntry', {
      ...fields,
      scope: 'campaign',
      campaignId: campaigns[0],
      copiedFrom: originalId,
      campaignPreference: true,
      name: 'Source talent',
    });
    const destinationId = await ctx.db.insert('catalogEntry', {
      ...fields,
      scope: 'campaign',
      campaignId: campaigns[1],
      copiedFrom: originalId,
      campaignPreference: true,
      name: 'Destination talent',
    });
    return { originalId, sourceId, destinationId };
  });
  const entryId = await owner.mutation(api.characterSheet.selectEntry, {
    characterId,
    catalogEntryId: sourceId,
    operationId: 'source-choice',
  });
  await completeMove(owner, characterId, 'carried-choice', campaigns[1]);
  const moved = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  const carriedId = selectedCatalogId(moved?.entries, entryId);
  await owner.mutation(api.characterSheet.removeSheetEntry, {
    characterId,
    entryId,
    operationId: 'remove-carried',
  });
  const replacement = await owner.mutation(api.characterSheet.selectEntry, {
    characterId,
    catalogEntryId: originalId,
    operationId: 'destination-choice',
  });
  const after = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  expect(selectedCatalogId(after?.entries, replacement)).toBe(destinationId);
  expect(
    after?.catalogEntries.find((row) => row._id === carriedId),
  ).toMatchObject({ scope: 'character', characterId, name: 'Source talent' });
});

test('saving a carried definition keeps its identity and a later move remaps existing global aliases', async () => {
  const { t, owner, characterId, campaigns } = await fixture();
  const { originalId, sourceId } = await t.run(async (ctx) => {
    const fields = {
      name: 'Saved source condition',
      ruleIdentity: 'saved-source-condition',
      modifiers: [],
      sources: [],
      stacksWithItself: false,
      detail: { kind: 'condition' as const },
    };
    const originalId = await ctx.db.insert('catalogEntry', {
      ...fields,
      scope: 'global',
    });
    const sourceId = await ctx.db.insert('catalogEntry', {
      ...fields,
      scope: 'campaign',
      campaignId: campaigns[0],
      copiedFrom: originalId,
      campaignPreference: true,
    });
    await ctx.db.insert('catalogEntry', {
      ...fields,
      scope: 'campaign',
      campaignId: campaigns[1],
      copiedFrom: originalId,
      campaignPreference: true,
      name: 'Divergent destination condition',
    });
    return { originalId, sourceId };
  });
  const entryId = await owner.mutation(api.characterSheet.selectEntry, {
    characterId,
    catalogEntryId: sourceId,
    operationId: 'save-choice',
  });
  await completeMove(owner, characterId, 'before-save', campaigns[1]);
  const moved = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  const carriedId = selectedCatalogId(moved?.entries, entryId);
  if (!carriedId) throw new Error('Missing carried choice');
  expect(
    await owner.mutation(api.catalogCopies.saveToCatalog, {
      characterId,
      catalogEntryId: carriedId,
      operationId: 'save-carried',
    }),
  ).toBe(carriedId);
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  expect(
    saved?.catalogEntries.find((row) => row._id === carriedId),
  ).toMatchObject({ scope: 'campaign', campaignId: campaigns[1] });
  expect(saved?.character.carriedCatalogReferences?.[originalId]).toBe(
    carriedId,
  );
  await owner.mutation(api.characterSheet.removeSheetEntry, {
    characterId,
    entryId,
    operationId: 'remove-saved-selection',
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId }),
    )?.catalogEntries.find((row) => row._id === carriedId),
  ).toMatchObject({ scope: 'campaign', campaignId: campaigns[1] });
  await completeMove(owner, characterId, 'after-save', campaigns[0]);
  const returned = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  expect(returned?.entries.some((row) => row._id === entryId)).toBe(false);
  const copiedId = returned?.character.carriedCatalogReferences?.[originalId];
  expect(copiedId).not.toBe(carriedId);
  expect(
    returned?.catalogEntries.find((row) => row._id === copiedId),
  ).toMatchObject({
    scope: 'character',
    characterId,
    name: 'Saved source condition',
  });
  const newSelection = await owner.mutation(api.characterSheet.selectEntry, {
    characterId,
    catalogEntryId: originalId,
    operationId: 'after-save-choice',
  });
  const finalSheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, {
      characterId,
    }),
  );
  expect(selectedCatalogId(finalSheet?.entries, newSelection)).toBe(sourceId);
  expect(finalSheet?.character.carriedCatalogReferences?.[originalId]).toBe(
    copiedId,
  );
});

test('departure clears event and persistent Character references so the shared week remains editable until reviewed', async () => {
  const { owner, member, characterId, campaigns } = await fixture();
  const { acceptedCampaignSetup } =
    await import('../tests/rules/accepted-campaign');
  const setup = acceptedCampaignSetup(characterId);
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  if (!sheet || !campaigns[0]) throw new Error('Missing sheet');
  const facts = sheet.permanentCalculated;
  setup.state.militiaSnapshot.characters = [
    {
      characterId,
      level: facts.level,
      strength: facts.abilities.strength.score,
      dexterity: facts.abilities.dexterity.score,
      constitution: facts.abilities.constitution.score,
      intelligence: facts.abilities.intelligence.score,
      wisdom: facts.abilities.wisdom.score,
      charisma: facts.abilities.charisma.score,
      isActive: true,
    },
  ];
  setup.state.context.orders = [];
  setup.state.context.carriedEvents = [
    {
      eventId: 'carried',
      eventType: 'low_morale',
      startedWeek: 8,
      order: 0,
      targets: [{ kind: 'character', characterId }],
    },
  ];
  setup.state.militiaSnapshot.economy = {
    items: [
      {
        itemId: 'owned',
        ownerCharacterId: characterId,
        name: 'Sword',
        valueCopper: 100,
        weight: 1,
        location: 'held',
      },
    ],
    caches: [],
    markets: [],
    orders: [],
  };
  setup.state.militiaSnapshot.characterActions = {
    people: [
      {
        characterId,
        status: 'available',
        location: { kind: 'headquarters' },
        directRescueRequired: false,
        capture: null,
      },
    ],
  };
  setup.state.militiaSnapshot.eventBenefits = {
    skills: [
      {
        benefitId: 'skill',
        sourceEventIds: ['carried'],
        characterIds: [characterId],
        skills: ['bluff'],
        bonusType: 'morale',
        value: 1,
        settlementId: null,
        afterDark: false,
        startsWeek: 8,
        endsWeek: 10,
      },
    ],
    markets: [],
  };
  const key = await owner.mutation(api.canonicalSetup.initialize, {
    campaignId: campaigns[0],
    initializationId: 'event-departure',
    setup,
  });
  const officerCheck = { characterId, skill: 'bluff' as const };
  const occurrence = {
    eventId: 'event',
    persistent: true,
    origin: { kind: 'rolled' as const },
    eventType: 'low_morale' as const,
    targets: [{ kind: 'character' as const, characterId }],
    officerCheck,
    overseerCharacterId: characterId,
    targetChecks: [{ target: { kind: 'character' as const, characterId } }],
    persistentDecision: {
      kind: 'mitigate' as const,
      eventId: 'event',
      officerCheck,
      overseerCharacterId: characterId,
    },
    rewards: [
      {
        itemId: 'reward',
        characterId,
        name: 'Gift',
        valueCopper: 100,
        weight: 1,
        alchemical: false,
        poison: false,
      },
    ],
  };
  await owner.mutation(api.canonicalDraftPersistence.edit, {
    campaignId: key.campaignId,
    militiaId: key.militiaId,
    operation: {
      draftId: key.draftId,
      operationId: 'event',
      baseRevision: 0,
      edit: { kind: 'event_tree', occurrences: [occurrence] },
    },
  });
  await owner.mutation(api.canonicalDraftPersistence.edit, {
    campaignId: key.campaignId,
    militiaId: key.militiaId,
    operation: {
      draftId: key.draftId,
      operationId: 'decision',
      baseRevision: 1,
      edit: {
        kind: 'persistent_decision',
        decision: {
          kind: 'mitigate',
          eventId: 'carried',
          officerCheck,
          overseerCharacterId: characterId,
        },
      },
    },
  });
  await owner.mutation(api.canonicalDraftPersistence.edit, {
    campaignId: key.campaignId,
    militiaId: key.militiaId,
    operation: {
      draftId: key.draftId,
      operationId: 'previous-event-review',
      baseRevision: 2,
      edit: {
        kind: 'acknowledge',
        acknowledgement: {
          acknowledgementId: 'previous-review',
          subjectId: 'event:review',
          outcome: 'Previously reviewed',
        },
      },
    },
  });
  await completeMove(owner, characterId, 'leave-events');
  const after = await member.query(api.canonicalDraftPersistence.observe, key);
  await expect(
    member.mutation(api.canonicalDraftPersistence.edit, {
      campaignId: key.campaignId,
      militiaId: key.militiaId,
      operation: {
        draftId: key.draftId,
        operationId: 'queued-before-departure',
        baseRevision: 2,
        edit: {
          kind: 'persistent_decision',
          decision: { kind: 'unattempted', eventId: 'carried' },
        },
      },
    }),
  ).rejects.toThrow('Target changed');
  await member.mutation(api.canonicalDraftPersistence.edit, {
    campaignId: key.campaignId,
    militiaId: key.militiaId,
    operation: {
      draftId: key.draftId,
      operationId: 'later-edit',
      baseRevision: after.revision,
      edit: { kind: 'add_slot', slotId: 'later' },
    },
  });
  const latest = await member.query(api.canonicalDraftPersistence.observe, key);
  expect(latest.draft?.event.occurrences[0]).toMatchObject({
    eventId: 'event',
    targets: [],
    targetChecks: [],
    rewards: [],
    reviewRequired: true,
  });
  expect(latest.draft?.event.occurrences[0]?.officerCheck).toBeUndefined();
  expect(
    latest.draft?.event.occurrences[0]?.overseerCharacterId,
  ).toBeUndefined();
  expect(latest.draft?.persistent.decisions[0]).toMatchObject({
    kind: 'mitigate',
    eventId: 'carried',
    reviewRequired: true,
  });
  expect(latest.draft?.context.carriedEvents[0]).toMatchObject({
    eventId: 'carried',
    targets: [],
    reviewRequired: true,
  });
  const preview = await member.query(
    api.canonicalDraftPersistence.preview,
    key,
  );
  expect(preview.requirements).toContain('event:review');
  expect(preview.requirements).toContain('carried:review');
  expect(
    latest.draft?.acknowledgements.some(
      (entry) => entry.acknowledgementId === 'previous-review',
    ),
  ).toBe(false);
  await expect(
    member.mutation(api.canonicalDraftPersistence.confirm, {
      ...key,
      operation: {
        operationId: 'confirm-unreviewed',
        reviewed: preview.reviewed,
      },
    }),
  ).rejects.toThrow();

  const ledger = await member.query(api.canonicalLedger.read, {
    campaignId: key.campaignId,
    militiaId: key.militiaId,
  });
  expect(
    ledger.state.militiaSnapshot.economy?.items[0]?.ownerCharacterId,
  ).toBeUndefined();
  expect(ledger.state.militiaSnapshot.characterActions?.people).toEqual([]);
  expect(
    ledger.state.militiaSnapshot.eventBenefits?.skills[0]?.characterIds,
  ).toEqual([]);
  await member.mutation(api.canonicalLedger.save, {
    campaignId: key.campaignId,
    militiaId: key.militiaId,
    expectedRevision: ledger.revision,
    snapshot: ledger.state.militiaSnapshot,
    reason: 'Week stays editable',
  });
  let revision = latest.revision;
  const reviewEdits: [string, WeeklyDraftEdit][] = [
    [
      'review-event',
      {
        kind: 'event_tree',
        occurrences: [
          {
            eventId: 'event',
            origin: { kind: 'rolled' },
            eventType: 'low_morale',
          },
        ],
      },
    ],
    [
      'review-decision',
      {
        kind: 'persistent_decision',
        decision: { kind: 'unattempted', eventId: 'carried' },
      },
    ],
  ];
  for (const [operationId, edit] of reviewEdits) {
    await member.mutation(api.canonicalDraftPersistence.edit, {
      campaignId: key.campaignId,
      militiaId: key.militiaId,
      operation: {
        draftId: key.draftId,
        operationId,
        baseRevision: revision++,
        edit: structuredClone(edit),
      },
    });
  }
  const reviewed = await member.query(
    api.canonicalDraftPersistence.preview,
    key,
  );
  expect(reviewed.requirements).not.toContain('event:review');
  expect(reviewed.requirements).not.toContain('carried:review');
});

test('unrelated campaign catalog writes retain staged progress and do not revise the campaign', async () => {
  const { t, owner, characterId, campaigns } = await fixture();
  await t.run(async (ctx) => {
    for (let i = 0; i < 70; i++)
      await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        name: `Owned ${i}`,
        ruleIdentity: `owned-${i}`,
        sources: [],
        modifiers: [],
        stacksWithItself: false,
        detail: { kind: 'manual' },
      });
  });
  const command = { characterId, operationId: 'unrelated-write' };
  const first = await stageFirstBatch(owner, command);
  expect(first.prepared).toBe(32);
  const campaignBefore = await t.run((ctx) =>
    ctx.db.get(
      'campaign',
      campaigns.at(0) ??
        (() => {
          throw new Error('Missing campaign');
        })(),
    ),
  );
  await t.run((ctx) =>
    writeCatalogDefinition(ctx, {
      scope: 'campaign',
      campaignId: campaigns[0],
      name: 'Unrelated',
      ruleIdentity: 'unrelated',
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: { kind: 'manual' },
    }),
  );
  const second = await owner.mutation(api.characterMoves.resume, command);
  expect(second).toMatchObject({ generation: first.generation, prepared: 64 });
  expect(
    await t.run((ctx) =>
      ctx.db.get(
        'campaign',
        campaigns.at(0) ??
          (() => {
            throw new Error('Missing campaign');
          })(),
      ),
    ),
  ).toEqual(campaignBefore);
});

test('editing one staged dependency re-stages that definition without discarding completed preparation', async () => {
  const { t, owner, characterId } = await fixture();
  const ids = await t.run(async (ctx) => {
    const ids: Id<'catalogEntry'>[] = [];
    for (let i = 0; i < 70; i++)
      ids.push(
        await ctx.db.insert('catalogEntry', {
          scope: 'character',
          characterId,
          name: `Owned ${i}`,
          ruleIdentity: `owned-${i}`,
          sources: [],
          modifiers: [],
          stacksWithItself: false,
          detail: { kind: 'manual' },
        }),
      );
    return ids;
  });
  const command = { characterId, operationId: 'one-stale' };
  let progress = await owner.mutation(api.characterMoves.start, command);
  while (progress.state !== 'ready')
    progress = await owner.mutation(api.characterMoves.resume, command);
  const generation = progress.generation;
  const changedId = ids[0];
  if (!changedId) throw new Error('Missing definition');
  await owner.mutation(api.catalogCopies.editDefinition, {
    characterId,
    catalogEntryId: changedId,
    name: 'Changed dependency',
    operationId: 'edit-staged-definition',
  });
  const refreshed = await owner.mutation(api.characterMoves.resume, command);
  expect(refreshed).toMatchObject({
    generation,
    prepared: progress.prepared,
    state: 'ready',
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId }),
    )?.campaign,
  ).not.toBeNull();
  expect((await owner.mutation(api.characterMoves.resume, command)).state).toBe(
    'completed',
  );
  expect(
    (await owner.query(api.catalogCopies.list, { characterId })).some(
      (row) => row.name === 'Changed dependency',
    ),
  ).toBe(true);
});

test('leaving a campaign without militia references preserves ledger and draft revisions and adds no departure correction', async () => {
  const { t, owner, member, characterId, campaigns } = await fixture();
  const { acceptedCampaignSetup } =
    await import('../tests/rules/accepted-campaign');
  const setup = acceptedCampaignSetup(characterId);
  if (!campaigns[0]) throw new Error('Missing campaign');
  setup.state.militiaSnapshot.characters = [];
  setup.state.militiaSnapshot.roster.people = [];
  setup.state.militiaSnapshot.roster.officers = [];
  setup.state.militiaSnapshot.roster.teams =
    setup.state.militiaSnapshot.roster.teams.map((team) => ({
      ...team,
      managerCharacterId: null,
    }));
  const key = await owner.mutation(api.canonicalSetup.initialize, {
    campaignId: campaigns[0],
    initializationId: 'unassigned-departure',
    setup,
  });
  const ledger = await member.query(api.canonicalLedger.read, {
    campaignId: key.campaignId,
    militiaId: key.militiaId,
  });
  const draft = await member.query(api.canonicalDraftPersistence.observe, key);
  await completeMove(owner, characterId, 'leave-unassigned');
  expect(
    await member.query(api.canonicalLedger.read, {
      campaignId: key.campaignId,
      militiaId: key.militiaId,
    }),
  ).toEqual(ledger);
  expect(
    await member.query(api.canonicalDraftPersistence.observe, key),
  ).toEqual(draft);
  expect(
    await t.run((ctx) =>
      ctx.db
        .query('canonicalSourceCorrection')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', key.militiaId))
        .take(10),
    ),
  ).toEqual([]);
});

test('starting a replacement move cleans cancelled staging and stores discovery roots as child rows', async () => {
  const { t, owner, characterId, campaigns } = await fixture();
  const first = await owner.mutation(api.characterMoves.start, {
    characterId,
    operationId: 'replace-old',
  });
  expect(first.state).toBe('preparing');
  await owner.mutation(api.characterMoves.start, {
    characterId,
    operationId: 'replace-new',
    destinationCampaignId: campaigns[1],
  });
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  const stored = await t.run(async (ctx) => {
    const moves = await ctx.db
      .query('characterMove')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .take(3);
    const old = moves.find((row) => row.operationId === 'replace-old');
    if (!old) throw new Error('Missing old move');
    return {
      moves,
      oldDefinitions: await ctx.db
        .query('characterMoveDefinition')
        .withIndex('by_moveId_and_generation', (q) =>
          q.eq('moveId', old._id).eq('generation', old.generation),
        )
        .take(1),
      oldReferences: await ctx.db
        .query('characterMoveReference')
        .withIndex('by_moveId_and_generation', (q) =>
          q.eq('moveId', old._id).eq('generation', old.generation),
        )
        .take(1),
    };
  });
  expect(stored.oldDefinitions).toEqual([]);
  expect(stored.oldReferences).toEqual([]);
  for (const move of stored.moves) {
    expect(move).not.toHaveProperty('definitionIds');
    expect(move).not.toHaveProperty('requiredKeys');
    expect(move).not.toHaveProperty('candidateIds');
    expect(move).not.toHaveProperty('destinationCandidateIds');
  }
  expect(
    (await owner.query(api.characterMoves.status, { characterId }))
      ?.operationId,
  ).toBe('replace-new');
});

test('campaign arrivals preserve demo permission and departures require existing private-sheet access', async () => {
  const { t, owner, characterId, campaigns } = await fixture();
  await t.run(async (ctx) => {
    await ctx.db.patch('character', characterId, { sheetDemo: undefined });
    const user = await ctx.db
      .query('user')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', 'test|owner'),
      )
      .unique();
    if (!user) throw new Error('Missing user');
    await ctx.db.patch('user', user._id, { characterSheetDemo: undefined });
  });
  await completeMove(owner, characterId, 'campaign-arrival', campaigns[1]);
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId }),
    )?.character.sheetDemo,
  ).toBeUndefined();
  await expect(
    owner.mutation(api.characterMoves.start, {
      characterId,
      operationId: 'private-without-permission',
    }),
  ).rejects.toThrow('Private character sheets');
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId }),
    )?.campaign?.campaignId,
  ).toBe(campaigns[1]);
});

test('a campaign member added to a global keyed spell list after readiness is included before publication', async () => {
  const { t, owner, characterId, campaigns } = await fixture();
  const sourceCampaignId = campaigns[0];
  if (!sourceCampaignId) throw new Error('Missing campaign');
  await t.run(async (ctx) => {
    const classEntryId = await ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Future mage',
      ruleIdentity: 'future-mage',
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: {
        kind: 'class',
        classKind: 'base',
        hitDie: 6,
        bab: 'half',
        saves: { fort: 'poor', ref: 'poor', will: 'good' },
        skillRanksPerLevel: 2,
        classSkills: [],
        featuresByLevel: [],
        picksByLevel: [],
        casting: {
          classTag: 'fresh-list',
          type: 'prepared',
          spellKind: 'arcane',
          ability: 'intelligence',
          record: 'book',
          cantrips: true,
          casterLevelOffset: 0,
          table: 'prepared-full',
        },
      },
    });
    await ctx.db.insert('characterSheetEntry', {
      characterId,
      kind: 'classLevel',
      active: true,
      state: { kind: 'classLevel', position: 1, classEntryId, hpGained: 6 },
    });
  });
  const command = { characterId, operationId: 'fresh-membership' };
  let progress = await owner.mutation(api.characterMoves.start, command);
  for (let i = 0; i < 100 && progress.state !== 'ready'; i++)
    progress = await owner.mutation(api.characterMoves.resume, command);
  expect(progress.state).toBe('ready');
  await t.run((ctx) =>
    writeCatalogDefinition(ctx, {
      scope: 'campaign',
      campaignId: sourceCampaignId,
      name: 'New future spell',
      ruleIdentity: 'fresh-spell',
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: { kind: 'spell', levels: { 'fresh-list': 9 } },
    }),
  );
  for (let i = 0; i < 100 && progress.state !== 'completed'; i++)
    progress = await owner.mutation(api.characterMoves.resume, command);
  expect(progress.state).toBe('completed');
  expect(
    (await owner.query(api.catalogCopies.list, { characterId })).some(
      (row) => row.scope === 'character' && row.ruleIdentity === 'fresh-spell',
    ),
  ).toBe(true);
});

test('moves retain selections, Attack Routines, archetype replacement choices and nested feature upgrades', async () => {
  const { t, owner, characterId, campaigns } = await fixture();
  const seeded = await t.run(async (ctx) => {
    const common = {
      scope: 'campaign' as const,
      campaignId: campaigns[0],
      sources: [],
      modifiers: [],
      stacksWithItself: false,
    };
    const upgrade = await ctx.db.insert('catalogEntry', {
      ...common,
      name: 'Future upgrade',
      ruleIdentity: 'future-upgrade',
      detail: { kind: 'classFeature' },
    });
    const feature = await ctx.db.insert('catalogEntry', {
      ...common,
      name: 'Old feature',
      ruleIdentity: 'old-feature',
      detail: { kind: 'classFeature', duplicateUpgrade: upgrade },
    });
    const archetype = await ctx.db.insert('catalogEntry', {
      ...common,
      name: 'Chosen archetype',
      ruleIdentity: 'chosen-archetype',
      detail: {
        kind: 'archetype',
        classEntryIds: [],
        replaces: [{ classLevel: 1, catalogEntryId: feature, scope: 'whole' }],
        adds: [],
      },
    });
    const archetypeEntry = await ctx.db.insert('characterSheetEntry', {
      characterId,
      kind: 'archetype',
      active: false,
      catalogEntryId: archetype,
      state: {
        kind: 'archetype',
        replaces: [{ classLevel: 1, catalogEntryId: feature, scope: 'part' }],
        choice: 'Kept choice',
      },
    });
    const selection = await ctx.db.insert('characterSheetEntry', {
      characterId,
      kind: 'classFeature',
      active: false,
      catalogEntryId: feature,
      selectionSource: {
        kind: 'prompt',
        source: { kind: 'entry', entryId: archetypeEntry },
        list: 'choices',
      },
      selectionSlot: { id: 'slot', position: 2 },
      choiceOrder: 3,
      kept: true,
      state: { kind: 'classFeature', choice: 'Unchanged selection' },
    });
    const item = await ctx.db.insert('catalogEntry', {
      ...common,
      name: 'Chosen weapon',
      ruleIdentity: 'chosen-weapon',
      detail: { kind: 'item', consumable: false },
    });
    const weapon = await ctx.db.insert('characterSheetEntry', {
      characterId,
      kind: 'item',
      active: true,
      catalogEntryId: item,
      state: { kind: 'item', enhancement: 2, material: 'cold iron' },
    });
    const routine = await ctx.db.insert('characterSheetEntry', {
      characterId,
      kind: 'attackRoutine',
      active: true,
      state: {
        kind: 'attackRoutine',
        name: 'Saved routine',
        weaponEntryId: weapon,
        hands: 'one',
        mode: 'melee',
        revision: 4,
      },
    });
    return {
      feature,
      upgrade,
      archetype,
      archetypeEntry,
      selection,
      weapon,
      routine,
    };
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  await completeMove(owner, characterId, 'newer-sheet-state', campaigns[1]);
  const after = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  const copiedFeature = after?.catalogEntries.find(
    (row) => row.copiedFrom === seeded.feature,
  );
  const copiedUpgrade = after?.catalogEntries.find(
    (row) => row.copiedFrom === seeded.upgrade,
  );
  const copiedArchetype = after?.catalogEntries.find(
    (row) => row.copiedFrom === seeded.archetype,
  );
  if (!copiedFeature || !copiedUpgrade || !copiedArchetype)
    throw new Error('Missing carried definitions');
  expect(copiedFeature.detail).toMatchObject({
    duplicateUpgrade: copiedUpgrade._id,
  });
  expect(copiedArchetype.detail).toMatchObject({
    replaces: [{ catalogEntryId: copiedFeature._id, scope: 'whole' }],
  });
  expect(
    after?.entries.find((row) => row._id === seeded.archetypeEntry),
  ).toMatchObject({
    catalogEntryId: copiedArchetype._id,
    state: {
      choice: 'Kept choice',
      replaces: [{ catalogEntryId: copiedFeature._id, scope: 'part' }],
    },
  });
  expect(
    after?.entries.find((row) => row._id === seeded.selection),
  ).toMatchObject({
    _id: seeded.selection,
    catalogEntryId: copiedFeature._id,
    kept: true,
    active: false,
    selectionSource: { source: { entryId: seeded.archetypeEntry } },
    selectionSlot: { id: 'slot', position: 2 },
    choiceOrder: 3,
    state: { choice: 'Unchanged selection' },
  });
  expect(after?.entries.find((row) => row._id === seeded.routine)).toEqual(
    before?.entries.find((row) => row._id === seeded.routine),
  );
  expect(after?.entries.find((row) => row._id === seeded.weapon)).toMatchObject(
    { state: { enhancement: 2, material: 'cold iron' } },
  );
});

test('multi-batch staging uses the same campaign-preference projection before publication', async () => {
  const { t, owner, characterId, campaigns } = await fixture();
  const seeded = await t.run(async (ctx) => {
    for (let i = 0; i < 70; i++)
      await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        name: `Unused stage root ${i}`,
        ruleIdentity: `stage-root-${i}`,
        modifiers: [],
        sources: [],
        stacksWithItself: false,
        detail: { kind: 'manual' },
      });
    const fields = {
      name: 'Global choice',
      ruleIdentity: 'stage-preferred',
      modifiers: [],
      sources: [],
      stacksWithItself: false,
      detail: { kind: 'classFeature' as const },
    };
    const original = await ctx.db.insert('catalogEntry', {
      ...fields,
      scope: 'global',
    });
    const preferred = await ctx.db.insert('catalogEntry', {
      ...fields,
      scope: 'campaign',
      campaignId: campaigns[0],
      copiedFrom: original,
      campaignPreference: true,
      name: 'Preferred source choice',
    });
    const parent = await ctx.db.insert('catalogEntry', {
      ...fields,
      scope: 'global',
      name: 'Future global progression',
      ruleIdentity: 'global-stage-parent',
      grants: [{ catalogEntryId: original }],
    });
    await ctx.db.insert('characterSheetEntry', {
      characterId,
      kind: 'classFeature',
      active: false,
      catalogEntryId: parent,
      state: { kind: 'classFeature' },
    });
    return { original, preferred, parent };
  });
  const command = { characterId, operationId: 'consistent-staging' };
  let progress = await owner.mutation(api.characterMoves.start, command);
  let batchCount = 0;
  for (; batchCount < 100 && progress.state !== 'completed'; batchCount++)
    progress = await owner.mutation(api.characterMoves.resume, command);
  expect(batchCount).toBeGreaterThan(2);
  expect(progress).toMatchObject({ generation: 0, state: 'completed' });
  const after = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  const carried = after?.catalogEntries.find(
    (row) => row.copiedFrom === seeded.preferred,
  );
  expect(carried?.name).toBe('Preferred source choice');
  expect(
    after?.catalogEntries.find((row) => row._id === seeded.parent)?.grants,
  ).toEqual([{ catalogEntryId: carried?._id }]);
});

test.each(['dependencyKeys', 'requiredDependencyKeys'])(
  'catalog commands reject client-supplied %s',
  async (field) => {
    const { owner, characterId } = await fixture();
    const createOneOff = makeFunctionReference<
      'mutation',
      {
        characterId: Id<'character'>;
        operationId: string;
        definition: unknown;
      },
      Id<'characterSheetEntry'>
    >('catalogCopies:createOneOff');
    await expect(
      owner.mutation(createOneOff, {
        characterId,
        operationId: `invalid-${field}`,
        definition: {
          name: 'Client keyed definition',
          modifiers: [],
          sources: [],
          stacksWithItself: false,
          detail: { kind: 'feat' },
          [field]: ['arbitrary-list'],
        },
      }),
    ).rejects.toThrow('Validator');
  },
);

test('linked-input fallbacks and chosen interpretations remain recorded when a move interrupts the relationship', async () => {
  const { t, owner, characterId, campaigns } = await fixture();
  const masterId = await owner.mutation(api.characterSheet.create, {
    campaignId: campaigns[0],
    organizationId: 'org',
    name: 'Linked master',
    kind: 'pc',
    operationId: 'linked-master',
  });
  const relationshipId = await t.run((ctx) =>
    ctx.db.insert('companionRelationship', {
      associatedCharacterId: masterId,
      companionCharacterId: characterId,
      kind: 'cohort',
      sources: [
        {
          key: 'bond',
          label: 'Cohort bond',
          enabled: true,
          ruleKind: 'cohort',
        },
      ],
      status: 'active',
      manuallyInterrupted: false,
      activatedAt: 1,
      lastOperationId: 'seed-link',
    }),
  );
  const scope = {
    characterId,
    relationshipId,
    input: { kind: 'characterLevel' as const },
  };
  await owner.mutation(api.characterSheetLinkedInputs.saveFallback, {
    ...scope,
    value: 7,
    operationId: 'keep-fallback',
  });
  await owner.mutation(api.characterSheetLinkedInputs.saveInterpretation, {
    ...scope,
    sourceKey: 'bond',
    operationId: 'keep-interpretation',
  });
  const saved = await t.run((ctx) =>
    ctx.db
      .query('characterLinkedInput')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .take(10),
  );
  await completeMove(owner, characterId, 'linked-choice-move', campaigns[1]);
  const after = await owner.query(api.characterSheetLinkedInputs.read, scope);
  expect(after).toMatchObject({
    fallback: 7,
    interpretation: { sourceKey: 'bond' },
    fallbackState: 'applied',
    value: 7,
  });
  expect(
    await t.run((ctx) =>
      ctx.db
        .query('characterLinkedInput')
        .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
        .take(10),
    ),
  ).toEqual(saved);
});

test('a public edit to unrelated campaign homebrew preserves the mover preparation', async () => {
  const { t, owner, characterId, campaigns } = await fixture();
  const otherCharacterId = await owner.mutation(api.characterSheet.create, {
    campaignId: campaigns[0],
    organizationId: 'org',
    name: 'Other Character',
    kind: 'pc',
    operationId: 'other-character',
  });
  const otherEntryId = await owner.mutation(api.catalogCopies.createOneOff, {
    characterId: otherCharacterId,
    operationId: 'other-homebrew',
    definition: {
      name: 'Other homebrew',
      modifiers: [],
      sources: [],
      stacksWithItself: false,
      detail: { kind: 'feat' },
    },
  });
  const otherSheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, {
      characterId: otherCharacterId,
    }),
  );
  const catalogEntryId = selectedCatalogId(otherSheet?.entries, otherEntryId);
  if (!catalogEntryId) throw new Error('Missing shared definition');
  await owner.mutation(api.catalogCopies.saveToCatalog, {
    characterId: otherCharacterId,
    catalogEntryId,
    operationId: 'share-other-homebrew',
  });
  await t.run(async (ctx) => {
    for (let i = 0; i < 70; i++)
      await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        name: `Prepared root ${i}`,
        ruleIdentity: `prepared-root-${i}`,
        modifiers: [],
        sources: [],
        stacksWithItself: false,
        detail: { kind: 'manual' },
      });
  });
  const command = { characterId, operationId: 'unrelated-public-editor' };
  const first = await stageFirstBatch(owner, command);
  expect(first.prepared).toBe(32);
  await owner.mutation(api.catalogCopies.editDefinition, {
    characterId: otherCharacterId,
    catalogEntryId,
    name: 'Edited other homebrew',
    operationId: 'edit-other-homebrew',
  });
  expect(
    await owner.mutation(api.characterMoves.resume, command),
  ).toMatchObject({ generation: first.generation, prepared: 64 });
});

test('a familiar keeps its base creature, recorded scores and relationship across a round-trip move', async () => {
  const { t, owner, characterId, campaigns } = await fixture();
  const masterId = await owner.mutation(api.characterSheet.create, {
    campaignId: campaigns[0],
    organizationId: 'org',
    name: 'Familiar master',
    kind: 'pc',
    operationId: 'familiar-master',
  });
  const relationshipId = await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: masterId,
    companionCharacterId: characterId,
    kind: 'familiar',
    sources: [{ key: 'bond', label: 'Arcane bond', enabled: true }],
    operationId: 'familiar-link',
  });
  await owner.mutation(api.characterSheetFamiliars.selectBaseCreature, {
    characterId,
    relationshipId,
    baseCreatureKey: 'cat',
    operationId: 'familiar-species',
  });
  const familiarState = async () => {
    const sheet = withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId }),
    );
    const character = await t.run((ctx) =>
      ctx.db.get('character', characterId),
    );
    return {
      baseCreatureKey: character?.familiarBaseCreatureKey,
      baseScoresPending: character?.familiarBaseScoresPending,
      abilities: sheet?.permanentCalculated.abilities,
      familiarRelationshipId: sheet?.familiarRelationshipId,
      familiar: sheet?.calculated.familiar,
    };
  };
  const before = await familiarState();
  expect(before).toMatchObject({
    baseCreatureKey: 'cat',
    familiarRelationshipId: relationshipId,
  });
  expect(before.familiar).toBeTruthy();
  await completeMove(owner, characterId, 'familiar-away', campaigns[1]);
  const away = await familiarState();
  expect(away).toMatchObject({
    baseCreatureKey: 'cat',
    baseScoresPending: before.baseScoresPending,
    abilities: before.abilities,
    familiarRelationshipId: relationshipId,
  });
  const relationship = await t.run((ctx) =>
    ctx.db.get('companionRelationship', relationshipId),
  );
  expect(relationship).toMatchObject({
    kind: 'familiar',
    associatedCharacterId: masterId,
    companionCharacterId: characterId,
    sources: [{ key: 'bond', label: 'Arcane bond', enabled: true }],
  });
  await completeMove(owner, characterId, 'familiar-home', campaigns[0]);
  expect(await familiarState()).toEqual(before);
});
