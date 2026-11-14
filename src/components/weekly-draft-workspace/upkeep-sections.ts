import teamTable from '~/lib/militia-team-table';
import { normalizeRawRoll } from '~/lib/raw-roll';
import {
  UPKEEP_RULES,
  attritionOutcome,
  isRankOrTransferRequirement,
  lossMultiplier,
  notorietyOutcome,
  previewUpkeepCheck,
  returnOutcome,
  type projectUpkeep,
} from '~/lib/rules-upkeep';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import type { WorkspaceSource } from '~/lib/weekly-workspace-source';
import { rollReadFacts } from './roll-facts';
import { rankSection } from './upkeep-rank';
import type {
  RollFact,
  UpkeepDisabledTeam,
  UpkeepIssue,
  UpkeepLoss,
  UpkeepMissingTeam,
  UpkeepSections,
  UpkeepSectionStatus,
  UpkeepTransfer,
  UpkeepView,
} from './types';
import { upkeepWarningMessage } from './upkeep-warnings';

type Projection = ReturnType<typeof projectUpkeep>;
type SnapshotTeam = WorkspaceSource['snapshot']['roster']['teams'][number];
type TrainingStep = 'attrition' | 'notoriety' | 'shortage';
const d20 = { count: 1, sides: 20 } as const;

// What every section builder reads: the draft, its week-start snapshot, the
// shared Upkeep projection and the warnings grouped by owning item.
type Context = {
  draft: WeeklyDraft;
  snapshot: WorkspaceSource['snapshot'];
  projection: Projection;
  rolls: RollFact[];
  minimumTreasuryCopper: number;
  issues: (subject: string) => UpkeepIssue[];
};

// The numbered Upkeep steps in rules order, derived only from the shared
// Upkeep projection. Each section reports its own contribution; whole-week
// values stay in the reference panel. Warnings are attached to the item that
// owns them so the view can show them in place.
export function upkeepSections({
  draft,
  source,
  projection,
  rolls,
  minimumTreasuryCopper,
  transfers,
  officers,
}: {
  draft: WeeklyDraft;
  source: WorkspaceSource;
  projection: Projection;
  rolls: RollFact[];
  minimumTreasuryCopper: number;
  transfers: UpkeepView['transfers'];
  officers: UpkeepView['officers'];
}): UpkeepSections {
  const { issues, general } = groupWarnings(projection.warnings, {
    rolls,
    transfers,
    officers,
    teams: conditionTeams(source.snapshot).map((team) => ({
      teamId: team.teamId,
      name: team.name,
      rulesCostCopper: minimumTreasuryCopper,
      returnRoll: rollReadFacts(teamDecision(draft, team.teamId)?.roll, d20),
    })),
  });
  const context: Context = {
    draft,
    snapshot: source.snapshot,
    projection,
    rolls,
    minimumTreasuryCopper,
    issues,
  };
  const teams = teamsSection(context);
  const earlierOpen = projection.requirements.some(
    (key) => !isRankOrTransferRequirement(key),
  );
  return {
    teams,
    attrition: attritionSection(context),
    notoriety: notorietySection(context),
    shortage: shortageSection(context, teams),
    rank: rankSection({
      snapshot: source.snapshot,
      people: source.people,
      projection,
      earlierOpen,
      issues: issues('rank'),
    }),
    transfers: transfersSection(context, earlierOpen, transfers),
    general,
  };
}

function conditionTeams(snapshot: WorkspaceSource['snapshot']) {
  return snapshot.roster.teams.filter(
    (team) => team.status === 'disabled' || team.status === 'missing',
  );
}

function groupWarnings(
  codes: string[],
  facts: Parameters<typeof upkeepWarningMessage>[1],
) {
  const bySubject = new Map<string, UpkeepIssue[]>();
  const general: UpkeepIssue[] = [];
  for (const code of codes) {
    const issue = { code, message: upkeepWarningMessage(code, facts) };
    const subject = issueSubject(code);
    if (subject)
      bySubject.set(subject, [...(bySubject.get(subject) ?? []), issue]);
    else general.push(issue);
  }
  return {
    issues: (subject: string) => bySubject.get(subject) ?? [],
    general,
  };
}

// Groups a warning code with the item that shows it.
function issueSubject(code: string) {
  const team = /^team:([^:]+):/.exec(code)?.[1];
  if (team) return `team:${team}`;
  if (code.startsWith('transfer:')) return 'transfers';
  if (code.startsWith('rank:')) return 'rank';
  return /^(upkeep:[a-z-]+):/.exec(code)?.[1] ?? null;
}

function requires({ projection }: Context, prefix: string) {
  return projection.requirements.some((key) => key.startsWith(prefix));
}

function sectionStatus(open: boolean, resolved: boolean): UpkeepSectionStatus {
  return open || !resolved ? 'open' : 'resolved';
}

function trainingDelta({ projection }: Context, step: TrainingStep) {
  const change = projection.plan.find(
    (item) => item.kind === 'training' && item.step === step,
  );
  return change?.kind === 'training' ? change.after - change.before : null;
}

function roll({ rolls }: Context, field: RollFact['field']) {
  return rolls.find((fact) => fact.field === field) ?? null;
}

function loss(
  context: Context,
  field: RollFact['field'],
  step: TrainingStep,
  rank: number | null,
): UpkeepLoss | null {
  const fact = roll(context, field);
  if (!fact) return null;
  return {
    ...fact,
    rank,
    multiplier: lossMultiplier(context.draft),
    trainingDelta: trainingDelta(context, step),
    issues: context.issues(
      field === 'training'
        ? 'upkeep:attrition-training'
        : field === 'notoriety'
          ? 'upkeep:notoriety-training'
          : 'upkeep:shortage',
    ),
  };
}

function teamsSection(context: Context): UpkeepSections['teams'] {
  const { draft, snapshot, projection } = context;
  const teams = conditionTeams(snapshot);
  const disabled = teams
    .filter((team) => team.status === 'disabled')
    .map((team) => disabledTeam(context, team));
  const orphans = draft.upkeep.teamDecisions
    .filter((decision) =>
      projection.requirements.includes(`team:${decision.teamId}:reference`),
    )
    .map((decision) => ({ teamId: decision.teamId }));
  const open =
    orphans.length > 0 ||
    teams.some((team) => requires(context, `team:${team.teamId}:`));
  const missing = teams
    .filter((team) => team.status === 'missing')
    .map((team) => missingTeam(context, team));
  // Only missing-team return rolls left, or a choice/reason still to make.
  const rollsOnly =
    orphans.length === 0 &&
    disabled.every(
      (team) => team.decision !== null && !team.fundsException?.required,
    );
  return {
    status: open ? 'open' : teams.length === 0 ? 'inapplicable' : 'resolved',
    need: open ? (rollsOnly ? 'roll' : 'decision') : null,
    treasuryBeforeCopper: snapshot.treasuryCopper,
    treasuryAfterRecoveryCopper:
      snapshot.treasuryCopper +
      projection.plan.reduce(
        (sum, change) =>
          change.kind === 'treasury' && change.sourceId.startsWith('recovery:')
            ? sum + change.after - change.before
            : sum,
        0,
      ),
    adjustments: disabled.flatMap((team) =>
      team.decision === 'recover' && team.adjustment
        ? [
            {
              teamId: team.teamId,
              name: team.name,
              deltaCopper: team.adjustment.deltaCopper,
            },
          ]
        : [],
    ),
    disabled,
    missing,
    orphans,
  };
}

// The training roll exists once the Loyalty check is in; rank is added only
// on a failure.
function attritionSection(context: Context): UpkeepSections['attrition'] {
  const check = roll(context, 'check');
  if (!check) throw new Error('Upkeep always has an attrition check');
  const result =
    check.total === null
      ? null
      : attritionOutcome(check.total, check.normalized.naturalValue);
  const delta = trainingDelta(context, 'attrition');
  return {
    status: sectionStatus(
      requires(context, 'upkeep:attrition'),
      delta !== null,
    ),
    trainingDelta: delta,
    check: { ...check, result, issues: context.issues('upkeep:attrition') },
    training: loss(
      context,
      'training',
      'attrition',
      result === 'failure' ? context.snapshot.rank : null,
    ),
  };
}

// Only at maximum notoriety; the settlement matters only after a failed
// check. Retained rolls below the threshold stay inert.
function notorietySection(context: Context): UpkeepSections['notoriety'] {
  const { draft, snapshot, projection } = context;
  const threshold = UPKEEP_RULES.maximumNotoriety;
  if (snapshot.notoriety < threshold)
    return {
      status: 'inapplicable',
      notoriety: snapshot.notoriety,
      threshold,
      trainingDelta: null,
      loss: null,
      check: null,
      settlement: null,
    };
  const check = roll(context, 'notorietyCheck');
  const result = check?.total == null ? null : notorietyOutcome(check.total);
  const delta = trainingDelta(context, 'notoriety');
  const reputation = projection.plan.find(
    (change) => change.kind === 'settlement_reputation',
  );
  return {
    status: sectionStatus(
      requires(context, 'upkeep:notoriety'),
      delta !== null && result !== null,
    ),
    notoriety: snapshot.notoriety,
    threshold,
    trainingDelta: delta,
    loss: loss(context, 'notoriety', 'notoriety', snapshot.rank),
    check: check
      ? { ...check, result, issues: context.issues('upkeep:notoriety') }
      : null,
    settlement: {
      required: result === 'failure',
      selected: draft.upkeep.nearestSettlementId ?? null,
      choices: snapshot.settlements.map((settlement) => ({
        settlementId: settlement.settlementId,
        name: settlement.name,
        reputation: settlement.reputation,
      })),
      change:
        reputation?.kind === 'settlement_reputation'
          ? {
              name:
                snapshot.settlements.find(
                  (item) => item.settlementId === reputation.settlementId,
                )?.name ?? 'Settlement',
              before: reputation.before,
              after: reputation.after,
            }
          : null,
      issues: projection.requirements.includes(
        'upkeep:notoriety:settlement-reputation',
      )
        ? [
            {
              code: 'upkeep:notoriety:settlement-reputation',
              message:
                'The chosen settlement has no recorded reputation to lower. Record it in Militia corrections or choose another settlement.',
            },
          ]
        : [],
    },
  };
}

// Judged on the Rules Baseline treasury after recovery, before transfers.
// Undecided recoveries that could cross the minimum leave it waiting.
function shortageSection(
  context: Context,
  teams: UpkeepSections['teams'],
): UpkeepSections['shortage'] {
  const minimum = context.minimumTreasuryCopper;
  const after = teams.treasuryAfterRecoveryCopper;
  const facts = {
    treasuryAfterRecoveryCopper: after,
    minimumCopper: minimum,
  };
  if (after < minimum) {
    const delta = trainingDelta(context, 'shortage');
    return {
      ...facts,
      status: sectionStatus(
        requires(context, 'upkeep:shortage'),
        delta !== null,
      ),
      trainingDelta: delta,
      loss: loss(context, 'loss', 'shortage', context.snapshot.rank),
    };
  }
  const pending = teams.disabled.reduce(
    (sum, team) => (team.decision === null ? sum + team.rulesCostCopper : sum),
    0,
  );
  return {
    ...facts,
    status:
      pending > 0 && after - pending < minimum ? 'waiting' : 'inapplicable',
    trainingDelta: null,
    loss: null,
  };
}

// Step 5 in staged order. The header spans the transfers and any Theft on
// them; Table Adjustments apply after the whole week, so they are only named.
function transfersSection(
  context: Context,
  earlierOpen: boolean,
  transfers: UpkeepView['transfers'],
): UpkeepSections['transfers'] {
  const { projection } = context;
  const ids = new Set(transfers.map((item) => item.transferId));
  const owner = (issue: UpkeepIssue) => issue.code.split(':')[1] ?? '';
  const sectionIssues = context.issues('transfers');
  const items = transfers.map((transfer) =>
    transferItem(
      context,
      transfer,
      sectionIssues.filter((issue) => owner(issue) === transfer.transferId),
    ),
  );
  const issues = sectionIssues.filter((issue) => !ids.has(owner(issue)));
  const facts = { items, adjustments: treasuryAdjustments(context), issues };
  if (earlierOpen)
    return {
      status: 'waiting',
      beforeCopper: null,
      afterCopper: null,
      ...facts,
    };
  const outcome = projection.outcome.treasuryCopper;
  const transferred = projection.plan.reduce(
    (sum, change) =>
      change.kind === 'treasury' &&
      (ids.has(change.sourceId) || change.sourceId.startsWith('theft:'))
        ? sum + change.after - change.before
        : sum,
    0,
  );
  return {
    status: requires(context, 'transfer:') ? 'open' : 'resolved',
    beforeCopper: outcome - transferred,
    afterCopper: outcome,
    ...facts,
  };
}

function transferItem(
  { draft, projection }: Context,
  transfer: UpkeepView['transfers'][number],
  issues: UpkeepIssue[],
): UpkeepTransfer {
  const theft = projection.plan.find(
    (change): change is Extract<typeof change, { kind: 'treasury' }> =>
      change.kind === 'treasury' &&
      change.sourceId.startsWith('theft:') &&
      change.sourceId.endsWith(`:${transfer.transferId}`),
  );
  const exception = draft.rulesExceptions.find(
    (item) =>
      item.subjectId === transfer.transferId &&
      item.ruleId === 'upkeep-transfer-funds',
  );
  const required = projection.requirements.includes(
    `transfer:${transfer.transferId}:funds-exception`,
  );
  return {
    transferId: transfer.transferId,
    direction: transfer.direction,
    copper: transfer.copper,
    theftCopper: theft ? theft.after - theft.before : null,
    fundsException:
      exception || required
        ? {
            exceptionId:
              exception?.exceptionId ??
              transferFundsExceptionId(transfer.transferId),
            reason: exception?.reason ?? '',
            required,
          }
        : null,
    issues,
  };
}

// The existing funds-exception identity for a withdrawal.
export function transferFundsExceptionId(transferId: string) {
  return `upkeep:upkeep-transfer-funds:${transferId}`;
}

function treasuryAdjustments({
  draft,
  snapshot,
}: Context): UpkeepSections['transfers']['adjustments'] {
  return draft.tableAdjustments.flatMap((adjustment) => {
    if (
      adjustment.kind !== 'militia_value' ||
      adjustment.field !== 'treasuryCopper'
    )
      return [];
    const teamId = /^upkeep-recovery:(.+)$/.exec(adjustment.adjustmentId)?.[1];
    const team = snapshot.roster.teams.find((item) => item.teamId === teamId);
    return [
      {
        adjustmentId: adjustment.adjustmentId,
        label: team ? `${team.name} recovery price` : adjustment.reason,
        operation: adjustment.operation,
        copper: adjustment.value,
      },
    ];
  });
}

function teamDecision(draft: WeeklyDraft, teamId: string) {
  return draft.upkeep.teamDecisions.find((item) => item.teamId === teamId);
}

function teamKind(team: SnapshotTeam) {
  const entry = teamTable.find((item) => item.id === team.teamType);
  return { typeName: entry?.name ?? team.teamType, tier: entry?.tier ?? null };
}

// The existing recovery-funds exception identity for a team.
export function recoveryFundsExceptionId(teamId: string) {
  return `upkeep:upkeep-recovery-funds:${teamId}`;
}

function disabledTeam(
  { draft, projection, minimumTreasuryCopper, issues }: Context,
  team: SnapshotTeam,
): UpkeepDisabledTeam {
  const decision = teamDecision(draft, team.teamId)?.decision;
  const recorded = draft.tableAdjustments.find(
    (item) => item.adjustmentId === `upkeep-recovery:${team.teamId}`,
  );
  const adjustment =
    recorded?.kind === 'militia_value' &&
    recorded.field === 'treasuryCopper' &&
    recorded.operation === 'add'
      ? { deltaCopper: recorded.value, reason: recorded.reason }
      : null;
  const exception = draft.rulesExceptions.find(
    (item) =>
      item.subjectId === team.teamId && item.ruleId === 'upkeep-recovery-funds',
  );
  const required = projection.requirements.includes(
    `team:${team.teamId}:recovery-funds-exception`,
  );
  return {
    teamId: team.teamId,
    name: team.name,
    ...teamKind(team),
    decision: decision ?? null,
    rulesCostCopper: minimumTreasuryCopper,
    enteredCostCopper: minimumTreasuryCopper - (adjustment?.deltaCopper ?? 0),
    adjustment,
    // A recorded ruling belongs under the team only while it is recovering.
    fundsException:
      (exception && decision === 'recover') || required
        ? {
            exceptionId:
              exception?.exceptionId ?? recoveryFundsExceptionId(team.teamId),
            reason: exception?.reason ?? '',
            required,
          }
        : null,
    issues: issues(`team:${team.teamId}`),
  };
}

function missingTeam(context: Context, team: SnapshotTeam): UpkeepMissingTeam {
  return {
    teamId: team.teamId,
    name: team.name,
    ...teamKind(team),
    return: teamReturn(context, team.teamId),
    issues: context.issues(`team:${team.teamId}`),
  };
}

// A queued return replaces the check; otherwise the check row is shown
// whenever the rules ask for it, including an incompatible recorded roll.
function teamReturn(
  { draft, snapshot, projection }: Context,
  teamId: string,
): UpkeepMissingTeam['return'] {
  const scheduled = draft.context.queuedEffects.find(
    (effect) =>
      effect.effect.kind === 'team_return' &&
      effect.effect.teamId === teamId &&
      effect.endsWeek >= draft.week,
  );
  if (scheduled?.effect.kind === 'team_return')
    return {
      kind: 'scheduled',
      week: Math.max(scheduled.startsWeek, draft.week),
      status: scheduled.effect.status,
    };
  const checkId = `team:${teamId}:return`;
  const check = projection.checks.find((item) => item.checkId === checkId);
  const needsRoll =
    check !== undefined ||
    projection.requirements.some(
      (key) => key === `${checkId}:roll` || key.startsWith(`${checkId}:dice:`),
    );
  if (!needsRoll) return null;
  const recorded = teamDecision(draft, teamId)?.roll;
  // The bonus is known before the die; the total only once it is entered.
  const preview = previewUpkeepCheck(
    draft,
    snapshot,
    projection,
    checkId,
    'security',
  );
  const total = check?.total ?? null;
  return {
    kind: 'check',
    check: {
      ...d20,
      ...rollReadFacts(recorded, d20),
      dc: UPKEEP_RULES.returnDc,
      modifier: preview.modifier,
      total,
      modifiers: preview.modifiers,
      result:
        total === null
          ? null
          : returnOutcome(total, normalizeRawRoll(recorded, d20).naturalValue),
      issues: [],
    },
  };
}
