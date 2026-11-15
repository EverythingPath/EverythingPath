'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  eidolonBaseFormKeys,
  eidolonClassSkills,
} from '~/lib/catalog/representative-eidolons';
import {
  unchainedEidolonSubtypeKeys,
  unchainedSubtypeChoiceKeys,
} from '~/lib/catalog/representative-unchained-eidolons';
import {
  eidolonProgressionStateSchema,
  eidolonVersions,
  type EidolonProgressionState,
} from '~/lib/character-sheet-eidolon-progression';
import { skillDefinitions, skillKeyPrefix } from '~/lib/character-sheet-skills';
import {
  withEidolonSubtype,
  withEidolonSubtypeChoice,
  withEidolonVersion,
} from './character-eidolon-progression-view-model';
import { nonnegativeIntegerField } from './numeric-form-fields';
import {
  progressionChoiceInput,
  progressionChoiceSchema,
  progressionChoiceValuesFrom,
} from './use-companion-progression-form';
import { useSheetFormState } from './use-sheet-form-state';

export const eidolonSizeChoices = [
  { value: 'medium', label: 'Medium' },
  { value: 'small', label: 'Small' },
] as const;

/** The eidolon's own class skills, as the short keys the rank fields use. */
export const eidolonBaseSkills: readonly string[] = eidolonClassSkills;

/** The skills a summoner may add: every skill not already a class skill. */
export const eidolonClassSkillChoices = skillDefinitions
  .filter(
    (skill) =>
      !eidolonBaseSkills.includes(skill.key.slice(skillKeyPrefix.length)),
  )
  .map(({ key, name }) => ({ key, name }));

const schema = z.object({
  version: z.enum(eidolonVersions),
  baseForm: z.enum(eidolonBaseFormKeys),
  /** The Unchained subtype, or none chosen yet. */
  subtype: z.union([z.literal(''), z.enum(unchainedEidolonSubtypeKeys)]),
  /** Each recorded subtype choice by its key; an empty draft is unchosen. */
  subtypeChoices: z.record(z.string(), z.string()),
  size: z.enum(['medium', 'small']),
  classSkills: z.array(z.string()),
  armorBonusAsArmor: nonnegativeIntegerField('Armor bonus as armor', {
    optional: true,
    numberMessage: 'Enter a number.',
  }),
  ...progressionChoiceSchema.shape,
});
export type EidolonProgressionFormValues = z.infer<typeof schema>;

function valuesFrom(
  choices: EidolonProgressionState,
): EidolonProgressionFormValues {
  return {
    version: choices.version ?? 'original',
    baseForm: choices.baseForm,
    subtype: choices.subtype ?? '',
    subtypeChoices: Object.fromEntries(
      (choices.subtypeChoices ?? []).map(({ key, choice }) => [key, choice]),
    ),
    size: choices.size,
    classSkills: [...choices.classSkills],
    armorBonusAsArmor: choices.armorBonusAsArmor
      ? String(choices.armorBonusAsArmor)
      : '',
    ...progressionChoiceValuesFrom(choices, eidolonBaseSkills),
  };
}

/**
 * The whole recorded state from a valid draft. Evolutions and Keep come
 * from the latest recorded choices. Version, base form, subtype and subtype
 * choices are written only where the draft differs, through the same record
 * edits the summary uses, so an untouched record keeps its shape and a
 * former subtype's choices stay recorded.
 */
export function eidolonProgressionInput(
  values: EidolonProgressionFormValues,
  choices: EidolonProgressionState,
): EidolonProgressionState {
  const edited: EidolonProgressionState = {
    ...choices,
    baseForm: values.baseForm,
    size: values.size,
    classSkills: values.classSkills,
    armorBonusAsArmor: Number(values.armorBonusAsArmor.trim() || 0),
    ...progressionChoiceInput(values, choices),
  };
  const versioned =
    values.version === (choices.version ?? 'original')
      ? edited
      : withEidolonVersion(edited, values.version);
  const subtyped =
    values.subtype && values.subtype !== choices.subtype
      ? withEidolonSubtype(versioned, values.subtype)
      : versioned;
  return eidolonProgressionStateSchema.parse(
    changedSubtypeChoices(values, choices).reduce(
      (state, { key, choice }) => withEidolonSubtypeChoice(state, key, choice),
      subtyped,
    ),
  );
}

/** The drafted subtype choices that differ from the recorded ones. */
function changedSubtypeChoices(
  values: EidolonProgressionFormValues,
  choices: EidolonProgressionState,
) {
  return unchainedSubtypeChoiceKeys.flatMap((key) => {
    const choice = values.subtypeChoices[key];
    const recorded = choices.subtypeChoices?.find(
      (item) => item.key === key,
    )?.choice;
    return choice && choice !== recorded ? [{ key, choice }] : [];
  });
}

/**
 * The eidolon's recorded choices as an editable draft. Another player's
 * change refreshes the untouched fields and keeps the edited ones; the
 * controller announces it.
 */
export function useEidolonProgressionForm(choices: EidolonProgressionState) {
  const state = useSheetFormState({
    incoming: valuesFrom(choices),
    resolver: zodResolver(schema),
    draftPolicy: 'fields',
    isOwnChange: true,
  });
  return state.form;
}
export type EidolonProgressionForm = ReturnType<
  typeof useEidolonProgressionForm
>;
