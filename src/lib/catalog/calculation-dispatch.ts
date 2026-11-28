import {
  calculateCharacterSheet,
  calculateCharacterSheetProjections,
  type CharacterSheetInput,
} from '../character-sheet';
import {
  currentCalculationIdentity,
  priorCalculationIdentity,
} from './calculation-identities';

/**
 * Whether `identity` is in this deploy's calculation window: its current
 * identity, or the prior one it replaced (#413 F8). Both are calculated by the
 * deployed calculator; no earlier calculator is kept.
 */
export function isInCalculationWindow(identity: string) {
  return (
    identity === priorCalculationIdentity ||
    identity === currentCalculationIdentity
  );
}

const afterRotatingDeploy =
  'docs/catalog-import/releases.md#after-a-deploy-that-rotates-the-calculation-identity';

/**
 * Why a release for `identity` is refused, and what recovers it: only code
 * whose window includes the identity can serve it.
 */
export function outsideCalculationWindowMessage(identity: string) {
  return (
    `Catalog Release calculation identity ${identity} is outside this deploy's calculation window ` +
    `(current ${currentCalculationIdentity}, prior ${priorCalculationIdentity}). ` +
    `Redeploy code whose window includes ${identity}, then activate a resolver-only release for the deployed identity ` +
    `(${afterRotatingDeploy}).`
  );
}

function calculationInput(identity: string, input: CharacterSheetInput) {
  if (!isInCalculationWindow(identity))
    throw new Error(outsideCalculationWindowMessage(identity));
  // Both identities in the window consume reviewed release resources over the bundled tables.
  return input;
}

export function calculateCharacterSheetForRelease(
  identity: string,
  input: CharacterSheetInput,
  options?: Parameters<typeof calculateCharacterSheet>[1],
) {
  return calculateCharacterSheet(calculationInput(identity, input), options);
}

export function calculateCharacterSheetProjectionsForRelease(
  identity: string,
  input: CharacterSheetInput,
  options?: Parameters<typeof calculateCharacterSheetProjections>[1],
) {
  return calculateCharacterSheetProjections(
    calculationInput(identity, input),
    options,
  );
}
