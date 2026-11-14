'use client';
import { useId, useState } from 'react';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { cn } from '~/lib/utils';
import type { CohortController } from './companion-props';
import { fieldLabel, noteText } from './sheet-parts';

// A playing card: lifts on hover, settles when chosen, stays put for reduced motion.
const card =
  'h-auto flex-col items-start justify-start gap-0.5 py-1.5 text-left font-sans text-sm transition-all hover:-translate-y-0.5 hover:border-foreground motion-reduce:transition-none motion-reduce:hover:translate-y-0';

/**
 * The published monster cohorts (#417) as cards, narrowed by a search so
 * the one wanted is a few keystrokes away: each names its creature, its
 * cohort level and the book it comes from.
 */
export function CohortCreatureField({
  form,
  choices,
  disabled,
}: {
  form: CohortController['equivalenceForm'];
  choices: CohortController['creatureChoices'];
  disabled: boolean;
}) {
  const labelId = useId();
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const shown = query
    ? choices.filter((choice) => choice.label.toLowerCase().includes(query))
    : choices;
  return (
    <FormField
      control={form.control}
      name="creatureKey"
      render={({ field, fieldState }) => (
        <FormItem className="gap-1">
          <span
            id={labelId}
            className={cn(fieldLabel, fieldState.error && 'text-destructive')}
          >
            Monster cohort
          </span>
          <Input
            type="search"
            aria-label="Search monster cohorts"
            placeholder="Search monster cohorts"
            autoComplete="off"
            disabled={disabled}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-11 text-sm sm:max-w-xs md:h-8"
          />
          {shown.length > 0 ? (
            <FormControl>
              <RadioGroup
                aria-labelledby={labelId}
                name={field.name}
                value={field.value}
                disabled={disabled}
                onBlur={field.onBlur}
                onValueChange={field.onChange}
                className="grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3"
              >
                {shown.map((choice) => (
                  <RadioGroupItem
                    key={choice.value}
                    value={choice.value}
                    className={card}
                  >
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      {choice.label}
                    </span>{' '}
                    <span className="text-muted-foreground font-mono text-xs">
                      Cohort level {choice.level}
                    </span>{' '}
                    <span className={noteText}>{choice.book}</span>
                  </RadioGroupItem>
                ))}
              </RadioGroup>
            </FormControl>
          ) : (
            <p className={noteText}>No published monster cohort matches.</p>
          )}
          <FormMessage
            role={fieldState.error ? 'alert' : undefined}
            className="text-xs [overflow-wrap:anywhere]"
          />
        </FormItem>
      )}
    />
  );
}
