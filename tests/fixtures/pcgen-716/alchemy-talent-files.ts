import { pcgen716SmiteChallengeFiles } from './smite-challenge-files';

// The pinned PCGen inputs of #716 P7e's schedule tests (Alchemist,
// Investigator, Slayer, Vigilante; research note 716-p7-rules §5), paths under
// `pcgenPin.directory` in the shared store (tests/fixtures/pinned/pcgen):
// P7d's inputs, which already hold the Advanced Player's Guide's alchemist
// class block, records and globals, the Advanced Class Guide's investigator
// and slayer class blocks, records and globals, Ultimate Intrigue's class
// abilities (the vigilante's records and `_CF_` definitions), and the #422
// specimens' books (Magic Tactics Toolbox, Occult Adventures), then Ultimate
// Intrigue's class block (the vigilante's level lines).
export const pcgen716AlchemyTalentFiles = [
  ...new Set([
    ...pcgen716SmiteChallengeFiles,
    'roleplaying_game/ultimate_intrigue/ui_classes.lst',
  ]),
];
