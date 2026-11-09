# Spell curation review: #521

Reviewed **2026-10-08** by **Sol (AI curator) for the owner**, following [#521](https://github.com/AndreasUnunger/EverythingPath/issues/521), [PRD #251 Decisions 10 and 17 and the acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461), [Spellcasting](../character-sheet/spellcasting.md), [curation](curation.md) and the [#328](races-328.md) and [#520](spells-520.md) precedents.

Exactly **100 ticket keys** receive one contract disposition: **0 admitted, 100 specifically held, 0 dependently omitted, 0 wholly unsupported/prose-only and 0 excluded**. **Blacklight** carries an explicit record-level `3.5` tag. It is held for that tag under the owner's policy (2026-10-08) that record-level `3.5` tags are held, never excluded; [the importer contract](README.md) excludes only whole 3.5 packs. Technical extraction retains all 100 Spells. The public admission result is **0 admitted, 98 held and 2 structure/reference failures**, with no dependent omission or retained exception. Those two failures are independent blockers on held candidates, not extra dispositions. No Catalog Release was published or activated.

## Evidence and scope

- Read-only Foundry PF1 v11.11: `418761d2e16a6037c0156bb4a241f7cea5a2986d`.
- Read-only pf1-content 11.4.0: `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`.
- [Inventory, attribution and mechanics evidence](../../scripts/catalog/legal/spells-521.json) records every ordered key, raw source path and SHA256, source citations, complete action metadata, whole-content gaps, linked and named rule context, notice identities, current bindings and separate outstanding calculations.
- [Fixture provenance](../../tests/fixtures/spells-521/provenance.json) records **100 byte-identical ticket roots**, **28 unreviewed class-context files** and **1 inert linked-table snapshot**: 128 parser source files plus 1 supporting snapshot. Ordered-key SHA256: `250644a05b180e38d1fff643a2a659a1788dda3c833fa9f8815895d020a3306a`. The reused parsed Oracle context has its own artifact hash, raw-source hash and pin.
- [Reviewed overlay](../../scripts/catalog/reviewed-curation.json), [assessments](../../src/lib/catalog/data/attribution-assessments.json), [content-bound evidence](../../src/lib/catalog/data/attribution-evidence.json) and [enforced notice holds](../../scripts/catalog/legal/held-notices.json). Existing identities, remaps, other batches' records and shared Situations are preserved; no Registry entry or alias is added. Independent comparison confirms all 1,124 non-batch overlay records, 1,338 assessments and 1,317 evidence rows are unchanged.

Permitted PCGen comparison uses fixed commit `25523dbcf10e86c280fc0f447167ea43d67419d3`: [CRB Spell descriptions](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_spells.lst) and [campaign metadata](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/core_rulebook.pcc). Fresh retrieval matches the earlier recorded file hashes. **25 direct CRB descriptions** have literal full-description comparator lines; **19 match** after presentation, whitespace, case and punctuation normalization. Ghoul Touch, Giant Form I, Detect Animals or Plants, Feeblemind, Contact Other Plane and Righteous Might differ. Literal lines, locations, hashes and the conservative equality result are retained per entry. Direct prose equality establishes no complete class/granted-list, action/material, inherited-origin or notice-chain coverage. PCGen's Paizo Inc. wording is not declared equivalent to the existing Paizo Publishing, LLC Registry line. No book PDFs were available; Archives of Nethys was not used. Source runtime was never imported or executed.

## Attribution and inherited notices

The batch records **45 observed minimum notice identities**: 44 publication codes, including Blacklight's publication, and the existing immutable Bestiary 5 notice. CRB's reviewed identity is reused. **44 notice/notice-chain holds** are enforced: 43 new batch registrations and the reused #264 Bestiary 5 complete-chain hold. Each extracted root has an unresolved, content-bound assessment; Blacklight also has the specific tag hold `spells-521-record-3.5-tag-6s2Mrf0bRBHKArPe`. Existing compilation/title/code leads are evidence leads, never accepted whole-content or chain coverage.

The inherited-rule pass records **99 source-bound reasons across 72 candidates**. These include concrete conditions, skills, equipment procedures, class features, named Spells, templates and creature abilities. Important cases are:

- **Umbral Infusion, Mass** needs **PZO1112** for the inherited advanced simple template: +2 rolls/damage/DCs, +4 AC/CMD and +2 HP per Hit Die. The #520 base Spell is pinned as context.
- **Contact Entity II** needs Bestiary 2/4 and the existing immutable Bestiary 5 notice; the latter reuses the #264 chain hold without inventing a PZO1133 alias. Its Yangethe component also refers to a scroll of an emotion (Ultimate Magic) Spell of 4th level or higher. **Contact Entity IV** needs Bestiary 1/4. Replaced earlier creature lists do not add their discarded creature notices; inherited contact and Scrying procedures still count.
- **Judgment Undone** needs Bestiary 2 for the petitioner template and Bestiary 6 for the explicit olethros marker. **Blood Scent**, **Thoughtsense**, **Scorching Ash Form**, **Shadow Body** and the form Spells need the named Bestiary abilities/templates, in addition to applicable CRB rules.
- **Searching Shadows** and **Etheric Shards** need **PZO1115** for steal/drag maneuvers. **Shadow Bomb Admixture** and **Bite the Hand, Mass** need PZO1115 for bombs/eidolon rules. **Divine Arrow** and **Aram Zey's Focus** need CRB Lay on Hands/Trapfinding.
- **Rend Body IV** needs the known Occult Adventures notice for undercasting, as well as inherited CRB bleed, Heal and sickened rules. **Speak with Plane** explicitly cites Planar Adventures' sentient structure rules.

The full linked Arcane Malignancies table is pinned as inert context outside the parser input. All 37 result rows are inspected; 31 include supported Character statistic or condition effects, which remain independently outstanding. The witch-list allergy at result 66–67 also requires the APG notice. Random choice and unmodeled combat procedures stay prose; lack of a table publication source never replaces this mechanical gap.

Every required identity has a source-bound reason or literal source/reference lead in the inventory. The linked Arcane Malignancies table is unsourced; its complete origin is specifically unbounded rather than assigned a guessed publication. CRB and APG notices cover concrete inherited rule dependencies only. Named/literal dependencies are context, not additional reviewed or admitted candidates.

## Every-key disposition

Each root has its own `spells-521-whole-content-<ID>` technical hold and individually bound missing evidence. Per-key minimum notices and notice-chain hold IDs are recorded in the inventory.

| Exact key | Candidate | Upstream root citation | Contract disposition |
| --- | --- | --- | --- |
| `pf1/5u1vgdhnbsxtc1fq` | Stage Fright | PZO9465, p. 27 | Specifically held |
| `pf1/5u2k3n531n9sx8ng` | Revelation | PZO9211, p. 17 | Specifically held |
| `pf1/5u43heihlrtuc58y` | Ghoul Touch | PZO1110, p. 289 | Specifically held |
| `pf1/5ues51xy0x9yyapy` | Fleshworm Infestation | PZO1117, p. 220 | Specifically held |
| `pf1/5v3j49r4mdq9rbx6` | Paragon Surge | PZO1121, p. 48 | Specifically held |
| `pf1/5w1zrztwbvd6xkgj` | Repulsion | PZO1110, p. 333 | Specifically held |
| `pf1/5w68w4yw2oivz7b3` | Shadowfade | PZO9479, p. 9 | Specifically held |
| `pf1/5wmn4airvkprv3gp` | Thoughtsense | PZO1132, p. 190 | Specifically held |
| `pf1/5xkgeujatfrn189m` | Witness | PZO1117, p. 249 | Specifically held |
| `pf1/5z26gs6wrom5svdd` | Magic Circle against Law | PZO1110, p. 308 | Specifically held |
| `pf1/5zmcvsol2r5p7ggs` | Spotlight | PZO9466, p. 29 | Specifically held |
| `pf1/5zrqn8bj3jxm05pl` | Wrath | PZO1115, p. 257 | Specifically held |
| `pf1/60cty4b54fifrwnu` | Disguise Weapon | PZO1129, p. 180 | Specifically held |
| `pf1/61pYmOmQJ2nMk2vL` | Fair is Foul | PZO9485, p. 21 | Specifically held |
| `pf1/61uvtd18e9s6zku3` | Giant Form I | PZO1110, p. 289 | Specifically held |
| `pf1/61z6vqxabug4u241` | Sylvan Hideaway | PZO90116, p. 67 | Specifically held |
| `pf1/62eepdqfnmyrawcn` | Deadly Finale | PZO1115, p. 214 | Specifically held |
| `pf1/62oq0e87kd4i36a7` | Enemy Hammer | PZO1115, p. 219 | Specifically held |
| `pf1/6346rs0f4sra9gt4` | Cure Critical Wounds, Mass | PZO1110, p. 262 | Specifically held |
| `pf1/63bmtmuvy392gkv8` | Complex Hallucination | PZO1134, p. 206 | Specifically held |
| `pf1/63mpcavffnot6ilm` | Unsettling Presence | PZO9471, p. 29 | Specifically held |
| `pf1/647bhflomshdufmf` | Inflict Critical Wounds | PZO1110, p. 300 | Specifically held |
| `pf1/648x72rflah0ggyz` | Touch of Idiocy | PZO1110, p. 360 | Specifically held |
| `pf1/64awq5y3dtlhq9rr` | Sure Casting | PZO9435, p. 13 | Specifically held |
| `pf1/65i0wc0e6fq0evk5` | Detect Animals or Plants | PZO1110, p. 266 | Specifically held |
| `pf1/65okoqbsj9yt9nx3` | Transplant Visage | PZO9267, p. 244 | Specifically held |
| `pf1/66pt5ntiacbzsuov` | Aggressive Thundercloud | PZO1129, p. 172 | Specifically held |
| `pf1/66s5qm8kwycgobce` | Dominate Monster | PZO1110, p. 274 | Specifically held |
| `pf1/66vvhyiy5q8yzbq2` | Feeblemind | PZO1110, p. 281 | Specifically held |
| `pf1/67amo3ximte5ojxl` | Allegro | PZO1117, p. 205 | Specifically held |
| `pf1/67hykfkm8zbj53rn` | Mudball | PZO1121, p. 119 | Specifically held |
| `pf1/68acsi5rli5t9mef` | Unconscious Agenda | PZO1002, p. 419; PZO9005, p. 61 | Specifically held |
| `pf1/68aup6droas2uyzj` | Symbol of Striking | PZO1118, p. 245 | Specifically held |
| `pf1/68m9du7zw2di7ew6` | Feather Fall | PZO1110, p. 281 | Specifically held |
| `pf1/68ngvzmzvadhf6vs` | Contact Other Plane | PZO1110, p. 259 | Specifically held |
| `pf1/68quvqg93a3da02z` | Prying Eyes | PZO1110, p. 326 | Specifically held |
| `pf1/68yoc59d7jtfepw6` | Respectful Quiet | PZO9280, p. 222 | Specifically held |
| `pf1/69ct5zzucwn62npo` | Scorching Ash Form | PZO1121, p. 131 | Specifically held |
| `pf1/69j5vk8wqvthshcv` | Psychic Image | PZO1132, p. 183 | Specifically held |
| `pf1/6HcivI0xHoW21cws` | Absorbing Barrier | PZO9486, p. 28 | Specifically held |
| `pf1/6ax0ythzw8n4bta8` | Righteous Might | PZO1110, p. 335 | Specifically held |
| `pf1/6cEWqLm3QYhtWNxK` | Rope Tornado | PZO9494, p. 27 | Specifically held |
| `pf1/6ci2v3ucadea8x9x` | True Skill | PZO9292, p. 63 | Specifically held |
| `pf1/6cjfszctojrskwm0` | Bloodstone Mirror | PZO90140, p. 72 | Specifically held |
| `pf1/6d4s6bh9ndvwnlvn` | Spellcrash, Lesser | PZO1129, p. 194 | Specifically held |
| `pf1/6d6bgiakwmwiu7qv` | Celestial Healing | PZO9465, p. 13 | Specifically held |
| `pf1/6efjgs1qvmj6yxqv` | Phantasmal Killer | PZO1110, p. 319 | Specifically held |
| `pf1/6eh8zc5ohjqt2n8y` | Utter Contempt | PZO1117, p. 246 | Specifically held |
| `pf1/6fbwb3gq0g36n7r9` | Blood Scent | PZO1121, p. 143 | Specifically held |
| `pf1/6fgsmc5sln2a5bme` | Searching Shadows | PZO9292, p. 62 | Specifically held |
| `pf1/6g6pm57u91u2r9w8` | Limp Lash | PZO9419, p. 28 | Specifically held |
| `pf1/6g7x08y9nl7vlffv` | Contact Entity II | PZO1135, p. 113 | Specifically held |
| `pf1/6gbb0vdil1e8mhou` | Pernicious Poison | PZO1117, p. 231 | Specifically held |
| `pf1/6ghblcoddfa4y9yt` | Archon's Aura | PZO1117, p. 206 | Specifically held |
| `pf1/6h3p3zr2hbrjea8k` | Molten Orb | PZO1129, p. 188 | Specifically held |
| `pf1/6h8e7ziowe5es681` | Healing Thief | PZO1118, p. 231 | Specifically held |
| `pf1/6he32yv5sa89ox5y` | Etheric Shards | PZO1132, p. 171 | Specifically held |
| `pf1/6he78hfz1j4c8ba3` | See Alignment | PZO1118, p. 243 | Specifically held |
| `pf1/6ho3wsspkqkhypt0` | Tree Shape | PZO1110, p. 362 | Specifically held |
| `pf1/6hza06xvxah95k5u` | Ascension | PZO1126, p. 113 | Specifically held |
| `pf1/6i62nomptzdtltc6` | Undeath Ward | PZO9234, p. 63 | Specifically held |
| `pf1/6ihxyoha1bkh1hw6` | Bite the Hand, Mass | PZO9235, p. 57 | Specifically held |
| `pf1/6isran0p5phoru7x` | Entice Fey, Greater | PZO1134, p. 213 | Specifically held |
| `pf1/6iuctz5dbr3xjl5w` | Alter Summoned Monster | PZO9458, p. 22 | Specifically held |
| `pf1/6jc9e9qooa4c89vr` | Monstrous Physique IV | PZO1117, p. 229 | Specifically held |
| `pf1/6jz03m4lryndt0kd` | Phantasmal Revenge | PZO1115, p. 235 | Specifically held |
| `pf1/6k2vdevlvg4cu7gd` | Opportunistic Loyalty | PZO90115, p. 75 | Specifically held |
| `pf1/6klw6f8yrhu9z9mn` | Secret Page | PZO1110, p. 338 | Specifically held |
| `pf1/6kmkxepwgsbta6ui` | Clairaudience/Clairvoyance | PZO1110, p. 255 | Specifically held |
| `pf1/6kn3xjxysd4b3t6a` | Contact Entity IV | PZO1135, p. 114 | Specifically held |
| `pf1/6kzn5xnks6n3z3o3` | Rend Body IV | PZO9477, p. 10 | Specifically held |
| `pf1/6l4stx2qxjq9pns7` | Summon Ancestral Guardian | PZO9408, p. 24 | Specifically held |
| `pf1/6l904edkt8jv9jor` | Neutralize Poison | PZO1110, p. 316 | Specifically held |
| `pf1/6lebv7569xsypp8u` | Rainbow Pattern | PZO1110, p. 329 | Specifically held |
| `pf1/6llfs4xoisus5sph` | Kreighton's Perusal | PZO9435, p. 10 | Specifically held |
| `pf1/6lxhv5l29a98c41k` | Unravel Destiny | PZO1115, p. 325 | Specifically held |
| `pf1/6mnzidgvtc2zsqkh` | Judgment Undone | PZO1141, p. 43 | Specifically held |
| `pf1/6nbjbxfiykdr0mta` | Fleeting Defect | PZO9462, p. 31 | Specifically held |
| `pf1/6ne7ot8lcaiva3f9` | Magic Circle against Chaos | PZO1110, p. 308 | Specifically held |
| `pf1/6oq1wcryviik9ice` | Fireball | PZO1110, p. 283 | Specifically held |
| `pf1/6orhthk4g27rncuu` | Calm Emotions | PZO1110, p. 252 | Specifically held |
| `pf1/6p5j2x5gjjsntyd6` | Shadow Body | PZO1132, p. 186 | Specifically held |
| `pf1/6qev1jyrevir14ku` | Thought Echo | PZO1132, p. 189 | Specifically held |
| `pf1/6qpg42rj70oi4css` | Form of the Dragon III | PZO1110, p. 286 | Specifically held |
| `pf1/6qz8muutqwyfp1mq` | Elemental Mastery | PZO9280, p. 219 | Specifically held |
| `pf1/6rikrbt4xgkkp8th` | Umbral Infusion, Mass | PZO9466, p. 31 | Specifically held |
| `pf1/6rndjc976yelg14e` | Speak with Plane | PZO9492, p. 12 | Specifically held |
| `pf1/6rs8aoks1cqkr6o5` | Claim Identity | PZO9469, p. 28 | Specifically held |
| `pf1/6s2Mrf0bRBHKArPe` | Blacklight | PZO1111, p. 206 | Specifically held: record-level 3.5 tag (owner policy, 2026-10-08) |
| `pf1/6sc2szgfkr6xb71l` | Protection from Evil, Communal | PZO1118, p. 240 | Specifically held |
| `pf1/6sqs935o85re0a90` | Divine Arrow | PZO1118, p. 228 | Specifically held |
| `pf1/6u2h8k11z8sadrxb` | Longshot | PZO1118, p. 236 | Specifically held |
| `pf1/6ux76jy9wbi88br0` | Moment of Greatness | PZO1118, p. 237 | Specifically held |
| `pf1/6v4vgwluxim6dbls` | Aram Zey's Focus | PZO9235, p. 56 | Specifically held |
| `pf1/6vfauefzzmwl4az7` | Chain Lightning | PZO1110, p. 253 | Specifically held |
| `pf1/6vx3lvbhp6h220wq` | Thorn Javelin | PZO1129, p. 196 | Specifically held |
| `pf1/6wz8eno1m5iopn2z` | Nature's Paths | PZO1136, p. 164; PZO9456, p. 31 | Specifically held |
| `pf1/6wzaedayivnt6jrq` | Shadow Bomb Admixture | PZO1118, p. 243 | Specifically held |
| `pf1/6x6epf4g5wgzl1gh` | Tree Stride | PZO1110, p. 362 | Specifically held |
| `pf1/6xqpa5cmpj9pt8ln` | Reincarnate Spy | PZO1134, p. 223 | Specifically held |

## Mechanics and independent gaps

All **100 complete descriptions and every action** were inspected. The exact drafter starts with **0 required note/conditional/Item Ability inputs** and **43 optional prose candidates**. The overlay deliberately completes all 100 description bindings, including descriptions outside the drafter predicate: **109 readable Notes**, **0 recorded-Spell Modifiers** and no permanent proficiency Grant from recording a Spell. Running effects belong to separate Spell Effects. Class-list levels, sources, schools and literal supported metadata pass through the public importer/resolver; deterministic facts are not silently assigned to the Character merely for recording a Spell.

Shared Situations are reused as strings: **spellResistance** for Wrath/Sure Casting, **disarm** and **steal** for Searching Shadows, **mindAffecting** for Bloodstone Mirror, **lawfulCreatures** for Magic Circle against Law and **poison** for Monstrous Physique IV, Pernicious Poison and Neutralize Poison. No new shared Situation is introduced. Narrowing conditions remain in the Note's text.

**51 candidates / 51 independently outstanding mechanics** remain visible as checked unresolved description diagnostics. They are not attribution holds:

| Spell | Outstanding mechanics |
| --- | --- |
| Fair is Foul | Selected Arcane Malignancies result needs a separate running Effect: supported skill, attack, AC, CMD, save, concentration, ability and armor-check penalties/conditions are uncurated. The linked table is reviewed by exact result range and text hash; for example 1–2 gives -2 Acrobatics, Climb and Perform (dance), 5–7 gives -2 Craft, Disable Device and Sleight of Hand, and 46–48 gives -2 Reflex. This calculation gap is independent from the unresolved table origin and stripped reference. |
| Stage Fright | Running Spell Effect: -4 on all skill checks and concentration checks while affected; general ability-check penalties remain unmodeled. |
| Revelation | Running Spell Effect: chosen-object insight bonus equal to caster level, maximum +10; target/check selection remains manual. |
| Fleshworm Infestation | Repeated Fortitude save gates 2 Dexterity damage and staggered/sickened condition effects; HP damage remains manually resolved. |
| Paragon Surge | Running Spell Effect: +2 enhancement to Dexterity and Intelligence; temporary feat Grant with daily-fixed choices is separately unmodeled. |
| Witness | Running Spell Effect: blinded/deafened state while remote senses are selected; sense transfer is unmodeled. |
| Magic Circle against Law | Running Spell Effect: inherited +2 deflection AC and +2 resistance saves against lawful creatures, shared lawfulCreatures Situation; mental-control/ward/imprisonment are manual. |
| Spotlight | Running Spell Effect: -20 Stealth, applied to the moving target on failed save or only occupants of the original square on success. |
| Wrath | Running Spell Effect: morale attack, weapon damage and spell-resistance check bonus max(1, min(3, floor(caster level/3))) against the designated enemy; at caster level 12 Improved Critical/nonstacking threat expansion. |
| Giant Form I | Running Spell Effect: Large form +6 size Strength, -2 Dexterity, +4 size Constitution and +4 natural armor; chosen form's attacks, resistance 20, regeneration 5, movement and abilities remain incomplete. |
| Enemy Hammer | Running Spell Effect: +4 circumstance Fortitude saves only when the target spends all actions resisting movement; independent telekinetic attacks use caster level+max(Intelligence, Charisma) and size dice table. |
| Unsettling Presence | Running Spell Effect: -4 Handle Animal and Ride checks against permanent class companions; wild empathy and attitude/save interactions remain unmodeled. |
| Touch of Idiocy | Running Spell Effect: one rolled 1d6 penalty applies to Intelligence, Wisdom and Charisma, each with a minimum score of 1; requires a saved rolled value and floor handling. Three raw action.notes.effect dice strings are not independent rolls. |
| Sure Casting | Running Spell Effect: +5 effective caster level only to overcome spell resistance for next spell before end of next round; discharge lifecycle is manual. |
| Transplant Visage | Running Spell Effect: +10 untyped Disguise from the permanent face alteration; layers/removal remain manual. |
| Dominate Monster | Running Spell Effect: inherited +2 save when an order violates nature; domination commands, language, Sense Motive DC 15 and daily concentration remain manual. |
| Feeblemind | Running Spell Effect: Intelligence and Charisma set to 1 and -4 save only for arcane-capable target; absolute scores and conditional spell/skill inability require unfinished integration. |
| Allegro | Separate running effect must reuse shared Haste Source: +1 attack/dodge AC/Reflex and extra full-attack attack, +30 ft enhancement speed capped at twice base while performance continues; dismissal reroll remains prose. |
| Mudball | Running Spell Effect: blinded condition until shake-off or standard-action wiping, independently of cast-time ranged-touch success. |
| Unconscious Agenda | Running Spell Effect: +5 save against compelled action against nature, overriding Dominate Person's +2; trigger/20 word instruction/hour/10 minute memory lifecycle remains manual. |
| Contact Other Plane | Running Spell Effect: failed Intelligence check sets Intelligence and Charisma to 8 for plane-dependent 1–5 weeks and prevents arcane casting; question/result tables remain manual. |
| Respectful Quiet | Running Spell Effect: +10 circumstance Stealth on quieted creatures; one-way Silence/verbal-component behavior remains manual. |
| Scorching Ash Form | Running Spell Effect: inherited Gaseous Form removes material and natural armor but preserves allowed armor components; DR 10/magic and fire subtype immunity/vulnerability remain incomplete. Space sharing deals 2d6 fire damage and smoke saves require manual resolution. |
| Psychic Image | Running Spell Effect: blinded/deafened/helpless original body while image occupied; intangible remote psychic casting remains unmodeled. |
| Righteous Might | Running Spell Effect: grow one size category, +4 size Strength and Constitution, -2 Dexterity, +2 enhancement natural armor and changed size AC, attacks and weapon dice; DR 5/evil or good becomes 10 at caster level 15. Size and gear integration remain incomplete. |
| Rope Tornado | Cast-specific Reflex save: +2 for Huge or larger, -2 for Medium or smaller; manual size predicate and area recipients required. |
| True Skill | Running Spell Effect: insight bonus max(1, floor(caster level/2)) to next selected skill check; selected skill and discharge not automatically computed. |
| Blood Scent | Running Spell Effect: qualifying orc or raging recipient gains +2 morale attacks and damage against a detected injured foe, or +4 when the foe is below half HP or bleeding; foe health and rage predicates remain manual. |
| Limp Lash | Running Spell Effect: cumulative 1d6 penalties to Strength, Dexterity and Constitution each round, minimum score 1 and paralysis except for the head; lash range 20 feet, hardness 5 and 15 HP require manual tracking. |
| Pernicious Poison | Running effect: -4 saves against poison and skill checks to cure it; poison has 2 additional frequency increments, unmodeled poison lifecycle. |
| Archon's Aura | Running effect: -2 attacks, saves and AC in 20 ft aura until resisting or breaking it once per casting. |
| Etheric Shards | Running Spell Effect: +4 save when shards are visible, -4 when bull rushed or dragged through invisible shards; movement at half speed, 1d8 damage per cube and +1 cumulative bleed for each failed cube require manual spatial and damage tracking. |
| Tree Shape | Running effect: +10 natural armor, Dexterity 0, speed 0 and critical-hit immunity; actual tree form/free dismissal unmodeled. |
| Monstrous Physique IV | Running effect: inherited chosen-size Strength/Dexterity/natural armor adjustments, selected creature abilities, resistance 20, +8 poison saves and movement/senses; all form allocations incomplete. |
| Rend Body IV | Running Spell Effect: inherited sickened condition while bleed persists; 1d8 per caster level, maximum 20d8, limb loss above one quarter maximum HP and bleed 1 per two caster levels remain manual damage and anatomy state. |
| Kreighton's Perusal | Conditional benefits of the selected book apply after 1 hour-equivalent perusal; exact book/benefit remains unresolved, never unconditional skill bonus. |
| Unravel Destiny | Running Spell Effect: -2 to ability checks, attacks, saves and skills per current hero point, updating as points change; spending causes 2d6 HP damage per point. Hero point integration remains unmodeled. |
| Fleeting Defect | Running Spell Effect: -2 circumstance on construct attacks, saves, skills and ability checks; broken item statistics require targeted item integration. |
| Magic Circle against Chaos | Running Spell Effect: inherited +2 deflection AC and +2 resistance saves against chaotic creatures; control prevention, summoned-creature warding and trapping a nonlawful called creature remain manual. |
| Calm Emotions | Running Spell Effect: suppress morale bonuses, barbarian rage, bard Inspire Courage, fear and confusion while active without removing their sources; suppression and restoration integration remains incomplete. |
| Form of the Dragon III | Running Spell Effect: Huge form, +10 size Strength, +8 size Constitution, +8 natural armor, fly 120 feet (poor), blindsense 60 feet, darkvision 120 feet and DR 10/magic; chosen dragon element immunity, attacks and 12d8 breath every 1d4 rounds remain incomplete. |
| Elemental Mastery | Running Spell Effect: chosen element grants +1 circumstance attack in its particular Situation; air fly 30 feet (average), earth burrow 15 feet, fire +20 feet to all speeds or water +30 feet to swim. Malformed source table requires comparison before interpreting cells. |
| Umbral Infusion, Mass | Running Spell Effect: inherited +2 on all rolls, damage and special ability DCs, +4 AC and CMD, +2 HP per Hit Die on mindless undead; 50% control failure and template integration remain incomplete. |
| Claim Identity | Running Spell Effect: +10 Disguise to impersonate with no age, race, size or gender penalties; inherited Alter Self grants Small +2 Dexterity or Medium +2 Strength, senses and movement. Target form integration remains incomplete. |
| Protection from Evil, Communal | Running Spell Effect: +2 deflection AC and +2 resistance saves against evil creatures; caster-level minutes are divided in one-minute intervals. Allocation, mental control and summoned-creature warding remain incomplete. |
| Divine Arrow | Targeted arrow or bolt Effect: extra Lay on Hands dice against undead, not multiplied on critical hits; requires an unused daily use but expends none. Class feature, target item and discharge integration remain incomplete. |
| Longshot | Running Spell Effect: +10 feet to any weapon range increment; weapon/routine integration remains uncurated. |
| Moment of Greatness | Running Spell Effect: double one existing morale bonus on one chosen roll or check per recipient, chosen before rolling; no unconditional additive bonus. |
| Aram Zey's Focus | Running Spell Effect: grants Trapfinding as a rogue of half the character level, then applies CRB Trapfinding at that effective rogue level; if already possessed, grants +5 competence on Disable Device against mechanical traps only. Avoid-trigger reroll consumes 1 minute of remaining duration. |
| Thorn Javelin | Running Spell Effect must grant javelin proficiency while wielding the created weapon and sickened on a failed Fortitude save; appropriate-size Base Item, one-minute duration cost per attack, replacement and disappearance remain incomplete. |
| Reincarnate Spy | Running Spell Effect: +5 Disguise and new-body racial physical adjustments; inherited two negative levels, or two Constitution drain at level 1 instead, 50% spell or slot loss and creature-form abilities remain incomplete. |

Mythic path/tier grants (**Ascension**), external plane saving throws (**Speak with Plane**) and autonomous symbolic/guardian combat (**Symbol of Striking**, **Summon Ancestral Guardian**) are explicitly unsupported/prose-only mechanics. Hero point counters and damage (**Unravel Destiny**), ordinary cast-time damage/healing, summoned actors, object hardness/HP, visibility, travel and encounter/resource consumption similarly remain manual where the PRD does not promise automation. This does not make their whole Spell definitions a new unsupported disposition or disguise supported Character statistic gaps.

Important correctness boundaries: Touch of Idiocy uses **one rolled 1d6 penalty**, applied to all three mental scores with minimum score 1; its three raw action notes are not independent rolls. Aram Zey's Focus grants Trapfinding at **half the Character's level as effective rogue level**; the CRB class feature then reads that rogue level, rather than granting a direct half-Character-level bonus. Allegro must reuse the shared Haste Source when its running effect is curated. Form Spells retain choices and nonstacking rules. Thorn Javelin's temporary proficiency/item property grant is explicitly outstanding. Greater Entice Fey's 2,500 GP offering and Reincarnate Spy's 2,500 GP oils override their base Spell costs.

The inventory records **18 source/import discrepancies**, including cast-time attack/save omissions, Prying Eyes' count placeholder, Fair is Foul's dismiss flag, harmful Fleeting Defect's harmless flag, secondary Chain Lightning save DC/cap, Elemental Mastery's malformed table and spacing corruption. Raw text and actions remain byte-bound; no invented mechanics repair them. The importer drops descriptors for **40 roots**, reading `system.types` rather than their `system.descriptors`; it also omits Touch of Idiocy's three `actions[].notes.effect` strings and Blacklight's scope tag. These gaps are reported; product code is unchanged.

The full-source reference gate additionally blocks:

- **Fair is Foul** (`pf1/61pYmOmQJ2nMk2vL`): `Compendium.pf1.roll-tables.Vm8ccE6qchTx2Trn` — Unresolved catalog link stripped; roll tables are outside catalog definition scope.
- **Rope Tornado** (`pf1/6cEWqLm3QYhtWNxK`): `Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.iH69GIwm8BjecrPN` — Unresolved catalog link stripped; journal rules are outside catalog definition scope.

## Public and isolated saved-sheet evidence

[Isolated parser preview](../../tests/fixtures/spells-521/preview.json) retains the 100 ticket Spells with reviewed Notes. [Full-context binding fixture](../../tests/fixtures/spells-521/binding-preview.json) retains those roots and only their 26 recursive Spell dependencies, with original remaps and extraction hashes. Source-backed dependencies are unreviewed context. Root-only bounded extraction omits those dependencies and therefore has additional gate failures; legal assessments remain bound to the full-context extraction. [Public catalog tests](../../tests/catalog/spells-521.test.ts) replay every content/mapping/evidence/notice binding, raw hashes, inventory, shared Situations and real list levels. [Saved-sheet integration tests](../../convex/catalogSpells521.integration.test.ts) use source-backed Oracle and Wizard collections on isolated fixture data, proving ordinary caster level/concentration/DC values, client/server parity, member editing, outsider refusal, campaign scope, removal and preview behavior.

There is **no representative legally admitted output** to demonstrate: every root is held, and two have independent reference failures. The isolated tests prove retained preview and calculated consumer behavior without clearing legal holds, publishing a catalog, activating a release or using production data.

## Commands and observed results

Exact candidate selections and command output stay in ignored scratch inside this worktree. No scratch/answer file is linked as evidence. All source-taking commands use the two pinned read-only checkouts named above. No full `pnpm test` was run here.

```sh
pnpm -s catalog:curate --system /home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1 --content /home/andreas/repos/everythingpath/sources/pf1-content --candidates <ignored exact-key selection> --descriptions --out <ignored bounded draft directory>
pnpm -s catalog:preview --system /home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1 --content /home/andreas/repos/everythingpath/sources/pf1-content --candidates <ignored exact-key selection> --out <ignored bounded preview directory>
pnpm -s catalog:preview --system /home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1 --content /home/andreas/repos/everythingpath/sources/pf1-content --out <ignored full preview directory>
pnpm -s catalog:curate --system /home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1 --content /home/andreas/repos/everythingpath/sources/pf1-content --out <ignored full draft directory>
pnpm -s catalog:format --check
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm test tests/catalog convex/catalogSpells521.integration.test.ts --maxWorkers=1
```

| Check | Observed result |
| --- | --- |
| Initial exact prose drafter | Passed: 43 new optional drafts, 0 missing/unresolved required mechanics. |
| Final exact prose drafter | Passed in 8.316s: 1,224 records, 0 new/replaced/missing/unresolved required mechanics; all 100 descriptions checked, 51 optional calculations unresolved. |
| Isolated source-fixture parser | Passed: 100 entries, 100 checked descriptions, 0 required/missing records. |
| Focused batch tests | All 48 new cases passed in the combined run: 46 catalog cases and 2 isolated saved-sheet cases. Initial focused run was 47/47 in 6.46s; the additional case pins the linked malignancy table. |
| Initial full CLI preview | Exit 1: whole-corpus known gaps; selected 98 held and 2 reference failures after public binding refresh. |
| Final bounded CLI preview | Exit 1 in 9.078s: 100 entries / 0 resources, 0 admitted, 81 held, 19 failures, 0 omissions/exceptions. Its root-only selection removes dependency context; these additional failures do not replace the full-context 98 holds and 2 persistent reference failures. |
| Verified final full CLI preview | Exit 1 in 5m39.703s: 23,037 entries / 538 resources; 53 admitted, 23,129 held, 2 dependent omissions, 0 exceptions and 4,731 whole-corpus failures. Public postbinding gate: selected 0 admitted, 98 held and 2 reference failures; all 100 bindings current. |
| Full-corpus drafter, before late Fair is Foul diagnostic | Passed: 4,849 records; 3,625 new drafts; 0 missing/replaced. Required 3,728 = 3,625 drafted + 103 checked; 761 unresolved required mechanics. Description candidates 10,526, checked 1,121; optional unresolved 465. |
| Canonical data format | Final `catalog:format --check` passed after schema validation, raw-assessment preservation correction and final binding refresh; `git diff --check` passed. |
| Typecheck | Passed: exit 0 in 3m34.015s. |
| Lint | Passed: exit 0 in 4m35.210s. |
| Initial migration writer check | Final run passed: 183 checked writer registrations. |
| Catalog pins | Final run passed: `sha256:71c66667344e200747085cc47660277a9e7677da10cdd3d58033591444baa25b`. |
| Combined catalog + batch tests | Passed: 48 files / 847 tests; Vitest 87.28s, command elapsed 1m27.845s. Includes all 48 new focused cases. |

## Owner follow-up: Blacklight held (2026-10-08)

The owner's policy (2026-10-08, [importer contract](README.md)) holds record-level `3.5` tags and never excludes them. Blacklight's disposition is now **held**, with the specific hold `spells-521-record-3.5-tag-6s2Mrf0bRBHKArPe` naming the tag, in the shape #523 uses for Bolt of Glory and Reveal True Shape. Its whole-content and notice-chain holds are unchanged. The inventory, assessment, evidence, curation rationale, report, fixture documentation, provenance and tests agree: **100 held, zero excluded**.

A fresh verified full CLI extraction (`catalog.json` `38e0d2f1c24fc15b16eaa080831e8742234e566ea50f4457798d556b04d09b40`, which differs from the pre-change extraction only in #522's Greater Shield Speech diagnostic) leaves Blacklight's content, mapping and notice fingerprints unchanged. Its evidence fingerprint was rebound to the refreshed evidence text. The other 99 bindings were checked against the same extraction and are current.

| Follow-up command or check | Result |
| --- | --- |
| Fresh verified full `catalog:preview` | Exit 1 for existing corpus blockers: 23,109 entries and 538 resources; 56 admitted, 23,198 held, two dependent omissions and 4,689 failures, as before the change. The 100 ticket keys: zero admitted, 98 held and the same two reference failures. |
| Fresh verified bounded `catalog:preview` | Exit 1: 100 entries; 81 held and 19 outside-selection reference failures. Blacklight is held. |
| `pnpm catalog:pin` | Pass; calculation identity unchanged. |

## Time and workflow problems

Phase estimates: read-in and contracts about 2 minutes; source/mechanics review and exact draft about 6 minutes; initial overlay/legal/fixture generation and bindings about 9 minutes, with about 2 minutes of later evidence/report refinements; later inherited-rule and linked-table re-review about 6 minutes. Final full/minimal rebinding and public gate took about 6 seconds. Heavy checks ran sequentially: initial successful full preview about 3m33s, the intermediate 50-diagnostic preview about 6m02s and the final 51-diagnostic preview 5m39.703s; the full-corpus drafter took about 4m36s, typechecking 3m34.015s and linting 4m35.210s. Sequential verification command time totals approximately 29.5 minutes, including the 1m27.845s combined tests. Artifact review overlapped those commands, so phase durations are not summed as wall-clock time. Other measured command durations appear in the results above. Source checks were delegated read-only for candidates 51–100 and root independently reviewed all descriptions; all tracked artifact edits stayed in this task.

Two implementation mistakes were caught and corrected before final checks: shared Situation outputs initially used `{key}` instead of the schema's string, and writing schema-parsed existing assessments trimmed 92 unrelated rationales. Existing raw assessments were restored from the read-only HEAD snapshot; only these 100 new assessments remain changed, and the binder now validates without rewriting parsed non-batch values. A missing fixture content source directory was fixed with a tracked `.gitkeep`. Refining four optional diagnostic classifications changes imported `unsupported` content, so final bindings are regenerated against final extraction. A late complete review of the excluded linked malignancy table added the 51st independent calculation gap; its raw context and per-result evidence are now retained. The configured Opus/Fable aliases are unavailable in this toolset, so inherited Sol subagents followed the prior batch convention; no UI layer was changed. Upstream descriptor/action-note/scope omissions and the two reference failures remain named gaps. No Git mutation, GitHub write, env-file access, private E2E access, AoN request or product or production Convex change occurred.
