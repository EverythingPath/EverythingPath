# Class abilities #632: Revelation and Order (MVP launch subset, #605 wave C)

MVP launch subset of #632: this inventory curates only pf1/adu4NROFqgwv70sw (Revelation) and pf1/c3MSLdplxdRZrSxL (Order); the ticket's other 98 keys stay remaining acceptance under #632. The 98 remaining keys are listed in the inventory's `launchSubset.remainingAcceptance` ([`class-abilities-632.json`](../../scripts/catalog/legal/class-abilities-632.json)) and stay this ticket's acceptance.

| Key                               | Disposition | Assessment | Required notices | Increments | Evidence                               |
| --------------------------------- | ----------- | ---------- | ---------------- | ---------- | -------------------------------------- |
| `pf1/adu4NROFqgwv70sw` Revelation | admitted    | confirmed  | PZO1115          | 5          | `class-abilities-632-adu4NROFqgwv70sw` |
| `pf1/c3MSLdplxdRZrSxL` Order      | admitted    | confirmed  | PZO1115          | 3          | `class-abilities-632-c3MSLdplxdRZrSxL` |

Its 5 increments (`everythingpath/oracle-revelation-11`, `everythingpath/oracle-revelation-15`, `everythingpath/oracle-revelation-19`, `everythingpath/oracle-revelation-3`, `everythingpath/oracle-revelation-7`) have no assessment of their own. Each has `attributionFrom: pf1/adu4NROFqgwv70sw`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Revelation is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

Its 3 increments (`everythingpath/cavalier-order-15`, `everythingpath/cavalier-order-2`, `everythingpath/cavalier-order-8`) have no assessment of their own. Each has `attributionFrom: pf1/c3MSLdplxdRZrSxL`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Order is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

## #605 wave C

This report belongs to #605 wave C (curation [#605](https://github.com/AndreasUnunger/EverythingPath/issues/605), increment parents wave C), which assesses ten class-feature parents across five batches so that their 39 schedule increments admit with them. The run report is [class-abilities-605.md](class-abilities-605.md). Reviewer: Opus (AI curator) for the owner, 2026-11-04. Sources: pf1 v11.11 (`418761d2`), the PRD capture `prd-2026-10-20` and PCGen `25523dbc`. No book PDFs; Archives of Nethys not used.

## Evidence

### Revelation (`pf1/adu4NROFqgwv70sw`)

- **Body:** [`packs/class-abilities/revelation.adu4NROFqgwv70sw.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/revelation.adu4NROFqgwv70sw.yaml) (sha256 `b2d5133ef494…`); Advanced Player's Guide p. 42-54. The pinned record imports no sources (`sources: []`); the assessment cites the book from the PRD and PCGen.
- **PRD:** `advancedPlayersGuide/baseClasses/oracle.html:422`. Revelation: identical to the body after the heading.
- **PCGen:** `apg_abilities_class.lst:480`. Advanced Player's Guide Oracle's Mystery row, the revelation record the schedule's decision names: OracleMysteryLevel counts one revelation while Oracle_CF_Revelation1 is unset and one more at PRECLASS:1,Oracle=3, 7, 11, 15 and 19 while that level's flag is unset. No DESC; PCGen has no Revelation grant row.
- **PCGen:** `apg_abilities_class.lst:517`. Advanced Player's Guide Oracle ~ Battle Mystery row: the first mystery whose revelation pool is OracleMysteryLevel.
- **Grant:** Granted at Oracle level 1: Foundry classAssociations; PCGen apg_abilities_globalvar.lst:442, apg_abilities_globalvar.lst:443, apg_abilities_globalvar.lst:444, apg_abilities_globalvar.lst:445, apg_abilities_globalvar.lst:446, apg_abilities_globalvar.lst:447. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Revelations by oracle level: one at 1st, 3rd and every four levels after, 2 + floor((level - 3) / 4) from 3rd, 6 at 19th (PRD oracle.html:422 and Table 2-6 :359-378); PCGen's OracleMysteryLevel counts the same levels (apg_abilities_class.lst:480). Per level: 1: 1, 2: 1, 3: 2, 4: 2, 5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 3, 11: 4, 12: 4, 13: 4, 14: 4, 15: 5, 16: 5, 17: 5, 18: 5, 19: 6, 20: 6.
- **Increment names:** each checked against its class table row: `oracle-revelation-3` "Revelation" (`oracle.html:361`, "Revelation"); `oracle-revelation-7` "Revelation" (`oracle.html:365`, "Revelation"); `oracle-revelation-11` "Revelation" (`oracle.html:369`, "Revelation"); and the other 2 likewise.
- **Record:** `description` on `description` (`d9a6ca4c…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, because the body sits in other batches' committed fixtures (the protected and binding contexts of spells-530 to -536 and feats-350 to -355, among others) and in their assessed closures (Extra Revelation (`pf1/VHsCghfyT6J43b5G`, feats-331)); a Note would change the entry they hold. The imported entry is identical to the base import.
- **Notices:** PZO1115, each reviewed with no hold in force. PZO1115: Advanced Player's Guide class feature Revelation and the rules it applies (granted by Oracle). PZO1115: The oracle's mystery, whose list of revelations the oracle selects from (Advanced Player's Guide oracle).
- **Outstanding calculations** (never holds):
  - The revelation picks at 1st, 3rd and every four levels after, from the mystery's list, and their DCs (PCGen OracleRevelationDC 10 + 1/2 oracle level + Cha) — owner #632. The schedule's increments carry no revelation choice; the description states the rule.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #632. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset).
- **Source discrepancies** (recorded, not resolved):
  - Foundry's pinned record imports no sources (system.sources absent; the import's sources: []); the assessment cites the Advanced Player's Guide, pp. 42-54, from the PRD and PCGen. Importer gap: reported, not fixed.
  - PCGen has no Revelation grant row; the grant evidence is the Oracle_CF_Revelation1, 3, 7, 11, 15 and 20 definitions (apg_abilities_globalvar.lst:442-447) that Oracle's Mystery tests (apg_abilities_class.lst:480). It gates the 19th on Oracle_CF_Revelation19, which it never defines (the schedule's defect revelation-19-20). Recorded, not resolved.
- **Binding:** content `90ed12c67424…`, from `buildAssessmentBinding` over the full-corpus preview of the final records. The parent's closure is the entry alone.

### Order (`pf1/c3MSLdplxdRZrSxL`)

- **Body:** [`packs/class-abilities/order.c3MSLdplxdRZrSxL.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/order.c3MSLdplxdRZrSxL.yaml) (sha256 `8fde7e990929…`); Advanced Player's Guide p. 32-37. The pinned record imports no sources (`sources: []`); the assessment cites the book from the PRD and PCGen.
- **PRD:** `advancedPlayersGuide/baseClasses/cavalier.html:386,387`. Order: both paragraphs identical to the body after the heading.
- **PCGen:** `apg_abilities_class.lst:195`. Advanced Player's Guide Cavalier ~ Order row: DESC reproduces both paragraphs.
- **PCGen:** `apg_abilities_class.lst:226`. Advanced Player's Guide Cavalier ~ Order.MOD row: the 2nd-level order ability (OrderAbility2 at OrderAbilityLVL 2); :227-228 give the 8th and 15th.
- **Grant:** Granted at Cavalier level 1: Foundry classAssociations; PCGen apg_abilities_globalvar.lst:40. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Order abilities by cavalier level: the order at 1st and its order abilities at 2nd, 8th and 15th, (level >= 2) + (level >= 8) + (level >= 15) (PRD cavalier.html:386, each order's abilities such as the order of the cockatrice's :406-409, and the Cavalier table :356-375); PCGen's OrderAbility2, 8 and 15 (apg_abilities_class.lst:226-228) agree. Per level: 1: 0, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 2, 9: 2, 10: 2, 11: 2, 12: 2, 13: 2, 14: 2, 15: 3, 16: 3, 17: 3, 18: 3, 19: 3, 20: 3.
- **Increment names:** each checked against its class table row: `cavalier-order-2` "Order Ability" (`cavalier.html:357`, "Order ability"); `cavalier-order-8` "Order Ability" (`cavalier.html:363`, "Order ability"); `cavalier-order-15` "Order Ability" (`cavalier.html:370`, "Order ability"); and the other 0 likewise.
- **Record:** `description` on `description` (`3f5fc801…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, because the body sits in other batches' committed fixtures (the protected and binding contexts of spells-530 to -536 and feats-350 to -355, among others); a Note would change the entry they hold. The imported entry is identical to the base import.
- **Notices:** PZO1115, each reviewed with no hold in force. PZO1115: Advanced Player's Guide class feature Order and the rules it applies (granted by Cavalier). PZO1115: The cavalier's challenge, whose order benefits an edict violation removes (Advanced Player's Guide cavalier).
- **Outstanding calculations** (never holds):
  - The order pick at 1st, its class skills, edicts and challenge benefit, and its order abilities at 2nd, 8th and 15th — owner #632. The schedule's increments carry no order choice; the description states the rule.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #632. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset).
- **Source discrepancies** (recorded, not resolved):
  - Foundry's pinned record imports no sources (system.sources absent; the import's sources: []); the assessment cites the Advanced Player's Guide, pp. 32-37, from the PRD and PCGen. Importer gap: reported, not fixed.
  - The body nests its second `<p>` inside the first (unclosed). Recorded; the text stays verbatim.
- **Binding:** content `0a50d1fa5035…`, from `buildAssessmentBinding` over the full-corpus preview of the final records. The parent's closure is the entry alone.

## Tests

[`class-abilities-632.test.ts`](../../tests/catalog/class-abilities-632.test.ts). The batch test uses the shared checks in [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts), unchanged since wave A (`describeIncrementParent`): the inventory and launch-subset statement; the pinned body, checked record, PRD lines, PCGen rows, Foundry associations and each increment's name against its class table from the shared store; a re-extraction with committed curation, the binding re-built, and the gate admitting the parent with exactly its increments (an edited body admits neither); and the batch's own rows. Each parent adds that it has no Note, its unmapped Foundry changes, its outstanding owners and its schedule formula. The committed preview is [`tests/fixtures/class-abilities-632/binding-preview.json`](../../tests/fixtures/class-abilities-632/binding-preview.json): the parents as entries, each closure the entry alone, and their increments.

## Preservation and gates

The shared files gain only this batch's rows: its description records, assessments and evidence entries. No Registry, `held-notices.json`, `notice-clearances.json` or `known-notice-holds.json` change. The commands and their results are in [class-abilities-605.md](class-abilities-605.md).
