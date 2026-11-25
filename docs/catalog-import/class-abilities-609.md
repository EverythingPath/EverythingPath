# Class abilities #609: Teamwork Feat and Ki Pool (UC) (MVP launch subset, #605 wave C)

MVP launch subset of #609: this inventory curates only pf1/717fyDCcfLtD345B (Teamwork Feat) and pf1/7BfYNNkYjjBevun8 (Ki Pool (UC)); the ticket's other 98 keys stay remaining acceptance under #609. The 98 remaining keys are listed in the inventory's `launchSubset.remainingAcceptance` ([`class-abilities-609.json`](../../scripts/catalog/legal/class-abilities-609.json)) and stay this ticket's acceptance.

| Key                                  | Disposition | Assessment | Required notices | Increments | Evidence                               |
| ------------------------------------ | ----------- | ---------- | ---------------- | ---------- | -------------------------------------- |
| `pf1/717fyDCcfLtD345B` Teamwork Feat | admitted    | confirmed  | PZO1115          | 5          | `class-abilities-609-717fyDCcfLtD345B` |
| `pf1/7BfYNNkYjjBevun8` Ki Pool (UC)  | admitted    | confirmed  | PZO1110, PZO1131 | 3          | `class-abilities-609-7BfYNNkYjjBevun8` |

Its 5 increments (`everythingpath/inquisitor-teamwork-feat-12`, `everythingpath/inquisitor-teamwork-feat-15`, `everythingpath/inquisitor-teamwork-feat-18`, `everythingpath/inquisitor-teamwork-feat-6`, `everythingpath/inquisitor-teamwork-feat-9`) have no assessment of their own. Each has `attributionFrom: pf1/717fyDCcfLtD345B`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Teamwork Feat is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

Its 3 increments (`everythingpath/unchained-monk-ki-pool-10`, `everythingpath/unchained-monk-ki-pool-16`, `everythingpath/unchained-monk-ki-pool-7`) have no assessment of their own. Each has `attributionFrom: pf1/7BfYNNkYjjBevun8`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Ki Pool (UC) is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

## #605 wave C

This report belongs to #605 wave C (curation [#605](https://github.com/AndreasUnunger/EverythingPath/issues/605), increment parents wave C), which assesses ten class-feature parents across five batches so that their 39 schedule increments admit with them. The run report is [class-abilities-605.md](class-abilities-605.md). Reviewer: Opus (AI curator) for the owner, 2026-11-04. Sources: pf1 v11.11 (`418761d2`), the PRD capture `prd-2026-10-20` and PCGen `25523dbc`. No book PDFs; Archives of Nethys not used.

Sneak Attack (`pf1/6pjr8jMFSKqXkBKk`) is this ticket's too. It stays remaining acceptance: it is dependently omitted on held linked entries and runs after waves A to C (the increment-parents research, "Excluded").

## Evidence

### Teamwork Feat (`pf1/717fyDCcfLtD345B`)

- **Body:** [`packs/class-abilities/teamwork-feat.717fyDCcfLtD345B.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/teamwork-feat.717fyDCcfLtD345B.yaml) (sha256 `ade3dba1b6e2…`); Advanced Player's Guide p. 38-42. The pinned record imports no sources (`sources: []`); the assessment cites the book from the PRD and PCGen.
- **PRD:** `advancedPlayersGuide/baseClasses/inquisitor.html:432,433`. Teamwork Feat: both paragraphs identical to the body after the heading.
- **PCGen:** `apg_abilities_class.lst:355`. Advanced Player's Guide Inquisitor ~ Teamwork Feat ability row: no DESC; its teamwork-feat pool is InquisitorLVL/3 (BONUS:ABILITYPOOL|Inquisitor Teamwork Feat).
- **PCGen:** `apg_abilities_class.lst:359`. Advanced Player's Guide Inquisitor ~ Teamwork Feat.MOD row: takes the 3rd-level feat off while Inquisitor_CF_TeamworkFeat3 is set; :360-364 do the same at 6 to 18.
- **Grant:** Granted at Inquisitor level 3: Foundry classAssociations; PCGen apg_abilities_globalvar.lst:61. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Teamwork feats by inquisitor level = floor(level / 3): one at 3rd and every three levels after, 6 at 18th (PRD inquisitor.html:432 and Table 2-4 :358-377); PCGen's pool InquisitorLVL/3 (apg_abilities_class.lst:355) and Foundry's bonusFeats change floor(@class.level / 3) agree. Per level: 1: 0, 2: 0, 3: 1, 4: 1, 5: 1, 6: 2, 7: 2, 8: 2, 9: 3, 10: 3, 11: 3, 12: 4, 13: 4, 14: 4, 15: 5, 16: 5, 17: 5, 18: 6, 19: 6, 20: 6.
- **Increment names:** each checked against its class table row: `inquisitor-teamwork-feat-6` "Teamwork Feat" (`inquisitor.html:363`, "Teamwork feat"); `inquisitor-teamwork-feat-9` "Teamwork Feat" (`inquisitor.html:366`, "Teamwork feat"); `inquisitor-teamwork-feat-12` "Teamwork Feat" (`inquisitor.html:369`, "Greater bane, teamwork feat"); and the other 2 likewise.
- **Record:** `description` on `description` (`1961756a…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, because the body sits in other batches' committed fixtures (the protected and binding contexts of spells-530 to -536 and feats-350 to -355, among others); a Note would change the entry they hold. The imported entry is identical to the base import.
- **Notices:** PZO1115, each reviewed with no hold in force. PZO1115: Advanced Player's Guide class feature Teamwork Feat and the rules it applies (granted by Inquisitor).
- **Outstanding calculations** (never holds):
  - The teamwork bonus feats, floor(inquisitor level / 3) (Foundry change on bonusFeats, imported unsupported), and the daily exchange of the most recent one — owner #609. Unmapped target: Foundry's bonusFeats change imports as an unsupported `changes` row and adds no feat slot; the description states the rule.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #609. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset).
- **Source discrepancies** (recorded, not resolved):
  - Foundry's pinned record imports no sources (system.sources absent; the import's sources: []); the assessment cites the Advanced Player's Guide, pp. 38-42, from the PRD and PCGen. Importer gap: reported, not fixed.
  - The body nests its second `<p>` inside the first (unclosed). Recorded; the text stays verbatim.
- **Binding:** content `f0444c26bf54…`, from `buildAssessmentBinding` over the full-corpus preview of the final records. The parent's closure is the entry alone.

### Ki Pool (UC) (`pf1/7BfYNNkYjjBevun8`)

- **Body:** [`packs/class-abilities/ki-pool-uc.7BfYNNkYjjBevun8.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/ki-pool-uc.7BfYNNkYjjBevun8.yaml) (sha256 `49761bfb267e…`); Pathfinder Unchained p. 15.
- **PRD:** `unchained/classes/monk.html:441,442,443`. Ki Pool (Pathfinder Unchained): all three paragraphs identical to the body after the heading.
- **PCGen:** `pu_abilities_class.lst:467`. Pathfinder Unchained Unchained Monk ~ Ki Pool row: DESC reproduces the paragraphs; SOURCEPAGE p.15.
- **Grant:** Granted at Monk (Unchained) level 3: Foundry classAssociations; PCGen pu_abilities_class.lst:162. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Ki strike steps by unchained monk level: magic at 3rd, cold iron and silver at 7th, lawful at 10th, adamantine at 16th (PRD unchained/classes/monk.html:441 and Table 1-2 :375-394, "Ki strike (magic)" to "Ki strike (adamantine)"); the pool holds 1/2 monk level + Wisdom modifier points from 3rd. Per level: 1: 0, 2: 0, 3: 1, 4: 1, 5: 1, 6: 1, 7: 2, 8: 2, 9: 2, 10: 3, 11: 3, 12: 3, 13: 3, 14: 3, 15: 3, 16: 4, 17: 4, 18: 4, 19: 4, 20: 4.
- **Increment names:** each checked against its class table row: `unchained-monk-ki-pool-7` "Ki Strike (cold iron/silver) (UC)" (`monk.html:381`, "Ki strike (cold iron/silver)"); `unchained-monk-ki-pool-10` "Ki Strike (lawful) (UC)" (`monk.html:384`, "Bonus feat, ki power, ki strike (lawful)"); `unchained-monk-ki-pool-16` "Ki Strike (adamantine) (UC)" (`monk.html:390`, "Ki power, ki strike (adamantine)"); and the other 0 likewise.
- **Record:** `description` on `description` (`2a07cf17…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, because the body sits in other batches' committed fixtures (the protected and binding contexts of spells-530 to -536 and feats-350 to -355, among others); a Note would change the entry they hold. The imported entry is identical to the base import.
- **Notices:** PZO1110, PZO1131, each reviewed with no hold in force. PZO1110: The haste spell's extra attack on a full attack, with which the body's ki pool bonus attack stacks (Core Rulebook spell, p. 293). PZO1131: Pathfinder Unchained class feature Ki Pool (UC) and the rules it applies (granted by Monk (Unchained)).
- **Outstanding calculations** (never holds):
  - Ki points, 1/2 monk level + Wisdom modifier (Foundry uses.maxFormula, retained in gameContent), and the 1-point extra unarmed strike in a flurry — owner #609. No feature-use resource on the sheet; the description states the rule.
  - Ki strike: unarmed attacks count as magic, cold iron and silver, lawful and adamantine against damage reduction and hardness — owner #609. Damage reduction bypass is not a sheet statistic; the description and the increments' names state it.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #609. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset).
- **Source discrepancies** (recorded, not resolved):
  - Foundry names the body "Ki Pool (UC)"; the PRD and PCGen name it "Ki Pool". Recorded, not resolved.
  - The increments are named Ki Strike (...) (UC), as the Unchained Monk table prints ki strike (...); the body is the Ki Pool that gives the ki strike. Recorded.
  - The body leaves two `<p>` unclosed. Recorded; the text stays verbatim.
- **Binding:** content `75c0306a6d17…`, from `buildAssessmentBinding` over the full-corpus preview of the final records. The parent's closure is the entry alone.

## Tests

[`class-abilities-609.test.ts`](../../tests/catalog/class-abilities-609.test.ts). The batch test uses the shared checks in [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts), unchanged since wave A (`describeIncrementParent`): the inventory and launch-subset statement; the pinned body, checked record, PRD lines, PCGen rows, Foundry associations and each increment's name against its class table from the shared store; a re-extraction with committed curation, the binding re-built, and the gate admitting the parent with exactly its increments (an edited body admits neither); and the batch's own rows. Each parent adds that it has no Note, its unmapped Foundry changes, its outstanding owners and its schedule formula. The committed preview is [`tests/fixtures/class-abilities-609/binding-preview.json`](../../tests/fixtures/class-abilities-609/binding-preview.json): the parents as entries, each closure the entry alone, and their increments.

## Preservation and gates

The shared files gain only this batch's rows: its description records, assessments and evidence entries. No Registry, `held-notices.json`, `notice-clearances.json` or `known-notice-holds.json` change. The commands and their results are in [class-abilities-605.md](class-abilities-605.md).
