import { assessCatalogAdmission } from '../../scripts/catalog/admission';

/**
 * The gate with no notice hold cleared. The owner cleared every notice hold,
 * the importer's source groups included, on 2026-10-30
 * (`scripts/catalog/legal/notice-clearances.json`), and the gate applies that
 * clearance by default. A batch test that proves its own holds
 * are recorded and enforced runs the gate this way, so it still shows what
 * each hold would hold; `notice-clearances.test.ts` and `admission.test.ts`
 * cover the clearance itself.
 */
export function assessWithUnclearedHolds(
  input: Parameters<typeof assessCatalogAdmission>[0],
) {
  return assessCatalogAdmission({
    ...input,
    clearedHoldIds: [],
    clearedImporterHolds: [],
  });
}
