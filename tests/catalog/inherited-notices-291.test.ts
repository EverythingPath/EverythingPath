// @vitest-environment node
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { beforeAll, expect, it } from 'vitest';
import review from '../../scripts/catalog/legal/inherited-notices-291.json';
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
  '0226765b1af4dc4731079a4bf0d262e55e82387241cee53f12b52f2031fdc8b7',
  'ab6225a416e991ec2b207396692e7940a7cda03e03749c85fd8e8073362accab',
  'a3da0e7af51a228b128bbc6d094a106ba977d533440741142b6dab5dd0a835ce',
  'efb47738d3e5943cd8018b4622e05473670d7eeee7447e41be8765e4947ce1d8',
  '33d17ca006dcb9c71ca79a1785f7b8b19f0cea56a8f096840f4b02c708236a9a',
  'ae92e9a77c1bc2c481d02edb5367810ee088c7a2989bfc3a6f71ff8fc4bc117f',
  'ae92e9a77c1bc2c481d02edb5367810ee088c7a2989bfc3a6f71ff8fc4bc117f',
  '1d79e460e790027339486982cb4a6caceee11c9a21ee9acd30bf0bc1df7b75a2',
  '1d79e460e790027339486982cb4a6caceee11c9a21ee9acd30bf0bc1df7b75a2',
  '814c57b59eb1daf43083cbf399edd7cf3633c62943b5940b3371d1608639a9f8',
  '814c57b59eb1daf43083cbf399edd7cf3633c62943b5940b3371d1608639a9f8',
  '269ae9ebe5b32b1830dcaef99cfa666ae93a3e743c8e65e8578def1c6cb574ce',
  '3d062243fab06999441e3a3ef13408dcc9453f3f299f8c8fcbebffb85f88fa37',
  'a775224b7b0541b93f8c50f16a45180ac6b83ae1578099c01184075fc1aaf7da',
  '5ac9983ac78669318ce5fec07cb5245aeda0d7c0cb99586a8f3107aed2ea68b3',
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

it('reconciles fifteen physical occurrences with twelve unique trimmed notice identities', () => {
  expect(review.blocks.map((block) => block.key)).toEqual(keys);
  expect(review.inventoryOccurrences.map((item) => item.key)).toEqual(
    occurrenceKeys,
  );
  expect(review.inventoryOccurrences.map((item) => item.line)).toEqual(
    Array.from({ length: 15 }, (_, index) => index + 443),
  );
  expect(
    review.inventoryOccurrences.filter((item) => item.duplicateOccurrenceOf),
  ).toMatchObject([
    { occurrence: 7, duplicateOccurrenceOf: 6, line: 449 },
    { occurrence: 9, duplicateOccurrenceOf: 8, line: 451 },
    { occurrence: 11, duplicateOccurrenceOf: 10, line: 453 },
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
        'scripts/catalog/legal/inherited-notices-291.json',
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
    ).toHaveLength([keys[5], keys[6], keys[7]].includes(block.key) ? 2 : 1);
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

it('preserves frozen original identities, missing dates and unresolved edition/contributor variants', () => {
  for (const [key, fingerprint] of Object.entries(
    review.preservation.frozenOriginalRegistry,
  ))
    expect(computeFingerprint(section15Registry[key])).toBe(fingerprint);
  expect(section15Registry[keys[1]!]!.notice).toBe(
    "Skull & Shackles Player's Guide © , Paizo Publishing, LLC; Author: Rob McCreary.",
  );
  expect(section15Registry[keys[2]!]!.notice).not.toContain('Gary Gygax');
  expect(section15Registry[keys[5]!]!.notice).toContain(
    'Authors: Scott Greene and Erica Balsley',
  );
  expect(section15Registry[keys[6]!]!.notice).toContain('Revised © 2002');
  expect(section15Registry[keys[7]!]!.notice).toContain('Complete © 2011');
  expect(section15Registry[keys[8]!]!.notice).toContain('Copyright 2002');
  expect(section15Registry[keys[10]!]!.notice).toContain(
    'IV © 2013 Frog God Games',
  );
  expect(section15Registry[keys[11]!]!.notice).toContain(
    'IV, Copyright 2013, Frog God Games',
  );
  expect(section15Registry[keys[10]!]!.notice).not.toBe(
    section15Registry[keys[11]!]!.notice,
  );
  expect(section15Registry.PZO1137!.reviewStatus).toBe('unreviewed');
  expect(section15Registry.PZO1137!.notice).toContain(
    section15Registry[keys[3]!]!.notice,
  );
});

it('records selected PCGen comparisons without correcting missing years or equating variants', () => {
  expect(review.comparisonSources).toHaveLength(4);
  const guide = review.comparisonSources.find((source) =>
    source.path.includes('skull_and_shackles'),
  )!;
  expect(guide.copyrightLines[0]!.text).toContain('Copyright 2012, Paizo Inc.');
  expect(guide.result).toContain('missing year');
  const revised = review.comparisonSources.find((source) =>
    source.path.includes('bestiary_2'),
  )!;
  expect(
    revised.copyrightLines.find((line) => line.line === 82)!.text,
  ).toContain('based on original material by Gary Gygax');
  expect(
    revised.copyrightLines.find((line) => line.line === 86)!.text,
  ).toContain('Revised, Copyright 2002');
  const complete = review.comparisonSources.find((source) =>
    source.path.includes('bestiary_6'),
  )!;
  expect(complete.copyrightLines[0]!.text).toContain(
    'Slithering Tracker from the Tome of Horrors Complete Copyright 2011',
  );
  expect(review.unavailableEvidence[0]!.result).toContain('HTTP 403');
  for (const key of keys) expect(section15Registry[key]!.aliases).toEqual([]);
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
  expect(page.permanentNoticeSuperset).toHaveLength(15);
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
      evidence: ['scripts/catalog/legal/inherited-notices-291.json'],
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
