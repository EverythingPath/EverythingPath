# Class abilities #605: Smite Evil and Inspire Competence and Ki Pool (MVP launch subset, #605 wave C)

MVP launch subset of #605: this inventory curates only pf1/2TsDfK0SKC8IGVx4 (Smite Evil), pf1/2M56kfIOws5yYtxq (Inspire Competence) and pf1/2Og23i3rRXu5QQlg (Ki Pool); the ticket's other 97 keys stay remaining acceptance under #605. The 97 remaining keys are listed in the inventory's `launchSubset.remainingAcceptance` ([`class-abilities-605.json`](../../scripts/catalog/legal/class-abilities-605.json)) and stay this ticket's acceptance.

| Key                                       | Disposition | Assessment | Required notices | Increments | Evidence                               |
| ----------------------------------------- | ----------- | ---------- | ---------------- | ---------- | -------------------------------------- |
| `pf1/2TsDfK0SKC8IGVx4` Smite Evil         | admitted    | confirmed  | PZO1110, PZO1131 | 6          | `class-abilities-605-2TsDfK0SKC8IGVx4` |
| `pf1/2M56kfIOws5yYtxq` Inspire Competence | admitted    | confirmed  | PZO1110          | 4          | `class-abilities-605-2M56kfIOws5yYtxq` |
| `pf1/2Og23i3rRXu5QQlg` Ki Pool            | admitted    | confirmed  | PZO1110, PZO1131 | 3          | `class-abilities-605-2Og23i3rRXu5QQlg` |

Its 6 increments (`everythingpath/paladin-smite-evil-10`, `everythingpath/paladin-smite-evil-13`, `everythingpath/paladin-smite-evil-16`, `everythingpath/paladin-smite-evil-19`, `everythingpath/paladin-smite-evil-4`, `everythingpath/paladin-smite-evil-7`) have no assessment of their own. Each has `attributionFrom: pf1/2TsDfK0SKC8IGVx4`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Smite Evil is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

Its 4 increments (`everythingpath/bard-inspire-competence-11`, `everythingpath/bard-inspire-competence-15`, `everythingpath/bard-inspire-competence-19`, `everythingpath/bard-inspire-competence-7`) have no assessment of their own. Each has `attributionFrom: pf1/2M56kfIOws5yYtxq`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Inspire Competence is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

Its 3 increments (`everythingpath/monk-ki-pool-10`, `everythingpath/monk-ki-pool-16`, `everythingpath/monk-ki-pool-7`) have no assessment of their own. Each has `attributionFrom: pf1/2Og23i3rRXu5QQlg`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Ki Pool is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

## #605 wave C

This report belongs to #605 wave C (curation [#605](https://github.com/AndreasUnunger/EverythingPath/issues/605), increment parents wave C), which assesses ten class-feature parents across five batches so that their 39 schedule increments admit with them. This is the run report. Reviewer: Opus (AI curator) for the owner, 2026-11-04. Sources: pf1 v11.11 (`418761d2`), the PRD capture `prd-2026-10-20` and PCGen `25523dbc`. No book PDFs; Archives of Nethys not used.

Bonus Feats (WIZ) (`pf1/2h3lI574tmVjOalQ`) is this ticket's too. It stays remaining acceptance: it is dependently omitted on held linked entries and runs after waves A to C (the increment-parents research, "Excluded").

## Evidence

### Smite Evil (`pf1/2TsDfK0SKC8IGVx4`)

- **Body:** [`packs/class-abilities/smite-evil.2TsDfK0SKC8IGVx4.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/smite-evil.2TsDfK0SKC8IGVx4.yaml) (sha256 `0b7dbed5e9a0…`); Core Rulebook p. 60. The pinned record imports no sources (`sources: []`); the assessment cites the book from the PRD and PCGen.
- **PRD:** `coreRulebook/classes/paladin.html:385,386,387`. Smite Evil: 8 of the body's 9 sentences identical; the third reads "her Cha bonus" where the PRD reads "her Charisma bonus". Same rule, same book.
- **PCGen:** `cr_abilities_class.lst:1357`. Core Rulebook Paladin ~ Smite Evil row: DESC restates the rule in the second person, the uses and bonuses as variables (SmiteEvilTimes = min((SmiteEvilLVL+2)/3,7)); SOURCEPAGE p.60.
- **Grant:** Granted at Paladin level 1: Foundry classAssociations; PCGen cr_abilities_class.lst:273. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Smite evil uses per day by paladin level = 1 + floor((level - 1) / 3): 1/day at 1st, 2/day at 4th and one more every three levels, 7/day at 19th (PRD paladin.html:385, :387 and Table: Paladin :358-377); PCGen's min((SmiteEvilLVL+2)/3,7) (cr_abilities_class.lst:1357) agrees; Foundry's uses.maxFormula floor((@attributes.hd.total - 1) / 3) + 1 counts Hit Dice. Per level: 1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 4, 11: 4, 12: 4, 13: 5, 14: 5, 15: 5, 16: 6, 17: 6, 18: 6, 19: 7, 20: 7.
- **Increment names:** each checked against its class table row: `paladin-smite-evil-4` "Smite Evil 2/day" (`paladin.html:361`, "Channel positive energy, smite evil 2/day"); `paladin-smite-evil-7` "Smite Evil 3/day" (`paladin.html:364`, "Smite evil 3/day"); `paladin-smite-evil-10` "Smite Evil 4/day" (`paladin.html:367`, "Smite evil 4/day"); and the other 3 likewise.
- **Record:** `description` on `description` (`d1259da0…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, because the body sits in other batches' committed fixtures (the protected and binding contexts of spells-530 to -536 and feats-350 to -355, among others) and in their assessed closures (the Smite Evil buff (`pf1-content/Vbbl4AC1L593crS7`, pf-buffs-549) and two traits (`pf1-content/RGrxCJTn2HTjjVdr`, traits-375; `pf1-content/cyYiNv3Aara9tS77`, traits-379)); a Note would change the entry they hold. The imported entry is identical to the base import.
- **Notices:** PZO1110, PZO1131, each reviewed with no hold in force. PZO1110: Core Rulebook class feature Smite Evil and the rules it applies (granted by Paladin). PZO1131: Retained Unchained action-cost metadata (activation.unchained) on the record's actions, kept in gameContent (curation.md, "Unchained action costs", #367).
- **Outstanding calculations** (never holds):
  - Smite evil uses per day, 1 + floor((paladin level - 1) / 3) (Foundry uses.maxFormula, retained in gameContent) — owner #605. No feature-use resource on the sheet; the description states the rule.
  - The smite's Charisma bonus to attack, paladin level to damage (2 per level on the first hit against evil outsiders, evil dragons and undead), DR bypass and deflection bonus to AC against the target — owner #605. The smite target is not a sheet input and these bonuses have no Modifier; the description states them.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #605. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset).
- **Source discrepancies** (recorded, not resolved):
  - Foundry's pinned record imports no sources (system.sources absent; the import's sources: []); the assessment cites the Core Rulebook, p. 60 (PCGen SOURCEPAGE:p.60), from the PRD and PCGen. Importer gap: reported, not fixed.
  - The body reads "her Cha bonus" where the PRD reads "her Charisma bonus" (paladin.html:385). Same rule; recorded, not resolved; the text stays verbatim.
  - Foundry's action carries Unchained action metadata (activation.unchained, type action), retained in gameContent; PZO1131 is required (curation.md, "Unchained action costs", #367).
- **Binding:** content `0fbf1a761cd9…`, from `buildAssessmentBinding` over the full-corpus preview of the final records. The parent's closure is the entry alone.

### Inspire Competence (`pf1/2M56kfIOws5yYtxq`)

- **Body:** [`packs/class-abilities/inspire-competence.2M56kfIOws5yYtxq.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/inspire-competence.2M56kfIOws5yYtxq.yaml) (sha256 `2a7681bfe94c…`); Core Rulebook p. 37.
- **PRD:** `coreRulebook/classes/bard.html:423`. Inspire Competence: 5 of the body's 7 sentences identical; the body reads "The ally must be within 30 feet and able to see and hear the bard" where the PRD reads "That ally must be within 30 feet and be able to hear the bard", and lower-cases the last sentence's "inspire competence". Same ability, same book.
- **PCGen:** `cr_abilities_class.lst:525`. Core Rulebook Bardic Performance ~ Inspire Competence row: DESC follows the PRD ("That ally must be within 30 feet and be able to hear you"), the bonus as InspireCompetenceCount = (BardicPerformanceLVL+5)/4; SOURCEPAGE p.37.
- **Grant:** Granted at Bard level 3: Foundry classAssociations; PCGen cr_abilities_class.lst:505. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Inspire competence bonus by bard level = 2 + floor((level - 3) / 4) from 3rd: +2 at 3rd, +3 at 7th, +6 at 19th (PRD bard.html:423 and Table: Bard :358-377); PCGen's InspireCompetenceCount (BardicPerformanceLVL+5)/4 (cr_abilities_class.lst:525) agrees. Per level: 1: 0, 2: 0, 3: 2, 4: 2, 5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 3, 11: 4, 12: 4, 13: 4, 14: 4, 15: 5, 16: 5, 17: 5, 18: 5, 19: 6, 20: 6.
- **Increment names:** each checked against its class table row: `bard-inspire-competence-7` "Inspire Competence +3" (`bard.html:364`, "Inspire competence +3"); `bard-inspire-competence-11` "Inspire Competence +4" (`bard.html:368`, "Inspire competence +4, inspire courage +3, lore master 2/day"); `bard-inspire-competence-15` "Inspire Competence +5" (`bard.html:372`, "Inspire competence +5, inspire heroics"); and the other 1 likewise.
- **Record:** `description` on `description` (`66a063d0…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, because the body sits in other batches' committed fixtures (the protected and binding contexts of spells-530 to -536 and feats-350 to -355, among others) and in their assessed closures (the Inspire Competence buff (`pf1-content/ExpWHnhptAuWwAqZ`, pf-buffs-548)); a Note would change the entry they hold. The imported entry is identical to the base import.
- **Notices:** PZO1110, each reviewed with no hold in force. PZO1110: Core Rulebook class feature Inspire Competence and the rules it applies (granted by Bard).
- **Outstanding calculations** (never holds):
  - The ally's competence bonus on one skill, +2 at 3rd to +6 at 19th, and the bardic performance rounds it spends — owner #605. The bonus applies to an ally, not the bard's sheet, and bardic performance has no resource on the sheet; the description states the rule.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #605. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset).
- **Source discrepancies** (recorded, not resolved):
  - The body reads "The ally must be within 30 feet and able to see and hear the bard" where the PRD capture (bard.html:423) and PCGen (cr_abilities_class.lst:525) read "That ally must be within 30 feet and be able to hear". Same ability, same book; recorded as a printing difference, not resolved; the text stays verbatim.
  - The body lower-cases "inspire competence relies on audible components". Recorded; the text stays verbatim.
  - Bardic Pretender (packs/class-abilities/bardic-pretender.lJNsUQjIH3OxKP2Q.yaml) links the body by UUID. Recorded.
- **Binding:** content `98496b9712c9…`, from `buildAssessmentBinding` over the full-corpus preview of the final records. The parent's closure is the entry alone.

### Ki Pool (`pf1/2Og23i3rRXu5QQlg`)

- **Body:** [`packs/class-abilities/ki-pool.2Og23i3rRXu5QQlg.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/ki-pool.2Og23i3rRXu5QQlg.yaml) (sha256 `a6d438854c88…`); Core Rulebook p. 59.
- **PRD:** `coreRulebook/classes/monk.html:408,409,410`. Ki Pool (CRB): 9 of the body's 10 sentences identical; the body lists the three 1-point uses ("a monk can do one of the following") where the PRD gives them as three sentences (:409). Same rule.
- **PCGen:** `cr_abilities_class.lst:1101`. Core Rulebook Monk ~ Ki Pool row: DESC summarises the pool ("You have a pool of %1 ki points"); SOURCEPAGE p.59.
- **PCGen:** `cr_abilities_class.lst:1195`. Core Rulebook Monk ~ Ki Pool.MOD row: the magic ki strike step while Monk_CF_KiPoolAbilities1 is unset; :1196-1198 add the 7th, 10th and 16th.
- **Grant:** Granted at Monk level 4: Foundry classAssociations; PCGen cr_abilities_class.lst:180. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Ki strike steps by monk level: magic at 4th, cold iron and silver at 7th, lawful at 10th, adamantine at 16th (PRD monk.html:408 and Table: Monk :357-376, "Ki pool (magic)" to "Ki pool (adamantine)"; PCGen cr_abilities_class.lst:1195-1198); the pool holds 1/2 monk level + Wisdom modifier points from 4th. Per level: 1: 0, 2: 0, 3: 0, 4: 1, 5: 1, 6: 1, 7: 2, 8: 2, 9: 2, 10: 3, 11: 3, 12: 3, 13: 3, 14: 3, 15: 3, 16: 4, 17: 4, 18: 4, 19: 4, 20: 4.
- **Increment names:** each checked against its class table row: `monk-ki-pool-7` "Ki Pool (cold iron/silver)" (`monk.html:363`, "Ki pool (cold iron/silver), wholeness of body"); `monk-ki-pool-10` "Ki Pool (lawful)" (`monk.html:366`, "Bonus feat, ki pool (lawful), slow fall 50 ft."); `monk-ki-pool-16` "Ki Pool (adamantine)" (`monk.html:372`, "Ki pool (adamantine), slow fall 80 ft."); and the other 0 likewise.
- **Record:** `description` on `description` (`08e1a3e2…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, because the body sits in other batches' committed fixtures (the protected and binding contexts of spells-530 to -536 and feats-350 to -355, among others); a Note would change the entry they hold. The imported entry is identical to the base import.
- **Notices:** PZO1110, PZO1131, each reviewed with no hold in force. PZO1110: Core Rulebook class feature Ki Pool and the rules it applies (granted by Monk). PZO1131: Retained Unchained action-cost metadata (activation.unchained) on the record's actions, kept in gameContent (curation.md, "Unchained action costs", #367).
- **Outstanding calculations** (never holds):
  - Ki points, 1/2 monk level + Wisdom modifier (Foundry uses.maxFormula, retained in gameContent), and their 1-point uses (an extra flurry attack, +20 ft. speed, +4 dodge bonus to AC) — owner #605. No feature-use resource on the sheet; the description states the rule.
  - Ki strike: unarmed attacks count as magic, cold iron and silver, lawful and adamantine against damage reduction and hardness — owner #605. Damage reduction bypass is not a sheet statistic; the description and the increments' names state it.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #605. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset).
- **Source discrepancies** (recorded, not resolved):
  - The body lists the three 1-point uses ("a monk can do one of the following") where the PRD capture gives three sentences (monk.html:409). Same rule; recorded, not resolved; the text stays verbatim.
  - Foundry's action carries Unchained action metadata (activation.unchained, type action), retained in gameContent; PZO1131 is required (curation.md, "Unchained action costs", #367).
- **Binding:** content `017fd2a22daf…`, from `buildAssessmentBinding` over the full-corpus preview of the final records. The parent's closure is the entry alone.

## Tests

[`class-abilities-605.test.ts`](../../tests/catalog/class-abilities-605.test.ts). The batch test uses the shared checks in [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts), unchanged since wave A (`describeIncrementParent`): the inventory and launch-subset statement; the pinned body, checked record, PRD lines, PCGen rows, Foundry associations and each increment's name against its class table from the shared store; a re-extraction with committed curation, the binding re-built, and the gate admitting the parent with exactly its increments (an edited body admits neither); and the batch's own rows. Each parent adds that it has no Note, its unmapped Foundry changes, its outstanding owners and its schedule formula. The committed preview is [`tests/fixtures/class-abilities-605/binding-preview.json`](../../tests/fixtures/class-abilities-605/binding-preview.json): the parents as entries, each closure the entry alone, and their increments.

## Run results

Full-corpus `catalog:preview` at the pins (`inputVerification: verified`):

|                 | Admitted      | Held             | Dependent omissions | Failures                       |
| --------------- | ------------- | ---------------- | ------------------- | ------------------------------ |
| Base `2f62097d` | 447           | 23,352           | 174                 | 1,761                          |
| Wave C          | **498** (+51) | **23,303** (−49) | **172** (−2)        | 1,761 (identical, key for key) |

Newly admitted: the ten parents and their 39 increments, exactly the research list, and two buffs whose confirmed assessments were dependently omitted only on these parents: Inspire Competence (`pf1-content/ExpWHnhptAuWwAqZ`, pf-buffs-548, on `pf1/2M56kfIOws5yYtxq`) and Smite Evil (`pf1-content/Vbbl4AC1L593crS7`, pf-buffs-549, on `pf1/2TsDfK0SKC8IGVx4`). Their own assessments, bindings and entries are unchanged; nothing else moves, and no catalog entry differs from base.

| Parent               | Batch | Increments | Required notices |
| -------------------- | ----- | ---------- | ---------------- |
| Smite Evil           | #605  | 6          | PZO1110, PZO1131 |
| Bloodrager Bloodline | #612  | 5          | PZO1129          |
| Teamwork Feat        | #609  | 5          | PZO1115          |
| Revelation           | #632  | 5          | PZO1115          |
| Inspire Competence   | #605  | 4          | PZO1110          |
| Bloodline Feat (BLO) | #649  | 4          | PZO1129          |
| Order                | #632  | 3          | PZO1115          |
| Ki Pool              | #605  | 3          | PZO1110, PZO1131 |
| Ki Pool (UC)         | #609  | 3          | PZO1110, PZO1131 |
| Slayer's Advance     | #649  | 1          | PZO1129, PZO1131 |

## Launch inventory

The notice authority was rebuilt with S1's procedure and its hash rebound: `noticeAuthoritySha256` `9a06a7cc…` → `ef1c295e…`; `catalog:launch-inventory --write`, then `--check`, pass.

- **Identity:** `fa66a70e…` → `aa4b2701…`; rows 19,267, required launch failures 96,703 and required notices 70 unchanged.
- **Moves:** the ten rows' admission, content and notice evidence now cite their inventories (30 fields); 9 source-metadata notice edges give way to 14 inventory edges (Teamwork Feat, Revelation and Order gain PZO1115, Smite Evil PZO1110, and Ki Pool (UC) PZO1110 for the haste its body names, which their records don't import), in the inventory, the notice document and its path graph; the notice inputs gain the five inventories' hashes. The other scope files move only in the authority hash.
- **Met:** not regenerated here (`campaign-mvp-v1.verification.json` is the root's prep step). The research expects **+39 met** (the increments); the ten parents stay unmet on `Feature/option grants and conditions`.
- **Pins:** `launch-document.test.ts` (the identity).

## Importer gaps

- Smite Evil, Teamwork Feat, Revelation and Order import `sources: []`: their pinned records carry no `system.sources`. Each assessment names its book (PZO1110 or PZO1115), which the gate accepts. No structure record is added.

## Shared store

<!-- prep:shared-store-count -->
New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `2f62097d`: **3** (pf1 3).
<!-- /prep:shared-store-count -->

Wave C adds three Foundry bodies to the shared store, byte-identical to pf1 `418761d2`: `packs/class-abilities/bloodrager-bloodline.Aq9rx7oWgv7A7kiV.yaml`, `revelation.adu4NROFqgwv70sw.yaml` and `ki-pool.2Og23i3rRXu5QQlg.yaml`. The batch tests re-extract each parent from the store, and these three were not on the base. Every class record, PRD page and PCGen file the run cites was already there.

## Preservation

The shared files gain only the run's rows: 10 description records, 10 assessments and 10 evidence entries. No record adds an output, so every catalog entry of the final full-corpus preview equals the base import: no other batch's assessment, binding or committed fixture moves (five assessments' closures reach Smite Evil, Inspire Competence or Revelation, and the ten bodies sit in the protected and binding contexts of spells-530 to -536 and feats-350 to -355, among others). No Registry, `held-notices.json`, `notice-clearances.json` or `known-notice-holds.json` change. The shared helper [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts) is reused unchanged.
