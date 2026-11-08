import type { PhaseReadiness } from '../types';
import { phaseLabels } from './labels';

function count(value: number, noun: string) {
  return `${value} ${noun}${value === 1 ? '' : 's'}`;
}

export const lockedCaption = 'No carried events';
export const skippedCaption = 'Skipped · first week';

/**
 * The short caption under a step. Review & confirm has none (the Summary
 * amendment); a locked Persistent says why; otherwise the open decisions or
 * a check-equivalent "Ready", each with a separate warning count.
 */
export function stepCaption(step: PhaseReadiness): string | null {
  if (!step.available) return lockedCaption;
  if (step.skipped) return skippedCaption;
  if (step.phase === 'summary') return null;
  const warnings = step.warnings.length
    ? ` · ${count(step.warnings.length, 'warning')}`
    : '';
  const decisions = step.requirements.length;
  return `${step.ready ? 'Ready' : `${decisions} to decide`}${warnings}`;
}

/**
 * The footer/strip line for the current phase. Review & confirm shows only
 * the authoritative disabled-Confirmation reason (nothing when ready).
 */
export function readinessLine(
  step: PhaseReadiness,
  confirmationDisabledReason: string | null,
): string {
  if (step.phase === 'summary') return confirmationDisabledReason ?? '';
  if (step.skipped) return 'Upkeep is skipped for the militia’s first week.';
  const label = phaseLabels[step.phase];
  const line = step.ready
    ? `${label} is ready.`
    : `Complete the required rolls and decisions to finish ${label}.`;
  return step.warnings.length
    ? `${line} ${count(step.warnings.length, 'warning')}.`
    : line;
}

/**
 * The warning count beside the pinned Confirm week: the review block's own
 * Warnings list, which the footer and strip otherwise leave off-screen.
 * Advisory only, never a reason Confirm is unavailable. Null without any.
 */
export function confirmWarnings(step: PhaseReadiness): string | null {
  return step.warnings.length ? count(step.warnings.length, 'warning') : null;
}

/** Progress segment state for the phone indicator. */
export function stepState(
  step: PhaseReadiness,
  current: PhaseReadiness['phase'],
): 'current' | 'locked' | 'done' | 'open' {
  if (step.phase === current) return 'current';
  if (!step.available) return 'locked';
  if (step.phase === 'summary') return 'open';
  return step.ready ? 'done' : 'open';
}
