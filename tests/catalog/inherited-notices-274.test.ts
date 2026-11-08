// @vitest-environment node
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import review from '../../scripts/catalog/legal/inherited-notices-274.json';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import {
  buildAssessmentBinding,
  computeFingerprint,
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
  '00acbc9cc416d7cf5e5a4c955d9ff2b0f9b4b8f592a470437e418934aead504f',
  'af0b1dffab6132c1f95c3785ecee021d7c3fa07547842310fd8d7a0dd97d621a',
  '2a130b1f0ea9212abbe2b017d0df708522ef539e7ca74ca973a506adde61de6c',
  '178750dc3601b1ca5050fc96e8a40428127271d145f680bd255d47d4be9b1230',
  '7005b0dceac9fe77a562cd66c695fb9fd8a817528dfd412e239891786b36ed54',
  'c69a7d6bfa1b88d843263370b1b015f026317c9c0b1c9168ad0f68087c2194c0',
  '8c4af9b6a9419b2ebce4b18d61d1a912ac379d41968b7e5a5fbe37414911707b',
  '9b724b149a7d8a83e5e48eb2437576fa0bfc639fa3b7e001f298095b5a181dd8',
  'bd94e075b46640bd1e5a8ac3fef151f0b3d9deff59286c8258247b4e9226fdf7',
  '6e63bafcc0c97bd94ed08dc64653de904264e23f0f6a58b79de353d6b6d04de2',
  '403d21dd79be1e871ead87b2e952d0efbeda207f3142fdd07f31f36300048947',
  '2bb7b2ec99604d93d54e2ad663f6a8397a7eb53f99a19835f87f82ec7f2957a8',
  'd71d5f2606800c6fb58ea2339fc1b66e6a9203dbeccb017618db53c4c486f4fe',
  '67e3d048597c42c5178474490fa250341ab351cf7e7410b753c5cf3eb0e4bf6e',
  'f23c121ec29980f8752911aef44033b238240cf63db39fda71cf87e68eb3e353',
];
const keys = hashes.map((hash) => `pf1-content/notice/${hash}`);
const reviewer = 'Sol (AI curator) for the owner';

function sha256(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

function fixture(requiredNotices = keys) {
  const entry: PreviewEntry = {
    externalKey: 'fixture/notice-274',
    upstreamKey: 'fixture/notice-274',
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
          path: 'notice-274.yaml',
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
    188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202,
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
          externalKey: 'fixture/notice-274',
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
        externalKey: 'fixture/notice-274',
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
    admitted: [{ externalKey: 'fixture/notice-274', requiredNotices: [code] }],
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
        externalKey: 'fixture/notice-274',
        reason: expect.stringContaining('Notice bindings require re-review:'),
      },
    ],
  });
});

it('keeps full book chains and pre-existing unreviewed seeds outstanding', () => {
  expect(
    review.holds
      .filter((hold) => hold.id.startsWith('notice-274-complete-chain-'))
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
        externalKey: 'fixture/notice-274',
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
      held: [{ externalKey: 'fixture/notice-274', missingNotices: [code] }],
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
    expect(holds[0]?.id).toBe(`notice-274-complete-chain-${block.textSha256}`);
    const result = assessWithUnclearedHolds(fixture([block.key]));
    expect(result).toMatchObject({
      passed: true,
      admitted: [],
      held: [
        {
          requiredNotices: [block.key],
          missingNotices: [],
          reason: `Notice holds: ${block.key} (${heldNotices
            .filter((hold) => hold.notices.includes(block.key))
            .map((hold) => hold.id)
            .sort()
            .join(', ')}).`,
        },
      ],
      failures: [],
    });
  },
);

it('reopens the content comparison after the synthetic definition changes', () => {
  const input = fixture();
  input.artifact.catalog.entries[0]!.description += ' Changed content.';
  expect(assessWithUnclearedHolds(input)).toMatchObject({
    passed: true,
    admitted: [],
    held: [
      {
        externalKey: 'fixture/notice-274',
        reason:
          'Accepted assessment no longer matches current content — re-review required.',
      },
    ],
    failures: [],
  });
});

it('preserves literal copyright dates, contributor names and absent terminal periods', () => {
  expect(section15Registry[keys[1]!]!.notice).toBe(
    'Pathfinder 16: Endless Night. Copyright 2008, Paizo Publishing, LLC; Author: F. Wesley Schneider.',
  );
  for (const index of [0, 2, 6, 7, 8, 9]) {
    expect(section15Registry[keys[index]!]!.notice.endsWith('.')).toBe(false);
  }
  for (const index of [1, 3, 4, 5, 10, 11, 12, 13, 14]) {
    expect(section15Registry[keys[index]!]!.notice.endsWith('.')).toBe(true);
  }
  expect(section15Registry[keys[2]!]!.notice).toContain('Author: J.D. Wiker');
  expect(section15Registry[keys[8]!]!.notice).toContain(
    'Author: Clinton Boomer and James Jacobs',
  );
  expect(section15Registry[keys[11]!]!.notice).toContain('Stephanie Lorée');
  expect(section15Registry[keys[11]!]!.notice).toContain('Sean K Reynolds');
  expect(section15Registry[keys[12]!]!.notice).toContain('Lucas J.W. Johnson');
  expect(section15Registry[keys[14]!]!.notice).toContain('Tim Nightengale');
});

it('preserves previous notice text when a later version has the same identity', () => {
  const code = keys[0]!;
  const originalPage = buildLegalPageData({
    registry: section15Registry,
    resources: legalResources,
    permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
    requiredNotices: [code],
  });
  const registry = structuredClone(section15Registry);
  registry[code]!.notice += ' Synthetic changed notice.';
  const laterPage = buildLegalPageData({
    registry,
    resources: legalResources,
    permanentNoticeSuperset: originalPage.permanentNoticeSuperset,
    requiredNotices: [code],
  });
  expect(laterPage.permanentNoticeSuperset).toEqual(
    expect.arrayContaining(originalPage.permanentNoticeSuperset),
  );
  expect(
    laterPage.permanentNoticeSuperset
      .filter((notice) => notice.id === `registry:${code}`)
      .map((notice) => notice.text),
  ).toEqual(
    expect.arrayContaining([
      section15Registry[code]!.notice,
      registry[code]!.notice,
    ]),
  );
});

function retainedFixture() {
  const input = fixture([keys[0]!]);
  const entry = input.artifact.catalog.entries[0]!;
  const definitionFingerprint = computeFingerprint(entry);
  return {
    ...input,
    retainedUses: [
      {
        useId: 'fixture/saved-use',
        externalKey: entry.externalKey,
        name: entry.name,
        characterId: 'fixture/character',
        definitionFingerprint,
        admittedRelease: 1,
        requiredNotices: [keys[0]!],
      },
    ],
    retainedExceptions: [
      {
        useId: 'fixture/saved-use',
        externalKey: entry.externalKey,
        definitionFingerprint,
        reason:
          'Synthetic existing use only: unresolved inherited notice chain.',
        requiredNotices: [keys[0]!],
      },
    ],
  };
}

it('reports a previously admitted last usable definition without admitting a held revision', () => {
  const input = retainedFixture();
  input.assessments = [];
  expect(assessWithUnclearedHolds(input)).toMatchObject({
    passed: true,
    admitted: [],
    held: [],
    retainedExceptions: [
      {
        externalKey: 'fixture/notice-274',
        definitionFingerprint: input.retainedUses[0]!.definitionFingerprint,
        requiredNotices: [keys[0]],
        missingNotices: [],
      },
    ],
    requiredNotices: [keys[0]],
    failures: [],
  });
  input.artifact.catalog.entries[0]!.description += ' New held revision.';
  const result = assessWithUnclearedHolds(input);
  expect(result).toMatchObject({
    passed: true,
    admitted: [],
    held: [
      {
        externalKey: 'fixture/notice-274',
        reason: 'missing Attribution Assessment',
      },
    ],
    retainedExceptions: [
      { definitionFingerprint: input.retainedUses[0]!.definitionFingerprint },
    ],
    requiredNotices: [keys[0]],
    failures: [],
  });
  expect(computeFingerprint(input.artifact.catalog.entries[0]!)).not.toBe(
    result.retainedExceptions[0]!.definitionFingerprint,
  );
});

it('fails an unreported retained use and keeps a missing retained notice outstanding', () => {
  const input = retainedFixture();
  input.assessments = [];
  expect(
    assessWithUnclearedHolds({ ...input, retainedExceptions: [] }),
  ).toMatchObject({
    passed: false,
    admitted: [],
    failures: [
      {
        externalKey: 'fixture/notice-274',
        reason: expect.stringContaining('retained exception'),
      },
    ],
  });
  const code = keys[0]!;
  const registry = structuredClone(section15Registry);
  delete registry[code];
  const result = assessWithUnclearedHolds({ ...input, registry });
  expect(result).toMatchObject({
    passed: true,
    admitted: [],
    retainedExceptions: [{ requiredNotices: [code], missingNotices: [code] }],
    requiredNotices: [code],
    failures: [],
  });
  const page = buildLegalPageData({
    registry,
    resources: legalResources,
    permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
    requiredNotices: result.requiredNotices,
  });
  expect(page.outstandingNotices).toEqual([
    { code, title: code, reason: 'missing' },
  ]);
  expect(page.permanentNoticeSuperset).toEqual(
    expect.arrayContaining(legalResources.permanentNoticeSuperset),
  );
});
