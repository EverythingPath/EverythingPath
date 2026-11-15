import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  isPublishableNotice,
  isReviewedNotice,
  reviewedNoticeSources,
  type Section15Registry,
} from '../../../src/lib/catalog/admission-schema.ts';
import {
  createNoticeIndex,
  resolveNotice,
} from '../../../src/lib/catalog/resolve-notice.ts';
import { pcgenPin } from '../inventory.ts';
import {
  hashReviewPayload,
  readReviewState,
  reviewStateShapes,
  type CheckedReview,
  type ReviewedRecord,
} from '../review-receipts.ts';
import confirmationsData from './section15-confirmations-716.json' with { type: 'json' };

/**
 * #716 P10a (plan §7, owner decisions 5, 6 and 7): one Section 15 confirmation
 * per book the matcher reads (the #716 books and, owner 2026-10-31, the books
 * whose `OGL.txt` carries their own line), written by `section15-match.ts`
 * from PCGen's pinned `OGL.txt`. A matched book ships PCGen's whole block as
 * the Registry record `pcgen:<code>`. A confirmation is written `drafted`;
 * only a checked one, with its review receipt (#757), makes its book's
 * `pcgen:` and supplemental notices count, and only while its `OGL.txt` hash
 * is current. They count for every candidate of the book: the owner extended
 * decision 5 beyond #716 candidates on 2026-10-30.
 */
export const confirmationsPath =
  'scripts/catalog/legal/section15-confirmations-716.json';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const text = z.string().min(1);
/** Why a book whose `OGL.txt` was read doesn't match (plan §7 "Mismatch handling"). */
const readMismatchKinds = [
  'undecodable',
  'own-line-missing',
  'ambiguous-own-line',
  'uncured-defect',
] as const;
export type ReadMismatchKind = (typeof readMismatchKinds)[number];
/** Plan §7 "Declared equivalences": how two readings of a line compare. */
const lineComparison = z.enum(['exact', 'equivalent', 'differs']);

/**
 * An identified defect of a shipped block (plan §7 "Defects and supplemental
 * notices"): a block line a reviewed source contradicts, or an entry it lists
 * and the block lacks, which has no line. `exactText` is the source's full
 * line, exactly; `coveredBy` is the required notice holding it as a line,
 * null while uncured.
 */
const defectSource = z.strictObject({
  checkedAgainst: z.enum(reviewedNoticeSources),
  locator: text,
  sha256: sha256Schema,
});
const wrongLineDefect = z.strictObject({
  kind: z.literal('wrong-line'),
  blockLine: z.number().int().positive(),
  source: defectSource,
  exactText: text,
  coveredBy: text.nullable(),
});
const missingEntryDefect = z.strictObject({
  kind: z.literal('missing-entry'),
  blockLine: z.null(),
  source: defectSource,
  exactText: text,
  coveredBy: text.nullable(),
});
export const section15DefectSchema = z.discriminatedUnion('kind', [
  wrongLineDefect,
  missingEntryDefect,
]);
/** A defect as a book check reports it, before its coverage is known. */
export const reportedDefectSchema = z.discriminatedUnion('kind', [
  wrongLineDefect.omit({ coveredBy: true }),
  missingEntryDefect.omit({ coveredBy: true }),
]);

/** PCGen's `OGL.txt` at the pin, as read. */
const pcgenFileSchema = z.strictObject({
  commit: z.string().regex(/^[0-9a-f]{40}$/),
  path: text,
  sha256: sha256Schema,
  encoding: z.enum(['utf-8', 'windows-1252']),
  hasBom: z.boolean(),
});
/** The shipped block: its line range and the sha256 of its decoded text. */
const blockSchema = z.strictObject({
  firstLine: z.number().int().positive(),
  lastLine: z.number().int().positive(),
  from: z.enum(['heading', 'section-14']),
  sha256: sha256Schema,
});
/** The one block line that names the book, and the title it matched. */
const ownLineSchema = z.strictObject({
  line: z.number().int().positive(),
  title: text,
  titleFrom: z.enum(['book', 'source-long', 'registry-title', 'own-line-alias']),
});
/** The `.pcc`'s `COPYRIGHT:` lines against the block; recorded only. */
const pccSchema = z.strictObject({ path: text, comparison: lineComparison });

/** A confirmation's fields, with its evidence as the variant has it. */
const confirmationShape = <
  Evidence extends {
    pcgen: z.ZodType;
    block: z.ZodType;
    ownLine: z.ZodType;
    pcc: z.ZodType;
  },
>(
  evidence: Evidence,
) => ({
  code: text,
  book: text,
  /** The book's own Registry notice and how the own line compares with it. */
  registry: z.strictObject({
    key: text.nullable(),
    titleMatch: z.enum(['code', 'automatic', 'proposed-alias']).nullable(),
    comparison: z.enum([...lineComparison.options, 'none']).nullable(),
  }),
  ...evidence,
  /** The PRD's Section 15 line for a PRD book; P10b compares it. */
  prd: z
    .strictObject({ capture: text, comparison: z.literal('pending') })
    .nullable(),
  defects: z.array(section15DefectSchema),
  /** The `pcgen-supplement:<code>` notice the book's #716 records require. */
  supplements: z.array(text),
  /** Earlier batches' chain holds a #716 candidate of this book passes. */
  waivedHoldIds: z.array(text),
});
/** A matched book, or one pending the PRD, has its file, block and own line. */
const confirmedEvidence = confirmationShape({
  pcgen: pcgenFileSchema,
  block: blockSchema,
  ownLine: ownLineSchema,
  pcc: pccSchema,
});
/** A book without an `OGL.txt` has no evidence at all. */
const unreadEvidence = confirmationShape({
  pcgen: z.null(),
  block: z.null(),
  ownLine: z.null(),
  pcc: z.null(),
});
/** A book whose `OGL.txt` was read but doesn't match may lack an own line. */
const readEvidence = confirmationShape({
  pcgen: pcgenFileSchema,
  block: blockSchema,
  ownLine: ownLineSchema.nullable(),
  pcc: pccSchema,
});
/** The confirmation's variants by status (and mismatch kind), each with `extra`. */
function confirmationVariants<Extra extends z.ZodRawShape>(extra: Extra) {
  return z.discriminatedUnion('status', [
    z.strictObject({
      ...confirmedEvidence,
      status: z.literal('matched'),
      mismatch: z.null(),
      ...extra,
    }),
    z.strictObject({
      ...confirmedEvidence,
      status: z.literal('pending-prd'),
      mismatch: z.null(),
      ...extra,
    }),
    z.discriminatedUnion('mismatch', [
      z.strictObject({
        ...unreadEvidence,
        status: z.literal('mismatch'),
        mismatch: z.literal('no-pcgen-ogl'),
        ...extra,
      }),
      z.strictObject({
        ...readEvidence,
        status: z.literal('mismatch'),
        mismatch: z.enum(readMismatchKinds),
        ...extra,
      }),
    ]),
  ]);
}
const reviewSchema = z.discriminatedUnion('status', [
  z.strictObject(reviewStateShapes.drafted),
  z.strictObject(reviewStateShapes.checked),
]);
export const section15PayloadSchema = confirmationVariants({});
export type Section15Payload = z.infer<typeof section15PayloadSchema>;
export const section15ConfirmationSchema = confirmationVariants({
  measuredOn: z.iso.date(),
  review: reviewSchema,
});
export type Section15Confirmation = z.infer<typeof section15ConfirmationSchema>;
export type MatchedConfirmation = Extract<
  Section15Confirmation,
  { status: 'matched' }
>;

export const section15ConfirmationsSchema = z
  .strictObject({ confirmations: z.array(section15ConfirmationSchema) })
  .superRefine(({ confirmations }, context) => {
    const codes = confirmations.map(({ code }) => code);
    if (new Set(codes).size !== codes.length)
      context.addIssue({ code: 'custom', message: 'Duplicate book code.' });
  });

export const committedSection15Confirmations =
  section15ConfirmationsSchema.parse(confirmationsData).confirmations;

/** The decision a review checks: the confirmation apart from its review and date. */
export function confirmationPayload({
  review: _review,
  measuredOn: _measuredOn,
  ...payload
}: Section15Confirmation): Section15Payload {
  return payload;
}

/** The Registry key of a book's shipped PCGen block. */
export const pcgenNoticeKey = (code: string) => `pcgen:${code}`;
/** The Registry key of a book's supplemental exact notice. */
export const pcgenSupplementKey = (code: string) => `pcgen-supplement:${code}`;
/** The provenance line that names a block's confirmation. */
export const confirmationReference = (code: string) =>
  `confirmation: ${confirmationsPath}#${code}`;
const pcgenKey = /^pcgen(-supplement)?:(.+)$/;

/**
 * Plan §7: a #716 candidate is an `everythingpath/` key imported from PCGen or
 * the PRD. Only a proven upstream key shows that: a candidate without one, such
 * as a retained use whose definition the artifact no longer carries, isn't.
 */
export function is716Candidate({
  externalKey,
  upstreamKey,
}: {
  externalKey: string;
  upstreamKey?: string;
}) {
  return (
    externalKey.startsWith('everythingpath/') &&
    upstreamKey !== undefined &&
    /^(pcgen|prd):/.test(upstreamKey)
  );
}

/** The pinned store copy of PCGen's data folder in a checkout, which the matcher reads. */
export const pinnedPcgenRootAt = (root: string) =>
  join(root, `tests/fixtures/pinned/pcgen/${pcgenPin.directory}/`);
/** Reads the sha256 of a pinned PCGen file in a checkout now, or undefined when its store lacks it. */
export function readPinnedPcgenSha256At(root: string) {
  const pinned = pinnedPcgenRootAt(root);
  return (path: string) => {
    try {
      return createHash('sha256')
        .update(readFileSync(join(pinned, path)))
        .digest('hex');
    } catch {
      return undefined;
    }
  };
}
const thisCheckout = join(dirname(fileURLToPath(import.meta.url)), '../../..');
/** This checkout's pinned store copy of PCGen's data folder. */
export const pinnedPcgenRoot = pinnedPcgenRootAt(thisCheckout);
/** The sha256 of a pinned PCGen file in this checkout now. */
export const readPinnedPcgenSha256 = readPinnedPcgenSha256At(thisCheckout);

/**
 * The view of the confirmations: which books a candidate may use PCGen's
 * block for, the notices that brings, and the holds a #716 candidate passes.
 * `currentSha256` reads a PCGen file's hash now (the pinned store by default);
 * a confirmation is current while its pin and `OGL.txt` hash still hold.
 */
export function createSection15Lookup({
  confirmations = committedSection15Confirmations,
  registry,
  currentSha256 = readPinnedPcgenSha256,
}: {
  confirmations?: readonly Section15Confirmation[];
  registry: Section15Registry;
  currentSha256?: (path: string) => string | undefined;
}) {
  const byCode = new Map(confirmations.map((row) => [row.code, row]));
  const current = new Map<string, boolean>();
  const isCurrent = (confirmation: Section15Confirmation) => {
    const { pcgen } = confirmation;
    if (pcgen?.commit !== pcgenPin.commit) return false;
    let result = current.get(pcgen.path);
    if (result === undefined) {
      result = currentSha256(pcgen.path) === pcgen.sha256;
      current.set(pcgen.path, result);
    }
    return result;
  };
  const index = createNoticeIndex({ registry });
  /** Whether a candidate of this book may use PCGen's block: matched, checked and current. */
  const isEligible = (code: string) => {
    const confirmation = byCode.get(code);
    return (
      confirmation?.status === 'matched' &&
      confirmation.review.status === 'checked' &&
      isCurrent(confirmation)
    );
  };
  return {
    confirmationOf: (code: string) => byCode.get(code),
    isEligible,
    isCurrent,
    /**
     * What a #716 candidate requires for a required book code (plan §7 "What
     * a #716 record requires"): for a matched book, its reviewed Registry
     * notice, `pcgen:<code>` and its supplement; otherwise the Registry notice
     * (or the bare code), which stays held. A code that isn't a #716 book is
     * unchanged.
     */
    requirementsOf(code: string): string[] {
      const confirmation = byCode.get(code);
      if (!confirmation) return [code];
      const registryKey = confirmation.registry.key;
      const isMatched = confirmation.status === 'matched';
      const registryNotice = registryKey ? index.get(registryKey) : undefined;
      const requirements = [
        ...(registryKey && (!isMatched || isReviewedNotice(registryNotice))
          ? [registryKey]
          : []),
        ...(isMatched
          ? [pcgenNoticeKey(code), ...confirmation.supplements]
          : []),
      ];
      return requirements.length ? requirements : [code];
    },
    /** The notice identities whose holds hold a book's #716 requirements. */
    holdKeysOf(code: string): string[] {
      const confirmation = byCode.get(code);
      return [
        code,
        pcgenNoticeKey(code),
        ...(confirmation?.registry.key ? [confirmation.registry.key] : []),
      ];
    },
    /** The holds a #716 candidate of this book passes: only an eligible book's. */
    waivedHoldIdsOf(code: string): ReadonlySet<string> {
      return new Set(
        isEligible(code) ? (byCode.get(code)?.waivedHoldIds ?? []) : [],
      );
    },
    /**
     * Plan §7 "Candidate eligibility", extended to every candidate (owner,
     * 2026-10-30): a `pcgen:` or supplemental notice counts only for an
     * eligible book, and only when it is publishable; every other notice
     * keeps `isReviewedNotice`.
     */
    countsAsReviewed(code: string) {
      const notice = resolveNotice({ registry, code, index });
      const book = pcgenKey.exec(code)?.[2];
      if (book === undefined) return isReviewedNotice(notice);
      return isEligible(book) && isPublishableNotice(notice);
    },
  };
}
export type Section15Lookup = ReturnType<typeof createSection15Lookup>;

/**
 * Plan §7 "Publication contract": the build fails when a `pcgen` Registry
 * record has no confirmation, or one that isn't matched and current, or when
 * the record doesn't hold the confirmed block; a matched book needs its
 * record, and a record is reviewed exactly when its confirmation is checked.
 */
export function findSection15RegistryProblems({
  registry,
  confirmations = committedSection15Confirmations,
  currentSha256 = readPinnedPcgenSha256,
}: {
  registry: Section15Registry;
  confirmations?: readonly Section15Confirmation[];
  currentSha256?: (path: string) => string | undefined;
}) {
  const lookup = createSection15Lookup({
    confirmations,
    registry,
    currentSha256,
  });
  return [
    ...Object.entries(registry).flatMap(([key, notice]) =>
      findRecordProblems({ key, notice, lookup }),
    ),
    ...confirmations.flatMap((confirmation) =>
      findMissingRecords({ confirmation, registry }),
    ),
  ];
}
type RegistryNotice = Section15Registry[string];
/** The problems of one Registry record: only `pcgen:` and supplement records have any. */
function findRecordProblems({
  key,
  notice,
  lookup,
}: {
  key: string;
  notice: RegistryNotice;
  lookup: Section15Lookup;
}): string[] {
  const parsed = pcgenKey.exec(key);
  if (!parsed)
    return notice.checkedAgainst === 'pcgen'
      ? [`${key} is checked against pcgen but isn't pcgen:<code>.`]
      : [];
  const [, supplement, code = ''] = parsed;
  const misfiled =
    supplement !== undefined && notice.checkedAgainst === 'pcgen'
      ? [`${key} is a supplement but is checked against pcgen.`]
      : [];
  const confirmation = lookup.confirmationOf(code);
  if (!confirmation) return [...misfiled, `${key} has no confirmation.`];
  if (supplement !== undefined)
    return confirmation.supplements.includes(key)
      ? misfiled
      : [...misfiled, `${key} isn't listed by its confirmation.`];
  return findBlockProblems({
    key,
    notice,
    confirmation,
    isCurrent: lookup.isCurrent(confirmation),
  });
}
/** The problems of a `pcgen:<code>` record against its book's confirmation. */
function findBlockProblems({
  key,
  notice,
  confirmation,
  isCurrent,
}: {
  key: string;
  notice: RegistryNotice;
  confirmation: Section15Confirmation;
  isCurrent: boolean;
}) {
  const review = confirmation.review.status;
  const checks: [failed: boolean, problem: string][] = [
    [notice.checkedAgainst !== 'pcgen', `${key} isn't checked against pcgen.`],
    [
      confirmation.status !== 'matched',
      `${key}'s confirmation is ${confirmation.status}.`,
    ],
    [!isCurrent, `${key}'s confirmation is stale.`],
    [
      createHash('sha256').update(notice.notice).digest('hex') !==
        confirmation.block?.sha256,
      `${key} doesn't hold the confirmed block.`,
    ],
    [
      !notice.provenance.includes(confirmationReference(confirmation.code)),
      `${key} doesn't name its confirmation.`,
    ],
    [
      (notice.reviewStatus === 'reviewed') !== (review === 'checked'),
      `${key} is ${notice.reviewStatus} but its confirmation is ${review}.`,
    ],
  ];
  return checks.flatMap(([failed, problem]) => (failed ? [problem] : []));
}
/** A matched book's missing `pcgen:` record, and any supplement it lists that is missing. */
function findMissingRecords({
  confirmation,
  registry,
}: {
  confirmation: Section15Confirmation;
  registry: Section15Registry;
}) {
  return [
    ...(confirmation.status === 'matched' &&
    !registry[pcgenNoticeKey(confirmation.code)]
      ? [`${confirmation.code} is matched but has no pcgen record.`]
      : []),
    ...confirmation.supplements
      .filter((key) => !registry[key])
      .map((key) => `${confirmation.code} lists ${key}, which is missing.`),
  ];
}

/**
 * The confirmations as review receipts cover them (#757): by book, bound to
 * the `OGL.txt` hash, with the confirmation as payload. Checking one marks the
 * confirmation checked and its `pcgen:<code>` record reviewed on that date.
 */
export function listSection15Reviews({
  confirmations,
  registry,
}: {
  confirmations: Section15Confirmation[];
  registry: Record<string, { reviewStatus: string; checkedOn: string }>;
}): ReviewedRecord[] {
  return confirmations.map((confirmation) => ({
    id: `section15-confirmation ${confirmation.code}`,
    sources: [
      {
        subject: confirmation.pcgen
          ? `pcgen:${confirmation.pcgen.path}`
          : `pcgen-book:${confirmation.code}`,
        sourceSha256:
          confirmation.pcgen?.sha256 ??
          hashReviewPayload({ book: confirmation.book }),
      },
    ],
    payloadSha256: hashReviewPayload(confirmationPayload(confirmation)),
    review: readReviewState(confirmation.review),
    check: (review: CheckedReview) => {
      confirmation.review = review;
      const notice = registry[pcgenNoticeKey(confirmation.code)];
      if (notice)
        Object.assign(notice, {
          reviewStatus: 'reviewed',
          checkedOn: review.reviewedOn,
        });
    },
  }));
}
