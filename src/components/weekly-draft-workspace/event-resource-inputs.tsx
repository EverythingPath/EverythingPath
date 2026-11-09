'use client';
import { EventActivityRecalculation } from './event-activity-recalculation';
import { EventCacheTarget } from './event-cache-target';
import type { EventFamilyInputsProps } from './event-family-inputs';
import { EventNote } from './event-note';
import { EventRetainedInputs } from './event-retained-inputs';
import { EventRewardList } from './event-reward-list';
import { MarketDayTowns } from './event-market-day-towns';

// Broke the Code, Cache Discovered, Festival, Market Day, Found Fire and
// Hidden Agenda: the identified item, the town, each cache found with its
// own Secrecy check, the rewards and the recalculated Activity checks. Each
// part renders only where its facts exist. `subject` is the block label,
// which names the controls for assistive technology.
export function EventResourceInputs({
  panel,
  id,
  disabled,
  edits,
  showRefusal,
  targetCards,
  subject,
  openActivitySlot,
}: EventFamilyInputsProps<'resource'> & {
  subject: string;
  // Opens Activity at a choice, or at its top for null: the operated towns
  // and the recalculated choices are edited there.
  openActivitySlot?: (slotId: string | null) => void;
}) {
  return (
    <>
      {panel.item && targetCards('item', panel.item, subject)}
      {panel.settlement && targetCards('settlement', panel.settlement, subject)}
      {panel.towns && (
        <MarketDayTowns
          towns={panel.towns}
          subject={subject}
          openActivitySlot={openActivitySlot}
        />
      )}
      {panel.cache && targetCards('cache', panel.cache, subject)}
      {panel.caches.map((cache) => (
        <EventCacheTarget
          key={cache.cacheId}
          cache={cache}
          id={id}
          subject={subject}
          disabled={disabled}
          edits={edits}
          showRefusal={showRefusal}
        />
      ))}
      {panel.retainedCacheChecks.map((entry) => (
        <EventNote
          key={entry.index}
          action="Remove"
          actionLabel={`Remove recorded check for ${entry.label} from ${subject}`}
          disabled={disabled}
          onAction={() => showRefusal(edits.removeTargetCheck(id, entry.index))}
        >
          {entry.label}: {entry.reason}
        </EventNote>
      ))}
      {panel.rewards && (
        <EventRewardList
          rewards={panel.rewards}
          id={id}
          subject={subject}
          disabled={disabled}
          edits={edits}
          showRefusal={showRefusal}
        />
      )}
      {panel.activity && (
        <EventActivityRecalculation
          activity={panel.activity}
          subject={subject}
          openActivitySlot={openActivitySlot}
        />
      )}
      <EventRetainedInputs
        retained={panel.retained}
        subject={subject}
        disabled={disabled}
        onClear={(field) =>
          showRefusal(edits.clearRetained(id, field, panel.keep))
        }
      />
    </>
  );
}
