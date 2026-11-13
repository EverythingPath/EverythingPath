# Inherited notice review: #286

Reviewed 2026-10-08 by **Sol (AI curator) for the owner**. This batch reviews the fifteen immutable inherited notice keys in [#286](https://github.com/AndreasUnunger/EverythingPath/issues/286), following [#264](inherited-notices-264.md). It establishes notice evidence, not content attribution or legal sufficiency.

## Evidence and dispositions

The ticket's 15 unique immutable keys match 15 complete physical notice lines, 368–382. None is a heading, wrapped fragment, duplicate occurrence or fragment requiring joining. No line has outer whitespace: its raw-line and trimmed-text hashes coincide. Registry text is stored trimmed; copyright years, publishers, contributor names, punctuation and inner whitespace stay verbatim. No product-code, book-title or variant alias is inferred.

- Content: `pf1-content` 11.4.0, commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`, [OGL.txt lines 368–382](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d/OGL.txt#L368), file SHA-256 `10bcdc68296b48cc250f38e49de09c9a73645163d7ac7f76e77346a755c35cdc`.
- System comparison: `foundryvtt-pathfinder1` v11.11, commit `418761d2e16a6037c0156bb4a241f7cea5a2986d`, [OGL.txt](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/OGL.txt), file SHA-256 `0464e2f13f24c742dc3c2a4c788aab9ab24ca9809873192551b77f784a50d7f9`. None of the batch notices has a byte-identical system line.

Both checkouts were clean at those exact commits, with no writable files. Full hashes, raw-line and trimmed-text hashes, locations, comparisons and holds are recorded in [inherited-notices-286.json](../../scripts/catalog/legal/inherited-notices-286.json); reviewed text and reviewer provenance are in [section15-registry.json](../../src/lib/catalog/data/section15-registry.json). `checkedAgainst: "pf1-content"` records the permitted compilation comparison, not printed-book verification.

Every row is **reviewed verbatim; complete-book chain held**. Titles omit the common `Pathfinder Player Companion: ` prefix.

| Key prefix | Physical line | Notice title | Copyright year |
| --- | --- | --- | --- |
| `39cd4f77…` | 368 | Blood of Fiends | 2012 |
| `b611a881…` | 369 | Blood of Shadows | 2016 |
| `42d13b56…` | 370 | Blood of the Ancients | 2018 |
| `838859a1…` | 371 | Blood of the Coven | 2017 |
| `d137268b…` | 372 | Blood of the Elements | 2014 |
| `aac1cfcc…` | 373 | Champions of Balance | 2014 |
| `17b73375…` | 374 | Champions of Corruption | 2014 |
| `6e64ca1e…` | 375 | Champions of Purity | 2013 |
| `f437ef27…` | 376 | Demon Hunter’s Handbook | 2013 |
| `0a7449c8…` | 377 | Dirty Tactics Toolbox | 2015 |
| `218463b2…` | 378 | Divine Anthology | 2016 |
| `b8c8e89a…` | 379 | Dragon Empires Primer | 2011 |
| `17a2d87f…` | 380 | Dragonslayer's Handbook | 2013 |
| `a5bd35cf…` | 381 | Dungeoneer's Handbook | 2013 |
| `0d714b8b…` | 382 | Faiths of Balance. | 2011 |

The compilation contains one occurrence of each title. No supported conflicting notice requires correction for currently admitted content. Preserve the literal `Mikko Kallo` in Blood of the Ancients and `Mikko Kallio` in Dirty Tactics Toolbox, `David Ross` in Divine Anthology and Dungeoneer's Handbook, curly versus straight apostrophes in the three Handbook titles, and the title-terminal period in Faiths of Balance. These differences between separate book notices establish no corrected spelling or identity equivalence.

## Policy boundary and enforced holds

[#224](https://github.com/AndreasUnunger/EverythingPath/issues/224#issuecomment-5939689134) identifies permitted compilations and known defects. [#227](https://github.com/AndreasUnunger/EverythingPath/issues/227#issuecomment-5948780647) permits compilation-level review and permanent notice retention. [#241](https://github.com/AndreasUnunger/EverythingPath/issues/241#issuecomment-5955002698) supersedes earlier attribution policy: admission needs current content-bound evidence and all required reviewed notices. [PRD decision 17 and its acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461) preserve those boundaries. The standing owner decisions of 2026-10-08 restrict comparison evidence to PRD, PCGen and books, require trimmed Registry text and retain record-level 3.5 tags as holds. No AoN or book PDFs were consulted.

The compilation does not delineate the complete inherited notice chain for any of these books. All fifteen `notice-286-complete-chain-<hash>` holds therefore remain named in the evidence and enforced through [held-notices.json](../../scripts/catalog/legal/held-notices.json). Missing evidence is a permitted source establishing the complete chain, including inherited-rule notices, and any proposed book/product-code alias. Reviewed status for one line does not lift its hold. No additional variant hold is supported by this batch's evidence.

All 325 previously landed Registry records and 912 hold registrations remain equal to `HEAD`; totals become 340 and 927. Legal resources, permanent notice versions, Curation Overlay, Attribution Assessments and attribution evidence are unchanged. No prior-use inventory was supplied, so no actual retained exception is asserted or cleared. Existing correction, transcription, source-matched, content and inherited-rule holds remain. In particular, the #333–#336 and #516–#519 inherited-rule audits are still required.

The batch evidence explicitly records an empty `candidates` inventory and its notice-dependency scope: there are no content comparisons establishing candidate-level inherited rules or `requiredNotices` to amend. The complete-chain holds keep that missing coverage unresolved. Later content review must populate the structured inherited-rule fields and required notices enforced by `catalog:notice-deps`; a notice compilation cannot establish those dependencies by itself.

## Verification

[Focused tests](../../tests/catalog/inherited-notices-286.test.ts) pin the independent ticket inventory to the committed upstream bytes, raw and trimmed hashes, reviewer/date/provenance, literal text and absent aliases. They exercise legal-page generation and permanent retention, each enforced hold, missing/unreviewed notices, and separate content assessment. Admission probes reuse published CRB Lightning Reflexes and its landed evidence; additional notice requirements are test-only gate probes, not attribution to these books. No invented rules or assessments are added to committed content evidence.

Scratch output uses ignored `.scratch/curation-286/`; the launcher's existing `TMPDIR` is preserved outside every checkout under the repository parent's `.ep-tmp/`. Notice keys are not Catalog Entry selectors, so corpus operators run without `--candidates`. All checks run sequentially, with one test worker. No full suite or remote deployment/publication runs.

```sh
# Keep the launcher's TMPDIR under the repository parent's .ep-tmp/.
PF1_CURATION_SYSTEM="$HOME/repos/everythingpath/sources/foundryvtt-pathfinder1"
PF1_CURATION_CONTENT="$HOME/repos/everythingpath/sources/pf1-content"
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm catalog:format --check
pnpm catalog:notice-deps
CI=true pnpm test tests/catalog/inherited-notices-286.test.ts tests/catalog/notice-holds.test.ts --maxWorkers=1
pnpm catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-286/drafts
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-286/preview
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --curation .scratch/curation-286/drafts/records.json --out .scratch/curation-286/preview-drafts
CI=true pnpm test tests/catalog --maxWorkers=1
git diff --check
```

| Check | Result |
| --- | --- |
| `pnpm -s typecheck` | Pass, exit 0; repeated after the fixture correction |
| `pnpm -s lint` | Pass, exit 0; repeated after the fixture correction |
| `pnpm -s check:initial-migration-writers` | Pass, exit 0; 183 registrations |
| `pnpm catalog:pin` | Pass, exit 0; `sha256:d7a42ca346d875f9497c7da94325022ac289d7931226a3649979a13f410c8063` |
| `pnpm catalog:format --check` | Pass, exit 0 |
| `pnpm catalog:notice-deps` | Pass, exit 0; 3,248 dependencies, 2,103 curated candidates, 24 inventories; zero gaps/waivers/stale waivers; 36 advisory warnings |
| Focused batch and hold tests | Final pass, exit 0; 2 files, 25 tests; 3.24 seconds |
| `catalog:curate` | Exit 0; 5,504 records, 3,583 new drafts, zero replacements/missing bindings; 758 unresolved mechanics; coverage remains failed; 146.17 seconds |
| Default `catalog:preview` | Expected gate exit 1; 56 admitted, 23,198 held, two dependent omissions, zero retained exceptions, 4,689 failures; 182.97 seconds |
| Draft-assisted `catalog:preview` | Expected gate exit 1; same admission dispositions, 1,864 failures; 184.56 seconds |
| `pnpm test tests/catalog --maxWorkers=1` | Pass, exit 0; 70 files, 1,659 tests; 143.08 seconds |
| `git diff --check` | Pass |


The drafter’s 5,504 records reconcile as 3,687 required bindings (104 checked and 3,583 drafted), plus 1,817 checked descriptions. No checked record is retired or promoted by this notice batch.

Both previews verify the exact pins and extract 23,109 Catalog Entries (23,037 upstream entries plus 72 reviewed local ability-score traits) and 538 supporting resources. Count reconciliation is `23,109 + 538 = 56 admitted + 23,198 held + 2 dependent omissions + 391 structure/reference failures = 23,647`. The 715 unaccounted inventory failures refer to upstream records outside this extracted candidate total. Curation failures are additional binding failures and must not be added again to the candidate dispositions.

Default failures comprise 3,583 missing curation bindings, 715 unaccounted inventory records and 391 structure/reference failures. Supplying drafts replaces missing bindings with 758 unresolved-mechanics failures: `758 + 715 + 391 = 1,864`. These corpus gaps remain outside the notice batch. Greater Vital Strike and Lightning Stance remain the two dependent omissions. Both runs require only `PZO1110` and report zero outstanding notices/resources. This batch makes zero new content admissions and creates no retained exceptions; no generated draft is promoted to reviewed evidence.

The dependency gate's 36 advisories all belong to earlier feat/spell inventories; none belongs to #286 or establishes a dependency from a notice line. Their required inherited-rule audits are preserved. No waiver is added and no earlier content requirement, assessment or hold is changed.

The focused legal-page demonstration produces four sections, fifteen Registry notices and eighteen Section 15 entries, with zero outstanding notices/resources. Removing requirements and Registry records while carrying the generated permanent superset preserves every entry. This is a builder demonstration, not a publication or a requirement inferred from held-only content.

Both previews use reviewed-input fingerprint `d9525dd55623b1cb9170629c9d0c5c32b9674cf5a18faa04c796b9cbf9faad1e` and legal-resource fingerprint `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e`. Default admission-report SHA-256 is `629424d27b8085b84f608f3c788f0a4a9cb07ac163c05615be50b005f844aaf1`; extraction fingerprint `a8e78e9382707d6beedfd982bb7e9d8217fc67e2044f341c52c0348337875dde`. Draft-assisted admission-report SHA-256 is `126653ccaf615888143b498d554ccf239fedb049b2b900f0f1a6c51ae80a3437`; extraction fingerprint `fecdb04822373b1aa5b43d63031b480ece5c202e0afe8d41b485be1bed1a4c5c`.

The initial focused run had fifteen failed hold probes and ten passes because the test-only extra requirements omitted Lightning Reflexes' real `PZO1110` notice binding. The gate correctly required re-review before reaching the chain holds. Keeping that real source requirement fixed the probes; the final focused run passes all 25 tests. No source text, content evidence or product code was changed to repair the test.


## Timing and workflow observations

Approximate UTC phase timing on 2026-10-08: briefing/policy/source review 18:50–18:53 (three minutes); Registry/evidence/test work 18:53–18:57 (four minutes); sequential checks 18:54–19:11 (seventeen minutes); report and final audit about three minutes of work during command waits, 18:56–19:11. These windows overlap; overall elapsed time was about twenty-one minutes. Final typecheck took 6.13 seconds and final lint 115.40 seconds. All required checks completed before scratch cleanup.

The Registry has no structured reviewer field; reviewer information remains in provenance and structured batch evidence. Notice review has no bounded operator selector, so a fifteen-line batch still exercises the full corpus. Content dependency warnings do not inspect notice-only inventories; full-chain holds preserve the unresolved boundary until content review can record real dependencies. The launcher captures the final response through its supplied `-o` path; no answer file is written into the repository.

The final change contains only the Registry, enforced holds, batch evidence, focused test and this report. Scratch artifacts are removed after results are recorded. Changes remain uncommitted for the orchestrator. Environment files, private E2E material and upstream sources are untouched.
