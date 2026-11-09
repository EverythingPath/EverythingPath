// @vitest-environment node
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import review from '../../scripts/catalog/legal/inherited-notices-272.json';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import {
  buildAssessmentBinding,
  type AdmissionSource,
} from '../../scripts/catalog/admission';
import type { PreviewEntry } from '../../scripts/catalog/map';
import type { AttributionAssessment } from '../../src/lib/catalog/admission-schema';
import { buildLegalPageData } from '../../src/lib/catalog/legal-page-data';
import {
  createNoticeIndex,
  resolveNotice,
} from '../../src/lib/catalog/resolve-notice';
import {
  legalResources,
  section15Registry,
} from '../../src/lib/catalog/section15-registry-data';
import { assessWithUnclearedHolds } from './uncleared-holds';

const hashes = [
  'cb04529aa1489db358db149711d6ada6283266eb353a872fce47934a3c59b29e',
  '2733e0969fab80e61419c16a05eb2c31a54209109893bcee408dd6bf27f6bf86',
  '83b00be92c3ecc0298d5f6625bb125dc1ad3f0894b386b2cb97fcbb0de6d662d',
  'a0bcdbb817209409d10dfe1570096e59f63f3fd0ea99ee128043c52f248f1856',
  '19ed469a1a0f7003f9cebccfbc08da74f0cddff06073b089c323e35fab63952d',
  '6abe598ab65762f889b5984a12db7eb0a08d71fce3501c0759a75e57686ba357',
  '68711b05df2821a5c7725fe5170e4ea19cf56f3c405cae73b33464c91db55baa',
  'af13e0ae426d215e524bad25567313ee92643ff57ee0d7861204be65896edb49',
  '38d926e5478989a9c856370d1e17591b862d5635b9cbc73c6026c962d6cb5f57',
  'c3df64ce88736da48b8b7a70ba28fb7644da1baae0dc7fe80ae6e025abd86faf',
  '949901ef11212c6b63c16d20414cb85c23eee32a240a212c93db27ca7d2ef80b',
  '69eae546ffdd292785147507e93d6b36bb41c3d94566e9c021432bb7e7cf848b',
  '020865e24056a468f6733c89d5b8ad36b7acee8b9deae710dc6be7e1effc28b4',
  '26abbbcb6e8c5a8713f148d3e838fcbfcfd7411cc9ad67eea06f8cfb60dc50b6',
];
const keys = hashes.map((hash) => `pf1-content/notice/${hash}`);
const reviewer = 'Sol (AI curator) for the owner';

function sha256(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

function fixture(requiredNotices = keys) {
  const entry: PreviewEntry = {
    externalKey: 'fixture/notice-272',
    upstreamKey: 'fixture/notice-272',
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
          path: 'notice-272.yaml',
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

it('binds all 14 unique immutable blocks to complete verbatim notices at the pinned lines', () => {
  expect(review.blocks.map((block) => block.key)).toEqual(keys);
  expect(review.blocks.map((block) => block.line)).toEqual([
    158, 159, 160, 161, 162, 163, 164, 166, 167, 168, 169, 170, 171, 172,
  ]);
  expect(review).toMatchObject({
    reviewedBy: reviewer,
    reviewedOn: '2026-10-08',
    checkedAgainst: 'pf1-content',
    sources: {
      pf1: {
        tag: 'v11.11',
        commit: '418761d2e16a6037c0156bb4a241f7cea5a2986d',
        fileSha256:
          '0464e2f13f24c742dc3c2a4c788aab9ab24ca9809873192551b77f784a50d7f9',
      },
      'pf1-content': {
        tag: '11.4.0',
        commit: '02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d',
        fileSha256:
          '10bcdc68296b48cc250f38e49de09c9a73645163d7ac7f76e77346a755c35cdc',
      },
    },
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
      expect(notice.aliases).toEqual([]);
    }
  }
});

it('publishes 14 reviewed notices for 15 inventory occurrences and retains every historic notice version', () => {
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
  ).toHaveLength(14);
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
          externalKey: 'fixture/notice-272',
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
        externalKey: 'fixture/notice-272',
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
    admitted: [{ externalKey: 'fixture/notice-272', requiredNotices: [code] }],
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
        externalKey: 'fixture/notice-272',
        reason: expect.stringContaining('Notice bindings require re-review:'),
      },
    ],
  });
});

it('keeps full book chains and pre-existing unreviewed seeds outstanding', () => {
  expect(
    review.holds
      .filter((hold) => hold.id.startsWith('notice-272-complete-chain-'))
      .map((hold) => hold.noticeKey),
  ).toEqual(keys);
  expect(new Set(review.holds.map((hold) => hold.id)).size).toBe(14);
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
        externalKey: 'fixture/notice-272',
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
      held: [{ externalKey: 'fixture/notice-272', missingNotices: [code] }],
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

// The committed Registry's notice index, built once: resolving each held
// code against a rebuilt index made these rows the file's slowest work.
const registryNotices = createNoticeIndex({ registry: section15Registry });

it.each(review.blocks)(
  'enforces the unresolved chain hold for $key independently',
  (block) => {
    const result = assessWithUnclearedHolds(fixture([block.key]));
    const notice = resolveNotice({
      registry: section15Registry,
      code: block.key,
    });
    expect(notice).toBeDefined();
    const registeredHolds = heldNotices
      .filter((hold) =>
        hold.notices.some(
          (code) =>
            resolveNotice({
              registry: section15Registry,
              code,
              index: registryNotices,
            }) === notice,
        ),
      )
      .map((hold) => hold.id)
      .sort();
    expect(registeredHolds).toEqual(
      expect.arrayContaining(
        review.holds
          .filter((hold) => hold.noticeKey === block.key)
          .map((hold) => hold.id),
      ),
    );
    expect(result).toMatchObject({
      passed: true,
      admitted: [],
      held: [
        {
          requiredNotices: [block.key],
          missingNotices: [],
          reason: `Notice holds: ${block.key} (${registeredHolds.join(', ')}).`,
        },
      ],
      failures: [],
    });
  },
);

it('accounts for the repeated ticket key without reviewing the unlisted trailing-space variant', () => {
  const ticketKeys = [...keys.slice(0, 7), keys[6]!, ...keys.slice(7)];
  expect(review.inventoryOccurrences.map((item) => item.key)).toEqual(
    ticketKeys,
  );
  expect(review.inventoryOccurrences.map((item) => item.occurrence)).toEqual(
    Array.from({ length: 15 }, (_, index) => index + 1),
  );
  expect(review.inventoryOccurrences.map((item) => item.line)).toEqual([
    158, 159, 160, 161, 162, 163, 164, 164, 166, 167, 168, 169, 170, 171, 172,
  ]);
  expect(
    review.inventoryOccurrences.filter(
      (item) => item.duplicateOccurrenceOf !== null,
    ),
  ).toEqual([
    expect.objectContaining({
      occurrence: 8,
      duplicateOccurrenceOf: 7,
      key: keys[6],
      line: 164,
    }),
  ]);
  expect(new Set(ticketKeys).size).toBe(14);
  const upstream = legalResources.upstreamNotices.find(
    (notice) => notice.id === 'pf1-content',
  );
  if (!upstream) throw new Error('Missing pinned content legal resource');
  const lines = (legalResources.ogl.text + upstream.text).split('\n');
  const unlistedHash =
    'decea4c7db268f8c43acf0d5373c72207cf78edbe2852e114dc0eb458f9c517e';
  const unlistedKey = `pf1-content/notice/${unlistedHash}`;
  expect(lines[164]).toBe(lines[163] + ' ');
  expect(sha256(lines[164]!)).toBe(unlistedHash);
  expect(keys).not.toContain(unlistedKey);
  expect(section15Registry[unlistedKey]).toBeUndefined();
  expect(
    resolveNotice({ registry: section15Registry, code: unlistedKey }),
  ).toBeUndefined();
  expect(review.comparisons).toContainEqual(
    expect.objectContaining({
      noticeKeys: [keys[6]],
      lines: [164, 165],
      unlistedKey,
      unlistedTextSha256: unlistedHash,
    }),
  );
  const page = buildLegalPageData({
    registry: section15Registry,
    resources: legalResources,
    permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
    requiredNotices: ticketKeys,
  });
  expect(
    page.permanentNoticeSuperset.filter((notice) =>
      notice.id.startsWith('registry:'),
    ),
  ).toHaveLength(14);
  expect(
    sha256(
      page.permanentNoticeSuperset.find(
        (notice) => notice.id === 'pf1-content',
      )!.text,
    ),
  ).toBe(sha256(upstream.text));
});

it('retains literal author labels, punctuation, years and distinct notice versions', () => {
  expect(section15Registry[keys[0]!]!.notice).toContain(
    '; Authors Scott Greene and Clark Peterson,',
  );
  expect(section15Registry[keys[2]!]!.notice).toContain(
    'Tome of Horrors Revised.© 2002,',
  );
  expect(section15Registry[keys[4]!]!.notice).toContain(
    'Tome of Horrors III. © 2005,',
  );
  expect(section15Registry[keys[9]!]!.notice).toContain(
    'Tome of Horrors Revised, Copyright 2002, Necromancer Games, Inc.; Author Scott Greene,',
  );
  expect(section15Registry[keys[10]!]!.notice).toContain(
    'Monster Codex © 2014, Paizo Inc.;',
  );
  expect(section15Registry[keys[13]!]!.notice).toContain(
    'Mythic Adventures, © 2013, Paizo Publishing, LLC;',
  );
  for (const [completeIndex, earlierIndex] of [
    [6, 7],
    [8, 9],
  ] as const) {
    const complete = section15Registry[keys[completeIndex]!]!;
    const earlier = section15Registry[keys[earlierIndex]!]!;
    expect(complete.notice).toContain('Tome of Horrors Complete © 2011,');
    expect(earlier.notice).toContain('2002,');
    expect(earlier.notice).not.toBe(complete.notice);
    expect(complete.aliases).toEqual([]);
    expect(earlier.aliases).toEqual([]);
  }
});
