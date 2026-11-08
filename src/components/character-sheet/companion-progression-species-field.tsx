'use client';
import { useId } from 'react';
import { representativeAnimalCompanions } from '~/lib/catalog/representative-animal-companions';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '~/components/ui/form';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { cn } from '~/lib/utils';
import type { CompanionProgressionView } from './character-companion-progression-view-model';
import { creatureSizeLabels } from './companion-progression-advancement-copy';
import { fieldLabel } from './sheet-parts';
import type { CompanionProgressionForm } from './use-companion-progression-form';

// A playing card: lifts on hover, settles when chosen, stays put for reduced motion.
const card =
  'flex-col items-start justify-start gap-0.5 text-left font-sans text-sm transition-all hover:-translate-y-0.5 hover:border-foreground motion-reduce:transition-none motion-reduce:hover:translate-y-0';
const note = 'text-muted-foreground text-xs';

/**
 * The species as cards, chosen explicitly: native radios for the keyboard
 * and the screen reader, each card naming its size and the effective
 * progression level its advancement is published at.
 */
export function CompanionProgressionSpeciesField({
  form,
  options,
  recordedSpecies,
  disabled,
}: {
  form: CompanionProgressionForm;
  options: CompanionProgressionView['speciesChoices'];
  recordedSpecies: string | null;
  disabled: boolean;
}) {
  const labelId = useId();
  return (
    <FormField
      control={form.control}
      name="species"
      render={({ field, fieldState }) => (
        <FormItem className="gap-1">
          <span
            id={labelId}
            className={cn(fieldLabel, fieldState.error && 'text-destructive')}
          >
            Species
          </span>
          <FormControl>
            <RadioGroup
              aria-labelledby={labelId}
              name={field.name}
              value={field.value}
              disabled={disabled}
              onBlur={field.onBlur}
              onValueChange={field.onChange}
              className="grid-cols-1 gap-1 sm:grid-cols-2"
            >
              {options.map((option) => {
                const species = representativeAnimalCompanions[option.value];
                return (
                  <RadioGroupItem
                    key={option.value}
                    value={option.value}
                    className={card}
                  >
                    <span>{option.label}</span>
                    <span className={note}>
                      {creatureSizeLabels[species.size]}; advancement at
                      effective
                      progression level {species.advancement.level}
                    </span>
                  </RadioGroupItem>
                );
              })}
            </RadioGroup>
          </FormControl>
          <p className={note}>Only these species are available so far.</p>
          {recordedSpecies && field.value !== recordedSpecies ? (
            <p className={note}>
              Changing species keeps this Character&apos;s ability scores as
              they are.
            </p>
          ) : null}
          <FormMessage role={fieldState.error ? 'alert' : undefined} />
        </FormItem>
      )}
    />
  );
}
