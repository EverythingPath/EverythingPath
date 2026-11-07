# Every worker

These rules come before your role file and brief.

- **Hygiene:** the worktree's only env file is `.env.example`; other `.env*` files and `e2e/.private` are outside your task. No dev servers or production builds.
- **TMPDIR:** your brief's, else `~/repos/everythingpath/.ep-tmp/<task>`, exported; all scratch goes there, never `/tmp` or a worktree. Remove it when done unless your role file says otherwise.
- **Heavy commands** run through `/home/andreas/repos/everythingpath/ep-orch/capped.sh`, holding a curator slot only while one runs.
- **Git:** leave the shared stash and the main checkout alone; never push. Your role file says whether you commit.
- If the harness asks you for a permission, stop and put the prompt text and the command in your final message; the orchestrator cannot see it.
- Your task ends at your report. A gate or another job's result arrives in your next brief; never wait for one in this session.
- **Report:** write it to the path your brief names. Your final message is three lines: the path, the outcome in one line, what the orchestrator must do next. If you cannot write files, your final message is the whole report.

Your role file and brief are complete. `docs/agents/orchestration/` and `$EP_ORCH` outside the paths they name belong to the orchestrator; do not read them.
