# Paired landing gates

Use a pair when exactly two prepared, reviewed items are ready together. Keep urgent work on the single-item queue. Unflagged lists still run serially, with one gate per item. Pairing changes neither resource settings nor review authority; the live resource policy applies.

## Select and freeze

Run `land-queue.sh [--dry-run] --pair /absolute/plan.json` through the existing bounded gate workflow, with shared `EP_ORCH`. The plan is data, supplied by the parent after ordinary reviews. It has `base` (the exact integration SHA) and exactly two ordered `items`:

- `issue`: positive issue number, unique in this pair.
- `item`: the existing queue token. App worktrees use `branch:/absolute/worktree`; curation uses the explicit `cur/N@branch:/absolute/worktree` discriminator independently of its actual branch name.
- `commit` and `tree`: frozen original input SHA and tree SHA.
- `review`: `commit`, `parent`, `tree` and `patchSha256` of the reviewed scope; `status: "completed"`, `disposition: "land"`, `unresolved: []`, explicit `exceptions: []` (or named accepted exceptions), and `reports`.
- Each report has `axis`, absolute `path` and `sha256`. Code requires `standards` and `spec`; curation requires `curation`, with every admission reviewed in full under the existing review procedure. The parent attests completion and disposition.

`patchSha256` hashes the bytes from `git diff --binary --no-ext-diff --no-textconv <parent> <commit>`. Hash it as a stream rather than buffering large patches. Bind reports only after their authentic review tasks finish. Never fill an accepted disposition for pending work or unresolved findings.

Each input must be a clean registered worktree of the same repository, with one nonempty, non-merge issue commit. A's parent must be on integration's history. B's parent must either be on that history or be exactly the frozen A commit. Ambiguous stacks and multiple issue commits use the single path after preparation. Dry-run validates bindings and snapshots scripts, without checks, rebases, receipts or landing.

## Assemble and review

The queue stages A onto the frozen base, then B onto staged A, on its own scratch branches; only the data/table merge allowlist resolves conflicts automatically, and conflicts and failed checks stay available for diagnosis. Each stage runs the writer, binding, ownership and receipt checks (curation runs its specialized prep against its staged parent), and movement during checks rejects the stage. What each stage freezes and verifies: [pair internals](../orchestration-reference/paired-gates-detail.md).

Any changed staged commit requires fresh appropriate ordinary review before the full gate. Inspect `assembly.json`, per-stage scope records and the retained Git objects. The parent reviews the exact staged parent/commit/tree/patch, including inherited context, counts, data rebinding, dependency/tooling changes and affected older batches. Historical promotion SHAs/reports/run IDs remain historical; changed covered identities or payload need authentic renewed promotion evidence through the existing procedures.

Resume with the same frozen inputs/base and `resume: {"manifest": "/absolute/assembly.json", "sha256": "<manifest hash>"}`, replacing review bindings/reports with the completed reviews of its exact stages. Only this retained clean assembly, matching scripts/environment and unchanged originals can resume. A fix to an item starts a new frozen assembly through the parent workflow; affected successors are rebuilt, checked and reviewed. Editing scratch cannot silently renew its evidence.

## Gate and land

Once both staged reviews match, the queue runs one complete canonical gate on the combined tip and one checked fast-forward to it; there is no partial or prefix landing. Artifact growth is checked for the complete tree (positive growth accumulates across both items; deletions don't offset it), and every budget stays binding. The pair needs exact `all green`; LOAD, NEW, REAL, REGRESSION, missing verdicts and nonzero suite or triage exits block it. Remote heavy-check manifests do not apply to pairs. The queue drafts one comment per issue in the pair directory; the parent posts them and does the owned closeout, and the originals stay intact.

## Failure and recovery

Every attempt keeps its original archive refs, inputs, stage logs and results, scope records and suite JSON; an orphaned gate cannot land after its queue owner dies.

`split-plan.json` lists A on the frozen base, then B on accepted A. Changed files are suspects only, never failure attribution. Current diagnosis-before-retry policy automatically emits this plan but **defers the original #759 requirement to execute split gates automatically**. The parent diagnoses first, then runs each selected group through its own complete reviewed canonical gate. A failed pair stays failed.

A retained gate attempt cannot implicitly retry. Supplying its resume plan records authoritative integration state: an exact already-landed combined tip is reported without another gate or FF; an unlanded or unexpected tip stops for diagnosis. If the process disappears around FF, inspect integration HEAD/ancestry and retained evidence before closeout. A post-FF receipt/comment error is closeout recovery, not permission to repeat validation or reset integration.

Qualification of pair tooling: [qualification](../orchestration-reference/qualification.md#paired-gates). Queue internals: [pair internals](../orchestration-reference/paired-gates-detail.md).
