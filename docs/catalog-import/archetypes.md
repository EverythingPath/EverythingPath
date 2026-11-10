# Representative Archetype schedules

The prepared Character Sheet catalog includes Fighter and Rogue feature schedules through class level 20 and two representative Archetypes: Archer and Scout. These specimens exercise feature replacement, independent progression parts, additions, prompts, restoration and the advisory duplicate-feature upgrade. They are not a curated Catalog Release or a claim that either class's feature mechanics and choices are fully implemented.

`convex/lib/representativeClassCatalog.ts` preserves the existing class definition array and exports reference-key schedules. `convex/lib/representativeArchetypeCatalog.ts` supplies every referenced feature plus the Archetypes. Materialization translates class, feature and upgrade keys into real Catalog Entry IDs; `parentFeature` and `part` are durable semantic identities, not document references. Each increment has a separate Grant Key, so retaining one increment never accidentally preserves another.

## Sources and review limits

| Specimen | Book and page | Source reference |
| --- | --- | --- |
| Fighter schedule and abilities | Pathfinder RPG Core Rulebook, pp. 56–57, Table 3–9 | [Paizo PRD Fighter](https://paizo.com/pathfinderRPG/prd/coreRulebook/classes/fighter.html) |
| Rogue schedule and abilities | Pathfinder RPG Core Rulebook, pp. 68–70, Table 3–13 | [Paizo PRD Rogue](https://paizo.com/pathfinderRPG/prd/coreRulebook/classes/rogue.html) |
| Archer | Pathfinder RPG Advanced Player's Guide, p. 104 | [Paizo PRD Fighter Archetypes](https://paizo.com/pathfinderRPG/prd/advancedPlayersGuide/coreClasses/fighter.html) |
| Scout | Pathfinder RPG Advanced Player's Guide, p. 134 | [Paizo PRD Rogue Archetypes](https://paizo.com/pathfinderRPG/prd/advancedPlayersGuide/coreClasses/rogue.html) |
| Feature/part compatibility | Advanced Player's Guide p. 72 and Paizo's 2015 Archetype FAQ | Repository decision #225 and #238 source corpus; [Paizo APG FAQ](https://paizo.com/paizo/faq/v5748nruor1fn) |

These are source references, not a report of live URL verification. Network use is prohibited in the implementation sandbox. The offline pinned Foundry PF1 v11.11 data supplies the base-class and ability descriptions: Fighter `WLqBCT5DqmGAx8Wd`, Rogue `24b0LaabeAlUx5gN`, Uncanny Dodge `7WaQxnVaaoL4AGr8` and Improved Uncanny Dodge `ZfnHhhTFQVo0Lj4P`, among others. Its class associations list first acquisition rather than every printed table increment; the prepared schedules therefore expand those documented progressions.

The pinned pf1-content 11.4.0 checkout contains no Archer or Scout Archetype definitions or their feature descriptions. The Archer and Scout rows here are representative source-reference transcriptions, not claimed extracted records. Its `Hawkeye` record `GG6I9gZr2QTJwL50` is a Druid domain power and is deliberately excluded. A content batch must verify these specimens against the admitted official source text, FAQ and errata, establish attribution/notices, and curate the remaining mechanics before admitting them to a numbered release. No downstream consumer should count these seeds as extracted or reviewed Archetype corpus coverage.

## Complete representative base-class rows

| Class feature | Class levels |
| --- | --- |
| Fighter Bonus Feat | 1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20 |
| Fighter Bravery | 2, 6, 10, 14, 18 |
| Fighter Armor Training | 3, 7, 11, 15 |
| Fighter Weapon Training | 5, 9, 13, 17 |
| Fighter Armor Mastery | 19 |
| Fighter Weapon Mastery | 20 |
| Rogue Sneak Attack | 1, 3, 5, 7, 9, 11, 13, 15, 17, 19 |
| Rogue Trapfinding | 1 |
| Rogue Evasion | 2 |
| Rogue Talent | 2, 4, 6, 8, 10, 12, 14, 16, 18, 20 |
| Rogue Trap Sense | 3, 6, 9, 12, 15, 18 |
| Rogue Uncanny Dodge | 4 |
| Rogue Improved Uncanny Dodge | 8 |
| Rogue Advanced Talents | 10 |
| Rogue Master Strike | 20 |

The Fighter Bonus Feat rows each grant one combat-feat slot. They do not duplicate an ordinary feat slot. Rogue Talent, Weapon Training and Weapon Mastery rows retain their choice prompts; curated option lists remain a content gap. Rogue Advanced Talents broadens the Rogue Talent choices from level 10 rather than granting an additional talent. The progression names describe the total shown on the printed table; no additive numeric Modifier is inferred from an increment label.

The weapon-training rows share a parent but identify separate class-level parts. Paizo's APG FAQ specifically permits replacement of different Weapon Training increments. A whole-parent change conflicts with every affected part. `scope` records this distinction separately from the exact feature-and-level replacement rows.

## Archer application

| Added or altered feature | Acquisition/increment levels | Replaced feature rows |
| --- | --- | --- |
| Hawkeye | 2, 6, 10, 14, 18 | Bravery at each corresponding level |
| Trick Shot | 3, 7, 11, 15, 19 | Armor Training at 3, 7, 11, 15 |
| Expert Archer | 5, 9, 13, 17 | Weapon Training 1 at 5 |
| Safe Shot | 9 | Weapon Training 2 at 9 |
| Evasive Archer | 13, 17 | Weapon Training 3 at 13 |
| Volley | 17 | Weapon Training 4 at 17 |
| Ranged Defense | 19 | Armor Mastery at 19 |
| Weapon Mastery restricted to a bow | 20 | The ordinary Weapon Mastery choice at 20 |

Expert Archer's later increases and Evasive Archer's increase at 17 are additions to their original Archetype abilities. They are not additional replacements of Weapon Training 2–4. The separate replacement rows allow compatibility to report the actual class feature parts touched.

Hawkeye concerns Perception and bow range increments; Trick Shot supplies bow combat-maneuver choices. Expert Archer concerns bow attacks and damage; Safe Shot concerns attacks of opportunity; Evasive Archer concerns defense against ranged attacks; Volley supplies a multi-target bow attack; Ranged Defense replaces Armor Mastery at 19. At 20, Weapon Mastery must name a bow. Trick Shot and the restricted mastery preserve their choice prompts. Numeric bonuses, maneuver restrictions and full combat text await official-text verification and curation. No calculation is inferred from these ability names or the representative increment labels.

## Scout application

At Rogue 4, Scout's Charge replaces Uncanny Dodge: a charge deals sneak attack damage as though the target were flat-footed, except against a target with Uncanny Dodge. At Rogue 8, Skirmisher replaces Improved Uncanny Dodge: moving more than 10 feet permits sneak attack damage as though the target were flat-footed, with the same Uncanny Dodge exclusion; when making multiple attacks it applies only to the first attack. These are two different feature replacements, not a whole alteration of Sneak Attack.

No extracted APG Archetype with class-skill or skill-rank changes and a complete feature schedule is available in this repository's admitted fixture data. The offline pinned content has neither of these Archetype definitions, and the prepared specimens are source-reference transcriptions. A further representative class-skill/rank specimen therefore remains a content-curation gap; synthetic calculation and Convex fixtures exercise those mechanics without inventing an officially extracted schedule.

Scout adds no class skill and changes no skill-rank budget in these representative rows. Structural class-skill additions/removals and rank changes are exercised by explicitly synthetic resolver fixtures rather than falsely attributed to Scout. Neither representative Archetype changes casting or proficiencies. Archetype casting changes belong to #422; proficiency changes remain prose/manual when content supplies them.

Uncanny Dodge records Improved Uncanny Dodge as its source-defined cross-class duplicate upgrade, matching the CRB ability text. The resolver emits an advisory prompt when another class also grants it. It does not remove the originals or silently create the upgrade.

## Retention and coverage

Applying an active Archetype suppresses the exact original Grant rows and adds the acquired Archetype rows across every Class Level of that class. Deactivating it stops additions and replacements, restores original Grants and leaves edited inactive Grants in the existing dormancy mechanism. The base class identity, HP, base attack and saves remain those of Fighter or Rogue.

Wizard and Cleric remain the earlier representative progression/casting specimens with no newly curated feature schedule in this ticket. Broader Archetype coverage, curated ability Modifiers, option definitions and all content admission work remain with the content batches. Preparing a Character with these bounded seeds does not activate or publish a Catalog Release.

## Effective-level allocation specimens (#410)

Three companion Archetypes and one feat demonstrate [effective-level allocation](../character-sheet/companions.md#prepared-effective-level-allocations-410) on isolated prepared sheets. They are browse-only seeds, like the rows above.

| Specimen | Book and page | Seeded rows |
| --- | --- | --- |
| Druid class | Core Rulebook pp. 48–53 | Class only: HD, BAB, saves, ranks, class skills, reviewed casting; no feature schedule |
| Ranger class | Core Rulebook pp. 64–67 | Class only, as above |
| Hunter class | Advanced Class Guide p. 26 | Class only, as above |
| Beast Master (ranger) | Advanced Player's Guide p. 124 | Animal Companion 4, Improved Empathic Link 6, Strong Bond 12; adds Acrobatics and Escape Artist and removes Knowledge (dungeoneering), Knowledge (geography), Profession and Spellcraft as class skills |
| Pack Lord (druid) | Ultimate Magic p. 38 | Pack Bond 1, Improved Empathic Link 6 |
| Packmaster (hunter) | Advanced Class Guide p. 96 | Pack Bond 1, Pack Focus 1, Second Pack Focus 8, Master of the Pack 20 |
| Boon Companion (feat) | Ultimate Wilderness p. 217; Seekers of Secrets p. 16 | General feat, repeatable, with an unchecked prerequisite |

Text was checked on Archives of Nethys and, for Beast Master, against the legacy PRD ranger archetype page. Neither prints the hunter class's closing page or each feature's page, so only the opening pages are cited. The druid, ranger and hunter feature schedules are not seeded. These Archetypes therefore list no `replaces` rows: Beast Master's Animal Companion replaces hunter's bond, Improved Empathic Link the 6th-level combat style feat and Strong Bond camouflage; Pack Lord's Pack Bond replaces nature bond; Packmaster's features replace animal companion, animal focus, second animal focus and master hunter. Pack Lord's ban on domains and Packmaster's teamwork-feat alteration remain prose. Only the effective-level budgets are calculated (`src/lib/catalog/representative-companion-rules.ts`); the other features have no Modifiers.

## Component allocation specimen (#419)

One summoner Archetype demonstrates [component allocation](../character-sheet/companions.md#prepared-component-allocations-419) on isolated prepared sheets, as a browse-only seed like the rows above. It applies to the existing seeded Summoner class.

| Specimen | Book and page | Seeded rows |
| --- | --- | --- |
| Broodmaster (summoner) | Ultimate Magic p. 78 | Eidolon Brood 2, Larger Brood 8 |

Text was checked on Archives of Nethys and against the legacy PRD Ultimate Magic summoner archetype page; neither prints the closing page, so only p. 78 is cited. The summoner feature schedule is not seeded, so Broodmaster lists no `replaces` rows: Eidolon Brood replaces the eidolon, and Brood Link, Bond Senses, Shield Ally, Maker's Call, Transposition, Greater Shield Ally, Brood Bond and Merge Forms modify the summoner features of those names and remain prose. Only the divided component budget and Larger Brood's group purchases are calculated (`src/lib/catalog/representative-companion-rules.ts`); the features have no Modifiers.

## Reduced progression specimen (#420)

One summoner Archetype demonstrates [reduced progression](../character-sheet/companions.md#prepared-reduced-progression-420) on isolated prepared sheets, as a browse-only seed like the rows above. It applies to the existing seeded Summoner class.

| Specimen | Book and page | Seeded rows |
| --- | --- | --- |
| Master Summoner (summoner) | Ultimate Magic p. 80 | Lesser Eidolon 1, Summoning Mastery 1, Augment Summoning 2 |

Text was checked on Archives of Nethys and against the legacy PRD Ultimate Magic summoner archetype page; the PRD prints no page, so p. 80 follows AoN's source line. The summoner feature schedule is not seeded, so Master Summoner lists no `replaces` rows: Lesser Eidolon replaces the eidolon, Summoning Mastery replaces summon monster I and shield ally, and Augment Summoning replaces bond senses. Only Lesser Eidolon's halved summoner level is calculated (`src/lib/catalog/representative-companion-rules.ts`); Summoning Mastery and the Augment Summoning bonus feat remain prose, and the features have no Modifiers.

## Combined Form specimen (#421)

One summoner Archetype demonstrates the [Combined Form](../character-sheet/companions.md#prepared-combined-form-421) on isolated prepared sheets, as a browse-only seed like the rows above. It applies to the existing seeded Summoner class.

| Specimen | Book and page | Seeded rows |
| --- | --- | --- |
| Synthesist (summoner) | Ultimate Magic pp. 80–81 | Fused Eidolon 1, Fused Link 1, Shielded Meld 4, Maker's Jump 6, Greater Shielded Meld 12, Split Forms 16 |

Text was checked against the legacy PRD Ultimate Magic summoner archetype page and on Archives of Nethys. The PRD prints no page; the official Ultimate Magic FAQ cites the archetype at p. 80 and AoN's source line gives p. 81, so pp. 80–81 are cited. The summoner feature schedule is not seeded, so Synthesist lists no `replaces` rows: Fused Eidolon replaces the eidolon, bond senses and life bond; Fused Link replaces life link; Shielded Meld and Greater Shielded Meld replace shield ally and greater shield ally; Maker's Jump replaces maker's call and transposition; and Split Forms replaces merge forms. Only the fused statistics are calculated, in the summoner's Combined Form (`src/lib/character-sheet-combined-form.ts`), where Shielded Meld's and Greater Shielded Meld's bonuses apply only while their Grants count; Fused Link, Maker's Jump and Split Forms remain prose, and the features have no Modifiers.

## Cohort specimen (#417)

One feat demonstrates [cohorts](../character-sheet/companions.md#prepared-cohorts-417) on isolated prepared sheets, as a browse-only seed like the rows above.

| Specimen | Book and page | Seeded rows |
| --- | --- | --- |
| Leadership (feat) | Core Rulebook p. 129 | General feat, not repeatable, with the character level 7th prerequisite |

Text was checked against the legacy PRD Core Rulebook feat page and on Archives of Nethys. The feat has no Modifiers: a cohort relationship's supporting source names its Selection, and the Leadership Score and cohort level are calculated on the cohort's sheet (`src/lib/character-sheet-cohort.ts`). Followers remain prose.

## Casting specimens (#422)

Nine published Archetypes demonstrate [Archetype casting changes](../character-sheet/spellcasting.md) on isolated prepared sheets, as browse-only seeds like the rows above. Every #422 resolver and Convex test uses these seeds; no casting case is invented. Magus (Ultimate Magic p. 9) and Investigator (Advanced Class Guide p. 30) join the seeded classes for them, with their reviewed casting, and eleven Spells of the Psychic Detective's list join the representative Spells.

| Specimen | Book and page | Seeded rows | `featureChanges` | Casting change |
| --- | --- | --- | --- | --- |
| Skirmisher (ranger) | Advanced Player's Guide p. 128 | Hunter's Tricks 5 | whole ranger spells | `presence: 'remove'` |
| Dandy (ranger) | Ultimate Intrigue p. 41 | none | whole ranger spells | Charisma, bard list, the medium's table, spontaneous and known |
| Seducer (witch) | Legacy of the First World p. 16 | Fey Charm 1, Seducer's Kiss 6, Garden of Delight 8 | hexes 1, 6, 8 | Charisma |
| Ley Line Guardian (witch) | Occult Adventures p. 125 | Conduit Surge 1 | whole familiar, hexes 1 and 8, whole witch spells | sorcerer table with cantrips, spontaneous and known |
| Mountain Witch (witch) | Advanced Class Guide p. 132 | Stone Spirit Hex 1, Mountain Beast Empathy 2 | whole hex, hex 2 | none |
| Eldritch Scion (magus) | Advanced Class Guide p. 104 | none | whole magus spells | Charisma, bard table, spontaneous and known (its restated arcane kind is inherited) |
| Mindblade (magus) | Occult Adventures p. 121 | none | whole magus spells | psychic, bard table, spontaneous and known (its restated Intelligence is inherited) |
| Questioner (investigator) | Magic Tactics Toolbox p. 26 | none | whole alchemy | arcane, bard list, bard table, spontaneous and known (its restated Intelligence is inherited) |
| Psychic Detective (investigator) | Occult Adventures pp. 119–120 | none | whole alchemy | psychic, psychic list plus its own levels, bard table, spontaneous and known (its restated Intelligence is inherited) |

Pages and text come from PCGen's Paizo data (`data/pathfinder/paizo/`: `advanced_players_guide/apg_abilities_class.lst`, `ultimate_intrigue/ui_abilities_class.lst`, `player_companion/legacy_of_the_first_world/lotfw_abilities_class.lst`, `occult_adventures/oa_abilities_class.lst`, `advanced_class_guide/acg_abilities_class.lst`, `player_companion/magic_tactics_toolbox/magtt_abilities_class.lst`, `SOURCEPAGE`), checked against the legacy PRD (Skirmisher) and the Archives of Nethys source lines (Seducer, Ley Line Guardian), which were used only to find a book and page. The class facts follow PCGen's class and class-ability data. The casting text each change records:

- Skirmisher: "This ability replaces the ranger's spells class feature. Skirmishers do not gain any spells or spellcasting ability, do not have a caster level".
- Dandy: "uses his Charisma instead of his Wisdom… casts spells spontaneously from the bard spell list… with the same number of spells known and spells per day as a medium… of his ranger level. This ability alters the ranger's spellcasting." It states no spell kind, so the ranger's divine kind is inherited.
- Seducer, Otherworldly Allure: "uses her Charisma rather than her Intelligence score for… bonus spells per day, the maximum spell level she can cast, and save DCs". Fey Charm alters the 1st-level hex; Seducer's Kiss and Garden of Delight replace the 6th- and 8th-level hexes. Her Patron is restricted (deception, enchantment, plant, thorns or trickery), which stays prose.
- Ley Line Guardian, Ley Line Powered: "a spontaneous spellcaster… same number of spells and… spell slots per day as a sorcerer of her witch level… This ability alters the witch's spellcasting." Conduit Surge replaces the familiar and the hexes at 1st and 8th level. It changes no ability or list.
- Mountain Witch: Stone Spirit Hex "alters hex"; Mountain Beast Empathy "replaces the hex gained at 2nd level". Its patron spell changes stay prose.
- Eldritch Scion: "casts arcane spells drawn from the magus spell list… must have a Charisma score… base daily spell allotment is the same as a bard… the same number of spells known as a bard". It replaces the magus's spells. Its restated arcane kind is not a change, so it is inherited (owner decision).
- Mindblade: "casts spells from the magus spell list as psychic spells… must have an Intelligence score… the same number of spells and… spells slots per day as a bard of her magus level… This ability replaces the magus's spellcasting." Its restated Intelligence is not a change (owner decision). Psychic Access stays prose.
- Questioner: "casts arcane spells drawn from the bard spell list… must have an Intelligence score… the same number of spells and… spell slots per day as a bard of his investigator level, including for cantrips… This ability replaces alchemy."
- Psychic Detective: "casts psychic spells drawn from the psychic class spell list… augmented by… Psychic Detective Spells… uses the spell level from the psychic detective spell list… the same number of spells and… spells slots per day as a bard… This ability replaces alchemy." Its own list (p. 120): detect chaos, detect evil, detect good, detect law and find traps at 1st; calm spirit and daylight at 3rd; modify memory at 4th; banishment, moment of prescience and greater scrying at 6th. These Spells are seeded with their CRB class levels (Occult Adventures p. 160 for calm spirit), following PCGen's spell data; their psychic list levels are not seeded.

The ranger, witch, magus and investigator feature schedules are not seeded, so these specimens list no `replaces` rows; `featureChanges` name the class features each alters or replaces, so the real compatibility conflicts warn: Seducer and Ley Line Guardian share the 1st- and 8th-level hexes, Mountain Witch's whole-hex alteration meets Seducer's hexes, and each pair on one class alters the same spells or alchemy. Every feature's own rules remain prose, and the features have no Modifiers.

Pairs that exercise each #238 case: Seducer alone (single ability), Eldritch Scion with Mindblade (Eldritch Scion's sole Charisma, Mindblade's sole psychic kind, the same table and recording twice and their spellcasting compatibility conflict), Seducer with Ley Line Guardian (combination), Questioner with Psychic Detective (list and kind choices, two classes' choices saved separately alongside Skirmisher with Dandy), Skirmisher with Dandy (removal against modification) and Mountain Witch with Seducer (whole against part). Restated base values are never changes (owner decision), so no published pair offers competing casting abilities. No published pair was found either for a caster-level-offset conflict, an extra-slot add/remove conflict, Granted Spells replacement, `presence: 'add'` on a class without casting, independent parts of one witch feature, or a third Archetype conflicting on a property already chosen; those paths are untested (see [Spellcasting](../character-sheet/spellcasting.md)).

## Flurry replacement specimen (#414)

One monk Archetype demonstrates a replaced [flurry of blows](../attack-calculation.md#flurry-of-blows-414) on isolated prepared sheets, as a browse-only seed like the rows above. It applies to the existing seeded Monk class.

| Specimen | Book and page | Seeded rows |
| --- | --- | --- |
| Zen Archer (monk) | Advanced Player's Guide p. 115 | Flurry of Blows (Zen Archer) 1, replacing the monk's Flurry of Blows 1 |

Text was checked on the legacy PRD Advanced Player's Guide monk archetype page; its page follows PCGen's source line. A zen archer "can make a flurry of blows as a full-attack action, but only when using a bow", so the monk's Flurry of Blows Grant is dormant and a recorded core flurry Routine Option warns that its class feature doesn't count. The bow flurry itself is not calculated, and the feature has no Modifiers. The Archetype was written for the core monk: on Unchained monk levels it replaces nothing, so a class-version switch maps the recorded option to the Unchained flurry, which applies. The monk schedule seeds only five features, so Zen Archer's other replacements (its bonus feats, Perfect Strike, Way of the Bow and the rest) are not seeded and remain prose.

## Imported rule-keyed identities (#741, #716 P6)

The rules above key on the seeds' rule identities: the classes `ranger`, `druid`, `hunter`, `summoner`, `monk` and `unchained-monk`, the archetypes and features the companion, Combined Form and flurry tables name, and the flurries `monk-flurry` and `unchained-monk-flurry`. An imported entry's rule identity is its catalog key, so `src/lib/character-sheet-rule-keys.ts` lets a rule key match its own identity, the #716 identity with the same id (`everythingpath/ranger-beast-master`) and the reviewed Foundry records of the same class or feature: Ranger `pf1/w3wjj6s3N69BsMc3`, Druid `pf1/7eZQP0MzeO2svmVF`, Hunter `pf1/Immo2BuSe5WGdRW9`, Summoner `pf1/BrnHPJ2EVSQSyNQ8`, Monk `pf1/W8dxwZ1CZiwLKsqr`, Monk (Unchained) `pf1/5mQIOIw4hDhlREPo`, and the two Flurry of Blows features `pf1/JKJoHy5NveXGaZqv` and `pf1/TaBxJdJQp5SFDPyn`. Class-level counting (`classFamilyLevels`), the companion graph's rule derivation, the Synthesist and Shielded Meld lookups and the flurry rules use it; a core flurry on a Foundry monk replaces that class's own BAB row.

The identity ledger freezes the sixteen archetypes under these keys with the feature keys the tables name. `tests/catalog/rule-keyed-identities.test.ts` imports each through the ledger and the structure gate (a checked record bound to its PCGen hash settles what it replaces: on a class with a reviewed schedule, the Ranger, Druid, Hunter, Summoner and Monk, the rows the mapper maps; otherwise its seed's cited values; a record bound to another hash is stale) and checks its rule on the Foundry class (Beast Master stays held on its `partialFormula` conflict, since Foundry's combat style feat counts every feat from the ranger level): Beast Master's budget (ranger level − 3, the full level from 12th), Pack Lord's and Packmaster's divided levels, the Broodmaster, Master Summoner (halved) and Synthesist eidolon rules, the Synthesist's Combined Form with both Shielded Melds, Zen Archer's dormant Foundry flurry with its warning, and the casting specimens' changes and published pairs, comparing the effective casting values. The imported casting change carries a list's class tag only, so the Psychic Detective is held on a `castingContract` item until a contract decision on its own spell levels (Occult Adventures p. 120), and its pair with the Questioner waits with it.
