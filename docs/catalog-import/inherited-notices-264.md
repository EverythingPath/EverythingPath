# Inherited notice review: #264

Reviewed 2026-10-07 by **Astra (AI curator) for the owner**. This batch reviews the fifteen immutable notice blocks listed in [#264](https://github.com/AndreasUnunger/EverythingPath/issues/264). It establishes notice evidence, not content attribution or a new legal-sufficiency conclusion.

## Evidence and disposition

Every key matches SHA-256 of one complete UTF-8 source line, excluding its newline. None is a heading or wrapped fragment; no joining or text correction was needed. The copyright dates, punctuation, author spellings and wording are retained exactly. The review date is separate from those copyright dates.

- System: `foundryvtt-pathfinder1`, `v11.11`, commit `418761d2e16a6037c0156bb4a241f7cea5a2986d`, [OGL.txt lines 41–43](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/OGL.txt#L41-43), file SHA-256 `0464e2f13f24c742dc3c2a4c788aab9ab24ca9809873192551b77f784a50d7f9`.
- Content: `pf1-content`, `11.4.0`, commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`, [OGL.txt lines 41–52](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d/OGL.txt#L41-52), file SHA-256 `10bcdc68296b48cc250f38e49de09c9a73645163d7ac7f76e77346a755c35cdc`.

The complete per-key inventory and source locations are recorded in [inherited-notices-264.json](../../scripts/catalog/legal/inherited-notices-264.json); the reviewed text is in [section15-registry.json](../../src/lib/catalog/data/section15-registry.json). Twelve canonical records use the `pf1-content/notice/<hash>` identities. The three byte-identical system identities are aliases. `checkedAgainst: "pf1-content"` describes the permitted compilation actually compared; it does not claim printed verification. The existing schema has no reviewer property, so the reviewer is recorded in Registry provenance and the batch evidence.

| Key suffix (full identities in the evidence inventory) | Repository | Notice | Disposition |
| --- | --- | --- | --- |
| `0a956582…70bd3c` | `pf1` | Open Game License, 2000 | Reviewed alias of identical content block |
| `3a6b2650…c08a80` | `pf1` | System Reference Document, 2000–2003 | Reviewed alias of identical content block |
| `64871234…dc0e9` | `pf1` | Foundry Virtual Tabletop, 2019 | Reviewed alias of identical content block |
| `0a956582…70bd3c` | `pf1-content` | Open Game License, 2000 | Reviewed canonical block |
| `3a6b2650…c08a80` | `pf1-content` | System Reference Document, 2000–2003 | Reviewed canonical block |
| `64871234…dc0e9` | `pf1-content` | Foundry Virtual Tabletop, 2019 | Reviewed canonical block |
| `9b5e2dca…179c2a` | `pf1-content` | Advanced Class Guide, 2014 | Reviewed block; full-book chain held |
| `7d75468e…23b2a2` | `pf1-content` | Advanced Player’s Guide, 2010 | Reviewed block; full-book chain held |
| `457075cc…36ac1e` | `pf1-content` | Advanced Race Guide, 2012 | Reviewed block; full-book chain held |
| `2e30b523…4c4cbc` | `pf1-content` | Bestiary 2, 2010 | Reviewed block; full-book chain held |
| `b840ae33…ec77078` | `pf1-content` | Bestiary 3, 2011 | Reviewed block; full-book chain held |
| `19445ec0…07fbe7` | `pf1-content` | Bestiary 4, 2013 | Reviewed block; full-book chain held |
| `be58a1ce…5e78700` | `pf1-content` | Bestiary 5, 2015 | Reviewed block; full-book chain held |
| `45537b13…61a6f` | `pf1-content` | Bestiary Preview, 2009 | Reviewed block; full-book chain held |
| `7b8bd4df…10b7e4c` | `pf1-content` | Bestiary, 2009 | Reviewed block; full-book chain held |

## Review boundary and holds

[Decision #224](https://github.com/AndreasUnunger/EverythingPath/issues/224#issuecomment-5939689134) identifies the allowed compilations and their known defects. [Decision #227](https://github.com/AndreasUnunger/EverythingPath/issues/227#issuecomment-5948780647) permits compilation-level verification and requires permanent notice retention. Its owner transcriptions remain unreviewed seeds where a PDF comparison is still required. [Decision #241](https://github.com/AndreasUnunger/EverythingPath/issues/241#issuecomment-5955002698) supersedes the one-off attribution policy: admission needs current content-bound evidence as well as reviewed notices. [PRD decision 17 and its acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461) retain these boundaries.

The compilation identifies individual lines but does not group all inherited notices by book. The nine book lines therefore retain a named full-book-chain hold in the evidence inventory. No product-code or book-title aliases were invented, and these records cannot satisfy those book requirements by name. Future content review must establish all necessary notice requirements and resolve the corresponding inheritance gap. No Attribution Assessment is created or rebound by this batch.

Existing holds remain: Dynamite comics, Thornkeep, Refuge of Time, Horror Realms and Shattered Star #4; pending Ultimate Combat and Occult Mysteries corrections; free-PDF transcription gaps; and owner-transcription PDF checks. Both complete upstream notices and all permanent notice versions remain unchanged. No prior-use inventory was supplied for this batch, so no actual retained exception is asserted or cleared.

## Verification

Commands use the pinned sibling checkouts. All temporary files and process temporary directories are confined to the ignored `.scratch/curation-264/` directory and removed after reporting. No deployment or release activation is involved.

```sh
mkdir -p .scratch/curation-264/tmp
export TMPDIR="$PWD/.scratch/curation-264/tmp"
printf '{"type":"commonjs"}\n' > "$TMPDIR/package.json"
PF1_CURATION_SYSTEM="$PWD/../sources/foundryvtt-pathfinder1"
PF1_CURATION_CONTENT="$PWD/../sources/pf1-content"
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-264/drafts
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-264/preview
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --curation .scratch/curation-264/drafts/records.json --out .scratch/curation-264/preview-drafts
pnpm test tests/catalog/inherited-notices-264.test.ts
pnpm test tests/catalog
pnpm test
```

The [five focused tests](../../tests/catalog/inherited-notices-264.test.ts) verify all fifteen identities against the exact committed upstream bytes, resolve aliases, build the legal page, preserve the permanent superset after requirements disappear, require a separate content assessment, reopen changed notice bindings, and keep missing book chains and pre-existing seeds outstanding. The successful admission case is explicitly synthetic; it is not shipping attribution evidence. A direct `buildLegalPageData` invocation with the fifteen batch keys also produced four legal sections, twelve Registry notices plus both upstream blocks and the project notice (fifteen total), and no outstanding notice or resource for those keys.

Independent byte comparison against both pinned checkouts passed for every block. All five pre-existing Registry records remain equal to `HEAD`; resources, Attribution Assessments, attribution evidence and existing hold files are unchanged. No product-code fix was necessary.

| Check | Result |
| --- | --- |
| `pnpm -s typecheck` | Pass, exit 0 |
| `pnpm -s lint` | Pass, exit 0 |
| `pnpm -s check:initial-migration-writers` | Pass, 168 registrations checked |
| `pnpm catalog:pin` | Pass; `sha256:6607d068facda14d40eddebe4e916952e8c668997ecadde9dbdc550e946f5518` |
| `catalog:curate` | Exit 0; 3,728 new drafts, no missing bindings, 770 unresolved mechanics; coverage remains failed |
| Default `catalog:preview` | Expected gate exit 1; 0 admitted, 23,184 held, 4,834 failures |
| Draft-assisted `catalog:preview` | Expected gate exit 1; 0 admitted, 23,184 held, 1,876 failures |
| Focused notice tests | 5 passed |
| `pnpm test tests/catalog` | 17 files, 293 tests passed; 23.20 seconds |
| Full `pnpm test` | Final run: 490 files and 6,174 tests passed, exit 0, 153.58 seconds. Initial scratch-scope failure and diagnosis recorded below. |
| `git diff --check` | Pass |

Both previews verify the required commits and extract 23,037 entries plus 538 resources. Holds comprise 23,152 missing Attribution Assessments and the existing 32 known notice/evidence holds. There are no dependent omissions or retained exceptions, and no required or outstanding notice is inferred from held-only content. Default failures comprise 715 unaccounted inventory records, 391 broken references and 3,728 missing curation records. Supplying drafts removes the missing records but leaves 770 unresolved mechanics, alongside the same 1,106 inventory/reference failures. Those corpus-wide gaps remain outside this batch; no draft is promoted to a reviewed content assessment.

The draft-assisted run uses the final portable Registry provenance. Its admission-report SHA-256 is `2d748bd26dc20bb3b4d7f3f34ff6708be3e5bfaccebe1c8e5c833127ffa5b483`; reviewed-input fingerprint `00a8411158e5f37640b475012318541aa049141861e7e6d02c202fc0dcecb597`; extraction fingerprint `846834bb6207eb232805bc00e928d4381f4ee881713e9d5bb7bbc17874093079`; legal-resource fingerprint `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e`. The default preview preceded the portability-only provenance edit; its dispositions are reported above, while the final draft-assisted run supplies the durable input fingerprint.

The first full-suite run finished with 489 files passed, 1 failed; 6,171 tests passed, 3 failed; 212.88 seconds. Its failures were the three mocked publishing cases in `e2e/support/nightly-triage.test.ts`. A focused rerun reproduced three failures and two passes. A minimal extensionless mock, invoked both through Node and its shebang, confirmed `ReferenceError: require is not defined in ES module scope`: worktree-local temporary files inherited the repository's `"type": "module"`. Adding the scratch-only `package.json` shown above restored the neutral CommonJS temporary-directory scope; both probes and all five nightly-triage tests then passed (1.39 seconds). No tracked test or application code was changed. The final foreground full-suite summary was:

```text
Test Files  490 passed (490)
     Tests  6174 passed (6174)
  Start at  10:04:56
  Duration  153.58s
```

Times in that Vitest output are local (Europe/Stockholm). The run exited 0.

## Phase timing and handoff

Approximate elapsed phase windows on 2026-10-07 (UTC; parallel work overlaps): briefing/policy/source review 07:51–07:55, four minutes; Registry/evidence/test implementation 07:54–07:58, four minutes; operator commands, verification and scratch diagnosis 07:53–08:08, fifteen minutes; report writing and final audit 07:56–08:10, fourteen minutes. Overall elapsed time was about nineteen minutes; phase windows are not additive.

Only the Registry, batch evidence, focused test and this report changed. The scratch directory, including generated drafts, preview outputs, logs and the temporary package boundary, was removed after recording results. No commits, pushes, issues, PRs, environment files, private E2E material or upstream source changes were made.

## Workflow observations

- The Registry schema has reviewer information only in free-text provenance; the structured batch inventory makes that review auditable without a product-code change.
- A reviewed line and a complete book notice chain are distinct evidence. Preserve that distinction when scaling batches, especially before adding product-code aliases.
- The operator runbook examples use `/tmp`; this pilot instead uses worktree-local scratch and sets `TMPDIR` for tests and commands.
- Worktree-local scratch also needs an explicit CommonJS package boundary for extensionless CommonJS test executables. Bake this into the pilot harness before scaling; otherwise the location restriction causes three unrelated full-suite failures.
- #257 still reports `OPEN`, although its required gate implementation is present in landed commits `12bfbfff` and `51fe56ff` and is the tooling the pilot brief explicitly asks to exercise. Reconcile tracker state before using it to schedule subsequent batches.
- The brief supplies no answer-file path. A worktree-local answer file is used unless the orchestrator supplies one. Requested Opus/Fable model names are unavailable in this environment; implementation delegation uses the available inherited model.
