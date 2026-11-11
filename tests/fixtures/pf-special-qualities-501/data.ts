import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { importedCatalogEntrySchema } from '../../../src/lib/catalog/imported-entry-schema';
import { curationSchema } from '../../../scripts/catalog/curation';

function snapshot(name: string): unknown {
  return JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
}
const strings = z.array(z.string());
const source = z.object({
  repo: z.enum(['pf1', 'pf1-content']),
  path: z.string(),
  sha256: z.string(),
});
const book = z.object({ book: z.string(), pages: z.string().optional() });
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
  publicationTitle: z.string(),
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
// A pinned record or Universal Monster Rules page whose rules a body builds
// on, with the books it cites.
const inheritedSource = source.extend({
  sources: z.array(z.object({ id: z.string(), pages: z.string() })),
  externalKey: z.string().optional(),
  pageId: z.string().optional(),
});
const assessed = z.object({
  externalKey: z.string(),
  name: z.string(),
  kind: z.literal('itemAbility'),
  disposition: z.enum(['admitted', 'held', 'dependently-omitted']),
  assessmentStatus: z.enum(['confirmed', 'unresolved']),
  source,
  descriptionSha256: z.string(),
  citedSources: z.array(book),
  requiredNotices: strings,
  noticeRequirementsComplete: z.boolean(),
  evidenceId: z.string(),
  rationale: z.string(),
  holdIds: strings,
  noticeHoldIds: strings,
  sourceFields: z.record(z.string(), z.unknown()),
  comparison: comparison.nullable(),
  additionalComparisonLeads: z.array(comparison),
  rejectedRootComparisonEvidence: z.array(comparison),
  inheritedRuleNotices: z.array(
    z.object({ book: z.string(), rule: z.string(), location: z.string() }),
  ),
  inheritedRuleSourceEvidence: z.array(inheritedSource),
  inheritedRuleComparisonEvidence: z.array(comparison),
  linkedContentReview: z.array(z.unknown()),
  // The helper record a seeded curation record binds (Corrosive Burst).
  seedSources: z.array(source),
  closureDependencies: z.array(z.unknown()),
  currentBinding: binding,
  mechanicsReview: z.object({
    descriptionText: z.string(),
    curationRecords: curationSchema.shape.records,
    itemAbilityReview: z.object({
      pinnedTags: strings,
      mappedAppliesTo: z.string().nullable(),
      appliesToAgrees: z.boolean(),
      priceLine: z.string().nullable(),
      bonusEquivalent: z.number(),
    }),
    outstandingCalculations: strings,
    proseOnlyRules: z.string(),
    sourceDiscrepancies: strings,
  }),
});
const excludedFolder = z.object({
  externalKey: z.string(),
  name: z.string(),
  kind: z.literal('folder'),
  disposition: z.literal('excluded'),
  rawKey: z.string(),
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
    candidates: z.array(z.union([assessed, excludedFolder])),
  })
  .parse(
    snapshot('../../../scripts/catalog/legal/pf-special-qualities-501.json'),
  );
export const assessedAbilities = review.candidates.flatMap((row) =>
  row.disposition === 'excluded' ? [] : [row],
);
export const excludedFolders = review.candidates.flatMap((row) =>
  row.kind === 'folder' ? [row] : [],
);
// The full-corpus preview's entries for the batch's 98 Item Abilities, and
// the entries in their content closures (none: no body links a catalog
// entry), which the assessments bind against.
export const preview = z
  .object({
    entries: z.array(importedCatalogEntrySchema),
    closure: z.array(importedCatalogEntrySchema),
  })
  .parse(snapshot('preview.json'));

// The batch's records, the pinned records and journal its bodies build on
// and the helper record a seeded record binds
// (checked against their recorded digests), from the shared store.
const pinned = [
  ...review.candidates.map((row) => row.source),
  ...assessedAbilities.flatMap((row) => [
    ...row.inheritedRuleSourceEvidence,
    ...row.seedSources,
  ]),
];
export const pinnedSha256 = Object.fromEntries(
  pinned.map((row) => [`${row.repo}/${row.path}`, row.sha256]),
);
export const pinnedFiles = [
  ...new Set(pinned.map((row) => `${row.repo}/${row.path}`)),
];
