import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { importedCatalogEntrySchema } from '../../../src/lib/catalog/imported-entry-schema';
import { outputSchema } from '../../../src/lib/catalog/curation-output-schema';
export function snapshot(path: string): unknown {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
}
const strings = z.array(z.string());
const source = z.object({ path: z.string(), sha256: z.string() });
const body = z.object({
  externalKey: z.string(),
  name: z.string(),
  descriptionText: z.string(),
  descriptionSha256: z.string(),
  fixturePath: z.string(),
  source,
  sources: z.array(z.object({ id: z.string().optional() })),
  noteCount: z.number(),
  bodyRole: z.string(),
  completeGoverningBody: z.boolean(),
  relationship: z.object({ kind: z.string(), reason: z.string() }),
  application: z.string(),
});
export const review = z
  .object({
    ticket: z.literal(534),
    reviewedBy: z.string(),
    reviewedOn: z.string(),
    summary: z.record(z.string(), z.number()),
    mechanicsSummary: z.record(z.string(), z.number()),
    noticeRequirements: z.array(
      z.object({
        book: z.string(),
        title: z.string(),
        registryKeys: strings,
        holdId: z.string().nullable(),
        registryIdentityEvidence: z.array(
          z.object({ key: z.string(), textSha256: z.string() }),
        ),
      }),
    ),
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
        evidenceId: z.string(),
        holdIds: strings,
        noticeHoldIds: strings,
        binding: z.object({
          contentFingerprint: z.string(),
          mappingFingerprint: z.string(),
          evidenceFingerprint: z.string(),
          noticeFingerprints: z.record(z.string(), z.string()),
        }),
        inheritedNoticeReview: z.array(
          z.object({
            book: z.string(),
            role: z.string(),
            externalKey: z.string(),
            evidence: z.string(),
            evidenceSha256: z.string(),
            sourceLocation: z.string(),
            sourceDescriptionSha256: z.string(),
            sourceFileSha256: z.string(),
          }),
        ),
        noticeMinimumAudit: z.object({
          coreBodyTerms: z.array(
            z.object({ term: z.string(), start: z.number(), end: z.number() }),
          ),
        }),
        fullContentReview: z.object({
          descriptionText: z.string(),
          completeRawSystem: z.record(z.string(), z.unknown()),
          directComparison: z
            .object({
              source: z.string(),
              fileSha256: z.string(),
              line: z.number(),
              text: z.string(),
              lineSha256: z.string(),
              fullDescription: z
                .object({
                  line: z.number(),
                  text: z.string(),
                  lineSha256: z.string(),
                  normalizedEqual: z.boolean(),
                })
                .nullable(),
            })
            .nullable(),
        }),
        descriptorReview: z.object({
          published: strings,
          imported: strings,
          lost: strings,
        }),
        mechanicsReview: z.object({
          metadata: z.record(z.string(), z.unknown()),
          manualRule: z.string(),
          reviewedOptionalOutputs: z.array(outputSchema),
          descriptionRecord: z.object({
            outputCount: z.number(),
            unresolved: strings,
            status: z.literal('checked'),
          }),
          ownNoteCount: z.number(),
          governingNoteCount: z.number(),
          protectedHistoricalContext: z.boolean(),
          governingSpellBodies: z.array(
            body.extend({
              prefix: z.string(),
              limits: z.string(),
              rootEvidence: z.string(),
              rootEvidenceStart: z.number(),
              rootEvidenceEnd: z.number(),
              noteText: z.string(),
            }),
          ),
          auditOnlySpellBodies: z.array(body),
          missingSupportingBodies: z.array(
            z.object({
              name: z.string(),
              bodyRole: z.string(),
              completeGoverningBody: z.literal(false),
              application: z.literal('unexpanded-no-output'),
              fixturePath: z.null(),
              relationship: z.object({ kind: z.string(), reason: z.string() }),
            }),
          ),
          outstanding: strings,
          discrepancies: strings,
          sharedSituations: strings,
        }),
      }),
    ),
  })
  .parse(snapshot('../../../scripts/catalog/legal/spells-534.json'));
export const spells = review.candidates;
const catalog = z.object({
  entries: z.array(importedCatalogEntrySchema),
  resources: z.array(importedCatalogEntrySchema),
  remaps: z.array(z.unknown()),
  candidateKeys: strings,
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
        repo: z.enum(['pf1', 'pf1-content']),
        externalKey: z.string(),
        tag: z.string(),
      }),
    ),
    manifests: z.array(source.extend({ repo: z.enum(['pf1', 'pf1-content']) })),
    comparisonFiles: z.array(source),
    bibliography: source,
    emptyDirectories: strings,
  })
  .parse(snapshot('provenance.json'));
// `preserved.json`, the whole-history manifest, stays on disk until the #744
// cleanup; no check reads it (#749), so this module no longer parses it.
