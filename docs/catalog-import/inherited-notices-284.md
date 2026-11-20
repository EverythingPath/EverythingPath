# Inherited notice review: #284

Reviewed 2026-10-08 by **Sol (AI curator) for the owner**, following [#264](inherited-notices-264.md) and [#283](inherited-notices-283.md). This batch reviews the fifteen immutable source-block keys in [#284](https://github.com/AndreasUnunger/EverythingPath/issues/284). It establishes compilation-level notice evidence; full-book chains and unresolved variant comparisons remain held.

## Evidence and disposition

Every key matches SHA-256 of one complete UTF-8 physical line, excluding its newline, in pinned `pf1-content/OGL.txt` lines 338–352. None is a heading or wrapped fragment; no joining, trimming, normalization or correction is required. Full identities, comparisons and holds are recorded in [inherited-notices-284.json](../../scripts/catalog/legal/inherited-notices-284.json); verbatim text, reviewer/date and provenance are recorded in the [Section 15 Registry](../../src/lib/catalog/data/section15-registry.json).

- Compilation: `pf1-content` 11.4.0, commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`, [OGL.txt lines 338–352](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d/OGL.txt#L338-352), file SHA-256 `10bcdc68296b48cc250f38e49de09c9a73645163d7ac7f76e77346a755c35cdc`.
- Comparison: `foundryvtt-pathfinder1` v11.11, commit `418761d2e16a6037c0156bb4a241f7cea5a2986d`, [OGL.txt](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/OGL.txt), file SHA-256 `0464e2f13f24c742dc3c2a4c788aab9ab24ca9809873192551b77f784a50d7f9`. None of the fifteen notices is byte-identical to a system notice.

All rows are **reviewed verbatim; complete-book chain held**. Both Murder’s Mark variants also retain an explicit variant-comparison hold. Titles below omit their common literal `Pathfinder Module` prefix.

| Key prefix  | Line | Notice title                                        | Copyright year |
| ----------- | ---- | --------------------------------------------------- | -------------- |
| `7a852351…` | 338  | S1: Clash of the Kingslayers                        | 2009           |
| `1802491c…` | 339  | Academy of Secrets                                  | 2011           |
| `e3142629…` | 340  | Carrion Hill                                        | 2009           |
| `c15c9818…` | 341  | City of Golden Death                                | 2010           |
| `bd7f205e…` | 342  | Crypt of the Everflame                              | 2009           |
| `5f585bc4…` | 343  | Cult of the Ebon Destroyers                         | 2011           |
| `83984e93…` | 344  | Curse of the Riven Sky                              | 2010           |
| `3f61d498…` | 345  | Emerald Spire                                       | 2014           |
| `bc43227c…` | 346  | Feast of Ravenmoor                                  | 2011           |
| `e8d49fb7…` | 347  | From Shore to Sea                                   | 2010           |
| `6056d303…` | 348  | Masks of the Living God                             | 2009           |
| `44903a5b…` | 349  | Master of the Fallen Fortress                       | 2010           |
| `1ef49ced…` | 350  | Murder's Mark (ASCII apostrophe; no space before ©) | 2012           |
| `1896d6dc…` | 351  | Murder’s Mark (curly apostrophe; space before ©)    | 2012           |
| `39566286…` | 352  | Plunder & Peril                                     | 2014           |

Literal punctuation, copyright notation, publisher wording and contributor names remain unchanged. In particular, line 342 has no separator between `Everflame` and `Copyright`, line 345 uses `Emerald Spire, ©`, and lines 350–351 are distinct physical notices. No canonical printed wording, equivalence, product-code alias or book-title alias is inferred. Line 345 is not silently equated with the differently worded out-of-batch `The Emerald Spire Superdungeon` notice on line 356. `checkedAgainst: "pf1-content"` describes the permitted compilation actually compared; review dates are separate from copyright years.

## Policy boundary and holds

[#224](https://github.com/AndreasUnunger/EverythingPath/issues/224#issuecomment-5939689134) identifies permitted compilations and their defects. [#227](https://github.com/AndreasUnunger/EverythingPath/issues/227#issuecomment-5948780647) permits compilation verification and permanent notice retention. [#241](https://github.com/AndreasUnunger/EverythingPath/issues/241#issuecomment-5955002698) supersedes earlier attribution policy: admission needs current content-bound evidence and every required reviewed notice. [PRD decision 17 and its acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461) preserve these boundaries. Neither this batch nor Registry completeness establishes legal sufficiency or full content coverage.

The compilation does not delineate each book’s complete inherited notice chain. All fifteen `notice-284-complete-chain-<hash>` holds and the two `notice-284-murders-mark-variant-350` / `-351` holds are registered in [held-notices.json](../../scripts/catalog/legal/held-notices.json), following [curation.md](curation.md#notice-holds-from-content-batches). An otherwise-current assessment requiring a held key remains held, even when that Registry notice is reviewed. Resolving a variant requires permitted evidence for its wording and any proposed equivalence; resolving a full chain requires the complete inherited chain.

All existing notices, permanent notice versions and holds remain unchanged. No Attribution Assessment is added, changed or rebound. No prior-use inventory was supplied, so this batch asserts or clears no actual retained exception. Synthetic test uses demonstrate the retained-content policy only. No batch discrepancy required by admitted content is silently resolved by guessing.

## Verification

Operator commands use the verified pinned checkouts above. Temporary outputs and process temporary directories are confined to ignored `.scratch/curation-284/`, with a CommonJS package boundary for subprocess fixtures. Notice keys do not select Catalog Entries, so these corpus operators run without `--candidates`. The full test suite remains the orchestrator’s landing gate.

```sh
mkdir -p .scratch/curation-284/tmp
export TMPDIR="$PWD/.scratch/curation-284/tmp"
printf '{"type":"commonjs"}\n' > "$TMPDIR/package.json"
PF1_CURATION_SYSTEM="/home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1"
PF1_CURATION_CONTENT="/home/andreas/repos/everythingpath/sources/pf1-content"
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm catalog:format --check
pnpm catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-284/drafts
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-284/preview
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --curation .scratch/curation-284/drafts/records.json --out .scratch/curation-284/preview-drafts
CI=true pnpm test tests/catalog/inherited-notices-284.test.ts tests/catalog/notice-holds.test.ts --maxWorkers=2
CI=true pnpm test tests/catalog --maxWorkers=2
git diff --check
```

The [36 focused batch tests](../../tests/catalog/inherited-notices-284.test.ts) prove exact immutable identities against independently pinned committed source bytes, literal wording and dates, provenance, absent aliases, all seventeen enforced holds, legal-page generation, permanent retention, separate content evidence, stale evidence/content/notice bindings, unrelated admission and synthetic retained exceptions. Both hold-scanner tests also pass. No product-code fix or Convex integration test is needed.

A direct `buildLegalPageData` invocation with all fifteen keys produced four sections, fifteen Registry notices and eighteen total Section 15 entries, with zero outstanding notices/resources. Removing requirements and Registry records while carrying that permanent superset retained every entry unchanged. This rehearsal does not turn held-only keys into release requirements.

Independent comparisons against the read-only pinned sources passed. Exactly fifteen Registry records and seventeen enforced hold registrations are added; all 295 previous Registry records and 755 previous hold registrations remain unchanged, giving totals of 310 and 772. Legal resources, content assessments and attribution evidence remain unchanged.

| Check                                            | Result                                                                                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm -s typecheck`                              | Pass, exit 0; repeated with the final data and batch tests                                                                     |
| `pnpm -s lint`                                   | Pass, exit 0; repeated after implementation                                                                                    |
| `pnpm -s check:initial-migration-writers`        | Pass, exit 0; 183 registrations checked                                                                                        |
| `pnpm catalog:pin`                               | Pass, exit 0; `sha256:d7a42ca346d875f9497c7da94325022ac289d7931226a3649979a13f410c8063`                                        |
| `pnpm catalog:format --check`                    | Pass, exit 0; shared data files are canonical                                                                                  |
| `catalog:curate`                                 | Exit 0; 5,208 records, 3,583 new drafts, zero replacements/missing bindings, 758 unresolved mechanics; coverage remains failed |
| Default `catalog:preview`                        | Expected gate exit 1; 56 admitted, 23,126 held, two dependent omissions, zero retained exceptions, 4,689 failures              |
| Draft-assisted `catalog:preview`                 | Expected gate exit 1; same admission dispositions, 1,864 failures                                                              |
| Focused batch and hold tests                     | Pass, exit 0; 36 batch tests and two hold-scanner tests, 1.27 seconds                                                          |
| `CI=true pnpm test tests/catalog --maxWorkers=2` | Pass, exit 0; 62 files, 1,337 tests, 88.99 seconds                                                                             |
| Prettier and `git diff --check`                  | Pass                                                                                                                           |

Both previews verify the required source commits and extract 23,037 Catalog Entries plus 538 resources. Default failures comprise 3,583 missing curation records, 715 unaccounted inventory records and 391 broken references. Supplying drafts replaces the missing-record failures with 758 unresolved mechanics; inventory/reference gaps remain. Both previews have zero stale or unused curation records. These corpus gaps are outside this notice batch. Required notices are only `PZO1110`, with zero outstanding notices/resources; no batch key is required by admitted or retained content. No unresolved discrepancy needed by admitted content is identified in this batch. Greater Vital Strike (`pf1/zKNk7a4XxXsygJ67`) and Lightning Stance (`pf1/jbvXxHpu7BVbCpwr`) remain dependent omissions. Temporary drafts do not establish content attribution.

| Artifact fingerprint     | Default preview                                                    | Draft-assisted preview                                             |
| ------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Admission-report SHA-256 | `ae0645e9387e22301719b1b29edf37fa8a39db704b2cba5e36d57fc53c152401` | `cb7da2cd2e561ee95d775c2265e3ed099d236d55f09851116d4964685768ec8b` |
| Extraction               | `131010a8beab85fcea144e8820b2f2715880eb2f8e7ce19b998666115dd9e08d` | `ef3fccdd8dbd9790f072e136da025b38881bfedb4460664806e021a0e828d4aa` |
| Reviewed inputs          | `7e78f31bf08972c7ccbc2670e1680d20c0aee7e2c1da275920412155f08c0b6a` | Same                                                               |
| Legal resources          | `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e` | Same                                                               |

## Handoff and workflow observations

Five files change: Registry, batch evidence, enforced holds, focused tests and this report. Changes remain uncommitted for the orchestrator. Only `.scratch/curation-284/` is removed after recording results; both pinned checkouts remain clean. No product code, environment files or private E2E material is changed. No deployment, release activation, issue write, commit or push is performed. The full test suite is left to the orchestrator.

- Reviewer metadata lives in free-text Registry provenance; structured batch evidence makes the review auditable.
- Full-corpus drafting and previews repeat expensive extraction for every notice batch. A bounded notice rehearsal command could reduce that work while retaining final corpus gates.
- Worktree-local temporary directories need a CommonJS package boundary for extensionless subprocess fixtures; keep that setup in the batch harness. Cleanup must target only the batch directory because `.scratch/` contains tracked historical documents.
- #257 still reports `OPEN`, despite the landed admission/legal-page implementation exercised here and noted by #264. Reconcile tracker state before using it to schedule batches. Requested Opus/Fable model names are unavailable in this tool environment; implementation uses the available inherited model.

Approximate overlapping UTC phase windows on 2026-10-08: brief/policy/source review 08:00–08:04 (four minutes); Registry/evidence/tests 08:02–08:07 (five minutes); operators/checks 08:02–08:12 (ten minutes); report/audit/cleanup 08:05–08:13 (eight minutes). Overall elapsed time is about thirteen minutes; phase durations overlap. Vitest timestamps use local Europe/Stockholm time.
