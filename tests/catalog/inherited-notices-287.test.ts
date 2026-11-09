// @vitest-environment node
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { beforeAll, expect, it } from 'vitest';
import review from '../../scripts/catalog/legal/inherited-notices-287.json';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import {
  buildAssessmentBinding,
  type AdmissionSource,
} from '../../scripts/catalog/admission';
import { importCatalog } from '../../scripts/catalog/import';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { buildCatalogRelease } from '../../scripts/catalog/release';
import { reconstructReleaseRegistry } from '../../src/lib/catalog/release-registry';
import { validateCatalogReleaseRows } from '../../src/lib/catalog/release-schema';
import { buildLegalPageData } from '../../src/lib/catalog/legal-page-data';
import {
  legalResources,
  reviewedAdmission,
} from '../../src/lib/catalog/reviewed-data';
import { section15Registry } from '../../src/lib/catalog/section15-registry-data';
import { assessWithUnclearedHolds } from './uncleared-holds';

const hashes = [
  'c6f3ba60d6d1bd7ea4ac2a722a1413d5365178aa08872b69bcc9f00ffa3b44a6',
  '13a02de549081e4d96df2133ce8169ddf0cb7a1ab72bef1cacc3c6ec99d1bbbd',
  '9541fa5cd3c2f5a2c47d79b2b6180c5614531dc165d7c627ca43156be9a4502b',
  'ba4494ea4c4f7eda65e9af4681fc14571a1bbffd0ca59e04bfe4e98efe19adfb',
  'df662c704383ccb1c71473ca661203080b44353e207c116c9b8ab60d115569a3',
  'be3193ca396c387da0ad63e7a2d1ed9d2909fed5561cd9c42ab56914585bcf07',
  '8072b9e3bad5b327e0373be2df5d6cbed09f415e45b1da636610cc0f0888522a',
  'aca2480290b3d24737e511a620a310febe04fd9977e6bceb204420b2839bd32c',
  '5dd75fe7a278f07fe02ecb196b58c95014b4f662daa0264b972877ca2aaad3df',
  'e70b18e1ddd4823a848f2edb3f714a97cff09e7e06112c550b02cf2ee7e31e56',
  'eda7508133250f417656d2324778c4675bf8877904346f6c8ea1fdbe999ca49f',
  'e729d33569b9d1d1836ff335a379534f64dc9d9561805e50a8bec1c90fc929c0',
  'e22adb2843d14136884fdf40f7cde92f0bb943e7c7d82d426f2320738f7e195d',
  '0dd44d849536294bca2e9e7c617249d2917e42bc389487fb64ca59ccc5e8d489',
  '3b3071acfe00c9435a1043f901d8f7bbd988686fc03915b3d5b7fca3a4b9a545',
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
      line: index + 383,
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
          'scripts/catalog/legal/inherited-notices-287.json',
          `${source.url}#L${block.line}`,
          expect.stringContaining(`raw line sha256:${block.textSha256}`),
        ]),
      );
    }
  }
});

it('retains the copyright markers, punctuation and contributor spellings verbatim', () => {
  const years = [
    2011, 2014, 2010, 2016, 2016, 2018, 2019, 2011, 2010, 2012, 2016, 2017,
    2016, 2015, 2013,
  ];
  for (const [index, key] of keys.entries()) {
    const marker = [2, 8].includes(index) ? 'Copyright' : '©';
    const publisher = [0, 2, 7, 8, 9, 14].includes(index)
      ? 'Paizo Publishing, LLC'
      : 'Paizo Inc.';
    expect(section15Registry[key]!.notice).toContain(
      `${marker} ${years[index]}, ${publisher};`,
    );
  }
  expect(section15Registry[keys[1]!]!.notice).toContain(
    "Giant Hunter's Handbook",
  );
  expect(section15Registry[keys[4]!]!.notice).toContain('Healer’s Handbook');
  expect(section15Registry[keys[2]!]!.notice).toContain(
    'Halflings of Golarion. Copyright',
  );
  expect(section15Registry[keys[8]!]!.notice).toContain(
    'Inner Sea Primer. Copyright',
  );
  expect(section15Registry[keys[7]!]!.notice).toContain(
    'Humans of Golarion. ©',
  );
  expect(section15Registry[keys[2]!]!.notice).toContain(
    'Hal MacLean and Amber E. Scott',
  );
  expect(section15Registry[keys[1]!]!.notice).toContain('David Ross');
  expect(section15Registry[keys[4]!]!.notice).toContain('David N. Ross');
  expect(section15Registry[keys[7]!]!.notice).toContain(
    'Sean K Reynolds, Amber Scott',
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
      evidence: ['scripts/catalog/legal/inherited-notices-287.json'],
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
  for (const batch of release.batches) validateCatalogReleaseRows(batch);
  expect(await reconstructReleaseRegistry(release.batches.flat())).toEqual(
    section15Registry,
  );
});
