'use client';
import { createContext, useContext, type ReactNode } from 'react';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { cn } from '~/lib/utils';

// A section that states the reason once, by this element id. Reasons
// rendered inside it stay quiet; its disabled actions point at it instead.
const SharedReasonContext = createContext<string | null>(null);

/**
 * Lets one `MaintenanceReason` with this `id` speak for every save control
 * in the subtree: the others render nothing, and `useMaintenanceReasonId`
 * gives each disabled action the id to be described by.
 */
export function MaintenanceReasonScope({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  return (
    <SharedReasonContext.Provider value={id}>
      {children}
    </SharedReasonContext.Provider>
  );
}

/** The id of the reason that describes a disabled action here, if any. */
export function useMaintenanceReasonId(notice: MigrationMaintenance) {
  const sharedId = useContext(SharedReasonContext);
  if (!notice.readOnly) return undefined;
  return sharedId ?? undefined;
}

// Why the save control beside it is disabled, in the notice's own words.
// Plain text: the shell's banner is the one live region that announces it.
export function MaintenanceReason({
  notice,
  id,
  className,
}: {
  notice: MigrationMaintenance;
  id?: string;
  className?: string;
}) {
  const sharedId = useContext(SharedReasonContext);
  if (!notice.readOnly) return null;
  if (sharedId !== null && sharedId !== id) return null;
  return (
    <p
      id={id}
      data-maintenance-reason
      className={cn('text-muted-foreground w-full text-sm', className)}
    >
      {notice.message}
    </p>
  );
}
