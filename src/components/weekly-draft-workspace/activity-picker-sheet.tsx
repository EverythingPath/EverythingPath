'use client';
import { useId } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import { cn } from '~/lib/utils';
import type { PickerCard } from './activity-board';
import type { ActivityBoard } from './use-activity-board';

// The grouped action picker: a bottom sheet of playing cards for one slot.
// Groups guide (a ready team, no team needed, needs an exception); every card
// stays selectable. Tapping places; closing cancels without an edit.

function ActionCard({
  card,
  disabled,
  onPick,
}: {
  card: PickerCard;
  disabled: boolean;
  onPick: () => void;
}) {
  const id = useId();
  return (
    <button
      type="button"
      aria-labelledby={`${id}-name`}
      aria-describedby={card.note ? `${id}-note` : undefined}
      disabled={disabled}
      onClick={onPick}
      className={cn(
        'bg-card border-foreground/25 flex min-h-28 min-w-0 touch-manipulation flex-col gap-1 rounded-lg border-2 p-2.5 text-left shadow-sm transition-transform outline-none',
        'hover:border-primary/60 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] motion-safe:hover:-translate-y-1 motion-safe:focus-visible:-translate-y-1 motion-reduce:transform-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
      )}
    >
      <span
        id={`${id}-name`}
        className="min-w-0 leading-tight font-semibold [overflow-wrap:anywhere]"
      >
        {card.name}
      </span>
      {card.note && (
        <span
          id={`${id}-note`}
          className="text-muted-foreground mt-auto min-w-0 text-xs leading-snug [overflow-wrap:anywhere]"
        >
          {card.note}
        </span>
      )}
    </button>
  );
}

export function ActivityPickerSheet({
  board,
  disabled,
}: {
  board: ActivityBoard;
  disabled: boolean;
}) {
  const picker = board.picker;
  return (
    <Sheet
      open={picker !== null}
      onOpenChange={(open) => {
        if (!open) board.closePicker();
      }}
    >
      <SheetContent
        side="bottom"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          board.returnPickerFocus();
        }}
        className="max-h-[80dvh] gap-0 rounded-t-lg pb-[env(safe-area-inset-bottom)]"
      >
        {picker && (
          <>
            <SheetHeader className="pr-12">
              <SheetTitle>
                {picker.mode === 'stage'
                  ? `Choose an action for Action Slot ${picker.slot.number}`
                  : `Change the action in Action Slot ${picker.slot.number}`}
              </SheetTitle>
              <SheetDescription>
                Groups are guidance: every action stays available.
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 space-y-5 overflow-y-auto px-4 pt-1 pb-6">
              {picker.groups
                .filter((group) => group.cards.length > 0)
                .map((group) => (
                  <section
                    key={group.id}
                    aria-label={group.title}
                    className="space-y-2"
                  >
                    <h3 className="text-muted-foreground text-sm font-medium">
                      {group.title}
                    </h3>
                    <div className="grid grid-cols-2 gap-3 p-1 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                      {group.cards.map((card) => (
                        <ActionCard
                          key={card.actionId}
                          card={card}
                          disabled={disabled}
                          onPick={() => board.pick(card.actionId)}
                        />
                      ))}
                    </div>
                  </section>
                ))}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
