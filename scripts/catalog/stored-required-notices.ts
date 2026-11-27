import { z } from 'zod';
import type { AttributionAssessment } from '../../src/lib/catalog/admission-schema.ts';
import data from './stored-required-notices.json' with { type: 'json' };

/**
 * The notices each stored Attribution Assessment required, by assessed key
 * (`stored-required-notices.json`; pbl-register-only, root decision D4 as
 * amended a second time on 2026-11-26). The admission gate reads them where
 * it read an assessment's `requiredNotices` (`storedNotices`,
 * `assessCatalogAdmission`), so with the notice register and these it
 * decides as it did with the assessments, reading no assessment or evidence.
 * Frozen input, generated once from the committed assessments: each distinct
 * list once (sorted, each notice once) with the keys that share it, the lists
 * sorted, each key once and no list empty.
 */
const text = z.string().min(1);
const compare = (left: string, right: string) =>
  left < right ? -1 : left > right ? 1 : 0;
const isSortedUnique = (values: readonly string[]) =>
  values.every((value, index) => {
    const previous = values[index - 1];
    return previous === undefined || compare(previous, value) < 0;
  });
const sortedUnique = (what: string) =>
  z
    .array(text)
    .min(1, `An empty ${what} list.`)
    .refine(isSortedUnique, `The ${what} must be sorted, each once.`);

export const storedRequiredNoticesSchema = z
  .strictObject({
    description: text,
    lists: z.array(
      z.strictObject({
        notices: sortedUnique('notice'),
        keys: sortedUnique('key'),
      }),
    ),
  })
  .superRefine(({ lists }, context) => {
    const seen = new Set<string>();
    lists.forEach(({ notices, keys }, index) => {
      const previous = lists[index - 1];
      if (
        previous &&
        compare(JSON.stringify(previous.notices), JSON.stringify(notices)) >= 0
      )
        context.addIssue({
          code: 'custom',
          path: ['lists', index],
          message: 'The lists must be sorted by their notices, each list once.',
        });
      for (const key of keys) {
        if (seen.has(key))
          context.addIssue({
            code: 'custom',
            path: ['lists', index, 'keys'],
            message: `Key ${key} is listed twice.`,
          });
        seen.add(key);
      }
    });
  });

/** The stored notices by assessed key, as the gate reads them. */
export type StoredNotices = Readonly<Record<string, readonly string[]>>;

/** A parsed file's lists, by key. */
export function storedNoticesByKey(
  document: z.infer<typeof storedRequiredNoticesSchema>,
): StoredNotices {
  return Object.fromEntries(
    document.lists.flatMap(({ notices, keys }) =>
      keys.map((key) => [key, notices] as const),
    ),
  );
}

/** The committed frozen stored notices. */
export const committedStoredNotices = storedNoticesByKey(
  storedRequiredNoticesSchema.parse(data),
);

/**
 * The stored notices of assessments (an `--attribution` file's, or a
 * programmatic release's): each key's first assessment, as the gate reads it,
 * when it requires any. The gate refuses a key assessed twice; so does this.
 */
export function storedNoticesOf(
  assessments: readonly Pick<
    AttributionAssessment,
    'externalKey' | 'requiredNotices'
  >[],
): StoredNotices {
  const stored: Record<string, readonly string[]> = {};
  const seen = new Set<string>();
  for (const { externalKey, requiredNotices } of assessments) {
    if (seen.has(externalKey))
      throw new Error(`${externalKey}: Duplicate Attribution Assessment.`);
    seen.add(externalKey);
    if (requiredNotices.length)
      stored[externalKey] = [...new Set(requiredNotices)].sort(compare);
  }
  return stored;
}
