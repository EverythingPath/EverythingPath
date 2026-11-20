import type { DailyMaximum, FeatureNumber } from '~/lib/character-sheet';
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

type NotCountedLine = NonNullable<DailyMaximum['notCounted']>[number];

/**
 * The text of a muted chip for an increase not counted (rotation-6),
 * beside the maximum or dice it would raise: an increase of the same Source
 * as one that counts, or one whose entry has no saved choice it adds for:
 * none recorded yet, another one, or an entry whose choice cannot affect
 * the increase, which never counts (fix r3; fix r4: such an entry may save a
 * choice, so the chip does not say it can't).
 */
export function notCountedChip(line: NotCountedLine) {
  switch (line.reason) {
    case 'sameSource':
      return line.counted.name === line.name
        ? `${line.name} not counted: copies don’t stack`
        : `${line.name} not counted: doesn’t stack with ${line.counted.name}`;
    case 'noChoice':
      return `${line.name} not counted: no choice recorded`;
    case 'choiceNotRead':
      return `${line.name} never counted: its choice can’t affect this increase`;
    case 'otherChoice':
      return `${line.name} not counted: chosen for ${line.choice}`;
  }
}
