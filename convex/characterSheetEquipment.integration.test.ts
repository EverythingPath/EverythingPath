// @vitest-environment edge-runtime
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

async function fixture() {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    for (const name of ['owner', 'member', 'outsider'])
      await ctx.db.insert('user', {
        tokenIdentifier: `test|${name}`,
        orgIds: [
          { orgId: name === 'outsider' ? 'other' : 'org', role: 'member' },
        ],
      });
  });
  const campaignId = await t.run((ctx) =>
    ctx.db.insert('campaign', {
      name: 'Skills fixture',
      description: '',
      organizationId: 'org',
      ownerId: 'test|owner',
      e2eFixture: {
        namespace: 'skills',
        version: 1,
        workerKey: '0',
        caseKey: 'skills',
        campaignKey: 'skills',
      },
    }),
  );
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
  const scope = { organizationId: 'org', characterId };
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const level = initial?.entries.find((entry) => entry.kind === 'classLevel');
  const fighter = initial?.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'fighter',
  );
  if (!level || !fighter) throw new Error('Missing fixture level/class');
  return { t, owner, member, outsider, campaignId, scope, level, fighter };
}

test('equipment and manual proficiency edits persist and derive shared defense penalties for every member', async () => {
  const { owner, member, scope, level, fighter } = await fixture();
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: fighter._id,
    operationId: 'fighter',
  });
  const item = await member.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    operationId: 'plate',
    name: 'Full plate',
    modifiers: [],
    detail: {
      kind: 'item',
      consumable: false,
      armor: {
        slot: 'armor',
        category: 'heavy',
        bonus: 9,
        maxDex: 1,
        armorCheckPenalty: 6,
        asf: 35,
      },
    },
  });
  await member.mutation(api.characterSheet.editEquipment, {
    ...scope,
    entryId: item,
    enhancement: 2,
    masterwork: false,
    operationId: 'enchant',
  });
  const worn = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(worn?.calculated.equipment).toMatchObject({
    armorCheckPenalty: -5,
    spellFailure: 35,
    nonproficiencyAttackPenalty: 0,
  });
  expect(worn?.calculated.breakdowns['ac.armor'].total).toBe(11);
  await member.mutation(api.characterSheet.setManualProficiency, {
    ...scope,
    proficiency: { category: 'heavy' },
    disposition: 'removed',
    operationId: 'remove-proficiency',
  });
  const removed = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(removed?.calculated.equipment.nonproficiencyAttackPenalty).toBe(-5);
  expect(removed?.calculated.breakdowns['skill.clm'].total).toBe(-5);
  await owner.mutation(api.characterSheet.editEquipment, {
    ...scope,
    entryId: item,
    active: false,
    operationId: 'unequip',
  });
  const unworn = withSheetCatalog(
    await member.query(api.characterSheet.read, scope),
  );
  expect(unworn?.calculated.equipment.items).toEqual([]);
  expect(unworn?.calculated.breakdowns['ac.armor'].total).toBe(0);
});

test('enchantment warnings stay advisory and are pruned after an equipment correction', async () => {
  const { owner, scope } = await fixture();
  const item = await owner.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    operationId: 'item',
    name: 'Leather',
    modifiers: [],
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
  await owner.mutation(api.characterSheet.editEquipment, {
    ...scope,
    entryId: item,
    enhancement: 6,
    operationId: 'homebrew',
  });
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const warning = sheet?.calculated.warnings.find(
    (row) => row.check === 'equipmentEnhancement',
  );
  if (!warning) throw new Error('Expected advisory enhancement warning');
  await owner.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
    operationId: 'accept',
  });
  await owner.mutation(api.characterSheet.editEquipment, {
    ...scope,
    entryId: item,
    enhancement: 2,
    operationId: 'correct',
  });
  const corrected = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    corrected?.acceptedWarnings.some(
      (row) => row.check === 'equipmentEnhancement',
    ),
  ).toBe(false);
  expect(
    corrected?.calculated.warnings.some(
      (row) => row.check === 'equipmentEnhancement',
    ),
  ).toBe(false);
});

test('editing materialized granted armor by either identity preserves its Grant and dormant state', async () => {
  const { t, owner, scope } = await fixture();
  const catalogEntryId = await t.run(async (ctx) => {
    const armor = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: scope.characterId,
      name: 'Granted armor',
      ruleIdentity: 'armor',
      sources: [],
      stacksWithItself: false,
      modifiers: [],
      detail: {
        kind: 'item',
        consumable: false,
        armor: {
          slot: 'armor',
          category: 'light',
          bonus: 2,
          maxDex: 6,
          armorCheckPenalty: 0,
          asf: 10,
        },
      },
    });
    return ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: scope.characterId,
      name: 'Armor source',
      ruleIdentity: 'source',
      sources: [],
      stacksWithItself: false,
      modifiers: [],
      detail: { kind: 'feat' },
      grants: [{ catalogEntryId: armor }],
    });
  });
  const source = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId,
    operationId: 'source',
  });
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const grant = initial?.calculated.resolvedEntries.find(
    (row) => row.entry.kind === 'item',
  );
  if (!grant || !('grantKey' in grant.entry) || !grant.entry.grantKey)
    throw new Error('Missing armor Grant');
  await owner.mutation(api.characterSheet.editEquipment, {
    ...scope,
    grantKey: grant.entry.grantKey,
    enhancement: 1,
    operationId: 'grant-state',
  });
  const materialized = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const stored = materialized?.entries.find((row) => row.kind === 'item');
  if (!stored) throw new Error('Missing stored Grant');
  await owner.mutation(api.characterSheet.editEquipment, {
    ...scope,
    entryId: stored._id,
    enhancement: 2,
    operationId: 'stored-state',
  });
  await owner.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: source,
    active: false,
    operationId: 'dormant',
  });
  const dormant = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    dormant?.calculated.resolvedEntries.find(
      (row) => row.storedEntryId === stored._id,
    ),
  ).toMatchObject({
    origin: 'grant',
    dormant: true,
    counting: false,
    entry: { grantKey: grant.entry.grantKey, state: { enhancement: 2 } },
  });
  await owner.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: source,
    active: true,
    operationId: 'restore',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated.equipment.items[0],
  ).toMatchObject({ enhancement: 2 });
});

test('proficiency choices can be changed and cleared and unrelated manual edits survive', async () => {
  const { t, owner, member, scope } = await fixture();
  const catalogEntryId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: scope.characterId,
      name: 'Martial Weapon Proficiency',
      ruleIdentity: 'martial-proficiency',
      sources: [],
      stacksWithItself: false,
      modifiers: [],
      detail: { kind: 'feat' },
      proficiencies: [{ choice: true }],
    }),
  );
  const entryId = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId,
    operationId: 'feat',
  });
  await owner.mutation(api.characterSheet.setProficiencyChoice, {
    ...scope,
    entryId,
    choice: 'Longsword',
    operationId: 'choose',
  });
  await member.mutation(api.characterSheet.setManualProficiency, {
    ...scope,
    proficiency: { group: 'Heavy blades' },
    disposition: 'added',
    operationId: 'group',
  });
  await owner.mutation(api.characterSheet.setManualProficiency, {
    ...scope,
    proficiency: { category: 'light' },
    disposition: 'added',
    operationId: 'armor',
  });
  const chosen = withSheetCatalog(
    await member.query(api.characterSheet.read, scope),
  );
  expect(chosen?.calculated.proficiencies.grants).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ proficiency: { baseType: 'Longsword' } }),
    ]),
  );
  expect(chosen?.calculated.proficiencies.added).toHaveLength(2);
  await member.mutation(api.characterSheet.setProficiencyChoice, {
    ...scope,
    entryId,
    choice: null,
    operationId: 'clear',
  });
  const cleared = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(cleared?.calculated.proficiencies.grants).toEqual([]);
  expect(cleared?.calculated.proficiencies.missingChoices).toEqual([
    { entryId, name: 'Martial Weapon Proficiency', kind: 'entry' },
  ]);
  expect(cleared?.calculated.proficiencies.added).toHaveLength(2);
});

test('all equipment writers reject unauthorized callers, foreign rows, maintenance, stale epochs and sheet authority', async () => {
  const { t, owner, outsider, scope, campaignId } = await fixture();
  const item = await owner.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Leather',
    modifiers: [],
    detail: { kind: 'item', consumable: false },
    operationId: 'item',
  });
  const commands = (caller: typeof owner, writeEpoch?: number) => [
    () =>
      caller.mutation(api.characterSheet.editEquipment, {
        ...scope,
        entryId: item,
        enhancement: 1,
        writeEpoch,
        operationId: 'equipment',
      }),
    () =>
      caller.mutation(api.characterSheet.setManualProficiency, {
        ...scope,
        proficiency: { category: 'light' },
        disposition: 'added',
        writeEpoch,
        operationId: 'manual',
      }),
    () =>
      caller.mutation(api.characterSheet.setProficiencyChoice, {
        ...scope,
        entryId: item,
        choice: 'longsword',
        writeEpoch,
        operationId: 'choice',
      }),
  ];
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  for (const caller of [t, outsider])
    for (const command of commands(caller))
      await expect(command()).rejects.toThrow();
  const other = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Other',
    kind: 'pc',
    operationId: 'other',
  });
  await expect(
    owner.mutation(api.characterSheet.editEquipment, {
      organizationId: 'org',
      characterId: other,
      entryId: item,
      active: false,
      operationId: 'foreign',
    }),
  ).rejects.toThrow('does not belong');
  await expect(
    owner.mutation(api.characterSheet.setProficiencyChoice, {
      organizationId: 'org',
      characterId: other,
      entryId: item,
      choice: 'longsword',
      operationId: 'foreign-choice',
    }),
  ).rejects.toThrow('does not belong');
  const control = await t.run(async (ctx) => {
    const runId = await ctx.db.insert('initialMigrationRun', {
      operationId: 'migration',
      epoch: 1,
      state: 'maintenance',
      frontendBuild: 'build',
      catalogManifest: 'catalog',
      startedAt: 0,
      deadline: 60000,
    });
    return ctx.db.insert('initialMigrationControl', {
      key: 'character-sheet',
      epoch: 1,
      closed: true,
      authority: 'legacy',
      runId,
    });
  });
  for (const command of commands(owner, 1))
    await expect(command()).rejects.toThrow('MAINTENANCE');
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', control, { closed: false }),
  );
  for (const command of commands(owner, 0))
    await expect(command()).rejects.toThrow('RELOAD_REQUIRED');
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', control, { authority: 'sheet' }),
  );
  for (const command of commands(owner, 1))
    await expect(command()).rejects.toThrow('RELOAD_REQUIRED');
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
  ).toEqual(before);
});

test('equipment edits reject owned items without weapon or armor detail and preserve their state', async () => {
  const { owner, member, scope } = await fixture();
  const item = await owner.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Rope',
    modifiers: [],
    detail: {
      kind: 'item',
      consumable: false,
    },
    operationId: 'weapon',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  await expect(
    member.mutation(api.characterSheet.editEquipment, {
      ...scope,
      entryId: item,
      enhancement: 2,
      active: false,
      operationId: 'invalid-equipment',
    }),
  ).rejects.toThrow('Choose a weapon, ammunition, armor or a shield');
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
  ).toEqual(before);
});

test('equipment and proficiency writers enforce data integrity without blocking rule departures', async () => {
  const { owner, scope } = await fixture();
  const item = await owner.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Plate',
    modifiers: [],
    detail: {
      kind: 'item',
      consumable: false,
      armor: { slot: 'armor', armorCheckPenalty: 6 },
    },
    operationId: 'item',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  for (const enhancement of [-1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1])
    await expect(
      owner.mutation(api.characterSheet.editEquipment, {
        ...scope,
        entryId: item,
        enhancement,
        operationId: 'invalid',
      }),
    ).rejects.toThrow();
  await expect(
    owner.mutation(api.characterSheet.setManualProficiency, {
      ...scope,
      proficiency: { baseType: '  ' },
      disposition: 'added',
      operationId: 'empty',
    }),
  ).rejects.toThrow('Enter a proficiency');
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
  ).toEqual(before);
});

test('new dated selections record their add order for same-level proficiency prerequisites', async () => {
  const { t, owner, scope, level } = await fixture();
  const [training, focus] = await t.run(async (ctx) => {
    const common = {
      scope: 'character' as const,
      characterId: scope.characterId,
      sources: [],
      stacksWithItself: false,
      modifiers: [],
      detail: { kind: 'feat' as const },
    };
    return [
      await ctx.db.insert('catalogEntry', {
        ...common,
        name: 'Training',
        ruleIdentity: 'training',
        proficiencies: [{ category: 'martial' }],
      }),
      await ctx.db.insert('catalogEntry', {
        ...common,
        name: 'Focus',
        ruleIdentity: 'focus',
        proficiencyPrerequisites: [
          { kind: 'proficiency', proficiency: { category: 'martial' } },
        ],
      }),
    ];
  });
  if (!training || !focus) throw new Error('Missing definitions');
  const first = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: training,
    gainedAtClassLevel: level._id,
    operationId: 'first',
  });
  const second = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: focus,
    gainedAtClassLevel: level._id,
    operationId: 'second',
  });
  const result = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(result?.entries.find((row) => row._id === first)).toMatchObject({
    choiceOrder: 0,
  });
  expect(result?.entries.find((row) => row._id === second)).toMatchObject({
    choiceOrder: 1,
  });
  expect(result?.calculated.proficiencyPrerequisites).toEqual(
    expect.arrayContaining([
      {
        entryId: second,
        view: 'recorded',
        proficiency: { category: 'martial' },
        met: true,
      },
    ]),
  );
});

test('unsafe recorded-order edits are refused before they can block a later selection', async () => {
  const { t, owner, scope, level } = await fixture();
  const definition = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: scope.characterId,
      name: 'Training',
      ruleIdentity: 'training',
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: { kind: 'feat' },
    }),
  );
  const first = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: definition,
    gainedAtClassLevel: level._id,
    operationId: 'first',
  });
  await expect(
    owner.mutation(api.characterSheet.editSelection, {
      ...scope,
      entryId: first,
      choiceOrder: 2 ** 54,
      operationId: 'unsafe',
    }),
  ).rejects.toThrow('safe whole number');
  const second = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: definition,
    gainedAtClassLevel: level._id,
    operationId: 'next',
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )?.entries.find((row) => row._id === second),
  ).toMatchObject({ choiceOrder: 1 });
});

test('the other end requires an actual double weapon and cannot be added to ordinary equipment', async () => {
  const { owner, member, scope } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const sword = initial?.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'longsword',
  );
  if (!sword) throw new Error('Missing longsword');
  const weapon = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: sword._id,
    operationId: 'ordinary-weapon',
  });
  const before = withSheetCatalog(
    await member.query(api.characterSheet.read, scope),
  );
  await expect(
    owner.mutation(api.characterSheet.editEquipment, {
      ...scope,
      entryId: weapon,
      end: 'otherEnd',
      enhancement: 1,
      operationId: 'nonexistent-other-end',
    }),
  ).rejects.toThrow('other end');
  expect(
    withSheetCatalog(await member.query(api.characterSheet.read, scope)),
  ).toEqual(before);
});

test('homebrew saved armor competes with bracers using its own enhancement for every member (#762)', async () => {
  const { owner, member, scope } = await fixture();
  // App-creatable reproductions: CRB p. 151 leather and p. 504 bracers +4.
  const leather = await owner.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    operationId: 'leather',
    name: 'Homebrew leather',
    modifiers: [],
    detail: {
      kind: 'item',
      consumable: false,
      armor: {
        slot: 'armor',
        category: 'light',
        bonus: 2,
        maxDex: 6,
        armorCheckPenalty: 0,
        asf: 10,
      },
    },
  });
  const bracers = await member.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    operationId: 'bracers',
    name: 'Homebrew bracers +4',
    modifiers: [{ target: 'ac.armor', bonusType: 'armor', value: 4 }],
    detail: { kind: 'item', consumable: false },
  });
  await member.mutation(api.characterSheet.editEquipment, {
    ...scope,
    entryId: leather,
    enhancement: 1,
    operationId: 'leather-one',
  });
  for (const reader of [owner, member]) {
    const saved = await reader.query(api.characterSheet.read, scope);
    expect(
      saved?.entries.find((row) => row._id === leather)?.state,
    ).toMatchObject({ enhancement: 1 });
    expect(saved?.calculated.breakdowns['ac.armor'].total).toBe(4);
    expect(saved?.calculated.derivedStatistics.ac.total).toBe(14);
  }
  await owner.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: bracers,
    active: false,
    operationId: 'bracers-off',
  });
  expect(
    (await member.query(api.characterSheet.read, scope))?.calculated.breakdowns[
      'ac.armor'
    ].total,
  ).toBe(3);
  await owner.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: bracers,
    active: true,
    operationId: 'bracers-on',
  });
  await member.mutation(api.characterSheet.editEquipment, {
    ...scope,
    entryId: leather,
    enhancement: 3,
    operationId: 'leather-three',
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.calculated.breakdowns[
      'ac.armor'
    ].total,
  ).toBe(5);
});
