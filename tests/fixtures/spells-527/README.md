# Spell batch #527 evidence fixtures

Exactly 100 ticket Spell roots retain byte-identical YAML from Foundry PF1 v11.11,
commit `418761d2e16a6037c0156bb4a241f7cea5a2986d`. The content manifest is
pf1-content 11.4.0, commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`.
[Provenance](provenance.json) identifies every root, 22 recursively linked Spells,
49 class lookup records and 32 additional named-rule context records. Context does
not add review or admission scope. The complete manifests are unchanged even when
most packs are absent in this deliberately bounded fixture.

[The bounded preview](preview.json) retains all 100 Spell definitions. The
[complete-context snapshot](binding-preview.json) retains 122 entries: all roots
and their recursively linked description dependencies. Its roots have the same
content closures as the complete upstream extraction. Neither snapshot is an
admitted catalog or a release artifact. All 100 roots remain held.

PCGen comparator files retain exact bytes at commit
`25523dbcf10e86c280fc0f447167ea43d67419d3`. Source URLs and hashes are in provenance;
complete base/DisplayFullSpell rows, direct comparisons and inherited rule identity
rows are in [the review inventory](../../../scripts/catalog/legal/spells-527.json).
The comparator is evidence, not shipped application content. No Archives of
Nethys or book PDFs were used.

[The schema loader](data.ts) bounds TypeScript inference for the JSON snapshots.
[The sheet adapter](sheet.ts) demonstrates recorded Spell metadata without
applying running Spell bonuses. Focused catalog tests reproduce both extractions,
validate all assessment bindings, retain the truncated Dirge and metadata
disagreements, and prove real rule values through the public resolver. The isolated
Convex integration test uses existing public APIs on an in-memory Character
catalog with owners, another campaign member and an outsider. No deployment,
production mutation, release activation or new global admission occurs.
