import {
  currentCalculationIdentity,
  retainedPriorCalculationIdentity,
} from './calculation-identities';

/**
 * The calculation identities this checkout serves (#413 F8b): its current
 * identity, and the identity it replaced, still served through the same
 * calculator so that the release activated for it keeps resolving after a
 * rotating deploy until a resolver-only release for the current identity is
 * activated. No earlier calculator is kept.
 */
export type CalculationWindow = { current: string; prior: string };

const deployedWindow: CalculationWindow = {
  current: currentCalculationIdentity,
  prior: retainedPriorCalculationIdentity,
};

/** How this checkout would serve a release activated for `identity`. */
export type CalculationServing = 'current' | 'prior' | 'outside-window';

export function calculationServing(
  identity: string,
  window: CalculationWindow = deployedWindow,
): CalculationServing {
  if (identity === window.current) return 'current';
  if (identity === window.prior) return 'prior';
  return 'outside-window';
}

/**
 * Why a window must not ship over the identity activated in production, or
 * null when it serves it (or nothing has been activated in production yet).
 */
export function productionWindowRefusal(
  productionIdentity: string | null,
  window: CalculationWindow = deployedWindow,
) {
  if (
    productionIdentity === null ||
    calculationServing(productionIdentity, window) !== 'outside-window'
  )
    return null;
  return (
    `This calculation identity rotation drops ${productionIdentity}, the calculation identity activated in production, ` +
    `from the supported window (current ${window.current}, prior ${window.prior}): after its deploy every sheet read fails closed. ` +
    `First activate in production a resolver-only release for ${window.prior}, the identity this rotation replaces ` +
    '(docs/catalog-import/releases.md, "After a deploy that rotates the calculation identity"), and record it in ' +
    'src/lib/catalog/production-calculation-identity.ts.'
  );
}

const productionRecordFile =
  'src/lib/catalog/production-calculation-identity.ts';
const guardSeesOnlyTheRecord =
  'The rotation guard sees only the recorded identity.';

/** What the operator records after `activate --production` (#413 F8). */
export function productionRecordReminder(activatedIdentity: string) {
  return `Record ${activatedIdentity} as productionActivatedCalculationIdentity in ${productionRecordFile}: send it to root, who commits it. ${guardSeesOnlyTheRecord}`;
}

/**
 * Whether the identity active in production is the one recorded for the
 * rotation guard: `active` reports it, so a forgotten record shows up at the
 * runbook's first step after every deploy (#413 F8).
 */
export type ProductionRecord =
  | { kind: 'recorded' }
  | { kind: 'not-recorded'; reminder: string }
  | { kind: 'recorded-other'; recorded: string; reminder: string };

export function productionRecord(
  activeIdentity: string,
  recorded: string | null,
): ProductionRecord {
  if (recorded === activeIdentity) return { kind: 'recorded' };
  const action = `send it to root to record as productionActivatedCalculationIdentity. ${guardSeesOnlyTheRecord}`;
  if (recorded === null)
    return {
      kind: 'not-recorded',
      reminder: `The active release's calculation identity ${activeIdentity} is not recorded in ${productionRecordFile}: ${action}`,
    };
  return {
    kind: 'recorded-other',
    recorded,
    reminder: `The active release's calculation identity ${activeIdentity} is not the one recorded in ${productionRecordFile} (${recorded}): ${action}`,
  };
}
