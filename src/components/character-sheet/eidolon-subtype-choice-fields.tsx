'use client';
import { useId } from 'react';
import { FormControl, FormField, FormItem } from '~/components/ui/form';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import type { UnchainedSubtypeChoice } from './eidolon-subtype-card';
import { fieldLabel } from './sheet-parts';
import type { EidolonProgressionForm } from './use-eidolon-progression-form';

type SubtypeChoice = UnchainedSubtypeChoice['choices'][number];

const optionCard =
  'justify-start px-2 py-1 text-left font-sans text-xs md:min-h-8';

function SubtypeChoiceField({
  form,
  subtypeName,
  choice,
  disabled,
  reasonId,
}: {
  form: EidolonProgressionForm;
  subtypeName: string;
  choice: SubtypeChoice;
  disabled: boolean;
  reasonId: string | undefined;
}) {
  const labelId = useId();
  return (
    <FormField
      control={form.control}
      name={`subtypeChoices.${choice.key}`}
      render={({ field }) => (
        <FormItem className="gap-1">
          <span id={labelId} className={fieldLabel}>
            {subtypeName}: {choice.label}
          </span>
          <FormControl>
            <RadioGroup
              aria-labelledby={labelId}
              name={field.name}
              value={field.value ?? ''}
              disabled={disabled}
              onBlur={field.onBlur}
              onValueChange={field.onChange}
              className="grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4"
            >
              {choice.options.map((option) => (
                <RadioGroupItem
                  key={option.value}
                  value={option.value}
                  className={optionCard}
                  aria-describedby={reasonId}
                >
                  {option.label}
                </RadioGroupItem>
              ))}
            </RadioGroup>
          </FormControl>
        </FormItem>
      )}
    />
  );
}

/**
 * The choices the drafted subtype asks for, each as small cards, so a
 * recorded choice stays editable here. A choice left empty is simply not
 * written; the summary prompts for it where it applies.
 */
export function EidolonSubtypeChoiceFields({
  form,
  subtype,
  disabled,
  reasonId,
}: {
  form: EidolonProgressionForm;
  subtype: UnchainedSubtypeChoice;
  disabled: boolean;
  reasonId: string | undefined;
}) {
  if (subtype.choices.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {subtype.choices.map((choice) => (
        <SubtypeChoiceField
          key={choice.key}
          form={form}
          subtypeName={subtype.label}
          choice={choice}
          disabled={disabled}
          reasonId={reasonId}
        />
      ))}
    </div>
  );
}
