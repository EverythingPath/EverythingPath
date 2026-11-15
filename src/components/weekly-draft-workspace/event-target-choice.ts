import { actionChoiceEvents } from '~/lib/weekly-draft-facts';
import type { EventPanelContext, EventPanelItem } from './event-panel-context';
import type {
  ActivityTeamFact,
  EventRetainedTarget,
  EventTargetCard,
  EventTargetChoice,
} from './types';

type Item = EventPanelItem;

// Target choices shared by the event families: teams and settlements on
// cards, and the first occurrence a Twice repeats.

export function teamName(context: EventPanelContext, teamId: string) {
  return context.teams.find((team) => team.teamId === teamId)?.name ?? null;
}

export const conditionWords: Record<string, string> = {
  active: 'Active',
  disabled: 'Disabled',
  missing: 'Missing',
};

// The first occurrence of this event type when this one is its Twice.
export function firstOccurrence(item: Item, context: EventPanelContext) {
  if (item.mode !== 'twice') return null;
  const first = context.projection?.dispatch.find(
    (entry) => entry.event.eventId === item.occurrence.eventId,
  )?.firstEventId;
  if (!first || first === item.occurrence.eventId) return null;
  const event = [
    ...context.draft.event.occurrences,
    ...context.draft.activity.slots.flatMap((slot) =>
      actionChoiceEvents(slot.choice),
    ),
  ].find((entry) => entry.eventId === first);
  return {
    eventId: first,
    label: context.eventLabel(first),
    teamIds:
      event?.targets?.flatMap((target) =>
        target.kind === 'team' ? [target.teamId] : [],
      ) ?? [],
  };
}

/**
 * What a team card says besides its type: whether the team acted this week,
 * its condition when not active, and the first occurrence that chose it.
 */
export function teamDescription(
  context: EventPanelContext,
  first: ReturnType<typeof firstOccurrence>,
) {
  const used = new Set(context.activity?.teamUse.usedTeamIds ?? []);
  return (team: ActivityTeamFact) => [
    used.has(team.teamId) ? 'Acted this week' : 'Did not act this week',
    team.condition !== 'active' ? conditionWords[team.condition] : null,
    first?.teamIds.includes(team.teamId) ? `Chosen in ${first.label}` : null,
  ];
}

// One recorded target of a kind is the selection; any other recorded one
// (a second target, or one no longer known) stays until cleared.
export function targetChoice({
  label,
  hint,
  required,
  recorded,
  choices,
  name,
  missing,
}: {
  label: string;
  hint: string | null;
  required: boolean;
  recorded: string[];
  choices: EventTargetCard[];
  name: (value: string) => string | null;
  // What a recorded target no longer known is called and why it stays.
  missing: { label: string; reason: string };
}): EventTargetChoice {
  const [only] = recorded;
  const known = (value: string) =>
    choices.some((choice) => choice.value === value);
  const selected =
    recorded.length === 1 && only !== undefined && known(only) ? only : null;
  const retained: EventRetainedTarget[] = recorded.flatMap((value) =>
    value === selected
      ? []
      : [
          known(value)
            ? {
                value,
                label: name(value) ?? missing.label,
                reason: `Only one is affected. Choose it, or clear this one.`,
              }
            : {
                value,
                label: name(value) ?? missing.label,
                reason: missing.reason,
              },
        ],
  );
  return { label, hint, required, selected, choices, retained };
}

type Cache = NonNullable<
  NonNullable<EventPanelContext['projection']>['outcome']['economy']
>['caches'][number];
const cacheClassNames: Record<Cache['cacheClass'], string> = {
  minor: 'Minor',
  intermediate: 'Intermediate',
  major: 'Major',
};
/** "Minor cache at Bridge": caches have no name of their own. */
export const cacheName = (cache: Pick<Cache, 'cacheClass' | 'location'>) =>
  `${cacheClassNames[cache.cacheClass]} cache at ${cache.location}`;

/** An item's name wherever the week knows it, after Activity or later. */
export function itemName(context: EventPanelContext, itemId: string) {
  return (
    [
      ...(context.projection?.outcome.economy?.items ?? []),
      ...(context.activity?.outcome.economy?.items ?? []),
    ].find((item) => item.itemId === itemId)?.name ?? null
  );
}

// A recorded team no longer on the roster, and why it stays.
export const MISSING_TEAM = {
  label: 'A team no longer on the roster',
  reason:
    'This team is no longer on the roster. Clear it or choose another team.',
};

/** Every roster team as a card: its type and tier, then `describe`'s notes. */
export function teamCards(
  context: EventPanelContext,
  describe: (team: ActivityTeamFact) => (string | null | undefined)[],
): EventTargetCard[] {
  return context.teams.map((team) => ({
    value: team.teamId,
    label: team.name,
    description: [
      team.typeName && team.tier !== null
        ? `${team.typeName} · tier ${team.tier}`
        : team.typeName,
      ...describe(team),
    ]
      .filter(Boolean)
      .join(' · '),
  }));
}

export function teamChoice({
  item,
  context,
  label,
  hint,
  required,
  describe,
}: {
  item: Item;
  context: EventPanelContext;
  label: string;
  hint: string | null;
  required: boolean;
  describe: (team: ActivityTeamFact) => (string | null | undefined)[];
}): EventTargetChoice {
  return targetChoice({
    label,
    hint,
    required,
    recorded:
      item.occurrence.targets?.flatMap((target) =>
        target.kind === 'team' ? [target.teamId] : [],
      ) ?? [],
    choices: teamCards(context, describe),
    name: (teamId) => teamName(context, teamId),
    missing: MISSING_TEAM,
  });
}
