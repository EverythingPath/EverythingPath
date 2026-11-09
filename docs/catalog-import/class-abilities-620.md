# Class abilities #620: Slow Fall (MVP launch subset, #631 wave A)

MVP launch subset of #620: this inventory curates only pf1/M4bXVPXouXroIt90 (Slow Fall); the ticket's other 99 keys stay remaining acceptance under #620. The 99 remaining keys are listed in the inventory's `launchSubset.remainingAcceptance` ([`class-abilities-620.json`](../../scripts/catalog/legal/class-abilities-620.json)) and stay this ticket's acceptance.

| Key                              | Disposition | Assessment | Required notices | Increments | Evidence                               |
| -------------------------------- | ----------- | ---------- | ---------------- | ---------- | -------------------------------------- |
| `pf1/M4bXVPXouXroIt90` Slow Fall | admitted    | confirmed  | PZO1110          | 8          | `class-abilities-620-M4bXVPXouXroIt90` |

Its 8 increments (`everythingpath/monk-slow-fall-10`, `everythingpath/monk-slow-fall-12`, `everythingpath/monk-slow-fall-14`, `everythingpath/monk-slow-fall-16`, `everythingpath/monk-slow-fall-18`, `everythingpath/monk-slow-fall-20`, `everythingpath/monk-slow-fall-6`, `everythingpath/monk-slow-fall-8`) have no assessment of their own. Each has `attributionFrom: pf1/M4bXVPXouXroIt90`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when Slow Fall is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

## #631 wave A

This report belongs to #631 wave A (curation [#631](https://github.com/AndreasUnunger/EverythingPath/issues/631), increment parents wave A), which assesses ten class-feature parents across eight batches so that their 87 schedule increments admit with them. The run report is [class-abilities-631.md](class-abilities-631.md). Reviewer: Opus (AI curator) for the owner, 2026-11-04. Sources: pf1 v11.11 (`418761d2`), the PRD capture `prd-2026-10-20` and PCGen `25523dbc`. No book PDFs; Archives of Nethys not used.

## Evidence

### Slow Fall (`pf1/M4bXVPXouXroIt90`)

- **Body:** [`packs/class-abilities/slow-fall.M4bXVPXouXroIt90.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/slow-fall.M4bXVPXouXroIt90.yaml) (sha256 `4224c70ea792…`); Core Rulebook p. 59.
- **PRD:** `coreRulebook/classes/monk.html:411`. Slow Fall: identical to the body after the heading.
- **PCGen:** `cr_abilities_class.lst:1103`. Core Rulebook Monk ~ Slow Fall row: DESC summarises the rule ("You can use a nearby wall to slow your descent").
- **Grant:** Granted at Monk level 4: Foundry classAssociations; PCGen cr_abilities_class.lst:181. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** Slow fall distance by monk level: 20 ft. at 4th and 10 ft. more at every even level to 90 ft. at 18th, 10 x floor(level / 2); any distance (true) at 20th (PRD monk.html:411 and the Special column of Table: Monk :357-376). Per level: 1: 0, 2: 0, 3: 0, 4: 20, 5: 20, 6: 30, 7: 30, 8: 40, 9: 40, 10: 50, 11: 50, 12: 60, 13: 60, 14: 70, 15: 70, 16: 80, 17: 80, 18: 90, 19: 90, 20: True.
- **Increment names:** each checked against its class table row: `monk-slow-fall-6` "Slow Fall 30 ft." (`monk.html:362`, "Bonus feat, slow fall 30 ft."); `monk-slow-fall-8` "Slow Fall 40 ft." (`monk.html:364`, "Slow fall 40 ft."); `monk-slow-fall-10` "Slow Fall 50 ft." (`monk.html:366`, "Bonus feat, ki pool (lawful), slow fall 50 ft."); and the other 5 likewise.
- **Record:** `description` on `description` (`7bf26bb0…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, because the body sits in other batches' committed fixtures (the protected and binding contexts of spells-530 to -536 and feats-350 to -355, among others); a Note would change the entry they hold. The imported entry is identical to the base import.
- **Notices:** PZO1110, each reviewed with no hold in force. PZO1110: Core Rulebook class feature Slow Fall and the rules it applies (granted by Monk).
- **Outstanding calculations** (never holds):
  - Slow fall distance, 20 ft. at 4th to any distance at 20th — owner #620. Falling damage is not a sheet statistic; the description and the increments' names state it.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #620. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset).
- **Binding:** content `20bf116c5254…`, from `buildAssessmentBinding` over the full-corpus preview of the final records. The parent's closure is the entry alone.

## Tests

[`class-abilities-620.test.ts`](../../tests/catalog/class-abilities-620.test.ts). The batch test uses the shared checks in [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts), generalised in this run (`describeIncrementParent`): the inventory and launch-subset statement; the pinned body, checked record, PRD lines, PCGen rows, Foundry associations and each increment's name against its class table from the shared store; a re-extraction with committed curation, the binding re-built, and the gate admitting the parent with exactly its increments (an edited body admits neither); and the batch's own rows. Each parent adds that it has no Note, its unmapped Foundry changes, its outstanding owners and its schedule formula. The committed preview is [`tests/fixtures/class-abilities-620/binding-preview.json`](../../tests/fixtures/class-abilities-620/binding-preview.json): the parents as entries, each closure the entry alone, and their increments.

## Preservation and gates

The shared files gain only this batch's rows: its description records, assessments and evidence entries. No Registry, `held-notices.json`, `notice-clearances.json` or `known-notice-holds.json` change. The commands and their results are in [class-abilities-631.md](class-abilities-631.md).
