# Class abilities #637: Armor Training (Heavy Armor) (MVP launch subset, #596 run A; Rogue Talents, #617 wave B)

MVP launch subset of #637: this inventory curates only pf1/iqeyCQIIVnNt0p3h (Armor Training (Heavy Armor)) and pf1/iBTrvPtn3jczInbn (Rogue Talents); the ticket's other 98 keys stay remaining acceptance under #637. The 98 remaining keys are listed in the inventory's `launchSubset.remainingAcceptance` ([`class-abilities-637.json`](../../scripts/catalog/legal/class-abilities-637.json)) and stay this ticket's acceptance.

| Key                                                 | Disposition | Assessment | Required notices | Evidence                               |
| --------------------------------------------------- | ----------- | ---------- | ---------------- | -------------------------------------- |
| `pf1/iqeyCQIIVnNt0p3h` Armor Training (Heavy Armor) | admitted    | confirmed  | PZO1110          | `class-abilities-637-iqeyCQIIVnNt0p3h` |

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

- **Body:** [`packs/class-abilities/armor-training-heavy-armor.iqeyCQIIVnNt0p3h.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/armor-training-heavy-armor.iqeyCQIIVnNt0p3h.yaml) (sha256 `398e8b795a86…`), Core Rulebook p. 56.
- **PRD:** `fighter.html:384`. The second sentence of :384, "At 7th level, a fighter can move at his normal speed while wearing heavy armor.", identical to the body.
- **PCGen:** `cr_abilities_class.lst:895`. Core Rulebook Armor Training ~ Heavy Armor row: UNENCUMBEREDMOVE:HeavyArmor, chosen from the Armor Training Choice pool at ArmorTrainingLVL 7 (:890); it has no DESC.
- **Grant:** Granted at Fighter level 7: Foundry classAssociations level 7; PCGen through the Armor Training row's choice pool at ArmorTrainingLVL 7 (:890); PRD :384 "At 7th level". PCGen `:890`; Foundry `classes/fighter.WLqBCT5DqmGAx8Wd.yaml:50-51`.
- **Schedule through level 20:** Normal speed in heavy armor from 7th level on. Per level: 1: no, 2: no, 3: no, 4: no, 5: no, 6: no, 7: yes, 8: yes, 9: yes, 10: yes, 11: yes, 12: yes, 13: yes, 14: yes, 15: yes, 16: yes, 17: yes, 18: yes, 19: yes, 20: yes.

## Records

- `description` on `description` (`5a7ecf2b…`), checked: Note: "At 7th level, a fighter can move at his normal speed while wearing heavy armor.".

The prose pass found no prose candidate in this body; its description record is written and checked by hand, as every key needs one.

## Attribution

Complete CRB class feature (p. 56) compared with the PRD capture (coreRulebook/classes/fighter.html:384, its second sentence, identical) and PCGen's Core Rulebook row (cr_abilities_class.lst:895, UNENCUMBEREDMOVE:HeavyArmor). Granted at 7th level by the Fighter's class associations. The Note states the rule; heavy-armor speed stays an outstanding calculation (#716). Existing reviewed CRB notice covers it.

## Outstanding mechanics

- Normal speed in heavy armor (Foundry changeFlags.heavyArmorFullSpeed) — owner #716. Speed is not a sheet statistic; the record carries a Note.

Calculations stay outstanding with their owners, never attribution holds.

## Source discrepancies

- PCGen grants it from a choice pool (Armor Training Choice) rather than automatically; the body, PRD and Foundry's level-7 association grant it automatically to the core fighter. The pool is the later books' advanced armor training hook. Recorded, not resolved.

## Importer gaps

- Foundry `changeFlags` (`mediumArmorFullSpeed` on Armor Training, `heavyArmorFullSpeed` on Armor Training (Heavy Armor)) don't reach the imported entry at all, not even as an `unsupported` field. Neither #738 nor #739 covers it; recorded here. The speed rules are Notes and stay outstanding (#716).

## Cross-batch bindings and protected records

Each key's full-corpus content closure is the entry alone (`collectReferences` is empty). The only entry whose closure reaches any of the six keys is the Fighter class (`pf1/WLqBCT5DqmGAx8Wd`), which has no assessment yet (run B). So the new Notes and Bravery's Modifier change no other assessment's binding, and nothing is re-bound. Bravery's Note reaches S3's seam test through committed curation (`tests/catalog/release-scope-round-trip.ts`); `convex/catalogReleaseScope.integration.test.ts` was re-run and passes, unchanged.

## Binding

`currentBinding` and the assessment come from `buildAssessmentBinding` over the full-corpus `catalog:preview` of the final records. The batch test re-extracts the entry from the shared store, checks it equals the committed `tests/fixtures/class-abilities-<n>/preview.json` entry, re-binds it against the committed evidence and Registry, and runs the gate.

## Tests

[`class-abilities-637.test.ts`](../../tests/catalog/class-abilities-637.test.ts), with the run's shared checks in [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts): the inventory and launch-subset statement; the pinned body, checked records, PRD lines (against the capture manifest's hash) and PCGen rows from the shared store; a re-extraction and gate run with the binding re-built against current data; and the batch's own rows (`findCommittedBatchOwnershipProblems`).

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

## #617 wave B: Rogue Talents

This report belongs to #617 wave B (curation [#617](https://github.com/AndreasUnunger/EverythingPath/issues/617), increment parents wave B), which assesses eleven class-feature parents across five batches so that their 76 schedule increments admit with them. The run report is [class-abilities-617.md](class-abilities-617.md). Reviewer: Opus (AI curator) for the owner, 2026-11-04. Sources: pf1 v11.11 (`418761d2`), the PRD capture `prd-2026-10-20` and PCGen `25523dbc`. No book PDFs; Archives of Nethys not used.

| Key                                  | Disposition | Assessment | Required notices          | Increments | Evidence                               |
| ------------------------------------ | ----------- | ---------- | ------------------------- | ---------- | -------------------------------------- |
| `pf1/iBTrvPtn3jczInbn` Rogue Talents | admitted    | confirmed  | PZO1110, PZO1118, PZO1131 | 18         | `class-abilities-637-iBTrvPtn3jczInbn` |

Its 18 increments (`everythingpath/rogue-rogue-talents-10`, `everythingpath/rogue-rogue-talents-12`, `everythingpath/rogue-rogue-talents-14`, `everythingpath/rogue-rogue-talents-16`, `everythingpath/rogue-rogue-talents-18`, `everythingpath/rogue-rogue-talents-20`, `everythingpath/rogue-rogue-talents-4`, `everythingpath/rogue-rogue-talents-6`, `everythingpath/rogue-rogue-talents-8`, `everythingpath/unchained-rogue-talent-10`, `everythingpath/unchained-rogue-talent-12`, `everythingpath/unchained-rogue-talent-14`, `everythingpath/unchained-rogue-talent-16`, `everythingpath/unchained-rogue-talent-18`, `everythingpath/unchained-rogue-talent-20`, `everythingpath/unchained-rogue-talent-4`, `everythingpath/unchained-rogue-talent-6`, `everythingpath/unchained-rogue-talent-8`) have no assessment of their own. Each has `attributionFrom: pf1/iBTrvPtn3jczInbn`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Rogue Talents is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

### Rogue Talents (`pf1/iBTrvPtn3jczInbn`)

- **Body:** [`packs/class-abilities/rogue-talents.iBTrvPtn3jczInbn.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/rogue-talents.iBTrvPtn3jczInbn.yaml) (sha256 `2c510c537064…`); Core Rulebook p. 68-69, Pathfinder Unchained p. 20-24.
- **PRD:** `coreRulebook/classes/rogue.html:389,390`. Rogue Talents (CRB): the body's first two paragraphs are identical after the heading; its third is the Ultimate Combat ninja-trick sentence.
- **PRD:** `unchained/classes/rogue.html:414,415`. Rogue Talents (Pathfinder Unchained): the same two paragraphs; the PRD has a comma before "and the decision".
- **PRD:** `ultimateCombat/classArchetypes/rogue.html:372`. Ninja Trick rogue talent (Ultimate Combat): "The rogue cannot choose a ninja trick with the same name as a rogue talent", which the body's third paragraph restates with "A rogue".
- **PCGen:** `cr_abilities_class.lst:200`. Core Rulebook grant row Rogue ~ Rogue Talents at Rogue_CFP_Level 2; the Rogue ~ Rogue Talents ability row (:1616) is internal and carries no DESC.
- **PCGen:** `cr_abilities_class.lst:1616`. Core Rulebook Rogue ~ Rogue Talents internal row: BONUS:ABILITYPOOL|Rogue Talent|RogueTalentLVL/2 (no DESC).
- **PCGen:** `pu_abilities_class.lst:224`. Pathfinder Unchained grant row Unchained Rogue ~ Rogue Talents at Rogue_CFP_Level 2.
- **PCGen:** `pu_abilities_class.lst:587`. Pathfinder Unchained Unchained Rogue ~ Rogue Talents internal row: BONUS:ABILITYPOOL|Unchained Rogue Talent|RogueTalentLVL/2 (no DESC).
- **PCGen:** `uc_abilities_class.lst:1607`. Ultimate Combat Rogue Talent ~ Ninja Trick row: the talent whose rule the body's third paragraph restates.
- **Grant:** Granted at Rogue level 2, Rogue (Unchained) level 2: Foundry class records; PCGen cr_abilities_class.lst:200, pu_abilities_class.lst:224. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Rogue talents by rogue level = floor(level / 2): one at 2nd and every even level, 10 at 20th, for the Rogue and the Unchained Rogue (PRD rogue.html:389 and Table: Rogue :358-377; PU rogue.html:414 and Table 1-6 :373-392; PCGen RogueTalentLVL/2). Per level: 1: 0, 2: 1, 3: 1, 4: 2, 5: 2, 6: 3, 7: 3, 8: 4, 9: 4, 10: 5, 11: 5, 12: 6, 13: 6, 14: 7, 15: 7, 16: 8, 17: 8, 18: 9, 19: 9, 20: 10.
- **Increment names:** each checked against its class table row: `rogue-rogue-talents-4` "Rogue Talent" (`rogue.html:361`, "Rogue talent, uncanny dodge"); `rogue-rogue-talents-6` "Rogue Talent" (`rogue.html:363`, "Rogue talent, trap sense +2"); `rogue-rogue-talents-8` "Rogue Talent" (`rogue.html:365`, "Improved uncanny dodge, rogue talent"); and the other 15 likewise.
- **Record:** `description` on `description` (`a9682421…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, because the body sits in other batches' committed fixtures (the protected and binding contexts of spells-530 to -536 and feats-350 to -355, among others); a Note would change the entry they hold. The imported entry is identical to the base import.
- **Notices:** PZO1110, PZO1118, PZO1131, each reviewed with no hold in force. PZO1110: Core Rulebook class feature Rogue Talents and the rules it applies (granted by Rogue, Rogue (Unchained)). PZO1118: Ninja tricks and the rule that a rogue cannot choose one with a rogue talent's name (Ultimate Combat Ninja Trick rogue talent). PZO1131: Pathfinder Unchained class feature Rogue Talents and the rules it applies (granted by Rogue, Rogue (Unchained)).
- **Outstanding calculations** (never holds):
  - Rogue talent picks at 2nd and every even level, the sneak attack talents' one-per-attack rule and the ninja-trick name rule — owner #637. The schedule's increments carry no talent choice; the description states the rule.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #637. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset and wave A).
- **Source discrepancies** (recorded, not resolved):
  - The body's third paragraph, "A rogue cannot choose a ninja trick with the same name as a rogue talent.", is the Ultimate Combat Ninja Trick talent's rule (ultimateCombat/classArchetypes/rogue.html:372), not in either Rogue Talents section. Recorded, not resolved; PZO1118 is required as an inherited notice.
  - Foundry imports only the Core Rulebook (pp. 68-69); the body is also the Unchained Rogue's (rogue-unchained.5tsZI6zk29yX1ckA.yaml), so PZO1131 is required.
- **Binding:** content `9085ee537402…`, from `buildAssessmentBinding` over the full-corpus preview of the final records. The parent's closure is the entry alone.

### Tests

[`class-abilities-637.test.ts`](../../tests/catalog/class-abilities-637.test.ts) adds a `describeIncrementParent` block for the new row. The batch test uses the shared checks in [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts) (`describeIncrementParent`, from wave A): the inventory and launch-subset statement; the pinned body, checked record, PRD lines, PCGen rows, Foundry class records and each increment's name against its class table from the shared store; a re-extraction with committed curation, the binding re-built, and the gate admitting the parent with exactly its increments (an edited body admits neither); and the batch's own rows. Its preview is [`tests/fixtures/class-abilities-637/binding-preview.json`](../../tests/fixtures/class-abilities-637/binding-preview.json); run A's `preview.json` is unchanged. The inventory keeps its earlier row, reviewer and date; the new row records its own (`reviewedBy`, `reviewedOn`).
