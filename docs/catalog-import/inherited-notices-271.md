# Inherited notice review: #271

Reviewed on **2026-10-08** by **Sol (AI curator) for the owner**. [Ticket #271](https://github.com/AndreasUnunger/EverythingPath/issues/271) contains fifteen occurrences of thirteen distinct immutable keys. Occurrence 1 (`113a4168`, line 142) was already reviewed and held by [#270](inherited-notices-270.md), which landed first; it resolves to #270’s unchanged Registry record and hold, so this batch adds twelve new unique blocks. This batch establishes compilation-level notice evidence, with enforced unresolved holds; it does not establish content attribution or legal sufficiency.

The [batch inventory](../../scripts/catalog/legal/inherited-notices-271.json) records every full key, physical line, hash, disposition, comparison and hold; occurrence 1 has disposition `previously-reviewed-notice` and `previouslyReviewedIn` naming the #270 inventory. The [Section 15 Registry](../../src/lib/catalog/data/section15-registry.json) preserves verbatim wording and reviewer/date provenance. Each new unique block is a complete physical notice line: no heading or wrapped fragment requires joining. Aliases and `joinedWith` lists are empty.

| Occurrence | Hash prefix | Line | Notice | Copyright date | Disposition |
| --- | --- | --- | --- | --- | --- |
| 1 | `113a4168` | 142 | Ice Golem, Tome of Horrors Complete | 2011 | Already reviewed by #270; its record and chain hold |
| 2 | `53e8e492` | 144 | Ice Golem, Tome of Horrors Revised | 2002 | Reviewed separately; chain held |
| 3 | `3aba7d63` | 145 | Ice Golem, Tome of Horrors | 2002 | Reviewed separately; chain held |
| 4 | `c3f44c1d` | 146 | Into the Darklands | 2008 | Reviewed; chain held |
| 5 | `7e11d6ae` | 147 | Iron Cobra, Tome of Horrors Complete | 2011 | Reviewed; chain held |
| 6 | `7e11d6ae` | 147 | Iron Cobra, Tome of Horrors Complete | 2011 | Duplicate of occurrence 5; same record and hold |
| 7 | `736a6302` | 149 | Iron Cobra, Tome of Horrors | 2002 | Reviewed separately; chain held |
| 8 | `1c9dad34` | 150 | Iron Lords of Jupiter | 2003 | Reviewed; chain held |
| 9 | `c070331f` | 151 | Jackalwere, Tome of Horrors Complete | 2011 | Reviewed; chain held |
| 10 | `d8ce459d` | 152 | Jade Regent Player’s Guide | 2011 | Reviewed verbatim; chain and publisher wording held |
| 11 | `1faa0b96` | 153 | Jubilex, Tome of Horrors Revised | 2002 | Reviewed; chain held |
| 12 | `ac35c802` | 154 | Kamadan, Tome of Horrors Complete | 2011 | Reviewed; chain held |
| 13 | `ac35c802` | 154 | Kamadan, Tome of Horrors Complete | 2011 | Duplicate of occurrence 12; same record and hold |
| 14 | `67c6c14e` | 156 | Kech, Tome of Horrors Complete | 2011 | Reviewed; chain held |
| 15 | `b2688270` | 157 | Kelpie, Tome of Horrors Complete | 2011 | Reviewed; chain held |

## Evidence and holds

Source evidence is [pf1-content 11.4.0 OGL.txt, lines 142–157](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d/OGL.txt#L142-157), commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`, complete-file SHA-256 `10bcdc68296b48cc250f38e49de09c9a73645163d7ac7f76e77346a755c35cdc`. The companion system checkout is `v11.11`, commit `418761d2e16a6037c0156bb4a241f7cea5a2986d`, OGL file SHA-256 `0464e2f13f24c742dc3c2a4c788aab9ab24ca9809873192551b77f784a50d7f9`. Independent checks match both source-file hashes and every reviewed Registry line against the read-only pinned checkouts. Keys hash the complete UTF-8 physical line excluding its line ending, without trimming or normalization. The review date is separate from copyright dates.

[#224](https://github.com/AndreasUnunger/EverythingPath/issues/224#issuecomment-5939689134) identifies permitted compilations and known defects. [#227](https://github.com/AndreasUnunger/EverythingPath/issues/227#issuecomment-5948780647) permits compilation-level verification and requires permanent retention. The later [#241 resolution](https://github.com/AndreasUnunger/EverythingPath/issues/241#issuecomment-5955002698) requires current content-bound Attribution Assessments and reviewed notices for admission. [PRD #251 decision 17 and its acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461) retain those boundaries. No seed, title match or broad notice collection establishes content coverage.

Lines 143, 148 and 155 repeat the preceding notices with one final ASCII space, giving distinct hashes outside the ticket. Their exact hashes and comparisons are documented in the inventory; no Registry record or alias is added for them. The original permanent upstream block retains all physical lines. Complete, Revised and original Tome of Horrors notices remain separate; edition equivalence is not inferred. Literal `Revised.©`, Jade Regent’s `Paizo Publishing, LL C`, and Iron Lords’ `Author: Lizard -- Used With Permission.` remain unchanged. No permitted evidence supplies a corrected Jade Regent publisher spelling. No correction is needed for currently admitted content.

Twelve `notice-271-complete-chain-<full hash>` holds record the missing full book-chain and alias evidence. Creature excerpts do not identify every Paizo book inheriting them; the three other book lines do not establish their complete inherited chains. `notice-271-jade-regent-publisher-wording` additionally records the unresolved `LL C` wording. All thirteen holds are enforced in [held-notices.json](../../scripts/catalog/legal/held-notices.json), following [the curation convention](curation.md#notice-holds-from-content-batches). An otherwise current synthetic assessment requiring any batch notice remains held. The line-142 notice keeps only `notice-270-complete-chain-113a416896c13ee93ce260c01a6054007e14a87545835976a41ae2ba5624ba49`. No book/product aliases, shipping Attribution Assessments or content evidence are added.

All 104 prior Registry records, including #270’s line-142 record, and 265 prior hold registrations remain equal to the #270 landing commit. Existing named exclusions, Ultimate Combat/Occult Mysteries corrections, free-PDF gaps and owner-transcription PDF checks remain unresolved. Both upstream notice blocks and the committed permanent superset are unchanged. No prior-use inventory was supplied, so no actual retained exception is asserted or cleared.

## Verification

Scratch files and process temporary directories stay in ignored `.scratch/curation-271/`, with `tmp/package.json` containing `{"type":"commonjs"}`. Notice hashes are not catalog candidate IDs, so full-corpus commands accompany the bounded notice tests. No deployment or release activation is involved.

The [23 focused tests](../../tests/catalog/inherited-notices-271.test.ts) verify all immutable source bytes, the #270 overlap, duplicate accounting, unlisted variants, distinct editions and literal wording, legal-page generation and permanent retention, each chain hold independently, and missing/stale/unreviewed notice behavior. Two existing hold-registration tests also pass. Synthetic content comparisons establish gate behavior only. A direct `buildLegalPageData` invocation with all fifteen ticket occurrences produced four sections and sixteen notices: thirteen Registry notices (twelve from this batch, one from #270), both upstream blocks and the project line. Outstanding notices/resources were empty. Removing requirements and Registry records preserved that returned superset.

```sh
mkdir -p .scratch/curation-271/tmp
export TMPDIR="$PWD/.scratch/curation-271/tmp"
printf '{"type":"commonjs"}\n' > "$TMPDIR/package.json"
PF1_CURATION_SYSTEM="/home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1"
PF1_CURATION_CONTENT="/home/andreas/repos/everythingpath/sources/pf1-content"
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm catalog:format --check
pnpm catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-271/drafts
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-271/preview
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --curation .scratch/curation-271/drafts/records.json --out .scratch/curation-271/preview-drafts
CI=true pnpm test tests/catalog/inherited-notices-271.test.ts tests/catalog/notice-holds.test.ts --maxWorkers=2
CI=true pnpm test tests/catalog --maxWorkers=2
git diff --check
```

| Check | Result |
| --- | --- |
| `pnpm -s typecheck` | Pass, exit 0; final run includes completed test file |
| `pnpm -s lint` | Pass, exit 0; final run includes completed test file |
| `pnpm -s check:initial-migration-writers` | Pass; 183 registrations checked |
| `pnpm catalog:pin` | Pass; `sha256:71c66667344e200747085cc47660277a9e7677da10cdd3d58033591444baa25b` |
| `pnpm catalog:format --check` | Pass; canonical shared data |
| `catalog:curate` | Exit 0; 4,251 records, 3,628 new drafts, 0 missing bindings, 763 unresolved mechanics; coverage remains failed |
| Default `catalog:preview` | Expected gate exit 1; 53 admitted, 23,129 held, 2 dependent omissions, 0 retained exceptions, 4,734 failures |
| Draft-assisted `catalog:preview` | Expected gate exit 1; identical content dispositions, 1,869 failures |
| Focused batch and hold-registration tests | Pass; 25 tests across 2 files, 580 ms |
| `CI=true pnpm test tests/catalog --maxWorkers=2` | Pass, exit 0; 36 files, 571 tests, 46.06 seconds |
| `git diff --check` | Pass |

The full `pnpm test` is reserved for the orchestrator’s landing gate. No Convex integration test applies because no backend or product code changed.

The default preview verifies both required commits and extracts 23,037 entries plus 538 resources. Holds comprise 22,401 missing Attribution Assessments and 728 existing source/content-assessment holds. Greater Vital Strike (`pf1/zKNk7a4XxXsygJ67`) is omitted because Improved Vital Strike (`pf1/DorPGQ2mifJbMKH8`) remains held; Lightning Stance (`pf1/jbvXxHpu7BVbCpwr`) is omitted because Wind Stance (`pf1/9p0aAtCyLdcwnftS`) remains held. Admitted content requires only `PZO1110`; outstanding notices/resources are empty. Held-only batch notices do not become admitted requirements. Default failures comprise 3,628 missing curation records, 715 unaccounted inventory records and 391 broken references. These corpus-wide gaps remain outside this batch.

The default preview’s admission-report SHA-256 is `8186af17da8de10b924e43b961060d8f1124d5c2fbbbf68f1a636df30cdfae24`; extraction fingerprint `d7e2b89c12b5639475cca600451aa7ceebcef96ceef5eed8be2aff0e3ad17f05`; reviewed-input fingerprint `a72ced508712eae7c104ec7993c4854969bebc0e1575b4d76b4de8566f7d2ce5`; legal-resource fingerprint `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e`. These identify the observed reports after scratch cleanup. They were recorded before rebasing onto #270; dropping the duplicate line-142 record and hold changes the reviewed-input fingerprint, and the previews were not re-run.

The draft-assisted preview has the same verified pins, required notices, content dispositions and reviewed/legal input fingerprints. Its failures replace missing curation records with 763 unresolved mechanics and retain the same 1,106 inventory/reference failures. Drafts do not establish accepted Attribution Assessments. Its admission-report SHA-256 is `a9ae956f6f6d5a8ab9de237505d3cf716ef4f1e4428c1fa9c814645131b114fa`, extraction fingerprint `f44254005f4e6568e78bdd3e75a72663795807e0bcab50b33fc9c94228ba246f`. No product-code fix was necessary.

## Handoff and workflow observations

Only the Registry, enforced holds, batch inventory, focused test and this report changed. On rebase onto #270 the duplicate line-142 Registry record and hold were dropped in favour of #270’s. Scratch drafts, preview reports, logs, issue copies and process temporary files are removed after recording results. No commits, pushes, issues, PRs, deployments, environment-file accesses, private E2E accesses or upstream changes are involved. The final handoff uses the launcher’s output handling; no answer file is placed in the repository.

Approximate elapsed windows on 2026-10-07 (UTC; October 8 locally): briefing/policy/source review 22:28–22:31, three minutes; Registry/evidence/test implementation 22:29–22:32, three minutes; operator commands and verification 22:30–22:37, seven minutes; report and final audit 22:32–22:37, five minutes. Overall elapsed time was about nine minutes; overlapping windows are not additive. The review date follows Europe/Stockholm. Vitest’s suite start time, 00:32:14, is October 8 locally.

- Validate inventory uniqueness and exact physical bytes before scaling: this ticket repeats two keys while three nearby upstream lines differ by a trailing space. Record occurrences without substituting omitted hashes. Avoid global ticket-number replacement in copied tests: it temporarily altered one hash and a seed code; source review caught these before the passing checks.
- The Registry stores reviewer identity in free-text provenance; the structured inventory supplies auditable reviewer/date and evidence. A reviewed excerpt and a complete book notice chain remain separate evidence.
- Local process temporary directories need the CommonJS package boundary used by preceding batches. Catalog tests use the existing CI timeout budget and two workers; no tracked test timeout is changed.
- #257 still reports `OPEN` despite its landed gate implementation, which this brief explicitly requires exercising. Reconcile tracker dependencies before scheduling later batches.
- Requested Opus/Fable model names and foreground flags are unavailable in this interface. The required implementation subagent used the inherited available model; the main session performed source review, operator checks and reporting.
