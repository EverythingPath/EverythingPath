## Racial Hit Dice

Decided by [Decide how a Character Sheet models racial Hit Dice beyond the count](https://github.com/AndreasUnunger/EverythingPath/issues/222).

- **Rules sources.** No FAQ or errata covers how racial Hit Dice meet level-keyed rules. The CRB, the CRB FAQ and Paizo's own stat blocks decide what they can. The Bestiary's creature-type table arrives as catalog content; its monster cohort equivalence rules are narrowly admitted under "Companions". Its general rules for adding racial Hit Dice and for Monsters as PCs (CR counted as class levels) remain out of scope, and a Monster PC's level-equivalence is the GM's call.
- **On the race.** The race fixes the count, so `racialHitDice` and `racialProgression` live on the race entry, in the class detail's vocabulary. Foundry race records carry no count, so every imported race has 0. A race with racial Hit Dice is a campaign or character Catalog Copy, with the count and progression set by hand. A Character keeps its custom count and progression through race switches until the player discards them (#727).
- **Seeding.** Choosing a creature type fills `racialProgression` from the creature-type seed table (see "Global catalog import"). Every seeded field stays editable, because type features hold "unless otherwise noted" and humanoid and outsider good saves vary.
- **Choices on the sheet.** The race sheet entry records `racialHpGained`, one plain number for all racial Hit Dice, never pre-filled. It gets no favored class bonus and no maximized first Hit Die (CRB FAQ). It also records `racialSkillRanks`. Feats from racial Hit Dice are ordinary feat entries.
- **Ability increases.** Racial Hit Dice have no ability increase field. The rules are silent when racial Hit Dice and Class Levels mix, so the increase warning accepts either reading: the Class Level's character level or its Hit Dice count.
- **Level-keyed rules.**

  | Rule                                                                                               | Reads              | Basis                                                                                                   |
  | -------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------- |
  | Character level: prerequisites such as Leadership, "1/2 your character level", the level-0 warning | Class Levels only  | CRB definition; Paizo keeps character level and Hit Dice apart (familiar rule, monster DCs by Hit Dice) |
  | Feat count                                                                                         | Hit Dice           | CRB "based off their Hit Dice"; Monster Codex stat blocks                                               |
  | Maximum ranks per skill                                                                            | Hit Dice           | CRB "your total number of Hit Dice"                                                                     |
  | BAB                                                                                                | per source, summed | CRB FAQ (Monk): racial Hit Dice BAB "adds normally"                                                     |
  | Base saves                                                                                         | per source, summed | CRB multiclassing rule; Paizo stat blocks add a racial and a class good save +2 each                    |
  | Skill ranks per Hit Die                                                                            | per source, summed | CRB multiclassing rule                                                                                  |

- **Type quirks.** Construct bonus hit points by size and undead Cha-for-Con hit points are hand-entered `hp` Modifiers on the race Catalog Copy. Mindless creatures (no Int score) are not supported.
