# Inherited notice review: #277

Reviewed 2026-10-08 by **Sol (AI curator) for the owner**, following [#264](inherited-notices-264.md) and [#275](inherited-notices-275.md). All fifteen immutable keys in [#277](https://github.com/AndreasUnunger/EverythingPath/issues/277) are reviewed complete notices; each retains an enforced complete-book-chain hold. This establishes compilation-level notice evidence, not printed verification, content attribution, complete book chains or legal sufficiency.

## Evidence and disposition

All keys match unique complete physical UTF-8 lines 233–247, hashed without the line ending, trimming or normalization. No headings, wrapped fragments, duplicate occurrences, joins or corrections are involved. Full identities, reviewer/date, comparisons and source provenance are in [inherited-notices-277.json](../../scripts/catalog/legal/inherited-notices-277.json); exact wording is in the [Section 15 Registry](../../src/lib/catalog/data/section15-registry.json). Registry reviewer information is recorded in provenance because its schema has no separate reviewer field.

- Content: `pf1-content` 11.4.0, commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`, [OGL.txt lines 233–247](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d/OGL.txt#L233-247), file SHA-256 `10bcdc68296b48cc250f38e49de09c9a73645163d7ac7f76e77346a755c35cdc`.
- System retention: `foundryvtt-pathfinder1` v11.11, commit `418761d2e16a6037c0156bb4a241f7cea5a2986d`, [OGL.txt](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/OGL.txt), file SHA-256 `0464e2f13f24c742dc3c2a4c788aab9ab24ca9809873192551b77f784a50d7f9`.

Every row has the same disposition: reviewed canonical notice, no aliases, complete-book chain held.

| Key prefix | Source line | Adventure Path notice title | Literal year |
| --- | --- | --- | --- |
| `40e8b9aa…` | 233 | #48: Shadows of Gallowspire | 2011 |
| `de25ec37…` | 234 | #49: The Brinewall Legacy | 2011 |
| `2b0b7342…` | 235 | #50: Night of Frozen Shadows | 2011 |
| `cc0d5bad…` | 236 | #51: The Hungry Storm | 2011 |
| `7bc3133e…` | 237 | #52: Forest of Spirits | 2011 |
| `94fef81e…` | 238 | #53: Tide of Honor | 2011 |
| `2526440e…` | 239 | #55: The Wormwood Mutiny | 2012 |
| `92c503f2…` | 240 | #56: Raiders of the Fever Sea | 2012 |
| `055ba424…` | 241 | #57: Tempest Rising | 2012 |
| `4c65444b…` | 242 | #58: Island of Empty Eyes | 2012 |
| `8762fe3a…` | 243 | #60: From Hell’s Heart | 2012 |
| `c90100d8…` | 244 | #61: Shards of Sin | 2012 |
| `46998674…` | 245 | #62: Curse of the Lady’s Light | 2012 |
| `0ce5e09f…` | 246 | #63: The Asylum Stone | 2012 |
| `77d60d28…` | 247 | #71: Rasputin Must Die! | 2013 |

All lines end in periods; only lines 233–235 have a period immediately after the title. Line 243 preserves `Authors: Jason Nelson and Rob McCreary.`; the other lines use `Author:`. Curly apostrophes in *From Hell’s Heart* and *Curse of the Lady’s Light*, author initials and the exclamation mark in *Rasputin Must Die!* are retained. The review date is separate from the copyright dates. No same-title variant was found in the pinned OGL files; this does not claim a printed comparison. Missing adventure numbers, including #54, #59 and #64, do not supply notices or book coverage.

## Policy and holds

[Decision #224](https://github.com/AndreasUnunger/EverythingPath/issues/224#issuecomment-5939689134) identifies permitted compilations and defects; [#227](https://github.com/AndreasUnunger/EverythingPath/issues/227#issuecomment-5948780647) permits compilation verification and requires permanent retention. [#241](https://github.com/AndreasUnunger/EverythingPath/issues/241#issuecomment-5955002698) supersedes unmatched admission and the one-off attribution policy. [PRD #251 decision 17 and its acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461) require current content-bound assessments and notices on every release.

Each key has `notice-277-complete-chain-<full hash>` recorded in the batch evidence and enforced in [held-notices.json](../../scripts/catalog/legal/held-notices.json). The compilation does not delimit each book’s complete inherited notice chain, so reviewed status cannot lift these fifteen holds. No product-code or book-title alias is inferred, and no Attribution Assessment is created or rebound.

Both upstream blocks and all historic notices remain retained. Existing known holds, including Shattered Star #4, and Ultimate Combat/Occult Mysteries corrections, free-PDF transcription gaps and owner-PDF checks remain unresolved. No prior-use inventory was supplied; this batch asserts or clears no actual retained exception. Synthetic tests demonstrate retention only.

## Verification

Independent source audits confirmed all fifteen raw line/key hashes, both pinned commit/file hashes, and exact committed legal-resource bytes. All 175 pre-existing Registry records and 493 enforced hold entries remain equal to `HEAD`; exactly fifteen of each are added. Legal resources, assessments, attribution evidence and the notice-review backlog are unchanged.

The [28 focused tests](../../tests/catalog/inherited-notices-277.test.ts) prove legal-page generation, permanent retention after removal or correction, missing/unreviewed notices, separate content evidence, stale notice/content bindings, every key’s enforced hold, unrelated unheld admission, and reported versus unreported retained uses. Direct `buildLegalPageData` generation with the fifteen keys produced four sections (`ogl`, `section15`, `section8`, `paizo`), fifteen Registry notices and eighteen total notices, with no outstanding notice or resource. This held-only demonstration does not add those keys to release requirements.

All process temporary files and generated outputs use ignored `.scratch/curation-277/`; `TMPDIR` points to its `tmp/` child with a CommonJS `package.json` boundary. Commands use the read-only pinned source checkouts:

```sh
mkdir -p .scratch/curation-277/tmp
printf '{"type":"commonjs"}\n' > .scratch/curation-277/tmp/package.json
export TMPDIR="$PWD/.scratch/curation-277/tmp"
PF1_CURATION_SYSTEM=/home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1
PF1_CURATION_CONTENT=/home/andreas/repos/everythingpath/sources/pf1-content
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm catalog:format --check
pnpm catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-277/drafts
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-277/preview
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --curation .scratch/curation-277/drafts/records.json --out .scratch/curation-277/preview-drafts
pnpm test tests/catalog/inherited-notices-277.test.ts tests/catalog/notice-holds.test.ts
pnpm test tests/catalog
git diff --check
```

| Check | Result |
| --- | --- |
| `pnpm -s typecheck` | Pass, exit 0; final-state rerun passed |
| `pnpm -s lint` | Pass, exit 0 |
| `pnpm -s check:initial-migration-writers` | Pass; 183 registrations |
| `pnpm catalog:pin` | Pass; `sha256:71c66667344e200747085cc47660277a9e7677da10cdd3d58033591444baa25b` |
| `pnpm catalog:format --check` | Pass; canonical data |
| `catalog:curate` | Pass, exit 0; 4,749 total records, 3,625 new drafts, no replacements or missing bindings, 761 unresolved mechanics |
| Default `catalog:preview` | Expected gate exit 1; 53 admitted, 23,129 held, two dependent omissions, no retained exceptions, 4,731 failures |
| Draft-assisted `catalog:preview` | Expected gate exit 1; identical admission dispositions, 1,867 failures |
| Focused batch and notice-hold tests | Pass; 30 tests in two files, 0.833 seconds |
| `pnpm test tests/catalog` | Pass, exit 0; 47 files, 827 tests, 36.55 seconds |
| `git diff --check` | Pass |

Default preview verified both pins and extracted 23,037 entries plus 538 resources. Its 4,731 failures comprise 3,625 missing curation records, 715 unaccounted inventory records and 391 structure/reference failures. The two dependent omissions are Greater Vital Strike (`pf1/zKNk7a4XxXsygJ67`) and Lightning Stance (`pf1/jbvXxHpu7BVbCpwr`). Of 23,129 holds, 21,906 lack Attribution Assessments; 1,223 have other hold reasons. Only `PZO1110` is required by admitted content, with no outstanding notice or resource; no held-only batch key becomes a release requirement. These corpus gaps remain outside the notice batch.

Default admission-report SHA-256: `7324489fcbf91788d9ef947898c2791d9adc0de59c1cb726b761cd616f0a7854`. Reviewed-input fingerprint: `1db16463d39939c8fb37297a176df613dddfa0bda0e865a17e19e7fc0a5d7704`; extraction fingerprint: `01634e7718bcaa3d656ca24bd6ed1a193e4dbff833f2c6479fc4525829beaf5b`; legal-resource fingerprint: `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e`.

Draft-assisted preview leaves admission dispositions, requirements and outstanding notices/resources unchanged. Its 1,867 failures comprise 761 unresolved curation mechanics and the same 715 inventory plus 391 structure/reference failures. Drafting removes missing curation records but does not promote attribution evidence or resolve these gaps. Its admission-report SHA-256 is `68867e0964b7549f98278e3ab6b5078aa1c693ecab5d824c252e88982a1120a1`; extraction fingerprint is `22bd887f1af04bb218eeaefc74da4c4a2f9a6eb8990b1c1a86278d1c19bb57f5`. Reviewed-input and legal-resource fingerprints equal the default run.

The catalog suite passed without fixes. Five tests consumed at least half their timeout; the highest was `release-operator` at 4,019/5,000 milliseconds. The full `pnpm test` suite was deliberately not run; it belongs to the orchestrator’s post-rebase landing gate.

## Timing and handoff

Approximate phase windows on 2026-10-08 (Europe/Stockholm; parallel work overlaps): briefing/policy review 02:46–02:48, two minutes; implementation/source audit 02:47–02:50, three minutes; operators and broad checks 02:48–02:58, ten minutes; report/final audit 02:51–02:58, seven minutes. Overall elapsed time was about eleven minutes; phase durations overlap. Task-owned `.scratch/curation-277/` was removed after recording results with scoped Python cleanup; the command guard rejected `rm -rf`, and the safer removal succeeded.

The five changed files are the Registry, enforced holds, batch evidence, focused test and this report. No product code or previous-batch test was changed, and no tool bug blocked review. No commits, pushes, issues, PRs, deployments, environment files, private E2E material or upstream writes were made.

Before scaling, preserve the worktree-local `TMPDIR` and CommonJS boundary in the harness, and finish heavy operators before subprocess-sensitive catalog tests. Registry reviewer metadata remains free-text provenance; the batch inventory supplies structured reviewer/date evidence. Complete notice lines remain distinct from full-book chains and accepted content evidence. Blocker #257 still reports `OPEN` despite the landed gate implementation exercised here; reconcile tracker state before scheduling later batches. The requested Opus model is unavailable in this environment, so implementation delegation used the available inherited model.
