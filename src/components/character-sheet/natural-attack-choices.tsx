'use client';
import { X } from 'lucide-react';
import type { ControllerRenderProps } from 'react-hook-form';
import { Button } from '~/components/ui/button';
import { Checkbox } from '~/components/ui/checkbox';
import { cn } from '~/lib/utils';
import { weaponCard } from './attack-routine-card-style';
import { AttackWarningParagraph } from './attack-warning-paragraph';
import { describeWeapon } from './attack-routine-view-model';
import { action, chip } from './sheet-parts';
import type { AttackRoutineValues } from './use-attack-routine-form';
import type { useCharacterSheet } from './use-character-sheet';
type Attacks = ReturnType<typeof useCharacterSheet>['attacks'];
const hint = 'text-muted-foreground text-xs';
const checkboxCard = cn(
  weaponCard,
  'border-foreground/40 bg-card has-checked:border-primary has-focus-visible:ring-ring/50 flex min-h-11 w-full min-w-0 cursor-pointer border has-checked:shadow-xs has-focus-visible:ring-[3px] has-disabled:cursor-not-allowed has-disabled:opacity-50 md:min-h-9',
);

export function NaturalAttackChoices({
  row,
  choices,
  chosen,
  field,
  isReadOnly,
  describedBy,
  groupLabelId,
  choose,
  onEdit,
}: {
  row: Attacks['rows'][number];
  choices: Attacks['naturalAttacks'];
  chosen: string[];
  field: Pick<
    ControllerRenderProps<AttackRoutineValues, 'naturalAttackEntryIds'>,
    'name' | 'onBlur'
  >;
  isReadOnly: boolean;
  describedBy?: string;
  groupLabelId: string;
  choose: (next: string[]) => void;
  onEdit: (entryId: string, button: HTMLButtonElement) => void;
}) {
  const missing = chosen.filter(
    (entryId) => !choices.some((choice) => choice.entryId === entryId),
  );
  const naturalWarnings = (entryId: string) =>
    row.warnings.filter(
      (warning) => warning.subject === `${row.entryId}:natural:${entryId}`,
    );
  return (
    <div
      role="group"
      aria-labelledby={groupLabelId}
      className="grid grid-cols-1 gap-1 sm:grid-cols-2"
    >
      {choices.length === 0 && missing.length === 0 ? (
        <p className={cn(hint, 'sm:col-span-2')}>
          Add a natural attack to include it in this routine.
        </p>
      ) : null}
      {choices.map((choice) => {
        const ownWarnings = naturalWarnings(choice.entryId);
        const factsId = `${groupLabelId}-${choice.entryId}`;
        const warningId = `${factsId}-warning`;
        const isChosen = chosen.includes(choice.entryId);
        return (
          <div key={choice.entryId} className="min-w-0 space-y-1">
            <label className={checkboxCard}>
              <span className="flex w-full items-baseline gap-2">
                <Checkbox
                  name={field.name}
                  value={choice.entryId}
                  checked={isChosen}
                  disabled={isReadOnly}
                  aria-label={
                    choice.active
                      ? choice.label
                      : `${choice.label}, switched off`
                  }
                  aria-describedby={cn(
                    factsId,
                    ownWarnings.length > 0 && warningId,
                    describedBy,
                  )}
                  className="self-center"
                  onBlur={field.onBlur}
                  onCheckedChange={(checked) =>
                    choose(
                      checked
                        ? [...chosen, choice.entryId]
                        : chosen.filter(
                            (entryId) => entryId !== choice.entryId,
                          ),
                    )
                  }
                />
                <span className="min-w-0 flex-1 font-sans text-base leading-tight [overflow-wrap:anywhere]">
                  {choice.label}
                </span>
                {choice.active ? null : (
                  <span className={cn(chip, 'text-muted-foreground')}>
                    Switched off
                  </span>
                )}
              </span>
              <span
                id={factsId}
                className="text-muted-foreground pl-6 text-xs [overflow-wrap:anywhere]"
              >
                {describeWeapon(choice.weapon)}
              </span>
            </label>
            {choice.canEdit ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(action, 'h-auto gap-1 px-2 text-xs')}
                aria-label={`Edit ${choice.label}`}
                aria-describedby={describedBy}
                disabled={isReadOnly}
                onClick={(event) => {
                  onEdit(choice.entryId, event.currentTarget);
                }}
              >
                Edit
              </Button>
            ) : null}
            {choice.editReason ? (
              <p className={hint}>{choice.editReason}</p>
            ) : null}
            {ownWarnings.length > 0 ? (
              <div id={warningId}>
                {ownWarnings.map((warning) => (
                  <AttackWarningParagraph
                    key={`${warning.check}:${warning.subject}`}
                    warning={warning}
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
      {missing.map((entryId, index) => {
        const warningId = `${groupLabelId}-missing-${index}`;
        return (
          <div
            key={entryId}
            className="border-foreground/40 flex min-w-0 flex-col gap-1 border border-dashed px-2.5 py-1.5"
          >
            <span className="flex w-full flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 font-sans text-base leading-tight">
                Unavailable natural attack
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  action,
                  'hover:text-destructive h-auto gap-1 px-2 text-xs',
                )}
                aria-describedby={cn(warningId, describedBy)}
                disabled={isReadOnly}
                onClick={() =>
                  choose(chosen.filter((candidate) => candidate !== entryId))
                }
              >
                <X aria-hidden className="size-3.5" />
                Remove{' '}
                <span className="sr-only">unavailable natural attack</span>
              </Button>
            </span>
            <div id={warningId}>
              {naturalWarnings(entryId).map((warning) => (
                <AttackWarningParagraph
                  key={`${warning.check}:${warning.subject}`}
                  warning={warning}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
