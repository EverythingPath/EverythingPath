# Class abilities #640: Lore Master (MVP launch subset, #615 wave D)

MVP launch subset of #640: this inventory curates only pf1/msQWK7TW7mufzf8l (Lore Master); the ticket's other 99 keys stay remaining acceptance under #640. The 99 remaining keys are listed in the inventory's `launchSubset.remainingAcceptance` ([`class-abilities-640.json`](../../scripts/catalog/legal/class-abilities-640.json)) and stay this ticket's acceptance.

| Key                                | Disposition | Assessment | Required notices | Increments | Evidence                               |
| ---------------------------------- | ----------- | ---------- | ---------------- | ---------- | -------------------------------------- |
| `pf1/msQWK7TW7mufzf8l` Lore Master | admitted    | confirmed  | PZO1110, PZO1131 | 2          | `class-abilities-640-msQWK7TW7mufzf8l` |

Its 2 increments (`everythingpath/bard-lore-master-11`, `everythingpath/bard-lore-master-17`) have no assessment of their own. Each has `attributionFrom: pf1/msQWK7TW7mufzf8l`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Lore Master is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

## #615 wave D

This report belongs to #615 wave D (curation [#615](https://github.com/AndreasUnunger/EverythingPath/issues/615), increment parents wave D), which assesses nine class-feature parents across six batches so that their schedule increments admit with them: eight parents and 21 increments admitted, Mercy and its 5 increments held. The run report is [class-abilities-615.md](class-abilities-615.md). Reviewer: Opus (AI curator) for the owner, 2026-11-05. Sources: pf1 v11.11 (`418761d2`), pf1-content 11.4.0, the PRD capture `prd-2026-10-20` and PCGen `25523dbc`. No book PDFs; Archives of Nethys not used.

## Evidence

### Lore Master (`pf1/msQWK7TW7mufzf8l`)

- **Body:** [`packs/class-abilities/lore-master.msQWK7TW7mufzf8l.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/lore-master.msQWK7TW7mufzf8l.yaml) (sha256 `95b2fc429030…`); Core Rulebook p. 38.
- **PRD:** `coreRulebook/classes/bard.html:437`. Lore Master: identical to the body after the heading.
- **PCGen:** `cr_abilities_class.lst:509`. Core Rulebook Bard ~ Lore Master row: DESC restates the rule in the second person, the uses as LoreMasterTimes = min((LoreMasterLVL+1)/6,3); SOURCEPAGE p.38.
- **Grant:** Granted at Bard level 5: Foundry classAssociations; PCGen cr_abilities_class.lst:213. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Lore master uses per day by bard level = floor((level + 1) / 6) from 5th: 1/day at 5th, 2/day at 11th, 3/day at 17th (PRD bard.html:437 and Table: Bard :358-377, "lore master 1/day" to "3/day"); PCGen's min((LoreMasterLVL+1)/6,3) (cr_abilities_class.lst:509) and Foundry's uses.maxFormula floor((@class.level + 1) / 6) agree. Per level: 1: 0, 2: 0, 3: 0, 4: 0, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 2, 12: 2, 13: 2, 14: 2, 15: 2, 16: 2, 17: 3, 18: 3, 19: 3, 20: 3.
- **Increment names:** each checked against its class table row: `bard-lore-master-11` "Lore Master 2/day" (`bard.html:368`, "Inspire competence +4, inspire courage +3, lore master 2/day"); `bard-lore-master-17` "Lore Master 3/day" (`bard.html:374`, "inspire courage +4, lore master 3/day").
- **Record:** `description` on `description` (`84f4ea1f…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, so the imported entry stays identical to the base import; other batches' committed fixtures that may hold the body keep theirs.
- **Notices:** PZO1110, PZO1131, each reviewed with no notice hold in force. PZO1110: Core Rulebook class feature Lore Master and the rules it applies (granted by Bard). PZO1131: Retained Unchained action-cost metadata (activation.unchained) on the record's actions, kept in gameContent (curation.md, "Unchained action costs", #367).
- **Outstanding calculations** (never holds):
  - Lore master: take 10 on trained Knowledge checks, and take 20 as a standard action 1/day at 5th to 3/day at 17th (Foundry uses.maxFormula, retained in gameContent) — owner #640. No feature-use resource on the sheet and taking 10 or 20 is not a sheet statistic; the description states the rule.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #640. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset).
- **Source discrepancies** (recorded, not resolved):
  - Foundry's action carries Unchained action metadata (activation.unchained, type action), retained in gameContent; PZO1131 is required (curation.md, "Unchained action costs", #367).
  - Taking 10 and taking 20 are the general skill rules every book uses; no notice beyond PZO1110 and PZO1131.
- **Binding:** content `d80c27f546d9…`, from `buildAssessmentBinding` over the full-corpus preview. The parent's closure is the entry alone.

## Tests

[`class-abilities-640.test.ts`](../../tests/catalog/class-abilities-640.test.ts). The batch test uses the shared checks in [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts) (`describeIncrementParent`; `describeLaunchFeature` for the held Mercy): the inventory and launch-subset statement; the pinned body, checked record, PRD lines, PCGen rows, Foundry associations and each increment's name against its class table from the shared store; a re-extraction with committed curation, the binding re-built, and the gate admitting an admitted parent with exactly its increments (an edited body admits neither), or holding a held one with its increments; and the batch's own rows. Each parent adds that it has no Note, its unmapped Foundry changes, its outstanding owners and its schedule formula. The committed preview is [`tests/fixtures/class-abilities-640/binding-preview.json`](../../tests/fixtures/class-abilities-640/binding-preview.json): the parents as entries, each closure the entry alone, and their increments.

## Preservation and gates

The shared files gain only this batch's rows: its description records, assessments and evidence entries. No Registry, `held-notices.json`, `notice-clearances.json` or `known-notice-holds.json` change. The commands and their results are in [class-abilities-615.md](class-abilities-615.md).
