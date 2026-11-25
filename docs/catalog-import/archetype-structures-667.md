# Archetype structures: four mechanical Cavalier archetypes (#667)

The third #716 structure batch by class (batch name `archetype-cavalier-1`; discriminator 667, the owning curation issue: [#667](https://github.com/AndreasUnunger/EverythingPath/issues/667) owns the cavalier Archetypes). Since `archetype-select-2` the import emits 26 Cavalier archetypes behind `--pcgen`, every row held on its structure gate or omitted behind a held feature. This batch wrote the structure records of four of them, 18 rows, in `scripts/catalog/reviewed-curation.json` `structures`, written `drafted`: fourteen feature records. The record step checked all fourteen on a captured review; Beast Rider's two and the Musketeer's three then left the tree, so two archetypes land: Standard Bearer and Ghost Rider, nine records, 10 of their 11 rows admitted when they landed and all 11 since the Master Tactician record was checked ([The record step](#the-record-step)). The rows are preview-only: no release scope names them (owner decision 2026-11-10).

Sources: PCGen at `25523dbc` (`roleplaying_game/ultimate_combat/uc_abilities_class.lst`, `roleplaying_game/occult_adventures/oa_abilities_class.lst`) and the PRD capture `prd-2026-10-20` (`ultimateCombat/classArchetypes/cavalier.html`, `occultAdventures/archetypes/other.html`, both already in the pinned store). Each `sourceSha256` is the one the structure report of a `--pcgen` preview on the base `9a7cb879` gives. No owner or feature record, and no `.MOD` line naming one, carries a Product Identity flag.

## The batch

Thirteen of the 26 have no review item but `stackingGuard` and owned features by the selection's count. Four of them passed the first screening: the PRD's own text names every row the mapper replaces, at the level the Cavalier gains it, no text carries a `%` or a conditioned fragment, and no feature seemed to need more than its description. Read against the description-only bar, that holds for two: Standard Bearer and Ghost Rider land with descriptions. Beast Rider and the Musketeer have four features that need bindings the records cannot give yet; they wait for them, and their records are not in the tree ([The record step](#the-record-step)).

| Archetype       | Book    | Rows | Records                        | Replaces, whole (level)                                                                                                                              |
| --------------- | ------- | ---: | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Beast Rider     | PZO1118 |    3 | two features (`description`)   | Mount 1, Expert Trainer 4                                                                                                                            |
| Musketeer       | PZO1118 |    4 | three features (`description`) | Mount 1, Expert Trainer 4                                                                                                                            |
| Standard Bearer | PZO1118 |    5 | four features (`description`)  | Mount 1, Banner 5, Mighty Charge 11, Supreme Charge 20                                                                                               |
| Ghost Rider     | PZO1132 |    6 | five features (`description`)  | Mount 1, Tactician 1, Cavalier's Charge 3, Expert Trainer 4, Banner 5, Greater Tactician 9, Mighty Charge 11, Greater Banner 14, Master Tactician 17 |

- **The roots.** None has a review item, so none has a record. Each was still checked row by row against its features' "This ability replaces …" in the PRD and PCGen (the table above), since their features' records admit them with the mapper's rows. Exotic Mount replaces mount and expert trainer; Standard Bearer's own Banner replaces mount and its own Mount replaces banner; Frightful Gaze replaces all three tactician rows; Spirited Mount replaces expert trainer and banner; Ghost Wind replaces mighty charge and greater banner.
- **The descriptions.** Each is the PRD's text for the feature, without its heading, with links and emphasis as plain text, entities as characters and a feature's paragraphs joined by a space. Of the fourteen written, ten equal PCGen's DESC, Frightful Gaze among them once its two PRD paragraphs are joined (seven of the nine in the tree). Four take the PRD's where PCGen differs: Exotic Mount (PCGen "modifications -" and "Dex -2"), Gifted Firearm (PCGen adds a sentence, moves another and lacks "This ability replaces the standard cavalier's mount ability."), Awesome Pennon (PCGen "mindaffecting") and Ghost Mount (PCGen lacks the starting statistics and "This ability replaces mount."); Awesome Pennon and Ghost Mount are the two in the tree.
- **Mounts.** Each archetype replaces the Mount row, and its text says so. The new mount stays prose: the sheet's cavalier mount is a companion the Character records (`cavalierMount`), not a computation of that row.
- **Ghost Rider's root** replaces Master Tactician (`pf1/mrJ61WiA6PuZgPTJ`, Foundry's "Master Tacitician"), which had no PCGen match and was held under #227, so the root stayed a dependent omission behind it once its features passed, as did the Cavalier class. The row's reviewed PCGen record ([curation](curation.md#the-227-admission-rule)) is checked since tactician-promote (`t3-review-9ef9ecc82fcfb4577734e838cda2aaa55ad15bc85331eafc881010808f494f83`), so the row is admitted on PZO1115, and with it the Cavalier class and Ghost Rider's root.

## The record step

The review (`t3-review-7f52cf6d659a198a038d487c75abb7d61834f27a4808d3e8437c42e9803d1a4c`) confirmed all fourteen records, and the record step marked them `checked` with that run as their `receipt`. Read again against the 2026-11-18 description-only bar (a feature may be recorded with its description only when taking the archetype leaves nothing on the sheet wrong), four are not honest: Beast Rider's Armor Proficiency and the Musketeer's Weapon And Armor Proficiency change proficiencies the sheet tracks as entitlements, and the Musketeer's Gifted Firearm (Gunsmithing) and Swift Powder (Rapid Reload) grant feats the sheet counts against slots. An archetype with one such feature is not offered with the rest, so Beast Rider and the Musketeer are left out whole, and their five records leave the tree. The batch's receipt covers only the nine landed records: the orchestrator removed the five held IDs from its `covers`, so a copy rebuilt from the sources cannot reuse the old approval and `--verify` refuses it, while the committed report copy stays the record of all fourteen decisions. The later slice that binds their proficiency and feat grants rewrites them with new fields, so they will need their own review. Standard Bearer's four and Ghost Rider's five stay checked.

Still queued (`receipt-revocation`): a deliberate re-run of the record step on the old run could add those covers again.

As committed:

- **Admitted under #227: 11 rows.** Standard Bearer and its four features on PZO1118, and Ghost Rider's root and five features on PZO1132; the root since the Master Tactician record was checked (tactician-promote). With that record drafted, the root is omitted behind the held Master Tactician.
- **Keep their state:** Beast Rider's and the Musketeer's seven rows, each feature held on structure and each root omitted behind its features.

Each landed archetype replaces its reviewed rows, whole, and adds its features at their levels. No other emitted key changes state, and no release scope gains a row.

## Left out

Beast Rider and the Musketeer are left out after the record step (above); the nine below were left out before it. All keep their state.

| Archetype         | Why                                                                                                                                                                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Beast Rider       | Armor Proficiency removes heavy armor proficiency, which the sheet keeps from the Cavalier: a beast rider in heavy armor would show no nonproficiency penalty on attacks. It waits for a proficiency removal an archetype record can bind (with a sheet test). Exotic Mount is honest as prose and waits with it.                                             |
| Musketeer         | Weapon And Armor Proficiency removes heavy armor and adds firearms (a musketeer's firearm would take −4 "Not proficient"); Gifted Firearm grants Gunsmithing and Swift Powder Rapid Reload, which would take a general slot or warn as beyond the allowance. It waits for a proficiency removal and grant, and a granted feat or feat slot, an archetype record can bind. |
| Spellscar Drifter | The capture has no Inner Sea Combat page, and four of PCGen's DESCs (`isc_abilities_class.lst:212-221`) have scanning errors ("io + his character level", "id4 rounds", "i5th", "ist-level"): verbatim binds them, correcting them invents.                                |
| Wave Rider        | The text and the mapper disagree. Seafaring Companion "replaces the cavalier's mount ability" (`isc_abilities_class.lst:244`), but PCGen flags only the proficiencies (`:592`), so the mapper replaces no row.                                                             |
| Huntmaster        | The text and the mapper disagree. Its Tactician "modifies" the three tactician abilities (`anar_abilities_class.lst:24`), which the mapper replaces whole; Bestial Challenge and Animal Trainer modify challenge and expert trainer (`:22`, `:26`).                        |
| Herald Squire     | Fleet of Foot's DESC (`kotis_abilities_class.lst:13`) has PCGen's escape `20%%`, emitted unread; the capture has no Knights of the Inner Sea page.                                                                                                                         |
| Drakerider        | No allowed text names most of what it replaces: Drake Mount names only the mount and the delayed cavalier's charge (`lod_abilities_class.lst:228`); the tactician, expert trainer and banner rows come from the flags alone.                                               |
| Emissary          | The text and the mapper disagree. Bonus Feats widens the bonus-feat list (PRD `ultimateCombat/classArchetypes/cavalier.html:395`), but the mapper replaces Bonus Feat whole, so the sheet would drop its bonus-feat slots at 6, 12 and 18.                                 |
| Gendarme          | Bonus Feats grants restricted bonus feats at 1st, 5th and every three levels (PRD `:403`) in place of the cavalier's; with the base slots dormant and none bound, the sheet would show none (0, 0, 0 at 1, 4, 8 against the book's 1, 1, 3). A slot record is a follow-up. |
| Honor Guard       | The mapper misses a feature: the 12th-level Defensive Challenge (PRD `:410`), which replaces demanding challenge, has no PCGen record; its text is joined onto Warding Charge's DESC (`uc_abilities_class.lst:499`).                                                       |
| Daring General    | No allowed text names what any feature replaces: the capture has no Ultimate Intrigue page, and PCGen's DESCs (`ui_abilities_class.lst:291-300`) are silent.                                                                                                               |

## What the sheet computes

Nothing new. No record gives a number: every feature keeps `modifiers: []`, and no root has a record. None of the replaced Cavalier rows carries a modifier or a slot (only the Bonus Feat rows grant slots, and none of the four replaces them). At Cavalier 1, 4 and 8 the two landed archetypes change only which rows show and which go dormant. What stays prose, each situational or outside what the sheet computes:

- The new mounts: Ghost Mount's phantom and its starting statistics, Spirited Mount's and Ghost Wind's walks and flight, Standard Bearer's mount from 5th.
- The Standard Bearer's banner bonuses, Banner of Solace's temporary hit points and Awesome Pennon's morale bonuses.
- Frightful Gaze's Will DC and uses per day; Fearless's fear immunity and its allies' +4 morale bonus against fear.

## Tests

[`archetype-structures-667.test.ts`](../../tests/catalog/archetype-structures-667.test.ts) runs on the pinned tree from one table: each archetype's file, book and reviewed replacements, and each feature's level; a landed feature also has its source hash and PRD lines, a held one only its key and locator, so the test holds nothing a held record could be rebuilt from.

- The committed records (this case reads the records' state) have exactly these fields, items and hashes: Standard Bearer's and Ghost Rider's nine checked under the review's receipt. Each description is read from the pinned PRD page. Beast Rider, the Musketeer and the nine left-out archetypes have no record.
- As committed (this case reads the records' state, the Master Tactician record's included), the nine apply and 11 rows are admitted under #227 on their declared books, Ghost Rider's root among them, and Master Tactician is admitted on its reviewed PCGen record; Beast Rider's and the Musketeer's rows keep their state; no other key changes.
- Drafted in memory, the nine change no emitted key's state against the overlay without the records: every feature is held on structure, and the roots are omitted behind their features.
- Checked in memory, whatever their committed state, the nine pass every gate and apply, with the same 11 rows admitted and the same rows kept; with the Master Tactician record also drafted in memory, 10, Ghost Rider's root omitted behind the held Master Tactician and no other key changing. Each archetype replaces exactly its reviewed rows, whole, and adds its features at their levels.

The test reads nine Cavalier class-ability records the pinned store lacked (Mount, Tactician, Cavalier's Charge, Expert Trainer, Greater Tactician, Mighty Charge, Demanding Challenge, Master Tactician, Supreme Charge), added byte-identical from the Foundry pin. The feats-342 batch held Expert Trainer as its own copy (`tests/fixtures/feats-342/supporting-sources/`), which is now a relative link to the store file, as `pnpm catalog:link-copies` writes it.

<!-- prep:shared-store-count -->
New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `c3398edf`: **9** (pf1 9).
<!-- /prep:shared-store-count -->
