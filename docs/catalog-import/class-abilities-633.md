# Class abilities #633: Summon Monster (MVP launch subset, #631 wave F1)

MVP launch subset of #633: this inventory curates only pf1/caNEmbCtoHA7NYtZ (Summon Monster); the ticket's other 99 keys stay remaining acceptance under #633. The 99 remaining keys are listed in the inventory's `launchSubset.remainingAcceptance` ([`class-abilities-633.json`](../../scripts/catalog/legal/class-abilities-633.json)) and stay this ticket's acceptance.

| Key                                   | Disposition | Assessment | Required notices                   | Linked closure                            | Increments | Evidence                               |
| ------------------------------------- | ----------- | ---------- | ---------------------------------- | ----------------------------------------- | ---------- | -------------------------------------- |
| `pf1/caNEmbCtoHA7NYtZ` Summon Monster | admitted    | confirmed  | PZO1110, PZO1112, PZO1115, PZO1131 | Summon Monster I, Summon Monster IX, Gate | 9          | `class-abilities-633-caNEmbCtoHA7NYtZ` |

Its 9 increments (`everythingpath/summoner-summon-monster-11`, `everythingpath/summoner-summon-monster-13`, `everythingpath/summoner-summon-monster-15`, `everythingpath/summoner-summon-monster-17`, `everythingpath/summoner-summon-monster-19`, `everythingpath/summoner-summon-monster-3`, `everythingpath/summoner-summon-monster-5`, `everythingpath/summoner-summon-monster-7`, `everythingpath/summoner-summon-monster-9`) have no assessment of their own. Each has `attributionFrom: pf1/caNEmbCtoHA7NYtZ`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Summon Monster is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

## #631 wave F1

This report belongs to #631 wave F1 (curation [#631](https://github.com/AndreasUnunger/EverythingPath/issues/631), dependently omitted increment parents with small closures), which re-assesses the 12 entries the closures hold back (7 Core Rulebook feats under #735 S-04, 3 Spells under S-03, 2 weapons kept on named holds) and then admits five parents and their 33 increments; Sneak Attack (#609) stays out on its weapons. The run report is [class-abilities-631.md](class-abilities-631.md). Reviewer: Opus (AI curator) for the owner, 2026-11-07. Sources: pf1 v11.11 (`418761d2`), pf1-content 11.4.0, the PRD capture `prd-2026-10-20` and PCGen `25523dbc`. No book PDFs; Archives of Nethys not used.

## Evidence

### Summon Monster (`pf1/caNEmbCtoHA7NYtZ`)

- **Body:** [`packs/class-abilities/summon-monster.caNEmbCtoHA7NYtZ.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/summon-monster.caNEmbCtoHA7NYtZ.yaml) (sha256 `6a257c8cb9f8…`); Advanced Player's Guide p. 54.
- **PRD:** `advancedPlayersGuide/baseClasses/summoner.html:418`. Summon Monster (Advanced Player's Guide): the body is this line word for word but its three links, whose labels capitalise the spell names (Summon Monster I, Summon Monster IX, Gate) where the PRD writes them in lower case.
- **PCGen:** `apg_abilities_class.lst:795`. Advanced Player's Guide Summoner ~ Summon Monster row: DESC the spell-like ability, uses per day, standard action and minutes per level.
- **Grant:** Granted at Summoner level 1: Foundry classAssociations; PCGen apg_abilities_class.lst:751. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Summon monster spell level by summoner level = ceil(level / 2): summon monster I at 1st, one level more at 3rd and every 2 levels to summon monster IX at 17th, and gate (or summon monster IX) at 19th, value 10 (PRD summoner.html:418 and Table: Summoner :358-377, Special). Per level: 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4, 9: 5, 10: 5, 11: 6, 12: 6, 13: 7, 14: 7, 15: 8, 16: 8, 17: 9, 18: 9, 19: 10, 20: 10.
- **Increment names:** each checked against its class table row: `summoner-summon-monster-3` "Summon Monster II" (`summoner.html:360`, "Summon monster II"); `summoner-summon-monster-5` "Summon Monster III" (`summoner.html:362`, "Summon monster III"); `summoner-summon-monster-7` "Summon Monster IV" (`summoner.html:364`, "Summon monster IV"); and the other 6 likewise.
- **Linked closure** (the reason it was dependently omitted): Summon Monster I (`pf1/kyo0kwhw2jhuztju`, spells-533, linked from `pf1/caNEmbCtoHA7NYtZ`): admitted (wave F1, linked.py); Summon Monster IX (`pf1/mi52crelhwuy6bmp`, spells-535, linked from `pf1/caNEmbCtoHA7NYtZ`): admitted (wave F1, linked.py); Gate (`pf1/ursm11405zobemi3`, spells-542, linked from `pf1/caNEmbCtoHA7NYtZ`): admitted (wave F1, linked.py).
- **Record:** `description` on `description` (`ae38f62a…`), checked, `outputs: []`: no prose Note, since other batches' committed closures reach this body.
- **Notices:** PZO1110, PZO1112, PZO1115, PZO1131, each reviewed with no notice hold in force. PZO1110: Core Rulebook spells the body names and casts: summon monster I, summon monster IX and gate (linked, spells-533, spells-535 and spells-542), with their spell-like ability, spell trigger and spell completion rules. PZO1112: Bestiary celestial and fiendish templates the cast summon monster spells apply (summon monster I, spells-533, and summon monster IX, which functions like it); added by fix round 1. PZO1115: Advanced Player's Guide class feature Summon Monster and the rules it applies (granted by Summoner). PZO1131: Retained Unchained action-cost metadata (activation.unchained) on the record's action and on the linked Spells' actions in its bound closure, kept in gameContent (curation.md, "Unchained action costs", #367).
- **Outstanding calculations** (never holds):
  - Uses per day (3 + Charisma modifier), the spell level summoned and the eidolon exclusion — owner #633. A spell-like ability's uses and spell level are not sheet statistics; the description and increments state them.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #633. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset).
- **Source discrepancies** (recorded, not resolved):
  - The body's link labels capitalise the spell names ("Summon Monster I", "Summon Monster IX", "Gate") that the PRD capture writes in lower case (summoner.html:418), and it keeps the capture's typo "fufill". Recorded, not resolved; the text stays verbatim.
  - Foundry's "Use" action carries Unchained action metadata (activation.unchained), retained in gameContent; PZO1131 is required (curation.md, "Unchained action costs", #367).
- **Binding:** content `bc3d3fbd21c6…`, from `buildAssessmentBinding` over the full-corpus preview; it covers the parent and its linked closure.

## Tests

[`class-abilities-633.test.ts`](../../tests/catalog/class-abilities-633.test.ts). The batch test uses the shared checks in [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts) (`describeIncrementParent`): the inventory and launch-subset statement; the pinned body, checked description record, PRD lines, PCGen rows, Foundry associations and each increment's name against its class table from the shared store; a re-extraction of the parent with its linked closure, the binding re-built, and the gate admitting the parent, its closure and exactly its increments (an edited body admits only the closure); and the batch's own rows. Wave F1 extends the helper with the closure (`linkedContentReview`, the fixture's `closure`); it is not copied. The committed preview is [`tests/fixtures/class-abilities-633/binding-preview.json`](../../tests/fixtures/class-abilities-633/binding-preview.json): the parent, its closure and its increments.

## Preservation and gates

The shared files gain only this batch's rows: its description record, assessment and evidence entry. No Registry, `held-notices.json`, `notice-clearances.json` or `known-notice-holds.json` change. The commands and their results are in [class-abilities-631.md](class-abilities-631.md).
