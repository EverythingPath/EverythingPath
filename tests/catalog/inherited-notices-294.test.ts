// @vitest-environment node
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { beforeAll, expect, it } from 'vitest';
import review from '../../scripts/catalog/legal/inherited-notices-294.json';
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
  '974602e66be88a151985cd2d1c32bfc1e6b44f954e2bcca5abf628658218ad58',
  'e9d7fc2ea7ea729c11877199ea8072361b7accb29b61f33c35a6153da51fcad5',
  '795ff4999a29a03a50ac2d98941afdfcc87651d1061c348e59a535229566f3f8',
  '9c0965f29e5d3ba5f77a9d63e3027d2e3ef9bff5f786ad252fe7228b97c48799',
  '0f06e653dc797b120b72d07228bc3313f1fce8965f827403ecb5974911e4e47a',
  'b3d1aca48c244dabab8c917e933c1b990f2d71d75f4009ebcf2d5321f3b70262',
  'db1272745e6aa08670ba219c4ba0d60d12f187735d34f4cc3b88ffb101b7ebc2',
  'db1272745e6aa08670ba219c4ba0d60d12f187735d34f4cc3b88ffb101b7ebc2',
  'd472b3213bb8013caa684895568fb65cfae8a57ea5a597210bdf84466c41d9e3',
  '67d33ff99896c69f73e1552b00cca44a828b8a947052a4b4adf43bf1c61c96fc',
  '67d33ff99896c69f73e1552b00cca44a828b8a947052a4b4adf43bf1c61c96fc',
  'dd261f4abe86af6bca33f1e84c13f6f238e4d684fef9118423bca029c4ba5933',
  '5970ef2775a5e69821e06091e081604e641e565e7b63dd184ddfd4ece4226589',
  '9c6a5887f5bdd09d9a5e6b5520df3f937d5259a7f2d4b44ae476ec14b5d5883a',
  'fdbb36aaeedf25a4c6b9afdf44bf5f17c92e1a7f9b26c096dd252f1ed53c6ada',
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

it('reconciles fifteen physical occurrences with thirteen unique trimmed notice identities', () => {
  expect(review.blocks.map((block) => block.key)).toEqual(keys);
  expect(review.inventoryOccurrences.map((item) => item.key)).toEqual(
    occurrenceKeys,
  );
  expect(review.inventoryOccurrences.map((item) => item.line)).toEqual(
    Array.from({ length: 15 }, (_, index) => index + 488),
  );
  expect(
    review.inventoryOccurrences.filter((item) => item.duplicateOccurrenceOf),
  ).toMatchObject([
    { occurrence: 8, duplicateOccurrenceOf: 7, line: 495 },
    { occurrence: 11, duplicateOccurrenceOf: 10, line: 498 },
  ]);
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
  for (const occurrence of review.inventoryOccurrences) {
    const raw = lines[occurrence.line - 1]!;
    const notice = section15Registry[occurrence.key]!;
    expect(sha256(raw)).toBe(occurrence.textSha256);
    expect(sha256(raw.trim())).toBe(occurrence.keySha256);
    expect(occurrence.keySha256).toBe(occurrence.key.split('/').at(-1));
    expect(notice).toMatchObject({
      notice: raw.trim(),
      checkedAgainst: 'pf1-content',
      checkedOn: '2026-10-09',
      reviewStatus: 'reviewed',
      aliases: [],
    });
    expect(notice.provenance).toEqual(
      expect.arrayContaining([
        `${source.url}#L${occurrence.line}`,
        expect.stringContaining(`raw line sha256:${occurrence.textSha256}`),
        'Reviewed by Sol (AI curator) for the owner on 2026-10-09.',
        'scripts/catalog/legal/inherited-notices-294.json',
      ]),
    );
    if (raw !== raw.trim()) {
      expect(raw).toBe(raw.trim() + ' ');
      expect(
        section15Registry[`pf1-content/notice/${occurrence.textSha256}`],
      ).toBeUndefined();
    }
  }
  for (const block of review.blocks) {
    expect(block).toMatchObject({
      kind: 'complete-notice',
      joinedWith: [],
      registryKey: block.key,
      disposition: 'reviewed-notice',
    });
    expect(
      lines.filter((line) => sha256(line.trim()) === block.keySha256),
    ).toHaveLength([keys[6], keys[8]].includes(block.key) ? 2 : 1);
  }
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
  expect(section15Registry[keys[2]!]!.notice).toContain(
    'Necromancer Games., Inc.',
  );
  expect(section15Registry[keys[3]!]!.notice).toContain(
    'Wolf-in-Sheep’s-Clothing',
  );
  expect(section15Registry[keys[5]!]!.notice).toContain(
    'Adam Daigle and Jay Loomis',
  );
  expect(section15Registry.PZO1137!.reviewStatus).toBe('unreviewed');
});

it('records precise PRD and PCGen comparisons without resolving edition or guide discrepancies', () => {
  expect(review.comparisonSources).toHaveLength(6);
  const guide = review.comparisonSources.find((source) =>
    source.location.includes('players_guide'),
  )!;
  expect(guide.copyrightLines[0]!.text).toContain('2012, Paizo Inc.');
  expect(guide.copyrightLines[0]!.text).toContain('James L. Sutter');
  expect(
    review.holds.find((hold) => hold.noticeKey === keys[5])!.reason,
  ).toContain('2013, Paizo Publishing, LLC, Adam Daigle and Jay Loomis');
  const wolf = review.comparisonSources.find((source) =>
    source.location.includes('bestiary_3'),
  )!;
  expect(wolf.copyrightLines[0]!.text).toContain('\u0012');
  expect(wolf.copyrightLines[0]!.text).toContain('Revised, Copyright 2002');
  expect(section15Registry[keys[3]!]!.notice).toContain('Complete © 2011');
  const prd = review.comparisonSources.find(
    (source) => source.source === 'Paizo PRD',
  )!;
  expect(prd.copyrightLines.map((line) => line.line)).toEqual([
    527, 529, 530, 532, 533, 534, 536,
  ]);
  expect(prd.result).toContain('HTTP 200');
  expect(prd.result).toContain('not Complete 2011');
  expect(review.publicationAnchors.result).toContain(
    'Publication-identity anchors only',
  );
  expect(review.comparisonSearchBoundary.treeTruncated).toBe(false);
  expect(review.comparisonSearchBoundary.selectedPccFiles).toHaveLength(7);
  const complete = review.comparisonSources.find((source) =>
    source.location.includes('bestiary_6'),
  )!;
  expect(complete.noticeKeys).toContain(
    'pf1-content/notice/68288565bf57c372fed57f3572f2801f1a4dd0dcb5bf302bad0f9617d7ee52a8',
  );
  expect(complete.noticeKeys).not.toContain(keys[0]);
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
  expect(page.permanentNoticeSuperset).toHaveLength(16);
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
      evidence: ['scripts/catalog/legal/inherited-notices-294.json'],
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
