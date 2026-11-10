# Feat curation review: #335

Reviewed 2026-10-07 by **Sol (AI curator) for the owner**, following [#335](https://github.com/AndreasUnunger/EverythingPath/issues/335), [PRD decision 17 and the acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251), and the attribution policies in [#224](https://github.com/AndreasUnunger/EverythingPath/issues/224), [#227](https://github.com/AndreasUnunger/EverythingPath/issues/227), and [#241](https://github.com/AndreasUnunger/EverythingPath/issues/241).

The exact 100-key batch has **one supported/admitted definition, Skill Focus (Stealth), and 99 specifically held definitions**. There are zero dependent omissions, wholly unsupported/prose-only definitions, or exclusions. Every key has one editorial disposition. All 100 descriptions and structured fields were reviewed. Legal admission does not establish complete calculation: every definition still has a named importer gap, including the unusable repeatability sentinel.

## Evidence and attribution boundary

The read-only inputs are Foundry PF1 v11.11, commit `418761d2e16a6037c0156bb4a241f7cea5a2986d`, and pf1-content 11.4.0, commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`. The [single batch inventory](../../scripts/catalog/legal/feats-335.json) retains all 100 exact keys in ticket order, source YAML paths and SHA-256 values, complete raw descriptions and description hashes, structured facts, prerequisite/proficiency mappings, outputs, comparisons, notice requirements, hold identities, and outstanding mechanics. The ordered-key hash is `e43d6e81b35591793a9b72ff71777e1953e39b5c2cd465b89c239cd7debca9c3`.

All 100 upstream structured source lists are empty and remain empty in imported output. Comparison leads are recorded as evidence and minimum notice requirements, without backfilling player-facing Sources. An unidentified publication remains unidentified. The [Attribution Assessments](../../src/lib/catalog/data/attribution-assessments.json) bind complete imported content closure, mapping, [evidence](../../src/lib/catalog/data/attribution-evidence.json), and notice identities. The bindings use the final full extraction, rather than reduced fixtures lacking dependencies.

The accepted comparison is [PCGen's Core Rulebook Skill Focus row](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_feats.lst#L156), pinned at commit `25523dbcf10e86c280fc0f447167ea43d67419d3`. Its file hash is `5ad62f0183b3005a452c93c4d954bcad97033f92dfb8276f214c1c321831db7f`; line hash is `f945b6aa9a1b96734ece2bddc20546fe4b0338ea01a2a8d9a7ff7cea592e6ffd`. The comparison covers the chosen-skill introduction, +3/+6 at ten ranks, and different-skill repeatability/nonstacking through PCGen's choice and stacking tags. The upstream Stealth specialization and sole structured rank formula express those same rules, with no linked content or additional rule text. Existing reviewed `CRB`/`PZO1110` notice coverage is reused. Automatic rank dispatch and per-choice behavior remain mechanics gaps.

Fifteen other PCGen rows provide explicitly limited leads: Nightmare Weaver, Extra Ranger Trap, Field Repair, Marid Style, Superior Summoning, Dimensional Savant, Bonebreaker, Fearless Zeal, Destructive Dispel, Greater Spell Specialization, Tripping Staff, Mantis Torment, Parting Shot, Point-Blank Master, and True Love. Their individual pinned URLs, exact row/file hashes, facts compared, and missing comparison boundary are in the inventory. For example, Field Repair's repair table is absent from its comparison row; several base feats omit appended Combat Trick material; the two story feats supply only prerequisite leads. None establishes complete non-CRB origin and notice coverage. No book PDFs are available, and Archives of Nethys was not used.

Minimum known notice requirements occur three times for `PZO1110`, three for `PZO1115`, four for `PZO1117`, seven for `PZO1118`, and three for `PZO1125`. Four batch-specific complete-chain holds are enforced in [held-notices.json](../../scripts/catalog/legal/held-notices.json): APG, Ultimate Magic, Ultimate Combat, and Ultimate Campaign. The APG hold includes its observed inherited Registry identity; this does not create a product-code alias or a complete publication chain. Whole-content holds are separately named for all 99 held entries, including entries whose source book remains unknown. No Registry text, legal resource, permanent notice, identity remap, or Item Ability policy changes.

## Dispositions

Each held row carries its individual `feats-335-whole-content-<upstream-id>` hold. The notice codes below are observed minima, not a complete origin bound; the inventory supplies the exact evidence boundary. Both final gates account for every batch key without a batch structure/reference failure. Prose-only submechanics do not change a held definition's whole-entry disposition.

| Exact key                      | Name                           | Disposition and evidence boundary                                                               |
| ------------------------------ | ------------------------------ | ----------------------------------------------------------------------------------------------- |
| `pf1-content/1taW8qvQsEjvvVSv` | Unyielding Ferocity            | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/1ut0m34yRD0wYrPs` | Betrayed                       | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/1vOg0H1SLsgiJS2M` | Scale and Skin                 | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/1wu9sw82NdZfzHq8` | Extra Spell Synthesis          | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/1xPJLkwc0brIc0g4` | Fearless Curiosity             | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/1z3IBzMSlLNR1TRk` | Burrowing Teeth                | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/1zkPYWfsc2a6xhJa` | Pummeling Bully                | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/20rB8UNFwhjTka52` | Totemic Master                 | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/2263HH5HObK9JlmM` | Nightmare Weaver               | Held: complete content/origin comparison missing; PZO1118 are observed notice minima.           |
| `pf1-content/234rWDonhnMVf5ow` | Restorative Vigor              | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/23UyGOjiEos2OWho` | Dastardly Trick                | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/23vl8taZ6srdVZQL` | Totemic Disciple               | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/24QBO4tzGvoUemic` | Extra Ranger Trap              | Held: complete content/origin comparison missing; PZO1117 are observed notice minima.           |
| `pf1-content/24jT9ovhFgVPRBeZ` | Traumatic Spell                | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/250VIQPVJ9G2qM8J` | Improved Planar Infusion       | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/28CQTNWzgU6fLLoM` | Kyton Style                    | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/28I0TotD5GpvRAtP` | Swap Trick                     | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/29TWbp4rLtmfemng` | Exotic Heritage                | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/2BcX5clofTXNBSUZ` | Fearsome Spell-Like Ability    | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/2Bqp14c8zjdjSMFm` | Steadfast Personality          | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/2F20dQAhkgBJdLO5` | Reward of the Faithful         | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/2GdfZL6LhVeILtTH` | Nature's Freedom               | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/2JWwVMFeqHnFDFSv` | Skill Focus (Stealth)          | Admitted: complete PCGen CRB comparison; reviewed PZO1110 notice.                               |
| `pf1-content/2JgVYyBhudInjqzb` | Heaven's Light                 | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/2KH98UIgLsp9fGAu` | Elemental Vigor                | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/2KyDMmkSaDR77Ror` | Field Repair                   | Held: complete content/origin comparison missing; PZO1118 are observed notice minima.           |
| `pf1-content/2LOIhnoKtPqV1L93` | Heroic Recovery (Mythic)       | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/2MSEpmMXV95Hz81R` | Gravitational Vital Strike     | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/2NY9sZeKDp8n0gn1` | Out of the Sun                 | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/2RDJzgd0EJkDhJqL` | Ancestral Scorn                | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/2Rjc6D2bqe6QoLQO` | Encouraging Spell              | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/2VUpEK8U0Wz7ikw8` | Ostentatious Display           | Held: complete content/origin comparison missing; PZO1110 are observed notice minima.           |
| `pf1-content/2XMEPZkXrRGiQANb` | Explosive Escape               | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/2aP933BsPM6f96mM` | Demonic Slaughter              | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/2bRZffT2lWhJ2e5x` | Sprinting Troll                | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/2dSl68EJ0QPE5Dk4` | Great Fortitude (Mythic)       | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/2i237njLgD5fbh3y` | Violent Display                | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/2kzi1zbm98Hx7nsF` | Uncertainty                    | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/2og5wHlKdftjSluF` | Marid Style                    | Held: complete content/origin comparison missing; PZO1118, PZO1115 are observed notice minima.  |
| `pf1-content/2sU7JkwlS0oewqGP` | Empath                         | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/2siAfpNL5DZqQj8E` | Totem Spirit                   | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/2tMqQvrsdrfr8huZ` | Inexplicable Luck              | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/2urneyOFhACbNJyp` | Shadow Ghost                   | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/2vJc4IXqGwOE7WKD` | Beast Rider                    | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/2weVX2HNOrOzmkc9` | Planewalker's Insight          | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/2yqVH59pHG16CmMc` | Improved Feinting Flurry       | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/2zKA3hDXVIyMTNGL` | Fiend Sight                    | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/31Hwk2VCrSixlRnR` | Tumbling Upset                 | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/31VNHRs8WTUIAcEU` | Mask Focus                     | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/32Rl7zWlmEfQCXAR` | Usurper's Guard                | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/36AfHIWrhXZeZwka` | Waking Dream                   | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/36eoBkVLLLyJ3df4` | Disruptive Spell-Like Ability  | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/36wejmDp39K3yEQC` | Throat Pouch                   | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/37fCVF069Hirbitk` | Mountaineer                    | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/37v7zK7HdxuVnkxO` | Superior Summoning             | Held: complete content/origin comparison missing; PZO1117 are observed notice minima.           |
| `pf1-content/3Ax0JmXpeTfqlQLL` | Falling Water Gambit           | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/3BdlHzs0UFMUUXrx` | Improved Conceal Spell         | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/3Bog3oUTuoeQndIO` | Dimensional Savant             | Held: complete content/origin comparison missing; PZO1118 are observed notice minima.           |
| `pf1-content/3Bz97S7E7IqOI4GI` | Bonebreaker                    | Held: complete content/origin comparison missing; PZO1118 are observed notice minima.           |
| `pf1-content/3DfggAhpA9YQnxAw` | Warren Digger                  | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/3F8LNQqBPQ5V960C` | Supernatural Tracker           | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/3FyjDvt86BYCzy9e` | Grabbing Drag                  | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/3GvsWfgUdjGxM8fb` | Fearless Zeal                  | Held: complete content/origin comparison missing; PZO1125 are observed notice minima.           |
| `pf1-content/3JnFPJS89QlvFUeK` | Indomitable Mountain Avalanche | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/3KlOjNhddsHAen3y` | Destructive Dispel             | Held: complete content/origin comparison missing; PZO1118 are observed notice minima.           |
| `pf1-content/3LG8DNCKk8hwFGh1` | Torch Handling                 | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/3MEcWcKr379wDClX` | Chairbreaker                   | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/3NAfD07cBh2y4EKV` | Charming Performance           | Held: complete content/origin comparison missing; PZO1125 are observed notice minima.           |
| `pf1-content/3NrFyRPL6AGifzqY` | Improved Counterspell (Mythic) | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/3OlLWhDAFSW7tWGP` | Smoking Boulder                | Held: complete content/origin comparison missing; PZO1110 are observed notice minima.           |
| `pf1-content/3P5PziFMivddezfs` | Spell Cartridges               | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/3Q7gWWPA2wWjV300` | Greater Spell Specialization   | Held: complete content/origin comparison missing; PZO1117 are observed notice minima.           |
| `pf1-content/3SHNFH4sS98Nmxsc` | Tripping Staff                 | Held: complete content/origin comparison missing; PZO1117 are observed notice minima.           |
| `pf1-content/3SQIzGCS4BfiVZss` | Horrific Gorging               | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/3TNlJJEr9LG4GrBi` | Oread Earth Glider             | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/3Tw2gRYuC909HYKu` | Nerve-Racking Negotiator       | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/3V9InqbwzH3O2j4x` | Kitsune Tricks                 | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/3XVWP7WBpbuVbUOk` | Bloody Vengeance               | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/3Xq4uOFWox1yrXL8` | Toxic Stench                   | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/3YUjz00cIW0jgeOF` | Street Style                   | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/3aR8e1GVTM2HRF0o` | Renown                         | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/3c2V6NvFXmCxdMKW` | Edge Runner                    | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/3clO9dR5TKOkg5SS` | Conceal Aura                   | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/3dSCzXT1dXYTyJar` | Mantis Torment                 | Held: complete content/origin comparison missing; PZO1118 are observed notice minima.           |
| `pf1-content/3eriqSRryCPoqrgI` | Maleficium                     | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/3gIQSiEisgt4ZW2u` | Focused Outsider Expertise     | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/3gqa2DSfEgwgmJrE` | Hand's Sight                   | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/3hYDtjwt9KEmq3c5` | Just Out of Reach              | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/3iOMU2lMdYtRnG6S` | Shatter Resolve                | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/3jOyHy00LpOvKz3O` | Parting Shot                   | Held: complete content/origin comparison missing; PZO1115 are observed notice minima.           |
| `pf1-content/3lqWzzKaj1lYQ6Gr` | Subjective Slam                | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/3m5UZXdFN8xC8oUb` | Scuttle                        | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/3mDfzFTlIGdxibjS` | Tatzlwyrm Grappler             | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/3nUets4UO3ElDNwj` | Mythic Companion               | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/3oyuOhVcwraqOu9p` | Point-Blank Master             | Held: complete content/origin comparison missing; PZO1115 are observed notice minima.           |
| `pf1-content/3pJ8HmgwCl6sTlDX` | Wayang Soothsayer              | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/3pM2rTTjcA6r1ycQ` | True Love                      | Held: complete content/origin comparison missing; PZO1125 are observed notice minima.           |
| `pf1-content/3pNKsPVOna09jptG` | Scribe Spell Equation          | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/3rgP85ULTlxqr48j` | Nature's Weapons               | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |
| `pf1-content/3sXWgtSieS07T7Tn` | Shielded Staff Style           | Held: complete content/origin comparison missing; publication/notice requirements unidentified. |

## Mechanics review

The [Curation Overlay](../../scripts/catalog/reviewed-curation.json) adds 100 checked, explicitly description-bound reviews for this batch: **51 numeric Modifiers across 18 definitions and 101 readable Notes**. The initial required-note draft added zero records; the separate prose draft added 67 descriptions. The remaining 33 descriptions were explicitly bound and checked using the landed #333 tooling. All original 420 records and 26 shared Situations are preserved; the three #334 follow-ups add three further records. Required curation can pass while optional mechanics remain unresolved: 34 of the batch description records retain unresolved diagnostics, and every inventory row has `completeCalculation: false`.

Numeric outputs preserve the ordinary rule identity and Source. Shared `mindAffecting` and `fear` Situations are reused where their meaning fits. Precise compound conditions, chosen tribes, one selected roll, and restricted target scopes remain local Situations. The overlay adds no shared Situation declarations.

| Definition            | Reviewed numeric outputs |
| --------------------- | ------------------------ |
| Scale and Skin        | 1                        |
| Fearless Curiosity    | 1                        |
| Steadfast Personality | 1                        |
| Skill Focus (Stealth) | 2                        |
| Out of the Sun        | 2                        |
| Ostentatious Display  | 4                        |
| Empath                | 1                        |
| Totem Spirit          | 12                       |
| Inexplicable Luck     | 6                        |
| Mountaineer           | 2                        |
| Fearless Zeal         | 3                        |
| Charming Performance  | 1                        |
| Edge Runner           | 2                        |
| Conceal Aura          | 1                        |
| Maleficium            | 3                        |
| Just Out of Reach     | 1                        |
| True Love             | 7                        |
| Shielded Staff Style  | 1                        |

The review preserves these important boundaries:

- Steadfast Personality replaces only a positive Wisdom contribution for mind-affecting Will saves. Its delta is `@ability.cha.mod - max(0, @ability.wis.mod)`, preserving negative Wisdom penalties and negative Charisma effects.
- Out of the Sun's +2 bright-light and +4 sunlight feint bonuses are alternatives. Their same-rule identity prevents adding both. Empath's -4 applies to fear **or** mind-affecting saves only during the minute following its use; a generic fear or mind-affecting Situation alone does not apply it.
- Totem Spirit's twelve numeric outputs each require the chosen tribe. It never grants every tribal benefit unconditionally; Tribe Selection, Wind tribe movement, and additional rage rounds remain outstanding.
- Inexplicable Luck's six outputs model one chosen attack/save/skill roll, +8 before or +4 after. Unsupported other d20 targets and its daily pool remain outstanding. Fearless Zeal models its single attack/save/skill roll at +2, increasing once to +4 at ten HD; its caster-level **check** bonus is retained as a gap because a caster-level Modifier would incorrectly change the level itself.
- Scale and Skin supplies the low-caster-level +1 increment to natural armor. The higher-tier source wording can read as +2 or as a further increase after +1; that numeric tier is withheld rather than choosing an unsupported interpretation. Shielded Staff Style supplies its scoped -1 attack penalty; replacing an equipped shield's bonus with exactly +2 remains outstanding, since merely adding +2 could retain a larger shield bonus.
- Falling Water Gambit and Chairbreaker critical-confirmation bonuses remain readable Notes. The [attacks contract](../character-sheet/attacks.md) does not support those calculated targets. Its scope likewise keeps the non-CRB dice, damage/property, reach, and DR behavior of Kyton Style, Gravitational Vital Strike, Marid Style, Spell Cartridges, Tripping Staff, Street Style, and Focused Outsider Expertise as prose.

The raw batch has no structured context notes, actions, action conditionals, weapon/armor proficiencies, or Item Ability records. Inspection of descriptions still found promised calculations requiring unavailable choice/Grant, proficiency, class-skill, pool, or target support. These remain individual mechanics gaps in the inventory; empty upstream arrays are not proof that those effects are complete. Only Skill Focus has a raw structured change, whose unsupported rank expression is accounted for separately. Spell-like abilities, mythic/stamina material, target adjudication, narrative permissions, and play-time actions retain readable Notes according to the consuming contracts. Class schedules, Base Items, and companion-version validation are not applicable to this feat batch.

All 100 prerequisite outputs were independently inspected. Eight exact defects are recorded in the inventory and corresponding content-bound evidence, and [the batch tests](../../tests/catalog/feats-335.test.ts) pin their existing output and named gaps:

| Definition               | Outstanding prerequisite mapping                                                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nature's Weapons         | Knowledge (nature) or Survival 2 ranks becomes a Knowledge Class Feature alternative, losing the skill identity/rank threshold.                             |
| Conceal Aura             | Alignment alternatives partly become Evil/Good Class Feature requirements and unchecked fragments.                                                          |
| Improved Planar Infusion | Resolves the same-name oracle revelation instead of the conduit feat.                                                                                       |
| Unyielding Ferocity      | Requires a particular psychic Ferocity Class Feature instead of generic monster ferocity. That feature can grant ferocity, but is only one possible source. |
| Pummeling Bully          | BAB 9 or brawler/monk 5 becomes mandatory BAB 9 plus unchecked text.                                                                                        |
| Grabbing Drag            | BAB 8 or brawler/monk 4 becomes mandatory BAB 8 plus unchecked text.                                                                                        |
| Totemic Disciple         | An exclusion becomes an alternative to the already-required Totemic Initiate, bypassing the exclusion.                                                      |
| Totemic Master           | The exclusion's exception list becomes fragments and a duplicate feat requirement.                                                                          |

Other uncheckable deity, alignment, casting, story/background, and similar prose clauses remain unchecked facts. No guessed qualification is emitted. Every imported feat also retains `repeatable: "unreviewed"`; usable repeatability and per-choice facts remain outstanding. These are importer work for [#719](https://github.com/AndreasUnunger/EverythingPath/issues/719) and [#720](https://github.com/AndreasUnunger/EverythingPath/issues/720), independent of attribution. No importer or product implementation was changed.

## #334 follow-up

The landed explicit-description tooling now binds and applies all three previously outstanding records. [The #334 inventory](../../scripts/catalog/legal/feats-334.json), overlay, assessment/evidence bindings, [fixture](../../tests/fixtures/feats-334/preview.json), and [tests](../../tests/catalog/feats-334.test.ts) are updated together:

| Definition          | Checked result                                                                                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Wary Smuggler       | +5 Sleight of Hand narrowly for concealing small nonweapon objects on one's body or one traveling animal/vehicle.                                                                                                  |
| Oath of the Unbound | +2 CMB to escape grapple/pin and +2 saves against entangling/slowing effects. Its Strength check bonus remains readable and outstanding because that check target is unavailable.                                  |
| Desert Dweller      | +4 saves against glare blindness/dazzling or desert mirage, within the source's restricted scope. Its Constitution/other-check bonus remains readable and outstanding because those check targets are unavailable. |

These add four Modifiers and four Notes across three checked reviews. #334 now has 70 checked description records. Its attribution holds remain enforced. Supplemental evidence binds each corrected output to the existing pinned source; all three assessment bindings were refreshed. The earlier #334 report describes its historical pre-tooling result; this follow-up records the new state.

## Demonstration and gates

[Fixtures](../../tests/fixtures/feats-335/README.md) include all 100 byte-exact raw YAML records, hashes, provenance, and the complete-checkout normalized batch output. Reduced fixture imports reproduce the numeric/Note/Sources output; complete-checkout prerequisite/link mappings remain preserved in the committed preview rather than invented in reduced fixtures. Independent verification matched every fixture entry to the final full extraction, all source/description hashes, and all 103 current assessment bindings.

Public resolver tests pin Steadfast Personality with positive and negative Wisdom/Charisma, Out of the Sun at +2/+4 without +6 overlap, Edge Runner's exact saves/Climb scope, Just Out of Reach's dodge AC, Skill Focus's +3/+6 and nonstacking copies, and Empath's restricted single -4.

The [isolated saved-sheet test](../../convex/feats335.integration.test.ts) materializes admitted Skill Focus and held Steadfast Personality only in convex-test's empty, Character-scoped catalog. Existing public create/edit/select/deactivate writers, saved-sheet reads, and catalog reads are exercised. Another organization member edits and sees the same data; unauthenticated reads, outsider reads/edits, and wrong-campaign reads/edits are refused. Nothing is globally published and no remote backend is contacted. The adapter omits only the unusable repeatability sentinel; it does not invent a reviewed value or lift a hold.

With Wisdom 14 and Charisma 18, saved ordinary Will is +2 and public mind-affecting preview is +4; deactivation returns the conditional preview to +2. Skill Focus's saved and ordinary preview agree, while explicitly selecting its local rank Situations produces +3 or +6; deactivation removes both. The unsupported rank formula does **not** automatically dispatch either threshold in the ordinary saved projection. This demonstrates an admitted rule body and usable conditional outputs, while documenting the incomplete calculation and selection facts.

The following commands reproduce the final review and gates. Scratch output is intentionally local and ignored. All final commands set worktree-local `TMPDIR`, including the CommonJS package marker required for extensionless CLI test executables. Initial draft/pin/writer commands did not explicitly set `TMPDIR`; no explicit `/tmp` scratch operation was performed, but their tool-managed temporary/cache behavior was not verified. No environment file or private E2E material was accessed.

```sh
mkdir -p .scratch/curation-335/tmp
export TMPDIR="$PWD/.scratch/curation-335/tmp"
printf '{"type":"commonjs"}\n' > "$TMPDIR/package.json"
PF1_CURATION_SYSTEM=/home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1
PF1_CURATION_CONTENT=/home/andreas/repos/everythingpath/sources/pf1-content
node --input-type=module <<'JS'
import fs from 'node:fs';
const review = JSON.parse(fs.readFileSync('scripts/catalog/legal/feats-335.json', 'utf8'));
fs.writeFileSync('.scratch/curation-335/candidates.json',
  JSON.stringify(review.candidates.map(({ externalKey }) => externalKey), null, 2) + '\n');
JS
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/curation-335/candidates.json --records scripts/catalog/reviewed-curation.json --descriptions --out .scratch/curation-335/checked
pnpm -s catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/curation-335/candidates.json --out .scratch/curation-335/bounded-preview
pnpm -s catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-335/full-preview
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm test tests/catalog --maxWorkers=1
pnpm test convex/feats335.integration.test.ts --maxWorkers=1
pnpm -s catalog:format --check
git diff --check
```

| Check                                                          | Observed result                                                                                                                                                                           |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source verification                                            | Both pinned commits/manifests verified; no checkout override                                                                                                                              |
| Initial required-note draft / separate prose draft             | Both exit 0; zero note drafts, then 67 description drafts                                                                                                                                 |
| Final checked-description resume                               | Exit 0: all 523 overlay records retained, 100 batch descriptions checked, zero added/replaced/missing/stale required records; 34 optional unresolved descriptions remain                  |
| Final bounded import/admission                                 | Exit 0: 100 entries, zero resources; one admitted, 99 held, zero dependent omissions/retained exceptions/failures; complete selected-key inventory coverage                               |
| Final full import/admission                                    | Exit 1: 23,037 entries, 538 resources; 53 admitted, 23,129 held, two dependent omissions, zero retained exceptions, 4,734 out-of-batch failures; batch one admitted/99 held/zero failures |
| `pnpm -s typecheck`                                            | Pass                                                                                                                                                                                      |
| `pnpm -s lint`                                                 | Pass                                                                                                                                                                                      |
| `pnpm -s check:initial-migration-writers`                      | Pass: 183 registrations                                                                                                                                                                   |
| `pnpm catalog:pin`                                             | Pass: `sha256:71c66667344e200747085cc47660277a9e7677da10cdd3d58033591444baa25b`                                                                                                           |
| `pnpm test tests/catalog --maxWorkers=1`                       | Pass: 32 files, 487 tests, 56.56 seconds; includes 12 batch and 13 #334 tests                                                                                                             |
| `pnpm test convex/feats335.integration.test.ts --maxWorkers=1` | Pass: one saved-sheet/catalog-preview test, 1.67 seconds                                                                                                                                  |
| `pnpm -s catalog:format --check`                               | Pass after sorting assessment array into canonical order; zero semantic changes                                                                                                           |
| Focused changed-file Prettier / `git diff --check`             | Pass                                                                                                                                                                                      |
| Full application suite                                         | Reserved for the orchestrator after rebase, per brief                                                                                                                                     |

Full-corpus failures are 3,628 missing required curation records, 715 unaccounted inventory records, and 391 structure/reference failures, all outside this batch. The full import's required curation remains 100 checked of 3,728; description curation is 423 checked of 10,176. Full inventory counts are 27,592 upstream records, 23,575 extracted/accounted definitions, 3,302 exclusions, and 715 unassigned records, with incomplete full coverage. The final bounded inventory has 100 accounted definitions, zero exclusions/unassigned records, and complete coverage only for the selected batch. Both final gates have zero outstanding admitted notices/resources; they preserve all named holds.

The complete extraction was independently reconstructed from CLI reports, matched its extraction fingerprint, and passed all 103 current binding checks. A full preview started before the last evidence wording correction; reassessing its unchanged extraction with final inputs preserved its counts. Canonical sorting then changed the reviewed-input fingerprint because assessment array order participates in hashing, without changing any assessment value. The final bounded command and final full command use the same canonical inputs. The final full CLI report is byte-identical to the independently reassessed canonical report. Full extraction fingerprint: `806fa76e57167e8f34ee9d96cf3088f9e1449b79add3a8b3c6f58574f80dbe15`. Bounded extraction fingerprint: `6ba46607295f3d5281903438f408c873336f2ca98301f3ca8f00c3047516ded6`. Shared final reviewed-input fingerprint: `6f43fc01cdb4a093ba6d7b2fc29d5428d7a0ef30bb6fb578bdba2c013e37269c`. Legal-resource fingerprint: `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e`. Bounded admission-report SHA-256: `0505cb3ffaa46f71c69536aaaf09f88c6e23ed8eb29d4f5e06b3c8897895629a`; full admission-report SHA-256: `1c03a3d3895defb6f1f46089586ea33b952ffcad346d1295d2740f852a031a00`.

## Timing and workflow observations

Approximate phase windows on 2026-10-07 (UTC; delegated work overlaps):

| Phase                                                         | Window      | Elapsed          |
| ------------------------------------------------------------- | ----------- | ---------------- |
| Brief, policy, source and contract review                     | 19:40–19:48 | About 8 minutes  |
| Drafting, mechanics, attribution, fixtures and #334 follow-up | 19:46–20:10 | About 24 minutes |
| Independent source/numeric/prerequisite and binding review    | 19:56–20:21 | About 25 minutes |
| Gates, checks, report and cleanup                             | 19:50–20:28 | About 38 minutes |

Overall elapsed time was about 48 minutes. These overlapping windows must not be added.

Independent review covered all 18 numeric-producing entries, then every prerequisite output and every source hash. It withheld the ambiguous higher Scale and Skin tier, removed unsupported critical-confirmation calculations, narrowed compound Situations, and named eight prerequisite defects. Those corrections and their evidence bindings were completed before the final gates.

The first typecheck caught incomplete fixture/test scaffolding; the first combined focused run caught missing reduced-system packs and an incorrect AC target lookup. Delegated corrections resolved those failures. Required curation has no batch note candidates, so its green result cannot stand in for the 100-description review or the 34 optional unresolved diagnostics. Small bounded outputs still inspect the complete inputs; complete closure is essential for attribution bindings. Heavy verification was run sequentially on the shared host; the full application suite is reserved for the orchestrator after rebase.

The repository's requested Opus/Fable model aliases were unavailable, so subagents used the available inherited model, with the pilot's required curator identity recorded. Existing assessments/evidence outside the named #334 corrections are preserved; reviewed remaps, shared Situations, importer code, application code, schema, and backend functions are unchanged. Changes remain uncommitted. Nothing was pushed, published, deployed, or changed in GitHub. Scratch outputs were removed after recording results, and no answer file was created in the repository; the launcher captures the final response at its `-o` path.
