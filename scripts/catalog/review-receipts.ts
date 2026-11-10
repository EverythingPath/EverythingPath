import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { canonicalReleaseJson } from '../../src/lib/catalog/release-schema.ts';

/**
 * #757 review receipts (`review-receipts.json`). A record whose `checked`
 * state authorizes something (a variant decision, a held source, a structure
 * record) names the receipt of the cross-model review that confirmed it. A
 * receipt binds that review's legacy spawn or distinct T3 evidence id, the SHA-256 of its report
 * and, for each record it covers, the record's ID, the source hashes the
 * review saw and the hash of the decision itself (its payload). The report is
 * committed beside the receipts (`review-reports/<run id>.md`), so a clean
 * checkout can prove it exists. A record is written `drafted`; only the
 * orchestrator's record step (`scripts/catalog-record-review.ts`, runbook
 * "Record the review") writes a receipt and marks records `checked`. Whether
 * the review was adequate stays with the reviewer; the check is mechanical.
 */
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
/** A `spawn.sh reviewer` run id: `reviewer-<yyyymmdd>-<hhmmss>-<pid>`. */
const legacyRunIdSchema = z.string().regex(/^reviewer-\d{8}-\d{6}-\d+$/);
const t3RunIdSchema = z.string().regex(/^t3-review-[a-f0-9]{64}$/);
export const reviewRunIdSchema = z.union([legacyRunIdSchema, t3RunIdSchema]);
const t3EvidenceSchema = z.strictObject({
  kind: z.literal('t3'),
  sha256: sha256Schema,
  reviewedCommit: z.string().regex(/^[a-f0-9]{40}$/),
});
/**
 * Reviewer runs from before spawn.sh saved report snapshots and reviewed
 * commits, each with its report's pinned SHA-256: the only runs whose
 * receipts `--verify` accepts without a run directory and snapshot, and only
 * while their committed report copy has this hash. Never add to it; every
 * later run has a snapshot.
 */
export const legacyReviewRuns: ReadonlyMap<string, string> = new Map([
  [
    'reviewer-20261018-081620-1216172',
    '0fa467ace83783ca800b5618dbf257caf4881dd93ca4858c7dfc619380914559',
  ],
]);
/** The committed copy of each receipt's report, by run id. */
export const reviewReportsDirectory = 'scripts/catalog/review-reports';

/** What a checked review adds to a record: who, when, and the receipt. */
export const checkedReviewShape = {
  reviewedBy: z.string().min(1),
  reviewedOn: z.iso.date(),
  receipt: reviewRunIdSchema,
};
/**
 * The review states as shapes a record's schema composes into its own drafted
 * and checked variants, so its type carries the receipt exactly when checked.
 */
export const reviewStateShapes = {
  drafted: { status: z.literal('drafted') },
  checked: { status: z.literal('checked'), ...checkedReviewShape },
};
const reviewStateSchema = z.discriminatedUnion('status', [
  z.object(reviewStateShapes.drafted),
  z.object(reviewStateShapes.checked),
]);
/** A record's review state; only a checked one carries a receipt. */
export type ReviewState = z.infer<typeof reviewStateSchema>;
export type CheckedReview = Extract<ReviewState, { status: 'checked' }>;
/** A record's review state, read from wherever the record keeps it. */
export function readReviewState(value: unknown): ReviewState {
  return reviewStateSchema.parse(value);
}

const coverSchema = z.strictObject({
  id: z.string().min(1),
  /** What each hash is of: a case-folded upstream locator, or an entry's key. */
  sources: z
    .array(
      z.strictObject({
        subject: z.string().min(1),
        sourceSha256: sha256Schema,
      }),
    )
    .min(1),
  /** The decision itself: what the record authorizes, apart from its review. */
  payloadSha256: sha256Schema,
});
/** A record as a review saw it, and as a receipt covers it. */
export type ReviewedCover = z.infer<typeof coverSchema>;
const reviewReceiptsSchema = z.strictObject({
  receipts: z.array(
    z.union([
      z.strictObject({
        runId: legacyRunIdSchema,
        reportSha256: sha256Schema,
        covers: z.array(coverSchema).min(1),
      }),
      z.strictObject({
        runId: t3RunIdSchema,
        reportSha256: sha256Schema,
        covers: z.array(coverSchema).min(1),
        evidence: t3EvidenceSchema,
      }),
    ]),
  ),
});
export type ReviewReceipts = z.infer<typeof reviewReceiptsSchema>;

export function parseReviewReceipts(value: unknown): ReviewReceipts {
  return reviewReceiptsSchema.parse(value);
}
/** The records a reviewer run saw when it started (`reviewed-records.json`). */
export function parseReviewedCovers(value: unknown): ReviewedCover[] {
  return z.array(coverSchema).parse(value);
}

/**
 * A record a receipt can cover: how a review sees it, its review state, and
 * `check`, which marks the record itself checked.
 */
export type ReviewedRecord = ReviewedCover & {
  review: ReviewState;
  check: (review: CheckedReview) => void;
};

/** Sorts a record's reviewed sources into their stable order. */
export function sortReviewedSources(
  sources: Iterable<ReviewedCover['sources'][number]>,
) {
  return [...sources].sort((left, right) =>
    left.subject < right.subject ? -1 : left.subject > right.subject ? 1 : 0,
  );
}
/** Hashes a record's decision payload, in canonical JSON. */
export function hashReviewPayload(payload: unknown) {
  return createHash('sha256')
    .update(canonicalReleaseJson(payload))
    .digest('hex');
}
/** Hashes a report's bytes. */
export function hashReport(report: string | Uint8Array) {
  return createHash('sha256').update(report).digest('hex');
}

const coverOf = ({ id, sources, payloadSha256 }: ReviewedCover) => ({
  id,
  sources: sortReviewedSources(sources),
  payloadSha256,
});

function indexById<T extends { id: string }>(records: readonly T[]) {
  const byId = new Map<string, T>();
  for (const record of records) {
    if (byId.has(record.id))
      throw new Error(`Two reviewed records have the ID ${record.id}.`);
    byId.set(record.id, record);
  }
  return byId;
}

/** Why a covered record no longer matches what the review saw, if it doesn't. */
function describeChange({
  saw,
  now,
}: {
  saw: ReviewedCover;
  now: ReviewedCover;
}) {
  if (!isDeepStrictEqual(saw.sources, sortReviewedSources(now.sources)))
    return 'other source hashes';
  if (saw.payloadSha256 !== now.payloadSha256) return 'another decision';
  return undefined;
}

/**
 * Finds why the receipts don't bind every checked record to a review whose
 * report the repo holds: a receipt's report copy is missing or has another
 * hash (`reportSha256s`, by run id), a checked record's receipt isn't
 * recorded or doesn't cover it, or the review saw other source hashes or
 * another decision than the record holds now.
 */
export function findReceiptProblems({
  records,
  receipts,
  reportSha256s,
}: {
  records: readonly ReviewedRecord[];
  receipts: ReviewReceipts;
  reportSha256s: ReadonlyMap<string, string>;
}) {
  indexById(records);
  const problems: string[] = [];
  const byRun = new Map<string, ReviewReceipts['receipts'][number]>();
  for (const receipt of receipts.receipts) {
    if (byRun.has(receipt.runId))
      problems.push(`Review ${receipt.runId} is recorded twice.`);
    byRun.set(receipt.runId, receipt);
    const copy = reportSha256s.get(receipt.runId);
    if (copy === undefined)
      problems.push(
        `Review ${receipt.runId} has no report copy in ${reviewReportsDirectory}.`,
      );
    else if (copy !== receipt.reportSha256)
      problems.push(
        `Review ${receipt.runId}'s report copy does not match its receipt.`,
      );
  }
  for (const record of records) {
    const { review } = record;
    if (review.status !== 'checked') continue;
    const receipt = byRun.get(review.receipt);
    const cover = receipt?.covers.find(({ id }) => id === record.id);
    const change = cover && describeChange({ saw: cover, now: record });
    if (!receipt)
      problems.push(
        `${record.id} names review ${review.receipt}, which review-receipts.json doesn't record.`,
      );
    else if (!cover)
      problems.push(`Review ${receipt.runId} doesn't cover ${record.id}.`);
    else if (change)
      problems.push(
        `Review ${receipt.runId} saw ${record.id} with ${change} than it holds now.`,
      );
  }
  return problems;
}

/** A finished reviewer run, as its receipt and the records it checks name it. */
export type ReviewRun = {
  runId: string;
  reportSha256: string;
  reviewedBy: string;
  reviewedOn: string;
} & (
  | { kind: 'legacy' }
  | { kind: 't3'; evidence: z.infer<typeof t3EvidenceSchema> }
);

/** Reads one `key=value` line of a `spawn.sh` run's `meta`; an empty value is none. */
export function readRunMeta(meta: string, key: string) {
  const line = meta
    .split('\n')
    .find((candidate) => candidate.startsWith(`${key}=`));
  const value = line?.slice(key.length + 1);
  return value === "''" || value === '' ? undefined : value;
}

/**
 * Reads a `spawn.sh reviewer` run from its `meta`, `exit` and report. The run
 * must be a reviewer run that exited 0 with a report; the reviewer is the
 * other model from the author (`--author`).
 */
export function describeReviewRun({
  meta,
  exit,
  report,
}: {
  meta: string;
  exit: string;
  report: string | Uint8Array;
}): Extract<ReviewRun, { kind: 'legacy' }> {
  const runId = legacyRunIdSchema.parse(readRunMeta(meta, 'id'));
  if (readRunMeta(meta, 'role') !== 'reviewer')
    throw new Error(`${runId} is not a reviewer run.`);
  const reviewer = { opus: 'Sol', sol: 'Opus' }[
    readRunMeta(meta, 'author') ?? ''
  ];
  if (!reviewer) throw new Error(`${runId} names no author.`);
  if (exit.trim() !== '0')
    throw new Error(`${runId} did not finish with exit 0.`);
  if (!Buffer.from(report).toString('utf8').trim())
    throw new Error(`${runId} has no report.`);
  const [, date = ''] = /^reviewer-(\d{8})/.exec(runId) ?? [];
  return {
    kind: 'legacy',
    runId,
    reportSha256: hashReport(report),
    reviewedBy: `${reviewer} (AI review) for the owner`,
    reviewedOn: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}`,
  };
}

/**
 * The record step: marks each named drafted record checked under the run and
 * adds the run's receipt. `seen` are the records as the review saw them when
 * it started; a record the review didn't see, or that changed since, is
 * refused. A run already recorded, with the same report, covers further
 * records too. Marks the records through their `check` and returns the new
 * receipts.
 */
export function recordReviewReceipt({
  records,
  receipts,
  run,
  ids,
  seen,
}: {
  records: readonly ReviewedRecord[];
  receipts: ReviewReceipts;
  run: ReviewRun;
  ids: readonly string[];
  seen: readonly ReviewedCover[];
}): ReviewReceipts {
  if (new Set(ids).size !== ids.length || ids.length === 0)
    throw new Error('Review IDs must be nonempty and unique.');
  const byId = indexById(records);
  const seenById = indexById(seen);
  const recorded = receipts.receipts.find(({ runId }) => runId === run.runId);
  if (
    recorded &&
    (!isDeepStrictEqual(
      'evidence' in recorded ? recorded.evidence : undefined,
      run.kind === 't3' ? run.evidence : undefined,
    ) ||
      recorded.reportSha256 !== run.reportSha256)
  )
    throw new Error(`Review ${run.runId} is recorded with another report.`);
  const covered = ids.map((id) => {
    const record = byId.get(id);
    if (!record) throw new Error(`No reviewed record ${id}.`);
    if (record.review.status === 'checked')
      throw new Error(
        `${id} is already checked under review ${record.review.receipt}.`,
      );
    const saw = seenById.get(id);
    if (!saw) throw new Error(`Review ${run.runId} didn't see ${id}.`);
    const change = describeChange({ saw: coverOf(saw), now: record });
    if (change)
      throw new Error(`${id} has ${change} than review ${run.runId} saw.`);
    return record;
  });
  const review: CheckedReview = {
    status: 'checked',
    reviewedBy: run.reviewedBy,
    reviewedOn: run.reviewedOn,
    receipt: run.runId,
  };
  const covers = covered.map(coverOf);
  const next = parseReviewReceipts({
    receipts: recorded
      ? receipts.receipts.map((receipt) =>
          receipt === recorded
            ? { ...receipt, covers: [...receipt.covers, ...covers] }
            : receipt,
        )
      : [
          ...receipts.receipts,
          {
            runId: run.runId,
            reportSha256: run.reportSha256,
            covers,
            ...(run.kind === 't3' ? { evidence: run.evidence } : {}),
          },
        ],
  });
  for (const record of covered) {
    record.check(review);
    record.review = review;
  }
  return next;
}
