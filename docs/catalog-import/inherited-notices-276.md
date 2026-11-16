# Inherited notice review: #276

Reviewed 2026-10-08 by **Sol (AI curator) for the owner**. This batch reviews the fifteen immutable notice keys in [#276](https://github.com/AndreasUnunger/EverythingPath/issues/276), following the [#264 precedent](inherited-notices-264.md). It establishes compilation-level notice evidence; content attribution, printed verification, complete book notice chains and legal sufficiency remain separate reviews.

## Evidence and disposition

Every key uniquely matches one complete physical UTF-8 line in the pinned `pf1-content/OGL.txt`, lines 218–232. SHA-256 excludes the newline and applies no trimming or normalization. None is a heading or wrapped fragment; no joining, correction or alias is needed. Full identities and per-line evidence are in [inherited-notices-276.json](../../scripts/catalog/legal/inherited-notices-276.json); verbatim notices are in the [Section 15 Registry](../../src/lib/catalog/data/section15-registry.json).

The permitted compilation is `pf1-content` 11.4.0, commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`, [OGL.txt lines 218–232](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d/OGL.txt#L218-232), file SHA-256 `10bcdc68296b48cc250f38e49de09c9a73645163d7ac7f76e77346a755c35cdc`. `checkedAgainst: "pf1-content"` identifies this comparison, not a printed-book comparison. Reviewer/date are recorded in Registry provenance and the structured inventory; the Registry has no separate reviewer field. The review date is distinct from each literal copyright date.

Every disposition below is **reviewed complete notice; complete-book chain held**. The key prefixes identify full immutable identities in the linked inventory.

| Key prefix | Line | Literal notice title | Copyright year |
| --- | --- | --- | --- |
| `00381dca…` | 218 | Pathfinder Adventure Path #33: The Varnhold Vanishing | 2010 |
| `f6361339…` | 219 | Pathfinder Adventure Path #34: Blood for Blood | 2010 |
| `4912a2fa…` | 220 | Pathfinder Adventure Path #35: War of the River Kings | 2010 |
| `f56da36a…` | 221 | Pathfinder Adventure Path #36: Sound of a Thousand Screams | 2010 |
| `53de1706…` | 222 | Pathfinder Adventure Path #37: Souls for Smuggler’s Shiv | 2010 |
| `61ff9eff…` | 223 | Pathfinder Adventure Path #38: Racing to Ruin | 2010 |
| `657d41ea…` | 224 | Pathfinder Adventure Path #39: City of Seven Spears | 2010 |
| `7b930b5f…` | 225 | Pathfinder Adventure Path #40: Vaults of Madness | 2010 |
| `a998ee58…` | 226 | Pathfinder Adventure Path #41: The Thousand Fangs Below | 2011 |
| `9e449b85…` | 227 | Pathfinder Adventure Path #42: Sanctum of the Serpent God | 2011 |
| `386671ff…` | 228 | Pathfinder Adventure Path #43: Haunting of Harrowstone | 2011 |
| `117a87a0…` | 229 | Pathfinder Adventure Path #44: Trail of the Beast | 2011 |
| `6cf68258…` | 230 | Pathfinder Adventure Path #45: Broken Moon | 2011 |
| `1cda373e…` | 231 | Pathfinder Adventure Path #46: Wake of the Watcher | 2011 |
| `927bb8f8…` | 232 | Pathfinder Adventure Path #47: Ashes at Dawn | 2011 |

Literal punctuation, author spellings and copyright markers are preserved. #33, #40, #43 and #44 have no terminal period. #40 says `Author Greg A. Vaughan` without a colon; #43 and #44 use `Copyright 2011` and a comma before `Author:`. #39 and #41 use plural `Authors:`. No product code, title alias or content coverage is inferred from these lines.

## Policy boundary and enforced holds

[Decision #224](https://github.com/AndreasUnunger/EverythingPath/issues/224#issuecomment-5939689134) identifies permitted evidence and known compilation defects. [Decision #227](https://github.com/AndreasUnunger/EverythingPath/issues/227#issuecomment-5948780647) permits compilation-level review and requires permanent notice retention. [Decision #241](https://github.com/AndreasUnunger/EverythingPath/issues/241#issuecomment-5955002698) supersedes the earlier one-off attribution/unmatched-record admission policy: newly admitted definitions need current content-bound evidence and reviewed required notices. [PRD #251 decision 17 and acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461) retain those boundaries.

The compilation does not group every inherited notice by book. Each reviewed line therefore retains a `notice-276-complete-chain-<hash>` hold in the batch inventory, enforced by its corresponding entry in [held-notices.json](../../scripts/catalog/legal/held-notices.json). Review status does not lift a hold. No Attribution Assessment or accepted content evidence is created; a synthetic assessment requiring a held key must remain held, while unrelated content with independently reviewed, unheld notices can pass.

Both upstream notice blocks, permanent historic notice versions and all prior holds remain retained. Existing source/correction/transcription gaps remain outside this batch. No prior-use inventory was supplied, so no actual retained exception is asserted or cleared; test fixtures exercise retention only.

## Verification

The operators use the pinned sibling checkouts. Notice keys are not Catalog Entry keys, so corpus commands run without `--candidates`. All scratch output and process temporary files use ignored `.scratch/curation-276/`, with a CommonJS boundary for subprocess fixtures. No deployment or activation is involved.

```sh
mkdir -p .scratch/curation-276/tmp
export TMPDIR="$PWD/.scratch/curation-276/tmp"
printf '{"type":"commonjs"}\n' > "$TMPDIR/package.json"
PF1_CURATION_SYSTEM=/home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1
PF1_CURATION_CONTENT=/home/andreas/repos/everythingpath/sources/pf1-content
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm catalog:format --check
pnpm catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-276/drafts
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-276/preview
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --curation .scratch/curation-276/drafts/records.json --out .scratch/curation-276/preview-drafts
pnpm test tests/catalog/inherited-notices-276.test.ts tests/catalog/notice-holds.test.ts
pnpm test tests/catalog
git diff --check
```

The [focused batch suite](../../tests/catalog/inherited-notices-276.test.ts) checks exact source identities, literal wording and dates, every enforced chain hold, legal-page generation and historic retention, separate content assessment requirements, unrelated admission, changed notice/content bindings and explicit retained-use reporting without admission of held revisions. These assessments and retained uses are synthetic test evidence only. The batch and hold-consistency suites passed: two files, 31 tests (29 batch tests and two consistency tests).

An independent source/preservation audit confirmed all fifteen raw line/key hashes. Every pre-existing Registry record and enforced hold remains equal to `HEAD`, with exactly fifteen additions to each; attribution inputs and legal resources remain unchanged. A direct `buildLegalPageData` invocation with the committed Registry/resources/permanent superset and the fifteen batch keys produced four legal sections, fifteen Registry notices and eighteen total Section 15 notices, with no outstanding notice or resource. The other three notices are both upstream blocks and the project notice; using held-only keys to demonstrate generation does not make them release requirements.

| Check | Result |
| --- | --- |
| `pnpm -s typecheck` | Pass, exit 0; final-state rerun also passed |
| `pnpm -s lint` | Pass, exit 0 |
| `pnpm -s check:initial-migration-writers` | Pass; 183 registrations checked |
| `pnpm catalog:pin` | Pass; `sha256:71c66667344e200747085cc47660277a9e7677da10cdd3d58033591444baa25b` |
| `pnpm catalog:format --check` | Pass |
| `catalog:curate` | Pass, exit 0; 4,650 records, 3,625 new drafts, no replacements or missing bindings, 761 unresolved mechanics; coverage remains failed |
| Default `catalog:preview` | Expected gate exit 1; 53 admitted, 23,129 held, two dependent omissions, no retained exceptions, 4,731 failures |
| Draft-assisted `catalog:preview` | Expected gate exit 1; same admission dispositions, 1,867 failures |
| Focused batch/hold tests | Pass; two files, 31 tests |
| `pnpm test tests/catalog` | Pass, exit 0; 46 files, 796 tests, 36.89 seconds |
| `git diff --check` | Pass |

Both previews verified the pins and extracted 23,037 entries plus 538 resources; corpus coverage remains incomplete. Default failures comprise 3,625 missing curation records, 715 unaccounted inventory records and 391 broken references. Draft-assisted preview supplies the drafts, leaving 761 unresolved mechanics and the same inventory/reference gaps (1,867 failures); admission dispositions remain identical. Both runs hold 22,005 entries for missing Attribution Assessments, 1,092 for existing unresolved assessments and 32 for known notice/evidence holds. The two dependent omissions are Greater Vital Strike (`pf1/zKNk7a4XxXsygJ67`) and Lightning Stance (`pf1/jbvXxHpu7BVbCpwr`). Required notices are only `PZO1110`, with none outstanding and no outstanding legal resource. The 53 admitted entries already had unrelated reviewed evidence; this notice batch admits no new content.

| Artifact fingerprint | Default preview | Draft-assisted preview |
| --- | --- | --- |
| Admission-report SHA-256 | `f0dc66032aae77ca5de1ecc94770239059c17aa75c27d83c94d4032dbc8e9fcf` | `bdca60f0da9fb565ea74da6e4d35b3fe300635a5cf416f9bcb0d3c85791e995f` |
| Extraction | `271be7e473bf78df289f129d297d47f1ee88a713ea6906652f073c3e19ed12f5` | `1d7a304ce1a36274033a8854ba75003f8a7f9b13ddff2d705cd7dec6ed3f4d60` |
| Reviewed inputs | `efc7efc7ae08e08610e92831f1ef7005d28ce105c0f1cb842845955b91366a66` | Same |
| Legal resources | `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e` | Same |

Drafts remain temporary operator evidence and are not promoted to Attribution Assessments. The full repository `pnpm test` remains the orchestrator's landing gate, as instructed.

## Workflow observations and handoff

- The batch ordinals 181–195 correspond to physical source lines 218–232; immutable hashes determine the inventory.
- Reviewer metadata is free-text Registry provenance; the batch inventory records reviewer/date structurally.
- Notice batches repeat full-corpus operators because notice keys cannot select Catalog Entry candidates. A notice-specific rehearsal or shared landing-wave checks would reduce repeated work.
- #257 remains `OPEN`; its implemented admission/legal tooling is present, and the brief explicitly authorizes exercising it. Reconcile tracker state before scheduling further batches.
- Requested Opus/Fable model names are unavailable in this environment; delegated work uses the available inherited model. No UI work is needed.

The five changed files are the Registry, batch evidence inventory, enforced notice holds, focused test and this report. No product-code change or Convex integration test is needed. Changes remain uncommitted; `.scratch/curation-276/` and its generated output were removed at handoff. No commits, pushes, issue/PR writes, deployment, environment-file access, private E2E access or upstream changes were made. No answer file is written or linked in the repository.

Approximate overlapping phase windows on 2026-10-08 (UTC): policy/source review 00:32–00:34 (two minutes); Registry/evidence/tests 00:34–00:36 (two minutes); operators/checks 00:34–00:43 (nine minutes); report/audit 00:35–00:43 (eight minutes). Overall elapsed time was about eleven minutes; phase durations are not additive.
