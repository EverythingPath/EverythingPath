# Standards review brief (PRD #251 run)

**Review scope:** the full declared support boundary, unless a fix-round section at the end of this brief narrows it. Broader unfinished acceptance stays with its owner unless a launch dependency or regression is demonstrated.

For an initial review, use `git -C <WT> diff <BASE>...<COMMIT>` and `git -C <WT> log <BASE>..<COMMIT> --oneline`. Review exactly `<COMMIT>`.

Read the relevant parts of these sources:
- `<WT>/docs/standards.md`, and the Real-Time Collaboration Contract in `<WT>/docs/product/militia-board.md` for militia sync
- `<WT>/.claude/skills/deslop/style.md`
- `<WT>/.claude/skills/typescript-best-practices/`
- `<WT>/.claude/skills/codebase-design/SKILL.md`
- `<WT>/GLOSSARY.md`, the glossary
- `<WT>/convex/_generated/ai/guidelines.md`, for Convex code
- `<WT>/docs/agents/generated-artifacts.md`, when generated artifacts or their budgets change
- the conventions of the code around each change

For generated artifacts, judge whether repeated information can be referenced or generated on demand, and accept or reject each budget disposition; the gate verifies validation receipts, hashes and sizes. Correct decoded data alone does not establish an acceptable storage design.

Baseline smells, all judgement calls; a documented repo standard overrides them: Mysterious Name, Duplicated Code, Feature Envy, Data Clumps, Primitive Obsession, High Cyclomatic Complexity (more than 10 paths; Python, shell and JavaScript only, since lint measures TypeScript), Repeated Switches, Shotgun Surgery, Divergent Change, Speculative Generality, Message Chains, Middle Man. Lint enforces positional parameters (`max-params`), cyclomatic complexity in TypeScript (`complexity`), more than one component per file (`react/no-multi-comp`), tests bound to their environment (the `test-hygiene` block) and `toThrow()` without a message (`vitest/require-to-throw-message`), so they are not reviewer duties; don't report them.

Report, by file and hunk:
- (a) every place the diff breaks a documented standard, citing the source file and rule;
- (b) every baseline smell you spot.

Convex index names follow `by_a_and_b`, except that a name may abbreviate or drop `_and_` when the full name would exceed Convex's 64-character limit; don't flag those. Mark each finding as a hard violation or a judgement call. Skip anything that tsc, eslint or knip already enforce. Number the findings, and keep the report under 400 words. Round 1 covers the whole change and every changed doc line; fix rounds are delta-only; the verdict rule is the reviewer role's. Threat model for a guard, scanner, validator or safeguard: <THREAT_MODEL> (default: the Guards rule in `roles/common.md`). Parent-disposed deferrals appear once under Carried, never as findings.

When the acceptance carries an acceptance table (tooling and guard work), it is the contract for this review and its delta reviews: name the row a blocking finding breaks, raise nothing the table lists as not required, except where that entry contradicts a safety requirement or a required refusal from the authorization or the owner: then that contradiction is the finding; and mark a case it does not decide **contract gap**.

**Severity.** A wording finding (a comment, a title, a doc line, a rationale, the landing message) is a hard violation only when you state the incorrect behaviour it attributes to the code or the wrong operational decision a maintainer could take from it; otherwise it is a follow-up. A false statement in an operational doc (a runbook, an exit-code table, a safety statement, a held list) stays a hard violation.

**Verdict.** Only hard violations make FIX FIRST; list judgement calls under Follow-ups. When every hard violation has a machine-checkable repair X, answer "LAND once X is fixed", not FIX FIRST. Machine-checkable: a deterministic check establishes its correctness (a count recomputed by a named command, a commit message equal to a named file, a renamed test title matched by the test run). A changed operational claim (an exit-code table, a safety statement, a runbook step) is never machine-checkable by matching its text: it is reviewed, so FIX FIRST, as is a repair that changes behaviour, a test's logic or generated output. When X changes repo paths or the reviewed commit's own message, also write the conditional file your brief names (`<axis>-conditional.json` beside your report), a JSON object with exactly `{"version": 1, "verdict": "land-once-fixed", "reviewed": "<full SHA of the commit you reviewed>", "paths": [<sorted repo paths the repair may change>], "message": <true if it may change the commit message, else false>, "check": "<command or expected value>"}`: `paths` exactly the files X changes, and `check` the deterministic check, failing at the reviewed commit and passing once X is done. A repair only to the landing message needs no file: give the expected text in the report. The gate reads the repair's scope only from that file, bound by its hash, and refuses a repair outside it; nothing in the report grants scope. Without the file, the gate treats your verdict as an ordinary LAND or FIX FIRST. This review covers Standards only; Spec is a separate review.

Save the report to `<REPORT>` before you finish: the path your brief names, `R/ITEM-review-rN/standards.md` in the round directory.
