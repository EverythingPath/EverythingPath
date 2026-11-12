# Canonical Weekly Draft contract

Issue #61 implements checkpoint 2 of #57 in isolation. `src/lib/weekly-draft.ts`
exposes creation and pure semantic edits; `weekly-draft-contract.ts` exports the
shared Zod validators and inferred types. Browser and server adapters can use the
same contract. No production consumer, Convex schema, storage, or calculation has
changed. Existing scenarios remain in place.

`createWeeklyDraft` requires caller-provided domain identities and actual
week-start facts. It starts revision zero with empty choices, without executing
Upkeep or guessing missing historical context. Week-start facts are cloned and
recursively frozen, including fixed Persistent Phase Eligibility. Absence is an
omitted optional value, empty slot is `null`, and zero is a real numeric value.
Ordinary numerical inputs are nonnegative integers; modifiers and adjustments may
be signed. Money is expressed in integer copper; rule ranges and eligibility are projection
advisories, while invalid numbers, unknown variants and duplicate identities are
structural failures.

`editWeeklyDraft` returns a new draft or a structural error. One accepted operation
increments revision once; failure leaves the source intact. Stage requires an
empty slot. Replace requires the current choice identity and fresh complete
contents; it never merges old details. Detail requires the same action and choice
identity and carries its complete typed contents (omitting a detail clears it).
Move requires an empty destination; swap checks both identities. Both move entire
choices atomically. Clear removes a complete choice. Slot identities and occupied
extra slots survive every edit; `add_slot` permits explicit extra positions.
`remove_slot` (#159) removes one empty slot by its stable identity; the reducer
checks only identity and emptiness. Both persistence authorities additionally
require, against the latest accepted draft and the current militia source,
that the slot's position lies beyond the rules-derived allowance
(`slotRemovalRejection`), and refuse while Upkeep or an earlier officer change
is unsettled. It targets `['slot', slotId]`, so a concurrent fill conflicts.

Callers must allocate fresh draft, slot, choice and event identities and never
reuse retired identities. Reference strings denote domain identities, not Convex
IDs. The contract checks its own local identity ownership and event ancestry;
campaign membership and external entity existence belong to the later persistence
adapter. It does not implement transport deduplication, stale revision arbitration,
closed-draft rejection or Weekly Confirmation.

Action variants own their teams, typed details, raw dice and modifier provenance.
Event arrays are ordered forests: parents precede children, and Roll Twice,
and replacement relationships retain independent occurrence identities. Candidate
trees and selection belong to Guarantee Event / Manipulate Events choices, so
replacement removes their entire dependent input tree.
Event-phase Sabotage is attached to its occurrence. Persistent decisions distinguish
unattempted mitigation, incomplete attempted mitigation, buyoff and narrative
ending. Decisions for new events live on their occurrence, including action-owned
candidates, so clearing an action also clears its dependent event decisions.
Carried-event decisions reference the immutable week-start events. Order context retains exact days and prior receipt; staged receipts cannot
be duplicated. Newly placed orders own same-week receipt facts inside their action
choice, including one-day expedited orders. Upkeep facts, operating settlement, consumables, acknowledgements,
reasoned Rules Exceptions and ordered typed Table Adjustments are domain inputs.
Rules Exceptions record permission and never mutate other inputs or arithmetic.
Future projection decides whether a reason permits a particular extra choice and
whether all required facts are present.

The accepted #36 and #56 decisions **supersede AGENTS.md's older first-claim locking
and per-slot confirmation clauses** for this canonical contract. Slots are empty
or staged and jointly editable; Weekly Confirmation remains a whole-week operation.
No claim ownership, lock, timeout or confirmed-choice state exists here. Local
Phase View, input text, pending transport, readiness and preview are excluded.

The pure contract tests cover this checkpoint. Rules-catalog mappings deliberately
retain gaps for derived readiness, real persistence and Confirmation; passing these
tests is not evidence of cutover readiness or complete rules coverage.

## Isolated storage (#62)

`convex/lib/canonicalDraftStorage.ts` provides transaction-scoped storage functions
for later adapters. None are registered Convex functions, imported by a registered
endpoint, or called by the browser. The three additive `canonical*` tables have no
required-field changes to legacy tables. Existing releases continue using legacy
storage; there are no dual writes, activation flag, migration, or campaign backfill.

The Convex document and argument validators derive from the shared Zod contract
using `zodOutputToConvex`. `weeklyDraftDataSchema` removes only the runtime freezing
transform: it retains defaults and every structural refinement. Every storage write
parses through Zod because Convex's generated validators cannot express numerical
bounds or cross-field refinements. Reads return the usual frozen week context.

Storage enforces authenticated organization membership, campaign/militia ownership,
unique draft identity, one open draft per campaign, immutable week context, and
compare-and-save revisions. Operation receipts retain the original semantic edit,
base revision and accepted revision; replaying the same operation returns that
revision without another write. Reusing its ID for different input fails. Accepted
operations and target revision metadata are committed together. The later adapter
must derive conflict targets, arbitrate stale edits and produce the next draft;
this primitive is not that adapter. A closed draft retains only its identity,
revision and conflict metadata, never another editable copy of confirmed source.

`canonical-resolution-record.ts` defines the complete-source record envelope:
confirmed draft, provenance, ruleset version, baseline/final plans, adjudication,
warnings, outcome, successor context and supersession. Adjudication must agree
with the source. Plans/outcomes are versioned JSON artifacts at this preparation
checkpoint; checkpoint 5 must narrow them to the actual projection/change-plan
contract before activation. Storage neither computes nor claims to validate a
rules result. It does not translate the incomplete legacy resolution plans.

Records are append-only through this interface. Confirmation-source storage must
match the exact open revision and closes its identity atomically. Corrections
require GM membership and must supersede the current effective record of the same
campaign/week, retaining its draft identity. A transactional sequence selects the
effective record without timestamps or unbounded history scans; originals remain
queryable by identity. These functions do not implement a History Rewrite editor
or apply authoritative effects. Later Confirmation orchestration must apply the
verified plan, append the record and create the successor in one transaction.

`canonicalDraftStorage.integration.test.ts` exercises the storage boundary using
`convex-test` without mocked authorization or a hand-built database. It proves
restartable initial creation, competing creation, operation deduplication,
structural validation, ownership/reference rejection, exact source matching,
append-only supersession, closed-identity rejection and caller-transaction rollback.
The rule catalog keeps gaps for transport ordering, real adapters, full Confirmation,
and historical presentation. Canonical entity-to-campaign reference mapping depends
on the richer model in #63; storage validates its own campaign, militia, draft and
record references and does not manufacture missing entity facts.

Verification for #62: `pnpm -s typecheck`, `pnpm -s lint`, the Convex-specific
TypeScript check, `pnpm -s test:build` (3 checks), and `pnpm -s rules:check`
(50 files / 373 tests) pass. The catalog reports 10 covered cases, 473 explicit
gaps and zero errors; this is extraction evidence, not cutover readiness.
The required browser journeys passed against the dedicated local preview
`e2e-local-andreasununger-slot-0`. Both review axes completed without remaining
blockers after the reconstructed-source identity fix.

## Isolated roster prerequisites (#63)

`canonical-roster.ts` defines individual teams, roster people and officer
assignments. Team identity is separate from team type; repeated types retain
independent names, conditions, reward-cap exemptions, notes and manager references.
People reference existing character records, retaining a mirror of the record's
kind and a nullable Hit Dice override. Since #196 a blank override means the rules
use the record's level, and manager limits follow held officer roles, not the kind.
Since #180 the mirror is kept in step atomically: every character write, Setup
initialization and Militia correction resolves each person's kind from the
campaign's current record (`withCurrentRecordKinds` in
`convex/lib/canonicalCharacters.ts`), storing `pc` or `npc`. Since #198 records,
rosters and history store only `pc` or `npc`; only the write arguments still
accept a pre-#180 client's legacy labels (B3). Where a stored mirror disagreed
with its record, the record wins on its next write, and PC-only rules then read
the corrected kind. Weekly Confirmation commits its resolved outcome unchanged,
and immutable records keep whatever kinds they were confirmed with.
Officer assignments are a collection of role/character pairs; removing or moving
an assignment never deletes its character. Multiple holders are retained for later
Rules Projection, which still owns non-stacking and Commandant training arithmetic.

`convex/lib/canonicalRoster.ts` supplies authenticated, campaign-scoped read/save
operations over additive `canonicalRoster` storage. Saves validate all character
and manager references and compare the exact reviewed revision in one transaction.
Manager/cap/archived-assignment warnings do not block structurally valid saves.
The roster has explicit technical size bounds above normal militia allowances.
These functions are unregistered and have no live caller, matching #62's isolation
boundary; they neither mirror nor write legacy teams, officers, or characters.

`CanonicalRosterEditor` is the shared prepared ledger/setup interface. It retains
team identities through edits, uses card selections for roles/types/managers,
validates text with react-hook-form/Zod, and distinguishes unknown Hit Dice from
malformed input. Its save callback carries the revision whose values were loaded;
newer incoming values cannot silently rebase an unsaved edit. Explicit reload
lets a player recover after a conflict. The later canonical browser adapter must
supply subscribed snapshots, the existing campaign character ledger, and the
transactional save, when that path is enabled at cutover. No live route or endpoint
is enabled by this preparation step.

`prepareLegacyRoster` is a read-only preflight mapping. Existing holders become
singleton assignments and source team rows receive deterministic namespaced
identities, so repeated preparation produces the same identities. Per-team
condition, exemption and manager facts must be supplied explicitly. Existing
linked managers must be preserved; freeform managers must first be linked to a
character record. Missing Commandant Hit Dice remain an explicit preflight issue.
The mapper does not change balances, advance weeks, run rules, or write data.

Named pure, presentation and transactional tests cover these prerequisites. The
catalog adds preparation cases while retaining all projection and cutover gaps.
Canonical real-subscription wiring and weekly outcome calculations remain with
the later adapters and Rules Projection extractions in #57.

Verification for #63: typecheck, lint, the Convex-specific TypeScript check,
three build-boundary checks, and all 54 test files / 384 tests pass. The rules
catalog reports 15 covered cases, 473 explicit gaps and zero errors. The complete
supported-path browser gate passed authentication and all five journeys on their
first attempts against `e2e-local-andreasununger-slot-0`, including the two-player
transport journey. The isolated preview deployment, production build and generated
binding comparison also passed. Both review axes have zero remaining findings.
These results establish roster preparation and supported-path compatibility, not
canonical live subscription behavior or cutover readiness.
