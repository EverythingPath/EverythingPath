# Class abilities #629: Discovery and Favored Enemy (MVP launch subset, #617 wave B)

MVP launch subset of #629: this inventory curates only pf1/Xcim6WFtAtxJxnmA (Discovery) and pf1/XmALhWqXdN9yOmtd (Favored Enemy); the ticket's other 98 keys stay remaining acceptance under #629. The 98 remaining keys are listed in the inventory's `launchSubset.remainingAcceptance` ([`class-abilities-629.json`](../../scripts/catalog/legal/class-abilities-629.json)) and stay this ticket's acceptance.

| Key                                  | Disposition | Assessment | Required notices | Increments | Evidence                               |
| ------------------------------------ | ----------- | ---------- | ---------------- | ---------- | -------------------------------------- |
| `pf1/Xcim6WFtAtxJxnmA` Discovery     | admitted    | confirmed  | PZO1115          | 8          | `class-abilities-629-Xcim6WFtAtxJxnmA` |
| `pf1/XmALhWqXdN9yOmtd` Favored Enemy | admitted    | confirmed  | PZO1110          | 4          | `class-abilities-629-XmALhWqXdN9yOmtd` |

Its 8 increments (`everythingpath/alchemist-discovery-10`, `everythingpath/alchemist-discovery-12`, `everythingpath/alchemist-discovery-14`, `everythingpath/alchemist-discovery-16`, `everythingpath/alchemist-discovery-18`, `everythingpath/alchemist-discovery-4`, `everythingpath/alchemist-discovery-6`, `everythingpath/alchemist-discovery-8`) have no assessment of their own. Each has `attributionFrom: pf1/Xcim6WFtAtxJxnmA`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Discovery is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

Its 4 increments (`everythingpath/ranger-favored-enemy-10`, `everythingpath/ranger-favored-enemy-15`, `everythingpath/ranger-favored-enemy-20`, `everythingpath/ranger-favored-enemy-5`) have no assessment of their own. Each has `attributionFrom: pf1/XmALhWqXdN9yOmtd`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Favored Enemy is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

## #617 wave B

This report belongs to #617 wave B (curation [#617](https://github.com/AndreasUnunger/EverythingPath/issues/617), increment parents wave B), which assesses eleven class-feature parents across five batches so that their 76 schedule increments admit with them. The run report is [class-abilities-617.md](class-abilities-617.md). Reviewer: Opus (AI curator) for the owner, 2026-11-04. Sources: pf1 v11.11 (`418761d2`), the PRD capture `prd-2026-10-20` and PCGen `25523dbc`. No book PDFs; Archives of Nethys not used.

## Evidence

### Discovery (`pf1/Xcim6WFtAtxJxnmA`)

- **Body:** [`packs/class-abilities/discovery.Xcim6WFtAtxJxnmA.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/discovery.Xcim6WFtAtxJxnmA.yaml) (sha256 `64f9c0f1da79…`); Advanced Player's Guide p. 28.
- **PRD:** `advancedPlayersGuide/baseClasses/alchemist.html:399`. Discovery: five of the body's six sentences are identical; the sixth reads "tagged with Does not stack" where the PRD reads "marked with an asterisk (\*)". Same rule.
- **PCGen:** `apg_abilities_globalvar.lst:29`. Advanced Player's Guide grant row Alchemist ~ Discovery at Alchemist_CFP_Level 2; the Alchemist ~ Discovery ability row (apg_abilities_class.lst:117) is internal and carries no DESC.
- **PCGen:** `apg_abilities_class.lst:117`. Advanced Player's Guide Alchemist ~ Discovery internal row: BONUS:ABILITYPOOL|Alchemist Discovery|AlchemistDiscoveryLVL/2 and the DC 10+(AlchemistDiscoveryLVL/2)+INT (no DESC).
- **Grant:** Granted at Alchemist level 2: Foundry class records; PCGen apg_abilities_globalvar.lst:29. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Discoveries by alchemist level = min(floor(level / 2), 9): one at 2nd and every even level to 18th, 9 at 18th; 20th is the grand discovery, not this feature (PRD alchemist.html:399, "up to 18th level", and Table 1-1 :357-376). Per level: 1: 0, 2: 1, 3: 1, 4: 2, 5: 2, 6: 3, 7: 3, 8: 4, 9: 4, 10: 5, 11: 5, 12: 6, 13: 6, 14: 7, 15: 7, 16: 8, 17: 8, 18: 9, 19: 9, 20: 9.
- **Increment names:** each checked against its class table row: `alchemist-discovery-4` "Discovery" (`alchemist.html:360`, "Discovery"); `alchemist-discovery-6` "Discovery" (`alchemist.html:362`, "Discovery, swift poisoning"); `alchemist-discovery-8` "Discovery" (`alchemist.html:364`, "Discovery, poison resistance +6"); and the other 5 likewise.
- **Record:** `description` on `description` (`14815da5…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, because the body sits in other batches' committed fixtures (the protected and binding contexts of spells-530 to -536 and feats-350 to -355, among others) and in their assessed closures (Extra Discovery (`pf1/WYuwfu2h0LWNkU4Y`, feats-331), all unresolved and held by their own holds); a Note would change the entry they hold. The imported entry is identical to the base import.
- **Notices:** PZO1115, each reviewed with no hold in force. PZO1115: Advanced Player's Guide class feature Discovery and the rules it applies (granted by Alchemist).
- **Outstanding calculations** (never holds):
  - Discovery picks at 2nd and every even level to 18th, their prerequisites, the non-stacking bomb discoveries and the save DC 10 + 1/2 alchemist level + Int modifier — owner #629. The schedule's increments carry no discovery choice and no DC formula; the description states the rule.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #629. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset and wave A).
- **Source discrepancies** (recorded, not resolved):
  - The body reads "Discoveries that modify bombs that are tagged with Does not stack do not stack" where the PRD reads "that are marked with an asterisk (\*) do not stack": Foundry's tag wording for the same rule from the same book. Recorded, not resolved; the text stays verbatim, and it adds no notice.
- **Binding:** content `29fd1e44b23a…`, from `buildAssessmentBinding` over the full-corpus preview of the final records. The parent's closure is the entry alone.

### Favored Enemy (`pf1/XmALhWqXdN9yOmtd`)

- **Body:** [`packs/class-abilities/favored-enemy.XmALhWqXdN9yOmtd.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/favored-enemy.XmALhWqXdN9yOmtd.yaml) (sha256 `e71815343be3…`); Core Rulebook p. 64.
- **PRD:** `coreRulebook/classes/ranger.html:420,421,422`. Favored Enemy: all three paragraphs identical to the body after the heading; the body's table equals the 32 rows of Table: Ranger Favored Enemies (:384-418).
- **PCGen:** `cr_abilities_class.lst:288`. Core Rulebook grant row Ranger ~ Favored Enemy at Ranger_CFP_Level 1; the Ranger ~ Favored Enemy ability row (:1444) is internal and carries no DESC.
- **PCGen:** `cr_abilities_class.lst:1444`. Core Rulebook Ranger ~ Favored Enemy internal row: RangerFavoredEnemyCount RangerFavoredEnemyLVL/5+1 and the bonus choices (no DESC).
- **Grant:** Granted at Ranger level 1: Foundry class records; PCGen cr_abilities_class.lst:288. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Favored enemies by ranger level = 1 + floor(level / 5): one at 1st, then 5th, 10th, 15th and 20th, 5 at 20th (PRD ranger.html:421 and Table: Ranger :358-377; PCGen RangerFavoredEnemyLVL/5+1). Per level: 1: 1, 2: 1, 3: 1, 4: 1, 5: 2, 6: 2, 7: 2, 8: 2, 9: 2, 10: 3, 11: 3, 12: 3, 13: 3, 14: 3, 15: 4, 16: 4, 17: 4, 18: 4, 19: 4, 20: 5.
- **Increment names:** each checked against its class table row: `ranger-favored-enemy-5` "2nd Favored Enemy" (`ranger.html:362`, "2nd favored enemy"); `ranger-favored-enemy-10` "3rd Favored Enemy" (`ranger.html:367`, "3rd favored enemy, combat style feat"); `ranger-favored-enemy-15` "4th Favored Enemy" (`ranger.html:372`, "4th favored enemy"); and the other 1 likewise.
- **Record:** `description` on `description` (`87d127ad…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, because the body sits in other batches' committed fixtures (the protected and binding contexts of spells-530 to -536 and feats-350 to -355, among others) and in their assessed closures (four assessments: three traits (traits-367, -370, -386) and the Android (races-328), all unresolved and held by their own holds); a Note would change the entry they hold. The imported entry is identical to the base import.
- **Notices:** PZO1110, each reviewed with no hold in force. PZO1110: Core Rulebook class feature Favored Enemy and the rules it applies (granted by Ranger).
- **Outstanding calculations** (never holds):
  - Favored enemy picks at 1st, 5th, 10th, 15th and 20th, each with its subtype for humanoids and outsiders — owner #629. The schedule's increments carry no creature-type choice; the description and its table state it.
  - The +2 bonus on Bluff, Knowledge, Perception, Sense Motive and Survival checks and on weapon attack and damage rolls against the type, +2 more on one type at each interval — owner #629. The target creature is not a sheet input, so these bonuses have no Modifier; the description states them.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #629. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset and wave A).
- **Binding:** content `dbf1fa9d615e…`, from `buildAssessmentBinding` over the full-corpus preview of the final records. The parent's closure is the entry alone.

## Tests

[`class-abilities-629.test.ts`](../../tests/catalog/class-abilities-629.test.ts). The batch test uses the shared checks in [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts) (`describeIncrementParent`, from wave A): the inventory and launch-subset statement; the pinned body, checked record, PRD lines, PCGen rows, Foundry class records and each increment's name against its class table from the shared store; a re-extraction with committed curation, the binding re-built, and the gate admitting the parent with exactly its increments (an edited body admits neither); and the batch's own rows. Each parent adds that it has no Note, its unmapped Foundry changes, its outstanding owners and its schedule formula. The committed preview is [`tests/fixtures/class-abilities-629/binding-preview.json`](../../tests/fixtures/class-abilities-629/binding-preview.json): the parents as entries, each closure the entry alone, and their increments.

## Preservation and gates

The shared files gain only this batch's rows: its description records, assessments and evidence entries. No Registry, `held-notices.json`, `notice-clearances.json` or `known-notice-holds.json` change. The commands and their results are in [class-abilities-617.md](class-abilities-617.md).
