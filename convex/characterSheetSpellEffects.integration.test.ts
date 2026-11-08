// @vitest-environment edge-runtime
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

// #236 item 10 and PRD #251 decision 10: Spell Effects record an editable
// caster level prefilled with the lowest legal one, and per-item effects
// record their target. Spell descriptions: CRB pp. 294 (haste), 302 (keen
// edge), 306 (magic fang) and 307 (magic weapon, greater magic weapon,
// magic vestment).

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
      name: 'Spell Effect fixture',
      description: '',
      organizationId: 'org',
      ownerId: 'owner',
      e2eFixture: {
        namespace: 'spell-effects',
        version: 1,
        workerKey: '0',
        caseKey: 'spell-effects',
        campaignKey: 'spell-effects',
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
  const otherScope = { ...scope, characterId: otherCharacterId };
  const readScope = async (
    sheetScope: typeof scope,
    identity: typeof owner = owner,
  ) => {
    const sheet = withSheetCatalog(
      await identity.query(api.characterSheet.read, sheetScope),
    );
    if (!sheet) throw new Error('Missing sheet');
    return sheet;
  };
  const read = (identity: typeof owner = owner) => readScope(scope, identity);
  const definition = async (ruleIdentity: string, sheetScope = scope) => {
    const row = (await readScope(sheetScope)).catalogEntries.find(
      (entry) => entry.ruleIdentity === ruleIdentity,
    );
    if (!row) throw new Error(`Missing ${ruleIdentity}`);
    return row._id;
  };
  const select = (
    ruleIdentity: string,
    operationId: string,
    sheetScope = scope,
    identity = member,
  ) =>
    definition(ruleIdentity, sheetScope).then((catalogEntryId) =>
      identity.mutation(api.characterSheet.selectEntry, {
        ...sheetScope,
        catalogEntryId,
        operationId,
      }),
    );
  return {
    owner,
    member,
    outsider,
    scope,
    otherScope,
    read,
    readScope,
    select,
  };
}

type Sheet = Awaited<ReturnType<Awaited<ReturnType<typeof fixture>>['read']>>;

function effectState(sheet: Sheet, entryId: Id<'characterSheetEntry'>) {
  const entry = sheet.entries.find((row) => row._id === entryId);
  if (entry?.kind !== 'spellEffect') throw new Error('Missing Spell Effect');
  return entry.state;
}
function effectView(sheet: Sheet, entryId: Id<'characterSheetEntry'>) {
  const view = sheet.calculated.spellEffects.find(
    (row) => row.entryId === entryId,
  );
  if (!view) throw new Error('Missing Spell Effect view');
  return view;
}
function swordLine(sheet: Sheet, swordId: Id<'characterSheetEntry'>) {
  return sheet.calculated.attackRoutines.find(
    (row) => row.weaponEntryId === swordId,
  )?.single[0];
}

test('a selected Spell Effect starts at its Spell’s lowest legal caster level, and clearing restores it', async () => {
  const { member, owner, scope, otherScope, read, readScope, select } =
    await fixture();
  const greater = await select(
    'representative-spell-effect-greater-magic-weapon',
    'add-gmw',
  );
  const haste = await select('representative-spell-effect-haste', 'add-haste');
  const weapon = await select(
    'representative-spell-effect-magic-weapon',
    'add-mw',
  );
  const sheet = await read();
  // Sorcerer/wizard 3rd-level spells at wizard 5; the prepared Haste Spell
  // lists summoner 2nd level, castable at summoner 4.
  expect(effectState(sheet, greater).casterLevel).toBe(5);
  expect(effectState(sheet, haste).casterLevel).toBe(4);
  expect(effectState(sheet, weapon).casterLevel).toBe(1);
  expect(effectView(sheet, greater)).toMatchObject({
    defaultCasterLevel: 5,
    duration: 'temporary',
    spell: { name: 'Magic Weapon, Greater' },
    target: { itemTarget: 'weapon', status: 'missing', onItem: null },
  });
  await owner.mutation(api.characterSheet.editSheetEntry, {
    ...scope,
    entryId: greater,
    casterLevel: 12,
    operationId: 'cast-at-12',
  });
  expect(effectState(await read(), greater).casterLevel).toBe(12);
  // Another Character's sheet never reads this caster: it starts at 5 too.
  const otherGreater = await select(
    'representative-spell-effect-greater-magic-weapon',
    'other-gmw',
    otherScope,
  );
  expect(
    effectState(await readScope(otherScope), otherGreater).casterLevel,
  ).toBe(5);
  // Clearing the field restores the default.
  await member.mutation(api.characterSheet.editSheetEntry, {
    ...scope,
    entryId: greater,
    casterLevel: null,
    operationId: 'clear-cl',
  });
  expect(effectState(await read(), greater).casterLevel).toBe(5);
}, 20_000);

test('members target a weapon, its other end or a shield bash, and an untargeted effect adds nothing', async () => {
  const { member, owner, scope, read, select } = await fixture();
  const sword = await select('longsword', 'sword');
  const hammer = await select('gnome-hooked-hammer', 'hammer');
  const shield = await select('heavy-steel-shield', 'shield');
  const weapon = await select(
    'representative-spell-effect-magic-weapon',
    'add-mw',
  );
  const before = swordLine(await read(), sword);
  expect(before?.attackBonus.total).toBeDefined();
  await owner.mutation(api.characterSheet.editSheetEntry, {
    ...scope,
    entryId: weapon,
    onItem: { entry: sword },
    operationId: 'target-sword',
  });
  const targeted = await read(member);
  expect(effectState(targeted, weapon)).toEqual({
    kind: 'spellEffect',
    casterLevel: 1,
    onItem: { entry: sword },
  });
  expect(swordLine(targeted, sword)?.attackBonus.total).toBe(
    (before?.attackBonus.total ?? 0) + 1,
  );
  expect(effectView(targeted, weapon).target).toMatchObject({
    status: 'available',
    name: 'Longsword',
    onItem: { entry: sword, end: null },
  });
  // The sheet-level attack statistics never take it.
  expect(targeted.calculated.breakdowns['attack.melee']?.excluded).toEqual([
    expect.objectContaining({ entryName: 'Magic weapon' }),
  ]);
  for (const [onItem, operationId] of [
    [{ entry: hammer, end: 'otherEnd' as const }, 'target-other-end'],
    [{ entry: shield, end: 'bash' as const }, 'target-bash'],
    [{ entry: 'unarmed' as const }, 'target-unarmed'],
  ] as const) {
    await member.mutation(api.characterSheet.editSheetEntry, {
      ...scope,
      entryId: weapon,
      onItem,
      operationId,
    });
    expect(effectState(await read(), weapon).onItem).toEqual(onItem);
  }
  await member.mutation(api.characterSheet.editSheetEntry, {
    ...scope,
    entryId: weapon,
    onItem: null,
    operationId: 'clear-target',
  });
  const cleared = await read();
  expect(effectState(cleared, weapon)).toEqual({
    kind: 'spellEffect',
    casterLevel: 1,
  });
  expect(swordLine(cleared, sword)?.attackBonus.total).toBe(
    before?.attackBonus.total,
  );
  expect(effectView(cleared, weapon).target?.status).toBe('missing');
}, 20_000);

test('targeted enhancement competes with the weapon’s own, and magic vestment lands on armor', async () => {
  const { member, scope, read, select } = await fixture();
  const sword = await select('longsword', 'sword');
  await member.mutation(api.characterSheet.editEquipment, {
    ...scope,
    entryId: sword,
    enhancement: 1,
    operationId: 'plus-one',
  });
  const plusOne = swordLine(await read(), sword)?.attackBonus.total ?? 0;
  const greater = await select(
    'representative-spell-effect-greater-magic-weapon',
    'add-gmw',
  );
  await member.mutation(api.characterSheet.editSheetEntry, {
    ...scope,
    entryId: greater,
    onItem: { entry: sword },
    operationId: 'target-sword',
  });
  // CL 5: +1 doesn't beat the sword's own +1.
  expect(swordLine(await read(), sword)?.attackBonus.total).toBe(plusOne);
  await member.mutation(api.characterSheet.editSheetEntry, {
    ...scope,
    entryId: greater,
    casterLevel: 12,
    operationId: 'cl-12',
  });
  const strong = swordLine(await read(), sword);
  expect(strong?.attackBonus.total).toBe(plusOne + 2);
  expect(strong?.attackBonus.suppressed).toContainEqual(
    expect.objectContaining({ entryName: 'Longsword enhancement' }),
  );
  const shirt = await select('chain-shirt', 'shirt');
  const vestment = await select(
    'representative-spell-effect-magic-vestment',
    'add-vestment',
  );
  await member.mutation(api.characterSheet.editSheetEntry, {
    ...scope,
    entryId: vestment,
    casterLevel: 8,
    onItem: { entry: shirt },
    operationId: 'target-shirt',
  });
  const armored = await read();
  // Chain shirt +4 armor and +2 enhancement on its own leaf.
  expect(armored.calculated.breakdowns['ac.armor']?.total).toBe(6);
  expect(armored.permanentCalculated.breakdowns['ac.armor']?.total).toBe(4);
}, 20_000);

test('a removed target keeps the choice with a warning, and target writes refuse impossible targets', async () => {
  const { owner, outsider, scope, otherScope, read, select } = await fixture();
  const sword = await select('longsword', 'sword');
  const feat = await select('power-attack', 'feat');
  const weapon = await select(
    'representative-spell-effect-magic-weapon',
    'add-mw',
  );
  const strength = await select(
    'representative-spell-effect-bulls-strength',
    'add-bull',
  );
  const foreignSword = await select('longsword', 'foreign', otherScope);
  const edit = (
    entryId: Id<'characterSheetEntry'>,
    onItem: {
      entry: Id<'characterSheetEntry'> | 'unarmed';
      end?: 'otherEnd' | 'bash';
    } | null,
    identity = owner,
  ) =>
    identity.mutation(api.characterSheet.editSheetEntry, {
      ...scope,
      entryId,
      onItem,
      operationId: `edit-${String(onItem?.entry)}-${onItem?.end ?? ''}`,
    });
  await expect(edit(weapon, { entry: sword }, outsider)).rejects.toThrow();
  await expect(edit(weapon, { entry: foreignSword })).rejects.toThrow(
    'Choose an item on this sheet',
  );
  await expect(edit(weapon, { entry: feat })).rejects.toThrow(
    'Choose an item on this sheet',
  );
  await expect(edit(weapon, { entry: sword, end: 'otherEnd' })).rejects.toThrow(
    'Choose a double weapon with an available other end',
  );
  await expect(edit(weapon, { entry: sword, end: 'bash' })).rejects.toThrow(
    'Choose a shield that can bash',
  );
  await expect(
    edit(weapon, { entry: 'unarmed', end: 'otherEnd' }),
  ).rejects.toThrow('The unarmed strike has no other end or bash');
  await expect(edit(sword, { entry: sword })).rejects.toThrow(
    'Only a Spell Effect has a target',
  );
  await expect(
    owner.mutation(api.characterSheet.createSheetEntry, {
      ...scope,
      name: 'Homebrew ward',
      modifiers: [],
      detail: {
        kind: 'spellEffect',
        lastsOverOneDay: false,
        defaultCasterLevel: 1,
        spellKey: 'x'.repeat(65),
      },
      operationId: 'long-spell-key',
    }),
  ).rejects.toThrow('A Spell key must be 1 to 64 characters');
  // A Spell Effect without an item target may still record one: advisory.
  await edit(strength, { entry: sword });
  await edit(weapon, { entry: sword });
  await owner.mutation(api.characterSheet.removeSheetEntry, {
    ...scope,
    entryId: sword,
    operationId: 'remove-sword',
  });
  const removed = await read();
  expect(effectState(removed, weapon).onItem).toEqual({ entry: sword });
  expect(effectView(removed, weapon).target?.status).toBe('unavailable');
  expect(removed.calculated.warnings).toContainEqual(
    expect.objectContaining({
      check: 'spellEffectTargetUnavailable',
      subject: weapon,
    }),
  );
}, 20_000);

// A Character-owned Spell Effect naming a Spell records the default every
// read reports, so a never-edited row offers no reset (#236 "Spell Effects").
test('a Character-owned Spell Effect naming a seeded Spell records the default the sheet reports', async () => {
  const { owner, member, scope, read } = await fixture();
  // Greater magic weapon: sorcerer/wizard 3rd-level spells at wizard 5.
  const detail = {
    kind: 'spellEffect' as const,
    lastsOverOneDay: false,
    defaultCasterLevel: 1,
    spellKey: 'representative-spell-greater-magic-weapon',
  };
  const created = await owner.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Ardo’s greater magic weapon',
    modifiers: [],
    detail,
    operationId: 'create-linked-effect',
  });
  const oneOff = await member.mutation(api.catalogCopies.createOneOff, {
    ...scope,
    operationId: 'one-off-linked-effect',
    definition: {
      name: 'Borrowed greater magic weapon',
      modifiers: [],
      stacksWithItself: false,
      sources: [],
      detail,
    },
  });
  const sheet = await read();
  for (const entryId of [created, oneOff]) {
    expect(effectState(sheet, entryId).casterLevel).toBe(5);
    expect(effectView(sheet, entryId)).toMatchObject({
      casterLevel: 5,
      defaultCasterLevel: 5,
      spell: { name: 'Magic Weapon, Greater' },
    });
  }
}, 20_000);
