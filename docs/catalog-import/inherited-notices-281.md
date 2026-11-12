# Inherited notice review: #281

Reviewed 2026-10-08 by **Sol (AI curator) for the owner**. This batch reviews the fifteen immutable keys in [#281](https://github.com/AndreasUnunger/EverythingPath/issues/281), following [#264](inherited-notices-264.md) and [#280](inherited-notices-280.md). It establishes compilation-level notice evidence, with enforced holds; it establishes neither content attribution nor printed verification, complete book notice chains or a new legal-sufficiency conclusion.

## Evidence and disposition

All fifteen keys equal SHA-256 of the complete UTF-8 physical notice line, excluding its line ending. They locate `pf1-content/OGL.txt` lines 293–307. Every line is a complete notice, with no heading, wrapped fragment, joining, normalization or byte-identical duplicate. Full identities, raw hashes, reviewer/date, provenance and holds are recorded in [inherited-notices-281.json](../../scripts/catalog/legal/inherited-notices-281.json); verbatim text is in the [Section 15 Registry](../../src/lib/catalog/data/section15-registry.json).

The permitted source is `pf1-content` 11.4.0, commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`, [OGL.txt lines 293–307](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d/OGL.txt#L293-307), file SHA-256 `10bcdc68296b48cc250f38e49de09c9a73645163d7ac7f76e77346a755c35cdc`. The comparison source is `foundryvtt-pathfinder1` v11.11, commit `418761d2e16a6037c0156bb4a241f7cea5a2986d`, [OGL.txt](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/OGL.txt), file SHA-256 `0464e2f13f24c742dc3c2a4c788aab9ab24ca9809873192551b77f784a50d7f9`. No batch notice matches a system notice.

Every row is **reviewed verbatim; complete-book chain held**. The first fourteen literal titles have the `Pathfinder Campaign Setting: ` prefix; the final title is shown in full. Title-terminal periods are preserved below.

| Key prefix | Line | Literal notice title | Copyright year | Additional disposition |
| --- | --- | --- | --- | --- |
| `5745e0c3…` | 293 | Path of the Hellknight | 2016 | — |
| `d2b873cf…` | 294 | Pathfinder Society Field Guide. | 2011 | — |
| `30238fa2…` | 295 | Paths of Prestige | 2012 | — |
| `c0b739c8…` | 296 | Planes of Power | 2016 | — |
| `ef08a5d9…` | 297 | Rival Guide. | 2011 | Nine-author version; author discrepancy held |
| `17ce5c7c…` | 298 | Rival Guide. | 2011 | Three-author version; author discrepancy held |
| `c3d847a5…` | 299 | Ships of the Inner Sea | 2014 | — |
| `857906ab…` | 300 | Taldor, The First Empire | 2017 | — |
| `702eaf4a…` | 301 | Technology Guide Update 1.0 | 2015 | Version-specific notice retained |
| `8b0b2d9d…` | 302 | The First World, Realm of the Fey | 2016 | — |
| `6a15b793…` | 303 | The Inner Sea World Guide. | 2011 | — |
| `ce8df2e6…` | 304 | The Worldwound | 2013 | — |
| `967a54f6…` | 305 | Undead Revisited. | 2011 | — |
| `7c34edff…` | 306 | Undead Unleashed | 2014 | — |
| `e844418a…` | 307 | Pathfinder Chronicles Campaign Setting. | 2008 | — |

`checkedAgainst: "pf1-content"` records the compilation actually compared. Reviewer/date appear in Registry provenance and structured batch evidence. Copyright years, publisher names, contributor labels and punctuation remain literal. Taldor retains `Authors: Mark Moreland, with ...`; the Chronicles notice uses `Copyright 2008` and lists Mike McArtor twice, both retained. Technology Guide Update 1.0 is reviewed only under that versioned title, with no inferred alias to Technology Guide or another version.

Rival Guide lines 297 and 298 share a title and year but have different author lists and publisher punctuation. The first names nine authors; the second names Brandon Hodge, Colin McComb, and Jason Nelson. Both distinct immutable records remain verbatim. The compilation cannot establish which wording is canonical or whether both versions are required. No correction, merge, title alias or product-code alias is invented.

## Policy boundary and enforced holds

[Decision #224](https://github.com/AndreasUnunger/EverythingPath/issues/224#issuecomment-5939689134) defines permitted compilations and known defects. [Decision #227](https://github.com/AndreasUnunger/EverythingPath/issues/227#issuecomment-5948780647) permits compilation-level verification and permanent notice retention. [Decision #241](https://github.com/AndreasUnunger/EverythingPath/issues/241#issuecomment-5955002698) supersedes earlier attribution policy: admission requires current content-bound evidence and every required reviewed notice. [PRD decision 17 and its acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461) preserve these boundaries. A broad notice superset is not content-level coverage evidence.

The fifteen `notice-281-complete-chain-<hash>` holds and two `notice-281-rival-guide-authors-<hash>` holds are registered in [held-notices.json](../../scripts/catalog/legal/held-notices.json), following [the curation convention](curation.md#notice-holds-from-content-batches): **seventeen enforced holds**. Complete-chain holds require permitted evidence establishing each book's entire inherited notice chain and any proposed book/product alias. Each Rival Guide identity additionally requires book-level evidence resolving its author wording. An assessment requiring a held batch key remains held despite the record's reviewed status; unrelated assessed content can pass.

Existing Registry records, source blocks, notice versions and holds remain unchanged, including Ultimate Combat/Occult Mysteries corrections and transcription/PDF gaps. This batch creates no Attribution Assessment or content-attribution evidence. No prior-use inventory was supplied, so no actual retained exception is asserted or cleared. Both upstream notice blocks and the permanent superset are preserved.

## Verification

Notice keys cannot select Catalog Entries, so corpus operators run without `--candidates`. Generated artifacts and process temporary files use ignored `.scratch/curation-281/`, with a CommonJS boundary for subprocess fixtures. These are local rehearsals with no deployment or release activation.

```sh
mkdir -p .scratch/curation-281/tmp
export TMPDIR="$PWD/.scratch/curation-281/tmp"
printf '{"type":"commonjs"}\n' > "$TMPDIR/package.json"
PF1_CURATION_SYSTEM="$PWD/../sources/foundryvtt-pathfinder1"
PF1_CURATION_CONTENT="$PWD/../sources/pf1-content"
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm catalog:format --check
pnpm catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-281/drafts
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-281/preview
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --curation .scratch/curation-281/drafts/records.json --out .scratch/curation-281/preview-drafts
pnpm test tests/catalog/inherited-notices-281.test.ts
pnpm test tests/catalog
CI=true pnpm test tests/catalog --maxWorkers=2
git diff --check
```

The [focused tests](../../tests/catalog/inherited-notices-281.test.ts) demonstrate pinned-byte identity, literal wording, absent aliases, legal-page generation and permanent retention, all seventeen enforced holds, separate content-assessment requirements, unrelated admission, stale notice/content bindings and synthetic retained-use reporting. Synthetic assessments and retained uses supply no shipping content evidence. No product-code fix or Convex integration test is required.

| Check | Result |
| --- | --- |
| `pnpm -s typecheck` | Final rerun pass, exit 0; transient edit failure described below |
| `pnpm -s lint` | Pass, exit 0 |
| `pnpm -s check:initial-migration-writers` | Pass, exit 0; 183 registrations checked |
| `pnpm catalog:pin` | Pass, exit 0; `sha256:52f42dd87903d3f6cdc69f576c93fd2788421cb12540b1969727f6aadcfc333b` |
| `pnpm catalog:format --check` | Pass; canonical formatting |
| `catalog:curate` | Pass, exit 0; 4,908 records, 3,584 new drafts, zero replacements/missing bindings, 759 unresolved mechanics; coverage remains failed |
| Default `catalog:preview` | Expected gate exit 1; 54 admitted, 23,128 held, two dependent omissions, zero retained exceptions, 4,690 failures |
| Draft-assisted `catalog:preview` | Expected gate exit 1; same admission dispositions, 1,865 failures |
| Focused batch tests | Pass; one file, 35 tests, 1.09 seconds |
| Initial `pnpm test tests/catalog` | Exit 1; 52 files passed, three failed; 1,110 tests passed, three timed out; 50.71 seconds |
| `CI=true pnpm test tests/catalog --maxWorkers=2` | Pass, exit 0; 55 files, 1,113 tests, 62.53 seconds; includes batch and notice-hold tests |
| `git diff --check` | Pass |

Independent byte/resource comparison passed. Registry records increase from 250 to 265; enforced hold registrations increase from 626 to 643. The root audit verified every pre-existing record equals `HEAD`, with only fifteen Registry and seventeen hold additions. All fifteen source lines match their exact immutable raw hashes.

A direct `buildLegalPageData` invocation with all fifteen batch keys produced four sections (`ogl`, `section15`, `section8`, `paizo`), fifteen Registry notices and eighteen total Section 15 notices, with no outstanding notices or resources. The other three are both upstream blocks and the project line. Removing all requirements preserved the returned superset byte-identically. This rehearsal does not turn held-only keys into release requirements.

The first typecheck overlapped an in-progress test edit and reported TS2339 for an obsolete `inventoryOccurrences` reference. The delegate removed that reference before the final rerun. This was a transient test-edit failure; no product-code fix was required.

The first catalog suite overlapped full-source operators. Three existing tests exceeded the five-second timeout: feats-338 accounting (5,062 ms), spells-520 full-context binding replay (5,691 ms), and spells-521 full-context binding replay (5,393 ms). There was no assertion mismatch. The rerun limits workers to two and enables the existing CI fifteen-second timeout; no tracked timeout or test logic is changed.

The drafter verified both pins. Required curation comprises 3,687 records: 3,584 drafted and 103 checked, with none missing. Optional descriptions comprise 10,558 candidates, zero drafted and 1,221 checked. Its records fingerprint is `7f8db9a82dc3a0dd1491d50eb28dd894b94fa61547129298d4dfe6abbc8b77fe`. Temporary drafts establish no reviewed attribution.

Both previews verify both pins and extract 23,037 Catalog Entries plus 538 resources. Default failures comprise 3,584 missing curation records, 715 unaccounted inventory records and 391 broken references. Supplying temporary drafts replaces missing-record failures with 759 unresolved curation mechanics, giving 1,865 failures; coverage remains incomplete. Both runs hold 21,708 entries for missing Attribution Assessments, 32 for known notice/evidence holds and 1,388 for other existing content-assessment holds. Greater Vital Strike (`pf1/zKNk7a4XxXsygJ67`) and Lightning Stance (`pf1/jbvXxHpu7BVbCpwr`) remain dependent omissions. Required notices are only `PZO1110`, with none outstanding and no outstanding resources. No batch key is required by admitted or retained content, so these held discrepancies do not affect admitted content. Corpus gaps remain outside this batch.

| Artifact fingerprint | Default preview | Draft-assisted preview |
| --- | --- | --- |
| Admission-report SHA-256 | `ac297ad1b32bdda08a4ace2541bce89c468a3cb4e59b18cfcb4643c130037742` | `5b4cace56e0265c261513342174942523895f6a4788677626ddf7f5010072762` |
| Extraction | `37edcf84cbd79e0d4c6bc0aee8559ddb20fbbf1015b760aee3ae2ac7eed999a5` | `d7da5d1dd5d71a7a9fc66cd84ef0a633793470c574233d7b74e3f1247b91c0ac` |
| Reviewed inputs | `7ff1a231bce64f9d1f2b550d12959f139aded8300da0d6ed6a2eb406f69e4cc4` | Same |
| Legal resources | `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e` | Same |

## Workflow observations and handoff

- Immutable hashes determine this inventory: ticket ordinals 256–270 correspond to physical lines 293–307. Two notices with the same title/year can remain distinct; compare complete bytes before deduplication or aliasing.
- Reviewer metadata remains free-text Registry provenance, supplemented by structured batch evidence. Scaling requires separate review of individual lines, full inherited chains and content-bound attribution.
- Notice keys cannot bound Catalog Entry previews, so these small batches repeat full-corpus drafting and gates. A bounded notice rehearsal would reduce repeated cost while retaining a final full-corpus check.
- Worktree-local temporary directories need a CommonJS package boundary for extensionless subprocess fixtures. Reuse that setup in the batch harness.
- Run final typechecking after artifact edits finish, and use the established CI test timeout with bounded workers during concurrent full-source operators to avoid transient checks and resource-contention timeouts.
- Repository guidance requests Opus/Fable delegation; those aliases are unavailable in this environment. Artifact work uses the available inherited model; no UI work is involved.

Five files change: Registry, batch evidence, enforced holds, focused tests and this report. Changes remain uncommitted. The full repository test suite remains the orchestrator's landing gate and is not run for this batch. Task scratch is removed at handoff. No answer file is written or linked in the repository. No environment files, private E2E material, upstream changes, commits, pushes, issues, PRs, deployment or activation are part of this batch.

Approximate overlapping phase durations on 2026-10-08: brief/policy/source review five minutes; Registry/evidence/tests three minutes; operator validation nine minutes (06:35:55–06:44:19 UTC); report/final audit nine minutes, overlapping those checks. Data artifacts were ready at 06:35:52 UTC; final handoff is around 06:45 UTC. Overall elapsed time is approximately seventeen minutes; phase durations overlap and are not additive. Vitest timestamps are local Europe/Stockholm.
