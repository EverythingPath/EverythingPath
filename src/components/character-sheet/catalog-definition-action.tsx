'use client';
import { useId, type Ref } from 'react';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import type { SaveStatus } from './save-status';
import { action, SaveFeedback } from './sheet-parts';

/** One definition action with what it does beside it, and its own status. */
export function CatalogDefinitionAction({
  label,
  subject,
  description,
  isDisabled,
  isPressed,
  status,
  buttonRef,
  onClick,
}: {
  label: string;
  subject: string;
  description?: string;
  isDisabled: boolean;
  isPressed?: boolean;
  status?: SaveStatus;
  buttonRef?: Ref<HTMLButtonElement>;
  onClick: () => void;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const descriptionId = useId();
  const describedBy = [description ? descriptionId : null, reasonId]
    .filter(Boolean)
    .join(' ');
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Button
        ref={buttonRef}
        type="button"
        size="sm"
        variant={isPressed ? 'secondary' : 'outline'}
        className={action}
        aria-pressed={isPressed}
        aria-describedby={describedBy || undefined}
        disabled={isDisabled}
        onClick={onClick}
      >
        {label} <span className="sr-only">{subject}</span>
      </Button>
      {description ? (
        <p
          id={descriptionId}
          className="text-muted-foreground min-w-0 flex-1 basis-48 text-xs"
        >
          {description}
        </p>
      ) : null}
      {status ? (
        <SaveFeedback
          status={status}
          savedText="Saved"
          savingText="Saving…"
          shouldHideWhenIdle
        />
      ) : null}
    </li>
  );
}
