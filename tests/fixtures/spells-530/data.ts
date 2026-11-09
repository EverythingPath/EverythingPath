import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { importedCatalogEntrySchema } from '../../../src/lib/catalog/imported-entry-schema';
import { outputSchema } from '../../../src/lib/catalog/curation-output-schema';
import {
  assessmentHistorySchema,
  launchReassessmentSchema,
  launchReviewSchema,
} from '../../catalog/launch-reassessment';
const strings = z.array(z.string());
export function snapshot(path: string): unknown {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
}
const source = z.object({ path: z.string(), sha256: z.string() });
const comparator = z.object({
  source: z.string(),
  line: z.number(),
  text: z.string(),
  textSha256: z.string(),
  fileSha256: z.string(),
  role: z.string(),
  publicationDeclaration: z
    .object({ line: z.number(), text: z.string(), textSha256: z.string() })
    .nullable(),
});
export const review = z
  .object({
    reviewedBy: z.string(),
    reviewedOn: z.string(),
    summary: z.record(z.string(), z.number()),
    mechanicsSummary: z.record(z.string(), z.number()),
    launchReassessment: launchReassessmentSchema,
    candidates: z.array(
      z.union([
        z.object({
          externalKey: z.string(),
          name: z.string(),
          kind: z.literal('spell'),
          // #516 whole-content wave 3 re-assessed Scrying in place.
          disposition: z.enum(['held', 'admitted']),
          assessmentStatus: z.enum(['unresolved', 'confirmed']),
          rationale: z.string().optional(),
          assessmentHistory: assessmentHistorySchema.optional(),
          launchReview: launchReviewSchema.optional(),
          source,
          descriptionSha256: z.string(),
          citedSources: z.array(z.unknown()),
          learnedAt: z.record(z.string(), z.unknown()),
          requiredNotices: strings,
          noticeRequirementsComplete: z.boolean(),
          evidenceId: z.string(),
          holdIds: strings,
          noticeHoldIds: strings,
          binding: z.object({
            contentFingerprint: z.string(),
            mappingFingerprint: z.string(),
            evidenceFingerprint: z.string(),
            noticeFingerprints: z.record(z.string(), z.string()),
          }),
          inheritedRuleNotices: z.array(z.object({ book: z.string() })),
          inheritedNoticeReview: z.array(
            z.object({
              book: z.string(),
              role: z.string(),
              scope: z.literal('referenced-body').optional(),
              externalKey: z.string().optional(),
              evidence: z.string(),
              evidenceSha256: z.string().optional(),
              sourceLocation: z.string(),
              sourceDescriptionSha256: z.string().optional(),
              sourceFileSha256: z.string(),
              comparisonEvidence: z.array(comparator),
            }),
          ),
          fullContentReview: z.object({
            descriptionText: z.string(),
            directComparison: z
              .object({
                source: z.string(),
                fileSha256: z.string(),
                line: z.number(),
                text: z.string(),
                lineSha256: z.string(),
                role: z.literal('same-spell-metadata'),
                fullDescription: z
                  .object({
                    line: z.number(),
                    text: z.string(),
                    lineSha256: z.string(),
                    role: z.literal('same-spell-body'),
                    normalizedEqual: z.boolean(),
                  })
                  .nullable(),
              })
              .nullable(),
            unresolvedOrigins: strings,
            linkedContentReview: z.array(
              z.object({
                externalKey: z.string(),
                name: z.string(),
                descriptionText: z.string(),
                source,
              }),
            ),
          }),
          mechanicsReview: z.object({
            protectedHistoricalContext: z.boolean(),
            reviewedOptionalOutputs: z.array(outputSchema),
            metadata: z.record(z.string(), z.unknown()),
            manualRule: z.string(),
            outstanding: strings,
            discrepancies: strings,
            sharedSituations: strings,
            localSituations: strings,
            descriptionRecord: z.object({
              outputCount: z.number(),
              unresolved: strings,
            }),
          }),
          descriptorReview: z.object({
            published: strings,
            imported: strings,
            lost: strings,
          }),
        }),
        z.object({
          externalKey: z.string(),
          name: z.string(),
          kind: z.literal('folder'),
          disposition: z.literal('excluded'),
          source,
          reason: z.string(),
        }),
      ]),
    ),
    noticeRequirements: z.array(
      z.object({
        book: z.string(),
        title: z.string(),
        registryKeys: strings,
        holdId: z.string().nullable(),
        registryIdentityEvidence: z.array(
          z.object({
            key: z.string(),
            textSha256: z.string(),
            provenance: strings,
          }),
        ),
      }),
    ),
    inheritedRuleIdentityEvidence: z.object({ pcgenRows: z.array(comparator) }),
  })
  .parse(snapshot('../../../scripts/catalog/legal/spells-530.json'));
export const spells = review.candidates.filter((row) => row.kind === 'spell');
const catalog = z.object({
  entries: z.array(importedCatalogEntrySchema),
  resources: z.array(importedCatalogEntrySchema),
  remaps: z.array(z.unknown()),
  admissionCounts: z.record(z.string(), z.number()),
});
export const preview = catalog.parse(snapshot('preview.json'));
export const bindingPreview = catalog.parse(snapshot('binding-preview.json'));
export const provenance = z
  .object({
    orderedTicketKeysSha256: z.string(),
    rawSources: z.array(source.extend({ externalKey: z.string() })),
    dependencies: z.array(source.extend({ externalKey: z.string() })),
    classContext: z.array(
      source.extend({
        externalKey: z.string(),
        repo: z.enum(['pf1', 'pf1-content']),
        tag: z.string(),
      }),
    ),
    manifests: z.array(source.extend({ repo: z.enum(['pf1', 'pf1-content']) })),
    comparisonFiles: z.array(source),
    bibliography: source,
  })
  .parse(snapshot('provenance.json'));
export const bibliography = z
  .object({
    source,
    quotes: z.array(
      z.object({
        line: z.number(),
        endLine: z.number(),
        text: z.string(),
        sha256: z.string(),
      }),
    ),
  })
  .parse(snapshot('bibliography.json'));
// `preserved.json`, the whole-history manifest, stays on disk until the #744
// cleanup; no check reads it (#749), so this module no longer parses it.
