import { actionChoiceEvents } from './weekly-draft-facts';
import type { WeeklyDraft, WeeklyDraftEdit } from './weekly-draft-contract';

// The Overseer supports the organization checks of one chosen event a week
// (militia-rules.md, "Overseer"). The choice is shared by Event and
// Persistent and lives in the records that already own it: an occurrence's
// own `overseerCharacterId`, or a carried event's Persistent mitigation
// decision. Nothing here is a new field or endpoint; moving support is a
// sequence of ordinary edits.

type Occurrence = WeeklyDraft['event']['occurrences'][number];
type Decision = WeeklyDraft['persistent']['decisions'][number];

/** The draft records that can hold Overseer support. */
export type OverseerSupportSource = {
  // The event tree and every Activity candidate, in draft order.
  occurrences: Occurrence[];
  // Carried events' Persistent decisions.
  decisions: Decision[];
};

export function overseerSupportSource(
  draft: Pick<WeeklyDraft, 'event' | 'activity' | 'persistent'>,
): OverseerSupportSource {
  return {
    occurrences: [
      ...draft.event.occurrences,
      ...draft.activity.slots.flatMap((slot) =>
        actionChoiceEvents(slot.choice),
      ),
    ],
    decisions: [...draft.persistent.decisions],
  };
}

export type OverseerSupportHolder = {
  eventId: string;
  kind: 'occurrence' | 'carried';
  characterId: string;
};

/**
 * Every event that records Overseer support. More than one entry is a
 * conflict the rules resolve by giving support to the first event only.
 */
export function overseerSupportHolders(
  source: OverseerSupportSource,
): OverseerSupportHolder[] {
  const holders: OverseerSupportHolder[] = [];
  for (const event of source.occurrences)
    if (event.overseerCharacterId)
      holders.push({
        eventId: event.eventId,
        kind: 'occurrence',
        characterId: event.overseerCharacterId,
      });
  for (const decision of source.decisions)
    if (decision.kind === 'mitigate' && decision.overseerCharacterId)
      holders.push({
        eventId: decision.eventId,
        kind: 'carried',
        characterId: decision.overseerCharacterId,
      });
  return holders;
}

/**
 * The one ordinary edit removing the support recorded for this event,
 * keeping everything else in its record; null when it has none.
 */
export function clearOverseerSupportEdit(
  source: OverseerSupportSource,
  eventId: string,
): WeeklyDraftEdit | null {
  const event = source.occurrences.find((entry) => entry.eventId === eventId);
  if (event) {
    if (!event.overseerCharacterId) return null;
    const { overseerCharacterId: _previous, ...rest } = event;
    return { kind: 'event_occurrence', occurrence: rest };
  }
  const decision = source.decisions.find((entry) => entry.eventId === eventId);
  if (decision?.kind !== 'mitigate' || !decision.overseerCharacterId)
    return null;
  const { overseerCharacterId: _previous, ...rest } = decision;
  return { kind: 'persistent_decision', decision: rest };
}

/**
 * The one ordinary edit recording support on this event, in the record that
 * owns it: an occurrence's own selection or a carried event's mitigation
 * decision. 'already' when nothing needs to change; 'unavailable' when the
 * event has no record able to hold it.
 */
export function assignOverseerSupportEdit(
  source: OverseerSupportSource,
  eventId: string,
  characterId: string,
): WeeklyDraftEdit | 'already' | 'unavailable' {
  const event = source.occurrences.find((entry) => entry.eventId === eventId);
  if (event) {
    if (event.overseerCharacterId === characterId) return 'already';
    return {
      kind: 'event_occurrence',
      occurrence: {
        ...structuredClone(event),
        overseerCharacterId: characterId,
      },
    };
  }
  const decision = source.decisions.find((entry) => entry.eventId === eventId);
  if (decision?.kind !== 'mitigate') return 'unavailable';
  if (decision.overseerCharacterId === characterId) return 'already';
  return {
    kind: 'persistent_decision',
    decision: {
      ...structuredClone(decision),
      overseerCharacterId: characterId,
    },
  };
}

export type OverseerSupportSend = (
  edit: WeeklyDraftEdit,
) => Promise<'accepted' | 'failed'>;

export type OverseerSupportMoveResult =
  | { status: 'done'; cleared: string[] }
  // A clear was refused: support may still be on `eventId`.
  | { status: 'failed'; stage: 'clear'; eventId: string; cleared: string[] }
  // Every other selection is gone but support could not be recorded on
  // `eventId` (null when the move was removing it everywhere).
  | {
      status: 'failed';
      stage: 'assign';
      eventId: string | null;
      cleared: string[];
    };

/**
 * Moves Overseer support to one event (or removes it everywhere when `to` is
 * null) through ordered ordinary edits: first every other event's selection
 * is cleared, one edit at a time, then support is recorded on `to`. This is
 * not atomic. Each step is planned from `latest()`, the newest accepted and
 * pending draft, so a selection another device added meanwhile is cleared
 * too and an edit never replays facts captured before an earlier await. The
 * first refused edit stops the move and says where it stopped; the draft
 * then holds support on at most the events it already did, never on two
 * events because of this move, and running the move again resumes it.
 */
export async function moveOverseerSupport({
  to,
  characterId,
  latest,
  send,
}: {
  to: string | null;
  characterId: string;
  latest: () => OverseerSupportSource | null;
  send: OverseerSupportSend;
}): Promise<OverseerSupportMoveResult> {
  const cleared: string[] = [];
  const start = latest();
  if (!start)
    return { status: 'failed', stage: 'assign', eventId: to, cleared };
  // Bounded: every holder seen at the start plus a few a peer adds meanwhile.
  let budget = overseerSupportHolders(start).length + 3;
  for (;;) {
    const source = latest();
    if (!source)
      return { status: 'failed', stage: 'assign', eventId: to, cleared };
    const other = overseerSupportHolders(source).find(
      (holder) => holder.eventId !== to,
    );
    if (!other) break;
    const edit = clearOverseerSupportEdit(source, other.eventId);
    if (budget-- <= 0 || !edit || (await send(edit)) !== 'accepted')
      return {
        status: 'failed',
        stage: 'clear',
        eventId: other.eventId,
        cleared,
      };
    cleared.push(other.eventId);
  }
  if (to === null) return { status: 'done', cleared };
  const source = latest();
  const edit = source
    ? assignOverseerSupportEdit(source, to, characterId)
    : 'unavailable';
  if (edit === 'already') return { status: 'done', cleared };
  if (edit === 'unavailable' || (await send(edit)) !== 'accepted')
    return { status: 'failed', stage: 'assign', eventId: to, cleared };
  return { status: 'done', cleared };
}
