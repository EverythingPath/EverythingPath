import { z } from 'zod';
import { readLegalRecord } from '../../scripts/catalog/legal-records';

/**
 * What every batch inventory records for each candidate: its key, name and
 * disposition. Every other field is kept as recorded and typed `unknown`: a
 * test that reads one checks it itself.
 */
const legalInventorySchema = z.looseObject({
  candidates: z.array(
    z.looseObject({
      externalKey: z.string(),
      name: z.string(),
      disposition: z.string(),
    }),
  ),
});
type LegalInventory = z.infer<typeof legalInventorySchema>;

/**
 * A batch inventory by its legal record's file name (`feats-347.json`), read
 * through the loader and parsed: a record without candidates, such as the
 * encoded form's wrapper read bare, fails instead of reading as empty.
 */
export function readLegalInventory(name: string): LegalInventory {
  return legalInventorySchema.parse(readLegalRecord(name));
}
