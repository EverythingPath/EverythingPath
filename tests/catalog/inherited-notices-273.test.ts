// @vitest-environment node
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import review from '../../scripts/catalog/legal/inherited-notices-273.json';
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
  'e048bab1df07422c36d88b2654b6a51c8f519045bcf621485b068cc528d86972',
  '98e86dfc16e02e74ba30044b189c6255977fe13e9c0764dc350784a52c7b189d',
  '2815e93bcd5ec731b1d83c173132bcdbe2ac14d32bb22af876970840b96ba023',
  'e63877d6dc61be13e1bd8a8098cb94760077d4ef105382b8be3fbf494cfdc0bc',
  'f9daf2676c40b03ac409ffa56c536e74cb2f0d054ca635d70cc05b6ae4e1769f',
  'df82f1118fa102331239e931709355a81f388e315c13c027165c809fb06865b3',
  '08f23ff627bf6ff6ee5c34e352141affabab0f8a56d75a65904dbdd6061c875d',
  '0c072724405a2edcea7b05433415fd9ad67a3a0351acf5c7b26c0b182a83e99f',
  'a92d5ac27cccaf9241dc007f053e7240c295270f7cdcd501f48ffb4f6781f0e8',
  '673b5cff0bc8e3e42ef837c56c3aba46d9f91e41739560afddf26c3f646cbecc',
  'cccff64c0fd16d448c11423ff537fcf023361c45ca4117407330adba83cc3b62',
  '68606833adc7b794952fc595cc5686d2b57749256f4948a66f01716e0babcae2',
  'e7c6621f0120434da04af07133c50e3fb4941ec055f250d3e7d58f6bd87cb655',
  '403dce2559fa4e4cb82c1475b14cf00fc8be3f79441985051762ab1d67b9b246',
  '44bdcdb8897cecda3ad945cafb6f7e049b470d045464b14181645c8f8a660665',
];
const keys = hashes.map((hash) => `pf1-content/notice/${hash}`);
const reviewer = 'Sol (AI curator) for the owner';

function sha256(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

function fixture(requiredNotices = keys) {
  const entry: PreviewEntry = {
    externalKey: 'fixture/notice-273',
    upstreamKey: 'fixture/notice-273',
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
          path: 'notice-273.yaml',
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
    173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187,
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
      expect(notice.provenance).toContain(
        `${source.repository}/OGL.txt:${block.line}; tag ${source.tag}; commit ${source.commit}; file sha256:${source.fileSha256}; line sha256:${block.textSha256}`,
      );
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
          externalKey: 'fixture/notice-273',
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
        externalKey: 'fixture/notice-273',
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
    admitted: [{ externalKey: 'fixture/notice-273', requiredNotices: [code] }],
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
        externalKey: 'fixture/notice-273',
        reason: expect.stringContaining('Notice bindings require re-review:'),
      },
    ],
  });
});

it('keeps full book chains and pre-existing unreviewed seeds outstanding', () => {
  expect(
    review.holds
      .filter((hold) => hold.id.startsWith('notice-273-complete-chain-'))
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
        externalKey: 'fixture/notice-273',
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
      held: [{ externalKey: 'fixture/notice-273', missingNotices: [code] }],
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
    expect(holds[0]?.id).toBe(`notice-273-complete-chain-${block.textSha256}`);
    const result = assessWithUnclearedHolds(fixture([block.key]));
    expect(result).toMatchObject({
      passed: true,
      admitted: [],
      held: [
        {
          requiredNotices: [block.key],
          missingNotices: [],
          // Other batches may independently hold the same Registry notice.
          reason: expect.stringContaining(
            `notice-273-complete-chain-${block.textSha256}`,
          ),
        },
      ],
      failures: [],
    });
  },
);

it('preserves all three conflicting Nabasu contributor variants without correction or aliases', () => {
  const notices = keys.slice(0, 3).map((key) => section15Registry[key]!);
  expect(notices.map((notice) => notice.notice)).toEqual([
    'Nabasu Demon from the Tome of Horrors, Revised. © 2002, Necromancer Games, Inc.; Author: Scott Greene, based on original material by Neville White.',
    'Nabasu Demon from the Tome of Horrors, © 2002, Necromancer Games, Inc.; Author: Scott Greene, based on original material by Gary Gygax.',
    'Nabasu from the Tome of Horrors Revised.© 2002, Necromancer Games, Inc.; Author: Scott Greene and Clark Peterson, based on original material by Gary Gygax.',
  ]);
  expect(new Set(notices).size).toBe(3);
  const comparison = review.comparisons.find(
    (item) => item.lines?.join(',') === '173,174,175',
  );
  expect(comparison).toMatchObject({
    noticeKeys: keys.slice(0, 3),
    source: 'pf1-content',
    lines: [173, 174, 175],
    result: expect.stringContaining(
      'comparison against a permitted complete book notice chain remains unresolved',
    ),
  });
  for (const key of keys.slice(0, 3)) {
    const hold = review.holds.find((item) => item.noticeKey === key)!;
    expect(hold.reason).toContain('Neville White');
    expect(hold.reason).toContain('Gary Gygax');
    expect(hold.reason).toContain('Scott Greene and Clark Peterson');
    expect(hold.reason).toContain('remains unresolved');
    expect(hold.evidence).toEqual(
      [173, 174, 175].map(
        (line) => `${review.sources['pf1-content'].url}#L${line}`,
      ),
    );
    expect(hold.missingEvidence).toContain('resolving the differing Nabasu');
  }
});

it('preserves literal punctuation and limits the book and blog notices to their source wording', () => {
  for (const index of [2, 8]) {
    expect(section15Registry[keys[index]!]!.notice).toContain('Revised.© 2002');
  }
  expect(section15Registry[keys[7]!]!.notice).toContain(
    'Author Casey Christofferson.',
  );
  expect(section15Registry[keys[5]!]!.notice).toContain(
    'Occult Adventures © 2015, Paizo Inc.;',
  );
  expect(section15Registry[keys[9]!]!.notice).toBe(
    'Paizo Blog. Copyright 2010–2011, Paizo Publishing, LLC; Author: Paizo Publishing, LLC, or as credited in individual blog entries.',
  );
  expect(keys.slice(10).map((key) => section15Registry[key]!.title)).toEqual([
    'Pathfinder 10: A History of Ashes',
    'Pathfinder 11: Skeletons of Scarwall',
    'Pathfinder 12: Crown of Fangs',
    'Pathfinder 13: Shadow in the Sky',
    'Pathfinder 14: Children of the Void',
  ]);
  for (const key of keys.slice(10)) {
    expect(section15Registry[key]!.notice).toContain(
      'Copyright 2008, Paizo Publishing, LLC; Author:',
    );
  }
  expect(review.retainedExceptions).toEqual([]);
});
