'use client';
import { Sigma, Trash2 } from 'lucide-react';
import { useWatch } from 'react-hook-form';
import { Button } from '~/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { personalBonusTypes } from '~/lib/character-sheet';
import { cn } from '~/lib/utils';
import { InlineWarnings } from './inline-warning';
import {
  bonusTypeLabels,
  describeSituation,
  modifierTargetLabels,
  targetPickerGroups,
} from './modifier-labels';
import { listModifierWarnings } from './modifier-warnings';
import { fieldLabel } from './sheet-parts';
import type {
  PersonalAdjustmentInput,
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';
import type { usePersonalAdjustmentForm } from './use-personal-adjustment-form';

type Controller = ReturnType<typeof useCharacterSheet>;
type Editor = Pick<
  ReturnType<typeof usePersonalAdjustmentForm>,
  'form' | 'removeModifier'
>;
type Condition = NonNullable<
  PersonalAdjustmentInput['modifiers'][number]['condition']
>;

/**
 * Statistic · bonus type · value · only when · remove, from tablet width. On
 * the phone the row is three columns: statistic beside its remove button,
 * then bonus type and value, then the whole-width "Only when…".
 */
export const modifierColumns =
  'md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(8rem,1.2fr)_minmax(0,1fr)_auto] md:gap-x-2';

const control = 'bg-field h-11 w-full font-sans md:h-8';

function situationText(condition: Condition | undefined) {
  const situation = condition?.situation;
  if (
    situation === undefined ||
    (typeof situation === 'object' && 'option' in situation)
  )
    return '';
  return describeSituation(situation);
}

// A typed situation becomes this adjustment's own local Situation; a blank
// removes only that key, so any other condition on the row survives.
function withSituation(condition: Condition | undefined, text: string) {
  const { situation: _dropped, ...rest } = condition ?? {};
  const next: Condition = text.trim()
    ? { ...rest, situation: { local: text } }
    : rest;
  return Object.values(next).some((value) => value !== undefined)
    ? next
    : undefined;
}

// The value is typed once, as a number or as a formula the resolver reads;
// the toggle beside it says which. A formula the resolver cannot read is
// kept and warned about right here, under the field it is about.
function ValueField({
  editor,
  index,
  isDisabled,
  warnings,
  warningController,
}: {
  editor: Editor;
  index: number;
  isDisabled: boolean;
  warnings: SheetWarningView[];
  warningController?: Controller['warnings'];
}) {
  const ordinal = index + 1;
  const valueKind = useWatch({
    control: editor.form.control,
    name: `modifiers.${index}.valueKind`,
  });
  const isFormula = valueKind === 'formula';
  return (
    <FormField
      control={editor.form.control}
      name={`modifiers.${index}.value`}
      render={({ field, fieldState }) => (
        <FormItem className="gap-0">
          <span aria-hidden className={cn(fieldLabel, 'md:hidden')}>
            {isFormula ? 'Formula' : 'Value'}
          </span>
          <div className="flex items-start gap-1">
            <FormControl>
              <Input
                {...field}
                aria-label={`Modifier ${ordinal} value`}
                disabled={isDisabled}
                type="text"
                inputMode={isFormula ? 'text' : 'decimal'}
                autoComplete="off"
                spellCheck={false}
                className={cn(
                  control,
                  'font-mono',
                  isFormula ? 'text-left' : 'text-center',
                )}
              />
            </FormControl>
            <Button
              type="button"
              variant={isFormula ? 'secondary' : 'ghost'}
              size="icon"
              className="size-11 shrink-0 md:size-8"
              aria-pressed={isFormula}
              disabled={isDisabled}
              onClick={() =>
                editor.form.setValue(
                  `modifiers.${index}.valueKind`,
                  isFormula ? 'number' : 'formula',
                  { shouldDirty: true },
                )
              }
            >
              <Sigma aria-hidden className="size-4" />
              <span className="sr-only">Modifier {ordinal} as formula</span>
            </Button>
          </div>
          <FormMessage role={fieldState.error ? 'alert' : undefined} />
          {warningController ? (
            <InlineWarnings
              warnings={listModifierWarnings(warnings, index)}
              controller={warningController}
              className="pt-1"
            />
          ) : null}
        </FormItem>
      )}
    />
  );
}

export function PersonalAdjustmentModifierRow({
  editor,
  index,
  isDisabled,
  canRemove,
  warnings = [],
  warningController,
}: {
  editor: Editor;
  index: number;
  isDisabled: boolean;
  canRemove: boolean;
  /** The saved entry's Modifier warnings; none while the entry is new. */
  warnings?: SheetWarningView[];
  warningController?: Controller['warnings'];
}) {
  const ordinal = index + 1;
  const condition = useWatch({
    control: editor.form.control,
    name: `modifiers.${index}.condition`,
  });
  return (
    <li
      aria-label={`Modifier ${ordinal}`}
      className={cn(
        'border-foreground/10 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-start gap-x-2 gap-y-1 border-b py-2 md:border-0 md:py-1',
        modifierColumns,
      )}
    >
      <FormField
        control={editor.form.control}
        name={`modifiers.${index}.target`}
        render={({ field }) => (
          <FormItem className="col-span-2 gap-0 md:col-span-1">
            <span aria-hidden className={cn(fieldLabel, 'md:hidden')}>
              Statistic
            </span>
            <Select
              value={field.value}
              onValueChange={field.onChange}
              disabled={isDisabled}
            >
              <FormControl>
                <SelectTrigger
                  aria-label={`Modifier ${ordinal} statistic`}
                  className={control}
                >
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {targetPickerGroups.map((group) => (
                  <SelectGroup key={group.label}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.targets.map((target) => (
                      <SelectItem key={target} value={target}>
                        {modifierTargetLabels[target]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </FormItem>
        )}
      />
      <FormField
        control={editor.form.control}
        name={`modifiers.${index}.bonusType`}
        render={({ field }) => (
          <FormItem className="gap-0">
            <span aria-hidden className={cn(fieldLabel, 'md:hidden')}>
              Bonus type
            </span>
            <Select
              value={field.value}
              onValueChange={field.onChange}
              disabled={isDisabled}
            >
              <FormControl>
                <SelectTrigger
                  aria-label={`Modifier ${ordinal} bonus type`}
                  className={control}
                >
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {personalBonusTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {bonusTypeLabels[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormItem>
        )}
      />
      <ValueField
        editor={editor}
        index={index}
        isDisabled={isDisabled}
        warnings={warnings}
        warningController={warningController}
      />
      <FormItem className="col-span-3 gap-0 md:col-span-1">
        <span aria-hidden className={cn(fieldLabel, 'md:hidden')}>
          Only when…
        </span>
        <Input
          aria-label={`Modifier ${ordinal} only when`}
          disabled={isDisabled}
          type="text"
          autoComplete="off"
          placeholder="Only when…"
          value={situationText(condition)}
          onChange={(event) =>
            editor.form.setValue(
              `modifiers.${index}.condition`,
              withSituation(condition, event.target.value),
              { shouldDirty: true },
            )
          }
          className={control}
        />
      </FormItem>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="col-start-3 row-start-1 size-11 self-end justify-self-end md:col-start-5 md:size-8 md:self-start"
        disabled={isDisabled || !canRemove}
        onClick={() => editor.removeModifier(index)}
      >
        <Trash2 aria-hidden className="size-4" />
        <span className="sr-only">Remove modifier {ordinal}</span>
      </Button>
    </li>
  );
}
