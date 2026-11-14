'use client';
import { Check } from 'lucide-react';
import { useId } from 'react';
import { isFlurryIdentity } from '~/lib/character-sheet-flurry';
import {
  readRoutineOptionProblem,
  routineOptionWarningSubject,
} from '~/lib/character-sheet-routine-options';
import { cn } from '~/lib/utils';
import { AttackFieldFeedback } from './attack-field-feedback';
import { AttackRateNotes } from './attack-rate-notes';
import { AttackRoutineWarnings } from './attack-routine-warnings';
import { fieldLabel } from './sheet-parts';
import type { useAttackRoutineForm } from './use-attack-routine-form';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;
type Row = Controller['attacks']['rows'][number];
type Option = Row['options'][number];
type RoutineWarning = Row['warnings'][number];
type Editor = ReturnType<typeof useAttackRoutineForm>;

const hint = 'text-xs [overflow-wrap:anywhere]';

const isFlurry = (option: Option) =>
  option.ruleIdentity !== null && isFlurryIdentity(option.ruleIdentity);

/** A flurry of blows first (#414): it reshapes the whole full attack. */
function orderOptions(options: readonly Option[]) {
  return [...options].sort(
    (left, right) => Number(isFlurry(right)) - Number(isFlurry(left)),
  );
}

/**
 * The switched-on flurry that counts, which the armor-or-shield advisory
 * sits beneath once per routine; the first flurry otherwise.
 */
function findFlurryInEffect(options: readonly Option[]) {
  const flurries = orderOptions(options).filter(isFlurry);
  return (
    flurries.find((option) => option.switchedOn && option.available) ??
    flurries[0]
  );
}

/** Why a switched-on option without its feat has no effect, by its warning's facts. */
function describeUnavailable(warning: RoutineWarning | undefined) {
  const problem = warning ? readRoutineOptionProblem(warning) : null;
  if (problem === 'not-option') return 'not a Routine Option';
  if (problem === 'inactive') return 'the feat is switched off';
  if (problem === 'not-counting') return 'the class feature doesn’t count';
  if (warning?.check === 'invalidRoutineOption') return 'no longer available';
  return 'the feat isn’t on the sheet';
}

/**
 * The words beside a switched-on option that changes nothing here: its feat
 * is missing or switched off, or its definition is gone or no Routine Option
 * (amber, read from the resolver's advisory), or it does not apply to this
 * routine (muted; `row.optionNotes` says why).
 */
function describeOption(option: Option, warnings: readonly RoutineWarning[]) {
  if (!option.switchedOn) return null;
  if (!option.available)
    return { tone: 'text-amber-300', text: describeUnavailable(warnings[0]) };
  if (!option.applicable)
    return { tone: 'text-muted-foreground', text: 'no effect in this routine' };
  return null;
}

/**
 * The routine's Routine Options (approved prototype's routine editor, #407):
 * one row per offered or switched-on feat, a switch named by the feat, saved
 * at once as the routine's whole list. A switched-on option
 * without its feat stays on, amber, with the resolver's advisory and Accept
 * beneath it; nothing here is disabled for the rules, only for maintenance.
 * A monk's flurry of blows is one more switch, first (#414); its class
 * feature no longer counting reads amber like a missing feat, and the
 * armor-or-shield advisory sits once, beneath the flurry in effect. The
 * resolver's option notes follow the list.
 */
export function AttackRoutineOptionsField({
  row,
  editor,
  isReadOnly,
  describedBy,
  warnings,
  warningController,
}: {
  row: Row;
  editor: Editor;
  isReadOnly: boolean;
  describedBy?: string;
  /** The sheet's warnings and Accept, for advisories beneath their option. */
  warnings?: SheetWarningView[];
  warningController?: Controller['warnings'];
}) {
  const labelId = useId();
  const chosen = editor.form.watch('options') ?? [];
  if (row.options.length === 0) return null;
  function toggle(catalogEntryId: string, isOn: boolean) {
    if (isReadOnly) return;
    void editor.change(
      'options',
      isOn
        ? [...chosen, catalogEntryId]
        : chosen.filter((id) => id !== catalogEntryId),
    );
  }
  const flurryInEffect = findFlurryInEffect(row.options);
  const optionWarnings = (option: Option) =>
    row.warnings.filter(
      (warning) =>
        ((warning.check === 'missingRoutineOption' ||
          warning.check === 'invalidRoutineOption') &&
          warning.subject ===
            routineOptionWarningSubject(row.entryId, option.catalogEntryId)) ||
        (warning.check === 'flurryArmor' && option === flurryInEffect),
    );
  return (
    <fieldset
      aria-labelledby={labelId}
      aria-describedby={describedBy}
      className="border-foreground/15 space-y-2 border-t pt-3"
    >
      <h3 id={labelId} className={fieldLabel}>
        Options
      </h3>
      <ul className="space-y-1">
        {orderOptions(row.options).map((option) => {
          const ownWarnings = optionWarnings(option);
          const description = describeOption(option, ownWarnings);
          const hintId = `${labelId}-${option.catalogEntryId}`;
          const warningId = `${hintId}-warning`;
          const isOn = chosen.includes(option.catalogEntryId);
          return (
            <li key={option.catalogEntryId} className="space-y-1">
              <label className="flex min-h-11 items-center gap-2 text-sm md:min-h-9">
                <button
                  type="button"
                  role="switch"
                  aria-checked={isOn}
                  disabled={isReadOnly}
                  aria-label={option.name}
                  aria-describedby={
                    cn(
                      description && hintId,
                      ownWarnings.length > 0 && warningId,
                      describedBy,
                    ) || undefined
                  }
                  onClick={() => toggle(option.catalogEntryId, !isOn)}
                  className={cn(
                    'inline-flex size-6 shrink-0 items-center justify-center border',
                    isOn
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-foreground/40 hover:border-foreground text-transparent',
                    'disabled:opacity-50',
                  )}
                >
                  <Check aria-hidden className="size-4" />
                </button>
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {option.name}
                </span>
                {description ? (
                  <span id={hintId} className={cn(hint, description.tone)}>
                    {description.text}
                  </span>
                ) : null}
              </label>
              {ownWarnings.length > 0 ? (
                <>
                  {/* The toggle is described by the advisory alone, not its Accept. */}
                  <span id={warningId} hidden>
                    {ownWarnings.map((warning) => warning.message).join(' ')}
                  </span>
                  <AttackRoutineWarnings
                    warnings={ownWarnings}
                    sheetWarnings={warnings}
                    controller={warningController}
                    className="pl-8"
                  />
                </>
              ) : null}
            </li>
          );
        })}
      </ul>
      <AttackRateNotes notes={row.optionNotes} label="Options" />
      <AttackFieldFeedback
        status={editor.statusFor('options')}
        label="options"
        isDisabled={isReadOnly}
        onRetry={() => void editor.retry('options')}
      />
    </fieldset>
  );
}
