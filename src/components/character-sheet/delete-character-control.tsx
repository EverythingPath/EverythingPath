'use client';
import { Trash2 } from 'lucide-react';
import { useRef, useState, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { MaintenanceReason } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { InlineDeleteQuestion } from './inline-delete-question';
import { action, SaveFeedback } from './sheet-parts';
import type { useCharacterLifecycle } from './use-character-lifecycle';

function DeleteTrigger({
  ref,
  onAsk,
}: {
  ref: RefObject<HTMLButtonElement | null>;
  onAsk: () => void;
}) {
  const maintenance = useInitialMigrationMaintenance();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Button
        ref={ref}
        type="button"
        size="sm"
        variant="outline"
        className={cn(action, 'text-muted-foreground hover:text-destructive')}
        disabled={maintenance.readOnly}
        onClick={() => {
          if (maintenance.readOnly) return;
          onAsk();
        }}
      >
        <Trash2 aria-hidden /> Delete character
      </Button>
      <MaintenanceReason notice={maintenance} />
    </div>
  );
}

// Deleting a private Character discards its whole sheet with no undo, so the
// control asks first, in place. Both answers wait while the deletion is
// pending; a refusal keeps the question open beside its reason.
export function DeleteCharacterControl({
  name,
  lifecycle,
}: {
  name: string;
  lifecycle: ReturnType<typeof useCharacterLifecycle>;
}) {
  const [isAsking, setIsAsking] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  // Keeps focus in the row when Keep is answered while the trigger is
  // disabled (maintenance began during the question).
  const row = useRef<HTMLDivElement>(null);
  const isBusy = lifecycle.status.kind === 'saving';
  return (
    <div ref={row} tabIndex={-1} className="outline-none">
      {isAsking ? (
        <InlineDeleteQuestion
          question={`Delete ${name}?`}
          subject={name}
          isBusy={isBusy}
          isKeepDisabled={isBusy}
          onDelete={() => void lifecycle.deleteCharacter()}
          onKeep={() => {
            flushSync(() => setIsAsking(false));
            const target = trigger.current;
            if (target && !target.disabled) target.focus();
            else row.current?.focus();
          }}
        >
          <SaveFeedback status={lifecycle.status} savedText="" />
        </InlineDeleteQuestion>
      ) : (
        <DeleteTrigger ref={trigger} onAsk={() => setIsAsking(true)} />
      )}
    </div>
  );
}
