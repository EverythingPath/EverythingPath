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
      name: 'Class versions',
      description: '',
      organizationId: 'org',
      ownerId: 'owner',
      e2eFixture: {
        namespace: 'classes',
        version: 1,
        workerKey: '0',
        caseKey: 'classes',
        campaignKey: 'classes',
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

test('switching original and Unchained versions changes every class row and retains advancement choices', async () => {
  const { owner, member, scope } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const rogue = initial!.catalogEntries.find(
    (row) => row.ruleIdentity === 'rogue',
  );
  const unchained = initial!.catalogEntries.find(
    (row) => row.ruleIdentity === 'unchained-rogue',
  );
  const first = initial!.entries.find((row) => row.kind === 'classLevel');
  if (rogue?.detail.kind !== 'class' || !first || !unchained)
    throw new Error('Missing Rogue');
  const unchainedId = unchained._id;
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    classEntryId: rogue._id,
    hpGained: 8,
    skillRanks: { 'skill.per': 1 },
    favoredClassBonus: { choice: 'hp' },
    proficiencyChoice: 'Rapier',
    operationId: 'first',
  });
  const second = await member.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: rogue._id,
    operationId: 'second',
  });
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: second,
    hpGained: 5,
    skillRanks: { 'skill.ste': 1 },
    abilityIncrease: 'dexterity',
    operationId: 'second-state',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  for (const classEntryId of [unchainedId, rogue._id]) {
    await member.mutation(api.characterSheet.switchClassVersion, {
      ...scope,
      entryId: second,
      classEntryId,
      operationId: `switch-${classEntryId}`,
    });
    const after = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    expect(after!.entries.filter((row) => row.kind === 'classLevel')).toEqual(
      before!.entries
        .filter((row) => row.kind === 'classLevel')
        .map((row) => ({
          ...row,
          state: { ...row.state, classEntryId },
        })),
    );
    await member.mutation(api.characterSheet.switchClassVersion, {
      ...scope,
      entryId: second,
      classEntryId,
      operationId: `retry-${classEntryId}`,
    });
    expect(
      withSheetCatalog(await owner.query(api.characterSheet.read, scope))!
        .revision,
    ).toBe(after!.revision);
  }
});

test('matching Grants and prompt choices survive either version while unmatched Grants become dormant and return', async () => {
  const { t, owner, member, scope } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const rogue = initial!.catalogEntries.find(
    (row) => row.ruleIdentity === 'rogue',
  );
  const unchained = initial!.catalogEntries.find(
    (row) => row.ruleIdentity === 'unchained-rogue',
  );
  const first = initial!.entries.find((row) => row.kind === 'classLevel');
  if (rogue?.detail.kind !== 'class' || !first || !unchained)
    throw new Error('Missing Rogue fixtures');
  const dodge = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: scope.characterId,
      name: 'Talent pick',
      ruleIdentity: 'talent-pick',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'feat' },
    }),
  );
  const unchainedId = unchained._id;
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    classEntryId: rogue._id,
    operationId: 'rogue',
  });
  for (let level = 2; level <= 3; level++)
    await owner.mutation(api.characterSheet.addClassLevel, {
      ...scope,
      classEntryId: rogue._id,
      operationId: `level-${level}`,
    });
  const sneak = {
    source: 'rogue',
    classLevel: 1,
    entry: 'rogue-sneak-attack-1',
  };
  const traps = { source: 'rogue', classLevel: 3, entry: 'rogue-trap-sense-3' };
  const talent = { source: 'rogue', classLevel: 2, entry: 'rogue-talent-2' };
  for (const [grantKey, notes] of [
    [sneak, 'Saved Sneak Attack'],
    [traps, 'Saved Trap Sense'],
  ] as const)
    await member.mutation(api.characterSheet.editGrantState, {
      ...scope,
      grantKey,
      state: { notes, choice: 'Retained choice' },
      operationId: notes,
    });
  const selectionId = await member.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: dodge,
    notes: 'Talent pick',
    selectionSource: {
      kind: 'prompt',
      source: { kind: 'grant', grantKey: talent },
      list: 'Rogue talents',
      classLevel: 2,
    },
    operationId: 'talent',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  await member.mutation(api.characterSheet.switchClassVersion, {
    ...scope,
    entryId: first._id,
    classEntryId: unchainedId,
    operationId: 'unchained',
  });
  const switched = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    switched!.calculated.resolvedEntries.find(
      (row) => 'notes' in row.entry && row.entry.notes === 'Saved Sneak Attack',
    ),
  ).toMatchObject({
    counting: true,
    dormant: false,
    entry: { state: { choice: 'Retained choice' } },
  });
  expect(
    switched!.calculated.resolvedEntries.find(
      (row) => 'notes' in row.entry && row.entry.notes === 'Saved Trap Sense',
    ),
  ).toMatchObject({ counting: false, dormant: true });
  expect(
    switched!.calculated.resolvedEntries.find(
      (row) => row.storedEntryId === selectionId,
    ),
  ).toMatchObject({ counting: true, dormant: false });
  expect(switched!.entries).toEqual(
    before!.entries.map((row) =>
      row.kind === 'classLevel'
        ? { ...row, state: { ...row.state, classEntryId: unchainedId } }
        : row,
    ),
  );
  const danger = {
    source: 'rogue',
    classLevel: 3,
    entry: 'unchained-rogue-danger-sense-3',
  };
  await member.mutation(api.characterSheet.editGrantState, {
    ...scope,
    grantKey: danger,
    state: { notes: 'Saved Danger Sense' },
    operationId: 'danger',
  });
  const finesseChoice = await member.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: dodge,
    notes: 'Saved Finesse Choice',
    choice: 'Rapier',
    selectionSource: {
      kind: 'prompt',
      source: {
        kind: 'grant',
        grantKey: {
          source: 'rogue',
          classLevel: 3,
          entry: 'unchained-rogue-finesse-training-3',
        },
      },
      classLevel: 3,
      list: 'Finesse weapons',
    },
    operationId: 'finesse-choice',
  });
  const weaponFinesse = initial!.catalogEntries.find(
    (row) => row.ruleIdentity === 'weapon-finesse',
  )!;
  const bonusFeat = switched!.calculated.resolvedEntries.find(
    (row) =>
      row.entry.kind === 'feat' &&
      row.entry.catalogEntryId === weaponFinesse._id,
  );
  if (bonusFeat?.entry.kind !== 'feat' || !bonusFeat.entry.grantKey)
    throw new Error('Missing Finesse Training bonus feat');
  await member.mutation(api.characterSheet.editGrantState, {
    ...scope,
    grantKey: bonusFeat.entry.grantKey,
    state: { notes: 'Saved Finesse Feat' },
    operationId: 'finesse-feat',
  });
  await owner.mutation(api.characterSheet.switchClassVersion, {
    ...scope,
    entryId: first._id,
    classEntryId: rogue._id,
    operationId: 'original',
  });
  const restored = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    restored!.entries.filter(
      (row) =>
        !('notes' in row) ||
        ![
          'Saved Danger Sense',
          'Saved Finesse Choice',
          'Saved Finesse Feat',
        ].includes(row.notes ?? ''),
    ),
  ).toEqual(before!.entries);
  expect(
    restored!.calculated.resolvedEntries.find(
      (row) => 'notes' in row.entry && row.entry.notes === 'Saved Trap Sense',
    ),
  ).toMatchObject({
    counting: true,
    dormant: false,
    entry: { state: { choice: 'Retained choice' } },
  });
  expect(
    restored!.calculated.resolvedEntries.find(
      (row) => 'notes' in row.entry && row.entry.notes === 'Saved Danger Sense',
    ),
  ).toMatchObject({ counting: false, dormant: true });
  expect(
    restored!.calculated.resolvedEntries.find(
      (row) => row.storedEntryId === finesseChoice,
    ),
  ).toMatchObject({
    counting: false,
    dormant: true,
    entry: { state: { choice: 'Rapier' } },
  });
  expect(
    restored!.calculated.resolvedEntries.find(
      (row) => 'notes' in row.entry && row.entry.notes === 'Saved Finesse Feat',
    ),
  ).toMatchObject({ counting: false, dormant: true });
  await owner.mutation(api.characterSheet.switchClassVersion, {
    ...scope,
    entryId: first._id,
    classEntryId: unchainedId,
    operationId: 'unchained-again',
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )!.calculated.resolvedEntries.find(
      (row) => 'notes' in row.entry && row.entry.notes === 'Saved Danger Sense',
    ),
  ).toMatchObject({ counting: true, dormant: false });
  const unchainedAgain = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    unchainedAgain!.calculated.resolvedEntries.find(
      (row) => row.storedEntryId === finesseChoice,
    ),
  ).toMatchObject({
    counting: true,
    dormant: false,
    entry: { state: { choice: 'Rapier' } },
  });
  expect(
    unchainedAgain!.calculated.resolvedEntries.find(
      (row) => 'notes' in row.entry && row.entry.notes === 'Saved Finesse Feat',
    ),
  ).toMatchObject({ counting: true, dormant: false });
});

test('version switches refuse unauthenticated callers, foreign references and unrelated class families without changing the sheet', async () => {
  const { t, owner, scope, campaignId } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const first = initial!.entries.find((row) => row.kind === 'classLevel')!;
  const rogue = initial!.catalogEntries.find(
    (row) => row.ruleIdentity === 'rogue',
  )!;
  const fighter = initial!.catalogEntries.find(
    (row) => row.ruleIdentity === 'fighter',
  )!;
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    classEntryId: rogue._id,
    operationId: 'rogue',
  });
  const otherCharacterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Other',
    kind: 'pc',
    operationId: 'other',
  });
  const other = withSheetCatalog(
    await owner.query(api.characterSheet.read, {
      organizationId: 'org',
      characterId: otherCharacterId,
    }),
  );
  const foreignLevel = other!.entries.find((row) => row.kind === 'classLevel')!;
  const foreignClass = other!.catalogEntries.find(
    (row) => row.ruleIdentity === 'rogue',
  )!;
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const args = {
    ...scope,
    entryId: first._id,
    classEntryId: fighter._id,
    operationId: 'switch',
  };
  await expect(
    t.mutation(api.characterSheet.switchClassVersion, args),
  ).rejects.toThrow('You do not have access');
  await expect(
    owner.mutation(api.characterSheet.switchClassVersion, args),
  ).rejects.toThrow('original or Unchained');
  await expect(
    owner.mutation(api.characterSheet.switchClassVersion, {
      ...args,
      entryId: foreignLevel._id,
    }),
  ).rejects.toThrow('Class Level does not belong');
  await expect(
    owner.mutation(api.characterSheet.switchClassVersion, {
      ...args,
      classEntryId: foreignClass._id,
    }),
  ).rejects.toThrow('Class does not belong');
  await t.run((ctx) =>
    ctx.db.insert('user', {
      tokenIdentifier: 'outsider',
      orgIds: [{ orgId: 'elsewhere', role: 'member' }],
    }),
  );
  await expect(
    t
      .withIdentity({ tokenIdentifier: 'outsider' })
      .mutation(api.characterSheet.switchClassVersion, args),
  ).rejects.toThrow();
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
  ).toEqual(before);
});

test('version switches obey maintenance, stale epochs, sheet authority and prepared campaign gates', async () => {
  const { t, owner, scope, campaignId } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const first = initial!.entries.find((row) => row.kind === 'classLevel')!;
  const rogue = initial!.catalogEntries.find(
    (row) => row.ruleIdentity === 'rogue',
  )!;
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    classEntryId: rogue._id,
    operationId: 'rogue',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const args = {
    ...scope,
    entryId: first._id,
    classEntryId: rogue._id,
    operationId: 'switch',
  };
  const controlId = await t.run(async (ctx) => {
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
  await expect(
    owner.mutation(api.characterSheet.switchClassVersion, args),
  ).rejects.toThrow('MAINTENANCE');
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, { closed: false }),
  );
  await expect(
    owner.mutation(api.characterSheet.switchClassVersion, args),
  ).rejects.toThrow('RELOAD_REQUIRED');
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, {
      epoch: 0,
      authority: 'sheet',
    }),
  );
  await expect(
    owner.mutation(api.characterSheet.switchClassVersion, args),
  ).rejects.toThrow('RELOAD_REQUIRED');
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, { authority: 'legacy' }),
  );
  await t.run((ctx) =>
    ctx.db.patch('campaign', campaignId, { e2eFixture: undefined }),
  );
  await expect(
    owner.mutation(api.characterSheet.switchClassVersion, args),
  ).rejects.toThrow("Character sheets aren't available for this campaign yet.");
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))!
      .entries,
  ).toEqual(before!.entries);
});

test('Duelist entry checks its recorded prefix before its first-level BAB and never grants favored-class entitlement', async () => {
  const { owner, member, scope } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const first = initial!.entries.find((row) => row.kind === 'classLevel')!;
  const fighter = initial!.catalogEntries.find(
    (row) => row.ruleIdentity === 'fighter',
  )!;
  const duelist = initial!.catalogEntries.find(
    (row) => row.ruleIdentity === 'duelist',
  );
  if (!duelist) throw new Error('Missing Duelist');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    classEntryId: fighter._id,
    operationId: 'fighter',
  });
  for (let level = 2; level <= 5; level++)
    await owner.mutation(api.characterSheet.addClassLevel, {
      ...scope,
      classEntryId: fighter._id,
      operationId: `fighter-${level}`,
    });
  const prestige = await member.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: duelist._id,
    operationId: 'duelist-1',
  });
  const later = await member.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: duelist._id,
    operationId: 'duelist-2',
  });
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: prestige,
    skillRanks: { 'skill.acr': 2, 'skill.prf': 2 },
    operationId: 'entry-skills',
  });
  await owner.mutation(api.characterSheet.editCreationSettings, {
    ...scope,
    settings: {},
    favoredClassIds: [duelist._id],
    operationId: 'favored',
  });
  const entered = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    entered!.calculated.prerequisites.filter(
      (check) => check.entryId === prestige && 'bab' in check.clause,
    ),
  ).toMatchObject([
    { view: 'current', met: true },
    { view: 'recorded', met: false },
  ]);
  expect(
    entered!.calculated.prerequisites.some((check) => check.entryId === later),
  ).toBe(false);
  expect(
    entered!.calculated.prerequisites.filter(
      (check) => check.entryId === prestige && 'skillRanks' in check.clause,
    ),
  ).toMatchObject([
    { view: 'current', met: true },
    { view: 'recorded', met: false },
    { view: 'current', met: true },
    { view: 'recorded', met: false },
  ]);
  expect(
    entered!.calculated.warnings.some(
      (warning) => warning.check === 'favoredClassPrestige',
    ),
  ).toBe(true);
  expect(
    entered!.calculated.warnings.filter(
      (warning) =>
        warning.check === 'favoredClassBonusMissing' &&
        [prestige, later].some((id) => warning.subject === id),
    ),
  ).toEqual([]);
  expect(
    entered!.calculated.classLevels.find((level) => level.entryId === prestige),
  ).toMatchObject({ skillRankBudget: 4 });
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: prestige,
    favoredClassBonus: { choice: 'skill' },
    operationId: 'override',
  });
  const overridden = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    overridden!.calculated.warnings.some(
      (warning) =>
        warning.check === 'favoredClassBonusNotFavored' &&
        warning.subject === prestige,
    ),
  ).toBe(true);
  expect(overridden!.entries.find((row) => row._id === prestige)).toMatchObject(
    { state: { favoredClassBonus: { choice: 'skill' } } },
  );
  await member.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: fighter._id,
    position: 6,
    operationId: 'qualifying-prefix',
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )!.calculated.prerequisites.find(
      (check) =>
        check.entryId === prestige &&
        check.view === 'recorded' &&
        'bab' in check.clause,
    ),
  ).toMatchObject({ met: true });
  await member.mutation(api.characterSheet.moveClassLevel, {
    ...scope,
    entryId: prestige,
    position: 1,
    operationId: 'move-entry',
  });
  const moved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    moved!.calculated.prerequisites.find(
      (check) =>
        check.entryId === prestige &&
        check.view === 'recorded' &&
        'bab' in check.clause,
    ),
  ).toMatchObject({ met: false });
  expect(moved!.entries.find((row) => row._id === prestige)).toMatchObject({
    state: { position: 1, classEntryId: duelist._id },
  });
});

test('Shadowdancer entry recognizes modeled prior ranks and feats while exact dance ranks remain unresolved', async () => {
  const { owner, member, scope } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const first = initial!.entries.find((row) => row.kind === 'classLevel')!;
  const rogue = initial!.catalogEntries.find(
    (row) => row.ruleIdentity === 'rogue',
  )!;
  const shadowdancer = initial!.catalogEntries.find(
    (row) => row.ruleIdentity === 'shadowdancer',
  )!;
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    classEntryId: rogue._id,
    skillRanks: { 'skill.acr': 1, 'skill.prf': 1, 'skill.ste': 1 },
    operationId: 'rogue',
  });
  for (let level = 2; level <= 5; level++) {
    const entryId = await member.mutation(api.characterSheet.addClassLevel, {
      ...scope,
      classEntryId: rogue._id,
      operationId: `level-${level}`,
    });
    await member.mutation(api.characterSheet.editClassLevel, {
      ...scope,
      entryId,
      skillRanks: {
        'skill.prf': 1,
        'skill.ste': 1,
        ...(level === 2 ? { 'skill.acr': 1 } : {}),
      },
      operationId: `ranks-${level}`,
    });
  }
  for (const ruleIdentity of ['combat-reflexes', 'dodge', 'mobility']) {
    const feat = initial!.catalogEntries.find(
      (row) => row.ruleIdentity === ruleIdentity,
    )!;
    await member.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: feat._id,
      gainedAtClassLevel: first._id,
      operationId: ruleIdentity,
    });
  }
  const prestige = await member.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: shadowdancer._id,
    operationId: 'shadowdancer',
  });
  const entered = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const checks = entered!.calculated.prerequisites.filter(
    (check) => check.entryId === prestige,
  );
  expect(checks).toHaveLength(10);
  expect(
    checks.some(
      (check) =>
        'skillRanks' in check.clause && check.clause.skillRanks === 'skill.acr',
    ),
  ).toBe(false);
  expect(
    checks.filter(
      (check) =>
        'skillRanks' in check.clause &&
        check.clause.skillRanks === 'skill.prf.dance',
    ),
  ).toMatchObject([
    { view: 'current', met: null, clause: { min: 2 } },
    { view: 'recorded', met: null, clause: { min: 2 } },
  ]);
  expect(
    checks
      .filter(
        (check) =>
          !('skillRanks' in check.clause) ||
          check.clause.skillRanks !== 'skill.prf.dance',
      )
      .every((check) => check.met === true),
  ).toBe(true);
  expect(
    entered!.calculated.resolvedEntries.some(
      (row) =>
        row.counting &&
        row.entry.kind === 'classFeature' &&
        row.entry.grantKey?.entry === 'shadowdancer-hide-in-plain-sight',
    ),
  ).toBe(true);
});

test('all four Unchained classes remain distinct, satisfy original Rogue requirements and warn on mixed versions', async () => {
  const { t, owner, member, scope } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const first = initial!.entries.find((row) => row.kind === 'classLevel')!;
  for (const family of ['barbarian', 'monk', 'summoner', 'rogue']) {
    const original = initial!.catalogEntries.find(
      (row) => row.ruleIdentity === family,
    )!;
    const unchained = initial!.catalogEntries.find(
      (row) => row.ruleIdentity === `unchained-${family}`,
    )!;
    expect(unchained.detail).toMatchObject({
      kind: 'class',
      counterpartOf: original._id,
    });
    expect(unchained._id).not.toBe(original._id);
    await owner.mutation(api.characterSheet.editClassLevel, {
      ...scope,
      entryId: first._id,
      classEntryId: original._id,
      operationId: family,
    });
    await member.mutation(api.characterSheet.switchClassVersion, {
      ...scope,
      entryId: first._id,
      classEntryId: unchained._id,
      operationId: `${family}-unchained`,
    });
  }
  const rogue = initial!.catalogEntries.find(
    (row) => row.ruleIdentity === 'rogue',
  )!;
  const unchained = initial!.catalogEntries.find(
    (row) => row.ruleIdentity === 'unchained-rogue',
  )!;
  await member.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: unchained._id,
    operationId: 'rogue-2',
  });
  const requirementId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: scope.characterId,
      name: 'Rogue requirements',
      ruleIdentity: 'rogue-requirements',
      modifiers: [],
      sources: [],
      stacksWithItself: false,
      detail: { kind: 'feat' },
      prerequisites: [
        { kind: 'classLevel', classLevel: 'rogue', min: 2 },
        {
          kind: 'classFeature',
          classFeature: 'rogue-sneak-attack-1',
          classFeatureName: 'Sneak Attack +1d6',
          classFeatureClass: 'rogue',
        },
      ],
    }),
  );
  const selection = await member.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: requirementId,
    operationId: 'requirements',
  });
  const qualified = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    qualified!.calculated.prerequisites.filter(
      (check) => check.entryId === selection,
    ),
  ).toMatchObject([{ met: true }, { met: true }]);
  await member.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: rogue._id,
    operationId: 'mixed',
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )!.calculated.warnings.some((warning) => warning.check === 'classVersions'),
  ).toBe(true);
  await member.mutation(api.characterSheet.switchClassVersion, {
    ...scope,
    entryId: first._id,
    classEntryId: unchained._id,
    operationId: 'unify',
  });
  const unified = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    unified!.calculated.warnings.some(
      (warning) => warning.check === 'classVersions',
    ),
  ).toBe(false);
  expect(
    unified!.entries
      .filter((row) => row.kind === 'classLevel')
      .map((row) => row.state.classEntryId),
  ).toEqual([unchained._id, unchained._id, unchained._id]);
});

test('original Rogue Archetypes retain matching replacements and state across switches while unmatched rows warn', async () => {
  const { t, owner, member, scope } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const first = initial!.entries.find((row) => row.kind === 'classLevel')!;
  const rogue = initial!.catalogEntries.find(
    (row) => row.ruleIdentity === 'rogue',
  )!;
  const unchained = initial!.catalogEntries.find(
    (row) => row.ruleIdentity === 'unchained-rogue',
  )!;
  const scout = initial!.catalogEntries.find(
    (row) => row.ruleIdentity === 'rogue-scout',
  )!;
  const traps = initial!.catalogEntries.find(
    (row) => row.ruleIdentity === 'rogue-trap-sense-3',
  )!;
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    classEntryId: rogue._id,
    operationId: 'rogue',
  });
  for (let level = 2; level <= 4; level++)
    await member.mutation(api.characterSheet.addClassLevel, {
      ...scope,
      classEntryId: rogue._id,
      operationId: `level-${level}`,
    });
  const unmatched = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: scope.characterId,
      name: 'Trap Sense archetype',
      ruleIdentity: 'trap-archetype',
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: {
        kind: 'archetype',
        classEntryIds: [rogue._id],
        replaces: [{ classLevel: 3, catalogEntryId: traps._id }],
        adds: [],
      },
    }),
  );
  for (const catalogEntryId of [scout._id, unmatched])
    await member.mutation(api.characterSheet.setArchetypeSelected, {
      ...scope,
      classEntryId: rogue._id,
      catalogEntryId,
      selected: true,
      operationId: `apply-${catalogEntryId}`,
    });
  await member.mutation(api.characterSheet.editGrantState, {
    ...scope,
    grantKey: {
      source: 'rogue-scout',
      classLevel: 4,
      entry: 'rogue-scout-charge',
    },
    state: { notes: 'Scout choice', choice: 'Retained tactic' },
    operationId: 'scout-state',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  await member.mutation(api.characterSheet.switchClassVersion, {
    ...scope,
    entryId: first._id,
    classEntryId: unchained._id,
    operationId: 'unchained',
  });
  const switched = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    switched!.calculated.warnings.some(
      (warning) => warning.check === 'archetypeReplacementUnmatched',
    ),
  ).toBe(true);
  expect(
    switched!.calculated.resolvedEntries.find(
      (row) => 'notes' in row.entry && row.entry.notes === 'Scout choice',
    ),
  ).toMatchObject({
    counting: true,
    dormant: false,
    entry: { state: { choice: 'Retained tactic' } },
  });
  expect(
    switched!.calculated.resolvedEntries.find(
      (row) =>
        row.entry.kind === 'classFeature' &&
        row.entry.grantKey?.entry === 'uncanny-dodge',
    ),
  ).toMatchObject({ counting: false, dormant: true });
  expect(
    switched!.calculated.resolvedEntries.find(
      (row) =>
        row.entry.kind === 'classFeature' &&
        row.entry.grantKey?.entry === 'unchained-rogue-danger-sense-3',
    ),
  ).toMatchObject({ counting: true });
  await owner.mutation(api.characterSheet.switchClassVersion, {
    ...scope,
    entryId: first._id,
    classEntryId: rogue._id,
    operationId: 'original',
  });
  const restored = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(restored!.entries).toEqual(before!.entries);
  expect(
    restored!.calculated.warnings.some(
      (warning) => warning.check === 'archetypeReplacementUnmatched',
    ),
  ).toBe(false);
});

test('an original Monk Archetype remains recorded with a compatibility warning on Unchained Monk', async () => {
  const { t, owner, member, scope } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const first = initial!.entries.find((row) => row.kind === 'classLevel')!;
  const monk = initial!.catalogEntries.find(
    (row) => row.ruleIdentity === 'monk',
  )!;
  const unchained = initial!.catalogEntries.find(
    (row) => row.ruleIdentity === 'unchained-monk',
  )!;
  const archetype = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: scope.characterId,
      name: 'Original Monk archetype',
      ruleIdentity: 'original-monk-archetype',
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: {
        kind: 'archetype',
        classEntryIds: [monk._id],
        replaces: [],
        adds: [],
      },
    }),
  );
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    classEntryId: monk._id,
    operationId: 'monk',
  });
  await member.mutation(api.characterSheet.setArchetypeSelected, {
    ...scope,
    classEntryId: monk._id,
    catalogEntryId: archetype,
    selected: true,
    operationId: 'archetype',
  });
  await member.mutation(api.characterSheet.switchClassVersion, {
    ...scope,
    entryId: first._id,
    classEntryId: unchained._id,
    operationId: 'unchained',
  });
  const switched = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    switched!.calculated.warnings.some(
      (warning) => warning.check === 'archetypeUnchainedMonk',
    ),
  ).toBe(true);
  expect(
    switched!.entries.find((row) => row.kind === 'archetype'),
  ).toMatchObject({
    active: true,
    catalogEntryId: archetype,
    state: { classEntryId: monk._id },
  });
});

test('Summoner spell choices retain their casting link across versions and return from the orphaned group', async () => {
  const { t, owner, member, scope } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const first = initial!.entries.find((row) => row.kind === 'classLevel')!;
  const summoner = initial!.catalogEntries.find(
    (row) => row.ruleIdentity === 'summoner',
  )!;
  const unchained = initial!.catalogEntries.find(
    (row) => row.ruleIdentity === 'unchained-summoner',
  )!;
  const spellId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: scope.characterId,
      name: 'Summoner spell choice',
      ruleIdentity: 'summoner-spell-choice',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'spell', levels: { summoner: 1 }, school: 'conjuration' },
    }),
  );
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    classEntryId: summoner._id,
    operationId: 'summoner',
  });
  const spellEntryId = await member.mutation(api.characterSheetSpells.record, {
    ...scope,
    castingClassId: summoner._id,
    catalogEntryId: spellId,
    operationId: 'spell',
  });
  const recorded = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  )!.entries.find((row) => row._id === spellEntryId)!;
  expect(recorded).toMatchObject({
    state: { castingClassId: summoner._id, level: 1 },
  });
  await member.mutation(api.characterSheet.switchClassVersion, {
    ...scope,
    entryId: first._id,
    classEntryId: unchained._id,
    operationId: 'unchained',
  });
  const switched = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(switched!.entries.find((row) => row._id === spellEntryId)).toEqual(
    recorded,
  );
  expect(
    switched!.calculated.spellCollections.spellsWithoutSpellcasting,
  ).toMatchObject([{ entryId: spellEntryId, spellLevel: 1 }]);
  await owner.mutation(api.characterSheet.switchClassVersion, {
    ...scope,
    entryId: first._id,
    classEntryId: summoner._id,
    operationId: 'original',
  });
  const restored = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(restored!.entries.find((row) => row._id === spellEntryId)).toEqual(
    recorded,
  );
  expect(
    restored!.calculated.spellCollections.spellsWithoutSpellcasting,
  ).toEqual([]);
  expect(
    restored!.calculated.spellCollections.collections.find(
      (collection) => collection.classEntryId === summoner._id,
    )?.spells,
  ).toMatchObject([{ entryId: spellEntryId, spellLevel: 1 }]);
});
