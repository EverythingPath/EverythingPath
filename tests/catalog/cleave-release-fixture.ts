import { createHash } from 'node:crypto';
import type { ReleaseRow } from '../../src/lib/catalog/release-schema';

// #411: CRB p. 119 Cleave, as an in-memory import of one admitted record.
export function cleaveImport() {
  const entry = {
    externalKey: 'pf1/Cleave',
    upstreamKey: 'pf1/Cleave',
    pack: 'feats',
    name: 'Cleave',
    description: '<p>You can strike two adjacent foes with a single swing.</p>',
    detail: {
      kind: 'feat' as const,
      featTypes: ['combat'],
      repeatable: 'no' as const,
    },
    prerequisiteText: 'Str 13, Power Attack, base attack bonus +1.',
    sources: [{ book: 'CRB', pages: '119' }],
    modifiers: [],
    unsupported: [],
  };
  const summary = {
    upstreamRecords: 1,
    admitted: 1,
    excluded: 0,
    unassigned: 0,
    byKind: {},
  };
  const artifact = {
    curation: {
      passed: true,
      missing: [],
      applied: [],
      stale: [],
      unused: [],
      unresolvedMechanics: [],
      unresolvedDescriptions: [],
      summary: {
        required: 0,
        drafted: 0,
        checked: 0,
        missing: 0,
        descriptions: { candidates: 0, drafted: 0, checked: 0 },
      },
    },
    catalog: {
      purpose: 'preview' as const,
      releaseAdmission: 'not-evaluated' as const,
      remaps: [],
      inputs: [],
      summary,
      entries: [entry],
      resources: [],
    },
    unsupported: {
      purpose: 'preview' as const,
      summary: { entries: 0, issues: 0 },
      entries: [],
    },
    comparison: {
      coverageComplete: true,
      summary,
      packs: [],
      records: [
        {
          repo: 'pf1' as const,
          pack: 'feats',
          path: 'packs/feats/cleave.yaml',
          externalKey: entry.upstreamKey,
          name: entry.name,
          status: 'admitted' as const,
          reason: 'In scope',
        },
      ],
    },
  };
  return { entry, artifact };
}

/** Cleave on CRB: its import, release options and confirmed assessments (`assess`). */
export async function cleaveReleases() {
  const { createCatalogRelease } =
    await import('../../scripts/catalog/release');
  const { buildAssessmentBinding, computeFingerprint } =
    await import('../../scripts/catalog/admission');
  const { legalResources, section15Registry } =
    await import('../../src/lib/catalog/section15-registry-data');
  const { entry, artifact } = cleaveImport();
  const crb = section15Registry.CRB;
  if (!crb) throw new Error('Missing CRB notice');
  const registry = { CRB: crb };
  const assess = (
    evidence: Record<string, { content: string; revoked?: boolean }>,
    evidenceId: string,
  ) => ({
    evidence,
    registry,
    assessments: [
      {
        externalKey: entry.externalKey,
        status: 'confirmed' as const,
        ...buildAssessmentBinding({
          entry,
          artifact,
          evidence,
          registry,
          requiredNotices: ['CRB'],
          evidenceIds: [evidenceId],
        }),
        requiredNotices: ['CRB'],
        rationale: 'The whole definition matches CRB p. 119.',
        reviewedBy: 'Catalog reviewer',
        reviewedOn: '2026-10-07',
      },
    ],
  });
  const comparison = {
    content: 'CRB p. 119 Cleave compared with the imported text.',
  };
  const original = assess({ comparison }, 'comparison');
  const options = {
    artifact,
    legalResources,
    inputValues: {
      remaps: [],
      curation: [],
      localData: [],
      parsers: 'test-parser',
      sanitizers: 'test-sanitizer',
      ruleResources: [],
    },
    compatibility: { schema: 'sheet-v1', calculation: 'facts-v1' },
  };
  const rows = (release: { batches: ReleaseRow[][] }) => release.batches.flat();
  const row = (release: { batches: ReleaseRow[][] }, key: string) =>
    rows(release).find((candidate) => candidate.key === key)?.payload;
  return {
    createCatalogRelease,
    computeFingerprint,
    entry,
    artifact,
    registry,
    assess,
    comparison,
    original,
    options,
    row,
  };
}

/**
 * The verification a release reads for Cleave (#227 slice 4): Cleave's
 * inventory row and its projection, which verifies Cleave's structure and
 * the imported entry by default, read as current unless `stale` names why not.
 */
export async function cleaveVerification({
  mechanisms = [],
  projected = {},
  inInventory = true,
  stale = [],
}: {
  mechanisms?: { name: string; status: string }[];
  projected?: {
    verified?: string[];
    mechanisms?: string[];
    prose?: { mechanism: string; category: string }[];
    evidence?: string[];
  };
  inInventory?: boolean;
  stale?: string[];
} = {}) {
  const { releaseVerificationOf } =
    await import('../../scripts/catalog/release-verification');
  const { entry } = cleaveImport();
  const sha256 = createHash('sha256')
    .update(JSON.stringify(entry))
    .digest('hex');
  return releaseVerificationOf({
    inventory: inInventory
      ? [{ key: entry.externalKey, catalogKey: entry.externalKey, mechanisms }]
      : [],
    status: {
      rows: [
        {
          key: entry.externalKey,
          verified: ['admission', 'structure'],
          mechanisms: [],
          prose: [],
          evidence: [`entry:sha256:${sha256}`],
          ...projected,
        },
      ],
      stale,
    },
  });
}
