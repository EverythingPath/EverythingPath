import { eventTableFacts } from './event-tree-facts';
import type { EventBlock, EventOccurrenceFacts, EventView } from './types';

type Item = Omit<EventOccurrenceFacts, 'label' | 'panel'> & {
  label?: string;
  panel?: EventOccurrenceFacts['panel'];
};
export type EventFactsInput = Omit<
  EventView,
  | 'occurrences'
  | 'chanceStep'
  | 'automatic'
  | 'rolled'
  | 'candidates'
  | 'inactive'
  | 'outcome'
  | 'preparation'
  | 'messages'
> & { occurrences: Item[] } & Partial<
    Pick<EventView, 'chanceStep' | 'preparation' | 'messages'>
  >;

// Component tests hand-build occurrence facts; this places each one in the
// section the real facts would (rolled roots, or its Activity candidate set)
// as a saved block, so a test states only what it exercises.
export function eventFacts(input: EventFactsInput): EventView {
  const occurrences = input.occurrences.map((item, index) => ({
    ...item,
    label: item.label ?? `Event ${index + 1}`,
    panel: item.panel ?? null,
  }));
  const block = (item: EventOccurrenceFacts): EventBlock => {
    const choice = item.owner?.choice;
    const candidate =
      choice &&
      (choice.actionId === 'guarantee_event' ||
        choice.actionId === 'manipulate_events')
        ? {
            slotId: item.owner!.slotId,
            choiceId: choice.choiceId,
            chosen: choice.selectedEventId === item.occurrence.eventId,
          }
        : null;
    const status = item.resolvedType ? 'happens' : 'awaiting_roll';
    return {
      eventId: item.occurrence.eventId,
      label: item.label,
      item,
      saved: true,
      status,
      statusLabel: status === 'happens' ? 'Happens' : 'Awaiting roll',
      statusText:
        status === 'happens' ? 'Happens this week' : 'Awaiting the table roll',
      origin: candidate ? 'Candidate' : 'Rolled',
      table: eventTableFacts(item.occurrence.tableRoll),
      rules: null,
      candidate,
      children: [],
      hidden: [],
      surplus: false,
      removal: null,
      issues: [],
    };
  };
  const owned = new Map<string, EventOccurrenceFacts[]>();
  for (const item of occurrences)
    if (item.owner)
      owned.set(item.owner.choice.choiceId, [
        ...(owned.get(item.owner.choice.choiceId) ?? []),
        item,
      ]);
  return {
    ...input,
    occurrences,
    chanceStep: input.chanceStep ?? {
      applies: 'roll',
      effect: 'Waiting for the chance roll',
      explanation: null,
      breakdown: [{ label: 'Notoriety', value: input.chance }],
      required: input.requirements.includes('event:chance:1d100'),
      raw: null,
      total: null,
      result: null,
      operating: null,
      sources: [],
      issues: [],
    },
    automatic: null,
    rolled: {
      applies: true,
      effect: 'Waiting for dice',
      reason: null,
      blocks: occurrences.filter((item) => !item.owner).map(block),
      issues: [],
    },
    candidates: [...owned].map(([choiceId, items]) => ({
      slotId: items[0]!.owner!.slotId,
      choiceId,
      label: 'Guarantee Event · Action Slot 1',
      active: true,
      selectedEventId: null,
      blocks: items.map(block),
      issues: [],
    })),
    inactive: [],
    outcome: { complete: false, lines: [] },
    preparation: input.preparation ?? 'idle',
    messages: input.messages ?? {},
  };
}
