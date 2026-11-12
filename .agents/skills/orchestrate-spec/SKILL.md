---
name: orchestrate-spec
description: "Orchestrate a spec's tickets through workers under this project's overlay, from Claude Code or Codex."
disable-model-invocation: true
---

You have a spec, and the spec has tickets that describe how to implement it. You are the **orchestrator**: you plan, dispatch, merge and verify. **Workers** write the code.

The goal is the authorized launch outcome on the integration branch. Bound each slice by demonstrated dependencies and preserve the broader spec’s remaining acceptance under its original owners.

The tickets are a **task graph** with blocking relationships, not a list of steps. At any moment there is a **frontier** of tickets that are ready to start.

## Before you start

- **Issue tracker:** read `docs/agents/issue-tracker.md`. If it's missing, tell the user to run `/setup-matt-pocock-skills`.
- **Project overlay:** read `docs/agents/orchestration.md`; it wins over every step below. It decides how this project branches, lands, closes work, and which model plays which role.
- **Runtime:** read [`RUNTIMES.md`](RUNTIMES.md), the section for the runtime you're running in. It says how to dispatch a worker, wait for it, resume it and load a skill.

## Workers and contracts

Every worker gets a **brief** with pointers to the spec, tickets, research and commits. Before implementation it states the launch outcome, exact included behaviors/records, actual dependencies and evidence, excluded work/owners, shared-path behavior outside the selected set, testable completion criteria and one impact-based validation plan. Preserve supported behavior or explicitly refuse unsupported inputs; never create accidental calculable defaults. A worker returns a short report and saves anything long to the path its brief names. Keep both directions sparse; point at what already exists instead of restating it.

| Role | Does | Done when |
|---|---|---|
| **Explorer** | Reads the codebase and the external docs a ticket needs, and saves notes outside the repo. | The notes answer the brief's questions, with file and line pointers. |
| **Implementer** | Builds one ticket in its own worktree and branch, following the brief’s agreed test seams. | Every acceptance criterion is met or reported. The checks pass. The integration tip is merged into its branch. |
| **Merger** | Brings a finished branch onto the integration branch, the way the overlay says; the overlay's landing command replaces this role when it has one. | The integration branch contains the work and its checks pass. |
| **Reviewer** | Reviews a diff read-only from a review template (`docs/agents/orchestration/templates/review-*.md`); the `code-review` skill is not used here. | Every finding has file:line and is marked hard or judgement. |

## Steps

1. **Map the graph.** Read the agreed launch acceptance and needed tickets/dependency evidence. *Done when* each ready slice names a demonstrated launch contribution; whole-parent completion is not an implicit barrier.
2. **Explore** (optional). Dispatch an explorer for whatever the frontier tickets need. *Done when* each frontier ticket has the notes its implementer will need.
3. **Set up the integration branch.** Follow the overlay. Without an overlay, create the branch now, and open a draft PR after the first merge (a branch with no commits ahead of main can't open one), marked as closing the spec and its tickets.
4. **Dispatch implementers** for the frontier, one worktree and branch each. Each implementer confirms its worktree is based on the integration branch, and resets onto it if not. *Done when* every frontier ticket has a running implementer.
5. **Merge each finished branch.** Use a merger, or the overlay's landing command. *Done when* the integration branch contains the work and is green.
6. **Refill the frontier.** When a merge unblocks tickets, dispatch implementers for them. Repeat steps 4–6 within the authorized launch scope. *Done when* required slices are implemented and remaining broader work has owners.
7. **Review the bounded diff.** Obtain independent Standards and Spec reviews before landing. Fix rounds use fresh tasks carrying original acceptance, prior accepted identity/reports, findings/dispositions and exact delta. Review the delta, affected closure and requirement preservation; widen with evidence. *Done when* every relevant finding is resolved or explicitly accepted. Apply the overlay’s promotion evidence rules.
8. **Resolve the tickets.** Follow the overlay. Without an overlay, mark the draft PR ready, or close each ticket the way the tracker closes work, and report the integration branch.
9. **Clean up.** Remove every worker worktree and branch. *Done when* only the integration branch remains.
