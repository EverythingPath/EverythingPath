// Ruleset Versions are allocated in order, one per change to Weekly
// Resolution; a record keeps the version it was confirmed under. Constants
// only, so frozen history can read a record's rules without the resolver.
//
// Version 6 made treasury transfers characterless (#158) and version 7
// rerolled a Roll Twice on an Activity event candidate in its own die (#191).
// No record from before version 8 exists, so they need no constants; the
// corpus notes keep them, and neither number is ever reused.

/**
 * Team-manager limits follow held officer roles, and a commandant without a
 * Hit Dice override counts their level (#196).
 */
export const ROLE_AWARE_OFFICERS_RULESET_VERSION = 8;
/**
 * Three changes (#198). Spread Propaganda assumes the GM allows it: no
 * permission answer, and no Rules Exception for an impossible settlement.
 * Raid and Cache Discovered ignore an event-level mitigation or check and use
 * only each person's or cache's own. A Roll Twice rerolled in its own die asks
 * for a new die rather than reading a replacement recorded under it.
 */
export const ASSUMED_PROPAGANDA_APPROVAL_RULESET_VERSION =
  ROLE_AWARE_OFFICERS_RULESET_VERSION + 1;
/**
 * Prepared Character Sheets supply fixed racial Hit Dice alongside Class
 * Levels (#312). Commandants use their sum unless the roster overrides it,
 * zero included; old frozen snapshots have zero racial Hit Dice. Reserved for
 * initial Character Sheet cutover (#240): preparation keeps version 9 active.
 */
export const COMPUTED_HIT_DICE_RULESET_VERSION =
  ASSUMED_PROPAGANDA_APPROVAL_RULESET_VERSION + 1;
export const CANONICAL_WEEKLY_RULESET_VERSION =
  ASSUMED_PROPAGANDA_APPROVAL_RULESET_VERSION;
