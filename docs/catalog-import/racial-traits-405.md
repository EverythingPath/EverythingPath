# Racial traits #405: Elven Immunities (Elf) (MVP launch subset, #328 S4-B)

MVP launch subset of #405: this inventory curates only pf1-content/yQvZ03xcsuM8b595; the ticket's other 69 keys stay remaining acceptance under #405 (its core-race required alternates go to run C). The 69 remaining keys are listed in `launchSubset.remainingAcceptance` ([`racial-traits-405.json`](../../scripts/catalog/legal/racial-traits-405.json)). `launchSubset.s4bKeys` is now empty; `launchSubset.runCRequiredAlternates` (1) are core-race alternates for run C.

| Key                                                   | Disposition | Assessment | Required notices          | Evidence                             |
| ----------------------------------------------------- | ----------- | ---------- | ------------------------- | ------------------------------------ |
| `pf1-content/yQvZ03xcsuM8b595` Elven Immunities (Elf) | admitted    | confirmed  | PZO9280, PZO1121, PZO1110 | `racial-traits-405-yQvZ03xcsuM8b595` |

## #328 S4-B

S4-B of [#328](https://github.com/AndreasUnunger/EverythingPath/issues/328), the CRB core races Half-Elf, Elf, Gnome and Halfling, creates this inventory. The run report is the [S4-B section of races-328.md](races-328.md#s4-b-launch-half-elf-elf-gnome-and-halfling). Reviewer: Sol (AI curator) for the owner, 2026-11-01. Sources: pf1-content 11.4.0 (`02f4ab0d`), the PRD capture `prd-2026-10-20` (Advanced Race Guide race pages) and PCGen `25523dbc` (Core Essentials race-ability rows). No book PDFs; Archives of Nethys not used.

## Evidence (S4-B rows)

- **Elven Immunities (Elf)** (`pf1-content/yQvZ03xcsuM8b595`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/elves.html:368`) apart from "get" for "gain"; no "saving throw"; an added "on saving throws"; PCGen's Core Essentials row (`elf/elf_abilities_race.lst:22`) with the recorded DESC differences. Its Modifier is +2 racial on saves in the shared Situation enchantment, with the Note "Immune to magic sleep effects." (re-homed from the Elf's checked note record). Required notices: PZO9280, PZO1121, PZO1110. Outstanding: Immunity to magic sleep effects is a permitted Note; no immunity statistic.

## Records

- Elven Immunities (Elf): `description` on `description` (`77c056a6…`), checked, `outputs: []`.

The description pass adds no Note: the body is the readable rule and stays the entry's description, so the imported entry is unchanged and no content binding moves (the curated full-corpus preview's 23,630 entries equal the base preview's byte for byte). Each record exists because every candidate of a swept inventory needs exactly one description record (`tests/catalog/batch-ownership.ts`).

## Attribution

**Elven Immunities (Elf).** Complete standard racial trait of the Elf (CRB p. 22, ARG p. 20, Inner Sea Races p. 236) compared in full by #328 S4-B (CRB core races Half-Elf, Elf, Gnome, Halfling): the PRD Advanced Race Guide paragraph (advancedRaceGuide/coreRaces/elves.html:368, capture prd-2026-10-20) differs in 3 recorded place(s) ("get" for "gain"; no "saving throw"; added "on saving throws"), recorded, not resolved; PCGen's Core Essentials row (elf/elf_abilities_race.lst:22) states the same rule (2 recorded wording or variable difference(s): "" for "saving throw"; "on saving throws" for ""). Every statement of the body is in one or both. Its Modifier is +2 racial on saves in the shared Situation enchantment, with the Note "Immune to magic sleep effects." (re-homed from the Elf's checked note record). Required notices: PZO1110 (the reviewed Core Rulebook notice); PZO1121 (its Registry notice's hold notice-264-complete-chain-457075cc… is cleared, notice-clearances.json, owner 2026-10-30); PZO9280 (the reviewed PCGen confirmation section15-confirmations-716.json#PZO9280, matched and checked 2026-10-31).

## Outstanding mechanics

- Elven Immunities (Elf): Immunity to magic sleep effects is a permitted Note; no immunity statistic.

Calculations stay outstanding with their owners, never attribution holds.

## Source discrepancies

- Elven Immunities (Elf): The pinned body reads "get"; the PRD ARG paragraph reads "gain".
- Elven Immunities (Elf): The pinned body has no "saving throw" where the PRD ARG paragraph has it.
- Elven Immunities (Elf): The pinned body adds "on saving throws" where the PRD ARG paragraph has none.

Recorded, not resolved.

## Cross-batch bindings and protected records

Each trait's own content closure is the entry alone (`collectReferences` is empty). Its race's closure contains it, so the race's assessment ([races-328.json](../../scripts/catalog/legal/races-328.json)) binds it; that assessment is written in the same change. The new description records add no output, so no other batch's binding moves.

## Binding

`currentBinding` and the assessment come from `buildAssessmentBinding` over the curated full-corpus `catalog:preview`. The committed [`tests/fixtures/racial-traits-405/preview.json`](../../tests/fixtures/racial-traits-405/preview.json) holds the full-corpus entries.

## Tests

[`racial-traits-405.test.ts`](../../tests/catalog/racial-traits-405.test.ts) checks each body against its checked description record, the PRD ARG paragraph (with its exact word differences) and the PCGen row from the shared store; the pinned record's bytes against the pinned pf1-content checkout when present (the trait records are not in the shared store); the gate over the committed entries and their closure, with the binding rebuilt and a changed body refused; and the traits' mechanics. [`batch-ownership-sweep.test.ts`](../../tests/catalog/batch-ownership-sweep.test.ts) checks the batch's own rows.

## Preservation and gates

The shared files gain only the batch's S4-B entries: 1 description record, 1 assessment and 1 evidence entry. No Registry, `held-notices.json`, `notice-clearances.json` or `section15-confirmations-716.json` change. This inventory adds nothing to the shared store; [races-328.md](races-328.md#s4-b-launch-half-elf-elf-gnome-and-halfling) carries the count and the checks.
