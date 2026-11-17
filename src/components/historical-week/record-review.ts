import {
  appendNote,
  applyPlan,
  createOutcomes,
  newItem,
  reviewItem,
  type AssemblyItem as Item,
  type Outcomes,
} from '~/components/week-review/review-assembly';
import {
  choiceSubject,
  describeAdjustment,
  describeRecordedChange,
  describeSabotage,
  eventSubject,
  phaseChips,
  sabotageSubject,
  teamSubject,
  transferSubject,
  type PlanAcknowledgement,
  type PlanChange,
} from '~/components/week-review/review-changes';
import { compareWeekStates } from '~/components/week-review/review-comparison';
import type {
  ReviewNote,
  ReviewPhase,
  ReviewSection,
  WeekReviewFacts,
} from '~/components/week-review/review-facts';
import {
  findOwner,
  isAppliedAdjustment,
} from '~/components/week-review/review-notes';
import {
  gp,
  rollText,
  words,
  type ReviewNames,
} from '~/components/week-review/review-text';
import type { CanonicalResolutionRecord } from '~/lib/canonical-resolution-record';
import { COMPUTED_HIT_DICE_RULESET_VERSION } from '~/lib/ruleset-versions';
import type { RawRoll } from '~/lib/weekly-draft-facts';
import { activityLabel } from '../weekly-draft-workspace/activity-labels';
import { summaryMessage } from '../weekly-draft-workspace/summary-messages';
import { readRecordedWeek, type RecordedWeek } from './record-artifacts';
import {
  isInForce,
  recordedEventTree,
  type RecordedOccurrence,
} from './record-event-tree';
import { orderCarried, recordNames, type RecordNames } from './record-names';

// Frozen adapter for the shared six-section presentation: one immutable
// Resolution Record in, renderable facts out. It reads only that record's
// source, source militia, stored plans and outcome, adjudication, warnings
// and successor context, with record-local names. It never resolves rules,
// reads today's militia, officers or characters, or offers an edit.

type ResolutionRecord = CanonicalResolutionRecord;
type Source = ResolutionRecord['source'];
type ItemsByPhase = Record<ReviewPhase, Item[]>;
type Review = {
  record: ResolutionRecord;
  week: RecordedWeek;
  tree: RecordedOccurrence[];
  names: RecordNames;
  items: ItemsByPhase;
  unassociated: ReviewNote[];
};

const phaseOrder = ['upkeep', 'activity', 'event', 'persistent'] as const;
const titles: Record<ReviewPhase, string> = {
  upkeep: 'Upkeep',
  activity: 'Activity',
  event: 'Event',
  persistent: 'Persistent',
};
const emptyText: Record<ReviewPhase, string> = {
  upkeep: 'No Upkeep consequences this week.',
  activity: 'No actions were chosen this Activity.',
  event: 'No event consequences this week.',
  persistent: 'No persistent event consequences this week.',
};
function rollLine(label: string, roll: RawRoll | undefined) {
  return roll ? [`${label}: ${rollText(roll)}`] : [];
}
function withDetails(entry: Item, details: string[]) {
  entry.details.push(...details);
  return entry;
}

// ── Upkeep ────────────────────────────────────────────────────────────────

const decisionLines: Record<string, string> = {
  recover: 'Recover',
  leave: 'Left disabled',
};

/**
 * Recorded team decisions in roster order, as the rules run them. With the
 * roster at confirmation, a decision retained for a team that was neither
 * disabled nor missing had no part in the week and is left out.
 */
function upkeepTeamItems(review: Review) {
  const { upkeep } = review.record.source;
  const roster = review.week.atConfirmation.militiaSnapshot?.roster.teams;
  const rank = (teamId: string) => {
    const index = roster?.findIndex((team) => team.teamId === teamId) ?? -1;
    return index < 0 ? Infinity : index;
  };
  const isUnavailableTeam = (teamId: string) =>
    !roster ||
    roster.some((team) => team.teamId === teamId && team.status !== 'active');
  return upkeep.teamDecisions
    .filter((decision) => isUnavailableTeam(decision.teamId))
    .sort((a, b) => rank(a.teamId) - rank(b.teamId))
    .map((decision) =>
      withDetails(
        newItem(
          teamSubject(decision.teamId),
          review.names.team(decision.teamId),
          [decision.teamId, teamSubject(decision.teamId)],
        ),
        [
          `${decisionLines[decision.decision] ?? words(decision.decision)}${
            decision.costCopper === undefined
              ? ''
              : ` · recorded cost ${gp(decision.costCopper)}`
          }`,
          ...rollLine('Return roll', decision.roll),
        ],
      ),
    );
}

/**
 * The Upkeep steps with their recorded rolls. Where the Upkeep plan is
 * recorded, a step it never ran keeps no line even if a roll was retained.
 */
function upkeepStepItems(review: Review) {
  const { upkeep } = review.record.source;
  const plan = review.week.plans.upkeep;
  const hasRun = (key: string) =>
    !plan || plan.some((change) => 'step' in change && change.step === key);
  const step = (key: string, title: string, details: string[]) =>
    details.length && hasRun(key)
      ? [
          withDetails(
            newItem(`upkeep:${key}`, title, [
              `upkeep:${key}`,
              `upkeep:${key}-training`,
            ]),
            details,
          ),
        ]
      : [];
  return [
    ...step('attrition', 'Training attrition', [
      ...rollLine('Loyalty check roll', upkeep.rolls.check),
      ...rollLine('Training loss roll', upkeep.rolls.training),
    ]),
    ...step('notoriety', 'Notoriety', [
      ...rollLine('Training loss roll', upkeep.rolls.notoriety),
      ...rollLine('Loyalty check roll', upkeep.notorietyCheck),
      ...(upkeep.nearestSettlementId
        ? [
            `Nearest settlement ${review.names.settlement(upkeep.nearestSettlementId)}`,
          ]
        : []),
    ]),
    ...step('shortage', 'Treasury shortage', [
      ...rollLine('Training loss roll', upkeep.rolls.loss),
    ]),
  ];
}

function rankItem(review: Review) {
  const changed = (review.week.plans.upkeep ?? []).some(
    (change) => change.kind === 'rank',
  );
  const rank = review.week.atConfirmation.militiaSnapshot?.rank;
  if (!changed && rank === undefined) return [];
  const entry = newItem('upkeep:rank', 'Rank', ['upkeep:rank', 'rank']);
  if (!changed) entry.details.push(`Rank stays ${rank}`);
  return [entry];
}

function transferItems(review: Review) {
  return review.record.source.upkeep.treasuryTransfers.map((transfer) => {
    const kind = transfer.direction === 'deposit' ? 'deposit' : 'withdrawal';
    return newItem(transferSubject(transfer.transferId), `Treasury ${kind}`, [
      transfer.transferId,
      transferSubject(transfer.transferId),
    ]);
  });
}

function upkeepItems(review: Review): Item[] {
  if (review.record.source.context.firstMilitiaWeek) return [];
  return [
    ...upkeepTeamItems(review),
    ...upkeepStepItems(review),
    ...rankItem(review),
    ...transferItems(review),
  ];
}

/** A transfer the plan does not explain keeps its recorded amount. */
function addTransferAmounts(review: Review, items: Item[]) {
  for (const transfer of review.record.source.upkeep.treasuryTransfers) {
    const entry = items.find(
      (item) => item.key === transferSubject(transfer.transferId),
    );
    if (entry?.effects.length === 0 && entry.details.length === 0)
      entry.details.push(`Recorded amount ${gp(transfer.copper)}`);
  }
}

// ── Activity ──────────────────────────────────────────────────────────────

type Choice = NonNullable<Source['activity']['slots'][number]['choice']>;

function choiceSubjects(choice: Choice) {
  return [
    choice.choiceId,
    ...('orderId' in choice && typeof choice.orderId === 'string'
      ? [choice.orderId]
      : []),
    // Market and order outcomes are acknowledged per offered item.
    ...('purchases' in choice
      ? (choice.purchases ?? []).map((p) => `availability:${p.itemId}`)
      : []),
    ...('itemId' in choice && typeof choice.itemId === 'string'
      ? [`availability:${choice.itemId}`]
      : []),
  ];
}

const choiceRolls: Record<string, string> = {
  check: 'Check roll',
  notoriety: 'Notoriety roll',
  training: 'Training roll',
  delivery: 'Delivery roll',
};

function activityItems(review: Review): Item[] {
  const { names } = review;
  return review.record.source.activity.slots.flatMap((slot, index) => {
    const choice = slot.choice;
    if (!choice) return [];
    const team = choice.teamId ? ` · ${names.team(choice.teamId)}` : '';
    const rolls: Partial<Record<string, RawRoll>> =
      'rolls' in choice ? (choice.rolls ?? {}) : {};
    return [
      withDetails(
        newItem(
          choiceSubject(choice.choiceId),
          `Slot ${index + 1} · ${activityLabel(choice.actionId)}${team}`,
          choiceSubjects(choice),
        ),
        [
          ...Object.entries(choiceRolls).flatMap(([field, label]) =>
            rollLine(label, rolls[field]),
          ),
          ...(choice.costCopper === undefined
            ? []
            : [`Recorded cost ${gp(choice.costCopper)}`]),
        ],
      ),
    ];
  });
}

// ── Event ─────────────────────────────────────────────────────────────────

/** The chance step exactly as recorded; no chance is recalculated. */
function chanceItem(review: Review, isGuaranteed: boolean) {
  const { source } = review.record;
  const entry = newItem('event:chance', 'Event chance', ['event:chance']);
  if (isInForce(source, 'all_is_calm'))
    entry.details.push('All Is Calm made this a calm week');
  else if (isGuaranteed) entry.details.push('An event was guaranteed');
  entry.details.push(
    ...rollLine('Chance roll', source.event.chanceRoll),
    ...(source.activity.operatingSettlementId
      ? [
          `Operating from ${review.names.settlement(source.activity.operatingSettlementId)}`,
        ]
      : []),
  );
  if (entry.details.length === 0) entry.details.push('No chance roll recorded');
  return entry;
}

function occurrenceDetails(
  review: Review,
  { occurrence, owner }: RecordedOccurrence,
) {
  const label = (id: string) =>
    review.tree.find((entry) => entry.occurrence.eventId === id)?.label ??
    'an earlier event';
  const { origin } = occurrence;
  const selected =
    owner && 'selectedEventId' in owner ? owner.selectedEventId : undefined;
  return [
    ...('parentEventId' in origin
      ? [
          `${origin.kind === 'roll_twice' ? 'Rolled twice from' : 'Replaces'} ${label(origin.parentEventId)}`,
        ]
      : []),
    ...(owner ? [`From ${activityLabel(owner.actionId)}`] : []),
    ...(owner && origin.kind === 'rolled' && selected
      ? [selected === occurrence.eventId ? 'Chosen' : 'Not chosen']
      : []),
    ...rollLine('Table roll', occurrence.tableRoll),
    ...(occurrence.persistentDecision
      ? [`Decision: ${words(occurrence.persistentDecision.kind)}`]
      : []),
  ];
}

function sabotageItem(
  review: Review,
  entry: RecordedOccurrence,
  title: string,
) {
  const { occurrence } = entry;
  const reactive = occurrence.sabotage;
  if (!reactive) return [];
  const subject = sabotageSubject({
    eventId: occurrence.eventId,
    choiceId: reactive.choiceId,
  });
  const item = newItem(subject, `${title} · Sabotage`, [
    subject,
    reactive.choiceId,
  ]);
  const fact = review.week.sabotage.find(
    (s) => s.eventId === occurrence.eventId && s.choiceId === reactive.choiceId,
  );
  if (!fact) {
    item.details.push('Sabotage result not recorded');
    return [item];
  }
  const described = describeSabotage(fact);
  item.details.push(described.detail);
  item.effects.push(
    ...described.effects.map((text, i) => ({
      key: `${subject}:effect:${i}`,
      text,
    })),
  );
  return [item];
}

function eventItems(review: Review, isGuaranteed: boolean): Item[] {
  return [
    chanceItem(review, isGuaranteed),
    ...review.tree.flatMap((entry) => {
      const { occurrence } = entry;
      const title = review.names.event(occurrence.eventId);
      const item = withDetails(
        newItem(eventSubject(occurrence.eventId), title, [
          occurrence.eventId,
          eventSubject(occurrence.eventId),
          ...(occurrence.rewards ?? []).map((reward) => reward.itemId),
        ]),
        occurrenceDetails(review, entry),
      );
      return [item, ...sabotageItem(review, entry, title)];
    }),
  ];
}

// ── Persistent ────────────────────────────────────────────────────────────

type Target = Source['context']['carriedEvents'][number]['targets'][number];
function targetName(target: Target, names: ReviewNames) {
  switch (target.kind) {
    case 'team':
      return names.team(target.teamId);
    case 'settlement':
      return names.settlement(target.settlementId);
    case 'character':
      return names.character(target.characterId);
    case 'cache':
      return names.cache(target.cacheId);
    default:
      return 'Recorded target';
  }
}

type Decision = Source['persistent']['decisions'][number];
function decisionDetails(decision: Decision | undefined) {
  if (!decision) return ['No decision recorded'];
  return [
    `Decision: ${words(decision.kind)}`,
    ...(decision.kind === 'mitigate'
      ? [
          ...rollLine('Mitigation roll', decision.rolls?.check),
          ...rollLine('Officer check roll', decision.officerCheck?.roll),
        ]
      : []),
  ];
}

function persistentItems(review: Review): Item[] {
  const { source } = review.record;
  return orderCarried(source.context.carriedEvents).map((event) => {
    const targets = event.targets.map((target) =>
      targetName(target, review.names),
    );
    return withDetails(
      newItem(eventSubject(event.eventId), review.names.event(event.eventId), [
        event.eventId,
        eventSubject(event.eventId),
      ]),
      [
        ...(targets.length ? [`Affects ${targets.join(', ')}`] : []),
        ...decisionDetails(
          source.persistent.decisions.find(
            (entry) => entry.eventId === event.eventId,
          ),
        ),
      ],
    );
  });
}

// ── Assembly and placement ────────────────────────────────────────────────

function guaranteedChoices(week: RecordedWeek) {
  return new Set(
    (week.plans.activity ?? []).flatMap((change) =>
      change.kind === 'event_guarantee' ? [change.choiceId] : [],
    ),
  );
}

function phaseItems(review: Review, outcomes: Outcomes): ItemsByPhase {
  const isGuaranteed = guaranteedChoices(review.week).size > 0;
  const skeletons: ItemsByPhase = {
    upkeep: upkeepItems(review),
    activity: activityItems(review),
    event: eventItems(review, isGuaranteed),
    persistent: persistentItems(review),
  };
  // Safe cast: built from every phase in phaseOrder.
  const items = Object.fromEntries(
    phaseOrder.map((phase) => [
      phase,
      applyPlan(
        phase,
        skeletons[phase],
        review.week.plans[phase] ?? [],
        review.names,
        outcomes,
        describeRecordedChange,
      ),
    ]),
  ) as ItemsByPhase;
  addTransferAmounts(review, items.upkeep);
  return items;
}

/** Acknowledgements recorded on a choice, Sabotage or decision, by owner key. */
function recordedOutcomes(review: Review) {
  const { source } = review.record;
  const ends = (decision: Decision | undefined): PlanAcknowledgement[] =>
    decision?.kind === 'end' ? [decision.acknowledgement] : [];
  return [
    ...review.week.sabotage.map((fact) => ({
      key: sabotageSubject(fact),
      acks: fact.acknowledgement ? [fact.acknowledgement] : [],
    })),
    ...source.activity.slots.flatMap((slot) =>
      slot.choice
        ? [
            {
              key: choiceSubject(slot.choice.choiceId),
              acks: slot.choice.acknowledgements ?? [],
            },
          ]
        : [],
    ),
    ...review.tree.map(({ occurrence }) => ({
      key: eventSubject(occurrence.eventId),
      acks: ends(occurrence.persistentDecision),
    })),
    ...source.persistent.decisions.map((decision) => ({
      key: eventSubject(decision.eventId),
      acks: ends(decision),
    })),
  ];
}

function allItems(review: Review) {
  return Object.values(review.items).flat();
}

/** A readable name for a recorded subject, from this record's items. */
function findSubjectName(review: Review, subjectId: string) {
  return (
    findOwner(subjectId, allItems(review))?.title ??
    review.names.findEvent(subjectId)
  );
}

function placeOutcomes(review: Review, outcomes: Outcomes) {
  const all = allItems(review);
  for (const { key, acks } of recordedOutcomes(review)) {
    const target = all.find((entry) => entry.key === key);
    if (target) for (const ack of acks) outcomes.place(target, ack);
  }
  for (const ack of review.record.adjudication.acknowledgements) {
    if (outcomes.isPlaced(ack)) continue;
    const owner = findOwner(ack.subjectId, all);
    if (owner) {
      outcomes.place(owner, ack);
      continue;
    }
    const note = outcomes.placeUnlinked(
      ack,
      findSubjectName(review, ack.subjectId) ?? 'Table outcome',
    );
    if (note) review.unassociated.push(note);
  }
}

/** The phase a recorded subject or code names by its known prefixes. */
function recordedPhase(subjectOrCode: string, ruleId?: string) {
  const [prefix] = subjectOrCode.split(':');
  if (prefix === 'upkeep' || prefix === 'rank' || ruleId?.startsWith('upkeep-'))
    return 'upkeep';
  if (ruleId === 'action-capacity') return 'activity';
  if (prefix === 'event') return 'event';
  if (prefix === 'persistent') return 'persistent';
  return null;
}

function placeExceptions(review: Review) {
  for (const exception of review.record.adjudication.rulesExceptions) {
    // A recorded reason is quoted as it stood; history offers no repair.
    const note: ReviewNote = {
      kind: 'exception',
      key: `exception:${exception.exceptionId}`,
      exceptionId: exception.exceptionId,
      subjectId: exception.subjectId,
      ruleId: exception.ruleId,
      rule: activityLabel(exception.ruleId.replaceAll('-', '_')),
      reason: exception.reason,
      obsolete: false,
    };
    const owner = findOwner(exception.subjectId, allItems(review));
    if (owner) {
      owner.notes.push(note);
      continue;
    }
    const phase = recordedPhase(exception.subjectId, exception.ruleId);
    if (!phase) {
      review.unassociated.push(note);
      continue;
    }
    const orphan = newItem(
      `missing:${exception.exceptionId}`,
      findSubjectName(review, exception.subjectId) ?? 'Table ruling',
    );
    orphan.missing = true;
    orphan.notes.push(note);
    review.items[phase].push(orphan);
  }
}

function warningText(review: Review, code: string) {
  const isWarning = true;
  return summaryMessage(
    code,
    {
      adjustments: review.record.adjudication.tableAdjustments,
      options: {
        subjectId: allItems(review).flatMap((item) =>
          item.subjects.map((value) => ({ value, label: item.title })),
        ),
      },
    },
    isWarning,
  );
}

/**
 * Every recorded warning appears once: under its item, adjustment or phase.
 * An applied adjustment's own code is not a warning; its row quotes it.
 */
function placeWarnings(review: Review) {
  const byAdjustment = new Map<string, ReviewNote[]>();
  const general: Partial<Record<ReviewPhase, Item>> = {};
  const all = allItems(review);
  // Each warning's message is its full code; `code` holds only its first
  // segment.
  review.record.warnings.forEach(({ message: subject }, index) => {
    const adjustments = review.record.adjudication.tableAdjustments;
    if (isAppliedAdjustment(subject, adjustments)) return;
    const note: ReviewNote = {
      kind: 'warning',
      key: `warning:${index}`,
      message: warningText(review, subject),
    };
    const adjustment = review.record.adjudication.tableAdjustments.find(
      (entry) => subject.startsWith(`adjustment:${entry.adjustmentId}:`),
    );
    if (adjustment) {
      appendNote(byAdjustment, adjustment.adjustmentId, note);
      return;
    }
    const owner = findOwner(subject, all);
    if (owner) {
      owner.notes.push(note);
      return;
    }
    const phase = recordedPhase(subject);
    if (!phase) {
      review.unassociated.push(note);
      return;
    }
    general[phase] ??= newItem(
      `general:${phase}`,
      `Other ${titles[phase]} warnings`,
    );
    general[phase].notes.push(note);
  });
  for (const phase of phaseOrder) {
    const entry = general[phase];
    if (entry) review.items[phase].push(entry);
  }
  return byAdjustment;
}

// ── Sections, adjustments and Result ──────────────────────────────────────

function sectionChips(phase: ReviewPhase, review: Review) {
  const plan = review.week.plans[phase];
  if (!plan) return [];
  try {
    return phaseChips(
      phase,
      // Safe cast: stored plan entries keep the PlanChange shapes they were
      // recorded with; phaseChips is guarded by the try.
      plan as readonly PlanChange[],
      phase === 'event' ? review.week.sabotage : [],
    );
  } catch {
    // An older entry shape cannot be totalled; its lines remain readable.
    return [];
  }
}

function sectionStatus(
  phase: ReviewPhase,
  count: number,
  review: Review,
): Pick<ReviewSection, 'status' | 'statusText'> {
  const { context } = review.record.source;
  if (phase === 'upkeep' && context.firstMilitiaWeek && count === 0)
    return {
      status: 'not-applicable',
      statusText: 'Upkeep is skipped in the militia’s first week.',
    };
  if (phase === 'persistent' && context.carriedEvents.length === 0 && !count)
    return {
      status: 'not-applicable',
      statusText: 'No persistent events carried into this week.',
    };
  if (count === 0) return { status: 'empty', statusText: emptyText[phase] };
  return { status: 'complete', statusText: null };
}

function sectionFacts(
  phase: ReviewPhase,
  number: ReviewSection['number'],
  review: Review,
): ReviewSection {
  const items = review.items[phase].map(reviewItem);
  return {
    phase,
    number,
    title: titles[phase],
    chips: sectionChips(phase, review),
    items,
    ...sectionStatus(phase, items.length, review),
  };
}

export function recordWeekReview(
  record: CanonicalResolutionRecord,
): WeekReviewFacts {
  const week = readRecordedWeek(record);
  const tree = recordedEventTree(record.source, guaranteedChoices(week));
  const names = recordNames(record, tree);
  const outcomes = createOutcomes();
  const review: Review = {
    record,
    week,
    tree,
    names,
    items: { upkeep: [], activity: [], event: [], persistent: [] },
    unassociated: [],
  };
  review.items = phaseItems(review, outcomes);
  placeOutcomes(review, outcomes);
  placeExceptions(review);
  const adjustmentNotes = placeWarnings(review);
  return {
    mode: 'record',
    sections: [
      sectionFacts('upkeep', 1, review),
      sectionFacts('activity', 2, review),
      sectionFacts('event', 3, review),
      sectionFacts('persistent', 4, review),
    ],
    unassociated: review.unassociated,
    adjustments: record.adjudication.tableAdjustments.map(
      (adjustment, index) => ({
        key: `adjustment:${adjustment.adjustmentId}`,
        adjustmentId: adjustment.adjustmentId,
        number: index + 1,
        ...describeAdjustment(adjustment, names),
        reason: adjustment.reason,
        notes: adjustmentNotes.get(adjustment.adjustmentId) ?? [],
      }),
    ),
    result: {
      nextWeek: week.nextWeek,
      complete: week.complete,
      rows: compareWeekStates({
        now: week.atConfirmation,
        baseline: week.baseline,
        final: week.final,
        names,
        unrecorded: 'Not recorded',
        includeRacialHitDice:
          record.rulesetVersion >= COMPUTED_HIT_DICE_RULESET_VERSION,
      }),
    },
  };
}
