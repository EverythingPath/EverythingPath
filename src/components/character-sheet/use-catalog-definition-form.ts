'use client';

import type { CatalogDefinition } from './sheet-catalog-context';
import type { CatalogDefinitionChanges } from './use-character-sheet-catalog';
import { usePersonalAdjustmentForm } from './use-personal-adjustment-form';

/** Keep race choice placeholders out of the concrete statistic form. */
export function useCatalogDefinitionForm({
  definition,
  save,
}: {
  definition?: CatalogDefinition;
  save: (input: CatalogDefinitionChanges) => Promise<unknown>;
}) {
  const adjustment = definition
    ? {
        name: definition.name,
        modifiers: definition.modifiers.flatMap((modifier) =>
          modifier.target === 'ability.$choice'
            ? []
            : [{ ...modifier, target: modifier.target }],
        ),
      }
    : undefined;
  return usePersonalAdjustmentForm({
    adjustment,
    save: (input) =>
      save({
        ...input,
        modifiers: [
          ...input.modifiers,
          ...(definition?.modifiers.flatMap((modifier) => {
            const { target, bonusType, value } = modifier;
            if (target !== 'ability.$choice') return [];
            const condition =
              'condition' in modifier ? modifier.condition : undefined;
            return [
              {
                target,
                bonusType,
                value,
                ...(condition ? { condition } : {}),
              },
            ];
          }) ?? []),
        ],
      }),
  });
}
