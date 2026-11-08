// @vitest-environment edge-runtime
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { convexTest } from 'convex-test';
import type { FunctionArgs } from 'convex/server';
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

test('favored-class edits discard deleted definitions and still reject foreign or nonclass definitions', async () => {
  const { t, owner, member, campaignId, scope } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const referencedClass = initial?.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'fighter',
  );
  if (!referencedClass) throw new Error('Missing Fighter fixture');
  await owner.mutation(api.characterSheet.editCreationSettings, {
    ...scope,
    settings: {},
    favoredClassIds: [referencedClass._id],
    operationId: 'favorite',
  });
  await t.run((ctx) => ctx.db.delete('catalogEntry', referencedClass._id));
  await member.mutation(api.characterSheet.editCreationSettings, {
    ...scope,
    settings: {},
    favoredClassIds: [referencedClass._id],
    operationId: 'clean',
  });
  const cleaned = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    cleaned?.entries.find((entry) => entry.kind === 'base')?.state,
  ).toMatchObject({ favoredClassIds: [] });
  const another = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Another',
    kind: 'pc',
    operationId: 'other',
  });
  const foreign = withSheetCatalog(
    await owner.query(api.characterSheet.read, {
      organizationId: 'org',
      characterId: another,
    }),
  );
  const foreignClass = foreign?.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'fighter',
  );
  const base = cleaned?.catalogEntries.find(
    (entry) => entry.detail.kind === 'base',
  );
  if (!foreignClass || !base) throw new Error('Missing fixture definitions');
  for (const classId of [foreignClass._id, base._id])
    await expect(
      member.mutation(api.characterSheet.editCreationSettings, {
        ...scope,
        settings: {},
        favoredClassIds: [classId],
        operationId: 'reject',
      }),
    ).rejects.toThrow('Class does not belong');
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
  ).toEqual(cleaned);
});

test('independent skill edits keep another player’s ranks in the same Class Level', async () => {
  const { owner, member, scope, level, fighter } = await fixture();
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: fighter._id,
    operationId: 'class',
  });
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    skillRank: { skill: 'skill.clm', ranks: 1 },
    operationId: 'climb',
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    skillRank: { skill: 'skill.per', ranks: 1 },
    operationId: 'perception',
  });
  const sheet = withSheetCatalog(
    await member.query(api.characterSheet.read, scope),
  );
  expect(
    sheet?.entries.find((row) => row._id === level._id)?.state,
  ).toMatchObject({ skillRanks: { 'skill.clm': 1, 'skill.per': 1 } });
  expect(sheet?.calculated.breakdowns['skill.clm'].total).toBe(4);
  expect(sheet?.calculated.breakdowns['skill.per'].total).toBe(1);
});

test('whole allocations canonicalize aliases before later atomic edits', async () => {
  const { owner, member, scope, level } = await fixture();
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    skillRanks: { acr: 1, 'skill.acr': 1, per: 2 },
    operationId: 'allocation',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    saved?.entries.find((entry) => entry._id === level._id)?.state,
  ).toMatchObject({ skillRanks: { 'skill.acr': 2, 'skill.per': 2 } });
  expect(
    saved?.entries.find((entry) => entry._id === level._id)?.state,
  ).not.toHaveProperty('skillRanks.acr');
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    skillRank: { skill: 'acr', ranks: 3 },
    operationId: 'atomic',
  });
  const edited = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    edited?.entries.find((entry) => entry._id === level._id)?.state,
  ).toMatchObject({ skillRanks: { 'skill.acr': 3, 'skill.per': 2 } });
});

test('members retain row ranks and recorded alternatives, ability and proficiency choices through a move', async () => {
  const { owner, member, scope, level, fighter } = await fixture();
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: fighter._id,
    hpGained: 10,
    skillRanks: { 'skill.clm': 1, 'skill.per': 4 },
    favoredClassBonus: { choice: 'alt', note: 'One sixth of a bonus feat' },
    abilityIncrease: 'strength',
    proficiencyChoice: 'longsword',
    operationId: 'choices',
  });
  await owner.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    operationId: 'add',
  });
  await owner.mutation(api.characterSheet.moveClassLevel, {
    ...scope,
    entryId: level._id,
    position: 2,
    operationId: 'move',
  });
  const saved = withSheetCatalog(
    await member.query(api.characterSheet.read, scope),
  );
  expect(
    saved?.entries.find((entry) => entry._id === level._id)?.state,
  ).toMatchObject({
    position: 2,
    skillRanks: { 'skill.clm': 1, 'skill.per': 4 },
    favoredClassBonus: { choice: 'alt', note: 'One sixth of a bonus feat' },
    abilityIncrease: 'strength',
    proficiencyChoice: 'longsword',
  });
  expect(saved?.calculated.breakdowns['skill.clm']?.total).toBe(4);
  expect(saved?.calculated.warnings).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ check: 'skillRankCap' }),
    ]),
  );
});

test('rank writers reject unknown skill keys and structurally invalid ranks without changing the sheet', async () => {
  const { owner, member, scope, level } = await fixture();
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  for (const ranks of [
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])
    await expect(
      member.mutation(api.characterSheet.editClassLevel, {
        ...scope,
        entryId: level._id,
        skillRank: { skill: 'skill.per', ranks },
        operationId: 'invalid',
      }),
    ).rejects.toThrow();
  const invalidChanges: Pick<
    FunctionArgs<typeof api.characterSheet.editClassLevel>,
    'skillRank' | 'skillRanks'
  >[] = [
    { skillRanks: { 'skill.unknown': 1 } },
    { skillRank: { skill: 'skill.unknown', ranks: 1 } },
    {
      skillRanks: { 'skill.per': 1 },
      skillRank: { skill: 'skill.per', ranks: 2 },
    },
  ];
  for (const changes of invalidChanges)
    await expect(
      member.mutation(api.characterSheet.editClassLevel, {
        ...scope,
        entryId: level._id,
        ...changes,
        operationId: 'invalid',
      }),
    ).rejects.toThrow();
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
  ).toEqual(before);
});

test('skill choices reject outsiders, anonymous callers, another Character’s row and the production maintenance gate', async () => {
  const { t, owner, outsider, campaignId, scope, level } = await fixture();
  const changes = {
    skillRank: { skill: 'skill.per', ranks: 4 },
    proficiencyChoice: 'longsword',
  };
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  for (const caller of [t, outsider])
    await expect(
      caller.mutation(api.characterSheet.editClassLevel, {
        ...scope,
        entryId: level._id,
        ...changes,
        operationId: 'reject',
      }),
    ).rejects.toThrow();
  const another = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Another',
    kind: 'pc',
    operationId: 'another',
  });
  await expect(
    owner.mutation(api.characterSheet.editClassLevel, {
      organizationId: 'org',
      characterId: another,
      entryId: level._id,
      ...changes,
      operationId: 'cross-character',
    }),
  ).rejects.toThrow('Class Level does not belong');
  await t.run(async (ctx) => {
    const runId = await ctx.db.insert('initialMigrationRun', {
      operationId: 'migration',
      epoch: 1,
      state: 'maintenance',
      frontendBuild: 'build',
      catalogManifest: 'catalog',
      startedAt: 0,
      deadline: 60000,
    });
    await ctx.db.insert('initialMigrationControl', {
      key: 'character-sheet',
      epoch: 1,
      closed: true,
      authority: 'legacy',
      runId,
    });
  });
  await expect(
    owner.mutation(api.characterSheet.editClassLevel, {
      ...scope,
      entryId: level._id,
      ...changes,
      operationId: 'maintenance',
    }),
  ).rejects.toThrow('MAINTENANCE');
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
  ).toEqual(before);
});

test('favoring HP or ranks uses the same persisted choices and permanent Intelligence applies to every level', async () => {
  const { owner, member, scope, level, fighter } = await fixture();
  await owner.mutation(api.characterSheet.editCreationSettings, {
    ...scope,
    settings: {},
    favoredClassIds: [fighter._id],
    operationId: 'favorite',
  });
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: fighter._id,
    hpGained: 10,
    favoredClassBonus: { choice: 'hp' },
    operationId: 'hp',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated.hp,
  ).toBe(11);
  const second = await owner.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: fighter._id,
    operationId: 'second',
  });
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: second,
    hpGained: 6,
    favoredClassBonus: { choice: 'skill' },
    operationId: 'skill',
  });
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { intelligence: 14 },
    operationId: 'intelligence',
  });
  const sheet = withSheetCatalog(
    await member.query(api.characterSheet.read, scope),
  );
  expect(
    sheet?.calculated.classLevels.map((row) => row.skillRankBudget),
  ).toEqual([4, 5]);
  expect(sheet?.calculated.budgets).toMatchObject({
    kind: 'ordinary',
    intelligenceModifier: 2,
    skillRanks: 9,
  });
});

test('changing ranks prunes their obsolete warning acceptance and keeps an unrelated accepted HP warning', async () => {
  const { owner, member, scope, level, fighter } = await fixture();
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: fighter._id,
    hpGained: 0,
    skillRanks: { 'skill.per': 5 },
    operationId: 'warnings',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  for (const warning of before?.calculated.warnings ?? []) {
    if (
      warning.kind !== 'rules' ||
      !['skillRankCap', 'hpGainedBelowMinimum'].includes(warning.check)
    )
      continue;
    await owner.mutation(api.characterSheet.acceptWarning, {
      ...scope,
      check: warning.check,
      subject: warning.subject,
      fingerprint: warning.fingerprint,
      operationId: 'accept',
    });
  }
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    skillRank: { skill: 'skill.per', ranks: 4 },
    operationId: 'ranks',
  });
  const after = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(after?.acceptedWarnings.map((warning) => warning.check)).toEqual([
    'hpGainedBelowMinimum',
  ]);
  expect(
    after?.entries.find((row) => row._id === level._id)?.state,
  ).toMatchObject({ skillRanks: { 'skill.per': 4 } });
});

test('persisted active armor and shield penalties reach skill reads and inactive armor supplies no penalty', async () => {
  const { owner, member, scope, level, fighter } = await fixture();
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: fighter._id,
    skillRanks: { 'skill.clm': 1 },
    operationId: 'ranks',
  });
  const armor = await member.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Chainmail',
    modifiers: [],
    detail: {
      kind: 'item',
      consumable: false,
      armor: { slot: 'armor', armorCheckPenalty: 5 },
    },
    operationId: 'armor',
  });
  await member.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Heavy shield',
    modifiers: [],
    detail: {
      kind: 'item',
      consumable: false,
      armor: { slot: 'shield', armorCheckPenalty: 2 },
    },
    operationId: 'shield',
  });
  const armored = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    armored?.calculated.skills.find((skill) => skill.key === 'skill.clm'),
  ).toMatchObject({ armorCheckPenalty: -7 });
  expect(armored?.calculated.breakdowns['skill.clm'].total).toBe(-3);
  expect(
    armored?.calculated.skills.find((skill) => skill.key === 'skill.per')
      ?.armorCheckPenalty,
  ).toBe(0);
  await member.mutation(api.characterSheet.editSheetEntry, {
    ...scope,
    entryId: armor,
    active: false,
    operationId: 'remove-armor',
  });
  const unarmored = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    unarmored?.calculated.skills.find((skill) => skill.key === 'skill.clm'),
  ).toMatchObject({ armorCheckPenalty: -2 });
  expect(unarmored?.calculated.breakdowns['skill.clm'].total).toBe(2);
});

test('armor check penalties reject negative and nonfinite magnitudes without changing the sheet', async () => {
  const { owner, scope } = await fixture();
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  for (const armorCheckPenalty of [-1, Number.NaN, Number.POSITIVE_INFINITY])
    await expect(
      owner.mutation(api.characterSheet.createSheetEntry, {
        ...scope,
        name: 'Invalid armor',
        modifiers: [],
        detail: {
          kind: 'item',
          consumable: false,
          armor: { slot: 'armor', armorCheckPenalty },
        },
        operationId: 'invalid-armor',
      }),
    ).rejects.toThrow();
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
  ).toEqual(before);
});

test('whole allocations refuse overflow when safe alias ranks are combined', async () => {
  const { owner, scope, level } = await fixture();
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  await expect(
    owner.mutation(api.characterSheet.editClassLevel, {
      ...scope,
      entryId: level._id,
      skillRanks: { acr: Number.MAX_SAFE_INTEGER, 'skill.acr': 1 },
      operationId: 'overflow',
    }),
  ).rejects.toThrow('Skill ranks must be a safe whole number');
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
  ).toEqual(before);
});

test('schema-derived reads retain proficiency, armor, masterwork and enhancement fields', async () => {
  const { t, owner, scope, level } = await fixture();
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    proficiencyChoice: '  longsword  ',
    operationId: 'proficiency',
  });
  const entryId = await owner.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Masterwork chainmail',
    modifiers: [],
    detail: {
      kind: 'item',
      consumable: false,
      armor: { slot: 'armor', armorCheckPenalty: 5 },
    },
    operationId: 'armor',
  });
  // Gear editing is a later workflow; arrange the supported stored fields here.
  await t.run((ctx) =>
    ctx.db.patch('characterSheetEntry', entryId, {
      state: { kind: 'item', masterwork: true, enhancement: 1 },
    }),
  );
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    sheet?.entries.find((entry) => entry._id === level._id)?.state,
  ).toMatchObject({ proficiencyChoice: 'longsword' });
  expect(sheet?.entries.find((entry) => entry._id === entryId)?.state).toEqual({
    kind: 'item',
    masterwork: true,
    enhancement: 1,
  });
  expect(
    sheet?.calculated.resolvedEntries.find(({ entry }) => entry._id === entryId)
      ?.entry.state,
  ).toEqual({ kind: 'item', masterwork: true, enhancement: 1 });
  const recordedArmor = sheet?.entries.find((entry) => entry._id === entryId);
  const armorCatalogEntryId =
    recordedArmor && 'catalogEntryId' in recordedArmor
      ? recordedArmor.catalogEntryId
      : undefined;
  expect(
    sheet?.catalogEntries.find((entry) => entry._id === armorCatalogEntryId)
      ?.detail,
  ).toMatchObject({ armor: { slot: 'armor', armorCheckPenalty: 5 } });
  expect(
    sheet?.calculated.skills.find((skill) => skill.key === 'skill.clm'),
  ).toMatchObject({ armorCheckPenalty: -4 });
  expect(sheet?.calculated.breakdowns['skill.clm'].total).toBe(-4);
});

test('sheet authority refuses prepared legacy skill writes even with the current open-gate epoch', async () => {
  const { t, owner, scope, level } = await fixture();
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  await t.run(async (ctx) => {
    const runId = await ctx.db.insert('initialMigrationRun', {
      operationId: 'migration',
      epoch: 2,
      state: 'maintenance',
      frontendBuild: 'build',
      catalogManifest: 'catalog',
      startedAt: 0,
      deadline: 60000,
    });
    await ctx.db.insert('initialMigrationControl', {
      key: 'character-sheet',
      epoch: 2,
      closed: false,
      authority: 'sheet',
      runId,
    });
  });
  await expect(
    owner.mutation(api.characterSheet.editClassLevel, {
      ...scope,
      entryId: level._id,
      skillRank: { skill: 'skill.per', ranks: 1 },
      writeEpoch: 2,
      operationId: 'refused',
    }),
  ).rejects.toThrow('RELOAD_REQUIRED');
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
  ).toEqual(before);
});

test('atomic rank edits refuse unsafe sums in preserved legacy aliases', async () => {
  const { t, owner, scope, level } = await fixture();
  await t.run((ctx) =>
    ctx.db.patch('characterSheetEntry', level._id, {
      state: {
        ...level.state,
        skillRanks: { acr: Number.MAX_SAFE_INTEGER, 'skill.acr': 1 },
      },
    }),
  );
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  await expect(
    owner.mutation(api.characterSheet.editClassLevel, {
      ...scope,
      entryId: level._id,
      skillRank: { skill: 'clm', ranks: 1 },
      operationId: 'atomic-overflow',
    }),
  ).rejects.toThrow('Skill ranks must be a safe whole number');
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
  ).toEqual(before);
});
