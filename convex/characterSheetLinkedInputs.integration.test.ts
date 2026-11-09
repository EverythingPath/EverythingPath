// @vitest-environment edge-runtime
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { makeFunctionReference } from 'convex/server';
import type { Doc, Id } from './_generated/dataModel';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');
const source = { key: 'bond', label: 'Companion bond', enabled: true };
const input = { kind: 'actualHitDice' } as const;

test('curated linked inputs stay reachable when the master is hidden and retain fallbacks after access returns', async () => {
  const { t, member, characterId, companionId, campaignId, relationshipId } =
    await fixture();
  const scope = { characterId: companionId, relationshipId, input };
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, {
      campaignId: undefined,
      sheetDemo: true,
    }),
  );
  const relationships = await member.query(api.companionRelationships.list, {
    characterId: companionId,
  });
  expect(relationships[0]).toMatchObject({
    endpoint: null,
    sources: [],
    linkedInputs: expect.arrayContaining([
      { input: { kind: 'actualHitDice' } },
    ]),
  });
  const before = await member.query(api.characterSheetLinkedInputs.list, {
    characterId: companionId,
    relationshipId,
  });
  expect(
    before.find((row) => row.input.kind === 'actualHitDice'),
  ).toMatchObject({ value: null, unavailableReason: 'inaccessible' });
  expect(JSON.stringify(before)).not.toContain('Ada');
  expect(JSON.stringify(before)).not.toContain('Companion bond');
  await member.mutation(api.characterSheetLinkedInputs.saveFallback, {
    ...scope,
    value: 7,
    operationId: 'hidden-fallback',
  });
  expect(
    (
      await member.query(api.characterSheetLinkedInputs.list, {
        characterId: companionId,
        relationshipId,
      })
    ).find((row) => row.input.kind === 'actualHitDice'),
  ).toMatchObject({ value: 7, fallbackState: 'applied' });
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, {
      campaignId,
      sheetDemo: undefined,
    }),
  );
  expect(
    (
      await member.query(api.characterSheetLinkedInputs.list, {
        characterId: companionId,
        relationshipId,
      })
    ).find((row) => row.input.kind === 'actualHitDice'),
  ).toMatchObject({ value: 1, fallback: 7, fallbackState: 'suspended' });
});

test('only curated input names and server-selected source rules can be saved', async () => {
  const { owner, characterId, companionId, relationshipId } = await fixture();
  const arbitrary = {
    characterId: companionId,
    relationshipId,
    input: { kind: 'classLevels', classRuleIdentity: 'invented-class' },
  } as const;
  for (const command of [
    () => owner.query(api.characterSheetLinkedInputs.read, arbitrary),
    () =>
      owner.mutation(api.characterSheetLinkedInputs.saveFallback, {
        ...arbitrary,
        value: 1,
        operationId: 'unknown',
      }),
    () =>
      owner.mutation(api.characterSheetLinkedInputs.clearFallback, {
        ...arbitrary,
        operationId: 'clear-unknown',
      }),
    () =>
      owner.mutation(api.characterSheetLinkedInputs.saveInterpretation, {
        ...arbitrary,
        sourceKey: 'bond',
        operationId: 'unknown-interpret',
      }),
    () =>
      owner.mutation(api.characterSheetLinkedInputs.clearInterpretation, {
        ...arbitrary,
        operationId: 'clear-unknown-interpret',
      }),
  ])
    await expect(command()).rejects.toThrow('Choose a named input supplied');
  const addSource = makeFunctionReference<
    'mutation',
    {
      relationshipId: Id<'companionRelationship'>;
      operationId: string;
      source: typeof source & {
        linkedInputs?: {
          input: typeof input;
          sourceInput: typeof input;
          role: 'addition';
        }[];
        ruleKind?: string;
      };
    }
  >('companionRelationships:addSource');
  for (const playerRules of [
    {
      linkedInputs: [{ input, sourceInput: input, role: 'addition' as const }],
    },
    { ruleKind: 'witchFamiliar' },
  ])
    await expect(
      owner.mutation(addSource, {
        relationshipId,
        operationId: 'player-rules',
        source: { ...source, key: 'injected', ...playerRules },
      }),
    ).rejects.toThrow('Unexpected field');
  const link = makeFunctionReference<
    'mutation',
    {
      associatedCharacterId: Id<'character'>;
      companionCharacterId: Id<'character'>;
      kind: 'familiar';
      sources: (typeof source & { linkedInputs: [] })[];
      operationId: string;
    }
  >('companionRelationships:link');
  await expect(
    owner.mutation(link, {
      associatedCharacterId: characterId,
      companionCharacterId: companionId,
      kind: 'familiar',
      sources: [{ ...source, linkedInputs: [] }],
      operationId: 'player-link',
    }),
  ).rejects.toThrow('Unexpected field');
  const create = makeFunctionReference<
    'mutation',
    {
      associatedCharacterId: Id<'character'>;
      name: string;
      kind: 'familiar';
      sources: (typeof source & { linkedInputs: [] })[];
      operationId: string;
    }
  >('companionRelationships:create');
  await expect(
    owner.mutation(create, {
      associatedCharacterId: characterId,
      name: 'Injected familiar',
      kind: 'familiar',
      sources: [{ ...source, linkedInputs: [] }],
      operationId: 'player-create',
    }),
  ).rejects.toThrow('Unexpected field');
});

test('hidden master edits preserve accessible-side declarations while authorized reads derive current rules', async () => {
  const { t, owner, member, characterId, companionId, relationshipId } =
    await fixture();
  const master = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  const level = master?.entries.find((entry) => entry.kind === 'classLevel');
  const wizard = master?.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'wizard',
  );
  if (!level || wizard?.detail.kind !== 'class')
    throw new Error('Fixture Wizard missing');
  const wizardDetail = wizard.detail;
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId,
    entryId: level._id,
    classEntryId: wizard._id,
    operationId: 'wizard',
  });
  await owner.mutation(api.companionRelationships.setSourceEnabled, {
    relationshipId,
    sourceKey: 'bond',
    enabled: false,
    operationId: 'disable-manual-source',
  });
  await owner.mutation(api.companionRelationships.addSource, {
    relationshipId,
    source: { ...source, key: 'class-source', sheetEntryId: level._id },
    operationId: 'class-source',
  });
  // A sole class-backed declaration makes later private class changes observable.
  await t.run(async (ctx) => {
    const row = await ctx.db.get('companionRelationship', relationshipId);
    if (!row) throw new Error('Fixture relationship missing');
    await ctx.db.patch('companionRelationship', relationshipId, {
      sources: row.sources.filter(({ key }) => key === 'class-source'),
    });
  });
  const witchId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Witch',
      ruleIdentity: 'witch',
      sources: [],
      stacksWithItself: false,
      modifiers: [],
      detail: wizardDetail,
    }),
  );
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, {
      campaignId: undefined,
      sheetDemo: true,
    }),
  );
  const before = await member.query(api.companionRelationships.list, {
    characterId: companionId,
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId,
    entryId: level._id,
    classEntryId: witchId,
    operationId: 'switch-hidden-class',
  });
  const relationships = await member.query(api.companionRelationships.list, {
    characterId: companionId,
  });
  expect(relationships).toEqual(before);
  expect(relationships[0]?.linkedInputs).toEqual(
    expect.arrayContaining([
      {
        input: { kind: 'classLevels', classRuleIdentity: 'wizard' },
        classLabel: 'Wizard',
      },
      { input: { kind: 'familiarProgressionLevels' } },
    ]),
  );
  expect(relationships[0]).toMatchObject({ sources: [], endpoint: null });
  expect(JSON.stringify(relationships)).not.toContain('Ada');
  const hiddenInputs = await member.query(api.characterSheetLinkedInputs.list, {
    characterId: companionId,
    relationshipId,
  });
  expect(hiddenInputs.map(({ input }) => input)).toContainEqual({
    kind: 'classLevels',
    classRuleIdentity: 'wizard',
  });
  expect(hiddenInputs.map(({ input }) => input)).not.toContainEqual({
    kind: 'classLevels',
    classRuleIdentity: 'witch',
  });
  expect(
    (
      await owner.query(api.characterSheetLinkedInputs.list, {
        characterId: companionId,
        relationshipId,
      })
    ).map(({ input }) => input),
  ).toContainEqual({ kind: 'classLevels', classRuleIdentity: 'witch' });
  await owner.mutation(api.companionRelationships.setSourceEnabled, {
    relationshipId,
    sourceKey: 'class-source',
    enabled: true,
    operationId: 'confirm-current-support',
  });
  expect(
    (
      await member.query(api.companionRelationships.list, {
        characterId: companionId,
      })
    )[0]?.linkedInputs,
  ).toEqual(
    expect.arrayContaining([
      {
        input: { kind: 'classLevels', classRuleIdentity: 'witch' },
        classLabel: 'Witch',
      },
    ]),
  );
});

test('legacy support declarations use the same authorized derivation for reads and writes', async () => {
  const {
    t,
    owner,
    member,
    characterId,
    companionId,
    relationshipId,
    campaignId,
  } = await fixture();
  const master = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  const level = master?.entries.find((entry) => entry.kind === 'classLevel');
  const wizard = master?.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'wizard',
  );
  if (!level || !wizard) throw new Error('Fixture Wizard missing');
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId,
    entryId: level._id,
    classEntryId: wizard._id,
    operationId: 'legacy-wizard',
  });
  // Migration fixture: old supporting sources predate the optional rule kind.
  await t.run((ctx) =>
    ctx.db.patch('companionRelationship', relationshipId, {
      sources: [{ ...source, key: 'legacy-class', sheetEntryId: level._id }],
    }),
  );
  const scope = {
    characterId: companionId,
    relationshipId,
    input: { kind: 'familiarProgressionLevels' },
  } as const;
  expect(
    await member.query(api.characterSheetLinkedInputs.list, {
      characterId: companionId,
      relationshipId,
    }),
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        input: scope.input,
        value: 1,
      }),
    ]),
  );
  await member.mutation(api.characterSheetLinkedInputs.saveFallback, {
    ...scope,
    value: 7,
    operationId: 'legacy-fallback',
  });
  await member.mutation(api.characterSheetLinkedInputs.saveInterpretation, {
    ...scope,
    sourceKey: 'legacy-class',
    operationId: 'legacy-interpretation',
  });
  expect(
    await member.query(api.characterSheetLinkedInputs.read, scope),
  ).toMatchObject({
    value: 1,
    fallback: 7,
    fallbackState: 'suspended',
    interpretation: { sourceKey: 'legacy-class' },
  });
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, {
      campaignId: undefined,
      sheetDemo: true,
    }),
  );
  const hidden = await member.query(api.characterSheetLinkedInputs.list, {
    characterId: companionId,
    relationshipId,
  });
  expect(hidden.map(({ input }) => input)).toContainEqual(scope.input);
  expect(
    hidden.find((row) => row.input.kind === 'familiarProgressionLevels'),
  ).toMatchObject({
    value: 7,
    fallbackState: 'applied',
    sources: [],
  });
  const hiddenScope = { ...scope, input };
  await member.mutation(api.characterSheetLinkedInputs.saveFallback, {
    ...hiddenScope,
    value: 9,
    operationId: 'legacy-hidden-fallback',
  });
  expect(
    await member.query(api.characterSheetLinkedInputs.read, hiddenScope),
  ).toMatchObject({
    value: 9,
    unavailableReason: 'inaccessible',
  });
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, {
      campaignId,
      sheetDemo: undefined,
    }),
  );
  await member.mutation(api.characterSheetLinkedInputs.clearInterpretation, {
    ...scope,
    operationId: 'legacy-clear-interpretation',
  });
  await member.mutation(api.characterSheetLinkedInputs.clearFallback, {
    ...scope,
    operationId: 'legacy-clear-fallback',
  });
  expect(
    await member.query(api.characterSheetLinkedInputs.read, scope),
  ).toMatchObject({
    value: 1,
    fallback: null,
    interpretation: null,
  });
});

test('an Unchained eidolon borrows its canonical Summoner Class Levels rather than inventing zero', async () => {
  const { t, owner, member, characterId, campaignId } = await fixture();
  const master = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  const level = master?.entries.find((entry) => entry.kind === 'classLevel');
  const wizard = master?.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'wizard',
  );
  if (
    !level ||
    wizard?.detail.kind !== 'class' ||
    !('featuresByLevel' in wizard.detail)
  )
    throw new Error('Fixture Class missing');
  const classDetail = wizard.detail;
  const unchainedId = await t.run(async (ctx) => {
    const summonerId = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Summoner',
      ruleIdentity: 'summoner',
      sources: [],
      stacksWithItself: false,
      modifiers: [],
      detail: classDetail,
    });
    return await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Unchained summoner',
      ruleIdentity: 'summonerUnchained',
      sources: [],
      stacksWithItself: false,
      modifiers: [],
      detail: { ...classDetail, counterpartOf: summonerId },
    });
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId,
    entryId: level._id,
    classEntryId: unchainedId,
    operationId: 'unchained-class',
  });
  const companionId = await owner.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Eidolon',
    kind: 'npc',
    operationId: 'eidolon',
  });
  const relationshipId = await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: characterId,
    companionCharacterId: companionId,
    kind: 'unchainedEidolon',
    sources: [{ ...source, sheetEntryId: level._id }],
    operationId: 'eidolon-link',
  });
  expect(
    await member.query(api.characterSheetLinkedInputs.list, {
      characterId: companionId,
      relationshipId,
    }),
  ).toMatchObject([
    {
      input: { kind: 'classLevels', classRuleIdentity: 'summoner' },
      value: 1,
      resolution: 'calculated',
    },
  ]);
});

test('a saved fallback suspends on restoration and returns on a later interruption', async () => {
  const { owner, member, characterId, companionId, relationshipId } =
    await fixture();
  const scope = { characterId: companionId, relationshipId, input };
  await member.mutation(api.characterSheetLinkedInputs.saveFallback, {
    ...scope,
    value: 7,
    operationId: 'fallback',
  });
  expect(
    await owner.query(api.characterSheetLinkedInputs.read, scope),
  ).toMatchObject({
    status: 'available',
    value: 1,
    fallbackState: 'suspended',
    fallback: 7,
  });
  await owner.mutation(api.companionRelationships.interrupt, {
    relationshipId,
    operationId: 'interrupt',
  });
  expect(
    await member.query(api.characterSheetLinkedInputs.read, scope),
  ).toMatchObject({
    status: 'unavailable',
    value: 7,
    resolution: 'fallback',
    fallbackState: 'applied',
  });
  await member.mutation(api.companionRelationships.restore, {
    relationshipId,
    operationId: 'restore',
  });
  expect(
    await member.query(api.characterSheetLinkedInputs.read, scope),
  ).toMatchObject({
    status: 'available',
    value: 1,
    fallbackState: 'suspended',
    fallback: 7,
  });
  await owner.mutation(api.companionRelationships.interrupt, {
    relationshipId,
    operationId: 'interrupt-again',
  });
  expect(
    await owner.query(api.characterSheetLinkedInputs.read, scope),
  ).toMatchObject({
    value: 7,
    fallbackState: 'applied',
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId }),
    ),
  ).toMatchObject({
    calculated: { level: 1 },
  });
});

test.each(['disabled', 'removed'] as const)(
  'published witch precedence keeps combined familiar levels and surviving support calculates without an interpretation (%s)',
  async (loss) => {
    const { t, owner, member, characterId, companionId, relationshipId } =
      await fixture();
    const master = withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId }),
    );
    const level = master?.entries.find((entry) => entry.kind === 'classLevel');
    const wizard = master?.catalogEntries.find(
      (entry) => entry.ruleIdentity === 'wizard',
    );
    const fighter = master?.catalogEntries.find(
      (entry) => entry.ruleIdentity === 'fighter',
    );
    if (!level || wizard?.detail.kind !== 'class' || !fighter)
      throw new Error('Fixture Classes missing');
    const wizardDetail = wizard.detail;
    const witchId = await t.run((ctx) =>
      ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        name: 'Witch',
        ruleIdentity: 'witch',
        sources: [
          { book: 'Pathfinder RPG Advanced Player’s Guide', pages: '66–69' },
        ],
        stacksWithItself: false,
        modifiers: [],
        detail: wizardDetail,
      }),
    );
    await owner.mutation(api.characterSheet.editClassLevel, {
      characterId,
      entryId: level._id,
      classEntryId: wizard._id,
      operationId: 'wizard-1',
    });
    for (const operationId of ['wizard-2', 'wizard-3'])
      await owner.mutation(api.characterSheet.addClassLevel, {
        characterId,
        classEntryId: wizard._id,
        operationId,
      });
    const witchLevel = await owner.mutation(api.characterSheet.addClassLevel, {
      characterId,
      classEntryId: witchId,
      operationId: 'witch-1',
    });
    await owner.mutation(api.characterSheet.addClassLevel, {
      characterId,
      classEntryId: witchId,
      operationId: 'witch-2',
    });
    for (const operationId of ['fighter-1', 'fighter-2'])
      await owner.mutation(api.characterSheet.addClassLevel, {
        characterId,
        classEntryId: fighter._id,
        operationId,
      });
    for (const supportingSource of [
      {
        key: 'wizard',
        label: 'Arcane bond',
        enabled: true,
        sheetEntryId: level._id,
      },
      {
        key: 'witch',
        label: 'Witch familiar',
        enabled: true,
        sheetEntryId: witchLevel,
      },
      {
        key: 'duplicate-wizard',
        label: 'Same wizard grant',
        enabled: true,
        sheetEntryId: level._id,
      },
    ])
      await owner.mutation(api.companionRelationships.addSource, {
        relationshipId,
        source: supportingSource,
        operationId: `add-${supportingSource.key}`,
      });
    const scope = {
      characterId: companionId,
      relationshipId,
      input: { kind: 'familiarProgressionLevels' },
    } as const;
    // Accepted #248 example: witch 2 / wizard 3 / fighter 2 advances a familiar at 5, not 2 or 7.
    expect(
      await member.query(api.characterSheetLinkedInputs.read, scope),
    ).toMatchObject({ value: 5, resolution: 'precedence' });
    expect(
      await owner.query(api.characterSheetLinkedInputs.read, {
        ...scope,
        characterId,
      }),
    ).toMatchObject({ value: 5, resolution: 'precedence' });
    if (loss === 'disabled')
      await owner.mutation(api.companionRelationships.setSourceEnabled, {
        relationshipId,
        sourceKey: 'witch',
        enabled: false,
        operationId: 'lose-witch-without-interpretation',
      });
    else
      await owner.mutation(api.characterSheet.deleteClassLevel, {
        characterId,
        entryId: witchLevel,
        operationId: 'remove-witch-without-interpretation',
      });
    const surviving = await member.query(
      api.characterSheetLinkedInputs.read,
      scope,
    );
    expect(surviving).toMatchObject({
      value: 3,
      resolution: 'calculated',
      interpretation: null,
      contributions: [
        { sourceKey: 'bond', value: 3 },
        { sourceKey: 'wizard', value: 3 },
        { sourceKey: 'duplicate-wizard', value: 3 },
      ],
    });
    expect(surviving.candidates.map(({ sourceKey }) => sourceKey)).toEqual([
      'bond',
      'wizard',
      'duplicate-wizard',
    ]);
    if (loss === 'removed') return;
    await owner.mutation(api.companionRelationships.setSourceEnabled, {
      relationshipId,
      sourceKey: 'witch',
      enabled: true,
      operationId: 'restore-witch-before-interpretation',
    });
    await member.mutation(api.characterSheetLinkedInputs.saveInterpretation, {
      ...scope,
      sourceKey: 'wizard',
      operationId: 'interpret',
    });
    await member.mutation(api.characterSheetLinkedInputs.saveFallback, {
      ...scope,
      value: 11,
      operationId: 'fallback',
    });
    expect(
      await owner.query(api.characterSheetLinkedInputs.read, scope),
    ).toMatchObject({
      value: 5,
      resolution: 'precedence',
      fallbackState: 'suspended',
    });
    await owner.mutation(api.companionRelationships.setSourceEnabled, {
      relationshipId,
      sourceKey: 'witch',
      enabled: false,
      operationId: 'lose-witch',
    });
    expect(
      await member.query(api.characterSheetLinkedInputs.read, scope),
    ).toMatchObject({
      value: 3,
      resolution: 'calculated',
      interpretation: { sourceKey: 'wizard' },
      fallbackState: 'suspended',
      contributions: [
        { sourceKey: 'bond', value: 3 },
        { sourceKey: 'wizard', value: 3 },
        { sourceKey: 'duplicate-wizard', value: 3 },
      ],
    });
    await owner.mutation(api.companionRelationships.setSourceEnabled, {
      relationshipId,
      sourceKey: 'witch',
      enabled: true,
      operationId: 'restore-witch',
    });
    expect(
      await member.query(api.characterSheetLinkedInputs.read, scope),
    ).toMatchObject({
      value: 5,
      resolution: 'precedence',
      interpretation: { sourceKey: 'wizard' },
      fallback: 11,
    });
  },
);

test('access loss exposes only the requested input and its locally saved fallback', async () => {
  const {
    t,
    owner,
    member,
    outsider,
    characterId,
    companionId,
    relationshipId,
  } = await fixture();
  const scope = { characterId: companionId, relationshipId, input };
  await member.mutation(api.characterSheetLinkedInputs.saveFallback, {
    ...scope,
    value: 7,
    operationId: 'save',
  });
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, {
      campaignId: undefined,
      sheetDemo: true,
    }),
  );
  const inaccessible = await member.query(
    api.characterSheetLinkedInputs.read,
    scope,
  );
  expect(inaccessible).toMatchObject({
    status: 'unavailable',
    unavailableReason: 'inaccessible',
    value: 7,
    fallbackState: 'applied',
    sources: [],
    candidates: [],
    contributions: [],
  });
  expect(JSON.stringify(inaccessible)).not.toContain('Ada');
  expect(JSON.stringify(inaccessible)).not.toContain('Companion bond');
  await expect(
    member.mutation(api.characterSheetLinkedInputs.saveInterpretation, {
      ...scope,
      sourceKey: 'bond',
      operationId: 'hidden-source',
    }),
  ).rejects.toThrow('Choose an available supporting source');
  await member.mutation(api.characterSheetLinkedInputs.clearFallback, {
    ...scope,
    operationId: 'clear',
  });
  expect(
    await member.query(api.characterSheetLinkedInputs.read, scope),
  ).toMatchObject({ value: null, prerequisiteStatus: 'unresolved' });
  await expect(
    outsider.query(api.characterSheetLinkedInputs.read, scope),
  ).rejects.toThrow('Character not found');
  await expect(
    outsider.mutation(api.characterSheetLinkedInputs.saveFallback, {
      ...scope,
      value: 12,
      operationId: 'outsider',
    }),
  ).rejects.toThrow('Character not found');
  await expect(
    member.query(api.characterSheetLinkedInputs.read, {
      ...scope,
      characterId,
    }),
  ).rejects.toThrow('Character not found');
  // The source owner can still read both sheets, but incompatible endpoints interrupt the bond.
  expect(
    await owner.query(api.characterSheetLinkedInputs.read, scope),
  ).toMatchObject({
    status: 'unavailable',
    unavailableReason: 'interrupted',
    value: null,
  });
});

test('hidden saved interpretations expose a curated token and preserve restoration and clearing', async () => {
  const {
    t,
    owner,
    member,
    characterId,
    companionId,
    relationshipId,
    campaignId,
  } = await fixture();
  const master = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  const level = master?.entries.find((entry) => entry.kind === 'classLevel');
  if (!level) throw new Error('Fixture Class Level missing');
  const sourceKey = `entry:${level._id}`;
  await owner.mutation(api.companionRelationships.addSource, {
    relationshipId,
    source: {
      key: sourceKey,
      label: 'Private supporting entry',
      enabled: true,
      sheetEntryId: level._id,
    },
    operationId: 'private-source',
  });
  const scope = { characterId: companionId, relationshipId, input };
  await member.mutation(api.characterSheetLinkedInputs.saveInterpretation, {
    ...scope,
    sourceKey,
    operationId: 'private-interpretation',
  });
  await member.mutation(api.characterSheetLinkedInputs.saveFallback, {
    ...scope,
    value: 7,
    operationId: 'private-fallback',
  });
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, {
      campaignId: undefined,
      sheetDemo: true,
    }),
  );
  const hiddenRead = await member.query(
    api.characterSheetLinkedInputs.read,
    scope,
  );
  const hiddenList = await member.query(api.characterSheetLinkedInputs.list, {
    characterId: companionId,
    relationshipId,
  });
  for (const result of [hiddenRead, hiddenList]) {
    expect(JSON.stringify(result)).not.toContain(level._id);
    expect(JSON.stringify(result)).not.toContain('Private supporting entry');
  }
  expect(hiddenRead).toMatchObject({
    interpretation: { sourceKey: 'rule:familiar' },
    value: 7,
    candidates: [],
    sources: [],
  });
  await expect(
    member.mutation(api.characterSheetLinkedInputs.saveInterpretation, {
      ...scope,
      sourceKey: 'rule:familiar',
      operationId: 'cannot-save-redacted-token',
    }),
  ).rejects.toThrow('Choose an available supporting source');
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, {
      campaignId,
      sheetDemo: undefined,
    }),
  );
  expect(
    await member.query(api.characterSheetLinkedInputs.read, scope),
  ).toMatchObject({
    interpretation: { sourceKey },
    value: 1,
    fallbackState: 'suspended',
  });
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, {
      campaignId: undefined,
      sheetDemo: true,
    }),
  );
  await member.mutation(api.characterSheetLinkedInputs.clearInterpretation, {
    ...scope,
    operationId: 'clear-hidden-interpretation',
  });
  expect(
    await member.query(api.characterSheetLinkedInputs.read, scope),
  ).toMatchObject({
    interpretation: null,
    value: 7,
  });
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, {
      campaignId,
      sheetDemo: undefined,
    }),
  );
  expect(
    await member.query(api.characterSheetLinkedInputs.read, scope),
  ).toMatchObject({
    interpretation: null,
    value: 1,
    fallback: 7,
    fallbackState: 'suspended',
  });
});

test('another relationship and unsupported input names cannot be injected into a sheet read', async () => {
  const { owner, characterId, companionId, campaignId, relationshipId } =
    await fixture();
  const unrelatedId = await owner.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Unrelated',
    kind: 'pc',
    operationId: 'unrelated',
  });
  await expect(
    owner.query(api.characterSheetLinkedInputs.read, {
      characterId: unrelatedId,
      relationshipId,
      input,
    }),
  ).rejects.toThrow('Companion Relationship not found');
  const invalidInputRead = makeFunctionReference<
    'query',
    {
      characterId: Id<'character'>;
      relationshipId: Id<'companionRelationship'>;
      input: { kind: string };
    }
  >('characterSheetLinkedInputs:read');
  await expect(
    owner.query(invalidInputRead, {
      characterId: companionId,
      relationshipId,
      input: { kind: 'abilityScore' },
    }),
  ).rejects.toThrow();
  await expect(
    owner.query(api.characterSheetLinkedInputs.read, {
      characterId: companionId,
      relationshipId,
      input: { kind: 'classLevels', classRuleIdentity: '  ' },
    }),
  ).rejects.toThrow('valid named linked input');
  await expect(
    owner.mutation(api.characterSheetLinkedInputs.saveFallback, {
      characterId: companionId,
      relationshipId,
      input: { kind: 'classLevels', classRuleIdentity: ' fighter ' },
      value: 3,
      operationId: 'alias',
    }),
  ).rejects.toThrow('valid named linked input');
  await expect(
    owner.mutation(api.characterSheetLinkedInputs.saveFallback, {
      characterId,
      relationshipId,
      input,
      value: Number.NaN,
      operationId: 'nan',
    }),
  ).rejects.toThrow('finite whole fallback');
});

test('linked inputs use the ordinary sheet writer and the latest allowed edit wins', async () => {
  const { owner, member, companionId, relationshipId } = await fixture();
  const scope = { characterId: companionId, relationshipId, input };
  await owner.mutation(api.characterSheetLinkedInputs.saveFallback, {
    ...scope,
    value: 7,
    operationId: 'first',
  });
  await member.mutation(api.characterSheetLinkedInputs.saveFallback, {
    ...scope,
    value: 9,
    operationId: 'second',
  });
  expect(
    await owner.query(api.characterSheetLinkedInputs.read, scope),
  ).toMatchObject({ fallback: 9, lastOperationId: 'second' });
  await owner.mutation(api.characterSheetLinkedInputs.clearFallback, {
    ...scope,
    operationId: 'clear',
  });
  expect(
    await member.query(api.characterSheetLinkedInputs.read, scope),
  ).toMatchObject({ fallback: null, lastOperationId: 'clear' });
});

test('every linked-input writer prunes stale warnings and rejects maintenance, obsolete epochs and sheet authority', async () => {
  const { t, owner, companionId, relationshipId } = await fixture();
  const scope = { characterId: companionId, relationshipId, input };
  const commands = (writeEpoch?: number) => [
    () =>
      owner.mutation(api.characterSheetLinkedInputs.saveFallback, {
        ...scope,
        value: 7,
        operationId: 'save',
        writeEpoch,
      }),
    () =>
      owner.mutation(api.characterSheetLinkedInputs.clearFallback, {
        ...scope,
        operationId: 'clear',
        writeEpoch,
      }),
    () =>
      owner.mutation(api.characterSheetLinkedInputs.saveInterpretation, {
        ...scope,
        sourceKey: 'bond',
        operationId: 'interpret',
        writeEpoch,
      }),
    () =>
      owner.mutation(api.characterSheetLinkedInputs.clearInterpretation, {
        ...scope,
        operationId: 'clear-interpret',
        writeEpoch,
      }),
  ];
  for (const command of commands()) {
    await t.run((ctx) =>
      ctx.db.insert('acceptedWarning', {
        characterId: companionId,
        check: 'old-check',
        subject: 'old-subject',
        fingerprint: 'obsolete',
        acceptedBy: 'test|owner',
        acceptedAt: 0,
      }),
    );
    await command();
    expect(
      withSheetCatalog(
        await owner.query(api.characterSheet.read, {
          characterId: companionId,
        }),
      ),
    ).toMatchObject({ acceptedWarnings: [] });
  }
  const before = await owner.query(api.characterSheetLinkedInputs.read, scope);
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
  for (const command of commands())
    await expect(command()).rejects.toThrow('MAINTENANCE');
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, { closed: false }),
  );
  for (const command of commands())
    await expect(command()).rejects.toThrow('RELOAD_REQUIRED');
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, { authority: 'sheet' }),
  );
  for (const command of commands(1))
    await expect(command()).rejects.toThrow('RELOAD_REQUIRED');
  expect(await owner.query(api.characterSheetLinkedInputs.read, scope)).toEqual(
    before,
  );
});

test('partial source loss retains compatible contributions, saved fallbacks and recorded dormant Keep choices', async () => {
  const { t, owner, member, characterId, companionId, relationshipId } =
    await fixture();
  const master = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  const level = master?.entries.find((entry) => entry.kind === 'classLevel');
  const fighter = master?.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'fighter',
  );
  if (
    !level ||
    fighter?.detail.kind !== 'class' ||
    !('featuresByLevel' in fighter.detail)
  )
    throw new Error('Fixture fighter missing');
  const fighterDetail = fighter.detail;
  await t.run(async (ctx) => {
    const featureId = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Retained bond',
      ruleIdentity: 'retained-bond',
      stacksWithItself: false,
      sources: [],
      detail: { kind: 'classFeature' },
      modifiers: [],
    });
    await ctx.db.patch('catalogEntry', fighter._id, {
      detail: {
        ...fighterDetail,
        featuresByLevel: [{ classLevel: 1, catalogEntryId: featureId }],
      },
    });
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId,
    entryId: level._id,
    classEntryId: fighter._id,
    operationId: 'fighter',
  });
  const grantKey = { source: 'fighter', classLevel: 1, entry: 'retained-bond' };
  await owner.mutation(api.characterSheet.editGrantState, {
    characterId,
    grantKey,
    state: { notes: 'Keep my chosen bond' },
    operationId: 'notes',
  });
  await owner.mutation(api.companionRelationships.addSource, {
    relationshipId,
    source: {
      key: 'fighter',
      label: 'Fighter contribution',
      enabled: true,
      grantKey,
    },
    operationId: 'addition',
  });
  const scope = { characterId: companionId, relationshipId, input };
  await member.mutation(api.characterSheetLinkedInputs.saveFallback, {
    ...scope,
    value: 8,
    operationId: 'fallback',
  });
  expect(
    await owner.query(api.characterSheetLinkedInputs.read, scope),
  ).toMatchObject({
    value: 1,
    fallbackState: 'suspended',
    contributions: [
      { sourceKey: 'bond', value: 1 },
      { sourceKey: 'fighter', value: 1 },
    ],
  });
  await owner.mutation(api.characterSheet.deleteClassLevel, {
    characterId,
    entryId: level._id,
    operationId: 'lost-source',
  });
  expect(
    await member.query(api.characterSheetLinkedInputs.read, scope),
  ).toMatchObject({
    status: 'available',
    value: 0,
    fallback: 8,
    fallbackState: 'suspended',
    contributions: [{ sourceKey: 'bond', value: 0 }],
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId }),
    ),
  ).toMatchObject({
    calculated: {
      resolvedEntries: expect.arrayContaining([
        expect.objectContaining({
          dormant: true,
          counting: false,
          entry: expect.objectContaining({ notes: 'Keep my chosen bond' }),
        }),
      ]),
    },
  });
  await member.mutation(api.characterSheet.editGrantState, {
    characterId,
    grantKey,
    state: { notes: 'Changed while dormant' },
    operationId: 'later-notes',
  });
  await member.mutation(api.characterSheetLinkedInputs.saveFallback, {
    ...scope,
    value: 13,
    operationId: 'later-fallback',
  });
  await member.mutation(api.characterSheet.setDormantEntryKept, {
    characterId,
    target: { grantKey },
    kept: true,
    operationId: 'keep',
  });
  await member.mutation(api.characterSheet.addClassLevel, {
    characterId,
    classEntryId: fighter._id,
    operationId: 'restore-source',
  });
  const restored = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  expect(restored?.calculated.resolvedEntries).toContainEqual(
    expect.objectContaining({
      dormant: false,
      counting: true,
      entry: expect.objectContaining({
        notes: 'Changed while dormant',
        kept: true,
      }),
    }),
  );
  expect(
    await owner.query(api.characterSheetLinkedInputs.read, scope),
  ).toMatchObject({ value: 1, fallback: 13, fallbackState: 'suspended' });
});

test('linked permanent inputs exclude upstream Temporary Effects and retain lasting adjustments', async () => {
  const { owner, member, characterId, companionId, relationshipId } =
    await fixture();
  const master = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  const level = master?.entries.find((entry) => entry.kind === 'classLevel');
  const fighter = master?.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'fighter',
  );
  if (!level || !fighter) throw new Error('Fixture fighter missing');
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId,
    entryId: level._id,
    classEntryId: fighter._id,
    hpGained: 10,
    operationId: 'hit-points',
  });
  await owner.mutation(api.characterSheet.createPersonalAdjustment, {
    characterId,
    name: 'Lasting HP adjustment',
    modifiers: [{ target: 'hp', bonusType: 'untyped', value: 2 }],
    operationId: 'lasting',
  });
  await owner.mutation(api.characterSheet.createSheetEntry, {
    characterId,
    name: 'Temporary HP effect',
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 1,
    },
    modifiers: [{ target: 'hp', bonusType: 'untyped', value: 4 }],
    operationId: 'temporary',
  });
  const scope = {
    characterId: companionId,
    relationshipId,
    input: { kind: 'maximumHp' },
  } as const;
  expect(
    await member.query(api.characterSheetLinkedInputs.read, scope),
  ).toMatchObject({ status: 'available', value: 16 });
  expect(
    await member.query(api.characterSheetLinkedInputs.read, {
      ...scope,
      projection: 'permanent',
    }),
  ).toMatchObject({ status: 'available', value: 12 });
});

test('a Militia-only master keeps missing maximum HP unresolved without exposing full-sheet warnings', async () => {
  const { t, owner, member, characterId, companionId, relationshipId } =
    await fixture();
  await owner.mutation(api.characterSheet.createPersonalAdjustment, {
    characterId,
    name: 'Unknown HP contribution',
    modifiers: [
      {
        target: 'hp',
        bonusType: 'untyped',
        value: { formula: '@unsupported' },
      },
    ],
    operationId: 'missing-hp',
  });
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, { sheetMode: 'militiaOnly' }),
  );
  const master = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  expect(master?.character.sheetMode).toBe('militiaOnly');
  expect(master?.calculated.warningsForAcceptance).not.toEqual(
    expect.arrayContaining([
      expect.objectContaining({ check: 'unsupportedFormula' }),
    ]),
  );
  const scope = {
    characterId: companionId,
    relationshipId,
    input: { kind: 'maximumHp' },
  } as const;
  expect(
    (
      await member.query(api.characterSheetLinkedInputs.list, {
        characterId: companionId,
        relationshipId,
      })
    ).find((row) => row.input.kind === 'maximumHp'),
  ).toMatchObject({
    value: null,
    unavailableReason: 'missingInput',
    prerequisiteStatus: 'unresolved',
  });
  await member.mutation(api.characterSheetLinkedInputs.saveFallback, {
    ...scope,
    value: 17,
    operationId: 'missing-hp-fallback',
  });
  expect(
    await member.query(api.characterSheetLinkedInputs.read, scope),
  ).toMatchObject({ value: 17, resolution: 'fallback' });
});

test('permanent linked inputs exclude support granted by an upstream Temporary Effect', async () => {
  const { t, owner, member, characterId, companionId, relationshipId } =
    await fixture();
  const master = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  const level = master?.entries.find((entry) => entry.kind === 'classLevel');
  const fighter = master?.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'fighter',
  );
  if (!level || !fighter) throw new Error('Fixture fighter missing');
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId,
    entryId: level._id,
    classEntryId: fighter._id,
    operationId: 'fighter',
  });
  const effectId = await owner.mutation(api.characterSheet.createSheetEntry, {
    characterId,
    name: 'Temporary companion support',
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 1,
    },
    modifiers: [],
    operationId: 'temporary-support',
  });
  const effectSheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, {
      characterId,
    }),
  );
  const effect = effectSheet?.entries.find((entry) => entry._id === effectId);
  if (effect?.kind !== 'spellEffect')
    throw new Error('Fixture spell effect missing');
  await t.run(async (ctx) => {
    const featureId = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Granted support',
      ruleIdentity: 'temporary-support',
      stacksWithItself: false,
      sources: [],
      detail: { kind: 'classFeature' },
      modifiers: [],
    });
    await ctx.db.patch('catalogEntry', effect.catalogEntryId, {
      grants: [{ catalogEntryId: featureId }],
    });
  });
  const grantKey = { source: effectId, entry: 'temporary-support' };
  await owner.mutation(api.companionRelationships.addSource, {
    relationshipId,
    source: {
      key: 'temporary',
      label: 'Temporary supporting feature',
      enabled: true,
      grantKey,
    },
    operationId: 'temporary-source',
  });
  const scope = { characterId: companionId, relationshipId, input };
  expect(
    await member.query(api.characterSheetLinkedInputs.read, scope),
  ).toMatchObject({
    value: 1,
    contributions: [
      { sourceKey: 'bond', value: 1 },
      { sourceKey: 'temporary', value: 1 },
    ],
  });
  expect(
    await member.query(api.characterSheetLinkedInputs.read, {
      ...scope,
      projection: 'permanent',
    }),
  ).toMatchObject({
    value: 1,
    contributions: [{ sourceKey: 'bond', value: 1 }],
    sources: expect.arrayContaining([{ key: 'bond', label: 'Companion bond' }]),
  });
  expect(
    await owner.query(api.companionRelationships.list, {
      characterId: companionId,
    }),
  ).toMatchObject([{ relationshipId, status: 'active' }]);
  await member.mutation(api.characterSheetLinkedInputs.saveFallback, {
    ...scope,
    value: 7,
    operationId: 'permanent-fallback',
  });
  await owner.mutation(api.companionRelationships.setSourceEnabled, {
    relationshipId,
    sourceKey: 'bond',
    enabled: false,
    operationId: 'temporary-support-only',
  });
  expect(
    await member.query(api.characterSheetLinkedInputs.read, scope),
  ).toMatchObject({ value: 1, fallbackState: 'suspended' });
  expect(
    await member.query(api.characterSheetLinkedInputs.read, {
      ...scope,
      projection: 'permanent',
    }),
  ).toMatchObject({
    status: 'unavailable',
    value: 7,
    resolution: 'fallback',
    fallbackState: 'applied',
    contributions: [],
    candidates: [],
  });
});

async function fixture(
  sources: Doc<'companionRelationship'>['sources'] = [source],
) {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    for (const [tokenIdentifier, orgIds] of [
      ['test|owner', [{ orgId: 'org', role: 'member' }]],
      ['test|member', [{ orgId: 'org', role: 'member' }]],
      ['test|outsider', []],
    ] satisfies [string, { orgId: string; role: 'member' }[]][])
      await ctx.db.insert('user', {
        tokenIdentifier,
        orgIds,
        characterSheetDemo: true,
      });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'test|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'test|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'test|outsider' });
  const campaignId = await owner.mutation(api.campaign.createCampaign, {
    name: 'Ironfang',
    description: '',
    organizationId: 'org',
  });
  await t.run((ctx) =>
    ctx.db.patch('campaign', campaignId, {
      e2eFixture: {
        namespace: 'linked-inputs',
        version: 1,
        workerKey: '0',
        caseKey: 'linked-inputs',
        campaignKey: 'linked-inputs',
      },
    }),
  );
  const characterId = await owner.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Ada',
    kind: 'pc',
    operationId: 'ada',
  });
  const companionId = await member.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Bryn',
    kind: 'npc',
    operationId: 'bryn',
  });
  const relationshipId = await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: characterId,
    companionCharacterId: companionId,
    kind: 'familiar',
    sources,
    operationId: 'link',
  });
  return {
    t,
    owner,
    member,
    outsider,
    campaignId,
    characterId,
    companionId,
    relationshipId,
  };
}
