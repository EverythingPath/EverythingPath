# Class abilities #615: Sorcerer Bloodline and Mercy (MVP launch subset, #615 wave D)

MVP launch subset of #615: this inventory curates only pf1/F5mCXQR9VZfKfpTH (Sorcerer Bloodline) and pf1/Er8h3fZ2edJEviTv (Mercy); the ticket's other 98 keys stay remaining acceptance under #615. The 98 remaining keys are listed in the inventory's `launchSubset.remainingAcceptance` ([`class-abilities-615.json`](../../scripts/catalog/legal/class-abilities-615.json)) and stay this ticket's acceptance.

| Key                                       | Disposition | Assessment | Required notices | Increments | Evidence                               |
| ----------------------------------------- | ----------- | ---------- | ---------------- | ---------- | -------------------------------------- |
| `pf1/F5mCXQR9VZfKfpTH` Sorcerer Bloodline | admitted    | confirmed  | PZO1110          | 4          | `class-abilities-615-F5mCXQR9VZfKfpTH` |
| `pf1/Er8h3fZ2edJEviTv` Mercy              | held        | unresolved | PZO1110, PZO9475 | 5          | `class-abilities-615-Er8h3fZ2edJEviTv` |

Its 4 increments (`everythingpath/sorcerer-bloodline-15`, `everythingpath/sorcerer-bloodline-20`, `everythingpath/sorcerer-bloodline-3`, `everythingpath/sorcerer-bloodline-9`) have no assessment of their own. Each has `attributionFrom: pf1/F5mCXQR9VZfKfpTH`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Sorcerer Bloodline is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

Its 5 increments (`everythingpath/paladin-mercy-12`, `everythingpath/paladin-mercy-15`, `everythingpath/paladin-mercy-18`, `everythingpath/paladin-mercy-6`, `everythingpath/paladin-mercy-9`) have no assessment of their own. Each has `attributionFrom: pf1/Er8h3fZ2edJEviTv`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Mercy is (`scripts/catalog/admission.ts`, `isAttributionOwner`); while Mercy is held, they stay held with it.

## #615 wave D

This report belongs to #615 wave D (curation [#615](https://github.com/AndreasUnunger/EverythingPath/issues/615), increment parents wave D), which assesses nine class-feature parents across six batches so that their schedule increments admit with them: eight parents and 21 increments admitted, Mercy and its 5 increments held. This is the run report. Reviewer: Opus (AI curator) for the owner, 2026-11-05. Sources: pf1 v11.11 (`418761d2`), pf1-content 11.4.0, the PRD capture `prd-2026-10-20` and PCGen `25523dbc`. No book PDFs; Archives of Nethys not used.

## Evidence

### Sorcerer Bloodline (`pf1/F5mCXQR9VZfKfpTH`)

- **Body:** [`packs/class-abilities/sorcerer-bloodline.F5mCXQR9VZfKfpTH.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/sorcerer-bloodline.F5mCXQR9VZfKfpTH.yaml) (sha256 `ae956c727800…`); Core Rulebook p. 71-77.
- **PRD:** `coreRulebook/classes/sorcerer.html:415`. Bloodline (its general paragraph): identical to the body after the heading. The PRD's bonus-spell (:416) and bonus-feat (:417) paragraphs are Foundry's Bloodline Spells (SOR) and Bloodline Feat (SOR).
- **PCGen:** `cr_abilities_class.lst:1698`. Core Rulebook Sorcerer ~ Standard Bloodline row: DESC reproduces the paragraph word for word (BONUS:ABILITYPOOL|Bloodline|1); SOURCEPAGE p.71.
- **Grant:** Granted at Sorcerer level 1: Foundry classAssociations; PCGen cr_abilities_class.lst:308. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Bloodline powers by sorcerer level: the bloodline and its first power at 1st, one more at 3rd, 9th, 15th and 20th, 5 at 20th (PRD sorcerer.html:415 and Table: Sorcerer :359-378, "Bloodline power" at 1st, 3rd, 9th, 15th and 20th); PCGen's bloodline template defines Sorcerer_xxx_BloodlinePower1, 3, 9, 15 and 20 (cr_abilities_class.lst:2320-2324). Per level: 1: 1, 2: 1, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 8: 2, 9: 3, 10: 3, 11: 3, 12: 3, 13: 3, 14: 3, 15: 4, 16: 4, 17: 4, 18: 4, 19: 4, 20: 5.
- **Increment names:** each checked against its class table row: `sorcerer-bloodline-3` "Bloodline Power" (`sorcerer.html:361`, "Bloodline power, bloodline spell"); `sorcerer-bloodline-9` "Bloodline Power" (`sorcerer.html:367`, "Bloodline power, bloodline spell"); `sorcerer-bloodline-15` "Bloodline Power" (`sorcerer.html:373`, "Bloodline power, bloodline spell"); and the other 1 likewise.
- **Record:** `description` on `description` (`af8cb03a…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, so the imported entry stays identical to the base import and the assessed closures that reach it (`pf1-content/0CISUAPF2V91vvoo`, racial-traits-387; `pf1-content/0iFqZXfHNt2vAJ8h`, racial-traits-387; `pf1-content/BgNdXPtHRUJOuPwF`, racial-traits-390; `pf1-content/DFWkrIYLx6L7Vs6W`, racial-traits-390; `pf1-content/Hp26XuRpA7QNUOZO`, racial-traits-392; `pf1-content/JLGJMVewolF9XNVW`, racial-traits-392; `pf1-content/NBmeuhkyRCjD3kV4`, racial-traits-393; `pf1-content/UMT2CcRjz9uXlsvb`, racial-traits-396; `pf1-content/WE57FyExdDq2mjnV`, racial-traits-396; `pf1-content/a1otKF9eFw6gSfvB`, racial-traits-397; `pf1-content/emgcgmgSjpuv1GHa`, racial-traits-399; `pf1-content/iWZjiKTQnGS5XnB0`, racial-traits-400; `pf1-content/izCRmMUEyikdfpiq`, racial-traits-400; `pf1-content/jAQXQDgwCX0eKxZ2`, racial-traits-400; `pf1-content/kLPypNzy62fMbj3d`, racial-traits-400; `pf1/4qEXPDlfIj1cIvCe`, races-328; `pf1/TPHe88Yhy4SsDpKo`, races-328; `pf1/iqJvhd7NbmybUl0y`, races-328; `pf1/nVjKDLZSRONzYm8f`, races-328; `pf1/pbX1xj9Z0ZhUfKvZ`, races-328) keep their bindings; other batches' committed fixtures that may hold the body keep theirs.
- **Notices:** PZO1110, each reviewed with no notice hold in force. PZO1110: Core Rulebook class feature Sorcerer Bloodline and the rules it applies (granted by Sorcerer).
- **Outstanding calculations** (never holds):
  - The bloodline pick at 1st and its class skill, bonus spells, bonus feats and bloodline powers at 1st, 3rd, 9th, 15th and 20th — owner #615. The schedule's increments carry no bloodline choice and no power; the description states the rule.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #615. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset).
- **Source discrepancies** (recorded, not resolved):
  - The body leaves out the PRD's bonus-spell and bonus-feat paragraphs (sorcerer.html:416-417), which Foundry gives as Bloodline Spells (SOR) and Bloodline Feat (SOR). Recorded, not resolved.
  - Foundry names the body "Sorcerer Bloodline"; the PRD heading is "Bloodline" and PCGen's key "Sorcerer ~ Standard Bloodline". Recorded.
- **Binding:** content `6824adc81c3a…`, from `buildAssessmentBinding` over the full-corpus preview. The parent's closure is the entry alone.

### Mercy (`pf1/Er8h3fZ2edJEviTv`)

- **Body:** [`packs/class-abilities/mercy.Er8h3fZ2edJEviTv.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/mercy.Er8h3fZ2edJEviTv.yaml) (sha256 `1946ac66596d…`); Core Rulebook p. 60-64, Healer's Handbook p. 25. The pinned record imports no sources (`sources: []`); the assessment cites the book from the PRD and PCGen.
- **Hold:** `class-abilities-615-whole-content-Er8h3fZ2edJEviTv`, a content hold (the assessment is `unresolved`), not a notice hold. No source evidence in the PRD capture, PCGen or the pinned records for 4 of the body's 46 sentences, its 12th-level mercies Amputated (2 sentences), Ensorcelled and Petrified: the PRD capture's Mercy (coreRulebook/classes/paladin.html:393-413) lists none of them, PCGen's Healer's Handbook mercy rows end with Restorative (healers_handbook/hhb_abilities_class.lst:48-55) and no other PCGen file has them, and their pf1-content records (src/pf-class-abilities/Amputated_RVf1kKtoViwrwIpw.yaml, Ensorcelled_4YunyNIyK3srpdQ5.yaml, Petrified_rXjQ9NMSAGvKLcuX.yaml) cite no source. Only the body's own "Source PPC:HH" after Ensorcelled names a book (the Healer's Handbook). No book PDF is available, so the whole content's origin stays held.
  - Amputated (12th-level mercy, 2 sentences): no PRD capture page, PCGen row or pinned record cites its book; origin unresolved.
  - Ensorcelled (12th-level mercy): only the body's own "Source PPC:HH" names the Healer's Handbook; PCGen's Healer's Handbook rows (hhb_abilities_class.lst:48-55) do not have it and its pf1-content record cites no source; origin unconfirmed.
  - Petrified (12th-level mercy): no PRD capture page, PCGen row or pinned record cites its book; origin unresolved.
- **PRD:** `coreRulebook/classes/paladin.html:393-413`. Mercy (Core Rulebook): 28 of the body's 46 sentences identical (the last differs only by "Fatigued and Exhausted" in capitals); the body adds the Healer's Handbook mercies and three untraced 12th-level mercies (see the hold).
- **PCGen:** `cr_abilities_class.lst:1361`. Core Rulebook Paladin ~ Mercy row: no DESC; the mercy pool is Mercies = min(MercyLVL/3,6). The Core Rulebook mercies are its Mercy ~ rows :1402-1416.
- **PCGen:** `hhb_abilities_class.lst:48`. Healer's Handbook paladin mercy row (SOURCEPAGE p.25): its DESC is the body's Deceived item word for word.
- **PCGen:** `hhb_abilities_class.lst:49`. Healer's Handbook paladin mercy row (SOURCEPAGE p.25): its DESC is the body's Riled item word for word.
- **PCGen:** `hhb_abilities_class.lst:50`. Healer's Handbook paladin mercy row (SOURCEPAGE p.25): its DESC is the body's Enfeebled item word for word.
- **PCGen:** `hhb_abilities_class.lst:51`. Healer's Handbook paladin mercy row (SOURCEPAGE p.25): its DESC is the body's Haunted item word for word.
- **PCGen:** `hhb_abilities_class.lst:52`. Healer's Handbook paladin mercy row (SOURCEPAGE p.25): its DESC is the body's Targeted item word for word.
- **PCGen:** `hhb_abilities_class.lst:53`. Healer's Handbook paladin mercy row (SOURCEPAGE p.25): its DESC is the body's Confused item word for word.
- **PCGen:** `hhb_abilities_class.lst:54`. Healer's Handbook paladin mercy row (SOURCEPAGE p.25): its DESC is the body's Injured item word for word up to PCGen's added "(PaladinLVL/2 rounds)".
- **PCGen:** `hhb_abilities_class.lst:55`. Healer's Handbook paladin mercy row (SOURCEPAGE p.25): its DESC is the body's Restorative item word for word.
- **Grant:** Granted at Paladin level 3: Foundry classAssociations; PCGen cr_abilities_class.lst:278. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Mercies by paladin level = floor(level / 3), at most 6: one at 3rd and every three levels after, 6 at 18th (PRD paladin.html:393 and Table: Paladin :358-377, "Mercy" at 3rd to 18th); PCGen's Mercies min(MercyLVL/3,6) (cr_abilities_class.lst:1361) agrees. Per level: 1: 0, 2: 0, 3: 1, 4: 1, 5: 1, 6: 2, 7: 2, 8: 2, 9: 3, 10: 3, 11: 3, 12: 4, 13: 4, 14: 4, 15: 5, 16: 5, 17: 5, 18: 6, 19: 6, 20: 6.
- **Increment names:** each checked against its class table row: `paladin-mercy-6` "Mercy" (`paladin.html:363`, "Mercy"); `paladin-mercy-9` "Mercy" (`paladin.html:366`, "Mercy"); `paladin-mercy-12` "Mercy" (`paladin.html:369`, "Mercy"); and the other 2 likewise.
- **Record:** `description` on `description` (`f8181451…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, so the imported entry stays identical to the base import and the assessed closures that reach it (`pf1/GCAaufQOqpQagrSk`, feats-330) keep their bindings; other batches' committed fixtures that may hold the body keep theirs.
- **Notices:** PZO1110, PZO9475, each reviewed with no notice hold in force (PZO9475 as `pcgen:PZO9475`, its reviewed PCGen Section 15 confirmation). PZO1110: Core Rulebook class feature Mercy and the rules it applies (granted by Paladin). PZO9475: The Healer's Handbook paladin mercies the body appends: Deceived, Riled, Enfeebled, Haunted, Targeted, Confused, Injured and Restorative (PCGen hhb_abilities_class.lst:48-55, SOURCELONG Healer's Handbook, SOURCEPAGE p.25), and Ensorcelled, which the body itself marks "Source PPC:HH".
- **Outstanding calculations** (never holds):
  - The mercy picks at 3rd and every three levels after, min(paladin level / 3, 6) (PCGen Mercies, cr_abilities_class.lst:1361), from the 3rd-, 6th-, 9th- and 12th-level lists, and each mercy's effect on lay on hands — owner #615. The schedule's increments carry no mercy choice and lay on hands has no resource on the sheet; the description states the rule.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #615. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset).
- **Source discrepancies** (recorded, not resolved):
  - Foundry's pinned record imports no sources (system.sources absent; the import's sources: []); the assessment cites the Core Rulebook and the Healer's Handbook, pp. 60-64 and p. 25 (PCGen SOURCEPAGE:p.25), from the PRD and PCGen. Importer gap: reported, not fixed.
  - The body appends eight Healer's Handbook mercies (PCGen hhb_abilities_class.lst:48-55) and three 12th-level mercies, Amputated, Ensorcelled and Petrified, that no permitted source traces; held (class-abilities-615-whole-content-Er8h3fZ2edJEviTv).
  - The body's "Source PPC:HH" after Ensorcelled is Foundry's source marker inside the text. Recorded; the text stays verbatim.
  - The body capitalises "Fatigued and Exhausted" in the last paragraph where the PRD capture has lower case (paladin.html:413). Recorded.
  - The CRB spells the Healer's Handbook and untraced mercies name (calm emotions, rage, protection from evil, sanctuary, regenerate, dispel magic, stone to flesh) add no book beyond PZO1110.
- **Binding:** content `ee0bd88b7721…`, from `buildAssessmentBinding` over the full-corpus preview. The parent's closure is the entry alone.

## Tests

[`class-abilities-615.test.ts`](../../tests/catalog/class-abilities-615.test.ts). The batch test uses the shared checks in [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts) (`describeIncrementParent`; `describeLaunchFeature` for the held Mercy): the inventory and launch-subset statement; the pinned body, checked record, PRD lines, PCGen rows, Foundry associations and each increment's name against its class table from the shared store; a re-extraction with committed curation, the binding re-built, and the gate admitting an admitted parent with exactly its increments (an edited body admits neither), or holding a held one with its increments; and the batch's own rows. Each parent adds that it has no Note, its unmapped Foundry changes, its outstanding owners and its schedule formula. The committed preview is [`tests/fixtures/class-abilities-615/binding-preview.json`](../../tests/fixtures/class-abilities-615/binding-preview.json): the parents as entries, each closure the entry alone, and their increments.

## Run results

Full-corpus `catalog:preview` at the pins (`inputVerification: verified`):

|                 | Admitted      | Held             | Dependent omissions | Failures                       |
| --------------- | ------------- | ---------------- | ------------------- | ------------------------------ |
| Base `39209110` | 534           | 23,267           | 172                 | 1,761                          |
| Wave D          | **564** (+30) | **23,238** (−29) | 171                 | 1,761 (identical, key for key) |

Newly admitted: the eight admitted parents and their 21 increments, exactly the research list less Mercy's, and one buff whose confirmed assessment was dependently omitted only on Inspire Courage: Inspire Courage (`pf1/3p34GJemfcLdKckV`, buffs-547, on `pf1/h56K6HEBOItImPPL`), its own assessment, binding and entry unchanged. Mercy and its five increments stay held, now on its content hold instead of "missing Attribution Assessment". Nothing else moves, and no catalog entry differs from base.

| Parent               | Batch | Disposition | Increments | Required notices |
| -------------------- | ----- | ----------- | ---------- | ---------------- |
| Sorcerer Bloodline   | #615  | admitted    | 4          | PZO1110          |
| Mercy                | #615  | held        | 5          | PZO1110, PZO9475 |
| Style Strikes (UC)   | #604  | admitted    | 4          | PZO1131          |
| Inspire Courage      | #636  | admitted    | 3          | PZO1110          |
| Bonus Feats (MAG)    | #636  | admitted    | 2          | PZO1117          |
| Favored Terrain      | #626  | admitted    | 3          | PZO1110          |
| Flurry of Blows (UC) | #626  | admitted    | 1          | PZO1110, PZO1131 |
| Lore Master          | #640  | admitted    | 2          | PZO1110, PZO1131 |
| Bonus Feat (CAV)     | #647  | admitted    | 2          | PZO1115          |

## Launch inventory

The notice authority was rebuilt with S1's procedure and its hash rebound: `noticeAuthoritySha256` `e58f6018…` → `d803384e…`; `catalog:launch-inventory --write`, then `--check`, pass.

- **Identity:** `9accfa88…` → `eaa97cd4…`; rows 19,267 → 19,268, required launch failures 96,665 → 96,666 and required notices 70 → 71: the one new row is `notice/PZO9475`, required because held Mercy (a launch row) now records its Healer's Handbook mercies. #737 owns it; its admission reads as verified (`pcgen:PZO9475`, reviewed, no hold in force), and it is the only new failing requirement.
- **Moves:** the nine rows' admission, content and notice evidence now cite their inventories (30 fields: three on each admitted row, and Mercy's three plus its admission and content state, unreviewed to held, and its #615 hold); the two coverage lists gain `notice/PZO9475`; 6 source-metadata notice edges give way to 12 inventory edges (Style Strikes (UC) PZO1131, Bonus Feat (CAV) PZO1115, Bonus Feats (MAG) PZO1117 and Mercy PZO1110, which their records don't import; Flurry of Blows (UC) PZO1110 for the haste its body names; Mercy PZO9475), in the inventory, the notice document and its path graph; the notice inputs gain the new inventories' hashes. The other scope files move only in the authority hash.
- **Met:** not regenerated here (`campaign-mvp-v1.verification.json` is the root's prep step). Expected **+21 met** (the admitted parents' increments); the eight admitted parents stay unmet on `Feature/option grants and conditions`, and Mercy's five increments stay unmet while it is held.
- **Pins:** `launch-document.test.ts` (identity, rows and failures) and `launch-notices.test.ts` (71 required notices).

## Importer gaps

- Style Strikes (UC), Bonus Feat (CAV), Bonus Feats (MAG) and Mercy import `sources: []`: their pinned records carry no `system.sources`. Each assessment names its book (PZO1131, PZO1115, PZO1117, and PZO1110 with PZO9475), which the gate accepts. No structure record is added.

## Shared store

<!-- prep:shared-store-count -->
New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `39209110`: **2** (pf1 2).
<!-- /prep:shared-store-count -->

Wave D adds two Foundry bodies to the shared store, byte-identical to pf1 `418761d2`: `packs/class-abilities/sorcerer-bloodline.F5mCXQR9VZfKfpTH.yaml` and `style-strikes-uc.0eJ9MA8iVuOG8VJi.yaml`. The batch tests re-extract each parent from the store, and these two were not on the base. Every class record, PRD page and PCGen file the run cites was already there.

## Preservation

The shared files gain only the run's rows: 9 description records, 9 assessments (8 confirmed, Mercy's unresolved) and 9 evidence entries. No record adds an output, so every catalog entry of the final full-corpus preview equals the base import: no other batch's assessment, binding or committed fixture moves (28 other assessments' closures reach Sorcerer Bloodline (20), Favored Terrain (6), Mercy (1) and Inspire Courage (1, the buffs-547 buff); all are unresolved except that buff). No Registry, `held-notices.json`, `notice-clearances.json` or `known-notice-holds.json` change: Mercy's hold is a content hold, expressed by its `unresolved` assessment. The shared helper [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts) gains wave D's review date and lets a held parent hold its increments.
