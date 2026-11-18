'use client';
import { TriangleAlert } from 'lucide-react';
import { useWatch } from 'react-hook-form';
import { cn } from '~/lib/utils';
import { CompanionCardChoiceField } from './companion-card-choice-field';
import type { CompanionFieldProps } from './companion-props';
import { CompanionTextField } from './companion-text-field';
import { chip } from './sheet-parts';

const notCounting = (
  <span className={cn(chip, 'text-muted-foreground')}>Not counting now</span>
);

/**
 * The Supporting Source: this sheet's Class Levels, Grants and Selections,
 * or one named by hand. A chosen source that does not count now is
 * advisory only; the relationship can stand without it.
 */
export function CompanionSourceField(props: CompanionFieldProps) {
  const { controller } = props;
  const sourceKey = useWatch({
    control: controller.form.control,
    name: 'sourceKey',
  });
  return (
    <>
      <CompanionCardChoiceField
        {...props}
        name="sourceKey"
        label="Supporting source"
        onValueChange={controller.selectSource}
        options={[
          ...controller.sourceOptions.map((option) => ({
            value: option.key,
            label: option.label,
            aside: option.isAvailable ? null : notCounting,
          })),
          { value: 'manual', label: 'Other supporting source' },
        ]}
        note={
          controller.isSelectedSourceAvailable ? null : (
            <p className="flex items-start gap-1.5 text-xs text-amber-300">
              <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
              <span>
                This supporting source is not counting now. The relationship can
                be retained without its support.
              </span>
            </p>
          )
        }
      />
      {sourceKey === 'manual' ? (
        <CompanionTextField
          {...props}
          name="sourceLabel"
          label="Supporting source name"
        />
      ) : null}
    </>
  );
}
