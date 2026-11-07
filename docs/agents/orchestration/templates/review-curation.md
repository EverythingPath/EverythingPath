# Sampled curation review (PRD #251 curation lane)

**Review scope:** the full declared support boundary, unless a fix-round section at the end of this brief narrows it. Broader unfinished acceptance stays with its owner unless a launch dependency or regression is demonstrated.

Batch: ticket #<N> (`gh issue view <N>`), done by an AI curator in the worktree <WT>. Changes are the top commit on actual branch `<BRANCH>`, rebased onto the feature head; see `git -C <WT> show HEAD`. Keep ticket #<N> as the curation discriminator; prep/landing must use this exact branch and <WT>, as the runbook specifies. The curator's answer is at <ORCH>/answers/curation-<N>.md.

## Sources and policy
- Pinned sources, read-only:
  - ~/repos/everythingpath/sources/foundryvtt-pathfinder1 (v11.11, 418761d2)
  - ~/repos/everythingpath/sources/pf1-content (11.4.0, 02f4ab0d)
- Policy:
  - PRD `gh issue view 251` (Decision 17 and the decisions for the content type)
  - `gh issue view 224`, `227` and `241`
  - `docs/catalog-import/curation.md`
  - `docs/agents/orchestration/decisions.md`, the standing owner decisions
- Allowed comparison sources are the PRD, PCGen and the books only. AoN is not allowed. No made-up content.

## Check

Apply all steps on initial review. In a fix round, apply them to the delta and affected records/dependencies, and verify preservation of prior accepted requirements. Changed promoted records still require exact record-level review evidence.
1. **Report.** Read the batch report fully. Confirm every key in the declared support boundary has a disposition consistent with the inventory, excluded ticket acceptance remains tracked under its owner, and that every count adds up. The shared-store count between the `prep:shared-store-count` markers is written by prep after the rebase, from git; don't recount it by hand.
2. **Sample.** Pick about 10 records spread across the batch, including the unusual ones. Verify each against the pinned source: hashes, verbatim text, values, targets, bonus types, stages, and shared Situations where they apply. Look for anything invented or missed.
3. **Holds.** Holds must be specific and justified under #224, #227 and #241. Nothing may be admitted without evidence. Check the owner's admission policies in `docs/catalog-import/curation.md#admission-policies`.

   Notices follow the settled rules in `docs/catalog-import/curation.md#notice-guidance`. Importer gaps are reported, not fixed, and name their owner: #738 for spell metadata and reference gaps, #739 for feat prerequisite-parser findings.
4. **Protected and governing records.** When the batch completes the Note of a protected root or a governing body (`docs/catalog-import/curation.md#protected-and-governing-records`), check each binding and dependent Attribution Assessment the report lists: re-bound in this change, matching current data, and the list complete (search the earlier inventories under `scripts/catalog/legal/` for the key as a governing or linked body). Filling the Notes earlier batches left empty stays under #744.
5. **Preservation.** Nothing existing was removed or changed beyond this batch and the re-bindings item 4 lists. Diff the shared files: registry, overlay, assessments and evidence.
6. **Tests and tooling.**
   - Tests pin real values and aren't tautological.
   - Any tooling or code change is minimal, correct and tested.
   - Full-corpus `catalog:curate` runs still work.
   - No armor, shield or natural armor bonus targets `ac.other`, and the #734 allowlist in `tests/catalog/ac-other-defense-bonuses.test.ts` didn't grow.
   - Source-reading tests use `skipIf` and are listed in `scripts/orchestration/host-audits.json`. A test that returns early when a source is missing passes silently on CI, so it is a finding.

## Output
Save the report to <ORCH>/briefs/curation-<N>-review.out.md. Reply in at most 250 words:
- a verdict: **land** or **fix first**, or **land once X is fixed** only when X is machine-checkable (for example a stale count or a commit message). For **land once X is fixed**, also write the conditional file to `<ORCH>/briefs/curation-<N>-conditional.json`, a JSON object with exactly `{"version": 1, "verdict": "land-once-fixed", "reviewed": "<full SHA of the commit you reviewed>", "paths": [<sorted repo paths the repair may change>], "message": <true if it may change the commit message, else false>, "check": "<command or expected value>"}`. The gate reads the repair's scope only from that file and refuses a repair outside it; nothing in the report grants scope, and without the file the verdict is an ordinary land or fix first. Anything else to fix is **fix first**;
- findings, each with file:line, marked hard or judgement.

Parent-disposed deferrals appear once under Carried, never as findings.
