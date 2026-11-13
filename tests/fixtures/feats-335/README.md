# Feats #335 fixtures

The 100 YAML files preserve the exact [#335](https://github.com/AndreasUnunger/EverythingPath/issues/335) candidates from pf1-content 11.4.0, commit `02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d`. [provenance.json](provenance.json) binds each identity to its original path, complete-file SHA-256 and raw-description SHA-256. Action fields and Foundry scripts remain inert evidence. The reduced version manifests are test inputs, not copies of complete checkout manifests.

Skill Focus (Stealth) has its own accepted, content-bound Attribution Assessment and PZO1110 notice requirement. The other 99 definitions remain held. Numeric review does not establish admission. The [batch inventory](../../../scripts/catalog/legal/feats-335.json) records individual source evidence, disposition, comparison limitations and outstanding mechanics. The admission test accounts for all 100 candidates and admits only Skill Focus (Stealth).

[preview.json](preview.json) preserves normalized entries from complete pinned-checkout extraction with the reviewed Curation Overlay. Full-checkout prerequisite and linked-definition facts remain visible. Reduced YAML inputs reproduce the Modifiers, Sources and Situational Notes while leaving missing out-of-batch references unresolved.

The public resolver tests pin these source facts:

- Steadfast Personality replaces a positive Wisdom bonus with Charisma for Will saves against mind-affecting effects. A Wisdom penalty remains and Charisma is added. Wisdom 14/Charisma 18 gives ordinary Will +2 and conditional Will +4; Wisdom 8/Charisma 18 gives -1 and +3; Wisdom 14/Charisma 8 gives +2 and -1.
- Skill Focus (Stealth) gives +3 below 10 ranks or +6 at 10 or more, when its exact rank Situation is explicitly selected. Automatic dispatch by skill ranks remains outstanding because the closed formula grammar cannot read ranks. No unconditional bonus is substituted.
- Out of the Sun gives +2 circumstance to the feat's feint in bright light, increased to +4 in natural sunlight. Ordinary Bluff stays unchanged and overlapping Situations never give +6.
- Edge Runner gives +4 Climb to catch yourself falling and +4 saves against effects causing a fall into a pit. Ordinary checks/saves and CMD stay unchanged.
- Just Out of Reach gives +4 dodge AC only against reach melee attacks from more than 5 feet away.
- Empath's one-minute penalty after opening defenses is -4 against fear or mind-affecting effects, and overlapping Situations do not produce -8.

[sheet.ts](sheet.ts) adapts reviewed Steadfast Personality and Skill Focus (Stealth) into explicitly named Character Catalog Entries for isolated tests. It preserves rule identity, description, Modifiers, Sources and Notes. The unusable `repeatable: unreviewed` field is omitted without supplying an inferred repeatability fact. Skill Focus's choice and repeatability automation remain outstanding.

The isolated Convex test inserts bodies into one Character's empty test database. Public mutations and queries as owner and organization member demonstrate saved edits, deactivation, replacement and the application catalog preview. Will is +2 ordinarily and +4 in the mind-affecting preview; deactivation returns +2. Replacing the Selection with Skill Focus demonstrates its explicit +3/+6 rank previews. Unauthenticated, outsider and wrong-campaign access fails. No Catalog Release is prepared or activated and no remote data is changed.

```sh
pnpm test tests/catalog/feats-335.test.ts convex/feats335.integration.test.ts --maxWorkers=1
```
