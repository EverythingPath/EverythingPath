# Class abilities #604: Style Strikes (UC) (MVP launch subset, #615 wave D)

MVP launch subset of #604: this inventory curates only pf1/0eJ9MA8iVuOG8VJi (Style Strikes (UC)); the ticket's other 99 keys stay remaining acceptance under #604. The 99 remaining keys are listed in the inventory's `launchSubset.remainingAcceptance` ([`class-abilities-604.json`](../../scripts/catalog/legal/class-abilities-604.json)) and stay this ticket's acceptance.

| Key                                       | Disposition | Assessment | Required notices | Increments | Evidence                               |
| ----------------------------------------- | ----------- | ---------- | ---------------- | ---------- | -------------------------------------- |
| `pf1/0eJ9MA8iVuOG8VJi` Style Strikes (UC) | admitted    | confirmed  | PZO1131          | 4          | `class-abilities-604-0eJ9MA8iVuOG8VJi` |

Its 4 increments (`everythingpath/unchained-monk-style-strike-13`, `everythingpath/unchained-monk-style-strike-15`, `everythingpath/unchained-monk-style-strike-17`, `everythingpath/unchained-monk-style-strike-9`) have no assessment of their own. Each has `attributionFrom: pf1/0eJ9MA8iVuOG8VJi`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Style Strikes (UC) is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

## #615 wave D

This report belongs to #615 wave D (curation [#615](https://github.com/AndreasUnunger/EverythingPath/issues/615), increment parents wave D), which assesses nine class-feature parents across six batches so that their schedule increments admit with them: eight parents and 21 increments admitted, Mercy and its 5 increments held. The run report is [class-abilities-615.md](class-abilities-615.md). Reviewer: Opus (AI curator) for the owner, 2026-11-05. Sources: pf1 v11.11 (`418761d2`), pf1-content 11.4.0, the PRD capture `prd-2026-10-20` and PCGen `25523dbc`. No book PDFs; Archives of Nethys not used.

## Evidence

### Style Strikes (UC) (`pf1/0eJ9MA8iVuOG8VJi`)

- **Body:** [`packs/class-abilities/style-strikes-uc.0eJ9MA8iVuOG8VJi.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/style-strikes-uc.0eJ9MA8iVuOG8VJi.yaml) (sha256 `82de39518379…`); Pathfinder Unchained p. 18. The pinned record imports no sources (`sources: []`); the assessment cites the book from the PRD and PCGen.
- **PRD:** `unchained/classes/monk.html:482`. Style Strike (Pathfinder Unchained): all 6 of the body's sentences identical, in three paragraphs where the PRD has one; the body moves "He must choose which style strike to apply before the attack roll is made" before the 9th-level sentence and leaves out the closing "The monk can choose from any of the following strikes" and the strike list (:483-).
- **PCGen:** `pu_abilities_class.lst:471`. Pathfinder Unchained Unchained Monk ~ Style Strike row: DESC has the body's sentences in the PRD's order, the pool as Pool_Unchained_Style_Strike (MonkLVL-1)/4; SOURCEPAGE p.18.
- **Grant:** Granted at Monk (Unchained) level 5: Foundry classAssociations; PCGen pu_abilities_class.lst:166. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Style strikes known by unchained monk level: one at 5th and one more every 4 levels after, floor((level - 1) / 4) from 5th, 4 at 17th; from 15th two strikes per round (PRD unchained/classes/monk.html:482 and Table 1-2 :375-394, "Style strike" at 5th, 9th, 13th and 17th, "Style strike (2/round)" at 15th); PCGen's Pool_Unchained_Style_Strike (MonkLVL-1)/4 (pu_abilities_class.lst:471) agrees. Per level: 1: 0, 2: 0, 3: 0, 4: 0, 5: 1, 6: 1, 7: 1, 8: 1, 9: 2, 10: 2, 11: 2, 12: 2, 13: 3, 14: 3, 15: 3, 16: 3, 17: 4, 18: 4, 19: 4, 20: 4.
- **Increment names:** each checked against its class table row: `unchained-monk-style-strike-9` "Style Strike (UC)" (`monk.html:383`, "Improved evasion, style strike"); `unchained-monk-style-strike-13` "Style Strike (UC)" (`monk.html:387`, "Style strike, tongue of the sun and moon"); `unchained-monk-style-strike-15` "Style Strike (2/round) (UC)" (`monk.html:389`, "Style strike (2/round)"); and the other 1 likewise.
- **Record:** `description` on `description` (`330f31db…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, so the imported entry stays identical to the base import; other batches' committed fixtures that may hold the body keep theirs.
- **Notices:** PZO1131, each reviewed with no notice hold in force. PZO1131: Pathfinder Unchained class feature Style Strikes (UC) and the rules it applies (granted by Monk (Unchained)).
- **Outstanding calculations** (never holds):
  - The style strike picks at 5th and every 4 levels after, their effects on one flurry attack, and two style strikes per round from 15th — owner #604. The schedule's increments carry no strike choice and a flurry attack's rider is not a sheet statistic; the description states the rule.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #604. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset).
- **Source discrepancies** (recorded, not resolved):
  - Foundry's pinned record imports no sources (system.sources absent; the import's sources: []); the assessment cites the Pathfinder Unchained, p. 18 (PCGen SOURCEPAGE:p.18), from the PRD and PCGen. Importer gap: reported, not fixed.
  - The body splits the PRD paragraph in three and moves "He must choose which style strike to apply before the attack roll is made" before the 9th-level sentence (PRD unchained/classes/monk.html:482); it leaves out the closing sentence and the strike list. Same rule; recorded, not resolved; the text stays verbatim.
  - Foundry names the body "Style Strikes (UC)"; the PRD and PCGen name it "Style Strike". Recorded.
- **Binding:** content `6cbe0a2c19fc…`, from `buildAssessmentBinding` over the full-corpus preview. The parent's closure is the entry alone.

## Tests

[`class-abilities-604.test.ts`](../../tests/catalog/class-abilities-604.test.ts). The batch test uses the shared checks in [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts) (`describeIncrementParent`; `describeLaunchFeature` for the held Mercy): the inventory and launch-subset statement; the pinned body, checked record, PRD lines, PCGen rows, Foundry associations and each increment's name against its class table from the shared store; a re-extraction with committed curation, the binding re-built, and the gate admitting an admitted parent with exactly its increments (an edited body admits neither), or holding a held one with its increments; and the batch's own rows. Each parent adds that it has no Note, its unmapped Foundry changes, its outstanding owners and its schedule formula. The committed preview is [`tests/fixtures/class-abilities-604/binding-preview.json`](../../tests/fixtures/class-abilities-604/binding-preview.json): the parents as entries, each closure the entry alone, and their increments.

## Preservation and gates

The shared files gain only this batch's rows: its description records, assessments and evidence entries. No Registry, `held-notices.json`, `notice-clearances.json` or `known-notice-holds.json` change. The commands and their results are in [class-abilities-615.md](class-abilities-615.md).
