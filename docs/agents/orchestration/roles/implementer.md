# Implementer

Start with [`common.md`](common.md) unless your prompt already contains it.

You implement the brief's bounded launch contribution in its recorded worktree. Confirm the support boundary before editing: included behaviors/records, actual dependencies, excluded owners and shared-path behavior outside the selection. Preserve supported behavior or explicitly refuse unsupported inputs. Follow the brief exactly.

- **Rules work:** research comes first. Read the research notes your brief points at, and use published content or homebrew a player can create in the app; never made-up cases.
- **Review states:** write every variant decision, held source and structure record as `drafted`, and name no reviewer for it. The orchestrator marks records `checked` from a cross-model review's receipt.
- **Test-first:** load the `tdd` skill (`.agents/skills/tdd/SKILL.md`) and work test-first at the seams the brief names. Match the surrounding code's style.
- **Checks:** follow the brief's impact-based plan, which names the commands and where evidence goes: `pnpm -s check:artifacts --base <task-base>`, typecheck, canonical lint and relevant tests, serially through `capped.sh`. Before reporting, also run the tests the change reaches, `pnpm -s test:affected --base <task-base> > $TMPDIR/affected.txt` then `xargs -r -a $TMPDIR/affected.txt pnpm test`, and `pnpm -s catalog:launch-inventory --check`; exit 3 from `test:affected` means it could not trace a changed path (a Vitest configuration input, a non-module file nothing names, a deletion), so say so and leave the full suite to the gate. `test:affected` is a best-effort check before review; the gate's full suite is the guarantee: it does not trace files a test reads or spawns through a computed path or a directory scan. Reuse results across an exact-tree squash; record why affected evidence expires. Report artifact growth and budget changes. The full suite is the landing gate's unless the brief asks for it.
- **Evidence:** durable reports and evidence go in the external task directory your brief names.
- **TMPDIR:** leave it in place when you're done; the orchestrator removes it with the worktree (`runbook.md` step 11).
- **Git:** commit only when the brief says so; then save work in progress as `wip:` commits.
- **Diagnosed failures:** repair ordinary implementation and test-fixture failures and rerun the affected checks in the same task, keeping the failed evidence. A live gate, resource or observer safety event stops the attempt: report it with its evidence for diagnosis.
- **Report:** Write the report to the path your brief names. Your final message is three lines: the path, the outcome in one line, what the orchestrator must do next. The report covers what the brief asks and ends with "Not done / deviations": every criterion, step or rule you did not meet or changed, with the reason, or "none".
