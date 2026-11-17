# Racial Trait Grants #719 fixture

Byte-for-byte copies of pinned records, for the Racial Trait import seam and
the public resolver. `provenance.json` records each path and SHA-256.

- Foundry PF1 v11.11 at `418761d2e16a6037c0156bb4a241f7cea5a2986d`: the seven
  Core Rulebook races, the Orc (Advanced Race Guide p. 139, per PCGen
  `arg_races.lst`), Skill Focus (the Half-Elf record's Adaptability link) and
  the eleven weapons the familiarity traits name. Also the races whose checked
  #328 outputs move onto a trait: Kitsune, Svirfneblin and Wayang (school DCs);
  Ghoran, Changeling, Grindylow, Cecaelia, Nagaji and Reptoid (natural armor);
  Drow (a race note two traits share). Lashunta (Female) has no trait folder of
  its own name.
- pf1-content 11.4.0 at `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`: every
  record in those races' `Standard` folders (or standard records of a flat race
  folder), ten published alternates and their folder chains, and the
  `Lashunta` folder. The alternates are Dual Talent (ARG p. 72), Urbanite
  (ARG p. 22), Stubborn (ARG p. 12), Pyromaniac (ARG p. 33), Arcane Training and
  Dual Minded (ARG p. 42), City-Raised (ARG p. 52), Craven (ARG p. 62), Smeller
  (ARG p. 139) and Arctic Elf (ARG p. 23).

The two manifests are minimal fixture manifests. Nothing here is admitted or
assessed; every definition stays held for attribution (#328).

`sheet.ts` adapts imported bodies to resolver catalog entries, using each
stable key as the entry ID and rule identity. Since #720 the importer emits the
resolver's own skill keys, so the adapter passes targets through and rejects
any target or bonus type the resolver does not know. It is a test seam, not a
publication step.

Run with `pnpm test tests/catalog/racial-traits-719.test.ts`.

Uncovered: no published alternate replaces Elf Blood or Orc Blood alone with a
verified page, so race-equivalence replacement has no test. No published
alternate with a verified page is fixtured for the races added for their
re-homes, so replacing a re-homed trait is tested only through Gnome Magic
(Pyromaniac) and Hardy (Stubborn). No pinned race has a change that several of
its standard traits carry, so that case, and the stale description re-home
rules, are tested on edited copies of these records.
