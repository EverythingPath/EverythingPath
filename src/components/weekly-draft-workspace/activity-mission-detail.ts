import { strikeExtraction, strikeSupport } from '~/lib/rules-character-actions';
import { immediatelyFollowingChoiceId } from '~/lib/rules-event-actions';
import { propagandaDc } from '~/lib/rules-settlement-actions';
import {
  consumables,
  detailRolls,
  option,
  ordered,
  withMissing,
  type DetailCommon,
  type DetailOption,
  type DetailRollField,
} from './activity-action-detail';
import { activityLabel } from './activity-labels';
import {
  isMissionChoice,
  type MissionActionId,
  type MissionChoice,
} from './activity-mission-actions';
import type {
  ActivityCandidateSet,
  ActivityPositionFacts,
  ActivityView,
} from './types';

// Presentation facts for the information, mission and event-influence
// actions' detail editors. Settlements are read as the ordered Activity sees
// them at this slot; groups guide the table and never filter. A recorded
// reference nothing here knows stays listed as missing. Event candidates are
// Event's to roll and choose: Activity shows where they stand.

type Slot = ActivityView['slots'][number];
type Choice<Id extends MissionActionId> = Extract<
  MissionChoice,
  { actionId: Id }
>;
type PositionSettlement = ActivityPositionFacts['settlements'][number];

// The outcome the rules ask the table to record for this choice.
export type MissionAcknowledgement = {
  subjectId: string;
  // What the note is about, under its "What happened" field.
  description: string;
  // The rules wait for it now.
  required: boolean;
  recorded: { acknowledgementId: string; outcome: string } | null;
};
type Specific =
  | {
      actionId: 'gather_information' | 'knowledge_check';
      // Knowledge Check: the check total is the Knowledge DC achieved.
      achievedDc: number | null;
    }
  | { actionId: 'special' }
  | {
      actionId: 'covert_action';
      modes: DetailOption[];
      // The other staged choices in slot order; the next one first.
      following: DetailOption[];
      // Which of the mode-dependent fields the chosen mode uses; both are
      // false until a mode is chosen.
      uses: { following: boolean; location: boolean };
    }
  | { actionId: 'strike_team'; modes: DetailOption[] }
  | {
      actionId: 'activate_refuge' | 'reduce_danger';
      settlements: DetailOption[];
    }
  | {
      actionId: 'spread_propaganda';
      settlements: DetailOption[];
      // The chosen settlement's recorded occupation, which sets the DC; null
      // while no known settlement is chosen or it is not recorded.
      occupiedRecord: boolean | null;
      occupied: DetailOption[];
    }
  | {
      actionId: 'guarantee_event' | 'manipulate_events';
      // Null until Event reads the choice's candidates.
      candidates: ActivityCandidateSet | null;
    };
export type MissionDetail = DetailCommon &
  Specific & { acknowledgement: MissionAcknowledgement | null };

const rollWhen: Partial<
  Record<MissionActionId, Partial<Record<DetailRollField, string>>>
> = {
  gather_information: {
    notoriety: 'Rolled on a natural 1: Notoriety rises by the roll.',
  },
  reduce_danger: {
    notoriety: 'Rolled if the check fails: Notoriety rises by the roll.',
  },
  guarantee_event: {
    notoriety: 'Always rolled: Notoriety rises by the roll.',
  },
};

const acknowledgementDescription: Record<MissionActionId, string | null> = {
  gather_information: 'What the team learned, as the GM tells it.',
  knowledge_check: 'What the team learned, as the GM tells it.',
  special: 'How the GM resolved the instruction.',
  strike_team: 'The table’s note of the Strike Team’s plan.',
  covert_action: 'The table’s note of the contact or cache.',
  spread_propaganda: 'The table’s note of the propaganda attempt.',
  guarantee_event: 'The table’s note of the guaranteed event.',
  manipulate_events: 'The table’s note of the guaranteed event.',
  activate_refuge: null,
  reduce_danger: null,
};

// The subject of the action's What happened note, or null for an action
// whose rules ask for none.
function noteSubject(choice: MissionChoice) {
  switch (choice.actionId) {
    case 'activate_refuge':
    case 'reduce_danger':
      return null;
    case 'spread_propaganda':
      return `propaganda:${choice.choiceId}`;
    default:
      return `${choice.actionId}:${choice.choiceId}`;
  }
}

function acknowledgement(
  choice: MissionChoice,
  slot: Slot,
): MissionAcknowledgement | null {
  const subjectId = noteSubject(choice);
  const description = acknowledgementDescription[choice.actionId];
  if (!subjectId || !description) return null;
  const recorded =
    choice.acknowledgements?.find((entry) => entry.subjectId === subjectId) ??
    null;
  // Covert Action notes only a placed contact or cache; a recorded note stays
  // visible after a change to augment until it is cleared.
  const isUsed =
    choice.actionId !== 'covert_action' || choice.mode !== 'augment';
  if (!isUsed && !recorded) return null;
  const prefix = `${choice.choiceId}:acknowledgement`;
  return {
    subjectId,
    description,
    required: slot.requirements.some(
      (code) => code === prefix || code === `${prefix}:${subjectId}`,
    ),
    recorded: recorded
      ? {
          acknowledgementId: recorded.acknowledgementId,
          outcome: recorded.outcome,
        }
      : null,
  };
}

function atPosition(slot: Slot, settlementId: string) {
  return (
    slot.position?.settlements.find(
      (entry) => entry.settlementId === settlementId,
    ) ?? null
  );
}
function reputationText(settlement: PositionSettlement | null) {
  return settlement?.reputation ?? 'Reputation not recorded';
}
// The campaign's settlements as options, with the recorded one kept when it
// is no longer among them.
function settlementOptions(
  view: ActivityView,
  slot: Slot,
  recorded: string | undefined,
  describe: (settlement: PositionSettlement | null) => (string | null)[],
  eligible: (settlement: PositionSettlement | null) => boolean,
) {
  return withMissing(
    ordered(
      view.settlements.map((settlement) => {
        const facts = atPosition(slot, settlement.value);
        return option(
          settlement.value,
          settlement.label,
          describe(facts).filter(Boolean).join(' · '),
          // Without the ordered preview there is nothing to guide by.
          slot.position ? eligible(facts) : true,
        );
      }),
    ),
    recorded,
    'Missing settlement',
    'No longer one of the campaign’s settlements',
  );
}

function slotName(slot: Slot) {
  return `Action Slot ${slot.number} · ${slot.actionName ?? 'Action'}`;
}
function slotLabel(view: ActivityView, choiceId: string) {
  const slot = view.slots.find((entry) => entry.choice?.choiceId === choiceId);
  return slot ? slotName(slot) : null;
}

function refugeSettlements(
  view: ActivityView,
  slot: Slot,
  choice: Choice<'activate_refuge'>,
) {
  const refuges = slot.position?.refugeSettlementIds ?? [];
  return settlementOptions(
    view,
    slot,
    choice.settlementId,
    (settlement) => [
      reputationText(settlement),
      settlement && refuges.includes(settlement.settlementId)
        ? 'Refuge active'
        : null,
    ],
    (settlement) => settlement?.refugeAllowed ?? false,
  );
}

function securityText(settlement: PositionSettlement | null) {
  if (settlement?.secured === true) return 'Secured';
  if (settlement?.secured === false) return 'Not secured';
  return 'Security not recorded';
}

function dangerSettlements(
  view: ActivityView,
  slot: Slot,
  choice: Choice<'reduce_danger'>,
) {
  return settlementOptions(
    view,
    slot,
    choice.settlementId,
    (settlement) => [reputationText(settlement), securityText(settlement)],
    (settlement) => settlement?.secured === true,
  );
}

function propagandaSettlements(
  view: ActivityView,
  slot: Slot,
  choice: Choice<'spread_propaganda'>,
) {
  const earlier = slot.position?.propaganda ?? [];
  return settlementOptions(
    view,
    slot,
    choice.settlementId,
    (settlement) => {
      const swayed = earlier.find(
        (entry) => entry.settlementId === settlement?.settlementId,
      );
      return [
        reputationText(settlement),
        typeof settlement?.occupied === 'boolean'
          ? `${settlement.occupied ? 'Occupied' : 'Not occupied'} · DC ${propagandaDc(settlement.occupied)}`
          : 'Occupation not recorded',
        swayed
          ? `Already swayed by ${slotLabel(view, swayed.choiceId) ?? 'an earlier choice'}`
          : null,
      ];
    },
    (settlement) =>
      typeof settlement?.reputation === 'string' &&
      typeof settlement.occupied === 'boolean' &&
      !earlier.some((entry) => entry.settlementId === settlement.settlementId),
  );
}

function propagandaDetail(
  view: ActivityView,
  slot: Slot,
  choice: Choice<'spread_propaganda'>,
): Specific {
  const record = choice.settlementId
    ? (atPosition(slot, choice.settlementId)?.occupied ?? null)
    : null;
  const matches = (value: boolean) => record === null || record === value;
  return {
    actionId: choice.actionId,
    settlements: propagandaSettlements(view, slot, choice),
    occupiedRecord: record,
    occupied: [true, false].map((value) =>
      option(
        String(value),
        value ? 'Occupied' : 'Not occupied',
        matches(value)
          ? `DC ${propagandaDc(value)}`
          : 'Differs from the settlement’s record',
        matches(value),
      ),
    ),
  };
}

function covertDetail(
  view: ActivityView,
  slot: Slot,
  choice: Choice<'covert_action'>,
): Specific {
  const next = immediatelyFollowingChoiceId(view.slots, choice.choiceId);
  return {
    actionId: choice.actionId,
    modes: [
      option(
        'augment',
        activityLabel('augment'),
        'Adds the Spies manager’s Charisma bonus to every d20 roll of the next choice; if that choice succeeds, it raises no Notoriety.',
      ),
      option(
        'contact',
        activityLabel('contact'),
        'Places a contact at an adventure site for one week.',
      ),
      option(
        'cache',
        activityLabel('cache'),
        'Places a cache at an adventure site for one week.',
      ),
    ],
    following: withMissing(
      ordered(
        view.slots.flatMap((entry) =>
          entry.choice && entry.choice.choiceId !== choice.choiceId
            ? [
                option(
                  entry.choice.choiceId,
                  slotName(entry),
                  entry.choice.choiceId === next
                    ? 'The next choice'
                    : 'Not the next choice',
                  entry.choice.choiceId === next,
                ),
              ]
            : [],
        ),
      ),
      choice.followingChoiceId,
      'Missing choice',
      'No longer staged this Activity',
    ),
    uses: {
      following: choice.mode === 'augment',
      location: choice.mode === 'contact' || choice.mode === 'cache',
    },
  };
}

function strikeModes(view: ActivityView) {
  const support = strikeSupport(view.allowance.rank);
  const extraction = strikeExtraction();
  const rounds = `${support.rounds} round${support.rounds === 1 ? '' : 's'}`;
  return [
    option(
      'support',
      activityLabel('support'),
      `Next week at the location, each PC gains +${support.attackBonus} ${support.bonusType} to attack, +${support.damageBonus} to damage and +${support.saveBonus} to saves for ${rounds}.`,
    ),
    option(
      'extraction',
      activityLabel('extraction'),
      `Next week at the location, bleeding allies stabilize, dead allies gain gentle repose (CL ${extraction.gentleReposeCasterLevel}) and bodies are extracted to ${activityLabel(extraction.extractBodiesTo).toLowerCase()}.`,
    ),
  ];
}

function specific(
  choice: MissionChoice,
  slot: Slot,
  view: ActivityView,
): Specific {
  switch (choice.actionId) {
    case 'gather_information':
    case 'knowledge_check':
      return {
        actionId: choice.actionId,
        achievedDc:
          choice.actionId === 'knowledge_check'
            ? (slot.check?.total ?? null)
            : null,
      };
    case 'special':
      return { actionId: choice.actionId };
    case 'covert_action':
      return covertDetail(view, slot, choice);
    case 'strike_team':
      return { actionId: choice.actionId, modes: strikeModes(view) };
    case 'activate_refuge':
      return {
        actionId: choice.actionId,
        settlements: refugeSettlements(view, slot, choice),
      };
    case 'reduce_danger':
      return {
        actionId: choice.actionId,
        settlements: dangerSettlements(view, slot, choice),
      };
    case 'spread_propaganda':
      return propagandaDetail(view, slot, choice);
    case 'guarantee_event':
    case 'manipulate_events':
      return {
        actionId: choice.actionId,
        candidates:
          view.candidateSets.find((set) => set.choiceId === choice.choiceId) ??
          null,
      };
  }
}

// The detail facts for an information, mission or event-influence action,
// or null for other actions.
export function missionDetail(
  view: ActivityView,
  slot: Slot,
): MissionDetail | null {
  const choice = slot.choice;
  if (!choice || !isMissionChoice(choice)) return null;
  return {
    ...specific(choice, slot, view),
    rolls: detailRolls(choice, slot, rollWhen[choice.actionId]),
    consumables: consumables(choice, slot, view),
    acknowledgement: acknowledgement(choice, slot),
  };
}

// Acknowledgement subjects the mission editor shows itself, so the host
// does not list them again.
export function missionAcknowledgementSubjects(detail: MissionDetail | null) {
  return new Set(
    detail?.acknowledgement ? [detail.acknowledgement.subjectId] : [],
  );
}
