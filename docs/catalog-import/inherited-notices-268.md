# Inherited notice review: #268

Reviewed by **Sol (AI curator) for the owner** on **2026-10-07**. [Ticket #268](https://github.com/AndreasUnunger/EverythingPath/issues/268) lists fifteen occurrences of fourteen unique immutable keys. This review finishes the interrupted batch against the pinned source, preserving correct partial artifacts. It establishes compilation-level notice evidence, without establishing content attribution or legal sufficiency.

The [batch inventory](../../scripts/catalog/legal/inherited-notices-268.json) records every full key, physical line, hash, disposition, comparison and hold. The [Section 15 Registry](../../src/lib/catalog/data/section15-registry.json) preserves verbatim text and reviewer/date provenance. All fourteen blocks are complete physical notice lines, with no headings or wrapped fragments to join. Aliases and `joinedWith` lists are empty.

| Occurrence | Hash prefix | Line | Notice | Copyright date | Disposition |
| --- | --- | --- | --- | --- | --- |
| 1 | `17e79ea7` | 98 | Flail Snail, Complete | 2011 | Reviewed; chain held |
| 2 | `6cb50c3e` | 99 | Flind and flindbar, Complete | 2011 | Reviewed verbatim; chain and editorial wording held |
| 3 | `1eea69dd` | 100 | Flind, Complete | 2011 | Reviewed; chain held |
| 4 | `8478bb33` | 101 | Flumph, Complete | 2011 | Reviewed; chain held |
| 5 | `3f9e7d44` | 102 | Foo Creature, Complete | 2011 | Reviewed; chain held |
| 6 | `ab61a469` | 103 | Forlarren, Complete | 2011 | Reviewed; chain held |
| 7 | `03519564` | 104 | Frog, Giant Dire (Abyssal), Complete | 2011 | Reviewed; chain held |
| 8 | `98002441` | 105 | Frog, Giant Dire, Complete | 2011 | Reviewed; chain held |
| 9 | `5e006fac` | 106 | Froghemoth, Complete | 2011 | Reviewed; chain held |
| 10 | `5e006fac` | 106 | Froghemoth, Complete | 2011 | Duplicate of occurrence 9; same record and hold |
| 11 | `a94f2e92` | 108 | Froghemoth, Revised | 2002 | Reviewed; chain held |
| 12 | `fdb37c32` | 109 | Froghemoth, unqualified Tome of Horrors | 2002 | Reviewed; chain held |
| 13 | `219fdea2` | 110 | GameMastery Module D0: Hollow’s Last Hope | 2007 | Reviewed; chain held |
| 14 | `f8030214` | 111 | GameMastery Module D1: Crown of the Kobold King | 2007 | Reviewed; chain held |
| 15 | `5b39f67b` | 112 | GameMastery Module D2: Seven Swords of Sin | 2007 | Reviewed; chain held |

## Evidence and unresolved holds

Source evidence is [pf1-content 11.4.0 OGL.txt, lines 98–112](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d/OGL.txt#L98), commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`, complete-file SHA-256 `10bcdc68296b48cc250f38e49de09c9a73645163d7ac7f76e77346a755c35cdc`. Independent comparison also verifies the system's `v11.11` commit `418761d2e16a6037c0156bb4a241f7cea5a2986d` and OGL file SHA-256 `0464e2f13f24c742dc3c2a4c788aab9ab24ca9809873192551b77f784a50d7f9`. Immutable keys hash the complete UTF-8 physical line without its line ending; no trimming or normalization is applied.

[#224](https://github.com/AndreasUnunger/EverythingPath/issues/224#issuecomment-5939689134) identifies permitted compilations and known defects. [#227](https://github.com/AndreasUnunger/EverythingPath/issues/227#issuecomment-5948780647) permits compilation verification and requires permanent notice retention. The later [#241 resolution](https://github.com/AndreasUnunger/EverythingPath/issues/241#issuecomment-5955002698) requires current content-bound Attribution Assessments and reviewed notices for admission. [PRD #251 decision 17 and its acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461) preserve these boundaries. No seed, name match or broad notice set supplies a content assessment.

Line 107 repeats line 106 with one trailing ASCII space; its hash is `526d170a2557eb6c0ef684afbfe8fbc710d0654c3a2ff84f27d9606a646ee587`. The ticket instead repeats line 106's key. No Registry record or alias is created for the unlisted variant; both physical lines remain in the permanent upstream notice block. The Complete 2011, Revised 2002 and unqualified 2002 Froghemoth notices remain separate. Literal author labels, `Revised.©`, and D0/D1 comma versus D2 period punctuation are retained.

Line 99 literally includes `XXinclude flindbar citation only if relevant.` The permitted evidence does not resolve the intended citation or editorial instruction. `notice-268-flindbar-editorial-wording` holds that unresolved wording while preserving the complete line. The adjacent Flind notice is not a correction or alias.

Fourteen `notice-268-complete-chain-<full hash>` holds name the missing complete book-chain and alias evidence. These and the editorial hold are enforced in [held-notices.json](../../scripts/catalog/legal/held-notices.json), following [the curation convention](curation.md#notice-holds-from-content-batches). Even a current synthetic assessment requiring a batch notice remains held. Unrelated accepted content can still pass. No product-code or book-title alias, Attribution Assessment or shipping content evidence is invented.

All 61 prior Registry records and 172 prior hold registrations remain equal to `HEAD`. Existing named source exclusions, Ultimate Combat/Occult Mysteries corrections, free-PDF gaps and owner-transcription PDF checks remain unresolved. The complete upstream blocks and committed permanent notice superset remain unchanged. No prior-use inventory was supplied, so no actual retained exception is asserted or cleared.

## Verification

Commands use the pinned read-only sibling checkouts. Scratch files and process temporary directories stay in ignored `.scratch/curation-268/`; `tmp/package.json` contains `{"type":"commonjs"}`. Notice hashes are not catalog candidate IDs, so full-corpus commands accompany the bounded notice tests.

```sh
export TMPDIR="$PWD/.scratch/curation-268/tmp"
PF1_CURATION_SYSTEM="/home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1"
PF1_CURATION_CONTENT="/home/andreas/repos/everythingpath/sources/pf1-content"
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm catalog:format --check
pnpm catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-268/drafts
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-268/preview
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --curation .scratch/curation-268/drafts/records.json --out .scratch/curation-268/preview-drafts
pnpm test tests/catalog/inherited-notices-268.test.ts tests/catalog/notice-holds.test.ts
CI=true pnpm test tests/catalog --maxWorkers=2
git diff --check
```

The [26 focused tests](../../tests/catalog/inherited-notices-268.test.ts) verify immutable source bytes, duplicate accounting, literal discrepancies, distinct versions, fourteen independent chain holds, the editorial hold, legal-page generation, permanent retention, and missing/stale/unreviewed evidence. Both hold-registration tests pass. Synthetic assessments prove gate behavior only, without certifying imported content. A direct legal-page invocation with all fifteen occurrences produced four sections and seventeen notices: fourteen Registry notices, both upstream blocks and the project line. Outstanding notices/resources were empty; removing all requirements and Registry records preserved the returned superset.

| Check | Result |
| --- | --- |
| `pnpm -s typecheck` | Pass, exit 0; repeated after the final test file was added |
| `pnpm -s lint` | Pass, exit 0 |
| `pnpm -s check:initial-migration-writers` | Pass; 183 registrations checked |
| `pnpm catalog:pin` | Pass; `sha256:71c66667344e200747085cc47660277a9e7677da10cdd3d58033591444baa25b` |
| `pnpm catalog:format --check` | Pass; canonical shared data |
| `catalog:curate` | Exit 0; 4,048 records, 3,628 new drafts, no missing bindings, 763 unresolved mechanics; coverage remains failed |
| Default `catalog:preview` | Expected gate exit 1; 52 admitted, 23,130 held, 2 dependent omissions, 0 retained exceptions, 4,734 failures |
| Draft-assisted `catalog:preview` | Expected gate exit 1; same dispositions, 1,869 failures |
| Focused batch and hold-registration tests | Pass; 28 tests across 2 files, 499 ms |
| `CI=true pnpm test tests/catalog --maxWorkers=2` | Pass, exit 0; 32 files, 500 tests, 75.61 seconds |
| `git diff --check` | Pass |

Both previews verify the required commits and extract 23,037 entries plus 538 resources. Holds comprise 22,601 missing Attribution Assessments, 32 known source notice/evidence holds and 497 existing content-assessment holds. Greater Vital Strike (`pf1/zKNk7a4XxXsygJ67`) is omitted because Improved Vital Strike (`pf1/DorPGQ2mifJbMKH8`) remains held; Lightning Stance (`pf1/jbvXxHpu7BVbCpwr`) is omitted because Wind Stance (`pf1/9p0aAtCyLdcwnftS`) remains held. Admitted content requires only `PZO1110`; outstanding notices/resources are empty. Held-only batch notices are not introduced as admitted requirements.

Default failures comprise 3,628 missing curation records, 715 unaccounted inventory records and 391 broken references. Draft-assisted failures replace missing records with 763 unresolved mechanics and retain the 1,106 inventory/reference failures. These corpus-wide gaps remain outside this batch. Drafts never become reviewed Attribution Assessments, and no product-code fix is required. The full `pnpm test` is reserved for the orchestrator's landing gate.

The catalog suite passed all assertions using the existing CI timeout configuration; no failing local-budget run was performed for this batch. Vitest's reported start time, 22:42:06, is local Europe/Stockholm time. No Convex integration test is needed because no backend or product code changed.

Durable default-preview fingerprints: admission-report SHA-256 `4b7f3982c393be05d706acf89a735a6ff66ab6a5ecf66edf57f934a2ac8e7971`; extraction `41b061dd560ee8fc2a468c381f59f9f222fa53657880d6a68f29a42601957deb`; reviewed inputs `782276594eea524de670cfa8189802d59983fcedda17f70cc09902ac0bafcf42`; legal resources `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e`.

The default command loaded the Registry before the final provenance-only clarification of duplicate Froghemoth occurrences. The final draft-assisted command supplies the current reviewed-input fingerprint, independently recomputed from the working tree: `ebe33bfad938ab32082fcb87f84f6144da84ae8ab3a18a6bf92aae9414cc44b5`. Its admission-report SHA-256 is `647f018ef41a9d4786e1f07e3e97686e8e3e086b49d6c4dc2e8fae33c5e8dd7e`; extraction fingerprint `fdba05045f6a1dea61eb52fd8fcf41e28846cb6e2fbe2a1b9917aeda4f46a0c2`; legal-resource fingerprint is unchanged. Both commands' observed dispositions are reported above.

## Phase timing and handoff

Approximate elapsed windows on 2026-10-07 (UTC; phases overlap): briefing/policy/source review 20:30–20:35, five minutes; artifact validation and test implementation 20:33–20:37, four minutes; operator commands and verification 20:35–20:44, nine minutes; reporting and final audit 20:38–20:46, eight minutes. Overall elapsed time was about sixteen minutes; overlapping windows are not additive.

Only the Registry, enforced holds, batch inventory, focused test and this report changed. Batch scratch drafts, reports, logs, cached issue evidence and process temporary files were removed after recording results. Pre-existing unrelated scratch material was preserved. Changes remain uncommitted. No commits, pushes, issues, PRs, deployments, environment-file accesses, private E2E accesses or upstream changes were made. The final handoff uses the launcher's output handling; no answer file is placed in the repository.

## Workflow observations

- Slice inventories by exact physical bytes and validate uniqueness. This ticket repeats line 106's hash while adjacent line 107 differs by a trailing space; both occurrences must be accounted for without substituting the unlisted variant.
- The Registry stores reviewer identity in free-text provenance. The structured batch inventory supplies reviewer/date, dispositions and evidence for audit.
- Worktree-local process temporary directories need a CommonJS package boundary for existing extensionless test executables. The catalog suite uses the existing CI budget (15 seconds instead of the local five seconds) and two workers after the CLI timeouts recorded in [#267's report](inherited-notices-267.md); no tracked timeout or assertion is changed.
- #257 still reports `OPEN`, despite the landed gate implementation exercised by this pilot. Reconcile tracker dependencies before using open/closed state to schedule later batches.
- Requested Opus/Fable model names and foreground flags are unavailable in this tool interface. The required implementation subagent used the available inherited model; the main session performed review, operator checks and reporting.
