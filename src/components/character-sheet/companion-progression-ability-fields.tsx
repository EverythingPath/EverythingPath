'use client';
import { abilityLabels } from '~/lib/character-sheet';
import { CompanionProgressionNumberField } from './companion-progression-number-field';
import { fieldLabel } from './sheet-parts';
import { companionAbilities } from './use-companion-progression-form';

/** How many of the Companion's +1 ability increases went to each ability. */
export function CompanionProgressionAbilityFields({
  disabled,
}: {
  disabled: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className={fieldLabel}>Ability increases</legend>
      <div className="grid grid-cols-3 items-start gap-x-3 gap-y-2 sm:grid-cols-6">
        {companionAbilities.map((ability) => (
          <CompanionProgressionNumberField
            key={ability}
            name={`abilityIncreases.${ability}`}
            label={`${abilityLabels[ability]} increases`}
            visibleLabel={abilityLabels[ability]}
            placeholder="0"
            disabled={disabled}
          />
        ))}
      </div>
    </fieldset>
  );
}
