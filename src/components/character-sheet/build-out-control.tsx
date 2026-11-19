'use client';
import { Hammer } from 'lucide-react';
import { MaintenanceReason } from '~/components/campaign-shell/maintenance-reason';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { action, SaveFeedback } from './sheet-parts';
import type { useBuildOutCharacter } from './use-build-out-character';

type BuildOut = Omit<ReturnType<typeof useBuildOutCharacter>, 'run'> & {
  run: () => Promise<unknown>;
};

/**
 * The one-way Build out of a minimal Character, with its outcome beside it.
 * The caller decides when it is offered and what follows an accepted
 * change; the control only disappears with the live full response.
 */
export function BuildOutControl({
  buildOut,
  isMine = true,
  name,
  className,
}: {
  buildOut: BuildOut;
  /** Whether the shared outcome belongs to this control's Character. */
  isMine?: boolean;
  /** Names the Character after the label where rows share one page. */
  name?: string;
  className?: string;
}) {
  const isSaving = buildOut.status.kind === 'saving';
  const isDisabled = isSaving || buildOut.maintenance.readOnly;
  const label = isMine && isSaving ? 'Building out…' : 'Build out';
  return (
    <div
      className={cn('flex flex-wrap items-center gap-x-3 gap-y-1', className)}
    >
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={action}
        aria-label={name ? `${label} ${name}` : undefined}
        disabled={isDisabled}
        onClick={() => {
          if (isDisabled) return;
          void buildOut.run();
        }}
      >
        <Hammer aria-hidden />
        {label}
      </Button>
      {isMine ? (
        <SaveFeedback
          status={buildOut.status}
          savedText="Character built out."
        />
      ) : null}
      <MaintenanceReason notice={buildOut.maintenance} className="text-xs" />
    </div>
  );
}
