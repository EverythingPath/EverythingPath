import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { importedCatalogEntrySchema } from '../../../src/lib/catalog/imported-entry-schema';
import { outputSchema } from '../../../src/lib/catalog/curation-output-schema';

export function snapshot(path: string): unknown {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
}
const strings = z.array(z.string());
const source = z.object({ path: z.string(), sha256: z.string() });
const relationship = z.object({ kind: z.string(), reason: z.string() });
const supportingBody = z.object({
  name: z.string(),
  externalKey: z.string(),
  repo: z.string(),
  path: z.string(),
  fixturePath: z.string(),
  sha256: z.string(),
  descriptionSha256: z.string(),
  descriptionText: z.string(),
  role: z.string(),
  completeGoverningBody: z.boolean(),
  ruleKind: z.string(),
  owningClassOrRace: z.string().nullable(),
  relationship,
  relationshipAudit: z.object({
    relationshipBasis: z.string(),
    path: z.array(z.object({ externalKey: z.string(), name: z.string() })),
  }),
});
const governingBody = z.object({
  externalKey: z.string(),
  name: z.string(),
  descriptionText: z.string(),
  descriptionSha256: z.string(),
  fixturePath: z.string(),
  source,
  noteCount: z.number(),
  bodyRole: z.string(),
  completeGoverningBody: z.boolean(),
  relationship,
  relationshipAudit: z.object({
    relationshipBasis: z.string(),
    path: z.array(z.object({ externalKey: z.string(), name: z.string() })),
  }),
  rootEvidence: z.string(),
  rootEvidenceStart: z.number(),
  rootEvidenceEnd: z.number(),
  rootEvidenceOwner: z.string(),
});
export const review = z
  .object({
    ticket: z.literal(535),
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
            evidence: z.string(),
            evidenceSha256: z.string(),
            sourceLocation: z.string(),
            sourceDescriptionSha256: z.string(),
            sourceFileSha256: z.string(),
            role: z.string(),
            externalKey: z.string(),
          }),
        ),
        inheritedRuleSourceEvidence: z.array(supportingBody),
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
        mechanicsReview: z.object({
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
          outstanding: strings,
          discrepancies: strings,
          sharedSituations: strings,
          localSituations: strings,
          governingSpellBodies: z.array(governingBody),
        }),
      }),
    ),
  })
  .parse(snapshot('../../../scripts/catalog/legal/spells-535.json'));
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
    comparisonFiles: z.array(source),
    emptyDirectories: strings,
  })
  .parse(snapshot('provenance.json'));
