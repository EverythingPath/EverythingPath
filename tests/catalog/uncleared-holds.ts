import { assessBatchAdmission } from './batch-admission';

/**
 * The gate with no notice hold cleared. The owner cleared every notice hold,
 * the importer's source groups included, on 2026-10-30
 * (`scripts/catalog/legal/notice-clearances.json`), and the gate applies that
 * clearance by default. A batch test that proves its own holds
 * are recorded and enforced runs the gate this way, so it still shows what
 * each hold would hold; `notice-clearances.test.ts` and `admission.test.ts`
 * cover the clearance itself. Like every batch test's gate, it runs the
 * assessment path alone (`batch-admission.ts`).
 */
export function assessWithUnclearedHolds(
  input: Parameters<typeof assessBatchAdmission>[0],
) {
  return assessBatchAdmission({
    ...input,
    clearedHoldIds: [],
    clearedImporterHolds: [],
  });
}
