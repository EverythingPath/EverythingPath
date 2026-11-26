'use client';
import { CircleAlert, RefreshCw, Wrench } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import type { MigrationNotice } from '~/lib/initial-migration-client';
import { cn } from '~/lib/utils';

const icons = {
  loading: null,
  ready: null,
  maintenance: Wrench,
  reload_required: RefreshCw,
  unavailable: CircleAlert,
} satisfies Record<MigrationNotice['kind'], typeof Wrench | null>;

// The app-wide editing notice, one per page and shared by every shell. Pages
// stay readable and navigation stays enabled; only saving is off. The live
// region is always mounted (empty while editing is available) so a later
// notice is announced. Reloading is always the player's own choice: the
// page may hold unsaved text they want to copy first.
export function MaintenanceBanner({ className }: { className?: string }) {
  const notice = useInitialMigrationMaintenance();
  const Icon = icons[notice.kind];
  const canReload =
    notice.kind === 'reload_required' || notice.kind === 'unavailable';
  return (
    <div role="status" aria-live="polite" className={className}>
      {notice.kind === 'ready' ? null : (
        <div
          data-maintenance-notice={notice.kind}
          className={cn(
            'flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 text-sm',
            notice.kind === 'loading'
              ? 'text-muted-foreground py-1'
              : 'border-b border-amber-500/50 bg-amber-500/15',
          )}
        >
          {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
          <span className="min-w-0 flex-1 basis-[14rem]">{notice.message}</span>
          {canReload ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11 md:min-h-8"
              onClick={() => window.location.reload()}
            >
              Reload page
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
