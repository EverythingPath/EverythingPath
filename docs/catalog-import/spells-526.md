# Spell curation review: #526

**Sol (AI curator) for the owner**, reviewed **2026-10-08**, following [#526](https://github.com/AndreasUnunger/EverythingPath/issues/526), [PRD #251 Decisions 9, 10 and 17 and its acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461), [Spellcasting](../character-sheet/spellcasting.md), [curation](curation.md) and the [#328 precedent](races-328.md).

Exactly **100 pinned raw keys** reconcile to **99 Spells specifically held, 1 excluded folder, 0 admitted, 0 dependent omissions and 0 wholly unsupported/prose-only definitions**. The folder is **Universal**, `pf1/bpvgbh1VDSwajuKr`, excluded by the documented extraction contract. No root has a record-level 3.5 tag. No production/catalog publication or product implementation.

## Evidence and scope

- Read-only Foundry PF1 v11.11: `418761d2e16a6037c0156bb4a241f7cea5a2986d`; pf1-content 11.4.0: `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`. CLI gates verify Git identity and complete manifests.
- [Inventory, evidence and mechanics review](../../scripts/catalog/legal/spells-526.json) records every key, byte hash/location, exact actions/materials/class/granted lists, full descriptions, inherited rules/notices, independent missing mechanics and reference failures.
- [Provenance](../../tests/fixtures/spells-526/provenance.json) pins **100 raw roots** plus **69 unreviewed context files** (49 class lookups and 20 recursively linked Spells). All source files and both manifests are byte-identical pinned data. Context is not added review scope.
- [Overlay](../../scripts/catalog/reviewed-curation.json), [assessments](../../src/lib/catalog/data/attribution-assessments.json), [content evidence](../../src/lib/catalog/data/attribution-evidence.json) and [enforced notice holds](../../scripts/catalog/legal/held-notices.json) add only this batch’s identities.

Ordered ticket-key SHA256: `24a8ff6537ba391f90f914ef1dae427de93c5c2a71259dd76ea0b33b59300cd2`. [Bounded extraction](../../tests/fixtures/spells-526/preview.json) replays the exact 100-key selection. [Complete-context extraction](../../tests/fixtures/spells-526/binding-preview.json) replays all 99 root entries and their 20 recursively linked entries with full-source assessment bindings. Neither fixture is legally admitted output.

A fresh permitted comparison used fixed-commit [PCGen CRB Spell data](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_spells.lst) and [campaign metadata](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/core_rulebook.pcc), with hashes `6da07d57030565fec332991219192133f06d699a960d9d2cb9a5da9e9282bb31` and `8638a1197e2a541695f3005feb1a6eb67569220a5b0f151bc37819d3121feb06`. Every compared row stores its full base row, full DisplayFullSpell description, lines and hashes; campaign copyright/licence lines are retained separately as evidence. PCGen is a comparator, not shipped content. The initial Magic Fang, Greater selection encountered a TEMPDESC mechanics row; the retained comparison correctly uses its complete DisplayFullSpell row at line 1132.

**23 directly cited CRB Spells** were compared; **18 descriptions match** after HTML/UUID-display, punctuation, case and whitespace normalization, including equivalent mind-affecting spacing. The five differences remain explicit: Mount omits the Bestiary parenthesis in PCGen; Enervation uses Special Abilities versus Appendix 1 and a broken multiplication glyph; Shambler omits the Bestiary parenthesis and includes “in effect” absent upstream; Beast Shape IV’s upstream text restates lower-form bonuses missing from the PCGen row; Shadow Walk contains multiplication/percent presentation differences. Equality does not bound editor additions, expanded class/granted lists, structured actions/materials, inherited origins or complete notice chains. Paizo Inc. is not aliased to Paizo Publishing, LLC. No book PDFs available; no Archives of Nethys used. Sources are inert data; no Foundry runtime/configuration executed or copied.

## Attribution and inherited notices

All **99 Spells** have individual `spells-526-whole-content-<ID>` unresolved Attribution Assessments, bound to final full-source content closures, mapping, evidence and minimum notices. **43 observed minimum notice identities**, including the existing CRB identity, have **42 newly enforced complete-chain holds**. Registry text, provenance and aliases are unchanged; trimmed Registry notice convention and raw-line provenance remain intact. Existing #333–#336 and #516–#519 holds and pending inherited-rule audits are preserved.

**110 distinct per-candidate inherited-book dependencies** are recorded in `inheritedRuleNotices`, with exact hashed quotes and pinned citations in `inheritedNoticeReview`. Direct and transitive linked context remains separately recorded. Notable inherited rules:

| Spell                   | Inherited notice                   | Evidence                                                         |
| ----------------------- | ---------------------------------- | ---------------------------------------------------------------- |
| Sense Spirit Magic      | PZO1129                            | Shaman primary/wandering spirit magic lists                      |
| Bouncing Bomb Admixture | PZO1115                            | Alchemist bombs and discoveries                                  |
| Undetectable Trap       | PZO1117, PZO1110                   | Ultimate Magic ranger traps; CRB trapfinding/Find Traps          |
| Summon Lesser Demon     | PZO1120, PZO9225, PZO1112, PZO1110 | Bestiary 3, Lords of Chaos, inherited Summon Monster I/templates |
| Shambler                | PZO1112                            | Advanced template and shambling mounds                           |
| Alleviate Addiction     | PZO1114                            | GameMastery Guide addiction effects                              |
| Spirit-Bound Blade      | PZO1123, PZO1132, PZO1110          | Ultimate Equipment Mimetic; phantom emotional focus; Ghost Touch |
| Blade of Bright Victory | PZO1110                            | Paladin divine bond and Ghost Touch                              |
| Evolution Surge, Lesser | PZO1115                            | Original eidolon evolutions; no Unchained conversion assumed     |

No broad notice set or name match establishes whole-content coverage. Missing calculations do not create legal holds.

## Every-key disposition

Every Spell below is specifically held for its recorded whole-content gap and applicable minimum notice-chain requirements. “Folder exclusion” is the sole exclusion; mechanical findings and bounded missing links are not additional dispositions.

| Exact key              | Name                          | Direct source citation          | Disposition       |
| ---------------------- | ----------------------------- | ------------------------------- | ----------------- |
| `pf1/bacuzpculp9tld48` | Shout                         | PZO1110, p. 343                 | Specifically held |
| `pf1/banonti7druh3cxn` | Enhance Water                 | PZO9267, p. 233; PZO9416, p. 28 | Specifically held |
| `pf1/baocube6vvey9zlc` | Blasphemy                     | PZO1110, p. 249                 | Specifically held |
| `pf1/barb21n7r3wx8cql` | Raise Animal Companion        | PZO1117, p. 233                 | Specifically held |
| `pf1/barpek2qx79eoqb3` | Sense Spirit Magic            | PZO1129, p. 191                 | Specifically held |
| `pf1/bbieq5hgdkeskan0` | Blood of the Martyr           | PZO9255, p. 50                  | Specifically held |
| `pf1/bbmd0fj17jsf5300` | Planar Binding, Greater       | PZO1110, p. 321                 | Specifically held |
| `pf1/bbrkkjmgo5kof6gn` | Keen Edge                     | PZO1110, p. 303                 | Specifically held |
| `pf1/bc1vmv1ezifvfer8` | Mount                         | PZO1110, p. 315                 | Specifically held |
| `pf1/bc3nc0ri47egssht` | Enervation                    | PZO1110, p. 277                 | Specifically held |
| `pf1/bd6v1kuektkdkblx` | Possess Object                | PZO1117, p. 232                 | Specifically held |
| `pf1/bdbg2jxc1t4tht7o` | Abjuring Step                 | PZO1118, p. 221                 | Specifically held |
| `pf1/bdsbgy7nynphda0c` | Speechreader's Sight          | PZO9476, p. 10                  | Specifically held |
| `pf1/bdu1agqkrnlu6fwd` | Garrulous Grin                | PZO9469, p. 28                  | Specifically held |
| `pf1/bdyhf7y50zelcsd1` | Deft Digits                   | PZO9465, p. 19                  | Specifically held |
| `pf1/bdyr9oebse6haser` | Transmute Rock to Mud         | PZO1110, p. 361                 | Specifically held |
| `pf1/be3t7pxlh747kysx` | Oracle's Vessel               | PZO1117, p. 230                 | Specifically held |
| `pf1/be88e90guqbi1q1z` | Fear                          | PZO1110, p. 281                 | Specifically held |
| `pf1/be8yiccvifj38hd1` | Marid's Mastery               | PZO1121, p. 178                 | Specifically held |
| `pf1/bexxf2117rcr21g1` | Anticipate Thoughts           | PZO1132, p. 157                 | Specifically held |
| `pf1/bf2lu50t56iswz18` | Feather Step                  | PZO1115, p. 221                 | Specifically held |
| `pf1/bflx3x5g549ldzii` | Undetectable Trap             | PZO1134, p. 228                 | Specifically held |
| `pf1/bfyis6egnv5e9ohs` | Bouncing Bomb Admixture       | PZO9468, p. 10                  | Specifically held |
| `pf1/bg07g4olrcwbp1iv` | Absurdity                     | PZO1135, p. 108                 | Specifically held |
| `pf1/bgtmki0xl4xl4y91` | Magic Fang, Greater           | PZO1110, p. 309                 | Specifically held |
| `pf1/bhmziba5gtp0yrd4` | Steal Breath                  | PZO1121, p. 95                  | Specifically held |
| `pf1/bi0kwkoqetglbhdq` | Summon Lesser Demon           | PZO9074, p. 75                  | Specifically held |
| `pf1/bi3mdvhu35be806x` | Sphere of Warding             | PZO9444, p. 19                  | Specifically held |
| `pf1/bik6ck9jnnur82na` | Litany of Thunder             | PZO1118, p. 235                 | Specifically held |
| `pf1/bkawkbomsjcarh2c` | Rune of Warding               | PZO9408, p. 25                  | Specifically held |
| `pf1/bkw0h80dzx999xyp` | Red Hand of the Killer        | PZO1134, p. 223                 | Specifically held |
| `pf1/bl71og1gklwncmt7` | Faerie Fire                   | PZO1110, p. 280                 | Specifically held |
| `pf1/blsl7v5wr0rm28su` | Dissolution                   | PZO9465, p. 19                  | Specifically held |
| `pf1/blu526dm3jnv2sj0` | Mask Dweomer, Communal        | PZO1118, p. 236                 | Specifically held |
| `pf1/blvetbc929cfx4m8` | Mind Blank                    | PZO1110, p. 313                 | Specifically held |
| `pf1/bmdf6u2e63vsel3w` | Ancestral Communion           | PZO9408, p. 24                  | Specifically held |
| `pf1/bmr954ayksd33hdk` | Punishing Armor               | PZO9464, p. 19                  | Specifically held |
| `pf1/bnfgghdvdvlea6wr` | Inheritor's Smite             | PZO9267, p. 236; PZO9026, p. 71 | Specifically held |
| `pf1/bnwg0hvmdhpj891n` | Alleviate Addiction           | PZO9462, p. 19                  | Specifically held |
| `pf1/borbn2jnp2rt387d` | Deathwine                     | PZO1002, p. 418; PZO9005, p. 58 | Specifically held |
| `pf1/bp1j6n5r1lsok3kf` | Twilight Knife                | PZO1115, p. 252                 | Specifically held |
| `pf1/bp4s030vn5iwwf58` | Shambler                      | PZO1110, p. 341                 | Specifically held |
| `pf1/bpvgbh1VDSwajuKr` | Universal                     | Folder metadata                 | Folder exclusion  |
| `pf1/bqvzc3pn68fhsd9r` | Halfling Vengeance, Mass      | PZO90131, p. 72                 | Specifically held |
| `pf1/br37848gchetel0q` | Beast Shape IV                | PZO1110, p. 247                 | Specifically held |
| `pf1/brw5fsblcj8snqo2` | Perceive Cues                 | PZO1115, p. 235                 | Specifically held |
| `pf1/bsms9vykw483t0iz` | Hairline Fractures            | PZO9267, p. 235; PZO9416, p. 28 | Specifically held |
| `pf1/bssd4dmnz6m5yrf2` | Winged Sword                  | PZO9465, p. 10                  | Specifically held |
| `pf1/btbj09zllnb14kyx` | Spellcasting Contract, Lesser | PZO9029, p. 67                  | Specifically held |
| `pf1/btccs4sjo2nog1a0` | Ethereal Jaunt                | PZO1110, p. 279                 | Specifically held |
| `pf1/btoow6tyv39443gh` | Shadow Walk                   | PZO1110, p. 341                 | Specifically held |
| `pf1/bu3li46tc6rnav5g` | Dreadscape                    | PZO1135, p. 116                 | Specifically held |
| `pf1/bul3t3fss266op71` | Canopic Conversion            | PZO9221, p. 60; PZO9403, p. 26  | Specifically held |
| `pf1/bvjzcai7c9tw1kas` | Blade of Bright Victory       | PZO1117, p. 208                 | Specifically held |
| `pf1/bvojk0ljz9brf9ig` | Symbol of Fear                | PZO1110, p. 356                 | Specifically held |
| `pf1/bvsi2gzhq49mmt2f` | Simulacrum                    | PZO1110, p. 343                 | Specifically held |
| `pf1/bvvjjjidh2duqwta` | Positive Pulse                | PZO1141, p. 43                  | Specifically held |
| `pf1/bwdd2gn5l8kz3g5y` | Hunter's Blessing             | PZO9267, p. 235                 | Specifically held |
| `pf1/bydjb57jwrqbb1lw` | Twisted Innards               | PZO9235, p. 59                  | Specifically held |
| `pf1/byn5q46du0ck592a` | Speak with Dead               | PZO1110, p. 346                 | Specifically held |
| `pf1/byujylu0s5o7afom` | Aboleth's Lung                | PZO1121, p. 189                 | Specifically held |
| `pf1/bzecy8fqnpq7d06o` | Disable Construct             | PZO1129, p. 179                 | Specifically held |
| `pf1/bzrvvdbmpr9lbrvr` | Cognitive Block               | PZO1132, p. 161                 | Specifically held |
| `pf1/bzspv3l841ceq2tu` | Shadow Enchantment            | PZO9286, p. 17                  | Specifically held |
| `pf1/c0hvjnqzry149ugs` | Curse Water                   | PZO1110, p. 263                 | Specifically held |
| `pf1/c11j5pcp0f6itlr8` | Track Ship                    | PZO9422, p. 29                  | Specifically held |
| `pf1/c11olzqztodz5o5x` | Vanish                        | PZO1115, p. 253                 | Specifically held |
| `pf1/c146396cf092ozp7` | Illusory Hoard                | PZO9434, p. 29                  | Specifically held |
| `pf1/c14tjrds5emxk417` | Create Mindscape, Greater     | PZO1132, p. 163                 | Specifically held |
| `pf1/c1e7f0ct04k270wy` | Create Undead                 | PZO1110, p. 262                 | Specifically held |
| `pf1/c1w1mjhd5s6mawkk` | Disrupt Link                  | PZO9454, p. 22                  | Specifically held |
| `pf1/c21adykehhoj8d6j` | Symbol of Exsanguination      | PZO1135, p. 129                 | Specifically held |
| `pf1/c3iz720zjv922b6j` | Ray of Sickening              | PZO1117, p. 234; PZO9208, p. 57 | Specifically held |
| `pf1/c3qqu6l3vdcfaoh7` | Sequester                     | PZO1110, p. 340                 | Specifically held |
| `pf1/c3revq5uj4vtqzxb` | Condensed Ether               | PZO1132, p. 162                 | Specifically held |
| `pf1/c3vws58yy0pk47gs` | Planar Ally, Lesser           | PZO1110, p. 320                 | Specifically held |
| `pf1/c43vz4c3e3vrsmwz` | Fleeting Memory, Mass         | PZO9462, p. 25                  | Specifically held |
| `pf1/c4kdcyco9k6nq5um` | Zone of Foul Flames           | PZO9237, p. 63                  | Specifically held |
| `pf1/c547al5speg9dvoj` | Animal Ambassador             | PZO1134, p. 204                 | Specifically held |
| `pf1/c5anior2ysy6s2xy` | Raise Dead                    | PZO1110, p. 329                 | Specifically held |
| `pf1/c5ipv2mivkdb03sb` | Evolution Surge, Lesser       | PZO1115, p. 220                 | Specifically held |
| `pf1/c7gyna89uiqg5mue` | Ears of the City              | PZO9460, p. 30                  | Specifically held |
| `pf1/c7j4fxzlxyvll2t4` | Pessimism                     | PZO1135, p. 123                 | Specifically held |
| `pf1/c81jnlmi4976g7sz` | Surmount Affliction           | PZO1117, p. 241                 | Specifically held |
| `pf1/c8hh34o1ivvnnx32` | Sanctify Weapons              | PZO9255, p. 50                  | Specifically held |
| `pf1/c8jk0q8v39uvzsxx` | Delay Poison, Communal        | PZO1118, p. 227                 | Specifically held |
| `pf1/c8pgzp2xc1l1upbs` | Inflict Pain                  | PZO1132, p. 174                 | Specifically held |
| `pf1/c99w6rm28rpz14xu` | Spirit-Bound Blade            | PZO1132, p. 186                 | Specifically held |
| `pf1/c9a27yvlb5mrow83` | Boiling Blood                 | PZO1117, p. 209                 | Specifically held |
| `pf1/cXuzSqklJEBXhZqg` | Planned Assault               | PZO9408, p. 23                  | Specifically held |
| `pf1/ca2qcoyk1rgjysb0` | Conditional Curse             | PZO1134, p. 206                 | Specifically held |
| `pf1/cagn38jcxzmcgf7g` | Cast Out                      | PZO1115, p. 210                 | Specifically held |
| `pf1/cb2svqlo50o2gd6k` | River Whip                    | PZO1129, p. 191                 | Specifically held |
| `pf1/cc0or00vpiky87n7` | Spellcrash, Greater           | PZO1129, p. 194                 | Specifically held |
| `pf1/ccklt2ehmeacsojx` | Spear of Purity               | PZO1117, p. 240                 | Specifically held |
| `pf1/cclnwi6pw4mewvd7` | Word of Resolve               | PZO1117, p. 249                 | Specifically held |
| `pf1/cdaib7n0z1tv1qpq` | Anchored Step                 | PZO1129, p. 173                 | Specifically held |
| `pf1/cdedzw5d9ui73ua7` | Dragon's Breath               | PZO1115, p. 217                 | Specifically held |
| `pf1/cdi27awh6aua4aif` | Surface Excursion             | PZO9479, p. 21                  | Specifically held |
| `pf1/ce52lzu5he8eglfh` | Familiar Melding              | PZO1117, p. 219                 | Specifically held |

## Mechanics and prose review

All **99 complete descriptions** and **all action payloads** are checked. The required note/action-conditional/Item Ability collector has **0 required inputs** for these recorded Spells; no Spell grants ordinary Modifiers. **35 optional description drafts** were generated, then every description was independently reviewed, including those the phrase-triggered pass does not draft. Proficiency/casting/crafting/target restrictions stay with exact descriptions and manual summaries; no unrelated feature-selection prerequisites or proficiency grants are invented. Running Spell Effects and targeted Item Abilities are separate definitions; this curation does not implement them or add that scope.

Shared Situations are reused for Mind Blank (mindAffecting), Inheritor’s Smite (bullRush), Blade of Bright Victory (disarm/sunder), Positive Pulse (death/negativeEnergy), Word of Resolve (fear), Delay Poison, Communal (poison), and Anchored Step (bullRushGround/tripGround/overrun/reposition). Ground restrictions remain explicit for Anchored Step’s overrun/reposition Notes. Other circumstances without reviewed shared equivalents remain local, including charm (distinct from enchantment), energy drain, haunts, reading lips, truth/attitude checks, water/ground contact and fire excluding the user’s own reflected magic. Notes do not grant unconditional statistics.

**Nine prior inherited-context entries** use checked covered/no-output records: Shout, Keen Edge, Mount, Shambler, Spellcasting Contract (Lesser), Ethereal Jaunt, Planar Ally (Lesser), Raise Dead and Evolution Surge (Lesser). Their complete imported descriptions already supply readable rules; adding duplicate Notes or new warning payloads would alter earlier held content closures. Six still have inventory integration gaps. **68 Spells have independently outstanding running mechanics**, while **62 carry optional prose unresolved diagnostics**. Required curation passes without claiming those integrations complete.

| Spell                         | Independently outstanding mechanics                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| Shout                         | Conditional deafened integration.                                                                       |
| Blasphemy                     | Conditional dazed/paralyzed/helpless and rolled Strength reduction integrations.                        |
| Raise Animal Companion        | Inherited negative levels/Constitution drain and restoration of damaged abilities.                      |
| Sense Spirit Magic            | Chosen spirit lists, conditional skill/save bonuses and flat-footed exception.                          |
| Blood of the Martyr           | Conditional bleeding integration; rolled damage and healing remain manual.                              |
| Keen Edge                     | Targeted weapon threat doubling and damage-type eligibility; ammunition handling.                       |
| Enervation                    | Rolled temporary negative-level and temporary-HP integrations.                                          |
| Possess Object                | Possessed-object statistics and temporary affliction suspension.                                        |
| Speechreader's Sight          | Running conditional -4 Perception while reading lips.                                                   |
| Garrulous Grin                | Running skill penalties in the two distinct local Situations.                                           |
| Deft Digits                   | Separate animated glove movement/Strength and skill-DC integrations.                                    |
| Transmute Rock to Mud         | Conditional speed override and -2 attack/AC running integration.                                        |
| Oracle's Vessel               | Chosen oracle-curse benefits and casting-list/feature integrations.                                     |
| Fear                          | Conditional panicked/cowering/shaken integrations.                                                      |
| Marid's Mastery               | Running attack/damage modifiers in two distinct local Situations.                                       |
| Anticipate Thoughts           | Chosen opponent, save outcome and evolving insight attack/damage/AC bonuses.                            |
| Absurdity                     | Running -2 initiative, local -10 Sense Motive and conditional fear protections.                         |
| Magic Fang, Greater           | Chosen single/all natural weapon or unarmed target enhancement and DR rules.                            |
| Litany of Thunder             | Conditional persistent deafened and one-round confused integrations.                                    |
| Faerie Fire                   | Running -20 Stealth and concealment exceptions.                                                         |
| Mind Blank                    | Running +8 resistance saves in shared mindAffecting Situation.                                          |
| Ancestral Communion           | Running Knowledge insight formula and consulted-check local Situation.                                  |
| Inheritor's Smite             | Next-melee attack bonus and conditional bull rush CMB integration.                                      |
| Alleviate Addiction           | Conditional addiction-effect suppression while recovery remains manual.                                 |
| Deathwine                     | Chosen potion level, one-spell necromancy caster-level bonus.                                           |
| Twilight Knife                | Separate floating-knife Attack Routine with ability choice, flanking and sneak-attack dice.             |
| Halfling Vengeance, Mass      | Inherited dagger/sling precision dice and conditional target Dexterity denial/attack penalties.         |
| Beast Shape IV                | Chosen form size, Str/Dex/Con, natural armor, movement, senses, attacks and resistance integrations.    |
| Perceive Cues                 | Running +5 competence Perception and Sense Motive Spell Effect.                                         |
| Hairline Fractures            | Conditional earth-subtype -2 AC Spell Effect.                                                           |
| Winged Sword                  | Targeted Throwing Item Ability integration; crafting substitute remains prose.                          |
| Spellcasting Contract, Lesser | Contract-specified casting and profane AC/save/check bonus; source conflict with example attacks.       |
| Ethereal Jaunt                | Running ethereal condition, movement and invisibility integrations.                                     |
| Shadow Walk                   | Conditional fatigued integration after forced shunting.                                                 |
| Dreadscape                    | Scared condition and rolled Wisdom damage; alternative sanity remains unsupported prose.                |
| Canopic Conversion            | Conditional jar-bearer Protection from Evil/Sanctuary and generated advanced mummy inputs.              |
| Blade of Bright Victory       | Targeted Ghost Touch/damage-type choice and half-CL CMD in shared disarm/sunder Situations.             |
| Symbol of Fear                | Conditional panicked integration.                                                                       |
| Simulacrum                    | Separate duplicate Character/Companion inputs, halved levels/HD and derived statistics.                 |
| Positive Pulse                | Running conditional +2 saves in shared death/negativeEnergy and local energy-drain/haunt Situations.    |
| Hunter's Blessing             | Chosen enemy/terrain Situations with +2 sacred modifiers and tracking exception.                        |
| Disable Construct             | Conditional helpless and local +4 save integration.                                                     |
| Shadow Enchantment            | Chosen simulated Spell’s supported effects and disbelief factor; encounter rolls remain prose.          |
| Vanish                        | Inherited invisible condition/Stealth and attack integrations.                                          |
| Create Mindscape, Greater     | Inherited mindscape conditional statistics and creature-state integrations.                             |
| Disrupt Link                  | Temporary suppression of linked-companion contributions, Alertness and devotion.                        |
| Symbol of Exsanguination      | Recurring bleeding and sickened condition integrations.                                                 |
| Ray of Sickening              | Conditional sickened integration; inherited ranged touch retained.                                      |
| Sequester                     | Inherited invisibility and suspended-animation helpless-state integrations.                             |
| Condensed Ether               | Running speed, -2 AC/Reflex and attack restrictions.                                                    |
| Zone of Foul Flames           | Conditional +4 fire saves with own-fire exception.                                                      |
| Animal Ambassador             | Temporary Awaken ability/HD inputs, language, capped skill ranks and class-skill grants.                |
| Raise Dead                    | Permanent negative levels/Constitution drain and damaged-ability restoration; HP/casting loss manual.   |
| Evolution Surge, Lesser       | Temporary chosen evolution benefits, prerequisites and natural-attack cap for version-specific eidolon. |
| Ears of the City              | Conditional blinded/deafened integrations; skill substitution remains prose.                            |
| Pessimism                     | Running variable penalties and exclusion of morale contributions.                                       |
| Surmount Affliction           | Chosen condition suppression and later restoration.                                                     |
| Sanctify Weapons              | Chosen subtype and targeted weapon DR-bypass integration.                                               |
| Delay Poison, Communal        | Conditional suspension of poison-derived penalties/damage.                                              |
| Inflict Pain                  | Running -4 attack, skill and ability-check Spell Effect.                                                |
| Spirit-Bound Blade            | Targeted chosen Item Abilities and phantom-matching +2 skill bonuses.                                   |
| Boiling Blood                 | Conditional orc-subtype +2 morale Strength Spell Effect.                                                |
| Planned Assault               | Conditional scaled sacred AC/save/check effect; conflicting example bonus type remains undecided.       |
| Conditional Curse             | Chosen inherited Bestow Curse ability/check penalties and permanent curse integration.                  |
| River Whip                    | Created weapon Attack Routine and local fire-subtype dice/next extinguish-save integration.             |
| Spear of Purity               | Conditional blinded integration.                                                                        |
| Anchored Step                 | Ground-gated CMD Situations and speed reduction with minimum 5.                                         |
| Familiar Melding              | Possessed familiar mixed ability/class/attack inputs and linked-body death handling.                    |

Seven Spells retain explicit source disagreements:

| Spell                         | Disagreement                                                                                                                                                                             |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shout                         | The crystalline action uses save.type ref, while the description grants crystalline creatures Fortitude half and only holders of objects Reflex negates. Preserve both; choose manually. |
| Litany of Thunder             | Action duration is 1 round, but deafened in description persists until removed; confusion alone lasts 1 round.                                                                           |
| Dissolution                   | The literal published upstream text says 1d0 points of damage on displaced return. No permitted evidence resolves the apparent typo; do not substitute another die.                      |
| Spellcasting Contract, Lesser | Main rule names profane AC, saving throws and checks; example names attacks, saves and checks. No printed evidence settles AC versus attack.                                             |
| Ray of Sickening              | Action save description says Fortitude partial, while complete description says failed save sickened and successful save unaffected.                                                     |
| Planned Assault               | Main rule says sacred and checks, while its example says morale and all actions. Preserve both disagreements; no bonus type or scope guessed.                                            |
| Dragon's Breath               | Line action has range 30 feet and ray template size 30; every line option in description is 60 feet. Both actions omit the description’s 1d6/CL maximum 12d6 damage and element choice.  |

The descriptor importer affects **38 roots** and reads `system.types` rather than pinned `system.descriptors`; exact raw descriptor lists and affected keys are retained in inventory. Spell actions are inert unsupported payloads, not interpreted casting/attack execution. Missing metadata mappings belong to #719/#720 and are reported without changing the tools. No correction is guessed for source conflicts.

## Public demonstration and checks

[Catalog tests](../../tests/catalog/spells-526.test.ts) replay source bytes, exact every-key output, complete bindings, notice enforcement, shared/local Situations, numeric disagreements and public resolver behavior. Perceive Cues (+5 competence Perception/Sense Motive), Mind Blank (+8 resistance), Anchored Step (+10 CMD/speed minimum 5) and Boiling Blood (+2 morale Strength for orcs) remain recorded Spells without applying running effects. Numeric text changes invalidate checked prose; inherited Magic Fang changes invalidate Greater Magic Fang’s whole-content binding.

[Saved-sheet integration](../../convex/catalogSpells526.integration.test.ts) installs Boiling Blood and Mind Blank only into an isolated convex-test Character catalog, then browses, records and removes them through public APIs. Members share persisted results; unauthorized, unauthenticated, wrong-campaign and other-Character references are refused. Public current/permanent calculations and client preview agree. This internal fixture installation demonstrates consumers, not permission to publish held content. There are no legally admitted batch entries to demonstrate.

Checks run sequentially with `CI=true` and the inherited external `TMPDIR` under `~/repos/everythingpath/.ep-tmp/`; no full test suite. Gate outcomes and preservation audit are recorded below.

The final full-source audit verifies **99 exact whole-content bindings** and **119 complete-context fixture entries**. The bounded gate has **83 holds and 16 selection-only broken references**; with full source context, **99 batch holds, 0 admissions, 0 batch failures and 0 dependent omissions**. Global required coverage has 3,687 candidates (104 checked, 3,583 missing), and the full corpus retains 4,689 unrelated admission/structure failure rows. Global output is 23,109 entries and 538 resources, with 58 admitted, 23,196 held, 2 dependent omissions and no retained exceptions. These corpus failures prevent a release-readiness claim, not completion of this bounded inventory. Final full-source catalog file SHA256: `d25554f6665c9beba56c5865db8e97a24968eadecd13f291627a341c4024df4d`.

Preservation was checked by identity and exact value: **2121 old overlay records, 2334 assessments, 2313 evidence identities, 1016 notice holds and 355 Registry entries** remain unchanged. Shared Situations and remaps are unchanged. Additions: 99 checked description records, 99 assessments, 99 evidence identities and 42 notice holds. Earlier batch fixture tests also pass with the nine covered/no-output roots.

Commands used the two pinned source paths named above. Candidate selection and draft/preview output were confined to ignored scratch; scratch was deleted after recording results. The inherited external TMPDIR was retained for the launcher to clean.

```sh
PF1_CURATION_SYSTEM="/home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1"
PF1_CURATION_CONTENT="/home/andreas/repos/everythingpath/sources/pf1-content"
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/spells-526/keys.json --out .scratch/spells-526/draft
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/spells-526/keys.json --records .scratch/spells-526/draft/records.json --descriptions --out .scratch/spells-526/prose
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/spells-526/keys.json --records scripts/catalog/reviewed-curation.json --descriptions --out .scratch/spells-526/checked
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/spells-526/full-drafts
pnpm -s catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/spells-526/keys.json --out .scratch/spells-526/final-bounded
pnpm -s catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/spells-526/final-full
CI=true pnpm -s typecheck
CI=true pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm catalog:notice-deps
pnpm -s catalog:format --check
CI=true pnpm test tests/catalog convex/catalogSpells526.integration.test.ts
# Lint retry, same rules and scope, larger heap:
CI=true node --max-old-space-size=8192 --max-semi-space-size=256 ./node_modules/eslint/bin/eslint.js . --ignore-pattern 'convex/**'
CI=true node --max-old-space-size=8192 --max-semi-space-size=256 ./node_modules/eslint/bin/eslint.js convex
CI=true pnpm -s lint:unused
```

| Check                                     | Result                                                                                                                                               | Measured duration  |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Exact initial draft                       | Pass: 2,121 existing records, 0 new required drafts; no required missing/unresolved mechanics.                                                       | —                  |
| Separate prose draft                      | Pass: 35 optional drafts; all 99 Spell descriptions subsequently checked.                                                                            | —                  |
| Checked resume                            | Pass: 2,220 records, 0 new, 0 replaced, 0 required missing/unresolved. 68 inventory gaps and 62 optional prose diagnostics remain.                   | 8.95s              |
| Full-corpus curate                        | Pass: 5,803 records, 3,583 new drafts, 0 replaced, 0 missing; 758 unresolved required mechanics in corpus. Unreviewed drafts stay outside artifacts. | 169.86s            |
| Final bounded preview                     | Expected exit 1: 99 extracted Spells, 1 folder excluded; 83 held, 16 bounded-reference failures, 0 admitted.                                         | 11.56s             |
| Final full-source preview                 | Expected exit 1: corpus counts above; all 99 batch roots held with 0 batch failures.                                                                 | 196.33s            |
| Typecheck                                 | Pass.                                                                                                                                                | approximately 30s  |
| Standard lint                             | Exit 134: app ESLint exhausted its configured 4 GiB V8 heap.                                                                                         | 159.98s            |
| eslint-app-8g                             | Pass. Same lint rules; no package/tool changes.                                                                                                      | 73.33s             |
| eslint-convex-8g                          | Pass. Same lint rules; no package/tool changes.                                                                                                      | 38.57s             |
| lint-unused                               | Pass. Same lint rules; no package/tool changes.                                                                                                      | 1.99s              |
| Writer inventory                          | Pass.                                                                                                                                                | 0.85s              |
| Catalog pin                               | Pass.                                                                                                                                                | 0.28s              |
| Notice dependencies                       | Pass: 4,174 recorded dependencies on 2,402 curated candidates in 28 inventories; 0 gaps, waived or stale. All 36 advisories are outside #526.        | 0.88s              |
| Canonical data formatting                 | Pass after formatting added assessments; initial check correctly reported noncanonical ordering.                                                     | approximately 0.5s |
| Catalog and batch tests                   | Pass: **1,741 tests in 75 files**, including **23 batch catalog tests and 1 isolated saved-sheet integration**. No full suite.                       | 49.95s             |
| Final source/fixture/binding preservation | Pass: 99 current bindings, 119 full-source entries; prior shared identities unchanged.                                                               | —                  |

## Workflow observations and time

- The exact inventory includes a folder, so “100 candidates” is not “100 Spell definitions.” Counts reconcile explicitly rather than introducing a replacement candidate.
- Bounded references need full-context evidence; a green required-note gate is not full mechanics or legal completeness. The full-source gate’s old corpus gaps remain visible.
- Nine inherited-context descriptions require covered/no-output records to preserve earlier held closures while still reporting six running-integration gaps.
- Initial local Situation drafts used strings; the closed schema correctly rejected them. Corrected records use `{ local: label }`, with no parser changes.
- An initial fixture replay lacked the empty content `src` directory. The tracked `.gitkeep` supplies it. Copying byte-identical read-only source fixtures also preserved file modes, causing the initial numeric-change test to fail with EACCES; only fixture copies were made writable, and the final full test command passes.
- The canonical formatter sorts fingerprint-map keys; final audit compares object values independently of property order. The complete DisplayFullSpell PCGen row was selected separately from its earlier TEMPDESC mechanics row.
- Default lint exhausted 4 GiB. Equivalent app/Convex ESLint checks were rerun sequentially with 8 GiB, followed by the existing unused-code gate. The standard command’s failure remains reported; no configuration or product fix was introduced.
- No imported runtime, deployment, initial cutover/#413 work, Git/GitHub write, environment-file/private-E2E access or pinned-source mutation. Changes remain uncommitted; the launcher captures the final answer at its supplied `-o` path.

Approximate time by phase: orientation/permitted source comparison **6 minutes**; complete description/action/inherited-notice review and records **5 minutes**; fixture/binding work and preliminary previews **11 minutes**; sequential final gates/tests/lint retry **13 minutes**; report, formatting and cleanup **2 minutes**. Measured final check durations are itemized above; the fixture preflight and memory retry account for avoidable workflow time.

## Review fix round 1 — 2026-10-09

**Sol (AI curator) for the owner** completed the bounded continuation from root preparation `e84b5f73`. The earlier “uncommitted” statements describe the original curator handoff; this correction is left uncommitted for the orchestrator. The exact ticket inventory and dispositions remain **99 held Spells, 1 excluded Universal folder, 0 admissions**.

The explicitly observed CRB dependency audit now records **110 per-candidate inherited-book dependencies**, up from 91: **19 added PZO1110 dependencies**, with **17 newly required CRB notices** (Mind Blank and Ethereal Jaunt already required CRB). The batch has **187 per-candidate required notice references**, **43 minimum notice identities** and the same **42 enforced notice-chain holds**. CRB retains its previously reviewed Registry identity; no new notice, alias, coverage claim or notice hold was invented. Every whole-content and other notice hold remains. Unknown origins are still named by each `spells-526-whole-content-<ID>` hold, separate from the unchanged outstanding mechanics.

[The inventory](../../scripts/catalog/legal/spells-526.json) records literal pinned description substrings, their locations and hashes, plus exact fixed-commit PCGen CRB rows with file/row hashes under `inheritedCrbRuleEvidence`. Each added dependency links those rows through `originEvidence`. The comparison uses the same PCGen commit and verifies the previous Spell-file and campaign-file hashes; campaign copyright evidence and the existing CRB notice are preserved. This establishes observed minima, without settling complete origins or notice chains.

| Candidate                                      | Newly recorded CRB rule evidence                                                                                                                                                  |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dissolution                                    | Miracle and Wish; PCGen `cr_spells.lst` lines 399 and 675. The literal 1d0 remains.                                                                                               |
| Deathwine                                      | Detect Magic and Cure Serious Wounds; PCGen `cr_spells.lst` lines 157 and 130. The latter row retains its cleric/bard level 3 fact.                                               |
| Halfling Vengeance, Mass                       | Through pinned Halfling Vengeance: sneak attack, flanking, attacks of opportunity and 5-foot steps. PCGen `cr_abilities_class.lst` line 2868 and `cr_feats.lst` lines 34 and 167. |
| Abjuring Step; Feather Step                    | Explicit 5-foot steps, attacks of opportunity and difficult terrain.                                                                                                              |
| Steal Breath; Punishing Armor                  | Verbal components/line of effect; nonlethal damage.                                                                                                                               |
| Red Hand of the Killer; Mask Dweomer, Communal | Disguise Self; inherited Detect Magic, Arcane Sight and Analyze Dweomer.                                                                                                          |
| Mind Blank; Ethereal Jaunt                     | Explicit Miracle/Wish; invisible condition. Required CRB notices already existed.                                                                                                 |
| Hairline Fractures; Winged Sword               | Make Whole; throwing weapon ability and Magic Stone.                                                                                                                              |
| Positive Pulse; Twisted Innards                | Death effects/energy drain/negative energy; critical hits and sneak attacks.                                                                                                      |
| Illusory Hoard; Condensed Ether                | Bags of Holding/Portable Holes; Solid Fog, Blind-Fight and True Seeing.                                                                                                           |
| Spellcrash, Greater; Familiar Melding          | Inherited concentration check; familiar and retained mental abilities restated in the CRB Magic Jar rule.                                                                         |

All 99 root descriptions and their recorded linked context were checked for the same named CRB references. Generic bonus/statistic vocabulary and unidentified origins do not assign books by inference. This audit changes no expanded class lists, actions, source citations, prerequisite/proficiency facts, raw descriptions, numerical rules or stable identities.

Boiling Blood, Planned Assault and Anchored Step now show ordinary Note spaces: “causes 1 fire”, “gains +2”, “After 1 minute”, “at CL 10” and “minimum 5”. Their amounts, conditions and provenance remain. Planned Assault also exposes the literal main-rule **checks** versus example **all actions** disagreement alongside **sacred** versus **morale**. Both stay unresolved; the same seven Spells have source disagreements, and 68 have outstanding running mechanics. The report's affected prose spacing is corrected; raw source quotations are unchanged.

The correction refreshes **22 assessment/evidence bindings** and both preview fixtures. Only the three changed Notes alter content fingerprints. All **2,433 mapping fingerprints** remain unchanged, so no mapping rebind is needed. The complete-context extraction reads the pinned sources for only the existing 119 entries, verifies all 99 root bindings and retains **99 batch holds, 0 admissions, 0 failures**. The public pinned-source bounded operator retains **83 holds and 16 expected selection-only reference failures**, exiting 1 as before. The saved-sheet integration and public resolver regressions cover the repaired Notes, the three reported CRB omissions and the consistency audit. The earlier full-corpus extraction/hash/check results above describe the original handoff; unchanged full-corpus curate/research was not repeated.

Preservation checks compare exact identities and values against root preparation: **2,217 overlay records, 2,411 assessments and 2,390 evidence identities** are untouched; only three batch Notes and 22 batch assessments/evidence identities change. All previous batches, notice holds, Registry entries, remaps, shared Situations, 169 raw/context fixtures, raw quotes, source manifests, 96 other root outputs and 20 linked-context outputs are preserved. No product code, configuration, sources, environment/private files or deployment changed.

Correction checks ran sequentially with `CI=true` and the inherited external TMPDIR. The known 4 GiB standard app-lint failure is documented above; this continuation uses the brief-authorized equivalent 8 GiB scopes and rules directly, with no configuration change. No full test suite ran.

| Command/check                                                                                                                 | Correction result                                                                                                                                                                                                                                            | Duration      |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| `pnpm -s typecheck`                                                                                                           | Pass.                                                                                                                                                                                                                                                        | 21.29s        |
| `node --max-old-space-size=8192 --max-semi-space-size=256 ./node_modules/eslint/bin/eslint.js . --ignore-pattern 'convex/**'` | Pass, same app scope/rules.                                                                                                                                                                                                                                  | 95.44s        |
| `node --max-old-space-size=8192 --max-semi-space-size=256 ./node_modules/eslint/bin/eslint.js convex`                         | Pass, same Convex scope/rules.                                                                                                                                                                                                                               | 43.58s        |
| `pnpm -s lint:unused`                                                                                                         | Pass.                                                                                                                                                                                                                                                        | 2.16s         |
| `pnpm catalog:notice-deps`                                                                                                    | Pass: 4,228 recorded dependencies, 2,402 candidates, 28 inventories; 0 gaps/waivers/stale. All 36 advisories are outside this batch. This gate counts recorded dependency evidence separately from the inventory's 110 distinct candidate/book dependencies. | 1.02s         |
| `pnpm -s check:initial-migration-writers`                                                                                     | Pass: 183 registrations.                                                                                                                                                                                                                                     | 0.88s         |
| `pnpm catalog:pin`                                                                                                            | Pass; pin `sha256:d7a42ca346d875f9497c7da94325022ac289d7931226a3649979a13f410c8063`.                                                                                                                                                                         | 0.29s         |
| `pnpm test tests/catalog convex/catalogSpells526.integration.test.ts`                                                         | Pass: **1,746 tests / 75 files**, including 28 batch catalog tests and one saved-sheet integration.                                                                                                                                                          | 52.70s        |
| `pnpm -s catalog:format --check`; changed TS/Markdown Prettier check; batch JSON serialization check; `git diff --check`      | Pass. JSON retains the existing two-space serialization rather than reformatting unrelated rows.                                                                                                                                                             | under 2s each |
| Exact preservation and binding checks                                                                                         | Pass: preserved counts above; all 99 current bindings; complete-context 99 held/0 admitted/0 failed; bounded preview expected exit 1.                                                                                                                        | —             |

The focused 29-test run passed before the complete catalog gate. An initial typecheck exposed an unknown JSON-field type in the new evidence regression; validating that field with Zod corrected the test. Serialization through the admission loader normalized older assessment rationale whitespace; preservation review caught this and restored every unaffected raw record before final checks. The final canonical-data and catalog tests pass without broader data edits. The machine lacks `/usr/bin/time`, so task-owned scratch tooling recorded the durations with Python's monotonic clock. These were workflow corrections, with no importer or product fix. The existing #719/#720 gaps and bounded link failures remain as previously reported.

Approximate correction phase times: orientation/permitted evidence **6 minutes**; records/Notes/fixtures and bindings **4 minutes**; sequential validation **4 minutes**; report, final preservation and cleanup **2 minutes**. Only this task's unique ignored scratch subdirectory is removed; tracked scratch files are preserved. The inherited external TMPDIR remains for launcher cleanup. Changes remain uncommitted.

## Preparation fix round 2 — 2026-10-09

**Sol (AI curator) for the owner** corrected only the older #343 preservation test after root preparation `76dba7bd` over `321fd8e9`. Its exclusion of its own 100 candidates selected every subsequent assessment as well, so #526's 99 additions incorrectly enlarged the original 2,334-row baseline to 2,433 rows.

The test now selects the immutable original identities from [the committed key fixture](../../tests/fixtures/feats-343/original-assessment-identities.json), extracted from `e39009f83ac92c0b31af1349544bf436ef14f135`. The original count **2,334**, exact whole-row fingerprint `ad685721d0b6fb0d3d2250548c285d6013e7eb318dcf8f8e99dcad21f52dedeb`, and **99 original trailing-space rationales** remain enforced. Future batches cannot expand this identity set. Three additional regressions use real committed assessments: later additions leave the protected rows unchanged; removing an original identity fails; removing an original rationale's trailing space fails even while the original row count remains intact.

No catalog data, schema, product code, #526 bindings, holds or prepared fixtures changed. Dispositions remain **99 held Spells, 1 excluded Universal folder, 0 admissions**, with outstanding mechanics unchanged. The focused #343/#526 catalog and saved-sheet run passed **43 tests in 3 files** in **6.45 seconds** after reproducing the original count failure.

Final checks ran sequentially with `CI=true` and the inherited external TMPDIR:

| Command / check                                                                                                               | Result                                                                                                                                                                                                                                                                                             | Time          |
| ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `pnpm test tests/catalog convex/catalogSpells526.integration.test.ts`                                                         | Pass: **1,782 tests / 78 files**. No full suite.                                                                                                                                                                                                                                                   | 54.87s        |
| `pnpm -s typecheck`                                                                                                           | Pass.                                                                                                                                                                                                                                                                                              | 16.51s        |
| `node --max-old-space-size=8192 --max-semi-space-size=256 ./node_modules/eslint/bin/eslint.js . --ignore-pattern 'convex/**'` | Pass, documented equivalent app lint scope/rules.                                                                                                                                                                                                                                                  | 84.30s        |
| `node --max-old-space-size=8192 --max-semi-space-size=256 ./node_modules/eslint/bin/eslint.js convex`                         | Pass, documented equivalent Convex lint scope/rules.                                                                                                                                                                                                                                               | 44.89s        |
| `pnpm -s lint:unused`                                                                                                         | Pass.                                                                                                                                                                                                                                                                                              | 2.12s         |
| Changed-file Prettier; `pnpm -s catalog:format --check`                                                                       | Pass.                                                                                                                                                                                                                                                                                              | under 1s each |
| `pnpm catalog:pin`                                                                                                            | Pass; unchanged pin `sha256:d7a42ca346d875f9497c7da94325022ac289d7931226a3649979a13f410c8063`.                                                                                                                                                                                                     | 0.28s         |
| `pnpm -s check:initial-migration-writers`                                                                                     | Pass: 183 registrations.                                                                                                                                                                                                                                                                           | 0.85s         |
| `pnpm catalog:notice-deps`                                                                                                    | Pass: 4,534 dependencies, 2,502 candidates, 30 inventories; 0 gaps/waivers/stale, 36 existing outside-batch advisories.                                                                                                                                                                            | 1.04s         |
| Exact artifact preservation and local diff whitespace review                                                                  | Pass: 566 existing artifact files byte-identical; all 2,533 raw assessment rows unchanged; supplied original identity fixture byte-identical; only the test and appended report changed, plus the new fixture. Original whole-row fingerprint and whitespace remain protected by the passing test. | under 1s      |

Approximate phase times: orientation and failure reproduction **2 minutes**; identity fixture and regression correction **1 minute**; sequential validation **3.5 minutes**; report, preservation and cleanup **1 minute**. The workflow blocker was the older test's assumption that all out-of-batch rows belonged to its baseline. The documented 8 GiB lint scopes avoided the known 4 GiB limit without altering checks. No extra curation or product changes were needed. Only this round's task-owned scratch directory is removed; external TMPDIR remains for launcher cleanup. Changes remain uncommitted for the orchestrator.
