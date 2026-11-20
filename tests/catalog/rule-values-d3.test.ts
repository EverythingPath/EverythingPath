// @vitest-environment node
// stats-d3 (PRD #251; GLOSSARY: Per-day maximum; owner 2026-11-17: the
// maximum only, no tally, no uses remaining, no reset): the per-day
// rule-value records that put per-day maxima on the launch classes' real
// rows, and the increases (Extra Channel …) that raise them. Written drafted;
// the record step checked nine on a captured review (run
// t3-review-b9b39010…), so as committed those nine give their entries their
// maxima and the other 21 change nothing, and no party character shows a
// per-day maximum; checked in memory, all 30 give each party character the
// maxima of the boundary (ORCH stats-d3/boundary.md). Characters are numbers
// (party-builds.json); every case runs on the pinned tree.
import { readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { afterAll, describe, expect, it } from 'vitest';
import {
  hashText,
  listRuleValueReviews,
  type RuleValueRecord,
} from '../../scripts/catalog/curation';
import { importCatalog } from '../../scripts/catalog/import';
import { pcgenPin } from '../../scripts/catalog/inventory';
import { pcgenOwnerSelection } from '../../scripts/catalog/pcgen-owners';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import {
  calculateCharacterSheet,
  type RuleValue,
} from '../../src/lib/character-sheet';
import { dragonDiscipleSheetFiles } from '../fixtures/pcgen-716/dragon-disciple-sheet-files';
import {
  ownerEmissionFoundryFiles,
  pcgenOwnerEmissionFiles,
} from '../fixtures/pcgen-716/owner-emission-files';
import { materializePinnedTree } from './pinned-sources';
import {
  character,
  type Artifact,
  type CharacterOptions,
  type ClassLevels,
} from './rule-value-sheets';

const classes = {
  alchemist: 'pf1/JcaqlAawhf14q1lq',
  barbarian: 'pf1/g3pq7xWWdUVYw6ai',
  bard: 'pf1/6GjOjO6r3R06fLwE',
  bloodrager: 'pf1/E27lMw9YNOAjS009',
  cavalier: 'pf1/u1ed3H9xtYQXTP5v',
  cleric: 'pf1/SjFqQceVeVBzBwgn',
  dragonDisciple: 'everythingpath/dragon-disciple',
  inquisitor: 'pf1/Fv3FbmXptuDRiL5y',
  magus: 'pf1/xZLcyrEKYZoJPS2k',
  monk: 'pf1/W8dxwZ1CZiwLKsqr',
  unchainedMonk: 'pf1/5mQIOIw4hDhlREPo',
  paladin: 'pf1/ohptcds1d5oG6Bjh',
  slayer: 'pf1/cOY76lMUkupH534m',
  summoner: 'pf1/BrnHPJ2EVSQSyNQ8',
  wizard: 'pf1/0c4lYDywj6bQ0i8r',
} as const;
const archetypes = {
  bladebound: 'everythingpath/magus-bladebound',
  ecclesitheurge: 'everythingpath/cleric-ecclesitheurge',
  exploiter: 'everythingpath/wizard-exploiter-wizard',
  madDog: 'everythingpath/barbarian-mad-dog',
  scaledFist: 'everythingpath/monk-scaled-fist',
} as const;
const feats = {
  extraArcanePool: 'pf1/3lfNiysSNv1ahV4F',
  extraChannel: 'pf1/pgRX4VpFemwv9R0E',
  extraKi: 'pf1/PGTjF7uoFx7wP1WO',
  extraLayOnHands: 'pf1/RDgJ7awoKBhacWsu',
  extraPerformance: 'pf1/6yGoL82RidBHmXPb',
  extraRage: 'pf1/oP4Srsuk0dF2Zf9F',
} as const;
/**
 * Foundry's Bear's Endurance buff, +4 enhancement to Constitution: the
 * temporary increase the rage text names beside rage's own (PRD
 * barbarian.html:382). Foundry's Rage buff imports as a class feature, not a
 * Temporary Effect, so this test raises Constitution with the spell.
 */
const bearsEndurance = 'pf1/lV9zpEnZrArmfEFZ';

const maximum = (
  key: string,
  unit: 'uses' | 'rounds' | 'points',
  amount: RuleValue['amount'],
): RuleValue => ({ kind: 'dailyMaximum', key, unit, amount });
const formula = (text: string) => ({ formula: text });
const increase = (key: string, amount: number): RuleValue => ({
  kind: 'dailyMaximumIncrease',
  key,
  amount,
});

/** The records' values as the boundary's rows give them (ORCH stats-d3/boundary.md). */
const expected: readonly (readonly [string, ...RuleValue[]])[] = [
  [
    'everythingpath/barbarian-mad-dog-rage',
    maximum(
      'classFeat_rage',
      'rounds',
      formula('4 + @ability.con.mod + 2 * (@classLevel.barbarian - 4)'),
    ),
  ],
  [
    'everythingpath/magus-bladebound-arcane-pool',
    maximum(
      'classFeat_arcanePool',
      'points',
      formula(
        'max(1, floor(@classLevel.magus / 3)) + max(0, @ability.int.mod)',
      ),
    ),
  ],
  [
    'pf1/2TsDfK0SKC8IGVx4',
    maximum('classFeat_smiteEvil', 'uses', { rows: {} }),
  ],
  [
    'pf1/2ausI8g6SsmbOpgF',
    maximum(
      'classFeat_stunningFist',
      'uses',
      formula(
        'max(@classLevel.monk, @classLevel.monkUnchained) + floor((@hitDice - max(@classLevel.monk, @classLevel.monkUnchained)) / 4)',
      ),
    ),
  ],
  [feats.extraArcanePool, increase('classFeat_arcanePool', 2)],
  [
    'pf1/5op6M5xchCJNsYRt',
    maximum(
      'classFeat_bloodrage',
      'rounds',
      formula('4 + @ability.con.mod + 2 * (@classLevel.bloodrager - 1)'),
    ),
  ],
  [feats.extraPerformance, increase('classFeat_bardicPerformance', 6)],
  [
    'pf1/7BfYNNkYjjBevun8',
    maximum(
      'classFeat_kiPoolUc',
      'points',
      formula('floor(@classLevel.monkUnchained / 2) + @ability.wis.mod'),
    ),
  ],
  [
    'pf1/7gHiZBNHjwefbBLI',
    maximum(
      'classFeat_bomb',
      'uses',
      formula('max(0, @classLevel.alchemist + @ability.int.mod)'),
    ),
  ],
  [
    'pf1/Aj7SwIo94HfcpR9R',
    maximum('classFeat_bondSenses', 'rounds', formula('@classLevel.summoner')),
  ],
  [
    'pf1/CW99G919xJkrIWAu',
    maximum('classFeat_mergeForms', 'rounds', formula('@classLevel.summoner')),
  ],
  [
    'pf1/Jw6BEoNMBxfSN4cu',
    maximum(
      'classFeat_makersCall',
      'uses',
      formula('floor((@classLevel.summoner - 2) / 4)'),
    ),
  ],
  [
    'pf1/MpvhQz62qw68D2pd',
    maximum('classFeat_bane', 'rounds', formula('@classLevel.inquisitor')),
  ],
  [
    feats.extraKi,
    increase('classFeat_kiPool', 2),
    increase('classFeat_kiPoolUc', 2),
  ],
  [feats.extraLayOnHands, increase('classFeat_layOnHands', 2)],
  [
    'pf1/S9lYCsz7oA7v3GzR',
    maximum(
      'classFeat_discernLies',
      'rounds',
      formula('@classLevel.inquisitor'),
    ),
  ],
  [
    'pf1/WNi2SBF6Z2zhBMCl',
    maximum('classFeat_challengeCav', 'uses', { rows: {} }),
  ],
  [
    'pf1/WSqWT9ZIshtC5vlV',
    maximum(
      'classFeat_rage',
      'rounds',
      formula('4 + @ability.con.mod + 2 * (@classLevel.barbarian - 1)'),
    ),
  ],
  [
    'pf1/WhE4j0Jc82npdMCP',
    maximum(
      'classFeat_layOnHands',
      'uses',
      formula('floor(@classLevel.paladin / 2) + @ability.cha.mod'),
    ),
  ],
  [
    'pf1/YKyAQ2o5Yzox79B8',
    maximum(
      'classFeat_tactician',
      'uses',
      formula('1 + floor(@classLevel.cavalier / 5)'),
    ),
  ],
  [
    'pf1/ZfCUTi1MiLgR4T7I',
    maximum(
      'classFeat_bardicPerformance',
      'rounds',
      formula('4 + @ability.cha.mod + 2 * (@classLevel.bard - 1)'),
    ),
  ],
  [
    'pf1/caNEmbCtoHA7NYtZ',
    maximum(
      'classFeat_summonMonster',
      'uses',
      formula('max(0, 3 + @ability.cha.mod)'),
    ),
  ],
  [
    'pf1/kXXz1lO4i7CibHJ9',
    maximum('classFeat_channelEnergy', 'uses', formula('3 + @ability.cha.mod')),
  ],
  [
    'pf1/mpe3JHJMINddqLWr',
    maximum(
      'classFeat_arcanePool',
      'points',
      formula('max(1, floor(@classLevel.magus / 2)) + @ability.int.mod'),
    ),
  ],
  [
    'pf1/msQWK7TW7mufzf8l',
    maximum('classFeat_loreMaster', 'uses', { rows: {} }),
  ],
  ['pf1/n4SWyKVcdmZK4t7d', maximum('classFeat_quiveringPalm', 'uses', 1)],
  [
    feats.extraRage,
    increase('classFeat_rage', 6),
    increase('classFeat_bloodrage', 6),
  ],
  [feats.extraChannel, increase('classFeat_channelEnergy', 2)],
  ['pf1/qI4IouTn4uvDPSXv', maximum('classFeat_judgment', 'uses', { rows: {} })],
  [
    'pf1/yotHT522pQoKDhID',
    maximum(
      'classFeat_slayersAdvance',
      'uses',
      formula('1 + min(1, floor(@classLevel.slayer / 17))'),
    ),
  ],
];

const perDayKinds = new Set(['dailyMaximum', 'dailyMaximumIncrease']);
const isPerDay = ({ outputs }: RuleValueRecord) =>
  outputs.every(({ ruleValue }) => perDayKinds.has(ruleValue.kind));
const allRecords = reviewedCuration.ruleValues ?? [];
const committed = allRecords.filter(isPerDay);
/**
 * How a held record's rationale starts: the hold, the round that held it
 * (fix r1: the records no landed kind or formula gives correctly; fix r3: the
 * ten the first promotion review refused; phase 2: Lore Master, which the
 * second refused), then its reason.
 */
const heldPattern =
  /^Held, not for promotion \(stats-d3 (?:fix r[13]|phase 2)\): /;
const isHeld = ({ rationale }: RuleValueRecord) => heldPattern.test(rationale);

const foundry = (path: string) => `pf1/packs/${path}.yaml`;
const tree = await materializePinnedTree([
  ...new Set([
    ...ownerEmissionFoundryFiles,
    ...dragonDiscipleSheetFiles,
    ...[
      'classes/alchemist.JcaqlAawhf14q1lq',
      'classes/bard.6GjOjO6r3R06fLwE',
      'classes/cavalier.u1ed3H9xtYQXTP5v',
      'classes/inquisitor.Fv3FbmXptuDRiL5y',
      'classes/monk-unchained.5mQIOIw4hDhlREPo',
      'classes/paladin.ohptcds1d5oG6Bjh',
      'classes/slayer.cOY76lMUkupH534m',
      'classes/summoner.BrnHPJ2EVSQSyNQ8',
      'class-abilities/bane.MpvhQz62qw68D2pd',
      'class-abilities/bardic-performance.ZfCUTi1MiLgR4T7I',
      'class-abilities/bomb.7gHiZBNHjwefbBLI',
      'class-abilities/bond-senses.Aj7SwIo94HfcpR9R',
      'class-abilities/challenge-cav.WNi2SBF6Z2zhBMCl',
      'class-abilities/channel-positive-energy.tHObxrPeyhimmz9V',
      'class-abilities/discern-lies.S9lYCsz7oA7v3GzR',
      'class-abilities/judgment.qI4IouTn4uvDPSXv',
      'class-abilities/ki-pool.2Og23i3rRXu5QQlg',
      'class-abilities/ki-pool-uc.7BfYNNkYjjBevun8',
      'class-abilities/lay-on-hands.WhE4j0Jc82npdMCP',
      'class-abilities/lore-master.msQWK7TW7mufzf8l',
      'class-abilities/maker-s-call.Jw6BEoNMBxfSN4cu',
      'class-abilities/merge-forms.CW99G919xJkrIWAu',
      'class-abilities/slayer-s-advance.yotHT522pQoKDhID',
      'class-abilities/smite-evil.2TsDfK0SKC8IGVx4',
      'class-abilities/summon-monster.caNEmbCtoHA7NYtZ',
      'class-abilities/tactician.YKyAQ2o5Yzox79B8',
      'buffs/bear-s-endurance.lV9zpEnZrArmfEFZ',
      'feats/extra-arcane-pool.3lfNiysSNv1ahV4F',
      'feats/extra-channel.pgRX4VpFemwv9R0E',
      'feats/extra-ki.PGTjF7uoFx7wP1WO',
      'feats/extra-lay-on-hands.RDgJ7awoKBhacWsu',
      'feats/extra-performance.6yGoL82RidBHmXPb',
      'feats/extra-rage.oP4Srsuk0dF2Zf9F',
      // The records their descriptions link to, so each description reads
      // as the whole corpus imports it (the hash the records bind).
      'buffs/rage.UgjpRD8vtiSWRxuL',
      'feats/point-blank-shot.8rsFtye3PwM6CKli',
      'feats/stunning-fist.GsjouI6B8X7BA5wN',
      'feats/vital-strike.26k1Gi7t5BoqxhIj',
      'feats/weapon-focus.n250dFlbykAIAg5Z',
      'spells/bear-s-endurance.usdv1eqvibmxun6x',
      'spells/dimension-door.ojwg1ki98tq8xyh9',
      'spells/discern-lies.9vdjohbrj896e2ot',
      'spells/gate.ursm11405zobemi3',
      'spells/summon-monster-i.kyo0kwhw2jhuztju',
      'spells/summon-monster-ix.mi52crelhwuy6bmp',
    ].map(foundry),
    ...pcgenOwnerEmissionFiles.map(
      (path) => `pcgen/${pcgenPin.directory}/${path}`,
    ),
  ]),
]);
afterAll(() => tree.dispose());
const remaps: unknown = JSON.parse(
  await readFile('scripts/catalog/reviewed-remaps.json', 'utf8'),
);

/** The import with the committed records, the per-day ones replaced by `perDay`. */
const emit = (perDay: readonly RuleValueRecord[]) =>
  importCatalog({
    systemPath: tree.systemPath,
    contentPath: tree.contentPath,
    remaps,
    curation: {
      ...reviewedCuration,
      ruleValues: [
        ...allRecords.filter((record) => !isPerDay(record)),
        ...perDay,
      ],
    },
    pcgen: { path: tree.pcgenPath, selection: pcgenOwnerSelection },
    // A partial pinned tree, not the verified whole corpus.
    wholeCorpus: false,
  });

/** The committed per-day records checked in memory under a placeholder receipt. */
const checkedInMemory = committed.map(
  ({
    externalKey,
    descriptionSha256,
    outputs,
    rationale,
  }): RuleValueRecord => ({
    externalKey,
    descriptionSha256,
    outputs,
    rationale,
    status: 'checked',
    reviewedBy: 'in-memory check (rule-values-d3.test.ts)',
    reviewedOn: '2026-11-18',
    receipt: `t3-review-${'0'.repeat(64)}`,
  }),
);
const without = await emit([]);
const asCommitted = await emit(committed);
const checked = await emit(checkedInMemory);
/**
 * Only the records for promotion checked in memory (fix r2; fix r3, phase 2:
 * the nine the promotion review confirmed): what the record step gives, the
 * committed state. The held ones stay drafted, as committed.
 */
const forPromotion = checkedInMemory.filter((record) => !isHeld(record));
const promoted = await emit([...committed.filter(isHeld), ...forPromotion]);

/** Ability scores other than 10: Con 14 (+2), Int 16 (+3), Wis 12 (+1), Cha 18 (+4). */
const scores = {
  constitution: 14,
  intelligence: 16,
  wisdom: 12,
  charisma: 18,
} as const;

/** The sheet's per-day maxima, each with its entry's catalog name. */
function sheetMaxima(
  artifact: Artifact,
  levels: ClassLevels,
  options: Parameters<typeof character>[2] & object = {},
) {
  const result = calculateCharacterSheet(
    character(artifact, levels, {
      ...options,
      scores: { ...scores, ...options.scores },
    }),
  );
  const names = new Map(
    result.resolvedEntries.map(({ entry }) => [
      entry._id,
      'catalogEntryId' in entry ? entry.catalogEntryId : entry._id,
    ]),
  );
  return result.dailyMaxima.map((maximum) => ({
    ...maximum,
    name: names.get(maximum.entryId),
  }));
}

/** Each per-day maximum as "<entry name> <value> <unit>". */
function maxima(...args: Parameters<typeof sheetMaxima>) {
  return sheetMaxima(...args)
    .map(({ name, value, unit }) => `${name} ${value} ${unit}`)
    .sort();
}

/** Each floored per-day maximum as "<entry name> <sum>" (rotation-5). */
function floors(...args: Parameters<typeof sheetMaxima>) {
  return sheetMaxima(...args)
    .flatMap(({ name, floor }) => (floor ? [`${name} ${floor.sum}`] : []))
    .sort();
}
const feat = (catalogEntryId: string) =>
  ({ catalogEntryId, kind: 'feat' }) as const;

/**
 * The records held from promotion, each saying why first in its rationale
 * (`heldPattern`): drafted, they give nothing; they are not for the record
 * step.
 */
const held = [
  feats.extraChannel,
  feats.extraRage,
  // An ability modifier can take these below 0, and an increase names their
  // key: the formula grammar's `max` clamps only inside the record's own
  // amount, so a clamp of the whole amount at 0 would add a negative amount's
  // increase in full. A minimum the rules state on a component (the Magus's
  // half level, magus.html:395) stays in the formula. The sheet
  // floors the raw sum after the increases (rotation-5); promoting these on
  // that floor is a later data slice.
  'pf1/kXXz1lO4i7CibHJ9',
  'pf1/WSqWT9ZIshtC5vlV',
  'everythingpath/barbarian-mad-dog-rage',
  'pf1/5op6M5xchCJNsYRt',
  'pf1/ZfCUTi1MiLgR4T7I',
  'pf1/mpe3JHJMINddqLWr',
  'pf1/WhE4j0Jc82npdMCP',
  'pf1/7BfYNNkYjjBevun8',
  // stats-d3 fix r3, refused by the promotion review: an archetype or a
  // second class keeps the entry and changes its uses, so the shared record
  // is wrong for that character (ORCH stats-d3/followups.md §5) …
  'everythingpath/magus-bladebound-arcane-pool',
  'pf1/2TsDfK0SKC8IGVx4',
  'pf1/2ausI8g6SsmbOpgF',
  'pf1/7gHiZBNHjwefbBLI',
  'pf1/YKyAQ2o5Yzox79B8',
  'pf1/n4SWyKVcdmZK4t7d',
  // phase 2, refused by the second promotion review: the Solacer keeps Lore
  // Master and alters it, its Learned Physician giving one use a day.
  'pf1/msQWK7TW7mufzf8l',
  // … or an increase whose maximums are all held or left out raises nothing.
  feats.extraArcanePool,
  feats.extraPerformance,
  feats.extraKi,
  feats.extraLayOnHands,
];
/** The captured review the record step checked the nine on. */
const recordStepRun =
  't3-review-b9b390102ed6d3c97affa618747d99f5f5d908d77fabea28e6ad28636350f4b6';
/**
 * The nine the second promotion review confirmed, which the record step
 * checked (`recordStepRun`).
 */
const confirmed: readonly string[] = [
  'pf1/Aj7SwIo94HfcpR9R',
  'pf1/CW99G919xJkrIWAu',
  'pf1/Jw6BEoNMBxfSN4cu',
  'pf1/MpvhQz62qw68D2pd',
  'pf1/S9lYCsz7oA7v3GzR',
  'pf1/WNi2SBF6Z2zhBMCl',
  'pf1/caNEmbCtoHA7NYtZ',
  'pf1/qI4IouTn4uvDPSXv',
  'pf1/yotHT522pQoKDhID',
];

const byKey = ([a]: readonly unknown[], [b]: readonly unknown[]) =>
  String(a) < String(b) ? -1 : 1;

describe('the stats-d3 per-day records', () => {
  it('hold exactly the records no landed kind or formula can give correctly and those the promotion review refused, each saying why first in its rationale', () => {
    expect(
      committed
        .filter(isHeld)
        .map(({ externalKey }) => externalKey)
        .sort(),
    ).toEqual([...held].sort());
  });

  it('are committed with exactly the boundary’s values, one per-day record per entry, the nine confirmed checked by the record step and the rest drafted, each bound to its entry’s current description', () => {
    expect(
      committed.map(({ externalKey, outputs }) => [
        externalKey,
        ...outputs.map(({ ruleValue }) => ruleValue),
      ]),
    ).toEqual(expected);
    expect(
      committed.flatMap((record) =>
        record.status === 'checked'
          ? [
              {
                externalKey: record.externalKey,
                reviewedBy: record.reviewedBy,
                reviewedOn: record.reviewedOn,
                receipt: record.receipt,
              },
            ]
          : [],
      ),
    ).toEqual(
      [...confirmed].sort().map((externalKey) => ({
        externalKey,
        // The record step's label for the run's reviewer, one for all nine
        // (below); the agent-launch guard allows the reviewer's name only in
        // the record files.
        reviewedBy: expect.any(String),
        reviewedOn: '2026-11-18',
        receipt: recordStepRun,
      })),
    );
    expect(
      new Set(
        committed.flatMap((record) =>
          record.status === 'checked' ? [record.reviewedBy] : [],
        ),
      ).size,
    ).toBe(1);
    expect(
      committed
        .filter(({ status }) => status !== 'checked')
        .map(({ externalKey, status }) => [externalKey, status]),
    ).toEqual(
      committed
        .filter(({ externalKey }) => !confirmed.includes(externalKey))
        .map(({ externalKey }) => [externalKey, 'drafted']),
    );
    for (const record of committed) {
      const entry = checked.catalog.entries.find(
        ({ externalKey }) => externalKey === record.externalKey,
      );
      expect(entry && hashText(entry.description), record.externalKey).toBe(
        record.descriptionSha256,
      );
    }
  });

  it('as committed, the nine checked give their entries their maxima and the 21 drafted nothing: the entries are those with only the nine checked in memory, so character 3 keeps its 4d6 and shows no per-day maximum', () => {
    expect(asCommitted.catalog.entries).toEqual(promoted.catalog.entries);
    expect(
      asCommitted.catalog.entries
        .filter(
          (entry, index) =>
            !isDeepStrictEqual(entry, without.catalog.entries[index]),
        )
        .map(({ externalKey, ruleValues }) => [externalKey, ruleValues])
        .sort(byKey),
    ).toEqual(
      expected
        .filter(([key]) => confirmed.includes(key))
        .map(([key, ...values]) => [key, values])
        .sort(byKey),
    );
    // The emitted overlay holds the other records first (emit), then these.
    expect(
      asCommitted.curation.ruleValues?.slice(
        allRecords.length - committed.length,
      ),
    ).toEqual(
      committed.map(({ externalKey }) => ({
        externalKey,
        status: confirmed.includes(externalKey) ? 'applied' : 'drafted',
      })),
    );
    const three = calculateCharacterSheet(
      character(asCommitted, [[classes.cleric, 8]], {
        scores,
        rows: [feat(feats.extraChannel)],
      }),
    );
    expect(three.dailyMaxima).toEqual([]);
    expect(
      three.featureNumbers.map(({ count, die }) => `${count}d${die}`),
    ).toEqual(['4d6']);
  });

  it('checked in memory, apply to their entries and to no row, keeping the checked dice first', () => {
    const carrying = checked.catalog.entries.filter(({ externalKey }) =>
      committed.some((record) => record.externalKey === externalKey),
    );
    expect(carrying.map(({ externalKey }) => externalKey).sort()).toEqual(
      expected.map(([key]) => key).sort(),
    );
    expect(
      checked.catalog.entries.find(
        ({ externalKey }) => externalKey === 'pf1/kXXz1lO4i7CibHJ9',
      )?.ruleValues,
    ).toEqual([
      { kind: 'dice', die: 6, amount: { rows: {} } },
      maximum(
        'classFeat_channelEnergy',
        'uses',
        formula('3 + @ability.cha.mod'),
      ),
    ]);
  });
});

/**
 * The pairings guard (stats-d3 fix r7, r8): a pinned, reviewed list, not a proof.
 * The sheet adds a per-day maximum's own amount and every increase on its key
 * (the raw sum) and shows that sum floored at 0 after the increases
 * (`resolveDailyMaxima`, rotation-5), the floored maximum carrying the raw sum
 * (`floor: { sum }`) for its chip: a Magus 1 with Intelligence 1 and Extra
 * Arcane Pool, checked in memory, has a raw sum of −4 + 2 = −2 and shows
 * "0 points/day" beside "Floored at 0 (sum −2)". The floor at 0 is this
 * project's calculation decision (root, 2026-11-18: a negative count is not
 * a number of uses), not the rules'; a minimum the rules state for a
 * component (the Magus's half level, the Bladebound's third of its level and
 * Intelligence bonus) stays in the formula; no formula of the eight held
 * below 0 clamps its total, and of them only the Magus's has a component
 * minimum. Whether the raw sum is the rules' total is a review
 * judgement, not a reading of the formula: a maximum whose own formula clamps
 * its amount at a low ability score (`max(0, 3 + @ability.cha.mod)`) under an
 * increase shows more than the raw sum floored at 0 (Charisma 1 and an
 * increase of 2: 2, where the raw sum is 0). So every pairing in the
 * committed records of a maximum with an increase on its key, whatever
 * either record's status, is listed here with both records' full IDs
 * (description hash included), its maximum's exact amount, its increase's
 * amount and the reason the displayed maximum is right. The records'
 * pairings (every maximum output on a key with every increase output on it,
 * each occurrence counted) must equal the list as multisets, element for
 * element (fix r8), and a record giving two outputs of one kind on one key
 * fails by itself.
 */
type Pairing = {
  key: string;
  maximum: { id: string; amount: RuleValue['amount'] };
  increase: { id: string; amount: RuleValue['amount'] };
  reason: string;
};
/** Each pairing a review has passed, with the reason its displayed maximum is right. */
const reviewedPairings: readonly Pairing[] = [
  {
    key: 'classFeat_arcanePool',
    maximum: {
      id: 'rule-value everythingpath/magus-bladebound-arcane-pool per-day sha256:8e8bd3af93c7334f1447440e77d06494390ff0135912dcffcb198c68c8d0fbf9',
      amount: formula(
        'max(1, floor(@classLevel.magus / 3)) + max(0, @ability.int.mod)',
      ),
    },
    increase: {
      id: 'rule-value pf1/3lfNiysSNv1ahV4F per-day sha256:54e85a6f7896ad1787541049446cd11a96adc2c65bed78f3b57335735898f813',
      amount: 2,
    },
    reason:
      'The pool is "1/3 his level (minimum 1) plus his Intelligence bonus" (PRD ultimateMagic/spellcastingClassOptions/magus.html:368), and a bonus is never below 0, so the formula clamps a component, as the text does, and not the total; Extra Arcane Pool\'s "Your arcane pool increases by 2", whose effects stack (pf1 packs/feats/extra-arcane-pool.3lfNiysSNv1ahV4F.yaml:13-15), adds after that sum, as the sheet does: at least 1, plus 2 per copy. Whether a pool the black blade refills during the day is a per-day maximum is held (its rationale).',
  },
  {
    key: 'classFeat_arcanePool',
    maximum: {
      id: 'rule-value pf1/mpe3JHJMINddqLWr per-day sha256:444a97162ea55031babc41172a6616589a1e48bdeedd001c389cca5da5e6a6f3',
      amount: formula(
        'max(1, floor(@classLevel.magus / 2)) + @ability.int.mod',
      ),
    },
    increase: {
      id: 'rule-value pf1/3lfNiysSNv1ahV4F per-day sha256:54e85a6f7896ad1787541049446cd11a96adc2c65bed78f3b57335735898f813',
      amount: 2,
    },
    reason:
      'The pool is "1/2 his magus level (minimum 1) + his Intelligence modifier" (PRD ultimateMagic/spellcasters/magus.html:395), the minimum of the half level only, which the formula keeps on that component (max(1, …)) and which stays: without it a Magus 1 with Intelligence 10 and Extra Arcane Pool would have 2 points, not 3; the formula has no clamp of the total, so its own amount plus 2 per copy of Extra Arcane Pool, whose effects stack (pf1 packs/feats/extra-arcane-pool.3lfNiysSNv1ahV4F.yaml:13-15), is the raw sum, below 0 included; the sheet floors that sum at 0 after the increases (rotation-5), a floor the formula does not carry, so the record, checked, would show 0 where the sum is below 0, with the raw sum on its chip. The record stays held and drafted, for the promotion review.',
  },
  {
    key: 'classFeat_bardicPerformance',
    maximum: {
      id: 'rule-value pf1/ZfCUTi1MiLgR4T7I per-day sha256:b05d04b283c5a7ce0fd8a77edd3da78882e9a8c4766ce457c7e81a700d788ae2',
      amount: formula('4 + @ability.cha.mod + 2 * (@classLevel.bard - 1)'),
    },
    increase: {
      id: 'rule-value pf1/6yGoL82RidBHmXPb per-day sha256:fa73afffdaca6959238c4bcf143474d9eea734b948f7248c2b34aa01926541b4',
      amount: 6,
    },
    reason:
      'The rounds are "4 + his Charisma modifier" and 2 more at each level after 1st (PRD coreRulebook/classes/bard.html:411), with no minimum, and the formula has no clamp, of its total or of a component, so its own amount plus 6 per copy of Extra Performance, whose effects stack (pf1 packs/feats/extra-performance.6yGoL82RidBHmXPb.yaml:17-19), is the raw sum, below 0 included; the sheet floors that sum at 0 after the increases (rotation-5), a floor the formula does not carry, so the record, checked, would show 0 where the sum is below 0, with the raw sum on its chip. The record stays held and drafted, for the promotion review.',
  },
  {
    key: 'classFeat_bloodrage',
    maximum: {
      id: 'rule-value pf1/5op6M5xchCJNsYRt per-day sha256:80a6a050fc4a4ad2b65b29b392b4420284b4eb56d2868e1b3a238691fee83664',
      amount: formula(
        '4 + @ability.con.mod + 2 * (@classLevel.bloodrager - 1)',
      ),
    },
    increase: {
      id: 'rule-value pf1/oP4Srsuk0dF2Zf9F per-day sha256:f724f2e704ebe84d7e2f5819b7c1838204873cee43cf64810a2bca2c58ed0277',
      amount: 6,
    },
    reason:
      'The rounds are "4 + his Constitution modifier" and 2 more at each level after 1st (PRD advancedClassGuide/classes/bloodrager.html:446), with no minimum, and the formula has no clamp, of its total or of a component; bloodrage counts as rage for feat abilities (bloodrager.html:449), so for a character without rage its own amount plus 6 per copy of Extra Rage, whose effects stack (pf1 packs/feats/extra-rage.oP4Srsuk0dF2Zf9F.yaml:12-14), is the raw sum, below 0 included; the sheet floors that sum at 0 after the increases (rotation-5), a floor the formula does not carry, so the record, checked, would show 0 where the sum is below 0, with the raw sum on its chip. The record stays held and drafted, for the promotion review. For a character with both rage and bloodrage the text does not say where the 6 rounds go, and the record gives 6 to each pool (held).',
  },
  {
    key: 'classFeat_channelEnergy',
    maximum: {
      id: 'rule-value pf1/kXXz1lO4i7CibHJ9 per-day sha256:fdc7bbf62cb44cb94f1e8fcf16f1f3d55179114a5b3321d8ea9bebf779e00b20',
      amount: formula('3 + @ability.cha.mod'),
    },
    increase: {
      id: 'rule-value pf1/pgRX4VpFemwv9R0E per-day sha256:9243d1ad9f68904c17f03433d2af6e00365e0736370787f72b1d7e435692afaf',
      amount: 2,
    },
    reason:
      'The uses are "3 + her Charisma modifier" (PRD coreRulebook/classes/cleric.html:391), with no minimum, and the formula has no clamp, of its total or of a component; an Extra Channel taken for the Cleric\'s channel gives "two additional times per day" (pf1 packs/feats/extra-channel.pgRX4VpFemwv9R0E.yaml:12-13; PCGen cr_abilities_class.lst:2890, Cleric Extra Channel), so for one such copy its own amount plus 2 is the raw sum, below 0 included (a Cleric 1 with Charisma 1 and Extra Channel: 0); the sheet floors that sum at 0 after the increases (rotation-5), a floor the formula does not carry, so the record, checked, would show 0 where the sum is below 0, with the raw sum on its chip (that Cleric without the feat: 0, "Floored at 0 (sum −2)"). The record stays held and drafted, for the promotion review. The sheet adds 2 for each copy, whichever class it was taken for (held: the sheet does not read the feat\'s choice), and for a second copy, which neither the feat\'s text nor PCGen (no MULT, cr_feats.lst:63) allows: a table override, not the rules\' total.',
  },
  {
    key: 'classFeat_kiPoolUc',
    maximum: {
      id: 'rule-value pf1/7BfYNNkYjjBevun8 per-day sha256:88eec54f6442914e7ada902f3c7f5d39e7ca0b0ee13476808ca3b6bb9c3451dc',
      amount: formula(
        'floor(@classLevel.monkUnchained / 2) + @ability.wis.mod',
      ),
    },
    increase: {
      id: 'rule-value pf1/PGTjF7uoFx7wP1WO per-day sha256:88efea71ca869ca8d6ae38a05f26bc65b72a76ed1c54da1473e801544d3475a4',
      amount: 2,
    },
    reason:
      'The pool is "1/2 his monk level + his Wisdom modifier" (PRD unchained/classes/monk.html:441), with no minimum, and the formula has no clamp, of its total or of a component, so its own amount plus 2 per copy of Extra Ki, whose effects stack (pf1 packs/feats/extra-ki.PGTjF7uoFx7wP1WO.yaml:15-17), is the raw sum, below 0 included; the sheet floors that sum at 0 after the increases (rotation-5), a floor the formula does not carry, so the record, checked, would show 0 where the sum is below 0, with the raw sum on its chip. The record stays held and drafted, for the promotion review.',
  },
  {
    key: 'classFeat_layOnHands',
    maximum: {
      id: 'rule-value pf1/WhE4j0Jc82npdMCP per-day sha256:2ae0ddd92f53b87791eb3cd190790cb457edfa48401eb652f7afd1c6b8ab4c60',
      amount: formula('floor(@classLevel.paladin / 2) + @ability.cha.mod'),
    },
    increase: {
      id: 'rule-value pf1/RDgJ7awoKBhacWsu per-day sha256:60ffc87038b367645fd4bc11bec950ae883c2e40548441cd3ea8161fe0aed1a6',
      amount: 2,
    },
    reason:
      'The uses are "1/2 her paladin level plus her Charisma modifier" (PRD coreRulebook/classes/paladin.html:389), with no minimum, and the formula has no clamp, of its total or of a component, so its own amount plus 2 per copy of Extra Lay On Hands, whose effects stack (pf1 packs/feats/extra-lay-on-hands.RDgJ7awoKBhacWsu.yaml:14-16), is the raw sum, below 0 included; the sheet floors that sum at 0 after the increases (rotation-5), a floor the formula does not carry, so the record, checked, would show 0 where the sum is below 0, with the raw sum on its chip. The record stays held and drafted, for the promotion review.',
  },
  {
    key: 'classFeat_rage',
    maximum: {
      id: 'rule-value everythingpath/barbarian-mad-dog-rage per-day sha256:c855a5268de38d772d6978430a930acab71ec7c0ebd90150e2392bf00c3d6108',
      amount: formula('4 + @ability.con.mod + 2 * (@classLevel.barbarian - 4)'),
    },
    increase: {
      id: 'rule-value pf1/oP4Srsuk0dF2Zf9F per-day sha256:f724f2e704ebe84d7e2f5819b7c1838204873cee43cf64810a2bca2c58ed0277',
      amount: 6,
    },
    reason:
      'The rounds are the barbarian\'s rage, "4 + her Constitution modifier" and 2 more at each level after 1st (PRD coreRulebook/classes/barbarian.html:382), at an effective barbarian level of her barbarian level - 3 (PCGen anar_abilities_class.lst:83), with no minimum, and the formula has no clamp, of its total or of a component, so for a character without bloodrage its own amount plus 6 per copy of Extra Rage, whose effects stack (pf1 packs/feats/extra-rage.oP4Srsuk0dF2Zf9F.yaml:12-14), is the raw sum, below 0 included; the sheet floors that sum at 0 after the increases (rotation-5), a floor the formula does not carry, so the record, checked, would show 0 where the sum is below 0, with the raw sum on its chip. The record stays held and drafted, for the promotion review. For a character with both rage and bloodrage the text does not say where the 6 rounds go, and the record gives 6 to each pool (held).',
  },
  {
    key: 'classFeat_rage',
    maximum: {
      id: 'rule-value pf1/WSqWT9ZIshtC5vlV per-day sha256:d669554c4ba24e588c4a5b1630116be75a10225ad66c84586745d0f52fde74f5',
      amount: formula('4 + @ability.con.mod + 2 * (@classLevel.barbarian - 1)'),
    },
    increase: {
      id: 'rule-value pf1/oP4Srsuk0dF2Zf9F per-day sha256:f724f2e704ebe84d7e2f5819b7c1838204873cee43cf64810a2bca2c58ed0277',
      amount: 6,
    },
    reason:
      'The rounds are "4 + her Constitution modifier" and 2 more at each level after 1st (PRD coreRulebook/classes/barbarian.html:382), with no minimum, and the formula has no clamp, of its total or of a component, so for a character without bloodrage its own amount plus 6 per copy of Extra Rage, whose effects stack (pf1 packs/feats/extra-rage.oP4Srsuk0dF2Zf9F.yaml:12-14), is the raw sum, below 0 included; the sheet floors that sum at 0 after the increases (rotation-5), a floor the formula does not carry, so the record, checked, would show 0 where the sum is below 0, with the raw sum on its chip. The record stays held and drafted, for the promotion review. For a character with both rage and bloodrage the text does not say where the 6 rounds go, and the record gives 6 to each pool (held).',
  },
];

type Paired = Omit<Pairing, 'reason'>;
/**
 * A record's full ID as the record step lists it (`rule-value <entry> per-day
 * sha256:<description hash>`), so a record rebound to a changed description
 * no longer matches its entry.
 */
function recordId(record: RuleValueRecord) {
  const [review] = listRuleValueReviews([record]);
  if (!review)
    throw new Error(`The record step lists no ID for ${record.externalKey}.`);
  return review.id;
}
/** Each per-day output of `records`, in record order, with its record's full ID. */
function perDayOutputs(records: readonly RuleValueRecord[]) {
  return records.flatMap((record) =>
    record.outputs.flatMap(({ ruleValue }) =>
      ruleValue.kind === 'dailyMaximum' ||
      ruleValue.kind === 'dailyMaximumIncrease'
        ? [{ id: recordId(record), ruleValue }]
        : [],
    ),
  );
}
/**
 * Every pairing in `records` of a maximum with an increase on its key, each
 * output counted: a maximum given twice pairs twice with each increase.
 */
function pairings(records: readonly RuleValueRecord[]): Paired[] {
  const values = perDayOutputs(records);
  return values.flatMap(({ id, ruleValue: maximum }) =>
    maximum.kind === 'dailyMaximum'
      ? values.flatMap(({ id: raiser, ruleValue: raise }) =>
          raise.kind === 'dailyMaximumIncrease' && raise.key === maximum.key
            ? [
                {
                  key: maximum.key,
                  maximum: { id, amount: maximum.amount },
                  increase: { id: raiser, amount: raise.amount },
                },
              ]
            : [],
        )
      : [],
  );
}
/**
 * Each record of `records` giving two outputs of one kind on one key: the
 * sheet would show a second maximum, or add an increase twice.
 */
function repeatedOutputs(records: readonly RuleValueRecord[]): string[] {
  return records.flatMap((record) => {
    const counts = new Map<string, number>();
    const id = recordId(record);
    for (const { ruleValue } of perDayOutputs([record])) {
      const at = `${ruleValue.kind} ${ruleValue.key}`;
      counts.set(at, (counts.get(at) ?? 0) + 1);
    }
    return [...counts].flatMap(([at, count]) => {
      if (count < 2) return [];
      const [kind, key] = at.split(' ');
      return [
        kind === 'dailyMaximum'
          ? `Repeated: ${id} gives ${count} per-day maxima on ${key}; the sheet would show each. An entry gives one maximum per key: remove the copies.`
          : `Repeated: ${id} gives ${count} increases on ${key}; the sheet would add each. Remove the copies.`,
      ];
    });
  });
}
/** A record ID's entry part, without its description hash: for diagnosis only. */
const entryOf = (id: string) => id.replace(/ sha256:[0-9a-f]{64}$/, '');
const sameIds = (a: Paired, b: Paired) =>
  a.key === b.key &&
  a.maximum.id === b.maximum.id &&
  a.increase.id === b.increase.id;
const sameEntries = (a: Paired, b: Paired) =>
  a.key === b.key &&
  entryOf(a.maximum.id) === entryOf(b.maximum.id) &&
  entryOf(a.increase.id) === entryOf(b.increase.id);
const sameAmounts = (a: Paired, b: Paired) =>
  isDeepStrictEqual(a.maximum.amount, b.maximum.amount) &&
  isDeepStrictEqual(a.increase.amount, b.increase.amount);
const samePairing = (a: Paired, b: Paired) =>
  sameIds(a, b) && sameAmounts(a, b);
const named = ({ key, maximum, increase }: Paired) =>
  `${increase.id} (${JSON.stringify(increase.amount)}) on ${key}, the key of ${maximum.id} (${JSON.stringify(maximum.amount)})`;
const whatToDo =
  "Have the pairing reviewed (is the raw sum of the maximum's own amount and its increases the rules' total, so that the displayed maximum, that sum floored at 0 by root's decision of 2026-11-18, is right?), then add or correct its entry in reviewedPairings with its reason. The sheet floors that raw sum at 0 after the increases (rotation-5), so a maximum whose whole amount is clamped at 0 in its own formula only to keep the sum from going below 0 is to be rewritten to use that floor; a minimum the rules state on a component (the Magus's half level) stays.";

/**
 * The records' pairings against the list as multisets, element for element:
 * each pairing of `records` the list does not hold as often as the records
 * give it, each entry of the list the records do not pair as often as it is
 * listed, and each record giving two outputs of one kind on one key, saying
 * what to do.
 */
function unreviewedPairings(
  records: readonly RuleValueRecord[],
  reviewed: readonly Pairing[] = reviewedPairings,
): string[] {
  const found = pairings(records);
  const unmatched = [...reviewed];
  const unlisted = found.filter((pair) => {
    const at = unmatched.findIndex((entry) => samePairing(entry, pair));
    if (at < 0) return true;
    unmatched.splice(at, 1);
    return false;
  });
  const times = (list: readonly Paired[], pair: Paired) => {
    const count = list.filter((each) => samePairing(each, pair)).length;
    return count === 1 ? 'once' : `${count} times`;
  };
  const problems = unlisted.map((pair) => {
    if (reviewed.some((entry) => samePairing(entry, pair)))
      return `Repeated pairing: the records pair ${named(pair)} ${times(found, pair)}; the list holds it ${times(reviewed, pair)}. ${whatToDo}`;
    const listed = unmatched.find((entry) => sameEntries(entry, pair));
    if (!listed)
      return `Not reviewed: the records pair ${named(pair)}, which the list does not hold. ${whatToDo}`;
    unmatched.splice(unmatched.indexOf(listed), 1);
    return sameIds(listed, pair)
      ? `Changed: the records pair ${named(pair)}; the list has ${named(listed)}. ${whatToDo}`
      : `Rebound: the records pair ${named(pair)}; the list has ${named(listed)}: a record's description changed, so the pairing needs review against the new text. ${whatToDo}`;
  });
  const gone = unmatched.map((entry) =>
    found.some((pair) => samePairing(entry, pair))
      ? `Listed twice: the list holds ${named(entry)} more often than the records pair it; remove the extra entry.`
      : `Gone: the list holds ${named(entry)}, which the records no longer pair; remove its entry. ${whatToDo}`,
  );
  return [...repeatedOutputs(records), ...problems, ...gone];
}

describe('the reviewed pairings of a per-day maximum with an increase (stats-d3 fix r7, r8)', () => {
  it('hold every pairing in the committed records, exactly, whatever their statuses: the eight held below 0 and the Bladebound’s pool', () => {
    expect(unreviewedPairings(allRecords)).toEqual([]);
    expect(reviewedPairings).toHaveLength(9);
  });

  const extraBombs: RuleValueRecord = {
    externalKey: 'pf1/probe-extra-bombs',
    descriptionSha256: '0'.repeat(64),
    outputs: [{ kind: 'ruleValue', ruleValue: increase('classFeat_bomb', 2) }],
    rationale: 'A probe: an increase such as Extra Bombs.',
    status: 'drafted',
  };
  /** The committed records with `externalKey`'s per-day values changed by `change`. */
  const changed = (
    externalKey: string,
    change: (ruleValue: RuleValue) => RuleValue,
  ) =>
    allRecords.map((record): RuleValueRecord => {
      if (record.externalKey !== externalKey) return record;
      const [first, ...rest] = record.outputs;
      const output = (each: typeof first) => ({
        ...each,
        ruleValue: change(each.ruleValue),
      });
      return { ...record, outputs: [output(first), ...rest.map(output)] };
    });
  const withMaximum = (externalKey: string, text: string) =>
    changed(externalKey, (ruleValue) =>
      ruleValue.kind === 'dailyMaximum'
        ? { ...ruleValue, amount: formula(text) }
        : ruleValue,
    );

  it('fail on a new increase, naming the pairing: an Extra Bombs on Bomb’s clamped maximum', () => {
    expect(unreviewedPairings([...allRecords, extraBombs])).toEqual([
      `Not reviewed: the records pair rule-value pf1/probe-extra-bombs per-day sha256:0000000000000000000000000000000000000000000000000000000000000000 (2) on classFeat_bomb, the key of rule-value pf1/7gHiZBNHjwefbBLI per-day sha256:ea8216c922e117cf01425fe31bc4e9f4eb93ff6c87549db8a75353cbd372ae55 ({"formula":"max(0, @classLevel.alchemist + @ability.int.mod)"}), which the list does not hold. ${whatToDo}`,
    ]);
  });

  it('fail on a pairing the list lacks', () => {
    const [problem, ...rest] = unreviewedPairings(
      allRecords,
      reviewedPairings.filter(({ key }) => key !== 'classFeat_channelEnergy'),
    );
    expect(rest).toEqual([]);
    expect(problem).toBe(
      `Not reviewed: the records pair rule-value pf1/pgRX4VpFemwv9R0E per-day sha256:9243d1ad9f68904c17f03433d2af6e00365e0736370787f72b1d7e435692afaf (2) on classFeat_channelEnergy, the key of rule-value pf1/kXXz1lO4i7CibHJ9 per-day sha256:fdc7bbf62cb44cb94f1e8fcf16f1f3d55179114a5b3321d8ea9bebf779e00b20 ({"formula":"3 + @ability.cha.mod"}), which the list does not hold. ${whatToDo}`,
    );
  });

  it('fail on a changed formula, even one the sheet would give the same', () => {
    expect(
      unreviewedPairings(
        withMaximum('pf1/kXXz1lO4i7CibHJ9', 'max(0, 3 + @ability.cha.mod)'),
      ),
    ).toEqual([
      `Changed: the records pair rule-value pf1/pgRX4VpFemwv9R0E per-day sha256:9243d1ad9f68904c17f03433d2af6e00365e0736370787f72b1d7e435692afaf (2) on classFeat_channelEnergy, the key of rule-value pf1/kXXz1lO4i7CibHJ9 per-day sha256:fdc7bbf62cb44cb94f1e8fcf16f1f3d55179114a5b3321d8ea9bebf779e00b20 ({"formula":"max(0, 3 + @ability.cha.mod)"}); the list has rule-value pf1/pgRX4VpFemwv9R0E per-day sha256:9243d1ad9f68904c17f03433d2af6e00365e0736370787f72b1d7e435692afaf (2) on classFeat_channelEnergy, the key of rule-value pf1/kXXz1lO4i7CibHJ9 per-day sha256:fdc7bbf62cb44cb94f1e8fcf16f1f3d55179114a5b3321d8ea9bebf779e00b20 ({"formula":"3 + @ability.cha.mod"}). ${whatToDo}`,
    ]);
    expect(
      unreviewedPairings(
        withMaximum(
          'everythingpath/magus-bladebound-arcane-pool',
          'max(1, floor(@classLevel.magus / 3)) + max(0, @ability.int.mod) + 0',
        ),
      ),
    ).toHaveLength(1);
  });

  it('fail on a changed increase amount, for each maximum it raises', () => {
    const problems = unreviewedPairings(
      changed(feats.extraArcanePool, (ruleValue) =>
        ruleValue.kind === 'dailyMaximumIncrease'
          ? { ...ruleValue, amount: 3 }
          : ruleValue,
      ),
    );
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain(
      'Changed: the records pair rule-value pf1/3lfNiysSNv1ahV4F per-day sha256:54e85a6f7896ad1787541049446cd11a96adc2c65bed78f3b57335735898f813 (3) on classFeat_arcanePool, the key of rule-value everythingpath/magus-bladebound-arcane-pool per-day sha256:8e8bd3af93c7334f1447440e77d06494390ff0135912dcffcb198c68c8d0fbf9',
    );
    expect(problems[1]).toContain(
      'Changed: the records pair rule-value pf1/3lfNiysSNv1ahV4F per-day sha256:54e85a6f7896ad1787541049446cd11a96adc2c65bed78f3b57335735898f813 (3) on classFeat_arcanePool, the key of rule-value pf1/mpe3JHJMINddqLWr per-day sha256:444a97162ea55031babc41172a6616589a1e48bdeedd001c389cca5da5e6a6f3',
    );
  });

  it('fail on an entry the records no longer pair, saying to remove it', () => {
    expect(
      unreviewedPairings(
        allRecords.filter(
          ({ externalKey }) => externalKey !== feats.extraLayOnHands,
        ),
      ),
    ).toEqual([
      `Gone: the list holds rule-value pf1/RDgJ7awoKBhacWsu per-day sha256:60ffc87038b367645fd4bc11bec950ae883c2e40548441cd3ea8161fe0aed1a6 (2) on classFeat_layOnHands, the key of rule-value pf1/WhE4j0Jc82npdMCP per-day sha256:2ae0ddd92f53b87791eb3cd190790cb457edfa48401eb652f7afd1c6b8ab4c60 ({"formula":"floor(@classLevel.paladin / 2) + @ability.cha.mod"}), which the records no longer pair; remove its entry. ${whatToDo}`,
    ]);
  });

  /** The committed records with `externalKey`'s first output given twice. */
  const doubled = (externalKey: string) =>
    allRecords.map((record): RuleValueRecord => {
      if (record.externalKey !== externalKey) return record;
      const [first, ...rest] = record.outputs;
      return { ...record, outputs: [first, first, ...rest] };
    });
  const channelEnergy = reviewedPairings.find(
    ({ key }) => key === 'classFeat_channelEnergy',
  )!;

  it('fail on a maximum output given twice in its record: the sheet would show a second maximum', () => {
    expect(unreviewedPairings(doubled('pf1/kXXz1lO4i7CibHJ9'))).toEqual([
      `Repeated: ${channelEnergy.maximum.id} gives 2 per-day maxima on classFeat_channelEnergy; the sheet would show each. An entry gives one maximum per key: remove the copies.`,
      expect.stringMatching(
        /^Repeated pairing: .* 2 times; the list holds it once\./,
      ),
    ]);
  });

  it('fail on an increase output given twice in its record: the sheet would add it twice', () => {
    expect(unreviewedPairings(doubled(feats.extraChannel))).toEqual([
      `Repeated: ${channelEnergy.increase.id} gives 2 increases on classFeat_channelEnergy; the sheet would add each. Remove the copies.`,
      expect.stringMatching(
        /^Repeated pairing: .* 2 times; the list holds it once\./,
      ),
    ]);
  });

  it('fail on an obsolete amount listed beside its replacement', () => {
    expect(
      unreviewedPairings(allRecords, [
        ...reviewedPairings,
        {
          ...channelEnergy,
          maximum: {
            ...channelEnergy.maximum,
            amount: formula('3 + @ability.wis.mod'),
          },
        },
      ]),
    ).toEqual([
      expect.stringMatching(
        /^Gone: the list holds .*\{"formula":"3 \+ @ability.wis.mod"\}\), which the records no longer pair; remove its entry\./,
      ),
    ]);
  });

  /** The committed records with `externalKey`'s description hash one character off. */
  const rebound = (externalKey: string) =>
    allRecords.map(
      (record): RuleValueRecord =>
        record.externalKey === externalKey
          ? {
              ...record,
              descriptionSha256: `${record.descriptionSha256.startsWith('0') ? '1' : '0'}${record.descriptionSha256.slice(1)}`,
            }
          : record,
    );

  it('fail on a maximum’s record rebound to a changed description, saying the pairing needs review against the new text', () => {
    expect(unreviewedPairings(rebound('pf1/kXXz1lO4i7CibHJ9'))).toEqual([
      expect.stringMatching(
        /^Rebound: the records pair .*kXXz1lO4i7CibHJ9.*; the list has .*: a record's description changed, so the pairing needs review against the new text\./,
      ),
    ]);
  });

  it('fail on an increase’s record rebound, for each maximum it raises', () => {
    const problems = unreviewedPairings(rebound(feats.extraRage));
    expect(problems).toHaveLength(3);
    for (const problem of problems) expect(problem).toMatch(/^Rebound: /);
  });

  it('fail on one pairing listed twice', () => {
    expect(
      unreviewedPairings(allRecords, [...reviewedPairings, channelEnergy]),
    ).toEqual([
      expect.stringMatching(
        /^Listed twice: the list holds .*classFeat_channelEnergy.* more often than the records pair it; remove the extra entry\./,
      ),
    ]);
  });
});

/**
 * The party's builds as these tests give them (party-builds.json): the
 * classes, archetype and the feats a per-day record reads, by character
 * number. One list for the committed state and the probe; Extra Arcane Pool
 * on the Bladebound's pool, which no party character holds, is its own probe
 * (below).
 */
const party = [
  [
    '3 (Cleric 8, Extra Channel)',
    [[classes.cleric, 8]],
    { rows: [feat(feats.extraChannel)] },
  ],
  [
    '4 (Mad Dog Barbarian 8)',
    [[classes.barbarian, 8]],
    { archetype: archetypes.madDog },
  ],
  [
    '6 (Ecclesitheurge Cleric 5 / Monk 1)',
    [
      [classes.cleric, 5],
      [classes.monk, 1],
    ],
    { archetype: archetypes.ecclesitheurge },
  ],
  [
    '7 (Bloodrager 4 / Scaled Fist Monk 1 / Dragon Disciple 3)',
    [
      [classes.bloodrager, 4],
      [classes.monk, 1],
      [classes.dragonDisciple, 3],
    ],
    { archetype: archetypes.scaledFist },
  ],
  [
    '8 (Bladebound Magus 4)',
    [[classes.magus, 4]],
    { archetype: archetypes.bladebound },
  ],
  ['10 (Bloodrager 4)', [[classes.bloodrager, 4]], {}],
  [
    '11 (Exploiter Wizard 4)',
    [[classes.wizard, 4]],
    { archetype: archetypes.exploiter },
  ],
  ['12 (Paladin 4)', [[classes.paladin, 4]], {}],
  [
    '13 (Bard 4, Extra Performance)',
    [[classes.bard, 4]],
    { rows: [feat(feats.extraPerformance)] },
  ],
] as const;

// stats-d3 fix r2, r3, phase 2: what the nine the record step checked give
// as committed (the same as checking them in memory, above), before the
// probes below, which check all 30, the held ones included.
describe('as committed, the nine checked, each party character’s per-day maxima (Con 14, Int 16, Wis 12, Cha 18)', () => {
  it('are the nine the promotion review confirmed, the ones the held leave', () => {
    expect(forPromotion.map(({ externalKey }) => externalKey).sort()).toEqual(
      [...confirmed].sort(),
    );
    expect(committed).toHaveLength(forPromotion.length + held.length);
  });

  // None of the nine is a feature of the party's classes at their levels: the
  // party has no Inquisitor, Summoner, Cavalier or Slayer (Lore Master, which
  // would come at Bard 5, after 13's Bard 4, is held).
  it.each(party)('%s: none', (...[, levels, options]) => {
    expect(maxima(asCommitted, levels, options)).toEqual([]);
  });

  it.each([
    [
      'an Inquisitor 5: Bane and Discern Lies 5 rounds, Judgment 2',
      [[classes.inquisitor, 5]],
      [
        'pf1/MpvhQz62qw68D2pd 5 rounds',
        'pf1/S9lYCsz7oA7v3GzR 5 rounds',
        'pf1/qI4IouTn4uvDPSXv 2 uses',
      ],
    ],
    [
      'a Summoner 16: Bond Senses and Merge Forms 16 rounds, Maker’s Call 3, Summon Monster I 3 + Cha',
      [[classes.summoner, 16]],
      [
        'pf1/Aj7SwIo94HfcpR9R 16 rounds',
        'pf1/CW99G919xJkrIWAu 16 rounds',
        'pf1/Jw6BEoNMBxfSN4cu 3 uses',
        'pf1/caNEmbCtoHA7NYtZ 7 uses',
      ],
    ],
    [
      'a Cavalier 10: Challenge 4; Tactician is held',
      [[classes.cavalier, 10]],
      ['pf1/WNi2SBF6Z2zhBMCl 4 uses'],
    ],
    [
      'a Bard 11: none; Lore Master (phase 2) and Bardic Performance are held',
      [[classes.bard, 11]],
      [],
    ],
    [
      'a Slayer 17: Slayer’s Advance 2',
      [[classes.slayer, 17]],
      ['pf1/yotHT522pQoKDhID 2 uses'],
    ],
  ] as const)('%s', (...[, levels, shown]) => {
    expect(maxima(asCommitted, levels)).toEqual(shown);
  });

  // Only Summon Monster I of the nine reads an ability modifier, and its
  // formula clamps its amount at 0 (fix r1): none of the nine goes below 0
  // at score 1.
  it('at the lowest score, 1, none goes below 0: a Summoner 1 with Charisma 1 summons 0 times', () => {
    expect(
      maxima(asCommitted, [[classes.summoner, 1]], {
        scores: { charisma: 1 },
      }),
    ).toEqual(['pf1/caNEmbCtoHA7NYtZ 0 uses']);
  });
});

describe('a probe: all 30 checked in memory, the held ones included, each party character’s per-day maxima (Con 14, Int 16, Wis 12, Cha 18)', () => {
  /** What each party character shows with all 30 checked, by number. */
  const probed: Record<(typeof party)[number][0], readonly string[]> = {
    // Channel 5 + Cha.
    '3 (Cleric 8, Extra Channel)': ['pf1/kXXz1lO4i7CibHJ9 9 uses'],
    // Rage 12 + Con rounds, the Mad Dog's own; the Barbarian's is replaced.
    '4 (Mad Dog Barbarian 8)': [
      'everythingpath/barbarian-mad-dog-rage 14 rounds',
    ],
    // Channel 3 + Cha and Stunning Fist 2.
    '6 (Ecclesitheurge Cleric 5 / Monk 1)': [
      'pf1/2ausI8g6SsmbOpgF 2 uses',
      'pf1/kXXz1lO4i7CibHJ9 7 uses',
    ],
    // Stunning Fist 2 and bloodrage 10 + Con; no ki pool at Monk 1.
    '7 (Bloodrager 4 / Scaled Fist Monk 1 / Dragon Disciple 3)': [
      'pf1/2ausI8g6SsmbOpgF 2 uses',
      'pf1/5op6M5xchCJNsYRt 12 rounds',
    ],
    // Arcane pool 1 + Int points, the Bladebound's own.
    '8 (Bladebound Magus 4)': [
      'everythingpath/magus-bladebound-arcane-pool 4 points',
    ],
    // Bloodrage 10 + Con rounds.
    '10 (Bloodrager 4)': ['pf1/5op6M5xchCJNsYRt 12 rounds'],
    // None; the reservoir stays out.
    '11 (Exploiter Wizard 4)': [],
    // Lay on hands 2 + Cha and smite 2; channel positive energy has no
    // maximum of its own.
    '12 (Paladin 4)': [
      'pf1/2TsDfK0SKC8IGVx4 2 uses',
      'pf1/WhE4j0Jc82npdMCP 6 uses',
    ],
    // Performance 16 + Cha rounds.
    '13 (Bard 4, Extra Performance)': ['pf1/ZfCUTi1MiLgR4T7I 20 rounds'],
  };
  it.each(party)('%s', (...[character, levels, options]) => {
    expect(maxima(checked, levels, options)).toEqual(probed[character]);
  });

  it('13 at Bard 3: performance 14 + Cha rounds', () => {
    const extra = { rows: [feat(feats.extraPerformance)] };
    expect(maxima(checked, [[classes.bard, 3]], extra)).toEqual([
      'pf1/ZfCUTi1MiLgR4T7I 18 rounds',
    ]);
  });
});

describe('checked in memory, on the real rows', () => {
  // An increase names the key of the feature it raises, and the Bladebound's
  // pool keeps the Magus's key, so Extra Arcane Pool raises it (both held,
  // fix r3).
  it('held: Extra Arcane Pool raises the Bladebound’s pool, whose key it names: a Bladebound Magus 4 with Intelligence 16 has 1 + 3 + 2 points, 2 more per copy', () => {
    const bladebound = { archetype: archetypes.bladebound };
    expect(
      maxima(checked, [[classes.magus, 4]], {
        ...bladebound,
        rows: [feat(feats.extraArcanePool)],
      }),
    ).toEqual(['everythingpath/magus-bladebound-arcane-pool 6 points']);
    expect(
      maxima(checked, [[classes.magus, 4]], {
        ...bladebound,
        rows: [feat(feats.extraArcanePool), feat(feats.extraArcanePool)],
      }),
    ).toEqual(['everythingpath/magus-bladebound-arcane-pool 8 points']);
  });

  it('a Cleric 5 / Paladin 4 keeps each class’s maxima apart: channel uses, lay on hands uses and smite', () => {
    expect(
      maxima(checked, [
        [classes.cleric, 5],
        [classes.paladin, 4],
      ]),
    ).toEqual([
      'pf1/2TsDfK0SKC8IGVx4 2 uses',
      'pf1/WhE4j0Jc82npdMCP 6 uses',
      'pf1/kXXz1lO4i7CibHJ9 7 uses',
    ]);
  });

  it('held: Extra Channel raises a Cleric 5 / Paladin 4’s cleric channel whichever class the feat was taken for, since no landed kind reads the feat’s choice', () => {
    expect(
      maxima(
        checked,
        [
          [classes.cleric, 5],
          [classes.paladin, 4],
        ],
        { rows: [feat(feats.extraChannel)] },
      ),
    ).toContain('pf1/kXXz1lO4i7CibHJ9 9 uses');
  });

  it('held: Extra Rage gives a Barbarian 4 / Bloodrager 4 6 rounds in each pool, which the text does not settle (each, once, or the player’s choice)', () => {
    expect(
      maxima(
        checked,
        [
          [classes.barbarian, 4],
          [classes.bloodrager, 4],
        ],
        { rows: [feat(feats.extraRage)] },
      ),
    ).toEqual([
      'pf1/5op6M5xchCJNsYRt 18 rounds',
      'pf1/WSqWT9ZIshtC5vlV 18 rounds',
    ]);
  });

  it('Extra Channel taken twice adds 2 per copy', () => {
    expect(
      maxima(checked, [[classes.cleric, 1]], {
        rows: [feat(feats.extraChannel), feat(feats.extraChannel)],
      }),
    ).toEqual(['pf1/kXXz1lO4i7CibHJ9 11 uses']);
  });

  it('a temporary increase to Constitution adds no rounds: a Barbarian 4 under bear’s endurance rages 4 + 2 + 6', () => {
    const levels = [[classes.barbarian, 4]] as const;
    const rows = [
      { catalogEntryId: bearsEndurance, kind: 'spellEffect' },
    ] as const;
    const enduring = calculateCharacterSheet(
      character(checked, levels, { scores, rows }),
    );
    expect(enduring.abilities.constitution.modifier).toBe(4);
    expect(maxima(checked, levels, { rows })).toEqual([
      'pf1/WSqWT9ZIshtC5vlV 12 rounds',
    ]);
  });

  it('Extra Rage reaches rage and bloodrage; Extra Lay On Hands, Extra Arcane Pool and Extra Ki their pools', () => {
    const rage = { rows: [feat(feats.extraRage)] };
    expect(maxima(checked, [[classes.barbarian, 1]], rage)).toEqual([
      'pf1/WSqWT9ZIshtC5vlV 12 rounds',
    ]);
    expect(maxima(checked, [[classes.bloodrager, 1]], rage)).toEqual([
      'pf1/5op6M5xchCJNsYRt 12 rounds',
    ]);
    expect(
      maxima(checked, [[classes.paladin, 2]], {
        rows: [feat(feats.extraLayOnHands)],
      }),
    ).toEqual(['pf1/2TsDfK0SKC8IGVx4 1 uses', 'pf1/WhE4j0Jc82npdMCP 7 uses']);
    expect(
      maxima(checked, [[classes.magus, 1]], {
        rows: [feat(feats.extraArcanePool)],
      }),
    ).toEqual(['pf1/mpe3JHJMINddqLWr 6 points']);
    expect(
      maxima(checked, [[classes.unchainedMonk, 4]], {
        rows: [feat(feats.extraKi)],
      }),
    ).toEqual(['pf1/2ausI8g6SsmbOpgF 4 uses', 'pf1/7BfYNNkYjjBevun8 5 points']);
  });

  it('a feature gained at a later level shows no maximum before it', () => {
    expect(maxima(checked, [[classes.paladin, 1]])).toEqual([
      'pf1/2TsDfK0SKC8IGVx4 1 uses',
    ]);
    expect(
      maxima(checked, [[classes.barbarian, 3]], {
        archetype: archetypes.madDog,
      }),
    ).toEqual([]);
    expect(maxima(checked, [[classes.unchainedMonk, 2]])).toEqual([
      'pf1/2ausI8g6SsmbOpgF 2 uses',
    ]);
    expect(maxima(checked, [[classes.inquisitor, 4]])).toEqual([
      'pf1/qI4IouTn4uvDPSXv 2 uses',
    ]);
    // The Monk's ki pool stays out (the Scaled Fist), at 4th as at 20th.
    expect(maxima(checked, [[classes.monk, 4]])).toEqual([
      'pf1/2ausI8g6SsmbOpgF 4 uses',
    ]);
  });

  // stats-d3 fix r1: a maximum with an ability modifier at the lowest legal
  // score, 1 (3, the lowest rolled, less a racial 2). No text gives these a
  // minimum of the total; a record whose key no increase names clamps its
  // whole amount at 0 in its formula (root, 2026-11-18: a negative count is
  // not a number of uses); the Bladebound's formula clamps two components,
  // the third of the level at 1 and the Intelligence bonus at 0, so it never
  // goes below 1.
  it.each([
    [classes.alchemist, 1, 'intelligence', 'pf1/7gHiZBNHjwefbBLI 0 uses'],
    [classes.summoner, 1, 'charisma', 'pf1/caNEmbCtoHA7NYtZ 0 uses'],
    [
      classes.magus,
      1,
      'intelligence',
      'everythingpath/magus-bladebound-arcane-pool 1 points',
    ],
  ] as const)(
    'at the lowest score, floored: a %s %i with %s 1 shows %s',
    (...[classKey, level, ability, shown]) => {
      expect(
        maxima(checked, [[classKey, level]], {
          scores: { [ability]: 1 },
          ...(shown.startsWith('everythingpath/magus-bladebound') && {
            archetype: archetypes.bladebound,
          }),
        }),
      ).toContain(shown);
    },
  );

  // The held ones: their raw sum goes below 0 at the lowest score, and the
  // sheet floors the raw sum after the increases (rotation-5), so each shows
  // 0 and its floor carries the sum; a clamp of the record's whole amount at
  // 0 would instead give an increase in full (a Cleric 1 with Charisma 1 and
  // Extra Channel: 3 - 5 + 2 = 0 uses, where a clamped record gives 2).
  it.each([
    [classes.cleric, 1, 'charisma', 'pf1/kXXz1lO4i7CibHJ9 0 uses', -2],
    [classes.barbarian, 1, 'constitution', 'pf1/WSqWT9ZIshtC5vlV 0 rounds', -1],
    [
      classes.barbarian,
      4,
      'constitution',
      'everythingpath/barbarian-mad-dog-rage 0 rounds',
      -1,
    ],
    [
      classes.bloodrager,
      1,
      'constitution',
      'pf1/5op6M5xchCJNsYRt 0 rounds',
      -1,
    ],
    [classes.bard, 1, 'charisma', 'pf1/ZfCUTi1MiLgR4T7I 0 rounds', -1],
    [classes.magus, 1, 'intelligence', 'pf1/mpe3JHJMINddqLWr 0 points', -4],
    [classes.paladin, 2, 'charisma', 'pf1/WhE4j0Jc82npdMCP 0 uses', -4],
    [classes.unchainedMonk, 3, 'wisdom', 'pf1/7BfYNNkYjjBevun8 0 points', -4],
  ] as const)(
    'held at the lowest score: a %s %i with %s 1 shows %s, floored from %i',
    (...[classKey, level, ability, shown, sum]) => {
      const options = {
        scores: { [ability]: 1 },
        ...(shown.startsWith('everythingpath/barbarian-mad-dog') && {
          archetype: archetypes.madDog,
        }),
      };
      expect(maxima(checked, [[classKey, level]], options)).toContain(shown);
      expect(floors(checked, [[classKey, level]], options)).toContain(
        `${shown.split(' ')[0]} ${sum}`,
      );
    },
  );

  it('held: with an increase the sum is the rules’ arithmetic, which a floored record would raise', () => {
    expect(
      maxima(checked, [[classes.cleric, 1]], {
        scores: { charisma: 1 },
        rows: [feat(feats.extraChannel)],
      }),
    ).toEqual(['pf1/kXXz1lO4i7CibHJ9 0 uses']);
  });

  it.each([
    // The rows features at the levels their tables print.
    [classes.paladin, 19, 'pf1/2TsDfK0SKC8IGVx4', '7 uses'],
    [classes.inquisitor, 19, 'pf1/qI4IouTn4uvDPSXv', '7 uses'],
    [classes.cavalier, 10, 'pf1/WNi2SBF6Z2zhBMCl', '4 uses'],
    [classes.bard, 11, 'pf1/msQWK7TW7mufzf8l', '2 uses'],
    [classes.bard, 17, 'pf1/msQWK7TW7mufzf8l', '3 uses'],
    // The formula features.
    [classes.magus, 20, 'pf1/mpe3JHJMINddqLWr', '13 points'],
    [classes.inquisitor, 5, 'pf1/MpvhQz62qw68D2pd', '5 rounds'],
    [classes.inquisitor, 5, 'pf1/S9lYCsz7oA7v3GzR', '5 rounds'],
    [classes.alchemist, 3, 'pf1/7gHiZBNHjwefbBLI', '6 uses'],
    [classes.cavalier, 10, 'pf1/YKyAQ2o5Yzox79B8', '3 uses'],
    [classes.slayer, 16, 'pf1/yotHT522pQoKDhID', '1 uses'],
    [classes.slayer, 17, 'pf1/yotHT522pQoKDhID', '2 uses'],
    [classes.summoner, 1, 'pf1/caNEmbCtoHA7NYtZ', '7 uses'],
    [classes.summoner, 2, 'pf1/Aj7SwIo94HfcpR9R', '2 rounds'],
    [classes.summoner, 10, 'pf1/Jw6BEoNMBxfSN4cu', '2 uses'],
    [classes.summoner, 16, 'pf1/CW99G919xJkrIWAu', '16 rounds'],
    [classes.monk, 15, 'pf1/n4SWyKVcdmZK4t7d', '1 uses'],
    [classes.unchainedMonk, 3, 'pf1/7BfYNNkYjjBevun8', '2 points'],
    [
      classes.magus,
      18,
      'everythingpath/magus-bladebound-arcane-pool',
      '9 points',
    ],
  ] as const)('a %s %i: %s %s', (...[classKey, level, entry, value]) => {
    expect(
      maxima(checked, [[classKey, level]], {
        ...(entry.startsWith('everythingpath/magus-bladebound') && {
          archetype: archetypes.bladebound,
        }),
      }),
    ).toContain(`${entry} ${value}`);
  });
});

/**
 * stats-d3 fix r7: an input the sheet cannot resolve for an entry
 * (`@skillRanks.perform`, which names no skill; a bare `@casterLevel`, which
 * only a Spell Effect has) gives no maximum and a rules warning. Every
 * committed per-day record whose amount is a formula is evaluated, checked in
 * memory, by the sheet's own resolver on its entry, on a Character who has
 * that entry at one plausible level (with the feat, for an increase); a
 * record with no Character here fails, so a new formula record gets one.
 */
const formulaCharacters: Readonly<
  Record<string, readonly [ClassLevels, CharacterOptions?]>
> = {
  'everythingpath/barbarian-mad-dog-rage': [
    [[classes.barbarian, 8]],
    { archetype: archetypes.madDog },
  ],
  'everythingpath/magus-bladebound-arcane-pool': [
    [[classes.magus, 4]],
    { archetype: archetypes.bladebound },
  ],
  'pf1/2ausI8g6SsmbOpgF': [[[classes.monk, 4]]],
  'pf1/5op6M5xchCJNsYRt': [[[classes.bloodrager, 4]]],
  'pf1/7BfYNNkYjjBevun8': [[[classes.unchainedMonk, 4]]],
  'pf1/7gHiZBNHjwefbBLI': [[[classes.alchemist, 3]]],
  'pf1/Aj7SwIo94HfcpR9R': [[[classes.summoner, 2]]],
  'pf1/CW99G919xJkrIWAu': [[[classes.summoner, 16]]],
  'pf1/Jw6BEoNMBxfSN4cu': [[[classes.summoner, 10]]],
  'pf1/MpvhQz62qw68D2pd': [[[classes.inquisitor, 5]]],
  'pf1/S9lYCsz7oA7v3GzR': [[[classes.inquisitor, 5]]],
  'pf1/WSqWT9ZIshtC5vlV': [[[classes.barbarian, 4]]],
  'pf1/WhE4j0Jc82npdMCP': [[[classes.paladin, 4]]],
  'pf1/YKyAQ2o5Yzox79B8': [[[classes.cavalier, 10]]],
  'pf1/ZfCUTi1MiLgR4T7I': [[[classes.bard, 4]]],
  'pf1/caNEmbCtoHA7NYtZ': [[[classes.summoner, 1]]],
  'pf1/kXXz1lO4i7CibHJ9': [[[classes.cleric, 1]]],
  'pf1/mpe3JHJMINddqLWr': [[[classes.magus, 4]]],
  'pf1/yotHT522pQoKDhID': [[[classes.slayer, 17]]],
};
const hasFormula = ({ outputs }: RuleValueRecord) =>
  outputs.some(
    ({ ruleValue }) =>
      typeof ruleValue.amount === 'object' && 'formula' in ruleValue.amount,
  );
/**
 * What the sheet gives `externalKey`'s per-day values on this Character, as
 * "<key> <value>", and the formula warnings on its entry; `formulaOf`
 * replaces its maximum's formula.
 */
function resolved(
  externalKey: string,
  [levels, options = {}]: readonly [ClassLevels, CharacterOptions?],
  formulaOf?: string,
) {
  const input = character(checked, levels, {
    ...options,
    scores: { ...scores, ...options.scores },
  });
  const result = calculateCharacterSheet({
    ...input,
    catalogEntries: input.catalogEntries.map((entry) =>
      formulaOf !== undefined && entry._id === externalKey
        ? {
            ...entry,
            ruleValues: entry.ruleValues?.map((ruleValue) =>
              ruleValue.kind === 'dailyMaximum'
                ? { ...ruleValue, amount: formula(formulaOf) }
                : ruleValue,
            ),
          }
        : entry,
    ),
  });
  const keys = new Map(
    result.resolvedEntries.map(({ entry }) => [
      entry._id,
      'catalogEntryId' in entry ? entry.catalogEntryId : entry._id,
    ]),
  );
  const ofRecord = (entryId: string) => keys.get(entryId) === externalKey;
  return {
    values: result.dailyMaxima.flatMap(({ entryId, key, value, sources }) =>
      ofRecord(entryId) ||
      sources.some((source) => 'entryId' in source && ofRecord(source.entryId))
        ? [`${key} ${value}`]
        : [],
    ),
    warnings: result.warnings.flatMap((warning) =>
      (warning.check === 'unsupportedFormula' ||
        warning.check === 'formulaDependency') &&
      warning.target.kind === 'entry' &&
      ofRecord(warning.target.entryId)
        ? [warning.message]
        : [],
    ),
  };
}

describe('every committed per-day formula resolves on its entry (stats-d3 fix r7)', () => {
  it('has a Character for each record whose amount is a formula, and only for those', () => {
    expect(
      committed
        .filter(hasFormula)
        .map(({ externalKey }) => externalKey)
        .sort(),
    ).toEqual(Object.keys(formulaCharacters).sort());
  });

  it.each(Object.entries(formulaCharacters))(
    '%s gives its maximum with no formula warning',
    (externalKey, setting) => {
      const { values, warnings } = resolved(externalKey, setting);
      expect(warnings).toEqual([]);
      expect(values).not.toEqual([]);
      for (const value of values) expect(value).not.toMatch(/ null$/);
    },
  );

  // The reviewers' inputs on Channel Energy: each gives no maximum and a
  // warning, which the case above would refuse.
  it.each([
    [
      '3 + @ability.cha.mod + @skillRanks.perform',
      '@skillRanks.perform is not a supported variable.',
    ],
    [
      '@skillRanks.perception + @ability.cha.mod',
      '@skillRanks.perception is not a supported variable.',
    ],
    [
      '@casterLevel + @ability.cha.mod',
      '@casterLevel is supported only on a Spell Effect or caster-level Modifier.',
    ],
  ])('%s on a class feature gives no maximum and warns', (text, why) => {
    expect(
      resolved('pf1/kXXz1lO4i7CibHJ9', [[[classes.cleric, 1]]], text),
    ).toEqual({
      values: ['classFeat_channelEnergy null'],
      warnings: [`This rule value gives no number. ${why}`],
    });
  });
});
