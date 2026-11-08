import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { importedCatalogEntrySchema } from '../../../src/lib/catalog/imported-entry-schema';

function snapshot(name: string): unknown {
  return JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
}
const strings = z.array(z.string());
const source = z.object({ path: z.string(), sha256: z.string() });
const comparison = z.object({
  line: z.number(),
  text: z.string(),
  lineSha256: z.string(),
  baseLine: z.number(),
  baseText: z.string(),
  baseLineSha256: z.string(),
  description: z.string(),
  descriptionMatchesAfterPresentationNormalization: z.boolean(),
});
export const review = z
  .object({
    candidates: z.array(
      z.object({
        externalKey: z.string(),
        name: z.string(),
        kind: z.literal('spell'),
        disposition: z.literal('held'),
        source,
        descriptionSha256: z.string(),
        citedSources: z.array(z.unknown()),
        learnedAt: z.record(z.string(), z.unknown()),
        requiredNotices: strings,
        noticeRequirementsComplete: z.boolean(),
        evidenceId: z.string(),
        holdIds: strings,
        noticeHoldIds: strings,
        inheritedRuleNotices: z.array(z.object({ book: z.string() })),
        inheritedNoticeReview: z.array(
          z.object({
            book: z.string(),
            evidence: z.string(),
            evidenceSha256: z.string(),
            sourceLocation: z.string(),
            sourceDescriptionSha256: z.string(),
            sourceFileSha256: z.string().optional(),
            sourceLine: z.number().optional(),
            sourceEndLine: z.number().optional(),
            sourceLineText: z.string().optional(),
            sourceLineSha256: z.string().optional(),
            comparisonEvidence: z
              .array(
                z.object({
                  source: z.string(),
                  line: z.number(),
                  textSha256: z.string(),
                  fileSha256: z.string(),
                  rule: z.string(),
                }),
              )
              .optional(),
          }),
        ),
        fullContentReview: z.object({
          descriptionText: z.string(),
          directComparison: comparison.nullable(),
          linkedContentReview: z.array(
            z.object({
              externalKey: z.string(),
              name: z.string(),
              descriptionText: z.string(),
            }),
          ),
          unresolvedOrigins: strings,
        }),
        mechanicsReview: z.object({
          metadata: z.record(z.string(), z.unknown()),
          descriptionRecord: z.object({
            unresolved: strings,
            outputCount: z.number(),
          }),
          outstanding: strings,
          discrepancies: strings,
          sharedSituations: strings,
          localSituations: strings,
        }),
      }),
    ),
    summary: z.record(z.string(), z.number()),
    mechanicsSummary: z.record(z.string(), z.number()),
    noticeRequirements: z.array(
      z.object({
        book: z.string(),
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
    inheritedRuleIdentityEvidence: z.object({
      pcgenRows: z.array(
        z.object({
          source: z.string(),
          line: z.number(),
          text: z.string(),
          textSha256: z.string(),
          fileSha256: z.string(),
        }),
      ),
    }),
  })
  .parse(snapshot('../../../scripts/catalog/legal/spells-527.json'));
const previewSchema = z.object({
  entries: z.array(importedCatalogEntrySchema),
  resources: z.array(importedCatalogEntrySchema),
  remaps: z.array(z.unknown()),
  admissionCounts: z.record(z.string(), z.number()),
});
export const preview = previewSchema.parse(snapshot('preview.json'));
export const bindingPreview = previewSchema.parse(
  snapshot('binding-preview.json'),
);
const rawSource = source.extend({ externalKey: z.string() });
export const provenance = z
  .object({
    orderedTicketKeysSha256: z.string(),
    rawSources: z.array(rawSource),
    dependencies: z.array(rawSource),
    namedRuleContext: z.array(rawSource),
    manifests: z.array(source.extend({ repo: z.enum(['pf1', 'pf1-content']) })),
    comparisonFiles: z.array(source),
  })
  .parse(snapshot('provenance.json'));
