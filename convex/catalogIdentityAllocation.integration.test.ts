/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { beforeAll, expect, test } from 'vitest';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';
import { preloadCalledConvexModules } from '../tests/convex-modules';
import {
  impactAdapter,
  prepare,
  releaseFixture,
  type ReleaseTest,
} from '../tests/catalog-release-fixture';
import type { AllocationBatch } from '../src/lib/catalog/identity-allocation';
import {
  importedCatalogEntrySchema,
  importedDetailSchema,
  importedSpellDetailSchema,
} from '../src/lib/catalog/imported-entry-schema';
import type { GenericValidator } from 'convex/values';
import type {
  ReleaseJson,
  ReleaseRow,
} from '../src/lib/catalog/release-schema';
import { runCatalogReleaseOperator } from '../scripts/catalog/release-operator';
import { internal } from './_generated/api';
import {
  allocatableKinds,
  type IdentityPlaceholder,
} from './catalogIdentityAllocation';
import {
  candidateDefinition,
  candidateStableReferences,
  globalDefinition,
} from './lib/catalogCandidateDefinition';
import schema, { catalogEntryValidator } from './schema';

// #413 F1: the identity allocator's conflicts, refusals and kinds on small
// synthetic releases. The real pinned bodies, interruption and readiness
// are proven at the scope seam (catalogReleaseScope.integration.test.ts).

const modules = import.meta.glob('./**/*.ts');
beforeAll(() => refuseRepeatedPaginatedQueries(schema, modules));
preloadCalledConvexModules({ modules, testFile: import.meta.url });

const feat = { kind: 'feat', featTypes: [], repeatable: 'no' };
function definition(
  key: string,
  name: string,
  detail: { kind: string } & Record<string, ReleaseJson>,
): ReleaseRow {
  return {
    kind: 'definition',
    key,
    payload: {
      externalKey: key,
      upstreamKey: key,
      pack: 'test',
      name,
      detail,
      description: 'The unpublished body.',
      sources: [{ book: 'Test' }],
      modifiers: [],
      unsupported: [],
    },
  };
}
const racialTrait = (key: string, raceKeys: string[]) =>
  definition(key, 'Trait', {
    kind: 'racialTrait',
    bonusSkillRanksPerLevel: 0,
    raceKeys,
  });

async function allocateAll(t: ReleaseTest, releaseNumber = 1) {
  const batches = [];
  let cursor: string | null = null;
  for (;;) {
    const batch: AllocationBatch = await t.mutation(
      internal.catalogIdentityAllocation.allocate,
      { releaseNumber, cursor },
    );
    batches.push(batch);
    if (batch.isDone) return batches;
    cursor = batch.continueCursor;
  }
}
function allocationAdapter(t: ReleaseTest) {
  return {
    allocate: (args: { releaseNumber: number; cursor: string | null }) =>
      t.mutation(internal.catalogIdentityAllocation.allocate, args),
  };
}
/** The operator's `allocate` and `reconcile` steps over the registered functions. */
function operatorAllocate(t: ReleaseTest) {
  return runCatalogReleaseOperator({
    args: ['allocate', '--number', '1'],
    allocationAdapter: allocationAdapter(t),
  });
}
function operatorReconcile(t: ReleaseTest, { retryFailed = false } = {}) {
  return runCatalogReleaseOperator({
    args: [
      'reconcile',
      '--number',
      '1',
      ...(retryFailed ? ['--retry-failed'] : []),
    ],
    impactAdapter: impactAdapter(t),
  });
}
const ready = {
  stopped: 'ready',
  status: { isReady: true, missingIdentityCount: 0 },
};

async function globals(t: ReleaseTest, keys: string[]) {
  return t.run(async (ctx) => {
    const found: string[] = [];
    for (const key of keys)
      if (
        await ctx.db
          .query('catalogEntry')
          .withIndex('by_scope_and_ruleIdentity', (q) =>
            q.eq('scope', 'global').eq('ruleIdentity', key),
          )
          .first()
      )
        found.push(key);
    return found;
  });
}

test('an unresolved reference, a reference of the wrong kind and a kind with no stored shape are reported, and those bodies get no identity', async () => {
  const { t } = await releaseFixture(modules);
  await prepare(t, [
    // Sorts last, so it is still only a release body when referenced.
    definition('test/z-feat', 'Feat', feat),
    // Names a key that is neither stored nor in the release.
    racialTrait('test/orphan', ['test/missing-race']),
    // Names the release's feat where the adapter needs a race.
    racialTrait('test/wrong', ['test/z-feat']),
    // A kind the candidate adapter doesn't convert.
    definition('test/type', 'Type', {
      kind: 'creatureType',
      tag: 'type',
      hitDie: 8,
      bab: 'full',
      saves: { fort: 'good', ref: 'good', will: 'good' },
      classSkills: [],
      skillRanksPerHitDie: 2,
    }),
  ]);
  const [batch] = await allocateAll(t);
  expect(batch).toMatchObject({ allocatedCount: 1, existingCount: 0 });
  expect(batch?.conflicts).toEqual([
    {
      kind: 'unresolvedReference',
      key: 'test/orphan',
      reference: 'test/missing-race',
    },
    {
      kind: 'unsupported',
      key: 'test/type',
      reason: 'No stored identity shape for kind creatureType',
    },
    {
      kind: 'referenceKind',
      key: 'test/wrong',
      reference: 'test/z-feat',
      expectedKind: 'race',
      found: { source: 'release', kind: 'feat' },
    },
  ]);
  expect(
    await globals(t, ['test/z-feat', 'test/orphan', 'test/wrong', 'test/type']),
  ).toEqual(['test/z-feat']);
});

test('allocation refuses a release that is not prepared, a superseded preparation and a closed write gate', async () => {
  const { t } = await releaseFixture(modules);
  await expect(allocateAll(t)).rejects.toThrow(
    'Catalog Release does not exist',
  );
  await prepare(t, [definition('test/feat', 'Feat', feat)]);
  // A newer numbered candidate supersedes release 1's preparation.
  await prepare(t, [], 2);
  await expect(allocateAll(t, 1)).rejects.toThrow(
    'Catalog Release preparation was superseded',
  );
  await t.run(async (ctx) => {
    const runId = await ctx.db.insert('initialMigrationRun', {
      operationId: 'gate',
      epoch: 0,
      state: 'maintenance',
      frontendBuild: 'test',
      catalogManifest: 'test',
      startedAt: 0,
      deadline: 1,
    });
    await ctx.db.insert('initialMigrationControl', {
      key: 'character-sheet',
      epoch: 0,
      closed: true,
      authority: 'legacy',
      runId,
    });
  });
  await expect(allocateAll(t, 2)).rejects.toThrow('MAINTENANCE');
  expect(await globals(t, ['test/feat'])).toEqual([]);
});

// The reviewer's sequence: a rehearsal import of Spells into a Character
// before the first allocation, then a release holding that Spell and a
// domain that grants it.
const probeSpellKey = 'pf1/probeSpell';
const probeDomainKey = 'pf1/probeDomain';
const probeSpell = definition(probeSpellKey, 'Probe Spell', {
  kind: 'spell',
  levels: { wizard: 1 },
  grantedLevels: {},
  school: 'evo',
  subschools: [],
  descriptors: [],
});
const probeDomain = definition(probeDomainKey, 'Probe Domain', {
  kind: 'classFeature',
  spellcasting: {
    optionKind: 'domain',
    extraSlot: 'domain',
    grantedSpells: {
      style: 'slot',
      spells: [{ spellLevel: 1, spellKey: probeSpellKey }],
    },
  },
});
async function importPrivateSpell(
  owner: Awaited<ReturnType<typeof releaseFixture>>['owner'],
  scope: Awaited<ReturnType<typeof releaseFixture>>['scope'],
) {
  const [spellId] = await owner.mutation(
    internal.characterSheetSpells.installPreparedCatalog,
    {
      ...scope,
      spells: [
        importedCatalogEntrySchema
          .extend({ detail: importedSpellDetailSchema })
          .parse(probeSpell.payload),
      ],
      operationId: 'rehearsal-spells',
    },
  );
  if (!spellId) throw new Error('Missing imported Spell');
  return spellId;
}

test('a Spell imported privately before allocation still gets the global identity a Granted Spell needs, and the run becomes ready (#413 F1)', async () => {
  const { t, owner, scope } = await releaseFixture(modules);
  const privateSpell = await importPrivateSpell(owner, scope);
  await prepare(t, [probeDomain, probeSpell]);
  expect(await operatorAllocate(t)).toMatchObject({
    allocatedCount: 2,
    existingCount: 0,
    conflicts: [],
    stopped: 'complete',
  });
  expect(await globals(t, [probeSpellKey, probeDomainKey])).toEqual([
    probeSpellKey,
    probeDomainKey,
  ]);
  // The private Spell stays the Character's own.
  expect(
    await t.run((ctx) => ctx.db.get('catalogEntry', privateSpell)),
  ).toMatchObject({ scope: 'character', importedSpell: true });
  expect(await operatorAllocate(t)).toMatchObject({
    allocatedCount: 0,
    existingCount: 2,
    conflicts: [],
  });
  expect(await operatorReconcile(t)).toMatchObject(ready);
});

test('a run stuck on a privately imported Spell recovers by rerunning allocation and retrying the failure (#413 F1)', async () => {
  const { t, owner, scope } = await releaseFixture(modules);
  await importPrivateSpell(owner, scope);
  // What allocation stored before it required a global Spell: the domain,
  // with the private Spell counted as the Spell's identity.
  await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Probe Domain',
      ruleIdentity: probeDomainKey,
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: { kind: 'classFeature' },
    }),
  );
  await prepare(t, [probeDomain, probeSpell]);
  const failed = await operatorReconcile(t);
  expect(failed).toMatchObject({
    stopped: 'failed',
    status: {
      isReady: false,
      discoveryError: `Discovery failed for ${probeDomainKey}: Candidate reference ${probeSpellKey} is unavailable for ${probeDomainKey}`,
    },
  });
  expect(await operatorAllocate(t)).toMatchObject({
    allocatedCount: 1,
    existingCount: 1,
    conflicts: [],
    stopped: 'complete',
  });
  expect(await operatorReconcile(t, { retryFailed: true })).toMatchObject({
    ...ready,
    runId: (failed as { runId: string }).runId,
  });
});

// The kinds the candidate adapter converts: a release body's kind that a
// stored definition shares, since the adapter refuses a body whose kind
// differs from its stored identity's.
function literalKinds(validator: GenericValidator): string[] {
  if (validator.kind === 'union')
    return validator.members.flatMap((member) => literalKinds(member));
  if (validator.kind !== 'object') return [];
  const kind = validator.fields.kind;
  return kind?.kind === 'literal' ? [String(kind.value)] : [];
}
const storedKinds = new Set(
  catalogEntryValidator.members.flatMap((member) =>
    literalKinds(member.fields.detail),
  ),
);
const adapterKinds = importedDetailSchema.options
  .map((option) => option.shape.kind.value)
  .filter((kind) => storedKinds.has(kind))
  .sort();

test('the allocator has a stored identity shape for every kind the candidate adapter converts (#413 F1)', () => {
  expect(adapterKinds).toContain('archetype');
  expect(adapterKinds).toContain('spellEffect');
  expect([...allocatableKinds].sort()).toEqual(adapterKinds);
});

// One release body of each kind the adapter converts, naming each other as
// a release does.
const each = (name: string) => `pf1/each${name}`;
const oneOfEachKind: Record<string, ReleaseRow> = {
  race: definition(each('Race'), 'Race', {
    kind: 'race',
    racialHitDice: 0,
    creatureTypes: ['humanoid'],
    creatureSubtypes: ['human'],
    racialTraits: [each('RacialTrait')],
  }),
  racialTrait: definition(each('RacialTrait'), 'Racial Trait', {
    kind: 'racialTrait',
    bonusSkillRanksPerLevel: 0,
    raceKeys: [each('Race')],
    standard: true,
  }),
  class: definition(each('Class'), 'Class', {
    kind: 'class',
    hitDie: 8,
    bab: 'full',
    saves: { fort: 'good', ref: 'poor', will: 'poor' },
    classSkills: [],
    tag: 'eachClass',
    classKind: 'base',
    skillRanksPerLevel: 2,
    featuresByLevel: [{ classLevel: 1, externalKey: each('ClassFeature') }],
  }),
  classFeature: definition(each('ClassFeature'), 'Class Feature', {
    kind: 'classFeature',
    spellcasting: {
      optionKind: 'domain',
      extraSlot: 'domain',
      grantedSpells: {
        style: 'slot',
        spells: [{ spellLevel: 1, spellKey: each('Spell') }],
      },
    },
  }),
  archetype: definition(each('Archetype'), 'Archetype', {
    kind: 'archetype',
    classKeys: [each('Class')],
    replaces: [
      { classLevel: 1, externalKey: each('ClassFeature'), scope: 'whole' },
    ],
    adds: [],
  }),
  feat: definition(each('Feat'), 'Feat', feat),
  trait: definition(each('Trait'), 'Trait', {
    kind: 'trait',
    traitType: 'combat',
  }),
  spell: definition(each('Spell'), 'Spell', {
    kind: 'spell',
    levels: { wizard: 1 },
    grantedLevels: {},
    school: 'evo',
    subschools: [],
    descriptors: [],
  }),
  spellEffect: definition(each('SpellEffect'), 'Spell Effect', {
    kind: 'spellEffect',
    defaultCasterLevel: 1,
    lastsOverOneDay: false,
    spellKey: each('Spell'),
  }),
  item: definition(each('Item'), 'Item', {
    kind: 'item',
    consumable: false,
    price: 1,
    weight: 1,
  }),
  itemAbility: definition(each('ItemAbility'), 'Item Ability', {
    kind: 'itemAbility',
    appliesTo: 'weapon',
    bonusEquivalent: 1,
  }),
  manual: definition(each('Manual'), 'Manual', { kind: 'manual' }),
};

test('a release holding one definition of each kind the adapter converts goes from no identities to ready through allocation alone (#413 F1)', async () => {
  expect(Object.keys(oneOfEachKind).sort()).toEqual(adapterKinds);
  const { t } = await releaseFixture(modules);
  const rows = Object.values(oneOfEachKind);
  const keys = rows.map(({ key }) => key);
  await prepare(t, rows);
  expect(await globals(t, keys)).toEqual([]);
  expect(await operatorAllocate(t)).toMatchObject({
    allocatedCount: rows.length,
    existingCount: 0,
    conflicts: [],
    stopped: 'complete',
  });
  expect(await globals(t, keys)).toEqual(keys);
  expect(await operatorReconcile(t)).toMatchObject(ready);
});

test('a placeholder is a stored identity or a refusal, never both (#413 F1)', () => {
  const identity = {
    scope: 'global' as const,
    name: 'Feat',
    ruleIdentity: 'test/feat',
    sources: [],
    modifiers: [],
    stacksWithItself: false,
    detail: { kind: 'feat' as const },
  };
  const placeholders: IdentityPlaceholder[] = [
    { kind: 'stored', identity },
    { kind: 'unsupported', reason: 'No shape' },
    // @ts-expect-error A refusal holds no identity.
    { kind: 'unsupported', reason: 'No shape', identity },
    // @ts-expect-error A stored identity has no refusal reason.
    { kind: 'stored', identity, reason: 'No shape' },
    // @ts-expect-error Every placeholder names its kind.
    { identity },
  ];
  expect(placeholders).toHaveLength(5);
});

// #413 F1: the extraction the allocator checks and the references the
// adapter resolves are written in two places; this ties them. One body per
// kind that names references, each reference field populated once. The
// release holds a body for exactly the keys extraction lists (of the kind
// it requires, else a feat), so a key the adapter resolves but extraction
// misses fails the conversion; each listed key must then be required, and
// each listed kind enforced. A reference field the adapter gains needs a
// body here.
const ref = (name: string) => `pf1/ref${name}`;
const withSlotFeats = (row: ReleaseRow, feats: string[]): ReleaseRow => ({
  ...row,
  payload: {
    ...(row.payload as Record<string, ReleaseJson>),
    grantsSlots: [{ kind: 'feat', count: 1, feats }],
  },
});
const referencingBodies: ReleaseRow[] = [
  definition('pf1/refsClass', 'Class', {
    kind: 'class',
    hitDie: 8,
    bab: 'full',
    saves: { fort: 'good', ref: 'poor', will: 'poor' },
    classSkills: [],
    tag: 'refsClass',
    classKind: 'base',
    skillRanksPerLevel: 2,
    featuresByLevel: [{ classLevel: 1, externalKey: ref('ClassFeature') }],
  }),
  definition('pf1/refsArchetype', 'Archetype', {
    kind: 'archetype',
    classKeys: [ref('ArchetypeClass')],
    replaces: [{ classLevel: 1, externalKey: ref('Replaced'), scope: 'whole' }],
    adds: [{ classLevel: 2, externalKey: ref('Added') }],
    featureChanges: [{ externalKey: ref('Changed'), scope: 'whole' }],
  }),
  definition('pf1/refsClassFeature', 'Class Feature', {
    kind: 'classFeature',
    duplicateUpgrade: ref('Upgrade'),
    picksByLevel: [
      {
        kind: 'pool',
        classLevel: 1,
        list: 'talents',
        count: 1,
        members: [ref('Member')],
      },
    ],
    spellcasting: {
      optionKind: 'domain',
      extraSlot: 'domain',
      grantedSpells: {
        style: 'slot',
        spells: [{ spellLevel: 1, spellKey: ref('GrantedSpell') }],
      },
    },
  }),
  definition('pf1/refsItem', 'Item', {
    kind: 'item',
    consumable: false,
    price: 1,
    weight: 1,
    baseItemKey: ref('BaseItem'),
  }),
  definition('pf1/refsRacialTrait', 'Racial Trait', {
    kind: 'racialTrait',
    bonusSkillRanksPerLevel: 0,
    raceKeys: [ref('Race')],
    replaces: [ref('StandardTrait')],
  }),
  definition('pf1/refsRace', 'Race', {
    kind: 'race',
    racialHitDice: 0,
    creatureTypes: ['humanoid'],
    creatureSubtypes: [],
    racialTraits: [ref('RaceTrait')],
  }),
  withSlotFeats(definition('pf1/refsFeat', 'Feat', feat), [ref('SlotFeat')]),
];
const referencedDetail: Record<
  string,
  { kind: string } & Record<string, ReleaseJson>
> = {
  feat,
  spell: {
    kind: 'spell',
    levels: { wizard: 1 },
    grantedLevels: {},
    school: 'evo',
    subschools: [],
    descriptors: [],
  },
  item: { kind: 'item', consumable: false, price: 1, weight: 1 },
  race: {
    kind: 'race',
    racialHitDice: 0,
    creatureTypes: ['humanoid'],
    creatureSubtypes: [],
  },
  racialTrait: { kind: 'racialTrait', bonusSkillRanksPerLevel: 0 },
};

test('the references allocation checks are exactly the ones the candidate adapter requires, with the kinds it requires (#413 F1)', async () => {
  const references = referencingBodies.map((row) => ({
    key: row.key,
    references: candidateStableReferences(
      importedCatalogEntrySchema.parse(row.payload),
    ),
  }));
  const referenced = new Map<string, string | undefined>();
  for (const body of references) {
    // Every body names references, distinct across bodies.
    expect(body.references).not.toEqual([]);
    for (const { key, kind } of body.references) {
      expect(referenced.has(key)).toBe(false);
      referenced.set(key, kind);
    }
  }
  const { t } = await releaseFixture(modules);
  await prepare(t, [
    ...referencingBodies,
    ...[...referenced].map(([key, kind]) => {
      const detail = referencedDetail[kind ?? 'feat'];
      if (!detail) throw new Error(`No referenced body of kind ${kind}`);
      return definition(key, key, detail);
    }),
  ]);
  expect(await operatorAllocate(t)).toMatchObject({
    conflicts: [],
    stopped: 'complete',
  });
  const outcomes = await t.run(async (ctx) => {
    const release = await ctx.db
      .query('catalogRelease')
      .withIndex('by_releaseNumber', (q) => q.eq('releaseNumber', 1))
      .unique();
    if (!release) throw new Error('Missing release');
    const stored = async (key: string) => {
      const row = await globalDefinition(ctx, key);
      if (!row) throw new Error(`Missing identity ${key}`);
      return row;
    };
    const convert = async (key: string) => {
      try {
        await candidateDefinition(ctx, release, await stored(key));
        return 'converted';
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    };
    const outcomes: Record<string, string> = {};
    for (const body of references) {
      outcomes[body.key] = await convert(body.key);
      for (const { key, kind } of body.references) {
        // Without the reference's identity, the body doesn't convert.
        const { _id, _creationTime, ...target } = await stored(key);
        await ctx.db.delete('catalogEntry', _id);
        outcomes[`${body.key} without ${key}`] = await convert(body.key);
        await ctx.db.insert('catalogEntry', target);
        if (!kind) continue;
        // With a reference of another kind, it doesn't either.
        const { _id: restoredId } = await stored(key);
        await ctx.db.patch('catalogEntry', restoredId, {
          detail: { kind: 'feat' },
        });
        outcomes[`${body.key} with ${key} a feat`] = await convert(body.key);
        await ctx.db.replace('catalogEntry', restoredId, target);
      }
    }
    return outcomes;
  });
  for (const body of references) {
    expect(outcomes[body.key], body.key).toBe('converted');
    for (const { key, kind } of body.references) {
      expect(outcomes[`${body.key} without ${key}`]).toContain(key);
      if (kind)
        expect(outcomes[`${body.key} with ${key} a feat`]).toContain(key);
    }
  }
});
