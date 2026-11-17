# Racial traits #404: Darkvision (Half-Orc), Adaptability, Slow Speed (Halfling) (MVP launch subset, #328 S4-A and S4-B)

MVP launch subset of #404: this inventory curates only pf1-content/xeEmYqR3IUXoby9x, pf1-content/wZZzaSmiF8hTuRo7, pf1-content/xwr9DBDmvGMYHcut (S4-A added the first, S4-B the rest); the ticket's other 97 keys stay remaining acceptance under #404 (its core-race required alternates go to run C). The 97 remaining keys are listed in `launchSubset.remainingAcceptance` ([`racial-traits-404.json`](../../scripts/catalog/legal/racial-traits-404.json)). `launchSubset.s4bKeys` is now empty; `launchSubset.runCRequiredAlternates` (3) are core-race alternates for run C.

| Key                                                  | Disposition | Assessment | Required notices                   | Evidence                             |
| ---------------------------------------------------- | ----------- | ---------- | ---------------------------------- | ------------------------------------ |
| `pf1-content/xeEmYqR3IUXoby9x` Darkvision (Half-Orc) | admitted    | confirmed  | PZO9280, PZO1121, PZO1127, PZO1110 | `racial-traits-404-xeEmYqR3IUXoby9x` |
| `pf1-content/wZZzaSmiF8hTuRo7` Adaptability          | admitted    | confirmed  | PZO9280, PZO1121, PZO1110          | `racial-traits-404-wZZzaSmiF8hTuRo7` |
| `pf1-content/xwr9DBDmvGMYHcut` Slow Speed (Halfling) | admitted    | confirmed  | PZO9280, PZO1121, PZO1110          | `racial-traits-404-xwr9DBDmvGMYHcut` |

## #328 S4-B

S4-B of [#328](https://github.com/AndreasUnunger/EverythingPath/issues/328), the CRB core races Half-Elf, Elf, Gnome and Halfling, extends this inventory with Adaptability, Slow Speed (Halfling); S4-A's rows are unchanged. The run report is the [S4-B section of races-328.md](races-328.md#s4-b-launch-half-elf-elf-gnome-and-halfling). Reviewer: Sol (AI curator) for the owner, 2026-11-01. Sources: pf1-content 11.4.0 (`02f4ab0d`), the PRD capture `prd-2026-10-20` (Advanced Race Guide race pages) and PCGen `25523dbc` (Core Essentials race-ability rows). No book PDFs; Archives of Nethys not used.

### Evidence (S4-B rows)

- **Adaptability** (`pf1-content/wZZzaSmiF8hTuRo7`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/halfElves.html:368`) word for word; PCGen's Core Essentials row (`half_elf/halfelf_abilities_race.lst:22`) word for word. It grants one feat slot at 1st level limited to Skill Focus (grantsSlots {kind: feat, count: 1, feats: [pf1/7zJTztNW7hdaqjKc]}); Skill Focus is admitted (#334 run). Required notices: PZO9280, PZO1121, PZO1110.
- **Slow Speed (Halfling)** (`pf1-content/xwr9DBDmvGMYHcut`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/halflings.html:366`) word for word; PCGen's Core Essentials row (`halfling/halfling_abilities_race.lst:20`) word for word. Base speed 20 feet stays prose: the sheet has no movement statistic (Foundry's landSpeed set is unmapped). Required notices: PZO9280, PZO1121, PZO1110. Outstanding: Speed: #740, owner 2026-10-31 "prose is fine for now".

### Records

- Adaptability: `description` on `description` (`f7ee81fb…`), checked, `outputs: []`.
- Slow Speed (Halfling): `description` on `description` (`973fddd5…`), checked, `outputs: []`.

The description pass adds no Note: the body is the readable rule and stays the entry's description, so the imported entry is unchanged and no content binding moves (the curated full-corpus preview's 23,630 entries equal the base preview's byte for byte). Each record exists because every candidate of a swept inventory needs exactly one description record (`tests/catalog/batch-ownership.ts`).

### Attribution

**Adaptability.** Complete standard racial trait of the Half-Elf (CRB p. 24, ARG p. 40, Inner Sea Races p. 237) compared in full by #328 S4-B (CRB core races Half-Elf, Elf, Gnome, Halfling): the PRD Advanced Race Guide paragraph (advancedRaceGuide/coreRaces/halfElves.html:368, capture prd-2026-10-20) matches the pinned body word for word; PCGen's Core Essentials row (half_elf/halfelf_abilities_race.lst:22) states the same rule word for word. Every statement of the body is in one or both. It grants one feat slot at 1st level limited to Skill Focus (grantsSlots {kind: feat, count: 1, feats: [pf1/7zJTztNW7hdaqjKc]}); Skill Focus is admitted (#334 run). Its closure holds Skill Focus (pf1/7zJTztNW7hdaqjKc), admitted on its own confirmed assessment. Required notices: PZO1110 (the reviewed Core Rulebook notice); PZO1121 (its Registry notice's hold notice-264-complete-chain-457075cc… is cleared, notice-clearances.json, owner 2026-10-30); PZO9280 (the reviewed PCGen confirmation section15-confirmations-716.json#PZO9280, matched and checked 2026-10-31).

**Slow Speed (Halfling).** Complete standard racial trait of the Halfling (CRB p. 26, ARG p. 60, Inner Sea Races p. 238) compared in full by #328 S4-B (CRB core races Half-Elf, Elf, Gnome, Halfling): the PRD Advanced Race Guide paragraph (advancedRaceGuide/coreRaces/halflings.html:366, capture prd-2026-10-20) matches the pinned body word for word; PCGen's Core Essentials row (halfling/halfling_abilities_race.lst:20) states the same rule word for word. Every statement of the body is in one or both. Base speed 20 feet stays prose: the sheet has no movement statistic (Foundry's landSpeed set is unmapped). Required notices: PZO1110 (the reviewed Core Rulebook notice); PZO1121 (its Registry notice's hold notice-264-complete-chain-457075cc… is cleared, notice-clearances.json, owner 2026-10-30); PZO9280 (the reviewed PCGen confirmation section15-confirmations-716.json#PZO9280, matched and checked 2026-10-31).

### Outstanding mechanics

- Slow Speed (Halfling): Speed: #740, owner 2026-10-31 "prose is fine for now".

Calculations stay outstanding with their owners, never attribution holds.

### Source discrepancies

- Adaptability: The pinned body links Skill Focus with a Foundry @UUID enricher; read as its label it matches the PRD ARG paragraph.
- Slow Speed (Halfling): The pinned body writes the speed as Foundry's @Distance[20 ft;dual] enricher; read as "20 feet" it matches the PRD ARG paragraph.

Recorded, not resolved.

### Cross-batch bindings and protected records

Adaptability's content closure holds Skill Focus (`pf1/7zJTztNW7hdaqjKc`, admitted on its own confirmed assessment); every other trait's closure is the entry alone. Its race's closure contains it, so the race's assessment ([races-328.json](../../scripts/catalog/legal/races-328.json)) binds it; that assessment is written in the same change. The new description records add no output, so no other batch's binding moves.

### Binding

`currentBinding` and the assessment come from `buildAssessmentBinding` over the curated full-corpus `catalog:preview`. The committed [`tests/fixtures/racial-traits-404/preview.json`](../../tests/fixtures/racial-traits-404/preview.json) holds the full-corpus entries and the rest of their closure (Skill Focus, with its import record).

### Tests

[`racial-traits-404.test.ts`](../../tests/catalog/racial-traits-404.test.ts) checks each body against its checked description record, the PRD ARG paragraph (with its exact word differences) and the PCGen row from the shared store; the pinned record's bytes against the pinned pf1-content checkout when present (the trait records are not in the shared store); the gate over the committed entries and their closure, with the binding rebuilt and a changed body refused; and the traits' mechanics. [`batch-ownership-sweep.test.ts`](../../tests/catalog/batch-ownership-sweep.test.ts) checks the batch's own rows.

### Preservation and gates

The shared files gain only the batch's S4-B entries: 2 description records, 2 assessments and 2 evidence entries. No Registry, `held-notices.json`, `notice-clearances.json` or `section15-confirmations-716.json` change. This inventory adds nothing to the shared store; [races-328.md](races-328.md#s4-b-launch-half-elf-elf-gnome-and-halfling) carries the count and the checks.

## #328 S4-A

This report belongs to S4-A of [#328](https://github.com/AndreasUnunger/EverythingPath/issues/328), the CRB core races Human, Dwarf and Half-Orc; the run report is the [S4-A section of races-328.md](races-328.md#s4-a-launch-human-dwarf-and-half-orc). Reviewer: Sol (AI curator) for the owner, 2026-11-01. Sources: pf1-content 11.4.0 (`02f4ab0d`), the PRD capture `prd-2026-10-20` (Advanced Race Guide race pages) and PCGen `25523dbc` (Core Essentials race-ability rows). No book PDFs; Archives of Nethys not used.

## Evidence

- **Darkvision (Half-Orc)** (`pf1-content/xeEmYqR3IUXoby9x`): matches the PRD ARG paragraph (`advancedRaceGuide/coreRaces/halfOrcs.html:370`) word for word; PCGen's Core Essentials row (`half_orc/halforc_abilities_race.lst:21`). Darkvision 60 feet stays readable; Foundry's set change on sensedv is unmapped and contributes nothing. Required notices: PZO9280, PZO1121, PZO1127, PZO1110. Outstanding: Darkvision is permitted prose; no sense statistic.

## Records

- Darkvision (Half-Orc): `description` on `description` (`5e30c8ab…`), checked, `outputs: []`.

The description pass adds no Note: the body is the readable rule and stays the entry's description, so the imported entry is unchanged and no content binding moves (the curated full-corpus preview's entries equal the base preview's). The record exists because every candidate of a swept inventory needs exactly one description record (`tests/catalog/batch-ownership.ts`).

## Attribution

**Darkvision (Half-Orc).** Complete standard racial trait of the Half-Orc (CRB p. 25, ARG p. 50, Inner Sea Races p. 237) compared in full by #328 S4-A (CRB core races Human, Dwarf, Half-Orc): the PRD Advanced Race Guide paragraph (advancedRaceGuide/coreRaces/halfOrcs.html:370, capture prd-2026-10-20) matches the pinned body word for word; PCGen's Core Essentials row (half_orc/halforc_abilities_race.lst:21) states the same rule. Darkvision 60 feet stays readable; Foundry's set change on sensedv is unmapped and contributes nothing. Required notices: PZO1110 (the reviewed Core Rulebook notice); PZO1121 (its Registry notice's hold notice-264-complete-chain-457075cc… is cleared, notice-clearances.json, owner 2026-10-30); PZO9280 (the reviewed PCGen confirmation section15-confirmations-716.json#PZO9280, matched and checked 2026-10-31); PZO1127 (darkvision, a universal monster rule sourced to Bestiary 4; its reviewed PRD Registry notice).

## Outstanding mechanics

- Darkvision is permitted prose; no sense statistic.

Calculations stay outstanding with their owners, never attribution holds.

## Source discrepancies

- Darkvision (Half-Orc): The pinned body writes the range as Foundry's @Distance[60 ft;dual] enricher; read as "60 feet" it matches the PRD ARG paragraph.

Recorded, not resolved.

## Cross-batch bindings and protected records

The trait's own content closure is the entry alone (`collectReferences` is empty). Its race's closure contains it, so the race's assessment (Half-Orc, [races-328.json](../../scripts/catalog/legal/races-328.json)) binds it; that assessment is written in the same change. The new description record adds no output, so no other batch's binding moves.

## Binding

`currentBinding` and the assessment come from `buildAssessmentBinding` over the curated full-corpus `catalog:preview`. The committed [`tests/fixtures/racial-traits-404/preview.json`](../../tests/fixtures/racial-traits-404/preview.json) holds the full-corpus entry.

## Tests

[`racial-traits-404.test.ts`](../../tests/catalog/racial-traits-404.test.ts) checks each body against its checked description record, the PRD ARG paragraph (with its exact word differences) and the PCGen row from the shared store; the pinned record's bytes against the pinned pf1-content checkout when present (the trait records are not in the shared store); the gate over the committed entry, with the binding rebuilt and a changed body refused; and the trait's mechanics. [`batch-ownership-sweep.test.ts`](../../tests/catalog/batch-ownership-sweep.test.ts) checks the batch's own rows.

## Preservation and gates

The shared files gain only the batch's entries: 1 description record, 1 assessment and 1 evidence entry. No Registry, `held-notices.json`, `notice-clearances.json` or `section15-confirmations-716.json` change. This inventory adds nothing to the shared store; [races-328.md](races-328.md#s4-a-launch-human-dwarf-and-half-orc) carries the count and the checks.
