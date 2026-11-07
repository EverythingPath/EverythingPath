# Reviewed feat fixtures #346

These fixtures freeze exactly the 100 pf1-content Feat keys in issue #346 at `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`. The system manifest comes from Foundry PF1 v11.11 at `418761d2e16a6037c0156bb4a241f7cea5a2986d`; `pf1/packs/.gitkeep` preserves the deliberately empty system pack root in tracked-only checkouts. No environment or private E2E files are included.

`preview.json` freezes complete-source lookup identities and reviewed outputs. Tests re-import the 100 raw YAML records, compare their actual modifiers and Notes, then use the frozen complete-source prerequisite identities for content bindings. Out-of-fixture lookup absence is not an attribution decision. `data.ts` uses bounded Zod schemas to load large fixture/evidence JSON; it does not infer types from JSON imports.

`comparison-sources/` freezes literal PCGen Paizo `.lst`/`.pcc` files at `25523dbcf10e86c280fc0f447167ea43d67419d3`. The review inventory records each actual compared row, line and whole-file/row hashes. Partial leads, same-name rejections and unavailable evidence remain explicit. No Archives of Nethys or book PDFs were used. PCGen support comparisons are rule evidence, not permission to approve every book's full notice chain.

`original-identities.json` commits complete pre-batch rows' hashes for assessments, evidence, notice holds, overlay records, shared Situations and Registry notices. Preservation tests allow later additions while rejecting replacement/deletion of these immutable original rows. The baseline is never refreshed from post-edit data.

`sheet.ts` materializes published reviewed bodies only for isolated Character-scoped tests. It retains exact rule identities and reviewed outputs; unsupported source formulas are preserved as inert evidence in the inventory, and omits the importer's unreviewed repeatability field. The saved-sheet test admits only Skill Focus (Heal); Moontouched remains globally held. No Catalog Release is built or activated. Ordinary totals, chosen rank/visibility Situations, deactivation, two authorized campaign members and outsider/cross-campaign rejection use the public APIs and resolver.
