import { z } from 'zod';
import { readLegalRecord } from '../legal-records.ts';

/**
 * The held notices (`held-notices.json`, which the gate holds notices by and
 * `pnpm catalog:format` keeps canonical), read through the loader: each hold's
 * id, the notices it holds and the records that are its evidence. The schema
 * is the file's whole shape, so a hold with another field, or the encoded
 * form's wrapper, fails the parse instead of being read as something else.
 */
const heldNoticesSchema = z.array(
  z.strictObject({
    id: z.string(),
    notices: z.array(z.string()),
    evidence: z.array(z.string()),
  }),
);

export const heldNotices = heldNoticesSchema.parse(
  readLegalRecord('held-notices.json'),
);
