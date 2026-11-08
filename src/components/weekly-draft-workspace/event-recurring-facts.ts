import {
  eventMitigationAttempted,
  eventOfficerCheckExtras,
} from '~/lib/rules-event-checks';
import {
  RIVALRY_OFFICER_DC,
  THEFT_LOYALTY_DC,
} from '~/lib/rules-recurring-events';
import { turncoatDiplomacyDc } from '~/lib/rules-threat-events';
import { RULE_ROLL_SPECS } from '~/lib/rules-roll-spec';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import { eventCheckFacts } from './event-check-facts';
import {
  codes,
  eventRank as rank,
  whatHappened,
  type EventPanelContext,
  type EventPanelItem,
} from './event-panel-context';
import {
  carriedNames,
  outcomeLines,
  retainedFields,
  type EventFieldUse,
} from './event-outcome-facts';
import {
  firstOccurrence,
  MISSING_TEAM,
  teamCards,
  teamChoice,
  teamDescription,
  teamName,
} from './event-target-choice';
import {
  officerCandidateFacts,
  rivalrySkillLabels,
} from './persistent-check-facts';
import type {
  EventOfficerCheckFacts,
  EventPanel,
  EventRecurringFamily,
  EventRetainedTarget,
  EventSameWeekDecision,
  EventTeamPairChoice,
  RivalrySkill,
} from './types';

type Item = EventPanelItem;
type RecurringPanel = Extract<EventPanel, { family: 'recurring' }>;
type First = ReturnType<typeof firstOccurrence>;
type Decision = WeeklyDraft['persistent']['decisions'][number];

const RECURRING_FAMILIES: readonly EventRecurringFamily[] = [
  'rivalry',
  'turncoat',
  'theft',
  'double_agent',
  'low_morale',
];

export function isRecurringFamily(
  type: string | null,
): type is EventRecurringFamily {
  const families: readonly (string | null)[] = RECURRING_FAMILIES;
  return families.includes(type);
}

const acknowledgementHints: Record<EventRecurringFamily, string> = {
  rivalry: 'How the two teams were picked, and what the table made of it.',
  turncoat: 'How the GM picked the team, and what the table made of it.',
  theft: 'The table’s outcome, in a sentence.',
  double_agent: 'The table’s outcome, in a sentence.',
  low_morale: 'The table’s outcome, in a sentence.',
};

/**
 * The officer-check and persistent-producing events: Rivalry, Turncoat,
 * Theft, Double Agent and Low Morale, in base, Twice and repeated modes.
 * Inputs are the ones the engine reads for this mode; outcome lines come
 * from the engine's own changes, and a persistent event made by a Twice is
 * listed under the Twice that made it.
 */
export function recurringPanel(
  item: Item,
  eventType: EventRecurringFamily,
  context: EventPanelContext,
): RecurringPanel {
  const id = item.occurrence.eventId;
  const first = firstOccurrence(item, context);
  const carriedName = carriedNames(context);
  const parts = familyParts(item, eventType, context, first);
  return {
    family: 'recurring',
    eventType,
    teams: null,
    team: null,
    lossRoll: null,
    mitigation: null,
    check: null,
    checkRoll: undefined,
    unusedCheckRoll: false,
    officer: null,
    ...parts.inputs,
    sameWeek: sameWeekDecision(item, context),
    notes: [...twinNotes(item, eventType, context, first), ...parts.notes],
    whatHappened: whatHappened(item, context, acknowledgementHints[eventType]),
    outcomes: outcomeLines(ownChanges(item, context), context, carriedName),
    partial: item.requirements.some((code) => code.startsWith(`${id}:`)),
    retained: retainedFields(item.occurrence, parts.uses, context, carriedName),
    keep: { targets: [...parts.uses.targets], rolls: [...parts.uses.rolls] },
  };
}

type Parts = {
  inputs: Partial<RecurringPanel>;
  notes: string[];
  uses: EventFieldUse;
};

// Same-week persistent fields belong to the occurrence that became
// persistent; Event keeps them with their occurrence, never as unused.
const SAME_WEEK: EventFieldUse['fields'] = ['persistent', 'persistentDecision'];

function familyParts(
  item: Item,
  eventType: EventRecurringFamily,
  context: EventPanelContext,
  first: First,
): Parts {
  const twice = item.mode === 'twice';
  switch (eventType) {
    case 'rivalry':
      return rivalryParts(item, context, first);
    case 'turncoat':
      return twice
        ? turncoatTwiceParts(item, context)
        : turncoatParts(item, context);
    case 'theft':
      return twice
        ? {
            inputs: {},
            notes: [
              'Twice has no mitigation. Only a successful Reduce Danger in a later week ends this Theft.',
            ],
            uses: { targets: [], rolls: [], fields: SAME_WEEK },
          }
        : theftParts(item, context);
    default:
      return {
        inputs: {},
        notes: [],
        uses: { targets: [], rolls: [], fields: SAME_WEEK },
      };
  }
}

function rivalryParts(
  item: Item,
  context: EventPanelContext,
  first: First,
): Parts {
  const { has } = codes(item);
  const occurrence = item.occurrence;
  const teams = teamPair(
    item,
    context,
    first,
    has('teams') || has('same-teams'),
  );
  if (item.mode !== 'twice')
    return {
      inputs: { teams },
      notes: [],
      uses: { targets: ['team'], rolls: [], fields: SAME_WEEK },
    };
  const attempted = Boolean(occurrence.officerCheck);
  return {
    inputs: {
      teams,
      mitigation: {
        value: attempted ? 'attempted' : 'unattempted',
        explicit: attempted,
        attemptDescription: `An officer’s DC ${RIVALRY_OFFICER_DC} Bluff, Diplomacy or Intimidate check ends the Rivalry now.`,
        letDescription: 'No check; the Rivalry stays persistent.',
      },
      officer: officerCheckFacts(item, context, {
        label: 'Officer check',
        legend: `Bluff, Diplomacy or Intimidate DC ${RIVALRY_OFFICER_DC}`,
        dc: RIVALRY_OFFICER_DC,
        mandatory: false,
        officersOnly: true,
        expectedSkill: null,
        rollCode: 'rivalry:1d20',
        result: {
          success: 'Ends the Rivalry now.',
          failure: 'The Rivalry stays persistent.',
        },
      }),
    },
    notes: [],
    uses: {
      targets: ['team'],
      rolls: [],
      fields: [...SAME_WEEK, 'officerCheck'],
    },
  };
}

function turncoatParts(item: Item, context: EventPanelContext): Parts {
  const { has } = codes(item);
  return {
    inputs: {
      lossRoll: {
        label: 'Training loss roll',
        legend: `Rank ${rank(context)} is added by the rules`,
        spec: RULE_ROLL_SPECS.singleD6,
        recorded: item.occurrence.rolls?.loss,
        required: has('loss:1d6'),
      },
    },
    notes: [],
    uses: { targets: [], rolls: ['loss'], fields: SAME_WEEK },
  };
}

function turncoatTwiceParts(item: Item, context: EventPanelContext): Parts {
  const { has } = codes(item);
  const team = teamChoice({
    item,
    context,
    label: 'Team that defects',
    hint: 'The GM chooses one full team.',
    required: has('team'),
    describe: teamDescription(context, null),
  });
  const name = team.selected ? teamName(context, team.selected) : null;
  const dc = turncoatDiplomacyDc(rank(context));
  return {
    inputs: {
      team,
      officer: officerCheckFacts(item, context, {
        label: 'Diplomacy check',
        legend: `Diplomacy DC ${dc}`,
        dc,
        mandatory: true,
        officersOnly: false,
        expectedSkill: 'diplomacy',
        rollCode: 'diplomacy:1d20',
        result: {
          success: `${name ?? 'The team'} stays, but cannot act next Activity.`,
          failure: `${name ?? 'The team'} defects and is lost.`,
        },
      }),
    },
    notes: [],
    uses: {
      targets: ['team'],
      rolls: [],
      fields: [...SAME_WEEK, 'officerCheck'],
    },
  };
}

function theftParts(item: Item, context: EventPanelContext): Parts {
  const occurrence = item.occurrence;
  const roll = occurrence.rolls?.check;
  const attempted = eventMitigationAttempted(occurrence.mitigation, roll);
  const checkId = `${occurrence.eventId}:theft`;
  return {
    inputs: {
      mitigation: {
        value: attempted ? 'attempted' : 'unattempted',
        explicit: occurrence.mitigation !== undefined,
        attemptDescription: `Loyalty DC ${THEFT_LOYALTY_DC} to reduce the loss to 10%.`,
        letDescription: 'No check; the treasury is halved.',
      },
      check: attempted
        ? eventCheckFacts({
            checkId,
            check: 'loyalty',
            dc: THEFT_LOYALTY_DC,
            target: null,
            mandatory: false,
            projected: context.projection?.checks.find(
              (entry) => entry.checkId === checkId,
            ),
            requirements: item.requirements,
            recorded: roll,
            modifierLabel: context.modifierLabel,
            result: {
              success: 'The treasury loses only 10%.',
              failure: 'The treasury is halved.',
            },
          })
        : null,
      checkRoll: roll,
      unusedCheckRoll: !attempted && Boolean(roll),
    },
    notes: [],
    uses: {
      targets: [],
      rolls: ['check'],
      fields: [...SAME_WEEK, 'mitigation', 'overseerCharacterId'],
    },
  };
}

// Rivalry's two rival teams. Twice asks for the same two as its first.
function teamPair(
  item: Item,
  context: EventPanelContext,
  first: First,
  required: boolean,
): EventTeamPairChoice {
  const recorded = [
    ...new Set(
      item.occurrence.targets?.flatMap((target) =>
        target.kind === 'team' ? [target.teamId] : [],
      ) ?? [],
    ),
  ];
  const known = new Set(context.teams.map((team) => team.teamId));
  const selected = recorded.filter((teamId) => known.has(teamId)).slice(0, 2);
  const retained: EventRetainedTarget[] = recorded
    .filter((teamId) => !selected.includes(teamId))
    .map((teamId) =>
      known.has(teamId)
        ? {
            value: teamId,
            label: teamName(context, teamId) ?? 'A team',
            reason:
              'Only two teams are rivals. Choose them, or clear this one.',
          }
        : { value: teamId, ...MISSING_TEAM },
    );
  return {
    label: 'Rival teams',
    hint: first ? `The same two teams as ${first.label}.` : 'Two random teams.',
    required,
    selected,
    choices: teamCards(context, teamDescription(context, first)),
    retained,
  };
}

/**
 * The rival teams to record after pressing one card: a pressed team leaves,
 * another joins, and a third pick drops the earliest so two remain.
 */
export function pressTeamPair(pair: EventTeamPairChoice, value: string) {
  if (pair.selected.includes(value))
    return pair.selected.filter((entry) => entry !== value);
  return [...pair.selected, value].slice(-2);
}

/** The recorded teams without one, kept or no longer known. */
export function teamPairWithout(pair: EventTeamPairChoice, value: string) {
  return [
    ...pair.selected,
    ...pair.retained.map((entry) => entry.value),
  ].filter((entry) => entry !== value);
}

type OfficerSpec = {
  label: string;
  legend: string;
  dc: number;
  mandatory: boolean;
  // Rivalry: only an officer ends it. Turncoat: anyone, with a Rules
  // Exception for a non-officer.
  officersOnly: boolean;
  expectedSkill: RivalrySkill | null;
  // The requirement code of the missing die, after `<eventId>:`.
  rollCode: string;
  result: { success: string; failure: string };
};

// The characters offered for an officer check, officers first, and a
// recorded character the offer does not include, kept until replaced.
function officerChoices(
  context: EventPanelContext,
  officersOnly: boolean,
  recordedId: string | null,
) {
  const militia = context.activity?.outcome ?? context.projection?.outcome;
  // A blank recorded name reads as unnamed too.
  const name = (characterId: string) => {
    const recorded = context.personName(characterId)?.trim() ?? '';
    return recorded === '' ? 'Unnamed character' : recorded;
  };
  const candidates = militia ? officerCandidateFacts(militia) : [];
  const characters = candidates
    .filter((character) => !officersOnly || character.roles.length > 0)
    .map((character) => ({
      value: character.characterId,
      label: name(character.characterId),
      description: [
        character.roles.length
          ? character.roles.join(', ')
          : 'Not an officer · needs a Rules Exception',
        ...(character.archived ? ['archived'] : []),
      ].join(' · '),
      officer: character.roles.length > 0,
    }))
    .sort((a, b) => Number(b.officer) - Number(a.officer));
  if (!recordedId || characters.some((entry) => entry.value === recordedId))
    return { characters, retainedCharacter: null };
  const isKnown = candidates.some(
    (character) => character.characterId === recordedId,
  );
  const retainedCharacter: EventRetainedTarget = isKnown
    ? {
        value: recordedId,
        label: name(recordedId),
        reason:
          'Not an officer: only an officer can make this check. Choose an officer.',
      }
    : {
        value: recordedId,
        label: 'Unavailable character',
        reason: 'No longer in the militia. Choose another character.',
      };
  return { characters, retainedCharacter };
}

// The skill bonus and entered modifiers, as the engine adds them.
function officerArithmetic(input: Item['occurrence']['officerCheck']) {
  const skillBonus = input?.skillBonus ?? null;
  if (skillBonus === null) return { skillBonus, modifier: null, breakdown: [] };
  const extras = eventOfficerCheckExtras(input?.roll);
  return {
    skillBonus,
    modifier: skillBonus + extras.reduce((sum, extra) => sum + extra.value, 0),
    breakdown: [
      { source: 'skill-bonus', label: 'Skill bonus', value: skillBonus },
      ...extras.map((extra) => ({
        source: extra.source,
        label: extra.reason,
        value: extra.value,
      })),
    ],
  };
}

// The Rules Exceptions a Turncoat check asks for, named beside it.
function officerNotes(item: Item, expectedSkill: RivalrySkill | null) {
  const id = item.occurrence.eventId;
  const warnings = new Set(item.warnings);
  const skill = expectedSkill
    ? rivalrySkillLabels[expectedSkill]
    : 'the named skill';
  return [
    ...(warnings.has(`${id}:officer`)
      ? ['Not an officer: this check needs a Rules Exception, recorded below.']
      : []),
    ...(warnings.has(`${id}:officer-skill`)
      ? [`Not ${skill}: this check needs a Rules Exception, recorded below.`]
      : []),
  ];
}

function officerCheckFacts(
  item: Item,
  context: EventPanelContext,
  spec: OfficerSpec,
): EventOfficerCheckFacts {
  const { has } = codes(item);
  const input = item.occurrence.officerCheck;
  const recordedId = input?.characterId ?? null;
  const arithmetic = officerArithmetic(input);
  const change = item.changes.find(
    (entry) => entry.kind === 'event_officer_check',
  );
  const result = change?.kind === 'event_officer_check' ? change : null;
  const notes = officerNotes(item, spec.expectedSkill);
  const complete = Boolean(input?.roll) && arithmetic.skillBonus !== null;
  let resultText: string | null = null;
  if (result)
    resultText = result.succeeded ? spec.result.success : spec.result.failure;
  return {
    label: spec.label,
    legend: spec.legend,
    mandatory: spec.mandatory,
    dc: result?.dc ?? spec.dc,
    characterId: recordedId,
    ...officerChoices(context, spec.officersOnly, recordedId),
    skill: input?.skill ?? null,
    expectedSkill: spec.expectedSkill,
    ...arithmetic,
    recorded: input?.roll,
    spec: RULE_ROLL_SPECS.check,
    total: result?.total ?? null,
    succeeded: result?.succeeded ?? null,
    resultText,
    waiting:
      !result && complete
        ? 'The result follows once this event’s other inputs are in.'
        : null,
    required: {
      // `officer` is a warning, not a missing input, once a non-officer
      // waits for its Rules Exception.
      character:
        has('officer-check') ||
        (has('officer') &&
          !item.warnings.includes(`${item.occurrence.eventId}:officer`)),
      skillBonus: has('skill-bonus'),
      roll: has(spec.rollCode),
    },
    notes,
  };
}

// A persistent event made by a Twice is listed under the Twice that made
// it, not under its first occurrence whose identity it carries.
function madeByTwice(
  change: Item['changes'][number],
): change is Extract<Item['changes'][number], { kind: 'event_persistent' }> {
  return (
    change.kind === 'event_persistent' &&
    (change.event.sourceEventIds ?? []).some((id) => id !== change.eventId)
  );
}

function ownChanges(item: Item, context: EventPanelContext) {
  const id = item.occurrence.eventId;
  const plan = context.projection?.plan;
  if (!plan) return item.changes;
  return plan.filter((change) =>
    madeByTwice(change)
      ? change.eventId !== id &&
        (change.event.sourceEventIds ?? []).includes(id)
      : change.eventId === id,
  );
}

// How a first occurrence and its Twice divide the effect. Rivalry, Double
// Agent and Low Morale become persistent in place of their one-week effect;
// Theft keeps the first's treasury loss and becomes persistent; Turncoat
// keeps the first's training loss and asks the Twice about a defection.
const twiceWords: Record<
  EventRecurringFamily,
  { twice: string; first: string }
> = {
  rivalry: {
    twice: 'the Rivalry becomes persistent instead of lasting one week',
    first: 'the Rivalry becomes persistent there instead of lasting one week',
  },
  double_agent: {
    twice: 'Double Agent becomes persistent instead of lasting one week',
    first: 'Double Agent becomes persistent there instead of lasting one week',
  },
  low_morale: {
    twice: 'Low Morale becomes persistent instead of lasting one week',
    first: 'Low Morale becomes persistent there instead of lasting one week',
  },
  theft: {
    twice: 'its treasury loss still applies, and the Theft becomes persistent',
    first: 'this Theft also becomes persistent, listed there',
  },
  turncoat: {
    twice:
      'its training loss still applies, and this one decides whether a team defects',
    first: 'whether a team defects is decided there',
  },
};

function twinNotes(
  item: Item,
  eventType: EventRecurringFamily,
  context: EventPanelContext,
  first: First,
) {
  const id = item.occurrence.eventId;
  if (first && item.mode === 'twice')
    return [`Twice with ${first.label}: ${twiceWords[eventType].twice}.`];
  const twins = (context.projection?.dispatch ?? []).filter(
    (entry) =>
      entry.firstEventId === id &&
      entry.event.eventId !== id &&
      entry.mode === 'twice',
  );
  if (!twins.length) return [];
  const labels = twins
    .map((entry) => context.eventLabel(entry.event.eventId))
    .join(', ');
  return [`Twice in ${labels}: ${twiceWords[eventType].first}.`];
}

const decisionWords: Record<Decision['kind'], string> = {
  unattempted: 'Let it happen',
  mitigate: 'Check',
  buyoff: 'Buyoff',
  end: 'Ending',
};

// A same-week persistent decision recorded on this occurrence.
function sameWeekDecision(
  item: Item,
  context: EventPanelContext,
): EventSameWeekDecision | null {
  const decision = item.occurrence.persistentDecision;
  if (!decision) return null;
  const id = item.occurrence.eventId;
  const detail =
    decision.kind === 'mitigate'
      ? [
          ...(decision.rolls?.check ? ['Loyalty check roll recorded'] : []),
          ...(decision.officerCheck
            ? [
                `${context.personName(decision.officerCheck.characterId) ?? 'An officer'} · ${rivalrySkillLabels[decision.officerCheck.skill]}`,
              ]
            : []),
        ]
      : decision.kind === 'end'
        ? [decision.acknowledgement.outcome]
        : [];
  return {
    value: [decisionWords[decision.kind], ...detail].join(' · '),
    used: (context.projection?.plan ?? []).some(
      (change) =>
        change.kind === 'event_persistent' && change.event.eventId === id,
    ),
  };
}

/**
 * Event-identified wording for a code of one of these events; null leaves
 * it to the general wording. `tail` is the code after `<eventId>:`.
 */
export function recurringPanelMessage(
  panel: RecurringPanel,
  tail: string,
  warning: boolean,
): string | null {
  const officer = panel.officer;
  switch (tail) {
    case 'teams':
      return 'choose the two rival teams.';
    case 'same-teams':
      return `choose the rival teams. ${panel.teams?.hint ?? ''}`.trim();
    case 'team':
      return 'choose the team that defects.';
    case 'loss:1d6':
      return 'enter the training loss roll (d6).';
    case 'theft:1d20':
      return 'enter the Loyalty check (d20).';
    case 'officer-check':
      return `choose the officer who makes the ${officer?.label ?? 'officer check'}.`;
    case 'officer':
      return warning
        ? 'the officer check is made by someone who is not an officer.'
        : panel.eventType === 'rivalry'
          ? 'choose an officer for the officer check.'
          : 'choose a character in the militia for the Diplomacy check.';
    case 'officer:exception':
      return 'the Diplomacy check is made by someone who is not an officer. Record a reasoned Rules Exception or choose an officer.';
    case 'officer-skill':
      return 'the officer check does not use Diplomacy.';
    case 'officer-skill:exception':
      return 'the officer check does not use Diplomacy. Record a reasoned Rules Exception or choose Diplomacy.';
    case 'skill-bonus':
      return 'enter the officer’s skill bonus.';
    case 'rivalry:1d20':
      return 'enter the officer check (d20).';
    case 'diplomacy:1d20':
      return 'enter the Diplomacy check (d20).';
    default:
      return null;
  }
}
