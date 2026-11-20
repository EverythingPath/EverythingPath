# Class abilities #639: Channel Energy (MVP launch subset, #631 wave A)

MVP launch subset of #639: this inventory curates only pf1/kXXz1lO4i7CibHJ9 (Channel Energy); the ticket's other 99 keys stay remaining acceptance under #639. The 99 remaining keys are listed in the inventory's `launchSubset.remainingAcceptance` ([`class-abilities-639.json`](../../scripts/catalog/legal/class-abilities-639.json)) and stay this ticket's acceptance.

| Key                                   | Disposition | Assessment | Required notices | Increments | Evidence                               |
| ------------------------------------- | ----------- | ---------- | ---------------- | ---------- | -------------------------------------- |
| `pf1/kXXz1lO4i7CibHJ9` Channel Energy | admitted    | confirmed  | PZO1110, PZO1131 | 9          | `class-abilities-639-kXXz1lO4i7CibHJ9` |

Its 9 increments (`everythingpath/cleric-channel-energy-11`, `everythingpath/cleric-channel-energy-13`, `everythingpath/cleric-channel-energy-15`, `everythingpath/cleric-channel-energy-17`, `everythingpath/cleric-channel-energy-19`, `everythingpath/cleric-channel-energy-3`, `everythingpath/cleric-channel-energy-5`, `everythingpath/cleric-channel-energy-7`, `everythingpath/cleric-channel-energy-9`) have no assessment of their own. Each has `attributionFrom: pf1/kXXz1lO4i7CibHJ9`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Channel Energy is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

## #631 wave A

This report belongs to #631 wave A (curation [#631](https://github.com/AndreasUnunger/EverythingPath/issues/631), increment parents wave A), which assesses ten class-feature parents across eight batches so that their 87 schedule increments admit with them. The run report is [class-abilities-631.md](class-abilities-631.md). Reviewer: Opus (AI curator) for the owner, 2026-11-04. Sources: pf1 v11.11 (`418761d2`), the PRD capture `prd-2026-10-20` and PCGen `25523dbc`. No book PDFs; Archives of Nethys not used.

## Evidence

### Channel Energy (`pf1/kXXz1lO4i7CibHJ9`)

- **Body:** [`packs/class-abilities/channel-energy.kXXz1lO4i7CibHJ9.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/channel-energy.kXXz1lO4i7CibHJ9.yaml) (sha256 `fb5ee385ea89…`); Core Rulebook p. 40.
- **PRD:** `coreRulebook/classes/cleric.html:389,390,391`. Channel Energy: 11 of the body's 16 sentences are identical; five carry the printing's rewording (sourceDiscrepancies). Same rule, same book.
- **PCGen:** `cr_abilities_class.lst:218`. Core Rulebook grant row Cleric ~ Channel Energy at Cleric_CFP_Level 1; the Cleric ~ Channel Energy ability row (:572) is internal and carries no DESC.
- **PCGen:** `cr_abilities_class.lst:572`. Core Rulebook Cleric ~ Channel Energy internal row (no DESC).
- **Grant:** Granted at Cleric level 1: Foundry classAssociations; PCGen cr_abilities_class.lst:218. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Channel energy dice by cleric level = ceil(level / 2) d6: 1d6 at 1st, 2d6 at 3rd, 10d6 at 19th (PRD cleric.html:391 and Table: Cleric :360-379); Foundry's actions use (ceil(@class.level / 2))d6. Per level: 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4, 9: 5, 10: 5, 11: 6, 12: 6, 13: 7, 14: 7, 15: 8, 16: 8, 17: 9, 18: 9, 19: 10, 20: 10.
- **Increment names:** each checked against its class table row: `cleric-channel-energy-3` "Channel Energy 2d6" (`cleric.html:362`, "Channel energy 2d6"); `cleric-channel-energy-5` "Channel Energy 3d6" (`cleric.html:364`, "Channel energy 3d6"); `cleric-channel-energy-7` "Channel Energy 4d6" (`cleric.html:366`, "Channel energy 4d6"); and the other 6 likewise.
- **Record:** `description` on `description` (`fdc7bbf6…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, because the body sits in other batches' committed fixtures (the protected and binding contexts of spells-530 to -536 and feats-350 to -355, among others) and in their assessed closures (six assessments: `pf1-content/JalH63VxUIp3urjY` (traits-373), three racial traits (racial-traits-387, -392, -397) and the Oread and Undine (races-328), all unresolved and held by their own holds); a Note would change the entry they hold. The imported entry is identical to the base import.
- **Notices:** PZO1110, PZO1131, each reviewed with no hold in force. PZO1110: Core Rulebook class feature Channel Energy and the rules it applies (granted by Cleric). PZO1131: Retained Unchained action-cost metadata (activation.unchained) on the record's actions, kept in gameContent (curation.md, "Unchained action costs", #367).
- **Outstanding calculations** (never holds):
  - Channel energy dice, (ceil(cleric level / 2))d6, and the Will save DC 10 + 1/2 cleric level + Cha modifier (Foundry actions, retained in gameContent) — owner #639. The sheet runs no actions; the description states the rule.
  - Uses per day, 3 + Cha modifier (Foundry uses.maxFormula, retained in gameContent) — owner #639. No feature-use resource on the sheet; the description states it.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #639. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset).
- **Source discrepancies** (recorded, not resolved):
  - Five sentences differ in wording from the PRD capture: "(or a neutral cleric who worships a good deity)" and "(or a neutral cleric who worships an evil deity)" for "(or one who worships ...)", "A neutral cleric of a neutral deity" for "A neutral cleric who worships a neutral deity", "can cast spontaneous" for "casts spontaneous", and "healed by channel energy" for "healed by channeled energy". Same rule; recorded, not resolved; the text stays verbatim.
  - Foundry's four actions carry Unchained action-cost metadata (activation.unchained, cost 2), retained in gameContent; PZO1131 is required (curation.md, "Unchained action costs", #367).
- **Binding:** content `00ee8fa05547…`, from `buildAssessmentBinding` over the full-corpus preview of the final records. The parent's closure is the entry alone.

## Tests

[`class-abilities-639.test.ts`](../../tests/catalog/class-abilities-639.test.ts). The batch test uses the shared checks in [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts), generalised in this run (`describeIncrementParent`): the inventory and launch-subset statement; the pinned body, checked record, PRD lines, PCGen rows, Foundry associations and each increment's name against its class table from the shared store; a re-extraction with committed curation, the binding re-built, and the gate admitting the parent with exactly its increments (an edited body admits neither); and the batch's own rows. Each parent adds that it has no Note, its unmapped Foundry changes, its outstanding owners and its schedule formula. The committed preview is [`tests/fixtures/class-abilities-639/binding-preview.json`](../../tests/fixtures/class-abilities-639/binding-preview.json): the parents as entries, each closure the entry alone, and their increments.

## Preservation and gates

The shared files gain only this batch's rows: its description records, assessments and evidence entries. No Registry, `held-notices.json`, `notice-clearances.json` or `known-notice-holds.json` change. The commands and their results are in [class-abilities-631.md](class-abilities-631.md).
