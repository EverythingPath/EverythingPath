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
  completeDirectComparison: z.boolean(),
  evidenceRole: z.string(),
  publicationAnchor: z.object({
    path: z.string(),
    line: z.number(),
    text: z.string(),
    sha256: z.string(),
  }),
});
const binding = z.object({
  contentFingerprint: z.string(),
  mappingFingerprint: z.string(),
  evidenceFingerprints: z.record(z.string(), z.string()),
  noticeFingerprints: z.record(z.string(), z.string()),
});
const linked = z.object({
  externalKey: z.string(),
  name: z.string(),
  repo: z.enum(['pf1', 'pf1-content']),
  path: z.string(),
  sha256: z.string(),
  sources: z.array(z.object({ id: z.string(), pages: z.string() })),
});
const candidate = z.object({
  externalKey: z.string(),
  name: z.string(),
  kind: z.literal('companionFeature'),
  companionRecord: z.enum(['animalCompanionRules', 'animalCompanionFeature']),
  disposition: z.enum(['held', 'admitted']),
  assessmentStatus: z.enum(['confirmed', 'unresolved']),
  source,
  descriptionSha256: z.string(),
  citedSources: z.array(z.object({ book: z.string(), pages: z.string() })),
  requiredNotices: strings,
  noticeRequirementsComplete: z.literal(true),
  evidenceId: z.string(),
  holdIds: strings,
  noticeHoldIds: strings,
  sourceFields: z.record(z.string(), z.unknown()),
  comparison,
  additionalComparisonLeads: z.array(comparison),
  inheritedRuleComparisonEvidence: z.array(comparison),
  inheritedRuleNotices: z.array(
    z.object({ book: z.string(), rule: z.string(), location: z.string() }),
  ),
  inheritedRuleSourceEvidence: z.array(linked),
  linkedContentReview: z.array(linked),
  currentBinding: binding,
  mechanicsReview: z.object({
    descriptionText: z.string(),
    curationRecords: curationSchema.shape.records,
    companionReview: z.object({
      masterLevel: z.number().nullable(),
      beneficiary: z.enum(['companion', 'master']),
      statisticsOn: z.literal('companion'),
      schedule: z
        .array(z.object({ masterLevel: z.number(), features: strings }))
        .optional(),
    }),
    outstandingCalculations: strings,
    proseOnlyRules: z.string(),
    sourceDiscrepancies: strings,
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
    candidates: z.array(candidate),
  })
  .parse(
    snapshot('../../../scripts/catalog/legal/pf-companion-features-507.json'),
  );
/**
 * The batch's resources (`entries`) and the records their full-corpus content
 * closures reach outside the batch (the feats Animal Companion Feats links and
 * what those link), as the full-corpus preview imported them.
 */
export const preview = z
  .object({
    entries: z.array(importedCatalogEntrySchema),
    closure: z.array(importedCatalogEntrySchema),
  })
  .parse(snapshot('preview.json'));

// The batch's twelve records. Their closures' linked bodies are committed in
// the fixture; the bindings use those full-corpus copies.
const sources = review.candidates.map((row) => row.source);
export const pinnedFiles = sources.map((row) => `${row.repo}/${row.path}`);
export const pinnedSha256 = Object.fromEntries(
  sources.map((row) => [`${row.repo}/${row.path}`, row.sha256]),
);
