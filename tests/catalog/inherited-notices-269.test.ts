// @vitest-environment node
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import review from '../../scripts/catalog/legal/inherited-notices-269.json';
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
  'da43f7ee1d631cd95c7997f060773ec93c9690d96ece78d392c424af42f9bda3',
  '1dc3043a78e8f334f2ff4a79be5eb4ac477849b911660f244baa9fc91482daaa',
  'e8e581b3238881d874a7862b813514dfda579644f410c09f110651c615f024fa',
  '06cc1b7cb9b683b23d5c0b2165ad3e71b74fda1b20ce67480e6c151f22f38360',
  '72f6dcdcf1b2847b359b977d54c98f7cd61b7cf373d890280799fca38aa942fe',
  'c9b74fa75a606018e3d759d32cabfe5574fc9c4e32a69e9d76154b9080436d94',
  '0027ac7a6eab711fcc08a3b54e0dff3d4177cf5b5aa3426452bf24cc4b36e2b1',
  'fd3652072821808c884700a63fc2dbf11f5266d21f3708d5576a76476e54f504',
  'ed1eb5ec406f1b640879d17931b9818f75241d65c6ef01b10bd1b8a7e7c6235c',
  'a0a095b88ad5c57f6f16768db33464dd05bc4bff8493165e2ca09c43cd1a0945',
  '4aeeee43611edb079730d4954e44c09a259bdb90646d51e501fda7f74f80f1ab',
  '5ad2a5d682d740a8b3a94613e4ebfd2ebd0a06d78edcb0808aac708a9b8e5745',
  'ebc202ffd900e2e63b138379850a2bcd04fdfc4089aa2a9b8d20fc228022841b',
  '36f8b50b5cf152e6d98b0f226aa48eba478ae18f9972596ca6aeb7be3f086e3e',
];
const keys = hashes.map((hash) => `pf1-content/notice/${hash}`);
const reviewer = 'Sol (AI curator) for the owner';

function sha256(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

function fixture(requiredNotices = keys) {
  const entry: PreviewEntry = {
    externalKey: 'fixture/notice-269',
    upstreamKey: 'fixture/notice-269',
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
          path: 'notice-269.yaml',
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

it('binds all 14 unique immutable blocks to complete verbatim notices at the pinned lines', () => {
  expect(review.blocks.map((block) => block.key)).toEqual(keys);
  expect(review.blocks.map((block) => block.line)).toEqual([
    113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 127,
  ]);
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
          externalKey: 'fixture/notice-269',
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
        externalKey: 'fixture/notice-269',
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
    admitted: [{ externalKey: 'fixture/notice-269', requiredNotices: [code] }],
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
        externalKey: 'fixture/notice-269',
        reason: expect.stringContaining('Notice bindings require re-review:'),
      },
    ],
  });
});

it('keeps full book chains and pre-existing unreviewed seeds outstanding', () => {
  expect(
    review.holds
      .filter((hold) => hold.id.startsWith('notice-269-complete-chain-'))
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
        externalKey: 'fixture/notice-269',
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
      held: [{ externalKey: 'fixture/notice-269', missingNotices: [code] }],
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
          reason: `Notice holds: ${block.key} (${review.holds
            .filter((hold) => hold.noticeKey === block.key)
            .map((hold) => hold.id)
            .sort()
            .join(', ')}).`,
        },
      ],
      failures: [],
    });
  },
);

it('accounts for the repeated ticket key without reviewing the unlisted trailing-space variant', () => {
  const ticketKeys = [...keys.slice(0, 13), keys[12]!, keys[13]!];
  expect(review.inventoryOccurrences.map((item) => item.key)).toEqual(
    ticketKeys,
  );
  expect(review.inventoryOccurrences.map((item) => item.occurrence)).toEqual(
    Array.from({ length: 15 }, (_, index) => index + 1),
  );
  expect(
    review.inventoryOccurrences.filter(
      (item) => item.duplicateOccurrenceOf !== null,
    ),
  ).toEqual([
    expect.objectContaining({
      occurrence: 14,
      duplicateOccurrenceOf: 13,
      key: keys[12],
      line: 125,
    }),
  ]);
  expect(new Set(ticketKeys).size).toBe(14);
  const upstream = legalResources.upstreamNotices.find(
    (notice) => notice.id === 'pf1-content',
  );
  if (!upstream) throw new Error('Missing pinned content legal resource');
  const lines = (legalResources.ogl.text + upstream.text).split('\n');
  const unlistedHash =
    'aa0530016c2222f300be698f8f81d3176fcbc52362544f3611e3325e15ee61f1';
  const unlistedKey = `pf1-content/notice/${unlistedHash}`;
  expect(lines[125]).toBe(lines[124] + ' ');
  expect(sha256(lines[125]!)).toBe(unlistedHash);
  expect(keys).not.toContain(unlistedKey);
  expect(section15Registry[unlistedKey]).toBeUndefined();
  expect(
    resolveNotice({ registry: section15Registry, code: unlistedKey }),
  ).toBeUndefined();
  expect(review.comparisons).toContainEqual(
    expect.objectContaining({
      noticeKey: keys[12],
      lines: [125, 126],
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

it('retains exact module wording, the Geon author label and distinct Giant Slug punctuation', () => {
  expect(section15Registry[keys[0]!]!.notice).toContain(
    'The Demon Within. Copyright 2008, Paizo Publishing, LLC. Authors: Stephen S. Greer and Tim Hitchcock.',
  );
  expect(section15Registry[keys[1]!]!.notice).toContain(
    'Carnival of Tears, Copyright 2007 Paizo Publishing, LLC.',
  );
  expect(section15Registry[keys[3]!]!.notice).toContain(
    'Author: Anson Caralya.',
  );
  expect(section15Registry[keys[8]!]!.notice).toContain(
    'Conquest Of Bloodsworn Vale. Copyright 2007, Paizo Publishing, LLC; Author: Greg A. Vaughan.',
  );
  expect(section15Registry[keys[9]!]!.notice).toContain('River Into Darkness.');
  expect(section15Registry[keys[11]!]!.notice).toContain(
    '; Author Scott Greene and Clark Peterson.',
  );
  const slug = section15Registry[keys[12]!]!;
  const commaSlug = section15Registry[keys[13]!]!;
  expect(slug.notice).toContain('Tome of Horrors © 2002');
  expect(commaSlug.notice).toContain('Tome of Horrors, © 2002');
  expect(commaSlug.notice).toBe(
    slug.notice.replace('Tome of Horrors ©', 'Tome of Horrors, ©'),
  );
  expect(slug.aliases).toEqual([]);
  expect(commaSlug.aliases).toEqual([]);
  expect(review.comparisons).toContainEqual(
    expect.objectContaining({
      noticeKeys: [keys[12], keys[13]],
      source: 'pf1-content',
      lines: [125, 127],
    }),
  );
});
