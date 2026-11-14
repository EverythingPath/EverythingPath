import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { importedCatalogEntrySchema } from '../../../src/lib/catalog/imported-entry-schema';

// Read bounded snapshots through schemas so every distinct JSON row does not
// become a separate TypeScript type in the lint server.
function snapshot(name: string): unknown {
  return JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
}
const strings = z.array(z.string());
const sourceSchema = z.object({ path: z.string(), sha256: z.string() });
const candidateSchema = z.object({
  externalKey: z.string(),
  name: z.string(),
  disposition: z.literal('held'),
  source: sourceSchema,
  descriptionSha256: z.string(),
  requiredNotices: strings,
  holdIds: strings,
  noticeRequirementsComplete: z.boolean(),
  evidenceId: z.string(),
  inheritedRuleNotices: z.array(z.object({ book: z.string() })),
  inheritedRuleSourceEvidence: z.array(
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
  .parse(snapshot('../../../scripts/catalog/legal/feats-344.json'));
export const preview = z
  .object({ entries: z.array(importedCatalogEntrySchema) })
  .parse(snapshot('preview.json'));
export const provenance = z
  .object({
    candidateKeysSha256: z.string(),
    candidates: z.array(z.object({ externalKey: z.string() })),
  })
  .parse(snapshot('provenance.json'));
