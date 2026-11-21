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
  cmd: 'node scripts/catalog/start-without-tsx-cache.mjs scripts/catalog/t3-review-bridge.ts --code-mode',
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
2. **The direct call**: read `<dir>/request.json` and call `delegate_task` directly with that object, unchanged, as its arguments: every field, `clientRequestId`, `title`, `isolation`, `mode` and `target` included. Never retype or edit it. Its `task` is the frozen task; the child's original message is the review prefix (`Act as the review sub-agent for this task.`, a blank line) followed by that task exactly. Keep the call's whole return as received. If the call fails or its return is lost before you have it, make the same call again with the same `request.json` object, whose frozen `clientRequestId` is the retry key; if T3 cannot give the return back, stop and report the limitation, and never assemble a return by hand or supply another task's.
3. **Bind**, in code mode, with that return as `returned` (JSON is a JavaScript literal):

   ```js
   const returned = /* the direct delegate_task return, exactly as received */;
   text(await run({ tools, root, dir, operation: 'bind', returned }));
   ```

   If the tool showed only its JSON text, pass that text parsed (the task object alone); the helper reads `structuredContent` when there is one and the object itself otherwise. A first real round confirms which shape the direct call returns (the synthetic tools assume the archived code-mode shape, below).

Bind applies five rules in order (`bindT3Dispatch` with `offerT3DispatchReturn` and `stageT3DispatchReturn` in `scripts/catalog/t3-review-evidence.ts`, the steps in `scripts/catalog/t3-review-code-mode.ts`; tests in `tests/catalog/t3-review-evidence.test.ts`):

1. **Validate the input:** bind refuses a nested MCP `isError` return, a return whose provider, model or any option differs from the captured target, a return not yet saved whose status is failed, cancelled or interrupted, a supplied return whose bytes as bind writes them differ from a saved `dispatch-return.json`, or with none supplied a saved one that is not the bytes bind writes for it, and, at the record step's raw entry point (`--bind-t3`), a status it cannot parse or one with no original-message reads.
2. **A completed round is refused:** when `completed.json` exists as bind starts, bind refuses and writes nothing.
3. **A repeat is success:** when, as bind starts, the saved return's bytes are the bytes bind writes for the one supplied and `dispatch.json` is an intact binding that names its hash (intact means byte-equal: the saved return must be the bytes bind writes for the supplied return, and `dispatch.json` the canonical form bind writes for what it parses to, final newline included), bind reports `{ bound: true }` before any T3 tool call and writes nothing.
4. **Any other binding is refused:** when `dispatch.json` exists and rule 3 does not apply (it binds another return, its bytes are not the canonical form, it is invalid, or another bind of the same return published it after this bind found no saved return), bind refuses and writes nothing.
5. **Live checks, then exclusive publication:** otherwise the code-mode bind checks the caller, the return's actual `task_status` (the same task, child thread and node, and the same original run when the return names one) and the original message read with `t3_thread_read` against the [binding policy](../orchestration-reference/t3-review-evidence.md), on the return and reads this attempt transported (below), then writes `dispatch-return.json` directly into the round with an exclusive create, which fails if the name exists (equal existing bytes carry on, different ones refuse), checks `completed.json` again, and writes `dispatch.json` the same way, where a failed create is success only if the binding there names this return's hash.

After any refusal, bind once more with the same return; a second refusal means the round is abandoned, unless it is one you wait out (below) or the round is completed. Bind creates no temporary file in a round, and nothing at any path derived from a round's path: its only writes there are the two exclusive creates of `dispatch-return.json` and `dispatch.json` inside the round, each setting the final mode (0444) on the open descriptor before the first byte, then writing the verified bytes, flushing and closing, never changing a mode, owner or time by path, and a completed round has both, so bind can no longer create, change or remove anything in a completed round's directory. A write interrupted part-way can leave a file short of the bytes bind writes, which fails closed: such a `dispatch-return.json` is not byte-equal to the supplied return and such a `dispatch.json` is not an intact binding, so bind declines, completion refuses that binding, and the round is abandoned. The return and the reads a bind attempt hands its later bridge steps outside the bounded payloads are transport files, each in a private directory that its bridge step makes with `mkdtemp` in the system temporary directory, once bind has checked the system temporary directory as every round command does (below); a later step reads only the directory it is handed in its own call (any other path is refused), and the attempt removes them, best effort: a failed removal, or a reply lost before the attempt learned the path, leaves the private directory behind, and nothing reads it. The direct call's `clientRequestId`, `title`, `isolation` and `mode` are not echoed by status or thread reads, so the helper cannot check them, and a changed one is not harmless: a changed `isolation` can bind a reviewer that ran in the wrong checkout, and a changed `clientRequestId` can start another eligible child that binds just as well. Pass `request.json` unchanged.

**Waiting.** A queued child with no original run yet is refused as `pending/unbound`. A running child binds when the status and original-message checks pass; while its status shows pending work (a question, an approval, child runs, a timed-out wait), bind refuses: wait, and bind again with the same `returned`. Wait for the same child, not a new one: follow the direct return's `next`. When it says completion wakes this thread, end the turn and continue on the wake; when you have to wait yourself, call `t3_thread_wait` directly with the return's `childThreadId` as `threadId` (on a timeout, its own `next` says whether to end the turn or call again). Then run bind again with the same `returned` (an unbound child), or `complete` (a bound child); do not call `delegate_task` again for it. A fast successful completion can bind immediately.

**Abandon the round** when bind refuses the same return a second time (not a refusal you wait out), as it does when `dispatch-return.json` holds a different return (or one short of the bytes bind writes, as an interrupted write leaves it) or the child failed, was cancelled or was interrupted before its binding was written, when completion refuses the bound child, or when the round is in any state these rules do not cover; leave its directory as it is and capture a new round (a new directory, nonce and retry key), then prepare, the direct call and bind on it.

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
node scripts/catalog/start-without-tsx-cache.mjs scripts/catalog-record-review.ts --t3-run "$EP_ORCH/runs/$RUN_ID" --ids "$IDS" --root "$WT"
node scripts/catalog/start-without-tsx-cache.mjs scripts/catalog-record-review.ts --verify --root "$WT"
```

Every round command (the record step's `--capture-t3`, `--bind-t3`, `--complete-t3`, `--t3-run` and `--verify`, and every bridge action) declines, naming `TMPDIR`, before it writes anything, a system temporary directory whose real path is, is inside or contains the round it operates on (the round directory it is given, capture's new one included; for `--verify`, each archive it verifies), and nothing is inferred from file names elsewhere (`requireTemporaryDirectoryOutside` in `scripts/catalog/t3-review-evidence.ts`). Containing covers the round's parent, where bind's transport directory would land beside the round. Start every round command through `scripts/catalog/start-without-tsx-cache.mjs`, as the loader above, the helper's bridge calls, the help and this repository's callers do: started without it, tsx writes its disk cache under the temporary directory before the command can check that directory. Started any other way, a round command still runs as before. Do not point `TMPDIR` at a round for any other program: only the round commands decline it.

`IDS` lists exactly the reviewed record IDs, one per line. Current HEAD must equal the reviewed commit at recording. Changed records/source hashes, invalid selections or formatter failures reject before any promotion/report/receipt write. Commit the resulting record/receipt/report files only after explicit verification. Curation prep and checked landing carry the actual branch, worktree and issue discriminator as the runbook describes.
