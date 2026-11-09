# Inherited notice review: #266

Reviewed 2026-10-07 by **Sol (AI curator) for the owner**. This batch reviews the fifteen immutable blocks listed in [#266](https://github.com/AndreasUnunger/EverythingPath/issues/266). It establishes notice evidence, not content attribution or a new legal-sufficiency conclusion.

## Evidence and disposition

All fifteen hashes match complete physical UTF-8 notice lines, excluding the newline, in the pinned `pf1-content` compilation. None is a heading or wrapped fragment; no joining or text correction was required. Wording, copyright dates, punctuation and author spellings are retained verbatim. Review dates are separate from copyright dates.

- Content: `pf1-content`, tag `11.4.0`, commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`, [OGL.txt lines 68–82](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d/OGL.txt#L68-82), whole-file SHA-256 `10bcdc68296b48cc250f38e49de09c9a73645163d7ac7f76e77346a755c35cdc`.
- System legal resource: `foundryvtt-pathfinder1`, tag `v11.11`, commit `418761d2e16a6037c0156bb4a241f7cea5a2986d`, [OGL.txt](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/OGL.txt), whole-file SHA-256 `0464e2f13f24c742dc3c2a4c788aab9ab24ca9809873192551b77f784a50d7f9`.

The [batch inventory](../../scripts/catalog/legal/inherited-notices-266.json) records every full key, hash, source line, comparison and named hold. The [Section 15 Registry](../../src/lib/catalog/data/section15-registry.json) records the exact notices with `checkedAgainst: "pf1-content"`, reviewer/date and immutable source provenance. The Registry schema has no structured reviewer field, so provenance and the batch inventory record it. Every key has disposition `reviewed-notice` and an enforced complete-chain hold; every alias list and `joinedWith` list is empty.

| Key hash prefix | Source line | Notice | Copyright date |
| --- | --- | --- | --- |
| `354d4840` | 68 | Dark Creeper, Complete | 2011 |
| `04230b2d` | 69 | Dark Creeper, Tome of Horrors | 2002 |
| `dd635d26` | 70 | Dark Stalker, Complete | 2011 |
| `976cffba` | 71 | Dark Stalker, Tome of Horrors | 2002 |
| `034652f2` | 72 | Death Worm, Complete | 2011 |
| `b083c0e8` | 73 | Decapus, Complete | 2011 |
| `30ee3a94` | 74 | Demodand, Shaggy, Complete | 2011 |
| `db3003ab` | 75 | Demodand, Slime, Complete | 2011 |
| `6cab8092` | 76 | Demodand, Tarry, Complete | 2011 |
| `9ababf8f` | 77 | Demon Lord, Baphomet, Complete | 2011 |
| `51d06069` | 78 | Demon Lord, Dagon, Complete | 2011 |
| `18d94261` | 79 | Demon Lord, Jubilex, Complete | 2011 |
| `d00a8e73` | 80 | Demon Lord, Kostchtchie, Complete | 2011 |
| `be85cf55` | 81 | Demon Lord, Orcus, Complete | 2011 |
| `1072d65f` | 82 | Demon Lord, Pazuzu, Complete | 2011 |

## Comparisons and holds

[Decision #224](https://github.com/AndreasUnunger/EverythingPath/issues/224#issuecomment-5939689134) identifies the compilation evidence and known defects. [Decision #227](https://github.com/AndreasUnunger/EverythingPath/issues/227#issuecomment-5948780647) permits compilation-level verification and permanent notice retention. [Decision #241](https://github.com/AndreasUnunger/EverythingPath/issues/241#issuecomment-5955002698) supersedes the one-off attribution policy: admission also needs current content-bound evidence. [PRD decision 17 and its acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461) retain those boundaries.

Dark Creeper and Dark Stalker each have distinct 2002 and Complete 2011 notices. The 2002 lines do not say “Revised”; no edition equivalence is inferred. The [owner's Bestiary 6 transcription](https://github.com/AndreasUnunger/EverythingPath/issues/227#issuecomment-5948776405) has `Jubilex` and `Pazuzu` rather than `Demon Lord, Jubilex` and `Demon Lord, Pazuzu`, and says `based on original material` rather than `based on material`. The inventory records both comparisons and owner-text hashes. Neither wording is substituted or aliased; the owner transcription remains an unreviewed seed pending PDF comparison.

The compilation does not establish complete Tome of Horrors book notice chains or identify all Paizo books inheriting each excerpt. All fifteen `notice-266-complete-chain-<full hash>` holds are recorded in the inventory and enforced in [held-notices.json](../../scripts/catalog/legal/held-notices.json). The Jubilex/Pazuzu holds also name their unresolved wording-equivalence gaps. No book-title or product-code alias, Attribution Assessment or shipping content evidence is created. An otherwise current synthetic assessment requiring any batch key remains held.

Existing Dynamite, Thornkeep, Refuge of Time, Horror Realms and Shattered Star #4 holds remain, as do Ultimate Combat/Occult Mysteries correction requirements, free-PDF gaps and owner PDF checks. No prior-use inventory was supplied; this batch asserts or clears no actual retained exception. All 32 existing Registry records, prior hold entries, both complete upstream blocks, permanent notice versions, Attribution Assessments and attribution evidence remain unchanged.

## Verification

Commands use the pinned sibling checkouts. Temporary files and process temporary directories are confined to ignored `.scratch/curation-266/`; its `tmp/package.json` sets `{"type":"commonjs"}` so extensionless test executables do not inherit the repository's ESM scope. The notice keys are not catalog candidate IDs, so full-corpus operator commands are used alongside the bounded notice tests.

```sh
export TMPDIR="$PWD/.scratch/curation-266/tmp"
PF1_CURATION_SYSTEM="$PWD/../sources/foundryvtt-pathfinder1"
PF1_CURATION_CONTENT="$PWD/../sources/pf1-content"
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm catalog:format --check
pnpm catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-266/drafts
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-266/preview
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --curation .scratch/curation-266/drafts/records.json --out .scratch/curation-266/preview-drafts
pnpm test tests/catalog/inherited-notices-266.test.ts tests/catalog/notice-holds.test.ts
pnpm test tests/catalog
git diff --check
```

The [24 focused tests](../../tests/catalog/inherited-notices-266.test.ts) verify source bytes and boundaries, distinct versions and owner wording, legal-page generation, permanent retention, assessment requirements, stale notice bindings, missing/unreviewed notices and each chain hold independently. Both hold-registration tests also pass. Fixtures establish gate behavior only; their assessments are not shipping evidence.

A direct `buildLegalPageData` invocation with all fifteen batch keys produced four sections, fifteen Registry notices plus both upstream blocks and the project line (eighteen notices), with no outstanding notice/resource. Removing all requirements and Registry records while carrying the returned permanent superset retained every notice. Independent comparison against the actual pinned checkout also passed for all fifteen byte strings and hashes.

| Check | Result |
| --- | --- |
| `pnpm -s typecheck` | Pass, exit 0 |
| `pnpm -s lint` | Pass, exit 0 |
| `pnpm -s check:initial-migration-writers` | Pass, 183 registrations checked |
| `pnpm catalog:pin` | Pass; `sha256:6607d068facda14d40eddebe4e916952e8c668997ecadde9dbdc550e946f5518` |
| `pnpm catalog:format --check` | Pass; canonical shared data |
| `catalog:curate` | Exit 0; 3,924 records, 3,628 new drafts, no missing bindings, 763 unresolved mechanics; coverage remains failed |
| Default `catalog:preview` | Expected gate exit 1; 51 admitted, 23,132 held, 1 dependent omission, 0 retained exceptions, 4,734 failures |
| Draft-assisted `catalog:preview` | Expected gate exit 1; same dispositions, 1,869 failures |
| Focused batch and hold-registration tests | 26 passed (24 + 2) |
| `pnpm test tests/catalog` | Pass, exit 0; 27 files, 424 tests, 37.85 seconds |
| `git diff --check` | Pass |

Both previews verify the required commits and extract 23,037 entries plus 538 resources. Holds comprise 22,811 missing Attribution Assessments, 32 known notice/evidence holds and 289 existing content-assessment holds (53 races, 13 racial-HD and 223 feats). The dependent omission is Lightning Stance (`pf1/jbvXxHpu7BVbCpwr`), whose Wind Stance dependency (`pf1/9p0aAtCyLdcwnftS`) remains held. Only `PZO1110` is required by admitted content; outstanding notices and resources are empty. No held-only batch notice is inferred as an admitted requirement.

Default failures comprise 3,628 missing curation records, 715 unaccounted inventory records and 391 broken references. Draft-assisted failures replace missing bindings with 763 unresolved mechanics and retain the same 1,106 inventory/reference failures. These corpus-wide gaps remain outside this notice batch; drafts are not promoted to reviewed content assessments. No product-code fix is required. The full `pnpm test` is reserved for the orchestrator's landing gate.

Durable report fingerprints:

- Default admission-report SHA-256: `4c1162098f2469a4a644abd8ce793fe6be37e51df1da47dd20d09626da1c1f47`; extraction fingerprint: `ecc40b264edddaa3a7f4392bc518b968ebc7124433d6cba568af1bf66d0f1a60`.
- Draft-assisted admission-report SHA-256: `d913b3f4d1b9a0d931ae90d7aee9f85c0bd0436d3ca1a980079c9b189cc33fcb`; extraction fingerprint: `951ae85878ff1a3938943687704b2f7d9d8ace82c9cc9897becc0056e50f3621`.
- Both runs: reviewed-input fingerprint `6642d34ac65dd79091325e2e7737cb82fc78f5f06a0b5317fc2fc236a3e19858`; legal-resource fingerprint `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e`.

## Phase timing and handoff

Approximate elapsed windows on 2026-10-07 (UTC; work overlaps): briefing/policy/source review 16:35–16:38, three minutes; Registry/evidence/test implementation 16:36–16:40, four minutes; operator commands and verification 16:37–16:46, nine minutes; report writing and final audit 16:41–16:47, six minutes. Overall elapsed time was about twelve minutes; phase windows are not additive.

Only the Registry, enforced holds, batch inventory, focused test and this report changed. Scratch drafts, previews, logs and temporary package boundary were removed after recording results. Changes remain uncommitted; there were no pushes, issue/PR writes, deployments, environment-file accesses, private E2E accesses or upstream changes.

## Workflow observations

- Preserve the distinction between a verbatim creature excerpt, its complete inherited book chain and content-bound attribution. Do not label unqualified 2002 notices “Revised” or merge similar owner wording.
- The Registry stores the reviewer only in provenance; the structured batch inventory supplies an auditable reviewer/date without changing product code.
- Worktree-local temporary directories need the CommonJS package boundary used by the precedent. Include it in the pilot harness.
- One successful catalog operator test used 4,932 ms of its 5,000 ms timeout during concurrent checks. Account for this small margin when scheduling heavy corpus commands alongside test runs.
- #257 still reports `OPEN` although its gate tooling is landed and exercised here; reconcile tracker state before using blockers to schedule further batches. The requested Opus/Fable model names are unavailable in this tool environment; delegation used the available inherited model.
