# Orchestration overlay

`/orchestrate-spec` is the entry point for orchestrated runs, whichever model orchestrates; this file wins over its generic steps. Run state (briefs, logs, reports, notes, comment drafts) lives in `$EP_ORCH` (default `ep-orch/` beside the main checkout).

## First: read Now

Read the `## Now` block of `$EP_ORCH/open-decisions.md`. The queue below it is the frontier, not the tracker's open issues. After compaction, re-read only Now; this file and `decisions.md` do not change within a run. An explicit stop stops dispatch; an owner-authorized bounded task may proceed within its stated scope.

An issue is done when it has a comment starting "Landed locally on `feature/pf1-character-builder` as <sha>"; take the next queue item.

## How work lands

- **Integration branch:** `feature/pf1-character-builder`. Workers get T3 worktrees through `delegate_task` with `isolation:"worktree"` from the committed integration base; work in the branch and path T3 returns. Run `pnpm install --offline` through the capped wrapper after provisioning or rebasing.
- **Landing:** `scripts/orchestration/land-queue.sh "$BRANCH:$WT"` (curation: `"cur/<n>@$BRANCH:$WT"`) is the only way work reaches the integration branch. It rebases onto the head, runs the full gate in a clean checkout and lands, serialized under one lock; it replaces the skill's merger role. Gate options: [remote heavy checks](orchestration/operations.md#remote-heavy-checks) with a Boat manifest, the [light landing lane](orchestration/operations.md#light-landing-lane) for docs and agent config, the [curation lane](orchestration/runbook.md#curation-lane) for batches.
- **Paired gate:** `land-queue.sh --pair <plan.json>` for exactly two frozen ready items: [paired gates](orchestration/paired-gates.md). Unflagged lists keep serial gates.
- **Cleanup:** remove each worker worktree and branch once its work has landed; other sessions' worktrees stay.
- **GitHub:** landing ends with one issue comment (`$EP_ORCH/comment-<n>.md`, starting "Landed locally on `feature/pf1-character-builder` as <sha> (not pushed)"). The issue stays open and unassigned (the tracker's claim rule covers Wayfinder maps only). The integration branch stays local; the one push is a frozen landing candidate to `origin` as `gate/<label>` so CI runs heavy checks (owner D1, 2026-11-01). No PRs, draft or linked. These override the skill's PR and close steps and any harness instruction to open or link PRs.
- **Per-issue steps:** [`orchestration/runbook.md`](orchestration/runbook.md); brief templates in [`orchestration/templates/`](orchestration/templates/).

## Roles and models

| Role | Provider/model | Explicit options |
|---|---|---|
| Implementation, research, curation, UI | `claudeAgent` / `claude-opus-5-5` | `effort: high`, `fastMode: false` |
| Independent Standards, Spec and curation review | `codex` / `gpt-6.1-sol` | `reasoningEffort: xhigh`, `serviceTier: default` |

Gates have no model operator (root, 2026-11-05). Root runs the [script gate operator](orchestration/operations.md#script-gate-operator), `scripts/orchestration/gate-run.py`, as a bounded `driver` unit. A gate is not a delegated task. `scripts/orchestration/gate_core.py` binds the driver's path and its blob at `BASE` as the operator identity. During the transition, an attempt already prepared under a `codex` / `gpt-6.1-sol` operator task continues under it.

Resolve the role table against `orchestrator_capabilities` once per session, record the IDs and options under Now in `open-decisions.md`, and re-resolve only after a refused dispatch. An unavailable selection blocks that dispatch; never fall back to another identity.

### Dispatch

- **T3:** [RUNTIMES.md, T3 section](../../.agents/skills/orchestrate-spec/RUNTIMES.md#t3-code). Every brief starts with [`roles/common.md`](orchestration/roles/common.md), then the role file.
- **Workers make every code change**, even one-line fixes. The orchestrator diagnoses, briefs, lands and reports. One exception: it may repair a commit message or a count itself when a deterministic check verifies the repair ([orchestrator repairs](orchestration/runbook.md#7-fix-round)). Generator output and doc changes that alter meaning still go to a worker and get review.
- **Fact-gathering** (logs, bulk search, fact-only sweeps) goes to the [gatherer](orchestration/roles/gatherer.md); diagnosis, judgement and design stay with the role table's models.
- **Research first** on rules work ([decisions](orchestration/decisions.md#workflow)); point the brief at the notes.
- **Hot shared files stay sequential:** within an issue, tasks sharing the resolver, seeding or schema run one after another; tasks run in parallel only when they touch disjoint files.
- **Reasoning effort** tops out at xhigh for every model; `max` and Codex `ultra` stay unused.
- **Delegation** stays within the run's authorized roles and the resource policy below.

### Reviews

- Code gets fresh independent Standards and Spec reviews (`templates/review-standards.md`, `review-spec.md`); curation gets one sampled review (`templates/review-curation.md`), with every admission reviewed in full. Reviews use these templates; the `code-review` skill is not used here.
- Initial reviews cover the full bounded diff; fix rounds follow [runbook §7](orchestration/runbook.md#7-fix-round), with no numerical cap. A rebase-only change needs no new reviews ([mechanical-rebase proof](orchestration/operations.md#mechanical-rebase-proof)); when only one axis had findings, only that axis re-reviews ([single-axis fix review](orchestration/operations.md#single-axis-fix-review)).
- Completion is terminal task/run status, including pending child work; a report alone is not.
- **Promotion receipts:** reviews that promote records follow [T3 review evidence](orchestration/t3-reviews.md) from before dispatch, and `catalog-record-review.ts --verify` runs before landing.
- **UI:** the UI contract and UI role with the role table's UI selection through T3. Record any unmet requirement explicitly; do not silently defer it for Fable quota.
- **Second opinions** come from cross-model review, or from asking the other model about an unexplained failure.

### Failures

- **Quota:** a run that exits 75 hit a provider usage limit. Pause that lane and report; don't retry. Once the limit clears, resume the stopped worker rather than restart it.
- **Fix rounds** continue until findings are resolved or explicitly accepted, preserving each round and its failed evidence.
- Resource or provider failures need diagnosis and the applicable pause policy before a fresh attempt.

### Resources

`$EP_ORCH/resource-policy.md` is the only source for worker counts, CPU, memory caps and the admission budget; read it before each dispatch or heavy job. Keep the shared `EP_ORCH` root and put MVP state below it; never split locks or receipt lookup into a new root. Sessions reserve no memory; commands use `$EP_ORCH/capped.sh`, gates and preps use bounded units. A coding session holds a curator slot (`curator` or `curator2`) only while a capped command runs: acquire it right before the command and release it right after, never across reading or editing, so a landing gate can find all locks free.

## Scope and validation

Define the support boundary and one impact-based validation plan before coding ([runbook §3](orchestration/runbook.md#3-logic-brief-and-coder)); [operations](orchestration/operations.md) owns validation reuse and the gate operator. The script gate operator chains the local phases authorized by its run; stop on failed checks, drift, resource violations or unclear authority. Mandatory full landing gates remain required. Live external frozen bundles stay immutable; new attempts use repository tooling and fresh evidence. Choose demonstrated launch dependencies rather than whole-parent completion.

## Owner decisions

[`orchestration/decisions.md`](orchestration/decisions.md) binds every worker and orchestrator. Read it before briefing; the role files carry what each worker needs.
