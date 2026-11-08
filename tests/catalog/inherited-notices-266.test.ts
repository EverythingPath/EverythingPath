// @vitest-environment node
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import review from '../../scripts/catalog/legal/inherited-notices-266.json';
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
  '354d484076179238d5c252b0fac4ac7dc5dfcaed06609f7d8e6c7da89dc1ab07',
  '04230b2d85e80ebb62882b0bea474737e15650f729d57f5b996bb024fcb79c60',
  'dd635d267ce719125e295393d306f11e2f91a2f8becc03a563d364bbbf8b022c',
  '976cffbae0de8d3fdd24b7d249bb003e3b94585273a69755131e63f967ece3a8',
  '034652f29337400f0b97aa9f90ec815cfcfcfd95224adbde18c9e21ae763ae02',
  'b083c0e8dd0010ee5501657b2646d6334b6db54cf0582d538845e3b63aa17477',
  '30ee3a940770f17b2d0ebf4e0da1a6ae9888ed7c5b893ebd93974fdeaf9506a5',
  'db3003ab0611cbbc0cd47d6c9603bf42341cce6afc40addc1b62e070f1440db6',
  '6cab8092ee97a760eb4c9bb30cdf3b609a0b491cb2333a6de070584cacd456d1',
  '9ababf8feeb81574c5ad104e9cb0a6c8752daef4643780cb036caf3a47315873',
  '51d0606978fd5baf3b4a449fb09c06bcdf3584e7e4982a97c9bb698a28a89e28',
  '18d94261b8d43b35647f092ee1450557b0e3f9f4987f4a456d881d1f4fdf1a8f',
  'd00a8e73500272bd52493bdcece965759d2472d74b3b834cc8b14cbc85985c3b',
  'be85cf55d3fc17008c8a4740c1f0d5e664034a97c07d2e4f6ee2bede215b5248',
  '1072d65fbfeca11e5dbfef8fa9bc77bfa012d04b8674fd1a01c54115af313202',
];
const keys = hashes.map((hash) => `pf1-content/notice/${hash}`);
const reviewer = 'Sol (AI curator) for the owner';

function sha256(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

function fixture(requiredNotices = keys) {
  const entry: PreviewEntry = {
    externalKey: 'fixture/notice-266',
    upstreamKey: 'fixture/notice-266',
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
          path: 'notice-266.yaml',
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
  expect(review.blocks.map((block) => block.line)).toEqual(
    Array.from({ length: 15 }, (_, index) => index + 68),
  );
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

it('publishes 15 reviewed notices for 15 keys and retains every historic notice version', () => {
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
  ).toHaveLength(15);
  for (const code of keys) {
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
          externalKey: 'fixture/notice-266',
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
        externalKey: 'fixture/notice-266',
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
  expect(input.artifact.catalog.entries[0]?.sources).toEqual([]);
});

it('reopens an accepted fixture assessment when its reviewed notice changes', () => {
  const input = fixture();
  const code = keys[0]!;
  const registry = structuredClone(section15Registry);
  registry[code]!.notice += ' Fixture-only changed notice.';
  expect(assessWithUnclearedHolds({ ...input, registry })).toMatchObject({
    passed: true,
    admitted: [],
    held: [
      {
        externalKey: 'fixture/notice-266',
        reason: expect.stringContaining('Notice bindings require re-review:'),
      },
    ],
  });
});

it('keeps full book chains and pre-existing unreviewed seeds outstanding', () => {
  expect(
    review.holds
      .filter((hold) => hold.id.startsWith('notice-266-complete-chain-'))
      .map((hold) => hold.noticeKey),
  ).toEqual(keys);
  expect(new Set(review.holds.map((hold) => hold.id)).size).toBe(15);
  for (const hold of review.holds) {
    expect(hold.status).toBe('held');
    expect(
      resolveNotice({ registry: section15Registry, code: hold.title }),
    ).toBeUndefined();
  }
  const bookTitles = [...new Set(review.holds.map((hold) => hold.title))];
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
        externalKey: 'fixture/notice-266',
        missingNotices: expect.arrayContaining(gateMissing),
      },
    ],
  });
});

it.each(['missing', 'unreviewed'] as const)(
  'holds an entry when one batch notice becomes %s',
  (state) => {
    const input = fixture();
    const code = keys[0]!;
    const registry = structuredClone(section15Registry);
    if (state === 'missing') delete registry[code];
    else registry[code]!.reviewStatus = 'unreviewed';
    expect(assessWithUnclearedHolds({ ...input, registry })).toMatchObject({
      passed: true,
      admitted: [],
      held: [{ externalKey: 'fixture/notice-266', missingNotices: [code] }],
      failures: [],
    });
    const page = buildLegalPageData({
      registry,
      resources: legalResources,
      permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
      requiredNotices: keys,
    });
    expect(page.outstandingNotices).toEqual([
      {
        code,
        title: state === 'missing' ? code : registry[code]!.title,
        reason: state,
      },
    ]);
  },
);

it.each(review.blocks)(
  'enforces the unresolved chain hold for $key independently',
  (block) => {
    const result = assessWithUnclearedHolds(fixture([block.key]));
    expect(result).toMatchObject({
      passed: true,
      admitted: [],
      held: [
        {
          requiredNotices: [block.key],
          missingNotices: [],
          reason: `Notice holds: ${block.key} (notice-266-complete-chain-${block.textSha256}).`,
        },
      ],
      failures: [],
    });
  },
);

it('keeps Dark Creeper and Dark Stalker 2002 and Complete 2011 wording distinct', () => {
  for (const [complete, older] of [
    [0, 1],
    [2, 3],
  ]) {
    const completeNotice = section15Registry[keys[complete!]!]!;
    const olderNotice = section15Registry[keys[older!]!]!;
    expect(completeNotice.notice).toContain('Tome of Horrors Complete © 2011');
    expect(olderNotice.notice).toContain('Tome of Horrors, © 2002');
    expect(olderNotice.notice).not.toContain('Revised');
    expect(olderNotice.notice).not.toContain('Frog God Games');
    expect(completeNotice.notice).toContain('Frog God Games');
    expect(completeNotice).not.toEqual(olderNotice);
    expect(completeNotice.aliases).toEqual([]);
    expect(olderNotice.aliases).toEqual([]);
    expect(review.comparisons).toContainEqual(
      expect.objectContaining({
        noticeKeys: [keys[complete!], keys[older!]],
        source: 'pf1-content',
      }),
    );
  }
  for (const index of [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]) {
    expect(section15Registry[keys[index]!]!.notice).toContain(
      'Complete © 2011',
    );
  }
  expect(section15Registry[keys[4]!]!.notice).toContain(
    'Author: Scott Greene and Erica Balsley.',
  );
  expect(section15Registry[keys[13]!]!.notice).toContain(
    'Author: Scott Greene and Clark Peterson, based on material by Gary Gygax.',
  );
});

it('records owner Jubilex and Pazuzu wording differences without changing the Bestiary 6 seed', () => {
  const owner = section15Registry.PZO1137!;
  const ownerLines = owner.notice.split('\n');
  expect(owner.reviewStatus).toBe('unreviewed');
  expect(owner.checkedAgainst).toBe('owner-transcription');
  for (const [index, creature] of [
    [11, 'Jubilex'],
    [14, 'Pazuzu'],
  ] as const) {
    const notice = section15Registry[keys[index]!]!;
    const comparison = review.comparisons.find(
      (item) => 'noticeKey' in item && item.noticeKey === keys[index],
    );
    expect(notice.notice).toContain(`Demon Lord, ${creature} from`);
    expect(notice.notice).toContain('based on material by Gary Gygax.');
    expect(notice.aliases).toEqual([]);
    expect(ownerLines).not.toContain(notice.notice);
    expect(comparison).toMatchObject({
      registryKey: 'PZO1137',
      evidence:
        'https://github.com/AndreasUnunger/EverythingPath/issues/227#issuecomment-5948776405',
    });
    if (!comparison || !('ownerNotice' in comparison)) {
      throw new Error(`Missing owner comparison for ${creature}`);
    }
    expect(ownerLines).toContain(comparison.ownerNotice);
    expect(comparison.ownerNotice).toContain(`${creature} from`);
    expect(comparison.ownerNotice).toContain(
      'based on original material by Gary Gygax.',
    );
    expect(sha256(comparison.ownerNotice!)).toBe(comparison.ownerTextSha256);
  }
  expect(
    keys.some((key) => ownerLines.includes(section15Registry[key]!.notice)),
  ).toBe(false);
  expect(resolveNotice({ registry: section15Registry, code: 'PZO1137' })).toBe(
    owner,
  );
});
