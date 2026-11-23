# Feat curation review: #339

Reviewed 2026-10-08 by **Sol (AI curator) for the owner**, following [#339](https://github.com/AndreasUnunger/EverythingPath/issues/339), [PRD Implementation Decision 17 and the acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461), the [curation workflow](curation.md), the [#328 precedent](races-328.md) and its five-record correction.

Exactly the ticket's 100 pinned `pf1-content/pf-feats` candidates are reviewed. Attribution admission, required-record coverage, supported calculations and remaining importer facts are reported separately. This prepares local artifacts; no release is published or activated.

## Evidence and attribution boundary

The read-only checkouts are `foundryvtt-pathfinder1` v11.11 at `418761d2e16a6037c0156bb4a241f7cea5a2986d` and `pf1-content` 11.4.0 at `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`. Both commits, manifests and clean status are verified. All 100 complete raw descriptions and retained structured fields were read. [The inventory](../../scripts/catalog/legal/feats-339.json) contains every key, exact YAML location and hashes, source evidence, mechanics review, inherited-rule notice audit, disposition and named hold.

Comparison sources are the PRD, PCGen and books. No book PDFs are available, and no Archives of Nethys content is used. The admitted Skill Focus (Perception) comparison uses PCGen commit `25523dbcf10e86c280fc0f447167ea43d67419d3`: [CRB feats](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_feats.lst), [skills](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_skills.lst) and [campaign metadata](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/core_rulebook.pcc). The whole-content comparison includes the chosen-skill introduction, +3/+6 at ten ranks, repeatability and nonstacking distinct skill choices. PCGen’s campaign copyright list is retained as comparison provenance; it does not establish a complete inherited notice-chain review or another origin for this ordinary CRB/SRD feat. Existing reviewed CRB identity and shipped OGL/SRD resources are reused within that content boundary. The skill row confirms the Perception specialization. File hashes and further comparison leads are recorded in the inventory; leads never establish whole-content coverage.

The [Attribution Assessments](../../src/lib/catalog/data/attribution-assessments.json) and [evidence](../../src/lib/catalog/data/attribution-evidence.json) bind complete normalized content, stable identity mapping, evidence and notices. Existing reviewed CRB identity `CRB`/`PZO1110` is reused. Source fields remain unchanged and empty where upstream omitted them. No notice transcription, Registry alias or source backfill is introduced.

Twenty-two notice identities form observed minima; twenty-one non-CRB book/complete-chain holds are enforced in [held-notices.json](../../scripts/catalog/legal/held-notices.json). All fourteen Combat Trick entries include `PZO1131`. Inherited minima include summon-monster templates, witch/coven/familiar rules, possession spells, bloodrage/animal focus/fervor, ARG racial abilities, Bestiary universal abilities, and the complete embedded companion bodies. Mascot's Affection includes the mascot archetype's `PZO9454`; Wolf Trip includes Wolf Style's `PZO9439`; Linnorm Vengeance includes Linnorm Style's `PZO9470`. Battle Planner's Inspire Action dependency has a precise CRB Pathfinder Chronicler lead (PCGen `cr_abilities_class.lst:3057`, p. 391), so its inherited minimum remains `PZO1110`. Versatile Jinx includes Halfling Jinx's `PZO9415`; Personal Chronicler includes thrush `PZO1117` and nosoi `PZO1127`/`PZO9047`. The AP47 hold also names the existing Ashes at Dawn notice identity; the pinned Nosoi citation disagrees with the system registry's misleading Carrion Crown numbering, and that bibliographic discrepancy is recorded. Each non-CRB chain remains individually held. These minima do not bound unidentified original books or establish complete notice coverage.

## Exact dispositions

**One supported/admitted, 99 specifically held, zero dependent omissions, zero whole-entry unsupported/prose-only dispositions and zero exclusions.** Submechanics explicitly kept as prose do not change a candidate's whole-entry disposition. Every held candidate has its own `feats-339-whole-content-<upstream-id>` hold; the inventory states its missing comparison and concrete notice minima. No out-of-batch definition is admitted as a dependency.

| Exact key | Name | Disposition and evidence boundary |
| --- | --- | --- |
| `pf1-content/9dRwUyYiX5zsX3ce` | Coordinated Maneuvers | Held: whole-content origins/comparison incomplete; notice minima PZO1115, PZO1110, PZO1131. |
| `pf1-content/9e2yq5XuaKc1rLGh` | Versatile Summon Monster | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO1112, PZO1116. |
| `pf1-content/9fKxqvJRHXjShhDp` | Overwhelming Phantom | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO1132. |
| `pf1-content/9fw7tNnUaJXfssbk` | Retributive Kick | Held: whole-content origins/comparison incomplete; notice minima PZO1110. |
| `pf1-content/9hWv0960cmj5XGGr` | Snatch Arrows (Mythic) | Held: whole-content origins/comparison incomplete; notice minima PZO1126, PZO1110. |
| `pf1-content/9hqpLULoaEgyRzYo` | Authoritative Spell | Held: whole-content origins/comparison incomplete; notice minima PZO1110. |
| `pf1-content/9htxXjKcTrpnLV3K` | Hunter of Dahak | Held: whole-content origins/comparison incomplete; notice minima PZO1110. |
| `pf1-content/9ia6J9PPb4N0OpCf` | Raging Absorption | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO1129. |
| `pf1-content/9ihJ2Gl0cFxdHDI1` | Mascot's Affection | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO9454. |
| `pf1-content/9jlqDG2ARpIE6gB6` | Dragoncrafting | Held: whole-content origins/comparison incomplete; notice minima PZO1110. |
| `pf1-content/9jrqbK4v19adzhg6` | Rugged Northerner | Held: whole-content origins/comparison incomplete; notice minima PZO1110. |
| `pf1-content/9jrrXnyZpXqngbhW` | Vengeance | Held: whole-content origins/comparison incomplete; notice minima PZO1125, PZO1110. |
| `pf1-content/9kzHExgVh5Dh3BAR` | Drunken Sing-Along | Held: whole-content origins/comparison incomplete; notice minima PZO1110. |
| `pf1-content/9m8qZK7axA9BwEWL` | Cut Your Losses | Held: whole-content origins/comparison incomplete; notice minima PZO1110. |
| `pf1-content/9mAlheli90Dh6195` | Wicked Valor | Held: whole-content origins/comparison incomplete; notice minima PZO1110. |
| `pf1-content/9o4psZb9HIRNVCVh` | Kirin Path | Held: whole-content origins/comparison incomplete; notice minima PZO1118, PZO1110, PZO1131. |
| `pf1-content/9pD9UgFjpyGIagDA` | Ostentatious Weakness | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO1118, PZO1131. |
| `pf1-content/9rsijkdfw6akga33` | Tapestry Traveler | Held: whole-content origins/comparison incomplete; notice minima PZO1110. |
| `pf1-content/9s8mHKEIkrCXP69Q` | Blinded Master | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO1112. |
| `pf1-content/9sIFTGLhnNUBZyNg` | Veiled Contempt | Held: whole-content origins/comparison incomplete; notice minima PZO1110. |
| `pf1-content/9tMbXGTHg626HSp2` | Intrusive Presence | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO1132, PZO1115. |
| `pf1-content/9ubHsYXOSfZpc6RS` | Rat Catcher | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO1112. |
| `pf1-content/9v03YUcH6cF8YWnk` | Cypher Magic | Held: whole-content origins/comparison incomplete; notice minima PZO1110. |
| `pf1-content/9vqye19n9rQN7DKt` | Linnorm Vengeance | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO9470. |
| `pf1-content/9x0337mM7naJTGCG` | Subtle Enchantments | Held: whole-content origins/comparison incomplete; notice minima PZO1134, PZO1110. |
| `pf1-content/9xGvJrdkXxcIzaOn` | Infectious Weapons | Held: whole-content origins/comparison incomplete; notice minima PZO1110. |
| `pf1-content/9xKTjLWPs3genBPY` | Intimidating Confidence | Held: whole-content origins/comparison incomplete; notice minima PZO1121, PZO1110, PZO1117. |
| `pf1-content/9xgc3SiDuOULDePH` | Familiar Link | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO1115, PZO1129. |
| `pf1-content/9yua5ZlomvDj1c7D` | Skill Focus (Perception) | Admitted: complete ordinary CRB comparison; reviewed CRB notice. |
| `pf1-content/A0IxVIjBMBBzFCpn` | Performing Combatant | Held: whole-content origins/comparison incomplete; notice minima PZO1118, PZO1110, PZO1131. |
| `pf1-content/A3vecllj3fqq5eER` | Enhanced Coven | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO1115, PZO1112. |
| `pf1-content/A4J42zZNpgKhgKI7` | Binding Throw | Held: whole-content origins/comparison incomplete; notice minima PZO1118, PZO1110, PZO1131, PZO1115. |
| `pf1-content/A5G2JSutPtb3Zu6f` | Fire Music | Held: whole-content origins/comparison incomplete; notice minima PZO1117, PZO1110, PZO1112. |
| `pf1-content/A5GuCqMZVH8H6hi4` | Daggermark Lore | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO9445, PZO9217E, PZO1129. |
| `pf1-content/A6lPbEJigQpUS4kV` | Monitor Obedience | Held: whole-content origins/comparison incomplete; notice minima PZO1110. |
| `pf1-content/AAKX1tJKJRjCZnT7` | Unstoppable Esotery | Held: whole-content origins/comparison incomplete; notice minima PZO1110. |
| `pf1-content/ABcDhcXLpa377PUt` | Bear's Balance | Held: whole-content origins/comparison incomplete; notice minima PZO1110. |
| `pf1-content/AC1Hle0YL1CwdMgu` | Storm of Blades | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO1112. |
| `pf1-content/ACpJJIleQPkFhOcr` | Grasping Strike | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO1131. |
| `pf1-content/ADUbhd44CFzAm1IR` | Versatile Jinx | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO9415. |
| `pf1-content/AEgF9fHk9qUkt4cd` | Owl Swoop | Held: whole-content origins/comparison incomplete; notice minima PZO1134, PZO1110. |
| `pf1-content/AFr1uHe1ExWMoJL4` | Divine Denouncer | Held: whole-content origins/comparison incomplete; notice minima PZO1110. |
| `pf1-content/AGaFV9sNK32t5UZb` | Shapeshifter Style | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO1112. |
| `pf1-content/AJhiWCuZ69ClhRxI` | Fiendish Obedience | Held: whole-content origins/comparison incomplete; notice minima PZO1110. |
| `pf1-content/AKnHCUqeqNa1Pf7S` | Lucky Healer | Held: whole-content origins/comparison incomplete; notice minima PZO1121, PZO1110. |
| `pf1-content/AL03Bv7fBRYWTj0M` | Stylized Spell | Held: whole-content origins/comparison incomplete; notice minima PZO1134, PZO1110, PZO9226, PZO1132. |
| `pf1-content/ALERwfU4DWTT4IFb` | Unraveler of Secrets | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO1132. |
| `pf1-content/AMva6nB7FvGBqJfY` | Blooded Arcane Strike | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO1129, PZO1131. |
| `pf1-content/AO98fNuempNBtdY0` | Greater Dispel Focus | Held: whole-content origins/comparison incomplete; notice minima PZO1110. |
| `pf1-content/AOTdQuzFtuo8TLCk` | Personal Chronicler | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO1117, PZO1127, PZO9047. |
| `pf1-content/APN0XhRseCV7K2DJ` | Lion's Heart | Held: whole-content origins/comparison incomplete; notice minima PZO1110. |
| `pf1-content/AR9Kt2UwOzu6Xs1x` | Monstrous Disguise | Held: whole-content origins/comparison incomplete; notice minima PZO1110. |
| `pf1-content/ARmzuwIYLw563Jxz` | Metallic Wings | Held: whole-content origins/comparison incomplete; notice minima PZO1121, PZO1110, PZO1112. |
| `pf1-content/ATPrsTmSLLwTBVcZ` | Wind Leaper | Held: whole-content origins/comparison incomplete; notice minima PZO1110. |
| `pf1-content/AWSl3hjAtT3wWtWy` | Crushing Blow | Held: whole-content origins/comparison incomplete; notice minima PZO1118, PZO1110, PZO1131. |
| `pf1-content/AWbHuUTcceeZ5Wxr` | Brash Stride | Held: whole-content origins/comparison incomplete; notice minima PZO1110. |
| `pf1-content/AXr2k74CBg9sKnYd` | Viscous Venom | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO1121. |
| `pf1-content/AYhu7d6QTq5rRLeA` | False Casting | Held: whole-content origins/comparison incomplete; notice minima PZO1110. |
| `pf1-content/AayU5wKBOAnKB9DG` | Final Embrace | Held: whole-content origins/comparison incomplete; notice minima PZO1118, PZO1110, PZO1112, PZO1131. |
| `pf1-content/AfEnGnWDCxCMtQu0` | Command Undead (Mythic) | Held: whole-content origins/comparison incomplete; notice minima PZO1126, PZO1110. |
| `pf1-content/AfRGMbZLpTE5dMVm` | Twilight Tattoo | Held: whole-content origins/comparison incomplete; notice minima PZO1110. |
| `pf1-content/AfkzMX0kW4cA8j5A` | Heroic Recovery | Held: whole-content origins/comparison incomplete; notice minima PZO1115, PZO1110. |
| `pf1-content/AgKqp4SiaLWedmLp` | Inspiring Talent | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO1121. |
| `pf1-content/AhVDmtvZyFYrRKCB` | Greater Awesome Blow | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO1112. |
| `pf1-content/AhjO45NKfHVxd1br` | Metamagical Synergy | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO1112. |
| `pf1-content/AlVNljHAgoaQeOFQ` | Ogre Crush | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO1112. |
| `pf1-content/AnM6jef6ukr6PKBW` | Terrain Celerity | Held: whole-content origins/comparison incomplete; notice minima PZO1110. |
| `pf1-content/AnnhZwmTfHpuzEzy` | Crypt Spell | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO1112. |
| `pf1-content/Ao4RRnfTz492vvli` | Piranha Strike | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO1112. |
| `pf1-content/AoQdmyazxZR6vFXP` | Street Sweep | Held: whole-content origins/comparison incomplete; notice minima PZO1134, PZO1110. |
| `pf1-content/Apa31k0RsrrszJxP` | Raging Throw | Held: whole-content origins/comparison incomplete; notice minima PZO1118, PZO1110. |
| `pf1-content/Ape1YrFyqyYq1ZMY` | Thousand Cuts | Held: whole-content origins/comparison incomplete; notice minima PZO1110. |
| `pf1-content/AqTsnqsGHdVlJzFa` | Protector of the People | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO1125, PZO1112. |
| `pf1-content/AqXrIMzX6HnvLWnS` | Scarlet Rose Devotion | Held: whole-content origins/comparison incomplete; notice minima PZO1110. |
| `pf1-content/AqnY19qWobuQf3mx` | Final Embrace Master | Held: whole-content origins/comparison incomplete; notice minima PZO1118, PZO1110, PZO1112, PZO1131. |
| `pf1-content/AsI2LWTyi01HLLrY` | Thrill of the Hunt | Held: whole-content origins/comparison incomplete; notice minima PZO1110. |
| `pf1-content/AslD03spaoWrpAiM` | Go Unnoticed | Held: whole-content origins/comparison incomplete; notice minima PZO1115, PZO1110. |
| `pf1-content/AtikQ9nkFTCYQ6di` | Divine Deception | Held: whole-content origins/comparison incomplete; notice minima PZO1110. |
| `pf1-content/Av67GzsPJ0qjipZ1` | False Opening | Held: whole-content origins/comparison incomplete; notice minima PZO1118, PZO1110, PZO1131. |
| `pf1-content/AxIIwCjMWjPooLOw` | Wolf Trip | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO9439. |
| `pf1-content/AxRcBm1ZhOgO4sRv` | Standing Tall | Held: whole-content origins/comparison incomplete; notice minima PZO1110. |
| `pf1-content/AyPASAXBqinzDiHd` | Stalker's Focus | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO1129. |
| `pf1-content/AzGjqWHY26fz5v0I` | Shadow Walker | Held: whole-content origins/comparison incomplete; notice minima PZO1121, PZO1110. |
| `pf1-content/B0sMkd93YZw1PnD1` | Beast Speaker | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO1112, PZO1116. |
| `pf1-content/B16M9eNce1OL8819` | Battle Planner | Held: whole-content origins/comparison incomplete; notice minima PZO1110. |
| `pf1-content/B2hfI6ktB2RSbBVY` | Spell Denial | Held: whole-content origins/comparison incomplete; notice minima PZO1110. |
| `pf1-content/B2oOXjH6NhfwTfgz` | Ghostslayer | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO1112. |
| `pf1-content/B3D3sXpydYZrgAuB` | Death or Glory | Held: whole-content origins/comparison incomplete; notice minima PZO1118, PZO1110, PZO1131. |
| `pf1-content/B4Lc1O1XdZiXAs3X` | Wild Growth Channel | Held: whole-content origins/comparison incomplete; notice minima PZO1110. |
| `pf1-content/B4dU0x55LFOQ1T4F` | Solo Maneuvers | Held: whole-content origins/comparison incomplete; notice minima PZO1110. |
| `pf1-content/B4xettlCyD3lfYIR` | Stock-Striker Sweep | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO1118. |
| `pf1-content/B58EUttFzN2TK7ls` | Snapping Turtle Clutch | Held: whole-content origins/comparison incomplete; notice minima PZO1118, PZO1110, PZO1131. |
| `pf1-content/B5x292BTpmI3exy7` | Joined Wings | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO1129. |
| `pf1-content/B6SsXZXwX4m587OD` | Threatening Negotiator | Held: whole-content origins/comparison incomplete; notice minima PZO1134, PZO1110. |
| `pf1-content/B7uIjic56RrbxSDg` | Dirty Disarm | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO1115. |
| `pf1-content/B8d0MfBlPzpcgPwJ` | Skaveling Companion | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO1116. |
| `pf1-content/BCFuekJRltIzSfCi` | Heroic Interposition | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO1131. |
| `pf1-content/BE53kpCr9pzw3GWf` | Expanded Preparation | Held: whole-content origins/comparison incomplete; notice minima PZO1110, PZO1129. |
| `pf1-content/BFXEPIwPk7sAQlwd` | Uncanny Ally | Held: whole-content origins/comparison incomplete; notice minima PZO1110. |
| `pf1-content/BFzft7mOf5SSgzyk` | Improved Sabotaging Sunder | Held: whole-content origins/comparison incomplete; notice minima PZO1134, PZO1110. |

## Mechanics, prose and remaining facts

The original bounded drafter found **65 optional description candidates and zero required raw note, action-conditional or Item Ability records**. The separate description review supplies **100 checked records and 74 Modifiers across 25 feats**. Required coverage has zero missing, stale or unresolved records. Twenty-four descriptions retain named missing calculations; the other 76 record limitations as reviewed prose/manual scopes. Manual Situations are supported behavior, while promised missing calculations stay outstanding independently of attribution. Lion’s Heart’s ability-damage exception and Owl Swoop’s replacement of Acrobatics ranks with BAB remain unresolved; review classification never implies that those supported statistics calculate correctly. All candidates still have outstanding imported repeatability facts, independently of their numeric/prose classification.

Ordinary rule identity supplies the stacking Source. Existing shared `mindAffecting` and `poison` Situational Notes are reused where their wording fits; Standing Tall's numerical bonuses require its complete timed activation and completion conditions. Compound style, target, action, chosen-school and resource circumstances stay local. No shared-effect identity or automatic implication between Situations is invented.

Representative supported values are Coordinated Maneuvers +2/+4 competence replacements with a separately elected +2 stamina increment; Vengeance's explicitly stacking +1 completion saves; Hunter of Dahak's +2 increments to all ten Knowledge skills, Bluff, Perception, Sense Motive, Survival and weapon attack/damage; Raging Throw's `max(0, Constitution modifier)`; and Death or Glory's +4/+5/+6/+7 at BAB 6/11/16/20. Shapeshifter Style's Toughened Hide is enhancement to `ac.natural`, not a generic AC enhancement. Skill Focus retains exact manual +3/+6 rank alternatives; its raw rank formula still cannot calculate automatically.

Linnorm Vengeance's unarmed-only +2 remains exact rules text because a general melee Modifier would affect other weapons. Critical-confirmation quantities, tactical permissions, movement/carrying/crafting rules, enemy statistics and play-time resource handling remain explicit prose under the consuming [Modifier](../character-sheet/modifiers.md) and [attack](../character-sheet/attacks.md) contracts. Recipient effects such as Scarlet Rose Devotion, Fire Music, Beast Speaker and Skaveling Companion never modify unrelated bearer statistics. Readable Notes preserve complete source tables and rules.

The 24 calculation reviews name the remaining rank-dependent skill bonuses, restricted caster levels and casting/preparation changes, ability-damage exception, named feat/feature grants, proficiency inheritance, chosen attack mechanics and companion relationships/progression. All 100 repeatability facts remain the importer's `unreviewed` sentinel; 57 candidates have individually recorded prerequisite gaps, including missing choices, class/racial-feature relationships and unsupported/incorrect alternatives. No proficiency grant is invented from absent raw arrays. These facts and calculations remain importer/content follow-ups, including the existing [#719](https://github.com/AndreasUnunger/EverythingPath/issues/719)/[#720](https://github.com/AndreasUnunger/EverythingPath/issues/720) lane where applicable; this batch changes no product or tool code.

Class schedules, equipment Base Items/defaults/end state and standalone companion-source batches are outside this feat assignment. Embedded companion rules are retained whole and their missing structured relationships are recorded.

## Demonstration and independent audit

[The fixtures](../../tests/fixtures/feats-339/README.md) preserve all 100 byte-exact pinned YAML records, ordered provenance, complete normalized bodies and reduced manifests. A tracked `pf1/packs/.gitkeep` preserves the intentionally empty system pack directory. One separately pinned Favored Enemy record supplies the baseline scope of Hunter of Dahak's increments without expanding the candidate inventory. Ticket-order SHA-256 is `a9701b71b607a934c89aa4c1d36fc4ba9fcdb8fa68b9257368f885b466aa5031`.

[The catalog tests](../../tests/catalog/feats-339.test.ts) exercise real normalized bodies and all four assessment bindings, enforced holds, shared/local Situations, Source suppression, explicit self-stacking, supported numeric values and independent source hashes. [The isolated saved-sheet test](../../convex/feats339.integration.test.ts) uses admitted Skill Focus through public Selection writers and saved reads, then verifies preview equivalence and explicit manual rank outcomes. Held Solo Maneuvers is clearly marked as a test-only Character definition: ordinary CMD 11 becomes 12 only under the complete lone-threat Situation. Another organization member can edit; outsiders, unauthenticated users and cross-campaign definitions are refused. The adapter omits the unusable repeatability sentinel without inventing a replacement. There is no remote backend, global publication or production activation.

Independent source review covered all 100 descriptions, every numeric-producing output, raw hashes and overlay snapshots, inherited minima, assessment status and registered notice chains. It corrected Linnorm's broad melee mapping, Vengeance's weapon-damage label, Dragoncrafting table readability, the Halfling Jinx and thrush/nosoi notice omissions, and completed Hunter's expressible increments. The pinned Favored Enemy text explicitly includes weapon attack rolls; that source corrected an initial audit-memory omission. The existing 1,324 overlay records are preserved without changes. The resumed audit added seven inherited-notice minima: Binding Throw and Dirty Disarm require APG `PZO1115`; Rat Catcher, Fire Music and Piranha Strike require Bestiary `PZO1112`; Daggermark Lore requires ACG `PZO1129` for Poison Lore; and Intimidating Confidence requires Ultimate Magic `PZO1117` for the emotion descriptor. Skaveling Companion’s unsupported `PZO1121` claim was removed: pinned PCGen places Urdefhan in Bestiary 2 (`PZO1116`, p. 276). Each correction has exact source/comparison evidence in the inventory. Battle Planner’s Inspire Action now has the CRB Pathfinder Chronicler comparison lead recorded in the fix round below. Unstoppable Esotery’s esoteric material-component origin remains explicitly unbounded within its whole-content hold.

## Reproduction and observed checks

Reproduction derives the exact candidate selection from the committed inventory. Both CLIs verify the complete pinned checkouts; no unverified-checkout override is used. Temporary files stay in an ignored worktree directory with a CommonJS marker. Candidate selections and generated extraction reports are deleted after their results are recorded.

```sh
mkdir -p .scratch/curation-339/tmp
export TMPDIR="$PWD/.scratch/curation-339/tmp"
printf '{"type":"commonjs"}\n' > "$TMPDIR/package.json"
node --input-type=module <<'JS'
import fs from 'node:fs';
const review = JSON.parse(fs.readFileSync('scripts/catalog/legal/feats-339.json', 'utf8'));
fs.writeFileSync('.scratch/curation-339/candidates.json',
  JSON.stringify(review.candidates.map(({ externalKey }) => externalKey), null, 2) + '\n');
JS
PF1_CURATION_SYSTEM=/home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1
PF1_CURATION_CONTENT=/home/andreas/repos/everythingpath/sources/pf1-content
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/curation-339/candidates.json --descriptions --out .scratch/curation-339/drafts
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/curation-339/candidates.json --records scripts/catalog/reviewed-curation.json --descriptions --out .scratch/curation-339/checked
pnpm -s catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/curation-339/candidates.json --out .scratch/curation-339/bounded
pnpm -s catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-339/full
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm -s catalog:format --check
pnpm test tests/catalog/feats-339.test.ts convex/feats339.integration.test.ts --maxWorkers=1
pnpm test tests/catalog --maxWorkers=2
git diff --check
```

The interrupted run produced 65 description drafts. The resumed final checked pass exited 0: **1,424 retained overlay records, zero new/replaced/missing or unresolved required mechanics**. The exact bounded inventory accounts for 100 feats, all 100 descriptions checked, with **24 separately unresolved descriptions**. The bounded gate passes with one admitted, 99 held and zero failures, dependent omissions or retained exceptions.

| Check | Observed result after the fix round |
| --- | --- |
| Pinned source commits/manifests and clean status | Pass; verified checkouts, no override |
| Live ticket inventory and pinned fixture bytes | Pass; exactly 100 unique keys, all source hashes match |
| Checked curation resume | Exit 0; 100 checked descriptions, 24 outstanding calculations, no required gaps |
| Bounded inventory/admission | Exit 0; 100 feats accounted; one admitted, 99 held, zero failures |
| Full inventory/admission | Exit 1; 23,037 entries, 538 resources; 55 admitted, 23,127 held, two dependent omissions, zero retained exceptions, 4,690 failures outside this batch |
| `pnpm -s typecheck` | Pass; final rerun after the regression assertions |
| `pnpm -s lint` | Pass; final changed-file ESLint also passes for both tests and fixture adapter |
| `pnpm -s check:initial-migration-writers` | Pass; 183 registrations |
| `pnpm catalog:pin` | Pass; `sha256:52f42dd87903d3f6cdc69f576c93fd2788421cb12540b1969727f6aadcfc333b` |
| `pnpm -s catalog:format --check` | Pass |
| Focused catalog and saved-sheet tests | Pass; 62 tests in two files, 4.71 seconds |
| `pnpm test tests/catalog --maxWorkers=2` | Pass; 1,139 tests in 55 files, 87.53 seconds |
| `git diff --check` and fixture directory preservation | Pass; no empty fixture directory |

The full preview's failures are **3,584 missing required curation records, 715 unaccounted inventory records and 391 structure/reference failures**. Every failure lies outside these 100 keys. Full required coverage is 103 checked of 3,687; optional descriptions are 1,321 checked of 10,593. These are broader outstanding corpus failures, not release readiness. This batch is one admitted and 99 held within that complete artifact too. The full `pnpm test` was not run: the orchestrator owns the post-rebase landing gate, as required by the brief.

An independent final check compared all 100 complete normalized bodies across the fresh full artifact, bounded artifact and committed fixture, and rebuilt all four assessment bindings against the full artifact: **pass, zero mismatches**. All 100 legal mechanics snapshots and exact overlay records match. All preexisting shared data is preserved: 1,324 overlay records, 27 shared Situations, 1,538 assessments, 1,517 evidence records and 594 notice holds. Only this batch's 100 records/assessments/evidence and 21 new notice holds are added; no Registry identity or product code changes.

Full extraction fingerprint: `be0f1ebc48f9a4ca07f09cb37eebf3c715c155b7efbb037016d62fc3059017d7`. Bounded extraction fingerprint: `18466f5f212817039afa01438073106f79914ae9e8ad1532019f314a39b6e22d`. Both use reviewed-input fingerprint `88a5f972da09f700bda81abfe40c0a9abcc6488b9fc00fc9c4370347ae45ee8e` and legal-resource fingerprint `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e`. Full admission-report SHA-256: `cbe1a1fe9c457ab7b61dc88270acd85415212bfb0bbec6e67d699477aed5d135`; bounded admission-report SHA-256: `2bc05ff585d5cd34f324b958a1f51f12a44ecbe719671dab4fd64c48ab1c1749`.

## Timing and workflow observations

Approximate resumed phase windows on 2026-10-08 (UTC; concurrent work overlaps):

| Phase | Window | Elapsed |
| --- | --- | --- |
| Brief, policy, inventory and source verification | 06:29–06:35 | 6 minutes |
| Independent mechanics/attribution review and data corrections | 06:32–06:41 | 9 minutes |
| Checks, focused tests and final CLI gates | 06:34–06:46 | 12 minutes |
| Report, final independent binding audit and cleanup | 06:40–06:47 | 7 minutes |

The resumed session took approximately 18 minutes; phase windows overlap and must not be added. The earlier interrupted run's total elapsed time was not recoverable, so it is not included.

- The partial work was usable, but source review still found seven inherited-notice omissions, one unsupported origin claim and two promised calculations incorrectly categorized as manual/prose. Corrected evidence and enforced notice minima do not establish whole-content coverage for the 99 held feats.
- The PCGen campaign copyright compilation is evidence about that comparison dataset, not an entry-specific inherited rule chain. Its wording was narrowed; no broad notice set or invented alias supplies coverage. Skill Focus's complete ordinary CRB/SRD semantic comparison and existing reviewed notice remain its admission basis.
- All 100 imported repeatability facts remain `unreviewed`; 57 candidates retain named prerequisite gaps, and supported missing calculations stay outstanding independently of attribution. Importer gaps remain with the existing coding lane rather than a product change in this batch.
- One focused rerun overlapped the two diagnostic edits and failed because the legal snapshot had not yet been refreshed. After rebinding, all 62 focused tests and the complete catalog suite pass. Gate/test execution uses a worktree-local CommonJS `TMPDIR` and bounded test workers.
- The repository's requested Opus/Fable aliases are unavailable in this environment. The required delegated code/test edits and independent audits used the inherited available model, with the stipulated reviewer identity.

All changes remain uncommitted on `cur/339`. No Git or GitHub mutation, release publication, remote deployment or full test suite was run. Environment files and private E2E material were not accessed. The original batch scratch was deleted after that run. Fix-round scratch was removed after independent validation; no answer file is placed in the repository.

## Fix-round review

The 2026-10-08 fix round rechecked all 100 complete descriptions and inherited-rule notice requirements. The three omitted minima now have batch-specific complete-chain holds, registered with the already-known book codes in `held-notices.json`; no Registry identity or alias was invented. Fresh comparisons at the pinned PCGen commit identify Mascot (Familiar Folio p. 11), Wolf Style (Blood of the Moon p. 25), Linnorm Style (Legacy of Dragons p. 20) and Pathfinder Chronicler Inspire Action (CRB p. 391), with exact file and literal-row hashes in the inventory and content-bound evidence.

Unstoppable Esotery's esoteric material components and greater-component/limited-magic benefits remain named unresolved inherited notice requirements. Monitor Obedience and Fiendish Obedience explicitly retain their obedience/boon publication gaps; Blinded Master's Blinded Blade Style/Blinded Competence and Greater Dispel Focus's Dispel Focus dependency are likewise named within their existing whole-content holds. Unknown publication identities stay unresolved. These additions neither supply whole-content comparisons nor change the one-admitted/99-held disposition.

All 100 assessments were refreshed against fresh full CLI output, including evidence and notice fingerprints; complete normalized fixture bodies were regenerated byte-for-byte unchanged. Skill Focus (Perception)'s admitted body, legal review, assessment, evidence, source fixture, overlay and saved-sheet behavior remain exactly as reviewed. New regression assertions pin the three notice requirements and inherited source locations, their literal-row hashes, and Battle Planner's CRB-only lead.

Independent final verification confirms all 100 fresh full CLI bodies equal the fixture, all 400 content/mapping/evidence/notice binding fields match the current assessments, and every preexisting shared assessment, evidence and notice-hold record is preserved exactly. Skill Focus (Perception)'s legal review, assessment and evidence are unchanged from the reviewed commit. The final full and bounded CLI reports both bind current reviewed inputs (`88a5f972da09f700bda81abfe40c0a9abcc6488b9fc00fc9c4370347ae45ee8e`) and current legal resources. The final full report accounts for every batch key: admitted Skill Focus (Perception), 99 held and zero batch failures; all 4,690 full-corpus failures are outside the batch. Final checked curation exits 0 with 1,424 retained records, all 100 descriptions checked, zero added/replaced/missing records and zero unresolved required mechanics. The final bounded preview exits 0 with one admitted, 99 held, zero failures, dependent omissions or retained exceptions. The extraction and admission-report hashes above have been refreshed from these final CLI outputs.

| Fix-round check | Result |
| --- | --- |
| `pnpm -s typecheck` | Pass; rerun after the regression assertions |
| `pnpm -s lint` | Pass; final rerun completed at 07:27:55 UTC |
| `pnpm test tests/catalog --maxWorkers=2` | Pass; 1,139 tests in 55 files, 87.53 seconds |
| `pnpm test tests/catalog/feats-339.test.ts convex/feats339.integration.test.ts --maxWorkers=1` | Pass; 62 tests in two files, 4.71 seconds |
| `pnpm -s check:initial-migration-writers` | Pass; 183 registrations |
| `pnpm catalog:pin` | Pass; `sha256:52f42dd87903d3f6cdc69f576c93fd2788421cb12540b1969727f6aadcfc333b` |
| `pnpm -s catalog:format --check` and `git diff --check` | Pass |

Approximate fix-round UTC phase windows (overlapping; do not sum):

| Phase | Window |
| --- | --- |
| Policy, source and inherited-notice audit | 07:00–07:06 |
| Evidence, notice holds and regression assertions | 07:04–07:14 |
| CLI regeneration and binding verification | 07:06–07:23 |
| Final checks, report and cleanup | 07:23–07:29 |

Initial typecheck found stale installed dependencies; a frozen-lockfile install with scripts disabled restored the required toolchain without tracked dependency changes. The binding refresh briefly normalized whitespace in older assessment rationales through schema parsing. Those out-of-batch changes were restored before final validation, and raw shared records are preserved. Canonical fingerprint comparison avoids treating JSON object-key ordering as a binding change. Final full and bounded normalized bodies agree for every batch key.

Workflow correction: the initial two fix-round preview invocations omitted the worktree-local `TMPDIR`. The catalog subprocess helper implicitly used the OS temporary directory for Git output captures and cleaned them automatically. This departed from the brief's no-`/tmp` instruction; it was identified and reported. Subsequent CLI and test invocations use an ignored worktree-local CommonJS temporary directory. Environment files and private E2E material were not accessed. No product code or Git/GitHub state was changed.
