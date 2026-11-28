'use client';

import type { Id } from '@convex/_generated/dataModel';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import {
  personalBonusTypes,
  modifierTargets,
  personalAdjustmentConditionSchema,
} from '~/lib/character-sheet';
import { useSheetFormState } from './use-sheet-form-state';
import {
  useSheetFormSave,
  type SheetFormSaveOutcome,
} from './use-sheet-form-save';
import type { PersonalAdjustmentInput } from './use-character-sheet';

import { numberPattern } from './numeric-form-fields';
const catalogEntryId = z.custom<Id<'catalogEntry'>>(
  (value) => typeof value === 'string' && value.length > 0,
);
const situationOptions =
  personalAdjustmentConditionSchema.shape.situation.unwrap().options;
const conditionSchema = personalAdjustmentConditionSchema.extend({
  situation: z
    .union([
      situationOptions[0],
      situationOptions[1],
      situationOptions[2].extend({ option: catalogEntryId }),
    ])
    .optional(),
  whileActive: catalogEntryId.optional(),
});
const schema = z.object({
  name: z
    .string()
    .refine((value) => value.trim().length > 0, 'Adjustment name is required'),
  modifiers: z.array(
    z
      .object({
        target: z.enum(modifierTargets),
        bonusType: z.enum(personalBonusTypes),
        value: z.string(),
        valueKind: z.enum(['number', 'formula']).optional(),
        condition: conditionSchema.optional(),
      })
      .superRefine((modifier, context) => {
        const value = modifier.value.trim();
        if (!value)
          context.addIssue({
            code: 'custom',
            path: ['value'],
            message:
              modifier.valueKind === 'formula'
                ? 'Formula is required'
                : 'Modifier value is required',
          });
        else if (modifier.valueKind === 'formula') {
          if (value.length > 4096)
            context.addIssue({
              code: 'custom',
              path: ['value'],
              message: 'Formula is too long',
            });
        } else if (
          !numberPattern.test(value) ||
          !Number.isFinite(Number(value))
        )
          context.addIssue({
            code: 'custom',
            path: ['value'],
            message: 'Modifier value must be a number',
          });
        else if (
          modifier.target.startsWith('ability.') &&
          !Number.isSafeInteger(Number(value))
        )
          context.addIssue({
            code: 'custom',
            path: ['value'],
            message: 'Ability score modifiers must be whole numbers',
          });
      }),
  ),
});
type Values = z.infer<typeof schema>;
export type PersonalAdjustmentSaveOutcome = SheetFormSaveOutcome;
const emptyModifier: Values['modifiers'][number] = {
  target: 'ability.str',
  bonusType: 'untyped',
  value: '',
};

function formValues(adjustment?: PersonalAdjustmentInput): Values {
  return adjustment
    ? {
        name: adjustment.name,
        modifiers: adjustment.modifiers.map(
          ({ target, bonusType, value, condition }) => ({
            target,
            bonusType: z.enum(personalBonusTypes).parse(bonusType),
            value: typeof value === 'number' ? String(value) : value.formula,
            ...(typeof value === 'number'
              ? {}
              : { valueKind: 'formula' as const }),
            ...(condition
              ? {
                  condition: {
                    situation: condition.situation,
                    whileActive: condition.whileActive,
                    castingClass: condition.castingClass,
                    school: condition.school,
                  },
                }
              : {}),
          }),
        ),
      }
    : { name: '', modifiers: [{ ...emptyModifier }] };
}
function toInput(values: Values): PersonalAdjustmentInput {
  return {
    name: values.name.trim(),
    modifiers: values.modifiers.map(({ valueKind, value, ...modifier }) => ({
      ...modifier,
      value:
        valueKind === 'formula' ? { formula: value.trim() } : Number(value),
    })),
  };
}

export function usePersonalAdjustmentForm({
  adjustment,
  save: write,
}: {
  adjustment?: PersonalAdjustmentInput;
  save: (input: PersonalAdjustmentInput) => Promise<unknown>;
}) {
  const state = useSheetFormState({
    incoming: formValues(adjustment),
    resolver: zodResolver(schema),
    // Merging array indexes could attach another player's value to a different
    // modifier after a row is removed. Keep the modifier list as one draft.
    draftPolicy: 'whole',
  });
  const { form } = state;
  const fields = useFieldArray({ control: form.control, name: 'modifiers' });
  const saving = useSheetFormSave({
    state,
    normalize: (values) => {
      const input = toInput(values);
      return { values: formValues(input), input };
    },
    normalizeDraft: (values) => {
      const parsed = schema.safeParse(values);
      return parsed.success ? formValues(toInput(parsed.data)) : undefined;
    },
    write,
  });
  return {
    form,
    fields: fields.fields,
    addModifier: () => fields.append({ ...emptyModifier }),
    removeModifier: fields.remove,
    status: saving.status,
    hasRemoteChange: state.hasRemoteChange,
    dismissRemoteChange: state.dismissRemoteChange,
    save: saving.save,
    saveAdditionalChanges: saving.saveAdditionalChanges,
  };
}
