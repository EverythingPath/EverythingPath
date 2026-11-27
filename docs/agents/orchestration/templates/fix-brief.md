# Fix round <R>: #<N> <TITLE>

Fix the findings below in <WT> on branch `<BRANCH>`, on top of `<COMMIT>`. The original brief is `<ORCH>/briefs/<N>.md`; its support boundary, validation plan and report path still apply except where this brief changes them.

## Acceptance table (tooling and guard work)

For a script, guard, gate, proof or validator, root fills this table; it is the contract for the fix and for its delta review, beside the original brief's other requirements, and narrows none of them (a narrowing is a scope change: runbook §7). Delete the section for other work. The fix makes each row hold and adds no capability the table does not ask for.

| | |
|---|---|
| Safety property | <the one property that must hold, stated about the product's behaviour, not about one input> |
| Supported inputs | <the inputs and encodings that must work; this limits what must work, never what must be refused> |
| Must refuse | <the whole required refusal class, inputs outside the supported set included (an unsupported encoding of a refused input is still refused: fail closed), each with its test> |
| Permitted writes | <the files, refs and state it may change, and what stays unchanged on a refusal> |
| Equality | <per comparison: byte equality, or semantic equality as the product's own reader yields it> |
| Not required | <what this round does not ask for; extra capabilities are separate work> |

## Findings to fix

One line per finding the parent disposed as `fix`: the review report and finding number, the file:line, and what done looks like.

- <axis> #<k> (`<report path>`): <finding>. Done: <criterion>.

A fail-open finding is a class, not a point, within the original brief's threat model: enumerate every path that accepts the same input family, in every encoding the refusal class covers, state the refused set, add one negative test over the full pinned corpus; a fix that patches only the reported key is rejected at review.

## Carried, not to fix

Accepted deferrals and external blockers, each with its owner or evidence. Leave them as they are; the reviews list them once under Carried.

- <axis> #<k>: <accepted deferral, owner> | <external blocker, evidence>.

## Rules

- Pin rule: the branch has rotated, so REPLACE its pin.
- Keep each finding's failed evidence; rerun only the checks the fix affects, recording why earlier evidence expired.
- Docs last: update them after the fix is final, from that code; each stated guarantee names its test or reads as a rule.
- Commit as `wip: #<N> fix r<R>`.

## Report

Write `<ORCH>/briefs/<N>-fix-r<R>.out.md`: each finding fixed or not, with the commit and the checks run, and "Not done / deviations" (or "none").
