# Weekly Draft rules coverage

`coverage-catalog.ts` is the canonical executable coverage inventory for #59.
It preserves the 95 rows from all three #54 audit comments and expands compound
behavior into independently identified cases, including advancement rows and event
interval endpoints. `audit-inventory.json` retains the original baseline,
implementation evidence, remaining permutations and source comment URL. Existing
legacy tests are leads for migration, **not verified replacement coverage**.

Run `pnpm -s rules:check` to collect the full Vitest suite and write
`coverage/rules-report.md` plus `coverage/rules-tests.json`. It uses a fresh temporary
results file every run, so old passing output cannot cover a failed collection.
The GitHub workflow runs this gate and uploads both artifacts. No deployment,
credentials or live campaign writes are involved.

Run `pnpm -s rules:complete` for the final strict gate. It intentionally fails today:
human corpus review, two interpretation decisions, and the separately scoped
cutover/recovery rehearsal remain explicit gaps. Shared fixture parity, adapter
contracts and browser evidence are required independently. Passing the extraction gate does not mean rules completeness
or cutover approval. This ticket does not extract or activate application behavior.

## Acceptance evidence (#88)

Run the nightly suite of the isolated browser harness (`--suite nightly`, as
documented in `e2e/README.md`), then
run `pnpm -s acceptance:check --browser-report /absolute/path/to/report.json`.
Use the safe report path printed by that **new** E2E run. The acceptance command
performs typecheck, lint, build-boundary tests and the full Vitest collection plus
strict rules check. It records every command result in `coverage/acceptance.json`,
including failures, and returns nonzero until all gates pass.

The catalog's `serviceTests` references require a complete browser run whose
recorded scope includes every journey of the tag's file: `live.workspace`
(`canonical-workspace.spec.ts`, whose journeys span the mandatory suite and
five focused groups since #752), `live.persistence` and `live.confirmation`
(the live suite's contracts). A nightly run includes them all. No run supplies
`live.cutover` since #752 deleted `canonical-cutover` (owner decision D-1);
its three cases (E06.preserve, P11.cutover, P11.legacy) rest on their Convex
`setup.import`, `retirement.preserve` and `retirement.reject` evidence. Local memory and Convex-test results cannot substitute for this
evidence. Missing service evidence
is an explicit gap in the extraction report; failed, skipped, retry-only, incomplete,
or stale supplied reports are errors. The safe E2E report fingerprints working
application/test/configuration sources, dependency files and normative corpus and
decision snapshots. A code, test or rules change requires a new E2E run. Explanatory
Markdown reports are excluded so evidence can be recorded after verification.

`coverage/rules-report.md` includes a source-by-source human review index,
fingerprints, mapped behavior cases, named tests and unresolved gaps.
`coverage/rules-evidence.json` retains the machine-readable result. The user
confirmed that human review has not occurred; no automated result clears that
requirement. This report prepares review and must not be described as cutover
readiness while any human, rules, parity or rehearsal gap remains.

## Adding evidence

1. Find the case and source section. Read its audit `remainingCases` as well as the
   complete source; a compact case may need several input permutations. Accepted
   #56 policies override conflicting audit observations or ambiguous wording.
2. Add a behavior test at an agreed #53 interface. Put its stable ID in the actual
   test name, for example `test('[rules.A06.failure] failed dismissal removes the
   team and adds rolled Notoriety', ...)`. Each ID must identify exactly one
   collected assertion. For parameterized tests, use distinct IDs for individual
   rows or use a single named test that asserts the entire case matrix.
3. Copy the ID from `plannedTests` to `tests` only when it is real evidence. Multiple
   test IDs can be required by one case. Passing all referenced tests establishes
   evidence; missing, failed, skipped, pending, todo, duplicate IDs or failed suites
   do not. An explicit gap never excuses a broken mapped test.
4. Clear `gap` only after all named case permutations are covered. Partial passing
   evidence can coexist with an explicit gap and cannot pass strict completeness.
   Keep IDs stable when moving files, changing titles or adding cases; do not reuse
   or renumber an ID. Add new cases/rules for newly identified corpus behavior.
   Register new IDs in `case-inventory.json`; its independently fingerprinted list
   prevents removing a case from the catalog unnoticed. Removing or superseding
   an inventoried case requires an explicit reviewed inventory update.
5. Run the gate and review its report. Do not delete a mapping to hide a regression.
   Browser/Convex parity must use actual entry paths; the `GATE` cases remain open
   until the required infrastructure and outcome assertions exist.

## Source review and completeness

Fingerprints are SHA-256 over LF-normalized text, trimmed and followed by one
newline. A section starts at its exact Markdown heading and ends at the next
heading of any level. Source IDs are stable initial line-based identifiers, not
current line numbers. Inserting lines does not rename them. Duplicate or removed
headings are errors. Repeated names such as Treasury use `parentHeading` to
distinguish terminology from the team tree. Added headings must be registered and mapped or receive an
explicit review gap. Unmapped introductory sections are deliberately listed as
review gaps until a human classifies them; no part of the corpus is silently ignored.

Decision snapshots #53/#55/#56/#57 and the annotated audit snapshot have whole-file
fingerprints. Their URLs remain the normative upstream references. These local
snapshots make the gate deterministic; it does not poll GitHub for later decisions.
Bring accepted decision updates into the snapshots and review affected cases.

When text changes, inspect the affected outcomes and edge cases before updating
its stored fingerprint. The exported `fingerprint` function calculates a digest;
there is intentionally no blanket accept/update command. Fingerprints prove
traceability, not that the expected behavior is correct. Inventory growth beyond
#54 and semantic review of **all** rules and tables remain necessary. Record the
reviewer and review reference in `corpusReview` before clearing its gap. All source
review gaps and case gaps must also be resolved for the strict gate.

## Implementation checkpoints

Checkpoint prefixes refer to the accepted sequence in #55, preserved in
`decision-55.md`:

| Checkpoint | Required implementation outcome |
|---|---|
| 3-test-infrastructure | Browser/Convex parity fixtures and isolated two-player gate |
| 4-foundations | Rank, training, check composition, capacity and boon calculations |
| 4-officers | Officer and manager effects with ordered assignments |
| 4-teams | Team identities, trees, conditions and temporal eligibility |
| 4-upkeep | First-use metadata and ordered losses, progression, transfers |
| 4-activity | All 24 actions and their required inputs/outcomes |
| 4-events | Event trigger/table, independent occurrences and modifiers |
| 4-persistence | Persistent effects, weekly mitigation and buyoff cadence |
| 5-resolution | Complete preview/change plan, readiness and table decisions |
| 6-adapters | Shared persistence contracts, authority and exact Confirmation |
| 7-workspace | Phase Views, fixed eligibility and immediate local navigation |
| 8-cutover-rehearsal | Preservation/reset, restartability, legacy rejection and recovery |

All rule cases ultimately need Phase View/Resolution Preview evidence and applicable
Confirmation parity; the checkpoint is where their behavior is implemented, not an
exemption from later gates. Canonical contracts in step 2 prepare these facts; step 9
activation remains contingent on complete review and a separately approved cutover.

## Upkeep extraction (#67)

`projectUpkeep(draft, snapshot)` is the shared pure Upkeep projection. Supply the
same week-start militia snapshot on each edit. It returns the ordered baseline
plan, partial post-Upkeep outcome, check explanations, boon packages, warnings and
missing requirements. Preview never mutates either input. `ready` describes
Upkeep only; it cannot authorize whole-week Confirmation. Table Adjustments apply
after the complete weekly baseline in the later resolution composition.

The canonical Upkeep roll keys are `check` (attrition Loyalty), `training`
(attrition loss/gain), `notoriety` (maximum-Notoriety training loss), and `loss`
(treasury-shortage loss). `notorietyCheck` is the independent DC15 Loyalty check;
`nearestSettlementId` is required when that check fails. Dice count and sides must
match the selected branch; totals do not encode natural-roll provenance. Unused
rolls never produce effects. `upkeep_loss_multiplier` is an explicit dated queued
effect; repeated Week of Pain multipliers do not compound and never multiply a
gain. Carried Low Morale supplies its ongoing Loyalty penalty even without a
queue, and a matching queued penalty is applied only once. The campaign-context
editor supports entering the loss multiplier.

For organization checks, calculated modifier source IDs are provenance rather
than second additions.
`bonus:<identity>` selects a one-use bonus; consumed IDs and changes carry forward
into later phases. Other entered modifiers carry their own source and reason.
Recovery uses the current minimum treasury; a differing entered cost is flagged
and leaves the baseline intact for later Table Adjustment. Reasoned exceptions
for `upkeep-recovery-funds` use the team identity as their subject. A boon acknowledgement uses `upkeep:boon:<rank>:<characterId>` and records
the table's actual reward handling; the projection does not modify character
sheets. Missing-team return changes have `timing: end`; the post-Upkeep roster
keeps those teams missing so they cannot act early. Missing-team return checks
exclude manager bonuses, which apply only to militia actions.

Transfers check available funds in their staged order. Since Ruleset Version 6
(#158) they carry no character and need no officer: the approved departure from
the corpus's officer-only Step 5 sentence is noted beside that sentence. A
withdrawal exceeding the running treasury retains its projected outcome and
warning, but requires a reasoned `upkeep-transfer-funds` exception with the
transfer identity as the subject before Upkeep is ready. Each overdraft needs its
own exception; later deposits do not excuse earlier overdrafts.

`upkeepProjection.integration.test.ts` builds the browser entry as JavaScript,
executes that bundle in an isolated VM, and compares its complete outcomes with
projection from actual Convex-test draft storage. It checks fixed literal outcomes
as well as equality and verifies that preview leaves the draft untouched. This is
pure browser-build/storage parity, not an authenticated canonical Workspace
journey. The existing five-journey browser harness remains the supported-path
extraction gate. No canonical endpoint, live route, legacy-write replacement or
campaign cutover is activated by this extraction.

## Gap reconciliation (#88)

The acceptance fixtures are shared with `convex/rulesAcceptance.integration.test.ts`.
It builds the actual Workspace projection/Phase View modules for the browser,
compares all five Phase Views with stored Convex sources, confirms each ready week
through authenticated mutations with a competing attempt, and checks complete
snapshot, record, baseline, final plan and successor context equality. The matrix
covers all rank/focus rows, all upgrade edges, substantive officer/boon cases,
event base/duplicate outcomes, recovery, and a compound multi-ledger week.
The deployed Confirmation contract reuses the compound fixture and its independently
authored expected state. Full rules permutations remain in pure tests as #57 requires.

Notoriety baseline changes in this pass use canonical ruleset version 3. Explicit
Table Adjustments still apply after the baseline; successful Covert Action suppresses
its covered gain even at the cap. Source review and semantic interpretation gaps
remain pending human review. Cutover gaps belong to #89 and do not authorize #90.
