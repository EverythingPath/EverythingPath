# Party structures: the Mad Dog archetype (#662)

A #716 structure batch for the party (batch name `party-curation-5`; discriminator 662, the owning curation issue: [#662](https://github.com/AndreasUnunger/EverythingPath/issues/662) owns the barbarian Archetypes). The import emits the Mad Dog barbarian archetype and its seven owned features behind `--pcgen` since #716 E1, every row held on the structure gate. This batch writes the eight structure records that settle that gate, in `scripts/catalog/reviewed-curation.json` `structures`, written `drafted`. The orchestrator's record step checked all eight on a captured review, run `t3-review-fbabc9ada1c607828183d4910aee9f9a6fddf67218a3c732eb81af082ae0cd6d`, through a review receipt ([curation](curation.md#structure-records-716)).

Source: PCGen at `25523dbc` (`player_companion/animal_archive/anar_abilities_class.lst`, with the Barbarian's archetype switches in `roleplaying_game/core_rulebook/cr_abilities_globalvar.lst`). The PRD capture `prd-2026-10-20` has no page for Mad Dog or Animal Archive, so PCGen is the only source. Each `sourceSha256` is the one the structure report of a `--pcgen` preview on the base `48d24b0a` gives. No Animal Archive record carries a Product Identity flag.

## The records

| Entry                                     | Fields                                                                  | Settles                                                                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `everythingpath/barbarian-mad-dog`        | `detail.replaces`, `detail.adds`, `detail.featureChanges`: the mapper's | `unmatchedReplacement` `unknown:CFRagePower`, `unmatchedReplacement` `alters:damage-reduction`, `conflict` `stackingGuard` |
| `…-barbarian-mad-dog-war-beast`           | `description` (`:81`)                                                   | its owned feature                                                                                                          |
| `…-pack-tactics`, `…-rage`                | `description` (`:82`, `:83`)                                            | each its owned feature                                                                                                     |
| `…-ferocious-fetch`, `…-damage-reduction` | `description` (`:84`, `:85`)                                            | each its owned feature                                                                                                     |
| `…-throat-cutter`                         | `description` (`:86`)                                                   | its owned feature                                                                                                          |
| `…-rage-powers`                           | `noMechanics`                                                           | its owned feature                                                                                                          |

- **The archetype.** `detail.replaces` re-affirms the mapper's nine rows, each the switch of one of the archetype's TYPE removal flags (`:7`; `cr_abilities_globalvar.lst:105-136`): Rage whole at 1st level (the mad dog gains it at 4th, `:83`); Uncanny Dodge at 2nd, Improved Uncanny Dodge at 5th and Indomitable Will at 14th, whole (Pack Tactics, Ferocious Fetch and Throat Cutter replace them, `:82`, `:84`, `:86`); and the rage powers in part at 2nd, 6th, 10th, 14th and 18th (War Beast, `:81`). `BarbarianCFRagePower` is a touch flag with no switch of its own and names no further row. The stacking guard (the PREMULT, `:7`) guards against other archetypes and removes nothing.
- **Damage reduction.** `detail.adds` and `detail.featureChanges` keep the mapper's values: Mad Dog's Damage Reduction is an addition at 10th level (`:85`, `DR:MadDogDRBonus/-` with `(BarbarianLVL-7)/3`) that names nothing it replaces, and the Barbarian's Damage Reduction from 7th level and its increments stay. PCGen removes the barbarian's damage reduction only through an archetype TYPE `BarbarianDamageReduction` or `BarbarianDamageReduction<n>` (`cr_abilities_globalvar.lst:125-130`); Mad Dog has none, and no `.MOD` or `REMOVE` names it. **This is root's default (2026-11-16) on an open owner question, G2: whether the printed Animal Archive p.9 alters the barbarian's damage reduction. Reversing it is this one record.** How the two damage reductions combine from 10th level stays prose.
- **The features.** Each description is PCGen's DESC word for word: complete, with no tokens. War Beast is the companion-e3 handoff's record: the companion's effective druid level is the `madDogCompanion` rule, keyed on the feature's identity, so it is never `noMechanics`. The flanking bonus, rage at level − 3, the war beast's bonus feat and drag, the damage reduction value (the sheet has no damage-reduction target) and the attack of opportunity stay prose. Rage Powers lists rage powers that complement the archetype and grants nothing; its DESC carries footnote markers (`totemArc`, `leaper0c`) no allowed source resolves, so no description is bound and the row keeps PCGen's text.

## What the sheet computes

Nothing new: no record gives a number, and the archetype's record binds the mapper's own values. At Barbarian 8 the damage reduction is 1/- before and after: the Barbarian's row from 7th level stays, and Mad Dog's starts at 10th. The sheet computed no damage-reduction number then; since stats-dr, the checked rule-value records give both lines ([Rule values](../character-sheet/rule-values.md#which-entries-carry-rule-values)).

## After the record step

The record step checked the eight records (run `t3-review-fbabc9ada1c607828183d4910aee9f9a6fddf67218a3c732eb81af082ae0cd6d`). The archetype and its seven features pass their structure gate and are admitted under #227 on their declared book, PZO9429. Every row the archetype replaces, and the Barbarian, is admitted. The damage reduction is still root's default on the owner's open question G2: Mad Dog's is an addition at 10th level and the Barbarian keeps its own, until the owner answers.

## Tests

[`party-structures-662.test.ts`](../../tests/catalog/party-structures-662.test.ts) runs on the pinned tree:

- The committed records have exactly these fields, items and hashes.
- As committed, checked, the gates pass, the seven field records apply (none invalid) and the eight rows are admitted on PZO9429. The features keep `modifiers: []`.
- As committed, checked, the archetype adds its damage reduction at 10th level and neither replaces nor changes the Barbarian's damage reduction or its increments; its applied rows are the reviewed ones.
- The committed records carry the record step's receipt. Drafted in memory, the archetype and all seven features are held on structure. This is the only case that depends on the records' status.

<!-- prep:shared-store-count -->
New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `0cd44e5f`: **0**.
<!-- /prep:shared-store-count -->
