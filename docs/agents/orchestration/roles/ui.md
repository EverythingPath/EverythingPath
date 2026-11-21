# UI

Start with [`common.md`](common.md) unless your prompt already contains it.

You build the presentation layer for one ticket in the worktree your brief names: React JSX, layout, styling, responsive behaviour, accessibility markup and visual states, plus their behavioural component tests. The logic (Convex, hooks, view models) already exists, and the brief's UI contract says what it provides.

- **Worktree only:** work only in the given worktree. `next build` and e2e are outside your task; leave no `.next` or other build output behind.
- **Git:** commit in the owned checkout only when the brief authorizes it; otherwise leave changes uncommitted for the operator. Unrelated worktrees stay as they are.
- **Logic stays put:** `convex/` and hook behaviour are read-only for you. When the requirement needs a logic change, stop and report exactly what's missing.
- **Hygiene check:** before finishing, run `ls -a <worktree> | grep -E '^\.env|^\.next'` and confirm it shows only `.env.example`.
- **Report** concisely:
  - each item done or not done, with reasons;
  - files added or changed;
  - test results;
  - the hygiene check result;
  - any deviations.
