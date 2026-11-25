# Feats #333 fixtures

The 13 exact candidates from [#333](https://github.com/AndreasUnunger/EverythingPath/issues/333) retain byte-for-byte YAML evidence from Foundry Pathfinder 1e v11.11 at `418761d2e16a6037c0156bb4a241f7cea5a2986d`. [provenance.json](provenance.json) records source paths, complete file hashes and raw-description hashes. All upstream fields remain inert evidence; no Foundry code is executed.

[preview.json](preview.json) contains the normalized candidate bodies from the complete pinned import with the checked Curation Overlay. Out-of-batch prerequisite/link identities remain intact. The reduced fixtures reproduce numeric Modifiers and readable Notes while reporting absent linked definitions. [mechanics.json](mechanics.json) records each source fact, supported prerequisite, curated output, explicit prose scope and outstanding import gap independently of the [legal dispositions](../../../scripts/catalog/legal/feats-333.json).

The public resolver tests prove Lunge’s −2 AC in its Routine Option Situation while ordinary AC stays unchanged, same-Source copies do not double the penalty, and both current and permanent projections agree. Paired Opportunists contributes +4 circumstance only in its precise local attack-of-opportunity Situation, with adjacency, an ally having the same feat and both characters threatening the target included. No unconditional replacement bonuses are invented for Signature Skill’s rank tiers. Skill unlocks, stamina, improvised attacks and target-AC manipulation remain prose under the consuming contracts.

The isolated Convex test materializes the admitted Lunge body in one Character’s catalog and selects it with public Character Sheet mutations. The fixture adapter omits only the importer's unsupported `repeatable: unreviewed` field; it retains identity, feat types, description, Sources, BAB prerequisite, Modifier and Note values. With Dexterity 14, ordinary AC remains 12, and the saved sheet exposes its conditional −2 AC line. Deactivating the Selection removes that line, and restoring it restores the same identity and contribution. Owner and organization-member reads agree; outsiders, unauthenticated reads and wrong-campaign commands fail.

Imported identities stay `pf1/<upstream ID>`. They are never rewritten into the handwritten `lunge`, `greater-vital-strike` or `shield-master` identifiers to fabricate runtime support. Reach, quadrupled weapon dice and Shield Master’s modeled attacks remain explicit importer identity gaps; Simple Weapon Proficiency's raw `weaponProf: simple` remains an unimported grant. No Catalog Release is published and no remote data is written.

```sh
pnpm test tests/catalog/feats-333.test.ts convex/catalogFeats333.integration.test.ts
```
