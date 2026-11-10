# Inherited notice review: #282

Reviewed 2026-10-08 by **Sol (AI curator) for the owner**, following [#264](inherited-notices-264.md). All fifteen immutable keys in [#282](https://github.com/AndreasUnunger/EverythingPath/issues/282) are reviewed at compilation level. This establishes notice evidence, with unresolved chains and wording held; it establishes neither content attribution nor printed verification or a new legal-sufficiency conclusion.

## Evidence and disposition

Every key is SHA-256 of one complete UTF-8 physical line, excluding its newline, in pinned `pf1-content/OGL.txt` lines 308–322. No heading, wrapped fragment, normalization or joining is involved. Full identities and comparisons are in [inherited-notices-282.json](../../scripts/catalog/legal/inherited-notices-282.json); verbatim notices, reviewer/date and provenance are in the [Section 15 Registry](../../src/lib/catalog/data/section15-registry.json).

- Compilation: `pf1-content` 11.4.0, commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`, [OGL.txt lines 308–322](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d/OGL.txt#L308-322), file SHA-256 `10bcdc68296b48cc250f38e49de09c9a73645163d7ac7f76e77346a755c35cdc`.
- Comparison: `foundryvtt-pathfinder1` v11.11, commit `418761d2e16a6037c0156bb4a241f7cea5a2986d`, [OGL.txt](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/OGL.txt), file SHA-256 `0464e2f13f24c742dc3c2a4c788aab9ab24ca9809873192551b77f784a50d7f9`. None of the batch notices matches a system notice.

Every row is **reviewed verbatim; complete-book chain held**. Titles below omit their shared literal `Pathfinder Chronicles: ` prefix.

| Key prefix | Line | Notice title | Copyright year | Additional hold |
| --- | --- | --- | --- | --- |
| `b789a151…` | 308 | Cities of Golarion | 2009 | — |
| `612c63b7…` | 309 | City of Strangers | 2010 | — |
| `e00109d8…` | 310 | Classic Horrors Revisited | 2009 | — |
| `16a66781…` | 311 | Classic Treasures Revisited | 2010 | — |
| `32dfaffc…` | 312 | Dark Markets, A Guide to Katapesh | 2009 | — |
| `aed8f29e…` | 313 | Dragons Revisited | 2009 | — |
| `6883d43d…` | 314 | Dungeon Denizens Revisited | 2009 | — |
| `46db8d00…` | 315 | Faction Guide | 2010 | — |
| `124c8640…` | 316 | Guide to Absalom | 2008 | — |
| `b8094334…` | 317 | Guide to the River Kingdoms | 2010 | Contributor wording |
| `064a3bb6…` | 318 | Heart of the Jungle | 2010 | — |
| `965d59ee…` | 319 | Princes of Darkness, Book of the Damned Vol. I | 2009 | Variant reconciliation |
| `3579a23d…` | 320 | Princes of Darkness, Book of the Damned, Vol. I | 2009 | Variant reconciliation |
| `c3f230e1…` | 321 | Seekers of Secrets | 2009 | — |
| `df9a5e20…` | 322 | The Great Beyond, A Guide to the Multiverse | 2009 | — |

All lines literally use `Copyright`, `Paizo Publishing, LLC`, and their original contributor labels, names and punctuation. Guide to the River Kingdoms contains `Je' Quick`; the permitted evidence does not supply a corrected contributor name. Both Princes of Darkness notices have identical contributors/date but differ by a comma after `Damned`. Their hashes and records remain distinct, with neither treated as an alias. No replacement wording, product-code or book-title alias is inferred. `checkedAgainst: "pf1-content"` describes the comparison performed; the review date is separate from each copyright year.

## Policy boundary and enforced holds

[#224](https://github.com/AndreasUnunger/EverythingPath/issues/224#issuecomment-5939689134) defines permitted evidence and compilation defects. [#227](https://github.com/AndreasUnunger/EverythingPath/issues/227#issuecomment-5948780647) permits compilation verification and permanent notice retention. [#241](https://github.com/AndreasUnunger/EverythingPath/issues/241#issuecomment-5955002698) supersedes earlier attribution policy: each admitted definition needs current content-bound evidence and all required reviewed notices. [PRD decision 17 and its acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461) retain these boundaries.

The compilation identifies these individual notices but does not delineate each book's complete inherited chain. All fifteen `notice-282-complete-chain-<hash>` holds are therefore retained. Three additional holds name `notice-282-river-kingdoms-contributor-wording`, `notice-282-princes-of-darkness-variant-319` and `notice-282-princes-of-darkness-variant-320`. All **eighteen holds** are registered in [held-notices.json](../../scripts/catalog/legal/held-notices.json), following [curation.md](curation.md#notice-holds-from-content-batches). Current synthetic assessments requiring these keys remain held despite their reviewed Registry status; independently assessed unrelated content can pass.

Existing Registry records, permanent notice versions and holds remain unchanged, including Ultimate Combat/Occult Mysteries corrections, owner-transcription checks, free-PDF gaps and known source-matched exclusions. No Attribution Assessment is created. No prior-use inventory was supplied, so no actual retained exception is asserted or cleared.

## Verification

Scratch output and process temporary directories use ignored `.scratch/curation-282/`, with a CommonJS package boundary for subprocess fixtures. Notice keys cannot select Catalog Entries, so corpus operators run without `--candidates`.

```sh
mkdir -p .scratch/curation-282/tmp
export TMPDIR="$PWD/.scratch/curation-282/tmp"
printf '{"type":"commonjs"}\n' > "$TMPDIR/package.json"
PF1_CURATION_SYSTEM="/home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1"
PF1_CURATION_CONTENT="/home/andreas/repos/everythingpath/sources/pf1-content"
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm catalog:format --check
pnpm catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-282/drafts
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-282/preview
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --curation .scratch/curation-282/drafts/records.json --out .scratch/curation-282/preview-drafts
pnpm test tests/catalog/inherited-notices-282.test.ts tests/catalog/notice-holds.test.ts
CI=true pnpm test tests/catalog --maxWorkers=2
git diff --check
```

The [33 focused batch tests](../../tests/catalog/inherited-notices-282.test.ts) verify the independent immutable inventory, complete committed source bytes, literal wording, dates/provenance, absent aliases, all enforced holds, legal-page generation, permanent retention, separate content evidence, stale bindings, unrelated admission and synthetic retained exceptions. Fixture assessments/uses are solely behavioural demonstrations, not shipping evidence. No product-code fix or Convex integration test is required.

A direct `buildLegalPageData` invocation with the fifteen keys generated four sections, fifteen Registry notices and eighteen total Section 15 entries, with zero outstanding notices/resources. Removing all requirements and Registry records while carrying its permanent superset retained every entry identically. Held-only keys are not thereby made release requirements.

| Check | Result |
| --- | --- |
| `pnpm -s typecheck` | Pass, exit 0; repeated with the final batch test |
| `pnpm -s lint` | Pass, exit 0; final batch file also passed a focused ESLint run |
| `pnpm -s check:initial-migration-writers` | Pass, exit 0; 183 registrations |
| `pnpm catalog:pin` | Pass, exit 0; `sha256:52f42dd87903d3f6cdc69f576c93fd2788421cb12540b1969727f6aadcfc333b` |
| `pnpm catalog:format --check` | Pass, exit 0 |
| `catalog:curate` | Exit 0; 4,908 records, 3,584 new drafts, zero replacements/missing bindings, 759 unresolved mechanics; coverage remains failed |
| Default `catalog:preview` | Expected gate exit 1; 54 admitted, 23,128 held, two dependent omissions, zero retained exceptions, 4,690 failures |
| Draft-assisted `catalog:preview` | Expected gate exit 1; same admission dispositions, 1,865 failures |
| Focused batch and hold tests | Pass; 33 batch tests and two hold-scanner tests |
| `CI=true pnpm test tests/catalog --maxWorkers=2` | Pass, exit 0; 55 files, 1,111 tests, 68.08 seconds |
| Prettier and `git diff --check` | Pass |

Both previews use verified pins and extract 23,037 Catalog Entries plus 538 resources. The default gate failures comprise 3,584 missing curation records, 715 unaccounted inventory records and 391 broken references. Supplying drafts replaces missing-record failures with 759 unresolved mechanics; the inventory/reference gaps remain. These corpus gaps are outside this notice batch. Required notices are only `PZO1110`, with zero outstanding notices/resources; no batch key is required by admitted or retained content. No discrepancy needed by admitted content remains unresolved in this batch. Greater Vital Strike (`pf1/zKNk7a4XxXsygJ67`) and Lightning Stance (`pf1/jbvXxHpu7BVbCpwr`) remain dependent omissions. Temporary drafts do not establish reviewed content attribution.

| Artifact fingerprint | Default preview | Draft-assisted preview |
| --- | --- | --- |
| Admission-report SHA-256 | `6c9f444a14956a410be5cd0f58672969942ddbd056afc53eaab1a2c1f2e18df8` | `f06bf3d10b4ef509fd064c6e8b5f42ea3fe23e38c71ec0fb424ad5c3f2db0ab0` |
| Extraction | `37edcf84cbd79e0d4c6bc0aee8559ddb20fbbf1015b760aee3ae2ac7eed999a5` | `d7da5d1dd5d71a7a9fc66cd84ef0a633793470c574233d7b74e3f1247b91c0ac` |
| Reviewed inputs | `b01b77c7e0ef2def432e3ec8563d73803277dff58b0fed9bb37cf22f1dbf6f9d` | Same |
| Legal resources | `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e` | Same |

## Handoff and workflow observations

Five files change: Registry, batch evidence, enforced holds, focused tests and this report. Independent review confirms exactly fifteen Registry additions and eighteen hold registrations, with all 250 prior Registry records and 626 prior hold registrations unchanged. Legal resources and content assessments remain unchanged. No product code changes are needed. Changes remain uncommitted; the full test suite remains the orchestrator's landing gate. Scratch files are removed after recording results; the pinned checkouts remain read-only.

- The Registry records reviewer metadata in free-text provenance; structured batch evidence makes it auditable.
- Full-corpus drafting and previews repeat work for each notice batch. A bounded notice rehearsal command could reduce that cost while retaining the final corpus gates.
- Requested Opus/Fable model aliases are unavailable in this environment; implementation delegation used the available inherited model.
- A worktree-local temporary directory needs a CommonJS boundary for extensionless subprocess fixtures. Preserve that setup in the batch harness.

Approximate overlapping UTC phase windows on 2026-10-08: brief/policy/source review 06:51–06:54 (three minutes); Registry/evidence/tests 06:53–06:56 (three minutes); operators/checks 06:53–07:02 (nine minutes); report/audit/cleanup 06:57–07:03 (six minutes). Overall elapsed time is about twelve minutes; phase durations overlap. Vitest timestamps use local Europe/Stockholm time.
