import { pcgen716Files } from './files';

// The pinned PCGen inputs of #716 P5's schedule and archetype mapper tests,
// paths under `pcgenPin.directory` in the shared store
// (tests/fixtures/pinned/pcgen): P3's inputs, the Core Rulebook's global
// variables (the `_CF_` definitions and TYPE bridges) and the Pathfinder
// Society Field Guide's Lore Warden.
export const pcgen716ArchetypeFiles = [
  ...pcgen716Files,
  'roleplaying_game/core_rulebook/cr_abilities_globalvar.lst',
  'campaign_setting/pathfinder_society_field_guide/pathfinder_society_field_guide.pcc',
  'campaign_setting/pathfinder_society_field_guide/pfsfg_abilities_class.lst',
] as const;
