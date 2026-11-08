# Feat curation review: #333

Reviewed 2026-10-07 by **Sol (AI curator) for the owner**, following [#333](https://github.com/AndreasUnunger/EverythingPath/issues/333), [PRD Implementation Decision 17 and the acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461), the [curation workflow](curation.md), and the [#328](races-328.md) and [#332](feats-332.md) precedents. This review covers exactly the ticket's 13 `pf1/` identities. Changes remain uncommitted under the orchestration brief. No Catalog Release is published or activated.

## Evidence and review boundary

The read-only inputs are Foundry PF1 v11.11 at `418761d2e16a6037c0156bb4a241f7cea5a2986d` and pf1-content 11.4.0 at `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`. Permitted comparison uses the PRD, [PCGen's CRB feat data](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_feats.lst), and its [campaign metadata](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/core_rulebook.pcc). The PCGen commit is `25523dbcf10e86c280fc0f447167ea43d67419d3`; file hashes are respectively `5ad62f0183b3005a452c93c4d954bcad97033f92dfb8276f214c1c321831db7f` and `8638a1197e2a541695f3005feb1a6eb67569220a5b0f151bc37819d3121feb06`. No book PDFs are available, and Archives of Nethys was not used.

The [legal inventory](../../scripts/catalog/legal/feats-333.json) records every source path, complete YAML and description hash, comparison location and literal clause, linked-content review, notice identity, disposition, and mechanical fact. The [Attribution Assessments](../../src/lib/catalog/data/attribution-assessments.json) and [evidence](../../src/lib/catalog/data/attribution-evidence.json) bind the complete imported content closure, identity mapping, evidence and notices. The [Curation Overlay](../../scripts/catalog/reviewed-curation.json) binds exact raw descriptions. Source citations and complete comparison are separate: a matching name or CRB Benefit alone does not establish the origins of Normal, Special, Combat Trick or linked content.

## Exact dispositions

**One supported/admitted, 11 specifically held, one dependently omitted, zero whole-entry unsupported/prose-only dispositions, and zero exclusions.** Intentional prose submechanics do not replace an entry's attribution disposition. Reference failures are reported separately.

| Exact key | Name | Disposition and comparison boundary |
| --- | --- | --- |
| `pf1/xq2TFr7bsYBBHOi5` | Lunge | Admitted. Complete introduction, BAB +6, melee reach +5 ft., AC −2, duration and decision timing agree with PCGen row 117. No linked definition. Existing reviewed CRB notice reused. |
| `pf1/y3GhqdsCdE9IyYQc` | Simple Weapon Proficiency | Held. PCGen row 155 omits the Normal −4 attack penalty and Special automatic-proficiency class exceptions. |
| `pf1/yB4JlE2GC1MYlweS` | Shield Master | Held. PCGen row 148's Benefit says shield bonus while the pinned text says enhancement bonus. Its structured subtraction of base AC corroborates enhancement but does not resolve the prose discrepancy. Linked comparisons also remain incomplete. |
| `pf1/yE3hVOvBq9rx6TAw` | Spellbreaker | Held. PCGen row 161 omits Normal and expresses fighter 10 through a qualification variable. Linked Disruptive's Benefit agrees with row 52; its fighter 6 prerequisite remains an undecoded qualification variable. The unsourced entry stays unsourced. |
| `pf1/yQ06clVxFV6dOjc1` | Extra Gnome Magic | Held. Complete Gnomes of Golarion comparison, linked Gnome content and notice chain unavailable. The source example includes *speak with animals* beyond the preceding parenthetical list; no new per-spell allocation is inferred. |
| `pf1/yW1RFRSh4Ma2uYc9` | Paired Opportunists | Held. APG Benefit and appended Unchained Combat Trick lack complete comparisons and notice chains. |
| `pf1/ymtj17MI4MdwB0v2` | Shot on the Run | Held. PCGen row 152 omits Normal; linked Point-Blank Shot adds an unverified Combat Trick. |
| `pf1/z5G64ZSUDNdgeICT` | Improvised Weapon Mastery | Held. Direct text agrees with row 111; linked Catch Off-Guard's Combat Trick and Throw Anything's Normal remain unverified. |
| `pf1/zD6KBnFbY1Nrok5h` | Signature Skill (Perception) | Held. Complete Unchained rank-tier and linked-content comparison and notice chain unavailable; journal reference remains broken. |
| `pf1/zKNk7a4XxXsygJ67` | Greater Vital Strike | Dependently omitted. Root and linked Improved Vital Strike/Vital Strike descriptions agree with rows 87/110/182. Its confirmed assessment cannot admit it while the earlier Improved Vital Strike assessment remains unresolved. |
| `pf1/zN9kRaSjKJ1qsfDE` | Signature Skill (Craft) | Held. Complete Unchained rank-tier and linked-content comparison and notice chain unavailable; journal reference remains broken. |
| `pf1/zOxJqI5CG4VoycmQ` | Signature Skill | Held. Complete chosen-skill/category, rank-tier, once-only and stacking comparison and Unchained notice chain unavailable. |
| `pf1/ztV5oURW9cFsLdXT` | Pinpoint Targeting | Held. Root agrees with row 132, but Point-Blank Shot, Precise Shot and Improved Precise Shot retain unverified Combat Tricks or Normal clauses. |

The observed notice minimum comprises `PZO1110`, `PZO1115`, `PZO1131` and `PZO9411`. Existing reviewed `CRB`/`PZO1110` coverage is reused. Three new complete-chain holds for APG, Unchained and Gnomes of Golarion are registered in [held-notices.json](../../scripts/catalog/legal/held-notices.json), including APG's inherited registry identity. Bibliographic metadata and inherited lines do not certify complete book chains. The held entries' known notices are minima, not invented complete origin bounds. No Registry text, alias, legal resource, permanent notice or player-facing source is changed.

## Mechanics and curation

The bounded note drafter finds **zero required notes, action conditionals or Item Abilities**. Its separate prose scanner initially drafts six descriptions. Review supplies seven further exact-bound descriptions, giving **13 checked records, two Modifiers and 13 readable Notes**. Resuming adds or replaces nothing; required coverage has zero missing, stale or unresolved records. Five descriptions retain optional unresolved calculation diagnostics. All 13 mechanical inventories remain incomplete because imported repeatability stays `unreviewed`.

Lunge's −2 AC Modifier uses `condition.option: true`, so ordinary AC stays unchanged and the penalty appears in the Routine Option Situation. Paired Opportunists supplies +4 circumstance only in a local Situation naming an attack of opportunity, adjacency to an ally with the same feat, and both characters threatening the target. No declared shared Situation expresses that conjunction. Existing shared Situations are preserved; ordinary Rule Identity remains the stacking Source, with no invented shared Source.

The [mechanics inventory](../../tests/fixtures/feats-333/mechanics.json) records the actual supported prerequisite clauses: BAB thresholds, ability scores, linked feats, fighter levels, Gnome race and Shield Master's shield-proficiency clause. Improvised Weapon Mastery's alternative prerequisites remain an `anyOf`. Signature Skill's chosen-skill clauses remain unchecked; their prose is preserved. Simple Weapon Proficiency's literal `weaponProf: ["simple"]` is recorded as an unimported proficiency grant rather than an unconditional attack bonus.

Outstanding supported mechanics remain separate from legal holds:

- Imported `pf1/<ID>` identities do not match the handwritten `lunge`, `greater-vital-strike` and `shield-master` identities. Reach +5, quadrupled weapon dice and Shield Master's modeled attack behavior remain importer integration work under [#720](https://github.com/AndreasUnunger/EverythingPath/issues/720). The fixtures retain the imported identities. Shield Master's consuming contract limits the penalty exemption to two-weapon penalties under the FAQ.
- Simple Weapon Proficiency's grant, imported repeatability, and chosen-skill prerequisite facts are not completely mapped. The source once-only constraint on generic Signature Skill is recorded without silently rewriting `repeatable`.
- The two Signature Skill variants retain broken journal UUIDs. This batch reports those existing reference failures rather than fixing the importer or expanding its inventory.

The [Unchained contract](../character-sheet/unchained-classes.md) intentionally keeps Signature Skill/skill unlocks and stamina/Combat Tricks as prose. No unconditional +5/+10 Perception Modifier is substituted for rank tiers. The [attacks contract](../character-sheet/attacks.md) keeps Shot on the Run's movement, improvised attacks and Pinpoint Targeting's opponent AC manipulation as prose. Extra Gnome Magic's daily-use facts stay readable; the [principles](../character-sheet/principles.md) exclude pools and play-time tracking. These are explicit scope decisions, not missing promised calculations.

## Tooling blocker

The scanner's `vs.`, `against` or `when` predicate also controlled which descriptions the importer could bind. An explicit checked Lunge description was therefore stale and its AC Modifier did not apply. The smallest fix in [curation.ts](../../scripts/catalog/curation.ts) and [import.ts](../../scripts/catalog/import.ts) allows explicitly supplied description records to bind the current raw description during import. The automatic drafting predicate is unchanged. Exact text hashes still reject changed source text, retained identity remaps still apply, and required coverage remains independent of optional descriptions. No product implementation or #719/#720 feature gap is changed.

## Demonstration and independent review

The [13 fixtures](../../tests/fixtures/feats-333/README.md) retain byte-exact source YAML, hashes, normalized bodies and mechanical inventories. The ticket-key hash is `7f95d07273213ba6407a0423e3e6cc6df23ff67f9db00361363ab52e36b7432e`. Reduced fixtures report absent dependencies rather than inventing them.

[Seven catalog tests](../../tests/catalog/feats-333.test.ts) exercise source evidence, reviewed binding and invalidation, scanner behavior, actual Modifiers and readable Notes, prerequisite/proficiency facts, intentional prose scope and dependencies. Public resolver checks demonstrate Lunge's ordinary AC **12** versus **10** in its selected Situation, matching current/permanent projections, non-stacking same-Source copies and removal on deactivation. Paired Opportunists gives **+4** only in its precise local Situation; same-Source copies do not double it.

The [isolated saved-sheet test](../../convex/catalogFeats333.integration.test.ts) materializes admitted Lunge in a Character-scoped catalog and uses public writers to select, deactivate and restore it. Dexterity 14 gives ordinary AC 12 and a saved conditional −2 line in current and permanent projections. A second member reads and edits the same sheet; outsiders, unauthenticated reads and wrong-campaign reads/writes fail. The adapter retains imported identity, feat types, description, sources, BAB prerequisite, Modifier and Note values, omitting only the unusable `repeatable: unreviewed` field. No remote backend, production seed, browser or release activation is used.

Independent sampling reviewed all 13 direct sources, eight CRB comparisons and all 21 unique linked sources, checked normalized fixture equality, and recomputed all 13 content/mapping/evidence/notice bindings. The first review missed an inaccurate statement that Disruptive had a Combat Trick; parent review caught it. A second substantive pass corrected that statement and recorded that PCGen matches Disruptive's DC +4, awareness and available/unspent attack-of-opportunity clauses, while its fighter-level qualification variable remains undecoded. Final bindings have zero mismatches. These corrections changed evidence, not dispositions or mechanical outputs.

## Commands and observed results

All source commands use the pinned checkouts without an unverified override. The reproduction commands direct scratch output and executable caches to an ignored directory inside this worktree. Scratch files are deleted after results are recorded.

```sh
PF1_CURATION_SYSTEM="/home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1"
PF1_CURATION_CONTENT="/home/andreas/repos/everythingpath/sources/pf1-content"
mkdir -p .scratch/curation-333
export TMPDIR="$PWD/.scratch/curation-333"
# TMPDIR/package.json contains {"type":"commonjs"} for test executables.
node --input-type=module <<'JS'
import fs from 'node:fs';
const review = JSON.parse(fs.readFileSync('scripts/catalog/legal/feats-333.json', 'utf8'));
fs.writeFileSync('.scratch/curation-333/candidates.json',
  JSON.stringify(review.candidates.map(({ externalKey }) => externalKey), null, 2) + '\n');
JS
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/curation-333/candidates.json --out .scratch/curation-333/draft
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/curation-333/candidates.json --records .scratch/curation-333/draft/records.json --descriptions --out .scratch/curation-333/prose
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/curation-333/candidates.json --records scripts/catalog/reviewed-curation.json --descriptions --out .scratch/curation-333/reviewed
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-333/full-draft
pnpm -s catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/curation-333/candidates.json --out .scratch/curation-333/bounded
pnpm -s catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-333/full
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm -s catalog:format --check
pnpm test tests/catalog/feats-333.test.ts convex/catalogFeats333.integration.test.ts --maxWorkers=1
pnpm test tests/catalog convex/catalogFeats333.integration.test.ts --maxWorkers=1
git diff --check
```

| Check | Observed final result |
| --- | --- |
| Exact-key note/prose drafting | Exit 0 for each; zero required records, six new automatic prose drafts. |
| Reviewed bounded resume | Exit 0; zero added/replaced/missing/stale required records; 13 checked descriptions. |
| Full-corpus drafter | Exit 0; 3,937 records, 3,628 new drafts, zero replaced/missing/stale, 763 unresolved required mechanics outside this batch. Full runs remain supported. |
| Bounded preview | Exit 1; 13 extracted feats, `coverageComplete: true`, required curation passes; one admitted, three held, nine reference failures. |
| Full preview | Exit 1; 23,037 entries and 538 resources; 52 admitted, 23,130 held, two dependent omissions, zero retained exceptions, 4,734 failures. |
| Typecheck | Exit 0 after correcting two fixture type-narrowing errors. |
| Lint | Exit 0 after correcting the fixture guard to optional chaining. |
| Initial migration writers | Exit 0; 183 registrations checked. |
| Catalog calculation pin | Exit 0; `sha256:6607d068facda14d40eddebe4e916952e8c668997ecadde9dbdc550e946f5518`. |
| Canonical catalog data / whitespace | Exit 0 for `catalog:format --check` and `git diff --check`. |
| Focused batch tests | Two files, eight tests passed; final focused run 6.60 seconds. |
| Catalog suite plus isolated saved sheet | Exit 0; 28 files, 408 tests passed in 67.76 seconds. |

Within this batch the complete gate reports **one admitted, nine held, one dependent omission and two existing reference failures**. The two failures are the Signature Skill Perception/Craft journal references; their legal holds remain recorded independently. Seven of the bounded preview's missing-dependency failures disappear with the complete extraction. Greater Vital Strike then becomes the correctly reported dependent omission, without changing Improved Vital Strike's earlier assessment.

Exact sorted `(externalKey, reason)` comparison with the pre-batch full gate finds **zero new or removed failures**: the same 3,628 missing curation records, 715 unaccounted inventory records and 391 broken references remain. All 51 previous admissions remain admitted; only Lunge is newly admitted. The final CLI's 13 normalized bodies exactly match the tracked fixture. Complete required coverage remains 100 checked of 3,728; 209 of 10,140 optional descriptions are checked. Passing this batch's required gate does not claim whole-corpus readiness. Neither final preview has outstanding admitted notices or legal resources.

Earlier shared objects are preserved: 296 overlay records and all shared Situations, 427 assessments, 400 evidence records and 89 enforced hold entries. Additions are exactly 13 overlay records, 13 assessments, 13 evidence records and three hold entries. The Registry and identity-remap file are unchanged.

Bounded extraction fingerprint: `eea63d4bd5f89826cc49551ff3402f51c1c9f277e54c14aa83289c60a522570f`. Full extraction fingerprint: `9eecd6ddfa1d7830c24e1ea23edd477ab0ef12745d1b96926dca7819298b113f`. Both corrected final previews use reviewed-input fingerprint `a625dff231ed0708ead1c85dbf2f14191914c551f3bd42a4310ab97e756cb295`; earlier preview runs begun before the final evidence correction were superseded. Reviewed overlay fingerprint: `2edee40be4e2b405e6b08b9846dea1d485b00ea233770e8543651b9631bc958c`.

The full test suite was not run. The orchestrator owns the one post-rebase landing run under the current brief and owner decision.

## Workflow problems and timing

The manual-description binding blocker required the narrow two-file tooling fix above. An initial helper parsed the entire source tree unnecessarily; it was replaced by indexed source reads and an existing complete artifact, with final CLI equality independently checked. Initial fixture tests exposed a missing empty content-source directory and incorrect AC property names; a tracked `.gitkeep` and correct public properties fixed them. Typecheck then caught two missing schema narrowings, and ESLint caught a guard that needed optional chaining. These were fixture changes, not product behavior changes.

The first combined catalog test run had one five-second timeout in the existing release-operator CLI test while full-corpus imports were running: 407 passed, one timed out at 5.059 seconds. After those imports finished, that file passed three tests in 5.29 seconds overall (the affected test took 2.933 seconds), and the complete catalog retry passed all 408. No timeout or product code was changed. The incorrect Disruptive comparison and its subsequent precise clause refinement were corrected and rebound before the final previews.

The available runtime has no Opus/Fable model aliases; delegated implementation and independent source review used the inherited model. The orchestrator owns its sampled landing review.

Approximate phase time, with source review and early checks overlapping: intake/source briefing six minutes; exact-key drafting two minutes; comparison, artifacts and evidence corrections fourteen minutes; final gates, reporting and cleanup sixteen minutes. These phase times overlap and are not additive.
