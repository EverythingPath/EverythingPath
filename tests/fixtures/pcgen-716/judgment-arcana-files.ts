import { pcgen716AlchemyTalentFiles } from './alchemy-talent-files';

// The pinned PCGen inputs of #772's schedule tests (Inquisitor, Magus; research
// note 772-p7g-refresh), paths under `pcgenPin.directory` in the shared store
// (tests/fixtures/pinned/pcgen): P7e's inputs, which already hold the
// Advanced Player's Guide's inquisitor class block, records and globals,
// Ultimate Magic's magus records, and the mapped archetypes' books (Ultimate
// Combat, Ultimate Magic, the Advanced Class Guide, Occult Adventures), then
// Ultimate Magic's globals (the magus's gated grants and `_CF_` definitions)
// and class block (the magus's level variables, without which the armor
// grants have no level).
export const pcgen716JudgmentArcanaFiles = [
  ...new Set([
    ...pcgen716AlchemyTalentFiles,
    'roleplaying_game/ultimate_magic/um_abilities_globalvar.lst',
    'roleplaying_game/ultimate_magic/um_classes.lst',
  ]),
];
