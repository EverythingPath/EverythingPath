import { z } from 'zod';
import data from './pcgen-books.json' with { type: 'json' };
import noticeData from './pcgen-notice-books.json' with { type: 'json' };

/**
 * The #716 book crosswalk (`pcgen-books.json`, plan §1 and Appendix C): each
 * book PCGen's archetypes and prestige classes come from, its PZO code and its
 * Section 15 Registry title.
 *
 * - A book is named by the SOURCELONG of its records' list files, else of its
 *   pack's `.pcc`, read through `normalizePcgenBookTitle`; `title` cites the
 *   pack's `.pcc`, or a list file where the `.pcc` has none. A `support/` pack
 *   counts toward its parent book.
 * - `code.match` is `automatic` when the title matches a Foundry book by name
 *   (`pf1/module/registry/sources.mjs`); `reviewed` codes carry the review
 *   that matched them by hand.
 * - `registry.match` is `automatic` when the title matches a Registry title;
 *   a `proposed-alias` waits for the notice reviewer (P10a). A book without a
 *   Registry title (`registry: null`) needs a new notice review.
 */
// A drafted review applies nothing; only a checked one, with its reviewer, does.
const reviewSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('drafted'),
    rationale: z.string().min(1),
  }),
  z.strictObject({
    status: z.literal('checked'),
    rationale: z.string().min(1),
    reviewedBy: z.string().min(1),
    reviewedOn: z.iso.date(),
  }),
]);
const pcgenPath = z.string().regex(/^(?:[a-z0-9_]+\/)+[A-Za-z0-9_.-]+$/);
const foundryBook = {
  id: z.string().regex(/^PZO[0-9A-Z-]+$/),
  foundryName: z.string().min(1),
  foundryLine: z.number().int().positive(),
};
const registryTitle = { title: z.string().min(1) };
const bookSchema = z.strictObject({
  book: z.string().min(1),
  packs: z.array(z.strictObject({ folder: pcgenPath, pcc: pcgenPath })).min(1),
  title: z.strictObject({
    file: pcgenPath,
    line: z.number().int().positive(),
    sourceLong: z.string().min(1),
  }),
  code: z.discriminatedUnion('match', [
    z.strictObject({ match: z.literal('automatic'), ...foundryBook }),
    z.strictObject({
      match: z.literal('reviewed'),
      ...foundryBook,
      review: reviewSchema,
    }),
  ]),
  registry: z
    .discriminatedUnion('match', [
      z.strictObject({ match: z.literal('automatic'), ...registryTitle }),
      z.strictObject({
        match: z.literal('proposed-alias'),
        ...registryTitle,
        review: reviewSchema,
        // Differences the notice reviewer must settle when confirming the alias.
        laterReview: z.array(z.string().min(1)),
      }),
    ])
    .nullable(),
});
export const pcgenBooksSchema = z
  .strictObject({
    pcgen: z.strictObject({
      commit: z.string().regex(/^[0-9a-f]{40}$/),
      directory: z.string().min(1),
    }),
    foundrySources: z.strictObject({
      repo: z.literal('pf1'),
      path: z.string().min(1),
    }),
    books: z.array(bookSchema),
  })
  .superRefine(({ books }, context) => {
    const names = books.map((row) => row.book);
    const folders = books.flatMap((row) =>
      row.packs.map((pack) => pack.folder),
    );
    if (new Set(names).size !== names.length)
      context.addIssue({ code: 'custom', message: 'Duplicate book.' });
    if (new Set(folders).size !== folders.length)
      context.addIssue({
        code: 'custom',
        message: 'A pack belongs to two books.',
      });
  });

export const pcgenBooks = pcgenBooksSchema.parse(data);

/**
 * The books outside the crosswalk whose PCGen `OGL.txt` carries their own
 * Section 15 line (`pcgen-notice-books.json`, owner decision of 2026-10-31):
 * crosswalk rows, with automatic codes, that only the Section 15 matcher
 * (`legal/section15-match.ts`) reads. The importer's crosswalk uses stay with
 * `pcgenBooks`.
 */
export const pcgenNoticeBooks = pcgenBooksSchema.parse(noticeData);

/** A book title from a PCGen SOURCELONG, without the Companion line prefix. */
export function normalizePcgenBookTitle(sourceLong: string) {
  return sourceLong.replace(/^Pathfinder (Player )?Companion: /, '');
}
