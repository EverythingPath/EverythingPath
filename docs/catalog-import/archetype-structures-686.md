# Archetype structures: four mechanical Ranger archetypes (#686)

A #716 structure batch by class (batch name `archetype-ranger-1`; discriminator 686, the owning curation issue: [#686](https://github.com/AndreasUnunger/EverythingPath/issues/686) owns the ranger Archetypes). Since `archetype-select-2` the import emits 48 Ranger archetypes behind `--pcgen`, every row held on its structure gate or omitted behind a held feature. This batch writes the structure records of four of them, 17 rows, in `scripts/catalog/reviewed-curation.json` `structures`: two root records and thirteen feature records. Twelve are checked by the record step; three stay drafted ([The record step](#the-record-step)). The rows are preview-only: no release scope names them (owner decision 2026-11-10).

Sources: PCGen at `25523dbc` (`roleplaying_game/advanced_players_guide/apg_abilities_class.lst`, `roleplaying_game/ultimate_combat/uc_abilities_class.lst`) and the PRD capture `prd-2026-10-20` (`advancedPlayersGuide/coreClasses/ranger.html` and `ultimateCombat/classArchetypes/ranger.html`, both added to the pinned store byte-identical by this batch). Each `sourceSha256` is the one the structure report of a `--pcgen` preview on the base `538da1ae` gives. No owner or feature record, and no `.MOD` line naming one, carries a Product Identity flag.

## The batch

Twelve of the 48 have no review item but `stackingGuard`, PCGen defects and owned features by the selection's count. Four of them pass the further checks: an allowed text names every row the mapper replaces, at the level the Ranger gains it, no text carries a `%`, a conditioned fragment or a scanning error, the text and the mapper agree, and no feature gives a number, feat, proficiency or count the sheet computes (root's description-only bar, 2026-11-18).

| Archetype     | Book    | Rows | Records                                     | Replaces (level, all whole)                                                                     |
| ------------- | ------- | ---: | ------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Guide         | PZO1115 |    6 | the root (`detail.replaces`), five features | Favored Enemy 1, Hunter's Bond 4, Evasion 9, Quarry 11, Improved Evasion 16, Improved Quarry 19 |
| Infiltrator   | PZO1115 |    2 | one feature (`description`)                 | Favored Terrain 3                                                                               |
| Spirit Ranger | PZO1115 |    3 | two features (`description`)                | Hunter's Bond 4, Camouflage 12                                                                  |
| Warden        | PZO1118 |    6 | the root (`detail.replaces`), five features | Favored Enemy 1, Combat Style Feat 2, Hunter's Bond 4, Master Hunter 20                         |

- **The roots.** The Guide's root carries two PCGen defects (Improved Evasion and Improved Quarry gated on Evasion's and Quarry's flags) and the Warden's a stacking guard that leaves out master hunter. Neither item names a field; each root record binds `detail.replaces` with the mapper's rows, re-affirmed: the guide's text replaces both rows of each pair, and the warden's PREMULT guards against other archetypes and removes nothing. The Infiltrator's and Spirit Ranger's roots have no item and no record. Each root was checked row by row against its features' "This ability replaces …" in the PRD and the base Ranger's levels (CRB `coreRulebook/classes/ranger.html:420-468`); the Warden's three features together replace every favored enemy, so the whole row goes at 1st level.
- **The descriptions.** Each is the PRD's text for the feature, without its heading, with links and emphasis as plain text, entities as characters and a feature's paragraphs joined by a space. After flattening, four differ from PCGen's DESC and take the PRD's: Improved Ranger's Luck (PCGen "-4"), Spirit Bond and Wisdom of the Spirits (PCGen adds the Core Rulebook page references), and Adaptation (PCGen keeps the adaptation list in 31 child records, without the curly quotes round "aberrations"; the PRD gives the list inside the feature, 23 paragraphs, and the description takes it). Ranger's Focus is two PRD paragraphs and equals PCGen's DESC once they are joined. The other eight equal PCGen's DESC.
- **The Ranger class.** It is a dependent omission behind Combat Style Feat, whose combat styles include Elemental (`pf1/oqhuuEVURDTmnSKT`), held on PZO9488's notice. A root depends on the features it adds and the rows it replaces, not on its class: with all fifteen checked the Guide, Infiltrator and Spirit Ranger roots would be admitted and the Warden's, which replaces Combat Style Feat, would stay a dependent omission behind it.

## The record step

The record step checked twelve records on the captured review `t3-review-51dd0f934d113dafdaaa68853081daa725b60c9c27ba0c27640ce2f87bab3237` (FIX FIRST, reviewer gpt-6.2-sol): both roots, Ranger's Focus, Ranger's Luck, Inspired Moment, Improved Ranger's Luck, Adaptation, Wisdom of the Spirits, Master of Terrain, Live in Comfort, Able Explorer and Wilderness Whispers. Its two hard findings are on the other three, which stay drafted exactly as reviewed (root's decision, 2026-11-22), so a later promotion can confirm them unchanged:

- **Guide Terrain Bond, Spirit Bond, Warden Terrain Bond.** Each replaces Hunter's Bond, and the companion calculation still counts a Ranger Class Level's animal-companion entitlement after Hunter's Bond is replaced (`convex/lib/companionRelationshipGraph.ts`, `isEntitledCompanionSource`; `src/lib/character-sheet-companion-sources.ts`, `ordinaryEffectiveLevel`). That is a defect in the companion code, not in the descriptions; it is its own slice (`companion-entitlement-replaced`).
- **Spirit Bond** also grants extra castings of a Ranger spell he can cast, which the sheet's spells per day do not count; it waits for a way to carry them.

**What is admitted, as committed:** 11 of the 17 rows, under #227 on their declared books: the Guide's four other features, the Infiltrator's root and Adaptation, Wisdom of the Spirits, and the Warden's four other features. The three drafted features are held on structure (owned feature unreviewed). The Guide's root is a dependent omission behind its Terrain Bond, the Spirit Ranger's behind Spirit Bond, the Warden's behind its Terrain Bond and Combat Style Feat. Only the Infiltrator's root is admitted.

**Release scope.** The Guide, the Spirit Ranger and the Warden must not enter a release scope until their drafted feature is checked. Two existing gates enforce it: the structure gate holds a drafted feature, and the admission gate omits a root behind it (the batch test's committed case); a scope build includes only rows the gate admitted, so a scope naming one of these roots holds it and does not qualify (`tests/catalog/release-scope.test.ts`, "includes the Fighter's admitted increments … and nothing the gate did not admit" and "qualifies only when every required row is included and the scope has no finding").

## Left out

| Archetype      | Why                                                                                                                                                                                                                                 |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Divine Tracker | Favored Weapon grants proficiency with the deity's favored weapon, or Improved Unarmed Strike as a bonus feat (`acg_abilities_class.lst:3545`): an entitlement no record field holds.                                               |
| Drake Warden   | Young Drake's DESC has a scanning error ("his ranger level 3", `lod_abilities_class.lst:328`), and no text names the three rows the mapper replaces; the capture has no Legacy of Dragons page.                                     |
| Dungeon Rover  | No feature names what it replaces (`dh_abilities_class.lst:20-25`); the capture has no Dungeoneer's Handbook page.                                                                                                                  |
| Dusk Stalker   | Text against the mapper: the text removes one class skill, Knowledge (nature) (PRD `advancedRaceGuide/featuredRaces/fetchlings.html:403`), the mapper fifteen; Shadow Guide modifies favored terrain, the mapper replaces it whole. |
| Toxophilite    | No feature names what it replaces (`rtt_abilities_class.lst:88-92`); the capture has no Ranged Tactics Toolbox page.                                                                                                                |
| Trophy Hunter  | Firearm Style grants the Amateur Gunslinger feat and Exotic Weapon Proficiency (firearms) (PRD `ultimateCombat/classArchetypes/ranger.html:378`): grants no record field holds.                                                     |
| Wild Stalker   | Strong Senses gives an unconditional Perception bonus whose levels PCGen and the PRD give differently and whose amount depends on low-light vision from another source (`uc_abilities_class.lst:1574`; PRD `:389`).                 |
| Yokai Hunter   | Favored Yokai has no DESC (`dep_abilities_class.lst:40`), its six sub-records carry `%1`/`%2` tokens, and no text names favored enemy as replaced; the capture has no Dragon Empires Primer page.                                   |

## What the sheet computes

Nothing new. No record gives a number: every feature keeps `modifiers: []`, and the root records re-affirm the mapper's rows. None of the replaced Ranger rows carries a Modifier or rule value; Combat Style Feat's one change (`bonusFeats`) is unmapped, so its dormancy removes no feat slot the sheet counts. Hunter's Bond's dormancy does not reach the companion calculation, which still counts a linked companion's Ranger class levels: the review's finding, and why the three records that replace it stay drafted. At Ranger 1, 4 and 8 the archetypes change only which rows show and which go dormant. What stays prose, each situational or nothing the sheet computes:

- Ranger's Focus's bonus against one chosen target and its uses per day; Terrain Bond's bonuses to allies in a favored terrain; Ranger's Luck's rerolls and their uses per day; Inspired Moment's one-turn bonuses.
- Adaptation's abilities and feats, usable only while the ranger uses one, 10 minutes per day per level.
- Spirit Bond's augury and Wisdom of the Spirits' divination, spell-like abilities. Spirit Bond's extra Ranger castings are a count the sheet's spells per day would carry, so its record stays drafted.
- The Warden's extra favored terrain, Live in Comfort's taking 10 or 20 on Survival, Able Explorer's second roll and Wilderness Whispers' initiative, each in a favored terrain.

No per-day maximum is bound: no committed per-day record keys any of these counts.

## Tests

[`archetype-structures-686.test.ts`](../../tests/catalog/archetype-structures-686.test.ts) runs on the pinned tree from one table: each archetype's file, page, book, reviewed replacements and root items, and each feature's level, source hash and PRD lines.

- The committed records have exactly these fields, items and hashes: twelve checked under the record step's receipt, the three the table marks drafted. Each description is read from the pinned PRD page; each root record's rows equal the mapper's. The eight left-out archetypes have no record.
- As committed, the twelve apply and 11 rows are admitted under #227 on their declared books (PZO1115, PZO1118); the three drafted features are held on structure; the Guide, Spirit Ranger and Warden roots are dependent omissions behind the rows above; no other key changes.
- Drafted in memory, no emitted key changes state against the overlay without the records. Every feature and the Guide and Warden roots are held on structure; the other two roots are omitted behind their features.
- With the fifteen checked in memory, every gate passes and the records apply. Sixteen rows are admitted under #227 on their declared books; the Warden's root stays a dependent omission behind Combat Style Feat; no other key changes. Each archetype replaces exactly its reviewed rows and adds its features at their levels.

The two status-dependent cases (the committed records and their outcomes) are marked in the test. It reads the APG and UC ranger pages, which the pinned store lacked, added byte-identical from the capture.

<!-- prep:shared-store-count -->
New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `895fc393`: **2** (prd 2).
<!-- /prep:shared-store-count -->
