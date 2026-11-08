// @vitest-environment node
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import review from '../../scripts/catalog/legal/inherited-notices-270.json';
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
  'ed3df54e6c728b8053a970e49489547cea4f6483d18043078691393a3e407ffb',
  '066b62b9527cbf2e259c607f280516f1575911ac6ff0dfe27b85396f9821086d',
  'eedc493e0987b2c4908ef340fbb1cf2cd506be7f849f058dad9a3c687880fa49',
  '5c7e7fd3f7f6f075d01f0e0b3dedb080484041e53e11b8ffa7e4a1cca34d9cd5',
  '26da0efc9d65cb318ff7bf98b2a3855253e8529e2ed26273440fa7b3212369d9',
  'e95c17a3ed6b9531f71fb96ff2e70685202f1067109ca7ea91c8c9ccb5a5fdc2',
  'fc6ef4ace36e0b649c6b475fc32d3b9df92cec2cd72abf48b39a665d2c7486a3',
  '936cc2c59b874f743ab7df3cdb8aa7156077c976ef912aafb183ec4d9202cfd1',
  '9c410359f5d51f5d27e43ff11497886dcc1da63551d3b2570704c94439cfd14b',
  '3ceb4b451b688536261309c47dc78c304e40878eaeacd745ec3a1ca8eabffa82',
  'cbbc41de636e2958e3b481d5465bb5a853d46596a5edb4b3eb1cfaf8ed04b646',
  '8e78afdd9a9dfdb05e2bbe6a06939e0b422c22c3a02706fecdfea71575635c1b',
  '939759a38800f19789eaf54f31c61402440c69a75330be1a780dd06133fd8a22',
  '2140005042901c10f44c281ce2b5e85740ed35b0f92771f2f64dfcc52cf7bd81',
  '113a416896c13ee93ce260c01a6054007e14a87545835976a41ae2ba5624ba49',
];
const keys = hashes.map((hash) => `pf1-content/notice/${hash}`);
const reviewer = 'Sol (AI curator) for the owner';

function sha256(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

function fixture(requiredNotices = keys) {
  const entry: PreviewEntry = {
    externalKey: 'fixture/notice-270',
    upstreamKey: 'fixture/notice-270',
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
          path: 'notice-270.yaml',
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
      reviewedOn: '2026-10-08',
    },
  ];
  return { artifact, evidence, assessments, registry: section15Registry };
}

it('binds all 15 unique immutable blocks to complete verbatim notices at the pinned lines', () => {
  expect(review.blocks.map((block) => block.key)).toEqual(keys);
  expect(new Set(keys).size).toBe(15);
  expect(review.blocks.map((block) => block.line)).toEqual([
    128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142,
  ]);
  expect(review).toMatchObject({
    reviewedBy: reviewer,
    reviewedOn: '2026-10-08',
    checkedAgainst: 'pf1-content',
  });
  expect(review.sources.pf1).toMatchObject({
    commit: '418761d2e16a6037c0156bb4a241f7cea5a2986d',
    tag: 'v11.11',
    fileSha256:
      '0464e2f13f24c742dc3c2a4c788aab9ab24ca9809873192551b77f784a50d7f9',
  });
  expect(review.sources['pf1-content']).toMatchObject({
    commit: '02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d',
    tag: '11.4.0',
    fileSha256:
      '10bcdc68296b48cc250f38e49de09c9a73645163d7ac7f76e77346a755c35cdc',
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
        checkedOn: '2026-10-08',
        reviewStatus: 'reviewed',
      });
      expect(notice.provenance).toContain(
        `Reviewed by ${reviewer} on 2026-10-08.`,
      );
      expect(notice.provenance).toContain(`${source.url}#L${block.line}`);
      expect(notice).toBe(section15Registry[block.registryKey]);
      expect(block.registryKey).toBe(block.key);
      expect(notice.aliases).toEqual([]);
    }
  }
});

it('publishes all 15 reviewed notices and retains every historic notice version', () => {
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
          externalKey: 'fixture/notice-270',
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
        externalKey: 'fixture/notice-270',
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

it('admits an independently assessed fixture requiring an unheld reviewed notice', () => {
  const code =
    'pf1-content/notice/0a956582f65e71fe2fe52f61c946a781aa11bb0b960476b451933295aa70bd3c';
  expect(assessWithUnclearedHolds(fixture([code]))).toMatchObject({
    passed: true,
    admitted: [{ externalKey: 'fixture/notice-270', requiredNotices: [code] }],
    held: [],
    failures: [],
  });
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
        externalKey: 'fixture/notice-270',
        reason: expect.stringContaining('Notice bindings require re-review:'),
      },
    ],
  });
});

it('keeps full book chains and pre-existing unreviewed seeds outstanding', () => {
  expect(
    review.holds
      .filter((hold) => hold.id.startsWith('notice-270-complete-chain-'))
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
        externalKey: 'fixture/notice-270',
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
      held: [{ externalKey: 'fixture/notice-270', missingNotices: [code] }],
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
    const holds = review.holds.filter((hold) => hold.noticeKey === block.key);
    expect(holds).toHaveLength(1);
    expect(holds[0]?.id).toBe(`notice-270-complete-chain-${block.textSha256}`);
    const result = assessWithUnclearedHolds(fixture([block.key]));
    expect(result).toMatchObject({
      passed: true,
      admitted: [],
      held: [
        {
          requiredNotices: [block.key],
          missingNotices: [],
          // Later batches may independently hold this same notice. This
          // batch's original hold must still enforce the gate.
          reason: expect.stringContaining(holds[0]!.id),
        },
      ],
      failures: [],
    });
  },
);

it('keeps the Complete and Revised Gryph editions as distinct notices without aliases', () => {
  const complete = section15Registry[keys[6]!]!;
  const revised = section15Registry[keys[7]!]!;
  expect(complete.notice).toContain('Tome of Horrors Complete © 2011');
  expect(complete.notice).toContain(
    'published and distributed by Frog God Games;',
  );
  expect(revised.notice).toContain('Tome of Horrors, Revised © 2002');
  expect(revised.notice).not.toContain('Frog God Games');
  for (const notice of [complete, revised]) {
    expect(notice.notice).toContain(
      'Author: Scott Greene, based on original material by Peter Brown.',
    );
    expect(notice.aliases).toEqual([]);
  }
  expect(complete).not.toBe(revised);
  expect(review.comparisons).toContainEqual(
    expect.objectContaining({
      noticeKeys: [keys[6], keys[7]],
      source: 'pf1-content',
      lines: [134, 135],
    }),
  );
  const page = buildLegalPageData({
    registry: section15Registry,
    resources: legalResources,
    permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
    requiredNotices: [keys[6]!, keys[7]!],
  });
  expect(
    page.permanentNoticeSuperset
      .filter((notice) => notice.id.startsWith('registry:'))
      .map((notice) => notice.text),
  ).toEqual(expect.arrayContaining([complete.notice, revised.notice]));
});

it('limits the Society Guide notice to the literal v2.2 edition', () => {
  const code = keys[9]!;
  const notice = section15Registry[code]!;
  expect(notice.title).toBe('Guide to Pathfinder Society Organized Play v2.2');
  expect(notice.notice).toBe(
    'Guide to Pathfinder Society Organized Play v2.2. Copyright 2010, Paizo Publishing, LLC; Author: Joshua J. Frost.',
  );
  for (const broaderTitle of [
    'Guide to Pathfinder Society Organized Play',
    'Pathfinder Society Roleplaying Guild Guide',
    'Guide to Pathfinder Society Organized Play v3.0',
  ]) {
    expect(
      resolveNotice({ registry: section15Registry, code: broaderTitle }),
    ).toBeUndefined();
    expect(assessWithUnclearedHolds(fixture([broaderTitle]))).toMatchObject({
      admitted: [],
      held: [{ missingNotices: [broaderTitle] }],
    });
  }
});

it('preserves the Wood Giant author discrepancy without promoting the Bestiary 6 owner seed', () => {
  const inherited = section15Registry[keys[0]!]!;
  const owner = section15Registry.PZO1137!;
  const ownerLine = owner.notice
    .split('\n')
    .find((line) => line.startsWith('Giant, Wood from'));
  expect(inherited.notice).toContain('Authors: Scott Greene,');
  expect(ownerLine).toBe(
    inherited.notice.replace('Authors: Scott Greene,', 'Author: Scott Greene,'),
  );
  expect(owner).toMatchObject({
    checkedAgainst: 'owner-transcription',
    reviewStatus: 'unreviewed',
  });
  expect(inherited.aliases).not.toContain('PZO1137');
  for (const index of [6, 13]) {
    expect(owner.notice.split('\n')).toContain(
      section15Registry[keys[index]!]!.notice,
    );
    expect(section15Registry[keys[index]!]!.aliases).not.toContain('PZO1137');
  }
  expect(assessWithUnclearedHolds(fixture(['PZO1137']))).toMatchObject({
    admitted: [],
    held: [{ missingNotices: ['PZO1137'] }],
  });
  const page = buildLegalPageData({
    registry: section15Registry,
    resources: legalResources,
    permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
    requiredNotices: [...keys, 'PZO1137'],
  });
  expect(page.outstandingNotices).toEqual([
    { code: 'PZO1137', title: owner.title, reason: 'unreviewed' },
  ]);
  expect(page.permanentNoticeSuperset).not.toContainEqual(
    expect.objectContaining({ id: 'registry:PZO1137' }),
  );
});

it('retains literal author labels, dates, contributor names and punctuation', () => {
  expect(section15Registry[keys[2]!]!.notice).toBe(
    'Gods and Magic. Copyright 2008, Paizo Publishing, LLC; Author: Sean K Reynolds.',
  );
  expect(section15Registry[keys[3]!]!.notice).toContain(
    'Authors: Scott Greene and Patrick Lawinger.',
  );
  expect(section15Registry[keys[4]!]!.notice).toContain(
    'Tome of Horrors Complete, Copyright 2011',
  );
  expect(section15Registry[keys[4]!]!.notice).toContain('Author Scott Greene.');
  expect(section15Registry[keys[8]!]!.notice).toBe(
    'Guide to Korvosa. Copyright 2008, Paizo Publishing, LLC; Author: Mike McArtor.',
  );
  expect(section15Registry[keys[11]!]!.notice).toContain(
    'Authors: Scott Greene and Erica Balsley, based on original material by Gary Gygax.',
  );
  expect(section15Registry[keys[12]!]!.notice).toContain(
    'Horror Adventures © 2016, Paizo Inc.; Authors:',
  );
  expect(section15Registry[keys[13]!]!.notice).toContain(
    'based on original material by Underworld Oracle.',
  );
  expect(section15Registry[keys[14]!]!.notice).toContain(
    '; Author: Scott Greene.',
  );
});
