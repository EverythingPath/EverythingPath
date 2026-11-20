import type { FeatureNumber } from '~/lib/character-sheet';
import { formatSigned } from './equipment-statistics';
import { unresolvedValue } from './sheet-parts';

/**
 * The text of an entry's dice chips (rule values): the dice, such as
 * Channel Energy's 3d6, then each dice increase that added (rotation-5
 * fix r1), naming its source: "+2d6 from Phylactery of Positive Channeling".
 * Dice that do not resolve show as unresolved, with no increase (fix r2).
 * The rule value table test reads the row through it.
 */
export function featureNumberChips(number: FeatureNumber): {
  dice: string;
  increases: { entryId: string; text: string }[];
} {
  if (number.count === null)
    return { dice: `${unresolvedValue} d${number.die}`, increases: [] };
  return {
    dice: `${number.count}d${number.die}`,
    increases: (number.increases ?? []).map(({ entryId, count, name }) => ({
      entryId,
      text: `${formatSigned(count)}d${number.die} from ${name}`,
    })),
  };
}
