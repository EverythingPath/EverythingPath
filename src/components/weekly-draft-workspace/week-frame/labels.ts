import type { Phase } from '../types';

// The five positions in rules order. The last is shown as Review & confirm
// while its address value stays `summary`.
export const phaseLabels: Record<Phase, string> = {
  upkeep: 'Upkeep',
  activity: 'Activity',
  event: 'Event',
  persistent: 'Persistent',
  summary: 'Review & confirm',
};

export function weekHeading(week: number, phase: Phase) {
  return `Week ${week} · ${phaseLabels[phase]}`;
}
