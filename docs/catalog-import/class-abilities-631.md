# Class abilities #631: Mystery and Slayer Talents (MVP launch subset, #631 wave A)

MVP launch subset of #631: this inventory curates only pf1/ZhQM4K4dqStS6qRn (Mystery) and pf1/Zn9ecDCXShBK4vj8 (Slayer Talents); the ticket's other 98 keys stay remaining acceptance under #631. The 98 remaining keys are listed in the inventory's `launchSubset.remainingAcceptance` ([`class-abilities-631.json`](../../scripts/catalog/legal/class-abilities-631.json)) and stay this ticket's acceptance.

| Key                                   | Disposition | Assessment | Required notices | Increments | Evidence                               |
| ------------------------------------- | ----------- | ---------- | ---------------- | ---------- | -------------------------------------- |
| `pf1/ZhQM4K4dqStS6qRn` Mystery        | admitted    | confirmed  | PZO1115          | 9          | `class-abilities-631-ZhQM4K4dqStS6qRn` |
| `pf1/Zn9ecDCXShBK4vj8` Slayer Talents | admitted    | confirmed  | PZO1129          | 9          | `class-abilities-631-Zn9ecDCXShBK4vj8` |

Its 9 increments (`everythingpath/oracle-mystery-10`, `everythingpath/oracle-mystery-12`, `everythingpath/oracle-mystery-14`, `everythingpath/oracle-mystery-16`, `everythingpath/oracle-mystery-18`, `everythingpath/oracle-mystery-2`, `everythingpath/oracle-mystery-4`, `everythingpath/oracle-mystery-6`, `everythingpath/oracle-mystery-8`) have no assessment of their own. Each has `attributionFrom: pf1/ZhQM4K4dqStS6qRn`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Mystery is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

Its 9 increments (`everythingpath/slayer-slayer-talent-10`, `everythingpath/slayer-slayer-talent-12`, `everythingpath/slayer-slayer-talent-14`, `everythingpath/slayer-slayer-talent-16`, `everythingpath/slayer-slayer-talent-18`, `everythingpath/slayer-slayer-talent-20`, `everythingpath/slayer-slayer-talent-4`, `everythingpath/slayer-slayer-talent-6`, `everythingpath/slayer-slayer-talent-8`) have no assessment of their own. Each has `attributionFrom: pf1/Zn9ecDCXShBK4vj8`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Slayer Talents is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

## #631 wave A

This report belongs to #631 wave A (curation [#631](https://github.com/AndreasUnunger/EverythingPath/issues/631), increment parents wave A), which assesses ten class-feature parents across eight batches so that their 87 schedule increments admit with them. This is the run report. Reviewer: Opus (AI curator) for the owner, 2026-11-04. Sources: pf1 v11.11 (`418761d2`), the PRD capture `prd-2026-10-20` and PCGen `25523dbc`. No book PDFs; Archives of Nethys not used.

Unarmed Strike (`pf1/a4SPdPuOFdmfJdHN`) is this ticket's too. It stays remaining acceptance: it is dependently omitted on held linked entries, and it runs after waves A to C.

## Evidence

### Mystery (`pf1/ZhQM4K4dqStS6qRn`)

- **Body:** [`packs/class-abilities/mystery.ZhQM4K4dqStS6qRn.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/mystery.ZhQM4K4dqStS6qRn.yaml) (sha256 `5cef3a033437…`); Advanced Player's Guide p. 42-54. The pinned record imports no sources (`sources: []`); the assessment cites the book from the PRD and PCGen.
- **PRD:** `advancedPlayersGuide/baseClasses/oracle.html:412,413`. Mystery: both paragraphs identical to the body after the heading.
- **PCGen:** `apg_abilities_globalvar.lst:74`. Advanced Player's Guide grant row Oracle's Mystery at Oracle_CFP_Level 1; the Oracle's Mystery ability row (apg_abilities_class.lst:480) carries no DESC.
- **PCGen:** `apg_abilities_class.lst:480`. Advanced Player's Guide Oracle's Mystery ability row (no DESC).
- **Grant:** Granted at Oracle level 1: Foundry classAssociations; PCGen apg_abilities_globalvar.lst:74. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Mystery spells by oracle level = min(floor(level / 2), 9): one at 2nd and every two levels to 18th (PRD oracle.html:413 and Table 2-6 :359-378, "Mystery spell" at 2nd to 18th). Per level: 1: 0, 2: 1, 3: 1, 4: 2, 5: 2, 6: 3, 7: 3, 8: 4, 9: 4, 10: 5, 11: 5, 12: 6, 13: 6, 14: 7, 15: 7, 16: 8, 17: 8, 18: 9, 19: 9, 20: 9.
- **Increment names:** each checked against its class table row: `oracle-mystery-2` "Mystery Spell" (`oracle.html:360`, "Mystery spell"); `oracle-mystery-4` "Mystery Spell" (`oracle.html:362`, "Mystery spell"); `oracle-mystery-6` "Mystery Spell" (`oracle.html:364`, "Mystery spell"); and the other 6 likewise.
- **Record:** `description` on `description` (`fa0e0722…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, because the body sits in other batches' committed fixtures (the protected and binding contexts of spells-530 to -536 and feats-350 to -355, among others); a Note would change the entry they hold. The imported entry is identical to the base import.
- **Notices:** PZO1115, each reviewed with no hold in force. PZO1115: Advanced Player's Guide class feature Mystery and the rules it applies (granted by Oracle). PZO1115: The waves mystery, named as an example (Advanced Player's Guide oracle mysteries).
- **Outstanding calculations** (never holds):
  - The mystery pick at 1st level and its mystery spells at 2nd to 18th — owner #631. The schedule's increments carry no mystery choice and no granted spell; the description states the rule.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #631. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset).
- **Source discrepancies** (recorded, not resolved):
  - Foundry's pinned record imports no sources (system.sources absent; the import's sources: []); the assessment cites the Advanced Player's Guide, pp. 42-54, from the PRD and PCGen. Importer gap: reported, not fixed.
  - The body nests its second `<p>` inside the first (unclosed). Recorded; the text stays verbatim.
- **Binding:** content `85adc64b3e91…`, from `buildAssessmentBinding` over the full-corpus preview of the final records. The parent's closure is the entry alone.

### Slayer Talents (`pf1/Zn9ecDCXShBK4vj8`)

- **Body:** [`packs/class-abilities/slayer-talents.Zn9ecDCXShBK4vj8.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/slayer-talents.Zn9ecDCXShBK4vj8.yaml) (sha256 `bcb93bb17345…`); Advanced Class Guide p. 53.
- **PRD:** `advancedClassGuide/classes/slayer.html:410,411`. Slayer Talents: three sentences identical; the body drops "(\*)" after "asterisk" and "talent" in "which talent to use". Same rule.
- **PCGen:** `acg_classes.lst:335`. Advanced Class Guide Slayer class level-2 row: ABILITY Slayer ~ Slayer Talents; the ability row (acg_abilities_class.lst:1802) is internal and carries no DESC.
- **PCGen:** `acg_abilities_class.lst:1802`. Advanced Class Guide Slayer ~ Slayer Talents internal row (no DESC).
- **Grant:** Granted at Slayer level 2: Foundry classAssociations; PCGen acg_classes.lst:335. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Slayer talents by slayer level = floor(level / 2): one at 2nd and every even level, 10 at 20th (PRD slayer.html:410 and Table 1-14 :370-389). Per level: 1: 0, 2: 1, 3: 1, 4: 2, 5: 2, 6: 3, 7: 3, 8: 4, 9: 4, 10: 5, 11: 5, 12: 6, 13: 6, 14: 7, 15: 7, 16: 8, 17: 8, 18: 9, 19: 9, 20: 10.
- **Increment names:** each checked against its class table row: `slayer-slayer-talent-4` "Slayer Talent" (`slayer.html:373`, "Slayer talent"); `slayer-slayer-talent-6` "Slayer Talent" (`slayer.html:375`, "Slayer talent, sneak attack +2d6"); `slayer-slayer-talent-8` "Slayer Talent" (`slayer.html:377`, "Slayer talent"); and the other 6 likewise.
- **Record:** `description` on `description` (`566e6d21…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, because the body sits in other batches' committed fixtures (the protected and binding contexts of spells-530 to -536 and feats-350 to -355, among others) and in their assessed closures (Extra Slayer Talent (`pf1/xEiu70gtsZsq4eSo`, feats-332), all unresolved and held by their own holds); a Note would change the entry they hold. The imported entry is identical to the base import.
- **Notices:** PZO1129, each reviewed with no hold in force. PZO1129: Advanced Class Guide class feature Slayer Talents and the rules it applies (granted by Slayer). PZO1129: The slayer's sneak attack, to which asterisked talents add effects (Advanced Class Guide slayer).
- **Outstanding calculations** (never holds):
  - Slayer talent picks at 2nd and every even level, and the sneak attack talents' one-per-attack rule — owner #631. The schedule's increments carry no talent choice; the description states the rule.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #631. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset).
- **Source discrepancies** (recorded, not resolved):
  - Two sentences differ in wording from the PRD capture: "an asterisk add" for "an asterisk (\*) add" and "which to use" for "which talent to use". Same rule; recorded, not resolved; the text stays verbatim.
- **Binding:** content `c1afc7921a1a…`, from `buildAssessmentBinding` over the full-corpus preview of the final records. The parent's closure is the entry alone.

## Tests

[`class-abilities-631.test.ts`](../../tests/catalog/class-abilities-631.test.ts). The batch test uses the shared checks in [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts), generalised in this run (`describeIncrementParent`): the inventory and launch-subset statement; the pinned body, checked record, PRD lines, PCGen rows, Foundry associations and each increment's name against its class table from the shared store; a re-extraction with committed curation, the binding re-built, and the gate admitting the parent with exactly its increments (an edited body admits neither); and the batch's own rows. Each parent adds that it has no Note, its unmapped Foundry changes, its outstanding owners and its schedule formula. The committed preview is [`tests/fixtures/class-abilities-631/binding-preview.json`](../../tests/fixtures/class-abilities-631/binding-preview.json): the parents as entries, each closure the entry alone, and their increments.

## Run results

Full-corpus `catalog:preview` at the pins (`inputVerification: verified`):

|                 | Admitted      | Held             | Dependent omissions          | Failures                       |
| --------------- | ------------- | ---------------- | ---------------------------- | ------------------------------ |
| Base `3e986881` | 263           | 23,536           | 174                          | 1,761                          |
| Wave A          | **360** (+97) | **23,439** (−97) | 174 (identical, key for key) | 1,761 (identical, key for key) |

Newly admitted: the ten parents and their 87 increments, exactly the research list; nothing else moves.

| Parent                 | Batch | Increments |
| ---------------------- | ----- | ---------- |
| AC Bonus (MNK)         | #607  | 10         |
| Fast Movement (MNK)    | #613  | 10         |
| Hex                    | #616  | 10         |
| Channel Energy         | #639  | 9          |
| Mystery                | #631  | 9          |
| Slayer Talents         | #631  | 9          |
| Slow Fall              | #620  | 8          |
| Bloodline Spells (SOR) | #643  | 8          |
| Ki powers (UC)         | #622  | 8          |
| Judgment               | #643  | 6          |

## Launch inventory

The notice authority was rebuilt with S1's procedure and its hash rebound: `noticeAuthoritySha256` `44d00a68…` → `e33aad60…`; `catalog:launch-inventory --write`, then `--check`, pass.

- **Identity:** `b3348c30…` → `609a8d45…`; rows 19,267, required launch failures 96,703 and required notices 70 unchanged.
- **Moves:** the ten rows' admission, content and notice evidence now cite their inventories (30 fields); 11 source-metadata notice edges give way to 14 inventory edges (Hex, Mystery and Judgment gain PZO1115, which their records don't import), in the inventory, the notice document and its path graph; the notice inputs gain the eight inventories' hashes. The other scope files move only in the authority hash.
- **Not measured on this base:** `mvp:status` and the verification projection (`campaign-mvp-v1.verification.json`) arrive with the launch-verification slices. The research expects **+87 met** (the increments); the ten parents stay unmet on `Feature/option grants and conditions`. Root regenerates the projection at prep.
- **Pins:** `launch-document.test.ts` (the identity). No other launch or release pin moved.

## Importer gaps

- Hex, Mystery and Judgment import `sources: []`: their pinned records carry no `system.sources`. Each assessment names its book (PZO1115), which the gate accepts. No structure record is added. Neither #738 nor #739 covers it.

## Shared store

<!-- prep:shared-store-count -->
New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `6120a636`: **4** (pf1 4).
<!-- /prep:shared-store-count -->

Wave A adds four Foundry bodies to the shared store, byte-identical to pf1 `418761d2`: `packs/class-abilities/mystery.ZhQM4K4dqStS6qRn.yaml`, `slow-fall.M4bXVPXouXroIt90.yaml`, `bloodline-spells-sor.qlQxKPARGGdOgNWm.yaml` and `ki-powers-uc.NsP31IshAuY4gv0s.yaml`. The batch tests re-extract each parent from the store, and these four were not on the base. Every PRD page and PCGen file the run cites was already there.

## Preservation

The shared files gain only the run's rows: 10 description records, 10 assessments and 10 evidence entries. No record adds an output, so every catalog entry of the final full-corpus preview equals the base import: no other batch's assessment, binding or committed fixture moves (23 assessments' closures reach Hex, Slayer Talents, Channel Energy or Bloodline Spells, and the ten bodies sit in the protected and binding contexts of spells-530 to -536 and feats-350 to -355, among others). No Registry, `held-notices.json`, `notice-clearances.json` or `known-notice-holds.json` change. The shared helper [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts) is generalised (several candidates per batch, per-row reviewer and date, granting classes, books, PRD pages and increments) and keeps the eight Fighter tests green.
