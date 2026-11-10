'use client';
import { Check } from 'lucide-react';
import { Button } from '~/components/ui/button';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import { cn } from '~/lib/utils';
import { EventOccurrenceEditors } from './event-occurrence-editors';
import { EventSabotage } from './event-sabotage';
import {
  EventIssueNotes,
  isPreparationFailed,
  PERCENTILE,
  type EventPreparation,
} from './event-steps';
import { EventTableModifiers } from './event-table-modifiers';
import { EventRulesDisclosure } from './event-rules-disclosure';
import { RollTotalField } from './roll-total-field';
import { eventOccurrenceAnchor } from './source-anchors';
import type { EventBlock as EventBlockFacts, EventView } from './types';
import { signed } from './upkeep-parts';
import type { useEventEdits } from './use-event-edits';

// One position in the Event tree: its table roll, what the rules make of
// it, the occurrence's own editors, and the nested positions this roll
// produced. Every status is words on the chip; colour only echoes them.

const chipTone: Record<EventBlockFacts['status'], string> = {
  preparing: 'border-border text-muted-foreground',
  awaiting_roll: 'border-primary/60 text-primary',
  happens: 'border-emerald-500/60 text-emerald-500',
  twice: 'border-fuchsia-500/60 text-fuchsia-400',
  no_additional_effect: 'border-border text-muted-foreground',
  two_more: 'border-sky-500/60 text-sky-400',
  reroll: 'border-amber-500/60 text-amber-300',
  cannot_occur: 'border-amber-500/60 text-amber-300',
  kept: 'border-border text-muted-foreground',
  sabotaged: 'border-border text-muted-foreground',
  candidate: 'border-primary/60 text-primary',
  not_chosen: 'border-border text-muted-foreground',
  not_used: 'border-border text-muted-foreground',
  needs_repair: 'border-amber-500/60 text-amber-300',
};

export function EventBlock({
  block,
  view,
  edit,
  disabled,
  edits,
  preparation,
  openActivitySlot,
  depth = 0,
}: {
  block: EventBlockFacts;
  view: EventView;
  edit: (edit: WeeklyDraftEdit) => unknown;
  disabled: boolean;
  edits: ReturnType<typeof useEventEdits>;
  preparation?: EventPreparation;
  openActivitySlot?: (slotId: string | null) => void;
  depth?: number;
}) {
  const locked = disabled || !block.saved;
  const failed = isPreparationFailed(view, preparation);
  const table = block.table;
  const applied = table.modifiers.filter((modifier) => !modifier.ignored);
  const nested = {
    view,
    edit,
    disabled,
    edits,
    preparation,
    openActivitySlot,
    depth: depth + 1,
  };
  const sabotage = view.sabotage?.[block.eventId];
  return (
    <div
      role="group"
      id={eventOccurrenceAnchor(block.eventId)}
      tabIndex={-1}
      aria-label={block.label}
      className={cn(
        'bg-card min-w-0 space-y-3 rounded-md border p-3',
        (block.status === 'not_chosen' || block.status === 'not_used') &&
          'opacity-70',
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <h4 className="font-semibold">{block.label}</h4>
        <span
          className={cn(
            'ml-auto inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-xs font-medium [overflow-wrap:anywhere]',
            chipTone[block.status],
          )}
        >
          {block.statusLabel}
        </span>
        <p className="text-muted-foreground min-w-0 basis-full text-xs [overflow-wrap:anywhere]">
          {block.origin} · {block.statusText}
        </p>
      </div>
      {/* The die beside its arithmetic, like the Upkeep roll rows; stacked on a phone. */}
      <div className="grid min-w-0 items-start gap-x-6 gap-y-1 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <RollTotalField
          label={`${block.label} table roll`}
          spec={PERCENTILE}
          recorded={block.item.occurrence.tableRoll}
          required={block.status !== 'not_used'}
          disabled={locked}
          onRoll={(roll) => edits.setTableRoll(block.eventId, roll)}
        />
        {table.raw !== null && (
          <p className="min-w-0 text-sm [overflow-wrap:anywhere] sm:pt-7">
            <span className="font-mono">{table.raw}</span>
            {/* Applied entries hold one value per source. */}
            {applied.map((modifier) => (
              <span key={modifier.sourceId}>
                {' '}
                <span className="font-mono">{signed(modifier.value)}</span>{' '}
                <span className="text-muted-foreground">{modifier.reason}</span>
              </span>
            ))}
            {applied.length > 0 && table.total !== null && (
              <>
                {' '}
                = <strong className="font-mono">{table.total}</strong>
              </>
            )}
            {table.name && (
              <>
                {' '}
                <span aria-hidden>→</span>{' '}
                <strong className="font-semibold">{table.name}</strong>
              </>
            )}
          </p>
        )}
      </div>
      {!block.saved &&
        (failed ? (
          <div
            role="status"
            className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm"
          >
            <span>This event could not be prepared yet.</span>
            {preparation && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={preparation.retry}
              >
                Retry
              </Button>
            )}
          </div>
        ) : (
          <p role="status" className="text-muted-foreground text-sm">
            This event opens for its roll in a moment…
          </p>
        ))}
      {block.rules && <EventRulesDisclosure rules={block.rules} />}
      {block.candidate && (
        <Button
          type="button"
          variant="outline"
          aria-label={
            block.candidate.chosen ? 'This one happens' : 'Choose this event'
          }
          aria-pressed={block.candidate.chosen}
          disabled={locked}
          onClick={() => edits.chooseCandidate(block.eventId)}
          className="hover:border-primary/60 aria-pressed:border-primary aria-pressed:bg-primary/15 aria-pressed:hover:border-primary aria-pressed:hover:bg-primary/15 hover:bg-background hover:text-foreground flex h-auto min-h-14 w-full min-w-0 flex-col items-start justify-start gap-1 rounded-lg border-2 p-3 text-left whitespace-normal transition-transform hover:-translate-y-1 focus-visible:-translate-y-1 motion-reduce:transform-none"
        >
          <span className="flex w-full min-w-0 items-start justify-between gap-2">
            <span className="min-w-0 [overflow-wrap:anywhere]">
              {block.candidate.chosen
                ? 'This one happens'
                : 'Choose this event'}
            </span>
            {block.candidate.chosen && (
              <Check aria-hidden className="size-4 shrink-0" />
            )}
          </span>
          <span className="text-muted-foreground min-w-0 text-xs font-normal [overflow-wrap:anywhere]">
            {table.name ?? 'Awaiting roll'}
          </span>
        </Button>
      )}
      {/* A position still being readied asks for nothing yet. */}
      {block.saved && <EventIssueNotes issues={block.issues} />}
      {block.status !== 'preparing' && (
        <EventOccurrenceEditors
          block={block}
          view={view}
          edit={edit}
          disabled={locked}
          edits={edits}
          openActivitySlot={openActivitySlot}
        />
      )}
      {block.saved && sabotage && (
        <EventSabotage
          facts={sabotage}
          eventLabel={
            table.name ? `${block.label} · ${table.name}` : block.label
          }
          view={view}
          edit={edit}
          edits={edits}
          disabled={locked}
        />
      )}
      <EventTableModifiers block={block} disabled={locked} edits={edits} />
      {block.children.length > 0 && (
        <div className="border-foreground/20 ml-1 min-w-0 space-y-3 border-l-2 pl-2 sm:ml-3 sm:pl-3">
          {block.children.map((child) => (
            <EventBlock key={child.eventId} block={child} {...nested} />
          ))}
        </div>
      )}
      {block.hidden.length > 0 && (
        <details className="min-w-0">
          <summary className="cursor-pointer text-sm font-medium">
            {block.hidden.length} kept{' '}
            {block.hidden.length === 1 ? 'event' : 'events'} not used now
          </summary>
          <p className="text-muted-foreground mt-1 text-xs">
            They come back with their rolls if this roll needs them again.
          </p>
          <div className="border-foreground/20 mt-2 ml-1 min-w-0 space-y-3 border-l-2 pl-2 opacity-70 sm:ml-3 sm:pl-3">
            {block.hidden.map((child) => (
              <EventBlock key={child.eventId} block={child} {...nested} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
