'use client';
import { InlineAction } from './event-steps';
import type { EventTargetCard } from './types';

// Market Day Twice: every operated town the discount reaches, read from
// Activity rather than chosen here.
export function MarketDayTowns({
  towns,
  subject,
  openActivitySlot,
}: {
  towns: EventTargetCard[];
  subject: string;
  openActivitySlot?: (slotId: string | null) => void;
}) {
  return (
    <div
      role="group"
      aria-label={`Towns with the Market Day · ${subject}`}
      className="min-w-0 space-y-1"
    >
      <p className="text-sm font-semibold">Towns with the Market Day</p>
      {towns.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {towns.map((town) => (
            <li
              key={town.value}
              className="flex min-w-0 flex-wrap gap-x-2 [overflow-wrap:anywhere]"
            >
              <span className="min-w-0">{town.label}</span>
              {town.description && (
                <span className="text-muted-foreground min-w-0">
                  {town.description}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground flex min-w-0 flex-wrap gap-x-2 text-sm [overflow-wrap:anywhere]">
          <span className="min-w-0">No town counts as operated this week.</span>
          {openActivitySlot && (
            <InlineAction
              onClick={() => openActivitySlot(null)}
              ariaLabel={`Open Activity for ${subject}`}
            >
              Open Activity
            </InlineAction>
          )}
        </p>
      )}
    </div>
  );
}
