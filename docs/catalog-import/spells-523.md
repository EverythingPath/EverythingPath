# Spell curation review: #523

Reviewed **2026-10-08** by **Sol (AI curator) for the owner**, following [#523](https://github.com/AndreasUnunger/EverythingPath/issues/523), [PRD #251 Decisions 10 and 17 and the acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461), [Spellcasting](../character-sheet/spellcasting.md), [Temporary Effects](../character-sheet/temporary-effects.md), [curation](curation.md) and the [#328](races-328.md) and [#521](spells-521.md) precedents.

Exactly **100 ticket keys** receive one contract disposition: **0 admitted, 100 specifically held, 0 dependently omitted, 0 wholly unsupported/prose-only and 0 excluded**. **Bolt of Glory** and **Reveal True Shape** carry explicit record-level `3.5` tags. Both have specific holds for those record-level tags under the owner's policy (2026-10-08) that record-level `3.5` tags are held, never excluded; [the importer contract](README.md) excludes only whole 3.5 packs. No Catalog Release was published or activated.

**Public full-context admission is 0 admitted, 100 held, 0 failures, 0 dependent omissions and 0 retained exceptions**, with all 100 attribution bindings current. Bolt of Glory and Reveal True Shape remain held for their record-level `3.5` tags under the owner's policy (2026-10-08). The bounded CLI reports 77 held and 23 reference failures because linked definitions are outside this ticket's selection; none of those failures occurs for these roots in the verified full extraction. Technical outcomes do not change a root's single contract disposition.

## Evidence and scope

- Read-only Foundry PF1 v11.11: `418761d2e16a6037c0156bb4a241f7cea5a2986d`.
- Read-only pf1-content 11.4.0: `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`.
- [Inventory, attribution and mechanics evidence](../../scripts/catalog/legal/spells-523.json) records every ordered key, raw description/path/SHA256, source book and page, complete structured actions and metadata, named whole-content gaps, inherited rule evidence, notice-chain requirements and independent outstanding calculations.
- [Fixture provenance](../../tests/fixtures/spells-523/provenance.json), [isolated parser preview](../../tests/fixtures/spells-523/preview.json) and [saved-sheet inputs](../../tests/fixtures/spells-523/sheet.ts) retain **160 byte-identical YAML files: 100 ticket roots, 28 class-context files and 32 recursive Spell-context files**. The [full-context binding preview](../../tests/fixtures/spells-523/binding-preview.json) contains 132 Spell entries and zero unrelated resources. Supporting classes and linked definitions are unreviewed context and do not enlarge the 100 reviewed candidates. Ordered-key SHA256: `8721bfcfcba71de1af41fa24a22a95ced032470e258c60eaff71a80cf404293d`.
- [Reviewed overlay](../../scripts/catalog/reviewed-curation.json), [assessments](../../src/lib/catalog/data/attribution-assessments.json), [content-bound evidence](../../src/lib/catalog/data/attribution-evidence.json) and [enforced notice holds](../../scripts/catalog/legal/held-notices.json). Existing Registry identities and shared Situations are reused. Independent comparisons preserve all 1,424 non-batch overlay records, all 27 shared Situations, all 1,617 earlier evidence records and all 1,638 earlier assessments. No new Registry identity or accepted alias is inferred.

Permitted PCGen comparison uses fixed commit `25523dbcf10e86c280fc0f447167ea43d67419d3`: [CRB Spell descriptions](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_spells.lst) and [campaign metadata](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/core_rulebook.pcc). **17 direct CRB descriptions** have literal comparator evidence; **14 match** after presentation normalization. **Animate Dead**, **Guards and Wards** and **Mage's Sword** differ. The first adds a Bestiary reference; the second differs in list numerals and escaped percent signs; the third differs in its critical-multiplier character encoding. Conservative comparison retains these differences without declaring a mechanics conflict. Literal lines, locations, hashes and comparison results are retained per entry. Prose equality does not establish complete action/material metadata, expanded class/granted lists, inherited origins or notice-chain coverage. PCGen's Paizo Inc. wording is not declared equivalent to the Registry's Paizo Publishing, LLC line. No book PDFs were available. Archives of Nethys was not used. Source runtime was never imported or executed.

## Attribution and inherited notices

The batch records **49 observed minimum publication-code requirements**, **48 enforced notice/notice-chain holds** and **100 individually named whole-content holds**. CRB's reviewed identity is reused. Compilation/title/code matches remain evidence leads, not accepted whole-content or complete-chain coverage. Every extracted root has its own unresolved content-bound assessment, including both record-level `3.5` tag holds under the owner's policy (2026-10-08). Missing promised mechanics do not become attribution holds.

The inherited-rule pass retains **138 source-bound reasons across 91 candidates**. Important dependencies are:

- **Murderous Crow:** Bestiary 1 celestial/fiendish templates, Bestiary 2 entropic/resolute templates, APG Improved Steal and CRB blinded/Remove Blindness. Improved Steal does not grant its Unchained Combat Trick, and the crow's feat never becomes the caster's feat or CMB.
- **Detect Demon:** CRB Detect Evil, abyssal bloodline and stunned; Bestiary 1 demon subtype and succubus profane gift; ARG demonic tiefling heritage; **Lords of Chaos (PZO9225)** Demonic Obedience p. 8 and demonic implants p. 44. The existing immutable Lords of Chaos notice is retained as a held identity lead alongside its exact publication code; no code alias is accepted.
- **Invoke Deity:** CRB named Spells, conditions, domains and weapon/equipment procedures; Bestiary universal abilities; **Bestiary 2 (PZO1116)** shining child's blinding light; **Bestiary 6 (PZO1137)** explicit ScalykindB6/VoidB6 markers. Each domain is a separate selected effect with its own limits; the Spell grants no proficiency merely by naming a deity's favored weapon.
- **Grasping Tentacles:** CRB Black Tentacles and five named conditions, plus **APG (PZO1115)** dirty trick. The tentacles' CMB belongs to the conjured effect, not the caster.
- **Animate Dead** needs Bestiary 1 skeleton/zombie templates; **Wicker Horse** needs Bestiary horse/pony and construct traits plus CRB Run and Barkskin; **Final Sacrifice** needs APG eidolon rules and CRB summoning.
- **Create Drug** explicitly names **GameMastery Guide (PZO1114)** Drugs and Addiction p. 236; its missing adyton sidebar remains an identified source gap. **First World Revisions** inherits ARG Ancestral Regression and wayang traits and CRB Undetectable Alignment.
- **Web Cloud** and **Guards and Wards** inherit CRB Web, including grappled rather than entangled; the latter also inherits its selected Gust of Wind/other ward Spells. **Globe of Tranquil Water** inherits CRB Antiplant Shell and Ice Storm and Bestiary water-elemental rules.

Per-key source citations, exact inherited-rule reasons and enforced hold IDs are in the inventory. Named and linked definitions remain context, never additional admitted candidates.

## Every-key disposition

Each root has a separate `spells-523-whole-content-<ID>` technical hold and individually bound missing evidence. Minimum notice requirements are explicitly incomplete until the specified comparisons and chains are resolved.

| Exact key | Candidate | Upstream root citation | Contract disposition |
| --- | --- | --- | --- |
| `pf1/81QcPhgRcHxjpScn` | Bolt of Glory | PZO1111, p. 206 | Specifically held: record-level 3.5 tag (owner policy, 2026-10-08) |
| `pf1/8237jjhtwfqje4n6` | Suppress Charms and Compulsions | PZO1138, p. 77; PZO9409, p. 27 | Specifically held |
| `pf1/82qn051kayic7k1v` | Forceful Strike | PZO9237, p. 55 | Specifically held |
| `pf1/82vi1xife3nlu8a0` | Mirage Arcana | PZO1110, p. 314 | Specifically held |
| `pf1/82xxs3q1pdq8lpbp` | Undine's Curse | PZO1121, p. 179 | Specifically held |
| `pf1/82z60xtalr9fzkwb` | Foe to Friend | PZO1115, p. 224 | Specifically held |
| `pf1/835n5zqjvh3dybwq` | Squeeze | PZO1121, p. 209 | Specifically held |
| `pf1/83suv15a15s4dn1m` | Ancestral Gift | PZO9408, p. 24 | Specifically held |
| `pf1/85seyvrlrputrpe7` | Erase Impressions | PZO1132, p. 170 | Specifically held |
| `pf1/86notnyommri5rnh` | Recharge | PZO9272, p. 11 | Specifically held |
| `pf1/86xra7zolqibyn7d` | Underbrush Decoy | PZO1134, p. 228 | Specifically held |
| `pf1/877df1h3azar7pk5` | Battering Blast | PZO9234, p. 33 | Specifically held |
| `pf1/879sdozw7ca7ci9k` | Stone Fist | PZO1115, p. 247 | Specifically held |
| `pf1/88xyrqt9mfwa3mgp` | Absolution | PZO1134, p. 203 | Specifically held |
| `pf1/8AMmUGAADKjE3lKU` | Unflappable Mien | PZO9488, p. 19 | Specifically held |
| `pf1/8a3z0xruxzo3wz24` | Symbol of Dispelling | PZO9267, p. 243 | Specifically held |
| `pf1/8aba4z8vx3rn5l28` | Implosion | PZO1110, p. 299 | Specifically held |
| `pf1/8ai7fslz4zu8xe9s` | Magic Jar | PZO1110, p. 309 | Specifically held |
| `pf1/8bvq7lk9cnxv8hju` | Geb's Hammer | PZO9237, p. 55 | Specifically held |
| `pf1/8c326bzvz1dbe6q4` | Thunderstomp | PZO1129, p. 196 | Specifically held |
| `pf1/8d355ac8allqcfwm` | Dark-Light | PZO9432, p. 26 | Specifically held |
| `pf1/8di89emjpop0xnw9` | Calm Air | PZO9452, p. 30 | Specifically held |
| `pf1/8eb9l0bt9esbn73l` | Sleepwalking Suggestion | PZO1135, p. 127 | Specifically held |
| `pf1/8f763lq7cny9kmas` | Symbol of Vulnerability | PZO1117, p. 243 | Specifically held |
| `pf1/8fqj5pubbbr3bbfd` | Swallow Poison | PZO1134, p. 226 | Specifically held |
| `pf1/8fyg16j34uruuy45` | Ectoplasmic Eruption | PZO1132, p. 168 | Specifically held |
| `pf1/8gbb9if7osaca8pn` | Spell Absorption, Greater | PZO9237, p. 61 | Specifically held |
| `pf1/8goh505x858g64pu` | Protective Penumbra | PZO1117, p. 233 | Specifically held |
| `pf1/8h84spdczbsi69gr` | Hostile Levitation | PZO1118, p. 231 | Specifically held |
| `pf1/8hskbv8e996jwmmj` | Ego Whip V | Direct source absent; linked Ego Whip I: PZO1132, p. 169 (V page unverified) | Specifically held |
| `pf1/8ikma6e6wqrx1dh7` | Murderous Crow | PZO9280, p. 221 | Specifically held |
| `pf1/8j5qgnd7wtnmj3fu` | Concealed Breath | PZO9479, p. 14 | Specifically held |
| `pf1/8jq1atxonnerix55` | Polar Ray | PZO1110, p. 323 | Specifically held |
| `pf1/8jqq8kxdzx01ogl9` | Liberating Command | PZO1118, p. 233; PZO9409, p. 27 | Specifically held |
| `pf1/8jrtvmhydudy7fks` | Angelic Aspect | PZO9431, p. 28 | Specifically held |
| `pf1/8k1sq7ao2ghw0grk` | Force Anchor | PZO9444, p. 26 | Specifically held |
| `pf1/8kd54d2ho1fywj2u` | Protection from Good, Communal | PZO1118, p. 240 | Specifically held |
| `pf1/8kqajvwnbv9psq1h` | Instant Enemy | PZO1115, p. 229 | Specifically held |
| `pf1/8ky05kxdgiibhk9y` | Truespeak | PZO1121, p. 89 | Specifically held |
| `pf1/8mv7anloqgou2ps8` | Brilliant Inspiration | PZO1115, p. 207 | Specifically held |
| `pf1/8myadlblry9uxrof` | Thought Worm IV | PZO9477, p. 11 | Specifically held |
| `pf1/8nbpbvgkggj0wbmd` | Brow Gasher | PZO1118, p. 224 | Specifically held |
| `pf1/8nnswcde15poheci` | Rampart | PZO1115, p. 237 | Specifically held |
| `pf1/8nrt26t37v7koqr8` | Misdirection | PZO1110, p. 314 | Specifically held |
| `pf1/8p53yf2qfz5iz7mm` | Beanstalk | PZO9091, p. 70 | Specifically held |
| `pf1/8p6eshc9ef48anim` | Besmara's Grasping Depths | PZO9471, p. 26 | Specifically held |
| `pf1/8polm9nkg4jh3fpy` | Thought Shield II | PZO1132, p. 189 | Specifically held |
| `pf1/8pwm7uieunccsc3s` | Spellcasting Contract, Greater | PZO9029, p. 68 | Specifically held |
| `pf1/8qligfr61kotnlwx` | Volcanic Storm | PZO1117, p. 248 | Specifically held |
| `pf1/8qsjledebqhezuba` | Create Armaments | PZO9465, p. 7 | Specifically held |
| `pf1/8r1zlyqstw6arker` | Malicious Spite | PZO1117, p. 228 | Specifically held |
| `pf1/8rf2ucrtzmxooyw6` | Lunar Veil | PZO1117, p. 227 | Specifically held |
| `pf1/8ru8b4ze5yt7eyuo` | Surefoot Boots | PZO9481, p. 21 | Specifically held |
| `pf1/8semprhq10vg0cbm` | Mind Thrust III | PZO1132, p. 177 | Specifically held |
| `pf1/8tqusowlidyvacx3` | First World Revisions | PZO9466, p. 11 | Specifically held |
| `pf1/8u1xa5javcxc6szk` | Rage | PZO1110, p. 329 | Specifically held |
| `pf1/8u47mrsvdw4ssinw` | Lost Locale | PZO9280, p. 220 | Specifically held |
| `pf1/8uwmrygxgih1fb57` | Animate Dead | PZO1110, p. 241 | Specifically held |
| `pf1/8v1k7s1r6k7k0cf4` | Empower Holy Water | PZO9444, p. 26 | Specifically held |
| `pf1/8vu9wseuc1em7afq` | Grasping Tentacles | PZO9459, p. 30 | Specifically held |
| `pf1/8w67l6dzzsi6oz5f` | Create Pit | PZO1115, p. 213 | Specifically held |
| `pf1/8wjn8wfe7pirs54o` | Primal Regression | PZO1132, p. 181 | Specifically held |
| `pf1/8wspht4k8tiugz6u` | Burst of Glory | PZO9267, p. 230; PZO9202, p. 21 | Specifically held |
| `pf1/8x0y3dyxmvdku35p` | Intellect Fortress II | PZO1132, p. 175 | Specifically held |
| `pf1/8xjcrqg79ugxu5qu` | Bull's Strength, Mass | PZO1110, p. 251 | Specifically held |
| `pf1/8xmk11xnay54ftp8` | Create Drug | PZO1139, p. 183; PZO9099, p. 74 | Specifically held |
| `pf1/8y24u1ejlqeoiyqb` | Cure Serious Wounds, Mass | PZO1110, p. 263 | Specifically held |
| `pf1/8yxau0x46jky1xgq` | Fallback Strategy | PZO9267, p. 233; PZO9202, p. 39 | Specifically held |
| `pf1/8z4tlk1fojr9t9yb` | Guards and Wards | PZO1110, p. 292 | Specifically held |
| `pf1/8zeulunjetwrdgwj` | Order's Wrath | PZO1110, p. 317 | Specifically held |
| `pf1/8zu33gg0ri50jv6h` | Echo | PZO1140, p. 229 | Specifically held |
| `pf1/90xaelj2ncuzq62n` | Mindscape Door | PZO1132, p. 177 | Specifically held |
| `pf1/911ksc2j8ssv692y` | Crafter's Curse | PZO1115, p. 213 | Specifically held |
| `pf1/91IJiOMgUZ3edBV0` | Reveal True Shape | PZO9019, p. 75 | Specifically held: record-level 3.5 tag (owner policy, 2026-10-08) |
| `pf1/91pzm8db3fbusr76` | Final Sacrifice | PZO9458, p. 22 | Specifically held |
| `pf1/91rt7847dbgccbjk` | Paranoia | PZO1132, p. 179 | Specifically held |
| `pf1/92hth51cs9oi0nfe` | Wall of Fire | PZO1110, p. 365 | Specifically held |
| `pf1/92tftva2khuvxjx9` | Web Cloud | PZO1121, p. 107 | Specifically held |
| `pf1/93d96jqmdhfo3nza` | Mount, Communal | PZO1118, p. 237 | Specifically held |
| `pf1/93ufp6thcni304jh` | Wicker Horse | PZO1136, p. 177 | Specifically held |
| `pf1/954iw1i71kdsanjv` | Rapid Repair | PZO1117, p. 234 | Specifically held |
| `pf1/967ur7a9xepd704y` | Shadow Evocation, Greater | PZO1110, p. 340 | Specifically held |
| `pf1/96wkex2umgqrjwr4` | Mage's Sword | PZO1110, p. 307 | Specifically held |
| `pf1/97mcivnu2owb8119` | Mirror Strike | PZO1118, p. 236 | Specifically held |
| `pf1/97w0wbamqk0fzani` | Elemental Assessor | PZO9255, p. 50 | Specifically held |
| `pf1/98277u53x5r925cm` | Forced Repentance | PZO1115, p. 224 | Specifically held |
| `pf1/98uz9qap4zc9e7ly` | Hidden Presence | PZO1134, p. 216 | Specifically held |
| `pf1/9968j68bl9x9iq7u` | Clone | PZO1110, p. 256 | Specifically held |
| `pf1/99fWnrS6n2TnWx8b` | Fortune's Path | PZO9488, p. 10 | Specifically held |
| `pf1/99ihqk5u93smyy9x` | Jester's Jaunt | PZO1115, p. 230 | Specifically held |
| `pf1/99njf60ep58z9rjy` | Blightburn Weapon | PZO9432, p. 26 | Specifically held |
| `pf1/99xovzg8h1nh9o9a` | Lullaby | PZO1110, p. 305 | Specifically held |
| `pf1/9apji9yid0w314z7` | Detect Demon | PZO9437, p. 26 | Specifically held |
| `pf1/9avh63v2izqxldze` | Terrible Remorse | PZO1117, p. 243 | Specifically held |
| `pf1/9b4iklatq5hn1z5m` | Quench | PZO1110, p. 329 | Specifically held |
| `pf1/9crmpewzt1y0hk73` | Resounding Blow | PZO1115, p. 238 | Specifically held |
| `pf1/9ct47k3n3zubtr9p` | Invoke Deity | PZO1141, p. 41 | Specifically held |
| `pf1/9d9rk0olitnscems` | Invigorate | PZO1115, p. 230 | Specifically held |
| `pf1/9djo11hbeop1u28a` | Ricochet Shot | PZO1118, p. 243 | Specifically held |
| `pf1/9ee6iippv1m5sagv` | Globe of Tranquil Water | PZO9456, p. 30 | Specifically held |

## Mechanics and independent gaps

All **100 complete raw descriptions and every action** were inspected. The drafter finds **0 required note/conditional/Item Ability inputs** and **43 optional prose candidates**. The overlay completes all 100 exact description bindings with **135 readable Notes**, **0 recorded-Spell Modifiers**, and no permanent prerequisite/proficiency Grant from recording a Spell. The separate description pass includes descriptions outside the drafter's predicate. Running statistics belong to distinct Spell Effects or actual condition identities, not learned Spells.

Shared Situations are reused, including **bullRush**, **drag**, **reposition**, **trip**, **steal**, **within30ft**, **poison**, **mindAffecting**, **fear** and **death**. Narrow conditions stay explicit in each Note. Charm, compulsion, sleep effects, particular disguises/targets, selected weapon or domain branches and other unmatched circumstances use local labels. No Situation implies a broader one or merges spells with spell-like abilities.

**48 candidates / 48 independently outstanding review items** remain checked unresolved description diagnostics. Some items contain several separately enumerated effects. They remain visible independently of legal holds:

| Spell | Outstanding mechanics |
| --- | --- |
| Suppress Charms and Compulsions | Separate running Spell Effect must grant +4 morale on saves against charms and compulsions for 10 minutes, only in the selected bonus mode; suppression mode instead suppresses charm/compulsion Sources while concentrating, max 1 round/CL, restoring remaining durations afterward. |
| Forceful Strike | Action-specific bull-rush CMB gains a bonus equal to caster level when the forceful melee strike occurs and the Fortitude save fails; ordinary weapon damage plus min(CL,10)d4 force is play-time. Do not create a constant learned-Spell CMB Modifier. |
| Squeeze | Running effect suppresses the usual squeezing speed/attack/AC penalties for spaces at least half width, and applies ordinary half-width squeezing penalties at quarter width. No unconditional speed or AC bonus. |
| Ancestral Gift | Temporary conjured weapon grants +1 enhancement and one chosen CRB +1-equivalent Item Ability plus proficiency only with that weapon. Double-weapon choice: enhance one end plus ability, OR +1 both ends with no ability. Targeted item/property/proficiency integration outstanding. |
| Underbrush Decoy | One distraction-to-hide Bluff check substitutes caster level + Wisdom modifier for total Bluff bonus against every creature within 30 ft; cast-time scoped skill alternative remains outstanding and never changes general Bluff. |
| Stone Fist | Running Spell Effect changes unarmed strike to lethal bludgeoning 1d6 Medium or 1d4 Small and removes AoO for those strikes; ignores only object hardness below 8. Targeted unarmed damage override is outstanding. |
| Magic Jar | Possession temporarily substitutes host Strength/Dexterity/Constitution/HP/natural and automatic abilities while retaining caster mental scores, level/class/BAB/base saves/alignment/mental abilities. Host/body association and recalculation are outstanding; no permanent learned-Spell scores. |
| Thunderstomp | Action-specific trip CMB may replace BAB with caster level and Strength modifier with the actual casting ability modifier; no AoO and both participants must contact ground. Supported CMB alternative integration outstanding. |
| Dark-Light | Apply dazzled on successful save or blinded on failed save for 1 round/CL. CRB condition attack/Perception/AC/skill consequences require a separate target condition/running effect, never a learned-Spell Modifier. |
| Symbol of Vulnerability | Separate symbol effect: -4 spell resistance, -4 all saves, and reduce each energy resistance and DR by 10, floor 0, only within 60 ft and 1 round/CL afterward. Resistance/DR/SR reductions and linked saves remain outstanding; activation max 10 minutes/CL. |
| Ectoplasmic Eruption | Targets are entangled for CL rounds (CRB -2 attacks/-4 Dexterity, associated movement/concentration rules) with the cast-time Reflex-half/Will-partial qualifications retained. Separate condition/effect integration outstanding; incorporeal materialization damage exceptions remain prose. |
| Protective Penumbra | Running Spell Effect suppresses light blindness/light sensitivity/sunlight vulnerability penalties and gives +2 untyped saves only versus nonmagical hazards from bright light (glare/sunburn). Supported save and conditional penalty suppression outstanding. |
| Hostile Levitation | Separate running effect halves target speed, applies -4 CMD only vs bull rush/drag/reposition, and successive melee/ranged weapon attacks receive -1,-2,...,-5; full-round stabilization resets next attack to -1. State/count and situational target integration outstanding. |
| Ego Whip V | Running Spell Effect applies -10 to one chosen Intelligence/Wisdom/Charisma score; failed save staggered 1d10 rounds, successful save negates staggered and limits score penalty to 1 round per inherited Ego Whip I. Selected mental score, save outcome, and duration integration outstanding. |
| Polar Ray | Rolled 1d4 Dexterity drain requires separate abilityDrain recording; not a fixed -4 penalty and not a Modifier on recording Polar Ray. Cold damage min(CL,25)d6 remains play-time. |
| Liberating Command | Only the allowed immediate Escape Artist check receives min(20,2*CL) competence. No general Escape Artist bonus; bound/grappled/restrained and actual ability to escape by that skill must hold. |
| Angelic Aspect | Running effect grants low-light/darkvision60, acid/cold resistance10, DR5/evil, fly30 average, good alignment of natural/wielded weapons, and inherited Protection from Evil: +2 deflection AC/+2 resistance saves vs evil, +2 morale on second mental-control save and suppression/immunity. All separately outstanding; never add learned-Spell Modifiers. |
| Protection from Good, Communal | Communal running effect inherits Protection from Good: +2 deflection AC and +2 resistance saves vs good creatures/effects, +2 morale new mental-control save vs good and suppression/immunity, summoned good creatures ward; duration divided in 1-minute intervals among recipients. |
| Instant Enemy | Selected target counts as one already chosen favored-enemy type for all purposes while active, reusing the Character ranger Favored Enemy attack/damage/Bluff/Knowledge/Perception/Sense Motive/Survival bonuses and conditions. No flat invented magnitude. |
| Thought Worm IV | Failed initial Will save: -6 on Will saves against all mind-affecting effects per Thought Worm I chain. Successful save: -3 only against this caster's mind-affecting spells/effects, for same CL-round duration. Scope differs and must not be merged. |
| Brow Gasher | After discharge on living creature, cumulative -1 all attacks each time bleed occurs at start of target turn; at -3 treats all targets as concealment, at -5 blinded. Separate changing effect/condition and stopping-bleed removal outstanding; bleed damage floor(CL/2) is play-time. |
| Thought Shield II | Running effect grants +6 circumstance Will saves only versus mind-affecting effects for 1 round, plus inherited prohibition on thought-reading. Save Modifier is outstanding on separate effect. |
| Spellcasting Contract, Greater | Inherited contract grants caster profane AC/saves/checks bonus equal highest-level spell imbued (up to 5 under Greater); separate permanent-duration effect must retain caster-target contract and chosen spell levels, with spell-ability transfer outstanding. Base worked example says attacks rather than AC: preserve named source discrepancy, do not silently choose. |
| Volcanic Storm | Separate area effect applies -4 Perception only while inside remaining heavy ash area (after one-time 3d6 bludgeoning+2d6 fire damage); difficult terrain/manual movement. Scoped Perception penalty outstanding. |
| First World Revisions | Running Spell Effect: +20 untyped Disguise only to pass as a gnome; swap wayang darkvision for low-light vision and inherit Ancestral Regression undetectable alignment. |
| Rage | Running Spell Effect: +2 morale Strength, +2 morale Constitution, +1 morale Will, -2 untyped AC; barbarian rage restrictions without post-rage fatigue. |
| Lost Locale | Running Spell Effect inherited from Lost Passage: -4 Dexterity and -2*CL Survival only to avoid becoming lost; every square difficult terrain and loss of difficult-terrain bypass persist 1h/CL after leaving. |
| Empower Holy Water | Targeted running Spell Effect on holy-water item: positive-energy additional direct-hit damage min(CL,10) vs undead and splash half that max5, no effect on living. No blanket weapon damage bonus. |
| Grasping Tentacles | Affected running condition producer: random dirty-trick blinded/deafened/entangled/shaken/sickened conditions carry their CRB Character-stat penalties and sensory restrictions; separate condition selections/effects remain outstanding. Use actual selected condition identity, not an unconditional modifier on the Spell. |
| Create Pit | Affected running effect: +2 untyped Reflex only when ending turn adjacent to sloped pit; do not apply globally. |
| Primal Regression | Running Spell Effect: +6 enhancement Strength, +2 natural armor AC, -4 Will; higher Intelligence/Charisma set to3 is an unresolved score-replacement calculation; 2d8 temporary HP must be recorded, not fixed HP modifier. |
| Burst of Glory | Running Spell Effect: +1 sacred attack; +1 sacred saves only fear Situation; min(CL,20) temporary HP remain manual status, with no roll. |
| Bull's Strength, Mass | Running Spell Effect: inherited +4 enhancement Strength from Bulls Strength; multi-target does not place modifier on learned Spell. |
| Guards and Wards | Affected running effects inherited from optional Gust of Wind: -4 Fly for flyers and -4 ranged attacks/Perception for any creature in its area; conditional scoped totals remain outstanding. Inherited Web can impose grappled (-4Dex and -2attacks/CMB except escape) and cover; separate affected Character-condition/effect producers remain outstanding. Optional Stinking Cloud nausea and prone knockdown retain their actual condition identities. |
| Echo | Running Spell Effect: +CL untyped Bluff only to create distraction to hide when concentrating as standard action. |
| Crafter's Curse | Running Spell Effect: -5 untyped to every Craft specialization for day/CL; no modifier on learned Spell. |
| Final Sacrifice | Affected eidolon running effect: +4 untyped Fortitude to resist unless cast by its own summoner; dependent on target/caster identity. |
| Paranoia | Running Spell Effect: -2 untyped attacks, weapon damage, ability checks, skill checks and saves only adjacent to2+creatures; supported attack/damage/skills/saves outstanding, ability-check totals unsupported. |
| Web Cloud | Affected running conditions inherited from Web: grappled causes -4 Dexterity and -2 attacks/combat maneuvers except escape; separate Character-condition producer remains outstanding. Web grants cover with at least 5 ft. of web between creatures and total cover with at least 20 ft.; chosen-target attack/AC presentation not represented by learned Spell. Web Cloud does not name entangled. |
| Mirror Strike | Running Spell Effect: +2 untyped next melee attack and confirmation only when selected opponents flank you; action-specific, no unconditional bonus. |
| Forced Repentance | Running condition: prone targeting with CRB -4 melee attacks and AC melee/ranged modifiers remains unproduced; use actual condition identity, not learned Spell modifier. |
| Blightburn Weapon | Targeted running weapon Spell Effect: 2d6 fire per round touching/struck contact plus10ft disease radiation aura at spell DC; dynamic weapon/dice data outstanding, not global weaponDamage. |
| Lullaby | Running Spell Effect: -5 untyped Perception and -2 untyped Will only against sleep effects; concentration+round/CL. |
| Terrible Remorse | Running effect when target saves: -2 untyped AC for1round, staggered condition; not unconditional learned Spell penalty. |
| Resounding Blow | Targeted running melee-weapon Spell Effect: +1d6 sonic per hit; stacks with thundering. Separate hit/critical dice and held weapon condition outstanding. |
| Invoke Deity | Domain-specific running Spell Effects remain outstanding: Air fly60perfect or existing+30(max), +1dodgeAC while flying; Animal +6natural armor and size-based bite; Charm Cha+6enhancement; Knowledge Int+6enhancement; Liberation Dex+6enhancement; Repose Wis+6enhancement; Strength Str+6enhancement; Travel Con+6enhancement. Artifice +4 saves individually vs death/mind-affecting/necromancy. Destruction +2two-handed melee damage,+1DC damaging spells,+4Str break checks. Luck +1luck AC/attacks/abilitychecks/saves/skills. Magic SR11+CL hostile spells. Trickery +4Bluff/Disguise/Sleight of Hand/Stealth. War +2insight attacks deity favored weapon,+1d6perhit. Water swim40 and removes underwater penalties. Sun -2attacks sunlight-vulnerable foes and+2saves vs them. Protection choose3 CRB spells and Glory heroism/protection from evil must preserve inherited Sources, not aggregate wrong stacking. |
| Invigorate | Running effect suppresses penalties from fatigued/exhausted conditions while retaining condition identities; actual ability/speed penalties require conditional suppression, not universal +Str/+Dex. |
| Ricochet Shot | Targeted weapon/Attack Routine calculation: derive secondary attack at same BAB while excluding projectile enhancement/magic qualities, and use normal AC for a firearm ricochet; attack-property transformation is not an additive modifier and remains outstanding. |

Ordinary instantaneous damage/healing, independent summoned actors, prediction tables, encounter targeting/positioning, HP pools and use counters remain manual where the consuming contract does not promise calculation. **Rapid Repair** grants fast healing 5 without stacking; it is not a +5 HP Modifier. **Malicious Spite** inflicts daily Wisdom ability damage; it is not a permanent Wisdom-score penalty. **Surefoot Boots** treats one balancing roll as 20, not as a +20 Acrobatics bonus. **Fortune's Path** adds up to 10 to d% while its printed table stops at 100; no outcome above 100 is invented.

Important running-effect boundaries: **Rage** is +2 morale Strength/Constitution, +1 morale Will and -2 AC, without post-rage fatigue. **Primal Regression** sets higher Intelligence/Charisma to 3 and separately grants +6 enhancement Strength/+2 natural armor/-4 Will; temporary HP, end-of-spell Intelligence drain and Charisma damage stay distinct. **Final Sacrifice** grants an eidolon +4 Fortitude unless its own summoner casts the spell; the exemption is not restricted to attacks by other summoners. Its eidolon blast is the literal 1d4 plus half the controlling summoner's caster level, not 1d4 per level. **Ricochet Shot** has an outstanding secondary-attack calculation at the same BAB with projectile enhancements/magic qualities omitted and normal AC for firearm ricochets. **Invoke Deity** retains every domain branch, choice and switch limit; its review does not claim complete automation of abilities, weapon properties, inherited Spells or favored-weapon predicates.

The inventory records **54 discrepancy items across 44 candidates**, including source/import distinctions. Descriptor arrays are omitted for **45 roots** because the importer reads `system.types` instead of `system.descriptors`. Other gaps include Final Sacrifice's structured Reflex save instead of the initial target's Fortitude save, Echo's omitted conditional long range, missing structured attack/damage branches, Create Pit's attack-note depth expression, Create Drug's absent adyton sidebar/unspecified caster-level drug DC, and the two record-level scope tags. Exact raw descriptions/actions remain preserved in evidence. Importer omissions belong to #719/#720; no product fix is part of this batch.

## Public and isolated saved-sheet evidence

[Public catalog tests](../../tests/catalog/spells-523.test.ts) and [saved-sheet integration tests](../../convex/catalogSpells523.integration.test.ts) pass: **31 batch catalog tests and two saved-sheet integration tests**, within the final **1,111-test / 56-file** relevant suite. They exercise source-bound parser/resolver behavior, exact current attribution bindings and isolated saved-sheet behavior. Their preview fixtures are isolated source context, not admitted production content.

The public resolver samples Suppress Charms and Compulsions (Oracle 2), Angelic Aspect (Oracle 5), Hostile Levitation (Wizard 3), Polar Ray (Wizard 8) and Stone Fist (Wizard 1). Recording them preserves ordinary ability scores of 10, melee attack 0 and Will 0 in both current and permanent projections, with no running Spell Effect. Their exact list levels remain recorded.

The saved-sheet checks seed isolated Wizard and source-backed Oracle class context. At class level 1 with the casting ability set to 14, public reads show caster level **1**, concentration **3** and 1st-level save DC **13**. A second organization member browses, records and removes the held-preview Spells; the owner reads those changes, and the public client preview matches server calculations. Ordinary abilities, derived statistics and Spell Effects remain equal to the baseline. Cross-campaign references, another Character's catalog IDs and outsiders' reads/writes are rejected. These checks exercise prepared isolated data through public APIs without publishing held content.

There is **no representative legally admitted output** to demonstrate: every root is held. Retained preview and calculated consumer behavior cannot clear legal holds, publish a Catalog Release, activate production authority or substitute for missing book evidence.

## Original commands and observed results

These rows record the original pre-rebase run; the fix-round results below supersede its global counts and pin. Candidate selections and command output stay in ignored scratch inside this worktree. No scratch or answer file is linked as evidence. Source-taking commands use the read-only pinned checkouts above. No full `pnpm test` is run in this batch; the orchestrator owns the post-rebase landing gate.

```sh
pnpm -s catalog:curate --system /home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1 --content /home/andreas/repos/everythingpath/sources/pf1-content --candidates <ignored exact-key selection> --out <ignored required-record draft directory>
pnpm -s catalog:curate --system /home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1 --content /home/andreas/repos/everythingpath/sources/pf1-content --candidates <ignored exact-key selection> --records <ignored required-record draft records> --descriptions --out <ignored prose draft directory>
pnpm -s catalog:curate --system /home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1 --content /home/andreas/repos/everythingpath/sources/pf1-content --candidates <ignored exact-key selection> --records scripts/catalog/reviewed-curation.json --descriptions --out <ignored final bounded draft directory>
pnpm -s catalog:preview --system /home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1 --content /home/andreas/repos/everythingpath/sources/pf1-content --candidates <ignored exact-key selection> --out <ignored bounded preview directory>
pnpm -s catalog:preview --system /home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1 --content /home/andreas/repos/everythingpath/sources/pf1-content --out <ignored full preview directory>
pnpm -s catalog:curate --system /home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1 --content /home/andreas/repos/everythingpath/sources/pf1-content --out <ignored full draft directory>
pnpm -s catalog:format --check
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm test tests/catalog convex/catalogSpells523.integration.test.ts --maxWorkers=1
git diff --check
```

| Check | Observed result |
| --- | --- |
| Initial required-record drafter | Exit 0; 1,324 inherited records, zero required candidates/new drafts/replacements/missing/unresolved. |
| Initial separate prose drafter | Exit 0; 43 new optional description drafts, zero replacements; 1,367 records including the 1,324 inherited records. |
| Final exact prose drafter | Exit 0 in 14.054 s; 1,424 records, zero added/replaced, zero required missing/unresolved; 100 checked descriptions and 48 optional unresolved descriptions. |
| Isolated source-fixture parser | Pass; 100 selected roots; required 0, drafted 0, checked-required 0, missing 0; description candidates 100, checked 100, drafted 0; 48 optional unresolved descriptions. Every one of 160 raw fixture YAML hashes matches its pin. |
| Catalog and saved-sheet tests | Pass, exit 0 in 1 min 48.031 s (Vitest 107.55 s); all 1,111 tests and 56 files pass, including 31 batch catalog tests and two saved-sheet tests. |
| Final bounded CLI preview and admission gate | Exit 1 in 10.497 s; 100 entries, zero resources; zero admitted, 77 held, 23 outside-batch reference failures, zero omissions and zero retained exceptions. Required curation passes with 100 checked descriptions and 48 optional unresolved descriptions. None of the selected reference failures occurs in the full-context gate. |
| Final full CLI preview and selected postbinding gate | Exit 1 in 3 min 28.362 s; 23,037 entries and 538 resources; 54 admitted, 23,128 held, two dependent omissions and 4,690 failures elsewhere: 3,584 missing curation records, 715 unaccounted inventory records and 391 reference failures. Fresh public postbinding gate: all 100 selected roots held, zero selected failures/omissions/retained exceptions; 100 current bindings. |
| Full-corpus drafter compatibility | Pass, exit 0 in 3 min 7.965 s; 5,108 records, 3,584 new drafts, zero replacements; required 3,687 = 3,584 drafted + 103 checked, zero missing and 759 diagnosed required mechanics outside this batch. Descriptions: 10,615 candidates, 1,321 checked and 596 optional unresolved. All 100 batch records remain unchanged, with zero new batch drafts. Generated drafts remain scratch-only. |
| Typecheck | Pass, exit 0 in 41.362 s. |
| Lint | Pass, exit 0 in 3 min 1.942 s; no diagnostics. |
| Initial-migration writer check | Pass; all 183 writers accounted for. |
| Catalog pin | Pass; `52f42dd87903d3f6cdc69f576c93fd2788421cb12540b1969727f6aadcfc333b`. |
| Canonical format, notice holds and diff | `pnpm -s catalog:format --check` passes; both notice-hold enforcement tests pass; `git diff --check` passes. |

## Fix-round verification (2026-10-08)

Bolt of Glory and Reveal True Shape now have **held** dispositions and separately named record-level `3.5` policy holds: `spells-523-record-3.5-tag-81QcPhgRcHxjpScn` and `spells-523-record-3.5-tag-91IJiOMgUZ3edBV0` (renamed from `…-policy-open-…` once the policy was decided). The owner has since decided ([#521](https://github.com/AndreasUnunger/EverythingPath/issues/521)/[#522](https://github.com/AndreasUnunger/EverythingPath/issues/522), 2026-10-08) that record-level `3.5` tags are held, never excluded; [the importer contract](README.md) excludes only whole 3.5 packs. Their whole-content and notice holds remain independently unresolved. The inventory, assessments, evidence, report, fixture documentation, provenance and tests agree: **100 held, zero excluded**.

A fresh verified full CLI extraction refreshed all **100 assessment/evidence bindings** and the **132-entry binding fixture**. Two root content fingerprints changed: Protection from Good, Communal and Reveal True Shape, through previously curated Protection from Good and Beast Shape II context. Mapping fingerprints remain unchanged. All 100 evidence fingerprints were refreshed with the fresh catalog artifact hash. Independent comparison checks the selected fixture bodies against actual full CLI bodies, all extraction hashes, all **160 pinned YAML files**, and preservation by identity of all **1,638 non-batch assessments**, **1,617 non-batch evidence records**, **1,424 non-batch overlay records**, all **27 shared Situations**, the Registry and **753 notice holds**. The isolated parser preview was regenerated through the CLI against these byte-verified fixture sources; it intentionally has no recursive Spell parser inputs. The verified full extraction supplies attribution context.

| Fix-round command or check | Result |
| --- | --- |
| Fresh verified full `catalog:preview` and public postbinding admission | CLI exit 1 for existing corpus blockers: 23,037 entries and 538 resources; 54 admitted, 23,128 held, two dependent omissions and 4,690 failures. Public selected gate: zero admitted, 100 held, zero failures/omissions/exceptions; all 100 bindings current. |
| Fresh verified bounded `catalog:preview` | Exit 1: 100 entries, zero resources; 77 held and 23 outside-selection reference failures. |
| Fresh isolated fixture `catalog:preview --allow-unverified-checkouts` | Exit 1: 100 entries, zero resources; 77 held and 23 outside-fixture reference failures. Raw source bytes independently match the pins. |
| Fresh bounded `catalog:curate --records scripts/catalog/reviewed-curation.json --descriptions` | Exit 0: 1,524 records, zero added/replaced, zero missing/unresolved required mechanics, 100 checked descriptions and 48 optional unresolved descriptions. |
| Fresh full-corpus `catalog:curate` | Exit 0: **5,108 records**, 3,584 new drafts, zero replacements/missing; required 3,687 = 3,584 drafted + 103 checked, with 759 diagnosed required mechanics outside this batch. Descriptions: 10,669 candidates and 1,421 checked. Batch records remain unchanged; generated drafts stay uncommitted. |
| `pnpm -s typecheck` | Pass, exit 0 after the refresh. |
| `pnpm -s lint` | Pass, exit 0 with no diagnostics after the refresh. |
| `pnpm test tests/catalog convex/catalogSpells523.integration.test.ts --maxWorkers=1` | Pass, exit 0: 60 files and 1,228 tests in 104.89 seconds, including the batch catalog and saved-sheet tests. |
| Initial-migration writer check | Pass: 183 registrations. |
| `pnpm catalog:pin` | Pass: current `d7a42ca346d875f9497c7da94325022ac289d7931226a3649979a13f410c8063`. |
| `pnpm -s catalog:format --check` and `git diff --check` | Pass. |

Source-taking commands use the same read-only pins and exact ignored 100-key selection as the original commands above. Fix-round output and candidate selections were kept ignored inside the worktree and removed after independent verification and passing checks. No product/importer code or other batch identity changed.

## Original time and workflow

Approximate UTC phase windows: read-in **06:51–06:55 (4 minutes)**, source review/draft **06:54–07:02 (8 minutes)**, artifact/data work **06:59–07:28 (29 minutes)** and checks/report/cleanup **07:02–07:36 (34 minutes)**. These overlap because independent source reviews and artifact work ran concurrently; total elapsed time is about **45 minutes**, finishing around **07:36 UTC**. Ignored batch scratch was removed after recording the results; the final file list and `git diff --check` were checked again.

The final full CLI preview took **3 min 28.362 s** (**07:24:03–approximately 07:27:31**), followed by successful fresh rebinding and canonical checks. The full-corpus drafter passed in **3 min 7.965 s**; final bounded drafter **14.054 s**, bounded preview **10.497 s**, typecheck **41.362 s**, lint **3 min 1.942 s**, and final relevant tests **1 min 48.031 s**. No full `pnpm test` was run.

Workflow corrections were completed before the final gates: one full-preview attempt was interrupted after about **1 min 10 s** to correct Final Sacrifice's Situation label; its next complete run took **6 min 26.203 s**. The initial focused tests passed **32/33**, requiring a truthful attribution-origin assertion. The first combined suite passed **1,110/1,111** in **2 min 42.372 s**, identifying two report corrections that had not yet reached overlay diagnostics. Correcting those diagnostics required regenerating the isolated fixture, a fresh full extraction and fresh attribution bindings because diagnostics are part of imported entry bodies. The final repeated suite passes completely.

The requested Opus/Fable model aliases were unavailable, so subagents used the inherited available model; no UI presentation changes were needed. The main constraints were absent book PDFs, publication chains that compilation notices cannot establish, optional prose beyond the drafter's predicate, and importer omissions that remain outside this curation ticket. The review retained full source descriptions/actions, kept calculations separate from legal holds and used shared Situations without expanding scope. The record-level `3.5` question was left to the owner, who decided on 2026-10-08 to hold such records; no importer repair or accepted alias was invented. Changes remain uncommitted; no GitHub mutation or production action is part of this batch.
