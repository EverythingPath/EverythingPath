# Inherited notice review: #269

Reviewed by **Sol (AI curator) for the owner** on **2026-10-07**. [Ticket #269](https://github.com/AndreasUnunger/EverythingPath/issues/269) lists fifteen occurrences of fourteen distinct immutable keys. This batch establishes compilation-level notice evidence; it does not establish content attribution or legal sufficiency. Review and implementation finished before midnight in Europe/Stockholm; verification continued on October 8 locally.

The [batch inventory](../../scripts/catalog/legal/inherited-notices-269.json) records each full key, physical source line, hash, disposition, comparison and hold. The [Section 15 Registry](../../src/lib/catalog/data/section15-registry.json) retains verbatim text and reviewer/date provenance. Every block is a complete physical notice line. No headings or wrapped fragments need joining; aliases and `joinedWith` lists are empty.

| Occurrence | Hash prefix | Line | Notice | Copyright date | Disposition |
| --- | --- | --- | --- | --- | --- |
| 1 | `da43f7ee` | 113 | GameMastery Module D3: The Demon Within | 2008 | Reviewed; chain held |
| 2 | `1dc3043a` | 114 | GameMastery Module E1: Carnival of Tears | 2007 | Reviewed; chain held |
| 3 | `e8e581b3` | 115 | GameMastery Module J1: Entombed with the Pharaohs | 2007 | Reviewed; chain held |
| 4 | `06cc1b7c` | 116 | GameMastery Module J2: Guardians of Dragonfall | 2007 | Reviewed; chain held |
| 5 | `72f6dcdc` | 117 | GameMastery Module J3: Crucible of Chaos | 2008 | Reviewed; chain held |
| 6 | `c9b74fa7` | 118 | GameMastery Module TC1: Into the Haunted Forest | 2007 | Reviewed; chain held |
| 7 | `0027ac7a` | 119 | GameMastery Module U1: Gallery of Evil | 2007 | Reviewed; chain held |
| 8 | `fd365207` | 120 | GameMastery Module U2: Hangman’s Noose | 2008 | Reviewed; chain held |
| 9 | `ed1eb5ec` | 121 | GameMastery Module W1: Conquest Of Bloodsworn Vale | 2007 | Reviewed; chain held |
| 10 | `a0a095b8` | 122 | GameMastery Module W2: River Into Darkness | 2008 | Reviewed; chain held |
| 11 | `4aeeee43` | 123 | Genie, Marid, Tome of Horrors Complete | 2011 | Reviewed; chain held |
| 12 | `5ad2a5d6` | 124 | Geon, Tome of Horrors Complete | 2011 | Reviewed; chain held |
| 13 | `ebc202ff` | 125 | Giant Slug, Tome of Horrors | 2002 | Reviewed; chain held |
| 14 | `ebc202ff` | 125 | Giant Slug, Tome of Horrors | 2002 | Duplicate of occurrence 13; same record and hold |
| 15 | `36f8b50b` | 127 | Giant Slug, Tome of Horrors, comma variant | 2002 | Reviewed separately; chain held |

## Evidence and holds

Source evidence is [pf1-content 11.4.0 OGL.txt, lines 113–127](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d/OGL.txt#L113), commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`, complete-file SHA-256 `10bcdc68296b48cc250f38e49de09c9a73645163d7ac7f76e77346a755c35cdc`. The companion system checkout is `v11.11`, commit `418761d2e16a6037c0156bb4a241f7cea5a2986d`, OGL file SHA-256 `0464e2f13f24c742dc3c2a4c788aab9ab24ca9809873192551b77f784a50d7f9`. Independent checks verify both commits/file hashes and every reviewed line against the read-only checkouts. Immutable keys hash the complete UTF-8 physical line without its line ending, with no trimming or normalization.

[#224](https://github.com/AndreasUnunger/EverythingPath/issues/224#issuecomment-5939689134) identifies permitted compilations and their known defects. [#227](https://github.com/AndreasUnunger/EverythingPath/issues/227#issuecomment-5948780647) permits compilation verification and requires permanent notice retention. The later [#241 resolution](https://github.com/AndreasUnunger/EverythingPath/issues/241#issuecomment-5955002698) requires current content-bound Attribution Assessments and reviewed notices for admission. [PRD #251 decision 17 and its acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461) retain these boundaries. A seed, name match or broad collection of notices supplies no content assessment.

Line 126 repeats line 125 with one trailing ASCII space; its hash is `aa0530016c2222f300be698f8f81d3176fcbc52362544f3611e3325e15ee61f1`. The ticket instead repeats line 125’s key at occurrences 13 and 14. No Registry record or alias is created for that unlisted variant, and both original physical lines remain in the permanent upstream notice block. Line 127 has a comma after `Tome of Horrors` and remains a separate reviewed record. Literal module capitalization, J2’s `Anson Caralya`, and Geon’s `Author Scott Greene and Clark Peterson.` without a colon are preserved. No correction supported by the permitted evidence is required for these exact lines.

Fourteen `notice-269-complete-chain-<full hash>` holds name the missing complete book-chain and alias evidence. The compilation does not establish all inherited notices for a module, a complete Tome of Horrors chain, or every Paizo book inheriting a creature notice. Every hold is enforced in [held-notices.json](../../scripts/catalog/legal/held-notices.json), following [the curation convention](curation.md#notice-holds-from-content-batches). A current synthetic assessment requiring any batch notice remains held; unrelated accepted content can still pass. No product-code or book-title aliases, Attribution Assessments or shipping content evidence are added.

All 75 prior Registry records and 236 prior hold registrations remain equal to `HEAD`. Existing named source exclusions, Ultimate Combat/Occult Mysteries corrections, free-PDF gaps and owner-transcription PDF checks remain unresolved. The complete upstream notice blocks and committed permanent superset are unchanged. No prior-use inventory was supplied, so no actual retained exception is asserted or cleared.

## Verification

Commands use the pinned read-only sibling checkouts. Scratch files and process temporary directories stay in ignored `.scratch/curation-269/`; `tmp/package.json` contains `{"type":"commonjs"}`. Notice hashes are not catalog candidate IDs, so full-corpus commands accompany the bounded notice tests.

```sh
export TMPDIR="$PWD/.scratch/curation-269/tmp"
PF1_CURATION_SYSTEM="/home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1"
PF1_CURATION_CONTENT="/home/andreas/repos/everythingpath/sources/pf1-content"
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm catalog:format --check
pnpm catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-269/drafts
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-269/preview
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --curation .scratch/curation-269/drafts/records.json --out .scratch/curation-269/preview-drafts
pnpm test tests/catalog/inherited-notices-269.test.ts tests/catalog/notice-holds.test.ts
CI=true pnpm test tests/catalog --maxWorkers=2
git diff --check
```

The [24 focused batch tests](../../tests/catalog/inherited-notices-269.test.ts) verify immutable source bytes, duplicate accounting, literal wording and punctuation, fourteen independent chain holds, legal-page generation, permanent retention, and missing/stale/unreviewed evidence. Both hold-registration tests pass. Synthetic assessments demonstrate gate behavior without certifying imported content. A direct legal-page invocation with all fifteen occurrences produced four sections and seventeen notices: fourteen Registry notices, both upstream blocks and the project line. Outstanding notices/resources were empty, and removing requirements and Registry records preserved the returned superset.

| Check | Result |
| --- | --- |
| `pnpm -s typecheck` | Pass, exit 0; final run includes the completed test file |
| `pnpm -s lint` | Pass, exit 0 |
| `pnpm -s check:initial-migration-writers` | Pass; 183 registrations checked |
| `pnpm catalog:pin` | Pass; `sha256:71c66667344e200747085cc47660277a9e7677da10cdd3d58033591444baa25b` |
| `pnpm catalog:format --check` | Pass; canonical shared data |
| `catalog:curate` | Exit 0; 4,251 records, 3,628 new drafts, no missing bindings, 763 unresolved mechanics; coverage remains failed |
| Default `catalog:preview` | Expected gate exit 1; 53 admitted, 23,129 held, 2 dependent omissions, 0 retained exceptions, 4,734 failures |
| Draft-assisted `catalog:preview` | Expected gate exit 1; same dispositions, 1,869 failures |
| Focused batch and hold-registration tests | Pass; 26 tests across 2 files, 611 ms |
| `CI=true pnpm test tests/catalog --maxWorkers=2` | Pass, exit 0; 35 files, 548 tests, 37.71 seconds |
| `git diff --check` | Pass |

Both previews verify the required commits and extract 23,037 entries plus 538 resources. Holds comprise 22,401 missing Attribution Assessments and 728 existing source/content-assessment holds. Greater Vital Strike (`pf1/zKNk7a4XxXsygJ67`) is omitted because Improved Vital Strike (`pf1/DorPGQ2mifJbMKH8`) remains held; Lightning Stance (`pf1/jbvXxHpu7BVbCpwr`) is omitted because Wind Stance (`pf1/9p0aAtCyLdcwnftS`) remains held. Admitted content requires only `PZO1110`; outstanding notices/resources are empty. Held-only batch notices do not become admitted requirements.

Default failures comprise 3,628 missing curation records, 715 unaccounted inventory records and 391 broken references. Draft-assisted failures replace missing records with 763 unresolved mechanics and retain the 1,106 inventory/reference failures. These corpus-wide gaps remain outside this batch. Drafts do not become reviewed Attribution Assessments, and no product-code fix is needed. The full `pnpm test` is reserved for the orchestrator's landing gate. No Convex integration test is needed because no backend or product code changed.

Both previews use final reviewed-input fingerprint `80a309bf59f7533cf1bd5d4084e50bfaa3bc24f6882758ff2e3643264f5b9759` and legal-resource fingerprint `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e`. Default admission-report SHA-256 is `1f4360ebbf0ecfbad442a8170e603992fbaabbe6aacc696c59389974565fc89f`, extraction fingerprint `d7e2b89c12b5639475cca600451aa7ceebcef96ceef5eed8be2aff0e3ad17f05`. Draft-assisted admission-report SHA-256 is `0a801e87927ae723a954494ee4723f527c108e759454129c41d0b237df4816ae`, extraction fingerprint `f44254005f4e6568e78bdd3e75a72663795807e0bcab50b33fc9c94228ba246f`. These identify the observed reports even after scratch cleanup.

## Phase timing and handoff

Approximate elapsed windows on 2026-10-07 (UTC; phases overlap): briefing/policy/source review 21:55–21:59, four minutes; artifact and test implementation 21:58:42–21:59:44, one minute; operator commands and verification 21:58–22:04:27, six minutes; reporting and final audit 22:03–22:06, three minutes. Overall elapsed time was about eleven minutes; overlapping phase windows are not additive. The review date records the completed review before local midnight, rather than the later verification date. Vitest's catalog-suite start time, 00:00:07, is October 8 in Europe/Stockholm.

Only the Registry, enforced holds, batch inventory, focused test and this report changed. Batch scratch drafts, reports, logs, cached issue evidence and process temporary files were removed after recording results. Changes remain uncommitted. No commits, pushes, issues, PRs, deployments, environment-file accesses, private E2E accesses or upstream changes were made. The final handoff uses the launcher's output handling; no answer file is placed in the repository.

## Workflow observations

- Validate slice uniqueness and retain physical-byte identities. The ticket repeats line 125’s hash while line 126 differs by a trailing space; record both ticket occurrences without substituting the unlisted variant.
- The Registry stores reviewer identity in free-text provenance. The structured batch inventory supplies reviewer/date, dispositions and evidence for audit.
- Worktree-local temporary directories need the CommonJS package boundary used by earlier batches. The catalog suite uses the existing CI timeout budget and two workers; no tracked timeout or assertion was changed.
- #257 remains `OPEN` despite the landed gate implementation explicitly exercised by this brief. Reconcile tracker dependencies before scheduling later batches.
- Requested Opus/Fable model names and foreground flags are unavailable in this interface. The required implementation subagent used the inherited available model; the main session performed review, operator checks and reporting.
