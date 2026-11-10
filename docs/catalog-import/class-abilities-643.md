# Class abilities #643: Bloodline Spells (SOR) and Judgment (MVP launch subset, #631 wave A)

MVP launch subset of #643: this inventory curates only pf1/qlQxKPARGGdOgNWm (Bloodline Spells (SOR)) and pf1/qI4IouTn4uvDPSXv (Judgment); the ticket's other 98 keys stay remaining acceptance under #643. The 98 remaining keys are listed in the inventory's `launchSubset.remainingAcceptance` ([`class-abilities-643.json`](../../scripts/catalog/legal/class-abilities-643.json)) and stay this ticket's acceptance.

| Key                                           | Disposition | Assessment | Required notices | Increments | Evidence                               |
| --------------------------------------------- | ----------- | ---------- | ---------------- | ---------- | -------------------------------------- |
| `pf1/qlQxKPARGGdOgNWm` Bloodline Spells (SOR) | admitted    | confirmed  | PZO1110          | 8          | `class-abilities-643-qlQxKPARGGdOgNWm` |
| `pf1/qI4IouTn4uvDPSXv` Judgment               | admitted    | confirmed  | PZO1115, PZO1131 | 6          | `class-abilities-643-qI4IouTn4uvDPSXv` |

Its 8 increments (`everythingpath/sorcerer-bloodline-spell-11`, `everythingpath/sorcerer-bloodline-spell-13`, `everythingpath/sorcerer-bloodline-spell-15`, `everythingpath/sorcerer-bloodline-spell-17`, `everythingpath/sorcerer-bloodline-spell-19`, `everythingpath/sorcerer-bloodline-spell-5`, `everythingpath/sorcerer-bloodline-spell-7`, `everythingpath/sorcerer-bloodline-spell-9`) have no assessment of their own. Each has `attributionFrom: pf1/qlQxKPARGGdOgNWm`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Bloodline Spells (SOR) is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

Its 6 increments (`everythingpath/inquisitor-judgment-10`, `everythingpath/inquisitor-judgment-13`, `everythingpath/inquisitor-judgment-16`, `everythingpath/inquisitor-judgment-19`, `everythingpath/inquisitor-judgment-4`, `everythingpath/inquisitor-judgment-7`) have no assessment of their own. Each has `attributionFrom: pf1/qI4IouTn4uvDPSXv`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Judgment is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

## #631 wave A

This report belongs to #631 wave A (curation [#631](https://github.com/AndreasUnunger/EverythingPath/issues/631), increment parents wave A), which assesses ten class-feature parents across eight batches so that their 87 schedule increments admit with them. The run report is [class-abilities-631.md](class-abilities-631.md). Reviewer: Opus (AI curator) for the owner, 2026-11-04. Sources: pf1 v11.11 (`418761d2`), the PRD capture `prd-2026-10-20` and PCGen `25523dbc`. No book PDFs; Archives of Nethys not used.

## Evidence

### Bloodline Spells (SOR) (`pf1/qlQxKPARGGdOgNWm`)

- **Body:** [`packs/class-abilities/bloodline-spells-sor.qlQxKPARGGdOgNWm.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/bloodline-spells-sor.qlQxKPARGGdOgNWm.yaml) (sha256 `a44eb5b805d6…`); Core Rulebook p. 71.
- **PRD:** `coreRulebook/classes/sorcerer.html:416`. Bloodline (spells paragraph): two sentences identical; the body reads "the number of spells already known to the sorcerer" where the PRD reads "the number of spells given on Table: Sorcerer Spells Known". Same rule. The Bloodline heading paragraph is :415.
- **PCGen:** `cr_abilities_class.lst:2338`. Core Rulebook Aberrant Bloodline ~ Bonus Spells row, the record the schedule's decision names: SPELLKNOWN adds the bloodline spell of level n from BloodlineCasterLVL 3, 5 ... 19. PCGen has no Bloodline Spells grant row.
- **Grant:** Granted at Sorcerer level 3: Foundry classAssociations; PCGen cr_abilities_globalvar.lst:993, cr_abilities_globalvar.lst:1001. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Bloodline spells known by sorcerer level = floor((level - 1) / 2) from 3rd: one at 3rd and every two levels to 19th, 9 at 19th (PRD sorcerer.html:416 and Table: Sorcerer :359-378, "Bloodline spell" at 3rd to 19th; PCGen BloodlineCasterLVL 3, 5 ... 19 at cr_abilities_class.lst:2338). Per level: 1: 0, 2: 0, 3: 1, 4: 1, 5: 2, 6: 2, 7: 3, 8: 3, 9: 4, 10: 4, 11: 5, 12: 5, 13: 6, 14: 6, 15: 7, 16: 7, 17: 8, 18: 8, 19: 9, 20: 9.
- **Increment names:** each checked against its class table row: `sorcerer-bloodline-spell-5` "Bloodline Spell" (`sorcerer.html:363`, "Bloodline spell"); `sorcerer-bloodline-spell-7` "Bloodline Spell" (`sorcerer.html:365`, "Bloodline feat, bloodline spell"); `sorcerer-bloodline-spell-9` "Bloodline Spell" (`sorcerer.html:367`, "Bloodline power, bloodline spell"); and the other 5 likewise.
- **Record:** `description` on `description` (`3ab359e5…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, because the body sits in other batches' committed fixtures (the protected and binding contexts of spells-530 to -536 and feats-350 to -355, among others) and in their assessed closures (20 assessments: 15 racial traits (racial-traits-387 to -400) and five races (races-328: Oread, Ifrit, Undine, Tiefling, Sylph), all unresolved and held by their own holds); a Note would change the entry they hold. The imported entry is identical to the base import.
- **Notices:** PZO1110, each reviewed with no hold in force. PZO1110: Core Rulebook class feature Bloodline Spells (SOR) and the rules it applies (granted by Sorcerer).
- **Outstanding calculations** (never holds):
  - The bloodline's granted spells, added to the spells known at 3rd to 19th (lever 5, grantedSpells) — owner #643. The increments carry no granted spell; the bloodline's spell list is the bloodline's own record. The description states the rule.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #643. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset).
- **Source discrepancies** (recorded, not resolved):
  - The body reads "in addition to the number of spells already known to the sorcerer" where the PRD reads "in addition to the number of spells given on Table: Sorcerer Spells Known". Same rule; recorded, not resolved; the text stays verbatim.
  - PCGen has no Bloodline Spells grant row; the grant evidence is the Sorcerer_CF_BloodlineSpell1..9 definitions (cr_abilities_globalvar.lst:993-1001) the bloodline bonus-spell records test.
- **Binding:** content `07d806fa4a89…`, from `buildAssessmentBinding` over the full-corpus preview of the final records. The parent's closure is the entry alone.

### Judgment (`pf1/qI4IouTn4uvDPSXv`)

- **Body:** [`packs/class-abilities/judgment.qI4IouTn4uvDPSXv.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/judgment.qI4IouTn4uvDPSXv.yaml) (sha256 `6b8870bcf293…`); Advanced Player's Guide p. 38-42. The pinned record imports no sources (`sources: []`); the assessment cites the book from the PRD and PCGen.
- **PRD:** `advancedPlayersGuide/baseClasses/inquisitor.html:413,414,415,416,417,418,419,420,421,422,423,424`. Judgment: all twelve paragraphs (the rule and its nine judgments) identical to the body after the heading.
- **PCGen:** `apg_abilities_globalvar.lst:54`. Advanced Player's Guide grant row Inquisitor ~ Judgment at Inquisitor_CFP_Level 1; the Inquisitor ~ Judgment ability row (apg_abilities_class.lst:354) carries no DESC.
- **PCGen:** `apg_abilities_class.lst:354`. Advanced Player's Guide Inquisitor ~ Judgment ability row (no DESC).
- **Grant:** Granted at Inquisitor level 1: Foundry classAssociations; PCGen apg_abilities_globalvar.lst:54. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Judgment uses per day by inquisitor level = 1 + floor((level - 1) / 3): 1 at 1st, 2 at 4th, 7 at 19th (PRD inquisitor.html:414 and Table 2-4 :358-377); Foundry's uses.maxFormula 1 + floor((@class.level - 1) / 3) agrees. Per level: 1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 4, 11: 4, 12: 4, 13: 5, 14: 5, 15: 5, 16: 6, 17: 6, 18: 6, 19: 7, 20: 7.
- **Increment names:** each checked against its class table row: `inquisitor-judgment-4` "Judgment 2/day" (`inquisitor.html:361`, "Judgment 2/day"); `inquisitor-judgment-7` "Judgment 3/day" (`inquisitor.html:364`, "Judgment 3/day"); `inquisitor-judgment-10` "Judgment 4/day" (`inquisitor.html:367`, "Judgment 4/day"); and the other 3 likewise.
- **Record:** `description` on `description` (`6046f6d3…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, because the body sits in other batches' committed fixtures (the protected and binding contexts of spells-530 to -536 and feats-350 to -355, among others); a Note would change the entry they hold. The imported entry is identical to the base import.
- **Notices:** PZO1115, PZO1131, each reviewed with no hold in force. PZO1115: Advanced Player's Guide class feature Judgment and the rules it applies (granted by Inquisitor). PZO1131: Retained Unchained action-cost metadata (activation.unchained) on the record's actions, kept in gameContent (curation.md, "Unchained action costs", #367).
- **Outstanding calculations** (never holds):
  - Judgment uses per day, 1 + floor((inquisitor level - 1) / 3) (Foundry uses.maxFormula, retained in gameContent) — owner #643. No feature-use resource on the sheet; the description states the rule.
  - Each judgment's sacred or profane bonus, fast healing, DR, energy resistance and smiting by inquisitor level — owner #643. The judgment choice is not a sheet input and its bonuses have no Modifier; the description states them.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #643. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset).
- **Source discrepancies** (recorded, not resolved):
  - Foundry's pinned record imports no sources (system.sources absent; the import's sources: []); the assessment cites the Advanced Player's Guide, pp. 38-42, from the PRD and PCGen. Importer gap: reported, not fixed.
  - Foundry's action carries Unchained action metadata (activation.unchained, type action), retained in gameContent; PZO1131 is required (curation.md, "Unchained action costs", #367).
  - The body leaves its paragraphs unclosed. Recorded; the text stays verbatim.
- **Binding:** content `e6156faa8f13…`, from `buildAssessmentBinding` over the full-corpus preview of the final records. The parent's closure is the entry alone.

## Tests

[`class-abilities-643.test.ts`](../../tests/catalog/class-abilities-643.test.ts). The batch test uses the shared checks in [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts), generalised in this run (`describeIncrementParent`): the inventory and launch-subset statement; the pinned body, checked record, PRD lines, PCGen rows, Foundry associations and each increment's name against its class table from the shared store; a re-extraction with committed curation, the binding re-built, and the gate admitting the parent with exactly its increments (an edited body admits neither); and the batch's own rows. Each parent adds that it has no Note, its unmapped Foundry changes, its outstanding owners and its schedule formula. The committed preview is [`tests/fixtures/class-abilities-643/binding-preview.json`](../../tests/fixtures/class-abilities-643/binding-preview.json): the parents as entries, each closure the entry alone, and their increments.

## Preservation and gates

The shared files gain only this batch's rows: its description records, assessments and evidence entries. No Registry, `held-notices.json`, `notice-clearances.json` or `known-notice-holds.json` change. The commands and their results are in [class-abilities-631.md](class-abilities-631.md).
