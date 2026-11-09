// @vitest-environment node
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import review from '../../scripts/catalog/legal/inherited-notices-268.json';
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
  '17e79ea700ffda83240fe30543e7ea41c6aa30a53b7d83a0d4235500e0c3674b',
  '6cb50c3ec2f66b63ab2fb5b6bb07af41c883d21b48d8c9e299b9dc94c69c3d8f',
  '1eea69dddd67b7a4e7624bc947fbdea0abbe2d869a4574dc90e2ce0eb24a78ab',
  '8478bb334e17b0c89a5c29a94920e7ace7fff66dab0d51ce66b2d70456eac93c',
  '3f9e7d4429b198dba0d8ec28d882861f8e78c4c221b0a238b9dcc52df7327e56',
  'ab61a46975bfc68ac7b6ecdbe1160445334cbc92826c131b4679a8effec6db6b',
  '03519564fdf08a3e2e315ac0c6ca5edb8df32a7726c3e86dad84279901047434',
  '980024413a2d54bc44b3a84228588b361dd9010e41d8deb8abae178204dc9d3d',
  '5e006fac45b29d147e17156f37a54bbb4ec17a0bcb64dc2068ba93834affa6c1',
  'a94f2e925156bb159e106de63ccd49124fb3c6b45a56d917d3e5552333aa2d6e',
  'fdb37c32a77be148d0464c2c68e6a03436d1adcece01b4d6d03a5a7aef16fb8c',
  '219fdea258881e4a8553189a7a3cc6960da76abb47aa88163589fe81326c3772',
  'f80302149b17faccafc191b6d89e776f43656f826b6d0a978a9690a276d36d74',
  '5b39f67b456cf3f067fce74aa5d931087f23cd5f9097ee6aa4b55b2cb4c6910c',
];
const keys = hashes.map((hash) => `pf1-content/notice/${hash}`);
const reviewer = 'Sol (AI curator) for the owner';

function sha256(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

function fixture(requiredNotices = keys) {
  const entry: PreviewEntry = {
    externalKey: 'fixture/notice-268',
    upstreamKey: 'fixture/notice-268',
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
          path: 'notice-268.yaml',
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
    98, 99, 100, 101, 102, 103, 104, 105, 106, 108, 109, 110, 111, 112,
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
          externalKey: 'fixture/notice-268',
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
        externalKey: 'fixture/notice-268',
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
    admitted: [{ externalKey: 'fixture/notice-268', requiredNotices: [code] }],
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
        externalKey: 'fixture/notice-268',
        reason: expect.stringContaining('Notice bindings require re-review:'),
      },
    ],
  });
});

it('keeps full book chains and pre-existing unreviewed seeds outstanding', () => {
  expect(
    review.holds
      .filter((hold) => hold.id.startsWith('notice-268-complete-chain-'))
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
        externalKey: 'fixture/notice-268',
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
      held: [{ externalKey: 'fixture/notice-268', missingNotices: [code] }],
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
  const ticketKeys = [...keys.slice(0, 9), keys[8], ...keys.slice(9)];
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
      occurrence: 10,
      duplicateOccurrenceOf: 9,
      key: keys[8],
      line: 106,
    }),
  ]);
  expect(new Set(ticketKeys).size).toBe(14);
  const upstream = legalResources.upstreamNotices.find(
    (notice) => notice.id === 'pf1-content',
  );
  if (!upstream) throw new Error('Missing pinned content legal resource');
  const lines = (legalResources.ogl.text + upstream.text).split('\n');
  const unlistedHash =
    '526d170a2557eb6c0ef684afbfe8fbc710d0654c3a2ff84f27d9606a646ee587';
  const unlistedKey = `pf1-content/notice/${unlistedHash}`;
  expect(lines[106]).toBe(lines[105] + ' ');
  expect(sha256(lines[106]!)).toBe(unlistedHash);
  expect(keys).not.toContain(unlistedKey);
  expect(section15Registry[unlistedKey]).toBeUndefined();
  expect(
    resolveNotice({ registry: section15Registry, code: unlistedKey }),
  ).toBeUndefined();
  expect(review.comparisons).toContainEqual(
    expect.objectContaining({
      noticeKey: keys[8],
      lines: [106, 107],
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

it('retains the flindbar editorial instruction without merging the adjacent Flind notice', () => {
  const flindbar = section15Registry[keys[1]!]!;
  const flind = section15Registry[keys[2]!]!;
  expect(flindbar.notice).toContain(
    'J.D. Morris. XXinclude flindbar citation only if relevant.',
  );
  expect(flind.notice).toContain('Flind from the Tome of Horrors Complete');
  expect(flind.notice).not.toContain('flindbar');
  expect(flindbar.aliases).toEqual([]);
  expect(flind.aliases).toEqual([]);
  expect(review.comparisons).toContainEqual(
    expect.objectContaining({
      noticeKey: keys[1],
      line: 99,
      holdId: 'notice-268-flindbar-editorial-wording',
    }),
  );
  expect(
    assessWithUnclearedHolds(fixture([keys[1]!])).held[0]?.reason,
  ).toContain('notice-268-flindbar-editorial-wording');
  const page = buildLegalPageData({
    registry: section15Registry,
    resources: legalResources,
    permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
    requiredNotices: [keys[1]!],
  });
  expect(page.permanentNoticeSuperset).toContainEqual(
    expect.objectContaining({
      id: `registry:${keys[1]}`,
      text: flindbar.notice,
    }),
  );
});

it('keeps the three Froghemoth versions and their contributor wording distinct', () => {
  const complete = section15Registry[keys[8]!]!;
  const revised = section15Registry[keys[9]!]!;
  const older = section15Registry[keys[10]!]!;
  expect(complete.notice).toContain(
    'Complete © 2011, Necromancer Games, Inc.; Author: Scott Greene,',
  );
  expect(revised.notice).toContain(
    'Revised.© 2002, Necromancer Games, Inc.; Author: Scott Greene and Clark Peterson,',
  );
  expect(older.notice).toContain(
    'Tome of Horrors, © 2002, Necromancer Games, Inc.; Author: Scott Greene,',
  );
  expect(new Set([complete.notice, revised.notice, older.notice]).size).toBe(3);
  for (const notice of [complete, revised, older]) {
    expect(notice.aliases).toEqual([]);
    expect(notice.notice).not.toContain('Frog God Games');
  }
  expect(review.comparisons).toContainEqual(
    expect.objectContaining({
      noticeKeys: [keys[8], keys[9], keys[10]],
      source: 'pf1-content',
      lines: [106, 108, 109],
    }),
  );
});

it('retains the literal frog author labels and module copyright punctuation', () => {
  expect(section15Registry[keys[6]!]!.notice).toContain(
    '; Author Scott Greene and Clark Peterson,',
  );
  expect(section15Registry[keys[7]!]!.notice).toContain(
    '; Authors Scott Greene and Clark Peterson,',
  );
  expect(section15Registry[keys[11]!]!.notice).toContain(
    'Hollow’s Last Hope, Copyright 2007 Paizo Publishing, LLC. Author: Jason Bulmahn and F. Wesley Schneider.',
  );
  expect(section15Registry[keys[12]!]!.notice).toContain(
    'Crown of the Kobold King, Copyright 2007 Paizo Publishing, LLC. Author: Nicolas Logue.',
  );
  expect(section15Registry[keys[13]!]!.notice).toContain(
    'Seven Swords of Sin. Copyright 2007 Paizo Publishing, LLC. Author: James Lafond Sutter.',
  );
});
