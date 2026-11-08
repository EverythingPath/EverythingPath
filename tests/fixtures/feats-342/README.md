# Reviewed feats #342

These fixtures contain exactly the 100 pinned pf1-content candidates in #342. `provenance.json` records their byte hashes and exact upstream locations; `preview.json` records their complete-source normalized bodies after the checked overlay. The 100 candidate YAML files are byte-exact source snapshots. `supporting-sources/` contains 25 pinned supporting YAML records and three pinned PCGen files (29 cited occurrences); they are comparison evidence, not extra admission candidates.

`pf1/public/system.json` and `pf1-content/module.json` are deliberately reduced fixture manifests at the pinned versions. The empty system `packs` directory is retained with `.gitkeep`. No missing prerequisite body is fabricated. Reduced import tests compare mechanics; attribution tests use the complete-source normalized bodies because a reduced import cannot resolve references outside this batch.

`sheet.ts` adapts the admitted ordinary CRB Skill Focus Handle Animal/Disable Device bodies and the explicitly held Tree Hanger body for isolated tests. It retains rule identities, reviewed Modifiers and readable rules, and omits the unusable `repeatable: unreviewed` sentinel without inventing a replacement. Manually selected rank Situations demonstrate +3/+6; automatic rank dispatch is still outstanding. No global release or hold clearance is represented by this fixture adapter.

The legal inventory is `scripts/catalog/legal/feats-342.json`, the report is `docs/catalog-import/feats-342.md`, and behavioral tests are `tests/catalog/feats-342.test.ts` and `convex/feats342.integration.test.ts`.
