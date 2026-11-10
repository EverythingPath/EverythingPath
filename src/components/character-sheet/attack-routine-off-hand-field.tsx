'use client';
import { useId } from 'react';
import { FormControl, FormField, FormItem } from '~/components/ui/form';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { cn } from '~/lib/utils';
import { weaponCard } from './attack-routine-card-style';
import { AttackFieldFeedback } from './attack-field-feedback';
import {
  attackOffHandChoiceValue,
  describeWeapon,
  modeLabels,
} from './attack-routine-view-model';
import { chip, fieldLabel } from './sheet-parts';
import {
  attackRoutineModeSchema,
  type AttackRoutineValues,
  type useAttackRoutineForm,
} from './use-attack-routine-form';
import type { useCharacterSheet } from './use-character-sheet';

type Attacks = ReturnType<typeof useCharacterSheet>['attacks'];
type Row = Attacks['rows'][number];
type Editor = ReturnType<typeof useAttackRoutineForm>;
type OffHand = NonNullable<AttackRoutineValues['offHand']>;

// The None card's value; Gear IDs and `'otherEnd'` never take it.
const none = 'none';

/**
 * The routine's off hand (approved prototype's routine editor): None, the
 * other end of a double main weapon, or any weapon in Gear, as cards, then
 * the off hand's attack mode. Unusual choices stay selectable and saved;
 * the sheet's warnings explain them beside the cards. The weapon and its
 * mode save together, with one acknowledgement.
 */
export function AttackRoutineOffHandField({
  row,
  attacks,
  editor,
  mainWeaponEntryId,
  offHand,
  isReadOnly,
  describedBy,
}: {
  row: Row;
  attacks: Attacks;
  editor: Editor;
  mainWeaponEntryId: string;
  offHand: OffHand | null;
  isReadOnly: boolean;
  describedBy?: string;
}) {
  const weaponLabelId = useId();
  const modeLabelId = useId();
  const choices = attacks.offHandChoices(mainWeaponEntryId);
  const warnings = row.warnings.filter(
    (warning) => warning.subject === `${row.entryId}:off`,
  );
  const isOtherEndMissing =
    offHand?.kind === 'otherEnd' &&
    !choices.some((choice) => choice.choice.kind === 'otherEnd');

  function change(next: OffHand | null) {
    if (isReadOnly) return;
    void editor.change('offHand', next);
  }

  return (
    <FormField
      control={editor.form.control}
      name="offHand"
      render={({ field }) => (
        <FormItem className="gap-2">
          <div className="space-y-1">
            <span id={weaponLabelId} className={fieldLabel}>
              Off-hand weapon
            </span>
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
                aria-labelledby={weaponLabelId}
                name={field.name}
                value={offHand ? attackOffHandChoiceValue(offHand) : none}
                disabled={isReadOnly}
                onBlur={field.onBlur}
                onValueChange={(next) => {
                  if (next === none) return change(null);
                  const choice = choices.find(
                    (candidate) =>
                      attackOffHandChoiceValue(candidate.choice) === next,
                  );
                  if (choice)
                    change({
                      ...choice.choice,
                      mode: choice.defaultMode,
                    });
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
                    Main hand only
                  </span>
                </RadioGroupItem>
                {isOtherEndMissing ? (
                  <RadioGroupItem
                    value="end:otherEnd"
                    aria-label="Other end unavailable"
                    disabled
                    aria-describedby={describedBy}
                    className={weaponCard}
                  >
                    <span className="font-sans text-base">
                      Other end unavailable
                    </span>
                  </RadioGroupItem>
                ) : null}
                {choices.map((choice) => (
                  <RadioGroupItem
                    key={attackOffHandChoiceValue(choice.choice)}
                    value={attackOffHandChoiceValue(choice.choice)}
                    aria-label={
                      choice.active
                        ? choice.label
                        : `${choice.label}, switched off`
                    }
                    aria-describedby={cn(
                      `${weaponLabelId}-${attackOffHandChoiceValue(choice.choice)}`,
                      describedBy,
                    )}
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
                    <span
                      id={`${weaponLabelId}-${attackOffHandChoiceValue(choice.choice)}`}
                      className="text-muted-foreground text-xs [overflow-wrap:anywhere]"
                    >
                      {describeWeapon(choice.weapon)}
                    </span>
                  </RadioGroupItem>
                ))}
              </RadioGroup>
            </FormControl>
          </div>
          {offHand ? (
            <div className="space-y-1">
              <span id={modeLabelId} className={fieldLabel}>
                Off-hand attack mode
              </span>
              <RadioGroup
                aria-labelledby={modeLabelId}
                name="offHandMode"
                value={offHand.mode}
                disabled={isReadOnly}
                onValueChange={(next) =>
                  change({
                    ...offHand,
                    mode: attackRoutineModeSchema.parse(next),
                  })
                }
                className="grid-cols-3 gap-1"
              >
                {attackRoutineModeSchema.options.map((mode) => (
                  <RadioGroupItem
                    key={mode}
                    value={mode}
                    aria-describedby={describedBy}
                  >
                    {modeLabels[mode]}
                  </RadioGroupItem>
                ))}
              </RadioGroup>
            </div>
          ) : null}
          <AttackFieldFeedback
            status={editor.statusFor('offHand')}
            label="off-hand weapon"
            isDisabled={isReadOnly}
            onRetry={() => void editor.retry('offHand')}
          />
        </FormItem>
      )}
    />
  );
}
