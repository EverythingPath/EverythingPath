# Class abilities #616: Hex (MVP launch subset, #631 wave A)

MVP launch subset of #616: this inventory curates only pf1/GBkIhC1Bpp2MAD4e (Hex); the ticket's other 99 keys stay remaining acceptance under #616. The 99 remaining keys are listed in the inventory's `launchSubset.remainingAcceptance` ([`class-abilities-616.json`](../../scripts/catalog/legal/class-abilities-616.json)) and stay this ticket's acceptance.

| Key                        | Disposition | Assessment | Required notices | Increments | Evidence                               |
| -------------------------- | ----------- | ---------- | ---------------- | ---------- | -------------------------------------- |
| `pf1/GBkIhC1Bpp2MAD4e` Hex | admitted    | confirmed  | PZO1115          | 10         | `class-abilities-616-GBkIhC1Bpp2MAD4e` |

Its 10 increments (`everythingpath/witch-hex-10`, `everythingpath/witch-hex-12`, `everythingpath/witch-hex-14`, `everythingpath/witch-hex-16`, `everythingpath/witch-hex-18`, `everythingpath/witch-hex-2`, `everythingpath/witch-hex-20`, `everythingpath/witch-hex-4`, `everythingpath/witch-hex-6`, `everythingpath/witch-hex-8`) have no assessment of their own. Each has `attributionFrom: pf1/GBkIhC1Bpp2MAD4e`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Hex is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

## #631 wave A

This report belongs to #631 wave A (curation [#631](https://github.com/AndreasUnunger/EverythingPath/issues/631), increment parents wave A), which assesses ten class-feature parents across eight batches so that their 87 schedule increments admit with them. The run report is [class-abilities-631.md](class-abilities-631.md). Reviewer: Opus (AI curator) for the owner, 2026-11-04. Sources: pf1 v11.11 (`418761d2`), the PRD capture `prd-2026-10-20` and PCGen `25523dbc`. No book PDFs; Archives of Nethys not used.

## Evidence

### Hex (`pf1/GBkIhC1Bpp2MAD4e`)

- **Body:** [`packs/class-abilities/hex.GBkIhC1Bpp2MAD4e.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/hex.GBkIhC1Bpp2MAD4e.yaml) (sha256 `574402e45780…`); Advanced Player's Guide p. 65-71. The pinned record imports no sources (`sources: []`); the assessment cites the book from the PRD and PCGen.
- **PRD:** `advancedPlayersGuide/baseClasses/witch.html:415,416`. Hex: both paragraphs identical to the body after the heading.
- **PCGen:** `apg_abilities_class.lst:853`. Advanced Player's Guide Witch ~ Hex row: its first DESC reproduces both paragraphs.
- **Grant:** Granted at Witch level 1: Foundry classAssociations; PCGen apg_abilities_globalvar.lst:553. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Hexes known by witch level = 1 + floor(level / 2): one at 1st and one more at every even level, 11 at 20th (PRD witch.html:415 and Table 2-10 :378-397). Per level: 1: 1, 2: 2, 3: 2, 4: 3, 5: 3, 6: 4, 7: 4, 8: 5, 9: 5, 10: 6, 11: 6, 12: 7, 13: 7, 14: 8, 15: 8, 16: 9, 17: 9, 18: 10, 19: 10, 20: 11.
- **Increment names:** each checked against its class table row: `witch-hex-2` "Hex" (`witch.html:379`, "Hex"); `witch-hex-4` "Hex" (`witch.html:381`, "Hex"); `witch-hex-6` "Hex" (`witch.html:383`, "Hex"); and the other 7 likewise.
- **Record:** `description` on `description` (`56fdae12…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, because the body sits in other batches' committed fixtures (the protected and binding contexts of spells-530 to -536 and feats-350 to -355, among others) and in their assessed closures (Extra Hex (`pf1/Wyg5K1Y72Jf5Yehb`, feats-331), all unresolved and held by their own holds); a Note would change the entry they hold. The imported entry is identical to the base import.
- **Notices:** PZO1115, each reviewed with no hold in force. PZO1115: Advanced Player's Guide class feature Hex and the rules it applies (granted by Witch).
- **Outstanding calculations** (never holds):
  - Hex picks, one at 1st and every even level, and each hex's save DC 10 + 1/2 witch level + Int modifier — owner #616. The schedule's increments carry no hex choice and no DC formula; the description states the rule.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #616. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset).
- **Source discrepancies** (recorded, not resolved):
  - Foundry's pinned record imports no sources (system.sources absent; the import's sources: []); the assessment cites the Advanced Player's Guide, pp. 65-71, from the PRD and PCGen. Importer gap: reported, not fixed.
  - Foundry also associates the body with the Shaman (associations.classes, retained in gameContent), but only the Witch class record links it (witch.RC4D4WFT5kRKkdqp.yaml:54-55); the body states only the witch's rule. Under curation.md ("Class features": the book of the class that owns it, by the class record's literal lines) no Advanced Class Guide notice is required. Recorded, not resolved.
  - The body nests its second `<p>` inside the first (unclosed). Recorded; the text stays verbatim.
- **Binding:** content `988ba4dabe68…`, from `buildAssessmentBinding` over the full-corpus preview of the final records. The parent's closure is the entry alone.

## Tests

[`class-abilities-616.test.ts`](../../tests/catalog/class-abilities-616.test.ts). The batch test uses the shared checks in [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts), generalised in this run (`describeIncrementParent`): the inventory and launch-subset statement; the pinned body, checked record, PRD lines, PCGen rows, Foundry associations and each increment's name against its class table from the shared store; a re-extraction with committed curation, the binding re-built, and the gate admitting the parent with exactly its increments (an edited body admits neither); and the batch's own rows. Each parent adds that it has no Note, its unmapped Foundry changes, its outstanding owners and its schedule formula. The committed preview is [`tests/fixtures/class-abilities-616/binding-preview.json`](../../tests/fixtures/class-abilities-616/binding-preview.json): the parents as entries, each closure the entry alone, and their increments.

## Preservation and gates

The shared files gain only this batch's rows: its description records, assessments and evidence entries. No Registry, `held-notices.json`, `notice-clearances.json` or `known-notice-holds.json` change. The commands and their results are in [class-abilities-631.md](class-abilities-631.md).
