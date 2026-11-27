import { z } from 'zod';
import {
  diagnosticConclusionRefSchema,
  diagnosticConclusionSchema,
} from './diagnostic-conclusions';

const text = z.string().trim().min(1);
const fingerprints = z.record(text, z.string().regex(/^[a-f0-9]{64}$/));
/** The sources a reviewed notice can be checked against. */
export const reviewedNoticeSources = [
  'printed',
  'prd',
  'aon',
  'pf1-content',
] as const;
const reviewedSources = reviewedNoticeSources;
const section15NoticeSchema = z.object({
  title: text,
  notice: z.string(),
  // #716 P10a: `pcgen` is PCGen's whole Section 15 block for a book, shipped
  // as `pcgen:<code>` under owner decision 5 (`section15-match.ts`).
  checkedAgainst: z.enum([
    ...reviewedSources,
    'pcgen',
    'owner-transcription',
    'unreviewed',
  ]),
  checkedOn: z.iso.date(),
  aliases: z.array(text),
  reviewStatus: z.enum(['reviewed', 'unreviewed']),
  provenance: z.array(text),
});

export function isReviewedNotice(
  notice: z.infer<typeof section15NoticeSchema> | undefined,
) {
  return (
    notice?.reviewStatus === 'reviewed' &&
    reviewedSources.some((source) => source === notice.checkedAgainst) &&
    notice.provenance.some((source) => source.trim().length > 0) &&
    notice.notice.trim().length > 0
  );
}

/**
 * Whether a notice can be published, with no candidate in view (#716 P10a,
 * plan §7 "Publication contract"): every notice `isReviewedNotice` accepts,
 * and a reviewed `pcgen` block with provenance and text that names its
 * confirmation. Whether a candidate may rely on a `pcgen` block is decided by
 * admission (`scripts/catalog/admission.ts`), not here.
 */
export function isPublishableNotice(
  notice: z.infer<typeof section15NoticeSchema> | undefined,
) {
  if (notice?.checkedAgainst !== 'pcgen') return isReviewedNotice(notice);
  return (
    notice.reviewStatus === 'reviewed' &&
    notice.provenance.some((source) => source.trim().length > 0) &&
    notice.provenance.some((source) => source.startsWith('confirmation: ')) &&
    notice.notice.trim().length > 0
  );
}

const section15RegistrySchema = z.record(
  text,
  section15NoticeSchema.refine(
    (notice) =>
      notice.reviewStatus !== 'reviewed' || isPublishableNotice(notice),
    {
      message:
        'Reviewed notices require checked source provenance and notice text.',
    },
  ),
);
const attributionEvidenceSchema = z.record(
  text,
  z.object({
    content: text,
    revoked: z.boolean().optional(),
    conclusion: diagnosticConclusionSchema.optional(),
  }),
);
const attributionAssessmentSchema = z.object({
  externalKey: text,
  status: z.enum(['confirmed', 'reviewed-coverage', 'unresolved']),
  contentFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  mappingFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  evidenceFingerprints: fingerprints,
  noticeFingerprints: fingerprints,
  requiredNotices: z.array(text),
  rationale: text,
  conclusionRef: diagnosticConclusionRefSchema.optional(),
  reviewedBy: text,
  reviewedOn: z.iso.date(),
});

export const retainedUseSchema = z.object({
  useId: text,
  externalKey: text,
  name: text,
  characterId: text,
  definitionFingerprint: text,
  admittedRelease: z.number().int().positive(),
  requiredNotices: z.array(text),
});
export const retainedExceptionSchema = z.object({
  useId: text,
  externalKey: text,
  definitionFingerprint: text,
  reason: text,
  requiredNotices: z.array(text),
});

export const reviewedAdmissionSchema = z
  .object({
    assessments: z.array(attributionAssessmentSchema),
    evidence: attributionEvidenceSchema,
    registry: section15RegistrySchema,
    retainedUses: z.array(retainedUseSchema).default([]),
    retainedExceptions: z.array(retainedExceptionSchema).default([]),
  })
  .superRefine((data, context) => {
    for (const [index, assessment] of data.assessments.entries()) {
      const ref = assessment.conclusionRef;
      if (
        ref &&
        (ref.externalKey !== assessment.externalKey ||
          data.evidence[ref.evidenceId]?.conclusion?.externalKey !==
            ref.externalKey ||
          !Object.hasOwn(assessment.evidenceFingerprints, ref.evidenceId))
      )
        context.addIssue({
          code: 'custom',
          path: ['assessments', index, 'conclusionRef'],
          message: 'Missing or mismatched diagnostic conclusion reference.',
        });
    }
  });

export type RetainedUse = z.infer<typeof retainedUseSchema>;
export type RetainedException = z.infer<typeof retainedExceptionSchema>;
export type AttributionAssessment = z.infer<typeof attributionAssessmentSchema>;
export type AttributionEvidence = z.infer<typeof attributionEvidenceSchema>;
export type Section15Registry = z.infer<typeof section15RegistrySchema>;
