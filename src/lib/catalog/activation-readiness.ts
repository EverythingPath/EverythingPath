export type CatalogActivationReadiness = {
  isPrepared: boolean;
  isBaseCurrent: boolean;
  isCandidateCurrent: boolean;
  isRunCurrent: boolean;
  isDiscoveryComplete: boolean;
  hasDiscoveryFailed: boolean;
  hasDirtyWork: boolean;
  hasFailedWork: boolean;
  hasPassedGates: boolean;
  isCompatible: boolean;
};

/** The final transaction checks certificates and indexed work, never Characters. */
export function evaluateCatalogActivationReadiness(
  input: CatalogActivationReadiness,
) {
  const reasons: string[] = [];
  if (!input.isPrepared) reasons.push('not-prepared');
  if (!input.isBaseCurrent) reasons.push('base-changed');
  if (!input.isCandidateCurrent) reasons.push('candidate-superseded');
  if (!input.isRunCurrent) reasons.push('run-superseded');
  if (!input.isDiscoveryComplete) reasons.push('discovery-incomplete');
  if (input.hasDiscoveryFailed) reasons.push('discovery-failed');
  if (input.hasDirtyWork) reasons.push('pending-work');
  if (input.hasFailedWork) reasons.push('failed-work');
  if (!input.hasPassedGates) reasons.push('gates-incomplete');
  if (!input.isCompatible) reasons.push('incompatible');
  return { isReady: reasons.length === 0, reasons };
}
