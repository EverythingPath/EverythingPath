'use client';
import type { Id } from '@convex/_generated/dataModel';
import { MaintenanceReason } from '~/components/campaign-shell/maintenance-reason';
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
import { saveAndReportWhenClean } from './catalog-definition-editor';
import { action, fieldLabel, RemoteNotice, SaveFeedback } from './sheet-parts';
import type { SheetEntryStateInput } from './use-character-sheet-entries';
import { useSpellEffectStateForm } from './use-sheet-entry-form';

/**
 * A shared Spell Effect's recorded caster level, edited in place while its
 * definition stays read-only. Only the caster level is sent; blank restores
 * the definition's default. Closes only after a clean save; a refusal keeps
 * the typed level for another try.
 */
export function SpellEffectStateEditor({
  entryId,
  name,
  casterLevel,
  defaultCasterLevel,
  editState,
  onClose,
}: {
  entryId: Id<'characterSheetEntry'>;
  name: string;
  casterLevel: number;
  defaultCasterLevel: number;
  editState: (
    entryId: Id<'characterSheetEntry'>,
    input: SheetEntryStateInput,
  ) => Promise<unknown>;
  onClose: () => void;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const editor = useSpellEffectStateForm({
    value: { casterLevel, defaultCasterLevel },
    save: (input) => editState(entryId, input),
  });
  const isSaving = editor.status.kind === 'saving';
  const isDisabled = maintenance.readOnly;
  return (
    <Form {...editor.form}>
      <form
        noValidate
        aria-label={`Caster level ${name}`}
        className="border-foreground/20 mt-2 space-y-2 border p-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (isDisabled) return;
          void saveAndReportWhenClean(editor).then(
            ({ outcome, hasNewerInput }) => {
              if (outcome === 'saved' && !hasNewerInput) onClose();
            },
          );
        }}
      >
        <FormField
          control={editor.form.control}
          name="casterLevel"
          render={({ field, fieldState }) => (
            <FormItem className="gap-1">
              <FormLabel className={fieldLabel}>Caster level</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  disabled={isDisabled}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder={String(defaultCasterLevel)}
                  className="h-11 w-24 text-center font-mono md:h-8"
                />
              </FormControl>
              <FormDescription className="max-w-64 text-xs">
                Blank restores the default caster level ({defaultCasterLevel}).
              </FormDescription>
              <FormMessage
                role={fieldState.error ? 'alert' : undefined}
                className="max-w-64"
              />
            </FormItem>
          )}
        />
        <RemoteNotice
          isShown={editor.hasRemoteChange}
          message="Another player changed this caster level. Your edits are kept."
          subject="caster level"
          onDismiss={editor.dismissRemoteChange}
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button
            type="submit"
            size="sm"
            className={action}
            disabled={isSaving || isDisabled}
          >
            {isSaving ? 'Saving…' : 'Save caster level'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={action}
            onClick={onClose}
          >
            Cancel
          </Button>
          <SaveFeedback
            status={editor.status}
            savedText="Saved"
            shouldHideWhenIdle
          />
          <MaintenanceReason notice={maintenance} />
        </div>
      </form>
    </Form>
  );
}
