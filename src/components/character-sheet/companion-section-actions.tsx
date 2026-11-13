'use client';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import type {
  CompanionOpenerProps,
  CompanionsController,
} from './companion-props';
import { action } from './sheet-parts';

/** The section's own editors: link an existing sheet or create a new one. */
export function CompanionSectionActions({
  controller,
  rememberOpener,
}: CompanionOpenerProps & { controller: CompanionsController }) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={action}
        aria-pressed={controller.editor?.kind === 'link'}
        aria-describedby={reasonId}
        disabled={controller.isDisabled}
        onClick={(event) => {
          rememberOpener(event.currentTarget);
          controller.openLink();
        }}
      >
        Link existing Character
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={action}
        aria-pressed={controller.editor?.kind === 'create'}
        aria-describedby={reasonId}
        disabled={controller.isDisabled}
        onClick={(event) => {
          rememberOpener(event.currentTarget);
          controller.openCreate();
        }}
      >
        Create Companion
      </Button>
    </div>
  );
}
