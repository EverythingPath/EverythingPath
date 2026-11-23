/**
 * The record step's JSON writer (scripts/catalog-record-review.ts): two-space
 * indentation and a final newline. Plain JavaScript with no imports, so the
 * scripted rebase's receipts-union rule (receipts_written in
 * scripts/orchestration/gate_core.py) runs this same writer with node alone.
 *
 * @param {unknown} value
 * @returns {string}
 */
export const formatJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
