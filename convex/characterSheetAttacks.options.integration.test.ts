// @vitest-environment edge-runtime
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
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
      name: 'Option fixture',
      description: '',
      organizationId: 'org',
      ownerId: 'owner',
      e2eFixture: {
        namespace: 'options',
        version: 1,
        workerKey: '0',
        caseKey: 'options',
        campaignKey: 'options',
      },
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'owner' });
  const member = t.withIdentity({ tokenIdentifier: 'member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Brakka',
    kind: 'pc',
    operationId: 'create',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 18 },
    operationId: 'strength',
  });
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  function definition(ruleIdentity: string) {
    const row = initial?.catalogEntries.find(
      (entry) => entry.ruleIdentity === ruleIdentity,
    );
    if (!row) throw new Error(`Missing representative ${ruleIdentity}`);
    return row._id;
  }
  const selectSword = (operationId: string) =>
    owner.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: definition('greatsword'),
      operationId,
    });
  const firstSword = await selectSword('first-sword');
  const secondSword = await selectSword('second-sword');
  let position = 0;
  const selectFeat = (ruleIdentity: string) =>
    member.mutation(api.characterSheet.fillSelectionSlot, {
      ...scope,
      slotId: 'feat:general',
      position: position++,
      catalogEntryId: definition(ruleIdentity),
      operationId: `feat-${ruleIdentity}`,
    });
  async function read(viewer = owner) {
    const sheet = withSheetCatalog(
      await viewer.query(api.characterSheet.read, scope),
    );
    if (!sheet) throw new Error('Missing sheet');
    const routineFor = (sword: Id<'characterSheetEntry'>) => {
      const entry = sheet.entries.find(
        (row) =>
          row.kind === 'attackRoutine' && row.state.weaponEntryId === sword,
      );
      if (entry?.kind !== 'attackRoutine') throw new Error('Missing routine');
      const calculated = sheet.calculated.attackRoutines.find(
        (row) => row.entryId === entry._id,
      );
      if (!calculated) throw new Error('Missing calculated routine');
      const [single] = calculated.single;
      if (!single) throw new Error('Missing single attack');
      return { entry, calculated, single };
    };
    return {
      sheet,
      first: routineFor(firstSword),
      second: routineFor(secondSword),
    };
  }
  return {
    t,
    owner,
    member,
    outsider,
    scope,
    definition,
    selectFeat,
    read,
  };
}

// CRB p. 131: at base attack bonus +0, Power Attack is −1/+2, +3 two-handed.
test('a member switches Power Attack on in one routine without changing another', async () => {
  const { owner, member, scope, definition, selectFeat, read } =
    await fixture();
  await selectFeat('power-attack');
  const { first, second } = await read();
  expect(first.calculated.options).toEqual([
    {
      catalogEntryId: definition('power-attack'),
      name: 'Power Attack',
      ruleIdentity: 'power-attack',
      switchedOn: false,
      available: true,
      applicable: true,
    },
  ]);
  await member.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: first.entry._id,
    options: [definition('power-attack'), definition('power-attack')],
    operationId: 'power-attack-on',
  });
  await owner.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: first.entry._id,
    name: 'Cleaving greatsword',
    operationId: 'rename',
  });
  const { first: changed, second: unchanged } = await read(member);
  expect(changed.entry.state).toMatchObject({
    name: 'Cleaving greatsword',
    options: [definition('power-attack')],
    revision: 2,
  });
  expect(changed.single).toMatchObject({
    attackBonus: { total: first.single.attackBonus.total - 1 },
    damageBonus: { total: first.single.damageBonus.total + 3 },
  });
  expect(changed.calculated.options.at(0)).toMatchObject({ switchedOn: true });
  expect(unchanged.entry).toEqual(second.entry);
  expect(unchanged.calculated).toEqual(second.calculated);
});

test('a routine is created with its switched-on options', async () => {
  const { owner, scope, definition, selectFeat, read } = await fixture();
  await selectFeat('vital-strike');
  const { first } = await read();
  const weaponEntryId = first.entry.state.weaponEntryId;
  const entryId = await owner.mutation(api.characterSheet.createAttackRoutine, {
    ...scope,
    weaponEntryId,
    options: [definition('vital-strike')],
    operationId: 'vital-routine',
  });
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    sheet?.calculated.attackRoutines
      .find((row) => row.entryId === entryId)
      ?.single.at(0),
  ).toMatchObject({
    damageDice: '4d6',
    vitalStrike: { multiplier: 2, weaponDice: '2d6' },
  });
});

test('switching on anything but a loaded Routine Option feat is refused', async () => {
  const { t, owner, outsider, scope, definition, selectFeat, read } =
    await fixture();
  await selectFeat('weapon-finesse');
  await selectFeat('power-attack');
  const { first } = await read();
  const entryId = first.entry._id;
  await expect(
    owner.mutation(api.characterSheet.editAttackRoutine, {
      ...scope,
      entryId,
      options: [definition('weapon-finesse')],
      operationId: 'not-an-option',
    }),
  ).rejects.toThrow('Choose a Routine Option for this routine');
  const foreign = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId: undefined,
      name: 'Foreign Power Attack',
      ruleIdentity: 'power-attack',
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: { kind: 'feat' },
    }),
  );
  await expect(
    owner.mutation(api.characterSheet.editAttackRoutine, {
      ...scope,
      entryId,
      options: [foreign],
      operationId: 'foreign-option',
    }),
  ).rejects.toThrow('reference does not belong to this Character');
  await expect(
    outsider.mutation(api.characterSheet.editAttackRoutine, {
      ...scope,
      entryId,
      options: [definition('power-attack')],
      operationId: 'outsider-option',
    }),
  ).rejects.toThrow();
  expect((await read()).first.entry.state.options).toBeUndefined();
});

test('a switched-on option outlives its feat with an advisory warning until switched off', async () => {
  const { owner, member, scope, definition, selectFeat, read } =
    await fixture();
  const powerAttack = await selectFeat('power-attack');
  const { first: routine } = await read();
  await owner.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: routine.entry._id,
    options: [definition('power-attack')],
    operationId: 'power-attack-on',
  });
  await member.mutation(api.characterSheet.clearSelectionSlot, {
    ...scope,
    entryId: powerAttack,
    operationId: 'remove-power-attack',
  });
  const removed = (await read()).first;
  expect(removed.entry.state.options).toEqual([definition('power-attack')]);
  expect(removed.calculated.single).toEqual(routine.calculated.single);
  expect(removed.calculated.warnings).toContainEqual(
    expect.objectContaining({
      check: 'missingRoutineOption',
      subject: `${routine.entry._id}:option:${definition('power-attack')}`,
      message: `Power Attack is switched on in ${routine.entry.state.name}, but the feat isn't on the sheet. It has no effect until the feat is added.`,
    }),
  );
  // Unrelated writes and resending the retained choice keep it for repair.
  await member.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: routine.entry._id,
    hands: 'two',
    options: [definition('power-attack')],
    operationId: 'keep-retained-option',
  });
  expect((await read()).first.entry.state.options).toEqual([
    definition('power-attack'),
  ]);
  await owner.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: routine.entry._id,
    options: [],
    operationId: 'switch-off',
  });
  const cleared = (await read()).first;
  expect(cleared.entry.state.options).toEqual([]);
  expect(
    cleared.calculated.warnings.filter(
      (warning) => warning.check === 'missingRoutineOption',
    ),
  ).toEqual([]);
});

// #229: switching on an option whose feat has no active Selection is
// accepted, with an advisory, so a player can prepare a routine first.
test('switching on an option before taking its feat is accepted with an advisory warning', async () => {
  const { owner, scope, definition, selectFeat, read } = await fixture();
  const { first } = await read();
  await owner.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: first.entry._id,
    options: [definition('power-attack')],
    operationId: 'power-attack-early',
  });
  const early = (await read()).first;
  expect(early.entry.state.options).toEqual([definition('power-attack')]);
  expect(early.single).toEqual(first.single);
  expect(early.calculated.warnings).toContainEqual(
    expect.objectContaining({
      check: 'missingRoutineOption',
      subject: `${first.entry._id}:option:${definition('power-attack')}`,
    }),
  );
  await selectFeat('power-attack');
  const taken = (await read()).first;
  expect(taken.single.attackBonus.total).toBe(
    first.single.attackBonus.total - 1,
  );
  expect(
    taken.calculated.warnings.filter(
      (warning) => warning.check === 'missingRoutineOption',
    ),
  ).toEqual([]);
});

// CRB p. 119: the dodge bonus is outside the routine's lines, so the sheet's
// AC keeps it in the option's Situation.
test('Combat Expertise reports its AC bonus as a conditional option Situation', async () => {
  const { owner, scope, definition, selectFeat, read } = await fixture();
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { intelligence: 13 },
    operationId: 'intelligence',
  });
  await selectFeat('combat-expertise');
  const { first, sheet: before } = await read();
  await owner.mutation(api.characterSheet.editAttackRoutine, {
    ...scope,
    entryId: first.entry._id,
    options: [definition('combat-expertise')],
    operationId: 'expertise-on',
  });
  const { sheet, first: after } = await read();
  expect(sheet.calculated.derivedStatistics.ac.total).toBe(
    before.calculated.derivedStatistics.ac.total,
  );
  expect(sheet.calculated.derivedStatistics.ac.conditional).toContainEqual(
    expect.objectContaining({
      entryName: 'Combat Expertise',
      bonusType: 'dodge',
      value: 1,
      condition: { situation: { option: definition('combat-expertise') } },
    }),
  );
  expect(after.single.attackBonus.total).toBe(
    first.single.attackBonus.total - 1,
  );
});
