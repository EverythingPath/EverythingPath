'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import type { FieldValues, Path, PathValue, Resolver } from 'react-hook-form';
import { z } from 'zod';
import { maximumRangeIncrements } from '~/lib/character-sheet-attacks';
import { isOwnCharacterSheetOperation } from '~/lib/character-sheet-operations';
import { classifyWriteFailure, refusalReason } from '~/lib/write-outcome';
import type { SaveStatus } from './save-status';
import { useSheetFormState } from './use-sheet-form-state';
import { availableLimbsSchema } from './available-limbs-schema';
import {
  equipmentFormSchema,
  type EquipmentValues,
} from './equipment-form-schema';

export const attackRoutineHandsSchema = z.enum(['one', 'two']);
export const attackRoutineModeSchema = z.enum(['melee', 'ranged', 'thrown']);

const routineSchema = z.object({
  name: z
    .string()
    .refine((value) => value.trim().length > 0, 'Routine name is required'),
  weaponEntryId: z.string().min(1, 'Main weapon is required'),
  hands: attackRoutineHandsSchema,
  mode: attackRoutineModeSchema,
  ammunitionEntryId: z
    .string()
    .min(1, 'Choose ammunition or None')
    .nullable()
    .optional(),
  naturalAttackEntryIds: z
    .array(z.string().min(1, 'Natural attack is required'))
    .optional(),
  availableLimbs: availableLimbsSchema.optional(),
  /** Switched-on Routine Options, saved as one list. */
  options: z.array(z.string().min(1, 'Routine Option is required')).optional(),
  offHand: z
    .discriminatedUnion('kind', [
      z.object({
        kind: z.literal('weapon'),
        weaponEntryId: z.string().min(1, 'Off-hand weapon is required'),
        mode: attackRoutineModeSchema,
      }),
      z.object({ kind: z.literal('otherEnd'), mode: attackRoutineModeSchema }),
    ])
    .nullable()
    .optional(),
});
/** The editor's fields: range increments stay a text draft until saved. */
const draftSchema = routineSchema.extend({
  rangeIncrements: z
    .string()
    .refine((value) => value.trim().length > 0, 'Range increments are required')
    .refine(
      (value) =>
        /^\d+$/.test(value.trim()) && Number.isSafeInteger(Number(value)),
      'Enter a whole number of range increments',
    )
    .refine((value) => Number(value) >= 1, 'Enter at least 1 range increment')
    .optional(),
});
export type AttackRoutineDraft = z.infer<typeof draftSchema>;
/** A routine as saved, with its whole number of range increments. */
export type AttackRoutineValues = z.infer<typeof routineSchema> & {
  rangeIncrements?: number;
};
const validateDraftPatch = createPatchValidator(draftSchema);

/** Each valid field change is saved in order; refused and newer input stays local. */
export function useAttackRoutineForm({
  value,
  save,
  operationId,
}: {
  value: AttackRoutineValues;
  save: (patch: Partial<AttackRoutineValues>) => Promise<unknown>;
  operationId?: string | null;
}) {
  const { rangeIncrements, ...fields } = value;
  return useImmediateAttackFields<AttackRoutineDraft>({
    value: {
      ...fields,
      naturalAttackEntryIds: fields.naturalAttackEntryIds ?? [],
      availableLimbs: fields.availableLimbs ?? '2',
      options: fields.options ?? [],
      ...(rangeIncrements === undefined
        ? {}
        : { rangeIncrements: String(rangeIncrements) }),
    },
    save: ({ rangeIncrements: draft, ...patch }) =>
      save({
        ...patch,
        ...(draft === undefined ? {} : { rangeIncrements: Number(draft) }),
      }),
    operationId,
    resolver: zodResolver(draftSchema),
    validatePatch: (field, submitted, values) => {
      const patch = validateDraftPatch(field, submitted);
      if (typeof patch === 'string' || patch.rangeIncrements === undefined)
        return patch;
      const maximum = maximumRangeIncrements(values);
      return Number(patch.rangeIncrements) > maximum
        ? `${maximum === 5 ? 'Thrown' : 'Ranged'} attacks reach at most ${maximum} range increments`
        : patch;
    },
  });
}

/** One end's magic state; saving a field never overwrites the other end. */
export function useAttackWeaponEndForm({
  value,
  save,
  operationId,
}: {
  value: EquipmentValues;
  save: (patch: EquipmentValues) => Promise<unknown>;
  operationId?: string | null;
}) {
  return useImmediateAttackFields({
    value: {
      masterwork: value.masterwork ?? false,
      enhancement: String(value.enhancement ?? 0),
      material: value.material ?? '',
    },
    resolver: zodResolver(equipmentFormSchema),
    operationId,
    save: (patch) =>
      save({
        ...(patch.masterwork === undefined
          ? {}
          : { masterwork: patch.masterwork }),
        ...(patch.enhancement === undefined
          ? {}
          : { enhancement: Number(patch.enhancement) }),
        ...(patch.material === undefined
          ? {}
          : { material: patch.material.trim() || null }),
      }),
    validatePatch: createPatchValidator(equipmentFormSchema),
  });
}

function createPatchValidator<Shape extends z.ZodRawShape>(
  schema: z.ZodObject<Shape>,
) {
  return (field: keyof Shape, submitted: unknown) => {
    const parsed = z.safeParse(schema.shape[field] ?? z.never(), submitted);
    const patch = schema.partial().safeParse({ [field]: submitted });
    return parsed.success && patch.success
      ? patch.data
      : !parsed.success
        ? (parsed.error.issues[0]?.message ?? 'Enter a valid value')
        : 'Enter a valid value';
  };
}

function useImmediateAttackFields<Values extends FieldValues>({
  value,
  save,
  operationId,
  resolver,
  validatePatch,
}: {
  value: Values;
  save: (patch: Partial<Values>) => Promise<unknown>;
  operationId?: string | null;
  resolver: Resolver<Values>;
  /** Checks one submitted field against the other current fields. */
  validatePatch: (
    field: keyof Values & Path<Values>,
    submitted: unknown,
    values: Values,
  ) => Partial<Values> | string;
}) {
  type Field = keyof Values & Path<Values>;
  const state = useSheetFormState({
    incoming: value,
    resolver,
    draftPolicy: 'fields',
    isOwnChange: isOwnCharacterSheetOperation(operationId),
  });
  const { form } = state;
  const latest = useRef({ save, source: state.source });
  useEffect(() => {
    latest.current = { save, source: state.source };
  }, [save, state.source]);
  const queue = useRef(Promise.resolve());
  const generations = useRef<Partial<Record<Field, number>>>({});
  const [statuses, setStatuses] = useState<Partial<Record<Field, SaveStatus>>>(
    {},
  );

  function status(field: Field, next: SaveStatus) {
    setStatuses((previous) => ({ ...previous, [field]: next }));
  }
  function persist(field: Field, submitted: unknown) {
    const generation = (generations.current[field] ?? 0) + 1;
    generations.current[field] = generation;
    const patch = validatePatch(field, submitted, form.getValues());
    if (typeof patch === 'string') {
      status(field, { kind: 'idle' });
      form.setError(field, {
        message: patch,
      });
      return Promise.resolve(false);
    }
    form.clearErrors(field);
    status(field, { kind: 'saving' });
    const task = queue.current.then(async () => {
      const source = latest.current.source;
      state.expected.current = JSON.stringify({
        ...latest.current.source,
        ...patch,
      });
      try {
        await latest.current.save(patch);
        const current = form.getValues();
        form.reset(
          latest.current.source === source
            ? {
                ...source,
                ...form.formState.defaultValues,
                ...patch,
              }
            : latest.current.source,
          { keepErrors: true },
        );
        form.reset(current, { keepDefaultValues: true, keepErrors: true });
        if (generations.current[field] === generation)
          status(field, { kind: 'saved' });
        return true;
      } catch (error) {
        state.expected.current = null;
        const failure = classifyWriteFailure(error);
        if (generations.current[field] === generation)
          status(field, {
            kind: 'error',
            message:
              failure.kind === 'rejected'
                ? `Changes weren't saved${refusalReason(failure.message)} Your edits are kept. Try again.`
                : 'Changes may not have been saved. Your edits are kept. Check them, then try again.',
          });
        return false;
      }
    });
    queue.current = task.then(() => undefined);
    return task;
  }
  return {
    form,
    change: <Name extends Field>(
      field: Name,
      next: PathValue<Values, Name>,
    ) => {
      form.setValue(field, next, { shouldDirty: true });
      return persist(field, next);
    },
    retry: (field: Field) => persist(field, form.getValues(field)),
    statusFor: (field: Field): SaveStatus =>
      statuses[field] ?? { kind: 'idle' },
    hasRemoteChange: state.hasRemoteChange,
    dismissRemoteChange: state.dismissRemoteChange,
  };
}
