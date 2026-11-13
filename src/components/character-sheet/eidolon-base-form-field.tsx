'use client';
import { useId } from 'react';
import { FormControl, FormField, FormItem } from '~/components/ui/form';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { fieldLabel } from './sheet-parts';
import type { useCharacterCompanionProgression } from './use-character-companion-progression';
import type { EidolonProgressionForm } from './use-eidolon-progression-form';

type BaseForm = ReturnType<
  typeof useCharacterCompanionProgression
>['eidolonBaseForms'][number];

const note = 'text-muted-foreground text-xs [overflow-wrap:anywhere]';
// A playing card: lifts on hover, settles when chosen, stays put for reduced motion.
const card =
  'flex-col items-start justify-start gap-1 px-3 py-2 text-left font-sans text-sm transition-all hover:-translate-y-0.5 hover:border-foreground motion-reduce:transition-none motion-reduce:hover:translate-y-0';

/**
 * The editor's base form as three cards. With a counting subtype, the forms
 * it allows say so; the others stay choosable, since the rule is advisory
 * and the sheet warns about a form the subtype does not use.
 */
export function EidolonBaseFormField({
  form,
  forms,
  allowedForms,
  subtypeName,
  disabled,
  reasonId,
}: {
  form: EidolonProgressionForm;
  forms: readonly BaseForm[];
  /** The base form names the counting subtype allows; null without one. */
  allowedForms: readonly string[] | null;
  subtypeName: string | null;
  disabled: boolean;
  reasonId: string | undefined;
}) {
  const labelId = useId();
  return (
    <FormField
      control={form.control}
      name="baseForm"
      render={({ field }) => (
        <FormItem className="gap-1">
          <span id={labelId} className={fieldLabel}>
            Base form
          </span>
          <FormControl>
            <RadioGroup
              aria-labelledby={labelId}
              name={field.name}
              value={field.value}
              disabled={disabled}
              onBlur={field.onBlur}
              onValueChange={field.onChange}
              className="grid-cols-1 gap-2 sm:grid-cols-3"
            >
              {forms.map((option) => (
                <RadioGroupItem
                  key={option.value}
                  value={option.value}
                  className={card}
                  aria-describedby={reasonId}
                >
                  <span className="text-base leading-tight">
                    {option.label}
                  </span>
                  <span className={note}>
                    {option.freeEvolutions.join(', ')}
                  </span>
                  {allowedForms && subtypeName ? (
                    <span className={note}>
                      {allowedForms.includes(option.label)
                        ? `Allowed by the ${subtypeName} subtype`
                        : `Not among the ${subtypeName} subtype’s base forms`}
                    </span>
                  ) : null}
                </RadioGroupItem>
              ))}
            </RadioGroup>
          </FormControl>
        </FormItem>
      )}
    />
  );
}
