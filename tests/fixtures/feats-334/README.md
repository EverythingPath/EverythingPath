# Feats #334 fixtures

The 100 YAML files preserve the exact [#334](https://github.com/AndreasUnunger/EverythingPath/issues/334) candidates from pf1-content 11.4.0, commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`. [provenance.json](provenance.json) binds each identity to its original path, complete-file SHA-256 and raw-description SHA-256. Foundry action fields and scripts remain inert evidence. The version manifests are reduced test inputs, not copies of the complete checkout manifests.

All 100 candidates remain held. Neither a reviewed Modifier nor a local preview establishes Attribution Assessment acceptance, notice coverage or release admission. The [batch inventory](../../../scripts/catalog/legal/feats-334.json) records the individual source, legal disposition, comparison limitations and outstanding mechanics. The admission test proves that no real batch candidate is admitted; candidates with broken upstream references remain reported failures rather than silently disappearing.

[preview.json](preview.json) preserves normalized entries from the complete pinned-checkout extraction with the reviewed Curation Overlay. Full-checkout link and prerequisite facts remain visible. Importing the reduced YAML fixtures reproduces the numeric Modifiers, Sources, Situational Notes and Additional Traits slot grant while reporting absent out-of-batch dependencies.

The public resolver tests pin these source facts:

- [Storm-Lashed](pf1-content/src/pf-feats/Storm_Lashed_0sNY1wvxcIYP00QQ.yaml): +2 saves against effects with the electricity descriptor **or** electricity damage, only in its local Situation. Ordinary saves remain unchanged. Rain and high-wind replacement penalties stay readable rules text rather than additive penalties. A copied Source contributes the same +2 once.
- [Feline Grace](pf1-content/src/pf-feats/Feline_Grace_0a08FtW2Qvrfaz65.yaml): +2 CMD against bull rush, grapple, overrun, reposition and trip. Offensive maneuver Situations do not grant the defensive bonus; combined defensive Situations still add only +2.
- [Flame Heart](pf1-content/src/pf-feats/Flame_Heart_17O0R6YNDttLPIBh.yaml): +1 caster level only for fire-descriptor spells in its local Situation, with fire resistance 5 retained as prose. Alchemist-level and resistance automation remain outstanding.
- [Elemental Focus](pf1-content/src/pf-feats/Elemental_Focus_1frgqDSnQFiTq0MC.yaml): +1 spell save DC only for damaging spells of the chosen energy. Same-Source copies do not stack. Choosing and retaining a new energy type for each repeat remains outstanding.
- [Additional Traits](pf1-content/src/pf-feats/Additional_Traits_1FEf5OW15eWcNoHd.yaml): the existing typed import rule grants two trait slots. Deactivation removes the grant in both current and permanent projections.
- [Explorer](pf1-content/src/pf-feats/Explorer_0kGH7ah6DQYg1ukh.yaml): the rank-dependent Knowledge bonus remains outstanding, with no unconditional +2 or +4 substituted.

[sheet.ts](sheet.ts) adapts only Storm-Lashed and Additional Traits into explicitly named `Held fixture:` Character Catalog Entries. It retains the imported identity, description, Modifiers, Sources, Notes and slot grants. The unusable `repeatable: unreviewed` field is omitted without supplying an inferred repeatability fact.

The isolated Convex test inserts these bodies directly into one Character's test database and drives public sheet mutations and reads as owner and organization member. With Fighter 1 and Constitution 14, ordinary Fortitude remains +4; the application catalog preview's selected electricity Situation yields Fortitude +6, Reflex +2 and Will +2. Deactivation restores the preview to the ordinary values. Replacing the fixture Selection with Additional Traits grants exactly two additional trait slots, and deactivation removes them. Saved results and the application preview agree. Unauthenticated, outsider and wrong-campaign operations fail. No Catalog Release is prepared, activated or published, and no remote data is written.

```sh
pnpm test tests/catalog/feats-334.test.ts convex/feats334.integration.test.ts --maxWorkers=1
```

The #335 follow-up uses #333's explicit description-review binding for three additional real records, without changing their held disposition:

- Wary Smuggler adds +5 only to Sleight of Hand to conceal small nonweapon objects on your body or one traveling animal/vehicle. Urban taking 10 stays a Note.
- Oath of the Unbound adds +2 CMB only to escape grapple/pin and +2 saves only against spells/effects that entangle or slow. Strength-check +2 stays outstanding and never changes Strength scores.
- Desert Dweller adds +4 saves only against glare blindness/dazzling or desert-mirage deception. Constitution-check +4 against thirst and other unspecified checks remain outstanding, never substituted as Constitution score bonuses.

The refreshed preview and public resolver tests assert the exact numbers, zero ordinary bonuses, the narrow Situations and another entry's inability to activate a local Situation. Each changed body requires a fresh content-bound assessment while retaining its legal hold.
