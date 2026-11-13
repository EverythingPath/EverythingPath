import { conditionDefinitions } from '../character-sheet-conditions.ts';
import { reviewedAdmissionSchema } from './admission-schema.ts';
import registryData from './data/section15-registry.json';
export { legalResources } from './legal-resources-data.ts';

/**
 * The committed Section 15 Registry, checked by the schema `reviewed-data.ts`
 * checks it with. A Registry or legal reader imports it from here, so it
 * loads neither the Attribution Assessments nor the encoded evidence;
 * `reviewed-data.ts` still checks all of the files together.
 */
export const section15Registry =
  reviewedAdmissionSchema.shape.registry.parse(registryData);

export const conditionRequiredNotices = [
  ...new Set(
    conditionDefinitions.flatMap((condition) =>
      condition.sources.map((source) => source.book),
    ),
  ),
];
