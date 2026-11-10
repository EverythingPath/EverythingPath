# Racial traits #403: Bonus Feat (Human), Weapon Familiarity (Half-Orc), Elf Blood, Multitalented, Sure-Footed (MVP launch subset, #328 S4-A and S4-B)

MVP launch subset of #403: this inventory curates only pf1-content/uAJ9hLZYdH2JX7J8, pf1-content/sFlDW97gf1FHn217, pf1-content/rzYk40R1rWSfay4a, pf1-content/srOpqbXesXBuvTqe, pf1-content/sSs0BK09PLxjbkAa (S4-A added the first, S4-B the rest); the ticket's other 95 keys stay remaining acceptance under #403 (its core-race required alternates go to run C). The 95 remaining keys are listed in `launchSubset.remainingAcceptance` ([`racial-traits-403.json`](../../scripts/catalog/legal/racial-traits-403.json)). `launchSubset.s4bKeys` is now empty; `launchSubset.runCRequiredAlternates` (3) are core-race alternates for run C.

| Key                                                          | Disposition | Assessment | Required notices          | Evidence                             |
| ------------------------------------------------------------ | ----------- | ---------- | ------------------------- | ------------------------------------ |
| `pf1-content/uAJ9hLZYdH2JX7J8` Bonus Feat (Human)            | admitted    | confirmed  | PZO9280, PZO1121, PZO1110 | `racial-traits-403-uAJ9hLZYdH2JX7J8` |
| `pf1-content/sFlDW97gf1FHn217` Weapon Familiarity (Half-Orc) | admitted    | confirmed  | PZO9280, PZO1121, PZO1110 | `racial-traits-403-sFlDW97gf1FHn217` |
| `pf1-content/rzYk40R1rWSfay4a` Elf Blood                     | admitted    | confirmed  | PZO9280, PZO1121, PZO1110 | `racial-traits-403-rzYk40R1rWSfay4a` |
| `pf1-content/srOpqbXesXBuvTqe` Multitalented                 | admitted    | confirmed  | PZO9280, PZO1121, PZO1110 | `racial-traits-403-srOpqbXesXBuvTqe` |
| `pf1-content/sSs0BK09PLxjbkAa` Sure-Footed                   | admitted    | confirmed  | PZO9280, PZO1121, PZO1110 | `racial-traits-403-sSs0BK09PLxjbkAa` |

## #328 S4-B

S4-B of [#328](https://github.com/AndreasUnunger/EverythingPath/issues/328), the CRB core races Half-Elf, Elf, Gnome and Halfling, extends this inventory with Elf Blood, Multitalented, Sure-Footed; S4-A's rows are unchanged. The run report is the [S4-B section of races-328.md](races-328.md#s4-b-launch-half-elf-elf-gnome-and-halfling). Reviewer: Sol (AI curator) for the owner, 2026-11-01. Sources: pf1-content 11.4.0 (`02f4ab0d`), the PRD capture `prd-2026-10-20` (Advanced Race Guide race pages) and PCGen `25523dbc` (Core Essentials race-ability rows). No book PDFs; Archives of Nethys not used.

### Evidence (S4-B rows)

- **Elf Blood** (`pf1-content/rzYk40R1rWSfay4a`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/halfElves.html:369`) word for word; PCGen's Core Essentials row (`half_elf/halfelf_abilities_race.lst:23`) word for word. It sets countsAsRaces to the Elf (pf1/NgIhxRI0axrf3fcO) and Human (pf1/e6IaBxKgMxy1yKlr) races, which race prerequisites read (src/lib/catalog-rule-lookups.ts). Required notices: PZO9280, PZO1121, PZO1110.
- **Multitalented** (`pf1-content/srOpqbXesXBuvTqe`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/halfElves.html:372`) apart from "1st" for "first"; no "+"; an added "additional"; no "+ 1"; PCGen's Core Essentials row (`half_elf/halfelf_abilities_race.lst:26`) with the recorded DESC differences. Its detail gives favoredClassCount 2: the sheet offers two favored classes, each giving +1 hit point or +1 skill rank per level taken in it. Required notices: PZO9280, PZO1121, PZO1110.
- **Sure-Footed** (`pf1-content/sSs0BK09PLxjbkAa`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/halflings.html:370`) word for word; PCGen's Core Essentials row (`halfling/halfling_abilities_race.lst:24`) with the recorded DESC differences. Its Modifiers are +2 racial Acrobatics (skill.acr) and +2 racial Climb (skill.clm). Required notices: PZO9280, PZO1121, PZO1110.

### Records

- Elf Blood: `description` on `description` (`42da8ce9…`), checked, `outputs: []`.
- Multitalented: `description` on `description` (`12ca70b7…`), checked, `outputs: []`.
- Sure-Footed: `description` on `description` (`ab2093dc…`), checked, `outputs: []`.

The description pass adds no Note: the body is the readable rule and stays the entry's description, so the imported entry is unchanged and no content binding moves (the curated full-corpus preview's 23,630 entries equal the base preview's byte for byte). Each record exists because every candidate of a swept inventory needs exactly one description record (`tests/catalog/batch-ownership.ts`).

### Attribution

**Elf Blood.** Complete standard racial trait of the Half-Elf (CRB p. 24, ARG p. 40, Inner Sea Races p. 237) compared in full by #328 S4-B (CRB core races Half-Elf, Elf, Gnome, Halfling): the PRD Advanced Race Guide paragraph (advancedRaceGuide/coreRaces/halfElves.html:369, capture prd-2026-10-20) matches the pinned body word for word; PCGen's Core Essentials row (half_elf/halfelf_abilities_race.lst:23) states the same rule word for word. Every statement of the body is in one or both. It sets countsAsRaces to the Elf (pf1/NgIhxRI0axrf3fcO) and Human (pf1/e6IaBxKgMxy1yKlr) races, which race prerequisites read (src/lib/catalog-rule-lookups.ts). Required notices: PZO1110 (the reviewed Core Rulebook notice); PZO1121 (its Registry notice's hold notice-264-complete-chain-457075cc… is cleared, notice-clearances.json, owner 2026-10-30); PZO9280 (the reviewed PCGen confirmation section15-confirmations-716.json#PZO9280, matched and checked 2026-10-31).

**Multitalented.** Complete standard racial trait of the Half-Elf (CRB p. 24, ARG p. 40, Inner Sea Races p. 237) compared in full by #328 S4-B (CRB core races Half-Elf, Elf, Gnome, Halfling): the PRD Advanced Race Guide paragraph (advancedRaceGuide/coreRaces/halfElves.html:372, capture prd-2026-10-20) differs in 4 recorded place(s) ("1st" for "first"; no "+"; added "additional"; no "+ 1"), recorded, not resolved; PCGen's Core Essentials row (half_elf/halfelf_abilities_race.lst:26) states the same rule (4 recorded wording or variable difference(s): "1st" for "first"; "" for "+"; "additional" for ""; "" for "+ 1"). Every statement of the body is in one or both. Its detail gives favoredClassCount 2: the sheet offers two favored classes, each giving +1 hit point or +1 skill rank per level taken in it. Required notices: PZO1110 (the reviewed Core Rulebook notice); PZO1121 (its Registry notice's hold notice-264-complete-chain-457075cc… is cleared, notice-clearances.json, owner 2026-10-30); PZO9280 (the reviewed PCGen confirmation section15-confirmations-716.json#PZO9280, matched and checked 2026-10-31).

**Sure-Footed.** Complete standard racial trait of the Halfling (CRB p. 26, ARG p. 60, Inner Sea Races p. 238) compared in full by #328 S4-B (CRB core races Half-Elf, Elf, Gnome, Halfling): the PRD Advanced Race Guide paragraph (advancedRaceGuide/coreRaces/halflings.html:370, capture prd-2026-10-20) matches the pinned body word for word; PCGen's Core Essentials row (halfling/halfling_abilities_race.lst:24) states the same rule (1 recorded wording or variable difference(s): "" for "skill"). Every statement of the body is in one or both. Its Modifiers are +2 racial Acrobatics (skill.acr) and +2 racial Climb (skill.clm). Required notices: PZO1110 (the reviewed Core Rulebook notice); PZO1121 (its Registry notice's hold notice-264-complete-chain-457075cc… is cleared, notice-clearances.json, owner 2026-10-30); PZO9280 (the reviewed PCGen confirmation section15-confirmations-716.json#PZO9280, matched and checked 2026-10-31).

### Outstanding mechanics

- None: every statement the S4-B rows make is calculated or a permitted Note.

Calculations stay outstanding with their owners, never attribution holds.

### Source discrepancies

- Multitalented: The pinned body reads "1st"; the PRD ARG paragraph reads "first".
- Multitalented: The pinned body has no "+" where the PRD ARG paragraph has it.
- Multitalented: The pinned body adds "additional" where the PRD ARG paragraph has none.
- Multitalented: The pinned body has no "+ 1" where the PRD ARG paragraph has it.

Recorded, not resolved.

### Cross-batch bindings and protected records

Each trait's own content closure is the entry alone (`collectReferences` is empty). Its race's closure contains it, so the race's assessment ([races-328.json](../../scripts/catalog/legal/races-328.json)) binds it; that assessment is written in the same change. The new description records add no output, so no other batch's binding moves.

### Binding

`currentBinding` and the assessment come from `buildAssessmentBinding` over the curated full-corpus `catalog:preview`. The committed [`tests/fixtures/racial-traits-403/preview.json`](../../tests/fixtures/racial-traits-403/preview.json) holds the full-corpus entries.

### Tests

[`racial-traits-403.test.ts`](../../tests/catalog/racial-traits-403.test.ts) checks each body against its checked description record, the PRD ARG paragraph (with its exact word differences) and the PCGen row from the shared store; the pinned record's bytes against the pinned pf1-content checkout when present (the trait records are not in the shared store); the gate over the committed entries and their closure, with the binding rebuilt and a changed body refused; and the traits' mechanics. [`batch-ownership-sweep.test.ts`](../../tests/catalog/batch-ownership-sweep.test.ts) checks the batch's own rows.

### Preservation and gates

The shared files gain only the batch's S4-B entries: 3 description records, 3 assessments and 3 evidence entries. No Registry, `held-notices.json`, `notice-clearances.json` or `section15-confirmations-716.json` change. This inventory adds nothing to the shared store; [races-328.md](races-328.md#s4-b-launch-half-elf-elf-gnome-and-halfling) carries the count and the checks.

## #328 S4-A

This report belongs to S4-A of [#328](https://github.com/AndreasUnunger/EverythingPath/issues/328), the CRB core races Human, Dwarf and Half-Orc; the run report is the [S4-A section of races-328.md](races-328.md#s4-a-launch-human-dwarf-and-half-orc). Reviewer: Sol (AI curator) for the owner, 2026-11-01. Sources: pf1-content 11.4.0 (`02f4ab0d`), the PRD capture `prd-2026-10-20` (Advanced Race Guide race pages) and PCGen `25523dbc` (Core Essentials race-ability rows). No book PDFs; Archives of Nethys not used.

## Evidence

- **Bonus Feat (Human)** (`pf1-content/uAJ9hLZYdH2JX7J8`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/humans.html:362`) word for word; PCGen's Core Essentials row (`human/human_abilities_race.lst:21`). It grants one feat slot at 1st level (grantsSlots {kind: feat, count: 1}); Foundry's bonusFeats change is relocated here from the race and has no further mapped target, so the slot is not doubled. Required notices: PZO9280, PZO1121, PZO1110.
- **Weapon Familiarity (Half-Orc)** (`pf1-content/sFlDW97gf1FHn217`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/halfOrcs.html:374`) apart from an added ","; PCGen's Core Essentials row (`half_orc/halforc_abilities_race.lst:25`). It grants weapon Proficiencies Falchion and Greataxe (weaponProf). Required notices: PZO9280, PZO1121, PZO1110. Outstanding: Treating weapons with "orc" in their name as martial weapons stays prose (#740).

## Records

- Bonus Feat (Human): `description` on `description` (`b764f6c1…`), checked, `outputs: []`.
- Weapon Familiarity (Half-Orc): `description` on `description` (`eb8a1873…`), checked, `outputs: []`.

The description pass adds no Note: the body is the readable rule and stays the entry's description, so the imported entry is unchanged and no content binding moves (the curated full-corpus preview's entries equal the base preview's). The record exists because every candidate of a swept inventory needs exactly one description record (`tests/catalog/batch-ownership.ts`).

## Attribution

**Bonus Feat (Human).** Complete standard racial trait of the Human (CRB p. 27, ARG p. 70, Inner Sea Races p. 238) compared in full by #328 S4-A (CRB core races Human, Dwarf, Half-Orc): the PRD Advanced Race Guide paragraph (advancedRaceGuide/coreRaces/humans.html:362, capture prd-2026-10-20) matches the pinned body word for word; PCGen's Core Essentials row (human/human_abilities_race.lst:21) states the same rule. It grants one feat slot at 1st level (grantsSlots {kind: feat, count: 1}); Foundry's bonusFeats change is relocated here from the race and has no further mapped target, so the slot is not doubled. Required notices: PZO1110 (the reviewed Core Rulebook notice); PZO1121 (its Registry notice's hold notice-264-complete-chain-457075cc… is cleared, notice-clearances.json, owner 2026-10-30); PZO9280 (the reviewed PCGen confirmation section15-confirmations-716.json#PZO9280, matched and checked 2026-10-31).

**Weapon Familiarity (Half-Orc).** Complete standard racial trait of the Half-Orc (CRB p. 25, ARG p. 50, Inner Sea Races p. 237) compared in full by #328 S4-A (CRB core races Human, Dwarf, Half-Orc): the PRD Advanced Race Guide paragraph (advancedRaceGuide/coreRaces/halfOrcs.html:374, capture prd-2026-10-20) differs in 1 recorded place(s) (added ","), recorded, not resolved; PCGen's Core Essentials row (half_orc/halforc_abilities_race.lst:25) states the same rule. It grants weapon Proficiencies Falchion and Greataxe (weaponProf). Required notices: PZO1110 (the reviewed Core Rulebook notice); PZO1121 (its Registry notice's hold notice-264-complete-chain-457075cc… is cleared, notice-clearances.json, owner 2026-10-30); PZO9280 (the reviewed PCGen confirmation section15-confirmations-716.json#PZO9280, matched and checked 2026-10-31).

## Outstanding mechanics

- Treating weapons with "orc" in their name as martial weapons stays prose (#740).

Calculations stay outstanding with their owners, never attribution holds.

## Source discrepancies

- Weapon Familiarity (Half-Orc): The pinned body adds "," where the PRD ARG paragraph has none.
- Weapon Familiarity (Half-Orc): PCGen's Core Essentials row also records CHANGEPROF:TYPE.Orc=Martial; the pinned body states that rule in prose only.

Recorded, not resolved.

## Cross-batch bindings and protected records

The trait's own content closure is the entry alone (`collectReferences` is empty). Its race's closure contains it, so the race's assessment (Half-Orc, Human, [races-328.json](../../scripts/catalog/legal/races-328.json)) binds it; that assessment is written in the same change. The new description record adds no output, so no other batch's binding moves.

## Binding

`currentBinding` and the assessment come from `buildAssessmentBinding` over the curated full-corpus `catalog:preview`. The committed [`tests/fixtures/racial-traits-403/preview.json`](../../tests/fixtures/racial-traits-403/preview.json) holds the full-corpus entries.

## Tests

[`racial-traits-403.test.ts`](../../tests/catalog/racial-traits-403.test.ts) checks each body against its checked description record, the PRD ARG paragraph (with its exact word differences) and the PCGen row from the shared store; the pinned record's bytes against the pinned pf1-content checkout when present (the trait records are not in the shared store); the gate over the committed entries, with the binding rebuilt and a changed body refused; and the trait's mechanics. [`batch-ownership-sweep.test.ts`](../../tests/catalog/batch-ownership-sweep.test.ts) checks the batch's own rows.

## Preservation and gates

The shared files gain only the batch's entries: 2 description records, 2 assessments and 2 evidence entries. No Registry, `held-notices.json`, `notice-clearances.json` or `section15-confirmations-716.json` change. This inventory adds nothing to the shared store; [races-328.md](races-328.md#s4-a-launch-human-dwarf-and-half-orc) carries the count and the checks.
