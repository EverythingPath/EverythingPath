'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { EidolonEvolutionSelection } from '~/lib/character-sheet-eidolon-progression';
import type { useCharacterCompanionProgression } from './use-character-companion-progression';
import { nonnegativeIntegerField } from './numeric-form-fields';

export type EvolutionCatalog = ReturnType<
  typeof useCharacterCompanionProgression
>['evolutionCatalog'];
export type EvolutionCatalogEntry = EvolutionCatalog[number];

const values = z.object({
  key: z.string(),
  choice: z.string(),
  upgrades: z.string(),
});
export type EidolonEvolutionPickerValues = z.infer<typeof values>;

/**
 * The picker's own checks are structural: an evolution is chosen, its
 * option (when it offers any) is one it offers, and its upgrade count is a
 * whole number within the published maximum. Empty and invalid read apart.
 * Rules requirements are advisory and never stop the add.
 */
function pickerSchema(catalog: EvolutionCatalog) {
  return values.superRefine((draft, context) => {
    const evolution = catalog.find((item) => item.key === draft.key);
    if (!evolution) {
      context.addIssue({
        code: 'custom',
        path: ['key'],
        message: 'Choose an evolution.',
      });
      return;
    }
    if (evolution.choiceOptions.length > 0) {
      if (!draft.choice)
        context.addIssue({
          code: 'custom',
          path: ['choice'],
          message: 'Choose an option.',
        });
      else if (
        !evolution.choiceOptions.some((option) => option.value === draft.choice)
      )
        context.addIssue({
          code: 'custom',
          path: ['choice'],
          message: 'Choose an option this evolution offers.',
        });
    }
    if (evolution.upgrade) {
      const result = nonnegativeIntegerField(evolution.upgrade.label, {
        optional: true,
        numberMessage: 'Enter a number.',
      }).safeParse(draft.upgrades);
      for (const issue of result.error?.issues ?? [])
        context.addIssue({
          code: 'custom',
          path: ['upgrades'],
          message: issue.message,
        });
      if (
        result.success &&
        Number(draft.upgrades.trim() || 0) > evolution.upgrade.max
      )
        context.addIssue({
          code: 'custom',
          path: ['upgrades'],
          message: `Up to ${evolution.upgrade.max}.`,
        });
    }
  });
}

/** The recorded selection a valid draft adds. */
export function evolutionSelectionFrom(
  draft: EidolonEvolutionPickerValues,
  evolution: EvolutionCatalogEntry,
): EidolonEvolutionSelection {
  const upgrades = Number(draft.upgrades.trim() || 0);
  return {
    key: evolution.key,
    ...(draft.choice ? { choice: draft.choice } : {}),
    ...(upgrades > 0 ? { upgrades } : {}),
  };
}

/** A fresh draft each time the picker opens: it is mounted only while open. */
export function useEidolonEvolutionPickerForm(catalog: EvolutionCatalog) {
  return useForm<EidolonEvolutionPickerValues>({
    resolver: zodResolver(pickerSchema(catalog)),
    defaultValues: { key: '', choice: '', upgrades: '' },
  });
}
export type EidolonEvolutionPickerForm = ReturnType<
  typeof useEidolonEvolutionPickerForm
>;
