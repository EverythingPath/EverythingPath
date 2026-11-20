# T3 review evidence

Promotion reviews (which mark records `checked`) use the capture-owned v2 code-mode helper below. It calls the actual T3 tools code mode exposes, checks the operator's direct `delegate_task` return against them and archives the original child message/run association; imported task JSON alone and uncorrelated v1 captures or bindings are rejected. Ordinary code Standards/Spec reviews need no promotion receipt. Receipts replace neither substantive review nor the checked landing gate.

**Bootstrap qualification:** the implementation has synthetic API fixtures, including temporary-repository promotions. The parent must qualify fresh actual execution with the current reviewer selection with pre-dispatch capture before any real checked-state promotion. Workers keep real records drafted until it passes. The binding policy and the evidence each binding keeps are in [T3 review evidence policy](../orchestration-reference/t3-review-evidence.md).

## Capture

Commit the reviewed checkout. Archive issue bodies and comments, source inputs and the complete review brief beneath shared `EP_ORCH`, with actual fetch times. Use a new absolute durable round directory outside disposable checkouts; it must not exist yet. Capture copies those inputs and snapshots every reviewable record's ID, payload and source hashes. The task template names the exact full reviewed SHA and the full initial review scope, or the exact correction delta plus affected closure, original acceptance, prior accepted identity/reports, findings/dispositions, responses and unresolved objections. Unchanged accepted ordinary code work remains usable; every promoted record still needs an explicit record verdict for its exact payload and sources. The task directs the child to the frozen inputs and names its full report destination.

Take the provider/model IDs and every effective option, including defaults and inheritance, from the selection resolved against `orchestrator_capabilities` once per session (Now in `open-decisions.md`); re-resolve only after a refused dispatch. Set all target options explicitly; an unsupported setting stops dispatch. Author identity is the locally declared provenance of the reviewed work, not inferred from the review model. Example config, with the role table's implementation selection as the author and its review selection as `request.target` (replace paths, SHA, identities and timestamps):

```json
{
  "author": {
    "providerInstanceId": "claudeAgent",
    "model": "claude-opus-5-5",
    "options": { "effort": "high", "fastMode": false }
  },
  "request": {
    "role": "review",
    "mode": "async",
    "isolation": "worktree",
    "title": "Issue N review round R",
    "task": "Read the reviewer role and archived brief/issue/source inputs in ROUND. Review frozen FULL_COMMIT_SHA. Confirm each selected record explicitly. Write the complete report to REPORT. Read-only; no nested work. Original acceptance, both prior reviews, author responses and unresolved findings are in BRIEF.",
    "target": {
      "providerInstanceId": "codex",
      "model": "gpt-6.2-sol",
      "options": { "reasoningEffort": "xhigh", "serviceTier": "default" }
    }
  },
  "inputs": [
    {
      "kind": "issue",
      "identity": "github:AndreasUnunger/EverythingPath/issues/N body+comments",
      "fetchedAt": "2026-10-23T12:00:00.000Z",
      "path": "/absolute/shared/issue.json"
    },
    {
      "kind": "brief",
      "identity": "N review round R complete brief",
      "fetchedAt": "2026-10-23T12:00:00.000Z",
      "path": "/absolute/shared/review-brief.md"
    }
  ]
}
```

Omit `clientRequestId` and nonce: capture generates both and rejects caller-supplied keys. Capture reads the current caller thread through `t3_thread_configure({})`, its read form; the helper's tool type admits only `{}`, because `modelSelection` would set the caller's model (`tests/catalog/t3-review-evidence.test.ts` asserts the exact arguments). It freezes `inputs.json`, numbered input copies, `reviewed-records.json`, `manifest.json` and complete `request.json`. The appended manifest names immutable inputs, author, reviewed SHA, nonce and outer request declarations. Keep the resulting task text unchanged.

## Execute: prepare, the direct call, bind

Recorded 2026-11-20 in a Codex operator's session: code mode exposes `mcp__t3_code__t3_thread_configure`, `mcp__t3_code__task_status` and `mcp__t3_code__t3_thread_read`, but not `delegate_task`, which is only a direct call (`mcp__t3_code_direct.delegate_task`); the inventory is in `tests/fixtures/t3-code-mode-inventory/`. So the operator makes the dispatch call and the helper never does: it takes that call's return and accepts it only after checking it through the code-mode tools.

The helper is runnable in this harness's `functions.exec`. Set `root` to the checkout containing this implementation, `dir` to the new durable round, and `config` to the config path. `root` is also the clean reviewed checkout for capture by default; pass `reviewedRoot` to capture a separate disposable fixture checkout while running the implementation from `root`. Use the shared capped wrapper for any heavy commands; this helper only performs bounded file/CLI operations and tool calls. Load it and capture:

```js
const root = '/absolute/app/worktree';
const dir = '/absolute/shared/new-round';
const config = '/absolute/shared/review-config.json';
const source = await tools.exec_command({
  cmd: 'node --import tsx scripts/catalog/t3-review-bridge.ts --code-mode',
  workdir: root,
  max_output_tokens: 10000,
});
if (
  source.exit_code !== 0 ||
  source.session_id !== undefined ||
  (source.original_token_count ?? 0) > 10000
)
  throw Error('Incomplete helper read');
const run = new Function('return ' + source.output)();
text(await run({ tools, root, dir, config, operation: 'capture' }));
```

Then, in the thread that captured (the child's parent must be the captured caller), each step loading `run` the same way:

1. **Prepare**, in code mode: `text(await run({ tools, root, dir, operation: 'prepare' }));`. It validates the frozen capture, requires the current caller (`t3_thread_configure({})`) to be the captured one and the task to fit the original-message bound, and refuses once a dispatch return is saved. It returns `{ ready: true }` and starts nothing.
2. **The direct call**: read `<dir>/request.json` and call `delegate_task` directly with that object, unchanged, as its arguments: every field, `clientRequestId`, `title`, `isolation`, `mode` and `target` included. Never retype or edit it. Its `task` is the frozen task; the child's original message is the review prefix (`Act as the review sub-agent for this task.`, a blank line) followed by that task exactly. Keep the call's whole return as received.
3. **Bind**, in code mode, with that return as `returned` (JSON is a JavaScript literal):

   ```js
   const returned = /* the direct delegate_task return, exactly as received */;
   text(await run({ tools, root, dir, operation: 'bind', returned }));
   ```

   If the tool showed only its JSON text, pass that text parsed (the task object alone); the helper reads `structuredContent` when there is one and the object itself otherwise. A first real round confirms which shape the direct call returns (the synthetic tools assume the archived code-mode shape, below).

Bind refuses a nested MCP `isError` return before the bridge reads it. It hands the return to the bridge once, alone: the bridge refuses it unless its provider, model and every option equal the captured target and its status is not failed, cancelled or interrupted, and refuses a return that differs from a saved `dispatch-return.json`. A return it has not saved yet it keeps as `dispatch-return.pending.json`, which is never read as the saved return; a refused bind removes it, and one left behind is replaced by the next return handed over. So the status and original-message payloads are the ones the earlier helper sent, with no return in them, and stay within the bound they had then. Bind then reads actual `task_status` for the return's `taskId` and requires the same task, child thread and node, and the same original run when the return names one; and reconstructs the original child user message with `t3_thread_read`. Only a complete original message matching the [binding policy](../orchestration-reference/t3-review-evidence.md) (the captured caller's own child, its text the review prefix and the frozen nonce-bearing task) produces a binding: bind then publishes the return as `dispatch-return.json` and then the binding as `dispatch.json`, each written to a temporary name in the round and renamed, the binding last. A refused return leaves the round as it was, so the round's own return still binds afterwards: another task's return, the right task sent with a changed text, model or option, a child of another caller thread, or a return from another round (`tests/catalog/t3-review-evidence.test.ts`). Once a return is saved, bind refuses a different one. Bind again with the saved return is idempotent: an intact binding of it is success and nothing is written. The direct call's `clientRequestId`, `title`, `isolation` and `mode` are not echoed by status or thread reads, so the helper cannot check them, and a changed one is not harmless: a changed `isolation` can bind a reviewer that ran in the wrong checkout, and a changed `clientRequestId` can start another eligible child that binds just as well. Pass `request.json` unchanged.

**Waiting.** A queued child with no original run yet is refused as `pending/unbound` and nothing is saved; a running child binds, and completion comes later. Wait for the same child, never a new one: follow the direct return's `next`. When it says completion wakes this thread, end the turn and continue on the wake; when you have to wait yourself, call `t3_thread_wait` directly with the return's `childThreadId` as `threadId` (on a timeout, its own `next` says whether to end the turn or call again). Then run bind again with the same `returned` (a queued child), or `complete` (a bound child); never call `delegate_task` again for it. A fast successful completion can bind immediately.

**Recovery.** If the direct call fails or its return is lost before you have it, call `delegate_task` directly again with the same `request.json` object, whose frozen `clientRequestId` is the retry key. If bind fails while you hold the round's own return (a pending child, a failed write, a lost reply), run bind again with the same `returned`: an interrupted write left at most a temporary file, which bind replaces; a return published without its binding is the saved return, and bind writes the binding; a partial or invalid `dispatch.json` (from the earlier helper, which wrote in place) is replaced only after every check passes again, never in a completed round; and when the binding was written but its reply was lost, bind reports `{ bound: true }` and writes nothing. Never create a replacement capture to recover a call. If T3 cannot give the return back, stop and report the limitation; never assemble a return by hand or supply another task's.

When T3 renames or reshapes a tool the helper calls (`t3_thread_configure`, `task_status`, `t3_thread_read`) or the direct `delegate_task` whose return bind reads, change the helper's tool type and the synthetic tools in `tests/catalog/t3-code-mode-fixture.ts` from a recorded result of the new tool, check its fields against what the recorded rounds' archived evidence read, and qualify again before the next real promotion. The synthetic direct return has the shape of the archived code-mode `delegate_task` return in `$EP_ORCH/runs/t3-review-b9b390102ed6d3c97affa618747d99f5f5d908d77fabea28e6ad28636350f4b6/dispatch-return.json` (the task as JSON text in `content`, the same task as `structuredContent`, `isError: false`).

After T3 delivers completion, load the same helper and execute:

```js
text(
  await run({
    tools,
    root,
    dir,
    operation: 'complete',
    report: '/absolute/shared/full-report.md',
  }),
);
```

This reads actual task status and freezes full report bytes, terminal status and completion hashes. Original terminal success, required summary/transfer identity and no pending children/questions/approvals are mandatory. Later runs cannot replace the original result. Failures leave existing binding/report/receipt outputs unchanged. Move the completed directory, without changing its bytes, to `$EP_ORCH/runs/<returned runId>`; preserve the original-message observations there. Then:

```bash
node --import tsx scripts/catalog-record-review.ts --t3-run "$EP_ORCH/runs/$RUN_ID" --ids "$IDS" --root "$WT"
node --import tsx scripts/catalog-record-review.ts --verify --root "$WT"
```

`IDS` lists exactly the reviewed record IDs, one per line. Current HEAD must equal the reviewed commit at recording. Changed records/source hashes, invalid selections or formatter failures reject before any promotion/report/receipt write. Commit the resulting record/receipt/report files only after explicit verification. Curation prep and checked landing carry the actual branch, worktree and issue discriminator as the runbook describes.
