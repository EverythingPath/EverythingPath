// @vitest-environment node
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import review from '../../scripts/catalog/legal/inherited-notices-267.json';
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
  '672f0dc547d8e32e6a7b99f56ac21f982e127cacf2928d07d18a9dd0d877f623',
  'c28f6d0d1cbfe16157f0efdfc4de6b988231ce2171067e27ab3d266a908f3150',
  '0d2e3da7b3e76903a76c928f2e3a968a3f5b66f1e8ec9af72acb56aa8162a283',
  'b87a76956c50a742e297c3bf33098f7b4dce2a955c1cb31629e1afa3b71db138',
  'c24045483a2ac1d285d2550761d8b5479e812c5109c9ec53604722dfc0721a83',
  '14160d86d23aa36a5fca957c604489907be3363a3a2ef9b1120c7c5e9903dbfa',
  '8fbb636afaa897f2768b0cb5bd7509ae8460277e3dffbd3843736467d01f3734',
  'fcaa833298492e5d32a10b330e1d4eee7446745a150e5678df574ebc77b51e34',
  'b57e28a3a826a61423742087d02847aba83066d001d386a46704bb5154845042',
  '23ae1035ab2fc2825b7226569a5f947f50396b5c76134c6d4391fbee020e604f',
  '5de5656a8ba4376ac72880ed123818882763030354ccce1e4f00fc6259787239',
  'cf089ce2e5190346ceaac71f6d5849bec95fd21e07f4ee091ce3a1f8d9b3553c',
  'ccffb9bbeac0d70fbe67d40d67a9be426a7d43bb6c8dd540778d22ca5a00f535',
  '73ae0ca57e4545d49fc6f1f02457350ba5f3b48fcb6b07c2bdcc9efa66c12bb7',
];
const keys = hashes.map((hash) => `pf1-content/notice/${hash}`);
const reviewer = 'Sol (AI curator) for the owner';

function sha256(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

function fixture(requiredNotices = keys) {
  const entry: PreviewEntry = {
    externalKey: 'fixture/notice-267',
    upstreamKey: 'fixture/notice-267',
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
          path: 'notice-267.yaml',
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
    83, 84, 85, 86, 87, 88, 89, 90, 92, 93, 94, 95, 96, 97,
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
          externalKey: 'fixture/notice-267',
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
        externalKey: 'fixture/notice-267',
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
        externalKey: 'fixture/notice-267',
        reason: expect.stringContaining('Notice bindings require re-review:'),
      },
    ],
  });
});

it('keeps full book chains and pre-existing unreviewed seeds outstanding', () => {
  expect(
    review.holds
      .filter((hold) => hold.id.startsWith('notice-267-complete-chain-'))
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
        externalKey: 'fixture/notice-267',
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
      held: [{ externalKey: 'fixture/notice-267', missingNotices: [code] }],
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
  const ticketKeys = [...keys.slice(0, 8), keys[7], ...keys.slice(8)];
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
      occurrence: 9,
      duplicateOccurrenceOf: 8,
      key: keys[7],
      line: 90,
    }),
  ]);
  expect(new Set(ticketKeys).size).toBe(14);
  const upstream = legalResources.upstreamNotices.find(
    (notice) => notice.id === 'pf1-content',
  );
  if (!upstream) throw new Error('Missing pinned content legal resource');
  const lines = (legalResources.ogl.text + upstream.text).split('\n');
  const unlistedHash =
    'cf4516a6eb17d46f90b863c87a9ee69f676f3f975ed51770dba470e149b492c9';
  const unlistedKey = `pf1-content/notice/${unlistedHash}`;
  expect(lines[90]).toBe(lines[89] + ' ');
  expect(sha256(lines[90]!)).toBe(unlistedHash);
  expect(keys).not.toContain(unlistedKey);
  expect(section15Registry[unlistedKey]).toBeUndefined();
  expect(
    resolveNotice({ registry: section15Registry, code: unlistedKey }),
  ).toBeUndefined();
  expect(review.comparisons).toContainEqual(
    expect.objectContaining({
      noticeKey: keys[7],
      lines: [90, 91],
      unlistedKey,
      unlistedTextSha256: unlistedHash,
    }),
  );
  const page = buildLegalPageData({
    registry: section15Registry,
    resources: legalResources,
    permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
    requiredNotices: ticketKeys.filter(
      (key): key is string => key !== undefined,
    ),
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

it('keeps the Dracolisk 2002 and Complete 2011 notices distinct', () => {
  const complete = section15Registry[keys[8]!]!;
  const older = section15Registry[keys[9]!]!;
  expect(complete.notice).toContain('Tome of Horrors Complete © 2011');
  expect(complete.notice).toContain('Frog God Games');
  expect(older.notice).toContain('Tome of Horrors, © 2002');
  expect(older.notice).not.toContain('Revised');
  expect(older.notice).not.toContain('Frog God Games');
  expect(complete.notice).not.toBe(older.notice);
  expect(complete.aliases).toEqual([]);
  expect(older.aliases).toEqual([]);
  expect(review.comparisons).toContainEqual(
    expect.objectContaining({
      noticeKeys: [keys[8], keys[9]],
      source: 'pf1-content',
      lines: [92, 93],
    }),
  );
});

it('records exact owner Shadow equality without reviewing or aliasing the Bestiary 6 seed', () => {
  const owner = section15Registry.PZO1137!;
  const shadow = section15Registry[keys[2]!]!;
  const comparison = review.comparisons.find(
    (item) => 'noticeKey' in item && item.noticeKey === keys[2],
  );
  expect(owner).toMatchObject({
    reviewStatus: 'unreviewed',
    checkedAgainst: 'owner-transcription',
  });
  expect(comparison).toMatchObject({
    registryKey: 'PZO1137',
    ownerNotice: shadow.notice,
    ownerTextSha256: hashes[2],
    evidence:
      'https://github.com/AndreasUnunger/EverythingPath/issues/227#issuecomment-5948776405',
  });
  expect(owner.notice.split('\n')).toContain(shadow.notice);
  expect(sha256(shadow.notice)).toBe(hashes[2]);
  expect(shadow.aliases).toEqual([]);
  expect(resolveNotice({ registry: section15Registry, code: 'PZO1137' })).toBe(
    owner,
  );
  const page = buildLegalPageData({
    registry: section15Registry,
    resources: legalResources,
    permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
    requiredNotices: [keys[2]!, 'PZO1137'],
  });
  expect(page.outstandingNotices).toEqual([
    { code: 'PZO1137', title: owner.title, reason: 'unreviewed' },
  ]);
});

it('retains the literal Stirge spelling and punctuation and enforces its additional comparison hold', () => {
  const stirge = section15Registry[keys[3]!]!;
  expect(stirge.notice).toContain(
    'Frog Godz Games; Authors Scott Greene and Clark Peterson,',
  );
  expect(stirge.notice).not.toContain('Frog God Games');
  expect(stirge.notice).not.toContain('Authors:');
  expect(stirge.aliases).toEqual([]);
  expect(
    review.holds
      .filter((hold) => hold.noticeKey === keys[3])
      .map((hold) => hold.id)
      .sort(),
  ).toEqual([
    `notice-267-complete-chain-${hashes[3]}`,
    'notice-267-stirge-literal-wording',
  ]);
  expect(review.comparisons).toContainEqual(
    expect.objectContaining({
      noticeKey: keys[3],
      line: 86,
      holdId: 'notice-267-stirge-literal-wording',
    }),
  );
  expect(
    assessWithUnclearedHolds(fixture([keys[3]!])).held[0]?.reason,
  ).toContain('notice-267-stirge-literal-wording');
  const page = buildLegalPageData({
    registry: section15Registry,
    resources: legalResources,
    permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
    requiredNotices: [keys[3]!],
  });
  expect(page.permanentNoticeSuperset).toContainEqual(
    expect.objectContaining({
      id: `registry:${keys[3]}`,
      text: stirge.notice,
    }),
  );
});
