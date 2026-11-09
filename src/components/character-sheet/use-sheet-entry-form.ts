'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  armorCategory,
  type ArmorCategory,
} from '~/lib/character-sheet-armor-categories';
import {
  conditionKeys,
  conditionDefinitions,
  getConditionDefinition,
  type ConditionKey,
} from '~/lib/character-sheet-conditions';
import { useSheetFormState } from './use-sheet-form-state';
import { useSheetFormSave } from './use-sheet-form-save';
import type {
  SheetEntryInput,
  SheetEntryStateInput,
} from './use-character-sheet-entries';
import {
  usePersonalAdjustmentForm,
  type PersonalAdjustmentSaveOutcome,
} from './use-personal-adjustment-form';

function wholeNumber(raw: string) {
  return /^\d+$/.test(raw.trim()) && Number.isSafeInteger(Number(raw));
}
const spellEffectStateSchema = z.object({
  casterLevel: z
    .string()
    .refine(
      (raw) => !raw.trim() || wholeNumber(raw),
      'Caster level must be a whole number of 0 or more',
    ),
});

/** A shared Spell Effect's recorded caster level, independent of its definition. */
export function useSpellEffectStateForm({
  value,
  save: write,
}: {
  value: { casterLevel: number; defaultCasterLevel: number };
  save: (input: Pick<SheetEntryStateInput, 'casterLevel'>) => Promise<unknown>;
}) {
  const state = useSheetFormState({
    incoming: { casterLevel: String(value.casterLevel) },
    resolver: zodResolver(spellEffectStateSchema),
    draftPolicy: 'fields',
  });
  function normalize(values: z.infer<typeof spellEffectStateSchema>) {
    const casterLevel = values.casterLevel.trim()
      ? Number(values.casterLevel)
      : value.defaultCasterLevel;
    return {
      values: { casterLevel: String(casterLevel) },
      input: { casterLevel },
    };
  }
  const saving = useSheetFormSave({
    state,
    normalize,
    normalizeDraft: (values) => {
      const parsed = spellEffectStateSchema.safeParse(values);
      return parsed.success ? normalize(parsed.data).values : undefined;
    },
    write,
  });
  return {
    form: state.form,
    status: saving.status,
    hasRemoteChange: state.hasRemoteChange,
    dismissRemoteChange: state.dismissRemoteChange,
    save: saving.save,
  };
}
const conditionSelectionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('custom') }),
  z.object({ kind: z.literal('crb'), key: z.enum(conditionKeys) }),
]);
export type ConditionSelection = z.infer<typeof conditionSelectionSchema>;

export const armorCategoriesBySlot = {
  armor: ['light', 'medium', 'heavy'],
  shield: ['buckler', 'lightShield', 'heavyShield', 'towerShield'],
} as const;
type ArmorDetail = NonNullable<
  Extract<SheetEntryInput['detail'], { kind: 'item' }>['armor']
>;

// A stored synonym ("heavyArmor", "tower") reads as its card.
function cardCategory(category: ArmorCategory | undefined) {
  const normalized = armorCategory(category);
  return normalized === 'other' ? '' : (normalized ?? '');
}

const armorNumbers = [
  { field: 'armorBonus', label: 'Armor or shield bonus', isRequired: true },
  { field: 'armorMaxDex', label: 'Maximum Dexterity bonus', isRequired: false },
  {
    field: 'armorCheckPenalty',
    label: 'Armor check penalty',
    isRequired: true,
  },
  {
    field: 'armorSpellFailure',
    label: 'Arcane spell failure',
    isRequired: true,
  },
] as const;

const schema = z
  .object({
    kind: z.enum(['spellEffect', 'condition', 'item', 'spell']),
    conditionSelection: conditionSelectionSchema,
    lastsOverOneDay: z.boolean(),
    consumable: z.boolean(),
    defaultCasterLevel: z.string(),
    casterLevel: z.string(),
    isArmor: z.boolean(),
    armorSlot: z.enum(['armor', 'shield']),
    armorCategory: z.string(),
    armorBonus: z.string(),
    armorMaxDex: z.string(),
    armorCheckPenalty: z.string(),
    armorSpellFailure: z.string(),
  })
  .superRefine((value, ctx) => {
    const slotCategories: readonly string[] =
      armorCategoriesBySlot[value.armorSlot];
    if (
      value.kind === 'item' &&
      value.isArmor &&
      value.armorCategory !== '' &&
      !slotCategories.includes(value.armorCategory)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['armorCategory'],
        message: `Choose a category for this ${value.armorSlot}`,
      });
    if (value.kind === 'item' && value.isArmor)
      for (const { field, label, isRequired } of armorNumbers) {
        const raw = value[field];
        if (!raw.trim()) {
          if (isRequired)
            ctx.addIssue({
              code: 'custom',
              path: [field],
              message: `${label} is required`,
            });
        } else if (!wholeNumber(raw))
          ctx.addIssue({
            code: 'custom',
            path: [field],
            message: `${label} must be a whole number of 0 or more`,
          });
      }
    if (value.kind !== 'spellEffect') return;
    if (!value.defaultCasterLevel.trim())
      ctx.addIssue({
        code: 'custom',
        path: ['defaultCasterLevel'],
        message: 'Default caster level is required',
      });
    else if (!wholeNumber(value.defaultCasterLevel))
      ctx.addIssue({
        code: 'custom',
        path: ['defaultCasterLevel'],
        message: 'Default caster level must be a whole number of 0 or more',
      });
    if (value.casterLevel.trim() && !wholeNumber(value.casterLevel))
      ctx.addIssue({
        code: 'custom',
        path: ['casterLevel'],
        message: 'Caster level must be a whole number of 0 or more',
      });
  });

function formValues(value?: SheetEntryInput): z.infer<typeof schema> {
  const detail = value?.detail;
  const armor = detail?.kind === 'item' ? detail.armor : undefined;
  return {
    kind: detail?.kind ?? 'condition',
    conditionSelection:
      detail?.kind === 'condition' && detail.conditionKey
        ? { kind: 'crb', key: detail.conditionKey }
        : { kind: 'custom' },
    lastsOverOneDay: detail?.kind === 'spellEffect' && detail.lastsOverOneDay,
    consumable: detail?.kind === 'item' && detail.consumable,
    defaultCasterLevel: String(
      detail?.kind === 'spellEffect' ? detail.defaultCasterLevel : 1,
    ),
    casterLevel:
      detail?.kind === 'spellEffect'
        ? String(value?.casterLevel ?? detail.defaultCasterLevel)
        : '',
    // In the schema's order: accepted values are compared as JSON.
    isArmor: armor !== undefined,
    armorSlot: armor?.slot ?? 'armor',
    armorCategory: cardCategory(armor?.category),
    armorBonus: String(armor?.bonus ?? 0),
    armorMaxDex:
      armor?.maxDex === undefined || armor.maxDex === null
        ? ''
        : String(armor.maxDex),
    armorCheckPenalty: String(armor?.armorCheckPenalty ?? 0),
    armorSpellFailure: String(armor?.asf ?? 0),
  };
}

function classificationDetail(
  classification: z.infer<typeof schema>,
  previous?: SheetEntryInput['detail'],
): SheetEntryInput['detail'] {
  if (classification.kind === 'spellEffect')
    return {
      kind: 'spellEffect',
      lastsOverOneDay: classification.lastsOverOneDay,
      defaultCasterLevel: Number(classification.defaultCasterLevel),
    };
  if (classification.kind === 'item') {
    const { armor: previousArmor, ...rest } =
      previous?.kind === 'item' ? previous : { armor: undefined };
    const armor = classification.isArmor
      ? armorDetail(classification, previousArmor)
      : undefined;
    return {
      ...rest,
      kind: 'item',
      consumable: classification.consumable,
      ...(armor ? { armor } : {}),
    };
  }
  if (
    classification.kind === 'condition' &&
    classification.conditionSelection.kind === 'crb'
  )
    return {
      kind: 'condition',
      conditionKey: classification.conditionSelection.key,
    };
  return { kind: classification.kind };
}

function isArmorCategory(value: string): value is ArmorCategory {
  return Object.values(armorCategoriesBySlot).some((categories) =>
    categories.some((category) => category === value),
  );
}

// The typed facts over what was stored; an untouched category keeps its
// stored spelling, and a blank maximum stays absent or becomes No limit.
function armorDetail(
  classification: z.infer<typeof schema>,
  previous: ArmorDetail | undefined,
): ArmorDetail {
  const {
    category: previousCategory,
    maxDex: previousMaxDex,
    ...previousFacts
  } = previous ?? {};
  const typedCategory = classification.armorCategory;
  const category =
    typedCategory === cardCategory(previousCategory)
      ? previousCategory
      : isArmorCategory(typedCategory)
        ? typedCategory
        : undefined;
  const maxDex = classification.armorMaxDex.trim()
    ? Number(classification.armorMaxDex)
    : previousMaxDex === undefined
      ? undefined
      : null;
  return {
    ...previousFacts,
    slot: classification.armorSlot,
    bonus: Number(classification.armorBonus),
    armorCheckPenalty: Number(classification.armorCheckPenalty),
    asf: Number(classification.armorSpellFailure),
    ...(category === undefined ? {} : { category }),
    ...(maxDex === undefined ? {} : { maxDex }),
  };
}

export function useSheetEntryForm({
  value,
  save: write,
}: {
  value?: SheetEntryInput;
  save: (input: SheetEntryInput) => Promise<unknown>;
}) {
  const state = useSheetFormState({
    incoming: formValues(value),
    resolver: zodResolver(schema),
    draftPolicy: 'fields',
  });
  const { form, source, baseline, setBaseline, expected, latest } = state;
  const adjustment = usePersonalAdjustmentForm({
    adjustment: value,
    save: async (input) => {
      const classification = schema.parse(form.getValues());
      const detail = classificationDetail(classification, value?.detail);
      const submitted = {
        ...input,
        detail,
        ...(detail.kind === 'spellEffect'
          ? {
              casterLevel: classification.casterLevel.trim()
                ? Number(classification.casterLevel)
                : detail.defaultCasterLevel,
            }
          : {}),
      };
      expected.current = JSON.stringify(formValues(submitted));
      try {
        await write(submitted);
      } catch (error) {
        expected.current = null;
        throw error;
      }
    },
  });
  async function save(): Promise<PersonalAdjustmentSaveOutcome> {
    let outcome: PersonalAdjustmentSaveOutcome = 'failed';
    await form.handleSubmit(async (values) => {
      const normalized = formValues({
        name: '',
        modifiers: [],
        detail: classificationDetail(values, value?.detail),
        ...(values.kind === 'spellEffect'
          ? {
              casterLevel: values.casterLevel.trim()
                ? Number(values.casterLevel)
                : Number(values.defaultCasterLevel),
            }
          : {}),
      });
      outcome =
        JSON.stringify(normalized) === JSON.stringify(baseline)
          ? await adjustment.save()
          : await adjustment.saveAdditionalChanges();
      if (outcome === 'saved') {
        const current = form.getValues();
        const next =
          latest.current.source === source
            ? normalized
            : latest.current.baseline;
        setBaseline(next);
        // Canonical values identify unchanged saves; raw accepted values keep
        // a blank default from becoming a local edit when its echo arrives.
        const accepted = latest.current.source === source ? values : next;
        const retained =
          latest.current.source !== source &&
          JSON.stringify(next) === JSON.stringify(normalized) &&
          JSON.stringify(current) === JSON.stringify(values)
            ? next
            : current;
        form.reset(accepted, { keepDirtyValues: false });
        form.reset(retained, {
          keepDefaultValues: true,
          keepDirtyValues: false,
        });
      }
    })();
    return outcome;
  }
  const kind = form.watch('kind');
  const conditionSelection = form.watch('conditionSelection');
  const selectedCondition =
    kind === 'condition' && conditionSelection.kind === 'crb'
      ? getConditionDefinition(conditionSelection.key)
      : null;
  function selectCondition(key: ConditionKey) {
    const definition = getConditionDefinition(key);
    const options = { shouldDirty: true, shouldValidate: true };
    form.setValue('kind', 'condition', options);
    form.setValue('conditionSelection', { kind: 'crb', key }, options);
    adjustment.form.setValue('name', definition.name, options);
    adjustment.form.setValue(
      'modifiers',
      definition.modifiers.map(({ value, ...modifier }) => ({
        ...modifier,
        value: String(value),
      })),
      options,
    );
  }
  function detachCondition() {
    form.setValue(
      'conditionSelection',
      { kind: 'custom' },
      { shouldDirty: true },
    );
  }
  return {
    form,
    adjustmentForm: adjustment.form,
    fields: adjustment.fields,
    addModifier: adjustment.addModifier,
    removeModifier: adjustment.removeModifier,
    status: adjustment.status,
    hasRemoteChange: state.hasRemoteChange || adjustment.hasRemoteChange,
    dismissRemoteChange: () => {
      state.dismissRemoteChange();
      adjustment.dismissRemoteChange();
    },
    conditionOptions: conditionDefinitions,
    selectedCondition,
    selectCondition,
    detachCondition,
    save,
  };
}
