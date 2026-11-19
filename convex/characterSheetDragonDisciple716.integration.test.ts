/// <reference types="vite/client" />
// @vitest-environment node
import { afterAll, describe, expect, test } from 'vitest';
import {
  assessCatalogAdmission,
  collectReferences,
} from '../scripts/catalog/admission';
import { importCatalog } from '../scripts/catalog/import';
import type { PreviewEntry } from '../scripts/catalog/map';
import { pcgenOwnerSelection } from '../scripts/catalog/pcgen-owners';
import {
  createCatalogRelease,
  serializeCatalogRelease,
} from '../scripts/catalog/release';
import { reviewedCuration } from '../scripts/catalog/reviewed-curation-data';
import reviewedRemaps from '../scripts/catalog/reviewed-remaps.json';
import { reviewedAdmissionSchema } from '../src/lib/catalog/admission-schema';
import section15Registry from '../src/lib/catalog/data/section15-registry.json';
import { importedCatalogEntrySchema } from '../src/lib/catalog/imported-entry-schema';
import { legalResources } from '../src/lib/catalog/legal-resources-data';
import { validateCatalogReleaseArtifact } from '../src/lib/catalog/release-schema';
import { catalogRuntimeCompatibility } from '../src/lib/catalog/runtime-compatibility';
import { materializePinnedTree } from '../tests/catalog/pinned-sources';
import { releaseFixture } from '../tests/catalog-release-fixture';
import { dragonDiscipleSheetFiles } from '../tests/fixtures/pcgen-716/dragon-disciple-sheet-files';
import {
  installReleasedBodies,
  readSavedSheet,
} from '../tests/released-catalog-entries';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { storedIdentity } from './catalogIdentityAllocation';

// #716 D4 (research party-code §1; docs/catalog-import/prestige-and-unchained.md):
// a Bloodrager 4 / Monk 1 / Dragon Disciple 3 on a saved sheet, through the
// stored path, against what the rules give. Every body is a real pinned one:
// the Foundry Bloodrager and Monk and the PCGen Dragon Disciple, imported
// with the committed (checked) structure records, admitted by the gate,
// released, allocated their stored identities (`storedIdentity`) and
// converted by the app's candidate adapter (`installReleasedBodies`).
//
// Expected values, from the PRD capture (prd-2026-10-20/pages/…) and PCGen
// (pcgen-25523dbc data/pathfinder/paizo/roleplaying_game/core_rulebook/…):
//
// | Value                       | Bloodrager 4 | Monk 1 | Dragon Disciple 3 | Sum |
// | --------------------------- | ------------ | ------ | ----------------- | --- |
// | Hit Die                     | d10 (a)      | d8 (d) | d12 (g)           |     |
// | Base attack bonus           | +4 (b)       | +0 (e) | +2 (h)            | +6  |
// | Fortitude                   | +4 (b)       | +2 (e) | +2 (h)            | +8  |
// | Reflex                      | +1 (b)       | +2 (e) | +1 (h)            | +4  |
// | Will                        | +1 (b)       | +2 (e) | +2 (h)            | +5  |
// | Skill ranks per level       | 4 + Int (c)  | 4 + Int (f) | 2 + Int (i)  |     |
//
// (a) advancedClassGuide/classes/bloodrager.html:351; (b) its table, :376-379;
// (c) :432. (d) coreRulebook/classes/monk.html:350; (e) :357; (f) :353.
// (g) coreRulebook/prestigeClasses/dragonDisciple.html:351, PCGen
// cr_classes.lst:379 HD:12; (h) dragonDisciple.html:363-365, PCGen
// cr_classes.lst:379 (BASEAB classlevel*3/4, BASE.Fortitude,BASE.Will good);
// (i) dragonDisciple.html:360, PCGen cr_classes.lst:383 STARTSKILLPTS:2.
//
// Casting: an arcane advance at Dragon Disciple 2 and 3, none at 1
// (dragonDisciple.html:363-365 Spells per Day; PCGen cr_classes.lst:385-386,
// `2|3 ADD:SPELLCASTER|Arcane`), to spells per day, spells known and caster
// level only (dragonDisciple.html:377). A Bloodrager casting as a 6th-level
// one has one 1st-level spell per day and nothing higher (bloodrager.html:381)
// and knows four 1st-level spells (bloodrager.html:411), against one and two
// as a Bloodrager 4 (:379, :409).
//
// Natural Armor Increase: +1 at Dragon Disciple 1-3 (dragonDisciple.html:363,
// :379; PCGen cr_abilities_class.lst:2965). Ability Boost: Str +2 from
// Dragon Disciple 2 (dragonDisciple.html:364, :380; PCGen
// cr_abilities_class.lst:2966). Favored class: "Prestige classes … can never
// be a favored class" (coreRulebook/classes.html:396) and "do not gain any
// favored class bonuses for those levels" (coreRulebook/prestigeClasses.html:346).
//
// Left out, the owner's: whether Blood of Dragons' levels stack into the
// Bloodrager's bloodline powers and spells, and which bonus-feat list the
// Bloodline Feat uses (the records' rationales in reviewed-curation.json).
// The Bloodrager's bloodline is left unchosen, and both features are asserted
// only as present, description-only rows. Scaled Fist (held on Product
// Identity) is not selected.

const modules = import.meta.glob('./**/*.ts');
const tree = await materializePinnedTree(dragonDiscipleSheetFiles);
afterAll(() => tree.dispose());

const bloodragerKey = 'pf1/E27lMw9YNOAjS009';
const monkKey = 'pf1/W8dxwZ1CZiwLKsqr';
const dragonDiscipleKey = 'everythingpath/dragon-disciple';
const ddFeature = (name: string) => `${dragonDiscipleKey}-${name}`;
const knowledgeArcana = 'skill.kar';

const imported = await importCatalog({
  systemPath: tree.systemPath,
  contentPath: tree.contentPath,
  remaps: reviewedRemaps,
  curation: reviewedCuration,
  pcgen: {
    path: tree.pcgenPath,
    selection: pcgenOwnerSelection.filter(
      ({ key }) => key === 'Dragon Disciple',
    ),
  },
  wholeCorpus: false,
});
/** No Attribution Assessments: the rows admit on their declared books (#227). */
const attribution = {
  assessments: [],
  registry: reviewedAdmissionSchema.shape.registry.parse(section15Registry),
  evidence: {},
};
const release = await validateCatalogReleaseArtifact(
  JSON.parse(
    serializeCatalogRelease(
      await createCatalogRelease({
        artifact: imported,
        attribution,
        legalResources,
        releaseNumber: 716,
        compatibility: catalogRuntimeCompatibility,
        inputValues: {
          remaps: reviewedRemaps,
          curation: reviewedCuration,
          localData: [],
          parsers: 'dragon-disciple-716-sheet-proof',
          sanitizers: 'dragon-disciple-716-sheet-proof',
          ruleResources: [],
          upstreamVerification: { status: 'unverified' },
        },
      }),
    ),
  ),
);
/** The release's definition rows, by stable key. */
const releasedRows = new Map(
  release.batches
    .flat()
    .flatMap((row) =>
      row.kind === 'definition'
        ? [[row.key, row.payload as PreviewEntry] as const]
        : [],
    ),
);

/** The three classes' released bodies, closed over their references. */
function closure() {
  const needed = new Set([bloodragerKey, monkKey, dragonDiscipleKey]);
  for (const key of needed) {
    const body = releasedRows.get(key);
    if (!body) throw new Error(`Missing released body: ${key}`);
    for (const reference of collectReferences(body)) needed.add(reference);
  }
  return [...needed].map((key) => releasedRows.get(key)!);
}

type Level = {
  key: string;
  hpGained: number;
  ranks?: Record<string, number>;
  favoredHp?: boolean;
};
/** A Character with these Class Levels in order, through the public saved-sheet API. */
async function character(levels: readonly Level[], favored: string[] = []) {
  const bodies = closure();
  const { t, owner, scope } = await releaseFixture(modules);
  const ids = new Map<string, Id<'catalogEntry'>>();
  const id = (key: string) => {
    const found = ids.get(key);
    if (!found) throw new Error(`Missing ${key}`);
    return found;
  };
  await t.run(async (ctx) => {
    for (const body of bodies) {
      const stored = storedIdentity(importedCatalogEntrySchema.parse(body));
      if (stored.kind !== 'stored') throw new Error(stored.reason);
      ids.set(
        body.externalKey,
        await ctx.db.insert('catalogEntry', stored.identity),
      );
    }
  });
  await installReleasedBodies(t, bodies, id);
  const read = () => readSavedSheet(owner, scope);
  const first = (await read()).entries.find(
    (entry) => entry.kind === 'classLevel',
  );
  if (!first) throw new Error('Missing first Class Level');
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: {
      strength: 14,
      dexterity: 12,
      constitution: 12,
      intelligence: 10,
      wisdom: 10,
      charisma: 11,
    },
    operationId: 'scores',
  });
  if (favored.length)
    await owner.mutation(api.characterSheet.editCreationSettings, {
      ...scope,
      settings: {},
      favoredClassIds: favored.map(id),
      operationId: 'favored',
    });
  const levelIds: Id<'characterSheetEntry'>[] = [];
  for (const [index, level] of levels.entries()) {
    const entryId =
      index === 0
        ? first._id
        : await owner.mutation(api.characterSheet.addClassLevel, {
            ...scope,
            classEntryId: id(level.key),
            operationId: `add-${index}`,
          });
    await owner.mutation(api.characterSheet.editClassLevel, {
      ...scope,
      entryId,
      classEntryId: id(level.key),
      hpGained: level.hpGained,
      skillRanks: level.ranks ?? {},
      ...(level.favoredHp ? { favoredClassBonus: { choice: 'hp' } } : {}),
      operationId: `level-${index}`,
    });
    levelIds.push(entryId);
  }
  return { owner, scope, id, read, levelIds };
}

const ranks = { [knowledgeArcana]: 1 };
/** The build: one Knowledge (arcana) rank at each of the five levels before the prestige class, each level's Hit Die maximum. */
const bloodrager = (favoredHp = false): Level => ({
  key: bloodragerKey,
  hpGained: 10,
  ranks,
  favoredHp,
});
const monk: Level = { key: monkKey, hpGained: 8, ranks };
const dragonDisciple: Level = { key: dragonDiscipleKey, hpGained: 12 };
const build = (favoredHp = false) => [
  ...Array.from({ length: 4 }, () => bloodrager(favoredHp)),
  monk,
  ...Array.from({ length: 3 }, () => dragonDisciple),
];

/** The Class Level at this index (0-based), or a thrown error. */
function levelAt(
  levelIds: readonly Id<'characterSheetEntry'>[],
  index: number,
) {
  const entryId = levelIds.at(index);
  if (!entryId) throw new Error(`Missing Class Level ${index + 1}`);
  return entryId;
}

const checksOf = (
  sheet: Awaited<ReturnType<typeof readSavedSheet>>,
  entryId: Id<'characterSheetEntry'>,
) =>
  sheet.calculated.prerequisites
    .filter((check) => check.entryId === entryId && check.view === 'recorded')
    .map(({ clause, met }) => ['kind' in clause ? clause.kind : 'anyOf', met]);

describe('a Bloodrager 4 / Monk 1 / Dragon Disciple 3 (#716 D4)', () => {
  test('its three classes are released whole from the pinned tree', () => {
    const gate = assessCatalogAdmission({ artifact: imported, ...attribution });
    expect({
      held: gate.held,
      failures: gate.failures,
      dependentOmissions: gate.dependentOmissions,
    }).toEqual({ held: [], failures: [], dependentOmissions: [] });
    for (const key of [bloodragerKey, monkKey, dragonDiscipleKey])
      expect(releasedRows.has(key), key).toBe(true);
    expect(releasedRows.get(dragonDiscipleKey)?.detail).toMatchObject({
      kind: 'class',
      classKind: 'prestige',
      tag: 'dragonDisciple',
    });
  });

  test('enters Dragon Disciple on the recorded build and sums the three classes', async () => {
    const { read, levelIds } = await character(build());
    const sheet = await read();
    const dd1 = levelAt(levelIds, 5);
    // The entry check reads Bloodrager 4 / Monk 1: Knowledge (arcana) 5
    // ranks and 1st-level arcane casting pass; the four clauses no atom reads
    // (race, template, language, casting without preparation) stay unchecked.
    expect(checksOf(sheet, dd1)).toEqual([
      ['unchecked', null],
      ['unchecked', null],
      ['skillRanks', true],
      ['unchecked', null],
      ['canCast', true],
      ['unchecked', null],
    ]);
    // A later prestige level has no entry check of its own.
    for (const later of levelIds.slice(6))
      expect(checksOf(sheet, later)).toEqual([]);

    const { calculated } = sheet;
    expect(calculated.hitDice).toBe(8);
    expect(calculated.ownProgression.classBases).toEqual({
      bab: 6,
      saves: { fort: 8, ref: 4, will: 5 },
    });
    const parts = (target: 'bab' | 'save.fort' | 'save.ref' | 'save.will') =>
      calculated.breakdowns[target]?.applied.map(({ entryName, value }) => [
        entryName,
        value,
      ]);
    expect({
      bab: parts('bab'),
      fort: parts('save.fort'),
      ref: parts('save.ref'),
      will: parts('save.will'),
    }).toEqual({
      bab: [
        ['Bloodrager 4', 4],
        ['Monk 1', 0],
        ['Dragon Disciple 3', 2],
      ],
      fort: [
        ['Bloodrager 4', 4],
        ['Monk 1', 2],
        ['Dragon Disciple 3', 2],
      ],
      ref: [
        ['Bloodrager 4', 1],
        ['Monk 1', 2],
        ['Dragon Disciple 3', 1],
      ],
      will: [
        ['Bloodrager 4', 1],
        ['Monk 1', 2],
        ['Dragon Disciple 3', 2],
      ],
    });
    // Each level's recorded maximum is within its own Hit Die: 4 × 10 + 8 +
    // 3 × 12 = 84, plus Constitution +1 at each of the 8 levels.
    expect(calculated.hp).toBe(92);
    expect(
      calculated.warnings.filter(({ check }) =>
        ['hpGainedAboveMaximum', 'firstLevelHpNotMaximum'].includes(check),
      ),
    ).toEqual([]);
    // Skill ranks per level: 4 at the Bloodrager and Monk levels, 2 at each
    // Dragon Disciple level (Int +0).
    expect(
      calculated.classLevels.map(({ skillRankBudget }) => skillRankBudget),
    ).toEqual([4, 4, 4, 4, 4, 2, 2, 2]);
  }, 120_000);

  test('reads a Dragon Disciple level above its d12 and a Monk level above its d8', async () => {
    const levels = build();
    levels[4] = { ...monk, hpGained: 9 };
    levels[7] = { ...dragonDisciple, hpGained: 13 };
    const { read } = await character(levels);
    expect(
      (await read()).calculated.warnings
        .filter(({ check }) => check === 'hpGainedAboveMaximum')
        .map(({ message }) => message),
    ).toEqual([
      'Hit points gained exceed the d8 maximum.',
      'Hit points gained exceed the d12 maximum.',
    ]);
  }, 120_000);

  test('casts as a Bloodrager two levels higher, from Dragon Disciple 2 and 3 only', async () => {
    const { read, levelIds, id } = await character(build());
    const { calculated } = await read();
    const [, dd2, dd3] = levelIds.slice(5);
    // One advance at each of Dragon Disciple 2 and 3, none at 1; the
    // Bloodrager is the only arcane class, so each is pre-filled.
    expect(
      calculated.castingAdvances.map((advance) => [
        advance.entryId,
        advance.prestigeClassLevel,
        advance.kind,
        advance.targetClassEntryId,
        advance.prefilled,
      ]),
    ).toEqual([
      [dd2, 2, 'arcane', id(bloodragerKey), true],
      [dd3, 3, 'arcane', id(bloodragerKey), true],
    ]);
    expect(
      calculated.warnings.filter(
        ({ check }) => check === 'castingAdvanceMissing',
      ),
    ).toEqual([]);
    expect(calculated.spellcastings).toHaveLength(1);
    const [casting] = calculated.spellcastings;
    expect({
      classTag: casting?.classTag,
      classLevels: casting?.classLevels,
      castingLevel: casting?.castingLevel,
      casterLevel: casting?.casterLevel?.total,
      castableSpellLevels: casting?.castableSpellLevels,
      slots: casting?.slots.map(({ spellLevel, base, bonus, known }) => ({
        spellLevel,
        base,
        bonus,
        known,
      })),
    }).toEqual({
      classTag: 'bloodrager',
      classLevels: 4,
      castingLevel: 6,
      casterLevel: 6,
      castableSpellLevels: [1],
      slots: [{ spellLevel: 1, base: 1, bonus: 0, known: 4 }],
    });
    // Nothing else of the Bloodrager advances: its rows stop at its 4th
    // level (Improved Uncanny Dodge at 5th and the Bloodline Feat at 6th,
    // bloodrager.html:380-381, are not granted).
    const grants = (source: string) =>
      calculated.resolvedEntries.flatMap(({ entry }) =>
        'grantKey' in entry && entry.grantKey?.source === source
          ? [[entry.grantKey.classLevel, entry.grantKey.entry]]
          : [],
      );
    expect(grants(bloodragerKey)).toEqual([
      [1, 'pf1/Aq9rx7oWgv7A7kiV'],
      [1, 'pf1/5op6M5xchCJNsYRt'],
      [1, 'pf1/9EX00obqhGHcrOdp'],
      [2, 'pf1/7WaQxnVaaoL4AGr8'],
      [3, 'pf1/xvBGDYUbsE4Ozean'],
      [4, 'everythingpath/bloodrager-bloodline-4'],
      [4, 'pf1/HFab4vfATqdqnlSJ'],
      [4, 'pf1/vVkKDPniD09W5JgO'],
      [4, 'pf1/uomEu0NuSl6Q43fP'],
    ]);
    expect(grants(dragonDiscipleKey)).toEqual([
      [1, ddFeature('weapon-and-armor-proficiency')],
      [1, ddFeature('spells-per-day')],
      [1, ddFeature('blood-of-dragons')],
      [1, ddFeature('natural-armor-increase')],
      [2, ddFeature('ability-boost')],
      [2, ddFeature('bloodline-feat')],
      [2, ddFeature('dragon-bite')],
      [3, ddFeature('breath-weapon')],
    ]);
  }, 120_000);

  test("shows Natural Armor Increase's +1 natural armor and Ability Boost's +2 Strength with their sources", async () => {
    const { read } = await character(build());
    const sheet = await read();
    const { calculated } = sheet;
    const applied = (target: 'ac.natural' | 'ability.str') =>
      calculated.breakdowns[target]?.applied.map(
        ({ source, bonusType, value }) => ({ source, bonusType, value }),
      );
    expect(applied('ac.natural')).toEqual([
      {
        source: ddFeature('natural-armor-increase'),
        bonusType: 'untyped',
        value: 1,
      },
    ]);
    // 10 + Dex +1 + natural armor +1; touch AC leaves the natural armor out.
    expect(calculated.derivedStatistics).toMatchObject({
      ac: { total: 12 },
      touchAc: { total: 11 },
    });
    expect(applied('ability.str')).toEqual([
      expect.objectContaining({ bonusType: 'base', value: 14 }),
      {
        source: ddFeature('ability-boost'),
        bonusType: 'untyped',
        value: 2,
      },
    ]);
    expect(calculated.abilities.strength).toEqual({ score: 16, modifier: 3 });
    // Ability Boost's Con and Int steps (6th and 8th) give nothing at 3rd.
    expect(calculated.abilities).toMatchObject({
      constitution: { score: 12 },
      intelligence: { score: 10 },
    });

    // The owner's two questions: both features are present as description-only
    // rows, with no modifier, prompt or stacking rule (item 2 of the brief).
    for (const name of ['blood-of-dragons', 'bloodline-feat']) {
      const row = sheet.catalogEntries.find(
        ({ ruleIdentity }) => ruleIdentity === ddFeature(name),
      );
      expect(row, name).toMatchObject({
        modifiers: [],
        detail: { kind: 'classFeature' },
      });
      expect(row?.detail, name).not.toHaveProperty('picksByLevel');
      expect(row?.description, name).not.toBe('');
    }
  }, 120_000);

  test('gives Dragon Disciple levels no favored class entitlement', async () => {
    const { owner, scope, id, read, levelIds } = await character(build(true), [
      bloodragerKey,
    ]);
    const favoredWarnings = async () =>
      (await read()).calculated.warnings
        .filter(({ check }) => check.startsWith('favoredClass'))
        .map(({ check, subject }) => [check, subject]);
    // The Bloodrager levels' +1 hit point each count; no level asks for more.
    expect((await read()).calculated.hp).toBe(96);
    expect(await favoredWarnings()).toEqual([]);
    // Recording Dragon Disciple as favored names it a prestige class and
    // still gives its levels nothing to choose.
    await owner.mutation(api.characterSheet.editCreationSettings, {
      ...scope,
      settings: {},
      favoredClassIds: [id(dragonDiscipleKey)],
      operationId: 'favored-prestige',
    });
    expect(await favoredWarnings()).toEqual([
      ['favoredClassPrestige', `class:${dragonDiscipleKey}`],
      ...levelIds
        .slice(0, 4)
        .map((entryId) => ['favoredClassBonusNotFavored', entryId]),
    ]);
  }, 120_000);

  test('refuses entry on a build without 1st-level arcane casting', async () => {
    // Bloodrager 3 / Monk 2 has the five Knowledge (arcana) ranks but casts
    // no spells: a bloodrager casts from 4th level (bloodrager.html:376-379).
    const { read, levelIds } = await character([
      ...Array.from({ length: 3 }, () => bloodrager()),
      monk,
      monk,
      dragonDisciple,
    ]);
    const sheet = await read();
    expect(checksOf(sheet, levelAt(levelIds, 5))).toEqual([
      ['unchecked', null],
      ['unchecked', null],
      ['skillRanks', true],
      ['unchecked', null],
      ['canCast', false],
      ['unchecked', null],
    ]);
    expect(
      sheet.calculated.spellcastings.map(
        ({ classTag, castingLevel, castableSpellLevels }) => ({
          classTag,
          castingLevel,
          castableSpellLevels,
        }),
      ),
    ).toEqual([
      { classTag: 'bloodrager', castingLevel: 3, castableSpellLevels: [] },
    ]);
  }, 120_000);
});
