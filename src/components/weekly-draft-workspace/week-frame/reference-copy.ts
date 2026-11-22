import type { ReferenceFacts, ReferenceValues } from '../reference-facts';
import type { PhaseReadiness } from '../types';

// Plain-language presentation of the reference facts. Values are displayed
// only; nothing here derives a rule. "After the week" is shown only when the
// Resolution Preview has a final outcome; until then the column says so
// instead of repeating Now, showing zero or an older forecast.

export const awaitingDecisions = 'Awaiting decisions';

const gp = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

/** Copper is stored; gp is shown, as the Summary decision settled. */
export function formatGold(copper: number): string {
  return `${gp.format(copper / 100)} gp`;
}

export const teamStatusLabels: Record<
  ReferenceValues['teams'][number]['status'],
  string
> = {
  active: 'Active',
  disabled: 'Disabled',
  missing: 'Missing',
  blocked: 'Blocked',
};

export const officerRoleLabels: Record<string, string> = {
  ambassador: 'Ambassador',
  commandant: 'Commandant',
  marshal: 'Marshal',
  overseer: 'Overseer',
  spymaster: 'Spymaster',
  strategist: 'Strategist',
};

export function officerRoles(roles: string[]): string {
  if (roles.length === 0) return 'No officer role';
  return roles.map((role) => officerRoleLabels[role] ?? role).join(', ');
}

export function focusLabel(focus: ReferenceValues['focus']): string {
  return focus ?? 'Not set';
}

export function treasuryLine(values: ReferenceValues): string {
  const minimum =
    values.minimumTreasuryCopper === null
      ? 'minimum unknown'
      : `minimum ${formatGold(values.minimumTreasuryCopper)}`;
  return `${formatGold(values.treasuryCopper)} · ${minimum}`;
}

/** One Now / After row of the Militia tab; `key` is a stable identity. */
export type ValueRow = {
  key: string;
  label: string;
  now: string;
  after: string;
};

export function valueRows(facts: ReferenceFacts): ValueRow[] {
  const { now, after } = facts;
  const pair = (
    label: string,
    read: (values: ReferenceValues) => string,
  ): ValueRow => ({
    key: label,
    label,
    now: read(now),
    after: after ? read(after) : awaitingDecisions,
  });
  return [
    pair('Rank', (values) => String(values.rank)),
    pair('Training', (values) => String(values.training)),
    pair('Treasury', treasuryLine),
    pair('Notoriety', (values) => String(values.notoriety)),
    pair('Focus', (values) => focusLabel(values.focus)),
  ];
}

export const notYetRecruited = 'Not yet recruited';

/**
 * Team conditions now and, when known, after the week: every team of either
 * roster, keyed by identity (names need not be unique). A team recruited
 * this week has no Now condition; a team gone by the end has no After.
 */
export function teamRows(facts: ReferenceFacts): ValueRow[] {
  const rows = new Map<string, ValueRow>();
  for (const team of facts.now.teams)
    rows.set(team.teamId, {
      key: team.teamId,
      label: team.name,
      now: teamStatusLabels[team.status],
      after: facts.after ? 'Gone' : awaitingDecisions,
    });
  for (const team of facts.after?.teams ?? []) {
    const row = rows.get(team.teamId);
    if (row) row.after = teamStatusLabels[team.status];
    else
      rows.set(team.teamId, {
        key: team.teamId,
        label: team.name,
        now: notYetRecruited,
        after: teamStatusLabels[team.status],
      });
  }
  return [...rows.values()];
}

// This week's draft context: what the current draft uses, never a stored
// value from before the week or the next week's allowance.
export function actionsLine(facts: ReferenceFacts): string {
  const { used, allowance, provisional } = facts.thisWeek.actions;
  const base =
    allowance === null
      ? `${used} used · allowance unavailable`
      : `${used} of ${allowance} used`;
  return provisional ? `${base} · provisional until Upkeep is ready` : base;
}

export function eventChanceLine(facts: ReferenceFacts): string {
  const chance = facts.thisWeek.eventChance;
  if (!chance) return 'Unavailable';
  const base = chance.guaranteed
    ? `${chance.percent}% · an event is guaranteed`
    : `${chance.percent}%`;
  return chance.provisional
    ? `${base} · provisional until Upkeep and Activity are ready`
    : base;
}

export function carriedEventLine(
  event: ReferenceFacts['carriedEvents'][number],
): string {
  const targets = event.targetNames.length
    ? event.targetNames.join(', ')
    : 'Militia';
  return `${event.name} · ${event.ageWeeks} weeks · ${targets}`;
}

export function plural(value: number, noun: string) {
  return `${value} ${noun}${value === 1 ? '' : 's'}`;
}

/**
 * The phone strip's short readiness: open decisions, else warnings, else
 * nothing; Review & confirm shows only the disabled-Confirmation reason.
 */
export function stripReadiness(
  step: PhaseReadiness,
  confirmationDisabledReason: string | null,
): string {
  if (step.phase === 'summary') return confirmationDisabledReason ?? '';
  if (!step.available) return '';
  if (step.requirements.length) return `${step.requirements.length} to decide`;
  if (step.warnings.length) return plural(step.warnings.length, 'warning');
  return '';
}

/** Training and Treasury now → after for the phone strip. */
export function stripValues(
  facts: ReferenceFacts,
): { label: string; value: string }[] {
  const arrow = (now: string, after: string | null) =>
    after === null ? `${now} → …` : after === now ? now : `${now} → ${after}`;
  return [
    {
      label: 'Training',
      value: arrow(
        String(facts.now.training),
        facts.after ? String(facts.after.training) : null,
      ),
    },
    {
      label: 'Treasury',
      value: arrow(
        formatGold(facts.now.treasuryCopper),
        facts.after ? formatGold(facts.after.treasuryCopper) : null,
      ),
    },
  ];
}
