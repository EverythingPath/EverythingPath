// @vitest-environment node
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import priorReview from '../../scripts/catalog/legal/inherited-notices-270.json';
import review from '../../scripts/catalog/legal/inherited-notices-271.json';
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
  '113a416896c13ee93ce260c01a6054007e14a87545835976a41ae2ba5624ba49',
  '53e8e49265eefa084060a4522bd71dc6af74a4524701693d881e8c9910220708',
  '3aba7d639f8d3ec515b1b47625f7c15ee8e0304874b89107f23526068ba2d5a2',
  'c3f44c1d859aaa077ad53e21353ab326195cde17b4a69ad027d861a019546b84',
  '7e11d6ae3c173cb957715c5a9121ff846961dd3f27ecee2f7b2757fe7c968ef9',
  '736a6302a3d44cd0c463459f3fc8c39cb1249cadad10bf4d5d749e001d268454',
  '1c9dad34e282e980785eafa1f694f269cd3225c381c6cf6810ed051abc770584',
  'c070331f1737c1d5c833c568c7685a4256b2417a3428914c5986d58b5c560de2',
  'd8ce459dc828770b061f910e0716f52d5e29033ed23102cdf465b2f88ba81246',
  '1faa0b966f9a2d8a77c68cfc0365ed2439648d3d1d73074f1da67340e842332d',
  'ac35c8024b2123f536fcc710180a3ab81734101ce08d8224141b70ff329e7c60',
  '67c6c14e3c15035eed4f9370768aafb48ce34455b12960120e1690de9c376f8f',
  'b26882707bff1f179fe8f5a1543b8ff996fdba31bb2718e182e94ea3be694a97',
];
const keys = hashes.map((hash) => `pf1-content/notice/${hash}`);
/** Occurrence 1 was already reviewed and held by #270, which landed first. */
const priorKey = keys[0]!;
const priorEvidence = 'scripts/catalog/legal/inherited-notices-270.json';
const newKeys = keys.slice(1);
const reviewer = 'Sol (AI curator) for the owner';

function sha256(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

function fixture(requiredNotices = keys) {
  const entry: PreviewEntry = {
    externalKey: 'fixture/notice-271',
    upstreamKey: 'fixture/notice-271',
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
          path: 'notice-271.yaml',
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

it('binds all 12 new unique immutable blocks to complete verbatim notices at the pinned lines', () => {
  expect(review.blocks.map((block) => block.key)).toEqual(newKeys);
  expect(review.blocks.map((block) => block.line)).toEqual([
    144, 145, 146, 147, 149, 150, 151, 152, 153, 154, 156, 157,
  ]);
  expect(review).toMatchObject({
    reviewedBy: reviewer,
    reviewedOn: '2026-10-08',
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
        checkedOn: '2026-10-08',
        reviewStatus: 'reviewed',
      });
      expect(notice.provenance).toContain(
        `Reviewed by ${reviewer} on 2026-10-08.`,
      );
      expect(notice.provenance).toContain(`${source.url}#L${block.line}`);
      expect(notice.provenance).toContain(
        'scripts/catalog/legal/inherited-notices-271.json',
      );
      expect(notice).toBe(section15Registry[block.registryKey]);
      expect(notice.aliases).toEqual(
        keys.filter(
          (key) => key !== block.registryKey && key.endsWith(block.textSha256),
        ),
      );
    }
  }
});

it('resolves the line-142 occurrence to the single unchanged #270 Registry record and hold', () => {
  expect(review.inventoryOccurrences[0]).toEqual({
    occurrence: 1,
    key: priorKey,
    line: 142,
    registryKey: priorKey,
    disposition: 'previously-reviewed-notice',
    duplicateOccurrenceOf: null,
    previouslyReviewedIn: priorEvidence,
  });
  expect(
    review.inventoryOccurrences
      .filter((item) => item.previouslyReviewedIn !== null)
      .map((item) => item.occurrence),
  ).toEqual([1]);
  expect(priorReview.blocks).toContainEqual(
    expect.objectContaining({ key: priorKey, line: 142 }),
  );
  expect(review.blocks.map((block) => block.key)).not.toContain(priorKey);
  expect(review.holds.map((hold) => hold.noticeKey)).not.toContain(priorKey);
  const record = section15Registry[priorKey]!;
  expect(record.provenance).toContain(priorEvidence);
  expect(record.provenance).toContain(
    'https://github.com/AndreasUnunger/EverythingPath/issues/270',
  );
  expect(record.provenance.join('\n')).not.toContain('271');
  expect(heldNotices.filter((hold) => hold.notices.includes(priorKey))).toEqual(
    [
      {
        id: `notice-270-complete-chain-${hashes[0]}`,
        notices: [priorKey],
        evidence: [priorEvidence],
      },
    ],
  );
  expect(assessWithUnclearedHolds(fixture([priorKey]))).toMatchObject({
    passed: true,
    admitted: [],
    held: [
      {
        requiredNotices: [priorKey],
        missingNotices: [],
        reason: `Notice holds: ${priorKey} (notice-270-complete-chain-${hashes[0]}).`,
      },
    ],
    failures: [],
  });
});

it('publishes 13 reviewed notices for 15 inventory occurrences and retains every historic notice version', () => {
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
  ).toHaveLength(13);
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
          externalKey: 'fixture/notice-271',
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
        externalKey: 'fixture/notice-271',
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
    admitted: [{ externalKey: 'fixture/notice-271', requiredNotices: [code] }],
    held: [],
    failures: [],
  });
});

it('reopens an accepted fixture assessment when its reviewed notice changes', () => {
  const input = fixture();
  const code = newKeys[0]!;
  const registry = structuredClone(section15Registry);
  registry[code]!.notice += ' Fixture-only changed notice.';
  expect(assessWithUnclearedHolds({ ...input, registry })).toMatchObject({
    passed: true,
    admitted: [],
    held: [
      {
        externalKey: 'fixture/notice-271',
        reason: expect.stringContaining('Notice bindings require re-review:'),
      },
    ],
  });
});

it('keeps full book chains and pre-existing unreviewed seeds outstanding', () => {
  expect(
    review.holds
      .filter((hold) => hold.id.startsWith('notice-271-complete-chain-'))
      .map((hold) => hold.noticeKey),
  ).toEqual(newKeys);
  expect(new Set(review.holds.map((hold) => hold.id)).size).toBe(13);
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
        externalKey: 'fixture/notice-271',
        missingNotices: expect.arrayContaining(gateMissing),
      },
    ],
  });
});

it.each(['missing', 'unreviewed'] as const)(
  'holds an entry when one batch notice becomes %s',
  (state) => {
    const input = fixture();
    const code = newKeys[0]!;
    const registry = structuredClone(section15Registry);
    if (state === 'missing') delete registry[code];
    else registry[code]!.reviewStatus = 'unreviewed';
    expect(assessWithUnclearedHolds({ ...input, registry })).toMatchObject({
      passed: true,
      admitted: [],
      held: [{ externalKey: 'fixture/notice-271', missingNotices: [code] }],
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

it('accounts for duplicate ticket occurrences while retaining three unlisted trailing-space variants only upstream', () => {
  const ticketKeys = [
    ...keys.slice(0, 5),
    keys[4]!,
    ...keys.slice(5, 11),
    keys[10]!,
    ...keys.slice(11),
  ];
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
      occurrence: 6,
      duplicateOccurrenceOf: 5,
      key: keys[4],
      line: 147,
    }),
    expect.objectContaining({
      occurrence: 13,
      duplicateOccurrenceOf: 12,
      key: keys[10],
      line: 154,
    }),
  ]);
  expect(new Set(ticketKeys).size).toBe(13);
  const upstream = legalResources.upstreamNotices.find(
    (notice) => notice.id === 'pf1-content',
  );
  if (!upstream) throw new Error('Missing pinned content legal resource');
  const lines = (legalResources.ogl.text + upstream.text).split('\n');
  const variants = [
    {
      line: 143,
      hash: 'dbced821a74339665d639ea798fb1bc35c20ce10191ed37485fb4110835bb860',
      listed: keys[0],
    },
    {
      line: 148,
      hash: '0dfad230824c14dde12d354008fe723f8c3a99d7bf48ae267a46ac24e54fe285',
      listed: keys[4],
    },
    {
      line: 155,
      hash: 'f17075e82cdbffb4ed5c49a48e6a10a7d71c78bb71ca6a387ce992723bffbd82',
      listed: keys[10],
    },
  ];
  for (const { line, hash, listed } of variants) {
    const key = `pf1-content/notice/${hash}`;
    expect(lines[line - 1]).toBe(lines[line - 2] + ' ');
    expect(sha256(lines[line - 1]!)).toBe(hash);
    expect(keys).not.toContain(key);
    expect(section15Registry[key]).toBeUndefined();
    expect(
      resolveNotice({ registry: section15Registry, code: key }),
    ).toBeUndefined();
    expect(review.comparisons).toContainEqual(
      expect.objectContaining({
        noticeKey: listed,
        lines: [line - 1, line],
        unlistedKey: key,
        unlistedTextSha256: hash,
      }),
    );
  }
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
  ).toHaveLength(13);
  expect(
    sha256(
      page.permanentNoticeSuperset.find(
        (notice) => notice.id === 'pf1-content',
      )!.text,
    ),
  ).toBe(sha256(upstream.text));
});

it('preserves the distinct Ice Golem and Iron Cobra editions and literal publisher/permission wording', () => {
  expect(section15Registry[keys[0]!]!.notice).toContain(
    'Tome of Horrors Complete © 2011',
  );
  expect(section15Registry[keys[1]!]!.notice).toContain(
    'Tome of Horrors Revised.© 2002',
  );
  expect(section15Registry[keys[2]!]!.notice).toContain(
    'Tome of Horrors, © 2002',
  );
  expect(section15Registry[keys[4]!]!.notice).toContain('Complete © 2011');
  expect(section15Registry[keys[5]!]!.notice).toContain(
    'Tome of Horrors, © 2002',
  );
  expect(section15Registry[keys[6]!]!.notice).toContain(
    'Author: Lizard -- Used With Permission.',
  );
  expect(section15Registry[keys[8]!]!.notice).toContain(
    'Paizo Publishing, LL C;',
  );
  expect(section15Registry[keys[9]!]!.notice).toContain('Revised.© 2002');
  expect(section15Registry[keys[9]!]!.notice).toContain(
    'Scott Greene and Clark Peterson',
  );
  expect(review.holds).toContainEqual(
    expect.objectContaining({
      id: 'notice-271-jade-regent-publisher-wording',
      noticeKey: keys[8],
      status: 'held',
    }),
  );
  expect(review.comparisons).toContainEqual(
    expect.objectContaining({
      noticeKey: keys[8],
      line: 152,
      holdId: 'notice-271-jade-regent-publisher-wording',
    }),
  );
});
