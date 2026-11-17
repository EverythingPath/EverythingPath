'use client';
import { Plus } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '~/components/ui/button';
import { FormControl, FormField, FormItem } from '~/components/ui/form';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { cn } from '~/lib/utils';
import { weaponCard } from './attack-routine-card-style';
import { AttackFieldFeedback } from './attack-field-feedback';
import { action, chip, fieldLabel } from './sheet-parts';
import type { useAttackRoutineForm } from './use-attack-routine-form';
import type { useCharacterSheet } from './use-character-sheet';
import { WeaponCatalogChoices } from './weapon-catalog-choices';

type Attacks = ReturnType<typeof useCharacterSheet>['attacks'];
type Row = Attacks['rows'][number];
type Editor = ReturnType<typeof useAttackRoutineForm>;

// The None card's value; a Gear row never takes it.
const none = 'none';
const hint = 'text-muted-foreground text-xs';

/**
 * The ammunition a ranged routine fires from its launcher, in either hand:
 * None or any ammunition in Gear, as cards, with Add ammunition from the
 * catalog beneath them. Ammunition that is gone or switched off stays
 * chosen with the sheet's warning beside the cards, so the choice can be
 * repaired rather than lost. Choosing saves at once, with one
 * acknowledgement.
 */
export function AttackRoutineAmmunitionField({
  row,
  attacks,
  editor,
  launcherLabel,
  ammunitionEntryId,
  isReadOnly,
  describedBy,
}: {
  row: Row;
  attacks: Attacks;
  editor: Editor;
  /** The launcher's label, the main weapon's first; null while it is missing. */
  launcherLabel: string | null;
  ammunitionEntryId: string | null;
  isReadOnly: boolean;
  describedBy?: string;
}) {
  const labelId = useId();
  const catalogId = useId();
  const [isAdding, setIsAdding] = useState(false);
  const choices = attacks.ammunition;
  const warnings = row.warnings.filter((warning) =>
    warning.check.endsWith('AttackAmmunition'),
  );
  const isChoiceMissing =
    ammunitionEntryId !== null &&
    !choices.some((choice) => choice.entryId === ammunitionEntryId);
  const canAdd = attacks.ammunitionCatalog.length > 0;

  return (
    <FormField
      control={editor.form.control}
      name="ammunitionEntryId"
      render={({ field }) => (
        <FormItem className="gap-1">
          <span id={labelId} className={fieldLabel}>
            Ammunition
          </span>
          <p className={hint}>
            {launcherLabel
              ? `Fired from ${launcherLabel}; the attack names both.`
              : 'Fired from the launcher; the attack names both.'}
          </p>
          {warnings.map((warning) => (
            <p
              key={`${warning.check}:${warning.subject}`}
              className="text-xs [overflow-wrap:anywhere] text-amber-300"
            >
              {warning.message}
            </p>
          ))}
          <FormControl>
            <RadioGroup
              aria-labelledby={labelId}
              name={field.name}
              value={ammunitionEntryId ?? none}
              disabled={isReadOnly}
              onBlur={field.onBlur}
              onValueChange={(next) => {
                if (isReadOnly) return;
                void editor.change(
                  'ammunitionEntryId',
                  next === none ? null : next,
                );
              }}
              className="grid-cols-1 gap-1 sm:grid-cols-2"
            >
              <RadioGroupItem
                value={none}
                aria-label="None"
                aria-describedby={describedBy}
                className={weaponCard}
              >
                <span className="font-sans text-base">None</span>
                <span className="text-muted-foreground text-xs">
                  Launcher only
                </span>
              </RadioGroupItem>
              {isChoiceMissing ? (
                <RadioGroupItem
                  value={ammunitionEntryId}
                  aria-label="Ammunition unavailable"
                  disabled
                  aria-describedby={describedBy}
                  className={weaponCard}
                >
                  <span className="font-sans text-base">
                    Ammunition unavailable
                  </span>
                </RadioGroupItem>
              ) : null}
              {choices.map((choice) => (
                <RadioGroupItem
                  key={choice.entryId}
                  value={choice.entryId}
                  aria-label={
                    choice.active
                      ? choice.label
                      : `${choice.label}, switched off`
                  }
                  aria-describedby={describedBy}
                  className={weaponCard}
                >
                  <span className="flex w-full flex-wrap items-baseline gap-x-2">
                    <span className="min-w-0 font-sans text-base [overflow-wrap:anywhere]">
                      {choice.label}
                    </span>
                    {choice.active ? null : (
                      <span className={cn(chip, 'text-muted-foreground')}>
                        Switched off
                      </span>
                    )}
                  </span>
                </RadioGroupItem>
              ))}
            </RadioGroup>
          </FormControl>
          {choices.length === 0 && !canAdd ? (
            <p className={hint}>No ammunition in Gear.</p>
          ) : null}
          {canAdd ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                action,
                'h-auto w-fit gap-1 rounded-none px-2 text-xs',
              )}
              aria-expanded={isAdding}
              aria-controls={isAdding ? catalogId : undefined}
              disabled={isReadOnly}
              aria-describedby={describedBy}
              onClick={() => setIsAdding(!isAdding)}
            >
              <Plus aria-hidden className="size-3" />
              Add ammunition
            </Button>
          ) : null}
          {isAdding && canAdd ? (
            <WeaponCatalogChoices
              id={catalogId}
              attacks={attacks}
              kind="ammunition"
            />
          ) : null}
          <AttackFieldFeedback
            status={editor.statusFor('ammunitionEntryId')}
            label="ammunition"
            isDisabled={isReadOnly}
            onRetry={() => void editor.retry('ammunitionEntryId')}
          />
        </FormItem>
      )}
    />
  );
}
