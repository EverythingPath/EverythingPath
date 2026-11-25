# Inherited notice review: #290

Reviewed 2026-10-09 by **Sol (AI curator) for the owner**, following [#264](inherited-notices-264.md). [Ticket #290](https://github.com/AndreasUnunger/EverythingPath/issues/290) lists blocks 391–405: **15 physical occurrences, 13 unique immutable notice keys**, at `pf1-content/OGL.txt` lines **428–442**. This batch establishes notice evidence; **zero new content admissions**, no content assessment changes, and no legal-sufficiency conclusion.

## Dispositions

Every unique key is reviewed verbatim with a named, enforced complete-chain hold. All occurrences are complete individual notices: no headings, wrapped fragments or joins. Hashes below have prefix `pf1-content/notice/`.

| Occurrence | Immutable hash | Physical line | Notice title | Disposition |
| --- | --- | --- | --- | --- |
| 1 | `d372bb944c1231880e4a050fb162d2563dd281e84e7cd4ed8a4a4ce1c7c0d157` | 428 | Poltergeist from the Tome of Horrors, Revised | Reviewed; chain held |
| 2 | `119947abaacee5f22cd3ad5108a67925522f171c47912101f3450e505bc53ebd` | 429 | Psionic Al-mi'raj from the Tome of Horrors Complete | Reviewed; chain held |
| 3 | `77a70acfe1a9126dd48b416e4a3ac30b1a0af5fb1d20701ea443958360c4d92e` | 430 | Quickling from the Tome of Horrors Complete | Reviewed; chain held |
| 4 | `308e21e6ac3cfe6ce8e3ab7bc9e3916a7994dd809eb2e5b256041578bf73c511` | 431 | Quickwood from the Tome of Horrors Complete | Reviewed; chain held |
| 5 | `40b63185e65171ba11912c82f49ec9ea5c1d24bc661d16e484c22f03db21d10e` | 432 | Rise of the Runelords Player’s Guide | Reviewed; chain held |
| 6 | `f1e4e5ced5a5abed7e2deb06b90766f9f64b48bc70be8b35b74eda66233cf630` | 433 | Rot Grub from the Tome of Horrors Complete | Reviewed; chain held |
| 7 | `f1e4e5ced5a5abed7e2deb06b90766f9f64b48bc70be8b35b74eda66233cf630` | 434 | Rot Grub from the Tome of Horrors Complete | Trimmed duplicate of occurrence 6; same hold |
| 8 | `791078494ee21719d750c4caa1020f44483d8a552c53db42ab9fa796b8c6d80e` | 435 | Russet Mold from the Tome of Horrors Complete | Reviewed; chain held |
| 9 | `791078494ee21719d750c4caa1020f44483d8a552c53db42ab9fa796b8c6d80e` | 436 | Russet Mold from the Tome of Horrors Complete | Trimmed duplicate of occurrence 8; same hold |
| 10 | `63535a903f0c88f6403203cdd19bfe3ee4335857dd659c1b712d56de90aed88f` | 437 | Russet Mold from the Tome of Horrors | Reviewed; chain held |
| 11 | `e70c90aed86b648038569379ac890dc390bd8e60153d983944ffbae9d4c65cb2` | 438 | Sandman from the Tome of Horrors Complete | Reviewed; chain held |
| 12 | `d7fd805977809ce6946d9b6a9cdca8e5da2862fe21f5c033de7581cb28c950f8` | 439 | Scarecrow from the Tome of Horrors Complete | Reviewed; chain held |
| 13 | `d34b08447933a467ee083597adbfc8b663c0020591b767a13574b5edca2da765` | 440 | Shadow Demon from the Tome of Horrors Revised | Reviewed; chain held |
| 14 | `35ff017de27eeaea7850bf8437e0957be682c94ed99500195836ef5ae179982d` | 441 | Shadow Demon from the Tome of Horrors | Reviewed; chain held |
| 15 | `00d6fbd3d461b84bb671b61d787676273c5b495688202c7b8f71ee7e09c731bf` | 442 | Sinobian from Tome of Horrors II | Reviewed; chain held |

Rot Grub lines 433/434 and Russet Mold lines 435/436 differ only by one trailing space. Each pair shares its ticket's trimmed key and one Registry record. Both source locations and raw-line hashes are preserved. Line 434 raw SHA-256 is `6759a343d951621147b0678f95ddb8300719c08d51c8a21ae3827a5022acb341`; line 436 is `52b5b38b2c1711a0c8f54d52822afc087b13f9f4282080e66c25ab701ea562e1`. Neither raw hash gets a new record or alias. Stored notice SHA-256 equals the immutable key; internal whitespace, apostrophes and punctuation stay literal.

## Evidence and unresolved variants

[Batch evidence](../../scripts/catalog/legal/inherited-notices-290.json) records all occurrences, raw/trimmed hashes, exact pins/file hashes, reviewer/date, selected comparison snapshots and holds. The [Registry](../../src/lib/catalog/data/section15-registry.json) carries trimmed text and compact provenance pointers.

- Primary: `pf1-content` 11.4.0 at `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`, [OGL.txt lines 428–442](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d/OGL.txt#L428), file SHA-256 `10bcdc68296b48cc250f38e49de09c9a73645163d7ac7f76e77346a755c35cdc`.
- System comparison: v11.11 at `418761d2e16a6037c0156bb4a241f7cea5a2986d`, [OGL.txt](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/OGL.txt), file SHA-256 `0464e2f13f24c742dc3c2a4c788aab9ab24ca9809873192551b77f784a50d7f9`. None of the batch notices appears there. Both clean pinned checkouts have zero writable files.
- PCGen comparison at `25523dbcf10e86c280fc0f447167ea43d67419d3`: [Bestiary 2 lines 76–80](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/bestiary_2/bestiary_2.pcc#L76), [Bestiary 3 line 66](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/bestiary_3/bestiary_3.pcc#L66), [Bestiary 6 lines 43, 50–51](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/bestiary_6/_bestiary_6.pcc#L43), [2007 Runelords guide line 30](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/35e/paizo/adventure_path/rise_of_the_runelords/rise_of_the_runelords_players_guide/rise_of_the_runelords_players_guide.pcc#L30), and [2012 Anniversary Edition line 31](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/adventure_path/rise_of_the_runelords/players_guide_ae/rise_of_the_runelords_players_guide_ae.pcc#L31). Exact file hashes and selected copyright-line snapshots are recorded; selections do not purport to reproduce complete chains.
- The [Paizo PRD licence page](https://paizo.com/pathfinderRPG/prd/openGameLicense.html) returned HTTP 403. No available PRD comparison is claimed. No book PDFs are available; no AoN evidence was used.

Poltergeist Revised (2002) stays separate from #289 Complete (2011). PCGen's Quickling, Quickwood, Sandman, Scarecrow and Rot Grub Revised (2002) do not replace Complete (2011). Russet Mold Complete and the 2002 notice remain separate. Shadow Demon Revised lists Scott Greene **and Clark Peterson**, whereas the other 2002 notice lists Scott Greene alone; neither is equated with #267 Demon, Shadow Complete. The literal `Revised.©` remains. Russet Mold/Scarecrow match individual lines in the owner's Bestiary 6 transcription, but that seed remains unreviewed. Runelords 2007 uses a curly apostrophe here and a straight one in PCGen; the 2012 Anniversary Edition has different authors/title/date. No aliases or product-code mappings are invented and no discrepancy requires rebinding admitted content.

## Holds and dependency boundary

[#224](https://github.com/AndreasUnunger/EverythingPath/issues/224#issuecomment-5939689134), [#227](https://github.com/AndreasUnunger/EverythingPath/issues/227#issuecomment-5948780647), superseding [#241](https://github.com/AndreasUnunger/EverythingPath/issues/241#issuecomment-5955002698), and [PRD #251 decision 17 and acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461) govern the evidence/admission boundary.

Each of the **13** `notice-290-complete-chain-<hash>` holds is registered in [held-notices.json](../../scripts/catalog/legal/held-notices.json). Missing evidence is the complete book/inherited-rule notice chain and resolution of conflicting variants/aliases using permitted evidence; unavailable printed verification remains a named hold. Reviewing individual compilation notices does not lift those holds.

All **385 prior Registry records** and **1,185 prior hold registrations** remain equal by value: totals are **398 records and 1,198 holds**. Attribution Assessments, evidence, Curation Overlay, resources and permanent notices are unchanged. No earlier hold or retained exception clears; no actual retained-use inventory was provided.

This notice-only batch has `candidates: []`, so introduces no content inherited-rule dependencies or speculative `requiredNotices`. Existing structured fields remain enforced by `catalog:notice-deps`. Its 36 existing advisories are recorded with source paths/hashes/term locations and prior hold IDs. Toughness's ordinary stamina and Apotheosis's narrative mythic divination are false positives for those rule dependencies. Explorer's Completion Benefit spans lines 21–22. Linnorm Style is a prerequisite in Linnorm Wrath; its benefit's Linnorm Vengeance use remains for the held full-content audit. Other terms remain earlier content-review leads, not complete-origin findings. **#333–#336/#516–#519 inherited-rule audits remain outstanding**; this batch neither completes them nor clears their holds.

## Verification

All checks run sequentially with `CI=true`, the launcher's external `.ep-tmp/` TMPDIR, unchanged 8 GiB standard lint budget, and exact upstream paths above. Only the task-owned scratch subdirectory is removed after reporting. No full test suite, deployment, activation or Git/GitHub write is performed.

The [22 focused tests](../../tests/catalog/inherited-notices-290.test.ts) verify independent ticket hashes and all physical occurrences, both raw duplicate hashes, frozen original seed identities, literal variants, comparisons/advisories, legal-page generation and permanent retention, separate content-assessment requirements, every enforced hold, unaffected CRB admission, missing/unreviewed notice behavior, and full current Registry reconstruction through the unchanged bounded builder. The batch legal page has four sections, **16** Section 15 notices (13 Registry notices, both upstream blocks and the project notice), and no outstanding notice/resource for these exact keys. CRB Lightning Reflexes uses published fixture/evidence for test-only extra-notice gate probes; this grants no attribution to these books.

```sh
PF1_CURATION_SYSTEM="$HOME/repos/everythingpath/sources/foundryvtt-pathfinder1"
PF1_CURATION_CONTENT="$HOME/repos/everythingpath/sources/pf1-content"
PF1_CURATION_SCRATCH=.scratch/curation-290-20261009
export CI=true
# Keep the launcher's TMPDIR under the repository parent's .ep-tmp/.
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

| Check | Exit | Result | Seconds |
| --- | --- | --- | --- |
| `typecheck` | 0 | Pass | 14.88 |
| `lint` | 0 | Pass, unchanged 8 GiB ESLint scopes/rules and unused-code check | 128.74 |
| `writers` | 0 | 183 registrations checked | 0.81 |
| `pin` | 0 | sha256:d7a42ca346d875f9497c7da94325022ac289d7931226a3649979a13f410c8063 | 0.26 |
| `format` | 0 | Canonical data passes | 0.58 |
| `notice-deps` | 0 | 4,865 dependencies; 2,602 candidates; 33 inventories; 0 gaps/waivers/stale; 36 existing advisories | 0.9 |
| `curate` | 0 | 6,003 records; 3,583 new drafts; 0 replacements/missing; 758 unresolved mechanics; coverage incomplete | 169.47 |
| `preview` | 1 | Expected gate failure: 59 admitted, 23,195 held, 2 omissions, 0 retained exceptions; 4,689 failures; no outstanding legal resources/notices | 227.46 |
| `preview-drafts` | 1 | Expected gate failure: same admission/hold/omission counts; 1,864 failures; no outstanding legal resources/notices | 206.97 |
| `catalog-tests` | 0 | 1,832 tests, 80 files, including all 22 batch tests | 231.58 |
| `release-backend` | 0 | 30 tests, 2 files, including public lossless Registry readback and legacy compatibility | 5.6 |
| Focused batch + hold preflight | 0 | 26 tests, 2 files | 3.57 |
| Admission/Registry replay | 0 | Entire admission result equal before/after; 398 records, 545,269 canonical Registry bytes, 9 chunks, 2 valid bounded batches, lossless | — |
| Final preservation and whitespace audit | 0 | Every earlier Registry/hold value and other shared-data file unchanged; no tracked deletions | — |

The replay compares the **complete admission result**, including all 4,689 default-preview failures, against the pre-batch Registry on the same extracted corpus: exact equality. Thus the global 59 admissions are prior work, and this batch adds **zero**. The current Registry is reconstructed byte-for-byte in nine chunks across two unchanged bounded batches (463,520 and 98,819 encoded batch bytes). The catalog run reports one existing duration advisory: #344 takes 7,548 ms of its unchanged 15,000 ms CI test budget; no timeout or assertion was changed.

The existing backend release tests additionally prove the complete current Registry through bounded private preparation and public legal-input readback, legacy single-row compatibility, rejected malformed/changing chunk commitments, and successful unchanged retry. No product or tooling code changes are needed.

## Timing and workflow

UTC phases: briefing/policy/frontier/source-pin review on 2026-10-08, approximately 23:45:45–23:47:10 (1.4 minutes); permitted comparisons, artifacts and focused test 23:47:10–23:49:44 (2.6 minutes); sequential required checks 23:49:44–2026-10-09 00:06:11 (16.5 minutes); report drafting during checks (about 1.5 minutes, overlapping); final admission/Registry replay, preservation audit, reporting and cleanup (about 1 minute). Reviewer date is 2026-10-09 in Europe/Stockholm.

Scaling concerns: the existing `--candidates` selector scopes content keys, not this notice-block inventory; required full-corpus gates dominate a 15-occurrence review. Registry reviewer identity lives in provenance rather than a dedicated schema field. PRD 403 and unavailable books leave named evidence gaps. Earlier prose-only dependencies need their required content audits before hard enforcement can cover them. Frozen-original preservation assertions tolerate future additive batches; the existing lossless Registry transport handles this batch without altered caps or lint scope.

Five changed files: this report, batch evidence, Registry additions, hold registrations and the focused test. Changes are uncommitted; source and environment/private material remain untouched. The orchestrator captures the final answer outside the repository.
