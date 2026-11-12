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
// One statistic: the pinned record (template defaults where it leaves them
// out), the mapped detail and the PCGen row (per unit); agrees is null when
// the row doesn't state it.
const statistic = z.object({
  field: z.enum([
    'price',
    'weight',
    'casterLevel',
    'armorBonus',
    'rangeIncrement',
    'damageTypes',
    'proficiency',
    'handedness',
  ]),
  pinned: z.unknown(),
  mapped: z.unknown(),
  pcgen: z.unknown(),
  agrees: z.boolean().nullable(),
});
const assessed = z.object({
  externalKey: z.string(),
  name: z.string(),
  kind: z.literal('item'),
  itemKind: z.enum([
    'adventuring gear',
    'alchemical item',
    'alchemical weapon',
    'clothing',
    'container',
    'food and drink',
    'kit',
    'mount',
    'poison',
    'ring',
    'rod',
    'staff',
    'tool',
    'wondrous item',
  ]),
  disposition: z.enum(['admitted', 'held']),
  assessmentStatus: z.enum(['confirmed', 'unresolved']),
  source,
  descriptionSha256: z.string(),
  citedSources: z.array(
    z.object({ book: z.string(), pages: z.string().optional() }),
  ),
  recordTags: strings,
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
  // How the body compares with the followed rows' DESC, SPROP or QUALITY text.
  bodyWording: z.enum([
    'same',
    'desc-plus',
    'minor',
    'differs',
    'sprop-part',
    'sprop-summary',
    'no-text',
    'empty',
    'none',
  ]),
  bodyWordingReview: z.string(),
  inheritedRuleNotices: z.array(
    z.object({ book: z.string(), rule: z.string(), location: z.string() }),
  ),
  inheritedRuleUnresolvedOrigins: strings,
  linkedContentReview: z.array(
    z.object({
      externalKey: z.string(),
      name: z.string(),
      repo: z.literal('pf1'),
      path: z.string(),
      sha256: z.string(),
      sources: z.array(
        z.object({
          id: z.string(),
          pages: z.union([z.string(), z.number()]).optional(),
        }),
      ),
    }),
  ),
  currentBinding: binding,
  // Complete attribution evidence held only on an importer gap (#762).
  releaseBlocker: z
    .object({ issue: z.string(), attributionComplete: z.literal(true) })
    .optional(),
  // Why the kits' embedded Unchained metadata requires no PZO1131.
  unchainedReview: z.string().optional(),
  mechanicsReview: z.object({
    descriptionText: z.string(),
    curationRecords: curationSchema.shape.records,
    gearReview: z.object({
      itemKind: z.string(),
      statistics: z.array(statistic),
      statisticsAgree: z.boolean(),
      disagreements: strings,
      baseItem: z.string(),
      defaults: z
        .object({ enhancement: z.number(), masterwork: z.boolean() })
        .nullable()
        .optional(),
      endState: z.string(),
    }),
    changeReplacement: z
      .object({
        change: z.object({
          target: z.string(),
          formula: z.string(),
          type: z.string(),
        }),
        formula: z.string(),
        evidence: z.string(),
      })
      .optional(),
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
    candidates: z.array(z.union([assessed, excluded])),
  })
  .parse(snapshot('../../../scripts/catalog/legal/items-431.json'));
export const assessedItems = review.candidates.flatMap((row) =>
  row.disposition === 'excluded' ? [] : [row],
);
export const excludedRows = review.candidates.flatMap((row) =>
  row.disposition === 'excluded' ? [row] : [],
);
// The full-corpus preview's entries for the batch's items, and the entries in
// their content closures (the bodies their descriptions link, and what those
// link in turn), which the assessments bind against.
export const preview = z
  .object({
    entries: z.array(importedCatalogEntrySchema),
    closure: z.array(importedCatalogEntrySchema),
  })
  .parse(snapshot('preview.json'));

// The batch's records and the bodies they link (checked against their
// recorded digests), from the shared store.
const pinned = [
  ...review.candidates.map((row) => row.source),
  ...assessedItems.flatMap((row) => row.linkedContentReview),
];
export const pinnedSha256 = Object.fromEntries(
  pinned.map((row) => [`${row.repo}/${row.path}`, row.sha256]),
);
export const pinnedFiles = [
  ...new Set(pinned.map((row) => `${row.repo}/${row.path}`)),
];
