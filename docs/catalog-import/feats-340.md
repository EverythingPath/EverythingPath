# Feat curation review: #340

Reviewed 2026-10-08 by **Sol (AI curator) for the owner**, following [#340](https://github.com/AndreasUnunger/EverythingPath/issues/340), [PRD Implementation Decision 17 and its acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461), and the attribution policy in [#224](https://github.com/AndreasUnunger/EverythingPath/issues/224), [#227](https://github.com/AndreasUnunger/EverythingPath/issues/227) and [#241](https://github.com/AndreasUnunger/EverythingPath/issues/241).

## Evidence and review boundary

The batch covers exactly the ticket's 100 `pf1-content/pf-feats` candidates. The read-only system checkout is v11.11 at `418761d2e16a6037c0156bb4a241f7cea5a2986d`; the content checkout is 11.4.0 at `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`. Comparison sources are the PRD and pinned PCGen data. No book PDFs are available, and Archives of Nethys was not used. Names, citations and compilation notice lines do not establish whole-content coverage.

The [inventory and legal evidence](../../scripts/catalog/legal/feats-340.json) records every candidate's source path and bytes, description hash, comparison boundary, disposition, notice requirements and mechanics review. The [Attribution Assessments](../../src/lib/catalog/data/attribution-assessments.json) bind the reviewed complete normalized content to mapping, evidence and notice identities. The [Attribution evidence](../../src/lib/catalog/data/attribution-evidence.json) records the content comparisons; the [enforced notice holds](../../scripts/catalog/legal/held-notices.json) preserve unresolved notice chains.

The [Curation Overlay](../../scripts/catalog/reviewed-curation.json) records the separate description pass alongside required notes. Original source-display fields stay as imported. Attribution holds and missing calculations are independent findings. No new rule identity, source backfill or game-system scope is inferred.

The 39 exact PCGen comparisons distinguish complete ordinary Skill Focus coverage from partial comparisons, appended rules and unbounded variants. Skill Focus's +3/+6 at 10 ranks, nonstacking and distinct-skill repeatability are corroborated by CRB feat and skill records. Its notice uses the existing reviewed CRB identity. Fourteen complete-book notice-chain holds are registered and enforced: PZO1112, PZO1115, PZO1116, PZO1117, PZO1118, PZO1121, PZO1125, PZO1126, PZO1127, PZO1129, PZO1131, PZO1132, PZO1133, PZO1134. These are known minima, not a claimed complete origin set for the 99 held entries. Unknown whole-content origins remain separately named per candidate.

The inherited-rule audit includes all 100 keys. Kinetic Invocation records 42 pinned spell counterparts with exact source paths, hashes and citation pages, plus the explicit Bestiary 2/4/5 and ARG references and Occult Adventures kineticist rules. Combat Tricks require Pathfinder Unchained in addition to the underlying feat's known books. Raging Blood requires ACG bloodrage and CRB sorcerer bloodline rules; Terrifying Strike requires Bestiary mummy/despair rules. Unknown Infuse Weapon, Beast Speaker mastery, Mauler familiar, patron and race-variant origins remain named evidence gaps. No book-only evidence or complete chain is invented.

## Dispositions

**One candidate is admitted and 99 are individually held.** No candidate is dependently omitted, wholly unsupported/prose-only, or excluded. Admission proves the attribution and required-curation gates; the admitted Skill Focus variant still has the automatic rank-threshold calculation gap described below.

| Exact key                      | Name                            | Disposition and reason                                                                                                              |
| ------------------------------ | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `pf1-content/BGeX1TF0o5RVxDir` | Pile On                         | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/BHkjYkL8Xj50Sexo` | Untwisting Iron Skin            | Held: complete-content origins unbounded; PZO1118, PZO1131.                                                                         |
| `pf1-content/BIZVOXFVwsn7n55D` | Improved Infuse Weapon          | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/BOEgQVvJQ7FryWty` | Cornugon Smash                  | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/BOeOzbrAMOe2MUNB` | Improved Overrun (Mythic)       | Held: complete-content origins unbounded; PZO1126, PZO1110.                                                                         |
| `pf1-content/BQz1tSIvJDc4GJKV` | Ascetic Form                    | Held: complete-content origins unbounded; PZO1131, PZO1110, PZO1115.                                                                |
| `pf1-content/BRLawnEmlo46shsl` | Favored Community               | Held: complete-content origins unbounded; PZO1110, PZO1115.                                                                         |
| `pf1-content/BRQdtFwqqLnoy6ru` | Entwining Stare                 | Held: complete-content origins unbounded; PZO1132, PZO1112, PZO1110.                                                                |
| `pf1-content/BS9f4Laz0OjoaT1i` | Shared Judgment                 | Held: complete-content origins unbounded; PZO1118, PZO1115.                                                                         |
| `pf1-content/BTrciHHPtsTY01Hq` | Two-Weapon Feint                | Held: complete-content origins unbounded; PZO1118, PZO1110, PZO1131.                                                                |
| `pf1-content/BUUjILPiuVhGxC6j` | Night Sky Hex                   | Held: complete-content origins unbounded; PZO1115.                                                                                  |
| `pf1-content/BV4UnirQEKaeDwue` | Vanguard Ward                   | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/BWBVdB9mTeHtNlLF` | Mobile Bulwark Style            | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/BaRKymiXKhOtTxLs` | Improved Channel Force          | Held: complete-content origins unbounded; PZO1121, PZO1110.                                                                         |
| `pf1-content/BcLpUt7Sl9363KJf` | Eagle Eyes                      | Held: complete-content origins unbounded; PZO1115, PZO1110.                                                                         |
| `pf1-content/BjE4MMDe2ZvtDnzT` | Sociable (Mythic)               | Held: complete-content origins unbounded; PZO1126, PZO1115.                                                                         |
| `pf1-content/BjdqKKujIzBu5fBH` | Steadfast Mind                  | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/BjlTYGbUO3q1Wklr` | Spell Penetration (Mythic)      | Held: complete-content origins unbounded; PZO1126, PZO1110.                                                                         |
| `pf1-content/Bk0jogQbMfATwadz` | One Eye Open                    | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/Blkn380DkM6kDDxy` | Fast Learner                    | Held: complete-content origins unbounded; PZO1121, PZO1110.                                                                         |
| `pf1-content/BlxGSuOpeNvfIDF5` | Destructive Persuasion          | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/Bnrm9M57KOEpvsfn` | Half-Drow Paragon               | Held: complete-content origins unbounded; PZO1121.                                                                                  |
| `pf1-content/Bnxt2qLEtYLisUod` | Whip-Shot Deed                  | Held: complete-content origins unbounded; PZO1118.                                                                                  |
| `pf1-content/BpGhMFNIM3o97Uav` | Beast Speaker Mastery           | Held: complete-content origins unbounded; origin unidentified.                                                                      |
| `pf1-content/BqRpzOMZ4mfamxzQ` | Stoic Pose                      | Held: complete-content origins unbounded; PZO1121, PZO1110.                                                                         |
| `pf1-content/BrWYYYDVVs2qe1vg` | Kinetic Invocation              | Held: complete-content origins unbounded; PZO1132, PZO1121, PZO1116, PZO1127, PZO1133, PZO1129, PZO1110, PZO1115, PZO1117, PZO1118. |
| `pf1-content/BsBPpTo3Hbt6fHAN` | Brisk Spell                     | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/BwLiYTpZQwFFvObu` | Pernicious Stab                 | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/BwiuB1mOf1VNIpOC` | Tribal Hunter                   | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/BxoecjSIwr9V9jNk` | Strangler (MC)                  | Held: complete-content origins unbounded; PZO1118, PZO1115, PZO1110.                                                                |
| `pf1-content/ByYctDNbuBGmNDz0` | Practiced Ritualist             | Held: complete-content origins unbounded; PZO1132.                                                                                  |
| `pf1-content/C0Pu4Zc4TroBAyV6` | Crashing Wave Fist              | Held: complete-content origins unbounded; PZO1115.                                                                                  |
| `pf1-content/C0idCYRnFI5RUWTO` | Two-Weapon Rend (Mythic)        | Held: complete-content origins unbounded; PZO1126, PZO1110.                                                                         |
| `pf1-content/C21z5LlIXxmH1CPq` | Arming Grab                     | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/C3LCmKrCBLoyOZMF` | Coordinated Shot                | Held: complete-content origins unbounded; PZO1131.                                                                                  |
| `pf1-content/C3TCjC05vxEo6K58` | Spirit of the Wild              | Held: complete-content origins unbounded; PZO1121, PZO1112.                                                                         |
| `pf1-content/C3bjEVrgVbdcMaj6` | Pathologist                     | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/C41l28Z5S36vVVCa` | Helpless Prisoner               | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/C44V7euMz1lVx74R` | Illusive Gnome Bewilderment     | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/C4oIFrr6uzL2kxn8` | Disciplinary Devotee            | Held: complete-content origins unbounded; PZO1132.                                                                                  |
| `pf1-content/C5CkfxU3RBKTkLGl` | Energy Mastery                  | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/C93Box1Oy2Fllwhe` | Body Shield                     | Held: complete-content origins unbounded; PZO1118, PZO1110, PZO1131.                                                                |
| `pf1-content/CAD36Yu0rrz8rFDi` | Bear Hug                        | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/CBwHFIEsveSjGtY8` | Masked Intent                   | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/CD55JhcikugqaKAI` | Wand Dancer                     | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/CD9hIjvcicJ1j1nr` | Hero's Display                  | Held: complete-content origins unbounded; PZO1118, PZO1131.                                                                         |
| `pf1-content/CDOlZRjwaOs2Q2fe` | Ironguts                        | Held: complete-content origins unbounded; PZO1115, PZO1110.                                                                         |
| `pf1-content/CGKJrAvv0HaDJfCD` | Djinni Style                    | Held: complete-content origins unbounded; PZO1118, PZO1115, PZO1131.                                                                |
| `pf1-content/CGwyzI63QGz9WPRn` | Dodge (Mythic)                  | Held: complete-content origins unbounded; PZO1126, PZO1110.                                                                         |
| `pf1-content/CIRC8njU24dCQPWE` | Numbing Blow                    | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/CKDodmvuv791Zh6Q` | Dirty Critical Hit              | Held: complete-content origins unbounded; PZO1115.                                                                                  |
| `pf1-content/CLfVSSqawbVY0aDV` | Sharptooth                      | Held: complete-content origins unbounded; PZO1112.                                                                                  |
| `pf1-content/CMZZYIe6hkKIQsxB` | Snapping Turtle Style           | Held: complete-content origins unbounded; PZO1118, PZO1131.                                                                         |
| `pf1-content/CO2Qmj0aj76zJsew` | Spell Specialization            | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/CQzrS1YXLbNoCntn` | Stronghold                      | Held: complete-content origins unbounded; PZO1125, PZO1110.                                                                         |
| `pf1-content/CSr9tqZiLFKPsKJc` | Practiced Dreamer               | Held: complete-content origins unbounded; PZO1132.                                                                                  |
| `pf1-content/CT5OvOkf7Z2KxPxa` | Skill Focus (Knowledge [Local]) | Admitted: complete CRB comparison; PZO1110.                                                                                         |
| `pf1-content/CTXRDCXQRyjH4CCL` | Raging Blood                    | Held: complete-content origins unbounded; PZO1129, PZO1110.                                                                         |
| `pf1-content/CTawkqcZekDnv7sI` | Aspect of the Beast (Mythic)    | Held: complete-content origins unbounded; PZO1126, PZO1115, PZO1112.                                                                |
| `pf1-content/CUUjEcHuPHFqyTBJ` | Sniper's Lantern                | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/CVPIMGxnGD0yf6pF` | Disciple of the Sword           | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/CWkeN6NFv3HPuk7h` | Wyvern Wing                     | Held: complete-content origins unbounded; PZO1110, PZO1129.                                                                         |
| `pf1-content/CWvuu64Po8cNDbgi` | Echoing Spell                   | Held: complete-content origins unbounded; PZO1117, PZO1110.                                                                         |
| `pf1-content/CZPFbXtRnYZi6yQk` | Combat Patrol                   | Held: complete-content origins unbounded; PZO1115, PZO1110, PZO1131.                                                                |
| `pf1-content/Ca5qvzJUvXnnCOyh` | Dragonbane Aura                 | Held: complete-content origins unbounded; PZO1117, PZO1110.                                                                         |
| `pf1-content/CcXmEc6a5M5DXwjd` | Blinding Stare                  | Held: complete-content origins unbounded; PZO1132.                                                                                  |
| `pf1-content/CccEWDPLMwk1QTs6` | Channel Endurance               | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/Cg5RKIvUqBZlHxCM` | Mauler's Endurance              | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/Cj4YDc7f4udWdFHE` | Alertness (Mythic)              | Held: complete-content origins unbounded; PZO1126, PZO1110.                                                                         |
| `pf1-content/Cjsf4792e2Wnkyrt` | Aldori Artistry                 | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/Cl3OuWWhtgLXGLLP` | Dwarven Fury                    | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/CoRoosQQJPVmroSE` | Greater Balor Whip              | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/CpHBCRWmPKrUbrlK` | Terrifying Strike               | Held: complete-content origins unbounded; PZO1110, PZO1112.                                                                         |
| `pf1-content/CpKByDFtE0S652yw` | Trailblazing Channel            | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/Cq2efVlJR8iB9OJv` | Armor of the Pit                | Held: complete-content origins unbounded; PZO1121.                                                                                  |
| `pf1-content/CtkbDwrB8GGzDjHd` | Resistance Mastery              | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/CwK258UrnfC3DYCV` | Siege Engineer                  | Held: complete-content origins unbounded; PZO1118, PZO1131.                                                                         |
| `pf1-content/CzTHH3xOiaK8CRHx` | Practical Kata                  | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/D0IBicOXQq7YaDgz` | Giantslaying Team               | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/D2lF7vrMcPch2aKc` | Stone Cover                     | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/D5WWkbXdDf0IsQQH` | Fiendish Wings                  | Held: complete-content origins unbounded; PZO1112.                                                                                  |
| `pf1-content/D5tCQniPXdKEUI7J` | Horse Whisperer                 | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/D6VIpdG1hrAgRqqC` | Stupefying Strike               | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/D6wi5fgLby6qeTWZ` | Quick Trapper                   | Held: complete-content origins unbounded; PZO1117.                                                                                  |
| `pf1-content/D6xseMao7cIwdP6A` | Surge of Success                | Held: complete-content origins unbounded; PZO1121, PZO1110.                                                                         |
| `pf1-content/D7Dk6wC8q2JXfrWs` | Alien Mindpaths                 | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/D7LJ2Yn2zmUXOIvd` | Augment Calling                 | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/D80k5NbcBYfhkZZY` | Quick Wild Shape                | Held: complete-content origins unbounded; PZO1117.                                                                                  |
| `pf1-content/D8BTURsubroMwCuJ` | Large Target                    | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/D9Y4Je1p5e4bnpcu` | Twin Fang Style                 | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/D9b0DhtVS70YJybq` | Seize the Moment                | Held: complete-content origins unbounded; PZO1118, PZO1110, PZO1131.                                                                |
| `pf1-content/DBqrVvDTZlxhEcI4` | Angelic Flesh                   | Held: complete-content origins unbounded; PZO1121.                                                                                  |
| `pf1-content/DC00eMdScK6EgkrQ` | Bestow Hope                     | Held: complete-content origins unbounded; PZO1110.                                                                                  |
| `pf1-content/DCdB71AMSrAFxqYU` | Champion of Tranquility         | Held: complete-content origins unbounded; PZO1131, PZO1110.                                                                         |
| `pf1-content/DDXe8xgAloUqFV23` | Incite Paranoia                 | Held: complete-content origins unbounded; PZO1134, PZO1110.                                                                         |
| `pf1-content/DEVWkg29qOYtoQ7e` | Devastating Strike              | Held: complete-content origins unbounded; PZO1118, PZO1110, PZO1131.                                                                |
| `pf1-content/DF7bGEfeRVLZi120` | Guided Hand                     | Held: complete-content origins unbounded; PZO1118, PZO1110.                                                                         |
| `pf1-content/DFNAebu29dYDwiRH` | Perfect Style                   | Held: complete-content origins unbounded; PZO1118, PZO1131.                                                                         |
| `pf1-content/DFXaCr8NK0NWGN8t` | Improved Share Spells           | Held: complete-content origins unbounded; PZO1115, PZO1110.                                                                         |
| `pf1-content/DG5JRJj98Ylwn9xJ` | Ensemble                        | Held: complete-content origins unbounded; PZO1117, PZO1110.                                                                         |

## Mechanics and remaining work

The normal draft found one required Eagle Eyes note. The separate description draft found 70 candidates; explicit complete-description review extends coverage to all 100. The final overlay has **101 checked records and 56 Modifiers across 26 feats**. Required-note coverage passes with zero missing, stale or unresolved required records. Seventy-six entries retain 78 unresolved description diagnostics, and 48 have specifically recorded prerequisite gaps. All 100 repeatability facts remain the importer's `unreviewed` sentinel. These are concrete unfinished mechanics, including on admitted content, and are not attribution holds.

The existing shared Situation vocabulary was checked against each scope. Numeric scopes in this batch require a selected style, manifestation, recipient, item, spell, maneuver circumstance or temporary action state; local labels preserve those restrictions. They do not silently broaden to poison, mind-affecting effects or a general combat maneuver. No new shared Situation is declared. Ordinary Modifier Sources remain the durable feat identities, so same-Source Catalog Copies do not multiply their benefits. Original imported source fields stay empty where the pinned records have none.

Examples include Horse Whisperer's +2 Handle Animal/Ride only for horses; Bear Hug's +2 damage only against a grappled foe; Ironguts' +2 racial saves limited to nauseating/sickening effects and ingested poison; and Snapping Turtle Style's +1/+2 shield alternatives, never +3. Mythic Dodge adds +1 to ordinary Dodge and an additional +10 against its chosen attack. Mythic Alertness adds +2 to its ordinary feat. Mythic Leap retains +5/+10 alternatives: the pinned ordinary Predator's Leap grants running-start treatment, with no numeric +4. Raging Blood retains +2 morale Strength/Constitution and the inherited -2 AC, without a Will bonus.

Sociable and Disciple of the Sword keep readable rules and named Source/grant gaps; unsafe bonuses that could duplicate their ordinary feats were removed. Eagle Eyes' cancellation of up to -5 distance penalties is not replaced with a flat +5 bonus. Ally effects, temporary states, natural attacks, defenses, spell-specific caster checks, spell damage, tier-based benefits and inherited feature Grants remain outstanding where the current interface cannot calculate them. Critical-confirmation, ability-check and save-DC effects are preserved as exact rules text without an unrelated numeric target. Guided Hand's ability substitution, Siege Engineer's proficiency grant and Half-Drow Paragon's counting-as facts are individually recorded importer gaps.

Skill Focus's source formula `ifelse(gte(@skills.klo.rank,10),6,3)` remains unsupported. Its checked Modifiers expose exact, manually selected +3/+6 rank Situations. They do not automatically dispatch from ranks or remove the importer's warning. The fixture adapter omits the unusable repeatability sentinel without substituting a reviewed boolean. The saved-sheet demonstration therefore proves those explicit preview values and records the absent automatic calculation.

The main review read every candidate's complete description. It checked bonus scopes and inherited rules, including Armor of the Pit's Scaled Skin alternative, Angelic Flesh's single chosen affinity, Raging Blood's inherited bloodrage penalties, and Mythic Dodge and Alertness increments. Greater Balor Whip's upstream correction caveat is retained as evidence without consulting the prohibited site it mentions.

Class schedules, gear Base Items/end state and companion-source batches do not apply to these feat definitions. Feats affecting companions still retain their precise missing mechanics. Importer gaps remain follow-ups for the existing #719/#720 lane where applicable; they are not repaired by this batch or converted into attribution holds.

## Demonstration and checks

The [fixtures](../../tests/fixtures/feats-340/README.md) preserve all 100 raw candidate files byte for byte. Exact ticket-order key SHA-256 is `88e6d477ae1d88034494e7f7d5ebfad43fcf29753eead2d6fdb92c8cb6fc2431`. The [catalog tests](../../tests/catalog/feats-340.test.ts) exercise imported bodies, admission and public numeric resolution. The [isolated saved-sheet tests](../../convex/feats340.integration.test.ts) exercise the existing public APIs and application catalog preview using in-memory fixture data, with access checks. This does not publish global content or activate a remote deployment.

Commands use the two pinned read-only checkouts and an ignored worktree scratch directory. A local `TMPDIR` with a CommonJS package marker keeps the CLI subprocess fixtures independent of this repository's module type. Reproduction creates the candidate selection from the committed inventory; that selection is not committed.

```sh
mkdir -p .scratch/curation-340/tmp
export TMPDIR="$PWD/.scratch/curation-340/tmp"
export NODE_COMPILE_CACHE="$TMPDIR/node-compile-cache"
node --input-type=module <<'JS'
import fs from 'node:fs';
fs.writeFileSync('.scratch/curation-340/tmp/package.json', '{"type":"commonjs"}\n');
const review = JSON.parse(fs.readFileSync('scripts/catalog/legal/feats-340.json', 'utf8'));
fs.writeFileSync('.scratch/curation-340/candidates.json',
  JSON.stringify(review.candidates.map(({ externalKey }) => externalKey), null, 2) + '\n');
JS
PF340_SYSTEM=/home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1
PF340_CONTENT=/home/andreas/repos/everythingpath/sources/pf1-content
pnpm -s catalog:curate --system "$PF340_SYSTEM" --content "$PF340_CONTENT" --candidates .scratch/curation-340/candidates.json --out .scratch/curation-340/notes-drafts
pnpm -s catalog:curate --system "$PF340_SYSTEM" --content "$PF340_CONTENT" --candidates .scratch/curation-340/candidates.json --descriptions --out .scratch/curation-340/drafts
pnpm -s catalog:curate --system "$PF340_SYSTEM" --content "$PF340_CONTENT" --candidates .scratch/curation-340/candidates.json --records scripts/catalog/reviewed-curation.json --descriptions --out .scratch/curation-340/checked
pnpm -s catalog:preview --system "$PF340_SYSTEM" --content "$PF340_CONTENT" --candidates .scratch/curation-340/candidates.json --out .scratch/curation-340/final-bounded
pnpm -s catalog:preview --system "$PF340_SYSTEM" --content "$PF340_CONTENT" --out .scratch/curation-340/final-full
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm -s catalog:format --check
pnpm test tests/catalog/feats-340.test.ts convex/feats340.integration.test.ts
pnpm test tests/catalog/inherited-notices-273.test.ts --maxWorkers=1
node --max-old-space-size=4096 --max-semi-space-size=256 ./node_modules/eslint/bin/eslint.js tests/catalog/inherited-notices-273.test.ts
pnpm test tests/catalog convex/feats340.integration.test.ts --maxWorkers=2
git diff --check
```

| Check                                         | Observed result                                                                                                                                                                        |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pinned source verification                    | Both commits/manifests verified; no fixture override                                                                                                                                   |
| Initial separate prose draft                  | Exit 0; 1,394 written records, 70 new description drafts, zero replacements; required Eagle Eyes note still missing                                                                    |
| Initial normal note draft                     | Exit 0; 1,425 written records, one new required note draft, zero replacements/missing, one unresolved required mechanic                                                                |
| Final checked resume                          | Exit 0; 1,425 records retained, zero new/replaced/missing/unresolved required mechanics; all 100 descriptions checked                                                                  |
| Final bounded inventory/curation              | Pass: 100 accounted feats, complete bounded coverage, one required note and 100 descriptions checked, zero stale or unresolved required records; 76 separately unresolved descriptions |
| Final bounded admission                       | Pass: one admitted, 99 held, zero dependent omissions, retained exceptions or failures                                                                                                 |
| Full import/admission                         | Exit 1: 23,037 entries, 538 resources; 55 admitted, 23,127 held, two dependent omissions, zero retained exceptions, 4,689 failures outside this batch                                  |
| Batch within full gate                        | One admitted, 99 held, zero omissions or failures                                                                                                                                      |
| Full/bounded/fixture body audit               | Pass: all 100 complete normalized bodies are identical                                                                                                                                 |
| Source and fixture byte audit                 | Pass: every one of the 100 source hashes and fixture hashes matches the legal inventory                                                                                                |
| Prior shared records                          | Preserved unchanged: 1,324 overlay records and all shared Situations, 1,538 assessments, 1,517 evidence entries, 626 holds                                                             |
| `pnpm -s typecheck`                           | Final pass after correcting the test errors below                                                                                                                                      |
| `pnpm -s lint`                                | Pass; standard command, no memory override or timeout relaxation; affected #273 test also linted after the final assertion change                                                      |
| `pnpm -s check:initial-migration-writers`     | Pass: 183 registrations                                                                                                                                                                |
| `pnpm catalog:pin`                            | Pass: `sha256:52f42dd87903d3f6cdc69f576c93fd2788421cb12540b1969727f6aadcfc333b`                                                                                                        |
| `pnpm -s catalog:format --check`              | Pass                                                                                                                                                                                   |
| Focused catalog and saved-sheet tests         | Pass: 16 tests in two files, 3.62 seconds                                                                                                                                              |
| Complete catalog tests plus batch integration | Pass: 56 files, 1,094 tests, 135.69 seconds with two workers                                                                                                                           |
| `git diff --check`                            | Pass                                                                                                                                                                                   |

The full gate's 4,689 failures are 3,583 missing required curation records, 715 unaccounted inventory records and 391 structure/reference failures. Every failure is outside the ticket's exact keys. Full inventory coverage remains incomplete; required coverage is 104 checked of 3,687, and descriptions are 1,321 checked of 10,588, with 624 unresolved descriptions across the corpus. These results do not establish release readiness. Named holds are accounted outcomes, independent of those failing gates and outstanding mechanics.

Final bounded extraction fingerprint: `b869d1b845f896ffb6e1995046fb8c0c292c31d457fe33a408033530fa37ca22`. Final full extraction fingerprint: `5be710e042b99e5da3e9d2ce62c42862700d90690d0d25adc3e79e192fa44b8d`. Both use reviewed-input fingerprint `806fc6a8bcd07dab499480b6e5d25d10ecf5ea4183c99d13f3f2f71dc012159c` and legal-resource fingerprint `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e`. Admission-report SHA-256 values are `77fcb61c3c7e2f20a4a669084e90c2af451139657a10e09ba3cf58c09130031c` (bounded) and `f2974274a450f5c76d1978fb675ae7f176da4c25dabe14449c6959d36c90924c` (full).

This batch has no linked catalog-body dependencies. The complete-source comparison and prerequisite identities still come from both complete pinned checkouts, rather than a reduced fixture lookup. The frozen fixture, bounded and full bodies match exactly; the catalog tests independently verify all four assessment bindings against those bodies. No out-of-batch definition was silently curated or admitted to make the batch pass.

## Timing and workflow observations

The root review read all 100 descriptions, audited every numeric-producing output, and independently checked all 100 source and fixture byte hashes. It removed unsafe Sociable/Weapon Specialization duplication and rejected a recalled +4 Predator's Leap bonus after reading the pinned ordinary feat. Supporting rule paths, hashes, literal clauses and page evidence are attached to the legal review; the affected evidence records and assessment bindings were refreshed afterward. No calculator or importer fix was needed.

The first focused run had one test-author error: accessing the parent `damage` alias instead of the concrete resolver leaf. The first typecheck also caught that access and tuple evidence names inferred as possibly undefined. The tests now use concrete leaves and tuple-preserved literal metadata. The corrected focused run passed all 16 tests; the final typecheck and standard lint command pass. These were test fixes, not product changes.

The first complete catalog run passed 1,093 tests and failed one existing #273 notice-reason assertion (105.89 seconds). Occult Adventures' literal Registry notice now has both the earlier #273 hold and this batch's PZO1132 hold. The [existing notice test](../../tests/catalog/inherited-notices-273.test.ts) incorrectly assumed that its hold was the only one allowed. Its final assertion requires the original hold identity while allowing additional independently recorded holds; exact required notices, missing notices, admission, held accounting and failures are unchanged. Its 25 targeted tests pass, and final typecheck and affected-file lint pass. No hold, notice or prior content record was removed to clear the test. The final complete catalog run passed all 1,094 tests in 56 files (135.69 seconds), including all 16 new batch tests.

Approximate measured phase windows on 2026-10-08 (UTC):

| Phase                                                              | Window      | Elapsed    |
| ------------------------------------------------------------------ | ----------- | ---------- |
| Policy/source review, drafting, parallel attribution and mechanics | 06:53–07:03 | 10 minutes |
| Typecheck, lint and final supporting-provenance binding            | 07:03–07:10 | 7 minutes  |
| Checked resume and bounded/full pinned-source gates                | 07:10–07:16 | 6 minutes  |
| Catalog suite, shared-hold assertion correction and rerun          | 07:16–07:24 | 8 minutes  |
| Independent audit and report, overlapping the checks               | 07:03–07:24 | 21 minutes |

The measured work spans approximately 31 minutes; initial brief retrieval preceded the first recorded clock reading. Parallel review and report windows overlap and must not be added. Standard lint took several minutes and the complete source preview was slower than the bounded runs, so heavy jobs ran sequentially. Two workers kept the catalog rerun within the existing timeouts; no timeout relaxation, broad full-suite run or memory override was used.

Workflow limits remain explicit: the importer cannot write repeatability, several supported prerequisite/proficiency/counting-as facts or the required Source/grant replacements through the current Overlay. Those gaps stay with the existing importer lane. Required-note coverage and attribution admission cannot be used as a substitute for completing the named calculations. The shared-hold assertion now tolerates legitimate independent hold growth without weakening the original hold requirement. The final data are canonical, all previous shared entries remain unchanged, and task scratch was removed after the gate results and fingerprints were captured.

Implementation and tests were delegated as required by AGENTS.md. Its named Opus/Fable models are unavailable in this environment, so available inherited-model subagents performed the changes. The launcher captures the final response at its `-o` path; no answer file is created in the repository.

No product changes, commits, pushes, GitHub mutations or full `pnpm test` run are part of this batch. The orchestrator owns the post-rebase full-suite landing gate. Environment files and `e2e/.private` were not accessed. Drafts and command artifacts use ignored scratch directories inside the worktree, with a worktree-local temporary directory; task scratch is deleted after the results are recorded.
