// @vitest-environment node
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { beforeAll, expect, it } from 'vitest';
import review from '../../scripts/catalog/legal/inherited-notices-293.json';
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
  '80d2eb3a76a763b1efee4b06ae715fb92644e0919efbdb1027f2f42711d4bc0c',
  '80d2eb3a76a763b1efee4b06ae715fb92644e0919efbdb1027f2f42711d4bc0c',
  '37e781dd267faffa7a2c4798cf0e5eb3e41e8cccf770b56e8015c1fd74ff8156',
  '1b53e99f23890dea01f26d4c0a8938480d86a3fc20c3f781aea798a0db0181b4',
  'ae2fad080e44c57c86164f532c08ca84ab334039405f2cccf8bb7bd88ecfb7de',
  '1f140446831e591d9fe1c75ca40740def94b6a1a5064f04ce94573a4205f1747',
  '8657208e7708cbebaa53302529d8c00c48d2d395ec47938e6bd2f044584a7716',
  '5a9c830adb322afaee73f383c7be286781b3707439d1f1f9fa32ffe4bcc1221a',
  '4a2997cd65e5ef1d1d0600226742692db8cc4ad6a4e6189b325bc10721fc0e00',
  '9fec463eab1d1a88acd494435452a7d638cb1cdc0a130989dcdc8f56d3556b85',
  'de228441ecfbc69fdee2291eebb55fa25d127803e70551243f19d76d5a659fd7',
  'ba7642a5eb0d3c692293ec8fcd58e0b902db7b46d82757cf77549d9fc145e329',
  '68b9a6a7ffb546ebdd3be945806529e5cfdecfe9a4e576cfeb2ea37d6af0772c',
  '68288565bf57c372fed57f3572f2801f1a4dd0dcb5bf302bad0f9617d7ee52a8',
  '6e561916c398782b1ba949416d668657dfc5147b715695ba025042909d9ada73',
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

it('reconciles fifteen physical occurrences with fourteen unique trimmed notice identities', () => {
  expect(review.blocks.map((block) => block.key)).toEqual(keys);
  expect(review.inventoryOccurrences.map((item) => item.key)).toEqual(
    occurrenceKeys,
  );
  expect(review.inventoryOccurrences.map((item) => item.line)).toEqual(
    Array.from({ length: 15 }, (_, index) => index + 473),
  );
  expect(
    review.inventoryOccurrences.filter((item) => item.duplicateOccurrenceOf),
  ).toMatchObject([{ occurrence: 2, duplicateOccurrenceOf: 1, line: 474 }]);
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
        'scripts/catalog/legal/inherited-notices-293.json',
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
    ).toHaveLength(block.key === keys[0] ? 2 : 1);
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
  const combatWithoutPeriod = section15Registry[keys[4]!]!.notice;
  expect(section15Registry[keys[5]!]!.notice).toBe(combatWithoutPeriod + '.');
  expect(combatWithoutPeriod).toContain(
    'Jason Bulmahn, Tim Hitchcock, Colin McComb',
  );
  expect(
    review.holds.find((hold) => hold.noticeKey === keys[4])!.reason,
  ).toContain('#224');
  expect(section15Registry[keys[9]!]!.notice).toContain(
    'Ultimate Magic Supplement: Ultimate Cantrips',
  );
  expect(section15Registry[keys[13]!]!.notice).toContain('Revised.© 2002');
  expect(section15Registry[keys[13]!]!.notice).toContain(
    'Scott Greene and Clark Peterson',
  );
  for (const key of keys) expect(section15Registry[key]!.aliases).toEqual([]);
});

it('records six permitted PCGen comparisons without equating editions or resolving the known author defect', () => {
  expect(review.comparisonSources).toHaveLength(6);
  const combat = review.comparisonSources.find((source) =>
    source.path.includes('ultimate_combat'),
  )!;
  expect(combat.copyrightLines[0]!.text).toContain(
    'Copyright 2011, Paizo Inc.',
  );
  expect(combat.result).toContain(
    '#224 known Ultimate Combat author-list defect',
  );
  const troll = review.comparisonSources.find((source) =>
    source.path.includes('bestiary_2'),
  )!;
  expect(troll.copyrightLines[0]!.text).toContain('Revised, Copyright 2002');
  expect(section15Registry[keys[0]!]!.notice).toContain('Complete © 2011');
  expect(review.unavailableEvidence[0]!.result).toContain('HTTP 403');
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
  expect(page.permanentNoticeSuperset).toHaveLength(17);
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
      evidence: ['scripts/catalog/legal/inherited-notices-293.json'],
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
