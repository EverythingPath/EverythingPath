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

For generated artifacts, judge whether repeated information can be referenced or generated on demand, and accept or reject each budget disposition; the gate verifies receipts, hashes and sizes. Correct decoded data alone does not establish an acceptable storage design.

Baseline smells, all judgement calls; a documented repo standard overrides them: Mysterious Name, Duplicated Code, Feature Envy, Data Clumps, Primitive Obsession, High Cyclomatic Complexity (more than 10 paths; Python, shell and JavaScript only, since lint measures TypeScript), Repeated Switches, Shotgun Surgery, Divergent Change, Speculative Generality, Message Chains, Middle Man. Lint enforces positional parameters (`max-params`), cyclomatic complexity in TypeScript (`complexity`), more than one component per file (`react/no-multi-comp`), tests bound to their environment (the `test-hygiene` block) and `toThrow()` without a message (`vitest/require-to-throw-message`), so they are not reviewer duties; don't report them.

Report, by file and hunk:
- (a) every place the diff breaks a documented standard, citing the source file and rule;
- (b) every baseline smell you spot.

Convex index names follow `by_a_and_b`, except that a name may abbreviate or drop `_and_` when the full name would exceed Convex's 64-character limit; don't flag those. Mark each finding as a hard violation or a judgement call. Skip anything that tsc, eslint or knip already enforce. Number the findings, and keep the report under 400 words. Parent-disposed deferrals appear once under Carried, never as findings.

You may answer "LAND once X is fixed" only when X is machine-checkable, for example a stale count or a commit message. Then also write the conditional file to `<ORCH>/briefs/<N>-review-standards-conditional.json`, a JSON object with exactly `{"version": 1, "verdict": "land-once-fixed", "reviewed": "<full SHA of the commit you reviewed>", "paths": [<sorted repo paths the repair may change>], "message": <true if it may change the commit message, else false>, "check": "<command or expected value>"}`. The gate reads the repair's scope only from that file, bound by its hash, and refuses a repair outside it; nothing in the report grants scope. Without the file, your verdict is an ordinary LAND or FIX FIRST. Any other finding that must be fixed before landing gets an ordinary fix round. This review covers Standards only; Spec is a separate review.

Save the report to `<ORCH>/briefs/<N>-review-standards.out.md` before you finish.
