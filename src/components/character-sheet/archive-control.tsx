'use client';
import type { Doc } from '@convex/_generated/dataModel';
import { MaintenanceReason } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { action, SaveFeedback } from './sheet-parts';
import type { useCharacterLifecycle } from './use-character-lifecycle';

// Archiving is reversible, so it needs no question; the button names the
// state it leads to, and the saved note names the state reached.
export function ArchiveControl({
  character,
  lifecycle,
}: {
  character: Doc<'character'>;
  lifecycle: ReturnType<typeof useCharacterLifecycle>;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const isBusy = lifecycle.status.kind === 'saving';
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={action}
        disabled={isBusy || maintenance.readOnly}
        onClick={() => {
          if (maintenance.readOnly) return;
          void lifecycle.saveIsActive(!character.isActive);
        }}
      >
        {character.isActive ? 'Archive character' : 'Restore character'}
      </Button>
      <SaveFeedback
        status={lifecycle.status}
        savedText={
          character.isActive ? 'Character restored.' : 'Character archived.'
        }
      />
      <MaintenanceReason notice={maintenance} />
    </div>
  );
}
