# Legacy compatibility inventory (#148)

This inventory lists code that exists only to read, validate, display, repair
or migrate data shapes older than the current writers produce. It is a removal
plan, not a removal: every path below is reviewed, tested and gated, so each is
retired deliberately in its own change.

Surveyed at `72f94c3` on `implement/148-ui-rework`, 2026-09-28, and revised at
`76a7b23` after #180 (record-owned PC/NPC kinds, Setup envelope version 2)
merged. Each file, function and test ID cited here exists at `76a7b23`.

## Relation to the legacy retirement record

[Legacy retirement](legacy-retirement.md) is the finished record of #91: the
pre-cutover board, tables and migration readers it removed, the backups it
retained and the evidence behind it. That record is closed, so this forward
plan is a separate document. It covers what the canonical application has
since accumulated for its own older shapes. The #91 rejection endpoints that
remain are listed once here (B5) so every removable path is in one place.

## Production facts this plan relies on

A read-only production check on 2026-09-28 found one campaign and one militia
holding:

- one open week-8 Weekly Draft at revision 0 with no Action Slot choices, event
  occurrences, Persistent decisions, Table Adjustments or carried events;
- no Resolution Records (no confirmed week);
- six characters, all stored with `kind: 'pc'`, each with a matching roster
  entry.

The user confirmed there will be no data changes before release. Because the
draft is at revision 0, production also holds no accepted
`canonicalDraftOperation` rows and no `canonicalDraftTarget` rows.

"Safe now" below means safe given these facts. Before removing anything:

1. Re-run the read-only production check. The first Confirmation after release
   creates a Resolution Record, and every later edit creates stored draft and
   operation rows.
2. Check the dev deployment and any preview you intend to keep. A Convex schema
   push validates every stored document, not just production's. Dev held older
   data before #91 and may hold older rolls, kinds or records. The e2e seeding
   mutations in `convex/canonicalPersistenceFixtures.ts` and
   `convex/e2eFixtures.ts` also write some old shapes (noted per entry).

## Rules that apply to every removal

- **Zod schemas are the Convex schema.** `convex/lib/canonicalStorageValidators.ts`
  derives the `canonicalWeeklyDraft`, `canonicalDraftOperation` and
  `canonicalResolutionRecord` validators from `weeklyDraftDataSchema`,
  `weeklyDraftEditSchema` and `canonicalResolutionRecordSchema`.
  `canonicalMilitiaState.snapshot` comes from `militiaSnapshotSchema`
  (`convex/schema.ts`). Narrowing a union in `src/lib/weekly-draft-facts.ts` or
  `src/lib/weekly-draft-contract.ts` therefore narrows stored tables. If any
  stored document could still hold the old shape, use widen-migrate-narrow.
  Otherwise use this order: stop every writer of the shape, re-check stored
  data, then narrow the schema and delete the readers in one deploy.
- **Old browser tabs.** After narrowing, the Convex argument validators reject
  an old bundle that still sends the old shape. The current UI already sends
  none of the shapes in group A.
- **Two generic editors still write almost any schema field.** Several shapes
  described in code as "from an older editor" can still be written today
  through two generic editors built on `StructuredChoiceField`
  (`src/components/weekly-draft-workspace/structured-choice-field.tsx`):
  - **W1: the Event block's "Edit ... details" disclosure.** This is
    `EventOccurrenceEditors` in `event-occurrence-editors.tsx`, rendered for
    every Event block that is not still preparing. It edits the whole
    `eventOccurrenceSchema` except `origin`, `tableRoll` and `eventType`.
    Narrowed 2026-09-29 (#198): an allowlist of current fields
    (`event-occurrence-details.ts`), with no B1 field.
  - **W2: Activity's "Recorded candidate details" disclosure.** This is
    `CANDIDATE_FIELDS` in `activity-details.tsx`. It edits whole candidate
    trees, including each occurrence's `origin`. A fixes batch running in
    parallel with this inventory retires it. That had not landed at
    `76a7b23`: check that `CANDIDATE_FIELDS` is gone before relying on it.

  Entries that depend on retiring or narrowing W1 or W2 are in group B.

- **Rules coverage.** `pnpm -s rules:check` must stay at 0 errors.
  - Only IDs listed in a case's `tests` array in
    `tests/rules/coverage-catalog.ts` are pinned. Deleting or renaming one of
    those tests gives `missing test`, so edit the catalog's `tests`,
    `plannedTests` and, where it describes older data, `expected` in the same
    change.
  - Other `[rules.X]` tags in test titles are labels only.
  - Case IDs are fingerprinted in `tests/rules/case-inventory.json`. Removing a
    case needs a reviewed inventory update; only B5 might need one.
- **Keep corpus notes.** `docs/ai/ironfang-militia/militia-rules.md` records the
  departures made under Ruleset Versions 6, 7, 8 and 9. Those sections are
  fingerprinted, and the notes stay true.
- **Never reuse a Ruleset Version number.** `CANONICAL_WEEKLY_RULESET_VERSION`
  is 9 since #198 (assumed propaganda approval, plus the B1a and B2 edge
  cases) and keeps its number even after
  the named constants for 6 and 7 go. The corpus notes, and
  any records in dev, refer to the older numbers.
- **Ruleset Version bumps.** Several removals delete a resolution branch for
  input that can no longer be expressed (A4, B1, B2). A week whose result
  changes needs a new Ruleset Version by the `GLOSSARY.md` definition. Two
  reachable edge cases did change: B1a (a leftover event-level mitigation or
  check on a Raid or Cache Discovered) and B2 (a replacement under a Roll Twice
  that rerolls in place). Ruleset Version 9 is unreleased and no Resolution
  Record exists in any deployment, so by user decision on 2026-09-29 both were
  folded into Version 9 rather than a Version 10; the corpus notes them under
  Spread Propaganda. No other removal changes a reachable week. Each such change
  should still say so, and its reviewer should confirm it.
- **Keep forward-compatibility tolerance.** Once released weeks are confirmed,
  format-2 records at Ruleset Versions 8 and 9 will accumulate and never
  change. Later Ruleset Versions will need version-aware readers again, like
  `isBlankHitDiceLevel`. `describeRecordedChange`, the `sectionChips` catch and
  generic fact text therefore stay (see C7).

## Summary

| ID    | Path                                                                             | Ticket(s)        | Group  | Rough size (source / tests)      |
| ----- | -------------------------------------------------------------------------------- | ---------------- | ------ | -------------------------------- |
| A1    | Dead leftovers (legacy officers map, old action cap, context preparation schema) | #64, #66, #91    | A      | ~230 / ~80                       |
| A2    | Legacy dice arrays beside dice totals                                            | #154, #155       | A      | ~130 / ~1,300 plus fixture churn |
| A3    | Actor-bearing treasury transfers                                                 | #158             | A      | ~45 / ~400                       |
| A4    | Legacy Upkeep Remove decisions                                                   | #156             | A      | ~90 / ~150                       |
| A5    | Older Resolution Record formats and missing source snapshots                     | #194, #185, #197 | A      | ~190 / ~650                      |
| A6    | Pre-Version-8 blank Hit Dice ("Hit Dice not recorded")                           | #196, #185       | A      | ~20 / ~40                        |
| A7    | Named Ruleset Version constants 6 and 7, pre-v8 record tests                     | #158, #191, #196 | A      | ~15 / ~200                       |
| A8    | Off-list rank-boon feat text                                                     | #157             | A      | ~25 / ~20                        |
| A9    | Legacy and absent character kinds in stored data                                 | #179, #180       | A      | ~40 / ~600                       |
| A10   | Setup envelope version 1 migration                                               | #173, #180       | A      | ~35 / ~250                       |
| B1    | Older Event and check-decision fields                                            | #164–#168        | B (W1) | ~260 / ~500 plus fixtures        |
| B2    | Candidate Roll Twice expansions and replacement-child rerolls                    | #191, #163       | B (W2) | ~70 / ~250                       |
| B3    | Old-client kind submissions                                                      | #180             | B      | ~15 / ~100                       |
| B4    | Pre-canonical character fields and `dataMigration` table                         | #16, #17         | B      | ~30 / —                          |
| B5    | #91 rejection endpoint names                                                     | #91              | B      | ~290 / ~30                       |
| B6    | Planned Character Sheet release cleanup                                         | #240             | B      | not yet sized                    |
| C1–C7 | Look-alikes and deliberate compatibility                                         | various          | C      | —                                |

Sizes are rough, from reading the code, not from a trial removal. Test figures
count whole tests or fixtures that would go or be rewritten.

The biggest wins are A2 (dice arrays: a schema union, branches in about ten
readers, and the largest block of compatibility tests plus one e2e scenario),
A5 (the loose-format record readers) and B1 (the nested Event fallbacks, once
W1 is gone).

---

## A. Safe to remove now

### A1. Dead compatibility leftovers

Removed 2026-09-29 (#198). The optional opaque-target branch of `ancestors` stays.

- **Old shape:** none stored. These are helpers left behind by removed writers.
  - `mapLegacyOfficers` mapped the pre-canonical single-holder officer fields.
  - `getMaxActionsForRank` and `getMaxActionsForMilitia` served "Legacy
    compatibility until its truncating writer is retired (#66)", and that
    writer is gone.
  - The campaign-context preparation document (#64) fed the migration preflight
    that #91 deleted, together with its storage and editors.
- **Where:**
  - `src/lib/canonical-roster.ts`: `mapLegacyOfficers`. Only
    `src/lib/canonical-roster.test.ts` calls it.
  - `src/lib/militia-progression-rules.ts`: `getMaxActionsForRank` and
    `getMaxActionsForMilitia`. Nothing calls them.
  - `src/lib/canonical-campaign-context.ts`: `campaignContextDataSchema`,
    `campaignContextSchema`, `emptyCampaignContext`, `campaignContextWarnings`,
    `contextEventSchema`, `contextOrderSchema` (its `receiptStatus: 'unknown'`
    is "unknown legacy delivery") and `contextCacheSchema`.
    - Keep `contextSettlementSchema` and `contextBonusSchema`, which
      `src/lib/canonical-weekly-source.ts` uses.
    - Replace the `CampaignContext` type used in `src/lib/rules-foundations.ts`
      and `src/lib/rules-settlements.ts` with the inferred settlement, bonus and
      queued-effect types.
  - Optional: in `convex/lib/canonicalDraftTargets.ts`, the opaque-target branch
    of `ancestors` ("A legacy opaque target has no parent paths"). Production
    edits send JSON paths, and only `convex/canonicalDraftStorage.integration.test.ts`
    and `convex/persistentEventProjection.integration.test.ts` send flat
    targets such as `'slot:left'`.
- **Tests and tags:**
  - `src/lib/canonical-roster.test.ts`: the `mapLegacyOfficers` assertion.
  - `src/lib/canonical-campaign-context.test.ts`, 73 lines. Its
    `[context.absence]` is pinned by cases `F09.context-money` and
    `U01.context-first-use`, and `[context.delivery]` by `A21.context-orders`.
    Retarget those catalog entries to the `setup.*` and `ledger.*` tests
    already listed beside them.
    Otherwise `rules:check` reports them missing.
- **Order:** none.
- **Risk:** none for data. This is catalog work only.
- **Size:** about 230 source lines and 80 test lines.

### A2. Legacy dice arrays beside dice totals (#154, #155)

**Removed 2026-09-29 (#198).** `rawRollSchema` accepts only totals; the
per-die readers and array-only tests are gone, and the range advisory and
wrong-specification note stay for totals.

- **Old shape:** a `RawRoll` with individual `dice: number[]`. #154 taught
  readers the `{ diceTotal, diceCount }` form. #155 made every editor write
  totals (`totalRoll` in `roll-facts.ts`), so no page writes an array now.
- **Where:**
  - Schema: the first member of the `rawRollSchema` union in
    `src/lib/weekly-draft-facts.ts`. It reaches every stored roll: upkeep,
    activity, event, persistent, draft edits and records.
  - Normalizer: `normalizeRawRoll` and `rollRangeWarning` in
    `src/lib/raw-roll.ts`, which include the `'legacy-die'` range warning.
  - View facts (`src/components/weekly-draft-workspace/`):
    - `roll-facts.ts`: `LegacyRawRoll`, `isLegacyRoll`, `recordedDiceCount`,
      the array branches of `recordedRollExplanation` and `rangeAdvisory`, and
      `legacyDiceSlots`.
    - `legacyDiceSlots` feeds `RollFact.dice` (`types.ts`) through
      `phase-view.ts`, and no view reads that field.
  - Readers and editors:
    - `structured-choice-field.tsx`: the legacy member found by `rollUnion`,
      `isRawRollValue` and the "Recorded dice" read-only branch of `RollFields`.
    - `roll-total-field.tsx`: its comment about partial legacy dice.
    - `upkeep-warnings.ts`: the per-die wording of `rangeMessage`.
    - `persistent-check-facts.ts`: `rollText`.
    - `src/components/week-review/review-text.ts`: the `rollText` array
      branch.
- **Writers of the old shape still in the tree, to convert first:**
  - The test helper `roll(sides, ...dice)` in `tests/rules/upkeep-fixture.ts`.
    About 540 `roll(` calls in about 75 test files build rolls with it.
    Emitting `{ diceTotal: sum, diceCount: dice.length }` keeps them valid.
  - Dice-array literals in about 30 test and fixture files, including
    `src/components/weekly-draft-workspace/workspace-test-fixture.ts`,
    `tests/persistence/contracts.ts` and
    `tests/persistence/confirmation-contracts.ts`.
  - The deployed e2e seeding mutation in
    `convex/canonicalPersistenceFixtures.ts` (three literals).
  - `e2e/canonical-confirmation.spec.ts`.
- **Tests and tags:**
  - Delete the array-only cases in these files:
    - `src/lib/raw-roll.test.ts`
    - `src/lib/rules-roll-compatibility.test.ts` (the legacy outlier and
      mixed-form cases)
    - `src/lib/weekly-draft-roll-schema.test.ts`
    - in `src/components/weekly-draft-workspace/`:
      `upkeep-roll-compatibility.test.tsx` (`WEEK-15.upkeep-partial`,
      `upkeep-legacy-equivalence`), `activity-roll-compatibility.test.tsx`
      (`ACT-13.legacy-check`, `ACT-12.modifier-only-legacy`, `ACT-12.partial`),
      `nested-roll-compatibility.test.tsx` (`EVT-07.legacy-nested`,
      `EVT-11.invalid-explicit-clear`) and `roll-total-field.test.tsx`
      (`WEEK-15.total-incomplete`)
    - `src/components/historical-week/record-roll-compatibility.test.tsx`
      (`HIST-05.old-source`)
  - The total-form cases in those files test current behavior and stay.
  - Convex tests: "mixed roll forms…" in
    `convex/canonicalDraftPersistence.integration.test.ts`, "storage retains
    mixed…" in `convex/canonicalDraftStorage.integration.test.ts` and "mixed
    confirmed history…" in `convex/canonicalHistory.integration.test.ts`.
  - Browser: `exerciseRollCompatibility` in `e2e/support/roll-compatibility.ts`,
    called from `e2e/canonical-workspace.spec.ts`. It re-enters "legacy dice"
    after reading totals. A comment there still says no page writes totals,
    which has been untrue since #155. `connectAs` in the same file is shared with
    `e2e/support/team-conditions.ts` and must stay.
  - None of the array-only test IDs is catalog-pinned. Pinned tests that merely
    build arrays through `roll()` stay valid once the helper emits totals,
    including `rules.U02.dice-boundaries`. Re-run `rules:check`: per-die
    `'legacy-die'` warnings become whole-range `'total'` warnings, which could
    move a range assertion.
- **Order:** convert the helper and fixtures, then check dev and previews for
  stored arrays. Then narrow `rawRollSchema` and delete the readers in one
  deploy.
- **Risk and preconditions:** production has no rolls, so this is safe now. Dev
  and e2e preview data seeded by `canonicalPersistenceFixtures` may hold
  arrays. Clear it, or migrate it to totals, before the schema push.
- **Size:** about 130 source lines across about 12 files. About 1,300 test lines
  go or are rewritten, including the 348-line e2e helper and its unit test. The
  literal fixtures churn as well.

### A3. Actor-bearing treasury transfers (#158)

Removed 2026-09-29 (#198), including the always-null `characterId` on treasury plan entries.

- **Old shape:** a transfer with a `characterId`, from before Ruleset Version 6
  made transfers characterless. It also covers the officer named in older
  treasury plan entries, and recorded `upkeep-transfer-officer` exceptions,
  which no code creates or requires any more.
- **Where:**
  - `src/lib/weekly-draft-contract.ts`: `characterId: id.optional()` on
    `treasuryTransfers` in `upkeepSchema`. The `upkeep_transfer` edit reuses it.
  - `src/lib/weekly-draft-consistency.ts`: `hasNewTransferCharacterOutsideCampaign`
    and its call in `acceptDraftOperation`.
  - In `src/components/weekly-draft-workspace/`: `legacyCharacterName` in
    `upkeep-sections.ts`, `types.ts` and `staged-transfer.tsx`.
  - `src/components/historical-week/record-review.ts`: `findTransferActor` and
    the actor suffix in `transferItems`.
  - Optional: the always-null `characterId` on the `treasury` entry of
    `UpkeepChange` and in `treasury()`, both in `src/lib/rules-upkeep.ts`.
    Dropping it changes the plan shape new records store, which is harmless
    before the first record. Expected plans in tests change with it.
- **Writers:** none. `upkeep-transfer-edits.ts` sends
  `{ transferId, direction, copper }`.
- **Tests and tags:**
  - Catalog case `U05.order` pins `rules.U05.transfer-schema`,
    `rules.U05.legacy-actor`, `rules.U05.old-record`, `rules.U05.actor-scope`
    and `rules.U05.ruleset-version` in `src/lib/characterless-transfers.test.ts`,
    and `rules.U05.persistence` in
    `convex/characterlessTransfers.integration.test.ts`.
  - Delete the actor-specific ones and drop them from the case, or rewrite
    them to actorless only. Keep `rules.U05.characterless`, `U05.order`,
    `U05.overdraft` and `U05.officer-exception`.
  - Also affected:
    - `src/components/weekly-draft-workspace/upkeep-transfer-sections.test.ts`:
      "a legacy row keeps its recorded name" in `UPK-10.rows`.
    - `src/components/historical-week/record-roll-compatibility.test.tsx`:
      `HIST-05.old-source`.
    - The transfer actor in `tests/history/resolution-record-fixtures.ts`.
- **Order:** the schema narrows `canonicalWeeklyDraft`, operations and records
  together. Production holds no transfers.
- **Risk:** low. Behavior is unchanged, because the actor was already
  metadata only.
- **Size:** about 45 source lines and about 400 test lines.

### A4. Legacy Upkeep Remove decisions (#156)

Removed 2026-09-29 (#198).

- **Old shape:** an Upkeep team decision `'remove'` with an
  `upkeep-team-removal` Rules Exception. Since #156 removing a team is a Militia
  Correction, and Upkeep offers only Recover or Leave disabled.
- **Where:**
  - Schema: `'remove'` in the `teamDecisions` enum in
    `src/lib/weekly-draft-contract.ts`.
  - Engine: `removeWithException` and its call in `src/lib/rules-upkeep.ts`,
    with the `upkeep-removal` warning and `removal-exception` requirement.
    `removeTeam` stays, because the missing-team natural-1 loss uses it.
  - UI (`src/components/weekly-draft-workspace/`):
    - `legacyRemoval` in `upkeep-sections.ts`
    - `UpkeepLegacyRemoval` and the `legacyRemoval` fields in `types.ts`
    - `LegacyRemoval` in `upkeep-teams.tsx`
    - the `removal` parameter of `clearTeamDecision` in `upkeep-edits.ts`
    - `'removal-exception'` in `summary-messages.ts`
    - `:upkeep-removal` in `upkeep-warnings.ts`
- **Writers:** none in the UI. `e2e/support/team-conditions.ts`
  (`exerciseTeamConditionRows`) sends a `'remove'` decision through the
  transport on purpose, to show the repair row.
- **Tests and tags:**
  - `[rules.U04.recovery-inputs]` in `src/lib/rules-upkeep.test.ts` is pinned
    twice in the catalog. Keep the ID and delete its Remove half.
  - In `src/components/weekly-draft-workspace/`:
    - `upkeep-view.test.tsx`: "a retained Remove choice is cleared with its
      ruling…"
    - `upkeep-sections.test.ts`: "a retained Remove choice from an older page…"
    - the Remove fixtures in `phase-readiness.test.ts`
  - The Remove step in the e2e helper above.
- **Order:** the schema narrows drafts and operations. There is no record
  impact.
- **Risk:** low. The engine loses a branch only unreachable input could use
  (see the Ruleset Version rule above).
- **Size:** about 90 source lines and about 150 test lines.

### A5. Older Resolution Record formats and missing source snapshots (#194, #185, #197)

Removed 2026-09-29 (#198): format 2 and the source snapshot are required; `historicalMessages` went with B1d.

- **Old shape:** records written before canonical Weekly Resolution (#78) made
  every record format 2 with `sourceMilitiaSnapshot`. Those older records hold:
  - loose extraction facts under `formatVersion` 1, which may be keyed by
    phase, put the militia under `outcome` or record flat militia values;
  - no source snapshot;
  - written warning messages in place of codes;
  - no Activity plan.

  Confirmation has written only format 2 with a snapshot since #78, and
  production has no records at all.

- **Where:**
  - Schema: `src/lib/canonical-resolution-record.ts`.
    - `sourceMilitiaSnapshot` is `.optional()`; it could be required.
    - `resolutionArtifactSchema.formatVersion` is `int.min(1)`; it could be
      `z.literal(2)`. Typed plan schemas would be an optional further step.
  - `src/components/historical-week/record-artifacts.ts`:
    - the format test in `parseTypedPlan`, and `looseState`, `looseFinal` and
      the loose branches of `finalState` and `readRecordedWeek`;
    - the `baselinePlan.before` fallback for a missing snapshot.
  - `src/components/historical-week/record-review.ts`:
    - the no-Activity-plan fallback in `guaranteedChoices`;
    - the written-message branch of `findWarningCode` and `placeWarnings`;
    - `notRecordedText` and the `incomplete` status in `sectionStatus`;
    - `historicalMessages` (the old buyoff warning, see B1d).
  - `src/components/week-review/review-comparison.ts`: `recordedFacts`, the
    `recorded` part of `ComparedState`, and the "Not recorded" cells a complete
    format-2 record never needs. Keep `unrecorded` if C7's tolerance keeps
    using it.
  - `src/lib/finished-week-headlines.ts`: the `outcome` and flat-fact branches
    of `readFinalMilitia`, and the plan fallback of `readBeforeMilitia`. These
    feed `projectHeadlineFacts`, which `convex/canonicalHistory.ts` serves
    (#197).
- **Tests and tags:**
  - `tests/history/resolution-record-fixtures.ts`: `legacyRecord` and
    `legacySource`, about 200 of its 283 lines.
  - `src/components/historical-week/record-review.test.ts`:
    `HIST-05.frozen-legacy` and `HIST-05.frozen-rolls`. The rolls test belongs
    with A2.
  - `src/components/historical-week/record-review-view.test.tsx`:
    `HIST-05.frozen-view-legacy`.
  - `src/components/week-review/review-comparison.test.ts`: "a state that did
    not record its militia…".
  - `src/lib/finished-week-headlines.test.ts`: `P86.headline-legacy`.
  - None of these is catalog-pinned. The catalog does pin `rules.P86.display`
    and `rules.P86.labels` (`record-view.test.tsx`), whose record fixture holds
    `formatVersion: 1` loose facts. Rewrite that fixture as a format-2 record,
    for example from `confirmedWeek`, and keep both IDs.
- **Order:** the reader deletions need no schema change. Making the record
  schema stricter validates every stored record, so check dev history first
  (see A7).
- **Risk:** none in production today. The first release Confirmation writes
  format 2 at version 8, which this change keeps reading.
- **Size:** about 190 source lines and about 650 test lines.

### A6. Pre-Version-8 blank Hit Dice: "Hit Dice not recorded" (#196, #185)

Removed 2026-09-29 (#198).

- **Old shape:** a Resolution Record confirmed before Ruleset Version 8, when a
  blank roster Hit Dice override meant unknown rather than the character's
  level.
- **Not legacy:** the nullable `hitDice` override itself (`rosterPersonSchema`
  in `src/lib/canonical-roster.ts`). A blank means "use level" today, and
  `getEffectiveHitDice` reads it. See C3.
- **Where:**
  - `isBlankHitDiceLevel` in `src/lib/ruleset-versions.ts`, and its call in
    `recordWeekReview` (`src/components/historical-week/record-review.ts`).
  - `StateReading.isBlankHitDiceLevel` and the "not recorded" variant in
    `hitDiceText`, in `src/components/week-review/review-comparison.ts`.
- **Tests and tags:** `[rules.HIST-05.record-hit-dice]`
  (`record-review.test.ts`) is pinned in the Commandant case (`O03.success`).
  Rewrite it to assert blank as level, or drop it from the case.
  `HIST-05.record-kinds` (`record-view.test.tsx`, not pinned) asserts "Hit Dice
  not recorded".
- **Order:** none.
- **Risk:** safe once no record older than Version 8 exists, which is true in
  production now.
- **Size:** about 20 source lines and about 40 test lines.

### A7. Named Ruleset Version constants and pre-v8 record tests (#158, #191, #196)

Removed 2026-09-29 (#198); `ROLE_AWARE_OFFICERS_RULESET_VERSION` is the literal 8 and the current version stays 9.

- **Old shape:** none. No resolver branches on version: there is one Weekly
  Resolution, and records only store the number.
  - The constants `CHARACTERLESS_TRANSFERS_RULESET_VERSION` (6) and
    `CANDIDATE_REROLL_RULESET_VERSION` (7) exist to define 8 and to let tests
    build older records.
  - `ROLE_AWARE_OFFICERS_RULESET_VERSION` (8) is used by `isBlankHitDiceLevel`
    (A6).
- **Where:**
  - `src/lib/ruleset-versions.ts`.
  - The re-exports in `src/lib/canonical-weekly-resolution.ts`.
- **Tests and tags:** these catalog-pinned tests build or assert pre-v8
  records:
  - `rules.U05.ruleset-version` (`src/lib/characterless-transfers.test.ts`)
  - `rules.A10.reroll-version` (`src/lib/candidate-roll-twice.test.ts`)
  - `rules.HIST-05.manager-limit-version` and
    `rules.HIST-05.candidate-expansion` (`record-review.test.ts`)

  Others use an arbitrary small `rulesetVersion` as display data, for example
  `record-view.test.tsx` and `finished-week-index.test.ts`. They can stay.

- **Order:** after A6. Keep `CANONICAL_WEEKLY_RULESET_VERSION` at its current
  number (9 since #198, `ASSUMED_PROPAGANDA_APPROVAL_RULESET_VERSION`).
- **Risk:** none for data. Collapsing the constants must not reset the number.
- **Size:** about 15 source lines and about 200 test lines.

### A8. Off-list rank-boon feat text (#157)

Removed 2026-09-29 (#198).

- **Old shape:** a rank-boon acknowledgement (`upkeep:boon:<rank>:<characterId>`)
  whose outcome is free text rather than one of the offered feats, written by
  the open text field used before #157's feat cards. Feat boons now write only
  the chosen card.
  Open boons (Skilled, Gift, XP, Champion) still use free text, and that stays.
- **Where:** `feats.legacyOutcome` in
  `src/components/weekly-draft-workspace/upkeep-rank.ts`, and its block in
  `upkeep-rank-view.tsx` (the `OutcomeEditor` reuse for feat boons).
- **Tests and tags:** "a chosen feat card … off-list text stays a legacy
  outcome" (`upkeep-rank.test.ts`, not pinned).
- **Risk:** production has no acknowledgements. Confirm first that no other
  `acknowledge` writer targets `upkeep:boon:` subjects.
  - Writers today: `upkeep-rank.ts`, `use-event-edits.ts`, `sabotage-edits.ts`
    and `event-occurrence-editors.tsx`.
  - Only `upkeep-rank.ts` writes boon subjects.
- **Size:** about 25 source lines and about 20 test lines.

### A9. Legacy and absent character kinds in stored data (#179, #180)

Removed 2026-09-29 (#198) for storage; B3's argument validators stay wide (`convex/lib/canonicalCharacters.ts`, `convex/character.ts`).

- **Old shape:** a character record with `kind: 'officer_npc'` or no `kind`,
  and a roster person with `officer_npc` or `other_npc`. #179 widened readers
  to accept them. Since #180 every writer stores only `pc` or `npc`:
  - the character dialog offers `CHARACTER_KINDS`
    (`src/components/character-manager/character-form-card.tsx`);
  - `createCharacter` and `updateCharacter` (`convex/character.ts`) store
    `normalizeCharacterKind` of what they receive;
  - Setup and Militia corrections take each person's kind from their record
    (`src/lib/setup-characters.ts`, `src/components/militia-setup/roster.tsx`),
    and the server re-mirrors every roster kind from the campaign's records
    before storing a live source (`withCurrentRecordKinds` and
    `updateCanonicalCharacter` in `convex/lib/canonicalCharacters.ts`, called
    from `convex/canonicalSetup.ts` and `convex/canonicalLedger.ts`);
  - the e2e seed `convex/e2eFixtures.ts` writes `pc` or `npc`.

  The legacy values are now read-only. Production holds none: all six records
  and roster entries are `pc`, and there are no Resolution Records. So no
  live-row migration is needed, and none is planned (#181 was closed as not
  planned).

- **Where:**
  - `CHARACTER_RECORD_KINDS` and `ROSTER_KINDS` in `src/lib/character-kind.ts`
    could become `CHARACTER_KINDS`. The legacy and `undefined` branches of
    `normalizeCharacterKind`, `mirrorRosterKinds` and `formatCharacterKind`
    would then reduce to identity, and `getTeamManagerLimit`
    (`src/lib/team-manager-rules.ts`) could read `kind` directly.
  - `characterKindValidator` in `convex/schema.ts`, and
    `kind: v.optional(characterKindValidator)` in `characterValidator`, which
    could be required.
  - `rosterPersonSchema.kind` in `src/lib/canonical-roster.ts`. It reaches
    `canonicalMilitiaState` snapshots and every record's
    `sourceMilitiaSnapshot` and stored states.
  - `personKinds` in `src/components/week-review/review-comparison.ts`, which
    keeps "Officer NPC" and "Other NPC" wording for recorded history.
- **Writers of the old shape still in the tree:**
  `convex/lib/acceptedCampaignFixture.ts` inserts a character with no `kind`.
  `tests/rules/foundation-acceptance-fixtures.ts`,
  `tests/rules/character-kind-fixture.ts` and
  `tests/rules/compound-acceptance-fixture.ts` use legacy kinds. About 20 test
  files mention one.
- **Tests and tags:**
  - `src/lib/character-kind.test.ts`: "stored kind schemas accept legacy…" and
    "live normalization maps both legacy NPC labels…".
  - `src/lib/character-kind-compatibility.test.ts`: most of its seven tests.
  - `convex/characterKindCompatibility.integration.test.ts`: the legacy
    submission and "history keeps the recorded kinds" cases. Keep its mirror
    tests, with `pc`/`npc` data.
  - `HIST-05.record-kinds`
    (`src/components/historical-week/record-view.test.tsx`).
  - Catalog-pinned `rules.O06.role-aware-parity`
    (`convex/canonicalResolutionPreview.integration.test.ts`) iterates `pc`,
    `officer_npc`, `other_npc` and `npc`. Reduce it to `pc` and `npc` and keep
    its ID.
- **Order:** check dev and kept previews for legacy or absent kinds in
  `character`, `canonicalMilitiaState` and `canonicalResolutionRecord`. Then
  narrow the enums and delete the branches in one deploy. The same validators
  check write arguments; see B3 for browsers still on a pre-#180 bundle.
- **Risk:** low. Production needs no rewrite, only narrowing.
- **Size:** about 40 source lines and about 600 test lines.

### A10. Setup envelope version 1 migration (#173, #180)

Removed 2026-09-29 (#198): a version-1 envelope is discarded.

- **Old shape:** an unfinished Setup stored in a browser at envelope version 1,
  with legacy roster kinds. Since #180 `SETUP_ENVELOPE_VERSION` is 2, and
  `parseSetupEnvelope` still reads version 1:
  - `withNormalizedKinds` maps both legacy labels to `npc`;
  - an unacknowledged version-1 start (`submitted`) is kept verbatim, so a
    same-identity retry still matches what the server accepted.
- **Where:** `src/lib/setup-envelope.ts`: `z.literal(1)` in the `version`
  union of `envelopeSchema`, `withNormalizedKinds`, and the version-1 notes in
  the file header. `docs/canonical-militia-setup.md` describes the migration.
- **Tests and tags:**
  - `[setup.resume.migrate-kinds]` and `[setup.resume.migrate-records]` in
    `src/lib/setup-envelope.test.ts`.
  - `[setup.resume.migrate]` and `[setup.resume.migrate-unacknowledged]` in
    `src/components/militia-setup/screen.test.tsx`.
  - None is catalog-pinned. `[setup.resume.migrate-wait]` tests restoring
    after records load, which is not specific to version 1, and stays.
- **Order:** none of it reaches the server. Removing it with A9 keeps the
  parser and the kinds consistent.
- **Risk:** envelopes live in each player's `localStorage`, so no production
  check can see them. Production's only campaign already has its militia, and
  starting Setup retires its envelope, so no production Setup can be
  unfinished. At worst a version-1 envelope in some browser is discarded
  instead of migrated.
- **Size:** about 35 source lines and about 250 test lines.

---

## B. Safe once a condition holds

### B1. Older Event and check-decision fields (#164–#168)

**Removed 2026-09-29 (#198)** once W1 was narrowed. Also rewritten:
`O04.persistent-selection` (it relied on same-week decision support). One
reachable edge case changed its result: a Theft or Sickness whose table roll is
corrected to Raid or Cache Discovered keeps its event-level mitigation or check,
which the old engine applied to every person or cache. It is now ignored and
listed as an unused input to clear. By user decision on 2026-09-29 this is
folded into the unreleased Ruleset Version 9 rather than a Version 10.

**Condition: W1 is retired or narrowed.** The per-family Event controls and the
Persistent page never write these fields. The generic Event details editor
still can, because it edits the full `eventOccurrenceSchema`, including
`occurrence.persistentDecision`. Production holds none of them today. Once W1
stops offering them, each part below is safe.

**B1a. Event-level mitigation on Raid and Cache Discovered (#164, #165)**

- **Old shape:** `occurrence.mitigation` and `occurrence.rolls.check` standing
  in for every hidden person or cache. Current controls write per-target
  `targetChecks[]`. Event-level mitigation remains current for Theft.
- **Where:**
  - Engine:
    - the `?? event.mitigation` and `?? event.rolls?.check` fallbacks in
      `checkThreatMitigation` (`src/lib/rules-threat-events.ts`);
    - the target fallback in `eventMitigationInput`
      (`src/lib/rules-event-checks.ts`).
  - UI (`src/components/weekly-draft-workspace/`):
    - `legacyMitigation` and `legacyCheckRoll` in `event-target-facts.ts`,
      `event-resource-facts.ts` (with `legacyRoll`) and `types.ts`;
    - the notes in `event-raid-inputs.tsx` and `event-resource-inputs.tsx`;
    - `clearEventMitigation` in `use-event-edits.ts`.
- **Tests:**
  - Catalog-pinned `rules.EV03.mitigate` and `rules.EV03.inputs`
    (`src/lib/rules-threat-events.test.ts`) use event-level cache mitigation as
    their scenario. Rewrite them to `targetChecks` and keep their IDs.
  - `EVT-08.raid-legacy` (`event-target-facts.test.ts`) and
    `EVT-07.cache-retained` (`event-resource-facts.test.ts`) are not pinned.

**B1b. Overseer support on a target, reaction or same-week decision (#164, #166)**

- **Old shape:** `targetChecks[].overseerCharacterId`,
  `sabotage.overseerCharacterId` and a same-week
  `persistentDecision.overseerCharacterId`. Current support lives only on the
  occurrence's own `overseerCharacterId` or on a carried event's mitigation
  decision.
- **Where:**
  - `eventOverseerSelection` in `src/lib/rules-overseer-event.ts`.
  - In `src/lib/overseer-support.ts`: the `target`, `reaction` and
    `same-week-decision` locations in `occurrenceSelections`,
    `withoutSupport` and `assignOverseerSupportEdit`.
  - `LegacyOverseerNote` (`event-legacy-overseer-note.tsx`) and its uses in
    `event-check-row.tsx`, `event-cache-target.tsx` and `event-raid-person.tsx`.
  - The `overseer: null` patch in `use-event-edits.ts`, and the related field
    in `types.ts`.
- **Tests:**
  - Catalog-pinned `rules.O04.event-scope` (`rules-threat-events.test.ts`)
    selects support on a reaction and a later target. Reduce it to the
    occurrence selection and keep its ID.
  - `rules.EVT-10.overseer-holders` (`src/lib/overseer-support.test.ts`) and
    `EVT-10.overseer-legacy` (`overseer-support-view.test.tsx`) are not pinned.

**B1c. Acknowledgements nested in a Sabotage reaction (#166)**

- **Old shape:** `sabotage.acknowledgements`. Current notes are draft-level
  acknowledgements with subject `sabotage:<event>:<choice>`.
- **Where:**
  - `recordSabotageOutcome` in `src/lib/rules-event-shaping.ts`.
  - `nestedAcknowledgement` in `event-sabotage-facts.ts`, and its two
    branches in `sabotage-edits.ts`.
  - The `occurrence.sabotage.acknowledgements` read in `recordedOutcomes`
    (`record-review.ts`).
  - The schema field in `src/lib/weekly-draft-facts.ts`.
- **Tests:** the shared fixture `tests/rules/event-action-fixture.ts` nests one.
  Move it to `draft.acknowledgements`, which many pinned event tests use. Also
  `rules-threat-events.test.ts` (`O04.event-scope`), `rules-event-actions.test.ts`,
  `event-sabotage.test.tsx` and `event-view.test.tsx`.

**B1d. Stored buyoff amounts: `costCopper` (#167)**

- **Old shape:** a `buyoff` Persistent decision with `costCopper`. Since #167
  Buy off is amount-free at the rules cost. The same-week
  `occurrence.persistentDecision` reaches the same engine
  (`rules-persistent-events.ts` collects both), which is why W1 still matters.
- **Where:**
  - `costCopper` on the `buyoff` member of `persistentDecisionSchema`
    (`src/lib/weekly-draft-facts.ts`).
  - The `buyoff-cost-recomputed` warning in `applyPersistentBuyoff`
    (`src/lib/rules-persistent-events.ts`).
  - `removedLiveWarnings` in `persistent-sections.ts`.
  - `historicalMessages` and the "Recorded buyoff amount" line of
    `decisionDetails` in `record-review.ts`.
- **Tests:**
  - `[PER-05.legacy] [rules.P84.legacy-amount]` in `persistent-view.test.tsx`
    is pinned by case `P04.persistent-preparation` in both `plannedTests` and
    `tests`. Remove it there, next to the comment "P84.copper retired by #167".
  - `PER-05.legacy` in `persistent-facts.test.ts`.
  - The warning in `tests/history/resolution-record-fixtures.ts`.

**B1e. Unused fields on check decisions and occurrences (#168, #164)**

- **Old shape:**
  - `strategistCharacterId` on occurrences and mitigation decisions. No rule
    reads it; only the reference check in `src/lib/weekly-draft-references.ts`
    does.
  - `targets` on a carried mitigation decision.
  - A `mitigate` decision on a carried event without a check, such as Low
    Morale.
- **Where:**
  - `retainedFields` in `persistent-check-facts.ts`, and `RetainedDetails` in
    `persistent-retained-details.tsx`.
  - The "This saved check isn't available" message in `persistent-view.tsx`.
  - The two schema fields.
- **Tests:** `PER-03.legacy` (`persistent-view.test.tsx`, not pinned), and
  seven test lines that set `strategistCharacterId`.

**B1, all parts**

- **Order:** retire or narrow W1, then re-check drafts, then narrow the schema
  fields and delete the fallbacks in one deploy. The fields sit in
  `eventOccurrenceSchema` and `persistentDecisionSchema`, which records also
  embed.
- **Size:** about 260 source lines and about 500 test lines, plus the shared
  fixture changes.

### B2. Candidate Roll Twice expansions and replacement-child rerolls (#191, #163)

**Removed 2026-09-29 (#198)**, reroll groups everywhere (rolled tree and
automatic events too). Also rewritten: `E03.nested`, `E04.reroll`,
`E04.independent`, `A10.reroll-parity`. One reachable edge case changed its
result: a replacement prepared for an event that cannot occur, whose parent's
die is later corrected to a Roll Twice that rerolls in place, was read as that
reroll. It now stays unused and the Roll Twice asks for its own new die. By user
decision on 2026-09-29 this is folded into the unreleased Ruleset Version 9
rather than a Version 10.

**Condition: W2 (the Activity candidate-tree editor) is retired.** It can still
write candidate trees with any `origin`. The parallel fixes batch retires it;
once that lands, this entry is safe given the production facts (no stored
choices), and needs only the draft re-check below.

- **Old shape:** two kinds of child in Activity candidate sets:
  - `roll_twice` children, from before Ruleset Version 7. Since then a
    candidate's Roll Twice is rerolled in its own die. These children show as
    **No longer used**.
  - `replacement` children recorded as a Roll Twice reroll (`reroll: true`
    groups), including on automatic events. This is "an older client's
    representation of that reroll".
- **Not legacy:** replacement children for an event that cannot occur. They are
  current.
- **Where:**
  - `isLegacyCandidateExpansion`, and its use in `isSurplusEventOccurrence`, in
    `src/lib/event-occurrence-preparation.ts`.
  - In `src/lib/rules-event-selection.ts`: child matching for reroll groups in
    `selectOccurrence` and `validateCandidate`, and the
    `EventPositionGroup.reroll` comment.
  - In `src/components/weekly-draft-workspace/`:
    - `event-tree-facts.ts`: the `legacy` status and label and `nested.legacy`
    - `EventBlock.legacy` in `types.ts`
    - the "…no longer used" disclosure in `event-block.tsx`
    - `nestedCount` in `activity-candidate-facts.ts`
    - the `block.legacy` walk in `use-event-edits.ts`
    - `event-view-test-fixture.ts`
- **Tests:**
  - Pinned in catalog case `A10.roll-twice`, whose `expected` also says
    "earlier expansions stay recorded and unused":
    - `rules.A10.reroll-before-after` and `rules.A10.reroll-representation`
      (`src/lib/candidate-roll-twice.test.ts`);
    - `rules.A10.roll-twice` (`src/lib/rules-event-actions.test.ts`), which
      should keep its ID and drop the "older expansion children" half;
    - `rules.HIST-05.candidate-expansion` (A7).
  - Not pinned: `EVT-13.candidate-legacy` (`event-occurrence-preparation.test.ts`)
    and `EVT-13.candidate-legacy-view` (`event-facts.test.ts`).
- **Order:** W2 first, then check drafts, then the engine and UI deletion.
- **Risk:** low. The surplus machinery itself stays (C1).
- **Size:** about 70 source lines and about 250 test lines.

### B3. Old-client kind submissions (#180)

**Condition: no browser still runs a bundle from before #180.** This is the
write side of A9. The production release that carries #180 replaces a bundle
whose forms still send `officer_npc`, and a tab left open across that release
keeps sending it until reloaded.

- **Old shape:** a write argument that carries a legacy kind:
  - `createCharacter` or `updateCharacter` with `officer_npc`;
  - a Setup start or Militia correction whose roster holds `officer_npc` or
    `other_npc`, including a version-1 Setup envelope's unacknowledged start,
    which A10 resends verbatim.
- **Where:** the arguments reuse the stored validators, so they accept legacy
  kinds today and normalize them:
  - `characterKindValidator` in the argument objects of `convex/character.ts`,
    next to the "Old clients may still send officer_npc" normalization;
  - the `militiaSetupSchema` roster kinds accepted by `convex/canonicalSetup.ts`
    and `convex/canonicalLedger.ts`, which `withCurrentRecordKinds` then
    re-mirrors.
- **Tests:** "record APIs store PC or NPC for legacy submissions…" in
  `convex/characterKindCompatibility.integration.test.ts`.
- **Order:** narrow with A9. If a stale tab's write should be normalized rather
  than refused, keep the argument validators wide for one release after #180
  reaches production, and narrow only storage first.
- **Risk:** low. A refused write shows the ordinary save failure, and reloading
  fixes it.
- **Size:** about 15 source lines and about 100 test lines.

### B4. Pre-canonical character fields and the `dataMigration` table (#16, #17)

Removed 2026-09-29 (#198); the production `dataMigration` row is deleted before deploy.

**Condition: a read-only check of the documents in every kept deployment.** The
2026-09-28 production check did not report these.

- **Old shape:**
  - `ownerId` stored as a number. The comment says: "Widened during ownerId
    migration. Narrow back to v.string() after backfill."
  - `isActive` absent, read as active by `isActive !== false` in
    `convex/character.ts`, `convex/canonicalSetup.ts`,
    `convex/lib/canonicalCharacters.ts`, `src/components/character-manager.tsx`
    and `src/components/use-canonical-ledger.ts`. Every writer sets it.
  - The `dataMigration` table and `dataMigrationValidator`. Nothing reads or
    writes them.
- **Where:** `characterValidator` and `dataMigration` in `convex/schema.ts`.
- **Order:** backfill or confirm, then narrow. Clear the `dataMigration` table
  in each deployment before dropping it from the schema, as #91 cleared its
  tables before narrowing.
- **Size:** about 30 lines.

### B5. #91 rejection endpoint names

**Condition: no pre-cutover browser bundle or operator script can still call
them.** Cutover was 2026-09-24. Old-backup recovery uses release `b249911`, not
this release, so the backup retention window through 2026-10-08 does not depend
on these names.

- **Old shape:** calls to the retired board and migration functions.
- **Where:**
  - Every export of `convex/militia.ts`, `convex/weekBoard.ts`,
    `convex/migrations.ts` and `convex/legacyRetirement.ts`.
  - The internal functions of `convex/cutover.ts`.
  - `rejectRetiredWorkflow` in `convex/lib/retiredWorkflow.ts`.
- **Keep:** `cutover.status`, which has no application consumer but remains
  covered by `acceptedCampaign.integration.test.ts` and
  `initialMigration.integration.test.ts`. `MaintenanceBanner` now uses
  `useInitialMigrationMaintenance`. Also keep the
  `readCutover` write gate in `convex/lib/campaignRuntime.ts` and the
  `campaignCutover` and initialization receipt tables. They are the maintenance
  gate and the audit evidence.
- **Tests and tags:**
  - `[retirement.reject]` (`convex/legacyRetirement.integration.test.ts`) and
    `[retirement.preserve]` (`convex/acceptedCampaign.integration.test.ts`) are
    mapped by case `P11.legacy` with `serviceTests: ['live.cutover']`.
  - Retiring the names changes that case. Its `expected` text and the
    fingerprinted case inventory need a reviewed update, and the e2e cutover
    journey's retired-path checks change too.
- **Size:** about 290 source lines and about 30 test lines.

### B6. Planned Character Sheet release cleanup (#240)

The initial-release freeze and rejection policy are documented in the [write-gate runbook and writer inventory](initial-character-migration-write-gate.md). Existing retired cutover commands remain rejection stubs.

`initialMigrationControl.acceptWebhooksAfter` remains an optional schema field for compatibility with existing control rows. No writer sets it and webhook delivery no longer reads it: after the Write Gate reopens, signed redeliveries use the affected record's provider timestamp for ordering.

Planned by [Decide how the character builder release migrates safely](https://github.com/AndreasUnunger/EverythingPath/issues/240#issuecomment-5954578153); see [Migration and release](pf-character-sheet-data-model.md#migration-and-release). This is future cleanup, not a completed migration or a new production observation. The existing flat Character fields remain live until sheet authority is activated.

**Condition: sheet authority has been activated, forward recovery has been verified, and every kept deployment is ready for narrowing.** Retain flat values and old spell rows through preparation and activation. Remove them in a separate behavior-preserving change, never inside the initial backfill.

- **Future old shape:** Character `level` and six flat ability scores; `spell` and `characterSpell` rows; spell aggregate entries; legacy write contracts.
- **Where:** `convex/schema.ts`, `convex/spell.ts` (its internal readers and aggregate), plus Character readers/writers and retained compatibility endpoints identified by the release's coverage inventory.
- **Order:** stop all spell writers first, including public writes, imports and aggregate maintenance. Done in C2a: `addSpellMutation`, `addNextHundredSpells` and `rebuildSpellAggregate` are removed and the legacy spell dataset (`convex/data/spells.js` and its declaration) is deleted. The `spell` and `characterSpell` rows, the spell aggregate, the tables and the internal readers (`spell.get`, `spell.getCount` and the backfill's existence check) remain for C2b. After verifying active readers use sheets and the Catalog Release, clear flat values, legacy spell rows and their aggregate entries before removing the corresponding columns/tables and obsolete code/data. Preserve Character IDs and frozen history; never restore stale flat authority to recover accepted sheet edits.
- **Keep:** reload-required rejection stubs while old tabs or delayed commands still need an explicit response. Remove them only in a separately reviewed change that accounts for those callers.
- **Evidence:** rehearsal and current deployment checks must show facts/history unchanged by cleanup, no spell repopulation, rejected legacy writes and forward repair preserving post-activation edits. The 2026-09-28 observations above do not authorize this future removal.
- **Size:** not yet sized; implementation and cleanup are still pending.

---

## C. Keep

### C1. Surplus positions and "Needs repair" (#163)

Surplus positions are over-full groups and automatic events whose source is not
due. They show as **Needs repair** and can be removed once empty through
`isSurplusEventOccurrence` and `removableEventOccurrence`
(`src/lib/event-occurrence-preparation.ts`) and `tree.block`
(`event-tree-facts.ts`).

- **Why keep:** current play still produces them. Preparation only fills
  (`d550d47`), so changing a chance roll, table roll or queued effect after
  positions exist leaves extras behind.
- The "legacy roots" left by the removed manual add buttons use the same path.
- Tests: `EVT-13.legacy` and `EVT-13.repair`.
- Only B2's candidate-expansion branch is removable.

### C2. Retained unused fields in Activity and Event; the candidate-tree editor

- **Why keep:** values a mode or type change leaves unused stay visible and
  removable, and the current editors create them:
  - Activity: `RetainedClear` (`activity-mission-fields.tsx`), and
    `retainedPlace` and `retainedItem` (`activity-economy-detail.ts`).
  - Event: `retainedFields` and `EventRetainedInputs`.
  - Persistent: retained targets, except B1e.
- Recorded modifiers of unknown source can be removed by position
  (`removeModifierEdit` in `activity-board.ts`, `ActivityModifierList`). They
  come from the generic modifier editor in `activity-details.tsx`.
- The Activity host lists any choice acknowledgement that no per-action editor
  owns ("older notes still listed by the host", #190, in `ActivityDetails`).
  Required acknowledgements use the same list, so it stays.
- The **Recorded candidate details** editor (W2) is being retired by the
  parallel fixes batch, which had not landed at `76a7b23`. Its retirement
  unblocks B2 and removes one writer of B1's nested shapes. B1 still waits on
  W1, the Event details editor.

### C3. Current look-alikes

Each of these looks like old data but is written today.

- **Nullable `hitDice`:** blank means the level (`getEffectiveHitDice`). It is
  not legacy.
- **Recovery `costCopper` on Upkeep team decisions:** `recoverTeam` in
  `upkeep-edits.ts` writes the rules cost.
- **Activity `costCopper`:** the editable cost field in
  `activity-detail-parts.tsx`; Special requires it. The `calculated-cost` and
  `recovery-cost-baseline` warnings for a differing cost are current too.
- **`upkeep_team` rolls on `leave` decisions:** the missing-team return check.

### C4. The `blocked` team status

`TEAM_STATUSES` (`src/lib/militia-domain.ts`) includes `blocked`, and Setup's
roster (`src/components/militia-setup/roster.tsx`) still offers it. It is
current data. The summary adjustment form keeps offering it only to an
adjustment that already records it (`summary-adjustment-form.ts`), and that
behavior should follow any future decision about the status itself.

### C5. Legacy addresses and week links (removed 2026-09-29)

**Removed** on 2026-09-29 at the user's request ("remove all the legacy
Redirects, no one is going there"). These were bookmarks, not stored data, so
no data is affected. Removed:

- `legacyRedirectTarget` and its file
  `src/components/campaign-shell/legacy-redirect.ts`, and `legacyCampaignPath`
  (`src/lib/campaign-routes.ts`), with their unit tests.
- The `/canonical-workspace`, `/canonical-setup` and `/canonical-history`
  pages, and the old `/campaigns/<id>/militia/correct` address that redirected
  to Militia.
- The `legacy-addresses` journey and its `legacyAddresses` case.

`decodeCampaignId` moved first, to `src/lib/campaign-routes.ts`. The
`legacy-week-links` journey became `week-links.spec.ts` (case `weekLinks`). It
now follows the current `/campaigns/<id>/week?phase=` links and keeps its
current checks, and it took over the unknown-campaign and `/` entry checks from
`legacy-addresses`. The journeys that opened a week, Setup or history through
an old address now open the current one.

### C6. Ruleset Version numbers in the corpus and history

The version notes in `docs/ai/ironfang-militia/militia-rules.md` (versions 6, 7,
8 and 9) and the stored number 8 stay. See the rules at the top.

### C7. Frozen-record tolerance for unfamiliar entries

`describeRecordedChange` (`src/components/week-review/review-changes.ts`), the
`try` in `sectionChips` and the `generic` fact text keep a record readable when
a plan entry has a shape the current readers do not know.

- **Why keep:** after release, every future change to a plan entry's shape
  meets immutable version-8 records.
- Remove only the format-1 and missing-snapshot paths (A5).

---

## Documentation to update with each removal

- `docs/ui-capability-inventory.md` rows describe the older-data behavior:
  - NAV-03 and NAV-17 (C5, updated with its removal)
  - WEEK-15 and WEEK-16 (A2)
  - UPK-08 (A8) and UPK-10 (A3)
  - ACT-14 (C2)
  - EVT-04, EVT-08, EVT-10 and EVT-13 (B1, B2)
  - PER-05 (B1d)
  - SUM-08 (C4)
  - HIST-05 (A5, A6)
- The entry notes above that table, for #179, #180, #194 and #185, name the
  fixtures.
- `docs/canonical-militia-setup.md`: the kind and envelope paragraphs (A9,
  A10).
- `docs/weekly-draft-contract.md`: the #180 paragraph on relabelled kinds
  (A9).
- `tests/rules/README.md`, "Upkeep extraction": the transfer-actor paragraph
  (A3).
- `docs/canonical-weekly-resolution.md` still says Confirmation "stays isolated
  until the approved cutover" and that format 2 uses "ruleset version 2". Both
  are stale. Correct them when A5 lands.
