# Companion features #505: pf1 companion-features batch 1

Reviewed by **Opus (AI curator) for the owner**, 2026-10-20.

Exactly the issue's 11 keys were reviewed, the whole pinned `companion-features` pack of Foundry PF1 v11.11: **8 admitted, 2 specifically held, 0 dependent omissions, 0 whole-entry unsupported/prose-only dispositions, 1 exclusion, 0 record-level 3.5 holds**. The pack holds the Familiar record, its nine familiar abilities and the folder that groups them. All ten records cite the Core Rulebook (`PZO1110` p.83). The importer maps them as companion supporting resources (`detail.kind: companionFeature`), not playable Catalog Entries ([README](README.md), companion sources; [global import contract](../character-sheet/global-catalog-import.md)).

The [machine-readable inventory and evidence](../../scripts/catalog/legal/companion-features-505.json) records, per key, the complete pinned body and inert fields with their source hash and cited sources; the PCGen Core Rulebook rows and leads; the inherited-rule notices, the linked bodies and their books; the companion review (granting record, master level, beneficiary, schedule and table); every checked curation record, source discrepancies and calculation gaps; and the current assessment binding and mapped facts. This report summarizes them and does not repeat the evidence.

## Family rulings (first batch of the family)

This is the family's first batch, so these choices are proposed as the family's precedent for review:

1. **Admission on Core Rulebook evidence.** A companion feature from the Core Rulebook is admitted when the pinned body matches a PCGen row filed under `SOURCELONG:Core Rulebook`, under the owner's Core Rulebook policy (2026-10-13, #735). The familiar rows live in PCGen's `core_essentials/ce_abilities_familiar_cr.lst` and `ce_companionmods_familiar_cr.lst`, which declare `SOURCELONG:Core Rulebook` (line 2), so they are book comparisons, unlike the Core Essentials race rows #387 treated as leads. Every ability body equals its row word for word, Share Spells' "master" for "wizard" aside.
2. **Unchained action costs hold.** A record whose bound closure keeps Unchained action-cost metadata requires the held `PZO1131` (#367's ruling). Its assessment is `confirmed` (the Core Rulebook content is fully compared); `PZO1131` has no reviewed Registry notice and its chain is held (`companion-features-505-notice-PZO1131-complete-chain`, registered), so the gate holds it ("Missing or unreviewed required notices: PZO1131") until #736 settles the notice. Earlier families marked such records `unresolved` because they also had whole-content holds; these have none.
3. **Statistics belong to the companion.** These resources carry rules text as Notes and no Modifiers. The familiar's statistics (natural armor, Intelligence, spell resistance, the master-derived Hit Dice, hit points, BAB, saves and skills) are calculated on the familiar's sheet by the familiar calculation (#326, `src/lib/character-sheet-familiar.ts`), so the imported `int`, `nac` and `spellResist` changes stay unmapped and nothing is applied twice. Alertness is the only master benefit; it stays a Note (see Outstanding mechanics).
4. **Master level is a progression fact, not a prerequisite.** Each ability records the master level the Familiar's `classAssociations` grant it at, checked against PCGen's `PREVARGTEQ:MasterLevel,<n>` rows and the table.
5. **Notes.** Every assessed record has a checked description record with one entry-level Note of its rule, Foundry `@UUID` links read as their names; Improved Evasion's description is covered by its context-note record. The Familiar's Foundry "Usage" paragraph is tool guidance, not CRB text, and is left out of its Note.
6. **Folder records** are excluded by the importer's folder contract, as in #387.
7. **#716 P7 does not overlap.** P7 lists Familiar as a non-class group, so it models the master classes' familiar-granting features (such as the wizard's arcane bond), not these abilities.

## Dispositions

| Key                    | Name                           | Master level | Disposition                                                                                                                      |
| ---------------------- | ------------------------------ | ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `pf1/B4tsrPOAtyEOmwAr` | Share Spells                   | 1            | admitted                                                                                                                         |
| `pf1/EbgtpUXqVup5iXeD` | Familiar                       | 1-20         | held: `PZO1131` unreviewed and held, `companion-features-505-notice-PZO1131-complete-chain` (closure: Scry on Familiar, scrying) |
| `pf1/GgqfqGq8vopOdN32` | Speak with Master              | 5            | admitted                                                                                                                         |
| `pf1/NY5BdmnNcdiNt1PL` | Familiar Features              | -            | excluded: Foundry `!folders!` record (folder exclusion contract)                                                                 |
| `pf1/OrbV3Q6U2BdnL8tR` | Spell Resistance               | 11           | admitted                                                                                                                         |
| `pf1/XttM5JcGilkhdFCW` | Deliver Touch Spells           | 3            | admitted                                                                                                                         |
| `pf1/YtzidlXTKvVyiNcY` | Empathic Link                  | 1            | admitted                                                                                                                         |
| `pf1/iYSmTvVIXZt2uMov` | Alertness                      | 1            | admitted                                                                                                                         |
| `pf1/mUPO7LpDVJtOoP4W` | Scry on Familiar               | 13           | held: `PZO1131` unreviewed and held, `companion-features-505-notice-PZO1131-complete-chain` (own Use action)                     |
| `pf1/ooxP3ifhV6kC0wTM` | Improved Evasion               | 1            | admitted                                                                                                                         |
| `pf1/yNMQccEicirDocG7` | Speak with Animals of Its Kind | 7            | admitted                                                                                                                         |

Every assessed record requires `PZO1110`; the two held records also require `PZO1131`. The `PZO1131` hold is registered in [`held-notices.json`](../../scripts/catalog/legal/held-notices.json).

## Notable cases

- **Familiar.** Its first four paragraphs equal PCGen's Core Rulebook `Arcane Bond ~ Familiar` DESC (`cr_abilities_class.lst:2578`, p.82); the Familiar Basics are supported by the companion mod (`ce_companionmods_familiar_cr.lst:4`: master BAB and saves, half the master's hit points, master skills, Hit Dice from master level) and the table by the natural armor and Intelligence rows (`ce_abilities_familiar_cr.lst:59-60`) and the schedule rows (`:47-55`). It links all nine abilities, so its closure reaches Scry on Familiar and the scrying spell, both with Unchained action costs: it is held on `PZO1131` and would also wait for the held Scry on Familiar. The comparison is partial (the class skill list has no PCGen row), recorded as such.
- **Scry on Familiar.** Its own Use action keeps `activation.unchained` (hour), as does the linked scrying spell (held by `spells-530-whole-content-g66w32kdup1f43bp`); held on `PZO1131`, and a dependent omission behind the scrying spell once that clears.
- **Alertness** links the admitted CRB Alertness feat (`pf1/Q1cY8r0Pvb66pMG0`), its only closure entry; the inherited rule requires `PZO1110` only.
- **Improved Evasion.** Foundry's context note "Evasion: Reflex halves becomes Reflex negates" omits half damage on a failed save. Its checked note record puts the body's complete rule on `save.ref` instead.
- **Spell Resistance.** The imported change (`spellResist` set to `5 + @class.level`), PCGen's `SR:mastervar("FamiliarLVL")+5` and the familiar calculation agree: master level + 5 from level 11 (16 to 25 through level 20).
- **Wording.** PCGen's Share Spells row says "The wizard"/"A wizard" where the pinned body says "The master" twice; Empathic Link's "communicate emphatically" is in both. Literal wording is recorded, not resolved.
- **Linked from outside.** Kineticist's Elemental Whispers (`pf1/poEUzzjCcYfWjEHA`, class-abilities, not yet assessed) links Alertness; its future assessment will bind this batch's Alertness resource.

## Importer and data gaps

- The Familiar's imported sources cite p.83 only; the general familiar rules are on p.82 (PCGen `SOURCEPAGE:p.82`). Recorded, not changed; no importer fix is needed.
- PCGen grants Speak with Animals of Its Kind only to an animal familiar (`PRERACE:1,RACESUBTYPE=Augmented Animal`); the body states no such limit. Recorded.

No importer or shared-loader code changed, and no gap for #738 or #739 arose.

## Outstanding mechanics

- **Alertness to the master** while the familiar is within arm's reach is not applied: no Grant from a familiar to its master's sheet exists and proximity is not tracked (the familiar calculation leaves proximity benefits to the player, [familiar calculations](../character-familiar-calculations.md)).
- **The 1-mile range** of the master benefits is not calculated.
- **Scry on Familiar's** once-per-day use and hour-long activation stay inert game content.
- Class-specific familiar rules (witch, improved familiars, familiar archetypes) are outside these records.

These are calculation gaps, not attribution holds.

## Companion validation

The Familiar's schedule (`classAssociations`: levels 1, 1, 1, 1, 3, 5, 7, 11, 13), table (natural armor +1 to +10, Intelligence 6 to 15) and imported formulas (`5 + ceil(level / 2)`, `ceil(level / 2)`) were checked against PCGen and against the familiar calculation through master level 20: at every level the calculation's natural armor, Intelligence, spell resistance and named special abilities equal what the batch's records state.

## Cross-batch bindings and protected records

A full-corpus closure scan over the base found **no landed assessment whose content closure reaches a batch key**, so no earlier assessment is re-bound. #534's `binding-preview.json` keeps a copy of Empathic Link among its resources (Share Senses names it as a supporting body), but Share Senses' description does not link it, so no #534 binding covers it; `cross-batch-bindings.test.ts` passes. Several earlier fixtures' `protected-context.json` files list Alertness, Share Spells or Empathic Link, but those tests check only catalog entries, not resources, and #749 retired the rest. None of the in-flight batches (#424, #425, #393, #716 P7-0) has a key in these closures.

## Binding

Assessments are bound with `buildAssessmentBinding` over a full-corpus `catalog:preview` of the final tree (the authority), so the Alertness feat and the scrying spell are bound as the whole corpus has them. The committed [preview fixture](../../tests/fixtures/companion-features-505/preview.json) holds the ten resources and that closure; the batch test reproduces every binding from a clean shared-store tree plus that fixture.

## Tests

- [`companion-features-505.test.ts`](../../tests/catalog/companion-features-505.test.ts): dispositions, notices and the registered hold; pinned bodies, overlay records and literal PCGen rows; the schedule and table through master level 20 against the public familiar calculation; the reviewed Notes on a familiar sheet (Improved Evasion on `save.ref`) with no statistic changed; re-extraction from a clean tree (the ten resources plus the Alertness feat and scrying spell, so every closure entry is accounted for), the admission gate (8 admitted, 2 held on `PZO1131`) and binding invalidation; batch ownership.
- [`companionFeatures505.integration.test.ts`](../../tests/catalog/companionFeatures505.integration.test.ts): an isolated saved wizard 1 with a linked cat familiar shows natural armor +1, Intelligence 6 and the four first-level abilities in both projections, the familiar sheet's character-scoped copies of Improved Evasion and Share Spells show their reviewed Notes, the client catalog preview matches, and an outsider is refused.

## Preservation and gates

The shared canonical files gain only this batch's entries, additions only: 11 curation records (10 description records and Improved Evasion's note record), 10 assessments, 10 evidence entries and one notice hold. No earlier row changed. Line counts against the base `76d629a0` (shared-store files omitted):

```text
 docs/catalog-import/companion-features-505.md          | new
 scripts/catalog/legal/companion-features-505.json      | new, 2917 lines
 scripts/catalog/legal/held-notices.json                |   +10
 scripts/catalog/reviewed-curation.json                 |  +205
 src/lib/catalog/data/attribution-assessments.json      |  +184
 src/lib/catalog/data/attribution-evidence.json         |   +30
 tests/catalog/companion-features-505.test.ts           | new, 547 lines
 tests/catalog/companionFeatures505.integration.test.ts | new, 226 lines
 tests/fixtures/companion-features-505/data.ts          | new, 155 lines
 tests/fixtures/companion-features-505/preview.json     | new, 606 lines
 tests/fixtures/companion-features-505/sheet.ts         | new, 107 lines
```

<!-- prep:shared-store-count -->
New shared-store files (`tests/fixtures/pinned/`), counted by prep after the rebase onto `6eaf7dd2`: **14** (pcgen 2, pf1 12).
<!-- /prep:shared-store-count -->

The batch adds to the shared store the eleven pinned companion-features records, the scrying spell its closure reaches and the two PCGen Core Essentials familiar files; the Alertness feat and the PCGen Core Rulebook class, feat and spell files were already on the base (as curated on `76d629a0`: 14 files, pf1 12 and pcgen 2).

The complete preview on the final tree reports **94 admitted, 23,160 held, 2 dependent omissions and 2,488 failures**, against 86, 23,168, 2 and 2,489 on the base: the eight admitted abilities, and one failure fewer (Improved Evasion's missing note record). No failure is added and none names a batch key. The full-corpus gate is therefore a documented failure, not a claim of whole-corpus readiness.

| Command                                                                                                                                  | Result                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `catalog:curate --candidates …` and `--descriptions` (prose pass)                                                                        | pass; 1 required draft (Improved Evasion's note), 2 prose drafts                                          |
| `catalog:preview --candidates …`                                                                                                         | exit 1; links to the Alertness feat and scrying spell fall outside the selection                          |
| Full `catalog:curate`                                                                                                                    | pass; 0 missing, none for this batch; 3 stale records on the base, no batch key; about 3 min              |
| Full `catalog:preview`                                                                                                                   | exit 1; 2,488 failures, none for this batch; 8 batch resources admitted, 2 held on `PZO1131`; about 7 min |
| Full bind (`buildAssessmentBinding` over the final full preview)                                                                         | 10 bound; 0 mismatches against the clean-tree reconstruction                                              |
| `pnpm test` of this batch's two files, `notice-holds`, `pinned-sources`, `cross-batch-bindings` and `batch-ownership-sweep` (one worker) | pass; 6 files / 151 tests                                                                                 |
| `pnpm -s typecheck`                                                                                                                      | pass (a first run failed on a test-file type cast, fixed and re-run)                                      |
| `pnpm -s lint`                                                                                                                           | pass                                                                                                      |
| `pnpm -s check:initial-migration-writers`                                                                                                | pass; 185 registrations                                                                                   |
| `pnpm catalog:pin`                                                                                                                       | pass; `sha256:005ef0b9…`                                                                                  |
| `pnpm catalog:notice-deps`                                                                                                               | pass; 0 gaps; 38 advisory warnings, none for this batch                                                   |
| `pnpm catalog:format --check`                                                                                                            | pass                                                                                                      |

`pnpm test tests/catalog` was left to the orchestrator's prep run on the rebased commit, as the brief directs.
