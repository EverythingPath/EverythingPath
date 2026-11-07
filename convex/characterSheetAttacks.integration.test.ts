// @vitest-environment edge-runtime
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';
import { maxCharacterChildRows } from './lib/characterSheetData';

const modules = import.meta.glob('./**/*.ts');

test('adding a natural attack leaves existing routines unchanged', async () => {
  const { owner, member, scope } = await fixture();
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const bite = await owner.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Bite',
    modifiers: [],
    detail: {
      kind: 'item',
      consumable: false,
      weapon: {
        baseType: 'bite',
        proficiency: 'always',
        naturalAttack: { type: 'bite' },
      },
    },
    operationId: 'record-natural-attack',
  });
  const after = withSheetCatalog(
    await member.query(api.characterSheet.read, scope),
  );
  expect(after?.entries).toContainEqual(
    expect.objectContaining({ _id: bite, kind: 'item' }),
  );
  expect(after?.calculated.attackRoutines).toEqual(
    before?.calculated.attackRoutines,
  );
});

test('selecting a catalog natural attack leaves existing routines unchanged', async () => {
  const { t, owner, member, scope } = await fixture();
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const catalogEntryId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId: scope.campaignId,
      name: 'Racial bite',
      ruleIdentity: 'racial-bite',
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: {
        kind: 'item',
        consumable: false,
        weapon: {
          baseType: 'bite',
          proficiency: 'always',
          naturalAttack: { type: 'bite' },
        },
      },
    }),
  );
  const bite = await member.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId,
    operationId: 'select-natural-attack',
  });
  const after = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(after?.entries).toContainEqual(
    expect.objectContaining({ _id: bite, kind: 'item' }),
  );
  expect(after?.calculated.attackRoutines).toEqual(
    before?.calculated.attackRoutines,
  );
});

test('members save additional natural attacks and limb counts without overwriting other routine edits', async () => {
  const { owner, member, scope, weapon } = await fixture();
  const bite = await owner.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    operationId: 'bite',
    name: 'Bite',
    modifiers: [],
    detail: {
      kind: 'item',
      consumable: false,
      weapon: {
        baseType: 'bite',
        proficiency: 'always',
        naturalAttack: { type: 'bite' },
      },
    },
  });
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const routine = sheet?.entries.find(
    (entry) =>
      entry.kind === 'attackRoutine' && entry.state.weaponEntryId === weapon,
  );
  if (!routine) throw new Error('Missing weapon routine');
  await member.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: routine._id,
    naturalAttackEntryIds: [bite],
    availableLimbs: 4,
    operationId: 'mix-bite',
  });
  await owner.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: routine._id,
    name: 'Sword and bite',
    operationId: 'name-mixed-routine',
  });
  expect(
    withSheetCatalog(
      await member.query(api.characterSheet.read, scope),
    )?.entries.find((entry) => entry._id === routine._id),
  ).toMatchObject({
    state: {
      name: 'Sword and bite',
      naturalAttackEntryIds: [bite],
      availableLimbs: 4,
      revision: 2,
    },
  });
});

test('an unchanged natural selection remains advisory after its entry becomes an ordinary weapon', async () => {
  const { owner, member, scope, weapon } = await fixture();
  const bite = await owner.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Bite',
    modifiers: [],
    operationId: 'retained-bite',
    detail: {
      kind: 'item',
      consumable: false,
      weapon: {
        baseType: 'bite',
        proficiency: 'always',
        naturalAttack: { type: 'bite' },
      },
    },
  });
  const routine = await member.mutation(
    api.characterSheet.createAttackRoutine,
    {
      ...scope,
      weaponEntryId: weapon,
      naturalAttackEntryIds: [bite],
      operationId: 'retained-mix',
    },
  );
  await owner.mutation(api.characterSheet.editSheetEntry, {
    ...scope,
    entryId: bite,
    name: 'Former bite',
    modifiers: [],
    operationId: 'ordinary-profile',
    detail: {
      kind: 'item',
      consumable: false,
      weapon: {
        baseType: 'club',
        proficiency: 'simple',
        handedness: 'oneHanded',
        dice: '1d6',
        threat: 20,
        mult: 2,
      },
    },
  });
  await member.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: routine,
    naturalAttackEntryIds: [bite],
    name: 'Retained choice',
    operationId: 'resave-retained',
  });
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const row = sheet?.calculated.attackRoutines.find(
    (row) => row.entryId === routine,
  );
  expect(row).toMatchObject({ name: 'Retained choice' });
  expect(sheet?.entries.find((entry) => entry._id === routine)).toMatchObject({
    state: { naturalAttackEntryIds: [bite] },
  });
  expect(row?.warnings).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ check: 'invalidAttackWeapon' }),
    ]),
  );
  expect(row?.full.every((line) => line.attackKind !== 'natural')).toBe(true);
});

test('built-in unarmed strikes create shared routines without adding Gear and survive off-hand edits and undo', async () => {
  // CRB pp. 182–183: Medium unarmed strike is 1d3 nonlethal and is always
  // proficient; Str 18 adds +4 damage. No item selection is needed.
  const { owner, member, scope } = await fixture();
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 18 },
    operationId: 'unarmed-strength',
  });
  const entryId = await member.mutation(
    api.characterSheet.createAttackRoutine,
    {
      ...scope,
      weaponEntryId: 'unarmed',
      operationId: 'built-in-unarmed',
    },
  );
  const created = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    created?.entries.filter((entry) => entry.kind === 'item'),
  ).toHaveLength(
    before?.entries.filter((entry) => entry.kind === 'item').length ?? 0,
  );
  expect(
    created?.calculated.attackRoutines.find(
      (routine) => routine.entryId === entryId,
    ),
  ).toMatchObject({
    weaponEntryId: 'unarmed',
    single: [
      {
        attackKind: 'unarmed',
        damageDice: '1d3',
        damageKind: 'nonlethal',
        attackBonus: { total: 4 },
        damageBonus: { total: 4 },
      },
    ],
  });
  await owner.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId,
    offHand: { kind: 'weapon', weaponEntryId: 'unarmed', mode: 'melee' },
    operationId: 'unarmed-off-hand',
  });
  await member.mutation(api.characterSheet.deleteAttackRoutine, {
    ...scope,
    entryId,
    operationId: 'delete-unarmed',
  });
  await owner.mutation(api.characterSheet.restoreAttackRoutine, {
    ...scope,
    entryId,
    operationId: 'restore-unarmed',
  });
  expect(
    withSheetCatalog(
      await member.query(api.characterSheet.read, scope),
    )?.entries.find((entry) => entry._id === entryId),
  ).toMatchObject({
    state: {
      weaponEntryId: 'unarmed',
      offHand: { kind: 'weapon', weaponEntryId: 'unarmed', mode: 'melee' },
    },
  });
});

test('natural references reject foreign and non-natural entries and reads refuse retained foreign references', async () => {
  const { t, owner, member, scope, weapon } = await fixture();
  const otherCharacter = await member.mutation(api.characterSheet.create, {
    organizationId: scope.organizationId,
    campaignId: scope.campaignId,
    name: 'Another creature',
    kind: 'npc',
    operationId: 'other-natural-character',
  });
  const foreign = await member.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    characterId: otherCharacter,
    name: 'Claw',
    modifiers: [],
    detail: {
      kind: 'item',
      consumable: false,
      weapon: {
        baseType: 'claw',
        proficiency: 'always',
        naturalAttack: { type: 'claw' },
      },
    },
    operationId: 'foreign-claw',
  });
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const routine = initial?.entries.find((row) => row.kind === 'attackRoutine');
  if (routine?.kind !== 'attackRoutine') throw new Error('Missing routine');
  for (const naturalAttackEntryId of [foreign, weapon]) {
    await expect(
      member.mutation(api.characterSheet.createAttackRoutine, {
        ...scope,
        weaponEntryId: weapon,
        naturalAttackEntryIds: [naturalAttackEntryId],
        operationId: 'invalid-natural-create',
      }),
    ).rejects.toThrow();
    await expect(
      owner.mutation(api.characterSheet.editAttackRoutine, {
        ...scope,
        entryId: routine._id,
        naturalAttackEntryIds: [naturalAttackEntryId],
        operationId: 'invalid-natural-edit',
      }),
    ).rejects.toThrow();
  }
  for (const availableLimbs of [-1, 1.5, NaN, Infinity])
    await expect(
      member.mutation(api.characterSheet.editAttackRoutine, {
        ...scope,
        entryId: routine._id,
        availableLimbs,
        operationId: 'invalid-limbs',
      }),
    ).rejects.toThrow();
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )?.entries.find((row) => row._id === routine._id),
  ).toEqual(routine);
  await t.run((ctx) =>
    ctx.db.patch('characterSheetEntry', routine._id, {
      state: { ...routine.state, naturalAttackEntryIds: [foreign] },
    }),
  );
  await expect(member.query(api.characterSheet.read, scope)).rejects.toThrow(
    'Weapon does not belong to this Character',
  );
});

test('natural attack definitions accept the table’s flat damage while malformed damage stays blocked', async () => {
  // Bestiary Table 3–1: a Fine bite deals a flat 1 damage.
  const { owner, scope } = await fixture();
  const detail = {
    kind: 'item' as const,
    consumable: false,
    weapon: {
      baseType: 'bite',
      proficiency: 'always' as const,
      naturalAttack: { type: 'bite' as const },
      dice: '1',
    },
  };
  const bite = await owner.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Fine bite',
    modifiers: [],
    detail,
    operationId: 'fine-bite',
  });
  await owner.mutation(api.characterSheet.createAttackRoutine, {
    ...scope,
    weaponEntryId: bite,
    operationId: 'fine-bite-routine',
  });
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    sheet?.calculated.attackRoutines.find((row) => row.weaponEntryId === bite)
      ?.single,
  ).toMatchObject([{ damageDice: '1' }]);
  for (const dice of ['0', '-1', '1d0', 'bite'])
    await expect(
      owner.mutation(api.characterSheet.editSheetEntry, {
        ...scope,
        entryId: bite,
        detail: { ...detail, weapon: { ...detail.weapon, dice } },
        operationId: 'malformed-natural-damage',
      }),
    ).rejects.toThrow('Enter weapon damage');
});

test('a selected natural attack retains its source and missing-reference warning through shared edits and undo', async () => {
  // CRB p. 182 and Bestiary Table 3–1: sword+bite leaves the sword unchanged
  // and makes the bite secondary, at −5 and half Strength.
  const { t, owner, member, scope } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const longsword = initial?.catalogEntries.find(
    (row) => row.ruleIdentity === 'longsword',
  );
  if (!longsword) throw new Error('Missing representative longsword');
  const weapon = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: longsword._id,
    operationId: 'mixed-longsword',
  });
  const biteDefinition = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId: scope.campaignId,
      name: 'Racial bite',
      ruleIdentity: 'racial-bite',
      sources: [{ book: 'Pathfinder RPG Bestiary', pages: '302' }],
      modifiers: [],
      stacksWithItself: false,
      detail: {
        kind: 'item',
        consumable: false,
        weapon: {
          baseType: 'bite',
          proficiency: 'always',
          naturalAttack: { type: 'bite' },
        },
      },
    }),
  );
  const bite = await member.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: biteDefinition,
    operationId: 'select-racial-bite',
  });
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 18 },
    operationId: 'mixed-strength',
  });
  const entryId = await member.mutation(
    api.characterSheet.createAttackRoutine,
    {
      ...scope,
      weaponEntryId: weapon,
      naturalAttackEntryIds: [bite],
      operationId: 'mixed-racial-bite',
    },
  );
  const selected = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    selected?.catalogEntries.find((row) => row._id === biteDefinition)?.sources,
  ).toEqual([{ book: 'Pathfinder RPG Bestiary', pages: '302' }]);
  expect(
    selected?.calculated.attackRoutines.find((row) => row.entryId === entryId),
  ).toMatchObject({
    twoWeaponPenaltySummary: null,
    single: [
      {
        attackKind: 'manufactured',
        attackBonus: { total: 0 },
        damageBonus: { total: 4 },
      },
    ],
    full: [
      {
        attackKind: 'manufactured',
        attackBonus: { total: 0 },
        damageBonus: { total: 4 },
      },
      {
        weaponEntryId: bite,
        attackKind: 'natural',
        naturalRole: 'secondary',
        damageDice: '1d6',
        attackBonus: { total: -1 },
        damageBonus: { total: 2 },
      },
    ],
  });
  await member.mutation(api.characterSheet.removeSheetEntry, {
    ...scope,
    entryId: bite,
    operationId: 'remove-bite',
  });
  const missing = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const warning = missing?.calculated.attackRoutines
    .find((row) => row.entryId === entryId)
    ?.warnings.find((row) => row.check === 'missingAttackWeapon');
  if (!warning) throw new Error('Missing natural reference warning');
  await owner.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
    operationId: 'accept-missing-bite',
  });
  await member.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId,
    name: 'Keep the racial bite',
    naturalAttackEntryIds: [bite],
    operationId: 'retain-missing-bite',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.acceptedWarnings,
  ).toContainEqual(
    expect.objectContaining({
      subject: warning.subject,
      fingerprint: warning.fingerprint,
    }),
  );
  await member.mutation(api.characterSheet.deleteAttackRoutine, {
    ...scope,
    entryId,
    operationId: 'delete-missing-bite',
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )?.acceptedWarnings.some((row) => row.subject === warning.subject),
  ).toBe(false);
  await owner.mutation(api.characterSheet.restoreAttackRoutine, {
    ...scope,
    entryId,
    operationId: 'restore-missing-bite',
  });
  const restored = withSheetCatalog(
    await member.query(api.characterSheet.read, scope),
  );
  expect(restored?.entries.find((row) => row._id === entryId)).toMatchObject({
    state: { naturalAttackEntryIds: [bite] },
  });
  expect(
    restored?.calculated.attackRoutines.find((row) => row.entryId === entryId)
      ?.warnings,
  ).toContainEqual(
    expect.objectContaining({
      subject: warning.subject,
      fingerprint: warning.fingerprint,
    }),
  );
  await member.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId,
    naturalAttackEntryIds: [],
    operationId: 'clear-natural',
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )?.calculated.attackRoutines.find((row) => row.entryId === entryId)
      ?.warnings,
  ).toEqual([]);
});

test('ammunition references refuse foreign and non-item rows and retained reads enforce ownership', async () => {
  const { t, owner, member, scope, weapon } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const routine = initial?.entries.find((row) => row.kind === 'attackRoutine');
  const base = initial?.entries.find((row) => row.kind === 'base');
  if (routine?.kind !== 'attackRoutine' || !base)
    throw new Error('Missing fixture rows');
  const otherId = await owner.mutation(api.characterSheet.create, {
    organizationId: scope.organizationId,
    campaignId: scope.campaignId,
    name: 'Other archer',
    kind: 'pc',
    operationId: 'other-archer',
  });
  const foreignAmmo = await owner.mutation(
    api.characterSheet.createSheetEntry,
    {
      ...scope,
      characterId: otherId,
      name: 'Foreign arrows',
      modifiers: [],
      detail: { kind: 'item', consumable: true, ammunition: true },
      operationId: 'foreign-ammo',
    },
  );
  for (const ammunitionEntryId of [foreignAmmo, base._id, routine._id]) {
    await expect(
      member.mutation(api.characterSheet.createAttackRoutine, {
        ...scope,
        weaponEntryId: weapon,
        ammunitionEntryId,
        operationId: 'reject-ammo-create',
      }),
    ).rejects.toThrow('Ammunition does not belong');
    await expect(
      member.mutation(api.characterSheet.editAttackRoutine, {
        ...scope,
        entryId: routine._id,
        ammunitionEntryId,
        operationId: 'reject-ammo-edit',
      }),
    ).rejects.toThrow('Ammunition does not belong');
  }
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
  ).toEqual(initial);
  await t.run((ctx) =>
    ctx.db.patch('characterSheetEntry', routine._id, {
      state: { ...routine.state, ammunitionEntryId: foreignAmmo },
    }),
  );
  await expect(member.query(api.characterSheet.read, scope)).rejects.toThrow(
    'Weapon does not belong',
  );
});

test('range inputs block malformed numbers and counts beyond the routine maximum while later drift stays advisory', async () => {
  const { owner, scope, weapon } = await fixture();
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const routine = before?.entries.find((row) => row.kind === 'attackRoutine');
  if (!routine) throw new Error('Missing routine');
  for (const rangeIncrements of [
    0,
    -1,
    1.5,
    Infinity,
    NaN,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    await expect(
      owner.mutation(api.characterSheet.createAttackRoutine, {
        ...scope,
        weaponEntryId: weapon,
        rangeIncrements,
        operationId: 'invalid-range-create',
      }),
    ).rejects.toThrow('positive whole number');
    await expect(
      owner.mutation(api.characterSheet.editAttackRoutine, {
        ...scope,
        entryId: routine._id,
        rangeIncrements,
        operationId: 'invalid-range-edit',
      }),
    ).rejects.toThrow('positive whole number');
  }
  await expect(
    owner.mutation(api.characterSheet.createAttackRoutine, {
      ...scope,
      weaponEntryId: weapon,
      mode: 'ranged',
      rangeIncrements: 11,
      operationId: 'far-range-create',
    }),
  ).rejects.toThrow('Ranged attacks reach at most 10 range increments');
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
  ).toEqual(before);
  const daggerDefinition = before?.catalogEntries.find(
    (row) => row.ruleIdentity === 'dagger',
  );
  if (!daggerDefinition) throw new Error('Missing dagger');
  const dagger = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: daggerDefinition._id,
    operationId: 'range-dagger',
  });
  await expect(
    owner.mutation(api.characterSheet.editAttackRoutine, {
      ...scope,
      entryId: routine._id,
      weaponEntryId: dagger,
      mode: 'thrown',
      rangeIncrements: 6,
      operationId: 'far-thrown-edit',
    }),
  ).rejects.toThrow('Thrown attacks reach at most 5 range increments');
  await expect(
    owner.mutation(api.characterSheet.editAttackRoutine, {
      ...scope,
      entryId: routine._id,
      mode: 'ranged',
      offHand: { kind: 'weapon', weaponEntryId: dagger, mode: 'thrown' },
      rangeIncrements: 6,
      operationId: 'far-off-hand-edit',
    }),
  ).rejects.toThrow('Thrown attacks reach at most 5 range increments');
  await owner.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: routine._id,
    mode: 'ranged',
    rangeIncrements: 10,
    operationId: 'range-at-maximum',
  });
  await owner.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: routine._id,
    weaponEntryId: dagger,
    mode: 'thrown',
    operationId: 'range-drift',
  });
  const after = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(after?.entries.find((row) => row._id === routine._id)).toMatchObject({
    state: { mode: 'thrown', rangeIncrements: 10 },
  });
  expect(
    after?.calculated.attackRoutines
      .find((row) => row.entryId === routine._id)
      ?.warnings.filter((warning) => warning.check === 'attackRangeExceeded'),
  ).toEqual([expect.objectContaining({ subject: routine._id })]);
});

test('a missing ammunition row retains its reference through rename and can be cleared', async () => {
  const { t, owner, member, scope, weapon } = await fixture();
  const ammo = await owner.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Arrows',
    modifiers: [],
    detail: { kind: 'item', consumable: true, ammunition: true },
    operationId: 'arrows',
  });
  const entryId = await owner.mutation(api.characterSheet.createAttackRoutine, {
    ...scope,
    weaponEntryId: weapon,
    mode: 'ranged',
    ammunitionEntryId: ammo,
    operationId: 'retained-ammo-routine',
  });
  await t.run((ctx) => ctx.db.delete('characterSheetEntry', ammo));
  await member.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId,
    name: 'Retained shots',
    ammunitionEntryId: ammo,
    operationId: 'retain-missing-ammo',
  });
  const missing = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(missing?.entries.find((row) => row._id === entryId)).toMatchObject({
    state: { name: 'Retained shots', ammunitionEntryId: ammo },
  });
  expect(
    missing?.calculated.attackRoutines.find((row) => row.entryId === entryId)
      ?.warnings,
  ).toContainEqual(
    expect.objectContaining({ check: 'missingAttackAmmunition' }),
  );
  await member.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId,
    ammunitionEntryId: null,
    operationId: 'repair-missing-ammo',
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )?.entries.find((row) => row._id === entryId)?.state,
  ).not.toHaveProperty('ammunitionEntryId');
  await expect(
    member.mutation(api.characterSheet.editAttackRoutine, {
      ...scope,
      entryId,
      ammunitionEntryId: ammo,
      operationId: 'reselect-missing-ammo',
    }),
  ).rejects.toThrow('Ammunition does not belong');
});

test('an unchanged ammunition choice whose row is no longer an item is retained for repair', async () => {
  const { t, owner, member, scope, weapon } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const base = initial?.entries.find((row) => row.kind === 'base');
  if (!base) throw new Error('Missing base row');
  const entryId = await owner.mutation(api.characterSheet.createAttackRoutine, {
    ...scope,
    weaponEntryId: weapon,
    mode: 'ranged',
    operationId: 'non-item-ammo-routine',
  });
  await t.run(async (ctx) => {
    const row = await ctx.db.get('characterSheetEntry', entryId);
    if (row?.kind !== 'attackRoutine') throw new Error('Missing routine');
    await ctx.db.patch('characterSheetEntry', entryId, {
      state: { ...row.state, ammunitionEntryId: base._id },
    });
  });
  await member.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId,
    name: 'Retained non-item',
    ammunitionEntryId: base._id,
    operationId: 'retain-non-item-ammo',
  });
  const retained = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(retained?.entries.find((row) => row._id === entryId)).toMatchObject({
    state: { name: 'Retained non-item', ammunitionEntryId: base._id },
  });
  expect(
    retained?.calculated.attackRoutines.find((row) => row.entryId === entryId)
      ?.warnings,
  ).toContainEqual(
    expect.objectContaining({ check: 'invalidAttackAmmunition' }),
  );
  await member.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId,
    ammunitionEntryId: null,
    operationId: 'repair-non-item-ammo',
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )?.entries.find((row) => row._id === entryId)?.state,
  ).not.toHaveProperty('ammunitionEntryId');
});

test('ammunition adds no routine while ranged thrown weapons start in thrown mode', async () => {
  const { owner, scope } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  for (const identity of ['arrows', 'bolts', 'javelin', 'shuriken']) {
    const definition = initial?.catalogEntries.find(
      (row) => row.ruleIdentity === identity,
    );
    if (!definition) throw new Error(`Missing ${identity}`);
    const entryId = await owner.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: definition._id,
      operationId: `add-${identity}`,
    });
    const sheet = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    const routines = sheet?.entries.filter(
      (row) =>
        row.kind === 'attackRoutine' && row.state.weaponEntryId === entryId,
    );
    if (identity === 'arrows' || identity === 'bolts')
      expect(routines).toEqual([]);
    else expect(routines).toMatchObject([{ state: { mode: 'thrown' } }]);
  }
});

test('the ranged representative catalog supplies cited ammunition, reload facts and ordinary feat choices', async () => {
  const { owner, scope } = await fixture();
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  for (const [identity, weapon] of [
    ['shortbow', { dice: '1d6', rangeIncrement: 60 }],
    ['light-crossbow', { reload: 'move' }],
    [
      'heavy-crossbow',
      { dice: '1d10', reload: 'fullRound', rangeIncrement: 120 },
    ],
    ['hand-crossbow', { dice: '1d4', reload: 'move', rangeIncrement: 30 }],
    ['javelin', { dice: '1d6', thrown: true, thrownRangeIncrement: 30 }],
    ['shuriken', { dice: '1d2', thrown: true, thrownRangeIncrement: 10 }],
  ] as const) {
    const definition = sheet?.catalogEntries.find(
      (row) => row.ruleIdentity === identity,
    );
    expect(definition).toMatchObject({
      sources: [
        expect.objectContaining({ book: 'Pathfinder RPG Core Rulebook' }),
      ],
      detail: { kind: 'item', weapon },
    });
  }
  for (const identity of ['arrows', 'bolts', 'shuriken'])
    expect(
      sheet?.catalogEntries.find((row) => row.ruleIdentity === identity),
    ).toMatchObject({
      detail: { kind: 'item', ammunition: true },
    });
  for (const [identity, prerequisites] of [
    ['point-blank-shot', []],
    ['precise-shot', [{ feat: 'point-blank-shot' }]],
    ['quick-draw', [{ bab: 1 }]],
    ['rapid-reload', [{ proficiency: { choice: true } }]],
  ] as const)
    expect(
      sheet?.catalogEntries.find((row) => row.ruleIdentity === identity),
    ).toMatchObject({
      sources: [
        expect.objectContaining({ book: 'Pathfinder RPG Core Rulebook' }),
      ],
      detail: { kind: 'feat', featTypes: ['combat'] },
      prerequisites,
    });
});

test('players share ranged choices and clear ammunition without losing other fields', async () => {
  const { owner, member, scope, weapon } = await fixture();
  const ammo = await owner.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Arrows',
    modifiers: [],
    detail: { kind: 'item', consumable: true, ammunition: true },
    operationId: 'ammo',
  });
  const entryId = await owner.mutation(api.characterSheet.createAttackRoutine, {
    ...scope,
    weaponEntryId: weapon,
    ammunitionEntryId: ammo,
    mode: 'ranged',
    rangeIncrements: 3,
    operationId: 'ranged-create',
  });
  const shared = withSheetCatalog(
    await member.query(api.characterSheet.read, scope),
  );
  expect(shared?.entries.find((row) => row._id === entryId)).toMatchObject({
    state: { ammunitionEntryId: ammo, rangeIncrements: 3 },
  });
  await member.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId,
    ammunitionEntryId: null,
    operationId: 'ranged-clear',
  });
  const cleared = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const row = cleared?.entries.find((entry) => entry._id === entryId);
  expect(row?.state).not.toHaveProperty('ammunitionEntryId');
  expect(row?.state).toMatchObject({ rangeIncrements: 3 });
});

async function fixture(privateCharacter = false) {
  const t = convexTest(schema, modules);
  const campaignId = await t.run(async (ctx) => {
    for (const [person, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: person,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    return ctx.db.insert('campaign', {
      name: 'Attack fixture',
      description: '',
      organizationId: 'org',
      ownerId: 'owner',
      e2eFixture: {
        namespace: 'attacks',
        version: 1,
        workerKey: '0',
        caseKey: 'attacks',
        campaignKey: 'attacks',
      },
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'owner' });
  const member = t.withIdentity({ tokenIdentifier: 'member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'outsider' });
  const campaignScope = privateCharacter
    ? {}
    : { organizationId: 'org', campaignId };
  const characterId = await owner.mutation(api.characterSheet.create, {
    ...campaignScope,
    name: 'Vessa',
    kind: 'pc',
    operationId: 'create',
  });
  const scope = { ...campaignScope, characterId };
  const weapon = await owner.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    operationId: 'weapon',
    name: 'Longsword',
    modifiers: [],
    detail: {
      kind: 'item',
      consumable: false,
      weapon: { baseType: 'longsword', proficiency: 'martial' },
    },
  });
  return { t, owner, member, outsider, scope, weapon };
}

test('adding a weapon creates a named shared routine without adding one for armor or shields', async () => {
  const { owner, member, scope, weapon } = await fixture();
  await owner.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    operationId: 'shield',
    name: 'Heavy shield',
    modifiers: [],
    detail: {
      kind: 'item',
      consumable: false,
      armor: { slot: 'shield', armorCheckPenalty: 2 },
      weapon: { baseType: 'heavy shield', proficiency: 'martial' },
    },
  });
  const sheet = withSheetCatalog(
    await member.query(api.characterSheet.read, scope),
  );
  expect(
    sheet?.entries.filter((row) => row.kind === 'attackRoutine'),
  ).toMatchObject([
    {
      active: true,
      state: {
        kind: 'attackRoutine',
        name: 'Longsword',
        weaponEntryId: weapon,
        hands: 'one',
        mode: 'melee',
        revision: 0,
      },
    },
  ]);
});

test('members save, replace and clear an off-hand choice without overwriting other routine changes', async () => {
  const { owner, member, scope, weapon } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const routine = initial?.entries.find((row) => row.kind === 'attackRoutine');
  const dagger = initial?.catalogEntries.find(
    (row) => row.ruleIdentity === 'dagger',
  );
  if (!routine || !dagger) throw new Error('Missing routine or dagger');
  const offWeapon = await member.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: dagger._id,
    operationId: 'off-weapon',
  });
  await member.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: routine._id,
    offHand: { kind: 'weapon', weaponEntryId: offWeapon, mode: 'thrown' },
    operationId: 'off-hand',
  });
  await owner.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: routine._id,
    name: 'Sword and dagger',
    operationId: 'rename-off-hand',
  });
  expect(
    withSheetCatalog(
      await member.query(api.characterSheet.read, scope),
    )?.entries.find((row) => row._id === routine._id),
  ).toMatchObject({
    state: {
      weaponEntryId: weapon,
      name: 'Sword and dagger',
      offHand: { kind: 'weapon', weaponEntryId: offWeapon, mode: 'thrown' },
      revision: 2,
    },
  });
  await owner.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: routine._id,
    offHand: { kind: 'weapon', weaponEntryId: offWeapon, mode: 'melee' },
    operationId: 'latest-off-hand',
  });
  await member.mutation(api.characterSheet.deleteAttackRoutine, {
    ...scope,
    entryId: routine._id,
    operationId: 'delete-off-hand',
  });
  await owner.mutation(api.characterSheet.restoreAttackRoutine, {
    ...scope,
    entryId: routine._id,
    operationId: 'undo-off-hand',
  });
  expect(
    withSheetCatalog(
      await member.query(api.characterSheet.read, scope),
    )?.entries.find((row) => row._id === routine._id),
  ).toMatchObject({
    active: true,
    state: {
      offHand: { kind: 'weapon', weaponEntryId: offWeapon, mode: 'melee' },
      revision: 5,
    },
  });
  await member.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: routine._id,
    offHand: null,
    operationId: 'clear-off-hand',
  });
  const cleared = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  )?.entries.find((row) => row._id === routine._id);
  expect(cleared?.state).not.toHaveProperty('offHand');
  expect(cleared).toMatchObject({
    state: { name: 'Sword and dagger', revision: 6 },
  });
});

test('members retain independent enchantment and material state on both ends of a double weapon', async () => {
  const { owner, member, scope } = await fixture();
  // CRB pp. 143, 147: hammer/hook are 1d8/×3 and 1d6/×4. Str 18 is
  // +6 for one end in two hands, or +4/+2 when using both ends.
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 18 },
    operationId: 'double-weapon-strength',
  });
  const weapon = await member.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Gnome hooked hammer',
    modifiers: [],
    detail: {
      kind: 'item',
      consumable: false,
      weapon: {
        baseType: 'gnome hooked hammer',
        proficiency: 'exotic',
        handedness: 'twoHanded',
        attackType: 'melee',
        dice: '1d8',
        threat: 20,
        mult: 3,
        otherEnd: { dice: '1d6', threat: 20, mult: 4 },
      },
    },
    operationId: 'double-weapon',
  });
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const routine = initial?.entries.find(
    (row) => row.kind === 'attackRoutine' && row.state.weaponEntryId === weapon,
  );
  if (!routine) throw new Error('Missing double-weapon routine');
  await member.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: routine._id,
    offHand: { kind: 'otherEnd', mode: 'melee' },
    operationId: 'use-both-ends',
  });
  await owner.mutation(api.characterSheet.editEquipment, {
    ...scope,
    entryId: weapon,
    enhancement: 2,
    material: 'silver',
    operationId: 'primary-enchantment',
  });
  await member.mutation(api.characterSheet.editEquipment, {
    ...scope,
    entryId: weapon,
    end: 'otherEnd',
    masterwork: true,
    material: 'cold iron',
    operationId: 'off-enchantment',
  });
  await owner.mutation(api.characterSheet.editEquipment, {
    ...scope,
    entryId: weapon,
    end: 'otherEnd',
    enhancement: 1,
    operationId: 'off-enhancement',
  });
  await member.mutation(api.characterSheet.editEquipment, {
    ...scope,
    entryId: weapon,
    material: null,
    operationId: 'clear-primary-material',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(saved?.entries.find((row) => row._id === weapon)).toMatchObject({
    state: {
      enhancement: 2,
      material: null,
      otherEnd: { masterwork: true, enhancement: 1, material: 'cold iron' },
    },
  });
  expect(saved?.entries.find((row) => row._id === routine._id)).toMatchObject({
    state: {
      hands: 'two',
      offHand: { kind: 'otherEnd', mode: 'melee' },
    },
  });
  expect(
    saved?.calculated.attackRoutines.find((row) => row.entryId === routine._id),
  ).toMatchObject({
    single: [
      {
        hand: 'main',
        end: 'primary',
        damageDice: '1d8',
        damageBonus: { total: 8 },
        criticalMultiplier: { total: 3 },
      },
    ],
    full: [
      {
        hand: 'main',
        end: 'primary',
        damageDice: '1d8',
        damageBonus: { total: 6 },
        criticalMultiplier: { total: 3 },
      },
      {
        hand: 'off',
        end: 'otherEnd',
        damageDice: '1d6',
        damageBonus: { total: 3 },
        criticalMultiplier: { total: 4 },
      },
    ],
  });
});

test('public feat selections drive the shared off-hand chain and switching Double Slice off restores half Strength', async () => {
  // CRB Table 8–7: light off hand with TWF is −2/−2. Improved/Greater
  // add −5/−10 off-hand attacks; Double Slice applies the full +4 Str.
  const { owner, member, scope } = await fixture();
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 18, dexterity: 19 },
    operationId: 'dual-wielder-scores',
  });
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const sword = initial?.catalogEntries.find(
    (row) => row.ruleIdentity === 'longsword',
  );
  const dagger = initial?.catalogEntries.find(
    (row) => row.ruleIdentity === 'dagger',
  );
  if (!sword || !dagger) throw new Error('Missing representative weapons');
  const mainId = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: sword._id,
    operationId: 'feat-main-weapon',
  });
  const offId = await member.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: dagger._id,
    operationId: 'feat-off-weapon',
  });
  const featIds = new Map<string, typeof mainId>();
  let position = 0;
  for (const identity of [
    'two-weapon-fighting',
    'improved-two-weapon-fighting',
    'greater-two-weapon-fighting',
    'double-slice',
  ]) {
    const feat = initial?.catalogEntries.find(
      (row) => row.ruleIdentity === identity,
    );
    if (!feat) throw new Error(`Missing representative feat: ${identity}`);
    featIds.set(
      identity,
      await member.mutation(api.characterSheet.fillSelectionSlot, {
        ...scope,
        slotId: 'feat:general',
        position: position++,
        catalogEntryId: feat._id,
        operationId: identity,
      }),
    );
  }
  const selected = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const routine = selected?.entries.find(
    (row) => row.kind === 'attackRoutine' && row.state.weaponEntryId === mainId,
  );
  if (!routine) throw new Error('Missing selected routine');
  await owner.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: routine._id,
    offHand: { kind: 'weapon', weaponEntryId: offId, mode: 'melee' },
    operationId: 'feat-off-hand',
  });
  const dual = withSheetCatalog(
    await member.query(api.characterSheet.read, scope),
  )?.calculated.attackRoutines.find((row) => row.entryId === routine._id);
  expect(dual?.single).toMatchObject([
    { hand: 'main', attackBonus: { total: 0 }, damageBonus: { total: 4 } },
  ]);
  expect(dual?.full).toMatchObject([
    { hand: 'main', attackBonus: { total: -2 }, damageBonus: { total: 4 } },
    { hand: 'off', attackBonus: { total: -2 }, damageBonus: { total: 4 } },
    { hand: 'off', attackBonus: { total: -7 }, damageBonus: { total: 4 } },
    { hand: 'off', attackBonus: { total: -12 }, damageBonus: { total: 4 } },
  ]);
  const doubleSlice = featIds.get('double-slice');
  if (!doubleSlice) throw new Error('Missing selected Double Slice');
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: doubleSlice,
    active: false,
    operationId: 'switch-off-double-slice',
  });
  const without = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  )?.calculated.attackRoutines.find((row) => row.entryId === routine._id);
  expect(
    without?.full
      .filter((line) => line.hand === 'off')
      .map((line) => line.damageBonus.total),
  ).toEqual([2, 2, 2]);
});

test('representative Base Items can be selected and create routines with natural hands and computed lines', async () => {
  // CRB Tables 6–4 and 8–1: greatsword 2d6, 19–20/×2; Str 18 is +4,
  // two hands gives +6 damage. Without martial proficiency attack takes −4.
  const { owner, member, scope } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const greatsword = initial?.catalogEntries.find(
    (row) => row.ruleIdentity === 'greatsword',
  );
  expect(greatsword).toBeDefined();
  if (!greatsword) throw new Error('Missing representative greatsword');
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 18 },
    operationId: 'strength',
  });
  const weapon = await member.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: greatsword._id,
    operationId: 'greatsword',
  });
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const routine = sheet?.calculated.attackRoutines.find(
    (row) => row.weaponEntryId === weapon,
  );
  expect(routine).toMatchObject({
    hands: 'two',
    mode: 'melee',
    single: [
      {
        damageDice: '2d6',
        attackBonus: { total: 0 },
        damageBonus: { total: 6 },
        criticalThreat: { total: 19 },
        criticalMultiplier: { total: 2 },
      },
    ],
  });
});

test.each(['global', 'campaign'] as const)(
  'Attack Routines load their referenced %s weapon without unrelated shared definitions',
  async (weaponScope) => {
    const { t, owner, member, scope } = await fixture();
    const { weaponId, unrelatedId } = await t.run(async (ctx) => {
      const definition = {
        name: 'Shared spear',
        ruleIdentity: 'shared-spear',
        sources: [],
        modifiers: [],
        stacksWithItself: false,
        detail: {
          kind: 'item' as const,
          consumable: false,
          weapon: {
            baseType: 'spear',
            proficiency: 'simple' as const,
            handedness: 'twoHanded' as const,
            attackType: 'melee' as const,
            dice: '1d8',
            damageTypes: ['piercing'],
            threat: 20,
            mult: 3,
            strengthDamage: 'melee' as const,
          },
        },
        ...(weaponScope === 'global'
          ? { scope: 'global' as const }
          : { scope: 'campaign' as const, campaignId: scope.campaignId }),
      };
      const weaponId = await ctx.db.insert('catalogEntry', definition);
      const unrelatedId = await ctx.db.insert('catalogEntry', {
        ...definition,
        name: 'Unselected weapon',
        ruleIdentity: 'unselected-weapon',
      });
      return { weaponId, unrelatedId };
    });
    const weaponEntryId = await owner.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: weaponId,
      operationId: 'select-shared-weapon',
    });
    const sheet = withSheetCatalog(
      await member.query(api.characterSheet.read, scope),
    );
    expect(sheet?.catalogEntries.map((row) => row._id)).toContain(weaponId);
    expect(sheet?.catalogEntries.map((row) => row._id)).not.toContain(
      unrelatedId,
    );
    expect(sheet?.calculated.attackRoutines).toContainEqual(
      expect.objectContaining({
        weaponEntryId,
        hands: 'two',
        single: [expect.objectContaining({ damageDice: '1d8' })],
      }),
    );
  },
);

test('Customize and Detach keep an Attack Routine attached to its Gear row and use the copied weapon statistics', async () => {
  const { t, owner, member, scope } = await fixture();
  const catalog = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const dagger = catalog?.catalogEntries.find(
    (row) => row.ruleIdentity === 'dagger',
  );
  const longsword = catalog?.catalogEntries.find(
    (row) =>
      row.ruleIdentity === 'longsword' &&
      row.detail.kind === 'item' &&
      row.detail.weapon?.dice,
  );
  if (!longsword) throw new Error('Missing representative longsword');
  const weapon = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: longsword._id,
    operationId: 'select-longsword',
  });
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const item = initial?.entries.find((row) => row._id === weapon);
  const routine = initial?.calculated.attackRoutines.find(
    (row) => row.weaponEntryId === weapon,
  );
  if (item?.kind !== 'item' || !routine)
    throw new Error('Missing weapon routine');
  if (!dagger) throw new Error('Missing dagger');
  const mainWeapon = await member.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: dagger._id,
    operationId: 'copy-test-main-weapon',
  });
  const offRoutine = await member.mutation(
    api.characterSheet.createAttackRoutine,
    {
      ...scope,
      weaponEntryId: mainWeapon,
      offHand: { kind: 'weapon', weaponEntryId: weapon, mode: 'melee' },
      operationId: 'copy-test-off-hand',
    },
  );
  expect(routine.single).toMatchObject([
    { weaponName: 'Longsword', damageDice: '1d8' },
  ]);
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', item.catalogEntryId, {
      scope: 'global',
      characterId: undefined,
    }),
  );
  const campaignCopyId = await member.mutation(
    api.catalogCopies.customizeForCampaign,
    {
      ...scope,
      catalogEntryId: item.catalogEntryId,
      operationId: 'customize-weapon',
    },
  );
  await member.mutation(api.catalogCopies.editDefinition, {
    ...scope,
    catalogEntryId: campaignCopyId,
    name: 'Campaign longsword',
    operationId: 'rename-campaign-weapon',
  });
  const customized = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(customized?.entries.find((row) => row._id === weapon)).toMatchObject({
    catalogEntryId: campaignCopyId,
  });
  expect(
    customized?.entries.find((row) => row._id === offRoutine),
  ).toMatchObject({
    state: {
      offHand: { kind: 'weapon', weaponEntryId: weapon, mode: 'melee' },
    },
  });
  expect(
    customized?.calculated.attackRoutines.find(
      (row) => row.entryId === offRoutine,
    )?.full,
  ).toContainEqual(
    expect.objectContaining({
      hand: 'off',
      weaponEntryId: weapon,
      weaponName: 'Campaign longsword',
      damageDice: '1d8',
    }),
  );
  expect(
    customized?.calculated.attackRoutines.find(
      (row) => row.entryId === routine.entryId,
    ),
  ).toMatchObject({
    weaponEntryId: weapon,
    single: [{ weaponName: 'Campaign longsword', damageDice: '1d8' }],
  });
  const privateCopyId = await owner.mutation(api.catalogCopies.detach, {
    ...scope,
    target: { kind: 'entry', entryId: weapon },
    operationId: 'detach-weapon',
  });
  const detached = withSheetCatalog(
    await member.query(api.characterSheet.read, scope),
  );
  const definition = detached?.catalogEntries.find(
    (row) => row._id === privateCopyId,
  );
  if (definition?.detail.kind !== 'item' || !definition.detail.weapon)
    throw new Error('Missing detached weapon');
  await member.mutation(api.catalogCopies.editDefinition, {
    ...scope,
    catalogEntryId: privateCopyId,
    name: 'Private longsword',
    detail: {
      ...definition.detail,
      weapon: { ...definition.detail.weapon, dice: '2d8' },
    },
    operationId: 'edit-detached-weapon',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(saved?.entries.find((row) => row._id === weapon)).toMatchObject({
    catalogEntryId: privateCopyId,
  });
  expect(saved?.entries.find((row) => row._id === offRoutine)).toMatchObject({
    state: {
      offHand: { kind: 'weapon', weaponEntryId: weapon, mode: 'melee' },
    },
  });
  expect(
    saved?.calculated.attackRoutines.find((row) => row.entryId === offRoutine)
      ?.full,
  ).toContainEqual(
    expect.objectContaining({
      hand: 'off',
      weaponEntryId: weapon,
      weaponName: 'Private longsword',
      damageDice: '2d8',
    }),
  );
  expect(
    saved?.calculated.attackRoutines.find(
      (row) => row.entryId === routine.entryId,
    ),
  ).toMatchObject({
    weaponEntryId: weapon,
    single: [{ weaponName: 'Private longsword', damageDice: '2d8' }],
    full: [{ weaponName: 'Private longsword', damageDice: '2d8' }],
    warnings: [],
  });
});

test('all routine writers enforce membership, private ownership and legacy write authority', async () => {
  for (const privateCharacter of [false, true]) {
    const { t, owner, member, outsider, scope, weapon } =
      await fixture(privateCharacter);
    const initial = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    const routine = initial?.entries.find(
      (row) => row.kind === 'attackRoutine',
    );
    if (!routine) throw new Error('Missing routine');
    const commands = (caller: typeof owner, writeEpoch?: number) => [
      () =>
        caller.mutation(api.characterSheet.createAttackRoutine, {
          ...scope,
          weaponEntryId: 'unarmed',
          naturalAttackEntryIds: [],
          availableLimbs: 2,
          writeEpoch,
          operationId: 'create-unarmed-gated',
        }),
      () =>
        caller.mutation(api.characterSheet.createAttackRoutine, {
          ...scope,
          weaponEntryId: weapon,
          offHand: { kind: 'otherEnd', mode: 'melee' },
          writeEpoch,
          operationId: 'create',
        }),
      () =>
        caller.mutation(api.characterSheet.editAttackRoutine, {
          ...scope,
          entryId: routine._id,
          name: 'Edited',
          naturalAttackEntryIds: [],
          availableLimbs: 4,
          offHand: { kind: 'otherEnd', mode: 'melee' },
          writeEpoch,
          operationId: 'edit',
        }),
      () =>
        caller.mutation(api.characterSheet.deleteAttackRoutine, {
          ...scope,
          entryId: routine._id,
          writeEpoch,
          operationId: 'delete',
        }),
      () =>
        caller.mutation(api.characterSheet.restoreAttackRoutine, {
          ...scope,
          entryId: routine._id,
          writeEpoch,
          operationId: 'undo',
        }),
      () =>
        caller.mutation(api.characterSheet.editEquipment, {
          ...scope,
          entryId: weapon,
          end: 'otherEnd',
          enhancement: 1,
          writeEpoch,
          operationId: 'edit-off-end',
        }),
    ];
    for (const caller of privateCharacter
      ? [t, outsider, member]
      : [t, outsider]) {
      for (const command of commands(caller))
        await expect(command()).rejects.toThrow();
      await expect(
        caller.query(api.characterSheet.read, scope),
      ).rejects.toThrow();
    }
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
    ).toEqual(initial);
  }
});

test('routine writes reject foreign rows and structurally invalid inputs without changing shared state', async () => {
  const { owner, scope, weapon } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const routine = initial?.entries.find((row) => row.kind === 'attackRoutine');
  if (!routine) throw new Error('Missing routine');
  const otherId = await owner.mutation(api.characterSheet.create, {
    organizationId: scope.organizationId,
    campaignId: scope.campaignId,
    name: 'Other',
    kind: 'pc',
    operationId: 'other',
  });
  const otherScope = { ...scope, characterId: otherId };
  for (const command of [
    () =>
      owner.mutation(api.characterSheet.createAttackRoutine, {
        ...otherScope,
        weaponEntryId: weapon,
        operationId: 'foreign-weapon',
      }),
    () =>
      owner.mutation(api.characterSheet.editAttackRoutine, {
        ...otherScope,
        entryId: routine._id,
        name: 'Foreign',
        operationId: 'foreign-routine',
      }),
    () =>
      owner.mutation(api.characterSheet.deleteAttackRoutine, {
        ...otherScope,
        entryId: routine._id,
        operationId: 'foreign-delete',
      }),
    () =>
      owner.mutation(api.characterSheet.restoreAttackRoutine, {
        ...otherScope,
        entryId: routine._id,
        operationId: 'foreign-restore',
      }),
    () =>
      owner.mutation(api.characterSheet.createAttackRoutine, {
        ...scope,
        weaponEntryId: weapon,
        name: ' ',
        operationId: 'empty',
      }),
  ])
    await expect(command()).rejects.toThrow();
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
  ).toEqual(initial);
});

test('a routine pointing at a non-item keeps the sheet readable and can be repaired', async () => {
  const { t, owner, member, scope, weapon } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const routine = initial?.entries.find((row) => row.kind === 'attackRoutine');
  const base = initial?.entries.find((row) => row.kind === 'base');
  if (routine?.kind !== 'attackRoutine' || !base)
    throw new Error('Missing sheet entries');
  await t.run((ctx) =>
    ctx.db.patch('characterSheetEntry', routine._id, {
      state: { ...routine.state, weaponEntryId: base._id },
    }),
  );
  const damaged = withSheetCatalog(
    await member.query(api.characterSheet.read, scope),
  );
  expect(damaged?.calculated.attackRoutines).toMatchObject([
    {
      entryId: routine._id,
      single: [],
      full: [],
      warnings: [{ check: 'invalidAttackWeapon', subject: routine._id }],
    },
  ]);
  await owner.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: routine._id,
    name: 'Repaired strike',
    weaponEntryId: weapon,
    operationId: 'repair',
  });
  expect(
    withSheetCatalog(await member.query(api.characterSheet.read, scope))
      ?.calculated.attackRoutines,
  ).toMatchObject([{ entryId: routine._id, name: 'Repaired strike' }]);
});

test('replacing a routine weapon applies its natural hands and mode while retaining explicit choices', async () => {
  const { owner, scope, weapon } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const routine = initial?.entries.find((row) => row.kind === 'attackRoutine');
  const longbow = initial?.catalogEntries.find(
    (row) => row.ruleIdentity === 'longbow',
  );
  if (!routine || !longbow) throw new Error('Missing routine or weapon');
  const bow = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: longbow._id,
    operationId: 'bow',
  });
  await owner.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: routine._id,
    weaponEntryId: bow,
    operationId: 'replace',
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )?.entries.find((row) => row._id === routine._id),
  ).toMatchObject({
    state: { weaponEntryId: bow, hands: 'two', mode: 'ranged' },
  });
  await owner.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: routine._id,
    weaponEntryId: weapon,
    hands: 'two',
    mode: 'thrown',
    operationId: 'replace-with-choices',
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )?.entries.find((row) => row._id === routine._id),
  ).toMatchObject({
    state: { weaponEntryId: weapon, hands: 'two', mode: 'thrown' },
  });
});

test('members create, rename, change hands and undo routine deletion without losing its identity', async () => {
  const { owner, member, scope, weapon } = await fixture();
  const entryId = await member.mutation(
    api.characterSheet.createAttackRoutine,
    {
      ...scope,
      weaponEntryId: weapon,
      name: 'Two hands',
      hands: 'two',
      operationId: 'routine',
    },
  );
  await owner.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId,
    name: 'Quick strike',
    hands: 'one',
    operationId: 'rename',
  });
  await member.mutation(api.characterSheet.deleteAttackRoutine, {
    ...scope,
    entryId,
    operationId: 'delete',
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )?.entries.find((row) => row._id === entryId),
  ).toMatchObject({
    active: false,
    state: { name: 'Quick strike', revision: 2 },
  });
  await owner.mutation(api.characterSheet.restoreAttackRoutine, {
    ...scope,
    entryId,
    operationId: 'undo',
  });
  expect(
    withSheetCatalog(
      await member.query(api.characterSheet.read, scope),
    )?.entries.find((row) => row._id === entryId),
  ).toMatchObject({
    active: true,
    state: { name: 'Quick strike', hands: 'one', revision: 3 },
  });
});

test('routine removal keeps only the latest Undo row and purges older removals on routine writes', async () => {
  const { owner, member, scope, weapon } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const first = initial?.entries.find((row) => row.kind === 'attackRoutine');
  if (!first) throw new Error('Missing routine');
  const second = await member.mutation(api.characterSheet.createAttackRoutine, {
    ...scope,
    weaponEntryId: weapon,
    name: 'Second',
    operationId: 'second',
  });
  await owner.mutation(api.characterSheet.deleteAttackRoutine, {
    ...scope,
    entryId: first._id,
    operationId: 'delete-first',
  });
  await member.mutation(api.characterSheet.deleteAttackRoutine, {
    ...scope,
    entryId: second,
    operationId: 'delete-second',
  });
  const removed = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    removed?.entries.filter((row) => row.kind === 'attackRoutine'),
  ).toMatchObject([
    { _id: second, active: false, state: { name: 'Second', revision: 1 } },
  ]);
  expect(
    removed?.entries.find((row) => row._id === second)?.state,
  ).not.toHaveProperty('deleted');
  await expect(
    owner.mutation(api.characterSheet.restoreAttackRoutine, {
      ...scope,
      entryId: first._id,
      operationId: 'undo-expired',
    }),
  ).rejects.toThrow('Attack Routine does not belong to this Character');
  await member.mutation(api.characterSheet.restoreAttackRoutine, {
    ...scope,
    entryId: second,
    operationId: 'undo-second',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated.attackRoutines,
  ).toMatchObject([{ entryId: second, name: 'Second' }]);
});

test('a routine write retires historical removals before applying the sheet size limit', async () => {
  const { t, owner, scope, weapon } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const routine = initial?.entries.find((row) => row.kind === 'attackRoutine');
  if (routine?.kind !== 'attackRoutine') throw new Error('Missing routine');
  await t.run(async (ctx) => {
    for (let index = 0; index < maxCharacterChildRows + 2; index++)
      await ctx.db.insert('characterSheetEntry', {
        characterId: scope.characterId,
        kind: 'attackRoutine',
        active: false,
        state: routine.state,
      });
  });
  const entryId = await owner.mutation(api.characterSheet.createAttackRoutine, {
    ...scope,
    weaponEntryId: weapon,
    name: 'Fresh strike',
    operationId: 'create-after-old-removals',
  });
  const shared = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const routines = shared?.entries.filter(
    (row) => row.kind === 'attackRoutine',
  );
  expect(routines?.filter((row) => !row.active)).toHaveLength(1);
  expect(shared?.calculated.attackRoutines).toMatchObject([
    { entryId: routine._id },
    { entryId, name: 'Fresh strike' },
  ]);
});

test('two sessions apply the latest routine change and preserve independent routine edits', async () => {
  const { owner, member, scope, weapon } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const first = initial?.entries.find((row) => row.kind === 'attackRoutine');
  if (!first) throw new Error('Missing default routine');
  const second = await member.mutation(api.characterSheet.createAttackRoutine, {
    ...scope,
    weaponEntryId: weapon,
    operationId: 'second',
  });
  await owner.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: first._id,
    name: 'First session',
    operationId: 'first',
  });
  await member.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: first._id,
    name: 'Latest session',
    operationId: 'latest',
  });
  await member.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: second,
    hands: 'two',
    operationId: 'independent',
  });
  const shared = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(shared?.entries.find((row) => row._id === first._id)).toMatchObject({
    state: { name: 'Latest session', revision: 2 },
  });
  expect(shared?.entries.find((row) => row._id === second)).toMatchObject({
    state: { hands: 'two', revision: 1 },
  });
  await member.mutation(api.characterSheet.deleteAttackRoutine, {
    ...scope,
    entryId: first._id,
    operationId: 'latest-delete',
  });
  await owner.mutation(api.characterSheet.restoreAttackRoutine, {
    ...scope,
    entryId: first._id,
    operationId: 'latest-undo',
  });
  expect(
    withSheetCatalog(
      await member.query(api.characterSheet.read, scope),
    )?.entries.find((row) => row._id === first._id),
  ).toMatchObject({
    active: true,
    state: { name: 'Latest session', revision: 4 },
  });
});

test('a missing weapon preserves its editable routine and deletion prunes its Accepted Warning before undo', async () => {
  const { owner, member, scope, weapon } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const routine = initial?.entries.find((row) => row.kind === 'attackRoutine');
  if (!routine) throw new Error('Missing routine');
  await owner.mutation(api.characterSheet.removeSheetEntry, {
    ...scope,
    entryId: weapon,
    operationId: 'remove-weapon',
  });
  const missing = withSheetCatalog(
    await member.query(api.characterSheet.read, scope),
  );
  const warning = missing?.calculated.warnings.find(
    (row) => row.check === 'missingAttackWeapon',
  );
  if (!warning) throw new Error('Expected missing weapon warning');
  expect(missing?.calculated.attackRoutines[0]).toMatchObject({
    entryId: routine._id,
    single: [],
    full: [],
  });
  await member.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
    operationId: 'accept',
  });
  await owner.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: routine._id,
    name: 'Keep this routine',
    operationId: 'rename',
  });
  await member.mutation(api.characterSheet.deleteAttackRoutine, {
    ...scope,
    entryId: routine._id,
    operationId: 'delete',
  });
  const deleted = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    deleted?.acceptedWarnings.filter(
      (row) => row.check === 'missingAttackWeapon',
    ),
  ).toEqual([]);
  expect(deleted?.calculated.attackRoutines).toEqual([]);
  await owner.mutation(api.characterSheet.restoreAttackRoutine, {
    ...scope,
    entryId: routine._id,
    operationId: 'undo',
  });
  const restored = withSheetCatalog(
    await member.query(api.characterSheet.read, scope),
  );
  expect(restored?.calculated.attackRoutines[0]).toMatchObject({
    entryId: routine._id,
    name: 'Keep this routine',
    weaponEntryId: weapon,
  });
  expect(
    restored?.calculated.warnings.some(
      (row) => row.check === 'missingAttackWeapon',
    ),
  ).toBe(true);
});

test('changing routine hands applies real weapon proficiency and prunes the resolved Accepted Warning', async () => {
  const { owner, member, scope } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const bastard = initial?.catalogEntries.find(
    (row) => row.ruleIdentity === 'bastard-sword',
  );
  if (!bastard) throw new Error('Missing representative bastard sword');
  const weapon = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: bastard._id,
    operationId: 'exotic',
  });
  const sheet = withSheetCatalog(
    await member.query(api.characterSheet.read, scope),
  );
  const routine = sheet?.entries.find(
    (row) => row.kind === 'attackRoutine' && row.state.weaponEntryId === weapon,
  );
  const warning = sheet?.calculated.warnings.find(
    (row) => row.check === 'oneHandedExotic',
  );
  if (!routine || !warning)
    throw new Error('Missing routine proficiency warning');
  expect(
    sheet?.calculated.weaponProficiencies.find((row) => row.entryId === weapon)
      ?.attackPenalty,
  ).toBe(-4);
  await owner.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
    operationId: 'accept',
  });
  await member.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: routine._id,
    hands: 'two',
    operationId: 'two-hands',
  });
  const corrected = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    corrected?.calculated.warnings.some(
      (row) => row.check === 'oneHandedExotic',
    ),
  ).toBe(false);
  expect(
    corrected?.acceptedWarnings.some((row) => row.check === 'oneHandedExotic'),
  ).toBe(false);
});

test('weapon edits block nonfinite statistics and malformed dice while allowing unusual rule values', async () => {
  const { owner, scope, weapon } = await fixture();
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  for (const badWeapon of [
    {
      baseType: 'longsword',
      proficiency: 'martial' as const,
      threat: Number.NaN,
    },
    {
      baseType: 'longsword',
      proficiency: 'martial' as const,
      mult: Number.POSITIVE_INFINITY,
    },
    {
      baseType: 'longsword',
      proficiency: 'martial' as const,
      rangeIncrement: Number.NEGATIVE_INFINITY,
    },
    { baseType: 'longsword', proficiency: 'martial' as const, dice: 'sword' },
    {
      baseType: 'longsword',
      proficiency: 'martial' as const,
      otherEnd: { dice: '1d6', threat: Number.NaN, mult: 2 },
    },
    {
      baseType: 'longsword',
      proficiency: 'martial' as const,
      otherEnd: { dice: '1d6', threat: 20, mult: Number.POSITIVE_INFINITY },
    },
    {
      baseType: 'longsword',
      proficiency: 'martial' as const,
      otherEnd: { dice: 'hammer', threat: 20, mult: 2 },
    },
  ]) {
    await expect(
      owner.mutation(api.characterSheet.editSheetEntry, {
        ...scope,
        entryId: weapon,
        detail: { kind: 'item', consumable: false, weapon: badWeapon },
        operationId: 'bad-weapon',
      }),
    ).rejects.toThrow();
    await expect(
      owner.mutation(api.characterSheet.createSheetEntry, {
        ...scope,
        name: 'Bad weapon',
        modifiers: [],
        detail: { kind: 'item', consumable: false, weapon: badWeapon },
        operationId: 'bad-new-weapon',
      }),
    ).rejects.toThrow();
  }
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
  ).toEqual(before);
});

test('sheet reads reject a retained routine linked to another Character while allowing missing weapons', async () => {
  const { t, owner, scope, weapon } = await fixture();
  const otherId = await owner.mutation(api.characterSheet.create, {
    organizationId: scope.organizationId,
    campaignId: scope.campaignId,
    name: 'Other',
    kind: 'pc',
    operationId: 'other',
  });
  await t.run((ctx) =>
    ctx.db.insert('characterSheetEntry', {
      characterId: otherId,
      kind: 'attackRoutine',
      active: true,
      state: {
        kind: 'attackRoutine',
        name: 'Foreign weapon',
        weaponEntryId: weapon,
        hands: 'one',
        mode: 'melee',
      },
    }),
  );
  await expect(
    owner.query(api.characterSheet.read, { ...scope, characterId: otherId }),
  ).rejects.toThrow('Weapon does not belong');
});

test('off-hand writes and retained reads refuse another Character’s sheet rows', async () => {
  const { t, owner, member, scope, weapon } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const routine = initial?.entries.find((row) => row.kind === 'attackRoutine');
  if (routine?.kind !== 'attackRoutine') throw new Error('Missing routine');
  const otherId = await owner.mutation(api.characterSheet.create, {
    organizationId: scope.organizationId,
    campaignId: scope.campaignId,
    name: 'Other off-hand wielder',
    kind: 'pc',
    operationId: 'other-off-hand-character',
  });
  const other = withSheetCatalog(
    await owner.query(api.characterSheet.read, {
      ...scope,
      characterId: otherId,
    }),
  );
  const foreignRow = other?.entries.find((row) => row.kind === 'base');
  if (!foreignRow) throw new Error('Missing foreign row');
  for (const command of [
    () =>
      member.mutation(api.characterSheet.createAttackRoutine, {
        ...scope,
        weaponEntryId: weapon,
        offHand: {
          kind: 'weapon',
          weaponEntryId: foreignRow._id,
          mode: 'melee',
        },
        operationId: 'foreign-off-hand-create',
      }),
    () =>
      member.mutation(api.characterSheet.editAttackRoutine, {
        ...scope,
        entryId: routine._id,
        offHand: {
          kind: 'weapon',
          weaponEntryId: foreignRow._id,
          mode: 'melee',
        },
        operationId: 'foreign-off-hand-edit',
      }),
  ])
    await expect(command()).rejects.toThrow('Off-hand weapon does not belong');
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
  ).toEqual(initial);
  await t.run((ctx) =>
    ctx.db.patch('characterSheetEntry', routine._id, {
      state: {
        ...routine.state,
        offHand: {
          kind: 'weapon',
          weaponEntryId: foreignRow._id,
          mode: 'melee',
        },
      },
    }),
  );
  await expect(member.query(api.characterSheet.read, scope)).rejects.toThrow(
    'Weapon does not belong',
  );
});

test('off-hand writers block same-Character references to entries without a weapon', async () => {
  const { owner, member, scope, weapon } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const routine = initial?.entries.find((row) => row.kind === 'attackRoutine');
  const base = initial?.entries.find((row) => row.kind === 'base');
  if (!routine || !base) throw new Error('Missing routine or base');
  const feat = initial?.catalogEntries.find(
    (row) => row.ruleIdentity === 'two-weapon-fighting',
  );
  if (!feat) throw new Error('Missing feat');
  const selectedFeat = await owner.mutation(
    api.characterSheet.fillSelectionSlot,
    {
      ...scope,
      slotId: 'feat:general',
      position: 0,
      catalogEntryId: feat._id,
      operationId: 'nonweapon-feat',
    },
  );
  const nonWeapons = [base._id, routine._id, selectedFeat];
  for (const detail of [
    { kind: 'spell', school: 'evocation' },
    { kind: 'item', consumable: false },
  ] as const) {
    nonWeapons.push(
      await owner.mutation(api.characterSheet.createSheetEntry, {
        ...scope,
        name: `Not a weapon: ${detail.kind}`,
        detail,
        modifiers: [],
        operationId: `nonweapon-${detail.kind}`,
      }),
    );
  }
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  for (const weaponEntryId of nonWeapons) {
    const offHand = { kind: 'weapon', weaponEntryId, mode: 'melee' } as const;
    await expect(
      member.mutation(api.characterSheet.createAttackRoutine, {
        ...scope,
        weaponEntryId: weapon,
        offHand,
        operationId: 'reject-nonweapon-create',
      }),
    ).rejects.toThrow('Off-hand weapon does not belong');
    await expect(
      owner.mutation(api.characterSheet.editAttackRoutine, {
        ...scope,
        entryId: routine._id,
        offHand,
        operationId: 'reject-nonweapon-edit',
      }),
    ).rejects.toThrow('Off-hand weapon does not belong');
  }
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
  ).toEqual(before);
});

test('same-Character invalid off-hand choices remain saveable and repairable with advisory warnings', async () => {
  const { owner, member, scope } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const dagger = initial?.catalogEntries.find(
    (row) => row.ruleIdentity === 'dagger',
  );
  const base = initial?.entries.find((row) => row.kind === 'base');
  if (!dagger || !base) throw new Error('Missing dagger or base');
  const weapon = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: dagger._id,
    operationId: 'advisory-main',
  });
  for (const offHand of [
    { kind: 'weapon', weaponEntryId: weapon, mode: 'melee' },
    { kind: 'otherEnd', mode: 'melee' },
  ] as const) {
    const entryId = await member.mutation(
      api.characterSheet.createAttackRoutine,
      {
        ...scope,
        weaponEntryId: weapon,
        offHand,
        operationId: `advisory-${offHand.kind}`,
      },
    );
    const shared = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    const routine = shared?.calculated.attackRoutines.find(
      (row) => row.entryId === entryId,
    );
    expect(shared?.entries.find((row) => row._id === entryId)).toMatchObject({
      state: { offHand },
    });
    expect(routine?.warnings.length).toBeGreaterThan(0);
    expect(routine?.full).toHaveLength(1);
    await owner.mutation(api.characterSheet.editAttackRoutine, {
      ...scope,
      entryId,
      offHand: null,
      operationId: `repair-${offHand.kind}`,
    });
    expect(
      withSheetCatalog(
        await member.query(api.characterSheet.read, scope),
      )?.entries.find((row) => row._id === entryId)?.state,
    ).not.toHaveProperty('offHand');
  }
});

test('an off-hand weapon leaving Gear preserves editable choices and its warning acceptance lifecycle', async () => {
  const { owner, member, scope } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const dagger = initial?.catalogEntries.find(
    (row) => row.ruleIdentity === 'dagger',
  );
  const sword = initial?.catalogEntries.find(
    (row) => row.ruleIdentity === 'longsword',
  );
  if (!dagger || !sword) throw new Error('Missing weapons');
  const main = await member.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: dagger._id,
    operationId: 'missing-off-main',
  });
  const off = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: sword._id,
    operationId: 'missing-off-weapon',
  });
  const entryId = await owner.mutation(api.characterSheet.createAttackRoutine, {
    ...scope,
    weaponEntryId: main,
    offHand: { kind: 'weapon', weaponEntryId: off, mode: 'melee' },
    operationId: 'missing-off-routine',
  });
  await member.mutation(api.characterSheet.removeSheetEntry, {
    ...scope,
    entryId: off,
    operationId: 'remove-off-weapon',
  });
  await owner.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId,
    offHand: { kind: 'weapon', weaponEntryId: off, mode: 'thrown' },
    operationId: 'edit-missing-off-mode',
  });
  const missing = withSheetCatalog(
    await member.query(api.characterSheet.read, scope),
  );
  const warning = missing?.calculated.attackRoutines
    .find((row) => row.entryId === entryId)
    ?.warnings.find((row) => row.check === 'missingAttackWeapon');
  if (!warning) throw new Error('Missing off-hand warning');
  await owner.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
    operationId: 'accept-missing-off',
  });
  await member.mutation(api.characterSheet.deleteAttackRoutine, {
    ...scope,
    entryId,
    operationId: 'delete-missing-off',
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )?.acceptedWarnings.some((row) => row.subject === warning.subject),
  ).toBe(false);
  await owner.mutation(api.characterSheet.restoreAttackRoutine, {
    ...scope,
    entryId,
    operationId: 'undo-missing-off',
  });
  const restored = withSheetCatalog(
    await member.query(api.characterSheet.read, scope),
  );
  expect(restored?.entries.find((row) => row._id === entryId)).toMatchObject({
    state: { offHand: { kind: 'weapon', weaponEntryId: off, mode: 'thrown' } },
  });
  expect(
    restored?.calculated.attackRoutines.find((row) => row.entryId === entryId)
      ?.warnings,
  ).toContainEqual(expect.objectContaining({ check: 'missingAttackWeapon' }));
});

test('accepted off-hand warnings survive an unavailable main weapon and unrelated writes', async () => {
  const { owner, member, scope } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const sword = initial?.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'longsword',
  );
  const dagger = initial?.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'dagger',
  );
  if (!sword || !dagger) throw new Error('Missing weapons');
  for (const disposition of ['inactive', 'missing'] as const) {
    const main = await owner.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: sword._id,
      operationId: `main-${disposition}`,
    });
    const off = await member.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: dagger._id,
      operationId: `off-${disposition}`,
    });
    const entryId = await owner.mutation(
      api.characterSheet.createAttackRoutine,
      {
        ...scope,
        weaponEntryId: main,
        name: `Paired strikes ${disposition}`,
        offHand: { kind: 'weapon', weaponEntryId: off, mode: 'melee' },
        operationId: `paired-${disposition}`,
      },
    );
    const disable = (weaponEntryId: typeof main) =>
      disposition === 'inactive'
        ? member.mutation(api.characterSheet.editEquipment, {
            ...scope,
            entryId: weaponEntryId,
            active: false,
            operationId: `disable-${weaponEntryId}`,
          })
        : member.mutation(api.characterSheet.removeSheetEntry, {
            ...scope,
            entryId: weaponEntryId,
            operationId: `remove-${weaponEntryId}`,
          });
    await disable(off);
    const before = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    const warning = before?.calculated.attackRoutines
      .find((routine) => routine.entryId === entryId)
      ?.warnings.find((row) => row.subject === `${entryId}:off`);
    if (!warning) throw new Error('Missing off-hand warning');
    if (disposition === 'inactive') {
      expect(warning.message).toContain('Dagger is switched off');
      expect(warning.message).toContain('Off-hand attacks are skipped');
      expect(warning.message).not.toContain('Paired strikes');
    }
    await owner.mutation(api.characterSheet.acceptWarning, {
      ...scope,
      check: warning.check,
      subject: warning.subject,
      fingerprint: warning.fingerprint,
      operationId: `accept-${disposition}`,
    });
    await disable(main);
    await member.mutation(api.characterSheet.editAttackRoutine, {
      ...scope,
      entryId,
      name: `Renamed strikes ${disposition}`,
      operationId: `rename-${disposition}`,
    });
    const after = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    expect(
      after?.calculated.attackRoutines.find(
        (routine) => routine.entryId === entryId,
      ),
    ).toMatchObject({ single: [], full: [] });
    expect(after?.acceptedWarnings).toContainEqual(
      expect.objectContaining({
        check: warning.check,
        subject: warning.subject,
        fingerprint: warning.fingerprint,
      }),
    );
  }
});
