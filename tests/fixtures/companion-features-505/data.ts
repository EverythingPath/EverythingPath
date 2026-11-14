import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { importedCatalogEntrySchema } from '../../../src/lib/catalog/imported-entry-schema';
import { curationSchema } from '../../../scripts/catalog/curation';

function snapshot(name: string): unknown {
  return JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
}
const strings = z.array(z.string());
const source = z.object({
  repo: z.literal('pf1'),
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
  repo: z.literal('pf1'),
  path: z.string(),
  sha256: z.string(),
  sources: z.array(z.object({ id: z.string(), pages: z.string() })),
});
const assessed = z.object({
  externalKey: z.string(),
  name: z.string(),
  kind: z.literal('companionFeature'),
  companionRecord: z.enum(['familiarRules', 'familiarAbility']),
  disposition: z.enum(['held', 'admitted']),
  assessmentStatus: z.literal('confirmed'),
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
      beneficiary: z.enum(['familiar', 'master']),
      statisticsOn: z.enum(['companion', 'master']),
      schedule: z
        .array(z.object({ masterLevel: z.number(), abilities: strings }))
        .optional(),
      table: z
        .array(
          z.object({
            masterLevels: z.array(z.number()),
            naturalArmor: z.number(),
            intelligence: z.number(),
          }),
        )
        .optional(),
    }),
    outstandingCalculations: strings,
    proseOnlyRules: z.string(),
    sourceDiscrepancies: strings,
  }),
});
const excluded = z.object({
  externalKey: z.string(),
  name: z.string(),
  kind: z.literal('folder'),
  disposition: z.literal('excluded'),
  source,
  contractReason: z.string(),
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
    candidates: z.array(z.union([assessed, excluded])),
  })
  .parse(
    snapshot('../../../scripts/catalog/legal/companion-features-505.json'),
  );
export const assessedCandidates = review.candidates.flatMap((row) =>
  row.disposition === 'excluded' ? [] : [row],
);
/**
 * The batch's resources (`entries`) and the records their full-corpus content
 * closures reach outside the batch (the Alertness feat and the scrying
 * spell), as the full-corpus preview imported them.
 */
export const preview = z
  .object({
    entries: z.array(importedCatalogEntrySchema),
    closure: z.array(importedCatalogEntrySchema),
  })
  .parse(snapshot('preview.json'));

// The batch's own records (the folder included, so the pack imports whole)
// and the two linked bodies their closures reach outside the pack, so the
// bounded import accounts for every closure entry; the bindings use the
// committed full-corpus copies.
const linkedSources = [
  ...new Map(
    assessedCandidates
      .flatMap((row) => row.linkedContentReview)
      .filter((row) => !row.path.startsWith('packs/companion-features/'))
      .map((row) => [row.externalKey, row]),
  ).values(),
];
export const linkedKeys = linkedSources.map((row) => row.externalKey);
const sources = [
  ...review.candidates.map((row) => row.source),
  ...linkedSources,
];
export const pinnedFiles = sources.map((row) => `${row.repo}/${row.path}`);
export const pinnedSha256 = Object.fromEntries(
  sources.map((row) => [`${row.repo}/${row.path}`, row.sha256]),
);
