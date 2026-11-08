// @vitest-environment node
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { beforeAll, expect, it } from 'vitest';
import review from '../../scripts/catalog/legal/inherited-notices-286.json';
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
  '39cd4f77255f2c1e0e216639327496172b87b9e83d5508e3a91c398a4c50dd29',
  'b611a8811065cd03dde9c67021ac62588fe91e75d74d6c6c3b410ec9047804ed',
  '42d13b5697ed6b9f54a77b102cb12fd81f0c91790e9ec6a66ee09a3d9f857f19',
  '838859a1640d7ad7a03c7d3bd927c9d6546eaba559d208650816c7bfdad6f22c',
  'd137268ba47b006231090147f10fb0b93c88c7cb1ece27180acbfbfdf31a7539',
  'aac1cfccc9d9db71b43da2f008cd446129cafadcf7ce176c063b20108cb22a07',
  '17b73375151c37362df983c2dc3903c710ad02f5c891cd4b9dddfed3f41285e4',
  '6e64ca1ee2004b20df9cc58a1c1b901dcfc4ac414dd8e24a0dab6166bf5969ee',
  'f437ef27b14f2023847f93482b3c8e00e55e72bd8701a9a67d94c0e95db821c7',
  '0a7449c88d6b1ef802737919c9c819107d44a0596d3bce0c1a170f8caa6fcd7d',
  '218463b20b59ff6214834061f17129d17cd43f5979d8381ecf9a9d7979b824da',
  'b8c8e89a2b3e258472990a8cfbda86602b9bb10fa4e96a7c4ba97e30b970aa3c',
  '17a2d87f6e7e594bca7a29ebfeb6fb70d73ad093d2f423c5e15a859395bf3510',
  'a5bd35cf544ff9ef092fc108d115668e8318ee0b77462ebb06dd039233a35867',
  '0d714b8b8b9ad053f9c04bbc2be74ba98df60feffe8872fd074e02e96dd34b85',
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
      line: index + 368,
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
          'scripts/catalog/legal/inherited-notices-286.json',
          `${source.url}#L${block.line}`,
          expect.stringContaining(`raw line sha256:${block.textSha256}`),
        ]),
      );
    }
  }
});

it('retains literal copyright years, publishers, names and apostrophes', () => {
  const years = [
    2012, 2016, 2018, 2017, 2014, 2014, 2014, 2013, 2013, 2015, 2016, 2011,
    2013, 2013, 2011,
  ];
  for (const [index, key] of keys.entries()) {
    const publisher = [1, 2, 3, 4, 6, 9, 10].includes(index)
      ? 'Paizo Inc.'
      : 'Paizo Publishing, LLC';
    expect(section15Registry[key]!.notice).toContain(
      `© ${years[index]}, ${publisher};`,
    );
  }
  expect(section15Registry[keys[2]!]!.notice).toContain('Mikko Kallo');
  expect(section15Registry[keys[9]!]!.notice).toContain('Mikko Kallio');
  expect(section15Registry[keys[8]!]!.notice).toContain(
    'Demon Hunter’s Handbook',
  );
  expect(section15Registry[keys[12]!]!.notice).toContain(
    "Dragonslayer's Handbook",
  );
  expect(section15Registry[keys[13]!]!.notice).toContain(
    "Dungeoneer's Handbook",
  );
  expect(section15Registry[keys[14]!]!.notice).toContain(
    'Faiths of Balance. ©',
  );
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
      evidence: ['scripts/catalog/legal/inherited-notices-286.json'],
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
