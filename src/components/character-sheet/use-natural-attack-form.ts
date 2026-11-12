'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  naturalAttackTypes,
  naturalAttackRoles,
  type NaturalAttackType,
  type NaturalAttackRole,
} from '~/lib/character-sheet-attack-types';
import {
  naturalAttackProfiles,
  cloneWeaponDetail,
  createNaturalAttackWeapon,
} from '~/lib/character-sheet-natural-attacks';
import type { SheetEntryInput } from './use-character-sheet-entries';
import { useSheetValueForm } from './use-sheet-value-form';

const schema = z.object({
  name: z.string().trim().min(1, 'Attack name is required'),
  type: z.enum(naturalAttackTypes),
  role: z.enum(naturalAttackRoles),
  isRoleExplicit: z.boolean(),
  dice: z
    .string()
    .trim()
    .superRefine((raw, context) => {
      if (!raw)
        context.addIssue({
          code: 'custom',
          message: 'Damage dice is required',
        });
      else if (!/^[1-9]\d*(?:d[1-9]\d*)?$/.test(raw))
        context.addIssue({
          code: 'custom',
          message: 'Enter damage such as 1d6 or 1',
        });
    }),
});

/** Natural weapon definitions use shared defaults and retain unrelated entry facts. */
export function useNaturalAttackForm({
  value,
  save,
}: {
  value?: SheetEntryInput;
  save: (input: SheetEntryInput) => Promise<unknown>;
}) {
  const previous = value?.detail.kind === 'item' ? value.detail : undefined;
  const natural = previous?.weapon?.naturalAttack;
  const type = natural?.type ?? 'bite';
  const defaults = createNaturalAttackWeapon(type);
  const state = useSheetValueForm({
    incoming: {
      name: value?.name ?? naturalAttackProfiles[type].name,
      type,
      role: natural?.role ?? naturalAttackProfiles[type].role,
      isRoleExplicit: natural?.role !== undefined,
      dice: previous?.weapon?.dice ?? defaults.dice ?? '',
    },
    resolver: zodResolver(schema),
    normalize: (values) => {
      const parsed = schema.safeParse(values);
      return parsed.success ? parsed.data : null;
    },
    write: (values) => {
      const source =
        previous?.weapon?.naturalAttack?.type === values.type
          ? previous.weapon
          : { ...previous?.weapon, ...createNaturalAttackWeapon(values.type) };
      return save({
        ...value,
        name: values.name,
        modifiers: value?.modifiers ?? [],
        detail: {
          ...previous,
          kind: 'item',
          consumable: previous?.consumable ?? false,
          weapon: {
            ...cloneWeaponDetail(source),
            dice: values.dice,
            naturalAttack: {
              type: values.type,
              ...(values.isRoleExplicit ||
              values.role !== naturalAttackProfiles[values.type].role
                ? { role: values.role }
                : {}),
            },
          },
        },
      });
    },
  });
  return {
    ...state,
    typeChoices: naturalAttackTypes.map((type) => ({
      type,
      ...naturalAttackProfiles[type],
    })),
    selectRole: (role: NaturalAttackRole) => {
      const options = { shouldDirty: true, shouldValidate: true };
      state.form.setValue('role', role, options);
      state.form.setValue('isRoleExplicit', true, options);
    },
    selectType: (type: NaturalAttackType) => {
      const options = { shouldDirty: true, shouldValidate: true };
      state.form.setValue('type', type, options);
      state.form.setValue('name', naturalAttackProfiles[type].name, options);
      state.form.setValue('role', naturalAttackProfiles[type].role, options);
      state.form.setValue('isRoleExplicit', false, options);
      state.form.setValue(
        'dice',
        createNaturalAttackWeapon(type).dice ?? '',
        options,
      );
    },
  };
}
