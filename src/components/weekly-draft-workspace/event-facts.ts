import {
  draftSourceReviewRequirements,
  draftReviewRequirement,
} from '~/lib/weekly-draft-review';
import { eventMitigationInput } from '~/lib/rules-event-checks';
import { normalizeRawRoll } from '~/lib/raw-roll';
import { RULE_ROLL_SPECS } from '~/lib/rules-roll-spec';
import { projectSettlements } from '~/lib/rules-settlements';
import {
  isCandidateChoice,
  isSurplusEventOccurrence,
  planEventTopology,
  removableEventOccurrence,
  uniquePositions,
} from '~/lib/event-occurrence-preparation';
import { actionChoiceEvents } from '~/lib/weekly-draft-facts';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import type { WorkspaceSource } from '~/lib/weekly-workspace-source';
import type { CanonicalResolutionPreview } from '~/lib/canonical-weekly-resolution';
import { activityView, checkModifierLabel } from './activity-facts';
import { withoutDuplicateRollCodes } from './roll-requirements';
import { eventSabotageFacts } from './event-sabotage-facts';
import { overseerSupportFacts } from './overseer-support-facts';
import { eventPanel, eventPanelMessage } from './event-target-facts';
import type { EventPanelContext } from './event-panel-context';
import { activityReferenceOptions } from './activity-input-options';
import { uneventfulCarryText } from './event-outcome-facts';
import { activityLabel } from './activity-labels';
import { eventRequirement, eventTopologyMessage } from './event-messages';
import {
  eventName,
  eventTableFacts,
  eventTraceFacts,
  eventTreeBlocks,
  type LocatedEvent,
  type Repair,
} from './event-tree-facts';
import type {
  EventCandidateSet,
  EventChanceStep,
  EventOccurrenceFacts,
  EventView,
} from './types';

type Event = WeeklyDraft['event']['occurrences'][number];

// What the Workspace knows beyond the draft: which occurrences the accepted
// draft already holds, and whether preparing the missing ones has failed.
export type EventPreparationContext = {
  acceptedEventIds: ReadonlySet<string> | null;
  preparationFailed: boolean;
};

export function eventView(
  draft: WeeklyDraft,
  source: WorkspaceSource,
  preview: CanonicalResolutionPreview,
  context: EventPreparationContext = {
    acceptedEventIds: null,
    preparationFailed: false,
  },
): EventView {
  const currentReviewCodes = new Set(
    [
      ...draft.event.occurrences,
      ...draft.activity.slots.flatMap((slot) =>
        actionChoiceEvents(slot.choice),
      ),
    ].map((event) =>
      draftReviewRequirement({ kind: 'event', eventId: event.eventId }),
    ),
  );
  const reviewRequirements = draftSourceReviewRequirements(draft).filter(
    (code) => currentReviewCodes.has(code),
  );
  const projected = preview.phases?.event;
  const projection = projected
    ? {
        ...projected,
        ready: projected.ready && reviewRequirements.length === 0,
        requirements: [
          ...new Set([...projected.requirements, ...reviewRequirements]),
        ],
      }
    : projected;
  const activity = preview.phases?.activity;
  const positions = uniquePositions(projection?.positions ?? []);
  // Missing required positions show as stable blanks before they are saved.
  const plan = planEventTopology(draft, positions);
  const activityFacts = activityView(draft, source, preview);
  const references = activityReferenceOptions(
    { choiceId: '', actionId: 'lie_low' },
    activityFacts,
  );
  const candidateLabel = (slotId: string) =>
    candidateSetLabel(draft, source, slotId);
  // Due automatic sources and their counts come from the engine's trace.
  // The source's week is the one before its automatic events are due.
  const automaticSources = positions.flatMap((group) => {
    if (group.kind !== 'automatic') return [];
    const queued = draft.context.queuedEffects.find(
      (effect) =>
        effect.sourceId === group.sourceId &&
        effect.effect.kind === 'automatic_events',
    );
    return [
      {
        sourceId: group.sourceId,
        label: eventName(queued?.eventType) ?? 'An earlier event',
        week: (queued?.startsWeek ?? draft.week) - 1,
        count: group.count,
      },
    ];
  });
  const sourceLabel = (sourceId: string) =>
    automaticSources.find((entry) => entry.sourceId === sourceId)?.label ??
    'An earlier event';

  const tree = eventTreeBlocks({
    draft,
    projection,
    plan,
    accepted: context.acceptedEventIds,
    facts: (located, label) => occurrenceFacts(located, label),
    // Never a raw code: unowned codes fall back to the generic wording.
    issues: (codes) =>
      [...new Set(codes)].map((code) => ({
        code,
        message: messages[code] ?? eventRequirement(code),
      })),
  });
  function occurrenceFacts(
    { event, owner }: LocatedEvent,
    label: string,
  ): EventOccurrenceFacts {
    const trace = eventTraceFacts(projection, event);
    const resolved = projection?.tree.find(
      (entry) => entry.eventId === event.eventId,
    );
    return {
      ...trace,
      occurrence: structuredClone(event),
      label,
      owner: structuredClone(owner),
      optionalMitigation: eventMitigationInput(resolved ?? event, trace.mode),
      exceptionChoices: eventExceptions(
        event,
        draft,
        projection?.requirements ?? [],
        projection?.warnings ?? [],
      ),
      changes:
        projection?.plan.filter((change) => change.eventId === event.eventId) ??
        [],
      panel: null,
    };
  }

  // Event-identified wording for every code, shared with This phase.
  const label = (eventId: string) => {
    const item = tree.occurrences.find(
      (entry) => entry.occurrence.eventId === eventId,
    );
    if (!item) return 'Event';
    const name =
      eventName(item.resolvedType) ??
      eventTableFacts(item.occurrence.tableRoll).name;
    return name ? `${item.label} · ${name}` : item.label;
  };
  // Event-specific controls, once every occurrence has its label.
  const panelContext: EventPanelContext = {
    draft,
    projection,
    activity,
    teams: activityFacts.teamRoster,
    activitySlots: activityFacts.slots,
    personName: (characterId) =>
      source.people.find((person) => person.characterId === characterId)
        ?.name ?? null,
    settlementName: (settlementId) =>
      source.snapshot.settlements.find(
        (town) => town.settlementId === settlementId,
      )?.name ?? null,
    eventLabel: label,
    modifierLabel: (modifier, recorded) =>
      checkModifierLabel(modifier, {
        draft,
        source,
        helpfulName: null,
        recorded: recorded?.modifiers ?? [],
      }),
  };
  for (const item of tree.occurrences)
    item.panel = eventPanel(item, panelContext);
  const settlement = draft.activity.operatingSettlementId
    ? projectSettlements(
        activity?.outcome.settlements ?? source.snapshot.settlements,
        draft.week,
      ).settlements.find(
        (town) => town.settlementId === draft.activity.operatingSettlementId,
      )
    : undefined;
  const settlementName =
    settlement?.name ??
    source.snapshot.settlements.find(
      (town) => town.settlementId === draft.activity.operatingSettlementId,
    )?.name ??
    null;
  const messages: Record<string, string> = {};
  for (const code of [
    ...(projection?.requirements ?? []),
    ...(projection?.warnings ?? []),
  ]) {
    const message = eventTopologyMessage(code, {
      positions,
      events: tree.occurrences.map((item) => ({
        eventId: item.occurrence.eventId,
        sabotageId: item.occurrence.sabotage?.choiceId ?? null,
        label: label(item.occurrence.eventId),
      })),
      candidateLabel: (choiceId) =>
        candidateChoiceLabel(draft, source, choiceId),
      sourceLabel,
      settlementName,
      preparationFailed: context.preparationFailed,
      warning: (projection?.warnings ?? []).includes(code),
      detail: (eventId, tail, warning) => {
        const panel = tree.occurrences.find(
          (item) => item.occurrence.eventId === eventId,
        )?.panel;
        return panel ? eventPanelMessage(panel, tail, warning) : null;
      },
    });
    if (message) messages[code] = message;
  }
  const issues = (codes: string[]) =>
    [...new Set(codes)].flatMap((code) =>
      messages[code] ? [{ code, message: messages[code] }] : [],
    );
  const codes = [
    ...(projection?.requirements ?? []),
    ...(projection?.warnings ?? []),
  ];

  // Clearing the table roll of an otherwise empty surplus position removes it
  // through the existing tree or candidate edit.
  const surplus: Repair = {
    surplus: (eventId) => isSurplusEventOccurrence(draft, positions, eventId),
    removal: (eventId) => {
      const cleared = structuredClone(draft);
      for (const event of [
        ...cleared.event.occurrences,
        ...cleared.activity.slots.flatMap((slot) =>
          actionChoiceEvents(slot.choice),
        ),
      ])
        if (event.eventId === eventId) delete event.tableRoll;
      return removableEventOccurrence(cleared, positions, eventId);
    },
  };
  const mainRoots = tree.roots.filter((entry) => entry.owner === null);
  const automaticRoots = mainRoots.filter(
    (entry) => entry.event.origin.kind === 'automatic',
  );
  const rolledRoots = mainRoots.filter(
    (entry) => entry.event.origin.kind === 'rolled',
  );
  const isActive = (entry: LocatedEvent) =>
    tree.active.has(entry.event.eventId);

  const forcedCalm = projection?.forcedCalm ?? false;
  const guaranteed = projection?.guaranteed ?? false;
  const chanceStep = chanceFacts();
  function chanceFacts(): EventChanceStep {
    const normalized = normalizeRawRoll(
      draft.event.chanceRoll,
      RULE_ROLL_SPECS.percentile,
    );
    const raw = normalized.status === 'complete' ? normalized.diceTotal : null;
    const modifier = projection?.chanceModifier ?? null;
    const total = raw !== null && modifier !== null ? raw + modifier : null;
    const breakdown = projection
      ? [
          { label: 'Notoriety', value: projection.chanceBreakdown.notoriety },
          ...(projection.chanceBreakdown.carry
            ? [
                {
                  label: 'Uneventful last week (rank)',
                  value: projection.chanceBreakdown.carry,
                },
              ]
            : []),
          ...projection.chanceBreakdown.queued.map((entry) => ({
            label:
              eventName(
                draft.context.queuedEffects.find(
                  (effect) => effect.effectId === entry.effectId,
                )?.eventType,
              ) ?? 'An earlier event',
            value: entry.value,
          })),
        ]
      : [];
    const sources = (projection?.guarantees ?? []).flatMap((guarantee) => {
      const slot = draft.activity.slots.find(
        (entry) => entry.choice?.choiceId === guarantee.choiceId,
      );
      return slot
        ? [{ choiceId: guarantee.choiceId, label: candidateLabel(slot.slotId) }]
        : [];
    });
    const applies = forcedCalm
      ? 'forced_calm'
      : guaranteed
        ? 'guaranteed'
        : 'roll';
    const result =
      applies === 'roll' ? (projection?.chanceResult ?? null) : null;
    return {
      applies,
      effect:
        applies === 'forced_calm'
          ? 'A calm week'
          : applies === 'guaranteed'
            ? 'An event is guaranteed'
            : result === 'event'
              ? 'An event happens'
              : result === 'quiet'
                ? 'A quiet week'
                : 'Waiting for the chance roll',
      explanation:
        applies === 'forced_calm'
          ? 'All Is Calm from last week: no chance roll and no rolled or candidate event this week. Automatic events still happen.'
          : applies === 'guaranteed'
            ? `${sources.map((entry) => entry.label).join('; ')} guarantees an event, so there is no chance roll.`
            : null,
      breakdown,
      required: codes.includes('event:chance:1d100'),
      raw,
      total,
      result,
      operating: settlementName
        ? {
            name: settlementName,
            reputation: settlement?.reputation ?? null,
            modifier,
          }
        : null,
      sources,
      issues: issues(
        codes.filter(
          (code) =>
            code === 'event:chance:1d100' ||
            code === 'event:operating-settlement' ||
            code === 'event:chance:roll-range',
        ),
      ),
    };
  }

  const automatic =
    automaticSources.length || automaticRoots.some(isActive)
      ? {
          sources: automaticSources,
          blocks: automaticRoots
            .filter(isActive)
            .map((entry) => tree.block(entry, surplus)),
          issues: issues(
            codes.filter((code) =>
              automaticSources.some((entry) =>
                code.startsWith(`${entry.sourceId}:automatic-events:`),
              ),
            ),
          ),
        }
      : null;
  const rolledBlocks = rolledRoots
    .filter(isActive)
    .map((entry) => tree.block(entry, surplus));
  const happened = (projection?.dispatch ?? []).filter(
    (entry) => !projection?.negatedEventIds.includes(entry.event.eventId),
  );
  const rolled = {
    applies: rolledBlocks.length > 0,
    effect: happened.length
      ? happened.map((entry) => eventName(entry.event.eventType)).join(' · ')
      : 'Waiting for dice',
    reason: forcedCalm
      ? 'No rolled event in a calm week'
      : guaranteed
        ? 'An Activity choice guarantees the event'
        : chanceStep.result === 'quiet'
          ? 'A quiet week'
          : rolledBlocks.length
            ? null
            : 'Waiting for the chance roll',
    blocks: rolledBlocks,
    issues: issues(codes.filter((code) => code === 'event:root:1')),
  };
  const candidates: EventCandidateSet[] = draft.activity.slots.flatMap(
    (slot) => {
      const choice = slot.choice;
      if (!isCandidateChoice(choice)) return [];
      return [
        {
          slotId: slot.slotId,
          choiceId: choice.choiceId,
          label: candidateLabel(slot.slotId),
          active: tree.activeCandidateSets.has(choice.choiceId),
          selectedEventId: choice.selectedEventId ?? null,
          blocks: tree.roots
            .filter((entry) => entry.owner?.choice.choiceId === choice.choiceId)
            .map((entry) => tree.block(entry, surplus)),
          issues: issues(
            codes.filter(
              (code) =>
                code === `${choice.choiceId}:candidates:2` ||
                code === `${choice.choiceId}:selected-event`,
            ),
          ),
        },
      ];
    },
  );
  const inactive = mainRoots
    .filter((entry) => !isActive(entry))
    .map((entry) => tree.block(entry, surplus));
  const complete = Boolean(projection?.ready);
  const outcome = {
    complete,
    lines: complete
      ? [
          happened.length
            ? `This week: ${happened
                .map(
                  (entry) =>
                    `${eventName(entry.event.eventType)}${entry.mode === 'twice' ? ' (twice)' : ''}`,
                )
                .join(', ')}.`
            : forcedCalm
              ? 'A calm week: no event.'
              : 'No event this week.',
          ...(projection?.negatedEventIds ?? []).map(
            (eventId) => `${label(eventId)} was sabotaged and does not happen.`,
          ),
          uneventfulCarryText(
            { draft, projection },
            activity?.outcome.rank ?? source.snapshot.rank,
          ),
        ]
      : [],
  };
  const unsaved = tree.occurrences.some(
    (item) =>
      context.acceptedEventIds &&
      !context.acceptedEventIds.has(item.occurrence.eventId),
  );
  return {
    phase: 'event',
    ready: projection?.ready ?? false,
    chance: projection?.chance ?? 10,
    chanceRoll: draft.event.chanceRoll ?? null,
    chanceModifier: projection?.chanceModifier ?? null,
    guaranteed,
    chanceStep,
    automatic,
    rolled,
    candidates,
    inactive,
    outcome,
    preparation: context.preparationFailed
      ? 'failed'
      : unsaved
        ? 'preparing'
        : 'idle',
    occurrences: tree.occurrences,
    messages,
    acknowledgements: structuredClone(draft.acknowledgements),
    exceptions: structuredClone(draft.rulesExceptions),
    checks: projection?.checks ?? [],
    options: {
      ...references,
      eventId: references.eventId.map((option) => {
        const item = tree.occurrences.find(
          (entry) => entry.occurrence.eventId === option.value,
        );
        return item ? { ...option, label: label(option.value) } : option;
      }),
      itemId: [
        ...new Map(
          [
            ...references.itemId,
            ...tree.occurrences.flatMap(({ occurrence }) =>
              (occurrence.rewards ?? []).map((reward) => ({
                value: reward.itemId,
                label: reward.name,
              })),
            ),
            ...(projection?.outcome.economy?.items ?? []).map((item) => ({
              value: item.itemId,
              label: item.name,
            })),
          ].map((item) => [item.value, item]),
        ).values(),
      ],
      parentEventId: tree.occurrences.map(({ occurrence }) => ({
        value: occurrence.eventId,
        label: label(occurrence.eventId),
      })),
    },
    sabotage: Object.fromEntries(
      tree.occurrences.map((item) => [
        item.occurrence.eventId,
        eventSabotageFacts(item, panelContext),
      ]),
    ),
    overseer: overseerSupportFacts({
      draft,
      outcome: activity?.outcome ?? source.snapshot,
      eventLabel: label,
      unused: tree.occurrences
        .filter((item) => !item.selected)
        .map((item) => item.occurrence.eventId),
    }),
    requirements: withoutDuplicateRollCodes(projection?.requirements ?? []),
    warnings: projection?.warnings ?? [],
  };
}

// Names an Activity choice's candidate set by its action, slot and team.
export function candidateSetLabel(
  draft: WeeklyDraft,
  source: WorkspaceSource,
  slotId: string,
) {
  const index = draft.activity.slots.findIndex(
    (slot) => slot.slotId === slotId,
  );
  const choice = draft.activity.slots[index]?.choice;
  const team = source.snapshot.roster.teams.find(
    (entry) => entry.teamId === choice?.teamId,
  )?.name;
  return `${activityLabel(choice?.actionId ?? 'event')} · Action Slot ${index + 1}${team ? ` · ${team}` : ''}`;
}
/** The candidate set label of the choice with this identity, if staged. */
export function candidateChoiceLabel(
  draft: WeeklyDraft,
  source: WorkspaceSource,
  choiceId: string,
) {
  const slot = draft.activity.slots.find(
    (entry) => entry.choice?.choiceId === choiceId,
  );
  return slot ? candidateSetLabel(draft, source, slot.slotId) : null;
}

function eventExceptions(
  occurrence: Event,
  draft: WeeklyDraft,
  requirements: string[],
  warnings: string[],
) {
  const subjects = [
    occurrence.eventId,
    occurrence.sabotage?.choiceId,
    ...(occurrence.rewards ?? []).map((reward) => reward.itemId),
  ].filter((id): id is string => Boolean(id));
  const existing = draft.rulesExceptions.filter((exception) =>
    subjects.includes(exception.subjectId),
  );
  const candidates = requirements.flatMap((key) => {
    if (!key.endsWith(':exception')) return [];
    const reward = occurrence.rewards?.find(
      (reward) =>
        key === `${occurrence.eventId}:reward:${reward.itemId}:exception`,
    );
    if (reward)
      return [{ subjectId: reward.itemId, ruleId: 'alchemical-reward' }];
    const subjectId = subjects.find((id) => key.startsWith(`${id}:`));
    return subjectId
      ? [
          {
            subjectId,
            ruleId: key.slice(subjectId.length + 1, -':exception'.length),
          },
        ]
      : [];
  });
  if (warnings.includes(`${occurrence.eventId}:event-eligibility`))
    candidates.push({
      subjectId: occurrence.eventId,
      ruleId: 'event-eligibility',
    });
  return [
    ...new Map(
      [
        ...existing,
        ...candidates.map(
          (candidate) =>
            existing.find(
              (exception) =>
                exception.subjectId === candidate.subjectId &&
                exception.ruleId === candidate.ruleId,
            ) ?? {
              ...candidate,
              exceptionId: `event:${candidate.subjectId}:${candidate.ruleId}`,
              reason: '',
            },
        ),
      ].map((exception) => [exception.exceptionId, exception]),
    ).values(),
  ];
}
