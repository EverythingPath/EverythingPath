import {
  calculateCharacterSheet,
  calculateCharacterSheetProjections,
  type CharacterSheetInput,
} from '../character-sheet';
import {
  currentCalculationIdentity,
  retainedPriorCalculationIdentity,
} from './calculation-identities';

export function isSupportedCatalogCalculation(identity: string) {
  return (
    identity === retainedPriorCalculationIdentity ||
    identity === currentCalculationIdentity
  );
}

function calculationInput(identity: string, input: CharacterSheetInput) {
  if (!isSupportedCatalogCalculation(identity))
    throw new Error('Unavailable Catalog Release calculation behavior');
  // Both supported calculators consume reviewed release resources over the bundled tables.
  // Future changes to those defaults require retaining their implementation separately.
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
