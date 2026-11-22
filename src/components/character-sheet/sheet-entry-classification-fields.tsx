'use client';
import { catalogSheetEntryKinds } from '~/lib/character-sheet-entries';
import { useId } from 'react';
import { Checkbox } from '~/components/ui/checkbox';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { SheetEntryArmorFields } from './sheet-entry-armor-fields';
import { fieldLabel } from './sheet-parts';
import type { SheetEntryInput } from './use-character-sheet-entries';
import type { useSheetEntryForm } from './use-sheet-entry-form';

export type SheetEntryKind = SheetEntryInput['detail']['kind'];
type Control = ReturnType<typeof useSheetEntryForm>['form']['control'];
type FieldProps = { control: Control; isDisabled: boolean };

export const sheetEntryKindLabels: Record<SheetEntryKind, string> = {
  spellEffect: 'Spell Effect',
  condition: 'Condition',
  item: 'Item',
  spell: 'Spell',
};
// How each kind counts (data model, "Temporary Effects"): what the card says.
const kindDescriptions: Record<SheetEntryKind, string> = {
  spellEffect: 'A Spell Effect. Temporary unless it lasts more than one day.',
  condition: 'Temporary.',
  item: 'Permanent unless consumable.',
  spell: 'A recorded Spell. Grants no Modifiers.',
};

/** Playing-card kind choices; fixed once the entry exists. */
export function SheetEntryKindCards({
  control,
  isDisabled,
  isFixed,
}: FieldProps & { isFixed: boolean }) {
  const labelId = useId();
  const descriptionId = useId();
  return (
    <FormField
      control={control}
      name="kind"
      render={({ field }) => (
        <div className="flex flex-col gap-1">
          <span id={labelId} className={fieldLabel}>
            Kind
          </span>
          <RadioGroup
            aria-labelledby={labelId}
            name={field.name}
            value={field.value}
            disabled={isDisabled || isFixed}
            onBlur={field.onBlur}
            onValueChange={field.onChange}
            className="grid-cols-2 md:grid-cols-4"
          >
            {catalogSheetEntryKinds.map((kind) => (
              <RadioGroupItem
                key={kind}
                value={kind}
                aria-label={sheetEntryKindLabels[kind]}
                aria-describedby={`${descriptionId}-${kind}`}
                className="flex-col items-start gap-0.5 px-3 py-2 text-left"
              >
                <span>{sheetEntryKindLabels[kind]}</span>
                <span
                  id={`${descriptionId}-${kind}`}
                  className="text-muted-foreground font-sans text-xs"
                >
                  {kindDescriptions[kind]}
                </span>
              </RadioGroupItem>
            ))}
          </RadioGroup>
        </div>
      )}
    />
  );
}

function CheckField({
  control,
  isDisabled,
  name,
  label,
}: FieldProps & { name: 'lastsOverOneDay' | 'consumable'; label: string }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="gap-1">
          <FormLabel className="min-h-11 cursor-pointer gap-2 font-mono text-sm font-normal md:min-h-8">
            <FormControl>
              <Checkbox
                name={field.name}
                ref={field.ref}
                checked={field.value}
                disabled={isDisabled}
                onBlur={field.onBlur}
                onCheckedChange={field.onChange}
              />
            </FormControl>
            <span>{label}</span>
          </FormLabel>
        </FormItem>
      )}
    />
  );
}

function CasterLevelField({
  control,
  isDisabled,
  name,
  label,
  placeholder,
  description,
}: FieldProps & {
  name: 'defaultCasterLevel' | 'casterLevel';
  label: string;
  placeholder?: string;
  description?: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem className="gap-1">
          <FormLabel className={fieldLabel}>{label}</FormLabel>
          <FormControl>
            <Input
              {...field}
              disabled={isDisabled}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder={placeholder}
              className="h-11 w-24 text-center font-mono md:h-8"
            />
          </FormControl>
          {description ? (
            <p className="text-muted-foreground max-w-56 text-xs">
              {description}
            </p>
          ) : null}
          <FormMessage
            role={fieldState.error ? 'alert' : undefined}
            className="max-w-56"
          />
        </FormItem>
      )}
    />
  );
}

/**
 * What the chosen kind needs and nothing else: a Spell Effect's duration and
 * caster levels, an Item's consumable flag and armor or shield facts. A Condition or a Spell has no
 * further classification. A blank caster level reads as the default.
 */
export function SheetEntryKindFields({
  control,
  isDisabled,
  kind,
  defaultCasterLevel,
}: FieldProps & { kind: SheetEntryKind; defaultCasterLevel: string }) {
  if (kind === 'item')
    return (
      <div className="flex flex-col gap-1">
        <CheckField
          control={control}
          isDisabled={isDisabled}
          name="consumable"
          label="Consumable"
        />
        <SheetEntryArmorFields control={control} isDisabled={isDisabled} />
      </div>
    );
  if (kind !== 'spellEffect') return null;
  return (
    <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
      <CheckField
        control={control}
        isDisabled={isDisabled}
        name="lastsOverOneDay"
        label="Lasts more than one day"
      />
      <CasterLevelField
        control={control}
        isDisabled={isDisabled}
        name="defaultCasterLevel"
        label="Default caster level"
      />
      <CasterLevelField
        control={control}
        isDisabled={isDisabled}
        name="casterLevel"
        label="Caster level"
        placeholder={defaultCasterLevel.trim() || undefined}
        description="Blank uses the default caster level."
      />
    </div>
  );
}
