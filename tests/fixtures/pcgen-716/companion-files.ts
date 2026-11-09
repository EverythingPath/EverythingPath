import { pcgen716IdentityFiles } from './identity-files';
import { pcgen716ReaderFiles } from './reader-files';

// The pinned PCGen inputs of #716 P7a's schedule tests (Druid, Summoner,
// Summoner (Unchained), Hunter, Shifter; research note 716-p7-rules §5), paths
// under `pcgenPin.directory` in the shared store (tests/fixtures/pinned/pcgen):
// P6's identity inputs (the rule-keyed archetypes, Faiths and Philosophies,
// Advanced Class Origins, the Adventurer's Guide's Unchained support), P7-0's
// reader inputs (the Advanced Class Guide's class blocks), then the Advanced
// Class Guide's global variables (the hunter's `_CF_` definitions and
// bridges) and Ultimate Wilderness's class block (the shifter's grants).
export const pcgen716CompanionFiles = [
  ...new Set([
    ...pcgen716IdentityFiles,
    ...pcgen716ReaderFiles,
    'roleplaying_game/advanced_class_guide/acg_abilities_globalvar.lst',
    'roleplaying_game/ultimate_wilderness/uw_classes.lst',
  ]),
];
