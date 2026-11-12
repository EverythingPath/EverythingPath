# Fighter launch subset, runs A and B, across #596/#608/#613/#621/#622/#625/#636/#637

Run A of [#596](https://github.com/AndreasUnunger/EverythingPath/issues/596) curates the Fighter's class features that S3 doesn't change. Each comes from its own class-ability batch, with its own inventory, report and test. Reviewer: Sol (AI curator) for the owner, 2026-10-31.

| Key                    | Feature                              | Batch                                                               | Disposition                                               | Report                                             |
| ---------------------- | ------------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------- |
| `pf1/h0Brxw6khcjlEf1T` | Bravery, with its `note will` record | [#636](https://github.com/AndreasUnunger/EverythingPath/issues/636) | admitted                                                  | [class-abilities-636.md](class-abilities-636.md)   |
| `pf1/5JFfSqLMCpbRmERa` | Armor Training                       | [#608](https://github.com/AndreasUnunger/EverythingPath/issues/608) | admitted                                                  | [class-abilities-608.md](class-abilities-608.md)   |
| `pf1/iqeyCQIIVnNt0p3h` | Armor Training (Heavy Armor)         | [#637](https://github.com/AndreasUnunger/EverythingPath/issues/637) | admitted                                                  | [class-abilities-637.md](class-abilities-637.md)   |
| `pf1/McXAM1BoPHZLO1n4` | Weapon Mastery                       | [#621](https://github.com/AndreasUnunger/EverythingPath/issues/621) | admitted                                                  | [class-abilities-621.md](class-abilities-621.md)   |
| `pf1/NwTe1Q2utlsmOAqK` | Armor Mastery                        | [#622](https://github.com/AndreasUnunger/EverythingPath/issues/622) | admitted                                                  | [class-abilities-622.md](class-abilities-622.md)   |
| `pf1/RzEzudurxQFirFoF` | Weapon Training                      | [#625](https://github.com/AndreasUnunger/EverythingPath/issues/625) | held, on three named owner-owed holds (run B dropped two) | [class-abilities-625.md](class-abilities-625.md)   |
| `pf1/CV8BsY3ciUb9TA1Y` | Bonus Feats                          | [#613](https://github.com/AndreasUnunger/EverythingPath/issues/613) | run B: admitted, with its ten increments                  | [class-abilities-613.md](class-abilities-613.md)   |
| `pf1/WLqBCT5DqmGAx8Wd` | Fighter                              | #596                                                                | run B: confirmed, dependently omitted on Weapon Training  | [Run B](#run-b-fighter-class-root-and-bonus-feats) |

The full-corpus preview goes from 108 admitted, 23,190 held, 154 dependent omissions and 1,628 failures to **113, 23,185, 154 and 1,627**. The five admissions are new, and Bravery's missing Note is the one failure removed. The per-owner reports give the evidence, records, holds, outstanding calculations and commands.

## Launch inventory and notice authority

The notice authority (`scripts/catalog/scopes/campaign-mvp-v1.notices.json`) hashes every `scripts/catalog/legal/*.json` and reads the batch inventories' required notices, so the six inventories move it. It was reproduced with S1's procedure, which rebuilds it from a fresh pinned-input inventory build and rebinds `noticeAuthoritySha256` in `campaign-mvp-v1.authority.json` from `45374034…` to `83ce6dec…`. `catalog:launch-inventory --write` then re-compacted the scope files. Identity: `288ccd37…` → `sha256:e5aaba3224e2f98a8c05f584037176e755e1d9861221aecf639375da077ca7e2`.

Every moved row:

- **Inputs:** six new legal inputs, `class-abilities-{608,621,622,625,636,637}.json`. No existing input changed.
- **Edges:** 16 added and 6 removed, all of kind `notice`.
  - Each of the six keys' PZO1110 edge now reads "Original scripts/catalog/legal/class-abilities-<n>.json requires PZO1110", in place of "Source metadata/governing mechanics require PZO1110".
  - Weapon Training gains 10 edges: PZO1118, PZO1123, PZO1140, PZO9226, PZO9422, PZO9455, PZO9410, PZO9481, PZO9491 and PZO9493.
- **Notice rows:** two new required rows, PZO9455 and PZO9481, each sourced to Weapon Training. Six existing rows take Weapon Training as their source: PZO1123, PZO9226, PZO9422, PZO9410, PZO9491 and PZO9493.
- **PZO9491 becomes required.** Before, only the optional Breath Weapon (Dwarf) racial trait reached it; now Weapon Training, on the required Fighter path, requires it. Required notices go from 67 to 70.
- **Coverage:** `#251 acceptance appendix`, `#732`, `#736` and `#737` each gain PZO9455, PZO9481 and PZO9491. The notice path graph follows these edges.
- **Feature rows:** each of the six keys' `admission`, `contentEvidence` and `noticeEvidence` evidence now cites its inventory and evidence ID, replacing "No current owning-batch assessment recorded".
  - The five admitted keys stay `unreviewed` in the launch view.
  - Weapon Training's `admission` and `contentEvidence` become `held`, and its row gains the five named holds.
- **Rows:** 19,265 → 19,267, from the two new notice rows.
- **Launch failures:** 99,298 → 99,315 (+17).
  - +12 notice findings: the owner-owed PZO9481 and PZO9491 fail six checks each. PZO9455 adds none, since `pcgen:PZO9455` is reviewed.
  - +5 `hold` findings: Weapon Training's five holds.
- **Other scope files:** the advanced, checkpoints, companions and core documents decode identically to the base. They changed only in storage, through the shared records dictionary.

Pins moved to match: `launch-document.test.ts` (identity, rows, failures), `launch-notices.test.ts` (70 required notices) and `release-scope-build.test.ts` (16,736 required rows).

Run A also changed all eight count pins in `tests/catalog/release-scope.test.ts` (`git show e5bf1992 -- tests/catalog/release-scope.test.ts`): the required-row count to 16,736 (one pin), the total row count to 19,267 (four pins) and the required, optional and outside-MVP summary counts to 16,736, 2,531 and 2,531 (three pins), since PZO9491 moved from optional to required.

## Run B: Fighter class root and Bonus Feats

Run B (2026-11-01, base `be92b07c`, after S3 and the promotion follow-up) curates the Fighter class root (#596) and Bonus Feats (#613), and closes run A's two deferred judgement items and the #770 Fighter wording. Reviewer: Sol (AI curator) for the owner, 2026-11-01. Sources as in run A, plus PCGen `core_rulebook/cr_classes.lst` and `pathfinder_unchained/pu_skills.lst`, already on the base.

| Key                                      | Batch                                                               | Disposition         | Assessment | Required notices | Evidence                               | Report                                           |
| ---------------------------------------- | ------------------------------------------------------------------- | ------------------- | ---------- | ---------------- | -------------------------------------- | ------------------------------------------------ |
| `pf1/CV8BsY3ciUb9TA1Y` Bonus Feats (FGT) | [#613](https://github.com/AndreasUnunger/EverythingPath/issues/613) | admitted            | confirmed  | PZO1110          | `class-abilities-613-CV8BsY3ciUb9TA1Y` | [class-abilities-613.md](class-abilities-613.md) |
| `pf1/WLqBCT5DqmGAx8Wd` Fighter           | #596                                                                | dependently omitted | confirmed  | PZO1110, PZO1131 | `classes-596-WLqBCT5DqmGAx8Wd`         | this report                                      |
| `pf1/RzEzudurxQFirFoF` Weapon Training   | [#625](https://github.com/AndreasUnunger/EverythingPath/issues/625) | held (3 holds)      | unresolved | unchanged        | `class-abilities-625-RzEzudurxQFirFoF` | [class-abilities-625.md](class-abilities-625.md) |

MVP launch subset of #596: [`classes-596.json`](../../scripts/catalog/legal/classes-596.json) curates only pf1/WLqBCT5DqmGAx8Wd (Fighter); the ticket's other 2 keys (`pf1/W3EjUgYLJ1D9qDKw`, `pf1/W8dxwZ1CZiwLKsqr`) stay remaining acceptance under #596. Bonus Feats is the MVP launch subset of #613, with its 99 other keys as remaining acceptance ([class-abilities-613.md](class-abilities-613.md)).

Full-corpus preview at the pins (`inputVerification: verified`): base `be92b07c` **120 admitted, 23,688 held, 165 dependent omissions, 1,761 failures**; with run B **131, 23,676, 166, 1,761**.

- **+11 admitted:** `pf1/CV8BsY3ciUb9TA1Y` (Bonus Feats) and `everythingpath/fighter-bonus-feats-{2,4,6,8,10,12,14,16,18,20}`.
- **−12 held:** those 11 and the Fighter.
- **+1 dependent omission:** `pf1/WLqBCT5DqmGAx8Wd`, with the reason `Dependent omission: everythingpath/fighter-weapon-training-13, everythingpath/fighter-weapon-training-17, everythingpath/fighter-weapon-training-9, pf1/RzEzudurxQFirFoF.`
- **Failures:** the same 1,761 rows, key for key.

### The Fighter

Disposition **dependently omitted**, with a **confirmed** assessment. No hold is invented for it. A class references every `featuresByLevel` row, and the gate omits an otherwise admitted entry with a held direct dependency (`omitUnavailableDependents`, `scripts/catalog/admission.ts`; #547 precedent). Weapon Training (#625) and its 9th, 13th and 17th level increments stay held on owner-owed evidence. Once Weapon Training's assessment is confirmed and the bodies are unchanged, the Fighter admits with no re-review.

Body, checked against the PRD capture (`coreRulebook/classes/fighter.html`) and PCGen:

- **Hit die** d10 (`:350`; PCGen `cr_classes.lst:139` `HD:10`): imported `hitDie: 10`.
- **Class skills** (`:352`; PCGen `cr_abilities_class.lst:2835`): the ten CRB skills, imported as `classSkills`. Foundry adds `art` and `lor`, Pathfinder Unchained background skills (PCGen `pu_skills.lst:86-87`), which the importer keeps as prose (`unsupported`). That is why PZO1131 is required and recorded in `inheritedRuleNotices`; it is reviewed.
- **Skill ranks** 2 + Int (`:353`; PCGen `cr_classes.lst:141`): imported `skillRanksPerLevel: 2`.
- **Table** (`:356-376`): base attack +1 to +20 (full), Fortitude +2 + level/2 (good), Reflex and Will level/3 (poor), as imported and as PCGen's `BASEAB` and `SAVE` formulas (`cr_classes.lst:139`).
- **27 `featuresByLevel` rows**, each checked against the table's Special column: 11 bonus feats (1st and every even level), Bravery 2/6/10/14/18, Armor Training 3/7/11/15, Weapon Training 5/9/13/17, Heavy Armor at 7 (a kept Foundry non-row), Armor Mastery at 19 and Weapon Mastery at 20.
- **Description record:** checked, `outputs: []` (covered). The Role paragraph is flavour, and the Class Skills paragraph is the imported `classSkills`. The drafter and the prose pass found nothing for the body.

**Binding.** The Fighter's content fingerprint (`a52cdb454ef1…`) hashes its whole 28-body closure: the class, its seven features and its 20 increments, with Bravery's Note and Bonus Feats' new Note included. `currentBinding` comes from `buildAssessmentBinding` over the full-corpus preview of the final records. `classes-596.test.ts` re-imports exactly that closure from the shared store with committed curation, checks every body equals the committed fixture ([`tests/fixtures/classes-596/preview.json`](../../tests/fixtures/classes-596/preview.json): the Fighter and its 27-row closure) and that the bounded binding equals the full-corpus one. It then runs the gate: the Fighter is omitted with the exact reason, Weapon Training and its three increments are held, and the other 23 bodies are admitted. A later curation record on any closure row (for example a Weapon Training Note) makes the binding stale, and it must then be re-bound.

**Outstanding calculations**, never holds:

- class weapon and armor proficiencies (`:379`; the importer keeps them in `gameContent` only) — #716;
- feat retraining at 4/8/12/16/20 — #716;
- a non-Combat feat in a bonus feat slot warns rather than refuses — #313;
- Weapon Training's later groups and its CMB and CMD bonuses — #716.

### Bonus Feats

Admitted under the reviewed CRB notice, with its ten increments through `attributionFrom`. Each of the 11 rows has the slot `{ kind: 'feat', count: 1, featTypes: ['Combat'] }` (S3, `scripts/catalog/pcgen/schedule-slots.ts:35-38`). Foundry's `bonusFeats` change is unmapped and contributes nothing, so no slot is doubled. Its description record adds one Note, the retraining paragraph. See [class-abilities-613.md](class-abilities-613.md).

### Weapon Training (#625) and the deferred judgement items

- **Holds narrowed:** the base contains the promotion follow-up (`be92b07c`), and `pcgen:PZO9410` and `pcgen:PZO9481` read `reviewed` (confirmations `scripts/catalog/legal/section15-confirmations-716.json#PZO9410` and `#PZO9481`). So run B dropped `class-abilities-625-owner-owed-PZO9410` (7 weapons) and `class-abilities-625-owner-owed-PZO9481` (21 weapons), and updated `class-abilities-625.test.ts`'s `HOLDS` and `missingEvidence` pins. Weapon Training stays held on `class-abilities-625-owner-owed-PZO9491`, `-PZO9493` (owner-owed Section 15 text) and `-content` (dueling sword, lungshuan tamo, brutal bolas).
- **Spiked shield citation** (judgement item 2): PRD `fighter.html:395` is the Double group; the Close group that lists spiked shield is `:393`. Corrected in the inventory's rationale and `weaponTrainingReview.spikedShield`, in the assessment rationale and both evidence copies (`rationale` and `boundary`), and in [class-abilities-625.md](class-abilities-625.md). The CRB classification stands.
- **Re-bind:** these evidence edits move Weapon Training's evidence fingerprint `ff3d6212…` → `3f5184ea…`, re-bound in the assessment and the inventory's `currentBinding`. Content, mapping and notice fingerprints are unchanged. The gate is unaffected: an unresolved assessment is held before the binding check.
- **Run A's report** (judgement item 1): the paragraph above now records that run A changed all eight `release-scope.test.ts` count pins, and the six run A reports' "run B" sentence points here.

### #770 wording

Since run A the Fighter waits on Weapon Training (#625), not on Bravery (#636). Reworded, with no assertion moved: `tests/catalog/release-scope-round-trip.ts` (the held-bodies comment), `convex/catalogReleaseScope.integration.test.ts` (the seam test comment) and [releases.md](releases.md). The seam tests use test-only attribution. The public 1→20 Fighter proof is run C: it needs the owner's Weapon Training evidence first, and no placeholder test is added.

### Cross-batch bindings

The only assessment whose full-corpus closure reaches Bonus Feats or the Fighter is the Fighter's own; a scan of every assessment's closure found no other. Run A's six fixtures still equal the full-corpus entries, so no earlier binding moves.

### Launch inventory and notice authority (run B)

The notice authority hashes every `scripts/catalog/legal/*.json`, so run B's two new inventories and the edited `class-abilities-625.json` move it. It was reproduced with S1's procedure, as in run A. The procedure rebuilds it from a fresh pinned-input inventory build and rebinds `noticeAuthoritySha256` in `campaign-mvp-v1.authority.json` from `e68bef8d…` to `349ac2d7…`. `catalog:launch-inventory --write` then re-compacted the scope files, and `--check` passes: identity `sha256:7c16d924…` → `sha256:cc07084c1a94a9264bd947bdadb682e837ada16947b8747b4f02f82b029ca0c3`, 0 inventory errors.

Every moved row, decoded field by field against the base:

- **Inputs:** two new legal inputs, `class-abilities-613.json` and `classes-596.json`. `class-abilities-625.json`'s hash moves (`1d2ef533…` → `f27dc329…`).
- **Edges:** 3 added and 2 removed, all of kind `notice`.
  - The Fighter's and Bonus Feats' PZO1110 edges now read "Original scripts/catalog/legal/<inventory>.json requires PZO1110", in place of "Source metadata/governing mechanics require PZO1110".
  - The Fighter gains a PZO1131 edge from `classes-596.json`. The notice path graph follows.
- **Notice rows:** none added, and required notices stay at 70. PZO1131 was already required. Its row's source binding is now the Fighter's record (`packs/classes/fighter.WLqBCT5DqmGAx8Wd.yaml`) in place of the Unchained Monk's, because the Fighter now reaches it first.
- **Coverage:** `#251 acceptance appendix`, `#732`, `#736` and `#737` keep the same key sets; only the order moves (PZO1131 before PZO1117).
- **Feature rows:**
  - The Fighter's and Bonus Feats' `admission`, `contentEvidence` and `noticeEvidence` evidence now cites the inventory, the evidence ID and the recorded disposition (dependently omitted and admitted, both confirmed), in place of "No current owning-batch assessment recorded".
  - Weapon Training's row drops its `class-abilities-625-owner-owed-PZO9410` and `-PZO9481` holds and keeps three.
- **Rows:** 19,267, unchanged.
- **Launch failures:** 99,255 → 99,253 (−2): Weapon Training's two dropped `hold` findings. PZO9410 and PZO9481 were already verified by the promotion follow-up.
- **Other scope files:** the advanced, checkpoints, companions and core documents decode identically to the base. They changed only in storage, through the shared records dictionary.

Pins moved to match: `launch-document.test.ts` (identity and failures, with an arithmetic comment). `launch-notices.test.ts`, `release-scope.test.ts` and `release-scope-build.test.ts` need no change: required notices, rows and required rows are unchanged. [campaign-mvp-inventory.md](campaign-mvp-inventory.md) is regenerated by `--write`.

### Run B commands

Each command ran through `capped.sh` (2 workers / 600%), with `LC_ALL=C.UTF-8` and `LANG` unset. The log, with exit codes and wall times, is in the run's evidence.

| Command                                                                                                                         | Result                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `catalog:curate --candidates` (Fighter, Bonus Feats), then `--descriptions`                                                     | 0 required drafts, 0 prose candidates; both description records written by hand                      |
| full `catalog:preview`                                                                                                          | 131 admitted, 23,676 held, 166 dependent omissions, 1,761 failures (base 120 / 23,688 / 165 / 1,761) |
| `pnpm catalog:notice-deps`                                                                                                      | 0 gaps, 0 waived, 0 stale; no warning on these keys                                                  |
| `pnpm catalog:format --check`                                                                                                   | canonical                                                                                            |
| `pnpm catalog:pin`                                                                                                              | `sha256:bbd31213…`, unchanged                                                                        |
| the batch tests (`classes-596`, `class-abilities-613`) and run A's six                                                          | pass (8 files, 45 tests)                                                                             |
| guards: `cross-batch-bindings`, `notice-holds`, `pinned-sources`, `batch-ownership`, `batch-ownership-sweep`, `review-receipts` | pass (6 files, 267 tests)                                                                            |
| `catalog:launch-inventory --check`                                                                                              | pass after regeneration: `sha256:cc07084c…`, 99,253 failures                                         |
| `pnpm -s typecheck`, `pnpm -s lint`, `pnpm -s check:initial-migration-writers`                                                  | pass                                                                                                 |
| `launch-document`, `launch-notices`, `release-scope`, `release-scope-build`                                                     | pass (60 tests; only `launch-document`'s identity and failures pins moved)                           |
| `convex/catalogReleaseScope.integration.test.ts`, after the #770 comment edit                                                   | pass (11 tests)                                                                                      |

## Shared store

<!-- prep:shared-store-count -->
New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `aab32115`: **0**.
<!-- /prep:shared-store-count -->

Run A added one file to the shared store, the PRD capture's `pages/coreRulebook/classes/fighter.html` (prep's count after the rebase onto `3bc50ea5`: 1, prd 1), byte-identical, with its hash in the capture manifest. Run B adds none: the Fighter and Bonus Feats records, the PRD Fighter page and the PCGen Core Rulebook and Pathfinder Unchained files it cites (`cr_classes.lst`, `cr_abilities_class.lst`, `pu_skills.lst`, `_pathfinder_unchained.pcc`) were already on the base; the block above counts run B's files after prep's rebase.
