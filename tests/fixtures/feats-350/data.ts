import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { importedCatalogEntrySchema } from '../../../src/lib/catalog/imported-entry-schema';

function snapshot(name: string): unknown {
  return JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
}
const strings = z.array(z.string());
const sourceSchema = z.object({ path: z.string(), sha256: z.string() });
const comparisonSchema = z.object({
  path: z.string(),
  line: z.number(),
  literalRow: z.string(),
  comparisonLineSha256: z.string(),
  comparisonFileSha256: z.string(),
  completeDirectComparison: z.boolean(),
});
const candidateSchema = z.object({
  externalKey: z.string(),
  name: z.string(),
  disposition: z.enum(['held', 'admitted']),
  source: sourceSchema,
  descriptionSha256: z.string(),
  requiredNotices: strings,
  holdIds: strings,
  noticeRequirementsComplete: z.boolean(),
  evidenceId: z.string(),
  currentBinding: z.object({
    contentFingerprint: z.string(),
    mappingFingerprint: z.string(),
    evidenceFingerprints: z.record(z.string(), z.string()),
    noticeFingerprints: z.record(z.string(), z.string()),
  }),
  noticeHoldIds: strings,
  comparison: comparisonSchema.nullable(),
  additionalComparisonLeads: z.array(comparisonSchema),
  inheritedRuleUnresolvedOrigins: z
    .array(
      z.object({
        rule: z.string(),
        holdId: z.string(),
        reason: z.string(),
      }),
    )
    .optional(),
  inheritedRuleNotices: z.array(z.object({ book: z.string() })),
  inheritedRuleSourceEvidence: z
    .array(
      z.object({
        fixturePath: z.string(),
        sha256: z.string(),
        description: z.string().optional(),
      }),
    )
    .default([]),
  inheritedRuleComparisonEvidence: z
    .array(
      z.object({
        fixturePath: z.string(),
        sha256: z.string(),
        description: z.string().optional(),
      }),
    )
    .default([]),
  mechanicsReview: z.object({
    descriptionText: z.string(),
    rawMechanics: z.object({
      changes: z.array(z.object({ formula: z.string() })),
    }),
    mappedFacts: z.object({
      sources: z.array(z.unknown()),
      modifiers: z.array(z.unknown()),
      prerequisites: z.array(z.unknown()),
      proficiencies: z.array(z.unknown()),
    }),
    curationRecords: z.array(z.unknown()),
    outstandingCalculations: strings,
    proficiencyReview: z.object({ outstandingFacts: strings }),
    prerequisiteReview: z.object({ outstandingFacts: strings }),
  }),
});
export const review = z
  .object({
    candidates: z.array(candidateSchema),
    counts: z.record(z.string(), z.number()),
    noticeRequirements: z.array(
      z.object({
        book: z.string(),
        registryKeys: strings,
        holdId: z.string().nullable(),
      }),
    ),
    comparisonSources: z.object({ pcgenFiles: z.array(sourceSchema) }),
  })
  .parse(snapshot('../../../scripts/catalog/legal/feats-350.json'));
export const preview = z
  .object({
    entries: z.array(importedCatalogEntrySchema),
    remaps: z.array(z.unknown()),
    comparison: z.object({
      records: z.array(z.unknown()),
      packs: z.array(z.unknown()),
    }),
  })
  .parse(snapshot('preview.json'));
export const provenance = z
  .object({
    candidateKeysSha256: z.string(),
    candidates: z.array(z.object({ externalKey: z.string() })),
  })
  .parse(snapshot('provenance.json'));
const identity = z.object({ identity: z.string(), sha256: z.string() });
export const originals = z
  .object({
    fixtures: z.array(identity),
    inventories: z.array(identity),
    rawFiles: z.record(
      z.string(),
      z.object({ path: z.string(), sha256: z.string() }),
    ),
    assessments: z.array(identity),
    evidence: z.array(identity),
    holds: z.array(identity),
    overlay: z.array(identity),
    situations: z.array(identity),
    registry: z.array(identity),
  })
  .parse(snapshot('original-identities.json'));
