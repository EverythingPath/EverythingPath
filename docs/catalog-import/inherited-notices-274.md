# Inherited notice review: #274

Reviewed 2026-10-08 by **Sol (AI curator) for the owner**. This batch reviews the fifteen immutable notice keys in [#274](https://github.com/AndreasUnunger/EverythingPath/issues/274), following the [#264 precedent](inherited-notices-264.md). It establishes compilation-level notice evidence, not content attribution, printed verification, complete book notice chains or a new legal-sufficiency conclusion.

## Evidence and disposition

All fifteen unique keys match complete physical UTF-8 lines 188–202 of the pinned `pf1-content/OGL.txt`, with SHA-256 calculated without the line ending and without trimming or normalization. None is a heading or wrapped fragment. No joining, correction or alias is required. Full identities and per-line evidence are in [inherited-notices-274.json](../../scripts/catalog/legal/inherited-notices-274.json); verbatim reviewed wording is in the [Section 15 Registry](../../src/lib/catalog/data/section15-registry.json).

- Content: `pf1-content`, `11.4.0`, commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`, [OGL.txt lines 188–202](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d/OGL.txt#L188-202), file SHA-256 `10bcdc68296b48cc250f38e49de09c9a73645163d7ac7f76e77346a755c35cdc`.
- System notice retention: `foundryvtt-pathfinder1`, `v11.11`, commit `418761d2e16a6037c0156bb4a241f7cea5a2986d`, [OGL.txt](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/OGL.txt), file SHA-256 `0464e2f13f24c742dc3c2a4c788aab9ab24ca9809873192551b77f784a50d7f9`.

The reviewer is recorded in Registry provenance and the batch inventory because the Registry schema has no separate reviewer field. `checkedAgainst: "pf1-content"` records the permitted compilation actually compared. The review date is distinct from each literal copyright date.

| Key prefix | Line | Literal notice title | Copyright year | Disposition |
| --- | --- | --- | --- | --- |
| `00acbc9c…` | 188 | Pathfinder 15: The Armageddon Echo | 2009 | Reviewed complete notice; complete-book chain held |
| `af0b1dff…` | 189 | Pathfinder 16: Endless Night | 2008 | Reviewed complete notice; complete-book chain held |
| `2a130b1f…` | 190 | Pathfinder 17: A Memory of Darkness | 2009 | Reviewed complete notice; complete-book chain held |
| `178750dc…` | 191 | Pathfinder 18: Descent into Midnight | 2009 | Reviewed complete notice; complete-book chain held |
| `7005b0dc…` | 192 | Pathfinder 19: Howl of the Carrion King | 2009 | Reviewed complete notice; complete-book chain held |
| `c69a7d6b…` | 193 | Pathfinder 1: Burnt Offerings | 2007 | Reviewed complete notice; complete-book chain held |
| `8c4af9b6…` | 194 | Pathfinder 26: The Sixfold Trial | 2009 | Reviewed complete notice; complete-book chain held |
| `9b724b14…` | 195 | Pathfinder 27: What Lies in Dust | 2009 | Reviewed complete notice; complete-book chain held |
| `bd94e075…` | 196 | Pathfinder 28: The Infernal Syndrome | 2009 | Reviewed complete notice; complete-book chain held |
| `6e63bafc…` | 197 | Pathfinder 29: Mother of Flies | 2010 | Reviewed complete notice; complete-book chain held |
| `403d21dd…` | 198 | Pathfinder 5: Sins of the Saviors | 2007 | Reviewed complete notice; complete-book chain held |
| `2bb7b2ec…` | 199 | Pathfinder Adventure Path #100: A Song of Silver | 2015 | Reviewed complete notice; complete-book chain held |
| `d71d5f26…` | 200 | Pathfinder Adventure Path #122: Into the Shattered Continent | 2017 | Reviewed complete notice; complete-book chain held |
| `67e3d048…` | 201 | Pathfinder Adventure Path #123: The Flooded Cathedral | 2017 | Reviewed complete notice; complete-book chain held |
| `f23c121e…` | 202 | Pathfinder Adventure Path #124: City in the Deep | 2017 | Reviewed complete notice; complete-book chain held |

Six source lines lack a terminal period (188, 190, 194–197). The review preserves those endings, `Copyright 2008` on Endless Night, singular `Author:` for the two credited authors of The Infernal Syndrome, and literal spellings including `J.D. Wiker`, `Stephanie Lorée`, `Lucas J.W. Johnson` and `Tim Nightengale`. The pinned compilation supplies these values; no editorial correction or book/product-code equivalence is inferred.

## Policy boundary and enforced holds

[Decision #224](https://github.com/AndreasUnunger/EverythingPath/issues/224#issuecomment-5939689134) identifies permitted sources and known compilation defects. [Decision #227](https://github.com/AndreasUnunger/EverythingPath/issues/227#issuecomment-5948780647) permits compilation-level review and permanent notice retention. [Decision #241](https://github.com/AndreasUnunger/EverythingPath/issues/241#issuecomment-5955002698) supersedes its one-off attribution and unmatched-record admission policy: every newly admitted definition requires current content-bound evidence and its reviewed notices. [PRD #251 decision 17 and acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461) preserve these boundaries.

Each reviewed block has a named complete-book-chain hold in the batch evidence and a matching enforced entry in [held-notices.json](../../scripts/catalog/legal/held-notices.json). The compilation does not group all inherited notices by book, so a single reviewed book line cannot establish the complete chain. No product-code or title alias, accepted Attribution Assessment or content evidence is created. A current synthetic assessment requiring a held key must remain held even though its Registry text is reviewed; unrelated content using an independently reviewed, unheld notice can still pass.

Both complete upstream notice blocks, historic notice versions and all pre-existing holds remain unchanged. Existing correction and review gaps include Ultimate Combat, Occult Mysteries, owner-transcription PDF checks and missing free-PDF transcriptions; known source holds include Dynamite comics, Thornkeep, Refuge of Time, Horror Realms and Shattered Star #4. No prior-use inventory was supplied, so this batch asserts or clears no actual retained exception. Retention behavior is exercised only with synthetic fixtures.

## Verification

Scratch artifacts and process temporary files use the ignored `.scratch/curation-274/` directory, with a CommonJS package boundary for temporary command fixtures. No deployment or activation is involved. The notice identities are not Catalog Entry identities, so the full-corpus commands apply without a `--candidates` selector.

```sh
mkdir -p .scratch/curation-274/tmp
export TMPDIR="$PWD/.scratch/curation-274/tmp"
printf '{"type":"commonjs"}\n' > "$TMPDIR/package.json"
PF1_CURATION_SYSTEM=/home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1
PF1_CURATION_CONTENT=/home/andreas/repos/everythingpath/sources/pf1-content
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm catalog:format --check
pnpm catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-274/drafts
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-274/preview
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --curation .scratch/curation-274/drafts/records.json --out .scratch/curation-274/preview-drafts
pnpm test tests/catalog/inherited-notices-274.test.ts tests/catalog/notice-holds.test.ts tests/catalog/data-files.test.ts
pnpm test tests/catalog
git diff --check
```

The focused run passed 37 tests in three files (28 batch tests, two hold-enforcement tests and seven canonical-format tests), exit 0, 6.92 seconds. Its fixtures exercise each of the fifteen enforced chain holds independently; missing or changed Attribution Assessments; missing, unreviewed or changed notices; unrelated admission using an unheld reviewed notice; permanent notice retention including older text under the same identity; and explicit retained-use reporting without admitting a held revision. These synthetic assessments and retained uses are test evidence only.

A direct `node --import tsx --input-type=module` invocation of `buildLegalPageData`, using the committed Registry/resources/permanent superset and all fifteen batch keys, produced four sections and eighteen Section 15 notice entries: fifteen reviewed Registry notices, both upstream blocks and the project notice. It had no outstanding notice or resource for those exact keys. The generated JSON SHA-256 was `47ae25b6e1ca63e5f63fdc189350befaf6e225724a3e70ad022f90cb83454d8f`. Supplying the keys here demonstrates generation; it does not make held-only notices release requirements.

Independent raw-byte comparison against both pinned checkouts confirmed complete-file hashes and every reviewed line/key. All 118 pre-existing Registry records and 331 pre-existing enforced hold entries remain equal to `HEAD`. The legal resources, Attribution Assessments, attribution evidence and notice-review backlog remain byte-identical. No product-code fix or new Convex integration test was needed.

| Check | Result |
| --- | --- |
| `pnpm -s typecheck` | Pass, exit 0 |
| `pnpm -s lint` | Pass, exit 0 |
| `pnpm -s check:initial-migration-writers` | Pass, 183 registrations checked |
| `pnpm catalog:pin` | Pass; `sha256:71c66667344e200747085cc47660277a9e7677da10cdd3d58033591444baa25b` |
| `pnpm catalog:format --check` | Pass; canonical data files |
| `catalog:curate` | Pass, exit 0; 4,451 records, 3,626 new drafts, no replaced records or missing bindings, 761 unresolved mechanics |
| Default `catalog:preview` | Expected gate exit 1; 53 admitted, 23,129 held, two dependent omissions, no retained exceptions, 4,732 failures |
| Draft-assisted `catalog:preview` | Expected gate exit 1; identical admission dispositions, 1,867 failures |
| Focused batch/hold/format tests | 37 tests passed in three files, including 28 batch tests |
| `pnpm test tests/catalog --testTimeout=30000` | Pass, exit 0; 40 files and 665 tests, 34.21 seconds |
| `git diff --check` | Pass |

The default preview verified both required commits and extracted 23,037 entries plus 538 resources. Its failures comprise 3,626 missing curation records, 715 unaccounted inventory records and 391 broken structures/references. It reports 22,203 missing Attribution Assessments alongside 926 other existing holds. The two dependent omissions are `pf1/zKNk7a4XxXsygJ67` (Greater Vital Strike, dependent on `pf1/DorPGQ2mifJbMKH8`) and `pf1/jbvXxHpu7BVbCpwr` (Lightning Stance, dependent on `pf1/9p0aAtCyLdcwnftS`). Required notices are only `PZO1110`; there are no outstanding notices or legal resources. No existing accepted assessment references any of this batch's fifteen keys, and no new content assessment is introduced.

The default admission-report SHA-256 is `ab4ec6ea90aef7b76fd6032d636df788a5c04abd3c536e40407bd8762942c5c1`; extraction fingerprint `a01ef78814dc25e143dd5cbfea373c07cc9d0c8102388e3a6267f4ef8d0d4de8`; reviewed-input fingerprint `d21554881d748d96bf95f30ee06aa03873ca021986f48564418250cbca213811`; legal-resource fingerprint `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e`.

The draft-assisted preview also verified both pins and extracted 23,037 entries plus 538 resources. Supplying the 3,626 drafts removed missing curation bindings while retaining 761 unresolved mechanics, 715 inventory gaps and 391 structural/reference failures, for 1,867 failures. Its admitted, held, dependent-omission and retained-exception arrays are identical to the default preview, as are required and outstanding notices/resources. Drafts are not promoted to content attribution evidence. Its admission-report SHA-256 is `84b33f29e046afe5099e7d6b7c16cc08a0bea79acd66404f6c5da86e5825f0e6`; extraction fingerprint `ab2377c079f0f7b6271daea68e766ae52cf3de98f6ae619686a196364cea5009`. Reviewed-input and legal-resource fingerprints remain the values above. These corpus-wide gaps remain outside this bounded notice review.

The initial prescribed `pnpm test tests/catalog` run passed 663 tests but timed out two existing subprocess cases at their default 5,000 ms budget: pinned-checkout verification in `preview.test.ts` and deterministic CLI artifact preparation in `release-operator.test.ts`. It finished with 38 files passed and two failed, 99.83 seconds; neither failure was an assertion mismatch. That run overlapped typecheck, lint and both full-corpus operators. The rerun above gave subprocess cases a 30,000 ms budget and passed all tests, including those two cases; their reported durations were 2,115 ms and 3,665 ms, respectively, both below the original budget. No timeout configuration or application/test implementation was changed. The full repository test suite was left for the orchestrator's landing gate, as instructed.

## Workflow observations

- Registry reviewer metadata lives in free-text provenance; the structured batch inventory supplies an auditable reviewer/date without changing the product schema.
- Notice-batch ordinals are distinct from physical file line numbers. Review exact ticket hashes; this batch is lines 188–202 despite its 151–165 ordinal range.
- Notice keys cannot be used as Catalog Entry `--candidates`. Every notice batch repeats full-corpus drafting and previews; a notice-specific rehearsal or shared landing-wave corpus checks would reduce repeated work.
- Five-second subprocess test budgets proved sensitive during overlapping operator checks. Serialize heavy gates or provide a larger operator-test timeout in the pilot harness.
- Worktree-local temporary command fixtures need both `TMPDIR` and a CommonJS package boundary. Keep that setup in the harness.
- The repository requests an Opus implementation subagent, but that model name is unavailable in this environment. The implementation subagent used the available inherited model; no UI subagent was needed.
- Blocker #257 still reports `OPEN`, although its landed admission/legal tooling is the implementation exercised by this batch and the precedent. Reconcile tracker status before scheduling later batches.

## Phase timing and handoff

Approximate overlapping phase windows on 2026-10-08, Europe/Stockholm: briefing/policy/source review 01:19–01:21 (two minutes); Registry/evidence/focused-test implementation 01:21–01:24 (three minutes); operator commands and verification 01:21–01:32 (eleven minutes); report and final audit 01:22–01:33 (eleven minutes). Overall elapsed time was about fourteen minutes; phase durations are not additive.

The five changed files are the Registry, batch evidence inventory, enforced notice holds, focused test and this report. Implementation was delegated under the repository workflow; the main session reviewed evidence, exercised operators and gates, audited preservation and wrote the report. All generated drafts, preview outputs, logs and process temporary files were removed from `.scratch/curation-274/` after recording results. Changes remain uncommitted. No commits, pushes, issue/PR writes, deployment, environment-file access, private E2E access or upstream changes were made.
