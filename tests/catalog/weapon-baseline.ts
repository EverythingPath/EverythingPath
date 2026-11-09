import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { importedWeaponSchema } from '../../src/lib/catalog/imported-item';
// Read as unknown, as the existing fixture helpers do: a large inferred JSON
// union adds compiler work without strengthening these independent expectations.
const rawBaseline: unknown = JSON.parse(
  readFileSync(
    new URL('../fixtures/weapon-baseline-761.json', import.meta.url),
    'utf8',
  ),
);
export const baseline = z
  .array(
    z.strictObject({
      key: z.string().min(1),
      source: z.string().min(1),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
      contracts: z.array(z.string()),
      candidateRefusal: z.string().optional(),
      expected: z.strictObject({
        kind: z.literal('item'),
        consumable: z.boolean(),
        price: z.number(),
        weight: z.number(),
        ammunition: z.literal(true).optional(),
        weapon: importedWeaponSchema.optional(),
        magic: z
          .strictObject({ enhancement: z.number(), masterwork: z.boolean() })
          .optional(),
      }),
    }),
  )
  .parse(rawBaseline);
