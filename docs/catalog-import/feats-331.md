# Feat curation review: #331

Reviewed 2026-10-07 by **Sol (AI curator) for the owner**, following [#331](https://github.com/AndreasUnunger/EverythingPath/issues/331), [PRD Implementation Decision 17 and its acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461), the [curation workflow](curation.md), and the [#328](races-328.md) and [#330](feats-330.md) precedents.

This review covers exactly the ticket's 100 `pf1/` feat identities. Attribution admission, required-record coverage, and calculation completeness are separate results. Changes remain uncommitted under the orchestration brief; no Catalog Release is published or activated.

## Evidence and review boundary

The system input is `foundryvtt-pathfinder1` v11.11 at `418761d2e16a6037c0156bb4a241f7cea5a2986d`. The content input is `pf1-content` 11.4.0 at `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`. Both pinned checkouts are read-only.

Permitted CRB comparison uses [PCGen's feat data](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_feats.lst) and [campaign metadata](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/core_rulebook.pcc), pinned at `25523dbcf10e86c280fc0f447167ea43d67419d3`. The feat file's SHA-256 is `5ad62f0183b3005a452c93c4d954bcad97033f92dfb8276f214c1c321831db7f`; the campaign file's is `8638a1197e2a541695f3005feb1a6eb67569220a5b0f151bc37819d3121feb06`. Comparison inspects prose and data facts without executing either dataset. No book PDFs were available, and Archives of Nethys was not used.

The [batch inventory](../../scripts/catalog/legal/feats-331.json) records every exact key, source YAML location and hashes, comparison evidence, disposition, notice requirements, and mechanics review. [Attribution Assessments](../../src/lib/catalog/data/attribution-assessments.json) and [evidence](../../src/lib/catalog/data/attribution-evidence.json) bind reviewed content, identity mappings, evidence, and notice identities. The [Curation Overlay](../../scripts/catalog/reviewed-curation.json) supplies exact-bound reviewed outputs. Existing records, remaps, Item Ability policies, notices, and source-display behavior are preserved.

Complete-content comparisons include prerequisites, Benefits, Normal and Special clauses, choice/repeatability statements, and recursively linked definitions where present. A CRB name match does not establish coverage of an appended Combat Trick or a linked later-book definition. Source product codes and compilation notice lines remain bibliographic leads when the complete notice chain is unverified. Every recorded notice-chain hold is registered in [held-notices.json](../../scripts/catalog/legal/held-notices.json), which the admission gate enforces; whole-content comparison holds remain unresolved Attribution Assessments.

## Exact dispositions

**19 supported/admitted, 81 specifically held, zero dependent omissions, zero wholly unsupported/prose-only dispositions, and zero exclusions.** Each key has one editorial disposition; prose-only submechanics do not change an entire feat’s attribution disposition. Admission-gate reference failures are reported separately below.

Sixteen accepted assessments have self-contained CRB comparisons. The three reviewed linked closures are Mobility → Dodge, Greater Spell Focus → Spell Focus, and Improved Lightning Reflexes → the unchanged #330 Lightning Reflexes. Improved Lightning Reflexes therefore requires the full artifact for admission; its dependency lies outside this exact bounded selection.

| Exact key | Name | Disposition and evidence boundary |
| --- | --- | --- |
| `pf1/HoN8pq9Q72T8WbOX` | Lifecrafting | Held: complete content comparison and notice chain not established for PZO9495. |
| `pf1/I34hZ82Wa8O0ibpX` | Spit Venom | Held: complete content comparison and notice chain not established for PZO1121. |
| `pf1/IER2MzJrjSvxMlNS` | Greater Weapon Focus | Held: Complete linked-definition content closure. |
| `pf1/IPfsLy9sWXF6IBP1` | Martial Weapon Proficiency | Held: Normal -4 nonproficiency penalty; Special automatic-class proficiency and repeated new weapon clause. |
| `pf1/IWcbDa0ITsDdiHjo` | Ki Throw | Held: complete content comparison and notice chain not established for PZO1115. |
| `pf1/J1yi4hFKYdXqZE3h` | Maximize Spell | Admitted: complete PCGen CRB comparison and reviewed CRB notice. |
| `pf1/JNlMhMhcDO8wkXiw` | Critical Focus | Held: Appended Pathfinder Unchained Combat Trick. |
| `pf1/JSPFo2fBkNlrtVqi` | Bodyguard | Held: complete content comparison and notice chain not established for PZO1115. |
| `pf1/JUBqOpBA3agQwNvu` | Natural Spell | Admitted: complete PCGen CRB comparison and reviewed CRB notice. |
| `pf1/JreaiTHdyWFNj3Tb` | Dodge | Admitted: complete PCGen CRB comparison and reviewed CRB notice. |
| `pf1/Jsoscf4TXFoHYOd0` | Signature Skill (Handle Animal) | Held: complete content comparison and notice chain not established for PZO1131. |
| `pf1/K1BvVIrp30BUKQB5` | Bleeding Critical | Held: Appended Pathfinder Unchained Combat Trick; Complete linked-definition content closure. |
| `pf1/K4FEFu94JKOP2l51` | Deadly Aim | Held: Appended Pathfinder Unchained Combat Trick. |
| `pf1/KPaC3H6EQGG4sXLT` | Awesome Blow | Held: complete content comparison and notice chain not established for PZO1112. |
| `pf1/KSc5UH9Os4iqzK3M` | Dirty Fighting | Held: complete content comparison and notice chain not established for PZO9459. |
| `pf1/Kbuy0bkPlOYz5yaO` | Improved Steal | Held: complete content comparison and notice chain not established for PZO1115, PZO1131. |
| `pf1/KlE26ofz7uAkd0IJ` | Spell Mastery | Held: Normal spellbook/read magic exception. |
| `pf1/L10V7jTzmMYz62zz` | Persuasive | Admitted: complete PCGen CRB comparison and reviewed CRB notice. |
| `pf1/LSykiaxYWzva2boF` | Greater Spell Focus | Admitted: complete PCGen CRB comparison and reviewed CRB notice. |
| `pf1/LUOETW7Fm0oPKKWj` | Improved Dirty Trick | Held: complete content comparison and notice chain not established for PZO1115, PZO1131. |
| `pf1/LVycOywOAhOFqp5A` | Combat Vigor | Held: complete content comparison and notice chain not established for PZO9475. |
| `pf1/MWbOlWeXOxxsBacw` | Extra Amplification | Held: complete content comparison and notice chain not established for PZO1132. |
| `pf1/MaBR8MFF9sibtF4z` | Haunt Scavenger | Held: complete content comparison and notice chain not established for PZO9471. |
| `pf1/Mz8ZG6nqW3NKFZhK` | Step Up | Held: Appended Pathfinder Unchained Combat Trick. |
| `pf1/NABgOSBRECIREaha` | Rapid Shot | Held: Complete linked-definition content closure. |
| `pf1/NFxHebU1XhEs5WJh` | Combat Expertise | Admitted: complete PCGen CRB comparison and reviewed CRB notice. |
| `pf1/NJoSHKbpJj9aD84E` | Empower Spell-Like Ability | Held: complete content comparison and notice chain not established for PZO1112. |
| `pf1/NdrNsfFKYGy3VXDF` | Precise Strike | Held: complete content comparison and notice chain not established for PZO1115. |
| `pf1/O0e0UCim27GPKFuW` | Diehard | Held: Complete linked-definition content closure. |
| `pf1/O0jbkTJcIji9BNiF` | Intimidating Prowess | Admitted: complete PCGen CRB comparison and reviewed CRB notice. |
| `pf1/O109YFcItBFUDHvu` | Heighten Spell | Admitted: complete PCGen CRB comparison and reviewed CRB notice. |
| `pf1/O7Dn4bXZtMW0UstG` | Turn Undead | Held: Explicit 10 + half cleric level + Charisma DC formula (snapshot uses an undecoded variable). |
| `pf1/P4tmHYQVGowcstjO` | Quicken Spell-Like Ability | Held: complete content comparison and notice chain not established for PZO1112. |
| `pf1/PBqk2ZYEdehWcprC` | Snatch | Held: no upstream citation; complete origins and required notices remain unbounded. |
| `pf1/PGTjF7uoFx7wP1WO` | Extra Ki | Admitted: complete PCGen CRB comparison and reviewed CRB notice. |
| `pf1/PjyRS3MdzvsVPyN8` | Crushing Impact | Held: complete content comparison and notice chain not established for PZO9493. |
| `pf1/PkktjwppuVzoLn19` | Strike Back | Admitted: complete PCGen CRB comparison and reviewed CRB notice. |
| `pf1/PlCHtwe6e3f7pZYR` | Flyby Attack | Held: complete content comparison and notice chain not established for PZO1112. |
| `pf1/PrthT5jZl4t3znqR` | Improved Lightning Reflexes | Admitted: complete PCGen CRB comparison and reviewed CRB notice. |
| `pf1/PxwM4Uf4mcYs3Auq` | Tower Shield Proficiency | Held: Complete linked-definition content closure. |
| `pf1/Q1cY8r0Pvb66pMG0` | Alertness | Admitted: complete PCGen CRB comparison and reviewed CRB notice. |
| `pf1/QQE5EGIh7KDABnv2` | Quick Stow | Held: no upstream citation; complete origins and required notices remain unbounded. |
| `pf1/QWQH2kZgd1xZicuX` | Ability Focus | Held: complete content comparison and notice chain not established for PZO1112. |
| `pf1/QaMwiDFQdDwycTUO` | Disruptive | Held: Exact fighter-level 6 prerequisite (snapshot uses an undecoded qualification variable). |
| `pf1/QhUjSBWAp6EYFM8K` | Signature Skill (Swim) | Held: complete content comparison and notice chain not established for PZO1131. |
| `pf1/QlfQpoqFeSTC9AAT` | Extra Cantrips or Orisons | Held: complete content comparison and notice chain not established for PZO1117. |
| `pf1/QvfsBWvx7Rfb9Wb7` | Following Step | Held: complete content comparison and notice chain not established for PZO1115, PZO1131. |
| `pf1/QvlxYVVsBDlykPKe` | Arcane Strike | Held: Flavor introduction and exact arcane-spell prerequisite comparison (snapshot permits additional spell-like qualification). |
| `pf1/R3a1OV18RwDJftvq` | Leadership | Held: Complete follower/cohort tables; reputation/cohort/follower adjustment tables; alignment, equipment, XP and maximum-cohort rules. |
| `pf1/R7L4SlGRlnThqFrP` | Mobility | Admitted: complete PCGen CRB comparison and reviewed CRB notice. |
| `pf1/RDgJ7awoKBhacWsu` | Extra Lay On Hands | Held: Complete linked-definition content closure. |
| `pf1/RE14LhYMDTcjAyHd` | Deafening Critical | Held: Appended Pathfinder Unchained Combat Trick; Complete linked-definition content closure. |
| `pf1/RmhtvELGu73iR8yh` | Multiattack | Held: complete content comparison and notice chain not established for PZO1112. |
| `pf1/SI5S8eZGMOwIDkiq` | Hurricane Punch | Held: complete content comparison and notice chain not established for PZO9483. |
| `pf1/SMyexRzOm5PfjT5I` | Deft Hands | Admitted: complete PCGen CRB comparison and reviewed CRB notice. |
| `pf1/SS99IHuvIvzQ1v92` | Amateur Investigator | Held: complete content comparison and notice chain not established for PZO1129. |
| `pf1/SUACufUXl12sUvnQ` | Deceitful | Admitted: complete PCGen CRB comparison and reviewed CRB notice. |
| `pf1/SkiZsGPMlsMNeBhf` | Craft Technological Arms and Armor | Held: complete content comparison and notice chain not established for PZO9272. |
| `pf1/SxJ3UUccsCHjI6WN` | Extra Ninja Trick | Held: complete content comparison and notice chain not established for PZO9466. |
| `pf1/TGmNCGtnHf0icozK` | Penetrating Strike | Held: Complete linked-definition content closure. |
| `pf1/THh2QoWGXIJUaGsw` | Signature Skill (Ride) | Held: complete content comparison and notice chain not established for PZO1131. |
| `pf1/TN4EcG5WwQQPzl51` | Extra Focus Power | Held: complete content comparison and notice chain not established for PZO1132. |
| `pf1/TbOPtIL8Fv8obXtP` | Improved Critical | Held: Full Special distinct-weapon repetition and non-stacking comparison beyond the encoded threat-range benefit. |
| `pf1/UatLCbhallkclT6U` | Wrest Charge | Held: complete content comparison and notice chain not established for PZO9272. |
| `pf1/UcEIgufLJlIfhHmu` | Furious Focus | Held: complete content comparison and notice chain not established for PZO1115. |
| `pf1/UnmST9BvRhxT4vq3` | Whirlwind Attack | Held: Complete linked-definition content closure. |
| `pf1/UqQk2exo5s8hL71s` | Aligned Crafting | Held: complete content comparison and notice chain not established for PZO9486. |
| `pf1/Uuiu3p982omhMEPj` | Improved Initiative | Admitted: complete PCGen CRB comparison and reviewed CRB notice. |
| `pf1/V041fsvlhNcFhz5k` | Wingover | Held: complete content comparison and notice chain not established for PZO1112. |
| `pf1/V2zY7BltkpSXwejy` | Spell Focus | Admitted: complete PCGen CRB comparison and reviewed CRB notice. |
| `pf1/V6du9lXESc2spA7B` | Craft Wand | Admitted: complete PCGen CRB comparison and reviewed CRB notice. |
| `pf1/V8GIvVaAofyw9xIl` | Improved Counterspell | Held: Normal same-spell/designated counterspell restriction. |
| `pf1/VHsCghfyT6J43b5G` | Extra Revelation | Held: complete content comparison and notice chain not established for PZO1115. |
| `pf1/VK8TgwfjeomMwGjd` | Double Slice | Held: Complete linked-definition content closure. |
| `pf1/VMVAqGze4cs3naya` | Nimble Moves | Admitted: complete PCGen CRB comparison and reviewed CRB notice. |
| `pf1/VPruDiNTrlRVlJRA` | Painful Collision | Held: complete content comparison and notice chain not established for PZO9493. |
| `pf1/ViwAwl9iKWgh77pP` | Extra Bombs | Held: complete content comparison and notice chain not established for PZO1115. |
| `pf1/Vov43JkBzhtPn2T9` | Amateur Swashbuckler | Held: complete content comparison and notice chain not established for PZO1129, PZO1131. |
| `pf1/Vq8zGwac1PqaY4IF` | Step Up and Strike | Held: complete content comparison and notice chain not established for PZO1115, PZO1131. |
| `pf1/WKIVfdosc5SqYzmP` | Quick Draw | Held: Normal movement-linked drawing and hidden-weapon standard-action clauses. |
| `pf1/WOny1lHnaikwNDzH` | Grisly Ornament | Held: complete content comparison and notice chain not established for PZO9478. |
| `pf1/WYuwfu2h0LWNkU4Y` | Extra Discovery | Held: complete content comparison and notice chain not established for PZO1115. |
| `pf1/WZj7zDvuelEoeXWX` | Shield Proficiency | Held: Normal nonproficiency penalties; Special automatic-class proficiency list. |
| `pf1/WmXRmJIpmK9nejvC` | Create Enhanced Firearm | Held: complete content comparison and notice chain not established for PZO9486. |
| `pf1/WnWRcte0jppClLpz` | Selective Channeling | Held: Complete description and prerequisite/Special facts have not been established. |
| `pf1/WoUopEGAWb3pGp6I` | Shake It Off | Held: complete content comparison and notice chain not established for PZO1118. |
| `pf1/Wyg5K1Y72Jf5Yehb` | Extra Hex | Held: complete content comparison and notice chain not established for PZO1115, PZO1129. |
| `pf1/WzxMRQNiRbWuR7Gw` | Signature Skill (Acrobatics) | Held: complete content comparison and notice chain not established for PZO1131. |
| `pf1/XAQntETXIH2e5GwF` | Tail Terror | Held: complete content comparison and notice chain not established for PZO1121. |
| `pf1/XEe84rVBLzlDq7Ae` | Craft Robot | Held: complete content comparison and notice chain not established for PZO9090. |
| `pf1/XGvS0hHv58XAeQij` | Greater Bull Rush | Held: Appended Pathfinder Unchained Combat Trick; Complete linked-definition content closure. |
| `pf1/XMQRJ6eGKu3KILKe` | Extra Reservoir | Held: complete content comparison and notice chain not established for PZO1129. |
| `pf1/XRPuApgE1Ltz4YHN` | Greater Shield Focus | Held: Appended Pathfinder Unchained Combat Trick; Complete linked-definition content closure. |
| `pf1/XfdKpTa4w1wuhJKU` | Pack Attack | Held: complete content comparison and notice chain not established for PZO1118. |
| `pf1/XhGkCdqvLjdyET0n` | Caster's Champion | Held: complete content comparison and notice chain not established for PZO9293. |
| `pf1/XxZgIRc2UMLXHtZh` | Greater Steal | Held: complete content comparison and notice chain not established for PZO1115, PZO1131. |
| `pf1/YDqp3yrAsuXh103W` | Two-Weapon Defense | Held: Complete linked-definition content closure. |
| `pf1/YLCvMNeAF9V31m1h` | Weapon Specialization | Held: Complete linked-definition content closure. |
| `pf1/YfSxUIhoYTL1o3Yp` | Signature Skill (Sense Motive) | Held: complete content comparison and notice chain not established for PZO1131. |
| `pf1/YlmQY1Dwjs2EusuT` | Signature Skill (Perform) | Held: complete content comparison and notice chain not established for PZO1131. |

Twenty non-CRB complete-chain notice holds are enforced for `PZO9495`, `PZO1121`, `PZO1131`, `PZO1115`, `PZO1112`, `PZO9459`, `PZO9475`, `PZO1132`, `PZO9471`, `PZO9493`, `PZO1117`, `PZO9483`, `PZO1129`, `PZO9272`, `PZO9466`, `PZO9486`, `PZO9478`, `PZO1118`, `PZO9090`, `PZO9293`. The inventory names each book, Registry identity, evidence location and missing chain. Existing reviewed `CRB`/`PZO1110` notice coverage is reused; no new notice text or alias is invented.

Critical Focus, Bleeding Critical, Deadly Aim, Deafening Critical, and Greater Shield Focus contain appended Pathfinder Unchained Combat Tricks despite CRB-only source metadata. Their assessment requirements include `PZO1131` and its enforced notice hold; the entry’s displayed sources remain unchanged. Snatch and Quick Stow have no upstream citations and remain unsourced held content.

## Mechanical records and outstanding calculations

The bounded drafter produced nine required note records; its separate prose pass produced 54 description candidates. All 63 appended records are checked against exact pinned raw text and supply 71 outputs. Existing 156 records are preserved. No action conditionals or Item Abilities occur in this batch. Required coverage has no missing, stale, or unresolved records. Nineteen optional description records retain explicit unresolved diagnostics; checked status does not claim that their missing calculations are implemented. Shared Situations use the existing reviewed vocabulary wherever equivalent; distinct defensive or target-specific circumstances remain local. Rule identities and source facts are retained.

The [100-record mechanics inventory](../../tests/fixtures/feats-331/mechanics.json) records source prerequisites/proficiencies, mapped facts, uncheckable clauses, unsupported quantities, and per-entry gaps. The append-only curation contract cannot replace unsupported import fields or manufacture chosen targets. Missing promised calculations are independently itemized in the inventory and mechanics fixture, including when attribution is accepted. Combat Tricks and Skill Unlocks remain prose under the PRD; crafting prices, metamagic application, tactical target adjudication, and daily-use resources do not add product scope.

Specific remaining boundaries:

- Imported repeatability stays `unreviewed`; choice/repeatability facts, same-school prerequisites and chosen weapon/attack facts are retained in the inventory. School-conditioned Spell Focus and Greater Spell Focus each supply +1 DC; selecting and propagating school choices remains incomplete. Weapon Specialization supplies chosen-weapon +2 damage; Greater Weapon Focus’s chosen +1 is not materialized.
- Alertness, Persuasive, Deceitful and Deft Hands retain unsupported rank-threshold formulas rather than receiving unconditional +4 bonuses. Proficiency arrays remain an importer gap; #720 replaced the long-form imported skill targets with runtime keys. Martial Weapon Proficiency must grant one chosen weapon type; the raw all-martial grant is not promoted. Shield and Tower Shield proficiency remain unmaterialized.
- Intimidating Prowess’s raw `max(0, @abilities.str.mod)` set a Strength penalty to 0, although CRB p. 128 adds the Strength modifier. #720 re-bound it to the runtime skill target `skill.int` on 2026-10-08 (target name only, values unchanged). #726 replaced the raw formula with the Strength modifier, with no floor, through a [reviewed change replacement](curation.md#reviewed-change-replacements), so Strength 8 gives −1 on Intimidate; it re-bound the assessment on 2026-10-14, and the assessment records all three reviews. Critical Focus’s unsupported `critConfirm` change does not become ordinary attack +4; its consuming contract is a note-only critical-confirmation rule.
- Imported opaque identities do not activate all handwritten attack rules. Rapid Shot, Improved Critical, Furious Focus, and automatic-feat integrations retain explicitly named gaps. Combat Expertise and Deadly Aim are represented by option-scoped Modifiers; attack declaration, timing, and unrepresented touch restrictions stay visible as boundaries.
- Mobility, Two-Weapon Defense, and Caster’s Champion have explicit conditional outputs without unconditional substitutes. Ally count, equipment, activated/timed state, prerequisite equivalence and target-specific DCs retain their named missing facts where the model cannot calculate them. Shield Focus dependencies and Greater Shield Focus’s shield-use formula remain incomplete.
- Bleed/deafness, tactical actions, rerolls, spell-like effects, Leadership tables, crafting, resource use and metamagic preserve readable rules. Five Skill Unlock description records have deliberate no-output coverage and review diagnostics because their excluded alternate system remains in the original descriptions; those are not missing calculations. Their broken journal references are still gate failures.

Class schedules through level 20, gear Base Items/end state, and companion-version inputs are inapplicable to this feat batch. Importer work under #719/#720 is reported rather than implemented here.

## Public resolver and isolated saved-sheet evidence

[Focused catalog tests](../../tests/catalog/feats-331.test.ts) and the [byte-exact source fixtures](../../tests/fixtures/feats-331/README.md) check every source/description hash, each key’s assessment and disposition, exact reviewed modifiers/notes/sources, and coverage of the nine required records and 54 descriptions. The fixtures preserve source bytes. The normalized preview retains the complete checkout’s identity/name lookup; an isolated raw-fixture import cannot resolve every out-of-batch name. The admission demonstration uses those source-derived normalized definitions and exposes the missing Lightning Reflexes dependency, rather than inventing a linked fixture or an assessment.

The public calculation boundaries demonstrate:

- Improved Initiative supplies +4 once in current and permanent projections: Dex 14 gives initiative 6 from +2 Dex and +4 feat, without changing saves.
- Dodge alone supplies +1; Mobility adds +4 only in its entry-local movement-provoked attack-of-opportunity Situation, producing +5 together. Another entry’s local Situation and unrelated Situations do not activate it.
- Improved and Greater Steal supply +4 CMB together in shared offensive `steal`; ordinary CMB stays unchanged. Improved Steal’s defensive local Situation supplies only +2 CMD and no CMB.
- Combat Expertise at BAB 0/3/4/7/8 has magnitudes 1/1/2/2/3. Its routine option affects melee attack/CMB and dodge AC only when selected; no ranged attack penalty is invented.
- Two-Weapon Defense supplies zero ordinary shield AC, +1 while wielding the described weapons, or +2 while also defending. Selecting both conditional states still gives +2, never +3.
- Unsupported Critical Focus and rank-dependent skill formulas remain exposed without substitute unconditional bonuses.

[The isolated persisted-sheet test](../../convex/catalogFeats331.integration.test.ts) materializes admitted Improved Initiative from the preview, preserving its identity, description, sources and numeric Modifier. A narrow fixture adapter omits the importer’s unusable `unreviewed` repeatability field without inventing replacement facts. Existing authored fighter fixtures provide the baseline. Public writers record fighter 1, HP 10 and Dex 14; the authorized saved read gives initiative 2 before selecting the feat and 6 afterward in both projections. A second campaign member sees the same result and can edit it. Deactivation returns 2 while retaining the row and definition; restoration returns 6. Outsider, unauthenticated and wrong-campaign reads/edits are refused, and refused edits leave the result unchanged.

The focused command passes three files and sixteen tests in 1.95 seconds. No browser, remote deployment, publication, initial migration or production seed is involved.

## Commands and observed results

The following commands run locally against the pinned checkouts. All output directories are ignored worktree-local scratch; they are removed after results are recorded. Full-corpus drafts remain unreviewed operator output and are not copied into the shipping overlay.

```sh
PF1_CURATION_SYSTEM="/home/andreas/repos/everythingpath/sources/foundryvtt-pathfinder1"
PF1_CURATION_CONTENT="/home/andreas/repos/everythingpath/sources/pf1-content"
mkdir -p .scratch/curation-331/tmp
export TMPDIR="$PWD/.scratch/curation-331/tmp"
# package.json in TMPDIR contains {"type":"commonjs"} for test executables.
node --input-type=module <<'JS'
import fs from 'node:fs';
const review = JSON.parse(fs.readFileSync('scripts/catalog/legal/feats-331.json', 'utf8'));
fs.mkdirSync('.scratch/curation-331/records', { recursive: true });
fs.writeFileSync('.scratch/curation-331/records/candidates.json',
  JSON.stringify(review.candidates.map(({ externalKey }) => externalKey), null, 2) + '\n');
JS
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/curation-331/records/candidates.json --out .scratch/curation-331/records/draft
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/curation-331/records/candidates.json --records .scratch/curation-331/records/draft/records.json --descriptions --out .scratch/curation-331/records/prose
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/curation-331/records/candidates.json --records scripts/catalog/reviewed-curation.json --descriptions --out .scratch/curation-331/final-reviewed
pnpm -s catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/curation-331/records/candidates.json --out .scratch/curation-331/final-bounded
pnpm -s catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-331/final-full
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/curation-331/full-drafts
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm test tests/catalog/feats-331.test.ts convex/catalogFeats331.integration.test.ts tests/catalog/notice-holds.test.ts --maxWorkers=2
pnpm test tests/catalog --maxWorkers=2
pnpm test --maxWorkers=2
git diff --check
```

| Check | Observed result |
| --- | --- |
| Pinned checkout/manifests | Both verified; no override |
| Initial bounded drafter and separate prose pass | Exit 0; nine required drafts, then 54 description candidates |
| Final bounded reviewed resume | Exit 0; all 219 records retained, zero added/replaced; required nine and description 54 checked |
| Bounded inventory | 100 entries; zero resources, exclusions or unassigned records |
| Bounded curation | Pass; nine required and 54 description records checked; no missing/stale/unresolved required records; 19 optional unresolved descriptions |
| Bounded admission | Exit 1: 18 admitted, 41 held, 41 reference failures; zero dependent omissions or retained exceptions |
| Full admission | Exit 1: 23,037 entries, 538 resources; 31 admitted, 23,153 held, 4,765 failures |
| Batch outcomes in the full gate | 19 admitted, 74 gate-held, seven pre-existing reference failures; no missing-record or stale-assessment failures |
| Full-corpus drafter | Exit 0; 3,878 records, 3,659 new drafts, zero replaced/missing; 767 unresolved mechanics outside this batch |
| `pnpm -s typecheck` | Pass after test-only adapter correction; repeated successfully after the admission-test edit |
| `pnpm -s lint` | Pass; final full lint and the subsequently edited admission test’s ESLint check both exit 0 |
| `pnpm -s check:initial-migration-writers` | Pass; 175 registrations |
| `pnpm catalog:pin` | Pass; `sha256:6607d068facda14d40eddebe4e916952e8c668997ecadde9dbdc550e946f5518` |
| Final focused tests | Pass; three files, 16 tests, 4.00 seconds |
| `pnpm test tests/catalog --maxWorkers=2` | Pass; 23 files, 368 tests, 23.50 seconds; exit 0 |
| Foreground full `pnpm test --maxWorkers=2` | Pass; 504 files, 6,333 tests, 598.82 seconds; exit 0 |
| `git diff --check` | Pass after the final report and test edits |

The baseline full gate has 4,774 failures: 3,668 missing curation records, 715 unaccounted inventory records and 391 structure/reference failures. This batch removes exactly its nine missing-record failures. Final failures are 3,659 remaining missing records outside the batch, the same 715 unaccounted inventory records and the same 391 structure/reference failures. Comparing exact `(externalKey, reason)` pairs finds zero new failures. Full-corpus curation remains incomplete; passing this batch’s required coverage does not turn the full preview into a passing release gate.

The seven batch reference failures are Diehard and Signature Skill variants for Handle Animal, Swim, Ride, Acrobatics, Sense Motive and Perform. Their journal references are unresolved in both baseline and final complete extraction. Bounded preview adds 34 other reference failures because definitions are outside its exact selection, including the otherwise admitted Improved Lightning Reflexes. No dependency is silently imported, discarded or relabeled as an attribution hold to make that bounded gate pass. Each actual full-gate diagnostic remains in the inventory.

All 19 accepted assessment bindings were generated from the final complete extraction and checked by the actual CLI gate after the overlay and evidence settled. Supplemental evidence binds the three reviewed linked closures. The 100 new assessments and 101 new evidence records preserve the previous 227 assessments and every previous evidence record. The 20 new enforced notice holds preserve all 52 existing entries. No required admitted notice, retained-use exception or legal resource is outstanding; the legal-resource fingerprint remains unchanged.

Final bounded fingerprints: extraction `1b3b3afbcd27ea9e31e0c35f14af5b57c09c466425f0593bb0f13227caf80bcf`; reviewed inputs `bf0f9b5acc096cf7e254a72e1ef67663e8b20832de6dcb0cfb7ccbd14962bef4`; legal resources `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e`; admission-report SHA-256 `50b079770f797ab2f6717f1d51b19898c002d53591f9b7764dcb60eec048cc78`.

Final full extraction fingerprint: `d507dad890044c1a4f37df139efe6fde32675897d8a28625ab555a856f4edead`; admission-report SHA-256 `0d6a7a4717a666713a393566e09215c9896e1bcfdc1e863dc7bfeac4dd7689f7`. Reviewed-input and legal-resource fingerprints match the bounded run. Overlay SHA-256: `f8ab732ae1e52dab880ee14cbc145ca02102c2f6fdbcfa9f985dc7f0ca5e080b`; tracked normalized-preview SHA-256: `ba2b8e8961b8fc18738b3e9d4f155280be0775f8ae038342caaacbf397092904`.

The first catalog suite run had 366 passing tests and two failures in 69.39 seconds: the obsolete ARG/APG hold-ID expectation and a release-operator CLI test reaching its 5-second timeout. The expectation was corrected, and the focused admission/notice test passed. The timeout occurred while lint and the final drafter overlapped; it does not establish a content regression. The final catalog and full suites run after those checks complete, retaining every test and the existing timeout budgets. At 14:03 UTC the shared host reported load averages 19.63/18.60/12.44.

The full suite runs in the foreground with two workers. No tests are skipped, timeout budgets changed, or application code changed to obtain this result. It exits 0 with the following final summary (Europe/Stockholm local time):

```text
 Test Files  504 passed (504)
      Tests  6333 passed (6333)
   Start at  16:05:57
   Duration  598.82s (transform 20.26s, setup 32.85s, import 97.35s, tests 922.97s, environment 108.04s)
```

## Timing and workflow observations

Approximate phase windows on 2026-10-07 (UTC; independent work overlaps):

| Phase | Window | Elapsed |
| --- | --- | --- |
| Brief, policy and consuming-contract review | 13:40–13:42 | 2 minutes |
| Source comparison, drafts, mechanical records, fixtures and attribution | 13:41–13:55 | 14 minutes |
| Source audits and batch report | 13:46–14:17 | 31 minutes |
| Gates, type/lint checks, test correction and final suites | 13:43–14:16 | 33 minutes |

Total elapsed time was about 37 minutes (13:40–14:17 UTC). These are overlapping phase windows, not additive work estimates. The full foreground suite itself took approximately ten minutes (14:05:57–14:15:56 UTC). Initial checks that ran before fixtures finished and the repeated catalog run account for some of the verification window.

The independent Sol reviewer sampled ten risky feats against pinned YAML, checked eight PCGen rows and comparison hashes, verified all 100 keys, source/evidence hashes and review metadata, and checked the shared/local Situation distinctions and all 20 enforced holds. The final sample and post-binding review found no findings. The main session’s earlier source audit caught the negative-Strength clamp discrepancy, removed implementation wording from the rendered Diehard Note, and treated explicitly excluded Skill Unlock automation as prose-only coverage rather than an unresolved calculation.

Workflow observations:

- A reduced fixture import lacks the complete checkout’s identity/name lookup. The focused test checks exact modifiers/notes/sources against that raw import and evaluates admission using the complete-context normalized preview. It deliberately leaves Improved Lightning Reflexes’s missing bounded dependency visible. Source normalization does not create a new permission or substitute assessment.
- The first typecheck raced the unfinished fixture and mechanics merge. A subsequent typecheck found that parsing the general Catalog Entry union left class variants broader than the preview interface. The adapter now requires `detail.kind === 'feat'` after parsing, preserving complete feat bodies without type assertions. Final typecheck and behavioral checks pass; no importer or product fix was needed.
- The existing notice-hold test assumed 52 holds. It now derives the exact count from recorded evidence, while retaining per-notice inclusion and no-extraneous-entry checks. The existing admission test also hardcoded the ARG/APG hold-ID strings; it now verifies the notice code and every recorded applicable hold ID while retaining exact admitted/held identities and pass/failure assertions. These changes accommodate new holds without weakening enforcement. The focused admission/notice checks pass 69 tests in 1.02 seconds.
- Any overlay output correction invalidates content binding, even a rendered Note edit. Final attribution binding followed the content cleanup, and the final CLI then verified it. Full-corpus drafts are not silently checked or added to shipping records.
- Book-only comparisons and complete non-CRB chains remain held because PDFs are unavailable. Importer gaps remain outstanding under their existing contracts and #719/#720. The complete preview’s inherited corpus failures are reported as failures, not a passing release gate.

The main session orchestrates source-contract review, commands, gates, and this report. Subagents make the artifact and test changes as AGENTS.md requires. The requested Opus implementation and Fable sampled-review aliases are unavailable in this environment; inherited Sol agents perform those tasks, and the unavailable Fable review is a workflow limitation.

Changes are limited to the batch inventory/report, appended Curation Overlay and attribution/evidence, enforced notice holds, 100 source YAML fixtures with manifests/provenance/mechanics/preview/adapter, focused pure and persisted-sheet tests, and the two existing hold-test assertions. No product, importer, remap, Item Ability policy, notice text, source pin or calculation identity changes. All changes remain uncommitted; nothing is pushed, published, deployed, or changed in GitHub.

No environment file or private E2E data was accessed. Worktree-local ignored scratch was used for drafts, previews, logs, and CommonJS temporary executables and removed after recording the observed results. The launcher captures the final response at its `-o` output path; no answer file is created in the repository.
