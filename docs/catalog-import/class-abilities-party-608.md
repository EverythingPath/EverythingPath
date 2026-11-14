# Class features for the party: the four #227 scripted-match holds

Reviewed by **Sol (AI curator) for the owner**, 2026-11-14.

Four class features held characters 1, 7, 10 and 13 out of the party release: Exchange Spell (Low), Exchange Spell (Medium), Grand Hex and Major Hex. Foundry gives none of them a book, no PCGen line has their name, and no stored assessment covered them, so [the #227 rule](curation.md#the-227-admission-rule) read each on its class association alone and held it (`association-only` in `attribution-227-matches.json`). Holding them also omitted their classes: Bard, Hunter, Mesmerist, Skald, Summoner and Summoner (Unchained) (Exchange Spell (Medium)), Bloodrager (Low) and Witch (both hexes).

Each row now has a confirmed, content-bound Attribution Assessment, in the form of the class-feature launch subsets (#596 runs A and B, #631 waves A and F1; Hex, `class-abilities-616.json`, is the nearest example). Every row's record goes into the inventory of the issue that owns its key in the launch inventory: #608 (batch 5), #618 (batch 15), #629 (batch 26) and #631 (batch 28). The batch uses #608's number, the lowest, as `item-abilities-party-502` did for its #502 and #503 keys. Every required book has a reviewed Registry notice and no hold, so no row needed anything from the owner.

## Rows and sources

PRD capture `prd-2026-10-20`, PCGen `25523dbc`, pf1 v11.11. No book PDFs; Archives of Nethys not used.

| Row (inventory) | Granted | Required notices | PRD | PCGen comparison |
| --- | --- | --- | --- | --- |
| Exchange Spell (Medium) `pf1/5lDEyC6WejFyTEho` (#608) | level 5 by Bard, Hunter, Inquisitor, Medium, Mesmerist, Occultist, Skald, Spiritualist, Summoner, Summoner (Unchained) | PZO1110, PZO1115, PZO1129, PZO1131, PZO1132 | `coreRulebook/classes/bard.html:408` (the body's wording, generalised); each class's own rule: hunter `:447`, skald `:449`, inquisitor `:410`, summoner `:410`, unchained summoner `:452`, medium `:409`, mesmerist `:411`, occultist `:389`, spiritualist `:411` | `pu_abilities_class.lst:729` (Unchained Summoner ~ Spells); lead `oa_abilities_class.lst:1273` (Spiritualist ~ Spells) |
| Grand Hex `pf1/IMhG1JjaWP6p9ORe` (#618) | Witch 18 | PZO1115 | `advancedPlayersGuide/baseClasses/witch.html:468`, word for word after the heading; table `:395` | `apg_abilities_class.lst:853` (`WitchGrandHexQualify\|(WitchLVL>=18)`); lead `:909` |
| Exchange Spell (Low) `pf1/XfN89DtlUrwHGNrp` (#629) | Bloodrager 8 | PZO1110, PZO1129 | `advancedClassGuide/classes/bloodrager.html:464` and `:443`; the sorcerer rule it applies, `coreRulebook/classes/sorcerer.html:413` | `acg_abilities_class.lst:339` (Bloodrager ~ Spells, the same sentence) |
| Major Hex `pf1/aZ5eCIRrsvax5CZZ` (#631) | Witch 10 | PZO1115 | `witch.html:450`, word for word after the heading; table `:387` | `apg_abilities_class.lst:853` (`WitchMajorHexQualify\|(WitchLVL>=10)`); lead `:900` |

- **Books.** The hexes take the witch's book (curation.md, notice guidance: witch hexes PZO1115). Exchange Spell (Low) takes the Bloodrager's book and the Core Rulebook, whose sorcerer rule its second sentence states (`bloodrager.html:464`: "This swap follows all the same rules as for a sorcerer"). Exchange Spell (Medium) states the rule for ten classes in five books and requires all five.
- **Recorded discrepancies, not resolved.** Both Exchange Spell bodies are Foundry's wording, not one printed paragraph. Hunter (`hunter.html:447`) and Medium print no "one level lower" clause, but the Medium body names only the Medium as an exception. None of the four records imports a source (an importer gap, reported).
- **Records.** Each row has a checked `description` record with `outputs: []`. No Note is added because the bodies sit in other batches' committed fixtures (feats-348, feats-350 to 355, spells-530 to 533), whose content a Note would change. Each row also has its assessment, its evidence `class-abilities-<n>-<id>`, its inventory candidate with `currentBinding`, and its entry in `tests/fixtures/class-abilities-<n>/binding-preview.json` (new for #608). The entries carry no curation output, so the full-corpus entries are unchanged.
- **Outstanding calculations** (never holds): the exchanges and hex picks themselves, and the launch row's recorded-choice mechanism, each with its issue.

## Labels

All four rows read **unverified**, and so do Bard, Bloodrager and Witch, which they release into the party: every party row the batch admits counts as unverified in the party status (character 1: +3, 10: +2, 13: +2; the verified counts don't move). The regenerated verification projection (`campaign-mvp-v1.verification.json`, `catalog:launch-inventory --verify --write`; `--verify --check` passes) has no mechanism proof for these rows, and the sheet calculates none of their rules.

## Preservation

- Shared files gain only this batch's rows: `reviewed-curation.json` 4 description records, `attribution-assessments.json` 4 assessments, `attribution-evidence.json` 4 entries. No Registry, `held-notices.json`, `notice-clearances.json`, `known-notice-holds.json` or `attribution-227.json` change.
- `attribution-227-matches.json` is regenerated (`catalog:attribution-227-matches --write`). Exactly these four records change, from `held` (`association-only`) to `matched` on their stored assessment. `attribution-227-matches.test.ts` now expects them matched; it keeps Wind Mystery and the Scar hex held. `launch-feature-grants.test.ts` lists the two Exchange Spell rows among the admitted parents that the structural checks alone would prove; the reviewed list refuses them, as it refuses the other twelve.
- The four inventories each gain one candidate, their launch-subset statement, curated keys, counts, notice requirements and comparison files. Four Occult Adventures class pages join the shared PRD store.
- **Full-corpus `catalog:preview --pcgen` before and after**, 23,655 entries and 538 resources. No entry changes. 15 rows change status:
  - The four rows go from held to admitted.
  - Eight classes go from dependent omissions to admitted: Bard, Bloodrager, Hunter, Mesmerist, Skald, Summoner, Summoner (Unchained) and Witch.
  - Inquisitor, Medium and Occultist stay omitted on their other cause only.
  - No admitted row loses admission. Admission goes from 18,647 / 5,317 / 160 / 784 to 18,659 admitted, 5,313 held, 152 dependent omissions and 784 failures. Required curation records are unchanged (2,985 checked, 697 missing).
- The calculation identity does not move (`catalog:pin`: `sha256:406caa62…`, the current one).

## Party status (`catalog:party-scope --status`)

| Character | Before: admitted / held / omitted | After |
| --- | --- | --- |
| 1 | 59 / 2 / 1 | 62 / 0 / 0 (race open) |
| 7 | 238 / 8 / 1 | 240 / 7 / 0 |
| 10 | 61 / 1 / 1 | 63 / 0 / 0 (Carefully Hidden unmatched) |
| 13 | 67 / 1 / 1 | 69 / 0 / 0, **ready** |

## Tests

[`class-abilities-party-608.test.ts`](../../tests/catalog/class-abilities-party-608.test.ts):

- Through the shared launch-subset checks (`describeLaunchFeature`), each row's inventory and statement, its pinned body, description record, PRD lines, PCGen rows and Foundry grants, its re-extraction and binding, and its own shared rows.
- On the release gate with the #227 rule and the committed data: each row is held on its class association alone at the base, and admitted on its assessment now.
- The committed scripted match lists each row on its stored assessment alone.
- With Bard, Bloodrager and Witch and their full-corpus closures (`tests/fixtures/class-abilities-party-608/dependents.json`): those classes are dependent omissions of exactly these rows at the base, and the whole closure is admitted now.

<!-- prep:shared-store-count -->
New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `9a60af27`: **4** (prd 4).
<!-- /prep:shared-store-count -->
