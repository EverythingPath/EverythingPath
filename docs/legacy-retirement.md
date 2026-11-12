# Legacy retirement (#91)

The operator confirmed production cutover completion in the implementation
session on 2026-09-24. Dev acceptance is recorded in
[the dev cutover evidence](dev-cutover-2026-09-24.md). Both private paused backup
archives were rehashed before preparing retirement and match their recorded
hashes. Reopening ended automatic rollback; neither retirement nor a later
release may replace canonical state with the old backup.

## Application retirement

The supported dashboard has one Weekly Draft Workspace and one canonical
persistence/rules authority. It no longer mounts the legacy board, phase builders,
autosave controller, old ledgers, or the alternate resolution implementation.
Legacy query and mutation names remain as unconditional rejection endpoints.
They perform no reads or writes, including when no cutover control row exists.
Character changes always update canonical source, and archived character records
cannot be deleted out from under history. Officer assignment remains in the
canonical militia ledger.

Existing canonical resolution, rules, Workspace, history and persistence scenarios
replace the old controller/mutation harness tests. The rule catalog still requires
all 487 reviewed cases. Replaced browser journeys exercise the ordinary
`/campaigns` route for membership, mid-campaign setup/reload, shared character and
officer changes, complete-week Confirmation/history and shared Action Slots.
The broader canonical Workspace journey retains conflict recovery, input clearing,
card movement and full phase behavior. The recovery journey additionally retires
legacy storage after Confirmation and checks the accepted successor and immutable
history are unchanged.

## Completed storage cleanup

The operator authorized live dev and production cleanup and schema narrowing on
2026-09-24. The tested compatible release `b249911` was deployed first. Its internal
`legacyRetirement:batch` required the accepted cutover operation, matching retained
backup hash, an inventoried militia, canonical source and one open draft. Each
transaction removed at most four documents from one allowlisted table. Final
calls replaced only obsolete militia facts, preserving militia ID and name.

| Deployment | Militias | Legacy rows removed | Verification |
| --- | ---: | ---: | --- |
| Dev `acoustic-trout-328` | 2 | 79 | Every other table unchanged; militia identities preserved |
| Production `peaceful-zebra-497` | 1 | 18 | Every other table unchanged; militia identities preserved |

Fresh before/after snapshots and exact table comparisons are retained privately
in `e2e/.private/legacy-retirement-2026-09-24/`. All thirteen legacy/preparation
tables were verified empty. Canonical state, drafts, operations, targets,
corrections, initialization receipts, history, characters and backup evidence
were compared unchanged. Ordinary authenticated Workspace and history reads
passed on both deployments. No operational campaign was confirmed or advanced.

The narrowing release removes legacy team, week, resolution, settlement, cache,
market, order, character-condition, team-condition, event and override tables,
plus migration roster/context tables and obsolete militia fields. It removes
migration readers and preparation editors. Militia rows now contain only
`campaignId` and `name` besides database identity. Cutover and initialization
receipts remain as audit evidence. Old cutover, cleanup and gameplay endpoint
names reject calls without reads or writes. Recovery of an old backup requires
the retained compatible release; it is not supported by the narrowed schema.

The narrowing release is deployed to both dev and production. Post-deployment
snapshots match every table from the post-cleanup snapshots, and authenticated
Workspace/history responses match their pre-deployment reads. Evidence is in
`dev-narrow-verification.json` and `prod-narrow-verification.json` within the private
retirement directory. No operational steps remain for this retirement.

## Retained behavior coverage

The retired migration implementation and its coupled tests remain recoverable
from Git history at `b249911`. Current regression tests use the ordinary setup,
ledger and weekly workflow: accepted campaign facts/carry, retry safety,
membership, cross-campaign references, stale correction rejection, character
updates, Confirmation, successor state and immutable history. A synthetic
accepted source retains the worked mid-campaign scenario without recreating
obsolete database storage.

Supported setup form tests retain decimal enchantment delivery, explicit receipt
validation/removal, independent same-type event targets/age/order/mitigation,
and repair of dangling event references. Existing persistent-event tests retain
ending behavior. The rules catalog maps those specific tests. Its two historical
cutover expectations now describe the completed retirement under #91; the rules
corpus and numeric cases are unchanged.

The mandatory browser matrix retains ten journeys. Its cutover project now
checks accepted canonical play, Confirmation, rejection of retired paths, reload,
and unchanged successor/history. The previous migration, backup restore and
bounded cleanup browser reports remain retained as operational evidence.

## Retained backup disposition

| Target | Private archive | SHA-256 | Retain through (UTC) |
| --- | --- | --- | --- |
| Dev | `e2e/.private/dev-cutover-2026-09-24/paused-backup.zip` | `07c28c9ee1b36a8a8e95eee3eedf76895ff9fb38c41f004dbc0c801bb2c55821` | 2026-10-08 17:26:57 |
| Production | `e2e/.private/prod-cutover-2026-09-24/paused-backup.zip` | `8e20befc01c416d85daeee254c8054887124f1c98f8f76251fbbfee9b0442192` | 2026-10-08 19:27:01.310 |

The backup archives, restore comparisons, preparations and acceptance evidence
remain private and untouched. Recovery previews are retained. Expiration of the
window is not an instruction to delete a backup or discard post-cutover work.
Use the compatible pre-retirement release for old-backup recovery; this release
intentionally cannot resume legacy gameplay.

## Later compatibility paths

This record is closed. Compatibility code the canonical application added
after this retirement, and the rejection endpoint names above, are
inventoried for later removal in the
[legacy compatibility inventory](legacy-compatibility-inventory.md).

## Standards review

No outstanding documented-standard violations or blocking findings. The narrowing
follow-up also passed review; obsolete fixture comments were removed.

## Spec review

No outstanding substantive findings. Review identified gaps in replacement form
test mappings; focused receipt, decimal, event-instance and reference-repair tests
resolved them. Live cleanup and final schema deployments are complete and verified.

## Validation evidence

The strict acceptance gate passed on 2026-09-24 at 20:52 UTC: typecheck, lint,
three build checks, 815 tests across 81 files, and all 487 rules cases with zero
gaps or errors. All ten mandatory browser journeys passed without retries on
the isolated preview `e2e-local-andreasununger-slot-0`.

- Browser report: `e2e-artifacts/e2e-local-andreasununger-slot-0/everythingpath-e2e-PTp8Ow/report.json`
- Acceptance report: `coverage/acceptance.json`
- Verified source fingerprint: `2ef6eec5727623e5a1beb266e34bbe86b711fc68382fd30a735ab9c16f2f3dfa`

The character journey checks live character delivery and persisted officer
assignment across players. The cutover journey verifies bounded cleanup leaves
the accepted successor and immutable history unchanged. None of these tests
performed live dev or production cleanup.


The narrowed release passed the strict acceptance gate at 2026-09-24 21:24 UTC:
775 tests across 74 files, all 487 rules cases with zero gaps/errors, three build
checks, typecheck and lint. All ten mandatory browser journeys passed without
retries against the narrowed preview schema.

- Browser report: `e2e-artifacts/e2e-local-andreasununger-slot-0/everythingpath-e2e-2ZKaEr/report.json`
- Source fingerprint: `e8b5ddf0e7b1a81d9bf9f1f610756cdf1425678ba61cbd4a996dba9fb6b4b87c`
- Final acceptance report: `coverage/acceptance.json`

The test-count reduction removes obsolete migration, preparation-editor and
validator-mirror tests. Replacement tests retain the supported observable
behaviors described above; no required browser journey or rules case was dropped.
