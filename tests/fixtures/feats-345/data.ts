import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { importedCatalogEntrySchema } from '../../../src/lib/catalog/imported-entry-schema';

function snapshot(name: string): unknown {
  return JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
}
const strings = z.array(z.string());
const sourceSchema = z.object({ path: z.string(), sha256: z.string() });
const candidateSchema = z.object({
  externalKey: z.string(),
  name: z.string(),
  disposition: z.enum(['held', 'admitted']),
  source: sourceSchema,
  descriptionSha256: z.string(),
  requiredNotices: strings,
  holdIds: strings,
  noticeRequirementsComplete: z.boolean(),
  evidenceId: z.string(),
  comparison: z.object({ completeDirectComparison: z.boolean() }).nullable(),
  inheritedRuleNotices: z.array(z.object({ book: z.string() })),
  inheritedRuleSourceEvidence: z.array(
    z.object({ fixturePath: z.string(), sha256: z.string() }),
  ),
  inheritedRuleComparisonEvidence: z.array(
    z.object({ fixturePath: z.string(), sha256: z.string() }),
  ),
  mechanicsReview: z.object({
    descriptionText: z.string(),
    mappedFacts: z.object({
      sources: z.array(z.unknown()),
      modifiers: z.array(z.unknown()),
      prerequisites: z.array(z.unknown()),
      proficiencies: z.array(z.unknown()),
    }),
    curationRecords: z.array(z.unknown()),
    outstandingCalculations: strings,
    proficiencyReview: z.object({ outstandingFacts: strings }),
  }),
});
export const review = z
  .object({
    candidates: z.array(candidateSchema),
    counts: z.record(z.string(), z.number()),
    noticeRequirements: z.array(
      z.object({
        book: z.string(),
        registryKeys: strings,
        holdId: z.string().nullable(),
      }),
    ),
    comparisonSources: z.object({ pcgenFiles: z.array(sourceSchema) }),
  })
  .parse(snapshot('../../../scripts/catalog/legal/feats-345.json'));
export const preview = z
  .object({ entries: z.array(importedCatalogEntrySchema) })
  .parse(snapshot('preview.json'));
export const provenance = z
  .object({
    candidateKeysSha256: z.string(),
    candidates: z.array(z.object({ externalKey: z.string() })),
  })
  .parse(snapshot('provenance.json'));
const identity = z.object({ identity: z.string(), sha256: z.string() });
export const originals = z
  .object({
    assessments: z.array(identity),
    evidence: z.array(identity),
    holds: z.array(identity),
    overlay: z.array(identity),
    situations: z.array(identity),
    registrySha256: z.string(),
    registryBaseline: z.literal('035b1187c6ff1e330870799a01299007f67f9d07'),
    registry: z.array(identity),
  })
  .parse(snapshot('original-identities.json'));
