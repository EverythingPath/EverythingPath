# Test suite health

This records the equality-index harness fix (2026-10-11), slow catalog CLI tests (2026-10-07), slow Convex integration tests (#717, 2026-10-06/07) and two slow tests fixed on 2026-10-03.

## Repeated equality queries in convex-test (#534, 2026-10-11)

The unchanged #530 public legal readback test timed out in the catalog gate at 15,000 ms. The isolated diagnostic reproduction failed at 15,101 ms and passed at 14,773 ms; those timing-sensitive results and both failed queues remain evidence. Profiling found repeated equality-index queries scanning the staged table during release installation. The predicted 12,039,692 document visits were derived from the batch lengths, not counted by instrumentation. This does not establish a #534-specific causal regression or deployed Convex performance.

The existing `convex-test@0.0.50` patch now builds buckets for a declared index when a query supplies every declared field as a string equality. A table/index snapshot belongs to one instance's current transaction view. Every affected-table write invalidates it, and transaction start, commit and rollback clear all snapshots, including nested transitions. There is at most one bucket map per declared index in a transaction; maps hold document references and string tuple keys and are released at the transaction boundary. Alternating writes and queries still rebuild the snapshot. System indexes, partial equality, ranges and non-string or missing query keys use the scan path. Non-string or missing document fields cannot match a full string tuple.

Index validation runs before candidate selection. The original range comparisons, filters, sorting, creation-time/ID ties, limits, pagination and duplicate errors still decide the result. Existing validator, table-ID and document-cache improvements remain. Read budgets retain the emulator's existing semantics: query streams count returned documents/bytes and each index-range operation; pagination's row/byte splitting still counts candidates before operator filtering. Neither path charges snapshot enumeration as database reads. These checks preserve the emulator's behavior and do not certify production read-cost accounting.

Seven additional tests in `convex/convexTestHarness.test.ts` exercise player-authored campaign notes at the equality-query seam. They cover repeated hits/misses, release/kind/tuple boundaries, duplicate uniqueness errors, inserts, patches, key moves, replacement/deletion, independent returned copies, nested rollback/commit, outer abort and separate instances. They also cover nested field paths, unsupported query shapes, index errors, filters, limits, ordering/ties, pagination boundaries/splitting and transaction budgets. All fourteen harness tests pass against both the prior scan patch and the candidate. An observation transform retaining every assertion captured identical public results/errors (15,885 bytes, SHA-256 `1b8ff5f0cbd79d7c7e19857ef28335cb358666b44d86b050664aafc672e286cf`). These are parity tests that already passed on the baseline; the original timeout remains the regression loop.

| Measurement                                         |                             Scan baseline |                       Candidate |
| --------------------------------------------------- | ----------------------------------------: | ------------------------------: |
| Exact original case, diagnostic uninstrumented runs |        15,101 ms failed; 14,773 ms passed | 3,410 / 3,494 / 3,592 ms passed |
| #530 case with full 529/530/534 files, three runs   |      Diagnostic group failed at 15,493 ms | 4,342 / 4,333 / 4,336 ms passed |
| Measured 51-batch installation, same full path      | 11,463 ms (earlier diagnostic: 12,555 ms) |                        1,109 ms |

No construction moved into hooks. All 4,957 report/legal rows, ordered batches, descriptors, manifest commitments and assertions remain. The serialized artifact is 10,790,148 bytes with SHA-256 `9951a25b54f904d16819b4acd82a6140acbe59e4bf2669b974682b915168af64` on both patches. Registry, resources, complete public legal input and legal-page fingerprints match. The candidate manifest matches the durable diagnostic manifest, including artifact fingerprint `d68192a6d8fb5173d09ff2096e364ad339f4ddeafbaf56c428f18c617639e189`.

Checks run sequentially in the inherited bounded service with `CI=true`, three Vitest workers, CPU 400%, 12 GiB hard/8 GiB soft memory, no swap and 1,024 tasks. The second group recorded 1,466 memory-high events; no hard-limit or OOM event occurred. Raw logs retain that pressure and all setup failures: the default read-only pnpm store rejected patch-commit, then an owned-store copy missing executable modes stopped esbuild before tests loaded. Both were corrected through pnpm's offline patch/install process, with executable modes restored only in owned scratch. No installed library or shared hardlink was edited directly. The diagnostic configuration retains repository settings and reporters while disabling result caching and keeping Vite cache in inherited TMPDIR; scheduling is therefore a measurement limitation.

The fix1 audit found all 398 prepared curation files byte-identical; that whole-398 result is historical. Exact parser inputs (121 source files), runtime compatibility and all 76 calculation files match before/after; calculation identity remains `sha256:d7a42ca346d875f9497c7da94325022ac289d7931226a3649979a13f410c8063`. The lock changes only the test patch's three hash references. Production rules, release construction, authorization, fixtures, held status and timeouts are unchanged. The original author archive and its 18,298 source/local comparisons and 4,231 old bindings remain scoped to those unchanged inputs; this fix does not repeat source verification.

The fourteen harness tests and targeted release/Registry/backend tests passed (55 tests combined), as did typecheck, standard lint, the writer check (183 registrations), pin, canonical formatting and notice dependencies (zero gaps, 36 advisories). The raw catalog check finished with 2,287 passed and six failed tests across 119 files, with no timeout. Four failures in unchanged #533/#534 preservation tests require the old lock SHA-256 `09bf6825e1941c12785577f3b2de28dfea3534982ddc0bd691467b51a349be3a`; pnpm's necessary patch resolution produces `038937d1fb4d8816827455bcf6d5cced55b1520a14a071c2c15f9a1cb98e6836`. These assertions and their frozen commitments were left unchanged. The other failures report a refused nested Git subprocess (`spawnSync git EPERM`) and a CLI subprocess returning no expected stderr; their wider causation is unestablished. The catalog run added 1,228 memory-high events, with no hard-limit or OOM event. No failure was silently retried or waived.

The fix1 supplement retains raw logs, helper versions, full artifact/public data and preservation proofs under `ep-orch/research/curation-534-test-harness-fix1-20261011/`. At that stage, the lock-preservation conflict still prevented a passing catalog gate; the fix2 follow-up below resolves it. The canonical full application gate remains required.

## Frozen dependency preservation follow-up (#534 fix2, 2026-10-11)

#749 retired the whole-file freezes (see [Preservation checks](catalog-import/curation.md#preservation-checks)), so no catalog test hashes the lockfile any more; the lock-reversal helper and its test described below were removed with them.

The original lock commitment remains `09bf6825e1941c12785577f3b2de28dfea3534982ddc0bd691467b51a349be3a`. The shared test helper returns those exact original bytes unchanged, or validates the approved source patch SHA `e88f3e67c283c5759063f96d4f526a1bd456fa36e5c6dcea6efd1c7c96afc289` and reverses only three reviewed references to `b846b30bccf7e622fa4a035ae2479e0c60ba8ed4cf08fbbc78faaa7e7cb5b165`: the patchedDependencies entry with its exact path, root devDependency resolution, and matching snapshots key. Fixed byte offsets and literal surrounding bytes constrain each location; missing, extra, unknown and inconsistent references are rejected. Buffers preserve all other bytes without YAML serialization or subprocesses. The helper is deliberately limited to this single reviewed transition: **callers must still assert the original whole-lock SHA**, which rejects unrelated versions, integrity, flags, paths, whitespace and arbitrary byte changes even when the three references are valid.

Only the lock-read branches in `spells-533.test.ts` and `spells-534.test.ts` use that helper. Every existing assertion, frozen snapshot, scope and timeout remains. The current preservation claim is 397 unchanged original prepared files, one scoped prepared test edit (#534), and one separately scoped historical test edit (#533). The previous whole-398 audit is historical. Original data and fix1's patch, lock, harness, parity and public artifact evidence retain their exact bytes; no fresh source verification is claimed.

The focused five-file run passed all 15 helper cases and 59 tests overall, but failed four: data-merge repeated nested Git `EPERM`, release-operator timed out, and each Spell file's independent historical-byte test timed out at the original 15-second budget. Both complete Spell files ran; their other original preservation assertions passed. The prior empty CLI stderr was not reached in this focused run, and sandbox causation remains unestablished. The harness passed all 14 cases. Raw failures, the unsupported initial Vitest option, resource pressure and all subsequent checks are retained in the fix2 supplement; no timeout changes, exclusions or targeted retries are authorized. Typecheck, standard lint, writer check, pin, canonical formatting and notice dependencies passed (zero gaps, 36 advisories). The subsequent single full raw catalog run reported **2,304 passed, four failed, 120 files**: nested Git `EPERM`, empty CLI stderr, and unchanged-budget timeouts in conditions and preview. Both whole Spell files and all 15 helper cases passed there; the earlier focused failures remain recorded. Peak cgroup memory was 8,904,122,368 bytes with 38,318 cumulative memory-high events, no hard-limit/OOM event, and unchanged caps. The canonical full application gate remains Root's responsibility after fresh review.

## Slow catalog CLI tests (2026-10-07)

Three catalog CLI tests timed out under load on the feature head. The first also timed out when run alone, at a machine load of about 26 on 16 CPUs:

- `release-operator.test.ts` › the CLI builds a deterministic gated artifact… It took 2.0–2.2 s alone in early October. It builds a release artifact three times from the real reviewed catalog data.
- `release-operator.test.ts` › gate failures write no release artifact… This test takes about 0.25 s alone, before and after the fix. When the test before it times out, Vitest does not stop that test's work, including a blocking `spawnSync`, and it runs on into this one. Fixing the first test removes the cause.
- `preview.test.ts` › uses the default output directory and preserves prior reports when a later import fails. It ran the preview CLI four times, each in a new `node --import tsx` process.

No timeout was raised.

### Release builds: quadratic batching

Most of the build time went to splitting rows into batches. `buildCatalogRelease` in `scripts/catalog/release.ts` re-encoded the whole batch, plus the next row, to canonical JSON for every row. That cost grows with the square of the rows per batch, so the test slowed down as curation batches added rows. A CPU profile of three in-process builds put 2.5 of 3.5 s in `releaseByteCount` called from that loop.

A batch serializes as `[row,row,…]`, so the loop now adds each row's own byte count and one comma. A build of the real data has the same rows, the same batch splits (95, 100, 100 and 25 rows) and the same byte counts as before. Only the `parsers` input fingerprint differs, because `release.ts` is part of the importer source it hashes. A new test in `tests/catalog/release.test.ts` pins the exact byte-limit and row-limit boundaries. One in-process build fell from about 1,130 ms to about 350 ms. Real release builds get the same speed-up.

### Preview: process start-up

Reading the real reviewed data costs only about 70 ms of each preview process, so this test's cost does not come from catalog growth. Each process spent about 380 ms starting Node and tsx and loading modules, then about 220 ms on the preview itself (at load 25).

The preview command now lives in `scripts/catalog/preview.ts` as `runCatalogPreviewCommand`, which returns the exit status, stdout and stderr. `scripts/catalog-preview.ts` only writes them out, so the CLI's output and exit codes are unchanged. The test still runs the CLI once as a process, which covers the entry point and the default output folder. Its other three runs call the command in-process, and every assertion is unchanged. The other preview tests still use one process per run.

### Before and after

Each figure is the test's `duration` from Vitest's JSON report, in ms. Each file was run alone three times with `flock ep-orch/heavy.lock` and `--testTimeout=60000`, so a slow run still reports its duration. The before and after runs were back to back at load 6–7; the before runs used the original files.

| Test                                                  | Before runs           | Before median | After runs            | After median |
| ----------------------------------------------------- | --------------------- | ------------: | --------------------- | -----------: |
| `release-operator` › the CLI builds a deterministic…  | 2,871 / 2,793 / 2,795 |         2,795 | 1,246 / 1,239 / 1,245 |        1,245 |
| `release-operator` › gate failures write no artifact… | 236 / 236 / 250       |           236 | 237 / 263 / 239       |          239 |
| `release-operator` › sends large batches over HTTP…   | 810 / 798 / 815       |           810 | 285 / 301 / 300       |          300 |
| `preview` › uses the default output directory…        | 1,664 / 1,683 / 1,756 |         1,683 | 776 / 777 / 801       |          777 |

Under heavier load, the first test, run alone, took 6,063 / 5,189 / 4,426 ms before (median 5,189, load 26) and 1,982 / 1,347 / 1,337 ms after (median 1,347, load 18).

In a full `pnpm test` run after the change, all 517 files passed. Load rose to 38 during that run. The three tests above that had timed out took 3,555, 1,036 and 2,620 ms. The first one is still on the duration budget list at 71% of its timeout. Most of its remaining time is three builds of about 0.3 s each, plus the one CLI process.

The other catalog CLI tests that start processes run 0.6–2.4 s alone at load 6–7. All of them are well within their timeouts: `curation-command.test.ts` has explicit 20,000 and 60,000 ms timeouts, and `data-files.test.ts` › check and the format command… has 30,000 ms. That data-files test copies and formats the real data files, so its cost grows with the catalog. It takes 851 ms alone (840 / 860 / 851). These timeouts predate this work and were left unchanged.

## Slow Convex integration tests (#717)

Fourteen Convex integration tests timed out under full-suite load on the feature head (`ep-orch/logs/ep-impl-583-full.log`). Each one passed when run alone, but took 2.6–4.2 s even then. They now take 0.5–1.2 s alone, and three full runs at default concurrency had no timeouts.

Most of the time was not spent in our code. It went to `convex-test`, the in-memory mock backend: union validation, table scans and per-read serialization. The rest went to module loading in the first test of a file, and to move planning, which repeated work it could have done once. The read and write counts that carry over to production are unchanged.

Global timeouts are unchanged: 5,000 ms locally and 15,000 ms in CI. No per-file timeout was raised.

### Method

- **Isolated duration.** Each test was run alone three times, serialized with `flock ep-orch/heavy.lock`. The figure is the median of the test's `duration` in Vitest's JSON report. [`test-suite-health-717.json`](test-suite-health-717.json) lists the fourteen tests with every run's duration and the full-suite results. This reproduces the isolated column from the repository root, writing reports to a git-ignored folder:

  ```bash
  out=.scratch/717/isolated
  mkdir -p "$out"
  node -e 'require("./docs/test-suite-health-717.json").tests.forEach((t, i) => console.log(`${i + 1}\t${t.file}\t${t.name}`))' |
    while IFS=$'\t' read -r i file name; do
      pattern=$(printf '%s' "$name" | sed 's/[][\\.*^$?+(){}|]/\\&/g')
      for run in 1 2 3; do
        flock /home/andreas/repos/everythingpath/ep-orch/heavy.lock pnpm test "$file" \
          --testNamePattern="(^| )$pattern\$" --reporter=json \
          --outputFile="$out/test-$i-run-$run.json" > /dev/null 2>&1
      done
    done
  node -e '
    const fs = require("fs"), dir = process.argv[1];
    require("./docs/test-suite-health-717.json").tests.forEach(({ name }, i) => {
      const runs = [1, 2, 3].map((run) => JSON.parse(fs.readFileSync(`${dir}/test-${i + 1}-run-${run}.json`))
        .testResults.flatMap((f) => f.assertionResults).find((t) => t.title === name && t.status === "passed").duration);
      console.log(i + 1, runs.map(Math.round).join("/"), "median", Math.round(runs.sort((a, b) => a - b)[1]));
    });' "$out"
  ```

  The before column came from the same loop on the feature head, `3e1a99e2`.

- **Full suite.** `pnpm test --reporter=default --reporter=./tests/duration-budget-reporter.ts --reporter=json --outputFile.json=<report.json>`, serialized with the same lock.
- **Per-function work.** A temporary setup file wrapped each `convex-test` call (`t.query`, `t.mutation`, `t.action`, `t.run` and the scheduled-function drains). It timed each call and counted `TransactionMetricsTracker` reads and writes per transaction. The counts are the same documents read and written that Convex limits per transaction. Each file was run whole, so the first test in a file also includes module loading.
- **CPU.** CPU profiles came from a forks pool with `--cpu-prof`, cut to the test body.

The instrumentation has been removed. The committed numbers are in `test-suite-health-717.json`; the raw reports stay in the worktree's git-ignored `.scratch/717/evidence/`.

### Before and after

The isolated columns are medians of three runs alone, in ms; the after column is from the final code. The full-suite columns are from the three runs at default concurrency: two after the first round and one after the review fixes. On head, all fourteen timed out at 5,000 ms under full-suite load.

|   # | Test                                                                                            | Isolated before | Isolated after | Full suite after (runs 1, 2, 3) |
| --: | ----------------------------------------------------------------------------------------------- | --------------: | -------------: | ------------------------------: |
|   1 | `catalogReleaseActivationMilitia` › Character departure during preparation…                     |           3,321 |          1,029 |           2,651 / 2,712 / 2,625 |
|   2 | `catalogReleaseActivationMilitia` › Character departure after activation…                       |           2,616 |            710 |           1,250 / 1,267 / 1,342 |
|   3 | `characterMoveSpells` › source and global catalogs with more unrelated non-Spell definitions…   |           3,977 |          1,194 |           2,719 / 2,481 / 2,842 |
|   4 | `characterMoveSpells` › deleting a campaign +0 Spell while 'ready'…                             |           2,779 |            985 |           2,386 / 2,111 / 2,136 |
|   5 | `characterMoveWarnings` › a campaign move preserves accepted off-list and known-count warnings… |           3,985 |            736 |           2,038 / 1,832 / 2,075 |
|   6 | `characterMoveWarnings` › public Spell list membership edits prune changed warnings…            |           4,063 |            912 |           1,945 / 1,725 / 1,637 |
|   7 | `characterMoves` › preparation remains private and completion keeps identity…                   |           3,786 |            837 |           1,728 / 1,579 / 1,939 |
|   8 | `characterMoves` › a homebrew dependency is copied only at publication…                         |           3,844 |            832 |           1,596 / 1,610 / 1,773 |
|   9 | `characterMoves` › global future Grants retain the source preference…                           |           3,836 |            846 |           1,633 / 1,655 / 1,667 |
|  10 | `characterMoves` › saving a carried definition keeps its identity…                              |           4,135 |            842 |           1,425 / 1,421 / 1,609 |
|  11 | `characterMoves` › a familiar keeps its base creature…                                          |           4,179 |            952 |           2,803 / 1,783 / 2,149 |
|  12 | `characterSheetFamiliars` › witch collection remains unchanged…                                 |           3,443 |            612 |           1,093 / 1,093 / 1,105 |
|  13 | `characterSheetUnchainedEidolon` › a demon at summoner levels 4, 8 and 12…                      |           3,322 |            590 |           1,189 / 1,277 / 1,223 |
|  14 | `privateCharacters` › only the owner can delete a private sheet…                                |           3,566 |            537 |               1,104 / 966 / 989 |

The isolated median after each step of the first round, in ms. Each step includes the ones before it.

|   # | Before | Unions and scans | Validators once, keyed index | Modules loaded first | Remap skip, document cache |
| --: | -----: | ---------------: | ---------------------------: | -------------------: | -------------------------: |
|   1 |  3,321 |            2,046 |                        1,952 |                1,324 |                      1,043 |
|   3 |  3,977 |            2,167 |                        1,810 |                1,818 |                      1,201 |
|   5 |  3,985 |            2,343 |                        2,043 |                  979 |                        741 |
|  11 |  4,179 |            2,423 |                        2,122 |                1,246 |                        943 |
|  14 |  3,566 |            1,425 |                        1,114 |                  589 |                        546 |

### Setup and the function under test

Setup is the fixture-building calls: `t.run`, Character creation, Class Level, score, Selection, Spell and accepted-warning edits, and companion links. Everything else counts as under test: the operation the test names, its reads and its scheduled work. Time outside Convex calls was 5–40 ms in every test. Figures are in ms, from whole-file profile runs.

|   # | Setup before | Under test before | Setup after | Under test after |
| --: | -----------: | ----------------: | ----------: | ---------------: |
|   1 |          764 |             2,505 |         181 |              808 |
|   2 |          489 |             1,289 |         104 |              402 |
|   3 |          440 |             3,518 |          78 |            1,083 |
|   4 |          243 |             2,463 |          47 |              878 |
|   5 |        1,223 |             2,815 |         168 |              541 |
|   6 |          298 |             2,503 |         102 |              644 |
|   7 |          229 |             2,517 |          50 |              671 |
|   8 |          237 |             2,435 |          47 |              634 |
|   9 |          252 |             2,520 |          55 |              655 |
|  10 |          243 |             2,661 |          48 |              606 |
|  11 |          525 |             2,601 |         103 |              669 |
|  12 |          872 |             1,843 |         229 |              225 |
|  13 |          733 |             1,770 |         278 |              168 |
|  14 |          740 |             2,183 |         151 |              254 |

The move tests (1–11) spend most of their time in the move itself. The sheet tests (12–14) spend it in sheet reads and Character creation.

### Dominant Convex functions

These are per-call figures across the fourteen tests. Reads and writes are documents per call, with the largest single transaction in brackets. They are the same before and after.

| Function                | Calls | Share of test time before | Reads per call | Writes per call | ms per call before | ms per call after |
| ----------------------- | ----: | ------------------------: | -------------: | --------------: | -----------------: | ----------------: |
| `characterMoves:resume` |   326 |                       40% |  1,082 (2,030) |        35 (515) |                 51 |                18 |
| `characterSheet:read`   |    57 |                       34% |      442 (484) |               0 |                243 |                23 |
| `characterSheet:create` |    19 |                       13% |            378 |             821 |                286 |                50 |
| `characterMoves:start`  |    18 |                        5% |    949 (1,106) |       509 (518) |                107 |                32 |

A staging `resume` reads 479 `characterMoveReference` rows, about 457 `catalogEntry` rows, 48 `spellCatalogSummary` rows, 24 `spellCatalogIndex` rows and about 20 others. Of 1,025–1,032 reads, 1,012–1,016 are distinct documents, so repeated reads are rare. One move of a prepared fixture Character takes a `start` and about 16 `resume` calls. Most of those calls stage the Character's catalog rows, 32 per call. A new private demo Character has 452 of them, 451 of which are browse-only seeds.

### Causes and routes

| Cause                                                                                                                  | Measurement                                                                                                                                                                                                                                                                                                     | Route                                               | Why                                                                        |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------- |
| `convex-test` tries each union member and throws an `Error` for every rejected one. Each throw captures a stack trace. | Union validation took 2,200 ms of the 3,750 ms `privateCharacters` test, and 1,870 ms of the 4,060 ms `characterMoveSpells` test: 650 ms checking read results and 1,220 ms validating inserts. Checking one sheet read's 309 KB result threw 22,486 times and took 170 ms; without stack traces it took 13 ms. | Test-side: patch `convex-test`                      | This is mock-only cost. Production validates in the backend.               |
| `convex-test` lists every document in every table for each query.                                                      | The scan took 510 ms of self time in the `characterMoveSpells` test.                                                                                                                                                                                                                                            | Test-side: patch `convex-test`                      | Same as above.                                                             |
| `convex-test` rebuilds a function's validator JSON on every call.                                                      | After the first fix, it took 250 ms of the 900 ms `privateCharacters` test, mostly the sheet read's large return validator.                                                                                                                                                                                     | Test-side: patch `convex-test`                      | Same as above.                                                             |
| `convex-test` serializes and sizes each document again on every read.                                                  | It took 25–35% of each move test after the fixes above. Test 3 fell from 1,762 to 1,201 ms.                                                                                                                                                                                                                     | Test-side: patch `convex-test`                      | Same as above.                                                             |
| Function modules load on the first call, inside the first test.                                                        | 600–900 ms in an isolated test. Importing `characterMoves` alone took 650 ms.                                                                                                                                                                                                                                   | Test-side: load the called modules before the tests | It is a once-per-file cost, and its timeout now belongs to the hook.       |
| Move planning compares every definition with every keyed list, and it copies each value once per remapping.            | Finding the required definitions took 450 ms of the 2,240 ms `characterMoveSpells` test, 315 ms of it in the keyed scan.                                                                                                                                                                                        | Code                                                | The time is in production move code, and the fix leaves results unchanged. |
| A prepared fixture Character's seeded rows make each move long.                                                        | About 16 `resume` calls of about 1,030 reads per move. Creation writes 821 documents.                                                                                                                                                                                                                           | Neither; see below                                  | It is fixture and demo cost only. The change would be large.               |
| Eight Convex test files ran on `jsdom`.                                                                                | 146 s on `jsdom` against 149 s on `edge-runtime` for those eight files.                                                                                                                                                                                                                                         | Test-side: `edge-runtime`                           | `convex-test` recommends it. It saves no time.                             |
| Sheet calculation, which grew with the resolver, companions, #422 and #414.                                            | 2–5 ms per calculation, at most 130 ms per test.                                                                                                                                                                                                                                                                | None                                                | It was not a significant cost.                                             |

Every Convex test file now declares `// @vitest-environment edge-runtime` on its first line. `characterMoveSpells.integration.test.ts` already had it on line 6, where Vitest still finds it, so it was never on `jsdom`. The eight companion and eidolon files and the two pure `convex/lib` tests were.

No test body changed and no test was split, so every behaviour check remains. The only test-file changes are the environment line and one call, `preloadCalledConvexModules({ modules, testFile: import.meta.url })` from `tests/convex-modules.ts`. It registers a `beforeAll`, with a 30,000 ms hook timeout like the existing Spell data import, that loads every module the file's own source names through `api.<module>`, `internal.<module>` or a `'<module>:<function>'` reference. The list follows the file's calls, so it can't go stale. A module the file reaches only indirectly, such as a scheduled function, still loads on first use, which costs time but never correctness.

### The `convex-test` patch

`patches/convex-test@0.0.50.patch` is applied through `pnpm.patchedDependencies`, like the existing React Query patch. It makes four changes, and none of them changes what is accepted, refused or returned. The patch file's header lists them for the next upgrader:

1. A non-throwing `matchesValidator` picks the union member. A value that matches no member still throws the published message. `matchesValidator` mirrors `validateValidator` case by case, so when upgrading `convex-test`, carry any change to either function into the other. A validator type `matchesValidator` doesn't know falls back to `validateValidator` itself, with a caught throw. Today that only applies to `record`, which neither function checks, so a record inside a union is accepted as the published package accepts it.
2. Committed document IDs are kept per table, in commit order, so a query visits only its own table.
3. A function's argument and return validators are exported once per function.
4. Each stored document's size and JSON form are computed once. Every write stores a new object, so these values never go stale.

`convex/convexTestHarness.test.ts` covers accepted and refused unions with their message, and a record inside a union. It also covers query order across tables with the transaction's own writes and deletes, index ranges in both orders, pagination over an index, and independent copies that follow later writes. For validators, it alternates two light functions with different validators, so each function must be checked by its own on every call. The file runs in about 50 ms. It passes against both the published 0.0.50 and the patched package. Version 0.0.60, the latest, has the same throwing union validation and full scans. If `convex-test` is upgraded, refresh the patch or drop the changes that upstream has made.

With the patch, the eight companion and eidolon files fell from 148.6 s to 27.3 s of test time, and their slowest test from 3.6 s to 0.8 s.

### Production changes

Both changes are in move planning, which is not part of the calculation closure. `pnpm catalog:pin` still prints the current identity. No writer changed, and `pnpm check:initial-migration-writers` passes all 168 registrations.

- **Keyed list members.** `requiredMoveDefinitions` in `convex/lib/characterMovePlan.ts` indexes definitions by the Spell list keys their level maps offer (`listCatalogKeyedListMemberships` in `src/lib/catalog-copy-references.ts`). Before, it scanned every definition for every visited row. Rows are still added in definition order. `isCatalogKeyedListMember` uses the same helper, so the meaning of membership is defined once.
- **Remapping.** `planCharacterMove` skips a remapping whose source ID appears nowhere in a value, as a string or as a key. Such a remapping returned an identical copy. One token set, taken before the remappings, serves them all: every source is a shared definition and every target is the Character's own, so applying one remapping can't make another apply. The planned sheet and copy definitions are always new objects. Before, an unchanged sheet with no remappings came back as the caller's own object.

| Function                  | Reads per call before / after | Writes per call before / after | Effect                                                                                  |
| ------------------------- | ----------------------------: | -----------------------------: | --------------------------------------------------------------------------------------- |
| `characterMoves:resume`   |                 1,082 / 1,082 |                        35 / 35 | 34 → 28 ms per call from the keyed index, measured with the `convex-test` fixes applied |
| `characterMoves:start`    |                     949 / 949 |                      509 / 509 | Same planning                                                                           |
| Remap skip, tests 3 and 4 |                     Unchanged |                      Unchanged | Test 4: 1,502 → 1,358 ms isolated; test 3: 1,818 → 1,762 ms                             |

### Not changed: seeded rows and staging batches

Lazy seeded rows were not built. Only isolated fixture campaigns and private demo Characters receive the representative seeds, and production sheets get none (`docs/pf-character-sheet-data-model.md`). Moves are also limited to fixture campaigns and private demos until activation. Lazy rows would change browsing, picking, moves, releases and the browse-only readers, and that change has no production benefit. The staging limit is also documented behaviour: 32 definitions and about 1 MiB per batch (`docs/character-sheet/catalog-scopes.md`). Either change would roughly halve the remaining move test time, but each one is an owner decision.

### Duration budget

`vitest.setup.ts` records each test's own timeout as `meta.timeout`, and Vitest's JSON reports include it. `tests/duration-budget-reporter.ts` is one of Vitest's default reporters in `vitest.config.ts`, so every local and CI run checks it. When any test took at least half its timeout, the run ends with a short summary: the count, then the ten tests closest to timing out, then how many more there were. A run within budget prints nothing extra. A command-line `--reporter` replaces the configured list, so add `--reporter=./tests/duration-budget-reporter.ts` when passing reporters, for example alongside `--reporter=json`. With the default 5,000 ms timeout, that means 2,500 ms. A test with its own timeout is judged against that timeout. For tooling that already writes a JSON report, the same check is `duration >= meta.timeout / 2` on each assertion result.

### Full suite

| Run                 | Files | Tests | Failed | Timeouts | Wall time | Test time | At least half their timeout |
| ------------------- | ----: | ----: | -----: | -------: | --------: | --------: | --------------------------: |
| Head (#583 landing) |   483 | 6,137 |     14 |       14 |     260 s |   3,142 s |                           — |
| After, run 1        |   485 | 6,144 |      0 |        0 |     149 s |   1,597 s |                          25 |
| After, run 2        |   485 | 6,144 |      0 |        0 |     150 s |   1,600 s |                          22 |
| After fixes, run 3  |   486 | 6,152 |      0 |        0 |     149 s |   1,590 s |                          22 |

All three runs used `pnpm test` at default concurrency on 16 CPUs, with the duration budget and JSON reporters.

### Remaining slow tests

All fourteen listed tests are below 1.5 s alone. Under full-suite load, three of them still use just over half their timeout in some runs: test 1 (2.6–2.7 s in every run), test 3 (2.7 s in run 1, 2.8 s in run 3) and test 11 (2.8 s in run 1). Full-suite load makes these tests 2–2.5 times slower than they run alone. Each one runs one or more complete moves of a seeded fixture Character. The seeds-and-batches decision above would shorten them.

The other tests at or over half their timeout are `jsdom` UI tests, plus `catalogReleaseActivation` › activation is idempotent after a lost response, `characterSheetClassVersions` › switching original and Unchained versions, and `characterSheetSelections` › ranged feats. All took 2.5–4.0 s, and none timed out in any run. They are outside #717.

## Two slow tests (2026-10-03)

This change reduced fixture and DOM-query work in two slow tests while preserving their public behavior checks. Production code, UI presentation, Vitest configuration and timeout settings were unchanged. Local tests retain the 5,000 ms timeout; the existing CI setting remains 15,000 ms.

### Measurement

Measurements were collected on 2026-10-03. Each target was run alone three times before and after editing. The numbers below are the target assertion's `duration` from Vitest JSON, in milliseconds. They measure the test body, not transform, import, environment startup or total process duration. Reports and diagnostic logs are in `/tmp/ep-testhealth-evidence` for this implementation session.

| Target                              |  Before 1 |  Before 2 |  Before 3 | Before median | After 1 | After 2 | After 3 | After median |
| ----------------------------------- | --------: | --------: | --------: | ------------: | ------: | ------: | ------: | -----------: |
| Character level growth before Setup | 2,167.341 | 2,258.868 | 2,179.768 |     2,179.768 | 349.679 | 341.776 | 352.008 |      349.679 |
| New Table Adjustment Cancel         |   290.978 |   287.918 |   290.491 |       290.491 | 234.570 | 228.640 | 229.410 |      229.410 |

Median test-body duration fell **83.96%** for Character level growth and **21.03%** for Table Adjustment Cancel. All six before and six after measurements passed. These percentages compare the named targets; the new focused boundary test adds separate coverage and cost, reported below, and no before-suite benchmark was collected.

The source reports are `character-before-{1,2,3}.json`, `character-after-{1,2,3}.json`, `summary-before-{1,2,3}.json` and `summary-after-{1,2,3}.json`; `timings.json` preserves their unrounded assertion durations.

### Character fixture

`convex/characterMilitiaSheet.integration.test.ts` previously inserted 4,093 Class Level rows directly into the test database. Together with the original Class Level, base entry and personal adjustment, this produced a 4,096-entry sheet solely to reject one additional level. That setup also made reads calculate thousands of rows.

The existing test now creates a realistic level-one Character and a Charisma personal adjustment through public mutations, grows to level two and reads the sheet through `api.characterSheet.read`. It checks the calculated level and Charisma, the four resulting entries, and retention of the same personal adjustment. It then requests level 4,095 while also changing the name. The real production cap remains 4,096: 4,095 Class Levels plus base scores and the personal adjustment would need 4,097 entries. Rejection is checked against the complete preceding public read, covering unchanged name, revision, entries and calculated statistics without inserting thousands of rows.

`convex/characterMilitiaSheetLimit.integration.test.ts` separately proves the exact boundary with a file-scoped partial mock. `vi.mock` uses `importOriginal` and overrides only `maxCharacterChildRows` to eight; all mutations, validation, calculations and reads retain their real implementations. Six Class Levels plus base scores and the personal adjustment reach eight entries and are accepted. A seventh Class Level would require nine entries and is rejected atomically, again checked by complete public-read equality.

The partial mock changes the cap consumed by importing mutation helpers. `readCharacterSheetData` retains its original lexical 4,096-entry loader limit; this focused test proves mutation growth behavior rather than claiming a scaled loader-limit test. The existing integration file is unmocked and retains its real-cap rejection. No production configuration, helper interface or Convex function module was added.

### Table Adjustment Cancel

Profiling the original `[rules.P85.adjustment-new-cancel]` test identified jsdom style work in accessibility queries as the main cost. One run made 143 real `getComputedStyle` calls taking 211.34 ms, about 72% of its 292 ms test duration. Rendering took 22.98 ms; registration and dismissal waits together took 4.92 ms. A follow-up profile observed one registration attempt, two validation attempts and one dismissal attempt. Those measurements support reducing the rendered/query surface rather than changing polling or timeout settings. Temporary instrumentation was removed.

Only this test now renders the existing exported `AddAdjustment` form instead of the entire `SummaryView`. It still uses the real form fields, adjustment hook, react-hook-form, Zod validation and the existing in-memory form guard. It verifies registration, preservation of malformed `1.005` input, visible validation, dismissal, guard release, no writes before or after Cancel, and focus returning to the same choice card. Role and accessible-name queries remain in use, and real style calculation is not mocked.

Integration coverage remains in `summary-confirm-guard.test.tsx`: `[rules.P85.local-confirm-guard]` renders the real board/store and exercises the new adjustment through `SummaryView`, checking that open or invalid input disables Confirm, Save releases it, and another device's adjustment survives. `[rules.P85.adjustment-return]` in `summary-adjustments.test.tsx` still verifies retained input and guard propagation when returning to `SummaryView`. The narrower Cancel test does not replace these integration checks.

### Reproduction and validation

Run from the repository root. The shared lock serializes heavy checks so unrelated runs do not distort measurements. For each target, repeat with `run` set to `1`, `2` and `3`, retaining separate before/after reports. Use the original tests for the before measurements; use the updated tests and replace `before` with `after` in the output filenames for after measurements:

```bash
run=1
flock /tmp/ep-orch/heavy.lock pnpm test convex/characterMilitiaSheet.integration.test.ts \
  -t 'level growth respects existing personal adjustments before Setup' \
  --reporter=json --outputFile="/tmp/ep-testhealth-evidence/character-before-${run}.json"
flock /tmp/ep-orch/heavy.lock pnpm test src/components/weekly-draft-workspace/summary-adjustments.test.tsx \
  -t adjustment-new-cancel \
  --reporter=json --outputFile="/tmp/ep-testhealth-evidence/summary-before-${run}.json"

flock /tmp/ep-orch/heavy.lock pnpm test \
  convex/characterMilitiaSheetLimit.integration.test.ts \
  convex/characterMilitiaSheet.integration.test.ts
flock /tmp/ep-orch/heavy.lock pnpm -s typecheck
flock /tmp/ep-orch/heavy.lock pnpm -s lint
```

The sandbox-compatible suite run excludes 22 `e2e/support/*.test.ts` files per the shared brief, because socket-based support tests fail in the sandbox. Some files in that directory are pure tests; the exclusion covers the directory as a whole. The run uses four workers with verbose and JSON reporters. This exclusion is supplied to the command; no test discovery configuration or test file is disabled:

```bash
flock /tmp/ep-orch/heavy.lock pnpm test --exclude 'e2e/support/**' \
  --maxWorkers=4 --reporter=verbose --reporter=json \
  --outputFile.json=/tmp/ep-testhealth-evidence/suite.json \
  > /tmp/ep-testhealth-evidence/suite.log 2>&1
```

| Check                                                      | Result                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| Both character integration files together                  | Passed: 50 tests in two files; session log `character-focused-agent.log` |
| Three after measurements per target                        | Passed: all six runs, exit 0                                             |
| Sandbox-compatible suite with four workers                 | Passed: 290 files, 3,210 tests; 115.93 s wall duration                   |
| Typecheck                                                  | Passed: exit 0                                                           |
| Lint, including unused-code checks                         | Passed: exit 0                                                           |
| Prettier for the four changed files and `git diff --check` | Passed                                                                   |
| Slowest remaining tests                                    | Ranked below from final suite JSON                                       |

The suite's target body durations were 144.173 ms for the Character growth test, 95.457 ms for Table Adjustment Cancel, and 298.820 ms for the focused cap test. These are observations under the four-worker suite load, separate from the isolated before/after comparison. File and test totals come from the verbose summary; the JSON suite counter also includes nested describe groups and is not a file count.

### Slowest remaining tests

All ten passed. Durations are individual test bodies from `suite.json`, ranked in `slowest-tests.json`:

| Rank | Test file                                                                  | Test                                                                                                                                                              | Duration (ms) |
| ---: | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------: |
|    1 | `convex/rulesAcceptance.integration.test.ts`                               | `[rules.GATE.projection-parity]` shared canonical fixtures retain every Phase View and full committed outcome through browser and authenticated Convex boundaries |     7,056.265 |
|    2 | `src/components/militia-setup/guided.test.tsx`                             | `[setup.carry-form]` character conditions and scoped expiring benefits can be carried into ordinary play                                                          |     2,733.368 |
|    3 | `tests/catalog/curation-command.test.ts`                                   | Writes itemised preview failures before exiting nonzero, then drafts, resumes and previews working records                                                        |     1,573.276 |
|    4 | `tests/catalog/release-operator.test.ts`                                   | The CLI builds a deterministic gated artifact and prepares/inspects it through the injected remote command adapter                                                |     1,562.137 |
|    5 | `src/components/militia-setup/guided.test.tsx`                             | `[setup.receipt-decimal]` enchantment delivery preserves decimal input and explicit receipt days                                                                  |     1,554.960 |
|    6 | `src/components/militia-setup/guided.test.tsx`                             | `[setup.guided.navigation]` steps navigate freely with invalid input, keep every entry and never submit                                                           |     1,501.189 |
|    7 | `src/components/historical-week/screen.test.tsx`                           | A deep link outside the newest window loads only the window ending at that week and keeps the latest row at the bottom                                            |     1,264.377 |
|    8 | `src/components/character-sheet/character-sheet-page.test.tsx`             | A minimal sheet offers Build out once; a visit never runs it, a click runs it once, and the full response takes it away                                           |     1,259.065 |
|    9 | `src/components/weekly-draft-workspace/nested-roll-compatibility.test.tsx` | `[rules.EVT-11.invalid-shift]` removing an earlier entry keeps a later entry's malformed text blocking the save until it is fixed                                 |     1,222.646 |
|   10 | `src/components/weekly-draft-workspace/event-recurring-inputs.test.tsx`    | `[EVT-10.rivalry-officer-view]` Rivalry Twice: Attempt it shows the officer check, which is stored once character and skill are known                             |     1,220.682 |

The projection-parity acceptance test already has an explicit 60,000 ms timeout, unchanged by this work. Its 7,056.265 ms duration exceeds the local default but does not indicate a timeout regression in either optimized test. The remaining nine are below the unchanged 5,000 ms default in this run.

There are no UI presentation changes, new Convex function modules, schema changes or migration implications. No deploy or codegen is required for these test changes. The sandbox suite result does not certify the excluded support tests or browser end-to-end tests.
