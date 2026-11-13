'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useFormContext } from 'react-hook-form';
import { z } from 'zod';
import { animalCompanionAllowedSkills } from '~/lib/catalog/representative-animal-companions';
import { abilityKeys, type Ability } from '~/lib/character-sheet';
import {
  animalCompanionProgressionStateSchema,
  type AnimalCompanionProgressionState,
} from '~/lib/character-sheet-companion-progression';
import {
  canonicalSkillKey,
  skillKeyPrefix,
} from '~/lib/character-sheet-skills';
import { nonnegativeIntegerField } from './numeric-form-fields';
import { useSheetFormState } from './use-sheet-form-state';

export const companionAbilities = abilityKeys;

const countField = nonnegativeIntegerField('Increases', {
  optional: true,
  numberMessage: 'Enter a number.',
});
// Leaving hit points unrecorded is its own explicit choice, never an empty
// field: an empty field asks for them, text asks for a number.
const hpField = z
  .object({ isUnrecorded: z.boolean(), value: z.string() })
  .superRefine((hp, context) => {
    if (hp.isUnrecorded) return;
    const result = nonnegativeIntegerField('Hit points', {
      requiredMessage: 'Enter hit points.',
      numberMessage: 'Enter a number.',
    }).safeParse(hp.value);
    for (const issue of result.error?.issues ?? [])
      context.addIssue({
        code: 'custom',
        path: ['value'],
        message: issue.message,
      });
  });
/**
 * The fields every Companion progression editor shares (#325 and the
 * eidolon's, #409): hit points, ranks and ability increases. Each editor's
 * own schema extends these.
 */
export const progressionChoiceSchema = z.object({
  hp: hpField,
  ranks: z.record(
    z.string(),
    nonnegativeIntegerField('Ranks', {
      optional: true,
      numberMessage: 'Enter a number.',
    }),
  ),
  abilityIncreases: z.object({
    strength: countField,
    dexterity: countField,
    constitution: countField,
    intelligence: countField,
    wisdom: countField,
    charisma: countField,
  }),
});
export type ProgressionChoiceFormValues = z.infer<
  typeof progressionChoiceSchema
>;

/**
 * The shared fields' view of the editor form around them. Each editor's
 * values extend the shared ones, so the fields read it from the form
 * context rather than taking the wider form as a prop.
 */
export function useProgressionChoiceForm() {
  return useFormContext<ProgressionChoiceFormValues>();
}

const schema = z.object({
  species: z
    .string()
    .refine(
      (value) =>
        animalCompanionProgressionStateSchema.shape.species.safeParse(value).success,
      'Choose a species.',
    ),
  ...progressionChoiceSchema.shape,
});
export type CompanionProgressionFormValues = z.infer<typeof schema>;

/** The short skill key the form edits, or null for a key it cannot place. */
export function formSkillKey(key: string) {
  return canonicalSkillKey(key)?.slice(skillKeyPrefix.length) ?? null;
}

/** The shared fields' draft from recorded choices; `baseSkills` always list. */
export function progressionChoiceValuesFrom(
  choices: Pick<
    AnimalCompanionProgressionState,
    'hpGained' | 'skillRanks' | 'abilityIncreases'
  > | null,
  baseSkills: readonly string[],
): ProgressionChoiceFormValues {
  function countValue(ability: Ability) {
    const count =
      choices?.abilityIncreases.filter((item) => item === ability).length ?? 0;
    return count ? String(count) : '';
  }
  return {
    hp: {
      isUnrecorded: (choices?.hpGained ?? null) === null,
      value:
        choices?.hpGained === null || choices?.hpGained === undefined
          ? ''
          : String(choices.hpGained),
    },
    ranks: Object.fromEntries<string>([
      ...baseSkills.map((skill): [string, string] => [skill, '']),
      ...Object.entries(choices?.skillRanks ?? {}).flatMap(
        ([key, ranks]): [string, string][] => {
          const skill = formSkillKey(key);
          return skill ? [[skill, String(ranks)]] : [];
        },
      ),
    ]),
    abilityIncreases: {
      strength: countValue('strength'),
      dexterity: countValue('dexterity'),
      constitution: countValue('constitution'),
      intelligence: countValue('intelligence'),
      wisdom: countValue('wisdom'),
      charisma: countValue('charisma'),
    },
  };
}

function valuesFrom(
  choices: AnimalCompanionProgressionState | null,
): CompanionProgressionFormValues {
  return {
    species: choices?.species ?? '',
    ...progressionChoiceValuesFrom(choices, animalCompanionAllowedSkills),
  };
}

/**
 * The recorded increases, in their recorded order, adjusted to the counts:
 * unchanged counts write back the same list.
 */
export function abilityIncreasesFrom(
  counts: Record<Ability, string>,
  recorded: readonly Ability[],
) {
  const wanted = (ability: Ability) => Number(counts[ability].trim() || 0);
  const used = new Map<Ability, number>();
  const kept = recorded.filter((ability) => {
    const count = used.get(ability) ?? 0;
    if (count >= wanted(ability)) return false;
    used.set(ability, count + 1);
    return true;
  });
  for (const ability of companionAbilities)
    for (let index = used.get(ability) ?? 0; index < wanted(ability); index++)
      kept.push(ability);
  return kept;
}

/**
 * The whole recorded state from a valid draft. Advancement and Keep come
 * from the latest recorded choices; skill keys the form cannot place are
 * written back unchanged.
 */
export function companionProgressionInput(
  values: CompanionProgressionFormValues,
  choices: AnimalCompanionProgressionState | null,
): AnimalCompanionProgressionState {
  return animalCompanionProgressionStateSchema.parse({
    species: values.species,
    ...progressionChoiceInput(values, choices),
    advancementChoice: choices?.advancementChoice ?? 'species',
    keep: choices?.keep ?? false,
  });
}

/** The shared fields' recorded state from a valid draft. */
export function progressionChoiceInput(
  values: ProgressionChoiceFormValues,
  choices: Pick<
    AnimalCompanionProgressionState,
    'skillRanks' | 'abilityIncreases'
  > | null,
) {
  const unplaced = Object.entries(choices?.skillRanks ?? {}).filter(
    ([key]) => formSkillKey(key) === null,
  );
  return {
    hpGained: values.hp.isUnrecorded ? null : Number(values.hp.value.trim()),
    skillRanks: Object.fromEntries<number>([
      ...unplaced,
      ...Object.entries(values.ranks).flatMap(
        ([skill, raw]): [string, number][] =>
          raw.trim() ? [[skill, Number(raw.trim())]] : [],
      ),
    ]),
    abilityIncreases: abilityIncreasesFrom(
      values.abilityIncreases,
      choices?.abilityIncreases ?? [],
    ),
  };
}

/**
 * The Companion's recorded choices as an editable draft. Another player's
 * change refreshes the untouched fields and keeps the edited ones; the
 * controller announces it.
 */
export function useCompanionProgressionForm(
  choices: AnimalCompanionProgressionState | null,
) {
  const state = useSheetFormState({
    incoming: valuesFrom(choices),
    resolver: zodResolver(schema),
    draftPolicy: 'fields',
    isOwnChange: true,
  });
  return state.form;
}
export type CompanionProgressionForm = ReturnType<
  typeof useCompanionProgressionForm
>;
