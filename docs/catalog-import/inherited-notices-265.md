# Inherited notice review: #265

Reviewed 2026-10-07 by **Sol (AI curator) for the owner**. This batch reviews the fifteen immutable notice blocks in [#265](https://github.com/AndreasUnunger/EverythingPath/issues/265), following [#264](inherited-notices-264.md). It establishes inherited notice evidence; it does not establish content attribution, printed-book verification or a new legal-sufficiency conclusion.

## Evidence and disposition

All fifteen keys match SHA-256 of complete physical UTF-8 lines 53–67 of the pinned content `OGL.txt`, excluding line endings without trimming or normalization. None is a heading or wrapped fragment; no joining is needed. Every date, author spelling, punctuation mark and space is retained verbatim. Copyright dates remain distinct from the review date. No aliases are approved.

- Content: `pf1-content`, `11.4.0`, commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`, [OGL.txt lines 53–67](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d/OGL.txt#L53-67), complete-file SHA-256 `10bcdc68296b48cc250f38e49de09c9a73645163d7ac7f76e77346a755c35cdc`.
- System: `foundryvtt-pathfinder1`, `v11.11`, commit `418761d2e16a6037c0156bb4a241f7cea5a2986d`, [OGL.txt](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/OGL.txt), complete-file SHA-256 `0464e2f13f24c742dc3c2a4c788aab9ab24ca9809873192551b77f784a50d7f9`. Its three notices supply no matching block or alias in this batch.

The [batch evidence inventory](../../scripts/catalog/legal/inherited-notices-265.json) records every full key, line, hash, comparison and named hold. The [Section 15 Registry](../../src/lib/catalog/data/section15-registry.json) records the exact notice text, `checkedAgainst: "pf1-content"`, review status/date, immutable provenance and reviewer. The schema has no structured reviewer field, so provenance and the batch inventory record it.

All table entries have disposition **reviewed canonical inherited block; complete-book-chain coverage held**. The identifiers below are unique hash prefixes; the inventory supplies their complete `pf1-content/notice/<hash>` keys.

| Key prefix | Line | Notice |
| --- | --- | --- |
| `5a7b36cc` | 53 | Book of the Damned, 2017 |
| `6fc2a287` | 54 | Classic Monsters Revisited, 2008 |
| `cfc1d7d6` | 55 | Condition Cards, 2010 |
| `8dd5fab6` | 56 | Core Rulebook, 2010; additional variant-comparison hold |
| `8bbfec2e` | 57 | Council of Thieves Player’s Guide, 2009 |
| `8a7d07a7` | 58 | Ceustodaemon, Tome of Horrors Revised, 2002 |
| `843ca0ce` | 59 | Derghodaemon, Tome of Horrors Complete, 2011 |
| `0083e646` | 60 | Derghodaemon, Tome of Horrors Revised, 2002 |
| `2277fb25` | 61 | Guardian, Tome of Horrors Complete, 2011 |
| `2fa07d77` | 62 | Hydrodaemon, Tome of Horrors Complete, 2011 |
| `b95196e9` | 63 | Hydrodaemon, Tome of Horrors Revised, 2002 |
| `efc61320` | 64 | Oinodaemon, Tome of Horrors Revised, 2002 |
| `f88d3b7c` | 65 | Piscodaemon, Tome of Horrors Complete, 2011 |
| `650717f9` | 66 | Piscodaemon, Tome of Horrors Revised, 2002 |
| `4f477214` | 67 | The Oinodaemon, Tome of Horrors Complete, 2011 |

## Discrepancies and holds

[Decision #224](https://github.com/AndreasUnunger/EverythingPath/issues/224#issuecomment-5939689134) identifies permitted compilations and known defects. [Decision #227](https://github.com/AndreasUnunger/EverythingPath/issues/227#issuecomment-5948780647) permits compilation review and requires permanent notice retention. Its [owner transcriptions](https://github.com/AndreasUnunger/EverythingPath/issues/227#issuecomment-5948776405) remain unreviewed until PDF comparison. [Decision #241](https://github.com/AndreasUnunger/EverythingPath/issues/241#issuecomment-5955002698) supersedes the one-off attribution policy with content-bound assessment and notice requirements on every release. [PRD decision 17 and its acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461) retain these boundaries.

The compilation identifies individual lines without delineating each book’s complete inherited chain. Fifteen named `notice-265-complete-chain-<hash>` holds therefore preserve that uncertainty. The ten daemon excerpts neither establish complete Tome of Horrors book chains nor identify every Paizo book that inherits them. A future content comparison must establish every required notice and proposed book/product-code binding; these individual records supply no such aliases.

`notice-265-core-rulebook-variant-comparison` records a concrete internal discrepancy: line 56 says `Core Rulebook. © 2010` and `Jason Buhlman`; [line 415](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d/OGL.txt#L415) says `Pathfinder RPG Core Rulebook. Copyright 2009` and `Jason Bulmahn`. The latter has SHA-256 `415f9be2652d77f942364bdd6762f1e24409b59d93c97f31b21a1c07f8ab0f86` and matches the existing `CRB` record with alias `PZO1110`. Both literal variants are retained; the existing record and binding remain unchanged. The available evidence cannot settle a printed correction or equivalence between those variants. No admitted assessment is rebound to the new variant.

Condition Cards retains its two double spaces. Revised 2002 and Complete 2011 daemon notices remain distinct. Exactly three Complete lines (59, 62 and 65) match lines in the unreviewed owner Bestiary 6 transcription. Line 61’s `Guardian` differs from the owner’s `Ceustodaemon (Guardian Daemon)`; neither is an approved alias of the other. These comparisons do not promote the owner seed or establish printed verification.

Existing Dynamite, Thornkeep, Refuge of Time, Horror Realms and Shattered Star #4 holds remain, as do Ultimate Combat/Occult Mysteries correction requirements, free-PDF gaps and owner PDF checks. No prior-use inventory was supplied; this batch asserts or clears no actual retained exception. Both upstream blocks, every permanent notice version, all seventeen existing Registry records, Attribution Assessments and attribution evidence remain unchanged.

## Verification

Commands use the pinned read-only source checkouts. Temporary files and process temporary directories are confined to ignored `.scratch/curation-265/`. Its CommonJS package boundary avoids the extensionless mock-executable failure diagnosed in #264. Notice keys are not Catalog Entry candidate keys, so the operator runs use the full corpus rather than `--candidates`.

```sh
mkdir -p .scratch/curation-265/tmp
export TMPDIR="$PWD/.scratch/curation-265/tmp"
printf '{"type":"commonjs"}\n' > "$TMPDIR/package.json"
PF1_CURATION_SYSTEM=/home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1
PF1_CURATION_CONTENT=/home/andreas/repos/everythingpath/sources/pf1-content
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-265/drafts
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-265/preview
pnpm catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --curation .scratch/curation-265/drafts/records.json --out .scratch/curation-265/preview-drafts
pnpm test tests/catalog/inherited-notices-264.test.ts tests/catalog/inherited-notices-265.test.ts
pnpm test tests/catalog
pnpm test
git diff --check
```

The [nine focused tests](../../tests/catalog/inherited-notices-265.test.ts) bind all fifteen records to committed upstream bytes/hashes; check legal-page generation and permanent retention; require a separate content assessment; hold missing/unreviewed notices; reopen changed notice bindings; and preserve distinct editions, owner seed status, both Core Rulebook variants and Condition Cards spacing. Successful admission uses explicitly synthetic evidence, which is not committed as a shipping assessment. Both batch suites passed: fourteen tests in two files.

An independent comparison against the pinned checkout confirmed every key, line and notice byte and all seventeen unchanged existing Registry records. Direct `buildLegalPageData` invocation with the fifteen reviewed keys produced four legal sections, fifteen Registry notices plus both upstream blocks and the project line (eighteen notices), and no outstanding notice or resource. This explicit builder demonstration does not add held-only requirements to a release.

The foreground full-suite command exited 0 with this final test summary (times are local, Europe/Stockholm):

```text
Test Files  495 passed (495)
     Tests  6232 passed (6232)
  Start at  13:06:38
  Duration  196.87s
```

The initial catalog-only run overlapped the full suite, corpus extraction and typecheck. Two CLI tests exceeded their 5,000 ms timeout: `preview.test.ts`’s default-output/prior-report case and `release-operator.test.ts`’s deterministic build/prepare/inspect case. Its summary was 17 files passed, 2 failed; 321 tests passed, 2 failed; 64.23 seconds. Both cases passed in the full-suite run. No timeout or product-code change was made.

The separate catalog rerun passed all nineteen files and 323 tests in 21.90 seconds, exit 0. The contrast with the overlapping run is consistent with process load causing the two timeouts; no behavioral assertion failed.

| Check | Result |
| --- | --- |
| `pnpm -s typecheck` | Pass, exit 0; repeated after the focused test was added |
| `pnpm -s lint` | Pass, exit 0; repeated against final Registry/evidence/test changes |
| `pnpm -s check:initial-migration-writers` | Pass, exit 0; 168 registrations checked |
| `pnpm catalog:pin` | Pass; `sha256:6607d068facda14d40eddebe4e916952e8c668997ecadde9dbdc550e946f5518` |
| `catalog:curate` | Exit 0; 3,771 records, 3,684 new drafts, 44 required checked records, no missing bindings, 770 unresolved mechanics; coverage remains failed |
| Default `catalog:preview` | Expected gate exit 1; 0 admitted, 23,184 held, 4,790 failures |
| Draft-assisted `catalog:preview` | Expected gate exit 1; 0 admitted, 23,184 held, 1,876 failures |
| Both focused batch suites | Pass; 14 tests in 2 files |
| `pnpm test tests/catalog` | Final run passes; 19 files, 323 tests, exit 0 |
| Full `pnpm test` | Pass; 495 files, 6,232 tests, exit 0; 196.87 seconds |
| `git diff --check` | Pass |

The default preview verifies both required commits and extracts 23,037 entries plus 538 resources. Holds comprise 23,099 missing Attribution Assessments, the existing 32 known notice/evidence holds, and 53 existing #328 content-assessment holds. Failures comprise 715 unaccounted inventory records, 391 broken references and 3,684 missing curation records. No dependent omission or retained exception is reported. No required or outstanding notice is inferred from held-only content. These corpus-wide gaps remain outside this notice batch; the reviewed Registry lines do not create admission evidence.

Default admission-report SHA-256: `38ac734c0e4e9219313c5331dd840e92ea0a1b87bfa0996f852b2e32fb473dc8`.

Reviewed-input fingerprint: `ec5a80c55f4fac16bca5ea3c917b96f2927533ae4b358f0e4a5057d947341162`. Legal-resource fingerprint: `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e`. Default extraction fingerprint: `7f9ac28a10e3f579b07a97b0a3cc67f89053b8a376fe60edb921973cd55bae0c`. The unchanged legal fingerprint is consistent with the independent byte comparison confirming all five designated legal/attribution inputs remain equal to `HEAD`.

The final draft-assisted preview preserves the same holds and verified pins, with no dependent omissions, retained exceptions or outstanding notice/resource requirements. Supplying drafts removes the 3,684 missing-binding failures, leaving 770 unresolved mechanics plus the same 1,106 inventory/reference failures. The drafts are not promoted to reviewed content assessments. Admission-report SHA-256: `a6f490e20f37deae9a5db47a49f696e16905eb6b5429adcc400ef8cd04f24722`; extraction fingerprint: `4e185d19963fb660d5143d7cb140b5b0483c00d15210909913f66aaf8f0a52e9`. Its reviewed-input and legal-resource fingerprints equal the default run’s values above.

## Phase timing and handoff

Approximate elapsed windows on 2026-10-07 (UTC; parallel work overlaps): briefing/policy/source review 11:02–11:06, four minutes; Registry/evidence/test implementation 11:03–11:06, three minutes; operator commands and verification 11:03–11:14, eleven minutes; report writing and final audit 11:07–11:15, eight minutes. Overall elapsed time was about thirteen minutes; these phase windows are not additive.

Only the Registry, batch evidence, focused test and this report changed. The ignored `.scratch/curation-265/` directory, including generated drafts, preview outputs, logs and process temporary files, was removed after recording results. Changes remain uncommitted for the orchestrator. No product-code fix, deployment, release activation, commit, push, issue/PR write, environment-file access, private E2E access or upstream modification was performed. The final answer uses the launcher’s `-o` output routing; no answer file is written into the repository.

## Workflow observations

- The Registry schema records reviewer information only in free-text provenance; the structured batch inventory supplies an auditable reviewer/date without changing product code.
- Line review, complete-book-chain evidence and content attribution are separate. Internal compilation variants such as Core Rulebook need named comparison holds, and Revised/Complete or Guardian/Ceustodaemon notices must not be merged by name.
- Reuse #264’s worktree-local `TMPDIR` and CommonJS package boundary in the pilot harness. Run catalog and full-suite tests separately to avoid unnecessary competition around five-second CLI test budgets.
- #257 still reports `OPEN` when checked on 2026-10-07, although its gate implementation is landed and the pilot brief explicitly directs its use. Reconcile tracker state before scheduling by dependency status.
- The repository requests Opus/Fable subagents, but those model identifiers are unavailable in this runner. The implementation subagent used the available inherited model; no UI work was required.
