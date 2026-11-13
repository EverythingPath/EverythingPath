# Racial-HD batch #329 isolated evidence

The thirteen YAML records are byte-for-byte copies from Foundry PF1 v11.11,
commit `418761d2e16a6037c0156bb4a241f7cea5a2986d`. Their individual paths,
SHA-256 hashes and exact source links are recorded in the
[batch inventory](../../../scripts/catalog/legal/racial-hd-329.json).
The minimal manifests and empty content source directory are fixture scaffolding,
not complete upstream checkouts.

The catalog test reproduces their ordinary extraction and checks source metadata,
individual held assessments, and the seed table against the extracted values.
There are thirteen `creatureType` supporting resources and zero selectable
Catalog Entries. Only Outsider has explicit source metadata: `PZO1112`, page 309.
The test never fills missing sources or admits content. Linked supplements are
outside the fixture; the complete pinned-source CLI demonstration belongs to the
batch report. An extraction that drops a supplement does not establish coverage.

`sheet.ts` supplies an explicitly authored custom race with three fixed racial
Hit Dice, six base scores of 10, 7 recorded racial HP and 1 recorded Perception
rank. This is a test of seed consumption, not an imported race or a monster
stat block. Each type is checked through current and permanent public resolver
projections. For example, Dragon yields BAB 3, base saves 3/3/3 and 18 racial
skill ranks; Fey yields BAB 1, saves 1/3/3 and 18 ranks. Both have character level
0, total Hit Dice 3, a 3-rank cap and two ordinary feat slots. HP stays the
recorded 7; no first-HD maximization, Construct size bonus or Undead Cha-for-Con
adjustment is invented. Mindless creatures remain outside the supported model.

The Convex test creates a separate character-scoped custom race only inside
`convex-test`. It demonstrates the application catalog preview against saved
reads, shared member editing and rejection of outsider reads/writes. It seeds
Dragon progression, then edits every progression field, records racial HP/ranks,
and verifies a repeated save preserves those choices without changing existing
Class Levels or mutating the seed table. The new character's existing Class Level
has incomplete HP, so this test uses recorded racial HP and resolver parity rather
than claiming a complete saved total HP.

Run `pnpm test tests/catalog/racial-hd-329.test.ts convex/racialHd329.integration.test.ts`.
This demonstrates isolated calculation and persistence only: no global catalog
admission, production database, Catalog Release activation or browser run.
