# Inherited notice review: #292

Reviewed 2026-10-09 by **Sol (AI curator) for the owner**, following [#264](inherited-notices-264.md). [Ticket #292](https://github.com/AndreasUnunger/EverythingPath/issues/292), blocks 421–435, contains **15 physical occurrences, 13 unique source identities, 12 complete notices and one editorial heading**, in `pf1-content/OGL.txt` lines **458–472**. This batch adds **zero content admissions**.

## Dispositions and provenance

Every key below has prefix `pf1-content/notice/`. The 12 complete notices are reviewed at compilation level with complete-chain holds. The heading is retained as provenance and held; it receives no Registry record or alias.

| Occurrence | Immutable trimmed hash | Physical line | Source block | Disposition |
| --- | --- | --- | --- | --- |
| 1 | `3f20b6685a199c5e42978efe6d2e154ecba6ed9a36bc40cc1218d27ca368b3c6` | 458 | Tick, Dragon from the Tome of Horrors, Revised | Reviewed; complete chain held |
| 2 | `5099ab03af8698938e554f419c83085936eb2f8f236fb57816dce25558fe9d12` | 459 | Tick, Giant from the Tome of Horrors Complete | Reviewed; complete chain held |
| 3 | `5099ab03af8698938e554f419c83085936eb2f8f236fb57816dce25558fe9d12` | 460 | Tick, Giant from the Tome of Horrors Complete | Trimmed duplicate of 2; same hold |
| 4 | `3fec1b4b98a312c11d96c87f234932981820e7117dada5409c4c30516eb4cc23` | 461 | Tome of Horrors 4 editorial heading | Retained editorial heading; held |
| 5 | `762321ebedf061dc040d27758fba3d8337a5ea676ce61618ec97473b16010966` | 462 | Tome of Horrors 4 | Reviewed; complete chain held |
| 6 | `fa53c4190ecd44ca012545354eed4300dcd53cc7b0414a0303ba84a7d713d0eb` | 463 | Tome of Horrors Complete | Reviewed; complete chain held |
| 7 | `8250acbdc7582ec66a9972525a7c9cc2a936bff0688f144c6a516adf4c328edc` | 464 | Tome of Horrors II | Reviewed; complete chain held |
| 8 | `609c42b15be79b37d227e3106bcf449f7d24a84e1a9c2c8903f2249f20d2969b` | 465 | Tome of Horrors II | Reviewed; complete chain held |
| 9 | `8bc9ef89c4d22fad3fc55493bcfbe30f47deb69929853d77b1ac914324cdea67` | 466 | Tome of Horrors III | Reviewed; complete chain held |
| 10 | `c40240b5fda8b0c40e7a9eb43217eeabcd1547724a031ffb6cee12471430a9e6` | 467 | Tome of Horrors III | Reviewed; complete chain held |
| 11 | `ff59953fb3405de4e888747ea4cfb6237451f7dc2f176ed43be039ff197841d5` | 468 | Tome of Horrors, Revised | Reviewed; complete chain held |
| 12 | `8885664a1499b13a20ef5eda6e4979fda54fce11521a41d5281190572d90be17` | 469 | Tome of Horrors | Reviewed; complete chain held |
| 13 | `fa3b3ce21467fa1533b3a7548dc8272b26873d1381cf5eccd8ea368229a9f6f2` | 470 | Trapper from the Tome of Horrors Complete | Reviewed; complete chain held |
| 14 | `f7220b4898a767e195e13f7441daef458a89e4e805daa6f827aa6248776d2ab4` | 471 | Troll, Ice from the Tome of Horrors Complete | Reviewed; complete chain held |
| 15 | `f7220b4898a767e195e13f7441daef458a89e4e805daa6f827aa6248776d2ab4` | 472 | Troll, Ice from the Tome of Horrors Complete | Trimmed duplicate of 14; same hold |

The [batch inventory](../../scripts/catalog/legal/inherited-notices-292.json) preserves every raw physical-line hash and trimmed identity. Tick, Giant 459/460 and Troll, Ice 471/472 differ only by a trailing space. Tick, Dragon 458 also has a trailing space. The [Registry](../../src/lib/catalog/data/section15-registry.json) stores trimmed notices; all 12 hash to their keys. Inner whitespace, punctuation, author spelling and dates remain literal. No wrapped fragments require joining.

Line 461 is an editorial heading claiming the following Tome of Horrors 4 notice was not printed and came from Greg Vaughan. That claim has no independent evidence. Its literal text, hash and location are provenance on line 462's Registry record, without being appended to its copyright notice. The full upstream block continues to preserve the heading. Requiring the heading identity reports a missing notice and holds admission.

## Evidence, discrepancies and holds

Primary evidence is `pf1-content` 11.4.0 at commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`, [OGL.txt lines 458–472](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d/OGL.txt#L458), file SHA-256 `10bcdc68296b48cc250f38e49de09c9a73645163d7ac7f76e77346a755c35cdc`. System comparison uses v11.11 at `418761d2e16a6037c0156bb4a241f7cea5a2986d`, [OGL.txt](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/OGL.txt), file SHA-256 `0464e2f13f24c742dc3c2a4c788aab9ab24ca9809873192551b77f784a50d7f9`. None of the batch identities occurs there. Both checkouts match their exact pins, are clean and have zero writable entries.

PCGen comparisons use commit `25523dbcf10e86c280fc0f447167ea43d67419d3`: [Bestiary 2 lines 88–89](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/bestiary_2/bestiary_2.pcc#L88) combines Giant & Dragon under Revised 2002 and gives Troll, Ice Revised 2002; pf1-content distinguishes Dragon Revised 2002 from Giant Complete 2011 and gives Troll, Ice Complete 2011. Contributor names agree, while edition/copyright/punctuation differ. The [Revised dataset line 19](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/35e/necromancer_games/the_tome_of_horrors_revised/tome_of_horrors.pcc#L19) supplies only a short title/copyright/publisher line, without these author lists. File hashes, selected literal lines and mappings are recorded in the inventory. The inspected complete PCGen tree has one Tome-of-Horrors-named PCC path (Revised); selected Bestiary 6 has no matching notice. Neither search establishes a complete chain or absence from every PCGen file.

The [Paizo PRD licence page](https://paizo.com/pathfinderRPG/prd/openGameLicense.html) returned HTTP 403. No book PDFs are available. No AoN evidence was used. Missing book/complete-chain evidence and the original statement behind the editorial claim remain named holds.

Tome of Horrors II punctuation variants remain separate. III's `Johnston`/`Johnson`, `Lawinger`/`Lawringer`, publisher and author punctuation differ. Revised and unsuffixed 2002 notices have different contributor order and spellings. Tome of Horrors 4 is not equated to either Tome of Horrors IV variant already held by #291. No correction, alias, product code or coverage claim is inferred.

[#224](https://github.com/AndreasUnunger/EverythingPath/issues/224#issuecomment-5939689134), [#227](https://github.com/AndreasUnunger/EverythingPath/issues/227#issuecomment-5948780647), superseding [#241](https://github.com/AndreasUnunger/EverythingPath/issues/241#issuecomment-5955002698) and [PRD #251 decision 17/acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461) govern the review. All **13** holds (`notice-292-complete-chain-<hash>` for notices, `notice-292-editorial-heading-<hash>` for the heading) are registered in [held-notices.json](../../scripts/catalog/legal/held-notices.json). No existing assessment requires these keys, so no admitted content needs rebinding. No retained exception or legal-sufficiency conclusion is established.

All **410 prior Registry records and 1,309 prior holds** remain equal by value: totals **422 records and 1,322 holds**. Attribution Assessments, attribution evidence, Curation Overlay, resources and permanent notices stay unchanged; no earlier hold clears. Structured `candidates: []` records this notice-only scope without inventing content dependencies. All 36 existing advisory source hashes and cited term lines were independently rechecked: Toughness's ordinary stamina and Apotheosis's narrative mythic are false positives; the other leads remain for their owning held-content audits. Explorer's heading spans raw lines 21–22. **#333–#336/#516–#519 inherited-rule audits remain outstanding.**

## Verification

Checks run sequentially with `CI=true`, the launcher's external `.ep-tmp/` TMPDIR and unchanged 8 GiB lint scope/rules. No full suite, deployment, activation or remote write.

```sh
PF1_CURATION_SYSTEM="$HOME/repos/everythingpath/sources/foundryvtt-pathfinder1"
PF1_CURATION_CONTENT="$HOME/repos/everythingpath/sources/pf1-content"
PF1_CURATION_SCRATCH=.scratch/curation-292-20261009-0105
export CI=true
# Preserve the launcher TMPDIR under the repository parent's .ep-tmp/.
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm catalog:format --check
pnpm catalog:notice-deps
pnpm catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out "$PF1_CURATION_SCRATCH/drafts"
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out "$PF1_CURATION_SCRATCH/preview"
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --curation "$PF1_CURATION_SCRATCH/drafts/records.json" --out "$PF1_CURATION_SCRATCH/preview-drafts"
pnpm test tests/catalog --maxWorkers=1
pnpm test convex/inheritedNotices288.integration.test.ts convex/catalogRelease.integration.test.ts --maxWorkers=1
```

The [21 focused tests](../../tests/catalog/inherited-notices-292.test.ts) independently pin all occurrences and identities, distinguish the heading, preserve frozen original Registry values while permitting additive records, enforce complete-chain holds, require separate content evidence, retain the legal superset and reconstruct the complete Registry through the unchanged **512,000-byte** bounded transport. Published CRB Lightning Reflexes and its landed evidence provide test-only additional-notice probes, conveying no attribution on these books. Initial preflight passed **25 tests in two files** after correcting a test index that included the heading in the notice array; no product/tool bug or data correction was involved.

| Check | Exit | Result | Seconds |
| --- | --- | --- | --- |
| `typecheck` | 0 | Pass | 22.85 |
| `lint` | 0 | Pass; unchanged 8 GiB scopes/rules and unused-code check | 129.98 |
| `writers` | 0 | Pass; 183 registrations | 0.8 |
| `pin` | 0 | Pass; sha256:d7a42ca346d875f9497c7da94325022ac289d7931226a3649979a13f410c8063 | 0.28 |
| `format` | 0 | Canonical data passes | 0.54 |
| `notice-deps` | 0 | 5,610 dependencies; 2,802 candidates; 37 inventories; no gaps/waivers/stale; 36 existing advisories | 1.07 |
| `curate` | 0 | 6,203 records; 3,583 new drafts; no replacements/missing/stale/unused; 758 unresolved mechanics; 1,464 unresolved descriptions; coverage incomplete | 179.53 |
| `preview` | 1 | Expected gate failure: 60 admitted; 23,194 held; 2 dependent omissions; 0 retained exceptions; 4,689 failures; no outstanding notices/resources | 202.41 |
| `preview-drafts` | 1 | Expected gate failure: same admissions/holds/omissions; 1,864 failures; no outstanding notices/resources | 206.32 |
| `catalog-tests` | 0 | 85 files; 1,932 tests passed | 287.16 |
| `release-backend` | 0 | 2 files; 30 tests passed | 5.02 |

Replaying both previews' **complete admission gate results**, including every failure, against the pre-batch Registry yields **exact equality** with the post-batch Registry and each generated report. All 60 global admissions precede this batch; this review adds zero. Default failures include 3,583 missing curation records plus 1,106 inventory/reference failures; drafts replace the missing-record failures with 758 unresolved mechanics. Optional unresolved descriptions remain outside the required gate.

The complete **422-record Registry**, **570,472 canonical bytes**, reconstructs byte-for-byte through **9 chunks in 2 batches**, encoded at **463,508 and 124,874 bytes**, below the unchanged **512,000-byte** cap. Backend tests verify complete public legal readback and rendering, plus legacy single-row compatibility. The batch page has **4 legal sections and 15 notices**: 12 Registry notices, both upstream blocks and the project notice. The heading remains in the inherited upstream block without becoming a standalone notice.

A clean fixture copy includes **only 107 tracked files**, including `.gitkeep` markers. Its complete import result equals the ordinary fixture result, including **100 Catalog Entries** and all comparison/curation records. This verifies the published CRB fixture used by the batch without untracked directories or files. No fixtures, historical assertions, test budgets, transport limits or lint scopes were changed. The final audit compares all 410 prior Registry values and 1,309 prior holds by identity; none differs or clears. `git diff --check` passes and no tracked deletions remain.


## Timing and workflow

Approximate UTC phases on 2026-10-09: briefing/policy/source and permitted comparison review **01:04–01:06 (2 minutes)**; Registry/evidence/focused-test preparation **01:06–01:08:20 (2.3 minutes)**; sequential verification beginning **01:08:20 (17.3 minutes measured)**; report drafting and preservation audit overlap verification, followed by the final replay/portable fixture check and scratch cleanup (**about 2 minutes active work**). Final replay and preservation audit finished around **01:27 UTC**; overall elapsed time is approximately **23 minutes**. Phase windows overlap and are not additive.

Notice inventories cannot use the content `--candidates` selector, so full-corpus gates dominate small reviews. PRD 403, absent books, contributor/edition variants and editorial source claims need durable holds. The Registry's reviewer remains in provenance. Prior content dependency audits remain required before their holds can clear. The existing lossless transport and tracked empty-directory markers support this batch without cap, lint or fixture changes. Vitest reported one existing feat review at 8.6 seconds of its 15-second timeout (58%); no test timed out and no budget was changed.

Five changed files: this report, batch evidence, Registry additions, hold registrations and focused tests. No product/tooling changes. Artifacts remain uncommitted. Only the task-owned scratch subdirectory is removed; other scratch sessions, environment/private material and pinned sources remain untouched. The orchestrator captures the final answer outside the repository.
