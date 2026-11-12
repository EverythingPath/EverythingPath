import { readFileSync } from 'node:fs';
import { z } from 'zod';
import {
  importedCatalogEntrySchema,
  importedSpellDetailSchema,
} from '../../../src/lib/catalog/imported-entry-schema';
import {
  assessmentHistorySchema,
  launchReassessmentSchema,
  launchReviewSchema,
} from '../../catalog/launch-reassessment';
import inventory from '../../../scripts/catalog/legal/spells-516-evidence.json';

function snapshot(name: string): unknown {
  return JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
}
const strings = z.array(z.string());

// The batch inventory as its tests read it. #516 whole-content wave 3
// (2026-11-04) re-assessed 38 launch rows in place: those rows carry a
// launchReview, their earlier assessment in assessmentHistory and a binding,
// and a confirmed row's missingEvidence moved into its history.
export const review = z
  .object({
    ticket: z.literal(516),
    launchReassessment: launchReassessmentSchema,
    candidates: z.array(
      z.object({
        externalKey: z.string(),
        name: z.string(),
        disposition: z.enum(['held', 'admitted', 'dependently-omitted']),
        assessmentStatus: z.enum(['unresolved', 'confirmed']),
        source: z.object({
          path: z.string(),
          sha256: z.string(),
          location: z.string(),
        }),
        descriptionSha256: z.string(),
        citedSources: z.array(z.object({ id: z.string(), pages: z.string() })),
        requiredNotices: strings,
        noticeRequirementsComplete: z.boolean(),
        evidenceId: z.string(),
        holdIds: strings,
        noticeHoldIds: strings,
        missingEvidence: z.string().optional(),
        comparison: z
          .object({ completeDirectComparison: z.boolean() })
          .nullable(),
        linkedKeys: strings,
        learnedAt: z.record(z.string(), z.record(z.string(), z.number())),
        inheritedRuleNotices: z
          .array(z.object({ book: z.string(), rule: z.string() }))
          .optional(),
        rationale: z.string().optional(),
        assessmentHistory: assessmentHistorySchema.optional(),
        launchReview: launchReviewSchema.optional(),
        binding: z
          .object({
            contentFingerprint: z.string(),
            mappingFingerprint: z.string(),
            evidenceFingerprint: z.string(),
            noticeFingerprints: z.record(z.string(), z.string()),
          })
          .optional(),
      }),
    ),
  })
  .parse(inventory);

// Full-corpus entries of the six link-bearing launch roots and of the spells
// their bodies reach. The bounded fixture lacks those spells, so the importer
// strips the links from the roots; the wave binds each root on its
// full-preview closure, which this context replays.
export const linkedContext = z
  .object({
    rootKeys: strings,
    entries: z.array(
      importedCatalogEntrySchema.extend({ detail: importedSpellDetailSchema }),
    ),
  })
  .parse(snapshot('linked-context.json'));
