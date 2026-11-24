/// <reference types="vite/client" />
// @vitest-environment node
// terrain-bond-repromote (#716; docs/catalog-import/archetype-structures-686.md):
// the Guide's and the Warden's Terrain Bond replace hunter's bond (APG p. 125,
// PRD advancedPlayersGuide/coreClasses/ranger.html:367; UC, PRD
// ultimateCombat/classArchetypes/ranger.html:384) and grant no animal
// companion, so a Ranger who takes either loses the companion hunter's bond
// gave (the Ranger batch's promotion review, finding 1). Since
// companion-entitlement-replaced the Ranger Class Level then entitles none:
// shown here on the real Guide and Warden, imported from the pinned tree
// with their two Terrain Bond records (checked by the record step on review
// t3-review-5801a4c1…) given fixed review metadata in memory, so the case
// does not depend on the committed receipt, installed through a prepared
// Catalog Release and read through the sheet's public queries.
import type { WithoutSystemFields } from 'convex/server';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import { collectReferences } from '../scripts/catalog/admission';
import { importCatalog } from '../scripts/catalog/import';
import { pcgenPin } from '../scripts/catalog/inventory';
import type { PreviewEntry } from '../scripts/catalog/map';
import { pcgenOwnerSelection } from '../scripts/catalog/pcgen-owners';
import { reviewedCuration } from '../scripts/catalog/reviewed-curation-data';
import reviewedRemaps from '../scripts/catalog/reviewed-remaps.json';
import type { StructureRecord } from '../scripts/catalog/structure-curation';
import { findReviewedClassCasting } from '../src/lib/character-sheet-casting-tables';
import {
  materializePinnedTree,
  pinnedPath,
  readPinned,
} from '../tests/catalog/pinned-sources';
import { releaseFixture } from '../tests/catalog-release-fixture';
import { pcgenOwnerEmissionFiles } from '../tests/fixtures/pcgen-716/owner-emission-files';
import { installReleasedBodies } from '../tests/released-catalog-entries';
import { api } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';

const modules = import.meta.glob('./**/*.ts');

const APG = 'roleplaying_game/advanced_players_guide/apg_abilities_class.lst';
const UC = 'roleplaying_game/ultimate_combat/uc_abilities_class.lst';
const rangerKey = 'pf1/w3wjj6s3N69BsMc3';
const huntersBondKey = 'pf1/Bs5i98ja24ODe9WL';
const druidKey = 'pf1/7eZQP0MzeO2svmVF';
/** The two Terrain Bond records, committed checked; the test substitutes their review metadata in memory. */
const terrainBonds = [
  'everythingpath/ranger-guide-terrain-bond',
  'everythingpath/ranger-warden-terrain-bond',
];
const archetypes = [
  {
    name: 'Guide',
    key: 'everythingpath/ranger-guide',
    file: APG,
    terrainBond: 'everythingpath/ranger-guide-terrain-bond',
  },
  {
    name: 'Warden',
    key: 'everythingpath/ranger-warden',
    file: UC,
    terrainBond: 'everythingpath/ranger-warden-terrain-bond',
  },
] as const;

/**
 * The Ranger class with every pinned Foundry record it links
 * (`Compendium.pf1.<pack>.…<id>`), transitively, as far as the pinned store
 * holds them.
 */
async function rangerClosure() {
  const packs = pinnedPath('pf1', 'packs');
  const byId = new Map<string, string>();
  for (const pack of await readdir(packs))
    for (const file of await readdir(join(packs, pack)).catch(() => []))
      byId.set(file.split('.').at(-2) ?? '', `packs/${pack}/${file}`);
  const files = new Set<string>();
  const queue = [rangerKey.slice(4)];
  for (let id = queue.pop(); id; id = queue.pop()) {
    const path = byId.get(id);
    if (!path || files.has(path)) continue;
    files.add(path);
    const text = await readPinned('pf1', path);
    for (const [, linked] of text.matchAll(
      /Compendium\.pf1\.[a-z-]+\.(?:Item\.)?([A-Za-z0-9]{16})/g,
    ))
      if (linked) queue.push(linked);
  }
  return [...files].map((path) => `pf1/${path}`);
}

const tree = await materializePinnedTree([
  ...(await rangerClosure()),
  ...[
    ...new Set([
      ...pcgenOwnerEmissionFiles,
      'roleplaying_game/advanced_players_guide/advanced_players_guide.pcc',
      APG,
      'roleplaying_game/ultimate_combat/_ultimate_combat.pcc',
      UC,
    ]),
  ].map((path) => `pcgen/${pcgenPin.directory}/${path}`),
]);
afterAll(() => tree.dispose());

/** The committed records, the two Terrain Bonds checked with substituted review metadata; each other record as committed. */
const structures = (reviewedCuration.structures ?? []).map(
  (record): StructureRecord =>
    terrainBonds.includes(record.externalKey)
      ? {
          ...record,
          status: 'checked',
          reviewedBy:
            'in-memory check (characterSheetTerrainBondCompanion.integration.test.ts)',
          reviewedOn: '2026-11-23',
          receipt: `t3-review-${'0'.repeat(64)}`,
        }
      : record,
);
const artifact = await importCatalog({
  systemPath: tree.systemPath,
  contentPath: tree.contentPath,
  remaps: reviewedRemaps,
  curation: { ...reviewedCuration, structures },
  pcgen: {
    path: tree.pcgenPath,
    selection: pcgenOwnerSelection.filter(
      (owner) =>
        owner.kind === 'archetype' &&
        archetypes.some(
          ({ name, file }) =>
            owner.file === file && owner.key === `Ranger Archetype ~ ${name}`,
        ),
    ),
  },
  wholeCorpus: false,
});
const bodies = new Map(
  artifact.catalog.entries.map((entry) => [entry.externalKey, entry] as const),
);

/** The bodies the Ranger and the two archetypes reach, closed over their references. */
function closure() {
  const needed = new Set<string>([
    rangerKey,
    ...archetypes.map(({ key }) => key),
  ]);
  for (const key of needed) {
    const body = bodies.get(key);
    if (!body) throw new Error(`Missing body: ${key}`);
    for (const reference of collectReferences(body)) needed.add(reference);
    if (body.detail.kind === 'archetype')
      for (const { externalKey } of body.detail.adds) needed.add(externalKey);
  }
  return [...needed].map((key) => bodies.get(key)!);
}

type StoredIdentity = WithoutSystemFields<Doc<'catalogEntry'>>;
const identity = (name: string, ruleIdentity: string) => ({
  scope: 'global' as const,
  name,
  ruleIdentity,
  modifiers: [],
  sources: [],
  stacksWithItself: false,
});
/**
 * Stored identities of each body kind, with placeholder detail the release
 * body replaces. The Ranger's carries the reviewed casting of its tag, which
 * a release's class body must match (`candidateClassDetail`).
 */
const stubs: Record<
  string,
  (name: string, ruleIdentity: string) => StoredIdentity
> = {
  class: (name, key) => ({
    ...identity(name, key),
    detail: {
      kind: 'class',
      classKind: 'base',
      hitDie: 10,
      bab: 'full',
      saves: { fort: 'good', ref: 'good', will: 'poor' },
      skillRanksPerLevel: 6,
      classSkills: [],
      featuresByLevel: [],
      picksByLevel: [],
      casting: findReviewedClassCasting('ranger'),
    },
  }),
  archetype: (name, key) => ({
    ...identity(name, key),
    detail: { kind: 'archetype', classEntryIds: [], replaces: [], adds: [] },
  }),
  classFeature: (name, key) => ({
    ...identity(name, key),
    detail: { kind: 'classFeature' },
  }),
  feat: (name, key) => ({ ...identity(name, key), detail: { kind: 'feat' } }),
  item: (name, key) => ({
    ...identity(name, key),
    detail: { kind: 'item', consumable: false },
  }),
  spell: (name, key) => ({ ...identity(name, key), detail: { kind: 'spell' } }),
};
const stubOf = ({ externalKey, name, detail }: PreviewEntry) => {
  const stub = stubs[detail.kind];
  if (!stub) throw new Error(`No stored identity shape for ${detail.kind}`);
  return stub(name, externalKey);
};

/**
 * A Ranger 7 (and Druid levels when asked) built from the released bodies,
 * with an animal companion linked through hunter's bond on its first Ranger
 * Class Level (CRB p. 66) and, with Druid levels, through nature bond on the
 * first Druid level (CRB p. 51). The Druid, a second source only, is a stub
 * without features: its nature bond is no Grant.
 */
async function rangerWithCompanion({
  druidLevels,
  withProgression,
}: {
  druidLevels: number;
  withProgression: boolean;
}) {
  const released = closure();
  const { t, owner, create, scope } = await releaseFixture(modules);
  const ids = new Map<string, Id<'catalogEntry'>>();
  const id = (key: string) => {
    const found = ids.get(key);
    if (!found) throw new Error(`Missing ${key}`);
    return found;
  };
  await t.run(async (ctx) => {
    for (const body of released)
      ids.set(
        body.externalKey,
        await ctx.db.insert('catalogEntry', stubOf(body)),
      );
    ids.set(
      druidKey,
      await ctx.db.insert('catalogEntry', {
        ...identity('Druid', druidKey),
        detail: {
          kind: 'class',
          classKind: 'base',
          hitDie: 8,
          bab: 'threeQuarters',
          saves: { fort: 'good', ref: 'poor', will: 'good' },
          skillRanksPerLevel: 4,
          classSkills: [],
          featuresByLevel: [],
          picksByLevel: [],
        },
      }),
    );
  });
  await installReleasedBodies(t, released, id);
  const { characterId } = scope;
  const levels = async () =>
    (
      await owner.query(api.characterSheet.read, { characterId })
    )?.entries.flatMap((entry) =>
      entry.kind === 'classLevel' ? [entry] : [],
    ) ?? [];
  const [initial] = await levels();
  if (!initial) throw new Error('Missing initial level');
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId,
    entryId: initial._id,
    classEntryId: id(rangerKey),
    hpGained: 10,
    operationId: 'ranger-1',
  });
  for (let position = 2; position <= 7; position++)
    await owner.mutation(api.characterSheet.addClassLevel, {
      characterId,
      classEntryId: id(rangerKey),
      operationId: `ranger-${position}`,
    });
  for (let level = 1; level <= druidLevels; level++)
    await owner.mutation(api.characterSheet.addClassLevel, {
      characterId,
      classEntryId: id(druidKey),
      operationId: `druid-${level}`,
    });
  const all = await levels();
  const firstRanger = all.find((entry) => entry.state.position === 1);
  const firstDruid = all.find(
    (entry) => entry.state.classEntryId === id(druidKey),
  );
  if (!firstRanger) throw new Error('Missing first level');
  // A companion sheet without the Class Level a new sheet starts with.
  const companionId = await create('Companion');
  const unwanted = (
    await owner.query(api.characterSheet.read, { characterId: companionId })
  )?.entries.find((entry) => entry.kind === 'classLevel');
  if (!unwanted) throw new Error('Missing companion level');
  await owner.mutation(api.characterSheet.deleteClassLevel, {
    characterId: companionId,
    entryId: unwanted._id,
    operationId: 'classless',
  });
  await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: characterId,
    companionCharacterId: companionId,
    kind: 'animalCompanion',
    sources: [
      {
        key: 'hunters-bond',
        label: 'Hunter’s bond',
        sheetEntryId: firstRanger._id,
        enabled: true,
      },
      ...(firstDruid
        ? [
            {
              key: 'nature-bond',
              label: 'Nature bond',
              sheetEntryId: firstDruid._id,
              enabled: true,
            },
          ]
        : []),
    ],
    operationId: 'link',
  });
  if (withProgression)
    await owner.mutation(api.characterSheet.setCompanionProgression, {
      characterId: companionId,
      operationId: 'progression',
      progression: {
        species: 'wolf',
        hpGained: 10,
        skillRanks: {},
        abilityIncreases: [],
        advancementChoice: 'species',
        keep: false,
      },
    });
  const select = (key: string) => (selected: boolean) =>
    owner.mutation(api.characterSheet.setArchetypeSelected, {
      characterId,
      classEntryId: id(rangerKey),
      catalogEntryId: id(key),
      selected,
      operationId: `${key}-${selected}`,
    });
  const relationship = async () => {
    const [row] = await owner.query(api.companionRelationships.list, {
      characterId,
    });
    if (!row) throw new Error('Missing relationship');
    return row;
  };
  const restore = async () =>
    owner.mutation(api.companionRelationships.restore, {
      relationshipId: (await relationship()).relationshipId,
      operationId: 'restore',
    });
  const linkedLevels = async (classRuleIdentity: 'ranger' | 'druid') =>
    owner.query(api.characterSheetLinkedInputs.read, {
      characterId: companionId,
      relationshipId: (await relationship()).relationshipId,
      input: { kind: 'classLevels', classRuleIdentity },
    });
  const progression = async () =>
    (await owner.query(api.characterSheet.read, { characterId: companionId }))
      ?.calculated.companionProgression;
  const hunterBondRow = async () =>
    (
      await owner.query(api.characterSheet.read, { characterId })
    )?.calculated.resolvedEntries.find(
      ({ entry }) =>
        'catalogEntryId' in entry &&
        entry.catalogEntryId === id(huntersBondKey),
    );
  return {
    select,
    relationship,
    restore,
    linkedLevels,
    progression,
    hunterBondRow,
  };
}

// Ranger 7: hunter's bond gives effective druid level 7 − 3 = 4 (CRB p. 66),
// so 4 HD (CRB Table 3–8).
const huntersBond = {
  sourceKey: 'hunters-bond',
  ruleKind: 'rangerCompanion',
  classRuleIdentity: 'ranger',
  counting: true,
  classLevels: 7,
  effectiveLevel: 4,
};
const natureBond = {
  sourceKey: 'nature-bond',
  ruleKind: 'druidCompanion',
  classRuleIdentity: 'druid',
  counting: true,
  classLevels: 3,
  effectiveLevel: 3,
};
const replacedBond = (archetype: string) => ({
  sourceKey: 'hunters-bond',
  ruleKind: 'rangerCompanion',
  counting: false,
  classLevels: null,
  effectiveLevel: null,
  featureReplaced: { archetypes: [archetype] },
});
type Progression = Awaited<
  ReturnType<Awaited<ReturnType<typeof rangerWithCompanion>>['progression']>
>;
const counting = (result: Progression) =>
  result?.contributions.filter((contribution) => contribution.counting);

test('the import carries the real Guide and Warden: each replaces hunter’s bond at 4th level, whole, with its checked Terrain Bond', () => {
  expect(
    artifact.structure?.held.filter((key) => terrainBonds.includes(key)),
  ).toEqual([]);
  for (const { key, terrainBond } of archetypes) {
    const detail = bodies.get(key)?.detail;
    if (detail?.kind !== 'archetype') throw new Error(`No ${key}`);
    expect(detail.replaces, key).toContainEqual({
      externalKey: huntersBondKey,
      classLevel: 4,
      scope: 'whole',
    });
    expect(detail.adds, key).toContainEqual({
      externalKey: terrainBond,
      classLevel: 4,
    });
    expect(bodies.get(terrainBond)?.modifiers, terrainBond).toEqual([]);
  }
});

describe.each(archetypes)('the $name', ({ name, key }) => {
  // A sole source the rules no longer entitle interrupts its relationship as
  // a lost Grant does: the relationship read names the Archetype, it cannot
  // be restored, and the Companion borrows no ranger levels. Removing the
  // Archetype restores all.
  test(`a Ranger 7’s only source, hunter’s bond, replaced by the ${name}, interrupts the relationship until the ${name} goes`, async () => {
    const { select, relationship, restore, linkedLevels, hunterBondRow } =
      await rangerWithCompanion({ druidLevels: 0, withProgression: false });
    expect(await relationship()).toMatchObject({
      status: 'active',
      interruption: null,
      sources: [{ key: 'hunters-bond', available: true }],
    });
    expect(await linkedLevels('ranger')).toMatchObject({ value: 7 });
    await select(key)(true);
    expect((await hunterBondRow())?.dormant).toBe(true);
    expect(await relationship()).toMatchObject({
      status: 'interrupted',
      interruption: 'support',
      sources: [
        {
          key: 'hunters-bond',
          available: false,
          notEntitled: { reason: 'replacedBy', archetypes: [name] },
        },
      ],
    });
    await expect(restore()).rejects.toThrow(
      'This relationship has no available supporting source',
    );
    expect(await linkedLevels('ranger')).toMatchObject({
      status: 'unavailable',
      unavailableReason: 'interrupted',
      value: null,
    });
    await select(key)(false);
    expect((await hunterBondRow())?.dormant).toBe(false);
    const restored = await relationship();
    expect(restored).toMatchObject({
      status: 'active',
      interruption: null,
      sources: [{ key: 'hunters-bond', available: true }],
    });
    expect(restored.sources[0]).not.toHaveProperty('notEntitled');
    expect(await linkedLevels('ranger')).toMatchObject({ value: 7 });
  }, 120_000);

  test(`a Ranger 7’s companion stops counting while the ${name} replaces hunter’s bond, and counts again without it`, async () => {
    const { select, progression } = await rangerWithCompanion({
      druidLevels: 0,
      withProgression: true,
    });
    expect(await progression()).toMatchObject({
      status: 'active',
      effectiveLevel: 4,
      hitDice: 4,
      contributions: [huntersBond],
    });
    await select(key)(true);
    const replaced = await progression();
    expect(replaced).toMatchObject({
      status: 'dormant',
      effectiveLevel: null,
      hitDice: null,
      contributions: [replacedBond(name)],
    });
    expect(counting(replaced)).toEqual([]);
    await select(key)(false);
    const restored = await progression();
    expect(restored).toMatchObject({
      status: 'active',
      effectiveLevel: 4,
      hitDice: 4,
      contributions: [huntersBond],
    });
    expect(restored?.contributions[0]).not.toHaveProperty('featureReplaced');
  }, 120_000);

  // With a second entitled source the relationship stays active: only the
  // ranger's contribution goes (7 − 3 = 4), the druid keeps its 3, and the
  // restored total is 4 + 3 = 7.
  test(`a Ranger 7 / Druid 3 stays linked while the ${name} replaces hunter’s bond, lending only the druid levels`, async () => {
    const { select, relationship, linkedLevels, progression } =
      await rangerWithCompanion({ druidLevels: 3, withProgression: true });
    const both = await progression();
    expect(both).toMatchObject({ status: 'active', effectiveLevel: 7 });
    expect(counting(both)).toEqual([
      expect.objectContaining(huntersBond),
      expect.objectContaining(natureBond),
    ]);
    await select(key)(true);
    expect(await relationship()).toMatchObject({
      status: 'active',
      interruption: null,
      sources: [
        {
          key: 'hunters-bond',
          available: false,
          notEntitled: { reason: 'replacedBy', archetypes: [name] },
        },
        { key: 'nature-bond', available: true },
      ],
    });
    expect(await linkedLevels('ranger')).toMatchObject({ value: null });
    expect(await linkedLevels('druid')).toMatchObject({ value: 3 });
    const replaced = await progression();
    expect(replaced).toMatchObject({
      status: 'active',
      effectiveLevel: 3,
      hitDice: 3,
    });
    expect(counting(replaced)).toEqual([expect.objectContaining(natureBond)]);
    expect(replaced?.contributions).toContainEqual(
      expect.objectContaining(replacedBond(name)),
    );
    await select(key)(false);
    const restored = await relationship();
    expect(restored).toMatchObject({
      status: 'active',
      sources: [
        { key: 'hunters-bond', available: true },
        { key: 'nature-bond', available: true },
      ],
    });
    expect(restored.sources[0]).not.toHaveProperty('notEntitled');
    expect(await linkedLevels('ranger')).toMatchObject({ value: 7 });
    const total = await progression();
    expect(total).toMatchObject({ status: 'active', effectiveLevel: 7 });
    expect(counting(total)).toEqual([
      expect.objectContaining(huntersBond),
      expect.objectContaining(natureBond),
    ]);
  }, 120_000);
});
