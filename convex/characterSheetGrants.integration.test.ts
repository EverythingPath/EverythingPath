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
      });
    return ctx.db.insert('campaign', {
      name: 'Grant fixture',
      description: '',
      organizationId: 'org',
      ownerId: 'test|owner',
      e2eFixture: {
        namespace: 'grants',
        version: 1,
        workerKey: '0',
        caseKey: 'grants',
        campaignKey: 'grants',
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
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const level = before?.entries.find((entry) => entry.kind === 'classLevel');
  const fighter = before?.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'fighter',
  );
  if (
    !level ||
    fighter?.detail.kind !== 'class' ||
    !('featuresByLevel' in fighter.detail)
  )
    throw new Error('Missing fixture class');
  const fighterDetail = fighter.detail;
  const featureId = await t.run(async (ctx) => {
    const featureId = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Armor Training',
      ruleIdentity: 'armor-training',
      stacksWithItself: false,
      sources: [],
      detail: { kind: 'classFeature' },
      modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 2 }],
    });
    await ctx.db.patch('catalogEntry', fighter._id, {
      detail: {
        ...fighterDetail,
        featuresByLevel: [{ classLevel: 1, catalogEntryId: featureId }],
      },
    });
    return featureId;
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: fighter._id,
    operationId: 'fighter',
  });
  return {
    t,
    owner,
    member,
    outsider,
    scope,
    campaignId,
    characterId,
    level,
    fighter,
    featureId,
  };
}

test('untouched class Grants count without materializing sheet rows', async () => {
  const { owner, scope, featureId } = await fixture();
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(sheet?.entries).toHaveLength(2);
  expect(sheet?.catalogEntries.some((entry) => entry._id === featureId)).toBe(
    true,
  );
  expect(sheet?.calculated.abilities.strength.score).toBe(12);
});

test('a granted condition retains its notes through dormancy, Keep and source restoration without leaking permanent effects', async () => {
  const { t, owner, member, scope, featureId, level, fighter } =
    await fixture();
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', featureId, {
      name: 'Fatigued',
      ruleIdentity: 'local/crb-condition/fatigued',
      detail: { kind: 'condition', conditionKey: 'fatigued' },
      modifiers: [
        { target: 'ability.str', bonusType: 'untyped', value: -2 },
        { target: 'ability.dex', bonusType: 'untyped', value: -2 },
      ],
    }),
  );
  const grantKey = {
    source: 'fighter',
    classLevel: 1,
    entry: 'local/crb-condition/fatigued',
  };
  await member.mutation(api.characterSheet.editGrantState, {
    ...scope,
    grantKey,
    state: { notes: 'From the forced march' },
    operationId: 'record-condition',
  });
  const active = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(active?.calculated.abilities.strength.score).toBe(8);
  expect(active?.calculated.conditionEffects).toContainEqual(
    expect.objectContaining({ conditionKey: 'fatigued' }),
  );
  expect(active?.permanentCalculated.abilities.strength.score).toBe(10);
  expect(active?.permanentCalculated.conditionEffects).toEqual([]);

  await member.mutation(api.characterSheet.deleteClassLevel, {
    ...scope,
    entryId: level._id,
    operationId: 'lose-source',
  });
  const dormant = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(dormant?.calculated.abilities.strength.score).toBe(10);
  expect(dormant?.calculated.conditionEffects).toEqual([]);
  expect(dormant?.calculated.resolvedEntries).toContainEqual(
    expect.objectContaining({
      dormant: true,
      counting: false,
      entry: expect.objectContaining({ notes: 'From the forced march' }),
    }),
  );

  await owner.mutation(api.characterSheet.setDormantEntryKept, {
    ...scope,
    target: { grantKey },
    kept: true,
    operationId: 'keep-condition',
  });
  const kept = withSheetCatalog(
    await member.query(api.characterSheet.read, scope),
  );
  expect(kept?.calculated.abilities.strength.score).toBe(8);
  expect(kept?.calculated.warnings).toContainEqual(
    expect.objectContaining({ check: 'keptDormant' }),
  );
  expect(kept?.permanentCalculated.abilities.strength.score).toBe(10);
  expect(kept?.permanentCalculated.conditionEffects).toEqual([]);

  await member.mutation(api.characterSheet.setDormantEntryKept, {
    ...scope,
    target: { grantKey },
    kept: false,
    operationId: 'unkeep-condition',
  });
  await owner.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: fighter._id,
    operationId: 'restore-source',
  });
  const restored = withSheetCatalog(
    await member.query(api.characterSheet.read, scope),
  );
  expect(restored?.calculated.abilities.strength.score).toBe(8);
  expect(restored?.calculated.conditionEffects).toHaveLength(1);
  expect(restored?.calculated.resolvedEntries).toContainEqual(
    expect.objectContaining({
      dormant: false,
      counting: true,
      recorded: true,
      entry: expect.objectContaining({ notes: 'From the forced march' }),
    }),
  );
  expect(restored?.permanentCalculated.abilities.strength.score).toBe(10);
  expect(restored?.permanentCalculated.conditionEffects).toEqual([]);
});

test.each(['replaced', 'sourceMissing'] as const)(
  'un-Keep removes Keep-only state from an untouched %s Grant',
  async (reason) => {
    const { t, owner, scope, characterId, fighter, featureId } =
      await fixture();
    const archetypeId = await t.run((ctx) =>
      ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        name: 'Weapon Master',
        ruleIdentity: 'weapon-master',
        stacksWithItself: false,
        sources: [],
        modifiers: [],
        detail: {
          kind: 'archetype',
          classEntryIds: [fighter._id],
          adds: [],
          replaces: [{ classLevel: 1, catalogEntryId: featureId }],
        },
      }),
    );
    await owner.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: archetypeId,
      operationId: 'replace',
    });
    const grantKey = {
      source: 'fighter',
      classLevel: 1,
      entry: 'armor-training',
    };
    await owner.mutation(api.characterSheet.setDormantEntryKept, {
      ...scope,
      target: { grantKey },
      kept: true,
      operationId: 'keep',
    });
    if (reason === 'sourceMissing') {
      const before = withSheetCatalog(
        await owner.query(api.characterSheet.read, scope),
      );
      const level = before?.entries.find(
        (entry) => entry.kind === 'classLevel',
      );
      if (!level) throw new Error('Missing fixture level');
      await owner.mutation(api.characterSheet.deleteClassLevel, {
        ...scope,
        entryId: level._id,
        operationId: 'lose-source',
      });
    }
    await owner.mutation(api.characterSheet.setDormantEntryKept, {
      ...scope,
      target: { grantKey },
      kept: false,
      operationId: 'unkeep',
    });
    const after = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    expect(after?.entries).toHaveLength(reason === 'replaced' ? 3 : 2);
    const grant = after?.calculated.resolvedEntries.find(
      (row) => row.origin === 'grant',
    );
    if (reason === 'replaced')
      expect(grant).toMatchObject({
        dormant: true,
        counting: false,
        recorded: false,
        reason: { kind: 'replaced' },
      });
    else expect(grant).toBeUndefined();
  },
);

test('reads schema-added item state through stored and resolved entries', async () => {
  const { t, owner, scope, characterId } = await fixture();
  const entryId = await t.run(async (ctx) => {
    const catalogEntryId = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Fine sword',
      ruleIdentity: 'fine-sword',
      sources: [],
      stacksWithItself: false,
      modifiers: [],
      detail: { kind: 'item', consumable: false },
    });
    return ctx.db.insert('characterSheetEntry', {
      characterId,
      catalogEntryId,
      kind: 'item',
      active: true,
      state: { kind: 'item', masterwork: true },
    });
  });
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(sheet?.entries.find((entry) => entry._id === entryId)).toMatchObject({
    state: { kind: 'item', masterwork: true },
  });
  expect(
    sheet?.calculated.resolvedEntries.find((row) => row.entry._id === entryId),
  ).toMatchObject({
    entry: { state: { kind: 'item', masterwork: true } },
  });
});

test.each([
  'off',
  'choice',
  'notes',
  'catalogOverride',
  'item',
  'spellEffect',
  'featSlot',
  'selection',
] as const)(
  'un-Keep preserves %s state rather than deleting the entry',
  async (recorded) => {
    const { t, owner, scope, level, featureId } = await fixture();
    if (recorded === 'item')
      await t.run((ctx) =>
        ctx.db.patch('catalogEntry', featureId, {
          detail: { kind: 'item', consumable: false },
        }),
      );
    if (recorded === 'spellEffect')
      await t.run((ctx) =>
        ctx.db.patch('catalogEntry', featureId, {
          detail: {
            kind: 'spellEffect',
            defaultCasterLevel: 3,
            lastsOverOneDay: true,
          },
        }),
      );
    if (recorded === 'featSlot')
      await t.run((ctx) =>
        ctx.db.patch('catalogEntry', featureId, {
          detail: { kind: 'feat' },
        }),
      );
    const grantKey = {
      source: 'fighter',
      classLevel: 1,
      entry: 'armor-training',
    };
    const target =
      recorded === 'selection'
        ? {
            entryId: await owner.mutation(api.characterSheet.selectEntry, {
              ...scope,
              catalogEntryId: featureId,
              selectionSource: {
                kind: 'slot',
                grantedBy: { kind: 'grant', grantKey },
              },
              operationId: 'select',
            }),
          }
        : { grantKey };
    if (recorded !== 'selection')
      await owner.mutation(api.characterSheet.editGrantState, {
        ...scope,
        grantKey,
        state: {
          ...(recorded === 'off' ? { active: false } : {}),
          ...(recorded === 'choice' ? { choice: 'strength' } : {}),
          ...(recorded === 'notes' ? { notes: 'Saved note' } : {}),
          ...(recorded === 'catalogOverride'
            ? { catalogEntryId: featureId }
            : {}),
        },
        operationId: 'record',
      });
    const before = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    const saved = before?.entries.find((entry) =>
      'entryId' in target
        ? entry._id === target.entryId
        : 'grantKey' in entry && entry.grantKey,
    );
    if (!saved) throw new Error('Missing saved entry');
    if (recorded === 'item')
      await t.run((ctx) =>
        ctx.db.patch('characterSheetEntry', saved._id, {
          state: { kind: 'item', masterwork: true },
        }),
      );
    if (recorded === 'spellEffect')
      await t.run((ctx) =>
        ctx.db.patch('characterSheetEntry', saved._id, {
          state: { kind: 'spellEffect', casterLevel: 8 },
        }),
      );
    if (recorded === 'featSlot')
      await t.run((ctx) =>
        ctx.db.patch('characterSheetEntry', saved._id, {
          state: { kind: 'feat', slot: 'general' },
        }),
      );
    await owner.mutation(api.characterSheet.deleteClassLevel, {
      ...scope,
      entryId: level._id,
      operationId: 'lose',
    });
    const dormant = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    await owner.mutation(api.characterSheet.setDormantEntryKept, {
      ...scope,
      target,
      kept: true,
      operationId: 'keep',
    });
    await owner.mutation(api.characterSheet.setDormantEntryKept, {
      ...scope,
      target,
      kept: false,
      operationId: 'unkeep',
    });
    const after = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    expect(after?.entries).toEqual(dormant?.entries);
  },
);

test('recorded Grant state goes dormant and returns once with off, choices and notes intact', async () => {
  const { owner, member, scope, level, fighter } = await fixture();
  const grantKey = {
    source: 'fighter',
    classLevel: 1,
    entry: 'armor-training',
  };
  await member.mutation(api.characterSheet.editGrantState, {
    ...scope,
    grantKey,
    state: { active: false, choice: 'strength', notes: 'Chosen at level one' },
    operationId: 'record',
  });
  await owner.mutation(api.characterSheet.deleteClassLevel, {
    ...scope,
    entryId: level._id,
    operationId: 'lose-source',
  });
  const dormant = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    dormant?.calculated.resolvedEntries.find((row) => row.origin === 'grant'),
  ).toMatchObject({
    dormant: true,
    counting: false,
    recorded: true,
    entry: {
      active: false,
      notes: 'Chosen at level one',
      state: { choice: 'strength' },
    },
  });
  await owner.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: fighter._id,
    operationId: 'restore',
  });
  const restored = withSheetCatalog(
    await member.query(api.characterSheet.read, scope),
  );
  const grants = restored?.calculated.resolvedEntries.filter(
    (row) => row.origin === 'grant',
  );
  expect(grants).toHaveLength(1);
  expect(grants?.[0]).toMatchObject({
    dormant: false,
    counting: false,
    entry: {
      active: false,
      notes: 'Chosen at level one',
      state: { choice: 'strength' },
    },
  });
  expect(restored?.calculated.abilities.strength.score).toBe(10);
});

test('Keep counts a missing Grant, un-Keep restores dormancy, and Discard drops state without defeating live derivation', async () => {
  const { owner, scope, level, fighter } = await fixture();
  const grantKey = {
    source: 'fighter',
    classLevel: 1,
    entry: 'armor-training',
  };
  await owner.mutation(api.characterSheet.editGrantState, {
    ...scope,
    grantKey,
    state: { notes: 'Keep my training' },
    operationId: 'notes',
  });
  await expect(
    owner.mutation(api.characterSheet.discardDormantEntry, {
      ...scope,
      target: { grantKey },
      operationId: 'discard-live',
    }),
  ).rejects.toThrow('Only dormant');
  await owner.mutation(api.characterSheet.deleteClassLevel, {
    ...scope,
    entryId: level._id,
    operationId: 'lose',
  });
  await owner.mutation(api.characterSheet.setDormantEntryKept, {
    ...scope,
    target: { grantKey },
    kept: true,
    operationId: 'keep',
  });
  const kept = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(kept?.calculated.abilities.strength.score).toBe(12);
  expect(kept?.calculated.warnings).toContainEqual(
    expect.objectContaining({ check: 'keptDormant' }),
  );
  await owner.mutation(api.characterSheet.setDormantEntryKept, {
    ...scope,
    target: { grantKey },
    kept: false,
    operationId: 'unkeep',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated.abilities.strength.score,
  ).toBe(10);
  await owner.mutation(api.characterSheet.discardDormantEntry, {
    ...scope,
    target: { grantKey },
    operationId: 'discard',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.entries,
  ).toHaveLength(1);
  await owner.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: fighter._id,
    operationId: 'restore',
  });
  const restored = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(restored?.calculated.abilities.strength.score).toBe(12);
  expect(
    restored?.calculated.resolvedEntries.filter(
      (row) => row.origin === 'grant',
    ),
  ).toHaveLength(1);
});

test('a selected feat in a Grant slot and its own nested Grant retain state across lost sources', async () => {
  const { t, owner, scope, level, fighter, featureId, characterId } =
    await fixture();
  const featId = await t.run(async (ctx) => {
    await ctx.db.patch('catalogEntry', featureId, {
      grantsSlots: [{ kind: 'feat', featTypes: ['combat'], count: 1 }],
    });
    const child = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Nested training',
      ruleIdentity: 'nested-training',
      stacksWithItself: false,
      sources: [],
      detail: { kind: 'classFeature' },
      modifiers: [{ target: 'ability.dex', bonusType: 'untyped', value: 2 }],
    });
    return ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Chosen combat feat',
      ruleIdentity: 'chosen-feat',
      stacksWithItself: false,
      sources: [],
      detail: { kind: 'feat' },
      grants: [{ catalogEntryId: child }],
      modifiers: [{ target: 'ability.con', bonusType: 'untyped', value: 2 }],
    });
  });
  const grantKey = {
    source: 'fighter',
    classLevel: 1,
    entry: 'armor-training',
  };
  const entryId = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: featId,
    notes: 'From bonus slot',
    selectionSource: { kind: 'slot', grantedBy: { kind: 'grant', grantKey } },
    operationId: 'select',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated.abilities.dexterity.score,
  ).toBe(12);
  await owner.mutation(api.characterSheet.deleteClassLevel, {
    ...scope,
    entryId: level._id,
    operationId: 'lose',
  });
  const dormant = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(dormant?.calculated.abilities.constitution.score).toBe(10);
  expect(dormant?.calculated.abilities.dexterity.score).toBe(10);
  expect(dormant?.entries.find((row) => row._id === entryId)).toMatchObject({
    notes: 'From bonus slot',
    selectionSource: { kind: 'slot', grantedBy: { kind: 'grant', grantKey } },
  });
  await owner.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: fighter._id,
    operationId: 'restore',
  });
  const restored = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(restored?.calculated.abilities.constitution.score).toBe(12);
  expect(restored?.calculated.abilities.dexterity.score).toBe(12);
  expect(restored?.entries.filter((row) => row._id === entryId)).toHaveLength(
    1,
  );
});

test('Accepted Warnings survive dormancy until their facts change and Discard removes their acceptance', async () => {
  const { t, owner, scope, level, fighter, featureId } = await fixture();
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', featureId, {
      modifiers: [
        {
          target: 'init',
          bonusType: 'untyped',
          value: { formula: 'unsupported' },
        },
      ],
    }),
  );
  async function acceptFormula() {
    const sheet = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    const warning = sheet?.calculated.warnings.find(
      (warning) => warning.check === 'unsupportedFormula',
    );
    if (!warning) throw new Error('Missing formula warning');
    await owner.mutation(api.characterSheet.acceptWarning, {
      ...scope,
      check: warning.check,
      subject: warning.subject,
      fingerprint: warning.fingerprint,
      operationId: 'accept',
    });
    return warning;
  }
  const grantKey = {
    source: 'fighter',
    classLevel: 1,
    entry: 'armor-training',
  };
  await owner.mutation(api.characterSheet.editGrantState, {
    ...scope,
    grantKey,
    state: { notes: 'Annotated warning' },
    operationId: 'record',
  });
  const warning = await acceptFormula();
  await owner.mutation(api.characterSheet.deleteClassLevel, {
    ...scope,
    entryId: level._id,
    operationId: 'lose',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.acceptedWarnings,
  ).toContainEqual(
    expect.objectContaining({
      subject: warning.subject,
      fingerprint: warning.fingerprint,
    }),
  );
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 13 },
    operationId: 'unrelated',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.acceptedWarnings,
  ).toHaveLength(1);
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', featureId, {
      modifiers: [
        {
          target: 'init',
          bonusType: 'untyped',
          value: { formula: 'different unsupported facts' },
        },
      ],
    }),
  );
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 14 },
    operationId: 'changed-facts',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.acceptedWarnings,
  ).toHaveLength(0);
  const newLevel = await owner.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: fighter._id,
    operationId: 'restore',
  });
  await acceptFormula();
  await owner.mutation(api.characterSheet.deleteClassLevel, {
    ...scope,
    entryId: newLevel,
    operationId: 'lose-again',
  });
  await owner.mutation(api.characterSheet.discardDormantEntry, {
    ...scope,
    target: { grantKey },
    operationId: 'discard',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.acceptedWarnings,
  ).toHaveLength(0);
});

test('every Grant and Selection writer enforces membership, scoped targets and both write gates', async () => {
  const { t, owner, outsider, scope, featureId, campaignId, level } =
    await fixture();
  const grantKey = {
    source: 'fighter',
    classLevel: 1,
    entry: 'armor-training',
  };
  const selected = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: featureId,
    operationId: 'selection',
  });
  await owner.mutation(api.characterSheet.editGrantState, {
    ...scope,
    grantKey,
    state: { notes: 'Saved' },
    operationId: 'grant',
  });
  await owner.mutation(api.characterSheet.deleteClassLevel, {
    ...scope,
    entryId: level._id,
    operationId: 'lose',
  });
  function writes(caller: typeof owner) {
    return [
      () =>
        caller.mutation(api.characterSheet.editGrantState, {
          ...scope,
          grantKey,
          state: { notes: 'Changed' },
          operationId: 'edit',
        }),
      () =>
        caller.mutation(api.characterSheet.setDormantEntryKept, {
          ...scope,
          target: { grantKey },
          kept: true,
          operationId: 'keep',
        }),
      () =>
        caller.mutation(api.characterSheet.discardDormantEntry, {
          ...scope,
          target: { grantKey },
          operationId: 'discard',
        }),
      () =>
        caller.mutation(api.characterSheet.selectEntry, {
          ...scope,
          catalogEntryId: featureId,
          operationId: 'select',
        }),
      () =>
        caller.mutation(api.characterSheet.editSelection, {
          ...scope,
          entryId: selected,
          notes: 'Changed',
          operationId: 'edit-selection',
        }),
    ];
  }
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  for (const caller of [t, outsider]) {
    await expect(
      caller.query(api.characterSheet.read, scope),
    ).rejects.toThrow();
    for (const write of writes(caller)) await expect(write()).rejects.toThrow();
  }
  await expect(
    owner.mutation(api.characterSheet.editGrantState, {
      ...scope,
      grantKey: { source: 'foreign-source', entry: 'armor-training' },
      state: { notes: 'Forged' },
      operationId: 'forged',
    }),
  ).rejects.toThrow('does not belong');
  const runId = await t.run((ctx) =>
    ctx.db.insert('initialMigrationRun', {
      operationId: 'gate',
      epoch: 0,
      state: 'maintenance',
      frontendBuild: 'test',
      catalogManifest: 'test',
      startedAt: 0,
      deadline: 1,
    }),
  );
  for (const policy of [
    {
      key: 'character-sheet',
      epoch: 0,
      authority: 'legacy' as const,
      closed: true,
    },
    {
      key: 'character-sheet',
      epoch: 1,
      authority: 'legacy' as const,
      closed: false,
    },
    {
      key: 'character-sheet',
      epoch: 0,
      authority: 'sheet' as const,
      closed: false,
    },
  ]) {
    const id = await t.run((ctx) =>
      ctx.db.insert('initialMigrationControl', {
        ...policy,
        key: 'character-sheet',
        runId,
      }),
    );
    for (const write of writes(owner)) await expect(write()).rejects.toThrow();
    await t.run((ctx) => ctx.db.delete('initialMigrationControl', id));
  }
  const cutover = await t.run((ctx) =>
    ctx.db.insert('campaignCutover', {
      key: 'weekly-draft',
      status: 'paused',
      operationId: 'paused',
      oldRelease: 'old',
      newRelease: 'new',
      campaignIds: [],
      pausedAt: 0,
    }),
  );
  for (const write of writes(owner)) await expect(write()).rejects.toThrow();
  await t.run((ctx) => ctx.db.delete('campaignCutover', cutover));
  await t.run((ctx) =>
    ctx.db.patch('campaign', campaignId, { e2eFixture: undefined }),
  );
  for (const write of writes(owner))
    await expect(write()).rejects.toThrow("aren't available");
  const after = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(after?.entries).toEqual(before?.entries);
  expect(after?.revision).toBe(before?.revision);
});

test('untouched future and nested catalog dependencies refuse foreign Character references', async () => {
  const { t, owner, scope, fighter, characterId } = await fixture();
  const otherCharacter = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId: scope.campaignId,
    name: 'Other',
    kind: 'pc',
    operationId: 'other',
  });
  const foreign = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: otherCharacter,
      name: 'Foreign feature',
      ruleIdentity: 'foreign-feature',
      sources: [],
      stacksWithItself: false,
      modifiers: [],
      detail: { kind: 'classFeature' },
    }),
  );
  if (fighter.detail.kind !== 'class' || !('featuresByLevel' in fighter.detail))
    throw new Error('Missing class');
  const detail = fighter.detail;
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', fighter._id, {
      detail: {
        ...detail,
        featuresByLevel: [{ classLevel: 20, catalogEntryId: foreign }],
      },
    }),
  );
  await expect(owner.query(api.characterSheet.read, scope)).rejects.toThrow(
    'dependency does not belong',
  );
  await t.run(async (ctx) => {
    await ctx.db.patch('catalogEntry', fighter._id, { detail });
    await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Unused parent',
      ruleIdentity: 'unused-parent',
      sources: [],
      stacksWithItself: false,
      modifiers: [],
      grants: [{ catalogEntryId: foreign }],
      detail: { kind: 'classFeature' },
    });
  });
  await expect(owner.query(api.characterSheet.read, scope)).rejects.toThrow(
    'dependency does not belong',
  );
});

test('recording Grant state follows source definition switches while deliberate detachment preserves a Catalog Copy', async () => {
  const { t, owner, scope, featureId, fighter } = await fixture();
  const grantKey = {
    source: 'fighter',
    classLevel: 1,
    entry: 'armor-training',
  };
  await owner.mutation(api.characterSheet.editGrantState, {
    ...scope,
    grantKey,
    state: { notes: 'Saved without detachment', choice: 'strength' },
    operationId: 'record',
  });
  const changedFeature = await t.run(async (ctx) => {
    const definition = await ctx.db.get('catalogEntry', featureId);
    const currentClass = await ctx.db.get('catalogEntry', fighter._id);
    if (
      definition?.detail.kind !== 'classFeature' ||
      currentClass?.detail.kind !== 'class' ||
      !('featuresByLevel' in currentClass.detail)
    )
      throw new Error('Missing definitions');
    const { _id, _creationTime, ...copy } = definition;
    const id = await ctx.db.insert('catalogEntry', {
      ...copy,
      detail: definition.detail,
      name: 'Campaign Armor Training',
      modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 4 }],
    });
    await ctx.db.patch('catalogEntry', fighter._id, {
      detail: {
        ...currentClass.detail,
        featuresByLevel: [{ classLevel: 1, catalogEntryId: id }],
      },
    });
    return id;
  });
  let sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(sheet?.calculated.abilities.strength.score).toBe(14);
  expect(
    sheet?.calculated.resolvedEntries.find((row) => row.origin === 'grant'),
  ).toMatchObject({
    entry: {
      catalogEntryId: changedFeature,
      notes: 'Saved without detachment',
      state: { choice: 'strength' },
    },
  });
  await owner.mutation(api.characterSheet.editGrantState, {
    ...scope,
    grantKey,
    state: { catalogEntryId: featureId },
    operationId: 'detach',
  });
  sheet = withSheetCatalog(await owner.query(api.characterSheet.read, scope));
  expect(sheet?.calculated.abilities.strength.score).toBe(12);
  expect(
    sheet?.calculated.resolvedEntries.filter((row) => row.origin === 'grant'),
  ).toHaveLength(1);
  expect(
    sheet?.entries.find((row) => 'grantKey' in row && row.grantKey),
  ).toMatchObject({
    kind: 'classFeature',
    catalogOverride: true,
    catalogEntryId: featureId,
  });
  const foreignCharacter = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId: scope.campaignId,
    name: 'Foreign',
    kind: 'pc',
    operationId: 'foreign',
  });
  const foreignId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: foreignCharacter,
      name: 'Foreign copy',
      ruleIdentity: 'armor-training',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'classFeature' },
    }),
  );
  await expect(
    owner.mutation(api.characterSheet.editGrantState, {
      ...scope,
      grantKey,
      state: { catalogEntryId: foreignId },
      operationId: 'foreign-copy',
    }),
  ).rejects.toThrow('does not belong');
  await expect(
    owner.mutation(api.characterSheet.editGrantState, {
      ...scope,
      grantKey,
      state: { catalogEntryId: fighter._id },
      operationId: 'wrong-kind',
    }),
  ).rejects.toThrow();
});

test('accepting an untouched Grant warning keeps acceptance without recording Grant state', async () => {
  const { t, owner, scope, featureId, level } = await fixture();
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', featureId, {
      modifiers: [
        {
          target: 'init',
          bonusType: 'untyped',
          value: { formula: 'unsupported' },
        },
      ],
    }),
  );
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const warning = before?.calculated.warnings.find(
    (warning) => warning.check === 'unsupportedFormula',
  );
  if (!warning) throw new Error('Missing warning');
  await owner.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
    operationId: 'accept-only',
  });
  const accepted = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    accepted?.entries.some((entry) => 'grantKey' in entry && entry.grantKey),
  ).toBe(false);
  await owner.mutation(api.characterSheet.deleteClassLevel, {
    ...scope,
    entryId: level._id,
    operationId: 'lose',
  });
  const lost = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    lost?.calculated.resolvedEntries.some((row) => row.origin === 'grant'),
  ).toBe(false);
  expect(lost?.acceptedWarnings).toHaveLength(1);
});

test.each([
  { kind: 'condition' as const },
  { kind: 'item' as const, consumable: false },
  { kind: 'spell' as const },
  {
    kind: 'spellEffect' as const,
    lastsOverOneDay: true,
    defaultCasterLevel: 7,
  },
])(
  'a derived $kind Grant can be turned off, annotated, kept and discarded through its own API',
  async (detail) => {
    const { t, owner, scope, featureId, level, fighter } = await fixture();
    await t.run((ctx) => ctx.db.patch('catalogEntry', featureId, { detail }));
    const grantKey = {
      source: 'fighter',
      classLevel: 1,
      entry: 'armor-training',
    };
    await owner.mutation(api.characterSheet.editGrantState, {
      ...scope,
      grantKey,
      state: { active: false, notes: 'Saved notes' },
      operationId: 'off',
    });
    const off = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    expect(
      off?.calculated.resolvedEntries.find((row) => row.origin === 'grant'),
    ).toMatchObject({
      entry: { kind: detail.kind, active: false, notes: 'Saved notes' },
      counting: false,
    });
    const stored = off?.entries.find(
      (row) => 'grantKey' in row && row.grantKey,
    );
    if (!stored) throw new Error('Missing stored Grant');
    await expect(
      owner.mutation(api.characterSheet.removeSheetEntry, {
        ...scope,
        entryId: stored._id,
        operationId: 'forbidden-delete',
      }),
    ).rejects.toThrow();
    await expect(
      owner.mutation(api.characterSheet.editSheetEntry, {
        ...scope,
        entryId: stored._id,
        name: 'Overwrite grant',
        operationId: 'forbidden-edit',
      }),
    ).rejects.toThrow();
    await owner.mutation(api.characterSheet.deleteClassLevel, {
      ...scope,
      entryId: level._id,
      operationId: 'lose',
    });
    await owner.mutation(api.characterSheet.setDormantEntryKept, {
      ...scope,
      target: { grantKey },
      kept: true,
      operationId: 'keep-off',
    });
    expect(
      withSheetCatalog(
        await owner.query(api.characterSheet.read, scope),
      )?.calculated.resolvedEntries.find((row) => row.origin === 'grant'),
    ).toMatchObject({ dormant: true, counting: false });
    await owner.mutation(api.characterSheet.discardDormantEntry, {
      ...scope,
      target: { grantKey },
      operationId: 'discard',
    });
    await owner.mutation(api.characterSheet.addClassLevel, {
      ...scope,
      classEntryId: fighter._id,
      operationId: 'restore',
    });
    const restored = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    expect(
      restored?.calculated.resolvedEntries.find(
        (row) => row.origin === 'grant',
      ),
    ).toMatchObject({
      recorded: false,
      counting: true,
      entry: { kind: detail.kind },
    });
  },
);

test('class-local prompt Selections retain their level and state through source loss and restoration', async () => {
  const { t, owner, scope, fighter, featureId, level } = await fixture();
  if (fighter.detail.kind !== 'class' || !('picksByLevel' in fighter.detail))
    throw new Error('Missing class');
  const detail = fighter.detail;
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', fighter._id, {
      detail: {
        ...detail,
        featuresByLevel: [],
        picksByLevel: [{ classLevel: 1, list: 'fighter-talents', count: 1 }],
      },
    }),
  );
  const selectionSource = {
    kind: 'classPrompt' as const,
    source: 'fighter',
    classLevel: 1,
    list: 'fighter-talents',
  };
  const entryId = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: featureId,
    selectionSource,
    choice: 'dexterity',
    operationId: 'pick',
  });
  await owner.mutation(api.characterSheet.deleteClassLevel, {
    ...scope,
    entryId: level._id,
    operationId: 'lose',
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )?.calculated.resolvedEntries.find((row) => row.storedEntryId === entryId),
  ).toMatchObject({ dormant: true, counting: false });
  await owner.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId,
    notes: 'Retained prompt choice',
    operationId: 'notes',
  });
  await owner.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: fighter._id,
    operationId: 'restore',
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )?.calculated.resolvedEntries.find((row) => row.storedEntryId === entryId),
  ).toMatchObject({
    dormant: false,
    counting: true,
    entry: {
      notes: 'Retained prompt choice',
      state: { choice: 'dexterity' },
      selectionSource,
    },
  });
  for (const invalid of [
    { ...selectionSource, source: 'unknown' },
    { ...selectionSource, classLevel: 0 },
    { ...selectionSource, list: 'other-list' },
  ])
    await expect(
      owner.mutation(api.characterSheet.selectEntry, {
        ...scope,
        catalogEntryId: featureId,
        selectionSource: invalid,
        operationId: 'invalid-prompt',
      }),
    ).rejects.toThrow();
});

test('original and Unchained matched Grants remain editable under one key and restore their saved state', async () => {
  const { t, owner, scope, fighter, featureId, level, characterId } =
    await fixture();
  if (fighter.detail.kind !== 'class' || !('featuresByLevel' in fighter.detail))
    throw new Error('Missing class');
  const detail = fighter.detail;
  const { ucClass, ucFeature } = await t.run(async (ctx) => {
    const ucFeature = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Armor Training (UC)',
      ruleIdentity: 'armor-training-uc',
      stacksWithItself: false,
      sources: [],
      detail: { kind: 'classFeature' },
      modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 4 }],
    });
    const ucClass = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Fighter (UC)',
      ruleIdentity: 'fighter-uc',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: {
        ...detail,
        counterpartOf: fighter._id,
        featuresByLevel: [{ classLevel: 1, catalogEntryId: ucFeature }],
      },
    });
    return { ucClass, ucFeature };
  });
  const grantKey = {
    source: 'fighter',
    classLevel: 1,
    entry: 'armor-training',
  };
  await owner.mutation(api.characterSheet.editGrantState, {
    ...scope,
    grantKey,
    state: { notes: 'Original note' },
    operationId: 'notes',
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: ucClass,
    operationId: 'uc',
  });
  await owner.mutation(api.characterSheet.editGrantState, {
    ...scope,
    grantKey,
    state: { notes: 'Edited while UC', choice: 'strength' },
    operationId: 'uc-edit',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated.abilities.strength.score,
  ).toBe(14);
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: fighter._id,
    operationId: 'original',
  });
  const original = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(original?.calculated.abilities.strength.score).toBe(12);
  expect(
    original?.calculated.resolvedEntries.filter(
      (row) => row.origin === 'grant',
    ),
  ).toHaveLength(1);
  expect(
    original?.calculated.resolvedEntries.find((row) => row.origin === 'grant'),
  ).toMatchObject({
    entry: {
      catalogEntryId: featureId,
      grantKey,
      notes: 'Edited while UC',
      state: { choice: 'strength' },
    },
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: ucClass,
    operationId: 'uc-again',
  });
  await owner.mutation(api.characterSheet.editGrantState, {
    ...scope,
    grantKey,
    state: { catalogEntryId: ucFeature },
    operationId: 'detach-uc',
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: fighter._id,
    operationId: 'restore-detached',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated.abilities.strength.score,
  ).toBe(14);
});

test('unsupported choice fields reject the whole write and preserve Grant and Selection state', async () => {
  const { t, owner, scope, featureId } = await fixture();
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', featureId, {
      detail: { kind: 'item', consumable: false },
    }),
  );
  const grantKey = {
    source: 'fighter',
    classLevel: 1,
    entry: 'armor-training',
  };
  const entryId = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: featureId,
    notes: 'Original notes',
    operationId: 'select',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  await expect(
    owner.mutation(api.characterSheet.editGrantState, {
      ...scope,
      grantKey,
      state: { choice: 'ignored choice', active: false },
      operationId: 'invalid-grant',
    }),
  ).rejects.toThrow('does not have a recorded choice');
  await expect(
    owner.mutation(api.characterSheet.editSelection, {
      ...scope,
      entryId,
      choice: 'ignored choice',
      notes: 'Overwrite notes',
      operationId: 'invalid-selection',
    }),
  ).rejects.toThrow('does not have a recorded choice');
  await expect(
    owner.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: featureId,
      choice: null,
      operationId: 'invalid-new-selection',
    }),
  ).rejects.toThrow('does not have a recorded choice');
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
  ).toEqual(before);
});

test('UC class prompts save canonical family references and validate the currently chosen schedule', async () => {
  const { t, owner, scope, fighter, featureId, level, characterId } =
    await fixture();
  if (fighter.detail.kind !== 'class' || !('picksByLevel' in fighter.detail))
    throw new Error('Missing class');
  const detail = fighter.detail;
  const ucClass = await t.run(async (ctx) => {
    await ctx.db.patch('catalogEntry', fighter._id, {
      detail: {
        ...detail,
        picksByLevel: [{ classLevel: 1, list: 'Original choices', count: 1 }],
      },
    });
    return ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Fighter (UC)',
      ruleIdentity: 'fighter-uc',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: {
        ...detail,
        counterpartOf: fighter._id,
        featuresByLevel: [],
        picksByLevel: [{ classLevel: 1, list: 'Talents (UC)', count: 1 }],
      },
    });
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: ucClass,
    operationId: 'uc',
  });
  const picked = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: featureId,
    selectionSource: {
      kind: 'classPrompt',
      source: 'fighter-uc',
      classLevel: 1,
      list: 'Talents (UC)',
    },
    operationId: 'uc-pick',
  });
  const first = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    first?.calculated.resolvedEntries.find(
      (row) => row.storedEntryId === picked,
    ),
  ).toMatchObject({
    dormant: false,
    counting: true,
    entry: {
      selectionSource: {
        kind: 'classPrompt',
        source: 'fighter',
        classLevel: 1,
        list: 'talents',
      },
    },
  });
  await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: featureId,
    selectionSource: {
      kind: 'classPrompt',
      source: 'fighter',
      classLevel: 1,
      list: 'Talents',
    },
    operationId: 'family-pick',
  });
  await expect(
    owner.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: featureId,
      selectionSource: {
        kind: 'classPrompt',
        source: 'fighter',
        classLevel: 1,
        list: 'Original choices',
      },
      operationId: 'unused-definition-pick',
    }),
  ).rejects.toThrow('Choose a prompt defined');
  await owner.mutation(api.characterSheet.deleteClassLevel, {
    ...scope,
    entryId: level._id,
    operationId: 'lose',
  });
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', ucClass, {
      detail: {
        ...detail,
        counterpartOf: fighter._id,
        picksByLevel: [],
        featuresByLevel: [],
      },
    }),
  );
  await owner.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: picked,
    notes: 'Preserve absent prompt',
    selectionSource: {
      kind: 'classPrompt',
      source: 'fighter',
      classLevel: 1,
      list: 'talents',
    },
    operationId: 'notes',
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )?.calculated.resolvedEntries.find((row) => row.storedEntryId === picked),
  ).toMatchObject({
    dormant: true,
    entry: { notes: 'Preserve absent prompt' },
  });
});

test.each(['manual', 'item'] as const)(
  'removing a %s Selection preserves the definition used by current, future and nested Grants',
  async (kind) => {
    const { t, owner, scope, fighter, characterId } = await fixture();
    const entryId =
      kind === 'manual'
        ? await owner.mutation(api.characterSheet.createPersonalAdjustment, {
            ...scope,
            name: 'Selected training',
            modifiers: [
              { target: 'ability.str', bonusType: 'untyped', value: 3 },
            ],
            operationId: 'create-selection',
          })
        : await owner.mutation(api.characterSheet.createSheetEntry, {
            ...scope,
            name: 'Selected item',
            detail: { kind: 'item', consumable: false },
            modifiers: [
              { target: 'ability.str', bonusType: 'untyped', value: 3 },
            ],
            operationId: 'create-selection',
          });
    const before = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    const selection = before?.entries.find((row) => row._id === entryId);
    if (
      !selection ||
      !('catalogEntryId' in selection) ||
      fighter.detail.kind !== 'class' ||
      !('featuresByLevel' in fighter.detail)
    )
      throw new Error('Missing fixture entries');
    const detail = fighter.detail;
    const dependencyId = selection.catalogEntryId;
    await t.run(async (ctx) => {
      const parent = await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        name: 'Future parent',
        ruleIdentity: 'future-parent',
        sources: [],
        stacksWithItself: false,
        modifiers: [],
        detail: { kind: 'classFeature' },
        grants: [{ catalogEntryId: dependencyId }],
      });
      await ctx.db.patch('catalogEntry', fighter._id, {
        detail: {
          ...detail,
          featuresByLevel: [
            { classLevel: 1, catalogEntryId: dependencyId },
            { classLevel: 20, catalogEntryId: parent },
          ],
        },
      });
    });
    if (kind === 'manual')
      await owner.mutation(api.characterSheet.removePersonalAdjustment, {
        ...scope,
        entryId,
        operationId: 'remove-selection',
      });
    else
      await owner.mutation(api.characterSheet.removeSheetEntry, {
        ...scope,
        entryId,
        operationId: 'remove-selection',
      });
    const after = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    expect(after?.entries.some((row) => row._id === entryId)).toBe(false);
    expect(after?.catalogEntries.some((row) => row._id === dependencyId)).toBe(
      true,
    );
    expect(after?.calculated.abilities.strength.score).toBe(13);
    expect(
      after?.calculated.resolvedEntries.filter((row) => row.origin === 'grant'),
    ).toHaveLength(1);
  },
);

test('editing a dormant Bonus Feat preserves its recorded slot dependency and never activates it implicitly', async () => {
  const { t, owner, scope, featureId, level, characterId } = await fixture();
  const featId = await t.run(async (ctx) => {
    await ctx.db.patch('catalogEntry', featureId, {
      grantsSlots: [{ kind: 'feat', featTypes: ['combat'], count: 1 }],
    });
    return ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Bonus Feat',
      ruleIdentity: 'bonus-feat',
      stacksWithItself: false,
      sources: [],
      modifiers: [{ target: 'ability.dex', bonusType: 'untyped', value: 2 }],
      detail: { kind: 'feat' },
    });
  });
  const entryId = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: featId,
    choice: 'original choice',
    operationId: 'feat',
  });
  const slot = {
    grantedBy: {
      kind: 'grant' as const,
      grantKey: { source: 'fighter', classLevel: 1, entry: 'armor-training' },
    },
  };
  await t.run((ctx) =>
    ctx.db.patch('characterSheetEntry', entryId, {
      state: { kind: 'feat', slot, choice: 'original choice' },
    }),
  );
  await owner.mutation(api.characterSheet.deleteClassLevel, {
    ...scope,
    entryId: level._id,
    operationId: 'lose',
  });
  await owner.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId,
    notes: 'Only notes changed',
    choice: 'updated choice',
    operationId: 'notes',
  });
  const after = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    after?.calculated.resolvedEntries.find(
      (row) => row.storedEntryId === entryId,
    ),
  ).toMatchObject({
    dormant: true,
    counting: false,
    entry: {
      notes: 'Only notes changed',
      state: { kind: 'feat', slot, choice: 'updated choice' },
    },
  });
  expect(after?.calculated.abilities.dexterity.score).toBe(10);
});

test('discarding a dormant Selection removes its unreferenced Character Catalog Copy', async () => {
  const { t, owner, scope, characterId, level } = await fixture();
  const catalogEntryId = await t.run(async (ctx) => {
    const definition = {
      scope: 'character' as const,
      characterId,
      name: 'Saved talent',
      ruleIdentity: 'saved-talent',
      sources: [],
      stacksWithItself: false,
      modifiers: [],
      detail: { kind: 'feat' as const },
    };
    return ctx.db.insert('catalogEntry', {
      ...definition,
      copiedFrom: await ctx.db.insert('catalogEntry', definition),
    });
  });
  const entryId = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId,
    operationId: 'choose',
    selectionSource: {
      kind: 'slot',
      grantedBy: {
        kind: 'grant',
        grantKey: { source: 'fighter', classLevel: 1, entry: 'armor-training' },
      },
    },
  });
  await owner.mutation(api.characterSheet.deleteClassLevel, {
    ...scope,
    entryId: level._id,
    operationId: 'lose',
  });
  await owner.mutation(api.characterSheet.discardDormantEntry, {
    ...scope,
    target: { entryId },
    operationId: 'discard',
  });
  const after = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(after?.entries.some((entry) => entry._id === entryId)).toBe(false);
  expect(
    after?.catalogEntries.some((entry) => entry._id === catalogEntryId),
  ).toBe(false);
});

test.each([
  { recordIntermediate: true, recordDeep: true, removeEdge: false },
  { recordIntermediate: false, recordDeep: true, removeEdge: false },
  { recordIntermediate: false, recordDeep: true, removeEdge: true },
  { recordIntermediate: false, recordDeep: false, removeEdge: true },
])(
  'discarding a dormant Selection removes descendants with recorded intermediate $recordIntermediate, recorded grandchild $recordDeep and removed catalog edge $removeEdge',
  async ({ recordIntermediate, recordDeep, removeEdge }) => {
    const { t, owner, scope, characterId, level, featureId } = await fixture();
    const catalogEntryId = await t.run(async (ctx) => {
      await ctx.db.patch('catalogEntry', featureId, {
        grantsSlots: [{ kind: 'feat', count: 1 }],
      });
      const grandchild = await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        name: 'Deep training',
        ruleIdentity: 'deep-training',
        sources: [],
        stacksWithItself: false,
        modifiers: [
          {
            target: 'init',
            bonusType: 'untyped',
            value: { formula: 'unsupported' },
          },
        ],
        detail: { kind: 'classFeature' },
      });
      const child = await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        name: 'Nested training',
        ruleIdentity: 'nested-training',
        sources: [],
        stacksWithItself: false,
        modifiers: [],
        detail: { kind: 'classFeature' },
        grants: [{ catalogEntryId: grandchild }],
      });
      return ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        name: 'Saved talent',
        ruleIdentity: 'saved-talent',
        sources: [],
        stacksWithItself: false,
        modifiers: [],
        detail: { kind: 'feat' },
        grants: [{ catalogEntryId: child }],
      });
    });
    const entryId = await owner.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId,
      operationId: 'choose',
      selectionSource: {
        kind: 'slot',
        grantedBy: {
          kind: 'grant',
          grantKey: {
            source: 'fighter',
            classLevel: 1,
            entry: 'armor-training',
          },
        },
      },
    });
    const independentId = await owner.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId,
      operationId: 'choose-independent',
    });
    const before = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    const intermediate = before?.calculated.resolvedEntries.find(
      (row) =>
        'grantKey' in row.entry && row.entry.grantKey?.source === entryId,
    );
    const descendants = before?.calculated.resolvedEntries.filter(
      (row) =>
        'grantKey' in row.entry &&
        [entryId, intermediate?.entry._id].includes(
          row.entry.grantKey?.source ?? '',
        ),
    );
    if (descendants?.length !== 2) throw new Error('Missing nested Grants');
    for (const { entry } of descendants) {
      if (!('grantKey' in entry) || !entry.grantKey)
        throw new Error('Missing Grant Key');
      if (!recordIntermediate && entry.grantKey.source === entryId) continue;
      if (!recordDeep && entry.grantKey.source !== entryId) continue;
      await owner.mutation(api.characterSheet.editGrantState, {
        ...scope,
        grantKey: entry.grantKey,
        state: { notes: 'Saved descendant' },
        operationId: `save-${entry.grantKey.entry}`,
      });
    }
    const warning = before?.calculated.warnings.find(
      (row) =>
        row.check === 'unsupportedFormula' &&
        descendants.some(({ entry }) => row.subject.startsWith(entry._id)),
    );
    if (!warning) throw new Error('Missing nested warning');
    await owner.mutation(api.characterSheet.acceptWarning, {
      ...scope,
      check: warning.check,
      subject: warning.subject,
      fingerprint: warning.fingerprint,
      operationId: 'accept-descendant',
    });
    const independent = before?.calculated.resolvedEntries.find(
      (row) =>
        'grantKey' in row.entry && row.entry.grantKey?.source === independentId,
    );
    if (
      !independent ||
      !('grantKey' in independent.entry) ||
      !independent.entry.grantKey
    )
      throw new Error('Missing independent Grant');
    await owner.mutation(api.characterSheet.editGrantState, {
      ...scope,
      grantKey: independent.entry.grantKey,
      state: { notes: 'Independent state' },
      operationId: 'save-independent',
    });
    const independentWarning = before?.calculated.warnings.find(
      (row) =>
        row.check === 'unsupportedFormula' && row.subject !== warning.subject,
    );
    if (!independentWarning) throw new Error('Missing independent warning');
    await owner.mutation(api.characterSheet.acceptWarning, {
      ...scope,
      check: independentWarning.check,
      subject: independentWarning.subject,
      fingerprint: independentWarning.fingerprint,
      operationId: 'accept-independent',
    });
    if (removeEdge)
      await t.run((ctx) =>
        ctx.db.patch('catalogEntry', catalogEntryId, {
          grants: [],
        }),
      );
    await owner.mutation(api.characterSheet.deleteClassLevel, {
      ...scope,
      entryId: level._id,
      operationId: 'lose',
    });
    await owner.mutation(api.characterSheet.discardDormantEntry, {
      ...scope,
      target: { entryId },
      operationId: 'discard',
    });
    const after = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    expect(after?.entries).toHaveLength(3);
    expect(
      after?.calculated.resolvedEntries.some((row) =>
        descendants.some(({ entry }) => entry._id === row.entry._id),
      ),
    ).toBe(false);
    expect(
      after?.calculated.resolvedEntries.find(
        (row) => row.entry._id === independent.entry._id,
      ),
    ).toMatchObject({
      counting: !removeEdge,
      entry: { notes: 'Independent state' },
    });
    expect(after?.acceptedWarnings).toHaveLength(1);
    expect(after?.acceptedWarnings[0]?.subject).toBe(
      independentWarning.subject,
    );
  },
);

test('references to saved Grant rows become durable Grant Keys before their state is discarded', async () => {
  const { t, owner, scope, characterId, level, fighter, featureId } =
    await fixture();
  const grantKey = {
    source: 'fighter',
    classLevel: 1,
    entry: 'armor-training',
  };
  const catalogEntryId = await t.run(async (ctx) => {
    await ctx.db.patch('catalogEntry', featureId, {
      grantsSlots: [{ kind: 'feat', count: 1 }],
    });
    return ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Bonus choice',
      ruleIdentity: 'bonus-choice',
      sources: [],
      stacksWithItself: false,
      modifiers: [],
      detail: { kind: 'feat' },
    });
  });
  await owner.mutation(api.characterSheet.editGrantState, {
    ...scope,
    grantKey,
    state: { notes: 'Saved' },
    operationId: 'save-grant',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const savedGrant = before?.entries.find(
    (entry) => 'grantKey' in entry && entry.grantKey,
  );
  if (!savedGrant) throw new Error('Missing saved Grant');
  const entryId = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId,
    operationId: 'select-feat',
    selectionSource: {
      kind: 'slot',
      grantedBy: { kind: 'entry', entryId: savedGrant._id },
    },
  });
  const selected = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    selected?.entries.find((entry) => entry._id === entryId),
  ).toMatchObject({
    selectionSource: { kind: 'slot', grantedBy: { kind: 'grant', grantKey } },
  });
  await owner.mutation(api.characterSheet.deleteClassLevel, {
    ...scope,
    entryId: level._id,
    operationId: 'lose',
  });
  await owner.mutation(api.characterSheet.discardDormantEntry, {
    ...scope,
    target: { grantKey },
    operationId: 'discard-grant',
  });
  await owner.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: fighter._id,
    operationId: 'restore',
  });
  const restored = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    restored?.calculated.resolvedEntries.find(
      (row) => row.entry._id === entryId,
    ),
  ).toMatchObject({
    dormant: false,
    counting: true,
  });
});

test('an untouched automatic warning acceptance survives an inactive parent without showing saved Grant state', async () => {
  const { t, owner, scope, characterId, featureId, level } = await fixture();
  const parentId = await t.run(async (ctx) => {
    await ctx.db.patch('catalogEntry', featureId, {
      modifiers: [
        {
          target: 'init',
          bonusType: 'untyped',
          value: { formula: 'unsupported' },
        },
      ],
    });
    return ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Parent choice',
      ruleIdentity: 'parent-choice',
      sources: [],
      stacksWithItself: false,
      modifiers: [],
      detail: { kind: 'classFeature' },
      grants: [{ catalogEntryId: featureId }],
    });
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: null,
    operationId: 'remove-class-grant',
  });
  const entryId = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: parentId,
    operationId: 'choose-parent',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const automatic = before?.calculated.resolvedEntries.find(
    (row) =>
      row.origin === 'grant' &&
      'grantKey' in row.entry &&
      row.entry.grantKey?.source === entryId,
  );
  const warning = before?.calculated.warnings.find(
    (warning) =>
      'entryId' in warning.target &&
      warning.target.entryId === automatic?.entry._id,
  );
  if (!warning) throw new Error('Missing automatic warning');
  await owner.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
    operationId: 'accept-automatic',
  });
  await owner.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId,
    active: false,
    operationId: 'off-parent',
  });
  const inactive = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(inactive?.acceptedWarnings).toHaveLength(1);
  expect(
    inactive?.entries.some((entry) => 'grantKey' in entry && entry.grantKey),
  ).toBe(false);
  expect(
    inactive?.calculated.resolvedEntries.some(
      (row) => row.entry._id === automatic?.entry._id,
    ),
  ).toBe(false);
  expect(inactive?.calculated.warnings).not.toContainEqual(warning);
  await owner.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId,
    active: true,
    operationId: 'on-parent',
  });
  const restored = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(restored?.acceptedWarnings).toHaveLength(1);
  expect(restored?.calculated.warnings).toContainEqual(warning);
});
