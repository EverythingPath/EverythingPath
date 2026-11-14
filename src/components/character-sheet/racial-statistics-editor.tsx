'use client';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { Form } from '~/components/ui/form';
import type { RaceStatisticsView } from './character-sheet-races-view-model';
import { InlineWarnings } from './inline-warning';
import { RacialHitDiceFacts } from './racial-hit-dice-facts';
import { RacialProgressionFields } from './racial-progression-fields';
import { RacialSkillRankRows } from './racial-skill-rank-rows';
import { RacialStatisticsTextField } from './racial-statistics-text-field';
import { action, fieldLabel, RemoteNotice, SaveFeedback } from './sheet-parts';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';
import { useRacialStatisticsForm } from './use-racial-statistics-form';

type Controller = ReturnType<typeof useCharacterSheet>;

/**
 * The selected race's Hit Dice of its own (#312), shown for every race so a
 * race without any can be given some: how many, how they advance, the hit
 * points they gave as one plain number that starts unknown and is never
 * filled in, and the skill ranks they bought. Character level, actual Hit
 * Dice and the feat budget read separately above. Everything saves together
 * with its own button; the warnings sit beside what they are about and the
 * rules ones keep their Accept.
 */
export function RacialStatisticsEditor({
  statistics,
  warnings,
  warningController,
  actions,
}: {
  statistics: RaceStatisticsView;
  warnings: SheetWarningView[];
  warningController: Controller['warnings'];
  actions: Controller['races'];
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const editor = useRacialStatisticsForm(statistics, (input) =>
    actions.editStatistics(statistics.entryId, input),
  );
  // The race's own write knows why a save was refused; the form only that
  // it was.
  const writeStatus = actions.statusFor(statistics.entryId);
  const status = writeStatus.kind === 'error' ? writeStatus : editor.status;
  const isSaving =
    editor.status.kind === 'saving' || writeStatus.kind === 'saving';
  const isReadOnly = maintenance.readOnly;
  const progressionWarnings = warnings.filter(
    (warning) => warning.check === 'racialProgressionMissing',
  );
  const otherWarnings = warnings.filter(
    (warning) => warning.check !== 'racialProgressionMissing',
  );
  const isHpMissing =
    statistics.racialHitDice > 0 && statistics.racialHpGained === null;

  return (
    <Form {...editor.form}>
      <form
        noValidate
        aria-label="Racial Hit Dice"
        className="border-foreground/10 flex flex-col gap-3 border-y py-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (isSaving || isReadOnly) return;
          void editor.save();
        }}
      >
        <div className="flex flex-col gap-1">
          <p className={fieldLabel}>Racial Hit Dice</p>
          <RacialHitDiceFacts statistics={statistics} />
          <RemoteNotice
            isShown={editor.hasRemoteChange}
            message={
              editor.form.formState.isDirty
                ? 'Updated by another player. Your edits are kept.'
                : 'Updated by another player.'
            }
            subject="racial Hit Dice"
            onDismiss={editor.dismissRemoteChange}
          />
        </div>
        <div className="grid grid-cols-2 items-start gap-x-3 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
          <RacialStatisticsTextField
            form={editor.form}
            name="racialHitDice"
            label="Racial Hit Dice"
            isNumeric
            disabled={isReadOnly}
          />
          <RacialStatisticsTextField
            form={editor.form}
            name="racialHpGained"
            label="Racial hit points"
            placeholder="Enter racial hit points"
            isNumeric
            disabled={isReadOnly}
            note={
              isHpMissing ? (
                <p className="text-muted-foreground text-xs">
                  Not recorded yet, so HP is not complete.
                </p>
              ) : null
            }
          />
        </div>
        <RacialProgressionFields
          editor={editor}
          creatureTypeOptions={statistics.creatureTypeOptions}
          warnings={progressionWarnings}
          warningController={warningController}
          disabled={isReadOnly}
          reasonId={reasonId}
        />
        <RacialSkillRankRows editor={editor} disabled={isReadOnly} />
        <InlineWarnings
          warnings={otherWarnings}
          controller={warningController}
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button
            type="submit"
            size="sm"
            variant="outline"
            className={action}
            aria-describedby={reasonId}
            disabled={isSaving || isReadOnly}
          >
            {isSaving ? 'Saving…' : 'Save racial Hit Dice'}
          </Button>
          <SaveFeedback status={status} savedText="Racial Hit Dice saved." />
        </div>
      </form>
    </Form>
  );
}
