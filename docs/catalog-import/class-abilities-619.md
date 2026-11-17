# Class abilities #619: Studied Target (MVP launch subset, #619 wave E)

MVP launch subset of #619: this inventory curates only pf1/JnXrphJlr1ULx1MK (Studied Target); the ticket's other 99 keys stay remaining acceptance under #619. The 99 remaining keys are listed in the inventory's `launchSubset.remainingAcceptance` ([`class-abilities-619.json`](../../scripts/catalog/legal/class-abilities-619.json)) and stay this ticket's acceptance.

| Key                                   | Disposition | Assessment | Required notices | Increments | Evidence                               |
| ------------------------------------- | ----------- | ---------- | ---------------- | ---------- | -------------------------------------- |
| `pf1/JnXrphJlr1ULx1MK` Studied Target | admitted    | confirmed  | PZO1129, PZO1131 | 4          | `class-abilities-619-JnXrphJlr1ULx1MK` |

Its 4 increments (`everythingpath/slayer-studied-target-10`, `everythingpath/slayer-studied-target-15`, `everythingpath/slayer-studied-target-20`, `everythingpath/slayer-studied-target-5`) have no assessment of their own. Each has `attributionFrom: pf1/JnXrphJlr1ULx1MK`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Studied Target is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

## #619 wave E

This report belongs to #619 wave E (curation [#619](https://github.com/AndreasUnunger/EverythingPath/issues/619), increment parents wave E, contextNotes), which assesses three class-feature parents with Foundry contextNotes across three batches so that their schedule increments admit with them: the three parents and their 23 increments admitted, each note with a checked note record. This is the run report. Reviewer: Opus (AI curator) for the owner, 2026-11-06. Sources: pf1 v11.11 (`418761d2`), pf1-content 11.4.0, the PRD capture `prd-2026-10-20` and PCGen `25523dbc`. No book PDFs; Archives of Nethys not used.

## Evidence

### Studied Target (`pf1/JnXrphJlr1ULx1MK`)

- **Body:** [`packs/class-abilities/studied-target.JnXrphJlr1ULx1MK.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/studied-target.JnXrphJlr1ULx1MK.yaml) (sha256 `244c21fc6e97…`); Advanced Class Guide p. 53.
- **PRD:** `advancedClassGuide/classes/slayer.html:403-406`. Studied Target (Advanced Class Guide): 6 of the body's 9 sentences identical; the body reads "weapon attack and damage rolls" for "weapon attack rolls and weapon damage rolls", "can only maintain these bonuses against one opponent" for "can maintain these bonuses against only one opponent", and "weapon attack, damage rolls, and skill checks and to slayer DCs" for "weapon attack rolls, damage rolls, and skill checks and to the DCs of slayer abilities".
- **PCGen:** `acg_abilities_class.lst:1798`. Advanced Class Guide Slayer ~ Studied Target row: DESC states the bonus on Bluff, Knowledge and Sense Motive, Perception and Survival and on weapon attack and damage rolls, with SlayerStudiedTargetBonus = SlayerStudiedTargetLVL/5+1; SOURCEPAGE p.53.
- **PCGen:** `acg_abilities_class.lst:1814`. Studied Target support row: "A slayer can study an opponent he can see as a move action." before 7th level.
- **PCGen:** `acg_abilities_class.lst:1815`. Studied Target support row: "as a move or swift action" from 7th level (SlayerStudiedTargetProgression).
- **Grant:** Granted at Slayer level 1: Foundry classAssociations; PCGen acg_classes.lst:333. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Studied target bonus and number of studied targets by slayer level = 1 + floor(level / 5): 1 at 1st, 2 at 5th, 3 at 10th, 4 at 15th, 5 at 20th (PRD slayer.html:403, :405 and Table: Slayer :370-389, "1st studied target" to "5th studied target"); PCGen's SlayerStudiedTargetLVL/5+1 (acg_abilities_class.lst:1798) agrees. Per level: 1: 1, 2: 1, 3: 1, 4: 1, 5: 2, 6: 2, 7: 2, 8: 2, 9: 2, 10: 3, 11: 3, 12: 3, 13: 3, 14: 3, 15: 4, 16: 4, 17: 4, 18: 4, 19: 4, 20: 5.
- **Increment names:** each checked against its class table row: `slayer-studied-target-5` "2nd Studied Target" (`slayer.html:374`, "2nd studied target"); `slayer-studied-target-10` "3rd Studied Target" (`slayer.html:379`, "3rd studied target, advanced talents, slayer talent"); `slayer-studied-target-15` "4th Studied Target" (`slayer.html:384`, "4th studied target, sneak attack +5d6"); and the other 1 likewise.
- **Records:** `description` on `description` (`69870624…`), checked, one Modifier, `skill.sen` (the Sense Motive bonus the body names and Foundry's notes omit); and 15 checked `note` records, one per Foundry contextNote, each bound to its target and exact text:
  - `skill.blf` `+[[floor(@class.level / 5) + 1]] against studied target` (`0d2e6393…`) → `skill.blf` untyped, local Situation "against studied target"
  - `skill.kar` `+[[floor(@class.level / 5) + 1]] against studied target` (`0d2e6393…`) → `skill.kar` untyped, local Situation "against studied target"
  - `skill.kdu` `+[[floor(@class.level / 5) + 1]] against studied target` (`0d2e6393…`) → `skill.kdu` untyped, local Situation "against studied target"
  - `skill.ken` `+[[floor(@class.level / 5) + 1]] against studied target` (`0d2e6393…`) → `skill.ken` untyped, local Situation "against studied target"
  - `skill.kge` `+[[floor(@class.level / 5) + 1]] against studied target` (`0d2e6393…`) → `skill.kge` untyped, local Situation "against studied target"
  - `skill.khi` `+[[floor(@class.level / 5) + 1]] against studied target` (`0d2e6393…`) → `skill.khi` untyped, local Situation "against studied target"
  - `skill.klo` `+[[floor(@class.level / 5) + 1]] against studied target` (`0d2e6393…`) → `skill.klo` untyped, local Situation "against studied target"
  - `skill.kna` `+[[floor(@class.level / 5) + 1]] against studied target` (`0d2e6393…`) → `skill.kna` untyped, local Situation "against studied target"
  - `skill.kno` `+[[floor(@class.level / 5) + 1]] against studied target` (`0d2e6393…`) → `skill.kno` untyped, local Situation "against studied target"
  - `skill.kpl` `+[[floor(@class.level / 5) + 1]] against studied target` (`0d2e6393…`) → `skill.kpl` untyped, local Situation "against studied target"
  - `skill.kre` `+[[floor(@class.level / 5) + 1]] against studied target` (`0d2e6393…`) → `skill.kre` untyped, local Situation "against studied target"
  - `skill.per` `+[[floor(@class.level / 5) + 1]] against studied target` (`0d2e6393…`) → `skill.per` untyped, local Situation "against studied target"
  - `skill.sur` `+[[floor(@class.level / 5) + 1]] against studied target` (`0d2e6393…`) → `skill.sur` untyped, local Situation "against studied target"
  - `meleeWeapon` `+[[floor(@class.level / 5) + 1]] to attack and damage against studied target` (`3b91353f…`) → `attack.melee` untyped, local Situation "against studied target"; `damage.melee` untyped, local Situation "against studied target"
  - `rangedWeapon` `+[[floor(@class.level / 5) + 1]] to attack and damage against studied target` (`3b91353f…`) → `attack.ranged` untyped, local Situation "against studied target"; `damage.ranged` untyped, local Situation "against studied target"
- **Formula:** `floor(@classLevel.slayer / 5) + 1`. Foundry's @class.level is the Slayer's level, @classLevel.slayer (docs/character-sheet/modifiers.md; Bravery, pf1/h0Brxw6khcjlEf1T). floor(@classLevel.slayer / 5) + 1: +1, and +1 more at 5th, 10th, 15th and 20th (body; PRD advancedClassGuide/classes/slayer.html:403, :405; PCGen SlayerStudiedTargetBonus SlayerStudiedTargetLVL/5+1, acg_abilities_class.lst:1798). Untyped, as the body and PCGen give no type. Class levels are structural inputs, readable by skills, attack and damage. The note's "against studied target" is a local Situation: the target is the slayer's choice, not a sheet input.
- **Re-binds:** the Modifiers change the entry's content, so each content binding that covers it is re-bound; no other assessment's closure reaches it.
- **Notices:** PZO1129, PZO1131, each reviewed with no notice hold in force. PZO1129: Advanced Class Guide class feature Studied Target and the rules it applies (granted by Slayer). PZO1131: Retained Unchained action-cost metadata (activation.unchained) on the record's actions, kept in gameContent (curation.md, "Unchained action costs", #367).
- **Outstanding calculations** (never holds):
  - Choosing the studied target or targets (1 + floor(slayer level / 5) at a time) and applying the bonuses only against them — owner #619. The target is not a sheet input; the bonuses are Situational Modifiers under the local Situation "against studied target".
  - The +1 per stage to the DCs of slayer class abilities against a studied target — owner #619. No sheet statistic holds a class ability's DC against one opponent; the description states it.
  - Studying as a move action, as a move or swift action from 7th level, as an immediate action after sneak attack damage, and discarding as a free action — owner #619. Action economy is not a sheet calculation; the description states it.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #619. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset).
- **Source discrepancies** (recorded, not resolved):
  - The body reads "weapon attack and damage rolls" where the PRD capture reads "weapon attack rolls and weapon damage rolls" (slayer.html:403), "can only maintain these bonuses against one opponent" for "can maintain these bonuses against only one opponent", and "to slayer DCs" for "to the DCs of slayer abilities" (:405). Same rules; recorded, not resolved; the text stays verbatim.
  - Foundry's 15 notes cover Bluff, the ten Knowledge skills, Perception, Survival and melee and ranged weapons, but not Sense Motive, which the body, the PRD and PCGen name; the description record adds it. Recorded.
  - The body leaves its inner `<p>` tags unclosed. Recorded; the text stays verbatim.
  - Foundry's "Use" action carries Unchained action metadata (activation.unchained, type action), retained in gameContent; PZO1131 is required (curation.md, "Unchained action costs", #367).
- **Binding:** content `8463de961cfa…`, from `buildAssessmentBinding` over the full-corpus preview. The parent's closure is the entry alone.

## Tests

[`class-abilities-619.test.ts`](../../tests/catalog/class-abilities-619.test.ts). The batch test uses the shared checks in [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts) (`describeIncrementParent`): the inventory and launch-subset statement; the pinned body, checked description and note records (one per contextNote, bound to its target and exact text), PRD lines, PCGen rows, Foundry associations and each increment's name against its class table from the shared store; a re-extraction with committed curation, the binding re-built, and the gate admitting the parent with exactly its increments (an edited body admits neither); and the batch's own rows. Each parent adds its exact Modifiers, its formula evaluated by the sheet's parser against the schedule at every level, and its outstanding owners. The committed preview is [`tests/fixtures/class-abilities-619/binding-preview.json`](../../tests/fixtures/class-abilities-619/binding-preview.json): the parents as entries, each closure the entry alone, and their increments.

## Run results

Full-corpus `catalog:preview` at the pins (`inputVerification: verified`):

|                 | Admitted      | Held             | Dependent omissions | Failures     |
| --------------- | ------------- | ---------------- | ------------------- | ------------ |
| Base `9032556f` | 552           | 23,247           | 174                 | 1,761        |
| Wave E          | **578** (+26) | **23,221** (−26) | 174                 | 1,649 (−112) |

Newly admitted: the 3 parents (Trap Sense, Studied Target, Poison Resistance) and their 23 increments (`{barbarian,rogue,investigator}-trap-sense-{6,9,12,15,18}`, `slayer-studied-target-{5,10,15,20}`, `{alchemist,investigator}-poison-resistance-{5,8}`), all 26 from held. The 112 failure rows that leave are the parents' missing note records (Trap Sense 2, Studied Target 15, Poison Resistance 1, each repeated on the parent's increments); every other failure is identical key for key. Only the three parents' catalog entries differ from base (their Modifiers); no other key moves.

| Parent            | Batch | Disposition | Note records | Modifiers | Increments | Required notices |
| ----------------- | ----- | ----------- | ------------ | --------- | ---------- | ---------------- |
| Trap Sense        | #613  | admitted    | 2            | 2         | 15         | PZO1110, PZO1129 |
| Studied Target    | #619  | admitted    | 15           | 18        | 4          | PZO1129, PZO1131 |
| Poison Resistance | #606  | admitted    | 1            | 1         | 4          | PZO1115, PZO1129 |

## Launch inventory

The notice authority was rebuilt with S1's procedure and its hash rebound: `noticeAuthoritySha256` `fdf17623…` → `475d757e…`; `catalog:launch-inventory --write`, then `--check`, pass.

- **Identity:** `3afbb740…` → `f90caf7d…`; rows 19,272, outstanding requirements 96,679 and 78 required notices, all unchanged.
- **Moves:** the three parents' rows now cite their inventories' assessments, and their notice edges (Trap Sense PZO1110 and PZO1129, Studied Target PZO1129 and PZO1131, Poison Resistance PZO1115 and PZO1129) the inventories instead of source metadata; nothing else (45 diff lines, hashes aside).
- **Met:** `--verify --write`, then `--verify --check`, pass after the final generator run (projected rows 509 → 528: the 16 launch increments and the 3 parents; 508 rows with every observation verified). `mvp:status`: **363 → 379 met (+16)**, the 16 launch increments (barbarian and rogue Trap Sense 10, Studied Target 4, alchemist Poison Resistance 2). The investigator increments are not launch rows. The three parents stay unmet on `Feature/option grants and conditions`.
- **Pins:** `launch-document.test.ts` re-pins the identity (rows and outstanding requirements unchanged); no other pin moves.

## Re-bound bindings

The note records' Modifiers change the three parents' entries. Every other assessment whose full-corpus closure reaches them was checked with `buildAssessmentBinding` over the base and final previews: `pf1/4VUSgCTR3kUUtKxp` (Extra Inspiration, feats-330) and `pf1/SS99IHuvIvzQ1v92` (Amateur Investigator, feats-331), both held (`unresolved`), reach Trap Sense and Poison Resistance through the Investigator. Both content fingerprints were already stale at base (#756's deferred stale bindings; feats-330 and -331 are listed uncovered batches), so neither is re-bound and neither moves state. `tests/fixtures/feats-355/binding-preview.json` holds copies of Trap Sense and Studied Target (equal to the base import); no feats-355 assessment's closure reaches them, so no binding changes and the copies stay as committed (`cross-batch-bindings` passes). No other batch's assessment, inventory or fixture changes.

## Shared store

<!-- prep:shared-store-count -->
New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `175a3f5b`: **0**.
<!-- /prep:shared-store-count -->

Wave E adds no file to the shared store: the three bodies, every class record, PRD page and PCGen file the run cites were already there.

## Preservation

The shared files gain only the run's rows: 3 description records, 18 note records, 3 assessments (all confirmed) and 3 evidence entries; the three parents' catalog entries gain their Modifiers. No Registry, `held-notices.json`, `notice-clearances.json` or `known-notice-holds.json` change, and no shared Situation is added (`vs. traps` and `against studied target` are local; Poison Resistance uses the reviewed `poison`). The shared helper [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts) gains wave E's review date, a note-record count, the expected Modifiers and a formula evaluator, and is not copied.
