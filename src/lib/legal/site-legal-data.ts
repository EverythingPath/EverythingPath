import { buildLegalPageData } from '../catalog/legal-page-data.ts';
import { legalResources } from '../catalog/legal-resources-data.ts';
import siteNoticesData from './site-notices.json';
import { siteNoticesSchema, withSiteLegal } from './site-legal.ts';

// The committed site layer. The client hook bundles this module, so it
// imports only light data: never `reviewed-data.ts`.
export const committedSiteLegal = {
  paizo: legalResources.paizo,
  siteNotices: siteNoticesSchema.parse(siteNoticesData),
};

/** The public legal page: the catalog notices plus the committed site layer. */
export function buildPublicLegalPageData(
  inputs: Parameters<typeof buildLegalPageData>[0],
) {
  return withSiteLegal(buildLegalPageData(inputs), committedSiteLegal);
}
