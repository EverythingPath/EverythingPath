import { pcgen716RagePerformanceFiles } from './rage-performance-files';

// The pinned PCGen inputs of #716 P7d's schedule tests (Paladin, Antipaladin,
// Cavalier, Samurai; research note 716-p7-rules §5), paths under
// `pcgenPin.directory` in the shared store (tests/fixtures/pinned/pcgen):
// P7c's inputs, which already hold the Core Rulebook's paladin records and
// globals, the Advanced Player's Guide's antipaladin and cavalier records and
// globals, Ultimate Combat's samurai class, records and globals, and the
// mapped archetypes' books (Ultimate Magic, Ultimate Combat, Ultimate
// Wilderness, Legacy of Dragons), then Knights of the Inner Sea's class
// abilities (Herald Squire, a cavalier archetype replacing the 2nd-level
// order ability).
export const pcgen716SmiteChallengeFiles = [
  ...new Set([
    ...pcgen716RagePerformanceFiles,
    'player_companion/knights_of_the_inner_sea/_knights_of_the_inner_sea.pcc',
    'player_companion/knights_of_the_inner_sea/kotis_abilities_class.lst',
  ]),
];
