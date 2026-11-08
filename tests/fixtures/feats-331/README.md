# Feats #331 fixtures

This directory preserves all 100 exact candidates from [#331](https://github.com/AndreasUnunger/EverythingPath/issues/331). The YAML files are byte-for-byte evidence from Foundry Pathfinder 1e v11.11 commit `418761d2e16a6037c0156bb4a241f7cea5a2986d`. [provenance.json](provenance.json) records the complete source and raw-description hashes. Original action and script fields are evidence; no Foundry script is executed.

[mechanics.json](mechanics.json) records each candidate's source facts, exact review evidence, checked outputs and outstanding calculations independently of attribution. The [Curation Overlay](../../../scripts/catalog/reviewed-curation.json) contains nine checked required notes and 54 checked description records for this batch. Nineteen descriptions retain explicit unresolved mechanics; optional description coverage is separate from the required-note gate.

The fixture manifests identify compatible versions and the feats pack. They are small test manifests rather than source verification. Linked entries outside this ticket are absent. [preview.json](preview.json) preserves the ordinary normalized extraction using the complete pinned source checkouts and reviewed overlay, so reimporting the reduced fixture can produce additional missing-reference failures.

Tests exercise the public resolver and an isolated saved-sheet/catalog projection using an admitted Improved Initiative definition. Other source-backed numeric tests prove conditional behavior, not legal admission or complete imported-definition integration. The [batch inventory](../../../scripts/catalog/legal/feats-331.json) and [report](../../../docs/catalog-import/feats-331.md) separate admitted candidates, named attribution/notice holds, mechanics gaps and alternate-system prose. No release is published, remote data is written or deployment is changed.

```sh
pnpm test tests/catalog/feats-331.test.ts convex/catalogFeats331.integration.test.ts
```
