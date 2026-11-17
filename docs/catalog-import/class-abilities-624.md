# Class abilities #624: Damage Reduction and Bloodline Spells (BLO) (MVP launch subset, #617 wave B)

MVP launch subset of #624: this inventory curates only pf1/RENIeTVjWB7Mq6Mw (Damage Reduction) and pf1/RJ66UHdnwJ7VuWFo (Bloodline Spells (BLO)); the ticket's other 98 keys stay remaining acceptance under #624. The 98 remaining keys are listed in the inventory's `launchSubset.remainingAcceptance` ([`class-abilities-624.json`](../../scripts/catalog/legal/class-abilities-624.json)) and stay this ticket's acceptance.

| Key                                           | Disposition | Assessment | Required notices          | Increments | Evidence                               |
| --------------------------------------------- | ----------- | ---------- | ------------------------- | ---------- | -------------------------------------- |
| `pf1/RENIeTVjWB7Mq6Mw` Damage Reduction       | admitted    | confirmed  | PZO1110, PZO1129, PZO1131 | 12         | `class-abilities-624-RENIeTVjWB7Mq6Mw` |
| `pf1/RJ66UHdnwJ7VuWFo` Bloodline Spells (BLO) | admitted    | confirmed  | PZO1129                   | 3          | `class-abilities-624-RJ66UHdnwJ7VuWFo` |

Its 12 increments (`everythingpath/barbarian-damage-reduction-10`, `everythingpath/barbarian-damage-reduction-13`, `everythingpath/barbarian-damage-reduction-16`, `everythingpath/barbarian-damage-reduction-19`, `everythingpath/bloodrager-damage-reduction-10`, `everythingpath/bloodrager-damage-reduction-13`, `everythingpath/bloodrager-damage-reduction-16`, `everythingpath/bloodrager-damage-reduction-19`, `everythingpath/unchained-barbarian-damage-reduction-10`, `everythingpath/unchained-barbarian-damage-reduction-13`, `everythingpath/unchained-barbarian-damage-reduction-16`, `everythingpath/unchained-barbarian-damage-reduction-19`) have no assessment of their own. Each has `attributionFrom: pf1/RENIeTVjWB7Mq6Mw`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Damage Reduction is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

Its 3 increments (`everythingpath/bloodrager-bloodline-spell-10`, `everythingpath/bloodrager-bloodline-spell-13`, `everythingpath/bloodrager-bloodline-spell-16`) have no assessment of their own. Each has `attributionFrom: pf1/RJ66UHdnwJ7VuWFo`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Bloodline Spells (BLO) is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

## #617 wave B

This report belongs to #617 wave B (curation [#617](https://github.com/AndreasUnunger/EverythingPath/issues/617), increment parents wave B), which assesses eleven class-feature parents across five batches so that their 76 schedule increments admit with them. The run report is [class-abilities-617.md](class-abilities-617.md). Reviewer: Opus (AI curator) for the owner, 2026-11-04. Sources: pf1 v11.11 (`418761d2`), the PRD capture `prd-2026-10-20` and PCGen `25523dbc`. No book PDFs; Archives of Nethys not used.

## Evidence

### Damage Reduction (`pf1/RENIeTVjWB7Mq6Mw`)

- **Body:** [`packs/class-abilities/damage-reduction.RENIeTVjWB7Mq6Mw.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/damage-reduction.RENIeTVjWB7Mq6Mw.yaml) (sha256 `43ce25740eba…`); Core Rulebook p. 34, Advanced Class Guide p. 16, Pathfinder Unchained p. 13.
- **PRD:** `coreRulebook/classes/barbarian.html:419`. Damage Reduction (CRB): the body generalises "a barbarian" and "barbarian levels" to "the character" and "class levels"; the last sentence is identical. Same rule.
- **PRD:** `unchained/classes/barbarian.html:469`. Damage Reduction (Pathfinder Unchained): the same rule, worded "Each time the barbarian takes damage ..., subtract 1" and "(up to 5 points at 19th level)".
- **PRD:** `advancedClassGuide/classes/bloodrager.html:469`. Damage Reduction (Advanced Class Guide bloodrager): the same rule, "every 3 levels thereafter ... increases by 1 point".
- **PCGen:** `cr_abilities_class.lst:424`. Core Rulebook Barbarian ~ Damage Reduction row: DESC summarises the rule ("Subtract %1 from the damage you take"), BarbarianDR (BarbarianDRLVL-4)/3.
- **PCGen:** `pu_abilities_class.lst:293`. Pathfinder Unchained Unchained Barbarian ~ Damage Reduction row (SOURCEPAGE p.13): the same DESC and formula.
- **PCGen:** `acg_abilities_class.lst:341`. Advanced Class Guide Bloodrager ~ Damage Reduction row (SOURCEPAGE p.16): DESC "At 7th level, a bloodrager gains damage reduction", BloodragerDR (BloodragerDRLVL-4)/3.
- **Grant:** Granted at Barbarian level 7, Barbarian (Unchained) level 7, Bloodrager level 7: Foundry class records; PCGen cr_abilities_class.lst:153, pu_abilities_class.lst:137, acg_classes.lst:57. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** DR x/— by class level = 1 + floor((level - 7) / 3) from 7th: 1/— at 7th, then +1 at 10th, 13th, 16th and 19th, 5/— at 19th, for the Barbarian, the Unchained Barbarian and the Bloodrager (PRD barbarian.html:419, unchained barbarian.html:469, bloodrager.html:469 and their tables; PCGen (DRLVL-4)/3). Per level: 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 1, 8: 1, 9: 1, 10: 2, 11: 2, 12: 2, 13: 3, 14: 3, 15: 3, 16: 4, 17: 4, 18: 4, 19: 5, 20: 5.
- **Increment names:** each checked against its class table row: `barbarian-damage-reduction-10` "Damage Reduction 2/—" (`barbarian.html:366`, "Damage reduction 2/—, Rage power"); `barbarian-damage-reduction-13` "Damage Reduction 3/—" (`barbarian.html:369`, "Damage reduction 3/—"); `barbarian-damage-reduction-16` "Damage Reduction 4/—" (`barbarian.html:372`, "Damage reduction 4/—, Rage power"); and the other 9 likewise.
- **Record:** `description` on `description` (`8071ffeb…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, because the body sits in other batches' committed fixtures (the protected and binding contexts of spells-530 to -536 and feats-350 to -355, among others); a Note would change the entry they hold. The imported entry is identical to the base import.
- **Notices:** PZO1110, PZO1129, PZO1131, each reviewed with no hold in force. PZO1110: Core Rulebook class feature Damage Reduction and the rules it applies (granted by Barbarian, Barbarian (Unchained), Bloodrager). PZO1129: Advanced Class Guide class feature Damage Reduction and the rules it applies (granted by Barbarian, Barbarian (Unchained), Bloodrager). PZO1131: Pathfinder Unchained class feature Damage Reduction and the rules it applies (granted by Barbarian, Barbarian (Unchained), Bloodrager).
- **Outstanding calculations** (never holds):
  - Damage reduction x/—, 1 at 7th rising by 1 at 10th, 13th, 16th and 19th — owner #624. The record carries no Foundry change and the increments no DR value; the description and the increments' names state it.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #624. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset and wave A).
- **Source discrepancies** (recorded, not resolved):
  - The body is one generic text for three classes: "the character" and "class levels" replace the Core Rulebook's "barbarian" and "barbarian levels". Same rule as all three PRD sections; recorded, not resolved; the text stays verbatim.
  - Foundry associates Barbarian and Bloodrager (associations.classes); the Unchained Barbarian's class record also links it (barbarian-unchained.W3EjUgYLJ1D9qDKw.yaml), so PZO1131 is required, besides the imported PZO1110 and PZO1129.
- **Binding:** content `101458ef5906…`, from `buildAssessmentBinding` over the full-corpus preview of the final records. The parent's closure is the entry alone.

### Bloodline Spells (BLO) (`pf1/RJ66UHdnwJ7VuWFo`)

- **Body:** [`packs/class-abilities/bloodline-spells-blo.RJ66UHdnwJ7VuWFo.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/bloodline-spells-blo.RJ66UHdnwJ7VuWFo.yaml) (sha256 `7ee7d60d802b…`); Advanced Class Guide p. 15.
- **PRD:** `advancedClassGuide/classes/bloodrager.html:443`. Bloodline (bonus spells paragraph): two sentences identical; the body reads "the number of spells already known to the bloodrager" where the PRD reads "the number of spells given on Table 1-4". Same rule. The Bloodline heading paragraph is :439.
- **PCGen:** `acg_abilities_class.lst:566`. Advanced Class Guide Aberrant Bloodline (bloodrager) row, the bloodline record the bonus spells hang on: Bloodrager_Aberrant_BloodlineSpellLvl1..4 at bloodline progression 7, 10, 13 and 16. PCGen has no Bloodline Spells grant row.
- **PCGen:** `acg_abilities_class.lst:578`. Advanced Class Guide Aberrant Bloodrager Bloodline ~ Bonus Spells row: SPELLKNOWN of the bloodline spell of each level once its SpellLvl is reached.
- **Grant:** Granted at Bloodrager level 7: Foundry class records; PCGen acg_abilities_class.lst:566. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Bloodline spells known by bloodrager level: one at 7th, 10th, 13th and 16th, 4 from 16th (PRD bloodrager.html:443 and Table 1-4 :376-395, "Bloodline spell" at 7th to 16th; PCGen Bloodrager_Aberrant_BloodlineSpellLvl1..4 at 7, 10, 13 and 16, acg_abilities_class.lst:566). Per level: 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 1, 8: 1, 9: 1, 10: 2, 11: 2, 12: 2, 13: 3, 14: 3, 15: 3, 16: 4, 17: 4, 18: 4, 19: 4, 20: 4.
- **Increment names:** each checked against its class table row: `bloodrager-bloodline-spell-10` "Bloodline Spell" (`bloodrager.html:385`, "Bloodline spell, damage reduction 2/—"); `bloodrager-bloodline-spell-13` "Bloodline Spell" (`bloodrager.html:388`, "Bloodline spell, damage reduction 3/—"); `bloodrager-bloodline-spell-16` "Bloodline Spell" (`bloodrager.html:391`, "Bloodline spell, bloodline power, damage reduction 4/—").
- **Record:** `description` on `description` (`fcb93bb4…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, because the body sits in other batches' committed fixtures (the protected and binding contexts of spells-530 to -536 and feats-350 to -355, among others); a Note would change the entry they hold. The imported entry is identical to the base import.
- **Notices:** PZO1129, each reviewed with no hold in force. PZO1129: Advanced Class Guide class feature Bloodline Spells (BLO) and the rules it applies (granted by Bloodrager).
- **Outstanding calculations** (never holds):
  - The bloodline's granted spells, added to the spells known at 7th, 10th, 13th and 16th (lever 5, grantedSpells) — owner #624. The increments carry no granted spell; the bloodline's spell list is the bloodline's own record. The description states the rule.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #624. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset and wave A).
- **Source discrepancies** (recorded, not resolved):
  - The body reads "in addition to the number of spells already known to the bloodrager" where the PRD reads "in addition to the number of spells given on Table 1-4". Same rule; recorded, not resolved; the text stays verbatim.
  - Foundry associates the body with the Sorcerer (associations.classes, retained in gameContent), but only the Bloodrager class record links it (bloodrager.E27lMw9YNOAjS009.yaml); the body states only the bloodrager's rule. Recorded, not resolved; no further notice.
  - PCGen has no Bloodline Spells grant row; the grant evidence is the bloodline record's spell levels (acg_abilities_class.lst:566).
- **Binding:** content `5cdfdd466514…`, from `buildAssessmentBinding` over the full-corpus preview of the final records. The parent's closure is the entry alone.

## Tests

[`class-abilities-624.test.ts`](../../tests/catalog/class-abilities-624.test.ts). The batch test uses the shared checks in [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts) (`describeIncrementParent`, from wave A): the inventory and launch-subset statement; the pinned body, checked record, PRD lines, PCGen rows, Foundry class records and each increment's name against its class table from the shared store; a re-extraction with committed curation, the binding re-built, and the gate admitting the parent with exactly its increments (an edited body admits neither); and the batch's own rows. Each parent adds that it has no Note, its unmapped Foundry changes, its outstanding owners and its schedule formula. The committed preview is [`tests/fixtures/class-abilities-624/binding-preview.json`](../../tests/fixtures/class-abilities-624/binding-preview.json): the parents as entries, each closure the entry alone, and their increments.

## Preservation and gates

The shared files gain only this batch's rows: its description records, assessments and evidence entries. No Registry, `held-notices.json`, `notice-clearances.json` or `known-notice-holds.json` change. The commands and their results are in [class-abilities-617.md](class-abilities-617.md).
