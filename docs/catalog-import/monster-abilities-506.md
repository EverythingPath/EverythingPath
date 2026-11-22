# Monster abilities #506: pf1 monster-abilities batch 1

Reviewed by **Opus (AI curator) for the owner**, 2026-10-21.

Exactly the issue's 42 keys were reviewed, the whole pinned pf1 `monster-abilities` pack: **0 admitted, 13 specifically held, 0 dependent omissions, 0 whole-entry unsupported/prose-only dispositions, 29 exclusions, 0 record-level 3.5 holds**. The exclusions are the pack's four Foundry `!folders!` records (Creature Subtypes, Creature Traits, Natural Attacks, Universal Monster Rules) and its 25 Universal Monster Rules records (`feat` items such as Darkvision, Scent and Grab), which the import contract leaves out of the Catalog Entries. The 13 held records are the attack items the importer admits: the 11 typed generic natural attacks, Swarm Attack and Unarmed Strike.

The [machine-readable inventory and evidence](../../scripts/catalog/legal/monster-abilities-506.json) records, per key, the complete pinned body with its source hash and cited sources. For the 13 attacks it also records the action and weapon fields, the gear review (each statistic against the pinned action, the mapped detail and the PCGen row where one exists), the Universal Monster Rules journal page or record each body links, the inherited-rule and Unchained notices, the checked description record, source discrepancies, calculation gaps, and the current assessment binding and mapped facts. For the 25 excluded records it also records the contract reason, the matching journal page and its books, the earliest book by PCGen publication date, and the earlier batches that cite the record. This report summarizes them and doesn't repeat the evidence.

## Family rulings (first batch of the family)

This is the family's first batch, so each choice below is proposed as the family's precedent for review.

1. **Universal Monster Rules records are excluded by contract.** PRD #251 Decision 17 imports "generic natural/unarmed attacks" from this pack, and the importer admits only the 12 generic natural attacks and the unarmed strike (`scripts/catalog/map.ts`, `naturalAttackIds` in `scripts/catalog/inventory.ts`; `docs/character-sheet/global-catalog-import.md`, Content). The other 25 `feat` records aren't Catalog Entries, so they get no Attribution Assessment, curation record or binding, as for folder records. Their DCs, ranges and frequencies stay with the records that grant them. Because earlier batches cite them as linked bodies, each excluded row records its cited books, its journal page and the **earliest book** the record or page lists. Earliest is decided by PCGen `SOURCEDATE` (pinned `.pcc` lines), which reproduces the settled table (#387, #541): darkvision PZO1127; low-light vision, scent, blindsense, amphibious, breath weapon, grab and poison PZO1112; blood drain, freeze, engulf and lifesense PZO1116; mistsight PZO1126 (Mythic Adventures, 2013-08, before Bestiary 4, 2013-10); ooze traits PZO1133.
2. **Natural attacks require the earliest Natural Attacks book.** Each natural attack links the Natural Attacks journal page (`8zivKFrhTVkbtjm3`), which lists PZO1137, PZO1112, PZO1116, PZO1120, PZO1127 and PZO1133. Its rules (primary and secondary attacks, Table 3-1) are inherited from PZO1112, Bestiary p.301 (as #387's "natural attacks PZO1112"). The page is recorded as `inheritedRuleSourceEvidence`. Swarm Attack cites PZO1112 p.313 and restates Distraction (also PZO1112). Unarmed Strike cites only PZO1110.
3. **PZO1131 on every attack (S-02, #736).** All 13 records keep `activation.unchained` on their own action, so each requires the held PZO1131. Each one's full-corpus closure is the entry alone; the set is pinned by key in the batch test.
4. **Holds.** The 11 typed natural attacks cite no source and are generic Foundry records (the linked table: "Individual creatures vary from this value"). PCGen encodes natural attacks only per creature, in `NATURALATTACKS` tokens, so no permitted source states them as definitions. Each is held with `uncited` and `broken-reference` (its Natural Attacks journal link is unresolved, so the gate fails it). Swarm Attack is held `whole-content`, since no permitted source states the swarm attack rules, and `broken-reference`, since its Distraction link names an excluded record. Unarmed Strike is held `whole-content`: PCGen's Core Rulebook rows (`cr_equip_arms_armor.lst:296`, `cr_profs_weapon.lst:14`, `:163`, `:202`, `:205`) support its statistics but state none of its body's rules, and PCGen types it `Natural`, against the body's "do not count as natural weapons".
5. **Description pass.** Every attack has exactly one checked description record (13). Its Notes are the body's own sentences, on `attack` or `damage`: the primary or secondary role (an attack sentence), Bite's and Claw's "whichever is most beneficial", Unarmed Strike's weapon-damage and not-a-natural-weapon rules, and Swarm Attack's rules, with its Hit Dice table restated row by row. Damage types, Medium dice, light handedness and the critical are already the mapped weapon detail. No attack has a Modifier, a required note, conditional or Item Ability record, or a shared Situation.

## Dispositions

One line per key. A held record's reason is its assessment rationale in the inventory, and a hold ID is `monster-abilities-506-<kind>-<id>`. The held notices omit PZO1110, which every attack requires and which has a reviewed Registry identity; each other code is held as `monster-abilities-506-notice-<code>-complete-chain`.

| Key                    | Name                    | Kind           | Disposition                                                                 | Held notices     |
| ---------------------- | ----------------------- | -------------- | --------------------------------------------------------------------------- | ---------------- |
| `pf1/3K2fqdRb27rEsoFF` | Amphibious              | UMR record     | excluded: import contract (UMR record); earliest book PZO1112               | —                |
| `pf1/szjeStouwI3F3WdP` | Bite                    | natural attack | held: `broken-reference-szjeStouwI3F3WdP`, `uncited-szjeStouwI3F3WdP`       | PZO1112, PZO1131 |
| `pf1/VkXlIb0zYsH4IDxz` | Blindsense              | UMR record     | excluded: import contract (UMR record); earliest book PZO1112               | —                |
| `pf1/aEP8PdxGohVVBkei` | Blindsight              | UMR record     | excluded: import contract (UMR record); earliest book PZO1112               | —                |
| `pf1/2L7pvHVWFGzx03n7` | Blood Drain             | UMR record     | excluded: import contract (UMR record); earliest book PZO1116               | —                |
| `pf1/bg2m81Euc7kGdiKN` | Breath Weapon           | UMR record     | excluded: import contract (UMR record); earliest book PZO1112               | —                |
| `pf1/1e5wGWxYWt0maxmB` | Channel Resistance      | UMR record     | excluded: import contract (UMR record); earliest book PZO1112               | —                |
| `pf1/MZnbCVzqpvPsMvfT` | Claw                    | natural attack | held: `broken-reference-MZnbCVzqpvPsMvfT`, `uncited-MZnbCVzqpvPsMvfT`       | PZO1112, PZO1131 |
| `pf1/tM956KLS078oZF72` | Construct Traits        | UMR record     | excluded: import contract (UMR record); earliest book PZO1112               | —                |
| `pf1/0rW9NwM4coxKB7uY` | Creature Subtypes       | folder         | excluded: folder record                                                     | —                |
| `pf1/9o23fjNC6Rsfvgm6` | Creature Traits         | folder         | excluded: folder record                                                     | —                |
| `pf1/abPQPu23CmkfWudq` | Darkvision              | UMR record     | excluded: import contract (UMR record); earliest book PZO1127               | —                |
| `pf1/WMwjQfyTC5BCoZlf` | Distraction             | UMR record     | excluded: import contract (UMR record); earliest book PZO1112               | —                |
| `pf1/SHWfLwmWwTLsj7B1` | Engulf                  | UMR record     | excluded: import contract (UMR record); earliest book PZO1116               | —                |
| `pf1/P3r81I2PlyyDXkzL` | Freeze                  | UMR record     | excluded: import contract (UMR record); earliest book PZO1116               | —                |
| `pf1/tbYOVRDBl2uywz2o` | Frightful Presence      | UMR record     | excluded: import contract (UMR record); earliest book PZO1112               | —                |
| `pf1/3xwmfkQBA3R0Cozz` | Gore                    | natural attack | held: `broken-reference-3xwmfkQBA3R0Cozz`, `uncited-3xwmfkQBA3R0Cozz`       | PZO1112, PZO1131 |
| `pf1/gliqmaokX6kcR9eU` | Grab                    | UMR record     | excluded: import contract (UMR record); earliest book PZO1112               | —                |
| `pf1/pX3qRL8U1wfBcH80` | Hoof                    | natural attack | held: `broken-reference-pX3qRL8U1wfBcH80`, `uncited-pX3qRL8U1wfBcH80`       | PZO1112, PZO1131 |
| `pf1/ZB6Insc46LaVWNvR` | Incorporeal             | UMR record     | excluded: import contract (UMR record); earliest book PZO1112               | —                |
| `pf1/phX8EpxPAJcIHBgh` | Lifesense               | UMR record     | excluded: import contract (UMR record); earliest book PZO1116               | —                |
| `pf1/5bPBXJUejJWDpy8J` | Light Sensitivity       | UMR record     | excluded: import contract (UMR record); earliest book PZO1112               | —                |
| `pf1/qe671ZP4ZsO5cbrt` | Low-Light Vision        | UMR record     | excluded: import contract (UMR record); earliest book PZO1112               | —                |
| `pf1/OKY6UCDtXsYdJr6e` | Mistsight               | UMR record     | excluded: import contract (UMR record); earliest book PZO1126               | —                |
| `pf1/xPJd6syoxDiunnzG` | Natural Attacks         | folder         | excluded: folder record                                                     | —                |
| `pf1/qn38rtalurmHx9qq` | Ooze Traits             | UMR record     | excluded: import contract (UMR record); earliest book PZO1133               | —                |
| `pf1/iMix2jm1eh8V6cCN` | Pincer                  | natural attack | held: `broken-reference-iMix2jm1eh8V6cCN`, `uncited-iMix2jm1eh8V6cCN`       | PZO1112, PZO1131 |
| `pf1/ra81MI6i0wltb32x` | Plant Traits            | UMR record     | excluded: import contract (UMR record); earliest book PZO1112               | —                |
| `pf1/R4HTn8pmyiBaMTC5` | Poison                  | UMR record     | excluded: import contract (UMR record); earliest book PZO1112               | —                |
| `pf1/ePCw9eVAidI9uc5I` | Scent                   | UMR record     | excluded: import contract (UMR record); earliest book PZO1112               | —                |
| `pf1/GrbQIXcmp5VXxYA7` | Slam                    | natural attack | held: `broken-reference-GrbQIXcmp5VXxYA7`, `uncited-GrbQIXcmp5VXxYA7`       | PZO1112, PZO1131 |
| `pf1/cuOCNj2vlx0Q1X3J` | Sting                   | natural attack | held: `broken-reference-cuOCNj2vlx0Q1X3J`, `uncited-cuOCNj2vlx0Q1X3J`       | PZO1112, PZO1131 |
| `pf1/qP52Vv8OelEql6Oq` | Swarm Attack            | swarm attack   | held: `broken-reference-qP52Vv8OelEql6Oq`, `whole-content-qP52Vv8OelEql6Oq` | PZO1112, PZO1131 |
| `pf1/C038e1sCQAzYqC6A` | Swarm traits            | UMR record     | excluded: import contract (UMR record); earliest book PZO1112               | —                |
| `pf1/ogIJ8XWiWFlJIF6S` | Tail Slap               | natural attack | held: `broken-reference-ogIJ8XWiWFlJIF6S`, `uncited-ogIJ8XWiWFlJIF6S`       | PZO1112, PZO1131 |
| `pf1/PfmCJRQ9qOgwcUxb` | Talon                   | natural attack | held: `broken-reference-PfmCJRQ9qOgwcUxb`, `uncited-PfmCJRQ9qOgwcUxb`       | PZO1112, PZO1131 |
| `pf1/5gG3V7rB4Q7LoBFT` | Tentacle                | natural attack | held: `broken-reference-5gG3V7rB4Q7LoBFT`, `uncited-5gG3V7rB4Q7LoBFT`       | PZO1112, PZO1131 |
| `pf1/LdUxqwe1uKw5DVNS` | Trip                    | UMR record     | excluded: import contract (UMR record); earliest book PZO1112               | —                |
| `pf1/1sU57tRb1My6XZMC` | Unarmed Strike          | unarmed strike | held: `whole-content-1sU57tRb1My6XZMC`                                      | PZO1131          |
| `pf1/kcCRPAHsrWouTbij` | Undead Traits           | UMR record     | excluded: import contract (UMR record); earliest book PZO1112               | —                |
| `pf1/ks1gs7KC2CO3U9hN` | Universal Monster Rules | folder         | excluded: folder record                                                     | —                |
| `pf1/h9ogVoyFP7qMBJhg` | Wing                    | natural attack | held: `broken-reference-h9ogVoyFP7qMBJhg`, `uncited-h9ogVoyFP7qMBJhg`       | PZO1112, PZO1131 |

## Notable cases

- **Every natural attack fails the gate on the base and here.** The body's "see: Natural Attacks (UMR)" is a journal-page `@UUID` link, which the importer strips and the gate treats as a broken reference. This is #738's class of gap: unresolved journal-page links.
- **Swarm Attack** links Distraction (`pf1/WMwjQfyTC5BCoZlf`). That record exists in the pinned pack but is excluded by the import contract, so the link can never resolve while the contract stands (see Importer and data gaps). Its action formula, `(ceil(@attributes.hd.total / 5))d6`, has no fixed dice: the mapped detail has none, and the formula gives 6d6 at 26 or more Hit Dice, where the body's table stops at 5d6.
- **Unarmed Strike** is the one attack without a stripped link. It is held on its own content (`whole-content`) and would still be held on PZO1131 if confirmed; the batch test shows both. Foundry also lists the tribal weapon group, which no PCGen row gives it.
- **Upstream copy slips** are recorded, not resolved. Gore's body says "This is typical bite attack". Pincer's action keeps the slam's `_id` and tag, and its baseTypes is "Pincers". Talon is "Talons" in the table, and Bite's sentence ends "whichever is most beneficial one" (kept verbatim).
- **Blindsight's** record cites PZO1112 p.302 and the like, while its journal page cites blindsense's pages (PZO1112 p.298 and so on). Swarm traits has no journal page. Both are recorded on the excluded rows.

## Importer and data gaps

- **Journal-page links (#738).** All 11 typed natural attacks link `Compendium.pf1.pf1e-rules.nBnUY0koBzXqoEft.JournalEntryPage.8zivKFrhTVkbtjm3`. Reproduction: `catalog:preview --candidates` over the batch keys reports `description.link` unsupported on each entry and "Broken structure or reference: unresolved imported reference.", on the base and here.
- **Links to contract-excluded records (new gap, no owning ticket).** `packs/monster-abilities/swarm-attack.qP52Vv8OelEql6Oq.yaml` links `@UUID[Compendium.pf1.monster-abilities.Item.WMwjQfyTC5BCoZlf]` (Distraction). The record is pinned, but `classifyRecord` excludes it, so the link is stripped and the gate fails Swarm Attack. It is not an item reference missing from a pack, and #738 covers spells and journals; a follow-up should decide whether such links render as text.
- **No natural attack type or role (new gap, no owning ticket).** The imported weapon detail of a natural attack has no `naturalAttack` (type or role), although Foundry marks the secondary ones (`naturalAttack.primary: false` on Hoof, Pincer, Tail Slap, Tentacle and Wing). An imported natural attack therefore isn't calculated as primary or secondary from its catalog entry. The reviewed Note states the role, and the sheet's own natural attack profiles (Bestiary p.301), which agree with every body, calculate natural attacks a player adds. Reproduction: any natural attack entry in `catalog.json` of a bounded preview lacks `detail.weapon.naturalAttack`. `docs/character-sheet/attacks.md` says the type "is written from the rules", which the import doesn't do.
- **Unarmed strike's nonlethal damage.** The action's `nonlethal: true` isn't mapped; the sheet's built-in unarmed strike supplies 1d3 nonlethal.

No importer or shared-loader code changed. No spell metadata or prerequisite gap (#738, #739) arose apart from the journal links.

## Outstanding mechanics

These are calculation gaps, not attribution holds:

- the primary or secondary role of an imported natural attack, and the choice of the most beneficial damage type (Bite, Claw);
- natural attack dice at sizes other than Medium, from the catalog entry;
- swarm damage by Hit Dice, automatic damage without an attack roll, distraction (nauseated, Fortitude DC 10 + 1/2 HD + Con modifier), the caster level check and the Will save;
- whether a weapon-damage bonus applies to unarmed strikes, and unarmed strike's nonlethal damage from the catalog entry.

## Cross-batch bindings and protected records

A full-corpus closure scan over the base found no entry whose description or detail links a batch key: each attack's content closure is the entry alone, and no landed assessment's closure reaches a batch key (`xcheck` over all assessments: none). Earlier batches cite the excluded Universal Monster Rules records and some attacks in their evidence, and in raw `links.supplements` values kept in `unsupported` (Bite in the #387 to #396 racial traits, #548 and #355 fixtures). These aren't catalog references, and excluded records have no entry. So no landed assessment is re-bound, and no earlier batch's fixture changes. No batch key appears in any earlier batch's `protected-context.json`, `binding-preview.json`, `preserved.json` or `provenance.json` as a curated root: only Blood Drain's key appears there, as cited evidence in #530 to #536's protection lists, and it is excluded with no entry. The batches in flight (#398 racial traits, #429 weapons, #716 P7c) have no key in these closures.

## Binding

Assessments are bound with `buildAssessmentBinding` against the full-corpus content closure: the full `catalog:preview` of the base, with the batch's 13 entries taken from the bounded preview of the merged overlay. Each closure is the entry alone, so the final full-corpus preview reproduces the same entries (checked in the gates below). The committed [preview fixture](../../tests/fixtures/monster-abilities-506/preview.json) holds the 13 entries and an empty closure. The batch test reproduces every binding from a clean shared-store tree plus that fixture.

## Tests

- [`monster-abilities-506.test.ts`](../../tests/catalog/monster-abilities-506.test.ts) checks:
  - the counts and dispositions, and that the 13 assessed keys are exactly the importer's `naturalAttackIds`;
  - the named holds;
  - each natural attack's mapped dice, damage types and critical, against the body and the sheet's natural attack profile;
  - the role Note on every natural attack, with no mapped role;
  - Swarm Attack's and Unarmed Strike's Notes;
  - that every Note is the body's own sentence;
  - the notices, holds and the Unchained set by key;
  - the earliest books of the excluded records against PCGen `SOURCEDATE`;
  - the pinned bodies, the journal page and the literal PCGen rows;
  - the re-extraction from a clean tree: 12 gate failures, Unarmed Strike held, held on PZO1131 when confirmed and invalidated by a changed Note;
  - binding reproduction and batch ownership.
- [`monsterAbilities506.integration.test.ts`](../../tests/catalog/monsterAbilities506.integration.test.ts) covers:
  - an isolated saved sheet with Strength 14 attacking with character-scoped copies of the held Bite and Tail Slap. A test-only adapter names the natural attack type the importer omits. The bite alone is primary (+2, 1d6+3); with the tail slap, the bite is primary (+2, 1d6+2) and the tail slap secondary (−3, 1d6+1). The reviewed Notes reach the saved definition, the client preview matches, and outsiders, anonymous callers and another campaign's entry are refused;
  - an isolated release of the held Unarmed Strike, which publishes no definition and requires no notice.

## Preservation and gates

The shared canonical files gain only this batch's entries: 13 description records, 13 assessments, 13 evidence entries and 2 notice holds (`monster-abilities-506-notice-PZO1112-complete-chain`, `-PZO1131-complete-chain`). No earlier row changes, and `reviewed-change-replacements.ts` is untouched. Diff stat against the base `5a50978b`, shared-store files omitted:

```text
docs/catalog-import/monster-abilities-506.md                 | new
scripts/catalog/legal/held-notices.json                      |  +20
scripts/catalog/legal/monster-abilities-506.json             | new, 7073 lines
scripts/catalog/reviewed-curation.json                       | +298
src/lib/catalog/data/attribution-assessments.json            | +284
src/lib/catalog/data/attribution-evidence.json               |  +39
tests/catalog/cross-batch-bindings.ts                        |   +5 (one dangling-link row)
tests/catalog/monster-abilities-506.test.ts                  | new
tests/catalog/monsterAbilities506.integration.test.ts        | new
tests/fixtures/monster-abilities-506/data.ts                 | new
tests/fixtures/monster-abilities-506/preview.json            | new, 1058 lines
```

<!-- prep:shared-store-count -->
New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `a9dfa472`: **33** (pcgen 6, pf1 27).
<!-- /prep:shared-store-count -->

The batch adds to the shared store, as curated on `5a50978b`, the 27 pinned monster-abilities records the store lacked: 12 of the attacks, the four folders and 11 excluded records. The other 15, among them Swarm Attack and Distraction, were on the base. It also adds PCGen `core_rulebook/cr_profs_weapon.lst` and the Bestiary, Bestiary 3, 4, 5 and 6 `.pcc` files, whose `SOURCEDATE` lines date the books. The Universal Monster Rules journal, `cr_equip_arms_armor.lst`, `bestiary_2.pcc` and `_mythic_adventures.pcc` were already on the base.

The final full-corpus preview reported **103 admitted, 23,148 held, 5 dependent omissions and 2,194 failures**, the same counts as the base `5a50978b`, with the same failure set. For the batch it reported 0 admitted, 1 held (Unarmed Strike) and 12 failures (the linked attacks), as on the base, where Unarmed Strike was held for lack of an assessment. The committed fixture's 13 entries equal the final preview's.

| Command                                                                                                                                                                                                           | Result                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `catalog:curate --candidates …` and `--descriptions` (prose pass)                                                                                                                                                 | pass; 0 required records and 0 prose candidates drafted; a rerun against the overlay: 13 description records checked, 0 missing, 0 stale               |
| `catalog:preview --candidates …`                                                                                                                                                                                  | exit 1 (12 gate failures on the stripped links, as on the base); 0 missing curation                                                                    |
| Full `catalog:curate`                                                                                                                                                                                             | pass; 0 missing; 4 stale records, no batch key; about 3 min                                                                                            |
| Full `catalog:preview`                                                                                                                                                                                            | exit 1; 2,194 failures, unchanged from the base, 12 of them batch keys (above); about 4 min                                                            |
| Bind (`buildAssessmentBinding` over the full-corpus closure)                                                                                                                                                      | 13 bound; closures are self-only; 0 mismatches against the clean-tree reconstruction; no landed assessment re-bound                                    |
| `pnpm test` of this batch's two files, `notice-holds`, `pinned-sources`, `cross-batch-bindings`, `batch-ownership-sweep`, and `feats-350`, `spells-530`, `spells-534` (whose historical context lists batch keys) | pass; 9 files / 225 tests. The first run failed `cross-batch-bindings` on Swarm Attack's Distraction link; fixed with the dangling-link row and re-run |
| `pnpm -s typecheck`                                                                                                                                                                                               | pass (the first runs failed on the integration test's typing, fixed and re-run)                                                                        |
| `pnpm -s lint`                                                                                                                                                                                                    | pass (the first run failed on an unused constant in the batch test, fixed and re-run)                                                                  |
| `pnpm -s check:initial-migration-writers`                                                                                                                                                                         | pass; 185 registrations                                                                                                                                |
| `pnpm catalog:pin`                                                                                                                                                                                                | pass; `sha256:005ef0b9…`                                                                                                                               |
| `pnpm catalog:notice-deps`                                                                                                                                                                                        | pass; 0 gaps; 39 advisory warnings, none for this batch                                                                                                |
| `pnpm catalog:format --check`                                                                                                                                                                                     | pass                                                                                                                                                   |

`pnpm test tests/catalog` was left to the orchestrator's prep run on the rebased commit, as the brief directs.

**Test tool change.** `tests/catalog/cross-batch-bindings.ts` lists stripped links whose target never becomes a catalog entry (`danglingCatalogLinks`). This batch adds the Distraction row, as #397 added Freeze's: Swarm Attack's link into the mapped `monster-abilities` pack names a record the import contract excludes. Without the row, the coverage check counts it as an uncommitted closure dependency.
