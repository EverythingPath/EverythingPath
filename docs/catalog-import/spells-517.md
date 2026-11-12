# Spell curation review: #517

Reviewed 2026-10-07 by **Sol (AI curator) for the owner**, following [#517](https://github.com/AndreasUnunger/EverythingPath/issues/517), [PRD #251 Decisions 9, 10 and 17 and the acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461), [Spellcasting](../character-sheet/spellcasting.md), [curation](curation.md), and the [#328 precedent](races-328.md).

Exactly **100 Spell definitions** receive one disposition each: **0 supported/admitted, 100 specifically held, 0 dependently omitted, 0 wholly unsupported/prose-only, and 0 excluded**. Attribution, curation coverage, calculation completeness and reference validity are separate findings. Combat and cast-time procedures may remain prose without making their entire Spell unsupported. No Catalog Release was published or activated.

## Evidence and scope

- Read-only Foundry PF1 v11.11, commit `418761d2e16a6037c0156bb4a241f7cea5a2986d`.
- Read-only pf1-content 11.4.0, commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`.
- [Single batch inventory, attribution evidence and complete mechanics review](../../scripts/catalog/legal/spells-517.json): exact ordered ticket keys, raw file and description hashes, source URLs/book/page fields, minimum notice identities, named holds, full action/metadata review, outstanding calculations and discrepancies.
- [Source-backed fixtures](../../tests/fixtures/spells-517/provenance.json): the interrupted run left 100 Spell roots and 28 unreviewed class-context files. All 128 files matched the pinned checkout bytes and provenance hashes; the missing empty content directory was restored. Context files are not additional reviewed candidates or newly admitted content. The ordered ticket-key digest is `2c1e7fb1757ec29d1032b5b597ea9132edee1dda947594d7cb34e92b2eac2287`.
- [Curation Overlay](../../scripts/catalog/reviewed-curation.json), [Attribution Assessments](../../src/lib/catalog/data/attribution-assessments.json), [evidence](../../src/lib/catalog/data/attribution-evidence.json) and [enforced notice holds](../../scripts/catalog/legal/held-notices.json). Stable rule identities and existing remaps are preserved. Candidate selection stays in ignored scratch and is not committed.

PCGen comparison uses commit `25523dbcf10e86c280fc0f447167ea43d67419d3`, [CRB Spell data](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_spells.lst) and [campaign metadata](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/core_rulebook.pcc). All 19 CRB-root descriptions match their full-description rows after explicitly recorded HTML, UUID-label, case, whitespace and PCGen representation normalization. This is a direct prose comparison only: later class-list/Granted Spell metadata, separate material/action fields and linked origins remain unbounded. PCGen’s Paizo Inc. wording is not asserted equivalent to the existing Paizo Publishing, LLC Registry text. No runtime/configuration module was imported or executed. No book PDFs were available and Archives of Nethys was not used.

The inventory names **46 minimum notice identities**: 43 publication codes, two custom source names and the malformed Languid Venom ID. They are observed leads rather than a complete origin bound. The existing CRB notice identity is reused without new review; **45 notice/notice-chain holds** are registered with every corresponding book and Registry identity. The 100 whole-content comparison holds remain expressed by unresolved assessments; they are distinct from notice holds. Twenty-five roots contain literal linked-content leads, with extraction-retained closures recorded separately. Linked content outside the ticket is not newly reviewed or admitted.

Penumbra cites the custom “Paizo Blog - Ultimate Cantrips” source, and Soothing Word cites “GameMastery Condition Cards”; their names/URLs remain intact and no product-code aliases are guessed. Languid Venom’s `sources[0].id` is the Spell name, with page 218; its prose also cites CRB p. 558. Both the malformed citation and the explicit CRB lead remain recorded. No compilation/title match clears these gaps.

## Every-key disposition

Each row is legally held for the missing complete content comparison and any named notice chain. Technical gate failures are reported independently below. Per-key missing evidence and linked requirements are in the single inventory.

| Exact key | Spell | Upstream root citation | Disposition |
| --- | --- | --- | --- |
| `pf1/184d4mq7yubz2qnq` | Campfire Wall | PZO1115, p. 210 | Specifically held |
| `pf1/18kryvj2dfuymk9d` | Blur | PZO1110, p. 251 | Specifically held |
| `pf1/199pl2cgawz38smh` | Psychic Crush I | PZO1132, p. 182 | Specifically held |
| `pf1/19huaquw6brvm3du` | Necrostasis | PZO9296, p. 42 | Specifically held |
| `pf1/19i23oyn5ysfh633` | Fumblestep | PZO9473, p. 27 | Specifically held |
| `pf1/19p4nr8rsvt42lmn` | Mage's Disjunction | PZO1110, p. 306 | Specifically held |
| `pf1/19u4fiaihfaglw5g` | Dream Feast | PZO9267, p. 232; PZO9002, p. 72 | Specifically held |
| `pf1/1AziQ5GV7j1CnEFw` | Watchful Eye | PZO9408, p. 23 | Specifically held |
| `pf1/1JTFyb8k1Su27txI` | Wing Bounty | PZO1140, p. 14 | Specifically held |
| `pf1/1a4v0ccufso0de5z` | Ear-Piercing Scream | PZO1117, p. 218 | Specifically held |
| `pf1/1anodx7vcxfxhcmi` | Phantom Chariot | PZO1118, p. 239 | Specifically held |
| `pf1/1auvumsqd2a9iiq2` | Serren's Swift Girding | PZO9426, p. 29 | Specifically held |
| `pf1/1b6irvf27vdt5c1l` | Produce Flame | PZO1110, p. 326 | Specifically held |
| `pf1/1b8n86gdmks2q9in` | Baleful Shadow Transmutation | PZO9466, p. 30 | Specifically held |
| `pf1/1bqsr5oxvebfeska` | Litany of Sight | PZO1118, p. 235 | Specifically held |
| `pf1/1brg9wjd0yvttrel` | Echean's Excellent Enclosure | PZO9232, p. 11 | Specifically held |
| `pf1/1btrja5u0cz66cy8` | Blood Mist | PZO1117, p. 209 | Specifically held |
| `pf1/1bu53fq8o187rolx` | Incessant Buzzing | PZO9296, p. 62 | Specifically held |
| `pf1/1c8ads84vzffydyc` | Homeward Bound | PZO1141, p. 41 | Specifically held |
| `pf1/1chgf910tzsusmzv` | Hoodwink | PZO1136, p. 212 | Specifically held |
| `pf1/1ctn7c2mxzb3ggwm` | Selective Alarm | PZO1134, p. 224 | Specifically held |
| `pf1/1deu73tsthfuepk5` | Aspect of the Stag | PZO1115, p. 203 | Specifically held |
| `pf1/1dkzhi78je32sbrr` | Pain Strike, Mass | PZO1115, p. 234 | Specifically held |
| `pf1/1f1a6vb40enjisnq` | Tough Crowd | PZO9465, p. 27 | Specifically held |
| `pf1/1f79cjggrlvclnhd` | Thirsting Entanglement | PZO9480, p. 17 | Specifically held |
| `pf1/1fc03hnuhtih8y6x` | With the Wind | PZO1140, p. 237 | Specifically held |
| `pf1/1fkax61jr972560l` | Create Variant Mummy | PZO9081, p. 73 | Specifically held |
| `pf1/1glxo7x49axmlr9a` | Penumbra | Paizo Blog - Ultimate Cantrips | Specifically held |
| `pf1/1gm2ngzes1xi3zuu` | Lost Passage | PZO9280, p. 220 | Specifically held |
| `pf1/1gz3zdpxu7uic5ky` | Wrathful Mantle | PZO1115, p. 257 | Specifically held |
| `pf1/1hbkqgbjg9rfnw1v` | Instant Summons, Greater | PZO1134, p. 217 | Specifically held |
| `pf1/1hcd5x3l5xzixwid` | Share Language, Communal | PZO1115, p. 243 | Specifically held |
| `pf1/1hcddadfd9cqwbri` | Necromantic Burden | PZO9444, p. 27 | Specifically held |
| `pf1/1hi9dt2pd3mtkm24` | Shadow Claws | PZO1136, p. 81 | Specifically held |
| `pf1/1hjxxr3k62rcpb5c` | Deathwatch | PZO1110, p. 265 | Specifically held |
| `pf1/1i29qf2y7x2fy3q2` | Damnation of Memory | PZO9280, p. 218 | Specifically held |
| `pf1/1i5uea24eq88q1kw` | Transport via Plants | PZO1110, p. 361 | Specifically held |
| `pf1/1i8b1v3dngkxj6jp` | Magic Circle against Evil | PZO1110, p. 308 | Specifically held |
| `pf1/1iufahgx3qwd8cng` | Lead Plating | PZO9432, p. 27 | Specifically held |
| `pf1/1jeheeuzvfy1el9u` | Awaken Construct | PZO1132, p. 158 | Specifically held |
| `pf1/1jqypv1vud6t4edw` | Brand of Tracking | PZO1138, p. 98; PZO9293, p. 60 | Specifically held |
| `pf1/1jvikwzrr06uwtzp` | Garden of Peril | PZO9459, p. 28 | Specifically held |
| `pf1/1k7m5ijomcqacpde` | Medusa's Bane | PZO9472, p. 5 | Specifically held |
| `pf1/1kwmd162fumjm5bj` | Fester, Mass | PZO1115, p. 221 | Specifically held |
| `pf1/1m5rpvirt48brv71` | Symbol of Persuasion | PZO1110, p. 356 | Specifically held |
| `pf1/1mc2b6d2aw6kkna0` | Shield Companion (ACG) | PZO1129, p. 191 | Specifically held |
| `pf1/1mi4y3g4n8adtfl3` | Antipathy | PZO1110, p. 243 | Specifically held |
| `pf1/1mkigzpu5hohovgw` | Wind Walk | PZO1110, p. 369 | Specifically held |
| `pf1/1moeejp3mch70ys5` | Ball Lightning | PZO1115, p. 204 | Specifically held |
| `pf1/1msv71n204g06fbe` | Explosion of Rot | PZO1140, p. 229; PZO9443, p. 25 | Specifically held |
| `pf1/1n1q5cbu2tz9nqui` | Locate Weakness | PZO1118, p. 236 | Specifically held |
| `pf1/1n5lzg61yjkv64wa` | Handy Grapnel | PZO1134, p. 215 | Specifically held |
| `pf1/1okm1u6ig4mws6ue` | Bouncy Body | PZO1130, p. 105 | Specifically held |
| `pf1/1os71jpk7lrrl47b` | Song of Discord | PZO1110, p. 345 | Specifically held |
| `pf1/1p5efnjtbuf2qzb0` | Rite of Centered Mind | PZO9472, p. 13 | Specifically held |
| `pf1/1pmo56iws82w3870` | Theft Ward | PZO1121, p. 167 | Specifically held |
| `pf1/1qfqg1dn4m76qytu` | Secret Vault | PZO9462, p. 31 | Specifically held |
| `pf1/1rhpxleafu8mi5yu` | Snake Staff | PZO1115, p. 245 | Specifically held |
| `pf1/1rl77z8qja3ylbi6` | Repress Memory | PZO1132, p. 184 | Specifically held |
| `pf1/1rs0oxaaovfz8etv` | Reckless Infatuation | PZO1117, p. 234 | Specifically held |
| `pf1/1rt2lg6tt2kms0z0` | Languid Venom | Languid Venom, p. 218 | Specifically held |
| `pf1/1sqn0o52wldmsv3b` | Death Knell Aura, Greater | PZO1139, p. 38 | Specifically held |
| `pf1/1tpm2xczywufi3r8` | Selective Invisibility | PZO9459, p. 31 | Specifically held |
| `pf1/1u9bbze5lx7hhbmf` | Unlock Flesh | PZO1021, p. 453 | Specifically held |
| `pf1/1ulrw5cgqkyn1ix8` | Holy Ice Weapon | PZO1129, p. 185 | Specifically held |
| `pf1/1vadmtj0udm1lszu` | Burst with Light | PZO9437, p. 26 | Specifically held |
| `pf1/1vh2ewwvzvxunoxk` | Protection from Energy | PZO1110, p. 327 | Specifically held |
| `pf1/1wnzvfrpl2gp829u` | Burning Gaze | PZO1115, p. 208 | Specifically held |
| `pf1/1wzevbmg7e87sc3p` | Diminished Detection | PZO9292, p. 59 | Specifically held |
| `pf1/1x9wrynd3mrc1dsr` | Righteous Blood | PZO9437, p. 27 | Specifically held |
| `pf1/1ynz09dpvh57m7t5` | Crimson Breath | PZO1138, p. 160 | Specifically held |
| `pf1/1yt3bidqyhkdf6a1` | Malfunction | PZO1117, p. 228 | Specifically held |
| `pf1/1yy070vempzgwz6g` | Restore Eidolon, Lesser | PZO1117, p. 235 | Specifically held |
| `pf1/1ziz3r5a1gzd1jw2` | Nap Stack | PZO1115, p. 233 | Specifically held |
| `pf1/1zmn8vqy3s5l9kiv` | Summon Monster III | PZO1110, p. 352 | Specifically held |
| `pf1/1zrd29ckubta8s8z` | Soothing Word | GameMastery Condition Cards | Specifically held |
| `pf1/1zyixa5b6aw7npub` | Crushing Hand | PZO1110, p. 262 | Specifically held |
| `pf1/217mso78laewj0ky` | Plant Voice | PZO9457, p. 21 | Specifically held |
| `pf1/21afuykelojyguty` | Firebelly | PZO9267, p. 234; PZO9062, p. 75 | Specifically held |
| `pf1/21bxbzdaawjrnvyo` | Divine Favor | PZO1110, p. 273 | Specifically held |
| `pf1/21ksduh3fm41vmjk` | Prying Eyes, Greater | PZO1110, p. 326 | Specifically held |
| `pf1/21r9ptvsjo99o3yw` | Demand | PZO1110, p. 265 | Specifically held |
| `pf1/21yha04trfhj0ehd` | Psychic Surgery | PZO1132, p. 183 | Specifically held |
| `pf1/22crdpotg36vglq6` | Submerge Ship | PZO9056, p. 70 | Specifically held |
| `pf1/22cynh2gt4icqsqt` | Nondetection, Communal | PZO1118, p. 238 | Specifically held |
| `pf1/22x4iooz3c3vqof9` | Virtue | PZO1110, p. 365 | Specifically held |
| `pf1/22xn589bmr7ginow` | Defensive Shock | PZO1117, p. 216 | Specifically held |
| `pf1/23pgt0f34obki95q` | Feast of Ashes | PZO1115, p. 220 | Specifically held |
| `pf1/24zg8a05hqum3e6j` | Mending | PZO1110, p. 312 | Specifically held |
| `pf1/25bv1s6jwr8imm1o` | Insect Spies | PZO1134, p. 217 | Specifically held |
| `pf1/25ey7spdaj72yioz` | Martyr's Bargain | PZO9237, p. 58 | Specifically held |
| `pf1/25h8dvaeuqhgcezo` | Nature's Ravages, Greater | PZO9430, p. 31 | Specifically held |
| `pf1/25iy235izs71qlns` | Swarm Skin | PZO1115, p. 248 | Specifically held |
| `pf1/260y4g7beqkf8ppi` | Enemy Insight | PZO1129, p. 181 | Specifically held |
| `pf1/26d575hwkhmftrbw` | Fungal Infestation | PZO1117, p. 221 | Specifically held |
| `pf1/26g4tysnax570dxo` | Vocal Alteration | PZO1117, p. 248 | Specifically held |
| `pf1/26vm5jhjkxpq1xm3` | Summon Monster II | PZO1110, p. 352 | Specifically held |
| `pf1/26x41q3v0vhz8va0` | Lucky Number | PZO9269, p. 50 | Specifically held |
| `pf1/272szq5d556toqgc` | Blessing of Courage and Life | PZO1115, p. 205 | Specifically held |
| `pf1/27c1lt6aws5f63yk` | Bloodhound | PZO1115, p. 206 | Specifically held |

## Mechanics review

The bounded drafter’s separate description pass selected **36 optional description candidates** and no required note/action-conditional/Item Ability inputs. The review independently read every full description and all action/metadata fields, adding **100 checked description records with 115 readable Notes**. The other 64 descriptions are explicitly reviewed even though the drafter’s wording predicate would not select them. The final overlay adds no numeric Modifiers or shared-effect Sources; recording a Spell never applies its running Spell Effect. Spell school, subschools, descriptors, class-tag levels and Granted Spell metadata are preserved. Grant schedules remain the responsibility of their owning class-feature batches; this batch invents no schedules, prerequisites or proficiency Grants. Component/ritual/target restrictions stay prose.

Existing shared Situations are reused only at matching scope, including `grapple`, `mindAffecting`, `fear` and `death`. Bouncy Body’s CMB/CMD Notes use `grapple`; Bloodhound’s smell/tracking/odor rules have exact local circumstances. Tough Crowd uses the local next-enchantment-or-illusion-**spell** circumstance because the shared effect categories are broader. No new shared aliases or implicit spell/effect/category equivalence is asserted.

**28 Spells name 28 outstanding calculation tasks**, separately from legal holds. Their optional descriptions retain explicit unresolved diagnostics, without failing the required-record gate. Rolls, damage/healing procedures, summon/entity statistics, map movement, durations, preparation, poison onset and dialogue remain inert under the consuming feature contract. The following tasks concern separate Spell Effects, targeted item properties or observer-dependent statistics; checked Notes do not supply them.

| Exact key / Spell | Outstanding calculation |
| --- | --- |
| `pf1/199pl2cgawz38smh` Psychic Crush I | The conditional +4 circumstance Fortitude bonus while above half hit points requires a separately targeted, situational Spell Effect; sequential save/damage resolution stays prose. |
| `pf1/19i23oyn5ysfh633` Fumblestep | Reflex −1 and Acrobatics −1 require a separately reviewed Spell Effect; the discharged trip procedure stays prose. |
| `pf1/1AziQ5GV7j1CnEFw` Watchful Eye | Shield Other’s inherited +1 deflection AC and +1 resistance saves require a separate Spell Effect; line-of-effect and redirected wounds remain prose. |
| `pf1/1b8n86gdmks2q9in` Baleful Shadow Transmutation | Environment-scoped +4 saves require a separate Spell Effect; form-dependent scores, lost abilities and casting need a selected polymorph form and cannot be inferred from the recorded Spell. |
| `pf1/1chgf910tzsusmzv` Hoodwink | Half-speed and automatic Perception failure require effect-specific support; attack concealment and path memory remain prose. |
| `pf1/1deu73tsthfuepk5` Aspect of the Stag | Attack-of-opportunity AC +2 dodge requires a separate situational Spell Effect; +20 feet movement and form-granted antler attacks are not structured by this Spell import. |
| `pf1/1f1a6vb40enjisnq` Tough Crowd | Next-spell +4 insight saves against enchantment or illusion need a separate consumable Spell Effect and exact spell-only Situation; social influence DC increases remain prose. |
| `pf1/1gm2ngzes1xi3zuu` Lost Passage | Survival penalty −2 × caster level and Dexterity −4 require a separate Spell Effect with failed-save/area state; terrain changes stay prose. |
| `pf1/1gz3zdpxu7uic5ky` Wrathful Mantle | Resistance save bonus +1 per four caster levels, capped +5, requires a separate Spell Effect; dismissing it for force damage stays prose. |
| `pf1/1hi9dt2pd3mtkm24` Shadow Claws | Two primary form-granted claws need separately reviewed effect/attack definitions; Strength damage and its Fortitude save remain combat prose. |
| `pf1/1i8b1v3dngkxj6jp` Magic Circle against Evil | Inherited Protection from Evil deflection AC +2 and resistance saves +2 against evil creatures, plus the +2 morale retry against evil-created mental control, require a separate effect with exact scope and shared stacking origin; protection and trapping procedures remain prose. |
| `pf1/1mc2b6d2aw6kkna0` Shield Companion (ACG) | Companion-only +1 deflection AC and +1 resistance saves require a separate Spell Effect on the companion; immediate damage transfer remains prose. |
| `pf1/1mi4y3g4n8adtfl3` Antipathy | Dexterity −4 on a successful save requires a separately targeted Spell Effect, not an effect granted by the recorded Spell. |
| `pf1/1mkigzpu5hohovgw` Wind Walk | Inherited Gaseous Form numeric armor suppression and Dexterity/AC interactions need a separately reviewed form effect; alternate movement and transformation timing remain prose. |
| `pf1/1moeejp3mch70ys5` Ball Lightning | Metal-armor-scoped Reflex −4 requires a separate targeted conditional effect if represented on the sheet; globe direction and damage stay prose. |
| `pf1/1msv71n204g06fbe` Explosion of Rot | Plant-creature-scoped Reflex −2 requires a separately targeted conditional effect; additional damage per die and staggered resolution stay prose. |
| `pf1/1okm1u6ig4mws6ue` Bouncy Body | Grapple CMB +2, grapple-only CMD +2 and Escape Artist +2 circumstance need a separate Spell Effect; falling and bouncing remain prose. |
| `pf1/1p5efnjtbuf2qzb0` Rite of Centered Mind | Mind-affecting +1 resistance, fear/emotion +2 and reroll +2 require a separately reviewed Spell Effect with exact Situations; one-use reroll remains prose. |
| `pf1/1pmo56iws82w3870` Theft Ward | Object-specific theft-noticing Perception +10 requires a separate Spell Effect with the warded-object choice. |
| `pf1/1sqn0o52wldmsv3b` Death Knell Aura, Greater | Inherited Death Knell Aura/Death Knell Strength enhancement, caster-level and temporary-hit-point effects require a separate Spell Effect and triggering state; bleed and spirit damage remain prose. |
| `pf1/1ulrw5cgqkyn1ix8` Holy Ice Weapon | Created masterwork weapon and cold damage capped +10 require separate Spell Effect/weapon definitions with an explicit weapon choice; holy-water and Returning behavior remain prose. |
| `pf1/21bxbzdaawjrnvyo` Divine Favor | Luck attack and weapon-damage bonuses floor(caster level / 3), minimum +1 and maximum +3, require a separate Spell Effect and weapon-only damage scope. |
| `pf1/22x4iooz3c3vqof9` Virtue | The 1 temporary hit point requires a separate Spell Effect/temporary-hit-point state; it must never be treated as an increase to maximum hit points. |
| `pf1/260y4g7beqkf8ppi` Enemy Insight | Half the caster’s chosen favored-enemy bonus requires a separate Spell Effect recording that external value and creature-type choice; no link to the caster’s sheet is inferred. |
| `pf1/26g4tysnax570dxo` Vocal Alteration | Listener-scoped Disguise +10 requires a separate Spell Effect with its exact local Situation. |
| `pf1/26x41q3v0vhz8va0` Lucky Number | The one-use +2 luck result bonus requires result/trigger support for the recorded lucky number; an always-active attack/save/skill Modifier is incorrect. |
| `pf1/272szq5d556toqgc` Blessing of Courage and Life | Fear and death +2 morale saves require a separate Spell Effect and shared fear/death Situations; swift healing and bonus removal remain prose. |
| `pf1/27c1lt6aws5f63yk` Bloodhound | Smell-only Perception +8 and scent-tracking Survival +4 competence, plus odor-only saves −4, require a separate Spell Effect; scent and poison detection remain prose. |

## Source discrepancies and review boundaries

The review records 14 observations across 12 candidates. It preserves the full upstream fields and explains ambiguity without guessing a resolution or changing the importer.

| Spell | Observed source boundary |
| --- | --- |
| Campfire Wall | Description spells “blocks” as “bocks”; readable Note corrects this typo without changing mechanics. |
| Psychic Crush I | Action save.type is Fortitude although full resolution begins with Will and may then require Fortitude; save.description retains both. |
| Produce Flame | Melee action explicitly chooses Dexterity for attack while prose specifies a melee touch attack without that override; no Dexterity substitution is curated. |
| Aspect of the Stag | Prose calls 19–20/×2 a “critical multiplier”; Note preserves the evident threat range and multiplier notation without introducing new values. |
| Lost Passage | Action duration is 2 hours/caster level, while failed-save difficult-terrain consequences explicitly persist 1 hour/caster level after leaving; these different durations are preserved. |
| Awaken Construct | materials.gpValue is null; prose gives the variable 2,000 gp per target Hit Die cost, so no fixed zero cost is inferred. |
| Fester, Mass | Action template is a 15-foot circle although its stated target is multiple creatures separated by at most 30 feet; no burst area is curated. |
| Ball Lightning | Damage Only action.save.description says “Reflex half”; full description and Use action say Reflex negates. Description controls the Note. |
| Ball Lightning | Use action contains attackBonus 100[Ignore Attack Roll] and extra-attack count formula as Foundry automation; neither is a Character Modifier or a new spell attack rule. |
| Secret Vault | Action duration repeats Secret Chest’s 60 days or until discharged, while variant prose places cumulative loss risk after 360 days. No unverified resolution of this inherited-duration ambiguity is invented. |
| Languid Venom | sources[0].id is “Languid Venom” rather than a product code; pages 218 and the body’s CRB 558 reference are retained, never guessed as a book identity. |
| Burst with Light | Action duration is floor(@cl / 4), with no maximum, while prose says another round per four character levels, maximum 5 at 20th; caster versus character level and initial/additional-round wording remain unresolved source discrepancies. |
| Burst with Light | Action save has description “see text” and no type; prose requires target Will and collateral Reflex saves. |
| Crimson Breath | Action is typed spellsave and omits the ranged-touch attack required in prose; readable Note preserves both attack and Fortitude poison save. |

## Public-boundary demonstration

There is no newly admitted Spell to demonstrate. The ticket’s admitted-content demonstration therefore remains limited by the documented legal holds. [Catalog tests](../../tests/catalog/spells-517.test.ts), the [isolated saved-sheet integration](../../convex/catalogSpells517.integration.test.ts), and the [fixture preview](../../tests/fixtures/spells-517/preview.json) prove technical behavior only. Fixture-only accepted assessments and Character-owned test definitions do not establish shipping attribution, clear notice holds or publish a Catalog Release.

The public resolver preserves the real class levels and metadata for Divine Favor, Virtue, Blur and Protection from Energy while recording them grants no numeric effects. Source assertions pin Divine Favor’s +1-per-three-caster-level luck, minimum +1/maximum +3 and weapon-only damage; Blur’s 20% miss chance; Protection from Energy’s 12/level absorption capped at 120; and Virtue’s 1 temporary HP. Isolated public browse/record/read/remove flows use Oracle’s editable known collection and Wizard’s Spellbook, preserve association and explicit level, permit shared-member editing, reject outsiders and match client/server projections. A separately recorded Character-owned running Divine Favor effect uses its published minimum +1 luck and distinguishes current from permanent calculations. This is a test of the existing effect writer, not curation of an out-of-inventory imported effect.

## Commands and observed gates

The reviewed commands use the read-only source paths below. `TMPDIR` is worktree-local; the selector and generated command reports are ignored scratch, never committed or linked as durable evidence. No environment files or private E2E inputs were accessed.

```sh
export PF1_CURATION_SYSTEM=/home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1
export PF1_CURATION_CONTENT=/home/andreas/repos/everythingpath/sources/pf1-content
export TMPDIR="$PWD/.scratch/curation-517/tmproot"
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/curation-517/candidates.json --descriptions --out .scratch/curation-517/drafts
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/curation-517/candidates.json --descriptions --out .scratch/curation-517/final-drafts
pnpm -s catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/curation-517/candidates.json --out .scratch/curation-517/bounded-preview
pnpm -s catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-517/full-preview
pnpm -s catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-517/full-final-preview
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-517/full-drafts
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm test tests/catalog/spells-517.test.ts convex/catalogSpells517.integration.test.ts
pnpm test tests/catalog convex/catalogSpells517.integration.test.ts --maxWorkers=1
pnpm -s catalog:format --check
git diff --check
```

Both exact checkout commits and manifest versions are verified, without an unverified override. The final bounded resume adds/replaces nothing, has zero missing/stale/unresolved required mechanics, and reports 100 checked optional descriptions with 28 unresolved optional descriptions. Bounded inventory coverage is complete: 100 in-scope Spells, zero excluded and zero unassigned. Its admission/reference gate exits 1: **0 admitted, 75 held, 25 reference failures**. Every failing bounded root links outside the selection; the full import resolves these links. The editorial inventory still gives all 100 one legal disposition. No outside linked input is admitted or removed to make the bounded gate pass.

The final complete gate exits 1 with **23,037 entries, 538 supporting resources, 52 admitted candidates, 23,130 held, two dependent omissions, zero retained exceptions and 4,734 failures**. All 100 batch roots are held with zero full-import reference failures. The failures belong outside the ticket: 3,628 missing curation records, 715 unaccounted inventory records and 391 broken-reference failures. Neither global dependent omission is a batch disposition. This report does not claim whole-corpus coverage or release readiness. No admitted notice requirement is outstanding.

Complete required curation is **100 checked of 3,728, with 3,628 missing**. The complete optional prose inventory contains **10,204 candidates and 420 checked descriptions**. The batch’s required coverage is complete, while optional unresolved descriptions retain the separately named effect work.

Full extraction fingerprint: `22db524bc7d6110e5de7ec442d1f1b853bb7b724b7857b829ca9d6a90a2d3d90`. Reviewed-input fingerprint: `913b7528c76918bb1fff769ea030ef0d0089f03ec7477b22ae207849925f6395`. Legal-resource fingerprint: `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e`. Final full admission-report SHA-256: `a3a4a9860795419fcc8d6ca45292a11a58bee1e6faca70555cc61fa50adbbc43`; bounded report SHA-256: `5a28250e9b11b2bf72a0a9a832952e9c0104683a334b7b32ec718653c8307415`. These identify local verification evidence without release publication.

The full-corpus drafter exits 0, producing **4,148 records, 3,628 new drafts, zero replacements, zero missing bindings and 763 unresolved required mechanics** in ignored scratch. Its required summary is 3,728 inputs: 100 checked and 3,628 drafted. Those generated drafts are not copied to the reviewed overlay. This demonstrates full-corpus tooling compatibility without asserting completed corpus review.

| Check | Final observed result |
| --- | --- |
| Pinned source verification | Both exact commits/manifests verified, no override |
| Initial bounded draft and separate description pass | Exit 0: 36 new optional descriptions, no required records |
| Final bounded checked description resume | Exit 0: zero added/replaced/missing/stale; 100 checked descriptions, 28 unresolved optional descriptions |
| Bounded import/required curation | Pass: exactly 100 accounted, no excluded/unassigned inputs, no missing required mechanics |
| Bounded admission/reference gate | Exit 1: 0 admitted, 75 held, 25 out-of-selection reference failures |
| Complete import/admission gate | Exit 1: 52 admitted, 23,130 held, two outside-batch dependent omissions, 4,734 outside-batch failures; batch 100 held/zero failures |
| Full-corpus drafter | Exit 0: 4,148 records, 3,628 new, 763 unresolved required mechanics; generated drafts stay in scratch |
| `pnpm -s typecheck` | Pass on finished files, 104 seconds |
| `pnpm -s lint` | Pass on finished files, 122 seconds |
| `pnpm -s check:initial-migration-writers` | Pass: 183 registered writers |
| `pnpm catalog:pin` | Pass: `sha256:71c66667344e200747085cc47660277a9e7677da10cdd3d58033591444baa25b` |
| Focused batch catalog/saved-sheet tests | Pass: 2 files, 13 tests (11 catalog, two Convex), 5.99 seconds |
| Initial combined catalog/batch suite | Exit 1: 485/487 tests; two new fixture/setup expectations corrected, 55.20 seconds |
| Final combined catalog/batch suite | Pass: 33 files, 487 tests, 51.53 seconds; one worker |
| Canonical serializer and prior-object audit | Pass: all 420 prior overlay records, 640 assessments, 614 evidence records and 172 holds preserved; all 61 Registry records and shared Situations unchanged |
| `git diff --check` | Pass |

The full suite is deliberately left to the orchestrator’s post-rebase landing gate. No test timeout was changed. No product or importer code was modified. The catalog suite’s existing files all passed in the initial run as well.

## Timing and workflow observations

Approximate overlapping phase windows on 2026-10-07 (UTC):

| Phase | Window | Elapsed |
| --- | --- | --- |
| Brief, contracts, precedent and exact selector | About 20:33–20:35 | About 2–3 minutes |
| Complete source/mechanics review and overlay | 20:35–20:42 | About 7 minutes |
| Attribution/PCGen review, integration and final bindings | 20:35–20:48 | About 13 minutes, including preview wait |
| Fixture recovery, test authoring and corrections | 20:35–20:53 | About 18 minutes |
| Checks, full-source gates, report and cleanup | 20:36–21:06 | About 30 minutes, overlapping reviews |

Total elapsed time was approximately 20:33–21:06 UTC, about 33 minutes. These windows overlap and are not additive labor estimates. Final serial check durations were typecheck 104 seconds, lint 122 seconds, bounded resume 8 seconds, complete preview 181 seconds, complete drafter 231 seconds and combined tests 51.53 seconds.

The main Sol session independently sampled ten complete raw descriptions/actions and resulting Notes: Aspect of the Stag, Bloodhound, Bouncy Body, Divine Favor, Enemy Insight, Locate Weakness, Medusa’s Bane, Protection from Energy, Tough Crowd and Virtue. It found no unsourced numerical additions and checked all exact keys, prior-object preservation, overlay hashes and final assessment/inventory bindings. Tests pin every root/context source hash and every root’s full metadata/actions.

The interrupted worktree held correct source fixtures but no completed batch review. Those fixtures were retained after byte comparison, and their missing empty content directory was restored with a tracked placeholder. The drafter’s description predicate selected only 36 roots; explicit complete-description records cover the other 64 without changing the importer. Bounded selection omits 30 unique linked definitions across 25 roots; complete preview resolves every batch reference. No outside definition was admitted to conceal bounded failures.

An initial lint pass ran while test imports/artifacts were still being written; it caught incomplete imports and a coalescing operator issue. The post-fixture typecheck then found two test typing issues, corrected with the generated Convex ID type and strict Modifier parsing. Initial combined tests found that Oracle is not a representative seed and the shipping APG product-code alias is absent. The final fixtures use parsed pinned Oracle context with the existing reviewed casting table, and an explicitly in-memory APG alias to reach the hold check. Neither is shipping class admission or notice coverage. All final checks on the finished files pass except the documented bounded/full admission/reference results.

The repository’s Opus/Fable aliases are unavailable in this environment; code changes were delegated with the available inherited model. The orchestrator’s separate sampled Fable review remains a landing step. Missing book evidence, later class-list/Granted Spell origins and malformed/custom citations remain named attribution gaps. The 28 effect calculations remain independently outstanding. Importer gaps belong to their existing owning work, including #719/#720; none was patched here.

The batch adds 100 checked overlay records, 100 unresolved Attribution Assessments, 100 evidence records and 45 enforced notice holds. Changed files are the four shared overlay/assessment/evidence/hold files, the single batch legal inventory, this report, the two batch test files, and source/preview/helper fixtures under `tests/fixtures/spells-517/`. The Section 15 Registry remains unchanged. All changes remain uncommitted; no GitHub issue/PR was changed, no release was published and nothing was deployed.

Task-local scratch, candidate selectors, draft/preview reports and test work directories were removed after recording the results. The launcher captures the final response at its `-o` path; no answer file is created in the repository.

## Wave CL6 launch re-assessment

Wave CL6 (#517, #519 and #520) re-assesses Campfire Wall, Ear-Piercing Scream, Aspect of the Stag, Pain Strike, Mass, Antipathy, Ball Lightning, Locate Weakness, Snake Staff, Burning Gaze, Nap Stack, Virtue, Mending, Summon Monster II, Blessing of Courage and Life, Bloodhound in place: 15 class-list-only Spell(s) held only on their whole-content hold; 15 admitted. The batch's other 85 candidates keep their earlier review and holds. Reviewer: Opus (AI curator) for the owner, 2026-11-09.

| Key | Name | Role | Outcome | Required notices | Comparison | Granted-level mappings |
| --- | --- | --- | --- | --- | --- | --- |
| `pf1/184d4mq7yubz2qnq` | Campfire Wall | root | confirmed; admitted | PZO1115, PZO1110, PZO1131 | `apg_spells.lst:1888` / `:58`, 0 word differences | — |
| `pf1/1a4v0ccufso0de5z` | Ear-Piercing Scream | root | confirmed; admitted | PZO1117, PZO1110, PZO1131 | `um_spells.lst:87` / `:87`, 0 word differences | — |
| `pf1/1deu73tsthfuepk5` | Aspect of the Stag | root | confirmed; admitted | PZO1115, PZO1110, PZO1131 | `apg_spells.lst:1854` / `:29`, 0 word differences | — |
| `pf1/1dkzhi78je32sbrr` | Pain Strike, Mass | root | confirmed; admitted | PZO1115, PZO1110, PZO1131 | `apg_spells.lst:2017` / `:175`, 0 word differences | — |
| `pf1/1mi4y3g4n8adtfl3` | Antipathy | root | confirmed; admitted | PZO1110, PZO1131 | `cr_spells.lst:794` / `:29`, 0 word differences | — |
| `pf1/1moeejp3mch70ys5` | Ball Lightning | root | confirmed; admitted | PZO1115, PZO1110, PZO1131 | `apg_spells.lst:1859` / `:32`, 0 word differences | — |
| `pf1/1n1q5cbu2tz9nqui` | Locate Weakness | root | confirmed; admitted | PZO1118, PZO1110, PZO1131 | `uc_spells.lst:80` / `:80`, 0 word differences | — |
| `pf1/1rhpxleafu8mi5yu` | Snake Staff | root | confirmed; admitted | PZO1115, PZO1110, PZO1112, PZO1131 | `apg_spells.lst:2067` / `:223`, 1 word differences | — |
| `pf1/1wnzvfrpl2gp829u` | Burning Gaze | root | confirmed; admitted | PZO1115, PZO1110, PZO1131 | `apg_spells.lst:1880` / `:52`, 0 word differences | — |
| `pf1/1ziz3r5a1gzd1jw2` | Nap Stack | root | confirmed; admitted | PZO1115, PZO1110, PZO1131 | `apg_spells.lst:2008` / `:169`, 0 word differences | — |
| `pf1/22x4iooz3c3vqof9` | Virtue | root | confirmed; admitted | PZO1110, PZO1131 | `cr_spells.lst:1403` / `:655`, 0 word differences | — |
| `pf1/24zg8a05hqum3e6j` | Mending | root | confirmed; admitted | PZO1110, PZO1131 | `cr_spells.lst:1146` / `:392`, 0 word differences | — |
| `pf1/26vm5jhjkxpq1xm3` | Summon Monster II | root | confirmed; admitted | PZO1110, PZO1112, PZO1131 | `cr_spells.lst:1336` / `:586`, 0 word differences | — |
| `pf1/272szq5d556toqgc` | Blessing of Courage and Life | root | confirmed; admitted | PZO1115, PZO1110, PZO1131 | `apg_spells.lst:1865` / `:38`, 0 word differences | — |
| `pf1/27c1lt6aws5f63yk` | Bloodhound | root | confirmed; admitted | PZO1115, PZO1110, PZO1112, PZO1131 | `apg_spells.lst:1869` / `:42`, 0 word differences | — |

**Readings recorded in `launchReview`** (each is recorded, not resolved; the pinned text stays verbatim):

- **Pain Strike, Mass.** It works like pain strike (#533, re-assessed and admitted in this run), an Advanced Player's Guide spell (PZO1115, required); pain strike's granted-level mapping book (PZO9267) is spell-list metadata and does not propagate (wave F2, decision 3). PCGen names the spell "Pain Strike (Mass)" (notation). Metadata: Descriptors: Foundry also lists pain, which PCGen's base row DESCRIPTOR:Evil does not; recorded, not resolved.
- **Antipathy.** Metadata: Descriptors: Foundry also lists emotion, which PCGen's base row DESCRIPTOR:Mind-Affecting does not; recorded, not resolved. Dismissal: PCGen's base row DURATION:(CASTERLEVEL*2) hours [D] marks the duration dismissible ([D]), but Foundry's duration has no dismiss flag; recorded, not resolved, and the pinned duration stays.
- **Snake Staff.** Wording: PCGen's full row ends with the pointer "Snake statistics can be found on page 255 of the Pathfinder Bestiary. Details on the advanced and giant simple templates can be found on pages 294-295 of that book."; Foundry's body has no such pointer. Recorded, not resolved (curation.md, "Literal wording"); the pinned text stays verbatim. The snakes it creates are Bestiary creatures (venomous and constrictor snakes, PCGen bestiary/b1_races.lst:368 and :369, SOURCEPAGE:p.255), some with the advanced and giant simple templates, which PCGen's full row places on the Bestiary's pages 294-295 (the advanced simple template's PZO1112, curation.md, "Templates and creatures"; Umbral Infusion #520). PZO1112 (Bestiary) is added by this run.
- **Burning Gaze.** It "does not grant an actual gaze attack", so it applies no gaze rule and needs no Bestiary notice.
- **Summon Monster II.** It functions like summon monster I (#533, admitted at wave F1), a Core Rulebook spell (PZO1110, required), and so incorporates its rules, including the Bestiary celestial and fiendish templates and summoned creatures that summon monster I requires PZO1112 for: PZO1112 is added by this run (Summon Monster IV #525, VI #535 and IX #535 precedent; curation.md, "Templates and creatures"). Metadata: Duration: PCGen's base row DURATION:(ConjurationSummonersCharmBonus+(CASTERLEVEL)) rounds [D] adds PCGen's ConjurationSummonersCharmBonus variable (0 unless a PCGen option raises it) to the 1 round per level that Foundry records; recorded, not resolved, and the pinned duration stays.
- **Blessing of Courage and Life.** Metadata: Descriptors: Foundry also lists emotion, which PCGen's base row DESCRIPTOR (none) does not; recorded, not resolved.
- **Bloodhound.** It grants the scent special quality, a universal monster rule: the pinned Scent monster ability cites PZO1112, PZO1116, PZO1120, PZO1127, PZO1133 and PZO1137, so PZO1112 (Bestiary), the earliest, is added by this run (curation.md, "Monster abilities": scent requires PZO1112).

Each re-assessed record keeps its earlier assessment, holds and hold reason in `assessmentHistory`, cites every cleared notice hold in `launchReview.noticeChain`, and binds over its full-corpus closure, as the gate does.

### The run

Wave CL6 is the sixth class-list Spell wave (#735 S-03 launch re-assessment, scheduled under #767; research `next-met-20261109.md`, the CL table). It re-assesses in place **49 class-list-only Spells** of spells-517 (15), spells-519 (18) and spells-520 (16), each held only on its whole-content hold, and the **4 held Spells their gate closures reach**: Wrath (#521, linked by Shared Wrath), Wall of Force (#529, by Forcecage), Pain Strike (#533, by Pain Strike, Mass) and Fester (#541, by Fester, Mass). The closures were recomputed on `53ba4a17` with the gate's `collectReferences`.

- **Comparison.** Each complete pinned body is compared with its PCGen `25523dbc` full-description row and its system fields with the base row (CL3's finder; Fester adds the base row's short-description role). 44 bodies are PCGen's word for word; three are named holds (below), and the other six differ in recorded wording or notation only: Snake Staff (PCGen's Bestiary pointer, absent in Foundry), Reincarnate (Foundry "spellcreature" and "on the next page", and an inline d100 roll), Contagious Zeal (PCGen's distance formula), Instant Armor (Foundry's table head), Sanctify Corpse (PCGen's extra "effect") and Eruptive Pustules (PCGen "handheld" for "hand-held").
- **Metadata readings (CL5 review r1, finding 1).** Descriptors, components and spell resistance are compared mechanically and every difference is named; the other retained differences are named by hand (Contingency's casting time, duration and target; the casting time, duration and components Shared Wrath's PCGen base row leaves unspecified (no tag); Telekinesis's three actions; Summon Monster II's PCGen variable; Winter Feathers' save; Shared Wrath's page). Each dismissal flag on one side only is named (PCGen [D] with no Foundry flag on Antipathy, Contingency and Forcecage; CL3 review r1).
- **Named holds.** Stone Shield (#519): its closing sentence, "At 4th level, a qinggong monk (Ultimate Magic) may select this spell as a ki power costing 1 ki point to activate", is bounded at monk level 4 by PCGen's ARG ki-power row (`arg_abilities_class.lst:1009`), but no permitted source states the ki cost (Absorbing Inhalation's precedent). Severed Fate (#520): PCGen has only its one-line summary. Fester (#541): PCGen has only its one-line summary, and its one full-row record, `Fester.MOD`, is glued onto the Feather Step (Mass).MOD line (`apg_spells.lst:1944`) and carries feather step, mass's text. Nothing is taken from memory or the web.
- **Policy.** #735 S-03 covers `learnedAt.class` only. Wall of Force's subDomain.Isolation 6 and Pain Strike's subDomain.Torture 2 are bounded by Inner Sea Gods' rows (`isg_domains.lst:14`, `:23`; PZO9267); both are admitted as closure keys and stay unmet on their granted levels (root's subdomain ruling, 2026-11-08). No root has a granted level.
- **Notices.** PZO1131 for every record whose actions keep `activation.unchained` and lacked it, and PZO1110 where it was missing. PZO1112 (Bestiary) where a body depends on a Bestiary rule: Snake Staff (venomous and constrictor snakes, advanced and giant templates), Bloodhound (scent), Keen Senses (low-light vision), Summon Monster II (it functions like summon monster I), Reincarnate (the incarnation table's Bestiary creatures), River of Wind (the air subtype), Expeditious Excavation (earth creatures), Eruptive Pustules (swarms), Forcecage (breath weapons) and Wall of Force (breath weapons and gaze attacks). Every class rule a body names belongs to a book the record already requires (wizard and sorcerer casting in Telekinesis, the ranger's favored enemy, the bard's bardic performance, Improved Critical, the qinggong monk's Ultimate Magic). Every required code is a reviewed Registry notice; no notice text is owed.
- **Out of scope.** Fester, Mass (#517) functions as fester, so it stays held behind Fester's named hold, on its whole-content hold. Shadow Conjuration (#528) carries bloodline.Harrow 4, whose only PCGen row is in the shared cache, not the pinned store (unmapped bloodline); Shadow Conjuration, Greater (#519), which functions like it, stays held too.

### Counts

| Full-corpus preview | Admitted | Held | Dependent omissions | Failures |
| --- | --: | --: | --: | --: |
| Base `53ba4a17` | 969 | 22,859 | 145 | 1,649 |
| Wave CL6 | **1,021** (+52) | **22,809** (-50) | **143** (-2) | 1,649 |

The delta is exact: the 50 admitted wave keys move held → admitted, Stone Shield, Severed Fate and Fester change only their hold reasons, and the two dependent omissions blocked only by a wave key move to admitted (the buffs Aspect of the Stag and Keen Senses, pf1-content). The catalog and the failures are identical key for key.

**Launch inventory:** identity `sha256:caed76b96f815ed5a234d073c773902ad924f01022c5f3b140a12ec8e6904831`; `noticeAuthoritySha256` `22003273a0e9d9fe67c2980b1d544129c48cea14b9116f05257903749a943c88`; required launch failures 96,375 → **96,325**; rows 19,272. **Met (`mvp:status`):** 789 → **837** of 16,744 (+48, none lost: the 47 admitted roots and Wrath).

<!-- prep:shared-store-count -->
New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `4d44c53e`: **0**.
<!-- /prep:shared-store-count -->

### Preservation

The shared files change only this run's 53 rows: 53 changed assessments and evidence entries, each keeping its earlier assessment in `assessmentHistory`. No overlay record, Registry, `held-notices.json`, `notice-clearances.json` or production code changes. The buffs Aspect of the Stag and Keen Senses (`pf1-content`) admit with their inventories untouched. Tests: the seven batch tests gain wave CL6 tests through the shared class-list helper (`expectWaveCl6Spell`, `expectWaveCl6InventoryRow`; `launch-reassessment.ts`), and their counts and hold expectations follow the re-assessed rows. `tests/catalog/wave-cl6-binding-context.ts` binds a wave CL6 row against its full-corpus closure (54 entries), read by key from committed fixtures: `tests/fixtures/wave-cl6/binding-preview.json`, which stores only the two entries no committed fixture holds exactly (Pain Strike, Mass and Summon Monster II, whose batch preview strips their cross-batch links); `spell-bindings-738/full-context.json` and `spells-520/binding-preview.json` for Shared Wrath's and Forcecage's complete entries (read before the batch previews' stripped copies); and seven batch previews. Forced pins in other files: `spells-519.test.ts` (Sleep replaces the now-PZO1131 Magic Missile as its Core-only fixture example), `spells-532.test.ts` (Spider Climb, Magic Missile and Wall of Force admitted in its context), `inherited-notices-296.test.ts` (Locate Weakness and Ablative Barrier join its later-confirmed PZO1118 set) and `launch-document.test.ts` (identity and failures).
