import type { CompanionProgressionSource } from './character-sheet-companion-sources';
import type { CohortCalculationInput } from './character-sheet-cohort-schema';
import type { CompanionLinkedInputResolution } from './character-sheet-linked-inputs';

/**
 * The current companion inputs a sheet read returns for the Situation
 * preview: a progression companion's linked inputs and sources, or a
 * cohort's leader inputs and supporting sources (#417).
 */
export type CompanionCalculationInputs =
  | {
      kind: 'progression';
      companionLinkedInputs: CompanionLinkedInputResolution[];
      companionProgressionSources: CompanionProgressionSource[];
    }
  | { kind: 'cohort'; cohort: CohortCalculationInput };

/** The calculation options these inputs supply. */
export function companionCalculationOptions(
  inputs: CompanionCalculationInputs | null | undefined,
) {
  if (!inputs) return {};
  if (inputs.kind === 'cohort') return { cohort: inputs.cohort };
  return {
    companionLinkedInputs: inputs.companionLinkedInputs,
    companionProgressionSources: inputs.companionProgressionSources,
  };
}
