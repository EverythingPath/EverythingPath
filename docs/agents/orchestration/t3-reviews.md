# T3 review evidence

Promotion reviews (which mark records `checked`) use the capture-owned v2 code-mode helper below. It calls the actual T3 tools and archives the original child message/run association; imported task JSON alone and uncorrelated v1 captures or bindings are rejected. Ordinary code Standards/Spec reviews need no promotion receipt. Receipts replace neither substantive review nor the checked landing gate.

**Bootstrap qualification:** the implementation has synthetic API fixtures, including temporary-repository promotions. The parent must qualify fresh actual execution with the current reviewer selection with pre-dispatch capture before any real checked-state promotion. Workers keep real records drafted until it passes. The binding policy and the evidence each binding keeps are in [T3 review evidence policy](../orchestration-reference/t3-review-evidence.md).

## Capture

Commit the reviewed checkout. Archive issue bodies and comments, source inputs and the complete review brief beneath shared `EP_ORCH`, with actual fetch times. Use a new absolute durable round directory outside disposable checkouts; it must not exist yet. Capture copies those inputs and snapshots every reviewable record's ID, payload and source hashes. The task template names the exact full reviewed SHA and the full initial review scope, or the exact correction delta plus affected closure, original acceptance, prior accepted identity/reports, findings/dispositions, responses and unresolved objections. Unchanged accepted ordinary code work remains usable; every promoted record still needs an explicit record verdict for its exact payload and sources. The task directs the child to the frozen inputs and names its full report destination.

Take the provider/model IDs and every effective option, including defaults and inheritance, from the selection resolved against `orchestrator_capabilities` once per session (Now in `open-decisions.md`); re-resolve only after a refused dispatch. Set all target options explicitly; an unsupported setting stops dispatch. Author identity is the locally declared provenance of the reviewed work, not inferred from the review model. Example config (replace paths, SHA, identities and timestamps):

```json
{
  "author": {
    "providerInstanceId": "codex",
    "model": "gpt-6.1-sol",
    "options": { "reasoningEffort": "high", "serviceTier": "default" }
  },
  "request": {
    "role": "review",
    "mode": "async",
    "isolation": "worktree",
    "title": "Issue N review round R",
    "task": "Read the reviewer role and archived brief/issue/source inputs in ROUND. Review frozen FULL_COMMIT_SHA. Confirm each selected record explicitly. Write the complete report to REPORT. Read-only; no nested work. Original acceptance, both prior reviews, author responses and unresolved findings are in BRIEF.",
    "target": {
      "providerInstanceId": "claudeAgent",
      "model": "claude-opus-5-5",
      "options": { "effort": "xhigh", "fastMode": false }
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

Omit `clientRequestId` and nonce: capture generates both and rejects caller-supplied keys. Capture reads the current caller thread through `t3_thread_configuration({})` and freezes `inputs.json`, numbered input copies, `reviewed-records.json`, `manifest.json` and complete `request.json`. The appended manifest names immutable inputs, author, reviewed SHA, nonce and outer request declarations. Keep the resulting task text unchanged.

## Execute through code mode

The following is runnable in this harness's `functions.exec`. Set `root` to the checkout containing this implementation, `dir` to the new durable round, and `config` to the config path. `root` is also the clean reviewed checkout for capture by default; pass `reviewedRoot` to capture a separate disposable fixture checkout while running the implementation from `root`. Use the shared capped wrapper for any heavy commands; this helper only performs bounded file/CLI operations and tool calls.

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

On the next tool step, load `run` the same way and execute:

```js
text(await run({ tools, root, dir, operation: 'dispatch' }));
```

The helper validates the frozen capture and current caller, calls `tools.mcp__t3_code__delegate_task(request)` with the exact request object, then saves **that call's** returned response. It reads actual `task_status` and reconstructs the original child user message with `t3_thread_read`; only a complete original message matching the [binding policy](../orchestration-reference/t3-review-evidence.md) produces `dispatch.json`. The frozen nonce-bearing request body remains unchanged. Nested MCP `isError` responses stop the operation even when the surrounding exec succeeds.

A queued missing/null original run leaves the capture unbound. When the original run exists, execute `operation: 'bind'`; it reuses the saved return and performs fresh status/message recovery. It never starts another child. A fast successful completion can bind immediately. A lost/unpersistable dispatch response leaves no binding: retain the failure and retry **operation: 'dispatch' on the same round**, with the frozen retry key. Never create a replacement capture to recover that call. An existing saved return is reused. If T3 or local persistence cannot recover it, stop and report the limitation; do not manually supply another task's response.

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
