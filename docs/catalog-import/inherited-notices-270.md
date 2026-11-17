# Inherited notice review: #270

Reviewed by **Sol (AI curator) for the owner** on **2026-10-08** (Europe/Stockholm). [Ticket #270](https://github.com/AndreasUnunger/EverythingPath/issues/270) supplies fifteen distinct immutable keys. This batch establishes compilation-level notice evidence, not content attribution or a new legal-sufficiency conclusion.

The [batch evidence](../../scripts/catalog/legal/inherited-notices-270.json) records full keys, source locations, hashes, comparisons and holds. The [Section 15 Registry](../../src/lib/catalog/data/section15-registry.json) preserves verbatim wording and reviewer/date provenance. All fifteen keys match complete physical UTF-8 notice lines, hashed without their line ending or any normalization. No headings, fragments, joins or aliases are involved.

| Key prefix (full keys in batch evidence) | OGL.txt line | Notice | Copyright date | Disposition |
| --- | --- | --- | --- | --- |
| `ed3df54e` | 128 | Giant, Wood, Tome of Horrors Complete | 2011 | Reviewed compilation line; chain and wording discrepancy held |
| `066b62b9` | 129 | Gloomwing, Tome of Horrors Complete | 2011 | Reviewed compilation line; complete chain held |
| `eedc493e` | 130 | Gods and Magic | 2008 | Reviewed compilation line; complete chain held |
| `5c7e7fd3` | 131 | Golem, Wood, Tome of Horrors Complete | 2011 | Reviewed compilation line; complete chain held |
| `26da0efc` | 132 | Great Sea Anemone, Tome of Horrors Complete | 2011 | Reviewed compilation line; complete chain held |
| `e95c17a3` | 133 | Grippli, Tome of Horrors Complete | 2011 | Reviewed compilation line; complete chain held |
| `fc6ef4ac` | 134 | Gryph, Tome of Horrors Complete | 2011 | Reviewed compilation line; complete chain held |
| `936cc2c5` | 135 | Gryph, Tome of Horrors, Revised | 2002 | Reviewed distinct edition; complete chain held |
| `9c410359` | 136 | Guide to Korvosa | 2008 | Reviewed compilation line; complete chain held |
| `3ceb4b45` | 137 | Guide to Pathfinder Society Organized Play v2.2 | 2010 | Reviewed specific version; complete chain held |
| `cbbc41de` | 138 | Hangman Tree, Tome of Horrors Complete | 2011 | Reviewed compilation line; complete chain held |
| `8e78afdd` | 139 | Hippocampus, Tome of Horrors Complete | 2011 | Reviewed compilation line; complete chain held |
| `939759a3` | 140 | Horror Adventures | 2016 | Reviewed compilation line; complete chain held |
| `21400050` | 141 | Huecuva, Tome of Horrors Complete | 2011 | Reviewed compilation line; complete chain held |
| `113a4168` | 142 | Ice Golem, Tome of Horrors Complete | 2011 | Reviewed compilation line; complete chain held |

## Evidence and holds

The content checkout is `pf1-content` 11.4.0 at `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`, [OGL.txt lines 128–142](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d/OGL.txt#L128-142), complete-file SHA-256 `10bcdc68296b48cc250f38e49de09c9a73645163d7ac7f76e77346a755c35cdc`. The preserved system notice is from `foundryvtt-pathfinder1` v11.11 at `418761d2e16a6037c0156bb4a241f7cea5a2986d`, [OGL.txt](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/OGL.txt), SHA-256 `0464e2f13f24c742dc3c2a4c788aab9ab24ca9809873192551b77f784a50d7f9`.

[#224](https://github.com/AndreasUnunger/EverythingPath/issues/224#issuecomment-5939689134) identifies permitted compilations and known defects. [#227](https://github.com/AndreasUnunger/EverythingPath/issues/227#issuecomment-5948780647) permits compilation verification and permanent notice retention. [#241](https://github.com/AndreasUnunger/EverythingPath/issues/241#issuecomment-5955002698) supersedes its attribution/admission policy: every admitted definition needs current content-bound evidence as well as reviewed notices. [PRD #251 decision 17 and the acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461) preserve these boundaries.

The [owner's Bestiary 6 seed transcription](https://github.com/AndreasUnunger/EverythingPath/issues/227#issuecomment-5948776405) contains the 2011 Gryph and Huecuva notices verbatim. Its Wood Giant line instead says `Author:` where the compilation says `Authors:`. The inherited compilation spelling remains unchanged; resolving that discrepancy requires the owner's PDF comparison. Neither matching lines nor the owner's seed establish printed verification or the complete book chain. The existing owner Registry record stays unreviewed.

The 2002 and 2011 Gryph notices remain separate records. The Society Guide v2.2 line does not resolve the separate free-PDF PFS Roleplaying Guild Guide transcription gap. Horror Adventures is not the held Horror Realms book. Literal author labels, punctuation and dates remain intact.

Fifteen named `notice-270-complete-chain-<full hash>` holds remain in the batch evidence and are enforced in [held-notices.json](../../scripts/catalog/legal/held-notices.json). The compilation does not group complete inherited chains by book or establish every book inheriting an individual creature notice. The Wood Giant hold additionally records its unresolved wording discrepancy. No product-code or book-title alias, Attribution Assessment or new shipping content evidence is created. Existing source holds, Ultimate Combat/Occult Mysteries corrections, free-PDF gaps and owner PDF checks remain. No prior-use inventory is supplied, so no actual retained exception is asserted or cleared. Both complete upstream notice blocks and the permanent notice superset are preserved.

## Verification

Commands use the pinned read-only checkouts. Scratch files and process temporary directories stay in ignored `.scratch/`; `tmp/package.json` supplies a CommonJS boundary for temporary test executables. Notice keys are not catalog candidate IDs, so full-corpus previews accompany the bounded notice tests.

```sh
mkdir -p .scratch/tmp
printf '{"type":"commonjs"}\n' > .scratch/tmp/package.json
export TMPDIR="$PWD/.scratch/tmp"
PF1_CURATION_SYSTEM="$PWD/../sources/foundryvtt-pathfinder1"
PF1_CURATION_CONTENT="$PWD/../sources/pf1-content"
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm catalog:format --check
pnpm catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/drafts
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/preview
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --curation .scratch/drafts/records.json --out .scratch/preview-drafts
pnpm test tests/catalog/inherited-notices-270.test.ts tests/catalog/notice-holds.test.ts
CI=true pnpm test tests/catalog --maxWorkers=2
git diff --check
```

The [27 focused batch tests](../../tests/catalog/inherited-notices-270.test.ts) exercise exact pinned notice bytes, metadata and aliases, legal-page retention, fresh content bindings with each enforced hold, missing independent assessment, an unheld synthetic control, stale/missing/unreviewed notices, and edition/transcription boundaries. These fixtures demonstrate gate behavior without certifying imported content. Both hold-registration tests also pass.

A direct `buildLegalPageData` invocation using all fifteen batch keys produced four sections and eighteen notices: fifteen Registry records, both upstream blocks and the project line. Outstanding notices/resources were empty. Removing all requirements and Registry entries retained the complete returned superset. Independent comparison against both pinned checkout files passed, including every block's raw bytes and full-file hash. All 89 prior Registry records and 250 prior hold registrations remain equal to `HEAD`; totals are now 104 records and 265 holds. No product-code fix was needed.

The full test suite is reserved for the orchestrator's landing gate; this batch changes no Convex or product code and needs no Convex integration test.

| Check | Result |
| --- | --- |
| `pnpm -s typecheck` | Pass, exit 0; final run includes completed test/data files |
| `pnpm -s lint` | Pass, exit 0 |
| `pnpm -s check:initial-migration-writers` | Pass; 183 registrations checked |
| `pnpm catalog:pin` | Pass; `sha256:71c66667344e200747085cc47660277a9e7677da10cdd3d58033591444baa25b` |
| `pnpm catalog:format --check` | Pass; canonical shared data |
| `catalog:curate` | Exit 0; 4,251 records, 3,628 new drafts, 0 missing bindings, 763 unresolved mechanics; coverage remains failed |
| Default `catalog:preview` | Expected gate exit 1; 53 admitted, 23,129 held, 2 dependent omissions, 0 retained exceptions, 4,734 failures |
| Draft-assisted `catalog:preview` | Expected gate exit 1; same dispositions, 1,869 failures |
| Focused batch and hold-registration tests | Pass; 29 tests across 2 files |
| `CI=true pnpm test tests/catalog --maxWorkers=2` | Pass, exit 0; 36 files, 575 tests, 45.31 seconds |
| `git diff --check` | Pass |

Both previews verify both required commits and extract 23,037 entries plus 538 resources. Holds comprise 22,401 missing Attribution Assessments and 728 existing source/content-assessment holds. Greater Vital Strike (`pf1/zKNk7a4XxXsygJ67`) is omitted because Improved Vital Strike (`pf1/DorPGQ2mifJbMKH8`) remains held; Lightning Stance (`pf1/jbvXxHpu7BVbCpwr`) is omitted because Wind Stance (`pf1/9p0aAtCyLdcwnftS`) remains held. Admitted content requires only `PZO1110`; outstanding notices/resources are empty. Held-only batch notices do not become admitted requirements. No admitted definition requires a batch key, so the unresolved Wood Giant discrepancy does not require a replacement notice for currently admitted content.

Default failures comprise 3,628 missing curation records, 715 unaccounted inventory records and 391 broken references. Draft-assisted failures replace missing records with 763 unresolved mechanics and retain the same 1,106 inventory/reference failures. These corpus-wide gaps remain outside this notice batch. Drafts do not establish reviewed Attribution Assessments.

Both previews use final reviewed-input fingerprint `75c0a3d3399326b6ecebb674d4dd9dcbca68808f02203123a8c03ad70477a012` and unchanged legal-resource fingerprint `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e`. The default admission-report SHA-256 is `db360e3051d604933c0ab1faea47494bc4f4d04725eaad494395cced27114e2f`; extraction fingerprint `d7e2b89c12b5639475cca600451aa7ceebcef96ceef5eed8be2aff0e3ad17f05`. Draft-assisted admission-report SHA-256 is `46bb3f5f282fdc8f04302c76d117f1bff7c89c4e5803aea2a25fbc89aa3359fa`; extraction fingerprint `f44254005f4e6568e78bdd3e75a72663795807e0bcab50b33fc9c94228ba246f`. These identify the observed artifacts after scratch cleanup.

An initial draft-assisted preview exited 1 with `ENOENT` because it was launched before the drafter had written `records.json`. It produced no admission report. The dependent command was rerun after drafting completed.

## Phase timing and handoff

Approximate UTC windows on 2026-10-07: briefing/policy/source review 22:17–22:19, two minutes; artifact and test implementation 22:18–22:20, two minutes; commands and verification 22:18–22:26, eight minutes; reporting and final audit 22:20–22:27, seven minutes. Work overlaps, so phase windows are not additive; overall elapsed time is about ten minutes. The review date is October 8 in Europe/Stockholm.

Only the Registry, enforced holds, batch evidence, focused test and this report changed. Scratch drafts, reports, logs, cached issue evidence and temporary files were removed after recording results. Changes remain uncommitted. No commits, pushes, issues, PRs, deployments, environment-file accesses, private E2E accesses or upstream changes were made. The final handoff uses the launcher's output handling; no answer file is placed in the repository.

## Workflow observations

- Registry reviewer information lives in provenance; the structured batch evidence supplies an auditable reviewer/date inventory.
- #257 remains open despite its landed gate implementation. The explicit pilot brief authorizes exercising that implementation; reconcile tracker state before automated scheduling.
- Opus/Fable model names and the nested foreground flag in repository guidance are unavailable through this environment's agent API. Implementation uses available inherited-model subagents, with results collected before completion.
- The launcher's `-o` path is absent from supplied context. No answer file is created in the repository.
- Draft-assisted preview depends on the drafter's completed output. Await that artifact before starting the dependent command.
