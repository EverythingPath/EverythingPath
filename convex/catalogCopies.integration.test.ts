// @vitest-environment edge-runtime
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { convexTest } from 'convex-test';
import type { FunctionArgs } from 'convex/server';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';
import { seedAcceptedCampaign } from './lib/acceptedCampaignFixture';
import { buildCharacterSheetRacesView } from '../src/components/character-sheet/character-sheet-races-view-model';

const modules = import.meta.glob('./**/*.ts');
async function fixture() {
  const t = convexTest(schema, modules);
  const campaignId = await t.run(async (ctx) => {
    for (const [name, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `test|${name}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    return ctx.db.insert('campaign', {
      name: 'Homebrew',
      description: '',
      organizationId: 'org',
      ownerId: 'test|owner',
      e2eFixture: {
        namespace: 'copies',
        version: 1,
        workerKey: '0',
        caseKey: 'copies',
        campaignKey: 'copies',
      },
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'test|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'test|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'test|outsider' });
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
    member,
    outsider,
    scope: { organizationId: 'org', campaignId, characterId },
  };
}
const definition = {
  name: 'Strong heart',
  modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 2 }],
  stacksWithItself: false,
  sources: [],
  detail: { kind: 'feat' },
} satisfies FunctionArgs<typeof api.catalogCopies.createOneOff>['definition'];

test('note references survive campaign copies, local notes keep entry ownership, and foreign references are refused', async () => {
  const { t, owner, member, scope } = await fixture();
  const optionId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      ...definition,
      scope: 'global',
      ruleIdentity: 'combat-expertise',
      name: 'Combat Expertise',
      modifiers: [],
    }),
  );
  const entryId = await member.mutation(api.catalogCopies.createOneOff, {
    ...scope,
    operationId: 'note-entry',
    definition: {
      ...definition,
      modifiers: [],
      situationalNotes: [
        {
          target: 'ac',
          situation: { option: optionId },
          text: 'May defend cautiously.',
        },
        {
          situation: { local: 'critical confirmation' },
          text: 'Reroll confirmation.',
        },
      ],
    },
  });
  const copyId = await member.mutation(api.catalogCopies.customizeForCampaign, {
    ...scope,
    catalogEntryId: optionId,
    operationId: 'copy-note-option',
  });
  let read = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(read?.calculated.derivedStatistics.ac.notes).toEqual([
    expect.objectContaining({
      sheetEntryId: entryId,
      situation: { option: copyId },
    }),
  ]);
  expect(read?.calculated.entryNotes).toEqual([
    expect.objectContaining({
      sheetEntryId: entryId,
      situation: { local: 'critical confirmation' },
    }),
  ]);
  const row = read?.entries.find((row) => row._id === entryId);
  if (!row || !('catalogEntryId' in row)) throw new Error('Missing note entry');
  await member.mutation(api.catalogCopies.editDefinition, {
    ...scope,
    catalogEntryId: row.catalogEntryId,
    situationalNotes: [
      { target: 'saves', situation: 'fear', text: 'Reroll fear saves.' },
    ],
    operationId: 'change-notes',
  });
  read = withSheetCatalog(await owner.query(api.characterSheet.read, scope));
  expect(read?.calculated.breakdowns['save.will']?.notes?.[0]?.text).toBe(
    'Reroll fear saves.',
  );
  const foreignId = await t.run(async (ctx) => {
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Other',
      organizationId: 'other',
      ownerId: 'other',
      description: '',
    });
    return ctx.db.insert('catalogEntry', {
      ...definition,
      scope: 'campaign',
      campaignId,
      ruleIdentity: 'foreign',
    });
  });
  await expect(
    member.mutation(api.catalogCopies.editDefinition, {
      ...scope,
      catalogEntryId: row.catalogEntryId,
      situationalNotes: [
        { situation: { option: foreignId }, text: 'Foreign option.' },
      ],
      operationId: 'foreign-note',
    }),
  ).rejects.toThrow('does not belong');
  await expect(
    member.mutation(api.catalogCopies.editDefinition, {
      ...scope,
      catalogEntryId: row.catalogEntryId,
      situationalNotes: [{ text: '' }],
      operationId: 'empty-note',
    }),
  ).rejects.toThrow('Situational Note is invalid');
  await expect(
    member.mutation(api.catalogCopies.editDefinition, {
      ...scope,
      catalogEntryId: row.catalogEntryId,
      situationalNotes: [
        { situation: 'x'.repeat(65), text: 'Too long an identity.' },
      ],
      operationId: 'long-note',
    }),
  ).rejects.toThrow('Situational Note is invalid');
});

test.each([
  { weapon: '$self' as const },
  { weaponSelection: 'longsword' },
  { option: true as const },
])(
  'personal adjustment definitions reject unsupported scope %j through the catalog editor',
  async (condition) => {
    const { owner, scope } = await fixture();
    const entryId = await owner.mutation(
      api.characterSheet.createPersonalAdjustment,
      {
        ...scope,
        name: 'Reward',
        modifiers: [],
        operationId: 'add',
      },
    );
    const before = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    const row = before?.entries.find((entry) => entry._id === entryId);
    if (!row || !('catalogEntryId' in row))
      throw new Error('Missing adjustment');
    await expect(
      owner.mutation(api.catalogCopies.editDefinition, {
        ...scope,
        catalogEntryId: row.catalogEntryId,
        situationalNotes: [{ text: 'Conditional note', condition }],
        operationId: 'invalid',
      }),
    ).rejects.toThrow('Situational Note is invalid');
    await expect(
      owner.mutation(api.catalogCopies.editDefinition, {
        ...scope,
        catalogEntryId: row.catalogEntryId,
        modifiers: [
          { target: 'save.will', bonusType: 'untyped', value: 2, condition },
        ],
        operationId: 'invalid-modifier',
      }),
    ).rejects.toThrow('Modifier condition is invalid');
    expect(
      withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
    ).toEqual(before);
  },
);

test('item definitions retain weapon-scoped modifiers and notes through both editors', async () => {
  const { owner, scope } = await fixture();
  const modifiers = [
    {
      target: 'attack' as const,
      bonusType: 'enhancement' as const,
      value: 1,
      condition: { weapon: '$self' as const },
    },
  ];
  const situationalNotes = [
    { text: 'This weapon only.', condition: { weapon: '$self' as const } },
  ];
  const entryId = await owner.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Scoped item',
    detail: { kind: 'item', consumable: false },
    modifiers,
    situationalNotes,
    operationId: 'add',
  });
  let read = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const row = read?.entries.find((entry) => entry._id === entryId);
  if (!row || !('catalogEntryId' in row)) throw new Error('Missing item');
  await owner.mutation(api.catalogCopies.editDefinition, {
    ...scope,
    catalogEntryId: row.catalogEntryId,
    modifiers,
    situationalNotes,
    name: 'Catalog edit',
    operationId: 'catalog-edit',
  });
  await owner.mutation(api.characterSheet.editSheetEntry, {
    ...scope,
    entryId,
    modifiers,
    situationalNotes,
    name: 'Sheet edit',
    operationId: 'sheet-edit',
  });
  read = withSheetCatalog(await owner.query(api.characterSheet.read, scope));
  expect(
    read?.catalogEntries.find((entry) => entry._id === row.catalogEntryId),
  ).toMatchObject({
    name: 'Sheet edit',
    modifiers,
    situationalNotes,
  });
});

test.each(['global', 'campaign', 'campaign with recorded override'] as const)(
  'racial statistics from a %s race create one private Catalog Copy with provenance',
  async (raceScope) => {
    const { t, owner, member, scope } = await fixture();
    const originalId = await t.run((ctx) =>
      ctx.db.insert('catalogEntry', {
        ...definition,
        scope: 'global',
        name: 'Shared race',
        sources: [],
        ruleIdentity: 'shared-race',
        sourceKey: 'shared-race-source',
        modifiers: [],
        detail: { kind: 'race', racialTraits: [], racialHitDice: 0 },
      }),
    );
    await owner.mutation(api.characterSheet.selectRace, {
      ...scope,
      catalogEntryId: originalId,
      operationId: 'select-race',
    });
    const sourceId =
      raceScope !== 'global'
        ? await member.mutation(api.catalogCopies.customizeForCampaign, {
            ...scope,
            catalogEntryId: originalId,
            operationId: 'customize-race',
          })
        : originalId;
    const before = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    const race = before?.entries.find((entry) => entry.kind === 'race');
    if (!race) throw new Error('Missing race');
    if (raceScope === 'campaign with recorded override')
      await t.run((ctx) =>
        ctx.db.patch('characterSheetEntry', race._id, {
          catalogOverride: true,
        }),
      );
    await member.mutation(api.characterSheet.editRaceStatistics, {
      ...scope,
      entryId: race._id,
      racialHitDice: 2,
      operationId: 'racial-hd',
    });
    const saved = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    const savedRace = saved?.entries.find((entry) => entry._id === race._id);
    if (savedRace?.kind !== 'race') throw new Error('Missing saved race');
    const copy = saved?.catalogEntries.find(
      (entry) => entry._id === savedRace.catalogEntryId,
    );
    expect(copy).toMatchObject({
      scope: 'character',
      characterId: scope.characterId,
      racialStatisticsCopy: true,
      copiedFrom: sourceId,
      copiedFromFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      ruleIdentity: 'shared-race',
      sourceKey: 'shared-race-source',
      detail: { racialHitDice: 2 },
    });
    expect(copy).not.toHaveProperty('campaignId');
    expect(copy).not.toHaveProperty('campaignPreference');
    const picker = await member.query(api.catalogCopies.list, scope);
    expect(picker.some((row) => row._id === savedRace.catalogEntryId)).toBe(
      false,
    );
    expect(picker.find((row) => row._id === sourceId)).toMatchObject({
      detail: { racialHitDice: 0 },
    });
    if (!saved) throw new Error('Missing saved sheet');
    const races = buildCharacterSheetRacesView(saved, picker);
    expect(races.raceOptions).toContainEqual(
      expect.objectContaining({ catalogEntryId: sourceId }),
    );
    expect(races.selectedRaceId).toBe(sourceId);
    await expect(
      member.mutation(api.catalogCopies.detach, {
        ...scope,
        target: { kind: 'entry', entryId: race._id },
        operationId: 'detach-statistics',
      }),
    ).rejects.toThrow('Character-specific');
    const unchanged = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    expect(unchanged?.catalogEntries).toEqual(saved?.catalogEntries);
    expect(unchanged?.revision).toBe(saved?.revision);
  },
);

test('editing a detached race reuses its Catalog Copy and keeps it available after race changes', async () => {
  const { t, owner, scope } = await fixture();
  const originalId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      ...definition,
      scope: 'global',
      name: 'Shared race',
      sources: [],
      ruleIdentity: 'shared-race',
      modifiers: [],
      detail: { kind: 'race', racialTraits: [] },
    }),
  );
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: originalId,
    operationId: 'select-race',
  });
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const race = initial?.entries.find((entry) => entry.kind === 'race');
  if (!race) throw new Error('Missing race');
  const copyId = await owner.mutation(api.catalogCopies.detach, {
    ...scope,
    target: { kind: 'entry', entryId: race._id },
    operationId: 'detach-race',
  });
  const detached = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  await owner.mutation(api.characterSheet.editRaceStatistics, {
    ...scope,
    entryId: race._id,
    racialHitDice: 2,
    racialHpGained: 8,
    operationId: 'racial-hd',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(saved?.entries.find((entry) => entry._id === race._id)).toMatchObject({
    catalogEntryId: copyId,
    state: { racialHpGained: 8 },
  });
  expect(saved?.catalogEntries).toHaveLength(
    detached?.catalogEntries.length ?? 0,
  );
  await owner.mutation(api.characterSheet.discardRaceStatistics, {
    ...scope,
    entryId: race._id,
    operationId: 'discard-detached',
  });
  const kept = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(kept?.revision).toBe(saved?.revision);
  expect(kept?.catalogEntries).toEqual(saved?.catalogEntries);
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: originalId,
    operationId: 'original-race',
  });
  const picker = await owner.query(api.catalogCopies.list, scope);
  expect(picker.find((row) => row._id === copyId)).toMatchObject({
    copiedFrom: originalId,
    scope: 'character',
    detail: { racialHitDice: 2 },
  });
  expect(picker.find((row) => row._id === copyId)).not.toHaveProperty(
    'racialStatisticsCopy',
  );
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: copyId,
    operationId: 'restore-detached',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated,
  ).toMatchObject({
    hitDice: 3,
    level: 1,
  });
});

test('a racial statistics copy freezes persisted race fields while global trait dependencies stay live', async () => {
  const { t, owner, scope } = await fixture();
  const seeded = await owner.run((ctx) =>
    seedAcceptedCampaign(ctx, scope.campaignId),
  );
  const catalog = await t.run(async (ctx) => {
    const traitId = await ctx.db.insert('catalogEntry', {
      ...definition,
      scope: 'global',
      ruleIdentity: 'shared-trait',
      modifiers: [...definition.modifiers],
      sources: [],
      detail: { kind: 'racialTrait', raceEntryIds: [], replaces: [] },
    });
    const raceId = await ctx.db.insert('catalogEntry', {
      ...definition,
      scope: 'global',
      ruleIdentity: 'shared-race',
      sources: [],
      modifiers: [],
      detail: { kind: 'race', racialTraits: [traitId] },
    });
    return { traitId, raceId };
  });
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.raceId,
    operationId: 'select-race',
  });
  const traitCopyId = await owner.mutation(
    api.catalogCopies.customizeForCampaign,
    {
      ...scope,
      catalogEntryId: catalog.traitId,
      operationId: 'customize-trait',
    },
  );
  await owner.mutation(api.catalogCopies.editDefinition, {
    ...scope,
    catalogEntryId: traitCopyId,
    modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 6 }],
    operationId: 'edit-trait',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const race = before?.entries.find((entry) => entry.kind === 'race');
  if (!race) throw new Error('Missing race');
  await owner.mutation(api.characterSheet.editRaceStatistics, {
    ...scope,
    entryId: race._id,
    racialHitDice: 2,
    operationId: 'racial-hd',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const savedRace = saved?.entries.find((entry) => entry._id === race._id);
  if (savedRace?.kind !== 'race') throw new Error('Missing saved race');
  expect(
    saved?.catalogEntries.find((row) => row._id === savedRace.catalogEntryId),
  ).toMatchObject({
    detail: { racialTraits: [catalog.traitId], racialHitDice: 2 },
  });
  expect(saved?.calculated.abilities.strength.score).toBe(16);
  const ledger = await owner.query(api.canonicalLedger.read, {
    campaignId: scope.campaignId,
    militiaId: seeded.key.militiaId,
  });
  expect(
    ledger.state.militiaSnapshot.characters.find(
      (character) => character.characterId === scope.characterId,
    ),
  ).toMatchObject({ racialHitDice: 2, strength: 16 });
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', catalog.traitId, {
      name: 'Published trait name',
    }),
  );
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )?.catalogEntries.find((row) => row._id === catalog.traitId),
  ).toMatchObject({ name: 'Published trait name' });
});

test('saving racial statistics to the campaign catalog keeps the race selectable after changing races', async () => {
  const { t, owner, member, scope } = await fixture();
  const originalId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      ...definition,
      scope: 'global',
      ruleIdentity: 'shared-race',
      modifiers: [],
      sources: [],
      detail: { kind: 'race', racialTraits: [] },
    }),
  );
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: originalId,
    operationId: 'select-race',
  });
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const race = initial?.entries.find((entry) => entry.kind === 'race');
  if (!race) throw new Error('Missing race');
  await owner.mutation(api.characterSheet.editRaceStatistics, {
    ...scope,
    entryId: race._id,
    racialHitDice: 2,
    operationId: 'racial-hd',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const savedRace = saved?.entries.find((entry) => entry._id === race._id);
  if (savedRace?.kind !== 'race') throw new Error('Missing saved race');
  await owner.mutation(api.catalogCopies.saveToCatalog, {
    ...scope,
    catalogEntryId: savedRace.catalogEntryId,
    operationId: 'save-race',
  });
  const picker = await member.query(api.catalogCopies.list, scope);
  const sharedCopy = picker.find((row) => row._id === savedRace.catalogEntryId);
  expect(sharedCopy).toMatchObject({
    scope: 'campaign',
    campaignId: scope.campaignId,
    detail: { racialHitDice: 2 },
  });
  expect(sharedCopy).not.toHaveProperty('racialStatisticsCopy');
  expect(sharedCopy).not.toHaveProperty('campaignPreference');
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: originalId,
    operationId: 'original-race',
  });
  expect(await member.query(api.catalogCopies.list, scope)).toContainEqual(
    sharedCopy,
  );
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: savedRace.catalogEntryId,
    operationId: 'shared-race',
  });
  await owner.mutation(api.characterSheet.editRaceStatistics, {
    ...scope,
    entryId: race._id,
    racialHitDice: 3,
    operationId: 'character-racial-hd',
  });
  expect(await member.query(api.catalogCopies.list, scope)).toContainEqual(
    sharedCopy,
  );
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated.hitDice,
  ).toBe(4);
});

test('referenced shared definitions do not consume the racial statistics copy limit', async () => {
  const { t, owner, scope } = await fixture();
  const raceId = await t.run(async (ctx) => {
    // Browse-only seeded Spells sit outside the sheet's row allowance.
    const local = await ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId_and_browseOnly', (q) =>
        q.eq('characterId', scope.characterId).eq('browseOnly', undefined),
      )
      .take(4096);
    for (let index = local.length; index < 4095; index++)
      await ctx.db.insert('catalogEntry', {
        ...definition,
        scope: 'character',
        characterId: scope.characterId,
        ruleIdentity: `unused-local-${index}`,
        sources: [],
        modifiers: [],
      });
    const traits = [];
    for (let index = 0; index < 16; index++)
      traits.push(
        await ctx.db.insert('catalogEntry', {
          ...definition,
          scope: 'global',
          ruleIdentity: `shared-trait-${index}`,
          sources: [],
          modifiers: [],
          detail: { kind: 'racialTrait', raceEntryIds: [], replaces: [] },
        }),
      );
    return ctx.db.insert('catalogEntry', {
      ...definition,
      scope: 'global',
      ruleIdentity: 'shared-race',
      sources: [],
      modifiers: [],
      detail: { kind: 'race', racialTraits: traits },
    });
  });
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: raceId,
    operationId: 'select-race',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const race = before?.entries.find((entry) => entry.kind === 'race');
  if (!race) throw new Error('Missing race');
  await owner.mutation(api.characterSheet.editRaceStatistics, {
    ...scope,
    entryId: race._id,
    racialHitDice: 2,
    operationId: 'racial-hd',
  });
  const saved = await owner.query(api.characterSheet.read, scope);
  expect(saved?.calculated).toMatchObject({ level: 1, hitDice: 3 });
  expect(
    saved?.catalogEntries.filter((row) => row.scope === 'character'),
  ).toHaveLength(4096);
});

test('browse-only seeds and Spells leave a fixture sheet its full Character row allowance', async () => {
  const { t, owner, scope } = await fixture();
  const seeded = await t.run(async (ctx) => {
    const browseOnly = await ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId_and_browseOnly', (q) =>
        q.eq('characterId', scope.characterId).eq('browseOnly', true),
      )
      .take(4096);
    const counted = await ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId_and_browseOnly', (q) =>
        q.eq('characterId', scope.characterId).eq('browseOnly', undefined),
      )
      .take(4096);
    for (let index = counted.length; index < 4095; index++)
      await ctx.db.insert('catalogEntry', {
        ...definition,
        scope: 'character',
        characterId: scope.characterId,
        ruleIdentity: `allowance-${index}`,
        sources: [],
        modifiers: [],
      });
    return browseOnly;
  });
  expect(seeded.some((row) => row.importedSpell)).toBe(true);
  expect(seeded.some((row) => row.detail.kind === 'class')).toBe(true);
  expect(
    seeded.every(
      (row) =>
        row.scope === 'character' && row.characterId === scope.characterId,
    ),
  ).toBe(true);
  const oneOff = {
    ...scope,
    definition: {
      ...definition,
      name: 'Last allowed row',
      modifiers: [...definition.modifiers],
      sources: [],
    },
  };
  await owner.mutation(api.catalogCopies.createOneOff, {
    ...oneOff,
    operationId: 'last-row',
  });
  const full = await owner.query(api.characterSheet.read, scope);
  expect(
    full?.catalogEntries.filter((row) => row.scope === 'character'),
  ).toHaveLength(4096);
  expect(full?.catalogEntries.some((row) => row.browseOnly)).toBe(false);
  await expect(
    owner.mutation(api.catalogCopies.createOneOff, {
      ...oneOff,
      operationId: 'past-allowance',
    }),
  ).rejects.toThrow('Character sheet is too large');
});

test('shared races, Racial Traits and equipment retain Catalog Copies and recorded state', async () => {
  const { t, owner, member, scope } = await fixture();
  const catalog = await t.run(async (ctx) => {
    const raceId = await ctx.db.insert('catalogEntry', {
      ...definition,
      scope: 'global',
      name: 'Shared Human',
      ruleIdentity: 'shared-human',
      modifiers: [],
      sources: [],
      detail: { kind: 'race', racialTraits: [] },
    });
    const traitId = await ctx.db.insert('catalogEntry', {
      ...definition,
      scope: 'global',
      name: 'Shared ability',
      ruleIdentity: 'shared-ability',
      modifiers: [{ target: 'ability.$choice', bonusType: 'racial', value: 2 }],
      sources: [],
      countsAsRaces: { oneOf: ['human', 'elf'] },
      detail: { kind: 'racialTrait', raceEntryIds: [raceId], replaces: [] },
    });
    await ctx.db.patch('catalogEntry', raceId, {
      detail: { kind: 'race', racialTraits: [traitId] },
    });
    const itemId = await ctx.db.insert('catalogEntry', {
      ...definition,
      scope: 'campaign',
      campaignId: scope.campaignId,
      name: 'Shared leather',
      ruleIdentity: 'shared-leather',
      modifiers: [],
      sources: [],
      proficiencies: [{ category: 'light' }],
      detail: {
        kind: 'item',
        consumable: false,
        armor: {
          slot: 'armor',
          category: 'lightArmor',
          bonus: 2,
          maxDex: 6,
          armorCheckPenalty: 0,
          asf: 10,
        },
      },
    });
    const unrelatedId = await ctx.db.insert('catalogEntry', {
      ...definition,
      scope: 'global',
      name: 'Unrelated shared definition',
      ruleIdentity: 'unrelated-shared',
      modifiers: [],
      sources: [],
    });
    return { raceId, traitId, itemId, unrelatedId };
  });
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.raceId,
    operationId: 'shared-race',
  });
  const before = withSheetCatalog(
    await member.query(api.characterSheet.read, scope),
  );
  const race = before?.entries.find((row) => row.kind === 'race');
  const trait = before?.calculated.resolvedEntries.find(
    (row) => row.entry.kind === 'racialTrait',
  );
  if (!race || !trait || !('grantKey' in trait.entry) || !trait.entry.grantKey)
    throw new Error('Missing shared race and Grant');
  const traitCopyId = await member.mutation(api.catalogCopies.detach, {
    ...scope,
    target: { kind: 'grant', grantKey: trait.entry.grantKey },
    operationId: 'detach-trait',
  });
  await owner.mutation(api.characterSheet.chooseRacialAbilityScore, {
    ...scope,
    target: { grantKey: trait.entry.grantKey },
    ability: 'strength',
    operationId: 'choose-ability',
  });
  await member.mutation(api.catalogCopies.editDefinition, {
    ...scope,
    catalogEntryId: traitCopyId,
    name: 'Custom shared ability',
    modifiers: [{ target: 'ability.$choice', bonusType: 'racial', value: 4 }],
    operationId: 'edit-trait-copy',
  });
  const itemEntryId = await member.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: catalog.itemId,
    operationId: 'shared-equipment',
  });
  const itemCopyId = await member.mutation(api.catalogCopies.detach, {
    ...scope,
    target: { kind: 'entry', entryId: itemEntryId },
    operationId: 'detach-equipment',
  });
  await owner.mutation(api.characterSheet.editEquipment, {
    ...scope,
    entryId: itemEntryId,
    enhancement: 1,
    operationId: 'enhance-equipment',
  });
  const sheet = withSheetCatalog(
    await member.query(api.characterSheet.read, scope),
  );
  expect(
    sheet?.entries.find((row) => row.kind === 'racialTrait'),
  ).toMatchObject({
    catalogEntryId: traitCopyId,
    catalogOverride: true,
    grantKey: trait.entry.grantKey,
    state: { choice: 'strength' },
  });
  expect(sheet?.entries.find((row) => row._id === itemEntryId)).toMatchObject({
    catalogEntryId: itemCopyId,
    state: { enhancement: 1 },
  });
  expect(
    sheet?.catalogEntries.find((row) => row._id === traitCopyId),
  ).toMatchObject({
    countsAsRaces: { oneOf: ['human', 'elf'] },
    copiedFrom: catalog.traitId,
  });
  expect(
    sheet?.catalogEntries.find((row) => row._id === itemCopyId),
  ).toMatchObject({
    proficiencies: [{ category: 'light' }],
    copiedFrom: catalog.itemId,
  });
  expect(sheet?.calculated.abilities.strength.score).toBe(14);
  expect(sheet?.calculated.breakdowns['ac.armor'].total).toBe(3);
  expect(
    sheet?.catalogEntries.some((row) => row._id === catalog.unrelatedId),
  ).toBe(false);
});

test('race, alternate Racial Trait and Class Level pickers resolve stale global choices to campaign preferences', async () => {
  const { t, owner, member, scope } = await fixture();
  const catalog = await t.run(async (ctx) => {
    const raceId = await ctx.db.insert('catalogEntry', {
      ...definition,
      scope: 'global',
      name: 'Preferred race',
      ruleIdentity: 'preferred-race',
      modifiers: [],
      sources: [],
      detail: { kind: 'race', racialTraits: [] },
    });
    const traitId = await ctx.db.insert('catalogEntry', {
      ...definition,
      scope: 'global',
      name: 'Preferred alternate',
      ruleIdentity: 'preferred-alternate',
      modifiers: [],
      sources: [],
      detail: { kind: 'racialTrait', raceEntryIds: [raceId], replaces: [] },
    });
    const classId = await ctx.db.insert('catalogEntry', {
      ...definition,
      scope: 'global',
      name: 'Preferred class',
      ruleIdentity: 'preferred-class',
      modifiers: [],
      sources: [],
      detail: { kind: 'class' },
    });
    return { raceId, traitId, classId };
  });
  const raceCopy = await member.mutation(
    api.catalogCopies.customizeForCampaign,
    {
      ...scope,
      catalogEntryId: catalog.raceId,
      operationId: 'customize-race',
    },
  );
  const traitCopy = await member.mutation(
    api.catalogCopies.customizeForCampaign,
    {
      ...scope,
      catalogEntryId: catalog.traitId,
      operationId: 'customize-alternate',
    },
  );
  const classCopy = await member.mutation(
    api.catalogCopies.customizeForCampaign,
    {
      ...scope,
      catalogEntryId: catalog.classId,
      operationId: 'customize-class',
    },
  );
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.raceId,
    operationId: 'stale-race-picker',
  });
  expect(
    withSheetCatalog(await member.query(api.characterSheet.read, scope))
      ?.entries,
  ).toContainEqual(
    expect.objectContaining({ kind: 'race', catalogEntryId: raceCopy }),
  );
  await owner.mutation(api.characterSheet.setRacialTraitSelected, {
    ...scope,
    catalogEntryId: catalog.traitId,
    selected: true,
    operationId: 'stale-alternate-picker',
  });
  expect(
    withSheetCatalog(await member.query(api.characterSheet.read, scope))
      ?.entries,
  ).toContainEqual(
    expect.objectContaining({ kind: 'racialTrait', catalogEntryId: traitCopy }),
  );
  const levelId = await owner.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: catalog.classId,
    operationId: 'stale-add-class',
  });
  expect(
    withSheetCatalog(await member.query(api.characterSheet.read, scope))
      ?.entries,
  ).toContainEqual(
    expect.objectContaining({
      _id: levelId,
      state: expect.objectContaining({ classEntryId: classCopy }),
    }),
  );
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: levelId,
    classEntryId: catalog.classId,
    operationId: 'stale-edit-class',
  });
  expect(
    withSheetCatalog(await member.query(api.characterSheet.read, scope))
      ?.entries,
  ).toContainEqual(
    expect.objectContaining({
      _id: levelId,
      state: expect.objectContaining({ classEntryId: classCopy }),
    }),
  );
  const detachedClass = await owner.mutation(api.catalogCopies.detach, {
    ...scope,
    target: { kind: 'entry', entryId: levelId },
    operationId: 'detach-preferred-class',
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: levelId,
    classEntryId: detachedClass,
    operationId: 'explicit-detached-class',
  });
  expect(
    withSheetCatalog(await member.query(api.characterSheet.read, scope))
      ?.entries,
  ).toContainEqual(
    expect.objectContaining({
      _id: levelId,
      state: expect.objectContaining({ classEntryId: detachedClass }),
    }),
  );
});

test('one-off creation atomically adds a private definition and Selection for any campaign member', async () => {
  const { member, owner, outsider, scope } = await fixture();
  const entryId = await member.mutation(api.catalogCopies.createOneOff, {
    ...scope,
    operationId: 'one-off',
    definition: {
      ...definition,
      modifiers: [...definition.modifiers],
      sources: [],
    },
  });
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const entry = sheet?.entries.find((row) => row._id === entryId);
  expect(entry).toMatchObject({ kind: 'feat', active: true });
  const catalog = sheet?.catalogEntries.find(
    (row) =>
      row._id ===
      (entry && 'catalogEntryId' in entry ? entry.catalogEntryId : null),
  );
  expect(catalog).toMatchObject({
    name: 'Strong heart',
    scope: 'character',
    characterId: scope.characterId,
  });
  expect(sheet?.calculated.abilities.strength.score).toBe(12);
  await expect(
    outsider.mutation(api.catalogCopies.createOneOff, {
      ...scope,
      operationId: 'outsider',
      definition: { ...definition, modifiers: [], sources: [] },
    }),
  ).rejects.toThrow();
  await expect(
    member.mutation(api.catalogCopies.createOneOff, {
      ...scope,
      operationId: 'invalid',
      definition: { ...definition, name: ' ', modifiers: [], sources: [] },
    }),
  ).rejects.toThrow();
  await expect(
    member.mutation(api.catalogCopies.createOneOff, {
      ...scope,
      operationId: 'non-racial-choice',
      definition: {
        ...definition,
        modifiers: [
          { target: 'ability.$choice', bonusType: 'racial', value: 2 },
        ],
        sources: [],
      },
    }),
  ).rejects.toThrow('Ability score choices belong to Racial Traits');
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.entries,
  ).toHaveLength(3);
});

test('Save to catalog requires a campaign and shares the same definition with its members', async () => {
  const { owner, member, scope } = await fixture();
  const entryId = await owner.mutation(api.catalogCopies.createOneOff, {
    ...scope,
    operationId: 'one-off',
    definition: { ...definition, modifiers: [], sources: [] },
  });
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const entry = sheet?.entries.find((row) => row._id === entryId);
  if (!entry || !('catalogEntryId' in entry))
    throw new Error('Missing Selection');
  await member.mutation(api.catalogCopies.saveToCatalog, {
    ...scope,
    operationId: 'save',
    catalogEntryId: entry.catalogEntryId,
  });
  expect(await member.query(api.catalogCopies.list, scope)).toContainEqual(
    expect.objectContaining({
      _id: entry.catalogEntryId,
      scope: 'campaign',
      campaignId: scope.campaignId,
    }),
  );
  const privateId = await owner.mutation(api.characterSheet.create, {
    name: 'Private',
    kind: 'pc',
    operationId: 'private',
  });
  const privateScope = { characterId: privateId };
  const privateEntryId = await owner.mutation(api.catalogCopies.createOneOff, {
    ...privateScope,
    operationId: 'private-oneoff',
    definition: { ...definition, modifiers: [], sources: [] },
  });
  const privateSheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, privateScope),
  );
  const privateEntry = privateSheet?.entries.find(
    (row) => row._id === privateEntryId,
  );
  if (!privateEntry || !('catalogEntryId' in privateEntry))
    throw new Error('Missing private Selection');
  await expect(
    owner.mutation(api.catalogCopies.saveToCatalog, {
      ...privateScope,
      operationId: 'private-save',
      catalogEntryId: privateEntry.catalogEntryId,
    }),
  ).rejects.toThrow('campaign');
});

async function globalFeat(t: Awaited<ReturnType<typeof fixture>>['t']) {
  return t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Power',
      ruleIdentity: 'power',
      stacksWithItself: false,
      modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 2 }],
      sources: [],
      detail: { kind: 'feat' },
    }),
  );
}
test('selecting a global definition after campaign customization uses the preferred copy and preserves recorded choices', async () => {
  const { t, owner, member, scope } = await fixture();
  const globalId = await globalFeat(t);
  const copyId = await member.mutation(api.catalogCopies.customizeForCampaign, {
    ...scope,
    catalogEntryId: globalId,
    operationId: 'customize',
  });
  await member.mutation(api.catalogCopies.editDefinition, {
    ...scope,
    catalogEntryId: copyId,
    name: 'Campaign Power',
    modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 4 }],
    operationId: 'edit-copy',
  });
  const entryId = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: globalId,
    choice: 'Longsword',
    notes: 'Our table choice',
    active: true,
    operationId: 'stale-picker',
  });
  const sheet = withSheetCatalog(
    await member.query(api.characterSheet.read, scope),
  );
  expect(sheet?.entries.find((row) => row._id === entryId)).toMatchObject({
    catalogEntryId: copyId,
    active: true,
    notes: 'Our table choice',
    state: { choice: 'Longsword' },
  });
  expect(sheet?.calculated.abilities.strength.score).toBe(14);
  const detachedId = await owner.mutation(api.catalogCopies.detach, {
    ...scope,
    target: { kind: 'entry', entryId },
    operationId: 'detach-selection',
  });
  const detachedEntryId = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: detachedId,
    operationId: 'choose-detached',
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )?.entries.find((row) => row._id === detachedEntryId),
  ).toMatchObject({ catalogEntryId: detachedId });
});
test('customizing a global definition repoints campaign sheets and future pickers while global edits are refused', async () => {
  const { t, owner, member, outsider, scope } = await fixture();
  const globalId = await globalFeat(t);
  const secondId = await member.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId: scope.campaignId,
    name: 'Dara',
    kind: 'pc',
    operationId: 'second',
  });
  const secondScope = { ...scope, characterId: secondId };
  const firstEntry = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: globalId,
    operationId: 'select',
  });
  const secondEntry = await member.mutation(api.characterSheet.selectEntry, {
    ...secondScope,
    catalogEntryId: globalId,
    operationId: 'select-second',
  });
  await expect(
    owner.mutation(api.catalogCopies.editDefinition, {
      ...scope,
      catalogEntryId: globalId,
      name: 'No',
      operationId: 'global-edit',
    }),
  ).rejects.toThrow('read-only');
  await expect(
    outsider.mutation(api.catalogCopies.customizeForCampaign, {
      ...scope,
      catalogEntryId: globalId,
      operationId: 'outsider-copy',
    }),
  ).rejects.toThrow();
  const copyId = await member.mutation(api.catalogCopies.customizeForCampaign, {
    ...scope,
    catalogEntryId: globalId,
    operationId: 'customize',
  });
  for (const [sheetScope, entryId] of [
    [scope, firstEntry],
    [secondScope, secondEntry],
  ] as const) {
    const sheet = withSheetCatalog(
      await owner.query(api.characterSheet.read, sheetScope),
    );
    expect(sheet?.entries.find((row) => row._id === entryId)).toMatchObject({
      catalogEntryId: copyId,
    });
    expect(
      sheet?.catalogEntries.find((row) => row._id === copyId),
    ).toMatchObject({
      ruleIdentity: 'power',
      sourceKey: 'power',
      copiedFrom: globalId,
      scope: 'campaign',
    });
  }
  const picker = await member.query(api.catalogCopies.list, scope);
  expect(picker.some((row) => row._id === globalId)).toBe(false);
  expect(picker.some((row) => row._id === copyId)).toBe(true);
  await member.mutation(api.catalogCopies.editDefinition, {
    ...scope,
    catalogEntryId: copyId,
    name: 'Campaign Power',
    modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 4 }],
    operationId: 'edit-copy',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, secondScope))
      ?.calculated.abilities.strength.score,
  ).toBe(14);
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', globalId, {
      name: 'Global Power revised',
      modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 8 }],
    }),
  );
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated.abilities.strength.score,
  ).toBe(14);
  expect(await owner.query(api.catalogCopies.advisories, scope)).toEqual([
    {
      catalogEntryId: copyId,
      originalId: globalId,
      originalName: 'Global Power revised',
    },
  ]);
});

test('Detach keeps durable identity and edits usable after the original becomes inaccessible', async () => {
  const { t, owner, scope } = await fixture();
  const globalId = await globalFeat(t);
  const sharedId = await owner.mutation(
    api.catalogCopies.customizeForCampaign,
    { ...scope, catalogEntryId: globalId, operationId: 'customize' },
  );
  const entryId = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: sharedId,
    operationId: 'select',
  });
  const copyId = await owner.mutation(api.catalogCopies.detach, {
    ...scope,
    target: { kind: 'entry', entryId },
    operationId: 'detach',
  });
  await owner.mutation(api.catalogCopies.editDefinition, {
    ...scope,
    catalogEntryId: copyId,
    name: 'My Power',
    operationId: 'edit',
  });
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', sharedId, { name: 'Shared Power revised' }),
  );
  expect(await owner.query(api.catalogCopies.advisories, scope)).toEqual([
    {
      catalogEntryId: copyId,
      originalId: sharedId,
      originalName: 'Shared Power revised',
    },
  ]);
  await t.run((ctx) =>
    ctx.db.patch('character', scope.characterId, {
      campaignId: undefined,
      sheetDemo: true,
    }),
  );
  const privateScope = { characterId: scope.characterId };
  const privateSheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, privateScope),
  );
  expect(
    privateSheet?.catalogEntries.find((row) => row._id === copyId),
  ).toMatchObject({
    scope: 'character',
    copiedFrom: sharedId,
    ruleIdentity: 'power',
    sourceKey: 'power',
    name: 'My Power',
  });
  const userId = await t.run(async (ctx) => {
    const user = await ctx.db
      .query('user')
      .filter((q) => q.eq(q.field('tokenIdentifier'), 'test|owner'))
      .unique();
    if (!user) throw new Error('Missing owner');
    await ctx.db.patch('user', user._id, { orgIds: [] });
    return user._id;
  });
  expect(await owner.query(api.catalogCopies.advisories, privateScope)).toEqual(
    [],
  );
  await owner.mutation(api.catalogCopies.editDefinition, {
    ...privateScope,
    catalogEntryId: copyId,
    name: 'Still mine',
    operationId: 'private-edit',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, privateScope))
      ?.calculated.abilities.strength.score,
  ).toBe(12);
  await t.run((ctx) =>
    ctx.db.patch('user', userId, {
      orgIds: [{ orgId: 'org', role: 'member' }],
    }),
  );
  expect(await owner.query(api.catalogCopies.advisories, privateScope)).toEqual(
    [
      {
        catalogEntryId: copyId,
        originalId: sharedId,
        originalName: 'Shared Power revised',
      },
    ],
  );
  await t.run((ctx) => ctx.db.delete('catalogEntry', sharedId));
  expect(await owner.query(api.catalogCopies.advisories, privateScope)).toEqual(
    [],
  );
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, privateScope),
    )?.catalogEntries.find((row) => row._id === copyId)?.name,
  ).toBe('Still mine');
});

test('customizing global Grant definitions preserves recorded state and future Grants; copies freeze raw global references', async () => {
  const { t, owner, member, scope } = await fixture();
  const featureId = await globalFeat(t);
  const raceId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Global race',
      ruleIdentity: 'global-race',
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: { kind: 'race', racialTraits: [featureId] },
    }),
  );
  await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: raceId,
    operationId: 'race',
  });
  const grantKey = { source: 'global-race', entry: 'power' };
  await member.mutation(api.characterSheet.editGrantState, {
    ...scope,
    grantKey,
    state: { notes: 'Keep this choice', choice: 'axe' },
    operationId: 'record',
  });
  const copyId = await member.mutation(api.catalogCopies.customizeForCampaign, {
    ...scope,
    catalogEntryId: featureId,
    operationId: 'customize-feature',
  });
  await member.mutation(api.catalogCopies.editDefinition, {
    ...scope,
    catalogEntryId: copyId,
    modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 4 }],
    operationId: 'stronger',
  });
  const customized = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(customized?.calculated.abilities.strength.score).toBe(14);
  expect(
    customized?.entries.find((row) => 'grantKey' in row && row.grantKey),
  ).toMatchObject({
    grantKey,
    catalogEntryId: copyId,
    notes: 'Keep this choice',
    state: { choice: 'axe' },
  });
  const secondId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId: scope.campaignId,
    name: 'Future',
    kind: 'pc',
    operationId: 'future',
  });
  const secondScope = { ...scope, characterId: secondId };
  await member.mutation(api.characterSheet.selectEntry, {
    ...secondScope,
    catalogEntryId: raceId,
    operationId: 'future-race',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, secondScope))
      ?.calculated.abilities.strength.score,
  ).toBe(14);
  const parentCopyId = await owner.mutation(
    api.catalogCopies.customizeForCampaign,
    { ...scope, catalogEntryId: raceId, operationId: 'customize-race' },
  );
  expect(await owner.query(api.catalogCopies.advisories, scope)).toEqual([]);
  const parentCopy = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  )?.catalogEntries.find((row) => row._id === parentCopyId);
  expect(parentCopy?.detail).toEqual({
    kind: 'race',
    racialTraits: [featureId],
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated.abilities.strength.score,
  ).toBe(14);
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', featureId, {
      modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 6 }],
    }),
  );
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated.abilities.strength.score,
  ).toBe(14);
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )?.entries.find((row) => 'grantKey' in row && row.grantKey),
  ).toMatchObject({
    grantKey,
    notes: 'Keep this choice',
    state: { choice: 'axe' },
  });
  expect(
    await owner.mutation(api.catalogCopies.customizeForCampaign, {
      ...scope,
      catalogEntryId: featureId,
      operationId: 'customize-again',
    }),
  ).toBe(copyId);
});

test('Detach records the effective Grant definition and preserves its choice, notes and dormancy', async () => {
  const { t, owner, scope } = await fixture();
  const originalId = await globalFeat(t);
  const changedId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Advanced Power',
      ruleIdentity: 'power',
      sources: [],
      stacksWithItself: false,
      modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 4 }],
      detail: { kind: 'feat' },
    }),
  );
  const raceId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Race',
      ruleIdentity: 'race',
      sources: [],
      stacksWithItself: false,
      modifiers: [],
      detail: { kind: 'race', racialTraits: [originalId] },
    }),
  );
  const raceEntryId = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: raceId,
    operationId: 'race',
  });
  const grantKey = { source: 'race', entry: 'power' };
  await owner.mutation(api.characterSheet.editGrantState, {
    ...scope,
    grantKey,
    state: { choice: 'bow', notes: 'Do not lose this' },
    operationId: 'state',
  });
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', raceId, {
      detail: { kind: 'race', racialTraits: [changedId] },
    }),
  );
  const copyId = await owner.mutation(api.catalogCopies.detach, {
    ...scope,
    target: { kind: 'grant', grantKey },
    operationId: 'detach',
  });
  const detached = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    detached?.catalogEntries.find((row) => row._id === copyId),
  ).toMatchObject({
    name: 'Advanced Power',
    copiedFrom: changedId,
    sourceKey: 'power',
    ruleIdentity: 'power',
  });
  expect(
    detached?.entries.find((row) => 'grantKey' in row && row.grantKey),
  ).toMatchObject({
    grantKey,
    catalogEntryId: copyId,
    catalogOverride: true,
    state: { choice: 'bow' },
    notes: 'Do not lose this',
  });
  await owner.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: raceEntryId,
    active: false,
    operationId: 'off',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated.abilities.strength.score,
  ).toBe(10);
  await owner.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: raceEntryId,
    active: true,
    operationId: 'on',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated.abilities.strength.score,
  ).toBe(14);
});

test('all Catalog Copy writers and queries enforce access, maintenance, epochs and legacy authority', async () => {
  const { t, owner, outsider, scope } = await fixture();
  const globalId = await globalFeat(t);
  const entryId = await owner.mutation(api.catalogCopies.createOneOff, {
    ...scope,
    definition: { ...definition, modifiers: [], sources: [] },
    operationId: 'create',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const entry = before?.entries.find((row) => row._id === entryId);
  if (!entry || !('catalogEntryId' in entry))
    throw new Error('Missing Selection');
  const catalogEntryId = entry.catalogEntryId;
  function writes(caller: typeof owner) {
    return [
      () =>
        caller.mutation(api.catalogCopies.createOneOff, {
          ...scope,
          definition: { ...definition, modifiers: [], sources: [] },
          operationId: 'one-off',
        }),
      () =>
        caller.mutation(api.catalogCopies.editDefinition, {
          ...scope,
          catalogEntryId,
          name: 'Edited',
          operationId: 'edit',
        }),
      () =>
        caller.mutation(api.catalogCopies.saveToCatalog, {
          ...scope,
          catalogEntryId,
          operationId: 'save',
        }),
      () =>
        caller.mutation(api.catalogCopies.customizeForCampaign, {
          ...scope,
          catalogEntryId: globalId,
          operationId: 'customize',
        }),
      () =>
        caller.mutation(api.catalogCopies.detach, {
          ...scope,
          target: { kind: 'entry', entryId },
          operationId: 'detach',
        }),
    ];
  }
  for (const write of writes(outsider)) await expect(write()).rejects.toThrow();
  await expect(outsider.query(api.catalogCopies.list, scope)).rejects.toThrow();
  await expect(
    outsider.query(api.catalogCopies.advisories, scope),
  ).rejects.toThrow();
  const runId = await t.run((ctx) =>
    ctx.db.insert('initialMigrationRun', {
      operationId: 'gate',
      epoch: 0,
      state: 'maintenance',
      frontendBuild: 'test',
      catalogManifest: 'test',
      startedAt: 0,
      deadline: 1,
    }),
  );
  for (const policy of [
    { epoch: 0, authority: 'legacy', closed: true },
    { epoch: 1, authority: 'legacy', closed: false },
    { epoch: 0, authority: 'sheet', closed: false },
  ] as const) {
    const controlId = await t.run((ctx) =>
      ctx.db.insert('initialMigrationControl', {
        key: 'character-sheet',
        runId,
        ...policy,
      }),
    );
    for (const write of writes(owner)) await expect(write()).rejects.toThrow();
    await t.run((ctx) => ctx.db.delete('initialMigrationControl', controlId));
  }
  const after = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(after?.entries).toEqual(before?.entries);
  expect(after?.catalogEntries).toEqual(before?.catalogEntries);
  expect(after?.revision).toBe(before?.revision);
});

test('class customization preserves Class Level rows, favored-class links and Accepted Warnings, while a real definition edit prunes changed facts', async () => {
  const { t, owner, scope } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const fighter = initial?.catalogEntries.find(
    (row) => row.ruleIdentity === 'fighter',
  );
  const first = initial?.entries.find((row) => row.kind === 'classLevel');
  if (
    fighter?.detail.kind !== 'class' ||
    !('featuresByLevel' in fighter.detail) ||
    !first
  )
    throw new Error('Missing class fixture');
  const featureIds = fighter.detail.featuresByLevel.map(
    (row) => row.catalogEntryId,
  );
  const globalClassId = await t.run(async (ctx) => {
    for (const id of new Set(featureIds))
      await ctx.db.patch('catalogEntry', id, {
        scope: 'global',
        characterId: undefined,
      });
    const { _id, _creationTime, characterId: _characterId, ...body } = fighter;
    return ctx.db.insert('catalogEntry', { ...body, scope: 'global' });
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    classEntryId: globalClassId,
    hpGained: 12,
    skillRanks: { 'skill.clm': 1 },
    favoredClassBonus: { choice: 'hp' },
    operationId: 'first',
  });
  const secondId = await owner.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: globalClassId,
    operationId: 'second',
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: secondId,
    hpGained: 8,
    skillRanks: { 'skill.per': 1 },
    operationId: 'second-state',
  });
  await owner.mutation(api.characterSheet.editCreationSettings, {
    ...scope,
    settings: {},
    favoredClassIds: [globalClassId],
    operationId: 'favored',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const warning = before?.calculated.warnings.find(
    (row) => row.kind === 'rules' && row.check === 'hpGainedAboveMaximum',
  );
  if (warning?.kind !== 'rules') throw new Error('Missing HP warning');
  await owner.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
    operationId: 'accept',
  });
  const copyId = await owner.mutation(api.catalogCopies.customizeForCampaign, {
    ...scope,
    catalogEntryId: globalClassId,
    operationId: 'customize',
  });
  const copied = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(copied?.entries.find((row) => row._id === first._id)).toMatchObject({
    state: {
      classEntryId: copyId,
      hpGained: 12,
      skillRanks: { 'skill.clm': 1 },
      favoredClassBonus: { choice: 'hp' },
    },
  });
  expect(copied?.entries.find((row) => row._id === secondId)).toMatchObject({
    state: {
      classEntryId: copyId,
      hpGained: 8,
      skillRanks: { 'skill.per': 1 },
    },
  });
  expect(copied?.entries.find((row) => row.kind === 'base')).toMatchObject({
    state: { favoredClassIds: [copyId] },
  });
  expect(copied?.acceptedWarnings).toHaveLength(1);
  if (!('hitDie' in fighter.detail))
    throw new Error('Missing class progression');
  await owner.mutation(api.catalogCopies.editDefinition, {
    ...scope,
    catalogEntryId: copyId,
    detail: { ...fighter.detail, hitDie: 12 },
    operationId: 'edit-hit-die',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.acceptedWarnings,
  ).toEqual([]);
  const detachedId = await owner.mutation(api.catalogCopies.detach, {
    ...scope,
    target: { kind: 'entry', entryId: first._id },
    operationId: 'detach-class',
  });
  const detached = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(detached?.entries.find((row) => row._id === first._id)).toMatchObject({
    state: {
      classEntryId: detachedId,
      hpGained: 12,
      skillRanks: { 'skill.clm': 1 },
      favoredClassBonus: { choice: 'hp' },
    },
  });
  expect(detached?.entries.find((row) => row._id === secondId)).toMatchObject({
    state: {
      classEntryId: detachedId,
      hpGained: 8,
      skillRanks: { 'skill.per': 1 },
    },
  });
  expect(detached?.entries.find((row) => row.kind === 'base')).toMatchObject({
    state: { favoredClassIds: [detachedId] },
  });
  expect(
    detached?.catalogEntries.find((row) => row._id === detachedId),
  ).toMatchObject({
    scope: 'character',
    ruleIdentity: 'fighter',
    detail: { hitDie: 12 },
  });
});

test('shared entries allow sheet-state edits and removal without changing global definitions; transitive copies retain Source stacking', async () => {
  const { t, owner, scope } = await fixture();
  const spellEffectId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Strength spell',
      ruleIdentity: 'strength-spell',
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: {
        kind: 'spellEffect',
        defaultCasterLevel: 3,
        lastsOverOneDay: false,
      },
    }),
  );
  const effectEntryId = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: spellEffectId,
    operationId: 'effect',
  });
  await owner.mutation(api.characterSheet.editSheetEntry, {
    ...scope,
    entryId: effectEntryId,
    active: false,
    casterLevel: 4,
    operationId: 'state-only',
  });
  const stateOnly = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    stateOnly?.entries.find((row) => row._id === effectEntryId),
  ).toMatchObject({ active: false, state: { casterLevel: 4 } });
  expect(
    stateOnly?.catalogEntries.find((row) => row._id === spellEffectId),
  ).toMatchObject({
    name: 'Strength spell',
    detail: { defaultCasterLevel: 3 },
  });
  await expect(
    owner.mutation(api.characterSheet.editSheetEntry, {
      ...scope,
      entryId: effectEntryId,
      name: 'Forged global edit',
      operationId: 'forged',
    }),
  ).rejects.toThrow('read-only');
  await owner.mutation(api.characterSheet.removeSheetEntry, {
    ...scope,
    entryId: effectEntryId,
    operationId: 'remove',
  });
  expect(
    (await owner.query(api.catalogCopies.list, scope)).some(
      (row) => row._id === spellEffectId,
    ),
  ).toBe(true);
  const manualId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Adjustment',
      ruleIdentity: 'adjustment',
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: { kind: 'manual' },
    }),
  );
  const manualEntryId = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: manualId,
    operationId: 'manual',
  });
  await owner.mutation(api.characterSheet.editPersonalAdjustment, {
    ...scope,
    entryId: manualEntryId,
    active: false,
    operationId: 'manual-off',
  });
  await expect(
    owner.mutation(api.characterSheet.editPersonalAdjustment, {
      ...scope,
      entryId: manualEntryId,
      name: 'Changed',
      operationId: 'manual-edit',
    }),
  ).rejects.toThrow('read-only');
  await owner.mutation(api.characterSheet.removePersonalAdjustment, {
    ...scope,
    entryId: manualEntryId,
    operationId: 'remove-manual',
  });
  expect(
    (await owner.query(api.catalogCopies.list, scope)).some(
      (row) => row._id === manualId,
    ),
  ).toBe(true);
  const globalId = await globalFeat(t);
  const campaignCopyId = await owner.mutation(
    api.catalogCopies.customizeForCampaign,
    { ...scope, catalogEntryId: globalId, operationId: 'customize' },
  );
  const copyEntryId = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: campaignCopyId,
    operationId: 'copy-selection',
  });
  const characterCopyId = await owner.mutation(api.catalogCopies.detach, {
    ...scope,
    target: { kind: 'entry', entryId: copyEntryId },
    operationId: 'detach',
  });
  await owner.mutation(api.catalogCopies.editDefinition, {
    ...scope,
    catalogEntryId: characterCopyId,
    modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 4 }],
    operationId: 'stronger',
  });
  await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: globalId,
    operationId: 'duplicate-source',
  });
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    sheet?.catalogEntries.find((row) => row._id === characterCopyId),
  ).toMatchObject({
    copiedFrom: campaignCopyId,
    ruleIdentity: 'power',
    sourceKey: 'power',
  });
  expect(sheet?.calculated.abilities.strength.score).toBe(14);
});

test('a detached parent freezes its fields while an uncustomized global dependency remains live', async () => {
  const { t, owner, scope } = await fixture();
  const featureId = await globalFeat(t);
  const raceId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Race',
      ruleIdentity: 'race',
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: { kind: 'race', racialTraits: [featureId] },
    }),
  );
  const entryId = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: raceId,
    operationId: 'race',
  });
  const copyId = await owner.mutation(api.catalogCopies.detach, {
    ...scope,
    target: { kind: 'entry', entryId },
    operationId: 'detach-parent',
  });
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', raceId, {
      name: 'Revised race',
      detail: { kind: 'race', racialTraits: [] },
    }),
  );
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated.abilities.strength.score,
  ).toBe(12);
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', featureId, {
      modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 6 }],
    }),
  );
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(sheet?.calculated.abilities.strength.score).toBe(16);
  expect(sheet?.catalogEntries.find((row) => row._id === copyId)).toMatchObject(
    { name: 'Race', detail: { kind: 'race', racialTraits: [featureId] } },
  );
});

test('saving a detached copy shares homebrew without adopting Customize preference or changing other sheets', async () => {
  const { t, owner, scope } = await fixture();
  const featureId = await globalFeat(t);
  const entryId = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: featureId,
    operationId: 'select',
  });
  const copyId = await owner.mutation(api.catalogCopies.detach, {
    ...scope,
    target: { kind: 'entry', entryId },
    operationId: 'detach',
  });
  await owner.mutation(api.catalogCopies.editDefinition, {
    ...scope,
    catalogEntryId: copyId,
    modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 4 }],
    operationId: 'edit',
  });
  const raceId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Race',
      ruleIdentity: 'race',
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: { kind: 'race', racialTraits: [featureId] },
    }),
  );
  const otherId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId: scope.campaignId,
    name: 'Other',
    kind: 'pc',
    operationId: 'other',
  });
  const otherScope = { ...scope, characterId: otherId };
  await owner.mutation(api.characterSheet.selectEntry, {
    ...otherScope,
    catalogEntryId: raceId,
    operationId: 'race',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, otherScope),
  );
  await owner.mutation(api.catalogCopies.saveToCatalog, {
    ...scope,
    catalogEntryId: copyId,
    operationId: 'save',
  });
  const after = withSheetCatalog(
    await owner.query(api.characterSheet.read, otherScope),
  );
  expect(after?.calculated.abilities.strength.score).toBe(12);
  expect(after?.revision).toBe(before?.revision);
  const picker = await owner.query(api.catalogCopies.list, otherScope);
  expect(picker.some((row) => row._id === featureId)).toBe(true);
  expect(picker.some((row) => row._id === copyId)).toBe(true);
  const preferredId = await owner.mutation(
    api.catalogCopies.customizeForCampaign,
    { ...otherScope, catalogEntryId: featureId, operationId: 'customize' },
  );
  expect(preferredId).not.toBe(copyId);
});

test('definition writes reject structurally invalid numbers, choices and scoped dependencies atomically', async () => {
  const { t, owner, scope } = await fixture();
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const fighter = before?.catalogEntries.find(
    (row) => row.ruleIdentity === 'fighter',
  );
  if (fighter?.detail.kind !== 'class' || !('hitDie' in fighter.detail))
    throw new Error('Missing class progression');
  await expect(
    owner.mutation(api.catalogCopies.editDefinition, {
      ...scope,
      catalogEntryId: fighter._id,
      detail: { ...fighter.detail, hitDie: Infinity },
      operationId: 'invalid-class',
    }),
  ).rejects.toThrow('finite');
  await expect(
    owner.mutation(api.catalogCopies.createOneOff, {
      ...scope,
      definition: {
        ...definition,
        modifiers: [{ target: 'ac', bonusType: 'untyped', value: Infinity }],
        sources: [],
      },
      operationId: 'invalid-number',
    }),
  ).rejects.toThrow('finite');
  await expect(
    owner.mutation(api.catalogCopies.createOneOff, {
      ...scope,
      definition: {
        ...definition,
        modifiers: [],
        sources: [],
        detail: {
          kind: 'item',
          consumable: false,
          armor: { slot: 'armor', armorCheckPenalty: -1 },
        },
      },
      operationId: 'invalid-armor',
    }),
  ).rejects.toThrow('nonnegative');
  await expect(
    owner.mutation(api.catalogCopies.createOneOff, {
      ...scope,
      definition: {
        ...definition,
        modifiers: [],
        sources: [],
        detail: { kind: 'condition' },
      },
      choice: 'invalid',
      operationId: 'invalid-choice',
    }),
  ).rejects.toThrow('recorded choice');
  const otherId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId: scope.campaignId,
    name: 'Other',
    kind: 'pc',
    operationId: 'other',
  });
  const foreignId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: otherId,
      name: 'Foreign dependency',
      ruleIdentity: 'foreign',
      modifiers: [],
      sources: [],
      stacksWithItself: false,
      detail: { kind: 'feat' },
    }),
  );
  await expect(
    owner.mutation(api.catalogCopies.createOneOff, {
      ...scope,
      definition: {
        ...definition,
        modifiers: [],
        sources: [],
        grants: [{ catalogEntryId: foreignId }],
      },
      operationId: 'foreign',
    }),
  ).rejects.toThrow('does not belong');
  const after = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(after?.entries).toEqual(before?.entries);
  expect(after?.catalogEntries).toEqual(before?.catalogEntries);
});

test('a Character Sheet loads with a large unrelated global and campaign catalog', async () => {
  const { t, owner, scope } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  await t.run(async (ctx) => {
    for (let index = 0; index < 4200; index++)
      await ctx.db.insert('catalogEntry', {
        ...definition,
        modifiers: [],
        sources: [],
        ruleIdentity: `unrelated:${index}`,
        ...(index % 2
          ? { scope: 'global' as const }
          : {
              scope: 'campaign' as const,
              campaignId: scope.campaignId,
            }),
      });
  });
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(sheet?.calculated.abilities.strength.score).toBe(10);
  expect(sheet?.catalogEntries).toEqual(initial?.catalogEntries);
  expect(await owner.query(api.catalogCopies.list, scope)).toContainEqual(
    expect.objectContaining({ ruleIdentity: 'unrelated:1' }),
  );
});

test('Customize changes effective references without reporting an original change on detached campaign parents', async () => {
  const { t, owner, scope } = await fixture();
  const globalId = await globalFeat(t);
  const parentId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      ...definition,
      modifiers: [],
      sources: [],
      name: 'Campaign parent',
      ruleIdentity: 'campaign-parent',
      scope: 'campaign',
      campaignId: scope.campaignId,
      grants: [{ catalogEntryId: globalId }],
    }),
  );
  const entryId = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: parentId,
    operationId: 'select-parent',
  });
  await owner.mutation(api.catalogCopies.detach, {
    ...scope,
    target: { kind: 'entry', entryId },
    operationId: 'detach-parent',
  });
  await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: parentId,
    operationId: 'retain-original-parent',
  });
  await owner.mutation(api.catalogCopies.customizeForCampaign, {
    ...scope,
    catalogEntryId: globalId,
    operationId: 'customize-child',
  });
  expect(
    (await owner.query(api.catalogCopies.list, scope)).find(
      (row) => row._id === parentId,
    )?.grants,
  ).toEqual([{ catalogEntryId: globalId }]);
  expect(await owner.query(api.catalogCopies.advisories, scope)).toEqual([]);
  await owner.mutation(api.catalogCopies.editDefinition, {
    ...scope,
    catalogEntryId: parentId,
    name: 'Changed parent',
    operationId: 'real-edit',
  });
  expect(await owner.query(api.catalogCopies.advisories, scope)).toContainEqual(
    expect.objectContaining({
      originalId: parentId,
      originalName: 'Changed parent',
    }),
  );
});

test('one-off definitions cannot introduce curated same-entry stacking exceptions', async () => {
  const { owner, scope } = await fixture();
  const args = {
    ...scope,
    operationId: 'curated-exception',
    definition: {
      ...definition,
      sources: [],
      modifiers: [
        {
          target: 'ac' as const,
          bonusType: 'deflection' as const,
          value: 2,
          stacksWithinEntry: true as const,
        },
      ],
    },
  };
  await expect(
    owner.mutation(api.catalogCopies.createOneOff, args),
  ).rejects.toThrow();
});

test('Detach refuses Character-specific targets without changing their state', async () => {
  const { owner, scope } = await fixture();
  const entryId = await owner.mutation(api.catalogCopies.createOneOff, {
    ...scope,
    operationId: 'one-off',
    definition: { ...definition, modifiers: [], sources: [] },
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  await expect(
    owner.mutation(api.catalogCopies.detach, {
      ...scope,
      target: { kind: 'entry', entryId },
      operationId: 'detach-local',
    }),
  ).rejects.toThrow('Character-specific');
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.revision,
  ).toBe(before?.revision);
});

test('editing a customized definition retains curated stacking fields and rejects client exceptions', async () => {
  const { t, owner, scope } = await fixture();
  const globalId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      ...definition,
      modifiers: [
        { target: 'ac', bonusType: 'deflection', value: 2 },
        {
          target: 'ac',
          bonusType: 'deflection',
          value: 1,
          condition: { situation: 'mountains' },
          stacksWithinEntry: true,
        },
      ],
      sources: [],
      scope: 'global',
      ruleIdentity: 'curated',
    }),
  );
  const copyId = await owner.mutation(api.catalogCopies.customizeForCampaign, {
    ...scope,
    catalogEntryId: globalId,
    operationId: 'customize',
  });
  await owner.mutation(api.catalogCopies.editDefinition, {
    ...scope,
    catalogEntryId: copyId,
    operationId: 'edit',
    name: 'Our curated definition',
    modifiers: [
      {
        target: 'ac',
        bonusType: 'deflection',
        value: 3,
        condition: { situation: 'mountains' },
      },
      { target: 'ac', bonusType: 'deflection', value: 4 },
    ],
  });
  const edited = (await owner.query(api.catalogCopies.list, scope)).find(
    (row) => row._id === copyId,
  );
  expect(edited?.modifiers).toEqual([
    {
      target: 'ac',
      bonusType: 'deflection',
      value: 3,
      condition: { situation: 'mountains' },
      stacksWithinEntry: true,
    },
    { target: 'ac', bonusType: 'deflection', value: 4 },
  ]);
  await owner.mutation(api.catalogCopies.editDefinition, {
    ...scope,
    catalogEntryId: copyId,
    operationId: 'add-identical-modifier',
    modifiers: [
      {
        target: 'ac',
        bonusType: 'deflection',
        value: 3,
        condition: { situation: 'mountains' },
      },
      { target: 'ac', bonusType: 'deflection', value: 4 },
      {
        target: 'ac',
        bonusType: 'deflection',
        value: 3,
        condition: { situation: 'mountains' },
      },
    ],
  });
  const duplicated = (await owner.query(api.catalogCopies.list, scope)).find(
    (row) => row._id === copyId,
  );
  expect(
    duplicated?.modifiers.filter(
      (row) => 'stacksWithinEntry' in row && row.stacksWithinEntry,
    ),
  ).toHaveLength(1);
  expect(edited).toMatchObject({
    ruleIdentity: 'curated',
    copiedFrom: globalId,
    scope: 'campaign',
  });
  const invalidArgs = {
    ...scope,
    catalogEntryId: copyId,
    operationId: 'introduce-exception',
    modifiers: [
      {
        target: 'ac' as const,
        bonusType: 'deflection' as const,
        value: 9,
        stacksWithinEntry: true as const,
      },
    ],
  };
  await expect(
    owner.mutation(api.catalogCopies.editDefinition, invalidArgs),
  ).rejects.toThrow();
  await owner.mutation(api.catalogCopies.editDefinition, {
    ...scope,
    catalogEntryId: copyId,
    operationId: 'remove-exception',
    modifiers: [{ target: 'ac', bonusType: 'deflection', value: 5 }],
  });
  expect(
    (await owner.query(api.catalogCopies.list, scope)).find(
      (row) => row._id === copyId,
    )?.modifiers,
  ).toEqual([{ target: 'ac', bonusType: 'deflection', value: 5 }]);
});

test('reordering identical modifier identities preserves the curated exception on its original value', async () => {
  const { t, owner, scope } = await fixture();
  const globalId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      ...definition,
      modifiers: [
        {
          target: 'ability.str',
          bonusType: 'enhancement',
          value: 1,
          stacksWithinEntry: true,
        },
        { target: 'ability.str', bonusType: 'enhancement', value: 2 },
        { target: 'ability.str', bonusType: 'enhancement', value: 5 },
      ],
      sources: [],
      scope: 'global',
      ruleIdentity: 'curated-reorder',
    }),
  );
  const copyId = await owner.mutation(api.catalogCopies.customizeForCampaign, {
    ...scope,
    catalogEntryId: globalId,
    operationId: 'customize',
  });
  await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: copyId,
    operationId: 'select',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  await owner.mutation(api.catalogCopies.editDefinition, {
    ...scope,
    catalogEntryId: copyId,
    operationId: 'reorder',
    modifiers: [2, 1, 5].map((value) => ({
      target: 'ability.str' as const,
      bonusType: 'enhancement' as const,
      value,
    })),
  });
  const after = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(before?.calculated.abilities.strength.score).toBe(16);
  expect(after?.calculated.abilities.strength.score).toBe(16);
  expect(
    after?.catalogEntries.find((row) => row._id === copyId)?.modifiers,
  ).toEqual([
    { target: 'ability.str', bonusType: 'enhancement', value: 2 },
    {
      target: 'ability.str',
      bonusType: 'enhancement',
      value: 1,
      stacksWithinEntry: true,
    },
    { target: 'ability.str', bonusType: 'enhancement', value: 5 },
  ]);
});

test('editing a detached item through its row retains curated stacking fields and rejects client exceptions', async () => {
  const { t, owner, scope } = await fixture();
  const globalId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      ...definition,
      name: 'Elixir of the Peaks',
      modifiers: [
        { target: 'ac', bonusType: 'deflection', value: 2 },
        {
          target: 'ac',
          bonusType: 'deflection',
          value: 1,
          condition: { situation: 'mountains' },
          stacksWithinEntry: true,
        },
      ],
      sources: [],
      scope: 'global',
      ruleIdentity: 'elixir-of-the-peaks',
      detail: { kind: 'item', consumable: true },
    }),
  );
  const entryId = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: globalId,
    operationId: 'select',
  });
  const copyId = await owner.mutation(api.catalogCopies.detach, {
    ...scope,
    target: { kind: 'entry', entryId },
    operationId: 'detach',
  });
  await owner.mutation(api.characterSheet.editSheetEntry, {
    ...scope,
    entryId,
    operationId: 'rename',
    name: 'My Elixir of the Peaks',
    modifiers: [
      { target: 'ac', bonusType: 'deflection', value: 2 },
      {
        target: 'ac',
        bonusType: 'deflection',
        value: 1,
        condition: { situation: 'mountains' },
      },
    ],
  });
  const edited = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  )?.catalogEntries.find((row) => row._id === copyId);
  expect(edited).toMatchObject({
    name: 'My Elixir of the Peaks',
    scope: 'character',
    copiedFrom: globalId,
  });
  expect(edited?.modifiers).toEqual([
    { target: 'ac', bonusType: 'deflection', value: 2 },
    {
      target: 'ac',
      bonusType: 'deflection',
      value: 1,
      condition: { situation: 'mountains' },
      stacksWithinEntry: true,
    },
  ]);
  const invalidArgs = {
    ...scope,
    entryId,
    operationId: 'introduce-exception',
    modifiers: [
      {
        target: 'ac' as const,
        bonusType: 'deflection' as const,
        value: 2,
        stacksWithinEntry: true as const,
      },
    ],
  };
  await expect(
    owner.mutation(api.characterSheet.editSheetEntry, invalidArgs),
  ).rejects.toThrow();
});

test('stacking and Grant Keys remain usable after losing access to a copied campaign original', async () => {
  const { t, owner, scope } = await fixture();
  const childId = await globalFeat(t);
  const originalId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      ...definition,
      modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 3 }],
      sources: [],
      scope: 'campaign',
      campaignId: scope.campaignId,
      ruleIdentity: 'source-with-grant',
      sourceKey: 'parent-source',
      grants: [{ catalogEntryId: childId }],
    }),
  );
  const entryId = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: originalId,
    operationId: 'select-parent',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const grant = before?.calculated.resolvedEntries.find(
    (row) =>
      row.origin === 'grant' &&
      'catalogEntryId' in row.entry &&
      row.entry.catalogEntryId === childId,
  );
  if (!grant || !('grantKey' in grant.entry) || !grant.entry.grantKey)
    throw new Error('Missing Grant');
  const grantKey = grant.entry.grantKey;
  const copyId = await owner.mutation(api.catalogCopies.detach, {
    ...scope,
    target: { kind: 'entry', entryId },
    operationId: 'detach',
  });
  await t.run(async (ctx) => {
    await ctx.db.patch('character', scope.characterId, {
      campaignId: undefined,
      sheetDemo: true,
    });
    const user = await ctx.db
      .query('user')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', 'test|owner'),
      )
      .unique();
    if (!user) throw new Error('Missing owner');
    await ctx.db.patch('user', user._id, { orgIds: [] });
    await ctx.db.patch('catalogEntry', originalId, {
      name: 'Inaccessible changed original',
      ruleIdentity: 'changed-identity',
      sourceKey: 'changed-source',
      grants: [],
    });
  });
  const privateScope = { characterId: scope.characterId };
  await owner.mutation(api.characterSheet.selectEntry, {
    ...privateScope,
    catalogEntryId: copyId,
    operationId: 'duplicate-source',
  });
  const after = withSheetCatalog(
    await owner.query(api.characterSheet.read, privateScope),
  );
  expect(after?.calculated.abilities.strength.score).toBe(15);
  expect(
    after?.calculated.resolvedEntries.find(
      (row) =>
        row.origin === 'grant' && 'grantKey' in row.entry && row.entry.grantKey,
    )?.entry,
  ).toMatchObject({ grantKey });
  expect(await owner.query(api.catalogCopies.advisories, privateScope)).toEqual(
    [],
  );
  const retainedKeys =
    after?.calculated.resolvedEntries.flatMap((row) =>
      row.origin === 'grant' && 'grantKey' in row.entry && row.entry.grantKey
        ? [row.entry.grantKey]
        : [],
    ) ?? [];
  for (const retainedKey of retainedKeys)
    await owner.mutation(api.characterSheet.editGrantState, {
      ...privateScope,
      grantKey: retainedKey,
      state: { active: false, choice: 'Retained choice' },
      operationId: 'disable-grant',
    });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, privateScope))
      ?.calculated.abilities.strength.score,
  ).toBe(13);
  await owner.mutation(api.characterSheet.editGrantState, {
    ...privateScope,
    grantKey,
    state: { active: true },
    operationId: 'restore-grant',
  });
  const restored = withSheetCatalog(
    await owner.query(api.characterSheet.read, privateScope),
  );
  expect(restored?.calculated.abilities.strength.score).toBe(15);
  expect(
    restored?.calculated.resolvedEntries.find(
      (row) =>
        row.origin === 'grant' && 'grantKey' in row.entry && row.entry.grantKey,
    )?.entry,
  ).toMatchObject({ grantKey, state: { choice: 'Retained choice' } });
});

test('new conditional Spell Effects use campaign copies for the immediate militia projection', async () => {
  const { t, owner, scope } = await fixture();
  const seeded = await owner.run((ctx) =>
    seedAcceptedCampaign(ctx, scope.campaignId),
  );
  const conditionId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      ...definition,
      sources: [],
      modifiers: [],
      scope: 'global',
      ruleIdentity: 'condition',
      detail: { kind: 'feat' },
    }),
  );
  await owner.mutation(api.catalogCopies.customizeForCampaign, {
    ...scope,
    catalogEntryId: conditionId,
    operationId: 'customize-condition',
  });
  await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: conditionId,
    operationId: 'select-condition',
  });
  await owner.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Conditional effect',
    modifiers: [
      {
        target: 'ability.str',
        bonusType: 'untyped',
        value: 4,
        condition: { whileActive: conditionId },
      },
    ],
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: true,
      defaultCasterLevel: 1,
    },
    operationId: 'create-effect',
  });
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(sheet?.calculated.abilities.strength.score).toBe(14);
  const ledger = await owner.query(api.canonicalLedger.read, {
    campaignId: scope.campaignId,
    militiaId: seeded.key.militiaId,
  });
  expect(
    ledger.state.militiaSnapshot.characters.find(
      (row) => row.characterId === scope.characterId,
    )?.strength,
  ).toBe(14);
  const raw = (await owner.query(api.catalogCopies.list, scope)).find(
    (row) => row.name === 'Conditional effect',
  );
  expect(raw?.modifiers[0]).toMatchObject({
    condition: { whileActive: conditionId },
  });
});

test('definition edits refuse non-finite non-ability Modifiers without changing the definition', async () => {
  const { owner, scope } = await fixture();
  const entryId = await owner.mutation(api.catalogCopies.createOneOff, {
    ...scope,
    operationId: 'create',
    definition: {
      ...definition,
      sources: [],
      modifiers: [{ target: 'ac', bonusType: 'untyped', value: 2 }],
    },
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const entry = before?.entries.find((row) => row._id === entryId);
  if (!entry || !('catalogEntryId' in entry)) throw new Error('Missing entry');
  await expect(
    owner.mutation(api.catalogCopies.editDefinition, {
      ...scope,
      catalogEntryId: entry.catalogEntryId,
      operationId: 'invalid',
      name: 'Uncommitted edit',
      modifiers: [{ target: 'ac', bonusType: 'untyped', value: Infinity }],
    }),
  ).rejects.toThrow('finite');
  const after = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(after?.catalogEntries).toEqual(before?.catalogEntries);
  expect(after?.revision).toBe(before?.revision);
});

test('Save to catalog retains persisted references while campaign choices are projected on the sheet', async () => {
  const { t, owner, scope } = await fixture();
  const globalId = await globalFeat(t);
  const entryId = await owner.mutation(api.catalogCopies.createOneOff, {
    ...scope,
    operationId: 'oneoff',
    definition: {
      ...definition,
      sources: [],
      modifiers: [
        {
          target: 'ac',
          bonusType: 'untyped',
          value: 2,
          condition: { whileActive: globalId },
        },
      ],
    },
  });
  await owner.mutation(api.catalogCopies.customizeForCampaign, {
    ...scope,
    catalogEntryId: globalId,
    operationId: 'customize',
  });
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const entry = sheet?.entries.find((row) => row._id === entryId);
  if (!entry || !('catalogEntryId' in entry)) throw new Error('Missing entry');
  await owner.mutation(api.catalogCopies.saveToCatalog, {
    ...scope,
    catalogEntryId: entry.catalogEntryId,
    operationId: 'save',
  });
  const saved = (await owner.query(api.catalogCopies.list, scope)).find(
    (row) => row._id === entry.catalogEntryId,
  );
  expect(saved?.modifiers[0]).toMatchObject({
    condition: { whileActive: globalId },
  });
});
