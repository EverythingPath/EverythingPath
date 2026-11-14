'use client';
import { useId } from 'react';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { Form } from '~/components/ui/form';
import { cn } from '~/lib/utils';
import { NaturalAttackDefinitionFields } from './natural-attack-definition-fields';
import { action, fieldLabel, RemoteNotice, SaveFeedback } from './sheet-parts';
import type { SheetEntryInput } from './use-character-sheet-entries';
import { useNaturalAttackForm } from './use-natural-attack-form';

/**
 * A natural attack's definition: its type as cards (picking one fills in
 * the printed name, damage and classification), then the name, Medium
 * damage and primary or secondary, each the player's to change. Unlike the
 * routine editor it saves on one button, and closes only once the save is
 * acknowledged; a failed save keeps every field for another try. Not a
 * <form>: it opens inside the routine editor's form as well as in Attacks
 * and, prefilled from an evolution, under the eidolon's natural attacks.
 */
export function NaturalAttackEditor({
  id,
  value,
  prefill,
  save,
  onClose,
}: {
  id?: string;
  /** A recorded natural attack to edit; absent, the editor adds one. */
  value?: SheetEntryInput;
  /** What a new natural attack starts as, when adding one. */
  prefill?: SheetEntryInput;
  save: (input: SheetEntryInput) => Promise<unknown>;
  onClose: () => void;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const headingId = useId();
  const typeLabelId = useId();
  const roleLabelId = useId();
  const editor = useNaturalAttackForm({ value: value ?? prefill, save });
  const { form } = editor;
  const isReadOnly = maintenance.readOnly;
  const isSaving = editor.status.kind === 'saving';
  const title = value ? 'Edit natural attack' : 'Add natural attack';
  const submit = value ? 'Save natural attack' : 'Add natural attack';

  async function submitDefinition() {
    if (isReadOnly) return;
    if ((await editor.save()) === 'saved') onClose();
  }

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="border-foreground/20 mt-2 min-w-0 space-y-3 border p-2"
    >
      <h3 id={headingId} className={fieldLabel}>
        {title}
      </h3>
      <Form {...form}>
        <RemoteNotice
          isShown={editor.hasRemoteChange}
          message={
            form.formState.isDirty
              ? 'Changed by another player. Your edits are kept.'
              : 'Changed by another player.'
          }
          subject="natural attack"
          onDismiss={editor.dismissRemoteChange}
        />
        <NaturalAttackDefinitionFields
          editor={editor}
          headingId={headingId}
          typeLabelId={typeLabelId}
          roleLabelId={roleLabelId}
          reasonId={reasonId}
          isReadOnly={isReadOnly}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className={cn(action, 'rounded-none font-sans')}
            aria-describedby={reasonId}
            disabled={isSaving || isReadOnly}
            onClick={() => void submitDefinition()}
          >
            {submit}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={cn(action, 'rounded-none')}
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
        <SaveFeedback
          status={editor.status}
          savedText="Natural attack saved."
          savingText={
            value ? 'Saving natural attack…' : 'Adding natural attack…'
          }
          shouldHideWhenIdle
        />
      </Form>
    </section>
  );
}
