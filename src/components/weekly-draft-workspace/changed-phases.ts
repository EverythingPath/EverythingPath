import type { Phase } from './types';

const order: Phase[] = ['upkeep', 'activity', 'event', 'persistent', 'summary'];
const rootOwners = new Map<string, Phase>([
  ['upkeep', 'upkeep'],
  ['activity', 'activity'],
  ['persistent', 'persistent'],
  ['acknowledgement', 'summary'],
  ['exception', 'summary'],
  ['tableAdjustments', 'summary'],
]);

function slotOwner(path: readonly string[]): Phase {
  if (path[2] !== 'choice') return 'activity';
  if (path[3] === 'acknowledgements') return 'summary';
  if (path[3] === 'candidates')
    return path[5] === 'persistentDecision' ? 'persistent' : 'event';
  return 'activity';
}

function targetOwner(path: readonly string[]): Phase | undefined {
  if (path[0] === 'slot') return slotOwner(path);
  if (path[0] === 'event')
    return path[3] === 'persistentDecision' ? 'persistent' : 'event';
  // Standalone order receipts currently have no hosted editing control.
  return rootOwners.get(path[0] ?? '');
}

/** Attribute edited targets to their hosted controls, not downstream forecasts. */
export function changedPhases(
  targets: readonly (readonly string[])[],
): Phase[] {
  const phases = new Set(targets.map(targetOwner));
  return order.filter((phase) => phases.has(phase));
}
