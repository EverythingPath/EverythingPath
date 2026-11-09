import { militiaEventTable } from '~/lib/militia-event-table';
import { normalizeRawRoll } from '~/lib/raw-roll';
import { RULE_ROLL_SPECS } from '~/lib/rules-roll-spec';
import {
  type EventDispatch,
  eventTableArithmetic,
  eventTypeForTableRoll,
  type EventPositionGroup,
} from '~/lib/rules-event-selection';
import type { EventOutcomeProjection } from '~/lib/rules-event-outcomes';
import {
  isCandidateChoice,
  planEventTopology,
  uniquePositions,
  type EventTopologyPlan,
} from '~/lib/event-occurrence-preparation';
import { EVENT_RULES_TEXT } from '~/lib/event-rules-text';
import type { StagedActionChoice } from '~/lib/weekly-draft-facts';
import type { WeeklyDraft, WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import { activityLabel } from './activity-labels';
import type {
  EventBlock,
  EventBlockRules,
  EventBlockStatus,
  EventIssue,
  EventOccurrenceFacts,
  EventTraceFacts,
} from './types';

type Event = WeeklyDraft['event']['occurrences'][number];
export type EventOwner = { slotId: string; choice: StagedActionChoice } | null;
export type LocatedEvent = { event: Event; owner: EventOwner; tree: Event[] };
// Surplus positions and the edit that removes one once its roll is cleared.
export type Repair = {
  surplus: (eventId: string) => boolean;
  removal: (eventId: string) => WeeklyDraftEdit | null;
};

export function eventName(type: string | null | undefined) {
  if (!type) return null;
  return (
    militiaEventTable.find((entry) => entry.eventType === type)?.name ??
    activityLabel(type)
  );
}

// "Event 2A · Sickness", or "Event 2A" before its roll resolves.
export function eventSubjectLabel(
  event: Pick<EventOccurrenceFacts, 'label' | 'resolvedType'>,
) {
  const name = eventName(event.resolvedType);
  return name ? `${event.label} · ${name}` : event.label;
}

// Table roll arithmetic exactly as selection reads it: settlement reputation
// never applies here, and one value counts per modifier source.
// The shared engine arithmetic for a table roll, with its event's name.
export function eventTableFacts(roll: Event['tableRoll']): EventBlock['table'] {
  return {
    ...eventTableArithmetic(roll),
    name: eventName(eventTypeForTableRoll(roll)),
  };
}

const STATUS_LABELS: Record<EventBlockStatus, string> = {
  preparing: 'Preparing',
  awaiting_roll: 'Awaiting roll',
  happens: 'Happens',
  twice: 'Twice',
  no_additional_effect: 'No additional effect',
  two_more: 'Two more',
  reroll: 'Reroll',
  cannot_occur: 'Cannot occur',
  kept: 'Kept by ruling',
  sabotaged: 'Sabotaged',
  candidate: 'Candidate',
  not_chosen: 'Not chosen',
  not_used: 'Not used',
  needs_repair: 'Needs repair',
};
const STATUS_TEXT: Record<EventBlockStatus, string> = {
  preparing: 'Preparing this event',
  awaiting_roll: 'Awaiting the table roll',
  happens: 'Happens this week',
  twice: 'Happens again this week: its Twice effect applies',
  no_additional_effect: 'Already happened this week: no additional effect',
  two_more: 'Roll two more events and resolve both',
  reroll: 'Roll Twice again: reroll and enter the new die',
  cannot_occur: 'Cannot occur now: roll its replacement below',
  kept: 'Cannot normally occur; kept with a Rules Exception',
  sabotaged: 'Sabotaged: this event does not happen',
  candidate: 'A candidate: choose this event or the other one',
  not_chosen: 'Not chosen: its record is kept',
  not_used: 'Kept on record; not used this week',
  needs_repair:
    'More events are recorded here than the rules ask for; clear the extra one',
};
// The corpus rules for the event a complete table roll names. Its Twice
// clause is included only when that clause is what applies to this block (a
// second occurrence dispatched as Twice or with no additional effect).
function eventRules(
  roll: Event['tableRoll'],
  mode: EventDispatch['mode'] | null,
): EventBlockRules | null {
  const type = eventTypeForTableRoll(roll);
  if (!type) return null;
  const rules = EVENT_RULES_TEXT[type];
  const plain = (line: string) => line.replaceAll('`', '');
  return {
    name: eventName(type) ?? activityLabel(type),
    text: rules.text.map(plain),
    twice:
      rules.twice && (mode === 'twice' || mode === 'no_additional_effect')
        ? plain(rules.twice)
        : null,
  };
}

// Display labels, never identities. Top-level events are numbered in
// resolution order, active ones first and then the ones not taking part this
// week, so a label only moves when the rules change which events take part.
// A candidate set shares one number and letters its candidates (2A, 2B);
// nested events extend their parent's label (1.1, 2A.1, 1.1.1) by their
// position among all recorded siblings, so adding, hiding or restoring
// children never relabels another event.
function eventLabels({
  units,
  order,
  childrenOf,
}: {
  units: { roots: LocatedEvent[]; lettered: boolean; active: boolean }[];
  order: LocatedEvent[];
  childrenOf: (entry: LocatedEvent) => LocatedEvent[];
}) {
  const labels = new Map<string, string>();
  const assign = (entry: LocatedEvent, label: string) => {
    labels.set(entry.event.eventId, label);
    childrenOf(entry).forEach((child, index) =>
      assign(child, `${label}.${index + 1}`),
    );
  };
  let number = 0;
  for (const unit of [
    ...units.filter((entry) => entry.active),
    ...units.filter((entry) => !entry.active),
  ]) {
    if (unit.roots.length === 0) continue;
    number++;
    unit.roots.forEach((root, index) =>
      assign(
        root,
        `Event ${number}${unit.lettered ? String.fromCharCode(65 + index) : ''}`,
      ),
    );
  }
  for (const entry of order)
    if (!labels.has(entry.event.eventId)) assign(entry, `Event ${++number}`);
  return labels;
}

function childKind(group: EventPositionGroup) {
  return group.kind === 'roll_twice' || group.kind === 'replacement'
    ? group
    : null;
}

/**
 * The Event tree as numbered, nested blocks. Membership in a traced position
 * group decides whether an occurrence takes part this week; everything else
 * stays visible as recorded input rather than being dropped or rewritten.
 */
// Which recorded (and planned) occurrences take part this week, their
// resolution order and their display labels, from the engine's trace.
function eventTreeLayout(
  draft: WeeklyDraft,
  positions: readonly EventPositionGroup[],
  plan: EventTopologyPlan,
) {
  const located: LocatedEvent[] = [
    ...plan.trees.event.map((event) => ({
      event,
      owner: null,
      tree: plan.trees.event,
    })),
    ...plan.trees.candidates.flatMap(({ slotId, choiceId, events }) => {
      const choice = draft.activity.slots.find(
        (slot) => slot.slotId === slotId,
      )?.choice;
      return choice?.choiceId === choiceId && choice
        ? events.map((event) => ({
            event,
            owner: { slotId, choice },
            tree: events,
          }))
        : [];
    }),
  ];
  const byId = new Map(located.map((entry) => [entry.event.eventId, entry]));
  const childrenOf = (entry: LocatedEvent) =>
    entry.tree.filter(
      (event) =>
        'parentEventId' in event.origin &&
        event.origin.parentEventId === entry.event.eventId,
    );
  // Members of each traced group, including planned blank positions.
  const members = (group: EventPositionGroup) => {
    switch (group.kind) {
      case 'rolled':
        return plan.trees.event.filter(
          (event) => event.origin.kind === 'rolled',
        );
      case 'automatic':
        return plan.trees.event.filter(
          (event) =>
            event.origin.kind === 'automatic' &&
            event.origin.sourceId === group.sourceId,
        );
      case 'candidates':
        return (
          plan.trees.candidates.find((tree) => tree.choiceId === group.choiceId)
            ?.events ?? []
        ).filter((event) => event.origin.kind === 'rolled');
      case 'roll_twice':
      case 'replacement': {
        const parent = byId.get(group.parentEventId);
        return parent
          ? childrenOf(parent).filter(
              (event) => event.origin.kind === group.kind,
            )
          : [];
      }
    }
  };
  const active = new Set<string>();
  const overfull = new Set<string>();
  const groupOfParent = new Map<string, EventPositionGroup>();
  for (const group of positions) {
    const ids = members(group).map((event) => event.eventId);
    for (const id of ids) active.add(id);
    if (group.eventIds.length > group.count)
      for (const id of ids) overfull.add(id);
    const child = childKind(group);
    if (child) groupOfParent.set(child.parentEventId, group);
  }
  const activeCandidateSets = new Set(
    positions.flatMap((group) =>
      group.kind === 'candidates' ? [group.choiceId] : [],
    ),
  );

  // Occurrences in resolution order: automatic, rolled, then candidates,
  // each root before its nested events.
  const order: LocatedEvent[] = [];
  const visit = (entry: LocatedEvent) => {
    order.push(entry);
    for (const child of childrenOf(entry))
      // Safe cast: childrenOf reads entry.tree, and located added every event
      // of each tree it took an entry from to byId.
      visit(byId.get(child.eventId)!);
  };
  const roots = located.filter(
    (entry) => !('parentEventId' in entry.event.origin),
  );
  const automaticRoots = roots.filter(
    (entry) => entry.owner === null && entry.event.origin.kind === 'automatic',
  );
  const rolledRoots = roots.filter(
    (entry) => entry.owner === null && entry.event.origin.kind === 'rolled',
  );
  for (const entry of [...automaticRoots, ...rolledRoots]) visit(entry);
  for (const entry of roots) if (entry.owner !== null) visit(entry);
  for (const entry of located) if (!order.includes(entry)) order.push(entry);
  const labels = eventLabels({
    units: [
      ...[...automaticRoots, ...rolledRoots].map((root) => ({
        roots: [root],
        lettered: false,
        active: active.has(root.event.eventId),
      })),
      ...plan.trees.candidates.map((tree) => ({
        roots: roots.filter(
          (entry) => entry.owner?.choice.choiceId === tree.choiceId,
        ),
        lettered: true,
        active: activeCandidateSets.has(tree.choiceId),
      })),
    ],
    order,
    childrenOf: (entry) =>
      childrenOf(entry).flatMap((child) => byId.get(child.eventId) ?? []),
  });
  const labelOf = (eventId: string) => labels.get(eventId) ?? 'Event';

  return {
    located,
    byId,
    childrenOf,
    active,
    overfull,
    groupOfParent,
    activeCandidateSets,
    order,
    roots,
    labelOf,
  };
}

/** Display labels for the draft's current-week occurrences, by identity. */
export function eventOccurrenceLabels(
  draft: WeeklyDraft,
  trace: readonly EventPositionGroup[],
) {
  const positions = uniquePositions(trace);
  const { order, labelOf } = eventTreeLayout(
    draft,
    positions,
    planEventTopology(draft, positions),
  );
  return new Map(
    order.map((entry) => [entry.event.eventId, labelOf(entry.event.eventId)]),
  );
}

/** What the engine's trace says of one occurrence, for its block status. */
export function eventTraceFacts(
  projection: EventOutcomeProjection | undefined,
  event: Event,
): Omit<EventTraceFacts, 'label'> {
  const resolved = projection?.tree.find(
    (entry) => entry.eventId === event.eventId,
  );
  const prefixes = [event.eventId, event.sabotage?.choiceId].filter(Boolean);
  return {
    resolvedType: resolved?.eventType ?? null,
    mode:
      projection?.dispatch.find(
        (entry) => entry.event.eventId === event.eventId,
      )?.mode ?? null,
    selected:
      projection?.selected.some((entry) => entry.eventId === event.eventId) ??
      false,
    negated: projection?.negatedEventIds.includes(event.eventId) ?? false,
    requirements:
      projection?.requirements.filter((key) =>
        prefixes.some((id) => key.startsWith(`${id}:`)),
      ) ?? [],
    warnings:
      projection?.warnings.filter((key) =>
        prefixes.some((id) => key.startsWith(`${id}:`)),
      ) ?? [],
  };
}

export function eventTreeBlocks<
  Facts extends Omit<EventTraceFacts, 'label'> = Omit<
    EventOccurrenceFacts,
    'label'
  >,
>({
  draft,
  projection,
  plan,
  accepted,
  facts,
  issues,
}: {
  draft: WeeklyDraft;
  projection: EventOutcomeProjection | undefined;
  plan: EventTopologyPlan;
  accepted: ReadonlySet<string> | null;
  facts: (located: LocatedEvent, label: string) => Facts;
  issues: (codes: string[]) => EventIssue[];
}) {
  type Item = Facts & { label: string };
  const positions = uniquePositions(projection?.positions ?? []);
  const {
    located,
    byId,
    childrenOf,
    active,
    overfull,
    groupOfParent,
    activeCandidateSets,
    order,
    roots,
    labelOf,
  } = eventTreeLayout(draft, positions, plan);

  const itemsById = order.map((entry): [string, Item] => [
    entry.event.eventId,
    {
      ...facts(entry, labelOf(entry.event.eventId)),
      label: labelOf(entry.event.eventId),
    },
  ]);
  const occurrences = itemsById.map(([, item]) => item);
  const factsById = new Map(itemsById);

  function status(entry: LocatedEvent, surplus: boolean): EventBlockStatus {
    const id = entry.event.eventId;
    // Safe cast: eventTreeLayout puts every located event in order, and
    // factsById has an item for each entry of order.
    const item = factsById.get(id)!;
    if (accepted && !accepted.has(id)) return 'preparing';
    if (!active.has(id)) return surplus ? 'needs_repair' : 'not_used';
    if (overfull.has(id)) return 'needs_repair';
    const table = normalizeRawRoll(
      entry.event.tableRoll,
      RULE_ROLL_SPECS.percentile,
    );
    if (table.status !== 'complete') return 'awaiting_roll';
    if (item.negated) return 'sabotaged';
    const group = groupOfParent.get(id);
    // A Roll Twice rerolled in its own die, chosen candidate or not.
    if (group?.kind === 'replacement' && group.reroll) return 'reroll';
    const choice = entry.owner?.choice;
    const candidateRoot =
      isCandidateChoice(choice) && entry.event.origin.kind === 'rolled';
    if (candidateRoot && choice.selectedEventId !== id)
      return group?.kind === 'replacement'
        ? 'cannot_occur'
        : choice.selectedEventId
          ? 'not_chosen'
          : 'candidate';
    if (group?.kind === 'roll_twice') return 'two_more';
    if (group?.kind === 'replacement') return 'cannot_occur';
    if (item.selected)
      return item.mode === 'twice'
        ? 'twice'
        : item.mode === 'no_additional_effect'
          ? 'no_additional_effect'
          : item.warnings.includes(`${id}:event-eligibility`)
            ? 'kept'
            : 'happens';
    return 'awaiting_roll';
  }
  function origin(entry: LocatedEvent) {
    const { origin } = entry.event;
    if ('parentEventId' in origin) {
      const parent = labelOf(origin.parentEventId);
      if (origin.kind === 'roll_twice') return `From ${parent} (Roll Twice)`;
      return `Replaces ${parent}`;
    }
    if (origin.kind === 'automatic') return 'Automatic';
    return entry.owner
      ? `Candidate · ${activityLabel(entry.owner.choice.actionId)}`
      : 'Rolled';
  }
  function block(entry: LocatedEvent, repair: Repair): EventBlock<Item> {
    const id = entry.event.eventId;
    // Safe cast: block only receives located entries, all of which order and
    // so factsById hold.
    const item = factsById.get(id)!;
    const isSurplus = repair.surplus(id);
    const current = status(entry, isSurplus);
    const children = childrenOf(entry).map(
      // Safe cast: a child comes from entry.tree, whose events byId all holds.
      (child) => byId.get(child.eventId)!,
    );
    // Active children, then restorable inactive ones.
    const nested: Pick<EventBlock<Item>, 'children' | 'hidden'> = {
      children: [],
      hidden: [],
    };
    for (const child of children)
      (active.has(child.event.eventId) ? nested.children : nested.hidden).push(
        block(child, repair),
      );
    const choice = entry.owner?.choice;
    return {
      eventId: id,
      label: item.label,
      item,
      saved: !accepted || accepted.has(id),
      status: current,
      statusLabel: STATUS_LABELS[current],
      statusText: STATUS_TEXT[current],
      origin: origin(entry),
      table: eventTableFacts(entry.event.tableRoll),
      rules: eventRules(entry.event.tableRoll, item.mode),
      candidate:
        entry.owner &&
        choice &&
        isCandidateChoice(choice) &&
        entry.event.origin.kind === 'rolled'
          ? {
              slotId: entry.owner.slotId,
              choiceId: choice.choiceId,
              chosen: choice.selectedEventId === id,
            }
          : null,
      children: nested.children,
      hidden: nested.hidden,
      surplus: isSurplus || overfull.has(id),
      removal: repair.removal(id),
      issues: issues([...item.requirements, ...item.warnings]),
    };
  }
  return {
    occurrences,
    active,
    activeCandidateSets,
    located,
    roots,
    block,
  };
}
