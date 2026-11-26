import { z } from 'zod';
import data from './attribution-227-book-overrides.json' with { type: 'json' };

/**
 * The reviewed book overrides of the #227 scripted match (root decision P0 of
 * 2026-11-26, pbl-match-freeze): for a record that declares no book, the
 * books a confirmed Attribution Assessment already names, which the matcher
 * (`attribution-227-matcher.ts`) gives it before the name match is read. Its
 * match row then names only these books (and the record's frozen
 * stored-assessment evidence, whose books the override must include) and says
 * they come from this file. The gate reads the matches file, never this one.
 *
 * Each row names its entry, its books (sorted, each once), the confirmed
 * assessment it copies them from and a one-line reason; a key is listed once.
 * The matcher refuses a row whose key is not a record the match reads or
 * whose books leave out its frozen stored assessment's. Neither the match nor
 * its bound inputs include the register, so a valid notice edit never stales
 * the match; that each book resolves to a Section 15 Registry record (reviewed
 * or not) is a suite test over the committed files
 * (`attribution-227-book-overrides.test.ts`).
 */
const text = z.string().min(1);
export const attribution227BookOverrideSchema = z.strictObject({
  externalKey: text,
  books: z
    .tuple([text], text)
    .readonly()
    .refine(
      (books) => books.slice(1).every((book, at) => (books[at] ?? '') < book),
      'Books must be sorted, each once.',
    ),
  /** The confirmed Attribution Assessment the books are copied from. */
  assessment: z.strictObject({
    externalKey: text,
    status: z.literal('confirmed'),
    reviewedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  reason: text,
});
export type Attribution227BookOverride = z.infer<
  typeof attribution227BookOverrideSchema
>;

export const attribution227BookOverridesSchema = z
  .strictObject({
    version: z.literal(1),
    overrides: z.array(attribution227BookOverrideSchema).readonly(),
  })
  .superRefine(({ overrides }, context) => {
    const seen = new Set<string>();
    overrides.forEach(({ externalKey }, index) => {
      if (seen.has(externalKey))
        context.addIssue({
          code: 'custom',
          path: ['overrides', index, 'externalKey'],
          message: `Duplicate override key ${externalKey}.`,
        });
      seen.add(externalKey);
    });
  });

/** The rows of a book overrides file, or a refusal naming each problem. */
export const parseAttribution227BookOverrides = (
  value: unknown,
): readonly Attribution227BookOverride[] =>
  attribution227BookOverridesSchema.parse(value).overrides;

export const committedAttribution227BookOverrides =
  parseAttribution227BookOverrides(data);
