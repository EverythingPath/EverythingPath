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
      name: 'Archetypes',
      description: '',
      organizationId: 'org',
      ownerId: 'test|owner',
      e2eFixture: {
        namespace: 'archetypes',
        version: 1,
        workerKey: '0',
        caseKey: 'archetypes',
        campaignKey: 'archetypes',
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
  const scope = { organizationId: 'org', campaignId, characterId };
  const catalog = await t.run(async (ctx) => {
    const baseClass = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Test Fighter',
      ruleIdentity: 'test-fighter',
      stacksWithItself: false,
      modifiers: [],
      sources: [],
      detail: {
        kind: 'class',
        classKind: 'base',
        hitDie: 10,
        bab: 'full',
        saves: { fort: 'good', ref: 'poor', will: 'poor' },
        skillRanksPerLevel: 2,
        classSkills: [],
        featuresByLevel: [],
        picksByLevel: [],
      },
    });
    const original = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Bravery',
      ruleIdentity: 'test-bravery',
      stacksWithItself: false,
      modifiers: [],
      sources: [],
      detail: { kind: 'classFeature' },
    });
    const replacement = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Hawkeye',
      ruleIdentity: 'test-hawkeye',
      stacksWithItself: false,
      modifiers: [],
      sources: [],
      detail: { kind: 'classFeature' },
    });
    await ctx.db.patch('catalogEntry', baseClass, {
      detail: {
        kind: 'class',
        classKind: 'base',
        hitDie: 10,
        bab: 'full',
        saves: { fort: 'good', ref: 'poor', will: 'poor' },
        skillRanksPerLevel: 2,
        classSkills: [],
        featuresByLevel: [{ classLevel: 1, catalogEntryId: original }],
        picksByLevel: [],
      },
    });
    const archetype = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Test Archer',
      ruleIdentity: 'test-archer',
      stacksWithItself: false,
      modifiers: [],
      sources: [],
      detail: {
        kind: 'archetype',
        classEntryIds: [baseClass],
        replaces: [{ classLevel: 1, catalogEntryId: original }],
        adds: [{ classLevel: 1, catalogEntryId: replacement }],
      },
    });
    return { baseClass, original, replacement, archetype };
  });
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const level = sheet!.entries.find((entry) => entry.kind === 'classLevel');
  if (!level) throw new Error('Missing level');
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: catalog.baseClass,
    operationId: 'class',
  });
  return { t, owner, member, outsider, scope, catalog, levelId: level._id };
}

test('a campaign member applies an Archetype to its class and deactivates it without deleting its Selection', async () => {
  const { owner, member, scope, catalog } = await fixture();
  await member.mutation(api.characterSheet.setArchetypeSelected, {
    ...scope,
    classEntryId: catalog.baseClass,
    catalogEntryId: catalog.archetype,
    selected: true,
    operationId: 'apply',
  });
  const applied = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const selection = applied!.entries.find(
    (entry) => entry.kind === 'archetype',
  );
  expect(selection).toMatchObject({
    catalogEntryId: catalog.archetype,
    active: true,
  });
  expect(
    applied!.calculated.resolvedEntries.flatMap((row) =>
      row.counting && row.entry.kind === 'classFeature'
        ? [row.entry.catalogEntryId]
        : [],
    ),
  ).toEqual([catalog.replacement]);
  await member.mutation(api.characterSheet.setArchetypeSelected, {
    ...scope,
    classEntryId: catalog.baseClass,
    catalogEntryId: catalog.archetype,
    selected: false,
    operationId: 'deactivate',
  });
  const removed = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    removed!.entries.find((entry) => entry._id === selection?._id),
  ).toMatchObject({ active: false });
  expect(
    removed!.calculated.resolvedEntries.flatMap((row) =>
      row.counting && row.entry.kind === 'classFeature'
        ? [row.entry.catalogEntryId]
        : [],
    ),
  ).toEqual([catalog.original]);
  await member.mutation(api.characterSheet.setArchetypeSelected, {
    ...scope,
    classEntryId: catalog.baseClass,
    catalogEntryId: catalog.archetype,
    selected: true,
    operationId: 'restore',
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )!.entries.filter((entry) => entry.kind === 'archetype'),
  ).toEqual([{ ...selection, active: true }]);
});

test('replaced and added Grants retain choices through deactivation, reactivation and a Catalog Copy', async () => {
  const { t, owner, member, scope, catalog } = await fixture();
  const originalKey = {
    source: 'test-fighter',
    classLevel: 1,
    entry: 'test-bravery',
  };
  const replacementKey = {
    source: 'test-archer',
    classLevel: 1,
    entry: 'test-hawkeye',
  };
  await owner.mutation(api.characterSheet.editGrantState, {
    ...scope,
    grantKey: originalKey,
    state: { choice: 'original choice', notes: 'Original note' },
    operationId: 'original-state',
  });
  await member.mutation(api.characterSheet.setArchetypeSelected, {
    ...scope,
    classEntryId: catalog.baseClass,
    catalogEntryId: catalog.archetype,
    selected: true,
    operationId: 'apply',
  });
  await member.mutation(api.characterSheet.editGrantState, {
    ...scope,
    grantKey: replacementKey,
    state: { choice: 'new choice', notes: 'New note' },
    operationId: 'replacement-state',
  });
  const copyId = await t.run(async (ctx) => {
    const definition = await ctx.db.get('catalogEntry', catalog.archetype);
    if (!definition) throw new Error('Missing archetype');
    const { _id: _id, _creationTime: _creationTime, ...copy } = definition;
    return ctx.db.insert('catalogEntry', { ...copy, name: 'Copied Archer' });
  });
  await owner.mutation(api.characterSheet.setArchetypeSelected, {
    ...scope,
    classEntryId: catalog.baseClass,
    catalogEntryId: copyId,
    selected: false,
    operationId: 'copy-deactivate',
  });
  const deactivated = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    deactivated!.entries.filter((entry) => entry.kind === 'archetype'),
  ).toHaveLength(1);
  expect(
    deactivated!.calculated.resolvedEntries.find(
      (row) =>
        row.entry.kind === 'classFeature' &&
        row.entry.catalogEntryId === catalog.original,
    ),
  ).toMatchObject({
    counting: true,
    entry: { notes: 'Original note', state: { choice: 'original choice' } },
  });
  expect(
    deactivated!.calculated.resolvedEntries.find(
      (row) =>
        row.entry.kind === 'classFeature' &&
        row.entry.catalogEntryId === catalog.replacement,
    ),
  ).toMatchObject({
    counting: false,
    entry: { notes: 'New note', state: { choice: 'new choice' } },
  });
  await owner.mutation(api.characterSheet.setArchetypeSelected, {
    ...scope,
    classEntryId: catalog.baseClass,
    catalogEntryId: copyId,
    selected: true,
    operationId: 'copy-reactivate',
  });
  const restored = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    restored!.entries.find((entry) => entry.kind === 'archetype'),
  ).toMatchObject({ catalogEntryId: copyId, active: true });
  expect(
    restored!.calculated.resolvedEntries.filter(
      (row) => row.counting && row.entry.kind === 'classFeature',
    ),
  ).toHaveLength(1);
  expect(
    restored!.calculated.resolvedEntries.find(
      (row) => row.counting && row.entry.kind === 'classFeature',
    ),
  ).toMatchObject({
    entry: { notes: 'New note', state: { choice: 'new choice' } },
  });
});

test('selecting a different already-active Catalog Copy changes its benefits while retaining the Selection', async () => {
  const { t, owner, scope, catalog } = await fixture();
  await owner.mutation(api.characterSheet.setArchetypeSelected, {
    ...scope,
    classEntryId: catalog.baseClass,
    catalogEntryId: catalog.archetype,
    selected: true,
    operationId: 'apply',
  });
  const applied = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const selection = applied!.entries.find(
    (entry) => entry.kind === 'archetype',
  );
  if (!selection) throw new Error('Missing Selection');
  await owner.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selection._id,
    notes: 'Preserved copy notes',
    operationId: 'notes',
  });
  const copied = await t.run(async (ctx) => {
    const definition = await ctx.db.get('catalogEntry', catalog.archetype);
    if (definition?.detail.kind !== 'archetype')
      throw new Error('Missing archetype');
    const { _id: _id, _creationTime: _creationTime, ...copy } = definition;
    return ctx.db.insert('catalogEntry', {
      ...copy,
      name: 'Altered Archer',
      detail: { ...definition.detail, replaces: [] },
    });
  });
  await owner.mutation(api.characterSheet.setArchetypeSelected, {
    ...scope,
    classEntryId: catalog.baseClass,
    catalogEntryId: copied,
    selected: true,
    operationId: 'choose-copy',
  });
  const switched = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    switched!.entries.filter((entry) => entry.kind === 'archetype'),
  ).toHaveLength(1);
  expect(
    switched!.entries.find((entry) => entry._id === selection._id),
  ).toMatchObject({
    catalogEntryId: copied,
    active: true,
    notes: 'Preserved copy notes',
  });
  expect(
    switched!.calculated.resolvedEntries
      .flatMap((row) =>
        row.counting && row.entry.kind === 'classFeature'
          ? [row.entry.catalogEntryId]
          : [],
      )
      .sort(),
  ).toEqual([catalog.original, catalog.replacement].sort());
});

test('replacement part choices are editable overrides and conflict acceptance reopens only when relevant facts change', async () => {
  const { t, owner, member, scope, catalog, levelId } = await fixture();
  const other = await t.run(async (ctx) => {
    const definition = await ctx.db.get('catalogEntry', catalog.archetype);
    if (!definition) throw new Error('Missing archetype');
    const { _id: _id, _creationTime: _creationTime, ...copy } = definition;
    return ctx.db.insert('catalogEntry', {
      ...copy,
      name: 'Second Archetype',
      ruleIdentity: 'second-archetype',
    });
  });
  for (const catalogEntryId of [catalog.archetype, other])
    await member.mutation(api.characterSheet.setArchetypeSelected, {
      ...scope,
      classEntryId: catalog.baseClass,
      catalogEntryId,
      selected: true,
      operationId: `select-${catalogEntryId}`,
    });
  const conflictSheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const warning = conflictSheet!.calculated.warnings.find(
    (warning) => warning.check === 'archetypeConflict',
  );
  if (!warning) throw new Error('Missing conflict');
  const selection = conflictSheet!.entries.find(
    (entry) => entry.kind === 'archetype' && entry.catalogEntryId === other,
  );
  if (!selection) throw new Error('Missing selection');
  await owner.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
    operationId: 'accept',
  });
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: levelId,
    hpGained: 10,
    operationId: 'unrelated',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))!
      .acceptedWarnings,
  ).toHaveLength(1);
  await member.mutation(api.characterSheet.setArchetypePartChoices, {
    ...scope,
    entryId: selection._id,
    replacementChoices: [],
    operationId: 'resolve-conflict',
  });
  const resolved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    resolved!.entries.find((entry) => entry._id === selection._id),
  ).toMatchObject({ state: { replaces: [] } });
  expect(
    resolved!.calculated.warnings.filter(
      (warning) => warning.check === 'archetypeConflict',
    ),
  ).toHaveLength(0);
  expect(resolved!.acceptedWarnings).toHaveLength(0);
  await member.mutation(api.characterSheet.setArchetypePartChoices, {
    ...scope,
    entryId: selection._id,
    replacementChoices: null,
    operationId: 'restore-catalog',
  });
  const restored = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    restored!.calculated.warnings.filter(
      (warning) => warning.check === 'archetypeConflict',
    ),
  ).toHaveLength(1);
  expect(restored!.acceptedWarnings).toHaveLength(0);
});

test('an accepted unmatched replacement stays accepted when its omitted scope becomes explicit part', async () => {
  const { owner, member, scope, catalog } = await fixture();
  await member.mutation(api.characterSheet.setArchetypeSelected, {
    ...scope,
    classEntryId: catalog.baseClass,
    catalogEntryId: catalog.archetype,
    selected: true,
    operationId: 'apply',
  });
  const applied = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const selection = applied!.entries.find(
    (entry) => entry.kind === 'archetype',
  );
  if (!selection) throw new Error('Missing selection');
  await member.mutation(api.characterSheet.setArchetypePartChoices, {
    ...scope,
    entryId: selection._id,
    replacementChoices: [{ classLevel: 2, catalogEntryId: catalog.original }],
    operationId: 'unmatched',
  });
  const unmatched = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const warning = unmatched!.calculated.warnings.find(
    (warning) => warning.check === 'archetypeReplacementUnmatched',
  );
  if (!warning) throw new Error('Missing unmatched replacement warning');
  await owner.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
    operationId: 'accept',
  });
  const accepted = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(accepted!.acceptedWarnings).toHaveLength(1);
  await member.mutation(api.characterSheet.setArchetypePartChoices, {
    ...scope,
    entryId: selection._id,
    replacementChoices: [
      { classLevel: 2, catalogEntryId: catalog.original, scope: 'part' },
    ],
    operationId: 'explicit-part',
  });
  const changed = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    changed!.calculated.warnings.find(
      (candidate) => candidate.check === warning.check,
    ),
  ).toMatchObject({
    subject: warning.subject,
    fingerprint: warning.fingerprint,
  });
  expect(changed!.acceptedWarnings).toEqual(accepted!.acceptedWarnings);
});

test('Archetype writers reject nonmembers, foreign class/features and every legacy Character write gate', async () => {
  const { t, owner, outsider, scope, catalog } = await fixture();
  await owner.mutation(api.characterSheet.setArchetypeSelected, {
    ...scope,
    classEntryId: catalog.baseClass,
    catalogEntryId: catalog.archetype,
    selected: true,
    operationId: 'selected',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const selection = before!.entries.find((entry) => entry.kind === 'archetype');
  if (!selection) throw new Error('Missing archetype');
  function commands(caller: typeof owner, writeEpoch?: number) {
    return [
      () =>
        caller.mutation(api.characterSheet.setArchetypeSelected, {
          ...scope,
          classEntryId: catalog.baseClass,
          catalogEntryId: catalog.archetype,
          selected: false,
          operationId: 'deactivate',
          writeEpoch,
        }),
      () =>
        caller.mutation(api.characterSheet.setArchetypePartChoices, {
          ...scope,
          entryId: selection!._id,
          replacementChoices: [],
          operationId: 'choices',
          writeEpoch,
        }),
    ];
  }
  for (const caller of [t, outsider])
    for (const command of commands(caller))
      await expect(command()).rejects.toThrow();
  const otherCharacterId = await owner.mutation(api.characterSheet.create, {
    organizationId: scope.organizationId,
    campaignId: scope.campaignId,
    name: 'Other Character',
    kind: 'pc',
    operationId: 'other',
  });
  const foreign = await t.run(async (ctx) => ({
    feature: await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: otherCharacterId,
      name: 'Foreign feature',
      ruleIdentity: 'foreign-feature',
      modifiers: [],
      sources: [],
      stacksWithItself: false,
      detail: { kind: 'classFeature' },
    }),
    baseClass: await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: otherCharacterId,
      name: 'Foreign class',
      ruleIdentity: 'foreign-class',
      modifiers: [],
      sources: [],
      stacksWithItself: false,
      detail: { kind: 'class' },
    }),
  }));
  await expect(
    owner.mutation(api.characterSheet.setArchetypeSelected, {
      ...scope,
      classEntryId: foreign.baseClass,
      catalogEntryId: catalog.archetype,
      selected: false,
      operationId: 'foreign-class',
    }),
  ).rejects.toThrow('Class does not belong');
  await expect(
    owner.mutation(api.characterSheet.setArchetypePartChoices, {
      ...scope,
      entryId: selection._id,
      replacementChoices: [{ classLevel: 1, catalogEntryId: foreign.feature }],
      operationId: 'foreign-feature',
    }),
  ).rejects.toThrow('Catalog Entry does not belong');
  for (const value of [0, -1, 1.5, NaN, Infinity])
    await expect(
      owner.mutation(api.characterSheet.setArchetypePartChoices, {
        ...scope,
        entryId: selection._id,
        replacementChoices: [
          { classLevel: value, catalogEntryId: catalog.original },
        ],
        operationId: 'invalid-level',
      }),
    ).rejects.toThrow('positive whole class level');
  await expect(
    owner.mutation(api.characterSheet.setArchetypePartChoices, {
      ...scope,
      entryId: selection._id,
      replacementChoices: [
        { classLevel: 1, catalogEntryId: catalog.archetype },
      ],
      operationId: 'wrong-kind',
    }),
  ).rejects.toThrow('class feature');
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
  ).toEqual(before);
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
  for (const command of commands(owner))
    await expect(command()).rejects.toThrow('MAINTENANCE');
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, { closed: false }),
  );
  for (const command of commands(owner))
    await expect(command()).rejects.toThrow('RELOAD_REQUIRED');
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, { authority: 'sheet' }),
  );
  for (const command of commands(owner, 1))
    await expect(command()).rejects.toThrow('RELOAD_REQUIRED');
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
  ).toEqual(before);
});

test('multiple part conflicts are accepted independently and changing one part prunes only its acceptance', async () => {
  const { t, owner, member, scope, catalog } = await fixture();
  const { secondPart, others } = await t.run(async (ctx) => {
    await ctx.db.patch('catalogEntry', catalog.original, {
      detail: {
        kind: 'classFeature',
        parentFeature: 'defence',
        part: 'bravery',
      },
    });
    const secondPart = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: scope.characterId,
      name: 'Second Defence',
      ruleIdentity: 'second-defence',
      modifiers: [],
      sources: [],
      stacksWithItself: false,
      detail: {
        kind: 'classFeature',
        parentFeature: 'defence',
        part: 'second',
      },
    });
    const baseClass = await ctx.db.get('catalogEntry', catalog.baseClass);
    if (
      baseClass?.detail.kind !== 'class' ||
      !('featuresByLevel' in baseClass.detail)
    )
      throw new Error('Missing class');
    await ctx.db.patch('catalogEntry', catalog.baseClass, {
      detail: {
        ...baseClass.detail,
        featuresByLevel: [
          ...baseClass.detail.featuresByLevel,
          { classLevel: 1, catalogEntryId: secondPart },
        ],
      },
    });
    const archetype = await ctx.db.get('catalogEntry', catalog.archetype);
    if (archetype?.detail.kind !== 'archetype')
      throw new Error('Missing archetype');
    await ctx.db.patch('catalogEntry', catalog.archetype, {
      detail: {
        ...archetype.detail,
        replaces: [
          { classLevel: 1, catalogEntryId: catalog.original },
          { classLevel: 1, catalogEntryId: secondPart },
        ],
      },
    });
    const others = [];
    for (const [part, identity] of [
      [catalog.original, 'other-bravery'],
      [secondPart, 'other-second'],
    ] as const)
      others.push(
        await ctx.db.insert('catalogEntry', {
          scope: 'character',
          characterId: scope.characterId,
          name: identity,
          ruleIdentity: identity,
          modifiers: [],
          sources: [],
          stacksWithItself: false,
          detail: {
            kind: 'archetype',
            classEntryIds: [catalog.baseClass],
            replaces: [{ classLevel: 1, catalogEntryId: part }],
            adds: [],
          },
        }),
      );
    return { secondPart, others };
  });
  for (const catalogEntryId of [catalog.archetype, ...others])
    await member.mutation(api.characterSheet.setArchetypeSelected, {
      ...scope,
      classEntryId: catalog.baseClass,
      catalogEntryId,
      selected: true,
      operationId: `select-${catalogEntryId}`,
    });
  const conflicted = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const warnings = conflicted!.calculated.warnings.filter(
    (warning) => warning.check === 'archetypeConflict',
  );
  expect(warnings).toHaveLength(2);
  for (const warning of warnings)
    await member.mutation(api.characterSheet.acceptWarning, {
      ...scope,
      check: warning.check,
      subject: warning.subject,
      fingerprint: warning.fingerprint,
      operationId: 'accept',
    });
  const selection = conflicted!.entries.find(
    (entry) =>
      entry.kind === 'archetype' && entry.catalogEntryId === catalog.archetype,
  );
  if (!selection) throw new Error('Missing selection');
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selection._id,
    notes: 'Table notes',
    operationId: 'unrelated-notes',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))!
      .acceptedWarnings,
  ).toHaveLength(2);
  await member.mutation(api.characterSheet.setArchetypePartChoices, {
    ...scope,
    entryId: selection._id,
    replacementChoices: [{ classLevel: 1, catalogEntryId: secondPart }],
    operationId: 'part-change',
  });
  const changed = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    changed!.calculated.warnings.filter(
      (warning) => warning.check === 'archetypeConflict',
    ),
  ).toHaveLength(1);
  expect(changed!.acceptedWarnings).toHaveLength(1);
  expect(changed!.acceptedWarnings[0]?.fingerprint).toContain('second');
});

test('removing every Class Level makes the Archetype dormant and restoring the class restores its saved Grants once', async () => {
  const { owner, scope, catalog, levelId } = await fixture();
  await owner.mutation(api.characterSheet.setArchetypeSelected, {
    ...scope,
    classEntryId: catalog.baseClass,
    catalogEntryId: catalog.archetype,
    selected: true,
    operationId: 'apply',
  });
  const key = { source: 'test-archer', classLevel: 1, entry: 'test-hawkeye' };
  await owner.mutation(api.characterSheet.editGrantState, {
    ...scope,
    grantKey: key,
    state: { choice: 'saved target', notes: 'Retained' },
    operationId: 'state',
  });
  await owner.mutation(api.characterSheet.deleteClassLevel, {
    ...scope,
    entryId: levelId,
    operationId: 'delete-level',
  });
  const dormant = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    dormant!.calculated.warnings.some(
      (warning) => warning.check === 'archetypeClass',
    ),
  ).toBe(true);
  expect(
    dormant!.calculated.resolvedEntries.filter(
      (row) => row.counting && row.entry.kind === 'classFeature',
    ),
  ).toHaveLength(0);
  expect(
    dormant!.entries.find((entry) => entry.kind === 'archetype'),
  ).toMatchObject({ active: true });
  await owner.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: catalog.baseClass,
    operationId: 'restore-level',
  });
  const restored = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    restored!.calculated.resolvedEntries.filter(
      (row) => row.counting && row.entry.kind === 'classFeature',
    ),
  ).toHaveLength(1);
  expect(
    restored!.calculated.resolvedEntries.find(
      (row) => row.counting && row.entry.kind === 'classFeature',
    ),
  ).toMatchObject({
    entry: { notes: 'Retained', state: { choice: 'saved target' } },
  });
});

test('class-skill and rank changes follow active Archetypes and an inactive retained source supplies no benefits', async () => {
  const { t, owner, scope, catalog, levelId } = await fixture();
  await t.run(async (ctx) => {
    const definition = await ctx.db.get('catalogEntry', catalog.archetype);
    if (definition?.detail.kind !== 'archetype')
      throw new Error('Missing archetype');
    await ctx.db.patch('catalogEntry', catalog.archetype, {
      detail: {
        ...definition.detail,
        classSkillsAdded: ['skill.hea'],
        skillRanksPerLevel: 5,
      },
    });
  });
  await owner.mutation(api.characterSheet.setArchetypeSelected, {
    ...scope,
    classEntryId: catalog.baseClass,
    catalogEntryId: catalog.archetype,
    selected: true,
    operationId: 'apply',
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: levelId,
    skillRanks: { 'skill.hea': 1 },
    operationId: 'ranks',
  });
  const active = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(active!.calculated.classLevels[0]?.skillRankBudget).toBe(5);
  expect(
    active!.calculated.skills.find((skill) => skill.key === 'skill.hea')
      ?.classSkill,
  ).toBe(true);
  const selection = active!.entries.find((entry) => entry.kind === 'archetype');
  if (!selection) throw new Error('Missing selection');
  await t.run((ctx) =>
    ctx.db.patch('characterSheetEntry', selection._id, { kept: true }),
  );
  await owner.mutation(api.characterSheet.setArchetypeSelected, {
    ...scope,
    classEntryId: catalog.baseClass,
    catalogEntryId: catalog.archetype,
    selected: false,
    operationId: 'deactivate',
  });
  const deactivated = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(deactivated!.calculated.classLevels[0]?.skillRankBudget).toBe(2);
  expect(
    deactivated!.calculated.skills.find((skill) => skill.key === 'skill.hea')
      ?.classSkill,
  ).toBe(false);
  expect(
    deactivated!.entries.find((entry) => entry._id === selection._id),
  ).toMatchObject({ active: false, kept: true });
});

test('prepared examples expose complete Fighter and Rogue schedules and apply Archer across twenty Fighter levels', async () => {
  const { owner, scope, levelId } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const fighter = initial!.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'fighter',
  );
  const archer = initial!.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'fighter-archer',
  );
  const rogue = initial!.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'rogue',
  );
  if (
    fighter?.detail.kind !== 'class' ||
    !('featuresByLevel' in fighter.detail) ||
    !archer ||
    rogue?.detail.kind !== 'class' ||
    !('featuresByLevel' in rogue.detail)
  )
    throw new Error('Missing prepared examples');
  expect(fighter.detail.featuresByLevel).toHaveLength(26);
  expect(rogue.detail.featuresByLevel).toHaveLength(32);
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: levelId,
    classEntryId: fighter._id,
    operationId: 'fighter',
  });
  for (let level = 2; level <= 20; level++)
    await owner.mutation(api.characterSheet.addClassLevel, {
      ...scope,
      classEntryId: fighter._id,
      operationId: `level-${level}`,
    });
  await owner.mutation(api.characterSheet.setArchetypeSelected, {
    ...scope,
    classEntryId: fighter._id,
    catalogEntryId: archer._id,
    selected: true,
    operationId: 'archer',
  });
  const applied = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(applied!.calculated.level).toBe(20);
  expect(
    applied!.entries
      .filter((entry) => entry.kind === 'classLevel')
      .every((entry) => entry.state.classEntryId === fighter._id),
  ).toBe(true);
  const application = applied!.calculated.archetypes.classes.find(
    (entry) => entry.classEntryId === fighter._id,
  )?.archetypes[0];
  expect(
    application?.replacements
      .map((row) => [
        row.classLevel,
        applied!.catalogEntries.find(
          (entry) => entry._id === row.catalogEntryId,
        )?.ruleIdentity,
      ])
      .sort((a, b) => Number(a[0]) - Number(b[0])),
  ).toEqual([
    [2, 'fighter-bravery-2'],
    [3, 'fighter-armor-training-3'],
    [5, 'fighter-weapon-training-5'],
    [6, 'fighter-bravery-6'],
    [7, 'fighter-armor-training-7'],
    [9, 'fighter-weapon-training-9'],
    [10, 'fighter-bravery-10'],
    [11, 'fighter-armor-training-11'],
    [13, 'fighter-weapon-training-13'],
    [14, 'fighter-bravery-14'],
    [15, 'fighter-armor-training-15'],
    [17, 'fighter-weapon-training-17'],
    [18, 'fighter-bravery-18'],
    [19, 'fighter-armor-mastery'],
    [20, 'fighter-weapon-mastery'],
  ]);
  expect(
    applied!.calculated.resolvedEntries.filter(
      (row) =>
        row.counting &&
        row.origin === 'grant' &&
        row.entry.kind === 'classFeature' &&
        row.entry.grantKey?.source === 'fighter-archer',
    ),
  ).toHaveLength(20);
});

test('reads refuse a persisted replacement choice pointing at another Character’s feature', async () => {
  const { t, owner, scope, catalog } = await fixture();
  await owner.mutation(api.characterSheet.setArchetypeSelected, {
    ...scope,
    classEntryId: catalog.baseClass,
    catalogEntryId: catalog.archetype,
    selected: true,
    operationId: 'apply',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const selection = before!.entries.find((entry) => entry.kind === 'archetype');
  if (selection?.kind !== 'archetype') throw new Error('Missing selection');
  const foreignId = await owner.mutation(api.characterSheet.create, {
    name: 'Private feature source',
    kind: 'pc',
    operationId: 'private',
  });
  await t.run(async (ctx) => {
    const foreignFeature = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: foreignId,
      name: 'Private feature',
      ruleIdentity: 'private-feature',
      modifiers: [],
      sources: [],
      stacksWithItself: false,
      detail: { kind: 'classFeature' },
    });
    await ctx.db.patch('characterSheetEntry', selection._id, {
      state: {
        ...selection.state,
        replaces: [{ classLevel: 1, catalogEntryId: foreignFeature }],
      },
    });
  });
  await expect(owner.query(api.characterSheet.read, scope)).rejects.toThrow(
    'Replacement feature does not belong',
  );
});

test('a class-fit mismatch is retained on its chosen class with an advisory warning', async () => {
  const { owner, scope, catalog } = await fixture();
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const rogue = before!.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'rogue',
  );
  if (!rogue) throw new Error('Missing Rogue');
  await owner.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: rogue._id,
    operationId: 'rogue-level',
  });
  const withoutArchetype = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  await owner.mutation(api.characterSheet.setArchetypeSelected, {
    ...scope,
    classEntryId: rogue._id,
    catalogEntryId: catalog.archetype,
    selected: true,
    operationId: 'mismatch',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    saved!.entries.find((entry) => entry.kind === 'archetype'),
  ).toMatchObject({
    active: true,
    state: { kind: 'archetype', classEntryId: rogue._id },
  });
  expect(
    saved!.calculated.archetypes.warnings.some(
      (warning) => warning.check === 'archetypeClass',
    ),
  ).toBe(true);
  expect(
    saved!.calculated.resolvedEntries.flatMap((row) =>
      row.counting && row.entry.kind === 'classFeature'
        ? [row.entry.catalogEntryId]
        : [],
    ),
  ).toEqual(
    withoutArchetype!.calculated.resolvedEntries.flatMap((row) =>
      row.counting && row.entry.kind === 'classFeature'
        ? [row.entry.catalogEntryId]
        : [],
    ),
  );
});

test('deleted referenced class definitions leave saved Archetypes unavailable with retained choices', async () => {
  const { t, owner, scope, catalog } = await fixture();
  await owner.mutation(api.characterSheet.setArchetypeSelected, {
    ...scope,
    classEntryId: catalog.baseClass,
    catalogEntryId: catalog.archetype,
    selected: true,
    operationId: 'apply',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const selection = before!.entries.find((entry) => entry.kind === 'archetype');
  if (!selection) throw new Error('Missing selection');
  await owner.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selection._id,
    notes: 'Remember',
    choice: 'Bow',
    operationId: 'edit',
  });
  await t.run((ctx) => ctx.db.delete('catalogEntry', catalog.baseClass));
  const missing = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    missing!.entries.find((entry) => entry._id === selection._id),
  ).toMatchObject({
    notes: 'Remember',
    active: true,
    state: { choice: 'Bow', classEntryId: catalog.baseClass },
  });
  expect(
    missing!.calculated.archetypes.warnings.some(
      (warning) => warning.check === 'archetypeClass',
    ),
  ).toBe(true);
  expect(
    missing!.calculated.resolvedEntries.find(
      (row) => row.entry._id === selection._id,
    ),
  ).toMatchObject({ dormant: true, counting: false });
  expect(
    missing!.calculated.resolvedEntries.filter(
      (row) => row.counting && row.entry.kind === 'classFeature',
    ),
  ).toHaveLength(0);
});

test('editing and clearing inactive Archetype notes and choice preserves its class binding and replacement override', async () => {
  const { owner, member, scope, catalog } = await fixture();
  await owner.mutation(api.characterSheet.setArchetypeSelected, {
    ...scope,
    classEntryId: catalog.baseClass,
    catalogEntryId: catalog.archetype,
    selected: true,
    operationId: 'apply',
  });
  const applied = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const selection = applied!.entries.find(
    (entry) => entry.kind === 'archetype',
  );
  if (!selection) throw new Error('Missing selection');
  await member.mutation(api.characterSheet.setArchetypePartChoices, {
    ...scope,
    entryId: selection._id,
    replacementChoices: [],
    operationId: 'parts',
  });
  await member.mutation(api.characterSheet.setArchetypeSelected, {
    ...scope,
    classEntryId: catalog.baseClass,
    catalogEntryId: catalog.archetype,
    selected: false,
    operationId: 'deactivate',
  });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selection._id,
    choice: 'Longbow',
    operationId: 'choice',
  });
  await owner.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selection._id,
    notes: 'Bow drills',
    operationId: 'notes',
  });
  const edited = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    edited!.entries.find((entry) => entry._id === selection._id),
  ).toMatchObject({
    active: false,
    notes: 'Bow drills',
    state: { classEntryId: catalog.baseClass, choice: 'Longbow', replaces: [] },
  });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selection._id,
    choice: null,
    operationId: 'clear-choice',
  });
  const choiceCleared = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    choiceCleared!.entries.find((entry) => entry._id === selection._id),
  ).toMatchObject({
    active: false,
    notes: 'Bow drills',
    state: { classEntryId: catalog.baseClass, choice: null, replaces: [] },
  });
  await owner.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selection._id,
    notes: '',
    operationId: 'clear-notes',
  });
  const cleared = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    cleared!.entries.find((entry) => entry._id === selection._id),
  ).toMatchObject({
    active: false,
    notes: '',
    state: { classEntryId: catalog.baseClass, choice: null, replaces: [] },
  });
});

test('reads reject persisted Archetype class bindings to foreign or nonclass definitions', async () => {
  const { t, owner, scope, catalog } = await fixture();
  await owner.mutation(api.characterSheet.setArchetypeSelected, {
    ...scope,
    classEntryId: catalog.baseClass,
    catalogEntryId: catalog.archetype,
    selected: true,
    operationId: 'apply',
  });
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const selection = sheet!.entries.find((entry) => entry.kind === 'archetype');
  if (!selection) throw new Error('Missing selection');
  const otherId = await owner.mutation(api.characterSheet.create, {
    organizationId: scope.organizationId,
    campaignId: scope.campaignId,
    name: 'Other',
    kind: 'pc',
    operationId: 'other',
  });
  const other = withSheetCatalog(
    await owner.query(api.characterSheet.read, {
      ...scope,
      characterId: otherId,
    }),
  );
  const foreign = other!.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'fighter',
  );
  if (!foreign) throw new Error('Missing foreign class');
  for (const classEntryId of [foreign._id, catalog.original]) {
    await t.run((ctx) =>
      ctx.db.patch('characterSheetEntry', selection._id, {
        state: { kind: 'archetype', classEntryId },
      }),
    );
    await expect(owner.query(api.characterSheet.read, scope)).rejects.toThrow(
      'Class does not belong to this Character',
    );
  }
});

test('stale global Archetype choices use campaign copies and survive detaching the Archetype and class', async () => {
  const { t, owner, member, scope, catalog, levelId } = await fixture();
  await t.run(async (ctx) => {
    for (const id of Object.values(catalog))
      await ctx.db.patch('catalogEntry', id, {
        scope: 'global',
        characterId: undefined,
      });
  });
  const originalCopyId = await member.mutation(
    api.catalogCopies.customizeForCampaign,
    {
      ...scope,
      catalogEntryId: catalog.original,
      operationId: 'customize-feature',
    },
  );
  const classCopyId = await member.mutation(
    api.catalogCopies.customizeForCampaign,
    {
      ...scope,
      catalogEntryId: catalog.baseClass,
      operationId: 'customize-class',
    },
  );
  const archetypeCopyId = await member.mutation(
    api.catalogCopies.customizeForCampaign,
    {
      ...scope,
      catalogEntryId: catalog.archetype,
      operationId: 'customize-archetype',
    },
  );
  const grantKey = {
    source: 'test-fighter',
    classLevel: 1,
    entry: 'test-bravery',
  };
  await owner.mutation(api.characterSheet.editGrantState, {
    ...scope,
    grantKey,
    state: { notes: 'Retained Bravery' },
    operationId: 'record-original',
  });
  await owner.mutation(api.characterSheet.setArchetypeSelected, {
    ...scope,
    classEntryId: catalog.baseClass,
    catalogEntryId: catalog.archetype,
    selected: true,
    operationId: 'stale-archetype-picker',
  });
  const applied = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const selection = applied!.entries.find(
    (entry) => entry.kind === 'archetype',
  );
  if (!selection) throw new Error('Missing selection');
  expect(selection).toMatchObject({
    catalogEntryId: archetypeCopyId,
    state: { classEntryId: classCopyId },
  });
  expect(
    applied!.calculated.resolvedEntries.find(
      (row) =>
        row.entry.kind === 'classFeature' &&
        row.entry.catalogEntryId === originalCopyId,
    ),
  ).toMatchObject({
    dormant: true,
    counting: false,
    entry: { grantKey, notes: 'Retained Bravery' },
  });
  const detachedArchetypeId = await owner.mutation(api.catalogCopies.detach, {
    ...scope,
    target: { kind: 'entry', entryId: selection._id },
    operationId: 'detach-archetype',
  });
  const detachedClassId = await owner.mutation(api.catalogCopies.detach, {
    ...scope,
    target: { kind: 'entry', entryId: levelId },
    operationId: 'detach-class',
  });
  const detached = withSheetCatalog(
    await member.query(api.characterSheet.read, scope),
  );
  expect(
    detached!.entries.find((entry) => entry._id === selection._id),
  ).toMatchObject({
    catalogEntryId: detachedArchetypeId,
    state: { classEntryId: detachedClassId },
  });
  expect(
    detached!.catalogEntries.find((entry) => entry._id === detachedArchetypeId),
  ).toMatchObject({
    ruleIdentity: 'test-archer',
    detail: { replaces: [{ classLevel: 1, catalogEntryId: catalog.original }] },
  });
  expect(
    detached!.calculated.resolvedEntries.filter(
      (row) => row.counting && row.entry.kind === 'classFeature',
    ),
  ).toMatchObject([
    {
      entry: {
        catalogEntryId: catalog.replacement,
        grantKey: {
          source: 'test-archer',
          classLevel: 1,
          entry: 'test-hawkeye',
        },
      },
    },
  ]);
  await owner.mutation(api.characterSheet.setArchetypeSelected, {
    ...scope,
    classEntryId: detachedClassId,
    catalogEntryId: detachedArchetypeId,
    selected: false,
    operationId: 'deactivate-detached',
  });
  const restored = withSheetCatalog(
    await member.query(api.characterSheet.read, scope),
  );
  expect(
    restored!.calculated.resolvedEntries.filter(
      (row) => row.counting && row.entry.kind === 'classFeature',
    ),
  ).toMatchObject([
    {
      entry: {
        catalogEntryId: originalCopyId,
        grantKey,
        notes: 'Retained Bravery',
      },
    },
  ]);
});

test('referenced-only reads load Archetype replacement overrides and class-feature upgrades without unrelated global definitions', async () => {
  const { t, owner, scope, catalog } = await fixture();
  const { targetId, upgradeId, unrelatedId } = await t.run(async (ctx) => {
    const original = await ctx.db.get('catalogEntry', catalog.original);
    if (!original) throw new Error('Missing feature');
    const { _id, _creationTime, characterId: _characterId, ...body } = original;
    const targetId = await ctx.db.insert('catalogEntry', {
      ...body,
      scope: 'global',
      name: 'Equivalent Bravery',
    });
    const upgradeId = await ctx.db.insert('catalogEntry', {
      ...body,
      scope: 'global',
      name: 'Hawkeye upgrade',
      ruleIdentity: 'test-hawkeye-upgrade',
    });
    const unrelatedId = await ctx.db.insert('catalogEntry', {
      ...body,
      scope: 'global',
      name: 'Unrelated feature',
      ruleIdentity: 'test-unrelated',
    });
    await ctx.db.patch('catalogEntry', catalog.replacement, {
      detail: { kind: 'classFeature', duplicateUpgrade: upgradeId },
    });
    return { targetId, upgradeId, unrelatedId };
  });
  await owner.mutation(api.characterSheet.setArchetypeSelected, {
    ...scope,
    classEntryId: catalog.baseClass,
    catalogEntryId: catalog.archetype,
    selected: true,
    operationId: 'apply',
  });
  const selected = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const selection = selected!.entries.find(
    (entry) => entry.kind === 'archetype',
  );
  if (!selection) throw new Error('Missing selection');
  await owner.mutation(api.characterSheet.setArchetypePartChoices, {
    ...scope,
    entryId: selection._id,
    replacementChoices: [{ classLevel: 1, catalogEntryId: targetId }],
    operationId: 'replacement-override',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(saved!.catalogEntries.map((entry) => entry._id)).toEqual(
    expect.arrayContaining([targetId, upgradeId]),
  );
  expect(saved!.catalogEntries.some((entry) => entry._id === unrelatedId)).toBe(
    false,
  );
  expect(
    saved!.calculated.resolvedEntries.filter(
      (row) => row.counting && row.entry.kind === 'classFeature',
    ),
  ).toMatchObject([
    {
      entry: { catalogEntryId: catalog.replacement },
    },
  ]);
});
