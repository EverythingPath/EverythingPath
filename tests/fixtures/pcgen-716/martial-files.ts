import { pcgen716CompanionFiles } from './companion-files';

// The pinned PCGen inputs of #716 P7b's schedule tests (Monk, Monk
// (Unchained), Brawler, Ninja, Rogue (Unchained); research note
// 716-p7-rules §5), paths under `pcgenPin.directory` in the shared store
// (tests/fixtures/pinned/pcgen): P7a's inputs, which hold the monk's,
// brawler's and both Unchained classes' records and the mapped archetypes,
// then Ultimate Combat's class block and global variables (the ninja's class
// record, grants, `_CF_` definitions and bridges).
export const pcgen716MartialFiles = [
  ...new Set([
    ...pcgen716CompanionFiles,
    'roleplaying_game/ultimate_combat/uc_classes.lst',
    'roleplaying_game/ultimate_combat/uc_abilities_globalvar.lst',
  ]),
];
