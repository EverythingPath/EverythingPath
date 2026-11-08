import type { ReviewNames } from '~/components/week-review/review-text';
import type { CanonicalResolutionRecord } from '~/lib/canonical-resolution-record';
import { militiaEventTable } from '~/lib/militia-event-table';
import { activityLabel } from '../weekly-draft-workspace/activity-labels';
import { isFacts, type Facts } from './record-artifacts';
import type { RecordedOccurrence } from './record-event-tree';

// Names come from the selected record alone. Teams, settlements, items and
// caches carry their recorded names; a record never stores character names,
// so each character, and anything else recorded without a name, gets a
// stable numbered label in the order it first appears in the record. Today's
// roster, ledger and labels are never consulted.

type Kind = 'team' | 'settlement' | 'item' | 'cache' | 'character';
type OwnName = { kind: Kind; id: string; name: string };
const fallbacks: Record<Kind, string> = {
  team: 'Team',
  settlement: 'Settlement',
  item: 'Item',
  cache: 'Cache',
  character: 'Character',
};

function findKind(field: string): Kind | null {
  const key = field.replace(/Ids$/, 'Id');
  if (/characterId$/i.test(key)) return 'character';
  if (/teamId$/i.test(key)) return 'team';
  if (/settlementId$/i.test(key)) return 'settlement';
  if (/itemId$/i.test(key)) return 'item';
  if (/cacheId$/i.test(key)) return 'cache';
  return null;
}

/** The name an entity records for itself, e.g. a roster team's name. */
function findOwnName(value: Facts): OwnName | null {
  const text = (field: string) => {
    const entry = value[field];
    return typeof entry === 'string' && entry.trim() ? entry : null;
  };
  const name = text('name');
  const location = text('location');
  const team = text('teamId');
  const settlement = text('settlementId');
  const item = text('itemId');
  const cache = text('cacheId');
  if (team && name && ('teamType' in value || 'status' in value))
    return { kind: 'team', id: team, name };
  if (settlement && name && 'reputation' in value)
    return { kind: 'settlement', id: settlement, name };
  if (item && name && !team && !settlement)
    return { kind: 'item', id: item, name };
  if (cache && location) return { kind: 'cache', id: cache, name: location };
  return null;
}

/** Every referenced entity by kind, with its recorded name when it has one. */
function collectEntities(record: CanonicalResolutionRecord) {
  const seen: Record<Kind, Map<string, string | null>> = {
    team: new Map(),
    settlement: new Map(),
    item: new Map(),
    cache: new Map(),
    character: new Map(),
  };
  const see = (kind: Kind, id: string, name: string | null = null) => {
    if (name || !seen[kind].has(id)) seen[kind].set(id, name);
  };
  const visit = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!isFacts(value)) return;
    const own = findOwnName(value);
    if (own) see(own.kind, own.id, own.name);
    for (const [field, entry] of Object.entries(value)) {
      const kind = findKind(field);
      const ids: unknown[] = Array.isArray(entry) ? entry : [entry];
      if (kind) for (const id of ids) if (typeof id === 'string') see(kind, id);
      visit(entry);
    }
  };
  // One fixed order, so numbered labels never depend on how they are read.
  [
    record.sourceMilitiaSnapshot,
    record.source,
    record.baselinePlan.data,
    record.finalPlan.data,
    record.finalOutcome.data,
    record.successorContext,
  ].forEach(visit);
  return seen;
}

function entityLabels(record: CanonicalResolutionRecord) {
  const labels = new Map<string, string>();
  const entities = collectEntities(record);
  // Safe cast: collectEntities returns a record keyed by every Kind.
  for (const kind of Object.keys(entities) as Kind[]) {
    let number = 0;
    for (const [id, name] of entities[kind])
      labels.set(`${kind}:${id}`, name ?? `${fallbacks[kind]} ${++number}`);
  }
  return (kind: Kind, id: string) =>
    labels.get(`${kind}:${id}`) ?? `Recorded ${fallbacks[kind].toLowerCase()}`;
}

function eventTypeName(type: string) {
  return (
    militiaEventTable.find((entry) => entry.eventType === type)?.name ??
    activityLabel(type)
  );
}

type Carried =
  CanonicalResolutionRecord['source']['context']['carriedEvents'][number];

/** Carried events in their Persistent order: oldest first, then order. */
export function orderCarried(events: readonly Carried[]) {
  return [...events].sort(
    (a, b) =>
      a.startedWeek - b.startedWeek ||
      a.order - b.order ||
      a.eventId.localeCompare(b.eventId),
  );
}

/** Event types the record itself states, by event identity. */
function recordedEventTypes(record: CanonicalResolutionRecord) {
  const types = new Map<string, string>();
  const visit = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!isFacts(value)) return;
    const id = value.eventId ?? value.sourceId;
    if (
      typeof id === 'string' &&
      typeof value.eventType === 'string' &&
      !types.has(id)
    )
      types.set(id, value.eventType);
    Object.values(value).forEach(visit);
  };
  [
    record.source,
    record.baselinePlan.data,
    record.finalPlan.data,
    record.finalOutcome.data,
    record.successorContext,
  ].forEach(visit);
  return types;
}

export type RecordNames = ReviewNames & {
  /** The recorded name of an event, or null when the record names none. */
  findEvent(id: string): string | null;
};

export function recordNames(
  record: CanonicalResolutionRecord,
  occurrences: readonly RecordedOccurrence[],
): RecordNames {
  const label = entityLabels(record);
  const types = recordedEventTypes(record);
  const findTypeName = (id: string) => {
    const type = types.get(id);
    return type ? eventTypeName(type) : null;
  };
  // The same names the live week gives: occurrences by their hierarchical
  // label, carried events by type and position among this week's carried.
  const events = new Map<string, string>();
  for (const { occurrence, label: position } of occurrences) {
    const name = findTypeName(occurrence.eventId);
    events.set(occurrence.eventId, name ? `${position} · ${name}` : position);
  }
  orderCarried(record.source.context.carriedEvents).forEach((event, index) => {
    if (!events.has(event.eventId))
      events.set(
        event.eventId,
        `${activityLabel(event.eventType)} · Event ${index + 1}`,
      );
  });
  const findEvent = (id: string) => events.get(id) ?? findTypeName(id);
  return {
    team: (id) => label('team', id),
    settlement: (id) => label('settlement', id),
    character: (id) => label('character', id),
    item: (id) => label('item', id),
    cache: (id) => label('cache', id),
    event: (id) => findEvent(id) ?? 'Recorded event',
    findEvent,
    // A recorded source is an event's name when it names one, else its text.
    source: (value) =>
      events.get(value) ??
      value
        .split(':')
        .map((part) => events.get(part) ?? part)
        .join(' · '),
  };
}
