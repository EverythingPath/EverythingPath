'use client';
import { useId } from 'react';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { definitionKindLabels } from './catalog-labels';
import { fieldLabel } from './sheet-parts';

// Items, Spells, conditions and Spell Effects have their own classification
// form under Sheet entries; Classes come from the Class Levels.
export const oneOffKinds = [
  'feat',
  'trait',
  'classFeature',
  'race',
  'racialTrait',
  'archetype',
  'manual',
] as const;
export type OneOffKind = (typeof oneOffKinds)[number];

/** The one-off's kind as native radio cards a keyboard or touch can pick. */
export function CatalogOneOffKindCards({
  kind,
  isDisabled,
  onChange,
}: {
  kind: OneOffKind;
  isDisabled: boolean;
  onChange: (kind: OneOffKind) => void;
}) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-1">
      <span id={labelId} className={fieldLabel}>
        Kind
      </span>
      <RadioGroup
        aria-labelledby={labelId}
        name={labelId}
        value={kind}
        disabled={isDisabled}
        onValueChange={(value) =>
          onChange(oneOffKinds.find((option) => option === value) ?? kind)
        }
        className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
      >
        {oneOffKinds.map((option) => (
          <RadioGroupItem
            key={option}
            value={option}
            aria-label={definitionKindLabels[option]}
            className="px-3 py-2 text-left [overflow-wrap:anywhere]"
          >
            {definitionKindLabels[option]}
          </RadioGroupItem>
        ))}
      </RadioGroup>
    </div>
  );
}
