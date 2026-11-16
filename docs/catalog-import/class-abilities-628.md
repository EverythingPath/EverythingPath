# Class abilities #628: Challenge (CAV), Sneak Attack (SLA) and Bloodline Feat (SOR) (MVP launch subset, #617 wave B; Bonus Feat (MNK), #628 wave F2)

MVP launch subset of #628: this inventory curates only pf1/WNi2SBF6Z2zhBMCl (Challenge (CAV)), pf1/Wl3FUflcmvQP0PaQ (Sneak Attack (SLA)), pf1/W1KWAZxUNxfCv8rG (Bloodline Feat (SOR)) and pf1/VjHjPja5QABBgRvR (Bonus Feat (MNK)); the ticket's other 96 keys stay remaining acceptance under #628. The 96 remaining keys are listed in the inventory's `launchSubset.remainingAcceptance` ([`class-abilities-628.json`](../../scripts/catalog/legal/class-abilities-628.json)) and stay this ticket's acceptance.

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

## #628 wave F2: Bonus Feat (MNK)

This report belongs to #628 wave F2 (curation [#628](https://github.com/AndreasUnunger/EverythingPath/issues/628), the two dependently omitted increment parents with larger closures), which re-assesses the 26 entries the closures hold back (16 Core Rulebook feats under #735 S-04 and 10 shape Spells under S-03) and then admits Bonus Feat (MNK) (#628) and Wild Shape (#644) with their 18 increments. This is the run report. Reviewer: Opus (AI curator) for the owner, 2026-11-07. Sources: pf1 v11.11 (`418761d2`), pf1-content 11.4.0, the PRD capture `prd-2026-10-20` and PCGen `25523dbc`. No book PDFs; Archives of Nethys not used.

| Key                                     | Disposition | Assessment | Required notices | Linked closure                                                                                                                                                                                                                                                                                                                   | Increments | Evidence                               |
| --------------------------------------- | ----------- | ---------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------- |
| `pf1/VjHjPja5QABBgRvR` Bonus Feat (MNK) | admitted    | confirmed  | PZO1110, PZO1131 | Scorpion Style, Improved Disarm, Deflect Arrows, Dodge, Mobility, Improved Critical, Improved Grapple, Snatch Arrows, Catch Off-Guard, Improved Bull Rush, Throw Anything, Improved Trip, Combat Reflexes, Gorgon's Fist, Medusa's Wrath, Improved Feint, Spring Attack, Improved Unarmed Strike, Combat Expertise, Power Attack | 10         | `class-abilities-628-VjHjPja5QABBgRvR` |

Its 10 increments (`everythingpath/monk-bonus-feat-10`, `everythingpath/monk-bonus-feat-14`, `everythingpath/monk-bonus-feat-18`, `everythingpath/monk-bonus-feat-2`, `everythingpath/monk-bonus-feat-6`, `everythingpath/unchained-monk-bonus-feat-10`, `everythingpath/unchained-monk-bonus-feat-14`, `everythingpath/unchained-monk-bonus-feat-18`, `everythingpath/unchained-monk-bonus-feat-2`, `everythingpath/unchained-monk-bonus-feat-6`) have no assessment of their own. Each has `attributionFrom: pf1/VjHjPja5QABBgRvR`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Bonus Feat (MNK) is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

### Bonus Feat (MNK) (`pf1/VjHjPja5QABBgRvR`)

- **Body:** [`packs/class-abilities/bonus-feat-mnk.VjHjPja5QABBgRvR.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/bonus-feat-mnk.VjHjPja5QABBgRvR.yaml) (sha256 `cd0fb7a76ec1…`); Core Rulebook p. 58, Pathfinder Unchained p. 14.
- **PRD:** `coreRulebook/classes/monk.html:402`. Bonus Feat (Core Rulebook): the body is this line word for word (its four paragraphs are the line's sentences; the links are the PRD's feat links).
- **PRD:** `unchained/classes/monk.html:409`. Bonus Feat (Pathfinder Unchained): the same list and rule, "can" for "may"; the Unchained Monk grants this shared body.
- **PCGen:** `cr_abilities_class.lst:1094`. Core Rulebook Monk ~ Monk Bonus Feat row: the bonus feat pool BONUS:ABILITYPOOL|Monk Bonus Feat|1+max((MonkBonusFeatLVL+2)/4,0), the schedule; the row has no DESC (the PRD capture carries the body).
- **PCGen:** `pu_abilities_class.lst:461`. Pathfinder Unchained Unchained Monk ~ Bonus Feat row: DESC the body word for word but "can" for "may"; the same pool formula; SOURCEPAGE p.14.
- **Grant:** Granted at Monk level 1, Monk (Unchained) level 1: Foundry classAssociations; PCGen cr_abilities_class.lst:173, pu_abilities_class.lst:156. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Monk bonus feats by monk level = 1 + floor((level + 2) / 4): one at 1st, 2nd and every 4 levels thereafter (6th, 10th, 14th, 18th) (PRD monk.html:402 and Table: Monk :357-376, Special "Bonus feat"; unchained/classes/monk.html:409 and its table :375-394; PCGen ABILITYPOOL 1+max((MonkBonusFeatLVL+2)/4,0); Foundry change bonusFeats 1 + floor((@class.level + 2) / 4) agrees). Per level: 1: 1, 2: 2, 3: 2, 4: 2, 5: 2, 6: 3, 7: 3, 8: 3, 9: 3, 10: 4, 11: 4, 12: 4, 13: 4, 14: 5, 15: 5, 16: 5, 17: 5, 18: 6, 19: 6, 20: 6.
- **Increment names:** each checked against its class table row: `monk-bonus-feat-2` "Bonus Feat" (`monk.html:358`, "Bonus feat, evasion"); `monk-bonus-feat-6` "Bonus Feat" (`monk.html:362`, "Bonus feat, slow fall 30 ft."); `monk-bonus-feat-10` "Bonus Feat" (`monk.html:366`, "Bonus feat, ki pool (lawful), slow fall 50 ft."); and the other 7 likewise.
- **Linked closure** (the reason it was dependently omitted): Scorpion Style (`pf1/2AfSIVge3bg8r6wr`, feats-330, linked from `pf1/VjHjPja5QABBgRvR`): admitted (wave F2, linked.py); Improved Disarm (`pf1/711B9WNFgpdDKKf2`, feats-330, linked from `pf1/VjHjPja5QABBgRvR`): admitted (wave F2, linked.py); Deflect Arrows (`pf1/ACEQfonKVqh0fwkK`, feats-330, linked from `pf1/VjHjPja5QABBgRvR`): admitted (wave F2, linked.py); Dodge (`pf1/JreaiTHdyWFNj3Tb`, feats-331, linked from `pf1/VjHjPja5QABBgRvR`): admitted (earlier); Mobility (`pf1/R7L4SlGRlnThqFrP`, feats-331, linked from `pf1/VjHjPja5QABBgRvR`): admitted (earlier); Improved Critical (`pf1/TbOPtIL8Fv8obXtP`, feats-331, linked from `pf1/VjHjPja5QABBgRvR`): admitted (wave F2, linked.py); Improved Grapple (`pf1/ZmQkRk93nbHxsQSt`, feats-332, linked from `pf1/VjHjPja5QABBgRvR`): admitted (wave F2, linked.py); Snatch Arrows (`pf1/bHcqTC4Lf3aVl3VO`, feats-332, linked from `pf1/VjHjPja5QABBgRvR`): admitted (wave F2, linked.py); Catch Off-Guard (`pf1/bZ1YdzkT8NtRIEJ4`, feats-332, linked from `pf1/VjHjPja5QABBgRvR`): admitted (wave F2, linked.py); Improved Bull Rush (`pf1/dn2KgHFQRbuoNRx0`, feats-332, linked from `pf1/VjHjPja5QABBgRvR`): admitted (wave F2, linked.py); Throw Anything (`pf1/gGfXQq0IZrxdcZDx`, feats-332, linked from `pf1/VjHjPja5QABBgRvR`): admitted (wave F2, linked.py); Improved Trip (`pf1/gTrGPxzN054GfpkM`, feats-332, linked from `pf1/VjHjPja5QABBgRvR`): admitted (wave F2, linked.py); Combat Reflexes (`pf1/h9nHYLxXvIXBTmup`, feats-332, linked from `pf1/VjHjPja5QABBgRvR`): admitted (wave F2, linked.py); Gorgon's Fist (`pf1/nhUawPP4jfED3CYV`, feats-332, linked from `pf1/VjHjPja5QABBgRvR`): admitted (wave F2, linked.py); Medusa's Wrath (`pf1/sOCyCmNxe2MBbEaI`, feats-332, linked from `pf1/VjHjPja5QABBgRvR`): admitted (wave F2, linked.py); Improved Feint (`pf1/tocde3sKG1O3GKgd`, feats-332, linked from `pf1/VjHjPja5QABBgRvR`): admitted (wave F2, linked.py); Spring Attack (`pf1/ugQyUpqPBDsqLyra`, feats-332, linked from `pf1/VjHjPja5QABBgRvR`): admitted (wave F2, linked.py); Improved Unarmed Strike (`pf1/2aTFNMs3pW6nUBlr`, feats-330, linked from `pf1/2AfSIVge3bg8r6wr`): admitted (earlier); Combat Expertise (`pf1/NFxHebU1XhEs5WJh`, feats-331, linked from `pf1/711B9WNFgpdDKKf2`): admitted (earlier); Power Attack (`pf1/FUW5mIXHNBBIQ1Sq`, feats-330, linked from `pf1/dn2KgHFQRbuoNRx0`): admitted (wave F2, linked.py).
- **Record:** `description` on `description` (`99e673ae…`), checked, `outputs: []`: no prose Note, since other batches' committed closures reach this body.
- **Notices:** PZO1110, PZO1131, each reviewed with no notice hold in force. PZO1110: Core Rulebook monk class feature Bonus Feat and the Core Rulebook feats the body names and links: Catch Off-Guard, Combat Reflexes, Deflect Arrows, Dodge, Improved Grapple, Scorpion Style, Throw Anything, Gorgon's Fist, Improved Bull Rush, Improved Disarm, Improved Feint, Improved Trip, Mobility, Improved Critical, Medusa's Wrath, Snatch Arrows and Spring Attack (granted by Monk). PZO1131: Pathfinder Unchained class feature Bonus Feat (granted by Monk (Unchained)), and the retained Unchained action-cost metadata (activation.unchained) on Deflect Arrows, Combat Reflexes and Spring Attack in its bound closure.
- **Outstanding calculations** (never holds):
  - The bonus feat count 1 + floor((monk level + 2) / 4) (Foundry change bonusFeats, unmapped), the level-gated choice list (1st, 6th and 10th) and the waived prerequisites — owner #628. Granted feat slots, their choice lists and the prerequisite waiver are not yet sheet calculations; the description and increments state them.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #628. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset).
- **Source discrepancies** (recorded, not resolved):
  - The Unchained Monk PRD line (unchained/classes/monk.html:409) and PCGen row (pu_abilities_class.lst:461) read "can select" where the body (and the Core Rulebook line, monk.html:402) reads "may select". Recorded, not resolved; the text stays verbatim.
  - Its closure keeps Unchained action-cost metadata (activation.unchained) on Deflect Arrows, Combat Reflexes and Spring Attack; PZO1131, already required for the Unchained Monk grant, covers it (curation.md, "Unchained action costs").
- **Binding:** content `a4849b2d5c94…`, from `buildAssessmentBinding` over the full-corpus preview; it covers the parent and its linked closure.

### Tests

[`class-abilities-628.test.ts`](../../tests/catalog/class-abilities-628.test.ts) adds a `describeIncrementParent` block for the new row. The batch test uses the shared checks in [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts) (`describeIncrementParent`): the inventory and launch-subset statement; the pinned body, checked description record, PRD lines, PCGen rows, Foundry associations and each increment's name against its class table from the shared store; a re-extraction of the parent with its linked closure, the binding re-built, and the gate admitting the parent, its closure and exactly its increments (an edited body admits only the closure); and the batch's own rows. Wave F1 extended the helper with the closure (`linkedContentReview`, the fixture's `closure`); wave F2 reuses it unchanged but for its review date and the PRD heading form `<b>Name:</b>`. Its preview is [`tests/fixtures/class-abilities-628/binding-preview.json`](../../tests/fixtures/class-abilities-628/binding-preview.json), which now also holds the closure. The inventory keeps its earlier rows, reviewer and date; the new row records its own (`reviewedBy`, `reviewedOn`).

### Linked entries

Re-assessed in place in their own inventories before the parents (each report has a wave F2 section):

| Key                    | Name               | Inventory  | Outcome             | Required notices                                          |
| ---------------------- | ------------------ | ---------- | ------------------- | --------------------------------------------------------- |
| `pf1/2AfSIVge3bg8r6wr` | Scorpion Style     | feats-330  | confirmed; admitted | PZO1110                                                   |
| `pf1/711B9WNFgpdDKKf2` | Improved Disarm    | feats-330  | confirmed; admitted | PZO1110, PZO1131                                          |
| `pf1/ACEQfonKVqh0fwkK` | Deflect Arrows     | feats-330  | confirmed; admitted | PZO1110, PZO1131                                          |
| `pf1/FUW5mIXHNBBIQ1Sq` | Power Attack       | feats-330  | confirmed; admitted | PZO1110                                                   |
| `pf1/TbOPtIL8Fv8obXtP` | Improved Critical  | feats-331  | confirmed; admitted | PZO1110                                                   |
| `pf1/ZmQkRk93nbHxsQSt` | Improved Grapple   | feats-332  | confirmed; admitted | PZO1110, PZO1131                                          |
| `pf1/bHcqTC4Lf3aVl3VO` | Snatch Arrows      | feats-332  | confirmed; admitted | PZO1110, PZO1131                                          |
| `pf1/bZ1YdzkT8NtRIEJ4` | Catch Off-Guard    | feats-332  | confirmed; admitted | PZO1110, PZO1131                                          |
| `pf1/dn2KgHFQRbuoNRx0` | Improved Bull Rush | feats-332  | confirmed; admitted | PZO1110, PZO1131                                          |
| `pf1/gGfXQq0IZrxdcZDx` | Throw Anything     | feats-332  | confirmed; admitted | PZO1110                                                   |
| `pf1/gTrGPxzN054GfpkM` | Improved Trip      | feats-332  | confirmed; admitted | PZO1110, PZO1131                                          |
| `pf1/h9nHYLxXvIXBTmup` | Combat Reflexes    | feats-332  | confirmed; admitted | PZO1110, PZO1131                                          |
| `pf1/nhUawPP4jfED3CYV` | Gorgon's Fist      | feats-332  | confirmed; admitted | PZO1110                                                   |
| `pf1/sOCyCmNxe2MBbEaI` | Medusa's Wrath     | feats-332  | confirmed; admitted | PZO1110                                                   |
| `pf1/tocde3sKG1O3GKgd` | Improved Feint     | feats-332  | confirmed; admitted | PZO1110                                                   |
| `pf1/ugQyUpqPBDsqLyra` | Spring Attack      | feats-332  | confirmed; admitted | PZO1110, PZO1131                                          |
| `pf1/774kmgcb7ygviht0` | Beast Shape II     | spells-522 | confirmed; admitted | CRB, PZO1110, PZO1112, PZO1127, PZO1131                   |
| `pf1/hd32fuc6e7j4isbn` | Elemental Body III | spells-530 | confirmed; admitted | CRB, PZO1110, PZO1112, PZO1116, PZO1117, PZO1127, PZO1131 |
| `pf1/ik4riccm7tozdwox` | Plant Shape II     | spells-531 | confirmed; admitted | CRB, PZO1110, PZO1112, PZO1127, PZO1131                   |
| `pf1/pawbnw1nm4f0b98e` | Elemental Body I   | spells-537 | confirmed; admitted | CRB, PZO1110, PZO1112, PZO1116, PZO1127, PZO1131          |
| `pf1/sheso071mxbywlah` | Plant Shape III    | spells-540 | confirmed; admitted | CRB, PZO1110, PZO1112, PZO1115, PZO1127, PZO1131          |
| `pf1/tjdfluulncmqacc3` | Beast Shape I      | spells-541 | confirmed; admitted | CRB, PZO1110, PZO1112, PZO1115, PZO1127, PZO1131          |
| `pf1/v42t5kpxc8mvd615` | Elemental Body IV  | spells-542 | confirmed; admitted | CRB, PZO1110, PZO1112, PZO1116, PZO1127, PZO1131          |
| `pf1/w88ddxpu89qcr5c0` | Beast Shape III    | spells-543 | confirmed; admitted | CRB, PZO1110, PZO1112, PZO1116, PZO1127, PZO1131, PZO9267 |
| `pf1/y653mq8kmma3kg3w` | Plant Shape I      | spells-545 | confirmed; admitted | CRB, PZO1110, PZO1112, PZO1127, PZO1131                   |
| `pf1/yldjnorgbx4jsldz` | Elemental Body II  | spells-545 | confirmed; admitted | CRB, PZO1110, PZO1112, PZO1116, PZO1127, PZO1131, PZO9267 |

### Run results

Full-corpus `catalog:preview` at the pins (`inputVerification: verified`):

|                 | Admitted      | Held             | Dependent omissions | Failures |
| --------------- | ------------- | ---------------- | ------------------- | -------- |
| Base `1b8a2a38` | 626           | 23,173           | 174                 | 1,649    |
| Wave F2         | **672** (+46) | **23,127** (−46) | 174                 | 1,649    |

`cur628f2-evidence/preview-delta.txt`: exactly 46 keys move held → admitted: the 26 linked entries, the 2 parents and their 18 increments. No other key changes state or reason, no catalog entry differs from base, and the failures are identical key for key. The 67 other assessments whose closures reach these 28 bodies (`reach.json`) all stay as they were.

### Launch inventory

- **Identity:** `9a0c86d7…` → `cfa7e832…`; `noticeAuthoritySha256` `c4092444…` → `cd210cba…`.
- **Moves:** rows 19,272 and inventory errors 0 unchanged; required launch failures 96,669 → 96,643 (−26: the 26 linked entries lose their whole-content holds); `--check` and `--verify --check` pass (602 observations verified).
- **Met:** `mvp:status` 413 → **434** of 16,744 (+21): the 18 increments and Beast Shape II, Plant Shape I and Plant Shape II (their only open item was the hold). The two parents, the 16 feats and the other 7 Spells are admitted but stay unmet on their implementation mechanisms (`Feature/option grants and conditions`, feat mechanics, polymorph and granted-spell levels).
- **Pins:** the launch-document identity pin (`9a0c86d7…` → the final identity above) and outstanding requirements (96,669 → 96,643), and the spells-532 linked-context gate (Beast Shape I and II and Elemental Body I now admit there).

### Shared store

<!-- prep:shared-store-count -->
New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `20f72a54`: **10** (pf1 10).
<!-- /prep:shared-store-count -->

Wave F2 adds ten files to the shared store, each byte-identical to its pin: the pf1 `418761d2` feat bodies `packs/feats/{scorpion-style.2AfSIVge3bg8r6wr, improved-disarm.711B9WNFgpdDKKf2, improved-critical.TbOPtIL8Fv8obXtP, snatch-arrows.bHcqTC4Lf3aVl3VO, catch-off-guard.bZ1YdzkT8NtRIEJ4, throw-anything.gGfXQq0IZrxdcZDx, improved-trip.gTrGPxzN054GfpkM, gorgon-s-fist.nhUawPP4jfED3CYV, medusa-s-wrath.sOCyCmNxe2MBbEaI, improved-feint.tocde3sKG1O3GKgd}.yaml` (the batch tests re-extract Bonus Feat (MNK) with its closure). Every PCGen and PRD file the run cites was already there, including PCGen `bestiary/b1_abilities_race.lst` and `bestiary/bestiary.pcc` (vortex).

### Preservation

The shared files gain only this run's rows: 2 new overlay description records, 2 new assessments and evidence entries, and 26 changed assessments and evidence entries (the linked entries, each keeping its earlier assessment in `assessmentHistory`). No other overlay record, assessment or evidence entry changes. No Registry, `held-notices.json`, `notice-clearances.json`, `known-notice-holds.json`, shared Situation or structure record changes; no production code changes. Tests: each linked feat batch test, and eight of the nine linked spell batch tests, gain a wave F2 test (`expectFeatLaunchReview`, or the new shared `expectWaveF2Spell` in `launch-reassessment.ts`); `spells-531.test.ts` instead adapts its existing tests for Plant Shape II's history, disposition and binding. Each batch test's counts and hold expectations follow the re-assessed rows, and the spell fixture schemas (`tests/fixtures/spells-5xx/data.ts`) admit confirmed rows and PCGen citations. Their bounded reextraction fixtures predate later changes to the bodies the re-assessed Spells link, so `tests/catalog/wave-f2-binding-context.ts` binds a wave F2 row against the full-corpus closure #644's binding preview holds, as the gate does; every other root keeps its bounded binding. `expectGrantedLevelsBounded` also accepts PRD lines as a mapping's bound (Beast Shape III's Animal domain level). In feats-330's isolated catalog, Improved Disarm links Combat Expertise outside the selection, so only the full gate admits it (as feats-331's Improved Lightning Reflexes).
