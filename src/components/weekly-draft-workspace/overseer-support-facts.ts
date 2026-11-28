import {
  overseerSupportHolders,
  overseerSupportSource,
  type OverseerSupportSource,
} from '~/lib/overseer-support';
import { officerAbility, type OrganizationCheck } from '~/lib/rules-officers';
import type { UpkeepSnapshot } from '~/lib/rules-upkeep';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import { activityLabel } from './activity-labels';

/**
 * The week's one Overseer support, shared by Event and Persistent: who holds
 * the role (kept internal; the toggle never names them), what support adds
 * to each organization check, which events record it, and the draft records
 * a move plans its edits from.
 */
export type OverseerSupportFacts = {
  // The filled Overseer role, or null without one.
  characterId: string | null;
  contribution: Record<OrganizationCheck, number> | null;
  // One entry per event recording support; two or more is a conflict.
  holders: { eventId: string; label: string }[];
  // Every event that could hold it, by identity.
  labels: Record<string, string>;
  // Recorded occurrences the rules do not use this week (a candidate not
  // chosen, a hidden child, an earlier Roll Twice's events): support there
  // adds nothing, so they offer no switch.
  unused: string[];
  source: OverseerSupportSource;
};

// The newest facts from the Workspace, read between the edits of a move.
export type LatestOverseerSupport = () =>
  | OverseerSupportFacts
  | null
  | undefined;

// One check's toggle: "Use Overseer support · +3 · one event a week".
export type OverseerToggleFacts =
  // No filled Overseer role, or an event the rules do not use this week.
  // `recorded`: this event still records support, which gives no bonus and
  // can be removed.
  | { kind: 'unavailable'; reason: 'no-overseer' | 'unused'; recorded: boolean }
  | {
      kind: 'available';
      eventId: string;
      contribution: number;
      // Recorded on this event.
      on: boolean;
      // The other events recording it, by label ("Event 2 · Sickness").
      elsewhere: string[];
    };

/**
 * `outcome` is the militia as the Event phase sees it (after Activity), so
 * a role filled or emptied earlier this week counts. Carried events are
 * named by type and start week; occurrences by `eventLabel`.
 */
export function overseerSupportFacts({
  draft,
  outcome,
  eventLabel,
  unused = [],
}: {
  draft: WeeklyDraft;
  outcome: Pick<UpkeepSnapshot, 'roster' | 'characters'>;
  eventLabel: (eventId: string) => string;
  unused?: string[];
}): OverseerSupportFacts {
  const source = overseerSupportSource(draft);
  const overseer = outcome.roster.officers
    .filter((officer) => officer.role === 'overseer')
    .map((officer) =>
      outcome.characters.find(
        (character) => character.characterId === officer.characterId,
      ),
    )
    .find((character) => character !== undefined);
  const carried = (eventId: string) => {
    const event = draft.context.carriedEvents.find(
      (entry) => entry.eventId === eventId,
    );
    return event
      ? `${activityLabel(event.eventType)} (week ${event.startedWeek})`
      : 'A carried event';
  };
  const labels = Object.fromEntries<string>([
    ...source.occurrences.map(
      (event) => [event.eventId, eventLabel(event.eventId)] as const,
    ),
    ...draft.context.carriedEvents.map(
      (event) => [event.eventId, carried(event.eventId)] as const,
    ),
  ]);
  return {
    characterId: overseer?.characterId ?? null,
    contribution: overseer
      ? {
          loyalty: officerAbility(overseer, 'loyalty'),
          secrecy: officerAbility(overseer, 'secrecy'),
          security: officerAbility(overseer, 'security'),
        }
      : null,
    holders: overseerSupportHolders(source).map((holder) => ({
      eventId: holder.eventId,
      label: labels[holder.eventId] ?? 'Another event',
    })),
    labels,
    unused,
    source,
  };
}

/**
 * The toggle for one check of one event. The contribution is what the rules
 * actually added to this check when support is on it, otherwise what the
 * Overseer's ability would add.
 */
export function overseerToggle(
  facts: OverseerSupportFacts,
  eventId: string,
  check: OrganizationCheck,
  breakdown: readonly { source: string; value: number }[] = [],
): OverseerToggleFacts {
  const on = facts.holders.some((holder) => holder.eventId === eventId);
  if (!facts.characterId || !facts.contribution)
    return { kind: 'unavailable', reason: 'no-overseer', recorded: on };
  if (facts.unused.includes(eventId))
    return { kind: 'unavailable', reason: 'unused', recorded: on };
  const actual = breakdown.find(
    (entry) => entry.source === 'overseer-support',
  )?.value;
  return {
    kind: 'available',
    eventId,
    contribution: actual ?? facts.contribution[check],
    on,
    elsewhere: facts.holders
      .filter((holder) => holder.eventId !== eventId)
      .map((holder) => holder.label),
  };
}
