# Class abilities #625: Weapon Training (MVP launch subset, #596 run A)

MVP launch subset of #625: this inventory curates only pf1/RzEzudurxQFirFoF (Weapon Training); the ticket's other 99 keys stay remaining acceptance under #625. The 99 remaining keys are listed in the inventory's `launchSubset.remainingAcceptance` ([`class-abilities-625.json`](../../scripts/catalog/legal/class-abilities-625.json)) and stay this ticket's acceptance.

| Key                                    | Disposition | Assessment | Required notices                                                                                  | Evidence                               |
| -------------------------------------- | ----------- | ---------- | ------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `pf1/RzEzudurxQFirFoF` Weapon Training | held        | unresolved | PZO1110, PZO1118, PZO1123, PZO1140, PZO9226, PZO9422, PZO9455, PZO9410, PZO9481, PZO9491, PZO9493 | `class-abilities-625-RzEzudurxQFirFoF` |

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

- **Body:** [`packs/class-abilities/weapon-training.RzEzudurxQFirFoF.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/weapon-training.RzEzudurxQFirFoF.yaml) (sha256 `8b5e72aee8a1…`), Core Rulebook p. 56.
- **PRD:** `fighter.html:385-402`. Weapon Training (Ex): the three rules paragraphs match the body's first three apart from "9th\*" and "his group"; the PRD's fourteen CRB group lists (:389-402) are a strict subset of the body's seventeen.
- **PCGen:** `cr_abilities_class.lst:931`. Core Rulebook Fighter ~ Weapon Training row: DESC per chosen group; the CRB groups only. Foundry's added groups and weapons are not in it.
- **Grant:** Granted at Fighter level 5: PCGen ABILITY at Fighter_CFP_Level 5 (:260), FighterWeaponTrainingLVL = FighterLVL from 5th (:255), later groups at 9, 13 and 17 (:922-925); Foundry classAssociations level 5; PRD table "Weapon training 1-4". PCGen `:255`, `:260`; Foundry `classes/fighter.WLqBCT5DqmGAx8Wd.yaml:48-49`.
- **Schedule through level 20:** Groups chosen at 5th, 9th, 13th and 17th; the first group's bonus = floor((fighter level - 1) / 4): +1 at 5th to +4 at 17th; each later group starts at +1 and rises with it (PRD :386). Per level: 1: 0, 2: 0, 3: 0, 4: 0, 5: 1, 6: 1, 7: 1, 8: 1, 9: 2, 10: 2, 11: 2, 12: 2, 13: 3, 14: 3, 15: 3, 16: 3, 17: 4, 18: 4, 19: 4, 20: 4.

## Records

- `description` on `description` (`6c9fb930…`), checked: Note: "Starting at 5th level, a fighter can select one group of weapons, as noted below. Whenever he attacks with a weapon from…"; Note: "Every four levels thereafter (9th\*, 13th, and 17th), a fighter becomes further trained in another group of weapons. He g…"; Note: "A fighter also adds this bonus to any combat maneuver checks made with weapons from his group. This bonus also applies t…".

The prose pass found this body a candidate; its description record is written and checked by hand, as every key needs one.

## Attribution

Held. Holds: class-abilities-625-owner-owed-PZO9491: PZO9491, no Registry record and no reviewed Section 15 text. 7 listed dwarven weapons are sourced only there (pinned Foundry item sources; no PCGen line); class-abilities-625-owner-owed-PZO9493: PZO9493, Martial Arts Handbook: no Registry record and no reviewed Section 15 text (already on S1's owner-owed list; its PCGen OGL block is missing). 4 listed weapons are sourced only there; class-abilities-625-owner-owed-content: No source evidence in the pinned Foundry items or PCGen for 3 listed weapons: dueling sword (its Foundry item weapons-and-ammo/dueling-sword.cKJ0wG42qRrrJJeI.yaml has no sources; PCGen's nearest name is the Product Identity "Aldori Dueling Sword", adventurers_armory/aa_equip_arms_armor.lst:86 and inner_sea_world_guide/iswg_profs_weapon.lst:13, unconfirmed as the same weapon), lungshuan tamo and brutal bolas (no Foundry item and no PCGen line). The rules paragraphs match the CRB (PRD coreRulebook/classes/fighter.html:385-387, apart from Foundry's "9th\*" and "his group"), but the body's group lists append non-CRB content: the Firearms and Siege engines groups (Ultimate Combat, PZO1118; PCGen uc_abilities_class.lst:1994), the Tribal group (Ultimate Wilderness, PZO1140; uw_abilities_class.lst:612) and weapons from later books. Required notices are the observed minimum: PZO1110, PZO1118 and PZO1140 for the groups, PZO1123, PZO9226, PZO9422 and PZO9455 as one reviewed book for each later weapon, PZO9410 (Adventurer's Armory, 7 weapons) and PZO9481 (Adventurer's Armory 2, 21 weapons), each read through its reviewed PCGen Section 15 confirmation (pcgen:PZO9410 and pcgen:PZO9481, scripts/catalog/legal/section15-confirmations-716.json#PZO9410 and #PZO9481, reviewed 2026-10-31 and promoted at be92b07c), and the two owner-owed books PZO9491 and PZO9493. Spiked shield is CRB (PRD :393 Close group; PCGen cr_profs_weapon.lst:162, cr_equipmods.lst:51). Owner-owed before the final merge; the held assessment changes no admission.

## Holds

Weapon Training is curated (checked description record, three rules Notes, evidence and an `unresolved` assessment) but held, with these named content-level holds in its assessment. They are owner-owed before the final merge; none is a notice hold in `held-notices.json`, and none clears or adds one:

- `class-abilities-625-owner-owed-PZO9491` (PZO9491): no Registry record and no reviewed Section 15 text. 7 listed dwarven weapons are sourced only there (pinned Foundry item sources; no PCGen line). Items: axe-gauntlet, dwarven heavy, axe-gauntlet, dwarven light, pelletbow, dwarven heavy, pelletbow, dwarven light, ram hammer, dwarven, sphinx hammer, dwarven, giant-sticker, dwarven.
- `class-abilities-625-owner-owed-PZO9493` (PZO9493): Martial Arts Handbook: no Registry record and no reviewed Section 15 text (already on S1's owner-owed list; its PCGen OGL block is missing). 4 listed weapons are sourced only there. Items: split-blade sword, broken-back seax, traveling kettle, double spear.
- `class-abilities-625-owner-owed-content`: No source evidence in the pinned Foundry items or PCGen for 3 listed weapons: dueling sword (its Foundry item weapons-and-ammo/dueling-sword.cKJ0wG42qRrrJJeI.yaml has no sources; PCGen's nearest name is the Product Identity "Aldori Dueling Sword", adventurers_armory/aa_equip_arms_armor.lst:86 and inner_sea_world_guide/iswg_profs_weapon.lst:13, unconfirmed as the same weapon), lungshuan tamo and brutal bolas (no Foundry item and no PCGen line). Items: dueling sword, lungshuan tamo, brutal bolas.

Spiked shield, which the researcher's matcher missed, is CRB (PRD `fighter.html:393` Close group; PCGen `cr_profs_weapon.lst:162`, `cr_equipmods.lst:51`), so it is not a hold. The researcher's trace (`ep-orch/mvp-20261023/s2-refresh-evidence/`) was the worklist; the curator re-traced every item against the pinned Foundry item names and sources and confirmed all 39 owner-owed-book items and the four untraced ones. Required notices are the observed minimum: PZO1110, PZO1118 (Firearms, Siege engines), PZO1140 (Tribal), one reviewed book per later weapon by greedy cover (PZO1123, PZO9455, PZO9422, PZO9226), PZO9410 and PZO9481 (read through their reviewed PCGen Section 15 confirmations) and the two owner-owed books PZO9491 and PZO9493, recorded in `inheritedRuleNotices` so `catalog:notice-deps` checks them. While it is held, the Fighter is dependently omitted and the public 1→20 proof waits for the owner's evidence.

**Run B (2026-11-01).** The base contains the promotion follow-up (`be92b07c`), where `pcgen:PZO9410` and `pcgen:PZO9481` read `reviewed` in the Section 15 Registry, confirmed by `scripts/catalog/legal/section15-confirmations-716.json#PZO9410` (PCGen `adventurers_armory/OGL.txt`, block lines 34-41, own line 39) and `#PZO9481` (`adventurers_armory_2/OGL.txt`, block lines 34-43, own line 41). Run B therefore dropped `class-abilities-625-owner-owed-PZO9410` (7 weapons) and `class-abilities-625-owner-owed-PZO9481` (21 weapons); their item lists move to the evidence's `weaponTrainingReview.onlyPcgenConfirmedBooks`, and `weaponTrainingReview.droppedHolds` records the drop. PZO9491, PZO9493 and the content hold stay owner-owed. Run B also corrected the spiked shield citation from `:395` (the Double group) to `:393` (the Close group) in the rationale, `weaponTrainingReview.spikedShield` and this report, and re-bound the evidence fingerprint (see Binding).

## Outstanding mechanics

- First group: +bonus on attack and damage rolls with weapons of the chosen group — owner #716. Needs the chosen group on the sheet; moot while held.
- Later groups at 9th, 13th and 17th — owner #716 (increment rows; S3). No release-path entries for the later groups in this run.
- Combat maneuver checks with group weapons — owner #716. Weapon conditions never reach sheet-level CMB.
- CMD against disarm and sunder of group weapons — owner #716. A Note only.

Calculations stay outstanding with their owners, never attribution holds.

## Source discrepancies

- Foundry reads "9th\*" (an unexplained asterisk) and "weapons from his group"; PRD reads "9th" and "this group". Recorded, not resolved.
- The body's Axes and Close lists repeat "axe-gauntlet, dwarven heavy, axe-gauntlet, dwarven light"; "greatsword" appears twice in Blades, Heavy. Recorded as upstream text.

## Importer gaps

- Foundry `changeFlags` (`mediumArmorFullSpeed` on Armor Training, `heavyArmorFullSpeed` on Armor Training (Heavy Armor)) don't reach the imported entry at all, not even as an `unsupported` field. Neither #738 nor #739 covers it; recorded here. The speed rules are Notes and stay outstanding (#716).

## Cross-batch bindings and protected records

Each key's full-corpus content closure is the entry alone (`collectReferences` is empty). The only entry whose closure reaches any of the six keys is the Fighter class (`pf1/WLqBCT5DqmGAx8Wd`), which has no assessment yet (run B). So the new Notes and Bravery's Modifier change no other assessment's binding, and nothing is re-bound. Bravery's Note reaches S3's seam test through committed curation (`tests/catalog/release-scope-round-trip.ts`); `convex/catalogReleaseScope.integration.test.ts` was re-run and passes, unchanged.

## Binding

`currentBinding` and the assessment come from `buildAssessmentBinding` over the full-corpus `catalog:preview` of the final records. Run B changed only the evidence (the spiked shield citation and the two dropped holds), so it re-bound the evidence fingerprint `ff3d6212…` → `3f5184ea…` in the assessment and `currentBinding`; the content (`993f09f6…`), mapping and notice fingerprints are unchanged. The assessment keeps run A's review date. An unresolved assessment is held before the binding check, so the gate outcome is unchanged. The batch test re-extracts the entry from the shared store, checks it equals the committed `tests/fixtures/class-abilities-<n>/preview.json` entry, re-binds it against the committed evidence and Registry, and runs the gate.

## Tests

[`class-abilities-625.test.ts`](../../tests/catalog/class-abilities-625.test.ts), with the run's shared checks in [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts): the inventory and launch-subset statement; the pinned body, checked records, PRD lines (against the capture manifest's hash) and PCGen rows from the shared store; a re-extraction and gate run with the binding re-built against current data; and the batch's own rows (`findCommittedBatchOwnershipProblems`).

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
