# Spells #516 isolated fixtures

The 100 Spell YAML files are byte-for-byte copies from the pinned Foundry PF1 v11.11 commit `418761d2e16a6037c0156bb4a241f7cea5a2986d`. `provenance.json` records their hashes. The 28 Class files supply only the class tags referenced by these Spells; they are unreviewed linked inputs, and `candidateKeys` excludes them from the extracted batch. The small manifests are fixture scaffolding.

`preview.json` is a reproducible normalized extraction of those 100 candidates with the reviewed overlay. It is neither a Catalog Release nor an admission artifact. No fixture is installed into a remote deployment.

The #516 whole-content wave 3 (2026-11-04) confirmed 38 launch rows (`docs/catalog-import/spells-516.md`). `linked-context.json` holds the full-preview entries of the six link-bearing launch roots and the ten spells they reach: the bounded extraction lacks those spells, so it strips the roots' links, and the wave bound each root on its full-preview closure. `data.ts` parses the inventory and that context for the tests.

`sheet.ts` adapts the Spell metadata for the public calculator without inventing Spell Effects. Recording Bull's Strength never adds its described +4 enhancement bonus. The isolated Convex test separately creates a Character-owned temporary Spell Effect through the existing public writer to prove that distinction; this user-authored fixture does not complete the batch's outstanding imported Spell Effect mechanics or clear an attribution hold.
