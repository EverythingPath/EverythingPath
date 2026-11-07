# Class abilities #628: Challenge (CAV), Sneak Attack (SLA) and Bloodline Feat (SOR) (MVP launch subset, #617 wave B)

MVP launch subset of #628: this inventory curates only pf1/WNi2SBF6Z2zhBMCl (Challenge (CAV)), pf1/Wl3FUflcmvQP0PaQ (Sneak Attack (SLA)) and pf1/W1KWAZxUNxfCv8rG (Bloodline Feat (SOR)); the ticket's other 97 keys stay remaining acceptance under #628. The 97 remaining keys are listed in the inventory's `launchSubset.remainingAcceptance` ([`class-abilities-628.json`](../../scripts/catalog/legal/class-abilities-628.json)) and stay this ticket's acceptance.

| Key                                         | Disposition | Assessment | Required notices | Increments | Evidence                               |
| ------------------------------------------- | ----------- | ---------- | ---------------- | ---------- | -------------------------------------- |
| `pf1/WNi2SBF6Z2zhBMCl` Challenge (CAV)      | admitted    | confirmed  | PZO1115, PZO1131 | 6          | `class-abilities-628-WNi2SBF6Z2zhBMCl` |
| `pf1/Wl3FUflcmvQP0PaQ` Sneak Attack (SLA)   | admitted    | confirmed  | PZO1129, PZO1131 | 5          | `class-abilities-628-Wl3FUflcmvQP0PaQ` |
| `pf1/W1KWAZxUNxfCv8rG` Bloodline Feat (SOR) | admitted    | confirmed  | PZO1110          | 2          | `class-abilities-628-W1KWAZxUNxfCv8rG` |

Its 6 increments (`everythingpath/cavalier-challenge-10`, `everythingpath/cavalier-challenge-13`, `everythingpath/cavalier-challenge-16`, `everythingpath/cavalier-challenge-19`, `everythingpath/cavalier-challenge-4`, `everythingpath/cavalier-challenge-7`) have no assessment of their own. Each has `attributionFrom: pf1/WNi2SBF6Z2zhBMCl`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Challenge (CAV) is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

Its 5 increments (`everythingpath/slayer-sneak-attack-12`, `everythingpath/slayer-sneak-attack-15`, `everythingpath/slayer-sneak-attack-18`, `everythingpath/slayer-sneak-attack-6`, `everythingpath/slayer-sneak-attack-9`) have no assessment of their own. Each has `attributionFrom: pf1/Wl3FUflcmvQP0PaQ`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Sneak Attack (SLA) is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

Its 2 increments (`everythingpath/sorcerer-bloodline-feat-13`, `everythingpath/sorcerer-bloodline-feat-19`) have no assessment of their own. Each has `attributionFrom: pf1/W1KWAZxUNxfCv8rG`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Bloodline Feat (SOR) is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

## #617 wave B

This report belongs to #617 wave B (curation [#617](https://github.com/AndreasUnunger/EverythingPath/issues/617), increment parents wave B), which assesses eleven class-feature parents across five batches so that their 76 schedule increments admit with them. The run report is [class-abilities-617.md](class-abilities-617.md). Reviewer: Opus (AI curator) for the owner, 2026-11-04. Sources: pf1 v11.11 (`418761d2`), the PRD capture `prd-2026-10-20` and PCGen `25523dbc`. No book PDFs; Archives of Nethys not used.

Bonus Feat (MNK) (`pf1/VjHjPja5QABBgRvR`) is this ticket's too. It stays remaining acceptance: it is dependently omitted on held linked entries, and it runs after waves A to C.

## Evidence

### Challenge (CAV) (`pf1/WNi2SBF6Z2zhBMCl`)

- **Body:** [`packs/class-abilities/challenge-cav.WNi2SBF6Z2zhBMCl.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/challenge-cav.WNi2SBF6Z2zhBMCl.yaml) (sha256 `61878bc11352…`); Advanced Player's Guide p. 32-37. The pinned record imports no sources (`sources: []`); the assessment cites the book from the PRD and PCGen.
- **PRD:** `advancedPlayersGuide/baseClasses/cavalier.html:380`. Challenge: the body's two paragraphs are this line's text after the heading, split before "The cavalier can use this ability". The body omits the next two paragraphs (:381-382: the -2 AC penalty and the challenge's duration and order effect).
- **PCGen:** `apg_abilities_class.lst:193`. Advanced Player's Guide Cavalier ~ Challenge row: DESC summarises the rule ("%1/day [Swift Action] ... extra damage"), CavalierChallengeTimes (CavalierLVL+2)/3.
- **Grant:** Granted at Cavalier level 1: Foundry class records; PCGen apg_abilities_globalvar.lst:38. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Challenge uses per day by cavalier level = 1 + floor((level - 1) / 3): 1 at 1st, 2 at 4th, 7 at 19th (PRD cavalier.html:380 and Table 1-3 :356-375; Foundry uses.maxFormula 1 + floor((@class.level - 1) / 3) and PCGen (CavalierLVL+2)/3 agree). Per level: 1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 4, 11: 4, 12: 4, 13: 5, 14: 5, 15: 5, 16: 6, 17: 6, 18: 6, 19: 7, 20: 7.
- **Increment names:** each checked against its class table row: `cavalier-challenge-4` "Challenge 2/day" (`cavalier.html:359`, "Challenge 2/day, expert trainer"); `cavalier-challenge-7` "Challenge 3/day" (`cavalier.html:362`, "Challenge 3/day"); `cavalier-challenge-10` "Challenge 4/day" (`cavalier.html:365`, "Challenge 4/day"); and the other 3 likewise.
- **Record:** `description` on `description` (`9826539a…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, because the body sits in other batches' committed fixtures (the protected and binding contexts of spells-530 to -536 and feats-350 to -355, among others); a Note would change the entry they hold. The imported entry is identical to the base import.
- **Notices:** PZO1115, PZO1131, each reviewed with no hold in force. PZO1115: Advanced Player's Guide class feature Challenge (CAV) and the rules it applies (granted by Cavalier). PZO1131: Retained Unchained action-cost metadata (activation.unchained) on the record's actions, kept in gameContent (curation.md, "Unchained action costs", #367).
- **Outstanding calculations** (never holds):
  - Challenge uses per day, 1 + floor((cavalier level - 1) / 3) (Foundry uses.maxFormula, retained in gameContent) — owner #628. No feature-use resource on the sheet; the description states it.
  - Extra melee damage equal to the cavalier level against the challenged target, as a swift action (Foundry action, retained in gameContent) — owner #628. The sheet runs no actions and has no target condition; the description states it.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #628. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset and wave A).
- **Source discrepancies** (recorded, not resolved):
  - Foundry's pinned record imports no sources (system.sources absent; the import's sources: []); the assessment cites the Advanced Player's Guide, pp. 32-37, from the PRD and PCGen. Importer gap: reported, not fixed.
  - Foundry's action carries Unchained action metadata (activation.unchained, type action), retained in gameContent; PZO1131 is required (curation.md, "Unchained action costs", #367).
  - The body omits the PRD's two following paragraphs (cavalier.html:381-382: the -2 AC penalty and the challenge's duration and order effect); PCGen's DESC carries them. Recorded, not resolved.
- **Binding:** content `d2493b9e0eb2…`, from `buildAssessmentBinding` over the full-corpus preview of the final records. The parent's closure is the entry alone.

### Sneak Attack (SLA) (`pf1/Wl3FUflcmvQP0PaQ`)

- **Body:** [`packs/class-abilities/sneak-attack-sla.Wl3FUflcmvQP0PaQ.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/sneak-attack-sla.Wl3FUflcmvQP0PaQ.yaml) (sha256 `a0c37773d9cb…`); Advanced Class Guide p. 54.
- **PRD:** `advancedClassGuide/classes/slayer.html:427,428,429`. Sneak Attack (slayer): seven of the body's nine sentences are identical; two carry the printing's rewording ("like a sap, whip, or unarmed strike", "with concealment"). Same rule.
- **PCGen:** `acg_classes.lst:336`. Advanced Class Guide Slayer class level-3 row: ABILITY Slayer ~ Sneak Attack; the ability row (acg_abilities_class.lst:1801) is internal and carries no DESC.
- **PCGen:** `acg_abilities_class.lst:1801`. Advanced Class Guide Slayer ~ Sneak Attack internal row: SneakAttackDice SlayerSneakAttackLVL/3 (no DESC).
- **Grant:** Granted at Slayer level 3: Foundry class records; PCGen acg_classes.lst:336. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Sneak attack dice by slayer level = floor(level / 3) d6: +1d6 at 3rd, +6d6 at 18th (PRD slayer.html:427 and Table 1-14 :370-389); Foundry's action damage (floor(@class.level / 3))d6 precision and PCGen SlayerSneakAttackLVL/3 agree. Per level: 1: 0, 2: 0, 3: 1, 4: 1, 5: 1, 6: 2, 7: 2, 8: 2, 9: 3, 10: 3, 11: 3, 12: 4, 13: 4, 14: 4, 15: 5, 16: 5, 17: 5, 18: 6, 19: 6, 20: 6.
- **Increment names:** each checked against its class table row: `slayer-sneak-attack-6` "Sneak Attack +2d6" (`slayer.html:375`, "Slayer talent, sneak attack +2d6"); `slayer-sneak-attack-9` "Sneak Attack +3d6" (`slayer.html:378`, "Sneak attack +3d6"); `slayer-sneak-attack-12` "Sneak Attack +4d6" (`slayer.html:381`, "Slayer talent, sneak attack +4d6"); and the other 2 likewise.
- **Record:** `description` on `description` (`e5e1e31a…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, because the body sits in other batches' committed fixtures (the protected and binding contexts of spells-530 to -536 and feats-350 to -355, among others); a Note would change the entry they hold. The imported entry is identical to the base import.
- **Notices:** PZO1129, PZO1131, each reviewed with no hold in force. PZO1129: Advanced Class Guide class feature Sneak Attack (SLA) and the rules it applies (granted by Slayer). PZO1131: Retained Unchained action-cost metadata (activation.unchained) on the record's actions, kept in gameContent (curation.md, "Unchained action costs", #367).
- **Outstanding calculations** (never holds):
  - Sneak attack damage, (floor(slayer level / 3))d6 precision (Foundry action, retained in gameContent) — owner #628. The sheet runs no actions; the description and the increments' names state it.
  - Its conditions: target denied its Dexterity bonus or flanked, ranged within 30 ft., no concealment, nonlethal weapons — owner #628. No attack-condition input on the sheet; the description states them.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #628. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset and wave A).
- **Source discrepancies** (recorded, not resolved):
  - Two sentences differ in wording from the PRD capture: "(like a sap, whip, or unarmed strike)" for "(such as a sap, a whip, or an unarmed strike)" and "a creature with concealment" for "a creature that has concealment". Same rule; recorded, not resolved; the text stays verbatim.
  - Foundry's action carries Unchained action metadata (activation.unchained, type nonaction), retained in gameContent; PZO1131 is required (curation.md, "Unchained action costs", #367).
  - The body leaves its first two paragraphs unclosed. Recorded; the text stays verbatim.
- **Binding:** content `7739d46385cb…`, from `buildAssessmentBinding` over the full-corpus preview of the final records. The parent's closure is the entry alone.

### Bloodline Feat (SOR) (`pf1/W1KWAZxUNxfCv8rG`)

- **Body:** [`packs/class-abilities/bloodline-feat-sor.W1KWAZxUNxfCv8rG.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/bloodline-feat-sor.W1KWAZxUNxfCv8rG.yaml) (sha256 `b02e90544032…`); Core Rulebook p. 71.
- **PRD:** `coreRulebook/classes/sorcerer.html:417`. Bloodline (bonus feats paragraph): identical to the body. The Bloodline heading paragraph is :415.
- **PCGen:** `cr_abilities_class.lst:1710`. Core Rulebook Bloodline Tracker row: BloodlineFeatCount (BloodlineFeatProgression-1)/6, the bonus-feat count the schedule's decision names. PCGen has no Bloodline Feat grant row.
- **PCGen:** `cr_abilities_class.lst:2334`. Core Rulebook Aberrant Bloodline choice row: BONUS:ABILITYPOOL|Sorcerer Bloodline Feat|BloodlineFeatCount, the bloodline's feat pool.
- **Grant:** Granted at Sorcerer level 7: Foundry class records; PCGen cr_abilities_globalvar.lst:990, cr_abilities_class.lst:1710. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Bloodline feats by sorcerer level = 1 + floor((level - 7) / 6) from 7th: one at 7th, 13th and 19th, 3 at 19th (PRD sorcerer.html:417 and Table: Sorcerer :359-378; Foundry change floor((@class.level - 1) / 6) on bonusFeats and PCGen (BloodlineFeatProgression-1)/6 agree). Per level: 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1, 12: 1, 13: 2, 14: 2, 15: 2, 16: 2, 17: 2, 18: 2, 19: 3, 20: 3.
- **Increment names:** each checked against its class table row: `sorcerer-bloodline-feat-13` "Bloodline Feat" (`sorcerer.html:371`, "Bloodline feat, bloodline spell"); `sorcerer-bloodline-feat-19` "Bloodline Feat" (`sorcerer.html:377`, "Bloodline feat, bloodline spell").
- **Record:** `description` on `description` (`b311cab8…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, because the body sits in other batches' committed fixtures (the protected and binding contexts of spells-530 to -536 and feats-350 to -355, among others) and in their assessed closures (20 assessments: 15 racial traits (racial-traits-387 to -400) and five races (races-328: Oread, Ifrit, Undine, Tiefling, Sylph), all unresolved and held by their own holds); a Note would change the entry they hold. The imported entry is identical to the base import.
- **Notices:** PZO1110, each reviewed with no hold in force. PZO1110: Core Rulebook class feature Bloodline Feat (SOR) and the rules it applies (granted by Sorcerer).
- **Outstanding calculations** (never holds):
  - One bonus feat from the bloodline's list at 7th, 13th and 19th, floor((sorcerer level - 1) / 6) (Foundry change on bonusFeats, imported unsupported) — owner #628. Unmapped target: the change imports as unsupported and contributes nothing; the bloodline's feat list is the bloodline's own record. The description states the rule.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #628. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset and wave A).
- **Source discrepancies** (recorded, not resolved):
  - PCGen has no Bloodline Feat grant row; the grant evidence is the Sorcerer_CF_BloodlineFeats definition (cr_abilities_globalvar.lst:990) and the BloodlineFeatCount formula (cr_abilities_class.lst:1710).
- **Binding:** content `869284a421bf…`, from `buildAssessmentBinding` over the full-corpus preview of the final records. The parent's closure is the entry alone.

## Tests

[`class-abilities-628.test.ts`](../../tests/catalog/class-abilities-628.test.ts). The batch test uses the shared checks in [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts) (`describeIncrementParent`, from wave A): the inventory and launch-subset statement; the pinned body, checked record, PRD lines, PCGen rows, Foundry class records and each increment's name against its class table from the shared store; a re-extraction with committed curation, the binding re-built, and the gate admitting the parent with exactly its increments (an edited body admits neither); and the batch's own rows. Each parent adds that it has no Note, its unmapped Foundry changes, its outstanding owners and its schedule formula. The committed preview is [`tests/fixtures/class-abilities-628/binding-preview.json`](../../tests/fixtures/class-abilities-628/binding-preview.json): the parents as entries, each closure the entry alone, and their increments.

## Preservation and gates

The shared files gain only this batch's rows: its description records, assessments and evidence entries. No Registry, `held-notices.json`, `notice-clearances.json` or `known-notice-holds.json` change. The commands and their results are in [class-abilities-617.md](class-abilities-617.md).
