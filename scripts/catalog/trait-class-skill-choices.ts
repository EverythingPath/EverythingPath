import { createHash } from 'node:crypto';
import { z } from 'zod';
import { catalogKeySchema } from '../../src/lib/catalog/imported-entry-schema.ts';
import { skillDefinitions } from '../../src/lib/character-sheet-skill-definitions.ts';
import {
  sourceDescription,
  type SourceRecord,
  type Unsupported,
} from './records.ts';
import {
  hashReviewPayload,
  readReviewState,
  reviewStateShapes,
  type CheckedReview,
  type ReviewedRecord,
} from './review-receipts.ts';
import reviewedChoicesData from './reviewed-trait-class-skill-choices.json';

/**
 * trait-cs B2 (research/trait-class-skills-design.md §3): the reviewed list
 * of the traits whose rule says "one of these skills (your choice) is always
 * a class skill for you", such as Devotee of the Green (APG p. 332). Neither
 * the clause nor its two skills are read off names or text, and Foundry
 * holds no class-skill data for most of them, so a record holds the trait's
 * key, its two options as runtime skill keys, the source sentence that names
 * them and the SHA-256 of the body it was read from (`sourceDescription`).
 * A record is written `drafted`; only a checked one gives the trait its
 * options (`classSkillChoice`), and the player's pick goes in the trait
 * Selection's choice.
 *
 * A listed trait never maps Foundry's own class-skill map as fixed, whatever
 * the record's state: Scholar of the Great Beyond's lone `khi` is Foundry's
 * default pick ("Knowledge (history) is chosen by default"), not a class
 * skill the trait always gives.
 */
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const skillKeys = skillDefinitions.map(({ key }) => key);
const skillKeySchema = z
  .string()
  .refine(
    (key) => skillKeys.some((skill) => skill === key),
    'Not a runtime skill key.',
  );
const recordShape = {
  /** The choice trait. */
  traitKey: catalogKeySchema,
  /** The SHA-256 of the trait's body, which names the two skills. */
  bodySha256: sha256Schema,
  /** The body's sentence (or sentences) that grants the choice. */
  sourceSentence: z.string().min(1),
  /** The two skills the player picks from, as runtime skill keys. */
  options: z
    .tuple([skillKeySchema, skillKeySchema])
    .refine(
      ([first, second]) => first !== second,
      'A class-skill choice offers two skills.',
    ),
};
const recordSchema = z.union([
  z.strictObject({ ...recordShape, ...reviewStateShapes.drafted }),
  z.strictObject({ ...recordShape, ...reviewStateShapes.checked }),
]);
export type TraitClassSkillChoiceRecord = z.infer<typeof recordSchema>;

/** The list file's schema (`reviewed-trait-class-skill-choices.json`). */
export const traitClassSkillChoiceListSchema = z.strictObject({
  version: z.literal(1),
  traits: z.array(recordSchema),
});
/** The list's path, from the repository root. */
export const traitClassSkillChoiceListPath =
  'scripts/catalog/reviewed-trait-class-skill-choices.json';

/** The list, refused whole when a record is malformed or a trait repeats. */
export function parseTraitClassSkillChoiceList(value: unknown) {
  const list = traitClassSkillChoiceListSchema.parse(value);
  const seen = new Set<string>();
  for (const { traitKey } of list.traits) {
    if (seen.has(traitKey))
      throw new Error(`Two class-skill choice records share ${traitKey}.`);
    seen.add(traitKey);
  }
  return list;
}

/**
 * Lists the records as a review receipt covers them (#757): by trait and body
 * hash, with their payload (the sentence and the two options). `check` marks
 * the record itself checked, so the record step writes the list it read.
 */
export function listTraitClassSkillChoiceReviews(list: {
  traits: TraitClassSkillChoiceRecord[];
}): ReviewedRecord[] {
  return list.traits.map((record) => ({
    id: `trait-class-skill-choice ${record.traitKey} sha256:${record.bodySha256}`,
    sources: [{ subject: record.traitKey, sourceSha256: record.bodySha256 }],
    payloadSha256: hashReviewPayload({
      sourceSentence: record.sourceSentence,
      options: record.options,
    }),
    review: readReviewState(record),
    check: (review: CheckedReview) => Object.assign(record, review),
  }));
}

/** The committed list (`reviewed-trait-class-skill-choices.json`). */
export const reviewedTraitClassSkillChoices =
  parseTraitClassSkillChoiceList(reviewedChoicesData).traits;

/** The SHA-256 a record binds: the source body's. */
export function traitBodySha256(record: SourceRecord) {
  return createHash('sha256').update(sourceDescription(record)).digest('hex');
}

/**
 * A trait's class-skill choice: whether the list names it (so its Foundry
 * class-skill map is no fixed grant), and a checked record's options when it
 * was reviewed against this body. A checked record bound to another body
 * gives no options and an `unsupported` issue instead.
 */
export function traitClassSkillChoiceFor({
  externalKey,
  record: source,
  unsupported,
  records = reviewedTraitClassSkillChoices,
}: {
  externalKey: string;
  record: SourceRecord;
  unsupported: Unsupported[];
  records?: readonly TraitClassSkillChoiceRecord[];
}): { listed: boolean; options?: string[] } {
  const record = records.find(({ traitKey }) => traitKey === externalKey);
  if (!record) return { listed: false };
  if (record.status !== 'checked') return { listed: true };
  if (record.bodySha256 !== traitBodySha256(source)) {
    unsupported.push({
      field: 'classSkillChoice',
      reason:
        'The class-skill choice record was reviewed against another body.',
      value: record.bodySha256,
    });
    return { listed: true };
  }
  return { listed: true, options: [...record.options] };
}
