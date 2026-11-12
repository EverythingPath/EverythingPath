import { reviewedAdmissionFilesSchema } from './attribution-evidence-codec.ts';
import registryData from './data/section15-registry.json';
import assessmentsData from './data/attribution-assessments.json';
import evidenceData from './data/attribution-evidence.json';
export { legalResources } from './legal-resources-data.ts';

// The evidence is committed encoded (#744). It is checked together with the
// other files, so every malformed file is reported, then decoded for readers.
// A reader of the Registry alone uses `section15-registry-data.ts`.
export const reviewedAdmission = reviewedAdmissionFilesSchema.parse({
  assessments: assessmentsData,
  evidence: evidenceData,
  registry: registryData,
});
