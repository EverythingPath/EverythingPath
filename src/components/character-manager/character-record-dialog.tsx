'use client';
import type { Id } from '@convex/_generated/dataModel';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { CharacterRecordDialogView } from './character-record-dialog-view';
import { defaultCharacterFormValues, type CharacterRecord } from './types';
import { useCharacterRecord } from './use-character-record';

// The one Add/Edit character dialog, shared by Characters & officers and
// guided Setup. Without `record` it adds a record; an accepted add clears
// the values, so an owner that keeps it mounted (Setup) keeps them across a
// refused save or closing and reopening. With `record` it edits that record
// and offers Archive or Un-archive, which keep unsaved edits.
export function CharacterRecordDialog({
  campaignId,
  organizationId,
  record,
  open,
  onOpenChange,
  archiveWarning = null,
}: {
  campaignId: Id<'campaign'>;
  organizationId: string;
  record?: CharacterRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "Archiving keeps Dalla Rook as Commandant.", shown by Archive. */
  archiveWarning?: string | null;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const recordForm = useCharacterRecord({
    campaignId,
    organizationId,
    record,
    onSaved: () => {
      if (!record) recordForm.form.reset(defaultCharacterFormValues);
      onOpenChange(false);
    },
  });
  return (
    <CharacterRecordDialogView
      open={open}
      onOpenChange={(next) => {
        if (recordForm.pending) return;
        if (!next) recordForm.clearError();
        onOpenChange(next);
      }}
      recordForm={recordForm}
      archiveWarning={archiveWarning}
      maintenance={maintenance}
    />
  );
}
