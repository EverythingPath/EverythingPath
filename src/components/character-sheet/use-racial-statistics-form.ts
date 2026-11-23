'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray } from 'react-hook-form';
import { ConvexError } from 'convex/values';
import { z } from 'zod';
import type { CharacterSheetRacialProgression } from '~/lib/character-sheet';
import { findRacialProgression } from '~/lib/character-sheet-creature-types';
import {
  canonicalSkillKey,
  skillKeyPrefix,
} from '~/lib/character-sheet-skills';
import { nonnegativeIntegerField } from './numeric-form-fields';
import { useSheetValueForm } from './use-sheet-value-form';

const positiveIntegerField = nonnegativeIntegerField('Hit Die').superRefine(
  (raw, context) => {
    if (raw.trim() && Number(raw) === 0)
      context.addIssue({
        code: 'custom',
        message: 'Hit Die must be a whole number of 1 or more',
      });
  },
);
const saveProgression = z.enum(['good', 'poor']);
const schema = z.object({
  racialHitDice: nonnegativeIntegerField('Racial Hit Dice'),
  racialHpGained: nonnegativeIntegerField('Racial hit points', {
    optional: true,
  }),
  progression: z
    .object({
      creatureType: z.string().trim().min(1, 'Creature type is required'),
      hitDie: positiveIntegerField,
      bab: z.enum(['full', 'threeQuarters', 'half']),
      saves: z.object({
        fort: saveProgression,
        ref: saveProgression,
        will: saveProgression,
      }),
      skillRanksPerHitDie: nonnegativeIntegerField('Skill ranks per Hit Die'),
      classSkills: z
        .array(z.string().trim().min(1, 'Class skill is required'))
        .max(256),
    })
    .nullable(),
  ranks: z
    .array(
      z.object({
        skill: z
          .string()
          .trim()
          .min(1, 'Skill is required')
          .refine(
            (key) => key === '' || canonicalSkillKey(key),
            'Choose a skill',
          ),
        ranks: nonnegativeIntegerField('Ranks'),
      }),
    )
    .superRefine((rows, context) => {
      const seen = new Set<string>();
      rows.forEach((row, index) => {
        const key = canonicalSkillKey(row.skill) ?? row.skill;
        if (seen.has(key))
          context.addIssue({
            code: 'custom',
            path: [index, 'skill'],
            message: 'Each skill once',
          });
        seen.add(key);
      });
    }),
});
type Values = z.infer<typeof schema>;
type Statistics = {
  racialHitDice: number;
  racialHpGained: number | null;
  racialSkillRanks: Record<string, number>;
  progression: CharacterSheetRacialProgression | null;
};

function progressionValues(
  progression: CharacterSheetRacialProgression,
): NonNullable<Values['progression']> {
  return {
    creatureType:
      findRacialProgression(progression.creatureType)?.creatureType ??
      progression.creatureType,
    hitDie: String(progression.hitDie),
    bab: progression.bab,
    saves: {
      fort: progression.saves.fort,
      ref: progression.saves.ref,
      will: progression.saves.will,
    },
    skillRanksPerHitDie: String(progression.skillRanksPerHitDie),
    classSkills: [...progression.classSkills],
  };
}

function valuesFrom(statistics: Statistics): Values {
  return {
    racialHitDice: String(statistics.racialHitDice),
    racialHpGained:
      statistics.racialHpGained === null
        ? ''
        : String(statistics.racialHpGained),
    progression: statistics.progression
      ? progressionValues(statistics.progression)
      : null,
    ranks: Object.entries(statistics.racialSkillRanks)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([skill, ranks]) => ({
        skill: canonicalSkillKey(skill)?.slice(skillKeyPrefix.length) ?? skill,
        ranks: String(ranks),
      })),
  };
}

/** Convert validated form values into the existing atomic race writer input. */
export function racialStatisticsInput(values: Values) {
  const parsed = schema.parse(values);
  return {
    racialHitDice: Number(parsed.racialHitDice),
    racialHpGained:
      parsed.racialHpGained.trim() === ''
        ? null
        : Number(parsed.racialHpGained),
    racialSkillRanks: Object.fromEntries(
      parsed.ranks.map((row) => [
        canonicalSkillKey(row.skill)?.slice(skillKeyPrefix.length) ?? row.skill,
        Number(row.ranks),
      ]),
    ),
    racialProgression: parsed.progression
      ? {
          ...parsed.progression,
          hitDie: Number(parsed.progression.hitDie),
          skillRanksPerHitDie: Number(parsed.progression.skillRanksPerHitDie),
        }
      : null,
  };
}

/** Seeds are draft defaults; later saves and live reads preserve every edited field. */
export function useRacialStatisticsForm(
  statistics: Statistics,
  save: (input: ReturnType<typeof racialStatisticsInput>) => Promise<boolean>,
) {
  const state = useSheetValueForm({
    incoming: valuesFrom(statistics),
    resolver: zodResolver(schema),
    normalize: (values) => {
      if (!schema.safeParse(values).success) return null;
      const input = racialStatisticsInput(values);
      return valuesFrom({ ...input, progression: input.racialProgression });
    },
    write: async (values) => {
      if (!(await save(racialStatisticsInput(values))))
        throw new ConvexError('Racial Hit Dice were not saved. Try again.');
    },
  });
  const ranks = useFieldArray({ control: state.form.control, name: 'ranks' });
  return {
    form: state.form,
    save: state.save,
    status: state.status,
    ranks,
    hasRemoteChange: state.hasRemoteChange,
    dismissRemoteChange: state.dismissRemoteChange,
    chooseCreatureType: (creatureType: string) => {
      const seed = findRacialProgression(creatureType);
      if (seed)
        state.form.setValue('progression', progressionValues(seed), {
          shouldDirty: true,
        });
    },
    clearProgression: () =>
      state.form.setValue('progression', null, { shouldDirty: true }),
  };
}
