# Shared rules foundations (#66)

`projectRulesFoundations` in `src/lib/rules-foundations.ts` is the pure projection
entry point for browser and server callers. It accepts the current projected rank,
training, roster, characters and settlement facts, complete staged choices, and
ordered organization-check occurrences. It returns advancement and boon facts,
capacity, retained choices with over-allowance flags, individual team eligibility,
modifier breakdowns, settlement effects, purchase costs and missing-fact requirements.
Missing choice references or malformed dice stay incomplete; integer dice outside
the d20 range retain a baseline with an advisory warning.
Warnings are advisory; this module neither saves choices nor commits outcomes.

Each check has a stable occurrence identity. Activity checks reference a complete
choice by identity. The Strategist bonus applies to the choice occupying the bonus
slot at the current projected rank. Overseer support is reserved for one event
identity and can apply to its multiple organization checks, each using the best
applicable ability modifier. Helpful and selected carried bonuses are reserved
once in check order, including while a roll is missing.
Reordering phase operations must project the roster/rank at that position before
requesting those checks, carrying the returned `checkUsage` across calls; this module does not apply officer changes or advance
Upkeep on its own. Since #196 a commandant without a Hit Dice override counts
their level (an override of zero stays zero), and archived assignments
retain their effects with a warning until explicitly removed. Commandant training
is a bonus fact for the successful Drill branch; it is never awarded here.

Manager effects are computed from individual roster identities. Since #196 a PC,
or an NPC holding an officer role in the evaluated roster, manages up to their
Charisma modifier (minimum 1) and an NPC holding none manages one. All team conditions
count toward manager limits, and only reward-exempt teams are omitted from the
rank-based team cap. The phase caller supplies used and newly upgraded team IDs;
newly recruited active teams have no automatic delay. Requirements, warnings and
modifier source keys are domain identifiers for callers to present with product
copy, not strings intended for direct rendering.

The advancement and team tables are shared with existing consumers. Browser and
server team costs and upgrade paths now use the same team definitions, including
the corrected 1,000 gp Infiltrator upgrades. Legacy focused-check/training helpers
read the shared advancement table. The legacy action-cap helper deliberately keeps
its existing rank-1 capacity because legacy saves resize arrays destructively.
Only canonical projection exposes the corrected one-action baseline; it retains
all occupied extra choices and reports warnings. Full raw-check composition and
multiple-officer mechanics stay isolated until canonical phase consumers land.
Legacy entered totals must not be passed as raw dice to this projection.

Table quantities are rounded down without a minimum; rank-1 Strike Team duration
is zero and XP shares are floored. Purchase percentages compound before a single
round to nearest copper. Market Day supplies its prescribed additional 5% discount.
Rank retention and the highest-PC-level cap govern progression. Boon outputs
are reminders with PC recipients, not automatic character-sheet mutations or
acknowledged awards.

The rules catalog links foundation tests to stable cases and retains gaps for
phase integration, event/action branches, table adjudication, and Confirmation
parity. No live canonical activation or campaign migration is part of this extraction.
