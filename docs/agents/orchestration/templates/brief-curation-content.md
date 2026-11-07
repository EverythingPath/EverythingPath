# Curation: #<N> <TITLE>

Deliver reviewed catalog artifacts and evidence for an exact set of candidates.

- **Ticket:** `gh issue view <N>`. It lists the exact keys and the acceptance criteria.
- **Precedent:** the races batch #328 (`git log --oneline --grep '#328'`; report `docs/catalog-import/races-328.md`) and its correction commit. Follow their conventions: inventory, overlay, attribution records, `--candidates` tooling and report layout.

## Read first
- PRD `gh issue view 251`: Implementation Decision 17 and the decisions for this content type, plus the acceptance appendix comment.
- Attribution policy: `gh issue view 224`, `227` and `241`.
- The consuming feature contract for this content type: find it under `docs/character-sheet/` and `docs/catalog-import/`.
- The curation workflow: `docs/catalog-import/curation.md`, `README.md` and `releases.md`.

## What to do
1. **Draft.** Run `pnpm -s catalog:curate --candidates …` for exactly this batch. Keep output in a git-ignored scratch folder inside the worktree.
2. **Disposition.** Give every key exactly one disposition, using the PRD's categories: supported/admitted, specifically held / dependently omitted, explicitly unsupported / prose-only, or excluded with the contract reason. Add no new scope. Apply the owner's admission policies in `docs/catalog-import/curation.md#admission-policies`; re-assessing records already held under the old reading stays under #735.
3. **Attribution.** Write content-bound Attribution Assessments with source evidence, reviewer and date, and the notice identities. Name holds; never invent coverage. **Inherited-rule notices:** when an entry's text grants, restates or depends on rules from another book (a template, a class feature such as bombs or spirit magic, Unchained stamina, a CRB spell or condition), that book's notice belongs in `requiredNotices`. Precedents: #337 PZO1131 on Combat Tricks; #520 PZO1112 on Umbral Infusion. Use only notice identities the repo already knows, and follow the settled rules in `docs/catalog-import/curation.md#notice-guidance`.
4. **Records.** Complete the required Modifiers, Sources, prerequisite and proficiency facts, and the note, action-conditional and Item Ability records. Do the separate prose-only description pass too. **Use the shared Situations from `curation.md` wherever they apply**, and use local labels only when no shared Situation fits. Preserve exact rule identity and stable remaps. For class batches, validate schedules through level 20. For gear, validate Base Items, defaults and end state. For companions, validate version-specific sources. Calculations that can't be done stay outstanding. Never turn them into attribution holds. Put armor, shield and natural armor bonuses on `ac` (or their own leaf), never on `ac.other`, where they would stack with a real armor, shield or natural armor bonus; `tests/catalog/ac-other-defense-bonuses.test.ts` fails on a new one (#734).
5. **Demonstrate.** Show representative output through the public resolver and an isolated saved-sheet/catalog preview. Run the gates, and add focused tests that pin real values.
6. **Report.** Write the batch report next to the #328 report, covering every key's disposition, the evidence, holds, outstanding mechanics, and the commands with their results.
   In its preservation section, where the report counts the files the batch adds to the shared store (`tests/fixtures/pinned/`), put this marker block instead of a count of your own. The orchestrator's prep (`scripts/orchestration/cur-prep.sh`) fills it in after rebasing the batch onto the feature head, from `git diff --diff-filter=A` grouped by source, so the count is right after the rebase. Copy it exactly, with nothing between the two lines; describe the files themselves (which records, which were already on the base) in your own sentence next to it:

   ```markdown
   <!-- prep:shared-store-count -->
   <!-- /prep:shared-store-count -->
   ```

## Rules

- **File locations.** Put the batch inventory, evidence and mechanics review in one file, `scripts/catalog/legal/<family>-<N>.json` (e.g. `feats-330.json`). Put fixtures under `tests/fixtures/<family>-<N>/` and the report at `docs/catalog-import/<family>-<N>.md`. Keep candidate selections in scratch; don't commit them.
- **Record and check notice dependencies.** Record each inherited rule's book in `inheritedRuleNotices` (or the batch's equivalent recorded field), then run `pnpm catalog:notice-deps`: it fails when a recorded dependency's notice is missing from `requiredNotices` or unheld, and its warnings (terms such as stamina, Story feat, mythic, template and Style feats, and linked records whose books are not required) need a check against the text; see `docs/catalog-import/curation.md#notice-dependencies`.
- **Never break full-corpus `catalog:curate` runs.** Report importer gaps, don't fix them, and name the ticket that owns each: spell metadata and reference gaps (empty descriptors, unresolved journal-page `@UUID` links) belong to #738, and feat prerequisite-parser findings to #739. A gap neither covers gets its own entry in the report.
- **Protected and governing records.** Give such a record (a protected root in earlier fixtures, or a body that governs another entry) its evidence-backed Note, re-bind every binding and dependent Attribution Assessment it changes in the same change, and list each in the report, as `docs/catalog-import/curation.md#protected-and-governing-records` says. Filling the Notes earlier batches left empty stays under #744.
- **Record-level `3.5` tags:** *hold* such entries with a specific hold naming the tag. Never exclude them. The importer contract (`docs/catalog-import/README.md:75`) excludes only whole 3.5 packs.

## Checks
- `pnpm -s typecheck`
- `pnpm -s lint`
- `pnpm -s check:initial-migration-writers`
- `pnpm catalog:pin`
- the gates, run with the source paths above
- The impact plan’s relevant test files. Use specialized curation prep for the light/full catalog decision and affected older batches; retain full landing-queue validation. Reuse matching evidence as your brief's validation plan says.

## Final answer
- disposition counts and notable cases;
- holds and outstanding mechanics;
- files changed;
- check results;
- time spent per phase;
- workflow problems.
