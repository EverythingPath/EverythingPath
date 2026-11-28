// @vitest-environment node
// pbl-class-abilities (PRD #251): the behaviour blocks of the class-ability
// batch tests (class-abilities-604 to -649), on entries imported from the
// pinned store. One import holds the 57 class features, the 24 classes that
// grant them and the 40 entries their bodies link, every key named below.
//
// Each case checks what the importer emits (an entry's Notes, Modifiers,
// unmapped changes, sources, linked closure and schedule increments, and the
// rows each granting class's table gives the feature with their labels), what
// the sheet's formula evaluator, resolver and sheet compute from it, or the
// pinned source text
// the old blocks compared through a batch record. Expected values are
// literals; a body paragraph, PRD line or PCGen row is read from the pinned
// store by its upstream path and line. Nothing here reads a batch record or a
// batch directory, or checks a review, an assessment, a notice or an
// admission. A schedule case checks each granting class's rows against the
// levels where the old block's schedule changes, each increment's label
// against its amount there, and each amount the import emits for the feature
// (the number of its rows, an unmapped Foundry formula, a rule value through
// the sheet) at every level against the old block's values.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import { collectReferences } from '../../scripts/catalog/admission';
import {
  reviewedScheduleSlots,
  scheduleSlotRules,
} from '../../scripts/catalog/pcgen/schedule-slots';
import {
  sourceDescription,
  upstreamRecord,
} from '../../scripts/catalog/records';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  catalogModifierTargets,
  modifierConditionSchema,
  personalBonusTypes,
  resolveSheet,
  type CharacterSheetInput,
  type SheetEntry,
} from '../../src/lib/character-sheet';
import {
  evaluateFormula,
  parseFormula,
} from '../../src/lib/character-sheet-formulas';
import { parseGrantKeyId } from '../../src/lib/character-sheet-grants';
import { pinnedRecordFile, readPinned } from './pinned-sources';
import { importReleasedEntries, type ReleasedEntry } from './released-entries';

/** The granting classes, by the tag the sheet's formulas read. */
const classes = {
  alchemist: 'pf1/JcaqlAawhf14q1lq',
  barbarian: 'pf1/g3pq7xWWdUVYw6ai',
  barbarianUnchained: 'pf1/W3EjUgYLJ1D9qDKw',
  bard: 'pf1/6GjOjO6r3R06fLwE',
  bloodrager: 'pf1/E27lMw9YNOAjS009',
  cavalier: 'pf1/u1ed3H9xtYQXTP5v',
  cleric: 'pf1/SjFqQceVeVBzBwgn',
  druid: 'pf1/7eZQP0MzeO2svmVF',
  fighter: 'pf1/WLqBCT5DqmGAx8Wd',
  inquisitor: 'pf1/Fv3FbmXptuDRiL5y',
  investigator: 'pf1/s27zdYVFenYBVtfu',
  magus: 'pf1/xZLcyrEKYZoJPS2k',
  monk: 'pf1/W8dxwZ1CZiwLKsqr',
  monkUnchained: 'pf1/5mQIOIw4hDhlREPo',
  oracle: 'pf1/5S0u8yFcP861wgd1',
  paladin: 'pf1/ohptcds1d5oG6Bjh',
  ranger: 'pf1/w3wjj6s3N69BsMc3',
  rogue: 'pf1/24b0LaabeAlUx5gN',
  rogueUnchained: 'pf1/5tsZI6zk29yX1ckA',
  slayer: 'pf1/cOY76lMUkupH534m',
  sorcerer: 'pf1/AoWSbnuTSGIxmv61',
  summoner: 'pf1/BrnHPJ2EVSQSyNQ8',
  witch: 'pf1/RC4D4WFT5kRKkdqp',
  wizard: 'pf1/0c4lYDywj6bQ0i8r',
} as const;

/** The class features, by name. */
const features = {
  acBonus: 'pf1/4zVndIJ8NMWWzl1T',
  armorMastery: 'pf1/NwTe1Q2utlsmOAqK',
  armorTraining: 'pf1/5JFfSqLMCpbRmERa',
  armorTrainingHeavy: 'pf1/iqeyCQIIVnNt0p3h',
  bloodlineFeatBloodrager: 'pf1/xxD5AbgfJ5OuzVld',
  bloodlineFeatSorcerer: 'pf1/W1KWAZxUNxfCv8rG',
  bloodlineSpellsBloodrager: 'pf1/RJ66UHdnwJ7VuWFo',
  bloodlineSpellsSorcerer: 'pf1/qlQxKPARGGdOgNWm',
  bloodragerBloodline: 'pf1/Aq9rx7oWgv7A7kiV',
  bomb: 'pf1/7gHiZBNHjwefbBLI',
  bonusFeatCavalier: 'pf1/vfu0FW2XYF7cBUQp',
  bonusFeatMonk: 'pf1/VjHjPja5QABBgRvR',
  bonusFeatsFighter: 'pf1/CV8BsY3ciUb9TA1Y',
  bonusFeatsMagus: 'pf1/gzBR0qkMdu0KkLV0',
  bonusFeatsWizard: 'pf1/2h3lI574tmVjOalQ',
  bravery: 'pf1/h0Brxw6khcjlEf1T',
  challenge: 'pf1/WNi2SBF6Z2zhBMCl',
  channelEnergy: 'pf1/kXXz1lO4i7CibHJ9',
  damageReduction: 'pf1/RENIeTVjWB7Mq6Mw',
  discovery: 'pf1/Xcim6WFtAtxJxnmA',
  fastMovement: 'pf1/CK5L0YJDENqBxLqv',
  favoredEnemy: 'pf1/XmALhWqXdN9yOmtd',
  favoredTerrain: 'pf1/U2YBSx1s8cT8iDq1',
  flurry: 'pf1/JKJoHy5NveXGaZqv',
  flurryUnchained: 'pf1/TaBxJdJQp5SFDPyn',
  hex: 'pf1/GBkIhC1Bpp2MAD4e',
  inspireCompetence: 'pf1/2M56kfIOws5yYtxq',
  inspireCourage: 'pf1/h56K6HEBOItImPPL',
  judgment: 'pf1/qI4IouTn4uvDPSXv',
  kiPool: 'pf1/2Og23i3rRXu5QQlg',
  kiPoolUnchained: 'pf1/7BfYNNkYjjBevun8',
  kiPowers: 'pf1/NsP31IshAuY4gv0s',
  loreMaster: 'pf1/msQWK7TW7mufzf8l',
  magusArcana: 'pf1/HJ2vLLDYkihPxFkD',
  mercy: 'pf1/Er8h3fZ2edJEviTv',
  mystery: 'pf1/ZhQM4K4dqStS6qRn',
  order: 'pf1/c3MSLdplxdRZrSxL',
  poisonResistance: 'pf1/2qcz39w9O2Qlms0Q',
  ragePowers: 'pf1/HdzsFdoGauXFjU2S',
  revelation: 'pf1/adu4NROFqgwv70sw',
  rogueTalents: 'pf1/iBTrvPtn3jczInbn',
  slayerTalents: 'pf1/Zn9ecDCXShBK4vj8',
  slayersAdvance: 'pf1/yotHT522pQoKDhID',
  slowFall: 'pf1/M4bXVPXouXroIt90',
  smiteEvil: 'pf1/2TsDfK0SKC8IGVx4',
  sneakAttack: 'pf1/Wl3FUflcmvQP0PaQ',
  sorcererBloodline: 'pf1/F5mCXQR9VZfKfpTH',
  studiedTarget: 'pf1/JnXrphJlr1ULx1MK',
  styleStrikes: 'pf1/0eJ9MA8iVuOG8VJi',
  summonMonster: 'pf1/caNEmbCtoHA7NYtZ',
  teamworkFeat: 'pf1/717fyDCcfLtD345B',
  trapSense: 'pf1/BoEkMviJrW0PKmhj',
  unarmedStrike: 'pf1/a4SPdPuOFdmfJdHN',
  versatilePerformance: 'pf1/HAqAsb5H56C6cZm3',
  weaponMastery: 'pf1/McXAM1BoPHZLO1n4',
  weaponTraining: 'pf1/RzEzudurxQFirFoF',
  wildShape: 'pf1/sJdBOE9lwz5XAkUi',
} as const;

/** The entries the features' bodies link, by the feature that links them. */
const linked = {
  bonusFeatsWizard: ['pf1/KlE26ofz7uAkd0IJ'],
  bomb: [
    'pf1/26k1Gi7t5BoqxhIj',
    'pf1/8rsFtye3PwM6CKli',
    'pf1/n250dFlbykAIAg5Z',
  ],
  flurry: [
    'pf1/3fNdl7eIUJ5d5fwg',
    'pf1/Ee7JHADKEK37tTHs',
    'pf1/ieltigobtFrlTXIt',
  ],
  // The seventeen feats the body names, and the three their prerequisites
  // link (Improved Unarmed Strike, Combat Expertise and Power Attack).
  bonusFeatMonk: [
    'pf1/2AfSIVge3bg8r6wr',
    'pf1/711B9WNFgpdDKKf2',
    'pf1/ACEQfonKVqh0fwkK',
    'pf1/JreaiTHdyWFNj3Tb',
    'pf1/R7L4SlGRlnThqFrP',
    'pf1/TbOPtIL8Fv8obXtP',
    'pf1/ZmQkRk93nbHxsQSt',
    'pf1/bHcqTC4Lf3aVl3VO',
    'pf1/bZ1YdzkT8NtRIEJ4',
    'pf1/dn2KgHFQRbuoNRx0',
    'pf1/gGfXQq0IZrxdcZDx',
    'pf1/gTrGPxzN054GfpkM',
    'pf1/h9nHYLxXvIXBTmup',
    'pf1/nhUawPP4jfED3CYV',
    'pf1/sOCyCmNxe2MBbEaI',
    'pf1/tocde3sKG1O3GKgd',
    'pf1/ugQyUpqPBDsqLyra',
    'pf1/2aTFNMs3pW6nUBlr',
    'pf1/NFxHebU1XhEs5WJh',
    'pf1/FUW5mIXHNBBIQ1Sq',
  ],
  unarmedStrike: ['pf1/2aTFNMs3pW6nUBlr'],
  summonMonster: [
    'pf1/kyo0kwhw2jhuztju',
    'pf1/mi52crelhwuy6bmp',
    'pf1/ursm11405zobemi3',
  ],
  wildShape: [
    'pf1/774kmgcb7ygviht0',
    'pf1/hd32fuc6e7j4isbn',
    'pf1/ik4riccm7tozdwox',
    'pf1/pawbnw1nm4f0b98e',
    'pf1/sheso071mxbywlah',
    'pf1/tjdfluulncmqacc3',
    'pf1/v42t5kpxc8mvd615',
    'pf1/w88ddxpu89qcr5c0',
    'pf1/y653mq8kmma3kg3w',
    'pf1/yldjnorgbx4jsldz',
  ],
} as const satisfies Partial<Record<keyof typeof features, readonly string[]>>;

const released = await importReleasedEntries([
  ...Object.values(features),
  ...Object.values(classes),
  ...Object.values(linked).flat(),
]);
const { entries } = released;

/** The entry the import emits for a key; throws if it emits none. */
function entryOf(key: string): ReleasedEntry {
  const entry = entries.get(key);
  if (!entry) throw new Error(`The import emits no entry for ${key}.`);
  return entry;
}

/** The schedule increments that take a feature's attribution, in the order the import emits them. */
const incrementsOf = (key: string) =>
  [...entries.values()].filter((entry) => entry.attributionFrom === key);

/**
 * The rows a class's `featuresByLevel` gives a feature, in its order: its
 * acquisition, and each increment whose parent it is, with the row's level
 * and its entry's name.
 */
function classRows(classKey: string, feature: string) {
  const { detail } = entryOf(classKey);
  if (detail.kind !== 'class') throw new Error(`${classKey} is no class.`);
  return (detail.featuresByLevel ?? []).flatMap(
    ({ classLevel, externalKey }) => {
      const row = entries.get(externalKey);
      return externalKey === feature ||
        (row?.detail.kind === 'classFeature' &&
          row.detail.parentFeature === feature)
        ? [
            {
              level: Number(classLevel),
              name: row?.name,
              slots: (row?.grantsSlots ?? []).reduce(
                (total, slot) => total + slot.count,
                0,
              ),
            },
          ]
        : [];
    },
  );
}

/**
 * The names of the entries a feature reaches through its references, its
 * links' own references included; a key the import lacks reads as missing.
 */
function closureNames(key: string) {
  const reached = new Set<string>();
  const pending = [key];
  for (let at = pending.pop(); at !== undefined; at = pending.pop()) {
    const entry = entries.get(at);
    if (!entry) continue;
    for (const reference of collectReferences(entry))
      if (reference !== key && !reached.has(reference)) {
        reached.add(reference);
        pending.push(reference);
      }
  }
  return [...reached]
    .map((reference) => entries.get(reference)?.name ?? `missing ${reference}`)
    .sort();
}

const sha = (text: string) => createHash('sha256').update(text).digest('hex');

/** A feature's pinned record: its fields and its description. */
async function pinnedRecord(key: string) {
  const file = await pinnedRecordFile(key);
  const record = upstreamRecord.parse(
    parse(await readPinned('pf1', file.slice('pf1/'.length))),
  );
  return { record, description: sourceDescription(record) };
}

/** A line of a pinned PRD page or PCGen file, by its 1-based number. */
async function pinnedLine(repo: 'prd' | 'pcgen', path: string, line: number) {
  return (await readPinned(repo, path)).split('\n')[line - 1] ?? '';
}

/**
 * A feature's reviewed curation records for its pinned texts: the
 * description's, then one per Foundry contextNote in the record's order, each
 * found by its target and its text's hash.
 */
async function curatedRecords(key: string) {
  const { record, description } = await pinnedRecord(key);
  const find = (kind: string, target: string, text: string) => {
    const found = reviewedCuration.records.find(
      (row) =>
        row.externalKey === key &&
        row.kind === kind &&
        row.target === target &&
        row.textSha256 === sha(text),
    );
    if (!found) throw new Error(`${key} has no ${kind} record for ${target}.`);
    return found;
  };
  const contextNotes = z
    .array(z.object({ target: z.string(), text: z.string() }))
    .parse(record.system.contextNotes ?? []);
  return {
    description: find('description', 'description', description),
    notes: contextNotes.map(({ target, text }) => find('note', target, text)),
  };
}

/** A feature's Modifiers as its note records, then its description record, give them. */
async function curatedModifiers(key: string) {
  const { description, notes } = await curatedRecords(key);
  return [...notes, description]
    .flatMap((row) => row.outputs)
    .map(({ kind: _kind, ...modifier }) => modifier);
}

/** 1st to 20th. */
const LEVELS = Array.from({ length: 20 }, (_, index) => index + 1);

type Schedule = readonly (number | boolean)[];

/** The levels at which a schedule's value differs from the level before (none before 1st). */
const changeLevels = (values: Schedule) =>
  LEVELS.filter(
    (level) => Number(values[level - 1]) !== Number(values[level - 2] ?? 0),
  );

/**
 * A formula at the given class levels, through the sheet's own parser and
 * evaluator; an absent class reads 0, and an ability modifier 0.
 */
function formulaAt(formula: string, classLevels: Record<string, number>) {
  return evaluateFormula(parseFormula(formula), (name) => {
    // Every ability score 10: each modifier 0 (AC Bonus's Wisdom).
    if (/^@ability\.\w+\.mod$/.test(name)) return 0;
    if (!name.startsWith('@classLevel.'))
      throw new Error(`${name} is not a class level`);
    return classLevels[name.slice('@classLevel.'.length)] ?? 0;
  });
}

/** The rules text of a pinned body's paragraphs, as the reviewed Notes state it. */
function bodyParagraphs(description: string) {
  return [...description.matchAll(/<p>(.*?)<\/p>/gs)].map(([, text]) =>
    (text ?? '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

/**
 * The rules text of a pinned body's paragraphs, tables apart, tolerating
 * Foundry's unclosed `<p>`, as the reviewed Notes state it.
 */
function ruleParagraphs(description: string) {
  return description
    .replace(/<table>.*?<\/table>/gs, '<p>')
    .split(/<\/?p>/)
    .map((text) =>
      text
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean);
}

/** The PRD line's rules text without its heading and markup. */
function prdText(line: string) {
  return line
    .replace(/<[^>]+>/g, '')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&times;/g, '×')
    .replace(/\s+/g, ' ')
    .replace(/^[A-Za-z ()]+ \(Ex\): /, '')
    .trim();
}

const FIGHTER_PRD = 'pages/coreRulebook/classes/fighter.html';
const CRB_CLASS_ABILITIES =
  'data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_abilities_class.lst';

type Modifier = {
  target: string;
  bonusType: string;
  value: { formula: string };
  condition: Record<string, unknown>;
};

const POISON_FORMULA =
  'min(6, floor((max(@classLevel.alchemist, @classLevel.investigator) + 1) / 3) * 2)';
const POISON_MODIFIERS: readonly Modifier[] = [
  {
    target: 'saves',
    bonusType: 'untyped',
    value: { formula: POISON_FORMULA },
    condition: { situation: 'poison' },
  },
];
const POISON_VALUES = LEVELS.map((level) =>
  level < 2 ? 0 : Math.min(6, Math.floor((level + 1) / 3) * 2),
);

const TRAP_FORMULA =
  'floor(@classLevel.barbarian / 3) + floor(@classLevel.rogue / 3) + floor(@classLevel.investigator / 3)';
const TRAP_SITUATION = { local: 'vs. traps' };
const TRAP_MODIFIERS: readonly Modifier[] = [
  {
    target: 'save.ref',
    bonusType: 'untyped',
    value: { formula: TRAP_FORMULA },
    condition: { situation: TRAP_SITUATION },
  },
  {
    target: 'ac',
    bonusType: 'dodge',
    value: { formula: TRAP_FORMULA },
    condition: { situation: TRAP_SITUATION },
  },
];
const TRAP_VALUES = LEVELS.map((level) => Math.floor(level / 3));

const STUDIED_FORMULA = 'floor(@classLevel.slayer / 5) + 1';
const STUDIED_SITUATION = { local: 'against studied target' };
const STUDIED_TARGETS = [
  'skill.blf',
  'skill.kar',
  'skill.kdu',
  'skill.ken',
  'skill.kge',
  'skill.khi',
  'skill.klo',
  'skill.kna',
  'skill.kno',
  'skill.kpl',
  'skill.kre',
  'skill.per',
  'skill.sur',
  'attack.melee',
  'damage.melee',
  'attack.ranged',
  'damage.ranged',
  'skill.sen',
];
const STUDIED_MODIFIERS: readonly Modifier[] = STUDIED_TARGETS.map(
  (target) => ({
    target,
    bonusType: 'untyped',
    value: { formula: STUDIED_FORMULA },
    condition: { situation: STUDIED_SITUATION },
  }),
);
const STUDIED_VALUES = LEVELS.map((level) => 1 + Math.floor(level / 5));

const AC_BONUS_NOTE =
  'He loses these bonuses when he is immobilized or helpless, when he wears any armor, when he carries a shield, or when he carries a medium or heavy load. The sheet removes them by itself while an armor or shield item is active, or while he is Helpless, Paralyzed, Unconscious, Petrified or Pinned. It does not track load: switch this row off while he carries a medium or heavy load, or is immobilized some other way.';
const AC_BONUS_FORMULA =
  'max(0, @ability.wis.mod) + floor(max(@classLevel.monk, @classLevel.monkUnchained) / 4)';

const AC_BONUS_MODIFIERS: readonly Modifier[] = (['ac', 'cmd'] as const).map(
  (target) => ({
    target,
    bonusType: 'untyped',
    value: { formula: AC_BONUS_FORMULA },
    condition: { unarmored: true },
  }),
);
const AC_BONUS_VALUES = LEVELS.map((level) => Math.floor(level / 4));

const BRAVERY_VALUES = LEVELS.map((level) =>
  level < 2 ? 0 : Math.floor((level + 2) / 4),
);
const BONUS_FEATS_VALUES = LEVELS.map((level) => 1 + Math.floor(level / 2));

/** The old block a case ports: its file's batch number and the line of its `it`. */
type Old = `${number}:${number}`;
type Source = { book: string; pages: string };

/**
 * An increment parent's emitted facts: its Notes' texts, Modifiers, Foundry
 * changes left unmapped, sources, and the names of the entries it links.
 */
type FactsCase = {
  old: Old;
  feature: keyof typeof features;
  notes: readonly string[];
  modifiers: readonly Modifier[];
  unmapped: readonly string[];
  sources: readonly Source[];
  closure: readonly string[];
};

const crb = (pages: string): Source => ({ book: 'PZO1110', pages });
const apg = (pages: string): Source => ({ book: 'PZO1115', pages });
const acg = (pages: string): Source => ({ book: 'PZO1129', pages });
const unchained = (pages: string): Source => ({ book: 'PZO1131', pages });

/** A fact row with no Note, Modifier, unmapped change or link. */
const plain = (
  old: Old,
  feature: keyof typeof features,
  sources: readonly Source[],
): FactsCase => ({
  old,
  feature,
  notes: [],
  modifiers: [],
  unmapped: [],
  sources,
  closure: [],
});
/** A fact row whose one Foundry change, its bonus feats, stays unmapped. */
const bonusFeats = (
  old: Old,
  feature: keyof typeof features,
  sources: readonly Source[],
): FactsCase => ({ ...plain(old, feature, sources), unmapped: ['bonusFeats'] });

const factsCases: readonly FactsCase[] = [
  plain('604:23', 'styleStrikes', []),
  plain('605:40', 'smiteEvil', []),
  plain('605:49', 'inspireCompetence', [crb('37')]),
  plain('605:56', 'kiPool', [crb('59')]),
  {
    ...bonusFeats('605:76', 'bonusFeatsWizard', [crb('79')]),
    closure: ['Spell Mastery'],
  },
  {
    ...plain('606:30', 'poisonResistance', [apg('31'), acg('31')]),
    modifiers: POISON_MODIFIERS,
  },
  {
    ...plain('607:36', 'acBonus', [crb('57'), unchained('14')]),
    notes: [AC_BONUS_NOTE],
    modifiers: AC_BONUS_MODIFIERS,
  },
  bonusFeats('609:29', 'teamworkFeat', []),
  plain('609:41', 'kiPoolUnchained', [unchained('15')]),
  {
    ...plain('610:24', 'bomb', [apg('28')]),
    closure: ['Point-Blank Shot', 'Vital Strike', 'Weapon Focus'],
  },
  plain('612:21', 'bloodragerBloodline', [acg('15')]),
  {
    ...plain('613:133', 'fastMovement', [crb('59'), unchained('15')]),
    unmapped: ['landSpeed'],
  },
  {
    ...plain('613:165', 'trapSense', [crb('31, 69')]),
    modifiers: TRAP_MODIFIERS,
  },
  plain('615:35', 'sorcererBloodline', [crb('71-77')]),
  plain('615:44', 'mercy', []),
  plain('616:22', 'hex', []),
  plain('617:37', 'ragePowers', [crb('32')]),
  plain('617:53', 'magusArcana', []),
  plain('617:61', 'versatilePerformance', [crb('38')]),
  {
    ...plain('618:23', 'flurry', [crb('57-58')]),
    closure: [
      'Greater Two-Weapon Fighting',
      'Improved Two-Weapon Fighting',
      'Two-Weapon Fighting',
    ],
  },
  {
    ...plain('619:51', 'studiedTarget', [acg('53')]),
    modifiers: STUDIED_MODIFIERS,
  },
  plain('620:20', 'slowFall', [crb('59')]),
  plain('622:54', 'kiPowers', [unchained('16')]),
  plain('624:34', 'damageReduction', [crb('34'), acg('16')]),
  plain('624:42', 'bloodlineSpellsBloodrager', [acg('15')]),
  plain('626:32', 'favoredTerrain', [crb('65')]),
  plain('626:39', 'flurryUnchained', [unchained('14')]),
  plain('628:50', 'challenge', []),
  plain('628:59', 'sneakAttack', [acg('54')]),
  bonusFeats('628:67', 'bloodlineFeatSorcerer', [crb('71')]),
  {
    ...bonusFeats('628:81', 'bonusFeatMonk', [crb('58'), unchained('14')]),
    closure: [
      'Catch Off-Guard',
      'Combat Expertise',
      'Combat Reflexes',
      'Deflect Arrows',
      'Dodge',
      "Gorgon's Fist",
      'Improved Bull Rush',
      'Improved Critical',
      'Improved Disarm',
      'Improved Feint',
      'Improved Grapple',
      'Improved Trip',
      'Improved Unarmed Strike',
      "Medusa's Wrath",
      'Mobility',
      'Power Attack',
      'Scorpion Style',
      'Snatch Arrows',
      'Spring Attack',
      'Throw Anything',
    ],
  },
  plain('629:29', 'discovery', [apg('28')]),
  plain('629:36', 'favoredEnemy', [crb('64')]),
  plain('631:31', 'mystery', []),
  plain('631:39', 'slayerTalents', [acg('53')]),
  {
    ...bonusFeats('631:56', 'unarmedStrike', [crb('58-59'), unchained('14')]),
    closure: ['Improved Unarmed Strike'],
  },
  plain('632:29', 'revelation', []),
  plain('632:41', 'order', []),
  {
    ...plain('633:24', 'summonMonster', [apg('54')]),
    closure: ['Gate', 'Summon Monster I', 'Summon Monster IX'],
  },
  plain('636:142', 'inspireCourage', [crb('37')]),
  bonusFeats('636:149', 'bonusFeatsMagus', []),
  plain('637:55', 'rogueTalents', [crb('68-69')]),
  plain('639:22', 'channelEnergy', [crb('40')]),
  plain('640:23', 'loreMaster', [crb('38')]),
  plain('643:29', 'bloodlineSpellsSorcerer', [crb('71')]),
  plain('643:40', 'judgment', []),
  {
    ...plain('644:23', 'wildShape', [crb('51')]),
    closure: [
      'Beast Shape I',
      'Beast Shape II',
      'Beast Shape III',
      'Elemental Body I',
      'Elemental Body II',
      'Elemental Body III',
      'Elemental Body IV',
      'Plant Shape I',
      'Plant Shape II',
      'Plant Shape III',
    ],
  },
  bonusFeats('647:23', 'bonusFeatCavalier', []),
  bonusFeats('649:29', 'bloodlineFeatBloodrager', [acg('15')]),
  plain('649:44', 'slayersAdvance', [acg('55')]),
];

describe('the increment parents as the import emits them', () => {
  for (const {
    old,
    feature,
    notes,
    modifiers,
    unmapped,
    sources,
    closure,
  } of factsCases)
    it(`${feature} has exactly its listed Notes, Modifiers, unmapped changes, sources and linked closure (${old})`, () => {
      const entry = entryOf(features[feature]);
      expect(entry.situationalNotes?.map((note) => note.text) ?? []).toEqual(
        notes,
      );
      expect(entry.modifiers).toEqual(modifiers);
      expect(
        entry.unsupported
          .filter((row) => row.field === 'changes')
          .map((row) => (row.value as { target: string }).target),
      ).toEqual(unmapped);
      expect(entry.sources).toEqual(sources);
      expect(closureNames(features[feature])).toEqual(closure);
    });
});

type Tag = keyof typeof classes;
type Value = number | boolean;

/** The Unchained classes' increment labels end in "(UC)". */
const uc = (tag: Tag) =>
  tag === 'monkUnchained' ||
  tag === 'rogueUnchained' ||
  tag === 'barbarianUnchained'
    ? ' (UC)'
    : '';

/** 1st, 2nd, 3rd, 4th ... 20th, as the PRD class tables print levels. */
function ordinal(level: number) {
  const suffix =
    level % 100 >= 11 && level % 100 <= 13
      ? 'th'
      : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[level % 10];
  return `${level}${suffix ?? 'th'}`;
}

/** Ki Pool's strike steps, by their count (PRD monk.html:441). */
const KI_STRIKES: Record<number, string> = {
  2: 'cold iron/silver',
  3: 'lawful',
  4: 'adamantine',
};
/** Flurry of Blows' attacks, by their count (PRD monk.html:386). */
const FLURRY_FEATS: Record<number, string> = {
  2: 'Improved Two-Weapon Fighting',
  3: 'Greater Two-Weapon Fighting',
};
/** A Medium monk's unarmed damage, by its step (PRD monk.html table). */
const UNARMED_DAMAGE: Record<number, string> = {
  2: '1d8',
  3: '1d10',
  4: '2d6',
  5: '2d8',
  6: '2d10',
};
/** Summon Monster's spell, by its level (the summoner table). */
const SUMMONS: Record<number, string> = {
  2: 'Summon Monster II',
  3: 'Summon Monster III',
  4: 'Summon Monster IV',
  5: 'Summon Monster V',
  6: 'Summon Monster VI',
  7: 'Summon Monster VII',
  8: 'Summon Monster VIII',
  9: 'Summon Monster IX',
  10: 'Gate',
};
/** A feature with no increments has no label to give. */
const noIncrements = (): string => {
  throw new Error('This feature has no increments.');
};

/** A retained formula at every level, or its text where the evaluator does not parse it. */
type RetainedReading =
  | { values: readonly (number | string)[] }
  | { text: string };

/**
 * A formula a feature's unmapped Foundry data retains, by where it is: an
 * unmapped change's (`changes:<target>`) or one in its retained game content
 * (`gameContent:<path>`).
 */
function retainedFormula(feature: string, at: string) {
  const [where, path = ''] = at.split(':');
  const { unsupported } = entryOf(feature);
  const value =
    where === 'changes'
      ? changeFormula(unsupported, path)
      : contentAt(
          onlyRow(unsupported, (item) => item.field === 'gameContent')?.value,
          path,
        );
  if (typeof value !== 'string')
    throw new Error(`${feature} retains no formula at ${at}.`);
  return value;
}
/**
 * The one unsupported row a predicate picks; two such rows are refused, so a
 * formula is always read from the row the other assertions name.
 */
function onlyRow(
  unsupported: ReleasedEntry['unsupported'],
  picks: (item: ReleasedEntry['unsupported'][number]) => boolean,
) {
  const rows = unsupported.filter(picks);
  if (rows.length > 1)
    throw new Error(`${rows.length} unsupported rows match where one is read.`);
  return rows[0];
}
/** An unmapped change's formula, by its target (its one row). */
const changeFormula = (
  unsupported: ReleasedEntry['unsupported'],
  target: string,
) =>
  (
    onlyRow(
      unsupported,
      (item) =>
        item.field === 'changes' &&
        (item.value as { target?: string }).target === target,
    )?.value as { formula?: string } | undefined
  )?.formula;
/** A value inside retained game content, by its path (`actions[0].uses`). */
function contentAt(content: unknown, path: string) {
  let value = content;
  for (const step of path.match(/[^.[\]]+/g) ?? [])
    value = (value as Record<string, unknown> | undefined)?.[step];
  return value;
}

/**
 * The level variables a retained formula may read: the class level, and
 * total Hit Dice, which equal it for a Character of one class.
 */
type LevelVariable = '@class.level' | '@attributes.hd.total';

/**
 * The one reading of every retained formula: its value at each level from
 * 1st to 20th through the sheet's own parser and evaluator, the one variable
 * its row names (`reads`) resolving to the level and any other variable
 * refused, so a formula that reads another than its row says fails; a dice formula as its
 * count, so read, and its die. The sheet has no `clamp`, so
 * `clamp(x, low, high)` (Armor Training's, with no comma inside `x`) reads as
 * `min(max(x, low), high)`. A formula the parser refuses reads as its text.
 */
function retainedReading(
  formula: string,
  reads: LevelVariable,
): RetainedReading {
  const dice = /^(.*)d(\d+)$/.exec(formula);
  const expression = (dice?.[1] ?? formula).replace(
    /clamp\((.*), (-?\d+), (-?\d+)\)/,
    'min(max($1, $2), $3)',
  );
  let parsed: ReturnType<typeof parseFormula>;
  try {
    parsed = parseFormula(expression);
  } catch {
    return { text: formula };
  }
  return {
    values: LEVELS.map((level) => {
      const value = evaluateFormula(parsed, (name) => {
        if (name !== reads)
          throw new Error(`${name} is not ${reads}, the level it is read for`);
        return level;
      });
      return dice ? `${value}d${dice[2]}` : value;
    }),
  };
}

const sheetCatalog = released.sheetCatalog();
const sheets = new Map<string, ReturnType<typeof calculateCharacterSheet>>();
/**
 * The sheet of a Character with every ability score 10 and `level` levels of
 * one class, nothing else (as rule-value-sheets.ts builds one).
 */
function sheetAt(classKey: string, level: number) {
  const id = `${classKey}@${level}`;
  const cached = sheets.get(id);
  if (cached) return cached;
  const input: CharacterSheetInput = {
    characterKind: 'pc',
    entries: [
      {
        _id: 'base-row',
        kind: 'base',
        active: true,
        catalogEntryId: 'base',
        state: { kind: 'base' },
      },
      ...Array.from(
        { length: level },
        (_, index): SheetEntry => ({
          _id: `level-${index + 1}`,
          kind: 'classLevel',
          active: true,
          state: {
            kind: 'classLevel',
            classEntryId: classKey,
            position: index + 1,
            hpGained: 5,
          },
        }),
      ),
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base' as const,
          value: 10,
        })),
      },
      ...sheetCatalog,
    ],
  };
  const sheet = calculateCharacterSheet(input);
  sheets.set(id, sheet);
  return sheet;
}

/** The Catalog Entry a sheet entry (a Grant or a row) is. */
const catalogKeyOf = (
  sheet: ReturnType<typeof calculateCharacterSheet>,
  entryId: string,
) =>
  parseGrantKeyId(entryId)?.entry ??
  sheet.resolvedEntries
    .map(({ entry }) =>
      entry._id === entryId && 'catalogEntryId' in entry
        ? entry.catalogEntryId
        : undefined,
    )
    .find((key) => key !== undefined);

/**
 * An amount the import emits for a feature, checked at every level against
 * the old block's values:
 * - `rows`: the number of the class's rows for it so far, its steady rows
 *   aside;
 * - `slots`: the feat slots its rows grant so far;
 * - `dice`, `damageReduction`, `dailyMaximum`: a rule value as the sheet of a
 *   Character of that class reads it (none while the value is 0).
 *
 * Its retained Foundry formulas are checked apart, each alone at every level
 * (`retainedCases`).
 */
type AmountFields = { die: number; bypass: string; key: string };
type AmountOf<Kind extends string, Field extends keyof AmountFields = never> = {
  kind: Kind;
} & Pick<AmountFields, Field> &
  Partial<Record<Exclude<keyof AmountFields, Field>, never>>;
type Amount =
  | AmountOf<'rows'>
  | AmountOf<'slots'>
  | AmountOf<'dice', 'die'>
  | AmountOf<'damageReduction', 'bypass'>
  | AmountOf<'dailyMaximum', 'key'>;

const ROWS: Amount = { kind: 'rows' };
const SLOTS: Amount = { kind: 'slots' };

type AmountContext = {
  tag: Tag;
  feature: string;
  rows: ReturnType<typeof classRows>;
  numbers: readonly number[];
  steady: readonly number[];
};
type Amounts = { emitted: unknown[]; expected: unknown[] };

/** Each per-level reading of a rule value on the sheet, none while the value is 0. */
const sheetReadings = (
  { tag, numbers }: AmountContext,
  read: (sheet: ReturnType<typeof calculateCharacterSheet>) => unknown[],
  render: (value: number) => unknown,
): Amounts => ({
  emitted: LEVELS.map((level) => read(sheetAt(classes[tag], level))),
  expected: numbers.map((value) => (value === 0 ? [] : [render(value)])),
});

const amountReaders: {
  [Kind in Amount['kind']]: (
    amount: Extract<Amount, { kind: Kind }>,
    context: AmountContext,
  ) => Amounts;
} = {
  rows: (_amount, { rows, numbers, steady }) => ({
    emitted: LEVELS.map(
      (level) =>
        rows.filter((row) => row.level <= level && !steady.includes(row.level))
          .length,
    ),
    expected: [...numbers],
  }),
  slots: (_amount, { rows, numbers }) => ({
    emitted: LEVELS.map((level) =>
      rows
        .filter((row) => row.level <= level)
        .reduce((total, row) => total + row.slots, 0),
    ),
    expected: [...numbers],
  }),
  dice: (amount, context) =>
    sheetReadings(
      context,
      (sheet) =>
        sheet.featureNumbers
          .filter((row) => catalogKeyOf(sheet, row.entryId) === context.feature)
          .map((row) => `${row.count}d${row.die}`),
      (value) => `${value}d${amount.die}`,
    ),
  damageReduction: (amount, context) =>
    sheetReadings(
      context,
      (sheet) =>
        sheet.damageReduction.values
          .filter(
            (row) => parseGrantKeyId(row.entryId)?.entry === context.feature,
          )
          .map((row) => `${row.value}/${row.bypass}`),
      (value) => `${value}/${amount.bypass}`,
    ),
  dailyMaximum: (amount, context) =>
    sheetReadings(
      context,
      (sheet) =>
        sheet.dailyMaxima
          .filter((row) => row.key === amount.key)
          .map((row) => row.value),
      (value) => value,
    ),
};

/** An amount at every level, as the import gives it, and as the old values give it. */
function amountsOf(
  amount: Amount,
  {
    tag,
    feature,
    values,
    steady,
  }: {
    tag: Tag;
    feature: string;
    values: Schedule;
    steady: readonly number[];
  },
): Amounts {
  const context: AmountContext = {
    tag,
    feature,
    rows: classRows(classes[tag], feature),
    numbers: values.map(Number),
    steady,
  };
  return (
    amountReaders[amount.kind] as (
      amount: Amount,
      context: AmountContext,
    ) => Amounts
  )(amount, context);
}

/**
 * A feature's schedule: the old block's values from 1st to 20th, the
 * classes whose tables give it rows, the levels where it gains a row while its
 * value holds (an acquisition at value 0, or a row the values don't count),
 * how many increments it takes, their labels and its emitted amounts.
 */
type ScheduleCase = {
  old: Old;
  feature: keyof typeof features;
  classes: readonly [Tag, ...Tag[]];
  values: Schedule;
  steady: readonly number[];
  increments: number;
  /** An increment's label, from the old block's value at its level. */
  label: (value: Value, level: number, tag: Tag) => string;
  /** The amounts the import emits for it (none where only its labels carry one). */
  amounts: readonly Amount[];
};

const scheduleCases: readonly ScheduleCase[] = [
  {
    old: '604:23',
    feature: 'styleStrikes',
    label: (_value, level, tag) =>
      `Style Strike${level === 15 ? ' (2/round)' : ''}${uc(tag)}`,
    amounts: [ROWS],
    classes: ['monkUnchained'],
    values: LEVELS.map(
      (level) => [5, 9, 13, 17].filter((step) => level >= step).length,
    ),
    // Style Strike (2/round) (UC): the second strike a round.
    steady: [15],
    increments: 4,
  },
  {
    old: '605:40',
    feature: 'smiteEvil',
    label: (value) => `Smite Evil ${value}/day`,
    amounts: [ROWS],
    classes: ['paladin'],
    values: LEVELS.map((level) => 1 + Math.floor((level - 1) / 3)),
    steady: [],
    increments: 6,
  },
  {
    old: '605:49',
    feature: 'inspireCompetence',
    label: (value) => `Inspire Competence +${value}`,
    amounts: [],
    classes: ['bard'],
    values: LEVELS.map((level) =>
      level < 3 ? 0 : 2 + Math.floor((level - 3) / 4),
    ),
    steady: [],
    increments: 4,
  },
  {
    old: '605:56',
    feature: 'kiPool',
    label: (value) => `Ki Pool (${KI_STRIKES[Number(value)]})`,
    amounts: [ROWS],
    classes: ['monk'],
    values: LEVELS.map((level) =>
      level < 4 ? 0 : [4, 7, 10, 16].filter((step) => level >= step).length,
    ),
    steady: [],
    increments: 3,
  },
  {
    old: '605:76',
    feature: 'bonusFeatsWizard',
    label: () => 'Bonus Feat',
    amounts: [ROWS],
    classes: ['wizard'],
    values: LEVELS.map((level) => Math.floor(level / 5)),
    steady: [],
    increments: 3,
  },
  {
    old: '606:30',
    feature: 'poisonResistance',
    label: (value) => `Poison Resistance +${value}`,
    amounts: [],
    classes: ['alchemist', 'investigator'],
    values: POISON_VALUES,
    steady: [],
    increments: 4,
  },
  {
    old: '607:36',
    feature: 'acBonus',
    label: (value, _level, tag) => `AC Bonus +${value}${uc(tag)}`,
    amounts: [ROWS],
    classes: ['monk', 'monkUnchained'],
    values: AC_BONUS_VALUES,
    // Acquired at 1st, with the Wisdom bonus and no level bonus yet.
    steady: [1],
    increments: 10,
  },
  {
    old: '608:43',
    feature: 'armorTraining',
    label: (value) => `Armor Training ${value}`,
    amounts: [ROWS],
    classes: ['fighter'],
    values: [0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4],
    steady: [],
    increments: 3,
  },
  {
    old: '609:29',
    feature: 'teamworkFeat',
    label: () => 'Teamwork Feat',
    amounts: [ROWS, SLOTS],
    classes: ['inquisitor'],
    values: LEVELS.map((level) => Math.floor(level / 3)),
    steady: [],
    increments: 5,
  },
  {
    old: '609:41',
    feature: 'kiPoolUnchained',
    label: (value, _level, tag) =>
      `Ki Strike (${KI_STRIKES[Number(value)]})${uc(tag)}`,
    amounts: [ROWS],
    classes: ['monkUnchained'],
    values: LEVELS.map((level) =>
      level < 3 ? 0 : [3, 7, 10, 16].filter((step) => level >= step).length,
    ),
    steady: [],
    increments: 3,
  },
  {
    old: '610:24',
    feature: 'bomb',
    label: (value) => `Bomb ${value}d6`,
    amounts: [ROWS],
    classes: ['alchemist'],
    values: LEVELS.map((level) => Math.ceil(level / 2)),
    steady: [],
    increments: 9,
  },
  {
    old: '612:21',
    feature: 'bloodragerBloodline',
    label: () => 'Bloodline Power',
    amounts: [ROWS],
    classes: ['bloodrager'],
    values: LEVELS.map((level) => 1 + Math.floor(level / 4)),
    steady: [],
    increments: 5,
  },
  {
    old: '613:62',
    feature: 'bonusFeatsFighter',
    label: () => 'Bonus Feat',
    amounts: [ROWS, SLOTS],
    classes: ['fighter'],
    values: BONUS_FEATS_VALUES,
    steady: [],
    increments: 10,
  },
  {
    old: '613:133',
    feature: 'fastMovement',
    label: (value, _level, tag) => `Fast Movement +${value} ft.${uc(tag)}`,
    amounts: [],
    classes: ['monk', 'monkUnchained'],
    values: LEVELS.map((level) => 10 * Math.floor(level / 3)),
    steady: [],
    increments: 10,
  },
  {
    old: '613:165',
    feature: 'trapSense',
    label: (value) => `Trap Sense +${value}`,
    amounts: [ROWS],
    classes: ['barbarian', 'rogue', 'investigator'],
    values: TRAP_VALUES,
    steady: [],
    increments: 15,
  },
  {
    old: '615:35',
    feature: 'sorcererBloodline',
    label: () => 'Bloodline Power',
    amounts: [ROWS],
    classes: ['sorcerer'],
    values: LEVELS.map(
      (level) => [1, 3, 9, 15, 20].filter((step) => level >= step).length,
    ),
    steady: [],
    increments: 4,
  },
  {
    old: '615:44',
    feature: 'mercy',
    label: () => 'Mercy',
    amounts: [ROWS],
    classes: ['paladin'],
    values: LEVELS.map((level) => Math.min(Math.floor(level / 3), 6)),
    steady: [],
    increments: 5,
  },
  {
    old: '616:22',
    feature: 'hex',
    label: () => 'Hex',
    amounts: [ROWS],
    classes: ['witch'],
    values: LEVELS.map((level) => 1 + Math.floor(level / 2)),
    steady: [],
    increments: 10,
  },
  {
    old: '617:37',
    feature: 'ragePowers',
    label: () => 'Rage Power',
    amounts: [ROWS],
    classes: ['barbarian'],
    values: LEVELS.map((level) => Math.floor(level / 2)),
    steady: [],
    increments: 9,
  },
  {
    old: '617:53',
    feature: 'magusArcana',
    label: () => 'Magus Arcana',
    amounts: [ROWS],
    classes: ['magus'],
    values: LEVELS.map((level) => Math.floor(level / 3)),
    steady: [],
    increments: 5,
  },
  {
    old: '617:61',
    feature: 'versatilePerformance',
    label: () => 'Versatile Performance',
    amounts: [ROWS],
    classes: ['bard'],
    values: LEVELS.map((level) =>
      level < 2 ? 0 : 1 + Math.floor((level - 2) / 4),
    ),
    steady: [],
    increments: 4,
  },
  {
    old: '618:23',
    feature: 'flurry',
    label: (value) => `Flurry of Blows (${FLURRY_FEATS[Number(value)]})`,
    amounts: [ROWS],
    classes: ['monk'],
    values: LEVELS.map((level) => 1 + Number(level >= 8) + Number(level >= 15)),
    steady: [],
    increments: 2,
  },
  {
    old: '619:51',
    feature: 'studiedTarget',
    label: (value) => `${ordinal(Number(value))} Studied Target`,
    amounts: [ROWS],
    classes: ['slayer'],
    values: STUDIED_VALUES,
    steady: [],
    increments: 4,
  },
  {
    old: '620:20',
    feature: 'slowFall',
    label: (value) =>
      value === true ? 'Slow Fall any distance' : `Slow Fall ${value} ft.`,
    amounts: [],
    classes: ['monk'],
    values: [
      0,
      0,
      0,
      20,
      20,
      30,
      30,
      40,
      40,
      50,
      50,
      60,
      60,
      70,
      70,
      80,
      80,
      90,
      90,
      true,
    ],
    steady: [],
    increments: 8,
  },
  {
    old: '621:16',
    feature: 'weaponMastery',
    label: noIncrements,
    amounts: [ROWS],
    classes: ['fighter'],
    values: LEVELS.map((level) => level === 20),
    steady: [],
    increments: 0,
  },
  {
    old: '622:21',
    feature: 'armorMastery',
    label: noIncrements,
    amounts: [ROWS],
    classes: ['fighter'],
    values: LEVELS.map((level) => level >= 19),
    steady: [],
    increments: 0,
  },
  {
    old: '622:54',
    feature: 'kiPowers',
    label: (_value, _level, tag) => `Ki Power${uc(tag)}`,
    amounts: [ROWS],
    classes: ['monkUnchained'],
    values: LEVELS.map((level) =>
      level < 4 ? 0 : Math.floor((level - 2) / 2),
    ),
    steady: [],
    increments: 8,
  },
  {
    old: '624:34',
    feature: 'damageReduction',
    label: (value, _level, tag) => `Damage Reduction ${value}/—${uc(tag)}`,
    amounts: [ROWS, { kind: 'damageReduction', bypass: '-' }],
    classes: ['barbarian', 'barbarianUnchained', 'bloodrager'],
    values: LEVELS.map((level) =>
      level < 7 ? 0 : 1 + Math.floor((level - 7) / 3),
    ),
    steady: [],
    increments: 12,
  },
  {
    old: '624:42',
    feature: 'bloodlineSpellsBloodrager',
    label: () => 'Bloodline Spell',
    amounts: [ROWS],
    classes: ['bloodrager'],
    values: LEVELS.map((level) =>
      level < 7 ? 0 : Math.min(1 + Math.floor((level - 7) / 3), 4),
    ),
    steady: [],
    increments: 3,
  },
  {
    old: '625:97',
    feature: 'weaponTraining',
    label: (value) => `Weapon Training ${value}`,
    amounts: [ROWS],
    classes: ['fighter'],
    values: LEVELS.map(
      (level) => [5, 9, 13, 17].filter((step) => level >= step).length,
    ),
    steady: [],
    increments: 3,
  },
  {
    old: '626:32',
    feature: 'favoredTerrain',
    label: (value) => `${ordinal(Number(value))} Favored Terrain`,
    amounts: [ROWS],
    classes: ['ranger'],
    values: LEVELS.map((level) =>
      level < 3 ? 0 : 1 + Math.floor((level - 3) / 5),
    ),
    steady: [],
    increments: 3,
  },
  {
    old: '626:39',
    feature: 'flurryUnchained',
    label: (_value, _level, tag) => `Flurry of Blows (bonus attack)${uc(tag)}`,
    amounts: [ROWS],
    classes: ['monkUnchained'],
    values: LEVELS.map((level) => (level < 11 ? 1 : 2)),
    steady: [],
    increments: 1,
  },
  {
    old: '628:50',
    feature: 'challenge',
    label: (value) => `Challenge ${value}/day`,
    amounts: [ROWS, { kind: 'dailyMaximum', key: 'classFeat_challengeCav' }],
    classes: ['cavalier'],
    values: LEVELS.map((level) => 1 + Math.floor((level - 1) / 3)),
    steady: [],
    increments: 6,
  },
  {
    old: '628:59',
    feature: 'sneakAttack',
    label: (value) => `Sneak Attack +${value}d6`,
    amounts: [ROWS],
    classes: ['slayer'],
    values: LEVELS.map((level) => Math.floor(level / 3)),
    steady: [],
    increments: 5,
  },
  {
    old: '628:67',
    feature: 'bloodlineFeatSorcerer',
    label: () => 'Bloodline Feat',
    amounts: [ROWS],
    classes: ['sorcerer'],
    values: LEVELS.map((level) =>
      level < 7 ? 0 : 1 + Math.floor((level - 7) / 6),
    ),
    steady: [],
    increments: 2,
  },
  {
    old: '628:81',
    feature: 'bonusFeatMonk',
    label: (_value, _level, tag) => `Bonus Feat${uc(tag)}`,
    amounts: [ROWS],
    classes: ['monk', 'monkUnchained'],
    values: LEVELS.map((level) => 1 + Math.floor((level + 2) / 4)),
    steady: [],
    increments: 10,
  },
  {
    old: '629:29',
    feature: 'discovery',
    label: () => 'Discovery',
    amounts: [ROWS],
    classes: ['alchemist'],
    values: LEVELS.map((level) => Math.min(Math.floor(level / 2), 9)),
    steady: [],
    increments: 8,
  },
  {
    old: '629:36',
    feature: 'favoredEnemy',
    label: (value) => `${ordinal(Number(value))} Favored Enemy`,
    amounts: [ROWS],
    classes: ['ranger'],
    values: LEVELS.map((level) => 1 + Math.floor(level / 5)),
    steady: [],
    increments: 4,
  },
  {
    old: '631:31',
    feature: 'mystery',
    label: () => 'Mystery Spell',
    amounts: [ROWS],
    classes: ['oracle'],
    values: LEVELS.map((level) => Math.min(Math.floor(level / 2), 9)),
    // Acquired at 1st, before its first mystery spell at 2nd.
    steady: [1],
    increments: 9,
  },
  {
    old: '631:39',
    feature: 'slayerTalents',
    label: () => 'Slayer Talent',
    amounts: [ROWS],
    classes: ['slayer'],
    values: LEVELS.map((level) => Math.floor(level / 2)),
    steady: [],
    increments: 9,
  },
  {
    old: '631:56',
    feature: 'unarmedStrike',
    label: (value, _level, tag) =>
      `Unarmed Strike (${UNARMED_DAMAGE[Number(value)]})${uc(tag)}`,
    amounts: [ROWS],
    classes: ['monk', 'monkUnchained'],
    values: LEVELS.map((level) => 1 + Math.floor(level / 4)),
    steady: [],
    increments: 10,
  },
  {
    old: '632:29',
    feature: 'revelation',
    label: () => 'Revelation',
    amounts: [ROWS],
    classes: ['oracle'],
    values: LEVELS.map((level) =>
      level < 3 ? 1 : 2 + Math.floor((level - 3) / 4),
    ),
    steady: [],
    increments: 5,
  },
  {
    old: '632:41',
    feature: 'order',
    label: () => 'Order Ability',
    amounts: [ROWS],
    classes: ['cavalier'],
    values: LEVELS.map(
      (level) => [2, 8, 15].filter((step) => level >= step).length,
    ),
    // Acquired at 1st, before its first order ability at 2nd.
    steady: [1],
    increments: 3,
  },
  {
    old: '633:24',
    feature: 'summonMonster',
    label: (value) => SUMMONS[Number(value)] ?? '',
    amounts: [ROWS],
    classes: ['summoner'],
    values: LEVELS.map((level) => Math.min(10, Math.ceil(level / 2))),
    steady: [],
    increments: 9,
  },
  {
    old: '636:42',
    feature: 'bravery',
    label: (value) => `Bravery +${value}`,
    amounts: [ROWS],
    classes: ['fighter'],
    values: BRAVERY_VALUES,
    steady: [],
    increments: 4,
  },
  {
    old: '636:142',
    feature: 'inspireCourage',
    label: (value) => `Inspire Courage +${value}`,
    amounts: [ROWS],
    classes: ['bard'],
    values: LEVELS.map((level) => 1 + Math.floor((level + 1) / 6)),
    steady: [],
    increments: 3,
  },
  {
    old: '636:149',
    feature: 'bonusFeatsMagus',
    label: () => 'Bonus Feat',
    amounts: [ROWS, SLOTS],
    classes: ['magus'],
    values: LEVELS.map((level) => Math.floor((level + 1) / 6)),
    steady: [],
    increments: 2,
  },
  {
    old: '637:20',
    feature: 'armorTrainingHeavy',
    label: noIncrements,
    amounts: [ROWS],
    classes: ['fighter'],
    values: LEVELS.map((level) => level >= 7),
    steady: [],
    increments: 0,
  },
  {
    old: '637:55',
    feature: 'rogueTalents',
    label: (_value, _level, tag) => `Rogue Talent${uc(tag)}`,
    amounts: [ROWS],
    classes: ['rogue', 'rogueUnchained'],
    values: LEVELS.map((level) => Math.floor(level / 2)),
    steady: [],
    increments: 18,
  },
  {
    old: '639:22',
    feature: 'channelEnergy',
    label: (value) => `Channel Energy ${value}d6`,
    amounts: [ROWS, { kind: 'dice', die: 6 }],
    classes: ['cleric'],
    values: LEVELS.map((level) => Math.ceil(level / 2)),
    steady: [],
    increments: 9,
  },
  {
    old: '640:23',
    feature: 'loreMaster',
    label: (value) => `Lore Master ${value}/day`,
    amounts: [ROWS],
    classes: ['bard'],
    values: LEVELS.map((level) =>
      level < 5 ? 0 : Math.floor((level + 1) / 6),
    ),
    steady: [],
    increments: 2,
  },
  {
    old: '643:29',
    feature: 'bloodlineSpellsSorcerer',
    label: () => 'Bloodline Spell',
    amounts: [ROWS],
    classes: ['sorcerer'],
    values: LEVELS.map((level) =>
      level < 3 ? 0 : Math.floor((level - 1) / 2),
    ),
    steady: [],
    increments: 8,
  },
  {
    old: '643:40',
    feature: 'judgment',
    label: (value) => `Judgment ${value}/day`,
    amounts: [ROWS, { kind: 'dailyMaximum', key: 'classFeat_judgment' }],
    classes: ['inquisitor'],
    values: LEVELS.map((level) => 1 + Math.floor((level - 1) / 3)),
    steady: [],
    increments: 6,
  },
  {
    old: '644:23',
    feature: 'wildShape',
    label: (value) =>
      `Wild Shape (${value === 9 ? 'at will' : `${value}/day`})`,
    amounts: [ROWS],
    classes: ['druid'],
    // 9 stands for at will (20th level).
    values: LEVELS.map((level) =>
      level < 4
        ? 0
        : level === 20
          ? 9
          : Math.min(Math.floor((level - 2) / 2), 8),
    ),
    steady: [],
    increments: 8,
  },
  {
    old: '647:23',
    feature: 'bonusFeatCavalier',
    label: () => 'Bonus Feat',
    amounts: [ROWS, SLOTS],
    classes: ['cavalier'],
    values: LEVELS.map((level) => Math.floor(level / 6)),
    steady: [],
    increments: 2,
  },
  {
    old: '649:29',
    feature: 'bloodlineFeatBloodrager',
    label: () => 'Bloodline Feat',
    amounts: [ROWS],
    classes: ['bloodrager'],
    values: LEVELS.map((level) => Math.max(0, Math.floor(level / 3) - 1)),
    steady: [],
    increments: 4,
  },
  {
    old: '649:44',
    feature: 'slayersAdvance',
    label: (value) => `Slayer’s Advance ${value}/day`,
    amounts: [ROWS, { kind: 'dailyMaximum', key: 'classFeat_slayersAdvance' }],
    classes: ['slayer'],
    values: LEVELS.map((level) => (level < 13 ? 0 : level < 17 ? 1 : 2)),
    steady: [],
    increments: 1,
  },
];

describe('the class features’ schedules as the import emits them', () => {
  for (const {
    old,
    feature,
    classes: tags,
    values,
    steady,
    increments,
    label,
    amounts,
  } of scheduleCases)
    it(`${feature}: each granting class gives it a row exactly where its schedule changes and at its steady levels, each increment labelled with its amount there, ${increments} increments, and each emitted amount equals the schedule at every level (${old})`, () => {
      expect(values).toHaveLength(20);
      for (const level of steady)
        expect(changeLevels(values)).not.toContain(level);
      const expected = [...changeLevels(values), ...steady].sort(
        (left, right) => left - right,
      );
      for (const tag of tags) {
        const rows = classRows(classes[tag], features[feature]);
        expect(
          rows.map((row) => row.level),
          tag,
        ).toEqual(expected);
        // The increments (every row after the acquisition), in order.
        expect(
          rows.slice(1).map((row) => [row.level, row.name]),
          `${tag} labels`,
        ).toEqual(
          expected
            .slice(1)
            .map((level) => [level, label(values[level - 1]!, level, tag)]),
        );
        for (const amount of amounts) {
          const { emitted, expected: fromValues } = amountsOf(amount, {
            tag,
            feature: features[feature],
            values,
            steady,
          });
          expect(emitted, `${tag} ${amount.kind}`).toEqual(fromValues);
        }
      }
      expect(incrementsOf(features[feature])).toHaveLength(increments);
    });

  it('refuses an amount with a field of another kind, by literal and by spread', () => {
    const dice: Amount = { kind: 'dice', die: 6 };
    const reduction: Amount = { kind: 'damageReduction', bypass: '-' };
    const maximum: Amount = { kind: 'dailyMaximum', key: 'classFeat_judgment' };
    const { kind: _diceKind, ...onlyDie } = dice;
    const { kind: _reductionKind, ...onlyBypass } = reduction;
    const { kind: _maximumKind, ...onlyKey } = maximum;
    const refused: Amount[] = [
      // @ts-expect-error A rows amount has no die.
      { kind: 'rows', die: 6 },
      // @ts-expect-error A rows amount takes no die by spread.
      { kind: 'rows', ...onlyDie },
      // @ts-expect-error A dice amount has no bypass.
      { kind: 'dice', die: 6, bypass: '-' },
      // @ts-expect-error A dice amount takes no bypass by spread.
      { ...dice, ...onlyBypass },
      // @ts-expect-error A damage reduction has no per-day key.
      { kind: 'damageReduction', bypass: '-', key: 'classFeat_judgment' },
      // @ts-expect-error A damage reduction takes no per-day key by spread.
      { ...reduction, ...onlyKey },
    ];
    expect(refused).toHaveLength(6);
  });
});

/** A feature's old block's values, from its schedule case. */
function valuesOf(feature: keyof typeof features) {
  const row = scheduleCases.find((item) => item.feature === feature);
  if (!row) throw new Error(`${feature} has no schedule case.`);
  return row.values.map(Number);
}
const dice = (counts: readonly number[]) => counts.map((count) => `${count}d6`);

/**
 * Every retained formula that states the feature's schedule, alone, read by
 * `retainedReading` at every level from 1st to 20th, against the old block's
 * values (or a literal where Foundry's formula differs from them outside the
 * feature's rows, said at the row); a formula the evaluator does not parse,
 * against its text.
 */
const retainedCases: readonly {
  old: Old;
  feature: keyof typeof features;
  at: string;
  /** The formula's exact text. */
  formula: string;
  /** The one level variable it reads, the class level it is checked for. */
  reads: LevelVariable;
  expected: RetainedReading;
}[] = [
  {
    old: '605:76',
    feature: 'bonusFeatsWizard',
    at: 'changes:bonusFeats',
    formula: 'floor(@class.level / 5)',
    reads: '@class.level',
    expected: { values: valuesOf('bonusFeatsWizard') },
  },
  {
    old: '608:43',
    feature: 'armorTraining',
    at: 'changes:acpA',
    formula: '-clamp(floor((@class.level + 1) / 4), 0, 4)',
    reads: '@class.level',
    expected: { values: valuesOf('armorTraining').map((value) => -value) },
  },
  {
    old: '608:43',
    feature: 'armorTraining',
    at: 'changes:mDexA',
    formula: 'clamp(floor((@class.level + 1) / 4), 0, 4)',
    reads: '@class.level',
    expected: { values: valuesOf('armorTraining') },
  },
  {
    old: '609:29',
    feature: 'teamworkFeat',
    at: 'changes:bonusFeats',
    formula: 'floor(@class.level / 3)',
    reads: '@class.level',
    expected: { values: valuesOf('teamworkFeat') },
  },
  {
    old: '613:62',
    feature: 'bonusFeatsFighter',
    at: 'changes:bonusFeats',
    formula: '1 + floor(@class.level / 2)',
    reads: '@class.level',
    expected: { values: valuesOf('bonusFeatsFighter') },
  },
  {
    old: '613:133',
    feature: 'fastMovement',
    at: 'changes:landSpeed',
    formula: '10 * (floor(@class.level / 3))',
    reads: '@class.level',
    expected: { values: valuesOf('fastMovement') },
  },
  {
    old: '628:67',
    feature: 'bloodlineFeatSorcerer',
    at: 'changes:bonusFeats',
    formula: 'floor((@class.level - 1) / 6)',
    reads: '@class.level',
    expected: { values: valuesOf('bloodlineFeatSorcerer') },
  },
  {
    old: '628:81',
    feature: 'bonusFeatMonk',
    at: 'changes:bonusFeats',
    formula: '1 + floor((@class.level + 2) / 4)',
    reads: '@class.level',
    expected: { values: valuesOf('bonusFeatMonk') },
  },
  // Its one bonus feat, Improved Unarmed Strike, at every level.
  {
    old: '631:56',
    feature: 'unarmedStrike',
    at: 'changes:bonusFeats',
    formula: '1',
    reads: '@class.level',
    expected: { values: LEVELS.map(() => 1) },
  },
  {
    old: '636:149',
    feature: 'bonusFeatsMagus',
    at: 'changes:bonusFeats',
    formula: 'floor((@class.level + 1) / 6)',
    reads: '@class.level',
    expected: { values: valuesOf('bonusFeatsMagus') },
  },
  {
    old: '647:23',
    feature: 'bonusFeatCavalier',
    at: 'changes:bonusFeats',
    formula: 'floor(@class.level / 6)',
    reads: '@class.level',
    expected: { values: valuesOf('bonusFeatCavalier') },
  },
  {
    old: '649:29',
    feature: 'bloodlineFeatBloodrager',
    at: 'changes:bonusFeats',
    formula: 'floor(@class.level / 3) - 1',
    reads: '@class.level',
    // floor(level / 3) - 1 reads -1 at 1st and 2nd, before its 6th-level
    // acquisition, where the old values hold 0.
    expected: {
      values: valuesOf('bloodlineFeatBloodrager').map((value, index) =>
        index < 2 ? -1 : value,
      ),
    },
  },
  {
    old: '605:40',
    feature: 'smiteEvil',
    at: 'gameContent:uses.maxFormula',
    formula: 'floor((@attributes.hd.total - 1) / 3) + 1',
    reads: '@attributes.hd.total',
    expected: { values: valuesOf('smiteEvil') },
  },
  {
    old: '628:50',
    feature: 'challenge',
    at: 'gameContent:uses.maxFormula',
    formula: '1 + floor((@class.level - 1) / 3)',
    reads: '@class.level',
    expected: { values: valuesOf('challenge') },
  },
  {
    old: '640:23',
    feature: 'loreMaster',
    at: 'gameContent:uses.maxFormula',
    formula: 'floor((@class.level + 1) / 6)',
    reads: '@class.level',
    expected: { values: valuesOf('loreMaster') },
  },
  {
    old: '643:40',
    feature: 'judgment',
    at: 'gameContent:uses.maxFormula',
    formula: '1 + floor((@class.level - 1) / 3)',
    reads: '@class.level',
    expected: { values: valuesOf('judgment') },
  },
  {
    old: '644:23',
    feature: 'wildShape',
    at: 'gameContent:uses.maxFormula',
    formula: 'min(floor((@class.level - 2) / 2), 8)',
    reads: '@class.level',
    // min(floor((level - 2) / 2), 8) reads -1 at 1st, before its 4th-level
    // acquisition; at 20th it stays at its cap of 8, where the old value 9
    // stands for at will (the 20th-level label).
    expected: {
      values: valuesOf('wildShape').map((value, index) =>
        index === 0 ? -1 : index === 19 ? 8 : value,
      ),
    },
  },
  // The sheet's evaluator has no `if` or `gte`.
  {
    old: '649:44',
    feature: 'slayersAdvance',
    at: 'gameContent:uses.maxFormula',
    formula: '1 + if(gte(@class.level, 17), 1)',
    reads: '@class.level',
    expected: { text: '1 + if(gte(@class.level, 17), 1)' },
  },
  // A bomb's 1d6, multiplied on a critical hit, and its further dice, not.
  {
    old: '610:24',
    feature: 'bomb',
    at: 'gameContent:actions[0].damage.parts[0].formula',
    formula: '1d6',
    reads: '@class.level',
    expected: { values: dice(LEVELS.map(() => 1)) },
  },
  {
    old: '610:24',
    feature: 'bomb',
    at: 'gameContent:actions[0].damage.nonCritParts[0].formula',
    formula: '(ceil(@class.level / 2) - 1)d6',
    reads: '@class.level',
    expected: { values: dice(valuesOf('bomb').map((value) => value - 1)) },
  },
  {
    old: '628:59',
    feature: 'sneakAttack',
    at: 'gameContent:actions[0].damage.parts[0].formula',
    formula: '(floor(@class.level / 3))d6',
    reads: '@class.level',
    expected: { values: dice(valuesOf('sneakAttack')) },
  },
  // Its four actions' damage or healing, each.
  ...[0, 1, 2, 3].map((action) => ({
    old: '639:22' as const,
    feature: 'channelEnergy' as const,
    at: `gameContent:actions[${action}].damage.parts[0].formula`,
    formula: '(ceil(@class.level / 2))d6',
    reads: '@class.level' as const,
    expected: { values: dice(valuesOf('channelEnergy')) },
  })),
];

describe('the retained Foundry formulas, each alone at every level', () => {
  for (const { old, feature, at, formula, reads, expected } of retainedCases)
    it(`${feature}: its retained ${at} is its exact text and, reading ${reads} only, the schedule at every level from 1st to 20th (${old})`, () => {
      const retained = retainedFormula(features[feature], at);
      expect(retained).toBe(formula);
      expect(retainedReading(retained, reads)).toEqual(expected);
    });
});

/**
 * A curated formula's value through the sheet's evaluator: for each class
 * alone at every level, the schedule's values; at each mix, its value.
 */
type FormulaCase = {
  old: Old;
  feature: keyof typeof features;
  modifiers: readonly Modifier[];
  formula: string;
  tags: readonly [string, ...string[]];
  values: Schedule;
  mixes: readonly { levels: Record<string, number>; value: number }[];
};

const formulaCases: readonly FormulaCase[] = [
  {
    old: '606:30',
    feature: 'poisonResistance',
    modifiers: POISON_MODIFIERS,
    formula: POISON_FORMULA,
    tags: ['alchemist', 'investigator'],
    values: POISON_VALUES,
    // The two classes' bonuses don't stack: the higher level counts.
    mixes: [{ levels: { alchemist: 5, investigator: 2 }, value: 4 }],
  },
  {
    old: '613:165',
    feature: 'trapSense',
    modifiers: TRAP_MODIFIERS,
    formula: TRAP_FORMULA,
    tags: ['barbarian', 'rogue', 'investigator'],
    values: TRAP_VALUES,
    mixes: [
      // "Trap sense bonuses gained from multiple classes stack."
      { levels: { barbarian: 6, rogue: 4 }, value: 3 },
      // The Unchained classes (danger sense) add nothing.
      { levels: { barbarianUnchained: 9, rogueUnchained: 9 }, value: 0 },
    ],
  },
  {
    old: '619:51',
    feature: 'studiedTarget',
    modifiers: STUDIED_MODIFIERS,
    formula: STUDIED_FORMULA,
    tags: ['slayer'],
    values: STUDIED_VALUES,
    mixes: [],
  },
];

describe('the curated formulas through the sheet’s evaluator', () => {
  for (const {
    old,
    feature,
    modifiers,
    formula,
    tags,
    values,
    mixes,
  } of formulaCases)
    it(`${feature}: its note and description records give its Modifiers, and its formula gives the schedule at every level of each class (${old})`, async () => {
      expect(await curatedModifiers(features[feature])).toEqual(modifiers);
      for (const tag of tags)
        expect(
          LEVELS.map((level) => formulaAt(formula, { [tag]: level })),
          tag,
        ).toEqual(values);
      for (const { levels, value } of mixes)
        expect(formulaAt(formula, levels)).toBe(value);
    });
});

/**
 * A feature's increments: every key it gives attribution to, with its name,
 * in the order the import emits them (the old snapshots' order, by key).
 */
const incrementCases: readonly {
  old: Old;
  feature: keyof typeof features;
  increments: readonly (readonly [key: string, name: string])[];
}[] = [
  {
    old: '604:23',
    feature: 'styleStrikes',
    increments: [
      ['everythingpath/unchained-monk-style-strike-13', 'Style Strike (UC)'],
      [
        'everythingpath/unchained-monk-style-strike-15',
        'Style Strike (2/round) (UC)',
      ],
      ['everythingpath/unchained-monk-style-strike-17', 'Style Strike (UC)'],
      ['everythingpath/unchained-monk-style-strike-9', 'Style Strike (UC)'],
    ],
  },
  {
    old: '628:81',
    feature: 'bonusFeatMonk',
    // The old block's keys in its order (`.sort()`), each with its name.
    increments: [2, 6, 10, 14, 18]
      .flatMap((level) => [
        `everythingpath/monk-bonus-feat-${level}`,
        `everythingpath/unchained-monk-bonus-feat-${level}`,
      ])
      .sort()
      .map((key) => [
        key,
        key.includes('unchained') ? 'Bonus Feat (UC)' : 'Bonus Feat',
      ]),
  },
  {
    old: '633:24',
    feature: 'summonMonster',
    increments: [
      ['everythingpath/summoner-summon-monster-11', 'Summon Monster VI'],
      ['everythingpath/summoner-summon-monster-13', 'Summon Monster VII'],
      ['everythingpath/summoner-summon-monster-15', 'Summon Monster VIII'],
      ['everythingpath/summoner-summon-monster-17', 'Summon Monster IX'],
      ['everythingpath/summoner-summon-monster-19', 'Gate'],
      ['everythingpath/summoner-summon-monster-3', 'Summon Monster II'],
      ['everythingpath/summoner-summon-monster-5', 'Summon Monster III'],
      ['everythingpath/summoner-summon-monster-7', 'Summon Monster IV'],
      ['everythingpath/summoner-summon-monster-9', 'Summon Monster V'],
    ],
  },
  {
    old: '644:23',
    feature: 'wildShape',
    // The old block's names in its order.
    increments: [
      ['everythingpath/druid-wild-shape-10', 'Wild Shape (4/day)'],
      ['everythingpath/druid-wild-shape-12', 'Wild Shape (5/day)'],
      ['everythingpath/druid-wild-shape-14', 'Wild Shape (6/day)'],
      ['everythingpath/druid-wild-shape-16', 'Wild Shape (7/day)'],
      ['everythingpath/druid-wild-shape-18', 'Wild Shape (8/day)'],
      ['everythingpath/druid-wild-shape-20', 'Wild Shape (at will)'],
      ['everythingpath/druid-wild-shape-6', 'Wild Shape (2/day)'],
      ['everythingpath/druid-wild-shape-8', 'Wild Shape (3/day)'],
    ],
  },
];

describe('the schedule increments’ keys and names', () => {
  for (const { old, feature, increments } of incrementCases)
    it(`${feature} gives attribution to exactly its listed increments, in order, each with its table label (${old})`, () => {
      expect(
        incrementsOf(features[feature]).map((row) => [
          row.externalKey,
          row.name,
        ]),
      ).toEqual(increments);
    });
});

/** Texts a feature's pinned body holds. */
const bodyCases: readonly {
  old: Old;
  feature: keyof typeof features;
  texts: readonly [string | RegExp, ...(string | RegExp)[]];
}[] = [
  {
    old: '609:41',
    feature: 'kiPoolUnchained',
    // The bonus attack stacks with haste's (Core Rulebook spell, p. 293).
    texts: ['as well as those from haste and similar effects'],
  },
  {
    old: '613:165',
    feature: 'trapSense',
    texts: ['Trap sense bonuses gained from multiple classes stack.'],
  },
  {
    old: '615:44',
    feature: 'mercy',
    // The appended Healer's Handbook mercies.
    texts: ['Amputated', 'Ensorcelled', 'Petrified'].map(
      (name) => new RegExp(`<em>${name}: ?</em>`),
    ) as [RegExp, ...RegExp[]],
  },
  {
    old: '617:37',
    feature: 'ragePowers',
    // The totem paragraph: the Ultimate Combat dragon totem.
    texts: ['dragon totem'],
  },
  {
    old: '626:39',
    feature: 'flurryUnchained',
    texts: [
      'stacks with the bonus attacks from haste and other similar effects',
    ],
  },
];

describe('the pinned bodies’ texts', () => {
  for (const { old, feature, texts } of bodyCases)
    it(`${feature}: its pinned body holds the listed texts (${old})`, async () => {
      const { description } = await pinnedRecord(features[feature]);
      for (const text of texts) expect(description).toMatch(text);
    });
});

/**
 * Each amount at a feature's acquisition that only its description states
 * (the prose tokens of R/pbl-class-abilities/amount-inventory.txt): the
 * emitted description contains the sentence that states it, a literal; the
 * sentence holds the stated words; and the old block's value at that level is
 * the amount they state.
 */
const startCases: readonly {
  old: Old;
  feature: keyof typeof features;
  level: number;
  sentence: string;
  stated: string;
  amount: number;
}[] = [
  {
    old: '605:49',
    feature: 'inspireCompetence',
    level: 3,
    sentence:
      'The ally gets a +2 <em>competence bonus</em> on skill checks with a particular skill',
    stated: '+2',
    amount: 2,
  },
  {
    old: '620:20',
    feature: 'slowFall',
    level: 4,
    sentence:
      'he takes damage as if the fall were 20 feet shorter than it actually is',
    stated: '20 feet',
    amount: 20,
  },
  {
    old: '636:142',
    feature: 'inspireCourage',
    level: 1,
    sentence:
      'receives a +1 <em>morale bonus</em> on saving throws against <em>charm</em> and fear effects and a +1 <em>competence bonus</em> on attack and weapon damage rolls.',
    stated: '+1',
    amount: 1,
  },
  {
    old: '618:23',
    feature: 'flurry',
    level: 1,
    sentence:
      'he may make one additional attack, taking a –2 penalty on all of his <em>attack rolls</em>',
    stated: 'one additional attack',
    amount: 1,
  },
  {
    old: '626:39',
    feature: 'flurryUnchained',
    level: 1,
    sentence:
      'the monk can make one additional attack at his highest base attack bonus.',
    stated: 'one additional attack',
    amount: 1,
  },
  // A Medium monk's 1d6 at 1st to 3rd, its first damage step.
  {
    old: '631:56',
    feature: 'unarmedStrike',
    level: 1,
    sentence: '<td>1st–3rd</td><td>1d4</td><td>1d6</td><td>1d8</td>',
    stated: '1d6',
    amount: 1,
  },
  {
    old: '616:22',
    feature: 'hex',
    level: 1,
    sentence: 'At 1st level, a witch gains one hex of her choice.',
    stated: 'one hex',
    amount: 1,
  },
  {
    old: '617:53',
    feature: 'magusArcana',
    level: 3,
    sentence: 'a magus gains one magus arcana.',
    stated: 'one magus arcana',
    amount: 1,
  },
  {
    old: '615:44',
    feature: 'mercy',
    level: 3,
    sentence: 'a paladin can select one mercy.',
    stated: 'one mercy',
    amount: 1,
  },
  {
    old: '637:55',
    feature: 'rogueTalents',
    level: 2,
    sentence: 'a rogue gains one rogue talent.',
    stated: 'one rogue talent',
    amount: 1,
  },
  {
    old: '631:39',
    feature: 'slayerTalents',
    level: 2,
    sentence: 'a slayer gains one slayer talent.',
    stated: 'one slayer talent',
    amount: 1,
  },
  {
    old: '604:23',
    feature: 'styleStrikes',
    level: 5,
    sentence: 'a monk can learn one type of style strike.',
    stated: 'one type of style strike',
    amount: 1,
  },
  {
    old: '604:23',
    feature: 'styleStrikes',
    level: 5,
    // One a round until 15th, where the label says two.
    sentence: 'he can designate one of his unarmed strikes as a style strike.',
    stated: 'one of his unarmed strikes',
    amount: 1,
  },
  {
    old: '622:54',
    feature: 'kiPowers',
    level: 4,
    sentence: 'a monk can select one ki power.',
    stated: 'one ki power',
    amount: 1,
  },
  {
    old: '617:61',
    feature: 'versatilePerformance',
    level: 2,
    sentence: 'a bard can choose one type of <em>Perform</em> skill.',
    stated: 'one type of',
    amount: 1,
  },
  {
    old: '625:97',
    feature: 'weaponTraining',
    level: 5,
    sentence: 'a fighter can select one group of weapons',
    stated: 'one group',
    amount: 1,
  },
  {
    old: '625:97',
    feature: 'weaponTraining',
    level: 5,
    sentence: 'he gains a +1 bonus on attack and damage rolls.',
    stated: '+1',
    amount: 1,
  },
];

describe('the starting amounts the descriptions state', () => {
  for (const { old, feature, level, sentence, stated, amount } of startCases)
    it(`${feature}: its description states "${stated}" at ${ordinal(level)} level, the old block's value there (${old})`, () => {
      expect(entryOf(features[feature]).description).toContain(sentence);
      expect(sentence).toContain(stated);
      expect(valuesOf(feature)[level - 1]).toBe(amount);
    });
});

/** A pinned PCGen row the old block compared, by its file and line. */
const pcgenCases: readonly {
  old: Old;
  feature: keyof typeof features;
  path: string;
  line: number;
  row: string | RegExp;
}[] = [
  {
    old: '608:43',
    feature: 'armorTraining',
    path: CRB_CLASS_ABILITIES,
    line: 890,
    row: 'BONUS:VAR|ArmorTraining|min((ArmorTrainingLVL+1)/4,4)',
  },
  {
    old: '613:62',
    feature: 'bonusFeatsFighter',
    path: CRB_CLASS_ABILITIES,
    line: 893,
    // PCGen grants the same count as the schedule.
    row: 'BONUS:ABILITYPOOL|Fighter Bonus Feat|FighterLvl/2+1',
  },
  {
    old: '622:21',
    feature: 'armorMastery',
    path: CRB_CLASS_ABILITIES,
    line: 261,
    // PCGen's grant at Fighter level 19.
    row: 'Fighter ~ Armor Mastery|PREVAREQ:Fighter_CF_ArmorMastery,0|PREVARGTEQ:Fighter_CFP_Level,19',
  },
  {
    old: '625:97',
    feature: 'weaponTraining',
    path: 'data/pathfinder/paizo/roleplaying_game/ultimate_combat/uc_abilities_class.lst',
    line: 1994,
    row: /^Weapon Training \(Firearms\)\t/,
  },
  {
    old: '625:97',
    feature: 'weaponTraining',
    path: 'data/pathfinder/paizo/roleplaying_game/ultimate_wilderness/uw_abilities_class.lst',
    line: 612,
    row: /^Weapon Training \(Tribal\)\t/,
  },
  {
    old: '632:29',
    feature: 'revelation',
    path: 'data/pathfinder/paizo/roleplaying_game/advanced_players_guide/apg_abilities_class.lst',
    line: 480,
    // PCGen has no grant row: Oracle's Mystery counts the revelations.
    row: /^Oracle's Mystery\t/,
  },
  {
    old: '636:42',
    feature: 'bravery',
    path: CRB_CLASS_ABILITIES,
    line: 888,
    row: 'BONUS:VAR|Bravery|(BraveryLVL+2)/4',
  },
  {
    old: '637:20',
    feature: 'armorTrainingHeavy',
    path: CRB_CLASS_ABILITIES,
    line: 895,
    row: 'UNENCUMBEREDMOVE:HeavyArmor',
  },
  {
    old: '643:29',
    feature: 'bloodlineSpellsSorcerer',
    path: CRB_CLASS_ABILITIES,
    line: 2338,
    // PCGen has no grant row: the bloodline bonus-spell record and its flags.
    row: /^Aberrant Bloodline ~ Bonus Spells\t/,
  },
  {
    old: '649:29',
    feature: 'bloodlineFeatBloodrager',
    path: 'data/pathfinder/paizo/roleplaying_game/advanced_class_guide/acg_abilities_class.lst',
    line: 369,
    // PCGen has no grant row: the Bloodline Tracker adds the feats.
    row: /^CATEGORY=Internal\|Bloodrager ~ Bloodline Tracker\.MOD\t/,
  },
  {
    old: '649:44',
    feature: 'slayersAdvance',
    path: 'data/pathfinder/paizo/roleplaying_game/advanced_class_guide/acg_abilities_class.lst',
    line: 1797,
    // The body's second sentence is PCGen's DESC word for word.
    row: 'He may use Stealth as part of this movement, but takes a -10 penalty to his check for doing so.',
  },
];

describe('the pinned PCGen rows', () => {
  for (const { feature, old, path, line, row } of pcgenCases)
    it(`${feature}: PCGen line ${line} of its file holds the listed row text (${old})`, async () => {
      expect(await pinnedLine('pcgen', path, line)).toMatch(row);
    });
});

describe('the Fighter’s features', () => {
  it('Armor Training: its two paragraphs as Notes, no Modifier, its two Foundry changes unmapped, and its body against the PRD lines (608:16)', async () => {
    const entry = entryOf(features.armorTraining);
    const paragraphs = bodyParagraphs(
      (await pinnedRecord(features.armorTraining)).description,
    );
    expect(entry.modifiers).toEqual([]);
    expect(entry.situationalNotes?.map((note) => note.text)).toEqual(
      paragraphs,
    );
    // Foundry's two changes stay unmapped: no Modifier target exists for them.
    // Since rotation-1 the sheet computes both from the feature's rule identity
    // (`armorTrainingTier`, tests/catalog/armor-training-608.test.ts).
    expect(
      entry.unsupported
        .filter((row) => row.field === 'changes')
        .map((row) => (row.value as { target: string }).target),
    ).toEqual(['acpA', 'mDexA']);
    // The body equals the PRD's Armor Training paragraph and the medium-armor
    // sentence; the heavy-armor sentence is Armor Training (Heavy Armor).
    const first = prdText(await pinnedLine('prd', FIGHTER_PRD, 383));
    const second = prdText(await pinnedLine('prd', FIGHTER_PRD, 384));
    expect(paragraphs[0]).toBe(first);
    expect(second).toBe(
      `${paragraphs[1]} At 7th level, a fighter can move at his normal speed while wearing heavy armor.`,
    );
  });

  it("Armor Training's tiers: Foundry's clamp(floor((@class.level + 1) / 4), 0, 4) from 3rd level gives the listed tiers through 20th (608:43)", () => {
    expect(
      LEVELS.map((level) =>
        level < 3 ? 0 : Math.min(Math.max(Math.floor((level + 1) / 4), 0), 4),
      ),
    ).toEqual([0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4]);
  });

  const SLOT = { kind: 'feat', count: 1, featTypes: ['Combat'] };
  const INCREMENTS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20].map(
    (level) => `everythingpath/fighter-bonus-feats-${level}`,
  );

  it("Bonus Feats (FGT): the 1st-level acquisition has one Combat feat slot, from the reviewed slot rule, and Foundry's bonusFeats change stays unmapped (613:37)", () => {
    const entry = entryOf(features.bonusFeatsFighter);
    expect(entry.grantsSlots).toEqual([SLOT]);
    expect(reviewedScheduleSlots().get(features.bonusFeatsFighter)).toEqual(
      SLOT,
    );
    expect(
      scheduleSlotRules.find((rule) => rule.className === 'Fighter'),
    ).toEqual({
      className: 'Fighter',
      feature: 'bonus-feats',
      featTypes: ['Combat'],
      printed: 'coreRulebook/classes/fighter.html:380',
    });
    // Foundry's own count contributes nothing, so no slot is doubled.
    expect(entry.modifiers).toEqual([]);
    expect(entry.unsupported).toContainEqual({
      field: 'changes',
      reason:
        'Unmapped target, bonus type, formula or calculation-stage dependency; contributes nothing.',
      // The complete row, formula included; its values at every level are its
      // retainedCases row, which reads this one row (the only bonusFeats one).
      value: {
        target: 'bonusFeats',
        formula: '1 + floor(@class.level / 2)',
        type: 'untyped',
      },
    });
  });

  it('Bonus Feats (FGT): ten increments under it, each with its own Combat slot, so a 20th-level Fighter has 11 (613:62)', () => {
    const increments = incrementsOf(features.bonusFeatsFighter);
    expect(increments.map((row) => row.externalKey)).toEqual(
      expect.arrayContaining(INCREMENTS),
    );
    expect(increments).toHaveLength(10);
    for (const row of increments) {
      expect(row.upstreamKey).toBe(features.bonusFeatsFighter);
      expect(
        row.detail.kind === 'classFeature' && row.detail.parentFeature,
      ).toBe(features.bonusFeatsFighter);
      expect(row.grantsSlots).toEqual([SLOT]);
    }
    // Bonus feats by level: 1 + floor(level / 2), one more at 1st and each
    // even level, each increment's own level.
    expect(changeLevels(BONUS_FEATS_VALUES)).toEqual([
      1,
      ...INCREMENTS.map((key) => Number(key.split('-').at(-1))),
    ]);
    // A 20th-level Fighter has 11: the acquisition's slot and the ten
    // increments' slots, each one feat.
    expect(BONUS_FEATS_VALUES.at(-1)).toBe(11);
    expect(
      [entryOf(features.bonusFeatsFighter), ...increments]
        .flatMap((row) => row.grantsSlots ?? [])
        .reduce((total, slot) => total + slot.count, 0),
    ).toBe(11);
  });

  it('Bonus Feats (FGT): the retraining paragraph is its one Note, and both paragraphs match the PRD lines (613:104)', async () => {
    const paragraphs = bodyParagraphs(
      (await pinnedRecord(features.bonusFeatsFighter)).description,
    );
    const prd = await Promise.all(
      [380, 381].map(async (line) =>
        prdText(await pinnedLine('prd', FIGHTER_PRD, line)).replace(
          /^Bonus Feats: /,
          '',
        ),
      ),
    );
    expect(paragraphs[0]?.replace('Combat Feats', 'combat feats')).toBe(
      prd[0]?.replaceAll('&quot;', '"'),
    );
    expect(paragraphs[1]).toBe(prd[1]);
    // The first paragraph is the slots; retraining stays prose.
    expect(
      entryOf(features.bonusFeatsFighter).situationalNotes?.map(
        (note) => note.text,
      ),
    ).toEqual([paragraphs[1]]);
  });

  it('Weapon Mastery: its one paragraph, the PRD line, is its Note, with no Modifier (621:16)', async () => {
    const entry = entryOf(features.weaponMastery);
    const paragraphs = bodyParagraphs(
      (await pinnedRecord(features.weaponMastery)).description,
    );
    expect(paragraphs).toEqual([
      prdText(await pinnedLine('prd', FIGHTER_PRD, 404)),
    ]);
    expect(entry.modifiers).toEqual([]);
    expect(entry.situationalNotes?.map((note) => note.text)).toEqual(
      paragraphs,
    );
  });

  it('Armor Mastery: DR 5/— at 19th level is its Note, with no Modifier, and the Fighter’s Foundry record links it at no level (622:21)', async () => {
    const entry = entryOf(features.armorMastery);
    const [sentence] = bodyParagraphs(
      (await pinnedRecord(features.armorMastery)).description,
    );
    expect(sentence).toBe(
      'At 19th level, a fighter gains damage reduction 5/— whenever he is wearing armor or using a shield.',
    );
    // The PRD says "DR 5/—" where the body spells it out.
    expect(prdText(await pinnedLine('prd', FIGHTER_PRD, 403))).toBe(
      sentence?.replace('damage reduction', 'DR'),
    );
    expect(entry.modifiers).toEqual([]);
    expect(entry.situationalNotes?.map((note) => note.text)).toEqual([
      sentence,
    ]);
    // The reviewed schedule attaches it at 19 (its schedule case above).
    const { record } = await pinnedRecord(classes.fighter);
    expect(JSON.stringify(record.system.links)).not.toContain(
      features.armorMastery.slice('pf1/'.length),
    );
  });

  it('Weapon Training: its three rules paragraphs match the CRB lines and are its Notes, with no Modifier, and the groups the CRB lacks stay in the body (625:97)', async () => {
    const entry = entryOf(features.weaponTraining);
    const paragraphs = bodyParagraphs(
      (await pinnedRecord(features.weaponTraining)).description,
    );
    const prd = await Promise.all(
      Array.from({ length: 18 }, async (_, index) =>
        prdText(await pinnedLine('prd', FIGHTER_PRD, 385 + index)),
      ),
    );
    expect(paragraphs[0]).toBe(prd[0]);
    expect(paragraphs[1]).toBe(prd[1]?.replace('(9th,', '(9th*,'));
    expect(paragraphs[2]?.replaceAll('’', "'")).toBe(
      prd[2]?.replace('weapons from this group.', 'weapons from his group.'),
    );
    // The Notes are the three rules paragraphs; the group lists stay in the description.
    expect(entry.situationalNotes?.map((note) => note.text)).toEqual(
      paragraphs.slice(0, 3),
    );
    expect(entry.modifiers).toEqual([]);
    // Groups the CRB doesn't have (their PCGen rows are cases above).
    for (const group of ['Firearms', 'Siege engines', 'Tribal']) {
      expect(paragraphs.some((text) => text.startsWith(`${group}:`))).toBe(
        true,
      );
      expect(prd.some((text) => text.startsWith(`${group}:`))).toBe(false);
    }
    // Spiked shield is CRB: the PRD's Close group lists it.
    expect(prd.find((text) => text.startsWith('Close:'))).toContain(
      'spiked shield',
    );
  });

  it('Bravery: the Will context note’s record gives one Modifier on the shared fear Situation, no Note, and its body against the PRD line (636:42)', async () => {
    const entry = entryOf(features.bravery);
    const { description, notes } = await curatedRecords(features.bravery);
    // The description is covered by the note record; it adds nothing itself.
    expect(description.outputs).toEqual([]);
    expect(notes[0]).toMatchObject({
      kind: 'note',
      target: 'will',
      text: '+[[floor((@class.level + 2) / 4)]] vs fear effects',
      textSha256:
        '9a041362ac6d0436a9b74fc9fc3906b251c72d1a0823697736b6ae66e4fdb239',
      outputs: [
        {
          kind: 'modifier',
          target: 'save.will',
          bonusType: 'untyped',
          value: { formula: 'floor((@classLevel.fighter + 2) / 4)' },
          condition: { situation: 'fear' },
        },
      ],
    });
    expect(entry.modifiers).toEqual([
      {
        target: 'save.will',
        bonusType: 'untyped',
        value: { formula: 'floor((@classLevel.fighter + 2) / 4)' },
        condition: { situation: 'fear' },
      },
    ]);
    expect(entry.situationalNotes ?? []).toEqual([]);
    // The raw context note no longer lacks a record.
    expect(entry.unsupported.map((row) => row.field)).toEqual(['gameContent']);
    expect(prdText(await pinnedLine('prd', FIGHTER_PRD, 382))).toBe(
      'Starting at 2nd level, a fighter gains a +1 bonus on Will saves against fear. This bonus increases by +1 for every four levels beyond 2nd.',
    );
  });

  it('Bravery: the listed Will bonus against fear at every Fighter level through the public resolver, outside totals (636:95)', () => {
    const entry = entryOf(features.bravery);
    const modifierSchema = z.strictObject({
      target: z.enum(catalogModifierTargets).exclude(['ability.$choice']),
      bonusType: z.enum(personalBonusTypes),
      value: z.union([z.number(), z.strictObject({ formula: z.string() })]),
      condition: modifierConditionSchema.optional(),
    });
    const bravery = entry.modifiers.map((raw) => ({
      ...modifierSchema.parse(raw),
      sheetEntryId: entry.externalKey,
      catalogEntryId: entry.externalKey,
      source: entry.externalKey,
      entryName: entry.name,
      builtIn: false,
    }));
    for (const level of LEVELS) {
      const value = BRAVERY_VALUES[level - 1];
      const options = { classLevels: { fighter: level } };
      const plain = resolveSheet(bravery, options)['save.will'];
      expect(plain.total, `level ${level}`).toBe(0);
      expect(
        plain.conditional.map((row) => row.value),
        `level ${level}`,
      ).toEqual([value]);
      expect(
        resolveSheet(bravery, { ...options, situations: ['fear'] })['save.will']
          .total,
        `level ${level}`,
      ).toBe(value);
    }
    // Another class's levels add nothing.
    expect(
      resolveSheet(bravery, {
        classLevels: { barbarian: 20 },
        situations: ['fear'],
      })['save.will'].total,
    ).toBe(0);
  });

  it('Armor Training (Heavy Armor): heavy-armor speed from 7th level is its Note, with no Modifier, and its body ends the PRD line (637:20)', async () => {
    const entry = entryOf(features.armorTrainingHeavy);
    const [sentence] = bodyParagraphs(
      (await pinnedRecord(features.armorTrainingHeavy)).description,
    );
    expect(sentence).toBe(
      'At 7th level, a fighter can move at his normal speed while wearing heavy armor.',
    );
    expect(prdText(await pinnedLine('prd', FIGHTER_PRD, 384))).toMatch(
      new RegExp(`${sentence}$`),
    );
    expect(entry.modifiers).toEqual([]);
    expect(entry.situationalNotes?.map((note) => note.text)).toEqual([
      sentence,
    ]);
  });
});

describe('the other features’ own facts', () => {
  it('AC Bonus (MNK): each emitted Modifier’s formula, through the sheet’s evaluator, gives the listed bonus at every level of each Monk, the higher counting (607:36)', () => {
    const formulas = entryOf(features.acBonus).modifiers.map(
      (modifier) => (modifier.value as { formula: string }).formula,
    );
    expect(formulas).toHaveLength(2);
    for (const formula of formulas) {
      for (const tag of ['monk', 'monkUnchained'])
        expect(
          LEVELS.map((level) => formulaAt(formula, { [tag]: level })),
          tag,
        ).toEqual(AC_BONUS_VALUES);
      expect(formulaAt(formula, { monk: 8, monkUnchained: 4 })).toBe(2);
    }
  });

  it('AC Bonus (MNK): its Note’s first sentence is the body’s second paragraph’s, the rulebook’s (607:36)', async () => {
    const paragraphs = ruleParagraphs(
      (await pinnedRecord(features.acBonus)).description,
    );
    // The Note's first sentence is the rulebook's (PRD monk.html:384).
    expect(paragraphs[1]).toContain(AC_BONUS_NOTE.split(' The sheet')[0]);
  });

  it('Studied Target: Sense Motive comes from the description record, since the body names it and no Foundry note targets it, and its action has Unchained metadata (619:68)', async () => {
    const { record, description } = await pinnedRecord(features.studiedTarget);
    expect(description).toContain(
      'Bluff, Knowledge, Perception, Sense Motive, and Survival checks',
    );
    const notes = record.system.contextNotes as { target: string }[];
    expect(notes.map((note) => note.target)).not.toContain('skill.sen');
    expect(
      (await curatedRecords(features.studiedTarget)).description.outputs,
    ).toEqual([
      {
        kind: 'modifier',
        target: 'skill.sen',
        bonusType: 'untyped',
        value: { formula: STUDIED_FORMULA },
        condition: { situation: STUDIED_SITUATION },
      },
    ]);
    expect(record.system.actions).toEqual([
      expect.objectContaining({
        activation: { type: 'move', unchained: { type: 'action' } },
      }),
    ]);
  });

  it('Channel Energy: its pinned actions carry an Unchained two-action cost (639:22)', async () => {
    const { record } = await pinnedRecord(features.channelEnergy);
    expect(JSON.stringify(record.system.actions)).toContain(
      '"unchained":{"cost":2,"type":"action"}',
    );
  });
});
