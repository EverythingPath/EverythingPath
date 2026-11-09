# Spell curation review: #520

Reviewed 2026-10-08 (Europe/Stockholm; original checks ran during the preceding UTC night, with fix-round checks after UTC midnight) by **Sol (AI curator) for the owner**, following [#520](https://github.com/AndreasUnunger/EverythingPath/issues/520), [PRD #251 Decisions 9, 10 and 17 and its acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461), [Spellcasting](../character-sheet/spellcasting.md), [curation](curation.md) and the [#328 precedent](races-328.md).

Exactly **100 raw candidates** receive one disposition: **0 admitted, 99 specifically held, 0 dependently omitted, 0 wholly unsupported/prose-only and 1 excluded folder**. Enchantment is a Foundry folder, not a Spell definition. Attribution, note coverage, calculation completeness and reference validity remain separate. No Catalog Release was published or activated.

## Evidence and scope

- Read-only Foundry PF1 v11.11: `418761d2e16a6037c0156bb4a241f7cea5a2986d`.
- Read-only pf1-content 11.4.0: `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`.
- [Batch inventory, legal evidence and mechanics review](../../scripts/catalog/legal/spells-520.json) records every ordered key, source path/hash, complete raw action metadata, individual missing evidence, minimum notice identities, content bindings and independent outstanding calculations.
- [Fixture provenance](../../tests/fixtures/spells-520/provenance.json) records 100 byte-identical ticket roots and 28 source-backed, unreviewed class-context files. The ordered-key digest is `93bed041f3f3954e206f759445524f9e3cb1f28fa1811b5cd50581dadd7b5c39`. All 128 file hashes were independently checked.
- [Overlay](../../scripts/catalog/reviewed-curation.json), [assessments](../../src/lib/catalog/data/attribution-assessments.json), [evidence](../../src/lib/catalog/data/attribution-evidence.json) and [enforced notice holds](../../scripts/catalog/legal/held-notices.json). Existing identities, remaps and shared Situations remain intact; no Registry entry or alias is added.

Permitted PCGen comparison uses commit `25523dbcf10e86c280fc0f447167ea43d67419d3`: [CRB Spell data](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_spells.lst) and [campaign metadata](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/core_rulebook.pcc). Fresh retrieval has the exact previously recorded file hashes. Ten direct CRB descriptions were compared; eight match after HTML/entity/UUID presentation, case, whitespace and punctuation normalization. Glyph of Warding differs in trapfinding wording; Control Weather differs in table presentation. Both literal comparator lines and hashes are retained. No whole-content equality or publication-chain completeness follows from direct prose equality: expanded class/granted lists, actions/material fields and linked origins still need permitted evidence. PCGen's Paizo Inc. wording is not declared equivalent to the reviewed Registry Paizo Publishing, LLC line. No book PDFs were available; Archives of Nethys was not used. Upstream data was read as inert text, with no runtime imported or executed.

The batch names **50 observed minimum notice identities**: 48 publication codes, the existing immutable Bestiary 3 notice identity and the dated custom **Paizo Blog - Ultimate Cantrips** source on Scoop. These are not a complete origin bound. Twenty-four identities have exact compilation-line leads, which remain unaccepted. CRB's existing reviewed identity is reused; **49 notice/notice-chain requirements** are individually recorded and enforced: 48 batch holds and the reused #264 Bestiary 3 complete-chain hold. Each of the 99 whole-content holds has its own unresolved, content-bound assessment and evidence. Twenty-four roots have literal linked-content leads, involving 22 unique direct linked keys; named inherited-rule context is separately pinned. The explicit `brimoraksB6` marker in Rift of Ruin contributes the observed Bestiary 6 lead. Linked definitions are not extra reviewed/admitted candidates. No publication-code alias is guessed for Scoop's blog source.

## Fix-round inherited-rule audit

The fix round reviewed all **99 complete descriptions**, their actions, literal links and already-pinned inherited context. Following the owner's rule, any text that grants, restates or depends on another book's rules needs that book's known notice identity. Named conditions, skill procedures, equipment properties, class features, spells and creature abilities count; generic game-stat vocabulary alone does not identify an origin. This adds **68 spell-to-notice requirements across 58 candidates**. The other 41 descriptions retain their already-recorded minimum requirements. All 99 unresolved assessments and inventory bindings are refreshed against a fresh full CLI extraction, keeping whole-content, notice-chain and calculation gaps separate.

The CRB additions reuse **PZO1110**, matching Enlarge Spell and Detect Magic's existing **CRB** alias precedent. Bestiary 1/2/4 and Ultimate Campaign reuse repository-known product identities. Bestiary 3 has no reviewed product-code alias: Summon Giant Ally II requires the existing immutable notice `pf1-content/notice/b840ae33b9e70cfac2d8606381d06e4d1d147ee00e1ddc24edc2daf84ec77078` and its existing #264 complete-chain hold. No notice text, Registry entry or alias is created. Four new batch hold registrations are added; the reused #264 hold gains this batch's evidence reference. Precise pinned PCGen creature lines and hashes for Bestiary 2/3/4 giants are retained under `comparisonSources.inheritedCreatureSources` in the inventory.

Phantom Hunt's tremorsense publication origin remains specifically unbounded; no extra notice identity is guessed. Transmute Wine to Blood's Bestiary 2 blood-drain lead is an observed minimum, with exact original publication and complete origins still held. The `by1` typo in Lighten Object, Mass is corrected to `by 1`; its running calculations remain prose. [Full-context binding fixture](../../tests/fixtures/spells-520/binding-preview.json) retains all 99 roots and only their recursive catalog dependencies from the fresh full CLI output, so every content/mapping/evidence/notice binding can be replayed through the public helper. The reduced parser preview is regenerated independently from the existing source-byte fixtures.

Every added notice and its reason follows; the inventory retains each exact key and pinned root location.

| Spell | Added known notice | Inherited-rule reason |
| --- | --- | --- |
| Restful Sleep | PZO1110 | Restates full-day bed-rest natural healing as twice character level. |
| Hungry Pit | PZO1110 | Depends on normal falling damage and the Climb procedure. |
| Open Book | PZO1110 | Modifies the Diplomacy gather-information skill use. |
| Sealed Life | PZO1110 | Changes Shield Other damage transfer and Vampiric Touch benefits. |
| Haunting Reminder | PZO1110 | Uses Intimidate coercion to change attitude and imposes shaken. |
| Blade Tutor's Spirit | PZO1110 | Modifies charge, fighting defensively and Power Attack penalties; names Disintegrate, Dispel Magic, rod of cancellation and sphere of annihilation interactions. |
| Dragonvoice | PZO1110 | Modifies Perception hearing penalties for distance and intervening doors. |
| Swallow Your Fear | PZO1110 | Depends on frightened/panicked and changes specific confused-condition table results. |
| Innocence | PZO1110 | Distinguishes Bluff feinting, diversion and secret-message skill uses. |
| Adhesive Blood | PZO1110 | Depends on the universal solvent item dissolving adhesive. |
| Severed Fate | PZO1110 | Imposes shaken and names Dispel Magic and Remove Curse removal. |
| Sonic Scream | PZO1110 | Restricts bardic performance and verbal spell components. |
| Instant Armor | PZO1110 | Grants normal chainmail, banded mail, half-plate and full plate properties, including armor bonus, maximum Dexterity and arcane failure. |
| Mad Sultan's Melody | PZO1110 | Inherits Fascinate bardic performance, its DC and performance-round limits. |
| Naga Shape I | PZO1110 | Restates Beast Shape II Large-form bonuses and inherited movement/senses while changing spell components. |
| Phantom Hunt | PZO1110 | Depends on animal companion, darkvision and Survival tracking at full speed. |
| Whispering Lore | PZO1110 | Uses the Knowledge nature, dungeoneering, local and planes skill categories. |
| Keen Senses | PZO1110 | Grants low-light vision and modifies its normal viewing distance. |
| Songbird | PZO1110 | Modifies Perform accompaniment and the bardic performance daily-round resource. |
| Dust Form | PZO1110 | Grants incorporeal and changes squeezing/space rules. |
| Spiked Pit | PZO1110 | Depends on normal falling damage and the Climb procedure. |
| Wall of Nausea | PZO1110 | Imposes nauseated/prone, requires Acrobatics and grants partial concealment with its 20% miss chance. |
| Delay Disease | PZO1110 | Suspends existing disease effects and grants temporary immunity to exposure. |
| Assumed Likeness | PZO1110 | Restates Disguise Self Disguise bonus and depends on Disguise, Sense Motive and related skill uses. |
| Synaptic Pulse, Greater | PZO1110 | Imposes stunned on failed save and sickened on successful save. |
| Memory Lapse | PZO1110 | Changes when Diplomacy, Intimidate and opposed skill checks can be retried. |
| See Through Stone | PZO1110 | Depends on normal/low-light/darkvision viewing and preserves concealment for stone obstacles. |
| Vine Strike | PZO1110 | Imposes entangled on the struck creature. |
| Arrow of Law | PZO1110 | Imposes dazed on chaotic outsiders. |
| Spirit Call | PZO1110 | Depends on the druid domain Spell list. |
| Effortless Armor | PZO1110 | Changes worn armor speed reduction and armor check penalty. |
| Stumble Gap | PZO1110 | Imposes prone while preserving the spell-specific roll penalty. |
| Pierce Facade | PZO1110 | Modifies the Perception skill use to see through disguises. |
| Brittle Portal | PZO1110 | Reduces the object hardness damage rule. |
| Air Bubble | PZO1110 | Restates the underwater projectile penalty of -2 per 5 feet. |
| Light Prison | PZO1110 | Imposes blinded when passing through the prison walls. |
| Sanctify Corpse | PZO1110 | Grants a named Permanency option with minimum caster level and cost. |
| Putrefy Food and Drink | PZO1110 | Depends on holy/unholy water and potion/elixir object saving throws. |
| Burst of Radiance | PZO1110 | Imposes blinded or dazzled. |
| Sotto Voce | PZO1110 | Imposes shaken. |
| Eruptive Pustules | PZO1110 | Imposes sickened or nauseated. |
| Challenge Evil | PZO1110 | Imposes sickened if the target fails to attack. |
| Ego Whip II | PZO1110 | Inherited Ego Whip I imposes staggered on a failed save. |
| Ego Whip IV | PZO1110 | Inherited Ego Whip I imposes staggered on a failed save. |
| Psychic Crush V | PZO1110 | Inherited Psychic Crush chain imposes sickened and dying. |
| Lighten Object, Mass | PZO1110 | Inherited Lighten Object changes armor check penalty and preserves light/medium/heavy armor category. |
| Dazzling Blade, Mass | PZO1110 | Inherited Dazzling Blade modifies Bluff feint/disarm CMB/CMD and imposes blinded/dazzled. |
| Bullet Ward | PZO1110 | Restates adamantine hardness 20 and object AC/hit-point rules. |
| Umbral Infusion | PZO1112 | Grants and restates the Bestiary advanced simple template quick rules: +2 rolls/DCs, +4 AC/CMD and +2 hp per Hit Die. |
| Spirit Call | PZO1129 | Depends on the shaman spirit magic Spell list and distinguishes its wandering spirit. |
| Lightning Lash Bomb Admixture | PZO1115 | Changes alchemist bombs, discoveries and direct-hit/splash targeting. |
| Lightning Lash Bomb Admixture | PZO1110 | Inherited Bomb uses the Throw Splash Weapon special attack. |
| Bless Army | PZO1125 | Modifies the Mass Combat Offense Modifier (OM) and Morale checks. |
| Sealed Life | PZO1115 | Suppresses the summoner Life Link damage-transfer class ability. |
| Analyze Aura | PZO1118 | Reveals the gunslinger grit-pool resource. |
| Bullet Ward | PZO1118 | Intercepts firearm attacks using the firearm rules. |
| Dust Form | PZO1112 | Grants the incorporeal universal monster ability with a spell-specific attack override. |
| Instant Armor | PZO1112 | Depends on incorporeal attacks bypassing ordinary armor while force armor resists that bypass. |
| Possession | PZO1110 | Preserves normal two-weapon attack limits and distinguishes incorporeal hosts. |
| Shadowform | PZO1110 | Depends on illusion disbelief Will saves and changes damage/effect reality on failed disbelief. |
| Summon Totem Creature | PZO1112 | Summons the named Bestiary animals, vermin and small elementals using their creature rules. |
| Rift of Ruin | PZO1112 | Summons named bebilith, vrock, shadow demon, succubus and babau creature rules; Bestiary 6 brimoraks remain separately required. |
| Summon Giant Ally II | PZO1112 | Summons fire, frost, hill and stone giants from Bestiary creature definitions. |
| Summon Giant Ally II | PZO1116 | Summons marsh and wood giants; pinned PCGen Bestiary 2 creature data gives pages 129 and 132. |
| Summon Giant Ally II | Bestiary 3 (existing immutable notice) | Summons cave, desert and jungle giants; pinned PCGen Bestiary 3 gives pages 126-128. Existing immutable notice identity and #264 chain hold reused without a publication-code alias. |
| Summon Giant Ally II | PZO1127 | Summons river and slag giants; pinned PCGen Bestiary 4 gives pages 128-129. |
| Transmute Wine to Blood | PZO1116 | Feeds a creature using the blood drain universal monster ability. Pinned Bestiary 2 source names page 294; other republications do not establish complete origins. |
| Sanctify Corpse | PZO1112 | Overrides undead spawn rules of the named shadow, vampire and wraith creatures. |

## Every-key disposition

Each Spell has an individual `spells-520-whole-content-<ID>` hold. Its missing whole-content evidence and corresponding notice-chain holds are recorded in the inventory; technical and mechanical findings do not replace these dispositions.

| Exact key | Candidate | Upstream root citation | Disposition |
| --- | --- | --- | --- |
| `pf1/4mw83czf7b62rar3` | Possession | PZO1132, p. 180 | Specifically held |
| `pf1/4n9gp6b46h74y70m` | Restful Sleep | PZO1115, p. 239 | Specifically held |
| `pf1/4nqhjbhtb3cdk4oq` | Scoop | Paizo Blog - Ultimate Cantrips | Specifically held |
| `pf1/4osvw3l6mq9unkec` | Hungry Pit | PZO1115, p. 228 | Specifically held |
| `pf1/4pryfl3cihbio5ph` | Spellscar | PZO9237, p. 61 | Specifically held |
| `pf1/4qi3kgyoxtf44wa2` | Open Book | PZO1134, p. 220 | Specifically held |
| `pf1/4qriqew7d2ot7wr5` | Interplanetary Teleport | PZO1117, p. 225; PZO9014, p. 54; PZO9226, p. 295 | Specifically held |
| `pf1/4ratngmltr3z4om5` | Angelic Aspect, Lesser | PZO9431, p. 28 | Specifically held |
| `pf1/4rcae3wehy2juylt` | Sealed Life | PZO1132, p. 185 | Specifically held |
| `pf1/4re1j2w8wkvsvnsi` | Heal | PZO1110, p. 294 | Specifically held |
| `pf1/4rjud9uoofhbwhht` | Badger's Ferocity | PZO1117, p. 207 | Specifically held |
| `pf1/4s303nois8h7vhol` | Lighten Object, Mass | PZO9267, p. 236 | Specifically held |
| `pf1/4spxwz9fa4yy6lee` | Haunting Reminder | PZO1138, p. 37 | Specifically held |
| `pf1/4sqpli43uba4sh4k` | Blade Tutor's Spirit | PZO9455, p. 30 | Specifically held |
| `pf1/4t0gx9k12vul6hcs` | Bless Army | PZO9433, p. 29 | Specifically held |
| `pf1/4uor0rnae7hsi08r` | Dragonvoice | PZO9434, p. 28 | Specifically held |
| `pf1/4us7onfzhbh9ng20` | Constricting Coils | PZO9042, p. 71 | Specifically held |
| `pf1/4ut0m4azu6ypktct` | Ego Whip II | PZO1132, p. 169 | Specifically held |
| `pf1/4uzseabeqamqnmb6` | Swallow Your Fear | PZO9035, p. 73 | Specifically held |
| `pf1/4vdqcx71cqhy7y5m` | Harvest Season | PZO9460, p. 23 | Specifically held |
| `pf1/4vktns8ei7kyjr1z` | Sensory Overload | PZO9477, p. 11 | Specifically held |
| `pf1/4vofunusuut7iyk2` | Aura of Cannibalism | PZO1130, p. 9 | Specifically held |
| `pf1/4w51afqi5d9t8nl4` | Innocence | PZO1115, p. 229 | Specifically held |
| `pf1/4wq7yxu0wyl0na7y` | Adhesive Blood | PZO1129, p. 172 | Specifically held |
| `pf1/4x4ozs8ps7tfbgpd` | Severed Fate | PZO1115, p. 324 | Specifically held |
| `pf1/4x952ltk0uwp158t` | Vengeful Comets | PZO9237, p. 62 | Specifically held |
| `pf1/4y42ffrppap34t4i` | Blade of Light | PZO1138, p. 16 | Specifically held |
| `pf1/4ya1fs9tyvsqnwqx` | Status | PZO1110, p. 349 | Specifically held |
| `pf1/4yfd85igzmvu154c` | Sonic Scream | PZO1129, p. 193 | Specifically held |
| `pf1/4z7u1ne2q0gg4o1d` | Shadowform | PZO9466, p. 31 | Specifically held |
| `pf1/50maksnxymh9jsj2` | Instant Armor | PZO1115, p. 229 | Specifically held |
| `pf1/51ob5y7phwlhcuzz` | Power Word Kill | PZO1110, p. 324 | Specifically held |
| `pf1/522dibwtdu2g7sj0` | Mad Sultan's Melody | PZO1135, p. 122 | Specifically held |
| `pf1/52v3fogun1n9jzum` | Suggestion, Mass | PZO1110, p. 350 | Specifically held |
| `pf1/53dyu81yaw4y0nz4` | Glyph of Warding | PZO1110, p. 290 | Specifically held |
| `pf1/53ie187gupbkvy4w` | Summon Totem Creature | PZO9417, p. 29 | Specifically held |
| `pf1/53vo7qevfn8nbgiq` | Phantom Hunt | PZO9451, p. 31 | Specifically held |
| `pf1/53xzqcqwd66x85bf` | Whispering Lore | PZO1121, p. 29 | Specifically held |
| `pf1/54fxhdcdrkiezk89` | Rift of Ruin | PZO1139, p. 185, 48 | Specifically held |
| `pf1/54nk5mvt5tcir34z` | Transmute Wine to Blood | PZO9427, p. 30 | Specifically held |
| `pf1/54x9nw6ni4rpphcn` | Keen Senses | PZO1115, p. 230 | Specifically held |
| `pf1/54xmgohtp85buj04` | Songbird | PZO1141, p. 44 | Specifically held |
| `pf1/55jB63sBH4GLV5Mm` | Litany of Duty | PZO9488, p. 13 | Specifically held |
| `pf1/55m6rzymtt3toun7` | Nauseating Trail | PZO1129, p. 189 | Specifically held |
| `pf1/55msrqr7s83d02s8` | Devil Snare | PZO9464, p. 17 | Specifically held |
| `pf1/55pmjxfohtp20m0l` | Dust Form | PZO1118, p. 228 | Specifically held |
| `pf1/55yke7az6gco0tyn` | Spiked Pit | PZO1115, p. 246 | Specifically held |
| `pf1/56atnwmo4s61hi45` | Wall of Nausea | PZO1129, p. 199 | Specifically held |
| `pf1/56jxdumi2wuf6p6t` | Seek Shelter | PZO9292, p. 62 | Specifically held |
| `pf1/56ntc8i3qfn2nyxc` | Umbral Infusion | PZO9466, p. 31 | Specifically held |
| `pf1/578t0lra5ll3aifs` | Control Weather | PZO1110, p. 261 | Specifically held |
| `pf1/57es4kax66ag4tw7` | Naga Shape I | PZO9473, p. 19 | Specifically held |
| `pf1/57knlirgsjn5qz93` | Dazzling Blade, Mass | PZO9232, p. 5 | Specifically held |
| `pf1/5817mpDMdZrVJXp7` | Enchantment | None (folder) | Excluded: folder |
| `pf1/597thk7efof38132` | Delay Disease | PZO1121, p. 155 | Specifically held |
| `pf1/5at5npyf27sv01c6` | Analyze Aura | PZO1132, p. 156 | Specifically held |
| `pf1/5bhg2kgip9fwnlem` | Mirror Transport | PZO1129, p. 188 | Specifically held |
| `pf1/5bkqxi1071265kdi` | Assumed Likeness | PZO9292, p. 58 | Specifically held |
| `pf1/5brzibsbbixku992` | Black Mark | PZO1121, p. 69 | Specifically held |
| `pf1/5cdmojmydhwowzy1` | Teleport, Greater | PZO1110, p. 359 | Specifically held |
| `pf1/5dqqieb7vr4ated0` | Call Construct | PZO1117, p. 210 | Specifically held |
| `pf1/5e59yooo5w3tu2dk` | Synaptic Pulse, Greater | PZO1132, p. 187 | Specifically held |
| `pf1/5eg2f7nek9cjmv0n` | Memory Lapse | PZO1115, p. 232 | Specifically held |
| `pf1/5ervd8kkvlhe5lqi` | See Through Stone | PZO9408, p. 25 | Specifically held |
| `pf1/5f2v4g28iebx0hkq` | Summon Stampede | PZO9255, p. 51 | Specifically held |
| `pf1/5g3k1ocjvt4omciq` | Spite | PZO1115, p. 246 | Specifically held |
| `pf1/5ggd0hecvu0una9p` | Seer's Bane | PZO90102, p. 75 | Specifically held |
| `pf1/5gm3icgpwhkcaccf` | Vine Strike | PZO1140, p. 237; PZO9455, p. 31 | Specifically held |
| `pf1/5gs6obcrc14gxmo1` | Fairness | PZO9267, p. 233; PZO9418, p. 28 | Specifically held |
| `pf1/5h7qpvgnqof7oku7` | Forcecage | PZO1110, p. 285 | Specifically held |
| `pf1/5icj4nasrlgqojqm` | Form of the Dragon II | PZO1110, p. 286 | Specifically held |
| `pf1/5if5rln4qlsccrbn` | Shout, Greater | PZO1110, p. 343 | Specifically held |
| `pf1/5irolghrjaoolg0i` | Lightning Lash Bomb Admixture | PZO1118, p. 234 | Specifically held |
| `pf1/5iztb4bo8ybh1wzo` | Arrow of Law | PZO1117, p. 207 | Specifically held |
| `pf1/5j7llv2nys5makeq` | Steal Voice | PZO1117, p. 240 | Specifically held |
| `pf1/5jevjl9pf4c58rc0` | Planeslayer's Call | PZO1129, p. 190 | Specifically held |
| `pf1/5jy1e9vgh1p30w3h` | Spirit Call | PZO9451, p. 31 | Specifically held |
| `pf1/5k28oftzs0bezve3` | Demand Offering | PZO1132, p. 164 | Specifically held |
| `pf1/5k3i6l2s6ihxthr5` | Torpid Reanimation | PZO1135, p. 130 | Specifically held |
| `pf1/5kaozniy9sjydygq` | Effortless Armor | PZO1118, p. 228 | Specifically held |
| `pf1/5kkfeituhm3d8vps` | Stumble Gap | PZO1115, p. 247 | Specifically held |
| `pf1/5kuhfs68jk70d2xd` | Pierce Facade | PZO9476, p. 25 | Specifically held |
| `pf1/5l72if837ynbu3gz` | Protection from Energy, Communal | PZO1118, p. 240 | Specifically held |
| `pf1/5ll7q13p0skbgonc` | Modify Memory | PZO1110, p. 315 | Specifically held |
| `pf1/5lwbistj6waf2ei0` | Brittle Portal | PZO9267, p. 230; PZO9420, p. 29 | Specifically held |
| `pf1/5m7ci3da78ugjwkz` | Air Bubble | PZO1118, p. 222 | Specifically held |
| `pf1/5mx8fy8burriwz2c` | Light Prison | PZO9267, p. 236 | Specifically held |
| `pf1/5n0xg47ruhamwkrq` | Ego Whip IV | PZO1132, p. 169 | Specifically held |
| `pf1/5nr9o7o0it6ewf17` | Hideous Laughter | PZO1110, p. 296 | Specifically held |
| `pf1/5nxibvkuex5ucjiy` | Summon Giant Ally II | PZO9280, p. 223 | Specifically held |
| `pf1/5o8uysrb153tnvci` | Sanctify Corpse | PZO1117, p. 236 | Specifically held |
| `pf1/5pgzvhlvzhi16ek1` | Psychic Crush V | PZO1132, p. 183 | Specifically held |
| `pf1/5px118dfc2ww7lyz` | Putrefy Food and Drink | PZO1115, p. 237 | Specifically held |
| `pf1/5qtbebdknbbj1zm0` | Burst of Radiance | PZO9431, p. 29 | Specifically held |
| `pf1/5rwjrf2ojhc9b0sx` | Bullet Ward | PZO1129, p. 176 | Specifically held |
| `pf1/5s4e2iifhflglr1t` | Calm Animals | PZO1110, p. 252 | Specifically held |
| `pf1/5s8jqu87susjxarc` | Sotto Voce | PZO9221, p. 61 | Specifically held |
| `pf1/5sltdv83psx6wodr` | Seeds of Influence | PZO9292, p. 62 | Specifically held |
| `pf1/5spjx8eba8jgjuqw` | Eruptive Pustules | PZO1117, p. 218 | Specifically held |
| `pf1/5t62v90lidkv3sml` | Challenge Evil | PZO1115, p. 210 | Specifically held |

## Mechanics and description review

All 99 complete Spell descriptions and every action/metadata payload were inspected. A recorded Spell grants zero running Modifiers, Sources, Item Abilities or proficiencies merely by being known or written in a Spellbook. Supported class levels, granted-list metadata and source citations stay intact. Shoanti quah membership and rare-cantrip discovery are retained as prose prerequisites rather than fabricated structured predicates.

The drafter selected 37 descriptions in its separate prose pass; manual review adds the other 62, producing **99 checked complete-description bindings and 102 readable Notes**. The required mechanics gate has zero inputs for these Spell definitions, with no missing or unresolved required records. Hungry Pit and Spiked Pit's raw `attackNotes` depth formulas, and Hungry Pit's `@Action[Contraction]` note, are still individually audited and preserved as readable depth/damage procedures. A zero required gate does not mean those source fields were skipped.

Shared **fear**, **enchantment** and **disarm** Situations are reused in explanatory Notes; recipient-specific conditions retain local wording. Swallow Your Fear's bonuses apply while suffering fear, not only against fear saves. Litany of Duty's enchantment bonus remains distinct from its qualifying previous-round reroll. Dazzling Blade's disarm CMB and weapon-specific defensive scope remain distinct.

**36 candidates have 40 independently outstanding calculation items.** Checking descriptive Notes does not complete separate running effects. All 40 calculation gaps carry `unresolved` diagnostics in the checked description records, keeping 36 incomplete descriptions visible in optional preview/release reports while the required gate remains separate. Unsupported movement, armor-check penalties, energy resistances, sensory ranges, temporary-HP pools, spell resources, instantaneous damage/healing, entities and combat adjudication remain prose under the closed calculation contract. Aura of Cannibalism's unsupported temporary-HP pool does not hide its independently promised +1/+2 competence attack/save/skill bonuses. Vine Strike's +1d6 selected-attack damage and Dragon II's natural attacks are independently outstanding attack inputs.

The importer loses source descriptor arrays on **51 Spell roots** because it reads `system.types` rather than these roots' `system.descriptors`; all exact arrays are retained in the inventory. **42 subschool arrays** are retained. No importer fix is made; gaps stay in the #719/#720 follow-up lane. Scoop's custom name/date/URL is preserved without an invented product code.

| Exact key / Spell | Independently outstanding calculation |
| --- | --- |
| `pf1/4pryfl3cihbio5ph` Spellscar | Separate Spellscar effect: +4 insight concentration only to avoid primal events inside creator's own area. |
| `pf1/4qi3kgyoxtf44wa2` Open Book | Separate Open Book effects: -2 saves against divinations on cursed subject; Diplomacy gather-information bonus half caster level capped +10 applies to information-gatherer about that subject, never automatically cursed subject's own Diplomacy. |
| `pf1/4ratngmltr3z4om5` Angelic Aspect, Lesser | Separate Lesser Angelic Aspect effect must implement inherited Protection from Evil +2 deflection AC and +2 resistance saves only against evil attackers, plus control/contact immunities prose. Resistances/vision outside closed Modifier targets. Existing-control resave has separate +2 morale against evil-created control using original DC; creatures or objects may create those effects. This is not a global bonus. |
| `pf1/4rjud9uoofhbwhht` Badger's Ferocity | Separate targeted Badger's Ferocity effect doubles eligible weapon threat range as Keen Edge; concentration, one weapon per creature and range termination preserved. |
| `pf1/4spxwz9fa4yy6lee` Haunting Reminder | Separate Haunting Reminder effect: triggered shaken condition plus -2 saves only against this caster's fear spells; duration/trigger distinct from intimidation. |
| `pf1/4sqpli43uba4sh4k` Blade Tutor's Spirit | Separate Blade Tutor effect reduces total voluntary melee attack penalties by 1 + floor(CL/5), bounded to zero; cannot add unconditional attack bonus. |
| `pf1/4uor0rnae7hsi08r` Dragonvoice | Separate Dragonvoice effect: +6 circumstance Charisma checks and Charisma-based skill checks only when dealing with dragons, not ability score itself. Hearing-distance adjustment belongs others' Perception. |
| `pf1/4ut0m4azu6ypktct` Ego Whip II | Separate Ego Whip II effect: -4 selected Intelligence/Wisdom/Charisma; failed save also staggers 1d4 rounds. Successful save negates staggering and reduces score-penalty duration to one round per inherited Ego Whip I; penalty magnitude is not halved. |
| `pf1/4uzseabeqamqnmb6` Swallow Your Fear | Separate Swallow Your Fear effect while fear holds: +2 morale Strength, +2 morale Constitution, +1 morale Will, -2 AC; frightened/panicked confusion rules remain prose. |
| `pf1/4vofunusuut7iyk2` Aura of Cannibalism | Separate Aura of Cannibalism effect: +1 competence attack/saves/skills with >=5 temporary HP, +2 at>=15. Temporary HP pool tracking unsupported, but supported bonuses remain independently outstanding. |
| `pf1/4w51afqi5d9t8nl4` Innocence | Separate Innocence effect: +10 competence Bluff solely when convincing others of innocence. |
| `pf1/4x4ozs8ps7tfbgpd` Severed Fate | Running shaken condition belongs separate effect/condition; do not apply penalties on recorded Spell. |
| `pf1/4x952ltk0uwp158t` Vengeful Comets | Separate Vengeful Comets effect: circumstance saving-throw bonus vs fire equals remaining comet count; resource consumption does not make this unconditional. |
| `pf1/4y42ffrppap34t4i` Blade of Light | Separate item-targeted Blade of Light effect: +2 sacred weapon attacks vs undead and conditional damage/Ghost Touch/automatic confirmation properties. Light/DR remain prose. |
| `pf1/50maksnxymh9jsj2` Instant Armor | Separate Instant Armor effect requires chosen armor tier, normal armor properties and +1 enhancement for each tier bypassed, suppression of worn armor until expiry; no unconditional arbitrary AC. |
| `pf1/53vo7qevfn8nbgiq` Phantom Hunt | Separate Phantom Hunt effect: +4 Survival while tracking only if subject already able to track at full speed. +40-foot enhancement movement, darkvision 100, tremorsense 20 and attack termination remain prose because closed targets have no movement statistic. |
| `pf1/53xzqcqwd66x85bf` Whispering Lore | Separate Whispering Lore effect: +4 insight appropriate Knowledge by current terrain, replacing previous terrain bonus. |
| `pf1/54x9nw6ni4rpphcn` Keen Senses | Separate Keen Senses effect: +2 competence Perception; vision remains prose. |
| `pf1/54xmgohtp85buj04` Songbird | Separate Songbird effect: +3 Perform and +1 sonic spell DC only same round; daily bardic-round procedure prose, no universal DC bonus. |
| `pf1/55jB63sBH4GLV5Mm` Litany of Duty | Separate Litany of Duty effect: +2 against enchantment for one round using shared enchantment Situation, reroll previous-round qualifying failure prose. |
| `pf1/56ntc8i3qfn2nyxc` Umbral Infusion | Separate Umbral Infusion effect: +2 all rolls, +4 AC/CMD, +2 HP/HD, +2 ability DCs under advanced template, avoid duplicate template application and do not invent unstated ability score bonuses; unmodeled DC/resource procedures may remain prose. |
| `pf1/57es4kax66ag4tw7` Naga Shape I | Separately reviewed running Spell Effects need +4 size Strength, –2 Dexterity and +4 natural armor; Recorded Spell grants no Modifiers. |
| `pf1/57es4kax66ag4tw7` Naga Shape I | Large polymorph size must supply dependent attack, AC, CMB/CMD and size-sensitive natural-attack calculations through separate running Spell Effect inputs. Source gives Large form; no unseen baseline numeric size adjustments are invented in this batch. |
| `pf1/57knlirgsjn5qz93` Dazzling Blade, Mass | Running Spell Effect needs min(5, 1+floor(@casterLevel/3)) competence Bluff for combat feints, disarm CMB, and CMD only against disarming its affected weapon; keep exact weapon/feint conditions and separate Spell definition. |
| `pf1/5at5npyf27sv01c6` Analyze Aura | Running emotion-aura Spell Effect needs +2 circumstance Bluff, Diplomacy, Intimidate and Sense Motive only against the analyzed target, with the stated 1-hour aftermath. |
| `pf1/5bkqxi1071265kdi` Assumed Likeness | Running Spell Effect needs +10 Disguise and conditional –5 Disguise until persona understood; one chosen emotion's exact target-scoped skill/attack/AC benefits; a separate affected-target contribution needs –2 Sense Motive only to notice caster's lies after both failed disbelief and successful disguise. Do not give victim's penalty to caster. |
| `pf1/5brzibsbbixku992` Black Mark | Running Black Mark Spell Effects require inherited –10 Survival and the exact Nature's Exile companion –2 attack/skill/save clause where applicable; companion recipient association is not supplied by this Spell record. |
| `pf1/5gm3icgpwhkcaccf` Vine Strike | Selected natural attack or unarmed strike needs the explicit additional 1d6 damage through running effect/attack inputs. Current record preserves dice as prose; this supported attack calculation remains independently outstanding, not an attribution hold. |
| `pf1/5icj4nasrlgqojqm` Form of the Dragon II | Separate running Spell Effect must provide +6 size Strength, +4 size Constitution and +6 natural armor; never attach these to Recorded Spell. |
| `pf1/5icj4nasrlgqojqm` Form of the Dragon II | Copper-dragon form additionally inherits Spider Climb’s explicit +8 racial Climb bonus; requires a form-scoped running effect, without assuming such a bonus for other forms. |
| `pf1/5icj4nasrlgqojqm` Form of the Dragon II | Large polymorph size must supply dependent attack, AC, CMB/CMD and size-sensitive natural-attack calculations through separate running Spell Effect inputs. Source gives Large form; no unseen baseline numeric size adjustments are invented in this batch. |
| `pf1/5icj4nasrlgqojqm` Form of the Dragon II | Separate running form must supply the source-backed natural attacks to Attack Routine inputs: bite 2d6, two claws 1d8, two wings 1d6 and tail slap 1d8. Dice and chosen form remain separate from recorded Spell; no existing effect completeness inferred. |
| `pf1/5jevjl9pf4c58rc0` Planeslayer's Call | Running allied Spell Effects require +2 casterLevel only for spell-resistance checks against outsiders matching the chosen alignment component/subtype, not general caster level or all SR checks. |
| `pf1/5jy1e9vgh1p30w3h` Spirit Call | Separate running Spell Effects need casterLevel +1 and +4 insight concentration only for matching list spells cast in the area; no general casting bonus or invented hunter spirit/domain relation. |
| `pf1/5kkfeituhm3d8vps` Stumble Gap | A separate 1-round running effect should preserve –1 to all rolls/checks on successful save across supported rolled statistics (attacks, damage, saves, skills and combat checks), without changing AC, ability scores or other unrolled statistics; unsupported checks are still prose. |
| `pf1/5kuhfs68jk70d2xd` Pierce Facade | Running Spell Effect needs +5 insight Perception below CL 7 and +10 at CL 7+, restricted to seeing through disguises. |
| `pf1/5n0xg47ruhamwkrq` Ego Whip IV | Running effect needs –8 to exactly one chosen Intelligence/Wisdom/Charisma score and correct success/failure duration; no caster score penalty. |
| `pf1/5rwjrf2ojhc9b0sx` Bullet Ward | Separate running Spell Effect needs +10 AC only against the single firearm attack intercepted by the selected bullet; no unconditional AC and no assignment of bullet AC/HP/hardness to character. |
| `pf1/5sltdv83psx6wodr` Seeds of Influence | Running effect on affected target needs –2 saves against divination spells cast by this particular caster; preserve recipient and caster relationship, not caster's own saves. |
| `pf1/5t62v90lidkv3sml` Challenge Evil | Separate running caster Spell Effect requires +2 sacred attack.melee only against this spell's evil subject; do not give it to subject or make it unconditional. |

## Source discrepancies and boundaries

Twelve candidates carry explicit metadata/prose/comparator findings. Exact source values remain visible; this batch does not silently repair an action or arbitrate a printed-book disagreement. Lighten Object's count and raw volume limits are preserved separately.

| Spell | Observed boundary |
| --- | --- |
| Lighten Object, Mass | Raw target says multiple objects totaling one cubic foot/CL; direct prose separately limits number to half CL. Both constraints retained; no number inferred from volume. |
| Instant Armor | Source table splits banded mail across the 6th-8th cells; explicit +2 banded mail example corroborates intended armor identity. Preserve raw table. |
| Glyph of Warding | Pinned PCGen full description says a rogue only can find with Perception/disarm; pinned Foundry instead any character Perception, trapfinding required for Disable Device. Both literal sources retained; no printed-book arbitration available. |
| Dazzling Blade, Mass | Raw save description says Will negates, but inherited Dazzling Blade prose gives dazzled for 1 round on a successful discharge save. |
| Call Construct | materials.gpValue is 5000 although description and materials.value explicitly permit 1000 gp for constructs that are not immune to magic. |
| Synaptic Pulse, Greater | action save.description is Will negates, but complete description says a successful save instead sickens the creature for 1 round. |
| Shout, Greater | Against Crystalline action save.type is ref, but prose allows crystalline creatures Fortitude; Reflex applies to creatures holding vulnerable objects, not all crystalline targets. |
| Lightning Lash Bomb Admixture | system.sr is false although final sentence explicitly says the lightning lash effect does not ignore spell resistance; distinguish personal extract from hostile secondary effect. |
| Arrow of Law | Raw action.actionType is spellsave and has no ranged-touch attack representation although description explicitly requires a ranged touch attack. |
| Torpid Reanimation | Description literally says 'within at least 60 feet' for gaining control, a contradictory proximity phrase; retain it without silently choosing a 60-foot maximum or minimum. |
| Psychic Crush V | Raw save.type is fort although the inherited initial check is Will; Fortitude is secondary and absent below half HP. |
| Sotto Voce | Raw action.target restricts to humanoid of 4 HD or less, while complete description says living creature of 4 or fewer HD without humanoid restriction. |

## Behavioral evidence

[Public resolver tests](../../tests/catalog/spells-520.test.ts) pin exact root bytes, complete descriptions, metadata, inherited Ego Whip success behavior, representative real values, shared Situations and zero Modifiers from recorded Spells. [The isolated saved-sheet tests](../../convex/catalogSpells520.integration.test.ts) use source-shaped Oracle and Wizard collection entries, enforce member/outsider and campaign boundaries, and cover editing, removal and client/server preview parity. [Fixture preview](../../tests/fixtures/spells-520/preview.json) contains all 99 definitions with 102 Notes and no Modifiers. [Fixture details](../../tests/fixtures/spells-520/README.md) describe the isolated, unreviewed class context.

The requested admitted-content demonstration cannot exist for this batch because admission is zero. The isolated specimens test the existing public consumer with real source-shaped data; they do not bypass the shipping gate, establish legal admission, create a Catalog Release or claim completed Spell Effect calculations.

## Commands and results

Candidate selection is an ignored exact-key JSON array inside the worktree; output paths are ignored worktree scratch directories. No scratch or answer path is linked as evidence. All source-taking commands use the two pinned read-only checkouts above. No full `pnpm test` was run in this worktree.

The final source-taking commands were:

```sh
pnpm -s catalog:preview \
  --system /home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1 \
  --content /home/andreas/repos/everythingpath/sources/pf1-content \
  --out .scratch/curation-520-fix/full-preview

pnpm -s catalog:curate \
  --system /home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1 \
  --content /home/andreas/repos/everythingpath/sources/pf1-content \
  --candidates .scratch/curation-520-fix/candidates.json \
  --descriptions --out .scratch/curation-520-fix/bounded-drafts

pnpm -s catalog:preview \
  --system /home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1 \
  --content /home/andreas/repos/everythingpath/sources/pf1-content \
  --candidates .scratch/curation-520-fix/candidates.json \
  --out .scratch/curation-520-fix/bounded-preview

pnpm -s catalog:curate \
  --system /home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1 \
  --content /home/andreas/repos/everythingpath/sources/pf1-content \
  --out .scratch/curation-520-fix/full-drafts
```

Final legal evaluation calls the same public `assessCatalogAdmission` function with the unchanged full extraction and schema-validated reviewed assessments, evidence and Registry. Extraction hashes distinguish it from the prebinding CLI admission result. The exact candidate array is the ordered 100-key list in the fixture provenance and disposition table above.

The focused tests and final checks were:

```sh
TMPDIR="$PWD/.scratch/curation-520-fix/test-work" \
  pnpm test tests/catalog convex/catalogSpells520.integration.test.ts --maxWorkers=1
TMPDIR="$PWD/.scratch/curation-520-fix/test-work" \
  pnpm test tests/catalog/spells-520.test.ts convex/catalogSpells520.integration.test.ts --maxWorkers=1
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm -s catalog:format
pnpm -s catalog:format --check
git diff --check
```

| Command / gate | Observed result |
| --- | --- |
| Exact `catalog:curate --candidates` draft | Passed; 0 new required drafts, 0 missing, 0 unresolved required mechanics. |
| Exact `catalog:curate --candidates --descriptions` | Passed; 37 new description drafts, 0 missing/unresolved required mechanics. |
| Final exact `catalog:curate --candidates --descriptions` | Passed in 9.73 seconds; 1,023 records, 0 added/replaced records, 0 required inputs/missing records, 99 checked descriptions and 36 optional unresolved descriptions / 40 items. |
| Manual full-description review | 99 checked descriptions / 102 Notes; 36 independently outstanding candidates / 40 items. |
| `pnpm -s catalog:format` | Passed; shared files canonicalized after review. |
| `pnpm -s catalog:format --check` and `git diff --check` | Passed fix-round final main-session gates; shared catalog files remain canonical. |
| `pnpm -s typecheck` | Passed fix-round final run, exit 0, after narrowing the new binding fixture validator to its actual Spell detail type. |
| `pnpm -s lint` | Passed fix-round final run, exit 0; targeted ESLint also passed on the latest regression test after its schema refinement. |
| `pnpm -s check:initial-migration-writers` | Passed; 183 registrations checked. |
| `pnpm catalog:pin` | Passed; `sha256:71c66667344e200747085cc47660277a9e7677da10cdd3d58033591444baa25b`. |
| Exact bounded preview / admission | Exit 1 in 10.45 seconds; inventory covers all 100 keys (99 Spells and one excluded folder), with 0 unassigned. Required curation passes with 0 missing/stale records and 36 optional unresolved descriptions. Admission: 0 admitted, 75 held, 24 reference failures, 0 omissions and 0 retained exceptions. All 24 bounded reference failures disappear when full source context is present: the full batch is 99 held, 0 failures. Bounded admission SHA-256: `c0793f3bc436aee8a0c1a76662dba3d0f9612543bf2e99a86c9075207fef46cf`. |
| Final full CLI extraction, then postbinding public admission gate | Full extraction completed in about 255 seconds; CLI nonzero for whole-corpus incompleteness. Final extraction: 23,037 entries and 538 resources. Postbinding public gate: 53 admitted, 23,129 held, 2 dependent omissions, 0 retained exceptions and 4,732 failures; this batch has 99 held, 0 failures and 0 omissions. All 4,732 whole-corpus failures are outside this batch: 3,626 missing required records, 715 unaccounted candidates and 391 reference failures. All 99 current assessment and inventory bindings verified and replayed from the fresh 125-entry binding fixture; 36 optional unresolved descriptions / 40 items remain visible. |
| Full-corpus `catalog:curate` | Passed in 171.76 seconds; 4,649 records, 3,626 new drafts, 0 replaced/missing/stale. Required candidates: 3,728 = 3,626 drafted + 102 checked, with 761 required unresolved mechanics. Optional unresolved: 362. Description candidates: 10,438; checked: 921. |
| `pnpm test tests/catalog` plus batch integration test | Passed on the rebased fix round: 45 files, 754 tests, 81.51 seconds; includes 17 literal inherited-notice regressions and all-99 binding replay with inherited-content invalidation. After the validator type refinement, the 32 Spell tests and 2 integration tests passed again (34/34 in 5.11 seconds). |

## Preservation, timing and workflow

Fix-round source commands ran at 00:10:06–00:18:34 UTC: full preview about 255 seconds, exact description draft 9.73 seconds, bounded preview 10.45 seconds and full-corpus drafting 171.76 seconds. All 99 bindings, all 125 binding-fixture entries, the four extraction hashes and 128 raw source bytes were independently checked. Shared-data review caught schema validation trimming unrelated assessment rationale whitespace during a whole-file write; the non-batch raw records were restored before closeout. A TypeScript mismatch between the general importer detail union and the public preview type was fixed by validating the fixture with its actual Spell detail schema; the final typecheck, lint and affected tests pass.

The following baseline inventory and original implementation timings describe the initial batch; the fix round adds the inherited-rule audit above. Fix-round shared-file review preserves every non-batch record, every shared Situation and the complete Registry unchanged. Only the single Lighten Object, Mass overlay record changes. The 99 batch assessments are rebound, 58 candidates gain 68 minimum notice requirements, four batch notice holds are registered and the reused #264 Bestiary 3 hold gains this evidence reference. All 128 source snapshots remain byte-identical. The fix modifies nine existing tracked files and adds one full-context binding fixture; no product implementation changes.

No product code, importer, resolver, remap or Registry change. The shared-file audit preserved the prior **723 overlay records, 918 evidence entries, 118 Registry entries, 322 notice holds** and existing Situations unchanged. The batch adds 99 description records, 99 evidence entries, 99 unresolved assessments and 44 enforced notice holds; the pre-batch assessment inventory contains 940 entries. Source-backed fixtures and focused tests are the other changes. The final file inventory is 144 changed files: four shared data files and 140 new files (136 fixture files plus the report, legal inventory and two test files).

Times are approximate and overlap: setup/read-in began around 23:08 UTC; full source/action and linked-rule review ran around 23:10–23:24 UTC. Extraction timing: initial full run about 357 seconds, intermediate extraction about 203 seconds, corrected final extraction about 310 seconds (23:32:20–23:37:30 UTC). Binding, formatting and public gate audit finished around 23:38 UTC. Combined tests finished at about 23:40:47 UTC (68.68 seconds). Final typecheck ran about 23:40:54–23:42:50 UTC (116 seconds); writer inventory and pin checks passed again around 23:42:55 UTC. Final lint ran about 23:42:55–23:46:13 UTC (198 seconds). Final exact draft and bounded preview ran consecutively around 23:46:36–23:46:55 UTC (9.36 and 9.02 seconds). Full-corpus drafting ran around 23:46:55–23:49:55 UTC (180.32 seconds). Approximate overlapping phases were setup/read-in 4 minutes (23:08–23:12), source review and final diagnostic corrections 22 minutes (23:10–23:32), binding/extraction/checks 33 minutes (23:18–23:51), and report preparation 25 minutes (23:27–23:52). Overall closeout took roughly 45 minutes, around 23:08–23:53 UTC. Opus/Fable model aliases were unavailable, so delegated artifacts, source review and tests used the inherited model; no UI presentation work was required. Host load delayed checks and full-source artifact generation; early typecheck/lint failures arose while fixture files were still being created. The first combined test run passed 626 tests and exposed one fixture assertion expecting a UUID that the reduced fixture sanitizer strips; the assertion was corrected to verify the retained source identity/label, and all 627 tests passed on rerun. A main-session audit caught review-only diagnostics hiding the optional calculation gaps; these were corrected to unresolved, with fresh extraction/binding and fixtures required. Book-only evidence remains a named hold. The descriptor importer gap is documented, with no product patch. No environment files, private E2E data, temporary system directory, git mutation, GitHub mutation, deployment or external contact was used.

The fix-round final extraction hashes are recorded under `admissionEvidence` in the inventory. Catalog: `e88276b5373a1354fd8b017e183980c3cf9faf895443ee3abfc8129b5a75a467`; comparison: `a3c767a2f771d4a74b646f56e3474dcc83bff9fc014cb3e1c5f9d22d3ea7140e`; curation: `85a264b0e0035392beabbd3650234f6c9e02055034952905b0c343b1840fb96a`; unsupported: `98d89747d02a66e099787b3813144654b88af31f93af9f5c77883916aa85a9b2`. The public postbinding gate reads these unchanged extraction objects, verifies all current bindings and validates the legal inputs with `reviewedAdmissionSchema`; it does not re-label the earlier CLI gate as postbinding evidence.
