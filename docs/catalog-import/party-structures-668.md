# Party structures: the Ecclesitheurge archetype (#668)

A #716 structure batch for the party (batch name `party-curation-6`; discriminator 668, the owning curation issue: [#668](https://github.com/AndreasUnunger/EverythingPath/issues/668) owns the cleric Archetypes). The import emits the Ecclesitheurge cleric archetype and its five owned features behind `--pcgen`: four since #716 E1, and Blessing of the Faithful through its reviewed grant ([README](README.md#pcgen-sources-716), "Reviewed grants"). Every row is held on the structure gate, and Domain Mastery also on Product Identity. This batch writes five structure records, in `scripts/catalog/reviewed-curation.json` `structures`, written `drafted`. The orchestrator's record step checked all five on a captured review, run `t3-review-08ed259d90e142e339a0516ea185a73236a0a954decf7f3d71e596eadcbfeb8c`, through a review receipt ([curation](curation.md#structure-records-716)).

Sources: PCGen at `25523dbc` (`roleplaying_game/advanced_class_guide/acg_abilities_class.lst:3014-3021` and the archetype's `.MOD` at `:4633`) and the PRD capture `prd-2026-10-20` (`advancedClassGuide/classOptions/cleric.html:349-359`). Each `sourceSha256` is the one the structure report of a `--pcgen` preview on the base `ae59f916` gives.

## The records

| Entry                                                  | Fields                                                                  | Settles                                                                                                                                                    |
| ------------------------------------------------------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `everythingpath/cleric-ecclesitheurge`                 | `detail.replaces`, `detail.featureChanges`: the channel energy row at 3 | `conflict` `partialFormula:channel-energy`, `conflict` `defect:channel-energy-steps`, `conflict` `defect:cleric-unwired-flags`, `conflict` `stackingGuard` |
| `…-cleric-ecclesitheurge-weapon-and-armor-proficiency` | `description` (cleric.html:351)                                         | its owned feature                                                                                                                                          |
| `…-ecclesitheurges-vow`                                | `description` (:352)                                                    | its owned feature                                                                                                                                          |
| `…-blessing-of-the-faithful`                           | `description` (:353)                                                    | its owned feature                                                                                                                                          |
| `…-bonded-holy-symbol`                                 | `description` (:357-359)                                                | its owned feature                                                                                                                                          |

Each description is the PRD paragraph word for word, without its heading and with its link and emphasis as plain text; Bonded Holy Symbol's three paragraphs are joined by a space. PCGen gives the same rules in slightly different words. Blessing of the Faithful's PCGen text (`:3018`) is the PRD's word for word except its range token, "close range (%1 ft.)" with `25+(floor(ClericLVL/2)*5)`, which the PRD prints as "(25 ft. + 5 ft./2 levels)". No record line except Domain Mastery's carries a Product Identity flag.

- **The channel energy row.** Bonded Holy Symbol "replaces the increase to channel energy gained at 3rd level" (:359; PCGen `:3021`). Table: Cleric gives 1d6 at 1st level and 1d6 more every two levels, so that increase is the row `everythingpath/cleric-channel-energy-3` ("Channel Energy 2d6"). The mapper reads PCGen's `ClericChannelEnergy3` (`:3014`, `.MOD` `:4633`) by order and names the row at 5th. PCGen gates nothing on these flags, so the replaced die comes from the text (`defect:channel-energy-steps`). `detail.featureChanges` moves to the same part.
- **What the gate items ask.** `partialFormula:channel-energy`: the sheet computes no channel dice. Foundry's `(ceil(@class.level / 2))d6` stays uninterpreted game content, and every channel energy row carries no modifier. The remaining rows are the table's rows, and the ecclesitheurge's dice stay prose. `defect:cleric-unwired-flags`: the proficiency flags remove nothing in PCGen. The proficiency change stays prose, and the Weapon and Armor Proficiency feature carries it. `stackingGuard`: the PREMULT guards the proficiency, `ClericChannelEnergy3` and `ClericDomains` TYPEs against other archetypes. `ClericDomains` is Domain Mastery's "alters the domains ability" (:356).
- **The features** bind text only. The proficiencies, the armor restriction, the blessing's +2 to one chosen ally and the bonded object stay prose.

## Left to the owner

**Domain Mastery** (`everythingpath/cleric-ecclesitheurge-domain-mastery`) carries `DESCISPI:Yes` (`:3020`, owner decision 3, O5). It has no record and no description, and stays held on Product Identity.

## What the sheet computes

Nothing new. No record gives a number. Once the archetype is admitted, at Cleric 5 the row "Channel Energy 2d6" (3rd level) is dormant, replaced by the archetype, and Channel Energy and "Channel Energy 3d6" (5th level) are shown. With the mapper's value it would have been the other way round. The ecclesitheurge channels 2d6 at 5th level. The row names are the table's, so from 5th level the highest one shown reads one die above that.

## After the record step

The record step checked the five records (run `t3-review-08ed259d90e142e339a0516ea185a73236a0a954decf7f3d71e596eadcbfeb8c`). The archetype's four items and the four features pass the gate and all five records apply. The four features are admitted under #227 on their declared book, PZO1129. The archetype's `detail.adds` names Domain Mastery, so the archetype is a dependent omission behind it until the owner answers O5. Domain Mastery is unchanged: it stays held on Product Identity and is the owner's. Until the owner answers, a sheet has the four features but not the archetype, and no channel energy row goes dormant.

## Tests

[`party-structures-668.test.ts`](../../tests/catalog/party-structures-668.test.ts) runs on the pinned tree:

- The committed records have exactly these fields, items and hashes. Domain Mastery has none.
- As committed, checked, every gate item but Domain Mastery's is settled and the five records apply (none invalid). The four features are admitted on PZO1129 with `modifiers: []`. The archetype is omitted behind Domain Mastery, which stays held on Product Identity.
- As committed, checked, the archetype replaces the row at 3rd level, not the mapper's at 5th, and keeps the mapper's additions. The Cleric's channel energy rows stay admitted with no modifier.
- The committed records carry the record step's receipt. Drafted in memory, the archetype is held on its four items and the four features on structure. This is the only case that depends on the records' status.

<!-- prep:shared-store-count -->
New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `2e64f6db`: **0**.
<!-- /prep:shared-store-count -->
