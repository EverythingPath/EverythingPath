// party-curation-3 (#716; docs/catalog-import/party-structures-554.md): the
// structure records of Bladebound (#676) and Dragon Disciple (#554), written
// drafted and checked by the record step on a captured review, settle both
// owners' structure gates. Every case runs on the pinned tree.
import { readFile } from 'node:fs/promises';
import { afterAll, describe, expect, it } from 'vitest';
import { assessCatalogAdmission } from '../../scripts/catalog/admission';
import { importCatalog } from '../../scripts/catalog/import';
import { pcgenPin } from '../../scripts/catalog/inventory';
import { pcgenOwnerSelection } from '../../scripts/catalog/pcgen-owners';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import type { StructureRecord } from '../../scripts/catalog/structure-curation';
import {
  evaluateFormula,
  parseFormula,
} from '../../src/lib/character-sheet-formulas';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import {
  ownerEmissionFoundryFiles,
  pcgenOwnerEmissionFiles,
} from '../fixtures/pcgen-716/owner-emission-files';
import { materializePinnedTree } from './pinned-sources';

const tree = await materializePinnedTree([
  ...ownerEmissionFoundryFiles,
  ...pcgenOwnerEmissionFiles.map(
    (path) => `pcgen/${pcgenPin.directory}/${path}`,
  ),
]);
afterAll(() => tree.dispose());

const remaps: unknown = JSON.parse(
  await readFile('scripts/catalog/reviewed-remaps.json', 'utf8'),
);
/**
 * The committed Attribution Assessments, Registry and evidence: the #716 rows
 * admit on their declared books (#227), and the Magus's Arcane Pool on its
 * confirmed, content-bound assessment (party-data-2, K1).
 */
const attribution = reviewedAdmission;
/** The record step's captured review that checked the fifteen records. */
const RECEIPT =
  't3-review-3cb19584e17c9cf81d91f134748afd581a694b4c3e40263b567174d1a5c08638';

const um = 'roleplaying_game/ultimate_magic/um_abilities_class.lst';
const cr = 'roleplaying_game/core_rulebook/cr_abilities_class.lst';
const owned = (file: string, key: string) => [
  { kind: 'ownedFeature', id: `pcgen:${file}#${key}` },
];
const dd = (name?: string) =>
  `everythingpath/dragon-disciple${name ? `-${name}` : ''}`;
const level = '@classLevel.dragonDisciple';

// Descriptions: the PRD paragraphs verbatim, without their headings, links as
// plain text (ultimateMagic/spellcastingClassOptions/magus.html:367-368;
// coreRulebook/prestigeClasses/dragonDisciple.html:347-348, :378-387).
const text = {
  pool: "Instead of the normal arcane pool amount, the bladebound magus's arcane pool has a number of points equal to 1/3 his level (minimum 1) plus his Intelligence bonus. This ability changes the Arcane Pool class feature and replaces the magus arcana gained at 3rd level.",
  blade:
    "At 3rd level, the bladebound magus' gains a powerful sentient weapon called a black blade, whose weapon type is chosen by the magus. A magus with this class feature cannot take the familiar magus arcana, and cannot have a familiar of any kind, even from another class.",
  intro:
    'As some of the most ancient, powerful, and capricious creatures in existence, dragons occasionally enter into trysts with unsuspecting mortals or sire offspring with exceptional individuals. Likewise, the great power wielded by these creatures has long intrigued wizards and alchemists who have sought various magical methods to infuse their bodies with draconic power. As a result, the blood of dragons runs through the veins of many races. For some, this heritage manifests as a sorcerous bloodline and a predilection for magic; for others, however, the power of their draconic ancestors becomes an obsession. Spellcasters who embrace their draconic heritage and learn to channel their abilities can become dragon disciples, fearsome warriors who possess not only the repertoire of an accomplished sorcerer but also the ability to unleash the furious power of dragons upon their foes. As dragon disciples discover the power of their forebears, they can learn to breathe fire, take flight on leathery wings, and—at the pinnacle of their abilities—assume the form of a dragon. Although they are rare, dragon disciples can be found in any land where dragons interact with mortals.',
  blood:
    "A dragon disciple adds his level to his sorcerer levels when determining the powers gained from his bloodline. If the dragon disciple does not have levels of sorcerer, he instead gains bloodline powers of the draconic bloodline, using his dragon disciple level as his sorcerer level to determine the bonuses gained. He must choose a dragon type upon gaining his first level in this class and that type must be the same as his sorcerer type. This ability does not grant bonus spells to a sorcerer unless he possesses spell slots of an appropriate level. Such bonus spells are automatically granted if the sorcerer gains spell slots of the spell's level.",
  armor:
    "As his skin thickens, a dragon disciple takes on more and more of his progenitor's physical aspect. At 1st, 4th, and 7th level, a dragon disciple gains an increase to the character's existing natural armor (if any), as indicated on Table: Dragon Disciple. These armor bonuses stack.",
  boost:
    'As a dragon disciple gains levels in this prestige class, his ability scores increase as noted on Table: Dragon Disciple. These increases stack and are gained as if through level advancement.',
  feat: "Upon reaching 2nd level, and every three levels thereafter, a dragon disciple receives one bonus feat, chosen from the draconic bloodline's bonus feat list.",
  bite: "At 2nd level, whenever the dragon disciple uses his bloodline to grow claws, he also gains a bite attack. This is a primary natural attack that deals 1d6 points of damage (1d4 if the dragon disciple is Small), plus 1–1/2 times the dragon disciple's Strength modifier. Upon reaching 6th level, this bite also deals 1d6 points of energy damage. The type of damage dealt is determined by the dragon disciple's bloodline.",
  breath:
    'At 3rd level, a dragon disciple gains the breath weapon bloodline power, even if his level does not yet grant that power. Once his level is high enough to grant this ability through the bloodline, the dragon disciple gains an additional use of his breath weapon each day. The type and shape of the breath weapon depends on the type of dragon selected by the dragon disciple, as detailed under the Draconic sorcerer bloodline description.',
  blindsense:
    'At 5th level, the dragon disciple gains blindsense with a range of 30 feet. Using nonvisual senses the dragon disciple notices things he cannot see. He usually does not need to make Perception checks to notice and pinpoint the location of creatures within range of his blindsense ability, provided that he has line of effect to that creature. Any opponent the dragon disciple cannot see still has total concealment against him, and the dragon disciple still has the normal miss chance when attacking foes that have concealment. Visibility still affects the movement of a creature with blindsense. A creature with blindsense is still denied its Dexterity bonus to Armor Class against attacks from creatures it cannot see. At 10th level, the range of this ability increases to 60 feet.',
  form: 'At 7th level, a dragon disciple can assume the form of a dragon. This ability works like form of the dragon I. At 10th level, this ability functions as form of the dragon II and the dragon disciple can use this ability twice per day. His caster level for this effect is equal to his effective sorcerer levels for his draconic bloodline. Whenever he casts form of the dragon, he must assume the form of a dragon of the same type as his bloodline.',
  wings:
    "At 9th level, a dragon disciple gains the wings bloodline power, even if his level does not yet grant that power. Once his level is high enough to grant this ability through the bloodline, the dragon disciple's speed increases to 90 feet.",
};
const premult =
  'PREMULT:1,[PREFACT:1,ABILITIES,QualifiedForDragonDisciple=true],[PREMULT:3,[PRESPELLCAST:MEMORIZE=N],[PRESPELLCAST:TYPE=Arcane],[!PRECLASS:1,Sorcerer=1]],[PREMULT:2,[PRECLASS:1,Sorcerer=1],[PREABILITY:1,CATEGORY=Special Ability,Sorcerer Bloodline ~ Draconic]]';

/** The fifteen records as the batch report gives them, rationale aside. */
const expected = [
  {
    externalKey: 'everythingpath/magus-bladebound',
    sourceSha256:
      '3e68a8e71a108c3a04f810c81a545837cd292efb6afd737c1a6c4603d38e6700',
    fields: {
      'detail.replaces': [
        { classLevel: 3, externalKey: 'pf1/HJ2vLLDYkihPxFkD', scope: 'part' },
        { classLevel: 1, externalKey: 'pf1/mpe3JHJMINddqLWr', scope: 'whole' },
      ],
    },
    resolves: [
      { kind: 'unmatchedReplacement', id: 'unknown:CFArcana' },
      { kind: 'conflict', id: 'stackingGuard#2' },
    ],
  },
  {
    externalKey: 'everythingpath/magus-bladebound-arcane-pool',
    sourceSha256:
      '17bcc367794397ba6d78684c3da66f98f8c6d3ed9520370198beeb573f303b8d',
    fields: { description: text.pool },
    resolves: owned(um, 'Bladebound ~ Arcane Pool'),
  },
  {
    externalKey: 'everythingpath/magus-bladebound-black-blade',
    sourceSha256:
      '98618b9abff79879cfad05be1bc76822d1fc4038e6abe231f0425be8e64b0ce5',
    fields: { description: text.blade },
    resolves: owned(um, 'Bladebound ~ Black Blade'),
  },
  {
    externalKey: dd(),
    sourceSha256:
      'bdeab08829423dde553da097fab30f75284fa25f0a5151fd37b0246430ebdcdd',
    fields: {
      description: text.intro,
      prerequisites: [
        { kind: 'unchecked', unchecked: 'not: race: type Dragon' },
        { kind: 'unchecked', unchecked: 'not: template: Half Dragon' },
        { kind: 'skillRanks', skillRanks: 'skill.kar', min: 5 },
        { kind: 'unchecked', unchecked: 'speaks Draconic' },
        { kind: 'canCast', canCast: { spellLevel: 1, kind: 'arcane' } },
        {
          kind: 'unchecked',
          unchecked:
            'casts those arcane spells without preparing them; with sorcerer levels, has the draconic bloodline',
        },
      ],
    },
    resolves: [
      { kind: 'uncheckedRequirement', id: 'PRELANG:1,Draconic' },
      { kind: 'uncheckedRequirement', id: premult },
      { kind: 'uncheckedRequirement', id: '!PRERACE:1,RACETYPE=Dragon' },
      { kind: 'uncheckedRequirement', id: '!PRETEMPLATE:1,Half Dragon' },
    ],
  },
  {
    externalKey: dd('weapon-and-armor-proficiency'),
    sourceSha256:
      '355b2cb09ee8d221625c4bdf0d393f1bbb62532ecf6e969da9116bda12591e53',
    fields: {},
    resolves: owned(cr, 'Dragon Disciple ~ Weapon and Armor Proficiency'),
  },
  {
    externalKey: dd('spells-per-day'),
    sourceSha256:
      '7d678adeb26a0bd1949d38b87767a3176821a2c942ccb26b3927de7194d36dce',
    fields: {},
    resolves: owned(cr, 'Dragon Disciple ~ Spells per Day'),
  },
  {
    externalKey: dd('blood-of-dragons'),
    sourceSha256:
      '48ff5ade87122c576d28c9a0d6c63a2b0ae522ba1b272bc1b977da6e53c05d40',
    fields: { description: text.blood },
    resolves: owned(cr, 'Dragon Disciple ~ Blood of Dragons'),
  },
  {
    externalKey: dd('natural-armor-increase'),
    sourceSha256:
      '2df931783eba66a859aa2da62a6e43cdadd4021cc6a884ea6655dc417ec90b77',
    fields: {
      description: text.armor,
      modifiers: [
        {
          target: 'ac.natural',
          bonusType: 'untyped',
          value: { formula: `min(3, floor((${level} + 2) / 3))` },
        },
      ],
    },
    resolves: owned(cr, 'Dragon Disciple ~ Natural Armor Increase'),
  },
  {
    externalKey: dd('ability-boost'),
    sourceSha256:
      '22748a80cabb6d256cceb006d79555e14a60a8bfdcb3560d3a8805d68baae83b',
    fields: {
      description: text.boost,
      modifiers: [
        {
          target: 'ability.str',
          bonusType: 'untyped',
          value: { formula: `2 * min(2, floor(${level} / 2))` },
        },
        {
          target: 'ability.con',
          bonusType: 'untyped',
          value: { formula: `2 * min(1, floor(${level} / 6))` },
        },
        {
          target: 'ability.int',
          bonusType: 'untyped',
          value: { formula: `2 * min(1, floor(${level} / 8))` },
        },
      ],
    },
    resolves: owned(cr, 'Dragon Disciple ~ Ability Boost'),
  },
  {
    externalKey: dd('bloodline-feat'),
    sourceSha256:
      '0244eecd5b898b1b015c323184ca37f68da05509cf5678ab4ba1762d83b30f6b',
    fields: { description: text.feat },
    resolves: owned(cr, 'Dragon Disciple ~ Bloodline Feat'),
  },
  {
    externalKey: dd('dragon-bite'),
    sourceSha256:
      '5fa1799b14a9f577fccb91a119660b1fe6522824517fb757ae9b686b33ac9f5b',
    fields: { description: text.bite },
    resolves: owned(cr, 'Dragon Disciple ~ Dragon Bite'),
  },
  {
    externalKey: dd('breath-weapon'),
    sourceSha256:
      'ec3a4dd0b6d4ce62e40355e96b28c49366faf20298a91e70ef02ffccf0208eac',
    fields: { description: text.breath },
    resolves: owned(cr, 'Dragon Disciple ~ Breath Weapon'),
  },
  {
    externalKey: dd('blindsense'),
    sourceSha256:
      '3da991c1fc354763dfe5fc64c4170b3c07d38c8373bc1abdad3c5936ed11d1f8',
    fields: { description: text.blindsense },
    resolves: owned(cr, 'Dragon Disciple ~ Blindsense'),
  },
  {
    externalKey: dd('dragon-form'),
    sourceSha256:
      'e2647c5c53e31ad417e67f830ba8e3c0edb9a4f28622400dc1a16771e0c7ca57',
    fields: { description: text.form },
    resolves: owned(cr, 'Dragon Disciple ~ Dragon Form'),
  },
  {
    externalKey: dd('wings'),
    sourceSha256:
      '83c44572c036706bbc95c16da2c5d9c542bcdf8d8c06e2f7db80a76d4cbf0b8b',
    fields: { description: text.wings },
    resolves: owned(cr, 'Dragon Disciple ~ Wings'),
  },
];
const noMechanics = new Set([
  dd('weapon-and-armor-proficiency'),
  dd('spells-per-day'),
]);
const batchKeys = new Set(expected.map(({ externalKey }) => externalKey));
const byKey = <T extends { externalKey: string }>(a: T, b: T) =>
  a.externalKey < b.externalKey ? -1 : 1;
const committed = (reviewedCuration.structures ?? [])
  .filter((record) => batchKeys.has(record.externalKey))
  .sort(byKey);

/**
 * The committed records, drafted in memory: each becomes a copy without its
 * reviewer, date and receipt, as the batch wrote it. They replace the
 * committed records of their subjects.
 */
const draftedInMemory = committed.map(
  (record): StructureRecord => ({
    externalKey: record.externalKey,
    sourceSha256: record.sourceSha256,
    fields: record.fields,
    ...(record.noMechanics ? { noMechanics: true } : {}),
    resolves: record.resolves,
    rationale: record.rationale,
    status: 'drafted',
  }),
);
const withStructures = (structures: readonly StructureRecord[]) => ({
  ...reviewedCuration,
  structures: [
    ...(reviewedCuration.structures ?? []).filter(
      (record) => !batchKeys.has(record.externalKey),
    ),
    ...structures,
  ],
});

const selection = pcgenOwnerSelection.filter(({ key }) =>
  ['Magus Archetype ~ Bladebound', 'Dragon Disciple'].includes(key),
);
type Artifact = Awaited<ReturnType<typeof importCatalog>>;
const emit = (curation: unknown) =>
  importCatalog({
    systemPath: tree.systemPath,
    contentPath: tree.contentPath,
    remaps,
    curation,
    pcgen: { path: tree.pcgenPath, selection },
  });
const entryOf = (artifact: Artifact, key: string) =>
  artifact.catalog.entries.find((entry) => entry.externalKey === key);
const outcomeOf = (artifact: Artifact, key: string) => {
  const gate = assessCatalogAdmission({ artifact, ...attribution });
  for (const kind of ['admitted', 'held', 'dependentOmissions'] as const) {
    const row = gate[kind].find((item) => item.externalKey === key);
    if (row) return { kind, reason: row.reason };
  }
  const failure = gate.failures.find((item) => item.externalKey === key);
  return failure ? { kind: 'failed', reason: failure.reason } : undefined;
};
const bookOf = (key: string) =>
  key.startsWith('everythingpath/magus-') ? 'PZO1117' : 'PZO1110';
/**
 * A settled row's outcome: each is admitted under #227 on its declared book,
 * Bladebound too, since the Magus's Arcane Pool it replaces is admitted.
 */
const settledOutcome = (key: string) => ({
  kind: 'admitted',
  reason: `Admitted under #227: declared book ${bookOf(key)}.`,
});

const settled = await emit(reviewedCuration);
/** A settled entry's field, or a property of its detail (`detail.<name>`). */
const fieldOf = (key: string, field: string) => {
  const entry = entryOf(settled, key) as Record<string, unknown> | undefined;
  const [name = '', property] = field.split('.');
  return property
    ? (entry?.detail as Record<string, unknown> | undefined)?.[property]
    : entry?.[name];
};

describe('the Bladebound and Dragon Disciple structure records (party-curation-3, #716)', () => {
  it('are committed with exactly the reviewed fields, items and source hashes', () => {
    expect(
      committed.map(({ externalKey, sourceSha256, fields, resolves }) => ({
        externalKey,
        sourceSha256,
        fields,
        resolves,
      })),
    ).toEqual([...expected].sort(byKey));
    for (const record of committed)
      expect(record.noMechanics, record.externalKey).toBe(
        noMechanics.has(record.externalKey) ? true : undefined,
      );
  });

  it('as committed, checked, settle both structure gates and apply, and the rows are admitted under #227 on their declared books, beside the Magus’s Arcane Pool', () => {
    const report = settled.structure;
    if (!report) throw new Error('No structure report');
    const ours = <T extends { externalKey: string }>(items: readonly T[]) =>
      items.filter(({ externalKey }) => batchKeys.has(externalKey));
    expect({
      handReview: ours(report.handReview),
      unreviewedFeatures: ours(report.unreviewedFeatures),
      invalid: ours(report.invalid),
      conflicts: ours(report.conflicts),
      stale: ours(report.stale),
    }).toEqual({
      handReview: [],
      unreviewedFeatures: [],
      invalid: [],
      conflicts: [],
      stale: [],
    });
    expect(report.held.filter((key) => batchKeys.has(key))).toEqual([]);
    expect(
      ours(report.applied)
        .map(({ externalKey }) => externalKey)
        .sort(),
    ).toEqual([...batchKeys].filter((key) => !noMechanics.has(key)).sort());
    for (const { externalKey, fields } of expected)
      for (const [field, value] of Object.entries(fields))
        expect(fieldOf(externalKey, field), `${externalKey} ${field}`).toEqual(
          value,
        );
    for (const key of batchKeys)
      expect(outcomeOf(settled, key), key).toEqual(settledOutcome(key));
    expect(outcomeOf(settled, 'pf1/mpe3JHJMINddqLWr')).toMatchObject({
      kind: 'admitted',
    });
  });

  it('give the natural armor and ability boosts of the table at every Dragon Disciple level', () => {
    const valuesOf = (key: string) =>
      (entryOf(settled, key)?.modifiers ?? []).map(({ target, value }) => [
        target,
        Array.from({ length: 10 }, (_, index) =>
          evaluateFormula(
            parseFormula((value as { formula: string }).formula),
            (name) => {
              if (name !== level) throw new Error(name);
              return index + 1;
            },
          ),
        ),
      ]);
    // dragonDisciple.html:363-372 (natural armor +1 at 1, 4, 7; Str +2 at
    // 2 and 4, Con +2 at 6, Int +2 at 8); at Dragon Disciple 3, +1 and Str +2.
    expect(valuesOf(dd('natural-armor-increase'))).toEqual([
      ['ac.natural', [1, 1, 1, 2, 2, 2, 3, 3, 3, 3]],
    ]);
    expect(valuesOf(dd('ability-boost'))).toEqual([
      ['ability.str', [0, 2, 2, 4, 4, 4, 4, 4, 4, 4]],
      ['ability.con', [0, 0, 0, 0, 0, 2, 2, 2, 2, 2]],
      ['ability.int', [0, 0, 0, 0, 0, 0, 0, 2, 2, 2]],
    ]);
    // The two noMechanics dispositions apply nothing, so these rows keep the
    // mapper's text, which is the PRD's word for word.
    // The two owner questions stay prose: no picks and no stacking mechanic.
    for (const name of ['blood-of-dragons', 'bloodline-feat'])
      expect(entryOf(settled, dd(name))).toMatchObject({
        detail: { kind: 'classFeature' },
        modifiers: [],
      });
    expect(entryOf(settled, dd('bloodline-feat'))?.detail).not.toHaveProperty(
      'picksByLevel',
    );
  });

  it('are checked by the record step, and drafted, hold every row on structure', async () => {
    // The status-dependent case: the record step checked the committed
    // records, so the batch's drafted state is rebuilt in memory.
    expect(
      committed.map((record) =>
        record.status === 'checked' ? record.receipt : record.status,
      ),
    ).toEqual(expected.map(() => RECEIPT));
    const drafted = await emit(withStructures(draftedInMemory));
    for (const key of batchKeys)
      expect(outcomeOf(drafted, key), key).toEqual({
        kind: 'held',
        reason: expect.stringMatching(/^Structure hand review/),
      });
  });
});
