import {
  currentCalculationIdentity,
  retainedPriorCalculationIdentity,
  supersededCalculationIdentities,
} from '../../src/lib/catalog/calculation-identities';
import type { CatalogReleaseManifest } from '../../src/lib/catalog/release-schema';
import { catalogRuntimeCompatibility } from '../../src/lib/catalog/runtime-compatibility';

/** The calculation identity the #348 to #355 release fixtures were prepared with. */
export const featReleaseFixtureCalculation =
  'sha256:d7a42ca346d875f9497c7da94325022ac289d7931226a3649979a13f410c8063';

const knownCalculationIdentities = [
  currentCalculationIdentity,
  retainedPriorCalculationIdentity,
  ...supersededCalculationIdentities,
];

/**
 * A frozen release fixture against the calculation identity it recorded. The
 * fixture keeps its recorded identity when later changes rotate the current
 * one; that identity must still be one the identities module has known.
 */
export function findReleaseCompatibilityProblems({
  compatibility,
  recordedCalculation,
}: {
  compatibility: CatalogReleaseManifest['compatibility'];
  recordedCalculation: string;
}): string[] {
  const problems: string[] = [];
  if (compatibility.schema !== catalogRuntimeCompatibility.schema)
    problems.push(
      `schema ${compatibility.schema} is not ${catalogRuntimeCompatibility.schema}`,
    );
  if (compatibility.calculation !== recordedCalculation)
    problems.push(
      `calculation ${compatibility.calculation} is not the recorded ${recordedCalculation}`,
    );
  else if (!knownCalculationIdentities.includes(compatibility.calculation))
    problems.push(
      `calculation ${compatibility.calculation} is not a known identity`,
    );
  return problems;
}
