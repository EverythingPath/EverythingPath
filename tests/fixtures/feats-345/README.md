# Feats #345 fixture provenance

The [batch report](../../../docs/catalog-import/feats-345.md) and [single review artifact](../../../scripts/catalog/legal/feats-345.json) describe the exact 100 candidate dispositions and their evidence.

- `pf1-content/src/pf-feats/`: byte-exact pinned source YAML for all 100 ticket keys; hashes and exact locations are in `provenance.json`.
- `pf1-content/module.json` and `pf1/system.json`: reduced manifest fixtures for isolated extraction. `pf1/packs/.gitkeep` preserves the intentionally empty directory in a clean checkout. These reduced manifests are not the complete pinned-source manifests.
- `preview.json`: selected bodies produced from the complete pinned-source lookup. Out-of-batch prerequisite identities remain actual full-source identities; reduced fixture extraction alone is not a publication certificate.
- `comparison-sources/`: 104 complete PCGen Paizo `.lst`/`.pcc` files at `25523dbcf10e86c280fc0f447167ea43d67419d3`, byte hashes in the review artifact. Copyright-line text is trimmed for notice comparison while each raw-line SHA-256 is retained in provenance. Bibliographies and rejected name matches are evidence, never automatic attribution.
- `supporting-sources/`: 16 distinct linked pinned-source YAML snapshots, individually hashed in inherited-rule evidence.
- `original-identities.json`: immutable identities and per-value SHA-256 hashes of all pre-existing assessments, evidence, holds, overlays and Situations, plus the registry fingerprint. Tests allow later additive batches and reject deletion or value changes to the frozen baseline.
- `data.ts` and `sheet.ts`: typed snapshot loader and test-only Character Sheet adapters. No large reviewed-data JSON is imported directly. No catalog release or production state is created.

Exact candidate-order SHA-256: `0de406d7daf1b8d5eb3168bf848d89d7e40724a1c3a0e72c5d65d205a4cb6442`. Sources: PF1 v11.11 `418761d2e16a6037c0156bb4a241f7cea5a2986d`; pf1-content 11.4.0 `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`. Reviewer: Sol (AI curator) for the owner, 2026-10-09.

All 100 full descriptions are reviewed; only ordinary CRB Skill Focus (Knowledge [Dungeoneering]) is admitted. The other 99 whole-content holds and 56 complete-chain notice holds remain enforced. Manual conditions and unresolved calculations are separate from attribution. Fixtures exercise public resolver and saved-sheet boundaries, including shared campaign access and rejection of foreign scopes.
