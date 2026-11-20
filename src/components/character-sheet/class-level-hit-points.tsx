'use client';
import {
  MaintenanceReason,
  useMaintenanceReasonId,
} from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { cn } from '~/lib/utils';
import { listFieldWarnings } from './class-level-warnings';
import { InlineWarnings } from './inline-warning';
import { RemoteNotice, SaveFeedback } from './sheet-parts';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';
import { useClassLevelForm } from './use-sheet-forms';

type Controller = ReturnType<typeof useCharacterSheet>;

/**
 * The hit points gained at one level: the plain number the player typed,
 * saved with its own button, with the class's hit die as the field's one
 * hint. No roll, average or fill; a new level starts empty. Under
 * maintenance, Save is described by the block's one reason.
 */
export function ClassLevelHitPoints({
  level,
  hpGained,
  hitDie,
  warnings,
  warningController,
  save,
  className,
}: {
  level: number;
  hpGained: number | null;
  hitDie: number | null;
  warnings: SheetWarningView[];
  warningController: Controller['warnings'];
  save: (hpGained: number | null) => Promise<void>;
  className?: string;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const editor = useClassLevelForm({ hpGained, save });
  const isSaving = editor.status.kind === 'saving';
  return (
    <Form {...editor.form}>
      <form
        noValidate
        aria-label={`Level ${level} hit points`}
        className={cn('flex flex-wrap items-start gap-x-3 gap-y-1', className)}
        onSubmit={(event) => {
          event.preventDefault();
          if (maintenance.readOnly) return;
          void editor.save();
        }}
      >
        <FormField
          control={editor.form.control}
          name="hpGained"
          render={({ field, fieldState }) => (
            <FormItem className="gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <FormLabel className="font-mono text-sm font-normal">
                  Hit points{' '}
                  <span className="sr-only">gained at level {level}</span>
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    disabled={maintenance.readOnly}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    className="h-10 w-20 text-center font-mono md:h-8"
                  />
                </FormControl>
                <FormDescription className="font-mono text-xs">
                  {hitDie ? `d${hitDie}` : null}
                </FormDescription>
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  className="min-h-10 md:min-h-8"
                  aria-describedby={reasonId}
                  disabled={isSaving || maintenance.readOnly}
                >
                  {isSaving ? 'Saving…' : 'Save hit points'}
                </Button>
              </div>
              <FormMessage
                role={fieldState.error ? 'alert' : undefined}
                className="max-w-sm"
              />
            </FormItem>
          )}
        />
        <SaveFeedback status={editor.status} savedText="Hit points saved." />
        <MaintenanceReason notice={maintenance} />
        <RemoteNotice
          isShown={editor.hasRemoteChange}
          message={
            editor.form.formState.isDirty
              ? 'Updated by another player. Your edits are kept.'
              : 'Updated by another player.'
          }
          subject={`level ${level} hit points`}
          onDismiss={editor.dismissRemoteChange}
        />
        <InlineWarnings
          warnings={listFieldWarnings(warnings, 'hpGained')}
          controller={warningController}
          className="w-full"
        />
      </form>
    </Form>
  );
}
