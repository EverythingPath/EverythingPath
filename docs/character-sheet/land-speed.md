## Land speed

The owner decided on 2026-11-17 that the sheet computes **land speed**: the race's base speed, its typed bonuses (Fast Movement, Fleet, haste, longstrider), and the reduction for medium or heavy armor. Carried load stays a Note and encumbrance stays out of scope (PRD #251's "encumbrance" exclusion); climb, swim, fly and burrow speeds are not computed.

### Statistic

- **Target.** `speed.land` is a Modifier target, in feet ([Modifiers](modifiers.md#targets)). Its bonuses stack as any target's do ([Stacking](stacking.md)): two enhancement bonuses (haste's +30, longstrider's +10) don't stack, untyped bonuses do.
- **Base.** A race gives its base speed as a `base` Modifier on `speed.land` (Foundry races' `speeds.land`). `base` doesn't stack, so one race speed applies.
- **Conditions.** A bonus that holds only in light or medium armor carries `armorAtMost` ([Modifiers](modifiers.md)); in heavier armor it is suppressed with its reason, such as "Lost while wearing Full plate (heavy armor).".
- **No base, no speed.** Without a `base` Modifier, the sheet shows no land speed (`derivedStatistics.landSpeed` is absent), so a race no release has given a speed shows none rather than 0 or a bonus alone.

### Armor reduction

`deriveLandSpeed({ statistic, wornArmor, armorTrainingTier, exemption })` (`src/lib/character-sheet-speed.ts`) gives `derivedStatistics.landSpeed` from the `speed.land` statistic:

- **The reduction.** While the heaviest armor worn (an active armor item; never a shield or a Spell Effect) is medium or heavy, the total is reduced after its bonuses: 20 ft. to 15 ft., 30 ft. to 20 ft., 40 ft. to 30 ft., `speed − 5 · floor(speed / 15)`. The PRD capture's gnoll, base 30 ft., in +1 scale mail has Speed 20 ft. (`monsterCodex/gnolls.html:558`); Foundry gives the same rule (`ActorPF.getReducedMovementSpeed`) and its armor items list "Speed (30 ft.) 20 ft.; Speed (20 ft.) 15 ft.". Bonuses come first: "Apply this bonus before modifying the barbarian's speed because of any load carried or armor worn" (CRB `barbarian.html:381`). The reduction is a line in the breakdown under the armor's name, such as "Chainmail (medium armor) −10".
- **Armor Training** lifts it: "a fighter can also move at his normal speed while wearing medium armor. At 7th level, a fighter can move at his normal speed while wearing heavy armor" (PRD `coreRulebook/classes/fighter.html:384`), so tier 1 (3rd level) in medium armor and tier 2 (7th level) in heavy armor. The tier is `armorTrainingTier`'s ([Weapons and armor](weapons-and-armor.md)).
- **Slow and Steady** lifts it: a dwarf's "speed is never modified by armor or encumbrance" (PRD `advancedRaceGuide/coreRaces/dwarves.html:362`), while the dwarf's Slow and Steady racial trait (`pf1-content/JsvoElxHBPdle8s8`, rule key `slow-and-steady`) is active.
- A lifted reduction is listed as suppressed with its reason, such as "Armor Training 1: moves at normal speed in medium armor."
- A Temporary Effect's bonus and armor leave the permanent projection, as for every statistic.

The sheet shows it as "Speed" beside Initiative in Offense, such as "20 ft.", with the breakdown every Offense figure opens (`offense-block.tsx`).

Tests: `src/lib/character-sheet-speed.test.ts` (30 to 20 and 20 to 15 in medium and heavy armor, Fast Movement in medium and lost in heavy, enhancement bonuses, Armor Training tiers, Slow and Steady, a shield, no base speed, both projections), `convex/characterSheetSpeedMaxima.integration.test.ts` (a race copy without a speed reads as before; the saved sheet for owner, member and outsider), `src/components/character-sheet/offense-block.test.tsx`.

### What carries a speed yet

No released row does. The race speeds, Foundry's `landSpeed` changes and the reviewed Fast Movement and Fleet replacements follow as their own catalog slice; until then no party sheet shows a Speed.
