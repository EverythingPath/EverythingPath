import { section15Registry } from '../../../src/lib/catalog/section15-registry-data.ts';
import { createSection15Lookup } from '../legal/section15-confirmations.ts';
import type { PreviewEntry } from '../map.ts';
import partyBuildsData from '../party/party-builds.json' with { type: 'json' };
import { parsePartyBuilds, partyCharacterKeys } from '../party/party-builds.ts';
import type { ScheduleClassName } from './schedule-model.ts';

/**
 * The importer's PCGen owners (#716 E1): which archetypes and prestige
 * classes `emitPcgenOwners` emits, as reviewed data, one entry per owner with
 * the reason it is selected, and the rule every selection must pass
 * (`ownerSelectionProblems`), decided from the pinned records, never by an
 * entry's say-so.
 */

/**
 * A chosen owner by its file and KEY: an archetype record, on its base
 * class's reviewed schedule, or a prestige class block, on its own reviewed
 * schedule (`reviewedPrestigeSchedule`).
 */
export type PcgenOwnerSelector =
  | {
      kind: 'archetype';
      className: ScheduleClassName;
      file: string;
      key: string;
    }
  | { kind: 'prestige'; file: string; key: string };

/**
 * Why an owner is selected:
 * - `party`: a party build names its key (`party-builds.json`); it is
 *   emitted even with a Product Identity flag, which holds the row on
 *   attribution whatever its structure review says.
 * - `coverage`: a coverage slice selects it; it must be clear of Product
 *   Identity on itself and every feature it owns.
 */
export type OwnerSelectionReason =
  | { kind: 'party' }
  | { kind: 'coverage'; slice: 'archetype-select-monk' };
export type SelectedOwner = PcgenOwnerSelector & {
  reason: OwnerSelectionReason;
};
type NonEmpty<T> = readonly [T, ...T[]];

const party = { kind: 'party' } as const;
/**
 * archetype-select-monk: the Monk's archetypes with no Product Identity flag
 * and every book's notice reviewed, but for the five that change class
 * skills beside Serpent-Fire Adept (Terra-Cotta Monk, Wanderer, Karmic Monk,
 * Sensei, Sage Counselor) and Master of Many Styles, whose Perfect Style the
 * identity ledger holds as a variant, and Vow Monk and the eleven Qinggong
 * Monk records, which give the structure gate nothing to review.
 */
const monkCoverage = {
  kind: 'coverage',
  slice: 'archetype-select-monk',
} as const;

/**
 * The reviewed selection: the party's archetypes (design §A; party-scope A,
 * "Structural findings") and prestige class (#716 D1: Dragon Disciple,
 * research party-code §1), then the coverage slices' owners. A new owner
 * needs its class's reviewed schedule, its and its features' frozen
 * identities and an entry here.
 */
export const reviewedOwnerSelection: NonEmpty<SelectedOwner> = [
  {
    kind: 'archetype',
    className: 'Wizard',
    file: 'roleplaying_game/advanced_class_guide/acg_abilities_class.lst',
    key: 'Wizard Archetype ~ Exploiter Wizard',
    reason: party,
  },
  {
    kind: 'archetype',
    className: 'Cleric',
    file: 'roleplaying_game/advanced_class_guide/acg_abilities_class.lst',
    key: 'Cleric Archetype ~ Ecclesitheurge',
    reason: party,
  },
  {
    kind: 'archetype',
    className: 'Magus',
    file: 'roleplaying_game/ultimate_magic/um_abilities_class.lst',
    key: 'Magus Archetype ~ Bladebound',
    reason: party,
  },
  {
    kind: 'archetype',
    className: 'Barbarian',
    file: 'player_companion/animal_archive/anar_abilities_class.lst',
    key: 'Barbarian Archetype ~ Mad Dog',
    reason: party,
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'player_companion/legacy_of_dragons/lod_abilities_class.lst',
    key: 'Monk Archetype ~ Scaled Fist',
    reason: party,
  },
  {
    kind: 'prestige',
    file: 'roleplaying_game/core_rulebook/cr_classes.lst',
    key: 'Dragon Disciple',
    reason: party,
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'campaign_setting/inner_sea_combat/isc_abilities_class.lst',
    key: 'Monk Archetype ~ Hamatulatsu Master',
    reason: monkCoverage,
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'campaign_setting/inner_sea_combat/isc_abilities_class.lst',
    key: 'Monk Archetype ~ Monk of the Seven Forms',
    reason: monkCoverage,
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'player_companion/dirty_tactics_toolbox/dtt_abilities_class.lst',
    key: 'Monk Archetype ~ Monk of the Mantis',
    reason: monkCoverage,
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'player_companion/healers_handbook/hhb_abilities_class.lst',
    key: 'Monk Archetype ~ Disciple of Wholeness',
    reason: monkCoverage,
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'player_companion/legacy_of_the_first_world/lotfw_abilities_class.lst',
    key: 'Monk Archetype ~ Nornkith',
    reason: monkCoverage,
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'player_companion/occult_origins/oo_abilities_class.lst',
    key: 'Monk Archetype ~ Serpent-Fire Adept',
    reason: monkCoverage,
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'player_companion/ranged_tactics_toolbox/rtt_abilities_class.lst',
    key: 'Monk Archetype ~ Far Strike Monk',
    reason: monkCoverage,
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'player_companion/undead_slayers_handbook/ush_abilities_class.lst',
    key: 'Monk Archetype ~ Spirit Master',
    reason: monkCoverage,
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'roleplaying_game/advanced_class_guide/acg_abilities_class.lst',
    key: 'Monk Archetype ~ Kata Master',
    reason: monkCoverage,
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'roleplaying_game/advanced_class_guide/acg_abilities_class.lst',
    key: 'Monk Archetype ~ Wildcat',
    reason: monkCoverage,
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'roleplaying_game/advanced_players_guide/apg_abilities_class.lst',
    key: 'Monk Archetype ~ Drunken Master',
    reason: monkCoverage,
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'roleplaying_game/advanced_players_guide/apg_abilities_class.lst',
    key: 'Monk Archetype ~ Hungry Ghost Monk',
    reason: monkCoverage,
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'roleplaying_game/advanced_players_guide/apg_abilities_class.lst',
    key: 'Monk Archetype ~ Ki Mystic',
    reason: monkCoverage,
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'roleplaying_game/advanced_players_guide/apg_abilities_class.lst',
    key: 'Monk Archetype ~ Monk of the Empty Hand',
    reason: monkCoverage,
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'roleplaying_game/advanced_players_guide/apg_abilities_class.lst',
    key: 'Monk Archetype ~ Monk of the Four Winds',
    reason: monkCoverage,
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'roleplaying_game/advanced_players_guide/apg_abilities_class.lst',
    key: 'Monk Archetype ~ Monk of the Healing Hand',
    reason: monkCoverage,
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'roleplaying_game/advanced_players_guide/apg_abilities_class.lst',
    key: 'Monk Archetype ~ Monk of the Lotus',
    reason: monkCoverage,
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'roleplaying_game/advanced_players_guide/apg_abilities_class.lst',
    key: 'Monk Archetype ~ Monk of the Sacred Mountain',
    reason: monkCoverage,
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'roleplaying_game/advanced_players_guide/apg_abilities_class.lst',
    key: 'Monk Archetype ~ Weapon Adept',
    reason: monkCoverage,
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'roleplaying_game/advanced_players_guide/apg_abilities_class.lst',
    key: 'Monk Archetype ~ Zen Archer',
    reason: monkCoverage,
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'roleplaying_game/advanced_race_guide/arg_abilities_class.lst',
    key: 'Monk Archetype ~ Underfoot Adept',
    reason: monkCoverage,
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'roleplaying_game/advanced_race_guide/arg_abilities_class.lst',
    key: 'Monk Archetype ~ Nimble Guardian',
    reason: monkCoverage,
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'roleplaying_game/advanced_race_guide/arg_abilities_class.lst',
    key: 'Monk Archetype ~ Ironskin Monk',
    reason: monkCoverage,
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'roleplaying_game/advanced_race_guide/arg_abilities_class.lst',
    key: 'Monk Archetype ~ Student of Stone',
    reason: monkCoverage,
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'roleplaying_game/advanced_race_guide/arg_abilities_class.lst',
    key: 'Monk Archetype ~ Gray Disciple',
    reason: monkCoverage,
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'roleplaying_game/advanced_race_guide/arg_abilities_class.lst',
    key: 'Monk Archetype ~ Treetop Monk',
    reason: monkCoverage,
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'roleplaying_game/ultimate_combat/uc_abilities_class.lst',
    key: 'Monk Archetype ~ Flowing Monk',
    reason: monkCoverage,
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'roleplaying_game/ultimate_combat/uc_abilities_class.lst',
    key: 'Monk Archetype ~ Maneuver Master',
    reason: monkCoverage,
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'roleplaying_game/ultimate_combat/uc_abilities_class.lst',
    key: 'Monk Archetype ~ Martial Artist',
    reason: monkCoverage,
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'roleplaying_game/ultimate_combat/uc_abilities_class.lst',
    key: 'Monk Archetype ~ Sohei',
    reason: monkCoverage,
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'roleplaying_game/ultimate_combat/uc_abilities_class.lst',
    key: 'Monk Archetype ~ Tetori',
    reason: monkCoverage,
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'roleplaying_game/ultimate_intrigue/ui_abilities_class.lst',
    key: 'Monk Archetype ~ Black Asp',
    reason: monkCoverage,
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'roleplaying_game/ultimate_wilderness/support/uw_abilities_class_oa.lst',
    key: 'Monk Archetype ~ Water Dancer',
    reason: monkCoverage,
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'roleplaying_game/ultimate_wilderness/uw_abilities_class.lst',
    key: 'Monk Archetype ~ Menhir Guardian',
    reason: monkCoverage,
  },
  {
    kind: 'archetype',
    className: 'Monk',
    file: 'roleplaying_game/ultimate_wilderness/uw_abilities_class.lst',
    key: 'Monk Archetype ~ Wasteland Meditant',
    reason: monkCoverage,
  },
];

/** One emitted owner as the selection rule reads it. */
export type EmittedOwner = {
  selector: PcgenOwnerSelector;
  /** The owner's row, then every feature row it owns. */
  rows: readonly PreviewEntry[];
  /** The crosswalk codes of the rows' books (`pcgen-books.json`). */
  books: readonly string[];
  /** How many structure review items and owned features the owner raises. */
  reviewSubjects: number;
};

const locatorOf = ({ file, key }: { file: string; key: string }) =>
  `${file}#${key}`;
const isProductIdentity = ({
  field,
  reason,
}: PreviewEntry['unsupported'][number]) =>
  field === 'attribution' && reason.startsWith('Product Identity: ');

const partyKeys = new Set(
  parsePartyBuilds(partyBuildsData).characters.flatMap((character) =>
    partyCharacterKeys(character).map(([, key]) => key),
  ),
);
const section15 = createSection15Lookup({ registry: section15Registry });
/** What a #716 row of the book requires all counts as reviewed (admission's own reading). */
const hasReviewedNotice = (code: string) =>
  section15
    .requirementsOf(code)
    .every((notice) => section15.countsAsReviewed(notice));

/**
 * Why a selection can't be emitted, one line per problem; empty when it
 * passes. Each owner takes its reason from `reviewed` by file and KEY, and
 * one it doesn't list is held to the coverage rule:
 * - every row's book reads as reviewed;
 * - a coverage owner and every feature it owns carry no Product Identity
 *   flag (`productIdentityHolds`: NAMEISPI, DESCISPI on the pinned record);
 * - a coverage owner raises a structure review item or owns a feature:
 *   the gate holds nothing else, so one that raises neither would be
 *   admitted without any review;
 * - a party owner's key is a matched key of a party build.
 *
 * Two archetypes of one class that both change the class skills may be
 * selected together: the sheet warns the Character who takes both
 * (rotation-3).
 */
export function ownerSelectionProblems({
  owners,
  reviewed = reviewedOwnerSelection,
}: {
  owners: readonly EmittedOwner[];
  reviewed?: readonly SelectedOwner[];
}): string[] {
  const reasons = new Map(
    reviewed.map((entry) => [locatorOf(entry), entry.reason]),
  );
  return owners.flatMap(({ selector, rows, books, reviewSubjects }) => {
    const name = `${selector.key} (${selector.file})`;
    const reason = reasons.get(locatorOf(selector))?.kind ?? 'coverage';
    const [owner] = rows;
    return [
      ...[...new Set(books)]
        .sort()
        .filter((book) => !hasReviewedNotice(book))
        .map((book) => `${name} is on ${book}, whose notice is not reviewed.`),
      ...(reason === 'coverage'
        ? rows
            .filter(({ unsupported }) => unsupported.some(isProductIdentity))
            .map(
              ({ externalKey }) =>
                `${name} is flagged Product Identity on ${externalKey}.`,
            )
        : []),
      ...(reason === 'coverage' && !reviewSubjects
        ? [
            `${name} gives the structure gate nothing to review, so it would be admitted unreviewed.`,
          ]
        : []),
      ...(reason === 'party' && !(owner && partyKeys.has(owner.externalKey))
        ? [`${name} is selected for the party, but no party build names it.`]
        : []),
    ];
  });
}
