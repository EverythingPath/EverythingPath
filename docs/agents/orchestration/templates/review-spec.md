# Spec review brief (PRD #251 run)

**Review scope:** the full declared support boundary, unless a fix-round section at the end of this brief narrows it. Broader unfinished acceptance stays with its owner unless a launch dependency or regression is demonstrated.

For an initial review, use `git -C <WT> diff <BASE>...<COMMIT>` in <WT>. Review exactly `<COMMIT>`.

The spec is the ticket (`gh issue view <N>`) and the parent PRD (`gh issue view 251`), including the Implementation Decisions it cites and the acceptance appendix comment. Also check `<WT>/docs/pf-character-sheet-data-model.md` (an index; open the section files in `<WT>/docs/character-sheet/` it links), `<WT>/GLOSSARY.md` and `<WT>/docs/adr/`. The design-decision issues #201–#250 can be read with `gh issue view` (later resolutions override earlier ones).

Report:
- (a) required work that is missing or only partly done;
- (b) scope creep;
- (c) code that looks implemented but is wrong, including authorization holes, broken invariants and untested acceptance criteria;
- (d) if visuals changed, QA by reading the code against the approved prototype tag (`git -C <WT> show prototype-approved/<name>:<path>`).

You may run single test files read-only with `pnpm test <path>` in <WT>. Quote the spec line for each finding. Number the findings, mark each blocker, should-fix or nit, and keep the report under 400 words. Round 1 covers the whole change and every changed doc line; fix rounds are delta-only; the verdict rule is the reviewer role's. Threat model for a guard, scanner, validator or safeguard: <THREAT_MODEL> (default: the Guards rule in `roles/common.md`). Parent-disposed deferrals appear once under Carried, never as findings.

When the acceptance carries an acceptance table (tooling and guard work), it is the contract for this review and its delta reviews: name the row a blocking finding breaks, raise nothing the table lists as not required, except where that entry contradicts a safety requirement or a required refusal from the authorization or the owner: then that contradiction is the finding; and mark a case it does not decide **contract gap**.

**Severity.** A wording finding (a comment, a title, a doc line, a rationale, the landing message) is a blocker only when you state the incorrect behaviour it attributes to the code or the wrong operational decision a maintainer could take from it; otherwise it is a follow-up. A false statement in an operational doc (a runbook, an exit-code table, a safety statement, a held list) stays a blocker.

**Verdict.** Only blockers make FIX FIRST; list should-fix and nit findings under Follow-ups. When every blocker has a machine-checkable repair X, answer "LAND once X is fixed", not FIX FIRST. Machine-checkable: a deterministic check establishes its correctness (a count recomputed by a named command, a commit message equal to a named file, a renamed test title matched by the test run). A changed operational claim (an exit-code table, a safety statement, a runbook step) is never machine-checkable by matching its text: it is reviewed, so FIX FIRST, as is a repair that changes behaviour, a test's logic or generated output. When X changes repo paths or the reviewed commit's own message, also write the conditional file your brief names (`<axis>-conditional.json` beside your report), a JSON object with exactly `{"version": 1, "verdict": "land-once-fixed", "reviewed": "<full SHA of the commit you reviewed>", "paths": [<sorted repo paths the repair may change>], "message": <true if it may change the commit message, else false>, "check": "<command or expected value>"}`: `paths` exactly the files X changes, and `check` the deterministic check, failing at the reviewed commit and passing once X is done. A repair only to the landing message needs no file: give the expected text in the report. The gate reads the repair's scope only from that file, bound by its hash, and refuses a repair outside it; nothing in the report grants scope. Without the file, the gate treats your verdict as an ordinary LAND or FIX FIRST. This review covers Spec only; Standards is a separate review.

Save the report to `<REPORT>` before you finish: the path your brief names, `R/ITEM-review-rN/spec.md` in the round directory.
