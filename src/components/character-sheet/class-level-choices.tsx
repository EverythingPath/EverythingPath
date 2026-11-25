'use client';
import type { Id } from '@convex/_generated/dataModel';
import type { ReactNode } from 'react';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import {
  abilityKeys,
  abilityLabels,
  type FavoredClassBonus,
} from '~/lib/character-sheet';
import type { FavoredClassTargetReason } from '~/lib/character-sheet-favored-class-rewards';
import type {
  FavoredClassRewardChoice,
  SavedFavoredClassReward,
} from './character-sheet-classes-view-model';
import { cn } from '~/lib/utils';
import { ChoiceSelect, type ChoiceOption } from './choice-select';
import { ClassPicker } from './class-level-class-picker';
import { isChoiceMissing, listFieldWarnings } from './class-level-warnings';
import { InlineWarnings } from './inline-warning';
import { fieldLabel, RemoteNotice, SaveFeedback } from './sheet-parts';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';
import {
  favoredClassRewardValue,
  type useClassLevelChoicesForm,
} from './use-sheet-forms';

type Controller = ReturnType<typeof useCharacterSheet>;
type ChoicesEditor = ReturnType<typeof useClassLevelChoicesForm>;
type Classes = Controller['classes'];

/**
 * The hit point, the skill rank, the listed rewards that fit the level (a
 * targeted reward once per reviewed target the sheet has a per-day maximum
 * for, as the view model narrows the sheet's keys) and Other…; a saved reward
 * that is not offered stays the current value, marked by where it stands
 * (reward-target fix r1, r2: no longer fitting the level; or fitting while
 * its power is not one the reward lists, or the sheet no longer has it) and
 * not offered (fix r1), as a stale saved target is.
 */
function staleRewardLabel(
  saved: Exclude<SavedFavoredClassReward, { kind: 'offered' }>,
) {
  if (saved.kind === 'unlisted') return 'A reward the sheet no longer lists';
  if (saved.kind === 'notFitting')
    return `${saved.name} · no longer fits this level`;
  return `${saved.name} · ${targetMarks[saved.reason]}`;
}
/** Fix r2: a fitting reward's saved power, by the calculator's reason. */
const targetMarks: Record<FavoredClassTargetReason, string> = {
  targetMissing: 'no power chosen',
  targetUnlisted: 'can’t add to the power chosen',
  targetLost: 'no longer on your sheet',
};
function favoredBonusOptions(
  rewards: readonly FavoredClassRewardChoice[],
  saved: FavoredClassBonus | null | undefined,
  savedReward: SavedFavoredClassReward | null,
): ChoiceOption[] {
  const stale: ChoiceOption[] =
    saved?.choice === 'reward' && savedReward && savedReward.kind !== 'offered'
      ? [
          {
            value: favoredClassRewardValue(saved.reward, saved.target),
            label: staleRewardLabel(savedReward),
            disabled: true as const,
          },
        ]
      : [];
  return [
    { value: 'hp', label: '+1 hp' },
    { value: 'skill', label: '+1 skill rank' },
    ...rewards.map((reward) => ({
      value: favoredClassRewardValue(reward.reward, reward.target),
      label: reward.name,
    })),
    { value: 'alt', label: 'Other…' },
    ...stale,
  ];
}
const abilityOptions: ChoiceOption[] = abilityKeys.map((ability) => ({
  value: ability,
  label: `+1 ${abilityLabels[ability]}`,
}));

const cellLabel = cn(fieldLabel, 'md:sr-only');

type CellProps = {
  level: number;
  editor: ChoicesEditor;
  warnings: SheetWarningView[];
  warningController: Controller['warnings'];
  className?: string;
};

/**
 * The class, chosen among cards in place and saved as soon as it is chosen,
 * with its Original or Unchained version under it where it has both.
 */
export function ClassChoiceCell({
  level,
  editor,
  warnings,
  warningController,
  classes,
  entryId,
  classLabel,
  versionControl,
  className,
}: CellProps & {
  classes: Classes;
  entryId: Id<'characterSheetEntry'>;
  /** "Fighter 2": the class and how many levels of it so far. */
  classLabel: string | null;
  versionControl?: ReactNode;
}) {
  const maintenance = useInitialMigrationMaintenance();
  return (
    <FormField
      control={editor.form.control}
      name="classEntryId"
      render={({ field, fieldState }) => (
        <FormItem className={cn('min-w-0 gap-1', className)}>
          <span aria-hidden className={cellLabel}>
            Class
          </span>
          <ClassPicker
            label={`Class at level ${level}`}
            value={
              classes.choices.find(
                (choice) => choice.classEntryId === field.value,
              )?.classEntryId ?? null
            }
            classes={classes}
            entryId={entryId}
            isMissing={isChoiceMissing(warnings, 'class')}
            disabled={maintenance.readOnly}
            onValueChange={(classEntryId) => {
              field.onChange(classEntryId ?? '');
              void editor.save();
            }}
            renderTrigger={(trigger) => <FormControl>{trigger}</FormControl>}
          />
          {classLabel ? (
            <p className="text-muted-foreground font-mono text-xs">
              {classLabel}
            </p>
          ) : null}
          {fieldState.error ? <FormMessage role="alert" /> : null}
          {versionControl}
          <InlineWarnings
            warnings={listFieldWarnings(warnings, 'class')}
            controller={warningController}
          />
        </FormItem>
      )}
    />
  );
}

/**
 * The favored class bonus. "Other…" opens the note beside it and waits for
 * the note before saving; the note saves when left or on Enter, and an empty
 * note is refused at the field.
 */
export function FavoredClassBonusCell({
  level,
  editor,
  warnings,
  warningController,
  rewards,
  savedBonus,
  savedReward,
  className,
}: CellProps & {
  /** The listed rewards that fit this level, by name. */
  rewards: readonly FavoredClassRewardChoice[];
  savedBonus: FavoredClassBonus | null | undefined;
  /** Where the saved reward stands, if one is saved. */
  savedReward: SavedFavoredClassReward | null;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const isMissing = isChoiceMissing(warnings, 'favoredClassBonus');
  const isAlternative = editor.form.watch('favoredClassBonus') === 'alt';
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span aria-hidden className={cellLabel}>
        Favored
      </span>
      <div className="flex flex-wrap items-start gap-1">
        <FormField
          control={editor.form.control}
          name="favoredClassBonus"
          render={({ field }) => (
            <FormItem className="min-w-32 flex-1 gap-1">
              <ChoiceSelect
                label={`Favored class bonus at level ${level}`}
                value={field.value}
                options={favoredBonusOptions(rewards, savedBonus, savedReward)}
                emptyLabel="None"
                isMissing={isMissing}
                isDim={!isMissing}
                disabled={maintenance.readOnly}
                onValueChange={(value) => {
                  field.onChange(value);
                  if (value !== 'alt') void editor.save();
                }}
                renderTrigger={(trigger) => (
                  <FormControl>{trigger}</FormControl>
                )}
              />
            </FormItem>
          )}
        />
        {isAlternative ? (
          <FormField
            control={editor.form.control}
            name="favoredClassNote"
            render={({ field, fieldState }) => (
              <FormItem className="min-w-36 flex-1 gap-1">
                <FormLabel className="sr-only">
                  Alternative favored class bonus at level {level}
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    disabled={maintenance.readOnly}
                    type="text"
                    autoComplete="off"
                    placeholder="Alternative favored class bonus"
                    className="h-10 font-mono text-sm md:h-8"
                    onBlur={() => {
                      field.onBlur();
                      if (editor.form.formState.isDirty) void editor.save();
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return;
                      event.preventDefault();
                      void editor.save();
                    }}
                  />
                </FormControl>
                {fieldState.error ? <FormMessage role="alert" /> : null}
              </FormItem>
            )}
          />
        ) : null}
      </div>
      <InlineWarnings
        warnings={listFieldWarnings(warnings, 'favoredClassBonus')}
        controller={warningController}
      />
    </div>
  );
}

/** The ability increase, open on every row and dimmed where none is due. */
export function AbilityIncreaseCell({
  level,
  editor,
  warnings,
  warningController,
  isDue,
  className,
}: CellProps & { isDue: boolean }) {
  const maintenance = useInitialMigrationMaintenance();
  return (
    <FormField
      control={editor.form.control}
      name="abilityIncrease"
      render={({ field }) => (
        <FormItem className={cn('gap-1', className)}>
          <span aria-hidden className={cellLabel}>
            Ability
          </span>
          <ChoiceSelect
            label={`Ability increase at level ${level}`}
            value={field.value}
            options={abilityOptions}
            emptyLabel="None"
            isMissing={isChoiceMissing(warnings, 'abilityIncrease')}
            isDim={!isDue}
            disabled={maintenance.readOnly}
            onValueChange={(value) => {
              field.onChange(value);
              void editor.save();
            }}
            renderTrigger={(trigger) => <FormControl>{trigger}</FormControl>}
          />
          <InlineWarnings
            warnings={listFieldWarnings(warnings, 'abilityIncrease')}
            controller={warningController}
          />
        </FormItem>
      )}
    />
  );
}

/**
 * What became of the row's choices: saving, saved or refused beside them,
 * a Save for anything still unsaved (a refused save, a note not yet left),
 * and another player's edit. The level's rank warnings sit by its
 * allocation in the Skills block.
 */
export function ChoicesFeedback({
  level,
  editor,
  className,
}: Omit<CellProps, 'warnings' | 'warningController'>) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const isSaving = editor.status.kind === 'saving';
  const isDirty = editor.form.formState.isDirty;
  if (
    !isDirty &&
    !isSaving &&
    editor.status.kind === 'idle' &&
    !editor.hasRemoteChange
  )
    return null;
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 text-xs',
        className,
      )}
    >
      {isDirty || isSaving ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-10 md:min-h-8"
          aria-describedby={reasonId}
          disabled={isSaving || maintenance.readOnly}
          onClick={() => {
            if (maintenance.readOnly) return;
            void editor.save();
          }}
        >
          {isSaving ? 'Saving…' : 'Save choices'}
        </Button>
      ) : null}
      <SaveFeedback status={editor.status} savedText="Choices saved." />
      <RemoteNotice
        isShown={editor.hasRemoteChange}
        message={
          isDirty
            ? 'Updated by another player. Your edits are kept.'
            : 'Updated by another player.'
        }
        subject={`level ${level} choices`}
        onDismiss={editor.dismissRemoteChange}
      />
    </div>
  );
}
