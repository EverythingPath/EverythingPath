# Class abilities #647: Bonus Feat (CAV) (MVP launch subset, #615 wave D)

MVP launch subset of #647: this inventory curates only pf1/vfu0FW2XYF7cBUQp (Bonus Feat (CAV)); the ticket's other 99 keys stay remaining acceptance under #647. The 99 remaining keys are listed in the inventory's `launchSubset.remainingAcceptance` ([`class-abilities-647.json`](../../scripts/catalog/legal/class-abilities-647.json)) and stay this ticket's acceptance.

| Key                                     | Disposition | Assessment | Required notices | Increments | Evidence                               |
| --------------------------------------- | ----------- | ---------- | ---------------- | ---------- | -------------------------------------- |
| `pf1/vfu0FW2XYF7cBUQp` Bonus Feat (CAV) | admitted    | confirmed  | PZO1115          | 2          | `class-abilities-647-vfu0FW2XYF7cBUQp` |

Its 2 increments (`everythingpath/cavalier-bonus-feat-12`, `everythingpath/cavalier-bonus-feat-18`) have no assessment of their own. Each has `attributionFrom: pf1/vfu0FW2XYF7cBUQp`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Bonus Feat (CAV) is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

## #615 wave D

This report belongs to #615 wave D (curation [#615](https://github.com/AndreasUnunger/EverythingPath/issues/615), increment parents wave D), which assesses nine class-feature parents across six batches so that their schedule increments admit with them: eight parents and 21 increments admitted, Mercy and its 5 increments held. The run report is [class-abilities-615.md](class-abilities-615.md). Reviewer: Opus (AI curator) for the owner, 2026-11-05. Sources: pf1 v11.11 (`418761d2`), pf1-content 11.4.0, the PRD capture `prd-2026-10-20` and PCGen `25523dbc`. No book PDFs; Archives of Nethys not used.

## Evidence

### Bonus Feat (CAV) (`pf1/vfu0FW2XYF7cBUQp`)

- **Body:** [`packs/class-abilities/bonus-feat-cav.vfu0FW2XYF7cBUQp.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/bonus-feat-cav.vfu0FW2XYF7cBUQp.yaml) (sha256 `75f98a28cc45…`); Advanced Player's Guide p. 32-37. The pinned record imports no sources (`sources: []`); the assessment cites the book from the PRD and PCGen.
- **PRD:** `advancedPlayersGuide/baseClasses/cavalier.html:392`. Bonus Feat (cavalier): identical to the body after the heading.
- **PCGen:** `apg_abilities_class.lst:208`. Advanced Player's Guide Cavalier ~ Bonus Feat row: DESC restates the rule with the count CavalierLVL/6 (BONUS:ABILITYPOOL|Cavalier Feat|CavalierLVL/6).
- **Grant:** Granted at Cavalier level 6: Foundry classAssociations; PCGen apg_abilities_globalvar.lst:44. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Cavalier bonus feats by cavalier level = floor(level / 6): one at 6th, 12th and 18th (PRD cavalier.html:392 and the Cavalier table :356-375); PCGen's pool CavalierLVL/6 (apg_abilities_class.lst:208) and Foundry's bonusFeats change floor(@class.level / 6) agree. Per level: 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1, 12: 2, 13: 2, 14: 2, 15: 2, 16: 2, 17: 2, 18: 3, 19: 3, 20: 3.
- **Increment names:** each checked against its class table row: `cavalier-bonus-feat-12` "Bonus Feat" (`cavalier.html:367`, "Bonus feat, demanding challenge"); `cavalier-bonus-feat-18` "Bonus Feat" (`cavalier.html:373`, "Bonus feat").
- **Record:** `description` on `description` (`9ab75e7e…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, so the imported entry stays identical to the base import; other batches' committed fixtures that may hold the body keep theirs.
- **Notices:** PZO1115, each reviewed with no notice hold in force. PZO1115: Advanced Player's Guide class feature Bonus Feat (CAV) and the rules it applies (granted by Cavalier).
- **Outstanding calculations** (never holds):
  - The cavalier's bonus combat feats, floor(cavalier level / 6) (Foundry change on bonusFeats, imported unsupported) — owner #647. Unmapped target: Foundry's bonusFeats change imports as an unsupported `changes` row and adds no feat slot; the description states the rule.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #647. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset).
- **Source discrepancies** (recorded, not resolved):
  - Foundry's pinned record imports no sources (system.sources absent; the import's sources: []); the assessment cites the Advanced Player's Guide, pp. 32-37, from the PRD and PCGen. Importer gap: reported, not fixed.
  - "Combat feats" is the feat category every book uses, not a named rule; no notice beyond PZO1115.
- **Binding:** content `e29715dd4006…`, from `buildAssessmentBinding` over the full-corpus preview. The parent's closure is the entry alone.

## Tests

[`class-abilities-647.test.ts`](../../tests/catalog/class-abilities-647.test.ts). The batch test uses the shared checks in [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts) (`describeIncrementParent`; `describeLaunchFeature` for the held Mercy): the inventory and launch-subset statement; the pinned body, checked record, PRD lines, PCGen rows, Foundry associations and each increment's name against its class table from the shared store; a re-extraction with committed curation, the binding re-built, and the gate admitting an admitted parent with exactly its increments (an edited body admits neither), or holding a held one with its increments; and the batch's own rows. Each parent adds that it has no Note, its unmapped Foundry changes, its outstanding owners and its schedule formula. The committed preview is [`tests/fixtures/class-abilities-647/binding-preview.json`](../../tests/fixtures/class-abilities-647/binding-preview.json): the parents as entries, each closure the entry alone, and their increments.

## Preservation and gates

The shared files gain only this batch's rows: its description records, assessments and evidence entries. No Registry, `held-notices.json`, `notice-clearances.json` or `known-notice-holds.json` change. The commands and their results are in [class-abilities-615.md](class-abilities-615.md).
