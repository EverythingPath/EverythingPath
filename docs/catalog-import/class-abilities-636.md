# Class abilities #636: Bravery (MVP launch subset, #596 run A; Inspire Courage and Bonus Feats (MAG), #615 wave D)

MVP launch subset of #636: this inventory curates only pf1/h0Brxw6khcjlEf1T (Bravery), pf1/h56K6HEBOItImPPL (Inspire Courage) and pf1/gzBR0qkMdu0KkLV0 (Bonus Feats (MAG)); the ticket's other 97 keys stay remaining acceptance under #636. The 97 remaining keys are listed in the inventory's `launchSubset.remainingAcceptance` ([`class-abilities-636.json`](../../scripts/catalog/legal/class-abilities-636.json)) and stay this ticket's acceptance.

| Key                            | Disposition | Assessment | Required notices | Evidence                               |
| ------------------------------ | ----------- | ---------- | ---------------- | -------------------------------------- |
| `pf1/h0Brxw6khcjlEf1T` Bravery | admitted    | confirmed  | PZO1110          | `class-abilities-636-h0Brxw6khcjlEf1T` |

## #596 run A

This report is one of six for the Fighter launch subset, run A of [#596](https://github.com/AndreasUnunger/EverythingPath/issues/596): one class feature from each of six class-ability batches, each with its own inventory, fixture, test and report. Fighter (`pf1/WLqBCT5DqmGAx8Wd`, #596) and Bonus Feats (`pf1/CV8BsY3ciUb9TA1Y`, #613) followed in run B, after S3 ([classes-596.md](classes-596.md)): Bonus Feats and its ten `everythingpath/fighter-bonus-feats-N` increments are admitted, and the Fighter has a confirmed assessment but is dependently omitted while Weapon Training and its 9th, 13th and 17th level increments stay held. Run B also reworded the #770 Fighter pins. The public 1→20 Fighter proof waits for the owner's Weapon Training evidence (run C). Weapon and feat pools stay with their owners, and #413 is untouched.

| Batch                                                               | Key                    | Feature                      | Level | Disposition | Assessment | Required notices                                                                                  |
| ------------------------------------------------------------------- | ---------------------- | ---------------------------- | ----- | ----------- | ---------- | ------------------------------------------------------------------------------------------------- |
| [#636](https://github.com/AndreasUnunger/EverythingPath/issues/636) | `pf1/h0Brxw6khcjlEf1T` | Bravery                      | 2     | admitted    | confirmed  | PZO1110                                                                                           |
| [#608](https://github.com/AndreasUnunger/EverythingPath/issues/608) | `pf1/5JFfSqLMCpbRmERa` | Armor Training               | 3     | admitted    | confirmed  | PZO1110                                                                                           |
| [#637](https://github.com/AndreasUnunger/EverythingPath/issues/637) | `pf1/iqeyCQIIVnNt0p3h` | Armor Training (Heavy Armor) | 7     | admitted    | confirmed  | PZO1110                                                                                           |
| [#621](https://github.com/AndreasUnunger/EverythingPath/issues/621) | `pf1/McXAM1BoPHZLO1n4` | Weapon Mastery               | 20    | admitted    | confirmed  | PZO1110                                                                                           |
| [#622](https://github.com/AndreasUnunger/EverythingPath/issues/622) | `pf1/NwTe1Q2utlsmOAqK` | Armor Mastery                | 19    | admitted    | confirmed  | PZO1110                                                                                           |
| [#625](https://github.com/AndreasUnunger/EverythingPath/issues/625) | `pf1/RzEzudurxQFirFoF` | Weapon Training              | 5     | held        | unresolved | PZO1110, PZO1118, PZO1123, PZO1140, PZO9226, PZO9422, PZO9455, PZO9410, PZO9481, PZO9491, PZO9493 |

Reports: [class-abilities-636.md](class-abilities-636.md), [class-abilities-608.md](class-abilities-608.md), [class-abilities-637.md](class-abilities-637.md), [class-abilities-621.md](class-abilities-621.md), [class-abilities-622.md](class-abilities-622.md), [class-abilities-625.md](class-abilities-625.md). Reviewer: Sol (AI curator) for the owner, 2026-10-31. Sources: pf1 v11.11 (`418761d2`), the PRD capture `prd-2026-10-20` (`pages/coreRulebook/classes/fighter.html`, sha256 `80143dd3…`) and PCGen `25523dbc` (`core_rulebook/cr_abilities_class.lst`, sha256 `5e1035eb…`). No book PDFs; Archives of Nethys not used.

Full-corpus preview at the pins (`inputVerification: verified`): base `3bc50ea5` **108 admitted, 23,190 held, 154 dependent omissions, 1,628 failures**; with this run **113, 23,185, 154, 1,627**. Newly admitted: Bravery, Armor Training, Armor Training (Heavy Armor), Weapon Mastery and Armor Mastery. The one failure removed is Bravery's `Missing curation record: note will (9a041362…)`; none is added. Weapon Training is held on its named holds; Fighter stays held for its missing assessment (run B).

## Evidence

- **Body:** [`packs/class-abilities/bravery.h0Brxw6khcjlEf1T.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/bravery.h0Brxw6khcjlEf1T.yaml) (sha256 `cdb732df6ba8…`), Core Rulebook p. 55.
- **PRD:** `fighter.html:382`. Bravery (Ex), identical to the body after its heading.
- **PCGen:** `cr_abilities_class.lst:888`. Core Rulebook Fighter ~ Bravery row (SOURCEPAGE p.55): DESC "+%1 bonus to Will saves against fear effects", BONUS:VAR|Bravery|(BraveryLVL+2)/4.
- **Grant:** Granted at Fighter level 2: PCGen ABILITY at Fighter_CFP_Level 2 (:258), BraveryLVL = FighterLVL from 2nd (:253); Foundry classAssociations level 2; PRD table "bravery +1" at 2nd. PCGen `:253`, `:258`; Foundry `classes/fighter.WLqBCT5DqmGAx8Wd.yaml:44-45`.
- **Schedule through level 20:** Will bonus vs fear = floor((fighter level + 2) / 4) from 2nd level: +1 at 2nd, +2 at 6th, +3 at 10th, +4 at 14th, +5 at 18th (PRD table :357-373; reviewed schedule scripts/catalog/pcgen/schedules.ts "bravery"). Per level: 1: 0, 2: 1, 3: 1, 4: 1, 5: 1, 6: 2, 7: 2, 8: 2, 9: 2, 10: 3, 11: 3, 12: 3, 13: 3, 14: 4, 15: 4, 16: 4, 17: 4, 18: 5, 19: 5, 20: 5.

## Records

- `description` on `description` (`1b2746b6…`), checked: no output; Covered/no-output: the checked note record for the body's own "will" context note supplies the rule as one Modifier (Will, untyped, floor((@classLevel.fighter + 2) / 4), shared Situation fear), as PRD coreRulebook/classes/fighter.html:382 and PCGen cr_abilities_class.lst:888 state it. Attribution is assessed separately.
- `note` on `will` (`9a041362…`), checked: Modifier save.will, untyped, `floor((@classLevel.fighter + 2) / 4)`, Situation `fear`.

The prose pass found this body a candidate; its description record is written and checked by hand, as every key needs one.

## Attribution

Complete CRB class feature (p. 55) compared with the PRD capture (coreRulebook/classes/fighter.html:382, identical after its "Bravery (Ex):" heading) and PCGen's Core Rulebook row (cr_abilities_class.lst:888). Its checked note record supplies the reviewed schedule as one Modifier: Will, untyped, floor((@classLevel.fighter + 2) / 4), shared Situation fear (+1 at 2nd to +5 at 18th). Existing reviewed CRB notice covers it.

## Outstanding mechanics

- None: the record's Modifier calculates the whole rule.

Calculations stay outstanding with their owners, never attribution holds.

## Source discrepancies

- PCGen's DESC reads "Will saves against fear effects"; the body and PRD read "Will saves against fear". Literal wording recorded, not resolved.

## Importer gaps

- Foundry `changeFlags` (`mediumArmorFullSpeed` on Armor Training, `heavyArmorFullSpeed` on Armor Training (Heavy Armor)) don't reach the imported entry at all, not even as an `unsupported` field. Neither #738 nor #739 covers it; recorded here. The speed rules are Notes and stay outstanding (#716).

## Cross-batch bindings and protected records

Each key's full-corpus content closure is the entry alone (`collectReferences` is empty). The only entry whose closure reaches any of the six keys is the Fighter class (`pf1/WLqBCT5DqmGAx8Wd`), which has no assessment yet (run B). So the new Notes and Bravery's Modifier change no other assessment's binding, and nothing is re-bound. Bravery's Note reaches S3's seam test through committed curation (`tests/catalog/release-scope-round-trip.ts`); `convex/catalogReleaseScope.integration.test.ts` was re-run and passes, unchanged.

## Binding

`currentBinding` and the assessment come from `buildAssessmentBinding` over the full-corpus `catalog:preview` of the final records. The batch test re-extracts the entry from the shared store, checks it equals the committed `tests/fixtures/class-abilities-<n>/preview.json` entry, re-binds it against the committed evidence and Registry, and runs the gate.

## Tests

[`class-abilities-636.test.ts`](../../tests/catalog/class-abilities-636.test.ts), with the run's shared checks in [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts): the inventory and launch-subset statement; the pinned body, checked records, PRD lines (against the capture manifest's hash) and PCGen rows from the shared store; a re-extraction and gate run with the binding re-built against current data; and the batch's own rows (`findCommittedBatchOwnershipProblems`). It also resolves Bravery through the public resolver at every level 1–20: a conditional +1 to +5 on Will under `fear`, outside the total until the Situation is selected, and nothing for another class's levels.

## Preservation and gates

The shared canonical files gain only this run's entries, additions only: 7 curation records (6 description records and Bravery's note record), 6 assessments and 6 evidence entries. No Registry, `held-notices.json` or `notice-clearances.json` change; no earlier row changed.

Run A adds one file to the shared store, the PRD capture's `pages/coreRulebook/classes/fighter.html`; the run report [classes-596.md](classes-596.md) carries the shared-store count.

| Command                                                                                                                                                                                                                          | Result                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `catalog:curate --candidates` (6 keys), then `--descriptions`                                                                                                                                                                    | 1 required draft (Bravery's note), 2 prose candidates; the other description records written by hand |
| `catalog:preview --candidates` (6 keys)                                                                                                                                                                                          | 0 admitted, 6 held (missing assessments), 0 failures before assessment                               |
| full `catalog:preview`                                                                                                                                                                                                           | 113 admitted, 23,185 held, 154 dependent omissions, 1,627 failures (base 108 / 23,190 / 154 / 1,628) |
| `pnpm catalog:notice-deps`                                                                                                                                                                                                       | 0 gaps, 0 waived, 0 stale; no warning on these keys                                                  |
| `pnpm catalog:format --check`                                                                                                                                                                                                    | canonical                                                                                            |
| `pnpm catalog:pin`                                                                                                                                                                                                               | `sha256:bbd31213…`, unchanged (the committed calculation identity)                                   |
| `pnpm -s typecheck`, `pnpm -s lint`, `pnpm -s check:initial-migration-writers`                                                                                                                                                   | pass                                                                                                 |
| the six batch tests                                                                                                                                                                                                              | pass                                                                                                 |
| guards: `cross-batch-bindings`, `notice-holds`, `pinned-sources`, `batch-ownership`, `batch-ownership-sweep`, `review-receipts`, `notice-clearances`, `notice-dependencies`, `data-files`, `prd-pin`, `ac-other-defense-bonuses` | pass                                                                                                 |
| `release.test.ts`, `feats348`–`feats355` integration fixtures, `launch-document`, `launch-inventory`, `convex/catalogReleaseScope.integration.test.ts`                                                                           | pass                                                                                                 |
| `catalog:launch-inventory --check`                                                                                                                                                                                               | pass after regeneration: `sha256:e5aaba32…`, 99,315 failures; see below                              |

**Launch inventory identity move.** The six inventories move the notice authority and the launch inventory, which are regenerated: identity `288ccd37…` → `e5aaba32…`, launch failures 99,298 → 99,315. [classes-596.md](classes-596.md) explains every moved row.

## #615 wave D: Inspire Courage and Bonus Feats (MAG)

This report belongs to #615 wave D (curation [#615](https://github.com/AndreasUnunger/EverythingPath/issues/615), increment parents wave D), which assesses nine class-feature parents across six batches so that their schedule increments admit with them: eight parents and 21 increments admitted, Mercy and its 5 increments held. The run report is [class-abilities-615.md](class-abilities-615.md). Reviewer: Opus (AI curator) for the owner, 2026-11-05. Sources: pf1 v11.11 (`418761d2`), pf1-content 11.4.0, the PRD capture `prd-2026-10-20` and PCGen `25523dbc`. No book PDFs; Archives of Nethys not used.

| Key                                      | Disposition | Assessment | Required notices | Increments | Evidence                               |
| ---------------------------------------- | ----------- | ---------- | ---------------- | ---------- | -------------------------------------- |
| `pf1/h56K6HEBOItImPPL` Inspire Courage   | admitted    | confirmed  | PZO1110          | 3          | `class-abilities-636-h56K6HEBOItImPPL` |
| `pf1/gzBR0qkMdu0KkLV0` Bonus Feats (MAG) | admitted    | confirmed  | PZO1117          | 2          | `class-abilities-636-gzBR0qkMdu0KkLV0` |

Its 3 increments (`everythingpath/bard-inspire-courage-11`, `everythingpath/bard-inspire-courage-17`, `everythingpath/bard-inspire-courage-5`) have no assessment of their own. Each has `attributionFrom: pf1/h56K6HEBOItImPPL`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Inspire Courage is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

### Inspire Courage (`pf1/h56K6HEBOItImPPL`)

- **Body:** [`packs/class-abilities/inspire-courage.h56K6HEBOItImPPL.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/inspire-courage.h56K6HEBOItImPPL.yaml) (sha256 `86157767187c…`); Core Rulebook p. 37.
- **PRD:** `coreRulebook/classes/bard.html:422`. Inspire Courage: 5 of the body's 7 sentences identical; the body reads "A 1st level bard" where the PRD reads "A 1st-level bard", and lower-cases the sixth sentence's "inspire courage". Same ability, same book.
- **PCGen:** `cr_abilities_class.lst:524`. Core Rulebook Bardic Performance ~ Inspire Courage row: DESC restates the rule in the second person, the bonus as InspireCourageCount = min((BardicPerformanceLVL+7)/6,4); SOURCEPAGE p.37.
- **Grant:** Granted at Bard level 1: Foundry classAssociations; PCGen cr_abilities_class.lst:505. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Inspire courage bonus by bard level = 1 + floor((level + 1) / 6): +1 at 1st, +2 at 5th, +3 at 11th, +4 at 17th (PRD bard.html:422 and Table: Bard :358-377); PCGen's InspireCourageCount min((BardicPerformanceLVL+7)/6,4) (cr_abilities_class.lst:524) agrees. Per level: 1: 1, 2: 1, 3: 1, 4: 1, 5: 2, 6: 2, 7: 2, 8: 2, 9: 2, 10: 2, 11: 3, 12: 3, 13: 3, 14: 3, 15: 3, 16: 3, 17: 4, 18: 4, 19: 4, 20: 4.
- **Increment names:** each checked against its class table row: `bard-inspire-courage-5` "Inspire Courage +2" (`bard.html:362`, "inspire courage +2, lore master 1/day"); `bard-inspire-courage-11` "Inspire Courage +3" (`bard.html:368`, "Inspire competence +4, inspire courage +3, lore master 2/day"); `bard-inspire-courage-17` "Inspire Courage +4" (`bard.html:374`, "inspire courage +4, lore master 3/day").
- **Record:** `description` on `description` (`31842a8f…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, so the imported entry stays identical to the base import and the assessed closures that reach it (`pf1/3p34GJemfcLdKckV`, buffs-547) keep their bindings; other batches' committed fixtures that may hold the body keep theirs.
- **Notices:** PZO1110, each reviewed with no notice hold in force. PZO1110: Core Rulebook class feature Inspire Courage and the rules it applies (granted by Bard).
- **Outstanding calculations** (never holds):
  - The allies' morale bonus on saves against charm and fear and competence bonus on attack and weapon damage rolls, +1 at 1st to +4 at 17th, and the bardic performance rounds it spends — owner #636. The bonus is a performance's, not a standing Modifier, and bardic performance has no resource on the sheet; the description states the rule.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #636. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset).
- **Source discrepancies** (recorded, not resolved):
  - The body reads "A 1st level bard" where the PRD capture (bard.html:422) reads "A 1st-level bard", and lower-cases "inspire courage can use audible or visual components". Same ability, same book; recorded as a printing difference, not resolved; the text stays verbatim.
  - "Charm and fear effects" are effect descriptors every book uses, not a named spell; no notice beyond PZO1110.
- **Binding:** content `8eadb053a2e5…`, from `buildAssessmentBinding` over the full-corpus preview. The parent's closure is the entry alone.

Its 2 increments (`everythingpath/magus-bonus-feats-11`, `everythingpath/magus-bonus-feats-17`) have no assessment of their own. Each has `attributionFrom: pf1/gzBR0qkMdu0KkLV0`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Bonus Feats (MAG) is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

### Bonus Feats (MAG) (`pf1/gzBR0qkMdu0KkLV0`)

- **Body:** [`packs/class-abilities/bonus-feats-mag.gzBR0qkMdu0KkLV0.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/bonus-feats-mag.gzBR0qkMdu0KkLV0.yaml) (sha256 `a867ed8184d9…`); Ultimate Magic p. 15. The pinned record imports no sources (`sources: []`); the assessment cites the book from the PRD and PCGen.
- **PRD:** `ultimateMagic/spellcasters/magus.html:424`. Bonus Feats (magus): identical to the body after the heading.
- **PCGen:** `um_abilities_class.lst:61`. Ultimate Magic Magus ~ Bonus Feats row: DESC reproduces the paragraph word for word (BONUS:ABILITYPOOL|Magus Bonus Feat|(MagusLVL+1)/6); SOURCEPAGE p.15.
- **Grant:** Granted at Magus level 5: Foundry classAssociations; PCGen um_abilities_globalvar.lst:16. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Magus bonus feats by magus level = floor((level + 1) / 6): one at 5th, 11th and 17th (PRD ultimateMagic/spellcasters/magus.html:424 and Table: Magus :367-386); PCGen's pool (MagusLVL+1)/6 (um_abilities_class.lst:61) and Foundry's bonusFeats change floor((@class.level + 1) / 6) agree. Per level: 1: 0, 2: 0, 3: 0, 4: 0, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 2, 12: 2, 13: 2, 14: 2, 15: 2, 16: 2, 17: 3, 18: 3, 19: 3, 20: 3.
- **Increment names:** each checked against its class table row: `magus-bonus-feats-11` "Bonus Feat" (`magus.html:377`, "Bonus Feat, Improved Spell Recall"); `magus-bonus-feats-17` "Bonus Feat" (`magus.html:383`, "Bonus Feat").
- **Record:** `description` on `description` (`3d9de6e6…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, so the imported entry stays identical to the base import; other batches' committed fixtures that may hold the body keep theirs.
- **Notices:** PZO1117, each reviewed with no notice hold in force. PZO1117: Ultimate Magic class feature Bonus Feats (MAG) and the rules it applies (granted by Magus).
- **Outstanding calculations** (never holds):
  - The magus's bonus combat, item creation or metamagic feats, floor((magus level + 1) / 6) (Foundry change on bonusFeats, imported unsupported) — owner #636. Unmapped target: Foundry's bonusFeats change imports as an unsupported `changes` row and adds no feat slot; the description states the rule.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #636. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset).
- **Source discrepancies** (recorded, not resolved):
  - Foundry's pinned record imports no sources (system.sources absent; the import's sources: []); the assessment cites the Ultimate Magic, p. 15 (PCGen SOURCEPAGE:p.15), from the PRD and PCGen. Importer gap: reported, not fixed.
  - "Combat, item creation, or metamagic feats" are feat categories every book uses, not named rules; no notice beyond PZO1117.
- **Binding:** content `2bcaac6702ce…`, from `buildAssessmentBinding` over the full-corpus preview. The parent's closure is the entry alone.

### Tests

[`class-abilities-636.test.ts`](../../tests/catalog/class-abilities-636.test.ts) adds a `describeIncrementParent` block for each new row. The batch test uses the shared checks in [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts) (`describeIncrementParent`; `describeLaunchFeature` for the held Mercy): the inventory and launch-subset statement; the pinned body, checked record, PRD lines, PCGen rows, Foundry associations and each increment's name against its class table from the shared store; a re-extraction with committed curation, the binding re-built, and the gate admitting an admitted parent with exactly its increments (an edited body admits neither), or holding a held one with its increments; and the batch's own rows. Their preview is [`tests/fixtures/class-abilities-636/binding-preview.json`](../../tests/fixtures/class-abilities-636/binding-preview.json); the run's `preview.json` is unchanged. The inventory keeps its earlier row, reviewer and date; the new rows record their own (`reviewedBy`, `reviewedOn`).
