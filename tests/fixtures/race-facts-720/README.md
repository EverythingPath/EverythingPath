# Race facts #720 fixture

Byte-for-byte copies of pinned records, for the race size, natural armor,
speed, spell resistance and proficiency mappings at the import seam and the
public resolver. `provenance.json` records each path and SHA-256.

- Foundry PF1 v11.11 at `418761d2e16a6037c0156bb4a241f7cea5a2986d`: the Ogre
  (Advanced Race Guide p. 229), Gnoll (Bestiary p. 155), Lizardfolk (ARG
  p. 226), Merfolk, Triton, Kobold, Trox, Grippli, Strix, Gathlain, Wyvaran,
  Vanara, Drow Noble (Bestiary p. 115), Ghoran (Ultimate Wilderness p. 15) and
  Primitive Human race records, and the hand crossbow, rapier and shortsword
  the Drow Noble names.
- pf1-content 11.4.0 at `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`: the
  `Other Races` folder, each of those races' folders, and every record in their
  `Standard` folders (or every record of a flat race folder). Ogre, Gnoll and
  Lizardfolk have no trait folder.

The two manifests are minimal fixture manifests. Nothing here is admitted or
assessed; every definition stays held for attribution (#328).

The seven Core Rulebook races come from the
[#719 fixture](../racial-traits-719/README.md), whose `sheet.ts` adapter both
fixtures use.

Run with `pnpm test tests/catalog/race-facts-720.test.ts`.
