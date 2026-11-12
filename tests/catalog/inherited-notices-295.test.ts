// @vitest-environment node
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { beforeAll, expect, it } from 'vitest';
import review from '../../scripts/catalog/legal/inherited-notices-295.json';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import {
  computeFingerprint,
  buildAssessmentBinding,
  type AdmissionSource,
} from '../../scripts/catalog/admission';
import { importCatalog } from '../../scripts/catalog/import';
import { buildCatalogRelease } from '../../scripts/catalog/release';
import { reconstructReleaseRegistry } from '../../src/lib/catalog/release-registry';
import {
  MAX_RELEASE_BATCH_BYTES,
  validateCatalogReleaseRows,
} from '../../src/lib/catalog/release-schema';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { buildLegalPageData } from '../../src/lib/catalog/legal-page-data';
import {
  legalResources,
  reviewedAdmission,
} from '../../src/lib/catalog/reviewed-data';
import { section15Registry } from '../../src/lib/catalog/section15-registry-data';
import { assessWithUnclearedHolds } from './uncleared-holds';

const hashes = [
  'ecc9a08e2a55463199ad43d9cd99139806312856221eb837cab376ec9bbd47d2',
];
const occurrenceKeys = hashes.map((hash) => `pf1-content/notice/${hash}`);
const keys = [...new Set(occurrenceKeys)];
const sha256 = (text: string) =>
  createHash('sha256').update(text).digest('hex');

let artifact: AdmissionSource;
// Reuse published CRB Lightning Reflexes and its landed evidence, not invented rules.
const externalKey = 'pf1/0bZf3SDkvVOe2ujH';
beforeAll(async () => {
  const imported = await importCatalog({
    systemPath: resolve('tests/fixtures/feats-330/pf1'),
    contentPath: resolve('tests/fixtures/feats-330/pf1-content'),
    remaps: [],
    curation: reviewedCuration,
  });
  artifact = {
    catalog: {
      entries: imported.catalog.entries.filter(
        (entry) => entry.externalKey === externalKey,
      ),
    },
    comparison: {
      packs: [],
      records: imported.comparison.records.filter(
        (record) => record.externalKey === externalKey,
      ),
    },
  };
  expect(artifact.catalog.entries).toHaveLength(1);
});

function gateInput(requiredNotices: string[]) {
  requiredNotices = [...new Set(['PZO1110', ...requiredNotices])];
  const existing = reviewedAdmission.assessments.find(
    (assessment) => assessment.externalKey === externalKey,
  )!;
  // Extra requirements are a test-only gate probe, never attribution for these books.
  const assessment = {
    ...existing,
    requiredNotices,
    ...buildAssessmentBinding({
      entry: artifact.catalog.entries[0]!,
      artifact,
      ...reviewedAdmission,
      requiredNotices,
      evidenceIds: Object.keys(existing.evidenceFingerprints),
    }),
  };
  return { ...reviewedAdmission, artifact, assessments: [assessment] };
}

it('reviews exactly the final complete notice against both preserved pinned source bodies', () => {
  expect(review.blocks.map((block) => block.key)).toEqual(keys);
  expect(review.inventoryOccurrences.map((item) => item.key)).toEqual(
    occurrenceKeys,
  );
  expect(review.inventoryOccurrences.map((item) => item.line)).toEqual([503]);
  expect(review).toMatchObject({
    reviewedBy: 'Sol (AI curator) for the owner',
    reviewedOn: '2026-10-09',
    candidates: [],
    retainedExceptions: [],
  });
  const source = review.sources['pf1-content'];
  const upstream = legalResources.upstreamNotices.find(
    (notice) => notice.id === source.legalResourceId,
  )!;
  const original = legalResources.ogl.text + upstream.text;
  expect(sha256(original)).toBe(source.fileSha256);
  const lines = original.split('\n');
  const occurrence = review.inventoryOccurrences[0]!;
  const raw = lines[502]!;
  const notice = section15Registry[occurrence.key]!;
  expect(sha256(raw)).toBe(occurrence.textSha256);
  expect(sha256(raw.trim())).toBe(occurrence.keySha256);
  expect(occurrence.keySha256).toBe(hashes[0]);
  expect(
    lines.filter((line) => sha256(line.trim()) === hashes[0]),
  ).toHaveLength(1);
  expect(notice).toMatchObject({
    notice: raw.trim(),
    checkedAgainst: 'pf1-content',
    checkedOn: '2026-10-09',
    reviewStatus: 'reviewed',
    aliases: [],
  });
  expect(notice.provenance).toEqual(
    expect.arrayContaining([
      `${source.url}#L503`,
      expect.stringContaining(`raw line sha256:${occurrence.textSha256}`),
      'Reviewed by Sol (AI curator) for the owner on 2026-10-09.',
      'scripts/catalog/legal/inherited-notices-295.json',
    ]),
  );
  expect(review.blocks[0]).toMatchObject({
    kind: 'complete-notice',
    joinedWith: [],
    registryKey: occurrence.key,
    disposition: 'reviewed-notice',
    text: raw.trim(),
  });
  const system = review.sources.pf1;
  const systemUpstream = legalResources.upstreamNotices.find(
    (notice) => notice.id === system.legalResourceId,
  )!;
  const systemText = legalResources.ogl.text + systemUpstream.text;
  expect(sha256(systemText)).toBe(system.fileSha256);
  expect(
    systemText.split('\n').some((line) => hashes.includes(sha256(line.trim()))),
  ).toBe(false);
});

it('preserves frozen original Registry and hold values while allowing additive records', () => {
  for (const [key, fingerprint] of Object.entries(
    review.preservation.frozenOriginalRegistry,
  ))
    expect(computeFingerprint(section15Registry[key])).toBe(fingerprint);
  const holdsById = new Map(heldNotices.map((hold) => [hold.id, hold]));
  for (const [id, fingerprint] of Object.entries(
    review.preservation.frozenOriginalHolds,
  ))
    expect(computeFingerprint(holdsById.get(id))).toBe(fingerprint);
  for (const key of keys) expect(section15Registry[key]!.aliases).toEqual([]);
  expect(section15Registry.PZO1137!.reviewStatus).toBe('unreviewed');
});

it('keeps the Revised 2002 comparisons distinct from the Complete 2011 notice', () => {
  expect(review.comparisonSources).toHaveLength(2);
  const prd = review.comparisonSources.find(
    (source) => source.source === 'Paizo PRD',
  )!;
  const pcgen = review.comparisonSources.find(
    (source) => source.source === 'PCGen',
  )!;
  expect(prd.copyrightLines[0]).toMatchObject({ line: 536 });
  expect(pcgen.copyrightLines[0]).toMatchObject({ line: 91 });
  for (const source of review.comparisonSources) {
    const line = source.copyrightLines[0]!;
    expect(sha256(line.text)).toBe(line.textSha256);
    expect(line.text).toContain(
      '2002, Necromancer Games, Inc.; Author Scott Greene',
    );
    expect(line.text).toContain('Gary Gygax');
    expect(source.result).toContain('no complete chain');
  }
  expect(prd.copyrightLines[0]).toMatchObject({
    decodedText: expect.stringContaining('Revised, © 2002'),
  });
  expect(section15Registry[keys[0]!]!.notice).toContain('Revised. © 2002');
  const complete = review.relatedReviewedNotices[0]!;
  expect(section15Registry[complete.noticeKey]!.notice).toContain(
    'Complete © 2011',
  );
  expect(section15Registry[complete.noticeKey]!.aliases).not.toContain(keys[0]);
  expect(
    heldNotices.some((hold) => hold.notices.includes(complete.noticeKey)),
  ).toBe(true);
});

it('investigates existing advisories without claiming content attribution or clearing earlier holds', () => {
  expect(review.advisoryReviews).toHaveLength(36);
  for (const item of review.advisoryReviews) {
    expect(item.source.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(item.source.termLines.length).toBeGreaterThan(0);
    expect(item.existingHoldIds.length).toBeGreaterThan(0);
    expect(review.candidates).toEqual([]);
    expect(
      review.holds.some((hold) => item.existingHoldIds.includes(hold.id)),
    ).toBe(false);
    expect(
      reviewedAdmission.assessments.find(
        (assessment) => assessment.externalKey === item.externalKey,
      )!.status,
    ).toBe('unresolved');
  }
  expect(review.advisoryScope).toContain('#333–#336/#516–#519');
  expect(
    review.advisoryReviews.find((item) => item.name === 'Toughness')!.result,
  ).toContain('False positive');
  expect(
    review.advisoryReviews.find((item) => item.name === 'Apotheosis')!.result,
  ).toContain('False positive');
  expect(
    review.advisoryReviews.find((item) => item.name === 'Explorer')!.source
      .termLines,
  ).toEqual([21, 22]);
});

it('generates every reviewed notice and preserves the permanent superset when requirements disappear', () => {
  const page = buildLegalPageData({
    registry: section15Registry,
    resources: legalResources,
    permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
    requiredNotices: keys,
  });
  expect(page.sections).toHaveLength(4);
  expect(page.outstandingNotices).toEqual([]);
  expect(page.outstandingResources).toEqual([]);
  expect(page.permanentNoticeSuperset).toHaveLength(4);
  for (const key of keys)
    expect(page.permanentNoticeSuperset).toContainEqual({
      id: `registry:${key}`,
      title: section15Registry[key]!.title,
      text: section15Registry[key]!.notice,
      provenance: section15Registry[key]!.provenance,
    });
  const later = buildLegalPageData({
    registry: {},
    resources: legalResources,
    permanentNoticeSuperset: page.permanentNoticeSuperset,
    requiredNotices: [],
  });
  expect(later.permanentNoticeSuperset).toEqual(page.permanentNoticeSuperset);
});

it.each(keys)(
  'enforces the complete-chain hold independently for %s',
  (key) => {
    const hold = review.holds.find((item) => item.noticeKey === key)!;
    expect(heldNotices.find((item) => item.id === hold.id)).toEqual({
      id: hold.id,
      notices: [key],
      evidence: ['scripts/catalog/legal/inherited-notices-295.json'],
    });
    expect(assessWithUnclearedHolds(gateInput([key]))).toMatchObject({
      passed: true,
      admitted: [],
      held: [
        {
          externalKey,
          missingNotices: [],
          reason: expect.stringContaining(hold.id),
        },
      ],
      requiredNotices: [],
      failures: [],
    });
  },
);

it('keeps ordinary CRB admission intact and requires a separate content assessment', () => {
  expect(assessWithUnclearedHolds(gateInput(['PZO1110']))).toMatchObject({
    passed: true,
    admitted: [{ externalKey }],
    held: [],
    requiredNotices: ['PZO1110'],
  });
  expect(
    assessWithUnclearedHolds({ ...gateInput(keys), assessments: [] }),
  ).toMatchObject({
    passed: true,
    admitted: [],
    held: [{ externalKey, reason: 'missing Attribution Assessment' }],
  });
  expect(review.holds.map((hold) => hold.noticeKey)).toEqual(keys);
  expect(
    reviewedAdmission.assessments.filter((assessment) =>
      assessment.requiredNotices.some((key) => keys.includes(key)),
    ),
  ).toEqual([]);
});

it.each(['missing', 'unreviewed'] as const)(
  'reports a %s notice without newly supplying its text',
  (state) => {
    const key = keys[0]!;
    const registry = structuredClone(section15Registry);
    if (state === 'missing') delete registry[key];
    else registry[key]!.reviewStatus = 'unreviewed';
    const page = buildLegalPageData({
      registry,
      resources: legalResources,
      permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
      requiredNotices: [key],
    });
    expect(page.outstandingNotices).toEqual([
      {
        code: key,
        title: state === 'missing' ? key : registry[key]!.title,
        reason: state,
      },
    ]);
    expect(
      page.permanentNoticeSuperset.some(
        (notice) => notice.id === `registry:${key}`,
      ),
    ).toBe(false);
    expect(
      assessWithUnclearedHolds({ ...gateInput([key]), registry }),
    ).toMatchObject({
      admitted: [],
      held: [{ externalKey, missingNotices: [key] }],
    });
  },
);

it('preserves the complete Registry through bounded release batches', async () => {
  const release = await buildCatalogRelease({
    releaseNumber: 1,
    compatibility: { schema: 'test', calculation: 'test' },
    inputs: {
      upstream: [],
      remaps: [],
      curation: [],
      localData: [],
      parsers: [],
      sanitizers: [],
      ruleResources: [],
      legal: [],
      attribution: [],
    },
    rows: [{ kind: 'legal', key: 'registry', payload: section15Registry }],
  });
  expect(MAX_RELEASE_BATCH_BYTES).toBe(512000);
  for (const batch of release.batches) {
    expect(Buffer.byteLength(JSON.stringify(batch))).toBeLessThanOrEqual(
      512000,
    );
    validateCatalogReleaseRows(batch);
  }
  expect(await reconstructReleaseRegistry(release.batches.flat())).toEqual(
    section15Registry,
  );
});
