# Inherited notice review: #287

Reviewed 2026-10-08 by **Sol (AI curator) for the owner**. This batch reviews the fifteen immutable inherited notice keys in [#287](https://github.com/AndreasUnunger/EverythingPath/issues/287), following [#264](inherited-notices-264.md). It establishes notice evidence, not content attribution or legal sufficiency.

## Evidence and dispositions

The ticket's 15 unique immutable keys match 15 complete physical notice lines, 383–397. None is a heading, wrapped fragment, duplicate occurrence or fragment requiring joining. No line has outer whitespace: its raw-line and trimmed-text hashes coincide. Registry text is stored trimmed; copyright years, publishers, contributor names, punctuation and inner whitespace remain verbatim. No product-code, book-title or variant alias is inferred.

- Content: `pf1-content` 11.4.0, commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`, [OGL.txt lines 383–397](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d/OGL.txt#L383), file SHA-256 `10bcdc68296b48cc250f38e49de09c9a73645163d7ac7f76e77346a755c35cdc`.
- System comparison: `foundryvtt-pathfinder1` v11.11, commit `418761d2e16a6037c0156bb4a241f7cea5a2986d`, [OGL.txt](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/OGL.txt), file SHA-256 `0464e2f13f24c742dc3c2a4c788aab9ab24ca9809873192551b77f784a50d7f9`. No batch notice has a byte-identical system line.

Both checkouts were clean at these exact commits and contained no writable files. Full hashes, raw-line and trimmed-text hashes, locations, comparisons and holds are recorded in [inherited-notices-287.json](../../scripts/catalog/legal/inherited-notices-287.json); reviewed text and reviewer provenance are in [section15-registry.json](../../src/lib/catalog/data/section15-registry.json). `checkedAgainst: "pf1-content"` records the permitted compilation comparison, not printed-book verification.

Every key is **reviewed verbatim; complete-book chain held**. Titles below omit the common `Pathfinder Player Companion: ` prefix; full immutable keys are in the evidence inventory.

| Key prefix | Physical line | Notice title | Copyright year |
| --- | --- | --- | --- |
| `c6f3ba60…` | 383 | Faiths of Corruption | 2011 |
| `13a02de5…` | 384 | Giant Hunter's Handbook | 2014 |
| `9541fa5c…` | 385 | Halflings of Golarion | 2010 |
| `ba4494ea…` | 386 | Haunted Heroes Handbook | 2016 |
| `df662c70…` | 387 | Healer’s Handbook | 2016 |
| `be3193ca…` | 388 | Heroes from the Fringe | 2018 |
| `8072b9e3…` | 389 | Heroes of Golarion | 2019 |
| `aca24802…` | 390 | Humans of Golarion | 2011 |
| `5dd75fe7…` | 391 | Inner Sea Primer | 2010 |
| `e70b18e1…` | 392 | Knights of the Inner Sea | 2012 |
| `eda75081…` | 393 | Legacy of Dragons | 2016 |
| `e729d335…` | 394 | Legacy of the First World | 2017 |
| `e22adb28…` | 395 | Magic Tactics Toolbox | 2016 |
| `0dd44d84…` | 396 | Melee Tactics Toolbox | 2015 |
| `3b3071ac…` | 397 | Mythic Origins | 2013 |

The compilation contains one occurrence of each title. No supported conflicting notice requires correction for currently admitted content. Literal distinctions remain: `Copyright` and title-terminal periods in Halflings of Golarion and Inner Sea Primer; the Humans of Golarion title-terminal period; Giant Hunter's straight apostrophe and Healer’s curly apostrophe; `Hal MacLean`, `Amber E. Scott`, `David Ross`, `David N. Ross`, `Sean K Reynolds` and `Amber Scott`. Those differences establish no corrected spelling or identity equivalence.

## Policy boundary and enforced holds

[#224](https://github.com/AndreasUnunger/EverythingPath/issues/224#issuecomment-5939689134) identifies permitted compilations and known defects. [#227](https://github.com/AndreasUnunger/EverythingPath/issues/227#issuecomment-5948780647) permits compilation-level review and permanent notice retention. [#241](https://github.com/AndreasUnunger/EverythingPath/issues/241#issuecomment-5955002698) supersedes earlier attribution policy: admission needs current content-bound evidence and all required reviewed notices. [PRD decision 17 and its acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461) retain those boundaries. Standing owner decisions of 2026-10-08 restrict comparison evidence to PRD, PCGen and books, require trimmed Registry text and retain record-level 3.5 tags as holds. No AoN or book PDFs were consulted.

The compilation does not delineate the complete inherited notice chain for any of these books. All fifteen `notice-287-complete-chain-<hash>` holds are named in the evidence and enforced through [held-notices.json](../../scripts/catalog/legal/held-notices.json). Missing evidence is a permitted source establishing the complete chain, including inherited-rule notices, and any proposed book/product-code alias. No book PDFs are available. Reviewed status for one line does not lift its hold. No additional variant hold is supported by this batch's evidence.

All 340 previously landed Registry records and 927 hold registrations remain equal to `HEAD`; totals become 355 and 942. Legal resources, permanent notice versions, Curation Overlay, Attribution Assessments and attribution evidence are unchanged. No prior-use inventory was supplied, so no actual retained exception is asserted or cleared. Existing correction, transcription, source-matched, content and inherited-rule holds remain, including the required #333–#336 and #516–#519 inherited-rule audits.

The dependency gate’s Legacy of Dragons advisory was inspected: #337’s Linnorm Wrath (`pf1-content/6nTc9JPQKOHwfSuS`) remains whole-content-held, and #339 and #516 retain their enforced `PZO9470` complete-chain holds. The notice line alone cannot establish content coverage or a product-code alias; these earlier records are unchanged.

The evidence explicitly records an empty `candidates` inventory and its notice-dependency scope: there are no content comparisons establishing candidate-level inherited rules or `requiredNotices` to amend. Complete-chain holds keep that coverage unresolved. Later content review must populate the structured inherited-rule fields and required notices enforced by `catalog:notice-deps`; a notice compilation cannot establish those dependencies by itself.

## Verification

[Focused tests](../../tests/catalog/inherited-notices-287.test.ts) pin the independent ticket inventory to committed upstream bytes, raw and trimmed hashes, reviewer/date/provenance, literal wording and absent aliases, plus the complete Registry legal-row payload limit. They exercise legal-page generation and permanent retention, every enforced hold, missing/unreviewed notices and separate content assessment. Admission probes reuse published CRB Lightning Reflexes and its landed evidence; added notice requirements are test-only gate probes, not attribution to these books. No invented rules or assessments enter committed evidence.

The legal-page demonstration produces four sections and eighteen Section 15 entries: fifteen Registry notices, both upstream blocks and the project notice. There are no outstanding notices/resources for those keys. Carrying the generated permanent superset after requirements and Registry records disappear retains every entry. This is a builder demonstration, not publication or a requirement inferred from held-only content.

Scratch output uses ignored `.scratch/curation-287/`; the launcher's existing `TMPDIR` remains outside every checkout under the repository parent's `.ep-tmp/`. Notice keys are not Catalog Entry selectors, so corpus operators run without `--candidates`. Checks run sequentially with `CI=true` and one test worker. No full suite or remote deployment/publication runs.

```sh
# Preserve the launcher's TMPDIR under the repository parent's .ep-tmp/.
PF1_CURATION_SYSTEM="$HOME/repos/everythingpath/sources/foundryvtt-pathfinder1"
PF1_CURATION_CONTENT="$HOME/repos/everythingpath/sources/pf1-content"
CI=true pnpm test tests/catalog/inherited-notices-287.test.ts tests/catalog/notice-holds.test.ts --maxWorkers=1
CI=true pnpm test tests/catalog/release-operator.test.ts tests/catalog/release.test.ts --maxWorkers=1
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm catalog:format --check
pnpm catalog:notice-deps
pnpm catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-287/drafts
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-287/preview
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --curation .scratch/curation-287/drafts/records.json --out .scratch/curation-287/preview-drafts
CI=true pnpm test tests/catalog --maxWorkers=1
git diff --check
```

| Check | Exit | Result | Elapsed seconds |
| --- | --- | --- | --- |
| Initial migration writer check | 0 | 183 registrations | 0.83 |
| `catalog:pin` | 0 | `sha256:d7a42ca346d875f9497c7da94325022ac289d7931226a3649979a13f410c8063` | 0.28 |
| `catalog:curate` | 0 | 5,504 records; 3,583 new drafts; zero replacements/missing bindings; 758 unresolved mechanics; coverage failed | 157.41 |
| Focused batch and hold tests | 0 | 26 tests in 2 files | 3.31 |
| Focused release regression tests | 0 | 24 tests in 2 files passed | 6.12 |
| `pnpm -s typecheck` | 0 | Pass | 12.76 |
| `pnpm -s lint` | 0 | Pass | 131.57 |
| `catalog:format --check` | 0 | Pass | 0.51 |
| `catalog:notice-deps` | 0 | 3,248 dependencies, 2,103 curated candidates, 25 inventories; zero gaps/waivers/stale waivers; 36 advisories | 0.82 |
| Default `catalog:preview` | 1 | Expected gate failure; 56 admitted, 23,198 held, 2 dependent omissions, zero retained exceptions, 4,689 failures | 210.56 |
| Draft-assisted `catalog:preview` | 1 | Expected gate failure; same dispositions, 1,864 failures | 203.30 |
| `pnpm test tests/catalog --maxWorkers=1` | 0 | 1681 tests in 71 files passed | 180.69 |
| `git diff --check` and prior-artifact preservation | 0 | Pass | — |

The first catalog-directory run ended with 69 files passed and 2 failed; 1,676 tests passed, 1 failed and 3 skipped due to failed setup (165.42 seconds). Both failures were `Release row registry exceeds byte limit.` A focused rerun reproduced the same failure in 2.88 seconds. The new Registry-row regression also failed before compaction (1.61 seconds).

The baseline Registry release row was 498,514 bytes; adding verbose per-record provenance made it 521,295 bytes, exceeding the 512,000-byte batch limit. Only this batch’s repeated provenance was compacted: each record retains reviewer/date, the structured evidence-file reference, immutable source URL/line and raw-line hash. Full source commit/tag/file hash, policy, comparisons and holds remain in the cited evidence file. Notice wording, metadata and all earlier records are unchanged. The complete legal row is now 509,536 bytes; its new focused capacity regression and all 24 release tests pass. The final checks in the table above use the compacted records.

Only 2,464 bytes of Registry-row capacity remain. Before scaling another notice batch, the release storage/transport contract needs a reviewed solution for growing Registry data; this batch changes no product code or release byte limit.

The drafter's 5,504 records reconcile as 3,687 required bindings (104 checked and 3,583 drafted), plus 1,817 checked descriptions. No checked record is retired or promoted by this batch.

Both previews verify the exact pins and extract 23,109 Catalog Entries (23,037 upstream entries plus 72 reviewed local ability-score traits) and 538 supporting resources. Count reconciliation is `23,109 + 538 = 56 admitted + 23,198 held + 2 dependent omissions + 391 structure/reference failures = 23,647`. The 715 unaccounted inventory failures concern upstream records outside this extracted candidate total. Curation failures are additional binding failures, not extra candidate dispositions.

Default failures comprise 3,583 missing curation bindings, 715 unaccounted inventory records and 391 structure/reference failures. Supplying drafts replaces the missing bindings with 758 unresolved-mechanics failures: `758 + 715 + 391 = 1,864`. These corpus gaps remain outside this notice batch. Greater Vital Strike and Lightning Stance remain the two dependent omissions. Both runs require only `PZO1110` and report zero outstanding notices/resources. This batch makes zero new content admissions and creates no retained exceptions; no generated draft becomes reviewed evidence.

All 36 dependency advisories belong to earlier feat/spell inventories; none originates in #287. The Legacy of Dragons advisory was examined as documented above. No waiver or earlier requirement, assessment or hold changes.

Default preview: admission-report SHA-256 `796f4afef2e55260c527310183959d83f655e578adef8d7e179049db762d8af5`; extraction fingerprint `a8e78e9382707d6beedfd982bb7e9d8217fc67e2044f341c52c0348337875dde`; reviewed-input fingerprint `84b8de90869064fa3f734d37f376b39f87769f5a879521c7b6f478903af5a626`; legal-resource fingerprint `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e`.

Draft-assisted preview: admission-report SHA-256 `044c02ac63253af6ea00f185afc649cd7caa1470658433938f80808371673dcc`; extraction fingerprint `fecdb04822373b1aa5b43d63031b480ece5c202e0afe8d41b485be1bed1a4c5c`; reviewed-input fingerprint `84b8de90869064fa3f734d37f376b39f87769f5a879521c7b6f478903af5a626`; legal-resource fingerprint `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e`.

## Timing and workflow observations

Approximate UTC phase windows on 2026-10-08: briefing/policy/source review 19:58–20:00 (two minutes); Registry/evidence/test work 20:00–20:01 and capacity repair 20:17–20:18 (about two minutes); capacity diagnosis 20:15–20:18 (about three minutes); verification window 20:01:11–20:30:25 (29.2 minutes). Reporting and final audit took about three minutes during command waits and after the tests; these windows overlap. All required checks completed before scratch cleanup. No product-code change was needed; this batch’s repeated Registry provenance was compacted after the capacity diagnosis described above.

The Registry has no structured reviewer field; reviewer information remains in provenance and structured batch evidence. Notice review has no bounded operator selector, so a fifteen-line batch still exercises the full corpus. Content dependency warnings do not inspect notice-only inventories; complete-chain holds preserve the unresolved boundary until content review can record real dependencies. The launcher captures the final response through its supplied `-o` path; no answer file is written into the repository.

Only the Registry, enforced holds, batch evidence, focused test and this report change. Scratch artifacts are removed after recording results. Changes remain uncommitted for the orchestrator. Environment files, private E2E material and upstream sources are untouched.
