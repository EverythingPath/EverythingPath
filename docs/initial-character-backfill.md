# Private initial Character Sheet backfill (#319)

This procedure prepares private candidates while legacy Character fields and current militia state remain authoritative. It adds no gameplay or activation endpoint. [The Write Gate procedure](initial-character-migration-write-gate.md#operator-procedure) supplies the closed-gate Migration Run, declared maintenance budget, frontend build and catalog manifest. Production activation remains [#413](https://github.com/AndreasUnunger/EverythingPath/issues/413).

## Start and poll

Rehearse on isolated data first. Before remote invocation, select and authorize the deployment using its existing procedure. These commands show argument shapes only; this ticket's evidence consists of local tests without deployment or remote changes.

1. Run `pnpm -s check:initial-migration-writers` and focused tests below. Declare the maintenance budget before closing the Write Gate with `initialMigration:start`. Save its exact `{runId, epoch}` and check closed legacy authority through `initialMigration:status` with a fresh `now`.
2. Choose new capture, driver and validation identities. One command starts capture, a bounded inventory census, and scheduled self-continuation through capture and validation:

   ```sh
   pnpm exec convex run initialCharacterBackfill:startDriver '{"runId":"<saved-run-id>","epoch":1,"captureId":"capture-1","driverId":"driver-1","validationId":"validation-1","expectedValidationId":null,"expectedDriverGeneration":0}'
   pnpm exec convex run initialCharacterBackfill:status '{"runId":"<saved-run-id>","epoch":1,"captureId":"capture-1","now":<fresh-unix-ms>}'
   ```

   Exact startup retries return the same driver without adding another chain. Each tick verifies the closed gate, legacy authority, run, epoch, capture, compatibility, driver generation, validation identity, tick and batch positions before writing or scheduling one successor. Duplicate, stopped, aborted and superseded ticks do nothing. Candidates remain invisible to gameplay readers.

3. Poll status with freshly sampled `now`. Read `isReceiptValid` as the receipt/compatibility check, and `isActivationReady` as that check plus complete validation and a non-null matching completion receipt (and an unexpired budget when `now` is supplied). **#413 must require `isActivationReady: true`, a fresh budget check and its separate frontend/catalog/readiness checks.** Successful preparation never selects sheet authority.

Status reports progress, bounded diagnostics, and an estimate once the census finishes. `rowsRemaining` covers outstanding capture and all validation phases; `batchesRemaining` is a conservative upper bound of one transaction per remaining row plus a final scan per pending phase. Byte-limited pages can contain fewer than the row ceiling, so estimates never assume every page is full. Timing uses observed wall-clock intervals between work ticks, including scheduler delay, excluding census, stopped time and caller polling time. It remains null until a positive interval is observed. `estimatedRemainingMs` extrapolates that sample over the conservative batch bound; `isWithinBudget` is a planning estimate, not activation evidence. Variable sheet complexity and scheduler load can change throughput. Save progress and all report pages with the build/catalog identities and declared budget. Pass `continueCursor` back as `cursor`, including after an empty page that has more pages.

**If the declared budget cannot be met, explicitly abort before activation.** The driver stops at the deadline without reopening editing or producing a new completion receipt. A stopped or abandoned worker requires operator action; inspect status and abort/reopen instead of leaving users indefinitely paused.

### Detect a stalled driver

A driver tick that throws (for example, by exceeding a transaction limit) rolls back and schedules no successor. A tick that finds a fence problem (gate, epoch, capture or compatibility drift) also exits without writing. Neither case clears `progress.driver.isRunning` or sets `stoppedBecause`, so status keeps reporting a running driver with no liveness signal. The deadline check runs only inside a tick, so a dead chain is never stopped for budget either.

Treat the driver as stalled when two polls a few minutes apart show `isRunning: true` and an unchanged `progress.driver.nextTick`. `nextTick` advances on every tick, including census ticks. `progress.driver.lastBatchStartedAt` is the Unix-ms start of the latest capture or validation tick. It stays `null` during census, so during census compare `nextTick` instead. A `lastBatchStartedAt` that falls far behind a fresh `now` also indicates a stall. Check the deployment's function logs for the failed `initialCharacterBackfill:drive` call.

To recover:

- If status reports `isReceiptValid: false`, or `initialMigration:status` shows the gate reopened or the epoch changed, the fence problem cannot be resumed. Run `abortBeforeActivation` as described under [Stop, resume or abort](#stop-resume-or-abort).
- Otherwise run `stopDriver` with the current `progress.driver.id` and `progress.driver.generation`. Then run `startDriver` with a new driver identity, `expectedDriverGeneration` set to the `progress.driverGeneration` that stop returns, and `progress.validationId` as `expectedValidationId`. Keep the same `validationId` to resume the sweep.
- If the restarted chain stalls again at the same `nextBatch` or `nextValidationBatch`, the failure is deterministic. Abort before activation instead of retrying.

## Validation and capacity

Validation checks Character coverage, exact recorded input preservation, eligible presentation, ownership/access and references. It compares candidate permanent facts with flat Character fields, genuinely current live facts (respecting fixture-only prepared-sheet authority), and current militia mirrors. Uninitialized sheets receive recorded base scores, rolled settings and ordered Character-scoped Unspecified Class Levels, without invented class benefits or HP. Legacy candidates do not initialize live sheets or create prepared-demo race, Archetype, weapon or Spell seeds. Initialized sheets retain their inputs and presentation. Full-only eligibility, multiple militias, roster kind mismatches and cross-scope Companion Relationships fail with reports rather than correction.

Initialized Characters with companion calculation dependencies cannot yet be certified by the private candidate adapter: a saved familiar creature choice, recorded animal Companion Progression, or any retained relationship of any companion kind at either endpoint fails preparation with a diagnostic. Legacy uninitialized Characters retain their existing relationship inputs unchanged. #712 added the linked-companion adapter to Catalog Release reconciliation only; this capture adapter still lacks it. That work belongs to the backfill, [#319](https://github.com/AndreasUnunger/EverythingPath/issues/319) (Implementation Decision 19), and [#714](https://github.com/AndreasUnunger/EverythingPath/issues/714)'s cutover rehearsal is the gate that must catch it. This refusal prevents candidate calculations from silently omitting creature choices, retained animal progression or linked master inputs; it produces no completion receipt and never changes live inputs or facts. Rehearse this limitation before closing a real Write Gate, and follow the abort/reopen procedure if such a diagnostic appears during a run.

Capture stores a fixed SHA-256 digest of the complete canonical Character document instead of duplicating its Notes. Whitespace, Unicode, Notes, identity, owner, campaign, kind and active state participate exactly in that digest; source documents remain untouched. The Character schema has `description` Notes and no `descriptionFormatted` field. The serialized candidate input has a 768 KiB UTF-8 storage budget, leaving headroom for fixed metadata and its digest, with explicit overflow diagnostics. Legacy mapping supports 0–4,095 levels.

Capture and costly validation phases process at most two top-level rows; simpler reference scans process eight (four for Character Spells). Pagination reads at most 1 MiB per page and explicitly limits rows. Two sheets share a finite transaction budget: each sheet allows at most 4,096 entries and 4,096 local definitions, excluding browse-only seeded rows, and 768 KiB **total** across entries, local and referenced shared definitions, preferred campaign-copy lookup results, missing-document reads, attack-source fallbacks, the compatibility row and any campaign loaded by the prepared-sheet reader. The graph follows only recorded references and the shared reference-field list; validation uses that same list. Each sheet permits 1,024 distinct external references, including preferred copies and attack-source fallbacks, excluding its initial local definitions. Backfill sheet reads skip Accepted Warnings; a separate validation scan checks them. Sources and drafts allow 1,024 Character references and a 2 MiB referenced-row budget each; the roster check reuses loaded Characters. Companion sources support 1–128 contributions, 1,024 decoded references/nested Grant layers and 2 MiB of referenced rows. At most one final referenced document can cross a byte budget before being reported; batch ceilings reserve headroom for that read. Index lookups have no separate ceiling. In the worst case, two sheets that each reach 1,024 distinct shared references with no campaign copies cost about 4,096 index lookups in one batch. If such a batch fails or stalls, follow [Detect a stalled driver](#detect-a-stalled-driver), and abort before activation when a restart stalls at the same batch. The census uses 128 rows/1 MiB with no reference hydration. Real transaction-limit tests cover large initialized sheets, candidates and Notes.

Each batch stores at most 128 scoped diagnostics plus an explicit omitted-count message; all discrepancies contribute to failure. Status pages contain at most 20 diagnostics. These are technical preparation budgets, not truncation or normalization of player data. Structural mismatches fail; advisory rules warnings remain advisory. Retained unavailable companion sources remain unchanged, surviving foreign references fail, and empty supporting-source lists get a separate missing-source report. Current campaign/source scope must exist; frozen records are retained without rewriting historical references.

Private preparation never changes roster Hit Dice overrides, officer/team assignments, saved Weekly Draft inputs, frozen Resolution Records or equal facts revisions. Completion binds run, epoch, capture, validation, catalog manifest and schema/calculation identities. Capture also binds frontend build and catalog identities. Compatibility drift refuses preparation, but still allows the current run to abort and reopen legacy editing.

## Stop, resume or abort

Inspect status after a failed call or lost response. To stop scheduling without reopening gameplay:

```sh
pnpm exec convex run initialCharacterBackfill:stopDriver '{"runId":"<saved-run-id>","epoch":1,"captureId":"capture-1","driverId":"driver-1","generation":1}'
```

Stop increments the generation before queued ticks can act. To resume within the same freeze, use `startDriver` with a **new** driver identity, the current `driverGeneration`, and the current validation identity as `expectedValidationId`. Keep the same `validationId` to resume its sweep; select a new validation identity to request a new complete sweep. Stopped driver identities never restart via an old retry.

Manual maintenance remains available after stopping the driver. `start` initializes capture, `batch` (or its operator synonym `resume`) uses authoritative `nextBatch` until `isInventoryDone`. `startValidation` explicitly registers a sweep with `validationId` and compare-and-set `expectedValidationId` (`null` initially). `validate` only continues the registered identity with authoritative `nextValidationBatch`; an unknown or stale identity cannot reset progress, even with `expectedBatch: 0`. Exact completed batch retries do not duplicate candidates. Manual batch/validate calls refuse an active driver.

```sh
pnpm exec convex run initialCharacterBackfill:startValidation '{"runId":"<saved-run-id>","epoch":1,"captureId":"capture-1","validationId":"validation-2","expectedValidationId":"validation-1"}'
pnpm exec convex run initialCharacterBackfill:validate '{"runId":"<saved-run-id>","epoch":1,"captureId":"capture-1","validationId":"validation-2","expectedBatch":0}'
```

If capacity, mismatches or estimated work cannot fit the budget, abort before activation:

```sh
pnpm exec convex run initialCharacterBackfill:abortBeforeActivation '{"runId":"<saved-run-id>","epoch":1,"captureId":"capture-1"}'
```

Check `initialMigration:status` with a fresh timestamp: legacy authority must be open, the run aborted, and the epoch newer. Abort fences workers atomically before reopening. Reload before fresh edits. Correct accepted source data, then start a new Migration Run with the current epoch, new operation and capture identities. Recapture every current Character and facts, including newly created Characters, and revalidate all candidates. Never reuse an old completion, substitute a new epoch into an old worker, or skip work completed by another capture.

## Local rehearsal evidence

The agreed seams are the pure mapper/equality checker, registered internal workflow, schema reference coverage and writer audit:

```sh
pnpm test src/lib/initial-character-backfill convex/initialCharacterBackfill convex/initialMigration tests/initial-migration-writers.test.ts src/lib/character-sheet-grants convex/characterSheet tests/convex-function-validators.test.ts
pnpm -s check:initial-migration-writers
```

Fixtures cover gate closure, bounded retry/resume, exact Notes, facts and input equality, unchanged revisions/drafts/history, eligibility/access failures, scoped multi-row reports, scheduled continuation, stop/restart/duplicate/stale ticks, maintenance expiry, explicit abort/reopen and recapture of intervening edits/new Characters. Writer audit checks the exact private operator allowlist, alias registrations and rejection of public/unreviewed bypasses. Initial preparation state/candidate validators change only undeployed #319 tables; this assumes the ticket's stated deployment history and makes no remote verification. Frontend readiness, deployment compatibility, remote rehearsal, activation and post-activation smoke/reopen remain separate evidence.
