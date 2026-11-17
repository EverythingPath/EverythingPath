import {
  assessCatalogAdmission,
  type AttributionPath,
} from '../../scripts/catalog/admission';
import type { createCatalogRelease } from '../../scripts/catalog/release';

/**
 * A legal batch's tests run the gate on the assessment path alone. They are
 * the frozen record of what each batch's Attribution Assessments decided, not
 * of what the catalog admits: the #227 rule, which admits a row on its
 * declared book when the assessment path doesn't, is the gate's default, and
 * `admission-227.test.ts` covers it (`docs/catalog-import/curation.md`).
 */
export const batchAttributionPath = {
  kind: 'assessments-only',
} as const satisfies AttributionPath;

/** The gate as a legal batch's tests run it: the assessment path alone. */
export function assessBatchAdmission(
  input: Parameters<typeof assessCatalogAdmission>[0],
) {
  return assessCatalogAdmission({
    ...input,
    attributionPath: batchAttributionPath,
  });
}

/**
 * A Catalog Release as a legal batch's tests build it: its gate on the
 * assessment path alone. The release module loads on first use, as the
 * integration tests that call this load it.
 */
export async function createBatchRelease(
  options: Parameters<typeof createCatalogRelease>[0],
) {
  const { createCatalogRelease } =
    await import('../../scripts/catalog/release');
  return createCatalogRelease({
    ...options,
    attributionPath: batchAttributionPath,
  });
}
