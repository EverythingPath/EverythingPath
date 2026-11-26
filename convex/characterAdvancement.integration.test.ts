// @vitest-environment edge-runtime
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');
async function fixture() {
  const t = convexTest(schema, modules);
  const campaignId = await t.run(async (ctx) => {
    for (const person of ['owner', 'member'])
      await ctx.db.insert('user', {
        tokenIdentifier: person,
        orgIds: [{ orgId: 'org', role: 'member' }],
      });
    return ctx.db.insert('campaign', {
      name: 'Advancement',
      description: '',
      organizationId: 'org',
      ownerId: 'owner',
      e2eFixture: {
        namespace: 'advancement',
        version: 1,
        workerKey: '0',
        caseKey: 'advancement',
        campaignKey: 'advancement',
      },
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'owner' });
  const member = t.withIdentity({ tokenIdentifier: 'member' });
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
    campaignId,
    scope: { organizationId: 'org', characterId },
  };
}

test('members insert and reorder stable Class Levels with class, plain HP and row choices intact', async () => {
  const { owner, member, scope } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const first = initial?.entries.find((entry) => entry.kind === 'classLevel');
  const fighter = initial?.catalogEntries.find(
    (entry) => entry.name === 'Fighter',
  );
  if (!first || !fighter)
    throw new Error('Missing representative class or level');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    classEntryId: fighter._id,
    hpGained: 9,
    favoredClassBonus: { choice: 'hp' },
    abilityIncrease: 'strength',
    operationId: 'choose',
  });
  const inserted = await member.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    position: 1,
    operationId: 'insert',
  });
  const afterInsert = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    afterInsert?.entries.filter((entry) => entry.kind === 'classLevel'),
  ).toMatchObject([
    {
      _id: inserted,
      state: { position: 1, classEntryId: null, hpGained: null },
    },
    {
      _id: first._id,
      state: {
        position: 2,
        classEntryId: fighter._id,
        hpGained: 9,
        favoredClassBonus: { choice: 'hp' },
        abilityIncrease: 'strength',
      },
    },
  ]);
  await member.mutation(api.characterSheet.moveClassLevel, {
    ...scope,
    entryId: first._id,
    position: 1,
    operationId: 'move',
  });
  const moved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(moved?.entries.find((entry) => entry._id === first._id)).toMatchObject(
    {
      state: {
        position: 1,
        classEntryId: fighter._id,
        hpGained: 9,
        favoredClassBonus: { choice: 'hp' },
        abilityIncrease: 'strength',
      },
    },
  );
});

test('deleting a level closes positions and keeps externally linked selections unplaced without redating them', async () => {
  const { owner, member, scope } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const first = initial?.entries.find((entry) => entry.kind === 'classLevel');
  if (!first) throw new Error('Missing level');
  const later = await owner.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    operationId: 'later',
  });
  const selection = await member.mutation(
    api.characterSheet.createPersonalAdjustment,
    {
      ...scope,
      name: 'Choice at first level',
      modifiers: [],
      gainedAtClassLevel: first._id,
      operationId: 'choice',
    },
  );
  await member.mutation(api.characterSheet.deleteClassLevel, {
    ...scope,
    entryId: first._id,
    operationId: 'delete',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    saved?.entries.filter((entry) => entry.kind === 'classLevel'),
  ).toMatchObject([{ _id: later, state: { position: 1 } }]);
  expect(saved?.entries.find((entry) => entry._id === selection)).toMatchObject(
    { gainedAtClassLevel: first._id },
  );
});

test('new levels continue one chosen class definition; explicitly switching a copy changes all class rows together', async () => {
  const { t, owner, member, scope } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const first = initial?.entries.find((entry) => entry.kind === 'classLevel');
  const fighter = initial?.catalogEntries.find(
    (entry) => entry.name === 'Fighter',
  );
  if (!first || fighter?.detail.kind !== 'class' || !('bab' in fighter.detail))
    throw new Error('Missing Fighter');
  const detail = fighter.detail;
  const copy = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: scope.characterId,
      name: 'Fighter copy',
      ruleIdentity: fighter.ruleIdentity,
      stacksWithItself: false,
      modifiers: [],
      sources: [],
      detail: { ...detail, bab: 'half' },
    }),
  );
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    classEntryId: fighter._id,
    hpGained: 10,
    operationId: 'first',
  });
  const later = await member.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: copy,
    operationId: 'append',
  });
  const inserted = await member.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    position: 1,
    classEntryId: copy,
    operationId: 'insert',
  });
  const beforeSwitch = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    beforeSwitch?.entries
      .filter((entry) => entry.kind === 'classLevel')
      .map((entry) => entry.state.classEntryId),
  ).toEqual([fighter._id, fighter._id, fighter._id]);
  // Picking the copy on a level keeps the class's definition (#583); only
  // the explicit switch moves every level.
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: later,
    classEntryId: copy,
    operationId: 'row-pick',
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )?.entries.find((entry) => entry._id === later),
  ).toMatchObject({ state: { classEntryId: fighter._id } });
  await owner.mutation(api.characterSheet.switchClassVersion, {
    ...scope,
    entryId: later,
    classEntryId: copy,
    operationId: 'switch',
  });
  await member.mutation(api.characterSheet.moveClassLevel, {
    ...scope,
    entryId: inserted,
    position: 3,
    operationId: 'move',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    saved?.entries
      .filter((entry) => entry.kind === 'classLevel')
      .map((entry) => entry.state.classEntryId),
  ).toEqual([copy, copy, copy]);
  expect(saved?.entries.find((entry) => entry._id === first._id)).toMatchObject(
    { state: { hpGained: 10 } },
  );
  expect(saved?.calculated.derivedStatistics.bab.total).toBe(1);
});

test('class references reject other Characters, non-class entries and mismatched campaign routes on reads and writes', async () => {
  const { t, owner, member, campaignId, scope } = await fixture();
  const otherId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Other',
    kind: 'npc',
    operationId: 'other',
  });
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const other = withSheetCatalog(
    await owner.query(api.characterSheet.read, {
      organizationId: 'org',
      characterId: otherId,
    }),
  );
  const row = sheet?.entries.find((entry) => entry.kind === 'classLevel');
  const foreign = other?.catalogEntries.find(
    (entry) => entry.detail.kind === 'class',
  );
  if (!row || !sheet || !foreign) throw new Error('Missing fixtures');
  const before = sheet;
  for (const classEntryId of [foreign._id, sheet.baseScoresEntry._id]) {
    await expect(
      member.mutation(api.characterSheet.editClassLevel, {
        ...scope,
        entryId: row._id,
        classEntryId,
        operationId: 'bad',
      }),
    ).rejects.toThrow('Class does not belong');
    await expect(
      member.mutation(api.characterSheet.addClassLevel, {
        ...scope,
        classEntryId,
        operationId: 'bad',
      }),
    ).rejects.toThrow('Class does not belong');
    await expect(
      member.mutation(api.characterSheet.editCreationSettings, {
        ...scope,
        settings: {},
        favoredClassIds: [classEntryId],
        operationId: 'bad',
      }),
    ).rejects.toThrow('Class does not belong');
  }
  const wrongCampaign = await t.run((ctx) =>
    ctx.db.insert('campaign', {
      name: 'Other',
      description: '',
      organizationId: 'org',
      ownerId: 'owner',
    }),
  );
  await expect(
    member.mutation(api.characterSheet.addClassLevel, {
      ...scope,
      campaignId: wrongCampaign,
      operationId: 'bad',
    }),
  ).rejects.toThrow();
  await expect(
    t.mutation(api.characterSheet.addClassLevel, {
      ...scope,
      operationId: 'bad',
    }),
  ).rejects.toThrow();
  await expect(
    t
      .withIdentity({ tokenIdentifier: 'outsider' })
      .mutation(api.characterSheet.editClassLevel, {
        ...scope,
        entryId: row._id,
        classEntryId: foreign._id,
        operationId: 'bad',
      }),
  ).rejects.toThrow();
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
  ).toEqual(before);
  await t.run((ctx) =>
    ctx.db.patch('characterSheetEntry', row._id, {
      state: { ...row.state, classEntryId: foreign._id },
    }),
  );
  await expect(owner.query(api.characterSheet.read, scope)).rejects.toThrow(
    'Class does not belong',
  );
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, {
        organizationId: 'org',
        characterId: otherId,
      }),
    ),
  ).toEqual(other);
});

test('Class Level advancement writers retain the legacy authority gate and reject invalid positions without changing rows', async () => {
  const { t, owner, scope, campaignId } = await fixture();
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const row = sheet?.entries.find((entry) => entry.kind === 'classLevel');
  if (!row) throw new Error('Missing level');
  for (const position of [0, -1, 3, 1.5, Number.NaN])
    await expect(
      owner.mutation(api.characterSheet.addClassLevel, {
        ...scope,
        position,
        operationId: 'invalid',
      }),
    ).rejects.toThrow();
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
  ).toEqual(sheet);
  await t.run((ctx) =>
    ctx.db.patch('campaign', campaignId, { e2eFixture: undefined }),
  );
  const gatedSheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  await expect(
    owner.mutation(api.characterSheet.addClassLevel, {
      ...scope,
      operationId: 'gated',
    }),
  ).rejects.toThrow("aren't available");
  await expect(
    owner.mutation(api.characterSheet.editClassLevel, {
      ...scope,
      entryId: row._id,
      abilityIncrease: 'strength',
      operationId: 'gated',
    }),
  ).rejects.toThrow("aren't available");
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
  ).toEqual(gatedSheet);
});

test('Class Level writers prune changed rule warnings while preserving accepted choices through unrelated HP edits', async () => {
  const { owner, member, scope } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const level = initial?.entries.find((entry) => entry.kind === 'classLevel');
  const fighter = initial?.catalogEntries.find(
    (entry) => entry.name === 'Fighter',
  );
  if (!level || !fighter) throw new Error('Missing fixtures');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: fighter._id,
    abilityIncrease: 'strength',
    favoredClassBonus: { choice: 'hp' },
    operationId: 'choice',
  });
  const beforeAccept = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  for (const warning of beforeAccept?.calculated.warnings ?? []) {
    if (
      warning.kind !== 'rules' ||
      !['abilityIncreaseMilestone', 'favoredClassBonusNotFavored'].includes(
        warning.check,
      )
    )
      continue;
    await member.mutation(api.characterSheet.acceptWarning, {
      ...scope,
      check: warning.check,
      subject: warning.subject,
      fingerprint: warning.fingerprint,
      operationId: 'accept',
    });
  }
  const accepted = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(accepted?.acceptedWarnings).toHaveLength(2);
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    hpGained: 7,
    operationId: 'hp',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.acceptedWarnings,
  ).toEqual(accepted?.acceptedWarnings);
  await member.mutation(api.characterSheet.editCreationSettings, {
    ...scope,
    settings: {},
    favoredClassIds: [fighter._id],
    operationId: 'favored',
  });
  const favored = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(favored?.acceptedWarnings.map((warning) => warning.check)).toEqual([
    'abilityIncreaseMilestone',
  ]);
  for (let index = 0; index < 3; index++)
    await owner.mutation(api.characterSheet.addClassLevel, {
      ...scope,
      operationId: `append-${index}`,
    });
  await member.mutation(api.characterSheet.moveClassLevel, {
    ...scope,
    entryId: level._id,
    position: 4,
    operationId: 'milestone',
  });
  const moved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(moved?.acceptedWarnings).toEqual([]);
  expect(
    moved?.calculated.classLevels.find((row) => row.entryId === level._id)
      ?.abilityIncreaseDue,
  ).toBe(true);
});

test('prepared Class Levels persist original and Unchained class references with advisory version warnings', async () => {
  const { t, owner, scope } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const rogue = initial?.catalogEntries.find((entry) => entry.name === 'Rogue');
  const first = initial?.entries.find((entry) => entry.kind === 'classLevel');
  if (rogue?.detail.kind !== 'class' || !('bab' in rogue.detail) || !first)
    throw new Error('Missing Rogue');
  const detail = rogue.detail;
  const baseCatalogId = initial?.baseScoresEntry._id;
  if (!baseCatalogId) throw new Error('Missing base Catalog Entry');
  const unchained = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: scope.characterId,
      name: 'Unchained Rogue',
      ruleIdentity: 'unchained-rogue',
      stacksWithItself: false,
      modifiers: [],
      sources: [],
      detail: { ...detail, counterpartOf: rogue._id },
    }),
  );
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    classEntryId: rogue._id,
    operationId: 'original',
  });
  await owner.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: unchained,
    operationId: 'unchained',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(saved?.calculated.warnings).toContainEqual(
    expect.objectContaining({
      check: 'classVersions',
      kind: 'rules',
      target: { kind: 'classLevels' },
    }),
  );
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', unchained, {
      detail: { ...detail, counterpartOf: baseCatalogId },
    }),
  );
  await expect(owner.query(api.characterSheet.read, scope)).rejects.toThrow(
    'Class counterpart does not belong',
  );
});

test('a saved adjustment condition follows whether its class is currently selected', async () => {
  const { owner, member, scope } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const fighter = initial?.catalogEntries.find(
    (entry) => entry.name === 'Fighter',
  );
  const first = initial?.entries.find((entry) => entry.kind === 'classLevel');
  if (!fighter || !first) throw new Error('Missing fixtures');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    classEntryId: fighter._id,
    operationId: 'fighter',
  });
  await member.mutation(api.characterSheet.createPersonalAdjustment, {
    ...scope,
    name: 'Fighter training',
    modifiers: [
      {
        target: 'ability.str',
        bonusType: 'untyped',
        value: 2,
        condition: { whileActive: fighter._id },
      },
    ],
    operationId: 'conditional',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated.abilities.strength.score,
  ).toBe(12);
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    classEntryId: null,
    operationId: 'unspecified',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated.abilities.strength.score,
  ).toBe(10);
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    classEntryId: fighter._id,
    operationId: 'restore',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated.abilities.strength.score,
  ).toBe(12);
});

test('accepted favored-class departures survive an unrelated favored class and alternative-note prose edits', async () => {
  const { owner, member, scope } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const fighter = initial?.catalogEntries.find(
    (entry) => entry.name === 'Fighter',
  );
  const rogue = initial?.catalogEntries.find((entry) => entry.name === 'Rogue');
  const first = initial?.entries.find((entry) => entry.kind === 'classLevel');
  if (!fighter || !rogue || !first) throw new Error('Missing fixtures');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    classEntryId: rogue._id,
    favoredClassBonus: { choice: 'alt', note: 'Extra talent' },
    operationId: 'departure',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const warning = before?.calculated.warnings.find(
    (item) => item.check === 'favoredClassBonusNotFavored',
  );
  if (!warning) throw new Error('Missing warning');
  await member.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
    operationId: 'accept',
  });
  const accepted = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  )?.acceptedWarnings;
  await member.mutation(api.characterSheet.editCreationSettings, {
    ...scope,
    settings: {},
    favoredClassIds: [fighter._id],
    operationId: 'other-class',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.acceptedWarnings,
  ).toEqual(accepted);
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    favoredClassBonus: {
      choice: 'alt',
      note: 'Extra talent from narrative reward',
    },
    operationId: 'prose',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.acceptedWarnings,
  ).toEqual(accepted);
});

test('other favored-class bonuses require nonempty notes without altering the saved level', async () => {
  const { owner, scope } = await fixture();
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const row = before?.entries.find((entry) => entry.kind === 'classLevel');
  if (!row) throw new Error('Missing Class Level');
  for (const note of ['', '   '])
    await expect(
      owner.mutation(api.characterSheet.editClassLevel, {
        ...scope,
        entryId: row._id,
        favoredClassBonus: { choice: 'alt', note },
        operationId: 'empty-other-bonus',
      }),
    ).rejects.toThrow('Describe the other favored-class bonus');
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
  ).toEqual(before);
});

test('deleted class references keep the sheet readable and unrelated level edits available', async () => {
  const { t, owner, member, scope } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const first = initial?.entries.find((entry) => entry.kind === 'classLevel');
  const fighter = initial?.catalogEntries.find(
    (entry) => entry.name === 'Fighter',
  );
  const wizard = initial?.catalogEntries.find(
    (entry) => entry.name === 'Wizard',
  );
  if (!first || !fighter || !wizard)
    throw new Error('Missing advancement fixtures');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    classEntryId: fighter._id,
    hpGained: 10,
    operationId: 'fighter',
  });
  const later = await owner.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: wizard._id,
    operationId: 'wizard',
  });
  await t.run((ctx) => ctx.db.delete('catalogEntry', fighter._id));
  const missing = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(missing?.calculated.classLevels[0]).toMatchObject({
    classEntryId: null,
    classLevel: null,
  });
  expect(missing?.calculated.warnings).toContainEqual(
    expect.objectContaining({
      check: 'class',
      target: { kind: 'classLevel', entryId: first._id, field: 'class' },
    }),
  );
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: later,
    hpGained: 6,
    operationId: 'later-hp',
  });
  await member.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: wizard._id,
    operationId: 'continue-wizard',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(saved?.entries.find((entry) => entry._id === first._id)).toMatchObject(
    { state: { classEntryId: fighter._id, hpGained: 10 } },
  );
  expect(saved?.entries.find((entry) => entry._id === later)).toMatchObject({
    state: { classEntryId: wizard._id, hpGained: 6 },
  });
  expect(saved?.calculated.level).toBe(3);
  expect(saved?.calculated.hp).toBeNull();
});
