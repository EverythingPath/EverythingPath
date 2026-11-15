// @vitest-environment node
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { beforeAll, expect, it } from 'vitest';
import review from '../../scripts/catalog/legal/inherited-notices-292.json';
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
  '3f20b6685a199c5e42978efe6d2e154ecba6ed9a36bc40cc1218d27ca368b3c6',
  '5099ab03af8698938e554f419c83085936eb2f8f236fb57816dce25558fe9d12',
  '5099ab03af8698938e554f419c83085936eb2f8f236fb57816dce25558fe9d12',
  '3fec1b4b98a312c11d96c87f234932981820e7117dada5409c4c30516eb4cc23',
  '762321ebedf061dc040d27758fba3d8337a5ea676ce61618ec97473b16010966',
  'fa53c4190ecd44ca012545354eed4300dcd53cc7b0414a0303ba84a7d713d0eb',
  '8250acbdc7582ec66a9972525a7c9cc2a936bff0688f144c6a516adf4c328edc',
  '609c42b15be79b37d227e3106bcf449f7d24a84e1a9c2c8903f2249f20d2969b',
  '8bc9ef89c4d22fad3fc55493bcfbe30f47deb69929853d77b1ac914324cdea67',
  'c40240b5fda8b0c40e7a9eb43217eeabcd1547724a031ffb6cee12471430a9e6',
  'ff59953fb3405de4e888747ea4cfb6237451f7dc2f176ed43be039ff197841d5',
  '8885664a1499b13a20ef5eda6e4979fda54fce11521a41d5281190572d90be17',
  'fa3b3ce21467fa1533b3a7548dc8272b26873d1381cf5eccd8ea368229a9f6f2',
  'f7220b4898a767e195e13f7441daef458a89e4e805daa6f827aa6248776d2ab4',
  'f7220b4898a767e195e13f7441daef458a89e4e805daa6f827aa6248776d2ab4',
];
const occurrenceKeys = hashes.map((hash) => `pf1-content/notice/${hash}`);
const sourceKeys = [...new Set(occurrenceKeys)];
const headingKey = sourceKeys[2]!;
const keys = sourceKeys.filter((key) => key !== headingKey);
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

it('reconciles fifteen physical occurrences with thirteen identities: twelve notices and one heading', () => {
  expect(review.blocks.map((block) => block.key)).toEqual(sourceKeys);
  expect(review.inventoryOccurrences.map((item) => item.key)).toEqual(
    occurrenceKeys,
  );
  expect(review.inventoryOccurrences.map((item) => item.line)).toEqual(
    Array.from({ length: 15 }, (_, index) => index + 458),
  );
  expect(
    review.inventoryOccurrences.filter((item) => item.duplicateOccurrenceOf),
  ).toMatchObject([
    { occurrence: 3, duplicateOccurrenceOf: 2, line: 460 },
    { occurrence: 15, duplicateOccurrenceOf: 14, line: 472 },
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
    expect(sha256(raw)).toBe(occurrence.textSha256);
    expect(sha256(raw.trim())).toBe(occurrence.keySha256);
    expect(occurrence.keySha256).toBe(occurrence.key.split('/').at(-1));
    if (occurrence.key === headingKey) {
      expect(section15Registry[headingKey]).toBeUndefined();
      expect(occurrence.registryKey).toBeNull();
      continue;
    }
    const notice = section15Registry[occurrence.key]!;
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
        'scripts/catalog/legal/inherited-notices-292.json',
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
    if (block.key === headingKey) {
      expect(block).toMatchObject({
        kind: 'editorial-heading',
        registryKey: null,
        disposition: 'retained-heading',
        joinedWith: [],
      });
      continue;
    }
    expect(block).toMatchObject({
      kind: 'complete-notice',
      joinedWith: [],
      registryKey: block.key,
      disposition: 'reviewed-notice',
    });
    expect(
      lines.filter((line) => sha256(line.trim()) === block.keySha256),
    ).toHaveLength([keys[1], keys[11]].includes(block.key) ? 2 : 1);
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

it('preserves frozen original identities and distinct literal contributor and edition variants', () => {
  for (const [key, fingerprint] of Object.entries(
    review.preservation.frozenOriginalRegistry,
  ))
    expect(computeFingerprint(section15Registry[key])).toBe(fingerprint);
  expect(section15Registry[keys[0]!]!.notice).toContain('Revised © 2002');
  expect(section15Registry[keys[1]!]!.notice).toContain('Complete © 2011');
  expect(section15Registry[keys[6]!]!.notice).toContain(
    'Ian S. Johnston, Patrick Lawinger',
  );
  expect(section15Registry[keys[7]!]!.notice).toContain(
    'Ian S. Johnson, Patrick Lawringer',
  );
  expect(section15Registry[keys[8]!]!.notice).toContain(
    'Authors: Scott Greene, with Erica Balsley',
  );
  expect(section15Registry[keys[9]!]!.notice).toContain(
    'Authors: Scott Greene, with Clark Peterson',
  );
  expect(section15Registry[keys[2]!]!.notice).toContain(
    'Tome of Horrors 4 © 2013',
  );
  expect(section15Registry[keys[2]!]!.provenance).toContainEqual(
    expect.stringContaining(headingKey),
  );
  expect(section15Registry[keys[2]!]!.notice).not.toContain('Greg Vaughan');
  for (const key of keys) expect(section15Registry[key]!.aliases).toEqual([]);
  expect(section15Registry.PZO1137!.reviewStatus).toBe('unreviewed');
});

it('records permitted PCGen comparisons without equating variants or accepting the editorial claim', () => {
  expect(review.comparisonSources).toHaveLength(2);
  expect(review.comparisonSources[0]!.copyrightLines[0]!.text).toContain(
    'Tick, Giant & Dragon',
  );
  expect(review.comparisonSources[0]!.copyrightLines[1]!.text).toContain(
    'Troll, Ice from the Tome of Horrors, Revised',
  );
  expect(review.comparisonSources[1]!.copyrightLines[0]!.text).toBe(
    'COPYRIGHT:The Tome of Horrors, Copyright 2002, Necromancer Games, Inc.',
  );
  expect(review.unavailableEvidence[0]!.result).toContain('HTTP 403');
  const page = buildLegalPageData({
    registry: section15Registry,
    resources: legalResources,
    permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
    requiredNotices: [headingKey],
  });
  expect(page.outstandingNotices).toEqual([
    { code: headingKey, title: headingKey, reason: 'missing' },
  ]);
  expect(
    page.permanentNoticeSuperset.some(
      (notice) => notice.id === `registry:${headingKey}`,
    ),
  ).toBe(false);
  const hold = review.holds.find((hold) => hold.noticeKey === headingKey)!;
  expect(heldNotices.find((item) => item.id === hold.id)).toMatchObject({
    notices: [headingKey],
    evidence: ['scripts/catalog/legal/inherited-notices-292.json'],
  });
  expect(assessWithUnclearedHolds(gateInput([headingKey]))).toMatchObject({
    admitted: [],
    held: [{ externalKey, missingNotices: [headingKey] }],
  });
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
      evidence: ['scripts/catalog/legal/inherited-notices-292.json'],
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
  expect(review.holds.map((hold) => hold.noticeKey)).toEqual(sourceKeys);
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
