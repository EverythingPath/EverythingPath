## Superseding review decisions — 2026-09-23

The user's review of #88 supersedes conflicting historical expectations below:

- P10.gm: all organization members have equal editing and correction access; there are no separate GM permissions at this stage.

- F02.ap-caps: remove current Adventure Path/volume tracking and volume-based rank limits.
- F04.shrink: preserve choices in unavailable slots, but block Confirmation until moved, cleared, or allowance restored. Rules Exceptions cannot bypass action capacity.
- F04.context: extra actions from story rewards are deferred to [backlog #98](https://github.com/AndreasUnunger/EverythingPath/issues/98).
- F05.order: recruitment and dismissal in the same committed week work in either order when the resulting roster fits team capacity.

## Problem Statement

Players need to prepare an Ironfang militia week together, understand the consequences of their choices, and confirm exactly the week they reviewed. Today, Weekly Draft orchestration, browser input, shared edits, rules calculations, and persistence are spread across a large board controller, phase builders, and backend write paths. This makes changes difficult to reason about and allows lost edits, incomplete previews, and inconsistent rules outcomes.

The completed architecture map [#33](https://github.com/AndreasUnunger/EverythingPath/issues/33) establishes the replacement architecture. This specification turns its accepted decisions into an implementation contract. The map's planning work is complete; implementation and eventual cutover are separate work described here.

## Solution

Give the board one Weekly Draft Workspace interface that presents the current Phase View and accepts semantic edits and whole-week Confirmation. Players can jointly edit complete Staged Action Choices, navigate independently, see immediate feedback and rules-derived previews, and review explicit table decisions before committing the week atomically.

Use one typed Weekly Draft contract and one shared pure Rules Projection across the browser and Convex. Preserve useful existing presentation and observable behavior, correct unaccepted baseline defects, and retain accepted product interpretations explicitly. Replace live storage through the approved paused cutover while preserving authoritative campaign state and week context.

## User Stories

1. As a player, I want the board to clearly show loading, unavailable, failed, and ready states, so that I understand whether I can work on my militia week.
2. As a player, I want to view Upkeep, Activity, Event, and Summary independently of other players, so that each person can inspect the information they need.
3. As a player, I want phase navigation to remain immediate while my edits are pending, so that preparation does not stall.
4. As a player, I want to see shared choices and accepted changes on every device, so that the table works from the same Weekly Draft.
5. As a player, I want immediate feedback for an edit and a clear recovery message if it fails, so that I know whether my work was retained.
6. As a player, I want edits to different targets to coexist and conflicting edits to fail visibly, so that another player's newer choice is not silently overwritten.
7. As a player, I want all players to edit an Action Slot until Weekly Confirmation, so that collaboration does not require slot ownership or individual confirmations.
8. As a player, I want each Staged Action Choice to keep its team, rolls, targets, costs, and details together, so that moving it does not change its meaning.
9. As a player, I want to stage, replace, clear, move, and swap complete choices with cards, so that arranging Activity is quick at the table.
10. As a player, I want incomplete choices to remain visible while I fill them in, so that I can prepare the week incrementally.
11. As a player, I want occupied slots to remain visible when the action allowance shrinks, so that no staged work disappears.
12. As a player, I want to resolve an over-allowance choice by moving or clearing it, or recording a reasoned Rules Exception, so that the table can adjudicate intentional departures.
13. As a player, I want invalid numeric entry to leave my existing input intact and clearing to remove the value explicitly, so that zero and missing input remain distinct.
14. As a player, I want calculated rules defaults and modifier explanations, so that I supply dice and table decisions without re-entering deterministic arithmetic.
15. As a player, I want warnings to explain rule mismatches and structural errors to identify invalid data, so that I understand what needs correction.
16. As a player, I want a shared Rules Exception with a required reason to permit an unusual choice, so that intentional exceptions remain visible in later sessions.
17. As a player, I want a Table Adjustment with a required reason to change a calculated result after the Rules Baseline, so that adjudication is distinguishable from normal calculation.
18. As a player, I want readiness to identify every required roll, target, selection, and acknowledgement, so that an incomplete week cannot be accidentally confirmed.
19. As a player, I want the Resolution Preview to include every resulting militia, roster, officer, settlement, asset, event, and future-week change, so that Confirmation contains no hidden outcomes.
20. As a player, I want earlier-phase edits to recompute later outcomes, so that action eligibility and Event consequences reflect the week we are actually preparing.
21. As a player, I want first-use Upkeep behavior and ordered losses, rank increases, and treasury changes to follow the rules, so that mid-campaign week numbering does not change the result.
22. As a player, I want officer, manager, team-condition, settlement, and one-use modifiers applied exactly once, so that bonuses and restrictions remain trustworthy.
23. As a player, I want separate teams of the same type and multiple officer holders to retain their identities, so that rules refer to the intended people and teams.
24. As a player, I want every action and event to support its required targets, rolls, calculated outcomes, and recorded narrative decisions, so that manual adjudication does not silently omit an effect.
25. As a player, I want Roll Twice, duplicate events, automatic events, and replacement rolls handled independently and in order, so that all applicable outcomes are resolved.
26. As a player, I want carried persistent events processed with stable age, order, and targets, so that recurring effects remain consistent across weeks.
27. As a player, I want Persistent Phase availability fixed by the events carried into the week, so that resolving or creating an event does not unexpectedly change navigation.
28. As a player, I want to stage persistent mitigation, ending, and buyoff decisions with their costs and timing, so that they are included in the reviewed week.
29. As a player, I want order delivery shown in days and receipt recorded explicitly, so that expedited delivery has its intended value and cannot be received twice.
30. As a player, I want Confirmation to wait for my earlier edits and reject a changed reviewed source, so that I never commit an unseen result.
31. As a player, I want competing Confirmations to produce one committed week and one successor draft, so that a week cannot advance twice.
32. As a player, I want delayed edits from a finished week to fail, so that they cannot alter the next week.
33. As a player, I want a warning before leaving with pending edits, so that I can avoid losing work that has not been accepted.
34. As a player, I want finished weeks displayed from immutable Resolution Records, so that today's militia state cannot change what history shows.
35. As a player, I want a new or mid-campaign militia to enter the same draft lifecycle, so that setup does not create a separate gameplay path.
36. As a GM, I want correction controls restricted to the GM while normal preparation and Confirmation remain shared, so that table authority is preserved.
37. As a maintainer, I want behavior accessible through a small Workspace interface and shared rules implementation, so that a rules or draft change has locality.
38. As a maintainer, I want tests to assert observable outcomes through module interfaces, so that refactoring private implementation does not require rewriting unrelated tests.
39. As a maintainer, I want every testable rules behavior linked to executable coverage, so that a passing suite cannot conceal an omitted action or event.
40. As a campaign operator, I want a rehearsed, restartable cutover that preserves current state and intentionally resets unfinished choices and old history, so that migration has a verifiable result.
41. As a campaign operator, I want legacy writes rejected and old tabs required to reload, so that queued requests cannot corrupt the new draft model.
42. As a campaign operator, I want a verified backup and recovery procedure before reopening editing, so that a failed cutover can be reversed without losing newly accepted player work.

## Implementation Decisions

### Authority and decision precedence

The accepted resolutions linked from #33 are normative, including all three parts of the 95-entry audit in #54. Later explicit resolutions take precedence over earlier tentative wording:

- #36 supersedes the old product-description requirement for first-claim locking, timeouts, release transitions, and per-slot confirmation. Slots are empty or staged and jointly editable until Weekly Confirmation. This conflict with older repository guidance must remain explicit during implementation.
- #56 and #55 supersede #34's description of treasury transactions, rank-up, and persistent buyoff as immediate adjacent operations. Their weekly effects must be staged, previewed, and committed through Confirmation. Historical navigation remains a separate read-only operation.
- #56 permits an over-capacity choice through a reasoned Rules Exception; #36's unready-until-move-or-clear wording does not remove that later exception path.
- Written militia rules are the baseline except for named accepted interpretations. Existing tests and current behavior do not authorize preserving a demonstrated defect.

### Module ownership and seams

| Module or adapter | Interface and ownership |
| --- | --- |
| Weekly Draft Workspace | One external feature seam, exposed through `useWeeklyDraftWorkspace`. Discriminated `unavailable`, `loading`, `failed`, and `ready` states; only ready exposes the current discriminated Phase View and `edit`, `viewPhase`, and `confirm` operation families. Owns orchestration, local Phase View selection, projection composition, and translation of semantic operations. |
| Weekly Draft contract | Shared canonical validators, inferred types, defaults, and semantic edit validation. Convex storage and argument validators derive from this contract. |
| Action Slot | Internal pure module owning complete action-discriminated choices and atomic choice operations. Does not introduce a second UI seam. |
| Weekly Draft Rules Projection | Shared pure projection from a Weekly Draft Revision and militia snapshot to phase facts, eligibility, readiness, warnings, action requirements, resolved events, and Resolution Preview. Owns all pre-Confirmation militia calculation. |
| Weekly Draft Persistence | Internal seam with production Convex and deterministic in-memory adapters. Owns ordering, acknowledgements, target-aware concurrency, retries, draft identity isolation, and the Confirmation barrier. |
| Weekly Resolution | Existing adjacent deterministic module, extended only where its interface must consume canonical source and produce the complete change plan. Confirmation applies that plan atomically. |
| Browser interaction and input adapters | Own editable text, pointer/hover/drag state, DOM references, animation, formatting, and conversion to semantic edits. |
| Board shell and phase presentation | Thin composition and rendering. Phase Views contain facts and affordances; presentation owns copy, styling, grouping, card order, and static explanations. History navigation composes beside Workspace. |

Depth comes from hiding orchestration and persistence behind the small Workspace interface. Its deletion would redistribute that complexity to the board and phase callers. Avoid pass-through modules that recreate the current field-by-field controller interface. UI and Workspace behavior tests must not depend on raw synchronized drafts, query composition, setters, flushing, retries, DOM references, or private projection structures.

### Canonical Weekly Draft and input contract

- Store one typed revisioned envelope with stable Weekly Draft identity, revision, week number, immutable week-start context, and domain inputs grouped by Upkeep, Activity, Event, and Table Adjustments. Include the typed persistent-event decisions needed by projection without creating a competing draft representation.
- Fixed context includes Persistent Phase Eligibility, determined once from unresolved events carried into the week. Current-week event creation or resolution does not change it. Retain first-use context independently of the displayed week number.
- Canonical values are typed or explicitly absent. Phase selection, readiness, warnings, Resolution Preview, browser text, transport state, and Convex document identifiers are not canonical editable domain inputs.
- Semantic edits are discriminated domain operations, including explicit clears. Do not accept generic partial objects, string paths, form events, or raw text at the Workspace seam.
- Numeric roll/count entry accepts only blank or ASCII digits. Reject invalid typing/paste without changing the field; reject signs, decimal points, exponent notation, and whitespace. Blank emits a clear; accepted digits become a structurally valid non-negative integer. Rules ranges are advisory. Monetary entry uses explicit units that preserve copper precision. Signed Table Adjustments use their own typed validation.
- Browser forms use React Hook Form and Zod with styled field-level errors that distinguish required input from invalid format. Error expansion must not misalign adjacent controls. Canonical domain validators remain the single shared shape; browser schemas validate entry, not a separately maintained persistence model.
- Retain raw dice and modifier provenance, stable action-choice and event-occurrence identities, independent event trees and replacement rolls, per-instance persistent targets and mitigation, narrative acknowledgements, Rules Exceptions, Table Adjustments, operating settlement and consumable bonuses, and order due-day/receipt facts.

### Action Slots and collaboration

- Activity owns an ordered collection of slots with stable identities independent of display position. A slot owns zero or one complete action-discriminated Staged Action Choice, including assigned team and every action-dependent input. Partial choices are valid draft state.
- Replacing an action removes incompatible prior details. A detail edit verifies that the same staged choice still occupies the target; replacing it with another choice of the same action type must not make an obsolete detail edit safe.
- Deck-to-empty stages; deck-to-occupied replaces; slot-to-empty moves; slot-to-occupied swaps; slot-to-outside clears. Each operation moves or changes complete choices atomically.
- Retain occupied extra slots when capacity shrinks. Warn and require correction or a reasoned Rules Exception before Confirmation. Never truncate staged choices to fit capacity.
- Structural invariants belong to Action Slot. Cross-slot rules such as team use, Lie Low exclusivity, Drill uniqueness, and capacity belong to Rules Projection.
- There are no claims, claimant identities, ownership locks, timeouts, release lifecycle, or persisted per-slot confirmed states. Card interactions stage work; the whole week has the explicit Confirmation action.

### Persistence and Confirmation contract

- Show semantic edits immediately as pending. `edit` resolves as accepted only after storage; otherwise it resolves failed, discards the failed edit, restores the latest server value, and presents the standard save-failed feedback. Do not expose a separate conflict result.
- Each operation carries a stable draft identity, client operation identity, and base revision. A stale edit can be accepted only when none of its targets changed since that base. Any changed target rejects the entire edit.
- A normal field is one target. Choice replacement, clear, move, and swap target every affected slot. Detail edits target the detail and verify unchanged choice identity. Validate referenced entities and campaign ownership server-side.
- Process each Workspace's submissions in order; later edits cannot finish before earlier edits. Every accepted semantic edit creates exactly one revision. Batching must have the same visible result as ordered individual processing.
- Retry temporary transport failures internally with the same operation identity. Deduplicate accepted retries. Do not automatically retry server rejections. Older responses must never replace newer visible revisions.
- Keep pending edits only for the open page and warn on page exit. Phase navigation neither waits for, cancels, nor flushes edits.
- Confirmation waits for earlier local edits, pauses new local edits, and uses exactly the accepted source the player reviewed. Never substitute the newest or just-flushed revision silently. Relevant militia-snapshot changes outside the draft must also invalidate the reviewed source.
- A pending browser forecast cannot confirm. After acceptance, the matching Convex preview replaces it. Both previews are forecasts; the transactional Weekly Resolution is authoritative.
- Confirmation returns accepted or failed. A stale source, incomplete required input, invalid reference, or failed write rejects the entire transaction. On failure, keep the draft open, load current state, and require review and another explicit attempt.
- Success atomically applies the complete change plan, records the full confirmed source and outcome, closes the old identity, and creates exactly one empty successor with fresh identity and fixed week context. Delayed edits tied to the old draft fail; simultaneous Confirmations cannot advance twice.

### Rules Baseline, exceptions, and complete outcomes

Compute rules in weekly order: Upkeep, ordered Activity choices, Event, and applicable persistent/successor processing. Read carried persistent facts wherever earlier calculations need them. Local Phase View navigation does not change resolution order.

The complete Rules Baseline precedes ordered typed Table Adjustments. Any player can record a Rules Exception with a required reason to permit a rule-disallowed choice; it does not change arithmetic. Missing required inputs and malformed data still block Confirmation. Distinguish optional mitigation not attempted from an attempted but incomplete mitigation.

Cover all 24 actions, 24 event-table outcomes, four team trees, advancement/reputation/cache tables, officer and manager mechanics, team conditions and recovery/loss, boons, first-use behavior, queued effects, persistent events, and compound interactions. Deterministic values are computed automatically. Dice and narrative adjudication are supplied and recorded; showing explanatory text alone does not execute an outcome. Record reward, boon, encounter, and support acknowledgement with the prescribed quantities and conditions without building tactical or character-builder execution.

The preview and authoritative plan include every militia, team, officer, settlement, cache, marketplace, order, tracked-person, event, queue, and acknowledgement effect. Transaction write loops validate authority and apply the plan; they must not derive additional hidden outcomes. No stale input may grant a benefit for an action no longer staged.

Apply all nine policies accepted in #56:

1. Correct every unaccepted baseline defect. Rank 1 has one baseline action; failed Dismiss Team still removes its target and applies rolled Notoriety. Manual outcomes and missing models remain required work.
2. Calculate deterministic defaults, compose modifiers exactly once, retain raw dice and natural-roll provenance, and record explicit narrative adjudication.
3. Keep reasoned shared Rules Exceptions distinct from reasoned Table Adjustments, retaining both in confirmed source/history.
4. An eligible uneventful week supplies one current-rank modifier to the following week's event chance, not its percentile roll; do not accumulate bonuses across quiet weeks. Preserve first-use and event-specific exclusions, account for automatic events, and bound chance to 10–95%.
5. Resolve duplicate events without a Twice clause independently. Apply actual Twice replacement/enhancement clauses and explicit no-additional-effect clauses. Repeated Roll Twice requires replacement rolls rather than disappearing results.
6. Persistent Double Agent blocks Secure Cache during each affected Activity until ending and applies one −2 Secrecy penalty. Do not add a second queued penalty. A nonpersistent occurrence affects the next Activity only; intentional exceptions remain possible.
7. First persistent buyoff is available immediately. Later buyoffs share one militia-wide four-week cooldown: a week-2 buyoff permits the next in week 6. Cost is twice current minimum treasury; preview the staged cost/end and apply warning/exception policy to insufficient funds.
8. Preserve Special Order duration in days, including one-day expedited delivery and its surcharge, enchantment timing, and explicit receipt with no duplicate receipt. Broker Market retains its separate next-Activity timing.
9. Floor whole counts without invented minima and preserve money to copper precision. Rank-1 Strike Team supplies zero baseline support rounds; odd-level rescue Notoriety and split XP round down.

The audit's full inventory remains required, not just its headline defects. Mandatory examples include first-week skip independent of week number; post-loss multi-rank progression; ordered costs before Theft; no gain without its action; complete readiness; exact-once modifiers; High Morale, Found Fire, and Calm before the Storm duplicates; recurring Rivalry targets and ending; and all queued-effect duration, check, and loss branches.

### Campaign models and history lifecycle

- Give individual teams stable identities, allowing repeated team types and reward-team cap exemptions. Support multiple officer holders, non-stacking rules except Commandants, distinct Commandant Hit Dice, manager limits, ordered officer changes, and occurrence-specific Strategist bonuses.
- Preserve settlement context, per-event targets and stable age/order, temporary mitigation versus permanent ending, buyoff bookkeeping, one-use bonuses, carry, and precise delivery/receipt state. Extend affected ledger and onboarding interfaces with their required facts.
- New and mid-campaign setup create the same canonical draft lifecycle. Rule deviations in structurally valid existing state remain advisory.
- Exactly one open Weekly Draft exists per militia. A closed draft survives as the complete source of its immutable Resolution Record, not another editable historical draft.
- Store source, Ruleset Version, baseline/final change plans, warnings, Rules Exceptions, Table Adjustments, and final outcome. Increment Ruleset Version when resolution behavior changes, not for presentation or implementation-only changes.
- Historical Week Views read effective immutable records and their recorded source/context, never today's militia snapshot or legacy rollback snapshots. Select the newest unsuperseded record; retain older records as audit history and never merge them.
- Reserve supersession links and the separate History Rewrite seam for future Historical Reconstruction and Historical Correction. Those operations must not reopen a Weekly Draft. The established future contract is one shared rewrite per campaign, ordered recalculation stopping at the first conflict, and atomic publication only after the complete rewrite is valid and explicitly confirmed. Building that editor is outside this implementation.
- Preserve campaign/organization access controls, shared player preparation and Confirmation, and the GM-only correction authority seam. Keep GM controls hidden from non-GM players and enforce authority in the backend.

### Ordered extraction and migration checkpoints

Follow the accepted sequence in #55. Each extraction keeps the supported application usable, preserves established coverage, and adds outcome coverage for the moved behavior. Move each calculation once. When legacy inputs represent the facts faithfully, browser and server consumers switch to the shared calculation together. When necessary facts are absent, build and test the canonical path in isolation until cutover; do not fabricate raw rolls, collapse occurrences, or discard reasons to fit legacy storage.

1. **Establish verification.** Verify generated Convex artifacts and restore/read the generated AI guidelines before backend implementation. Establish a passing typecheck, lint, and collected-test baseline. Create the machine-readable rules catalog from all 95 audit entries, expanding compound cases and recording gaps. Establish isolated Convex test persistence, transport controls, authenticated browser contexts, and CI gates before extraction depends on them. Missing, skipped, todo, or failed tests do not count as passing coverage.
2. **Introduce canonical contract and Action Slot.** Implement validators, defaults, immutable context, semantic edits, stable identities, partial choices, explicit absence, atomic complete-choice operations, and the additional raw-roll/event/adjudication facts. Prove structural validation, zero versus missing, stale-detail removal, whole-choice movement, and retained extra slots. No live storage changes at this stage.
3. **Prepare additive storage and campaign prerequisites.** Add canonical draft and immutable-record storage beside legacy storage, including deduplication, conflict metadata, and one-open-draft enforcement. Prepare richer teams, officers, events, settlement context, money, and delivery models and their ledger/setup support. Prepare restartable mapping while preserving the usable old release; keep new endpoints unavailable to live campaigns. Existing teams receive stable identities and existing officer holders become singleton collections. Unrecoverable Hit Dice, event targets/order, delivery context, and week-start facts require explicit preflight resolution. Mapping must not guess them or recalculate live balances.
4. **Extract Rules Projection.** Move foundations first, then Upkeep, Activity, Event, and persistent/successor behavior. After each slice require corrected named outcomes, important edge cases, dependent-phase recomputation, and browser/Convex parity. Temporary old exported helpers may translate shapes and delegate only. Do not activate a corrected capacity calculation through a legacy save path that truncates occupied slots.
5. **Complete preview and change plan.** Extend Weekly Resolution only as required. Stage treasury/rank/buyoff effects; account for every authoritative effect; distinguish incomplete required input from unattempted optional mitigation; invalidate previews for all outcome-affecting source changes. Require full preview-to-committed-state-diff equality and retained adjudication source.
6. **Implement Persistence adapters and lifecycle.** Build both adapters against the same contract, including target-aware stale edits, deduplication, ordering, monotonic observations, draft isolation, exact Confirmation, immutable records, and successor creation. Verify production persistence on an isolated deployment and transactional access/race/rollback cases with Convex integration tests. Wrapping the existing last-write-wins save endpoint is insufficient.
7. **Replace Workspace orchestration and phase builders.** Move controller, mutation orchestration, and synchronization responsibilities behind Workspace. Convert Upkeep, Activity, Event, Persistent, and Summary in that order. A temporary canonical-Phase-View-to-existing-props adapter may preserve presentation; remove it when its caller migrates. Keep input/browser mechanics in adapters and leave a thin board shell. Replace coupled tests only after their meaningful behaviors pass at the new interface or an accepted decision supersedes them. Exercise the canonical path in isolation before cutover.
8. **Pass completeness and rehearsal gates.** Require human-reviewed complete corpus coverage, passing mapped tests, current source fingerprints, no unexplained gaps, and projection parity. Rehearse the entire write pause, verified backup, restartable preservation/reset, reader/writer switch, legacy rejection, reload, and pre-reopen recovery on isolated data. Verify one fresh draft, empty choices/new history, retained state/context/carry, and no initialization-triggered Upkeep, queued effects, or week advancement.
9. **Perform paused cutover and retire legacy.** At the later operational cutover, reject all affected campaign writes server-side, including legacy save/confirm/rollback and adjacent writes; take and verify a restorable backup while paused; initialize and verify canonical state; switch readers/writers together; require reload; reopen only after acceptance. Keep old endpoints rejected afterward. Retire temporary adapters, duplicate calculations, old controllers/builders, legacy rows, and obsolete schema fields after acceptance; retain the backup through the verification window.

Map every audit entry to these checkpoints and expanded executable cases. Foundations/officers/teams span stages 2–4; Upkeep/actions span 4–5; Event cases span 4–5; persistence/product contracts span 2–9. Full coverage is a cutover prerequisite, not an assertion made while the initial catalog still contains known gaps.

### Preservation, reset, and recovery contract

Preserve authoritative current militia values, current week number, characters, officer assignments, teams/conditions, settlement reputation, assets, active/persistent events, first-use metadata, uneventful carry, queued effects, persistent age/order, and buyoff bookkeeping. Retain recoverable week-start context even when it currently lives in legacy week storage.

The approved migration intentionally resets unfinished current-week choices and excludes legacy Resolution Records and embedded rollback history from the new active model. Start history with the first new Confirmation. Retain original storage temporarily for rollback. Initialize exactly one empty draft per militia at an initial revision with fresh stable identities, initial conflict metadata, and empty operation deduplication. Restarting initialization must not duplicate entities, drafts, or carry.

Initialization must not execute Upkeep or Weekly Resolution, apply queues, advance the week, reverse already-applied changes, or retrospectively correct existing balances. Resolve missing required context during preflight before reopening. Verify preserved values/references against backup; exercise editing and Confirmation only in isolated rehearsal, not by advancing a production campaign as a test.

Before reopening, a failed cutover recovers with the compatible old release and retained data or verified backup while writes remain paused. Reopening ends automatic rollback: newly accepted work must be preserved or its loss separately agreed. No online migration, dual writes, unfinished-choice converter, legacy-history reconstruction, or reverse converter is required.

## Testing Decisions

Good tests assert externally observable behavior through the highest useful module interface. Prefer the Workspace seam for integrated edit/readiness/Phase View behavior, the existing Weekly Resolution interface for outcome/change-plan assertions, and the real Persistence seam where two adapters actually vary. Private setters, effect schedules, merge-object shapes, batching calls, and hook wiring are not contracts.

- **Rules Projection and Weekly Resolution:** Cover named rules outcomes and compound edge cases through the pure interfaces. Check full baseline, adjusted result, required inputs, and complete committed state differences. Reuse meaningful week-advancement, progression, officer/manager, and Weekly Resolution test scenarios after reviewing their expectations against the accepted rules policies.
- **Rules catalog:** Maintain one machine-readable test artifact with stable rule IDs, source references/fingerprints, expected Phase View or Resolution Preview behavior, important cases, and stable named test IDs; generate a readable report. Validate against collected results. Fail for missing mappings, stale sources, missing/failed/skipped/todo referenced tests, or browser/Convex divergence. Source links and fingerprints prove traceability; human review of the full corpus establishes completeness. All 95 audit entries are starting inventory, not a ceiling.
- **Workspace:** Assert readiness states, semantic edit outcomes, local Phase Views, immediate pending feedback, recovery to accepted state, explicit clearing, navigation during pending work, page-exit warning, and reviewed-source Confirmation. Assert fixed Persistent Phase Eligibility when events end or appear midweek.
- **Shared Persistence contracts:** Define scenarios once and run against both adapter factories. The Convex adapter must exercise actual isolated Convex persistence; mocked successful mutation returns are insufficient. Control transport timing without replacing transaction behavior. Cover disjoint stale edits; same-target failure; atomic multi-slot moves/swaps; obsolete detail edits after replacement; one revision per accepted edit; dropped responses and idempotent retry; ordered acknowledgement; monotonic delivery; and closed-draft rejection.
- **Transactional integration:** Retain and adapt the existing Convex history integration foundation. Cover actual authorization, cross-campaign references, GM-only correction authority, mapping, stale source rejection including external militia changes, edit/Confirmation races, simultaneous Confirmations, all-or-nothing failure, immutable records, effective history selection, and exactly one successor. Keep the full rules permutation suite in pure tests.
- **UI:** Preserve formatting and card interaction tests, explicit clear/zero behavior, styled validation, feedback, and browser mechanics. Use existing design-system controls and accessible production interactions. Rule calculations move out of presentation tests with the calculations themselves.
- **Replace coupled tests:** Rewrite controller/mutation/synchronization tests around Workspace and Persistence outcomes. Incrementally replace the hand-built mutation database harness with pure outcome tests or transactional integration; mocked authorization and a hand-built database do not prove access control or rollback. Delete a scenario only when its replacement passes or a linked accepted decision changes the expected behavior. Legacy rollback mechanics are not requirements to retain.
- **Two-player browser gate:** Require separate authenticated browser contexts against isolated Convex persistence before extraction merges. Prove shared edits, independent Phase Views, same-target failure and visible recovery as the new contract lands, Confirmation races, and delayed edits after advancement. Assert eventual agreement, one history outcome, and one successor through domain-state observations rather than arbitrary sleeps or internal calls. Add runner setup, test identities, deployment cleanup, and CI wiring before relying on this gate.
- **Rehearsal:** Assert the full preservation/reset/restart/rejection/reload/recovery contract, including no rule execution during initialization. Production campaigns are not test fixtures.

Every feature extraction runs `pnpm -s typecheck`, `pnpm -s lint`, relevant tests, and the required browser gate for the supported path. Establish new contract scenarios as their implementations land. Full reviewed rules coverage, real adapter verification, multiplayer evidence, and successful cutover rehearsal are mandatory before reopening the migrated application.

## Out of Scope

- Performing implementation, deployment, or production migration merely by publishing this specification.
- Visual redesign of the week board; retain the tablet-landscape, multi-device card workflow and usable desktop/phone layouts.
- New militia rules or modifications to the campaign rules corpus.
- A full character builder, tactical combat simulator, or automatic execution of GM narrative adjudication.
- Reworking Weekly Resolution internals beyond the interface and completeness needed by this architecture.
- Detailed History Rewrite editing/conflict-resolution UX or reopening old Weekly Drafts. Required record/lifecycle seams remain in scope.
- Prescribing detailed exception and receipt presentation beyond the required shared data, semantic operations, feedback, and outcomes.
- Claim ownership, per-slot confirmation, offline/reload-safe pending edits, dual authority, online migration, and preservation/conversion of discarded unfinished choices or legacy history.

## Further Notes

This specification is the implementation handoff from the closed planning map, not evidence that its acceptance criteria already pass. Local inspection still finds the existing controller/phase-builder architecture and adjacent Weekly Resolution module. Generated Convex runtime/type artifacts exist, but the generated AI guidelines are absent in this checkout; verification setup must address that before backend implementation. No application tests were run during this synthesis.

Use the repository's domain glossary and militia rules/tables throughout implementation. No relevant ADR directory was present during inspection. Existing local edits to agent guidance and the domain glossary are outside this publishing task.

Related work: reuse the E2E infrastructure strategy and implementation tickets indexed by [#39](https://github.com/AndreasUnunger/EverythingPath/issues/39), especially #22–#25, instead of creating a competing harness. The current realtime journey #29 contains older Confirmed Action Choice/deferred-claim language; update that journey's expectations to #36/#38 when this architecture lands. Persistent Rivalry [#31](https://github.com/AndreasUnunger/EverythingPath/issues/31) overlaps mandatory persistent-event behavior here; preserve its regression while integrating the shared projection and per-instance targets. These links do not assert that related work is implemented or close those issues.

Normative decision sources:

- [#34 — Workspace seam](https://github.com/AndreasUnunger/EverythingPath/issues/34), [#35 — canonical representation](https://github.com/AndreasUnunger/EverythingPath/issues/35), and [#36 — Action Slot aggregate](https://github.com/AndreasUnunger/EverythingPath/issues/36).
- [#37 — Rules Projection](https://github.com/AndreasUnunger/EverythingPath/issues/37) and [#38 — Persistence consistency](https://github.com/AndreasUnunger/EverythingPath/issues/38).
- [#51 — draft/history lifecycle](https://github.com/AndreasUnunger/EverythingPath/issues/51), [#52 — paused cutover](https://github.com/AndreasUnunger/EverythingPath/issues/52), and [#53 — test architecture](https://github.com/AndreasUnunger/EverythingPath/issues/53#issuecomment-5574149639).
- [#54 — foundations, Upkeep, and teams audit](https://github.com/AndreasUnunger/EverythingPath/issues/54#issuecomment-5574293220), [all actions](https://github.com/AndreasUnunger/EverythingPath/issues/54#issuecomment-5574294663), and [events, persistence, and product contracts](https://github.com/AndreasUnunger/EverythingPath/issues/54#issuecomment-5574295825).
- [#56 — accepted exception policies](https://github.com/AndreasUnunger/EverythingPath/issues/56#issuecomment-5580025789) and [#55 — accepted migration sequence](https://github.com/AndreasUnunger/EverythingPath/issues/55#issuecomment-5580172144).
