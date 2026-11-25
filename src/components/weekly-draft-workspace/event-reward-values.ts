import { z } from 'zod';
import { copperToGpInput, parseGpInput } from '~/lib/gp-money';
import { eventOccurrenceSchema } from '~/lib/weekly-draft-facts';
import type { EventReward } from './types';
import type { EventRewardInput } from './use-event-edits';

// The Found Fire reward form's pure half: raw text values, their field-level
// validation into the strict saved reward, and a fresh item identity for a
// new one. Values are held as text, so a blank or malformed entry stays in
// its field with its own error and is never coerced; the value is entered in
// gp and stored in copper without losing a copper piece.

const rewardSchema = eventOccurrenceSchema.shape.rewards.unwrap().element;

export const rewardFormValuesSchema = z.object({
  recipient: z.string(),
  name: z.string(),
  // gp, up to two decimal places.
  value: z.string(),
  // lb, any decimal.
  weight: z.string(),
  alchemical: z.boolean(),
  poison: z.boolean(),
});
export type RewardFormValues = z.infer<typeof rewardFormValuesSchema>;

/**
 * A recorded reward's values, or a new reward's for `recipient`: Found Fire
 * offers alchemical items, so a new one starts alchemical and not poison.
 */
export function rewardFormValues(
  reward: Pick<
    EventReward,
    'characterId' | 'name' | 'valueCopper' | 'weight' | 'alchemical' | 'poison'
  > | null,
  recipient: string,
): RewardFormValues {
  if (!reward)
    return {
      recipient,
      name: '',
      value: '',
      weight: '',
      alchemical: true,
      poison: false,
    };
  return {
    recipient: reward.characterId,
    name: reward.name,
    value: copperToGpInput(reward.valueCopper),
    weight: String(reward.weight),
    alchemical: reward.alchemical,
    poison: reward.poison,
  };
}

/** A new reward's item identity, made once when its form opens. */
export function newRewardItemId() {
  return `reward:${crypto.randomUUID()}`;
}

function parseWeight(text: string) {
  const trimmed = text.trim();
  if (trimmed === '') return { kind: 'empty' } as const;
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(trimmed))
    return {
      kind: 'invalid',
      message: 'Enter a weight in lb, such as 1 or 0.5.',
    } as const;
  return { kind: 'valid', weight: Number(trimmed) } as const;
}

/**
 * Raw values → the saved reward with this item identity, with an error on
 * each field that is missing (its own message) or malformed. `recipients`
 * are the characters the reward may name: the active PCs, plus the one it
 * already names so an older entry can be edited before it is moved.
 */
export function rewardFormSchema(
  recipients: readonly string[],
  itemId: string,
) {
  return rewardFormValuesSchema.transform(
    (values, context): EventRewardInput => {
      let hasIssue = false;
      const issue = (path: keyof RewardFormValues, message: string) => {
        hasIssue = true;
        context.addIssue({ code: 'custom', path: [path], message });
      };
      if (!values.recipient) issue('recipient', 'Choose who receives it.');
      else if (!recipients.includes(values.recipient))
        issue(
          'recipient',
          'This character is not in the militia. Choose a PC.',
        );
      const name = values.name.trim();
      if (!name) issue('name', 'A name is required.');
      const value = parseGpInput(values.value);
      if (value.kind === 'empty') issue('value', 'A value in gp is required.');
      if (value.kind === 'invalid') issue('value', value.message);
      const weight = parseWeight(values.weight);
      if (weight.kind === 'empty') issue('weight', 'A weight is required.');
      if (weight.kind === 'invalid') issue('weight', weight.message);
      if (hasIssue || value.kind !== 'valid' || weight.kind !== 'valid')
        return z.NEVER;
      const parsed = rewardSchema.safeParse({
        itemId,
        characterId: values.recipient,
        name,
        valueCopper: value.copper,
        weight: weight.weight,
        alchemical: values.alchemical,
        poison: values.poison,
      });
      if (parsed.success) return parsed.data;
      issue('name', 'This reward cannot be saved as entered.');
      return z.NEVER;
    },
  );
}
