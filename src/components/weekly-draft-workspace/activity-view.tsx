'use client';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import { cn } from '~/lib/utils';
import { ActivityPickerSheet } from './activity-picker-sheet';
import { ActivitySlotBoard } from './activity-slot-board';
import { ActivitySlotDetails } from './activity-slot-details';
import type { ActivityView as ActivityViewFacts } from './types';
import { useActivityBoard } from './use-activity-board';

// The Activity phase's main column: the allowance header and slot board, the
// selected slot's details under it, and the action picker sheet. The week
// frame around it owns phase navigation, saving and readiness.
export function ActivityView({
  view,
  edit,
  disabled,
  latest,
  correctionsHref,
  openEvent,
}: {
  view: ActivityViewFacts;
  edit: (edit: WeeklyDraftEdit) => Promise<'accepted' | 'failed'>;
  disabled: boolean;
  // Reads the Workspace's current Activity facts after an awaited edit.
  latest?: () => ActivityViewFacts | null;
  // Scoped link to the Militia corrections editor, for repairing missing
  // team or settlement references.
  correctionsHref?: string;
  // Shows the Event phase, where event candidates are rolled and chosen.
  openEvent?: () => void;
}) {
  const board = useActivityBoard({ view, edit, disabled, latest });
  const selected = board.selectedSlot;
  return (
    <section aria-label="Activity choices" className="min-w-0 space-y-4">
      <ActivitySlotBoard
        view={view}
        board={board}
        disabled={disabled}
        correctionsHref={correctionsHref}
      />
      <p
        role="status"
        className={cn(
          'text-muted-foreground text-sm',
          !board.pickerNotice && 'sr-only',
        )}
      >
        {board.pickerNotice ?? ''}
      </p>
      {selected ? (
        <ActivitySlotDetails
          key={selected.slotId}
          slot={selected}
          view={view}
          board={board}
          edit={edit}
          disabled={disabled}
          correctionsHref={correctionsHref}
          openEvent={openEvent}
        />
      ) : (
        <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
          Choose a slot to see its details, or an empty slot to choose an
          action.
        </p>
      )}
      <ActivityPickerSheet board={board} disabled={disabled} />
    </section>
  );
}
