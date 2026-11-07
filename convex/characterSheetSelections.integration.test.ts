// @vitest-environment edge-runtime
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { prerequisiteLabel } from '../src/lib/character-sheet-prerequisite-evaluation';
import { api } from './_generated/api';
import type { Doc } from './_generated/dataModel';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

test('ranged feats use ordinary slots without implying prerequisite feats and retain a Rapid Reload weapon choice', async () => {
  const { owner, member, scope } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const precise = initial?.catalogEntries.find(
    (row) => row.ruleIdentity === 'precise-shot',
  );
  const rapid = initial?.catalogEntries.find(
    (row) => row.ruleIdentity === 'rapid-reload',
  );
  if (!precise || !rapid) throw new Error('Missing ranged feats');
  const preciseId = await member.mutation(
    api.characterSheet.fillSelectionSlot,
    {
      ...scope,
      slotId: 'feat:general',
      position: 0,
      catalogEntryId: precise._id,
      operationId: 'precise-without-prerequisite',
    },
  );
  const selected = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(selected?.entries.find((row) => row._id === preciseId)).toMatchObject({
    kind: 'feat',
    active: true,
    selectionSlot: { id: 'feat:general', position: 0 },
  });
  const pointBlank = initial?.catalogEntries.find(
    (row) => row.ruleIdentity === 'point-blank-shot',
  );
  expect(
    selected?.entries.some(
      (row) =>
        row.kind === 'feat' &&
        row.active &&
        row.catalogEntryId === pointBlank?._id,
    ),
  ).toBe(false);
  expect(selected?.calculated.warnings).toContainEqual(
    expect.objectContaining({
      check: 'prerequisites.current',
      subject: expect.stringContaining(`${preciseId}:`),
    }),
  );
  const rapidId = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'feat:general',
    position: 0,
    catalogEntryId: rapid._id,
    choice: 'light crossbow',
    operationId: 'chosen-rapid-reload',
  });
  const reloaded = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(reloaded?.entries.find((row) => row._id === rapidId)).toMatchObject({
    kind: 'feat',
    catalogEntryId: rapid._id,
    active: true,
    state: { kind: 'feat', choice: 'light crossbow' },
  });
});

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
      name: 'Selections',
      description: '',
      organizationId: 'org',
      ownerId: 'test|owner',
      e2eFixture: {
        namespace: 'selections',
        version: 1,
        workerKey: '0',
        caseKey: 'selections',
        campaignKey: 'selections',
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
    const feat = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Toughness',
      ruleIdentity: 'test-toughness',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'feat' },
    });
    const replacement = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Power Attack',
      ruleIdentity: 'test-power-attack',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'feat' },
    });
    const trait = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Reactionary',
      ruleIdentity: 'test-reactionary',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'trait' },
    });
    return { feat, replacement, trait };
  });
  return { t, owner, member, outsider, scope, catalog };
}

test('members move Selections earlier and later within their recorded level across kinds', async () => {
  const { t, owner, member, scope, catalog } = await fixture();
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', catalog.replacement, {
      detail: { kind: 'classFeature' },
      prerequisites: [{ feat: 'test-toughness' }],
    }),
  );
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const level = initial?.entries.find((entry) => entry.kind === 'classLevel');
  if (!level) throw new Error('Missing Class Level');
  const feature = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: catalog.replacement,
    gainedAtClassLevel: level._id,
    operationId: 'feature-first',
  });
  const feat = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: catalog.feat,
    gainedAtClassLevel: level._id,
    operationId: 'feat-second',
  });
  const checks = async () =>
    withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )?.calculated.prerequisites.filter((check) => check.entryId === feature);
  expect(await checks()).toMatchObject([
    { view: 'current', met: true },
    { view: 'recorded', met: false },
  ]);
  await member.mutation(api.characterSheet.moveSelection, {
    ...scope,
    entryId: feat,
    direction: 'earlier',
    operationId: 'feat-before-feature',
  });
  const moved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(moved?.entries.find((entry) => entry._id === feat)).toMatchObject({
    gainedAtClassLevel: level._id,
    choiceOrder: 0,
  });
  expect(moved?.entries.find((entry) => entry._id === feature)).toMatchObject({
    gainedAtClassLevel: level._id,
    choiceOrder: 1,
  });
  expect(await checks()).toMatchObject([
    { view: 'current', met: true },
    { view: 'recorded', met: true },
  ]);
  await member.mutation(api.characterSheet.moveSelection, {
    ...scope,
    entryId: feat,
    direction: 'later',
    operationId: 'feat-after-feature',
  });
  expect(await checks()).toMatchObject([
    { view: 'current', met: true },
    { view: 'recorded', met: false },
  ]);
});

test('sheet reads resolve a whole-list spell prerequisite through the Character spell index', async () => {
  const { t, owner, scope, catalog } = await fixture();
  await t.run(async (ctx) => {
    await ctx.db.patch('catalogEntry', catalog.feat, {
      prerequisites: [{ castsSpell: 'global-required-bless' }],
    });
    const spellId = await ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Required Bless',
      ruleIdentity: 'global-required-bless',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      browseOnly: true,
      detail: { kind: 'spell', levels: { cleric: 1 } },
    });
    const classes = await ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId_and_ruleIdentity', (q) =>
        q.eq('characterId', scope.characterId).eq('ruleIdentity', 'cleric'),
      )
      .take(1);
    const cleric = classes[0];
    if (!cleric) throw new Error('Missing Cleric');
    await ctx.db.insert('spellCatalogIndex', {
      characterId: scope.characterId,
      ruleIdentity: 'global-required-bless',
      catalogEntryId: spellId,
      castingClassId: cleric._id,
      levels: { cleric: 1 },
      level: 1,
      school: 'enchantment',
      name: 'Required Bless',
      available: true,
    });
  });
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const cleric = initial?.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'cleric',
  );
  const level = initial?.entries.find((entry) => entry.kind === 'classLevel');
  if (!cleric || !level)
    throw new Error('Missing prepared Cleric and Class Level');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: cleric._id,
    operationId: 'cleric-casting',
  });
  const feat = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: catalog.feat,
    gainedAtClassLevel: level._id,
    operationId: 'spell-prerequisite',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(saved?.calculated.spellcastings).toMatchObject([
    { classTag: 'cleric', record: 'none' },
  ]);
  expect(
    saved?.catalogEntries.some(
      (entry) => entry.ruleIdentity === 'global-required-bless',
    ),
  ).toBe(true);
  expect(
    saved?.calculated.prerequisites.filter((check) => check.entryId === feat),
  ).toMatchObject([
    { view: 'current', met: true },
    { view: 'recorded', met: true },
  ]);
  expect(
    saved?.calculated.warnings.filter(
      (warning) =>
        warning.target.kind === 'entry' &&
        warning.target.entryId === feat &&
        warning.check.startsWith('prerequisites.'),
    ),
  ).toEqual([]);
});

test.each([
  { detail: { kind: 'race', racialTraits: [] }, modifiers: [] },
  {
    detail: { kind: 'racialTrait', raceEntryIds: [], replaces: [] },
    modifiers: [],
  },
  {
    detail: { kind: 'archetype', classEntryIds: [], replaces: [], adds: [] },
    modifiers: [],
  },
  { detail: { kind: 'classFeature' }, modifiers: [] },
  { detail: { kind: 'feat' }, modifiers: [] },
  { detail: { kind: 'trait' }, modifiers: [] },
  { detail: { kind: 'manual' }, modifiers: [] },
  { detail: { kind: 'item', consumable: false }, modifiers: [] },
  { detail: { kind: 'spell' }, modifiers: [] },
  {
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 3,
    },
    modifiers: [],
  },
  { detail: { kind: 'condition' }, modifiers: [] },
] satisfies Pick<Doc<'catalogEntry'>, 'detail' | 'modifiers'>[])(
  'inactive $detail.kind Selections remain outside level order without changing their state or level link',
  async (definition) => {
    const { t, owner, scope, catalog } = await fixture();
    const initial = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    const level = initial?.entries.find((entry) => entry.kind === 'classLevel');
    if (!level) throw new Error('Missing Class Level');
    await owner.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: catalog.feat,
      gainedAtClassLevel: level._id,
      operationId: 'first-selection',
    });
    const { detail } = definition;
    const catalogEntryId = await t.run((ctx) =>
      ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId: scope.characterId,
        name: `Recorded ${detail.kind}`,
        ruleIdentity: `recorded-${detail.kind}`,
        stacksWithItself: false,
        sources: [],
        ...definition,
      }),
    );
    const entryId = await owner.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId,
      active: false,
      gainedAtClassLevel: level._id,
      notes: 'Retain this note',
      operationId: `select-${detail.kind}`,
    });
    const before = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )?.entries.find((entry) => entry._id === entryId);
    await owner.mutation(api.characterSheet.moveSelection, {
      ...scope,
      entryId,
      direction: 'earlier',
      operationId: `earlier-${detail.kind}`,
    });
    const moved = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )?.entries.find((entry) => entry._id === entryId);
    expect(moved).toEqual(before);
    await owner.mutation(api.characterSheet.moveSelection, {
      ...scope,
      entryId,
      direction: 'later',
      operationId: `later-${detail.kind}`,
    });
    expect(
      withSheetCatalog(
        await owner.query(api.characterSheet.read, scope),
      )?.entries.find((entry) => entry._id === entryId),
    ).toEqual(before);
  },
);

test('normalizing tied and sparse orders preserves an unchanged Accepted Warning', async () => {
  const { t, owner, scope, catalog } = await fixture();
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', catalog.replacement, {
      prerequisites: [{ feat: 'missing-foundation' }],
    }),
  );
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const level = initial?.entries.find((entry) => entry.kind === 'classLevel');
  if (!level) throw new Error('Missing Class Level');
  await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: catalog.feat,
    gainedAtClassLevel: level._id,
    choiceOrder: 7,
    operationId: 'first-tied',
  });
  const second = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: catalog.trait,
    gainedAtClassLevel: level._id,
    choiceOrder: 7,
    operationId: 'second-tied',
  });
  const dependent = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: catalog.replacement,
    gainedAtClassLevel: level._id,
    choiceOrder: Number.MAX_SAFE_INTEGER,
    operationId: 'dependent-last',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const warning = before?.calculated.warnings.find(
    (row) =>
      row.check === 'prerequisites.recordedLevel' &&
      row.subject.startsWith(dependent),
  );
  if (!warning) throw new Error('Missing recorded prerequisite warning');
  await owner.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
    operationId: 'accept-unchanged-prefix',
  });
  await owner.mutation(api.characterSheet.moveSelection, {
    ...scope,
    entryId: second,
    direction: 'earlier',
    operationId: 'swap-tied',
  });
  const after = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(after?.entries.find((entry) => entry._id === dependent)).toMatchObject(
    { choiceOrder: 2 },
  );
  expect(after?.acceptedWarnings).toMatchObject([
    {
      check: warning.check,
      subject: warning.subject,
      fingerprint: warning.fingerprint,
    },
  ]);
  await owner.mutation(api.characterSheet.moveSelection, {
    ...scope,
    entryId: dependent,
    direction: 'earlier',
    operationId: 'move-unrelated-prefix',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.acceptedWarnings,
  ).toMatchObject([{ fingerprint: warning.fingerprint }]);
});

test('movement stays within one usable recorded level and leaves boundary moves unchanged', async () => {
  const { t, owner, scope, catalog } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const firstLevel = initial?.entries.find(
    (entry) => entry.kind === 'classLevel',
  );
  const base = initial?.entries.find((entry) => entry.kind === 'base');
  if (!firstLevel || !base) throw new Error('Missing initial sheet rows');
  const secondLevel = await owner.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    operationId: 'second-level',
  });
  const first = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: catalog.feat,
    gainedAtClassLevel: firstLevel._id,
    choiceOrder: null,
    operationId: 'first-level-selection',
  });
  const second = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: catalog.trait,
    gainedAtClassLevel: secondLevel,
    operationId: 'second-level-selection',
  });
  const undated = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: catalog.replacement,
    operationId: 'undated-selection',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  for (const entryId of [first, second])
    for (const direction of ['earlier', 'later'] as const)
      await owner.mutation(api.characterSheet.moveSelection, {
        ...scope,
        entryId,
        direction,
        operationId: `boundary-${entryId}-${direction}`,
      });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
  ).toEqual(before);
  for (const entryId of [base._id, firstLevel._id])
    await expect(
      owner.mutation(api.characterSheet.moveSelection, {
        ...scope,
        entryId,
        direction: 'earlier',
        operationId: 'non-selection',
      }),
    ).rejects.toThrow('Selection does not belong');
  await expect(
    owner.mutation(api.characterSheet.moveSelection, {
      ...scope,
      entryId: undated,
      direction: 'earlier',
      operationId: 'undated-move',
    }),
  ).rejects.toThrow('Record a Class Level');
  await t.run((ctx) =>
    ctx.db.patch('characterSheetEntry', first, {
      gainedAtClassLevel: base._id,
    }),
  );
  await expect(
    owner.mutation(api.characterSheet.moveSelection, {
      ...scope,
      entryId: first,
      direction: 'later',
      operationId: 'broken-link-move',
    }),
  ).rejects.toThrow('Record a Class Level');
  await t.run((ctx) =>
    ctx.db.patch('characterSheetEntry', second, {
      grantKey: { source: 'retained-source', entry: 'retained-trait' },
    }),
  );
  await expect(
    owner.mutation(api.characterSheet.moveSelection, {
      ...scope,
      entryId: second,
      direction: 'earlier',
      operationId: 'grant-move',
    }),
  ).rejects.toThrow('Grants cannot be reordered');
});

test('members fill and replace one feat slot while preserving other choices, then clear it', async () => {
  const { owner, member, scope, catalog } = await fixture();
  const first = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'feat:general',
    position: 0,
    catalogEntryId: catalog.feat,
    notes: 'Front line',
    operationId: 'feat',
  });
  const trait = await owner.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 0,
    catalogEntryId: catalog.trait,
    operationId: 'trait',
  });
  expect(
    await member.mutation(api.characterSheet.fillSelectionSlot, {
      ...scope,
      slotId: 'feat:general',
      position: 0,
      catalogEntryId: catalog.replacement,
      operationId: 'replace',
    }),
  ).toBe(first);
  const replaced = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(replaced?.entries.find((row) => row._id === first)).toMatchObject({
    catalogEntryId: catalog.replacement,
    selectionSlot: { id: 'feat:general', position: 0 },
  });
  expect(replaced?.entries.some((row) => row._id === trait)).toBe(true);
  await member.mutation(api.characterSheet.clearSelectionSlot, {
    ...scope,
    entryId: first,
    operationId: 'clear',
  });
  const cleared = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(cleared?.entries.some((row) => row._id === first)).toBe(false);
  expect(cleared?.entries.some((row) => row._id === trait)).toBe(true);
  expect(
    cleared?.catalogEntries.some((row) => row._id === catalog.replacement),
  ).toBe(true);
});

test('clearing or replacing a seeded feat keeps its shared definition choosable and named', async () => {
  const { owner, scope } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const seeded = (ruleIdentity: string) => {
    const definition = initial?.catalogEntries.find(
      (row) => row.ruleIdentity === ruleIdentity,
    );
    if (!definition) throw new Error(`Missing seeded ${ruleIdentity}`);
    return definition._id;
  };
  const powerAttack = seeded('power-attack');
  const cleave = seeded('cleave');
  const fill = (position: number, catalogEntryId: typeof powerAttack) =>
    owner.mutation(api.characterSheet.fillSelectionSlot, {
      ...scope,
      slotId: 'feat:general',
      position,
      catalogEntryId,
      operationId: `fill-${position}-${catalogEntryId}`,
    });
  const expectPowerAttackNamed = async () => {
    const sheet = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    expect(sheet?.catalogEntries.some((row) => row._id === powerAttack)).toBe(
      true,
    );
    expect(
      prerequisiteLabel({ feat: 'power-attack' }, sheet?.catalogEntries),
    ).toBe('Power Attack');
  };

  const cleared = await fill(0, powerAttack);
  await owner.mutation(api.characterSheet.clearSelectionSlot, {
    ...scope,
    entryId: cleared,
    operationId: 'clear-seeded',
  });
  await expectPowerAttackNamed();
  const refilled = await fill(0, powerAttack);
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )?.entries.find((row) => row._id === refilled),
  ).toMatchObject({ catalogEntryId: powerAttack });

  await fill(0, cleave);
  await expectPowerAttackNamed();
  const original = await fill(1, powerAttack);
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(saved?.entries.find((row) => row._id === original)).toMatchObject({
    catalogEntryId: powerAttack,
  });
  expect(saved?.catalogEntries.some((row) => row._id === cleave)).toBe(true);
});

test('unmet prerequisites are advisory and current and recorded acceptances reopen independently', async () => {
  const { t, owner, member, scope, catalog } = await fixture();
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', catalog.feat, {
      prerequisites: [{ ability: 'strength', min: 13 }],
      prerequisiteText:
        'Strength 13; the table decides the unmodeled conditions.',
    }),
  );
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const level = initial?.entries.find((row) => row.kind === 'classLevel');
  if (!level) throw new Error('Missing first Class Level');
  const entryId = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'feat:general',
    position: 0,
    catalogEntryId: catalog.feat,
    gainedAtClassLevel: level._id,
    operationId: 'intentional-feat',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const failures =
    before?.calculated.warnings.filter(
      (warning) =>
        warning.subject.startsWith(entryId) &&
        warning.check.startsWith('prerequisites.'),
    ) ?? [];
  expect(failures.map((warning) => warning.check).sort()).toEqual([
    'prerequisites.current',
    'prerequisites.recordedLevel',
  ]);
  for (const warning of failures)
    await owner.mutation(api.characterSheet.acceptWarning, {
      ...scope,
      check: warning.check,
      subject: warning.subject,
      fingerprint: warning.fingerprint,
      operationId: 'accept',
    });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId,
    notes: 'Intentional table choice',
    operationId: 'notes',
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )?.acceptedWarnings.filter((warning) =>
      warning.subject.startsWith(entryId),
    ),
  ).toHaveLength(2);
  const second = await member.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    operationId: 'second-level',
  });
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: second,
    abilityIncrease: 'strength',
    operationId: 'later-increase',
  });
  const later = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    later?.acceptedWarnings.filter((warning) =>
      warning.subject.startsWith(entryId),
    ),
  ).toMatchObject([{ check: 'prerequisites.recordedLevel' }]);
  await member.mutation(api.characterSheet.clearSelectionSlot, {
    ...scope,
    entryId,
    operationId: 'clear-warning',
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )?.acceptedWarnings.some((warning) => warning.subject.startsWith(entryId)),
  ).toBe(false);
});

test('a renamed held copy satisfies its original feat identity without original access or recursive eligibility', async () => {
  const { t, owner, outsider, scope, catalog } = await fixture();
  const originalCharacter = await outsider.mutation(api.characterSheet.create, {
    name: 'Inaccessible original catalog',
    kind: 'pc',
    operationId: 'original-owner',
  });
  const originalDefinition = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: originalCharacter,
      name: 'Original foundation',
      ruleIdentity: 'original-foundation',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'feat' },
    }),
  );
  await expect(
    owner.query(api.characterSheet.read, { characterId: originalCharacter }),
  ).rejects.toThrow();
  await t.run(async (ctx) => {
    await ctx.db.patch('catalogEntry', catalog.feat, {
      name: 'Table-customized foundation',
      ruleIdentity: 'original-foundation',
      prerequisites: [{ ability: 'strength', min: 99 }],
    });
    await ctx.db.patch('catalogEntry', catalog.replacement, {
      prerequisites: [{ feat: 'original-foundation' }],
    });
  });
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const level = sheet?.entries.find((row) => row.kind === 'classLevel');
  if (!level) throw new Error('Missing first Class Level');
  await owner.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'feat:general',
    position: 0,
    catalogEntryId: catalog.feat,
    gainedAtClassLevel: level._id,
    operationId: 'foundation',
  });
  const dependent = await owner.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'feat:general',
    position: 1,
    catalogEntryId: catalog.replacement,
    gainedAtClassLevel: level._id,
    operationId: 'dependent',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    saved?.catalogEntries.some((row) => row._id === originalDefinition),
  ).toBe(false);
  expect(
    saved?.calculated.prerequisites.filter(
      (check) => check.entryId === dependent,
    ),
  ).toMatchObject([
    { view: 'current', met: true },
    { view: 'recorded', met: true },
  ]);
  expect(
    saved?.calculated.warnings.some(
      (warning) =>
        warning.subject.startsWith(dependent) &&
        warning.check.startsWith('prerequisites.'),
    ),
  ).toBe(false);
  expect(
    saved?.calculated.selectionRules.slots.find(
      (slot) => slot.id === 'feat:general',
    ),
  ).toMatchObject({
    count: 1,
    used: 2,
  });
});

test('a drawback opens one extra trait and resolves accepted budget warnings without removing choices', async () => {
  const { owner, member, scope } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const choices = [
    'reactionary',
    'indomitable-faith',
    'prepared-campaign-trait',
  ].map((identity) =>
    initial?.catalogEntries.find((row) => row.ruleIdentity === identity),
  );
  for (const [position, definition] of choices.entries()) {
    if (!definition) throw new Error('Missing representative trait');
    await member.mutation(api.characterSheet.fillSelectionSlot, {
      ...scope,
      slotId: 'trait:general',
      position,
      catalogEntryId: definition._id,
      operationId: `trait-${position}`,
    });
  }
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const warning = before?.calculated.warnings.find(
    (row) => row.check === 'traitCount',
  );
  if (!warning) throw new Error('Missing advisory trait budget warning');
  await owner.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
    operationId: 'accept-budget',
  });
  const drawback = initial?.catalogEntries.find(
    (row) => row.ruleIdentity === 'prepared-drawback',
  );
  if (!drawback) throw new Error('Missing representative drawback');
  await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:drawback',
    position: 0,
    catalogEntryId: drawback._id,
    operationId: 'drawback',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(saved?.calculated.selectionRules.budgets.traits).toBe(3);
  expect(saved?.entries.filter((row) => row.kind === 'trait')).toHaveLength(4);
  expect(
    saved?.calculated.warnings.some((row) => row.check === 'traitCount'),
  ).toBe(false);
  expect(
    saved?.acceptedWarnings.some((row) => row.check === 'traitCount'),
  ).toBe(false);
});

test('bonus slot type failures remain advisory while a second prerequisite-exempt slot preserves its identity through edits', async () => {
  const { t, owner, scope, catalog } = await fixture();
  await t.run(async (ctx) => {
    await ctx.db.patch('catalogEntry', catalog.replacement, {
      grantsSlots: [
        { kind: 'feat', count: 1, featTypes: ['combat'] },
        {
          kind: 'feat',
          count: 1,
          featTypes: ['general'],
          ignoresPrerequisites: true,
        },
      ],
    });
    await ctx.db.patch('catalogEntry', catalog.feat, {
      detail: { kind: 'feat', featTypes: ['combat'], repeatable: 'no' },
      prerequisites: [{ ability: 'strength', min: 99 }],
    });
  });
  const source = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: catalog.replacement,
    operationId: 'slot-source',
  });
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const level = initial?.entries.find((row) => row.kind === 'classLevel');
  if (!level) throw new Error('Missing first Class Level');
  const ordinaryEntry = await owner.mutation(
    api.characterSheet.fillSelectionSlot,
    {
      ...scope,
      slotId: `feat:${source}:0`,
      position: 0,
      catalogEntryId: catalog.feat,
      gainedAtClassLevel: level._id,
      operationId: 'ordinary-feat',
    },
  );
  const entryId = await owner.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: `feat:${source}:1`,
    position: 0,
    catalogEntryId: catalog.feat,
    gainedAtClassLevel: level._id,
    operationId: 'exempt-feat',
  });
  await owner.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId,
    choice: 'longsword',
    notes: 'Second source slot',
    operationId: 'edit-exempt',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(saved?.entries.find((row) => row._id === entryId)).toMatchObject({
    selectionSlot: { id: `feat:${source}:1`, position: 0 },
    selectionSource: {
      kind: 'slot',
      grantedBy: { kind: 'entry', entryId: source },
      slotIndex: 1,
    },
    state: {
      slot: { grantedBy: { kind: 'entry', entryId: source }, slotIndex: 1 },
    },
  });
  expect(
    saved?.calculated.warnings.some((row) => row.check === 'featSlotType'),
  ).toBe(true);
  expect(
    saved?.calculated.prerequisites.some((row) => row.entryId === entryId),
  ).toBe(false);
  expect(
    saved?.calculated.prerequisites.filter(
      (row) => row.entryId === ordinaryEntry,
    ),
  ).toMatchObject([
    { view: 'current', met: false },
    { view: 'recorded', met: false },
  ]);
});

test('slot writers reject foreign references, malformed positions, maintenance, stale epochs and sheet authority', async () => {
  const { t, owner, outsider, scope, catalog } = await fixture();
  const entryId = await owner.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'feat:general',
    position: 0,
    catalogEntryId: catalog.feat,
    operationId: 'first',
  });
  const commands = (caller: typeof owner, writeEpoch?: number) => [
    () =>
      caller.mutation(api.characterSheet.fillSelectionSlot, {
        ...scope,
        slotId: 'feat:general',
        position: 0,
        catalogEntryId: catalog.replacement,
        operationId: 'fill',
        writeEpoch,
      }),
    () =>
      caller.mutation(api.characterSheet.clearSelectionSlot, {
        ...scope,
        entryId,
        operationId: 'clear',
        writeEpoch,
      }),
    () =>
      caller.mutation(api.characterSheet.moveSelection, {
        ...scope,
        entryId,
        direction: 'earlier',
        operationId: 'move',
        writeEpoch,
      }),
  ];
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  for (const caller of [t, outsider])
    for (const command of commands(caller))
      await expect(command()).rejects.toThrow();
  for (const position of [-1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1])
    await expect(
      owner.mutation(api.characterSheet.fillSelectionSlot, {
        ...scope,
        slotId: 'feat:general',
        position,
        catalogEntryId: catalog.feat,
        operationId: 'invalid',
      }),
    ).rejects.toThrow();
  await expect(
    owner.mutation(api.characterSheet.fillSelectionSlot, {
      ...scope,
      slotId: 'feat:general',
      position: 0,
      catalogEntryId: catalog.trait,
      operationId: 'wrong-kind',
    }),
  ).rejects.toThrow('Choose a feat');
  await expect(
    owner.mutation(api.characterSheet.fillSelectionSlot, {
      ...scope,
      slotId: 'feat:someone-elses-slot:0',
      position: 0,
      catalogEntryId: catalog.feat,
      operationId: 'foreign-slot',
    }),
  ).rejects.toThrow('does not belong');
  const other = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId: scope.campaignId,
    name: 'Other',
    kind: 'pc',
    operationId: 'other',
  });
  await expect(
    owner.mutation(api.characterSheet.fillSelectionSlot, {
      ...scope,
      characterId: other,
      slotId: 'feat:general',
      position: 0,
      catalogEntryId: catalog.feat,
      operationId: 'foreign-definition',
    }),
  ).rejects.toThrow('does not belong');
  await expect(
    owner.mutation(api.characterSheet.clearSelectionSlot, {
      ...scope,
      characterId: other,
      entryId,
      operationId: 'foreign-selection',
    }),
  ).rejects.toThrow('does not belong');
  await expect(
    owner.mutation(api.characterSheet.moveSelection, {
      ...scope,
      characterId: other,
      entryId,
      direction: 'earlier',
      operationId: 'foreign-move',
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
  for (const command of commands(owner))
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

test('alignment and deity are editable current facts, and private slots require the owner', async () => {
  const { owner, member, scope, catalog, t } = await fixture();
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', catalog.feat, {
      prerequisites: [{ alignment: ['LG'] }, { deity: 'Iomedae' }],
    }),
  );
  const entryId = await owner.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'feat:general',
    position: 0,
    catalogEntryId: catalog.feat,
    operationId: 'faith-feat',
  });
  await member.mutation(api.characterSheet.editCreationSettings, {
    ...scope,
    settings: {},
    alignment: 'LG',
    deity: ' Iomedae ',
    operationId: 'facts',
  });
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(sheet?.entries.find((row) => row.kind === 'base')).toMatchObject({
    state: { alignment: 'LG', deity: 'Iomedae' },
  });
  expect(
    sheet?.calculated.prerequisites
      .filter((row) => row.entryId === entryId)
      .map((row) => row.met),
  ).toEqual([true, true]);
  await expect(
    member.mutation(api.characterSheet.editCreationSettings, {
      ...scope,
      settings: {},
      // @ts-expect-error A stale client can submit an unsupported alignment.
      alignment: 'unknown',
      operationId: 'invalid-alignment',
    }),
  ).rejects.toThrow();
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
  ).toEqual(sheet);
  await member.mutation(api.characterSheet.editCreationSettings, {
    ...scope,
    settings: {},
    alignment: null,
    deity: null,
    operationId: 'clear-facts',
  });
  const cleared = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const base = cleared?.entries.find((row) => row.kind === 'base');
  expect(base?.state).not.toHaveProperty('alignment');
  expect(base?.state).not.toHaveProperty('deity');
  const characterId = await owner.mutation(api.characterSheet.create, {
    name: 'Private',
    kind: 'pc',
    operationId: 'private',
  });
  const privateSheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, {
      characterId,
    }),
  );
  const privateFeat = privateSheet?.catalogEntries.find(
    (row) => row.ruleIdentity === 'power-attack',
  );
  if (!privateFeat) throw new Error('Missing private representative feat');
  await expect(
    member.mutation(api.characterSheet.fillSelectionSlot, {
      characterId,
      slotId: 'feat:general',
      position: 0,
      catalogEntryId: privateFeat._id,
      operationId: 'steal',
    }),
  ).rejects.toThrow();
  const privateEntry = await owner.mutation(
    api.characterSheet.fillSelectionSlot,
    {
      characterId,
      slotId: 'feat:general',
      position: 0,
      catalogEntryId: privateFeat._id,
      operationId: 'private-feat',
    },
  );
  await expect(
    member.mutation(api.characterSheet.clearSelectionSlot, {
      characterId,
      entryId: privateEntry,
      operationId: 'steal-clear',
    }),
  ).rejects.toThrow();
  await expect(
    member.mutation(api.characterSheet.moveSelection, {
      characterId,
      entryId: privateEntry,
      direction: 'earlier',
      operationId: 'steal-move',
    }),
  ).rejects.toThrow();
});

test('prepared fighter advancement supplies a combat bonus slot that can be filled and goes dormant with its source', async () => {
  const { owner, member, scope } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const fighter = initial?.catalogEntries.find(
    (row) => row.ruleIdentity === 'fighter',
  );
  const level = initial?.entries.find((row) => row.kind === 'classLevel');
  const skillFocus = initial?.catalogEntries.find(
    (row) => row.ruleIdentity === 'skill-focus',
  );
  if (!fighter || !level || !skillFocus)
    throw new Error('Missing representative choices');
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: fighter._id,
    operationId: 'fighter',
  });
  const advanced = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const slot = advanced?.calculated.selectionRules.slots.find(
    (row) =>
      row.grantedBy?.kind === 'grant' &&
      row.grantedBy.grantKey.source === 'fighter',
  );
  if (!slot) throw new Error('Missing fighter bonus feat slot');
  expect(slot).toMatchObject({ count: 1, featTypes: ['combat'] });
  const entryId = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: slot.id,
    position: 0,
    catalogEntryId: skillFocus._id,
    gainedAtClassLevel: level._id,
    choice: 'Perception',
    operationId: 'bonus-choice',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated.warnings,
  ).toContainEqual(
    expect.objectContaining({
      check: 'featSlotType',
      target: { kind: 'entry', entryId },
    }),
  );
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: null,
    operationId: 'unspecified',
  });
  const dormant = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(dormant?.calculated.resolvedEntries).toContainEqual(
    expect.objectContaining({
      storedEntryId: entryId,
      dormant: true,
      counting: false,
    }),
  );
  expect(dormant?.entries.find((row) => row._id === entryId)).toMatchObject({
    state: { choice: 'Perception' },
  });
});

async function markCatalogCopies(
  { t, catalog }: Awaited<ReturnType<typeof fixture>>,
  copies: readonly (keyof Awaited<ReturnType<typeof fixture>>['catalog'])[],
) {
  await t.run(async (ctx) => {
    for (const key of copies)
      await ctx.db.patch('catalogEntry', catalog[key], {
        copiedFrom: catalog.trait,
      });
  });
}

test('clearing and replacing Selections release unreferenced Character Catalog Copies', async () => {
  const setup = await fixture();
  const { owner, scope, catalog } = setup;
  await markCatalogCopies(setup, ['feat', 'replacement']);
  const entryId = await owner.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'feat:general',
    position: 0,
    catalogEntryId: catalog.feat,
    operationId: 'select-copy',
  });
  await owner.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'feat:general',
    position: 0,
    catalogEntryId: catalog.replacement,
    operationId: 'replace-copy',
  });
  const replaced = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    replaced?.entries.find((entry) => entry._id === entryId),
  ).toMatchObject({ catalogEntryId: catalog.replacement });
  expect(
    replaced?.catalogEntries.some((entry) => entry._id === catalog.feat),
  ).toBe(false);
  await owner.mutation(api.characterSheet.clearSelectionSlot, {
    ...scope,
    entryId,
    operationId: 'clear-copy',
  });
  const cleared = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    cleared?.catalogEntries.some((entry) => entry._id === catalog.replacement),
  ).toBe(false);
});

test('dating an undated Selection appends it after selections already recorded at that level', async () => {
  const { t, owner, scope, catalog } = await fixture();
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', catalog.replacement, {
      prerequisites: [{ feat: 'test-toughness' }],
    }),
  );
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const level = initial?.entries.find((entry) => entry.kind === 'classLevel');
  if (!level) throw new Error('Missing Class Level');
  const foundation = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: catalog.feat,
    gainedAtClassLevel: level._id,
    operationId: 'dated-foundation',
  });
  const dependent = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: catalog.replacement,
    operationId: 'undated-dependent',
  });
  await owner.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: dependent,
    gainedAtClassLevel: level._id,
    operationId: 'date-dependent',
  });
  const dated = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    dated?.entries.find((entry) => entry._id === foundation),
  ).toMatchObject({ choiceOrder: 0 });
  expect(dated?.entries.find((entry) => entry._id === dependent)).toMatchObject(
    { choiceOrder: 1 },
  );
  expect(
    dated?.calculated.prerequisites.filter(
      (check) => check.entryId === dependent && check.view === 'recorded',
    ),
  ).toMatchObject([{ met: true }]);
  const second = await owner.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    operationId: 'second',
  });
  await owner.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: foundation,
    gainedAtClassLevel: second,
    operationId: 'move-foundation',
  });
  await owner.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: dependent,
    gainedAtClassLevel: second,
    operationId: 'move-dependent',
  });
  const moved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(moved?.entries.find((entry) => entry._id === dependent)).toMatchObject(
    { gainedAtClassLevel: second, choiceOrder: 1 },
  );
});

for (const operation of ['fill', 'edit'] as const) {
  test(`${operation} appends a recorded Selection after an existing unknown-order prerequisite`, async () => {
    const { t, owner, scope, catalog } = await fixture();
    await t.run((ctx) =>
      ctx.db.patch('catalogEntry', catalog.replacement, {
        prerequisites: [{ feat: 'test-toughness' }],
      }),
    );
    const initial = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    const level = initial?.entries.find((entry) => entry.kind === 'classLevel');
    if (!level) throw new Error('Missing Class Level');
    const foundation = await owner.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: catalog.feat,
      gainedAtClassLevel: level._id,
      choiceOrder: null,
      operationId: 'legacy-foundation',
    });
    const dependent = await owner.mutation(
      api.characterSheet.fillSelectionSlot,
      {
        ...scope,
        slotId: 'feat:general',
        position: 0,
        catalogEntryId: catalog.replacement,
        ...(operation === 'fill' ? { gainedAtClassLevel: level._id } : {}),
        operationId: 'dependent',
      },
    );
    if (operation === 'edit')
      await owner.mutation(api.characterSheet.editSelection, {
        ...scope,
        entryId: dependent,
        gainedAtClassLevel: level._id,
        operationId: 'date-dependent',
      });
    const saved = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    expect(
      saved?.entries.find((entry) => entry._id === foundation),
    ).not.toHaveProperty('choiceOrder');
    expect(
      saved?.entries.find((entry) => entry._id === dependent),
    ).toMatchObject({
      gainedAtClassLevel: level._id,
      choiceOrder: 1,
    });
    expect(
      saved?.calculated.prerequisites.filter(
        (check) => check.entryId === dependent && check.view === 'recorded',
      ),
    ).toMatchObject([{ met: true }]);
  });
}

for (const operation of ['select', 'fill', 'edit'] as const) {
  test(`${operation} refuses an appended Choice order beyond safe integers without changing the sheet`, async () => {
    const { owner, scope, catalog } = await fixture();
    const initial = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    const level = initial?.entries.find((entry) => entry.kind === 'classLevel');
    if (!level) throw new Error('Missing Class Level');
    const recordedLevelId = level._id;
    await owner.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: catalog.feat,
      gainedAtClassLevel: recordedLevelId,
      choiceOrder: Number.MAX_SAFE_INTEGER,
      operationId: 'last-safe-order',
    });
    const undated =
      operation === 'edit'
        ? await owner.mutation(api.characterSheet.selectEntry, {
            ...scope,
            catalogEntryId: catalog.replacement,
            operationId: 'undated-dependent',
          })
        : undefined;
    const before = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    async function append() {
      if (operation === 'select')
        return owner.mutation(api.characterSheet.selectEntry, {
          ...scope,
          catalogEntryId: catalog.replacement,
          gainedAtClassLevel: recordedLevelId,
          operationId: 'overflow-select',
        });
      if (operation === 'fill')
        return owner.mutation(api.characterSheet.fillSelectionSlot, {
          ...scope,
          slotId: 'feat:general',
          position: 0,
          catalogEntryId: catalog.replacement,
          gainedAtClassLevel: recordedLevelId,
          operationId: 'overflow-fill',
        });
      if (!undated) throw new Error('Missing undated Selection');
      return owner.mutation(api.characterSheet.editSelection, {
        ...scope,
        entryId: undated,
        gainedAtClassLevel: recordedLevelId,
        operationId: 'overflow-edit',
      });
    }
    await expect(append()).rejects.toThrow('Choice order');
    const after = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    expect(after?.entries).toEqual(before?.entries);
    expect(after?.lastOperationId).toBe(before?.lastOperationId);
  });
}

test('an Accepted Warning created under #306 survives unrelated Selection edits with typed clauses ahead', async () => {
  const { t, owner, scope, catalog } = await fixture();
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', catalog.feat, {
      prerequisites: [{ ability: 'strength', min: 13 }],
      proficiencyPrerequisites: [
        { kind: 'proficiency', proficiency: { category: 'heavy' } },
      ],
    }),
  );
  const entryId = await owner.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'feat:general',
    position: 0,
    catalogEntryId: catalog.feat,
    operationId: 'select-legacy-prerequisite',
  });
  const fingerprint =
    '["category:heavy","category:heavy",{"granted":[],"removed":[]},null]';
  await t.run((ctx) =>
    ctx.db.insert('acceptedWarning', {
      characterId: scope.characterId,
      check: 'proficiencyPrerequisite',
      subject: `${entryId}:current:0`,
      fingerprint,
      acceptedBy: 'test|owner',
      acceptedAt: 1,
    }),
  );
  await owner.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId,
    notes: 'Still intentional',
    operationId: 'unrelated-notes',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(saved?.acceptedWarnings).toMatchObject([
    {
      check: 'proficiencyPrerequisite',
      subject: `${entryId}:current:0`,
      fingerprint,
    },
  ]);
});

test('clearing a Selection retains a Catalog Copy still used by another Selection', async () => {
  const setup = await fixture();
  const { owner, scope, catalog } = setup;
  await markCatalogCopies(setup, ['feat']);
  const first = await owner.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'feat:general',
    position: 0,
    catalogEntryId: catalog.feat,
    operationId: 'first-copy-reference',
  });
  const second = await owner.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'feat:general',
    position: 1,
    catalogEntryId: catalog.feat,
    operationId: 'second-copy-reference',
  });
  await owner.mutation(api.characterSheet.clearSelectionSlot, {
    ...scope,
    entryId: first,
    operationId: 'clear-first-reference',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    saved?.catalogEntries.some((entry) => entry._id === catalog.feat),
  ).toBe(true);
  expect(saved?.entries.find((entry) => entry._id === second)).toMatchObject({
    catalogEntryId: catalog.feat,
  });
});

for (const choiceOrder of [0, null]) {
  test(`unrelated notes retain recorded prerequisites and Accepted Warnings for ${choiceOrder === null ? 'unknown' : 'tied'} Selection orders`, async () => {
    const { t, owner, scope, catalog } = await fixture();
    await t.run((ctx) =>
      ctx.db.patch('catalogEntry', catalog.replacement, {
        prerequisites: [{ feat: 'test-toughness' }],
      }),
    );
    const initial = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    const level = initial?.entries.find((entry) => entry.kind === 'classLevel');
    if (!level) throw new Error('Missing Class Level');
    const dependent = await owner.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: catalog.replacement,
      gainedAtClassLevel: level._id,
      choiceOrder,
      operationId: 'dependent-first',
    });
    await owner.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: catalog.feat,
      gainedAtClassLevel: level._id,
      choiceOrder,
      operationId: 'foundation-after',
    });
    const before = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    const warning = before?.calculated.warnings.find(
      (warning) =>
        warning.check === 'prerequisites.recordedLevel' &&
        warning.subject.startsWith(dependent),
    );
    if (!warning) throw new Error('Missing recorded prerequisite failure');
    await owner.mutation(api.characterSheet.acceptWarning, {
      ...scope,
      check: warning.check,
      subject: warning.subject,
      fingerprint: warning.fingerprint,
      operationId: 'accept-order-failure',
    });
    await owner.mutation(api.characterSheet.editSelection, {
      ...scope,
      entryId: dependent,
      notes: 'No order change',
      operationId: 'notes-order',
    });
    const after = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    expect(
      after?.entries.find((entry) => entry._id === dependent),
    ).toMatchObject(
      choiceOrder === null ? { notes: 'No order change' } : { choiceOrder: 0 },
    );
    const savedDependent = after?.entries.find(
      (entry) => entry._id === dependent,
    );
    expect(
      savedDependent && 'choiceOrder' in savedDependent
        ? savedDependent.choiceOrder
        : undefined,
    ).toBe(choiceOrder ?? undefined);
    expect(after?.acceptedWarnings).toMatchObject([
      {
        check: warning.check,
        subject: warning.subject,
        fingerprint: warning.fingerprint,
      },
    ]);
    expect(
      after?.calculated.prerequisites.filter(
        (check) => check.entryId === dependent && check.view === 'recorded',
      ),
    ).toMatchObject([{ met: false }]);
  });
}

test('clearing a one-off feat releases its private definition', async () => {
  const { member, owner, scope } = await fixture();
  const entryId = await member.mutation(api.catalogCopies.createOneOff, {
    ...scope,
    operationId: 'one-off-feat',
    definition: {
      name: 'Personal feat',
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: { kind: 'feat' },
    },
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const entry = before?.entries.find((row) => row._id === entryId);
  if (entry?.kind !== 'feat') throw new Error('Missing one-off feat');
  const catalogEntryId = entry.catalogEntryId;
  await member.mutation(api.characterSheet.clearSelectionSlot, {
    ...scope,
    entryId,
    operationId: 'clear-one-off',
  });
  const after = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(after?.entries.some((row) => row._id === entryId)).toBe(false);
  expect(after?.catalogEntries.some((row) => row._id === catalogEntryId)).toBe(
    false,
  );
});

test('clearing a Selection retains a definition still referenced by another Selection', async () => {
  const setup = await fixture();
  const { member, owner, scope, catalog } = setup;
  await markCatalogCopies(setup, ['feat']);
  const first = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'feat:general',
    position: 0,
    catalogEntryId: catalog.feat,
    operationId: 'first-copy-use',
  });
  const second = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'feat:general',
    position: 1,
    catalogEntryId: catalog.feat,
    operationId: 'second-copy-use',
  });
  await member.mutation(api.characterSheet.clearSelectionSlot, {
    ...scope,
    entryId: first,
    operationId: 'clear-first-copy-use',
  });
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(sheet?.entries.find((row) => row._id === second)).toMatchObject({
    catalogEntryId: catalog.feat,
  });
  expect(sheet?.catalogEntries.some((row) => row._id === catalog.feat)).toBe(
    true,
  );
});

test('removing seeded equipment retains its shared definition for later selection', async () => {
  const { owner, member, scope } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const weapon = initial?.catalogEntries.find(
    (row) => row.detail.kind === 'item',
  );
  if (!weapon) throw new Error('Missing seeded weapon');
  const entryId = await member.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: weapon._id,
    operationId: 'select-seeded-weapon',
  });
  await member.mutation(api.characterSheet.removeSheetEntry, {
    ...scope,
    entryId,
    operationId: 'remove-seeded-weapon',
  });
  const removed = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(removed?.catalogEntries.some((row) => row._id === weapon._id)).toBe(
    true,
  );
  await expect(
    member.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: weapon._id,
      operationId: 'reselect-seeded-weapon',
    }),
  ).resolves.toBeDefined();
});

test('removing a canonical condition releases its private definition', async () => {
  const { owner, member, scope } = await fixture();
  const entryId = await member.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Fatigued',
    modifiers: [],
    detail: { kind: 'condition', conditionKey: 'fatigued' },
    operationId: 'canonical-condition',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const entry = before?.entries.find((row) => row._id === entryId);
  if (entry?.kind !== 'condition') throw new Error('Missing condition');
  await member.mutation(api.characterSheet.removeSheetEntry, {
    ...scope,
    entryId,
    operationId: 'remove-condition',
  });
  const removed = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(removed?.entries.some((row) => row._id === entryId)).toBe(false);
  expect(
    removed?.catalogEntries.some((row) => row._id === entry.catalogEntryId),
  ).toBe(false);
});

test('adding and removing a canonical condition repeatedly leaves no rows behind', async () => {
  const { owner, member, scope } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  for (const cycle of [1, 2, 3]) {
    const entryId = await member.mutation(api.characterSheet.createSheetEntry, {
      ...scope,
      name: 'Fatigued',
      modifiers: [],
      detail: { kind: 'condition', conditionKey: 'fatigued' },
      operationId: `add-condition-${cycle}`,
    });
    await member.mutation(api.characterSheet.removeSheetEntry, {
      ...scope,
      entryId,
      operationId: `remove-condition-${cycle}`,
    });
  }
  const after = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(after?.entries.map((row) => row._id)).toEqual(
    initial?.entries.map((row) => row._id),
  );
  expect(after?.catalogEntries.map((row) => row._id)).toEqual(
    initial?.catalogEntries.map((row) => row._id),
  );
});

test('filling a slot with a stale global choice uses the campaign customized definition', async () => {
  const { t, owner, member, scope } = await fixture();
  const globalId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Global feat',
      ruleIdentity: 'global-slot-feat',
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: { kind: 'feat' },
    }),
  );
  await owner.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'feat:general',
    position: 0,
    catalogEntryId: globalId,
    operationId: 'first-global-pick',
  });
  const copyId = await member.mutation(api.catalogCopies.customizeForCampaign, {
    ...scope,
    catalogEntryId: globalId,
    operationId: 'customize-global-feat',
  });
  const entryId = await owner.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'feat:general',
    position: 1,
    catalogEntryId: globalId,
    operationId: 'stale-global-pick',
  });
  const sheet = withSheetCatalog(
    await member.query(api.characterSheet.read, scope),
  );
  expect(sheet?.entries.find((row) => row._id === entryId)).toMatchObject({
    catalogEntryId: copyId,
  });
});

test('casting warnings reopen for relevant earlier progression while unrelated levels preserve acceptance', async () => {
  const { t, owner, scope, catalog } = await fixture();
  await t.run(async (ctx) => {
    await ctx.db.patch('catalogEntry', catalog.feat, {
      prerequisites: [
        { canCast: { spellLevel: 3, kind: 'divine' } },
        { castsSpell: 'required-third-level-spell' },
      ],
    });
    await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: scope.characterId,
      name: 'Required third-level spell',
      ruleIdentity: 'required-third-level-spell',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'spell', levels: { cleric: 3 } },
    });
  });
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const cleric = initial?.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'cleric',
  );
  const fighter = initial?.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'fighter',
  );
  const level = initial?.entries.find((entry) => entry.kind === 'classLevel');
  if (!cleric || !fighter || !level)
    throw new Error('Missing prepared classes and Class Level');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: cleric._id,
    operationId: 'cleric',
  });
  const feat = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: catalog.feat,
    gainedAtClassLevel: level._id,
    operationId: 'requires-third',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const warnings =
    before?.calculated.warnings.filter(
      (warning) =>
        warning.check === 'prerequisites.recordedLevel' &&
        warning.subject.startsWith(feat),
    ) ?? [];
  expect(warnings).toHaveLength(2);
  for (const warning of warnings)
    await owner.mutation(api.characterSheet.acceptWarning, {
      ...scope,
      check: warning.check,
      subject: warning.subject,
      fingerprint: warning.fingerprint,
      operationId: `accept-${warning.subject}`,
    });
  await owner.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: fighter._id,
    position: 1,
    operationId: 'earlier-unrelated-fighter',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.acceptedWarnings,
  ).toHaveLength(2);
  for (const operationId of ['earlier-cleric-two', 'earlier-cleric-three'])
    await owner.mutation(api.characterSheet.addClassLevel, {
      ...scope,
      classEntryId: cleric._id,
      position: 1,
      operationId,
    });
  const changed = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    changed?.calculated.prerequisites
      .filter((check) => check.entryId === feat)
      .map((check) => check.met),
  ).toEqual([false, false, false, false]);
  expect(changed?.acceptedWarnings).toEqual([]);
});

test('specific-spell and spell-level prerequisites are both unmet without casting', async () => {
  const { t, owner, scope, catalog } = await fixture();
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', catalog.feat, {
      prerequisites: [
        { canCast: { spellLevel: 1 } },
        { castsSpell: 'not-castable' },
      ],
    }),
  );
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const level = initial?.entries.find((entry) => entry.kind === 'classLevel');
  const fighter = initial?.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'fighter',
  );
  if (!level || !fighter) throw new Error('Missing Fighter and Class Level');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: fighter._id,
    operationId: 'noncasting-fighter',
  });
  const feat = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: catalog.feat,
    gainedAtClassLevel: level._id,
    operationId: 'no-casting',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    saved?.calculated.prerequisites
      .filter((check) => check.entryId === feat)
      .map((check) => check.met),
  ).toEqual([false, false, false, false]);
});

test('recorded warning acceptance survives unrelated Selection removal and relinking and dated item edits', async () => {
  const { t, owner, scope, catalog } = await fixture();
  const itemCatalogId = await t.run(async (ctx) => {
    await ctx.db.patch('catalogEntry', catalog.replacement, {
      prerequisites: [{ ability: 'strength', min: 15 }],
    });
    await ctx.db.patch('catalogEntry', catalog.trait, {
      modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 1 }],
    });
    return ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: scope.characterId,
      name: 'Dated keepsake',
      ruleIdentity: 'dated-keepsake',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'item', consumable: false },
    });
  });
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const level = initial?.entries.find((entry) => entry.kind === 'classLevel');
  if (!level) throw new Error('Missing Class Level');
  const unrelated = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: catalog.feat,
    gainedAtClassLevel: level._id,
    operationId: 'unrelated-first',
  });
  const relevant = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: catalog.trait,
    gainedAtClassLevel: level._id,
    operationId: 'relevant-second',
  });
  const dependent = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: catalog.replacement,
    gainedAtClassLevel: level._id,
    operationId: 'dependent-third',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const warning = before?.calculated.warnings.find(
    (row) =>
      row.check === 'prerequisites.recordedLevel' &&
      row.subject.startsWith(dependent),
  );
  if (!warning) throw new Error('Missing recorded prerequisite warning');
  await owner.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
    operationId: 'accept-recorded',
  });
  const expectAccepted = async () =>
    expect(
      withSheetCatalog(await owner.query(api.characterSheet.read, scope))
        ?.acceptedWarnings,
    ).toMatchObject([
      {
        check: warning.check,
        subject: warning.subject,
        fingerprint: warning.fingerprint,
      },
    ]);
  await owner.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: unrelated,
    gainedAtClassLevel: null,
    operationId: 'unlink-unrelated',
  });
  await expectAccepted();
  await owner.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: unrelated,
    gainedAtClassLevel: level._id,
    operationId: 'relink-unrelated',
  });
  await expectAccepted();
  await owner.mutation(api.characterSheet.clearSelectionSlot, {
    ...scope,
    entryId: unrelated,
    operationId: 'remove-unrelated',
  });
  await expectAccepted();
  const item = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: itemCatalogId,
    gainedAtClassLevel: level._id,
    choiceOrder: 0,
    operationId: 'dated-item',
  });
  await expectAccepted();
  await owner.mutation(api.characterSheet.moveSelection, {
    ...scope,
    entryId: item,
    direction: 'earlier',
    operationId: 'undated-item-no-move',
  });
  await expectAccepted();
  await owner.mutation(api.characterSheet.removeSheetEntry, {
    ...scope,
    entryId: item,
    operationId: 'remove-item',
  });
  await expectAccepted();
  await owner.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: relevant,
    active: false,
    operationId: 'remove-relevant-benefit',
  });
  const after = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    after?.calculated.prerequisites.find(
      (check) => check.entryId === dependent && check.view === 'recorded',
    )?.met,
  ).toBe(false);
  expect(after?.acceptedWarnings).toEqual([]);
});

test('seeded two-weapon feats fill ordinary slots with typed advisory prerequisites and remain reusable after clearing', async () => {
  const { owner, member, scope } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const expected = [
    {
      identity: 'two-weapon-fighting',
      page: '136',
      prerequisites: [{ ability: 'dexterity', min: 15 }],
    },
    {
      identity: 'improved-two-weapon-fighting',
      page: '127',
      prerequisites: [
        { ability: 'dexterity', min: 17 },
        { feat: 'two-weapon-fighting' },
        { bab: 6 },
      ],
    },
    {
      identity: 'greater-two-weapon-fighting',
      page: '125',
      prerequisites: [
        { ability: 'dexterity', min: 19 },
        { feat: 'improved-two-weapon-fighting' },
        { feat: 'two-weapon-fighting' },
        { bab: 11 },
      ],
    },
    {
      identity: 'double-slice',
      page: '122',
      prerequisites: [
        { ability: 'dexterity', min: 15 },
        { feat: 'two-weapon-fighting' },
      ],
    },
  ];
  for (const { identity, page, prerequisites } of expected) {
    const definitions = initial?.catalogEntries.filter(
      (row) => row.ruleIdentity === identity,
    );
    expect(definitions).toHaveLength(1);
    const definition = definitions?.[0];
    if (!definition) throw new Error(`Missing seeded ${identity}`);
    expect(definition).toMatchObject({
      detail: { kind: 'feat', featTypes: ['combat'], repeatable: 'no' },
      sources: [{ book: 'Pathfinder RPG Core Rulebook', pages: page }],
      prerequisites,
    });
    const entryId = await member.mutation(
      api.characterSheet.fillSelectionSlot,
      {
        ...scope,
        slotId: 'feat:general',
        position: 0,
        catalogEntryId: definition._id,
        operationId: `select-${identity}`,
      },
    );
    const selected = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    expect(selected?.entries.find((row) => row._id === entryId)).toMatchObject({
      active: true,
      selectionSlot: { id: 'feat:general', position: 0 },
      catalogEntryId: definition._id,
    });
    expect(
      selected?.calculated.warnings.some(
        (warning) =>
          warning.check === 'prerequisites.current' &&
          warning.subject.startsWith(`${entryId}:`),
      ),
    ).toBe(true);
    await owner.mutation(api.characterSheet.clearSelectionSlot, {
      ...scope,
      entryId,
      operationId: `clear-${identity}`,
    });
    expect(
      withSheetCatalog(
        await member.query(api.characterSheet.read, scope),
      )?.catalogEntries.some((row) => row._id === definition._id),
    ).toBe(true);
  }
});

test('seeded Improved Two-Weapon Fighting checks its BAB +6 prerequisite at the recorded Class Level', async () => {
  const { owner, scope } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const fighter = initial?.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'fighter',
  );
  const improved = initial?.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'improved-two-weapon-fighting',
  );
  const first = initial?.entries.find((entry) => entry.kind === 'classLevel');
  if (!fighter || !improved || !first)
    throw new Error('Missing Fighter, seeded feat or Class Level');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    classEntryId: fighter._id,
    operationId: 'fighter-1',
  });
  const levels = [first._id];
  for (let position = 2; position <= 6; position += 1)
    levels.push(
      await owner.mutation(api.characterSheet.addClassLevel, {
        ...scope,
        classEntryId: fighter._id,
        operationId: `fighter-${position}`,
      }),
    );
  const feat = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: improved._id,
    gainedAtClassLevel: first._id,
    operationId: 'improved-two-weapon-fighting',
  });
  const babChecks = async () =>
    Object.fromEntries(
      (
        withSheetCatalog(await owner.query(api.characterSheet.read, scope))
          ?.calculated.prerequisites ?? []
      )
        .filter(
          (check) =>
            check.entryId === feat &&
            'bab' in check.clause &&
            check.clause.bab === 6,
        )
        .map((check) => [check.view, check.met]),
    );
  expect(await babChecks()).toEqual({ current: true, recorded: false });
  const warnings = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  )?.calculated.warnings.filter(
    (warning) =>
      warning.check === 'prerequisites.recordedLevel' &&
      warning.subject.startsWith(feat),
  );
  expect(warnings?.length).toBeGreaterThan(0);
  await owner.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: feat,
    gainedAtClassLevel: levels[5],
    operationId: 'record-at-sixth',
  });
  expect(await babChecks()).toEqual({ current: true, recorded: true });
});
