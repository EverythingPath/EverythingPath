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
  publicationTitle: z.string(),
  appliesToRootBody: z.boolean(),
  completeDirectComparison: z.boolean(),
  evidenceRole: z.string(),
  role: z.string(),
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
  repo: z.literal('pf1-content'),
  path: z.string(),
  sha256: z.string(),
});
const scores = z.object({
  str: z.number(),
  dex: z.number(),
  con: z.number(),
  int: z.number(),
  wis: z.number(),
  cha: z.number(),
});
// One compared statistic: the pinned value, PCGen's and whether they agree
// (null: not compared, with the reason in `note`).
const check = z.object({
  field: z.enum([
    'startingAbilityScores',
    'size',
    'speed',
    'naturalArmor',
    'advancementLevel',
    'advancementSizeSteps',
    'advancementAbilityAdjustments',
  ]),
  pinned: z.unknown(),
  pcgen: z.unknown(),
  agrees: z.boolean().nullable(),
  note: z.string().optional(),
  residualForSizeChange: z.record(z.string(), z.number()).optional(),
});
const statBlockSection = z.record(
  z.string(),
  z.union([z.string(), z.array(z.string())]),
);
const companionReview = z.object({
  creature: z.string(),
  statisticsField: z.enum(['details.notes', 'details.biography']),
  structured: z.object({
    abilities: scores,
    size: z.string(),
    naturalAC: z.union([z.number(), z.string()]).nullable().optional(),
    speed: z.record(z.string(), z.number().nullable()),
    senses: z.record(z.string(), z.unknown()),
  }),
  statBlock: z.object({
    base: statBlockSection,
    advancement: statBlockSection,
    advancementLevel: z.number(),
  }),
  statBlockSha256: z.string(),
  statBlockMatchesStructuredScores: z.boolean(),
  attacks: z.array(
    z.object({
      item: z.string(),
      itemId: z.string(),
      subType: z.string().nullable(),
      attackBonus: z.string().nullable(),
    }),
  ),
  unchainedActions: z.array(
    z.object({
      item: z.string(),
      itemId: z.string(),
      actionId: z.string(),
      unchained: z.record(z.string(), z.unknown()),
    }),
  ),
  embeddedTypeClasses: strings,
  embeddedCopies: z.array(
    z.object({
      name: z.string(),
      type: z.enum(['class', 'feat']),
      copies: z.string(),
      sameDescription: z.boolean(),
      descriptionDifference: z.string().nullable(),
      sameMechanics: z.boolean(),
      // The holds #507 records on the copied record (none when admitted).
      heldIn507: strings,
    }),
  ),
  pcgen: z.array(
    z.object({
      version: z.string(),
      book: z.string(),
      page: z.string().nullable(),
      race: z.object({ path: z.string(), line: z.number() }),
      checks: z.array(check),
      chosen: z.boolean(),
    }),
  ),
  versionDecision: z.string().nullable(),
  representativeSpecies: z.string().nullable(),
});
const candidate = z.object({
  externalKey: z.string(),
  name: z.string(),
  kind: z.literal('companion'),
  companionRecord: z.literal('animalCompanion'),
  disposition: z.literal('held'),
  assessmentStatus: z.literal('unresolved'),
  rawType: z.literal('character'),
  source,
  descriptionSha256: z.string(),
  citedSources: z.array(z.object({ book: z.string(), pages: z.string() })),
  requiredNotices: strings,
  noticeRequirementsComplete: z.literal(true),
  evidenceId: z.string(),
  holdIds: strings,
  noticeHoldIds: strings,
  missingEvidence: z.string().nullable(),
  sourceFields: z.record(z.string(), z.unknown()),
  comparison: comparison.nullable(),
  additionalComparisonLeads: z.array(comparison),
  rejectedRootComparisonEvidence: z.array(comparison),
  inheritedRuleNotices: z.array(
    z.object({ book: z.string(), rule: z.string(), location: z.string() }),
  ),
  inheritedRuleSourceEvidence: z.array(linked),
  inheritedRuleUnresolvedOrigins: strings,
  linkedContentReview: z.array(linked),
  rationale: z.string(),
  currentBinding: binding,
  history: z
    .array(
      z.object({
        issue: z.literal(763),
        previousBinding: binding,
        previousDescriptionJudgment: z.literal(
          '#/descriptionReviewHistory/0/previousDescriptionJudgment',
        ),
      }),
    )
    .optional(),
  mechanicsReview: z.object({
    reviewedBy: z.string(),
    reviewedOn: z.string(),
    descriptionReview: z.literal('#/descriptionReview').optional(),
    descriptionText: z.string(),
    curationRecords: curationSchema.shape.records,
    companionReview,
    outstandingCalculations: strings,
    proseOnlyRules: z.string(),
    sourceDiscrepancies: strings,
  }),
});
export const review = z
  .object({
    reviewedBy: z.string(),
    reviewedOn: z.string(),
    descriptionReview: z.object({
      reviewedBy: z.string(),
      reviewedOn: z.string(),
      reviewedCommit: z.string(),
      reportSha256: z.string(),
      taskId: z.string(),
      runId: z.string(),
      scope: strings,
      attribution: z.string(),
    }),
    descriptionReviewHistory: z
      .array(
        z.object({
          baseCommit: z.literal('b33b9390a90131a66ffb77d3e97dfcfa4ff2d3d9'),
          curationFile: z.literal('scripts/catalog/reviewed-curation.json'),
          previousDescriptionJudgment: z.object({
            kind: z.literal('description'),
            target: z.literal('description'),
            text: z.literal(''),
            textSha256: z.literal(
              'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            ),
            status: z.literal('checked'),
            outputs: z.array(z.never()),
            diagnostics: z.array(z.never()),
            reviewedBy: z.literal('Opus (AI curator) for the owner'),
            reviewedOn: z.literal('2026-10-21'),
            seedBindings: z.array(z.never()),
          }),
        }),
      )
      .length(1),
    counts: z.record(z.string(), z.number()),
    comparisonSources: z.object({
      pcgenFiles: z.array(source.omit({ repo: true })),
      bookCodes: z.object({
        repo: z.literal('pf1'),
        path: z.string(),
        sha256: z.string(),
      }),
    }),
    noticeRequirements: z.array(
      z.object({
        book: z.string(),
        registryKeys: strings,
        holdId: z.string().nullable(),
        candidates: strings,
      }),
    ),
    // The records the embedded Animal Companion Feats copy links, which a
    // clean tree needs to reproduce the resources' embedded descriptions.
    embeddedLinkedRecords: z.array(
      linked.extend({ repo: z.enum(['pf1', 'pf1-content']) }),
    ),
    candidates: z.array(candidate),
  })
  .parse(snapshot('../../../scripts/catalog/legal/pf-companions-508.json'));
/**
 * The batch's 100 resources as the full-corpus preview imported them
 * (`entries`). Their content closures are the resources alone: an actor's
 * detail has no references and its embedded items' links are retained
 * game content, not catalog references, so `closure` is empty.
 */
export const preview = z
  .object({
    entries: z.array(importedCatalogEntrySchema),
    closure: z.array(importedCatalogEntrySchema),
  })
  .parse(snapshot('preview.json'));

// The batch's records, the #507 records their embedded items copy and the
// records the embedded feat list links, checked against their recorded
// digests, from the shared store.
const pinned = [
  ...review.candidates.map((row) => row.source),
  ...review.candidates.flatMap((row) => row.inheritedRuleSourceEvidence),
  ...review.embeddedLinkedRecords,
];
export const pinnedSha256 = Object.fromEntries(
  pinned.map((row) => [`${row.repo}/${row.path}`, row.sha256]),
);
export const pinnedFiles = [
  ...new Set(pinned.map((row) => `${row.repo}/${row.path}`)),
];
