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
  | { kind: 'coverage'; slice: 'archetype-select-monk' | 'archetype-select-2' };
export type SelectedOwner = PcgenOwnerSelector & {
  reason: OwnerSelectionReason;
};
type NonEmpty<T> = readonly [T, ...T[]];

const party = { kind: 'party' } as const;
/**
 * archetype-select-monk: the Monk's archetypes with no Product Identity flag
 * and every book's notice reviewed, but for the five that change class
 * skills beside Serpent-Fire Adept (Terra-Cotta Monk, Wanderer, Karmic Monk,
 * Sensei, Sage Counselor; archetype-select-2 selects them, rotation-3 having
 * given class skills a sheet identity) and Master of Many Styles, whose
 * Perfect Style the identity ledger holds as a variant, and Vow Monk and the
 * eleven Qinggong Monk records, which give the structure gate nothing to
 * review.
 */
const monkCoverage = {
  kind: 'coverage',
  slice: 'archetype-select-monk',
} as const;

/**
 * archetype-select-2: every archetype of a class the selection rule accepts
 * (`ownerSelectionProblems`), by file, each file's archetypes in PCGen's
 * order: the Alchemist, Barbarian, Cavalier, Fighter, Paladin, Ranger and
 * Rogue, and the Monk's five that change class skills. Left out: those
 * flagged Product Identity on themselves or a feature, those on a book whose
 * notice is not reviewed, those whose identity the ledger holds as a variant
 * (the same KEY in two files, such as the Grenadier of the Pathfinder
 * Society Field Guide and the Monster Codex), and the two Vikings and the two
 * Raging Cannibals, whose same-KEY features no checked separate-identities
 * decision names (their owners have one): a variant decision settles them
 * first.
 */
function coverageOwners(
  className: ScheduleClassName,
  byFile: Readonly<Record<string, readonly string[]>>,
): SelectedOwner[] {
  return Object.entries(byFile).flatMap(([file, keys]) =>
    keys.map((key) => ({
      kind: 'archetype' as const,
      className,
      file,
      key,
      reason: { kind: 'coverage', slice: 'archetype-select-2' } as const,
    })),
  );
}

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
  ...coverageOwners('Cavalier', {
    'campaign_setting/aquatic_adventures/aqua_abilities_class.lst': [
      'Cavalier Archetype ~ Oceanrider',
    ],
    'campaign_setting/inner_sea_combat/isc_abilities_class.lst': [
      'Cavalier Archetype ~ Spellscar Drifter',
      'Cavalier Archetype ~ Wave Rider',
    ],
    'player_companion/animal_archive/anar_abilities_class.lst': [
      'Cavalier Archetype ~ Huntmaster',
    ],
    'player_companion/cohorts_and_companions/cac_abilities_class.lst': [
      'Cavalier Archetype ~ Esquire',
    ],
    'player_companion/heroes_of_the_high_court/hothc_abilities_class.lst': [
      'Cavalier Archetype ~ Gallant',
    ],
    'player_companion/heroes_of_the_street/hots_abilities_class.lst': [
      'Cavalier Archetype ~ Constable',
    ],
    'player_companion/knights_of_the_inner_sea/kotis_abilities_class.lst': [
      'Cavalier Archetype ~ Herald Squire',
    ],
    'player_companion/legacy_of_dragons/lod_abilities_class.lst': [
      'Cavalier Archetype ~ Drakerider',
    ],
    'player_companion/legacy_of_the_first_world/lotfw_abilities_class.lst': [
      'Cavalier Archetype ~ Hooded Knight',
    ],
    'player_companion/melee_tactics_toolbox/mtt_abilities_class.lst': [
      'Cavalier Archetype ~ Castellan',
    ],
    'roleplaying_game/advanced_class_guide/acg_abilities_class.lst': [
      'Cavalier Archetype ~ Daring Champion',
    ],
    'roleplaying_game/occult_adventures/oa_abilities_class.lst': [
      'Cavalier Archetype ~ Ghost Rider',
    ],
    'roleplaying_game/ultimate_combat/uc_abilities_class.lst': [
      'Cavalier Archetype ~ Beast Rider',
      'Cavalier Archetype ~ Emissary',
      'Cavalier Archetype ~ Gendarme',
      'Cavalier Archetype ~ Honor Guard',
      'Cavalier Archetype ~ Luring Cavalier',
      'Cavalier Archetype ~ Musketeer',
      'Cavalier Archetype ~ Standard Bearer',
      'Cavalier Archetype ~ Strategist',
    ],
    'roleplaying_game/ultimate_intrigue/ui_abilities_class.lst': [
      'Cavalier Archetype ~ Courtly Knight',
      'Cavalier Archetype ~ Daring General',
      'Cavalier Archetype ~ Hussar',
    ],
    'roleplaying_game/ultimate_wilderness/uw_abilities_class.lst': [
      'Cavalier Archetype ~ Green Knight',
      'Cavalier Archetype ~ Saurian Champion',
    ],
  }),
  ...coverageOwners('Ranger', {
    'campaign_setting/inner_sea_combat/isc_abilities_class.lst': [
      'Ranger Archetype ~ Sable Company Marine',
      'Ranger Archetype ~ Tanglebriar Demonslayer',
    ],
    'player_companion/blood_of_the_beast/botb_abilities_class.lst': [
      'Ranger Archetype ~ Poison Darter',
    ],
    'player_companion/dragon_empires_primer/dep_abilities_class.lst': [
      'Ranger Archetype ~ Yokai Hunter',
    ],
    'player_companion/dragonslayers_handbook/dsh_abilities_class.lst': [
      'Ranger Archetype ~ Dragon Hunter',
    ],
    'player_companion/dungeoneers_handbook/dh_abilities_class.lst': [
      'Ranger Archetype ~ Dungeon Rover',
      'Ranger Archetype ~ Groom',
    ],
    'player_companion/healers_handbook/hhb_abilities_class.lst': [
      'Ranger Archetype ~ Wilderness Medic',
    ],
    'player_companion/legacy_of_dragons/lod_abilities_class.lst': [
      'Ranger Archetype ~ Drake Warden',
    ],
    'player_companion/people_of_the_north/potn_abilities_class.lst': [
      'Ranger Archetype ~ Witchguard',
    ],
    'player_companion/pirates_of_the_inner_sea/potis_abilities_class.lst': [
      'Ranger Archetype ~ Freebooter',
    ],
    'player_companion/ranged_tactics_toolbox/rtt_abilities_class.lst': [
      'Ranger Archetype ~ Toxophilite',
    ],
    'player_companion/undead_slayers_handbook/ush_abilities_class.lst': [
      'Ranger Archetype ~ Corpse Hunter',
    ],
    'roleplaying_game/advanced_class_guide/acg_abilities_class.lst': [
      'Ranger Archetype ~ Divine Tracker',
      'Ranger Archetype ~ Hooded Champion',
      'Ranger Archetype ~ Wild Hunter',
    ],
    'roleplaying_game/advanced_players_guide/apg_abilities_class.lst': [
      'Ranger Archetype ~ Beast Master',
      'Ranger Archetype ~ Guide',
      'Ranger Archetype ~ Horse Lord',
      'Ranger Archetype ~ Infiltrator',
      'Ranger Archetype ~ Shapeshifter',
      'Ranger Archetype ~ Skirmisher',
      'Ranger Archetype ~ Spirit Ranger',
      'Ranger Archetype ~ Urban Ranger',
    ],
    'roleplaying_game/advanced_race_guide/arg_abilities_class.lst': [
      'Ranger Archetype ~ Wild Shadow',
      'Ranger Archetype ~ Dusk Stalker',
      'Ranger Archetype ~ Wave Warden',
    ],
    'roleplaying_game/adventurers_guide/ag_abilities_class.lst': [
      'Ranger Archetype ~ Lantern Lighter',
    ],
    'roleplaying_game/ultimate_combat/uc_abilities_class.lst': [
      'Ranger Archetype ~ Battle Scout',
      'Ranger Archetype ~ Deep Walker',
      'Ranger Archetype ~ Falconer',
      'Ranger Archetype ~ Trophy Hunter',
      'Ranger Archetype ~ Warden',
      'Ranger Archetype ~ Wild Stalker',
    ],
    'roleplaying_game/ultimate_intrigue/ui_abilities_class.lst': [
      'Ranger Archetype ~ Code Runner',
      'Ranger Archetype ~ Dandy',
      'Ranger Archetype ~ Guildbreaker',
      'Ranger Archetype ~ Sentinel',
      'Ranger Archetype ~ Transporter',
    ],
    'roleplaying_game/ultimate_magic/um_abilities_class.lst': [
      'Ranger Archetype ~ Trapper',
    ],
    'roleplaying_game/ultimate_magic/um_abilities_wordsofpower.lst': [
      'Ranger Archetype ~ Words of Power',
    ],
    'roleplaying_game/ultimate_wilderness/uw_abilities_class.lst': [
      'Ranger Archetype ~ Flamewarden',
      'Ranger Archetype ~ Stormwalker',
      'Ranger Archetype ~ Summit Sentinel',
      'Ranger Archetype ~ Tidal Hunter',
      'Ranger Archetype ~ Toxic Herbalist',
      'Ranger Archetype ~ Wilderness Explorer',
      'Ranger Archetype ~ Wild Soul',
    ],
  }),
  ...coverageOwners('Rogue', {
    'campaign_setting/aquatic_adventures/aqua_abilities_class.lst': [
      'Rogue Archetype ~ Tidal Trickster',
    ],
    'campaign_setting/pathfinder_society_field_guide/pfsfg_abilities_class.lst':
      ['Rogue Archetype ~ Scroll Scoundrel'],
    'campaign_setting/technology_guide/tg_abilities_class.lst': [
      'Rogue Archetype ~ Numerian Scavenger',
    ],
    'player_companion/animal_archive/anar_abilities_class.lst': [
      'Rogue Archetype ~ Carnivalist',
    ],
    'player_companion/black_markets/bm_abilities_class.lst': [
      'Rogue Archetype ~ Relic Raider',
    ],
    'player_companion/blood_of_shadows/bos_abilities_class.lst': [
      'Rogue Archetype ~ Shadow Walker',
    ],
    'player_companion/dirty_tactics_toolbox/dtt_abilities_class.lst': [
      'Rogue Archetype ~ Waylayer',
    ],
    'player_companion/dungeoneers_handbook/dh_abilities_class.lst': [
      'Rogue Archetype ~ Sapper',
    ],
    'player_companion/elemental_masters_handbook/emh_abilities_class.lst': [
      'Rogue Archetype ~ Earthshadow',
    ],
    'player_companion/giant_hunters_handbook/ghh_abilities_class.lst': [
      'Rogue Archetype ~ Vexing Dodger',
    ],
    'player_companion/kobolds_of_golarion/kog_abilities_class.lst': [
      'Rogue Archetype ~ Snare Setter',
    ],
    'player_companion/melee_tactics_toolbox/mtt_abilities_class.lst': [
      'Rogue Archetype ~ Makeshift Scrapper',
    ],
    'player_companion/pirates_of_the_inner_sea/potis_abilities_class.lst': [
      'Rogue Archetype ~ Smuggler',
    ],
    'roleplaying_game/advanced_class_guide/acg_abilities_class.lst': [
      'Rogue Archetype ~ Counterfeit Mage',
      'Rogue Archetype ~ Underground Chemist',
    ],
    'roleplaying_game/advanced_players_guide/apg_abilities_class.lst': [
      'Rogue Archetype ~ Acrobat',
      'Rogue Archetype ~ Burglar',
      'Rogue Archetype ~ Cutpurse',
      'Rogue Archetype ~ Investigator',
      'Rogue Archetype ~ Poisoner',
      'Rogue Archetype ~ Rake',
      'Rogue Archetype ~ Scout',
      'Rogue Archetype ~ Sniper',
      'Rogue Archetype ~ Spy',
      'Rogue Archetype ~ Swashbuckler',
      'Rogue Archetype ~ Thug',
      'Rogue Archetype ~ Trapsmith',
    ],
    'roleplaying_game/advanced_race_guide/arg_abilities_class.lst': [
      'Rogue Archetype ~ Skulking Slayer',
      'Rogue Archetype ~ Filcher',
      'Rogue Archetype ~ Cat Burglar',
      'Rogue Archetype ~ Swordmaster',
      'Rogue Archetype ~ Eldritch Raider',
      'Rogue Archetype ~ Kitsune Trickster',
      'Rogue Archetype ~ Deadly Courtesan',
    ],
    'roleplaying_game/adventurers_guide/ag_abilities_class.lst': [
      'Rogue Archetype ~ Toxic Talon',
    ],
    'roleplaying_game/occult_adventures/oa_abilities_class.lst': [
      'Rogue Archetype ~ Escapologist',
      'Rogue Archetype ~ False Medium',
    ],
    'roleplaying_game/ultimate_combat/uc_abilities_class.lst': [
      'Rogue Archetype ~ Bandit',
      'Rogue Archetype ~ Chameleon',
      'Rogue Archetype ~ Charlatan',
      'Rogue Archetype ~ Driver',
      'Rogue Archetype ~ Knife Master',
      'Rogue Archetype ~ Pirate',
      'Rogue Archetype ~ Roof Runner',
      'Rogue Archetype ~ Sanctified Rogue',
      'Rogue Archetype ~ Survivalist',
    ],
    'roleplaying_game/ultimate_intrigue/ui_abilities_class.lst': [
      'Rogue Archetype ~ Consigliere',
      'Rogue Archetype ~ Guild Agent',
      'Rogue Archetype ~ Heister',
      'Rogue Archetype ~ Master of Disguise',
      'Rogue Archetype ~ Phantom Thief',
      'Rogue Archetype ~ Sharper',
      'Rogue Archetype ~ Snoop',
    ],
    'roleplaying_game/ultimate_intrigue/support/ui_abilities_class_pu.lst': [
      'Rogue Archetype ~ Unchained Consigliere',
      'Rogue Archetype ~ Unchained Phantom Thief',
    ],
    'roleplaying_game/ultimate_wilderness/uw_abilities_class.lst': [
      'Rogue Archetype ~ Desert Raider',
      'Rogue Archetype ~ Fey Prankster',
      'Rogue Archetype ~ Sly Saboteur',
      'Rogue Archetype ~ Sylvan Trickster',
    ],
  }),
  ...coverageOwners('Alchemist', {
    'campaign_setting/aquatic_adventures/aqua_abilities_class.lst': [
      'Alchemist Archetype ~ Aquachymist',
    ],
    'campaign_setting/inner_sea_taverns/istav_abilities_class.lst': [
      'Alchemist Archetype ~ Mixologist',
    ],
    'player_companion/black_markets/bm_abilities_class.lst': [
      'Alchemist Archetype ~ Eldritch Poisoner',
    ],
    'player_companion/blood_of_shadows/bos_abilities_class.lst': [
      'Alchemist Archetype ~ Gloom Chymist',
    ],
    'player_companion/cohorts_and_companions/cac_abilities_class.lst': [
      'Alchemist Archetype ~ Construct Rider',
    ],
    'player_companion/dirty_tactics_toolbox/dtt_abilities_class.lst': [
      'Alchemist Archetype ~ Toxicant',
    ],
    'player_companion/dungeoneers_handbook/dh_abilities_class.lst': [
      'Alchemist Archetype ~ Trap Breaker',
      'Alchemist Archetype ~ Blazing Torchbearer',
    ],
    'player_companion/elemental_masters_handbook/emh_abilities_class.lst': [
      'Alchemist Archetype ~ Energy Scientist',
    ],
    'player_companion/familiar_folio/ff_abilities_class.lst': [
      'Alchemist Archetype ~ Homunculist',
    ],
    'player_companion/healers_handbook/hhb_abilities_class.lst': [
      'Alchemist Archetype ~ Sacrament Alchemist',
    ],
    'player_companion/legacy_of_the_first_world/lotfw_abilities_class.lst': [
      'Alchemist Archetype ~ First World Innovator',
    ],
    'player_companion/monster_hunters_handbook/mhh_abilities_class.lst': [
      'Alchemist Archetype ~ Oozemaster',
    ],
    'roleplaying_game/advanced_class_guide/acg_abilities_class.lst': [
      'Alchemist Archetype ~ Inspired Chemist',
    ],
    'roleplaying_game/advanced_race_guide/arg_abilities_class.lst': [
      'Alchemist Archetype ~ Saboteur',
      'Alchemist Archetype ~ Bramble Brewer',
      'Alchemist Archetype ~ Fire Bomber',
      'Alchemist Archetype ~ Plague Bringer',
      'Alchemist Archetype ~ Bogborn Alchemist',
      'Alchemist Archetype ~ Deep Bomber',
    ],
    'roleplaying_game/horror_adventures/ha_abilities_class.lst': [
      'Alchemist Archetype ~ Mad Scientist',
    ],
    'roleplaying_game/horror_adventures/support/ha_abilities_class_oa.lst': [
      'Alchemist Archetype ~ Blood Alchemist',
    ],
    'roleplaying_game/monster_codex/mc_abilities_class.lst': [
      'Alchemist Archetype ~ Winged Marauder',
      'Alchemist Archetype ~ Alchemical Trapper',
    ],
    'roleplaying_game/occult_adventures/oa_abilities_class.lst': [
      'Alchemist Archetype ~ Ectochymist',
      'Alchemist Archetype ~ Promethean Alchemist',
    ],
    'roleplaying_game/ultimate_combat/uc_abilities_class.lst': [
      'Alchemist Archetype ~ Beastmorph',
      'Alchemist Archetype ~ Ragechemist',
    ],
    'roleplaying_game/ultimate_intrigue/ui_abilities_class.lst': [
      'Alchemist Archetype ~ Alchemical Sapper',
      'Alchemist Archetype ~ Interrogator',
      'Alchemist Archetype ~ Metamorph',
    ],
    'roleplaying_game/ultimate_magic/um_abilities_class.lst': [
      'Alchemist Archetype ~ Chirurgeon',
      'Alchemist Archetype ~ Clone Master',
      'Alchemist Archetype ~ Internal Alchemist',
      'Alchemist Archetype ~ Mindchemist',
      'Alchemist Archetype ~ Preservationist',
      'Alchemist Archetype ~ Psychonaut',
      'Alchemist Archetype ~ Reanimator',
      'Alchemist Archetype ~ Vivisectionist',
    ],
    'roleplaying_game/ultimate_magic/um_abilities_wordsofpower.lst': [
      'Alchemist Archetype ~ Words of Power',
    ],
    'roleplaying_game/ultimate_wilderness/uw_abilities_class.lst': [
      'Alchemist Archetype ~ Herbalist',
      'Alchemist Archetype ~ Ice Chemist',
    ],
  }),
  ...coverageOwners('Paladin', {
    'campaign_setting/aquatic_adventures/support/aqua_abilities_class_oa.lst': [
      'Paladin Archetype ~ Pearl Seeker',
    ],
    'campaign_setting/inner_sea_combat/isc_abilities_class.lst': [
      'Paladin Archetype ~ Oath against Chaos',
      'Paladin Archetype ~ Oath against Grotesquery',
    ],
    'player_companion/armor_masters_handbook/amh_abilities_class.lst': [
      'Paladin Archetype ~ Legate',
    ],
    'player_companion/blood_of_shadows/bos_abilities_class.lst': [
      'Paladin Archetype ~ Dusk Knight',
    ],
    'player_companion/cohorts_and_companions/cac_abilities_class.lst': [
      'Paladin Archetype ~ Divine Guardian',
    ],
    'player_companion/familiar_folio/ff_abilities_class.lst': [
      'Paladin Archetype ~ Chosen One',
    ],
    'player_companion/healers_handbook/hhb_abilities_class.lst': [
      'Paladin Archetype ~ Invigorator',
    ],
    'player_companion/heroes_of_the_high_court/hothc_abilities_class.lst': [
      'Paladin Archetype ~ Virtuous Bravo',
    ],
    'player_companion/knights_of_the_inner_sea/kotis_abilities_class.lst': [
      'Paladin Archetype ~ Combat Healer Squire',
    ],
    'player_companion/monster_hunters_handbook/mhh_abilities_class.lst': [
      'Paladin Archetype ~ Banishing Warden',
    ],
    'roleplaying_game/advanced_class_guide/acg_abilities_class.lst': [
      'Paladin Archetype ~ Holy Guide',
      'Paladin Archetype ~ Temple Champion',
    ],
    'roleplaying_game/advanced_players_guide/apg_abilities_class.lst': [
      'Paladin Archetype ~ Divine Defender',
      'Paladin Archetype ~ Hospitaler',
      'Paladin Archetype ~ Sacred Servant',
      'Paladin Archetype ~ Shining Knight',
      'Paladin Archetype ~ Undead Scourge',
      'Paladin Archetype ~ Warrior of the Holy Light',
    ],
    'roleplaying_game/advanced_race_guide/arg_abilities_class.lst': [
      'Paladin Archetype ~ Stonelord',
      'Paladin Archetype ~ Redeemer',
      'Paladin Archetype ~ Tranquil Guardian',
    ],
    'roleplaying_game/horror_adventures/ha_abilities_class.lst': [
      'Paladin Archetype ~ Martyr',
      'Paladin Archetype ~ Soul Sentinel',
      'Paladin Archetype ~ Tortured Crusader',
    ],
    'roleplaying_game/occult_adventures/oa_abilities_class.lst': [
      'Paladin Archetype ~ Ghost Hunter',
    ],
    'roleplaying_game/ultimate_combat/uc_abilities_class.lst': [
      'Paladin Archetype ~ Divine Hunter',
      'Paladin Archetype ~ Empyreal Knight',
      'Paladin Archetype ~ Holy Gun',
      'Paladin Archetype ~ Holy Tactician',
      'Paladin Archetype ~ Sacred Shield',
    ],
    'roleplaying_game/ultimate_intrigue/ui_abilities_class.lst': [
      'Paladin Archetype ~ Gray Paladin',
    ],
    'roleplaying_game/ultimate_magic/um_abilities_class.lst': [
      'Paladin Archetype ~ Oath against Corruption',
      'Paladin Archetype ~ Oath against Fiends',
      'Paladin Archetype ~ Oath against Savagery',
      'Paladin Archetype ~ Oath against Undeath',
      'Paladin Archetype ~ Oath against the Wyrm',
      'Paladin Archetype ~ Oath of Charity',
      'Paladin Archetype ~ Oath of Chastity',
      'Paladin Archetype ~ Oath of Loyalty',
      'Paladin Archetype ~ Oath of Vengeance',
    ],
    'roleplaying_game/ultimate_magic/um_abilities_wordsofpower.lst': [
      'Paladin Archetype ~ Words of Power',
    ],
    'roleplaying_game/ultimate_wilderness/uw_abilities_class.lst': [
      'Paladin Archetype ~ Forest Preserver',
      'Paladin Archetype ~ Hunting Paladin',
      'Paladin Archetype ~ Wilderness Warden',
    ],
  }),
  ...coverageOwners('Fighter', {
    'campaign_setting/aquatic_adventures/aqua_abilities_class.lst': [
      'Fighter Archetype ~ Aquanaut',
    ],
    'campaign_setting/inner_sea_combat/isc_abilities_class.lst': [
      'Fighter Archetype ~ Druman Blackjacket',
    ],
    'campaign_setting/pathfinder_society_field_guide/pfsfg_abilities_class.lst':
      ['Fighter Archetype ~ Lore Warden'],
    'campaign_setting/technology_guide/tg_abilities_class.lst': [
      'Fighter Archetype ~ Cyber-Soldier',
    ],
    'player_companion/black_markets/bm_abilities_class.lst': [
      'Fighter Archetype ~ Pack Mule',
    ],
    'player_companion/familiar_folio/ff_abilities_class.lst': [
      'Fighter Archetype ~ Eldritch Guardian',
    ],
    'player_companion/giant_hunters_handbook/ghh_abilities_class.lst': [
      'Fighter Archetype ~ Titan Fighter',
    ],
    'player_companion/haunted_heroes_handbook/hhh_abilities_class.lst': [
      'Fighter Archetype ~ Steelbound Fighter',
    ],
    'player_companion/heroes_of_the_street/hots_abilities_class.lst': [
      'Fighter Archetype ~ Siegebreaker',
    ],
    'player_companion/knights_of_the_inner_sea/kotis_abilities_class.lst': [
      'Fighter Archetype ~ Weapon Bearer Squire',
    ],
    'player_companion/kobolds_of_golarion/kog_abilities_class.lst': [
      'Fighter Archetype ~ Swarm Fighter',
    ],
    'player_companion/legacy_of_dragons/lod_abilities_class.lst': [
      'Fighter Archetype ~ Dragonheir Scion',
    ],
    'player_companion/melee_tactics_toolbox/mtt_abilities_class.lst': [
      'Fighter Archetype ~ Drill Sergeant',
    ],
    'player_companion/pirates_of_the_inner_sea/potis_abilities_class.lst': [
      'Fighter Archetype ~ Corsair',
    ],
    'player_companion/weapon_masters_handbook/wmh_abilities.lst': [
      'Fighter Archetype ~ Relic Master',
    ],
    'roleplaying_game/advanced_class_guide/acg_abilities_class.lst': [
      'Fighter Archetype ~ Martial Master',
      'Fighter Archetype ~ Mutation Warrior',
    ],
    'roleplaying_game/advanced_players_guide/apg_abilities_class.lst': [
      'Fighter Archetype ~ Archer',
      'Fighter Archetype ~ Crossbowman',
      'Fighter Archetype ~ Free Hand Fighter',
      'Fighter Archetype ~ Mobile Fighter',
      'Fighter Archetype ~ Phalanx Soldier',
      'Fighter Archetype ~ Polearm Master',
      'Fighter Archetype ~ Roughrider',
      'Fighter Archetype ~ Savage Warrior',
      'Fighter Archetype ~ Shielded Fighter',
      'Fighter Archetype ~ Two-Handed Fighter',
      'Fighter Archetype ~ Two-Weapon Warrior',
      'Fighter Archetype ~ Weapon Master',
    ],
    'roleplaying_game/advanced_race_guide/arg_abilities_class.lst': [
      'Fighter Archetype ~ Foehammer',
      'Fighter Archetype ~ Cavern Sniper',
      'Fighter Archetype ~ Dirty Fighter',
      'Fighter Archetype ~ Airborne Ambusher',
    ],
    'roleplaying_game/occult_adventures/oa_abilities_class.lst': [
      'Fighter Archetype ~ Sensate',
    ],
    'roleplaying_game/ultimate_combat/uc_abilities_class.lst': [
      'Fighter Archetype ~ Armor Master',
      'Fighter Archetype ~ Brawler',
      'Fighter Archetype ~ Cad',
      'Fighter Archetype ~ Dragoon',
      'Fighter Archetype ~ Gladiator',
      'Fighter Archetype ~ Tactician',
      'Fighter Archetype ~ Thunderstriker',
      'Fighter Archetype ~ Tower Shield Specialist',
      'Fighter Archetype ~ Unarmed Fighter',
      'Fighter Archetype ~ Unbreakable',
    ],
    'roleplaying_game/ultimate_wilderness/uw_abilities_class.lst': [
      'Fighter Archetype ~ Skirmisher',
      'Fighter Archetype ~ Tribal Fighter',
    ],
  }),
  ...coverageOwners('Barbarian', {
    'campaign_setting/inner_sea_combat/isc_abilities_class.lst': [
      'Barbarian Archetype ~ Jungle Rager',
    ],
    'campaign_setting/technology_guide/tg_abilities_class.lst': [
      'Barbarian Archetype ~ Savage Technologist',
    ],
    'player_companion/dirty_tactics_toolbox/dtt_abilities_class.lst': [
      'Barbarian Archetype ~ Untamed Rager',
    ],
    'player_companion/legacy_of_the_first_world/lotfw_abilities_class.lst': [
      'Barbarian Archetype ~ Deepwater Rager',
    ],
    'player_companion/ranged_tactics_toolbox/rtt_abilities_class.lst': [
      'Barbarian Archetype ~ Primal Hunter',
    ],
    'roleplaying_game/advanced_players_guide/apg_abilities_class.lst': [
      'Barbarian Archetype ~ Breaker',
      'Barbarian Archetype ~ Brutal Pugilist',
      'Barbarian Archetype ~ Drunken Brute',
      'Barbarian Archetype ~ Elemental Kin',
      'Barbarian Archetype ~ Hurler',
      'Barbarian Archetype ~ Invulnerable Rager',
      'Barbarian Archetype ~ Mounted Fury',
      'Barbarian Archetype ~ Savage Barbarian',
      'Barbarian Archetype ~ Superstitious',
      'Barbarian Archetype ~ Totem Warrior',
    ],
    'roleplaying_game/advanced_race_guide/arg_abilities_class.lst': [
      'Barbarian Archetype ~ Hateful Rager',
      'Barbarian Archetype ~ Feral Gnasher',
    ],
    'roleplaying_game/horror_adventures/ha_abilities_class.lst': [
      'Barbarian Archetype ~ Dreadnought',
      'Barbarian Archetype ~ Fearsome Defender',
      'Barbarian Archetype ~ Mooncursed',
    ],
    'roleplaying_game/monster_codex/mc_abilities_class.lst': [
      'Barbarian Archetype ~ Pack Rager',
    ],
    'roleplaying_game/occult_adventures/oa_abilities_class.lst': [
      'Barbarian Archetype ~ Flesheater',
    ],
    'roleplaying_game/ultimate_combat/uc_abilities_class.lst': [
      'Barbarian Archetype ~ Armored Hulk',
      'Barbarian Archetype ~ Scarred Rager',
      'Barbarian Archetype ~ Sea Reaver',
      'Barbarian Archetype ~ Titan Mauler',
      'Barbarian Archetype ~ True Primitive',
      'Barbarian Archetype ~ Urban Barbarian',
      'Barbarian Archetype ~ Wild Rager',
    ],
    'roleplaying_game/ultimate_wilderness/uw_abilities_class.lst': [
      'Barbarian Archetype ~ Brutish Swamper',
      'Barbarian Archetype ~ Cave Dweller',
      'Barbarian Archetype ~ Pack Hunter',
      'Barbarian Archetype ~ Sharptooth',
      'Barbarian Archetype ~ Wildborn',
    ],
  }),
  ...coverageOwners('Monk', {
    'player_companion/dungeoneers_handbook/dh_abilities_class.lst': [
      'Monk Archetype ~ Terra-Cotta Monk',
    ],
    'roleplaying_game/advanced_race_guide/arg_abilities_class.lst': [
      'Monk Archetype ~ Wanderer',
    ],
    'roleplaying_game/occult_adventures/oa_abilities_class.lst': [
      'Monk Archetype ~ Karmic Monk',
    ],
    'roleplaying_game/ultimate_combat/uc_abilities_class.lst': [
      'Monk Archetype ~ Sensei',
    ],
    'roleplaying_game/ultimate_intrigue/ui_abilities_class.lst': [
      'Monk Archetype ~ Sage Counselor',
    ],
  }),
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
