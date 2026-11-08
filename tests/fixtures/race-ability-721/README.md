# Race ability score traits #721 fixture

Byte-for-byte copies of pinned records, for the reviewed ability score Racial
Traits at the import seam and the public resolver. `provenance.json` records
each path and SHA-256.

- Foundry PF1 v11.11 at `418761d2e16a6037c0156bb4a241f7cea5a2986d`: every race
  record in `packs/races` (80), so the coverage test checks each of the 72
  reviewed rules against its race, and the 8 races without one.
- pf1-content 11.4.0 at `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`: the
  `Core Races` and `Other Races` folders, and for the Elf, Half-Elf, Half-Orc,
  Aasimar, Changeling, Gathlain, Goblin, Kitsune, Vine Leshy and Lashunta
  folders every standard record and its folder chain. The published alternates
  are Arctic Elf (ARG p. 23), Kindred-Raised (Inner Sea Races p. 212), Orc
  Atavism (ARG p. 212), Witchborn (Inner Sea Races p. 215), Tree-Born
  (Ultimate Wilderness p. 10), Keen Kitsune (Blood of the Beast p. 12), Agile
  (Vine Leshy) (Ultimate Wilderness p. 21), Oversized Goblins (Monster Codex
  p. 104) and Angel-Blooded (Blood of Angels p. 21).

The two manifests are minimal fixture manifests. Nothing here is admitted or
assessed; every definition stays held for attribution (#328). Races whose
trait folder is not copied link no trait record here, as in a bounded preview,
and races whose description links a skill or weapon outside the fixture fail
admission as broken references.

The tests use the [#719 fixture](../racial-traits-719/README.md)'s `sheet.ts`
adapter. The Vishkanya's reviewed poison save bonus is a `@hitDice` formula
that adapter does not take, so the test drops it on both sides of each
comparison.

Run with `pnpm test tests/catalog/race-ability-721.test.ts`.

Uncovered, because no pinned record exercises them:

- a heritage subrace whose "Base Statistics" resolves to its race's reviewed
  `local/race-ability-scores/` trait: no heritage subrace has structured
  ability changes yet;
- curated `ability.*` Modifiers making an alternate's own changes count as
  mapped: no Curation Overlay record gives an alternate one;
- a folder binding several races, where "Base Statistics" stays unmatched.

Agile (Vine Leshy) and Keen Kitsune show replacement of a pinned ability score
trait through raw and reviewed changes.
