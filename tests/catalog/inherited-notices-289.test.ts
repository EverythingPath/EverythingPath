// @vitest-environment node
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { beforeAll, expect, it } from 'vitest';
import review from '../../scripts/catalog/legal/inherited-notices-289.json';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import {
  buildAssessmentBinding,
  type AdmissionSource,
} from '../../scripts/catalog/admission';
import { importCatalog } from '../../scripts/catalog/import';
import { buildCatalogRelease } from '../../scripts/catalog/release';
import { reconstructReleaseRegistry } from '../../src/lib/catalog/release-registry';
import { validateCatalogReleaseRows } from '../../src/lib/catalog/release-schema';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { buildLegalPageData } from '../../src/lib/catalog/legal-page-data';
import {
  legalResources,
  reviewedAdmission,
} from '../../src/lib/catalog/reviewed-data';
import { section15Registry } from '../../src/lib/catalog/section15-registry-data';
import { assessWithUnclearedHolds } from './uncleared-holds';

const hashes = [
  '37d88cdda209a90d79badbf76410f5b060c6b2b9e3406706e5925a4b1481b30d',
  '83bb74c4dd5802c3152299a992dffe61e1f9cd08229bc42eafa00dc99d029429',
  '415f9be2652d77f942364bdd6762f1e24409b59d93c97f31b21a1c07f8ab0f86',
  '11f60e7e5bd220cb89b6b7fa874865c8906620a68e93a353bc7247aa46d5afd2',
  '7e4219bea1826b968930a39983ac3e5b29c3fb92e13ab52d263e68cbb7e73526',
  '10f28bcee46091d2d380545e826047401b1fa301cfb5701497d347b025a0f740',
  '5182f12c3b3551755c70915212140b3fd2df72857d442ec65b3c932c788e18d8',
  'abe320461bea52aeb611818b5a5c1f92b52b8c1ce70d393cc5c0afd0911f399d',
  '6f81aca96be61467bd8a9bb23af4573934cd649d8e46fa10010f26fb105429f7',
  '497535b6dd8c24126191c5f4910b847fd0415b8ee4151bfd4d1b73e4775db63e',
  '9200a4b664db430e8a9707885aa1f11cab2341ba8c09d7f0f4d81cfad518f5dc',
  '2d98e6a41bb15a4845a4540d83568a0e877e280fd619b4ccce7663b581a55121',
  '5c8f45e2c62539b2507e131da1d2fd65c9941818109075d0b616829a80968ae6',
  '31db42761e18ca436dd2d29a69dd92319d3dad63667a06b4f01f81d668d7e2db',
  '6b606512df67b4ad08f3c9b2aa9f5e09bb0603355d7d33d8cc1a515d93c23d99',
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
      line: index + 413,
      registryKey: key,
      disposition: 'reviewed-notice',
      duplicateOccurrenceOf: null,
    })),
  );
  expect(review).toMatchObject({
    reviewedBy: 'Sol (AI curator) for the owner',
    reviewedOn: '2026-10-09',
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
        checkedOn: '2026-10-09',
        reviewStatus: 'reviewed',
        aliases: [],
      });
      expect(notice.provenance).toEqual(
        expect.arrayContaining([
          'Reviewed by Sol (AI curator) for the owner on 2026-10-09.',
          'scripts/catalog/legal/inherited-notices-289.json',
          `${source.url}#L${block.line}`,
          expect.stringContaining(`raw line sha256:${block.textSha256}`),
        ]),
      );
    }
  }
});

it('preserves literal edition, date, punctuation and contributor variants', () => {
  const years = [
    2012, 2009, 2009, 2010, 2011, 2011, 2011, 2011, 2015, 2002, 2011, 2011,
    2011, 2018, 2011,
  ];
  for (const [index, key] of keys.entries())
    expect(section15Registry[key]!.notice).toContain(String(years[index]));
  expect(section15Registry[keys[0]!]!.notice).toContain(
    'Owen KC Stephens, Russ Taylor, and numerous RPG Superstar contributors.',
  );
  expect(section15Registry[keys[8]!]!.notice).toContain('Ross Beyers');
  expect(section15Registry[keys[9]!]!.notice).toContain('Revised.© 2002');
  expect(section15Registry[keys[12]!]!.notice).toContain(
    'Author Scott Greene and Clark Peterson',
  );
  expect(section15Registry[keys[3]!]!.notice).toContain(
    'GameMastery Guide, © 2010',
  );
  expect(section15Registry[keys[4]!]!.notice).toContain('Scenario 2–18');
  expect(section15Registry[keys[13]!]!.notice).toContain('Lacy Pellazar');
  expect(section15Registry[keys[2]!]!.notice).toBe(
    section15Registry.CRB!.notice,
  );
  expect(section15Registry.CRB!.aliases).toEqual(['PZO1110']);
  expect(section15Registry.CRB!.checkedOn).toBe('2026-10-03');
  expect(section15Registry[keys[2]!]!.aliases).toEqual([]);
  expect(section15Registry.PZO1137!.reviewStatus).toBe('unreviewed');
  expect(
    heldNotices.some(
      (hold) => hold.id === 'notice-265-core-rulebook-variant-comparison',
    ),
  ).toBe(true);
});

it('records permitted PCGen comparisons and keeps distinct wording unresolved', () => {
  expect(review.comparisonSources).toHaveLength(3);
  const core = review.comparisonSources.find((source) =>
    source.path.endsWith('/core_rulebook.pcc'),
  )!;
  expect(core.copyrightLines.find((line) => line.line === 33)!.text).toContain(
    'Paizo Inc.; Author: Jason Bulmahn',
  );
  expect(core.copyrightLines.map((line) => line.text).join('\n')).toContain(
    'The Book of Experimental Might',
  );
  expect(section15Registry[keys[2]!]!.notice).toContain(
    'Paizo Publishing, LLC;',
  );
  const equipment = review.comparisonSources.find((source) =>
    source.path.endsWith('/ultimate_equipment.pcc'),
  )!;
  expect(
    equipment.copyrightLines.find((line) => line.line === 39)!.text,
  ).toContain('Owen KC Stephens, and Russ Taylor.');
  expect(
    review.holds.find((hold) => hold.noticeKey === keys[0])!.reason,
  ).toContain('contributor-list ending');
  expect(review.unavailableEvidence[0]!.result).toContain('HTTP 403');
});

it('investigates stamina advisories without clearing earlier content holds', () => {
  expect(review.advisoryReviews).toHaveLength(19);
  const toughness = review.advisoryReviews.find(
    (item) => item.externalKey === 'pf1/8snLqsJN4LLL00Nq',
  )!;
  expect(toughness.result).toContain('False positive');
  for (const item of review.advisoryReviews) {
    expect(item.source.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(item.source.termLines.length).toBeGreaterThan(0);
    expect(item.existingHoldIds.length).toBeGreaterThan(0);
    const assessment = reviewedAdmission.assessments.find(
      (candidate) => candidate.externalKey === item.externalKey,
    )!;
    expect(assessment.status).toBe('unresolved');
  }
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
      evidence: ['scripts/catalog/legal/inherited-notices-289.json'],
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
    // This notice review must leave the existing CRB content assessment
    // untouched. Later content batches may name these notices independently.
    reviewedAdmission.assessments.filter(
      (assessment) =>
        assessment.externalKey === externalKey &&
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
