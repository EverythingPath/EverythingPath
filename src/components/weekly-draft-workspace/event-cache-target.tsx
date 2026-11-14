'use client';
import { EventCheckRow } from './event-check-row';
import type { EventEditResult, EventEdits } from './event-family-inputs';
import { EventMitigationChoice } from './event-mitigation-choice';
import { EventNote } from './event-note';
import { OverseerSupportControl } from './overseer-support-control';
import type { EventCacheTarget as EventCacheTargetFacts } from './types';

// One cache Cache Discovered finds: its own Attempt it / Let it happen and
// Secrecy check, like a Raid's hidden person. `subject` is the block label,
// which names the group and its controls for assistive technology.
export function EventCacheTarget({
  cache,
  id,
  subject,
  disabled,
  edits,
  showRefusal,
}: {
  cache: EventCacheTargetFacts;
  id: string;
  subject: string;
  disabled: boolean;
  edits: EventEdits;
  showRefusal: (result: EventEditResult) => void;
}) {
  const target = { kind: 'cache' as const, cacheId: cache.cacheId };
  const patch = (change: Parameters<EventEdits['setTargetCheck']>[2]) =>
    showRefusal(edits.setTargetCheck(id, target, change));
  const label = `${cache.name} · ${subject}`;
  const attempted = cache.mitigation === 'attempted';
  return (
    <section
      role="group"
      aria-label={label}
      className="min-w-0 space-y-3 rounded-md border p-3"
    >
      <div className="min-w-0 space-y-0.5">
        <h5 className="min-w-0 font-semibold [overflow-wrap:anywhere]">
          {cache.name}
        </h5>
        <p className="text-muted-foreground min-w-0 text-sm [overflow-wrap:anywhere]">
          {cache.description}
        </p>
      </div>
      {cache.missingItems.length > 0 && (
        <p role="note" className="text-sm text-amber-300">
          This cache holds an item no longer recorded. Restore it in Militia
          corrections.
        </p>
      )}
      <EventMitigationChoice
        subject={label}
        value={cache.mitigation}
        explicit={cache.explicit}
        attemptDescription={`Secrecy DC ${cache.check.dc} to retrieve the cache.`}
        letDescription="No check; the cache and its contents are lost."
        disabled={disabled}
        onChange={(mitigation) => patch({ mitigation })}
      />
      {attempted ? (
        <EventCheckRow
          facts={cache.check}
          recorded={cache.checkRoll}
          disabled={disabled}
          onRoll={(check) => patch({ check })}
          // The shared toggle owns a selection recorded on this cache too.
          support={
            <OverseerSupportControl
              eventId={id}
              check="secrecy"
              subject={`${subject} ${cache.check.label}`}
              breakdown={cache.check.breakdown}
            />
          }
        />
      ) : (
        <>
          {cache.checkRoll && (
            <EventNote
              advisory={false}
              action="Clear unused check roll"
              actionLabel={`Clear unused check roll for ${label}`}
              disabled={disabled}
              onAction={() => patch({ check: null })}
            >
              A Secrecy check roll stays on record, unused.
            </EventNote>
          )}
        </>
      )}
    </section>
  );
}
