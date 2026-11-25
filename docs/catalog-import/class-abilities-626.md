# Class abilities #626: Favored Terrain and Flurry of Blows (UC) (MVP launch subset, #615 wave D)

MVP launch subset of #626: this inventory curates only pf1/U2YBSx1s8cT8iDq1 (Favored Terrain) and pf1/TaBxJdJQp5SFDPyn (Flurry of Blows (UC)); the ticket's other 98 keys stay remaining acceptance under #626. The 98 remaining keys are listed in the inventory's `launchSubset.remainingAcceptance` ([`class-abilities-626.json`](../../scripts/catalog/legal/class-abilities-626.json)) and stay this ticket's acceptance.

| Key                                         | Disposition | Assessment | Required notices | Increments | Evidence                               |
| ------------------------------------------- | ----------- | ---------- | ---------------- | ---------- | -------------------------------------- |
| `pf1/U2YBSx1s8cT8iDq1` Favored Terrain      | admitted    | confirmed  | PZO1110          | 3          | `class-abilities-626-U2YBSx1s8cT8iDq1` |
| `pf1/TaBxJdJQp5SFDPyn` Flurry of Blows (UC) | admitted    | confirmed  | PZO1110, PZO1131 | 1          | `class-abilities-626-TaBxJdJQp5SFDPyn` |

Its 3 increments (`everythingpath/ranger-favored-terrain-13`, `everythingpath/ranger-favored-terrain-18`, `everythingpath/ranger-favored-terrain-8`) have no assessment of their own. Each has `attributionFrom: pf1/U2YBSx1s8cT8iDq1`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Favored Terrain is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

Its 1 increments (`everythingpath/unchained-monk-flurry-11`) have no assessment of their own. Each has `attributionFrom: pf1/TaBxJdJQp5SFDPyn`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Flurry of Blows (UC) is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

## #615 wave D

This report belongs to #615 wave D (curation [#615](https://github.com/AndreasUnunger/EverythingPath/issues/615), increment parents wave D), which assesses nine class-feature parents across six batches so that their schedule increments admit with them: eight parents and 21 increments admitted, Mercy and its 5 increments held. The run report is [class-abilities-615.md](class-abilities-615.md). Reviewer: Opus (AI curator) for the owner, 2026-11-05. Sources: pf1 v11.11 (`418761d2`), pf1-content 11.4.0, the PRD capture `prd-2026-10-20` and PCGen `25523dbc`. No book PDFs; Archives of Nethys not used.

## Evidence

### Favored Terrain (`pf1/U2YBSx1s8cT8iDq1`)

- **Body:** [`packs/class-abilities/favored-terrain.U2YBSx1s8cT8iDq1.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/favored-terrain.U2YBSx1s8cT8iDq1.yaml) (sha256 `bf70145adee6…`); Core Rulebook p. 65.
- **PRD:** `coreRulebook/classes/ranger.html:447-449`. Favored Terrain: 5 of the body's 7 sentences identical; the body reads "from Table: Ranger Favored Terrains" where the PRD reads "from the Favored Terrains table", and its table repeats the PRD's Favored Terrains table (:434-446) cell for cell.
- **PRD:** `coreRulebook/classes/ranger.html:434-446`. The Favored Terrains table: the same eleven terrains as the body's table.
- **PCGen:** `cr_abilities_class.lst:1445`. Core Rulebook Ranger ~ Favored Terrain row: no DESC; its terrain pool is FavoredTerrainPool (RangerFavoredTerrainLVL+2)/5.
- **Grant:** Granted at Ranger level 3: Foundry classAssociations; PCGen cr_abilities_class.lst:289. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Favored terrains by ranger level = 1 + floor((level - 3) / 5) from 3rd: one at 3rd, 2nd at 8th, 3rd at 13th, 4th at 18th, each new one raising one terrain's bonus by +2 (PRD ranger.html:447-448 and Table: Ranger :358-377); PCGen's FavoredTerrainPool (RangerFavoredTerrainLVL+2)/5 (cr_abilities_class.lst:1445) agrees. Per level: 1: 0, 2: 0, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 2, 9: 2, 10: 2, 11: 2, 12: 2, 13: 3, 14: 3, 15: 3, 16: 3, 17: 3, 18: 4, 19: 4, 20: 4.
- **Increment names:** each checked against its class table row: `ranger-favored-terrain-8` "2nd Favored Terrain" (`ranger.html:365`, "Swift tracker, 2nd favored terrain"); `ranger-favored-terrain-13` "3rd Favored Terrain" (`ranger.html:370`, "3rd favored terrain"); `ranger-favored-terrain-18` "4th Favored Terrain" (`ranger.html:375`, "4th favored terrain, combat style feat").
- **Record:** `description` on `description` (`abc939d8…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, so the imported entry stays identical to the base import and the assessed closures that reach it (`pf1-content/BiXxi3I21cIMNm0o`, traits-370; `pf1-content/BqVkgnmsHdi3UgLc`, traits-370; `pf1-content/FbKbQqa4psU4LF1c`, traits-372; `pf1-content/TQUVpXNu7bAbTEAy`, racial-traits-395; `pf1-content/Wi9RMrZnkVkKMKNF`, racial-traits-396; `pf1-content/ybANEreVJo80yuXS`, traits-386) keep their bindings; other batches' committed fixtures that may hold the body keep theirs.
- **Notices:** PZO1110, each reviewed with no notice hold in force. PZO1110: Core Rulebook class feature Favored Terrain and the rules it applies (granted by Ranger).
- **Outstanding calculations** (never holds):
  - The favored terrain picks at 3rd and every five levels after, and the +2 bonuses on initiative and Knowledge (geography), Perception, Stealth and Survival checks in each terrain, one terrain raised by +2 per pick — owner #626. The terrain is not a sheet input, so the bonuses have no Modifier; the description states the rule.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #626. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset).
- **Source discrepancies** (recorded, not resolved):
  - The body reads "from Table: Ranger Favored Terrains" where the PRD capture reads "from the Favored Terrains table" (ranger.html:447). Same rule; recorded, not resolved; the text stays verbatim.
  - The body's table caption is "Table: Ranger Favored Terrains", the PRD's "Favored Terrains" (ranger.html:434). Recorded.
- **Binding:** content `fce0debf6e98…`, from `buildAssessmentBinding` over the full-corpus preview. The parent's closure is the entry alone.

### Flurry of Blows (UC) (`pf1/TaBxJdJQp5SFDPyn`)

- **Body:** [`packs/class-abilities/flurry-of-blows-uc.TaBxJdJQp5SFDPyn.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/flurry-of-blows-uc.TaBxJdJQp5SFDPyn.yaml) (sha256 `d56747f82932…`); Pathfinder Unchained p. 14.
- **PRD:** `unchained/classes/monk.html:411-412`. Flurry of Blows (Pathfinder Unchained): both paragraphs identical to the body after the heading.
- **PCGen:** `pu_abilities_class.lst:462`. Pathfinder Unchained Unchained Monk ~ Flurry of Blows row: DESC reproduces the paragraphs; SOURCEPAGE p.14.
- **Grant:** Granted at Monk (Unchained) level 1: Foundry classAssociations; PCGen pu_abilities_class.lst:157. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Flurry bonus attacks at the highest base attack bonus by unchained monk level: one at 1st, two from 11th (PRD unchained/classes/monk.html:411-412 and Table 1-2 :375-394, "Flurry of blows (bonus attack)" at 11th). Per level: 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 2, 12: 2, 13: 2, 14: 2, 15: 2, 16: 2, 17: 2, 18: 2, 19: 2, 20: 2.
- **Increment names:** each checked against its class table row: `unchained-monk-flurry-11` "Flurry of Blows (bonus attack) (UC)" (`monk.html:385`, "Flurry of blows (bonus attack)").
- **Record:** `description` on `description` (`232b4ba1…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, so the imported entry stays identical to the base import; other batches' committed fixtures that may hold the body keep theirs.
- **Notices:** PZO1110, PZO1131, each reviewed with no notice hold in force. PZO1110: The haste spell's extra attack on a full attack, with which the body's flurry attacks stack (Core Rulebook spell, p. 293). PZO1131: Pathfinder Unchained class feature Flurry of Blows (UC) and the rules it applies (granted by Monk (Unchained)).
- **Outstanding calculations** (never holds):
  - The flurry's additional attacks at the highest base attack bonus, one at 1st and two from 11th, as a full-attack action with unarmed strikes and monk weapons — owner #626. Attack sequences are not a sheet statistic; the description states the rule.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #626. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset).
- **Source discrepancies** (recorded, not resolved):
  - Foundry names the body "Flurry of Blows (UC)"; the PRD and PCGen name it "Flurry of Blows". Recorded, not resolved.
  - The body leaves its first `<p>` unclosed. Recorded; the text stays verbatim.
  - The action's activation.unchained (cost 3, type action) is the body's own book's, already PZO1131.
- **Binding:** content `ec2eb763dd24…`, from `buildAssessmentBinding` over the full-corpus preview. The parent's closure is the entry alone.

## Tests

[`class-abilities-626.test.ts`](../../tests/catalog/class-abilities-626.test.ts). The batch test uses the shared checks in [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts) (`describeIncrementParent`; `describeLaunchFeature` for the held Mercy): the inventory and launch-subset statement; the pinned body, checked record, PRD lines, PCGen rows, Foundry associations and each increment's name against its class table from the shared store; a re-extraction with committed curation, the binding re-built, and the gate admitting an admitted parent with exactly its increments (an edited body admits neither), or holding a held one with its increments; and the batch's own rows. Each parent adds that it has no Note, its unmapped Foundry changes, its outstanding owners and its schedule formula. The committed preview is [`tests/fixtures/class-abilities-626/binding-preview.json`](../../tests/fixtures/class-abilities-626/binding-preview.json): the parents as entries, each closure the entry alone, and their increments.

## Preservation and gates

The shared files gain only this batch's rows: its description records, assessments and evidence entries. No Registry, `held-notices.json`, `notice-clearances.json` or `known-notice-holds.json` change. The commands and their results are in [class-abilities-615.md](class-abilities-615.md).
