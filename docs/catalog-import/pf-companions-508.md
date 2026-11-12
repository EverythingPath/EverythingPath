# Companions #508: pf1-content pf-companions batch 1

Reviewed by **Opus (AI curator) for the owner**, 2026-10-21.

Exactly the issue's 100 keys were reviewed: 100 of the 205 animal companion actors in the pinned `pf-companions` pack of pf1-content 11.4.0. The result is **0 admitted, 100 specifically held, 0 dependent omissions, 0 whole-entry unsupported/prose-only dispositions, 0 exclusions and 0 record-level 3.5 holds**. The importer maps each actor as a companion supporting resource (`detail.kind: companion`), not as a playable Catalog Entry (see [README](README.md), companion sources). None of the records cites a source.

The [machine-readable inventory and evidence](../../scripts/catalog/legal/pf-companions-508.json) records the following for each key:

- the complete pinned record and its source hash;
- the parsed stat block (base statistics and advancement);
- every embedded item, checked against the #507 record it copies;
- each PCGen version's literal rows, its compared statistics and the version decision;
- the inherited-rule notices;
- the checked description judgment, with the #763 body-only review distinct from historical mechanics review;
- source discrepancies and calculation gaps;
- the current assessment binding and mapped facts.

This report summarizes them and doesn't repeat the evidence.

## Family rulings (first batch of the family)

This is the family's first batch, so each choice below is proposed as the family's precedent for review.

1. **Every companion embeds held rules, so every companion is held.** Each actor carries copies of the Animal Companion class record and its six level-1 features (`compendiumSource` is the #507 record). The copies have the same mechanics and the same text, except for whitespace in 60 Bonus Tricks copies and an added "Animal Feats" heading in every Animal Companion Feats copy. #507 holds three of the copied records:
   - the Animal Companion record (`pf-companion-features-507-improved-evasion-level`);
   - Bonus Tricks (`pf-companion-features-507-whole-content-I9aVgYTVbwwmdZYz`), because no permitted source states its training time, Handle Animal checks, tricks-known limit or irrevocable selection;
   - Animal Companion Feats (`pf-companion-features-507-whole-content-w8QhU9qZ4VXxO4Ij`, with its broken reference and the held `PZO1131`).

   It admits the other four: Link, Natural Armor Bonus, Share Spells and STR/DEX Bonus. Each copy records these holds (`heldIn507`), and each companion's inherited-rule evidence names the three held records. So each companion is held as a whole with `pf-companions-508-whole-content-<id>`, whose rationale names the three #507 whole-content and level holds and gives the verdict on the companion's own statistics.

2. **The embedded wrong-pack link fails the gate.** The Animal Companion Feats copy links Improved Natural Armor as `Compendium.pf-content.pf-feats.Item.n1wLrcwaqOSDqrOo`, but the record is `pf1/n1wLrcwaqOSDqrOo`. The importer strips the link from the embedded description, and the gate fails all 100 resources as a broken reference, each with `pf-companions-508-broken-reference-<id>`. #507 already added this link to `danglingCatalogLinks`, so the cross-batch coverage check needs no new row.
3. **Version-specific statistics are checked against PCGen's companion rows.** Each companion is looked up by name in PCGen's companion race rows (`data/pathfinder/paizo/**/*races*compan*.lst`). For each version, these values are compared with the pinned actor and stat block:
   - the starting ability scores: the companion kit's `STAT` line plus the race row's `BONUS:STAT`;
   - size, speeds and natural armor (`AC_Natural_Armor`);
   - the advancement level (`PREVARGTEQ:MasterLevel,N`) and the advancement's size step (`SIZEMOD`).

   Each check states how it normalizes three encodings:
   - PCGen's mindless vermin (`Mindless`, Int −10) count as Foundry's Int 0;
   - where a Bestiary 3 row sets no Int, Int isn't compared;
   - an absent pinned land speed is Foundry's default of 30 ft. when PCGen's Walk speed is 30.

   The ability adjustments from the advancement's size change come from PCGen's game mode, which isn't in the pinned data set. They are recorded, with the residual beyond PCGen's explicit adjustments, and never claimed as agreeing.

4. **Book codes come from Foundry's pinned book list.** A version's book is its PCGen `SOURCELONG` (the section line, otherwise the book's `.pcc`). Its code is the exact title in `module/registry/sources.mjs`, with the Bestiary listed as `Bestiary [1]`, as in #716's crosswalk. The notice requirement records reuse the identities earlier batches recorded; no identity is claimed from a title match.
5. **Rejected and identical versions.** When versions disagree, the batch follows the one the pinned record matches and doesn't require the rejected book. The Hippogriff follows Inner Sea Combat, not the Curse of the Crimson Throne Player's Guide. When two books give the same row, both are required: Kingmaker Player's Guide and Bestiary 3 for the Elk, and Bestiary 3 and Monster Codex for the Giant Vulture.
6. **Notices.** Every companion requires:
   - `PZO1110`, for the Core Rulebook animal companion rules it embeds;
   - the book or books of its own version;
   - `PZO1112`, for natural attacks (Bestiary p.301, as #506), low-light vision, scent, tremorsense and blindsense, and the vermin, plant and magical beast type classes;
   - `PZO1127`, if it has darkvision (as #541).

   99 companions also require `PZO1131`, for the Unchained action costs on their own embedded attack actions; the Baluchitherium has no attack. Every code except `PZO1110` is held as `pf-companions-508-notice-<code>-complete-chain`.

7. **No permitted source means an unresolved origin.** 14 companions have no PCGen companion row. PCGen's only Embolotherium is an Adventurer's Guide placeholder (`TYPE:Missing`) without statistics. These 14 are held as a whole with an unresolved origin and require no book beyond their inherited rules.
8. **Statistics belong to the companion calculation.** The sheet calculates the #325 progression for the representative wolf and horse only. #763 now retains the complete notes stat block as sanitized source text in each resource; this adds no Modifier or Note. The 99 former empty-body judgments are replaced with checked source-bound covered/no-output judgments, applied from the independently accepted #763 Spec review. The review scope covers the new body and two prose amendments; it does not re-review species mechanics. Hippopotamus retains its existing biography body and judgment. Species statistics stay outstanding (#326 and later); they never become attribution holds.
9. **Closures are the resource alone.** An actor's detail holds no references. Its embedded items' links are retained game content in `unsupported`, not catalog references, because `collectReferences` reads only the detail and the description. So no linked body is bound.

## Dispositions

Every key is held with two holds: `pf-companions-508-broken-reference-<id>`, a gate failure, and `pf-companions-508-whole-content-<id>`. Each held notice's hold is `pf-companions-508-notice-<code>-complete-chain`, and every key also requires the reviewed `PZO1110`. "Statistics" gives the comparison with the chosen PCGen version. "Agrees" covers only the compared fields; the advancement's size-change adjustments and the natural attacks stay unverified.

| Key                            | Name                      | Disposition | PCGen version                         | Statistics                                                             | Held notices                          |
| ------------------------------ | ------------------------- | ----------- | ------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------- |
| `pf1-content/CZZ7FCQJBdv4sFpJ` | Allosaurus                | held        | Bestiary 2                            | agrees                                                                 | PZO1116, PZO1112, PZO1131             |
| `pf1-content/BFRZBcOQNN3hLe11` | Antelope                  | held        | Bestiary 3                            | agrees                                                                 | PZO1120, PZO1112, PZO1131             |
| `pf1-content/1RjcNzVhEXnqX49a` | Armorfish                 | held        | Ultimate Wilderness                   | agrees                                                                 | PZO1140, PZO1112, PZO1131             |
| `pf1-content/NpQHNTIaJCIVyoPD` | Aurochs                   | held        | Bestiary                              | agrees                                                                 | PZO1112, PZO1131                      |
| `pf1-content/R410WuiWcnxbqEGQ` | Baluchitherium            | held        | Bestiary 3                            | disagrees: startingAbilityScores                                       | PZO1120, PZO1112                      |
| `pf1-content/LJouU7rai472j5UQ` | Boar                      | held        | Core Rulebook                         | agrees                                                                 | PZO1112, PZO1131                      |
| `pf1-content/TIpkHepscgu9gvgV` | Brachiosaurus             | held        | Bestiary                              | agrees                                                                 | PZO1112, PZO1131                      |
| `pf1-content/RbcTQsGSqeTxQDTm` | Cameroceras               | held        | Bestiary 5                            | disagrees: speed                                                       | PZO1133, PZO1112, PZO1131             |
| `pf1-content/2s3csaWdDryve4qI` | Capybara                  | held        | Ultimate Wilderness                   | agrees                                                                 | PZO1140, PZO1112, PZO1131             |
| `pf1-content/6FOxz8ngNQMwWrNl` | Chimpanzee                | held        | Ultimate Wilderness                   | agrees                                                                 | PZO1140, PZO1112, PZO1131             |
| `pf1-content/FXjKVbjntRyKsmoc` | Corpse-Eater Fungus       | held        | Ultimate Wilderness                   | agrees                                                                 | PZO1140, PZO1112, PZO1127, PZO1131    |
| `pf1-content/H89RKqvwE706ScsJ` | Creeping Puffball         | held        | Ultimate Wilderness                   | agrees                                                                 | PZO1140, PZO1112, PZO1127, PZO1131    |
| `pf1-content/FWt7EW1Dop66HVTZ` | Crocodile                 | held        | Core Rulebook                         | agrees                                                                 | PZO1112, PZO1131                      |
| `pf1-content/PttyY458QWaxiKSx` | Deinonychus               | held        | Core Rulebook                         | agrees                                                                 | PZO1112, PZO1131                      |
| `pf1-content/3gWiIT6wfp48VKQA` | Deinotherium (Megafauna)  | held        | Bestiary 6                            | agrees                                                                 | PZO1137, PZO1112, PZO1131             |
| `pf1-content/0HYMCNjMV5vWgMXP` | Dimetrodon                | held        | Bestiary 3                            | disagrees: startingAbilityScores                                       | PZO1120, PZO1112, PZO1131             |
| `pf1-content/UEk45MdPdqnp514r` | Dimorphodon               | held        | Bestiary 4                            | agrees                                                                 | PZO1127, PZO1112, PZO1131             |
| `pf1-content/Ehk4a9KDNxdLbYbL` | Dire Bat                  | held        | Bestiary                              | agrees                                                                 | PZO1112, PZO1131                      |
| `pf1-content/SEy7YIN6ZDBIPfGt` | Dire Polar Bear           | held        | Bestiary 5                            | agrees                                                                 | PZO1133, PZO1112, PZO1131             |
| `pf1-content/K9EmqXKPBAo7WNxz` | Dog                       | held        | Core Rulebook                         | agrees                                                                 | PZO1112, PZO1131                      |
| `pf1-content/3QD7b8CvfD8u4Ekr` | Dolphin, Orca             | held        | Bestiary                              | disagrees: naturalArmor                                                | PZO1112, PZO1131                      |
| `pf1-content/LRClXkfV5fMK92gl` | Eagle                     | held        | Core Rulebook                         | agrees                                                                 | PZO1112, PZO1131                      |
| `pf1-content/44iselcQOq2m9fSw` | Electric Eel              | held        | Bestiary                              | agrees                                                                 | PZO1112, PZO1131                      |
| `pf1-content/Gtbb8GMqOg1vXSVT` | Elephant                  | held        | Bestiary                              | disagrees: advancementLevel                                            | PZO1112, PZO1131                      |
| `pf1-content/G7RkYsCbqR9MSUsE` | Elk                       | held        | Kingmaker Player's Guide + Bestiary 3 | agrees                                                                 | PZO9000-6E, PZO1120, PZO1112, PZO1131 |
| `pf1-content/2J0JEqZ5SpamzaMF` | Embolotherium             | held        | none                                  | origin unresolved                                                      | PZO1112, PZO1131                      |
| `pf1-content/3ovmfxSd9xrbw1n5` | Eurypterid                | held        | Ultimate Wilderness                   | agrees                                                                 | PZO1140, PZO1112, PZO1127, PZO1131    |
| `pf1-content/P0cf6hPXFis6JZLv` | Faerie Mount              | held        | none                                  | origin unresolved                                                      | PZO1112, PZO1131                      |
| `pf1-content/HzFvBqDs4PgBcqpx` | Falcon                    | held        | Ultimate Wilderness                   | agrees                                                                 | PZO1140, PZO1112, PZO1131             |
| `pf1-content/CMS1vnJdbhgPgUgv` | Gallerok                  | held        | none                                  | origin unresolved                                                      | PZO1112, PZO1127, PZO1131             |
| `pf1-content/DSrlTqY0EQiv3hu7` | Giant Ant                 | held        | Ultimate Magic                        | agrees                                                                 | PZO1117, PZO1112, PZO1131             |
| `pf1-content/ON3lPEFm1wHZ8GLN` | Giant Caterpillar         | held        | Ultimate Wilderness                   | disagrees: speed                                                       | PZO1140, PZO1112, PZO1127, PZO1131    |
| `pf1-content/PalYgqKfnMj9BgWc` | Giant Centipede           | held        | Ultimate Magic                        | agrees                                                                 | PZO1117, PZO1112, PZO1127, PZO1131    |
| `pf1-content/CTRzv8eNNM7gNcYY` | Giant Cockroach           | held        | Ultimate Wilderness                   | disagrees: speed                                                       | PZO1140, PZO1112, PZO1127, PZO1131    |
| `pf1-content/NWkx3nCuPjrmfcS5` | Giant Dragonfly           | held        | Ultimate Wilderness                   | agrees                                                                 | PZO1140, PZO1112, PZO1127, PZO1131    |
| `pf1-content/CUtM5zW0uGUF5mpP` | Giant Frilled Lizard      | held        | Ultimate Wilderness                   | agrees                                                                 | PZO1140, PZO1112, PZO1131             |
| `pf1-content/FI9UVtPoURAgBs3d` | Giant Leech               | held        | Ultimate Magic                        | agrees                                                                 | PZO1117, PZO1112, PZO1131             |
| `pf1-content/KydnfsYxEQKqBhw3` | Giant Locust              | held        | Ultimate Wilderness                   | agrees                                                                 | PZO1140, PZO1112, PZO1127, PZO1131    |
| `pf1-content/AneYpTO9krD90Tml` | Giant Mantis Shrimp       | held        | Ultimate Wilderness                   | agrees                                                                 | PZO1140, PZO1112, PZO1127, PZO1131    |
| `pf1-content/EkjLSPKMmKXDEHaD` | Giant Porcupine           | held        | Ultimate Wilderness                   | agrees                                                                 | PZO1140, PZO1112, PZO1131             |
| `pf1-content/O7zwDUnK1fVhKY12` | Giant Slug                | held        | Ultimate Magic                        | agrees                                                                 | PZO1117, PZO1112, PZO1131             |
| `pf1-content/2w6OtWKz2ADigas3` | Giant Termite             | held        | Ultimate Wilderness                   | agrees                                                                 | PZO1140, PZO1112, PZO1127, PZO1131    |
| `pf1-content/ElJkjjFsejLqqNtN` | Giant Vulture             | held        | Bestiary 3 + Monster Codex            | agrees                                                                 | PZO1120, PZO1130, PZO1112, PZO1131    |
| `pf1-content/KdQcpfADC8Q7mboC` | Giant Whiptail Centipede  | held        | Ultimate Wilderness                   | agrees                                                                 | PZO1140, PZO1112, PZO1127, PZO1131    |
| `pf1-content/EB6K8b6pSRQATVeT` | Giraffe                   | held        | Bestiary 4                            | agrees                                                                 | PZO1127, PZO1112, PZO1131             |
| `pf1-content/2LtTEZAsntNmWmG8` | Gliding Turtle            | held        | none                                  | origin unresolved                                                      | PZO1112, PZO1131                      |
| `pf1-content/POpc1a3pxVLn3IBJ` | Goblin Dog                | held        | Bestiary                              | agrees                                                                 | PZO1112, PZO1131                      |
| `pf1-content/OKLgB7hF67dP6d91` | Goliath Grog              | held        | Bestiary 5                            | disagrees: speed                                                       | PZO1133, PZO1112, PZO1131             |
| `pf1-content/05MMkjlN0ScXUTBu` | Griffon                   | held        | Inner Sea Combat                      | agrees                                                                 | PZO9268, PZO1112, PZO1127, PZO1131    |
| `pf1-content/Tlj7Lrd0R5ZpQfre` | Grizzly Bear              | held        | Ultimate Wilderness                   | disagrees: startingAbilityScores, size, naturalArmor, advancementLevel | PZO1140, PZO1112, PZO1131             |
| `pf1-content/V76jeMzJf3YlJSww` | Gulper Plant              | held        | Ultimate Wilderness                   | disagrees: startingAbilityScores                                       | PZO1140, PZO1112, PZO1131             |
| `pf1-content/7b62oYvW4q9S4say` | Hippogriff                | held        | Inner Sea Combat                      | agrees                                                                 | PZO9268, PZO1112, PZO1127, PZO1131    |
| `pf1-content/0dheEWrsMf3PmJx7` | Hippopotamus              | held        | Bestiary 2                            | disagrees: advancementSizeSteps                                        | PZO1116, PZO1112, PZO1131             |
| `pf1-content/QyxfAqvDZyMeLER9` | Hobbe Hound               | held        | none                                  | origin unresolved                                                      | PZO1112, PZO1131                      |
| `pf1-content/069F47e2x4CbT6s9` | Horse                     | held        | Core Rulebook                         | agrees                                                                 | PZO1112, PZO1131                      |
| `pf1-content/41GwMgim7Z5dwik3` | Impaler Shrike            | held        | none                                  | origin unresolved                                                      | PZO1112, PZO1131                      |
| `pf1-content/8ibKUci3hXAncNDy` | Kangaroo                  | held        | Bestiary 3                            | disagrees: advancementSizeSteps                                        | PZO1120, PZO1112, PZO1131             |
| `pf1-content/IWkgUDqf5E2RD6Tj` | Kaprosuchus (Megafauna)   | held        | Bestiary 5                            | agrees                                                                 | PZO1133, PZO1112, PZO1131             |
| `pf1-content/TvmWFfRnfjb9PMv7` | Llama                     | held        | Ultimate Wilderness                   | agrees                                                                 | PZO1140, PZO1112, PZO1131             |
| `pf1-content/7gLtm4v0aBs1WRnz` | Marax                     | held        | none                                  | origin unresolved                                                      | PZO1112, PZO1131                      |
| `pf1-content/G32pvYtsCGQAtt8C` | Marsupial Devil           | held        | Ultimate Wilderness                   | agrees                                                                 | PZO1140, PZO1112, PZO1131             |
| `pf1-content/GQyHeK5JOBalwUq5` | Megalania                 | held        | Bestiary 3                            | disagrees: startingAbilityScores                                       | PZO1120, PZO1112, PZO1131             |
| `pf1-content/LtCGEyj5KljAlws8` | Megaloceros               | held        | Bestiary 2                            | agrees                                                                 | PZO1116, PZO1112, PZO1131             |
| `pf1-content/8FdYkAhWuCcKGlvm` | Megaprimatus (Ape)        | held        | Bestiary 5                            | disagrees: speed                                                       | PZO1133, PZO1112, PZO1131             |
| `pf1-content/6DXrq6NtqFWgvEyS` | Megatherium               | held        | Bestiary 2                            | agrees                                                                 | PZO1116, PZO1112, PZO1131             |
| `pf1-content/3lDv7SOQ7qlh6QYc` | Mome Rath                 | held        | none                                  | origin unresolved                                                      | PZO1112, PZO1131                      |
| `pf1-content/MCTkRQkQsVtHJjVB` | Narwhal                   | held        | Bestiary 5                            | agrees                                                                 | PZO1133, PZO1112, PZO1131             |
| `pf1-content/TWSLrJMZ0zECT4Zc` | Octopus                   | held        | Bestiary                              | agrees                                                                 | PZO1112, PZO1131                      |
| `pf1-content/GnpWIV4XttCn4qJn` | Pachycephalosaurus        | held        | Bestiary 3                            | disagrees: startingAbilityScores                                       | PZO1120, PZO1112, PZO1131             |
| `pf1-content/1TKzaADXfegSnjhK` | Panda                     | held        | Ultimate Wilderness                   | disagrees: startingAbilityScores                                       | PZO1140, PZO1112, PZO1131             |
| `pf1-content/BDBP9wCceNN8XZv2` | Parasaurolophus           | held        | Bestiary 2                            | agrees                                                                 | PZO1116, PZO1112, PZO1131             |
| `pf1-content/UEsdui4Y2hb0oALq` | Pilo                      | held        | none                                  | origin unresolved                                                      | PZO1112, PZO1131                      |
| `pf1-content/8PqE9d5Ex8r409TY` | Pony                      | held        | Core Rulebook                         | agrees                                                                 | PZO1112, PZO1131                      |
| `pf1-content/AEX2YcCfyaCtFR6u` | Quetzalcoatlus (Dinosaur) | held        | Bestiary 6                            | agrees                                                                 | PZO1137, PZO1112, PZO1131             |
| `pf1-content/LVceriwBjsnf9nUZ` | Ram                       | held        | Bestiary 2                            | agrees                                                                 | PZO1116, PZO1112, PZO1131             |
| `pf1-content/FqphZO7YpW2wuooq` | Rash Creeper              | held        | Ultimate Wilderness                   | agrees                                                                 | PZO1140, PZO1112, PZO1131             |
| `pf1-content/MU1xJ8o2XLMl7NVw` | Ringhorn                  | held        | none                                  | origin unresolved                                                      | PZO1112, PZO1131                      |
| `pf1-content/DEb1vX2JY5bX8yvK` | Roc                       | held        | Bestiary                              | agrees                                                                 | PZO1112, PZO1131                      |
| `pf1-content/NsnNWoj6lQ1LGlmt` | Saber-Toothed Cat         | held        | Ultimate Wilderness                   | agrees                                                                 | PZO1140, PZO1112, PZO1131             |
| `pf1-content/46qq9zjnSn2r9rtG` | Slithering Sundew         | held        | Ultimate Wilderness                   | agrees                                                                 | PZO1140, PZO1112, PZO1131             |
| `pf1-content/3vvtBw96moHqfzSF` | Snake, Constrictor        | held        | Core Rulebook                         | disagrees: startingAbilityScores                                       | PZO1112, PZO1131                      |
| `pf1-content/VXdeJTyaJknQLalZ` | Sniper Cactus             | held        | Ultimate Wilderness                   | agrees                                                                 | PZO1140, PZO1112, PZO1131             |
| `pf1-content/IsmkeLEi17ScWiXz` | Sorico                    | held        | none                                  | origin unresolved                                                      | PZO1112, PZO1131                      |
| `pf1-content/AW3VITgDDJPu69xQ` | Spinosaurus               | held        | Bestiary 3                            | disagrees: startingAbilityScores                                       | PZO1120, PZO1112, PZO1131             |
| `pf1-content/8k8IHdEIaFAHMdoN` | Spitting Cobra            | held        | Ultimate Wilderness                   | agrees                                                                 | PZO1140, PZO1112, PZO1131             |
| `pf1-content/E5MCzjrco6oeRp53` | Stag                      | held        | Bestiary 4                            | disagrees: speed                                                       | PZO1127, PZO1112, PZO1131             |
| `pf1-content/L4MjkZqFkJK2tBr4` | Stegosaurus               | held        | Bestiary                              | agrees                                                                 | PZO1112, PZO1131                      |
| `pf1-content/4kZeyWjKaREF00Nl` | Stingray                  | held        | Bestiary 2                            | agrees                                                                 | PZO1116, PZO1112, PZO1131             |
| `pf1-content/AV2WOjlRix1lcC0l` | Styracosaurus             | held        | Bestiary 4                            | agrees                                                                 | PZO1127, PZO1112, PZO1131             |
| `pf1-content/IV1vycYRSNG5wvzY` | Switchback Jackal         | held        | none                                  | origin unresolved                                                      | PZO1112, PZO1131                      |
| `pf1-content/1sb1K1yZf4pRqmXd` | Trumpeter Swan            | held        | Bestiary 4                            | agrees                                                                 | PZO1127, PZO1112, PZO1131             |
| `pf1-content/3YP27rnin2SOm66N` | Tylosaurus                | held        | Bestiary 2                            | agrees                                                                 | PZO1116, PZO1112, PZO1131             |
| `pf1-content/TINRItIJpQteBvWH` | Tyrannosaurus             | held        | Bestiary                              | agrees                                                                 | PZO1112, PZO1131                      |
| `pf1-content/TNMDxKWHItC9Qx90` | Warcat of Rull            | held        | none                                  | origin unresolved                                                      | PZO1112, PZO1131                      |
| `pf1-content/E2bw3ELvajWCKEdD` | Web Tyrant Spider         | held        | Ultimate Wilderness                   | agrees                                                                 | PZO1140, PZO1112, PZO1127, PZO1131    |
| `pf1-content/9gMnOdTPE6GA1DGi` | Wolf                      | held        | Core Rulebook                         | agrees                                                                 | PZO1112, PZO1131                      |
| `pf1-content/Qbxc6ZZWJqEjJ0wd` | Wolfdog                   | held        | Ultimate Wilderness                   | agrees                                                                 | PZO1140, PZO1112, PZO1131             |
| `pf1-content/NHhcLda2sprgVtfR` | Wolliped                  | held        | Bestiary 5                            | agrees                                                                 | PZO1133, PZO1112, PZO1131             |
| `pf1-content/GfqFXxHpQeKWsbit` | Wolliped (Combat Trained) | held        | Bestiary 5                            | agrees                                                                 | PZO1133, PZO1112, PZO1131             |
| `pf1-content/1VW3mG5GKwwKbg3J` | Yolubilis Heron           | held        | none                                  | origin unresolved                                                      | PZO1112, PZO1131                      |

## Notable cases

- **Grizzly Bear** disagrees with Ultimate Wilderness on nearly every compared field. The pinned record has Small size, Str 15/Dex 15/Wis 12, natural armor 2 and advancement at 4th level, which are the Core Rulebook bear's values. PCGen's Ultimate Wilderness row has Medium size, Str 17/Dex 13/Wis 13, natural armor 1 and advancement at 7th level.
- **Other disagreements**, each recorded and not resolved:
  - Snake, Constrictor: Str 15 against PCGen 18.
  - Dolphin, Orca: natural armor 1 against 6.
  - Elephant: advancement at 7th against 4th.
  - Hippopotamus: grows a size at advancement, against no `SIZEMOD`.
  - Kangaroo: the reverse of the Hippopotamus.
  - Stag: no land speed (Foundry shows 30 ft.) against 50 ft.
  - Megaprimatus: no climb speed against 30 ft.
  - Cameroceras: climb 20 against swim 20 and jet 90.
  - Goliath Grog (pf1-content's spelling of the goliath frog): swim 30 against none.
  - Giant Cockroach: climb 30 against 20.
  - Giant Caterpillar: burrow 30 against climb 30.
  - Gulper Plant: Con 13 against 12.
  - Panda: Cha 9 against 3.
  - Dimetrodon (four scores), Spinosaurus (three), Pachycephalosaurus (two), Megalania and Baluchitherium (one each): scores that differ by 1 from the Bestiary 3 rows.

  No PRD page or book PDF decides any of them.

- **Hippogriff.** PCGen has two versions. The Curse of the Crimson Throne Player's Guide row disagrees on the scores and speeds. The Inner Sea Combat row agrees on every compared field; it has no kit, so the scores aren't compared. The Player's Guide row is recorded as a rejected alternate.
- **Wolf and Horse** equal the representative CRB species of #325 (`representative-animal-companions.ts`): the starting scores, size, natural armor, advancement level and the advancement's adjustments. The integration test calculates them on saved sheets.
- **Upstream data slips**, recorded and not resolved:
  - The grab attacks of the Cameroceras, Gulper Plant and Octopus carry `attackBonus: '19'`.
  - Nine attacks have damage type `untyped`, including the Horse's and the Pony's hooves.
  - The Cameroceras's stat block reads "tentalces".

## Importer and data gaps

- **Source-body omission repaired by #763.** Within `pf1-content/pf-companions`, `sourceBody({ source })` reads `system.details.notes.value` (or plain-string notes) after the existing description/unidentified/biography fallback, preserving distinct bodies once in deterministic order. Mapping and description-curation inputs require the same source-context reader. The generic `sourceDescription(record)` keeps its prior behavior for other callers. The existing sanitizer processes retained HTML; unrelated actor `details` fields remain excluded. Wolf and Horse now retain their complete Base Stats and Advancement; Hippopotamus keeps its biography. This is source retention only: attacks, size changes, Modifiers, saved lifecycle support and admission remain under their original owners.

- **Wrong-pack link** (follow-up, as #507). Every record's embedded Animal Companion Feats copy links `pf-content.pf-feats.Item.n1wLrcwaqOSDqrOo`. It isn't a spell or journal link, so it falls outside #738.

The original #508 landing changed no importer or shared-loader code. #763 changes the contextual body reader and its mapping/curation consumers; the #738 journal-link and #739 boundaries remain intact.

## Outstanding mechanics

These are calculation gaps, not attribution holds:

- species statistics other than the representative wolf and horse: starting scores, size, speeds, senses and natural armor;
- each species' advancement, including the ability adjustments of its size change;
- the natural attacks' dice by size, attack bonuses, and primary or secondary role;
- the stat blocks' special attacks and qualities (grab, pounce, trip and others).

## Companion validation

- 67 companions agree with their chosen PCGen version on every compared field.
- 19 disagree on at least one field (listed above).
- 14 have no PCGen companion row.

The chosen versions come from Ultimate Wilderness (28), the Bestiary (11), the Core Rulebook (9), Bestiary 3 (9, the Elk and the Giant Vulture included), Bestiary 2 (8), Bestiary 5 (8), Bestiary 4 (5), Ultimate Magic (4), Inner Sea Combat (2), Bestiary 6 (2), Monster Codex (1) and Kingmaker Player's Guide (1). In every record, the stat block's base scores equal the actor's ability scores. The advancement levels are 4th (50), 7th (49) and 9th (1).

## Cross-batch bindings and protected records

The original #508 sweep found self-only companion closures (ruling 9). #763 repeats the full-corpus impact comparison against integration base `b33b9390a90131a66ffb77d3e97dfcfa4ff2d3d9`; its compact impact evidence accompanies the implementation report outside the repository. The executed comparison changes 204 of 23,647 imported entries/resources: 99 in #508, 100 in #509 and 5 in #510. All 204 closures are self-only; no outside dependent closure changes. Only the 99 affected #508 assessments are re-bound; #509/#510 remain uncurated, and Hippopotamus is unchanged. Historical protected-context reports remain unchanged.

#354's Horse appears only as cited inherited-rule evidence. The Allosaurus is listed only among the source keys in #351's and #530's historical `protected-context.json`, not as a protected root. Neither fixture holds a copy of either record. No batch key appears in any `binding-preview.json`, `preview.json`, `preserved.json` or `provenance.json` as a curated record. These batches' closures don't include a batch key:

- #400, #431 and #549, which are curating or landing;
- #716 P7d, which is in review.

## Review scope and prior judgments

The inventory's `descriptionReview` records the actual Claude Opus 5.5 Spec reviewer, 2026-10-27 date, accepted commit and report hash once. Each changed `mechanicsReview.descriptionReview` and evidence body references this canonical review scope for the source body, description judgment and two amended prose fields. Existing reviewer/date fields still describe the unchanged historical mechanics and comparisons; Hippopotamus keeps its original judgment and 2026-10-21 reviewer unchanged.

Each changed candidate's `history[].previousBinding` is the exact integration-base binding from `b33b9390`. Its previous description judgment references `descriptionReviewHistory` once: the old description/description identity (on the candidate's unchanged external key), empty text and SHA-256, checked status, outputs, diagnostics, seeds, reviewer and date. The fixed base commit and curation-file reference also retain the original per-key rationale without copying another historical corpus. No prior history is overwritten.

Retained notes add 23 source bodies matching the existing optional prose regex. Twelve are in #508 and were already candidates because their description judgments are explicit. The other 11 are additional unreviewed optional candidates: 10 in #509 and 1 in #510. These counts are separate from the 204 retained bodies, 99 landed closures and changed parser-input fingerprints. Optional recognition is gate-neutral and adds no #509/#510 judgment, assessment or mechanic.

## Binding

Each assessment is bound with `buildAssessmentBinding` over the full-corpus `catalog:preview` of the merged overlay, which is the authority. Every closure is the resource alone, so the committed [preview fixture](../../tests/fixtures/pf-companions-508/preview.json) holds the 100 resources and an empty `closure`. The bounded preview's resources equal the full preview's. The batch test rebuilds every binding from a clean shared-store tree plus that fixture: 100 bound, 0 mismatches. The tree includes the 41 feats that the embedded Animal Companion Feats copy links (`embeddedLinkedRecords`). The importer resolves those links from the complete checkouts, so without the feats the tree would strip them from the retained embedded descriptions.

## Tests

- [`pf-companions-508.test.ts`](../../tests/catalog/pf-companions-508.test.ts) checks:
  - the counts and both holds on every key;
  - each resource's mapped scores, its single stripped link, its embedded copies, and that it has no Modifier or Note;
  - one complete checked covered/no-output description judgment per key, exact per-reviewer/date assertions and checked100/drafted0 counts;
  - the notices, the registered holds and the Unchained set by key (all but the Baluchitherium);
  - every PCGen disagreement, pinned by companion and field, and the three version decisions;
  - that the Wolf and Horse equal the representative species;
  - the pinned records, the literal PCGen rows and their publication anchors, the book codes against `sources.mjs`, and the wolf's scores recomputed from the kit and race rows;
  - re-extraction from a clean tree: all 100 fail on the broken link, the bindings reproduce, the Wolf is held whole without the link and on `PZO1112, PZO1131` when confirmed, and a changed resource is invalidated;
  - batch ownership.
- [`pfCompanions508.integration.test.ts`](../../tests/catalog/pfCompanions508.integration.test.ts) covers:
  - isolated saved sheets: a druid 7 with a linked wolf, and a druid 4 with a linked horse. Each companion has the pinned record's base scores. Both saved projections calculate the pinned advancement: the scores plus the advancement adjustments plus the table's Str/Dex bonus, and natural armor from all three. Outsiders are refused;
  - the release path for the held Wolf and Horse: `createCatalogRelease` refuses both, because the gate fails each on its broken embedded link.

## Preservation and gates

The shared canonical files gain only this batch's entries, all of them additions: 100 description records, 100 assessments, 100 evidence entries and 12 notice holds (`pf-companions-508-notice-<code>-complete-chain` for PZO1112, PZO1116, PZO1117, PZO1120, PZO1127, PZO1130, PZO1131, PZO1133, PZO1137, PZO1140, PZO9000-6E and PZO9268). No earlier row changed. `reviewed-change-replacements.ts` and `tests/catalog/cross-batch-bindings.ts` are untouched. Diff against the base `21babb10`, shared-store files omitted:

```text
docs/catalog-import/pf-companions-508.md            | new
scripts/catalog/legal/held-notices.json             |  +111
scripts/catalog/legal/pf-companions-508.json        | new, 63k lines
scripts/catalog/reviewed-curation.json              | +1400
src/lib/catalog/data/attribution-assessments.json   | +2364
src/lib/catalog/data/attribution-evidence.json      |  +300
tests/catalog/pf-companions-508.test.ts             | new
tests/catalog/pfCompanions508.integration.test.ts   | new
tests/fixtures/pf-companions-508/data.ts            | new
tests/fixtures/pf-companions-508/preview.json       | new, 30k lines
```

<!-- prep:shared-store-count -->
New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `a4ba996b`: **153** (pcgen 30, pf1 15, pf1-content 108).
<!-- /prep:shared-store-count -->

To the shared store, as curated on `21babb10`, the batch adds:

- the 100 pinned companion records;
- 23 records that the embedded feat list links and the store lacked: 15 pf1 feats and 8 pf1-content feats;
- the PCGen companion files its comparisons cite, which are race, kit and advancement rows and the `.pcc` files that date or name the books.

The #507 records the companions copy, Foundry's `sources.mjs` and the other 18 linked feats were already on the base.

The complete preview of the reviewed tree reported **103 admitted, 23,148 held, 5 dependent omissions and 2,099 failures**. The batch's 100 resources are among the failures, each "Broken structure or reference: unresolved imported reference.", as in the bounded preview before any curation. No batch key is admitted or held, and the batch adds no failure of another key. The bounded and full previews give the batch's 100 resources identically, and so does the committed fixture. The full-corpus gate is therefore a documented failure, not a claim of whole-corpus readiness.

| Command                                                                                                                                  | Result                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog:curate --candidates …` and `--descriptions` (prose pass)                                                                        | pass; 0 required records and 0 prose candidates drafted. A rerun against the overlay: 100 description records checked, 0 missing, 0 stale                                 |
| `catalog:preview --candidates …`                                                                                                         | exit 1; 100 broken-reference failures, before and after curation                                                                                                          |
| Full `catalog:curate`                                                                                                                    | pass; 0 missing; 4 stale records on the base, no batch key; 172 s                                                                                                         |
| Full `catalog:preview`                                                                                                                   | exit 1; 2,099 failures, 100 of them this batch's broken references; 226 s                                                                                                 |
| Bind (`buildAssessmentBinding` over the full preview)                                                                                    | 100 bound; closures self-only; 0 mismatches against the clean-tree rebuild; no landed assessment re-bound                                                                 |
| `pnpm test` of this batch's two files, `notice-holds`, `pinned-sources`, `cross-batch-bindings` and `batch-ownership-sweep` (one worker) | pass; 6 files / 176 tests. Earlier runs failed on errors in the batch's own tests (fixed and re-run); after the lint fixes the two batch files were re-run: 12 tests pass |
| `pnpm -s typecheck`                                                                                                                      | pass                                                                                                                                                                      |
| `pnpm -s lint`                                                                                                                           | pass (the first run failed on two lint errors in the batch tests, fixed and re-run with the batch tests)                                                                  |
| `pnpm -s check:initial-migration-writers`                                                                                                | pass; 185 registrations                                                                                                                                                   |
| `pnpm catalog:pin`                                                                                                                       | pass; `sha256:005ef0b9…`                                                                                                                                                  |
| `pnpm catalog:notice-deps`                                                                                                               | pass; 0 gaps; 39 advisory warnings, none for this batch                                                                                                                   |
| `pnpm catalog:format --check`                                                                                                            | pass                                                                                                                                                                      |

`pnpm test tests/catalog` was left to the orchestrator's prep run on the rebased commit, as the brief directs.

## Fix round 1 (review 2026-10-21)

Sol's review found that the embedded Bonus Tricks copies recorded no #507 hold, although #507 holds that record whole (`pf-companion-features-507-whole-content-I9aVgYTVbwwmdZYz`). The fix makes these changes:

- Every embedded copy's `heldIn507` now lists the holds #507 records on the copied record, and is empty for the four admitted features.
- Each companion's inherited-rule evidence adds the Bonus Tricks record.
- Each rationale (the assessment's and the evidence's boundary) names the Bonus Tricks hold.

All 100 dispositions, holds and required notices are unchanged. Only the 100 evidence entries changed. Each assessment was re-bound with `buildAssessmentBinding` over the committed full-corpus fixture, which the batch test shows equals the full-corpus binding. Only the evidence fingerprints changed; the content, mapping and notice fingerprints are as before. No other batch's assessment is affected.
