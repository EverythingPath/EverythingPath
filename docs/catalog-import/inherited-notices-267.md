# Inherited notice review: #267

Reviewed 2026-10-07 by **Sol (AI curator) for the owner**. This batch reviews the exact inventory in [#267](https://github.com/AndreasUnunger/EverythingPath/issues/267). It establishes notice evidence, not content attribution or a new legal-sufficiency conclusion.

## Evidence and disposition

The ticket lists fifteen occurrences of fourteen unique immutable keys. Every unique hash matches one complete physical UTF-8 notice line, excluding its newline, in the pinned compilation. None is a heading or wrapped fragment; no joining or correction is required. Copyright dates, punctuation and author spellings remain verbatim; review dates are separate.

- Content: `pf1-content`, tag `11.4.0`, commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`, [OGL.txt lines 83–97](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d/OGL.txt#L83-97), whole-file SHA-256 `10bcdc68296b48cc250f38e49de09c9a73645163d7ac7f76e77346a755c35cdc`.
- System legal resource: `foundryvtt-pathfinder1`, tag `v11.11`, commit `418761d2e16a6037c0156bb4a241f7cea5a2986d`, [OGL.txt](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/OGL.txt), whole-file SHA-256 `0464e2f13f24c742dc3c2a4c788aab9ab24ca9809873192551b77f784a50d7f9`.

The [batch inventory](../../scripts/catalog/legal/inherited-notices-267.json) records all fifteen occurrences, fourteen source blocks, comparisons and named holds. The [Section 15 Registry](../../src/lib/catalog/data/section15-registry.json) adds fourteen canonical records with `checkedAgainst: "pf1-content"`, date and immutable source provenance. Reviewer information is recorded in provenance and the structured batch inventory because the Registry schema has no reviewer field. All alias and `joinedWith` lists are empty.

| Ticket occurrence | Hash prefix | Line | Notice | Copyright date | Disposition |
| --- | --- | --- | --- | --- | --- |
| 1 | `672f0dc5` | 83 | Demon, Alu- | 2011 | Reviewed; chain held |
| 2 | `c28f6d0d` | 84 | Demon, Nabasu | 2011 | Reviewed; chain held |
| 3 | `0d2e3da7` | 85 | Demon, Shadow | 2011 | Reviewed; chain held |
| 4 | `b87a7695` | 86 | Demon, Stirge | 2011 | Reviewed verbatim; chain and wording held |
| 5 | `c2404548` | 87 | Devil, Geryon | 2011 | Reviewed; chain held |
| 6 | `14160d86` | 88 | Devil, Moloch | 2011 | Reviewed; chain held |
| 7 | `8fbb636a` | 89 | Dire Corby | 2011 | Reviewed; chain held |
| 8 | `fcaa8332` | 90 | Disenchanter | 2011 | Reviewed; chain held |
| 9 | `fcaa8332` | 90 | Disenchanter | 2011 | Duplicate of occurrence 8; same record and hold |
| 10 | `b57e28a3` | 92 | Dracolisk, Complete | 2011 | Reviewed; chain held |
| 11 | `23ae1035` | 93 | Dracolisk, Tome of Horrors | 2002 | Reviewed; chain held |
| 12 | `5de5656a` | 94 | Dragon Horse | 2011 | Reviewed; chain held |
| 13 | `cf089ce2` | 95 | Dragon, Faerie | 2011 | Reviewed; chain held |
| 14 | `ccffb9bb` | 96 | Dust Digger | 2011 | Reviewed; chain held |
| 15 | `73ae0ca5` | 97 | Executioner’s Hood | 2011 | Reviewed; chain held |

## Comparisons and holds

[#224](https://github.com/AndreasUnunger/EverythingPath/issues/224#issuecomment-5939689134) identifies permitted compilation evidence and known defects; [#227](https://github.com/AndreasUnunger/EverythingPath/issues/227#issuecomment-5948780647) permits compilation-level verification and permanent notice retention. The later [#241 resolution](https://github.com/AndreasUnunger/EverythingPath/issues/241#issuecomment-5955002698) requires current content-bound Attribution Assessments as well as reviewed notices. [PRD #251 decision 17 and its acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461) retain these boundaries.

Line 91 is the Disenchanter line 90 plus one trailing ASCII space, with distinct hash `cf4516a6eb17d46f90b863c87a9ee69f676f3f975ed51770dba470e149b492c9`. That hash is absent from the ticket. The repeated ticket key is accounted for without substituting line 91 or creating another Registry record or alias. Both physical lines remain in the unchanged upstream permanent notice block.

Demon, Shadow exactly matches one inherited line in the [owner’s Bestiary 6 transcription](https://github.com/AndreasUnunger/EverythingPath/issues/227#issuecomment-5948776405). `PZO1137` remains an unreviewed seed pending PDF comparison; one matching excerpt establishes no complete-book coverage or product-code alias. Dracolisk’s Complete 2011 and unqualified Tome of Horrors 2002 notices remain distinct; the latter is not labelled “Revised” in the source.

Demon, Stirge literally says `Frog Godz Games; Authors Scott Greene and Clark Peterson,`. The apparent spelling/punctuation discrepancy cannot be resolved from the permitted evidence. The Registry retains those bytes and `notice-267-stirge-literal-wording` names the pending book comparison. No correction is invented.

The compilation establishes individual excerpts but not complete Tome of Horrors notice chains or every Paizo book inheriting them. Fourteen `notice-267-complete-chain-<full hash>` holds and the additional Stirge hold are recorded in the inventory and enforced in [held-notices.json](../../scripts/catalog/legal/held-notices.json), following [the hold convention](curation.md#notice-holds-from-content-batches). Even a current synthetic assessment requiring these notices remains held. No Attribution Assessment, product-code mapping or shipping content evidence is created.

All 47 prior Registry records and 104 prior hold registrations remain equal to `HEAD`. Existing named source holds, Ultimate Combat/Occult Mysteries corrections, free-PDF gaps and owner PDF checks remain unresolved. Both upstream blocks and the permanent notice superset are unchanged. No prior-use inventory was supplied, so no actual retained exception is asserted or cleared.

## Verification

Commands use the pinned read-only sibling checkouts. Temporary files and process temporary directories use ignored `.scratch/curation-267/`, with `tmp/package.json` containing `{"type":"commonjs"}`. Notice keys are not catalog candidate IDs, so full-corpus commands accompany the bounded notice tests.

```sh
export TMPDIR="$PWD/.scratch/curation-267/tmp"
PF1_CURATION_SYSTEM="/home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1"
PF1_CURATION_CONTENT="/home/andreas/repos/everythingpath/sources/pf1-content"
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm catalog:format --check
pnpm catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-267/drafts
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-267/preview
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --curation .scratch/curation-267/drafts/records.json --out .scratch/curation-267/preview-drafts
pnpm test tests/catalog/inherited-notices-267.test.ts tests/catalog/notice-holds.test.ts
pnpm test tests/catalog
pnpm test tests/catalog --maxWorkers=2
CI=true pnpm test tests/catalog --maxWorkers=2
git diff --check
```

The [25 batch tests](../../tests/catalog/inherited-notices-267.test.ts) prove exact source bytes, inventory accounting, distinct notices, owner comparison, literal discrepancy retention, legal-page generation, permanent retention and admission holds, including stale/missing/unreviewed notices and each key independently. Both hold-registration tests also pass. Synthetic assessments establish behavior only; they are not shipping attribution evidence.

A direct `buildLegalPageData` invocation with all fifteen inventory occurrences produced four sections and seventeen Section 15 notices: fourteen Registry records, both upstream blocks and the project line. Outstanding notices/resources were empty. Removing all requirements and Registry records while carrying the returned permanent superset retained every notice. Independent byte/hash comparison against the actual pinned checkout passed for all fourteen unique blocks.

| Check | Result |
| --- | --- |
| `pnpm -s typecheck` | Pass, exit 0 |
| `pnpm -s lint` | Pass, exit 0 |
| `pnpm -s check:initial-migration-writers` | Pass; 183 registrations checked |
| `pnpm catalog:pin` | Pass; `sha256:6607d068facda14d40eddebe4e916952e8c668997ecadde9dbdc550e946f5518` |
| `pnpm catalog:format --check` | Pass; canonical shared data |
| `catalog:curate` | Exit 0; 3,924 records, 3,628 new drafts, no missing bindings, 763 unresolved mechanics; coverage remains failed |
| Default `catalog:preview` | Expected gate exit 1; 51 admitted, 23,132 held, 1 dependent omission, 0 retained exceptions, 4,734 failures |
| Draft-assisted `catalog:preview` | Expected gate exit 1; same dispositions, 1,869 failures |
| Focused batch and hold-registration tests | 27 passed (25 + 2) |
| `pnpm test tests/catalog` | Exit 1; 447 passed, 2 existing CLI timeouts; repeated with two workers, same result |
| `CI=true pnpm test tests/catalog --maxWorkers=2` | Pass, exit 0; 28 files, 449 tests, 120.29 seconds |
| `git diff --check` | Pass |

Both previews verify the required commits and extract 23,037 entries plus 538 resources. Holds comprise 22,811 missing Attribution Assessments, 32 known source notice/evidence holds and 289 existing content-assessment holds. Lightning Stance (`pf1/jbvXxHpu7BVbCpwr`) is omitted because its Wind Stance dependency (`pf1/9p0aAtCyLdcwnftS`) remains held. Admitted content requires only `PZO1110`; outstanding notices/resources are empty. Held-only batch notices are not added as admitted requirements.

Default failures comprise 3,628 missing curation records, 715 unaccounted inventory records and 391 broken references. Draft-assisted failures replace missing records with 763 unresolved mechanics and retain the 1,106 inventory/reference failures. These corpus-wide gaps remain outside this batch; no draft becomes a reviewed Attribution Assessment. No product-code fix is needed. The full `pnpm test` is reserved for the orchestrator’s landing gate.

Durable report fingerprints:

- Default admission-report SHA-256: `22cda59550ac85fae39b8627fda65ac9a8934b0cd566429aee36004a2a2db2a7`; extraction fingerprint: `ecc40b264edddaa3a7f4392bc518b968ebc7124433d6cba568af1bf66d0f1a60`.
- Draft-assisted admission-report SHA-256: `c3dbc56ce271a78779aadcc250ed4bed9e9935741928d333640fae4d87fe0572`; extraction fingerprint: `951ae85878ff1a3938943687704b2f7d9d8ace82c9cc9897becc0056e50f3621`.
- Both runs: reviewed-input fingerprint `2cc120b6ad8dd1d18f2f703c5ecb89253de4621c8dea7d7a85c1b627c6b8b891`; legal-resource fingerprint `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e`.

The initial catalog suite ran alongside the large draft-assisted preview and exited 1: 26 files passed, 2 failed; 447 tests passed, 2 failed; 67.40 seconds. Two existing CLI tests exceeded their 5,000 ms budgets: the default-directory preservation case in `preview.test.ts` (6,338 ms) and the deterministic preparation case in `release-operator.test.ts` (5,535 ms). The latter also reported `ENOTEMPTY` during cleanup after timeout. All batch/hold tests passed. A two-worker rerun after both corpus previews finished still hit the same two timeouts: 26 files/447 tests passed, 2 files/2 tests failed; exit 1, 104.12 seconds. The final run uses the repository’s existing `CI=true` configuration, which grants 15,000 ms per test, with two workers; no tracked test, assertion or configuration is changed.

The final catalog run passed all 28 files and 449 tests in 120.29 seconds, exit 0. The release-operator case completed in 9,478 ms; the only duration-budget warning was that it consumed 63% of its CI timeout. Vitest’s reported start time, 19:25:32, is local Europe/Stockholm time. This establishes passing assertions with the configured CI budget; the plain five-second local runs remain recorded failures.

## Phase timing and handoff

Approximate elapsed windows on 2026-10-07 (UTC; phases overlap): briefing/policy/source review 17:10–17:13, three minutes; Registry/evidence/test implementation 17:12–17:15, three minutes; operator commands and verification 17:12–17:28, sixteen minutes; reporting and final audit 17:16–17:28, twelve minutes. Overall elapsed time was about eighteen minutes; these overlapping windows are not additive.

Only the Registry, enforced holds, batch inventory, focused test and this report changed. Scratch drafts, previews, logs, temporary executables and cache/package directories were removed after recording results. Changes remain uncommitted. No commits, pushes, issues, PRs, deployments, environment-file accesses, private E2E accesses or upstream changes were made.

## Workflow observations

- Validate unique notice hashes when slicing tickets. This inventory repeats Disenchanter’s line-90 hash while adjacent line 91 differs by a trailing space; preserve physical bytes and account for duplicates explicitly.
- The plain five-second test budget is sensitive to CLI subprocess costs on this host, even with two workers after corpus commands finish. The existing CI budget allowed all assertions to pass. Serialize heavy operator work and select the appropriate existing test budget in the pilot harness; do not treat timeouts or their cleanup races as a content-review failure.
- Keep the worktree-local `TMPDIR` and CommonJS package boundary in the harness, as the precedent requires. The Registry’s reviewer remains free-text provenance; the batch inventory supplies structured reviewer/date evidence. Requested Opus/Fable model names are unavailable in this environment, so implementation delegation used the available inherited model.
