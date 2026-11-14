// @vitest-environment node
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { beforeAll, expect, it } from 'vitest';
import review from '../../scripts/catalog/legal/inherited-notices-290.json';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import {
  computeFingerprint,
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
  'd372bb944c1231880e4a050fb162d2563dd281e84e7cd4ed8a4a4ce1c7c0d157',
  '119947abaacee5f22cd3ad5108a67925522f171c47912101f3450e505bc53ebd',
  '77a70acfe1a9126dd48b416e4a3ac30b1a0af5fb1d20701ea443958360c4d92e',
  '308e21e6ac3cfe6ce8e3ab7bc9e3916a7994dd809eb2e5b256041578bf73c511',
  '40b63185e65171ba11912c82f49ec9ea5c1d24bc661d16e484c22f03db21d10e',
  'f1e4e5ced5a5abed7e2deb06b90766f9f64b48bc70be8b35b74eda66233cf630',
  'f1e4e5ced5a5abed7e2deb06b90766f9f64b48bc70be8b35b74eda66233cf630',
  '791078494ee21719d750c4caa1020f44483d8a552c53db42ab9fa796b8c6d80e',
  '791078494ee21719d750c4caa1020f44483d8a552c53db42ab9fa796b8c6d80e',
  '63535a903f0c88f6403203cdd19bfe3ee4335857dd659c1b712d56de90aed88f',
  'e70c90aed86b648038569379ac890dc390bd8e60153d983944ffbae9d4c65cb2',
  'd7fd805977809ce6946d9b6a9cdca8e5da2862fe21f5c033de7581cb28c950f8',
  'd34b08447933a467ee083597adbfc8b663c0020591b767a13574b5edca2da765',
  '35ff017de27eeaea7850bf8437e0957be682c94ed99500195836ef5ae179982d',
  '00d6fbd3d461b84bb671b61d787676273c5b495688202c7b8f71ee7e09c731bf',
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
    Array.from({ length: 15 }, (_, index) => index + 428),
  );
  expect(
    review.inventoryOccurrences.filter((item) => item.duplicateOccurrenceOf),
  ).toMatchObject([
    { occurrence: 7, duplicateOccurrenceOf: 6, line: 434 },
    { occurrence: 9, duplicateOccurrenceOf: 8, line: 436 },
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
        'scripts/catalog/legal/inherited-notices-290.json',
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
    ).toHaveLength([keys[5], keys[6]].includes(block.key) ? 2 : 1);
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

it('preserves frozen original identities and literal date, author and edition variants', () => {
  for (const [key, fingerprint] of Object.entries(
    review.preservation.frozenOriginalRegistry,
  ))
    expect(computeFingerprint(section15Registry[key])).toBe(fingerprint);
  const years = [
    2002, 2011, 2011, 2011, 2007, 2011, 2011, 2002, 2011, 2011, 2002, 2002,
    2004,
  ];
  for (const [index, key] of keys.entries())
    expect(section15Registry[key]!.notice).toContain(String(years[index]));
  expect(section15Registry[keys[1]!]!.notice).toContain("Psionic Al-mi'raj");
  expect(section15Registry[keys[4]!]!.notice).toContain(
    'Player’s Guide. Copyright 2007',
  );
  expect(section15Registry[keys[10]!]!.notice).toContain('Revised.© 2002');
  expect(section15Registry[keys[10]!]!.notice).toContain(
    'Scott Greene and Clark Peterson',
  );
  expect(section15Registry[keys[11]!]!.notice).toContain(
    'Author: Scott Greene,',
  );
  expect(section15Registry[keys[11]!]!.notice).not.toContain('Clark Peterson');
  expect(section15Registry[keys[12]!]!.notice).toContain(
    'Author Scott Greene; Additional Authors:',
  );
  expect(section15Registry[keys[0]!]!.notice).not.toBe(
    section15Registry[
      'pf1-content/notice/6b606512df67b4ad08f3c9b2aa9f5e09bb0603355d7d33d8cc1a515d93c23d99'
    ]!.notice,
  );
  expect(section15Registry.PZO1137!.reviewStatus).toBe('unreviewed');
  expect(section15Registry.PZO1137!.notice).toContain(
    section15Registry[keys[6]!]!.notice,
  );
  expect(section15Registry.PZO1137!.notice).toContain(
    section15Registry[keys[9]!]!.notice,
  );
});

it('records selected PCGen comparisons without equating edition or punctuation variants', () => {
  expect(review.comparisonSources).toHaveLength(5);
  const bestiary = review.comparisonSources.find((source) =>
    source.path.includes('bestiary_2'),
  )!;
  expect(
    bestiary.copyrightLines.find((line) => line.line === 76)!.text,
  ).toContain('Revised, Copyright 2002');
  const rot = review.comparisonSources.find((source) =>
    source.path.includes('bestiary_3'),
  )!;
  expect(rot.copyrightLines[0]!.text).toContain(
    'Rot Grub from the Tome of Horrors, Revised',
  );
  expect(section15Registry[keys[5]!]!.notice).toContain('Complete © 2011');
  const original = review.comparisonSources.find((source) =>
    source.path.includes('/35e/'),
  )!;
  expect(original.copyrightLines[0]!.text).toContain(
    "Player's Guide. Copyright 2007",
  );
  const anniversary = review.comparisonSources.find((source) =>
    source.path.includes('players_guide_ae'),
  )!;
  expect(anniversary.copyrightLines[0]!.text).toContain('Copyright 2012');
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
      evidence: ['scripts/catalog/legal/inherited-notices-290.json'],
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
