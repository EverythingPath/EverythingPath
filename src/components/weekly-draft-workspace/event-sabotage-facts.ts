import { sabotageCheckId, sabotageDc } from '~/lib/rules-event-shaping';
import { RULE_ROLL_SPECS } from '~/lib/rules-roll-spec';
import type { OrganizationCheck } from '~/lib/rules-officers';
import type { RawRoll } from '~/lib/weekly-draft-facts';
import { checkNames, eventCheckFacts } from './event-check-facts';
import type { EventPanelContext } from './event-panel-context';
import { targetChoice } from './event-target-choice';
import { eventName } from './event-tree-facts';
import type {
  EventCheckFacts,
  EventOccurrenceFacts,
  EventTargetChoice,
  EventWhatHappened,
} from './types';

type Item = Omit<EventOccurrenceFacts, 'panel'>;

// Sabotage: the Saboteurs' reactive Event action against one exact event.
// DC 15 + rank; the 1d6 notoriety is added whether the check succeeds or
// fails; success negates only this occurrence (militia-rules.md, "Action:
// Sabotage"). Everything here reads the engine's projection; nothing is
// decided from the entered numbers alone.

export type EventSabotageResult = {
  kind:
    | 'success'
    | 'failure'
    | 'incomplete'
    | 'unavailable'
    | 'no-event'
    | 'inactive';
  text: string;
};

export type EventSabotageFacts = {
  eventId: string;
  // The reaction's identity: the recorded one, or the one a first input
  // records (stable, so two devices starting it write the same reaction).
  choiceId: string;
  recorded: boolean;
  // Offer "Sabotage this event": the event happens this week, is not a calm
  // week, and the militia has a Saboteurs team.
  offer: boolean;
  dc: number | null;
  team: EventTargetChoice;
  check: OrganizationCheck | null;
  checkRow: EventCheckFacts | null;
  checkRoll: RawRoll | undefined;
  checkTypeRequired: boolean;
  notoriety: { recorded: RawRoll | undefined; required: boolean };
  // Notoriety this attempt adds, success or failure alike.
  notorietyGain: number | null;
  result: EventSabotageResult | null;
  whatHappened: EventWhatHappened;
};

export function sabotageChoiceId(eventId: string) {
  return `sabotage-${eventId}`;
}

export function eventSabotageFacts(
  item: Item,
  context: EventPanelContext,
): EventSabotageFacts {
  const occurrence = item.occurrence;
  const eventId = occurrence.eventId;
  const sabotage = occurrence.sabotage;
  const choiceId = sabotage?.choiceId ?? sabotageChoiceId(eventId);
  const codes = item.requirements;
  const has = (tail: string) => codes.includes(`${choiceId}:${tail}`);
  const projected = context.projection?.sabotage.find(
    (entry) => entry.eventId === eventId && entry.choiceId === choiceId,
  );
  const rank = context.activity?.outcome.rank ?? null;
  const dc = projected?.dc ?? (rank === null ? null : sabotageDc(rank));
  const name = eventName(item.resolvedType) ?? 'This event';
  const calm =
    item.resolvedType === 'all_is_calm' ||
    item.resolvedType === 'calm_before_the_storm';
  const used = new Set(context.activity?.teamUse.usedTeamIds ?? []);
  const saboteurs = context.teams.filter(
    (team) => team.teamType === 'saboteurs',
  );
  const team = targetChoice({
    label: 'Saboteurs team',
    hint: 'Only Saboteurs can sabotage. A team that already acted, is not active or is unavailable needs a Rules Exception.',
    required: has('team'),
    recorded: sabotage?.teamId ? [sabotage.teamId] : [],
    choices: saboteurs.map((entry) => ({
      value: entry.teamId,
      label: entry.name,
      description: [
        entry.tier === null
          ? entry.typeName
          : `${entry.typeName} · tier ${entry.tier}`,
        used.has(entry.teamId) ? 'Acted this week' : 'Did not act this week',
        entry.condition === 'active'
          ? null
          : entry.condition === 'disabled'
            ? 'Disabled'
            : 'Missing',
        entry.unavailable ? 'Unavailable this week' : null,
      ]
        .filter(Boolean)
        .join(' · '),
    })),
    name: (teamId) =>
      context.teams.find((entry) => entry.teamId === teamId)?.name ?? null,
    missing: {
      label: 'A team no longer on the roster',
      reason:
        'This team is no longer on the roster. Choose a Saboteurs team or clear it.',
    },
  });
  // A recorded team that is not a Saboteurs team stays, with its exception.
  team.retained = team.retained.map((entry) =>
    context.teams.some((known) => known.teamId === entry.value)
      ? {
          ...entry,
          reason:
            'Not a Saboteurs team: this needs a Rules Exception, or choose a Saboteurs team.',
        }
      : entry,
  );
  const check = sabotage?.check ?? null;
  const checkId = sabotageCheckId(eventId, choiceId);
  const checkRoll = sabotage?.rolls?.check;
  const checkRow =
    check && dc !== null
      ? {
          ...eventCheckFacts({
            checkId,
            check,
            dc,
            target: null,
            mandatory: false,
            projected: context.projection?.checks.find(
              (entry) => entry.checkId === checkId,
            ),
            requirements: [],
            recorded: checkRoll,
            modifierLabel: context.modifierLabel,
            result: {
              success: `${name} does not happen.`,
              failure: `${name} still happens.`,
            },
          }),
          // Names its event: several events can each have a Sabotage.
          label: `Sabotage ${checkNames[check]} check for ${context.eventLabel(eventId)}`,
          required: has('check:1d20'),
        }
      : null;
  const subjectId = `sabotage:${eventId}:${choiceId}`;
  const note = context.draft.acknowledgements.find(
    (entry) => entry.subjectId === subjectId,
  );
  return {
    eventId,
    choiceId,
    recorded: Boolean(sabotage),
    offer: !sabotage && item.selected && !calm && saboteurs.length > 0,
    dc,
    team,
    check,
    checkRow,
    checkRoll,
    checkTypeRequired: has('check-type'),
    notoriety: {
      recorded: sabotage?.rolls?.notoriety,
      required: has(
        `notoriety:${RULE_ROLL_SPECS.singleD6.count}d${RULE_ROLL_SPECS.singleD6.sides}`,
      ),
    },
    notorietyGain: projected?.notoriety ?? null,
    result: sabotage
      ? sabotageResult({
          item,
          name,
          has,
          projected,
          // A team the rules refuse without a reasoned Rules Exception.
          refused: codes.some(
            (code) =>
              code.startsWith(`${choiceId}:`) && code.endsWith(':exception'),
          ),
        })
      : null,
    whatHappened: {
      subjectId,
      required: has('acknowledgement'),
      hint: 'How the Saboteurs went about it, and what the table made of it.',
      acknowledgement: note
        ? { acknowledgementId: note.acknowledgementId, outcome: note.outcome }
        : null,
    },
  };
}

function sabotageResult({
  item,
  name,
  has,
  projected,
  refused,
}: {
  item: Item;
  name: string;
  has: (tail: string) => boolean;
  projected: { succeeded: boolean | null } | undefined;
  refused: boolean;
}): EventSabotageResult {
  if (!item.selected)
    return {
      kind: 'inactive',
      text: 'Kept on record: this event does not happen now, so this Sabotage attempt is not used and adds no notoriety.',
    };
  if (has('no-event'))
    return {
      kind: 'no-event',
      text: 'A calm week has no event to negate. Cancel this Sabotage.',
    };
  if (has('team'))
    return {
      kind: 'incomplete',
      text: 'Choose the Saboteurs team. Nothing is negated until the attempt is complete.',
    };
  if (!projected && refused)
    return {
      kind: 'unavailable',
      text: 'This team cannot sabotage now. Record a Rules Exception below to attempt it anyway; until then nothing is rolled, spent or negated.',
    };
  if (projected?.succeeded === true)
    return {
      kind: 'success',
      text: `Sabotage succeeds: ${name} does not happen.`,
    };
  if (projected?.succeeded === false)
    return { kind: 'failure', text: `Sabotage fails: ${name} still happens.` };
  return {
    kind: 'incomplete',
    text: `Sabotage is incomplete: ${name} still happens until the check succeeds.`,
  };
}
