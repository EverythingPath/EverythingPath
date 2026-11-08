'use client';
import { useId } from 'react';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { cn } from '~/lib/utils';
import type { GrantEntryView } from './character-sheet-grants-view-model';
import { InlineWarnings } from './inline-warning';
import { fieldLabel, missingChoice, SaveFeedback } from './sheet-parts';
import type { SpellcastingSchoolView } from './spellcasting-features-view-model';
import type { useCharacterSheet } from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;
type ChoiceWrites = Controller['spellcastingChoices'];
export type OppositionWrites = Pick<
  ChoiceWrites,
  'setOppositionSchools' | 'statusFor'
>;

const toggle =
  'border-foreground/40 hover:bg-foreground/10 aria-pressed:border-primary aria-pressed:bg-primary/15 aria-pressed:text-primary inline-flex min-h-11 items-center border px-2.5 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50 md:min-h-8 md:text-xs';

/**
 * A specialist's opposition schools (CRB p. 77): the seven other schools as
 * toggles, the whole list saved on every toggle. The group wears the blue
 * outline until two are chosen; the prompt beneath cannot be accepted away,
 * while a third school or the specialist's own school is a rules warning
 * with Accept. Lives on the Arcane School class feature row; the Spells
 * page's School row only reads the result.
 */
export function OppositionSchoolsEditor({
  school,
  classEntryId,
  writes,
  warningController,
  className,
}: {
  school: SpellcastingSchoolView;
  classEntryId: string;
  /** Null in an isolated read: the toggles then only show the record. */
  writes: OppositionWrites | null;
  warningController: Controller['warnings'];
  className?: string;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const labelId = useId();
  const status = writes?.statusFor(`${classEntryId}:oppositionSchools`) ?? {
    kind: 'idle' as const,
  };
  const isDisabled =
    writes === null || status.kind === 'saving' || maintenance.readOnly;
  const chosen = school.options
    .filter((option) => option.selected)
    .map((option) => option.value);
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span id={labelId} className={fieldLabel}>
        Opposition schools for {school.name}
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={reasonId}
        className={cn(
          'flex flex-wrap gap-1 self-start p-0.5',
          school.missing && missingChoice,
        )}
      >
        {school.options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.selected}
            disabled={isDisabled}
            className={toggle}
            onClick={() => {
              if (isDisabled) return;
              const next = option.selected
                ? chosen.filter((value) => value !== option.value)
                : [...chosen, option.value];
              void writes.setOppositionSchools(classEntryId, next);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
      <InlineWarnings
        warnings={school.warnings}
        controller={warningController}
      />
      <SaveFeedback
        status={status}
        savedText="Opposition schools saved."
        savingText="Saving…"
        shouldHideWhenIdle
      />
    </div>
  );
}

/**
 * The editor on the sheet's Class features: under the Arcane School class
 * feature row whose Spellcasting names it as the specialist school.
 */
export function SheetOppositionSchools({
  row,
  choices,
  warningController,
}: {
  row: GrantEntryView;
  choices: ChoiceWrites;
  warningController: Controller['warnings'];
}) {
  const found = choices.schools.find(
    (candidate) => candidate.school.entryId === row.rowId,
  );
  if (!found) return null;
  return (
    <OppositionSchoolsEditor
      school={found.school}
      classEntryId={found.classEntryId}
      writes={choices}
      warningController={warningController}
      className="mt-1"
    />
  );
}
