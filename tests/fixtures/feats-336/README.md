# Feat curation #336 fixtures

The 100 YAML files preserve the exact [#336](https://github.com/AndreasUnunger/EverythingPath/issues/336) candidates from pf1-content 11.4.0, commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`. [provenance.json](provenance.json) records each identity, original path, complete-file SHA-256 and raw-description SHA-256. Foundry data remains inert evidence. Reduced manifests are test inputs.

[preview.json](preview.json) preserves normalized entries from the complete pinned checkout with the reviewed Curation Overlay, including its full-checkout prerequisite identities. Reduced YAML inputs reproduce Modifiers, Sources and Notes; omitted out-of-batch identities remain unresolved in reduced imports. Every player-facing Sources list remains empty.

There are **no admitted candidates**. All 100 have content-bound unresolved Attribution Assessments. The editorial dispositions are 97 held definitions and three explicitly unsupported/prose-only Mythic definitions; the latter keep their separate attribution holds. The [legal inventory](../../../scripts/catalog/legal/feats-336.json) retains exact evidence, individual comparisons, notice holds, prerequisite/proficiency omissions and outstanding mechanics. Numeric review cannot clear those holds.

The public resolver tests demonstrate exact source-backed output: Sea Legs +2 Acrobatics/Climb/Swim; Advanced Defensive Combat Training +4 CMD; Reach Defense +2 dodge only against opportunity attacks from nonadjacent opponents; Focused Phantom +4 concentration in its single union Situation; Casual Illusionist +2/+4 racial bonuses around level 10; Persuasive Bribery +2 Diplomacy without double-counting its two qualifying cases; Saddle Shrieker’s uncapped self attack/CMB penalties; and Greater Uncivilized Tactics +2 on its specific maneuver. Ordinary totals never receive local conditional bonuses automatically.

The two required Aberration-Bane Caster notes bind the exact source strings. Its description supplies the readable rule once; favored-enemy-dependent spell DC and spell-resistance checks remain outstanding. No caster-level increase or fabricated unconditional DC bonus is supplied.

[sheet.ts](sheet.ts) adapts real reviewed definitions into explicitly named Character Catalog Entries for isolated saved-sheet tests. It retains rule identity, description, prerequisites, Modifiers, Sources and Notes, omitting only the unusable `repeatable: unreviewed` sentinel. It adds no inferred repeatability facts. The isolated Convex flow tests saved selection, replacement, deactivation, owner/member reads and denied unauthorized/cross-campaign access. These Character-local preview copies demonstrate mechanics only; they do not admit held definitions to the global catalog, prepare a Catalog Release or change remote data.

```sh
pnpm test tests/catalog/feats-336.test.ts convex/feats336.integration.test.ts --maxWorkers=1
```
