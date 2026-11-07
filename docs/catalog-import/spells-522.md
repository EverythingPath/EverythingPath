# Spell curation review: #522

Reviewed **2026-10-08** by **Sol (AI curator) for the owner**, following [#522](https://github.com/AndreasUnunger/EverythingPath/issues/522), [PRD #251 Decisions 10 and 17 and the acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461), [Spellcasting](../character-sheet/spellcasting.md), [curation](curation.md), and the [#328](races-328.md) and [#521](spells-521.md) precedents.

Exactly **100 ticket keys** receive one disposition: **0 admitted, 100 specifically held, 0 dependently omitted, 0 wholly unsupported/prose-only, 0 excluded**. No Catalog Release was published or activated.

The current full-source public gate reports **100 held and zero batch structure/reference failures**. Bounded extraction reports **77 held and 23 reference failures** because linked definitions outside the 100-key selection are absent; all 23 disappear with full context. Those technical findings are separate from the single disposition per key.

## Evidence and scope

- [Inventory, attribution and mechanics review](../../scripts/catalog/legal/spells-522.json) binds every ordered key to its complete source description, action metadata, raw path and SHA256.
- [Fixture provenance](../../tests/fixtures/spells-522/provenance.json) records 100 root Spells, 27 recursive linked Spell context files and 28 casting-class lookup context files. Context remains unreviewed and is not additional batch admission.
- [Overlay](../../scripts/catalog/reviewed-curation.json), [assessments](../../src/lib/catalog/data/attribution-assessments.json), [evidence](../../src/lib/catalog/data/attribution-evidence.json), and [enforced notice holds](../../scripts/catalog/legal/held-notices.json). Existing shared Situations and all non-batch records are preserved.

The read-only source pins are Foundry PF1 v11.11, `418761d2e16a6037c0156bb4a241f7cea5a2986d`, and pf1-content 11.4.0, `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`. The ordered ticket-key SHA256 is `8f4f3ca33ea2b1c600c32cfb8c7bf1e75bdd44b805622a36cda5f5b42a774b5d`. Fixtures contain **155 parser records**: 100 reviewed roots and 55 explicitly unreviewed context records. Context does not expand the review inventory. No Foundry runtime or configuration was executed or copied.

Permitted PCGen comparison uses commit `25523dbcf10e86c280fc0f447167ea43d67419d3`: [CRB Spell data](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_spells.lst) and [campaign metadata](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/core_rulebook.pcc). Fresh retrieval matches the predecessor's file hashes. All **23 direct CRB roots** have literal full-description comparison lines: **19 normalize equal**, while Mass Inflict Critical Wounds, Beast Shape II, Dictum and Control Water differ. Literal lines, line numbers, hashes and comparison results are retained per candidate. Presentation normalization does not establish whole-content attribution: expanded class/Granted Spell lists, structured actions/materials and inherited origins still lack a complete bound. PCGen's Paizo Inc. notice wording is not declared equivalent to the existing Paizo Publishing, LLC notice. No book PDFs were available; Archives of Nethys was not used.

The [Bestiary 1 ability comparison](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/bestiary/b1_abilities_race.lst#L622) records Froghemoth's All-Around Vision and its immunity to flanking, with publication page 136. This supports the inherited Bestiary notice requirement; it does not bound complete form choices or admit a creature. The pinned Foundry UMR page labelled All-Around Vision instead contains unrelated Amazing Initiative text. That corrupted page remains a source discrepancy, and supplies no invented mechanics or mythic dependency.

Independent comparison confirms **1,324 non-batch overlay records**, **1,538 assessments**, **1,517 evidence rows**, all existing notice-hold rows and the shared Situations are unchanged. No Registry entry, alias, remap or product code is changed.

The resumed audit checked all 155 raw fixture files against the pinned checkout and all 100 roots' description/action metadata without finding mismatches. It completed **14 inherited-context bindings across six candidates** with exact file hashes, immutable source locators and verbatim evidence hashes. A seventh assessment binds the newly recorded Scouring Winds Fly-table evidence. These evidence corrections do not establish complete attribution or clear any hold.

## Attribution and inherited notices

The batch records **45 observed minimum publication identities**. The existing reviewed CRB identity is reused; **44 new notice/notice-chain holds** are registered and enforced. Each candidate also has its own `spells-522-whole-content-<ID>` hold through an unresolved, content-bound Attribution Assessment. These hold names, missing comparisons, evidence identities, source locations and notice requirements are recorded individually in the inventory. Publication codes and existing compilation/title leads establish no complete notice chain or whole-entry coverage.

The inherited-rule review includes specific dependencies rather than a blanket notice set:

- **Beast Shape II**, **Ooze Form III**, **Fey Form III** and **Threefold Face** require Bestiary rules for the abilities they grant. Fey Form III and Mantle of Calm also require **PZO1116** for the pinned Blood Rage rule; Mantle additionally depends on **PZO1129** for bloodrager and skald features. Named fey abilities without verified origins remain explicitly unbounded whole-content evidence.
- **Evolution Surge, Greater** and **Bleed for your Master** require **PZO1115** for eidolon/companion mechanics. **Open Arms** explicitly references APG challenge, judgment and Instant Enemy alongside CRB smite/favored-enemy rules.
- **Rend Body III** needs **PZO1132** for undercasting. **Coin Shot** needs **PZO1118** for firearm bullet attack rules, as well as CRB weapon/material rules. **Debilitating Portent** depends on APG oracle/witch casting and CRB critical-hit rules.
- Linked CRB spells and conditions supply concrete dependencies, including Protection from Evil, Tongues, Scrying, Slow, entangled, paralysis and mind control. Replacement clauses are preserved: Summon Ceustodaemon replaces the inherited creature list; Dream Voyage replaces the emotional mishaps; Fey forms waive verbal and somatic components only, rather than all components.

**Shield Speech, Greater** has a raw record-level `3.5` tag. Under the owner's policy (2026-10-08) such records are held, never excluded; [the importer contract](README.md) excludes only whole 3.5 packs. Its specific hold `spells-522-record-3.5-tag-7y0xvorQBvCtjoYn` names the tag, in the shape #521 and #523 use. It introduces no exclusion rule and does not admit tagged content.

## Every-key disposition

| Exact key | Candidate | Upstream root citation | Contract disposition |
| --- | --- | --- | --- |
| `pf1/6yeorbvt5ysym3nh` | Suffocation, Mass | PZO1115, p. 248 | Specifically held |
| `pf1/6yu1ubq7tvb5xpbi` | Pox of Rumors | PZO1134, p. 222 | Specifically held |
| `pf1/6zga3pc0rqrj24to` | Speak Local Language | PZO9460, p. 31 | Specifically held |
| `pf1/6zv90r375b5ha994` | Delay Pain | PZO1117, p. 216 | Specifically held |
| `pf1/71amq2u3r052h060` | Meticulous Match | PZO1134, p. 220 | Specifically held |
| `pf1/71g6nmvy8qnodwyz` | Protection from Good | PZO1110, p. 328 | Specifically held |
| `pf1/71zeju443zow0t1f` | Inflict Critical Wounds, Mass | PZO1110, p. 300 | Specifically held |
| `pf1/722g8ssc6f2rm3r8` | Memorize Page | PZO1129, p. 187 | Specifically held |
| `pf1/723f51pesdjauhyy` | Blessing of Liberty | PZO9460, p. 22 | Specifically held |
| `pf1/7253kbjniaqgrtim` | Reinvigorating Wind | PZO1136, p. 177 | Specifically held |
| `pf1/72f7xfijqxxm1mtm` | Masochistic Shadow | PZO9466, p. 30 | Specifically held |
| `pf1/73g4cu26ed551wn0` | Sculpted Cape | PZO9481, p. 21 | Specifically held |
| `pf1/73han2zqxg59u18g` | Magic Vestment | PZO1110, p. 310 | Specifically held |
| `pf1/73wog6v19ui2au25` | Assume Appearance | PZO1135, p. 108 | Specifically held |
| `pf1/743anqr1ahefv8zd` | Fox's Cunning | PZO1110, p. 286 | Specifically held |
| `pf1/743rtkqu21azdhah` | Fins to Feet | PZO1121, p. 195 | Specifically held |
| `pf1/7461spd68dipa6m5` | Implant Urge | PZO9292, p. 60 | Specifically held |
| `pf1/74udjqlnkgv8svuv` | Shadow Trap | PZO9466, p. 31 | Specifically held |
| `pf1/759y8xzdg3unvt6s` | Dream Voyage | PZO1132, p. 167 | Specifically held |
| `pf1/75bgl52r3qmp1wh4` | Sacred Bond | PZO1115, p. 240 | Specifically held |
| `pf1/75subr59gf28mk9b` | Poisoned Egg | PZO9267, p. 238; PZO9202, p. 29 | Specifically held |
| `pf1/76flhjqconhe2ty9` | Teleport Object | PZO1110, p. 359 | Specifically held |
| `pf1/76nj2u36i3fr8fpo` | Phantasmal Asphyxiation | PZO1135, p. 123 | Specifically held |
| `pf1/76t09cafayrw13ux` | Antilife Shell | PZO1110, p. 242 | Specifically held |
| `pf1/770nro22rs4fxz7y` | Remove Sickness | PZO1117, p. 234 | Specifically held |
| `pf1/774kmgcb7ygviht0` | Beast Shape II | PZO1110, p. 247 | Specifically held |
| `pf1/77bihy40diufd6p1` | Wall of Suppression | PZO1115, p. 255 | Specifically held |
| `pf1/78imi9hy7dpy7y3c` | Evolution Surge, Greater | PZO1115, p. 220 | Specifically held |
| `pf1/78kwl5t99j9e8tzh` | Hold Person | PZO1110, p. 294 | Specifically held |
| `pf1/790og0jr6gl5uff6` | Minor Reversion, Mass | PZO9492, p. 28 | Specifically held |
| `pf1/7a6gn9ymx9jk9cg6` | Gravity Sphere | PZO9449, p. 28 | Specifically held |
| `pf1/7a95u92t5y8zjwrl` | Ether Step | PZO1141, p. 40 | Specifically held |
| `pf1/7abbj3fik0g8v6ff` | Incendiary Runes | PZO9462, p. 31 | Specifically held |
| `pf1/7aq3g5gcbviba7hq` | Ethereal Envelopment | PZO1132, p. 170 | Specifically held |
| `pf1/7aqcjtnwc0m1h2xy` | Lend Path | PZO1126, p. 114 | Specifically held |
| `pf1/7b04vuc86ivh51tr` | Mage's Lucubration | PZO1110, p. 306 | Specifically held |
| `pf1/7c0l64pfdkgl7j5y` | Illusory Wall | PZO1110, p. 299 | Specifically held |
| `pf1/7c8nufdm0pj4bgep` | Glibness | PZO1110, p. 290 | Specifically held |
| `pf1/7cpk3iq9pirbzd4m` | Energy Siege Shot, Greater | PZO1118, p. 229 | Specifically held |
| `pf1/7d2ro0rt9o57aakm` | Rotting Alliance | PZO9292, p. 61 | Specifically held |
| `pf1/7d4hy2wjuonwjbv0` | Hypnotism, Greater | PZO9473, p. 19 | Specifically held |
| `pf1/7d6sv5ecvi7kho3m` | Fly | PZO1110, p. 284 | Specifically held |
| `pf1/7dj9chib3qeyimdy` | Overwhelming Poison | PZO1134, p. 221 | Specifically held |
| `pf1/7dj9r94gfjvnwh7e` | Bone Flense | PZO1138, p. 160 | Specifically held |
| `pf1/7e22urxux6i2mua5` | Dictum | PZO1110, p. 269 | Specifically held |
| `pf1/7eca6092yc4d9m4l` | Guarding Knowledge | PZO9478, p. 30 | Specifically held |
| `pf1/7ewij1lg4zs9plwn` | Symbol of Mirroring | PZO1117, p. 241 | Specifically held |
| `pf1/7f9tbbxfod3to7yu` | Advanced Scurvy | PZO9055, p. 73 | Specifically held |
| `pf1/7fvsn0gbv6ynlp63` | Slipstream | PZO1115, p. 244 | Specifically held |
| `pf1/7g4aczondf7igvyd` | Unprepared Combatant | PZO1117, p. 246 | Specifically held |
| `pf1/7gfuexp9mi45zkut` | Ooze Form III | PZO1140, p. 234 | Specifically held |
| `pf1/7hakpmv7enojm4jg` | Scouring Winds | PZO1117, p. 236 | Specifically held |
| `pf1/7il67b57towi3o6w` | Fey Form III | PZO1140, p. 230 | Specifically held |
| `pf1/7j5nps3g5afiamvi` | Summon Elemental Steed | PZO9221, p. 61 | Specifically held |
| `pf1/7jqqoorcwq9ro81m` | Lily Pad Stride | PZO1115, p. 232 | Specifically held |
| `pf1/7k5ypftnzy9r7mzz` | Animate Rope | PZO1110, p. 242 | Specifically held |
| `pf1/7ki94ao8u17wnryo` | Soulreaver | PZO9438, p. 15 | Specifically held |
| `pf1/7kil93h63jpy949z` | Blast Barrier | PZO9237, p. 52 | Specifically held |
| `pf1/7kmea4f1sjusdlbl` | Storm of Blades | PZO9441, p. 11 | Specifically held |
| `pf1/7kure93zue8n5mp3` | Rend Body III | PZO9477, p. 10 | Specifically held |
| `pf1/7l7wofgz2iafjsdr` | Plague Storm | PZO1117, p. 231 | Specifically held |
| `pf1/7m5us8d4a9lwh1ap` | Water Breathing | PZO1110, p. 368 | Specifically held |
| `pf1/7mblgh6ywxig05cv` | Semblance of Flesh | PZO9086, p. 75 | Specifically held |
| `pf1/7mm9xz5uiifjkx1p` | Bleed for your Master | PZO1140, p. 227; PZO9429, p. 24 | Specifically held |
| `pf1/7mnhs4rmcv7lo1l6` | Decompose Corpse | PZO1117, p. 216 | Specifically held |
| `pf1/7mstq5c76h3e6zzx` | Time Stop | PZO1110, p. 359 | Specifically held |
| `pf1/7n9f37zey1q24sog` | Dream Shield | PZO9461, p. 28 | Specifically held |
| `pf1/7no45vnykqt1azc8` | Mantle of Calm | PZO1129, p. 186 | Specifically held |
| `pf1/7oelmxa5kdo63erj` | Painful Revelation | PZO9296, p. 63 | Specifically held |
| `pf1/7orkrpa9zag8fuil` | Martial Marionette | PZO9237, p. 58 | Specifically held |
| `pf1/7p0oh9opqbf7j5du` | Unnatural Lust | PZO1117, p. 245 | Specifically held |
| `pf1/7pta0efwxofbk3r1` | Planar Inquiry | PZO1138, p. 125; PZO9465, p. 14 | Specifically held |
| `pf1/7qo2cisa17kxkppx` | Unholy Ice Weapon | PZO1129, p. 198 | Specifically held |
| `pf1/7re5tyxfpphormys` | Holy Ice | PZO1117, p. 223 | Specifically held |
| `pf1/7ro7qm94j4d7bwfd` | Debilitating Portent | PZO1118, p. 227 | Specifically held |
| `pf1/7rx66m98dwo18fy8` | Major Image | PZO1110, p. 314 | Specifically held |
| `pf1/7s7njmjixqkytskw` | Node of Blasting | PZO1132, p. 178 | Specifically held |
| `pf1/7saj33kvf1gpiupy` | Dungeonsight | PZO9434, p. 28 | Specifically held |
| `pf1/7sq6kr3edd8rmy0f` | Summon Ceustodaemon | PZO9239, p. 39 | Specifically held |
| `pf1/7srdoa7d5mjn2zcm` | Threefold Face | PZO9480, p. 25 | Specifically held |
| `pf1/7toeli7vcq5a7tv1` | Finger of Death | PZO1110, p. 282 | Specifically held |
| `pf1/7u45op4znvtkvgv3` | Decrepit Disguise | PZO1132, p. 163 | Specifically held |
| `pf1/7v8j73pa5crrno40` | Life Shield | PZO9444, p. 27 | Specifically held |
| `pf1/7vamkma4y88ek4q6` | Magic Mouth | PZO1110, p. 310 | Specifically held |
| `pf1/7vdlcav97p98hgy5` | Peacebond | PZO1118, p. 238 | Specifically held |
| `pf1/7vppeeqnddx6ugkz` | Extreme Buoyancy | PZO92102, p. 59 | Specifically held |
| `pf1/7vw5g90efkd0zztz` | Scarify | PZO9296, p. 13 | Specifically held |
| `pf1/7vzu76eg8om0gpf0` | Stunning Barrier | PZO1129, p. 194 | Specifically held |
| `pf1/7wcosqq4v4x0bvep` | Sympathy | PZO1110, p. 357 | Specifically held |
| `pf1/7wt5a8gn5wbfplyl` | Disrupt Silence | PZO1134, p. 212 | Specifically held |
| `pf1/7x2z0i8rcx7s81fk` | Daylight | PZO1110, p. 264 | Specifically held |
| `pf1/7xdn59ffjaqchhrz` | Remove Paralysis | PZO1110, p. 332 | Specifically held |
| `pf1/7xrhh9ima7jqtegg` | Soothe Construct | PZO1117, p. 239 | Specifically held |
| `pf1/7y0xvorQBvCtjoYn` | Shield Speech, Greater | PZO9405, p. 25 | Specifically held: record-level 3.5 tag (owner policy, 2026-10-08) |
| `pf1/7y789gjwv5w1kc17` | Guardian Armor | PZO9467, p. 23 | Specifically held |
| `pf1/7yf67b7y4byj96w7` | Control Water | PZO1110, p. 260 | Specifically held |
| `pf1/80f89nrksbofs5vx` | Disguise Other | PZO1117, p. 217 | Specifically held |
| `pf1/80gi4tfa8eor8fo9` | Open Arms | PZO9465, p. 21 | Specifically held |
| `pf1/80ojk5ktyh531ul1` | Coin Shot | PZO9460, p. 30 | Specifically held |
| `pf1/818uuekrao87o57u` | Thorn Body | PZO1115, p. 248 | Specifically held |

## Mechanics and independent gaps

All 100 complete descriptions and structured actions were reviewed. The exact drafter found 0 required note, conditional or Item Ability inputs and 46 optional prose candidates. The overlay checks all 100 descriptions, including descriptions outside that predicate: **114 readable Notes**, no recorded-Spell Modifiers and no permanent proficiency Grants. Running Spell Effects remain distinct from recording a Spell.

The Notes reuse the existing **fear**, **mindAffecting**, **poison** and **grapple** Situations. Narrower predicates remain in the text, including Implant Urge's chosen goal and Dream Shield's sleeping state. Spell resistance possessed by a recipient is not labelled with `spellResistance`, which means checks to overcome it. No shared Situation or alias is added.

Cast-time HP damage/healing, summons' autonomous combat, object hardness/HP, cast/slot consumption, encounter positioning and duration tracking remain manual/prose-only under the PRD. Lend Path's mythic ability/resource transfer is likewise unsupported. Mixed spells separately retain supported ability, skill, save, AC, movement, condition and weapon/routine calculation gaps; these gaps are not recast as legal holds.

The inventory records **23 discrepancy candidates / 28 discrepancies**. Important boundaries include Mass Inflict Critical Wounds' mismatched link label, Debilitating Portent's literal ability-score-versus-modifier ambiguity, Threefold Face's hardcoded 9-minute action duration, the corrupted All-Around Vision page, Sacred Bond's action marked healing despite no direct healing, and Coin Shot's unconditional touch flag and size-scaled dice despite narrower description rules. Source-backed facts stay intact; no guessed repair is applied.

The importer reads `system.types` for descriptors, leaving descriptors empty for **39 roots** whose raw arrays are under `system.descriptors`. **Blast Barrier** and **Coin Shot** also have **four action-note strings** outside the required note drafter's predicate. Their complete raw actions and readable reviewed rules are retained. The inventory and tests pin these gaps and the Greater Shield Speech tag ambiguity. Importer gaps remain reported for the owning work, including #719/#720; product code is unchanged.

**61 candidates / 64 independently outstanding mechanics** remain visible as unresolved description diagnostics. These are not attribution holds. The resumed review also records Scouring Winds' inherited windstorm penalty: **−8 on Fly checks** for creatures affected by its winds, from the pinned Fly wind-effects table (CRB pp. 96–97).

| Spell | Outstanding mechanics |
| --- | --- |
| Suffocation, Mass | Running staggered/unconscious/dying conditions and expiry integration. |
| Pox of Rumors | Conditional -4 secondary Will-save modifier and inherited scrying knowledge/connection Will-save adjustments. |
| Speak Local Language | Running grant of one chosen living regional human language known by the caster. |
| Delay Pain | Temporary suppression of running pain effects and resumption on expiry. |
| Protection from Good | Running alignment-scoped +2 deflection AC/+2 resistance saves, +2 morale control retry, possession/contact immunity. |
| Blessing of Liberty | Running luck CMD/save bonus, scope and capped caster-level scaling; swift speed conversion and remaining-duration calculation. |
| Reinvigorating Wind | Running fascinated/flat-footed removal and confusion/fear/paralysis/slow/stun condition integration. |
| Masochistic Shadow | Running conditional +2/-2 Reflex modifiers by illumination. |
| Sculpted Cape | Conditional cover application from the removed cape. |
| Magic Vestment | Caster-scaled enhancement applied to specific armor/shield rather than recorded Spell. |
| Assume Appearance | Running form-size ability changes and +10 impersonation Disguise, with form-granted abilities suppressed. |
| Fox's Cunning | Running +4 enhancement Intelligence without permanent skill ranks/bonus slots. |
| Fins to Feet | Replace swimming/land movement depending size and immersion. |
| Implant Urge | Conditional -2 saves against mind-affecting effects furthering the chosen urge. |
| Shadow Trap | Running entangled condition. |
| Dream Voyage | Vehicle-scoped running immunity to harmful fear/emotion effects. |
| Phantasmal Asphyxiation | Running staggered/unconscious/shaken condition states. |
| Remove Sickness | Running +4 morale disease/nausea/sickened saves and effect suppression. |
| Beast Shape II | Selected-form size ability/natural armor/senses/movement/natural attack effects. |
| Wall of Suppression | Suppression/resumption of running numeric magic/item effects according to source caster level. |
| Evolution Surge, Greater | Temporary eidolon evolution choice/cost/prerequisite/natural attack limits. |
| Hold Person | Running paralyzed condition. |
| Gravity Sphere | Chosen gravity speed/check/stat modifiers promised by the Distant Worlds page 18 reference but unavailable in pinned text; do not invent numeric defaults. |
| Ether Step | Running ethereal movement/visibility and next-turn action restriction. |
| Ethereal Envelopment | Running unconscious/pinned/grappled conditions and caster-scaled CMB/CMD for escape. |
| Glibness | Running +20 restricted Bluff and caster-scaled anti-truth check. |
| Energy Siege Shot, Greater | Selected cold entangled, electricity staggered, sonic deafened running condition states. |
| Hypnotism, Greater | Running fascinated condition and +2 combat/-2 single-noncombat save modifiers. |
| Fly | Armor/load-scoped 60/40-foot fly speed and caster-scaled Fly skill bonus, good maneuverability. |
| Bone Flense | Running sickened condition while the triggered bleeding persists. |
| Dictum | Running deafened/staggered/paralyzed/helpless condition states. |
| Guarding Knowledge | Chosen exact monster/special-attack +4/+6 insight save bonus with explicit exclusions. |
| Symbol of Mirroring | Running one regenerated mirror image defense associated with each affected creature. |
| Advanced Scurvy | Running fatigued condition and-1 Strength/Dexterity-based checks. |
| Slipstream | Slope-scoped land speed and existing/missing swim speed changes. |
| Unprepared Combatant | Running -4 initiative/Reflex penalties. |
| Ooze Form III | Chosen-form ability scores, replacement movement, natural Attack Routine damage, resistance save bonuses and condition immunities need a selected-form Spell Effect. Inherited grab needs +4 CMB to start/maintain grapple and optional -20 partial-hold penalty, conditioned on a Large/Huge form with grab. |
| Scouring Winds | Inherited windstorm's −8 Fly penalty requires a wind-scoped Spell Effect. Flight checks and checked/blown-away size procedures remain manual. |
| Fey Form III | Chosen-form ability scores, replacement movement, natural attacks, energy resistances, save resistance bonuses and damage reduction need selected-form Spell Effects. Selected-form Blood Rage needs conditional +2 Strength/+2 Constitution/-2 AC, and selected-form grab needs +4 grapple CMB and optional -20 partial-hold checks. |
| Lily Pad Stride | Follower-specific Acrobatics penalties and speed choice need a conditional running effect. |
| Animate Rope | Entangled condition and bound spellcasting concentration-check calculation need a target-linked Spell Effect. |
| Rend Body III | Apply/remove the sickened condition while inherited bleeding persists in a linked Spell Effect. |
| Semblance of Flesh | Target-specific +10 Disguise while using the glamer as a disguise needs a Spell Effect. |
| Bleed for your Master | Size-conditioned +2/+4 Reflex cover bonuses and shaken/frightened conditions need linked Spell Effects. |
| Decompose Corpse | Target-specific -2 on rolls, AC and CMD needs a Spell Effect; every-roll coverage exceeds the individual currently modeled roll targets. |
| Dream Shield | Awake +4 saves vs. sleep and sleeping/unconscious mind-affecting spell resistance 10 + caster level require state-dependent Spell Effects. The inherited possession/control retry uses a +2 morale save bonus while sleeping/unconscious; model it as a local-condition save Modifier on a Spell Effect. |
| Mantle of Calm | Caster -2 attack rolls and opponents’ +2 saves against caster spells require linked Spell Effects. |
| Painful Revelation | Triggered staggered condition requires a linked Spell Effect. |
| Martial Marionette | Recipient’s -2 attacks against the caster and caster’s one-attack +2 AC/+1 Reflex require linked Spell Effects. |
| Unnatural Lust | Recipient’s +4 save when it would not normally desire the designated subject requires a local-condition Spell Effect. |
| Unholy Ice Weapon | Created weapon’s +1 masterwork attack bonus, capped cold-damage rider, susceptible-target damage and returning Item Ability require weapon-targeted Spell Effect/Attack Routine integration. |
| Debilitating Portent | Repeated Will DC depends on caster level and class-specific ability; exact score-versus-modifier expression remains outstanding pending source comparison. |
| Node of Blasting | Triggered staggered condition requires a separate Spell Effect. |
| Threefold Face | Per-face blindness/deafness and condition carryover require linked condition effect state. |
| Stunning Barrier | +1 deflection AC, +1 resistance saves and triggered stunned condition require running Spell Effects. |
| Remove Paralysis | Target-count-specific +4/+2 resistance bonus against the affliction requires a one-save Spell Effect. |
| Control Water | Water-creature slow needs -1 attack/AC/Reflex modifiers, half movement and staggered condition; preserve its shared nonstacking slow Source. |
| Disguise Other | Target-specific +10 Disguise while used as a disguise requires a Spell Effect. |
| Open Arms | Held-weapon- and attacker-specific +5 insight AC/CMD requires a conditional Spell Effect. |
| Coin Shot | Targeted created ammunition’s masterwork attack bonuses, capped damage and material properties require Attack Routine/Spell Effect integration. |
| Thorn Body | Caster’s natural/unarmed Attack Routines need +1d6 piercing while the Spell Effect runs. |

## Demonstration and validation

[Catalog tests](../../tests/catalog/spells-522.test.ts) replay the exact isolated public import, every full-context binding, source changes and notice enforcement. [Saved-sheet tests](../../convex/catalogSpells522.integration.test.ts) exercise Wizard browsing/recording/removal for Fox's Cunning and Fly, real class levels, source metadata, DC/concentration calculations, client/server parity and member/outsider/campaign scoping. Isolated catalog installation does not establish legal admission.

There is **no legally admitted batch output** to demonstrate. These isolated fixtures exercise the retained catalog preview and public consumers while all 100 legal holds remain enforced. No production data or deployment is used, and no Catalog Release is prepared or activated.

The saved Wizard preview starts at level 1 with Intelligence 14: **caster level 1**, **concentration 3**, and **first-level DC 13**. Fox's Cunning is recorded at its real wizard level **2**, and Fly at **3**; higher-level recording stays advisory. Neither recorded Spell applies Intelligence, Fly skill or movement bonuses. Current and permanent abilities and Spell Effects remain equal to their baseline; the client preview matches the saved server calculations and Spell collections. Another campaign member can read, record and remove; outsider and unauthenticated access are refused, and same-organization references using another campaign are refused. A second Character cannot browse or record another Character's fixture catalog.

## Commands and observed results

All source-taking commands use the two read-only pinned checkouts below. Exact selections, logs and temporary test output stay in ignored scratch within this worktree and are removed at completion. The fixture override is used only by reduced fixtures; the pinned CLI runs verify both clean checkouts. No full `pnpm test` is run in this batch.

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
TMPDIR=<ignored worktree test directory> pnpm test tests/catalog convex/catalogSpells522.integration.test.ts --maxWorkers=1
```

| Check | Observed result |
| --- | --- |
| Initial exact prose drafter | Passed: 46 new optional description drafts; 0 missing/unresolved required mechanics. |
| Focused batch tests | Passed before the final Fly-table addition: 20 catalog cases, 1 isolated saved-sheet case and 24 shared-notice regression cases (45 tests). The added Scouring Winds case also passed individually; the final combined run below includes all 22 batch cases. |
| Resumed exact prose drafter | Passed: 100 checked descriptions, 0 new drafts, 0 missing/unresolved required mechanics and 61 independently unresolved descriptions. |
| Full-corpus drafter | Passed (exit 0): 5,008 records, 3,584 new drafts, 0 missing required records and 759 unresolved required mechanics outside this batch. No full-corpus overlay was committed. |
| Bounded public preview | Expected exit 1: 77 held and 23 missing-reference failures caused by out-of-selection context. |
| Full-source public admission after binding refresh | 54 admitted, 23,128 held, 2 dependent omissions, 0 retained exceptions and 4,690 whole-corpus failures. Selected batch: 100 held, 0 admitted, 0 failures; all 100 content/mapping/evidence/notice bindings current. |
| Typecheck | Passed. |
| Lint | Passed; final changed test files also passed ESLint. |
| Canonical data and whitespace | Passed: `catalog:format --check` and `git diff --check`. |
| Writer gate | Passed: 183 registrations checked. |
| Calculation pin | Passed: `sha256:71c66667344e200747085cc47660277a9e7677da10cdd3d58033591444baa25b`. |
| Final catalog and batch suite | Passed: **54 files / 1,039 tests**, including **21 batch catalog cases**, **1 isolated saved-sheet case**, notice-hold enforcement and the 24-case shared-notice regression. |
| Final focused rerun | Passed: **3 files / 46 tests**, after correcting the Fly-table assertion's JSON-union type guard; final typecheck and affected-file ESLint also passed. |

## Workflow and time

The interrupted run's correct inventory, checked records and fixtures were retained after source review. Resumed review corrected inherited-context evidence bindings and added the independently outstanding Scouring Winds calculation. It also corrected a test in [the #272 notice batch](../../tests/catalog/inherited-notices-272.test.ts): its exact hold reason assumed only that batch's hold existed. The test now checks every registered hold resolving to the same notice identity and still requires #272's own hold, with no admission-policy change.

The final typecheck caught the new Fly-table assertion accessing `sources` before narrowing the imported JSON union. A property guard corrected the test typing; its exact CRB citation and penalty assertions were retained and all affected checks were rerun.

Importer gaps remain assigned to the owning import work: 39 empty descriptor lists and four action-note strings outside the required drafter predicate. The record-level `3.5` hold follows the owner's policy (2026-10-08). Complete book evidence and non-universal fey ability origins remain named holds; no notice coverage was invented. Full-corpus failures and unresolved mechanics are reported separately from this batch's zero full-context failures.

Approximate resumed phase time: **3 minutes** reading/recovery, **10 minutes** source/attribution/mechanics audit, **4 minutes** fixture and test review, and **15 minutes** gates/final reporting. These phases overlapped; the interrupted run's earlier phase timings were not retained. Available subagent models did not include the repository's named Opus/Fable models, so delegated reviews used Sol. No UI work was needed.

Batch scratch files were removed after verification. Changes remain uncommitted; no GitHub write, deployment, release publication or activation was performed.
