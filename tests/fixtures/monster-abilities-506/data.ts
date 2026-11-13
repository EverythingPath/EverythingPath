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
// A Universal Monster Rules journal page: the pinned journal file and one of
// its pages, with the books the page cites.
const umrPage = z.object({
  repo: z.literal('pf1'),
  path: z.string(),
  sha256: z.string(),
  pageId: z.string(),
  pageName: z.string(),
  sources: z.array(z.object({ id: z.string(), pages: z.string() })),
});
const linked = z.object({
  externalKey: z.string(),
  name: z.string(),
  repo: z.literal('pf1'),
  path: z.string(),
  sha256: z.string(),
  sources: z.array(z.object({ id: z.string(), pages: z.string() })),
  assessment: z.enum(['confirmed', 'unresolved']).nullable(),
  fullPreviewAdmission: z.string(),
});
const statistic = z.object({
  field: z.string(),
  pinned: z.unknown(),
  mapped: z.unknown(),
  pcgen: z.unknown(),
  agrees: z.boolean(),
});
const assessed = z.object({
  externalKey: z.string(),
  name: z.string(),
  kind: z.literal('item'),
  itemKind: z.enum(['naturalAttack', 'swarmAttack', 'unarmedStrike']),
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
  inheritedRuleNotices: z.array(
    z.object({ book: z.string(), rule: z.string(), location: z.string() }),
  ),
  inheritedRuleSourceEvidence: z.array(umrPage),
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
    gearReview: z.object({
      itemKind: z.string(),
      statistics: z.array(statistic),
      statisticsAgree: z.boolean(),
      disagreements: strings,
    }),
    outstandingCalculations: strings,
    proseOnlyRules: z.string(),
    sourceDiscrepancies: strings,
  }),
});
const sourceDate = z.object({
  book: z.string(),
  path: z.string(),
  line: z.number(),
  text: z.string(),
  sha256: z.string(),
  date: z.string(),
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
const excludedAbility = z.object({
  externalKey: z.string(),
  name: z.string(),
  kind: z.literal('monsterAbility'),
  disposition: z.literal('excluded'),
  rawType: z.literal('feat'),
  rawKey: z.string(),
  source,
  descriptionSha256: z.string(),
  contractReason: z.string(),
  citedSources: z.array(book),
  universalMonsterRulesPage: umrPage.nullable(),
  earliestUniversalMonsterRulesBook: sourceDate,
  citedByEarlierBatches: strings,
  sourceDiscrepancies: strings,
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
    candidates: z.array(z.union([assessed, excludedFolder, excludedAbility])),
  })
  .parse(snapshot('../../../scripts/catalog/legal/monster-abilities-506.json'));
export const assessedAttacks = review.candidates.flatMap((row) =>
  row.disposition === 'excluded' ? [] : [row],
);
export const excludedFolders = review.candidates.flatMap((row) =>
  row.kind === 'folder' ? [row] : [],
);
export const excludedAbilities = review.candidates.flatMap((row) =>
  row.kind === 'monsterAbility' ? [row] : [],
);
// The full-corpus preview's entries for the batch's 13 attack items, and the
// entries in their content closures (none: their only links are to a journal
// page and an excluded record), which the assessments bind against.
export const preview = z
  .object({
    entries: z.array(importedCatalogEntrySchema),
    closure: z.array(importedCatalogEntrySchema),
  })
  .parse(snapshot('preview.json'));

// The batch's records and the journal and record they link (checked against
// their recorded digests), from the shared store.
const pinned = [
  ...review.candidates.map((row) => row.source),
  ...assessedAttacks.flatMap((row) => [
    ...row.linkedContentReview,
    ...row.inheritedRuleSourceEvidence,
  ]),
];
export const pinnedSha256 = Object.fromEntries(
  pinned.map((row) => [`${row.repo}/${row.path}`, row.sha256]),
);
export const pinnedFiles = [
  ...new Set(pinned.map((row) => `${row.repo}/${row.path}`)),
];
