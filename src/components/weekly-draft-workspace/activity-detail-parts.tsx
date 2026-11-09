'use client';
import { Plus, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '~/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import {
  actionChoiceRolls,
  type StagedActionChoice,
} from '~/lib/weekly-draft-facts';
import type {
  DetailCommon,
  DetailConsumables,
  DetailOption,
  DetailRoll,
} from './activity-action-detail';
import type { CommonFieldEdits } from './activity-action-edits';
import { signed } from './activity-check-row';
import { ActivityModifierForm } from './activity-modifier-form';
import { ActivityOptionCards } from './activity-option-cards';
import { RollTotalField } from './roll-total-field';
import { WholeNumberField } from './whole-number-field';

// The pieces every action detail editor shares: a field with its save
// failure, option cards, notes, and the cost, dice rolls and consumables
// that follow the action's own choices.

export type FieldError = { field: string; message: string } | null;
export type FieldContext<Edits extends CommonFieldEdits = CommonFieldEdits> = {
  edits: Edits;
  disabled: boolean;
  fieldError: FieldError;
};

export function Field({
  name,
  context,
  children,
}: {
  name: string;
  context: Pick<FieldContext, 'fieldError'>;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1">
      {children}
      {context.fieldError?.field === name && (
        <p role="alert" className="text-destructive text-sm">
          {context.fieldError.message}
        </p>
      )}
    </div>
  );
}

export function OptionField({
  context,
  field,
  label,
  options,
  value,
  otherLabel,
  description,
  onSelect,
  onClear,
}: {
  context: FieldContext;
  field: string;
  label: string;
  options: DetailOption[];
  value: string | null;
  otherLabel: string;
  description?: ReactNode;
  // Default to the plain field edit of `field`.
  onSelect?: (value: string) => void;
  onClear?: () => void;
}) {
  return (
    <Field name={field} context={context}>
      <ActivityOptionCards
        label={label}
        options={options}
        value={value}
        otherLabel={otherLabel}
        description={description}
        disabled={context.disabled}
        onSelect={onSelect ?? ((next) => context.edits.set(field, next))}
        onClear={onClear ?? (() => context.edits.clear(field))}
      />
    </Field>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <p role="note" className="text-sm text-amber-300">
      {children}
    </p>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground text-sm">{children}</p>;
}

function RollBlock({
  roll,
  choice,
  context,
}: {
  roll: DetailRoll;
  choice: StagedActionChoice;
  context: FieldContext;
}) {
  const [isAdding, setAdding] = useState(false);
  const recorded = actionChoiceRolls(choice)[roll.field];
  // Each entry is removed by its recorded position, so repeated or legacy
  // modifiers clear one at a time.
  const positioned = (recorded?.modifiers ?? []).map((modifier, index) => ({
    modifier,
    index,
  }));
  const name = roll.label.toLowerCase();
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-sm font-semibold">{roll.label}</legend>
      {roll.when && (
        <p className="text-muted-foreground text-xs">{roll.when}</p>
      )}
      <RollTotalField
        label={`${roll.label} roll`}
        spec={roll.spec}
        recorded={recorded}
        required={roll.required}
        disabled={context.disabled}
        onRoll={(next) => context.edits.setRoll(roll.field, next)}
      />
      {recorded && (
        <div className="space-y-2">
          {recorded.modifiers.length > 0 && (
            <ul
              aria-label={`${roll.label} roll modifiers`}
              className="max-w-xl divide-y rounded-md border text-sm"
            >
              {positioned.map(({ modifier, index }) => (
                <li
                  key={index}
                  className="flex min-h-11 items-center gap-3 px-3 py-1.5"
                >
                  <span className="w-8 shrink-0 font-mono">
                    {signed(modifier.value)}
                  </span>
                  <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                    {modifier.reason}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${name} roll modifier ${modifier.reason}`}
                    disabled={context.disabled}
                    onClick={() =>
                      context.edits.removeRollModifier(roll.field, index)
                    }
                  >
                    <X aria-hidden className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {isAdding ? (
            <ActivityModifierForm
              bonusChoices={[]}
              disabled={context.disabled}
              onAdd={(modifier) => {
                context.edits.addRollModifier(roll.field, modifier);
                setAdding(false);
              }}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground -ml-2"
              disabled={context.disabled}
              onClick={() => setAdding(true)}
            >
              <Plus aria-hidden />
              Add {name} roll modifier
            </Button>
          )}
        </div>
      )}
    </fieldset>
  );
}

function Consumables({
  consumables,
  context,
}: {
  consumables: DetailConsumables;
  context: FieldContext;
}) {
  if (consumables.selected.length === 0 && consumables.available.length === 0)
    return null;
  return (
    <Field name="consumableIds" context={context}>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Consumables</h3>
        <p className="text-muted-foreground text-xs">
          A consumable bonus is used by this choice’s check.
        </p>
        {consumables.selected.length > 0 && (
          <ul
            aria-label="Selected consumables"
            className="max-w-xl divide-y rounded-md border text-sm"
          >
            {consumables.selected.map((entry) => (
              <li
                key={entry.value}
                className="flex min-h-11 items-center gap-3 px-3 py-1.5"
              >
                <span className="min-w-0 flex-1 space-y-0.5 [overflow-wrap:anywhere]">
                  <span className="block">{entry.label}</span>
                  {entry.missing && (
                    <span role="note" className="block text-xs text-amber-300">
                      Missing
                    </span>
                  )}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove consumable ${entry.label}`}
                  disabled={context.disabled}
                  onClick={() => context.edits.removeConsumable(entry.value)}
                >
                  <X aria-hidden className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {consumables.available.length > 0 && (
          <Select
            value=""
            disabled={context.disabled}
            onValueChange={(value) => context.edits.addConsumable(value)}
          >
            <SelectTrigger
              aria-label="Add consumable"
              className="w-full max-w-xl"
            >
              <SelectValue placeholder="Add consumable…" />
            </SelectTrigger>
            <SelectContent>
              {consumables.available.map((entry) => (
                <SelectItem
                  key={entry.value}
                  value={entry.value}
                  className="min-h-10"
                >
                  {entry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </Field>
  );
}

// The entered cost (the calculated cost until the table enters one, and an
// explicit zero wins), then the rolls and consumables.
export function CommonFields({
  choice,
  detail,
  calculatedCostCopper,
  context,
  costDescription,
}: {
  choice: StagedActionChoice;
  detail: DetailCommon;
  calculatedCostCopper: number | null;
  context: FieldContext;
  // Replaces the note used when the rules calculate no cost (Special's cost
  // is the table's to set).
  costDescription?: string;
}) {
  // Always rendered so a roll that appears once the check meets its condition
  // is announced; a live region inserted together with its text is not.
  const appeared = detail.rolls
    .filter((roll) => roll.shownBecause !== null)
    .map((roll) => `${roll.shownBecause}: enter the ${roll.label} roll.`)
    .join(' ');
  return (
    <>
      <p className="sr-only" aria-live="polite">
        {appeared}
      </p>
      <Field name="costCopper" context={context}>
        <WholeNumberField
          label="Cost (copper)"
          value={choice.costCopper ?? calculatedCostCopper}
          disabled={context.disabled}
          onValue={(next) => context.edits.set('costCopper', next ?? undefined)}
          description={
            calculatedCostCopper !== null
              ? `Calculated: ${calculatedCostCopper} cp`
              : (costDescription ??
                'The rules calculate no cost for this action.')
          }
        />
      </Field>
      {detail.rolls.length > 0 && (
        <Field name="rolls" context={context}>
          <div className="space-y-4">
            {detail.rolls.map((roll) => (
              <RollBlock
                key={roll.field}
                roll={roll}
                choice={choice}
                context={context}
              />
            ))}
          </div>
        </Field>
      )}
      {detail.consumables && (
        <Consumables consumables={detail.consumables} context={context} />
      )}
    </>
  );
}
