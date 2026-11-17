# Operational cutover

For the initial Character Sheet migration, use the [Write Gate procedure](initial-character-migration-write-gate.md) and [private candidate-backfill runbook](initial-character-backfill.md). The weekly-board procedure below is historical; its writer endpoints are retired and must not be used for Character backfill. Character activation remains #413.

Issue: [#90](https://github.com/AndreasUnunger/EverythingPath/issues/90).
Use this procedure with the [rehearsal and recovery runbook](paused-cutover-runbook.md).
Deployment authorization is separate from implementation or rehearsal evidence.
The initial authorized target is `dev:acoustic-trout-328`, all two campaigns;
production requires a later decision.

The operational entry points are internal functions in `convex/cutover.ts`.
Use an explicit deployment selector and retain arguments/results privately.
Preflight, preparation, initialization and verification require an explicit internal `operatorTokenIdentifier`
belonging to every campaign's organization. Convex CLI impersonation cannot invoke internal functions. Never expose that identity or backup
contents in public evidence.

1. Rehearse the candidate runtime in the isolated browser suite. Record the
   candidate release/fingerprint and a compatible legacy release. Stage the
   additive backend and web code while the runtime remains `legacy`. Complete
   current-source strict acceptance before pausing the operational target.
2. Read `cutover:inventory` and prepare preservation mappings for every campaign.
   `cutover:pause` records the exact inventory, operation ID and release pair.
   A shared transaction guard rejects campaign writes while paused, including
   previously queued mutations. Browsers display the temporary pause message.
3. Export the paused database with file storage to a private retained location.
   Record its SHA-256. Restore it into a separate disposable preview, export again,
   and compare every table document and storage file. Restore verification must
   finish before `cutover:recordBackup`; record its deployment and retention end.
4. For each campaign, use `cutover:prepare` with explicit expected preparation
   revisions, then retain the complete `cutover:preflight` result. Resolve every
   issue. Call `cutover:initialize` with its exact source token and a stable,
   campaign-specific initialization ID. Retrying that same input is idempotent.
5. `cutover:verify` must pass for the entire inventory. It checks the preserved
   snapshot/context, unchanged source receipt, original week, one revision-zero
   open draft, empty choices and no canonical history. Keep legacy records intact.
6. `cutover:activate` repeats verification in the transaction that reopens writes.
   Canonical reads and writes become active together; open compatible browsers
   reload. Users with older bundles must reload, and legacy mutation calls remain
   rejected. Check ordinary authenticated workspace reads and legacy-write
   rejection without confirming a real campaign week as a test.
7. Retain the backup and verification evidence through the recorded deadline.
   After activation, newly accepted work must be preserved; automatic rollback
   ends at reopening.

If anything fails before activation, keep editing paused. Restore the verified
paused backup and serve the compatible legacy workflow before calling
`cutover:resumeLegacy`. The restored backup retains the pause. The resume function
refuses canonical state/drafts and refuses an already reopened operation. A full
backup restore is destructive and must target only the authorized deployment.
The isolated acceptance test deliberately discards synthetic work to exercise
restoration; this does not authorize discarding real work after reopening.

Militia corrections update canonical source with a revision check and a required
reason. Character edits also update that same source transactionally. Legacy week
writers stay disabled after activation; the legacy source is retained as historical
migration evidence, rather than kept in sync with new gameplay.
