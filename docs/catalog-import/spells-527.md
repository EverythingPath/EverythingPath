# Spell curation review: #527

**Sol (AI curator) for the owner**, reviewed **2026-10-09**, following [#527](https://github.com/AndreasUnunger/EverythingPath/issues/527), [PRD #251 Decisions 9, 10 and 17 and acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461), [Spellcasting](../character-sheet/spellcasting.md), [curation](curation.md) and [#328 precedent](races-328.md).

**Exactly 100 ticket keys: 100 Spells specifically held; 0 admitted, dependent omissions, wholly unsupported/prose-only definitions or exclusions.** No folders and no record-level `3.5` tags. No product implementation, release activation, deployment, git/GitHub write or #413 work.

## Evidence and scope

- Read-only pinned Foundry PF1 v11.11 `418761d2e16a6037c0156bb4a241f7cea5a2986d` and pf1-content 11.4.0 `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`. Source-path CLI verification checks both complete manifests and checkout fingerprints.
- [Inventory, evidence and mechanics review](../../scripts/catalog/legal/spells-527.json) contains every key, raw byte hash/source location, full description, all action/material/component/class/granted metadata, observed inherited-book dependencies, mapped Spell detail and independent remaining mechanics.
- [Provenance and inert fixtures](../../tests/fixtures/spells-527/README.md) retain 100 roots, 22 recursively linked Spells, 49 class lookups and 32 additional named-rule context Spells. Context adds no reviewed or admitted candidates. [Bounded preview](../../tests/fixtures/spells-527/preview.json) has 100 entries; [complete-context snapshot](../../tests/fixtures/spells-527/binding-preview.json) has 122 entries and reproduces full-source root closures.
- [Curation Overlay](../../scripts/catalog/reviewed-curation.json), [assessments](../../src/lib/catalog/data/attribution-assessments.json), [evidence](../../src/lib/catalog/data/attribution-evidence.json) and [enforced holds](../../scripts/catalog/legal/held-notices.json) add this batch only. Section 15 Registry text/provenance/aliases remain unchanged. Existing content and notice holds, including #333–#336 and #516–#519 audit prerequisites, are preserved.

Permitted comparison uses fixed-commit [PCGen](https://github.com/PCGen/pcgen/tree/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game) core, Bestiary and APG data. Complete comparator bytes, source URLs and hashes are retained in provenance, with complete base/DisplayFullSpell rows and inherited rule identity rows in inventory. **22 directly cited CRB descriptions compared; 20 match** after HTML/UUID-label, punctuation, case and whitespace normalization. Gust of Wind contains PCGen broken multiplication glyphs and doubled percent presentation; Changestaff omits the Bestiary parenthesis in PCGen. No correction is invented. Equality does not bound expanded class lists, granted lists, editor actions, unknown inherited origins or complete notice chains. Paizo Inc. and Paizo Publishing, LLC are not aliased. No Archives of Nethys or book PDFs used.

## Attribution and inherited notices

**100 unresolved, individually content-bound Attribution Assessments** record `spells-527-whole-content-<ID>` holds. Dirge also names `spells-527-dirge-truncated-description`: its pinned description ends in isolated “I”; its action independently records a 120-foot line, 10 feet wide, Reflex half. The missing continuation is neither guessed nor presented as complete.

**44 distinct observed notice minima**, including the existing CRB identity, have **43 new enforced complete-chain holds**. Every notice requirement has exact Registry identity/provenance evidence when present; absent identity remains a code-specific hold, never invented notice text. The `PZO90119` bibliography repeats conflicting Ironfang Invasion #4 and #5 titles; both fixed raw-line leads are recorded without choosing an alias or publication identity. Existing trimmed notice keys and raw-line hash provenance remain intact.

**100 distinct per-candidate inherited-book dependencies** are structured in `inheritedRuleNotices`, with hashed root/context quotes in `inheritedNoticeReview`. The final audit covers all roots and linked descriptions, including explicit CRB conditions, named Spells/skills/class traits, bleed, ability drain, temporary hit points and DR. Literal terms and generic numerical metadata alone do not establish a book origin. These are minima; unknown origins remain held.

| Spell                   | Observed inherited notices/rules                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| Earsend                 | PZO1117: Skinsend                                                                             |
| Shared Suffering        | PZO1110 Shield Other; PZO1115 Unwilling Shield                                                |
| Shadow Invasion         | PZO1110 Darkness/Shadow Evocation/Summon Monster V; PZO1112 kyton; PZO1120 interlocutor       |
| Changestaff             | PZO1112 treant                                                                                |
| Polymorph               | PZO1110 linked form spells; PZO1112 inherited universal monster abilities                     |
| Invigorate, Mass        | PZO1115 Invigorate; PZO1110 inherited fatigue/exhaustion                                      |
| Summon Greater Demon    | PZO1110 Summon Monster I; PZO1112 inherited templates; PZO1116 Bestiary 2; PZO1120 Bestiary 3 |
| Telepathic Censure      | PZO1110 named telepathy Spells/item; PZO1112 explicitly exempted Neothelid Psychic Crush      |
| Vile Dog Transformation | PZO1110 summoning command rules; PZO1112 hell hound; PZO1123 dog costs                        |
| Crime Wave              | PZO1110 aid another/AoO/Sleight of Hand; PZO1115 steal maneuver                               |

## Every-key disposition

Every entry is specifically held for its recorded whole-content and applicable minimum notice-chain gap. Outstanding mechanics and bounded missing references are separate findings, not additional dispositions.

| Exact key              | Name                            | Direct source/page metadata                     | Disposition       |
| ---------------------- | ------------------------------- | ----------------------------------------------- | ----------------- |
| `pf1/censwfv32s58bb3r` | Boneshaker                      | PZO1135, p. 110                                 | Specifically held |
| `pf1/cfgfqhw0gt52f1tm` | Earsend                         | PZO9468, p. 25                                  | Specifically held |
| `pf1/cfh0wper7uo3kit3` | Shared Suffering                | PZO9450, p. 25                                  | Specifically held |
| `pf1/cfjaikd0qzlefjyr` | Sebaceous Twin                  | PZO90119, p. 70                                 | Specifically held |
| `pf1/cfzk3vkv1c7ncaug` | Magic Fang                      | PZO1110, p. 308                                 | Specifically held |
| `pf1/cfztz4xbdlo5yqjd` | Fiendish Wrath                  | PZO9492, p. 13                                  | Specifically held |
| `pf1/ch6iof333ghti2tj` | Negate Aroma                    | PZO1115, p. 234                                 | Specifically held |
| `pf1/choriern682hgptb` | Summon Nature's Ally IV         | PZO1110, p. 354                                 | Specifically held |
| `pf1/ci6r8zasm4exo85c` | Thundering Drums                | PZO1115, p. 249                                 | Specifically held |
| `pf1/ciief8f72f6fgpol` | Aura of Distraction             | PZO9477, p. 10                                  | Specifically held |
| `pf1/cjdhah1epnn4i6ft` | Flash Fire                      | PZO1118, p. 230                                 | Specifically held |
| `pf1/cl4hqv2rghoj7xm6` | Black Sword of War              | PZO9071, p. 75                                  | Specifically held |
| `pf1/cl8la3rhhfb0imdo` | Shadow Invasion                 | PZO1141, p. 44                                  | Specifically held |
| `pf1/clo5w5mow21nln10` | Ectoplasmic Snare               | PZO1132, p. 168                                 | Specifically held |
| `pf1/cm3l4h4mld9j8lar` | Delayed Blast Fireball          | PZO1110, p. 265                                 | Specifically held |
| `pf1/cmwcavfyc1vbehy8` | Shadow Step                     | PZO1117, p. 237                                 | Specifically held |
| `pf1/cnfj79kxb1hz6kj9` | Scripted Hallucination          | PZO1134, p. 224                                 | Specifically held |
| `pf1/cnn3hvm9e4bub6pr` | Discharge                       | PZO9272, p. 9                                   | Specifically held |
| `pf1/cnuin981hdq7ryit` | Gust of Wind                    | PZO1110, p. 293                                 | Specifically held |
| `pf1/cnwdet4f6enyb1kd` | Symbol of Scrying               | PZO1117, p. 241                                 | Specifically held |
| `pf1/co0mc49xhtf7aczt` | Invigorate, Mass                | PZO1115, p. 230                                 | Specifically held |
| `pf1/co28xtj01acamq9z` | Firefall                        | PZO1115, p. 222                                 | Specifically held |
| `pf1/cp5m19me647dojha` | Changestaff                     | PZO1110, p. 253                                 | Specifically held |
| `pf1/cpo4znwkrphw8ddp` | Shadow Anchor                   | PZO1121, p. 211                                 | Specifically held |
| `pf1/cppzcx64lvsjnllj` | Mantle of Doubt                 | PZO9461, p. 30                                  | Specifically held |
| `pf1/cqhabnit3b7l5ezm` | Arcane Lock                     | PZO1110, p. 243                                 | Specifically held |
| `pf1/cqjtlth3uqafuwnn` | Control Construct               | PZO1117, p. 211                                 | Specifically held |
| `pf1/crq6etku9g9o2imx` | Devolution                      | PZO1115, p. 216                                 | Specifically held |
| `pf1/csciqjii3onevfwz` | Puzzle Box                      | PZO9283, p. 41                                  | Specifically held |
| `pf1/ct9fhh8uawn8e4md` | Speak with Animals              | PZO1110, p. 346                                 | Specifically held |
| `pf1/cvip9ij3ejw6rh7t` | Dirge of the Victorious Knights | PZO1138, p. 98; PZO9226, p. 294; PZO9407, p. 22 | Specifically held |
| `pf1/cvv6oimqks9n62vy` | Magic Weapon                    | PZO1110, p. 310                                 | Specifically held |
| `pf1/cvym88lup9fa8sl5` | Veil of Heaven                  | PZO1121, p. 89                                  | Specifically held |
| `pf1/cx711jp7ufpt5n77` | Blaze of Glory                  | PZO1115, p. 205                                 | Specifically held |
| `pf1/cxgi0ub77t6aink1` | Invisibility, Greater           | PZO1110, p. 302                                 | Specifically held |
| `pf1/cxp0vodhvuwnfmye` | Litany of Madness               | PZO1118, p. 234                                 | Specifically held |
| `pf1/cycpenrz8xtjd0p1` | Bereave                         | PZO9296, p. 13                                  | Specifically held |
| `pf1/cyzbticmitktat5v` | Bless Water                     | PZO1110, p. 249                                 | Specifically held |
| `pf1/czaf6weu37d7ptl0` | Transfiguring Touch             | PZO9292, p. 63                                  | Specifically held |
| `pf1/czhrq71sajl6znhq` | Death Pact                      | PZO9461, p. 13                                  | Specifically held |
| `pf1/czos99r7p78h74k5` | Human Potential                 | PZO9465, p. 9                                   | Specifically held |
| `pf1/czpo53hv7fwoqd24` | What Grows Within               | PZO90113, p. 66                                 | Specifically held |
| `pf1/d0d86z521shpman1` | Sending                         | PZO1110, p. 339                                 | Specifically held |
| `pf1/d0rd4z2kcln69xif` | Lead Blades                     | PZO1115, p. 230                                 | Specifically held |
| `pf1/d1hd50iw75u1my72` | Treacherous Teleport            | PZO1134, p. 227                                 | Specifically held |
| `pf1/d1wxnax51cecplm4` | Augury                          | PZO1110, p. 245                                 | Specifically held |
| `pf1/d3a93wcwatqhywqy` | Fire Snake                      | PZO1115, p. 222                                 | Specifically held |
| `pf1/d3mtqenonzsc8qzp` | Siege Scatter                   | PZO9280, p. 223                                 | Specifically held |
| `pf1/d3wbaz4ibw8cramt` | Detect Relations                | PZO9433, p. 28                                  | Specifically held |
| `pf1/d40ia71c2eljm91k` | Polymorph                       | PZO1110, p. 323                                 | Specifically held |
| `pf1/d41l3wsdq6ch53ul` | Verminous Transformation        | PZO1135, p. 130                                 | Specifically held |
| `pf1/d4mp0m5xfnu9hbhn` | Mad Hallucination               | PZO1117, p. 227                                 | Specifically held |
| `pf1/d4oubr5bdoo8w1ev` | Eagle's Splendor                | PZO1110, p. 275                                 | Specifically held |
| `pf1/d52bcya77s9kcoes` | Summon Giant Ally I             | PZO9280, p. 223                                 | Specifically held |
| `pf1/d5lo6ttj0m6folux` | Peacebond, Greater              | PZO1134, p. 221                                 | Specifically held |
| `pf1/d6bgw4rsncq58bas` | Animal Purpose Training         | PZO1129, p. 173                                 | Specifically held |
| `pf1/d6e08tsx2ptxx0xo` | Vengeful Stinger                | PZO9267, p. 245                                 | Specifically held |
| `pf1/d6ggtogvbkrz1pjz` | Fairy Ring Retreat              | PZO1129, p. 181                                 | Specifically held |
| `pf1/d6kyeq5prkpj6540` | Martial Telekinesis             | PZO9280, p. 221                                 | Specifically held |
| `pf1/d6lfhyonb3ewpjt4` | Secret Chest                    | PZO1110, p. 338                                 | Specifically held |
| `pf1/d75efwlvj5ch1ob8` | Blood Ties                      | PZO1135, p. 110                                 | Specifically held |
| `pf1/d7hw4hxxe8mtzwgf` | Allied Cloak                    | PZO9481, p. 21                                  | Specifically held |
| `pf1/d7pa11ex8f58n8xb` | Soulswitch                      | PZO9454, p. 23                                  | Specifically held |
| `pf1/d8hypv6zdyan3rzr` | Hold Monster                    | PZO1110, p. 296                                 | Specifically held |
| `pf1/d8ok0wwf6twlqiho` | Venomous Bolt                   | PZO1115, p. 254                                 | Specifically held |
| `pf1/d8sdqmvvaulaaxu2` | Telepathic Censure              | PZO9437, p. 27                                  | Specifically held |
| `pf1/d8yy4njnr25hacek` | Glide                           | PZO1115, p. 225                                 | Specifically held |
| `pf1/dCg1ecr5Ofguqq5x` | Leshy Swarm                     | PZO1140, p. 25                                  | Specifically held |
| `pf1/dcc9m28ryxw1aezl` | Half-Blood Extraction           | PZO1121, p. 59                                  | Specifically held |
| `pf1/dckgxyd6ariois1s` | Primal Scream                   | PZO1117, p. 232                                 | Specifically held |
| `pf1/dd8afygrpxpothn7` | Beacon of Luck                  | PZO9267, p. 229                                 | Specifically held |
| `pf1/ddog9k83dnfoz77d` | Siege of Trees                  | PZO1118, p. 244                                 | Specifically held |
| `pf1/de70vxasn2oh930l` | Summon Greater Demon            | PZO9074, p. 75                                  | Specifically held |
| `pf1/df1xj7itjzu1hcyc` | Tireless Pursuit                | PZO1115, p. 249                                 | Specifically held |
| `pf1/dg3mrasygkm83c3e` | Slay Living                     | PZO1110, p. 344                                 | Specifically held |
| `pf1/dgzukaz1zeadr8q2` | Escaping Ward                   | PZO1121, p. 68                                  | Specifically held |
| `pf1/dhh45nl8h2p9q5es` | Hymn of Mercy                   | PZO9431, p. 29                                  | Specifically held |
| `pf1/dhjhfv5hzthy0fgu` | Inflict Light Wounds, Mass      | PZO1110, p. 300                                 | Specifically held |
| `pf1/dhwyv9dkrfk3dvia` | Heavy Water                     | PZO9440, p. 8                                   | Specifically held |
| `pf1/dijesfaw4xmw0jqa` | Poisonous Balm                  | PZO1134, p. 222                                 | Specifically held |
| `pf1/dimv86oryvi030uv` | Genius Avaricious               | PZO9030, p. 69                                  | Specifically held |
| `pf1/dirqq4kmbkt9gc1m` | Coward's Cowl                   | PZO9464, p. 30                                  | Specifically held |
| `pf1/djv6d485oznk72f1` | Fire of Entanglement            | PZO1115, p. 221                                 | Specifically held |
| `pf1/dk2hp8etdpn5jttd` | Summon Giant Ally III           | PZO9280, p. 223                                 | Specifically held |
| `pf1/dkg7ixwrhp7zx1ui` | Apathy                          | PZO9292, p. 58                                  | Specifically held |
| `pf1/dkm0qvaw0iv3y44q` | Escape Alarm                    | PZO1136, p. 45                                  | Specifically held |
| `pf1/dkv9v4verb82fmpx` | Meld into Stone                 | PZO1110, p. 312                                 | Specifically held |
| `pf1/dlmeq0hpxfbjtibb` | Mind Fog                        | PZO1110, p. 313                                 | Specifically held |
| `pf1/dlo03ajt55yofj4q` | Soul Bind                       | PZO1110, p. 345                                 | Specifically held |
| `pf1/dm52jk1e37b05v9d` | Righteous Vigor                 | PZO1115, p. 239                                 | Specifically held |
| `pf1/dm52olxxvdi01tfy` | Hydrophobia                     | PZO9440, p. 8                                   | Specifically held |
| `pf1/dm53hbl8lin781e2` | Snapdragon Fireworks            | PZO1117, p. 239                                 | Specifically held |
| `pf1/dm579aw5x8e3tcwf` | Detect Fiendish Presence        | PZO9464, p. 16                                  | Specifically held |
| `pf1/dnet1tyxbsnwailm` | Searing Light                   | PZO1110, p. 338                                 | Specifically held |
| `pf1/dnls28prt57tt5t6` | Monstrous Extremities           | PZO9267, p. 237; PZO9420, p. 28                 | Specifically held |
| `pf1/do6e31hgstlpbx8x` | Vile Dog Transformation         | PZO1135, p. 130                                 | Specifically held |
| `pf1/dol5wzpsk7m6gxsc` | Fumbletongue                    | PZO1117, p. 221                                 | Specifically held |
| `pf1/dpdfv4rvj5quxo7e` | Wave Shield                     | PZO1129, p. 199                                 | Specifically held |
| `pf1/dpmoeh4lh1iujpyr` | Crime Wave                      | PZO1134, p. 208                                 | Specifically held |
| `pf1/dq65gtj0phmasj87` | Divine Transfer                 | PZO1115, p. 216                                 | Specifically held |

## Mechanics and prose review

**All 100 complete descriptions and all action payloads reviewed.** Initial required draft adds 0 records; the separate phrase-triggered prose pass drafts 40. Independent review supplies 100 checked description bindings, including the 60 not drafted. Collector requires 0 Spell note/action-conditional/Item Ability records, and recorded Spells grant 0 ordinary Modifiers. This does not certify the running mechanics.

**64 entries have outstanding running mechanics**, retained in inventory; 59 also have optional description diagnostics. Five earlier context entries retain only inventory findings to preserve existing content closures. These include ability/save/skill/AC/concentration bonuses and penalties, conditions, item-target enhancement/damage-size changes, natural attack inputs, proficiency suppression, linked form/race/creature inputs, damage reduction/resistance and hit-chain effects. Dirge lacks complete source mechanics. None is turned into an attribution hold. Direct damage/healing, action use, duration/resources, rerolls and encounter procedures remain manual under the consuming contract.

Six explicit disagreements are retained: Earsend close range versus touched target; Thundering Drums untyped action damage versus sonic prose; Shadow Invasion centered action versus stationary area; incomplete Dirge versus action facts; Allied Cloak action formula versus attack/skill total in prose; Snapdragon Fireworks Reflex-negates action versus damage-half/dazzled-negated text. No importer change is made; gaps remain with #719/#720.

Raw descriptors are audited separately: 48 roots carry `system.descriptors`, while the importer reads `system.types` and exports empty descriptor lists. Exact raw descriptors/class levels/source facts remain evidence. Summon Giant Ally I links to **Summon Nature’s Ally VI** in the pin; Summon Giant Ally III inherits that chain. The pin is preserved without claiming a printed-book correction. All class/granted lists and absent raw `level` fields remain explicit rather than inferred from a minimum.

Readable Notes reuse shared `mindAffecting` for Mantle of Doubt and `fear` for Coward’s Cowl. Veil of Heaven uses local evil-outsider attack/effect circumstances: generic evil alignment does not equal the outsider subtype. Verminous Transformation uses a local single-target Spell circumstance; shared `spells` would broaden its rule. Beacon of Luck retains an unconditioned save/reroll Note. These Notes do not grant running statistics. Six roots already occur in earlier batch content closures (Magic Fang, Gust of Wind, Polymorph, Summon Giant Ally I, Hold Monster and Inflict Light Wounds, Mass); their checked descriptions explicitly use covered/no-output with no new import diagnostics, preserving those imported entries; their missing mechanics remain in the inventory. No existing shared Situation is changed.

Target/casting restrictions are kept verbatim, including Soulswitch requiring a familiar and Puzzle Box suppressing proficiency. No unrelated feature-selection prerequisites or permanent proficiency grants are invented. Running Spell Effects/target Item Abilities remain separate candidate definitions, outside this batch.

## Demonstration and checks

[Focused catalog tests](../../tests/catalog/spells-527.test.ts) reproduce bounded and complete-context extraction, verify byte hashes and all 100 assessment bindings, enforce notice dependencies, pin real inherited/metadata discrepancies and direct comparisons, and exercise both public sheet projections. [Isolated saved-sheet tests](../../tests/catalog/spells-527.integration.test.ts) browse/record Eagle’s Splendor and Human Potential through existing public APIs, compare saved/client projections, allow cooperative member edits and reject outsiders, unauthenticated reads/writes and wrong Character/campaign references. The fixture catalog is in-memory and Character-scoped.

Recorded Spells preserve literal +4 Charisma/+2 chosen-ability descriptions, sources, school and wizard level 2, but leave Strength 10, Intelligence 14, Wisdom 14, abilities, saves and Spellcasting unchanged in the saved preview. This proves collection metadata without accidentally activating a running Spell Effect. Held content remains held; the requested admitted-Spell demonstration is unavailable on the available evidence.

The bounded source-path gate has **82 holds and 18 selection-only reference failures**. Full source context has **100 batch holds, 0 admissions, 0 failures and 0 dependent omissions**. Full corpus output is **23,109 entries / 538 resources**, with **59 admitted, 23,195 held, 2 dependent omissions, 0 retained exceptions and 4,689 unrelated failure rows**. Global required curation has 3,687 candidates: 104 checked and 3,583 missing. No whole-corpus release-readiness claim is made. Final source catalog file SHA256: `608e65061437438d9d04e0848d5bd9a783d3bdd096e16d9310b9cc2630555c9f`.

The checked selected description pass succeeds with 2,520 retained records, 0 new/replaced drafts, 0 missing required records and 0 unresolved required mechanics; its 59 optional description findings remain visible.

The unrestricted full-corpus `catalog:curate` run also succeeds: 6,103 records, 3,583 new drafts, 0 replacements, 0 missing records and 758 unresolved required mechanics across the corpus. Drafts stay in scratch; none is promoted into the reviewed overlay.

All checks run sequentially with `CI=true` for tests and the launcher’s external `.ep-tmp` TMPDIR. No `.env*` file or private E2E data is accessed. Commands use the verified source paths and task-owned scratch; scratch is deleted after recording the results.

```sh
PF1_CURATION_SYSTEM=/home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1
PF1_CURATION_CONTENT=/home/andreas/repos/everythingpath/sources/pf1-content
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates <exact-527-key-file> --out <task-scratch>/draft
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates <exact-527-key-file> --records <task-scratch>/draft/records.json --descriptions --out <task-scratch>/prose
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates <exact-527-key-file> --records scripts/catalog/reviewed-curation.json --descriptions --out <task-scratch>/checked
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out <task-scratch>/full-drafts
pnpm -s catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates <exact-527-key-file> --out <task-scratch>/final-bounded
pnpm -s catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out <task-scratch>/full
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm catalog:notice-deps
pnpm -s catalog:format --check
CI=true pnpm test tests/catalog tests/catalog/spells-527.integration.test.ts
git diff --check
```

| Final check                                                            | Result                                                                    | Elapsed  |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------- |
| `pnpm -s typecheck`                                                    | Pass                                                                      | 12.42 s  |
| `pnpm -s lint`                                                         | Pass                                                                      | 161.59 s |
| `pnpm -s check:initial-migration-writers`                              | Pass; 183 registrations                                                   | 0.85 s   |
| `pnpm catalog:pin`                                                     | Pass; unchanged pinned corpus                                             | 0.27 s   |
| `pnpm catalog:notice-deps`                                             | Pass; 5,242 dependencies, 0 gaps/waived/stale; 36 advisories outside #527 | 1.04 s   |
| `pnpm -s catalog:format --check`                                       | Pass; canonical                                                           | 0.55 s   |
| `pnpm test tests/catalog tests/catalog/spells-527.integration.test.ts` | Pass; 80 files / 1,813 tests, including all 27 batch tests                | 52.47 s  |
| `git diff --check`                                                     | Pass                                                                      | <1 s     |

Source-path previews deliberately return exit 1: bounded selection has 18 absent-context references; complete corpus has 4,689 unrelated failure rows and is not release-ready. The fresh independent full-content binding audit and complete-context fixture confirm 100 batch holds, 0 batch failures and 0 admissions. Both selected and unrestricted curate commands return exit 0.

The first catalog test run failed on the missing empty source directory and two earlier binding fixtures; all are corrected without changing existing assertions. The final duration-budget advisory concerns an existing #344 test (10,708 / 15,000 ms), not a failure.

## Timing and workflow observations

Approximately **35 minutes elapsed** for this run. Phase wall times below are estimates and overlap: source gates ran while evidence review and report work continued, so the rows should not be summed as active work.

| Phase                                                                                   | Approximate time |
| --------------------------------------------------------------------------------------- | ---------------- |
| Instructions, policy and pinned-source verification                                     | 3 minutes        |
| Exact-key required draft and separate prose draft                                       | 1 minute         |
| Independent complete-text, action and inherited-notice review                           | 13 minutes       |
| Overlay, assessments, fixtures and binding preservation                                 | 6 minutes        |
| Public demonstration, source gates and sequential checks, including correction/rechecks | 18 minutes       |
| Report, preservation audit and cleanup                                                  | 3 minutes        |

Measured final source-command durations: full binding audit 10.23 s; bounded preview 11.60 s; checked selected prose pass 9.30 s; unrestricted full-corpus curate 169.38 s. Final check durations are recorded above.

- Source verification remains whole-checkout work for an exact bounded selection. Full context is needed to distinguish selected-link failures from corpus defects and bind root content closures.
- Phrase-based prose drafting is not a complete content review; 60 roots required an independent description pass. Supported missing running calculations remain visible outside the required-note gate.
- An initial new-Note schema attempt used invalid aggregate target/Situation shapes; source-path preview rejected it. Corrected data uses the existing `saves`/`ac` targets and string/shared or `{ local }` Situation shape. No tool/product fix was needed.
- A preservation audit caught schema-loaded metadata trimming old assessment rationale whitespace in a scratch binding attempt. Original raw records were restored before handoff; only new assessment identities remain in the final diff.
- Initial tests found a missing empty content-source directory and new diagnostics on six earlier closure dependencies. The directory is retained with `.gitkeep`; those descriptions use covered/no-output without diagnostics, and their mechanics findings remain in inventory. Existing fixture assertions are preserved.
- A repeat preview rejected an extra scratch admission file in its output directory. The independently rebound admission report was moved outside the reserved preview directory; no tool change was needed.
- Pinned bibliography duplicates and incomplete prose remain explicit holds. Fixed PCGen rows establish observed minima, not complete origin approval. No aliases or source corrections were guessed.
- Snapshots load through bounded schemas, following #344, so large JSON does not become a separate TypeScript type per row. No old fixtures or assertions are changed.
- No full test suite, deployment or git/GitHub write. The orchestrator owns landing and the independent admission review. All changes remain uncommitted; only this task’s scratch subdirectory is removed.

## Fix round 1 addendum — inherited-notice minima (2026-10-09)

**Sol (AI curator) for the owner.** This addendum corrects the inherited-notice minima and APG identity accounting above. **The exact 100 roots remain held: 0 admitted, dependent omissions, unsupported/prose-only definitions or exclusions.** All 100 whole-content holds, Dirge's truncated-description hold, 43 complete-chain holds, and the previous mechanics findings remain intact. The same 64 Spells retain outstanding mechanics; none becomes an attribution hold or a completed calculation.

The review now records **121 distinct per-candidate inherited dependencies: 21 additions across 17 roots**, all structured in `inheritedRuleNotices` and `requiredNotices`. The [inventory](../../scripts/catalog/legal/spells-527.json) retains previous evidence verbatim and adds exact root/context quotes, raw-file and description hashes, physical YAML line ranges and hashes, and fixed PCGen file/line identities. Complete comparator rows include publication declarations for the mixed-source `ce_templates.lst`; its Bestiary declaration precedes the Construct, Evil and Incorporeal records. These are observed minima, without a complete-origin approval.

| Root | Added minimum notices | Published evidence |
| --- | --- | --- |
| Thundering Drums | PZO1110 | Literal prone rule; CRB Gust of Wind full body, consistent with this batch's Gust of Wind review |
| Hydrophobia | PZO1110 | Literal nonlethal damage; CRB Gust of Wind full body, consistent with Hymn of Mercy |
| Earsend | PZO1110, PZO1116, PZO1112 | Own Fly checks; actual complete Skinsend body, literal Bestiary 2 p.295 compression, Bestiary Construct type, CRB Regenerate/Heal/Gentle Repose/Resurrection, helpless and DR |
| Dirge of the Victorious Knights | PZO1110, PZO1112 | Cold resistance/immunity and incorporeal wording; CRB Resist Energy/Antimagic Field and Bestiary Incorporeal p.312; missing continuation remains held |
| Fumbletongue | PZO1110 | Verbal casting requirements and command words; CRB Imbue with Spell Ability/Folding Boat; no telepathy-origin approval |
| Mad Hallucination | PZO1110 | Explicit caster-level checks; CRB Dispel Magic full body |
| Veil of Heaven | PZO1110, PZO1112 | Swift action and explicit Evil subtype; CRB Arcane Armor Training and Bestiary Evil p.311 |
| Vile Dog Transformation | PZO1110 | Explicit Summon Monster command rules and CRB Summon Monster I full body |
| Fiendish Wrath | PZO1110 | Unarmed strikes; CRB Improved Unarmed Strike p.128 |
| Shadow Step | PZO1110 | Dim-light/darkness eligibility; CRB Darkness defines both light levels |
| Human Potential | PZO1110 | Bonus-spell/skill-rank exception; complete CRB Fox's Cunning body |
| Beacon of Luck | PZO1110 | Immediate-action timing; CRB Mounted Combat p.131 |
| Siege of Trees | PZO1110 | Explicit standard-action timing; CRB Spell action metadata; own-book siege rules remain PZO1118 minima |
| Scripted Hallucination | PZO1110 | Complete inherited Audiovisual Hallucination concentration/image-motion rule; CRB Silent Image body and concentration duration |
| Apathy | PZO1110 | Explicit holding-breath rule; CRB Endurance p.122 |
| Ectoplasmic Snare | PZO1112 | Explicit incorporeal rule; Bestiary Incorporeal p.312, consistent with Dirge |
| Detect Fiendish Presence | PZO1112 | Explicit Evil subtype; Bestiary Evil p.311, consistent with Veil of Heaven |

The consistency pass revisited all 100 complete root descriptions and their inherited/context bodies. Generic values or vague terms do not identify a book. Detect Relations' barrier numbers and Transfiguring Touch's material quantities/prices remain unsupported origins under their existing whole-content holds; Devolution already requires its own APG eidolon/evolution book. Skinsend's complete construct traits, regeneration alternatives and remaining inherited closure, Fumbletongue's telepathic communication, and Dirge's omitted continuation are still unbounded. No missing text, origin, alias or full chain was invented.

**APG PZO1115:** `noticeRequirements` now retains the exact existing Registry identity `pf1-content/notice/7d75468ec859d3452bcef8458792e6ef19c7aafcf9cbaf2f759fdf4bc923b2a2`, with its unchanged notice hash and provenance, following #526. The existing `spells-527-notice-PZO1115-complete-chain` hold now also enforces that identity. The Registry, product-code aliases and source text are unchanged. This individually reviewed notice does not establish complete publication/printing or inherited-chain coverage.

**Summon Giant Ally I:** its PZO1112 hill-giant lead remains a supported minimum only. That lead does not approve cave, marsh, river, slag, stone or wood giant origins or complete inherited bodies. Other named giants remain unbounded under the unchanged whole-content and notice-chain holds. The limitation is appended to the candidate evidence and inventory without altering its notice set.

Eighteen affected #527 evidence records receive append-only correction evidence: the 17 roots with new minima and Summon Giant Ally I's scope clarification. Only those 18 assessments' evidence/notice bindings are updated. Every content and identity-mapping fingerprint remains unchanged. A preservation audit confirms all prior source/description/metadata/mechanics/disposition values, original notice fingerprints, inherited-rule/quote arrays and holds are value-equal or unchanged prefixes; 2,715 other assessments, 2,694 other evidence records and 1,227 other notice holds remain value-equal, including original whitespace. Overlay, identity remaps and Registry are byte-identical to HEAD; there are no tracked deletions.

The audit checks **203 actual pinned root/context/class files** against fixture provenance. The pinned source-path bounded preview reproduces the committed 100 entries exactly and verifies both checkouts: **82 holds, 18 selection-only reference failures, 0 admissions** (expected exit 1). The complete-context import validates all 100 individual bindings and returns **100 batch holds, 0 failures and 0 admissions**. The existing raw manifests, curation content and mapping inputs are unchanged, so an additional full-corpus re-extraction is unnecessary. Earlier full-corpus counts and hashes above describe the original run, rather than a new release claim.

The source-path checked description pass succeeds with **2,520 retained records, 0 additions/replacements, 0 missing required records and 0 unresolved required mechanics**. The 49 focused batch tests pass, independently pinning the corrected minima, actual source lines/hashes, complete Skinsend body and Bestiary publication declarations. A public admission-gate test proves the APG hash identity remains held even with a current confirmed test assessment; this test does not confer shipping admission. Existing public resolver and isolated saved-sheet checks preserve recorded Spell metadata and unchanged base statistics.

All fix-round checks run sequentially with `CI=true` and the launcher's external `.ep-tmp` TMPDIR. Source-path commands use the same verified pins and exactly the ticket's 100 keys. The initial typecheck identified two optional-value accesses in the new tests; explicit guards were added before the final successful run. An initial scratch binding demonstration with empty comparison inventory was invalid and discarded; the real complete-context import supplies the inventory and passes all 100 binding checks. No product, transport, importer, tooling, source or Registry implementation changes were needed.

| Fix-round check | Result | Measured elapsed |
| --- | --- | --- |
| Focused batch catalog and saved-sheet tests | Pass; 2 files / 49 tests | 5.86 s |
| `pnpm -s typecheck` | Final pass after the two test guards; initial run failed | Initial 6.21 s |
| `pnpm -s lint` | Pass; unchanged standard 8 GiB heap budget/scopes | 156.25 s |
| `pnpm -s check:initial-migration-writers` | Pass; 183 registrations | 0.90 s |
| `pnpm catalog:pin` | Pass; `sha256:d7a42ca346d875f9497c7da94325022ac289d7931226a3649979a13f410c8063` | 0.30 s |
| `pnpm catalog:notice-deps` | Pass; 5,292 dependencies on 2,702 candidates in 33 inventories; 0 gaps/waived/stale, 36 advisories, none in #527 | 1.12 s |
| `pnpm -s catalog:format --check` | Pass; canonical | 0.58 s |
| `pnpm test tests/catalog tests/catalog/spells-527.integration.test.ts` | Pass; 81 files / 1,859 tests, including all 49 batch tests | 61.59 s |
| `git diff --check` | Pass | 0.07 s |

The catalog suite's duration-budget advisory concerns the existing #344 test (11,413 / 15,000 ms); there are no test failures. No full repository suite or additional unrestricted corpus extraction was run. The selected source-path preview and checked description commands above were repeated for this round; the bounded preview's 18 absent-context failures remain intentional, with zero batch failures in complete context.

Approximately **13 minutes elapsed** for fix round 1. Preparation/policy/source review took about 1 minute, the complete inherited-notice consistency audit 4 minutes, artifacts/bindings/focused tests 2 minutes, source gates and sequential validation 5 minutes, and final report/preservation/cleanup about 1 minute. Report drafting also overlapped the sequential validation window; these are approximate phase estimates rather than isolated CPU timings.

Final changes are limited to this inventory, 18 affected assessment/evidence records, the existing APG hold's additional hash identity, the batch test/schema fixture, and this append-only report addendum. All earlier report bytes remain an unchanged prefix. Task-owned scratch is removed; no unrelated scratch, environment file or private E2E data is touched. No tracked deletions, git/GitHub writes, deployment or release activation occur. The launcher captures the final answer only at its external `-o` path.
