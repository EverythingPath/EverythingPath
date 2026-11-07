# Per-issue runbook (PRD #251)

One PRD #251 sub-issue, from pick-up to cleanup, then the curation lane: the order of work. The rules are in [`../orchestration.md`](../orchestration.md) and [`decisions.md`](decisions.md); dispatch, waiting and review rounds follow RUNTIMES.md (T3).

`<n>` is the issue number. `MAIN` is the main checkout, `WT` the returned T3 worktree, `BRANCH` its branch, `S=$MAIN/scripts/orchestration`, and `$EP_ORCH` the run directory (default `$MAIN/../ep-orch`). Briefs, logs, answers and comments live in `$EP_ORCH`; templates in [`templates/`](templates/).

Answer progress questions from `pnpm -s mvp:status`. A worker is running only if `task_status` says so now.

## 1. Pick the issue

At the start of each step, list `$EP_ORCH/notes/`: cross-thread coordination arrives there as `notes/<from>-<yyyymmdd-hhmm>.md`, and `t3_thread_send` into the orchestrator is reserved for a stop.

Read Now and the queue, then the issue and its dependency links. Identify the agreed launch outcome and the smallest demonstrated dependency slice; whole-parent or source-phase completion counts only when evidence makes it an actual dependency. Excluded acceptance stays with its owner. **Done:** the brief names the launch outcome, needed slice/dependencies and evidence, with no unresolved dependency needed by that slice.

## 2. Worktree

Dispatch through T3 (RUNTIMES.md) with the role table's implementation selection and `isolation:"worktree"` from the committed integration base; record and verify the returned branch, path, provider, model and options. The brief passes the shared `EP_ORCH`, the curator-slot rule, the task TMPDIR and the capped-command instructions. **Done:** the app worktree is on the expected branch/base, offline dependencies are installed and only `.env.example` exists.

## 3. Logic brief and coder

Write `$EP_ORCH/briefs/<n>.md`, starting with `roles/common.md` and `roles/implementer.md`. It covers:
- **Sources:** the ticket, and the PRD #251 search terms plus acceptance appendix. Name the #201–#250 decisions that apply (later ones override earlier ones), and the repo docs (`docs/character-sheet/<section>.md` rather than the whole data-model index).
- **Build on:** the landed issues to build on.
- **Support boundary:** launch outcome; exact included records/behaviors and testable criteria; actual dependencies with evidence; excluded work, its owners and remaining acceptance. For each shared path, state behavior for inputs outside the selected set: preserve supported behavior or explicitly refuse unsupported inputs. No accidental calculable defaults.
- **Validation plan:** select checks once from impact, with canonical package commands/heap flags, required full queue validation and local browser/codegen conditions. Record the plan and each check with [validation evidence](operations.md#validation-evidence) (immutable results, tested/dependency/environment/tooling identity and invalidation reasons), recording canonical commands, results and evidence references once, and name that section in the brief.
- **Writers:** Write Gate and writer inventory.
- **Pin rule:** rotate once, or replace the pin if the branch has already rotated.
- **UI contract:** the path for it, `briefs/<n>-ui-contract.md`. The coder writes the contract; the UI role may implement it in the same task or a separately scoped T3 task.
- **Process:** test-first, `wip:` commits, the exact check commands, the report path, and a report of at most 300 words ending with "Not done / deviations".

Launch the implementer through T3 as in step 2, with the full durable brief and explicit options. **Done:** its completed result lists every criterion and the checks pass.

## 4. UI

When there is a UI contract, fill the support boundary and validation plan (step 3) into the brief, then brief the UI role with `templates/ui-brief-common.md`, the contract and the prototype references. Record any unmet UI requirement explicitly; do not silently defer it for Fable quota. Keep component and visual proof scoped to the brief and the backend local-only. **Done:** component tests and required visual checks pass, only `.env.example` remains, and changes are committed as `wip: #<n> UI` when the brief authorizes it.

## 5. Codegen

If Convex functions or the schema changed: `$S/codegen.sh $WT`, then commit `convex/_generated/api.d.ts`. **Done:** the script prints no env-file warning, and `git status` in WT is clean.

## 6. Reviews

Before dispatch, disposition each line of the implementation report's "Not done / deviations": `fix`, `accepted deferral` (with its owner) or `external blocker` (with evidence). A `fix` line goes back to the implementer first.

Then run the checks in the worktree at the frozen commit, serially through `capped.sh`: `pnpm -s test:affected --base <BASE> > $TMPDIR/affected.txt`, `xargs -r -a $TMPDIR/affected.txt pnpm test`, and `pnpm -s catalog:launch-inventory --check`. Exit 3 from `test:affected` names a changed path it could not trace (a Vitest configuration input, a non-module file nothing names, a deletion); that slice's full suite is the gate's. `test:affected` is a best-effort check before review; the gate's full suite is the guarantee: it does not trace files a test reads or spawns through a computed path or a directory scan. A failure goes back to the implementer as a fix round, without reviews.

Fill `templates/review-standards.md` and `templates/review-spec.md` into `$EP_ORCH/briefs/<n>-review-standards.md` and `-spec.md`, with `<WT>`, `<N>`, `<ORCH>` = `$EP_ORCH`, `<BASE>` = `git -C $WT merge-base HEAD feature/pf1-character-builder`, and the dispositioned deferrals under Carried. Dispatch fresh independent read-only review tasks with the role table's review selection and the frozen commit. Give each the reviewer role, archived issue bodies/comments with fetch times, the durable brief and the report path. Keep task IDs and terminal results. Reviews that promote records use [T3 review evidence](t3-reviews.md) **before dispatch**.

**Push at review freeze** ([CI at review freeze](decisions.md#workflow), owner 2026-11-04). When the slice will gate with `remoteChecks`, push the commit frozen for review and start its CI watch (step 10, items 1–3) when you dispatch the reviews, so CI runs while they do. The run is speculative: only green CI on the exact final tree authorizes landing, and pending or failed speculative CI never does. Its evidence is stale after any tree change, any fix round and any rebase onto a moved base; each needs a fresh push and run. `gate-push.sh` never forces, so a changed tree takes a new label (for example `<label>-r2`). The light lane and pairs take no `remoteChecks`, so they have no push at review freeze.

**Done:** both reports and completed task results cover the full bounded diff at the frozen identity, including shared-path regressions and necessary dependencies outside the edited files; unrelated broader acceptance stays with its owner.

## 7. Fix round

Fill [`templates/fix-brief.md`](templates/fix-brief.md) into `briefs/<n>-fix.md`, combining both reviews. Disposition every finding: `fix`, `accepted deferral` with a reason, or `external blocker` with evidence. Accepted items go into the issue comment. The pin rule repeats: the branch has rotated, so REPLACE its pin. Dispatch the implementer again with the brief (a new task that points at its previous report). Failures follow [Authorization and failures](decisions.md#workflow): a diagnosed implementation or fixture failure does not force a new worker or parent permission handshake, and live gate, resource or observer safety events stop that attempt for diagnosis. Preserve them all. There is no fix-round cap.

**Conditional LAND** ([decision](decisions.md#workflow), owner 2026-11-04). A review that answers "LAND once X is fixed" with a machine-checkable X, such as a stale count or a commit message, needs no further review round. The repair is X and nothing more. The orchestrator verifies X mechanically at the repaired commit: it recomputes the count from git or the data, or reads the message with `git log -1 --format=%B`. Then it records the check (command, output, commit) with that finding's disposition in `briefs/<n>-fix.md`. If X is not machine-checkable, or the fix goes beyond X, the slice gets an ordinary fix-round review below, and the single-axis rule applies. A repair that changes the tree makes earlier CI evidence stale (step 6); one that changes only a message does not.

- **Orchestrator repairs** (recommendation 7, root 2026-11-05): the orchestrator may make the repair itself, without a worker, when X is a commit message or a count and a deterministic check verifies it: the count recomputed from git or the data, the message read back. It commits the repair (or amends E) and records the check as above. Generator output, and any doc change that alters meaning, go to a worker and get review.
- **Landing message** (`preparation.message`): a repair there leaves `REVIEWED` and `TREE` unchanged, so it needs no binding.
- **Reviewed commit changed** (a count edit, or a curation prep commit's message): the gate spec carries `conditional_land` ([conditional LAND binding](operations.md#conditional-land-binding)). It names the axes that reviewed E, E and its tree, the exact `paths` and `message` of the repair, inside the scope the reviewers' conditional files permit: only `<axis>-conditional.json`, bound by hash in the review entry (`brief.py` adds it when the file exists), grants scope; report text never does. Root writes the attestation with the recorded check at `REVIEWED`. Repair either with new commits after E or by amending E in place (`git commit --amend`, the curation case). The gate refuses a delta wider or narrower than the named paths or message, so anything more is an ordinary fix round.

Each fix-round review is a fresh independent task with a new stable request ID: the axis's review template with [`templates/review-fix-round.md`](templates/review-fix-round.md) filled in at its end (original acceptance, prior accepted commit/tree and reports, findings and dispositions, responses, unresolved objections, the exact delta). It reviews the delta and its affected closure and widens only with evidence; unchanged accepted work stays accepted. **Done:** every item is reported as done or skipped with a reason.

**Rebase-only change.** When the only change since the accepted reviews is a rebase onto a moved base, run `python3 -B $S/rebase-proof.py $WT <accepted review base> <accepted commit> <current base>` with full SHAs. On PASS there are no new reviews: `gate.json` carries the printed `rebaseProof` and an archive ref keeps the accepted commit reachable ([mechanical-rebase proof](operations.md#mechanical-rebase-proof)). On FAIL, run full independent reviews of the rebased head.

**Single-axis fix round.** When only one axis had findings, only that axis re-reviews the delta `E..H` (E is the commit the other axis accepted; its report names the full-SHA delta), and root writes the attestation, or sends a fix broader than the findings to both axes: [single-axis fix review](operations.md#single-axis-fix-review). Fix first, rebase last.

**Record the review (drafted to checked).** Variant decisions, held sources and structure records are written `drafted`; only the orchestrator marks one `checked`, from a review's receipt. Bootstrap authentic qualification ([T3 review evidence](t3-reviews.md)) remains parent-owned; keep real records drafted until it passes. Promoting a record: follow [record review](../orchestration-reference/record-review.md). **Done:** every checked record has a receipt, and `tests/catalog/review-receipts.test.ts` passes.

## 8. Squash and finish

Freeze the reviewed commit/tree and prepare one landing commit through the [gate operator](operations.md#gate-operator), keeping the unsquashed history and exact tree mapping. The [script gate operator](operations.md#script-gate-operator) does this as its `prepare` stage (step 10); root writes the gate spec and no `gate.json` by hand. An already prepared tree resumes from its mapping without another squash. A squash that changes only the commit SHA reruns nothing ([validation evidence](operations.md#validation-evidence) says what invalidates a receipt). `catalog:pin`, writer checks and the impact plan's other checks need successful evidence. **Done:** the landing candidate is clean, the mapping and applicable evidence verify, and required checks passed; the full landing queue still runs on the exact candidate.

## 9. Browser gate

The queue runs `$S/e2e-branch.sh $WT --preflight --backend local` with its single local-preflight retry. Run required full or focused journeys against disposable local Convex with `--backend local`; `e2e/README.md` lists the commands. A reused preparation (`--reuse`, exit 5) is diagnostic evidence only; qualification needs a fresh run. **Done:** required journeys and the local preflight pass. Cloud preview recreation needs separate owner authorization.

## 10. Land

The implementer's task has ended by now; it is not kept alive through the gate. If the gate needs a fix, dispatch a new implementer task with the gate result.

**Heavy checks in CI** (owner D1), for a single item squashed on its base:

1. Push the candidate's tree, and nothing else: `GATE=$(scripts/orchestration/gate-push.sh <REVIEWED> <BASE> <label>)` from the main checkout (full SHAs, `<label>` in `[a-z0-9-]+`). It pushes a parentless commit of `REVIEWED`'s tree, with `Gate-Reviewed`, `Gate-Base` and `Gate-Tree` trailers, as `gate/<label>` only, and prints it; it refuses a set `GIT_CONFIG` (`git push` ignores it), a dirty worktree (untracked files included), `REVIEWED` not on `BASE`, an `origin` without exactly one well-formed push URL (or one a `url.<base>.insteadOf` rewrite or a remote named by it could redirect; it pushes to that URL) or a file of 100 MB or more. Never push the integration history.
2. Watch the run once: `RUN=$(gh run list --branch gate/<label> --json databaseId,headSha --jq '.[] | select(.headSha=="'"$GATE"'") | .databaseId')`, then `gh run watch "$RUN" --exit-status` in root's own background shell, holding no lock (a `bounded.sh` watch held `resource.lock` and 12 GiB of budget for the whole run and starved a worker's lint on 2026-11-03). The run's summary names the `runId`.
3. Fetch: `scripts/orchestration/remote-fetch.sh <runId>` publishes `$EP_ORCH/remote-checks/<runId>/` read-only and prints the sha256 for `gate.json` `remoteChecks`.
4. Gate as below. A failed run or a refused fetch blocks landing. CI has no host sources, so the tests in `scripts/orchestration/host-audits.json` skip there; the gate host runs them (`replace`: the queue's host-audit stage; `compare`: the local suite), as in [remote heavy checks](../orchestration-reference/gate-modes.md#remote-heavy-checks). A CI skip outside that list refuses the manifest.
5. Gate right after the CI run: any landing in between changes the tree on rebase and makes the CI evidence stale (2026-11-03).

CI evidence counts only for the exact final tree. Any tree change, fix round or rebase onto a moved base makes it stale, and so does a push at review freeze (step 6) whose tree later changed. Each needs a fresh push and run before the gate (owner 2026-11-04). CI from before a rebase is never accepted. A run pushed at review freeze whose tree is still the exact final tree is used as is: skip to item 3.

Before writing `gate.json`, check that every conditional LAND (step 7) has its recorded check at the commit being gated.

**Pause every worker for every gate, replace mode included.** From the prelaunch samples until the gate unit ends, no worker starts a capped command: send each running worker HOLD and, afterwards, RESUME. The reason is the gate operator. It requires idle memory admission at prepare and submit (`admission_idle` in `gate_operator.py`) and takes `resource.lock`, `curator.lock` and `curator2.lock` without waiting, while a worker's capped command holds a curator slot. Q2 attempt 2 (2026-11-03, `replace` mode) refused in prepare with EAGAIN after a worker's capped command was admitted between the last idle sample and prepare. That is consistent with lock contention, though the refusal named no holder. A replace-gate concurrency design (`speed-replace-concurrency`) may retire this rule; until then it binds.

Qualification follows [remote heavy checks](operations.md#remote-heavy-checks): Q1 is `mode: compare` on the next landing, and Q2 is `replace` once Q1 passes.

**Run the gate** with the [script gate operator](operations.md#script-gate-operator); a gate is not a delegated task:

1. Write the spec: `$EP_ORCH/scripts/brief.py ITEM gate ROUND --label <label> --review-round <n>` (mode fields through `--extra`: `prepared`, `rebase_proof`, `carried_review`, `conditional_land`, `remote`, `lane`). Re-check the spec's SHAs against the reviewed head and the integration head.
2. Start it after the HOLDs below: `BOUNDED_WAIT=1 $EP_ORCH/bounded.sh --detach <label> driver <spec.json>`.
3. Wait: `$S/await.sh <id>` in a background shell, then read the spec's `result` (`.md` and `.json`). Exit 0 is landed and completed. Any stop exits 1 with its reason; diagnose it before a fresh attempt. On the same base, write the next attempt's spec with `brief.py ITEM gate N --label <label> --retry-of <prior spec>`, which runs `gate_config.py retry`. It keeps REVIEWED, the archive and the reviews, and takes `prepared` from the result's `preparedRetry`, or squashes the same REVIEWED again when that is null ([retry after a stop](operations.md#script-gate-operator)). When the driver ended without a result, build the retry by hand ([retry after an interrupted driver](operations.md#script-gate-operator)).
4. To stop: `python3 -B "$MAIN/scripts/orchestration/gate-run.py" --stop <spec.json>` (the attempt's control becomes `stopped`; after publication it prints `already finished: <verdict>` and changes nothing), or stop the driver unit.

Candidates prepared under a codex operator configuration continue through that same operator for this transition only ([codex operator (transition)](operations.md#script-gate-operator)):

```bash
export GATE_CONFIG=/absolute/ep-orch/run/gate.json
python3 -B "$S/gate-operator.py" prepare
GATE_ENTRY=$(python3 -B "$S/gate-operator.py" runtime)
python3 -B "$GATE_ENTRY" resume  # same frozen runtime and saved invocation
```

The driver records `$GATE_ENTRY` as `gate-entry.txt` in the inputs. Retain it before launch and use it for every later command, even when the checked fast-forward replaces MAIN's operator files. An initial `run` may chain preparation directly and re-executes the frozen entry; its stable re-entry path is `attempt/operator-runtime/gate-operator.py`. `run` and `resume` invoke the canonical queue with continuous observation and terminal collection. Do not bypass that configured operation with a direct queue call; the separately authorized legacy landing CLI is in RUNTIMES.md (Legacy landing CLI), and pairs use their specialized procedure.

The queue is the only way to land: under `$EP_ORCH/land.lock` it rebases onto the current head (a non-data conflict aborts), reinstalls, runs the writer check (a curation batch runs or reuses its prep), then `cur-land.sh`: codegen, pin, typecheck, lint, the full suite via `triage-failures.sh` in a clean `../ep-gate-*` checkout under `heavy.lock`, the E2E preflight and `land.sh`. It requires exact original-suite all-green and rejects every failed-suite verdict; canonical triage diagnostics and the single local-preflight retry remain. A Boat manifest follows [remote heavy checks](operations.md#remote-heavy-checks); pairs always run the full local gate. Logs: `$EP_ORCH/logs/impl-<n>-<stamp>-<stage>.log` and `logs/queue-<stamp>/`. After a diagnosed fix and renewed reviews, queue a fresh full gate and keep the failed evidence.

A candidate that changes only docs or agent config (`.claude/agents/*.md`, `.claude/settings.json`, or literal `.claude/` lines in `.gitignore`) may carry `lane` ([light landing lane](operations.md#light-landing-lane)). Paste the `lane` from `light_lane.py check`; a FAIL means the full gate. A light-check failure is a fix round.

For two ready reviewed items, use the opt-in [paired gate workflow](paired-gates.md). It freezes the base/inputs, stages on queue-owned scratch, stops before gating when review scope changes, then runs one strict combined gate and one checked FF. It emits an ordered split plan on failure; current diagnosis-before-retry policy defers automatic split execution. Single items and unflagged lists retain serial per-item gates; every landing path requires exact original-suite all-green. Changed canonical scripts need fresh qualification; earlier frozen-snapshot receipts do not qualify them.

Edit no script under `scripts/orchestration/` while a job runs it; the queue runs snapshots.

If `land.sh` exits 2 (logs/…-land.log), the branch overlaps the owner's uncommitted files: follow [owner-file overlap](../orchestration-reference/recovery.md). **Done:** the feature head is the squashed commit, and the owner's `git status` is unchanged.

## 11. Comment and clean up

Write `$EP_ORCH/comment-<n>.md`. Start with "Landed locally on `feature/pf1-character-builder` as <sha> (not pushed)", then cover:
- what's in, with cited CRB pages;
- the successful checks and exact original-suite result; LOAD/NEW or other failed verdicts stay linked failed history, never passed landing evidence;
- which model reviewed it, and any explicitly unmet UI requirement;
- known gaps and accepted deviations.

Post it with `gh issue comment <n> --body-file comment-<n>.md`. Write the `pnpm -s mvp:status` total line into Now at every landing. Remove only this task's worktree and branch (app-owned cleanup where available) and its `~/repos/everythingpath/.ep-tmp/<task>` scratch; other T3 worktrees stay. Add new follow-ups and slow tests to `open-decisions.md`. **Done:** the comment URL is printed, the worktree is gone, and the follow-ups are recorded.

Then take the next issue, or stop if the user said to.

## Chaining heavy jobs

Heavy jobs (prep, landing queues, curator runs) run as systemd units through the run directory's `bounded.sh`; caps and the budget are in `$EP_ORCH/resource-policy.md`. Chain them through invocation ids and receipts, never through a background shell that polls a log:

1. **Start:** `BOUNDED_WAIT=1 $EP_ORCH/bounded.sh --detach <label> command|gate|role <args...>`. It prints `unit: ...; log: ...; id: <id>` and returns once the unit has started. `BOUNDED_WAIT=1` makes the unit queue for its locks instead of exiting 73; `BOUNDED_WAIT_TIMEOUT=<seconds>` bounds the queue. Queued jobs take a freed lock one at a time, in no fixed order.
2. **Wait:** one `$S/await.sh <id> --timeout <seconds>` in a background shell. It prints `<id> <exit code> <log> <outcome>` from `$EP_ORCH/bounded/<id>/receipt.json`, with `outcome` one of `ok`, `failed`, `lockRefused`, `oom`, `killed` or `submitFailed` (the unit never started). The unit writes the receipt however it stops, so a waiter that dies, times out (exit 124) or starts late calls `await.sh` again; without a receipt it reports the unit's systemd state, or `<id> lost <log>`. Never wait on a label, or on the legacy `logs/bounded-*-<label>.exit` files: every run of a label overwrites them, and `await.sh` refuses a label.
3. **Next step:** the operator proceeds through already authorized phases only after an `ok` receipt with exit 0 and matching identity. Every other outcome stops the chain; diagnose and keep the failure before a fresh attempt. OOM never triggers an automatic retry or higher caps.
4. **Cancel:** `systemctl --user stop ep-fresh-<id>`, queued or running; its receipt says `killed`.

Lock order is `resource.lock`, `curator.lock`, `curator2.lock`, then queue-owned `land.lock` and suite-owned `heavy.lock`. Wrapper opt-in resource settings are not scheduling authority; keep every cap and admission threshold.

**Memory admission.** Each heavy command reserves memory for its class and waits until the reservations fit the budget; model sessions reserve none. How classes and reservations are computed: [memory admission](../orchestration-reference/memory-admission.md).
- **See why a job waits:** `$S/admission.sh status` prints the reserved total and every active and queued reservation; `$EP_ORCH/admission/events.log` has the history. A waiting unit's log, and a waiting `capped.sh`'s stderr, say `waiting for memory: ...`.
- **Cancel a queued wait:** stop the unit (as above), or `$S/admission.sh cancel <id>` for a `capped.sh` command or a bounded job still queued for its locks or memory (exit 143, `killed`; the job lets go of any locks it took). `BOUNDED_WAIT_TIMEOUT` bounds the wait (exit 73, `lockRefused`).
- **Waiting from a model session:** a queued `capped.sh` can outlast the Bash tool's 10-minute ceiling (a full gate takes 45–55 minutes: 45 min 50 s and 53 min 14 s on 2026-11-05). Run it in the background (`run_in_background`, or Codex's equivalent) and wait for its completion notice; don't loop on a foreground call. Before retrying, end the old one with `$S/admission.sh cancel <id>` (the id is in its `waiting for memory:` line or `admission.sh status`) or TERM/INT to it (exit 143); killing only the caller's shell can leave the waiter queued.
- **Caps and the budget stay fixed to get a job admitted.** A seed changes only with a new measurement and its source; the budget only with the owner.

## Curation lane

One curation batch `<n>` in its T3 worktree and branch, keeping `<n>` as its mode and receipt discriminator. Read the resource policy before any job.

Prep and landing take the app-owned target: `$S/cur-prep.sh --branch "$BRANCH" --worktree "$WT" <n> <message-file>` (both flags together) and `$S/land-queue.sh "cur/<n>@$BRANCH:$WT"` (also with `--dry-run`). Targets are registered worktree roots in the integration repository, on the exact branch, outside main, with shared integration history; prep rebases and verifies the current integration base. A curation item is always queued as `cur/<n>@…`, never as an ordinary code item. Specialized checks, post-rebase count and full landing gate remain the same. Receipts bind branch and path; a move or rename invalidates them.

1. **Curate.** Fill the support boundary and validation plan (step 3) into the brief, then dispatch the curator role with the content or notice template through T3 `isolation:"worktree"`, passing the shared locks, the read-only pinned-source guard and the capped-command rule. Check the pinned sources' write bits (`find ~/repos/everythingpath/sources -perm /a=w -print -quit` prints nothing); stop on writable sources (`chmod -R a-w` them first). Keep the returned path as `WT`, branch as `BRANCH`, issue as `<n>` and the answer report, and carry that tuple through prep, review and landing. The curator leaves its changes uncommitted; the orchestrator does all git work. **Done:** `answers/curation-<n>.md` exists and reports every check.
2. **Prep.** Write `briefs/cur-<n>-msg.txt` (title "Curate <family>, batch <k> (#<n>)", a body, the Co-Authored-By trailer), then run `$S/cur-prep.sh --branch "$BRANCH" --worktree "$WT" <n> "$EP_ORCH/briefs/cur-<n>-msg.txt"` as a `gate` job: [Chaining heavy jobs](#chaining-heavy-jobs). The orchestrator commits and rebases only through this script. It commits, rebases onto the feature head with the data-file merge, and fills the report's `prep:shared-store-count` block from git, amending the commit (a report without the block gets a printed count and a warning). Then it runs the format check, `catalog:notice-deps` and the light test plan it prints, or the full plan when the diff reaches beyond the batch; the console gets a summary and the Vitest log path. On success it writes `$EP_ORCH/logs/cur-<n>-prep.receipt`, which the landing queue reuses while the commit, tree, base, lockfile, prep scripts, test environment and check configuration are unchanged and the worktree is clean; any rebase, amend or edit invalidates it, and exit 5 means something moved during the checks. Which tests the light and full plans run, and what the receipt binds: [curation prep](../orchestration-reference/curation-prep.md). **Done:** it exits 0, the batch is the top commit of its recorded branch and the receipt path is printed.
3. **Review.** One sampled curation review with the role table's review selection through T3, from `templates/review-curation.md` filled into `briefs/curation-<n>-review.md` with the actual `BRANCH`, `WT` and issue. Promotion reviews require the pre-dispatch v2 workflow and authentic bootstrap qualification in [T3 evidence](t3-reviews.md).
   - **notice** and **content** batches use the template as it is.
   - **admission:** when the batch admits anything, add an "Extra" section naming every admitted record and asking for each one's evidence, content fingerprint, notice chain and resolver output to be checked in full.

   **Done:** `briefs/curation-<n>-review.out.md` has a verdict. On "fix first", brief a fix run, invalidate affected prep evidence, then review the delta and affected closure as in step 7.
4. **Land.** Plan with `$S/land-queue.sh --dry-run "cur/<n>@$BRANCH:$WT"`, then run `$S/land-queue.sh "cur/<n>@$BRANCH:$WT"` (step 10). It prints `prep <n> reused: receipt ...` when the reviewed commit is still on the current feature head, or why not (`commit changed`, `base changed`, ...) and preps again. **Done:** the feature head contains the batch.
5. **Comment.** Write and post `comment-<n>.md` as in step 11, with the disposition counts, the holds and the reviewer's verdict, then remove only the owned worktree and recorded branch. **Done:** the comment URL is printed and the worktree is gone.
