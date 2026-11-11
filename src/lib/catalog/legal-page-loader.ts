import { buildPublicLegalPageData } from '~/lib/legal/site-legal-data';
import type { buildLegalPageData } from './legal-page-data';
import {
  conditionRequiredNotices,
  legalResources,
  section15Registry,
} from './section15-registry-data';
import { releaseLegalInputsSchema } from './release-legal-inputs';

export async function loadLegalPageData(
  fetchActiveInputs: () => Promise<unknown>,
) {
  const defaults = {
    registry: section15Registry,
    resources: legalResources,
    permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
    requiredNotices: conditionRequiredNotices,
  };
  let inputs: Parameters<typeof buildLegalPageData>[0] = defaults;
  try {
    const activeInputs = await fetchActiveInputs();
    if (activeInputs !== null)
      inputs = releaseLegalInputsSchema.parse(activeInputs);
  } catch {
    // A frontend deployment can precede the backend's legal query.
  }
  return buildPublicLegalPageData(inputs);
}
