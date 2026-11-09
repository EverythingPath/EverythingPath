// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api, internal } from './_generated/api';
import schema from './schema';
import { calculateMilitiaCharacterFacts } from './lib/militiaCharacterFacts';

const modules = import.meta.glob('./**/*.ts');
// CRB p. 342 / removed legacy spell dataset Shield of Faith: +2, +1 every six caster levels, maximum +5 at 18th.
const shieldOfFaithFormula = 'min(5, 2 + floor(@casterLevel / 6))';
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
      name: 'Sheet entries',
      description: '',
      organizationId: 'org',
      ownerId: 'test|owner',
      e2eFixture: {
        namespace: 'entries',
        version: 1,
        workerKey: '0',
        caseKey: 'entries',
        campaignKey: 'entries',
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
    scope: { organizationId: 'org', characterId },
  };
}

test('members persist and edit structured Situational Notes through the authorized sheet API', async () => {
  const { owner, member, outsider, scope } = await fixture();
  const entryId = await member.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Hardy',
    modifiers: [],
    detail: { kind: 'item', consumable: false },
    operationId: 'notes',
    situationalNotes: [
      { target: 'saves', situation: 'poison', text: 'Reroll a failed save.' },
      { situation: { local: 'stabilizing' }, text: 'Stabilize automatically.' },
    ],
  });
  let sheet = await owner.query(api.characterSheet.read, scope);
  expect(sheet?.calculated.breakdowns['save.will']).toMatchObject({
    total: 0,
    notes: [
      expect.objectContaining({ sheetEntryId: entryId, situation: 'poison' }),
    ],
  });
  expect(sheet?.calculated.entryNotes).toEqual([
    expect.objectContaining({
      sheetEntryId: entryId,
      text: 'Stabilize automatically.',
    }),
  ]);
  await member.mutation(api.characterSheet.editSheetEntry, {
    ...scope,
    entryId,
    situationalNotes: [
      { target: 'save.will', situation: 'fear', text: 'Immune to fear.' },
    ],
    operationId: 'edit-notes',
  });
  sheet = await owner.query(api.characterSheet.read, scope);
  expect(sheet?.calculated.entryNotes).toEqual([]);
  expect(sheet?.calculated.breakdowns['save.will']?.notes?.[0]?.text).toBe(
    'Immune to fear.',
  );
  await expect(
    outsider.mutation(api.characterSheet.editSheetEntry, {
      ...scope,
      entryId,
      situationalNotes: [],
      operationId: 'forged-notes',
    }),
  ).rejects.toThrow();
  await expect(
    member.mutation(api.characterSheet.editSheetEntry, {
      ...scope,
      entryId,
      operationId: 'conflicting-note-situations',
      situationalNotes: [
        {
          situation: 'fear',
          condition: { situation: 'poison' },
          text: 'Reroll a save.',
        },
      ],
    }),
  ).rejects.toThrow('Situational Note is invalid');
});

test('members record damage without changing scores and drain in both projections, and edit, deactivate and remove those entries', async () => {
  // #298; data model Resolution stages 1–2 / Temporary Effects; CRB pp. 555–556.
  const { owner, member, scope } = await fixture();
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 16 },
    operationId: 'base',
  });
  const entryId = await member.mutation(
    api.characterSheet.createAbilityChange,
    {
      ...scope,
      kind: 'abilityDamage',
      ability: 'strength',
      points: 3,
      operationId: 'damage',
    },
  );
  let sheet = await owner.query(api.characterSheet.read, scope);
  expect(sheet?.calculated.abilities.strength).toEqual({
    score: 16,
    modifier: 2,
  });
  expect(sheet?.permanentCalculated.abilities.strength).toEqual({
    score: 16,
    modifier: 3,
  });
  await member.mutation(api.characterSheet.editAbilityChange, {
    ...scope,
    entryId,
    points: 4,
    operationId: 'damage-edit',
  });
  sheet = await owner.query(api.characterSheet.read, scope);
  expect(sheet?.calculated.abilities.strength).toEqual({
    score: 16,
    modifier: 1,
  });
  await member.mutation(api.characterSheet.editAbilityChange, {
    ...scope,
    entryId,
    active: false,
    operationId: 'off',
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.calculated.abilities
      .strength.modifier,
  ).toBe(3);
  await member.mutation(api.characterSheet.removeAbilityChange, {
    ...scope,
    entryId,
    operationId: 'remove',
  });
  await member.mutation(api.characterSheet.createAbilityChange, {
    ...scope,
    kind: 'abilityDrain',
    ability: 'strength',
    points: 3,
    operationId: 'drain',
  });
  sheet = await owner.query(api.characterSheet.read, scope);
  expect(sheet?.calculated.abilities.strength).toEqual({
    score: 13,
    modifier: 1,
  });
  expect(sheet?.permanentCalculated.abilities.strength).toEqual({
    score: 13,
    modifier: 1,
  });
});

test.each([
  {
    detail: {
      kind: 'spellEffect' as const,
      lastsOverOneDay: false,
      defaultCasterLevel: 6,
    },
    permanent: 10,
  },
  {
    detail: {
      kind: 'spellEffect' as const,
      lastsOverOneDay: true,
      defaultCasterLevel: 6,
    },
    permanent: 14,
  },
  { detail: { kind: 'condition' as const }, permanent: 10 },
  { detail: { kind: 'item' as const, consumable: true }, permanent: 10 },
  { detail: { kind: 'item' as const, consumable: false }, permanent: 14 },
  { detail: { kind: 'spell' as const }, permanent: 10 },
])(
  'entry $detail persists exact classification and calculates current/permanent values',
  async ({ detail, permanent }) => {
    // #298 Temporary Effects table; a recorded spell grants no Modifiers.
    const { owner, member, scope } = await fixture();
    const entryId = await member.mutation(api.characterSheet.createSheetEntry, {
      ...scope,
      name: 'Strength entry',
      detail,
      modifiers: [
        { target: 'ability.str', bonusType: 'enhancement', value: 4 },
      ],
      operationId: 'entry',
    });
    const sheet = await owner.query(api.characterSheet.read, scope);
    const recorded = sheet?.entries.find((entry) => entry._id === entryId);
    expect(recorded).toMatchObject({ kind: detail.kind, active: true });
    const catalogEntryId =
      recorded && 'catalogEntryId' in recorded
        ? recorded.catalogEntryId
        : undefined;
    expect(
      sheet?.catalogEntries.find((entry) => entry._id === catalogEntryId)
        ?.detail,
    ).toEqual(detail);
    expect(sheet?.calculated.abilities.strength.score).toBe(
      detail.kind === 'spell' ? 10 : 14,
    );
    expect(sheet?.permanentCalculated.abilities.strength.score).toBe(permanent);
    await member.mutation(api.characterSheet.editSheetEntry, {
      ...scope,
      entryId,
      active: false,
      operationId: 'off',
    });
    expect(
      (await owner.query(api.characterSheet.read, scope))?.calculated.abilities
        .strength.score,
    ).toBe(10);
    await member.mutation(api.characterSheet.removeSheetEntry, {
      ...scope,
      entryId,
      operationId: 'remove',
    });
    expect(
      (await owner.query(api.characterSheet.read, scope))?.entries.some(
        (entry) => entry._id === entryId,
      ),
    ).toBe(false);
  },
);

test('personal formulas retain unsupported text and contribute nothing with a targeted warning', async () => {
  // #298 Formulas: closed arithmetic; unsupported expressions stay on the entry.
  const { owner, scope } = await fixture();
  const entryId = await owner.mutation(
    api.characterSheet.createPersonalAdjustment,
    {
      ...scope,
      name: 'Unsupported formula',
      modifiers: [
        {
          target: 'init',
          bonusType: 'untyped',
          value: { formula: 'globalThis.process.exit()' },
        },
      ],
      operationId: 'formula',
    },
  );
  const sheet = await owner.query(api.characterSheet.read, scope);
  expect(sheet?.calculated.breakdowns.init?.total).toBe(0);
  expect(sheet?.calculated.warnings).toContainEqual(
    expect.objectContaining({
      check: 'unsupportedFormula',
      target: { kind: 'modifier', entryId, modifierIndex: 0 },
    }),
  );
  expect(
    sheet?.catalogEntries.find((entry) => entry.name === 'Unsupported formula')
      ?.modifiers[0]?.value,
  ).toEqual({ formula: 'globalThis.process.exit()' });
});

test('a safe current ability cannot conceal an unsafe permanent formula total in a campaign without a militia', async () => {
  const { owner, scope } = await fixture();
  await owner.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Temporary penalty',
    detail: { kind: 'condition' },
    modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: -1 }],
    operationId: 'temporary-penalty',
  });
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: Number.MAX_SAFE_INTEGER - 1 },
    operationId: 'safe-base',
  });
  const before = await owner.query(api.characterSheet.read, scope);
  await expect(
    owner.mutation(api.characterSheet.createPersonalAdjustment, {
      ...scope,
      name: 'Permanent formula',
      modifiers: [
        {
          target: 'ability.str',
          bonusType: 'untyped',
          value: { formula: '2' },
        },
      ],
      operationId: 'unsafe-permanent',
    }),
  ).rejects.toThrow('Enter whole ability scores');
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
});

test('entry edits preserve identity and override caster level defaults without accepting invalid data', async () => {
  // #298 formulas / Spell Effect caster level: recorded value overrides deterministic default.
  const { owner, member, scope } = await fixture();
  const entryId = await owner.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Shield of faith',
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 6,
    },
    modifiers: [
      {
        target: 'ac.other',
        bonusType: 'deflection',
        value: { formula: shieldOfFaithFormula },
      },
    ],
    operationId: 'spell',
  });
  let sheet = await owner.query(api.characterSheet.read, scope);
  expect(sheet?.calculated.derivedStatistics.ac.total).toBe(13);
  const catalogId = sheet?.entries.find((entry) => entry._id === entryId);
  expect(catalogId).toMatchObject({
    state: { kind: 'spellEffect', casterLevel: 6 },
  });
  await member.mutation(api.characterSheet.editSheetEntry, {
    ...scope,
    entryId,
    casterLevel: 12,
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: true,
      defaultCasterLevel: 6,
    },
    operationId: 'edit',
  });
  sheet = await owner.query(api.characterSheet.read, scope);
  expect(sheet?.entries.find((entry) => entry._id === entryId)).toMatchObject({
    state: { kind: 'spellEffect', casterLevel: 12 },
  });
  expect(sheet?.permanentCalculated.derivedStatistics.ac.total).toBe(14);
  for (const points of [-1, 0.5, NaN, Infinity])
    await expect(
      owner.mutation(api.characterSheet.createAbilityChange, {
        ...scope,
        kind: 'abilityDamage',
        ability: 'strength',
        points,
        operationId: 'invalid',
      }),
    ).rejects.toThrow();
  await expect(
    owner.mutation(api.characterSheet.createSheetEntry, {
      ...scope,
      name: 'Bad default',
      detail: {
        kind: 'spellEffect',
        lastsOverOneDay: false,
        defaultCasterLevel: Infinity,
      },
      modifiers: [],
      operationId: 'invalid',
    }),
  ).rejects.toThrow();
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(sheet);
});

test('every new entry and ability writer enforces membership, row ownership and the Write Gate', async () => {
  // #298 shared persistence/auth; #258 every writer uses the same Write Gate.
  const { t, owner, outsider, scope, campaignId } = await fixture();
  const abilityId = await owner.mutation(
    api.characterSheet.createAbilityChange,
    {
      ...scope,
      kind: 'abilityDamage',
      ability: 'strength',
      points: 2,
      operationId: 'damage',
    },
  );
  const entryId = await owner.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Blessing',
    detail: { kind: 'condition' },
    modifiers: [],
    operationId: 'entry',
  });
  const before = await owner.query(api.characterSheet.read, scope);
  const commands = (
    caller: typeof owner,
    target = scope,
    writeEpoch?: number,
  ) => [
    () =>
      caller.mutation(api.characterSheet.createAbilityChange, {
        ...target,
        writeEpoch,
        kind: 'abilityDrain',
        ability: 'strength',
        points: 2,
        operationId: 'blocked',
      }),
    () =>
      caller.mutation(api.characterSheet.editAbilityChange, {
        ...target,
        writeEpoch,
        entryId: abilityId,
        points: 4,
        operationId: 'blocked',
      }),
    () =>
      caller.mutation(api.characterSheet.removeAbilityChange, {
        ...target,
        writeEpoch,
        entryId: abilityId,
        operationId: 'blocked',
      }),
    () =>
      caller.mutation(api.characterSheet.createSheetEntry, {
        ...target,
        writeEpoch,
        name: 'Effect',
        detail: { kind: 'condition' },
        modifiers: [],
        operationId: 'blocked',
      }),
    () =>
      caller.mutation(api.characterSheet.editSheetEntry, {
        ...target,
        writeEpoch,
        entryId: entryId,
        name: 'Changed',
        operationId: 'blocked',
      }),
    () =>
      caller.mutation(api.characterSheet.removeSheetEntry, {
        ...target,
        writeEpoch,
        entryId: entryId,
        operationId: 'blocked',
      }),
  ];
  for (const caller of [outsider, t])
    for (const command of commands(caller))
      await expect(command()).rejects.toThrow();
  const otherId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Other',
    kind: 'pc',
    operationId: 'other',
  });
  for (const command of commands(owner, {
    ...scope,
    characterId: otherId,
  }).filter((_, index) => ![0, 3].includes(index)))
    await expect(command()).rejects.toThrow('does not belong');
  await t.run((ctx) =>
    ctx.db.patch('campaign', campaignId, { e2eFixture: undefined }),
  );
  for (const command of commands(owner))
    await expect(command()).rejects.toThrow("aren't available");
  await t.run(async (ctx) => {
    await ctx.db.patch('campaign', campaignId, {
      e2eFixture: {
        namespace: 'entries',
        version: 1,
        workerKey: '0',
        caseKey: 'entries',
        campaignKey: 'entries',
      },
    });
    await ctx.db.insert('campaignCutover', {
      key: 'weekly-draft',
      status: 'paused',
      operationId: 'pause',
      oldRelease: 'old',
      newRelease: 'new',
      campaignIds: [],
      pausedAt: 0,
    });
  });
  for (const command of commands(owner))
    await expect(command()).rejects.toThrow('paused');
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
  await t.run(async (ctx) => {
    const pause = await ctx.db
      .query('campaignCutover')
      .withIndex('by_key', (q) => q.eq('key', 'weekly-draft'))
      .unique();
    if (pause) await ctx.db.delete('campaignCutover', pause._id);
  });
  const receipt = await t.mutation(internal.initialMigration.start, {
    operationId: 'entries-maintenance',
    expectedEpoch: 0,
    frontendBuild: 'build-298',
    catalogManifest: 'fixture',
    maintenanceBudgetMs: 60000,
  });
  for (const command of commands(owner))
    await expect(command()).rejects.toThrow('MAINTENANCE');
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
  await t.mutation(internal.initialMigration.abortBeforeActivation, receipt);
  for (const command of commands(owner))
    await expect(command()).rejects.toThrow('RELOAD_REQUIRED');
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
  for (const command of commands(owner, scope, 2)) await command();
});

test('private entry rows are editable only by their owner and remain gated on the prepared demo', async () => {
  const { t, owner, member } = await fixture();
  await t.run(async (ctx) => {
    const user = await ctx.db
      .query('user')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', 'test|owner'),
      )
      .unique();
    if (!user) throw new Error('Missing owner');
    await ctx.db.patch('user', user._id, { characterSheetDemo: true });
  });
  const characterId = await owner.mutation(api.characterSheet.create, {
    name: 'Private',
    kind: 'pc',
    operationId: 'private',
  });
  const scope = { characterId };
  const entryId = await owner.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Condition',
    detail: { kind: 'condition' },
    modifiers: [],
    operationId: 'entry',
  });
  await expect(
    member.mutation(api.characterSheet.editSheetEntry, {
      ...scope,
      entryId,
      active: false,
      operationId: 'denied',
    }),
  ).rejects.toThrow();
  await expect(member.query(api.characterSheet.read, scope)).rejects.toThrow();
  await owner.mutation(api.characterSheet.editSheetEntry, {
    ...scope,
    entryId,
    active: false,
    operationId: 'allowed',
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.entries.find(
      (row) => row._id === entryId,
    )?.active,
  ).toBe(false);
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, { sheetDemo: undefined }),
  );
  await expect(
    owner.mutation(api.characterSheet.removeSheetEntry, {
      ...scope,
      entryId,
      operationId: 'blocked',
    }),
  ).rejects.toThrow("isn't available");
});

test('every state writer preserves current acceptances and entry edits prune stale formula warnings before recording the change', async () => {
  // #262/#298: warning acceptance is tied to current semantic facts, never resurrected.
  const { owner, scope } = await fixture();
  const entryId = await owner.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Formula',
    detail: { kind: 'condition' },
    modifiers: [
      {
        target: 'init',
        bonusType: 'untyped',
        value: { formula: 'unsupported' },
      },
    ],
    operationId: 'entry',
  });
  async function acceptCurrent() {
    const sheet = await owner.query(api.characterSheet.read, scope);
    const warning = sheet?.calculated.warnings.find(
      (row) => row.check === 'unsupportedFormula',
    );
    if (!warning) throw new Error('Missing formula warning');
    await owner.mutation(api.characterSheet.acceptWarning, {
      ...scope,
      check: warning.check,
      subject: warning.subject,
      fingerprint: warning.fingerprint,
      operationId: 'accept',
    });
  }
  await acceptCurrent();
  const abilityId = await owner.mutation(
    api.characterSheet.createAbilityChange,
    {
      ...scope,
      kind: 'abilityDamage',
      ability: 'strength',
      points: 2,
      operationId: 'damage',
    },
  );
  await owner.mutation(api.characterSheet.editAbilityChange, {
    ...scope,
    entryId: abilityId,
    points: 4,
    operationId: 'edit-damage',
  });
  await owner.mutation(api.characterSheet.removeAbilityChange, {
    ...scope,
    entryId: abilityId,
    operationId: 'remove-damage',
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.acceptedWarnings,
  ).toHaveLength(1);
  await owner.mutation(api.characterSheet.editSheetEntry, {
    ...scope,
    entryId: entryId,
    modifiers: [
      {
        target: 'init',
        bonusType: 'untyped',
        value: { formula: 'anotherUnsupported' },
      },
    ],
    operationId: 'edit-formula',
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.acceptedWarnings,
  ).toEqual([]);
  await acceptCurrent();
  await owner.mutation(api.characterSheet.editSheetEntry, {
    ...scope,
    entryId: entryId,
    active: false,
    operationId: 'off',
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.acceptedWarnings,
  ).toEqual([]);
  await owner.mutation(api.characterSheet.editSheetEntry, {
    ...scope,
    entryId: entryId,
    active: true,
    operationId: 'on',
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.acceptedWarnings,
  ).toEqual([]);
  await acceptCurrent();
  await owner.mutation(api.characterSheet.removeSheetEntry, {
    ...scope,
    entryId: entryId,
    operationId: 'remove',
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.acceptedWarnings,
  ).toEqual([]);
});

test('Militia Character Facts can read the same ordinary permanent calculation without changing legacy authority', async () => {
  // #298 Temporary Effects / Militia Character Facts: short entries and damage never enter facts.
  const { t, owner, scope } = await fixture();
  await owner.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Long Strength',
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: true,
      defaultCasterLevel: 1,
    },
    modifiers: [{ target: 'ability.str', bonusType: 'enhancement', value: 4 }],
    operationId: 'long',
  });
  await owner.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Short Wisdom',
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 1,
    },
    modifiers: [{ target: 'ability.wis', bonusType: 'enhancement', value: 4 }],
    operationId: 'short',
  });
  await owner.mutation(api.characterSheet.createAbilityChange, {
    ...scope,
    kind: 'abilityDrain',
    ability: 'strength',
    points: 1,
    operationId: 'drain',
  });
  await owner.mutation(api.characterSheet.createAbilityChange, {
    ...scope,
    kind: 'abilityDamage',
    ability: 'wisdom',
    points: 4,
    operationId: 'damage',
  });
  const sheet = await owner.query(api.characterSheet.read, scope);
  if (!sheet) throw new Error('Missing sheet');
  expect(
    await t.run((ctx) =>
      calculateMilitiaCharacterFacts(ctx, sheet.character, sheet),
    ),
  ).toMatchObject({
    level: 1,
    strength: 13,
    wisdom: 10,
  });
  expect(
    await t.run((ctx) => calculateMilitiaCharacterFacts(ctx, sheet.character)),
  ).toMatchObject({ level: 1, strength: 13, wisdom: 10 });
  expect(
    await t.run((ctx) =>
      calculateMilitiaCharacterFacts(ctx, sheet.character, null),
    ),
  ).toMatchObject({
    level: 1,
    strength: 10,
    wisdom: 10,
  });
});

test('Shield of faith grants its deflection bonus at caster-level boundaries and respects its cap', async () => {
  // CRB p. 342 / removed legacy spell dataset Shield of Faith: +2, +1 every six caster levels, maximum +5 at 18th.
  const { owner, scope } = await fixture();
  const entryId = await owner.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Shield of faith',
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 1,
    },
    modifiers: [
      {
        target: 'ac.other',
        bonusType: 'deflection',
        value: { formula: shieldOfFaithFormula },
      },
    ],
    operationId: 'shield',
  });
  for (const [casterLevel, ac] of [
    [1, 12],
    [6, 13],
    [12, 14],
    [18, 15],
    [20, 15],
  ]) {
    await owner.mutation(api.characterSheet.editSheetEntry, {
      ...scope,
      entryId,
      casterLevel,
      operationId: `shield-${casterLevel}`,
    });
    const sheet = await owner.query(api.characterSheet.read, scope);
    expect(sheet?.calculated.derivedStatistics.ac.total).toBe(ac);
  }
});
