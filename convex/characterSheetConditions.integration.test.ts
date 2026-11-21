// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { assert, expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';
import type { Id } from './_generated/dataModel';
import {
  getConditionDefinition,
  type ConditionKey,
} from '../src/lib/character-sheet-conditions';
import type { LeafTarget } from '../src/lib/character-sheet';

const modules = import.meta.glob('./**/*.ts');
async function fixture() {
  const t = convexTest(schema, modules);
  const campaignId = await t.run(async (ctx) => {
    for (const person of ['owner', 'member', 'outsider'])
      await ctx.db.insert('user', {
        tokenIdentifier: `test|${person}`,
        orgIds: [
          { orgId: person === 'outsider' ? 'other' : 'org', role: 'member' },
        ],
      });
    return ctx.db.insert('campaign', {
      name: 'CRB conditions',
      description: '',
      organizationId: 'org',
      ownerId: 'test|owner',
      e2eFixture: {
        namespace: 'conditions',
        version: 1,
        workerKey: '0',
        caseKey: 'conditions',
        campaignKey: 'conditions',
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
    campaignId,
    scope: { organizationId: 'org', campaignId, characterId },
  };
}

test('a member selects Fatigued through the existing sheet entry interface and reads canonical temporary mechanics', async () => {
  // CRB Conditions appendix: Fatigued gives -2 to Strength and Dexterity.
  const { owner, member, scope } = await fixture();
  const entryId = await member.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Fatigued',
    modifiers: [],
    detail: { kind: 'condition', conditionKey: 'fatigued' },
    operationId: 'fatigued',
  });
  const sheet = await owner.query(api.characterSheet.read, scope);
  expect(
    sheet?.catalogEntries.find((entry) => entry.name === 'Fatigued'),
  ).toMatchObject({
    ruleIdentity: 'local/crb-condition/fatigued',
    sourceKey: 'local/crb-condition/fatigued',
    sources: [{ book: 'CRB' }],
    modifiers: [
      { target: 'ability.str', bonusType: 'untyped', value: -2 },
      { target: 'ability.dex', bonusType: 'untyped', value: -2 },
    ],
    detail: { kind: 'condition', conditionKey: 'fatigued' },
  });
  expect(sheet?.calculated.abilities.strength).toEqual({
    score: 8,
    modifier: -1,
  });
  expect(sheet?.calculated.abilities.dexterity).toEqual({
    score: 8,
    modifier: -1,
  });
  expect(sheet?.permanentCalculated.abilities.strength).toEqual({
    score: 10,
    modifier: 0,
  });
  expect(sheet?.calculated.breakdowns['ability.str']?.applied).toContainEqual(
    expect.objectContaining({
      sheetEntryId: entryId,
      entryName: 'Fatigued',
      value: -2,
    }),
  );
});

type ConditionCase = {
  key: ConditionKey;
  name: string;
  changes?: Partial<typeof ordinaryTotals>;
  unmodeled?: string;
  conditional?: { target: LeafTarget; values: number[] };
};

test('Grappled penalizes ordinary combat maneuvers and exposes the grapple or escape exception', async () => {
  const { owner, member, scope } = await fixture();
  const entryId = await member.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Grappled',
    modifiers: [],
    detail: { kind: 'condition', conditionKey: 'grappled' },
    operationId: 'grappled',
  });
  const sheet = await owner.query(api.characterSheet.read, scope);
  expect(sheet?.calculated.derivedStatistics.cmb.total).toBe(-2);
  expect(sheet?.calculated.breakdowns.cmb?.applied).toContainEqual(
    expect.objectContaining({ sheetEntryId: entryId, value: -2 }),
  );
  expect(sheet?.calculated.breakdowns.cmb?.conditional).toContainEqual(
    expect.objectContaining({
      sheetEntryId: entryId,
      value: 2,
      condition: { situation: 'grapple-or-escape' },
    }),
  );
  expect(sheet?.permanentCalculated.derivedStatistics.cmb.total).toBe(0);
});
const ordinaryTotals = {
  strength: 16,
  dexterity: 14,
  ac: 12,
  initiative: 2,
  melee: 0,
  ranged: 0,
  will: 0,
  perception: 0,
  damage: 0,
};
// Independent worked cases from the agreed CRB corpus. Unspecified values retain
// the ordinary sheet, including non-sheet quantities whose count is not recorded.
const conditionCases: ConditionCase[] = [
  { key: 'bleed', name: 'Bleed', unmodeled: 'Per-turn' },
  {
    key: 'blinded',
    name: 'Blinded',
    changes: { ac: 8 },
    unmodeled: 'most Strength',
    conditional: { target: 'skill.per', values: [-4] },
  },
  { key: 'broken', name: 'Broken', unmodeled: 'Item-scoped' },
  { key: 'confused', name: 'Confused', unmodeled: '1d8' },
  { key: 'cowering', name: 'Cowering', changes: { ac: 8 } },
  { key: 'dazed', name: 'Dazed' },
  {
    key: 'dazzled',
    name: 'Dazzled',
    changes: { melee: -1, ranged: -1 },
    conditional: { target: 'skill.per', values: [-1] },
  },
  { key: 'dead', name: 'Dead', unmodeled: 'Death thresholds' },
  {
    key: 'deafened',
    name: 'Deafened',
    changes: { initiative: -2 },
    unmodeled: '20%',
    conditional: { target: 'skill.per', values: [-4] },
  },
  { key: 'disabled', name: 'Disabled', unmodeled: 'Half speed' },
  { key: 'dying', name: 'Dying', unmodeled: 'stabilization' },
  {
    key: 'energy-drained',
    name: 'Energy Drained',
    unmodeled: 'Negative-level count',
  },
  {
    key: 'entangled',
    name: 'Entangled',
    changes: { dexterity: 10, ac: 10, initiative: 0, melee: -2, ranged: -2 },
    unmodeled: 'concentration DC 15',
  },
  {
    key: 'exhausted',
    name: 'Exhausted',
    changes: { strength: 10, dexterity: 8, ac: 9, initiative: -1 },
    unmodeled: 'Half speed',
  },
  {
    key: 'fascinated',
    name: 'Fascinated',
    conditional: { target: 'skill.per', values: [-4] },
  },
  {
    key: 'fatigued',
    name: 'Fatigued',
    changes: { strength: 14, dexterity: 12, ac: 11, initiative: 1 },
    unmodeled: '8 hours',
  },
  { key: 'flat-footed', name: 'Flat-Footed', changes: { ac: 10 } },
  {
    key: 'frightened',
    name: 'Frightened',
    changes: { melee: -2, ranged: -2, will: -2, perception: -2 },
    unmodeled: 'ability checks',
  },
  {
    key: 'grappled',
    name: 'Grappled',
    changes: { dexterity: 10, ac: 10, initiative: 0, melee: -2, ranged: -2 },
    unmodeled: 'grappler CMB',
    conditional: { target: 'cmb', values: [2] },
  },
  { key: 'helpless', name: 'Helpless', unmodeled: 'Dexterity 0' },
  { key: 'incorporeal', name: 'Incorporeal', unmodeled: 'half damage' },
  {
    key: 'invisible',
    name: 'Invisible',
    unmodeled: 'concealment',
    conditional: { target: 'attack.melee', values: [2] },
  },
  { key: 'nauseated', name: 'Nauseated' },
  {
    key: 'panicked',
    name: 'Panicked',
    // CRB Fear section: panicked characters are also shaken (#725).
    changes: { melee: -2, ranged: -2, will: -2, perception: -2 },
    unmodeled: 'ability checks',
  },
  { key: 'paralyzed', name: 'Paralyzed', unmodeled: 'Strength 0' },
  { key: 'petrified', name: 'Petrified', unmodeled: 'Statue damage' },
  {
    key: 'pinned',
    name: 'Pinned',
    changes: { ac: 6 },
    unmodeled: 'grappler CMB',
    conditional: { target: 'cmd', values: [2] },
  },
  {
    key: 'prone',
    name: 'Prone',
    changes: { melee: -4 },
    conditional: { target: 'ac.other', values: [4, -4] },
  },
  {
    key: 'shaken',
    name: 'Shaken',
    changes: { melee: -2, ranged: -2, will: -2, perception: -2 },
    unmodeled: 'ability checks',
  },
  {
    key: 'sickened',
    name: 'Sickened',
    changes: { melee: -2, ranged: -2, will: -2, perception: -2, damage: -2 },
    unmodeled: 'ability checks',
  },
  { key: 'stable', name: 'Stable', unmodeled: 'Hourly DC 10' },
  { key: 'staggered', name: 'Staggered', unmodeled: 'Nonlethal damage' },
  { key: 'stunned', name: 'Stunned', changes: { ac: 8 } },
  { key: 'unconscious', name: 'Unconscious', unmodeled: 'Dexterity 0' },
];

test.each(conditionCases)(
  '$name persists its numeric effects, notes and honest limits while permanent values stay unchanged',
  async ({ key, name, changes, unmodeled, conditional }) => {
    const { owner, member, scope } = await fixture();
    await owner.mutation(api.characterSheet.editBaseScores, {
      ...scope,
      scores: { strength: 16, dexterity: 14 },
      operationId: 'base',
    });
    const entryId = await member.mutation(api.characterSheet.createSheetEntry, {
      ...scope,
      name,
      modifiers: [],
      detail: { kind: 'condition', conditionKey: key },
      operationId: key,
    });
    const sheet = await owner.query(api.characterSheet.read, scope);
    if (!sheet) throw new Error('Missing sheet');
    const totals = (
      calculated: Omit<typeof sheet.calculated, 'resolvedEntries'>,
    ) => ({
      strength: calculated.abilities.strength.score,
      dexterity: calculated.abilities.dexterity.score,
      ac: calculated.derivedStatistics.ac.total,
      initiative: calculated.derivedStatistics.initiative.total,
      melee: calculated.breakdowns['attack.melee']?.total,
      ranged: calculated.breakdowns['attack.ranged']?.total,
      will: calculated.derivedStatistics.will.total,
      perception: calculated.breakdowns['skill.per']?.total,
      damage: calculated.breakdowns['damage.melee']?.total,
    });
    expect(totals(sheet.calculated)).toEqual({ ...ordinaryTotals, ...changes });
    expect(totals(sheet.permanentCalculated)).toEqual(ordinaryTotals);
    const effect = sheet.calculated.conditionEffects.find(
      (row) => row.sheetEntryId === entryId,
    );
    expect(effect).toMatchObject({
      conditionKey: key,
      name,
      notes: expect.arrayContaining([expect.any(String)]),
    });
    if (unmodeled)
      expect(effect?.unmodeled).toContainEqual(
        expect.stringContaining(unmodeled),
      );
    else expect(effect?.unmodeled).toEqual([]);
    expect(sheet.permanentCalculated.conditionEffects).toEqual([]);
    if (conditional)
      expect(
        sheet.calculated.breakdowns[conditional.target]?.conditional
          .filter((modifier) => modifier.sheetEntryId === entryId)
          .map((modifier) => modifier.value),
      ).toEqual(conditional.values);
    const row = sheet.entries.find((entry) => entry._id === entryId);
    expect(
      sheet.catalogEntries.find(
        (catalog) =>
          catalog._id ===
          (row && 'catalogEntryId' in row ? row.catalogEntryId : null),
      ),
    ).toMatchObject({
      name,
      ruleIdentity: `local/crb-condition/${key}`,
      sourceKey: `local/crb-condition/${key}`,
      sources: [{ book: 'CRB' }],
      detail: { kind: 'condition', conditionKey: key },
    });
  },
);

test('canonical condition mechanics reject conflicting edits until a member explicitly detaches a custom condition', async () => {
  const { owner, member, scope } = await fixture();
  const entryId = await owner.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Fatigued',
    modifiers: [],
    detail: { kind: 'condition', conditionKey: 'fatigued' },
    operationId: 'fatigued',
  });
  const before = await owner.query(api.characterSheet.read, scope);
  await expect(
    member.mutation(api.characterSheet.editSheetEntry, {
      ...scope,
      entryId,
      modifiers: [],
      operationId: 'erase',
    }),
  ).rejects.toThrow('canonical Modifiers');
  await expect(
    member.mutation(api.characterSheet.editSheetEntry, {
      ...scope,
      entryId,
      name: 'Custom fatigue',
      operationId: 'rename',
    }),
  ).rejects.toThrow('canonical name');
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
  await member.mutation(api.characterSheet.editSheetEntry, {
    ...scope,
    entryId,
    detail: { kind: 'condition' },
    name: 'Custom fatigue',
    modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: -1 }],
    operationId: 'detach',
  });
  const sheet = await owner.query(api.characterSheet.read, scope);
  const entry = sheet?.entries.find((row) => row._id === entryId);
  expect(
    sheet?.catalogEntries.find(
      (row) =>
        row._id ===
        (entry && 'catalogEntryId' in entry ? entry.catalogEntryId : null),
    ),
  ).toMatchObject({
    name: 'Custom fatigue',
    detail: { kind: 'condition' },
    sources: [],
    ruleIdentity: expect.stringContaining('sheetEntry:'),
  });
  expect(sheet?.calculated.abilities.strength.score).toBe(9);
  expect(sheet?.calculated.abilities.dexterity.score).toBe(10);
  expect(sheet?.permanentCalculated.abilities.strength.score).toBe(10);
});

// Persists the conditions, in order, on a Str 16 / Dex 14 Character.
async function persistConditions(keys: ConditionKey[]) {
  const fixtureResult = await fixture();
  const { owner, member, scope } = fixtureResult;
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 16, dexterity: 14 },
    operationId: 'base',
  });
  const entryIds: Id<'characterSheetEntry'>[] = [];
  for (const key of keys)
    entryIds.push(
      await member.mutation(api.characterSheet.createSheetEntry, {
        ...scope,
        name: getConditionDefinition(key).name,
        modifiers: [],
        detail: { kind: 'condition', conditionKey: key },
        operationId: `${key}-${entryIds.length}`,
      }),
    );
  const sheet = await owner.query(api.characterSheet.read, scope);
  assert(sheet, 'Missing sheet');
  return { ...fixtureResult, sheet, entryIds };
}

test.each([
  {
    keys: ['fatigued', 'exhausted'],
    strength: 10,
    dexterity: 8,
    ac: 9,
    melee: 0,
    will: 0,
    replaced: 'fatigued',
  },
  {
    keys: ['grappled', 'pinned'],
    strength: 16,
    dexterity: 14,
    ac: 6,
    melee: 0,
    will: 0,
    replaced: 'grappled',
  },
  {
    keys: ['shaken', 'frightened', 'panicked'],
    strength: 16,
    dexterity: 14,
    ac: 12,
    melee: -2,
    will: -2,
    replaced: 'shaken',
  },
] satisfies {
  keys: ConditionKey[];
  strength: number;
  dexterity: number;
  ac: number;
  melee: number;
  will: number;
  replaced: ConditionKey;
}[])(
  '$keys resolve escalation by replacement while preserving every selected row',
  async ({ keys, strength, dexterity, ac, melee, will, replaced }) => {
    const { owner, member, scope, sheet, entryIds } =
      await persistConditions(keys);
    expect(sheet?.calculated.abilities.strength.score).toBe(strength);
    expect(sheet?.calculated.abilities.dexterity.score).toBe(dexterity);
    expect(sheet?.calculated.derivedStatistics.ac.total).toBe(ac);
    expect(sheet?.calculated.breakdowns['attack.melee']?.total).toBe(melee);
    expect(sheet?.calculated.derivedStatistics.will.total).toBe(will);
    expect(
      sheet?.entries
        .filter((entry) => entry.kind === 'condition')
        .map((entry) => entry._id),
    ).toEqual(entryIds);
    expect(
      sheet?.calculated.conditionEffects.find(
        (effect) => effect.conditionKey === replaced,
      ),
    ).toMatchObject({ replacedBy: expect.any(String) });
    const lastEntryId = entryIds.at(-1);
    assert(lastEntryId !== undefined, 'Missing condition entry');
    await member.mutation(api.characterSheet.editSheetEntry, {
      ...scope,
      entryId: lastEntryId,
      active: false,
      operationId: 'undo-escalation',
    });
    const restored = await owner.query(api.characterSheet.read, scope);
    expect(
      restored?.calculated.conditionEffects.find((effect) => !effect.replacedBy)
        ?.conditionKey,
    ).toBe(keys.length === 3 ? 'panicked' : replaced);
  },
);

test('Shaken escalated by Frightened persists as Panicked with one set of Shaken penalties', async () => {
  // CRB Fear section: shaken + frightened -> panicked; panicked characters
  // are also shaken, and the -2 does not repeat (#725).
  const { sheet, entryIds } = await persistConditions(['shaken', 'frightened']);
  expect(sheet.calculated.breakdowns['attack.melee']?.total).toBe(-2);
  expect(sheet.calculated.breakdowns['attack.ranged']?.total).toBe(-2);
  expect(sheet.calculated.derivedStatistics.will.total).toBe(-2);
  expect(sheet.calculated.breakdowns['skill.per']?.total).toBe(-2);
  expect(sheet.calculated.conditionEffects).toEqual([
    expect.objectContaining({
      sheetEntryId: entryIds[0],
      conditionKey: 'panicked',
      unmodeled: [expect.stringContaining('ability checks')],
    }),
    expect.objectContaining({
      sheetEntryId: entryIds[1],
      replacedBy: entryIds[0],
    }),
  ]);
  expect(sheet.permanentCalculated.breakdowns['attack.melee']?.total).toBe(0);
});

test.each([
  {
    restraint: 'pinned',
    reason:
      'While pinned, invisibility grants only +2 CMD to avoid being grappled.',
    dexterity: 14,
    ac: 6,
    melee: 0,
    cmd: 11,
  },
  {
    restraint: 'grappled',
    reason:
      'While grappled, invisibility grants only +2 CMD to avoid being grappled.',
    dexterity: 10,
    ac: 10,
    melee: -2,
    cmd: 13,
  },
] satisfies {
  restraint: ConditionKey;
  reason: string;
  dexterity: number;
  ac: number;
  melee: number;
  cmd: number;
}[])(
  'an invisible $restraint creature keeps only the selectable +2 CMD from invisibility',
  async ({ restraint, reason, dexterity, ac, melee, cmd }) => {
    // CRB Grappled: an invisible grappled creature gains +2 circumstance CMD
    // against being grappled and no other benefit; Pinned keeps it (#725).
    const { sheet, entryIds } = await persistConditions([
      'invisible',
      restraint,
    ]);
    const [invisibleId, restraintId] = entryIds;
    expect(sheet.calculated.abilities.dexterity.score).toBe(dexterity);
    expect(sheet.calculated.derivedStatistics.ac.total).toBe(ac);
    expect(sheet.calculated.breakdowns['attack.melee']?.total).toBe(melee);
    expect(
      sheet.calculated.conditionEffects.find(
        (effect) => effect.sheetEntryId === invisibleId,
      )?.notes,
    ).toContain(reason);
    // CMD 10 + Str +3 + Dex (+2, or +0 at Grappled's Dex 10). Pinned's −4 AC
    // also applies to CMD (CRB combat: AC penalties apply to CMD); its denied
    // Dexterity applies to AC only.
    expect(sheet.calculated.derivedStatistics.cmd.total).toBe(cmd);
    expect(sheet.calculated.breakdowns.cmd?.conditional).toEqual([
      expect.objectContaining({
        sheetEntryId: restraintId,
        value: 2,
        condition: { situation: 'grapple-while-invisible' },
      }),
    ]);
  },
);

test('duplicate conditions share a Source while different untyped penalties stack and shared edits remove only their own contribution', async () => {
  const { owner, member, scope } = await fixture();
  const first = await owner.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Dazzled',
    modifiers: [],
    detail: { kind: 'condition', conditionKey: 'dazzled' },
    operationId: 'first',
  });
  const duplicate = await member.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Dazzled',
    modifiers: [],
    detail: { kind: 'condition', conditionKey: 'dazzled' },
    operationId: 'duplicate',
  });
  const sickened = await member.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Sickened',
    modifiers: [],
    detail: { kind: 'condition', conditionKey: 'sickened' },
    operationId: 'sickened',
  });
  const sheet = await owner.query(api.characterSheet.read, scope);
  expect(sheet?.calculated.breakdowns['attack.melee']?.total).toBe(-3);
  expect(sheet?.calculated.breakdowns['attack.melee']?.applied).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        source: 'local/crb-condition/dazzled',
        value: -1,
      }),
      expect.objectContaining({
        source: 'local/crb-condition/sickened',
        value: -2,
      }),
    ]),
  );
  expect(
    sheet?.calculated.breakdowns['attack.melee']?.suppressed,
  ).toContainEqual(
    expect.objectContaining({ sheetEntryId: duplicate, value: -1 }),
  );
  await member.mutation(api.characterSheet.editSheetEntry, {
    ...scope,
    entryId: first,
    active: false,
    operationId: 'first-off',
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.calculated.breakdowns[
      'attack.melee'
    ]?.total,
  ).toBe(-3);
  await owner.mutation(api.characterSheet.removeSheetEntry, {
    ...scope,
    entryId: sickened,
    operationId: 'remove-sickened',
  });
  const remaining = await member.query(api.characterSheet.read, scope);
  expect(remaining?.calculated.breakdowns['attack.melee']?.total).toBe(-1);
  expect(
    remaining?.calculated.conditionEffects.map((effect) => effect.sheetEntryId),
  ).toEqual([duplicate]);
  expect(remaining?.permanentCalculated.breakdowns['attack.melee']?.total).toBe(
    0,
  );
});

test('curated create and edit refuse caller mechanics and a key change selects the new canonical definition', async () => {
  const { owner, member, scope } = await fixture();
  const entryId = await owner.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Fatigued',
    detail: { kind: 'condition', conditionKey: 'fatigued' },
    modifiers: [
      { target: 'ability.str', bonusType: 'untyped', value: -2 },
      { target: 'ability.dex', bonusType: 'untyped', value: -2 },
    ],
    operationId: 'canonical',
  });
  const before = await owner.query(api.characterSheet.read, scope);
  for (const name of ['Fatigued', 'Strength blessing'])
    await expect(
      member.mutation(api.characterSheet.createSheetEntry, {
        ...scope,
        name,
        detail: { kind: 'condition', conditionKey: 'fatigued' },
        modifiers: [
          { target: 'ability.str', bonusType: 'untyped', value: 100 },
        ],
        operationId: 'conflict',
      }),
    ).rejects.toThrow('canonical');
  await expect(
    member.mutation(api.characterSheet.editSheetEntry, {
      ...scope,
      entryId,
      modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 100 }],
      operationId: 'conflict',
    }),
  ).rejects.toThrow('canonical Modifiers');
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
  await member.mutation(api.characterSheet.editSheetEntry, {
    ...scope,
    entryId,
    detail: { kind: 'condition', conditionKey: 'exhausted' },
    operationId: 'exhausted',
  });
  const sheet = await owner.query(api.characterSheet.read, scope);
  expect(
    sheet?.catalogEntries.find((catalog) => catalog.name === 'Exhausted'),
  ).toMatchObject({
    detail: { kind: 'condition', conditionKey: 'exhausted' },
    ruleIdentity: 'local/crb-condition/exhausted',
    sourceKey: 'local/crb-condition/exhausted',
    sources: [{ book: 'CRB' }],
  });
  expect(sheet?.calculated.abilities.strength).toEqual({
    score: 4,
    modifier: -3,
  });
  expect(sheet?.permanentCalculated.abilities.strength).toEqual({
    score: 10,
    modifier: 0,
  });
});

test('condition ability penalties floor the score at one, preserve odd scores and explain the limit in the persisted breakdown', async () => {
  const { owner, member, scope } = await fixture();
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 15, dexterity: 3 },
    operationId: 'base',
  });
  await member.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Fatigued',
    modifiers: [],
    detail: { kind: 'condition', conditionKey: 'fatigued' },
    operationId: 'fatigued',
  });
  const entangled = await member.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Entangled',
    modifiers: [],
    detail: { kind: 'condition', conditionKey: 'entangled' },
    operationId: 'entangled',
  });
  const sheet = await owner.query(api.characterSheet.read, scope);
  expect(sheet?.calculated.abilities.strength).toEqual({
    score: 13,
    modifier: 1,
  });
  expect(sheet?.calculated.abilities.dexterity).toEqual({
    score: 1,
    modifier: -5,
  });
  expect(sheet?.calculated.breakdowns['ability.dex']?.total).toBe(1);
  expect(sheet?.calculated.breakdowns['ability.dex']?.applied).toContainEqual(
    expect.objectContaining({ sheetEntryId: entangled, value: -4 }),
  );
  expect(sheet?.permanentCalculated.abilities.dexterity).toEqual({
    score: 3,
    modifier: -4,
  });
});

test('curated condition reads and every sheet entry writer enforce membership and campaign-scoped character references', async () => {
  const { t, owner, outsider, scope } = await fixture();
  const entryId = await owner.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Fatigued',
    modifiers: [],
    detail: { kind: 'condition', conditionKey: 'fatigued' },
    operationId: 'fatigued',
  });
  const otherCampaignId = await t.run((ctx) =>
    ctx.db.insert('campaign', {
      name: 'Other campaign',
      description: '',
      organizationId: 'org',
      ownerId: 'test|owner',
      e2eFixture: {
        namespace: 'conditions',
        version: 1,
        workerKey: '0',
        caseKey: 'other',
        campaignKey: 'other',
      },
    }),
  );
  const otherCharacterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId: otherCampaignId,
    name: 'Other character',
    kind: 'pc',
    operationId: 'other',
  });
  const before = await owner.query(api.characterSheet.read, scope);
  const attempts = (caller: typeof owner | typeof t, target = scope) => [
    () => caller.query(api.characterSheet.read, target),
    () =>
      caller.mutation(api.characterSheet.createSheetEntry, {
        ...target,
        name: 'Exhausted',
        modifiers: [],
        detail: { kind: 'condition', conditionKey: 'exhausted' },
        operationId: 'blocked',
      }),
    () =>
      caller.mutation(api.characterSheet.editSheetEntry, {
        ...target,
        entryId,
        active: false,
        operationId: 'blocked',
      }),
    () =>
      caller.mutation(api.characterSheet.removeSheetEntry, {
        ...target,
        entryId,
        operationId: 'blocked',
      }),
  ];
  for (const caller of [outsider, t])
    for (const attempt of attempts(caller))
      await expect(attempt()).rejects.toThrow();
  for (const target of [
    { ...scope, campaignId: otherCampaignId },
    { ...scope, characterId: otherCharacterId },
    { ...scope, organizationId: 'other' },
  ])
    for (const attempt of attempts(owner, target))
      await expect(attempt()).rejects.toThrow();
  for (const attempt of attempts(owner, {
    ...scope,
    campaignId: otherCampaignId,
    characterId: otherCharacterId,
  }).slice(2))
    await expect(attempt()).rejects.toThrow('does not belong');
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
});
