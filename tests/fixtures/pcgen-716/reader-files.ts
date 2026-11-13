import { pcgen716ArchetypeFiles } from './archetype-files';

// The pinned PCGen inputs of #716 P7-0's reader tests (research note
// 716-p7-rules §2), paths under `pcgenPin.directory` in the shared store
// (tests/fixtures/pinned/pcgen): P5's inputs, then the Advanced Class Guide's
// class blocks and class abilities (Brawler, Investigator, Warpriest) and
// Occult Adventures' class blocks and class abilities (Kineticist), each with
// its pack's `.pcc`.
export const pcgen716ReaderFiles = [
  ...new Set([
    ...pcgen716ArchetypeFiles,
    'roleplaying_game/advanced_class_guide/_advanced_class_guide.pcc',
    'roleplaying_game/advanced_class_guide/acg_classes.lst',
    'roleplaying_game/advanced_class_guide/acg_abilities_class.lst',
    'roleplaying_game/occult_adventures/_occult_adventures.pcc',
    'roleplaying_game/occult_adventures/oa_abilities_class.lst',
    'roleplaying_game/occult_adventures/oa_classes.lst',
  ]),
] as const;
