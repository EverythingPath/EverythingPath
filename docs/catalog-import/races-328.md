# Race curation review: #328

**2026-11-01 launch update (#328 S4-A):** Dwarf and Half-Orc are
**admitted** with confirmed, content-bound assessments; Human's is confirmed
too, but it is dependently omitted while Languages (Human) stays held; see
[S4-A launch: Human, Dwarf and Half-Orc](#s4-a-launch-human-dwarf-and-half-orc).
The other 77 races stay held as below.

**2026-10-25 author update:** [#740](race-import-740.md) adds drafted extraction
reassessments for the seven core races, Tiefling, the Aasimar comparison
correction and the Svirfneblin Craft correction. Current bindings and diagnostic proposals sit beside the preserved
original review in the inventory. All 80 races remain held; the historical
review and pre-importer diagnoses below are retained as history.

Reviewed 2026-10-07 by **Astra (AI curator) for the owner**, following [#328](https://github.com/AndreasUnunger/EverythingPath/issues/328), [PRD decision 17 and its acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461), and the [#264 notice review](inherited-notices-264.md).

The exact 82-key inventory contains **80 race definitions held for attribution review and two excluded Foundry folders**. No definition is admitted, dependently omitted by an accepted-parent assessment, or classified as wholly unsupported/prose-only. Each key has exactly one batch disposition. Holds do not establish that its mechanics are complete. This batch does not satisfy the ticket's demonstration of an admitted race: there is no accepted race to demonstrate, and the mechanics gaps below remain outstanding.

## Evidence and review boundary

- System: `foundryvtt-pathfinder1` v11.11, commit `418761d2e16a6037c0156bb4a241f7cea5a2986d`.
- Content: `pf1-content` 11.4.0, commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`.
- [Batch inventory](../../scripts/catalog/legal/races-328.json): every key, exact pinned YAML path and hash, description hash, source citations/pages, observed trait names, literal references, evidence identity, notice requirements and named hold reasons. Folder records carry the exclusion reason instead of a fabricated game-content assessment.
- [Attribution evidence](../../src/lib/catalog/data/attribution-evidence.json) and [Attribution Assessments](../../src/lib/catalog/data/attribution-assessments.json): per-definition review, bound to the final complete import's content closure, identity mapping, evidence and notices. These are unresolved assessments, not permission inferred from book citations.
- [Curation Overlay](../../scripts/catalog/reviewed-curation.json): exact raw note and description bindings, checked outputs, rationale and remaining diagnostics. Reviewed remaps and Item Ability policies remain unchanged; no new identity is invented.

All 80 definitions have upstream source citations; Primitive Human has only the free-text Paizo blog title. Existing player-facing `sources` remain unchanged; the importer leaves Primitive Human's sources empty and retains its custom citation as unsupported evidence. Citations do not prove where the complete imported content originated. Many descriptions add starting-age class groups and height/weight tables, and some contain linked catalog definitions. The supplied evidence lacks a complete content comparison establishing their origins. Each hold names the actual source record, citation and additional material needing review. The binding includes transitive imported dependencies without assessing those out-of-batch definitions anew.

The 14 distinct cited notice identities occur 81 times because Orc cites two books. Existing Core Rulebook notice coverage is retained for the seven core races' primary citation. Bestiary, Advanced Race Guide and Bestiary 5 keep the complete-book-chain holds from #264. Bestiary 6 remains an unreviewed owner transcription requiring the recorded PDF comparison. Green Martian retains the Dynamite/Worldscape notice-and-content hold. Other missing book chains and Primitive Human's blog attribution are named individually. Minimum known notice requirements are not represented as a complete origin bound. No Registry alias, notice text, legal-resource text or permanent notice is changed.

## Dispositions

The inventory below uses the complete `pf1/` identities from the ticket. `Held` means the per-key whole-content attribution hold plus the indicated notice status; the evidence inventory supplies its exact source comparison boundary and hold IDs. Import/admission failures are reported separately from these editorial dispositions.

| Exact key              | Name              | Disposition and reason                                                                                                          |
| ---------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `pf1/19JcztRuEWbrOqQW` | Hobgoblin         | Held: whole-content comparison missing; PZO9280: missing reviewed book notice.                                                  |
| `pf1/2mWMyKiPWk6Y8cNx` | Ghoran            | Held: whole-content comparison missing; PZO1140: missing reviewed book notice.                                                  |
| `pf1/3lV30qfiQaWKB0sp` | Merfolk           | Held: whole-content comparison missing; PZO9482: missing reviewed book notice.                                                  |
| `pf1/4i8qiF2QnGnPOyKC` | Wyvaran           | Held: whole-content comparison missing; PZO9280: missing reviewed book notice.                                                  |
| `pf1/4qEXPDlfIj1cIvCe` | Oread             | Held: whole-content comparison missing; PZO9280: missing reviewed book notice.                                                  |
| `pf1/6BKIB9hjKwSJorAZ` | Fetchling         | Held: whole-content comparison missing; PZO9280: missing reviewed book notice.                                                  |
| `pf1/7aDvyO68K8hm58Qm` | Lashunta (Female) | Held: whole-content comparison missing; PZO9280: missing reviewed book notice.                                                  |
| `pf1/9FBT6uqlRgaw9gug` | Changeling        | Held: whole-content comparison missing; PZO9280: missing reviewed book notice.                                                  |
| `pf1/9Fe6mDt0oP52m6Jl` | Android           | Held: whole-content comparison missing; PZO1133: complete book notice chain held (#264).                                        |
| `pf1/CWHsfTdEmZohUkw1` | Other             | Excluded: Foundry folder; no playable race definition.                                                                          |
| `pf1/DQGhOq3M3uxTFKYO` | Triton            | Held: whole-content comparison missing; PZO9482: missing reviewed book notice.                                                  |
| `pf1/E6bHjOMkRatMQwbR` | Aquatic Elf       | Held: whole-content comparison missing; PZO9482: missing reviewed book notice.                                                  |
| `pf1/FHY3oIk5zSOFncJH` | Aasimar           | Held: whole-content comparison missing; PZO9280: missing reviewed book notice.                                                  |
| `pf1/GAoJIy6ycj3OovQT` | Kitsune           | Held: whole-content comparison missing; PZO9280: missing reviewed book notice.                                                  |
| `pf1/Gtz5E4r6tg6spifD` | Suli              | Held: whole-content comparison missing; PZO9280: missing reviewed book notice.                                                  |
| `pf1/Gy4jOckBEwMjByga` | Gillman           | Held: whole-content comparison missing; PZO9482: missing reviewed book notice.                                                  |
| `pf1/H6tsZqHiaTOcFSOn` | Shabti            | Held: whole-content comparison missing; PZO1133: complete book notice chain held (#264).                                        |
| `pf1/HKRRq2tdZVEGlmHG` | Duskwalker        | Held: whole-content comparison missing; PZO1141: missing reviewed book notice.                                                  |
| `pf1/Hf31mrYb3uucNyLO` | Halfling          | Held: whole-content comparison missing; PZO1110: notice reviewed; whole-content evidence missing.                               |
| `pf1/ITHs6VCRdSQUsoen` | Gnoll             | Held: whole-content comparison missing; PZO1112: complete book notice chain held (#264).                                        |
| `pf1/JOuAdPAOTat7d5v6` | Orc               | Held: whole-content comparison missing; PZO1112: complete book notice chain held (#264); PZO9280: missing reviewed book notice. |
| `pf1/JxLvkHxDYY98HcAH` | Astomoi           | Held: whole-content comparison missing; PZO1133: complete book notice chain held (#264).                                        |
| `pf1/KMpuFun7YDFyuO8z` | Vine Leshy        | Held: whole-content comparison missing; PZO1140: missing reviewed book notice.                                                  |
| `pf1/LAtTC2NPuqjTLEkn` | Adaro             | Held: whole-content comparison missing; PZO9482: missing reviewed book notice.                                                  |
| `pf1/LMNzbqGSRAFQFE2Y` | Kobold            | Held: whole-content comparison missing; PZO9280: missing reviewed book notice.                                                  |
| `pf1/LQ7U0315C6CusmsU` | Reborn Samsaran   | Held: whole-content comparison missing; PZO9284: missing reviewed book notice.                                                  |
| `pf1/LU6Rgor1wTS5cCRN` | Lizardfolk        | Held: whole-content comparison missing; PZO1121: complete book notice chain held (#264).                                        |
| `pf1/Lt4ZP5GCinGvTfnF` | Grindylow         | Held: whole-content comparison missing; PZO9482: missing reviewed book notice.                                                  |
| `pf1/MF8vCjLIGTmJl3Mo` | Strix             | Held: whole-content comparison missing; PZO9280: missing reviewed book notice.                                                  |
| `pf1/MSLlV9YnompTd6xp` | Grippli           | Held: whole-content comparison missing; PZO9280: missing reviewed book notice.                                                  |
| `pf1/Mb6NAx0BJsoKbvt6` | Kuru              | Held: whole-content comparison missing; PZO9244: missing reviewed book notice.                                                  |
| `pf1/NgIhxRI0axrf3fcO` | Elf               | Held: whole-content comparison missing; PZO1110: notice reviewed; whole-content evidence missing.                               |
| `pf1/NhEPoXIZWOOunSH7` | Cecaelia          | Held: whole-content comparison missing; PZO9482: missing reviewed book notice.                                                  |
| `pf1/PsRZOF49ZKtorZbs` | Wyrwood           | Held: whole-content comparison missing; PZO9280: missing reviewed book notice.                                                  |
| `pf1/QKrRHanuWwD4pu8Q` | Ganzi             | Held: whole-content comparison missing; PZO1141: missing reviewed book notice.                                                  |
| `pf1/RWSoA7Fj9yqo0y9U` | Core              | Excluded: Foundry folder; no playable race definition.                                                                          |
| `pf1/TPHe88Yhy4SsDpKo` | Ifrit             | Held: whole-content comparison missing; PZO9280: missing reviewed book notice.                                                  |
| `pf1/TbZmYyDUxRn9baWy` | Sahuagin          | Held: whole-content comparison missing; PZO9482: missing reviewed book notice.                                                  |
| `pf1/TpfcHDjKatQL3XBl` | Naiad             | Held: whole-content comparison missing; PZO1137: owner transcription unreviewed.                                                |
| `pf1/VE4d35yiptv2eyxm` | Catfolk           | Held: whole-content comparison missing; PZO9280: missing reviewed book notice.                                                  |
| `pf1/VYbsatEW3DFCLWtD` | Kasatha           | Held: whole-content comparison missing; PZO9280: missing reviewed book notice.                                                  |
| `pf1/Vaf5bV3wpk24pVt2` | Wayang            | Held: whole-content comparison missing; PZO9280: missing reviewed book notice.                                                  |
| `pf1/VkQBqlEG8GPmNnzI` | Vanara            | Held: whole-content comparison missing; PZO9280: missing reviewed book notice.                                                  |
| `pf1/WxPc1Nw2V3ohdl2x` | Locathah          | Held: whole-content comparison missing; PZO9482: missing reviewed book notice.                                                  |
| `pf1/WzN6fEHiT8OTpwUR` | Caligni           | Held: whole-content comparison missing; PZO1133: complete book notice chain held (#264).                                        |
| `pf1/YCCdi4OEC4WuzelM` | Reptoid           | Held: whole-content comparison missing; PZO1133: complete book notice chain held (#264).                                        |
| `pf1/Yder5QR51sDl5X0n` | Vishkanya         | Held: whole-content comparison missing; PZO9280: missing reviewed book notice.                                                  |
| `pf1/YxeSVRbG7lfQybfr` | Green Martian     | Held: whole-content comparison missing; DYN0032-E: known notice hold.                                                           |
| `pf1/Z76GkfAvnzba4XDd` | Deep One Hybrid   | Held: whole-content comparison missing; PZO1133: complete book notice chain held (#264).                                        |
| `pf1/ZVzH0qb1Tqety6fU` | Nagaji            | Held: whole-content comparison missing; PZO9280: missing reviewed book notice.                                                  |
| `pf1/ZYWZL5BWLfZyMif9` | Being of Ib       | Held: whole-content comparison missing; PZO90111: missing reviewed book notice.                                                 |
| `pf1/ZnRc2qF1ZfpajxEe` | Rougarou          | Held: whole-content comparison missing; PZO1137: owner transcription unreviewed.                                                |
| `pf1/aCyDEyMB5PKJAuTi` | Monkey Goblin     | Held: whole-content comparison missing; PZO1137: owner transcription unreviewed.                                                |
| `pf1/aQ8RQYKVd2hqI4jh` | Samsaran          | Held: whole-content comparison missing; PZO9280: missing reviewed book notice.                                                  |
| `pf1/apWl6JIJ8U8p0azq` | Skinwalker        | Held: whole-content comparison missing; PZO1133: complete book notice chain held (#264).                                        |
| `pf1/bOv30pyHB1gFbSTj` | Goblin            | Held: whole-content comparison missing; PZO9280: missing reviewed book notice.                                                  |
| `pf1/cCepRrfH5SalFfT4` | Half-Elf          | Held: whole-content comparison missing; PZO1110: notice reviewed; whole-content evidence missing.                               |
| `pf1/dCAXgdA6Db1Z3ccz` | Half-Orc          | Held: whole-content comparison missing; PZO1110: notice reviewed; whole-content evidence missing.                               |
| `pf1/e6IaBxKgMxy1yKlr` | Human             | Held: whole-content comparison missing; PZO1110: notice reviewed; whole-content evidence missing.                               |
| `pf1/eV9USBGHA1rYd5P7` | Duergar           | Held: whole-content comparison missing; PZO9280: missing reviewed book notice.                                                  |
| `pf1/efwHEwjvL9Z94MJI` | Gnome             | Held: whole-content comparison missing; PZO1110: notice reviewed; whole-content evidence missing.                               |
| `pf1/fX9F2amW2BcYoHwb` | Svirfneblin       | Held: whole-content comparison missing; PZO9280: missing reviewed book notice.                                                  |
| `pf1/g9GYFtD8FOxtUGvJ` | Lashunta (Male)   | Held: whole-content comparison missing; PZO9280: missing reviewed book notice.                                                  |
| `pf1/gZxiUYLYsGqQYwGZ` | Ogre              | Held: whole-content comparison missing; PZO1121: complete book notice chain held (#264).                                        |
| `pf1/iqJvhd7NbmybUl0y` | Undine            | Held: whole-content comparison missing; PZO9280: missing reviewed book notice.                                                  |
| `pf1/jLZAApW8ymudcJpw` | Drow Noble        | Held: whole-content comparison missing; PZO1112: complete book notice chain held (#264).                                        |
| `pf1/jhh6z3NZlImHjZ8H` | Munavri           | Held: whole-content comparison missing; PZO1137: owner transcription unreviewed.                                                |
| `pf1/m1Yvpz1t8S9x4PPr` | Primitive Human   | Held: whole-content comparison missing; Paizo Blog: The Gauntlet Will Be Ours!: missing notice and origin evidence.             |
| `pf1/m5cdZ1RG7c1mkhqF` | Orang-Pendak      | Held: whole-content comparison missing; PZO1133: complete book notice chain held (#264).                                        |
| `pf1/nEltI9y37rKJTeWo` | Dwarf             | Held: whole-content comparison missing; PZO1110: notice reviewed; whole-content evidence missing.                               |
| `pf1/nVjKDLZSRONzYm8f` | Tiefling          | Held: whole-content comparison missing; PZO9280: missing reviewed book notice.                                                  |
| `pf1/pbX1xj9Z0ZhUfKvZ` | Sylph             | Held: whole-content comparison missing; PZO9280: missing reviewed book notice.                                                  |
| `pf1/puKk997wHX3kIRkR` | Dhampir           | Held: whole-content comparison missing; PZO9280: missing reviewed book notice.                                                  |
| `pf1/qdFPM6gztJxvdiRf` | Trox              | Held: whole-content comparison missing; PZO9280: missing reviewed book notice.                                                  |
| `pf1/rAKaCt6BW3rVv2kN` | Ratfolk           | Held: whole-content comparison missing; PZO9280: missing reviewed book notice.                                                  |
| `pf1/ryBQiQNP6ZrkwZCy` | Syrinx            | Held: whole-content comparison missing; PZO9280: missing reviewed book notice.                                                  |
| `pf1/sMHXS804w3UdTVKH` | Triaxian          | Held: whole-content comparison missing; PZO9280: missing reviewed book notice.                                                  |
| `pf1/sXIQ3MFLInN9SF7m` | Yaddithian        | Held: whole-content comparison missing; PZO1137: owner transcription unreviewed.                                                |
| `pf1/ubx4PIbRqmVT93Ds` | Gathlain          | Held: whole-content comparison missing; PZO1140: missing reviewed book notice.                                                  |
| `pf1/yAS41rHv0WzDmuRm` | Tengu             | Held: whole-content comparison missing; PZO9280: missing reviewed book notice.                                                  |
| `pf1/yLaDS5HGbwtgpkbP` | Drow              | Held: whole-content comparison missing; PZO9280: missing reviewed book notice.                                                  |
| `pf1/zlWiqUqxCajrZRe3` | Aphorite          | Held: whole-content comparison missing; PZO1141: missing reviewed book notice.                                                  |

## Mechanics and curation

The bounded parser/drafter found 44 required notes, zero action conditionals and zero Item Abilities. The separate description pass found 43 descriptions. All 87 records are checked, with reviewer/date and 104 outputs; a resumed pass adds or replaces nothing. Required coverage has zero missing, stale or unresolved mechanics records. All 43 description records retain explicit unresolved diagnostics, so passing the required-note gate does not mean complete race automation. The other 37 race descriptions were also inspected in the separate per-key mechanics review; they simply do not trigger the parser's optional description predicate.

Corrections include Android's separately conditioned saves and readable immunity text; Gillman's +2 against non-aboleth enchantments versus −2 against aboleths; Dwarf/Gnome humanoid-subtype conditions; racial types on Elf magic-related checks; Halfling Fearless stacking with Halfling Luck; and Vishkanya's supported Hit Dice formula. The prose pass supplies supported missing clauses, including Dhampir saves, Duergar spell/spell-like saves, Ganzi polymorph saves, Ghoran grapple-escape penalties and Gnome/Kitsune school DCs. Local Situations remain local unless an exact reviewed shared equivalence was recorded. No new shared Source identity is inferred; ordinary rule identity remains the stacking Source.

The five-record correction on 2026-10-07 was reviewed by **Sol (AI curator) for the owner** against the same pin. Changeling gains +1 natural armor ([YAML lines 59–61](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/races/changeling.9FBT6uqlRgaw9gug.yaml#L59-61)); Grindylow +2 ([lines 57–59](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/races/grindylow.Lt4ZP5GCinGvTfnF.yaml#L57-59)); Cecaelia +2 ([lines 48–49](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/races/cecaelia.NhEPoXIZWOOunSH7.yaml#L48-49)); Nagaji +1 ([lines 75–77](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/races/nagaji.ZVzH0qb1Tqety6fU.yaml#L75-77)); and Ghoran +2 ([lines 60–62](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/races/ghoran.2mWMyKiPWk6Y8cNx.yaml#L60-62)). Each checked description now supplies `ac.natural`/`naturalArmor` at the dependent-statistic stage because the importer drops raw `nac`/`base` changes. Exact bindings, rule identities and attribution holds remain unchanged; the overlay now has 109 outputs. Counts, checks and fingerprints recorded below describe the original #328 run before this correction.

Ghoran's Delicious clause ([lines 77–80](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/races/ghoran.2mWMyKiPWk6Y8cNx.yaml#L77-80)) supplies one CMB −2 Modifier only when escaping a grapple against a creature that has a bite attack with grab. Its Escape Artist limitation is recorded once as a readable `skill.esc` Situational Note with the same local Situation; no second race names that circumstance, so it is not promoted to a shared Situation. The raw unconditional Escape Artist −2 ([lines 26–29](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/races/ghoran.2mWMyKiPWk6Y8cNx.yaml#L26-29)) remains the only numeric Escape Artist copy. The append-only overlay cannot condition or remove it; the checked description retains an unresolved diagnostic, and conditional Escape Artist calculation remains incomplete pending [#720](https://github.com/AndreasUnunger/EverythingPath/issues/720). The focused tests pin the dropped raw natural armor, supplied bonuses, single raw Escape Artist penalty and conditioned CMB outcome without changing the importer. **Since [#720](https://github.com/AndreasUnunger/EverythingPath/issues/720):** a reviewed rule reports the raw Escape Artist −2 as conditional, so it no longer counts; the Situational Note and the conditioned CMB −2 are unchanged. The checked description's unresolved diagnostic still describes the importer before #720.

Every race's `mechanicsReview` in the inventory records its retained mapped facts, remaining work and exact source evidence. Outstanding mechanics are separate from legal holds:

- The preview importer does not link standard Racial Trait Grants or relocate/deduplicate race Modifiers onto those traits, despite the consuming [Racial Trait contract](../character-sheet/racial-traits.md). Ability choices, Bonus Feat/Skilled/Adaptability/Multitalented, race-equivalence prerequisites and trait-owned weapon familiarity therefore remain incomplete. Linked traits need their own curation and admission; this batch does not expand to those candidates.
  - **Since [#719](https://github.com/AndreasUnunger/EverythingPath/issues/719):** the importer links the Grants and relocates race Modifiers and this batch's reviewed race notes onto the traits (see [Racial Trait Grants](README.md#racial-trait-grants)). The overlay records still bind to the races: none is stale. They keep applying until a trait batch checks the trait's own note record for the same target; a drafted trait record does not supersede them. Every race definition changed, so the content fingerprints of all 80 Attribution Assessments here no longer match. The races stay held and were not re-assessed. The diagnostics on this batch's description records still describe the importer before #719. A bounded preview of only these 82 keys still passes required curation (44 checked, none missing or stale), but its admission now reports 77 reference failures for linked traits outside the selection; the full preview has none of them. In that bounded preview, the race outputs that re-home onto a trait outside the selection are not applied and are reported as `curation.home` issues. The isolated fixture below has no trait records, so its races keep every Modifier.
  - **Since [#721](https://github.com/AndreasUnunger/EverythingPath/issues/721):** the fixed ability changes of 72 races, including all six isolated fixture races, move onto a reviewed ability score trait per race (see [Racial Trait Grants](README.md#racial-trait-grants)). Each trait is held like its race, with the race's books as its required notices, and has no Attribution Assessment of its own. The fixture's `preview.json` lists the six traits, and its sheet adapter grants each race its trait, so the scores below are unchanged.
- Race size/movement and supported proficiency facts are not completely mapped. Twenty-two structured source changes are unmapped, including natural armor, racial skill-rank changes, healing-related fields and spell resistance. The three traitless races retain their mapped Modifiers, but Gnoll/Lizardfolk/Ogre natural armor and Ogre size are still missing.
  - **Since #720:** every race imports its size (Ogre is Large), and all natural armor is a natural armor bonus, including Gnoll +2, Lizardfolk +1 and Ogre +2. Speeds and spell resistance are reported as unsupported, each with a reason; the sheet has neither statistic. Of the 22 changes, 20 now map and 2 (Drow Noble spell resistance, Primitive Feat) are reported. None is healing-related. See [Race facts](README.md#race-facts). The `mechanicsReview` entries keep their 2026-10-07 snapshot.
- Raw mapped skill targets use long names such as `skill.perception`; curated outputs use the runtime's short skill keys. The production adaptation of those raw skill targets is unproven. The representative tests do not claim skill completeness.
  - **Since #720:** raw skill targets import as the runtime keys, so they count on a sheet. The isolated fixture's `preview.json` now shows `skill.per`, the races' sizes and their reported speeds.
- Source disagreements remain explicit. Aasimar's structured +2 Wisdom is absent from its ability-score sentence; the review preserves the structured value and flags the disagreement rather than inventing replacement text. Primitive Human's physical ability choice and other per-race missing facts are listed separately. Unmodeled senses, resistance rules, special attacks and play-time abilities remain readable prose without claiming automated calculations.
- All 80 imported definitions have zero Racial Hit Dice, as PRD decision 5 and [#312](https://github.com/AndreasUnunger/EverythingPath/issues/312) require. No racial HD is inferred from a monster stat block. Fixed positive HD, progression, HP and ranks are demonstrated only as an explicitly edited custom race, following the [Racial Hit Dice contract](../character-sheet/racial-hit-dice.md).

## Demonstration and checks

The [six pinned raw fixtures](../../tests/fixtures/races-328/README.md) retain exact source hashes and a reproducible extracted preview. They are held content, with no accepted fixture attribution. [Ten catalog tests](../../tests/catalog/races-328.test.ts) verify the exact ticket inventory, all 80 unresolved assessments, source bytes, deterministic import, current content bindings and invalidation after changes. Halfling's reduced fixture deliberately lacks a linked dependency, so its content fingerprint must differ from the complete assessment; it cannot stand in for release evidence.

Through the public resolver, six base scores of 10 yield Gnoll and Lizardfolk scores `[12,10,12,10,10,10]`, and Ogre `[14,10,12,8,10,8]`; since #721 the race's granted ability score trait supplies them, and the Convex tests seed the Gnoll's trait beside it. These assertions prove the mapped ability contributions once and zero imported racial HD, not complete race statistics. Gillman, Halfling and Dwarf checks prove the corrected conditional save behavior, including Hardy counting only once when conditions overlap.

[Two isolated Convex tests](../../convex/races328.integration.test.ts) seed only an in-memory, Character-scoped Gnoll fixture, then use public race selection, saved-sheet reads and catalog reads. The application's catalog-preview calculation agrees with the saved sheet; another campaign member sees the same result and an outsider is refused. An explicit custom edit to three racial HD preserves the Class Levels and separately records racial HP/ranks. This uses existing APIs and no remote deployment, production data, new global admission or browser automation. These tests pass, but the requested admitted-race demonstration remains unavailable until the stated attribution and mechanics work is resolved.

Commands ran locally with the two pinned sibling checkouts and worktree-local `TMPDIR`. No environment file or private E2E material was accessed. The temporary directory used `{"type":"commonjs"}` as in #264, so extensionless CommonJS test executables do not inherit this repository's module type. The following commands reproduce the reviewed overlay and final gates; the first draft in this session preceded the new overlay and produced 44 drafted notes, then the separate prose pass added 43 drafts.

```sh
mkdir -p .scratch/curation-328/tmp .scratch/curation-328/curation-work
export TMPDIR="$PWD/.scratch/curation-328/tmp"
printf '{"type":"commonjs"}\n' > "$TMPDIR/package.json"
PF1_CURATION_SYSTEM="$PWD/../sources/foundryvtt-pathfinder1"
PF1_CURATION_CONTENT="$PWD/../sources/pf1-content"
node --input-type=module <<'JS'
import fs from 'node:fs';
const review = JSON.parse(fs.readFileSync('scripts/catalog/legal/races-328.json', 'utf8'));
fs.writeFileSync('.scratch/curation-328/curation-work/candidates.json',
  JSON.stringify(review.candidates.map(({ externalKey }) => externalKey), null, 2) + '\n');
JS
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/curation-328/curation-work/candidates.json --records scripts/catalog/reviewed-curation.json --descriptions --out .scratch/curation-328/curation-work/checked
pnpm -s catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/curation-328/curation-work/candidates.json --out .scratch/curation-328/final-bounded-preview
pnpm -s catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-328/reviewed-full-preview
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm test tests/catalog/curation-command.test.ts
pnpm test tests/catalog/races-328.test.ts convex/races328.integration.test.ts
pnpm test tests/catalog
pnpm test
pnpm test --maxWorkers=4
pnpm test tests/catalog/curation.test.ts tests/catalog/races-328.test.ts --maxWorkers=1
git diff --check
```

| Check                                                            | Observed result                                                                                           |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Source verification                                              | Both commits/manifests verified; no override for pinned runs                                              |
| Initial note draft and separate prose draft                      | Both exit 0; 44 notes, then 43 descriptions                                                               |
| Checked description resume                                       | Exit 0; 87 retained, zero added/replaced                                                                  |
| Bounded import inventory                                         | 82 accounted records: 80 extracted races, two excluded folders, zero unassigned                           |
| Bounded required curation                                        | Pass: 44 checked, zero missing/stale/unresolved required mechanics; 43 separately unresolved descriptions |
| Bounded admission                                                | Exit 1: zero admitted, 34 held, 46 reference failures; zero dependent omissions or retained exceptions    |
| Full import/admission                                            | Exit 1: 23,037 entries and 538 resources; zero admitted, 23,184 held, 4,790 failures                      |
| `pnpm -s typecheck`                                              | Pass                                                                                                      |
| `pnpm -s lint`                                                   | Pass                                                                                                      |
| `pnpm -s check:initial-migration-writers`                        | Pass: 168 registrations                                                                                   |
| `pnpm catalog:pin`                                               | Pass: `sha256:6607d068facda14d40eddebe4e916952e8c668997ecadde9dbdc550e946f5518`                           |
| Focused bounded-command tests                                    | 14 passed                                                                                                 |
| Initial focused race catalog and saved-sheet tests               | 11 passed; 1.53 seconds                                                                                   |
| Focused curation and race tests after final Situation correction | 73 passed; 2.62 seconds                                                                                   |
| `pnpm test tests/catalog`                                        | Pass: 18 files, 308 tests; 20.16 seconds                                                                  |
| Foreground full `pnpm test`                                      | Pass with four workers: 492 files, 6,191 tests; 269.32 seconds (plain-run failures below)                 |
| `git diff --check`                                               | Pass                                                                                                      |

The full import separates real reference failures from dependencies omitted only by the bounded preview. Within this batch, the full gate classifies 54 definitions as held and fails 26 on structure/references before reaching attribution. The inventory's 80 reviewed holds remain independently recorded; this report does not relabel those 26 failures as a passing admission result. The bounded preview adds 20 such failures because linked definitions lie outside its selected output. Its `coverageComplete: true` describes only the 82 selected inventory records.

Full-corpus failures are 3,684 missing required curation records outside this batch, 715 unaccounted inventory records and 391 structure/reference failures. Full required-note coverage remains 44 checked of 3,728; the other batches are not implicitly reviewed. Neither preview has an admitted-notice requirement or a retained-use exception. Attribution bindings were built from the complete final extraction, not a reduced fixture with absent dependencies.

Final extraction fingerprint: `688fabb43f816e06dfb78891ebfb5a478f318e39bceab43dcf75cce1410c9e30`. Reviewed-input fingerprint: `372b654102003cced0c706e61f6c457a97c93d225600e958027da217e1a34fa9`. Legal-resource fingerprint: `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e`. Bounded admission-report SHA-256: `929c01fca2095b87dcadedd04d9e256e269bb5bf7090a560a976650bb709feb1`. Final full admission-report SHA-256: `c7cc6da6350bf7068befa0412e35da56ce5cbea696ad52d9a73fe357fd9d65fb`. The complete extraction was independently reconstructed from its CLI reports and matched its extraction fingerprint before binding; reevaluating that exact artifact with the final assessments produced a report identical to the final full CLI run.

The first typecheck caught incorrect relative imports in the new fixture; the first lint found unsafe assignments at the new selector JSON boundary. Both were corrected. The first catalog suite had 307 passing tests and one failure because an existing test assumed Human lacked an assessment. It now explicitly supplies empty attribution evidence while retaining every original assertion; its focused 39-test suite passes. The first full suite had 6,189 passing tests and two failures: that same stale test assumption and an existing UI test reaching its 5-second timeout during overlapping checks (176.82 seconds, exit 1).

A second plain `pnpm test`, with this session's other heavy commands finished, had 6,183 passing tests and eight failures (182.22 seconds, exit 1): four five-second timeouts in activation, move and Class Level UI tests, followed by four activation-test module-export errors. The stale attribution assertion was fixed. At that point the host reported 16 online CPUs and load averages 22.78/19.87/15.99. Those changing failures suggested resource contention; they do not establish a new content regression. A third full foreground run uses `--maxWorkers=4`, without skipping tests, changing timeout budgets or changing application code. Its final summary follows.

```text
Test Files  492 passed (492)
     Tests  6191 passed (6191)
  Start at  10:45:43
  Duration  269.32s
```

Times are local (Europe/Stockholm); the foreground command exited 0. A final audit immediately afterward corrected four Strix/Syrinx note conditions from shared to local Situations and removed the two unsupported shared declarations. Each condition appears on only one distinct Catalog Entry, so it does not qualify for shared promotion. Numeric bonuses and exact source bindings are unchanged. Focused checks and final catalog commands were repeated for this narrow data correction; the full-suite result above precedes it.

## S4-A launch: Human, Dwarf and Half-Orc

Reviewed 2026-11-01 by **Sol (AI curator) for the owner** under discriminator #328 (S4-A, the CRB core races launch closure). The three races, their 21 standard Racial Traits (owned by #387–#404) and the Dwarf's local ability score trait were compared in full. After [fix round 1](#fix-round-1), 23 records are **admitted**, each with a confirmed, content-bound Attribution Assessment. Languages (Human) stays held on its ethnic-language sentences, and Human (confirmed) is dependently omitted until that trait is confirmed. The other 77 races keep their holds, and so do every reverse dependent (Dual Talent, Human-Raised, Round Ears, Tribalistic, Stonecunning (Svirfneblin), Orc Atavism, Wild Ferocity, Fey Boon, Svirfneblin) and all feats that name these races.

| Key                    | Race     | Closure                | Required notices          | Evidence                    |
| ---------------------- | -------- | ---------------------- | ------------------------- | --------------------------- |
| `pf1/e6IaBxKgMxy1yKlr` | Human    | 5 (race + 4 traits)    | PZO1110, PZO1121, PZO9280 | `race-328-e6IaBxKgMxy1yKlr` |
| `pf1/nEltI9y37rKJTeWo` | Dwarf    | 12 (race + 10 + local) | PZO1110, PZO1121, PZO9280 | `race-328-nEltI9y37rKJTeWo` |
| `pf1/dCAXgdA6Db1Z3ccz` | Half-Orc | 8 (race + 7 traits)    | PZO1110, PZO1121, PZO9280 | `race-328-dCAXgdA6Db1Z3ccz` |

`local/race-ability-scores/pf1/nEltI9y37rKJTeWo` takes the Dwarf's assessment (`admission.ts`, `isAttributionOwner`). Each race's assessment binds its own evidence and #740's `race-740-extraction-<id>` evidence, and no longer carries #740's conclusion reference: its "admission review remain held" paragraph no longer applies. The `reassessment` blocks and `assessmentHistory` are unchanged.

### Race bodies

Each body was compared section by section (`launchReview.body` in the inventory):

- **Starting age.** The adulthood and the three dice match the PRD supplement `prd-supplement-2026-10-31` (`advancedRaceGuide/ageHeightWeight.html`, role `ageTables`): Dwarf `:354` (40 years, +3d6/+5d6/+7d6), Half-Orc `:358` (14, +1d4/+1d6/+2d6), Human `:360` (15, +1d4/+1d6/+2d6). The three class-group footnotes are `:398-400` word for word. PCGen's biosettings agree (Dwarf `:9`/`:11`, Human `:11`/`:13`, Half-Orc `:13`/`:15`).
- **Height and weight.** These cite PCGen's `core_essentials/races/{dwarf/dwarf,human/human,half_orc/halforc}_biosettings.lst` (Dwarf `:6`, Human `:8`, Half-Orc `:9`): base height, the height die, base weight and the `TOTALWT:BASEWT+(HTDIEROLL*n)` multiplier for each sex. The supplement's `:459-472` agree, but its role is age tables only (owner, 2026-10-31), so they are corroboration, never cited.
- **Bracketed ranges** ("43 – 58 years", "5 ft – 6 ft. 6 in."). These are on neither page. They are Foundry's arithmetic from the dice; all 21 (7 per race) were recomputed and match. They are recorded as derived values.
- **Trait lines** against the ARG race pages (`advancedRaceGuide/coreRaces/dwarves.html:359-371`, `humans.html:358-364`, `halfOrcs.html:366-375`). The recorded wording differences are the Dwarf's "They gain +2 Constitution…" sentence, "thus" in each Size line, "non-magical" and "perfectly" (Dwarf), and Foundry's capitalised condition labels in Orc Ferocity. The Type lines have no ARG paragraph: they follow the Inner Sea Races block and match the structured creature types. Human's "with both the human subtypes" is recorded, not resolved. The section headings (Defense / Feat and Skill / Offensive / Senses / Other Racial Traits) are the Inner Sea Races layout.
- **References.** The bodies' `@UUID` links are pf1e-rules journal pages that #738 keeps as text; they import no linked definition.

### Notices

- **PZO1110** stays (each record's own citation).
- **PZO1121** (the ARG age class groups and trait paragraphs) is added. Its Registry notice is reviewed, and its hold `notice-264-complete-chain-457075…` is cleared (`notice-clearances.json`, owner 2026-10-30).
- **PZO9280** (the Inner Sea Races trait block and wording) is added. Its reviewed confirmation `section15-confirmations-716.json#PZO9280` waives `race-328-notice-PZO9280`.

`requiredNoticeBoundary` anticipated both additions. The inventory-level `noticeRequirements` rows stay as history.

### Mechanics

- **Grants.** Each race's `detail.racialTraits` equals its ARG list. Size is Medium.
- **Human.** +2 to One Ability Score is `ability.$choice`. Bonus Feat grants one feat slot at 1st level. Skilled gives one extra rank per level (bonusFeats and bonusSkillRanks are relocated from the race).
- **Dwarf.** +2 Con, +2 Wis and −2 Cha come through the local trait. Weapon Familiarity grants Battle Axe, Heavy Pick and Warhammer. The race carries no Modifier: its checked note records (12369–12371 among them) are re-homed onto Defensive Training, Hardy, Stability, Greed and Hatred, and its `skill.per` record is superseded by Stonecunning's own (`staleNotes`). The import report lists no `overlaps` or `latentOverlaps`, so nothing is counted twice.
- **Half-Orc.** Intimidating gives +2 racial Intimidate. Orc Blood sets `countsAsRaces` to Human and Orc. Weapon Familiarity grants Falchion and Greataxe.

**Outstanding, never holds** (`mechanicsReview.outstanding`, replacing the pre-#719/#720 text):

- speed, and Slow and Steady's armour and encumbrance clause (#740; owner 2026-10-31, "prose is fine for now");
- "treat … dwarven/orc weapons as martial" (#740);
- darkvision, languages and Orc Ferocity's once-per-day use (permitted prose).

### Curation records

The batch adds four checked description records, one each for Bonus Feat (Human), Languages (Dwarf), Weapon Familiarity (Half-Orc) and Darkvision (Half-Orc). Their new inventories (#402–#404) need exactly one description record per candidate. Each record has `outputs: []`, so it adds nothing to the imported entry. The curated full-corpus preview's 23,630 entries are identical to the base preview's, so no content binding anywhere moves: none of the race closures that `feats-334…366`, the `protected-context.json` fixtures or Fey Boon bind. No other record changed.

### Previews

| Preview                                     | Admitted      | Held             | Dependent omissions | Failures          |
| ------------------------------------------- | ------------- | ---------------- | ------------------- | ----------------- |
| Bounded, 24 keys                            | 25            | 0                | 0                   | 0                 |
| Full corpus, base `5ebbf2fb`                | 131           | 23,676           | 166                 | 1,761             |
| Full corpus, S4-A as submitted (`cc33c538`) | 156 (+25)     | 23,651 (−25)     | 166                 | 1,761 (identical) |
| Full corpus, S4-A after fix round 1         | **154** (+23) | **23,652** (−24) | **167** (+1)        | 1,761 (identical) |

As submitted, the newly admitted records were exactly the 25 above; after fix round 1 they are 23: those 25 less Human and Languages (Human). No other held record's reason changed.

### Launch inventory

The notice authority was regenerated with S1's procedure: `noticeAuthoritySha256` `349ac2d7…` → `fabe39d8…` (fix round 1: `574de658…`). `catalog:launch-inventory --write`, then `--check`, pass.

- **Identity:** `sha256:cc07084c…` → `sha256:6683ddd9…` as submitted; after fix round 1 `sha256:2cb0f526a5a3a9c39aae548d96e21ef6553bf1eb745ef08313ee56dc3df7b246`.
- **Rows:** 19,267, unchanged; required notices stay at 70.
- **Failures:** 99,253 → 99,206 (−47) as submitted; fix round 1 returns Languages (Human)'s three holds on its required row, 99,209 (net −44). These are the whole-content and notice-chain holds the required rows dropped. Three optional rows dropped 9 more, which don't count. Each race keeps #740's launch-inventory hold.
- **Inputs:** +3 (`racial-traits-402…404.json`); 13 inventory hashes change.
- **Edges:** −12/+19. The four new trait keys' twelve source-metadata edges now cite their inventories; the races gain PZO1121 and PZO9280 edges (+6); Darkvision (Half-Orc) gains PZO1127.
- **Notices:** PZO9280's and PZO1121's source bindings move to the Dwarf; coverage moves in order only.

The other scope files decode identically. Only `launch-document.test.ts` moved; `release-scope.test.ts` did not.

### Preservation

New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `5ebbf2fb`: **3** (pcgen 3).

S4-A adds three PCGen files to the shared store, byte-identical at `25523dbc`: `core_essentials/races/{dwarf/dwarf,human/human,half_orc/halforc}_biosettings.lst`. Their hashes are in `races-328.json` `comparisonSources`. The four new trait records are not added (the brief limits S4-A to these three files), so `racial-traits-40{2,3,4}.test.ts` check their bytes against the pinned pf1-content checkout when it is present.

### Tests

- `races-328.test.ts` covers 77 held rows, 2 admitted and 1 dependently omitted (Human; Astra's history kept). It adds an S4-A gate over the three closures (`tests/fixtures/races-328/admitted.json`, 25 entries) and an isolated-sheet resolver check.
- The 12 touched `racial-traits-<n>.test.ts` move to the admitted rows, and so does `racialTraits388.integration`, whose held control Stonecunning becomes Languages (Vanara).
- New: `racial-traits-40{2,3,4}.test.ts`.
- `race-import-740-conclusions.test.ts` accepts the confirmed races without a conclusion reference.

### Fix round 1

The independent curation review of `cc33c538` (finding 1) found Languages (Human) confirmed without comparison evidence for two of its sentences: the added ethnic starting language and the Common/Taldane exception. Neither its PRD paragraph nor its PCGen row has them, and no permitted source in the repository does (`isr_abilities_race.lst:197` only re-pages the row). The trait therefore **stays held** under `racial-traits-399-whole-content-eNIYJNbM6UL7OdyE`, with that specific reason ([racial-traits-399.md](racial-traits-399.md)).

Human's assessment stays confirmed (its binding is unchanged apart from the rewritten evidence), and Human is **dependently omitted** (`Dependent omission: pf1-content/eNIYJNbM6UL7OdyE.`). It admits with no re-review once that trait's assessment is confirmed and its body is unchanged. Human's other traits (+2 to One Ability Score, Skilled, Bonus Feat) stay admitted. Admitted records are now 23. The bounded preview gives 23 admitted, 1 held and 1 dependent omission; the full corpus gives 154 / 23,652 / 167 / 1,761. Nothing else moved.

## S4-B launch: Half-Elf, Elf, Gnome and Halfling

Reviewed 2026-11-01 by **Sol (AI curator) for the owner** under discriminator #328 (S4-B, the CRB core races launch closure). The four races, their 31 standard Racial Traits (owned by #387–#405) and the local ability score traits of Elf, Gnome and Halfling were compared in full. **30 traits are admitted**, each on a confirmed, content-bound Attribution Assessment. **Gnome and Halfling are confirmed but dependently omitted** on records their bodies link, and so are Gnome Magic and the two races' local ability score traits. **Elf and Half-Elf stay held** on their male base weight; the Elf's local ability score trait follows the Elf ([Step B](#step-b-elf-and-half-elf-male-base-weight) later corrects the weight and confirms both). The other races and every reverse dependent (alternates, feats and traits naming these races) keep their holds.

| Key                    | Race     | Outcome                        | Closure                                    | Required notices          | Evidence                    |
| ---------------------- | -------- | ------------------------------ | ------------------------------------------ | ------------------------- | --------------------------- |
| `pf1/cCepRrfH5SalFfT4` | Half-Elf | held (male base weight)        | 10 (race + 8 traits + Skill Focus)         | PZO1110, PZO1121, PZO9280 | `race-328-cCepRrfH5SalFfT4` |
| `pf1/NgIhxRI0axrf3fcO` | Elf      | held (male base weight)        | 14 (race + 6 traits + local + 6 weapons)   | PZO1110, PZO1121, PZO9280 | `race-328-NgIhxRI0axrf3fcO` |
| `pf1/efwHEwjvL9Z94MJI` | Gnome    | confirmed, dependently omitted | 16 (race + 10 traits + local + 4 cantrips) | PZO1110, PZO1121, PZO9280 | `race-328-efwHEwjvL9Z94MJI` |
| `pf1/Hf31mrYb3uucNyLO` | Halfling | confirmed, dependently omitted | 10 (race + 7 traits + local + Sling)       | PZO1110, PZO1121, PZO9280 | `race-328-Hf31mrYb3uucNyLO` |

The confirmed Gnome and Halfling assessments bind their own evidence and #740's `race-740-extraction-<id>` evidence, and drop #740's conclusion reference, as S4-A did. The held Elf and Half-Elf keep their evidence set and the conclusion reference. The `reassessment` blocks and `assessmentHistory` are unchanged. The per-trait evidence is in the touched `racial-traits-<n>.md` reports and their inventories.

### The weight holds (Elf, Half-Elf)

Superseded by [Step B](#step-b-elf-and-half-elf-male-base-weight), which carries the correction through the reviewed description corrections.

The owner decided on 2026-11-01 to correct the two male base weights to PCGen's values ("Correct to PCGen"). No curation record can yet carry a reviewed correction into race-body text: overlay outputs are Modifiers, Notes and Item Ability mechanics, and structure records are not applied to Foundry entries. So root queued the importer change that lets a reviewed correction reach race-body text as a separate code slice, and S4-B keeps both races held, with no note-only correction. Each hold stays `race-328-whole-content-<id>`, now with this specific reason as its rationale and `missingEvidence`:

- **Elf:** "Male | 5 ft. 4 in. | +2d8 in. | 110 lbs. | +(2d8×3 lbs.) (116 – 158 lbs.)" (pinned `packs/races/elf.NgIhxRI0axrf3fcO.yaml:53-56`); PCGen `core_essentials/races/elf/elf_biosettings.lst:10` has `BASEWT:100`, so the row should read 100 lbs. (106 – 148 lbs.).
- **Half-Elf:** "Male | 5 ft. 2 in. | +2d8 in. | 100 lbs. | +(2d8×5 lbs.) (110 – 180 lbs.)" (pinned `half-elf.cCepRrfH5SalFfT4.yaml:42-45`); PCGen `half_elf/halfelf_biosettings.lst:12` has `BASEWT:110`, so it should read 110 lbs. (120 – 190 lbs.).

The ARG supplement page is not cited for weight. Every other section of both bodies is compared and matches (below), so neither race needs re-review of those sections once the corrected row is bound. Once the hold clears, the Half-Elf admits (Skill Focus is admitted); the Elf is dependently omitted until its six linked weapons are admitted (Longsword #429, Rapier #426 and Shortbow #425 are curation-reachable; Longbow #427, Composite Longbow #428 and Composite Shortbow #426 are owner-owed).

### Dependent omissions (Gnome, Halfling)

- **Gnome** and **Gnome Magic** link Dancing Lights (#546), Ghost Sound (#535), Prestidigitation (#525) and Speak with Animals (#527), held in their own batches. They are curation-reachable (#735 policy); no slice is scheduled.
- **Halfling** links the Sling (#428). Its hold is **owner-owed**: the body is untraced and carries Ranged Tactics Toolbox (PZO9452) text, which has no Registry identity and whose confirmation is `own-line-missing`. The owner decided on 2026-11-01 to record it as a hold until the PZO9452 Section 15 text is supplied (`launchReview.dependentOmission.ownerOwed` on the Halfling).

Each admits with no re-review once its dependencies are admitted and its body is unchanged. The local ability score traits follow their race.

### Race bodies

Each body was compared section by section (`launchReview.body` in the inventory):

- **Starting age.** The adulthood and the three dice match the PRD supplement `prd-supplement-2026-10-31` (`advancedRaceGuide/ageHeightWeight.html`, role `ageTables`): Elf `:355` (110 years, +4d6/+6d6/+10d6), Gnome `:356` (40, +4d6/+6d6/+9d6), Half-Elf `:357` (20, +1d6/+2d6/+3d6), Halfling `:359` (20, +2d4/+3d6/+4d6). The three class-group footnotes are `:398-400` word for word. PCGen's biosettings agree (Elf `:9`/`:11`, Gnome `:10`/`:12`, Half-Elf `:11`/`:13`, Halfling `:13`/`:15`).
- **Height and weight.** These cite PCGen's `core_essentials/races/{elf/elf,gnome/gnome,half_elf/halfelf,halfling/halfling}_biosettings.lst` (Elf `:10`, Gnome `:11`, Half-Elf `:12`, Halfling `:14`), cell by cell: base height, the height die, base weight and the `TOTALWT` multiplier (×3 Elf, ×5 Half-Elf, ×1 Gnome and Halfling). Gnome and Halfling match in every cell; Elf and Half-Elf match in every cell but the male base weight. The supplement's `:461-470` agree with PCGen but are corroboration only, never cited.
- **Bracketed ranges.** All 28 (12 age, 16 height and weight) are Foundry's arithmetic from its own base values and dice; each was recomputed and matches, including the two conflicting rows, whose ranges follow Foundry's 110 and 100. They are recorded as derived values, never holds.
- **Trait lines** against the ARG race pages (`halfElves.html:364-373`, `elves.html:364-372`, `gnomes.html:366-377`, `halflings.html:364-372`). The recorded differences: Elf, Gnome and Halfling's "They gain +2 …" sentence restating the ARG heading's scores; "thus" in the Elf and Gnome Size lines and the Gnome's "-1" for "–1"; Foundry's capitalised spell labels in the Gnome Magic line. The Type lines have no ARG paragraph; they follow the Inner Sea Races block and match the structured creature types.
- **Judgement 3 (Gnome).** The Languages line adds "See the Linguistics skill page for more information about these languages." (`gnome.efwHEwjvL9Z94MJI.yaml:71`), absent from `gnomes.html:377`. It is a Foundry navigation pointer that states no rule, recorded as a Foundry-only line like the trait headers. **Please check this judgement.**
- **References.** The bodies' pf1e-rules journal links stay text (#738); their catalog links (Skill Focus, the Elf weapons, the Sling, the cantrips) are the closures above.

### Traits

My own word comparison (`compare.py` over each pinned body, its PRD ARG paragraph and its PCGen Core Essentials DESC) gives 20 exact and 11 lexical differences; it reproduces every recorded `prdComparison` except Gnome Magic's, where my tokenizer splits "+1" and the "1/day—" dash differently (the wording differences are the same). No trait adds an entitlement its comparisons lack. Two judgement calls, both lexical and **flagged for the reviewer**:

1. **Defensive Training (Gnome)** reads "monsters of the giant type" where the ARG and PCGen read "subtype". Giant is a subtype, the Gnome's own race body says "giant subtype", and the target is the shared `giants` Situation the Gnome note and Defensive Training (Dwarf) use. Confirmed, difference recorded.
2. **Gnome Magic** reads "the gnome's character level" where the ARG and PCGen read "the gnome's level"; for a character these are the same number. Confirmed; it stays dependently omitted.

Notices: every trait keeps its cited books (PZO9280, PZO1121, PZO1110); the three Low-Light Vision traits keep PZO1112 and Gnome Magic keeps PZO1131. Every batch notice hold on these rows is cleared (`notice-clearances.json`) or waived by the PZO9280 confirmation. Elven Immunities (Elf) opens the new inventory `racial-traits-405.json`; the other eight new keys extend #402–#404.

### Notices

- **PZO1110** stays (each record's own citation).
- **PZO1121** (the ARG age class groups and trait paragraphs) is added. Its Registry notice is reviewed, and its hold `notice-264-complete-chain-457075…` is cleared (`notice-clearances.json:1419`, owner 2026-10-30).
- **PZO9280** (the Inner Sea Races trait block and wording) is added. Its reviewed confirmation `section15-confirmations-716.json#PZO9280` waives `race-328-notice-PZO9280`.

The inventory-level `noticeRequirements` rows stay as history. No legal file changes.

### Mechanics

- **Grants.** Each race's `detail.racialTraits` equals its ARG list less size and speed. Half-Elf and Elf are Medium; Gnome and Halfling are Small, and no trait repeats the size modifiers.
- **Half-Elf.** `ability.$choice` from +2 to One Ability Score; Elf Blood sets `countsAsRaces` to Elf and Human; Multitalented gives `favoredClassCount` 2; Adaptability a feat slot at 1st level limited to Skill Focus; Keen Senses +2 racial Perception.
- **Elf.** +2 Dex, +2 Int and −2 Con through the local trait; Weapon Familiarity grants Longbow, Longsword, Rapier and Shortbow (the composite bows match no pinned base type and stay prose, #720); Elven Magic +2 racial caster level vs spell resistance and +2 racial Spellcraft to identify magic items.
- **Gnome.** +2 Con, +2 Cha and −2 Str; Hatred +1 attack in two local Situations; Defensive Training +4 dodge AC in `giants`; Illusion Resistance +2 racial saves in `illusions`; Gnome Magic +1 `spellDC` in school illusion, which the sheet resolves (`character-sheet-spellcasting.ts:409-413`); Obsessive has no Modifier, so no Craft or Profession skill gets a default.
- **Halfling.** +2 Dex, +2 Cha and −2 Str; Halfling Luck +1 racial on all saves; Fearless +2 racial in `fear`, which stacks with it (+3 in a fear Situation); Sure-Footed +2 racial Acrobatics and Climb; Weapon Familiarity grants Sling.
- **Race notes.** The race note records (Elf 3, Gnome 3, Half-Elf 1, Halfling 1) are re-homed onto Elven Immunities, Elven Magic, Defensive Training, Illusion Resistance, Hatred and Fearless; no race carries a Modifier of its own. The import report lists `overlaps: []`, `latentOverlaps: []`, `ownerlessModifiers: []` and `staleNotes: []` for all four.

**Outstanding, never holds** (`mechanicsReview.outstanding`, replacing the pre-#719/#720 text):

- speed and both Slow Speeds (#740; owner 2026-10-31, "prose is fine for now");
- "treat … elven/gnome/halfling weapons as martial" (#740), and composite bow proficiency (#720);
- Obsessive's chosen Craft or Profession skill: the sheet cannot take the choice yet (#740);
- low-light vision, languages, Elven Immunities' sleep immunity, and Gnome Magic's spell-like abilities and uses per day (permitted prose).

### Curation records

The batch adds nine checked description records with `outputs: []`, one per candidate of #402–#405 the ownership sweep needs: Elven Immunities (Half-Elf), +2 to One Ability Score (Half-Elf), Fearless (Halfling), Elf Blood, Multitalented, Sure-Footed, Adaptability, Slow Speed (Halfling) and Elven Immunities (Elf). The curated full-corpus preview's 23,630 entries are byte-identical to the base preview's (SHA-256 `bd4d2839…` both), so no content binding anywhere moves: no feat inventory (`feats-334…366`), `protected-context.json` fixture or Fey Boon closure. Every existing assessment among the 35 keeps its content fingerprint. `cross-batch-bindings` passes. No other record changed.

### Previews

| Preview                       | Admitted      | Held             | Dependent omissions | Failures                        |
| ----------------------------- | ------------- | ---------------- | ------------------- | ------------------------------- |
| Bounded, 35 keys              | 29            | 3                | 0                   | 6 (out-of-selection references) |
| Bounded, 47 keys (+12 linked) | 31            | 14               | 5                   | 0                               |
| Full corpus, base `62ed9179`  | 154           | 23,652           | 167                 | 1,761                           |
| Full corpus, S4-B             | **184** (+30) | **23,617** (−35) | **172** (+5)        | 1,761 (identical, key for key)  |

The newly admitted records are exactly the 30 traits above (31 less Gnome Magic). The new omissions are Gnome, Halfling, Gnome Magic and the Gnome's and Halfling's local ability score traits. Only the Elf, Half-Elf and the Elf's local trait changed their held reason.

### Launch inventory

The notice authority was regenerated with S1's procedure: `noticeAuthoritySha256` `574de658…` → `2fdb82a8…`. `catalog:launch-inventory --write`, then `--check`, pass.

- **Identity:** `sha256:2cb0f526…` → `sha256:6516936f7f82f2be41fcfc8f6381ecde1815ec072fb1063765ce9ee2a8798853`.
- **Rows:** 19,267, unchanged; required notices stay at 70; inventory errors 0.
- **Failures:** 99,209 → **99,140 (−69)**. These are exactly the holds the required rows dropped: 21 required trait rows lose their whole-content and notice-chain holds (3 each, 4 for the three Low-Light Vision traits and Gnome Magic), and Gnome and Halfling lose `race-328-whole-content-<id>` (each keeps #740's launch hold). The optional Slow Speed (Gnome) row dropped 3 more, which don't count. Elf and Half-Elf rows are unchanged.
- **Inputs:** +1 (`racial-traits-405.json`, 180 → 181); 15 inventory hashes change.
- **Edges:** −27/+35. The nine new trait keys' 27 source-metadata edges now cite their inventories, and the four races gain PZO1121 and PZO9280 edges (+8).

The other scope files decode identically. Only `launch-document.test.ts` moved; `release-scope.test.ts` did not.

### Preservation

New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `e8ee5343`: **4** (pcgen 4).

S4-B adds four PCGen files to the shared store, byte-identical at `25523dbc`: `core_essentials/races/{elf/elf,gnome/gnome,half_elf/halfelf,halfling/halfling}_biosettings.lst`. Their hashes are in `races-328.json` `comparisonSources`. The nine new trait records are not added (the brief keeps them out of the store), so `racial-traits-40{2,3,4,5}.test.ts` check their bytes against the pinned pf1-content checkout when it is present. S4-A's and S4-B's counts stay as plain text, so this report keeps the single marker pair prep fills (Step B, below).

### Tests

- `races-328.test.ts` covers 75 held rows, 2 admitted and 3 dependently omitted (Human, Gnome, Halfling). It adds an S4-B gate over the four closures (`tests/fixtures/races-328/s4b.json`, 50 entries), the body comparisons (cells, the two conflicts and the 28 derived ranges) and isolated-sheet resolver checks; the S4-A rows are unchanged.
- The 11 touched `racial-traits-<n>.test.ts` move to the confirmed rows; 397, 398 and 401 gain the `assessedTraits` fixture split, and every touched fixture tree now pins the linked content of assessed rows. The uncleared-holds controls move from S4-B keys to Duergar Immunities (#397) and Orc (#401); `racialTraits387.integration`'s release control moves to Fast Swimmer (Locathah), and `racialTraits391.integration` expects Weapon Familiarity (Elf) admitted.
- `racial-traits-40{2,3,4}.test.ts` widen to the new rows (Adaptability's Skill Focus closure in #404); new `racial-traits-405.test.ts`.

## Step B: Elf and Half-Elf male base weight

Reviewed 2026-11-01 by **Sol (AI curator) for the owner** under discriminator #328 (description corrections Step B). The owner decided on 2026-11-01 to correct the Elf and Half-Elf male base weights to PCGen's values ("Correct to PCGen", the decision S4-B held both races on). The [reviewed description corrections](curation.md#reviewed-description-corrections) now carry it: four plain-text rows in `scripts/catalog/reviewed-description-corrections.ts`, each bound to its race's raw description hash. **The Half-Elf is admitted.** **The Elf is confirmed but dependently omitted** on its six held weapons, and its local ability score trait follows it.

| Key                    | Race     | Rows (`from` → `to`)                                             | PCGen                                 | Outcome                        |
| ---------------------- | -------- | ---------------------------------------------------------------- | ------------------------------------- | ------------------------------ |
| `pf1/NgIhxRI0axrf3fcO` | Elf      | `110 lbs.` → `100 lbs.`; `(116 – 158 lbs.)` → `(106 – 148 lbs.)` | `elf/elf_biosettings.lst:10`          | confirmed, dependently omitted |
| `pf1/cCepRrfH5SalFfT4` | Half-Elf | `100 lbs.` → `110 lbs.`; `(110 – 180 lbs.)` → `(120 – 190 lbs.)` | `half_elf/halfelf_biosettings.lst:12` | confirmed, **admitted**        |

- **The arithmetic.** Elf: `BASEWT:100`, `HTDIEROLL:2d8` (2…16), `TOTALWT:BASEWT+(HTDIEROLL*3)`, so 100 + 2…16 × 3 = 106 – 148. Half-Elf: `BASEWT:110`, `HTDIEROLL:2d8`, `TOTALWT:(BASEWT+(HTDIEROLL*5))`, so 110 + 2…16 × 5 = 120 – 190. The multiplier cells (`+(2d8×3 lbs.)`, `+(2d8×5 lbs.)`) already match PCGen and stay unchanged. The rows' evidence cites the PCGen line and the owner decision; the ARG supplement is not cited for weight.
- **Plain text only.** Each span is the value inside one `<td>` or `<p>` text node, so the module's raw, sanitized and grammar checks accept it; no row was refused and the validator is unchanged.
- **Only the two descriptions change.** Across the full corpus, the curated preview's 24,168 entries and resources equal the base preview's except the Elf's and Half-Elf's `description` (SHA-256 of all other rows `866dbbf5…` on both sides). The description curation record, the re-homes, the Elf's ability-trait line and the inventory hashes keep reading the raw body.
- **Re-binding.** Each race's content fingerprint moves (Elf `b3a89bdd…` → `9449f885…`, Half-Elf `ea7e6582…` → `0ee8b153…`). No other assessment's content closure reaches either race, so no other binding moves. Both assessments are re-bound with `buildAssessmentBinding` over the full preview and confirmed. As S4-A's and S4-B's confirmed races did, they bind their own and #740's extraction evidence and drop the #740 conclusion reference; `assessmentHistory` keeps the original review last. `tests/fixtures/races-328/s4b.json` carries the two corrected entries.
- **The weight hold** `race-328-whole-content-<id>` is dropped on both, superseded by `launchReview.correction` (the rows, the pinned and imported male rows, the PCGen line and arithmetic, and the decision). `launchReview.body` keeps Foundry's pinned cell next to the imported one: the conflicting cell gains `imported` (PCGen's value), and the male weight range gains `imported` (the range recomputed from PCGen's base weight).
- **Other holds, judged normally.** The Half-Elf's 8 traits are admitted and Adaptability's Skill Focus is admitted, so nothing else holds it. The Elf links Longsword (#429), Rapier (#426) and Shortbow (#425), curation-reachable, and Longbow (#427), Composite Longbow (#428) and Composite Shortbow (#426), owner-owed; it admits with no re-review once they are admitted (`launchReview.dependentOmission`).

### Previews

| Preview                      | Admitted     | Held            | Dependent omissions | Failures                       |
| ---------------------------- | ------------ | --------------- | ------------------- | ------------------------------ |
| Full corpus, base `46ea113b` | 184          | 23,617          | 172                 | 1,761                          |
| Full corpus, Step B          | **185** (+1) | **23,614** (−3) | **174** (+2)        | 1,761 (identical, key for key) |

Exactly three records move: the Half-Elf is admitted, and the Elf (`Dependent omission:` its six weapons) and its local ability score trait (`Dependent omission: pf1/NgIhxRI0axrf3fcO.`) are omitted.

### Launch inventory

The notice authority was regenerated with S1's procedure (`noticeAuthoritySha256` `2fdb82a8…` → `16fef50f…`); `catalog:launch-inventory --write`, then `--check`, pass.

- **Identity:** `sha256:6516936f…` → `sha256:e018555c5833f058cb82a5ffc9686e24cb6daa4da7b1faae89dcc1b3ffa7fb67`.
- **Rows:** 19,267; required notices 70; inventory errors 0.
- **Failures:** 99,140 → **99,138 (−2)**: the Elf and Half-Elf rows each drop `race-328-whole-content-<id>` and keep #740's launch hold, as S4-A's Dwarf and S4-B's Gnome do. The Elf's local trait row keeps its one #740 hold.
- The three rows' admission evidence and the notice inputs (`races-328.json`'s hash) are the only other changes.

### Preservation

<!-- prep:shared-store-count -->
New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `46ea113b`: **2** (pf1 2).
<!-- /prep:shared-store-count -->

Step B adds two pf1 files to the shared store, byte-identical at `418761d2`: `module/chat/text-enrichers.mjs` and `module/utils/lib.mjs`. The corrections test compares the module's copied enricher grammar with them.

### Tests

- `reviewed-description-corrections.test.ts`: the production table holds the four rows with PCGen and the owner decision in their evidence; each race's rows equal PCGen's pinned base weight and the range base + 2…16 × multiplier; `mapEntry` imports each race with the corrected weight and nothing else changed; and "the copied enricher grammar equals the pinned PF1 v11.11 text enrichers and inline roll, pattern for pattern". The derived-texts test now pins its own tables.
- `races-328.test.ts`: 73 held, 3 admitted (Dwarf, Half-Elf, Half-Orc) and 4 dependently omitted (Elf, Gnome, Halfling, Human); the S4-B gate admits the Half-Elf and omits the Elf and its local trait; the body comparison checks the imported cells and ranges and `launchReview.correction`.

## Timing and workflow observations

Approximate phase windows on 2026-10-07 (UTC; concurrent work overlaps):

| Phase                                                    | Window      | Elapsed    |
| -------------------------------------------------------- | ----------- | ---------- |
| Brief, policy and source-contract review                 | 08:18–08:25 | 7 minutes  |
| Initial curation, tooling, attribution and fixtures      | 08:20–08:34 | 14 minutes |
| Commands, test diagnosis and validation                  | 08:23–08:57 | 34 minutes |
| Report, independent audit and final Situation correction | 08:29–08:57 | 28 minutes |

Overall elapsed time was about 39 minutes. These phase windows overlap and must not be added. The final audit/rebinding and independent CLI repetition account for 08:48–08:57; the full-suite attempts account for much of the validation window.

Before a continuous curation lane:

- The drafter lacked the brief's bounded selection and enforced limit. The only tooling implementation change adds `--candidates` to the drafter and preview, rejects empty/duplicate/unknown/oversized selections, retains excluded folder accounting and enforces the three-class limit. Fourteen command tests cover the boundary. No application calculator, UI, schema or backend function is changed.
- The documented trait relocation/proficiency pipeline is ahead of this importer's actual output. Treat these concrete missing calculations as mechanics work, even while content is legally held. The all-key inventory prevents races without note/description triggers from silently counting as complete.
- Small selected outputs still read and verify the complete checkouts. A bounded preview can fail valid out-of-batch links; use the full artifact for content-closure binding and distinguish its genuine reference failures. No dependency is silently admitted or sanitized away to obtain a green gate.
- Curation can pass required notes while optional prose still has unresolved supported mechanics. The 43 diagnostics must remain visible in release-readiness reporting. Unmodeled prose and missing promised calculations are different outcomes.
- Notice-line review, product-code identity and a complete book chain are different evidence. No broad superset, name match or existing primary-source citation cleared these holds. Resolve the named book/content comparisons before expecting admitted-race demonstrations.
- Tests of missing assessments must supply their own empty evidence bundle; a growing default catalog cannot remain an empty fixture. Keep heavy full-suite testing separate from other commands and bound worker concurrency on a shared machine: this session still observed high host load after its own other commands ended. Retain the worktree-local CommonJS `TMPDIR` setup established in #264.
- The repository's requested Opus/Fable model aliases were unavailable in this environment. Implementation and tests were delegated using the available inherited model; review metadata follows the pilot's required curator identity.

All changes remain uncommitted, as required by the pilot brief. Reviewed artifacts are placed in the workflow's repository locations; nothing was pushed, published or deployed, and no issue or PR was changed. Existing 34 assessments and three evidence records were preserved. Independent verification checked every one of the 82 pinned source hashes, all 80 zero-HD imported definitions and the scope/status of all 87 overlay records. Scratch outputs were removed after recording the results. The launcher captures the final response at its `-o` path; no answer file is created in the repository.
