# Inherited notice review: #283

Reviewed 2026-10-08 by **Sol (AI curator) for the owner**, following [#264](inherited-notices-264.md) and [#282](inherited-notices-282.md). All fifteen immutable keys in [#283](https://github.com/AndreasUnunger/EverythingPath/issues/283) are reviewed at compilation level. This establishes notice evidence, with complete-book chains held; it establishes neither content attribution nor printed verification or a new legal-sufficiency conclusion.

## Evidence and disposition

Each key is SHA-256 of one complete UTF-8 physical line, excluding its newline, in pinned `pf1-content/OGL.txt` lines 323–337. Independent raw-byte comparisons match the exact issue inventory. None is a heading or wrapped fragment; no joining, normalization or correction is required. Full identities and comparisons are in [inherited-notices-283.json](../../scripts/catalog/legal/inherited-notices-283.json); verbatim notices, reviewer/date and provenance are in the [Section 15 Registry](../../src/lib/catalog/data/section15-registry.json).

- Compilation: `pf1-content` 11.4.0, commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`, [OGL.txt lines 323–337](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d/OGL.txt#L323-337), file SHA-256 `10bcdc68296b48cc250f38e49de09c9a73645163d7ac7f76e77346a755c35cdc`.
- Comparison: `foundryvtt-pathfinder1` v11.11, commit `418761d2e16a6037c0156bb4a241f7cea5a2986d`, [OGL.txt](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/OGL.txt), file SHA-256 `0464e2f13f24c742dc3c2a4c788aab9ab24ca9809873192551b77f784a50d7f9`. None of the batch notices matches a system notice.

Every row is **reviewed verbatim; complete-book chain held**. The first thirteen titles below omit their shared literal `Pathfinder Companion: ` prefix.

| Key prefix  | Line | Notice title                                    | Copyright year |
| ----------- | ---- | ----------------------------------------------- | -------------- |
| `f47b35b2…` | 323  | Adventurer’s Armory                             | 2010           |
| `4c3226cd…` | 324  | Andoran, Spirit of Liberty                      | 2010           |
| `c2298dee…` | 325  | Cheliax, Empire of Devils                       | 2009           |
| `b2470bd2…` | 326  | Dwarves of Golarion                             | 2009           |
| `b5cc277d…` | 327  | Elves of Golarion                               | 2008           |
| `7c5ca526…` | 328  | Gnomes of Golarion                              | 2010           |
| `cc61730b…` | 329  | Legacy of Fire Player’s Guide                   | 2009           |
| `fef36dc5…` | 330  | Orcs of Golarion                                | 2010           |
| `412e4027…` | 331  | Osirion, Land of Pharaohs                       | 2008           |
| `d9646cc8…` | 332  | Qadira, Gateway to the East                     | 2009           |
| `8b0799f7…` | 333  | Sargava, the Lost Colony                        | 2010           |
| `bc7e3c11…` | 334  | Second Darkness Player’s Guide                  | 2008           |
| `2916a124…` | 335  | Taldor, Echoes of Glory                         | 2009           |
| `9167ad4a…` | 336  | Pathfinder Module LB1: Tower of the Last Baron  | 2008           |
| `4c3e42c8…` | 337  | Pathfinder Module LB2: Treasure of Chimera Cove | 2008           |

The notices preserve literal `Copyright`, `Paizo Publishing, LLC`, contributor labels, names and punctuation, including `Authors:Jonathan` on line 324, `Authors Jeff Quick` on line 327, the commas before `Copyright` on lines 327/331/336/337, and the period before `Author:` on lines 336/337. These are compilation wording, without independent evidence of a discrepancy requiring correction. No replacement wording, product-code or book-title alias is inferred. `checkedAgainst: "pf1-content"` describes the comparison performed; review dates remain separate from copyright years.

## Policy boundary and enforced holds

[#224](https://github.com/AndreasUnunger/EverythingPath/issues/224#issuecomment-5939689134) defines permitted evidence and compilation defects. [#227](https://github.com/AndreasUnunger/EverythingPath/issues/227#issuecomment-5948780647) permits compilation verification and permanent notice retention. [#241](https://github.com/AndreasUnunger/EverythingPath/issues/241#issuecomment-5955002698) supersedes earlier attribution policy: each admitted definition needs current content-bound evidence and all required reviewed notices. [PRD decision 17 and its acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461) retain these boundaries.

The compilation identifies individual notices but does not delineate each book’s complete inherited chain. All fifteen `notice-283-complete-chain-<hash>` holds are therefore retained and registered in [held-notices.json](../../scripts/catalog/legal/held-notices.json), following [curation.md](curation.md#notice-holds-from-content-batches). Reviewed Registry status does not lift these holds: otherwise-current synthetic assessments requiring a batch key remain held, while independently assessed unrelated content can pass. No additional wording hold is inferred from punctuation alone.

Existing Registry records, permanent notice versions and holds remain unchanged, including Ultimate Combat/Occult Mysteries corrections, owner-transcription checks, free-PDF gaps and known source-matched exclusions. No Attribution Assessment is created, changed or rebound. No prior-use inventory was supplied, so no actual retained exception is asserted or cleared.

## Verification

The [30 focused batch tests](../../tests/catalog/inherited-notices-283.test.ts) verify the independent immutable inventory, committed source bytes, literal wording, dates/provenance, absent aliases, all enforced holds, legal-page generation, permanent retention, separate content evidence, stale bindings, unrelated admission and synthetic retained exceptions. Fixture assessments/uses demonstrate behavior only; they are not shipping attribution evidence. No product-code fix or Convex integration test is required.

A direct `buildLegalPageData` invocation with the fifteen keys generated four sections, fifteen Registry notices and eighteen total Section 15 entries, with zero outstanding notices/resources. Removing all requirements and Registry records while carrying its permanent superset retained every entry identically. Held-only keys are not thereby made release requirements.

Independent source comparisons passed. Exactly fifteen Registry records and fifteen enforced holds are added; all 280 prior Registry records and 705 prior hold registrations remain unchanged, giving totals of 295 and 720 respectively. Legal resources and content assessments remain unchanged.

Scratch output and process temporary directories use ignored `.scratch/curation-283/`, with a CommonJS package boundary for subprocess fixtures. Notice keys cannot select Catalog Entries, so corpus operators run without `--candidates`.

```sh
mkdir -p .scratch/curation-283/tmp
export TMPDIR="$PWD/.scratch/curation-283/tmp"
printf '{"type":"commonjs"}\n' > "$TMPDIR/package.json"
PF1_CURATION_SYSTEM="/home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1"
PF1_CURATION_CONTENT="/home/andreas/repos/everythingpath/sources/pf1-content"
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm catalog:format --check
pnpm catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-283/drafts
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-283/preview
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --curation .scratch/curation-283/drafts/records.json --out .scratch/curation-283/preview-drafts
CI=true pnpm test tests/catalog/inherited-notices-283.test.ts tests/catalog/notice-holds.test.ts --maxWorkers=2
CI=true pnpm test tests/catalog --maxWorkers=2
git diff --check
```

| Check                                            | Result                                                                                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm -s typecheck`                              | Pass, exit 0; repeated with the final batch test                                                                               |
| `pnpm -s lint`                                   | Pass, exit 0; final focused ESLint also passed                                                                                 |
| `pnpm -s check:initial-migration-writers`        | Pass, exit 0; 183 registrations                                                                                                |
| `pnpm catalog:pin`                               | Pass, exit 0; `sha256:d7a42ca346d875f9497c7da94325022ac289d7931226a3649979a13f410c8063`                                        |
| `pnpm catalog:format --check`                    | Pass, exit 0                                                                                                                   |
| `catalog:curate`                                 | Exit 0; 5,008 records, 3,584 new drafts, zero replacements/missing bindings, 759 unresolved mechanics; coverage remains failed |
| Default `catalog:preview`                        | Expected gate exit 1; 54 admitted, 23,128 held, two dependent omissions, zero retained exceptions, 4,690 failures              |
| Draft-assisted `catalog:preview`                 | Expected gate exit 1; same admission dispositions, 1,865 failures                                                              |
| Focused batch and hold tests                     | Pass, exit 0; 30 batch tests and two hold-scanner tests, 746 milliseconds                                                      |
| `CI=true pnpm test tests/catalog --maxWorkers=2` | Pass, exit 0; 59 files, 1,225 tests, 72.34 seconds                                                                             |
| Prettier and `git diff --check`                  | Pass                                                                                                                           |

Both previews use verified pins and extract 23,037 Catalog Entries plus 538 resources. Default gate failures comprise 3,584 missing curation records, 715 unaccounted inventory records and 391 broken references. Supplying drafts replaces missing-record failures with 759 unresolved mechanics; the inventory/reference gaps remain. Both previews have zero stale or unused curation records. These corpus gaps are outside this notice batch. Required notices are only `PZO1110`, with zero outstanding notices/resources; no batch key is required by admitted or retained content. No discrepancy needed by admitted content remains unresolved in this batch. Greater Vital Strike (`pf1/zKNk7a4XxXsygJ67`) and Lightning Stance (`pf1/jbvXxHpu7BVbCpwr`) remain dependent omissions. Temporary drafts do not establish reviewed content attribution.

| Artifact fingerprint     | Default preview                                                    | Draft-assisted preview                                             |
| ------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Admission-report SHA-256 | `6ced77de2b7362c9bcebcb04da3f049ab8c06f4db45cfe52b0778a6663a04cac` | `102717bbbabc3af59e03ec22595a3aab8414ddb07a50d46573d945578d3dd0a2` |
| Extraction               | `b20a29920629862d4e2ad092f707e68dd40bcaeae6b28ed01f36aa1eb02f1c6f` | `690977b1692efa149956a93fc6c637ac5ef6966c0c5293920204a3fb7db60003` |
| Reviewed inputs          | `5ba42fb193c6d0d40b29ddd14e3214f521c026a6ece52b65aa9853b757e120ec` | Same                                                               |
| Legal resources          | `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e` | Same                                                               |

## Handoff and workflow observations

Five files change: Registry, batch evidence, enforced holds, focused tests and this report. No product code changes are needed. Changes remain uncommitted; the full test suite remains the orchestrator’s landing gate. Batch scratch files are removed after recording results; the pinned checkouts remain read-only.

- Reviewer metadata lives in free-text Registry provenance; structured batch evidence makes it auditable.
- Full-corpus drafting and previews repeat work for each notice batch. A bounded notice rehearsal command could reduce that cost while retaining final corpus gates.
- Reused fixtures need a fresh raw-text check: module notices use `LLC. Author:` and the LB2 notice’s year is 2008. Preparatory test expectations were corrected without changing source text or Registry notices.
- A worktree-local temporary directory needs a CommonJS boundary for extensionless subprocess fixtures; preserve that setup in the batch harness.
- Cleanup must target only the batch directory: `.scratch/` also contains tracked historical documents. All 25 tracked scratch documents accidentally removed during cleanup were restored byte for byte from `HEAD` and verified unchanged.

Approximate overlapping UTC phase windows on 2026-10-08: brief/policy/source review 07:26–07:29 (three minutes); Registry/evidence/tests 07:28–07:32 (four minutes); operators/checks 07:29–07:37 (eight minutes); report/audit/cleanup 07:30–07:43 (thirteen minutes). Overall elapsed time is about seventeen minutes; phase durations overlap. Vitest timestamps use local Europe/Stockholm time.
