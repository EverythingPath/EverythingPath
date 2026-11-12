# Class abilities #612: Bloodrager Bloodline (MVP launch subset, #605 wave C)

MVP launch subset of #612: this inventory curates only pf1/Aq9rx7oWgv7A7kiV (Bloodrager Bloodline); the ticket's other 99 keys stay remaining acceptance under #612. The 99 remaining keys are listed in the inventory's `launchSubset.remainingAcceptance` ([`class-abilities-612.json`](../../scripts/catalog/legal/class-abilities-612.json)) and stay this ticket's acceptance.

| Key                                         | Disposition | Assessment | Required notices | Increments | Evidence                               |
| ------------------------------------------- | ----------- | ---------- | ---------------- | ---------- | -------------------------------------- |
| `pf1/Aq9rx7oWgv7A7kiV` Bloodrager Bloodline | admitted    | confirmed  | PZO1129          | 5          | `class-abilities-612-Aq9rx7oWgv7A7kiV` |

Its 5 increments (`everythingpath/bloodrager-bloodline-12`, `everythingpath/bloodrager-bloodline-16`, `everythingpath/bloodrager-bloodline-20`, `everythingpath/bloodrager-bloodline-4`, `everythingpath/bloodrager-bloodline-8`) have no assessment of their own. Each has `attributionFrom: pf1/Aq9rx7oWgv7A7kiV`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Bloodrager Bloodline is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

## #605 wave C

This report belongs to #605 wave C (curation [#605](https://github.com/AndreasUnunger/EverythingPath/issues/605), increment parents wave C), which assesses ten class-feature parents across five batches so that their 39 schedule increments admit with them. The run report is [class-abilities-605.md](class-abilities-605.md). Reviewer: Opus (AI curator) for the owner, 2026-11-04. Sources: pf1 v11.11 (`418761d2`), the PRD capture `prd-2026-10-20` and PCGen `25523dbc`. No book PDFs; Archives of Nethys not used.

Combat Style Feat (`pf1/BO7BEFHDcf6qBaYV`) is this ticket's too. It stays remaining acceptance: it is dependently omitted on held linked entries and runs after waves A to C (the increment-parents research, "Excluded").

## Evidence

### Bloodrager Bloodline (`pf1/Aq9rx7oWgv7A7kiV`)

- **Body:** [`packs/class-abilities/bloodrager-bloodline.Aq9rx7oWgv7A7kiV.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/bloodrager-bloodline.Aq9rx7oWgv7A7kiV.yaml) (sha256 `96bd45b1b0a9…`); Advanced Class Guide p. 15.
- **PRD:** `advancedClassGuide/classes/bloodrager.html:439,440,441,444`. Bloodline (its general paragraphs): 12 of the body's 13 sentences identical; the last reads "his former bloodline" where the PRD reads "his previous bloodline". The PRD's bonus-feat (:442) and bonus-spell (:443) paragraphs are Foundry's Bloodline Feat (BLO) and Bloodline Spells (BLO).
- **PCGen:** `acg_abilities_class.lst:332`. Advanced Class Guide Bloodrager ~ Standard Bloodline row: DESC reproduces the Bloodline paragraphs; SOURCEPAGE p.15.
- **Grant:** Granted at Bloodrager level 1: Foundry classAssociations; PCGen acg_classes.lst:48. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Bloodline powers by bloodrager level = 1 + floor(level / 4): the bloodline and its first power at 1st, one more at 4th and every 4 levels after, 6 at 20th (PRD bloodrager.html:441 and the Bloodrager table :376-395, "bloodline power" at 1st, 4th, 8th, 12th, 16th and 20th); PCGen defines Bloodrager_CF_BloodlinePower1, 4, 8, 12, 16 and 20 (acg_abilities_globalvar.lst:105-110). Per level: 1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 2, 7: 2, 8: 3, 9: 3, 10: 3, 11: 3, 12: 4, 13: 4, 14: 4, 15: 4, 16: 5, 17: 5, 18: 5, 19: 5, 20: 6.
- **Increment names:** each checked against its class table row: `bloodrager-bloodline-4` "Bloodline Power" (`bloodrager.html:379`, "Blood casting, bloodline power, Eschew Materials"); `bloodrager-bloodline-8` "Bloodline Power" (`bloodrager.html:383`, "Bloodline power"); `bloodrager-bloodline-12` "Bloodline Power" (`bloodrager.html:387`, "Bloodline feat, bloodline power"); and the other 2 likewise.
- **Record:** `description` on `description` (`fb2f3695…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, because the body sits in other batches' committed fixtures (the protected and binding contexts of spells-530 to -536 and feats-350 to -355, among others); a Note would change the entry they hold. The imported entry is identical to the base import.
- **Notices:** PZO1129, each reviewed with no hold in force. PZO1129: Advanced Class Guide class feature Bloodrager Bloodline and the rules it applies (granted by Bloodrager).
- **Outstanding calculations** (never holds):
  - The bloodline pick at 1st and its bloodline powers at 1st, 4th and every 4 levels after — owner #612. The schedule's increments carry no bloodline choice and no power; the description states the rule.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #612. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset).
- **Source discrepancies** (recorded, not resolved):
  - The body reads "his former bloodline" where the PRD reads "his previous bloodline" (bloodrager.html:444). Same rule; recorded, not resolved; the text stays verbatim.
  - The body leaves out the PRD's bonus-feat and bonus-spell paragraphs (:442-443), which Foundry gives as Bloodline Feat (BLO) and Bloodline Spells (BLO). Recorded, not resolved.
  - "Another class that grants a bloodline" names no class; the body restates no other book's rule, so no notice beyond PZO1129.
- **Binding:** content `77d80b875cef…`, from `buildAssessmentBinding` over the full-corpus preview of the final records. The parent's closure is the entry alone.

## Tests

[`class-abilities-612.test.ts`](../../tests/catalog/class-abilities-612.test.ts). The batch test uses the shared checks in [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts), unchanged since wave A (`describeIncrementParent`): the inventory and launch-subset statement; the pinned body, checked record, PRD lines, PCGen rows, Foundry associations and each increment's name against its class table from the shared store; a re-extraction with committed curation, the binding re-built, and the gate admitting the parent with exactly its increments (an edited body admits neither); and the batch's own rows. Each parent adds that it has no Note, its unmapped Foundry changes, its outstanding owners and its schedule formula. The committed preview is [`tests/fixtures/class-abilities-612/binding-preview.json`](../../tests/fixtures/class-abilities-612/binding-preview.json): the parents as entries, each closure the entry alone, and their increments.

## Preservation and gates

The shared files gain only this batch's rows: its description records, assessments and evidence entries. No Registry, `held-notices.json`, `notice-clearances.json` or `known-notice-holds.json` change. The commands and their results are in [class-abilities-605.md](class-abilities-605.md).
