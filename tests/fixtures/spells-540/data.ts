import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { curationSchema } from '../../../scripts/catalog/curation';
import {
  importedCatalogEntrySchema,
  importedSpellDetailSchema,
} from '../../../src/lib/catalog/imported-entry-schema';

function snapshot(name: string): unknown {
  return JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
}
const strings = z.array(z.string());
const sources = z.array(
  z.object({ id: z.string(), pages: z.union([z.string(), z.number()]) }),
);
// Cited sources keep every pinned field (a blog citation has no id).
const citedSources = z.array(
  z.record(z.string(), z.union([z.string(), z.number()])),
);
const citation = z.object({
  name: z.string(),
  repo: z.enum(['pf1', 'pf1-content']),
  path: z.string(),
  sha256: z.string(),
  line: z.number(),
  literalQuote: z.string(),
  book: z.string(),
});
const pinnedBody = z.object({
  name: z.string(),
  externalKey: z.string(),
  repo: z.literal('pf1'),
  path: z.string(),
  sha256: z.string(),
  sources,
  descriptionSha256: z.string(),
  role: z.string(),
});
const comparison = z.object({
  path: z.string(),
  line: z.number(),
  literalRow: z.string(),
  comparisonLineSha256: z.string(),
  comparisonFileSha256: z.string(),
  publicationAnchor: z.object({
    path: z.string(),
    line: z.number(),
    text: z.string(),
  }),
  book: z.string().nullable(),
  sourcePage: z.string(),
  pageMatchesCitation: z.boolean().nullable(),
  descriptionComparison: z.string(),
  appliesToRootBody: z.boolean(),
  evidenceRole: z.string(),
});
// A PCGen Bestiary race row that names a depended-on creature's publication.
const bestiaryRow = z.object({
  name: z.string(),
  path: z.string(),
  line: z.number(),
  literalRow: z.string(),
  comparisonLineSha256: z.string(),
  comparisonFileSha256: z.string(),
  publicationAnchor: z.object({
    path: z.string(),
    line: z.number(),
    text: z.string(),
  }),
  book: z.string(),
  sourcePage: z.string(),
});
export const review = z
  .object({
    ticket: z.literal(540),
    reviewedBy: z.string(),
    reviewedOn: z.string(),
    counts: z.record(z.string(), z.number()),
    mechanicsSummary: z.record(z.string(), z.number()),
    comparisonSources: z.object({
      pcgenCommit: z.string(),
      pcgenFiles: z.array(z.object({ path: z.string(), sha256: z.string() })),
    }),
    noticeRequirements: z.array(
      z.object({
        book: z.string(),
        title: z.string(),
        registryKeys: strings,
        holdId: z.string().nullable(),
        candidates: z.number(),
      }),
    ),
    importContext: z.object({
      classRecords: z.array(
        z.object({
          tag: z.string(),
          externalKey: z.string(),
          path: z.string(),
          sha256: z.string(),
        }),
      ),
    }),
    referenceImportGaps: z.array(
      z.object({ externalKey: z.string(), field: z.string() }),
    ),
    metadataImportGaps: z.array(
      z.object({
        externalKey: z.string(),
        field: z.literal('descriptors'),
        published: strings,
        imported: strings,
      }),
    ),
    candidates: z.array(
      z.object({
        externalKey: z.string(),
        name: z.string(),
        kind: z.literal('spell'),
        disposition: z.literal('held'),
        assessmentStatus: z.literal('unresolved'),
        source: z.object({
          repo: z.literal('pf1'),
          path: z.string(),
          sha256: z.string(),
        }),
        descriptionSha256: z.string(),
        citedSources,
        learnedAt: z.record(z.string(), z.record(z.string(), z.number())),
        requiredNotices: strings,
        evidenceId: z.string(),
        holdIds: strings,
        noticeHoldIds: strings,
        holdReason: z.string(),
        inheritedRuleNotices: z.array(
          z.object({ book: z.string(), rule: z.string() }),
        ),
        inheritedRuleSourceEvidence: z.array(pinnedBody),
        inheritedRuleCitations: z.array(citation),
        inheritedRuleComparisons: z.array(bestiaryRow),
        linkedContentReview: z.array(
          pinnedBody.partial({ repo: true, path: true, sha256: true }).extend({
            descriptionSha256: z.string().optional(),
          }),
        ),
        unverifiedOrigins: strings,
        comparison: comparison.nullable(),
        additionalComparisonLeads: z.array(comparison),
        mechanicsReview: z.object({
          curationRecords: curationSchema.shape.records,
          outstandingCalculations: strings,
          sharedSituations: strings,
          protectedHistoricalContext: z.boolean(),
          sourceDiscrepancies: strings,
        }),
        descriptorReview: z.object({
          published: strings,
          imported: strings,
          lost: strings,
        }),
        currentBinding: z.object({
          contentFingerprint: z.string(),
          mappingFingerprint: z.string(),
          evidenceFingerprints: z.record(z.string(), z.string()),
          noticeFingerprints: z.record(z.string(), z.string()),
        }),
      }),
    ),
  })
  .parse(snapshot('../../../scripts/catalog/legal/spells-540.json'));
// Citation files are read from the shared store; they are not imported.

// Bounded `catalog:preview --candidates` output from the complete pinned checkouts.
export const preview = z
  .object({
    entries: z.array(
      importedCatalogEntrySchema.extend({ detail: importedSpellDetailSchema }),
    ),
  })
  .parse(snapshot('preview.json'));

// The batch's roots, governing bodies and the class records the importer
// needs to map learnedAt tags, all from the shared store.
const pinned = [
  ...review.importContext.classRecords,
  ...review.candidates.flatMap((row) => [
    row.source,
    ...row.inheritedRuleSourceEvidence,
    ...row.linkedContentReview.flatMap((linked) =>
      linked.path && linked.sha256
        ? [{ path: linked.path, sha256: linked.sha256 }]
        : [],
    ),
  ]),
];
export const pinnedFiles = [
  ...new Set(pinned.map((source) => `pf1/${source.path}`)),
];
export const pinnedSha256 = Object.fromEntries(
  pinned.map((source) => [`pf1/${source.path}`, source.sha256]),
);
