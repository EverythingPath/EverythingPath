# Feat curation review: #334

Reviewed 2026-10-07 by **Sol (AI curator) for the owner**, following [#334](https://github.com/AndreasUnunger/EverythingPath/issues/334), [PRD Decision 17 and acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461), the [curation workflow](curation.md), and the [#328 precedent](races-328.md).

This review processes exactly the ticket's 100 `pf1-content/` feat identities. **100 specifically held; zero admitted, dependent omissions, whole-entry unsupported/prose-only dispositions, or exclusions.** Each candidate has one disposition. Attribution, note coverage, and calculation completeness are separate results. No Catalog Release is published.

## Evidence and review boundary

The read-only system checkout is Foundry PF1 v11.11, `418761d2e16a6037c0156bb4a241f7cea5a2986d`; content is pf1-content 11.4.0, `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`. The [batch inventory](../../scripts/catalog/legal/feats-334.json) retains every exact key, source YAML path and hash, description hash, prerequisite/proficiency/action facts, notice minima, source-specific hold, and mechanics review. Reviewer/date metadata are recorded on all assessments and reviewed records.

All 100 raw definitions have empty structured sources, and these remain empty in imported output. The [Attribution Assessments](../../src/lib/catalog/data/attribution-assessments.json) and [evidence](../../src/lib/catalog/data/attribution-evidence.json) bind the complete imported content closure and mapping. None is accepted. Every whole-content hold names the candidate and the missing publication/origin comparison; unidentified books remain unidentified.

Permitted comparison used the [PCGen APG feat file](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/advanced_players_guide/apg_feats.lst) and [campaign metadata](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/advanced_players_guide/advanced_players_guide.pcc), at commit `25523dbcf10e86c280fc0f447167ea43d67419d3`. Their SHA-256 values are `40d33ce6cf8f4321facf2c3528498479c6817abf58036f0a8402b68fc68181e4` and `77bb28809640e0989d84343219c598b0783221f3eb5b753d95d904ce5efc55c9`. Four individual comparisons retain exact line snapshots and their limits. Additional Traits establishes a description and two-slot pool lead, without the different-list/qualification clauses. Elemental Fist includes symbolic prerequisites/dice/uses that were not independently resolved and lacks the appended Combat Trick comparison. Racial Heritage and Elemental Focus supply content/choice leads, with publication origin and complete notice chains still held. These comparisons establish no admission or source backfill. No book PDFs are available; Archives of Nethys was not used.

Five new notice-chain holds for `PZO1115`, `PZO1117`, `PZO1125`, `PZO1132`, and `PZO9481` are enforced in [held-notices.json](../../scripts/catalog/legal/held-notices.json). The APG hold includes its existing inherited Registry identity as an observed lead, without inventing a product-code alias or claiming a complete book chain. Existing `CRB`/`PZO1110` notice coverage is reused only for actual cross-reference minima. Those minima do not bound whole-content origins. No Registry notice, legal-resource text, permanent notice, or identity remap changes.

## Exact dispositions

All rows carry their individual `feats-334-whole-content-<upstream-id>` hold in the inventory. Observed notice minima and partial comparisons are evidence leads, not complete attribution. Prose-only submechanics do not change a whole entry's held disposition.

| Exact key | Name | Disposition and evidence boundary |
| --- | --- | --- |
| `pf1-content/01MUL5N0meygR4Am` | Glorious Heat | Held: whole-content origins unbounded. |
| `pf1-content/03ZKMzC7slYjz2ZQ` | Life's Blood | Held: whole-content origins unbounded. |
| `pf1-content/04T7gRsbHZasATM7` | Courageous Resolve | Held: whole-content origins unbounded. |
| `pf1-content/04Yb91pxWzmAQ4Yg` | Boon Companion | Held: whole-content origins unbounded. |
| `pf1-content/04r9dXVFjR0pE7iY` | Witch Knife | Held: whole-content origins unbounded. |
| `pf1-content/05mLXM0ta6rsi0NH` | Purging Emesis | Held: whole-content origins unbounded; observed notice minima: PZO1110. |
| `pf1-content/06LziB0l4FNyuMqX` | Sap Master | Held: whole-content origins unbounded. |
| `pf1-content/07X4C432TkNkBK7Y` | Body Mastery | Held: whole-content origins unbounded. |
| `pf1-content/0A4V931Jp8mHByvm` | Warrior Priest (Mythic) | Held: whole-content origins unbounded. |
| `pf1-content/0A5B31laEZ1GhZbg` | Crane Riposte | Held: whole-content origins unbounded. |
| `pf1-content/0AK1K1v4th7eMi55` | Redeemed Kobold | Held: whole-content origins unbounded. |
| `pf1-content/0CdIlNfxtPZHPR1t` | Missile Shield (Mythic) | Held: whole-content origins unbounded. |
| `pf1-content/0DCgS5nYM9tY097b` | Razortusk | Held: whole-content origins unbounded. |
| `pf1-content/0DDCq2L7ZsDwc2a3` | Abeyance | Held: whole-content origins unbounded. |
| `pf1-content/0DISp1xLT88lF0Zr` | Improved Toxicological Timing | Held: whole-content origins unbounded. |
| `pf1-content/0DcWViTwKwStUftk` | Pungent Stench | Held: whole-content origins unbounded. |
| `pf1-content/0EZkEWZNLsOK3ftK` | Inner Breath | Held: whole-content origins unbounded. |
| `pf1-content/0Ezfgppnp3JruYBa` | Crepuscular Cowl | Held: whole-content origins unbounded. |
| `pf1-content/0GPXRe8nHDEXqFym` | Conversion Channel | Held: whole-content origins unbounded. |
| `pf1-content/0GQQJZeXYwacQ3kc` | Bounding Hammer | Held: whole-content origins unbounded. |
| `pf1-content/0IjqyuJ2fFWhodT0` | Earth Child Binder | Held: whole-content origins unbounded. |
| `pf1-content/0IlqsBhhXSX4VG8d` | Cherry Blossom Spell | Held: whole-content origins unbounded. |
| `pf1-content/0JsdFxcp1iX78C6c` | Feign Curse | Held: whole-content origins unbounded. |
| `pf1-content/0LurSIKQKoZC7jwp` | Shikigami Mimicry | Held: whole-content origins unbounded; observed notice minima: PZO9481. |
| `pf1-content/0MOqhX7HCsw0tdJa` | Sunblade | Held: whole-content origins unbounded; observed notice minima: PZO1132. |
| `pf1-content/0MSwcLtSGXEzuHHG` | Dragonflight Flight | Held: whole-content origins unbounded. |
| `pf1-content/0MYznHYLWvhA9lV1` | Forgotten Past | Held: whole-content origins unbounded. |
| `pf1-content/0Nf9bXrMBkd58oCt` | Channeling Force | Held: whole-content origins unbounded. |
| `pf1-content/0PBqoL4PAqFbTRYb` | Divert Harm | Held: whole-content origins unbounded. |
| `pf1-content/0QffoZwsuxJ97Rww` | Finishing Cascade | Held: whole-content origins unbounded. |
| `pf1-content/0SytnI62zKZX9U9c` | Twisted Love | Held: whole-content origins unbounded; observed notice minima: PZO1125. |
| `pf1-content/0T1qJaJqBRcShtQ7` | Orc Rampage | Held: whole-content origins unbounded. |
| `pf1-content/0TeuA51dXqerRWim` | Oath of the Unbound | Held: whole-content origins unbounded. |
| `pf1-content/0U3vG8j3NS10fZhw` | Undersized Mount | Held: whole-content origins unbounded. |
| `pf1-content/0WaF4FiQtsfzPgTt` | Explosive Weapon | Held: whole-content origins unbounded. |
| `pf1-content/0XxsqF5DtZlJYPxE` | Obscuring Beacon | Held: whole-content origins unbounded. |
| `pf1-content/0YYVrTqD2VCFXfho` | Nosoi's Spiritsense | Held: whole-content origins unbounded. |
| `pf1-content/0a08FtW2Qvrfaz65` | Feline Grace | Held: whole-content origins unbounded. |
| `pf1-content/0aXg9HcaRt8h61TK` | Great Rend | Held: whole-content origins unbounded. |
| `pf1-content/0bDdPQyIYkrmmBdZ` | Fearsome Barricade | Held: whole-content origins unbounded. |
| `pf1-content/0bl1uVekDFDBbRP3` | Align Equipment | Held: whole-content origins unbounded. |
| `pf1-content/0c9IUNbuGSXvM7Rp` | Whipcrack | Held: whole-content origins unbounded. |
| `pf1-content/0eAUSb36NrbfESze` | Fascination Jinx | Held: whole-content origins unbounded. |
| `pf1-content/0flAXcYyK6wjXILY` | Lady Luck's Guidance | Held: whole-content origins unbounded. |
| `pf1-content/0hFKyjWOOvDwUU3H` | Ranged Trip | Held: whole-content origins unbounded. |
| `pf1-content/0kGH7ah6DQYg1ukh` | Explorer | Held: whole-content origins unbounded. |
| `pf1-content/0keuVkg9S2IGITiz` | Extra Summons | Held: whole-content origins unbounded. |
| `pf1-content/0lBSgxBA8bWoluzI` | Wary Smuggler | Held: whole-content origins unbounded. |
| `pf1-content/0liN6upzFz3VmE2m` | Startling Getaway | Held: whole-content origins unbounded. |
| `pf1-content/0lziWPpknFG6ZAA7` | Adaptive Fortune | Held: whole-content origins unbounded. |
| `pf1-content/0mn3m0FYzVQhFeww` | Shadow Gambit | Held: whole-content origins unbounded. |
| `pf1-content/0nvnNxuH8b52wqjw` | Undaunted Bravery | Held: whole-content origins unbounded. |
| `pf1-content/0rAbX88R5tRWK3oz` | Spirit Speaker | Held: whole-content origins unbounded. |
| `pf1-content/0sNY1wvxcIYP00QQ` | Storm-Lashed | Held: whole-content origins unbounded. |
| `pf1-content/0u954JKv4jmhXd9z` | Cat and Mouse | Held: whole-content origins unbounded. |
| `pf1-content/0uvJOlglwykdpBgn` | Celestial Guidance | Held: whole-content origins unbounded. |
| `pf1-content/0wis0JWTEbS37k0l` | Taldan Duelist | Held: whole-content origins unbounded. |
| `pf1-content/115MPsIxlCXWC0I5` | Share Healing | Held: whole-content origins unbounded. |
| `pf1-content/14LVyS60Qg1McdDO` | Boar Style | Held: whole-content origins unbounded. |
| `pf1-content/14c1cIPPkyWegx7V` | Elemental Overload | Held: whole-content origins unbounded. |
| `pf1-content/14r73uUBNkCqlIm2` | Lingering Invisibility | Held: whole-content origins unbounded. |
| `pf1-content/15Ekzc3ceL8hz2WI` | Shared Soul | Held: whole-content origins unbounded. |
| `pf1-content/16sgQ4c8T8tTCbgV` | Wild Flanking | Held: whole-content origins unbounded. |
| `pf1-content/17O0R6YNDttLPIBh` | Flame Heart | Held: whole-content origins unbounded. |
| `pf1-content/1AFtj6grymZbXs4L` | Dispel Mastery | Held: whole-content origins unbounded. |
| `pf1-content/1BPlMfaCscwkz8Zk` | Snoutgrip | Held: whole-content origins unbounded. |
| `pf1-content/1DiesNNVATrzAZOw` | Painful Anchor | Held: whole-content origins unbounded. |
| `pf1-content/1F0dlShIZp8SrIhJ` | Greater Tenacious Hunter | Held: whole-content origins unbounded. |
| `pf1-content/1FEf5OW15eWcNoHd` | Additional Traits | Held: whole-content origins unbounded; observed notice minima: PZO1115; partial PCGen APG comparison. |
| `pf1-content/1IBtTErnSvRJAIib` | Powerful Poisoning | Held: whole-content origins unbounded. |
| `pf1-content/1IMyBN0m8dli29ei` | Improved Fiendish Darkness | Held: whole-content origins unbounded. |
| `pf1-content/1JibNJo9tM9RRbnJ` | Smashing Style | Held: whole-content origins unbounded. |
| `pf1-content/1KiUaRWm5uK4S5Xk` | Redemption | Held: whole-content origins unbounded. |
| `pf1-content/1LULpgVNjQWqUGUk` | Racial Heritage | Held: whole-content origins unbounded; observed notice minima: PZO1115; partial PCGen APG comparison. |
| `pf1-content/1NiYcDLPZqYUT0Jc` | Elemental Fist | Held: whole-content origins unbounded; observed notice minima: PZO1115; partial PCGen APG comparison. |
| `pf1-content/1PrTUCvlPrvLNlRO` | Spawnlink | Held: whole-content origins unbounded. |
| `pf1-content/1Q8MEwLBfL0Wio3d` | Beast Hunter | Held: whole-content origins unbounded. |
| `pf1-content/1R1Zq4cYx8OXNRLi` | Dreadful Carnage (Mythic) | Held: whole-content origins unbounded. |
| `pf1-content/1R7WvSidr9axfNBP` | Poison Focus | Held: whole-content origins unbounded; observed notice minima: PZO1117. |
| `pf1-content/1REFic8UHkIVM588` | Fox Style | Held: whole-content origins unbounded. |
| `pf1-content/1Uk54nyzdK9Yfjt4` | Conceal Spell | Held: whole-content origins unbounded. |
| `pf1-content/1UxswjaA1iy1zFWl` | Shared Remembrance | Held: whole-content origins unbounded. |
| `pf1-content/1W1kpoArNz49RZry` | Jumper | Held: whole-content origins unbounded. |
| `pf1-content/1W47cuZq9LDQYbGB` | Sin-Sharing Critical | Held: whole-content origins unbounded. |
| `pf1-content/1WDUmrOnbBonV1ar` | Mind Strike | Held: whole-content origins unbounded. |
| `pf1-content/1YV55eMyz74yLpMk` | Dazing Fist | Held: whole-content origins unbounded. |
| `pf1-content/1ZbtqLM8RJOYwHGB` | Press to the Wall | Held: whole-content origins unbounded. |
| `pf1-content/1b1oCth6Uq7HmiAi` | Cleave Through | Held: whole-content origins unbounded. |
| `pf1-content/1d3xQt4XAgCQOTpB` | Greater Hunter's Bond | Held: whole-content origins unbounded. |
| `pf1-content/1daBEywFsAOrFqSJ` | Overhead Flip | Held: whole-content origins unbounded. |
| `pf1-content/1dly9xXg26BZzmBj` | Friendly Rivalry | Held: whole-content origins unbounded. |
| `pf1-content/1ehMdeVGV4iwYukk` | Monstrous Mount Mastery | Held: whole-content origins unbounded. |
| `pf1-content/1frgqDSnQFiTq0MC` | Elemental Focus | Held: whole-content origins unbounded; observed notice minima: PZO1115; partial PCGen APG comparison. |
| `pf1-content/1gEYaN2gB4jmZ9Bq` | Charnel Soldiers | Held: whole-content origins unbounded. |
| `pf1-content/1iCzafnWv1zYsR09` | Desert Dweller | Held: whole-content origins unbounded; observed notice minima: PZO1110. |
| `pf1-content/1kbleoKlO6mfUt0f` | Champion of Grace | Held: whole-content origins unbounded. |
| `pf1-content/1lwAjWCjTQpQvSaW` | Touch of the Brackish Emperor | Held: whole-content origins unbounded. |
| `pf1-content/1oahool5BTi4h3KA` | Natural Poison Antitoxin | Held: whole-content origins unbounded. |
| `pf1-content/1sAPeoXUaua0ImrM` | Verify | Held: whole-content origins unbounded. |
| `pf1-content/1sHrxzUbsg3zryvd` | Eternal Enmity | Held: whole-content origins unbounded. |

## Mechanics and separate prose review

The [Curation Overlay](../../scripts/catalog/reviewed-curation.json) adds **67 checked description records with 29 numeric Modifiers and 67 readable Notes**. All 296 earlier records and 26 shared Situation declarations remain unchanged. Required coverage has zero bindings in this batch: no raw context notes, action conditionals, or Item Abilities occur. Abeyance's one action/effect note remains part of the reviewed raw action facts rather than being miscounted as an action conditional.

The drafter's separate description pass selects 67 descriptions. All 100 descriptions were independently inspected, including the other 33 that the documented `vs./against/when` predicate does not select. **29 checked descriptions retain unresolved mechanics.** A passing required-note gate does not establish complete calculations. All 100 imported repeatability values remain `unreviewed`; 52 candidates retain unchecked prerequisite clauses, and 43 candidates have further source-specific mechanics gaps. Each gap is independent of attribution and is recorded in the inventory.

Reviewed numeric outputs preserve exact conditional scope. Twisted Love uses the existing shared `enchantment` Situation; Courageous Resolve's fear Note uses shared `fear`. Feline Grace's five defensive maneuver Situations remain distinct from existing offensive maneuver keys and the narrower ground-only defenses. Shared Soul's phantom-confinement cases and other compound restrictions remain local because no shared Situation fits the complete condition. Source stacking uses each exact rule identity; Catalog Copies do not add the same effect twice.

Representative outstanding mechanics include Courageous Resolve's replacement of the fearless racial bonus with +4, Storm-Lashed's weather-penalty replacements, Forgotten Past/Explorer skill-rank thresholds, Boon Companion's selected companion effective-level increase, Racial Heritage's chosen-race equivalence, Jumper's class-skill grant and incorrect unchecked creature-type disjunction, natural-attack Grants, action-specific DCs, and conditional weapon/poison calculations. Wary Smuggler's +5 Sleight of Hand, Oath of the Unbound's scoped +2 values, and Desert Dweller's scoped +4 values cannot receive an applicable description binding under the existing predicate. Manually adding those records would produce stale, unapplied records. These remain named importer gaps; no importer/product fix is hidden in this batch.

Spell-like abilities, Combat Trick stamina rules, Mythic-tier mechanics, daily pools, tactical target adjudication, and other explicitly excluded scopes retain readable prose. Improved Fiendish Darkness's +2 applies only to its darkness spell-like ability and never becomes an ordinary Spellcasting caster-level Modifier. Taldan Duelist's +1 is an untyped increment to `ac.shield` within its compound Situation, so it adds to the buckler and does not enter touch AC. Spirit Speaker's +4 is confined to changing an absorbed spirit's attitude as a medium with haunt channeler. Friendly Rivalry preserves its full one-round loss interval. Classes through level 20, gear Base Items/end state, and companion source batches are not applicable here.

## Demonstration and checks

The [fixtures](../../tests/fixtures/feats-334/README.md) preserve all 100 YAML files byte for byte and source provenance, with exact candidate-order SHA-256 `630002ac9200d13e28956762984a9e5809b3f29dcf429dd0fb5999bbcd818aa2`. Their normalized preview preserves the complete extraction's real linked prerequisite facts; the reduced fixture exposes absent dependencies without inventing them.

[Catalog tests](../../tests/catalog/feats-334.test.ts) exercise the public resolver and gate: exact inventory/hashes/bindings, zero actual batch admissions, same-Source nonstacking across distinct copies, Storm-Lashed's +2 save scope, Feline Grace's five separate CMD scopes, Flame Heart's conditional +1 caster level, Elemental Focus's conditional +1 spell DC, Additional Traits' two slots, and explicit unsupported/importer outcomes.

The [isolated saved-sheet test](../../convex/feats334.integration.test.ts) materializes held Storm-Lashed and Additional Traits bodies only in convex-test's empty, Character-scoped catalog. It drives public create/edit/select/deactivate writers, compares saved reads to the application catalog preview, checks another member's edits, and refuses outsider reads/edits, unauthenticated reads, and wrong-campaign reads/edits. The adapter omits the importer's unusable repeatability sentinel without inventing a reviewed value. This is a held-content mechanics demonstration, not an admitted Catalog Release or an admission bypass. No remote backend is contacted. **The requested admitted-batch demonstration remains unavailable because no batch candidate has accepted attribution.**

Independent sampling inspected ten risky source cases and then all numeric-producing entries, all 100 source/description hashes, exact bindings, mapped facts, and legal fingerprints. It corrected an omitted APG notice identity, tightened Spirit Speaker and Friendly Rivalry scope, removed the spell-like-ability caster-level output, distinguished Mythic/stamina prose from promised calculations, and refined the four partial-comparison claims. Unchanged previous review objects were independently verified.

## Commands and observed results

Commands use the clean pinned checkouts and worktree-local ignored scratch output. Candidate selections are recreated from the inventory rather than committed. `TMPDIR/package.json` is a scratch-only CommonJS marker for CLI test executables.

```sh
PF1_CURATION_SYSTEM="/home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1"
PF1_CURATION_CONTENT="/home/andreas/repos/everythingpath/sources/pf1-content"
mkdir -p .catalog-curation/feats-334/tmp
export TMPDIR="$PWD/.catalog-curation/feats-334/tmp"
node --input-type=module <<'JS'
import fs from 'node:fs';
const review = JSON.parse(fs.readFileSync('scripts/catalog/legal/feats-334.json', 'utf8'));
fs.writeFileSync('.catalog-curation/feats-334/candidates.json',
  JSON.stringify(review.candidates.map(({ externalKey }) => externalKey), null, 2) + '\n');
fs.writeFileSync('.catalog-curation/feats-334/tmp/package.json', '{"type":"commonjs"}\n');
JS
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .catalog-curation/feats-334/candidates.json --out .catalog-curation/feats-334/draft
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .catalog-curation/feats-334/candidates.json --records .catalog-curation/feats-334/draft/records.json --descriptions --out .catalog-curation/feats-334/prose
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .catalog-curation/feats-334/candidates.json --records scripts/catalog/reviewed-curation.json --descriptions --out .catalog-curation/feats-334/final-reviewed
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .catalog-curation/feats-334/full-draft-current
pnpm -s catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .catalog-curation/feats-334/candidates.json --out .catalog-curation/feats-334/final-bounded
pnpm -s catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .catalog-curation/feats-334/final-full-current
pnpm -s catalog:format --check
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm test tests/catalog/feats-334.test.ts convex/feats334.integration.test.ts --maxWorkers=1
pnpm test tests/catalog convex/feats334.integration.test.ts --maxWorkers=1
git diff --check
```

The full `pnpm test` suite is reserved for the orchestrator's post-rebase landing gate, as the brief requires.

Both final previews verify the pinned commits/manifests without an override. The bounded inventory accounts for exactly 100 extracted feats, no excluded/unassigned candidates, and `coverageComplete: true`. Admission and required curation both **pass**: zero admitted, 100 individually held, zero dependent omissions, retained exceptions, or failures. All 67 description matches are checked; there are zero added/replaced/missing/stale records on reviewed resume and 29 unresolved optional descriptions.

The final full gate exits 1 with **23,037 entries, 538 resources, 51 admitted, 23,132 held, one dependent omission, zero retained exceptions, and 4,734 failures**. All 100 batch candidates are held without batch failures. Exact `(externalKey, reason)` comparison against the pre-edit full preview finds **zero new failures, zero removed failures, and no lost previous admissions**. The unchanged failures comprise 3,628 missing curation records outside this batch, 715 unaccounted inventory records, and 391 broken references. Full required coverage is 100 checked of 3,728, with 263 checked description matches and 111 unresolved optional descriptions. This is a successful batch gate with an incomplete full catalog, not a green release gate.

The final full-corpus drafter exits 0: 3,991 records, 3,628 new drafts, zero replacements/missing/stale, and 763 unresolved required mechanics in scratch. The batch's checked records remain intact. No drafted whole-corpus records are added to the tracked overlay.

All 100 tracked normalized bodies exactly match the independently executed final full CLI extraction. The earlier 427 assessments, 400 evidence objects, 104 holds, 296 overlay records and 26 shared Situations are preserved unchanged. This batch adds 100 assessments, 101 evidence objects, five notice holds and 67 overlay records. Both final previews have zero outstanding admitted notices or legal resources.

Bounded extraction fingerprint: `511e3a02b399dd8f760e720983086a3bd52f266a051a8515031816d0e2205dcb`. Full extraction fingerprint: `82c65c2e770f1d311e48009b1398207fc2776c96cab813bf0ba9609310ca0305`. Reviewed-input fingerprint shared by both final reports: `32fd482b18c9c9e961444194ac1f6f08a0e71e3b6bb8193d2bbb310fc7f70ec9`. Unchanged legal-resource fingerprint: `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e`. Bounded admission-report SHA-256: `b5ed8f1444fa9759c122b9b2516572a81cee2a91c11adb8f34c1c5fe7c798545`. Full admission-report SHA-256: `18edd236d4c114a46fb837d5346c59e856f8cf8351156ace3bbcbf9f1e66bebd`. Normalized fixture preview SHA-256: `75646a81fa005e8abafdecabe975f7cc98d72315b1e4001ba91027a3bbc04420`.

Initial isolated tests exposed two fixture assertion/serialization mistakes: absent optional properties must be omitted for Convex's saved shape, and trait-slot deactivation must not count the Fighter's bonus-feat slot. Initial typecheck then caught generic imported Note identifiers being passed as stored Convex IDs. The adapter now validates the actual local-only Note/Modifier conditions through runtime schemas, rejecting identifier-bearing conditions rather than casting them. Final focused verification passed **two files and 13 tests in 9.04 seconds**; final typecheck and fixture ESLint passed. The complete repository lint command passed, with its final fixture change checked separately. No product code changes were needed.

| Check | Final observed result |
| --- | --- |
| Pinned sources and `pnpm catalog:pin` | Pass; both clean pins verified without override; `sha256:6607d068facda14d40eddebe4e916952e8c668997ecadde9dbdc550e946f5518` |
| Reviewed bounded resume | Pass: 67 checked descriptions retained; zero added/replaced/missing/stale; 29 unresolved optional descriptions |
| Bounded import, admission and required curation | Pass: 100 feats accounted, 100 held, zero admissions or failures |
| Final full import/admission gate | Exit 1: 4,734 inherited failures; zero new or removed failure pairs and no lost admissions |
| Full-corpus drafter | Exit 0: 3,991 records; new drafts remain scratch-only |
| `pnpm -s catalog:format --check` | Pass |
| `pnpm -s typecheck` | Pass |
| `pnpm -s lint` | Pass; final `tests/fixtures/feats-334/sheet.ts` ESLint also passes |
| `pnpm -s check:initial-migration-writers` | Pass: 183 registrations |
| Focused batch catalog and isolated saved-sheet tests | Pass: two files, 13 tests, 9.04 seconds |
| `TMPDIR="$PWD/.catalog-curation/feats-334/tmp" pnpm test tests/catalog convex/feats334.integration.test.ts --maxWorkers=1` | Pass: 29 files, 437 tests, 59.32 seconds |
| Previous shared objects and normalized fixture audit | All previous objects preserved; all 100 bodies match final full CLI extraction |
| `git diff --check` | Pass |

## Timing and workflow observations

Work began at 17:11:04 UTC on 2026-10-07. These approximate windows overlap and are not additive labor estimates; total elapsed time through final reporting and cleanup is about 36 minutes.

| Phase | UTC window | Elapsed |
| --- | --- | --- |
| Source/policy review and drafts | 17:11–17:20 | About 9 minutes |
| Artifacts and mechanics review | 17:12–17:30 | About 18 minutes |
| Fixtures and tests | 17:12–17:36 | About 24 minutes |
| Independent review | Within the artifact/check windows | About 15 minutes, including waits |
| Baseline full preview | 17:13–17:18 | About 5 minutes |
| Final gates, report and cleanup | 17:25–17:47 | About 22 minutes |

Missing book PDFs keep every candidate attribution-held. The 33 descriptions outside the prose predicate were still reviewed manually; missing supported calculations remain named importer gaps. Unreviewed repeatability also remains explicit. The isolated adapter validates local conditions without inventing review status or permitting new catalog admission. Source-dependent assertions and checks ran again after the final artifact refinements.

The main session orchestrated briefs, reviews, commands and gates; subagents authored the artifacts, fixtures and report. Opus and Fable aliases are unavailable in this environment, so the available inherited model performed implementation and independent review. This includes a disclosed substitution for the requested Fable sample.

No product code or pinned source checkout was changed. Environment files and private E2E material were not accessed. No commits, pushes, GitHub writes, deployments, production writes, or Catalog Release activation occurred; the reviewed artifacts remain uncommitted. The full repository test suite remains the orchestrator's landing gate. Ignored worktree-local scratch was removed at 17:47 UTC after recording the evidence, and its absence was confirmed. The launcher captures the final response at its `-o` path; no answer file is written manually or stored in the repository.
