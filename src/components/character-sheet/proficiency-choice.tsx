'use client';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { cn } from '~/lib/utils';
import { RemoteNotice, SaveFeedback } from './sheet-parts';
import type { useCharacterSheet } from './use-character-sheet';
import { useProficiencyChoiceForm } from './use-character-sheet-skills';

type ChoiceRow = ReturnType<
  typeof useCharacterSheet
>['proficiencies']['choices'][number];

/**
 * The weapon a source lets the Character choose a Proficiency in, typed and
 * saved when the field is left or on Enter; a blank clears it. An empty
 * choice grants nothing yet and is never a warning. The choice stays with
 * its source: a Class Level, a Selection or a Grant.
 */
export function ProficiencyChoice({
  row,
  save,
  className,
}: {
  row: ChoiceRow;
  save: (choice: string | null) => Promise<unknown>;
  className?: string;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const editor = useProficiencyChoiceForm({ choice: row.choice, save });
  const isDirty = editor.form.formState.isDirty;
  const isSaving = editor.status.kind === 'saving';
  const canSave = isDirty && !maintenance.readOnly;
  return (
    <Form {...editor.form}>
      <div
        className={cn('flex flex-wrap items-start gap-x-3 gap-y-1', className)}
      >
        <FormField
          control={editor.form.control}
          name="value"
          render={({ field }) => (
            <FormItem className="min-w-0 gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <FormLabel className="font-mono text-sm font-normal [overflow-wrap:anywhere]">
                  Weapon proficiency choice for {row.name}
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    disabled={maintenance.readOnly}
                    type="text"
                    autoComplete="off"
                    className="h-11 w-44 font-mono text-sm md:h-8"
                    onBlur={() => {
                      field.onBlur();
                      if (canSave) void editor.save();
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return;
                      event.preventDefault();
                      if (canSave) void editor.save();
                    }}
                  />
                </FormControl>
                {isDirty || isSaving ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-11 md:min-h-8"
                    aria-describedby={reasonId}
                    disabled={isSaving || maintenance.readOnly}
                    onClick={() => {
                      if (!maintenance.readOnly) void editor.save();
                    }}
                  >
                    {isSaving ? 'Saving…' : 'Save'}{' '}
                    <span className="sr-only">choice for {row.name}</span>
                  </Button>
                ) : null}
              </div>
              {field.value.trim() === '' ? (
                <FormDescription className="text-xs">
                  Not chosen yet. Type a weapon, such as longsword.
                </FormDescription>
              ) : null}
            </FormItem>
          )}
        />
        <SaveFeedback
          status={editor.status}
          savedText="Saved"
          shouldHideWhenIdle
        />
        <RemoteNotice
          isShown={editor.hasRemoteChange}
          message={
            isDirty
              ? 'Changed by another player. Your edits are kept.'
              : 'Changed by another player.'
          }
          subject={`${row.name} choice`}
          onDismiss={editor.dismissRemoteChange}
        />
      </div>
    </Form>
  );
}
