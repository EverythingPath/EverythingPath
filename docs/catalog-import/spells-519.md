# Spell curation review: #519

Reviewed 2026-10-08 by **Sol (AI curator) for the owner**, following [#519](https://github.com/AndreasUnunger/EverythingPath/issues/519), [PRD #251 Decisions 9, 10 and 17 and the acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461), [Spellcasting](../character-sheet/spellcasting.md), [curation](curation.md), and the [#328 precedent](races-328.md).

The exact 100-key inventory contains **99 Spell definitions and one Abjuration school folder**. Every key receives one disposition: **0 supported/admitted, 99 specifically held, 0 dependently omitted, 0 wholly unsupported/prose-only, and 1 contract-excluded folder**. Attribution, calculation completeness, curation coverage and reference validity are separate findings. Combat and cast-time procedures can remain prose without making the entire Spell unsupported. No Catalog Release was published or activated.

## Evidence and scope

- Read-only Foundry PF1 v11.11, commit `418761d2e16a6037c0156bb4a241f7cea5a2986d`.
- Read-only pf1-content 11.4.0, commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`.
- [Single batch inventory, attribution evidence and mechanics review](../../scripts/catalog/legal/spells-519.json): exact ticket keys, source locations and hashes, minimum notice identities, named holds, metadata/actions and outstanding calculations.
- [Source-backed fixtures](../../tests/fixtures/spells-519/provenance.json), the [Curation Overlay](../../scripts/catalog/reviewed-curation.json), [Attribution Assessments](../../src/lib/catalog/data/attribution-assessments.json), [evidence](../../src/lib/catalog/data/attribution-evidence.json) and [enforced notice holds](../../scripts/catalog/legal/held-notices.json).

The permitted PCGen comparator uses commit `25523dbcf10e86c280fc0f447167ea43d67419d3`, [CRB Spell data](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_spells.lst) and [campaign metadata](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/core_rulebook.pcc). Eighteen CRB-root descriptions receive content comparisons: 16 match after recorded representation normalization, while Reincarnate and Word of Chaos have explicitly recorded differences. These prose comparisons do not bound later class-list/Granted Spell metadata, independent material/action fields or linked-content origins. PCGen's Paizo Inc. wording is not asserted equivalent to the existing Paizo Publishing, LLC Registry text. No Foundry runtime/configuration module was imported or executed. No book PDFs were available and Archives of Nethys was not used.

The inventory records **49 observed minimum notice identities** and **48 notice/notice-chain holds**, enforced through the held-notices registry. The existing CRB notice identity is reused without fresh notice review. All 99 whole-content comparisons remain unresolved assessments, independent of those notice holds. Twenty roots contain 21 unique direct linked keys; linked material is evidence/context, not additional reviewed or admitted content. Book PDFs are unavailable, later class/Granted Spell origin bounds remain incomplete, and no title/name match or notice superset is treated as whole-content coverage.

The exact ordered ticket-key SHA-256 is `c3fa1c30c53d905c84b5084e396574ce8c82bcf43f6c754001093fb750134ecf`. Fixtures retain all 100 root records and 28 class-context records with byte hashes; context definitions are not candidate admissions. Existing identity remaps, shared Situations, Registry records and all prior overlay/assessment/evidence/hold objects are preserved.

## Every-key disposition

Each Spell is specifically held for its individual whole-content comparison and any named notice chain. Technical failures are reported separately below. The folder receives no fabricated attribution or mechanics assessment.

| Exact key | Spell or folder | Upstream root citation | Disposition |
| --- | --- | --- | --- |
| `pf1/3fc6csip6z4xw0am` | Substitute Trail | PZO9292, p. 62 | Specifically held |
| `pf1/3fe0fjpgv2qb9khz` | Create Holds | PZO9430, p. 30 | Specifically held |
| `pf1/3fkwj6d8s65ufwar` | Accelerate Poison | PZO1115, p. 201 | Specifically held |
| `pf1/3fravqa4vrm4ygkr` | Transmute Metal to Wood | PZO1110, p. 361 | Specifically held |
| `pf1/3h6xbwxd3gvuvp77` | Magical Beast Shape | PZO1140, p. 231 | Specifically held |
| `pf1/3hszv44b9w3w80pq` | Lash of the Astradaemon | PZO1139, p. 184, 38 | Specifically held |
| `pf1/3i5ikytg2c7bedwp` | Dispel Balance | PZO1141, p. 40; PZO9443, p. 27 | Specifically held |
| `pf1/3idp5fjp62wpn4a4` | Vampiric Shadow Shield | PZO1129, p. 198 | Specifically held |
| `pf1/3ijtwoy6sbv2i2da` | Rend Body I | PZO9477, p. 10 | Specifically held |
| `pf1/3ixriz492d5rgi4t` | Litany of Righteousness | PZO1118, p. 235 | Specifically held |
| `pf1/3jaumkutti1ytulq` | Mark of Justice | PZO1110, p. 312 | Specifically held |
| `pf1/3k8vsklt37p5i0ug` | Anthropomorphic Animal | PZO1117, p. 206 | Specifically held |
| `pf1/3l41qcrvsmo9f2zc` | Pouncing Fury | PZO1140, p. 233; PZO9473, p. 7 | Specifically held |
| `pf1/3lazpoax85p31ytc` | Absorb Rune II | PZO1138, p. 60 | Specifically held |
| `pf1/3lfx1ccxo2hdqrf3` | Telekinesis | PZO1110, p. 357 | Specifically held |
| `pf1/3lgy3s4h4087ojht` | Dispel Chaos | PZO1110, p. 271 | Specifically held |
| `pf1/3mfmhx8avu7h3iom` | Spider Climb | PZO1110, p. 347 | Specifically held |
| `pf1/3mrnqy6jbl4tnlhy` | Telekinetic Maneuver | PZO1132, p. 188 | Specifically held |
| `pf1/3mvzelxgq38a2nw1` | Oracle's Burden | PZO1115, p. 234 | Specifically held |
| `pf1/3ntxp3zun1j9mf0m` | Hypnotism | PZO1110, p. 298 | Specifically held |
| `pf1/3nxf2nap088jjzbi` | Stone Shield | PZO1121, p. 149 | Specifically held |
| `pf1/3ofgzglphaotmwnw` | Shamefully Overdressed | PZO1134, p. 225 | Specifically held |
| `pf1/3opbwwfp21ih8wz2` | Pierce Disguise | PZO1129, p. 190 | Specifically held |
| `pf1/3p5s2rkpe7u7ifzn` | Chill Metal | PZO1110, p. 254 | Specifically held |
| `pf1/3plb67e51webutdz` | Sleep | PZO1110, p. 344 | Specifically held |
| `pf1/3q41uysvduuvlimj` | Dark Whispers | PZO1134, p. 209 | Specifically held |
| `pf1/3qpvx0evlgk4bfda` | Sun Metal | PZO1118, p. 245; PZO9416, p. 28 | Specifically held |
| `pf1/3qs0ogoxr5jwkz0m` | Mighty Fist of the Earth | PZO1121, p. 149 | Specifically held |
| `pf1/3quizxugd8o4c4yb` | Rune of Rule | PZO1138, p. 61 | Specifically held |
| `pf1/3r2yhd1pd5v59bir` | Aroden's Spellbane | PZO9237, p. 52 | Specifically held |
| `pf1/3r877rzevrasfn3g` | Recharge Innate Magic | PZO1121, p. 39 | Specifically held |
| `pf1/3rn9hvdze0hjz5y4` | Swipe | PZO1002, p. 419; PZO9005, p. 62 | Specifically held |
| `pf1/3t0fqhbt4qsy7wfx` | Reaper's Coterie | PZO9455, p. 31 | Specifically held |
| `pf1/3uiss5e1xbdckfuf` | Curse of Fell Seasons | PZO1135, p. 114 | Specifically held |
| `pf1/3v1k7qnzd13s5dj3` | Expeditious Excavation | PZO1115, p. 220 | Specifically held |
| `pf1/3v5vw6x0aa2hp3vc` | Shadow Endurance | PZO9464, p. 31 | Specifically held |
| `pf1/3w1ozzzf8hk0gdzm` | Reincarnate | PZO1110, p. 331 | Specifically held |
| `pf1/3wcvosazm31i8758` | Contagious Zeal | PZO1132, p. 162 | Specifically held |
| `pf1/3wdb34u6m64ctji7` | Lay of the Land | PZO9436, p. 29 | Specifically held |
| `pf1/3wdx7fjulsohi1lk` | Weird | PZO1110, p. 369 | Specifically held |
| `pf1/3wyqlqtiyx5c1fcf` | Weaponwand | PZO9237, p. 63 | Specifically held |
| `pf1/3yeijoqk79r64sp9` | Trade Items | PZO1134, p. 226 | Specifically held |
| `pf1/3ze0kso9hxff5u2f` | False Life | PZO1110, p. 280 | Specifically held |
| `pf1/3zi4ie97hxr1d3ng` | Word of Chaos | PZO1110, p. 371 | Specifically held |
| `pf1/3zx0a8owmsr7x9d1` | False Future | PZO1134, p. 214 | Specifically held |
| `pf1/40moa508jexunl68` | Imbue with Flight | PZO9438, p. 15 | Specifically held |
| `pf1/41d87ar2vzt2rnhv` | Passing Fancy | PZO9469, p. 29 | Specifically held |
| `pf1/429wzxjzm1chnsq7` | Instrument of Agony | PZO1118, p. 232 | Specifically held |
| `pf1/42ddkxklxocbodnb` | Youthful Appearance | PZO1117, p. 249 | Specifically held |
| `pf1/4322oipgd4hjkuj4` | Enlarge Tail | PZO9432, p. 27 | Specifically held |
| `pf1/446vcsetq4ny904e` | Mislead | PZO1110, p. 315 | Specifically held |
| `pf1/44nj6jzo81o9mng9` | Shadow Conjuration, Greater | PZO1110, p. 340 | Specifically held |
| `pf1/45n492e4bxowkdqu` | Vacuous Vessel | PZO9462, p. 27 | Specifically held |
| `pf1/45rrwvrr14hv2r4f` | Touch of Mercy | PZO9431, p. 29 | Specifically held |
| `pf1/465ck6fc6e40l1kn` | Mental Barrier IV | PZO1132, p. 176 | Specifically held |
| `pf1/476th5lyxxemseyx` | Ablative Barrier | PZO1118, p. 221 | Specifically held |
| `pf1/478jgozgfbt20u0q` | Hydraulic Torrent | PZO1115, p. 229 | Specifically held |
| `pf1/47ekxyrhvrxbsoia` | Egorian Diplomacy | PZO9469, p. 28 | Specifically held |
| `pf1/48nw971qka3wgeui` | Mirror Polish | PZO1129, p. 188 | Specifically held |
| `pf1/48qaybvgr2faagte` | Phantom Limb | PZO9461, p. 31 | Specifically held |
| `pf1/499phaxpgce53z6q` | Ride The Waves | PZO1117, p. 235 | Specifically held |
| `pf1/49p4v9az7rfzj5fw` | Spellcasting Contract | PZO9029, p. 68 | Specifically held |
| `pf1/49yc9dpr4kvgki2s` | Magic Missile | PZO1110, p. 309 | Specifically held |
| `pf1/4NHp2XrrZ02oHYog` | Abjuration | Not applicable: folder | Excluded: pack folder |
| `pf1/4SkqICrRfq3BYu2j` | Speak with Waves | PZO9483, p. 14 | Specifically held |
| `pf1/4ahy3ap8ye816o40` | Kalistocrat's Nightmare | PZO9468, p. 22 | Specifically held |
| `pf1/4amchj89pppg180r` | Fleshwarping Swarm | PZO9280, p. 220 | Specifically held |
| `pf1/4apaimrxotyifxmz` | Jungle Mind | PZO9436, p. 28 | Specifically held |
| `pf1/4b2gw3xfut5ssood` | Invoke Primal Power | PZO1138, p. 134 | Specifically held |
| `pf1/4br9puuneexco5hx` | Contingency | PZO1110, p. 259 | Specifically held |
| `pf1/4byiz5jqlzbrm41t` | Army Across Time | PZO9480, p. 30 | Specifically held |
| `pf1/4c2m0fmf3tq01rpu` | Transfer Familiar | PZO9454, p. 23 | Specifically held |
| `pf1/4cTBeTF32aOcJbVd` | Telepathic Silence | PZO9478, p. 31 | Specifically held |
| `pf1/4d8iovah3qedm0gx` | Summon Vanth | PZO9080, p. 28 | Specifically held |
| `pf1/4d9r5y2sktoz0ktf` | Outbreak | PZO1136, p. 69 | Specifically held |
| `pf1/4dczr3vd96vbcirc` | Hunter's Howl | PZO1115, p. 228 | Specifically held |
| `pf1/4epltybyhbfciqxw` | Walk the Plank | PZO1136, p. 188 | Specifically held |
| `pf1/4eu1kdpfr6lxtvt8` | Winter Feathers | PZO1121, p. 167 | Specifically held |
| `pf1/4evyyep78a9gjhpo` | Steam Ray Fusillade | PZO92102, p. 61 | Specifically held |
| `pf1/4fm4md4eux7sw6o0` | Hex Glyph, Greater | PZO1129, p. 184 | Specifically held |
| `pf1/4fsqwcplksc1xdj9` | Wall of Bone | PZO9468, p. 13 | Specifically held |
| `pf1/4g2m3rbl6c7jk682` | Death Clutch | PZO1135, p. 115 | Specifically held |
| `pf1/4gec71ccemrq7lyq` | Brand of Conformity | PZO1138, p. 97; PZO9293, p. 60 | Specifically held |
| `pf1/4gs8xrmzy2bvfkr0` | Twisted Space | PZO1118, p. 248 | Specifically held |
| `pf1/4gt8oh1xz0ssux4a` | Storm Step | PZO9447, p. 13 | Specifically held |
| `pf1/4gvcypqu5drxqkmd` | Titanic Anchoring | PZO9091, p. 71 | Specifically held |
| `pf1/4gxx3bodf76e63en` | River of Wind | PZO1115, p. 240 | Specifically held |
| `pf1/4hztew00f84p470e` | Ironbloom Sprouts | PZO9062, p. 75 | Specifically held |
| `pf1/4iT5C0izh25ADJk0` | Influence Wild Magic | PZO9486, p. 29 | Specifically held |
| `pf1/4is53oobbjn7rxh3` | Hymn of Peace | PZO9431, p. 29 | Specifically held |
| `pf1/4jddpsd5pkky0qjg` | Synapse Overload | PZO1132, p. 187 | Specifically held |
| `pf1/4jnqnfe3mfqhjwps` | Authenticating Gaze | PZO9462, p. 30 | Specifically held |
| `pf1/4jsss37x0pplib8f` | Mirror Image | PZO1110, p. 314 | Specifically held |
| `pf1/4k32l03rzxgyifkx` | Crafter's Fortune | PZO1115, p. 213 | Specifically held |
| `pf1/4k9bh8ny1il2oner` | Spell Resistance | PZO1110, p. 347 | Specifically held |
| `pf1/4lA39zThxcpERkyv` | Hide from Undead, Greater | PZO9486, p. 29 | Specifically held |
| `pf1/4llo1o1rrtyzp1xw` | Shifted Steps | PZO1134, p. 225 | Specifically held |
| `pf1/4ly8hbdlz1tufb6c` | Bleeding Strike | PZO9077, p. 75 | Specifically held |
| `pf1/4me7ddc17nowrs6f` | Sessile Spirit | PZO1132, p. 185 | Specifically held |
| `pf1/4mvqcqfaqv54drf3` | Shared Wrath | PZO1115, p. 243 | Specifically held |

## Mechanics review

The required note/action-conditional/Item Ability inventory is empty for these 99 Spells. The separate description drafter selects 49 optional prose candidates; the review covers every complete Spell description rather than treating the selection predicate as the review boundary. Recorded Spell definitions grant no numeric Modifiers; running Spell Effects remain separate. No out-of-inventory effects, class schedules, prerequisite facts, proficiency Grants or Base Items are invented to complete this batch.


The overlay adds **99 checked description records and 113 readable Notes**, with zero numeric Modifiers and no new shared-effect Sources. It preserves school/subschool/descriptors, class-tag levels and Granted Spell metadata. Shared Situations are reused at their exact scope, including `poison`, `fear`, `giants`, `grapple`, `bullRush`, `overrun`, `reposition` and `trip`; where no equivalent shared Situation fits, Notes retain the exact local circumstance. No new aliases or implied equivalences are added.

**37 candidates name 37 outstanding calculation tasks**. Optional description records retain explicit unresolved diagnostics for those tasks; this does not fail required-record coverage. Rolls, damage/healing procedures, temporary pools, durations, summoning, preparation and discharge tracking stay prose under the consuming contract. False Life explicitly remains a play-time temporary-HP pool, never maximum HP or ordinary healing. Each task below remains distinct from legal holds.

| Exact key / Spell | Outstanding calculation |
| --- | --- |
| `pf1/3fravqa4vrm4ygkr` Transmute Metal to Wood | Transmuted-item attack and damage -2 and armor bonus reduction 2 require item-scoped corrections; breakage/degrading armor and restoration remain play-time prose. |
| `pf1/3h6xbwxd3gvuvp77` Magical Beast Shape | Separate chosen-form Spell Effects must apply Diminutive Dexterity +10 size/Strength -4, Huge Strength +8 size/Dexterity -4/Constitution +2 size/natural armor +7 and inherited other form sizes from Beast Shape IV; chosen-form poison saves +8 resistance, energy resistance 20 and movement/attacks remain outstanding. |
| `pf1/3hszv44b9w3w80pq` Lash of the Astradaemon | Separate effect requires primary slashing claw 1d6 Medium/1d4 Small; negative levels, 5 temporary HP per failed save, uses and immunity are combat prose; temporary HP must not increase maximum HP. |
| `pf1/3i5ikytg2c7bedwp` Dispel Balance | Alignment-scoped separate effect requires deflection AC +3 against chaotic neutral/lawful neutral/neutral evil/neutral good and +5 against true neutral. Banishment save -2 against true neutral is cast-resolution prose. |
| `pf1/3k8vsklt37p5i0ug` Anthropomorphic Animal | Separate form effect must set Intelligence to 3, preserve other ability scores/size/type, suppress natural attacks except existing bite and non-land movement, and grant no manufactured weapon proficiency. Permanency cost/time remain prose. |
| `pf1/3l41qcrvsmo9f2zc` Pouncing Fury | Claw-only full attack on charge and additional claw attack of opportunity require an explicit attack effect; charge bonuses apply only to first claw. Opportunity uses remain prose. |
| `pf1/3lgy3s4h4087ojht` Dispel Chaos | Inherited Dispel Evil effect requires separate +4 deflection AC against chaotic creatures only; banishment/dispel/discharge stay prose. |
| `pf1/3mfmhx8avu7h3iom` Spider Climb | Separate running effect needs +8 racial Climb and climb speed 20 feet; retain Dexterity AC while climbing. Climb-check exemption and no run are prose. |
| `pf1/3mvzelxgq38a2nw1` Oracle's Burden | Transferred hindrances depend on the caster's actual oracle curse; no generic curse Modifier can be invented. A curse-specific separate effect remains outstanding. |
| `pf1/3nxf2nap088jjzbi` Stone Shield | Separate opponent-scoped cover effect requires +4 AC and +2 Reflex; hardness 8, 15 HP, blocked attacks and destruction remain combat prose. |
| `pf1/3qpvx0evlgk4bfda` Sun Metal | Separate targeted weapon effect requires +1d4 fire on hit, not multiplied on criticals, with nonstacking fire and incompatible cold effects. No recorded-Spell Modifier applies. |
| `pf1/3qs0ogoxr5jwkz0m` Mighty Fist of the Earth | Ranged spell resolution uses the character's unarmed strike attack/damage rather than a generic spell attack; separate attack-rule input remains outstanding. Ki uses are play-time prose. |
| `pf1/3quizxugd8o4c4yb` Rune of Rule | Separate chosen-rune effects must preserve Charity +5 insight attack/skill check, Generosity item caster level +2, Kindness aid bonus +5/healing caster level +2, Love charm DC +1 and Zeal Will +3/language-dependent DC +1; one-use triggers, rerolls and no-self restrictions remain prose. |
| `pf1/3t0fqhbt4qsy7wfx` Reaper's Coterie | Targeted weapon separate effect requires player-recorded profane damage bonus that increases +1 per qualifying defeat up to half caster level; no automatic kill counter is promised. |
| `pf1/3wcvosazm31i8758` Contagious Zeal | Separate running effect requires +2 morale attacks and weapon-only damage, +4 morale fear saves and Intimidate DC, with 1d6 temporary HP kept separate from maximum HP; target spread/duration remain prose. |
| `pf1/3wdb34u6m64ctji7` Lay of the Land | Separate area-scoped effect requires insight min(casterLevel,5) Knowledge(geography) and Survival only to avoid becoming lost; trained-use permission remains prose. |
| `pf1/3wyqlqtiyx5c1fcf` Weaponwand | Separate attack effect must substitute the weapon's highest attack bonus for wand attack rolls without adding weapon damage; item containment/breakage remain prose. |
| `pf1/41d87ar2vzt2rnhv` Passing Fancy | Separate observer-side Sense Motive -10 only to notice the target's behavior requires scoped effect; fascination/conversation remain prose. |
| `pf1/429wzxjzm1chnsq7` Instrument of Agony | Separate targeted-weapon effect requires +2 morale Intimidate only while wielding it; discharge, nausea and sickness remain prose. |
| `pf1/4322oipgd4hjkuj4` Enlarge Tail | Separate tail/tail-weapon-scoped effect requires attack +1, damage +2 and reach +5 feet; it must not benefit unrelated attacks. |
| `pf1/446vcsetq4ny904e` Mislead | Inherited Greater Invisibility attack/Stealth effects require separate running effect; image movement/concentration are prose. |
| `pf1/465ck6fc6e40l1kn` Mental Barrier IV | Inherited Mental Barrier III/I requires separate +8 shield AC; 25% nonstacking fortification, mind thrust immunities and half/quarter damage are combat prose. |
| `pf1/476th5lyxxemseyx` Ablative Barrier | Separate effect requires +2 armor AC; lethal-to-nonlethal conversion 5 per attack, DR5/- against nonlethal and capacity min(5*CL,50) are play-time procedures. |
| `pf1/48qaybvgr2faagte` Phantom Limb | Separate chosen form requires Extra Legs speed +30 feet enhancement and CMD +4 against overrun/trip; Extra Arms gives two claws, Tail swim60 feet or Wings fly60 feet(good). Replacement limbs need actual target anatomy. |
| `pf1/499phaxpgce53z6q` Ride The Waves | Separate effect requires swim30 feet and Swim +8; water breathing, take10/run conditions remain prose. |
| `pf1/49p4v9az7rfzj5fw` Spellcasting Contract | Inherited Lesser Spellcasting Contract's principal rule gives the caster profane AC/saves/checks equal to highest imbued spell level; example instead says attacks/saves/checks. Resolve source conflict before any attack Modifier. Separate caster effect remains outstanding; transferred Spells/contract obligations are prose. |
| `pf1/4amchj89pppg180r` Fleshwarping Swarm | Failed swarm distraction requires separate Dexterity -4 and saves -4 only against transmutation effects for1hour/CL; no unconditional recorded-Spell penalty. |
| `pf1/4b2gw3xfut5ssood` Invoke Primal Power | Separate chosen wild-shape effect requires Constitution +4 size and natural armor +2 above existing form; Giant Slayer +2 insight attack/natural damage vs giants, selected speed +20feet and selected natural attack/charge/rend/trample/trip features remain outstanding. |
| `pf1/4c2m0fmf3tq01rpu` Transfer Familiar | Temporary familiar-benefit source transfer requires explicit relationship/effect modeling without moving or duplicating Character identity; owner/movement contract is unchanged. |
| `pf1/4dczr3vd96vbcirc` Hunter's Howl | Separate designated-foe effect requires +2 weapon attacks/damage and Bluff/Knowledge/Perception/Sense Motive/Survival against affected non-favored foes; existing favored enemy targets instead become shaken. |
| `pf1/4eu1kdpfr6lxtvt8` Winter Feathers | Optional white-feather separate effect requires +4 circumstance Stealth only in ice and snow; environmental cold protection grants no resistance to cold damage. |
| `pf1/4gvcypqu5drxqkmd` Titanic Anchoring | Separate effect needs CMD +10 only against bull rush/grapple/overrun/reposition/trip from larger creatures; same/smaller creature immunity and pull/push immunity remain prose. |
| `pf1/4jnqnfe3mfqhjwps` Authenticating Gaze | Separate effect needs insight min(casterLevel,10) Appraise only for books/scrolls and Linguistics only for detecting forgeries; glance/aura detection remain prose. |
| `pf1/4k32l03rzxgyifkx` Crafter's Fortune | Separate effect requires +5 luck to next Craft check only, rather than permanent skill bonus; discharge tracking remains prose. |
| `pf1/4k9bh8ny1il2oner` Spell Resistance | Separate running effect requires spell resistance 12 + casterLevel; recording the Spell must leave ordinary/permanent SR unchanged. |
| `pf1/4me7ddc17nowrs6f` Sessile Spirit | Separate affected-medium/spiritualist effect must suppress only actual spirit/phantom benefits including bonus feats/known Spells; possession dazing remains combat prose. No generic suppression is inferred. |
| `pf1/4mvqcqfaqv54drf3` Shared Wrath | Inherited Wrath separate designated-foe effect requires morale max(1,min(3,floor(casterLevel/3))) attacks, weapon damage and caster-level checks to overcome that foe's SR; CL12 Improved Critical is nonstacking and requires attack-rule input. |

## Source discrepancies and review boundaries

The inventory records **14 discrepancy/metadata observations across 12 candidates**, including two PCGen representation/text differences. Metadata observations are preserved without guessing a corrected value or treating missing runtime scaffolding as a new rule.

| Spell | Observation |
| --- | --- |
| Lash of the Astradaemon | Action duration is instantaneous but prose permits claws up to24hours or until all attacks are delivered. |
| Telekinesis | Action name 'Violet Thrust' differs from prose 'Violent Thrust'; preserved, no source correction invented. |
| Shamefully Overdressed | Action target says creature touched while action range says close; preserve contradictory source metadata. |
| Reincarnate | Foundry says "A spellcreature that doesn't prepare spells"; PCGen says "A spellcasting creature that doesn't prepare spells". This is a real source wording typo; do not claim exact full-description equivalence. |
| Reincarnate | Foundry locates the reincarnation table "on the next page" while PCGen locates it "below"; placement representation only. All reincarnation probability ranges and Str/Dex/Con rows compare equal. |
| False Life | Action type heal does not make its temporary HP ordinary healing or maximum HP. |
| Word of Chaos | Action save says none or Will negates while prose distinguishes partial reductions for cumulative effects. |
| Word of Chaos | Foundry prose ends "depending on their" immediately before the table, whereas PCGen ends "depending on their HD." Foundry table still has its own HD heading; all HD thresholds, effects, durations, damage and saves compare equal. The missing standalone prose HD token prevents exact normalized full-description equivalence. |
| Mental Barrier IV | The structured action contains no inherited shield AC; linked III/I prose establishes +8, not the original +4 from I. |
| Spellcasting Contract | Linked Lesser Spellcasting Contract principal rule names profane AC/saves/checks but its example names attacks/saves/checks; no attack Modifier is inferred. |
| Magic Missile | Structured ranged attack and attackBonus100 are Foundry execution scaffolding, not a Pathfinder attack roll; prose says missiles strike unerringly. |
| Contingency | Structured action activation standard conflicts with prose minimum10minute casting; preserve without silently rewriting. |
| Walk the Plank | Prose references Create Pit but action effect is20ftby20ft with depth10ft/4levels; preserve this version-specific override. |
| Sessile Spirit | Structured save harmless:true contradicts suppressive hostile description; retain exact metadata. |

## Public-boundary demonstration

There is no newly admitted Spell to demonstrate: all 99 remain legally held. The [catalog tests](../../tests/catalog/spells-519.test.ts), [isolated saved-sheet integration](../../convex/catalogSpells519.integration.test.ts) and [fixture preview](../../tests/fixtures/spells-519/preview.json) establish technical behavior only. Fixture-only accepted assessments are assembled in memory; a Magic Missile demonstration can be admitted there while Crafter's Fortune still encounters the APG complete-chain hold. Character-owned preview definitions establish neither shipping attribution nor release readiness.

The public resolver pins Magic Missile's 1d4+1 damage and five-missile maximum at caster level 9, Spider Climb's 20-foot climb speed and +8 racial Climb bonus, False Life's 1d10 plus caster level capped at +10 temporary HP, and Spell Resistance's 12 + caster level. Recording these Spells creates no running effects and leaves current/permanent statistics unchanged. Additional source-backed assertions preserve Mental Barrier IV's inherited +8 shield AC, Shared Wrath's bounded morale bonus and Improved Critical threshold, and exact shared Situation scopes.

The isolated Wizard test browses, records, reads and removes Magic Missile and Spider Climb through public collection commands; it preserves their stable rule identities, explicit levels, schools and sources. Another campaign member can edit and observe the same saved sheet. Outsiders cannot read, browse, record or remove, and refusals leave recorded state intact. Client preview and server projections agree. Editing Magic Missile's source damage invalidates its exact checked description binding rather than silently reusing review.

## Commands and observed gates

The source checkouts are verified at both exact commits/manifests, without an unverified override. Task-local scratch holds the exact candidate selector and generated reports; it is removed after recording results. To reproduce, create the ignored selector from `candidates[].externalKey` in the single batch inventory, retaining its exact order. Reduced fixtures are technical test inputs and grant no shipping permission.

```sh
export PF1_CURATION_SYSTEM=/home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1
export PF1_CURATION_CONTENT=/home/andreas/repos/everythingpath/sources/pf1-content
mkdir -p .scratch/519/tmproot
export TMPDIR="$PWD/.scratch/519/tmproot"
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/519/keys.json --out .scratch/519/draft
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/519/keys.json --descriptions --out .scratch/519/prose
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/519/keys.json --descriptions --out .scratch/519/final-draft
pnpm -s catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/519/keys.json --out .scratch/519/bounded-preview
pnpm -s catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/519/full-preview
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/519/full-draft
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm test tests/catalog/spells-519.test.ts convex/catalogSpells519.integration.test.ts
pnpm test tests/catalog convex/catalogSpells519.integration.test.ts --maxWorkers=1
pnpm -s catalog:format --check
git diff --check
```

Initial drafting finds zero required inputs and no missing required records. The separate prose pass adds 49 draft descriptions. Final bounded drafting adds/replaces nothing: 99 checked descriptions, 37 independently unresolved optional descriptions and zero missing/stale/unresolved required mechanics. Bounded inventory coverage is complete: 100 accounted records, 99 Spells, one excluded folder and no unassigned inputs.

The bounded admission/reference gate exits 1: **0 admitted, 80 held and 19 reference failures**. Eighteen failing roots resolve their links in the complete import. **Greater Hex Glyph (`pf1/4fm4md4eux7sw6o0`) remains a full-import technical failure**: its literal `Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.VRD7jxiIAxKPt6EF` rules-page reference is unresolved. This is a separately recorded importer/reference limitation; its legal disposition remains specifically held, and neither the link nor its hold is removed to make a gate pass.

The complete gate exits 1 with **23,037 entries, 538 resources, 53 admitted candidates, 23,129 held, two dependent omissions, zero retained exceptions and 4,734 failures**. The batch accounts for **98 gate holds and one technical failure**, while the editorial inventory accounts for 99 legal holds and the excluded folder. The failure families are 3,628 missing curation records, 715 unaccounted inventory records and 391 broken-reference failures; all but the Greater Hex Glyph failure are outside this ticket. No admitted notice or supporting resource requirement is outstanding. Whole-corpus coverage and release readiness are not claimed.

Complete required curation is 100 checked of 3,728 required inputs, with 3,628 missing outside the batch. The full optional description inventory contains 10,290 candidates and 622 checked descriptions. Whole-content unresolved assessments remain held even where full extraction expands linked dependencies; the recorded bindings prove the reviewed bounded extraction, while full linked attribution remains explicitly unbounded.

Full extraction fingerprint: `4c8dfab6f31edc289635383e73f03cb89352494b086bd756171c2a5ec7a4e4bd`. Reviewed-input fingerprint: `6d6184e18cd99278a2b7582cf3d122b8a7e8a79f539425648072c9702e6777a0`. Legal-resource fingerprint: `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e`. Full admission-report SHA-256: `8ccffe60b45ebf265f746942c647a673859d71b753e8b819f9554d99370e7945`. Bounded report SHA-256: `2dc70d22f91c49d6fd31d166d6a38a70d80ea1220a6a9331f1d1d9e9a620cb00`. These identify local verification without publication.

The full-corpus drafter exits 0, producing **4,350 records, 3,628 new drafts, zero replacements, zero missing/stale bindings and 763 unresolved required mechanics**. Its required summary is 3,728 inputs: 100 checked and 3,628 drafted. Optional descriptions total 622 checked with 229 unresolved across the corpus. Generated unreviewed drafts remain in scratch and are not copied to the shipping overlay.

| Check | Final observed result |
| --- | --- |
| Pinned source verification | Both exact commits/manifests verified; no override |
| Initial bounded draft | Exit 0: no required inputs/gaps or new required records |
| Separate description draft | Exit 0: 49 new optional descriptions |
| Final bounded draft | Exit 0, 9.14 seconds: zero added/replaced/missing/stale; 99 checked descriptions, 37 unresolved optional descriptions |
| Bounded import/required curation | Pass: 100 accounted, one folder excluded, no missing required records |
| Bounded admission/reference gate | Exit 1, 9.58 seconds: 0 admitted, 80 held, 19 reference failures |
| Complete import/admission gate | Exit 1, 182.96 seconds: 53 admitted, 23,129 held, two outside-batch dependent omissions, 4,734 failures; batch 98 held and one journal-reference failure |
| Full-corpus drafter | Exit 0, 243.62 seconds: 4,350 records, 3,628 new drafts, 763 unresolved required mechanics outside batch |
| `pnpm -s typecheck` | Pass, 132.88 seconds |
| Initial `pnpm -s lint` | Exit 1, 157.56 seconds: one optional-chain test style finding, corrected |
| Final `pnpm -s lint` | Pass, 279.21 seconds |
| `pnpm -s check:initial-migration-writers` | Pass: 183 registrations |
| `pnpm catalog:pin` | Pass: `sha256:71c66667344e200747085cc47660277a9e7677da10cdd3d58033591444baa25b` |
| Final focused catalog/saved-sheet tests | Pass: two files, eight tests, 8.72 seconds under concurrent drafting load |
| Combined catalog/batch suite | Pass: 38 files, 583 tests, 85.51 seconds Vitest time; one worker |
| `pnpm -s catalog:format --check` | Pass: canonical shared files |
| Prior-object preservation and report links | Pass: prior shared objects/Situations preserved; all local report links resolve |
| `git diff --check` | Pass |

The full `pnpm test` was not run: the orchestrator owns the post-rebase full-suite landing gate.

## Timing and workflow observations

Approximate overlapping phase windows on 2026-10-07 UTC (local review date 2026-10-08):

| Phase | Window | Elapsed |
| --- | --- | --- |
| Brief, contracts, precedent and exact selector | About 22:42–22:44 | About 2 minutes |
| Complete source/mechanics review and overlay | 22:44–22:50 | About 6 minutes |
| PCGen/attribution review and bindings | 22:45–22:50 | About 5 minutes |
| Fixtures, public tests and journal-reference follow-up | 22:47–22:56 | About 9 minutes |
| Gates, checks, report and cleanup | 22:50–23:10 | About 20 minutes |

Total elapsed time was about 28 minutes. These windows overlap and are not additive labor estimates. Heavy checks ran sequentially; the final lint rerun took 279 seconds, compared with 158 seconds for the initial pass.

The main session independently read ten complete raw Spell descriptions/actions: Transmute Metal to Wood, Dispel Balance, Dispel Chaos, Stone Shield, False Life, Mental Barrier IV, Spellcasting Contract, Spell Resistance, Shared Wrath and Ablative Barrier. The separate reviewer checked 13 source/overlay samples, all 100 source/action/list bindings, all 99 assessment/evidence/notice bindings and all 18 PCGen comparison row hashes. The main session also verified the Greater Hex Glyph journal target and failure evidence. No unsourced numeric additions or unresolved reviewer blockers remain.

The repository's Opus/Fable model aliases are unavailable through the supplied collaboration tools. Implementation changes are delegated with the inherited model, following the owner's Sol curation decision; a separate source reviewer checks comparisons and samples the finished records. The orchestrator's sampled Fable landing review remains separate. GitHub still marks #416, #257 and #303 open; their implementations and consuming contracts are present in this checkout and previous batch evidence. No issue state is changed.

The batch changes the four shared overlay/assessment/evidence/hold files, adds the single legal inventory, this report, two test files and source/preview/helper fixtures under `tests/fixtures/spells-519/`. The Section 15 Registry is preserved. There are no product or importer changes.

One focused-test fixture initially changed the first `1d4+1` occurrence, in action damage rather than the description. Replacing both occurrences exercised the intended exact description invalidation. The final focused catalog and saved-sheet run passes eight tests. The initial whole-repository lint found one optional-chain style issue in the new test; its behavior-preserving correction passes final lint. The final source gate exposed Greater Hex Glyph's journal reference, now named and pinned by an additional test. No tool fix was made; importer gaps remain with their owning implementation work, including #719/#720.

All changes remain uncommitted. No GitHub issue/PR was changed, nothing was deployed, and no answer file is created in the repository: the launcher captures the final response at its `-o` path.

Task-local scratch, candidate selectors, generated reports and test work directories were removed after their durable results were recorded.
