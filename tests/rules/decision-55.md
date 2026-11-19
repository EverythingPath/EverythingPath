## Superseding review decisions — 2026-09-23

The user's review of #88 supersedes conflicting historical expectations below:

- P10.gm: all organization members have equal editing and correction access; there are no separate GM permissions at this stage.

- F02.ap-caps: remove current Adventure Path/volume tracking and volume-based rank limits.
- F04.shrink: preserve choices in unavailable slots, but block Confirmation until moved, cleared, or allowance restored. Rules Exceptions cannot bypass action capacity.
- F04.context: extra actions from story rewards are deferred to [backlog #98](https://github.com/AndreasUnunger/EverythingPath/issues/98).
- F05.order: recruitment and dismissal in the same committed week work in either order when the resulting roster fits team capacity.

Part of #33.

## Question

What exact migration order safely replaces the current Weekly Draft controller, storage shape, duplicated rules, and phase builders with the decided Weekly Draft Workspace, canonical Weekly Draft Revision, Action Slot aggregate, Weekly Draft Persistence adapters, and Weekly Draft Rules Projection?

Name each extraction step, temporary adapter, compatibility point, data migration or backfill, and test checkpoint. Keep the app usable and the test suite green after every step. Avoid running old and new rule implementations as competing sources of truth. Include the full militia-rules coverage gate and every bug or product exception decided earlier in this map.

Planning only: do not implement the refactor in this ticket.


## Resolution: Weekly Draft migration sequence

Planning only. The driving developer accepted correcting rules alongside each extraction, with representation-dependent behavior activated only once its storage and inputs are ready. The driving developer also confirmed the complete nine-step sequence in the live Wayfinder discussion (“Yes”). This is the accepted planning resolution.

## Fixed decisions and activation discipline

Use the Workspace, canonical Revision, Action Slot, Persistence, Rules Projection, lifecycle, paused-cutover, test-architecture, audit, and exception decisions indexed in [Untangle the Weekly Draft board architecture](https://github.com/AndreasUnunger/EverythingPath/issues/33). This sequence does not reopen them.

Move each calculation once. Where the old input shape represents the required facts unambiguously, both old browser and server consumers delegate to the extracted implementation in the same change, and corrected outcome tests replace wrong expectations. Where required facts are absent, implement and test the canonical path without activating it for live campaigns until cutover. Do not synthesize raw dice from entered totals, collapse independent occurrences, or discard reasons to fit legacy storage.

The old application remains usable while the canonical path is assembled in isolation. For an activated rule there is one implementation; old and new projections must never compete to produce a live result. The retained old release/data is a rollback artifact, not a second runtime authority. No dual writes, old-client compatibility converter, unfinished-choice conversion, or history reconstruction is required.

## Ordered extraction and checkpoints

### 1. Establish executable verification before extraction

Restore the generated Convex files, including the required `convex/_generated/ai/guidelines.md`, and read those guidelines before backend implementation. Establish a passing typecheck, lint, and collected-test baseline; the audit's missing-import suite failures and pending tests are not passing coverage.

Create `tests/rules/coverage-catalog.ts` from all 95 audit entries, expanding compound entries into individual rule/case mappings. Record source references/fingerprints, expected behavior, test IDs, and explicit remaining gaps. Wire collected-result validation and a readable report. Establish isolated Convex deployment setup/cleanup, test identities, transport controls, and two authenticated browser contexts before extraction merges rely on them.

Checkpoint: the existing supported behavior runs; every subsequent extraction passes `pnpm -s typecheck`, `pnpm -s lint`, relevant tests, and the required two-player suite for the supported path. New contract scenarios become mandatory as their implementations land. Known coverage gaps remain visible; no skipped/todo/missing test establishes coverage, and no global full-coverage claim is made early.

### 2. Introduce the canonical contract and pure Action Slot module

Define shared validators, inferred types, defaults, immutable week context, explicit absence, and domain-specific `WeeklyDraftEdit` variants. Add stable draft, slot, action-choice, event-occurrence, and referenced-entity identity where needed. Activity is an ordered collection of slots owning complete action-discriminated choices, including assigned team, details, rolls, and costs.

Implement stage/replace, detail edit, clear, move, and swap as pure semantic operations. Retain occupied slots when capacity shrinks; projection supplies the warning/exception/readiness result. There are no claims, ownership locks, timeouts, or per-slot confirmations. The later Rules Exception decision permits an otherwise out-of-rules extra choice when its required reason is recorded.

Add canonical facts needed by the audit: raw rolls and modifier provenance; independent event trees and replacement rolls; per-instance persistent targets, mitigation and ending; narrative acknowledgements; Rules Exceptions and typed Table Adjustments; due-day and receipt data; operating settlement and one-use bonuses. Keep temporary input text outside the contract. Use the agreed digits-or-blank grammar for count/roll entry, explicit clears, and explicit units for monetary inputs so copper precision survives; signed Table Adjustments retain their own validation.

Checkpoint: structural validation, partial choices, explicit zero versus missing, action replacement clearing stale details, complete-choice atomic movement, stable identity, and retained over-capacity choices pass through the pure interface. No live storage changes yet.

### 3. Prepare additive storage and campaign-state prerequisites

Add dedicated canonical draft and immutable Resolution Record storage beside legacy storage, with schema deriving from shared validators. Prepare draft identity/revision, operation deduplication, target-conflict metadata, one-open-draft enforcement, complete source records, and effective-record selection. New endpoints remain inaccessible to live campaigns until activation.

Prepare richer campaign state needed for rules: independent team identities and reward exemptions; multiple officer holders and distinct Commandant Hit Dice; retained settlement context; persistent-event identity, age/order, targets and buyoff bookkeeping; carry and consumable effects; exact order timing and receipt status. Update affected ledger/onboarding interfaces alongside their model support. New campaign creation and mid-campaign setup must eventually initialize the same canonical lifecycle.

Prepare restartable cutover mapping, rather than mutating active campaigns now. Existing individual teams receive stable identities; existing officer holders become singleton collections. Preserve established values and references. Missing Hit Dice, event targets/order, delivery context, or week-start facts require explicit preflight resolution where they cannot be recovered; do not guess them from discarded choices. Do not retrospectively recalculate live balances or execute rules during initialization. Additive schema support must keep the old release usable until cutover.

Checkpoint: mapping fixtures preserve authoritative state and references, support repeated team types/multiple officers, and round-trip monetary precision. Initializer reruns do not duplicate entities, carry, or drafts. Model-dependent behavior is still inactive for live campaigns.

### 4. Extract Rules Projection in dependency order

Use one shared pure `projectWeeklyDraft({ revision, militiaSnapshot })` interface, with focused internal implementations. Extract in this order:

1. Foundations: rank/table lookups, team definitions, identity-aware capacity, focus/check composition, officer and manager mechanics, settlement modifiers, money and whole-count rounding.
2. Upkeep: fixed first-use context; ordered attrition, Notoriety and treasury checks; post-loss multi-rank advancement and boon acknowledgements; staged treasury operations.
3. Activity: process whole choices in slot order against the projected roster/resources/officers; eligibility, all action outcomes and requirements, once-per-team/Drill and Lie Low constraints, Strategist's designated choice, recovery/recruitment/upgrade, assets and narrative records.
4. Event: bounded chance, carry, settlement result modifiers, Sabotage, independent occurrences, automatic events, nested Roll Twice replacements, duplicates/Twice clauses, and every event's outcomes and required inputs.
5. Persistent and successor effects: oldest-first stable processing, per-instance weekly mitigation/end/buyoff, queued effects and expiry, next-week context, and precise order delivery/receipt.

Read carried-event facts during earlier steps whenever they affect checks or availability; the sequence of code extraction does not change the rules' runtime order. Replace duplicated browser/Convex action requirements, event derivation, and calculation helpers as each slice activates. Existing exported helpers may temporarily delegate to the new pure implementation with shape translation only.

Checkpoint after each slice: corrected named outcomes and important edge cases pass; browser and Convex entry fixtures agree; dependent later-phase results recompute correctly. Do not activate an isolated numeric fix if it triggers legacy destructive behavior—for example rank-1 capacity cannot ship through a save path that silently slices away occupied slots.

### 5. Complete the Resolution Preview and authoritative change plan

Extend the existing Weekly Resolution interface only as needed to consume the canonical source and shared calculations. Include every militia, roster, officer, settlement, cache, order, person, event, queue, and acknowledgement effect in the preview/change plan. Move hidden calculation logic out of confirmation write loops; transaction code applies the plan and validates authority rather than independently deriving outcomes.

Compute the complete Rules Baseline first, then ordered typed Table Adjustments. Rules Exceptions permit choices without modifying arithmetic. Required missing inputs and malformed references still block Confirmation. Optional mitigation not attempted differs from an attempted incomplete mitigation. All outcome-affecting source changes must invalidate the reviewed preview, including relevant campaign edits outside the draft.

Treasury deposits/withdrawals, rank effects, and persistent buyoff participate in staged weekly outcomes under the later audit/exception/lifecycle decisions; the earlier seam ticket's adjacent-operation wording must not preserve immediate writes that bypass reviewed Confirmation. Historical navigation stays a separate read-only operation. Preserve the authority seam and GM-only correction controls without implementing the deferred History Rewrite editor.

Checkpoint: full preview-to-committed-state-diff equality; no hidden effects or double-applied totals; required-input matrices; explicit departures retained in confirmed source; incomplete drafts cannot confirm.

### 6. Implement both Persistence adapters and the new lifecycle

Implement the deterministic in-memory adapter and production Convex adapter against the same contract. Require stable draft/operation identity and base revision; target-aware stale-edit acceptance/rejection; atomic multi-slot edits; detail edits checked against the same staged choice; one revision per accepted semantic edit; idempotent retries; ordered acknowledgements and monotonic responses. Do not wrap the legacy save endpoint and claim it provides these guarantees.

Confirmation is an exact-reviewed-revision barrier. It waits for earlier local edits, pauses new local edits, rejects a changed reviewed source, and atomically applies the complete plan, records the full source/ruleset/outcome, closes the old identity and creates one empty successor with fixed context. Delayed edits cannot reach the successor. History reads effective immutable records, never today's militia snapshot or legacy rollback snapshots.

Checkpoint: run shared contract scenarios against both adapters, with the production adapter exercising actual isolated Convex persistence. Retain focused `convex-test` authorization, cross-campaign reference, race, atomic-failure, immutable-history and lifecycle cases. Test edits racing edits/Confirmation, two Confirmations, dropped responses and retries, remote source changes, and stale closed-draft requests.

### 7. Replace controller orchestration and phase builders through Workspace

Introduce `useWeeklyDraftWorkspace` with unavailable/loading/failed/ready states, discriminated Phase Views, and `edit`, `viewPhase`, `confirm`. Replace `use-week-board-controller.ts`, `use-week-board-mutations.ts`, and `week-board-controller-sync.ts` responsibilities behind it. Keep local Phase View navigation immediate during pending edits, standard failure recovery, pending acknowledgement and page-exit warnings.

Convert phase sections in Upkeep, Activity, Event, Persistent and Summary order, consuming projection facts without rule calculations. A temporary canonical-Phase-View-to-existing-props adapter may preserve presentation while each section changes. Remove that adapter as soon as its caller migrates. Keep text parsing and pointer/drag/DOM mechanics in browser adapters; drops emit complete semantic edits. `WeekBoard` becomes a thin shell, and `build-view-models.ts` no longer provides a parallel orchestration interface.

Checkpoint: Workspace outcome tests, formatting/clear/drag/feedback UI tests, and real two-player agreement with independent navigation. Replace old tests only after their meaningful scenarios pass at the replacement interface or a linked decision supersedes their expected behavior. Retain useful Weekly Resolution and history integration cases; retire the hand-built database harness incrementally. Exercise the new path in isolation until cutover.

### 8. Pass completeness and paused-cutover rehearsal gates

Require human-reviewed coverage of the complete rules and tables corpus, with all mapped test IDs present and passing, fingerprints current, no unexplained gaps, and browser/Convex parity. The audit inventory is the starting point, not the completeness ceiling. All 24 actions, 24 event-table outcomes, four team trees, tables, officers, managers, sequence, persistence and product contracts must be covered, including important compound cases.

Rehearse server-side write pause, verified restorable backup, restartable preservation/reset, reader/writer switching, legacy-request rejection, reload and pre-reopen rollback on isolated data. Verify all campaign state/current week/context/carry retained, exactly one fresh empty draft per militia, empty new history, and no Upkeep, queued-effect execution or week advancement caused by initialization. Test new editing/Confirmation in isolation, never by advancing a production campaign as a test.

### 9. Perform the agreed paused cutover, then retire legacy code

At implementation time: reject all affected campaign writes server-side, including legacy save/confirm/rollback and adjacent writes; take and verify backup while paused; initialize preserved state and canonical drafts; verify invariants and rejected old requests; switch readers/writers together; require reload; reopen only after verification. Old endpoints remain rejected after reopening.

Before reopening, recover using the compatible old release and retained old data or backup while writes remain closed. Reopening ends automatic rollback: newly accepted work must be preserved or its loss separately agreed. After acceptance, remove temporary adapters, old controllers/builders/calculations, legacy rows and obsolete schema fields; retain the backup through the agreed verification window. Do not keep dual authority for convenience.

## Mandatory bug and exception accounting

Every one of the audit's 95 entries must map to an extraction checkpoint and its expanded executable cases. Foundations/officers/teams map to steps 2–4; U01–U06 and A01–A24 to steps 4–5; E and EV entries to steps 4–5; P01–P11 to steps 2–9. The audit's explicit defect group—F01/F04, U01/U04/U06, T03/T05/T06, A06/A07/A19/A22, E03/E04/E06/E07, EV03/EV04/EV05/EV07/EV09/EV11/EV15/EV16/EV19/EV23—is mandatory but not exhaustive. Manual outcomes and missing models are also required work.

Apply all nine accepted exception-policy decisions: correct unaccepted defects; calculate defaults and record dice/narrative acknowledgement; require reasoned shared Rules Exceptions separately from Table Adjustments; use one current-rank bonus to next eligible week's bounded event chance without accumulation; resolve no-Twice duplicates independently and apply actual Twice clauses; keep persistent Double Agent's cache restriction and single −2 penalty until ending; allow immediate first buyoff then a militia-wide four-week cooldown at twice current minimum treasury; retain day-based Special Order timing and explicit receipt while Broker Market keeps next-Activity timing; floor whole counts without invented minima and preserve money to copper precision.

Explicit regression examples include rank-1 one-action baseline, failed dismissal still removing its target and adding Notoriety, first-week skip independent of displayed week, post-loss rank progression, ordered costs before Theft, no action gain without its action, complete readiness, exact-once modifiers, duplicate High Morale/Found Fire/Calm before the Storm behavior, and all queued-effect duration/check/loss branches. Product exceptions for shared unlocked slots, stable over-capacity choices, local navigation, fixed persistent eligibility, exact Confirmation and immutable history remain in force.

## Completion boundary

This ticket produces the migration plan only. Implementation, deployment and production changes are separate work. Detailed History Rewrite and exception/receipt presentation remain outside the map's destination; required data, semantic operations and outcome coverage are included. No new domain terms or ADR are needed. Existing local AGENTS.md and CONTEXT.md edits remain untouched.
