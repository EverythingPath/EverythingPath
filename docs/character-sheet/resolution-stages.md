## Resolution stages

Each stage groups and stacks. There is no priority field. These stages describe the ordinary single-sheet calculation. Companion Progression and Combined Forms follow their rule-specific inputs and operation order under "Companions"; ordinary per-Hit-Die formulas do not override explicit companion tables or allocated component budgets.

1. **Ability scores:**
   - the base scores;
   - `ability.*` Modifiers, with race bonuses counted as stacking racial Modifiers;
   - Class Level ability increases, as untyped built-in Modifiers;
   - ability drain, lowering the score.
2. **Ability modifiers:** `floor((score − 10) / 2)`, minus `floor(damage points / 2)` of that ability's ability damage. The score itself doesn't change.
3. **Class bases:**
   - BAB and base saves are computed per class from its progression, floored, and summed across classes. A race's `racialProgression` is one more source, computed from `racialHitDice`.
   - Hit Dice are computed here.
4. **Dependent statistics:**
   - **AC leaves:** with Dex as a built-in Modifier on `ac.other`, capped by the lowest max Dex among active armor and shields, and their bonuses on `ac.armor` and `ac.shield` (see "Armor and shields").
   - **Saves, skills and initiative:**
     - Skills combine ranks (`base`), the class-skill +3, the ability modifier and armor check penalty, the sum over active armor and shields.
   - **Hit points:**
     - `hpGained` per Class Level, and the race's `racialHpGained`;
     - the favored class bonus;
     - the Con modifier × Hit Dice.
   - **Attack, CMB and CMD.**
   - **Spellcastings:** caster level, spells per day, spells known, DCs and concentration (see "Spellcasting").

BAB, base saves, HP per level, ranks, the class-skill +3, Dex to AC, ability increases, favored class bonuses, ability damage, and an item's armor bonus, enhancement and masterwork are all built-in Modifiers. That way they appear in the same breakdown as item bonuses.

### Derived statistics

These follow the literal text:

| Statistic       | Built from                                                                                                                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC              | 10 + every AC leaf                                                                                                                                                                                          |
| Touch AC        | AC without `ac.armor`, `ac.shield` and `ac.natural`, including enhancements to them                                                                                                                         |
| Flat-footed AC  | AC without the Dex bonus and dodge bonuses                                                                                                                                                                  |
| CMB             | BAB + Str modifier + special size modifier (Dex for Tiny and smaller) + `cmb` Modifiers                                                                                                                     |
| CMD             | 10 + BAB + Str modifier + Dex modifier + special size modifier + every circumstance, deflection, dodge, insight, luck, morale, profane and sacred AC bonus + every AC penalty except size + `cmd` Modifiers |
| Flat-footed CMD | CMD without the Dex bonus; dodge bonuses stay                                                                                                                                                               |

The special size modifier, the AC size modifier and the attack size modifier come from the Character's size. That size also gives Stealth and Fly a `size` modifier (Small +4 and +2, Large −4 and −2; Halfling, CRB p. 26, and Fly, CRB p. 96), from the same table familiars use. A familiar's base creature and an active companion keep their own, and a combined form takes its eidolon's ([#720](https://github.com/AndreasUnunger/EverythingPath/issues/720)).

Untyped AC bonuses don't reach CMD. Armor's max Dex doesn't cap the Dex in CMD, and the AC size modifier doesn't reach CMD.

CMD applies the normal same-type stacking rule after composing its admitted AC contributions and direct `cmd` Modifiers (CRB p. 208, [Combining Magical Effects](https://legacy.aonprd.com/coreRulebook/magic.html#combining-magical-effects)). A +2 deflection bonus to AC and a +3 deflection bonus to CMD yield +3 to CMD, even from the same entry. Ordinary same-entry contributions of a nonstacking type keep the strongest contribution before comparing entries; explicit `stacksWithinEntry` contributions remain combined. Typed penalties keep the worst per type, while resolved untyped penalties on different leaves remain summed. AC leaves still compose separately, including armor and shield enhancements.
