# Class abilities #607: AC Bonus (MNK) (MVP launch subset, #631 wave A)

MVP launch subset of #607: this inventory curates only pf1/4zVndIJ8NMWWzl1T (AC Bonus (MNK)); the ticket's other 99 keys stay remaining acceptance under #607. The 99 remaining keys are listed in the inventory's `launchSubset.remainingAcceptance` ([`class-abilities-607.json`](../../scripts/catalog/legal/class-abilities-607.json)) and stay this ticket's acceptance.

| Key                                   | Disposition | Assessment | Required notices | Increments | Evidence                               |
| ------------------------------------- | ----------- | ---------- | ---------------- | ---------- | -------------------------------------- |
| `pf1/4zVndIJ8NMWWzl1T` AC Bonus (MNK) | admitted    | confirmed  | PZO1110, PZO1131 | 10         | `class-abilities-607-4zVndIJ8NMWWzl1T` |

Its 10 increments (`everythingpath/monk-ac-bonus-12`, `everythingpath/monk-ac-bonus-16`, `everythingpath/monk-ac-bonus-20`, `everythingpath/monk-ac-bonus-4`, `everythingpath/monk-ac-bonus-8`, `everythingpath/unchained-monk-ac-bonus-12`, `everythingpath/unchained-monk-ac-bonus-16`, `everythingpath/unchained-monk-ac-bonus-20`, `everythingpath/unchained-monk-ac-bonus-4`, `everythingpath/unchained-monk-ac-bonus-8`) have no assessment of their own. Each has `attributionFrom: pf1/4zVndIJ8NMWWzl1T`, that upstream key and `detail.parentFeature`, so it takes this assessment, holds and notices and is admitted exactly when AC Bonus (MNK) is (`scripts/catalog/admission.ts`, `isAttributionOwner`).

## #631 wave A

This report belongs to #631 wave A (curation [#631](https://github.com/AndreasUnunger/EverythingPath/issues/631), increment parents wave A), which assesses ten class-feature parents across eight batches so that their 87 schedule increments admit with them. The run report is [class-abilities-631.md](class-abilities-631.md). Reviewer: Opus (AI curator) for the owner, 2026-11-04. Sources: pf1 v11.11 (`418761d2`), the PRD capture `prd-2026-10-20` and PCGen `25523dbc`. No book PDFs; Archives of Nethys not used.

## Evidence

### AC Bonus (MNK) (`pf1/4zVndIJ8NMWWzl1T`)

- **Body:** [`packs/class-abilities/ac-bonus-mnk.4zVndIJ8NMWWzl1T.yaml`](https://gitlab.com/foundryvtt_pathfinder1e/foundryvtt-pathfinder1/-/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/class-abilities/ac-bonus-mnk.4zVndIJ8NMWWzl1T.yaml) (sha256 `82374400e24a…`); Core Rulebook p. 57, Pathfinder Unchained p. 14.
- **PRD:** `coreRulebook/classes/monk.html:383,384`. AC Bonus (CRB): both paragraphs identical to the body after the heading.
- **PRD:** `unchained/classes/monk.html:406,407`. AC Bonus (Pathfinder Unchained): both paragraphs identical to the body; the PRD reads "AC and CMD" where the CRB reads "AC and his CMD", as the body does.
- **PCGen:** `pu_abilities_class.lst:460`. Pathfinder Unchained Unchained Monk ~ AC Bonus row: DESC reproduces both paragraphs; the CRB row summarises them.
- **PCGen:** `cr_abilities_class.lst:1095`. Core Rulebook Monk ~ AC Bonus row: DESC summarises the rule ("you add +%1 to your AC and your CMD").
- **Grant:** Granted at Monk level 1, Monk (Unchained) level 1: Foundry classAssociations; PCGen cr_abilities_class.lst:174, pu_abilities_class.lst:155. The reviewed schedule gives the later rows as increments.
- **Schedule through level 20:** AC and CMD bonus by monk level = floor(level / 4) besides the Wisdom bonus: +1 at 4th, +5 at 20th (PRD crbMonk :383 and the AC Bonus column of Table: Monk :357-376; PU :406 and Table 1-2 :375-394). Per level: 1: 0, 2: 0, 3: 0, 4: 1, 5: 1, 6: 1, 7: 1, 8: 2, 9: 2, 10: 2, 11: 2, 12: 3, 13: 3, 14: 3, 15: 3, 16: 4, 17: 4, 18: 4, 19: 4, 20: 5.
- **Increment names:** each checked against its class table row: `monk-ac-bonus-4` "AC Bonus +1" (`monk.html:360`, "+1"); `monk-ac-bonus-8` "AC Bonus +2" (`monk.html:364`, "+2"); `monk-ac-bonus-12` "AC Bonus +3" (`monk.html:368`, "+3"); and the other 7 likewise.
- **Record:** `description` on `description` (`e251cd05…`), checked, `outputs: []` (covered): the imported description states the rule. No Note, because the body sits in other batches' committed fixtures (the protected and binding contexts of spells-530 to -536 and feats-350 to -355, among others); a Note would change the entry they hold. The imported entry is identical to the base import.
- **Notices:** PZO1110, PZO1131, each reviewed with no hold in force. PZO1110: Core Rulebook class feature AC Bonus (MNK) and the rules it applies (granted by Monk, Monk (Unchained)). PZO1131: Pathfinder Unchained class feature AC Bonus (MNK) and the rules it applies (granted by Monk, Monk (Unchained)).
- **Outstanding calculations** (never holds):
  - Wisdom bonus plus floor(monk level / 4) to AC while unarmored and unencumbered (Foundry change on ac, imported unsupported) — owner #607. Unmapped target, condition and formula: Foundry's changes on ac and cmd import as unsupported `changes` and contribute nothing; the description states the rule.
  - The same bonus to CMD (Foundry change on cmd, imported unsupported) — owner #607. As above.
  - Loss of the bonuses when immobilized, helpless, armored, carrying a shield or a medium or heavy load — owner #607. The sheet has no armor/load condition for these Modifiers; the description states it.
  - Feature/option grants and conditions (the launch row's recorded-choice mechanism) — owner #607. The launch row keeps it outstanding: the feature option, eligibility, conditional grants and saved choices are not yet retained. Admission takes no calculation (precedent: the Fighter launch subset).
- **Source discrepancies** (recorded, not resolved):
  - Foundry names the body "AC Bonus (MNK)"; the PRD and PCGen name it "AC Bonus". Recorded, not resolved.
  - The body has a trailing space before its first `</p>`. Recorded; the text stays verbatim.
- **Binding:** content `78971eae049f…`, from `buildAssessmentBinding` over the full-corpus preview of the final records. The parent's closure is the entry alone.

## Tests

[`class-abilities-607.test.ts`](../../tests/catalog/class-abilities-607.test.ts). The batch test uses the shared checks in [`class-abilities-596.ts`](../../tests/catalog/class-abilities-596.ts), generalised in this run (`describeIncrementParent`): the inventory and launch-subset statement; the pinned body, checked record, PRD lines, PCGen rows, Foundry associations and each increment's name against its class table from the shared store; a re-extraction with committed curation, the binding re-built, and the gate admitting the parent with exactly its increments (an edited body admits neither); and the batch's own rows. Each parent adds that it has no Note, its unmapped Foundry changes, its outstanding owners and its schedule formula. The committed preview is [`tests/fixtures/class-abilities-607/binding-preview.json`](../../tests/fixtures/class-abilities-607/binding-preview.json): the parents as entries, each closure the entry alone, and their increments.

## Preservation and gates

The shared files gain only this batch's rows: its description records, assessments and evidence entries. No Registry, `held-notices.json`, `notice-clearances.json` or `known-notice-holds.json` change. The commands and their results are in [class-abilities-631.md](class-abilities-631.md).
