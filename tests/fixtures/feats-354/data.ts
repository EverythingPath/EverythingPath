import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { importedCatalogEntrySchema } from '../../../src/lib/catalog/imported-entry-schema';

function snapshot(name: string): unknown {
  return JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
}
const strings = z.array(z.string());
const sourceSchema = z.object({ path: z.string(), sha256: z.string() });
const rawField = z.object({
  present: z.boolean(),
  value: z.unknown().optional(),
});
const sourceIdentity = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  subType: rawField,
  associations: rawField,
  tags: rawField,
  description: rawField,
  sources: rawField,
  source: rawField,
  version: z.object({ tag: z.string(), commit: z.string() }),
});
const supportingSource = z.object({
  name: z.string(),
  externalKey: z.string(),
  repo: z.string(),
  path: z.string(),
  fixturePath: z.string(),
  sha256: z.string(),
  descriptionSha256: z.string(),
  description: z.string(),
  rawSystem: z.record(z.string(), z.unknown()).optional(),
  metadataAudit: z
    .object({
      learnedAt: rawField,
      learnedAtClass: rawField,
      actions: rawField,
      duration: rawField,
      changes: rawField,
      contextNotes: rawField,
      associations: rawField,
    })
    .optional(),
  sourceFields: z.unknown(),
  books: strings,
  bodyRole: z.enum([
    'complete-governing-body',
    'partial-governing-body',
    'partial-class-context',
    'partial-item-summary',
    'partial-summary',
    'comparison-only',
    'rejected-lead',
    'missing-body',
  ]),
  role: z.string(),
  completePinnedRecordBody: z.boolean(),
  completeGoverningBody: z.boolean(),
  sourceIdentity,
  relationshipAudit: z.object({
    sourceIdentityVerified: z.literal(true),
    bodyRole: z.string(),
    actualKind: z.string(),
    actualSubType: rawField,
    actualOwnerAssociations: rawField,
    pinnedVersion: z.object({ tag: z.string(), commit: z.string() }),
    literalBenefitWitness: z.string().nullable(),
    witnessLocation: z.string(),
    relationshipBasis: z.string(),
    noticesBoundary: z.string(),
    notesInstalled: z.literal(0),
  }),
  relationship: z.object({
    root: z.string(),
    rule: z.string(),
    scope: z.string(),
    reason: z.string(),
  }),
});
const comparisonSchema = z.object({
  path: z.string(),
  line: z.number(),
  literalRow: z.string(),
  comparisonLineSha256: z.string(),
  comparisonFileSha256: z.string(),
  completeDirectComparison: z.boolean(),
  appliesToRootBody: z.boolean().optional(),
  evidenceRole: z.string().optional(),
  role: z.string().optional(),
  remainingBoundary: z.string().optional(),
});
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
  currentBinding: z.object({
    contentFingerprint: z.string(),
    mappingFingerprint: z.string(),
    evidenceFingerprints: z.record(z.string(), z.string()),
    noticeFingerprints: z.record(z.string(), z.string()),
  }),
  noticeHoldIds: strings,
  comparison: comparisonSchema.nullable(),
  additionalComparisonLeads: z.array(comparisonSchema),
  inheritedRuleUnresolvedOrigins: z
    .array(
      z.object({
        rule: z.string(),
        holdId: z.string(),
        reason: z.string(),
      }),
    )
    .optional(),
  inheritedRuleNotices: z.array(z.object({ book: z.string() })),
  inheritedRuleSourceEvidence: z.array(supportingSource).default([]),
  auditOnlySourceEvidence: z.array(supportingSource),
  missingGoverningRules: z
    .array(
      z.object({
        rule: z.string(),
        reason: z.string(),
        holdId: z.string(),
        role: z.literal('missing-governing-body'),
        comparisonBoundary: z.string(),
      }),
    )
    .default([]),
  sourceIdentityAudit: z.object({
    sourceIdentity,
    rootKind: z.literal('feat'),
    resolvedPrerequisites: z.array(
      z.object({
        externalKey: z.string(),
        expectedKind: z.string(),
        observedKind: z.string(),
        sourceIdentity,
      }),
    ),
    uncheckedPrerequisites: z.array(z.unknown()),
  }),
  inheritedRuleComparisonEvidence: z
    .array(
      z.object({
        fixturePath: z.string(),
        sha256: z.string(),
        description: z.string().optional(),
      }),
    )
    .default([]),
  mechanicsReview: z.object({
    descriptionText: z.string(),
    rawMechanics: z.object({
      changes: z.array(z.object({ formula: z.string() })),
    }),
    mappedFacts: z.object({
      sources: z.array(z.unknown()),
      modifiers: z.array(z.unknown()),
      prerequisites: z.array(z.unknown()),
      proficiencies: z.array(z.unknown()),
    }),
    curationRecords: z.array(z.unknown()),
    outstandingCalculations: strings,
    proficiencyReview: z.object({ outstandingFacts: strings }),
    prerequisiteReview: z.object({
      authoredText: z.string(),
      normalizedAtoms: z.array(z.unknown()),
      review: z.string(),
      outstandingFacts: strings,
      publishedClauses: z.array(
        z.object({
          text: z.string(),
          sourceLocation: z.string(),
          sourceSha256: z.string(),
          descriptionSha256: z.string(),
        }),
      ),
      uncheckedAtoms: strings,
      parserAudit: z.object({
        reviewedBy: z.string(),
        reviewedOn: z.string(),
        publishedClauseCount: z.number(),
        comparedAllPublishedClauses: z.literal(true),
        normalizedAtomsSha256: z.string(),
        status: z.enum([
          'misparsed',
          'partially-modeled',
          'fully-modeled-clause',
          'no-published-prerequisites',
        ]),
        logicalReview: z.string(),
        findings: z.array(
          z.object({
            id: z.string(),
            kind: z.enum([
              'false-conjunction',
              'lost-negation',
              'split-token',
              'lost-shared-qualifier',
              'wrong-choice-selector',
              'wrong-rule-identity',
            ]),
            publishedFragment: z.string(),
            affectedAtomPaths: strings,
            explanation: z.string(),
            sourceLocation: z.string(),
          }),
        ),
        protectedRoot: z.boolean(),
        diagnosticLocation: z.string(),
        boundary: z.string(),
      }),
    }),
  }),
});
export const review = z
  .object({
    candidates: z.array(candidateSchema),
    counts: z.record(z.string(), z.number()),
    correctionReview: z.object({
      rootClausesReviewed: z.literal(100),
      misparsedRoots: z.literal(15),
      partialRoots: z.literal(37),
      fullyModeledClauseRoots: z.literal(39),
      noPublishedPrerequisiteRoots: z.literal(9),
      supportingOccurrencesReviewed: z.literal(209),
      supportingBodyRoles: z.record(z.string(), z.number()),
      auditOnlyBodyRoles: z.record(z.string(), z.number()),
    }),
    noticeRequirements: z.array(
      z.object({
        book: z.string(),
        registryKeys: strings,
        holdId: z.string().nullable(),
      }),
    ),
    comparisonSources: z.object({ pcgenFiles: z.array(sourceSchema) }),
  })
  .parse(snapshot('../../../scripts/catalog/legal/feats-354.json'));
export const preview = z
  .object({
    entries: z.array(importedCatalogEntrySchema),
    remaps: z.array(z.unknown()),
    comparison: z.object({
      records: z.array(z.unknown()),
      packs: z.array(z.unknown()),
    }),
  })
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
    fixtures: z.array(identity),
    inventories: z.array(identity),
    rawFiles: z.record(
      z.string(),
      z.object({ path: z.string(), sha256: z.string() }),
    ),
    assessments: z.array(identity),
    evidence: z.array(identity),
    holds: z.array(identity),
    overlay: z.array(identity),
    situations: z.array(identity),
    registry: z.array(identity),
  })
  .parse(snapshot('original-identities.json'));
