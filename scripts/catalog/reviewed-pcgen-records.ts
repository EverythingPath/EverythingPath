import { z } from 'zod';
import { catalogKeySchema } from '../../src/lib/catalog/catalog-key.ts';
import {
  hashReviewPayload,
  readReviewState,
  reviewStateShapes,
  type CheckedReview,
  type ReviewedRecord,
} from './review-receipts.ts';
import reviewedPcgenRecordsData from './reviewed-pcgen-records.json' with { type: 'json' };
import type { PreviewEntry } from './map.ts';

/**
 * The reviewed PCGen records the #227 scripted match reads for single Foundry
 * records (`reviewed-pcgen-records.json`; root decision of 2026-11-18, item
 * 1): a Foundry record that no PCGen line matches by the ordinary rules
 * because Foundry misspells it, such as the Cavalier's 17th-level "Master
 * Tacitician" for the Advanced Player's Guide's Master Tactician. A record
 * names one Foundry record by its key, exact upstream name and description
 * hash, the one PCGen
 * record it stands for by its list file and its KEY exactly as PCGen states
 * it, and the evidence that they are the same feature. The matcher
 * (`attribution-227-matcher.ts`) reads that one line and nothing else, and
 * refuses a record that no longer fits: no name is looked up, so no other
 * line of the same name is read.
 *
 * A record is written `drafted` and applies nothing; only the orchestrator's
 * record step marks it `checked` under a review receipt (#757).
 */
const text = z.string().min(1);
const recordShape = {
  /** The Foundry record, `<repo>/<_id>`. */
  externalKey: catalogKeySchema,
  /** The record's exact Foundry name: the record applies only while it is this. */
  upstreamName: text,
  /**
   * The SHA-256 of the record's imported description, as the review read it
   * (as a rule-value record binds it): a changed body makes the record stale.
   */
  descriptionSha256: z.string().regex(/^[a-f0-9]{64}$/),
  /** The one PCGen record it stands for. */
  pcgen: z.strictObject({
    /** Its list, from the PCGen pin's data directory. */
    file: text.regex(/\.lst$/),
    /** Its KEY exactly as PCGen states it (its column-1 name if it has none). */
    key: text,
  }),
  /** Why the two are the same feature: the class row, the level and the text. */
  evidence: text,
};
const recordSchema = z.union([
  z.strictObject({ ...recordShape, ...reviewStateShapes.drafted }),
  z.strictObject({ ...recordShape, ...reviewStateShapes.checked }),
]);
export type ReviewedPcgenRecord = z.infer<typeof recordSchema>;

/** The list file's schema (`reviewed-pcgen-records.json`). */
export const reviewedPcgenRecordsSchema = z.strictObject({
  version: z.literal(1),
  records: z.array(recordSchema),
});
/** The list's path, from the repository root. */
export const reviewedPcgenRecordsPath =
  'scripts/catalog/reviewed-pcgen-records.json';

/**
 * A PCGen record's identity: its list file and its KEY exactly as PCGen
 * states it. The matcher's index keys every line by it and the list refuses
 * two records that claim one, so both read one encoding.
 */
export const pcgenRecordLocator = ({
  file,
  key,
}: {
  file: string;
  key: string;
}) => `${file}#${key}`;

/** A list line's object: its column-1 name, `CATEGORY:` and `KEY:`, if it names one. */
export function pcgenListObject(line: string) {
  const tokens = line.split('\t');
  const name = tokens[0]?.trim() ?? '';
  if (
    !name ||
    name.startsWith('#') ||
    /^[A-Z]+:/.test(name) ||
    /\.(?:MOD|COPY|FORGET)\b/.test(name)
  )
    return undefined;
  const tag = (prefix: string) =>
    tokens.find((token) => token.startsWith(prefix))?.slice(prefix.length);
  return {
    name,
    category: tag('CATEGORY:'),
    key: tag('KEY:'),
    types: tag('TYPE:')?.split('.') ?? [],
  };
}

/** The list, refused whole when a record is malformed or claims another's. */
export function parseReviewedPcgenRecords(value: unknown) {
  const list = reviewedPcgenRecordsSchema.parse(value);
  refuseRepeatedClaims(list.records);
  return list;
}

/**
 * Refuses a list in which two records share a Foundry record or claim one
 * PCGen record (its file and KEY): a copied locator is a mistake, never a
 * second correction. The parser, the matcher and the gate each read a list
 * through this.
 */
export function refuseRepeatedClaims(
  records: readonly Pick<ReviewedPcgenRecord, 'externalKey' | 'pcgen'>[],
) {
  const foundry = new Set<string>();
  const pcgen = new Map<string, string>();
  for (const { externalKey, pcgen: target } of records) {
    if (foundry.has(externalKey))
      throw new Error(`Two reviewed PCGen records share ${externalKey}.`);
    foundry.add(externalKey);
    const locator = pcgenRecordLocator(target);
    const claimed = pcgen.get(locator);
    if (claimed !== undefined)
      throw new Error(
        `Two reviewed PCGen records claim ${locator}: ${claimed}, ${externalKey}.`,
      );
    pcgen.set(locator, externalKey);
  }
}

/**
 * Lists the records as a review receipt covers them (#757): by key and the
 * description hash, with their payload (the upstream name, the PCGen record
 * and the evidence). `check` marks the record itself checked, so the record
 * step writes the list it read.
 */
export function listReviewedPcgenRecordReviews(list: {
  records: ReviewedPcgenRecord[];
}): ReviewedRecord[] {
  return list.records.map((record) => ({
    id: reviewedPcgenRecordId(record),
    sources: [
      { subject: record.externalKey, sourceSha256: record.descriptionSha256 },
    ],
    payloadSha256: hashReviewPayload({
      upstreamName: record.upstreamName,
      pcgen: record.pcgen,
      evidence: record.evidence,
    }),
    review: readReviewState(record),
    check: (review: CheckedReview) => Object.assign(record, review),
  }));
}

/** A record's ID as the record step lists it: its key and description hash. */
export const reviewedPcgenRecordId = ({
  externalKey,
  descriptionSha256,
}: Pick<ReviewedPcgenRecord, 'externalKey' | 'descriptionSha256'>) =>
  `pcgen-record ${externalKey} sha256:${descriptionSha256}`;

/**
 * What a generated match binds of the record that produced it: its ID, which
 * names it, and the SHA-256 of the whole record as it stands (every field,
 * its review state and receipt included; canonical JSON). The ID covers the
 * key and the description hash alone, so the match also carries the whole
 * record's hash: the gate applies the match only while the record is that
 * record, whichever field changed.
 */
export const reviewedPcgenRecordIdentity = (record: ReviewedPcgenRecord) => ({
  id: reviewedPcgenRecordId(record),
  sha256: hashReviewPayload(record),
});

/** The committed list (`reviewed-pcgen-records.json`). */
export const committedReviewedPcgenRecords = parseReviewedPcgenRecords(
  reviewedPcgenRecordsData,
).records;

/** The names of the classes whose rows grant each feature, by its key. */
export type ClassGrants = ReadonlyMap<string, readonly string[]>;
/**
 * Each feature's granting classes, from the classes' rows
 * (`featuresByLevel`): a class association is not a grant. The matcher and
 * the gate read a class feature's reviewed record against these.
 */
export function classGrantsOf(
  entries: readonly Pick<PreviewEntry, 'name' | 'detail'>[],
): ClassGrants {
  const grants = new Map<string, Set<string>>();
  for (const { name, detail } of entries)
    if (detail.kind === 'class')
      for (const { externalKey } of detail.featuresByLevel)
        grants.set(
          externalKey,
          (grants.get(externalKey) ?? new Set()).add(name),
        );
  return new Map([...grants].map(([key, names]) => [key, [...names].sort()]));
}

/** Whether a class whose row grants the feature is the class its KEY names (`<class> ~ …`). */
export const grantingClassOf = (
  granting: readonly string[],
  pcgenKey: string,
) => granting.find((name) => pcgenKey.startsWith(`${name} ~ `));
