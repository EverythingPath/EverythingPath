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
  /**
   * A fixture activation on a deployment holding no ordinary campaign or
   * private Character reads no scope; a production one, and a fixture one
   * beside ordinary data, need it QUALIFIED. The deployment's stored data, not
   * the caller's flag, decides which fixture kind applies.
   */
  activation:
    | { kind: 'fixture' }
    | { kind: 'fixture-beside-ordinary-data'; scope: CatalogScopeQualification }
    | { kind: 'production'; scope: CatalogScopeQualification };
};

function scopeReason(scope: CatalogScopeQualification) {
  if (scope.kind === 'unreported') return 'scope-unqualified: no scope report';
  if (scope.status === 'QUALIFIED') return null;
  return `scope-unqualified: ${scope.version} ${scope.status}`;
}

function activationScopeReason(
  activation: CatalogActivationReadiness['activation'],
) {
  if (activation.kind === 'fixture') return null;
  const reason = scopeReason(activation.scope);
  if (!reason || activation.kind === 'production') return reason;
  return `${reason} (fixture-only skips the scope only on a deployment without ordinary campaigns or private Characters)`;
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
  const scopeRefusal = activationScopeReason(input.activation);
  if (scopeRefusal) reasons.push(scopeRefusal);
  return { isReady: reasons.length === 0, reasons };
}
