# Feats batch #343 — pf1-content, batch 10

Reviewed by **Sol (AI curator) for the owner**, 2026-10-08, under [#343](https://github.com/AndreasUnunger/EverythingPath/issues/343), PRD [#251](https://github.com/AndreasUnunger/EverythingPath/issues/251) Implementation Decision 17 and its acceptance appendix. Exactly **100 candidates: one admitted and 99 specifically held**. Zero dependent omissions, whole-entry unsupported/prose-only dispositions, exclusions or retained exceptions. This batch prepares data and evidence; no Catalog Release is published.

## Evidence and attribution

The [single inventory and mechanics review](../../scripts/catalog/legal/feats-343.json) records every exact ticket key, source byte/description hash, location, complete description and structured field, disposition, comparison, prerequisite/proficiency fact, inherited notice minimum, named hold and outstanding calculation. Stable identities/remaps are unchanged. Foundry PF1 v11.11 `418761d2e16a6037c0156bb4a241f7cea5a2986d` and pf1-content 11.4.0 `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d` were verified by the catalog commands, without an override. Both source directories are read-only. All 100 upstream Sources arrays are empty and remain empty; comparison evidence does not backfill user-facing Sources.

Permitted comparison uses PCGen at `25523dbcf10e86c280fc0f447167ea43d67419d3`. Seventy-seven candidates have literal feat comparison leads, of which 76 are partial. Fifty-four comparison files and 28 unique pinned supporting YAML snapshots are retained with hashes. The two Bestiary 2 species rows and three additional metamagic/class rows establish inherited minima, not further complete feat comparisons. No book PDFs are available. Archives of Nethys was not used. PRD and feature contracts establish scope and behavior, not attribution.

Skill Focus (Knowledge [Nobility]) has a complete ordinary CRB semantic comparison against [PCGen Skill Focus, line 156](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_feats.lst#L156) and [Knowledge (Nobility), line 50](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_skills.lst#L50). The chosen-skill introduction, exact +3/+6 Benefit at 10 ranks, and `MULT:YES`, `STACK:NO`, `CHOOSE:SKILL|TYPE=Base` cover the entire Special rule. No appended Combat Trick, adapted skill, linked rule body or alternate publication is present. This follows #338–#342's ordinary CRB admission precedent and reuses the existing reviewed CRB/PZO1110 notice. PCGen campaign copyright lines are compilation provenance, not newly inferred inherited origins or fresh book-chain approval. Automatic rank dispatch and repeatability remain mechanics gaps.

All 100 [Attribution Assessments](../../src/lib/catalog/data/attribution-assessments.json) and [evidence records](../../src/lib/catalog/data/attribution-evidence.json) bind complete-source normalized bodies, mapping, evidence and notices. Reduced fixtures cannot establish release attribution. Each unresolved assessment names its own `feats-343-whole-content-<upstream-id>` hold. Required notices on held entries are observed minima; unknown origins remain unknown. Forty-five non-CRB complete-chain notice holds, covering 46 observed notice minima including CRB, are enforced in [held-notices.json](../../scripts/catalog/legal/held-notices.json). No previous content or notice hold is cleared. Registry text/aliases, legal resources and permanent notice superset are unchanged. Existing trimmed notice text and raw-line provenance hashes remain intact; no new alias reconciles a variant.

## Inherited-rule audit

All 100 complete descriptions and structured fields were inspected. All 14 appended Combat Tricks require PZO1131, including records whose tags omit Combat Trick. Four Mythic feats require PZO1126. Nine Story feats require PZO1125 for the goal/completion framework; these literal markers do not establish the feat's primary publication.

Spirit's Gift requires PZO1129 for shaman spirit animal and PZO1110 for companion/familiar rules. Implant Bomb requires PZO1115 for bombs/discoveries and PZO1110 for healing/dispel rules. Greater Gathlain Magic adds PZO1129 for thorny entanglement and PZO1110 for command plants. Expanded Enhance Arrows requires PZO1123 for all four cited weapon abilities, alongside CRB arcane archer and ghost touch/distance rules. Venomous Spray and Assured Destruction require PZO1116 for serpentfolk poison and urdefhan daemonic pact, proven by the literal PCGen Bestiary 2 species rows. The named ganzi example in Planar Heritage uses PZO1141 from its pinned racial record; Awakened Hag Heritage uses the changeling record's PZO9280 minimum while its secondary heritage publication remains unidentified.

Metamagic Invocation also requires PZO1115 for Reach Spell and PZO1134 for the explicitly marked Tenacious SpellUI. Serren's Masterstroke requires PZO1134 for its vigilante precision-damage dependency; the source's literal “sudden strike” name remains unresolved, without an invented alias to hidden strike. Pinpoint Jab's inherited Targeted Strike supporting record explicitly cites **PZO1129**, so its notice minimum includes ACG rather than inferring a different class's deed from the name. Gaze Reflection includes OA mesmerist, APG burning gaze/witch, Bestiary gaze exceptions and CRB eyebite/Blind-Fight rules.

`catalog:notice-deps` is run against these structured dependencies and enforced holds. All warnings for this batch are investigated below with the final results. Older advisories remain their owning batches' work. This batch does not clear the inherited-rule audit holds for #333–#336 or #516–#519. There are **zero record-level 3.5 tags**. Such a tag would be a specific hold, never an exclusion; only whole 3.5 packs are importer exclusions.

## Exact dispositions

Every held row names its individual content hold and evidence gap in the inventory. The notices below are minima for held content, never complete-origin assertions. Prose-only submechanics do not change the whole-entry disposition.

| Stable key | Candidate | Disposition | Observed notice minima |
| --- | --- | --- | --- |
| `pf1-content/GmGA9Nk1MCrxb6cP` | Gluttonous Gobbler | Held: whole-content evidence unproven | PZO1110, PZO1112 |
| `pf1-content/Gn5qyEQdgYOcvBAt` | Spirit's Gift | Held: whole-content evidence unproven | PZO1129, PZO1110 |
| `pf1-content/GnnKBqldWhsKJiYH` | Poppet Familiar | Held: whole-content evidence unproven | PZO9481, PZO1110 |
| `pf1-content/Gpw6eYeSH9VjJPBI` | Prone Shooter | Held: whole-content evidence unproven | PZO1118, PZO1110, PZO1131 |
| `pf1-content/Gq7Cj0HnceRS2TC4` | Embrace of the Dark Fey | Held: whole-content evidence unproven | PZO1110, PZO1125 |
| `pf1-content/GrEw8LzuwVTGQgdT` | Voice of Beasts | Held: whole-content evidence unproven | PZO1140, PZO1110 |
| `pf1-content/GrL8sRp2GJPLH3Z3` | Cornugon Stun | Held: whole-content evidence unproven | PZO9407, PZO1110 |
| `pf1-content/Gs7vIeMhFM0zRh4L` | Implement Focus | Held: whole-content evidence unproven | PZO1132 |
| `pf1-content/GskcZX9HD7MxpuyI` | Signifer Armor Training | Held: whole-content evidence unproven | PZO1110 |
| `pf1-content/Gsm9D3P5fsEBcU5K` | Ricochet Splash Weapon | Held: whole-content evidence unproven | PZO1117, PZO1110 |
| `pf1-content/Gt3t3vHjssRsc7R7` | Wretched Curator | Held: whole-content evidence unproven | PZO9464, PZO1110, PZO1125 |
| `pf1-content/GtDonPy6v4QS9xca` | Untwisting Iron Strength | Held: whole-content evidence unproven | PZO1138, PZO9268, PZO1110, PZO1131 |
| `pf1-content/Gu44ENk2SAla373Y` | Believer's Hands | Held: whole-content evidence unproven | PZO1129, PZO1110 |
| `pf1-content/Gux7KiSpRLj6nKxW` | Starry Grace | Held: whole-content evidence unproven | PZO1134, PZO1110, PZO1129 |
| `pf1-content/GvOD7INb4Qx1ElOY` | Implant Bomb | Held: whole-content evidence unproven | PZO1117, PZO1110, PZO1115 |
| `pf1-content/GwTN9DFRiJNlmRse` | Overachiever | Held: whole-content evidence unproven | PZO9464, PZO1110, PZO1125 |
| `pf1-content/Gx0O8R9eqE0khOYn` | Iron Will (Mythic) | Held: whole-content evidence unproven | PZO1126, PZO1110 |
| `pf1-content/GxLeshuVogswEZ5w` | Blood Salvage | Held: whole-content evidence unproven | PZO1121 |
| `pf1-content/GxTZldNEYKsm9lya` | Fortune Teller | Held: whole-content evidence unproven | PZO9446, PZO9226, PZO1110 |
| `pf1-content/GyO1NLDcRtdre6hd` | Angel Wings | Held: whole-content evidence unproven | PZO1121, PZO1110 |
| `pf1-content/H1xPVUkaEtWsoe1a` | Planar Heritage | Held: whole-content evidence unproven | PZO1141 |
| `pf1-content/H26YRKTZsuJdCQWp` | Venomous Spray | Held: whole-content evidence unproven | PZO1110, PZO1112, PZO1116 |
| `pf1-content/H2TItshJOMEMyuiF` | Elven Accuracy | Held: whole-content evidence unproven | PZO1115, PZO1110, PZO1131 |
| `pf1-content/H3DYK2PdJRO8U5En` | Focused Animal Expertise | Held: whole-content evidence unproven | PZO9478, PZO1110 |
| `pf1-content/H5QtyhLMWhoJ3pCW` | Merciful Bane | Held: whole-content evidence unproven | PZO1118, PZO1110, PZO1115 |
| `pf1-content/H87mFGETMg3AIKRN` | Greater Gathlain Magic | Held: whole-content evidence unproven | PZO1140, PZO1110, PZO1129 |
| `pf1-content/H9WiCQ2l7em8fwHY` | Metamagic Invocation | Held: whole-content evidence unproven | PZO1110, PZO1132, PZO1115, PZO1134 |
| `pf1-content/H9qlKshXQcdrBCii` | Rival | Held: whole-content evidence unproven | PZO9469, PZO1110, PZO1125 |
| `pf1-content/HArtJzyKKBCqlSxx` | Agent of Purity | Held: whole-content evidence unproven | PZO1110, PZO1125 |
| `pf1-content/HDO5E11kSUb7BgBc` | Coordinated Capture | Held: whole-content evidence unproven | PZO1110 |
| `pf1-content/HDc4mR6QpjEx2jqZ` | Flanking Foil | Held: whole-content evidence unproven | PZO1118, PZO1110, PZO1131 |
| `pf1-content/HEEmBRbAKY5ZakU7` | Arcane Strike (Mythic) | Held: whole-content evidence unproven | PZO1126, PZO1110 |
| `pf1-content/HEH8jRZHIxqC9HCo` | Spirit Symbiosis | Held: whole-content evidence unproven | PZO9461, PZO1110, PZO1132 |
| `pf1-content/HHQcDDhuWvytoPxl` | Fox Insight | Held: whole-content evidence unproven | PZO1134, PZO1110 |
| `pf1-content/HID4IHRgQ7zmAPLL` | Blundering Defense | Held: whole-content evidence unproven | PZO1121, PZO1110, PZO1131 |
| `pf1-content/HIc0QXd9a4jwKJBr` | Scarring Spell | Held: whole-content evidence unproven | PZO1132, PZO1110 |
| `pf1-content/HIvpuR89yEWVwCZI` | Huntmaster | Held: whole-content evidence unproven | PZO1121, PZO1110, PZO1115 |
| `pf1-content/HL1tf4QhVXVk969o` | Dragonfly Style | Held: whole-content evidence unproven | PZO9493, PZO1110 |
| `pf1-content/HLUV2mnj0aU6uw36` | Assured Destruction | Held: whole-content evidence unproven | PZO1116 |
| `pf1-content/HLgnGJpFpAdL3Jt1` | Civilized Ghoulishness | Held: whole-content evidence unproven | PZO1110, PZO1112 |
| `pf1-content/HNmNx17913lkWa2c` | Spontaneous Nature's Ally | Held: whole-content evidence unproven | PZO1129, PZO1110 |
| `pf1-content/HO5PRAGpoDLtcrBE` | Overwatch Vortex | Held: whole-content evidence unproven | PZO9463, PZO1110 |
| `pf1-content/HOF7ZbqNssZm0FUI` | Tool Optimizer | Held: whole-content evidence unproven | PZO9481, PZO1110 |
| `pf1-content/HQHA3EljmEoTwV20` | Channel Discord | Held: whole-content evidence unproven | PZO9267, PZO1110 |
| `pf1-content/HRXjxU8L1jFPME8P` | Steel Soul | Held: whole-content evidence unproven | PZO1115, PZO1110 |
| `pf1-content/HS7v7bLCsMcjiR9u` | Daring Exploit | Held: whole-content evidence unproven | PZO9474, PZO1129 |
| `pf1-content/HXLTCLCmHR9LLsGo` | Splintering Weapon | Held: whole-content evidence unproven | PZO1118, PZO1110 |
| `pf1-content/HXxAvuKSCWk37uqj` | Domain Strike | Held: whole-content evidence unproven | PZO1118, PZO1110, PZO1131 |
| `pf1-content/HZcLHUmCoWirryD0` | Varisian Tattoo | Held: whole-content evidence unproven | PZO9446, PZO9226, PZO1110 |
| `pf1-content/HaE2gBIFh1yyAvU9` | Musketeer's Dodge | Held: whole-content evidence unproven | PZO1118 |
| `pf1-content/HaKBk0Hwrq7FO13R` | Theurgy | Held: whole-content evidence unproven | PZO1117, PZO1110 |
| `pf1-content/HaxfKV91W9ST8XYY` | Truth-Seeker | Held: whole-content evidence unproven | PZO9433, PZO1110, PZO1125, PZO1115 |
| `pf1-content/Hb7ugClgJ6K4NZYZ` | Returning Throw | Held: whole-content evidence unproven | PZO9280, PZO1110 |
| `pf1-content/HcxNeZC2qkszKV1W` | Lonely Death | Held: whole-content evidence unproven | PZO1110 |
| `pf1-content/HdLIUDhskAwWcRBZ` | Cleaving Finish | Held: whole-content evidence unproven | PZO1118, PZO1110, PZO1131 |
| `pf1-content/Hf6l7WhzaogPO1R6` | Quillbreaker Defense | Held: whole-content evidence unproven | PZO9440, PZO1110, PZO1131 |
| `pf1-content/HhNOstkfZOzeIViW` | Inspirational Commander | Held: whole-content evidence unproven | PZO9433 |
| `pf1-content/HjHc4yz8fH4fm9RY` | Raging Regeneration | Held: whole-content evidence unproven | PZO1112 |
| `pf1-content/HjPc9WT7tHZfSOuL` | Bull-Catcher Toss | Held: whole-content evidence unproven | PZO9478, PZO1110 |
| `pf1-content/HkRHM6yr4d8VAoUH` | Chilling Amplification | Held: whole-content evidence unproven | PZO9468, PZO1110 |
| `pf1-content/Hl6Xce9vn2OBuqyn` | Neither Elf nor Human | Held: whole-content evidence unproven | PZO1121, PZO1110 |
| `pf1-content/HnnGgpUbJRuSylBR` | Giant Killer | Held: whole-content evidence unproven | PZO1121, PZO1110, PZO1131 |
| `pf1-content/Ho3qCFTSlVcQrUo7` | Psychovore Strike | Held: whole-content evidence unproven | PZO1110 |
| `pf1-content/HoiBm1ghGs8q9vjm` | Repositioning Strike | Held: whole-content evidence unproven | PZO1115, PZO1110, PZO1131 |
| `pf1-content/Hp5xJXA8YFkbAgSW` | Stylized Spontaneity | Held: whole-content evidence unproven | PZO9292 |
| `pf1-content/HqIJLMSAL7VC4o75` | Kobold Confidence | Held: whole-content evidence unproven | PZO9432, PZO1110 |
| `pf1-content/HsOTmgcKcGrGLyCL` | Unusual Heritage (Dhampir) | Held: whole-content evidence unproven | PZO1110, PZO1112 |
| `pf1-content/HsxYHTHaZtIUUIGx` | Harrowed | Held: whole-content evidence unproven | PZO9446, PZO9226, PZO9000-2S, PZO1110 |
| `pf1-content/HtBEcem86sIuaoRP` | Masked by Fear | Held: whole-content evidence unproven | PZO1138, PZO9465, PZO1110 |
| `pf1-content/HteKuvnEnUuTBzAC` | Self-Sufficient (Mythic) | Held: whole-content evidence unproven | PZO1126, PZO1110 |
| `pf1-content/HvYZ9O5dhlfkFjDq` | Felling Smash | Held: whole-content evidence unproven | PZO1118, PZO1110, PZO1131 |
| `pf1-content/HwhGyqIWGyhSlPkf` | Armor Material Mastery | Held: whole-content evidence unproven | PZO9467, PZO1131 |
| `pf1-content/HxzHHtgoHjhp6UoM` | Furious Focus (Mythic) | Held: whole-content evidence unproven | PZO1126, PZO1110, PZO1115 |
| `pf1-content/HyN4adClhplxBdzE` | Forward from Beneath | Held: whole-content evidence unproven | PZO1110, PZO1125 |
| `pf1-content/HyXT115qVLe2TMP0` | Stag Submission | Held: whole-content evidence unproven | PZO9456, PZO1110 |
| `pf1-content/HzT5vGuTbYYpklFq` | Shatter Control | Held: whole-content evidence unproven | PZO1135, PZO1110 |
| `pf1-content/I13eNmCFoQM0KQCZ` | Giant Vendetta | Held: whole-content evidence unproven | PZO9453, PZO1110, PZO1125 |
| `pf1-content/I1qZqRMGLIGaWbtd` | Awakened Hag Heritage | Held: whole-content evidence unproven | PZO9280 |
| `pf1-content/I2RUg9KkpJrodkeH` | Halfling Slinger | Held: whole-content evidence unproven | PZO9415, PZO1110 |
| `pf1-content/I2XfbKBHjmI65Oxv` | Expanded Enhance Arrows | Held: whole-content evidence unproven | PZO1110, PZO1123 |
| `pf1-content/I2Xg9Gl1Buk4hfju` | Crusader's Fist | Held: whole-content evidence unproven | PZO1118, PZO1110, PZO1115, PZO1131 |
| `pf1-content/I45XeJHLhTsWYqff` | Believer's Boon | Held: whole-content evidence unproven | PZO1129, PZO1110 |
| `pf1-content/I4GNiN7rgHHPnLtt` | Cataract | Held: whole-content evidence unproven | PZO9468 |
| `pf1-content/I8h7trE9b71XMipO` | Gaze Reflection | Held: whole-content evidence unproven | PZO1112, PZO1132, PZO1115, PZO1110 |
| `pf1-content/IAXIKKJTaIP6oZyX` | Circling Mongoose | Held: whole-content evidence unproven | PZO9455, PZO1110 |
| `pf1-content/IAdJN3A0ThxR4l3h` | Innocent Blood | Held: whole-content evidence unproven | PZO1125, PZO1110 |
| `pf1-content/ICI9T0jc4437bxFH` | Death's Host | Held: whole-content evidence unproven | PZO9471, PZO1110 |
| `pf1-content/ICkxsUqZMesT3KRC` | Elemental Spell | Held: whole-content evidence unproven | PZO1115, PZO1110 |
| `pf1-content/IDesGyM2nNawIXdI` | Disrupting Fist | Held: whole-content evidence unproven | PZO1135, PZO1110 |
| `pf1-content/IF48Oa1PkJ0nT1Rn` | Elemental Claws | Held: whole-content evidence unproven | PZO1110, PZO1112 |
| `pf1-content/IFKizIz9ICqvFLR4` | Betrayer | Held: whole-content evidence unproven | PZO1118, PZO1110 |
| `pf1-content/IFkJusznqSCdgeeQ` | Herbal Components | Held: whole-content evidence unproven | PZO9456, PZO1110 |
| `pf1-content/IGlL6mwZTu6RScYr` | Skill Focus (Knowledge [Nobility]) | Admitted: complete ordinary CRB comparison | PZO1110 |
| `pf1-content/IHFL3Jm9WRw2Wtuv` | Penetrating Stare | Held: whole-content evidence unproven | PZO1132 |
| `pf1-content/IHPGcjdO9rs7xb99` | Serren's Masterstroke | Held: whole-content evidence unproven | PZO1110, PZO1134 |
| `pf1-content/IIeQwijpoEPptZ8V` | Quick Preparation | Held: whole-content evidence unproven | PZO9435, PZO1110 |
| `pf1-content/IK1KKlpQ3qyzSpgg` | Pinpoint Jab | Held: whole-content evidence unproven | PZO9493, PZO1110, PZO1129 |
| `pf1-content/ILTFqkYq9DZWZJiJ` | Wilding Stride | Held: whole-content evidence unproven | PZO1140, PZO1110 |
| `pf1-content/IOPS4W1mVH76IgxX` | Greater Blind-Fight | Held: whole-content evidence unproven | PZO1115, PZO1110, PZO1131 |
| `pf1-content/IOaZqFcfv14sU86S` | Bloody Mess | Held: whole-content evidence unproven | PZO1110 |

## Mechanics and separate prose pass

The required note/action-conditional/Item Ability inventory is empty. The initial required drafter retained 2,021 existing records and added zero. The separate `--descriptions` pass added 59 drafts. Independent complete review supplied **100 checked description records** and **43 numeric Modifiers**, including the 41 descriptions outside the parser trigger. Entire Benefit, Normal, Special, Story Goal/Completion, Pathfinder Society and Combat Trick clauses remain readable Notes; the full descriptions retain flavor and prerequisite text. No placeholder is checked.

Shared Situations are used where they cover the exact rule: Harrowed uses `enchantment`; Giant Vendetta's dodge AC uses `giants`. Local Situations preserve rank thresholds, chosen animal/blighted terrain or giant kinds, caster/component/slot conditions, readied attacks, active styles, action timing and recipient restrictions. Ordinary totals do not receive manually selected bonuses. Distinct copies retain the same rule Source and suppress duplicates. Dragonfly Style's first, unqualified Acrobatics sentence adds `@ability.wis.mod`; its explicitly conditional higher-ground melee benefit keeps its complete style/surface/weight/opponent-size scope.

**All 100 candidates retain a named unautomated rule/calculation or fact**, alongside the independent repeatability gap. Many are manual action, choice or recipient rules. This is reviewed coverage, not a claim of complete feat automation. Notable numeric gaps include Poppet Familiar's CL/augmentation/breath progression, Spirit's Gift duration/recipient, Implant Bomb resources/timing/cost/removal DC, Serren's precision-dice progression, Pinpoint Jab targets/DCs/resources, Rival acquisition-relative skill points/Fame, and the chosen ability substitution in Kobold Confidence. The raw Skill Focus rank formula remains unsupported and contributes nothing; manual +3/+6 Situations demonstrate the correct amounts. Caster-level checks in Innocent Blood are **not** increased caster level, and are retained as Notes rather than a wrong `casterLevel` Modifier.

Replacement values are not additive bonuses. Prone Shooter's -2/+6 AC end values, Assured Destruction's 3d6/+4, and Wilding Stride's nonstacking speed remain outstanding. Musketeer's Dodge states a +4 dodge benefit but does not expressly settle its interaction with the deed's existing bonus or the added benefit's exact attack/duration scope; no replacement or additive interpretation is guessed. **Steel Soul** must replace Hardy's normal spell/SLA +2 with +4. Racial bonuses stack across distinct Sources, so appending +4 would yield +6. Tests exposed that error during review; the final overlay emits **no Steel Soul numeric Modifier** and names the replacement gap. The shared spell/SLA situation vocabulary does not itself implement replacement.

Every imported prerequisite atom was compared with its authored line. Numeric ability/BAB/skill/class/character-level facts and supported references are retained. Twelve candidates name specific parsing/representation gaps, including Tool Optimizer and Huntmaster's alternatives, Theurgy's shared Int/Cha threshold, Bull-Catcher Toss's BAB/class alternatives, caster-level and lawful-good atoms, firearm group proficiency and Felling Smash's stamina exception. Unchecked clauses remain unresolved advisories; they are not assumed met. No candidate grants weapon or armor proficiency; prerequisite proficiency clauses grant nothing. Every feat retains `repeatable: unreviewed`, which the isolated fixture adapter omits without inventing a replacement. Source arrays and stable remaps are unchanged. Importer gaps remain #719/#720 work; none is fixed here or converted to an attribution hold.

## Public-boundary demonstration

The [fixtures](../../tests/fixtures/feats-343/README.md) contain the 100 byte-exact candidates, 28 supporting YAML records, 54 permitted comparison snapshots, source hashes and complete-source selected preview bodies. Reduced manifests deliberately retain only the candidate pack and an empty system `packs` directory. Exact ticket-order key SHA-256: `dd0c84e63c4d6df2f9334a8ddbc7fa1aa60b50745ac9fe9c873b8a8dd647163f`.

[Catalog tests](../../tests/catalog/feats-343.test.ts) verify exact inventory/bytes, reviewed outputs, current four-part attribution bindings, content/evidence invalidation, all inherited minima/enforced notice holds and comparison hashes. Public resolver tests pin Skill Focus +3/+6, simultaneous rank Situation suppression, same-Source copies and wrong-entry local Situation exclusion; Dragonfly's Wisdom-on-Acrobatics; shared enchantment/giant scopes; story rank values; unsupported replacement values and prerequisite gaps.

[The isolated saved-sheet test](../../convex/feats343.integration.test.ts) selects the admitted nobility Skill Focus through public writers and compares saved/current/permanent statistics with catalog preview. Another campaign member can edit, while outsiders, unauthenticated callers and cross-campaign references are refused. It separately demonstrates the explicitly held Harrowed body in a Character-scoped fixture, with the shared enchantment +1, no fear-only benefit and deactivation. These fixtures construct no global Catalog Release, clear no hold and activate no production data.

## Commands and observed results

All catalog commands use the two verified pinned source paths above. Candidate selections and previews stay in ignored worktree scratch and are removed after reporting. The inherited launcher `TMPDIR` stays outside every worktree under the parent's `.ep-tmp/`; no `/tmp`, environment file or private E2E material is used. Checks run sequentially, with `CI=true` for tests and two test workers. No full `pnpm test` suite runs.

Every source command used `--system /home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1 --content /home/andreas/repos/everythingpath/sources/pf1-content`, with the exact 100-key selection supplied to bounded runs and an ignored scratch `--out` directory. Drafts are diagnostic output, not additional reviewed records.

| Command / scope | Observed result |
| --- | --- |
| `pnpm -s catalog:curate --candidates …` — initial required pass | Exit 0: 2,021 retained, zero added/replaced, zero missing/unresolved required mechanics. |
| `pnpm -s catalog:curate --candidates … --descriptions` — separate initial prose pass | Exit 0: 59 description drafts; complete manual review covers all 100. |
| `pnpm -s catalog:curate --candidates … --descriptions` — final | Exit 0: 2,121 records, zero new/replaced drafts, zero missing/unresolved required mechanics. |
| `pnpm -s catalog:preview --candidates …` — final, repeated after diagnostic clarification | Exit 0: 100 entries, **1 admitted / 99 held**, zero admission failures/dependent omissions/exceptions. Required coverage passes; 100 descriptions checked and 100 optional unresolved description diagnostics remain. |
| `pnpm -s catalog:preview` — complete corpus, repeated after clarification | Exit 1: 23,109 entries, 538 resources; 59 admitted, 23,195 held, two dependent omissions, zero retained exceptions, **4,689 failures, all outside #343**. Full-corpus required coverage has 3,583 missing records; this is not claimed as a global passing gate. All #343 bodies and four-part bindings are current. |
| `pnpm -s catalog:curate` — complete corpus | Exit 0: 5,704 records, 3,583 new drafts, zero replaced/missing and 758 unresolved mechanics elsewhere. No importer crash or tool fix; all generated drafts remain scratch. |
| `pnpm catalog:notice-deps` | Exit 0: 3,810 dependencies, 2,303 candidates, 26 inventories; zero gaps/waivers/stale dependencies. 36 older advisories, **none in #343**. |
| `pnpm -s typecheck` | Exit 0. |
| `pnpm -s lint` | Exit 0. |
| `pnpm -s check:initial-migration-writers` | Exit 0: 183 registrations checked. |
| `pnpm catalog:pin` | Exit 0: `sha256:d7a42ca346d875f9497c7da94325022ac289d7931226a3649979a13f410c8063`. |
| `CI=true pnpm test tests/catalog convex/feats343.integration.test.ts --maxWorkers 2` | Exit 0: **73 files / 1,681 tests passed**. |
| `CI=true pnpm test tests/catalog/feats-343.test.ts convex/feats343.integration.test.ts --maxWorkers 2` — after final binding | Exit 0: **two files / 10 tests passed**. |
| `pnpm -s catalog:format --check` | Exit 0: canonical catalog data, including the final bound assessments/evidence. |

The last clarification removes an unsupported replacement assertion from the Musketeer's Dodge diagnostic without adding a Modifier. A fresh complete extraction, all 100 assessment bindings, selected fixture bodies, bounded gate and focused tests verify that final text; it does not change the earlier passing typecheck/lint/writer checks or the reviewed values.

## Timing and workflow

Elapsed wall time uses the launch timestamp and recorded checkpoints (UTC); tool waits are included. Orientation, pinned-source checks and both initial draft passes ran **20:45:51–20:47:56 (2m 05s)**. Complete content, comparison, inherited-notice and mechanics review with initial artifact assembly ran **20:47:56–20:57:32 (9m 36s)**. Verification, data corrections, binding refresh, report and scratch cleanup ran **20:57:32–21:25:23 (27m 51s)**. Total: **39m 32s**. The last phase includes review refinements discovered by gates/tests; it is one elapsed interval, not double-counted parallel work.

The initial full preview rejected two incorrectly spelled initiative output targets in the newly authored data; these were corrected to the existing `init` target before binding. The focused tests caught Steel Soul's distinct-Source racial stacking and a test's incorrect aggregate AC accessor. The final records/tests use the actual replacement limitation and leaf target. The inherited audit added the specific Bestiary 2, metamagic and vigilante dependencies before final binding. No product, importer or resolver change was necessary.

The bounded preview is a batch coverage/admission gate; the full preview distinguishes out-of-batch failures. Required coverage can pass while 100 optional description diagnostics remain, so those gaps are explicitly reported rather than counted as finished calculations. No book-only origin or variant is guessed. All previous holds/artifacts remain preserved, including the separate outstanding inherited-notice audits. Changes remain uncommitted for the orchestrator; no Git/GitHub write, deployment or production activation occurs.


## Review fix round 1

The bounded follow-up fixes both review findings without changing the **one admitted / 99 held** dispositions, mechanics or Curation Overlay. Truth-Seeker explicitly recommends `SkepticAPG` in pinned YAML lines 23–24. The added PCGen APG ability snapshot identifies Skeptic at line 51, `SOURCEPAGE:p.329`, with a +2 trait bonus on all saving throws against illusions; its header and campaign manifest explicitly identify *Advanced Player's Guide*. This establishes **PZO1115** as an inherited notice minimum. The existing `feats-343-notice-PZO1115-complete-chain` hold is required and enforced; no notice is approved or cleared. The similarly named upstream [Skeptic record](https://gitlab.com/foundryvtt_pathfinder1e/pf1-content/-/blob/02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d/src/pf-traits/Skeptic_Sczt3ECdEM5yPWTO.yaml#L19) cites PZO1125 p.58 and does not supersede the explicit APG reference. A suggested trait grants no new Modifier.

`questTableNoticeReview` records all 12 bare page citations: **174, 91, 130, 211, 212, 94, 212, 145, 169, 177, 179, 198**. The exact PCGen Truth-Seeker row in Quests & Campaigns p.13 omits Suggested Traits and the entire quest table. The added Quests & Campaigns manifest identifies the feat dataset but does not identify the book addressed by those table citations. The existing Inner Sea World Guide manifest has no corresponding quest rows or page mapping. **The table-reference book remains unidentified from permitted evidence**, inside `feats-343-whole-content-HaxfKV91W9ST8XYY`. No product-code alias is invented from setting names or page numbers; no book PDF is available. This is an attribution evidence gap, separate from the unchanged manual rank threshold, secret-door check and illusion reroll mechanics.

All **99** older assessment rationales (**92 from #334 and seven from #338**) were restored directly from immutable feature baseline **e39009f8**, including their trailing spaces. A raw JSON comparison proves all **2,334 pre-existing assessment rows** are value-equal to that baseline. Serialization uses raw rows, never the trimming admission loader. Regression coverage pins the entire pre-existing collection fingerprint and the 99 retained trailing-space rationales. Only Truth-Seeker's new assessment/evidence changes; the other 99 new batch records remain unchanged. Its content/mapping bindings remain unchanged, with evidence/notice bindings refreshed against a complete pinned extraction. Registry and hold registry contents are unchanged. Three permitted PCGen snapshots bring comparison fixtures to **54 files**.

The pre-existing assessment fingerprint is `ad685721d0b6fb0d3d2250548c285d6013e7eb318dcf8f8e99dcad21f52dedeb`; the refreshed complete extraction fingerprint is `bbefb72b9c853d65a4e86bf72b5d608c99429eda1135cc1b6aa705b3312b1459`. No other candidates were researched again; no full-corpus curate or full test suite was run.


| Follow-up command or proof | Result |
| --- | --- |
| Raw comparisons against `git show e39009f8:src/lib/catalog/data/attribution-assessments.json` | Pass: **2,334/2,334** pre-existing rows value-equal, including 99 restored trailing-space rationales. Other 99 new #343 assessments, evidence and candidate reviews unchanged from the worktree HEAD. |
| Complete pinned `importCatalog` extraction and `buildAssessmentBinding` | Pass: Truth-Seeker content/mapping hashes unchanged; evidence/notice hashes refreshed. No full-corpus curate rerun. |
| `pnpm -s catalog:preview --system <pinned system> --content <pinned content> --candidates <100 exact keys> --out <task scratch>` | Exit 0: **1 admitted / 99 held**, zero failures, dependent omissions or retained exceptions. |
| `CI=true pnpm test tests/catalog convex/feats343.integration.test.ts --maxWorkers 2` | Exit 0: **75 files / 1,729 tests**, including both added regressions and the saved-sheet boundary. |
| `pnpm -s typecheck` | Exit 0. |
| `pnpm -s lint` | Exit 0. |
| `pnpm catalog:notice-deps` | Exit 0: **4,145 dependencies, 2,403 candidates, 28 inventories; zero gaps/waivers/stale dependencies**. All 36 advisories are outside #343. |
| `pnpm -s check:initial-migration-writers` | Exit 0: 183 registrations. |
| `pnpm catalog:pin` | Exit 0: unchanged pin `sha256:d7a42ca346d875f9497c7da94325022ac289d7931226a3649979a13f410c8063`. |
| `pnpm -s catalog:format --check` | Exit 0: canonical data, with all restored whitespace preserved. |
| `pnpm exec prettier --check tests/catalog/feats-343.test.ts` | Exit 0. |
| `git diff --check` | Exit 0. |

A scratch binding script exceeded Node's default Git-output buffer; increasing its buffer allowed the immutable baseline read to finish. The command guard rejected `rm -rf`; a path-checked Python cleanup removed only the task-owned scratch directory. This required no tool or product fix. The evidence limit remains the unidentifiable quest-table reference book. Task-owned scratch is removed after the final preservation/diff proof; the inherited external TMPDIR is retained for the launcher. Changes remain uncommitted.

Follow-up elapsed wall time (UTC checkpoints): orientation, evidence and preservation assembly **21:37:03–21:40:24 (3m 21s)**; complete-source rebinding and bounded preview **21:40:24–21:44:16 (3m 52s)**; sequential gates, report and cleanup **21:44:16–21:50:28 (6m 12s)**. Total through final verification: **13m 25s**.
