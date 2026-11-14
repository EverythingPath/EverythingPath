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
const linked = z.object({
  externalKey: z.string(),
  name: z.string(),
  repo: z.enum(['pf1', 'pf1-content']),
  path: z.string(),
  sha256: z.string(),
  sources: z.array(z.object({ id: z.string(), pages: z.string() })),
  assessment: z.enum(['confirmed', 'unresolved']).nullable(),
  fullPreviewAdmission: z.string(),
});
const assessed = z.object({
  externalKey: z.string(),
  name: z.string(),
  kind: z.enum(['spellEffect', 'classFeature', 'item', 'manual']),
  buffSubType: z.enum(['spell', 'feat']).nullable(),
  disposition: z.enum(['admitted', 'held', 'dependently-omitted']),
  assessmentStatus: z.enum(['confirmed', 'unresolved']),
  source,
  descriptionSha256: z.string(),
  citedSources: z.array(
    z.object({ book: z.string(), pages: z.string().optional() }),
  ),
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
  prdComparisonEvidence: z.array(
    z.object({
      capture: z.string(),
      path: z.string(),
      sha256: z.string(),
      section: z.string(),
    }),
  ),
  inheritedRuleNotices: z.array(
    z.object({ book: z.string(), rule: z.string(), location: z.string() }),
  ),
  inheritedRuleSourceEvidence: z.array(linked),
  linkedContentReview: z.array(linked),
  closureDependencies: z.array(
    z.object({
      externalKey: z.string(),
      fullPreviewAdmission: z.string(),
    }),
  ),
  currentBinding: binding,
  mechanicsReview: z.object({
    descriptionText: z.string(),
    curationRecords: curationSchema.shape.records,
    effectReview: z.object({
      buffKind: z.string(),
      spellKey: z.string().nullable().optional(),
      defaultCasterLevel: z.number().nullable().optional(),
      importedChanges: z.array(
        z.object({
          change: z.object({
            target: z.string(),
            formula: z.string(),
            type: z.string(),
          }),
          imported: z.enum(['mapped', 'unsupported']),
        }),
      ),
    }),
    outstandingCalculations: strings,
    proseOnlyRules: z.string(),
    sourceDiscrepancies: strings,
  }),
});
const excluded = z.object({
  externalKey: z.string(),
  name: z.string(),
  kind: z.enum(['folder', 'conditionalHelper']),
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
    changeReplacements: z.array(
      z.object({
        externalKey: z.string(),
        change: z.object({
          target: z.string(),
          formula: z.string(),
          type: z.string(),
        }),
        formula: z.string(),
      }),
    ),
    candidates: z.array(z.union([assessed, excluded])),
  })
  .parse(snapshot('../../../scripts/catalog/legal/pf-buffs-549.json'));
export const assessedBuffs = review.candidates.flatMap((row) =>
  row.disposition === 'excluded' ? [] : [row],
);
export const excludedRows = review.candidates.flatMap((row) =>
  row.disposition === 'excluded' ? [row] : [],
);
// The full-corpus preview's entries for the batch's buffs, and the entries in
// their content closures (the Spells, class abilities, feats and racial traits
// their descriptions link, and what those link), which the assessments bind
// against.
export const preview = z
  .object({
    entries: z.array(importedCatalogEntrySchema),
    closure: z.array(importedCatalogEntrySchema),
  })
  .parse(snapshot('preview.json'));

// The batch's records and the bodies they link (checked against their
// recorded digests), from the shared store. Links into records the import
// excludes (the ARG race builder traits) stay out of the tree, as in the full
// corpus, where they don't resolve.
const pinned = [
  ...review.candidates.map((row) => row.source),
  ...assessedBuffs.flatMap((row) =>
    row.linkedContentReview.filter(
      (linked) => linked.fullPreviewAdmission !== 'not imported',
    ),
  ),
];
export const pinnedSha256 = Object.fromEntries(
  pinned.map((row) => [`${row.repo}/${row.path}`, row.sha256]),
);
export const pinnedFiles = [
  ...new Set(pinned.map((row) => `${row.repo}/${row.path}`)),
];
