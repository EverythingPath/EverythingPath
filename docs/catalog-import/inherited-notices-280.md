# Inherited notice review: #280

Reviewed 2026-10-08 by **Sol (AI curator) for the owner**. This batch reviews the fifteen immutable keys in [#280](https://github.com/AndreasUnunger/EverythingPath/issues/280), following [#264](inherited-notices-264.md). It establishes compilation-level notice evidence, with explicit unresolved discrepancies; it establishes neither content attribution nor printed verification or complete book notice chains.

## Evidence and disposition

The fifteen keys locate complete physical notices in `pf1-content/OGL.txt`, lines 278–292. None is a heading or wrapped fragment, and no joining is required. Fourteen suffixes equal SHA-256 of the exact UTF-8 line, excluding its newline. Occult Mysteries is the exception described below. Every stored Registry notice hashes to its key. Full identities, raw hashes, provenance and holds are in [inherited-notices-280.json](../../scripts/catalog/legal/inherited-notices-280.json); verbatim text is in the [Section 15 Registry](../../src/lib/catalog/data/section15-registry.json).

The permitted compilation is `pf1-content` 11.4.0, commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`, [OGL.txt lines 278–292](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d/OGL.txt#L278-292), file SHA-256 `10bcdc68296b48cc250f38e49de09c9a73645163d7ac7f76e77346a755c35cdc`. The comparison source is `foundryvtt-pathfinder1` v11.11, commit `418761d2e16a6037c0156bb4a241f7cea5a2986d`, [OGL.txt](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/OGL.txt), file SHA-256 `0464e2f13f24c742dc3c2a4c788aab9ab24ca9809873192551b77f784a50d7f9`. No batch notice has a byte-identical system counterpart.

Every row is **reviewed verbatim; complete-book chain held**. Titles retain the literal `Pathfinder Campaign Setting: ` prefix. Additional holds apply where stated.

| Key prefix | Line | Literal notice title | Copyright year | Additional disposition |
| --- | --- | --- | --- | --- |
| `6c433b35…` | 278 | Inner Sea NPC Codex | 2013 | — |
| `2cf187d8…` | 279 | Inner Sea Races | 2015 | — |
| `072a665d…` | 280 | Isles of the Shackles | 2012 | — |
| `596ab229…` | 281 | Lands of the Linnorm Kings | 2011 | — |
| `6f57ede4…` | 282 | Lords of Chaos: Book of the Damned, Vol. 2. | 2010 | — |
| `e870a5e7…` | 283 | Lost Cities of Golarion. | 2011 | — |
| `9234bebb…` | 284 | Lost Kingdoms | 2012 | — |
| `d59b8a89…` | 285 | Lost Treasures | 2014 | — |
| `658bcecd…` | 286 | Misfit Monsters Redeemed | 2010 | Publisher wording held |
| `66d1e441…` | 287 | Mythic Realms | 2013 | — |
| `c71414f6…` | 288 | Numeria, Land of Fallen Stars | 2014 | — |
| `93741e21…` | 289 | Occult Bestiary | 2015 | — |
| `7da6fc0f…` | 290 | Occult Mysteries | 2014 | Stored trimmed; raw-line hash in provenance |
| `d176e960…` | 291 | Occult Realms | 2015 | — |
| `d5e5de6b…` | 292 | Osirion, Legacy of Pharaohs | 2014 | — |

`checkedAgainst: "pf1-content"` describes the actual compilation comparison. Reviewer/date appear in Registry provenance and structured batch evidence. The literal double space before `Jessica Price`, publisher spellings, title periods, contributor names and missing terminal periods remain unchanged. Misfit Monsters Redeemed says `Paizo Publushing, LLC`; adjacent notices do not establish a corrected notice for this book. No correction is invented.

Occult Mysteries has one trailing U+0020. Its raw-line SHA-256 is `75497a028ee2f7090b17cf09a7613cc0e5a892a2d25422188d948a4f7e319428`; removing that space produces the supplied `7da6fc0f…` suffix. Under the owner's notice-normalization policy (2026-10-08, [curation.md](curation.md#notice-holds-from-content-batches)), the Registry stores the trimmed line under the supplied ticket identity, so its SHA-256 is the key. The evidence keeps the raw-line hash as `textSha256` beside `keySha256`, the Registry provenance cites it, and the upstream notice block keeps the raw line. No alternate raw-hash alias, product-code alias or book-title alias is added. The `PZO9269` seed, byte-identical to the stored text, stays unreviewed; this review does not resolve the known AoN Numeria substitution or the outstanding Occult Mysteries correction requirement.

## Policy boundary and enforced holds

[Decision #224](https://github.com/AndreasUnunger/EverythingPath/issues/224#issuecomment-5939689134) defines permitted evidence and known defects. [Decision #227](https://github.com/AndreasUnunger/EverythingPath/issues/227#issuecomment-5948780647) permits compilation-level comparison and permanent notice retention. [Decision #241](https://github.com/AndreasUnunger/EverythingPath/issues/241#issuecomment-5955002698) supersedes earlier attribution policy: admission requires current content-bound evidence and every required reviewed notice. [PRD decision 17 and its acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461) preserve these boundaries. This batch establishes no new legal-sufficiency conclusion.

All fifteen `notice-280-complete-chain-<hash>` holds and the additional `notice-280-misfit-monsters-publisher-wording` hold are registered in [held-notices.json](../../scripts/catalog/legal/held-notices.json), following [the curation convention](curation.md#notice-holds-from-content-batches): **sixteen enforced holds**. The Occult Mysteries key-normalization hold was released on 2026-10-08 (see below). A current assessment requiring a batch key stays held despite its reviewed Registry status. Unrelated assessed content can still pass.

Existing Registry records, notice versions, source blocks and holds remain unchanged, including the outstanding Ultimate Combat/Occult Mysteries corrections and transcription/PDF gaps. This batch creates no Attribution Assessment. No prior-use inventory was supplied, so no actual retained exception is asserted or cleared.

## Verification

Notice keys cannot select Catalog Entries, so corpus operators run without `--candidates`. Generated output and process temporary files use ignored `.scratch/curation-280/`, with a CommonJS boundary for subprocess fixtures. No deployment or activation is involved.

```sh
mkdir -p .scratch/curation-280/tmp
export TMPDIR="$PWD/.scratch/curation-280/tmp"
printf '{"type":"commonjs"}\n' > "$TMPDIR/package.json"
PF1_CURATION_SYSTEM="/home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1"
PF1_CURATION_CONTENT="/home/andreas/repos/everythingpath/sources/pf1-content"
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm catalog:format --check
pnpm catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-280/drafts
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-280/preview
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --curation .scratch/curation-280/drafts/records.json --out .scratch/curation-280/preview-drafts
pnpm test tests/catalog/inherited-notices-280.test.ts
CI=true pnpm test tests/catalog/inherited-notices-280.test.ts tests/catalog/notice-holds.test.ts --maxWorkers=2
CI=true pnpm test tests/catalog --maxWorkers=2
git diff --check
```

The [focused tests](../../tests/catalog/inherited-notices-280.test.ts) cover pinned source bytes and the exceptional hash, literal wording, reviewer/date and absent aliases, legal-page generation and permanent retention, all sixteen enforced holds, separate content-assessment requirements, unrelated admission, stale notice/content bindings and synthetic retained-use reporting. Synthetic assessments and retained uses establish no shipping content evidence. No product-code fix or Convex integration test is required.

| Check | Result |
| --- | --- |
| `pnpm -s typecheck` | Pass, exit 0 |
| `pnpm -s lint` | Pass, exit 0 |
| `pnpm -s check:initial-migration-writers` | Pass, exit 0; 183 registrations checked |
| `pnpm catalog:pin` | Pass, exit 0; `sha256:71c66667344e200747085cc47660277a9e7677da10cdd3d58033591444baa25b` |
| `pnpm catalog:format --check` | Pass |
| `catalog:curate` | Pass, exit 0; 4,908 records, 3,584 new drafts, zero replacements/missing bindings, 759 unresolved mechanics; coverage remains failed |
| Default `catalog:preview` | Expected gate exit 1; 54 admitted, 23,128 held, two dependent omissions, zero retained exceptions, 4,690 failures |
| Draft-assisted `catalog:preview` | Expected gate exit 1; same admission dispositions, 1,865 failures |
| Focused batch tests | Pass; one file, 32 tests, 682 ms |
| Focused batch/hold tests | Pass, exit 0; two files, 34 tests, 806 ms |
| `CI=true pnpm test tests/catalog --maxWorkers=2` | Pass, exit 0; 54 files, 1,078 tests, 63.55 seconds |
| `git diff --check` | Pass |

A direct `buildLegalPageData` invocation with all fifteen keys produced four sections, fifteen Registry notices and eighteen total Section 15 notices, with zero outstanding notices or resources. The other three are the two upstream blocks and project line. Removing the requirements and Registry while carrying the returned permanent superset retained all eighteen byte-identical notices. This demonstration does not make held-only notice keys release requirements.

Independent audit verified fifteen Registry additions, 235 unchanged prior records, seventeen enforced-hold additions and 609 unchanged prior hold registrations. All fifteen Registry lines equal the raw pinned lines; fourteen immutable suffixes equal those raw hashes, with the documented Occult Mysteries exception. Only the five expected files changed.

The drafter verified both pins. Required curation comprises 3,687 records: 3,584 drafted and 103 checked, with none missing. Optional prose comprises 10,558 candidates, zero drafted and 1,221 checked. Its records fingerprint is `7f8db9a82dc3a0dd1491d50eb28dd894b94fa61547129298d4dfe6abbc8b77fe`. Temporary drafts do not establish reviewed content attribution.

Both previews verify the pins and extract 23,037 Catalog Entries plus 538 resources. Default failures comprise 3,584 missing curation records, 715 unaccounted inventory records and 391 broken references. Supplying temporary drafts replaces missing-record failures with 759 unresolved mechanics; both runs report incomplete coverage. These corpus gaps remain outside this batch.

Both runs hold 21,708 entries for missing Attribution Assessments, 41 for known notice/evidence holds and 1,379 for other existing content-assessment holds. Greater Vital Strike (`pf1/zKNk7a4XxXsygJ67`) and Lightning Stance (`pf1/jbvXxHpu7BVbCpwr`) remain dependent omissions. Required notices are only `PZO1110`, with zero outstanding notices/resources; no batch key is required by admitted or retained content. This batch therefore leaves no discrepancy needed by admitted content unresolved.

| Artifact fingerprint | Default preview | Draft-assisted preview |
| --- | --- | --- |
| Admission-report SHA-256 | `c2a1fa0b6a30ef5db2d8042594dc769fffca1c24b469a7ea443e1aa2321cc0b7` | `a260da11d2ac95e8eec3ae999777ee27ac8824a31e7d588e058a32eeb57bc4cb` |
| Extraction | `37edcf84cbd79e0d4c6bc0aee8559ddb20fbbf1015b760aee3ae2ac7eed999a5` | `d7da5d1dd5d71a7a9fc66cd84ef0a633793470c574233d7b74e3f1247b91c0ac` |
| Reviewed inputs | `1e371926ea340f093401d4e2e6bcf2523ae4b44c13456bddecab3924b489159f` | Same |
| Legal resources | `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e` | Same |

## Workflow observations and handoff

- Immutable hashes determine the inventory; ticket ordinals 241–255 correspond to physical lines 278–292. The Occult Mysteries discrepancy shows why source-byte verification must distinguish supplied identities from observed raw hashes.
- Reviewer metadata remains free-text Registry provenance, supplemented by structured batch evidence. A reviewed line does not establish a complete book chain.
- Notice batches repeat full-corpus drafting and previews because notice keys cannot select Catalog Entries; a bounded notice rehearsal could reduce that repeated cost.
- Repository `AGENTS.md` requires Opus/Fable delegation, but those aliases are unavailable here. Artifact work uses the inherited available model; no UI work is needed.

Five files change: the Registry, batch evidence, enforced holds, focused tests and this report. Changes remain uncommitted, and both pinned checkouts remain clean. The full repository test suite remains the orchestrator's landing gate. Task scratch files are removed at handoff. No answer file is written or linked in the repository. No environment files, private E2E material, upstream writes, deployment, activation, commits, pushes, issues or PRs are part of this batch.

Approximate overlapping UTC phase windows on 2026-10-08: brief/policy/source review 02:29–02:33 (four minutes); Registry/evidence/tests 02:30–02:34 (four minutes); operators/checks 02:33–02:40 (seven minutes); report/audit 02:34–02:41 (seven minutes). Overall elapsed time is about twelve minutes; phase durations overlap. Vitest timestamps are local Europe/Stockholm.

## Owner follow-up: notice normalization (2026-10-08)

The owner decided that notice text is stored trimmed, so the SHA-256 of a stored hash-keyed notice equals its key ([curation.md](curation.md#notice-holds-from-content-batches)). The Registry now stores Occult Mysteries (`7da6fc0f…`) without its trailing U+0020, and its provenance keeps the raw-line hash `75497a02…`. The `notice-280-occult-mysteries-key-normalization` hold is released from the batch evidence and `held-notices.json`. Its complete-chain hold stays enforced, so the batch now has **sixteen enforced holds**. This supersedes the original audit's statement that all fifteen Registry lines equal the raw pinned lines; fourteen do, and Occult Mysteries equals its line without the trailing space. No assessment requires this key, so no binding changes for it. The raw line, trailing space included, stays in the upstream notice block. The unreviewed `PZO9269` seed, which held the same raw line, is stored trimmed too, with the raw-line hash in its provenance; it stays unreviewed. Two unresolved assessments require `PZO9269` (Lucky Number, #517, and Spectral Saluqi, #524), and their notice bindings are refreshed. No admitted content requires it.

An audit of all 320 hash-keyed Registry notices, including those from #267–#279, found no other stored notice whose hash differs from its key, and none other with surrounding whitespace. The trailing-space variants that #267–#272 left out of the Registry (lines 91, 107, 126, 143, 148, 155 and 165) trim to their reviewed lines, so they need no record of their own under this rule. `tests/catalog/section15-registry.test.ts` now checks that every notice is trimmed and every hash-keyed notice hashes to its key.
