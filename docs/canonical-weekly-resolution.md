# Canonical Weekly Resolution (#78)

`projectWeeklyDraft({ revision, militiaSnapshot })` is the shared pure preview
interface. `revision` is a complete canonical Weekly Draft (which may contain
partial choices); `militiaSnapshot` contains the authoritative current values,
roster, character, settlement, bonus, economy and event-benefit facts. All of
those source facts participate in `sourceKey`, including external changes that
leave the draft revision unchanged. Callers must not substitute legacy entered
totals for raw dice.

The preview composes Upkeep, ordered Activity, Event and Persistent projections.
It returns known outcomes and requirements for incomplete drafts, but only a
ready week has a baseline plan and final plan. Successor preparation includes
carry, queue expiry, delivery state, event ending and fixed next-week context.
Typed Table Adjustments apply in order after this baseline. Rules Exceptions
permit choices and preserve their reasons without changing arithmetic.

Activity's selected consumables refer to the militia's one-use check bonuses.
Each selected bonus needs an explicit choice/check target. A choice's
`consumableIds` applies the recorded bonus to that action's organization check;
the existing `bonus:<id>` roll provenance selects the same bonus, and recording
both does not stack it. Unknown, spent, incompatible or untargeted selections
remain incomplete, including selections attached to actions without checks.
Selection never invents a target or overrides the recorded bonus value.

Each plan contains the complete typed `before` and `after` state plus ordered
phase effects and adjudication. A persistence adapter applies `after` exactly;
it must not replay the effects' arithmetic or add business outcomes in write
loops. `applyCanonicalResolutionPlan` demonstrates this contract and rejects
changed source state. `resolveReviewedWeeklyDraft` recomputes from the authority's
current source and rejects a changed reviewed source key. Neither function is an
authorization boundary; the subsequent Persistence implementation must perform
scope checks and execute application, record creation and successor creation in
one transaction.

`prepareCanonicalResolutionRecord` captures the complete draft, original militia
snapshot, baseline and adjusted plans, warnings, adjudication, final state and
successor context. Embedded choice/event acknowledgements remain in the complete
source. Every record is artifact format 2 with its source militia snapshot,
stamped with the current Ruleset Version (`CANONICAL_WEEKLY_RULESET_VERSION`).
The artifact payloads stay loose JSON, so records confirmed under an earlier
Ruleset Version stay readable when plan entry shapes change. The earlier
format-1 extraction records and records without a source snapshot are no
longer accepted (#198).

Confirmation (`src/lib/weekly-confirmation.ts`) is the live path. Pure worked
examples, complete-plan application tests and a browser bundle versus persisted
Convex-source parity test cover this boundary.
