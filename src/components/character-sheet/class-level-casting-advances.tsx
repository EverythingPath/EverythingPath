'use client';
import type { Id } from '@convex/_generated/dataModel';
import { useId } from 'react';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { cn } from '~/lib/utils';
import type { CastingAdvanceChoice } from './casting-advances-view-model';
import { ChoiceSelect } from './choice-select';
import { InlineWarnings } from './inline-warning';
import { fieldLabel, SaveFeedback } from './sheet-parts';
import type { useCharacterSheet } from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;
type Classes = Controller['classes'];

/** What a Casting advance does, stated once under a level's advances. */
export const castingAdvanceHelp =
  "Each advance adds a level to that class's spellcasting: caster level, spells per day and spells known.";

// One advance: its kind as the label, the class it goes to (pre-filled when
// only one qualifies), the blue outline and prompt while none is chosen, a
// recorded class that no longer qualifies kept visible with its rules
// warning, and this advance's own save feedback.
function CastingAdvanceField({
  entryId,
  choice,
  classes,
  warningController,
  helpId,
}: {
  entryId: Id<'characterSheetEntry'>;
  choice: CastingAdvanceChoice;
  classes: Classes;
  warningController: Controller['warnings'];
  helpId: string;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const promptId = useId();
  const status = classes.advanceStatusFor(entryId, choice.index);
  const prompts = choice.warnings.filter(
    (warning) => warning.kind === 'incomplete',
  );
  const rules = choice.warnings.filter(
    (warning) => warning.kind !== 'incomplete',
  );
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span aria-hidden className={cn(fieldLabel, 'w-28 shrink-0')}>
          {choice.label}
        </span>
        <ChoiceSelect
          label={choice.label}
          value={choice.value ?? ''}
          options={choice.options.map((option) => ({
            value: option.classEntryId,
            label: option.eligible
              ? option.name
              : `${option.name} — doesn't qualify`,
          }))}
          emptyLabel={choice.value === null ? 'Choose a class' : 'Not assigned'}
          isMissing={choice.missing}
          disabled={status.kind === 'saving' || maintenance.readOnly}
          describedBy={[prompts.length > 0 ? promptId : null, helpId]
            .filter((id) => id !== null)
            .join(' ')}
          className="w-56 max-w-full"
          onValueChange={(value) =>
            void classes.assignAdvance(
              entryId,
              choice.index,
              // Safe cast: every non-empty option value is a catalog entry id.
              value === '' ? null : (value as Id<'catalogEntry'>),
            )
          }
        />
        <SaveFeedback
          status={status}
          savedText="Casting advance saved."
          savingText="Saving…"
          shouldHideWhenIdle
        />
      </div>
      {prompts.length > 0 ? (
        <InlineWarnings
          warnings={prompts}
          controller={warningController}
          id={promptId}
        />
      ) : null}
      <InlineWarnings warnings={rules} controller={warningController} />
    </div>
  );
}

/**
 * A Prestige Class Level's Casting advances (#415): one select per "+1 level
 * of existing spellcasting class" the class gives at this level, each saved
 * as chosen. Nothing renders for a level without advances. Spans the row
 * under the level's other choices; on the phone the lines stack.
 */
export function CastingAdvancesCell({
  entryId,
  classes,
  warningController,
  className,
}: {
  entryId: Id<'characterSheetEntry'>;
  classes: Classes;
  warningController: Controller['warnings'];
  className?: string;
}) {
  const helpId = useId();
  const choices = classes.advancesFor(entryId);
  if (choices.length === 0) return null;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {choices.map((choice) => (
        <CastingAdvanceField
          key={choice.index}
          entryId={entryId}
          choice={choice}
          classes={classes}
          warningController={warningController}
          helpId={helpId}
        />
      ))}
      <p id={helpId} className="text-muted-foreground text-xs">
        {castingAdvanceHelp}
      </p>
    </div>
  );
}
