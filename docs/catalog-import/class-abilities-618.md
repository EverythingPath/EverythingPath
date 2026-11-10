# Class abilities #618: Flurry of Blows (MVP launch subset, #631 wave F1)

MVP launch subset of #618: this inventory curates only pf1/JKJoHy5NveXGaZqv (Flurry of Blows); the ticket's other 99 keys stay remaining acceptance under #618. The 99 remaining keys are listed in the inventory's `launchSubset.remainingAcceptance` ([`class-abilities-618.json`](../../scripts/catalog/legal/class-abilities-618.json)) and stay this ticket's acceptance.

| Key                                    | Disposition | Assessment | Required notices | Linked closure                                                                 | Increments | Evidence                               |
| -------------------------------------- | ----------- | ---------- | ---------------- | ------------------------------------------------------------------------------ | ---------- | -------------------------------------- |
| `pf1/JKJoHy5NveXGaZqv` Flurry of Blows | admitted    | confirmed  | PZO1110          | Improved Two-Weapon Fighting, Two-Weapon Fighting, Greater Two-Weapon Fighting | 2          | `class-abilities-618-JKJoHy5NveXGaZqv` |

Its 2 increments (`everythingpath/monk-flurry-15`, `everythingpath/monk-flurry-8`) have no assessment of their own. Each has `attributionFrom: pf1/JKJoHy5NveXGaZqv`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Flurry of Blows is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

## #631 wave F1

This report belongs to #631 wave F1 (curation [#631](https://github.com/AndreasUnunger/EverythingPath/issues/631), dependently omitted increment parents with small closures), which re-assesses the 12 entries the closures hold back (7 Core Rulebook feats under #735 S-04, 3 Spells under S-03, 2 weapons kept on named holds) and then admits five parents and their 33 increments; Sneak Attack (#609) stays out on its weapons. The run report is [class-abilities-631.md](class-abilities-631.md). Reviewer: Opus (AI curator) for the owner, 2026-11-07. Sources: pf1 v11.11 (`418761d2`), pf1-content 11.4.0, the PRD capture `prd-2026-10-20` and PCGen `25523dbc`. No book PDFs; Archives of Nethys not used.

## Evidence

### Flurry of Blows (`pf1/JKJoHy5NveXGaZqv`)

- **Body:** [`packs/class-abilities/flurry-of-blows.JKJoHy5NveXGaZqv.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/flurry-of-blows.JKJoHy5NveXGaZqv.yaml) (sha256 `d59a1b5d115b…`); Core Rulebook p. 57-58.
- **PRD:** `coreRulebook/classes/monk.html:385-388`. Flurry of Blows (Core Rulebook): the body is these lines word for word but "one additional attack" for the capture's typo "on additional attack" and "utilize" for "use".
- **PCGen:** `cr_abilities_class.lst:1096`. Core Rulebook Monk ~ Flurry of Blows row: DESC "You can make a flurry of blows as a full-attack action."; SOURCEPAGE p.57.
- **Grant:** Granted at Monk level 1: Foundry classAssociations; PCGen cr_abilities_class.lst:172. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Additional flurry attacks by monk level: 1 from 1st (as if Two-Weapon Fighting), 2 from 8th (as if Improved Two-Weapon Fighting), 3 from 15th (as if Greater Two-Weapon Fighting) (PRD monk.html:385-387; Table: Monk :357-376, Flurry of Blows Attack Bonus: four attacks at 8th, six at 15th). Per level: 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 2, 9: 2, 10: 2, 11: 2, 12: 2, 13: 2, 14: 2, 15: 3, 16: 3, 17: 3, 18: 3, 19: 3, 20: 3.
- **Increment names:** each checked against its class table row: `monk-flurry-8` "Flurry of Blows (Improved Two-Weapon Fighting)" (`monk.html:364`, "+6/+6/+1/+1"); `monk-flurry-15` "Flurry of Blows (Greater Two-Weapon Fighting)" (`monk.html:371`, "+13/+13/+8/+8/+3/+3").
- **Linked closure** (the reason it was dependently omitted): Improved Two-Weapon Fighting (`pf1/3fNdl7eIUJ5d5fwg`, feats-330, linked from `pf1/JKJoHy5NveXGaZqv`): admitted (wave F1, linked.py); Two-Weapon Fighting (`pf1/Ee7JHADKEK37tTHs`, feats-330, linked from `pf1/JKJoHy5NveXGaZqv`): admitted (wave F1, linked.py); Greater Two-Weapon Fighting (`pf1/ieltigobtFrlTXIt`, feats-332, linked from `pf1/JKJoHy5NveXGaZqv`): admitted (wave F1, linked.py).
- **Record:** `description` on `description` (`9a5ba30b…`), checked, `outputs: []`: no prose Note, since other batches' committed closures reach this body.
- **Notices:** PZO1110, each reviewed with no notice hold in force. PZO1110: Core Rulebook class feature Flurry of Blows and the rules it applies (granted by Monk).
- **Outstanding calculations** (never holds):
  - The flurry attack bonuses (monk level as base attack bonus, −2 on all attacks) and the extra attacks at 8th and 15th — owner #618. Full-attack sequences are not sheet statistics; the description and increments state them.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #618. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset).
- **Source discrepancies** (recorded, not resolved):
  - The body reads "one additional attack" where the PRD capture has the typo "on additional attack" (monk.html:385), and "utilize" for "use". Recorded, not resolved; the text stays verbatim.
  - The increments' feat names are the PRD body's (monk.html:386-387, "as if using Improved / Greater Two-Weapon Fighting"); Table: Monk gives the attack count in its Flurry of Blows Attack Bonus column, the label check's cell.
- **Binding:** content `01110ea52f46…`, from `buildAssessmentBinding` over the full-corpus preview; it covers the parent and its linked closure.

## Tests

[`class-abilities-618.test.ts`](../../tests/catalog/class-abilities-618.test.ts). The batch test uses the shared checks in [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts) (`describeIncrementParent`): the inventory and launch-subset statement; the pinned body, checked description record, PRD lines, PCGen rows, Foundry associations and each increment's name against its class table from the shared store; a re-extraction of the parent with its linked closure, the binding re-built, and the gate admitting the parent, its closure and exactly its increments (an edited body admits only the closure); and the batch's own rows. Wave F1 extends the helper with the closure (`linkedContentReview`, the fixture's `closure`); it is not copied. The committed preview is [`tests/fixtures/class-abilities-618/binding-preview.json`](../../tests/fixtures/class-abilities-618/binding-preview.json): the parent, its closure and its increments.

## Preservation and gates

The shared files gain only this batch's rows: its description record, assessment and evidence entry. No Registry, `held-notices.json`, `notice-clearances.json` or `known-notice-holds.json` change. The commands and their results are in [class-abilities-631.md](class-abilities-631.md).
