'use client';
import { useId } from 'react';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '~/components/ui/form';
import { RadioGroup } from '~/components/ui/radio-group';
import { pointCount } from '~/lib/character-sheet-eidolon-progression';
import { cn } from '~/lib/utils';
import { EidolonEvolutionCard } from './eidolon-evolution-card';
import { fieldLabel } from './sheet-parts';
import type {
  EidolonEvolutionPickerForm,
  EvolutionCatalog,
} from './use-eidolon-evolution-picker-form';

/**
 * The evolution choice: every curated evolution as a card, grouped by cost.
 * Choosing another evolution clears the option and upgrade drafted for the
 * previous one.
 */
export function EidolonEvolutionCardsField({
  form,
  catalog,
  summonerLevel,
  reductionLabel,
  baseFormName,
  subtypeName,
  isLocked,
  reasonId,
}: {
  form: EidolonEvolutionPickerForm;
  catalog: EvolutionCatalog;
  summonerLevel: number | null;
  /** The rule that reduced the summoner level, when one applies. */
  reductionLabel: string | null;
  baseFormName: string | null;
  subtypeName: string | null;
  isLocked: boolean;
  reasonId: string | undefined;
}) {
  const labelId = useId();
  const costs = [...new Set(catalog.map((item) => item.cost))].sort(
    (a, b) => a - b,
  );
  return (
    <FormField
      control={form.control}
      name="key"
      render={({ field, fieldState }) => (
        <FormItem className="gap-1">
          <span
            id={labelId}
            className={cn(fieldLabel, fieldState.error && 'text-destructive')}
          >
            Evolution
          </span>
          <FormControl>
            <RadioGroup
              aria-labelledby={labelId}
              name={field.name}
              value={field.value}
              disabled={isLocked}
              onBlur={field.onBlur}
              onValueChange={(value) => {
                field.onChange(value);
                form.setValue('choice', '');
                form.setValue('upgrades', '');
                form.clearErrors();
              }}
              className="gap-4"
            >
              {costs.map((cost) => (
                <section
                  key={cost}
                  aria-label={pointCount(cost)}
                  className="flex flex-col gap-1"
                >
                  <h3 className="text-muted-foreground text-sm font-medium">
                    {pointCount(cost)}
                  </h3>
                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
                    {catalog
                      .filter((item) => item.cost === cost)
                      .map((item) => (
                        <EidolonEvolutionCard
                          key={item.key}
                          evolution={item}
                          summonerLevel={summonerLevel}
                          reductionLabel={reductionLabel}
                          baseFormName={baseFormName}
                          subtypeName={subtypeName}
                          reasonId={reasonId}
                        />
                      ))}
                  </div>
                </section>
              ))}
            </RadioGroup>
          </FormControl>
          <FormMessage role={fieldState.error ? 'alert' : undefined} />
        </FormItem>
      )}
    />
  );
}
