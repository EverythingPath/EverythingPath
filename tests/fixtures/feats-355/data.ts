import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { importedCatalogEntrySchema } from '../../../src/lib/catalog/imported-entry-schema';
import { curationSchema } from '../../../scripts/catalog/curation';

function snapshot(name: string): unknown {
  return JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
}
const strings = z.array(z.string());
const source = z.object({ path: z.string(), sha256: z.string() });
const comparison = z.object({
  path: z.string(),
  line: z.number(),
  literalRow: z.string(),
  comparisonFileSha256: z.string(),
  comparisonLineSha256: z.string(),
  completeDirectComparison: z.boolean(),
  appliesToRootBody: z.boolean().optional(),
  componentComparison: z
    .object({
      benefit: z.object({
        upstreamText: z.string(),
        comparisonText: z.string(),
        normalizedEquality: z.boolean(),
      }),
    })
    .optional(),
});
const support = source.extend({
  name: z.string(),
  externalKey: z.string(),
  repo: z.string(),
  fixturePath: z.string(),
  description: z.string(),
  descriptionSha256: z.string(),
  bodyRole: z.string(),
  role: z.string(),
  completeGoverningBody: z.boolean(),
  books: strings,
  relationship: z.object({
    root: z.string(),
    rule: z.string(),
    scope: z.string(),
    reason: z.string(),
  }),
  relationshipAudit: z.object({
    bodyRole: z.string(),
    relationshipBasis: z.string(),
    notesInstalled: z.literal(0),
  }),
});
export const review = z
  .object({
    reviewedBy: z.string(),
    reviewedOn: z.string(),
    counts: z.record(z.string(), z.number()),
    noticeRequirements: z.array(
      z.object({
        book: z.string(),
        registryKeys: strings,
        holdId: z.string().nullable(),
      }),
    ),
    comparisonSources: z.object({ pcgenFiles: z.array(source) }),
    candidates: z.array(
      z.object({
        externalKey: z.string(),
        name: z.string(),
        disposition: z.enum(['held', 'admitted']),
        source,
        descriptionSha256: z.string(),
        requiredNotices: strings,
        evidenceId: z.string(),
        holdIds: strings,
        noticeHoldIds: strings,
        comparison: comparison.nullable(),
        additionalComparisonLeads: z.array(comparison),
        currentBinding: z.object({
          contentFingerprint: z.string(),
          mappingFingerprint: z.string(),
          evidenceFingerprints: z.record(z.string(), z.string()),
          noticeFingerprints: z.record(z.string(), z.string()),
        }),
        inheritedRuleSourceEvidence: z.array(support),
        auditOnlySourceEvidence: z.array(support),
        mechanicsReview: z.object({
          descriptionText: z.string(),
          curationRecords: curationSchema.shape.records,
          mappedFacts: z.object({
            sources: z.array(z.unknown()),
            modifiers: z.array(z.unknown()),
            prerequisites: z.array(z.unknown()),
            proficiencies: z.array(z.unknown()),
          }),
          outstandingCalculations: strings,
          prerequisiteReview: z.object({
            authoredText: z.string(),
            normalizedAtoms: z.array(z.unknown()),
            publishedClauses: z.array(z.object({ text: z.string() })),
            outstandingFacts: strings,
          }),
        }),
      }),
    ),
  })
  .parse(snapshot('../../../scripts/catalog/legal/feats-355.json'));
export const preview = z
  .object({ entries: z.array(importedCatalogEntrySchema) })
  .parse(snapshot('preview.json'));
export const provenance = z
  .object({
    candidateKeysSha256: z.string(),
    candidates: z.array(
      z.object({
        externalKey: z.string(),
        sourcePath: z.string(),
        sha256: z.string(),
      }),
    ),
  })
  .parse(snapshot('provenance.json'));
const identity = z.object({ identity: z.string(), sha256: z.string() });
export const originals = z
  .object({
    fixtures: z.array(identity),
    inventories: z.array(identity),
    rawFiles: z.record(z.string(), source),
    assessments: z.array(identity),
    evidence: z.array(identity),
    holds: z.array(identity),
    overlay: z.array(identity),
    situations: z.array(identity),
    registry: z.array(identity),
  })
  .parse(snapshot('original-identities.json'));
