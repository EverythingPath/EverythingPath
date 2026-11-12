import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import {
  catalogKeySchema,
  importedCatalogEntrySchema,
  importedDetailSchema,
  upstreamKeyOf,
  type upstreamSourceSchema,
} from '../../src/lib/catalog/imported-entry-schema.ts';
import type { CurationData } from './curation.ts';
import {
  foldUpstreamKey,
  isCurrentDecision,
  locatorKeyOf,
  type IdentityLedger,
} from './everythingpath-identities.ts';
import type { PreviewEntry } from './map.ts';
import {
  hashReviewPayload,
  readReviewState,
  reviewStateShapes,
  type CheckedReview,
  type ReviewedRecord,
} from './review-receipts.ts';

/**
 * #716 hand review (plan §6). A structure record holds reviewed values for some
 * fields of one imported entry, bound to the hash of the upstream records it
 * was reviewed against, and names the review items it settles. It is written
 * `drafted`; a checked one names the receipt of the review that confirmed it
 * (`review-receipts.ts`, #757).
 */

/**
 * Plan §6: what the mappers can't decide and hand to review. #716 P4 adds
 * `uncheckedRequirement`: a prestige class requirement the mapper left as an
 * unchecked clause (plan §3, Appendix E).
 */
const structureReviewKinds = [
  'unmatchedReplacement',
  'uncheckedCasting',
  'uncheckedRequirement',
  'variant',
  'conflict',
  'productIdentity',
  'option',
  'unsupportedKind',
] as const;

// Top-level fields a structure record may not replace: the entry's identity,
// its whole detail (one property at a time instead) and import bookkeeping.
const unreviewableFields = new Set([
  'externalKey',
  'upstreamKey',
  'pack',
  'detail',
  'provenance',
  'unsupported',
  'attributionFrom',
]);
const entryFields: Record<string, z.ZodType> = importedCatalogEntrySchema.shape;
const detailFields = new Map<string, Record<string, z.ZodType>>(
  importedDetailSchema.options.map((option) => [
    option.shape.kind.value,
    option.shape,
  ]),
);

/** The schema a field's replacement value must meet on an entry of this detail kind. */
function destinationOf({ field, kind }: { field: string; kind?: string }) {
  const [name = '', property, ...rest] = field.split('.');
  if (rest.length) return undefined;
  if (property === undefined)
    return unreviewableFields.has(name) || !Object.hasOwn(entryFields, name)
      ? undefined
      : entryFields[name];
  if (name !== 'detail' || property === 'kind') return undefined;
  const shapes =
    kind === undefined ? [...detailFields.values()] : [detailFields.get(kind)];
  return shapes.find((shape) => shape && Object.hasOwn(shape, property))?.[
    property
  ];
}

const resolutionSchema = z.strictObject({
  kind: z.enum([...structureReviewKinds, 'ownedFeature']),
  /** The item's identity among its entry's items of this kind. */
  id: z.string().min(1),
});
type Resolution = z.infer<typeof resolutionSchema>;

const structureRecordShape = {
  externalKey: catalogKeySchema,
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  // An imported entry field, or a property one of its detail kinds has.
  fields: z.record(
    z.string().refine((field) => destinationOf({ field }) !== undefined, {
      message: 'Not a field a structure record can replace.',
    }),
    z.json(),
  ),
  // The entry has nothing to structure; it settles owned-feature items only.
  noMechanics: z.literal(true).optional(),
  resolves: z.array(resolutionSchema).default([]),
  rationale: z.string().min(1),
};
// Drafted, or checked with its reviewer, date and review receipt (#757).
export const structureRecordSchema = z
  .discriminatedUnion('status', [
    z.strictObject({ ...structureRecordShape, ...reviewStateShapes.drafted }),
    z.strictObject({ ...structureRecordShape, ...reviewStateShapes.checked }),
  ])
  .superRefine((record, context) => {
    const issue = (message: string) =>
      context.addIssue({ code: 'custom', message });
    if ((record.noMechanics ?? false) === Object.keys(record.fields).length > 0)
      issue(
        'A structure record binds fields or is a noMechanics disposition, not both or neither.',
      );
    if (
      record.noMechanics &&
      (!record.resolves.length ||
        record.resolves.some(({ kind }) => kind !== 'ownedFeature'))
    )
      issue('A noMechanics disposition names the owned features it settles.');
  });
export type StructureRecord = z.infer<typeof structureRecordSchema>;

/** One upstream record of a #716 entry and its raw text, in merge order. */
export type StructureSourcePart = {
  source: z.infer<typeof upstreamSourceSchema>;
  text: string;
};
/**
 * The hash a structure record binds: the entry's PCGen lines (its record and
 * `.MOD` lines) and any PRD section, by upstream key and raw text. A PCGen
 * line number is left out, since only the KEY is stable.
 */
export function hashStructureSource(
  parts: readonly [StructureSourcePart, ...StructureSourcePart[]],
) {
  return createHash('sha256')
    .update(
      JSON.stringify(
        parts.map(({ source, text }) => [upstreamKeyOf(source), text]),
      ),
    )
    .digest('hex');
}

/** One record's binding: its entry, its field set and its source hash. */
export function structureBindingKey(
  record: Partial<Record<'externalKey' | 'fields' | 'sourceSha256', unknown>>,
) {
  const fields =
    typeof record.fields === 'object' && record.fields !== null
      ? Object.keys(record.fields).sort()
      : [];
  return JSON.stringify([record.externalKey, fields, record.sourceSha256]);
}

/**
 * Lists structure records as a review receipt covers them: by entry, field
 * set and source hash, so each source variant of a key is its own record,
 * with their payload (the replacement values, the noMechanics disposition and
 * the items they settle).
 */
export function listStructureReviews(
  records: readonly StructureRecord[],
): ReviewedRecord[] {
  return records.map((record) => ({
    id: `structure ${record.externalKey} [${Object.keys(record.fields).sort().join(', ')}] sha256:${record.sourceSha256}`,
    sources: [
      { subject: record.externalKey, sourceSha256: record.sourceSha256 },
    ],
    payloadSha256: hashReviewPayload({
      fields: record.fields,
      noMechanics: record.noMechanics ?? false,
      resolves: record.resolves,
    }),
    review: readReviewState(record),
    check: (review: CheckedReview) => Object.assign(record, review),
  }));
}

/** An imported entry's identity in review: its key and its source hash. */
type SubjectRef = { externalKey: string; sourceSha256: string };
const subjectKey = ({ externalKey, sourceSha256 }: SubjectRef) =>
  JSON.stringify([externalKey, sourceSha256]);
const resolutionKey = ({ kind, id }: Resolution) => JSON.stringify([kind, id]);
function groupBy<T>(values: readonly T[], keyOf: (value: T) => string) {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const key = keyOf(value);
    groups.set(key, [...(groups.get(key) ?? []), value]);
  }
  return groups;
}

/**
 * Records of one entry and hash bind disjoint field sets and settle each item
 * at most once, and a noMechanics disposition stands alone.
 */
export function checkStructureBindings(records: readonly StructureRecord[]) {
  for (const group of groupBy(records, subjectKey).values()) {
    const [first] = group;
    if (!first) continue;
    const at = `${first.externalKey} sha256:${first.sourceSha256.slice(0, 12)}`;
    if (group.length > 1 && group.some((record) => record.noMechanics))
      throw new Error(
        `A noMechanics structure record must be the only one for ${at}.`,
      );
    const fields = group.flatMap((record) => Object.keys(record.fields));
    const settled = group.flatMap((record) => record.resolves);
    for (const [field, count] of tally(fields))
      if (count > 1)
        throw new Error(`Two structure records bind ${field} on ${at}.`);
    for (const [item, count] of tally(settled.map(resolutionKey)))
      if (count > 1)
        throw new Error(`Two structure records settle ${item} on ${at}.`);
  }
}
function tally(values: readonly string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

/** A mapped entry, its source hash and its principal upstream record. */
export type StructureSubject = {
  entry: PreviewEntry;
  sourceSha256: string;
  locator: string;
};
export type StructureReviewItem = SubjectRef & {
  kind: (typeof structureReviewKinds)[number];
  /** Stable among the entry's items of this kind, such as the PCGen token that raised it. */
  id: string;
  text: string;
  /** The fields the settling record must bind, when the item concerns some. */
  fields?: readonly string[];
};
/**
 * A feature record an archetype or prestige class grants directly, one row per
 * owner. `locator` is the feature's upstream key, so a same-key variant in
 * another book is a separate feature.
 */
export type OwnedFeature = SubjectRef & { owner: string; locator: string };

type StructureApplication = {
  subjects: readonly StructureSubject[];
  items: readonly StructureReviewItem[];
  ownedFeatures: readonly OwnedFeature[];
  data: CurationData;
  variantDecisions: IdentityLedger['variantDecisions'];
};

const refOf = ({ entry, sourceSha256 }: StructureSubject): SubjectRef => ({
  externalKey: entry.externalKey,
  sourceSha256,
});
const describe = ({ externalKey, sourceSha256 }: SubjectRef) =>
  `${externalKey} sha256:${sourceSha256.slice(0, 12)}`;

/** Indexes the subjects; every item and owned feature names one of them. */
function indexSubjects({
  subjects,
  items,
  ownedFeatures,
}: Pick<StructureApplication, 'subjects' | 'items' | 'ownedFeatures'>) {
  const bySubject = groupBy(subjects, (subject) => subjectKey(refOf(subject)));
  for (const ref of [...items, ...ownedFeatures])
    if (!bySubject.has(subjectKey(ref)))
      throw new Error(
        `Review subject ${describe(ref)} is not an imported entry.`,
      );
  return bySubject;
}

/** Checked records whose values don't fit an entry they would replace. */
function findInvalid({
  records,
  bySubject,
}: {
  records: readonly StructureRecord[];
  bySubject: Map<string, StructureSubject[]>;
}) {
  return records.flatMap((record) =>
    (bySubject.get(subjectKey(record)) ?? []).flatMap(({ entry }) =>
      Object.entries(record.fields).flatMap(([field, value]) => {
        const schema = destinationOf({ field, kind: entry.detail.kind });
        const parsed = schema?.safeParse(value);
        return parsed?.success && isDeepStrictEqual(parsed.data, value)
          ? []
          : [
              {
                record,
                field,
                reason: schema
                  ? `Not a valid ${field}.`
                  : `${entry.detail.kind} entries have no ${field}.`,
              },
            ];
      }),
    ),
  );
}

/**
 * Plan §5: source variants of one key stay separate, so two of them binding
 * the same field compete. A checked same-identity decision settles it only
 * when it is current, every record it reviewed present at the hash it bound
 * (P6), and it reviewed every competing variant: the variant it takes
 * mechanics from applies and the others are superseded. Otherwise every
 * competing record is held as a conflict.
 */
function resolveVariants({
  records,
  subjects,
  variantDecisions,
}: {
  records: readonly StructureRecord[];
  subjects: readonly StructureSubject[];
  variantDecisions: StructureApplication['variantDecisions'];
}) {
  const conflicts: { externalKey: string; field: string }[] = [];
  const conflicting = new Set<StructureRecord>();
  const superseded = new Set<StructureRecord>();
  const currentHashes = new Map(
    subjects.map(({ locator, sourceSha256 }) => [
      foldUpstreamKey(locator),
      sourceSha256,
    ]),
  );
  const locatorsOf = (record: StructureRecord) =>
    subjects
      .filter((subject) => subjectKey(refOf(subject)) === subjectKey(record))
      .map(({ locator }) => foldUpstreamKey(locator));
  for (const [externalKey, group] of groupBy(records, (r) => r.externalKey)) {
    const reviewed = reviewedVariants({
      externalKey,
      variantDecisions,
      currentHashes,
    });
    const binders = groupBy(
      group.flatMap((record) =>
        Object.keys(record.fields).map((field) => ({ field, record })),
      ),
      ({ field }) => field,
    );
    for (const [field, bound] of binders) {
      if (bound.length < 2) continue;
      const covered =
        reviewed &&
        bound.every(({ record }) =>
          locatorsOf(record).every((locator) => reviewed.sources.has(locator)),
        );
      const kept = covered
        ? bound.filter(({ record }) =>
            locatorsOf(record).includes(reviewed.mechanicsFrom),
          )
        : [];
      if (kept.length) {
        for (const { record } of bound)
          if (!kept.some((entry) => entry.record === record))
            superseded.add(record);
        continue;
      }
      conflicts.push({ externalKey, field });
      for (const { record } of bound) conflicting.add(record);
    }
  }
  return { conflicts, conflicting, superseded };
}

/**
 * The sources a current checked same-identity decision on this key reviewed,
 * and the one it takes mechanics from. A stale decision reviews nothing.
 */
function reviewedVariants({
  externalKey,
  variantDecisions,
  currentHashes,
}: {
  externalKey: string;
  variantDecisions: StructureApplication['variantDecisions'];
  currentHashes: ReadonlyMap<string, string>;
}) {
  const decision = variantDecisions.find(
    (candidate) =>
      candidate.decision === 'same-identity' &&
      candidate.externalKey === externalKey &&
      isCurrentDecision(candidate, currentHashes),
  );
  if (decision?.decision !== 'same-identity') return undefined;
  return {
    sources: new Set(
      decision.sources.map(({ source }) => locatorKeyOf(source)),
    ),
    mechanicsFrom: locatorKeyOf(decision.mechanicsFrom),
  };
}

/** Which items and owned features no checked record settles. */
function findUnsettled({
  records,
  items,
  ownedFeatures,
}: {
  records: readonly StructureRecord[];
  items: readonly StructureReviewItem[];
  ownedFeatures: readonly OwnedFeature[];
}) {
  const settling = new Map(
    records.flatMap((record) =>
      record.resolves.map(
        (resolution) =>
          [
            `${subjectKey(record)} ${resolutionKey(resolution)}`,
            record,
          ] as const,
      ),
    ),
  );
  const settlerOf = (ref: SubjectRef, resolution: Resolution) =>
    settling.get(`${subjectKey(ref)} ${resolutionKey(resolution)}`);
  return {
    handReview: items.filter((item) => {
      const record = settlerOf(item, item);
      return (
        !record ||
        !(item.fields ?? []).every((field) =>
          Object.hasOwn(record.fields, field),
        )
      );
    }),
    unreviewedFeatures: ownedFeatures.filter(
      (feature) =>
        !settlerOf(feature, { kind: 'ownedFeature', id: feature.locator }),
    ),
  };
}

function reportStructure({
  subjects,
  items,
  ownedFeatures,
  data,
  variantDecisions,
}: StructureApplication) {
  const bySubject = indexSubjects({ subjects, items, ownedFeatures });
  const entryKeys = new Set(subjects.map(({ entry }) => entry.externalKey));
  const records = data.structures ?? [];
  const current = records.filter((record) => bySubject.has(subjectKey(record)));
  const checked = current.filter((record) => record.status === 'checked');
  const invalid = findInvalid({ records: checked, bySubject });
  const valid = checked.filter(
    (record) => !invalid.some((problem) => problem.record === record),
  );
  const variants = resolveVariants({
    records: valid,
    subjects,
    variantDecisions,
  });
  const settled = findUnsettled({
    records: valid.filter((record) => !variants.conflicting.has(record)),
    items,
    ownedFeatures,
  });
  const held = [
    ...new Set([
      ...[...settled.handReview, ...settled.unreviewedFeatures].map(
        (ref) => ref.externalKey,
      ),
      ...invalid.map(({ record }) => record.externalKey),
      ...variants.conflicts.map(({ externalKey }) => externalKey),
    ]),
  ].sort();
  return {
    passed: held.length === 0,
    held,
    ...settled,
    invalid: invalid.map(({ record, field, reason }) => ({
      externalKey: record.externalKey,
      sourceSha256: record.sourceSha256,
      field,
      reason,
    })),
    conflicts: variants.conflicts,
    applied: valid.filter(
      (record) =>
        !record.noMechanics &&
        !variants.conflicting.has(record) &&
        !variants.superseded.has(record),
    ),
    superseded: [...variants.superseded],
    stale: records.filter(
      (record) =>
        entryKeys.has(record.externalKey) && !bySubject.has(subjectKey(record)),
    ),
    unused: records.filter((record) => !entryKeys.has(record.externalKey)),
    summary: {
      reviewItems: items.length,
      handReview: settled.handReview.length,
      ownedFeatures: new Set(ownedFeatures.map(({ locator }) => locator)).size,
      unreviewedFeatures: new Set(
        settled.unreviewedFeatures.map(({ locator }) => locator),
      ).size,
      drafted: current.length - checked.length,
      checked: checked.length,
      noMechanics: checked.filter((record) => record.noMechanics).length,
    },
  };
}

function applyRecord({
  record,
  entry,
}: {
  record: StructureRecord;
  entry: PreviewEntry;
}) {
  for (const [field, value] of Object.entries(record.fields)) {
    const [name = '', property] = field.split('.');
    const target: Record<string, unknown> =
      property === undefined ? entry : entry.detail;
    target[property ?? name] = structuredClone(value);
    (entry.provenance ??= {})[field] = {
      source: 'overlay',
      locator: {
        externalKey: record.externalKey,
        kind: 'structure',
        target: field,
      },
    };
  }
}

/**
 * Applies checked structure records to the mapper's entries and gates their
 * review (plan §6). A checked record replaces the mapper output of its bound
 * fields on every entry with its key and source hash; a drafted one applies
 * nothing; a record whose source hash no longer matches is stale and applies
 * nothing. An entry is held as hand review when a review item or owned
 * feature isn't settled by a checked record that names it, when a record's
 * field or value doesn't fit the entry, or when source variants compete for a
 * field without a reviewed variant decision.
 */
export function applyStructureCuration(application: StructureApplication) {
  const report = reportStructure(application);
  const bySubject = groupBy(application.subjects, (subject) =>
    subjectKey(refOf(subject)),
  );
  for (const record of report.applied)
    for (const { entry } of bySubject.get(subjectKey(record)) ?? [])
      applyRecord({ record, entry });
  return report;
}
