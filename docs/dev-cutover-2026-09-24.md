# Dev cutover — 24 September 2026

Authorized scope: `dev:acoustic-trout-328`, both existing campaigns.
Production is deferred. Procedure: [operational cutover](operational-cutover.md).

## Preservation decisions

The user identified these campaigns as test data, confirmed Hit Dice equals
character level, and authorized defaults when missing facts cannot remain empty.

| Campaign | Preserved week | Week start day | Commandant Hit Dice |
| --- | --- | --- | --- |
| Name | 14 | 91 | Greger: 5 |
| groundbreaking new campaign | 4 | 21 | BonkBonk: 1 |

The day defaults use day 0 for week 1. All other characters' Hit Dice likewise use
recorded level. Character records, abilities, officer assignments, team conditions,
settlements, treasury and current weeks are preserved without retrospective rules
corrections. The existing +2 and +5 queued loyalty modifiers remain separate.
Week of Pain preserves all three -1 checks and double Upkeep loss.

- The hidden Weapons cache retains location `phaendar`, description `gun`, class
  `intermediate` and its recorded security/status. Its structured item list stays
  empty; no unrecorded weapon statistics are invented.
- The delivered `test` order requires an item reference. It maps to one test item,
  value 0 copper, weight 0, location `held`. Its purchase cost defaults to 0 copper;
  original description and notes remain in the retained legacy source. Ordered
  day is 84, due/received day is 91, delivery remains seven days and Activity week
  14. No enchantment or expedited delivery is assumed.
- The existing `market` preserves Broker Market source, weeks 13–14, small-town
  availability, 75% availability, 50% sale value and no contraband. Missing market
  and order settlement references use the recorded settlement `BRF Grottan`.
- Missing settlement occupation remains unknown. Teams retain individual stable
  identities, recorded conditions and managers; no reward exemption is assumed.

Canonical initialization starts the current week with empty draft choices and no
canonical history. Original legacy records, notes and history remain stored.
Private preparation files and full source tokens live beside the retained backup,
not in Git.

## Verification

Completed: both campaigns are active on the canonical board. Production was not
changed. No real campaign week was confirmed or advanced as a test.

- Operation: `dev-acoustic-trout-328-2026-09-24`.
- Paused: `2026-09-24T17:26:18+00:00`; reopened: `2026-09-24T17:28:38+00:00`.
- Accepted source: `ce070160a634a3cb8b6eb2383feff593d19318c98fde1bcd7c32452d2ebf9042`.
- Strict acceptance passed: typecheck, lint, build-boundary checks, 1,014 tests
  across 107 files, 10 browser journeys, 487 covered rules, zero gaps/errors.
- Browser evidence: `e2e-artifacts/e2e-local-andreasununger-slot-0/everythingpath-e2e-q7SsfG/report.json`.
- The paused backup was restored to `cutover-recovery-7d9fa17d805d`,
  re-exported, and compared: all 3,265 documents across 40 tables matched;
  there were no stored files.
- Both mappings passed preflight on that restored snapshot. Initialization and
  identical retries succeeded on both the recovery preview and dev. Dev source
  tokens, snapshots and week facts matched the preview exactly.
- Before reopening, all 86 legacy campaign documents across 15 tables were
  compared with the paused backup and were unchanged. Canonical verification
  proved one empty open draft per campaign, the preserved current weeks, and no
  canonical history.
- After reopening, ordinary authenticated workspace and ledger queries returned
  the expected snapshots, weeks 14/4 and treasuries 81,400/16,000 copper. Legacy
  write rejection was checked both during the pause and after reopening.
- Compatible recovery workflow: legacy baseline `2e10072` with the candidate's
  pause guard and legacy routing. Recovery was unnecessary on dev.

## Backup retention

Backup: `e2e/.private/dev-cutover-2026-09-24/paused-backup.zip` (private, ignored
by Git). The directory also retains preparation, restore comparison, initialization
retry, smoke-test and acceptance evidence.

SHA-256: `07c28c9ee1b36a8a8e95eee3eedf76895ff9fb38c41f004dbc0c801bb2c55821`.

Retain through **2026-10-08T17:26:57+00:00**. The recovery preview is
also retained in paused state. Reopening has ended automatic rollback; preserve
any newly accepted work when handling later problems.

## Standards review

No outstanding documented-standard violations. The nonblocking complexity
heuristic in the preservation verifier remains a readability suggestion.

## Spec review

No outstanding findings. The preview exercised the maintenance message, activation
reload, canonical board, ledger correction form, confirmation and recovery.

Review totals: zero blocking findings on either axis; one nonblocking Standards
heuristic.
