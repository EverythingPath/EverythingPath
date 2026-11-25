# Feats #330 fixtures

This directory preserves the exact 100 feat candidates reviewed in [the batch inventory](../../../scripts/catalog/legal/feats-330.json). Each YAML file is byte-for-byte from the pinned Foundry Pathfinder 1e v11.11 commit `418761d2e16a6037c0156bb4a241f7cea5a2986d`. [provenance.json](provenance.json) records each source path, source URL, YAML hash and raw-description hash. Original script fields are evidence only; tests do not execute Foundry scripts.

The small manifests identify the supported upstream versions and this fixture's feats pack. They are fixture manifests, not verified source checkouts. Linked entries outside the ticket are deliberately absent. [preview.json](preview.json) stores the 100 normalized entries extracted from the complete pinned checkouts with the reviewed overlay; absent linked inputs can therefore cause additional failures when reimporting only this fixture.

The catalog tests run the ordinary curation and attribution admission gates. They assert the 12 complete PCGen/CRB comparisons are admitted and keep named attribution holds, unsupported alternate systems and incomplete mechanics separate. They do not override admission or declare the whole corpus complete.

[sheet.ts](sheet.ts) supplies a narrow Lightning Reflexes adapter for public calculation and isolated saved-sheet tests. It accepts only numeric Reflex-save Modifiers with no extra fields, preserves the imported rule identity, and omits the importer's unreviewed repeatability rather than guessing a value. This adapter proves the reviewed +2 bonus; it does not provide the missing generic imported-definition adapter, proficiency facts, choices or canonical attack identities. The saved-sheet test seeds only this admitted feat, then exercises member edits, both public projections and outsider denial.

Run from the repository root:

```sh
pnpm test tests/catalog/feats-330.test.ts convex/catalogFeats330.integration.test.ts
```

These are local fixture tests. No Catalog Release, remote database write, deployment or publication occurs. Commands, full-input gates and outstanding work are recorded in [the batch report](../../../docs/catalog-import/feats-330.md).
