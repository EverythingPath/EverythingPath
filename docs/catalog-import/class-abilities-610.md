# Class abilities #610: Bomb (MVP launch subset, #631 wave F1)

MVP launch subset of #610: this inventory curates only pf1/7gHiZBNHjwefbBLI (Bomb); the ticket's other 99 keys stay remaining acceptance under #610. The 99 remaining keys are listed in the inventory's `launchSubset.remainingAcceptance` ([`class-abilities-610.json`](../../scripts/catalog/legal/class-abilities-610.json)) and stay this ticket's acceptance.

| Key                         | Disposition | Assessment | Required notices          | Linked closure                               | Increments | Evidence                               |
| --------------------------- | ----------- | ---------- | ------------------------- | -------------------------------------------- | ---------- | -------------------------------------- |
| `pf1/7gHiZBNHjwefbBLI` Bomb | admitted    | confirmed  | PZO1110, PZO1115, PZO1131 | Vital Strike, Point-Blank Shot, Weapon Focus | 9          | `class-abilities-610-7gHiZBNHjwefbBLI` |

Its 9 increments (`everythingpath/alchemist-bomb-11`, `everythingpath/alchemist-bomb-13`, `everythingpath/alchemist-bomb-15`, `everythingpath/alchemist-bomb-17`, `everythingpath/alchemist-bomb-19`, `everythingpath/alchemist-bomb-3`, `everythingpath/alchemist-bomb-5`, `everythingpath/alchemist-bomb-7`, `everythingpath/alchemist-bomb-9`) have no assessment of their own. Each has `attributionFrom: pf1/7gHiZBNHjwefbBLI`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Bomb is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

## #631 wave F1

This report belongs to #631 wave F1 (curation [#631](https://github.com/AndreasUnunger/EverythingPath/issues/631), dependently omitted increment parents with small closures), which re-assesses the 12 entries the closures hold back (7 Core Rulebook feats under #735 S-04, 3 Spells under S-03, 2 weapons kept on named holds) and then admits five parents and their 33 increments; Sneak Attack (#609) stays out on its weapons. The run report is [class-abilities-631.md](class-abilities-631.md). Reviewer: Opus (AI curator) for the owner, 2026-11-07. Sources: pf1 v11.11 (`418761d2`), pf1-content 11.4.0, the PRD capture `prd-2026-10-20` and PCGen `25523dbc`. No book PDFs; Archives of Nethys not used.

## Evidence

### Bomb (`pf1/7gHiZBNHjwefbBLI`)

- **Body:** [`packs/class-abilities/bomb.7gHiZBNHjwefbBLI.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/bomb.7gHiZBNHjwefbBLI.yaml) (sha256 `ef3114b0e0a8…`); Advanced Player's Guide p. 28.
- **PRD:** `advancedPlayersGuide/baseClasses/alchemist.html:391-393`. Bomb (Advanced Player's Guide): the body is these three lines word for word.
- **PCGen:** `apg_abilities_class.lst:73`. Advanced Player's Guide Alchemist ~ Bomb row: DESC the bombs per day, the Point-Blank Shot and Weapon Focus sentence and the damage; SOURCEPAGE p.27.
- **Grant:** Granted at Alchemist level 1: Foundry classAssociations; PCGen apg_abilities_globalvar.lst:25. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Bomb damage by alchemist level = ceil(level / 2) d6: 1d6 at 1st and +1d6 at every odd level to 10d6 at 19th (PRD alchemist.html:392, "increases by 1d6 points at every odd-numbered alchemist level", and Table: Alchemist :357-376, Special). Per level: 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4, 9: 5, 10: 5, 11: 6, 12: 6, 13: 7, 14: 7, 15: 8, 16: 8, 17: 9, 18: 9, 19: 10, 20: 10.
- **Increment names:** each checked against its class table row: `alchemist-bomb-3` "Bomb 2d6" (`alchemist.html:359`, "Bomb 2d6, swift alchemy"); `alchemist-bomb-5` "Bomb 3d6" (`alchemist.html:361`, "Bomb 3d6, poison resistance +4"); `alchemist-bomb-7` "Bomb 4d6" (`alchemist.html:363`, "Bomb 4d6"); and the other 6 likewise.
- **Linked closure** (the reason it was dependently omitted): Vital Strike (`pf1/26k1Gi7t5BoqxhIj`, feats-330, linked from `pf1/7gHiZBNHjwefbBLI`): admitted (feats-330, earlier); Point-Blank Shot (`pf1/8rsFtye3PwM6CKli`, feats-330, linked from `pf1/7gHiZBNHjwefbBLI`): admitted (wave F1, linked.py); Weapon Focus (`pf1/n250dFlbykAIAg5Z`, feats-332, linked from `pf1/7gHiZBNHjwefbBLI`): admitted (wave F1, linked.py).
- **Record:** `description` on `description` (`a8feb639…`), checked, `outputs: []`: no prose Note, since other batches' committed closures reach this body.
- **Notices:** PZO1110, PZO1115, PZO1131, each reviewed with no notice hold in force. PZO1110: Core Rulebook feats and rules the body names: Point-Blank Shot and Weapon Focus (linked, feats-330 and feats-332), Vital Strike (linked, feats-330), the Throw Splash Weapon special attack and the standard action that provokes an attack of opportunity. PZO1115: Advanced Player's Guide class feature Bomb and the rules it applies (granted by Alchemist). PZO1131: Retained Unchained action-cost metadata (activation.unchained) on the record's action, kept in gameContent (curation.md, "Unchained action costs", #367).
- **Outstanding calculations** (never holds):
  - Bombs per day (class level + Intelligence modifier), damage dice, splash damage and the Reflex DC (10 + 1/2 alchemist level + Intelligence modifier) — owner #610. The attack is an action on the feature, not a sheet statistic; the description and increments state it.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #610. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset).
- **Source discrepancies** (recorded, not resolved):
  - Foundry's "Use" action carries Unchained action metadata (activation.unchained), retained in gameContent; PZO1131 is required (curation.md, "Unchained action costs", #367).
- **Binding:** content `2abaadf10002…`, from `buildAssessmentBinding` over the full-corpus preview; it covers the parent and its linked closure.

## Tests

[`class-abilities-610.test.ts`](../../tests/catalog/class-abilities-610.test.ts). The batch test uses the shared checks in [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts) (`describeIncrementParent`): the inventory and launch-subset statement; the pinned body, checked description record, PRD lines, PCGen rows, Foundry associations and each increment's name against its class table from the shared store; a re-extraction of the parent with its linked closure, the binding re-built, and the gate admitting the parent, its closure and exactly its increments (an edited body admits only the closure); and the batch's own rows. Wave F1 extends the helper with the closure (`linkedContentReview`, the fixture's `closure`); it is not copied. The committed preview is [`tests/fixtures/class-abilities-610/binding-preview.json`](../../tests/fixtures/class-abilities-610/binding-preview.json): the parent, its closure and its increments.

## Preservation and gates

The shared files gain only this batch's rows: its description record, assessment and evidence entry. No Registry, `held-notices.json`, `notice-clearances.json` or `known-notice-holds.json` change. The commands and their results are in [class-abilities-631.md](class-abilities-631.md).
