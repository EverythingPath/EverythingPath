## Stacking

Modifiers are grouped by (leaf target, bonus type).

**Bonuses:**

| Rule         | Types                                        |
| ------------ | -------------------------------------------- |
| stack        | `dodge`, `racial`, `untyped`, `circumstance` |
| highest only | every other type, `base` included            |

**Penalties.** Untyped penalties sum. Typed penalties take the worst of their type. That honours both the CRB's "most penalties stack" and its magic chapter's same-type rule.

**Same Source.**

- A Modifier's Source is its Catalog Entry's `sourceKey`, or its stored `ruleIdentity` when the key is absent. A Catalog Copy retains its original's effective Source even after edits, without reading an original definition; a distinct Catalog Entry represents a distinct rule.
- Distinct rules share a key only where official text makes them one effect: _haste_, _boots of speed_ and the _speed_ property share `haste`, and a spell-like ability shares the key of the spell it names. Where the rules are silent, distinct rules stay separate, and bonus type decides.
- Among active entries of one Source, per target, the entry with the largest net contribution applies when any entry has a positive net. When all entries have nonpositive nets, the most negative net applies, including when another entry contributes zero. The others are listed as suppressed by the winner. This refines PRD §8's "largest net" wording for penalties using the CRB magic chapter's worst-penalty and same-effect highest-strength readings ([#209](https://github.com/AndreasUnunger/EverythingPath/issues/209)); the broader same-source penalty rule remains ambiguous in the CRB.
- `stacksWithItself` lifts this rule for text that says duplicates stack, such as sneak attack, trap sense, and the myrmidarch's "as the fighter ability".
- Within one entry, two Modifiers of the same type and target don't stack. Only Modifiers that apply count, so two Situations of one entry never suppress each other. The rule fits the dataset: a note that raises an entry's bonus in a Situation usually gives the new total ("increases to +4"), and one bonus against several Situations (dwarf _hardy_) never counts twice.
- `stacksWithinEntry` marks a Modifier whose text says it adds to another bonus of its own entry. Decided by [Decide how bonuses on one entry stack when their text says so](https://github.com/AndreasUnunger/EverythingPath/issues/230).
  - Per target and type, an entry contributes its largest unmarked Modifier plus every marked one, even where the type wouldn't stack. That contribution then stacks with other entries by type.
  - Only the Curation Overlay sets it. The drafter flags "stacks with" wordings that point back at the same entry, and a reviewer confirms each. At the pins three entries need it: _Overlooked Mastermind_'s feign-ignorance +2, _Good Influence_'s second +1, and _Elixir of the Peaks_'s mountain +10.
  - Halfling _fearless_ and halfling luck don't need it: they are separate Racial Traits, so their racial bonuses stack.
- The built-in Modifiers use fixed Sources where the FAQ names them. The class-skill +3 applies once per skill, however many classes grant it.

**Duplicated class features.** A feature taken from two classes that the rules upgrade, such as Uncanny Dodge becoming Improved Uncanny Dodge, gets an advisory prompt to add the upgraded feature. It is never changed automatically.

The resolver reports `applied` and `suppressed` for every statistic, and the sheet shows the breakdown on hover.
