import { activityLabel } from './activity-labels';
import { economyAtPosition } from './activity-economy-position';
import { activityOptionFacts } from './activity-option-facts';
import { activityWarning } from './activity-warnings';
import { eventOccurrenceLabels } from './event-tree-facts';
import { subjectMessage } from './summary-messages';
import teamTable from '~/lib/militia-team-table';
import { MILITIA_ACTIVITY_ACTION_IDS } from '~/lib/militia-domain';
import { actionRestrictions } from '~/lib/rules-action-eligibility';
import { isTeamUnavailableThisActivity } from '~/lib/rules-action-teams';
import { activityRollSpec } from '~/lib/rules-roll-spec';
import { isRefugeActive, projectSettlements } from '~/lib/rules-settlements';
import { refugeReputationAllows } from '~/lib/rules-settlement-actions';
import { withoutDuplicateRollCodes } from './roll-requirements';
import { slotRemovalRejectionFrom } from '~/lib/activity-slot-removal';
import { HIDDEN_AGENDA_SOURCE } from '~/lib/rules-event-outcomes';

import { recruitedTeamId } from '~/lib/weekly-draft-identities';
import {
  actionChoiceRolls,
  type StagedActionChoice,
} from '~/lib/weekly-draft-facts';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import type { WorkspaceSource } from '~/lib/weekly-workspace-source';
import type { CanonicalResolutionPreview } from '~/lib/canonical-weekly-resolution';
import type { ActivityProjection } from '~/lib/rules-activity';
import type {
  ActivityAllowance,
  ActivityBonusChoice,
  ActivityCheck,
  ActivityIssue,
  ActivityPositionFacts,
  ActivityRecordedModifier,
  ActivityTeamFact,
  ActivityView,
} from './types';

type Slot = WeeklyDraft['activity']['slots'][number];
type ProjectedCheck = ActivityProjection['checks'][number];
// Sources the rules calculate for every check. A recorded modifier naming one
// of them is never added a second time.
const automaticLabels: Record<string, string> = {
  'rank-focus': 'Rank and focus',
  officers: 'Officers',
  strategist: 'Strategist',
  'gather-tier': 'Team tier',
  'knowledge-rank': 'Militia rank',
  'overseer-support': 'Overseer support',
};
const automaticPrefix = /^(queued|officer|manager|covert):/;

function teamFacts(
  draft: WeeklyDraft,
  source: WorkspaceSource,
  preview: CanonicalResolutionPreview,
): ActivityTeamFact[] {
  const roster =
    preview.phases?.upkeep.outcome.roster.teams ?? source.snapshot.roster.teams;
  const definition = (teamType: string | null | undefined) =>
    teamTable.find((entry) => entry.id === teamType);
  const current: ActivityTeamFact[] = roster.map((team) => ({
    teamId: team.teamId,
    name: team.name,
    teamType: team.teamType,
    typeName: definition(team.teamType)?.name ?? null,
    tier: definition(team.teamType)?.tier ?? null,
    condition: team.status,
    unavailable: isTeamUnavailableThisActivity(draft, team.teamId),
    recruitedInSlot: null,
  }));
  const recruits = draft.activity.slots.flatMap<ActivityTeamFact>(
    (slot, index) =>
      slot.choice?.actionId === 'recruit_team'
        ? [
            {
              teamId: recruitedTeamId(slot.choice.choiceId),
              name: definition(slot.choice.teamType)?.name ?? 'Recruited team',
              teamType: slot.choice.teamType ?? null,
              typeName: definition(slot.choice.teamType)?.name ?? null,
              tier: definition(slot.choice.teamType)?.tier ?? null,
              condition: 'active' as const,
              unavailable: false,
              recruitedInSlot: index + 1,
            },
          ]
        : [],
  );
  return [
    ...current,
    ...recruits.filter(
      (recruit) => !current.some((team) => team.teamId === recruit.teamId),
    ),
  ];
}

// Names a check modifier's source for its breakdown; Event checks share it.
export function checkModifierLabel(
  modifier: string,
  context: {
    draft: WeeklyDraft;
    source: WorkspaceSource;
    helpfulName: string | null;
    recorded: { sourceId: string; reason: string }[];
  },
) {
  if (automaticLabels[modifier]) return automaticLabels[modifier];
  if (modifier === 'helpful')
    return context.helpfulName ? `Helpful (${context.helpfulName})` : 'Helpful';
  const [prefix, ...rest] = modifier.split(':');
  const id = rest.join(':');
  if (prefix === 'bonus') {
    const bonus = context.source.snapshot.bonuses.find(
      (entry) => entry.bonusId === id,
    );
    return bonus ? bonus.source : 'Bonus';
  }
  if (prefix === 'manager') {
    const name = context.source.people.find(
      (person) => person.characterId === id,
    )?.name;
    return name ? `Manager ${name}` : 'Team manager';
  }
  if (prefix === 'queued') {
    // Hidden Agenda's recalculated bonus is not a queued draft effect.
    if (id === HIDDEN_AGENDA_SOURCE) return activityLabel('hidden_agenda');
    const effect = context.draft.context.queuedEffects.find(
      (entry) => entry.sourceId === id || entry.effectId === id,
    );
    const carried = context.draft.context.carriedEvents.find(
      (event) => event.eventId === id,
    );
    const eventType = effect?.eventType ?? carried?.eventType;
    return eventType ? activityLabel(eventType) : 'Carried effect';
  }
  if (prefix === 'covert') {
    const index = context.draft.activity.slots.findIndex(
      (slot) => slot.choice?.choiceId === id,
    );
    return index >= 0
      ? `Covert Action (Action Slot ${index + 1})`
      : 'Covert Action';
  }
  return (
    context.recorded.find((entry) => entry.sourceId === modifier)?.reason ??
    'Table modifier'
  );
}

function checkFacts(
  choice: StagedActionChoice,
  projected: ProjectedCheck | undefined,
  label: (source: string) => string,
): ActivityCheck | null {
  const spec = activityRollSpec(choice.actionId, 'check');
  if (!spec) return null;
  return {
    spec,
    organizationCheck: projected?.organizationCheck ?? null,
    dc: projected?.dc ?? null,
    modifier: projected?.modifier ?? null,
    total: projected?.total ?? null,
    // The check's own reading, as the rules compare it. The action result
    // stays undecided while any of the action's rolls is missing, including
    // a roll only this reading asks for, so it cannot decide what shows.
    succeeded:
      projected?.total === null || projected?.total === undefined
        ? null
        : projected.dc === undefined || projected.total >= projected.dc,
    breakdown: (projected?.modifiers ?? []).map((modifier) => ({
      source: modifier.source,
      label: label(modifier.source),
      value: modifier.value,
    })),
  };
}

function recordedModifiers(
  choice: StagedActionChoice,
  requirements: string[],
  projected: ProjectedCheck | undefined,
  label: (source: string) => string,
): ActivityRecordedModifier[] {
  const has = (code: string) =>
    requirements.includes(`${choice.choiceId}:${code}`);
  const applied = new Set(projected?.modifiers.map((entry) => entry.source));
  return (actionChoiceRolls(choice).check?.modifiers ?? []).map(
    (modifier, index) => {
      const base = {
        index,
        sourceId: modifier.sourceId,
        value: modifier.value,
        reason: modifier.reason,
      };
      if (modifier.sourceId === 'helpful')
        return {
          ...base,
          kind: 'helpful' as const,
          label: label('helpful'),
          warning: has('helpful-ineligible')
            ? 'Helpful applies only while operating from a Helpful settlement.'
            : has('helpful-already-used')
              ? 'Helpful is already used on an earlier check this Activity. Remove one of them.'
              : null,
        };
      if (modifier.sourceId.startsWith('bonus:'))
        return {
          ...base,
          kind: 'bonus' as const,
          label: label(modifier.sourceId),
          warning: has(`${modifier.sourceId}:unavailable`)
            ? 'This bonus is not available for this check.'
            : null,
        };
      if (
        automaticLabels[modifier.sourceId] ||
        automaticPrefix.test(modifier.sourceId)
      )
        return {
          ...base,
          kind: 'automatic' as const,
          label: label(modifier.sourceId),
          warning:
            'The rules calculate this automatically, so this recorded copy is not added again.',
        };
      const counted = projected
        ? applied.has(modifier.sourceId)
        : modifier.sourceId.startsWith('custom:');
      return counted
        ? {
            ...base,
            kind: 'custom' as const,
            label: modifier.reason,
            warning: null,
          }
        : {
            ...base,
            kind: 'unknown' as const,
            label: modifier.reason,
            warning: projected
              ? 'This recorded modifier is not applied by the rules.'
              : null,
          };
    },
  );
}

function bonusChoices(
  draft: WeeklyDraft,
  source: WorkspaceSource,
  projection: ActivityProjection | undefined,
  choice: StagedActionChoice,
  projected: ProjectedCheck | undefined,
): ActivityBonusChoice[] {
  const recorded = new Set(
    (actionChoiceRolls(choice).check?.modifiers ?? []).map(
      (modifier) => modifier.sourceId,
    ),
  );
  const own = new Set(
    projected?.modifiers.flatMap((modifier) =>
      modifier.source.startsWith('bonus:') ? [modifier.source.slice(6)] : [],
    ),
  );
  const used = new Set(
    (projection?.checkUsage.bonusIds ?? []).filter((id) => !own.has(id)),
  );
  const bonuses =
    projection?.outcome.bonuses.map((bonus) => ({
      ...bonus,
      // The projection marks bonuses consumed by this week's own checks.
      consumedWeek:
        bonus.consumedWeek === draft.week && own.has(bonus.bonusId)
          ? null
          : bonus.consumedWeek,
    })) ?? source.snapshot.bonuses;
  return bonuses.flatMap((bonus) =>
    bonus.availableWeek === draft.week &&
    bonus.consumedWeek === null &&
    !used.has(bonus.bonusId) &&
    !recorded.has(`bonus:${bonus.bonusId}`) &&
    (bonus.phase === undefined || bonus.phase === 'activity') &&
    (bonus.teamId === undefined || bonus.teamId === choice.teamId) &&
    (bonus.check === 'any' ||
      !projected?.organizationCheck ||
      bonus.check === projected.organizationCheck)
      ? [
          {
            sourceId: `bonus:${bonus.bonusId}`,
            label: bonus.source,
            value: bonus.value,
          },
        ]
      : [],
  );
}

function slotIssues(
  choice: StagedActionChoice,
  requirements: string[],
  warnings: string[],
): ActivityIssue[] {
  const choiceId = choice.choiceId;
  // A Special Order's receipt codes belong to its order.
  const orderId =
    choice.actionId === 'special_order' ? choice.orderId : undefined;
  return [
    ...requirements.map((code) => ({
      code,
      message:
        orderId && code.startsWith(`${orderId}:`)
          ? subjectMessage(code, orderId)
          : subjectMessage(code, choiceId, false, choice.actionId),
    })),
    // A requirement already explains a warning with the same code.
    ...warnings
      .filter(
        (code) =>
          !requirements.includes(code) &&
          !requirements.includes(`${code}:exception`),
      )
      .map((code) => ({
        code,
        message: activityWarning(code, choiceId, choice.actionId),
      })),
  ];
}

function allowanceFacts(
  draft: WeeklyDraft,
  preview: CanonicalResolutionPreview,
  source: WorkspaceSource,
): ActivityAllowance {
  const occupied = draft.activity.slots.filter((slot) => slot.choice).length;
  const phases = preview.phases;
  if (!phases)
    return {
      occupied,
      actions: 0,
      rank: source.snapshot.rank,
      rankActions: null,
      strategist: false,
      changes: [],
      removalBlocked: 'unknown',
    };
  const { allowance, slots } = phases.activity;
  return {
    occupied,
    actions: allowance.actions,
    rank: allowance.rank,
    rankActions: allowance.rankActions,
    strategist: allowance.strategistAssigned,
    changes: slots.flatMap((slot, index) =>
      // Safe cast: the `index > 0` guard keeps slots[index - 1] in bounds.
      index > 0 && slot.allowance !== slots[index - 1]!.allowance
        ? [{ slotNumber: index + 1, allowance: slot.allowance }]
        : [],
    ),
    removalBlocked:
      !phases.upkeep.skipped && !phases.upkeep.ready
        ? 'upkeep'
        : allowance.known
          ? null
          : 'unknown',
  };
}

function personName(source: WorkspaceSource, characterId: string) {
  return (
    source.people.find((entry) => entry.characterId === characterId)?.name ??
    'Unnamed character'
  );
}

export function activityView(
  draft: WeeklyDraft,
  source: WorkspaceSource,
  preview: CanonicalResolutionPreview,
): ActivityView {
  const projection = preview.phases?.activity;
  const upkeep = preview.phases?.upkeep;
  const roster = teamFacts(draft, source, preview);
  const startSettlements = projectSettlements(
    upkeep?.outcome.settlements ?? source.snapshot.settlements,
    draft.week,
  ).settlements;
  const operatingId = draft.activity.operatingSettlementId ?? null;
  const operating = startSettlements.find(
    (settlement) => settlement.settlementId === operatingId,
  );
  const helpfulName =
    operating?.reputation === 'Helpful' ? operating.name : null;
  return {
    phase: 'activity',
    ready: projection?.ready ?? false,
    occupiedSlots: draft.activity.slots.filter((slot) => slot.choice).length,
    allowance: allowanceFacts(draft, preview, source),
    slots: draft.activity.slots.map((slot, index) => ({
      ...slotFacts({
        draft,
        source,
        projection,
        upkeep,
        slot,
        index,
        roster,
        helpfulName,
      }),
      position: slot.choice ? positionFacts(draft, preview, index) : null,
    })),
    teamRoster: roster,
    // Read from the Event facts, which build on this view; the phase view
    // fills them in.
    candidateSets: [],
    helpful: helpfulName
      ? {
          settlementName: helpfulName,
          usedIn: draft.activity.slots.flatMap((slot, index) =>
            slot.choice &&
            actionChoiceRolls(slot.choice).check?.modifiers.some(
              (modifier) => modifier.sourceId === 'helpful',
            )
              ? [{ slotId: slot.slotId, slotNumber: index + 1 }]
              : [],
          ),
        }
      : null,
    operating: {
      selected: operatingId,
      missing:
        operatingId !== null &&
        !source.snapshot.settlements.some(
          (settlement) => settlement.settlementId === operatingId,
        ),
      choices: startSettlements.map((settlement) => ({
        value: settlement.settlementId,
        label: settlement.name,
        reputation: settlement.reputation,
      })),
    },
    blockedActions: MILITIA_ACTIVITY_ACTION_IDS.filter(
      (actionId) =>
        // Safe cast: actionRestrictions reads only the action id of this picker
        // probe.
        actionRestrictions(draft, {
          actionId,
          choiceId: 'picker',
        } as StagedActionChoice).length > 0,
    ),
    actions: MILITIA_ACTIVITY_ACTION_IDS.map((actionId) => ({
      actionId,
      name: activityLabel(actionId),
    })),
    ...activityOptionFacts(
      draft,
      source,
      projection,
      eventOccurrenceLabels(draft, preview.phases?.event.positions ?? []),
    ),
    settlements: source.snapshot.settlements.map((settlement) => ({
      value: settlement.settlementId,
      label: settlement.name,
    })),
    people: source.snapshot.roster.people.map((person) => ({
      value: person.characterId,
      label: personName(source, person.characterId),
    })),
    characters: source.snapshot.roster.people.map((person) => ({
      characterId: person.characterId,
      name: personName(source, person.characterId),
      level:
        (upkeep?.outcome.characters ?? source.snapshot.characters).find(
          (character) => character.characterId === person.characterId,
        )?.level ?? null,
    })),
    startDay: draft.context.startDay,
    operatingSettlementId: operatingId,
    checks: projection?.checks ?? [],
    requirements: projection?.requirements ?? [],
    warnings: projection?.warnings ?? [],
  };
}

// Replays the rules projection's changes from the choices before `index`
// over the post-Upkeep state, so a detail editor sees the officers, refuges,
// character conditions, items and caches the resolver sees at this position.
export function positionFacts(
  draft: WeeklyDraft,
  preview: CanonicalResolutionPreview,
  index: number,
): ActivityPositionFacts | null {
  const upkeep = preview.phases?.upkeep;
  const projection = preview.phases?.activity;
  if (!upkeep || !projection) return null;
  const earlier = new Set(
    draft.activity.slots
      .slice(0, index)
      .flatMap((slot) => (slot.choice ? [slot.choice.choiceId] : [])),
  );
  let officers = upkeep.outcome.roster.officers;
  const settlements = new Map(
    upkeep.outcome.settlements.map((settlement) => [
      settlement.settlementId,
      settlement,
    ]),
  );
  const people = new Map(
    (upkeep.outcome.characterActions?.people ?? []).map((person) => [
      person.characterId,
      person,
    ]),
  );
  const propaganda: ActivityPositionFacts['propaganda'] = [];
  for (const change of projection.plan) {
    if (!('choiceId' in change) || !earlier.has(change.choiceId)) continue;
    if (change.kind === 'propaganda_attempt')
      propaganda.push({
        settlementId: change.settlementId,
        choiceId: change.choiceId,
      });
    if (change.kind === 'officers') officers = change.after;
    else if (change.kind === 'settlement')
      settlements.set(change.after.settlementId, change.after);
    else if (change.kind === 'tracked_character')
      people.set(change.after.characterId, change.after);
  }
  return {
    officers: officers.map(({ characterId, role }) => ({ characterId, role })),
    refugeSettlementIds: [...settlements.values()].flatMap((settlement) =>
      isRefugeActive(settlement, draft.week) ? [settlement.settlementId] : [],
    ),
    settlements: [...settlements.values()].map((settlement) => ({
      settlementId: settlement.settlementId,
      reputation:
        projectSettlements([settlement], draft.week).settlements[0]
          ?.reputation ?? null,
      refugeAllowed: refugeReputationAllows(settlement, draft.week),
      occupied: settlement.occupied,
      secured: settlement.secured,
    })),
    propaganda,
    characterStatus: [...people.values()].map(({ characterId, status }) => ({
      characterId,
      status,
    })),
    economy: economyAtPosition(draft, preview, index),
  };
}

function slotFacts({
  draft,
  source,
  projection,
  upkeep,
  slot,
  index,
  roster,
  helpfulName,
}: {
  draft: WeeklyDraft;
  source: WorkspaceSource;
  projection: ActivityProjection | undefined;
  upkeep:
    | NonNullable<CanonicalResolutionPreview['phases']>['upkeep']
    | undefined;
  slot: Slot;
  index: number;
  roster: ActivityTeamFact[];
  helpfulName: string | null;
}): Omit<ActivityView['slots'][number], 'position'> {
  const choice = slot.choice;
  const choiceId = choice?.choiceId;
  const position = projection?.slots[index];
  const requirements = choice
    ? withoutDuplicateRollCodes([
        ...new Set(
          projection?.requirements.filter(
            (requirement) =>
              requirement.startsWith(`${choiceId}:`) ||
              (choice.actionId === 'special_order' &&
                Boolean(choice.orderId) &&
                requirement.startsWith(`${choice.orderId}:`)),
          ) ?? [],
        ),
      ])
    : [];
  const warnings = choice
    ? (projection?.warnings.filter((warning) =>
        warning.startsWith(`${choiceId}:`),
      ) ?? [])
    : [];
  const existing = draft.rulesExceptions.filter(
    (exception) => exception.subjectId === choiceId,
  );
  const ruleIds = new Set([
    ...existing.map((exception) => exception.ruleId),
    ...requirements
      .filter((requirement) => requirement.endsWith(':exception'))
      .map((requirement) =>
        requirement.slice(`${choiceId}:`.length, -':exception'.length),
      ),
  ]);
  const projected = choice
    ? projection?.checks.find((check) => check.checkId === choiceId)
    : undefined;
  const recorded = choice
    ? (actionChoiceRolls(choice).check?.modifiers ?? [])
    : [];
  const label = (modifier: string) =>
    checkModifierLabel(modifier, { draft, source, helpfulName, recorded });
  return {
    ...structuredClone(slot),
    number: index + 1,
    actionName: choice ? activityLabel(choice.actionId) : null,
    overAllowance: position?.overAllowance ?? false,
    strategistBonus: position?.strategistBonus ?? false,
    allowance: position?.allowance ?? 0,
    beyondAllowance: position?.beyondAllowance ?? false,
    allowanceKnown: position?.allowanceKnown ?? false,
    status: !choice
      ? { kind: 'empty' }
      : requirements.length
        ? { kind: 'todo', count: requirements.length }
        : { kind: 'ready' },
    issues: choice ? slotIssues(choice, requirements, warnings) : [],
    warningCount: warnings.length,
    removable:
      upkeep !== undefined &&
      projection !== undefined &&
      slotRemovalRejectionFrom(draft, upkeep, projection, slot.slotId) === null,
    team: choice?.teamId
      ? {
          teamId: choice.teamId,
          name:
            roster.find((team) => team.teamId === choice.teamId)?.name ?? null,
        }
      : null,
    check: choice ? checkFacts(choice, projected, label) : null,
    modifiers: choice
      ? recordedModifiers(choice, requirements, projected, label)
      : [],
    bonusChoices: choice
      ? bonusChoices(draft, source, projection, choice, projected)
      : [],
    calculatedCostCopper: (projection?.plan ?? []).reduce<number | null>(
      (cost, change) =>
        change.kind === 'treasuryCopper' &&
        change.choiceId === choiceId &&
        change.after < change.before
          ? (cost ?? 0) + change.before - change.after
          : cost,
      null,
    ),
    requirements,
    warnings,
    exceptions: [...ruleIds]
      .filter((ruleId) => ruleId !== 'action-capacity')
      .map((ruleId) => ({
        exceptionId:
          existing.find((exception) => exception.ruleId === ruleId)
            ?.exceptionId ?? `activity:${choiceId}:${ruleId}`,
        ruleId,
        reason:
          existing.find((exception) => exception.ruleId === ruleId)?.reason ??
          '',
      })),
  };
}
