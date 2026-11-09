import type { FunctionReturnType } from 'convex/server';
import type { api } from '../convex/_generated/api';

type PermanentSheet = Pick<
  NonNullable<FunctionReturnType<typeof api.characterSheet.read>>,
  'permanentCalculated'
> | null;

// What a companion's own permanent sheet says the militia should read: its
// level, actual Hit Dice and six permanent scores.
export function permanentMilitiaFacts(sheet: PermanentSheet) {
  if (!sheet) throw new Error('Missing companion sheet');
  const { level, hitDice, abilities } = sheet.permanentCalculated;
  return {
    level,
    actualHitDice: hitDice,
    strength: abilities.strength.score,
    dexterity: abilities.dexterity.score,
    constitution: abilities.constitution.score,
    intelligence: abilities.intelligence.score,
    wisdom: abilities.wisdom.score,
    charisma: abilities.charisma.score,
  };
}
