'use client';
import { useId } from 'react';
import { useController, useWatch } from 'react-hook-form';
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
import { describeArmorCategory } from './equipment-statistics';
import { fieldLabel } from './sheet-parts';
import {
  armorCategoriesBySlot,
  type useSheetEntryForm,
} from './use-sheet-entry-form';

type Control = ReturnType<typeof useSheetEntryForm>['form']['control'];
type FieldProps = { control: Control; isDisabled: boolean };
type NumberField =
  | 'armorBonus'
  | 'armorMaxDex'
  | 'armorCheckPenalty'
  | 'armorSpellFailure';

const slotLabels = { armor: 'Armor', shield: 'Shield' } as const;

function ArmorNumberField({
  control,
  isDisabled,
  name,
  label,
  description,
}: FieldProps & { name: NumberField; label: string; description?: string }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem className="max-w-40 gap-1">
          <FormLabel className={fieldLabel}>{label}</FormLabel>
          <FormControl>
            <Input
              {...field}
              disabled={isDisabled}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className="h-11 w-24 text-center font-mono md:h-8"
            />
          </FormControl>
          {description ? (
            <p className="text-muted-foreground max-w-40 text-xs">
              {description}
            </p>
          ) : null}
          <FormMessage
            role={fieldState.error ? 'alert' : undefined}
            className="max-w-40"
          />
        </FormItem>
      )}
    />
  );
}

// Slot and category as cards; a new slot clears a category it cannot have.
function ArmorKindCards({ control, isDisabled }: FieldProps) {
  const slotId = useId();
  const categoryId = useId();
  const slot = useController({ control, name: 'armorSlot' });
  const category = useController({ control, name: 'armorCategory' });
  return (
    <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
      <div className="flex flex-col gap-1">
        <span id={slotId} className={fieldLabel}>
          Slot
        </span>
        <RadioGroup
          aria-labelledby={slotId}
          name={slot.field.name}
          value={slot.field.value}
          disabled={isDisabled}
          onBlur={slot.field.onBlur}
          onValueChange={(value) => {
            slot.field.onChange(value);
            category.field.onChange('');
          }}
          className="grid-cols-2"
        >
          {(['armor', 'shield'] as const).map((value) => (
            <RadioGroupItem key={value} value={value}>
              {slotLabels[value]}
            </RadioGroupItem>
          ))}
        </RadioGroup>
      </div>
      <div className="flex flex-col gap-1">
        <span id={categoryId} className={fieldLabel}>
          Category
        </span>
        <RadioGroup
          aria-labelledby={categoryId}
          name={category.field.name}
          value={category.field.value}
          disabled={isDisabled}
          onBlur={category.field.onBlur}
          onValueChange={category.field.onChange}
          className="grid-cols-2 sm:grid-cols-4"
        >
          {armorCategoriesBySlot[slot.field.value].map((value) => (
            <RadioGroupItem key={value} value={value} className="px-2">
              {describeArmorCategory({
                slot: slot.field.value,
                category: value,
              })}
            </RadioGroupItem>
          ))}
        </RadioGroup>
        {category.fieldState.error ? (
          <p role="alert" className="text-destructive text-xs">
            {category.fieldState.error.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * An item's armor or shield facts, recorded with its definition: slot,
 * category, bonus, maximum Dexterity bonus (blank for no limit), armor check
 * penalty and arcane spell failure. Equipping, enhancement and material
 * belong to the Equipment block.
 */
export function SheetEntryArmorFields({ control, isDisabled }: FieldProps) {
  const isArmor = useWatch({ control, name: 'isArmor' });
  return (
    <div className="flex flex-col gap-2">
      <FormField
        control={control}
        name="isArmor"
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
              <span>Armor or shield</span>
            </FormLabel>
          </FormItem>
        )}
      />
      {isArmor ? (
        <>
          <ArmorKindCards control={control} isDisabled={isDisabled} />
          <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
            <ArmorNumberField
              control={control}
              isDisabled={isDisabled}
              name="armorBonus"
              label="Armor or shield bonus"
            />
            <ArmorNumberField
              control={control}
              isDisabled={isDisabled}
              name="armorMaxDex"
              label="Maximum Dexterity bonus"
              description="Blank for no limit."
            />
            <ArmorNumberField
              control={control}
              isDisabled={isDisabled}
              name="armorCheckPenalty"
              label="Armor check penalty"
              description="As a positive number."
            />
            <ArmorNumberField
              control={control}
              isDisabled={isDisabled}
              name="armorSpellFailure"
              label="Arcane spell failure %"
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
