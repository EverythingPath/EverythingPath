# Feats #337 fixtures

The 100 YAML files preserve the exact [#337](https://github.com/AndreasUnunger/EverythingPath/issues/337) candidates from pf1-content 11.4.0, commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`. [provenance.json](provenance.json) records original paths, whole-file SHA-256 and raw-description SHA-256. Source action fields and scripts stay inert evidence. Reduced version manifests configure the test inputs; they are not copies of the full checkout manifests.

All 100 candidates remain held for unresolved attribution. Reviewed Modifiers and isolated previews do not establish notice coverage or release admission. The [batch inventory](../../../scripts/catalog/legal/feats-337.json) records each disposition, comparison boundary, notice hold and outstanding calculation. Calculations remain outstanding independently of attribution holds.

[preview.json](preview.json) preserves normalized entries from the complete pinned-checkout extraction with its reviewed Curation Overlay. The reduced source import reproduces numerical Modifiers, Sources and Situational Notes. Prerequisites and links retain their full-checkout results in the preview; missing out-of-batch definitions are not invented in the reduced fixtures.

The 2026-10-08 fix round regenerated all normalized bodies, raw source files and provenance after adding the Pathfinder Unchained (PZO1131) notice minimum to the 18 Combat Trick entries. Those fixture bytes remain unchanged. All 100 Attribution Assessment bindings were refreshed against the complete extraction; the notice-hold test pins the 18 required PZO1131 references, and the Cockatrice Strike comparison test pins PCGen’s exact `PRETOTALAB:14` tag while keeping the source’s BAB +16.

Public resolver tests pin real source values:

- Scarred Legion adds +2 Intimidate ordinarily and +2 morale Will only beside an ally with the feat, or through the specified charge carryover.
- Snake Sidewind adds +4 CMD only in its local defensive trip Situation; the shared offensive trip Situation does not activate it. Its separate +4 Acrobatics and saves apply only to avoiding being knocked prone.
- Shadow Dodge adds +3 dodge AC only in its movement, light and opponent-sight circumstance. Selecting charging alone does not activate it.
- Drunken Brawler adds +2 alchemical Fortitude and Will for one hour or until its temporary hit points are lost. Its separate Reflex penalty remains -2 for a full hour. Copies sharing its rule identity never double these numbers.
- Champion of Destruction adds +2 damage against lawful creatures and +2 against good creatures. Those contributions add to +4 against a lawful good creature within the same entry; copies sharing its Source never double that +4.
- Deny the Reaper adds +2 Heal below 10 ranks or +4 at 10 ranks. Its manually selected tiers never add to +6 if both are selected; automatic rank dispatch remains outstanding.

[sheet.ts](sheet.ts) adapts these reviewed bodies into explicitly named `Held fixture:` Character Catalog Entries. It preserves rule identity, descriptions, Modifiers, Sources and Notes; it omits the unusable `repeatable: unreviewed` field without supplying an inferred replacement fact.

The in-memory Convex test materializes Scarred Legion and Snake Sidewind only in one isolated Character's catalog. It drives ordinary public mutations as an organization member and reads as the owner, compares saved calculations with the application's catalog preview, verifies deactivation and replacement, and rejects unauthenticated, outsider and wrong-campaign operations. No global Catalog Entry, Attribution Assessment or Catalog Release is published, and no remote data is written.

```sh
pnpm test tests/catalog/feats-337.test.ts convex/feats337.integration.test.ts --maxWorkers=1
```
