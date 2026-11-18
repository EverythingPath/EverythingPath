import { eventOccurrenceSchema } from '~/lib/weekly-draft-facts';
import type { EventType } from '~/lib/militia-domain';
import type { EventView } from './types';

type Occurrence = EventView['occurrences'][number]['occurrence'];

// The occurrence inputs the Event details editor offers: the ones the
// current Event controls also write, so a recorded value can still be
// corrected or cleared there. This is an allowlist: a field added to the
// occurrence schema is not offered until it is named here. Everything else
// (origin, table roll, resolved type and the same-week Persistent fields) is
// never offered and stays as recorded. `eventId` is the occurrence's
// identity: the editor carries it but never shows it.
const OFFERED = {
  eventId: true,
  mitigation: true,
  averagePartyLevel: true,
  officerCheck: true,
  rolls: true,
  targets: true,
  overseerCharacterId: true,
  targetChecks: true,
  rewards: true,
  sabotage: true,
} as const;
const occurrenceDetailsSchema = eventOccurrenceSchema.pick(OFFERED);
// Raid and Cache Discovered record Attempt it / Let it happen and its check
// per hidden person or cache, in `targetChecks`, never for the whole event.
const perTargetDetailsSchema = occurrenceDetailsSchema.omit({
  mitigation: true,
  rolls: true,
});

export type EventDetailsSchema =
  | typeof occurrenceDetailsSchema
  | typeof perTargetDetailsSchema;

/** The details the editor offers for an occurrence of this resolved type. */
export function eventDetailsSchema(
  eventType: EventType | null,
): EventDetailsSchema {
  return eventType === 'raid' || eventType === 'cache_discovered'
    ? perTargetDetailsSchema
    : occurrenceDetailsSchema;
}

function splitOffered(occurrence: Occurrence, schema: EventDetailsSchema) {
  const offered: Record<string, unknown> = {};
  const kept: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(occurrence))
    (key in schema.shape ? offered : kept)[key] = value;
  return { offered, kept };
}

/** The offered part of a recorded occurrence: the editor's value. */
export function eventDetails(
  occurrence: Occurrence,
  schema: EventDetailsSchema,
) {
  return splitOffered(occurrence, schema).offered;
}

/**
 * The occurrence with its offered details replaced by the editor's value,
 * or cleared when the value is undefined; every field the editor does not
 * offer stays as recorded. Null when the value is not valid details.
 */
export function withEventDetails(
  occurrence: Occurrence,
  schema: EventDetailsSchema,
  value: unknown,
): Occurrence | null {
  const { kept } = splitOffered(occurrence, schema);
  if (value === undefined)
    // Safe cast: kept is the occurrence without its offered details, which are
    // optional.
    return { ...kept, eventId: occurrence.eventId } as Occurrence;
  const parsed = schema.safeParse(value);
  if (!parsed.success) return null;
  // Safe cast: schema validated these details for the occurrence's own event.
  return {
    ...kept,
    ...parsed.data,
    eventId: occurrence.eventId,
  } as Occurrence;
}
