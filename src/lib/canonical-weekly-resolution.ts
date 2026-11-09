import { draftSourceReviewRequirements } from './weekly-draft-review';
import {
  projectPersistentWeek,
  preparePersistentSuccessor,
} from './rules-persistent-events';
import { draftReferenceRequirements } from './weekly-draft-references';
import {
  weeklyDraftSchema,
  weekStartFactsSchema,
  type WeeklyDraft,
} from './weekly-draft-contract';
import {
  reviewedWeeklySourceSchema,
  weeklySourceKey,
  type ReviewedWeeklySource,
  type CanonicalWeekState,
} from './canonical-weekly-source';
import {
  canonicalResolutionRecordSchema,
  resolutionArtifactSchema,
} from './canonical-resolution-record';
import type { UpkeepSnapshot } from './rules-upkeep';

import { CANONICAL_WEEKLY_RULESET_VERSION } from './ruleset-versions';

export {
  ASSUMED_PROPAGANDA_APPROVAL_RULESET_VERSION,
  CANONICAL_WEEKLY_RULESET_VERSION,
  ROLE_AWARE_OFFICERS_RULESET_VERSION,
} from './ruleset-versions';
type Phases = ReturnType<typeof projectPersistentWeek>;
export type CanonicalResolutionEffects = {
  upkeep: Phases['upkeep']['plan'];
  activity: Phases['activity']['plan'];
  event: Phases['event']['plan'];
  sabotage: Phases['event']['sabotage'];
  persistent: Phases['persistent']['plan'];
  adjudication: Pick<
    WeeklyDraft,
    'acknowledgements' | 'rulesExceptions' | 'tableAdjustments'
  >;
};
// A complete, typed replacement is the write plan. The accompanying ordered
// effects explain it; persistence must never replay their arithmetic as well.
export type CanonicalResolutionPlan = {
  before: CanonicalWeekState;
  after: CanonicalWeekState;
  effects: CanonicalResolutionEffects;
};
export type CanonicalResolutionPreview = {
  status: 'ready' | 'incomplete';
  rulesetVersion: number;
  sourceKey: string;
  source: ReviewedWeeklySource | null;
  requirements: string[];
  warnings: string[];
  phases: Phases | null;
  baseline: CanonicalWeekState | null;
  outcome: CanonicalWeekState | null;
  baselinePlan: CanonicalResolutionPlan | null;
  finalPlan: CanonicalResolutionPlan | null;
};

export function projectWeeklyDraft(input: {
  revision: WeeklyDraft;
  militiaSnapshot: UpkeepSnapshot;
}): CanonicalResolutionPreview {
  const parsed = reviewedWeeklySourceSchema.safeParse(input);
  if (!parsed.success)
    return {
      status: 'incomplete',
      rulesetVersion: CANONICAL_WEEKLY_RULESET_VERSION,
      sourceKey: '',
      source: null,
      requirements: parsed.error.issues.map(
        (issue) => `${issue.path.join('.')}:${issue.message}`,
      ),
      warnings: [],
      phases: null,
      baseline: null,
      outcome: null,
      baselinePlan: null,
      finalPlan: null,
    };
  const source = parsed.data;
  const draft = weeklyDraftSchema.parse(source.revision);
  const phases = projectPersistentWeek(draft, source.militiaSnapshot);
  const requirements = draftReferenceRequirements(
    draft,
    source.militiaSnapshot,
    phases.persistent.outcome,
  );
  requirements.push(
    ...draftSourceReviewRequirements(draft),
    ...phases.upkeep.requirements,
    ...phases.activity.requirements,
    ...phases.event.requirements,
    ...phases.persistent.requirements,
  );
  const warnings = [
    ...new Set([
      ...phases.upkeep.warnings,
      ...phases.activity.warnings,
      ...phases.event.warnings,
      ...phases.persistent.warnings,
    ]),
  ];
  const before: CanonicalWeekState = {
    week: draft.week,
    militiaSnapshot: structuredClone(source.militiaSnapshot),
    context: weekStartFactsSchema.strip().parse(draft.context),
  };
  // A partial forecast retains all known outcomes without pretending an unknown
  // carry or incomplete week is a confirmable successor.
  const prepared =
    phases.ready && phases.event.nextUneventfulCarry !== null
      ? preparePersistentSuccessor(draft, phases.event, phases.persistent)
      : null;
  const baseline: CanonicalWeekState = prepared
    ? {
        week: prepared.week,
        context: prepared.context,
        militiaSnapshot: prepared.outcome,
      }
    : {
        week: draft.week,
        militiaSnapshot: structuredClone(phases.persistent.outcome),
        context: weekStartFactsSchema.parse({
          ...before.context,
          carriedEvents: structuredClone(phases.persistent.persistentEvents),
          queuedEffects: structuredClone(phases.persistent.queuedEffects),
          lastBuyoffWeek: phases.persistent.lastBuyoffWeek,
        }),
      };
  const outcome = structuredClone(baseline);
  applyAdjustments(draft, outcome, requirements, warnings);
  const effects: CanonicalResolutionEffects = {
    upkeep: phases.upkeep.plan,
    activity: phases.activity.plan,
    event: phases.event.plan,
    sabotage: phases.event.sabotage,
    persistent: phases.persistent.plan,
    adjudication: {
      acknowledgements: structuredClone(draft.acknowledgements),
      rulesExceptions: structuredClone(draft.rulesExceptions),
      tableAdjustments: [],
    },
  };
  const ready = phases.ready && prepared !== null && requirements.length === 0;
  return {
    status: ready ? 'ready' : 'incomplete',
    rulesetVersion: CANONICAL_WEEKLY_RULESET_VERSION,
    sourceKey: weeklySourceKey(source),
    source,
    requirements: [...new Set(requirements)],
    warnings,
    phases,
    baseline,
    outcome,
    baselinePlan: ready ? { before, after: baseline, effects } : null,
    finalPlan: ready
      ? {
          before: structuredClone(before),
          after: outcome,
          effects: {
            ...structuredClone(effects),
            adjudication: {
              ...structuredClone(effects.adjudication),
              tableAdjustments: structuredClone(draft.tableAdjustments),
            },
          },
        }
      : null,
  };
}

function applyAdjustments(
  draft: WeeklyDraft,
  outcome: CanonicalWeekState,
  requirements: string[],
  warnings: string[],
) {
  for (const adjustment of draft.tableAdjustments) {
    warnings.push(`adjustment:${adjustment.adjustmentId}:${adjustment.reason}`);
    const state = outcome.militiaSnapshot;
    if (adjustment.kind === 'militia_value') {
      state[adjustment.field] =
        adjustment.operation === 'set'
          ? adjustment.value
          : state[adjustment.field] + adjustment.value;
      if (!Number.isSafeInteger(state[adjustment.field]))
        requirements.push(
          `adjustment:${adjustment.adjustmentId}:numeric-overflow`,
        );
    } else if (adjustment.kind === 'team_status') {
      const team = state.roster.teams.find(
        (team) => team.teamId === adjustment.teamId,
      );
      if (team) team.status = adjustment.status;
      else requirements.push(`adjustment:${adjustment.adjustmentId}:team`);
    } else if (adjustment.kind === 'settlement_reputation') {
      const settlement = state.settlements.find(
        (entry) => entry.settlementId === adjustment.settlementId,
      );
      if (settlement) settlement.reputation = adjustment.reputation;
      else
        requirements.push(`adjustment:${adjustment.adjustmentId}:settlement`);
    } else {
      const known = outcome.context.carriedEvents.some(
        (event) => event.eventId === adjustment.eventId,
      );
      if (!known) {
        requirements.push(`adjustment:${adjustment.adjustmentId}:event`);
        continue;
      }
      outcome.context.carriedEvents = outcome.context.carriedEvents.filter(
        (event) => event.eventId !== adjustment.eventId,
      );
      outcome.context.queuedEffects = outcome.context.queuedEffects.filter(
        (effect) => effect.sourceId !== adjustment.eventId,
      );
    }
  }
}

export function resolveCanonicalWeeklyDraft(
  input: Parameters<typeof projectWeeklyDraft>[0],
) {
  const preview = projectWeeklyDraft(input);
  if (
    preview.status !== 'ready' ||
    !preview.finalPlan ||
    !preview.baselinePlan ||
    !preview.source
  )
    throw new Error(
      `Weekly Resolution is incomplete: ${preview.requirements.join(', ')}`,
    );
  return {
    ...preview,
    source: preview.source,
    baselinePlan: preview.baselinePlan,
    finalPlan: preview.finalPlan,
  };
}

// Re-evaluate only on the authority side from its current source, and compare the
// complete reviewed facts. A caller-supplied preview or plan is never authority.
export function resolveReviewedWeeklyDraft(
  input: Parameters<typeof projectWeeklyDraft>[0],
  reviewedSourceKey: string,
) {
  const result = resolveCanonicalWeeklyDraft(input);
  if (result.sourceKey !== reviewedSourceKey)
    throw new Error('Reviewed weekly source changed');
  return result;
}

export function applyCanonicalResolutionPlan(
  state: CanonicalWeekState,
  plan: CanonicalResolutionPlan,
) {
  if (weeklySourceKey(state) !== weeklySourceKey(plan.before))
    throw new Error('Weekly source state changed');
  return structuredClone(plan.after);
}

export function prepareCanonicalResolutionRecord(
  result: ReturnType<typeof resolveCanonicalWeeklyDraft>,
  recordId: string,
) {
  const artifact = (data: unknown) => {
    const copy: unknown = JSON.parse(JSON.stringify(data));
    return resolutionArtifactSchema.parse({ formatVersion: 2, data: copy });
  };
  return canonicalResolutionRecordSchema.parse({
    recordId,
    provenance: 'confirmation',
    source: result.source.revision,
    sourceMilitiaSnapshot: result.source.militiaSnapshot,
    rulesetVersion: result.rulesetVersion,
    baselinePlan: artifact(result.baselinePlan),
    finalPlan: artifact(result.finalPlan),
    finalOutcome: artifact(result.finalPlan.after),
    adjudication: result.finalPlan.effects.adjudication,
    warnings: result.warnings.map((message) => ({
      // Safe cast: `split` always returns at least one element, even when the
      // message has no `:`.
      code: message.split(':')[0]!,
      message,
    })),
    successorContext: result.finalPlan.after.context,
    supersedesRecordId: null,
  });
}
