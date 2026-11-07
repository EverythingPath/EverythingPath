# Class abilities #622: Armor Mastery (MVP launch subset, #596 run A; Ki powers (UC), #631 wave A)

MVP launch subset of #622: this inventory curates only pf1/NwTe1Q2utlsmOAqK (Armor Mastery) and pf1/NsP31IshAuY4gv0s (Ki powers (UC)); the ticket's other 98 keys stay remaining acceptance under #622. The 98 remaining keys are listed in the inventory's `launchSubset.remainingAcceptance` ([`class-abilities-622.json`](../../scripts/catalog/legal/class-abilities-622.json)) and stay this ticket's acceptance.

| Key                                  | Disposition | Assessment | Required notices | Evidence                               |
| ------------------------------------ | ----------- | ---------- | ---------------- | -------------------------------------- |
| `pf1/NwTe1Q2utlsmOAqK` Armor Mastery | admitted    | confirmed  | PZO1110          | `class-abilities-622-NwTe1Q2utlsmOAqK` |

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

- **Body:** [`packs/class-abilities/armor-mastery.NwTe1Q2utlsmOAqK.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/armor-mastery.NwTe1Q2utlsmOAqK.yaml) (sha256 `4d11a8254a7c…`), Core Rulebook p. 56.
- **PRD:** `fighter.html:403`. Armor Mastery (Ex), identical to the body after its heading but for "DR" where the body spells out "damage reduction".
- **PCGen:** `cr_abilities_class.lst:891`. Core Rulebook Fighter ~ Armor Mastery row (SOURCEPAGE p.56): DESC "DR 5/-- whenever you are wearing armor or using a shield", DR:5/- with PREEQUIP armor or shield.
- **Grant:** Granted at Fighter level 19: PCGen ABILITY at Fighter_CFP_Level 19 (:261); PRD table "Armor mastery" at 19th. Foundry associates it with no class level (the Fighter's classAssociations stop at 7 and 20); S3 attaches it at 19 through the reviewed schedule. PCGen `:261`.
- **Schedule through level 20:** DR 5/— while wearing armor or using a shield, from 19th level. Per level: 1: no, 2: no, 3: no, 4: no, 5: no, 6: no, 7: no, 8: no, 9: no, 10: no, 11: no, 12: no, 13: no, 14: no, 15: no, 16: no, 17: no, 18: no, 19: yes, 20: yes.

## Records

- `description` on `description` (`8151f6b9…`), checked: Note: "At 19th level, a fighter gains damage reduction 5/— whenever he is wearing armor or using a shield.".

The prose pass found no prose candidate in this body; its description record is written and checked by hand, as every key needs one.

## Attribution

Complete CRB class feature (p. 56) compared with the PRD capture (coreRulebook/classes/fighter.html:403, the same rule, "DR" spelled out) and PCGen's Core Rulebook row (cr_abilities_class.lst:891). PCGen and the PRD table grant it at 19th level; Foundry associates it with no level, and S3 attaches it at 19. The Note states the rule; DR 5/— stays an outstanding calculation (#716). Existing reviewed CRB notice covers it.

## Outstanding mechanics

- DR 5/— while wearing armor or using a shield — owner #716. The sheet has no damage reduction statistic; the record carries a Note.
- Attachment at Fighter level 19 — owner S3 (#596 run B; class release path). Foundry's class associations omit it; the reviewed schedule places it at 19 through release-path code, outside this run.

Calculations stay outstanding with their owners, never attribution holds.

## Source discrepancies

- PRD reads "DR 5/—"; the body spells out "damage reduction 5/—". Same rule; literal wording recorded.

## Importer gaps

- Foundry `changeFlags` (`mediumArmorFullSpeed` on Armor Training, `heavyArmorFullSpeed` on Armor Training (Heavy Armor)) don't reach the imported entry at all, not even as an `unsupported` field. Neither #738 nor #739 covers it; recorded here. The speed rules are Notes and stay outstanding (#716).

## Cross-batch bindings and protected records

Each key's full-corpus content closure is the entry alone (`collectReferences` is empty). The only entry whose closure reaches any of the six keys is the Fighter class (`pf1/WLqBCT5DqmGAx8Wd`), which has no assessment yet (run B). So the new Notes and Bravery's Modifier change no other assessment's binding, and nothing is re-bound. Bravery's Note reaches S3's seam test through committed curation (`tests/catalog/release-scope-round-trip.ts`); `convex/catalogReleaseScope.integration.test.ts` was re-run and passes, unchanged.

## Binding

`currentBinding` and the assessment come from `buildAssessmentBinding` over the full-corpus `catalog:preview` of the final records. The batch test re-extracts the entry from the shared store, checks it equals the committed `tests/fixtures/class-abilities-<n>/preview.json` entry, re-binds it against the committed evidence and Registry, and runs the gate.

## Tests

[`class-abilities-622.test.ts`](../../tests/catalog/class-abilities-622.test.ts), with the run's shared checks in [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts): the inventory and launch-subset statement; the pinned body, checked records, PRD lines (against the capture manifest's hash) and PCGen rows from the shared store; a re-extraction and gate run with the binding re-built against current data; and the batch's own rows (`findCommittedBatchOwnershipProblems`).

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

## #631 wave A: Ki powers (UC)

This report belongs to #631 wave A (curation [#631](https://github.com/AndreasUnunger/EverythingPath/issues/631), increment parents wave A), which assesses ten class-feature parents across eight batches so that their 87 schedule increments admit with them. The run report is [class-abilities-631.md](class-abilities-631.md). Reviewer: Opus (AI curator) for the owner, 2026-11-04. Sources: pf1 v11.11 (`418761d2`), the PRD capture `prd-2026-10-20` and PCGen `25523dbc`. No book PDFs; Archives of Nethys not used.

| Key                                   | Disposition | Assessment | Required notices | Increments | Evidence                               |
| ------------------------------------- | ----------- | ---------- | ---------------- | ---------- | -------------------------------------- |
| `pf1/NsP31IshAuY4gv0s` Ki powers (UC) | admitted    | confirmed  | PZO1131          | 8          | `class-abilities-622-NsP31IshAuY4gv0s` |

Its 8 increments (`everythingpath/unchained-monk-ki-powers-10`, `everythingpath/unchained-monk-ki-powers-12`, `everythingpath/unchained-monk-ki-powers-14`, `everythingpath/unchained-monk-ki-powers-16`, `everythingpath/unchained-monk-ki-powers-18`, `everythingpath/unchained-monk-ki-powers-20`, `everythingpath/unchained-monk-ki-powers-6`, `everythingpath/unchained-monk-ki-powers-8`) have no assessment of their own. Each has `attributionFrom: pf1/NsP31IshAuY4gv0s`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Ki powers (UC) is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

### Ki powers (UC) (`pf1/NsP31IshAuY4gv0s`)

- **Body:** [`packs/class-abilities/ki-powers-uc.NsP31IshAuY4gv0s.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/ki-powers-uc.NsP31IshAuY4gv0s.yaml) (sha256 `929f54b3c335…`); Pathfinder Unchained p. 16.
- **PRD:** `unchained/classes/monk.html:445`. Ki Powers (Pathfinder Unchained): both paragraphs identical to the body after the heading.
- **PCGen:** `pu_abilities_class.lst:468`. Pathfinder Unchained Unchained Monk ~ Ki Powers row: DESC reproduces both paragraphs.
- **Grant:** Granted at Monk (Unchained) level 4: Foundry classAssociations; PCGen pu_abilities_class.lst:163. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Ki powers by unchained monk level = floor((level - 2) / 2) from 4th: one at 4th and every even level, 9 at 20th (PRD unchained/classes/monk.html:445 and Table 1-2 :375-394). Per level: 1: 0, 2: 0, 3: 0, 4: 1, 5: 1, 6: 2, 7: 2, 8: 3, 9: 3, 10: 4, 11: 4, 12: 5, 13: 5, 14: 6, 15: 6, 16: 7, 17: 7, 18: 8, 19: 8, 20: 9.
- **Increment names:** each checked against its class table row: `unchained-monk-ki-powers-6` "Ki Power (UC)" (`monk.html:380`, "Bonus feat, ki power"); `unchained-monk-ki-powers-8` "Ki Power (UC)" (`monk.html:382`, "Ki power"); `unchained-monk-ki-powers-10` "Ki Power (UC)" (`monk.html:384`, "Bonus feat, ki power, ki strike (lawful)"); and the other 5 likewise.
- **Record:** `description` on `description` (`94271a5c…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, because the body sits in other batches' committed fixtures (the protected and binding contexts of spells-530 to -536 and feats-350 to -355, among others); a Note would change the entry they hold. The imported entry is identical to the base import.
- **Notices:** PZO1131, each reviewed with no hold in force. PZO1131: Pathfinder Unchained class feature Ki powers (UC) and the rules it applies (granted by Monk (Unchained)).
- **Outstanding calculations** (never holds):
  - Ki power picks at 4th and every even level, and their level minimums — owner #622. The schedule's increments carry no ki power choice; the description states the rule.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #622. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset).
- **Source discrepancies** (recorded, not resolved):
  - Foundry names the body "Ki powers (UC)"; the PRD and PCGen name it "Ki Powers". Recorded, not resolved.
- **Binding:** content `fabe8b7ff912…`, from `buildAssessmentBinding` over the full-corpus preview of the final records. The parent's closure is the entry alone.

### Tests

[`class-abilities-622.test.ts`](../../tests/catalog/class-abilities-622.test.ts) adds a `describeIncrementParent` block for the new row. The batch test uses the shared checks in [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts), generalised in this run (`describeIncrementParent`): the inventory and launch-subset statement; the pinned body, checked record, PRD lines, PCGen rows, Foundry associations and each increment's name against its class table from the shared store; a re-extraction with committed curation, the binding re-built, and the gate admitting the parent with exactly its increments (an edited body admits neither); and the batch's own rows. Its preview is [`tests/fixtures/class-abilities-622/binding-preview.json`](../../tests/fixtures/class-abilities-622/binding-preview.json); the run's `preview.json` is unchanged. The inventory keeps its earlier row, reviewer and date; the new row records its own (`reviewedBy`, `reviewedOn`).
