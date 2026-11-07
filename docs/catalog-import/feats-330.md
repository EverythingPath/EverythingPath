# Feat curation review: #330

Reviewed 2026-10-07 by **Sol (AI curator) for the owner**, following [#330](https://github.com/AndreasUnunger/EverythingPath/issues/330), [PRD Implementation Decision 17 and acceptance appendix](https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461), the [curation workflow](curation.md), and the [#328 precedent](races-328.md).

This review processes exactly the ticket’s 100 `pf1/` feat identities. Attribution admission, required-note coverage and calculation completeness are separate results. No Catalog Release is published, and production keeps its existing authority.

## Evidence and review boundary

- System: `foundryvtt-pathfinder1` v11.11, commit `418761d2e16a6037c0156bb4a241f7cea5a2986d`.
- Content: `pf1-content` 11.4.0, commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`.
- Permitted comparison: [PCGen CRB feats](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_feats.lst) and its [campaign metadata](https://github.com/PCGen/pcgen/blob/25523dbcf10e86c280fc0f447167ea43d67419d3/data/pathfinder/paizo/roleplaying_game/core_rulebook/core_rulebook.pcc), pinned at `25523dbcf10e86c280fc0f447167ea43d67419d3`. Neither dataset is executed or used as a runtime implementation. Comparisons inspect rule prose and data facts.
- PCGen feat-file SHA-256: `5ad62f0183b3005a452c93c4d954bcad97033f92dfb8276f214c1c321831db7f`; campaign-file SHA-256: `8638a1197e2a541695f3005feb1a6eb67569220a5b0f151bc37819d3121feb06`.

The [batch inventory](../../scripts/catalog/legal/feats-330.json) records every exact key, pinned YAML location and hashes, source metadata, comparison boundary, disposition, notice requirements and independent mechanics review. The [Attribution Assessments](../../src/lib/catalog/data/attribution-assessments.json) and [evidence](../../src/lib/catalog/data/attribution-evidence.json) bind content, identity mapping, evidence and notice identities. The [Curation Overlay](../../scripts/catalog/reviewed-curation.json) supplies exact-bound reviewed outputs; remaps and Item Ability policies retain their existing identities.

The comparison checks complete content rather than names alone. PCGen’s description, benefit, prerequisite and explicit choice/repeatability facts cover the confirmed self-contained CRB candidates. A comparison that omits a Normal or Special clause or later-book Combat Trick does not establish whole-content attribution. The admission binding also fingerprints entire recursively referenced definitions reached by rewritten catalog links. A prerequisite name alone can be compared without admitting its target, but this batch does not claim complete origin coverage for an unreviewed linked-definition closure; each such hold distinguishes the local clause comparison from that remaining work. Book-only evidence remains a named hold because no PDFs are available. Archives of Nethys was not used. Existing player-facing `sources` are retained; the unsourced Lingering Performance record is not backfilled.

Reviewed CRB coverage uses the existing Registry identity `CRB`, with alias `PZO1110`. This review adds no book notice, product-code alias, legal resource or permanent-notice text. Later-book citations and observed compilation notice lines are evidence leads, with individual missing complete-chain reviews reported. A missing notice belonging only to held content does not block these independently admitted candidates.

## Exact dispositions

**12 supported/admitted, 88 specifically held, zero dependent omissions, zero wholly unsupported/prose-only dispositions and zero exclusions.** Each of the 100 keys has exactly one editorial disposition. Prose-only submechanics do not change a whole entry’s attribution disposition. Every hold uses its individual `feats-330-whole-content-<upstream-id>` evidence identity; missing evidence and notice statuses are itemized in the inventory.

The bounded CLI cannot admit linked out-of-batch definitions and reports those references separately. Eleven Signature Skill entries also retain existing unresolved journal links in the full import. The rows below are editorial dispositions, not a claim that the admission gate successfully classifies every held entry.

| Exact key | Name | Disposition and evidence boundary |
| --- | --- | --- |
| `pf1/0KZvBoqEfb1AUZ64` | Scavenger's Luck | Held: complete comparison/notice chain not established for PZO9272. |
| `pf1/0VM8AdwP25nHWnV8` | Greater Feint | Held: complete Normal/Special clauses or linked-definition origins not established. |
| `pf1/0X4q0Ypx3L05Sqzg` | Greater Drag | Held: appended Combat Trick and complete linked origins not compared. |
| `pf1/0bZf3SDkvVOe2ujH` | Lightning Reflexes | Admitted: complete PCGen CRB comparison; reviewed CRB notice. |
| `pf1/0bpGtfB3ksWHe0lW` | Tiring Critical | Held: complete Normal/Special clauses or linked-definition origins not established. |
| `pf1/0spsP9ylE3goD3jc` | Mounted Combat | Admitted: complete PCGen CRB comparison; reviewed CRB notice. |
| `pf1/0yDBOWqCLugDCUeW` | Craft Cybernetics | Held: complete comparison/notice chain not established for PZO9272. |
| `pf1/11ClnanF4PdEPd9g` | Rapid Reload | Admitted: complete PCGen CRB comparison; reviewed CRB notice. |
| `pf1/1AY9Xjbg109TsnVl` | Greater Disarm | Held: appended Combat Trick and complete linked origins not compared. |
| `pf1/1HfwfBOSWtdxFQ2s` | Improved Channel | Held: complete Normal/Special clauses or linked-definition origins not established. |
| `pf1/1foaZv9wfqZVrZ90` | Technologist | Held: complete comparison/notice chain not established for PZO9000-15E, PZO9272. |
| `pf1/1hxjrJ68yWsiCCFD` | Improved Great Fortitude | Held: complete Normal/Special clauses or linked-definition origins not established. |
| `pf1/26k1Gi7t5BoqxhIj` | Vital Strike | Admitted: complete PCGen CRB comparison; reviewed CRB notice. |
| `pf1/2AfSIVge3bg8r6wr` | Scorpion Style | Held: complete Normal/Special clauses or linked-definition origins not established. |
| `pf1/2Gd0V8lDe6BkG7nl` | Blinding Critical | Held: appended Combat Trick and complete linked origins not compared. |
| `pf1/2YuxcUNFMPNBpekG` | Silent Spell | Held: complete Normal/Special clauses or linked-definition origins not established. |
| `pf1/2aTFNMs3pW6nUBlr` | Improved Unarmed Strike | Held: complete Normal/Special clauses or linked-definition origins not established. |
| `pf1/3HjwKckDBDDPcY2c` | Greater Spell Penetration | Held: complete Normal/Special clauses or linked-definition origins not established. |
| `pf1/3KKtUz4ayCMaHeXQ` | Extra Feature | Held: complete comparison/notice chain not established for PZO9439. |
| `pf1/3MqcLuZfUJB8xMby` | Armor Proficiency, Heavy | Held: complete Normal/Special clauses or linked-definition origins not established. |
| `pf1/3S01BGUthIbp3Hju` | Stand Still | Held: complete Normal/Special clauses or linked-definition origins not established. |
| `pf1/3cq9YbgcMrAXC76j` | Dazzling Display | Held: appended Combat Trick and complete linked origins not compared. |
| `pf1/3fNdl7eIUJ5d5fwg` | Improved Two-Weapon Fighting | Held: complete Normal/Special clauses or linked-definition origins not established. |
| `pf1/3lfNiysSNv1ahV4F` | Extra Arcane Pool | Held: complete comparison/notice chain not established for PZO1117. |
| `pf1/3owNW4QoIZK6Pwm5` | Psychic Sensitivity | Held: complete comparison/notice chain not established for PZO1132. |
| `pf1/3v85ul6tGGBZbtBg` | Arcane Armor Training | Held: appended Combat Trick and complete linked origins not compared. |
| `pf1/3vO9s9gtQcRAjNl2` | Technology Adept | Held: complete comparison/notice chain not established for PZO9272. |
| `pf1/45zmh18kvRS0H641` | Signature Skill (Disguise) | Held: complete comparison/notice chain not established for PZO1131. Existing unresolved journal reference; Skill Unlocks remain prose. |
| `pf1/4FheAz49TCHTCl6O` | Swap Places | Held: appended Combat Trick and complete linked origins not compared. |
| `pf1/4VUSgCTR3kUUtKxp` | Extra Inspiration | Held: complete comparison/notice chain not established for PZO1129. |
| `pf1/4Z5VmbdMnFWyBLwf` | Signature Skill (Linguistics) | Held: complete comparison/notice chain not established for PZO1131. Existing unresolved journal reference; Skill Unlocks remain prose. |
| `pf1/4ZCIdXMHwxWABqK7` | Technophobe | Held: complete comparison/notice chain not established for PZO9272. |
| `pf1/4fAgch4ut1JYPBbL` | Unseat | Held: complete Normal/Special clauses or linked-definition origins not established. |
| `pf1/4hNO4OAWYF5vXphH` | Craft Magic Arms and Armor | Admitted: complete PCGen CRB comparison; reviewed CRB notice. |
| `pf1/53urYIbYYpQuoSLd` | Precise Shot | Held: appended Combat Trick and complete linked origins not compared. |
| `pf1/54QWaanZra9hi7LV` | Extra Mesmerist Tricks | Held: complete comparison/notice chain not established for PZO1132. |
| `pf1/57ELWypg7Rq3XBwG` | Cultivate Magic Plants | Held: complete comparison/notice chain not established for PZO1140. |
| `pf1/6HSMdwX1VS6nZ6Zf` | Great Cleave | Held: complete Normal/Special clauses or linked-definition origins not established. |
| `pf1/6Qttn4c2JAddxXP4` | Signature Skill (Bluff) | Held: complete comparison/notice chain not established for PZO1131. Existing unresolved journal reference; Skill Unlocks remain prose. |
| `pf1/6dfwJL4eOK4J0oK5` | Inscribe Magical Tattoo | Held: complete comparison/notice chain not established for PZO9237. |
| `pf1/6hmIs98sJoJzzIq0` | Master Craftsman | Held: complete Normal/Special clauses or linked-definition origins not established. |
| `pf1/6lqGh0NvprZpUUwV` | Hover | Held: complete comparison/notice chain not established for PZO1112. |
| `pf1/6wPjZJNZpTfGJjTR` | Greater Spring Attack | Held: complete comparison/notice chain not established for PZO1140. |
| `pf1/6yGoL82RidBHmXPb` | Extra Performance | Held: complete Normal/Special clauses or linked-definition origins not established. |
| `pf1/711B9WNFgpdDKKf2` | Improved Disarm | Held: appended Combat Trick and complete linked origins not compared. |
| `pf1/75XcMJS5yUIuhzsU` | Signature Skill (Knowledge) | Held: complete comparison/notice chain not established for PZO1131. Existing unresolved journal reference; Skill Unlocks remain prose. |
| `pf1/77gXSucrxfrE9yWk` | Empower Spell | Admitted: complete PCGen CRB comparison; reviewed CRB notice. |
| `pf1/7P84frgqSmscfkUC` | Extra Rage Power | Held: complete comparison/notice chain not established for PZO1115. |
| `pf1/7bJjKqNRrvpXJ4L3` | Augment Summoning | Held: complete Normal/Special clauses or linked-definition origins not established. |
| `pf1/7mD4ZksvKFaorAfj` | Shield Focus | Held: appended Combat Trick and complete linked origins not compared. |
| `pf1/7zJTztNW7hdaqjKc` | Skill Focus | Admitted: complete PCGen CRB comparison; reviewed CRB notice. |
| `pf1/8Gd3pvhQtXUmpKi1` | Signature Skill (Sleight of Hand) | Held: complete comparison/notice chain not established for PZO1131. Existing unresolved journal reference; Skill Unlocks remain prose. |
| `pf1/8GgeuFw6SDXaHGh1` | Signature Skill (Heal) | Held: complete comparison/notice chain not established for PZO1131. Existing unresolved journal reference; Skill Unlocks remain prose. |
| `pf1/8VZQJOyAXbXghxd7` | Self-Sufficient | Admitted: complete PCGen CRB comparison; reviewed CRB notice. |
| `pf1/8mS9B8Uc8odklIpl` | Trample | Held: complete Normal/Special clauses or linked-definition origins not established. |
| `pf1/8rsFtye3PwM6CKli` | Point-Blank Shot | Held: appended Combat Trick and complete linked origins not compared. |
| `pf1/8snLqsJN4LLL00Nq` | Toughness | Held: comparator’s compressed TL formula does not establish actual racial-HD semantics. |
| `pf1/8viuSwNbDvZZaiak` | Improved Natural Attack | Held: complete comparison/notice chain not established for PZO1112. |
| `pf1/91lGWgfmuQFUQit5` | Extra Investigator Talent | Held: complete comparison/notice chain not established for PZO1129. |
| `pf1/9SLkAHfOX4UEnkmS` | Craft Pharmaceutical | Held: complete comparison/notice chain not established for PZO9272. |
| `pf1/9j6OM2njOSADu8H9` | Improved Swap Places | Held: appended Combat Trick and complete linked origins not compared. |
| `pf1/9jvLagEYC2EAJ6lJ` | Fleshwarper | Held: complete comparison/notice chain not established for PZO1135. |
| `pf1/9mcYid7xJY9NiySx` | Enlarge Spell | Held: explicit close/medium/long range formulas absent from comparator. |
| `pf1/9p0aAtCyLdcwnftS` | Wind Stance | Held: complete Normal/Special clauses or linked-definition origins not established. |
| `pf1/ACEQfonKVqh0fwkK` | Deflect Arrows | Held: appended Combat Trick and complete linked origins not compared. |
| `pf1/AZoNxM18sC74qeo9` | Extra Mental Focus | Held: complete comparison/notice chain not established for PZO1132. |
| `pf1/Aj5upleDpV0t2wda` | Signature Skill (Climb) | Held: complete comparison/notice chain not established for PZO1131. Existing unresolved journal reference; Skill Unlocks remain prose. |
| `pf1/Ak0uWIHfOROMnywq` | Block Chakras | Held: complete comparison/notice chain not established for PZO9493. |
| `pf1/Amz4lAaIp0x0ehPf` | Sickening Critical | Held: complete Normal/Special clauses or linked-definition origins not established. |
| `pf1/AtAPt8O9FxrYjiej` | Signature Skill (Escape Artist) | Held: complete comparison/notice chain not established for PZO1131. Existing unresolved journal reference; Skill Unlocks remain prose. |
| `pf1/AuzOXSPSI7Q3iNK8` | Extra Item Slot | Held: complete comparison/notice chain not established for PZO9429. |
| `pf1/B6wEQOUMv2ifm2Nj` | Acrobatic Steps | Held: complete Normal/Special clauses or linked-definition origins not established. |
| `pf1/BJBC4lbo7xGWPsKJ` | Exotic Weapon Proficiency | Held: complete Normal/Special clauses or linked-definition origins not established. |
| `pf1/BbZIN6lmkZDry3ml` | Signature Skill (Stealth) | Held: complete comparison/notice chain not established for PZO1131. Existing unresolved journal reference; Skill Unlocks remain prose. |
| `pf1/BkKYCzEGNTzZRiTz` | Fleet | Admitted: complete PCGen CRB comparison; reviewed CRB notice. |
| `pf1/CLSsMyNmdcNAOUKC` | Magical Aptitude | Admitted: complete PCGen CRB comparison; reviewed CRB notice. |
| `pf1/CYHloH6aEnfgdxAV` | Improved Reposition | Held: appended Combat Trick and complete linked origins not compared. |
| `pf1/CjLNTqNGz4zU4zpp` | Command Undead | Held: complete Normal/Special clauses or linked-definition origins not established. |
| `pf1/D10dGyw3V0n77Msl` | Signature Skill (Intimidate) | Held: complete comparison/notice chain not established for PZO1131. Existing unresolved journal reference; Skill Unlocks remain prose. |
| `pf1/D5VflgZupUiegFAY` | Improved Spring Attack | Held: complete comparison/notice chain not established for PZO1140. |
| `pf1/DMSYzt5jD9vk0DGy` | Craft Construct | Held: complete comparison/notice chain not established for PZO1112. |
| `pf1/DaedlCctLlmtUbrT` | Extra Bane | Held: complete comparison/notice chain not established for PZO1118. |
| `pf1/DorPGQ2mifJbMKH8` | Improved Vital Strike | Held: complete Normal/Special clauses or linked-definition origins not established. |
| `pf1/EdcHghQAYBIDao3s` | Craft Poppet | Held: complete comparison/notice chain not established for PZO9481. |
| `pf1/Ee7JHADKEK37tTHs` | Two-Weapon Fighting | Held: complete Normal/Special clauses or linked-definition origins not established. |
| `pf1/ElqchQT5WB625HPg` | Eschew Materials | Admitted: complete PCGen CRB comparison; reviewed CRB notice. |
| `pf1/F2GJXemdlPolvx4D` | Lingering Performance | Held: no upstream citation; complete origins and notices unbounded. |
| `pf1/F8jywnqod8RLELNO` | Signature Skill (Use Magic Device) | Held: complete comparison/notice chain not established for PZO1131. Existing unresolved journal reference; Skill Unlocks remain prose. |
| `pf1/F9mKy0SmRo4bTdni` | Defensive Combat Training | Held: appended Combat Trick and complete linked origins not compared. |
| `pf1/FSDatwC1s6GoV1Sf` | Greater Penetrating Strike | Held: complete Normal/Special clauses or linked-definition origins not established. |
| `pf1/FUW5mIXHNBBIQ1Sq` | Power Attack | Held: complete Normal/Special clauses or linked-definition origins not established. |
| `pf1/FszchlqR39lnNduC` | Armor Proficiency, Light | Held: complete Normal/Special clauses or linked-definition origins not established. |
| `pf1/FtAXizfqhTNauRYh` | Infuse Poison | Held: complete comparison/notice chain not established for PZO9462. |
| `pf1/GCAaufQOqpQagrSk` | Extra Mercy | Held: complete Normal/Special clauses or linked-definition origins not established. |
| `pf1/GEo7nDHxddLxi66j` | Shield Slam | Held: complete Normal/Special clauses or linked-definition origins not established. |
| `pf1/GUN1ISsoORAqxNOM` | Improved Ki Throw | Held: appended Combat Trick and complete linked origins not compared. |
| `pf1/GsjouI6B8X7BA5wN` | Stunning Fist | Held: complete Normal/Special clauses or linked-definition origins not established. |
| `pf1/HMCAM3Zyo77kG8Yg` | Far Shot | Held: appended Combat Trick and complete linked origins not compared. |
| `pf1/HVu9JzllWoLzKKqH` | Forge Ring | Admitted: complete PCGen CRB comparison; reviewed CRB notice. |
| `pf1/HbfpROYGuhT2OLIQ` | Greater Reposition | Held: appended Combat Trick and complete linked origins not compared. |

## Mechanics and curation

The drafter found **16 required notes, zero action conditionals and zero Item Abilities**. The separate prose pass found **50 descriptions**. All 66 records are checked by Sol on 2026-10-07 and supply 56 outputs, including twelve Modifiers. Required coverage has no missing, stale or unresolved mechanics records, and the reviewed prose records have no unresolved-description diagnostics. Every other candidate’s complete raw description was inspected separately in its per-key mechanics review; the parser’s description predicate is narrower than the review scope. Passing the curation record gate does not certify numerical completeness.

The reviewed outputs preserve each opaque stable rule identity. Existing shared `spellResistance` is reused; Point-Blank Shot uses the runtime’s established `within30ft` Situation. Disarm and Reposition each use shared offensive Situations across their Improved and Greater feats; defensive CMD circumstances remain separately scoped. Drag and Great Cleave’s timing use local labels because no matching reviewed shared Situation applies. No shared-effect Source is invented, and no identity remap or Item Ability policy changes.

Corrections include Arcane Armor Training’s percentage reduction as rules text rather than an erroneous spell-DC penalty; ranged-only Point-Blank Shot attack **and damage** bonuses; separately scoped offensive/defensive disarm and reposition bonuses; Greater Spell Penetration’s conditional caster-level check bonus; Great Cleave’s conditional −2 AC; and Power Attack’s option-scoped combat-maneuver penalty. Preserved raw Modifiers already compute Lightning Reflexes, Toughness and Defensive Combat Training; no duplicate numerical output is added.

Outstanding mechanics stay separate from source and notice holds:

- All 100 imports retain `detail.repeatable: unreviewed`. Special-clause facts are recorded per source, but the importer does not supply the promised duplicate/choice model. Skill Focus, Fleet, Rapid Reload and the Extra feats must not be treated as fully structured choices or repeatability.
- Heavy/Light Armor and Exotic Weapon Proficiency retain their exact raw proficiency arrays in evidence; imported grants are absent. Exotic proficiency must grant the chosen type rather than a placeholder or every weapon. These are importer/proficiency gaps under [#720](https://github.com/AndreasUnunger/EverythingPath/issues/720).
- Canonical CRB attack behavior already exists in the runtime, but imported opaque rule identities do not automatically select it. Power Attack, Vital Strike and Improved Vital Strike, Two-Weapon Fighting and its Improved feat, Rapid Reload and Precise Shot still need the explicit identity adapter described in [attack calculation](../attack-calculation.md). The reviewed Curation Overlay cannot change those identities. No automatic routine integration is claimed by this batch.
- Magical Aptitude and Self-Sufficient’s rank-dependent formulas contribute nothing. Skill Focus’s chosen-skill +3/+6, Master Craftsman’s chosen skill/qualification substitutions, Fleet’s armor/load-dependent speed, and Shield Focus’s equipment-dependent AC remain independently outstanding. No unconditional substitute is supplied for an unrepresented condition or chosen target.
- Improved Channel’s +2 ability DC is not spell DC. Technophobe’s triggered/timed +2 morale affects the published statistics only after its stated event. Augment Summoning’s enhancement bonuses belong to summoned creatures. These are recorded without inventing a target, activation or blanket bonus to the selecting Character.
- Supported prerequisite facts remain exported; uncheckable clauses remain readable and silent under the [rules-check contract](../character-sheet/rules-checks.md). Signature Skill’s journal-page references are stripped with `description.link` diagnostics even in the full corpus. Their exact original UUIDs remain evidence, and their 5/10/15/20-rank benefits remain prose.
- Combat Tricks, Skill Unlocks and other excluded alternate-rule automation remain prose. Crafting/GP pricing, metamagic application, daily-use pools and tactical target adjudication are not new product scope. The admitted Mounted Combat and Eschew Materials descriptions remain usable rules text rather than invented play-time calculations.

The inventory distinguishes each retained source fact, mapped output, uncheckable clause, unmodeled quantity and explicit prose-only scope. Class schedules through level 20, gear Base Items/end state and companion-version inputs are inapplicable. No application or importer implementation is changed; #719/#720 remain the owning importer work rather than fixes hidden in this content batch.


## Public resolver and isolated saved-sheet evidence

[Focused tests](../../tests/catalog/feats-330.test.ts) use [byte-exact pinned source fixtures](../../tests/fixtures/feats-330/README.md) and the reviewed catalog preview. All 100 source/description hashes, exact keys, assessments, individual holds and source facts are verified. All twelve admitted comparisons have current content/mapping/evidence/notice bindings; a changed benefit changes its content binding.

At the public pure boundary, Lightning Reflexes with Dex 14 gives Reflex 4 in both current and permanent projections: +2 Dex and +2 feat. Fortitude and Will remain 0 in this classless isolated build. Point-Blank Shot gives no ordinary bonus and, only in `within30ft`, supplies +1 ranged attack and damage with no melee effect. Improved plus Greater Disarm give +4 CMB in offensive `disarm`; the separate defensive Situation gives only +2 CMD. Reposition gives the corresponding +4 offensive CMB. Greater Spell Penetration supplies +2 only in `spellResistance`, never ordinary caster level or the unrelated `spells` Situation. Toughness uses actual HD: +3 HP at 0/1/3 HD, +4 at 4 and +8 at 8 even with zero Class Levels. These held-feat calculations are review evidence, not admission of their full definitions.

[The isolated saved-sheet test](../../convex/catalogFeats330.integration.test.ts) materializes admitted Lightning Reflexes from the tracked catalog preview while preserving its stable rule identity, description, sources and numerical Modifier. Its deliberately narrow fixture adapter omits the importer’s unusable `unreviewed` repeatability field rather than inventing a replacement. Existing authored demo catalog fixtures supply the fighter; no production content or release is installed. A campaign member records fighter 1, HP 10 and Dex 14 through public writers. The authorized saved read has Reflex 2 before the feat and 4 after Selection, in both projections, matching catalog-preview calculation. Another member reads the same result. Deactivating the Selection returns Reflex to 2 while retaining the same row/definition; reactivation restores 4. Outsider reads and edits are rejected, and the refused edit leaves Reflex 4.

The tests deliberately expose missing Skill Focus, rank-dependent skill bonuses, proficiency and equipment-dependent outputs rather than treating a rendered fallback as a computed rule. No browser, remote deployment, catalog activation or initial migration was performed. The existing #328 shared-Situation assertion now examines that race batch’s users: new feat-only vocabulary cannot make an unrelated race-review test reject the established `within30ft` identity. Its original race assertions still pass.


## Commands and observed results

The initial drafter selected exactly the ticket’s 100 keys. Its 16 required drafts and 50 prose drafts were reviewed; diagnosed draft outputs were not accepted without review. The final resumes retain all 156 overlay records, add or replace none, and report complete required coverage for this selection. Neither source checkout verification nor attribution admission is bypassed.

The commands below reproduce this batch from the tracked inventory. Output directories are git-ignored local scratch, removed after the results and fingerprints were recorded. The large full-corpus drafts are unreviewed operator output and are not added to the shipping overlay.

```sh
PF1_CURATION_SYSTEM="$PWD/../sources/foundryvtt-pathfinder1"
PF1_CURATION_CONTENT="$PWD/../sources/pf1-content"
mkdir -p .scratch/cur330
node --input-type=module <<'JS'
import fs from 'node:fs';
const review = JSON.parse(fs.readFileSync('scripts/catalog/legal/feats-330.json', 'utf8'));
fs.writeFileSync('.scratch/cur330/keys.json',
  JSON.stringify(review.candidates.map(({ externalKey }) => externalKey), null, 2) + '\n');
JS
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/cur330/keys.json --out .scratch/cur330/drafts
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/cur330/keys.json --records .scratch/cur330/drafts/records.json --descriptions --out .scratch/cur330/prose
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/cur330/keys.json --records scripts/catalog/reviewed-curation.json --out .scratch/cur330/reviewed-drafts
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/cur330/keys.json --records scripts/catalog/reviewed-curation.json --descriptions --out .scratch/cur330/reviewed-prose
pnpm -s catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --candidates .scratch/cur330/keys.json --out .scratch/cur330/final-bounded
pnpm -s catalog:preview --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/cur330/final-full
pnpm -s catalog:curate --system "$PF1_CURATION_SYSTEM" --content "$PF1_CURATION_CONTENT" --out .scratch/cur330/full-drafts
pnpm -s typecheck
pnpm -s lint
pnpm -s check:initial-migration-writers
pnpm catalog:pin
pnpm test tests/catalog/feats-330.test.ts convex/catalogFeats330.integration.test.ts
pnpm test tests/catalog --maxWorkers=2
pnpm test --maxWorkers=2
git diff --check
```

| Check | Observed result |
| --- | --- |
| Pinned checkout/manifests | Both verified, no override |
| Initial required draft | Exit 0; 16 new required records, two unresolved drafts subsequently corrected |
| Initial separate description pass | Exit 0; 50 description drafts, subsequently checked |
| Final bounded draft/prose resumes | Exit 0; 156 retained records, zero added/replaced; 16 checked required and 50 checked descriptions |
| Bounded import inventory | 100 entries, zero resources/exclusions/unassigned; exact selection accounted |
| Bounded curation | Pass; no missing/stale/unresolved required or description records |
| Bounded admission | Exit 1: 12 admitted, 38 held, 50 reference failures; zero dependent omissions/exceptions |
| Full admission | Exit 1: 23,037 entries, 538 resources; 12 admitted, 23,172 held, 4,774 failures; zero dependent omissions/exceptions |
| Batch outcomes within full admission | 12 admitted, 77 held, 11 existing Signature Skill reference failures; zero batch missing-note or stale-binding failures |
| Full-corpus drafter | Exit 0; 3,824 records, 3,668 new drafts, zero replaced/missing; 768 unreviewed unresolved mechanics outside this batch |
| `pnpm -s typecheck` | Pass after fixture-only type correction |
| `pnpm -s lint` | Pass |
| `pnpm -s check:initial-migration-writers` | Pass; 172 registrations |
| `pnpm catalog:pin` | Pass; `sha256:6607d068facda14d40eddebe4e916952e8c668997ecadde9dbdc550e946f5518` |
| Final focused tests | Pass; two files, 14 tests; 1.53 seconds |
| Final `pnpm test tests/catalog --maxWorkers=2` | Pass; 21 files, 351 tests; 22.04 seconds |
| Foreground full `pnpm test --maxWorkers=2` | Pass; 500 files, 6,293 tests; 488.45 seconds; exit 0 |
| `git diff --check` | Pass |

The full-corpus baseline had 4,790 failures: 3,684 missing curation records, 715 unaccounted inventory records and 391 broken structures/references. This review resolves exactly sixteen missing records. The final total of 4,774 comprises 3,668 remaining missing records outside the batch, the same 715 unaccounted records and the same 391 structure/reference failures. No new full-corpus failure is introduced.

The eleven Signature Skill journal references occur in both the baseline and final full gate. Bounded admission additionally fails 39 candidates whose catalog dependencies are outside this exact selection. Thus the editorial 88 holds are not all CLI hold rows: 50 are classified as failed by bounded reference validation, and eleven remain failed in the full artifact. The inventory preserves each actual full-gate diagnostic and original journal UUID. Neither a named attribution hold nor required-note coverage turns those failures into a passing release gate.

All twelve accepted assessment bindings match the final full artifact and bounded artifact. The complete final full CLI ran after the evidence was updated; no post-hoc reassessment substitutes for its observed result.

Final bounded fingerprints: extraction `5a9b8fd336068646d2d9438a524b971ac366e82f1ae211409c5c7bb137c0667e`; reviewed inputs `5b0d9e8153cd2281f61b583c87c7b53b21965cc18f624f684c4ce32d2c897d1a`; legal resources `5ff025c7499a505ec206cc391e5c7a40fb5e190a1262c786f97145208561a97e`; admission-report SHA-256 `f53ff95524ed9a1c1e4a61fc4369aa94877e8ad89afc577c27b2d56d64d25514`.

Final full extraction fingerprint `521e685562f4ce4b5f561e5e838593ffe5256d28e80fb1607408c30efe0f26c7`; admission-report SHA-256 `42aecc4b5a0a43861bb880087183c78b2070c85cf29e257e1464c0de596b94fe`. Reviewed-input and legal fingerprints equal the bounded values. No notice or runtime calculation fingerprint changes.

```text
 Test Files  500 passed (500)
      Tests  6293 passed (6293)
   Start at  14:32:38
   Duration  488.45s (transform 16.82s, setup 31.93s, import 86.58s, tests 716.32s, environment 106.92s)
```

The full suite runs in the foreground with two workers, following the successful #329 setting. No tests are skipped and no timeouts or implementation are changed to obtain the result.


## Timing and workflow observations

Phase times are approximate wall time and overlap: briefing/contracts and exact-key setup, 12:08–12:12 UTC (about four minutes); source comparison, drafting, record review and focused fixture implementation, 12:10–12:31 (about 21 minutes); report and independent source sample, 12:17–12:41 UTC (about 24 minutes); automated gates and checks, 12:11–12:41 UTC (about 30 minutes). The foreground full suite began at 12:32:39 UTC and took 488.45 seconds (about eight minutes). Total elapsed time was about 33 minutes (12:08–12:41 UTC).

The independent Sol reviewer sampled ten risky candidates against the pinned source, then checked all 100 source/description hashes, PCGen evidence-line hashes and reviewer metadata, and recomputed the twelve admitted assessment bindings. The sample corrected the draft Arcane Armor Training output and removed implementation language from rendered rules notes before final gates. The final sample found no new findings. The required Fable reviewer and the repository's requested Opus implementation model are not available in this environment; inherited Sol agents performed the implementation and independent sample. This is recorded as a workflow limitation, not a completed Fable review.

The new fixture adapter initially failed typecheck because the general curation output type permits chosen targets and conditions that the narrower runtime validators do not accept. Test-only narrowing corrected that mismatch; final typecheck and focused tests pass. No importer or product fix was needed. The existing race sample test was scoped to its own candidates so unrelated feat Situations do not invalidate its original assertions.

No book PDFs were available; no invented complete comparisons or notice chains were used. The existing #264/#265 complete-chain notice holds remain documentary evidence rather than enforced entries in `known-notice-holds.json`; this batch records the gap and admits only independently reviewed CRB content. Those holds and this batch's own notice-chain holds are now enforced through `held-notices.json` (see [curation.md](curation.md#notice-holds-from-content-batches)). Importer gaps remain under #719/#720, and the eleven existing journal-reference failures remain exposed. The final CLI results are reported as failures where observed, rather than called passing release gates.

Changes are limited to the batch inventory and report, checked overlay and attribution data, 100 byte-exact YAML fixtures with provenance/preview/adapter, focused pure and isolated saved-sheet tests, and the scoped #328 test assertion. Existing assessment, evidence and overlay records and shared Situations are semantically preserved. Changes are left uncommitted. Scratch outputs are removed after recording these results; no answer file is stored in the repository.
