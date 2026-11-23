# Reviewed feats #343

Exactly 100 byte-exact pf1-content 11.4.0 candidates from ticket #343. `provenance.json` pins their paths, hashes, exact key-order digest and 28 supporting YAML records. `comparison-sources/` retains 54 permitted PCGen comparison files at commit `25523dbcf10e86c280fc0f447167ea43d67419d3`; the legal inventory records their hashes and cited rows. Supporting/comparison records are evidence, not extra admission candidates.

`preview.json` records complete-source normalized bodies after final review. The deliberately reduced manifests keep only the feat pack and an empty system `packs` directory. Reduced imports reproduce mechanics; attribution is bound to the complete pinned extraction, without fabricating missing prerequisite definitions.

`sheet.ts` adapts the admitted Skill Focus (Knowledge [Nobility]) and explicitly held Harrowed/Dragonfly Style bodies for isolated public resolver and saved-sheet tests. It preserves rule identity, Modifiers, Sources and Notes, while omitting `repeatable: unreviewed` without inventing replacement facts. Skill Focus rank thresholds remain manual local Situations. No global release, admission bypass, deployment or hold clearance occurs.

The legal inventory is `scripts/catalog/legal/feats-343.json`, the report is `docs/catalog-import/feats-343.md`, and tests are `tests/catalog/feats-343.test.ts` and `convex/feats343.integration.test.ts`.

Review fix round 1 adds the exact PCGen APG Skeptic ability, APG campaign manifest and Quests & Campaigns manifest. These establish the explicit APG dependency while leaving Truth-Seeker's quest-table reference book unidentified and held. The existing byte-exact candidate and complete-source preview bodies are unchanged.
