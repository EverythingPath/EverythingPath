'use client';
import { MaintenanceReason } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { AdjustmentNameField, ModifierListFields } from './adjustment-fields';
import { action, RemoteNotice, SaveFeedback } from './sheet-parts';
import type { usePersonalAdjustmentForm } from './use-personal-adjustment-form';

/** The shared form names an "adjustment"; a definition's field is Name. */
export function formatDefinitionNameError(message: string) {
  return message === 'Adjustment name is required'
    ? 'Name is required'
    : message;
}

/**
 * Name, Modifiers and the save row shared by the definition forms. An
 * existing definition's form announces another player's change to it; the
 * Catalog block announces changes to the catalog as a whole.
 */
export function CatalogDefinitionFormFields({
  editor,
  isDisabled,
  submitLabel,
  remoteNotice,
  shouldFocusName,
  onClose,
}: {
  editor: ReturnType<typeof usePersonalAdjustmentForm>;
  isDisabled: boolean;
  submitLabel: string;
  remoteNotice?: { message: string; subject: string };
  shouldFocusName?: boolean;
  onClose: () => void;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const isSaving = editor.status.kind === 'saving';
  return (
    <>
      <AdjustmentNameField
        control={editor.form.control}
        isDisabled={isDisabled}
        formatError={formatDefinitionNameError}
        shouldAutoFocus={shouldFocusName}
      />
      <ModifierListFields
        editor={editor}
        isDisabled={isDisabled}
        areModifiersOptional
      />
      {remoteNotice ? (
        <RemoteNotice
          isShown={editor.hasRemoteChange}
          message={remoteNotice.message}
          subject={remoteNotice.subject}
          onDismiss={editor.dismissRemoteChange}
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button
          type="submit"
          size="sm"
          className={action}
          disabled={isSaving || isDisabled}
        >
          {isSaving ? 'Saving…' : submitLabel}
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
    </>
  );
}
