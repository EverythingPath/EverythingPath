'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  proficiencyCategories,
  type ManualProficiency,
} from '~/lib/character-sheet-proficiencies';
import { useSheetValueForm } from './use-sheet-value-form';

const schema = z
  .object({
    kind: z.enum(['category', 'baseType', 'group']),
    category: z.enum(proficiencyCategories),
    name: z.string(),
    asMartial: z.boolean(),
    disposition: z.enum(['added', 'removed']),
  })
  .superRefine((values, context) => {
    if (values.kind !== 'category' && !values.name.trim())
      context.addIssue({
        code: 'custom',
        path: ['name'],
        message:
          values.kind === 'baseType'
            ? 'Weapon name is required'
            : 'Weapon group is required',
      });
  });
type Values = z.infer<typeof schema>;
export type ManualProficiencyChange = {
  proficiency: ManualProficiency;
  disposition: 'added' | 'removed';
};

function proficiency(values: Values): ManualProficiency {
  switch (values.kind) {
    case 'category':
      return { category: values.category };
    case 'baseType':
      return {
        baseType: values.name.trim(),
        ...(values.asMartial ? { asMartial: true } : {}),
      };
    case 'group':
      return { group: values.name.trim() };
  }
}

export function useManualProficiencyForm({
  save,
  startingDisposition = 'added',
}: {
  save: (change: ManualProficiencyChange) => Promise<unknown>;
  startingDisposition?: ManualProficiencyChange['disposition'];
}) {
  return useSheetValueForm<Values>({
    incoming: {
      kind: 'category',
      category: 'simple',
      name: '',
      asMartial: false,
      disposition: startingDisposition,
    } satisfies Values,
    resolver: zodResolver(schema),
    normalize: (values) =>
      schema.safeParse(values).success
        ? { ...values, name: values.name.trim() }
        : null,
    write: (values) =>
      save({
        proficiency: proficiency(values),
        disposition: values.disposition,
      }),
  });
}
