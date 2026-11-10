# Racial traits #400: pf1-content pf-racial-traits batch 14

Reviewed by **Opus (AI curator) for the owner**, 2026-10-21.

Exactly the issue's 100 ordered, unique keys were reviewed: **0 admitted, 78 specifically held, 0 dependent omissions, 0 whole-entry unsupported/prose-only dispositions, 22 exclusions, 0 record-level 3.5 holds**. The exclusions are 10 Foundry `!folders!` records, which the importer's folder contract leaves out of the Catalog Entries (PRD Decision 17), and 12 records in the Advanced Race Guide Race Builder subtree, which the import contract excludes by folder ancestry ([README](README.md), explicit exclusions) and the [Racial Trait contract](../character-sheet/racial-traits.md) puts out of scope. No candidate carries a `3.5` tag. The 78 in-scope records are 32 standard racial traits (7 of them in flat race folders), 36 alternates (Lavasoul (Magma Ifrit) among them: a flat-folder record with a "Replaced Trait(s)" header, read as an alternate as #396 read Sunsoul), 5 Subrace Standard heritage parts and 5 Subraces-folder heritages or racial subtypes.

The [machine-readable inventory and evidence](../../scripts/catalog/legal/racial-traits-400.json) records, per key, the complete pinned body and inert fields with their source hash and cited sources; the PCGen race-ability rows, PRD Advanced Race Guide paragraphs, leads and rejected rows; the inherited-rule notices with their evidence, the linked bodies and the unresolved origins; the importer's reading of race, standard flag and replacements; every checked curation record, source discrepancies and calculation gaps; and the current assessment binding and mapped facts. This report summarizes them and does not repeat the evidence.

## #328 S4-B launch update

Reviewed 2026-11-01 by **Sol (AI curator) for the owner** ([races-328.md](races-328.md#s4-b-launch-half-elf-elf-gnome-and-halfling)). The S4-B launch review confirms 1 standard racial trait of Half-Elf, Elf, Gnome and Halfling with content-bound assessments; counts are now **3 admitted, 75 held**, with 22 exclusions unchanged. The earlier Opus review of each row stays in its `assessmentHistory`; every other candidate keeps its review and holds.

- **Low-Light Vision (Gnome)** (`pf1-content/ikQ2BoHJlx4zYGvB`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/gnomes.html:369`) word for word; PCGen's Core Essentials row (`gnome/gnome_abilities_race.lst:21`) word for word. Low-light vision stays readable. Required notices: PZO9280, PZO1121, PZO1112, PZO1110. Outstanding: Low-light vision is permitted prose; no sense statistic.

Each row's whole-content hold ("Book PDFs unavailable") is superseded by this comparison, and it records no notice hold: PZO1110 is reviewed, PZO1121's Registry hold and `racial-traits-400-notice-PZO1121-complete-chain` are cleared (`notice-clearances.json`, owner 2026-10-30), and PZO9280's reviewed confirmation waives `racial-traits-400-notice-PZO9280-complete-chain`; the PZO1112 (low-light vision) and PZO1131 (Unchained action costs) batch holds are cleared too. The batch's `noticeRequirements` rows keep these keys as history. Content fingerprints are unchanged (the imported entries are identical); only the status, rationale, evidence and notice bindings move.

Tests: `racial-traits-400.test.ts` checks the confirmed rows with the held ones (`assessedTraits` in the fixture), expects them admitted by the committed gate and records no hold for them.

## #328 S4-A launch update

Reviewed 2026-11-01 by **Sol (AI curator) for the owner** ([races-328.md](races-328.md#s4-a-launch-human-dwarf-and-half-orc)). The launch review admits 2 standard racial traits of Human, Dwarf and Half-Orc with confirmed, content-bound assessments; counts are now **2 admitted, 76 held**, with 22 exclusions unchanged. The earlier Opus review of each admitted row stays in its `assessmentHistory`; every other candidate keeps its review and holds.

- **Languages (Half-Orc)** (`pf1-content/iB5aNUyJPWjxx3tx`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/halfOrcs.html:375`) apart from an added "languages"; PCGen's Core Essentials row (`half_orc/halforc_abilities_race.lst:26`). Languages (Common and Orc; the bonus-language list) stay readable prose; the record's languages field stays in gameContent. Required notices: PZO9280, PZO1121, PZO1110. Outstanding: Languages are permitted prose; no language statistic.
- **Defensive Training (Dwarf)** (`pf1-content/iBCPIWFExt679Zhh`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/dwarves.html:364`) apart from "get" for "gain"; an added "their"; PCGen's Core Essentials row (`dwarf/dwarf_abilities_race.lst:22`). Its Modifier is +4 dodge AC in the shared Situation giants, re-homed from the Dwarf's checked note record. Required notices: PZO9280, PZO1121, PZO1110.

Each admitted row's whole-content hold ("Book PDFs unavailable") is superseded by this comparison, and it records no notice hold: PZO1110 is reviewed, PZO1121's Registry hold is cleared (owner, 2026-10-30), and PZO9280's reviewed confirmation waives `racial-traits-400-notice-PZO9280-complete-chain`. The batch's `noticeRequirements` rows keep these keys as history. Content fingerprints are unchanged (the imported entries are identical); only the status, rationale, evidence and notice bindings move.

Tests: `racial-traits-400.test.ts` checks the admitted rows with the held ones (`assessedTraits` in the fixture), expects them admitted by the committed gate and records no hold for them. Defensive Training (Dwarf)'s recorded unresolved origin (creature subtype rules) is resolved: the body only names the giant subtype as its bonus's target, as the Core Rulebook's own text does, so no further book is required (`resolvedOrigins`).

## Family rulings applied

This batch follows the #387 rulings Sol approved for the family:

1. **Every in-scope record is held** with a whole-content hold: the race records stay held (#328), every cited book's notice chain is held (36 batch notice holds, registered in `held-notices.json`, among them `racial-traits-400-notice-primitive-human-blog-complete-chain` for the Paizo blog source of Languages (Primitive Human), as #389 and #399 held it), and no book PDFs are available.
2. **Race abilities.** Every record requires the books its pinned race record cites.
3. **Alternate framework.** Every alternate records the APG alternate racial trait rule (PZO1115, `apg_abilities_race.lst:86`).
4. **Monster abilities** take the earliest book the pinned Universal Monster Rules page lists: darkvision PZO1127; low-light vision, energy resistance, spell resistance, amphibious, natural attacks, poison, stench (Powerful Smell) and trample (Underfoot) PZO1112.
5. **Creature types** (outsider and native, humanoid and gnome, the giant subtype) stay named unresolved origins.
6. **PZO1131** for Unchained action-cost metadata anywhere in the bound closure: 19 records (11 on their own actions, 16 through bound bodies, 8 both). The four curated heritages (Qlippoth-Spawn, Devil-Spawn, Lavasoul, Stormsoul) reach their race's standard traits through the race's ability score trait; Intense Curiosity, Toothy and Small Quarter Ally reach Unchained metadata through the trait they replace or link, and Shattered Soul through its linked raise dead and resurrection.
7. **Comparisons.** PCGen race-ability rows from a pinned book the record cites are the `comparison` (32 records); Core Essentials support rows (no SOURCELONG book) are leads whose book is not required; the Tian Xia language rows of Languages (Tengu), the Inner Sea Races rows for other bodies (secret-magic merfolk speed, mostly human ifrit languages) and the heritage parts' parent rows are rejected rows; 18 records have no PCGen row or PRD paragraph and say so as a named root hold. 29 records carry a PRD `prdComparison` from the pinned capture (19 match word for word). Subrace Standard parts take no PRD paragraph. Where the pinned body follows the APG wording (Gift of Tongues, Underfoot, Toothy) the APG row is the comparison and the ARG row a lead; where it follows the ARG (Rock Climber, Master Tinker) the reverse.
8. **Description pass.** Every in-scope record has a checked description record: its reviewed Modifiers plus an entry-level Note with the body (`@Distance` read as feet, "N-foot" before "aura", `@Toggle` controls and "Related buff" lines removed). No body exceeds 4,096 characters.
9. **Racial bonuses from distinct Sources stack**: the resolver test shows Isolated's and the Seascarred heritage part's +2 racial Perception giving +4 together. The #735 admission policies don't bear on this batch (no spells or CRB feats).

## Dispositions

| Key                            | Name                                                | Kind             | Disposition                                                      |
| ------------------------------ | --------------------------------------------------- | ---------------- | ---------------------------------------------------------------- |
| `pf1-content/hGoMGOJhqQPRBkaV` | Alternate                                           | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/hH5x4vPsUUKeymVc` | Inquisitive                                         | alternate        | held: `racial-traits-400-whole-content-hH5x4vPsUUKeymVc`         |
| `pf1-content/hHiUojDYrzRoCwR3` | Multi-Armed (Kasatha)                               | standard         | held: `racial-traits-400-whole-content-hHiUojDYrzRoCwR3`         |
| `pf1-content/hJ17KnzPNXh1xWm2` | Intense Curiosity                                   | alternate        | held: `racial-traits-400-whole-content-hJ17KnzPNXh1xWm2`         |
| `pf1-content/hP6ZbMYnXdVA42E8` | Natural Weapons                                     | standard         | held: `racial-traits-400-whole-content-hP6ZbMYnXdVA42E8`         |
| `pf1-content/hTQmrexaurb1Vu4A` | Wild Forest Kobold                                  | alternate        | held: `racial-traits-400-whole-content-hTQmrexaurb1Vu4A`         |
| `pf1-content/hV2bbHMgni1OCXAg` | Spell-Like Ability (Undine)                         | standard         | held: `racial-traits-400-whole-content-hV2bbHMgni1OCXAg`         |
| `pf1-content/hV6fDydXis2GUFj5` | Poison Minion (Dwarf)                               | alternate        | held: `racial-traits-400-whole-content-hV6fDydXis2GUFj5`         |
| `pf1-content/hYaZXrQBzKotSxMa` | Ganzi Oddity                                        | standard         | held: `racial-traits-400-whole-content-hYaZXrQBzKotSxMa`         |
| `pf1-content/hb38MOrQMrpPM9td` | Low-Light Vision (Strix)                            | standard         | held: `racial-traits-400-whole-content-hb38MOrQMrpPM9td`         |
| `pf1-content/hcKbGDPqcGPbsBty` | Languages (Tengu)                                   | standard         | held: `racial-traits-400-whole-content-hcKbGDPqcGPbsBty`         |
| `pf1-content/hcagqE7fLh67ZCKZ` | Gift of Tongues                                     | alternate        | held: `racial-traits-400-whole-content-hcagqE7fLh67ZCKZ`         |
| `pf1-content/hdKt2LOznE9Dq3Bz` | Caligni                                             | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/hgugkB6LKBczuduh` | Standard                                            | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/hoHML8zQt0Qib7lN` | Slow Speed (Merfolk)                                | standard         | held: `racial-traits-400-whole-content-hoHML8zQt0Qib7lN`         |
| `pf1-content/hpHlEjDVM9x8Fuim` | Rock Climber                                        | alternate        | held: `racial-traits-400-whole-content-hpHlEjDVM9x8Fuim`         |
| `pf1-content/hsso3bR3LTyek5hG` | Deep Delver                                         | subrace          | held: `racial-traits-400-whole-content-hsso3bR3LTyek5hG`         |
| `pf1-content/htWm9bSBUYHvx4SY` | Voice in the Darkness (Half-Orc)                    | alternate        | held: `racial-traits-400-whole-content-htWm9bSBUYHvx4SY`         |
| `pf1-content/huJk8pF1KRKfeWzL` | Saltbeard                                           | alternate        | held: `racial-traits-400-whole-content-huJk8pF1KRKfeWzL`         |
| `pf1-content/hvgsnryqs9MglaYI` | Flighty                                             | alternate        | held: `racial-traits-400-whole-content-hvgsnryqs9MglaYI`         |
| `pf1-content/hxoLQ9KV97O3emnL` | Fleet-Footed                                        | alternate        | held: `racial-traits-400-whole-content-hxoLQ9KV97O3emnL`         |
| `pf1-content/hyluAyDdUizmqorj` | Shattered Soul                                      | standard         | held: `racial-traits-400-whole-content-hyluAyDdUizmqorj`         |
| `pf1-content/i13oyCR6gkLrhRSg` | Healthy                                             | alternate        | held: `racial-traits-400-whole-content-i13oyCR6gkLrhRSg`         |
| `pf1-content/i3JDTzYghUAVE4a2` | Envoy                                               | alternate        | held: `racial-traits-400-whole-content-i3JDTzYghUAVE4a2`         |
| `pf1-content/iB5aNUyJPWjxx3tx` | Languages (Half-Orc)                                | standard         | held: `racial-traits-400-whole-content-iB5aNUyJPWjxx3tx`         |
| `pf1-content/iBCPIWFExt679Zhh` | Defensive Training (Dwarf)                          | standard         | held: `racial-traits-400-whole-content-iBCPIWFExt679Zhh`         |
| `pf1-content/iCIuOvoanh1wZRcl` | Fey Thoughts (Half-Orc)                             | alternate        | held: `racial-traits-400-whole-content-iCIuOvoanh1wZRcl`         |
| `pf1-content/iEAy4KMqEtQnvLHZ` | Heroic                                              | alternate        | held: `racial-traits-400-whole-content-iEAy4KMqEtQnvLHZ`         |
| `pf1-content/iES8aXKMApVmwZad` | Crystal Affinity (Oread - Gemsoul)                  | subrace standard | held: `racial-traits-400-whole-content-iES8aXKMApVmwZad`         |
| `pf1-content/iGw64UpXvwydi1MU` | Explorer                                            | alternate        | held: `racial-traits-400-whole-content-iGw64UpXvwydi1MU`         |
| `pf1-content/iHI1zDebmLg28ZWW` | Master Tinker                                       | alternate        | held: `racial-traits-400-whole-content-iHI1zDebmLg28ZWW`         |
| `pf1-content/iMdXJ73UwSIDDJdk` | Skilled (Tiefling - the Motherless)                 | subrace standard | held: `racial-traits-400-whole-content-iMdXJ73UwSIDDJdk`         |
| `pf1-content/iPSjQFQo6BRxvAf8` | Cat's Claws                                         | alternate        | held: `racial-traits-400-whole-content-iPSjQFQo6BRxvAf8`         |
| `pf1-content/iQe6knrzeShfO3e9` | Standard                                            | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/iSHRZjOWa5TnYKXe` | Underfoot                                           | alternate        | held: `racial-traits-400-whole-content-iSHRZjOWa5TnYKXe`         |
| `pf1-content/iVOuvYYtE9ElfP4C` | Elemental Immunity                                  | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/iWZjiKTQnGS5XnB0` | Qlippoth-Spawn (the Motherless)                     | subrace          | held: `racial-traits-400-whole-content-iWZjiKTQnGS5XnB0`         |
| `pf1-content/iWgQndIpAyjXO7pM` | Powerful Smell                                      | alternate        | held: `racial-traits-400-whole-content-iWgQndIpAyjXO7pM`         |
| `pf1-content/ia8dfirBn7IFLkiD` | Light and Dark                                      | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/idvCM14En8mzfFFX` | Sneaky Rider                                        | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/iejEnNBqCFQ097Eh` | Spell Smasher                                       | alternate        | held: `racial-traits-400-whole-content-iejEnNBqCFQ097Eh`         |
| `pf1-content/ii2SnNaUnihoY5FU` | Orang-Pendak                                        | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/ikQ2BoHJlx4zYGvB` | Low-Light Vision (Gnome)                            | standard         | held: `racial-traits-400-whole-content-ikQ2BoHJlx4zYGvB`         |
| `pf1-content/itT8LM4GOcBNUyoO` | Amphibious (Aquatic Elf)                            | standard         | held: `racial-traits-400-whole-content-itT8LM4GOcBNUyoO`         |
| `pf1-content/iuOrMqm53EkJ4AOt` | Skilled (Duskwalker)                                | standard         | held: `racial-traits-400-whole-content-iuOrMqm53EkJ4AOt`         |
| `pf1-content/iulHWSMNp9TABDDU` | Spell-Like Abilities (Fetchling - Shadow Walk)      | standard         | held: `racial-traits-400-whole-content-iulHWSMNp9TABDDU`         |
| `pf1-content/iuq7CaxD48jDZqT4` | Alternate Skill Modifiers (Skinwalker - Seascarred) | subrace standard | held: `racial-traits-400-whole-content-iuq7CaxD48jDZqT4`         |
| `pf1-content/ivJAVUkb5H0Z20U7` | Energy Resistance (Ifrit)                           | standard         | held: `racial-traits-400-whole-content-ivJAVUkb5H0Z20U7`         |
| `pf1-content/iwAOQlZrKjN1SZLQ` | Hag Racial Trait (Changeling - Waker May)           | subrace standard | held: `racial-traits-400-whole-content-iwAOQlZrKjN1SZLQ`         |
| `pf1-content/ixeSTuEadPDMGyRU` | Drow                                                | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/iy6e5v8YWE9upybn` | Writhing Eye                                        | alternate        | held: `racial-traits-400-whole-content-iy6e5v8YWE9upybn`         |
| `pf1-content/iyFiaSvlanNVhxVS` | Advanced Dexterity                                  | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/izCRmMUEyikdfpiq` | Devil-Spawn (Hellspawn)                             | subrace          | held: `racial-traits-400-whole-content-izCRmMUEyikdfpiq`         |
| `pf1-content/izn5zeobE6jDrIJm` | Languages (Primitive Human)                         | standard         | held: `racial-traits-400-whole-content-izn5zeobE6jDrIJm`         |
| `pf1-content/izvlhYC3B5BZD1Pm` | Alternate                                           | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/j0USUTwobHQmuDq4` | Fiendish Resistance                                 | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/j4ecIXaeic0jtQYV` | Native Outsider (Fetchling)                         | standard         | held: `racial-traits-400-whole-content-j4ecIXaeic0jtQYV`         |
| `pf1-content/j5XYOnvRkSTqKa7N` | Stonecunning (Svirfneblin)                          | standard         | held: `racial-traits-400-whole-content-j5XYOnvRkSTqKa7N`         |
| `pf1-content/jAQXQDgwCX0eKxZ2` | Lavasoul (Magma Ifrit)                              | alternate        | held: `racial-traits-400-whole-content-jAQXQDgwCX0eKxZ2`         |
| `pf1-content/jDnEOgpVQ1Ld53zP` | Tripping Tail                                       | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/jQEHwNadJH7G0gdq` | Human                                               | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/jRIzRS1HEk9YsCLq` | Greater Weakness                                    | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/jSa9JxGJVC80WWZE` | Beast Bond                                          | alternate        | held: `racial-traits-400-whole-content-jSa9JxGJVC80WWZE`         |
| `pf1-content/jTl1H5er8dV64VIV` | Natural Climber (Monkey Goblin)                     | standard         | held: `racial-traits-400-whole-content-jTl1H5er8dV64VIV`         |
| `pf1-content/jXo1JOAbSAm1iC5M` | Storm-Born (Virga May)                              | subrace          | held: `racial-traits-400-whole-content-jXo1JOAbSAm1iC5M`         |
| `pf1-content/jY1SkZ5fM0vMJbgt` | Stonesinger                                         | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/jZdTNIQsmvstAb3Z` | Incorruptible                                       | alternate        | held: `racial-traits-400-whole-content-jZdTNIQsmvstAb3Z`         |
| `pf1-content/jdBudIogNAOvFZ7v` | Languages (Fetchling)                               | standard         | held: `racial-traits-400-whole-content-jdBudIogNAOvFZ7v`         |
| `pf1-content/jfeaqYaSoor0KWpj` | Sylph                                               | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/jh4scMUHyvCGmKas` | Deep Sea Dweller                                    | alternate        | held: `racial-traits-400-whole-content-jh4scMUHyvCGmKas`         |
| `pf1-content/jjAMygLe3WIGpHux` | Swim Speed (Adaro)                                  | standard         | held: `racial-traits-400-whole-content-jjAMygLe3WIGpHux`         |
| `pf1-content/jr8N7NEkdkaKPfX4` | Cleanliness                                         | alternate        | held: `racial-traits-400-whole-content-jr8N7NEkdkaKPfX4`         |
| `pf1-content/jsIag110h3yFKi0q` | Mountaineer                                         | alternate        | held: `racial-traits-400-whole-content-jsIag110h3yFKi0q`         |
| `pf1-content/juKqhjRJHXe3MWHH` | Fleet-Footed                                        | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/jy1bBBwNolQTthr2` | Spell Resistance (Svirfneblin)                      | standard         | held: `racial-traits-400-whole-content-jy1bBBwNolQTthr2`         |
| `pf1-content/jyXw1Kew5Nmh4TyG` | Earth Insight                                       | alternate        | held: `racial-traits-400-whole-content-jyXw1Kew5Nmh4TyG`         |
| `pf1-content/k3BZrtmbJvxCHeHt` | Sky Sentinel                                        | alternate        | held: `racial-traits-400-whole-content-k3BZrtmbJvxCHeHt`         |
| `pf1-content/k47gKmQAEGPPWXYZ` | Languages (Ifrit)                                   | standard         | held: `racial-traits-400-whole-content-k47gKmQAEGPPWXYZ`         |
| `pf1-content/k4mksTEehz2fxN9e` | Exceptional Senses                                  | standard         | held: `racial-traits-400-whole-content-k4mksTEehz2fxN9e`         |
| `pf1-content/kAiZRNeT0r1ZAyz9` | Isolated                                            | alternate        | held: `racial-traits-400-whole-content-kAiZRNeT0r1ZAyz9`         |
| `pf1-content/kBrZffJ7gjRmNQUn` | Desert Stride                                       | standard         | held: `racial-traits-400-whole-content-kBrZffJ7gjRmNQUn`         |
| `pf1-content/kCnWl2gK9Q56djWG` | Spell-Like Ability (Oread - Gemsoul)                | subrace standard | held: `racial-traits-400-whole-content-kCnWl2gK9Q56djWG`         |
| `pf1-content/kD8isApIfN4y1ty0` | Moonkissed                                          | alternate        | held: `racial-traits-400-whole-content-kD8isApIfN4y1ty0`         |
| `pf1-content/kERQ8l5cEhEQb5Zr` | Slow Speed (Ratfolk)                                | standard         | held: `racial-traits-400-whole-content-kERQ8l5cEhEQb5Zr`         |
| `pf1-content/kLPypNzy62fMbj3d` | Stormsoul (Lightning Sylph)                         | subrace          | held: `racial-traits-400-whole-content-kLPypNzy62fMbj3d`         |
| `pf1-content/kMDRTmyXkCtap8r2` | Darkvision (Syrinx)                                 | standard         | held: `racial-traits-400-whole-content-kMDRTmyXkCtap8r2`         |
| `pf1-content/kNLt3RoRdXIdVbDa` | Seasoned Spirit                                     | alternate        | held: `racial-traits-400-whole-content-kNLt3RoRdXIdVbDa`         |
| `pf1-content/kSLjzmV15G3J7RRM` | Poison Resistance                                   | standard         | held: `racial-traits-400-whole-content-kSLjzmV15G3J7RRM`         |
| `pf1-content/kTgoCIh9jQgqDxMM` | Soul Seer                                           | alternate        | held: `racial-traits-400-whole-content-kTgoCIh9jQgqDxMM`         |
| `pf1-content/kVyoToa1vFYZjb1e` | Standard                                            | folder           | excluded: Foundry `!folders!` record (folder exclusion contract) |
| `pf1-content/kZzjvGGwu9wRBgUV` | Languages (Grippli)                                 | standard         | held: `racial-traits-400-whole-content-kZzjvGGwu9wRBgUV`         |
| `pf1-content/kajw0iqeXtEm2sgI` | Toothy                                              | alternate        | held: `racial-traits-400-whole-content-kajw0iqeXtEm2sgI`         |
| `pf1-content/keur3013La2W63M1` | Advanced Strength                                   | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/khLVUk3rOIJkhzJg` | Gnome Subtype                                       | standard         | held: `racial-traits-400-whole-content-khLVUk3rOIJkhzJg`         |
| `pf1-content/kjWHt3PMPkE9wvHf` | Desert Runner                                       | race builder     | excluded: ARG Race Builder subtree (import contract)             |
| `pf1-content/knLKGEKSn337diqs` | Heir to Undying Nobility                            | alternate        | held: `racial-traits-400-whole-content-knLKGEKSn337diqs`         |
| `pf1-content/kqGqKpckxLlm6vJE` | Long-Lived                                          | standard         | held: `racial-traits-400-whole-content-kqGqKpckxLlm6vJE`         |
| `pf1-content/kqSFEBk1ycJ6PG8y` | Small Quarter Ally                                  | alternate        | held: `racial-traits-400-whole-content-kqSFEBk1ycJ6PG8y`         |
| `pf1-content/kraQWc5UXT8nyVER` | Shadowy Resistance                                  | standard         | held: `racial-traits-400-whole-content-kraQWc5UXT8nyVER`         |
| `pf1-content/ktYlZwe8OB9UWJNb` | Prehensile Tail                                     | race builder     | excluded: ARG Race Builder subtree (import contract)             |

## Notable cases

- **Heritage ability lines curated (#387 to #399 precedent).** Qlippoth-Spawn (the Motherless) (+2 Str, +2 Wis, -2 Int) and Devil-Spawn (Hellspawn) (+2 Con, +2 Wis, -2 Cha) agree with PCGen's Core Essentials "<Heritage> ~ Ability Scores" rows (`tiefling_abilities_race_subrace.lst:110` and `:70`); Lavasoul (Magma Ifrit) (+2 Con, +2 Int, -2 Dex) and Stormsoul (Lightning Sylph) (+2 Dex, +2 Cha, -2 Wis) have no PCGen row, as Sunsoul and Smokesoul had. Each is three racial ability Modifiers, and "Base Statistics" resolves to the race's ability score trait, which goes dormant. `race-ability-721` and `racial-traits-719` pin none of the four. Storm-Born (Virga May) keeps its line readable (the virga may's separate Ability Modifiers record carries it) and Deep Delver bundles nothing (racial subtype).
- **Overstated imported change fixed (Wild Forest Kobold).** The body and PCGen `kog_abilities_race.lst:35` give +2 racial Perception and Survival; the upstream record puts one +2 on Stealth. A row in `reviewed-change-replacements.ts` sets the Stealth formula to 0 and the description record supplies +2 racial Perception ([curation.md](curation.md#reviewed-change-replacements)). Only this record's own binding is affected: no landed assessment's closure reaches it.
- **Mistyped imported changes fixed (Gift of Tongues, Master Tinker; fix round 1).** Both bodies give an untyped "+1 bonus" (Bluff and Diplomacy; Disable Device and Knowledge (engineering)), as PCGen `apg_abilities_race.lst:47` and `:49` and the ARG rows do, but Foundry's four changes are typed racial. As for Seasinger (#392), four rows in `reviewed-change-replacements.ts` set the formulas to 0 and each description record supplies the two untyped +1 Modifiers ([curation.md](curation.md#reviewed-change-replacements)). The change re-binds Gear Gnomes (#394), whose closure reaches Master Tinker (see Cross-batch bindings).
- **Race outputs already on the traits (checked against the race outputs first, #391):** Defensive Training (Dwarf) and Poison Resistance (Vishkanya) carry their races' re-homed #328 note records (`coveredTraitNotes`); Skilled (Duskwalker) and Exceptional Senses (Android) carry their races' relocated changes. None gets a second Modifier, and no Modifier is added to a standard trait of a #719 race. No latent overlap names a batch key.
- **Situational bonuses** (manual Situations): Saltbeard (aquatic or water creatures; Profession (sailor) and Survival at sea, untyped as published), Sky Sentinel (flying creatures; +2 dodge on `ac`, untyped Perception), Spell Smasher, Underfoot (+1 dodge on `ac`; untyped Reflex against trample), Intense Curiosity, Voice in the Darkness (Half-Orc) (the label #393 to #397 used), Flighty, Healthy (untyped disease plus the shared poison Situation, as #399 Nosophobia) and Cleanliness (untyped, "against disease"). **Shared Situations:** fear (Small Quarter Ally, your own +1 luck bonus; the allies' bonus stays a Note), mindAffecting (Hag Racial Trait (Changeling - Waker May)) and poison (Healthy).
- **Covered/no-output records (1):** Poison Minion (Dwarf)'s Armor Class note (the poison rule is in the description Note), as #396 did for the gnome.
- **Inherited rules beyond the race:** Heroic the APG hero point system and its linked Blood of Heroes feat, whose pinned record cites no source but which PCGen `apg_feats.lst:273` and feats-361 trace to the APG (PZO1115; the #398 ruling); Incorruptible the APG corruption resistance spell its PCGen ARG row cites; Lavasoul the UM efreeti bloodline and APG Ash subdomain; Stormsoul the APG stormborn bloodline; Crystal Affinity (Oread - Gemsoul) the APG deep earth bloodline; the linked spells', traits' and ethnicities' books (hydraulic push and the Deep Delver bundle PZO1115, burning sands PZO1138, Spiresworn and Segadan PZO9491, Animal-Minded PZO1133, the changeling's Hag Racial Trait PZO1127).
- **Listed for review:** Cat's Claws' weaponProf maps a Claw Blades Proficiency the body doesn't grant (no replacement covers a proficiency field); Saltbeard's "while at sea" applied to both skills where PCGen limits only Survival; Mountaineer leaves Lifebound's save bonuses on the Samsaran race record (see Outstanding mechanics).
- **Not modeled, listed:** senses, speeds, spell-like abilities and other actions (Envoy, Heir to Undying Nobility, Seasoned Spirit, Soul Seer, the sensing vine, the poison aura), energy and spell resistance, natural attacks, immunities, creature types, class-skill grants (Wild Forest Kobold, Flighty, Beast Bond, Fey Thoughts), bonus feats (Fleet-Footed), hero points, aging, four arms, the ganzi oddity table, Explorer's chosen Knowledge skill, languages, the elemental affinities and raising the dead (Shattered Soul).
- **Blog source:** Languages (Primitive Human) cites only a Paizo blog post (custom source), held as #389 and #399 held the other Primitive Human records.

## Importer and data gaps

- **Reference gaps (admission failures in any preview, not curation-dependent):** Amphibious (Aquatic Elf) links the Universal Monster Rules journal page (a #738 journal-link gap); Deep Delver links Stonesinger, a record of the excluded ARG Race Builder subtree, so the importer strips the link and the record fails with "unresolved imported reference". Stonesinger's gap is neither #738 nor #739 and is reported here as its own entry; `tests/catalog/cross-batch-bindings.ts` lists the link among its dangling catalog links.
- **Partial alterations:** Isolated "alters" the oread's languages and Seasoned Spirit "alters" plantspeech; the header names them, so the importer replaces Languages (Oread) and Plantspeech as a whole (#304). Crystal Affinity (Oread - Gemsoul) has no header and its name matches no oread trait, so its replacement stays unresolved (known Subrace Standard behavior).
- No #739 finding, no missing pf-items reference, and the raw upstream keys in `mapRacialTrait` caused no reference failure. Untested cases from the run notes: none in this batch. Orc Atavism and the four uncovered trait notes are not in this batch (Stonecunning (Svirfneblin) links Stonecunning (Dwarf), whose uncovered note stays as it was).

## Outstanding mechanics

Each record lists its calculation gaps in `mechanicsReview.outstandingCalculations`; none is an attribution hold. Beyond the "Not modeled" items above: Explorer's +2 racial bonus on one chosen Knowledge skill (no skill choice for a racial trait); and **Mountaineer**: the Samsaran race's checked #328 description record (`pf1/aQ8RQYKVd2hqI4jh`, reviewed 2026-10-07) carries Lifebound's three bonuses as Modifiers on the race itself: +2 racial on saves under the shared `death` Situation, +2 racial on saves under the shared `negativeEnergy` Situation and +2 racial on Fortitude saves under the local "to remove negative levels" Situation (the import report's three `latentOverlaps` on Lifebound, #395). Mountaineer replaces Lifebound (`detail.replaces` is Lifebound, `pf1-content/TMYYCMogKs454s9n`), but the race's Modifiers stay on the sheet, so a samsaran with Mountaineer totals:

| Bonus (Situation selected)                               | Sheet | Published rules |
| -------------------------------------------------------- | ----- | --------------- |
| Saves against death effects (`death`)                    | +2    | 0               |
| Saves against negative energy effects (`negativeEnergy`) | +2    | 0               |
| Fortitude saves to remove negative levels (local)        | +2    | 0               |

The batch test resolves the race's Modifiers through the public resolver and pins each residual +2. The race record isn't changed here (#744); the overstated bonuses are listed for review.

## Cross-batch bindings and protected records

Curated on `eddbefa1` and rebased onto `21babb10` (#430). Every re-bind uses `buildAssessmentBinding` over the final full `catalog:preview` with this batch's records, with the earlier batch's fixture copies of this batch's keys replaced by the full-preview entries, the inventory `currentBinding` updated and the fixture-based binding checked to agree (all agree). Only the content fingerprints changed; no disposition, evidence, notice or hold changed in the earlier batches. The 46 re-binds are every assessment whose full-corpus closure reaches a batch key and that was fresh on the base (checked with the binding code over the baseline full preview; the final preview's closures reach the same 72 assessments): 2 from pf-buffs-548, 6 from #387, 2 from #388, 3 from #389, 2 from #390, 4 from #391, 2 from #392, 3 from #393, 4 from #394, 2 from #395, 3 from #396, 7 from #397, 2 from #398, 2 from #399, 1 from spells-524 and 1 from traits-367. After the rebase, one #430 assessment re-binds too (see In-flight batches), 47 in all.

| Batch        | Assessment                             | Reaches (this batch)                           | Content fingerprint       |
| ------------ | -------------------------------------- | ---------------------------------------------- | ------------------------- |
| pf-buffs-548 | Iron Within (AC)                       | Defensive Training (Dwarf)                     | `cf9f9a5b…` → `066f9b06…` |
| pf-buffs-548 | Powerful Smell (buff)                  | Powerful Smell                                 | `cf0e5449…` → `bcc16bbd…` |
| #387         | Deep Tradition                         | Defensive Training (Dwarf)                     | `6ece2372…` → `268e5e39…` |
| #387         | Jininese Elves                         | Envoy                                          | `47246392…` → `46ad5195…` |
| #387         | Light from the Darkness                | Incorruptible                                  | `52afb5f8…` → `fecd14d2…` |
| #387         | Ooze Breath                            | Spell-Like Ability (Undine)                    | `b07866e4…` → `5bd35b14…` |
| #387         | Rimesoul (Frost Undine)                | Spell-Like Ability (Undine)                    | `ec6e1d61…` → `3389e45f…` |
| #387         | Spell-Like Ability (Undine - Rimesoul) | Spell-Like Ability (Undine)                    | `28df929c…` → `634c4ac7…` |
| #388         | Boundary Walker                        | Shadowy Resistance                             | `753cd9f0…` → `fb3349ce…` |
| #388         | Nereid Fascination (Undine)            | Spell-Like Ability (Undine)                    | `68521646…` → `c4636398…` |
| #389         | Acid Breath                            | Spell-Like Ability (Undine)                    | `d8800297…` → `20d0f937…` |
| #389         | Deep Warrior                           | Defensive Training (Dwarf)                     | `0f811ec9…` → `dab79637…` |
| #389         | Feral                                  | Toothy                                         | `51164a82…` → `e7e926ca…` |
| #390         | Forlorn Elves                          | Envoy                                          | `1426be24…` → `c92b4a2b…` |
| #390         | Lasting Grudge                         | Defensive Training (Dwarf)                     | `dd41e49c…` → `d4dfc7b4…` |
| #391         | Behind the Veil (Gnome)                | Low-Light Vision (Gnome)                       | `be9b76e3…` → `73a953a2…` |
| #391         | Fosterling                             | Skilled (Duskwalker)                           | `6ca20e78…` → `6afed9c3…` |
| #391         | Strongtail                             | Slow Speed (Merfolk)                           | `b8ccdf92…` → `fb03df7f…` |
| #391         | Wildfire Heart                         | Energy Resistance (Ifrit)                      | `16b0dbfd…` → `554483b0…` |
| #392         | Amphibious                             | Spell-Like Ability (Undine)                    | `f873511e…` → `21a4d3d8…` |
| #392         | Desert Delver                          | Defensive Training (Dwarf)                     | `2b993387…` → `fb12cf72…` |
| #393         | Darkvision (Gnome)                     | Low-Light Vision (Gnome)                       | `c6b57b07…` → `37604780…` |
| #393         | Stoic Negotiator                       | Defensive Training (Dwarf)                     | `63504b49…` → `d0dcdd25…` |
| #393         | Triton Magic                           | Spell-Like Ability (Undine)                    | `b9805e8f…` → `f111bcd7…` |
| #394         | Exiled Dwarf                           | Defensive Training (Dwarf)                     | `2ca100fc…` → `d298bebd…` |
| #394         | Gear Gnomes                            | Master Tinker                                  | `2db9dff2…` → `6f48e1d4…` |
| #394         | Mountain Clan                          | Rock Climber                                   | `afe98ce5…` → `7d99089c…` |
| #394         | Spiresworn Elves                       | Moonkissed                                     | `e4773048…` → `cff511a7…` |
| #395         | Desert Dwarves                         | Defensive Training (Dwarf)                     | `ce57e6d8…` → `adae6a94…` |
| #395         | Trailblazer                            | Heroic                                         | `b416ea7b…` → `9025e423…` |
| #396         | Paraheen Dwarves                       | Saltbeard, Defensive Training (Dwarf)          | `251a4e3b…` → `cb91dab3…` |
| #396         | Sunsoul (Solar Ifrit)                  | Energy Resistance (Ifrit), Languages (Ifrit)   | `0dbaa4b4…` → `9c74d08f…` |
| #396         | Surface Sprinter                       | Slow Speed (Ratfolk)                           | `42b4779b…` → `8334e1db…` |
| #397         | Abandoned                              | Skilled (Duskwalker)                           | `968c0b74…` → `bce2b858…` |
| #397         | Barrow Warden                          | Defensive Training (Dwarf)                     | `68d310ca…` → `82f5714e…` |
| #397         | Mountain Dwarf                         | Defensive Training (Dwarf), Sky Sentinel       | `ed1eb74d…` → `c3e18727…` |
| #397         | Savage Elf                             | Fleet-Footed                                   | `44e09944…` → `34f60090…` |
| #397         | Sky Citadel Dwarves                    | Defensive Training (Dwarf), Sky Sentinel       | `6dce0ca2…` → `8511d99b…` |
| #397         | Slag Child                             | Defensive Training (Dwarf)                     | `858c164a…` → `8fda8c91…` |
| #397         | Snowcaster Elves                       | Fleet-Footed                                   | `c02ce9cb…` → `39f6f1fe…` |
| #398         | Avenging                               | Underfoot                                      | `4f51674f…` → `fbc8597a…` |
| #398         | Umbral Escort                          | Spell-Like Abilities (Fetchling - Shadow Walk) | `7dc7bcb8…` → `205554ad…` |
| #399         | Expanded Oddities                      | Ganzi Oddity                                   | `52503bc2…` → `6da5b9d7…` |
| #399         | Subtle Manipulator                     | Spell-Like Abilities (Fetchling - Shadow Walk) | `0547b3ac…` → `937ad6e3…` |
| spells-524   | Fey Boon                               | Defensive Training (Dwarf)                     | `853b3975…` → `bcb3e50a…` |
| traits-367   | Nanite Revival (Android)               | Exceptional Senses                             | `1a45fb9b…` → `c05959ac…` |
| items-430    | Outfit, Dilettante's                   | Low-Light Vision (Gnome)                       | `bb833804…` → `5c57e773…` |

They are recorded in each batch's inventory `currentBinding` and `tests/fixtures/<batch>/preview.json`; Fey Boon (#524) through its own re-import of `tests/fixtures/spells-524/binding-preview.json` (Defensive Training (Dwarf)'s entry; #524's inventory records no `currentBinding`). `racial-traits-395.json` to `racial-traits-398.json` and their preview fixtures keep their landed `JSON.stringify` layout, so their diff is the re-bind only.

- **Already stale, not re-bound:** 26 assessments that reach batch keys were stale on the base and are unchanged: the #328 race records of the 25 races whose traits are in this batch and Extra Gnome Magic (pf1/yQ06clVxFV6dOjc1).
- **Protected records:** no batch key is a protected root, and none is an entry of any batch's `binding-preview.json` import except Defensive Training (Dwarf) in spells-524's (re-bound above). The #350 to #355 and #530 to #536 `protected-context.json` and the #529 to #536 `preserved.json` name batch keys only as seed, closure and source keys; `feats-355/binding-preview.json` holds five batch keys that no #355 assessment's closure reaches; the #355, #524, #719, #720 and #721 `provenance.json` lists name them only as closure, dependency and source keys. `spells-524`, `feats-355` and `pf-buffs-548` pass with this batch (see Commands).
- **#430 (pf1 items), landed before this batch:** no #430 key is in this batch's closures, so no batch binding changes, and no #430 change touches an assessment this batch re-binds (the shared data merged without conflict). One #430 assessment reaches a batch key: Outfit, Dilettante's (pf1/69OvRQZBk0nhhpAK) reaches Low-Light Vision (Gnome) through the Gnome race. It is re-bound over `tests/fixtures/items-430/preview.json` with that fixture's copy of Low-Light Vision (Gnome) replaced by this batch's full-preview entry (its description Note), with the assessment and the inventory `currentBinding` updated; only its content fingerprint changed, and every other #430 binding still matches over the merged tree. The Wild Forest Kobold change replacement sits after #430's two masterwork-tool replacements in `reviewed-change-replacements.ts`.

## Binding

Every assessment is bound with `buildAssessmentBinding` against the full-corpus content closure: the final full `catalog:preview` artifact, with the batch's 78 entries and their 215 closure entries. The [preview fixture](../../tests/fixtures/racial-traits-400/preview.json) keeps both, so the batch test rebuilds every binding from a clean shared-store tree (0 mismatches). The race outputs relocated or re-homed onto four standard traits are absent from a bounded tree without the race; the test lists them.

## Tests

The [resolver tests](../../tests/catalog/racial-traits-400.test.ts) pin the four curated heritages replacing their race's ability score trait on race identity sheets, every Situation-gated bonus (off by default, on when selected) and its published type, the shared fear, mindAffecting and poison Situations, Wild Forest Kobold's replaced Stealth change and reviewed Perception, the re-homed and relocated race outputs, distinct racial Sources stacking (+4), the imported values not curated twice and no `ac.other` armor, shield or natural armor bonus; all 32 required and 78 description records checked, the covered record and Note targets, the Claw Blades proficiency; the race, alternate, monster-ability, inherited, linked, blog and Unchained notice dependencies (19 PZO1131 keys, own action versus bound body), every hold registered; the importer reading of races and replacements; the literal PCGen and PRD evidence in the shared store; and a clean-tree re-extraction that keeps every record held on its own hold, except the two reference gaps that fail admission.

The [isolated saved-sheet test](../../tests/catalog/racialTraits400.integration.test.ts) exercises public Convex reads and writes: a tiefling-identity race granting its ability score trait and Skilled takes the held Qlippoth-Spawn (the Motherless) (Strength and Wisdom 12, Dexterity 10, Intelligence 8, Charisma 10; Bluff, Stealth, Escape Artist and Survival follow) and Skilled (Tiefling - the Motherless) (Skilled's Bluff and Stealth bonuses go dormant, Escape Artist and Survival +2), then turns both off again, with saved totals equal to the preview; outsiders, anonymous callers and another campaign's entry are refused without changing the sheet. The shared held-release round trip is covered once by the release test in [`traits367.integration.test.ts`](../../tests/catalog/traits367.integration.test.ts).

## Preservation and gates

The shared canonical files gain only this batch's entries: 110 curation records (78 description and 32 note records), 78 assessments, 78 evidence entries and 36 notice holds. The other changes are the 47 listed re-binds (content fingerprints only) with their `currentBinding` and fixture copies, the Wild Forest Kobold change replacement with its curation.md paragraph, and the Stonesinger dangling link in `cross-batch-bindings.ts`. Shared-file diff stat against `21babb10` (`git diff --stat HEAD`; the shared store and this batch's own new files excluded):

```text
 docs/catalog-import/curation.md                   |    2 +
 scripts/catalog/legal/held-notices.json           |  339 +++
 scripts/catalog/legal/items-430.json              |    2 +-
 scripts/catalog/legal/pf-buffs-548.json           |    4 +-
 scripts/catalog/legal/racial-traits-387.json      |   12 +-
 scripts/catalog/legal/racial-traits-388.json      |    4 +-
 scripts/catalog/legal/racial-traits-389.json      |    6 +-
 scripts/catalog/legal/racial-traits-390.json      |    4 +-
 scripts/catalog/legal/racial-traits-391.json      |    8 +-
 scripts/catalog/legal/racial-traits-392.json      |    4 +-
 scripts/catalog/legal/racial-traits-393.json      |    6 +-
 scripts/catalog/legal/racial-traits-394.json      |    8 +-
 scripts/catalog/legal/racial-traits-395.json      |    4 +-
 scripts/catalog/legal/racial-traits-396.json      |    6 +-
 scripts/catalog/legal/racial-traits-397.json      |   14 +-
 scripts/catalog/legal/racial-traits-398.json      |    4 +-
 scripts/catalog/legal/racial-traits-399.json      |    4 +-
 scripts/catalog/legal/traits-367.json             |    2 +-
 scripts/catalog/reviewed-change-replacements.ts   |   12 +
 scripts/catalog/reviewed-curation.json            | 2466 ++++++++++++++++++++-
 src/lib/catalog/data/attribution-assessments.json | 1960 +++++++++++++++-
 src/lib/catalog/data/attribution-evidence.json    |  234 ++
 tests/catalog/cross-batch-bindings.ts             |    5 +
 tests/fixtures/items-430/preview.json             |    7 +-
 tests/fixtures/pf-buffs-548/preview.json          |   12 +-
 tests/fixtures/racial-traits-387/preview.json     |   22 +-
 tests/fixtures/racial-traits-388/preview.json     |   18 +-
 tests/fixtures/racial-traits-389/preview.json     |   17 +-
 tests/fixtures/racial-traits-390/preview.json     |   12 +-
 tests/fixtures/racial-traits-391/preview.json     |   32 +-
 tests/fixtures/racial-traits-392/preview.json     |   12 +-
 tests/fixtures/racial-traits-393/preview.json     |   19 +-
 tests/fixtures/racial-traits-394/preview.json     |   35 +-
 tests/fixtures/racial-traits-395/preview.json     |   14 +-
 tests/fixtures/racial-traits-396/preview.json     |   95 +-
 tests/fixtures/racial-traits-397/preview.json     |   68 +-
 tests/fixtures/racial-traits-398/preview.json     |   38 +-
 tests/fixtures/racial-traits-399/preview.json     |   12 +-
 tests/fixtures/spells-524/binding-preview.json    |    7 +-
 tests/fixtures/traits-367/preview.json            |    5 +
 40 files changed, 5264 insertions(+), 271 deletions(-)
```

<!-- prep:shared-store-count -->

New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `07c97cd8`: **79** (pf1-content 79).

<!-- /prep:shared-store-count -->

The batch adds to the shared store the pinned records of its 100 keys the store lacked (79 pf1-content files); the race records, the folder records, the linked spells, feats and racial traits, the PCGen files and the PRD pages were already on the base and are reused.

The complete preview of `eddbefa1` plus this batch reported **103 admitted, 23,148 held, 5 dependent omissions and 2,069 failures**, 32 fewer than the base's 2,101 (this batch's required note records). After the rebase onto `21babb10` and fix round 1, the complete preview reports **103 admitted, 23,148 held, 5 dependent omissions and 2,067 failures**. The only batch keys among the failures are the two reference gaps above (both fail on the base too).

## Commands

| Command                                                                                                                                                                                                                                                                          | Result                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog:curate --candidates …` (required) and `--descriptions` (prose pass)                                                                                                                                                                                                     | pass; 32 required and 23 prose drafts for the batch, 0 missing; 44 s with the bounded preview                                                                                             |
| `catalog:preview --candidates …`                                                                                                                                                                                                                                                 | exit 1 as expected (the bounded tree lacks linked races and traits); 78 entries, 32 required and 78 description records checked, 0 missing, 0 stale                                       |
| Full `catalog:curate`                                                                                                                                                                                                                                                            | pass; 963 new drafts, none for this batch; 0 missing (capped)                                                                                                                             |
| Full `catalog:preview` (baseline, then final records)                                                                                                                                                                                                                            | exit 1 as on the base (admission failures); final: 103 admitted, 23,148 held, 5 dependent omissions, 2,069 failures (base 2,101); about 10 min each plus queueing                         |
| Full re-bind (`bind.ts`, `xrebind400.ts` and the #524 re-import over the final full preview)                                                                                                                                                                                     | 78 assessments bound (0 mismatches); 46 earlier assessments re-bound, all fixture bindings agree; after the rebase onto `21babb10`, Outfit, Dilettante's (#430) re-bound over its fixture |
| `pnpm test` of the batch tests, the guards (`notice-holds`, `pinned-sources`, `cross-batch-bindings`, `batch-ownership-sweep`, `ac-other-defense-bonuses`), `racial-traits-719`, `race-facts-720`, `race-ability-721`, `spells-524`, `feats-355` and `pf-buffs-548` (one worker) | pass; 13 files / 480 tests                                                                                                                                                                |
| `pnpm -s typecheck`                                                                                                                                                                                                                                                              | pass                                                                                                                                                                                      |
| `pnpm -s lint`                                                                                                                                                                                                                                                                   | pass; about 3 min (after 12 min queued)                                                                                                                                                   |
| `pnpm -s check:initial-migration-writers`                                                                                                                                                                                                                                        | pass; 185 registrations                                                                                                                                                                   |
| `pnpm catalog:pin`                                                                                                                                                                                                                                                               | pass; `sha256:005ef0b9…`                                                                                                                                                                  |
| `pnpm catalog:notice-deps`                                                                                                                                                                                                                                                       | pass; 0 gaps; 39 advisory warnings, none for this batch                                                                                                                                   |
| `pnpm catalog:format --check`                                                                                                                                                                                                                                                    | pass                                                                                                                                                                                      |

`pnpm test tests/catalog` was left to the orchestrator's prep run on the rebased commit, as the brief directs.

## Fix round 1

Sol's review (fix first) asked for two changes; both are made on `21babb10`:

1. **Mountaineer's residual overlap is quantified** (Outstanding mechanics): the Samsaran race keeps +2 on saves against death effects, +2 against negative energy effects and +2 on Fortitude saves to remove negative levels after Mountaineer replaces Lifebound, against 0 for each in the published rules. The evidence is the race's checked #328 description record and the import report's latent overlaps; the batch test resolves each residual +2. #328 is unchanged.
2. **Gift of Tongues and Master Tinker are corrected**: four reviewed change replacements zero their racial `skill.blf`, `skill.dip`, `skill.dev` and `skill.ken` changes, and the description records supply untyped +1 Modifiers, as for Seasinger (curation.md has one added paragraph). Their two content fingerprints change, and Gear Gnomes (#394), the only assessment whose closure reaches either record, is re-bound again (row above, against the `eddbefa1` value); its inventory `currentBinding` and preview fixture copy of Master Tinker are updated. No other binding changed: the binding code over the new full preview finds the other 72 reaching assessments as before (46 fresh, 26 stale on the base).

| Command (fix round 1)                                                                                                                                               | Result                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Full `catalog:preview`                                                                                                                                              | exit 1 as on the base; 103 admitted, 23,148 held, 5 dependent omissions, 2,067 failures |
| `bind.ts` and `xrebind400.ts` over it                                                                                                                               | 78 assessments bound (0 mismatches); Gear Gnomes re-bound, fixture binding agrees       |
| `pnpm test` of the batch tests, `cross-batch-bindings`, `batch-ownership-sweep`, `notice-holds`, `racial-traits-394` and `racialTraits394.integration` (one worker) | pass; 7 files / 149 tests                                                               |
| `pnpm -s typecheck`, `pnpm -s lint`                                                                                                                                 | pass                                                                                    |
| `pnpm catalog:format --check`                                                                                                                                       | pass                                                                                    |
| `pnpm catalog:notice-deps`                                                                                                                                          | pass; 0 gaps; 39 advisory warnings, none for this batch                                 |
