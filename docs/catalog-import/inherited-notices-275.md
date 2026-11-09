# Inherited notice review: #275

Reviewed 2026-10-08 by **Sol (AI curator) for the owner**. This batch reviews the fifteen immutable notice keys in [#275](https://github.com/AndreasUnunger/EverythingPath/issues/275), following the [#264 precedent](inherited-notices-264.md). It establishes compilation-level notice evidence, not content attribution, printed verification, complete book notice chains or a new legal-sufficiency conclusion.

## Evidence and disposition

All fifteen unique keys match complete physical UTF-8 lines 203–217 of the pinned `pf1-content/OGL.txt`. SHA-256 is calculated without the line ending and without trimming or normalization. None is a heading or wrapped fragment; no joining, correction or alias is recorded. Full identities and per-line evidence are in [inherited-notices-275.json](../../scripts/catalog/legal/inherited-notices-275.json); verbatim wording is in the [Section 15 Registry](../../src/lib/catalog/data/section15-registry.json).

- Content: `pf1-content`, `11.4.0`, commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`, [OGL.txt lines 203–217](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d/OGL.txt#L203-217), file SHA-256 `10bcdc68296b48cc250f38e49de09c9a73645163d7ac7f76e77346a755c35cdc`.
- System notice retention: `foundryvtt-pathfinder1`, `v11.11`, commit `418761d2e16a6037c0156bb4a241f7cea5a2986d`, [OGL.txt](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/OGL.txt), file SHA-256 `0464e2f13f24c742dc3c2a4c788aab9ab24ca9809873192551b77f784a50d7f9`.

The reviewer is recorded in Registry provenance and the structured batch inventory because the Registry schema has no separate reviewer field. `checkedAgainst: "pf1-content"` records the permitted compilation actually compared. The review date is distinct from each literal copyright date.

| Key prefix | Line | Literal notice title | Copyright year | Disposition |
| --- | --- | --- | --- | --- |
| `65587afd…` | 203 | Pathfinder Adventure Path #125: Tower of the Drowned Dead | 2017 | Reviewed complete notice; complete-book chain held |
| `2e4cc79e…` | 204 | Pathfinder Adventure Path #131: The Reaper’s Right Hand | 2018 | Reviewed complete notice; complete-book chain held |
| `3398c08c…` | 205 | Pathfinder Adventure Path #133: Secrets of Roderic’s Cove | 2018 | Reviewed complete notice; complete-book chain held |
| `7c4d5f8c…` | 206 | Pathfinder Adventure Path #140: Eulogy for Roslar’s Coffer | 2019 | Reviewed complete notice; complete-book chain held |
| `76d2f75c…` | 207 | Pathfinder Adventure Path #22: The End of Eternity | 2009 | Reviewed complete notice; complete-book chain held |
| `8fdff6c9…` | 208 | Pathfinder Adventure Path #23: The Impossible Eye | 2009 | Reviewed complete notice; complete-book chain held |
| `3a45497c…` | 209 | Pathfinder Adventure Path #24: The Final Wish | 2009 | Reviewed complete notice; complete-book chain held |
| `2201c677…` | 210 | Pathfinder Adventure Path #25: Bastards of Erebus | 2009 | Reviewed complete notice; complete-book chain held |
| `6c255001…` | 211 | Pathfinder Adventure Path #26: The Sixfold Trial | 2009 | Reviewed complete notice; complete-book chain held |
| `14c5f331…` | 212 | Pathfinder Adventure Path #27: What Lies in Dust | 2009 | Reviewed complete notice; complete-book chain held |
| `2bb8b93b…` | 213 | Pathfinder Adventure Path #28: The Infernal Syndrome | 2009 | Reviewed complete notice; complete-book chain held |
| `9485bf67…` | 214 | Pathfinder Adventure Path #29: Mother of Flies | 2009 | Reviewed complete notice; complete-book chain and date comparison held |
| `dad134c8…` | 215 | Pathfinder Adventure Path #30: The Twice-Damned Prince | 2010 | Reviewed complete notice; complete-book chain held |
| `830d1ea2…` | 216 | Pathfinder Adventure Path #31: Stolen Land | 2010 | Reviewed complete notice; complete-book chain held |
| `ec44cc6b…` | 217 | Pathfinder Adventure Path #32: Rivers Run Red | 2010 | Reviewed complete notice; complete-book chain held |

Literal curly apostrophes, `©` versus `Copyright`, author spellings and terminal punctuation are preserved. Lines 216–217 have no terminal period. Line 213 uses `Authors:` for Clinton Boomer and James Jacobs; line 214 also uses `Authors:` for Greg A. Vaughan; line 215 uses singular `Author:` for Brian Cortijo and James Jacobs. These are compilation values, not editorial corrections.

The #26–#29 notices in lines 211–214 have separate immutable identities from the earlier `Pathfinder 26`–`Pathfinder 29` notices in lines 194–197 reviewed by [#274](inherited-notices-274.md). The title prefix, copyright marker and ending punctuation differ; #28 and #29 also differ in `Author:` versus `Authors:`. No product-code or title alias is inferred. In particular, line 214 says `© 2009`, while line 197 says `Copyright 2010`. Both literal versions remain retained; selecting a corrected date requires a permitted book comparison.

## Policy boundary and enforced holds

[Decision #224](https://github.com/AndreasUnunger/EverythingPath/issues/224#issuecomment-5939689134) identifies permitted sources and known compilation defects. [Decision #227](https://github.com/AndreasUnunger/EverythingPath/issues/227#issuecomment-5948780647) permits compilation-level review and permanent notice retention. [Decision #241](https://github.com/AndreasUnunger/EverythingPath/issues/241#issuecomment-5955002698) supersedes its one-off attribution and unmatched-record admission policy: every newly admitted definition requires current content-bound evidence and its reviewed notices. [PRD #251 decision 17 and acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461) preserve these boundaries.

Each reviewed block has a complete-book-chain hold `notice-275-complete-chain-<hash>` in the batch evidence and a corresponding enforced entry in [held-notices.json](../../scripts/catalog/legal/held-notices.json). The compilation does not group all inherited notices by book, so a reviewed book line cannot establish the complete chain. The additional `notice-275-mother-of-flies-variant-comparison` hold binds both line 214 (`9485bf672f7bd4e13531d59f38e18ab233c60da1611d8f2c86ad81a09abd035e`) and line 197 (`6e63bafcc0c97bd94ed08dc64653de904264e23f0f6a58b79de353d6b6d04de2`). Review status alone cannot lift any hold.

No accepted Attribution Assessment or content evidence is created. A current synthetic assessment requiring a held key must remain held; unrelated content with independently reviewed, unheld notices can still pass. Both upstream notice blocks, historic notice versions and all prior holds remain retained. Existing correction/review gaps include Ultimate Combat, Occult Mysteries, owner-transcription PDF checks and missing free-PDF transcriptions; known source holds include Dynamite comics, Thornkeep, Refuge of Time, Horror Realms and Shattered Star #4. These remain outside this batch. No prior-use inventory was supplied, so this batch asserts or clears no actual retained exception; synthetic fixtures exercise retention behavior only.

## Verification

Notice identities are not Catalog Entry identities, so the catalog drafter and previews apply to the full corpus without `--candidates`. Scratch and process temporary files use the ignored `.scratch/curation-275/` directory with `TMPDIR` and a CommonJS package boundary for subprocess fixtures; no deployment or activation is involved.

```sh
mkdir -p .scratch/curation-275/tmp
export TMPDIR="$PWD/.scratch/curation-275/tmp"
printf '{"type":"commonjs"}\n' > "$TMPDIR/package.json"
PF1_CURATION_SYSTEM=/home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1
PF1_CURATION_CONTENT=/home/andreas/repos/everythingpath/sources/pf1-content
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm catalog:format --check
pnpm catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-275/drafts
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-275/preview
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --curation .scratch/curation-275/drafts/records.json --out .scratch/curation-275/preview-drafts
pnpm test tests/catalog/inherited-notices-275.test.ts tests/catalog/inherited-notices-274.test.ts tests/catalog/notice-holds.test.ts
pnpm test tests/catalog
git diff --check
```

Independent source comparison confirmed both clean pinned checkout identities, the complete-file hashes above, all fifteen raw line/key hashes, and byte-identical committed OGL and upstream notice resources against both pinned files. All 160 pre-existing Registry records and 422 pre-existing enforced hold entries remain equal to `HEAD`; the fifteen added Registry records have no aliases, and sixteen hold IDs are added. Legal resources, Attribution Assessments, attribution evidence and the notice-review backlog remain byte-identical to `HEAD`.

A direct invocation of `buildLegalPageData` with the committed Registry/resources/permanent superset and the fifteen batch keys passed, producing four sections (`ogl`, `section15`, `section8`, `paizo`), fifteen Registry notices and eighteen total Section 15 notices, with no outstanding notice or resource. The additional three are both upstream blocks and the project notice. Supplying held-only keys demonstrates generation; it does not make them release requirements. The reproducible invocation is:

```sh
node --import tsx --input-type=module <<'JS'
import { readFileSync } from 'node:fs';
import { buildLegalPageData } from './src/lib/catalog/legal-page-data.ts';
import { legalResources, section15Registry } from './src/lib/catalog/section15-registry-data.ts';
const review = JSON.parse(readFileSync('scripts/catalog/legal/inherited-notices-275.json', 'utf8'));
const page = buildLegalPageData({
  registry: section15Registry,
  resources: legalResources,
  permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
  requiredNotices: review.blocks.map((block) => block.key),
});
console.log(JSON.stringify(page));
JS
```

| Check | Result |
| --- | --- |
| `pnpm -s typecheck` | Pass, exit 0; final-state rerun also passed |
| `pnpm -s lint` | Pass, exit 0; final-state rerun also passed |
| `pnpm -s check:initial-migration-writers` | Pass; 183 registrations checked |
| `pnpm catalog:pin` | Pass; `sha256:71c66667344e200747085cc47660277a9e7677da10cdd3d58033591444baa25b` |
| `pnpm catalog:format --check` | Pass, exit 0; canonical data files |
| `catalog:curate` | Pass, exit 0; 4,550 records, 3,626 new drafts, no replaced records or missing bindings, 761 unresolved mechanics |
| Default `catalog:preview` | Expected gate exit 1; 53 admitted, 23,129 held, two dependent omissions, no retained exceptions, 4,732 failures |
| Draft-assisted `catalog:preview` | Expected gate exit 1; identical admission dispositions, 1,867 failures |
| Focused batch/previous-batch/hold tests | Pass, exit 0; 62 tests in three files, 0.756 seconds |
| `pnpm test tests/catalog` | Pass, exit 0; 44 files and 752 tests, 38.06 seconds |
| `git diff --check` | Pass |

The focused run includes 32 #275 tests, 28 #274 tests and two hold-enforcement tests. It exercises all fifteen chain holds independently, the comparison hold against both Mother of Flies identities, distinct retained variant wording, stale notice/content bindings, legal-page retention and explicit retained-use reporting without admitting a held revision. These synthetic assessments and retained uses are test evidence only.

Both previews verified the required pins and extracted 23,037 entries plus 538 resources. The default preview's 4,732 failures comprise 3,626 missing curation records, 715 unaccounted inventory records and 391 broken structures/references. Draft-assisted preview supplies the 3,626 new drafts, leaving 761 unresolved mechanics, 715 inventory gaps and 391 structural/reference failures, for 1,867 failures. Drafts are not promoted to content attribution evidence.

Both runs report 22,105 missing Attribution Assessments, 32 known source-held candidates and 992 other existing assessment holds. The two dependent omissions are `pf1/zKNk7a4XxXsygJ67` (Greater Vital Strike) and `pf1/jbvXxHpu7BVbCpwr` (Lightning Stance). Required notices are only `PZO1110`; no notice or legal resource is outstanding. The admission dispositions remain identical between the runs. These corpus-wide gaps remain outside this bounded notice review.

| Artifact fingerprint | Default preview | Draft-assisted preview |
| --- | --- | --- |
| Admission-report SHA-256 | `5218d83e8ca8ae130a6abe6fbf5b56422693b54fedaf92af7259deeb0e3240a4` | `8eec83cbef7de3da15e01a74a0e5bce46cf069aed6632abe57f9eb157af905cd` |
| Extraction | `be40038e7c5a7686558839e902c54428ec233e87420767608462d65e3a1c7c14` | `2227712aed1df08422d8c566b61f848b89e619d1e487db5ca871749111667fc2` |
| Reviewed inputs | `d607bbbe18d34138599bd8bc99fb9e5b5cb7854738d1b3c0fff29cd20f02e5ce` | Same |
| Legal resources | `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e` | Same |

The full repository `pnpm test` suite remains the orchestrator's landing gate, as instructed.

## Workflow observations and handoff

- The ticket's 166–180 batch ordinals differ from physical source lines 203–217; exact hashes determine the inventory.
- Registry reviewer metadata is free-text provenance; the structured batch inventory records reviewer/date explicitly.
- Notice batches repeat full-corpus operators because notice keys cannot select Catalog Entry candidates. A notice-specific rehearsal or shared landing-wave corpus checks would reduce repeated work.
- Four subprocess tests consumed at least half their timeout during concurrent operator checks; all passed. Serialize heavy gates before changing their timeout budgets.
- The repository requests Opus/Fable model names unavailable in this environment. Delegated work uses the available inherited model; no UI work is required.
- Blocker #257 still reports `OPEN`, although its landed admission/legal tooling is present and exercised by this batch. Reconcile the tracker state before scheduling later batches.

The six changed files are the Registry, batch evidence inventory, enforced notice holds, new focused test, previous batch's focused test and this report. The #274 test's expected hold reason now accounts for the additional shared Mother of Flies comparison hold. No product-code fix or new Convex integration test is needed.

Approximate overlapping phase windows on 2026-10-08, Europe/Stockholm: briefing/policy/source review 01:55–01:58 (three minutes); Registry/evidence/focused-test implementation 01:56–02:00 (four minutes); operator commands and verification 01:57–02:04 (seven minutes); report and final audit 01:58–02:05 (seven minutes). Overall elapsed time was about ten minutes; phase durations are not additive.

Implementation and report edits were delegated under the repository workflow; the main session reviewed evidence, exercised operators and gates, and audited preservation. Generated drafts, preview outputs, logs and process temporary files are removed from `.scratch/curation-275/` at handoff. Changes remain uncommitted. No commits, pushes, issue/PR writes, deployment, activation, environment-file access, private E2E access or upstream changes were made.
