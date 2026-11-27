# Inherited notice review: #279

Reviewed 2026-10-08 by **Sol (AI curator) for the owner**. This batch reviews the fifteen immutable keys in [#279](https://github.com/AndreasUnunger/EverythingPath/issues/279), following [#264](inherited-notices-264.md). It establishes compilation-level notice evidence; content attribution, printed verification and complete book notice chains require separate evidence.

## Evidence and disposition

Each key uniquely matches a complete physical UTF-8 line in `pf1-content/OGL.txt`, lines 263–277. SHA-256 excludes the newline without trimming or normalization. None is a heading or wrapped fragment; no joining is required. Full identities, comparisons, provenance and holds are recorded in [inherited-notices-279.json](../../scripts/catalog/legal/inherited-notices-279.json); literal notice text is in the [Section 15 Registry](../../src/lib/catalog/data/section15-registry.json).

The permitted compilation is `pf1-content` 11.4.0, commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`, [OGL.txt lines 263–277](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d/OGL.txt#L263-277), file SHA-256 `10bcdc68296b48cc250f38e49de09c9a73645163d7ac7f76e77346a755c35cdc`. The system comparison uses `foundryvtt-pathfinder1` v11.11, commit `418761d2e16a6037c0156bb4a241f7cea5a2986d`, [OGL.txt](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/OGL.txt), file SHA-256 `0464e2f13f24c742dc3c2a4c788aab9ab24ca9809873192551b77f784a50d7f9`. No batch line has a byte-identical system counterpart. Both complete files match the committed legal resources.

Every row is **reviewed verbatim; complete-book chain held**. All titles below have the literal `Pathfinder Campaign Setting: ` prefix.

| Key prefix | Line | Literal notice title | Copyright year |
| --- | --- | --- | --- |
| `c956d809…` | 263 | Castles of the Inner Sea | 2013 |
| `ff94fa6f…` | 264 | Cheliax, The Infernal Empire | 2015 |
| `88fe2b79…` | 265 | Chronicle of the Righteous. | 2013 |
| `9c92993f…` | 266 | Darklands Revisited | 2016 |
| `a2f9721f…` | 267 | Demons Revisited | 2013 |
| `3d247194…` | 268 | Distant Realms | 2018 |
| `71460df9…` | 269 | Distant Shores | 2015 |
| `e53e8fd2…` | 270 | Dragon Empires Gazetteer | 2011 |
| `90cc80a4…` | 271 | Dungeons of Golarion. | 2011 |
| `943f3d73…` | 272 | Heaven Unleashed | 2016 |
| `f3ceca25…` | 273 | Horsemen of the Apocalypse: Book of the Damned, Vol. 3 | 2011 |
| `d3f22054…` | 274 | Inner Sea Combat | 2014 |
| `802f3be1…` | 275 | Inner Sea Gods | 2014 |
| `08d8d708…` | 276 | Inner Sea Magic. | 2011 |
| `fa29a3eb…` | 277 | Inner Sea Monster Codex | 2015 |

`checkedAgainst: "pf1-content"` records the actual compilation comparison. Reviewer/date appear in Registry provenance and structured batch evidence. Copyright dates, contributors and punctuation remain literal: Chronicle has `© 2013 Paizo` without a comma; Dungeons separates its publisher and `Authors:` with a period; Chronicle, Dungeons and Inner Sea Magic retain terminal title periods. Inner Sea Gods retains `Sean K Reynolds, with Amanda Hamon` and its complete contributor list. No contradictory permitted evidence establishes a correction. No book-title or product-code aliases are inferred.

## Policy boundary and enforced holds

[Decision #224](https://github.com/AndreasUnunger/EverythingPath/issues/224#issuecomment-5939689134) identifies permitted evidence and known defects. [Decision #227](https://github.com/AndreasUnunger/EverythingPath/issues/227#issuecomment-5948780647) permits compilation-level verification and permanent notice retention. [Decision #241](https://github.com/AndreasUnunger/EverythingPath/issues/241#issuecomment-5955002698) supersedes the earlier attribution policy: new admission requires current content-bound evidence and all required reviewed notices. [PRD decision 17 and its acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461) preserve these boundaries. This review establishes no new legal-sufficiency conclusion.

The compilation does not delineate each book's complete inherited notice chain. All fifteen records therefore have `notice-279-complete-chain-<hash>` holds, registered in [held-notices.json](../../scripts/catalog/legal/held-notices.json) following [the curation convention](curation.md#notice-holds-from-content-batches). A current assessment requiring one of these keys remains held despite the Registry review. Unrelated reviewed content can still pass.

Earlier Registry records, holds, both upstream blocks and the permanent notice superset remain unchanged. Existing Dynamite, Thornkeep, Refuge of Time, Horror Realms and Shattered Star #4 holds, Ultimate Combat/Occult Mysteries correction requirements and transcription/PDF gaps remain outstanding. This batch creates no Attribution Assessment. No prior-use inventory was supplied, so no actual retained exception is asserted or cleared.

## Verification

Notice keys are not Catalog Entry keys, so corpus commands run without `--candidates`. Generated output and process temporary files use ignored `.scratch/curation-279/`, with a CommonJS boundary for subprocess fixtures. Commands run locally without deployment or release activation.

```sh
mkdir -p .scratch/curation-279/tmp
export TMPDIR="$PWD/.scratch/curation-279/tmp"
printf '{"type":"commonjs"}\n' > "$TMPDIR/package.json"
PF1_CURATION_SYSTEM="/home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1"
PF1_CURATION_CONTENT="/home/andreas/repos/everythingpath/sources/pf1-content"
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm catalog:format --check
pnpm catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-279/drafts
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-279/preview
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --curation .scratch/curation-279/drafts/records.json --out .scratch/curation-279/preview-drafts
pnpm test tests/catalog/inherited-notices-279.test.ts tests/catalog/notice-holds.test.ts
pnpm test tests/catalog
git diff --check
```

The [29 focused batch tests](../../tests/catalog/inherited-notices-279.test.ts) prove exact keys/bytes, dates, provenance, literal punctuation, absent aliases, legal-page generation and permanent retention, every enforced hold, separate content-assessment requirements, unrelated admission, changed/missing/unreviewed notices and explicit retained-use reporting. Their Attribution Assessments and retained uses are synthetic and establish no shipping content evidence. The batch plus notice-hold consistency tests passed: two files, 31 tests, exit 0, 791 ms.

A direct `buildLegalPageData` invocation with the fifteen keys produced four legal sections, fifteen Registry notices and eighteen total Section 15 notices, without outstanding notices or resources. The other three notices are the two upstream blocks and the project line. This demonstration does not add held-only notice keys to a release's requirements.

An independent audit verified exactly fifteen Registry additions and fifteen enforced-hold additions, the complete ticket inventory, each pinned source-line hash and unchanged previous Registry records/holds. Legal resources, the permanent superset, Attribution Assessments, attribution evidence and the Curation Overlay remain unchanged. No product-code fix or Convex integration test is required.

| Check | Result |
| --- | --- |
| `pnpm -s typecheck` | Pass, exit 0; final run after artifact edits |
| `pnpm -s lint` | Pass, exit 0; final run after artifact edits |
| `pnpm -s check:initial-migration-writers` | Pass; 183 registrations checked |
| `pnpm catalog:pin` | Pass; `sha256:71c66667344e200747085cc47660277a9e7677da10cdd3d58033591444baa25b` |
| `pnpm catalog:format --check` | Pass |
| `catalog:curate` | Pass, exit 0; 4,949 records, 3,625 new drafts, zero replacements/missing bindings, 761 unresolved mechanics; coverage remains failed |
| Default `catalog:preview` | Expected gate exit 1; 54 admitted, 23,128 held, two dependent omissions, zero retained exceptions, 4,731 failures |
| Draft-assisted `catalog:preview` | Expected gate exit 1; same admission dispositions, 1,867 failures |
| Focused batch/hold tests | Pass; two files, 31 tests |
| `pnpm test tests/catalog` | Pass, exit 0; 52 files, 982 tests, 41.93 seconds |
| `git diff --check` | Pass |

Both previews verify the pins and extract 23,037 Catalog Entries plus 538 resources; corpus coverage remains incomplete. Default failures comprise 3,625 missing curation records, 715 unaccounted inventory records and 391 broken references. Supplying drafts replaces the missing-record failures with 761 unresolved mechanics. These corpus-wide gaps remain outside this batch; generated drafts remain temporary and do not become reviewed content assessments.

Both runs hold 21,708 entries for missing Attribution Assessments, 1,388 for existing unresolved assessments and 32 for known source notice/evidence holds. Greater Vital Strike (`pf1/zKNk7a4XxXsygJ67`) and Lightning Stance (`pf1/jbvXxHpu7BVbCpwr`) remain dependent omissions. Required notices are only `PZO1110`, with no outstanding notice or legal resource. None of this batch's keys is required by admitted or retained content, and no discrepancy needed by admitted content is introduced or left unresolved by this review.

| Artifact fingerprint | Default preview | Draft-assisted preview |
| --- | --- | --- |
| Admission-report SHA-256 | `6cc025e129388638c19c3d04844286a2bb73824992c51dca193a4afe8b1ecf5f` | `793c6038460e48b248f61374f8df6fe972b775cc0190f0db70269574afe04614` |
| Extraction | `a9cd1a448e9576fbaa6f6619ccd7376b39421ece752e316cff76199abccf24b9` | `0583f3281884bc4b84a6150d177831fe4dbbc579f0422cc3d5e54036e6e66c6d` |
| Reviewed inputs | `989f00f577c964fa447266d0fd395c0a90125e442cd261d82ea51c243575f7d8` | Same |
| Legal resources | `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e` | Same |

The drafter's records fingerprint is `aeeb69af7c86bad0fc989c2ecee529539fa2ae466b5d43339f83f76c117bf094`. Both previews bind the final Registry and unchanged shipping curation inputs; draft-assisted extraction also applies the temporary drafts.

## Workflow observations and handoff

- Immutable hashes determine the inventory; ticket ordinals 226–240 correspond to source lines 263–277.
- Reviewer metadata remains free-text Registry provenance, with structured reviewer/date in the batch evidence. A reviewed individual line does not establish a complete book notice chain.
- Notice keys cannot select Catalog Entries, so each small notice batch repeats full-corpus drafting and previews. A notice-specific rehearsal or shared landing-wave checks would reduce repeated work.
- Seven catalog tests used at least half their timeout; the slowest used 75%. Keep that margin in mind when scaling concurrent checks.
- #257 remains `OPEN` although the required admission/legal tooling is landed and the brief explicitly authorizes exercising it. Reconcile dependency status before using it to schedule batches.
- The requested Opus/Fable models are unavailable in this environment; implementation delegation uses the inherited available model. No UI work is needed.

Five files changed: the Registry, batch evidence, enforced notice holds, focused test and this report. All changes remain uncommitted. Both pinned checkouts remain clean. The full repository test suite remains the orchestrator's landing gate. Task scratch files are removed at handoff; no answer file is written or linked in the repository. No environment files or private E2E material were accessed, and no upstream writes, deployment, activation, commits, pushes, issues or PRs were performed.

Approximate overlapping phase windows on 2026-10-08 (UTC): brief/policy/source review 02:06–02:10 (four minutes); Registry/evidence/tests 02:08–02:11 (three minutes); operators/checks 02:09–02:16 (seven minutes); report/audit 02:10–02:17 (seven minutes). Overall elapsed time was about eleven minutes; phase durations overlap. Vitest times are local Europe/Stockholm.
