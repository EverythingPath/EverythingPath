# Qualification plans and gate evidence

Root's one-time qualification plans for the gate modes and the gate monitor, and the evidence behind the gate memory cap. Moved from operations.md; the live rules are in [operations](../orchestration/operations.md) and [gate modes](gate-modes.md). Steps already done are recorded under `$EP_ORCH/mvp-20261023/`.

## Remote heavy checks

**Qualification:** this slice landing through today's gate (Q0); then the next real landing in `compare` (Q1); then the first `replace` landing (Q2), with root reviewing its result and timing. If Q1 fails, keep local gates and diagnose; never retry to green.

## Mechanical-rebase proof

**Qualification (root):** this slice lands through today's gate with full Standards and Spec reviews; the gate runtime is frozen from MAIN at prepare, so it is the old code (Q0). Before the first real `rebaseProof` gate, root runs the CLI on the real cases (S3 `43915c7e 7f6406aa f971d8e7` at `ea47feaa` and S4p2 `43915c7e 9687763a f971d8e7` at `5559efd3` pass; accepted `278912b7` against `ea47feaa` fails on commit count). On that gate root repeats the r4 git checks by hand (range-diff, unnormalised diff equality, zero overlap) and records them in the gate result; any disagreement stops the gate for diagnosis (Q1). The first ordinary gate after landing observes the default path live, with an unchanged completion scope.

## Single-axis fix review

**Qualification (root):** this slice lands through today's gate with full Standards and Spec reviews; the gate runtime is frozen from MAIN at prepare, so it is the old code (Q0). Before the first real `carriedReview` gate, root reruns the real-history check on the landed code: C1 `carry_proof(MAIN, 43915c7e, a5782751, <its tree>, 0f846822)` passes with `src/components/legal/linked-text.tsx` and `src/components/legal/notice-text.tsx`; base `cbc53464` with head `b664190a` fails as not in the chain. On that gate root repeats `git merge-base --is-ancestor E H`, `git rev-list --parents F..H` and `git diff-tree -r --name-only E H` by hand and records them in the gate result; any disagreement stops the gate (Q1). A wrong refusal launches nothing. The first ordinary gate after landing observes the default path live, with an unchanged completion scope.

## Light landing lane

**Qualification (root):** this slice lands through today's full gate with full Standards and Spec reviews; the frozen runtime at prepare is the old code (Q0). That gate is also the first run of the read lock: its triage evidence must hold `lane-lock-full.json` with the locked files and an all-green suite. Before the first use, root re-runs `light_lane.py check` on the landed code: `5ebbf2fb^ 5ebbf2fb` fails outside the allowlist. A candidate prepared on a base without this slice refuses (`reader pin changed: vitest.config.ts`), which is expected: the old base lacks the guard and the lock. So W6 is rebased onto the head that contains the lane, and `check` runs on the rebased candidate, which passes with `.claude/settings.json`, `.gitignore` (one added `.claude/settings.local.json` line, R5), `docs/agents/orchestration/roles/implementer.md` and `docs/agents/orchestration/runbook.md`. On W6, the first light gate, root repeats by hand the raw delta (four 100644 paths), the `.gitignore` blob comparison (one inserted literal line), the JSON parse, the census (table entries only), the queue logs (exactly `artifacts`, `light` and `land`) and the light completion scope, and records them in the gate result; any disagreement stops the gate (Q1). The first ordinary gate after landing observes the default path live, with today's scope and the lock records.

## Paired gates

Dummy-command fixtures qualify these CLI contracts only. Fresh ordinary reviews and the established single-item gate qualify tooling changes. A naturally ready real reviewed pair, selected and run by the parent after tooling lands, is still required for operational/performance/backend qualification. Existing #766 authentic evidence and historical source pins remain unchanged.

## Monitor provenance

`gate_monitor.py` ports the accepted 2026-10-27 external monitor whose source SHA-256 is `04208817cc54e3eec3cf27ef9641914b1bb0e8fcde30307c8942464f5fe9d7be`. The initial adaptation changes the `gate_core` imports, storage-baseline lookup and prepared-mapping lookup. The adaptation also serializes MAIN identity reads with the checked fast-forward and removes duplicate adapter proofs. The foreground loop, complete integrity sequence, supervised process/output cache, fresh terminal pass and numerical safety thresholds remain unchanged, except the gate memory cap below and the terminal deactivation state.

**Terminal deactivation** (`observer-deactivation-race`, 2026-11-05; `$EP_ORCH/mvp-20261023/admission-light-peaks-gate-r4-result.md`). After a clean exit, systemd deactivates and then unloads the unit; in r4 the observer read the unit's counters in between, recorded `observerMissingCounters: unit`, and its stop request met an unloaded unit. Now a unit row that is `deactivating` with `Result=success`, `ExecMainStatus=0` and `MainPID=0`, and whose canonical receipt, once written, is ok, is a terminal state: its missing counters are listed under `unavailable` (never zero) and are not a violation. A stop request that systemd refuses because the unit is no longer loaded (`LoadState=not-found`) is recorded, not an observer failure. Counters lost while the unit is `active` or `activating`, while its main process runs, after a failed result or status, with a failed receipt, or in a row without `MainPID` (every row before this change) still stop the gate. The monitor reads `MainPID` and `LoadState` for this. The changed monitor needs fresh qualification on its first live gate, like any changed canonical script.

**Protected refs** (gate-hold-scope, 2026-11-07). The ref check protects only the gate's own refs and every archive, and records moves of any other ref instead of stopping; rows carry the protected refs and a digest of the rest ([gate modes](gate-modes.md#protected-refs)). An archive added during the gate is protected from the first row that shows it (the archive ledger, replayed by a restarted monitor and kept by collection). Each row also records the automatic-maintenance reading of MAIN and every one of its worktrees, with scheduled maintenance, and the prelaunch row and every later row stop on it. The identity checks and every threshold are unchanged. Its first live gate is the first one prepared after it lands; it needs fresh qualification there.

## Monitor qualification authority

Root's external `R/761-monitor-repair-r1.md` (report SHA-256 `f1b65ae4d26e9190bd12f3c2cde34ba43fc8d25dc5e46efd99981debdc915eed`) is the qualification authority, pointing to its retained RED and GREEN evidence. Thirteen actual-loop cases and two real already-reaped regressions qualified the source's finite lifecycle/simulated-policy contracts. Repository fixtures check the adapted import and actual supervised-child wiring; they supplement that evidence. Neither establishes fresh live full-gate/resource-pressure qualification, reconstructs the unproved historical gap decomposition, or authorizes resuming a stopped invocation. Root owns fresh bindings, review, qualification and adoption. Keep the original source, failures, report and qualifier directories immutable outside the repository.

## Gate memory evidence

Owner option 1 (2026-10-30, unparked 2026-10-31): the gate unit's `MemoryMax` is **15 GiB** (`$EP_ORCH/bounded.sh`, kind `gate`, no MemoryHigh) and a gate launches only with **21 GiB** available: the cap plus the unchanged 6 GiB in-run host floor (below it for 5 s stops the gate). `gate_monitor.py` `GATE_MEMORY_MAX_BYTES` sets the launch guard, the unit's real-memory stop and the expected unit `MemoryMax`; the wrapper must match it, or the monitor stops the gate as a cap mismatch. It was 16 GiB and 22 GiB. That is the local and `compare` cap, and the slice-wide real-memory stop keeps it in every mode. The `replace` cap, 10 GiB with a 16 GiB guard (owner, 2026-11-03), is in [Gate memory](../orchestration/operations.md#gate-memory).

- **Evidence:** the 2-worker / 600% gates 744a1 r1, 744a2 r2, 744b r2, 770a r1, 770b r2 and 770b2a r1 peaked at 9.80–11.96 GiB unit kernel memory and 7.84–10.26 GiB real (both highest in 770a r1). 15 GiB leaves 3.04 GiB above the highest kernel peak; 13 GiB would leave 1.04.
- **Node heap:** with no soft limit, Node v22 derives its default 4,144 MB heap at 15G and above, but 2,096 MB at 14.5G and below. `catalog:pin` sets no heap flag, so 15G is the smallest cap that keeps its heap.
- **Limits:** 3-worker gates (real peaks to 14.94 GiB) no longer fit. `gate-2` admission (measured, 11.5 GiB) is unchanged.

