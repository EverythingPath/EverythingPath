# Archetype structures: eight mechanical Monk archetypes (#679)

The first #716 structure batch beyond the party (batch name `archetype-monk-1`; discriminator 679, the owning curation issue: [#679](https://github.com/AndreasUnunger/EverythingPath/issues/679) owns the monk Archetypes). Since `archetype-select-monk` the import emits 35 Monk archetypes behind `--pcgen`, every row held on its structure gate or omitted behind a held feature. This batch writes the structure records of eight of them, 44 rows, in `scripts/catalog/reviewed-curation.json` `structures`, written `drafted`: one archetype record and 36 feature records. The record step checked 36 of the 37 on a captured review (run `t3-review-362dfd4573e7e05fe5a73f66e6739ce642473c8a3dc25f0485a1d7b1b5a6bc2f`), and one stays drafted ([the record step](#the-record-step)). The rows are preview-only: no release scope names them (owner decision 2026-11-10).

Sources: PCGen at `25523dbc` (`roleplaying_game/advanced_players_guide/apg_abilities_class.lst`, `roleplaying_game/ultimate_combat/uc_abilities_class.lst`, `campaign_setting/inner_sea_combat/isc_abilities_class.lst`) and the PRD capture `prd-2026-10-20` (`advancedPlayersGuide/coreClasses/monk.html`, `ultimateCombat/classArchetypes/monk.html`, now in the pinned store). The capture has no Inner Sea Combat page, so PCGen is the only source for Monk of the Seven Forms. Each `sourceSha256` is the one the structure report of a `--pcgen` preview on the base `2093c32e` gives. No owner or feature record, and no `.MOD` line naming one, carries a Product Identity flag.

## The batch

Eleven of the 35 have only `stackingGuard` or `defect` items, or none, and no `%` token. Eight of them pass the further checks: the PRD's or PCGen's own text names every row the mapper replaces, at the level the Monk gains it, and no text carries a conditioned fragment.

| Archetype (book)                      | Rows | Records                                                    | Replaces, whole (level)                                                                                    |
| ------------------------------------- | ---: | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Flowing Monk (PZO1118)                |    7 | the archetype and six features (`description`)             | Bonus Feat (MNK) 1, Stunning Fist 1, Fast Movement 3, Purity of Body 5, Diamond Body 11, Quivering Palm 15 |
| Hungry Ghost Monk (PZO1115)           |    6 | five features (`description`)                              | Stunning Fist 1, Purity of Body 5, Wholeness of Body 7, Diamond Body 11, Diamond Soul 13                   |
| Monk of the Four Winds (PZO1115)      |    5 | four features (`description`)                              | Stunning Fist 1, Abundant Step 12, Timeless Body 17, Perfect Self 20                                       |
| Monk of the Healing Hand (PZO1115)    |    4 | three features (`description`)                             | Wholeness of Body 7, Diamond Body 11, Quivering Palm 15, Perfect Self 20                                   |
| Monk of the Lotus (PZO1115)           |    5 | four features (`description`)                              | Stunning Fist 1, Abundant Step 12, Quivering Palm 15, Tongue of the Sun and Moon 17                        |
| Monk of the Sacred Mountain (PZO1115) |    6 | five features (`description`)                              | Evasion 2, Slow Fall 4, High Jump 5, Improved Evasion 9, Tongue of the Sun and Moon 17                     |
| Monk of the Seven Forms (PZO9268)     |    5 | three features (`description`), Sirocco Fury `noMechanics` | Stunning Fist 1, Maneuver Training 3, Abundant Step 12, Quivering Palm 15                                  |
| Weapon Adept (PZO1115)                |    6 | five features (`description`)                              | Stunning Fist 1, Evasion 2, Improved Evasion 9, Timeless Body 17, Perfect Self 20                          |

- **The roots.** Only Flowing Monk's has a review item, `conflict` `stackingGuard`. Its record re-affirms the mapper's `detail.replaces`, `detail.adds` and `detail.featureChanges`. The flowing monk replaces the monk's bonus feat list with its own, and Unbalancing Counter replaces the bonus feat gained at 2nd level, so the Bonus Feat row is replaced whole. The PREMULT guard names the 2nd-level flag and not the whole one. It guards against other archetypes and removes nothing. The other seven roots have no item and need no record. Each was still checked row by row against its features' "This ability replaces …" (the table above), since their features' records admit them with the mapper's rows.
- **The descriptions.** Where the PRD has the archetype, each description is the PRD paragraph, without its heading, with links and emphasis as plain text and entities as characters. Redirection's two paragraphs are joined by a space. Three of these differ from PCGen's DESC. Adamantine Monk has DR 1/— (PCGen: 1/-). Flowing Monk's Bonus Feat has no asterisks or note. Volley Spell has no "(Core Rulebook 347)". Seven Forms' Bonus Feats, Lightning Finish and Endurance carry PCGen's DESC word for word.
- **Sirocco Fury** (`isc_abilities_class.lst:149`) is `noMechanics`. Its DESC is complete but carries scanning errors no allowed source corrects ("Path.finder RPG Ultimate Ma13ic 215", "dance ef a thousand cuts"). So no text is bound, as with Mad Dog's Rage Powers, and the row keeps PCGen's text. The trance is a spell effect the sheet doesn't calculate.
- **Aspect Master**'s description is its own paragraph. The six aspects are separate PRD paragraphs and a separate PCGen choice, not owned features. They stay outside the import.

## The record step

The review confirmed 36 records. The record step marked them `checked` with that run as their `receipt`. It did not confirm Flowing Monk's Bonus Feat (`everythingpath/monk-flowing-monk-bonus-feat`). Its description and source hash are right, but its rationale counted five feats that PCGen's DESC (`uc_abilities_class.lst:936`) marks with an asterisk, where the line marks eight. The rationale now says eight. Nothing else in the record changed, and it stays `drafted` until the next Monk batch's review.

As committed:

- **Admitted under #227: 42 of the 44 rows.** These are the other seven archetypes and their 30 features, and Flowing Monk's other five features (Redirection, Unbalancing Counter, Flowing Dodge, Elusive Target, Volley Spell), each on its declared book (PZO1115, PZO1118 or PZO9268).
- **Held on structure:** Flowing Monk's Bonus Feat. Its record is drafted, so the feature is still an unreviewed owned feature.
- **Omitted behind it:** Flowing Monk. Its own record is checked and settles its `stackingGuard` item, so the archetype is a dependent omission behind the held Bonus Feat.

No other emitted key changes state, and no release scope gains a row.

## Left out

| Archetype    | Why                                                                                                                                                                                                                                                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tetori       | The text and the mapper disagree. Inescapable Grasp "replaces abundant step, improved evasion, timeless body, and tongue of sun and moon" (PRD `ultimateCombat/classArchetypes/monk.html:413`; PCGen `uc_abilities_class.lst:1402`), but its `.MOD` FACT flags (`:1921`) omit all four, so the mapper's rows lack them. |
| Black Asp    | Black Asp's Path has a conditioned DESC fragment (`ui_abilities_class.lst:535`, `PRECLASS:1,Monk=3`). Forbidden Powers makes its exchanges optional per level (`:536`), while the mapper replaces all eleven rows whole. No text names what Black Asp's Path replaces, and there is no PRD page.                        |
| Treetop Monk | No allowed text names what any feature replaces or at which level it comes: the capture has no vanara page, and PCGen's DESCs (`arg_abilities_class.lst:983-986`) are silent. The only evidence is the TYPE flags the mapper read. The root's vanara requirement (`:981`) raises no item, an importer gap.              |

## What the sheet computes

Nothing new. No record gives a number: every feature keeps `modifiers: []`. Flowing Monk's record binds the mapper's own values. None of the replaced Monk rows carries a modifier. At Monk 1, 4 and 8 the archetypes change only which rows show and which go dormant. Some features carry numbers that stay prose:

- Iron Monk's +1 natural armor and Toughness (from 2nd level).
- Vow of Silence's insight bonuses (17th).
- Pure Power's +2 to three abilities (20th).
- Adamantine Monk's damage reduction (9th; the sheet has no damage-reduction target).
- Learned Master's class skills (17th).
- The granted bonus feats.

So from 2nd level the sheet shows a monk of the sacred mountain's AC one lower than the book's. A later `modifiers` record could bind it.

## Tests

[`archetype-structures-679.test.ts`](../../tests/catalog/archetype-structures-679.test.ts) runs on the pinned tree from one table: each archetype's PCGen record, book and reviewed replacements, and each feature's source hash and description source.

- The committed records have exactly these fields, items and hashes. 36 carry the record step's receipt and Bonus Feat is drafted. Each PRD description is read from the pinned page, and each PCGen one is the emitted DESC. The three left-out archetypes have no record.
- As committed, the 36 checked records settle their gates and apply. The 42 rows above are admitted under #227 on their declared books. Bonus Feat is held on structure as an unreviewed owned feature, and Flowing Monk is omitted behind it. No other key changes.
- Drafted in memory, no emitted key changes state against the overlay without the records. Every feature is held on structure, Flowing Monk's root on its item, and the other roots are omitted behind their features.
- With all 37 checked in memory (Bonus Feat checked by the test), every gate passes and the records apply. All 44 rows are admitted under #227 on their declared books, and no other key changes. Each archetype replaces exactly its reviewed rows, whole, and adds its features at their levels.

<!-- prep:shared-store-count -->
New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `12df6743`: **1** (prd 1).
<!-- /prep:shared-store-count -->
