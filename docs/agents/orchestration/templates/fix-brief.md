# Fix round <R>: #<N> <TITLE>

Fix the findings below in <WT> on branch `<BRANCH>`, on top of `<COMMIT>`. The original brief is `<ORCH>/briefs/<N>.md`; its support boundary, validation plan and report path still apply except where this brief changes them.

## Findings to fix

One line per finding the parent disposed as `fix`: the review report and finding number, the file:line, and what done looks like.

- <axis> #<k> (`<report path>`): <finding>. Done: <criterion>.

A fail-open finding is a class, not a point: enumerate every path that accepts the same input family, state the refused set, add one negative test over the full pinned corpus; a fix that patches only the reported key is rejected at review.

## Carried, not to fix

Accepted deferrals and external blockers, each with its owner or evidence. Leave them as they are; the reviews list them once under Carried.

- <axis> #<k>: <accepted deferral, owner> | <external blocker, evidence>.

## Rules

- Pin rule: the branch has rotated, so REPLACE its pin.
- Keep each finding's failed evidence; rerun only the checks the fix affects, recording why earlier evidence expired.
- Commit as `wip: #<N> fix r<R>`.

## Report

Write `<ORCH>/briefs/<N>-fix-r<R>.out.md`: each finding fixed or not, with the commit and the checks run, and "Not done / deviations" (or "none").
