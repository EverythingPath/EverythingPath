import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { importedCatalogEntrySchema } from '../../../src/lib/catalog/imported-entry-schema';
import { curationSchema } from '../../../scripts/catalog/curation';

function snapshot(name: string): unknown {
  return JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
}
const strings = z.array(z.string());
const source = z.object({
  repo: z.literal('pf1-content'),
  path: z.string(),
  sha256: z.string(),
});
const comparison = z.object({
  path: z.string(),
  line: z.number(),
  literalRow: z.string(),
  comparisonFileSha256: z.string(),
  comparisonLineSha256: z.string(),
  book: z.string(),
  appliesToRootBody: z.boolean(),
  evidenceRole: z.string(),
  publicationAnchor: z.object({
    path: z.string(),
    line: z.number(),
    text: z.string(),
    sha256: z.string(),
  }),
});
export const review = z
  .object({
    reviewedBy: z.string(),
    reviewedOn: z.string(),
    counts: z.record(z.string(), z.number()),
    comparisonSources: z.object({
      pcgenFiles: z.array(source.omit({ repo: true })),
    }),
    noticeRequirements: z.array(
      z.object({
        book: z.string(),
        registryKeys: strings,
        holdId: z.string().nullable(),
        candidates: strings,
      }),
    ),
    candidates: z.array(
      z.object({
        externalKey: z.string(),
        name: z.string(),
        disposition: z.enum(['held', 'admitted']),
        assessmentStatus: z.enum(['unresolved', 'confirmed']),
        source,
        descriptionSha256: z.string(),
        requiredNotices: strings,
        evidenceId: z.string(),
        holdIds: strings,
        noticeHoldIds: strings,
        sourceFields: z.record(z.string(), z.unknown()),
        comparison: comparison.nullable(),
        additionalComparisonLeads: z.array(comparison),
        rejectedRootComparisonEvidence: z.array(comparison),
        inheritedRuleComparisonEvidence: z.array(comparison),
        inheritedRuleNotices: z.array(
          z.object({ book: z.string(), rule: z.string() }),
        ),
        inheritedRuleUnresolvedOrigins: strings,
        currentBinding: z.object({
          contentFingerprint: z.string(),
          mappingFingerprint: z.string(),
          evidenceFingerprints: z.record(z.string(), z.string()),
          noticeFingerprints: z.record(z.string(), z.string()),
        }),
        mechanicsReview: z.object({
          descriptionText: z.string(),
          curationRecords: curationSchema.shape.records,
          outstandingCalculations: strings,
          proseOnlyRules: z.string(),
          sourceDiscrepancies: strings,
          prerequisiteReview: z.object({
            authoredText: z.string(),
            normalizedAtoms: z.array(z.unknown()),
            publishedClauses: z.array(z.object({ text: z.string() })),
            outstandingFacts: strings,
            repeatability: z.string(),
          }),
        }),
      }),
    ),
  })
  .parse(snapshot('../../../scripts/catalog/legal/feats-358.json'));
export const preview = z
  .object({ entries: z.array(importedCatalogEntrySchema) })
  .parse(snapshot('preview.json'));

// Only this batch's root bodies are materialized from the shared store.
export const pinnedFiles = review.candidates.map(
  (row) => `${row.source.repo}/${row.source.path}`,
);
export const pinnedSha256 = Object.fromEntries(
  review.candidates.map((row) => [
    `${row.source.repo}/${row.source.path}`,
    row.source.sha256,
  ]),
);
