# Inherited notice review: #278

Reviewed 2026-10-08 by **Sol (AI curator) for the owner**. This batch reviews the fifteen immutable keys in [#278](https://github.com/AndreasUnunger/EverythingPath/issues/278), following [#264](inherited-notices-264.md). It establishes compilation-level notice evidence; content attribution, printed verification, complete book notice chains and legal sufficiency remain separate reviews.

## Evidence and disposition

Every key uniquely matches a complete physical UTF-8 line in `pf1-content/OGL.txt`, lines 248–262. SHA-256 excludes the newline without trimming or normalization. None is a heading or wrapped fragment; no joining is needed. Full identities, source locations, comparisons and named holds are in [inherited-notices-278.json](../../scripts/catalog/legal/inherited-notices-278.json); verbatim text is in the [Section 15 Registry](../../src/lib/catalog/data/section15-registry.json).

The permitted compilation is `pf1-content` 11.4.0, commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`, [OGL.txt lines 248–262](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d/OGL.txt#L248-262), file SHA-256 `10bcdc68296b48cc250f38e49de09c9a73645163d7ac7f76e77346a755c35cdc`. The system comparison uses `foundryvtt-pathfinder1` v11.11, commit `418761d2e16a6037c0156bb4a241f7cea5a2986d`, [OGL.txt](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/OGL.txt), file SHA-256 `0464e2f13f24c742dc3c2a4c788aab9ab24ca9809873192551b77f784a50d7f9`. Each batch line occurs once in the content compilation and has no byte-identical system counterpart. Both complete files match the committed legal resources.

`checkedAgainst: "pf1-content"` records the compilation comparison, without claiming a printed-book check. Reviewer/date appear in Registry provenance and the structured batch inventory. Copyright dates, contributor names, punctuation and publisher wording remain literal. No book-title or product-code alias is established.

Every row is **reviewed verbatim; complete-book chain held**. The Artifacts line also has a wording hold.

| Key prefix | Line | Literal notice title | Copyright year |
| --- | --- | --- | --- |
| `7f516487…` | 248 | Pathfinder Adventure Path #72: The Witch Queen's Revenge | 2013 |
| `d193b10f…` | 249 | Pathfinder Adventure Path #73: The Worldwound Incursion | 2013 |
| `4e699a12…` | 250 | Pathfinder Adventure Path #75: Demon’s Heresy | 2013 |
| `2bc81d0d…` | 251 | Pathfinder Adventure Path #77: Herald of the Ivory Labyrinth | 2013 |
| `038d2821…` | 252 | Pathfinder Adventure Path #78: City of Locusts | 2014 |
| `27e18f28…` | 253 | Pathfinder Adventure Path #81: Shifting Sands | 2014 |
| `a6e469ea…` | 254 | Pathfinder Adventure Path #82: Secrets of the Sphinx | 2014 |
| `3499ce28…` | 255 | Pathfinder Adventure Path #84: Pyramid of the Sky Pharaoh | 2014 |
| `69efe70e…` | 256 | Pathfinder Adventure Path #87: The Choking Tower | 2014 |
| `73d65fd5…` | 257 | Pathfinder Adventure Path #91: Battle of Bloodmarch Hill | 2015 |
| `7e41cf38…` | 258 | Pathfinder Adventure Path #95: Anvil of Fire | 2015 |
| `424acdd4…` | 259 | Pathfinder Adventure Path #99: Dance of the Damned | 2015 |
| `db13e37c…` | 260 | Pathfinder Adventure Path: Rise of the Runelords Anniversary Edition | 2012 |
| `8fba1a98…` | 261 | `Pathfinder Campaign Setting: Artifacts &amp; Legends</b>` | 2012 |
| `68317a01…` | 262 | Pathfinder Campaign Setting: Belkzen, Hold of the Orc Hordes | 2015 |

Line 254 names Amber E. Scott twice, as the main author and in the `with` list. Both occurrences remain; no contradictory permitted comparison establishes an error. Line 261 literally includes `&amp;` and a stray `</b>` closing tag. The intended wording is unresolved, so the complete line and source-derived title remain unchanged and `notice-278-artifacts-legends-wording-markup` records the needed comparison. Decoding the entity or stripping the tag would invent a correction. No discrepancy needed by currently admitted content remains unresolved: the observed preview requires only `PZO1110`.

## Policy boundary and enforced holds

[Decision #224](https://github.com/AndreasUnunger/EverythingPath/issues/224#issuecomment-5939689134) identifies permitted evidence and known defects. [Decision #227](https://github.com/AndreasUnunger/EverythingPath/issues/227#issuecomment-5948780647) permits compilation-level verification and requires permanent notice retention. [Decision #241](https://github.com/AndreasUnunger/EverythingPath/issues/241#issuecomment-5955002698) supersedes the earlier one-off attribution and unmatched-record admission policy: admission requires current content-bound evidence and reviewed required notices. [PRD decision 17 and acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461) retain these boundaries.

The compilation does not delineate each book's complete inherited notice chain. All fifteen lines therefore have `notice-278-complete-chain-<hash>` holds, alongside the separate Artifacts wording hold. All sixteen holds are enforced in [held-notices.json](../../scripts/catalog/legal/held-notices.json), following [the curation convention](curation.md#notice-holds-from-content-batches). Registry review does not lift them; even a current synthetic assessment requiring a held key remains held. Unrelated reviewed content may still pass.

Both upstream notice blocks, permanent notice versions and every earlier Registry record and hold remain unchanged. Existing Dynamite, Thornkeep, Refuge of Time, Horror Realms and Shattered Star #4 holds, Ultimate Combat/Occult Mysteries correction gaps and transcription/PDF review gaps remain outside this batch. No Attribution Assessment or accepted content evidence is created. No prior-use inventory was supplied, so no actual retained exception is asserted or cleared.

## Verification

Notice keys are not Catalog Entry keys; corpus commands run without `--candidates`. All generated output and process temporary files use ignored `.scratch/curation-278/`, with a CommonJS boundary for subprocess fixtures. Commands operate locally without deployment or activation.

```sh
mkdir -p .scratch/curation-278/tmp
export TMPDIR="$PWD/.scratch/curation-278/tmp"
printf '{"type":"commonjs"}\n' > "$TMPDIR/package.json"
PF1_CURATION_SYSTEM="$PWD/../sources/foundryvtt-pathfinder1"
PF1_CURATION_CONTENT="$PWD/../sources/pf1-content"
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm catalog:format --check
pnpm catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-278/drafts
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-278/preview
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --curation .scratch/curation-278/drafts/records.json --out .scratch/curation-278/preview-drafts
pnpm test tests/catalog/inherited-notices-278.test.ts tests/catalog/notice-holds.test.ts
pnpm test tests/catalog
git diff --check
```

The [30 focused batch tests](../../tests/catalog/inherited-notices-278.test.ts) prove exact identities/bytes, source provenance, dates, absent aliases, literal markup, legal-page generation, permanent notice retention, every enforced hold, separate content-assessment requirements, unrelated admission, changed/missing/unreviewed notices and explicit retained-use reporting. All assessments and retained uses in those tests are synthetic. A direct `buildLegalPageData` invocation with the batch keys produced four legal sections, fifteen Registry notices and eighteen total Section 15 notices, with no outstanding notice/resource. Both upstream blocks and the project notice account for the other three. This demonstration does not introduce held-only notices as release requirements.

An independent audit confirmed exactly fifteen Registry additions and sixteen enforced-hold additions, every source-line hash, unchanged prior records, and unchanged attribution inputs/legal resources. Both pinned checkouts remain clean.

| Check | Result |
| --- | --- |
| `pnpm -s typecheck` | Pass, exit 0 |
| `pnpm -s lint` | Pass, exit 0 |
| `pnpm -s check:initial-migration-writers` | Pass; 183 registrations checked |
| `pnpm catalog:pin` | Pass; `sha256:71c66667344e200747085cc47660277a9e7677da10cdd3d58033591444baa25b` |
| `pnpm catalog:format --check` | Pass |
| `catalog:curate` | Pass, exit 0; 4,749 records, 3,625 new drafts, no replacements/missing bindings, 761 unresolved mechanics; coverage remains failed |
| Default `catalog:preview` | Expected gate exit 1; 53 admitted, 23,129 held, two dependent omissions, no retained exceptions, 4,731 failures |
| Draft-assisted `catalog:preview` | Expected gate exit 1; same admission dispositions, 1,867 failures |
| Focused batch/hold tests | Pass; two files, 32 tests (30 batch, two consistency) |
| `pnpm test tests/catalog` | Pass, exit 0; 48 files, 858 tests, 48.11 seconds |
| `git diff --check` | Pass |

Both previews verify the pins and extract 23,037 entries plus 538 resources; corpus coverage remains incomplete. Default failures comprise 3,625 missing curation records, 715 unaccounted inventory records and 391 broken references. Supplying drafts replaces the missing-record failures with 761 unresolved mechanics, leaving the same inventory/reference gaps. Drafts remain temporary operator evidence, without promotion to reviewed content assessments.

Both runs hold 21,906 entries for missing Attribution Assessments, 1,191 for existing unresolved assessments and 32 for known source notice/evidence holds. Greater Vital Strike (`pf1/zKNk7a4XxXsygJ67`) and Lightning Stance (`pf1/jbvXxHpu7BVbCpwr`) remain dependent omissions. Required notices are only `PZO1110`, with no outstanding notice or legal resource. This batch introduces no new admission; none of its held-only keys becomes an admitted requirement.

| Artifact fingerprint | Default preview | Draft-assisted preview |
| --- | --- | --- |
| Admission-report SHA-256 | `bab7946b77f4c018f6af7d1504191392a498f1c976fe43c206e18a930f10e6fc` | `cea3cc16ff01b04221331199fcb6a9ff654620b738a61f5d0d08a49712cfb9cb` |
| Extraction | `01634e7718bcaa3d656ca24bd6ed1a193e4dbff833f2c6479fc4525829beaf5b` | `22bd887f1af04bb218eeaefc74da4c4a2f9a6eb8990b1c1a86278d1c19bb57f5` |
| Reviewed inputs | `0ac5d27e62308eeb49d3f01dd72da3ecf23e3658721985debbad4f9f06413f0d` | Same |
| Legal resources | `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e` | Same |

## Workflow observations and handoff

- Immutable hashes determine the inventory; ticket ordinals 211–225 correspond to source lines 248–262.
- Reviewer metadata remains free-text Registry provenance, with structured reviewer/date in batch evidence.
- Notice batches repeat costly full-corpus commands because notice keys cannot select Catalog Entries. A notice-specific rehearsal or shared landing-wave checks would reduce repeated work. Six passing catalog tests consumed at least half their timeout; one reached 92%, leaving little margin when scaling concurrent gates.
- #257 remains `OPEN`, although the requested admission/legal tooling is landed and the brief authorizes exercising it. Reconcile tracker state before using dependencies to schedule batches.
- Requested Opus/Fable models are unavailable; artifact/test delegation uses the inherited available model. No UI work is needed.

Five files changed: the Registry, batch evidence, enforced notice holds, focused test and this report. Changes remain uncommitted. No product-code change or Convex integration test was needed. The full repository test suite remains the orchestrator's landing gate. Scratch output is removed at handoff; no answer file is written or linked in the repository.

Approximate overlapping phase windows on 2026-10-08 (UTC): policy/source review 00:59–01:03 (four minutes); Registry/evidence/tests 01:01–01:03 (two minutes); operators/checks 01:02–01:10 (eight minutes); report/audit 01:08–01:11 (three minutes). Overall elapsed time was about eleven minutes; overlapping phase durations are not additive. Vitest times are local Europe/Stockholm.
