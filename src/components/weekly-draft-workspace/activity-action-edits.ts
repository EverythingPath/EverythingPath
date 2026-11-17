import { z } from 'zod';
import type { OrganizationCheck } from '~/lib/rules-officers';
import {
  actionChoiceRolls,
  type RawRoll,
  type StagedActionChoice,
} from '~/lib/weekly-draft-facts';
import {
  destinationFromValue,
  type DetailRollField,
  type PeopleTeamActionId,
} from './activity-action-detail';

// Named field edits for the people and team detail editors. Each builds the
// next value of one choice field and hands it to `change`, which validates
// the complete choice and stages it as one detail edit. Passing `undefined`
// omits the field, which is the existing explicit clear. Nothing else on the
// choice is touched, so inapplicable values stay until replaced or cleared.

type Choice = Extract<StagedActionChoice, { actionId: PeopleTeamActionId }>;
type Modifier = RawRoll['modifiers'][number];
// Returns false when the resulting choice is structurally invalid; the caller
// shows why beside the field.
export type ChangeField = (field: string, value: unknown) => boolean;

// The field edits every detail editor shares: plain set/clear, the dice
// rolls with their table modifiers, and consumables.
export function commonFieldEdits(
  choice: StagedActionChoice,
  change: ChangeField,
) {
  const rolls = actionChoiceRolls(choice);
  // A blank total clears the roll through the existing omission.
  function setRoll(field: DetailRollField, roll: RawRoll | null) {
    const map: Record<string, RawRoll> = { ...rolls };
    if (roll) map[field] = roll;
    else delete map[field];
    return change('rolls', Object.keys(map).length ? map : undefined);
  }
  function modifiers(
    field: DetailRollField,
    update: (current: Modifier[]) => Modifier[],
  ) {
    const roll = rolls[field];
    return roll
      ? setRoll(field, { ...roll, modifiers: update(roll.modifiers) })
      : false;
  }
  const consumables = choice.consumableIds ?? [];
  function writeConsumables(next: string[]) {
    return change('consumableIds', next.length ? next : undefined);
  }
  return {
    set(field: string, value: unknown) {
      return change(field, value);
    },
    clear(field: string) {
      return change(field, undefined);
    },
    setRoll,
    addRollModifier(field: DetailRollField, modifier: Modifier) {
      return modifiers(field, (current) => [...current, modifier]);
    },
    // Removes exactly the recorded entry at `index`.
    removeRollModifier(field: DetailRollField, index: number) {
      return modifiers(field, (current) =>
        current.filter((_, position) => position !== index),
      );
    },
    addConsumable(bonusId: string) {
      return consumables.includes(bonusId)
        ? true
        : writeConsumables([...consumables, bonusId]);
    },
    removeConsumable(bonusId: string) {
      return writeConsumables(consumables.filter((id) => id !== bonusId));
    },
  };
}
export type CommonFieldEdits = ReturnType<typeof commonFieldEdits>;

export function actionFieldEdits(choice: Choice, change: ChangeField) {
  return {
    ...commonFieldEdits(choice, change),
    // Rescue: headquarters, or `refuge:<settlementId>`; null clears.
    setDestination(value: string | null) {
      return change(
        'destination',
        value === null ? undefined : destinationFromValue(value),
      );
    },
    setRecruitmentCheck(check: RecruitmentCheckInput | null) {
      return change('recruitmentCheck', check ?? undefined);
    },
  };
}
export type ActionFieldEdits = ReturnType<typeof actionFieldEdits>;

// The table-chosen recruitment check for a team type without recruitment
// rules: a check kind and a whole-number DC, both required.
export const recruitmentCheckFormSchema = z.object({
  check: z.enum(['loyalty', 'secrecy', 'security'], {
    error: 'Choose a check.',
  }),
  dc: z
    .string()
    .trim()
    .min(1, 'Enter the DC.')
    .regex(/^\d*$/, 'Use digits only.')
    .refine((value) => Number.isSafeInteger(Number(value)), {
      message: 'Enter a smaller whole number.',
    }),
});
export type RecruitmentCheckForm = z.input<typeof recruitmentCheckFormSchema>;
export type RecruitmentCheckInput = { check: OrganizationCheck; dc: number };
export function recruitmentCheckFromForm(
  form: z.output<typeof recruitmentCheckFormSchema>,
): RecruitmentCheckInput {
  return { check: form.check, dc: Number(form.dc) };
}
