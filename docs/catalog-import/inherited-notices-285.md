# Inherited notice review: #285

Reviewed 2026-10-08 by **Sol (AI curator) for the owner**. This batch reviews the fifteen immutable inherited notice keys in [#285](https://github.com/AndreasUnunger/EverythingPath/issues/285), following [#264](inherited-notices-264.md). It establishes notice evidence, not content attribution or legal sufficiency.

## Evidence and dispositions

All fifteen keys match SHA-256 of distinct complete physical UTF-8 lines, excluding their line endings. None is a heading or wrapped fragment; no joining or correction was needed. Wording, copyright years, contributor names and punctuation remain verbatim. No product-code, book-title or alternate-key aliases are inferred.

- Content: `pf1-content` 11.4.0, commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`, [OGL.txt lines 353–367](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d/OGL.txt#L353), file SHA-256 `10bcdc68296b48cc250f38e49de09c9a73645163d7ac7f76e77346a755c35cdc`.
- System comparison: `foundryvtt-pathfinder1` v11.11, commit `418761d2e16a6037c0156bb4a241f7cea5a2986d`, [OGL.txt](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/OGL.txt), file SHA-256 `0464e2f13f24c742dc3c2a4c788aab9ab24ca9809873192551b77f784a50d7f9`. No batch line matches a system notice.

Full identities, per-line hashes, comparisons and holds are in [inherited-notices-285.json](../../scripts/catalog/legal/inherited-notices-285.json). The reviewed notices are in [section15-registry.json](../../src/lib/catalog/data/section15-registry.json). `checkedAgainst: "pf1-content"` records compilation comparison; copyright years are distinct from the review date, and no printed-book verification is claimed.

Every row is **reviewed verbatim; complete-book chain held**. Titles below omit the first ten rows' `Pathfinder Module: ` prefix and the last five rows' `Pathfinder Player Companion: ` prefix.

| Key prefix  | Physical line | Notice title                   | Copyright year |
| ----------- | ------------- | ------------------------------ | -------------- |
| `ac8a797c…` | 353           | Realm of the Fellknight Queen  | 2010           |
| `a28cb619…` | 354           | The Dragon's Demand            | 2013           |
| `c3ce3963…` | 355           | The Dragon’s Demand            | 2013           |
| `0d533c8c…` | 356           | The Emerald Spire Superdungeon | 2014           |
| `69db97f4…` | 357           | The Godsmouth Heresy           | 2010           |
| `384dbf60…` | 358           | The Harrowing                  | 2011           |
| `5b7ce2bf…` | 359           | The Moonscar                   | 2012           |
| `16385407…` | 360           | The Ruby Phoenix Tournament    | 2012           |
| `c42e787d…` | 361           | The Witchwar Legacy            | 2010           |
| `3e1fd411…` | 362           | Tomb of the Iron Medusa        | 2011           |
| `42054efa…` | 363           | Antihero’s Handbook            | 2017           |
| `fd035b21…` | 364           | Arcane Anthology               | 2016           |
| `158fc051…` | 365           | Armor Master’s Handbook        | 2016           |
| `5dd26bfb…` | 366           | Bastards of Golarion           | 2014           |
| `eb6d9efe…` | 367           | Blood of Angels                | 2012           |

## Policy boundary and enforced holds

[#224](https://github.com/AndreasUnunger/EverythingPath/issues/224#issuecomment-5939689134) identifies permitted compilations and known defects. [#227](https://github.com/AndreasUnunger/EverythingPath/issues/227#issuecomment-5948780647) permits compilation-level verification and permanent notice retention. [#241](https://github.com/AndreasUnunger/EverythingPath/issues/241#issuecomment-5955002698) supersedes earlier attribution policy: admission requires current content-bound evidence and the required reviewed notices. [PRD decision 17 and its acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461) preserve those boundaries.

The compilation does not delineate each book's complete inherited notice chain. All fifteen `notice-285-complete-chain-<hash>` holds are therefore registered in [held-notices.json](../../scripts/catalog/legal/held-notices.json), following [curation.md](curation.md#notice-holds-from-content-batches). Reviewed Registry status does not lift them.

Three additional reconciliation holds retain unresolved variants:

- `notice-285-dragons-demand-variant-354` and `notice-285-dragons-demand-variant-355`: the two complete notices differ only by straight versus curly apostrophe. Each retains its distinct immutable identity and exact text.
- `notice-285-emerald-spire-variant-comparison`: [line 345](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d/OGL.txt#L345) names _Emerald Spire_, Paizo Publishing, LLC, Nick Logue and James Sutter; line 356 names _The Emerald Spire Superdungeon_, Paizo Inc., Nicolas Logue and James L. Sutter. Permitted evidence does not resolve the relationship or canonical wording. Enforcement covers both immutable keys, including the out-of-batch `3f61d498…` sibling. That sibling is comparison evidence only; this batch creates no Registry record for it.

No proposed correction is substituted for source text. Existing holds remain, including known source-matched exclusions, Ultimate Combat/Occult Mysteries corrections, free-PDF gaps and owner-transcription checks. No Attribution Assessment is created, changed or rebound. No prior-use inventory was supplied, so no actual retained exception is asserted or cleared. Existing legal resources and all permanent notice versions remain unchanged.

## Verification

The [31 focused tests](../../tests/catalog/inherited-notices-285.test.ts) cover the independent immutable inventory, committed source bytes, dates/provenance, absent aliases, all eighteen holds, legal-page generation and retention, separate content evidence, changed notice bindings, unrelated admission and retained exceptions. An independently reviewed synthetic Emerald Spire sibling remains held by the variant hold. Synthetic assessments and retained uses are gate demonstrations only.

A direct `buildLegalPageData` invocation generated four sections, fifteen Registry notices and eighteen total Section 15 entries, with zero outstanding notices/resources. Removing the requirements and Registry while carrying that permanent superset preserved every entry. This demonstration does not make held-only notices requirements for unrelated admission.

Independent comparison against the pinned source bytes passed for all fifteen keys. All 295 earlier Registry records and 755 earlier hold registrations remain equal to `HEAD`; the totals become 310 and 773. Content assessments, evidence, legal resources and product code are unchanged.

Scratch files and process temporary directories use ignored `.scratch/curation-285/`, with an explicit CommonJS package boundary for subprocess fixtures. Notice keys are not Catalog Entry selectors, so the corpus operators run without `--candidates`.

```sh
mkdir -p .scratch/curation-285/tmp
export TMPDIR="$PWD/.scratch/curation-285/tmp"
# tmp/package.json contains {"type":"commonjs"}
PF1_CURATION_SYSTEM="/home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1"
PF1_CURATION_CONTENT="/home/andreas/repos/everythingpath/sources/pf1-content"
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm catalog:format --check
pnpm catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-285/drafts
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-285/preview
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --curation .scratch/curation-285/drafts/records.json --out .scratch/curation-285/preview-drafts
CI=true pnpm test tests/catalog/inherited-notices-285.test.ts tests/catalog/notice-holds.test.ts --maxWorkers=2
CI=true pnpm test tests/catalog --maxWorkers=2
git diff --check
```

| Check                                     | Result                                                                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm -s typecheck`                       | Final pass, exit 0                                                                                                             |
| `pnpm -s lint`                            | Final pass, exit 0                                                                                                             |
| `pnpm -s check:initial-migration-writers` | Pass, exit 0; 183 registrations                                                                                                |
| `pnpm catalog:pin`                        | Pass, exit 0; `sha256:d7a42ca346d875f9497c7da94325022ac289d7931226a3649979a13f410c8063`                                        |
| `pnpm catalog:format --check`             | Pass, exit 0                                                                                                                   |
| `catalog:curate`                          | Exit 0; 5,208 records, 3,583 new drafts, zero replacements/missing bindings, 758 unresolved mechanics; coverage remains failed |
| Default `catalog:preview`                 | Expected gate exit 1; 56 admitted, 23,126 held, two dependent omissions, zero retained exceptions, 4,689 failures              |
| Final draft-assisted `catalog:preview`    | Expected gate exit 1; same admission dispositions, 1,864 failures                                                              |
| Focused batch and notice-hold tests       | Pass, exit 0; 2 files, 33 tests, 1.21 seconds                                                                                  |
| `pnpm test tests/catalog --maxWorkers=2`  | Pass, exit 0; 62 files, 1,332 tests, 131.79 seconds                                                                            |
| `git diff --check`                        | Pass                                                                                                                           |

Both previews verify the required upstream commits and extract 23,037 entries plus 538 resources. The default preview fails on 3,583 missing curation records, 715 unaccounted inventory records and 391 broken structure/reference records. Supplying drafts replaces the missing-record failures with 758 unresolved-mechanics failures, leaving the other 1,106 failures. Those full-corpus gaps remain outside this notice batch. Both previews require only `PZO1110` and report zero outstanding notices/resources; held-only batch notices do not become requirements. Greater Vital Strike and Lightning Stance remain the two dependent omissions. No draft or synthetic fixture is promoted to reviewed content evidence.

The default preview loaded an intermediate Registry before the final Emerald Spire provenance addition; its reviewed-input fingerprint is `2afa562c158799d811acd933c2e08d1167913614e8ebe08a2229d16d110ee281`. The final draft-assisted preview uses the final data, independently confirmed to match the current reviewed-input fingerprint `117a304fcec82519c3714a51880e27f5071217cd5b86aed17ced514ef93dc6a6`. Its admission-report SHA-256 is `ca0cf5a9aaa65d3f2873317c18c57166eaf557c0fd7a42b17bd77c90f584103e`; extraction fingerprint `ef3fccdd8dbd9790f072e136da025b38881bfedb4460664806e021a0e828d4aa`; legal-resource fingerprint `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e`.

Initial local checks exposed two corrected test-construction errors: an overbroad batch-number replacement changed part of a literal hash, and typecheck rejected spreading an optional related-key array. Final focused tests and typecheck pass after both fixes. One draft-assisted command was started before its input file existed and exited 1 with `ENOENT`; it was rerun after the drafter completed, producing the final report above. Dependent commands should be scheduled after their producing process has exited.

## Phase timing and workflow observations

Approximate UTC phase windows on 2026-10-08: briefing/policy/source review 08:17–08:21, four minutes; artifact/test implementation and corrections 08:19–08:26, seven minutes; operator commands and checks 08:20–08:32, twelve minutes; report/final audit 08:27–08:32, five minutes. Parallel phases overlap; overall elapsed time was about fifteen minutes. All scratch artifacts were removed after recording the results. Changes remain uncommitted for the orchestrator.

The Registry has no structured reviewer field; reviewer information lives in provenance and the batch evidence. The generic hold scanner reads `noticeKey`, so the broader Emerald Spire sibling requirement also has a focused enforcement test; generalizing the scanner to related keys would protect future batches. Notice review needs its own bounded operator selector: current candidate selection addresses content identities, so these batches exercise the full corpus. Model names Opus/Fable and `run_in_background` are unavailable in this tool interface; implementation was delegated using the inherited available model. The launcher's answer-file path is not exposed to this session; no answer file is created in the repository.

The final diff contains only the Registry, enforced holds, batch evidence, focused test and this report. Generated drafts and preview reports are disposable demonstrations, not promoted curation or attribution evidence. No full test suite, deployment, activation, commit, push, issue or PR operation was performed. Environment files, private E2E material and upstream checkouts were not modified.
