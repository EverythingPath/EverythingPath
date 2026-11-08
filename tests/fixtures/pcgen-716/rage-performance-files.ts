import { pcgen716MartialFiles } from './martial-files';

// The pinned PCGen inputs of #716 P7c's schedule tests (Bard, Barbarian,
// Barbarian (Unchained), Skald, Bloodrager; research note 716-p7-rules §5),
// paths under `pcgenPin.directory` in the shared store
// (tests/fixtures/pinned/pcgen): P7b's inputs, which already hold the Core
// Rulebook's and Pathfinder Unchained's barbarian and bard records, the
// Advanced Class Guide's skald and bloodrager class blocks, records and
// global variables, and the mapped archetypes' books (Ultimate Combat, the
// Advanced Race Guide, the Advanced Player's Guide, the Advanced Class Guide),
// then the Magic Tactics Toolbox's and Familiar Folio's class abilities
// (Blood Havoc and Bloodline Familiar, bloodrager archetypes removing a
// bloodline power).
export const pcgen716RagePerformanceFiles = [
  ...new Set([
    ...pcgen716MartialFiles,
    'player_companion/familiar_folio/_familiar_folio.pcc',
    'player_companion/familiar_folio/ff_abilities_class.lst',
    'player_companion/magic_tactics_toolbox/_magic_tactics_toolbox.pcc',
    'player_companion/magic_tactics_toolbox/magtt_abilities_class.lst',
  ]),
];
