// @vitest-environment node
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { beforeAll, expect, it } from 'vitest';
import review from '../../scripts/catalog/legal/inherited-notices-288.json';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import {
  buildAssessmentBinding,
  type AdmissionSource,
} from '../../scripts/catalog/admission';
import { importCatalog } from '../../scripts/catalog/import';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { buildLegalPageData } from '../../src/lib/catalog/legal-page-data';
import {
  legalResources,
  reviewedAdmission,
} from '../../src/lib/catalog/reviewed-data';
import { section15Registry } from '../../src/lib/catalog/section15-registry-data';
import { assessWithUnclearedHolds } from './uncleared-holds';

const hashes = [
  '07b31d1e5568c7c0be1da69bf2374f67d347de5ef30ef300753843fd03421c5f',
  '42b9aaec1953521aa8166e7ca9e1c2134a4b08a8a1dbbcfc92a94cfdfc658929',
  'cd234a9e5aec6d8e1230bd493d64ae65b4b56dd6b3b116d777dadc7619275240',
  '513cb311686ccd3a47f9eb807cda11c78010bc85896f296870368fc8b22a816b',
  '855e97134187c77e9c9420151f1ddbbb2ba4693f50bc405c549632ad59b821ab',
  'a57590179e0fb49d7fd4bea6b8edeaa8772634a48bfa707895630d847c078d27',
  'a8f3599419b7a015f0bb26776aea3e5f57ac6aaccfdd40031cf7edcb24e34b2f',
  '239d3e1794909a79a3b523d63f9f429d4b37554f6dcb4614030f07d86615a901',
  'aafdbe0b21ceef57bb270d7b4670cae8fc188f2329df9fc1d8994ae7503f550b',
  'f620f9eb16f1b73b147353ba8a5e6dc5df87a30a0223429fb89da0204a1ba7fa',
  '8143b52ca1422b2573b7bbbaa6b8fdd29d54bd6863b7cae08f2a922566f3d19b',
  'a90e4b7aa5c455282c276cbe251717b0e4a98d6c3d15e1481e0f7662f20682fe',
  '2dac97e1f40e29aec5a4805b6e8a8240d6186c451b22bf95b51c2904ff183a38',
  'aa4df0dff421479a27abb0fa7fc30e59657da59b180bb7dbafd58299b4f766f9',
  'b4fe021965be06167d70a307cda018a16befb9838c7b2479e977b09ed4cb0bbb',
];
const keys = hashes.map((hash) => `pf1-content/notice/${hash}`);
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

it('matches the independent ticket hashes, raw source lines and trimmed Registry notices', () => {
  expect(review.blocks.map((block) => block.key)).toEqual(keys);
  expect(review.inventoryOccurrences).toEqual(
    keys.map((key, index) => ({
      occurrence: index + 1,
      key,
      line: index + 398,
      registryKey: key,
      disposition: 'reviewed-notice',
      duplicateOccurrenceOf: null,
    })),
  );
  expect(review).toMatchObject({
    reviewedBy: 'Sol (AI curator) for the owner',
    reviewedOn: '2026-10-08',
    candidates: [],
    retainedExceptions: [],
  });
  for (const [repo, source] of Object.entries(review.sources)) {
    const upstream = legalResources.upstreamNotices.find(
      (notice) => notice.id === source.legalResourceId,
    )!;
    const original = legalResources.ogl.text + upstream.text;
    expect(sha256(original)).toBe(source.fileSha256);
    const lines = original.split('\n');
    for (const block of review.blocks) {
      if (repo === 'pf1') {
        expect(
          lines.some((line) => sha256(line.trim()) === block.keySha256),
        ).toBe(false);
        continue;
      }
      const raw = lines[block.line - 1]!;
      const notice = section15Registry[block.key]!;
      expect(sha256(raw)).toBe(block.textSha256);
      expect(sha256(raw.trim())).toBe(block.keySha256);
      expect(block.keySha256).toBe(block.key.split('/').at(-1));
      expect(
        lines.filter((line) => sha256(line.trim()) === block.keySha256),
      ).toHaveLength(1);
      expect(block).toMatchObject({
        kind: 'complete-notice',
        joinedWith: [],
        registryKey: block.key,
        disposition: 'reviewed-notice',
      });
      expect(notice).toMatchObject({
        notice: raw.trim(),
        checkedAgainst: 'pf1-content',
        checkedOn: '2026-10-08',
        reviewStatus: 'reviewed',
        aliases: [],
      });
      expect(notice.provenance).toEqual(
        expect.arrayContaining([
          'Reviewed by Sol (AI curator) for the owner on 2026-10-08.',
          'scripts/catalog/legal/inherited-notices-288.json',
          `${source.url}#L${block.line}`,
          expect.stringContaining(`raw line sha256:${block.textSha256}`),
        ]),
      );
    }
  }
});

it('retains literal copyright years, markers and distinctive wording', () => {
  const years = [
    2015, 2013, 2014, 2013, 2017, 2018, 2017, 2013, 2014, 2016, 2014, 2015,
    2009, 2016, 2013,
  ];
  for (const [index, key] of keys.entries()) {
    const marker = index === 12 ? 'Copyright' : '©';
    const publisher = [1, 3, 7, 12, 14].includes(index)
      ? 'Paizo Publishing, LLC'
      : 'Paizo Inc.';
    expect(section15Registry[key]!.notice).toContain(
      `${marker} ${years[index]}, ${publisher};`,
    );
  }
  expect(section15Registry[keys[5]!]!.notice).toContain(
    'Plane-Hopper’s Handbook',
  );
  expect(section15Registry[keys[9]!]!.notice).toContain('Spymaster’s Handbook');
  expect(section15Registry[keys[11]!]!.notice).toContain(
    'Weapon Master’s Handbook',
  );
  expect(section15Registry[keys[12]!]!.notice).toContain(
    'Bonus Bestiary. Copyright',
  );
  expect(section15Registry[keys[14]!]!.notice).toContain(
    'Ultimate Campaign. ©',
  );
  expect(section15Registry[keys[9]!]!.notice).toContain('Owen K.C. Stephens');
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
  expect(page.permanentNoticeSuperset).toHaveLength(18);
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
      evidence: ['scripts/catalog/legal/inherited-notices-288.json'],
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
