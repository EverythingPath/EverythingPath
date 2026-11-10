# Every worker

These rules come before your role file and brief.

- **Hygiene:** the worktree's only env file is `.env.example`; other `.env*` files and `e2e/.private` are outside your task. No dev servers or production builds.
- **TMPDIR:** your brief's, else `~/repos/everythingpath/.ep-tmp/<task>`, exported; all scratch goes there, never `/tmp` or a worktree. Remove it when done unless your role file says otherwise.
- **Heavy commands** run through `/home/andreas/repos/everythingpath/ep-orch/capped.sh`, holding a curator slot only while one runs.
- **Git:** leave the shared stash and the main checkout alone. Never push, except through `scripts/orchestration/wip-ci.sh` (`wip/**` only). Your role file says whether you commit.
- **WIP CI:** `scripts/orchestration/wip-ci.sh run [--scope tests/<dir>] --task <task>`, run from your worktree, tests its current files in CI, uncommitted ones included; it leaves your worktree's index and refs untouched and holds its own run slot, so no `capped.sh` (both tested in `scripts/orchestration/wip-ci.test.sh`). A suite run takes about 20 min: 10 test shards in two waves of 5 plus the plan and summary jobs, 12 CI jobs (13 with `--static`); a `tests/catalog` run about 14 min. Use `--scope tests/catalog` for a catalog-only slice and `suite` when it touches `src/` or the app ([operations](../operations.md), "Which scope"). Its result is information, never landing evidence: list each run's URL and verdict under "WIP CI (information)" in your report. Your role file says when to use it.
- **Guards:** a guard, scanner, validator or safeguard is built and reviewed against the threat model its brief states. Default: accidents by cooperative agents. Acceptance is the brief's bounded list of forms it must catch, each with a test. Deliberately constructed escapes (a launch inside a Python f-string, `\x2f`-escaped paths, `it['skipIf']`) are out of scope, nits at most. A brief may name a stronger model, for landing evidence, publication or content notices.
- If the harness asks you for a permission, stop and put the prompt text and the command in your final message; the orchestrator cannot see it.
- Your task ends at your report. A gate or another job's result arrives in your next brief; never wait for one in this session. WIP CI is the one result you may wait for, in the background (`run_in_background` or `t3_background_wait`; never poll).
- **Your own commands:** wait for every command you started, in the foreground or with the harness's background wait, before you end a turn; a capped command that moved to the background is still yours. End the turn only with your final message.
- **Report:** write it to the path your brief names. Your final message is three lines: the path, the outcome in one line, what the orchestrator must do next. If you cannot write files, your final message is the whole report.

Your role file and brief are complete. `docs/agents/orchestration/` and `$EP_ORCH` outside the paths they name belong to the orchestrator; do not read them.
