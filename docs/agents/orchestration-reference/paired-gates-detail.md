# Paired gates: queue internals

Reference for [paired gates](../orchestration/paired-gates.md): what the queue does while it assembles, gates and lands a pair. Read it when diagnosing a pair stage or before changing the pair scripts.

## Assembly

The queue owns scratch under its unique `logs/queue-…/pair/` directory and `queue-pair/…` branches. It archives original input and historical reviewed objects before replaying A onto the frozen base, then B onto staged A. Only the existing data/table merge allowlist can resolve automatically. Conflicts and failed checks remain available for diagnosis.

After each staged rebase it freezes identity before the artifact guard, reinstalls offline once, runs writer/binding/ownership/receipt checks and explicitly verifies historical receipts with `catalog-record-review.ts --verify --root <assembly> --runs "$EP_ORCH/runs"`. The checked identity crosses prep and stage completion in retained evidence; the queue validates its commit, tree, parent, worktree and receipt context before accepting a stage. Movement during checks or at either return boundary rejects the stage, including a same-tree amendment. Curation uses existing specialized prep against that item's staged parent: whole-diff test discovery, older affected batches, uncertainty-to-full behavior and post-rebase shared-store counts. Expected count amendments precede its identity freeze and stay in the owning issue commit. Run-local receipts do not replace original prep receipts. The manifest binds each receipt, dependencies, original/staged scope and inherited parent context.

## Gate and landing

Once both staged reviews match, the queue invokes one complete canonical gate on the combined tip: artifact checking against the pinned integration base before unconditional local codegen and dirt check, pin, typecheck, lint, the unfiltered original full suite in a fresh checkout under `heavy.lock`, canonical diagnostics, and disposable local preflight with its existing one retry. Per-item artifact passes do not replace this complete-tree check: positive growth accumulates across both items, and deletions do not offset it. All existing budgets remain binding. Pair qualification requires exact `all green`; LOAD, NEW, REAL, REGRESSION, missing verdicts and nonzero suite/triage exits block it. No prefix is independently qualified. Remote heavy-check manifests do not apply to pairs: the queue refuses `--pair` and `cur-land.sh` refuses `LAND_PAIR_MANIFEST` with `LAND_REMOTE_CHECKS`.

At landing it rechecks frozen inputs, reports, assembly, script/environment bindings, integration base/branch and queue ownership. `land.sh` retains owner-dirt protection and performs one checked fast-forward to the tested combined tip. There is no partial prefix landing. Per-issue comment drafts in the pair directory identify each own SHA, both issues, combined tip, reviewed scope, exceptions and shared gate/bounded evidence. The parent posts them and performs existing owned closeout; the queue leaves originals intact.

## Retained evidence

Every attempt retains original archive refs, ownership/inputs, stage command logs/results, scope records, original suite/diagnostic JSON and bounded invocation references. Signals forward to the active command group. Original safety comes from never using originals as scratch, including when a cleanup trap cannot run. An orphaned gate cannot land after its queue owner dies.
