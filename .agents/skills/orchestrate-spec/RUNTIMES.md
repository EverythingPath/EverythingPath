# Runtimes

How the orchestrator dispatches, waits for and briefs workers. `SKILL.md` names the roles and the steps; this file names the mechanics. Dispatch is T3. The legacy Claude Code and Codex CLI routes (`spawn.sh`, `curate.sh`) are retired: nothing in the repo starts an agent CLI, and `scripts/orchestration/agent_launch_guard.py` (run by `pnpm -s test:workflow`) fails if anything does.

**Reviews cross models:** the reviewer is the other model from the one that authored the work. The overlay's role table (`docs/agents/orchestration.md`) names each selection.

## T3 Code

- **Selection:** resolve the role table against `orchestrator_capabilities` once per session, record IDs and options under Now in `open-decisions.md`, and re-resolve only after a refused dispatch.
- **Dispatch:** `delegate_task` with the explicit provider instance, model and every option, and `mode:"async"`. A separate coding checkout uses `isolation:"worktree"` from the parent's committed base (uncommitted changes are not copied). Verify the returned provider, model and every effective option against the request; an unsupported selection stops the dispatch. Keep the task ID and the app-owned branch and path, and work in that worktree with the shared `EP_ORCH`.
- **Waiting:** dispatch is async. Between dispatch and the completion notice do other queue work or end the turn. `task_status` answers a stale notice or an owner question, not a wait. Bounded jobs: one `await.sh <id> --timeout 7200` in a background shell, never repeated slices.
- **Completion** is task/run status, including `workState` and pending child runs, not a saved report.
- **Review rounds:** each is a fresh independent `delegate_task` with a distinct stable `clientRequestId`, carrying what [runbook §7](../../../docs/agents/orchestration/runbook.md#7-fix-round) lists; never another round on the backing child thread. Reviews that promote records need [T3 evidence](../../../docs/agents/orchestration/t3-reviews.md) before dispatch.
- **Resources:** T3 workers run under no resource wrapper of their own. The brief tells them to hold a curator slot only while a heavy command runs, to run it through `$EP_ORCH/capped.sh`, and to leave gates and preps to bounded units. Numbers: `$EP_ORCH/resource-policy.md`.
- **Shell jobs** (gates, landing scripts) run in a background shell. Long-running waits belong in a script file. A `pgrep -f` or `pkill -f` pattern must never appear in the waiter's own command line.
- **Legacy numbered worktrees and branches** (`impl/<n>`, `cur/<n>`, `../ep-impl-<n>`, `../ep-cur-<n>`) and numbered queue arguments stay supported by the scripts in `scripts/orchestration/`: `cur-prep.sh <n> "$EP_ORCH/briefs/cur-<n>-msg.txt"`, `land-queue.sh <n>...`, or an explicit `cur/<n>:<path>`.
- **Legacy landing CLI** (separately authorized only): `scripts/orchestration/land-queue.sh [--dry-run] "$BRANCH:$WT"` (curation: `"cur/<n>@$BRANCH:$WT"`); worktree removal: `git -C $MAIN worktree remove "$WT" && git -C $MAIN branch -d "$BRANCH"`.
- **Outward operations:** no PR, issue close or Cloud operation; the only push is a frozen landing candidate as `gate/<label>` (overlay, GitHub).

## Writing briefs

- Start with `docs/agents/orchestration/roles/common.md`, then the role file, then the brief.
- Name the worktree, the branch, the report path and the TMPDIR (`~/repos/everythingpath/.ep-tmp/<task>`). A T3 brief names the actual provider/model/options, frozen commit, app branch/worktree, shared `EP_ORCH`, durable inputs/report and task/run completion criterion.
- Name launch outcome, included records/behaviors, demonstrated dependencies, excluded owners/remaining acceptance and shared-path behavior outside the selection. Preserve supported behavior or explicitly refuse unsupported inputs.
- Give testable completion criteria and one impact-based validation plan; use the runbook's evidence reuse and invalidation procedure.
- Point at the spec, the tickets, the notes and the commits instead of quoting them.
- Say which skills to load (`tdd` for implementers; reviewers get a review template).
- Say what the worker must not touch: the main checkout, env files, the shared stash, and git, if the worker's sandbox can't write `.git`.
