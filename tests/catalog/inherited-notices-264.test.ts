// @vitest-environment node
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import review from '../../scripts/catalog/legal/inherited-notices-264.json';
import {
  buildAssessmentBinding,
  type AdmissionSource,
} from '../../scripts/catalog/admission';
import type { PreviewEntry } from '../../scripts/catalog/map';
import type { AttributionAssessment } from '../../src/lib/catalog/admission-schema';
import { buildLegalPageData } from '../../src/lib/catalog/legal-page-data';
import { resolveNotice } from '../../src/lib/catalog/resolve-notice';
import {
  legalResources,
  section15Registry,
} from '../../src/lib/catalog/section15-registry-data';
import { assessWithUnclearedHolds } from './uncleared-holds';

const hashes = [
  '0a956582f65e71fe2fe52f61c946a781aa11bb0b960476b451933295aa70bd3c',
  '3a6b265094c2fc112534c1adbae72d88214852eeb744e57bba9438b5cbc08a80',
  '64871234c0abc806678e00c81136fc774f16931f67eb2c30c34e42cb404dc0e9',
  '9b5e2dcad9278164bfd79f70db7002493afa8bc0180175f2826b9193f0179c2a',
  '7d75468ec859d3452bcef8458792e6ef19c7aafcf9cbaf2f759fdf4bc923b2a2',
  '457075cca66db294b4beb065fd7edbe6c2b85823dca6d9b070d95688b536ac1e',
  '2e30b523b6eb621e5973679d33ea6888fac2c49b24415581bb546b93ac4c4cbc',
  'b840ae33b9e70cfac2d8606381d06e4d1d147ee00e1ddc24edc2daf84ec77078',
  '19445ec089c4ce95eff5dfd4d7615f4d6a09769548e3d2ea4599d5ec6e07fbe7',
  'be58a1cef0bc3f5c5a7a23fb89e401e8788eefa5bac69d5d23e5668425e78700',
  '45537b13ca4f4fbb7adb6ded79569032bed952977e4c7412944981e571161a6f',
  '7b8bd4df6ed85ccfbf802a13d2060aec55ba16e32eccb6d7e4b3693c910b7e4c',
];
const canonicalKeys = hashes.map((hash) => `pf1-content/notice/${hash}`);
const keys = [
  ...hashes.slice(0, 3).map((hash) => `pf1/notice/${hash}`),
  ...canonicalKeys,
];
const reviewer = 'Astra (AI curator) for the owner';

function sha256(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

function fixture(requiredNotices = keys) {
  const entry: PreviewEntry = {
    externalKey: 'fixture/notice-264',
    upstreamKey: 'fixture/notice-264',
    pack: 'feats',
    name: 'Synthetic notice gate fixture',
    description: 'Synthetic fixture only; no imported content is assessed.',
    detail: { kind: 'feat', featTypes: [], repeatable: 'unreviewed' },
    sources: [],
    modifiers: [],
    unsupported: [],
  };
  const artifact: AdmissionSource = {
    catalog: { entries: [entry] },
    comparison: {
      packs: [],
      records: [
        {
          repo: 'fixture',
          pack: entry.pack,
          path: 'notice-264.yaml',
          externalKey: entry.externalKey,
          name: entry.name,
          status: 'admitted',
          reason: 'Synthetic fixture only.',
        },
      ],
    },
  };
  const evidence = {
    fixture: {
      content: 'Synthetic content comparison for gate behavior only.',
    },
  };
  const assessments: AttributionAssessment[] = [
    {
      externalKey: entry.externalKey,
      status: 'confirmed',
      ...buildAssessmentBinding({
        entry,
        artifact,
        evidence,
        registry: section15Registry,
        requiredNotices,
        evidenceIds: ['fixture'],
      }),
      requiredNotices,
      rationale: 'Fixture-only assessment; not evidence for a Catalog Entry.',
      reviewedBy: 'Fixture reviewer',
      reviewedOn: '2026-10-07',
    },
  ];
  return { artifact, evidence, assessments, registry: section15Registry };
}

it('binds all 15 immutable blocks to complete verbatim notices at the pinned lines', () => {
  expect(review.blocks.map((block) => block.key)).toEqual(keys);
  expect(review).toMatchObject({
    reviewedBy: reviewer,
    reviewedOn: '2026-10-07',
    checkedAgainst: 'pf1-content',
  });
  for (const [repo, source] of Object.entries(review.sources)) {
    const upstream = legalResources.upstreamNotices.find(
      (notice) => notice.id === source.legalResourceId,
    );
    if (!upstream) throw new Error(`Missing legal resource for ${repo}`);
    const original = legalResources.ogl.text + upstream.text;
    expect(sha256(original)).toBe(source.fileSha256);
    const lines = original.split('\n');
    for (const block of review.blocks.filter((item) => item.source === repo)) {
      const notice = resolveNotice({
        registry: section15Registry,
        code: block.key,
      });
      if (!notice) throw new Error(`Missing Registry record for ${block.key}`);
      expect(block).toMatchObject({ kind: 'complete-notice', joinedWith: [] });
      expect(block.textSha256).toBe(block.key.split('/').at(-1));
      expect(notice.notice).toBe(lines[block.line - 1]);
      expect(sha256(notice.notice)).toBe(block.textSha256);
      expect(notice).toMatchObject({
        checkedAgainst: 'pf1-content',
        checkedOn: '2026-10-07',
        reviewStatus: 'reviewed',
      });
      expect(notice.provenance).toContain(
        `Reviewed by ${reviewer} on 2026-10-07.`,
      );
      expect(notice.provenance).toContain(`${source.url}#L${block.line}`);
      expect(notice).toBe(section15Registry[block.registryKey]);
      expect(notice.aliases).toEqual(
        keys.filter(
          (key) => key !== block.registryKey && key.endsWith(block.textSha256),
        ),
      );
    }
  }
});

it('publishes 12 reviewed notices for 15 keys and retains every historic notice version', () => {
  const page = buildLegalPageData({
    registry: section15Registry,
    resources: legalResources,
    permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
    requiredNotices: keys,
  });
  expect(page.outstandingNotices).toEqual([]);
  expect(
    page.sections.find((section) => section.id === 'section15')?.notices,
  ).toEqual(page.permanentNoticeSuperset);
  expect(
    page.permanentNoticeSuperset.filter((notice) =>
      notice.id.startsWith('registry:'),
    ),
  ).toHaveLength(12);
  for (const code of canonicalKeys) {
    expect(page.permanentNoticeSuperset).toContainEqual({
      id: `registry:${code}`,
      title: section15Registry[code]!.title,
      text: section15Registry[code]!.notice,
      provenance: section15Registry[code]!.provenance,
    });
  }
  expect(page.permanentNoticeSuperset).toEqual(
    expect.arrayContaining(legalResources.permanentNoticeSuperset),
  );
  const laterPage = buildLegalPageData({
    registry: {},
    resources: legalResources,
    permanentNoticeSuperset: page.permanentNoticeSuperset,
    requiredNotices: [],
  });
  expect(laterPage.permanentNoticeSuperset).toEqual(
    page.permanentNoticeSuperset,
  );
});

it('requires a separate content assessment and enforces the batch notice holds even when all inherited notices are reviewed', () => {
  const input = fixture();
  expect(assessWithUnclearedHolds({ ...input, assessments: [] })).toMatchObject(
    {
      passed: true,
      admitted: [],
      held: [
        {
          externalKey: 'fixture/notice-264',
          reason: 'missing Attribution Assessment',
        },
      ],
    },
  );
  const result = assessWithUnclearedHolds(input);
  expect(result).toMatchObject({
    passed: true,
    admitted: [],
    held: [
      {
        externalKey: 'fixture/notice-264',
        requiredNotices: [...keys].sort(),
        missingNotices: [],
        reason: expect.stringMatching(/^Notice holds: /),
      },
    ],
    failures: [],
  });
  for (const hold of review.holds) {
    expect(result.held[0]?.reason).toContain(`${hold.noticeKey} (`);
    expect(result.held[0]?.reason).toContain(hold.id);
  }
  const unheld = keys.filter(
    (key) => !review.holds.some((hold) => hold.noticeKey === key),
  );
  expect(unheld).toHaveLength(6);
  expect(assessWithUnclearedHolds(fixture(unheld))).toMatchObject({
    passed: true,
    admitted: [
      {
        externalKey: 'fixture/notice-264',
        requiredNotices: [...unheld].sort(),
      },
    ],
    held: [],
    failures: [],
  });
  expect(input.artifact.catalog.entries[0]?.sources).toEqual([]);
});

it('reopens an accepted fixture assessment when its reviewed notice changes', () => {
  const input = fixture();
  const code = canonicalKeys[0]!;
  const registry = structuredClone(section15Registry);
  registry[code]!.notice += ' Fixture-only changed notice.';
  expect(assessWithUnclearedHolds({ ...input, registry })).toMatchObject({
    passed: true,
    admitted: [],
    held: [
      {
        externalKey: 'fixture/notice-264',
        reason: expect.stringContaining('Notice bindings require re-review:'),
      },
    ],
  });
});

it('keeps full book chains and pre-existing unreviewed seeds outstanding', () => {
  expect(review.holds.map((hold) => hold.noticeKey)).toEqual(
    canonicalKeys.slice(3),
  );
  expect(new Set(review.holds.map((hold) => hold.id)).size).toBe(9);
  for (const hold of review.holds) {
    expect(hold.status).toBe('held');
    expect(
      resolveNotice({ registry: section15Registry, code: hold.title }),
    ).toBeUndefined();
  }
  const bookTitles = review.holds.map((hold) => hold.title);
  const unreviewedSeeds = ['PZO9419', 'PZO9416', 'PZO1137', 'PZO9269'];
  const requiredNotices = [...bookTitles, ...unreviewedSeeds];
  const page = buildLegalPageData({
    registry: section15Registry,
    resources: legalResources,
    permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
    requiredNotices,
  });
  expect(page.outstandingNotices).toEqual(
    expect.arrayContaining([
      ...bookTitles.map((code) => ({ code, title: code, reason: 'missing' })),
      ...unreviewedSeeds.map((code) => ({
        code,
        title: section15Registry[code]!.title,
        reason: 'unreviewed',
      })),
    ]),
  );
  expect(page.outstandingNotices).toHaveLength(requiredNotices.length);
  // PZO9419 and PZO9416 have reviewed PCGen blocks since their confirmations'
  // review was recorded (2026-10-31): the gate resolves them, while the page
  // still lists their own unreviewed Registry records.
  const gateMissing = requiredNotices.filter(
    (code) => code !== 'PZO9419' && code !== 'PZO9416',
  );
  expect(assessWithUnclearedHolds(fixture(requiredNotices))).toMatchObject({
    passed: true,
    admitted: [],
    held: [
      {
        externalKey: 'fixture/notice-264',
        missingNotices: expect.arrayContaining(gateMissing),
      },
    ],
  });
});
