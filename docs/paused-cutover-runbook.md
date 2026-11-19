# Paused cutover and recovery rehearsal (#89)

For current initial Character Sheet preparation, use the [private candidate-backfill rehearsal](initial-character-backfill.md#local-rehearsal-evidence) under the [initial Write Gate](initial-character-migration-write-gate.md). This older weekly-board rehearsal does not authorize invoking its retired writer endpoints.

This runbook rehearses the transition on the declared disposable E2E preview.
Production cutover remains #90. A passing rehearsal is evidence for the tested
source and fixtures, not permission to migrate or reopen a live campaign.

## Run the isolated rehearsal

```bash
E2E_TRUSTED_EXECUTION=true pnpm -s test:e2e \
  --resources e2e/.private/resources.json \
  --secrets e2e/.private/test-secrets.env
VITEST_MAX_WORKERS=2 pnpm -s acceptance:check \
  --browser-report /absolute/path/to/the/new/report.json
```

The ordinary runner validates the declared nonproduction resources, acquires its
exclusive preview lock, deploys both current server functions and the browser
build, and runs one worker. The `canonical-cutover` journey is mandatory; missing,
skipped, retried or stale-source evidence cannot satisfy `live.cutover`.

The rehearsal owns all traffic to the preview. Players are authenticated and moved to the inert landing page before the
source is seeded. The campaign page mounts the legacy board and can autosave
defaults, so it is not a paused location. No board stays open during the
coordinated pause. Only the rehearsal driver writes
synthetic acceptance data. This models the accepted no-old-version-requests
condition; dedicated legacy endpoint rejection and forced reload are not required.

The journey performs these steps in order:

1. Seed a synthetic mid-campaign militia at week 9 with an officer/manager,
   missing team, settlement, cache, pending order, carried Sickness, uneventful
   carry, buyoff bookkeeping, a next-week modifier, discarded choices and legacy
   history. Resolve missing item weight/location and cache contents explicitly
   in preparation. Read preflight and the supported legacy reader before saving.
2. While paused, export a full Convex ZIP including file storage into the private
   runner directory. Record its SHA-256. Verify the authoritative source is still
   identical after export. The checksum identifies the backup; restoration below
   is what proves it is usable.
3. Initialize using the exact reviewed source token. Retry with the same identity.
   Compare authoritative facts, references and legacy storage; require one empty
   revision-zero draft, one revision-zero source, and empty canonical history.
   Initialization runs no Upkeep/projection, consumes no queues, changes no
   balances, and does not advance the week. The original storage is retained.
4. Switch both reads and writes to the ordinary canonical Workspace/Persistence
   interface. Enter the isolated week, read the exact preview, and confirm it.
   Verify one record, one open successor, and preview-to-committed snapshot equality.
5. Remain paused. Restore the exported ZIP with `convex import --replace-all` on
   that same **disposable preview only**. Compare the complete preflight source,
   preparation, original draft choices/history, and supported legacy reader with
   their pre-backup values. Require canonical state/drafts/history to be absent.
   This demonstrates recovery through the verified-backup branch using a release
   that still supports the legacy reader; it does not require a reverse converter.
6. Write `cutover-evidence.json` alongside `report.json`, with the tested source
   fingerprint, preview name, backup hash, verified checks and `reopening: false`.
   Runner cleanup removes the synthetic backup and private credentials after the
   proof. Subsequent journeys reset their own fixture data.

If any step fails, the journey fails and supplies no cutover evidence. Inspect the
safe stage log. Rerun the complete runner to recreate owned fixtures; never repair
this test by importing its data into a personal or production deployment.

## Production checklist for #90

Before pausing, pin the compatible old release, candidate release, target
deployment, campaign inventory and responsible operator. Complete the current
human/rules/multiplayer acceptance gate. Inventory scheduled/background writers
as well as browser and administrative writers. Coordinate the write pause and
wait for in-flight work to finish. #90 owns any deployment-wide maintenance gate
needed to make that pause enforceable on the actual application.

Take and retain a full backup while paused. Verify restoration in an isolated
target before changing authoritative storage. Record source tokens and resolved
preparation per campaign, initialize restartably, and compare the same preserved
values/references against the backup. Switch application readers and writers in
the same release while paused; no dual writes. Do not use a real campaign's
Confirmation as a smoke test. Reopen only after the complete inventory passes.

Preflight is deliberately fail-closed:

- Supply `resolutionAssets` explicitly, including empty collections. Item weight,
  location, cache inventory and other missing facts are not inferred from legacy
  notes or unfinished choices. Known item/cache/order values must match preparation.
- Legacy marketplaces and tracked-person models need a reviewed mapping before
  this initializer can activate them. They remain intact in original storage.
- Enchantment orders need a faithful enhancement-value/duration mapping. They
  cannot silently become purchases.
- Current-week created/ended events and unresolved nonpersistent events cannot
  currently be represented faithfully by an empty draft plus fixed week-start
  events. Preflight retains the recovered start facts but rejects activation;
  do not rewrite history or drop an event merely to bypass this check.
- Existing receipt-size/collection bounds and missing-context checks still apply.

These are real blockers for affected campaigns, even when the synthetic rehearsal
passes. Extend the representation/mapping and repeat its tests and rehearsal
before including such a campaign in #90.

Before reopening, recovery keeps writes paused and restores a compatible old
release with retained data or the verified backup. Check all authoritative values
and references again before enabling players. Keep the original backup through
the agreed verification window.

**Reopening ends automatic rollback.** Once players can accept new work, preserve
that work during recovery or obtain a separate explicit agreement to lose it.
Neither this runbook nor a previous cutover approval authorizes discarding it.

## Recorded rehearsal evidence

On 2026-09-24, the mandatory `canonical-cutover` journey passed on
`e2e-local-andreasununger-slot-0` for source fingerprint
`98115c728189f6f0936cda43ce35361402855a61f763d98b14ece37930f650b8`.

The actual exported ZIP had SHA-256
`3f04c2e5547c9f3bff20b1f0ffdb208867e99ec74d21f75f437b6d4161ba8bed`.
It was imported back into the paused disposable preview, and all restored-source
and legacy-reader comparisons passed. Restart and ordinary authenticated
Confirmation also passed; reopening remained false.

Safe detailed evidence is recorded in
`e2e-artifacts/e2e-local-andreasununger-slot-0/everythingpath-e2e-tyOJQg/cutover-evidence.json`.
The complete suite and strict acceptance result are recorded separately in
[the acceptance review](weekly-draft-acceptance.md).
