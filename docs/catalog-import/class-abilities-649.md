# Class abilities #649: Bloodline Feat (BLO) and Slayer's Advance (MVP launch subset, #605 wave C)

MVP launch subset of #649: this inventory curates only pf1/xxD5AbgfJ5OuzVld (Bloodline Feat (BLO)) and pf1/yotHT522pQoKDhID (Slayer's Advance); the ticket's other 98 keys stay remaining acceptance under #649. The 98 remaining keys are listed in the inventory's `launchSubset.remainingAcceptance` ([`class-abilities-649.json`](../../scripts/catalog/legal/class-abilities-649.json)) and stay this ticket's acceptance.

| Key                                         | Disposition | Assessment | Required notices | Increments | Evidence                               |
| ------------------------------------------- | ----------- | ---------- | ---------------- | ---------- | -------------------------------------- |
| `pf1/xxD5AbgfJ5OuzVld` Bloodline Feat (BLO) | admitted    | confirmed  | PZO1129          | 4          | `class-abilities-649-xxD5AbgfJ5OuzVld` |
| `pf1/yotHT522pQoKDhID` Slayer's Advance     | admitted    | confirmed  | PZO1129, PZO1131 | 1          | `class-abilities-649-yotHT522pQoKDhID` |

Its 4 increments (`everythingpath/bloodrager-bloodline-feat-12`, `everythingpath/bloodrager-bloodline-feat-15`, `everythingpath/bloodrager-bloodline-feat-18`, `everythingpath/bloodrager-bloodline-feat-9`) have no assessment of their own. Each has `attributionFrom: pf1/xxD5AbgfJ5OuzVld`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Bloodline Feat (BLO) is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

Its 1 increments (`everythingpath/slayer-slayers-advance-17`) have no assessment of their own. Each has `attributionFrom: pf1/yotHT522pQoKDhID`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Slayer's Advance is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

## #605 wave C

This report belongs to #605 wave C (curation [#605](https://github.com/AndreasUnunger/EverythingPath/issues/605), increment parents wave C), which assesses ten class-feature parents across five batches so that their 39 schedule increments admit with them. The run report is [class-abilities-605.md](class-abilities-605.md). Reviewer: Opus (AI curator) for the owner, 2026-11-04. Sources: pf1 v11.11 (`418761d2`), the PRD capture `prd-2026-10-20` and PCGen `25523dbc`. No book PDFs; Archives of Nethys not used.

## Evidence

### Bloodline Feat (BLO) (`pf1/xxD5AbgfJ5OuzVld`)

- **Body:** [`packs/class-abilities/bloodline-feat-blo.xxD5AbgfJ5OuzVld.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/bloodline-feat-blo.xxD5AbgfJ5OuzVld.yaml) (sha256 `e56d2e981a51…`); Advanced Class Guide p. 15.
- **PRD:** `advancedClassGuide/classes/bloodrager.html:442`. Bloodline (its bonus-feat paragraph): identical to the body. The Bloodline heading paragraph is :439.
- **PCGen:** `acg_abilities_class.lst:369`. Advanced Class Guide Bloodrager ~ Bloodline Tracker.MOD row, the record the schedule's decision names: one bloodline bonus feat from BloodragerBloodlineFeatProgression 6 while Bloodrager_CF_BloodlineFeat6 is unset; :370-373 add the 9th to 18th. PCGen has no Bloodline Feat grant row.
- **Grant:** Granted at Bloodrager level 6: Foundry classAssociations; PCGen acg_abilities_globalvar.lst:100, acg_abilities_globalvar.lst:101, acg_abilities_globalvar.lst:102, acg_abilities_globalvar.lst:103, acg_abilities_globalvar.lst:104. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Bloodline feats by bloodrager level = floor(level / 3) - 1 from 6th: one at 6th and every 3 levels after, 5 at 18th (PRD bloodrager.html:442 and the Bloodrager table :376-395); Foundry's bonusFeats change floor(@class.level / 3) - 1 agrees from 6th. Per level: 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 1, 7: 1, 8: 1, 9: 2, 10: 2, 11: 2, 12: 3, 13: 3, 14: 3, 15: 4, 16: 4, 17: 4, 18: 5, 19: 5, 20: 5.
- **Increment names:** each checked against its class table row: `bloodrager-bloodline-feat-9` "Bloodline Feat" (`bloodrager.html:384`, "Bloodline feat"); `bloodrager-bloodline-feat-12` "Bloodline Feat" (`bloodrager.html:387`, "Bloodline feat, bloodline power"); `bloodrager-bloodline-feat-15` "Bloodline Feat" (`bloodrager.html:390`, "Bloodline feat"); and the other 1 likewise.
- **Record:** `description` on `description` (`7cdb7e8b…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, because the body sits in other batches' committed fixtures (the protected and binding contexts of spells-530 to -536 and feats-350 to -355, among others); a Note would change the entry they hold. The imported entry is identical to the base import.
- **Notices:** PZO1129, each reviewed with no hold in force. PZO1129: Advanced Class Guide class feature Bloodline Feat (BLO) and the rules it applies (granted by Bloodrager).
- **Outstanding calculations** (never holds):
  - The bloodline bonus feats, floor(bloodrager level / 3) - 1 from 6th, from the bloodline's list (Foundry change on bonusFeats, imported unsupported) — owner #649. Unmapped target: the bonusFeats change imports as an unsupported `changes` row and adds no feat slot; the feat list is the bloodline's own record. The description states the rule.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #649. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset).
- **Source discrepancies** (recorded, not resolved):
  - PCGen has no Bloodline Feat grant row; the grant evidence is the Bloodrager_CF_BloodlineFeat6 to 18 definitions (acg_abilities_globalvar.lst:100-104) that the Bloodline Tracker tests (acg_abilities_class.lst:369-373).
  - Foundry names the body "Bloodline Feat (BLO)"; in the PRD it is a paragraph of Bloodline (bloodrager.html:439-444) with no heading of its own. Recorded, not resolved.
- **Binding:** content `e6637cc8b8bf…`, from `buildAssessmentBinding` over the full-corpus preview of the final records. The parent's closure is the entry alone.

### Slayer's Advance (`pf1/yotHT522pQoKDhID`)

- **Body:** [`packs/class-abilities/slayer-s-advance.yotHT522pQoKDhID.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/slayer-s-advance.yotHT522pQoKDhID.yaml) (sha256 `f1270e1a282a…`); Advanced Class Guide p. 55.
- **PRD:** `advancedClassGuide/classes/slayer.html:445`. Slayer's Advance: the same rule reworded. The body's second sentence is PCGen's DESC word for word ("He may use Stealth as part of this movement, but takes a -10 penalty to his check for doing so"); the first moves "once per day" before "move" and the third reads "do this" for "use this ability". Same rule, same book.
- **PCGen:** `acg_abilities_class.lst:1797`. Advanced Class Guide Slayer ~ Slayer's Advance row: DESC "A slayer can %1 times per day move up to twice his base speed as a move action. He may use Stealth as part of this movement, but takes a -10 penalty to his check for doing so." (SlayersAdvanceTimes = 1+(SlayerLVL>16)); the body's second sentence equals it; SOURCEPAGE p.55.
- **Grant:** Granted at Slayer level 13: Foundry classAssociations; PCGen acg_classes.lst:339. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Slayer's Advance uses per day by slayer level: 1 at 13th and 2 at 17th (PRD slayer.html:445 and Table 1-14 :370-389); PCGen's 1+(SlayerLVL>16) (acg_abilities_class.lst:1797) and Foundry's uses.maxFormula 1 + if(gte(@class.level, 17), 1) agree. Per level: 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0, 13: 1, 14: 1, 15: 1, 16: 1, 17: 2, 18: 2, 19: 2, 20: 2.
- **Increment names:** each checked against its class table row: `slayer-slayers-advance-17` "Slayer’s Advance 2/day" (`slayer.html:386`, "Slayer's advance 2/day"); and the other -2 likewise.
- **Record:** `description` on `description` (`3ab92438…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, because the body sits in other batches' committed fixtures (the protected and binding contexts of spells-530 to -536 and feats-350 to -355, among others); a Note would change the entry they hold. The imported entry is identical to the base import.
- **Notices:** PZO1129, PZO1131, each reviewed with no hold in force. PZO1129: Advanced Class Guide class feature Slayer's Advance and the rules it applies (granted by Slayer). PZO1131: Retained Unchained action-cost metadata (activation.unchained) on the record's actions, kept in gameContent (curation.md, "Unchained action costs", #367).
- **Outstanding calculations** (never holds):
  - Slayer's Advance uses per day, 1 at 13th and 2 at 17th (Foundry uses.maxFormula, retained in gameContent), and the double move with Stealth at -10 — owner #649. No feature-use resource on the sheet and speed is not a sheet statistic; the description states the rule.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #649. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset).
- **Source discrepancies** (recorded, not resolved):
  - The body rewords the PRD capture (slayer.html:445): "can once per day move up to twice his base speed" for "can move up to twice his base speed once per day", "He may use Stealth ... to his check" for "He can use Stealth ... on his check" (PCGen's DESC, acg_abilities_class.lst:1797, has the body's wording), and "he can do this twice per day" for "he can use this ability twice per day". Same rule, same book; recorded, not resolved; the text stays verbatim.
  - Foundry's action carries Unchained action metadata (activation.unchained, type action), retained in gameContent; PZO1131 is required (curation.md, "Unchained action costs", #367).
- **Binding:** content `963893ebfa4d…`, from `buildAssessmentBinding` over the full-corpus preview of the final records. The parent's closure is the entry alone.

## Tests

[`class-abilities-649.test.ts`](../../tests/catalog/class-abilities-649.test.ts). The batch test uses the shared checks in [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts), unchanged since wave A (`describeIncrementParent`): the inventory and launch-subset statement; the pinned body, checked record, PRD lines, PCGen rows, Foundry associations and each increment's name against its class table from the shared store; a re-extraction with committed curation, the binding re-built, and the gate admitting the parent with exactly its increments (an edited body admits neither); and the batch's own rows. Each parent adds that it has no Note, its unmapped Foundry changes, its outstanding owners and its schedule formula. The committed preview is [`tests/fixtures/class-abilities-649/binding-preview.json`](../../tests/fixtures/class-abilities-649/binding-preview.json): the parents as entries, each closure the entry alone, and their increments.

## Preservation and gates

The shared files gain only this batch's rows: its description records, assessments and evidence entries. No Registry, `held-notices.json`, `notice-clearances.json` or `known-notice-holds.json` change. The commands and their results are in [class-abilities-605.md](class-abilities-605.md).
