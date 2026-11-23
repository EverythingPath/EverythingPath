# Racial traits #402: Languages (Dwarf), Elven Immunities (Half-Elf), +2 to One Ability Score (Half-Elf), Fearless (Halfling) (MVP launch subset, #328 S4-A and S4-B)

MVP launch subset of #402: this inventory curates only pf1-content/rBKJCVwy3X2VjFdU, pf1-content/oTQL4P3IdoJQAkOB, pf1-content/orOAYDkNl4pqYWA4, pf1-content/qoCLqjadKmJEN9R7 (S4-A added the first, S4-B the rest); the ticket's other 96 keys stay remaining acceptance under #402 (its core-race required alternates go to run C). The 96 remaining keys are listed in `launchSubset.remainingAcceptance` ([`racial-traits-402.json`](../../scripts/catalog/legal/racial-traits-402.json)). `launchSubset.s4bKeys` is now empty; `launchSubset.runCRequiredAlternates` (1) are core-race alternates for run C.

| Key                                                               | Disposition | Assessment | Required notices          | Evidence                             |
| ----------------------------------------------------------------- | ----------- | ---------- | ------------------------- | ------------------------------------ |
| `pf1-content/rBKJCVwy3X2VjFdU` Languages (Dwarf)                  | admitted    | confirmed  | PZO9280, PZO1121, PZO1110 | `racial-traits-402-rBKJCVwy3X2VjFdU` |
| `pf1-content/oTQL4P3IdoJQAkOB` Elven Immunities (Half-Elf)        | admitted    | confirmed  | PZO9280, PZO1121, PZO1110 | `racial-traits-402-oTQL4P3IdoJQAkOB` |
| `pf1-content/orOAYDkNl4pqYWA4` +2 to One Ability Score (Half-Elf) | admitted    | confirmed  | PZO9280, PZO1121, PZO1110 | `racial-traits-402-orOAYDkNl4pqYWA4` |
| `pf1-content/qoCLqjadKmJEN9R7` Fearless (Halfling)                | admitted    | confirmed  | PZO9280, PZO1121, PZO1110 | `racial-traits-402-qoCLqjadKmJEN9R7` |

## #328 S4-B

S4-B of [#328](https://github.com/AndreasUnunger/EverythingPath/issues/328), the CRB core races Half-Elf, Elf, Gnome and Halfling, extends this inventory with Elven Immunities (Half-Elf), +2 to One Ability Score (Half-Elf), Fearless (Halfling); S4-A's rows are unchanged. The run report is the [S4-B section of races-328.md](races-328.md#s4-b-launch-half-elf-elf-gnome-and-halfling). Reviewer: Sol (AI curator) for the owner, 2026-11-01. Sources: pf1-content 11.4.0 (`02f4ab0d`), the PRD capture `prd-2026-10-20` (Advanced Race Guide race pages) and PCGen `25523dbc` (Core Essentials race-ability rows). No book PDFs; Archives of Nethys not used.

### Evidence (S4-B rows)

- **Elven Immunities (Half-Elf)** (`pf1-content/oTQL4P3IdoJQAkOB`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/halfElves.html:370`) apart from "get" for "gain"; no "saving throw"; an added "on saving throws"; PCGen's Core Essentials row (`half_elf/halfelf_abilities_race.lst:24`) with the recorded DESC differences. Its Modifier is +2 racial on saves in the shared Situation enchantment, with the Note "Immune to magic sleep effects." (re-homed from the Half-Elf's checked note record). Required notices: PZO9280, PZO1121, PZO1110. Outstanding: Immunity to magic sleep effects is a permitted Note; no immunity statistic.
- **+2 to One Ability Score (Half-Elf)** (`pf1-content/orOAYDkNl4pqYWA4`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/halfElves.html:364`) apart from "get" for "gain"; PCGen's Core Essentials row (`half_elf/halfelf_abilities_race.lst:18`) word for word. Its Modifier is ability.$choice +2 racial: the player picks the score on the sheet. Required notices: PZO9280, PZO1121, PZO1110.
- **Fearless (Halfling)** (`pf1-content/qoCLqjadKmJEN9R7`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/halflings.html:367`) word for word; PCGen's Core Essentials row (`halfling/halfling_abilities_race.lst:21`) word for word. Its Modifier is +2 racial on saves in the shared Situation fear, marked stacksWithinEntry (re-homed from the Halfling's checked note record), so it adds to Halfling Luck's +1 as the body says. Required notices: PZO9280, PZO1121, PZO1110.

### Records

- Elven Immunities (Half-Elf): `description` on `description` (`57842913…`), checked, `outputs: []`.
- +2 to One Ability Score (Half-Elf): `description` on `description` (`5d4cc26c…`), checked, `outputs: []`.
- Fearless (Halfling): `description` on `description` (`9e73c177…`), checked, `outputs: []`.

The description pass adds no Note: the body is the readable rule and stays the entry's description, so the imported entry is unchanged and no content binding moves (the curated full-corpus preview's 23,630 entries equal the base preview's byte for byte). Each record exists because every candidate of a swept inventory needs exactly one description record (`tests/catalog/batch-ownership.ts`).

### Attribution

**Elven Immunities (Half-Elf).** Complete standard racial trait of the Half-Elf (CRB p. 24, ARG p. 40, Inner Sea Races p. 237) compared in full by #328 S4-B (CRB core races Half-Elf, Elf, Gnome, Halfling): the PRD Advanced Race Guide paragraph (advancedRaceGuide/coreRaces/halfElves.html:370, capture prd-2026-10-20) differs in 3 recorded place(s) ("get" for "gain"; no "saving throw"; added "on saving throws"), recorded, not resolved; PCGen's Core Essentials row (half_elf/halfelf_abilities_race.lst:24) states the same rule (2 recorded wording or variable difference(s): "" for "saving throw"; "on saving throws" for ""). Every statement of the body is in one or both. Its Modifier is +2 racial on saves in the shared Situation enchantment, with the Note "Immune to magic sleep effects." (re-homed from the Half-Elf's checked note record). Required notices: PZO1110 (the reviewed Core Rulebook notice); PZO1121 (its Registry notice's hold notice-264-complete-chain-457075cc… is cleared, notice-clearances.json, owner 2026-10-30); PZO9280 (the reviewed PCGen confirmation section15-confirmations-716.json#PZO9280, matched and checked 2026-10-31).

**+2 to One Ability Score (Half-Elf).** Complete standard racial trait of the Half-Elf (CRB p. 24, ARG p. 40, Inner Sea Races p. 237) compared in full by #328 S4-B (CRB core races Half-Elf, Elf, Gnome, Halfling): the PRD Advanced Race Guide paragraph (advancedRaceGuide/coreRaces/halfElves.html:364, capture prd-2026-10-20) differs in 1 recorded place(s) ("get" for "gain"), recorded, not resolved; PCGen's Core Essentials row (half_elf/halfelf_abilities_race.lst:18) states the same rule word for word. Every statement of the body is in one or both. Its Modifier is ability.$choice +2 racial: the player picks the score on the sheet. Required notices: PZO1110 (the reviewed Core Rulebook notice); PZO1121 (its Registry notice's hold notice-264-complete-chain-457075cc… is cleared, notice-clearances.json, owner 2026-10-30); PZO9280 (the reviewed PCGen confirmation section15-confirmations-716.json#PZO9280, matched and checked 2026-10-31).

**Fearless (Halfling).** Complete standard racial trait of the Halfling (CRB p. 26, ARG p. 60, Inner Sea Races p. 238) compared in full by #328 S4-B (CRB core races Half-Elf, Elf, Gnome, Halfling): the PRD Advanced Race Guide paragraph (advancedRaceGuide/coreRaces/halflings.html:367, capture prd-2026-10-20) matches the pinned body word for word; PCGen's Core Essentials row (halfling/halfling_abilities_race.lst:21) states the same rule word for word. Every statement of the body is in one or both. Its Modifier is +2 racial on saves in the shared Situation fear, marked stacksWithinEntry (re-homed from the Halfling's checked note record), so it adds to Halfling Luck's +1 as the body says. Required notices: PZO1110 (the reviewed Core Rulebook notice); PZO1121 (its Registry notice's hold notice-264-complete-chain-457075cc… is cleared, notice-clearances.json, owner 2026-10-30); PZO9280 (the reviewed PCGen confirmation section15-confirmations-716.json#PZO9280, matched and checked 2026-10-31).

### Outstanding mechanics

- Elven Immunities (Half-Elf): Immunity to magic sleep effects is a permitted Note; no immunity statistic.

Calculations stay outstanding with their owners, never attribution holds.

### Source discrepancies

- Elven Immunities (Half-Elf): The pinned body reads "get"; the PRD ARG paragraph reads "gain".
- Elven Immunities (Half-Elf): The pinned body has no "saving throw" where the PRD ARG paragraph has it.
- Elven Immunities (Half-Elf): The pinned body adds "on saving throws" where the PRD ARG paragraph has none.
- +2 to One Ability Score (Half-Elf): The pinned body reads "get"; the PRD ARG paragraph reads "gain".

Recorded, not resolved.

### Cross-batch bindings and protected records

Each trait's own content closure is the entry alone (`collectReferences` is empty). Its race's closure contains it, so the race's assessment ([races-328.json](../../scripts/catalog/legal/races-328.json)) binds it; that assessment is written in the same change. The new description records add no output, so no other batch's binding moves.

### Binding

`currentBinding` and the assessment come from `buildAssessmentBinding` over the curated full-corpus `catalog:preview`. The committed [`tests/fixtures/racial-traits-402/preview.json`](../../tests/fixtures/racial-traits-402/preview.json) holds the full-corpus entries.

### Tests

[`racial-traits-402.test.ts`](../../tests/catalog/racial-traits-402.test.ts) checks each body against its checked description record, the PRD ARG paragraph (with its exact word differences) and the PCGen row from the shared store; the pinned record's bytes against the pinned pf1-content checkout when present (the trait records are not in the shared store); the gate over the committed entries and their closure, with the binding rebuilt and a changed body refused; and the traits' mechanics. [`batch-ownership-sweep.test.ts`](../../tests/catalog/batch-ownership-sweep.test.ts) checks the batch's own rows.

### Preservation and gates

The shared files gain only the batch's S4-B entries: 3 description records, 3 assessments and 3 evidence entries. No Registry, `held-notices.json`, `notice-clearances.json` or `section15-confirmations-716.json` change. This inventory adds nothing to the shared store; [races-328.md](races-328.md#s4-b-launch-half-elf-elf-gnome-and-halfling) carries the count and the checks.

## #328 S4-A

This report belongs to S4-A of [#328](https://github.com/AndreasUnunger/EverythingPath/issues/328), the CRB core races Human, Dwarf and Half-Orc; the run report is the [S4-A section of races-328.md](races-328.md#s4-a-launch-human-dwarf-and-half-orc). Reviewer: Sol (AI curator) for the owner, 2026-11-01. Sources: pf1-content 11.4.0 (`02f4ab0d`), the PRD capture `prd-2026-10-20` (Advanced Race Guide race pages) and PCGen `25523dbc` (Core Essentials race-ability rows). No book PDFs; Archives of Nethys not used.

## Evidence

- **Languages (Dwarf)** (`pf1-content/rBKJCVwy3X2VjFdU`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/dwarves.html:371`) apart from an added "languages"; PCGen's Core Essentials row (`dwarf/dwarf_abilities_race.lst:29`). Languages (Common and Dwarven; the bonus-language list) stay readable prose; the record's languages field stays in gameContent. Required notices: PZO9280, PZO1121, PZO1110. Outstanding: Languages are permitted prose; no language statistic.

## Records

- Languages (Dwarf): `description` on `description` (`1cdc67bb…`), checked, `outputs: []`.

The description pass adds no Note: the body is the readable rule and stays the entry's description, so the imported entry is unchanged and no content binding moves (the curated full-corpus preview's entries equal the base preview's). The record exists because every candidate of a swept inventory needs exactly one description record (`tests/catalog/batch-ownership.ts`).

## Attribution

**Languages (Dwarf).** Complete standard racial trait of the Dwarf (CRB p. 21, ARG p. 10, Inner Sea Races p. 236) compared in full by #328 S4-A (CRB core races Human, Dwarf, Half-Orc): the PRD Advanced Race Guide paragraph (advancedRaceGuide/coreRaces/dwarves.html:371, capture prd-2026-10-20) differs in 1 recorded place(s) (added "languages"), recorded, not resolved; PCGen's Core Essentials row (dwarf/dwarf_abilities_race.lst:29) states the same rule. Languages (Common and Dwarven; the bonus-language list) stay readable prose; the record's languages field stays in gameContent. Required notices: PZO1110 (the reviewed Core Rulebook notice); PZO1121 (its Registry notice's hold notice-264-complete-chain-457075cc… is cleared, notice-clearances.json, owner 2026-10-30); PZO9280 (the reviewed PCGen confirmation section15-confirmations-716.json#PZO9280, matched and checked 2026-10-31).

## Outstanding mechanics

- Languages are permitted prose; no language statistic.

Calculations stay outstanding with their owners, never attribution holds.

## Source discrepancies

- Languages (Dwarf): The pinned body adds "languages" where the PRD ARG paragraph has none.

Recorded, not resolved.

## Cross-batch bindings and protected records

The trait's own content closure is the entry alone (`collectReferences` is empty). Its race's closure contains it, so the race's assessment (Dwarf, [races-328.json](../../scripts/catalog/legal/races-328.json)) binds it; that assessment is written in the same change. The new description record adds no output, so no other batch's binding moves.

## Binding

`currentBinding` and the assessment come from `buildAssessmentBinding` over the curated full-corpus `catalog:preview`. The committed [`tests/fixtures/racial-traits-402/preview.json`](../../tests/fixtures/racial-traits-402/preview.json) holds the full-corpus entry.

## Tests

[`racial-traits-402.test.ts`](../../tests/catalog/racial-traits-402.test.ts) checks each body against its checked description record, the PRD ARG paragraph (with its exact word differences) and the PCGen row from the shared store; the pinned record's bytes against the pinned pf1-content checkout when present (the trait records are not in the shared store); the gate over the committed entry, with the binding rebuilt and a changed body refused; and the trait's mechanics. [`batch-ownership-sweep.test.ts`](../../tests/catalog/batch-ownership-sweep.test.ts) checks the batch's own rows.

## Preservation and gates

The shared files gain only the batch's entries: 1 description record, 1 assessment and 1 evidence entry. No Registry, `held-notices.json`, `notice-clearances.json` or `section15-confirmations-716.json` change. This inventory adds nothing to the shared store; [races-328.md](races-328.md#s4-a-launch-human-dwarf-and-half-orc) carries the count and the checks.
