# Weekly Draft acceptance review (#88 / #89)

## Current acceptance (#89, 2026-09-24)

The complete strict acceptance gate **passes** for source fingerprint
`98115c728189f6f0936cda43ce35361402855a61f763d98b14ece37930f650b8`:

- Typecheck, lint, and all three build-boundary checks pass.
- All 1,009 tests across 106 files pass, with no skipped or pending results.
- All ten mandatory authenticated browser results pass on their first attempts.
- All 487 catalog cases are covered, with zero explicit gaps and zero errors.
- The new mandatory cutover journey exports a real paused preview backup,
  initializes/retries without advancing the week, confirms through ordinary
  authenticated canonical persistence, restores the ZIP, and compares the
  recovered authoritative source and compatible legacy reader.

Final browser evidence:
`e2e-artifacts/e2e-local-andreasununger-slot-0/everythingpath-e2e-tyOJQg/report.json`.
The adjacent `cutover-evidence.json` records the verified backup hash and checks.
`coverage/acceptance.json` and `coverage/rules-evidence.json` record the complete
passing gate. The [runbook](paused-cutover-runbook.md) documents the operational
procedure, evidence, preflight blockers, and the end of automatic rollback at
reopening. Production was neither migrated nor reopened.

The three #88 gaps (E06.preserve, P11.cutover, P11.legacy) now require passing
`live.cutover` evidence. Missing, skipped, retried, or stale-source runs fail the
gate. Reporter and discovery tests include this tenth mandatory journey.

Rehearsal exposed and fixed missing canonical source initialization: the preserved
snapshot now joins the fresh draft and receipt in one transaction. Explicit asset
preparation supplies missing facts. Unrepresentable enchantments, legacy
marketplaces/tracked people, and midweek event transitions block preflight rather
than silently losing state. Passing this fixture does not authorize bypassing
those blockers for an affected production campaign.

Standards and Spec reviews used baseline `9ad1c8d` and the implementation diff.
The enhancement/event preservation findings were addressed with failing-preflight
regressions; the mapping helpers were split for reviewability. No review findings
remain open.

## Previous #88 review

Human rules review: **complete**, approved by **AndreasUnunger on 2026-09-23**.
The reviewer checked all behavior and completeness items, including COMPLETE.CORPUS
and REVIEW.SIGNOFF, then confirmed “done” in the review conversation. The record
and all decisions are in the [single-document checklist](militia-human-review-checklist.md#finish-the-review).
This does not approve production deployment or cutover.

## Review scope and decisions

The active catalog contains 487 behavior cases in 96 groups (95 original audit
groups plus the verification gate). The reviewer worked through the full rules,
tables, and product/persistence expectations. Codex classified the five source
headings against printed PDF pages 48–59 at the reviewer's request; page references
and behavior mappings are included in the same checklist.

The implemented review corrections are:

- Remove Adventure Path/volume tracking and volume-based rank limits; retain rank 20 and highest-PC-level limits.
- Preserve actions in unavailable slots but block weekly Confirmation until corrected; Rules Exceptions cannot bypass action capacity.
- Check recruitment capacity against the resulting Activity roster, allowing recruitment and dismissal in either order.
- Automatically use the highest applicable Ambassador/Marshal/Spymaster modifier.
- Apply Overseer support throughout one event occurrence; show “Strategist +2” on its bonus slot.
- Use the current manager throughout the draft and recompute all affected checks after reassignment.
- Run Upkeep for existing militia setup; only a newly founded militia receives the first-ever-week skip.
- Let any organization member choose a guaranteed event result without tracking chooser identity.
- Give Strike Team support a minimum duration of one round.
- Recompute all Activity checks/outcomes for Hidden Agenda, not just Drill and Earn Gold.
- Retain Market Day without existing settlements, while requiring a valid choice before resolution.
- Give organization members equal editing/correction access, including campaign setup; remove separate GM permissions.

Story-reward extra actions are deferred to [#98](https://github.com/AndreasUnunger/EverythingPath/issues/98).
Explicit old-version request rejection/reload enforcement was removed from the
cutover requirements because the reviewer confirmed no such requests will arrive.
Ordinary Theft remains a one-time loss; only its Twice result causes persistent
income reductions. Canonical ruleset version is 4.

## Operational gaps recorded at #88

At the end of #88, three catalog gaps remained, all assigned to [#89](https://github.com/AndreasUnunger/EverythingPath/issues/89):

| Case | Required rehearsal |
|---|---|
| E06.preserve | Preserve queued effects during the paused transition. |
| P11.cutover | Pause, initialize/restart, and recover without unintended rule execution. |
| P11.legacy | Prove compatible recovery before reopening; explicit old-version request rejection is out of scope. |

The strict completeness gate was **not ready** at #88. The #89 evidence above
now closes these three rehearsal gaps.
Production cutover is separately tracked by #90. No production changes were made
as part of this review.

## Code review

The Standards and Spec reviews used baseline `53ff924` and the current worktree.
The Spec review identified the existing-militia Upkeep skip still being accepted
by setup. That was corrected in both the setup form and authoritative preparation,
then re-reviewed. The deeper review of slot capacity, same-week roster changes,
Overseer event support and setup found no remaining concrete defects.

The Standards review found no documented violations. Its naming cleanup is now
resolved: the helper is `getManipulateEventsChoiceText`, the view-model field is
`manipulateEventsChoiceText`, and the unused `teams` parameter has been removed
from the helper and its callers. The follow-up passes typecheck, lint, and all
1,003 tests across 106 files; it changes no behavior.

## Previous #88 verification

The full acceptance/browser evidence below was verified on 2026-09-23 for commit
`1d5329b`, before the naming-only follow-up described above. Its fingerprint is a
record of that commit, not a fresh browser/strict-gate result for the follow-up.
The follow-up was verified separately with typecheck, lint, and the full test suite.

Baseline results:

- Typecheck and lint pass; all three build-boundary tests pass.
- All 1,003 tests across 106 files pass, with no skipped or pending results.
- All nine isolated browser results pass on their first attempts in the final run,
  including authenticated persistence/Confirmation and two-player Workspace journeys.
- The catalog has 487 cases; 486 have passing mapped evidence. The three explicit
  gaps above remain. Some partially covered cases retain a gap for their missing
  rehearsal, so covered cases and gaps are not mutually exclusive counts.
- No missing test identifiers, stale source fingerprints, or browser/service evidence
  errors remain. The sole strict error is `Completeness gate: 3 remaining gaps`.

Source fingerprint: `273197fe4744b457f192465225d1eb0120f16520e8de99e90f4d569294085e6d`.

Final browser evidence: `e2e-artifacts/e2e-local-andreasununger-slot-0/everythingpath-e2e-YbAt68/report.json`.

The earlier browser run exposed a setup journey still expecting a resumed militia
to skip Upkeep; it now enters and verifies actual Upkeep rolls. A separate CLI
fixture failure had no matching server execution in the preview logs and did not
recur in either subsequent passing run. The first catalog check also exposed
quoted generated Hidden Agenda test names; those now use explicit stable IDs,
and the final report verifies all mappings.

The shared browser-build/Convex matrix covers 131 complete weeks, comparing Phase
Views, full previews, authenticated Confirmation, immutable records and successor
state. The isolated browser run additionally exercises the deployed service and
multiplayer Workspace. Pure tests cover detailed rule permutations.

Reproduce with the declared disposable preview resources:

```bash
E2E_TRUSTED_EXECUTION=true pnpm -s test:e2e --resources e2e/.private/resources.json --secrets e2e/.private/test-secrets.env
VITEST_MAX_WORKERS=2 pnpm -s acceptance:check --browser-report /absolute/path/to/new/report.json
```

`coverage/acceptance.json`, `coverage/rules-evidence.json`,
`coverage/rules-tests.json`, and `coverage/rules-report.md` record the outcome.
At #88 the acceptance command exited 1 for those operational gaps. With the
current source and fresh #89 browser evidence, it passes.

The [generated coverage report](weekly-draft-acceptance-review.md) provides case,
source and evidence details. The [checklist](militia-human-review-checklist.md)
remains the single human review document.
