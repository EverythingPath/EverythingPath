// @vitest-environment node
// stats-d3 (PRD #251; GLOSSARY: Per-day maximum; owner 2026-11-17: the
// maximum only, no tally, no uses remaining, no reset): the per-day
// rule-value records that put per-day maxima on the launch classes' real
// rows, and the increases (Extra Channel …) that raise them. Written drafted;
// the record step checked nine on a captured review (run
// t3-review-b9b39010…), the Magus's Arcane Pool and Extra Arcane Pool on
// maxima-promote-1's promotion review (run t3-review-ecd7ad0e…) and Bardic
// Performance and Extra Performance on reward-terms-1's (run
// t3-review-15c1fdab…), so as committed those thirteen give their entries
// their values and the other 17 change nothing; of the party, from these
// records, only 13, a Bard, shows a per-day maximum (8, the one Magus, is a
// Bladebound; this tree holds no domain power: 3's Fire Bolt and Rebuke
// Death are domain-powers-1's, checked in rule-values-domain-powers.test.ts);
// checked in memory, all 30 give each party character the
// maxima of the boundary (ORCH stats-d3/boundary.md). Characters are numbers
// (party-builds.json); every case runs on the pinned tree.
import { copyFile, readFile } from 'node:fs/promises';
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
  type CharacterSheetInput,
  type RuleValue,
} from '../../src/lib/character-sheet';
import { abilityTargets } from '../../src/lib/character-sheet-abilities';
import {
  activeRaceIdentities,
  favoredClassRewardsFitting,
  levelClassIdentities,
  rewardRaceIdentities,
} from '../../src/lib/character-sheet-favored-class-rewards';
import { dragonDiscipleSheetFiles } from '../fixtures/pcgen-716/dragon-disciple-sheet-files';
import {
  ownerEmissionFoundryFiles,
  pcgenOwnerEmissionFiles,
} from '../fixtures/pcgen-716/owner-emission-files';
import { materializePinnedTree, pinnedPath } from './pinned-sources';
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
  druid: 'pf1/7eZQP0MzeO2svmVF',
  inquisitor: 'pf1/Fv3FbmXptuDRiL5y',
  magus: 'pf1/xZLcyrEKYZoJPS2k',
  monk: 'pf1/W8dxwZ1CZiwLKsqr',
  unchainedMonk: 'pf1/5mQIOIw4hDhlREPo',
  paladin: 'pf1/ohptcds1d5oG6Bjh',
  slayer: 'pf1/cOY76lMUkupH534m',
  sorcerer: 'pf1/AoWSbnuTSGIxmv61',
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
const increase = (
  key: string,
  amount: number | { formula: string },
): RuleValue => ({
  kind: 'dailyMaximumIncrease',
  key,
  amount,
});
/**
 * Extra Channel's amount (maxima-promote-1): 2 only for a character whose
 * only channel the feat can have been taken for, the Cleric's; 0 beside a
 * class that may give another (ORCH maxima-promote-1/boundary.md §3; fix r1:
 * a Druid's domains and a Sorcerer's from 9th).
 */
const extraChannelAmount = formula(
  '2 - 2 * min(1, floor(@classLevel.paladin / 4) + floor(@classLevel.antipaladin / 4) + floor(@classLevel.warpriest / 4) + @classLevel.oracle + @classLevel.shaman + @classLevel.wizard + @classLevel.druid + floor(@classLevel.sorcerer / 9))',
);
/**
 * Extra Rage's amounts by class (maxima-promote-1 fix r1, root 2026-11-20):
 * to rage only without bloodrager levels, to bloodrage only without a class
 * that may give rage, so neither with both (the owner's question).
 */
const extraRageAmounts = {
  rage: formula('6 - 6 * min(1, @classLevel.bloodrager)'),
  bloodrage: formula(
    '6 - 6 * min(1, @classLevel.barbarian + @classLevel.barbarianUnchained + floor(@classLevel.cleric / 8) + floor(@classLevel.inquisitor / 6))',
  ),
};

/**
 * Bardic Performance's rounds (reward-terms-1): "4 + his Charisma modifier"
 * and 2 more at each level after 1st (PRD coreRulebook/classes/bard.html:411),
 * and 1 more for each Class Level that chose the Gnome's or Half-Elf's
 * favored-class reward Bardic Performance Round and counts (PCGen
 * apg_abilities_race.lst:142; rotation-7's `@favoredClassReward`).
 */
const bardicPerformanceFormula =
  '4 + @ability.cha.mod + 2 * (@classLevel.bard - 1) + @favoredClassReward.bardicPerformanceRound';
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
      formula(bardicPerformanceFormula),
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
    increase('classFeat_rage', extraRageAmounts.rage),
    increase('classFeat_bloodrage', extraRageAmounts.bloodrage),
  ],
  [feats.extraChannel, increase('classFeat_channelEnergy', extraChannelAmount)],
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
/**
 * domain-powers-1's per-day records, its own batch
 * (rule-values-domain-powers.test.ts): checked since domain-power-reward-terms
 * (phase 2), on entries this tree does not hold.
 */
const domainPowers = new Set([
  'pf1/0BFuaPpChxXneJwF',
  'pf1/8iWGEKKdoKTHsDy5',
  'pf1/PDiHqRkoHr3AeTUv',
  'pf1/V57hEfKt1MroRI91',
]);
const committed = allRecords.filter(
  (record) => isPerDay(record) && !domainPowers.has(record.externalKey),
);
/**
 * How a held record's rationale starts: the hold, the round that held it
 * (fix r1: the records no landed kind or formula gives correctly; fix r3: the
 * ten the first promotion review refused; phase 2: Lore Master, which the
 * second refused; maxima-promote-1 fix r1: the release-scope boundary; fix
 * r11: its favored-class rewards), then its reason.
 */
const heldPattern =
  /^Held, not for promotion \((?:stats-d3 (?:fix r[13]|phase 2)|maxima-promote-1 fix r11?)\): /;
const isHeld = ({ rationale }: RuleValueRecord) => heldPattern.test(rationale);
/**
 * How the rationale of a record of maxima-promote-1's promotion review starts
 * (of the eight held until the sheet floored the raw sum after the
 * increases, rotation-5, the two fix r1 keeps, and their increases), then
 * what makes its number right; the record step checked both on that review
 * (`promotionRun`).
 */
const promotableLead = 'For promotion (maxima-promote-1): ';
const isPromotable = ({ rationale }: RuleValueRecord) =>
  rationale.startsWith(promotableLead);
/**
 * How the rationale of a record of reward-terms-1's promotion review starts:
 * Bardic Performance, which gained the favored-class reward's term, and
 * Extra Performance, held with it by maxima-promote-1 fix r11 and released
 * with it. The record step checked both on that review (`rewardTermsRun`).
 */
const rewardTermsLead = 'For promotion (reward-terms-1): ';
const isForRewardTerms = ({ rationale }: RuleValueRecord) =>
  rationale.startsWith(rewardTermsLead);

const foundry = (path: string) => `pf1/packs/${path}.yaml`;
const tree = await materializePinnedTree([
  ...new Set([
    ...ownerEmissionFoundryFiles,
    ...dragonDiscipleSheetFiles,
    ...[
      'classes/alchemist.JcaqlAawhf14q1lq',
      'classes/bard.6GjOjO6r3R06fLwE',
      'classes/cavalier.u1ed3H9xtYQXTP5v',
      // maxima-promote-1 fix r1: classes beside whose levels Extra Channel
      // adds nothing.
      'classes/druid.7eZQP0MzeO2svmVF',
      'classes/inquisitor.Fv3FbmXptuDRiL5y',
      'classes/monk-unchained.5mQIOIw4hDhlREPo',
      'classes/paladin.ohptcds1d5oG6Bjh',
      'classes/slayer.cOY76lMUkupH534m',
      'classes/sorcerer.AoWSbnuTSGIxmv61',
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
      // reward-terms-1: the humanoid races Racial Heritage offers, so its
      // import gives the race equivalence (racial-heritage-counts-as).
      'races/human.e6IaBxKgMxy1yKlr',
      'races/gnome.efwHEwjvL9Z94MJI',
      'races/half-elf.cCepRrfH5SalFfT4',
      'races/elf.NgIhxRI0axrf3fcO',
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
/**
 * reward-terms-1: the Advanced Player's Guide's Racial Heritage
 * (pf1-content/1LULpgVNjQWqUGUk, campaign-mvp-v1), its pinned record from
 * the store, as racial-heritage-counts-as.test.ts imports it.
 */
const racialHeritage = 'pf1-content/1LULpgVNjQWqUGUk';
const racialHeritageFile = 'src/pf-feats/Racial_Heritage_1LULpgVNjQWqUGUk.yaml';
await copyFile(
  pinnedPath('pf1-content', racialHeritageFile),
  `${tree.contentPath}/${racialHeritageFile}`,
);
const remaps: unknown = JSON.parse(
  await readFile('scripts/catalog/reviewed-remaps.json', 'utf8'),
);

/** The import with the committed records, stats-d3's per-day ones (`committed`) replaced by `perDay`. */
const emit = (perDay: readonly RuleValueRecord[]) =>
  importCatalog({
    systemPath: tree.systemPath,
    contentPath: tree.contentPath,
    remaps,
    curation: {
      ...reviewedCuration,
      ruleValues: [
        ...allRecords.filter((record) => !committed.includes(record)),
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
 * The committed records with those `which` names checked in memory and the
 * rest as committed.
 */
const checking = (which: (record: RuleValueRecord) => boolean) =>
  committed.map(
    (record, index): RuleValueRecord =>
      which(record) ? checkedInMemory[index]! : record,
  );
/**
 * The records of maxima-promote-1's promotion review, as committed: checked
 * by the record step on it (`promotionRun`).
 */
const forPromotion = committed.filter(isPromotable);
/**
 * The thirteen committed checked records checked in memory: the original nine,
 * the Magus's two from maxima-promote-1 and the Bard's two from reward-terms-1.
 */
const recorded = await emit(checking(({ status }) => status === 'checked'));
/**
 * The thirteen committed checked records (the original nine, the Magus's two
 * from maxima-promote-1 and the Bard's two from reward-terms-1) and
 * maxima-promote-1's records checked in memory, already among them; the held
 * ones drafted: the committed state.
 */
const promoted = await emit(
  checking((record) => record.status === 'checked' || isPromotable(record)),
);

/** Ability scores other than 10: Con 14 (+2), Int 16 (+3), Wis 12 (+1), Cha 18 (+4). */
const scores = {
  constitution: 14,
  intelligence: 16,
  wisdom: 12,
  charisma: 18,
} as const;

/**
 * The sheet's per-day maxima, each with its entry's catalog entry ID as `name`
 * and each of its sources' (`sourceEntries`).
 */
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
  const catalogEntryIds = new Map(
    result.resolvedEntries.map(({ entry }) => [
      entry._id,
      'catalogEntryId' in entry ? entry.catalogEntryId : entry._id,
    ]),
  );
  return result.dailyMaxima.map((maximum) => ({
    ...maximum,
    name: catalogEntryIds.get(maximum.entryId),
    sourceEntries: maximum.sources.map(({ entryId, name }) => ({
      name,
      catalogEntryId: catalogEntryIds.get(entryId),
    })),
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
 * maxima-promote-1 fix r1: the records the boundary's review holds (ORCH
 * maxima-promote-1/boundary.md): a row of a release scope changes the count
 * and no record gives it exactly. Channel Energy: Extra
 * Channel, which, checked, the sheet would add again for a second copy it
 * does not refuse, and which adds nothing beside another possible channel.
 * Rage and the Mad Dog's: Rage (Cleric), whose rounds join a barbarian's,
 * and Divine Anger (the owner's question). Bloodrage: Extra Rage, held. Lay on Hands: the
 * Bracelet of Mercy, a paladin's Extra Channel, Calling. The Unchained Monk's
 * Ki Pool: the Necklace of Ki Serenity and the rogue talent Ki Pool (fix r2).
 * Bardic Performance and Extra Performance, held by fix r11 (the Gnome's and
 * Half-Elf's favored-class reward), left it with reward-terms-1, which added
 * the reward's term (`forRewardTerms`).
 */
const heldByBoundary = [
  'pf1/kXXz1lO4i7CibHJ9',
  feats.extraChannel,
  'pf1/WSqWT9ZIshtC5vlV',
  'everythingpath/barbarian-mad-dog-rage',
  'pf1/5op6M5xchCJNsYRt',
  'pf1/WhE4j0Jc82npdMCP',
  feats.extraLayOnHands,
  'pf1/7BfYNNkYjjBevun8',
  feats.extraKi,
];
/**
 * reward-terms-1: Bardic Performance, whose formula now reads the
 * favored-class reward that held it (maxima-promote-1 fix r11), and Extra
 * Performance, held with it, went to their promotion review, and the record
 * step checked both on it (phase 2, `rewardTermsRun`). The boundary's review
 * against the release scopes finds no other row or reward that changes the
 * rounds and is not bound exactly (ORCH reward-terms-1-boundary.md).
 */
const forRewardTerms = ['pf1/ZfCUTi1MiLgR4T7I', feats.extraPerformance];
/** The maxima and increases that give nothing as committed: the held ones. */
const notShown = heldByBoundary;
/**
 * The records held from promotion, each saying why first in its rationale
 * (`heldPattern`): drafted, they give nothing; they are not for the record
 * step.
 */
const held = [
  // The owner's question, rage and bloodrage together; fix r1: its amounts
  // split by class, and the classes it cannot tell apart (root decides).
  feats.extraRage,

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
  ...heldByBoundary,
];
/**
 * maxima-promote-1: the records for the next promotion review, drafted. The
 * eight maxima were held because an ability modifier can take their raw sum
 * below 0 while an increase names their key; the sheet floors the raw sum at
 * 0 after the increases (rotation-5; root's decision, 2026-11-18, not the
 * rules'), so, checked, each would display the raw sum where it is 0 or more
 * and 0 below. Fix r1 (the release-scope boundary): the boundary's review
 * finds two of them, with the increases that raise them, right for every
 * character built from the release scopes as pinned; the other six stay held
 * (`heldByBoundary`). Fix r11: the second promotion review finds a
 * favored-class reward that raises Bardic Performance, so only the Magus's
 * pool and Extra Arcane Pool went to the promotion review. Phase 2: the
 * record step checked both on it (`promotionRun`).
 */
const promotable = ['pf1/mpe3JHJMINddqLWr', feats.extraArcanePool];
/**
 * A probe (maxima-promote-1 fix r1): the thirteen committed checked records
 * (the original nine, the Magus's two and the Bard's two, all checked as
 * committed) and, beyond them, the records the boundary's review holds, Extra
 * Rage among them, checked in memory as they are drafted today. It is an in-memory check of drafts, not
 * a promotion result: what the current drafts give, not what a held maximum
 * will show once the rows that hold it are bound. The drafted Extra Channel
 * and Extra Rage increases apply here when their class conditions pass
 * (Extra Channel 2 without a class that may give another channel, Extra Rage
 * 6 to rage without bloodrager levels and 6 to bloodrage without a class that
 * may give rage); the rows no record gives add nothing (the Bracelet of
 * Mercy, Rage (Cleric), Calling, the Necklace of Ki Serenity, the rogue
 * talent Ki Pool, a favored-class reward). As committed the held show
 * nothing.
 */
const unheld = await emit(
  checking(
    (record) =>
      record.status === 'checked' ||
      isPromotable(record) ||
      isForRewardTerms(record) ||
      heldByBoundary.includes(record.externalKey) ||
      record.externalKey === feats.extraRage,
  ),
);
/**
 * reward-terms-1: the thirteen committed checked records, the Bard's two
 * among them, checked in memory, the held ones drafted: the committed state.
 */
const rewardTermsChecked = await emit(
  checking((record) => record.status === 'checked' || isForRewardTerms(record)),
);
/** The captured review the record step checked the nine on. */
const recordStepRun =
  't3-review-b9b390102ed6d3c97affa618747d99f5f5d908d77fabea28e6ad28636350f4b6';
/**
 * The captured review the record step checked the two of maxima-promote-1
 * on, the Magus's Arcane Pool and Extra Arcane Pool (`promotable`).
 */
const promotionRun =
  't3-review-ecd7ad0e87de5f4225af454e0d01e8444671f12afb9681bba1f493dce9044274';
/**
 * The captured review the record step checked reward-terms-1's two on,
 * Bardic Performance and Extra Performance (`forRewardTerms`).
 */
const rewardTermsRun =
  't3-review-15c1fdab56e9a1bb7afbf67cb87ddabbc8ce0cedb47e80edeeeb9a1976c2c688';
/** Every committed checked stats-d3 per-day record: the nine, the Magus's two and the Bard's two (domain-powers-1's four are in their own suite). */
const checkedNow = (key: string) =>
  confirmed.includes(key) ||
  promotable.includes(key) ||
  forRewardTerms.includes(key);
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
  it('hold exactly Extra Rage, the records the promotion reviews refused and those a release-scope row holds (maxima-promote-1 fix r1), each saying why first in its rationale', () => {
    expect(
      committed
        .filter(isHeld)
        .map(({ externalKey }) => externalKey)
        .sort(),
    ).toEqual([...held].sort());
  });

  it('include the two checked on the maxima-promote-1 review, beside the original nine, the held records and the two checked on the reward-terms-1 review', () => {
    expect(forPromotion.map(({ externalKey }) => externalKey).sort()).toEqual(
      [...promotable].sort(),
    );
    expect(new Set(forPromotion.map(({ status }) => status))).toEqual(
      new Set(['checked']),
    );
    expect(
      committed
        .filter(
          (record) =>
            !isHeld(record) &&
            !isPromotable(record) &&
            !isForRewardTerms(record),
        )
        .map(({ externalKey }) => externalKey)
        .sort(),
    ).toEqual([...confirmed].sort());
  });

  it('are, beside them, the two of reward-terms-1’s promotion review, checked by the record step on it, each saying so first in its rationale (reward-terms-1 phase 2)', () => {
    const records = committed.filter(isForRewardTerms);
    expect(records.map(({ externalKey }) => externalKey).sort()).toEqual(
      [...forRewardTerms].sort(),
    );
    expect(records.map(({ status }) => status)).toEqual(['checked', 'checked']);
  });

  it('are committed with exactly the boundary’s values, one per-day record per entry, the nine confirmed, the two of maxima-promote-1 and the two of reward-terms-1 checked by the record step and the rest drafted, each bound to its entry’s current description', () => {
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
      [
        ...confirmed.map((externalKey) => ({
          externalKey,
          reviewedOn: '2026-11-18',
          receipt: recordStepRun,
        })),
        ...promotable.map((externalKey) => ({
          externalKey,
          reviewedOn: '2026-11-23',
          receipt: promotionRun,
        })),
        ...forRewardTerms.map((externalKey) => ({
          externalKey,
          reviewedOn: '2026-11-24',
          receipt: rewardTermsRun,
        })),
      ]
        .sort((a, b) => (a.externalKey < b.externalKey ? -1 : 1))
        .map((record) => ({
          ...record,
          // The record step's label for the run's reviewer, one for all
          // thirteen, the three runs having the same reviewer (below); the
          // agent-launch guard allows the reviewer's name only in the record
          // files.
          reviewedBy: expect.any(String),
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
        .filter(({ externalKey }) => !checkedNow(externalKey))
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

  it('as committed, the nine, the two of maxima-promote-1 and the two of reward-terms-1 checked give their entries their maxima and the 17 drafted nothing: the entries are those with only these thirteen checked in memory, so character 3 keeps its 4d6 and shows no per-day maximum from these records (this tree holds no domain power)', () => {
    expect(asCommitted.catalog.entries).toEqual(recorded.catalog.entries);
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
        .filter(([key]) => checkedNow(key))
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
        status: checkedNow(externalKey) ? 'applied' : 'drafted',
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
      "The pool is \"1/2 his magus level (minimum 1) + his Intelligence modifier\" (PRD ultimateMagic/spellcasters/magus.html:395), the minimum of the half level only, which the formula keeps on that component (max(1, …)) and which stays: without it a Magus 1 with Intelligence 10 and Extra Arcane Pool would have 2 points, not 3; the formula has no clamp of the total, so its own amount plus 2 per copy of Extra Arcane Pool, whose effects stack (pf1 packs/feats/extra-arcane-pool.3lfNiysSNv1ahV4F.yaml:13-16), is the raw sum, below 0 included; the sheet floors that sum at 0 after the increases (rotation-5; root's decision, 2026-11-18, not the rules'), a floor the formula does not carry, so the record shows 0 where the sum is below 0, with the raw sum on its chip (a Magus 1 with Intelligence 1 and the feat: sum −2, shown 0; with two copies 0, not floored). Both records are checked by the record step on their promotion review (maxima-promote-1, run t3-review-ecd7ad0e…): the boundary's review finds no other row of the release scopes that changes the points (fix r1; the Bladebound replaces the entry with its own, held pool; Throwing Magus restores a point after a hit with a thrown weapon enhanced from the pool, up to the Intelligence modifier a day, which leaves the pool's size as it is, fix r2).",
  },
  {
    key: 'classFeat_bardicPerformance',
    maximum: {
      id: 'rule-value pf1/ZfCUTi1MiLgR4T7I per-day sha256:b05d04b283c5a7ce0fd8a77edd3da78882e9a8c4766ce457c7e81a700d788ae2',
      amount: formula(bardicPerformanceFormula),
    },
    increase: {
      id: 'rule-value pf1/6yGoL82RidBHmXPb per-day sha256:fa73afffdaca6959238c4bcf143474d9eea734b948f7248c2b34aa01926541b4',
      amount: 6,
    },
    reason:
      "The rounds are \"4 + his Charisma modifier\" and 2 more at each level after 1st (PRD coreRulebook/classes/bard.html:411), with no minimum, and 1 more for each Class Level that chose the Gnome's or Half-Elf's favored-class reward Bardic Performance Round, \"Add 1 to the bard's total number of bardic performance rounds per day.\" (campaign-mvp-v1; PCGen apg_abilities_race.lst:142, STACK:YES MULT:YES), which the formula reads as @favoredClassReward.bardicPerformanceRound, the number of Class Levels that chose it and count (rotation-7: a Bard level, Bard a favored class, and the sheet counts the character as a Gnome or a Half-Elf, by race or by Racial Heritage); the formula has no clamp, of its total or of a component, so its own amount plus 6 per copy of Extra Performance, whose effects stack (pf1 packs/feats/extra-performance.6yGoL82RidBHmXPb.yaml:16-19), is the raw sum, below 0 included; the sheet floors that sum at 0 after the increases (rotation-5; root's decision, 2026-11-18, not the rules'), a floor the formula does not carry, so the record, checked, would show 0 where the sum is below 0, with the raw sum on its chip (a Bard 1 with Charisma 1: sum −1, shown 0; with the feat 5, with two copies 11). Both records are checked by the record step on their promotion review (reward-terms-1, run t3-review-15c1fdab…): of the release scopes' rows the boundary's review finds none other that changes the rounds but the Perfect Golden Lute, whose 6 rounds are only with the lute (fix r1), and Song-Bound Curse, whose rounds equal to the oracle level are for countersong only (fix r2), and of their favored-class rewards none other that adds bardic performance rounds (ORCH reward-terms-1-boundary.md).",
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
      amount: extraRageAmounts.bloodrage,
    },
    reason:
      "The rounds are \"4 + his Constitution modifier\" and 2 more at each level after 1st (PRD advancedClassGuide/classes/bloodrager.html:446), with no minimum, and the formula has no clamp, of its total or of a component; bloodrage counts as rage for feat abilities (bloodrager.html:449), so for a character with none of the classes that may give rage its own amount plus 6 per copy of Extra Rage, whose effects stack (pf1 packs/feats/extra-rage.oP4Srsuk0dF2Zf9F.yaml:12-14), is the raw sum, below 0 included; the sheet floors that sum at 0 after the increases (rotation-5; root's decision, 2026-11-18, not the rules'), a floor the formula does not carry, so the record, checked, would show 0 where the sum is below 0, with the raw sum on its chip. Extra Rage's formula (maxima-promote-1 fix r1) gives bloodrage the 6 only without a class that may give rage (a Barbarian or Unchained Barbarian at any level, a Cleric from 8th, an Inquisitor from 6th), and it reads their class levels, not the domain or inquisition the sheet does not hold, so a Bloodrager 4 / Cleric 8 without the Rage subdomain gets no increase either (12 rounds with the feat); it gives neither pool anything where both may be on the sheet, the case the text does not settle (an owner question). Both records stay drafted and held (maxima-promote-1 fix r1): Extra Rage (campaign-mvp-v1) is held for that question, so with Bloodrage checked alone Extra Rage adds nothing and a bloodrager who took it would have a raw sum 6 rounds per copy short of the rules' total: shown 6 per copy too few wherever the raw sum without the feat is 0 or more, and 5 too few for one copy at the lowest, −1 (a Bloodrager 1 with Constitution 1: 0 shown, 5 by the rules).",
  },
  {
    key: 'classFeat_channelEnergy',
    maximum: {
      id: 'rule-value pf1/kXXz1lO4i7CibHJ9 per-day sha256:fdc7bbf62cb44cb94f1e8fcf16f1f3d55179114a5b3321d8ea9bebf779e00b20',
      amount: formula('3 + @ability.cha.mod'),
    },
    increase: {
      id: 'rule-value pf1/pgRX4VpFemwv9R0E per-day sha256:9243d1ad9f68904c17f03433d2af6e00365e0736370787f72b1d7e435692afaf',
      amount: extraChannelAmount,
    },
    reason:
      "The uses are \"3 + her Charisma modifier\" (PRD coreRulebook/classes/cleric.html:391), with no minimum, and the formula has no clamp, of its total or of a component; an Extra Channel taken for the Cleric's channel gives \"two additional times per day\" (pf1 packs/feats/extra-channel.pgRX4VpFemwv9R0E.yaml:12-13; PCGen cr_abilities_class.lst:2890, Cleric Extra Channel), and the increase's formula gives 2 only to a character whose only channel the feat can have been taken for, 0 beside a class that may give another (a Paladin, Antipaladin or Warpriest from 4th, an Oracle, Wizard, Shaman or Druid, a Sorcerer from 9th). So for one copy taken for the Cleric's channel its own amount plus 2 is the raw sum, below 0 included (a Cleric 1 with Charisma 1 and the feat: 0); the sheet floors that sum at 0 after the increases (rotation-5; root's decision, 2026-11-18, not the rules'), a floor the formula does not carry, so the record, checked, would show 0 where the sum is below 0, with the raw sum on its chip (that Cleric without the feat: 0, \"Floored at 0 (sum −2)\"). Both records stay drafted and held (maxima-promote-1 fix r1): a second copy, which neither the feat's text nor PCGen (no MULT, cr_feats.lst:63) allows, would add its amount again without a warning, and beside another possible channel a copy taken for the Cleric's would leave the raw sum 2 short of the rules' total, shown 2 too few wherever the raw sum without it is 0 or more, 1 too few at −1 and none at −2 (a Cleric 1 with Charisma 1: 0 with or without it).",
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
      'The pool is "1/2 his monk level + his Wisdom modifier" (PRD unchained/classes/monk.html:441), with no minimum, and the formula has no clamp, of its total or of a component, so its own amount plus 2 per copy of Extra Ki, whose effects stack (pf1 packs/feats/extra-ki.PGTjF7uoFx7wP1WO.yaml:15-17), is the raw sum, below 0 included; the sheet floors that sum at 0 after the increases (rotation-5; root\'s decision, 2026-11-18, not the rules\'), a floor the formula does not carry, so the record, checked, would show 0 where the sum is below 0, with the raw sum on its chip (an Unchained Monk 3 with Wisdom 1 and the feat: sum −2, shown 0). Both records stay drafted and held (maxima-promote-1 fix r1): the Necklace of Ki Serenity (pf1-content/ZLznxpOqLflxbnyN, campaign-mvp-v1) adds 4 to the level the pool is counted from while worn, and the rogue talent Ki Pool (pf1/iUTsKFtIX9gfoN1o, campaign-mvp-v1) adds half the Wisdom bonus, minimum 1, to another ki pool (fix r2), neither of which a record gives.',
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
      "The uses are \"1/2 her paladin level plus her Charisma modifier\" (PRD coreRulebook/classes/paladin.html:389), with no minimum, and the formula has no clamp, of its total or of a component, so its own amount plus 2 per copy of Extra Lay On Hands, whose effects stack (pf1 packs/feats/extra-lay-on-hands.RDgJ7awoKBhacWsu.yaml:13-16), is the raw sum, below 0 included; the sheet floors that sum at 0 after the increases (rotation-5; root's decision, 2026-11-18, not the rules'), a floor the formula does not carry, so the record, checked, would show 0 where the sum is below 0, with the raw sum on its chip (a Paladin 2 with Charisma 1 and the feat: sum −2, shown 0). Both records stay drafted and held (maxima-promote-1 fix r1): the Bracelet of Mercy (one more use a day while worn), a paladin's Extra Channel (four more uses, only to channel) and the Cavalier's Calling (an owner question), all in campaign-mvp-v1, change the uses where no record gives them.",
  },
  {
    key: 'classFeat_rage',
    maximum: {
      id: 'rule-value everythingpath/barbarian-mad-dog-rage per-day sha256:c855a5268de38d772d6978430a930acab71ec7c0ebd90150e2392bf00c3d6108',
      amount: formula('4 + @ability.con.mod + 2 * (@classLevel.barbarian - 4)'),
    },
    increase: {
      id: 'rule-value pf1/oP4Srsuk0dF2Zf9F per-day sha256:f724f2e704ebe84d7e2f5819b7c1838204873cee43cf64810a2bca2c58ed0277',
      amount: extraRageAmounts.rage,
    },
    reason:
      "The rounds are the barbarian's rage, \"4 + her Constitution modifier\" and 2 more at each level after 1st (PRD coreRulebook/classes/barbarian.html:382), at an effective barbarian level of her barbarian level - 3 (PCGen anar_abilities_class.lst:83), with no minimum, and the formula has no clamp, of its total or of a component, so for a character without bloodrager levels its own amount plus 6 per copy of Extra Rage, whose effects stack (pf1 packs/feats/extra-rage.oP4Srsuk0dF2Zf9F.yaml:12-14), is the raw sum, below 0 included; the sheet floors that sum at 0 after the increases (rotation-5; root's decision, 2026-11-18, not the rules'), a floor the formula does not carry, so the record, checked, would show 0 where the sum is below 0, with the raw sum on its chip. Extra Rage's formula (maxima-promote-1 fix r1) gives rage the 6 only without bloodrager levels, so it gives neither pool anything where both are on the sheet, the case the text does not settle (an owner question). All three records stay drafted and held (maxima-promote-1 fix r1): Rage (Cleric) (pf1/HJMvo9iDrDwjLAgM), whose rounds from 8th stack with a barbarian's, and Divine Anger (pf1/6wCdUOugsM5e7Nt6, an owner question), both in campaign-mvp-v1, change the rounds where no record gives them.",
  },
  {
    key: 'classFeat_rage',
    maximum: {
      id: 'rule-value pf1/WSqWT9ZIshtC5vlV per-day sha256:d669554c4ba24e588c4a5b1630116be75a10225ad66c84586745d0f52fde74f5',
      amount: formula('4 + @ability.con.mod + 2 * (@classLevel.barbarian - 1)'),
    },
    increase: {
      id: 'rule-value pf1/oP4Srsuk0dF2Zf9F per-day sha256:f724f2e704ebe84d7e2f5819b7c1838204873cee43cf64810a2bca2c58ed0277',
      amount: extraRageAmounts.rage,
    },
    reason:
      "The rounds are \"4 + her Constitution modifier\" and 2 more at each level after 1st (PRD coreRulebook/classes/barbarian.html:382), with no minimum, and the formula has no clamp, of its total or of a component, so for a character without bloodrager levels its own amount plus 6 per copy of Extra Rage, whose effects stack (pf1 packs/feats/extra-rage.oP4Srsuk0dF2Zf9F.yaml:12-14), is the raw sum, below 0 included; the sheet floors that sum at 0 after the increases (rotation-5; root's decision, 2026-11-18, not the rules'), a floor the formula does not carry, so the record, checked, would show 0 where the sum is below 0, with the raw sum on its chip. Extra Rage's formula (maxima-promote-1 fix r1) gives rage the 6 only without bloodrager levels, so it gives neither pool anything where both are on the sheet, the case the text does not settle (an owner question). All three records stay drafted and held (maxima-promote-1 fix r1): Rage (Cleric) (pf1/HJMvo9iDrDwjLAgM), whose rounds from 8th stack with a barbarian's, and Divine Anger (pf1/6wCdUOugsM5e7Nt6, an owner question), both in campaign-mvp-v1, change the rounds where no record gives them.",
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
  it('hold every pairing in the committed records, exactly, whatever their statuses: the eight of maxima-promote-1 (one checked on its promotion review, six held by fix r1, one, held by fix r11, checked on reward-terms-1’s review) and the Bladebound’s pool', () => {
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
      `Not reviewed: the records pair rule-value pf1/pgRX4VpFemwv9R0E per-day sha256:9243d1ad9f68904c17f03433d2af6e00365e0736370787f72b1d7e435692afaf (${JSON.stringify(extraChannelAmount)}) on classFeat_channelEnergy, the key of rule-value pf1/kXXz1lO4i7CibHJ9 per-day sha256:fdc7bbf62cb44cb94f1e8fcf16f1f3d55179114a5b3321d8ea9bebf779e00b20 ({"formula":"3 + @ability.cha.mod"}), which the list does not hold. ${whatToDo}`,
    );
  });

  it('fail on a changed formula, even one the sheet would give the same', () => {
    expect(
      unreviewedPairings(
        withMaximum('pf1/kXXz1lO4i7CibHJ9', 'max(0, 3 + @ability.cha.mod)'),
      ),
    ).toEqual([
      `Changed: the records pair rule-value pf1/pgRX4VpFemwv9R0E per-day sha256:9243d1ad9f68904c17f03433d2af6e00365e0736370787f72b1d7e435692afaf (${JSON.stringify(extraChannelAmount)}) on classFeat_channelEnergy, the key of rule-value pf1/kXXz1lO4i7CibHJ9 per-day sha256:fdc7bbf62cb44cb94f1e8fcf16f1f3d55179114a5b3321d8ea9bebf779e00b20 ({"formula":"max(0, 3 + @ability.cha.mod)"}); the list has rule-value pf1/pgRX4VpFemwv9R0E per-day sha256:9243d1ad9f68904c17f03433d2af6e00365e0736370787f72b1d7e435692afaf (${JSON.stringify(extraChannelAmount)}) on classFeat_channelEnergy, the key of rule-value pf1/kXXz1lO4i7CibHJ9 per-day sha256:fdc7bbf62cb44cb94f1e8fcf16f1f3d55179114a5b3321d8ea9bebf779e00b20 ({"formula":"3 + @ability.cha.mod"}). ${whatToDo}`,
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
describe('as committed, the nine, the two of maxima-promote-1 and the two of reward-terms-1 checked, each party character’s per-day maxima (Con 14, Int 16, Wis 12, Cha 18)', () => {
  it('are the nine the promotion review confirmed, the two of maxima-promote-1’s promotion review and the two of reward-terms-1’s; the others are held', () => {
    expect(
      committed
        .filter(({ status }) => status === 'checked')
        .map(({ externalKey }) => externalKey)
        .sort(),
    ).toEqual([...confirmed, ...promotable, ...forRewardTerms].sort());
    expect(committed).toHaveLength(
      confirmed.length +
        promotable.length +
        forRewardTerms.length +
        held.length,
    );
  });

  // Of the thirteen only Bardic Performance is a feature of the party's
  // classes at their levels (reward-terms-1 phase 2): 13, a Human Bard 4
  // with Charisma 18 and Extra Performance, has 4 + 4 + 2 × 3 + 6 = 20
  // rounds (a Human's own Bard reward adds none, and 13 has no Racial
  // Heritage). The party has no Inquisitor,
  // Summoner, Cavalier or Slayer (Lore Master, which would come at Bard 5,
  // after 13's Bard 4, is held), and no Magus but 8, a Bladebound, whose pool
  // replaces the Magus's and is held.
  const partyCommitted: Partial<
    Record<(typeof party)[number][0], readonly string[]>
  > = {
    '13 (Bard 4, Extra Performance)': ['pf1/ZfCUTi1MiLgR4T7I 20 rounds'],
  };
  it.each(party)('%s', (...[character, levels, options]) => {
    expect(maxima(asCommitted, levels, options)).toEqual(
      partyCommitted[character] ?? [],
    );
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
      'a Bard 11: Bardic Performance 4 + 4 + 2 × 10 = 28 rounds (reward-terms-1 phase 2); Lore Master (phase 2) is held',
      [[classes.bard, 11]],
      ['pf1/ZfCUTi1MiLgR4T7I 28 rounds'],
    ],
    [
      'a Slayer 17: Slayer’s Advance 2',
      [[classes.slayer, 17]],
      ['pf1/yotHT522pQoKDhID 2 uses'],
    ],
    // maxima-promote-1 phase 2: half the level (minimum 1) + Int (Int 16).
    [
      'a Magus 1: Arcane Pool 4',
      [[classes.magus, 1]],
      ['pf1/mpe3JHJMINddqLWr 4 points'],
    ],
    [
      'a Magus 4: Arcane Pool 5',
      [[classes.magus, 4]],
      ['pf1/mpe3JHJMINddqLWr 5 points'],
    ],
    [
      'a Magus 20: Arcane Pool 13',
      [[classes.magus, 20]],
      ['pf1/mpe3JHJMINddqLWr 13 points'],
    ],
  ] as const)('%s', (...[, levels, shown]) => {
    expect(maxima(asCommitted, levels)).toEqual(shown);
  });

  // maxima-promote-1 phase 2: Extra Arcane Pool adds 2 per copy, as its
  // record says ("Its effects stack"), each copy its own source.
  it.each([
    [1, 1, 'pf1/mpe3JHJMINddqLWr 6 points'],
    [1, 2, 'pf1/mpe3JHJMINddqLWr 8 points'],
    [4, 1, 'pf1/mpe3JHJMINddqLWr 7 points'],
    [4, 2, 'pf1/mpe3JHJMINddqLWr 9 points'],
    [20, 1, 'pf1/mpe3JHJMINddqLWr 15 points'],
  ] as const)(
    'a Magus %i with %i cop(ies) of Extra Arcane Pool: %s',
    (...[level, copies, shown]) => {
      const options = {
        rows: Array.from({ length: copies }, () => feat(feats.extraArcanePool)),
      };
      expect(maxima(asCommitted, [[classes.magus, level]], options)).toEqual([
        shown,
      ]);
      expect(
        sheetMaxima(asCommitted, [[classes.magus, level]], options)[0]?.sources
          .length,
      ).toBe(1 + copies);
    },
  );

  // maxima-promote-1 phase 2: the pool's formula keeps the text's minimum on
  // its half level only, and the sheet floors the raw sum at 0 after the
  // increases (rotation-5): a Magus 1 with Intelligence 1 shows 0 (sum −4).
  it('a Magus 1 with Intelligence 1 shows 0 points, floored from −4', () => {
    const setting = { scores: { intelligence: 1 } };
    expect(maxima(asCommitted, [[classes.magus, 1]], setting)).toEqual([
      'pf1/mpe3JHJMINddqLWr 0 points',
    ]);
    expect(floors(asCommitted, [[classes.magus, 1]], setting)).toEqual([
      'pf1/mpe3JHJMINddqLWr -4',
    ]);
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

/**
 * What the sheet shows with the thirteen committed checked records checked
 * in memory (the original nine, the Magus's two from maxima-promote-1 and the
 * Bard's two from reward-terms-1; the held ones drafted): the committed state
 * (asserted below and above). Fix r1: the boundary's review holds six of the eight maxima and
 * their increases; fix r11 held Bardic Performance and Extra Performance
 * too, which reward-terms-1's review checked (its phase 2), so the Magus's
 * pool and Bardic Performance show;
 * each held case also runs in the probe (`unheld`), which gives what its
 * current drafts give checked, the drafted Extra Channel and Extra Rage
 * included, not what it will show once the rows that hold it are bound. Each
 * maximum at two levels and
 * at an ability score of 1, which takes its own amount below 0: the raw sum,
 * with and without its increase, floored at 0 after the increases (root's
 * decision, 2026-11-18, not the rules'), the calculated floor carrying the
 * raw sum (the chip shows it; no chip is rendered here).
 */
describe('checked in memory: the thirteen committed checked records (the original nine, the Magus’s two and the Bard’s two), the held drafted, the committed state (maxima-promote-1 fix r1, r11, phase 2; reward-terms-1 phase 2)', () => {
  it('gives the entries the committed records give', () => {
    expect(promoted.catalog.entries).toEqual(asCommitted.catalog.entries);
  });

  /**
   * The expected lines (calculated maxima or floor sums) without those of a
   * maximum the boundary holds: what `promoted`, and as committed, gives.
   */
  const withoutHeld = (shown: readonly string[]) =>
    shown.filter((each) => !notShown.includes(each.split(' ')[0] ?? ''));
  const extra = (key: string, copies = 1) => ({
    rows: Array.from({ length: copies }, () => feat(key)),
  });
  const madDog = { archetype: archetypes.madDog };
  it.each([
    // Channel Energy: 3 + Cha (Cha 18), Extra Channel 2 for a Cleric.
    ['a Cleric 1', [[classes.cleric, 1]], {}, 'pf1/kXXz1lO4i7CibHJ9 7 uses'],
    [
      'a Cleric 8 with Extra Channel',
      [[classes.cleric, 8]],
      extra(feats.extraChannel),
      'pf1/kXXz1lO4i7CibHJ9 9 uses',
    ],
    // Rage: 4 + Con + 2 per level after 1st (Con 14); Extra Rage 6 without
    // bloodrager levels.
    [
      'a Barbarian 1',
      [[classes.barbarian, 1]],
      {},
      'pf1/WSqWT9ZIshtC5vlV 6 rounds',
    ],
    [
      'a Barbarian 4 with Extra Rage',
      [[classes.barbarian, 4]],
      extra(feats.extraRage),
      'pf1/WSqWT9ZIshtC5vlV 18 rounds',
    ],
    // The Mad Dog's Rage, from 4th, at barbarian level - 3.
    [
      'a Mad Dog Barbarian 4',
      [[classes.barbarian, 4]],
      madDog,
      'everythingpath/barbarian-mad-dog-rage 6 rounds',
    ],
    [
      'a Mad Dog Barbarian 8',
      [[classes.barbarian, 8]],
      madDog,
      'everythingpath/barbarian-mad-dog-rage 14 rounds',
    ],
    // Bloodrage: as rage, its own pool.
    [
      'a Bloodrager 1',
      [[classes.bloodrager, 1]],
      {},
      'pf1/5op6M5xchCJNsYRt 6 rounds',
    ],
    [
      'a Bloodrager 4 with Extra Rage',
      [[classes.bloodrager, 4]],
      extra(feats.extraRage),
      'pf1/5op6M5xchCJNsYRt 18 rounds',
    ],
    // Bardic Performance: 4 + Cha + 2 per level after 1st, Extra
    // Performance 6.
    ['a Bard 1', [[classes.bard, 1]], {}, 'pf1/ZfCUTi1MiLgR4T7I 8 rounds'],
    [
      'a Bard 4 with Extra Performance',
      [[classes.bard, 4]],
      extra(feats.extraPerformance),
      'pf1/ZfCUTi1MiLgR4T7I 20 rounds',
    ],
    // Arcane Pool: half the level (minimum 1) + Int (Int 16), Extra Arcane
    // Pool 2.
    ['a Magus 20', [[classes.magus, 20]], {}, 'pf1/mpe3JHJMINddqLWr 13 points'],
    [
      'a Magus 1 with Extra Arcane Pool',
      [[classes.magus, 1]],
      extra(feats.extraArcanePool),
      'pf1/mpe3JHJMINddqLWr 6 points',
    ],
    // Lay on Hands: half the level + Cha, Extra Lay On Hands 2.
    ['a Paladin 2', [[classes.paladin, 2]], {}, 'pf1/WhE4j0Jc82npdMCP 5 uses'],
    [
      'a Paladin 4 with Extra Lay On Hands',
      [[classes.paladin, 4]],
      extra(feats.extraLayOnHands),
      'pf1/WhE4j0Jc82npdMCP 8 uses',
    ],
    // Ki Pool (Unchained): half the level + Wis (Wis 12), from 3rd; Extra
    // Ki 2.
    [
      'an Unchained Monk 3',
      [[classes.unchainedMonk, 3]],
      {},
      'pf1/7BfYNNkYjjBevun8 2 points',
    ],
    [
      'an Unchained Monk 10 with Extra Ki',
      [[classes.unchainedMonk, 10]],
      extra(feats.extraKi),
      'pf1/7BfYNNkYjjBevun8 8 points',
    ],
  ] as const)('%s', (...[, levels, options, shown]) => {
    expect(maxima(promoted, levels, options)).toEqual(withoutHeld([shown]));
    expect(maxima(unheld, levels, options)).toEqual([shown]);
  });

  // At score 1 each own amount is below 0; the sheet floors the raw sum at 0
  // and the chip carries it, and an increase adds to that sum before the
  // floor.
  it.each([
    [classes.cleric, 1, 'charisma', {}, 'pf1/kXXz1lO4i7CibHJ9 0 uses', -2],
    [
      classes.cleric,
      1,
      'charisma',
      extra(feats.extraChannel),
      'pf1/kXXz1lO4i7CibHJ9 0 uses',
      null,
    ],
    [
      classes.barbarian,
      1,
      'constitution',
      {},
      'pf1/WSqWT9ZIshtC5vlV 0 rounds',
      -1,
    ],
    [
      classes.barbarian,
      4,
      'constitution',
      madDog,
      'everythingpath/barbarian-mad-dog-rage 0 rounds',
      -1,
    ],
    [
      classes.bloodrager,
      1,
      'constitution',
      {},
      'pf1/5op6M5xchCJNsYRt 0 rounds',
      -1,
    ],
    [classes.bard, 1, 'charisma', {}, 'pf1/ZfCUTi1MiLgR4T7I 0 rounds', -1],
    [
      classes.bard,
      1,
      'charisma',
      extra(feats.extraPerformance),
      'pf1/ZfCUTi1MiLgR4T7I 5 rounds',
      null,
    ],
    [classes.magus, 1, 'intelligence', {}, 'pf1/mpe3JHJMINddqLWr 0 points', -4],
    [
      classes.magus,
      1,
      'intelligence',
      extra(feats.extraArcanePool),
      'pf1/mpe3JHJMINddqLWr 0 points',
      -2,
    ],
    [
      classes.magus,
      1,
      'intelligence',
      extra(feats.extraArcanePool, 2),
      'pf1/mpe3JHJMINddqLWr 0 points',
      null,
    ],
    [classes.paladin, 2, 'charisma', {}, 'pf1/WhE4j0Jc82npdMCP 0 uses', -4],
    [
      classes.paladin,
      2,
      'charisma',
      extra(feats.extraLayOnHands),
      'pf1/WhE4j0Jc82npdMCP 0 uses',
      -2,
    ],
    [
      classes.unchainedMonk,
      3,
      'wisdom',
      {},
      'pf1/7BfYNNkYjjBevun8 0 points',
      -4,
    ],
    [
      classes.unchainedMonk,
      3,
      'wisdom',
      extra(feats.extraKi),
      'pf1/7BfYNNkYjjBevun8 0 points',
      -2,
    ],
  ] as const)(
    'at score 1: a %s %i with %s 1 (%o) shows %s, floored from %s',
    (...[classKey, level, ability, options, shown, sum]) => {
      const setting = { ...options, scores: { [ability]: 1 } };
      const floored = sum === null ? [] : [`${shown.split(' ')[0]} ${sum}`];
      expect(maxima(promoted, [[classKey, level]], setting)).toEqual(
        withoutHeld([shown]),
      );
      expect(floors(promoted, [[classKey, level]], setting)).toEqual(
        withoutHeld(floored),
      );
      expect(maxima(unheld, [[classKey, level]], setting)).toEqual([shown]);
      expect(floors(unheld, [[classKey, level]], setting)).toEqual(floored);
    },
  );

  // The four that were sent toward promotion (the Magus's two now checked)
  // against the pinned text, one and two copies of
  // each increase: Bardic Performance "4 + his Charisma modifier" and 2 more
  // rounds at each level after 1st (PRD coreRulebook/classes/bard.html:411),
  // Extra Performance "6 additional rounds per day … multiple times. Its
  // effects stack." (pf1 packs/feats/extra-performance…yaml:16-19); the
  // Magus's pool "1/2 his magus level (minimum 1) + his Intelligence
  // modifier" (PRD ultimateMagic/spellcasters/magus.html:395), Extra Arcane
  // Pool "increases by 2 … multiple times. Its effects stack"
  // (extra-arcane-pool…yaml:13-16). The raw sum is floored at 0 after the
  // increases (root's decision, 2026-11-18, not the rules'); the chip gives
  // the raw sum only where it is below 0 (here the calculated maxima and
  // their floor sums are compared; no chip is rendered). Fix r11 held Bardic
  // Performance and Extra Performance; the record step checked them on
  // reward-terms-1's review (its phase 2), as it checked the Magus's two on
  // maxima-promote-1's, so as committed the calculation gives what
  // `promoted` and the probe (`unheld`) give: each maximum and floor sum.
  it.each([
    // Cha 18 (+4): Bard 4 is 4 + 4 + 6 = 14, + 6 per copy.
    [
      classes.bard,
      4,
      {},
      extra(feats.extraPerformance, 2),
      'pf1/ZfCUTi1MiLgR4T7I 26 rounds',
      null,
    ],
    // Cha 1 (−5): Bard 1 is −1; + 6 = 5; + 12 = 11.
    [classes.bard, 1, { charisma: 1 }, {}, 'pf1/ZfCUTi1MiLgR4T7I 0 rounds', -1],
    [
      classes.bard,
      1,
      { charisma: 1 },
      extra(feats.extraPerformance),
      'pf1/ZfCUTi1MiLgR4T7I 5 rounds',
      null,
    ],
    [
      classes.bard,
      1,
      { charisma: 1 },
      extra(feats.extraPerformance, 2),
      'pf1/ZfCUTi1MiLgR4T7I 11 rounds',
      null,
    ],
    // Int 16 (+3): Magus 4 is 2 + 3 = 5, + 2 per copy.
    [
      classes.magus,
      4,
      {},
      extra(feats.extraArcanePool),
      'pf1/mpe3JHJMINddqLWr 7 points',
      null,
    ],
    [
      classes.magus,
      4,
      {},
      extra(feats.extraArcanePool, 2),
      'pf1/mpe3JHJMINddqLWr 9 points',
      null,
    ],
    // Int 1 (−5): Magus 1 is max(1, 0) − 5 = −4; + 2 = −2; + 4 = 0; + 6 = 2.
    [
      classes.magus,
      1,
      { intelligence: 1 },
      extra(feats.extraArcanePool, 3),
      'pf1/mpe3JHJMINddqLWr 2 points',
      null,
    ],
    // Int 1 at Magus 20: 10 − 5 = 5, + 2 = 7.
    [
      classes.magus,
      20,
      { intelligence: 1 },
      extra(feats.extraArcanePool),
      'pf1/mpe3JHJMINddqLWr 7 points',
      null,
    ],
  ] as const)(
    'a %s %i with scores %o and %o shows %s (floored from %s), checked; as committed the same as checked in memory',
    (...[classKey, level, scoreSetting, options, shown, sum]) => {
      const setting = { ...options, scores: scoreSetting };
      const floored = sum === null ? [] : [`${shown.split(' ')[0]} ${sum}`];
      expect(maxima(promoted, [[classKey, level]], setting)).toEqual(
        withoutHeld([shown]),
      );
      expect(floors(promoted, [[classKey, level]], setting)).toEqual(
        withoutHeld(floored),
      );
      expect(maxima(unheld, [[classKey, level]], setting)).toEqual([shown]);
      expect(floors(unheld, [[classKey, level]], setting)).toEqual(floored);
      expect(maxima(asCommitted, [[classKey, level]], setting)).toEqual(
        withoutHeld([shown]),
      );
      expect(floors(asCommitted, [[classKey, level]], setting)).toEqual(
        withoutHeld(floored),
      );
    },
  );

  // maxima-promote-1 rebase onto rotation-6: rotation-6 adds `oncePerSource`
  // and `choice` on increases, `joins` on a maximum and not-counted lines on
  // a maximum. The four that were sent toward promotion carry none of these fields,
  // so each copy of an increase adds and the maximum has no line not counted,
  // as before rotation-6. The Bard's two, held by fix r11, are checked since
  // reward-terms-1 phase 2: as committed they give what the probe gives.
  it('the four carry no rotation-6 field and compute as before: the Magus’s pool with Extra Arcane Pool, and Bardic Performance with two copies of Extra Performance, all checked', () => {
    expect(forPromotion).toHaveLength(2);
    const four = committed.filter(({ externalKey }) =>
      [...promotable, 'pf1/ZfCUTi1MiLgR4T7I', feats.extraPerformance].includes(
        externalKey,
      ),
    );
    expect(four).toHaveLength(4);
    for (const { outputs } of four) {
      for (const { ruleValue } of outputs) {
        expect(ruleValue).not.toHaveProperty('oncePerSource');
        expect(ruleValue).not.toHaveProperty('choice');
        expect(ruleValue).not.toHaveProperty('joins');
      }
    }
    const shown = (
      levels: ClassLevels,
      options: Parameters<typeof sheetMaxima>[2],
      artifact = promoted,
    ) =>
      sheetMaxima(artifact, levels, options).map(
        ({ name, value, unit, sources, sourceEntries, floor, notCounted }) => ({
          shown: `${name} ${value} ${unit}`,
          sources: sourceEntries,
          // Each copy of a feat is its own sheet entry, so its own source.
          distinctSources: new Set(sources.map(({ entryId }) => entryId)).size,
          floor,
          notCounted,
        }),
      );
    // Cha 18 (+4): 4 + 4 + 6 = 14, + 6 for each of two copies; checked, so
    // as committed the same as in the probe.
    expect(
      shown([[classes.bard, 4]], extra(feats.extraPerformance, 2)),
    ).toEqual(
      shown([[classes.bard, 4]], extra(feats.extraPerformance, 2), unheld),
    );
    expect(
      shown([[classes.bard, 4]], extra(feats.extraPerformance, 2), unheld),
    ).toEqual([
      {
        shown: 'pf1/ZfCUTi1MiLgR4T7I 26 rounds',
        sources: [
          {
            name: 'Bardic Performance',
            catalogEntryId: 'pf1/ZfCUTi1MiLgR4T7I',
          },
          {
            name: 'Extra Performance',
            catalogEntryId: feats.extraPerformance,
          },
          {
            name: 'Extra Performance',
            catalogEntryId: feats.extraPerformance,
          },
        ],
        distinctSources: 3,
        floor: undefined,
        notCounted: undefined,
      },
    ]);
    // Int 16 (+3): 2 + 3 = 5, + 2.
    expect(shown([[classes.magus, 4]], extra(feats.extraArcanePool))).toEqual([
      {
        shown: 'pf1/mpe3JHJMINddqLWr 7 points',
        sources: [
          { name: 'Arcane Pool', catalogEntryId: 'pf1/mpe3JHJMINddqLWr' },
          { name: 'Extra Arcane Pool', catalogEntryId: feats.extraArcanePool },
        ],
        distinctSources: 2,
        floor: undefined,
        notCounted: undefined,
      },
    ]);
  });

  it('the Bladebound’s pool is held, so Extra Arcane Pool raises nothing for a Bladebound', () => {
    expect(
      maxima(promoted, [[classes.magus, 4]], {
        archetype: archetypes.bladebound,
        ...extra(feats.extraArcanePool),
      }),
    ).toEqual([]);
  });

  /**
   * Each party character with the standard scores (Con 14, Int 16, Wis 12,
   * Cha 18), as the probe gives it; of stats-d3's records `promoted` shows
   * only 13's Bardic Performance (checked since reward-terms-1 phase 2); this
   * tree holds no domain power.
   */
  const partyShown: Record<(typeof party)[number][0], readonly string[]> = {
    '3 (Cleric 8, Extra Channel)': ['pf1/kXXz1lO4i7CibHJ9 9 uses'],
    '4 (Mad Dog Barbarian 8)': [
      'everythingpath/barbarian-mad-dog-rage 14 rounds',
    ],
    // Channel only: Stunning Fist is held.
    '6 (Ecclesitheurge Cleric 5 / Monk 1)': ['pf1/kXXz1lO4i7CibHJ9 7 uses'],
    '7 (Bloodrager 4 / Scaled Fist Monk 1 / Dragon Disciple 3)': [
      'pf1/5op6M5xchCJNsYRt 12 rounds',
    ],
    // The Bladebound's pool is held.
    '8 (Bladebound Magus 4)': [],
    '10 (Bloodrager 4)': ['pf1/5op6M5xchCJNsYRt 12 rounds'],
    '11 (Exploiter Wizard 4)': [],
    // Lay on hands only: Smite Evil is held.
    '12 (Paladin 4)': ['pf1/WhE4j0Jc82npdMCP 6 uses'],
    '13 (Bard 4, Extra Performance)': ['pf1/ZfCUTi1MiLgR4T7I 20 rounds'],
  };
  it.each(party)('%s', (...[character, levels, options]) => {
    expect(maxima(promoted, levels, options)).toEqual(
      withoutHeld(partyShown[character]),
    );
    expect(maxima(unheld, levels, options)).toEqual(partyShown[character]);
  });

  it('of stats-d3’s records only 13 gets a number: its Bardic Performance, checked since reward-terms-1 phase 2', () => {
    expect(
      party.flatMap(([character, levels, options]) =>
        maxima(promoted, levels, options).length ? [character] : [],
      ),
    ).toEqual(['13 (Bard 4, Extra Performance)']);
  });

  // The party's own sheets (ORCH research/party-sheets, numbers only): each
  // build with the ability score its paper sheet writes, against the number
  // the paper writes, the held ones as the probe gives them. Where they
  // differ nothing is adjusted; the difference is reported (ORCH
  // maxima-promote-1/boundary.md §6).
  it.each([
    [
      '3: Cleric 8, Charisma 22, Extra Channel; the paper writes 11',
      [[classes.cleric, 8]],
      { scores: { charisma: 22 }, ...extra(feats.extraChannel) },
      ['pf1/kXXz1lO4i7CibHJ9 11 uses'],
    ],
    [
      '4: Mad Dog Barbarian 8, Constitution 14; the paper writes 10 rounds',
      [[classes.barbarian, 8]],
      { scores: { constitution: 14 }, ...madDog },
      ['everythingpath/barbarian-mad-dog-rage 14 rounds'],
    ],
    [
      '6: Ecclesitheurge Cleric 5 / Monk 1, Charisma 7; the paper writes no number',
      [
        [classes.cleric, 5],
        [classes.monk, 1],
      ],
      { scores: { charisma: 7 }, archetype: archetypes.ecclesitheurge },
      ['pf1/kXXz1lO4i7CibHJ9 1 uses'],
    ],
    [
      '7: Bloodrager 4 / Scaled Fist Monk 1 / Dragon Disciple 3, Constitution 16; the paper writes 13 rounds',
      [
        [classes.bloodrager, 4],
        [classes.monk, 1],
        [classes.dragonDisciple, 3],
      ],
      { scores: { constitution: 16 }, archetype: archetypes.scaledFist },
      ['pf1/5op6M5xchCJNsYRt 13 rounds'],
    ],
    [
      '10: Bloodrager 4, Constitution 12; the paper writes 15 rounds',
      [[classes.bloodrager, 4]],
      { scores: { constitution: 12 } },
      ['pf1/5op6M5xchCJNsYRt 11 rounds'],
    ],
    [
      '12: Paladin 4, Charisma 17; the paper writes 5',
      [[classes.paladin, 4]],
      { scores: { charisma: 17 } },
      ['pf1/WhE4j0Jc82npdMCP 5 uses'],
    ],
    [
      '13: Bard 3, Charisma 18, Extra Performance; the paper writes no number',
      [[classes.bard, 3]],
      { scores: { charisma: 18 }, ...extra(feats.extraPerformance) },
      ['pf1/ZfCUTi1MiLgR4T7I 18 rounds'],
    ],
    [
      '13: Bard 4, Charisma 18, Extra Performance; the paper writes no number',
      [[classes.bard, 4]],
      { scores: { charisma: 18 }, ...extra(feats.extraPerformance) },
      ['pf1/ZfCUTi1MiLgR4T7I 20 rounds'],
    ],
  ] as const)('%s', (...[, levels, options, expected]) => {
    expect(maxima(promoted, levels, options)).toEqual(withoutHeld(expected));
    expect(maxima(unheld, levels, options)).toEqual(expected);
  });
});

/**
 * reward-terms-1: Bardic Performance counts its favored-class reward.
 * campaign-mvp-v1 holds the Advanced Player's Guide favored-class reward
 * Bardic Performance Round, "Add 1 to the bard's total number of bardic
 * performance rounds per day." (PCGen apg_abilities_race.lst:142, STACK:YES
 * MULT:YES), for a Gnome or Half-Elf Bard; it held the record and Extra
 * Performance (maxima-promote-1 fix r11). A Class Level saves it as
 * rotation-7's structured choice (`{ choice: 'reward', reward:
 * 'bardicPerformanceRound' }`), and the record's formula now reads its count,
 * `@favoredClassReward.bardicPerformanceRound`: the Class Levels that chose it
 * and count (a Bard level, Bard a favored class, and a character the sheet
 * counts as a Gnome or a Half-Elf: by race, or by Racial Heritage saving one
 * of them, whatever the base race; the Human cases below are an example). The record step checked the two on their promotion review
 * (phase 2, `rewardTermsRun`); `rewardTermsChecked`, checking them in memory
 * as it does, gives what the committed records give, and the cases compare
 * both. Each case goes through the sheet's calculation
 * (`calculateCharacterSheet`) with the definitions global, as the import
 * stores them (`sheetCatalog`). The Gnome is the pinned Foundry race with its
 * ability changes, Constitution +2, Charisma +2, Strength −2 (pf1
 * packs/races/gnome.efwHEwjvL9Z94MJI.yaml:9-21); the Half-Elf, the Human and
 * the Half-Orc each take their "+2 to one ability score" in Charisma (their
 * Foundry races carry no ability change), so each sheet's Charisma is its
 * base score + 2.
 */
describe('Bardic Performance counts its favored-class reward (reward-terms-1)', () => {
  const note =
    "Add 1 to the bard's total number of bardic performance rounds per day.";
  const bardicPerformance = 'pf1/ZfCUTi1MiLgR4T7I';
  const racial = (target: keyof typeof abilityTargets, value: number) => ({
    target: abilityTargets[target],
    bonusType: 'racial' as const,
    value,
  });
  const races = {
    gnome: {
      _id: 'pf1/efwHEwjvL9Z94MJI',
      name: 'Gnome',
      modifiers: [
        racial('constitution', 2),
        racial('charisma', 2),
        racial('strength', -2),
      ],
    },
    halfElf: {
      _id: 'pf1/cCepRrfH5SalFfT4',
      name: 'Half-Elf',
      modifiers: [racial('charisma', 2)],
    },
    human: {
      _id: 'pf1/e6IaBxKgMxy1yKlr',
      name: 'Human',
      modifiers: [racial('charisma', 2)],
    },
    halfOrc: {
      _id: 'pf1/dCAXgdA6Db1Z3ccz',
      name: 'Half-Orc',
      modifiers: [racial('charisma', 2)],
    },
  } as const;
  /**
   * A Character of `race` and `levels` with Charisma `charisma` on the sheet
   * (its base score 2 less), whose favored classes are `favored` (Bard), and
   * whose first `rewardLevels` Class Levels save the favored class bonus
   * `rewarded`: rotation-7's structured choice of the listed reward
   * (`'choice'`) or, as before it, the reward's text as a note (`'note'`).
   * `heritage` adds the imported Racial Heritage with that race saved as its
   * choice (phase 1b, the promotion review's finding). `offered` is the
   * rewards the first Class Level's favored class bonus offers by name, as
   * the sheet's classes view composes them (`favoredClassRewardsFor`): the
   * listed rewards of its class for a race the calculation counts the
   * character as.
   */
  const sheetOf = (
    artifact: Artifact,
    {
      race,
      levels,
      charisma = 18,
      rewardLevels = 0,
      rewarded = 'choice',
      rows = [],
      favored = [classes.bard],
      heritage,
    }: {
      heritage?: string;
      race: keyof typeof races;
      levels: ClassLevels;
      charisma?: number;
      rewardLevels?: number;
      rewarded?: 'choice' | 'note';
      rows?: CharacterOptions['rows'];
      favored?: readonly string[];
    },
  ) => {
    const input = character(artifact, levels, {
      scores: { ...scores, charisma: charisma - 2 },
      rows,
    });
    const { _id, name, modifiers } = races[race];
    const sheetInput: CharacterSheetInput = {
      ...input,
      catalogEntries: [
        ...input.catalogEntries,
        {
          scope: 'global' as const,
          _id,
          ruleIdentity: _id,
          name,
          modifiers: [...modifiers],
          detail: { kind: 'race', racialTraits: [] },
        },
      ],
      entries: [
        ...input.entries,
        {
          _id: 'race-row',
          kind: 'race' as const,
          active: true,
          catalogEntryId: _id,
          state: { kind: 'race' as const },
        },
        ...(heritage === undefined
          ? []
          : [
              {
                _id: 'heritage-row',
                kind: 'feat' as const,
                active: true,
                catalogEntryId: racialHeritage,
                state: { kind: 'feat' as const, choice: heritage },
              },
            ]),
      ].map((entry) => {
        if (entry.kind === 'base')
          return {
            ...entry,
            state: { ...entry.state, favoredClassIds: [...favored] },
          };
        if (entry.kind === 'classLevel' && entry.state.position <= rewardLevels)
          return {
            ...entry,
            state: {
              ...entry.state,
              favoredClassBonus:
                rewarded === 'note'
                  ? { choice: 'alt' as const, note }
                  : {
                      choice: 'reward' as const,
                      reward: 'bardicPerformanceRound',
                    },
            },
          };
        return entry;
      }),
    };
    const result = calculateCharacterSheet(sheetInput);
    const names = new Map(
      result.resolvedEntries.map(({ entry }) => [
        entry._id,
        'catalogEntryId' in entry ? entry.catalogEntryId : entry._id,
      ]),
    );
    const [firstClass] = levels;
    const levelClass = sheetInput.catalogEntries.find(
      (entry) => entry._id === firstClass?.[0],
    );
    const offered = favoredClassRewardsFitting({
      classIdentities: levelClassIdentities(
        levelClass,
        sheetInput.catalogEntries,
      ),
      raceIdentities: rewardRaceIdentities(
        activeRaceIdentities(sheetInput),
        result.racial.countsAsRaces,
      ),
    }).map(({ id }) => id);
    return {
      offered,
      notCounted: result.warnings.filter(
        ({ check }) => check === 'favoredClassRewardNotCounted',
      ).length,
      shown: result.dailyMaxima.map(
        ({ entryId, value, unit }) => `${names.get(entryId)} ${value} ${unit}`,
      ),
    };
  };
  const rounds = (value: number) => [`${bardicPerformance} ${value} rounds`];
  const extraPerformance = (copies: number) =>
    Array.from({ length: copies }, () => feat(feats.extraPerformance));

  // maxima-promote-1 fix r16's probe, a Gnome Bard who chose the reward at
  // each level (Charisma 18): the drafted record without the term showed 8,
  // 14 and 14 where the rules give 9, 15 and 18; with it, the rules' numbers.
  it.each([
    ['Gnome', 1, 0, 9, 'gnome'],
    ['Gnome', 1, 1, 15, 'gnome'],
    ['Gnome', 4, 0, 18, 'gnome'],
    ['Half-Elf', 1, 0, 9, 'halfElf'],
    ['Half-Elf', 1, 1, 15, 'halfElf'],
    ['Half-Elf', 4, 0, 18, 'halfElf'],
  ] as const)(
    'a %s Bard %i with Extra Performance ×%i who chose the reward at each level: %i rounds, as committed since the record step checked the two, and a note counts nothing',
    (...[, level, copies, shown, race]) => {
      const build = {
        race,
        levels: [[classes.bard, level]],
        rewardLevels: level,
        rows: extraPerformance(copies),
      } as const;
      const chosen = sheetOf(rewardTermsChecked, build);
      expect(chosen).toEqual({
        offered: ['bardicPerformanceRound'],
        notCounted: 0,
        shown: rounds(shown),
      });
      // Checked by the record step (phase 2): as committed, the same.
      expect(sheetOf(asCommitted, build)).toEqual(chosen);
      // A note is free text the sheet does not count, as before rotation-7.
      expect(
        sheetOf(rewardTermsChecked, { ...build, rewarded: 'note' }).shown,
      ).toEqual(rounds(shown - level));
    },
  );

  /**
   * A Gnome Bard 1 to 20 by the rules: "4 + his Charisma modifier" and "2
   * additional rounds per day" at each level after 1st (PRD
   * coreRulebook/classes/bard.html:411), 1 more per reward chosen
   * (apg_abilities_race.lst:142), 6 more per copy of Extra Performance
   * ("Its effects stack", pf1 packs/feats/extra-performance.6yGoL82RidBHmXPb
   * .yaml:16-19). Each row: Charisma 10 with 0, 1 and 5 reward levels, then
   * Charisma 18 with the same; a Bard below 5th has a reward at each level.
   */
  const levelTable: readonly (readonly [
    level: number,
    ...rounds: [number, number, number, number, number, number],
  ])[] = [
    [1, 4, 5, 5, 8, 9, 9],
    [2, 6, 7, 8, 10, 11, 12],
    [3, 8, 9, 11, 12, 13, 15],
    [4, 10, 11, 14, 14, 15, 18],
    [5, 12, 13, 17, 16, 17, 21],
    [6, 14, 15, 19, 18, 19, 23],
    [7, 16, 17, 21, 20, 21, 25],
    [8, 18, 19, 23, 22, 23, 27],
    [9, 20, 21, 25, 24, 25, 29],
    [10, 22, 23, 27, 26, 27, 31],
    [11, 24, 25, 29, 28, 29, 33],
    [12, 26, 27, 31, 30, 31, 35],
    [13, 28, 29, 33, 32, 33, 37],
    [14, 30, 31, 35, 34, 35, 39],
    [15, 32, 33, 37, 36, 37, 41],
    [16, 34, 35, 39, 38, 39, 43],
    [17, 36, 37, 41, 40, 41, 45],
    [18, 38, 39, 43, 42, 43, 47],
    [19, 40, 41, 45, 44, 45, 49],
    [20, 42, 43, 47, 46, 47, 51],
  ];
  it.each(levelTable)(
    'a Gnome Bard %i, Charisma 10 and 18, 0, 1 and 5 reward levels, with 0, 1 and 2 copies of Extra Performance',
    (level, ...table) => {
      const builds = [10, 18].flatMap((charisma) =>
        [0, 1, 5].map((rewards) => ({ charisma, rewards })),
      );
      const shown = builds.map(({ charisma, rewards }) =>
        [0, 1, 2].map(
          (copies) =>
            sheetOf(rewardTermsChecked, {
              race: 'gnome',
              levels: [[classes.bard, level]],
              charisma,
              rewardLevels: Math.min(rewards, level),
              rows: extraPerformance(copies),
            }).shown,
        ),
      );
      expect(shown).toEqual(
        table.map((value) => [0, 6, 12].map((extra) => rounds(value + extra))),
      );
    },
    120_000,
  );

  it.each([
    // A Human's Bard reward is a spell known (apg_abilities_race.lst:140).
    ['Human', 'human'],
    // The Advanced Race Guide's Half-Orc Bard round is a comparison entry
    // only (arg-fcb/74, halfOrcs.html:407), no reward of the release scopes.
    ['Half-Orc', 'halfOrc'],
  ] as const)(
    'a %s Bard 4 who chose the reward at each level gets nothing from it, with a warning on each level',
    (...[, race]) => {
      expect(
        sheetOf(rewardTermsChecked, {
          race,
          levels: [[classes.bard, 4]],
          rewardLevels: 4,
        }),
      ).toEqual({ offered: [], notCounted: 4, shown: rounds(14) });
    },
  );

  it('a reward level that does not count adds nothing: a Sorcerer level, or Bard levels when Bard is not a favored class', () => {
    // Bard 3 / Sorcerer 1, the reward on all four: the three Bard levels count.
    expect(
      sheetOf(rewardTermsChecked, {
        race: 'gnome',
        levels: [
          [classes.bard, 3],
          [classes.sorcerer, 1],
        ],
        rewardLevels: 4,
        favored: [classes.bard, classes.sorcerer],
      }),
    ).toEqual({
      offered: ['bardicPerformanceRound'],
      notCounted: 1,
      shown: rounds(12 + 3),
    });
    // Bard 2 whose favored class is Sorcerer: neither level counts.
    expect(
      sheetOf(rewardTermsChecked, {
        race: 'gnome',
        levels: [[classes.bard, 2]],
        rewardLevels: 2,
        favored: [classes.sorcerer],
      }),
    ).toEqual({
      offered: ['bardicPerformanceRound'],
      notCounted: 2,
      shown: rounds(10),
    });
  });

  // Phase 1b (the promotion review's finding, racial-heritage-counts-as):
  // Racial Heritage, "You count as both human and that race for any effects
  // related to race", makes a Human with Gnome or Half-Elf saved as its race
  // one of the reward's races, so a Human Bard may take the reward and it
  // counts; without the feat, or with another race saved, it is not offered.
  it.each([
    ['Gnome', races.gnome._id],
    ['Half-Elf', races.halfElf._id],
  ] as const)(
    'a Human Bard 1, Charisma 18, with Racial Heritage (%s) and the reward chosen: 9 rounds (8 without the reward, 15 with Extra Performance)',
    (...[, heritage]) => {
      const build = {
        race: 'human',
        levels: [[classes.bard, 1]],
        heritage,
      } as const;
      expect(
        sheetOf(rewardTermsChecked, { ...build, rewardLevels: 1 }),
      ).toEqual({
        offered: ['bardicPerformanceRound'],
        notCounted: 0,
        shown: rounds(9),
      });
      expect(sheetOf(rewardTermsChecked, build)).toEqual({
        offered: ['bardicPerformanceRound'],
        notCounted: 0,
        shown: rounds(8),
      });
      expect(
        sheetOf(rewardTermsChecked, {
          ...build,
          rewardLevels: 1,
          rows: extraPerformance(1),
        }).shown,
      ).toEqual(rounds(15));
      expect(sheetOf(asCommitted, { ...build, rewardLevels: 1 }).shown).toEqual(
        rounds(9),
      );
    },
  );

  it('a Human Bard without Racial Heritage, or with Elf saved as its race, is not offered the reward, and a reward chosen anyway is not counted', () => {
    for (const heritage of [undefined, 'pf1/NgIhxRI0axrf3fcO']) {
      const build = {
        race: 'human',
        levels: [[classes.bard, 1]],
        ...(heritage && { heritage }),
      } as const;
      expect(sheetOf(rewardTermsChecked, build).offered).toEqual([]);
      expect(
        sheetOf(rewardTermsChecked, { ...build, rewardLevels: 1 }),
      ).toEqual({ offered: [], notCounted: 1, shown: rounds(8) });
    }
  });

  // Character 13 (party-builds.json): a Human Bard 3 or 4 with Charisma 18
  // and Extra Performance, without Racial Heritage. The party inputs record
  // no favored class bonus; a Human's own Bard reward adds no rounds, so
  // whatever 13 chose the record gives 18 and 20 as committed; the round
  // reward chosen anyway is not counted.
  it.each([
    [3, 18],
    [4, 20],
  ] as const)(
    '13 at Bard %i: %i rounds, as committed, with or without the reward chosen',
    (level, shown) => {
      const build = {
        race: 'human',
        levels: [[classes.bard, level]],
        rows: extraPerformance(1),
      } as const;
      expect(sheetOf(rewardTermsChecked, build)).toEqual({
        offered: [],
        notCounted: 0,
        shown: rounds(shown),
      });
      expect(
        sheetOf(rewardTermsChecked, { ...build, rewardLevels: level }),
      ).toEqual({ offered: [], notCounted: level, shown: rounds(shown) });
      expect(sheetOf(asCommitted, build).shown).toEqual(rounds(shown));
    },
  );
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

  // maxima-promote-1: the record does not use the feat's choice of channel (it
  // carries no `choice`, which the sheet reads since rotation-6), so it gives the Cleric's channel 2 only where that is the only
  // channel the feat can have been taken for, and nothing where another
  // class may give one (a Paladin from 4th, an Oracle, a Wizard …).
  it.each([
    [
      'a Cleric 8: 2 more',
      [[classes.cleric, 8]],
      'pf1/kXXz1lO4i7CibHJ9 9 uses',
    ],
    [
      'a Cleric 5 / Paladin 3, before the paladin’s channel: 2 more',
      [
        [classes.cleric, 5],
        [classes.paladin, 3],
      ],
      'pf1/kXXz1lO4i7CibHJ9 9 uses',
    ],
    [
      'a Cleric 5 / Paladin 4: nothing, the feat may be the paladin’s',
      [
        [classes.cleric, 5],
        [classes.paladin, 4],
      ],
      'pf1/kXXz1lO4i7CibHJ9 7 uses',
    ],
    [
      'a Cleric 5 / Wizard 1: nothing, the feat may be a necromancer’s',
      [
        [classes.cleric, 5],
        [classes.wizard, 1],
      ],
      'pf1/kXXz1lO4i7CibHJ9 7 uses',
    ],
    // fix r1: a Druid's domain powers channel, and a Sorcerer's bloodline
    // from 9th (Sacred Cistern; Healing Fire from 15th).
    [
      'a Cleric 5 / Druid 1: nothing, the feat may be a druid’s domain’s',
      [
        [classes.cleric, 5],
        [classes.druid, 1],
      ],
      'pf1/kXXz1lO4i7CibHJ9 7 uses',
    ],
    [
      'a Cleric 5 / Sorcerer 8, before a bloodline’s channel: 2 more',
      [
        [classes.cleric, 5],
        [classes.sorcerer, 8],
      ],
      'pf1/kXXz1lO4i7CibHJ9 9 uses',
    ],
    [
      'a Cleric 5 / Sorcerer 9: nothing, the feat may be a sacred cistern’s',
      [
        [classes.cleric, 5],
        [classes.sorcerer, 9],
      ],
      'pf1/kXXz1lO4i7CibHJ9 7 uses',
    ],
  ] as const)(
    'Extra Channel raises only a channel it can only have been taken for: %s',
    (...[, levels, shown]) => {
      expect(
        maxima(checked, levels, { rows: [feat(feats.extraChannel)] }),
      ).toContain(shown);
    },
  );

  // maxima-promote-1 fix r1 (root 2026-11-20): Extra Rage's 6 rounds go to
  // rage only without bloodrager levels and to bloodrage only without a class
  // that may give rage (a Barbarian or Unchained Barbarian; a Cleric from 8th,
  // the Rage subdomain; an Inquisitor from 6th, Divine Anger), so to neither
  // where both may be: the owner's question (each, one, or the player's
  // choice). Held.
  it.each([
    [
      'a Barbarian 4 / Bloodrager 4: neither',
      [
        [classes.barbarian, 4],
        [classes.bloodrager, 4],
      ],
      ['pf1/5op6M5xchCJNsYRt 12 rounds', 'pf1/WSqWT9ZIshtC5vlV 12 rounds'],
    ],
    [
      'a Bloodrager 4 / Cleric 7: bloodrage',
      [
        [classes.bloodrager, 4],
        [classes.cleric, 7],
      ],
      ['pf1/5op6M5xchCJNsYRt 18 rounds'],
    ],
    [
      'a Bloodrager 4 / Cleric 8: neither, the cleric may rage',
      [
        [classes.bloodrager, 4],
        [classes.cleric, 8],
      ],
      ['pf1/5op6M5xchCJNsYRt 12 rounds'],
    ],
    [
      'a Bloodrager 4 / Inquisitor 5: bloodrage',
      [
        [classes.bloodrager, 4],
        [classes.inquisitor, 5],
      ],
      ['pf1/5op6M5xchCJNsYRt 18 rounds'],
    ],
    [
      'a Bloodrager 4 / Inquisitor 6: neither, the inquisitor may rage',
      [
        [classes.bloodrager, 4],
        [classes.inquisitor, 6],
      ],
      ['pf1/5op6M5xchCJNsYRt 12 rounds'],
    ],
  ] as const)('held: Extra Rage by class, %s', (...[, levels, shown]) => {
    const rages = ['pf1/5op6M5xchCJNsYRt ', 'pf1/WSqWT9ZIshtC5vlV '];
    expect(
      maxima(checked, levels, { rows: [feat(feats.extraRage)] }).filter(
        (each) => rages.some((rage) => each.startsWith(rage)),
      ),
    ).toEqual(shown);
  });

  it('held: Extra Rage taken twice adds 6 per copy, as its text allows ("multiple times. Its effects stack")', () => {
    expect(
      maxima(checked, [[classes.bloodrager, 4]], {
        rows: [feat(feats.extraRage), feat(feats.extraRage)],
      }),
    ).toEqual(['pf1/5op6M5xchCJNsYRt 24 rounds']);
  });

  it('held: Extra Channel taken twice adds 2 per copy with no warning, though neither its text nor PCGen allows a second copy (maxima-promote-1 fix r1)', () => {
    const rows = [feat(feats.extraChannel), feat(feats.extraChannel)];
    expect(maxima(checked, [[classes.cleric, 1]], { rows })).toEqual([
      'pf1/kXXz1lO4i7CibHJ9 11 uses',
    ]);
    // A feat imports as repeatable "unreviewed", which the duplicate check
    // passes (src/lib/character-sheet-selection-rules.ts).
    const { warnings } = calculateCharacterSheet(
      character(checked, [[classes.cleric, 1]], { rows, scores }),
    );
    expect(warnings.filter(({ check }) => check === 'featDuplicate')).toEqual(
      [],
    );
  });

  it('Extra Performance taken twice adds 6 per copy, as its text allows ("multiple times. Its effects stack")', () => {
    expect(
      maxima(checked, [[classes.bard, 4]], {
        rows: [feat(feats.extraPerformance), feat(feats.extraPerformance)],
      }),
    ).toEqual(['pf1/ZfCUTi1MiLgR4T7I 26 rounds']);
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

  // The eight held for the floor until rotation-5 (now two checked, the
  // Magus's Arcane Pool, maxima-promote-1, and Bardic Performance,
  // reward-terms-1; six held by the release-scope boundary), all checked here:
  // their raw sum goes below 0 at the lowest score, and the
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
    'at the lowest score: a %s %i with %s 1 shows %s, floored from %i',
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

  it('with an increase the sum is the rules’ arithmetic, which a floored record would raise', () => {
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
  // maxima-promote-1: Extra Channel's class-gated amount, on a Cleric.
  [feats.extraChannel]: [
    [[classes.cleric, 1]],
    { rows: [feat(feats.extraChannel)] },
  ],
  // fix r1: Extra Rage's amounts by class, on a Barbarian.
  [feats.extraRage]: [
    [[classes.barbarian, 4]],
    { rows: [feat(feats.extraRage)] },
  ],
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
