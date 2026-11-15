'use client';
import { CompanionCardChoiceField } from './companion-card-choice-field';
import type { CompanionFieldProps } from './companion-props';

export function CompanionKindField(props: CompanionFieldProps) {
  return (
    <CompanionCardChoiceField
      {...props}
      name="kind"
      label="Companion kind"
      options={props.controller.kindOptions.map((option) => ({
        value: option.kind,
        label: option.label,
      }))}
    />
  );
}
