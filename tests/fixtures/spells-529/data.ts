import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { importedCatalogEntrySchema } from '../../../src/lib/catalog/imported-entry-schema';
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
            evidence: z.string(),
            evidenceSha256: z.string(),
            sourceLocation: z.string(),
            sourceDescriptionSha256: z.string(),
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
  .parse(snapshot('../../../scripts/catalog/legal/spells-529.json'));
export const spells = review.candidates;
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
export const preserved = z
  .object({
    keys: strings,
    priorCurationIdentities: z.array(
      z.object({
        externalKey: z.string(),
        kind: z.string(),
        target: z.string(),
        textSha256: z.string(),
      }),
    ),
    priorAssessmentIdentities: strings,
    rawCommitments: z.array(
      z.object({
        file: z.string(),
        collection: z.string(),
        identity: z.string(),
        fingerprint: z.string(),
      }),
    ),
    runtimeCommitments: z.array(
      z.object({
        collection: z.string(),
        identity: z.string(),
        fingerprint: z.string(),
      }),
    ),
    historicalFixtures: z.record(z.string(), z.string()),
    unchangedFiles: z.record(z.string(), z.string()),
  })
  .parse(snapshot('preserved.json'));
