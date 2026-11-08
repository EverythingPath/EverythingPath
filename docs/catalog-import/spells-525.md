# Spell curation review: #525

**Sol (AI curator) for the owner**, reviewed **2026-10-08**, following [#525](https://github.com/AndreasUnunger/EverythingPath/issues/525), [PRD #251 Decisions 9, 10 and 17 and the acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461), [Spellcasting](../character-sheet/spellcasting.md), [curation](curation.md) and the [#328 precedent](races-328.md).

Exactly **100 raw spell definitions**: **0 admitted, 100 specifically held, 0 dependently omitted, 0 wholly unsupported/prose-only and 0 excluded**. Crown of Glory’s record-level `3.5` tag receives a specific additional hold under the owner’s 2026-10-08 decision; it is never excluded. No Catalog Release, deployment or production data changes.

## Evidence and scope

- Read-only Foundry PF1 v11.11: `418761d2e16a6037c0156bb4a241f7cea5a2986d`; pf1-content 11.4.0: `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`. Both CLI pin checks verify the complete source checkouts.
- [Batch inventory, legal evidence and mechanics review](../../scripts/catalog/legal/spells-525.json) records every exact key, raw source path/hash, all actions and materials, class/granted lists, descriptions, inherited rule evidence, notice identities and independently outstanding calculations.
- [Fixture provenance](../../tests/fixtures/spells-525/provenance.json) pins **100 ticket roots and 77 unreviewed context files**: 49 class lookup definitions and 28 recursive inherited Spells. They are byte-identical pinned data, not extra reviewed candidates. Manifest hashes are also retained.
- [Overlay](../../scripts/catalog/reviewed-curation.json), [assessments](../../src/lib/catalog/data/attribution-assessments.json), [evidence](../../src/lib/catalog/data/attribution-evidence.json) and [enforced notice holds](../../scripts/catalog/legal/held-notices.json) add only this batch’s identities.

The exact ordered ticket-key SHA256 is `4c21e6c0a461e098727154e32db09688f1baf48e280e32c2e8770fe8cc700bc0`. The [complete-context fixture](../../tests/fixtures/spells-525/binding-preview.json) retains the 100 roots and only their 28 recursive extraction dependencies. The [bounded fixture](../../tests/fixtures/spells-525/preview.json) separately replays the exact selection. Neither is legally admitted output.

A fresh, fixed-commit permitted comparison used [PCGen CRB Spell data](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_spells.lst) and [campaign metadata](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/core_rulebook.pcc). File hashes match the prior batches’ `6da07d57030565fec332991219192133f06d699a960d9d2cb9a5da9e9282bb31` and `8638a1197e2a541695f3005feb1a6eb67569220a5b0f151bc37819d3121feb06`. Literal base rows and full `DisplayFullSpell` `.MOD` descriptions, line numbers and hashes are recorded per candidate.

Of **16 directly cited CRB Spells**, **12 descriptions match** after HTML/entity/UUID-display, punctuation, whitespace and case normalization. Earthquake changes “Chapter 13” to an Environment reference; Detect Undead and Major Creation retain different table presentation tokens; Summon Monster IV’s raw UUID has no display label. All four differences are retained, with no alias or correction guessed. Even matching descriptions do not cover expanded class/granted lists, editor additions, action/material fields, inherited origins or complete notice chains. PCGen’s Paizo Inc. wording is not declared equivalent to the Registry’s Paizo Publishing, LLC notice. No book PDFs were available; Archives of Nethys was not used. Upstream was read as inert data, with no runtime/configuration imported or executed.

## Attribution and inherited notices

All 100 Spells have individually named `spells-525-whole-content-<ID>` unresolved assessments bound to the final full-source content closure, mapping, evidence and notices. The inventory names **55 observed minimum notice identities** and **54 individually enforced complete-chain holds**; the existing CRB identity is reused. These minimum requirements are not a complete origin bound. Existing #333–#336 and #516–#519 holds and their required inherited-rule audits remain untouched.

**94 distinct per-candidate inherited book dependencies** are structured in `inheritedRuleNotices` and accompanied by exact quotes and pinned source citations. Direct linked sources and transitive inherited Spells also remain recorded. Highlights:

| Spell                      | Known inherited notice    | Rule                                                                                               |
| -------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------- |
| Mighty Strength            | PZO1110                   | Bull’s Strength                                                                                    |
| Dance of a Thousand Cuts   | PZO1117, PZO1110          | Dance of a Hundred Cuts plus Haste, whose shared Source remains an outstanding running integration |
| Fear the Sun               | PZO1112, PZO1110          | Light blindness universal monster rule; blinded/dazzled                                            |
| Summon Monster IV          | PZO1112, PZO1110          | Inherited summon rules and celestial/fiendish templates                                            |
| Imbue Army Special Ability | PZO1125                   | Ultimate Campaign mass combat                                                                      |
| Ki Leech                   | PZO1115, PZO1110          | Hungry Ghost Monk Steal Ki and Ki Pool                                                             |
| Polypurpose Panacea        | PZO1114, PZO1110          | GameMastery Guide intoxication and named CRB Spell/condition rules                                 |
| Crafter’s Nightmare        | PZO1125, PZO1132, PZO1110 | Capital/income, occult rituals and magic-item crafting                                             |

`catalog:notice-deps` has zero recorded dependency gaps and zero warnings for this batch. Existing advisory warnings elsewhere stay visible and are not cleared by this review. No Registry notice, provenance, alias or legal-resource text is changed.

## Every-key disposition

Every row is specifically held for its individually recorded whole-content gap and any notice-chain requirements. Mechanic findings and bounded reference failures are separate, not additional dispositions.

| Exact key              | Spell                      | Direct source citation          | Disposition                 |
| ---------------------- | -------------------------- | ------------------------------- | --------------------------- |
| `pf1/ZfIcUHFlHI3Ummro` | Poisonous Cloud            | PZO9487, p. 11                  | Specifically held           |
| `pf1/ZzgreX1h0BOJAbDu` | Mighty Strength            | PZO9408, p. 22                  | Specifically held           |
| `pf1/a0w41d06aqlu70xs` | Curse of Disgust           | PZO1117, p. 215                 | Specifically held           |
| `pf1/a111te7xsmnclbjr` | Lissalan Snake Sigil       | PZO9065, p. 75                  | Specifically held           |
| `pf1/a1jn7g374wcrb9mz` | Stone to Flesh             | PZO1110, p. 350                 | Specifically held           |
| `pf1/a1yur84hxw6i9w24` | Shadow Barbs               | PZO9237, p. 59                  | Specifically held           |
| `pf1/a24oos1m8mjc793r` | Enshroud Thoughts          | PZO1132, p. 169; PZO9447, p. 13 | Specifically held           |
| `pf1/a284vfyjpxla98v0` | Transmogrify               | PZO1115, p. 250                 | Specifically held           |
| `pf1/a2h4muihkc4pdpo2` | Steal Years, Greater       | PZO9427, p. 30                  | Specifically held           |
| `pf1/a2y1yf0a4jy3610w` | Hallucinatory Terrain      | PZO1110, p. 293                 | Specifically held           |
| `pf1/a3yc6tgu9zjx7el9` | Rebuke Technology          | PZO9272, p. 10                  | Specifically held           |
| `pf1/a4u2i842ym28rimq` | Quick Throwing             | PZO9091, p. 71                  | Specifically held           |
| `pf1/a4z9yazsd7ez1p0h` | Aqueous Orb                | PZO1115, p. 202                 | Specifically held           |
| `pf1/a5eu53rb6g91o0u4` | Alter Musical Instrument   | PZO1129, p. 173                 | Specifically held           |
| `pf1/a5gcbpwfhu4hh5ic` | Earthquake                 | PZO1110, p. 275                 | Specifically held           |
| `pf1/a6a6s9jysswthu3r` | Guiding Star               | PZO1115, p. 226                 | Specifically held           |
| `pf1/a6fs9lf27jsw3t66` | Emblazon Crest             | PZO9426, p. 28                  | Specifically held           |
| `pf1/a6isom7wx0nmhwfp` | Prestidigitation           | PZO1110, p. 325                 | Specifically held           |
| `pf1/a6vrmpywwpg4dpwx` | Shock Shield               | PZO1118, p. 243                 | Specifically held           |
| `pf1/a73dq2t8pd5n0y1g` | Retribution                | PZO1115, p. 239                 | Specifically held           |
| `pf1/a8gphahx0vu294yj` | Tail Strike                | PZO9470, p. 31                  | Specifically held           |
| `pf1/a9unnbrmqw6tdd60` | Daemon Ward                | PZO1139, p. 38                  | Specifically held           |
| `pf1/aP3q2vkBQ6PnvHFk` | Violent Misfire            | PZO9486, p. 29                  | Specifically held           |
| `pf1/aa0w7tk852iqn3ni` | Detect Undead              | PZO1110, p. 269                 | Specifically held           |
| `pf1/aaquu5em3wtjlkk8` | Hellfire Ray               | PZO1139, p. 184, 46             | Specifically held           |
| `pf1/abdap816xisu362w` | Honeyed Tongue             | PZO1115, p. 228                 | Specifically held           |
| `pf1/ac8q8gay28rsw7dg` | Trail of the Rose          | PZO9416, p. 29                  | Specifically held           |
| `pf1/acdzlekp5elvhxy1` | Withdraw Affliction        | PZO1132, p. 191                 | Specifically held           |
| `pf1/acjpqe8vchvzt5rl` | Air Geyser                 | PZO1129, p. 173                 | Specifically held           |
| `pf1/ad5nqt2ll67zt64d` | Shocking Image             | PZO1118, p. 243                 | Specifically held           |
| `pf1/adlgxn32acdb8jdn` | Dimensional Blade          | PZO9455, p. 30                  | Specifically held           |
| `pf1/adthxd4ppz2fx89b` | Vinetrap                   | PZO9255, p. 51                  | Specifically held           |
| `pf1/advqdmonj6ro62u7` | Fear the Sun               | PZO9466, p. 15                  | Specifically held           |
| `pf1/aer23mbtykma1n1s` | Unliving Rage              | PZO1129, p. 198                 | Specifically held           |
| `pf1/afixpamfqfc8yx7b` | Master's Mutation          | PZO9458, p. 23                  | Specifically held           |
| `pf1/afoxrj4mjkhq0cp1` | Lock Gaze                  | PZO1118, p. 236                 | Specifically held           |
| `pf1/ag5rvzbw0zuxsdeh` | Healing Leak               | PZO9492, p. 13                  | Specifically held           |
| `pf1/ai579ifbficvvnfo` | Flash Forward              | PZO9468, p. 5                   | Specifically held           |
| `pf1/ai9o7xqyftbf9ses` | Dance of a Thousand Cuts   | PZO1117, p. 216                 | Specifically held           |
| `pf1/aigibmi32id0cl65` | Ally Across Time           | PZO9480, p. 30                  | Specifically held           |
| `pf1/aij2sbjiqzhfmnod` | Numerological Evocation    | PZO9269, p. 51                  | Specifically held           |
| `pf1/aijcbslqrha12j77` | Smite Abomination          | PZO9267, p. 241; PZO9044, p. 69 | Specifically held           |
| `pf1/ajtvhtntlkv3hpuk` | Tower of Iron Will V       | PZO1132, p. 190                 | Specifically held           |
| `pf1/akwOzTsxjZcBGzIS` | Lightning Conductor        | PZO9483, p. 18                  | Specifically held           |
| `pf1/al5pmrh401jooziy` | Antithetical Constraint    | PZO9443, p. 26                  | Specifically held           |
| `pf1/aldwednxmpolaik4` | Harmless Form              | PZO9460, p. 23                  | Specifically held           |
| `pf1/amds6sfc78likqrs` | Umbral Weapon              | PZO9455, p. 31                  | Specifically held           |
| `pf1/amrtqcyc53je6wbt` | Linebreaker                | PZO1121, p. 59                  | Specifically held           |
| `pf1/ams8tn2nafvmydzu` | Daywalker                  | PZO9457, p. 15                  | Specifically held           |
| `pf1/aniaqwkahlczx4m5` | Tracking Mark              | PZO9267, p. 243; PZO9032, p. 71 | Specifically held           |
| `pf1/anya5qwdjhdfyk8u` | Restoration                | PZO1110, p. 334                 | Specifically held           |
| `pf1/ao15o4r0jwvl9obm` | Boneshatter                | PZO9084, p. 15; PZO9403, p. 26  | Specifically held           |
| `pf1/ao4p40l1bgcxtklf` | Mortal Terror              | PZO9480, p. 13                  | Specifically held           |
| `pf1/aolo0gxn1zvzy1hr` | Minor Reversion            | PZO9492, p. 28                  | Specifically held           |
| `pf1/aoov6nqfm195txdb` | Forceful Hand              | PZO1110, p. 285                 | Specifically held           |
| `pf1/aou0et73535aanjv` | Fearsome Duplicate         | PZO1121, p. 68                  | Specifically held           |
| `pf1/aq0ch7ep4av2z214` | Sense Vitals               | PZO9459, p. 31                  | Specifically held           |
| `pf1/aq152bwi65cfz8fo` | Phobia                     | PZO1135, p. 124                 | Specifically held           |
| `pf1/aq4cspb2nxh71pm8` | Flaming Aura               | PZO9091, p. 70                  | Specifically held           |
| `pf1/aqeaxoaozlv9vg35` | Vision                     | PZO1110, p. 365                 | Specifically held           |
| `pf1/aqri3zf6mzgd4di6` | Summon Monster IV          | PZO1110, p. 352                 | Specifically held           |
| `pf1/arzq5ar5gcteqwtp` | Steady Saddle              | PZO1136, p. 177                 | Specifically held           |
| `pf1/at1jo3acj1rdlmrn` | Imbue Army Special Ability | PZO9433, p. 29                  | Specifically held           |
| `pf1/atclo4xtkept97ox` | Deadeye's Arrow            | PZO9267, p. 232; PZO9202, p. 15 | Specifically held           |
| `pf1/atml1a51o9w777w7` | Undead Anatomy I           | PZO1117, p. 244                 | Specifically held           |
| `pf1/au6p72aztjhtokwr` | Akashic Form               | PZO1132, p. 156                 | Specifically held           |
| `pf1/auliu676zrdjmjs6` | Illusory Maze              | PZO9283, p. 41                  | Specifically held           |
| `pf1/auqa5b0x0een6jcm` | Trace Teleport             | PZO1134, p. 226                 | Specifically held           |
| `pf1/auvsi3fenss2hga9` | Burst of Nettles           | PZO1117, p. 210                 | Specifically held           |
| `pf1/av7YbbrWBVgNp2hP` | Crown of Glory             | PZO1111, p. 206                 | Held; also record-level 3.5 |
| `pf1/avofn5q2v0f0qxjy` | Spiritual Weapon           | PZO1110, p. 348                 | Specifically held           |
| `pf1/awia42zci8nufpfl` | Nondetection               | PZO1110, p. 317                 | Specifically held           |
| `pf1/axe8kelwutjkwh80` | Jitterbugs                 | PZO1121, p. 39                  | Specifically held           |
| `pf1/axl8z3mae9ydejlt` | Deathless                  | PZO1126, p. 113                 | Specifically held           |
| `pf1/ay8nnkkegcb1zfb0` | Resist Energy, Communal    | PZO1118, p. 242                 | Specifically held           |
| `pf1/ayvd6wrq2lmq9211` | Bountiful Banquet          | PZO1134, p. 205                 | Specifically held           |
| `pf1/azyo7xhfwdtjchtm` | Polypurpose Panacea        | PZO1117, p. 232                 | Specifically held           |
| `pf1/b1wzbehqfac9s1be` | Mage's Faithful Hound      | PZO1110, p. 306                 | Specifically held           |
| `pf1/b2y7l4cronnp5zls` | Betraying Sting            | PZO9296, p. 62                  | Specifically held           |
| `pf1/b2yholbb5a0g8peg` | Vicarious View             | PZO1134, p. 229                 | Specifically held           |
| `pf1/b3cj2kuyqat19fx9` | Commune with Birds         | PZO1121, p. 167                 | Specifically held           |
| `pf1/b3hyz4dnnkgw9nfu` | Blade Lash                 | PZO1129, p. 175                 | Specifically held           |
| `pf1/b3koss885z9u6ecl` | Shared Sacrifice           | PZO9267, p. 240; PZO9420, p. 28 | Specifically held           |
| `pf1/b3slhttlo5jytfti` | Ki Leech                   | PZO1117, p. 225                 | Specifically held           |
| `pf1/b433azw2m5ov8pkq` | Thorny Entanglement        | PZO1129, p. 196                 | Specifically held           |
| `pf1/b49ketr3vgjnld0c` | Virulent Miasma            | PZO1136, p. 69                  | Specifically held           |
| `pf1/b5apdmp3s5g78uxw` | Remove Radioactivity       | PZO9272, p. 11                  | Specifically held           |
| `pf1/b5i4dm8hv3is2bky` | Conversing Wind            | PZO9452, p. 30                  | Specifically held           |
| `pf1/b5mz8voksps5g4yq` | Legend Lore                | PZO1110, p. 304                 | Specifically held           |
| `pf1/b5wntsqynqa2xb34` | Adjustable Disguise        | PZO1129, p. 172                 | Specifically held           |
| `pf1/b7cjr9x4kqnq9o0l` | Barghest Feast             | PZO90117, p. 76                 | Specifically held           |
| `pf1/b84qtxpkenolyt8b` | Contingent Action          | PZO1129, p. 178                 | Specifically held           |
| `pf1/b8h35mj2mzvhbqux` | Heroic Fortune             | PZO1115, p. 324                 | Specifically held           |
| `pf1/b8lt1275mz4ez4d8` | Major Creation             | PZO1110, p. 311                 | Specifically held           |
| `pf1/b8vp8fgt1o6pq1qc` | Continual Flame            | PZO1110, p. 260                 | Specifically held           |
| `pf1/b9ggsagifzk4fwut` | Owl's Wisdom               | PZO1110, p. 318                 | Specifically held           |
| `pf1/b9klr16gssc2x0ab` | Entice Fey                 | PZO1134, p. 213                 | Specifically held           |
| `pf1/b9v7qh4c7hmcjtfv` | Crafter's Nightmare        | PZO9471, p. 27                  | Specifically held           |
| `pf1/bLOXAvcgrCd2cIty` | Curse of Dragonflies       | PZO9485, p. 21                  | Specifically held           |
| `pf1/ba8ur1roqmqxn0j5` | Elemental Speech           | PZO1115, p. 218                 | Specifically held           |

## Mechanics and separate prose review

The required-note/conditional/Item Ability collector yields **zero required records** for this batch. The separate prose drafter found 43 descriptions; the complete editorial pass checks **all 100 exact raw descriptions**, including the other 57. Ninety-five Spells have manually reviewed readable Notes, with relevant clauses scoped to existing shared Situations and local labels only where no shared Situation fits. No numeric Modifiers are placed on recorded Spells. Ordinary Source identity and all stable remaps remain unchanged.

Nondetection, Hallucinatory Terrain, Violent Misfire, Prestidigitation and Detect Undead are fixed inherited context in earlier batches. Their checked records deliberately have no output: the existing sanitized descriptions already supply their readable rules, and no additional statistic or duplicate Note is needed. Detect Undead’s pending conditional stun stays explicit in this inventory; its unchanged inherited warning list preserves the earlier artifacts. Thus the inventory has **61 mechanics gaps**, while the optional curation report has **60 diagnosed descriptions**.

The 61 Spells below retain explicit, unresolved running Spell Effect, condition, item or companion integrations. These are not attribution gaps. Direct damage, encounters, rerolls, turn procedures, ad hoc resources and other quantities outside the consuming sheet contract remain prose; their literal formulas, targets, ranges, saves, components and actions remain in per-key metadata. No class schedule, Base Item, Item Ability or companion resource is newly curated.

| Spell                    | Outstanding calculation or state integration                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Poisonous Cloud          | Running Constitution damage and inherited concealment integration.                                                                         |
| Mighty Strength          | Running +8 enhancement Strength Spell Effect.                                                                                              |
| Curse of Disgust         | Conditional sickened integration and awareness/trigger selection.                                                                          |
| Lissalan Snake Sigil     | Separate chosen-school effects, mental penalties, conditions, visual Perception, vulnerability, Displacement and Slow integrations.        |
| Stone to Flesh           | Petrified condition removal.                                                                                                               |
| Shadow Barbs             | Generated weapon, targeted enhancement, proficiency, Vicious Item Ability and its damage recovery.                                         |
| Transmogrify             | Companion evolution reallocation and Aspect state integration.                                                                             |
| Steal Years, Greater     | Chosen age changes, physical ability adjustments and end-of-effect fatigued condition.                                                     |
| Rebuke Technology        | Unconscious condition integration for creature targets.                                                                                    |
| Quick Throwing           | Granted thrown-weapon drawing/attack capability, without globally granting Quick Draw.                                                     |
| Aqueous Orb              | Engulfed entangled/cover effects and conditional movement state.                                                                           |
| Earthquake               | Pinned/prone and lost-action condition integration; terrain procedures remain manual.                                                      |
| Shock Shield             | Running +2 force shield AC with touch handling and Magic Missile protection.                                                               |
| Retribution              | Running -4 attacks/skills/ability checks and same-god conditional save penalty.                                                            |
| Tail Strike              | Natural attack grant, size damage, secondary attack rules and deity-restricted class-list extension.                                       |
| Daemon Ward              | Daemon-restricted Death Ward effect and negative-level suppression.                                                                        |
| Detect Undead            | Conditional stunned integration.                                                                                                           |
| Honeyed Tongue           | Chosen gather-information +5 competence Diplomacy effect; reroll stays prose.                                                              |
| Withdraw Affliction      | Affliction removal and held touch-charge state integration.                                                                                |
| Dimensional Blade        | Targeted weapon touch-attack override, force defenses, damage type and half damage.                                                        |
| Vinetrap                 | Progressive speed penalty, material choices, blinded/staggered conditions and component suppression.                                       |
| Fear the Sun             | Light blindness, blinded/dazzled condition lifecycle.                                                                                      |
| Unliving Rage            | Running profane ability/Will bonuses and AC penalty with inherited Rage limits.                                                            |
| Master's Mutation        | Chosen movement/senses/monster abilities and summoned-companion natural attack substitution.                                               |
| Lock Gaze                | Concealment/averted gaze and conditional blinded effect.                                                                                   |
| Dance of a Thousand Cuts | Running melee attack/damage, Acrobatics and conditional AC morale bonuses plus shared Haste Source/extra attack/speed.                     |
| Smite Abomination        | Target-specific melee attack/damage and DR bypass with Smite non-stacking.                                                                 |
| Tower of Iron Will V     | Running restricted spell resistance and selected undercast level.                                                                          |
| Lightning Conductor      | Absorption pool and targeted charged-weapon damage state.                                                                                  |
| Harmless Form            | Companion form choices and inherited size/ability/natural armor transformation, with prohibited grants suppressed.                         |
| Linebreaker              | Running conditional speed and +2 bull rush/overrun CMB effects.                                                                            |
| Daywalker                | Corporeality, monster ability suppression and touch/drain overrides.                                                                       |
| Tracking Mark            | Target-bound Survival DC adjustment and Perception bonus.                                                                                  |
| Restoration              | Condition/negative-level and chosen ability damage/drain removal, with weekly limit.                                                       |
| Boneshatter              | Conditional exhausted/fatigued integration.                                                                                                |
| Mortal Terror            | Fear escalation and helpless integration.                                                                                                  |
| Forceful Hand            | Opponent-bound inherited +4 cover AC and summoned-hand statistics, kept distinct from caster modifiers.                                    |
| Fearsome Duplicate       | Conditional Intimidate/Perception and familiar-observer save bonuses.                                                                      |
| Sense Vitals             | Conditional sneak-attack dice and manufactured-weapon/30-foot constraints.                                                                 |
| Phobia                   | Chosen-trigger fear conditions and timing/removal.                                                                                         |
| Flaming Aura             | Fire subtype immunity/vulnerability and separately stacking aura choices.                                                                  |
| Vision                   | End-of-casting fatigued condition.                                                                                                         |
| Steady Saddle            | Targeted saddle mounted-ranged penalty adjustment and situational concentration.                                                           |
| Undead Anatomy I         | Chosen size/ability/natural armor, natural attacks, senses/movement and selective undead treatment.                                        |
| Akashic Form             | Recorded physical-stat/condition restore and retained mental/energy-drain state.                                                           |
| Crown of Glory           | Running +4 enhancement Charisma and inherited mind-control effects; 3.5 hold is independent.                                               |
| Jitterbugs               | Running Dexterity-check/skill penalties and action restrictions.                                                                           |
| Deathless                | HP-death override, retaining other death sources.                                                                                          |
| Resist Energy, Communal  | Chosen-energy resistance and allocated duration effects.                                                                                   |
| Polypurpose Panacea      | Separate chosen effects with correct bonus types, Perception penalty, temporary HP, durations and discharge; inherited sobriety penalties. |
| Blade Lash               | Targeted single-use trip CMB +10 and extended range.                                                                                       |
| Ki Leech                 | Ki resource integration and non-stacking.                                                                                                  |
| Thorny Entanglement      | Inherited entangled/difficult-terrain and escape integration.                                                                              |
| Virulent Miasma          | Disease-save penalty and inherited concealment with lingering duration.                                                                    |
| Remove Radioactivity     | Radiation-specific drain removal and hazard state.                                                                                         |
| Adjustable Disguise      | Running Disguise +10 with selected form/change count.                                                                                      |
| Barghest Feast           | Running profane attacks/saves/skills bonus based on recorded feeding rounds.                                                               |
| Owl's Wisdom             | Running +4 enhancement Wisdom with permanent bonus-spell exclusion.                                                                        |
| Crafter's Nightmare      | Conditional skill penalties and long-casting concentration, including Ultimate Campaign/Occult Adventures procedures.                      |
| Curse of Dragonflies     | Flight maneuverability override and landing/fall state.                                                                                    |
| Elemental Speech         | Chosen communication language/subtype effect without permanent language grant.                                                             |

Eight action/prose discrepancies remain explicit, without corrections guessed from unavailable books:

| Spell                   | Evidence discrepancy                                                                                                                                                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Violent Misfire         | Structured damage floor(CL/2)d6 omits the stated maximum 10d6.                                                                                                                                                                           |
| Hellfire Ray            | extraAttacks count max(1,floor((CL+1)/4-3)) grants an extra ray at CL11 and has no maximum-two-extra cap, unlike the description; combined fire/unholy damage types do not allocate the stated half shares.                              |
| Vinetrap                | Action describes a long-range 10-foot/level spread, 90 feet high, ten-minute casting and hour/level duration; the prose instead describes progressive vines on one subject. Preserve both; book-only reconciliation remains unavailable. |
| Numerological Evocation | Eight Basic Energies table is absent from the raw record; range paragraph says numerological resistance rather than this spell. No energy-table values invented.                                                                         |
| Burst of Nettles        | Initial structured 3d6 is typed acid/areaOfEffect; prose calls initial damage only points of damage and identifies the next-round 1d6 as acid. Preserve the evidence without inferring an initial type.                                  |
| Betraying Sting         | Action says Will partial, but prose gives no successful-save consequence.                                                                                                                                                                |
| Legend Lore             | Action says standard-action casting; prose gives 1d4 times 10 minutes, 1d10 days or 2d6 weeks.                                                                                                                                           |
| Major Creation          | Structured effect still says nonliving plant matter, although prose adds mineral objects.                                                                                                                                                |

The importer reads `system.types` rather than pinned `system.descriptors`; **32 roots’ actual descriptors** are retained in evidence while extracted descriptors are empty. **Air Geyser’s action effect Note** contains its caster-level launch height but is outside the current Spell required-note collector; the full action payload and reviewed readable rule are preserved. Tail Strike’s deity-dependent divine class-list addition remains an outstanding eligibility integration, rather than an unconditional grant inferred from its expanded upstream lists. These importer gaps belong to #719/#720; no product code is changed.

## Public demonstration and checks

[Catalog tests](../../tests/catalog/spells-525.test.ts) replay raw hashes, exact output, all whole-content bindings, enforced inherited notices, real levels and numeric caps. Representative public-resolver cases preserve Mighty Strength (+8 enhancement Strength), Shock Shield (+2 shield AC), Unliving Rage (+2 profane Strength/Charisma), Sense Vitals (up to +5d6) and Owl’s Wisdom (+4 enhancement Wisdom) as recorded Spells without granting running effects. Changed Owl’s Wisdom source text invalidates its checked prose, and changed Bull’s Strength invalidates Mighty Strength’s transitive attribution binding.

[Saved-sheet integration](../../convex/catalogSpells525.integration.test.ts) browses and records Owl’s Wisdom and Sense Vitals at Wizard level 2 on isolated Convex test data through public readers/writers. Members share the saved results; outsider, unauthenticated, cross-campaign and other-Character catalog access is rejected. The client preview agrees with persisted current/permanent statistics and Spell collections. The holds remain enforced; this internal fixture installation establishes consumer behavior, not shipping permission. No legally admitted batch output exists to demonstrate.

The bounded gate has **78 holds and 22 selection-only broken references**. With complete source context **all 100 roots are held and none has a structural/reference failure**. The full corpus retains unrelated missing curation and reference failures, reported below without claiming release readiness.

Base preservation was checked by exact identity and value: **1,921 old overlay records, 2,134 assessments, 2,113 evidence identities, 927 notice holds, 340 Registry entries and 29 shared Situations** remain unchanged. Additions are 100 checked description records, 100 assessments, 100 evidence identities and 54 notice holds. Remaps are unchanged.

Commands use the two pinned read-only sources and the inherited `TMPDIR` under `~/repos/everythingpath/.ep-tmp/`, outside every checkout. No `.env*` or private E2E material was accessed. Scratch and candidate selections are removed at completion.

```sh
PF1_CURATION_SYSTEM="/home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1"
PF1_CURATION_CONTENT="/home/andreas/repos/everythingpath/sources/pf1-content"
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/curation-525/keys.json --out .scratch/curation-525/drafts
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/curation-525/keys.json --records .scratch/curation-525/drafts/records.json --descriptions --out .scratch/curation-525/prose
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/curation-525/keys.json --records scripts/catalog/reviewed-curation.json --descriptions --out .scratch/curation-525/checked
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-525/full-drafts
pnpm -s catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/curation-525/keys.json --out .scratch/curation-525/final-bounded
pnpm -s catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-525/final-full
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm catalog:notice-deps
pnpm -s catalog:format --check
CI=true pnpm test tests/catalog convex/catalogSpells525.integration.test.ts
```

Final checks ran sequentially with `CI=true`; the scoped test command contains only `tests/catalog` and this batch’s Convex integration, not the full suite.

| Check                                      | Result                                                                                                                                                                                                                                                    |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial exact draft                        | 1,921 existing records; 0 new required drafts, 0 missing, 0 unresolved required mechanics.                                                                                                                                                                |
| Separate description draft                 | 43 new optional drafts; all 100 descriptions subsequently checked independently.                                                                                                                                                                          |
| Checked description resume                 | Pass: 2,021 records, 0 new drafts, 0 replaced, 0 missing, 0 unresolved required mechanics. The 61 inventory integration gaps remain outstanding; 60 have optional prose diagnostics.                                                                      |
| Full-corpus curate                         | Pass: 5,604 records, 3,583 new drafts, 0 replaced, 0 missing; 758 unresolved mechanics across the corpus. Drafts stay outside reviewed artifacts.                                                                                                         |
| Final bounded preview                      | Expected nonzero: 100 entries, 0 resources; 0 admitted, 78 held, 22 selection-only broken-reference failures, 0 dependent omissions. Required curation passes.                                                                                            |
| Final full-source preview                  | Expected nonzero: 23,109 entries, 538 resources; 56 admitted, 23,198 held, 2 dependent omissions, 4,689 failure rows. All 100 batch roots are held, with 0 batch failure rows. Global required curation has 3,687 candidates: 104 checked, 3,583 missing. |
| Typecheck and lint                         | Pass, 13.45 seconds and 142.60 seconds respectively.                                                                                                                                                                                                      |
| Initial migration writers                  | Pass: 183 registrations.                                                                                                                                                                                                                                  |
| Calculation pin                            | Pass: `sha256:d7a42ca346d875f9497c7da94325022ac289d7931226a3649979a13f410c8063`.                                                                                                                                                                          |
| Notice dependencies                        | Pass: 3,580 recorded dependencies across 2,203 candidates in 25 inventories; 0 gaps, 0 waived, 0 stale. All 36 advisory warnings are outside this batch.                                                                                                  |
| Catalog formatting                         | Pass.                                                                                                                                                                                                                                                     |
| Catalog plus isolated Convex tests         | Pass: 1,684 tests in 72 files, 49.72 seconds. Includes 24 batch catalog tests and 1 saved-sheet integration test.                                                                                                                                         |
| Full-source/fixture and preservation audit | Pass: all 128 complete-context entries match fresh full-source CLI values; exact catalog hash retained in provenance. Earlier inherited-context fixture values and every prior shared artifact remain unchanged.                                          |

Approximate wall time: orientation and drafting 2 minutes; manual mechanics/attribution review and permitted comparison 10 minutes; artifacts and public demonstrations 6 minutes; verification, report and cleanup 25 minutes, including preparatory runs and corrections. Final bounded preview took 47.90 seconds, checked resume 31.42 seconds, full-corpus curate 213.29 seconds and scoped tests 50.20 seconds by the command wrapper.

Workflow problems: book-only comparison and complete notice chains remain unavailable, and the importer gaps described above remain assigned to #719/#720. Fixture construction needed an empty content directory and writable copied file modes for the source-change test; structured inherited-dependency fields and exact preservation of old rationale whitespace were corrected before the final checks. One preparatory preview overlapped lint; the final extraction and listed check sequence ran sequentially. No tool or product code was changed. Changes remain uncommitted; batch scratch was removed after validation.

## Review fix round 1 — Linebreaker

**Sol (AI curator) for the owner**, **2026-10-08**, checked both findings against the same pinned `packs/spells/linebreaker.amrtqcyc53je6wbt.yaml`, lines 27–30. Its full source text and description hash remain unchanged: “You gain a +20 foot bonus to your base speed when charging and a +2 bonus on combat maneuver checks made to bull rush or overrun.”

The readable Note, description rationale and inventory prose now use two separate sentences: “Gain +20 feet to base speed when charging. Gain +2 on combat maneuver checks made to bull rush or overrun.” The speed Note uses the existing shared `charging` key; the separate `bullRush` and `overrun` Notes are unchanged and have no charging restriction. The inventory records the checked clause scopes, and Linebreaker’s existing evidence identity records the correction.

The first operator preflight stopped with `Unreviewed shared Situation: charging`: the sheet already recognizes this key, but the curation overlay had no reviewed declaration for it. Added that declaration with the sheet’s existing label `when charging` and exact aliases `when charging` / `while charging`; all 29 previous declarations remain unchanged. No product or tool code changed.

The existing shared-Situations regression test now pins the exact source text and all four readable Notes, the reviewed shared declaration and inventory clause scopes. It also compares saved-sheet current/permanent statistics with and without a recorded Linebreaker while no Situation, charging, bull rush or overrun is selected. Recording the Spell grants no running Spell Effect Modifiers.

All **100 held / 0 admitted** dispositions, the **54 notice-chain holds**, Crown of Glory’s specific record-level `3.5` hold and **61 outstanding mechanics integrations** remain unchanged. Linebreaker’s running conditional speed and maneuver effects remain outstanding independently of attribution. Source identities, raw text/hashes, required notices, stable remaps and every other candidate’s reviewed records remain unchanged.

Rechecks use `CI=true` and the inherited external `TMPDIR`, sequentially. A fresh full-source preview is required to refresh the changed content binding and full-catalog fixture provenance; unchanged full-corpus curate and source comparison research are not repeated. The complete-context and bounded fixtures replay the corrected reviewed output through the public importer and admission gate.

The fresh extraction verifies **all 100 current full-source assessment bindings** and **all 128 complete-context fixture entries**. Only Linebreaker’s content/evidence fingerprints changed; its mapping and notice fingerprints are unchanged. The bounded replay still has **78 held and 22 selection-only reference failures**; complete source context still has **100 held, 0 admitted and 0 batch failures**. Updated full-source catalog SHA256: `93a7076a9e7a834359e5f96ea21d21b81f603f4007c024716ef6063547d0cba4`.

```sh
CI=true pnpm -s catalog:preview --system /home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1 --content /home/andreas/repos/everythingpath/sources/pf1-content --out .scratch/curation-525-fix/full-source
CI=true pnpm -s typecheck
CI=true pnpm -s lint
CI=true pnpm -s catalog:format --check
CI=true pnpm test tests/catalog/spells-525.test.ts tests/catalog/curation.test.ts tests/catalog/notice-holds.test.ts tests/catalog/notice-dependencies.test.ts convex/catalogSpells525.integration.test.ts
CI=true pnpm -s catalog:notice-deps
CI=true pnpm exec prettier --check tests/catalog/spells-525.test.ts docs/catalog-import/spells-525.md
```

| Recheck                                | Result                                                                                                                                                                                   | Measured command time |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| First preview preflight                | Failed before extraction: missing reviewed declaration for the existing `charging` key; corrected above.                                                                                 | 33.37 seconds         |
| Fresh full-source operator preview     | Expected exit 1: 23,109 entries, 538 resources; 56 admitted, 23,198 held, 2 dependent omissions, 4,689 corpus failure rows, unchanged from the initial batch. Zero batch failure rows.   | 190.29 seconds        |
| Full-source rebinding and replay audit | Pass: 100 exact bindings; 128 matching complete-context entries; unchanged bounded and complete-context admission counts.                                                                | 8.91 seconds          |
| Typecheck                              | Pass.                                                                                                                                                                                    | 12.77 seconds         |
| Lint                                   | Pass.                                                                                                                                                                                    | 129.51 seconds        |
| Catalog canonical formatting check     | Pass.                                                                                                                                                                                    | 0.52 seconds          |
| Focused tests                          | Pass: 121 tests in 5 files, including 24 batch catalog tests and 1 isolated saved-sheet integration test.                                                                                | 5.93 seconds          |
| Notice dependencies                    | Pass: 3,580 dependencies, 0 gaps, 0 waived, 0 stale; all 36 unchanged advisory warnings are outside this batch.                                                                          | 0.87 seconds          |
| Preservation/source-byte audit         | Pass: only Linebreaker’s reviewed content/evidence/bindings and the declaration changed; all prior identities, other candidates, holds, remaps, 177 raw files and 2 manifests preserved. | 0.15 seconds          |

Prettier passed for the changed test and report (0.54 seconds).

The rebinding write initially used schema-normalized assessment records, which trim trailing rationale whitespace. The preservation audit caught this; all unrelated records were restored from the raw baseline before the final tests and formatting check. No prior assessment’s value or whitespace changed.

Changed files: this report; `scripts/catalog/legal/spells-525.json`; `scripts/catalog/reviewed-curation.json`; `src/lib/catalog/data/attribution-assessments.json`; `src/lib/catalog/data/attribution-evidence.json`; `tests/catalog/spells-525.test.ts`; and `tests/fixtures/spells-525/{preview.json,binding-preview.json,provenance.json}`. No raw fixture, shared hold, Registry or product code changes. Scratch is removed after validation; changes remain uncommitted.

Time per phase: manual orientation/review and edits approximately 5 minutes; measured extraction/preflight/rebinding 232.57 seconds; typecheck/lint/focused tests/notice dependencies/catalog format/preservation checks 149.75 seconds; report and cleanup approximately 2 minutes. The aborted preflight and schema whitespace normalization are the only new workflow problems. No full suite, full-corpus curate, Git/GitHub writes, deployment, source writes, environment-file reads or private E2E reads were performed.
