// @vitest-environment edge-runtime
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { normalizeItemState } from './characterSheet';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

async function fixture() {
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
      name: 'Item fixture',
      description: '',
      organizationId: 'org',
      ownerId: 'owner',
      e2eFixture: {
        namespace: 'items',
        version: 1,
        workerKey: '0',
        caseKey: 'items',
        campaignKey: 'items',
      },
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'owner' });
  const member = t.withIdentity({ tokenIdentifier: 'member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'outsider' });
  const create = (name: string) =>
    owner.mutation(api.characterSheet.create, {
      organizationId: 'org',
      campaignId,
      name,
      kind: 'pc',
      operationId: `create-${name}`,
    });
  const characterId = await create('Vessa');
  const otherCharacterId = await create('Oriel');
  const scope = { organizationId: 'org', campaignId, characterId };
  const read = async (identity = owner) => {
    const sheet = withSheetCatalog(
      await identity.query(api.characterSheet.read, scope),
    );
    if (!sheet) throw new Error('Missing sheet');
    return sheet;
  };
  const definition = async (ruleIdentity: string) => {
    const row = (await read()).catalogEntries.find(
      (entry) => entry.ruleIdentity === ruleIdentity,
    );
    if (!row) throw new Error(`Missing ${ruleIdentity}`);
    return row._id;
  };
  const otherDefinition = async (ruleIdentity: string) => {
    const sheet = withSheetCatalog(
      await owner.query(api.characterSheet.read, {
        ...scope,
        characterId: otherCharacterId,
      }),
    );
    const row = sheet?.catalogEntries.find(
      (entry) => entry.ruleIdentity === ruleIdentity,
    );
    if (!row) throw new Error(`Missing other ${ruleIdentity}`);
    return row._id;
  };
  return {
    t,
    owner,
    member,
    outsider,
    scope,
    read,
    definition,
    otherDefinition,
  };
}

function itemState(
  sheet: Awaited<ReturnType<Awaited<ReturnType<typeof fixture>>['read']>>,
  entryId: Id<'characterSheetEntry'>,
) {
  const entry = sheet.entries.find((row) => row._id === entryId);
  if (entry?.kind !== 'item') throw new Error('Missing item');
  return entry.state;
}

test('adding a specific magic weapon copies its defaults once and attacks with its Base Item', async () => {
  const { owner, member, scope, read, definition } = await fixture();
  const flameTongue = await definition('flame-tongue');
  const flamingBurst = await definition('flaming-burst');
  const entryId = await member.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: flameTongue,
    operationId: 'add-flame-tongue',
  });
  const sheet = await read();
  expect(itemState(sheet, entryId)).toEqual({
    kind: 'item',
    enhancement: 1,
    abilities: [{ catalogEntryId: flamingBurst }],
  });
  const routine = sheet.calculated.attackRoutines.find(
    (row) => row.weaponEntryId === entryId,
  );
  // CRB p. 142: the longsword Base Item, not a placeholder.
  expect(routine?.single[0]).toMatchObject({
    damageDice: '1d8',
    damageType: 'slashing',
  });
  expect(routine?.single[0]?.criticalThreat.total).toBe(19);
  expect(
    routine?.single[0]?.extraDamage.map(({ dice, on, damageType }) => ({
      dice,
      on,
      damageType,
    })),
  ).toEqual([
    { dice: '1d6', on: 'hit', damageType: 'fire' },
    { dice: '1d10', on: 'crit', damageType: 'fire' },
  ]);
  // The copy is the sheet's own: removing the ability leaves the definition.
  await owner.mutation(api.characterSheet.editEquipment, {
    ...scope,
    entryId,
    abilities: [],
    operationId: 'strip-burst',
  });
  const stripped = await read(member);
  expect(itemState(stripped, entryId)).toEqual({
    kind: 'item',
    enhancement: 1,
    abilities: [],
  });
  expect(
    stripped.calculated.attackRoutines.find(
      (row) => row.weaponEntryId === entryId,
    )?.single[0]?.extraDamage,
  ).toEqual([]);
  const tongue = stripped.catalogEntries.find((row) => row._id === flameTongue);
  expect(tongue?.detail).toMatchObject({
    magic: { enhancement: 1, abilities: [{ catalogEntryId: flamingBurst }] },
  });
});

test('members edit each end and the bash independently, and bane records its foe', async () => {
  const { owner, member, scope, read, definition } = await fixture();
  const hammer = await member.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: await definition('gnome-hooked-hammer'),
    operationId: 'hammer',
  });
  const shield = await member.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: await definition('heavy-steel-shield'),
    operationId: 'shield',
  });
  const keen = await definition('keen');
  const bane = await definition('bane');
  const flaming = await definition('flaming');
  await member.mutation(api.characterSheet.editEquipment, {
    ...scope,
    entryId: hammer,
    end: 'otherEnd',
    enhancement: 1,
    abilities: [{ catalogEntryId: keen }],
    operationId: 'other-end',
  });
  await owner.mutation(api.characterSheet.editEquipment, {
    ...scope,
    entryId: hammer,
    enhancement: 2,
    abilities: [{ catalogEntryId: bane, choice: '  Undead  ' }],
    operationId: 'primary-end',
  });
  await member.mutation(api.characterSheet.editEquipment, {
    ...scope,
    entryId: shield,
    enhancement: 1,
    operationId: 'shield-ac',
  });
  await owner.mutation(api.characterSheet.editEquipment, {
    ...scope,
    entryId: shield,
    end: 'bash',
    enhancement: 2,
    abilities: [{ catalogEntryId: flaming }],
    operationId: 'bash',
  });
  const sheet = await read(member);
  expect(itemState(sheet, hammer)).toEqual({
    kind: 'item',
    enhancement: 2,
    abilities: [{ catalogEntryId: bane, choice: 'Undead' }],
    otherEnd: { enhancement: 1, abilities: [{ catalogEntryId: keen }] },
  });
  expect(itemState(sheet, shield)).toEqual({
    kind: 'item',
    enhancement: 1,
    bash: { enhancement: 2, abilities: [{ catalogEntryId: flaming }] },
  });
  // The shield's AC enhancement stays on its AC leaf.
  expect(sheet.calculated.breakdowns['ac.shield']?.total).toBe(3);
  const hammerRoutine = sheet.calculated.attackRoutines.find(
    (row) => row.weaponEntryId === hammer,
  );
  expect(hammerRoutine?.single[0]?.extraDamage).toEqual([
    expect.objectContaining({
      dice: '2d6',
      situation: 'undead',
      applies: false,
    }),
  ]);
  expect(
    sheet.calculated.itemParts.find((item) => item.entryId === hammer)?.parts,
  ).toEqual([
    expect.objectContaining({ part: 'primary', enhancement: 2 }),
    expect.objectContaining({ part: 'otherEnd', enhancement: 1 }),
  ]);
  // An empty foe is recorded as unchosen.
  await member.mutation(api.characterSheet.editEquipment, {
    ...scope,
    entryId: hammer,
    abilities: [{ catalogEntryId: bane, choice: ' ' }],
    operationId: 'clear-foe',
  });
  const cleared = await read();
  expect(itemState(cleared, hammer).abilities).toEqual([
    { catalogEntryId: bane, choice: null },
  ]);
  expect(
    cleared.calculated.itemParts.find((item) => item.entryId === hammer)
      ?.parts[0]?.abilities[0],
  ).toMatchObject({ choiceMissing: true });
});

test('item edits refuse outsiders, foreign or non-ability references and impossible parts', async () => {
  const { owner, outsider, scope, definition, otherDefinition } =
    await fixture();
  const sword = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: await definition('longsword'),
    operationId: 'sword',
  });
  const flaming = await definition('flaming');
  await expect(
    outsider.mutation(api.characterSheet.editEquipment, {
      ...scope,
      entryId: sword,
      abilities: [{ catalogEntryId: flaming }],
      operationId: 'outsider',
    }),
  ).rejects.toThrow();
  await expect(
    owner.mutation(api.characterSheet.editEquipment, {
      ...scope,
      entryId: sword,
      abilities: [{ catalogEntryId: await otherDefinition('flaming') }],
      operationId: 'foreign',
    }),
  ).rejects.toThrow('does not belong to this Character');
  await expect(
    owner.mutation(api.characterSheet.editEquipment, {
      ...scope,
      entryId: sword,
      abilities: [{ catalogEntryId: await definition('power-attack') }],
      operationId: 'feat',
    }),
  ).rejects.toThrow('Choose an Item Ability');
  await expect(
    owner.mutation(api.characterSheet.editEquipment, {
      ...scope,
      entryId: sword,
      end: 'bash',
      enhancement: 1,
      operationId: 'sword-bash',
    }),
  ).rejects.toThrow('Choose a shield that can bash');
  await expect(
    owner.mutation(api.characterSheet.editEquipment, {
      ...scope,
      entryId: sword,
      abilities: [{ catalogEntryId: flaming, choice: 'x'.repeat(65) }],
      operationId: 'long-choice',
    }),
  ).rejects.toThrow('too long');
});

test('construction warnings stay advisory and clear when the part is corrected', async () => {
  const { owner, scope, read, definition } = await fixture();
  const sword = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: await definition('longsword'),
    operationId: 'sword',
  });
  const flaming = await definition('flaming');
  await owner.mutation(api.characterSheet.editEquipment, {
    ...scope,
    entryId: sword,
    abilities: [{ catalogEntryId: flaming }, { catalogEntryId: flaming }],
    operationId: 'without-enhancement',
  });
  const warned = await read();
  expect(
    warned.calculated.warnings
      .filter((warning) => warning.subject === sword)
      .map((warning) => warning.check)
      .sort(),
  ).toEqual(['itemAbilityWithoutEnhancement', 'itemDuplicateAbility']);
  await owner.mutation(api.characterSheet.editEquipment, {
    ...scope,
    entryId: sword,
    enhancement: 1,
    abilities: [{ catalogEntryId: flaming }],
    operationId: 'corrected',
  });
  const corrected = await read();
  expect(
    corrected.calculated.warnings.filter(
      (warning) => warning.subject === sword,
    ),
  ).toEqual([]);
});

test('a personal specific item must name an accessible Base Item and copies its magic', async () => {
  const { owner, scope, read, definition, otherDefinition } = await fixture();
  await expect(
    owner.mutation(api.characterSheet.createSheetEntry, {
      ...scope,
      operationId: 'foreign-base',
      name: 'Borrowed blade',
      modifiers: [],
      detail: {
        kind: 'item',
        consumable: false,
        baseItem: await otherDefinition('longsword'),
      },
    }),
  ).rejects.toThrow('does not belong to this Character');
  await expect(
    owner.mutation(api.characterSheet.createSheetEntry, {
      ...scope,
      operationId: 'ability-base',
      name: 'Odd blade',
      modifiers: [],
      detail: {
        kind: 'item',
        consumable: false,
        baseItem: await definition('flaming'),
      },
    }),
  ).rejects.toThrow('Choose a Base Item');
  const shock = await definition('shock');
  const entryId = await owner.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    operationId: 'homebrew',
    name: 'Storm spear',
    modifiers: [],
    detail: {
      kind: 'item',
      consumable: false,
      baseItem: await definition('spear'),
      magic: { enhancement: 1, abilities: [{ catalogEntryId: shock }] },
    },
  });
  const sheet = await read();
  expect(itemState(sheet, entryId)).toEqual({
    kind: 'item',
    enhancement: 1,
    abilities: [{ catalogEntryId: shock }],
  });
  const routine = sheet.calculated.attackRoutines.find(
    (row) => row.weaponEntryId === entryId,
  );
  // The spear Base Item's two-handed melee default and its ×3 critical.
  expect(routine).toMatchObject({ name: 'Storm spear', hands: 'two' });
  expect(routine?.single[0]?.criticalMultiplier.total).toBe(3);
  expect(routine?.single[0]?.extraDamage[0]).toMatchObject({
    dice: '1d6',
    damageType: 'electricity',
  });
});

test('specific armor and ammunition resolve through their Base Items on the sheet read', async () => {
  const { owner, scope, read, definition } = await fixture();
  const plate = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: await definition('dwarven-plate'),
    operationId: 'plate',
  });
  const bow = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: await definition('heavy-crossbow'),
    operationId: 'bow',
  });
  const bolts = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: await definition('screaming-bolt'),
    operationId: 'bolts',
  });
  const sheet = await read();
  expect(sheet.calculated.equipment.items).toEqual([
    expect.objectContaining({
      entryId: plate,
      armorBonus: 9,
      armorCheckPenalty: -5,
      materialNote: 'Adamantine: damage reduction 3/—.',
    }),
  ]);
  const routine = sheet.entries.find(
    (row) => row.kind === 'attackRoutine' && row.state.weaponEntryId === bow,
  );
  if (!routine) throw new Error('Missing crossbow routine');
  await owner.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: routine._id,
    ammunitionEntryId: bolts,
    operationId: 'load-bolts',
  });
  const loaded = await read();
  const line = loaded.calculated.attackRoutines.find(
    (row) => row.entryId === routine._id,
  )?.single[0];
  expect(line?.attackBonus.applied).toContainEqual(
    expect.objectContaining({ bonusType: 'enhancement', value: 2 }),
  );
  expect(line?.damageBonus.applied).toContainEqual(
    expect.objectContaining({ bonusType: 'enhancement', value: 2 }),
  );
});

// CRB p. 134 and #237: Shield Master is an ordinary seeded feat Selection.
test('a selected Shield Master lends the shield enhancement to its bash and lifts its two-weapon penalty', async () => {
  const { owner, member, scope, read, definition } = await fixture();
  const sword = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: await definition('longsword'),
    operationId: 'sword',
  });
  const shield = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: await definition('heavy-steel-shield'),
    operationId: 'shield',
  });
  await owner.mutation(api.characterSheet.editEquipment, {
    ...scope,
    entryId: shield,
    enhancement: 3,
    operationId: 'shield-ac',
  });
  const routine = (await read()).entries.find(
    (row) => row.kind === 'attackRoutine' && row.state.weaponEntryId === sword,
  );
  if (!routine) throw new Error('Missing sword routine');
  await member.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: routine._id,
    offHand: { kind: 'weapon', weaponEntryId: shield, mode: 'melee' },
    operationId: 'sword-and-board',
  });
  const bash = async () => {
    const sheet = await read(member);
    const calculated = sheet.calculated.attackRoutines.find(
      (row) => row.entryId === routine._id,
    );
    return {
      line: calculated?.full.find((line) => line.hand === 'off'),
      summary: calculated?.twoWeaponPenaltySummary,
    };
  };
  const before = await bash();
  expect(
    before.line?.attackBonus.applied.some(
      (row) => row.bonusType === 'enhancement',
    ),
  ).toBe(false);
  await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'feat:general',
    position: 0,
    catalogEntryId: await definition('shield-master'),
    operationId: 'shield-master',
  });
  const after = await bash();
  expect(after.line?.attackBonus.applied).toContainEqual(
    expect.objectContaining({ bonusType: 'enhancement', value: 3 }),
  );
  expect(after.line?.damageBonus.applied).toContainEqual(
    expect.objectContaining({ bonusType: 'enhancement', value: 3 }),
  );
  // Only the bash loses its two-weapon penalty.
  expect(
    (after.line?.attackBonus.total ?? 0) -
      (before.line?.attackBonus.total ?? 0),
  ).toBe(10 + 3);
  expect(after.summary).toContain('Shield Master');
});

test('magic ammunition keeps its own enhancement, material and Item Abilities for the routine firing it', async () => {
  const { owner, member, scope, read, definition } = await fixture();
  const bow = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: await definition('heavy-crossbow'),
    operationId: 'bow',
  });
  const bolts = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: await definition('screaming-bolt'),
    operationId: 'bolts',
  });
  const routine = (await read()).entries.find(
    (row) => row.kind === 'attackRoutine' && row.state.weaponEntryId === bow,
  );
  if (!routine) throw new Error('Missing crossbow routine');
  await owner.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: routine._id,
    ammunitionEntryId: bolts,
    operationId: 'load-bolts',
  });
  const flaming = await definition('flaming');
  await member.mutation(api.characterSheet.editEquipment, {
    ...scope,
    entryId: bolts,
    enhancement: 3,
    material: ' cold iron ',
    abilities: [{ catalogEntryId: flaming }],
    operationId: 'enhance-bolts',
  });
  const sheet = await read();
  expect(itemState(sheet, bolts)).toEqual({
    kind: 'item',
    enhancement: 3,
    material: 'cold iron',
    abilities: [{ catalogEntryId: flaming }],
  });
  expect(
    sheet.calculated.itemParts.find((item) => item.entryId === bolts)?.parts,
  ).toEqual([
    expect.objectContaining({
      part: 'primary',
      kind: 'ranged',
      enhancement: 3,
      material: 'cold iron',
      abilities: [expect.objectContaining({ catalogEntryId: flaming })],
    }),
  ]);
  const line = sheet.calculated.attackRoutines.find(
    (row) => row.entryId === routine._id,
  )?.single[0];
  expect(line?.attackBonus.applied).toContainEqual(
    expect.objectContaining({ bonusType: 'enhancement', value: 3 }),
  );
  expect(line?.extraDamage).toEqual([
    expect.objectContaining({ dice: '1d6', damageType: 'fire', on: 'hit' }),
  ]);
  await expect(
    owner.mutation(api.characterSheet.editEquipment, {
      ...scope,
      entryId: bolts,
      material: 'x'.repeat(65),
      operationId: 'long-material',
    }),
  ).rejects.toThrow('Name the material in 64 characters or fewer');
});

test('an unequipped item keeps its parts and construction warnings on the sheet read', async () => {
  const { owner, scope, read, definition } = await fixture();
  const sword = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: await definition('longsword'),
    operationId: 'sword',
  });
  await owner.mutation(api.characterSheet.editEquipment, {
    ...scope,
    entryId: sword,
    active: false,
    enhancement: 6,
    operationId: 'stow-sword',
  });
  const sheet = await read();
  expect(
    sheet.calculated.itemParts.find((item) => item.entryId === sword),
  ).toMatchObject({
    active: false,
    parts: [{ part: 'primary', enhancement: 6 }],
  });
  expect(sheet.calculated.warnings).toContainEqual(
    expect.objectContaining({ check: 'equipmentEnhancement', subject: sword }),
  );
});

test('a recorded item state with a malformed Item Ability ID is refused as invalid', async () => {
  const { t } = await fixture();
  await expect(
    t.run(async (ctx) =>
      normalizeItemState(ctx, {
        kind: 'item',
        bash: { abilities: [{ catalogEntryId: 'not-an-id' }] },
      }),
    ),
  ).rejects.toThrow('Choose a valid Item Ability');
});
