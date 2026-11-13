'use client';
import { useId } from 'react';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { cn } from '~/lib/utils';
import { AttackFieldFeedback } from './attack-field-feedback';
import { fieldLabel } from './sheet-parts';
import type { useAttackRoutineForm } from './use-attack-routine-form';
import type { useCharacterSheet } from './use-character-sheet';

type Row = ReturnType<typeof useCharacterSheet>['attacks']['rows'][number];
type Editor = ReturnType<typeof useAttackRoutineForm>;

const hint = 'text-muted-foreground text-xs';

/** The saved range as the sheet attacks: "Up to 200 ft.: −2 to attack." */
function describeRange(row: Row) {
  const range = [...row.singleView, ...row.fullView].find(
    (line) => line.range,
  )?.range;
  if (!range) return null;
  const reach = range.statistic.total * row.rangeIncrements;
  return range.penaltyText
    ? `Up to ${reach} ft.: ${range.penaltyText} to attack.`
    : `Within ${reach} ft.: no range penalty.`;
}

/**
 * A ranged or thrown routine's range increments: the draft saves as soon as
 * it is a whole number within the routine's maximum, its own error stays
 * beside it otherwise, and the sheet's saved range and any range warning
 * read beneath it.
 */
export function AttackRoutineRangeFields({
  row,
  editor,
  isReadOnly,
  describedBy,
}: {
  row: Row;
  editor: Editor;
  isReadOnly: boolean;
  describedBy?: string;
}) {
  const hintId = useId();
  const rangeWarning = row.warnings.find(
    (warning) => warning.check === 'attackRangeExceeded',
  );
  const rangeHint = describeRange(row);

  return (
    <FormField
      control={editor.form.control}
      name="rangeIncrements"
      render={({ field, fieldState }) => (
        <FormItem className="gap-1">
          <FormLabel className={fieldLabel}>Range increments</FormLabel>
          <FormControl
            aria-describedby={cn(
              hintId,
              describedBy,
              fieldState.error && `${hintId}-error`,
            )}
          >
            <Input
              {...field}
              value={field.value ?? ''}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              disabled={isReadOnly}
              className="h-11 w-24 text-center font-mono md:h-9"
              onChange={(event) => {
                if (isReadOnly) return;
                void editor.change('rangeIncrements', event.target.value);
              }}
            />
          </FormControl>
          <p id={hintId} className={hint}>
            {rangeHint ?? 'Each increment after the first costs attack.'}
          </p>
          {rangeWarning ? (
            <p className="text-xs [overflow-wrap:anywhere] text-amber-300">
              {rangeWarning.message}
            </p>
          ) : null}
          <FormMessage
            id={`${hintId}-error`}
            role={fieldState.error ? 'alert' : undefined}
            className={fieldState.error ? undefined : 'hidden'}
          />
          <AttackFieldFeedback
            status={editor.statusFor('rangeIncrements')}
            label="range increments"
            isDisabled={isReadOnly}
            onRetry={() => void editor.retry('rangeIncrements')}
          />
        </FormItem>
      )}
    />
  );
}
