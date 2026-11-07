# Spell curation review: #518

Reviewed 2026-10-08 by **Sol (AI curator) for the owner**, following [#518](https://github.com/AndreasUnunger/EverythingPath/issues/518), [PRD #251 Decisions 9, 10 and 17 and the acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461), [Spellcasting](../character-sheet/spellcasting.md), [curation](curation.md), and the [#328 precedent](races-328.md).

Exactly **100 Spell definitions** receive one disposition each: **0 supported/admitted, 100 specifically held, 0 dependently omitted, 0 wholly unsupported/prose-only, and 0 excluded**. Attribution, curation coverage, calculation completeness and reference validity are separate findings. No Catalog Release was published or activated.

## Evidence and scope

- Read-only Foundry PF1 v11.11, commit `418761d2e16a6037c0156bb4a241f7cea5a2986d`.
- Read-only pf1-content 11.4.0, commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`.
- [Single batch inventory, attribution evidence and complete mechanics review](../../scripts/catalog/legal/spells-518.json): exact ordered ticket keys, source locations and hashes, citations, minimum notice identities, named holds, complete action/metadata review and outstanding calculations.
- [Source-backed fixtures](../../tests/fixtures/spells-518/provenance.json): 100 exact ticket roots and 28 unreviewed class-context files. Context files are not additional reviewed candidates or admitted content. The ordered ticket-key digest is `0516b291dbd20d9f516d40d0c1e2856c3b089a681d40b982e49093ab6ff5712f`.
- [Curation Overlay](../../scripts/catalog/reviewed-curation.json), [Attribution Assessments](../../src/lib/catalog/data/attribution-assessments.json), [evidence](../../src/lib/catalog/data/attribution-evidence.json) and [enforced notice holds](../../scripts/catalog/legal/held-notices.json). Stable identities and existing remaps are preserved.

PCGen comparison uses commit `25523dbcf10e86c280fc0f447167ea43d67419d3`, [CRB Spell data](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_spells.lst) and [campaign metadata](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/core_rulebook.pcc). All 23 CRB roots were directly compared: 17 normalized full descriptions match and six have individually recorded text/layout differences (Animal Growth, Entangle, Shadow Evocation, Moment of Prescience, Polymorph Any Object and Heat Metal). Normalization removes HTML/UUID presentation and accounts for case, whitespace and PCGen representation; it does not establish whole-content attribution. Later class-list/Granted Spell metadata, separate actions/materials and linked origins remain unbounded. No notice equivalence is asserted between PCGen’s Paizo Inc. wording and the reviewed Paizo Publishing, LLC line. No source runtime was imported or executed. No book PDFs were available and Archives of Nethys was not used.

The batch names **44 observed minimum notice identities**: 43 publication codes and the custom “Paizo Blog - Ultimate Cantrips” source on Drench. They are leads rather than a complete origin bound. The existing CRB identity is reused; 34 of the 44 identities have exact compilation-line leads, which remain unaccepted; **43 new notice/notice-chain holds** enforce the unresolved notice requirements. All 23 CRB roots carry expanded class and/or granted-list metadata beyond the comparator, preventing a whole-entry origin bound even when the prose matches. Each of the 100 whole-content comparison holds is separately expressed by an unresolved content-bound assessment. Sense Madness explicitly cites GameMastery Guide p.236 (PZO1114); Crusader’s Edge inherits the Bane weapon quality from Ultimate Equipment p.136 (PZO1123). These named rules contexts are separate evidence from raw links and extraction-retained closures. Twenty-three roots contain literal linked-content leads; their retained closures are recorded independently. No linked outside-ticket definition is newly reviewed or admitted. This batch has no malformed publication IDs, and no publication-code alias is guessed for Drench’s custom source.

## Every-key disposition

Each root is legally held for incomplete whole-content comparison and any named notice chain. Technical gate failures are independent findings. Per-key missing evidence and linked requirements are recorded in the inventory.

| Exact key | Spell | Upstream root citation | Disposition |
| --- | --- | --- | --- |
| `pf1/27c9726op3gzidra` | Fiery Shuriken | PZO1118, p. 229 | Specifically held |
| `pf1/27o3msobhyghmfid` | Minor Image | PZO1110, p. 314 | Specifically held |
| `pf1/29b03n30uyprze11` | Cauterizing Weapon | PZO9435, p. 14 | Specifically held |
| `pf1/29cfi65seiajh5qv` | Animal Growth | PZO1110, p. 240 | Specifically held |
| `pf1/2A5R36zEluwUHG7r` | Woodland Rune | PZO9494, p. 13 | Specifically held |
| `pf1/2aspbuzo0ysh0m94` | Accept Affliction | PZO9431, p. 28 | Specifically held |
| `pf1/2b0p06vmdgk43ewj` | Shadow Dragon Aspect | PZO9432, p. 27 | Specifically held |
| `pf1/2bmiwnoqt41kgqp1` | Hammer of Mending | PZO9267, p. 235 | Specifically held |
| `pf1/2cenpvloizn0by91` | Drench | Paizo Blog - Ultimate Cantrips | Specifically held |
| `pf1/2da31irslinqpakz` | Threefold Sight | PZO9480, p. 25 | Specifically held |
| `pf1/2dc7e9wby8qpi6m0` | Arcane Sight | PZO1110, p. 244 | Specifically held |
| `pf1/2dtcvrqh1z9k05dq` | Animal Aspect, Greater | PZO1118, p. 223 | Specifically held |
| `pf1/2ew7fowmibtk5jbi` | Force Hook Charge | PZO1117, p. 220 | Specifically held |
| `pf1/2f2oph4conz96aiq` | Sense Madness | PZO1135, p. 127 | Specifically held |
| `pf1/2f3ebhk5p44uyrsc` | Phasic Challenge | PZO9468, p. 6 | Specifically held |
| `pf1/2fcgfstehgtkkfja` | Drain Poison | PZO9459, p. 28 | Specifically held |
| `pf1/2fcl60gfpjewgi2v` | Cursed Treasure | PZO1136, p. 188 | Specifically held |
| `pf1/2fex71vszfumoseb` | Artificer's Curse | PZO9465, p. 19 | Specifically held |
| `pf1/2fg73hig4umqb9h6` | Hidden Blades | PZO9468, p. 25 | Specifically held |
| `pf1/2fp2iq80vj4gugzi` | Tamer's Lash | PZO1140, p. 236 | Specifically held |
| `pf1/2fsop8wg3cfpbrff` | Venomous Bite | PZO9459, p. 29 | Specifically held |
| `pf1/2h2bf61gi0tgr8ub` | Refine Improvised Weapon | PZO1129, p. 190 | Specifically held |
| `pf1/2h33n1q61h3yhu06` | Pellet Blast | PZO1118, p. 238 | Specifically held |
| `pf1/2h9qfrq3kkxg5e49` | Replenish Ki | PZO9267, p. 238; PZO9053, p. 73 | Specifically held |
| `pf1/2hvmdscy72tsrh5p` | Contact Nalfeshnee | PZO9261, p. 50 | Specifically held |
| `pf1/2ip53auf03bqxkl1` | Joyful Rapture | PZO1117, p. 225 | Specifically held |
| `pf1/2j26cby2izdlaagd` | Telekinetic Volley | PZO9452, p. 31 | Specifically held |
| `pf1/2js46u3c4e2oxvyl` | Halfling Vengeance | PZO90131, p. 72 | Specifically held |
| `pf1/2jx5vqudbddi0a2w` | Pup Shape | PZO1118, p. 240 | Specifically held |
| `pf1/2khqviex7vacs8fc` | Marionette Possession | PZO1117, p. 228 | Specifically held |
| `pf1/2knr01drz0mc67n5` | Demanding Message, Mass | PZO1134, p. 210 | Specifically held |
| `pf1/2m1ra2zglv7z8ixt` | Death from Below | PZO1121, p. 39 | Specifically held |
| `pf1/2mh7g81k30bv7b5m` | Moonstruck | PZO1115, p. 232 | Specifically held |
| `pf1/2mhlwyddg7wk1it8` | Damnation Stride | PZO1121, p. 173 | Specifically held |
| `pf1/2mvlxf6x10ib0ru7` | Bloodbath | PZO1135, p. 110 | Specifically held |
| `pf1/2nn2tshkn4p7k25l` | Entangle | PZO1110, p. 278 | Specifically held |
| `pf1/2nv15766n5lluhpq` | Cloud Shape | PZO1121, p. 160 | Specifically held |
| `pf1/2o9tacbz7tbrlhvv` | Knock | PZO1110, p. 303 | Specifically held |
| `pf1/2p0gz8lgaowcojx1` | Detonate | PZO1115, p. 215 | Specifically held |
| `pf1/2p265l26tq5xh0f6` | Thought Shield IV | PZO1132, p. 190 | Specifically held |
| `pf1/2p6fzj5t03oivndd` | Command | PZO1110, p. 256 | Specifically held |
| `pf1/2q48ogrz3840xwi7` | Shadow Evocation | PZO1110, p. 340 | Specifically held |
| `pf1/2qbdesr0fwtmi9tj` | Brand, Greater | PZO1121, p. 207 | Specifically held |
| `pf1/2qfddmh3pwy7i3fe` | Eyes of the Void | PZO1129, p. 181 | Specifically held |
| `pf1/2qwpals9bp2j22if` | Repugnant Taste | PZO9478, p. 30 | Specifically held |
| `pf1/2s198jpks0pvimjf` | Telempathic Projection | PZO1132, p. 188 | Specifically held |
| `pf1/2s7msrlmyskstvo6` | Holy Shield | PZO1117, p. 223 | Specifically held |
| `pf1/2sa3881har33geo1` | Polymorph Any Object | PZO1110, p. 323 | Specifically held |
| `pf1/2sgt05glk5aby9hw` | Life of Crime | PZO1134, p. 218 | Specifically held |
| `pf1/2skh3v9ksklvojx4` | Hallucinogenic Smoke | PZO9436, p. 28 | Specifically held |
| `pf1/2tl18dgkexyukq9j` | Share Shape | PZO9429, p. 25 | Specifically held |
| `pf1/2ubwr3811rn9jvop` | Hold Portal | PZO1110, p. 297 | Specifically held |
| `pf1/2uvfb4b01cr3c823` | Whip of Spiders | PZO1129, p. 199 | Specifically held |
| `pf1/2uvvjrwevv639fk9` | Spell Immunity, Communal | PZO1118, p. 244 | Specifically held |
| `pf1/2uwoo18o9yggbwsr` | Healing Token | PZO9475, p. 9 | Specifically held |
| `pf1/2vb5orfcy57lrfmc` | Moment of Prescience | PZO1110, p. 315 | Specifically held |
| `pf1/2wcapjwm4rj21ni0` | Darkvault | PZO9466, p. 15 | Specifically held |
| `pf1/2wp7kqthujs2dtsl` | Viper Bomb Admixture | PZO1118, p. 248 | Specifically held |
| `pf1/2wumtp2gzzcg8g5u` | Burning Entanglement | PZO1136, p. 140 | Specifically held |
| `pf1/2xuy2pn6tdhm5ssj` | Protection from Arrows, Communal | PZO1118, p. 240 | Specifically held |
| `pf1/2y9e1l6zso9tdg0a` | Reduce Person | PZO1110, p. 330 | Specifically held |
| `pf1/2yna9cslnzmuibhr` | Unadulterated Loathing | PZO1117, p. 244 | Specifically held |
| `pf1/2zw2ud0vprha2uvf` | Deceitful Veneer | PZO1134, p. 210 | Specifically held |
| `pf1/2zyr6klf97jyr5ng` | Pass without Trace | PZO1110, p. 318 | Specifically held |
| `pf1/319ubos76z392xah` | Liquefy | PZO9465, p. 21 | Specifically held |
| `pf1/31xs1udfguxxy9gl` | Imbue with Elemental Might | PZO1121, p. 203 | Specifically held |
| `pf1/32bhzf4gvh2ytgq3` | Hibernate | PZO9221, p. 61 | Specifically held |
| `pf1/338vg8knwliacgbi` | False Resurrection | PZO1134, p. 214 | Specifically held |
| `pf1/33pe0bge7b7aq3io` | Shocking Grasp | PZO1110, p. 343 | Specifically held |
| `pf1/3400riguqk53l5io` | Face of the Devourer | PZO9267, p. 233; PZO9023, p. 65 | Specifically held |
| `pf1/34fcczk45r6w4fgb` | Shadow Weapon | PZO1117, p. 237 | Specifically held |
| `pf1/34hsni5inji07r01` | Crusader's Edge | PZO9237, p. 53 | Specifically held |
| `pf1/34jyuvdflia4goib` | Scintillating Pattern | PZO1110, p. 336 | Specifically held |
| `pf1/34niukp5dho42r12` | Lockjaw | PZO1115, p. 232 | Specifically held |
| `pf1/361rc74674l3zt9a` | Flesh to Stone | PZO1110, p. 284 | Specifically held |
| `pf1/37c8wxarifuq59bx` | Collaborative Thaumaturgy | PZO9435, p. 12 | Specifically held |
| `pf1/37ubwx82nqaog3ib` | Thought Shield V | PZO1132, p. 190 | Specifically held |
| `pf1/39atu9ijjtqejmmj` | Summon Derghodaemon | PZO9239, p. 39 | Specifically held |
| `pf1/3NaNHmxd9LA5BNu1` | Uncanny Reminder | PZO9496, p. 14 | Specifically held |
| `pf1/3a162m66toj22fpa` | Circle of Death | PZO1110, p. 255 | Specifically held |
| `pf1/3a8l9mkxhob2gbbr` | Chaos Hammer | PZO1110, p. 254 | Specifically held |
| `pf1/3ah9mmg0odateh8l` | Animal Shapes | PZO1110, p. 241 | Specifically held |
| `pf1/3alvkash9bb3xumf` | Gravity Well | PZO9434, p. 29 | Specifically held |
| `pf1/3anuql2qioluspuv` | Magic Aura, Greater | PZO1134, p. 219 | Specifically held |
| `pf1/3b1x69kfhnsa2d54` | Heat Metal | PZO1110, p. 294 | Specifically held |
| `pf1/3b6rq9ivrw2xwsxy` | Curse of Keeping | PZO9462, p. 30 | Specifically held |
| `pf1/3b92cl654o8lg4n2` | Spell Scourge | PZO9267, p. 243 | Specifically held |
| `pf1/3bdfw5f15hwcxlth` | Reverse Gravity | PZO1110, p. 335 | Specifically held |
| `pf1/3bdl22oblfph0n33` | Conditional Favor | PZO1134, p. 206 | Specifically held |
| `pf1/3bw76h8kazudq45e` | Mental Barrier III | PZO1132, p. 175 | Specifically held |
| `pf1/3bwngymjyund4di0` | Preserve | PZO9296, p. 43 | Specifically held |
| `pf1/3cfqiphd1wcfyfwt` | Foretell Failure | PZO9465, p. 24 | Specifically held |
| `pf1/3cwzop9xd0gl8vnd` | Animus Mine | PZO9479, p. 20 | Specifically held |
| `pf1/3dr35v4l06tnfrwl` | Defile Armor | PZO1115, p. 215 | Specifically held |
| `pf1/3dvrfgpj9zhavfdk` | Enlightened Step | PZO9472, p. 12 | Specifically held |
| `pf1/3edtpx9oabq3oeeg` | Thought Worm III | PZO9477, p. 11 | Specifically held |
| `pf1/3efy1ico48ccrzni` | Vampiric Touch | PZO1110, p. 364 | Specifically held |
| `pf1/3etxlex8u32g0hrx` | Bane | PZO1110, p. 246 | Specifically held |
| `pf1/3evz2hiv9r97vtmm` | Blessing of the Salamander | PZO1115, p. 206 | Specifically held |
| `pf1/3fbrrckyfagfzyop` | Regenerate | PZO1110, p. 331 | Specifically held |

## Mechanics and description review

Every complete raw description and all action metadata receive a checked full-description binding. Recorded Spells grant no running Modifiers, Sources, Item Abilities or proficiencies merely by being known or written in a Spellbook. Exact class levels, granted-list metadata and citations are retained where supported. Spell casting/combat remains prose; target-specific effects require separate Spell Effect or condition state. These outstanding calculations are independent of the legal holds.

The importer drops source descriptors on **39 roots** because `scripts/catalog/details.ts` reads `system.types`, while these pinned roots store `system.descriptors`. The inventory retains the complete raw descriptor arrays, and focused tests pin the actual empty imported arrays alongside Bane/Shocking Grasp source facts. **37 roots’ subschool arrays are retained.** No importer change is made and no lost descriptor is invented in the prepared output. Drench’s custom source name and empty pages map to the citation record; its URL/date remain in the unsupported-source evidence and raw inventory.

The separate description pass checks **100 complete descriptions**, including the 52 roots not selected by the drafter’s 48-description predicate, with **121 readable Notes**. All raw action and metadata fields are independently retained and compared in focused tests. The required mechanics inventory has zero inputs for recorded Spells; no required curation records are missing. The optional description gate still names **34 candidates with 34 outstanding calculation items**. Marking their description review checked does not complete those separate effects. Vampiric Touch’s combat-dependent temporary-hit-point pool is explicitly prose-only within its legally held Spell: the PRD excludes current HP and temporary-HP pools, so it is not a promised closed calculation.

| Exact key / Spell | Outstanding calculation |
| --- | --- |
| `pf1/29cfi65seiajh5qv` Animal Growth | Separate Animal Growth Spell Effect: +8 size Strength, +4 size Constitution, −2 size Dexterity, +2 existing natural armor and dependent size/attack/AC/damage/space/reach changes. Recording this Spell supplies none of these calculations. |
| `pf1/2dtcvrqh1z9k05dq` Animal Aspect, Greater | Separate Greater Animal Aspect chosen effects: inherited frog Acrobatics +4, gorilla competence grapple/reposition +4 plus Perception +2/Fortitude +1, monkey Climb +4/Acrobatics +4, raccoon Disable Device/Sleight of Hand/Stealth +4 and tree-lizard Stealth +4. Choices, base/improved non-addition and single running aspect Source remain unresolved; movement/feat procedures stay prose. |
| `pf1/2f2oph4conz96aiq` Sense Madness | Separate Sense Madness effect: scoped +4 Spellcraft identification and +1 circumstance next caster-level check for the identified effect; check-only scope must not raise overall caster level. |
| `pf1/2fex71vszfumoseb` Artificer's Curse | Artificer's Curse item-targeted caster-level reduction and dependent typed-bonus suppression require item-state/effect mechanics; they are not Character caster-level penalties. |
| `pf1/2fg73hig4umqb9h6` Hidden Blades | Separate Hidden Blades item-scoped effect: +20 Sleight of Hand concealment and +5 circumstance Bluff feints using the affected weapon/ammunition. |
| `pf1/2h2bf61gi0tgr8ub` Refine Improvised Weapon | Separate Refine Improvised Weapon item-targeted effect needs the equivalent Base Item and its masterwork attack-only enhancement; recording the Spell does not replace the item's weapon facts. |
| `pf1/2hvmdscy72tsrh5p` Contact Nalfeshnee | Separate Contact Nalfeshnee effect must scope the caster's cumulative −1 Will penalty and chaotic-evil +4 bonus to its question-related saves; demon Knowledge values are not the caster's skill bonuses. |
| `pf1/2js46u3c4e2oxvyl` Halfling Vengeance | Separate Halfling Vengeance selected-foe effect: −2 attack against creatures smaller than the affected foe for 1 round after forgoing 2d6 precision damage. Precision dice and other special conditions remain spell-procedure prose. |
| `pf1/2jx5vqudbddi0a2w` Pup Shape | Separate Pup Shape effect: exact ability penalties with minimum 1, +4 size Dexterity, +2 natural armor, one-HD maximum-HP form and size-dependent calculations. |
| `pf1/2m1ra2zglv7z8ixt` Death from Below | Separate Death from Below effect: dodge AC keyed to attacker/target size difference and caster-level cap, with the gnome-specific cap. No size difference is inferred as an unconditional bonus. |
| `pf1/2mh7g81k30bv7b5m` Moonstruck | Separate Moonstruck effect: inherited Rage +2 morale Strength/Constitution, +1 morale Will and −2 AC with the same Rage Source and exact timing; natural attacks and confusion procedures remain prose. |
| `pf1/2nv15766n5lluhpq` Cloud Shape | Separate Cloud Shape effect must carry Gaseous Form's inherited armor suppression and defensive properties, with exact size/form scope; cloud movement and appearance remain prose. |
| `pf1/2p265l26tq5xh0f6` Thought Shield IV | Separate Thought Shield IV effect: inherited +8 circumstance Will vs mind-affecting, thought-reading protection/stun and Psychic Crush successful-save immunity. |
| `pf1/2s198jpks0pvimjf` Telempathic Projection | Separate Telempathic Projection effect: chosen +5 insight social skill check against the designated target, without applying to all checks or indefinite duration. |
| `pf1/2s7msrlmyskstvo6` Holy Shield | Separate Holy Shield effect must transfer actual shield and enhancement AC between caster and recipient and suppress caster shield/bash/property use without copying unconditional AC. |
| `pf1/2sa3881har33geo1` Polymorph Any Object | Separate Polymorph Any Object chosen-form effect: inherited Greater Polymorph ability/natural-armor and form statistics; missing-score base 10 physical/base 5 mental rules. No form or duration-factor choice is inferred. |
| `pf1/2tl18dgkexyukq9j` Share Shape | Separate Share Shape effect needs the actual companion's permitted Beast Shape II form and corresponding size/ability/natural armor rules. No companion form is assumed. |
| `pf1/2vb5orfcy57lrfmc` Moment of Prescience | Separate Moment of Prescience effect: caster-level-capped +25 insight with single chosen roll/AC scope and consumption. Opposed ability checks remain prose because no ability-check target exists. |
| `pf1/2y9e1l6zso9tdg0a` Reduce Person | Separate Reduce Person effect: +2 size Dexterity, −2 size Strength with minimum 1, +1 size attack/AC and dependent size/damage/space/reach changes. Recording the Spell grants no size change. |
| `pf1/319ubos76z392xah` Liquefy | Liquefy temporary suppression of item bonuses/properties needs item-targeted state; repair, damage and broken-item procedures stay prose. |
| `pf1/33pe0bge7b7aq3io` Shocking Grasp | Separate Shocking Grasp delivery effect: +3 attack only when delivering its melee touch against the exact metal-target circumstance. Spell damage is cast-time procedure, not a generic damage Modifier. |
| `pf1/3400riguqk53l5io` Face of the Devourer | Separate Face of the Devourer effect: +4 circumstance Intimidate. Face/speech changes and generated bite procedure remain prose. |
| `pf1/34fcczk45r6w4fgb` Shadow Weapon | Separate Shadow Weapon effect/item creation needs exact Base Item/proficiency, masterwork and caster-level enhancement or Frost/Keen choice with per-defender disbelief; no weapon is created by recording the Spell. |
| `pf1/34hsni5inji07r01` Crusader's Edge | Separate Crusader's Edge item-targeted effect must supply Bane's +2 effective enhancement and +2d6 only against evil outsiders, preserving target conjunction and critical-condition procedures. |
| `pf1/34niukp5dho42r12` Lockjaw | Separate Lockjaw effect: +4 CMB to start/maintain a grapple, including Grab's scope and the chosen natural attack. No attack is granted or bonus added on recording the Spell. |
| `pf1/37ubwx82nqaog3ib` Thought Shield V | Separate Thought Shield V effect: inherited +8 circumstance Will vs mind-affecting, thought-reading protection/stun and Psychic Crush protection, with failed-save termination. |
| `pf1/3NaNHmxd9LA5BNu1` Uncanny Reminder | Separate Uncanny Reminder rolled-result effects: −2 attack, −2 saves or −4 attack/saves/skills/weapon damage while the hostile memory is in sight. Ability-check penalties and entity generation stay prose. |
| `pf1/3a8l9mkxhob2gbbr` Chaos Hammer | Separate Chaos Hammer Slow effect must carry inherited −1 attack/AC/Reflex with Slow's shared Source and lawful failed-save scope; spell damage, action limits and movement remain prose. |
| `pf1/3ah9mmg0odateh8l` Animal Shapes | Separate Animal Shapes effect needs the chosen Beast Shape III form's size/ability/natural-armor modifiers for each recipient; no form is selected implicitly. |
| `pf1/3bw76h8kazudq45e` Mental Barrier III | Separate Mental Barrier III effect: +8 shield AC. The apparent 'mine thrust I' immunity typo needs permitted-source resolution; no guessed replacement rule is curated. |
| `pf1/3dr35v4l06tnfrwl` Defile Armor | Separate Defile Armor effect: inherited enhancement +1 per four caster levels, maximum +5, on targeted armor/clothing; conditional DR 5/good stays prose. |
| `pf1/3edtpx9oabq3oeeg` Thought Worm III | Separate Thought Worm III effect: failed-save −4 Will vs shared mindAffecting for all casters, but successful-save −2 only against the casting creature's mind-affecting spells/effects. Shared mindAffecting alone cannot express the successful-save caster conjunction. |
| `pf1/3etxlex8u32g0hrx` Bane | Separate Bane effect: −1 attack and −1 saves vs shared fear; exact enemy/save scope and counter/dispelling with Bless must remain distinct. |
| `pf1/3evz2hiv9r97vtmm` Blessing of the Salamander | Separate Blessing of the Salamander effect: +2 competence CMD. Fast healing 5 and fire resistance 20 are preserved as prose outside closed Modifier targets. |

## Source discrepancies and review boundaries

Seven explicitly recorded source discrepancies remain; the complete raw actions and descriptive text are preserved without guessing a correction. The descriptor mapping gap above is separately counted.

| Spell | Observed boundary |
| --- | --- |
| Drain Poison | Action duration says 24 hours; full prose says poison otherwise remains until a strike, touch or wiping. Both are preserved rather than silently reconciling the different termination statements. |
| Joyful Rapture | Action area says all allies and opponents; full prose restricts both benefits to allies. The Note does not confer healing on opponents. |
| Whip of Spiders | Action duration text has an unmatched '(D' parenthesis; the prose's two-round-or-remaining-duration transformed swarm limit remains clear. |
| Reverse Gravity | Action save description says 'none; see text'; prose specifically permits Reflex to grab a hold, not a general save against reversal. |
| Mental Barrier III | Description literally says 'mine thrust I', while the next clause names 'mind thrust II', III and IV. No silent correction or new spell identity is made. |
| Preserve | Raw prose joins the APG marker to 'putrefy food and drinkAPG'; no additional spell identity is inferred from this formatting. |
| Animus Mine | Action save says harmless Will negates; full prose specifies the offending creature's Will halves damage and negates stagger. The Note follows the full prose's distinct retaliation scope. |


Two roots retain technical reference failures even with the full pinned extraction: **Animal Aspect, Greater** has six unresolved `JournalEntryPage` links, and **Magic Aura, Greater** has one unresolved `JournalEntryPage` aura-table link. These seven failures are separate from legal holds and outside-selection Spell links. The descriptions and named inherited mechanics remain reviewed, but the full reference gate is not complete for those roots. No reference is removed or invented to force a pass.

## Public-boundary demonstration

There is no newly admitted Spell to demonstrate; the admitted-content acceptance remains limited by the legal holds. [Catalog tests](../../tests/catalog/spells-518.test.ts), [isolated saved-sheet tests](../../convex/catalogSpells518.integration.test.ts), and [fixture preview](../../tests/fixtures/spells-518/preview.json) prove technical behavior only. The [fixture explanation](../../tests/fixtures/spells-518/README.md) distinguishes runtime test definitions from shipping content.

Catalog fixture assertions pin the source text and metadata for Reduce Person’s +2 Dexterity, −2 Strength (minimum 1) and +1 attack/AC text; Animal Growth’s +8 Strength, +4 Constitution and +2 natural armor text; and Shocking Grasp’s capped 5d6 and conditional +3 metal-target attack bonus. The public resolver proves that recording these Spells leaves abilities, attacks and Spell Effects unchanged. Bane’s fear-save Note and Thought Shield V’s mind-affecting Note use shared Situations. Thought Worm III’s inherited failed-save −4 Will for all casters remains distinct from its successful-save −2 only against the named caster’s mind-affecting effects, with shared versus local Situations; the linked Thought Shield IV identity remains intact.

The isolated public browse/record/read/remove flows use Oracle’s editable known collection (Bane and Command) and Wizard’s Spellbook (Reduce Person and Shocking Grasp), preserve class association and explicit level, allow same-organization member editing, reject outsiders and wrong-campaign scopes, and match client/server calculations. A separately player-created temporary Bane effect applies its literal CRB p.246 −1 attack and fear-only −1 saves through the public writer: current melee changes by −1, Will changes by −1 only with fear requested, permanent values stay unchanged and deactivation restores the baseline. This is an in-memory test of the existing effect writer, not admission or curation of an imported effect; the batch’s separate effect work remains outstanding.

## Commands and observed gates

Root independently verified all 100 source-description hashes, full raw metadata fields, 100 checked bindings and 121 Note outputs (zero numeric outputs), plus 18 inherited-rule evidence occurrences against pinned source hashes. Root independently verified that all 128 raw root/context fixtures are byte-identical to the pinned source and match their recorded SHA-256 values; the ordered 100 keys exactly match the ticket.

The final complete pinned-source preview exits 1 after **176 seconds** with **23,037 entries, 538 supporting resources, 53 admitted candidates, 23,129 held, two outside-batch dependent omissions, zero retained exceptions and 4,734 failures**. Batch technical results are **0 admitted, 98 held and two reference failures**; the editorial inventory still gives all 100 one legal held disposition. Failure groups are 3,628 missing required curation records, 715 unaccounted inventory records and 391 broken-reference failures (two batch roots and 389 outside the ticket). No outside definition is admitted or removed to conceal a failure.

Complete required curation is **100 checked of 3,728, with 3,628 missing**. Optional description inventory is **10,292 candidates with 623 checked**; the final batch has 100 checked descriptions and 34 unresolved optional calculations. These are separate coverage and calculation findings; the report does not claim whole-corpus coverage or release readiness.

The initial complete preview took 201 seconds and was superseded because its batch diagnostics still included the out-of-scope Vampiric Touch temporary-HP calculation. The final preview uses the corrected 34-item scope and the final Halfling Vengeance diagnostic. The final frozen overlay SHA-256 is `559b3853f7ffa88bccaf77214a2a48a146f3a36a19c202febe9c8607de4e61c3`.

The final binding audit verifies all **100 current full-content closures** through the public binding helper. Ninety-eight initial bindings remain unchanged; Halfling Vengeance and Vampiric Touch are refreshed against the final overlay. Re-evaluating admission with the schema-parsed final reviewed inputs returns exactly the CLI’s gate counts. This refresh changes no shipping acceptance and preserves all original assessments.

Final extraction fingerprint: `de57f9be13caa015c6413cf0b13f20f2871695a7ce8bc79c62c56f141c397667`. Final reviewed-input fingerprint: `ce1ba1fe60b4f2a9763600b71f61a7c4cfc94526ebf8c844603c2078072e1949`. Legal-resource fingerprint: `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e`. Final re-evaluated admission-report SHA-256: `94d1b9483fa00996d6ef8c988f54564b314b397dae01e8d3835c5307f9274792`. The original final CLI report, before assessment refresh, has SHA-256 `2243b461f8699270e2a1f7158572e27a69c3983a96af6c484c8a260f4e9a555d` and identical counts. There are no outstanding admitted-content notices or legal resources; held content remains outside any completeness claim.

| Check | Final observed result |
| --- | --- |
| Pinned source verification | Both exact commits/manifests verified; no override |
| Exact candidate and source audit | Pass: all 100 issue keys, 128 raw root/context file hashes and 18 inherited-evidence occurrences |
| Current full-source assessment bindings | Pass: all 100 match the public binding helper and shared assessments |
| `pnpm -s typecheck` | Pass, exit 0, 105 seconds, 22:27–22:28:52 UTC |
| `pnpm -s lint` | Pass, exit 0, 142 seconds, 22:28:57–22:31:19 UTC |
| `pnpm -s check:initial-migration-writers` | Pass: 183 registered writers |
| `pnpm catalog:pin` | Pass: `sha256:71c66667344e200747085cc47660277a9e7677da10cdd3d58033591444baa25b` |
| Focused batch catalog/saved-sheet tests | Pass: two files, 14 tests (12 catalog, two Convex), final scope-corrected run 4.68 seconds |
| Final combined catalog/batch suite | Pass: 36 files, 538 tests, 98.91 seconds; one worker |
| Bounded checked description resume | Exit 0, 13 seconds: zero new/replaced/missing/stale, 100 checked descriptions, 34 optional diagnostics |
| Bounded admission/reference gate | Exit 1, 14 seconds: zero admitted, 79 held, 21 reference failures |
| Full-corpus drafter execution | Exit 0, 187 seconds: 4,351 records, 3,628 new drafts; coverage remains incomplete with 763 required and 226 optional diagnostics |
| Complete import/admission gate | Exit 1: 53 admitted, 23,129 held, two outside-batch dependent omissions, 4,734 failures; batch 98 held/two reference failures |
| `pnpm -s catalog:format --check` and prior-object audit | Pass: all 623 prior overlay records, 840 assessments, 818 evidence records, 236 holds and 75 Registry records preserved; shared Situations unchanged |
| `git diff --check` | Pass on finished artifacts |

The final bounded drafter exits 0 in **13 seconds**, retaining 723 records with zero additions/replacements, 100 applied checked descriptions, zero missing/stale bindings, 623 unrelated unused records, zero unresolved required mechanics and 34 optional calculation diagnostics. Its record fingerprint is `5514a87d60fcbbfebaa55ec8dde370e0722e5f420044b298dc373e11c9e45a26`.

The bounded preview exits 1 in **14 seconds** with exactly **100 entries, zero supporting resources, zero admitted, 79 held and 21 reference failures**, with zero dependent omissions/retained exceptions. Nineteen roots’ failures disappear when their outside-selection inputs are loaded; the other two retain the separately named full-source `JournalEntryPage` failures. Bounded admission-report SHA-256: `02ce37b9c780dadaf6a850b3ccca0aa94e4afd628cd60307bca441684ca352d1`.

The commands use the exact read-only source paths below. Candidate selectors and generated draft/preview reports stay in ignored scratch and are removed after verification; no scratch or answer file is linked as durable evidence.

```sh
pnpm -s catalog:curate --system /home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1 --content /home/andreas/repos/everythingpath/sources/pf1-content --candidates .scratch/curation-518/candidates.json --out .scratch/curation-518/drafts
pnpm -s catalog:curate --system /home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1 --content /home/andreas/repos/everythingpath/sources/pf1-content --candidates .scratch/curation-518/candidates.json --descriptions --out .scratch/curation-518/prose
pnpm -s catalog:curate --system /home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1 --content /home/andreas/repos/everythingpath/sources/pf1-content --candidates .scratch/curation-518/candidates.json --descriptions --out .scratch/curation-518/final-drafts
pnpm -s catalog:preview --system /home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1 --content /home/andreas/repos/everythingpath/sources/pf1-content --out .scratch/curation-518/full-preview
pnpm -s catalog:preview --system /home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1 --content /home/andreas/repos/everythingpath/sources/pf1-content --out .scratch/curation-518/final-full-preview
pnpm -s catalog:preview --system /home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1 --content /home/andreas/repos/everythingpath/sources/pf1-content --candidates .scratch/curation-518/candidates.json --out .scratch/curation-518/bounded-preview
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm test tests/catalog/spells-518.test.ts convex/catalogSpells518.integration.test.ts --maxWorkers=1
pnpm -s catalog:format --check
git diff --check
```

The complete-corpus drafter exits 0 after **187 seconds**, demonstrating tool compatibility while its generated coverage remains incomplete (`passed: false`). It returns **4,351 records: 723 retained and 3,628 new drafts**, with zero replacements/missing/stale/unused bindings, **763 unresolved required mechanics** and **226 unresolved optional descriptions** (including the batch’s 34). Required summary: 3,728 inputs, 3,628 drafted and 100 checked. Optional summary: 10,292 candidates, 623 checked and zero drafted. There are 3,588 applied bindings. Draft-record fingerprint: `3adec3c6c0a9a6e1db5bf21dad4b14a4fa95b82dfd9064f06e785db32841545d`. Generated full-corpus drafts stay in ignored scratch and are never copied to the reviewed overlay.

```sh
pnpm -s catalog:curate --system /home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1 --content /home/andreas/repos/everythingpath/sources/pf1-content --out .scratch/curation-518/full-drafts
pnpm test tests/catalog convex/catalogSpells518.integration.test.ts --maxWorkers=1
```

The final required combined suite passes **36 files and 538 tests**, exit 0, **98.91 seconds** (99 seconds wall time), at approximately 22:37–22:38:51 UTC. Existing catalog tests and the new 14 batch tests pass. No timeout was changed, and the full `pnpm test` was deliberately not run.

## Timing and workflow observations

Approximate overlapping phase windows began around 22:05 UTC on 2026-10-07; the reviewer date is 2026-10-08 in Europe/Stockholm. Fixture/test authoring began around 22:06 and the first isolated saved-sheet run passed at 22:12. The initial batch fixture preview and first combined batch run completed around 22:15; the final complete-source CLI preview finished around 22:27. These windows overlap the mechanics and attribution work and are not additive labor estimates.

The first combined batch run had 11/14 passing tests: two assertions ran before the final Attribution Assessments were written, and a third incorrectly expected an outside-selection UUID to remain in rendered description text. The corrected assertion pins the visible linked label and exact raw inventory link independently. Both saved-sheet tests passed in that run. A later run after attribution binding had 13/14 passing tests because the saved preview still held the earlier Halfling Vengeance diagnostic; regenerating it after the final refinement yielded **14/14 passing tests in two files, 3.54 seconds**, at approximately 22:18 UTC. The final independent PRD scope audit removed a wrongly promised Vampiric Touch temporary-HP calculation: actual combat damage/target HP and temporary pools are outside scope. The source prose is retained; the outstanding count falls from 35 to 34 while 121 Notes remain checked. Regenerated preview and repeated focused tests passed **14/14 in 4.68 seconds** at approximately 22:21 UTC. This was a justified scope correction; prior gate output was superseded and rerun against the final files. No production behavior or timeout was changed.

The environment has no Opus/Fable aliases, so the repository’s delegation requirement uses the available inherited model. The separate sampled Fable review remains an orchestrator landing step. The drafter’s predicate selects 48 descriptions; explicit checked complete-description records cover all 100 without changing the importer. The descriptor mapping gap remains separately recorded and no source runtime/configuration code was executed.

The final prior-object audit preserves **623 existing overlay records, 840 assessments, 818 evidence records, 236 notice holds and all 75 Registry records**, with shared Situations unchanged. The batch adds **100 checked overlay records, 100 unresolved assessments, 100 evidence records and 43 enforced holds**. The Registry remains byte-identical.

Approximate overlapping phase windows (UTC on 2026-10-07):

| Phase | Window | Elapsed |
| --- | --- | --- |
| Brief, contracts and exact selector | 22:05–22:08 | About 3 minutes |
| Complete source/mechanics review and scope correction | 22:08–22:22 | About 14 minutes |
| Attribution, notice evidence and final bindings | 22:08–22:27 | About 19 minutes |
| Fixture/test authoring, preview and verification | 22:06–22:21 | About 15 minutes |
| Gates, report and cleanup | 22:18–22:40 | About 22 minutes |

Overall elapsed time was about **35 minutes** (22:05–22:40 UTC). These windows overlap; they are not additive labor estimates. Final measured command durations were typecheck 105 seconds, lint 142 seconds, bounded description resume 13 seconds, bounded preview 14 seconds, complete preview 176 seconds, complete drafter 187 seconds and combined tests 98.91 seconds. The superseded complete preview took 201 seconds.

Changed files are the four shared overlay/assessment/evidence/hold files, the single batch legal inventory, this report, both batch tests, and source/preview/provenance/helper fixtures under `tests/fixtures/spells-518/`. The Section 15 Registry and shared Situations remain unchanged.

Task-local scratch, candidate selectors, draft/preview reports and temporary test copies were removed, verified at **22:39:29 UTC**. The initial shell removal was rejected by the command guard; a workspace-, realpath- and symlink-checked Node removal succeeded. Post-cleanup canonical-format and diff checks pass, and status contains only the expected reviewed artifacts, fixtures, tests and report. No answer file was created in the repository; the launcher captures the final response at its external `-o` path.

Only reviewed artifacts, source/preview/helper fixtures, tests and this report are changed. No product or importer code was modified. Changes remain uncommitted; no GitHub issue/PR, deployment or release was changed. Full-suite testing is left to the orchestrator’s post-rebase landing gate.
