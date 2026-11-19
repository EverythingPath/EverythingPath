# Class abilities #617: Rage Powers, Magus Arcana and Versatile Performance (MVP launch subset, #617 wave B)

MVP launch subset of #617: this inventory curates only pf1/HdzsFdoGauXFjU2S (Rage Powers), pf1/HJ2vLLDYkihPxFkD (Magus Arcana) and pf1/HAqAsb5H56C6cZm3 (Versatile Performance); the ticket's other 97 keys stay remaining acceptance under #617. The 97 remaining keys are listed in the inventory's `launchSubset.remainingAcceptance` ([`class-abilities-617.json`](../../scripts/catalog/legal/class-abilities-617.json)) and stay this ticket's acceptance.

| Key                                          | Disposition | Assessment | Required notices          | Increments | Evidence                               |
| -------------------------------------------- | ----------- | ---------- | ------------------------- | ---------- | -------------------------------------- |
| `pf1/HdzsFdoGauXFjU2S` Rage Powers           | admitted    | confirmed  | PZO1110, PZO1115, PZO1118 | 9          | `class-abilities-617-HdzsFdoGauXFjU2S` |
| `pf1/HJ2vLLDYkihPxFkD` Magus Arcana          | admitted    | confirmed  | PZO1117                   | 5          | `class-abilities-617-HJ2vLLDYkihPxFkD` |
| `pf1/HAqAsb5H56C6cZm3` Versatile Performance | admitted    | confirmed  | PZO1110                   | 4          | `class-abilities-617-HAqAsb5H56C6cZm3` |

Its 9 increments (`everythingpath/barbarian-rage-power-10`, `everythingpath/barbarian-rage-power-12`, `everythingpath/barbarian-rage-power-14`, `everythingpath/barbarian-rage-power-16`, `everythingpath/barbarian-rage-power-18`, `everythingpath/barbarian-rage-power-20`, `everythingpath/barbarian-rage-power-4`, `everythingpath/barbarian-rage-power-6`, `everythingpath/barbarian-rage-power-8`) have no assessment of their own. Each has `attributionFrom: pf1/HdzsFdoGauXFjU2S`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Rage Powers is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

Its 5 increments (`everythingpath/magus-magus-arcana-12`, `everythingpath/magus-magus-arcana-15`, `everythingpath/magus-magus-arcana-18`, `everythingpath/magus-magus-arcana-6`, `everythingpath/magus-magus-arcana-9`) have no assessment of their own. Each has `attributionFrom: pf1/HJ2vLLDYkihPxFkD`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Magus Arcana is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

Its 4 increments (`everythingpath/bard-versatile-performance-10`, `everythingpath/bard-versatile-performance-14`, `everythingpath/bard-versatile-performance-18`, `everythingpath/bard-versatile-performance-6`) have no assessment of their own. Each has `attributionFrom: pf1/HAqAsb5H56C6cZm3`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Versatile Performance is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

## #617 wave B

This report belongs to #617 wave B (curation [#617](https://github.com/AndreasUnunger/EverythingPath/issues/617), increment parents wave B), which assesses eleven class-feature parents across five batches so that their 76 schedule increments admit with them. This is the run report. Reviewer: Opus (AI curator) for the owner, 2026-11-04. Sources: pf1 v11.11 (`418761d2`), the PRD capture `prd-2026-10-20` and PCGen `25523dbc`. No book PDFs; Archives of Nethys not used.

## Evidence

### Rage Powers (`pf1/HdzsFdoGauXFjU2S`)

- **Body:** [`packs/class-abilities/rage-powers.HdzsFdoGauXFjU2S.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/rage-powers.HdzsFdoGauXFjU2S.yaml) (sha256 `b02ef2f2437c…`); Core Rulebook p. 32.
- **PRD:** `coreRulebook/classes/barbarian.html:385`. Rage Powers (CRB): the body's first paragraph is identical after the heading.
- **PRD:** `advancedPlayersGuide/coreClasses/barbarian.html:349`. Rage Powers (Advanced Player's Guide): the body's second paragraph rewords this line ("can be taken by any barbarian that meets the prerequisites", "Totem rage powers grant powers in a theme", the one-group totem rule with its beast totem example).
- **PRD:** `ultimateCombat/classArchetypes/barbarian.html:363`. Dragon Totem (Ultimate Combat): the rage power the body names in its totem example ("any of the dragon totem rage powers"), where the APG line names the spirit totem.
- **PCGen:** `cr_abilities_class.lst:151`. Core Rulebook grant row Barbarian ~ Rage Powers at Barbarian_CFP_Level 2; the Barbarian ~ Rage Powers ability row (:422) is internal and carries no DESC.
- **PCGen:** `cr_abilities_class.lst:422`. Core Rulebook Barbarian ~ Rage Powers internal row: BONUS:ABILITYPOOL|Rage Power|RagePowersLVL/2 (no DESC).
- **PCGen:** `apg_abilities_class.lst:1486`. Advanced Player's Guide Rage Power ~ Beast Totem row: the totem the body names, under SOURCELONG Advanced Player's Guide.
- **PCGen:** `uc_abilities_class.lst:276`. Ultimate Combat Rage Power ~ Dragon Totem row (TYPE ... BarbarianTotemRagePower): the totem the body names, under SOURCELONG Ultimate Combat.
- **Grant:** Granted at Barbarian level 2: Foundry class records; PCGen cr_abilities_class.lst:151. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Rage powers by barbarian level = floor(level / 2): one at 2nd and one more at every even level, 10 at 20th (PRD barbarian.html:385 and Table: Barbarian :357-376; PCGen RagePowersLVL/2 at cr_abilities_class.lst:422). Per level: 1: 0, 2: 1, 3: 1, 4: 2, 5: 2, 6: 3, 7: 3, 8: 4, 9: 4, 10: 5, 11: 5, 12: 6, 13: 6, 14: 7, 15: 7, 16: 8, 17: 8, 18: 9, 19: 9, 20: 10.
- **Increment names:** each checked against its class table row: `barbarian-rage-power-4` "Rage Power" (`barbarian.html:360`, "Rage power"); `barbarian-rage-power-6` "Rage Power" (`barbarian.html:362`, "Rage power, Trap sense +2"); `barbarian-rage-power-8` "Rage Power" (`barbarian.html:364`, "Rage power"); and the other 6 likewise.
- **Record:** `description` on `description` (`d499f614…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, because the body sits in other batches' committed fixtures (the protected and binding contexts of spells-530 to -536 and feats-350 to -355, among others) and in their assessed closures (Extra Rage Power (`pf1/7P84frgqSmscfkUC`, feats-330), all unresolved and held by their own holds); a Note would change the entry they hold. The imported entry is identical to the base import.
- **Notices:** PZO1110, PZO1115, PZO1118, each reviewed with no hold in force. PZO1110: Core Rulebook class feature Rage Powers and the rules it applies (granted by Barbarian). PZO1115: Totem rage powers and their one-group rule, with the beast totem example (Advanced Player's Guide barbarian rage powers). PZO1118: The dragon totem rage powers, named as the body's example (Ultimate Combat barbarian).
- **Outstanding calculations** (never holds):
  - Rage power picks at 2nd and every even level, their prerequisites and the one-totem rule; their benefits only while raging — owner #617. The schedule's increments carry no rage power choice; the description states the rule.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #617. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset and wave A).
- **Source discrepancies** (recorded, not resolved):
  - The body's second paragraph rewords the Advanced Player's Guide line (barbarian.html:349): "who meets the powers' prerequisites can select and use rage powers", "related to a theme", and the dragon totem (Ultimate Combat) in place of the spirit totem as the example, adding "(any rage power with "dragon totem" in its title)". Recorded, not resolved; the text stays verbatim.
  - Foundry imports only the Core Rulebook (p. 32); the totem paragraph's books (PZO1115, PZO1118) are required as inherited notices.
- **Binding:** content `3dc39f0b6b8d…`, from `buildAssessmentBinding` over the full-corpus preview of the final records. The parent's closure is the entry alone.

### Magus Arcana (`pf1/HJ2vLLDYkihPxFkD`)

- **Body:** [`packs/class-abilities/magus-arcana.HJ2vLLDYkihPxFkD.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/magus-arcana.HJ2vLLDYkihPxFkD.yaml) (sha256 `1e2e9256984b…`); Ultimate Magic p. 9-13. The pinned record imports no sources (`sources: []`); the assessment cites the book from the PRD and PCGen.
- **PRD:** `ultimateMagic/spellcasters/magus.html:402`. Magus Arcana: the body's three paragraphs are this line's text after the heading.
- **PCGen:** `um_abilities_class.lst:45`. Ultimate Magic Magus ~ Magus Arcana row: DESC reproduces the body's three paragraphs; Pool_Magus_Arcana MagusArcanaLVL/3.
- **Grant:** Granted at Magus level 3: Foundry class records; PCGen um_abilities_globalvar.lst:14. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Magus arcana by magus level = floor(level / 3): one at 3rd and every three levels, 6 at 18th (PRD magus.html:402 and Table 1-2 :367-386; PCGen MagusArcanaLVL/3). Per level: 1: 0, 2: 0, 3: 1, 4: 1, 5: 1, 6: 2, 7: 2, 8: 2, 9: 3, 10: 3, 11: 3, 12: 4, 13: 4, 14: 4, 15: 5, 16: 5, 17: 5, 18: 6, 19: 6, 20: 6.
- **Increment names:** each checked against its class table row: `magus-magus-arcana-6` "Magus Arcana" (`magus.html:372`, "Magus Arcana"); `magus-magus-arcana-9` "Magus Arcana" (`magus.html:375`, "Magus Arcana"); `magus-magus-arcana-12` "Magus Arcana" (`magus.html:378`, "Magus Arcana"); and the other 2 likewise.
- **Record:** `description` on `description` (`12093a27…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, because the body sits in other batches' committed fixtures (the protected and binding contexts of spells-530 to -536 and feats-350 to -355, among others) and in their assessed closures (Extra Arcana (`pf1/aakJ9PeaLxE6qluW`, feats-332), all unresolved and held by their own holds); a Note would change the entry they hold. The imported entry is identical to the base import.
- **Notices:** PZO1117, each reviewed with no hold in force. PZO1117: Ultimate Magic class feature Magus Arcana and the rules it applies (granted by Magus).
- **Outstanding calculations** (never holds):
  - Magus arcana picks at 3rd and every three levels, and the magus spell list restriction — owner #617. The schedule's increments carry no arcana choice; the description states the rule.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #617. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset and wave A).
- **Source discrepancies** (recorded, not resolved):
  - Foundry's pinned record imports no sources (system.sources absent; the import's sources: []); the assessment cites Ultimate Magic, pp. 9-13, from the PRD and PCGen. Importer gap: reported, not fixed.
- **Binding:** content `55f4e3d203e2…`, from `buildAssessmentBinding` over the full-corpus preview of the final records. The parent's closure is the entry alone.

### Versatile Performance (`pf1/HAqAsb5H56C6cZm3`)

- **Body:** [`packs/class-abilities/versatile-performance.HAqAsb5H56C6cZm3.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/versatile-performance.HAqAsb5H56C6cZm3.yaml) (sha256 `f200f8d3f7e6…`); Core Rulebook p. 38.
- **PRD:** `coreRulebook/classes/bard.html:434,435`. Versatile Performance: the body's first paragraph is identical after the heading; its second gives the PRD's Perform types and skills as a list.
- **PCGen:** `cr_abilities_class.lst:211`. Core Rulebook grant row Bard ~ Versatile Performance at Bard_CFP_Level 2; the Bard ~ Versatile Performance ability row (:507) is internal and carries no DESC.
- **PCGen:** `cr_abilities_class.lst:507`. Core Rulebook Bard ~ Versatile Performance internal row (SOURCEPAGE p.38): BONUS:ABILITYPOOL|Versatile Performance|(VersatilePerformanceLVL+2)/4 (no DESC).
- **Grant:** Granted at Bard level 2: Foundry class records; PCGen cr_abilities_class.lst:211. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Perform types by bard level = 1 + floor((level - 2) / 4) from 2nd: one at 2nd, then 6th, 10th, 14th and 18th, 5 at 18th (PRD bard.html:434 and Table: Bard :358-377; PCGen (VersatilePerformanceLVL+2)/4). Per level: 1: 0, 2: 1, 3: 1, 4: 1, 5: 1, 6: 2, 7: 2, 8: 2, 9: 2, 10: 3, 11: 3, 12: 3, 13: 3, 14: 4, 15: 4, 16: 4, 17: 4, 18: 5, 19: 5, 20: 5.
- **Increment names:** each checked against its class table row: `bard-versatile-performance-6` "Versatile Performance" (`bard.html:363`, "Suggestion, Versatile performance"); `bard-versatile-performance-10` "Versatile Performance" (`bard.html:367`, "Jack-of-all-trades, Versatile performance"); `bard-versatile-performance-14` "Versatile Performance" (`bard.html:371`, "Frightening tune, Versatile performance"); and the other 1 likewise.
- **Record:** `description` on `description` (`2ddffca8…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, because the body sits in other batches' committed fixtures (the protected and binding contexts of spells-530 to -536 and feats-350 to -355, among others); a Note would change the entry they hold. The imported entry is identical to the base import.
- **Notices:** PZO1110, each reviewed with no hold in force. PZO1110: Core Rulebook class feature Versatile Performance and the rules it applies (granted by Bard).
- **Outstanding calculations** (never holds):
  - Perform type picks at 2nd, 6th, 10th, 14th and 18th, and the substitution of the Perform bonus for each type's associated skills — owner #617. The schedule's increments carry no Perform choice and the sheet has no skill substitution; the description states the rule.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #617. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset and wave A).
- **Source discrepancies** (recorded, not resolved):
  - The body gives the PRD's sentence of Perform types and associated skills (bard.html:435) as a list, without the commas and "and". Same content; recorded, not resolved; the text stays verbatim.
- **Binding:** content `573d18f471ae…`, from `buildAssessmentBinding` over the full-corpus preview of the final records. The parent's closure is the entry alone.

## Tests

[`class-abilities-617.test.ts`](../../tests/catalog/class-abilities-617.test.ts). The batch test uses the shared checks in [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts) (`describeIncrementParent`, from wave A): the inventory and launch-subset statement; the pinned body, checked record, PRD lines, PCGen rows, Foundry class records and each increment's name against its class table from the shared store; a re-extraction with committed curation, the binding re-built, and the gate admitting the parent with exactly its increments (an edited body admits neither); and the batch's own rows. Each parent adds that it has no Note, its unmapped Foundry changes, its outstanding owners and its schedule formula. The committed preview is [`tests/fixtures/class-abilities-617/binding-preview.json`](../../tests/fixtures/class-abilities-617/binding-preview.json): the parents as entries, each closure the entry alone, and their increments.

## Run results

Full-corpus `catalog:preview` at the pins (`inputVerification: verified`):

|                                            | Admitted      | Held             | Dependent omissions          | Failures                       |
| ------------------------------------------ | ------------- | ---------------- | ---------------------------- | ------------------------------ |
| Base `fa5c9e68` (wave A landed, then TC1b) | 360           | 23,439           | 174                          | 1,761                          |
| Wave B                                     | **447** (+87) | **23,352** (−87) | 174 (identical, key for key) | 1,761 (identical, key for key) |

Newly admitted: the eleven parents and their 76 increments, exactly the research list; nothing else moves, and no catalog entry differs from the base.

| Parent                 | Batch | Increments | Launch rows |
| ---------------------- | ----- | ---------- | ----------- |
| Rage Powers            | #617  | 9          | 9           |
| Rogue Talents          | #637  | 18         | 9           |
| Discovery              | #629  | 8          | 8           |
| Damage Reduction       | #624  | 12         | 8           |
| Challenge (CAV)        | #628  | 6          | 6           |
| Magus Arcana           | #617  | 5          | 5           |
| Sneak Attack (SLA)     | #628  | 5          | 5           |
| Versatile Performance  | #617  | 4          | 4           |
| Favored Enemy          | #629  | 4          | 4           |
| Bloodline Spells (BLO) | #624  | 3          | 3           |
| Bloodline Feat (SOR)   | #628  | 2          | 2           |

The research's +63 counts launch rows only. Thirteen admitted increments are not launch rows: the nine Unchained Rogue increments of Rogue Talents and the four Unchained Barbarian increments of Damage Reduction. 76 − 13 = 63.

## Notices beyond the research

- **Rage Powers, PZO1115 and PZO1118.** The totem paragraph rewords the Advanced Player's Guide line (`advancedPlayersGuide/coreClasses/barbarian.html:349`), and its example is the dragon totem, which is Ultimate Combat (`ultimateCombat/classArchetypes/barbarian.html:363`; PCGen `uc_abilities_class.lst:276`, under SOURCELONG Ultimate Combat).
- **Rogue Talents, PZO1118.** "A rogue cannot choose a ninja trick with the same name as a rogue talent" is the Ultimate Combat Ninja Trick talent's rule (`ultimateCombat/classArchetypes/rogue.html:372`; PCGen `uc_abilities_class.lst:1607`).
- **Challenge (CAV) and Sneak Attack (SLA), PZO1131.** Their retained actions carry `activation.unchained` (curation.md, "Unchained action costs", #367). The launch inventory already required PZO1131 for both ("including actual Unchained action metadata").

## Launch inventory

The notice authority was rebuilt with S1's procedure and its hash rebound: `noticeAuthoritySha256` `e33aad60…` → `9a06a7cc…`; `catalog:launch-inventory --write`, then `--check`, pass.

- **Identity:** `609a8d45…` → `fa66a70e…`; rows 19,267, required launch failures 96,703 and required notices 70 unchanged.
- **Moves:** the eleven rows' admission, content and notice evidence now cite their inventories (33 fields); 12 source-metadata notice edges give way to 19 inventory edges (Rage Powers gains PZO1115 and PZO1118, Rogue Talents PZO1118 and PZO1131, Damage Reduction PZO1131, Magus Arcana PZO1117 and Challenge PZO1115, which their records don't import), in the inventory, the notice document and its path graph; the notice inputs gain the five inventories' hashes. The other scope files move only in the authority hash.
- **Not measured on this base:** `mvp:status` and the verification projection arrive with the launch-verification slices. The research expects **+63 met** (the increments that are launch rows); the eleven parents stay unmet on `Feature/option grants and conditions`.
- **Pins:** `launch-document.test.ts` (the identity). No other launch or release pin moved.

## Importer gaps

- Challenge (CAV) and Magus Arcana import `sources: []`: their pinned records carry no `system.sources`. Each assessment names its book (PZO1115, PZO1117), which the gate accepts. No structure record is added.

## Shared store

<!-- prep:shared-store-count -->
New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `fa5c9e68`: **5** (pf1 1, prd 4).
<!-- /prep:shared-store-count -->

Wave B adds five files to the shared store, byte-identical to their pins: the Foundry body `packs/class-abilities/bloodline-spells-blo.RJ66UHdnwJ7VuWFo.yaml` (pf1 `418761d2`) and the PRD capture's `pages/coreRulebook/classes/rogue.html`, `ranger.html`, `pages/ultimateCombat/classArchetypes/barbarian.html` and `rogue.html` (`prd-2026-10-20`, by the manifest's hashes). The batch tests read each from the store.

## Preservation

The shared files gain only the run's rows: 11 description records, 11 assessments and 11 evidence entries. No record adds an output, so every catalog entry of the final full-corpus preview equals the base import: no other batch's assessment, binding or committed fixture moves (27 assessments' closures reach Rage Powers, Discovery, Magus Arcana, Favored Enemy or Bloodline Feat, and the eleven bodies sit in the protected and binding contexts of spells-530 to -536 and feats-350 to -355). No Registry, `held-notices.json`, `notice-clearances.json` or `known-notice-holds.json` change. The shared helper [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts) is reused unchanged except for its header comment.
