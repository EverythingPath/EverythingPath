// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { afterEach, expect, test, vi } from 'vitest';
import { api, internal } from './_generated/api';
import schema from './schema';
import { seedAcceptedCampaign } from './lib/acceptedCampaignFixture';
import { newMilitiaSetup } from '../src/lib/canonical-setup';
import { initializationEdits } from '../tests/rules/initialization-edits';
import { appendResolutionRecord } from './lib/canonicalDraftStorage';

const modules = import.meta.glob('./**/*.ts');
afterEach(() => vi.useRealTimers());
const stats = {
  description: 'Scouting notes',
  level: 4,
  strength: 12,
  dexterity: 13,
  constitution: 14,
  intelligence: 15,
  wisdom: 16,
  charisma: 17,
};
const statisticFields = [
  'level',
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma',
] as const;

async function fixture() {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ tokenIdentifier: 'test|gm' });
  const seeded = await owner.run((ctx) => seedAcceptedCampaign(ctx));
  const campaignId = seeded.key.campaignId;
  await t.run(async (ctx) => {
    await ctx.db.patch('campaign', campaignId, {
      e2eFixture: {
        namespace: 'sheet',
        version: 1,
        workerKey: '0',
        caseKey: 'sheet',
        campaignKey: 'sheet',
      },
    });
    await ctx.db.insert('user', {
      tokenIdentifier: 'test|outsider',
      orgIds: [{ orgId: 'other', role: 'member' }],
    });
  });
  const characterId = await owner.mutation(api.character.createCharacter, {
    organizationId: 'org',
    character: { campaignId, name: 'Vessa', kind: 'pc', ...stats },
  });
  return {
    t,
    owner,
    seeded,
    characterId,
    campaignId,
    member: t.withIdentity({ tokenIdentifier: 'test|player' }),
    outsider: t.withIdentity({ tokenIdentifier: 'test|outsider' }),
    scope: { organizationId: 'org', characterId },
    listArgs: { organizationId: 'org', campaignId, includeInactive: true },
    militiaScope: { campaignId, militiaId: seeded.key.militiaId },
  };
}

test('ledger creation prepares a minimal sheet and shared facts on the same Character identity', async () => {
  const { member, scope, listArgs, characterId, militiaScope } =
    await fixture();
  const sheet = await member.query(api.characterSheet.read, scope);
  expect(sheet).toMatchObject({
    character: {
      _id: characterId,
      sheetMode: 'militiaOnly',
      description: stats.description,
    },
    calculated: { level: 4, abilities: { charisma: { score: 17 } } },
  });
  const record = (
    await member.query(api.character.listByCampaign, listArgs)
  ).find((character) => character._id === characterId);
  expect(record).toMatchObject({ ...stats, sheetMode: 'militiaOnly' });
  expect(record?.classLevels).toHaveLength(4);
  expect(record?.classLevels?.map((row) => row.name)).toEqual([
    'Unspecified Class Level',
    'Unspecified Class Level',
    'Unspecified Class Level',
    'Unspecified Class Level',
  ]);
  const ledger = await member.query(api.canonicalLedger.read, militiaScope);
  expect(
    ledger.state.militiaSnapshot.characters.find(
      (row) => row.characterId === characterId,
    ),
  ).toMatchObject({ level: 4, charisma: 17, isActive: true });
});

test('creating a Full sheet in an isolated campaign publishes its facts without enrolling it', async () => {
  const { owner, member, campaignId, militiaScope } = await fixture();
  const before = await member.query(api.canonicalLedger.read, militiaScope);
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Built Character',
    kind: 'pc',
    operationId: 'full-create',
  });
  const current = await member.query(api.canonicalLedger.read, militiaScope);
  expect(current.revision).toBe(before.revision + 1);
  expect(
    current.state.militiaSnapshot.characters.find(
      (row) => row.characterId === characterId,
    ),
  ).toMatchObject({ level: 1, charisma: 10, isActive: true });
  expect(current.state.militiaSnapshot.roster).toEqual(
    before.state.militiaSnapshot.roster,
  );
});

test('militia facts include ability drain and exclude damage and short Spell Effects on the same prepared sheet', async () => {
  const { owner, member, scope, listArgs, militiaScope, campaignId } =
    await fixture();
  await member.mutation(api.characterSheet.createAbilityChange, {
    ...scope,
    kind: 'abilityDrain',
    ability: 'strength',
    points: 3,
    operationId: 'drain',
  });
  const drained = await owner.query(api.canonicalLedger.read, militiaScope);
  await member.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Short strength spell',
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 1,
    },
    modifiers: [{ target: 'ability.str', bonusType: 'enhancement', value: 4 }],
    operationId: 'temporary-spell',
  });
  await member.mutation(api.characterSheet.createAbilityChange, {
    ...scope,
    kind: 'abilityDamage',
    ability: 'strength',
    points: 4,
    operationId: 'damage',
  });
  const sheet = await owner.query(api.characterSheet.read, scope);
  expect(sheet?.calculated.abilities.strength).toEqual({
    score: 13,
    modifier: -1,
  });
  expect(sheet?.permanentCalculated.abilities.strength).toEqual({
    score: 9,
    modifier: -1,
  });
  expect(
    (await member.query(api.character.listByCampaign, listArgs)).find(
      (row) => row._id === scope.characterId,
    ),
  ).toMatchObject({ strength: 9 });
  expect(
    (
      await member.query(api.canonicalSetup.options, { campaignId })
    )?.characters.find((row) => row.characterId === scope.characterId),
  ).toMatchObject({ strength: 9 });
  expect(await member.query(api.canonicalLedger.read, militiaScope)).toEqual(
    drained,
  );
  await member.mutation(api.character.updateCharacter, {
    ...scope,
    patch: { strength: 14 },
  });
  const edited = await owner.query(api.characterSheet.read, scope);
  expect(edited?.baseScoresEntry.modifiers).toContainEqual({
    target: 'ability.str',
    bonusType: 'base',
    value: 17,
  });
  expect(edited?.calculated.abilities.strength.score).toBe(18);
  expect(edited?.permanentCalculated.abilities.strength.score).toBe(14);
  expect(
    (
      await member.query(api.canonicalLedger.read, militiaScope)
    ).state.militiaSnapshot.characters.find(
      (row) => row.characterId === scope.characterId,
    ),
  ).toMatchObject({ strength: 14 });
});

test.each([
  {
    detail: {
      kind: 'spellEffect' as const,
      lastsOverOneDay: false,
      defaultCasterLevel: 1,
    },
    permanent: 12,
  },
  {
    detail: {
      kind: 'spellEffect' as const,
      lastsOverOneDay: true,
      defaultCasterLevel: 1,
    },
    permanent: 13,
  },
  { detail: { kind: 'condition' as const }, permanent: 12 },
  { detail: { kind: 'item' as const, consumable: true }, permanent: 12 },
  { detail: { kind: 'item' as const, consumable: false }, permanent: 13 },
  { detail: { kind: 'spell' as const }, permanent: 12 },
])(
  'catalog-backed $detail updates prepared militia facts with whole formula values',
  async ({ detail, permanent }) => {
    const { owner, member, scope, militiaScope, campaignId } = await fixture();
    const before = await owner.query(api.characterSheet.read, scope);
    await expect(
      member.mutation(api.characterSheet.createSheetEntry, {
        ...scope,
        name: 'Fractional ability Modifier',
        detail,
        modifiers: [
          { target: 'ability.str', bonusType: 'untyped', value: 0.5 },
        ],
        operationId: 'fractional-ability',
      }),
    ).rejects.toThrow('Ability Modifiers must be whole numbers');
    expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
    await member.mutation(api.characterSheet.createSheetEntry, {
      ...scope,
      name: 'Whole formula result',
      detail,
      modifiers: [
        {
          target: 'ability.str',
          bonusType: 'untyped',
          value: { formula: '3 / 2' },
        },
        { target: 'init', bonusType: 'untyped', value: 0.5 },
      ],
      operationId: 'formula-and-fraction',
    });
    const sheet = await owner.query(api.characterSheet.read, scope);
    expect(sheet?.calculated.abilities.strength.score).toBe(
      detail.kind === 'spell' ? 12 : 13,
    );
    expect(sheet?.permanentCalculated.abilities.strength.score).toBe(permanent);
    expect(sheet?.calculated.breakdowns.init?.total).toBe(
      detail.kind === 'spell' ? 0 : 0.5,
    );
    expect(
      (
        await member.query(api.canonicalLedger.read, militiaScope)
      ).state.militiaSnapshot.characters.find(
        (row) => row.characterId === scope.characterId,
      ),
    ).toMatchObject({ strength: permanent });
    expect(
      (
        await member.query(api.canonicalSetup.options, { campaignId })
      )?.characters.find((row) => row.characterId === scope.characterId),
    ).toMatchObject({ strength: permanent });
  },
);

test('ledger level and permanent-score edits write sheet entries and keep their live facts current', async () => {
  const { owner, member, scope, listArgs, militiaScope } = await fixture();
  const before = await owner.query(api.characterSheet.read, scope);
  await member.mutation(api.character.updateCharacter, {
    ...scope,
    patch: { level: 6, strength: 19, charisma: 21 },
  });
  const sheet = await owner.query(api.characterSheet.read, scope);
  expect(sheet?.calculated).toMatchObject({
    level: 6,
    abilities: { strength: { score: 19 }, charisma: { score: 21 } },
  });
  expect(sheet?.entries.slice(0, 5).map((row) => row._id)).toEqual(
    before?.entries.map((row) => row._id),
  );
  expect(
    sheet?.entries
      .filter((row) => row.kind === 'classLevel')
      .map((row) => row.state.position),
  ).toEqual([1, 2, 3, 4, 5, 6]);
  const record = (
    await owner.query(api.character.listByCampaign, listArgs)
  ).find((row) => row._id === scope.characterId);
  expect(record).toMatchObject({ level: 6, strength: 19, charisma: 21 });
  const ledger = await member.query(api.canonicalLedger.read, militiaScope);
  expect(
    ledger.state.militiaSnapshot.characters.find(
      (row) => row.characterId === scope.characterId,
    ),
  ).toMatchObject({ level: 6, strength: 19, charisma: 21 });
});

test('decreasing ledger level names and confirms the current trailing rows without deleting unseen changes', async () => {
  const { t, owner, member, scope, listArgs } = await fixture();
  const initial = await owner.query(api.characterSheet.read, scope);
  const trailing = initial?.entries
    .filter((row) => row.kind === 'classLevel')
    .slice(2);
  const named = trailing?.[1];
  if (!trailing || !named) throw new Error('Missing Class Levels');
  await t.run(async (ctx) => {
    const classEntryId = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: scope.characterId,
      name: 'Ranger',
      ruleIdentity: 'ranger',
      stacksWithItself: false,
      detail: { kind: 'class' },
      modifiers: [],
      sources: [],
    });
    await ctx.db.patch('characterSheetEntry', named._id, {
      state: { ...named.state, classEntryId },
    });
  });
  const record = (
    await owner.query(api.character.listByCampaign, listArgs)
  ).find((row) => row._id === scope.characterId);
  expect(record?.classLevels?.slice(2).map((row) => row.name)).toEqual([
    'Unspecified Class Level',
    'Ranger',
  ]);
  const before = await owner.query(api.characterSheet.read, scope);
  await expect(
    member.mutation(api.character.updateCharacter, {
      ...scope,
      patch: { level: 2 },
    }),
  ).rejects.toThrow('Review and confirm');
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
  const confirmedRemovedLevelIds = trailing.map((row) => row._id);
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: named._id,
    hpGained: 8,
    operationId: 'changed-hp',
  });
  await expect(
    member.mutation(api.character.updateCharacter, {
      ...scope,
      patch: { level: 2 },
      confirmedRemovedLevelIds,
      expectedSheetRevision: before?.revision,
    }),
  ).rejects.toThrow('Review and confirm');
  const changed = await owner.query(api.characterSheet.read, scope);
  await owner.mutation(api.character.updateCharacter, {
    ...scope,
    patch: { level: 2 },
    confirmedRemovedLevelIds,
    expectedSheetRevision: changed?.revision,
  });
  const after = await member.query(api.characterSheet.read, scope);
  expect(after?.calculated.level).toBe(2);
  expect(after?.entries.map((row) => row._id)).toEqual(
    initial?.entries.slice(0, 3).map((row) => row._id),
  );
});

test('Build out retains every entry and identity, makes ledger statistics read-only and preserves editable metadata', async () => {
  const { owner, member, scope, listArgs, militiaScope } = await fixture();
  const before = await owner.query(api.characterSheet.read, scope);
  const live = await owner.query(api.canonicalLedger.read, militiaScope);
  await member.mutation(api.characterSheet.buildOut, {
    ...scope,
    operationId: 'build-out',
  });
  const built = await owner.query(api.characterSheet.read, scope);
  expect(built?.character).toMatchObject({
    _id: scope.characterId,
    sheetMode: 'full',
  });
  expect(built?.entries).toEqual(before?.entries);
  expect(built?.calculated).toMatchObject({
    level: before?.calculated.level,
    hitDice: before?.calculated.hitDice,
    abilities: before?.calculated.abilities,
    hp: before?.calculated.hp,
    creationSettings: before?.calculated.creationSettings,
    pointBuy: before?.calculated.pointBuy,
  });
  expect(before?.calculated.warnings).toEqual([]);
  expect(built?.calculated.warnings).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ check: 'class', kind: 'incomplete' }),
      expect.objectContaining({ check: 'pointBuy', kind: 'rules' }),
    ]),
  );
  expect(await member.query(api.canonicalLedger.read, militiaScope)).toEqual(
    live,
  );
  await owner.mutation(api.characterSheet.buildOut, {
    ...scope,
    operationId: 'already-built',
  });
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(built);
  for (const patch of [{ level: 4 }, { strength: 19 }])
    await expect(
      member.mutation(api.character.updateCharacter, { ...scope, patch }),
    ).rejects.toThrow('Edit level and ability scores on the Character Sheet');
  await member.mutation(api.character.updateCharacter, {
    ...scope,
    patch: {
      name: 'Vessa Vale',
      description: 'Full notes',
      kind: 'npc',
      isActive: false,
    },
  });
  const record = (
    await owner.query(api.character.listByCampaign, listArgs)
  ).find((row) => row._id === scope.characterId);
  expect(record).toMatchObject({
    name: 'Vessa Vale',
    description: 'Full notes',
    kind: 'npc',
    isActive: false,
    sheetMode: 'full',
    level: 4,
    strength: 12,
  });
});

test('an ability score outside the safe integer range is rejected before Setup without changing the sheet or metadata', async () => {
  const { t, owner } = await fixture();
  const campaignId = await owner.mutation(api.campaign.createCampaign, {
    organizationId: 'org',
    name: 'Before Setup',
    description: '',
  });
  await t.run(async (ctx) => {
    await ctx.db.insert('militia', { campaignId, name: 'Before Setup' });
    await ctx.db.patch('campaign', campaignId, {
      e2eFixture: {
        namespace: 'sheet',
        version: 1,
        workerKey: '0',
        caseKey: 'sheet',
        campaignKey: 'before-setup',
      },
    });
  });
  const characterId = await owner.mutation(api.character.createCharacter, {
    organizationId: 'org',
    character: {
      campaignId,
      name: 'Large score',
      kind: 'pc',
      ...stats,
      strength: Number.MAX_SAFE_INTEGER,
    },
  });
  const scope = { organizationId: 'org', characterId };
  const before = await owner.query(api.characterSheet.read, scope);
  await expect(
    owner.mutation(api.character.updateCharacter, {
      ...scope,
      patch: { strength: Number.MAX_SAFE_INTEGER + 1, name: 'Must not save' },
    }),
  ).rejects.toThrow('whole ability scores');
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
});

test('Militia-only score edits preserve exact safe integers when the score change exceeds the safe integer range', async () => {
  const { owner, member, scope, militiaScope } = await fixture();
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    operationId: 'negative-safe-base',
    scores: { strength: -9007199254740991 },
  });
  await member.mutation(api.character.updateCharacter, {
    ...scope,
    patch: { strength: 9007199254740990 },
  });
  const sheet = await owner.query(api.characterSheet.read, scope);
  expect(sheet?.calculated.abilities.strength.score).toBe(9007199254740990);
  expect(
    sheet?.baseScoresEntry.modifiers.find(
      (modifier) => modifier.target === 'ability.str',
    )?.value,
  ).toBe(9007199254740990);
  const ledger = await member.query(api.canonicalLedger.read, militiaScope);
  expect(
    ledger.state.militiaSnapshot.characters.find(
      (row) => row.characterId === scope.characterId,
    )?.strength,
  ).toBe(9007199254740990);
});

test('fractional ability scores are rejected without corrupting Setup or Preview', async () => {
  const { owner, member, scope, seeded, campaignId } = await fixture();
  const before = await owner.query(api.characterSheet.read, scope);
  for (const strength of [
    10.5,
    Number.MAX_SAFE_INTEGER + 1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ]) {
    await expect(
      member.mutation(api.character.updateCharacter, {
        ...scope,
        patch: { strength, name: 'Must not save' },
      }),
    ).rejects.toThrow(
      Number.isFinite(strength) ? 'whole ability scores' : 'finite',
    );
    await expect(
      member.mutation(api.characterSheet.editBaseScores, {
        ...scope,
        scores: { strength },
        operationId: 'fractional-base',
      }),
    ).rejects.toThrow(
      Number.isFinite(strength) ? 'whole ability scores' : 'finite',
    );
  }
  await expect(
    member.mutation(api.characterSheet.createPersonalAdjustment, {
      ...scope,
      operationId: 'fractional-ability-adjustment',
      name: 'Partial strength',
      modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 0.5 }],
    }),
  ).rejects.toThrow('Ability Modifiers must be whole numbers');
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
  expect(
    (
      await member.query(api.canonicalSetup.options, { campaignId })
    )?.characters.find((row) => row.characterId === scope.characterId),
  ).toMatchObject({ strength: 12 });
  expect(
    await owner.query(api.canonicalDraftPersistence.preview, seeded.key),
  ).toHaveProperty('status');
});

test('overflowing permanent ability totals reject a personal adjustment atomically', async () => {
  const { owner, member, scope, militiaScope } = await fixture();
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    operationId: 'large-base',
    scores: { strength: Number.MAX_SAFE_INTEGER },
  });
  const before = await owner.query(api.characterSheet.read, scope);
  const source = await owner.query(api.canonicalLedger.read, militiaScope);
  await expect(
    member.mutation(api.characterSheet.createPersonalAdjustment, {
      ...scope,
      operationId: 'overflow-adjustment',
      name: 'Overflow',
      modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 1 }],
    }),
  ).rejects.toThrow('Enter whole ability scores');
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
  expect(await member.query(api.canonicalLedger.read, militiaScope)).toEqual(
    source,
  );
});

test('Setup options and reviewed facts use the same prepared sheet calculation as the live ledger', async () => {
  const { t, owner, member } = await fixture();
  const campaignId = await owner.mutation(api.campaign.createCampaign, {
    organizationId: 'org',
    name: 'Setup sheet',
    description: '',
  });
  await t.run(async (ctx) => {
    await ctx.db.insert('militia', { campaignId, name: 'Setup sheet' });
    await ctx.db.patch('campaign', campaignId, {
      e2eFixture: {
        namespace: 'sheet',
        version: 1,
        workerKey: '0',
        caseKey: 'sheet',
        campaignKey: 'setup',
      },
    });
  });
  const characterId = await owner.mutation(api.character.createCharacter, {
    organizationId: 'org',
    character: { campaignId, name: 'Setup officer', kind: 'pc', ...stats },
  });
  const scope = { organizationId: 'org', characterId };
  await expect(
    member.mutation(api.character.updateCharacter, {
      ...scope,
      patch: { strength: 10.5 },
    }),
  ).rejects.toThrow('Enter whole ability scores');
  await member.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 20 },
    operationId: 'strength',
  });
  const options = await member.query(api.canonicalSetup.options, {
    campaignId,
  });
  expect(options?.characters[0]).toMatchObject({
    characterId,
    level: 4,
    strength: 20,
  });
  const option = options?.characters[0];
  if (!option) throw new Error('Missing Setup facts');
  const { name: _name, ...facts } = option;
  const setup = newMilitiaSetup('Security');
  setup.state.militiaSnapshot.characters = [facts];
  await member.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { charisma: 18 },
    operationId: 'charisma',
  });
  await expect(
    owner.mutation(api.canonicalSetup.initialize, {
      campaignId,
      initializationId: 'sheet-setup',
      setup,
    }),
  ).rejects.toThrow('Character facts changed');
  const current = (
    await owner.query(api.canonicalSetup.options, { campaignId })
  )?.characters[0];
  if (!current) throw new Error('Missing current Setup facts');
  const { name: _currentName, ...currentFacts } = current;
  setup.state.militiaSnapshot.characters = [currentFacts];
  const key = await owner.mutation(api.canonicalSetup.initialize, {
    campaignId,
    initializationId: 'sheet-setup',
    setup,
  });
  const live = await member.query(api.canonicalLedger.read, {
    campaignId,
    militiaId: key.militiaId,
  });
  expect(live.state.militiaSnapshot.characters).toEqual([currentFacts]);
});

test('only changed facts stale reviews and corrections, while Confirmation and superseded History retain their selected facts', async () => {
  vi.useFakeTimers();
  const { t, owner, member, scope, seeded, militiaScope } = await fixture();
  const initial = await owner.query(api.canonicalLedger.read, militiaScope);
  await owner.mutation(api.canonicalLedger.save, {
    ...militiaScope,
    expectedRevision: initial.revision,
    reason: 'Enroll Vessa',
    snapshot: {
      ...initial.state.militiaSnapshot,
      roster: {
        ...initial.state.militiaSnapshot.roster,
        people: [
          ...initial.state.militiaSnapshot.roster.people,
          { characterId: scope.characterId, kind: 'pc', hitDice: 0 },
        ],
      },
    },
  });
  const edits = [
    ...initializationEdits('patrol', seeded.characterId),
    ...[5, 6].map((rank) => ({
      kind: 'acknowledge' as const,
      acknowledgement: {
        acknowledgementId: `vessa-boon:${rank}`,
        subjectId: `upkeep:boon:${rank}:${scope.characterId}`,
        outcome: 'Reward recorded',
      },
    })),
  ];
  for (const [baseRevision, edit] of edits.entries())
    await member.mutation(api.canonicalDraftPersistence.edit, {
      ...militiaScope,
      operation: {
        draftId: seeded.key.draftId,
        operationId: `review-edit-${baseRevision}`,
        baseRevision,
        edit,
      },
    });
  const reviewed = await owner.query(
    api.canonicalDraftPersistence.preview,
    seeded.key,
  );
  expect(reviewed.status).toBe('ready');
  const unchanged = await member.query(api.canonicalLedger.read, militiaScope);
  const sheet = await member.query(api.characterSheet.read, scope);
  const first = sheet?.entries.find((row) => row.kind === 'classLevel');
  if (!first) throw new Error('Missing Class Level');
  await member.mutation(api.character.updateCharacter, {
    ...scope,
    patch: { description: 'Notes only', name: 'Vessa Vale' },
  });
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    hpGained: 8,
    operationId: 'hp-only',
  });
  await member.mutation(api.characterSheet.moveClassLevel, {
    ...scope,
    entryId: first._id,
    position: 2,
    operationId: 'order-only',
  });
  expect(await member.query(api.canonicalLedger.read, militiaScope)).toEqual(
    unchanged,
  );
  expect(
    (await owner.query(api.canonicalDraftPersistence.preview, seeded.key))
      .reviewed,
  ).toEqual(reviewed.reviewed);
  await member.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { charisma: 24 },
    operationId: 'facts',
  });
  const current = await owner.query(api.canonicalLedger.read, militiaScope);
  expect(current.revision).toBe(unchanged.revision + 1);
  expect(current.state.militiaSnapshot.roster).toEqual(
    unchanged.state.militiaSnapshot.roster,
  );
  await expect(
    owner.mutation(api.canonicalLedger.save, {
      ...militiaScope,
      expectedRevision: current.revision,
      reason: 'Stale facts',
      snapshot: unchanged.state.militiaSnapshot,
    }),
  ).rejects.toThrow('Keep the current character records');
  await expect(
    owner.mutation(api.canonicalDraftPersistence.confirm, {
      ...seeded.key,
      operation: {
        operationId: 'stale-confirmation',
        reviewed: reviewed.reviewed,
      },
    }),
  ).rejects.toThrow('Reviewed weekly source changed');
  await member.mutation(api.character.updateCharacter, {
    ...scope,
    patch: { kind: 'npc' },
  });
  const kindChanged = await member.query(
    api.canonicalLedger.read,
    militiaScope,
  );
  expect(kindChanged.revision).toBe(current.revision + 1);
  expect(
    kindChanged.state.militiaSnapshot.roster.people.find(
      (person) => person.characterId === scope.characterId,
    ),
  ).toMatchObject({ kind: 'npc', hitDice: 0 });
  const fresh = await owner.query(
    api.canonicalDraftPersistence.preview,
    seeded.key,
  );
  await expect(
    member.mutation(api.characterSheet.editBaseScores, {
      ...scope,
      scores: { charisma: 24.5 },
      operationId: 'fraction-before-confirmation',
    }),
  ).rejects.toThrow('Enter whole ability scores');
  const { record } = await owner.mutation(
    api.canonicalDraftPersistence.confirm,
    {
      ...seeded.key,
      operation: {
        operationId: 'fresh-confirmation',
        reviewed: fresh.reviewed,
      },
    },
  );
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  await owner.run((ctx) =>
    appendResolutionRecord(ctx, {
      ...militiaScope,
      record: {
        ...record,
        recordId: 'superseding-history',
        provenance: 'historical_correction',
        supersedesRecordId: record.recordId,
      },
    }),
  );
  const historyArgs = { campaignId: seeded.key.campaignId, week: 9 };
  const effective = await member.query(api.canonicalHistory.read, historyArgs);
  const superseded = await owner.query(api.canonicalHistory.read, {
    ...historyArgs,
    recordId: record.recordId,
  });
  await member.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { charisma: 30 },
    operationId: 'after-history',
  });
  await member.mutation(api.character.archiveCharacter, {
    ...scope,
    isActive: false,
  });
  expect(await owner.query(api.canonicalHistory.read, historyArgs)).toEqual(
    effective,
  );
  expect(
    await member.query(api.canonicalHistory.read, {
      ...historyArgs,
      recordId: record.recordId,
    }),
  ).toEqual(superseded);
  expect(superseded?.record).toEqual(record);
});

test('prepared Characters require actual organization membership for editing and archive changes', async () => {
  const { t, owner, member, outsider, scope, listArgs, militiaScope } =
    await fixture();
  await t.run((ctx) =>
    ctx.db.insert('user', { tokenIdentifier: 'test|org-fallback', orgIds: [] }),
  );
  const fallback = t.withIdentity({ tokenIdentifier: 'test|org-fallback' });
  const before = await owner.query(api.characterSheet.read, scope);
  const live = await member.query(api.canonicalLedger.read, militiaScope);
  for (const caller of [t, outsider, fallback]) {
    await expect(
      caller.mutation(api.character.updateCharacter, {
        ...scope,
        patch: { description: 'Denied' },
      }),
    ).rejects.toThrow();
    await expect(
      caller.mutation(api.characterSheet.buildOut, {
        ...scope,
        operationId: 'denied',
      }),
    ).rejects.toThrow();
    await expect(
      caller.mutation(api.character.archiveCharacter, {
        ...scope,
        isActive: false,
      }),
    ).rejects.toThrow();
  }
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
  expect(await owner.query(api.canonicalLedger.read, militiaScope)).toEqual(
    live,
  );
  await member.mutation(api.character.archiveCharacter, {
    ...scope,
    isActive: false,
  });
  expect(
    (await owner.query(api.character.listByCampaign, listArgs)).find(
      (row) => row._id === scope.characterId,
    )?.isActive,
  ).toBe(false);
});

test('a production candidate sheet does not activate ledger reads or writes before cutover', async () => {
  const { t, owner, member, scope, listArgs, militiaScope, campaignId } =
    await fixture();
  const before = await member.query(api.characterSheet.read, scope);
  await t.run((ctx) =>
    ctx.db.patch('campaign', campaignId, { e2eFixture: undefined }),
  );
  await owner.mutation(api.character.updateCharacter, {
    ...scope,
    patch: { level: 9, charisma: 25 },
  });
  const record = (
    await member.query(api.character.listByCampaign, listArgs)
  ).find((row) => row._id === scope.characterId);
  expect(record).toMatchObject({ level: 9, charisma: 25 });
  expect(record).not.toHaveProperty('sheetMode');
  expect(record).not.toHaveProperty('classLevels');
  const live = await member.query(api.canonicalLedger.read, militiaScope);
  expect(
    live.state.militiaSnapshot.characters.find(
      (row) => row.characterId === scope.characterId,
    ),
  ).toMatchObject({ level: 9, charisma: 25 });
  expect(
    (
      await owner.query(api.canonicalSetup.options, { campaignId })
    )?.characters.find((row) => row.characterId === scope.characterId),
  ).toMatchObject({ level: 9, charisma: 25 });
  const candidate = await member.query(api.characterSheet.read, scope);
  expect(candidate?.entries).toEqual(before?.entries);
  expect(candidate?.calculated).toEqual(before?.calculated);
  await expect(
    owner.mutation(api.characterSheet.buildOut, {
      ...scope,
      operationId: 'production',
    }),
  ).rejects.toThrow("Character sheets aren't available for this campaign yet.");
});

test('ledger edits and Build out stay blocked during initial migration and reject stale commands after reopening', async () => {
  const { t, owner, scope, listArgs, militiaScope } = await fixture();
  const before = await owner.query(api.characterSheet.read, scope);
  const live = await owner.query(api.canonicalLedger.read, militiaScope);
  const run = await t.mutation(internal.initialMigration.start, {
    operationId: 'sheet-maintenance',
    expectedEpoch: 0,
    frontendBuild: 'test-build',
    catalogManifest: 'test-catalog',
    maintenanceBudgetMs: 60000,
  });
  for (const command of [
    () =>
      owner.mutation(api.character.updateCharacter, {
        ...scope,
        patch: { level: 5 },
      }),
    () =>
      owner.mutation(api.characterSheet.buildOut, {
        ...scope,
        operationId: 'blocked',
      }),
  ])
    await expect(command()).rejects.toThrow('maintenance');
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
  expect(await owner.query(api.canonicalLedger.read, militiaScope)).toEqual(
    live,
  );
  expect(
    (await owner.query(api.character.listByCampaign, listArgs)).find(
      (row) => row._id === scope.characterId,
    )?.sheetMode,
  ).toBe('militiaOnly');
  const reopened = await t.mutation(
    internal.initialMigration.abortBeforeActivation,
    run,
  );
  await expect(
    owner.mutation(api.characterSheet.buildOut, {
      ...scope,
      operationId: 'stale',
    }),
  ).rejects.toThrow('Reload');
  await owner.mutation(api.characterSheet.buildOut, {
    ...scope,
    operationId: 'fresh',
    writeEpoch: reopened.epoch,
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.character.sheetMode,
  ).toBe('full');
});

test('ledger levels prune level-zero acceptance using the new rows and never restore it when zero returns', async () => {
  const { owner, member, scope } = await fixture();
  const original = await owner.query(api.characterSheet.read, scope);
  const originalLevels = original?.entries.filter(
    (row) => row.kind === 'classLevel',
  );
  if (!original || !originalLevels) throw new Error('Missing Character Sheet');
  await member.mutation(api.character.updateCharacter, {
    ...scope,
    patch: { level: 0 },
    confirmedRemovedLevelIds: originalLevels.map((row) => row._id),
    expectedSheetRevision: original.revision,
  });
  const zero = await owner.query(api.characterSheet.read, scope);
  const warning = zero?.calculated.warnings.find(
    (warning) => warning.check === 'levelZero',
  );
  if (!warning) throw new Error('Missing level-zero warning');
  await member.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    operationId: 'accept-zero',
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
  });
  const accepted = await owner.query(api.characterSheet.read, scope);
  expect(accepted?.acceptedWarnings).toHaveLength(1);
  await member.mutation(api.character.updateCharacter, {
    ...scope,
    operationId: 'ledger-level-and-scores',
    patch: { level: 1, strength: 20 },
  });
  const raised = await owner.query(api.characterSheet.read, scope);
  expect(raised?.calculated).toMatchObject({
    level: 1,
    abilities: { strength: { score: 20 } },
  });
  expect(raised?.acceptedWarnings).toEqual([]);
  expect(raised?.lastOperationId).toBe('ledger-level-and-scores');
  expect(raised?.revision).toBe(accepted!.revision + 1);
  const raisedLevels = raised?.entries.filter(
    (row) => row.kind === 'classLevel',
  );
  await member.mutation(api.character.updateCharacter, {
    ...scope,
    patch: { level: 0 },
    confirmedRemovedLevelIds: raisedLevels?.map((row) => row._id),
    expectedSheetRevision: raised?.revision,
  });
  const returned = await owner.query(api.characterSheet.read, scope);
  expect(returned?.acceptedWarnings).toEqual([]);
  expect(returned?.calculated.warnings).toEqual([
    expect.objectContaining({
      kind: 'rules',
      check: 'levelZero',
      target: { kind: 'classLevels' },
    }),
  ]);
});

test('Build out prunes obsolete acceptances and preserves a current warning on retained sheet entries', async () => {
  const { t, owner, member, scope, militiaScope } = await fixture();
  await member.mutation(api.characterSheet.buildOut, {
    ...scope,
    operationId: 'prepare-full-warning',
  });
  const full = await owner.query(api.characterSheet.read, scope);
  const warning = full?.calculated.warnings.find(
    (warning) => warning.check === 'pointBuy',
  );
  if (!warning) throw new Error('Missing point-buy warning');
  await member.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    operationId: 'accept-retained-warning',
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
  });
  // Retained entries may carry existing acceptances into a minimal presentation.
  await t.run(async (ctx) => {
    await ctx.db.patch('character', scope.characterId, {
      sheetMode: 'militiaOnly',
    });
    await ctx.db.insert('acceptedWarning', {
      characterId: scope.characterId,
      check: 'levelZero',
      subject: 'sheet',
      fingerprint: '["pc",0]',
      acceptedBy: 'test|gm',
      acceptedAt: 0,
    });
  });
  const before = await owner.query(api.characterSheet.read, scope);
  const live = await owner.query(api.canonicalLedger.read, militiaScope);
  await member.mutation(api.characterSheet.buildOut, {
    ...scope,
    operationId: 'retain-current-warning',
  });
  const built = await owner.query(api.characterSheet.read, scope);
  expect(built?.acceptedWarnings).toEqual(
    before?.acceptedWarnings.filter(
      (accepted) => accepted.check === 'pointBuy',
    ),
  );
  expect(built?.acceptedWarnings).toHaveLength(1);
  expect(built?.lastOperationId).toBe('retain-current-warning');
  expect(built?.revision).toBe(before!.revision + 1);
  expect(built?.entries).toEqual(before?.entries);
  expect(await owner.query(api.canonicalLedger.read, militiaScope)).toEqual(
    live,
  );
});

test.each(statisticFields)(
  'flat %s edits reject fractional, unsafe and nonfinite values without changing facts or metadata',
  async (field) => {
    const { owner, member, seeded, militiaScope, campaignId, listArgs } =
      await fixture();
    const characterId = seeded.characterId;
    const before = await owner.query(api.canonicalLedger.read, militiaScope);
    const options = await owner.query(api.canonicalSetup.options, {
      campaignId,
    });
    const record = (
      await owner.query(api.character.listByCampaign, listArgs)
    ).find((row) => row._id === characterId);
    for (const value of [1.5, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN]) {
      await expect(
        member.mutation(api.character.updateCharacter, {
          organizationId: 'org',
          characterId,
          patch: { [field]: value, description: 'Must not save' },
        }),
      ).rejects.toThrow(
        field === 'level'
          ? 'Enter a whole level'
          : /Enter (whole|finite) ability scores/,
      );
      expect(await owner.query(api.canonicalLedger.read, militiaScope)).toEqual(
        before,
      );
      expect(
        await owner.query(api.canonicalSetup.options, { campaignId }),
      ).toEqual(options);
      expect(
        (await owner.query(api.character.listByCampaign, listArgs)).find(
          (row) => row._id === characterId,
        ),
      ).toEqual(record);
    }
  },
);

test.each(statisticFields)(
  'flat %s creation and edits enforce structural integers even before a militia exists',
  async (field) => {
    const { owner } = await fixture();
    const campaignId = await owner.mutation(api.campaign.createCampaign, {
      organizationId: 'org',
      name: 'Flat before militia',
      description: '',
    });
    const character = {
      campaignId,
      name: 'Flat',
      kind: 'pc' as const,
      ...stats,
    };
    const listArgs = {
      organizationId: 'org',
      campaignId,
      includeInactive: true,
    };
    await expect(
      owner.mutation(api.character.createCharacter, {
        organizationId: 'org',
        character: { ...character, [field]: 1.5 },
      }),
    ).rejects.toThrow(
      field === 'level' ? 'Enter a whole level' : 'Enter whole ability scores',
    );
    expect(await owner.query(api.character.listByCampaign, listArgs)).toEqual(
      [],
    );
    const characterId = await owner.mutation(api.character.createCharacter, {
      organizationId: 'org',
      character,
    });
    const before = await owner.query(api.character.listByCampaign, listArgs);
    await expect(
      owner.mutation(api.character.updateCharacter, {
        organizationId: 'org',
        characterId,
        patch: { [field]: 1.5, description: 'Must not save' },
      }),
    ).rejects.toThrow(
      field === 'level' ? 'Enter a whole level' : 'Enter whole ability scores',
    );
    expect(await owner.query(api.character.listByCampaign, listArgs)).toEqual(
      before,
    );
    const value = field === 'level' ? -1 : Number.MAX_SAFE_INTEGER;
    await owner.mutation(api.character.updateCharacter, {
      organizationId: 'org',
      characterId,
      patch: { [field]: value },
    });
    expect(await owner.query(api.character.listByCampaign, listArgs)).toEqual([
      expect.objectContaining({ [field]: value }),
    ]);
    expect(
      (await owner.query(api.canonicalSetup.options, { campaignId }))
        ?.characters,
    ).toEqual([expect.objectContaining({ [field]: value })]);
  },
);

test.each(statisticFields)(
  'Setup refuses existing structurally invalid flat %s facts while the ledger permits correction',
  async (field) => {
    const { t, owner, seeded, campaignId, listArgs } = await fixture();
    for (const value of [1.5, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN]) {
      await t.run((ctx) =>
        ctx.db.patch('character', seeded.characterId, { [field]: value }),
      );
      await expect(
        owner.query(api.canonicalSetup.options, { campaignId }),
      ).rejects.toThrow(
        field === 'level'
          ? 'Enter a whole level'
          : /Enter (whole|finite) ability scores/,
      );
      expect(
        (await owner.query(api.character.listByCampaign, listArgs)).find(
          (row) => row._id === seeded.characterId,
        ),
      ).toMatchObject({ [field]: value });
    }
    await owner.mutation(api.character.updateCharacter, {
      organizationId: 'org',
      characterId: seeded.characterId,
      patch: { [field]: 10 },
    });
    expect(
      (
        await owner.query(api.canonicalSetup.options, { campaignId })
      )?.characters.find((row) => row.characterId === seeded.characterId),
    ).toMatchObject({ [field]: 10 });
  },
);

test('legacy campaigns with more than 256 Characters retain flat ledger authority and the original Setup limit', async () => {
  const { t, owner, campaignId, listArgs } = await fixture();
  await t.run(async (ctx) => {
    await ctx.db.patch('campaign', campaignId, { e2eFixture: undefined });
    for (let index = 0; index < 257; index++)
      await ctx.db.insert('character', {
        campaignId,
        name: `Legacy ${index}`,
        kind: 'pc',
        isActive: true,
        ...stats,
      });
  });
  const rows = await owner.query(api.character.listByCampaign, listArgs);
  expect(rows.length).toBeGreaterThan(256);
  expect(rows.every((row) => row.sheetMode === undefined)).toBe(true);
  await expect(
    owner.query(api.canonicalSetup.options, { campaignId }),
  ).rejects.toThrow('This campaign exceeds the setup character limit');
});

test('Setup admits 256 flat Characters and refuses the 257th with its original limit', async () => {
  const { t, owner } = await fixture();
  const campaignId = await owner.mutation(api.campaign.createCampaign, {
    organizationId: 'org',
    name: 'Setup bound',
    description: '',
  });
  const character = {
    campaignId,
    name: 'Flat',
    kind: 'pc' as const,
    isActive: true,
    ...stats,
  };
  await t.run(async (ctx) => {
    for (let index = 0; index < 256; index++)
      await ctx.db.insert('character', character);
  });
  expect(
    (await owner.query(api.canonicalSetup.options, { campaignId }))?.characters,
  ).toHaveLength(256);
  await t.run((ctx) => ctx.db.insert('character', character));
  await expect(
    owner.query(api.canonicalSetup.options, { campaignId }),
  ).rejects.toThrow('This campaign exceeds the setup character limit');
});

test('prepared-sheet ledger limits remain separate from the original Setup limit', async () => {
  const { t, owner, campaignId, listArgs } = await fixture();
  await t.run(async (ctx) => {
    for (let index = 0; index < 256; index++)
      await ctx.db.insert('character', {
        campaignId,
        name: `Prepared ${index}`,
        kind: 'pc',
        isActive: true,
        sheetMode: 'militiaOnly',
        ...stats,
      });
  });
  await expect(
    owner.query(api.character.listByCampaign, listArgs),
  ).rejects.toThrow('This campaign exceeds the prepared Character limit');
  await expect(
    owner.query(api.canonicalSetup.options, { campaignId }),
  ).rejects.toThrow('This campaign exceeds the setup character limit');
});

test('level growth respects existing personal adjustments before Setup', async () => {
  const { t, owner } = await fixture();
  const campaignId = await owner.mutation(api.campaign.createCampaign, {
    organizationId: 'org',
    name: 'Before Setup',
    description: '',
  });
  await t.run(async (ctx) => {
    await ctx.db.insert('militia', { campaignId, name: 'Before Setup' });
    await ctx.db.patch('campaign', campaignId, {
      e2eFixture: {
        namespace: 'sheet',
        version: 1,
        workerKey: '0',
        caseKey: 'sheet',
        campaignKey: 'limit',
      },
    });
  });
  const characterId = await owner.mutation(api.character.createCharacter, {
    organizationId: 'org',
    character: {
      campaignId,
      name: 'Growing Character',
      kind: 'pc',
      ...stats,
      level: 1,
    },
  });
  const scope = { organizationId: 'org', characterId };
  const adjustmentId = await owner.mutation(
    api.characterSheet.createPersonalAdjustment,
    {
      ...scope,
      operationId: 'retained-adjustment',
      name: 'Charisma reward',
      modifiers: [{ target: 'ability.cha', bonusType: 'untyped', value: 2 }],
    },
  );
  const before = await owner.query(api.characterSheet.read, scope);
  await owner.mutation(api.character.updateCharacter, {
    ...scope,
    patch: { level: 2 },
  });
  const grown = await owner.query(api.characterSheet.read, scope);
  expect(grown).toMatchObject({
    character: { name: 'Growing Character' },
    calculated: { level: 2, abilities: { charisma: { score: 19 } } },
  });
  expect(grown?.entries).toHaveLength(4);
  expect(grown?.entries.find((entry) => entry._id === adjustmentId)).toEqual(
    before?.entries.find((entry) => entry._id === adjustmentId),
  );
  // Base scores and the adjustment make level 4095 exceed the real 4096-entry cap.
  await expect(
    owner.mutation(api.character.updateCharacter, {
      ...scope,
      patch: { level: 4095, name: 'Must not save' },
    }),
  ).rejects.toThrow('Character sheet is too large');
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(grown);
});

test('combined ledger level and score edits account for ability increases removed with trailing rows', async () => {
  const { t, owner, member, scope, listArgs, militiaScope } = await fixture();
  const initial = await owner.query(api.characterSheet.read, scope);
  const trailing = initial?.entries
    .filter((row) => row.kind === 'classLevel')
    .at(-1);
  if (!trailing || !initial) throw new Error('Missing Class Level');
  await t.run((ctx) =>
    ctx.db.patch('characterSheetEntry', trailing._id, {
      state: { ...trailing.state, abilityIncrease: 'strength' },
    }),
  );
  const before = await owner.query(api.characterSheet.read, scope);
  expect(before?.permanentCalculated.abilities.strength.score).toBe(13);
  await member.mutation(api.character.updateCharacter, {
    ...scope,
    patch: { level: 3, strength: 15 },
    confirmedRemovedLevelIds: [trailing._id],
    expectedSheetRevision: before?.revision,
  });
  const record = (
    await owner.query(api.character.listByCampaign, listArgs)
  ).find((row) => row._id === scope.characterId);
  expect(record).toMatchObject({ level: 3, strength: 15 });
  const ledger = await owner.query(api.canonicalLedger.read, militiaScope);
  expect(
    ledger.state.militiaSnapshot.characters.find(
      (row) => row.characterId === scope.characterId,
    ),
  ).toMatchObject({ level: 3, strength: 15 });
});
