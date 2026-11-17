/**
 * A prepared release's scope qualification, read from its `content:scope`
 * report row: the scope version and its status (`QUALIFIED` or `FAILED` as a
 * scoped build writes them), or `unreported` when the release has no readable
 * scope report.
 */
export type CatalogScopeQualification =
  | { kind: 'unreported' }
  | { kind: 'reported'; version: string; status: string };

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
  /** A fixture activation reads no scope; a production one needs it QUALIFIED. */
  activation:
    | { kind: 'fixture' }
    | { kind: 'production'; scope: CatalogScopeQualification };
};

function scopeReason(scope: CatalogScopeQualification) {
  if (scope.kind === 'unreported') return 'scope-unqualified: no scope report';
  if (scope.status === 'QUALIFIED') return null;
  return `scope-unqualified: ${scope.version} ${scope.status}`;
}

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
  if (input.activation.kind === 'production') {
    const reason = scopeReason(input.activation.scope);
    if (reason) reasons.push(reason);
  }
  return { isReady: reasons.length === 0, reasons };
}
