# Spell curation review: #516

Reviewed 2026-10-07 by **Sol (AI curator) for the owner**, following [#516](https://github.com/AndreasUnunger/EverythingPath/issues/516), [PRD #251 Decisions 9, 10 and 17 and the acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461), the [Spellcasting contract](../character-sheet/spellcasting.md), the [curation workflow](curation.md), and the [#328 precedent](races-328.md).

The batch covers exactly **100 Spell definitions**: **zero supported/admitted, 100 specifically held, zero dependently omitted, zero wholly unsupported/prose-only, and zero excluded** (2026-10-07; the [launch re-assessment](#launch-re-assessment-whole-content-wave-3-2026-11-04) of 2026-11-04 amends 38 of these rows). Legal admission, required-record coverage, and calculation completeness are separate findings. Inert combat subrules remain prose without reclassifying their whole Spell. No Catalog Release is published or activated.

## Evidence and scope

- Read-only system: Foundry PF1 v11.11, commit `418761d2e16a6037c0156bb4a241f7cea5a2986d`.
- Read-only content: pf1-content 11.4.0, commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`.
- [Exact selector](../../scripts/catalog/spells-516-candidates.json): the ticket’s 100 case-sensitive stable keys, used by both draft and bounded preview. No extra candidate is admitted by helper lookup.
- [Mechanics inventory](spells-516-mechanics.json): every source YAML path, raw-file and description hashes, class-tag levels, Granted Spell metadata, school/subschools/descriptors, complete-prose review summary, outstanding effect work and discrepancies.
- [Attribution inventory](../../scripts/catalog/legal/spells-516-evidence.json), [Attribution Assessments](../../src/lib/catalog/data/attribution-assessments.json), and [evidence](../../src/lib/catalog/data/attribution-evidence.json): whole-content boundaries and notice identities tied to the final extraction closure. [Held notices](../../scripts/catalog/legal/held-notices.json) enforce every notice-chain hold.
- [Curation Overlay](../../scripts/catalog/reviewed-curation.json): exact raw description bindings; existing records and shared vocabulary are preserved.

PCGen comparison uses fixed commit `25523dbcf10e86c280fc0f447167ea43d67419d3` and [the CRB Spell descriptions](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_spells.lst) with its [campaign metadata](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/core_rulebook.pcc). No book PDFs are available and Archives of Nethys was not used.

All 21 CRB-root definitions have class-list or Granted Spell metadata from beyond the CRB, including later class tags such as arcanist, hunter, psychic or summoner variants. A complete CRB prose comparison alone does not establish the complete imported definition’s origins. Each remains a named whole-content comparison hold. The other 79 roots retain individual later-book comparisons and notice-chain holds. The 100 roots name 45 distinct book codes; supplemental and linked evidence brings the observed minimum to 46 required notice identities. Existing CRB notice coverage is reused, and 45 non-CRB notice-chain holds are enforced. These minima do not bound the unknown later class-list origins. Exact book/page citations remain unchanged; source titles and Registry name matches never imply permission. Linked definitions are evidence dependencies, not newly reviewed admissions outside this inventory.

## Every-key disposition

Every key is specifically held for its whole-content comparison. The source-specific assessment and named missing evidence appear in the attribution inventory. The following table also records each root’s exact upstream citations; supplemental prose and linked books are recorded separately in legal evidence.

| Exact key | Spell | Root citation | Disposition |
| --- | --- | --- | --- |
| `pf1/001poiyujbqv24z0` | Undead Anatomy IV | PZO1117, p. 245 | Held: complete content comparison and required notice chains unresolved |
| `pf1/002n6r18wbatfu9y` | Tidal Surge | PZO1140, p. 237 | Held: complete content comparison and required notice chains unresolved |
| `pf1/003tu19dpyoaj0se` | Orb of the Void | PZO1117, p. 230 | Held: complete content comparison and required notice chains unresolved |
| `pf1/006yfbelwtwts8cr` | Ward the Faithful | PZO1115, p. 256 | Held: complete content comparison and required notice chains unresolved |
| `pf1/00wyen2uho8firph` | Protection from Arrows | PZO1110, p. 327 | Held: complete later class/grant origins unresolved |
| `pf1/016wtqg1y52sfqfc` | Unlife Current | PZO92102, p. 61 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0324zq42g3fu4kko` | Animal Messenger | PZO1110, p. 241 | Held: complete later class/grant origins unresolved |
| `pf1/039n0f2rc4lohdik` | Beloved of the Forge | PZO9460, p. 22 | Held: complete content comparison and required notice chains unresolved |
| `pf1/03LcrObY1i0Kocxb` | Prophetic Lore | PZO9488, p. 11 | Held: complete content comparison and required notice chains unresolved |
| `pf1/04px7z4lxxgfsf4j` | Feather Step, Mass | PZO1115, p. 221 | Held: complete content comparison and required notice chains unresolved |
| `pf1/050f388y9iuy4pwl` | Obscured Script | PZO1138, p. 37 | Held: complete content comparison and required notice chains unresolved |
| `pf1/05i5rxwim12hwktu` | Bull's Strength | PZO1110, p. 251 | Held: complete later class/grant origins unresolved |
| `pf1/05m8kfc2u9cg528g` | Animal Trance | PZO1110, p. 241 | Held: complete later class/grant origins unresolved |
| `pf1/07adg3f6f6lu8jz5` | Tactical Formation | PZO9408, p. 23 | Held: complete content comparison and required notice chains unresolved |
| `pf1/07nv5yhctnbrxxc0` | Contingent Scroll | PZO1129, p. 178 | Held: complete content comparison and required notice chains unresolved |
| `pf1/080el1lfozrhf6c2` | Refuge | PZO1110, p. 331 | Held: complete later class/grant origins unresolved |
| `pf1/08a7k67ixq5htlpb` | Ancestral Regression | PZO1121, p. 107 | Held: complete content comparison and required notice chains unresolved |
| `pf1/08ido3g78w7belo8` | Mark of Obvious Ethics | PZO1129, p. 187 | Held: complete content comparison and required notice chains unresolved |
| `pf1/08kr5yl1w77kc3qu` | Profane Nimbus | PZO1135, p. 125 | Held: complete content comparison and required notice chains unresolved |
| `pf1/08rPPRYYlPzG5jZ0` | Arid Refuge | PZO9482, p. 21 | Held: complete content comparison and required notice chains unresolved |
| `pf1/08xy2b3uqmw3qn95` | Air Breathing | PZO1130, p. 189 | Held: complete content comparison and required notice chains unresolved |
| `pf1/08z18ogsc8j3gswx` | Penumbral Disguise | PZO9466, p. 29 | Held: complete content comparison and required notice chains unresolved |
| `pf1/09juighnblqlqwro` | Unerring Weapon | PZO1118, p. 248 | Held: complete content comparison and required notice chains unresolved |
| `pf1/09mmf2pjefmjyqsp` | Confess | PZO1115, p. 212 | Held: complete content comparison and required notice chains unresolved |
| `pf1/09ug139wqsyr0lu6` | Named Bullet | PZO1118, p. 238 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0ZOD7wKyMRgudbYE` | Cultural Adaptation (Taldan) | PZO9417, p. 28 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0amu53wegzdp0axj` | Clenched Fist | PZO1110, p. 255 | Held: complete later class/grant origins unresolved |
| `pf1/0axqb92kzlesc24q` | Imbue with Spell Ability | PZO1110, p. 299 | Held: complete later class/grant origins unresolved |
| `pf1/0bazqafq091n96y3` | Slave to Sin | PZO1138, p. 61 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0br7cvx9t5xczhgi` | Temporary Graft | PZO1135, p. 129 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0c4u2f6hc35k0h5k` | Web Shelter | PZO1117, p. 249 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0cbreqkr1vp7meyi` | Contagious Flame | PZO1115, p. 212 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0d756xyqhinsstas` | Pyrotechnics | PZO1110, p. 328 | Held: complete later class/grant origins unresolved |
| `pf1/0dcr75sqs8wpdrhg` | Ancestral Memory | PZO9226, p. 294 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0evx195gmtcpdxef` | Perceive Betrayal | PZO9476, p. 25 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0g0pgsbjns61ovln` | Body Capacitance | PZO1129, p. 176 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0gfaupmvuhgd90ku` | Spawn Ward | PZO1121, p. 101 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0gg4uir1psakz59e` | Sympathetic Vibration | PZO1110, p. 357 | Held: complete later class/grant origins unresolved |
| `pf1/0hknfnoaljc75fj3` | Fire Seeds | PZO1110, p. 282 | Held: complete later class/grant origins unresolved |
| `pf1/0j2cb0iv0695a45i` | Possession, Greater | PZO1132, p. 181 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0j43l3u9eqj5gvnp` | Dancing Lantern | PZO1115, p. 214 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0j54rd8ne58l7xqs` | Life Channel | PZO1121, p. 101 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0jc850iz31ys87vn` | Maddening Oubliette | PZO9267, p. 237 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0jgql4fa5ha4dowi` | Particulate Form | PZO9468, p. 6 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0jwi6xovzukorxok` | Summon Nature's Ally I | PZO1110, p. 354 | Held: complete later class/grant origins unresolved |
| `pf1/0khn0u6nd4fat6wb` | Symbol of Sleep | PZO1110, p. 356 | Held: complete later class/grant origins unresolved |
| `pf1/0kppkhsencd6tzvh` | Protection from Spells | PZO1110, p. 328 | Held: complete later class/grant origins unresolved |
| `pf1/0li6cdx4qgwihry7` | Touch of Combustion | PZO1121, p. 131 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0lrux8tmaml5fkw6` | Spiritual Ally | PZO1115, p. 246 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0mbl9irc95io6wko` | Catatonia | PZO1132, p. 161 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0mcuy3vl4h0alub4` | Caustic Safeguard | PZO9464, p. 30 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0mj3orvf07ufiatp` | Ice Armor | PZO9267, p. 236; PZO9038, p. 71 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0mt9mso6wdhfafpo` | Polar Midnight | PZO1117, p. 232 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0mvIMzqn99fgLnw7` | Hurricane Blast | PZO9024, p. 60 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0my01rrsq3dfw8et` | Moonrise Arrow | PZO90134, p. 72 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0n789r9rokr1ktd1` | Contact Entity III | PZO1135, p. 113 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0nleto9d4fdwaumv` | Talisman of Reprieve | PZO9492, p. 12 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0nm8l17dcr7oi7c3` | Form of the Exotic Dragon III | PZO9470, p. 31 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0nw43wck6cgj5pi6` | Detect Anxieties | PZO1134, p. 211 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0onqjy8gfgop1xsi` | Ventriloquism | PZO1110, p. 365 | Held: complete later class/grant origins unresolved |
| `pf1/0peluu0s9phfnur1` | Countless Eyes | PZO1117, p. 213 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0pmh2dbj0a2iy0di` | Planetarium | PZO9449, p. 28 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0r3tdcs6jf9qkjjr` | Screaming Flames | PZO1135, p. 126 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0rhghy2ft8l9buyt` | Cursed Earth | PZO1117, p. 215 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0s8w9wfs3ygc21wh` | Absorbing Inhalation | PZO1121, p. 160 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0sloyg4lliea9rkw` | Elemental Bombardment | PZO9438, p. 14 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0sssdtv0tkbns2r3` | Grove of Respite | PZO1115, p. 226 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0svkqpvg2n2j29md` | Litany of Truth | PZO9299, p. 33 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0u8da953k6lgk784` | Transmute Golem | PZO9465, p. 22 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0uxs1dj28glc9o8i` | Aphasia | PZO1134, p. 204 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0vi272dchokb72pf` | Burst of Adrenaline | PZO1132, p. 160 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0vk55ovj3uyas4ur` | Illusory Crowd | PZO9460, p. 30 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0vmz2klcfvkc3h0v` | Dimensional Anchor | PZO1110, p. 270 | Held: complete later class/grant origins unresolved |
| `pf1/0w3hvcp3gb2bhtv5` | Project Image | PZO1110, p. 327 | Held: complete later class/grant origins unresolved |
| `pf1/0wahvj06h5eak2fk` | Placebo Effect | PZO1132, p. 180 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0wamdkl9gp19l55w` | Planar Ally, Greater | PZO1110, p. 320 | Held: complete later class/grant origins unresolved |
| `pf1/0wun756dydhv1ihk` | Fool's Gold (VC) | PZO1136, p. 117 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0y2vp0lwyr9b58b8` | Knight's Calling | PZO1115, p. 230 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0y3go94j3gfmkduu` | Nature's Ravages | PZO9430, p. 31 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0y78ewctynz9zna6` | Aram Zey's Trap Ward | PZO9235, p. 56 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0yoh1t32kz4enppo` | Hide Bruises | PZO1136, p. 20 | Held: complete content comparison and required notice chains unresolved |
| `pf1/0yvwyclhkf76veo1` | Divine Power | PZO1110, p. 273 | Held: complete later class/grant origins unresolved |
| `pf1/0zzlhjlpogqfyi71` | Endothermic Touch | PZO1130, p. 141 | Held: complete content comparison and required notice chains unresolved |
| `pf1/10e3iwsr5jkq4q73` | Wood Shape | PZO1110, p. 370 | Held: complete later class/grant origins unresolved |
| `pf1/10nnddmxvgxo78og` | Frigid Touch | PZO1117, p. 221 | Held: complete content comparison and required notice chains unresolved |
| `pf1/118e7kl304qi23ap` | Phantasmal Affliction | PZO1134, p. 221 | Held: complete content comparison and required notice chains unresolved |
| `pf1/11wik2btna8987g0` | Illusory Poison | PZO9411, p. 27 | Held: complete content comparison and required notice chains unresolved |
| `pf1/12qmtm2fdfsvbx9f` | Sabotage Construct | PZO9448, p. 27 | Held: complete content comparison and required notice chains unresolved |
| `pf1/12rk9htb1zta0o00` | Fire's Friend | PZO9280, p. 220 | Held: complete content comparison and required notice chains unresolved |
| `pf1/13ka33oq0ybjigmp` | Wracking Ray | PZO9450, p. 25 | Held: complete content comparison and required notice chains unresolved |
| `pf1/13pilcgm2oydyogv` | Disfiguring Touch | PZO1117, p. 217; PZO1139, p. 48 | Held: complete content comparison and required notice chains unresolved |
| `pf1/14chms7xurvi85x9` | Owl's Wisdom, Mass | PZO1110, p. 318 | Held: complete later class/grant origins unresolved |
| `pf1/14he8rp5zehzk7tx` | Abstemiousness | PZO9267, p. 228; PZO9418, p. 29 | Held: complete content comparison and required notice chains unresolved |
| `pf1/154qxyuxws5syuh1` | Toxic Rupture | PZO9459, p. 29 | Held: complete content comparison and required notice chains unresolved |
| `pf1/16j7zppo8x5wj7ve` | Chameleon Stride | PZO1115, p. 210 | Held: complete content comparison and required notice chains unresolved |
| `pf1/16ms1wen0vd3iezx` | Blend with Surroundings | PZO9459, p. 30 | Held: complete content comparison and required notice chains unresolved |
| `pf1/17eskras8cjynj10` | Detect Chaos | PZO1110, p. 266 | Held: complete later class/grant origins unresolved |
| `pf1/17iuomx6dc1h5cfx` | Fire Trail | PZO1121, p. 119 | Held: complete content comparison and required notice chains unresolved |
| `pf1/17j3ttrl49u5k69b` | Hobbling Bomb Admixture | PZO90117, p. 76 | Held: complete content comparison and required notice chains unresolved |
| `pf1/181gol7xz8quxfks` | Haze of Dreams | PZO9267, p. 235; PZO9416, p. 28 | Held: complete content comparison and required notice chains unresolved |

## Mechanics review

The bounded drafter with the separate description pass found **zero required context Notes, zero action conditionals and zero Item Abilities**. It drafted **44 optional description records**. All 44 are checked, with **50 readable Notes**, reviewer/date and exact source hashes. The other 56 descriptions were also independently read in full, with their complete action data; their per-key reviews are in the mechanics inventory even though the drafter’s “vs.”/“against”/“when” predicate does not select them. The final resumed bounded pass added or replaced zero records, with zero missing, stale, or unresolved required mechanics. Fourteen checked optional description records retain explicit unresolved diagnostics for the separately named running-effect work; they remain visible as unresolved descriptions outside the required-record gate.

**Recorded Spells grant no Modifiers.** This overlay adds zero numeric Modifiers and zero shared-effect Source keys. Notes describe cast-time rules without applying them. Bull’s Strength keeps its transmutation school, per-class second-level lists, and Granted Spell metadata while recording it never grants Strength +4. Divine Power’s luck bonuses, temporary HP and haste-equivalent extra attack belong to its separate Spell Effect; this batch does not assert a Source merely because it mentions haste. Target restrictions, casting rituals and spell components remain prose rather than invented feat prerequisites or proficiency Grants. Stable rule identities and reviewed remaps are preserved.

Existing shared Situations are used where their meaning fits: Protection from Spells has separate save Notes for `spells` and `spellLike`; Undead Anatomy IV names `mindAffecting` and `poison`; Temporary Graft’s leg benefit names `trip` and `overrun`; Particulate Form uses `poison` for its optional cure save. None implies another Situation. Aram Zey’s reactive protection uses the local “against magical traps”: no reviewed shared trap key exists, and a Symbol of Sleep detection/disable note is a different trigger. No new shared aliases are asserted.

**33 keys name deferred running-effect calculations**, independently of their legal holds. Their exact work is itemized in the mechanics inventory. It includes Ward the Faithful’s conditional AC/saves, light/culture/subject-dependent skill bonuses, targeted critical and ammunition properties, form-specific ability/armor choices, Divine Power’s luck/temporary HP/extra attack, and observer-targeted Heal penalties. These require separately reviewed Spell Effect or target-item records; neither recording a Spell nor checking its prose supplies those calculations. Ability damage, healing, rolls, movement on a combat map, durations, charges, summoning and dialogue are deliberately inert under the consuming contract, rather than silently promised automation. The batch does not curate or admit out-of-inventory buffs or class features. Granted Spell schedule producers belong to their owning class-feature batches; raw `grantedLevels` are preserved here without inventing schedules.

Nine candidates retain precise source discrepancies or missing rule details:

| Spell | Observed source boundary |
| --- | --- |
| Tidal Surge | Water action dice are capped at ten; water prose does not restate the cap. Preserve both rather than infer a correction. |
| Tactical Formation | Raw bonus type says “defection”; no invented structured type. The editor’s Torag preparation ritual stays in the content. |
| Symbol of Sleep | Trap note states DC30 while the definition also has an occultist level4 list. No new trap-DC rule is inferred. |
| Caustic Safeguard | Raw first-touch action omits the prose’s maximum10d6. No action is executed. |
| Hurricane Blast | Raw text uses obsolete Listen; it is not silently substituted with Perception. |
| Screaming Flames | Action says Reflex half; prose requires a failed Reflex save for fire damage. |
| Phantasmal Affliction | Curse text calls its penalty permanent but also limits it to one hour per level. |
| Illusory Poison | Source never specifies poison damage amount, ability/type or frequency. Nothing is invented. |
| Summon Nature’s Ally I | Foundry refers to Table10-2 without the actual list; PCGen says Table10-6 and omits the chart. The unavailable list remains named, without invented creature choices. |

PCGen also renders Symbol of Sleep’s multiplier with a corrupted glyph (“3d6 ? 10”) and Project Image’s “quasi-real” without a hyphen. These comparison differences do not alter the pinned raw text. The full source/description bindings preserve the exact bytes.

## Public-boundary demonstration

There is no newly admitted Spell to demonstrate. The zero-admission result remains a limitation of the ticket’s admitted-content demonstration, rather than a fabricated acceptance. The source-backed [batch fixtures](../../tests/fixtures/spells-516/provenance.json) and focused tests demonstrate the technical import, public resolver and isolated saved-sheet/catalog contracts only. Fixture-only permission is not shipping attribution or admission.

The isolated tests preserve recorded class association and level metadata, record and preserve Spell rows through the existing public writer, refuse unauthorized removal, enforce owner/membership access, and prove that recording Bull’s Strength gives no Strength bonus. A separate Character-owned temporary Spell Effect in the fixture exercises the existing public effect writer and +4 enhancement Strength; it does not curate an imported buff or establish admission. The focused catalog/isolated-saved-sheet tests pin these distinctions with the real published Spell identities; their final counts are recorded below.

## Commands and observed gates

Commands use the pinned checkouts with no verification override. Scratch output is git-ignored inside the worktree; it is removed after evidence capture and is not a tracked-document link.

```sh
PF1_CURATION_SYSTEM=/home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1
PF1_CURATION_CONTENT=/home/andreas/repos/everythingpath/sources/pf1-content
mkdir -p .scratch/spells-516-tmp
export TMPDIR="$PWD/.scratch/spells-516-tmp"
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates scripts/catalog/spells-516-candidates.json --descriptions --out .scratch/catalog-curation/spells-516/drafts
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates scripts/catalog/spells-516-candidates.json --descriptions --out .scratch/catalog-curation/spells-516/final-drafts
pnpm -s catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates scripts/catalog/spells-516-candidates.json --out .scratch/catalog-curation/spells-516/bounded-preview
pnpm -s catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/catalog-curation/spells-516/full-preview
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/catalog-curation/spells-516/full-drafts
pnpm -s catalog:format --check
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm test tests/catalog/spells-516.test.ts convex/catalogSpells516.integration.test.ts --maxWorkers=1
pnpm test tests/catalog convex/catalogSpells516.integration.test.ts --maxWorkers=2
pnpm test tests/catalog convex/catalogSpells516.integration.test.ts --maxWorkers=1
pnpm test tests/catalog/release-operator.test.ts --maxWorkers=1
git diff --check
```

The full suite is deliberately left to the orchestrator’s post-rebase landing gate, as required by the brief and current owner decision.

The bounded gate verifies both pins and accounts for all 100 extracted Spells with no unassigned or excluded candidates. Required curation passes: zero missing, stale or unresolved required records; 44 checked optional descriptions retain 14 explicit unresolved-description entries. Its attribution/reference gate exits 1 with **zero admitted, 86 held and 14 reference failures**. The editorial inventory still gives all 100 one legal disposition; a structural/reference failure is reported independently of its unresolved assessment.

The final complete gate exits 1 with **23,037 entries, 538 supporting resources, 51 admitted candidates, 23,132 held, one dependent omission, zero retained exceptions and 4,734 failures**. Its failures are **3,628 missing curation records outside this batch, 715 unaccounted inventory records and 391 broken-reference failures**. Within this batch, the full extraction reports **99 held and one reference failure**, Cultural Adaptation (Taldan), `pf1/0ZOD7wKyMRgudbYE`: its imported Diplomacy and Disguise journal links cannot resolve. All 100 whole-content legal holds remain independently documented. The other bounded reference failures arise from omitted linked inputs; no dependency is admitted or removed to make the bounded gate pass. The global dependent omission is preexisting and is not a batch disposition. No admitted notice requirement is outstanding.

Complete required curation remains **100 checked of 3,728 with 3,628 missing**. The optional prose inventory contains **10,133 candidates and 240 checked descriptions**. This is an incomplete corpus, with the batch’s own required coverage complete.

The complete drafter exits 0, producing **3,968 records, 3,628 new drafts, zero replacements, zero missing bindings and 763 unresolved required mechanics** in ignored scratch. Those full-corpus drafts are not copied to the reviewed overlay. This proves the new bounded overlay does not break full-corpus runs; it does not imply complete corpus curation.

| Check | Final observed result |
| --- | --- |
| Pinned source verification | Both exact commits/manifests verified, no override |
| Initial bounded draft and description pass | Exit 0: 44 new optional descriptions, no required records |
| Final bounded checked description resume | Exit 0: zero added/replaced/missing; 14 unresolved optional descriptions |
| Bounded import and required curation | 100 accounted; required curation passes |
| Bounded admission/reference gate | Exit 1: 0 admitted, 86 held, 14 reference failures |
| Full-corpus drafter | Exit 0: 3,968 records, 3,628 new, 763 unresolved mechanics; scratch only |
| Complete import/admission gate | Exit 1: 51 admitted, 23,132 held, one prior dependent omission, 4,734 inherited failures; batch 99 held/one reference failure |
| `pnpm -s typecheck` | Pass |
| `pnpm -s lint` | Pass |
| `pnpm -s check:initial-migration-writers` | Pass: 183 registered writers |
| `pnpm catalog:pin` | Pass: `sha256:6607d068facda14d40eddebe4e916952e8c668997ecadde9dbdc550e946f5518` |
| Focused catalog and saved-sheet tests | Pass: two files, six tests (five catalog, one Convex), 2.98 seconds |
| Combined catalog and batch integration suite, two workers | Exit 1: 27 files pass/one fails; 405 tests pass/one timeout, 52.14 seconds |
| Combined catalog and batch integration suite, one worker | Exit 1: same 405/406 tests; existing release-operator CLI timeout, 102.25 seconds |
| Isolated release-operator diagnostic | Pass: three tests, 8.21 seconds; first test 4,605 ms against unchanged 5,000 ms budget |
| Canonical serializer and previous-object preservation | Pass: previous 296 overlay records, 427 assessments, 400 evidence records and 104 holds unchanged; shared Situations unchanged |
| `git diff --check` | Pass |

Full extraction fingerprint: `b2625db95c4bef6622fa84f46ef7b056c2912e479261075846298dd9450adfcb`. Reviewed-input fingerprint: `3dab373e122f208cd905ee1a6f3f75a0704fdf96bb9d1e78cfdb8740f105fc66`. Legal-resource fingerprint: `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e`. Final full admission-report SHA-256: `fa0909d76d759d2733e16dc0bce925c0e52b936cab1bd5cb047d901d884cc1f1`; bounded admission-report SHA-256: `6f8092da5b081ff6f80e705e3f53d6224ef390c52c551e9366e59fedd94727e3`. These are local evidence identities, without release publication.

The review adds 44 overlay records, 100 unresolved content-bound assessments, 100 evidence records and 45 notice holds. Canonical serialization and an independent previous-object audit preserve every prior object and the existing shared Situation vocabulary.

The initial combined targeted suite used two workers while full imports and typecheck were active. It had 405 passing tests and one five-second timeout in the existing `tests/catalog/release-operator.test.ts` CLI test (52.14 seconds); all six focused batch tests passed. A serial rerun after the heavy source commands finished repeated the same single timeout (405/406 tests, 102.25 seconds). Contention is therefore not established as the cause. An isolated diagnostic then passed all three release-operator tests in 8.21 seconds; the first took 4,605 ms, 92% of the unchanged five-second budget. No HEAD-baseline comparison was performed after the isolated run passed. Both broad catalog-suite failures remain reported, and no timeout or product change masks them.

## Timing and workflow observations

Approximate overlapping phase windows on 2026-10-07 (UTC):

| Phase | Window | Elapsed |
| --- | --- | --- |
| Brief, contracts, precedent and exact selector | 16:34–16:37 | About 3 minutes |
| Complete source/record review and overlay | 16:37–16:46 | About 9 minutes |
| Full-source draft and import gates | 16:46–16:50 initial; about 16:51–16:58 final | About 4 + 7 minutes, overlapping later work |
| Final attribution bindings, tests, diagnostics, report and cleanup | 16:50–17:03 | About 13 minutes, overlapping final gates |

Total elapsed time was approximately 16:34–17:03 UTC, about 29 minutes. These are elapsed windows rather than additive labor estimates; attribution and verification run concurrently. The selector was written at 16:37:07. The initial full source commands completed at 16:49:42; the final post-binding full gate completed at 16:57:42.

The main Sol session independently sampled ten complete raw descriptions/actions and the resulting Notes where present: Bull’s Strength, Divine Power, Burst of Adrenaline, Protection from Spells, Fire’s Friend, Ventriloquism, Countless Eyes, Tactical Formation, Spiritual Ally and Ice Armor. It found no unsourced numerical addition and also checked every ticket key, prior-object preservation and new overlay binding hashes; the fixture tests verify all 100 source records. Fable model aliases are unavailable in this environment, so the orchestrator’s separate sampled Fable review remains required before landing.

An early overlay used an undeclared `traps` shared Situation and stopped parsing. A declared general key would also overstate equivalence across different magical-trap triggers. The final reviewed output uses its exact local magical-trap label and retains all existing shared keys unchanged. This was a curation-data correction, with no product/importer fix.

Bounded selection can omit linked definitions and produce reference failures; complete preview is necessary to distinguish those from full-import gaps. The drafter’s predicate is narrower than complete prose review, so the mechanics inventory explicitly covers all 100 descriptions. Missing PDFs and expanded Spell list origins prevent complete attribution. No importer gap was patched and no runtime code was imported or executed.

The batch’s ignored scratch and task-local test directories were removed after recording the results. Final canonical-format and whitespace checks passed.

All changes remain uncommitted. No source checkout, environment file, private E2E data, issue, PR, deployment or production data was changed. The launcher captures the final response at its `-o` path; no answer file is created in the repository.

## Launch re-assessment: whole-content wave 3 (2026-11-04)

Reviewed **2026-11-04** by **Opus (AI curator) for the owner**, under #735 (S-03: re-assess the held #516–#545 spells) for launch issue #767. Wave 3 covers this batch's **38 required launch rows** of `campaign-mvp-v1` and Scrying from #530 ([its section](spells-530.md#launch-re-assessment-whole-content-wave-3-2026-11-04)). Each row was held only on its whole-content hold and on notice holds the owner cleared on 2026-10-30 (`notice-clearances.json`). The inventory amends each row in place, following [wave 1](spells-536.md#launch-re-assessment-whole-content-wave-1-2026-11-03) and [wave 2](spells-544.md#launch-re-assessment-whole-content-wave-2-2026-11-03): a superseding `rationale`, the old assessment (with its `missingEvidence` and `unboundedClassMappings`) in `assessmentHistory`, the comparison in `launchReview` and a new `binding`. The 2026-10-07 `comparison` block and `linkedContent` stay as history; the named hold's `missingEvidence` carries its hold. The batch's other 62 candidates keep their 2026-10-07 review and holds (#516/#735 remaining acceptance).

**29 admitted, 6 confirmed but dependently omitted, two confirmed but held by the gate on a required notice with no Registry record (Disfiguring Touch on PZO1139, Bull's Strength on PZO9413), and Absorbing Inhalation held on a named owner content hold.** The batch has no counts block; `launchReassessment` lists the keys.

- **Evidence.** Each body was compared in full with PCGen `25523dbc`, and the system fields with its base row. The full body is the `.MOD … DESC:…|PRERULE:1,DisplayFullSpell` row for `cr_spells.lst` and `apg_spells.lst`, and the base row's DESC carrying that PRERULE for `um_spells.lst` and `uc_spells.lst` (Unerring Weapon, `uc_spells.lst:145`, new to the waves). `arg_spells.lst` has no `.MOD` rows, so the base row's single DESC is the full body: Absorbing Inhalation, Fire Trail and Touch of Combustion. The 2026-10-07 CRB comparison rows are reused where they exist. `launchReview.pcgen` cites each file, line, literal row and both hashes. `apg_spells.lst:1944` also carries the `Fester.MOD` record after Feather Step, Mass's DESC on the same physical line; only Feather Step, Mass's DESC is compared. The PRD capture has no spell pages, so no PRD page is cited.
- **Class levels.** No class or domain level the PCGen base row lists conflicts with Foundry's `learnedAt`. Later-book classes in `learnedAt.class` that the base row doesn't list are decided on the spell's own evidence (S-03), never as a hold.
- **Granted levels (fix round 1).** S-03 covers `learnedAt.class` only. Domain, subdomain and bloodline mappings are imported as `detail.grantedLevels`, so each one the base row doesn't list needs permitted-source evidence and its book's notice. `launchReview.metadata.grantedLevelEvidence` records each one, with its literal pinned PCGen rows and hashes:
  - **Advanced Player's Guide subdomains (PZO1115):** Bull's Strength Rage 2, Pyrotechnics Smoke 2, Dimensional Anchor Wards 4, Project Image Deception 7 and Planar Ally, Greater Tactics 8. Each is bounded by its `apg_spells.lst` `.MOD … DOMAINS:` row (`:1206`, `:1254`, `:1481`, `:1543`, `:1560`) and the subdomain's `apg_domains.lst` row (`:60`, `:66`, `:75`, `:24`, `:69`; APG pp. 95, 96, 97, 89, 96).
  - **Bull's Strength Abyssal bloodline 2 (PZO1110):** `cr_abilities_class.lst:2356` (`SPELLKNOWN:CLASS|Sorcerer=2|Bull's Strength`) and `:2351` (CRB p. 72).
  - **Ventriloquism Maestro bloodline 1 (PZO1117):** `um_abilities_class.lst:624` (`SPELLKNOWN:CLASS|Sorcerer=1|Ventriloquism`) and `:619` (Ultimate Magic p. 67).
  - **Fix round 2, from two files of the permitted PCGen commit `25523dbc`** (appended byte-identical to the pinned store):
    - Bull's Strength Orc bloodline 2 (Orcs of Golarion, PZO9413): `player_companion/orcs_of_golarion/oog_abilities_class.lst:12` (`SPELLKNOWN:CLASS|Sorcerer=2|Bull's Strength`) and `:7` (p. 14);
    - Animal Trance Scalykind domain 2 (The Inner Sea World Guide, PZO9226): `campaign_setting/inner_sea_world_guide/iswg_domains.lst:6` (`Scalykind=2|Animal Trance`, p. 216).
    
    Both records now require those books, and neither code is a key or alias in the Section 15 Registry. The outcome follows the actual notice coverage:
    - **PZO9413 (Orcs of Golarion)** has no #716 confirmation either. Its notice text is owner-owed and is not written here, so the gate holds the confirmed Bull's Strength on the missing notice, as it does Disfiguring Touch.
    - **PZO9226 (The Inner Sea World Guide)** has a checked #716 Section 15 confirmation (status matched, reviewed 2026-10-19). That confirmation matches the PCGen `campaign_setting/inner_sea_world_guide/OGL.txt` block (lines 34–85) to Registry notice `pf1-content/notice/6a15b793…`, and by the owner's 2026-10-30 decision such a block counts for every candidate of its book. The gate therefore reads PZO9226 as reviewed and admits Animal Trance.
- **Notices.** Every one of the 38 bodies carries Unchained action costs (`activation.unchained`), so each now requires **PZO1131** ([Unchained action costs](curation.md#notice-guidance)); #516 predated that rule. It is recorded in `requiredNotices` and `inheritedRuleNotices`. PZO1131's Registry record is reviewed and its holds are cleared, so no hold was added. Every root also requires **PZO1110**, the reviewed Core Rulebook notice, for the core action rules ([Core rules](curation.md#notice-guidance); #533). Fix round 1 added it to the 16 non-CRB roots that lacked it; Grove of Respite's body also invokes tiny hut, goodberry and alarm. The bounded granted-level mappings add PZO1115 (Bull's Strength, Pyrotechnics, Dimensional Anchor, Project Image, Planar Ally, Greater) and PZO1117 (Ventriloquism). The other required notices stay: PZO1115, PZO1116, PZO1117, PZO1118 and PZO1121 as reviewed PRD Registry records. No notice text, Registry record or hold entry changed.
- **Gate-held: Disfiguring Touch.** Its body agrees with `um_spells.lst:80` word for word and is confirmed. Foundry also cites Book of the Damned (PZO1139) p. 48, which has no Registry notice; that text is owner-owed and is not written here. The gate holds the record with "Missing or unreviewed required notices: PZO1139." Its cleared notice holds stay recorded and hold nothing, as for the buffs of #547–#549.
- **Dependent omissions.** Six confirmed records link a spell still held in another batch, so they are dependently omitted and their launch rows are freed: Clenched Fist (Forceful Hand, #525), Detect Chaos (Detect Evil, #541), Feather Step, Mass (Feather Step, #526), Owl's Wisdom, Mass (Owl's Wisdom, #525), Planar Ally, Greater (Planar Ally, Lesser, #526) and Symbol of Sleep (Symbol of Death, #529).
- **Named hold: Absorbing Inhalation** (`spells-516-owner-owed-content-0s8w9wfs3ygc21wh`). Foundry ends "you suffer the cloud's effects and automatically fail any saving throw to resist it"; `arg_spells.lst:144` ends at "the cloud's effects". No pinned source carries the clause. The Black Markets reprint in the PCGen cache, which is not pinned, also ends there. The owner's check against the Advanced Race Guide p. 160 is owed; the assessment stays unresolved.
- **Judgement item: Summon Nature's Ally I, confirmed.** Foundry reads "the 1st Level list on Table 10-2"; `cr_spells.lst:1344` reads "Table 10-6" and ends "[Chart not included]". PCGen numbers the same summoning tables four higher: Summon Monster I is Table 10-1 in Foundry and 10-5 in PCGen (`cr_spells.lst:1335`). The cross-reference states no rule of its own, so it is recorded as a wording difference, as were Greater Hollow Heroism's page reference (wave 1) and Reduce Animal's "see Chapter 6" (wave 2).
- **Other recorded differences.** Wording: Project Image "quasi-real" against "quasireal". Notation only: PCGen `%%` (Chameleon Stride, Wood Shape), `\x95` bullets (Disfiguring Touch), `&nl;`/`&pipe;` table markup (Imbue with Spell Ability), "3d6 ? 10 minutes" for the multiplication sign (Symbol of Sleep), "- 1" (Clenched Fist), "x" (Orb of the Void), spacing (Spiritual Ally) and the variable "%1 rounds" (Absorbing Inhalation). Metadata, all unmapped action data:
  - Pyrotechnics' PCGen save is "Will negates or Fortitude negates; see text"; Foundry carries Will on its fireworks action and Fortitude on its smoke action.
  - Symbol of Sleep's base row has no casting time; it "functions like symbol of death", whose base row has 10 minutes, as Foundry does.
  - Absorbing Inhalation's and Touch of Combustion's target and save wording, Sympathetic Vibration's "None; see text" save and Unerring Weapon's save order differ only in wording.
  - Five PCGen durations are marked (D) without Foundry's dismiss flag.
- **Mapped descriptors** agree after notation. Project Image's "shadow" is PCGen's subschool; Planar Ally, Greater's "see text for lesser planar ally" is the Core Rulebook's bracketed note, with no PCGen descriptor.
- **Bindings.** The six link-bearing roots were bound on their full-preview closures. The bounded fixture lacks the spells they link, so the importer strips those links. The batch test replays them with [`linked-context.json`](../../tests/fixtures/spells-516/linked-context.json): the six roots and the ten spells they reach. Two content fingerprints moved against the 2026-10-07 bindings (Feather Step, Mass and Owl's Wisdom, Mass); the other 36 are unchanged.

### Previews

| Preview                      |      Admitted |             Held | Dependent omissions |                        Failures |
| ---------------------------- | ------------: | ---------------: | ------------------: | ------------------------------: |
| Bounded, wave 3's 39 keys    |            30 |                3 |                   0 | 6 (out-of-selection references) |
| Full corpus, base `2f62097d` |           447 |           23,352 |                 174 |                           1,761 |
| Full corpus, wave 3          | **483** (+36) | **23,316** (−36) |   **174** (unchanged) |               1,761 (unchanged) |

The bounded preview's 6 failures are the six omissions, whose linked spells are outside the selection; its 3 held are Absorbing Inhalation (named hold) and the two gate-held records. In the full corpus, 30 held records are admitted (29 here and Scrying) and 6 move to dependent omissions. Six records of other batches move from dependently omitted to admitted, because they were omitted only for linking a wave-3 spell: Summon Nature's Ally IX (#544; root option B updates [its record](spells-544.md#launch-re-assessment-whole-content-wave-2-2026-11-03)), Scry on Familiar and Familiar (#505), pf-buffs-548's Divine Power (`pf1-content/0hRYCva2hdwUNFh6`) and Unerring Weapon (`pf1-content/5M1texkD3FX1c5D3`), and pf-buffs-549's Protection From Arrows (`pf1-content/Zom7V8sNXZF2ML0M`). Each already had a confirmed assessment, and no binding of theirs moved. buffs-547's Bull's Strength (`pf1/ClOy4KHJFDdt0ALh`) stays dependently omitted, because the spell it links is held. Nothing else moved.

### Launch inventory

The notice authority was regenerated with S1's procedure (`noticeAuthoritySha256` `9a06a7cc…` → `8a7da1185c092227060f22b3a9e43459bbf82e8cb001d473269c5031441059df`, base `2f62097d`). `catalog:launch-inventory --write`, then `--check`, pass.

- **Identity:** `sha256:fa66a70e…` → `sha256:acd52ec6a1394ef93c934f52601f6df809e3c7a05234d981c291530d14f82021`.
- **Failures:** 96,703 → **96,665 (−38)**: 38 rows lose their last hold, and Absorbing Inhalation swaps its whole-content hold for its named hold. The two gate-held records carry no hold of their own; their missing notices are failures of the existing `notice/PZO1139` and `notice/PZO9413` rows. Rows (19,267), required notices (70) and inventory errors (0) are unchanged.
- **Decoded delta:** the 39 rows' holds and recorded-disposition evidence, and Summon Nature's Ally IX's recorded disposition. For the 38 #516 rows, the existing PZO1131 edges and the 16 added PZO1110 dependencies now name the inventory as their reason. Eight new notice edges carry the bounded mappings' books: PZO1115 ×5, PZO1117 ×1, PZO9413 ×1 and PZO9226 ×1. No row is added or removed. The existing `notice/PZO9413` and `notice/PZO9226` rows change only their provenance source, which is now the first spell that requires them; their state and holds are unchanged.

<!-- prep:shared-store-count -->
New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `675b11ea`: **2** (pcgen 2).
<!-- /prep:shared-store-count -->

The five comparison files (`cr_spells.lst`, `apg_spells.lst`, `um_spells.lst`, `arg_spells.lst` and `uc_spells.lst`) were already in the pinned store, byte-identical to `.ep-cache/pcgen-25523dbc`. Fix round 2 appended two PCGen files from that commit, each byte-identical to its blob:
- `pcgen/data/pathfinder/paizo/player_companion/orcs_of_golarion/oog_abilities_class.lst` (sha256 `f1fe6b2a00bb445ecb7351c7e4f69cc0a7a2d7fe0627212ccdc3ac96dc4632d0`);
- `pcgen/data/pathfinder/paizo/campaign_setting/inner_sea_world_guide/iswg_domains.lst` (sha256 `81f7026d6227076550815d9f8ec793aa9f19b5e0fe5f3bbe0f2aebb4bbd35a4d`).

The prep-owned count above is refreshed at the next prep.

| Spell | Key | Book | PCGen full / base row | Word diffs | Note | Outcome |
| --- | --- | --- | --- | ---: | --- | --- |
| Absorbing Inhalation | `pf1/0s8w9wfs3ygc21wh` | PZO1121 p. 160 | `arg_spells.lst:144` / `:144` | 2 | Foundry adds "and automatically fail any saving throw to resist it"; `%1 rounds` is notation | Held: `spells-516-owner-owed-content-0s8w9wfs3ygc21wh` |
| Animal Messenger | `pf1/0324zq42g3fu4kko` | PZO1110 p. 241 | `cr_spells.lst:785` / `:20` | 0 |  | Admitted |
| Animal Trance | `pf1/05m8kfc2u9cg528g` | PZO1110 p. 241 | `cr_spells.lst:787` / `:22` | 0 | domain Scalykind 2 (ISWG, `iswg_domains.lst:6`); PZO9226 read through its #716 confirmation | Admitted |
| Bull's Strength | `pf1/05i5rxwim12hwktu` | PZO1110 p. 251 | `cr_spells.lst:831` / `:68` | 0 | Rage (APG), Abyssal (CRB) and Orc (Orcs of Golarion, `oog_abilities_class.lst:12`) bounded; PZO9413 has no Registry notice | Confirmed; held by the gate (PZO9413 has no Registry notice) |
| Chameleon Stride | `pf1/16j7zppo8x5wj7ve` | PZO1115 p. 210 | `apg_spells.lst:1893` / `:63` | 0 | notation: PCGen `%%` | Admitted |
| Clenched Fist | `pf1/0amu53wegzdp0axj` | PZO1110 p. 255 | `cr_spells.lst:854` / `:92` | 0 | notation: "- 1" | Confirmed; dependently omitted (Forceful Hand, #525) |
| Confess | `pf1/09mmf2pjefmjyqsp` | PZO1115 p. 212 | `apg_spells.lst:1899` / `:69` | 0 |  | Admitted |
| Contagious Flame | `pf1/0cbreqkr1vp7meyi` | PZO1115 p. 212 | `apg_spells.lst:1900` / `:70` | 0 |  | Admitted |
| Countless Eyes | `pf1/0peluu0s9phfnur1` | PZO1117 p. 213 | `um_spells.lst:56` / `:56` | 0 |  | Admitted |
| Dancing Lantern | `pf1/0j43l3u9eqj5gvnp` | PZO1115 p. 214 | `apg_spells.lst:1911` / `:79` | 0 |  | Admitted |
| Detect Chaos | `pf1/17eskras8cjynj10` | PZO1110 p. 266 | `cr_spells.lst:914` / `:153` | 0 |  | Confirmed; dependently omitted (Detect Evil, #541) |
| Dimensional Anchor | `pf1/0vmz2klcfvkc3h0v` | PZO1110 p. 270 | `cr_spells.lst:927` / `:166` | 0 | subdomain Wards 4 (APG, `apg_spells.lst:1481`) | Admitted |
| Disfiguring Touch | `pf1/13pilcgm2oydyogv` | PZO1117 p. 217; PZO1139 p. 48 | `um_spells.lst:80` / `:80` | 0 | notation: PCGen `\x95` bullets; also cites PZO1139 p. 48, which has no Registry notice | Confirmed; held by the gate (PZO1139 has no Registry notice) |
| Divine Power | `pf1/0yvwyclhkf76veo1` | PZO1110 p. 273 | `cr_spells.lst:946` / `:185` | 0 | frees buff Divine Power (#548) | Admitted |
| Feather Step, Mass | `pf1/04px7z4lxxgfsf4j` | PZO1115 p. 221 | `apg_spells.lst:1944` / `:109` | 0 | PCGen `apg:1944` also carries `Fester.MOD` | Confirmed; dependently omitted (Feather Step, #526) |
| Fire Seeds | `pf1/0hknfnoaljc75fj3` | PZO1110 p. 282 | `cr_spells.lst:989` / `:230` | 0 |  | Admitted |
| Fire Trail | `pf1/17iuomx6dc1h5cfx` | PZO1121 p. 119 | `arg_spells.lst:94` / `:94` | 0 |  | Admitted |
| Frigid Touch | `pf1/10nnddmxvgxo78og` | PZO1117 p. 221 | `um_spells.lst:105` / `:105` | 0 |  | Admitted |
| Grove of Respite | `pf1/0sssdtv0tkbns2r3` | PZO1115 p. 226 | `apg_spells.lst:1972` / `:137` | 0 | PZO1110 added (invokes tiny hut, goodberry, alarm) | Admitted |
| Imbue with Spell Ability | `pf1/0axqb92kzlesc24q` | PZO1110 p. 299 | `cr_spells.lst:1076` / `:320` | 0 | notation: PCGen `&nl;`/`&pipe;` table | Admitted |
| Knight's Calling | `pf1/0y2vp0lwyr9b58b8` | PZO1115 p. 230 | `apg_spells.lst:1996` / `:159` | 0 |  | Admitted |
| Orb of the Void | `pf1/003tu19dpyoaj0se` | PZO1117 p. 230 | `um_spells.lst:153` / `:153` | 0 | notation: "x" for "&times;" | Admitted |
| Owl's Wisdom, Mass | `pf1/14chms7xurvi85x9` | PZO1110 p. 318 | `cr_spells.lst:1174` / `:421` | 0 |  | Confirmed; dependently omitted (Owl's Wisdom, #525) |
| Planar Ally, Greater | `pf1/0wamdkl9gp19l55w` | PZO1110 p. 320 | `cr_spells.lst:1187` / `:435` | 0 | subdomain Tactics 8 (APG, `apg_spells.lst:1560`) | Confirmed; dependently omitted (Planar Ally, Lesser, #526) |
| Project Image | `pf1/0w3hvcp3gb2bhtv5` | PZO1110 p. 327 | `cr_spells.lst:1212` / `:462` | 1 | "quasi-real" vs PCGen "quasireal"; subdomain Deception 7 (APG, `apg_spells.lst:1543`) | Admitted |
| Protection from Arrows | `pf1/00wyen2uho8firph` | PZO1110 p. 327 | `cr_spells.lst:1213` / `:463` | 0 | frees buff Protection From Arrows (#549) | Admitted |
| Protection from Spells | `pf1/0kppkhsencd6tzvh` | PZO1110 p. 328 | `cr_spells.lst:1219` / `:469` | 0 |  | Admitted |
| Pyrotechnics | `pf1/0d756xyqhinsstas` | PZO1110 p. 328 | `cr_spells.lst:1223` / `:471` | 0 | save: PCGen "Will negates or Fortitude negates"; Foundry splits the two across its two actions; subdomain Smoke 2 (APG, `apg_spells.lst:1254`) | Admitted |
| Refuge | `pf1/080el1lfozrhf6c2` | PZO1110 p. 331 | `cr_spells.lst:1237` / `:486` | 0 |  | Admitted |
| Spiritual Ally | `pf1/0lrux8tmaml5fkw6` | PZO1115 p. 246 | `apg_spells.lst:2071` / `:227` | 0 | notation: spacing | Admitted |
| Summon Nature's Ally I | `pf1/0jwi6xovzukorxok` | PZO1110 p. 354 | `cr_spells.lst:1344` / `:594` | 2 | cross-reference: Foundry "Table 10-2", PCGen "Table 10-6" and "[Chart not included]"; frees SNA IX (#544) | Admitted |
| Symbol of Sleep | `pf1/0khn0u6nd4fat6wb` | PZO1110 p. 356 | `cr_spells.lst:1361` / `:611` | 1 | notation: PCGen "3d6 ? 10 minutes" (lost "&times;") | Confirmed; dependently omitted (Symbol of Death, #529) |
| Sympathetic Vibration | `pf1/0gg4uir1psakz59e` | PZO1110 p. 357 | `cr_spells.lst:1364` / `:614` | 0 |  | Admitted |
| Touch of Combustion | `pf1/0li6cdx4qgwihry7` | PZO1121 p. 131 | `arg_spells.lst:113` / `:113` | 0 |  | Admitted |
| Unerring Weapon | `pf1/09juighnblqlqwro` | PZO1118 p. 248 | `uc_spells.lst:145` / `:145` | 0 | frees buff Unerring Weapon (#548) | Admitted |
| Ventriloquism | `pf1/0onqjy8gfgop1xsi` | PZO1110 p. 365 | `cr_spells.lst:1402` / `:654` | 0 | bloodline Maestro 1 (UM, `um_abilities_class.lst:624`) | Admitted |
| Ward the Faithful | `pf1/006yfbelwtwts8cr` | PZO1115 p. 256 | `apg_spells.lst:2116` / `:269` | 0 |  | Admitted |
| Wood Shape | `pf1/10e3iwsr5jkq4q73` | PZO1110 p. 370 | `cr_spells.lst:1424` / `:676` | 0 | notation: PCGen `%%` | Admitted |
