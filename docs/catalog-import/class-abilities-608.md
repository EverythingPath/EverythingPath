# Class abilities #608: Armor Training (MVP launch subset, #596 run A)

MVP launch subset of #608: this inventory curates only pf1/5JFfSqLMCpbRmERa (Armor Training); the ticket's other 99 keys stay remaining acceptance under #608. The 99 remaining keys are listed in the inventory's `launchSubset.remainingAcceptance` ([`class-abilities-608.json`](../../scripts/catalog/legal/class-abilities-608.json)) and stay this ticket's acceptance.

| Key                                   | Disposition | Assessment | Required notices | Evidence                               |
| ------------------------------------- | ----------- | ---------- | ---------------- | -------------------------------------- |
| `pf1/5JFfSqLMCpbRmERa` Armor Training | admitted    | confirmed  | PZO1110          | `class-abilities-608-5JFfSqLMCpbRmERa` |

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

- **Body:** [`packs/class-abilities/armor-training.5JFfSqLMCpbRmERa.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/armor-training.5JFfSqLMCpbRmERa.yaml) (sha256 `e734c4e964a3…`), Core Rulebook p. 55-56.
- **PRD:** `fighter.html:383-384`. Armor Training (Ex) and the medium-armor sentence of :384, identical to the body; :384's heavy-armor sentence is Armor Training (Heavy Armor).
- **PCGen:** `cr_abilities_class.lst:890`. Core Rulebook Fighter ~ Armor Training row (SOURCEPAGE p.55): ACCHECK and MAXDEX by tier min((ArmorTrainingLVL+1)/4,4) while wearing armor, UNENCUMBEREDMOVE:MediumArmor.
- **Grant:** Granted at Fighter level 3: PCGen ABILITY at Fighter_CFP_Level 3 (:259), ArmorTrainingLVL = FighterLVL from 3rd (:254); Foundry classAssociations level 3; PRD table "Armor training 1-4" at 3rd, 7th, 11th and 15th. PCGen `:254`, `:259`; Foundry `classes/fighter.WLqBCT5DqmGAx8Wd.yaml:46-47`.
- **Schedule through level 20:** Armor check penalty reduction and maximum Dexterity increase = min(floor((fighter level + 1) / 4), 4) from 3rd level: 1 at 3rd, 2 at 7th, 3 at 11th, 4 at 15th and up (PRD table :358-370; Foundry changes clamp(floor((@class.level + 1) / 4), 0, 4); PCGen min((ArmorTrainingLVL+1)/4,4)). Per level: 1: 0, 2: 0, 3: 1, 4: 1, 5: 1, 6: 1, 7: 2, 8: 2, 9: 2, 10: 2, 11: 3, 12: 3, 13: 3, 14: 3, 15: 4, 16: 4, 17: 4, 18: 4, 19: 4, 20: 4.

## Records

- `description` on `description` (`10a6ba0f…`), checked: Note: "Starting at 3rd level, a fighter learns to be more maneuverable while wearing armor. Whenever he is wearing armor, he re…"; Note: "In addition, a fighter can also move at his normal speed while wearing medium armor.".

The prose pass found no prose candidate in this body; its description record is written and checked by hand, as every key needs one.

## Attribution

Complete CRB class feature (pp. 55-56) compared with the PRD capture (coreRulebook/classes/fighter.html:383 and the first sentence of :384, identical after the heading) and PCGen's Core Rulebook row (cr_abilities_class.lst:890). The schedule (1 at 3rd to 4 at 15th) matches the PRD table, the imported Foundry formulas and PCGen. Notes state the rule; its armor check penalty, maximum Dexterity and speed effects stay outstanding calculations (#716). Existing reviewed CRB notice covers it.

## Outstanding mechanics

- Armor check penalty reduction by tier while wearing armor (Foundry change target acpA, imported unsupported) — owner #716. No armor check penalty Modifier target in the closed list; the penalty comes only from the equipped item (docs/character-sheet/modifiers.md, weapons-and-armor.md).
- Maximum Dexterity bonus increase by tier while wearing armor (Foundry change target mDexA, imported unsupported) — owner #716. No maximum Dexterity Modifier target; the limit comes only from the equipped item.
- Normal speed in medium armor (Foundry changeFlags.mediumArmorFullSpeed) — owner #716. Speed is not a sheet statistic; the record carries a Note.

Calculations stay outstanding with their owners, never attribution holds.

## Source discrepancies

- PCGen's row adds BONUS:ABILITYPOOL|Armor Training Choice|1 at ArmorTrainingLVL 7, the hook for later books' advanced armor training options; the body and PRD give only heavy-armor speed at 7th (Armor Training (Heavy Armor)). Recorded, not resolved; no later-book option is in this body.

## Importer gaps

- Foundry `changeFlags` (`mediumArmorFullSpeed` on Armor Training, `heavyArmorFullSpeed` on Armor Training (Heavy Armor)) don't reach the imported entry at all, not even as an `unsupported` field. Neither #738 nor #739 covers it; recorded here. The speed rules are Notes and stay outstanding (#716).

## Cross-batch bindings and protected records

Each key's full-corpus content closure is the entry alone (`collectReferences` is empty). The only entry whose closure reaches any of the six keys is the Fighter class (`pf1/WLqBCT5DqmGAx8Wd`), which has no assessment yet (run B). So the new Notes and Bravery's Modifier change no other assessment's binding, and nothing is re-bound. Bravery's Note reaches S3's seam test through committed curation (`tests/catalog/release-scope-round-trip.ts`); `convex/catalogReleaseScope.integration.test.ts` was re-run and passes, unchanged.

## Binding

`currentBinding` and the assessment come from `buildAssessmentBinding` over the full-corpus `catalog:preview` of the final records. The batch test re-extracts the entry from the shared store, checks it equals the committed `tests/fixtures/class-abilities-<n>/preview.json` entry, re-binds it against the committed evidence and Registry, and runs the gate.

## Tests

[`class-abilities-608.test.ts`](../../tests/catalog/class-abilities-608.test.ts), with the run's shared checks in [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts): the inventory and launch-subset statement; the pinned body, checked records, PRD lines (against the capture manifest's hash) and PCGen rows from the shared store; a re-extraction and gate run with the binding re-built against current data; and the batch's own rows (`findCommittedBatchOwnershipProblems`).

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
