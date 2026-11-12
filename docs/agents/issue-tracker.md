# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, also fetching labels. Filter JSON with gh's built-in `--json … --jq '<expr>'`; the standalone `jq` is not installed.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`.
- **Apply or remove labels**: `gh issue edit <number> --add-label "..."` or `gh issue edit <number> --remove-label "..."`.
- **Close an issue**: `gh issue close <number> --comment "..."`.

Infer the repository from `git remote -v`; `gh` does this automatically when run inside the clone.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number> --comments` and `gh pr diff <number>` for the diff.
- **List external PRs for triage**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments`, then keep only `authorAssociation` values `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE`.
- **Comment, label, or close**: use `gh pr comment`, `gh pr edit --add-label` or `--remove-label`, and `gh pr close`.

GitHub shares one number space across issues and PRs. Resolve an ambiguous `#42` with `gh pr view 42` and fall back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

The `/wayfinder` skill uses one map issue with child issues as decision tickets.

- **Map**: create one issue labelled `wayfinder:map` containing Notes, Decisions so far, and Fog.
- **Child ticket**: link an issue to the map as a GitHub sub-issue. If sub-issues are unavailable, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Label it `wayfinder:<type>`, where the type is `research`, `prototype`, `grilling`, or `task`. Assign the ticket to the driving developer when claimed.
- **Blocking**: use GitHub native issue dependencies as the canonical UI-visible representation. Add an edge with `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where the blocker database ID comes from `gh api repos/<owner>/<repo>/issues/<number> --jq .id`. If dependencies are unavailable, use a `Blocked by: #<number>` line near the top of the child body.
- **Frontier**: list the map's open children, drop tickets with open blockers or assignees, and take the first remaining ticket in map order.
- **Claim**: run `gh issue edit <number> --add-assignee @me` as the session's first write. This covers wayfinder maps only; orchestrated tickets are never assigned (see `docs/agents/orchestration.md`).
- **Resolve**: comment with the answer, close the child issue, and append a concise context pointer and issue link to the map's Decisions-so-far section.
