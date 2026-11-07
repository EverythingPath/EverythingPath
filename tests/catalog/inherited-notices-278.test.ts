// @vitest-environment node
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import review from '../../scripts/catalog/legal/inherited-notices-278.json';
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
  '7f5164871a29b9aa0dd0284a53d2be806d28ff0cb87bead79c350d8f6ae662d5',
  'd193b10feb220637cfb4417402c6adef3d103a5ca92635d37fd88d2307449b8d',
  '4e699a12850098a66c269ee2d9863275d81c59c836063faf69974e788ec17513',
  '2bc81d0dbd6932fc0cf81bb41bfe52a01e21a48d0c5ace9fadf2ca399375cbf2',
  '038d2821299758e5e516ea4aa6ffce90706aa885f51fd6bc30b3914efc6cb761',
  '27e18f28ed62360fd3f90afef1c77abf67d492b8b0c18517e5f0549e1e4a88d7',
  'a6e469ea04bbd17f34b2bcae983ec3a79ab35ab756c13e43ec02e6eae7fc4d98',
  '3499ce2814621747140443668dd2123d3f15a533deaaedac65cec4395a38c754',
  '69efe70e71e8664bac5251cbb9f698c330607d45d33a1f12441bd4a90e91094d',
  '73d65fd5067470639634916413e03236d04b8a14432b58e30f074ef833e9a852',
  '7e41cf383b47fda2d1f24a26fca747189e6850df605e1d82c946a714713683eb',
  '424acdd4487a4cefb88f44e36afbb5e51371fbe3cb97a93d8c50abb7399a1e2f',
  'db13e37c591e1ee74a94a8ef8d5244cdc9ceff1cda7742e3b20e119af1a9c4db',
  '8fba1a989feedf43e7c0263ff1605a94b07bbbf2a57bec3b8bfb4e244aeea7a9',
  '68317a01184b98b22c8393ebe64d0d9c0988b2bbce5d25c1290c90f50fc89e33',
];
const keys = hashes.map((hash) => `pf1-content/notice/${hash}`);
const reviewer = 'Sol (AI curator) for the owner';

function sha256(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

function fixture(requiredNotices = keys, externalKey = 'fixture/notice-278') {
  const entry: PreviewEntry = {
    externalKey,
    upstreamKey: externalKey,
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
          path: `${externalKey}.yaml`,
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
  expect(review.inventoryOccurrences).toEqual(
    keys.map((key, index) => ({
      occurrence: index + 1,
      key,
      line: index + 248,
      registryKey: key,
      disposition: 'reviewed-notice',
      duplicateOccurrenceOf: null,
    })),
  );
  expect(review.blocks.map((block) => block.line)).toEqual([
    248, 249, 250, 251, 252, 253, 254, 255, 256, 257, 258, 259, 260, 261, 262,
  ]);
  expect(review).toMatchObject({
    reviewedBy: reviewer,
    reviewedOn: '2026-10-08',
    checkedAgainst: 'pf1-content',
  });
  expect(review.policyEvidence).toEqual([
    'https://github.com/AndreasUnunger/EverythingPath/issues/224#issuecomment-5939689134',
    'https://github.com/AndreasUnunger/EverythingPath/issues/227#issuecomment-5948780647',
    'https://github.com/AndreasUnunger/EverythingPath/issues/241#issuecomment-5955002698',
    'https://github.com/AndreasUnunger/EverythingPath/issues/251#issuecomment-5958557461',
  ]);
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
    if (repo === 'pf1') {
      const systemHashes = new Set(lines.map(sha256));
      for (const block of review.blocks)
        expect(systemHashes.has(block.textSha256)).toBe(false);
    }
    for (const block of review.blocks.filter((item) => item.source === repo)) {
      const notice = resolveNotice({
        registry: section15Registry,
        code: block.key,
      });
      if (!notice) throw new Error(`Missing Registry record for ${block.key}`);
      expect(block).toMatchObject({ kind: 'complete-notice', joinedWith: [] });
      expect(block.textSha256).toBe(block.key.split('/').at(-1));
      expect(
        lines.filter((line) => sha256(line) === block.textSha256),
      ).toHaveLength(1);
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
        `pf1-content/OGL.txt:${block.line}; tag ${source.tag}; commit ${source.commit}; file sha256:${source.fileSha256}; line sha256:${block.textSha256}`,
      );
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
          externalKey: 'fixture/notice-278',
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
        externalKey: 'fixture/notice-278',
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
  const code = 'CRB';
  expect(assessWithUnclearedHolds(fixture([code]))).toMatchObject({
    passed: true,
    admitted: [{ externalKey: 'fixture/notice-278', requiredNotices: [code] }],
    held: [],
    failures: [],
  });
});

it('keeps unrelated assessed content admitted without upgrading unassessed content or requiring held-only notices', () => {
  const code = 'CRB';
  const affected = fixture();
  const unrelated = fixture([code], 'fixture/unrelated');
  const unassessed = fixture([code], 'fixture/unassessed');
  const result = assessWithUnclearedHolds({
    ...affected,
    artifact: {
      catalog: {
        entries: [
          ...affected.artifact.catalog.entries,
          ...unrelated.artifact.catalog.entries,
          ...unassessed.artifact.catalog.entries,
        ],
      },
      comparison: {
        packs: [],
        records: [
          ...affected.artifact.comparison.records,
          ...unrelated.artifact.comparison.records,
          ...unassessed.artifact.comparison.records,
        ],
      },
    },
    assessments: [...affected.assessments, ...unrelated.assessments],
  });
  expect(result).toMatchObject({
    passed: true,
    admitted: [{ externalKey: 'fixture/unrelated', requiredNotices: [code] }],
    held: expect.arrayContaining([
      {
        externalKey: 'fixture/notice-278',
        name: 'Synthetic notice gate fixture',
        requiredNotices: [...keys].sort(),
        missingNotices: [],
        evidence: ['fixture'],
        reason: expect.stringMatching(/^Notice holds: /),
      },
      expect.objectContaining({
        externalKey: 'fixture/unassessed',
        reason: 'missing Attribution Assessment',
      }),
    ]),
    requiredNotices: [code],
    failures: [],
  });
  expect(result.held).toHaveLength(2);
  const page = buildLegalPageData({
    registry: section15Registry,
    resources: legalResources,
    permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
    requiredNotices: result.requiredNotices,
  });
  expect(page.outstandingNotices).toEqual([]);
  expect(
    page.permanentNoticeSuperset
      .filter((notice) => notice.id.startsWith('registry:'))
      .map((notice) => notice.id),
  ).toEqual([`registry:${code}`]);
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
        externalKey: 'fixture/notice-278',
        reason: expect.stringContaining('Notice bindings require re-review:'),
      },
    ],
  });
});

it('keeps full book chains and pre-existing unreviewed seeds outstanding', () => {
  expect(
    review.holds
      .filter((hold) => hold.id.startsWith('notice-278-complete-chain-'))
      .map((hold) => hold.noticeKey),
  ).toEqual(keys);
  expect(new Set(review.holds.map((hold) => hold.id)).size).toBe(16);
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
        externalKey: 'fixture/notice-278',
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
      held: [{ externalKey: 'fixture/notice-278', missingNotices: [code] }],
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

it.each(review.holds)(
  'enforces the unresolved hold $id independently',
  (hold) => {
    expect(heldNotices.find((item) => item.id === hold.id)).toMatchObject({
      notices: [hold.noticeKey],
      evidence: ['scripts/catalog/legal/inherited-notices-278.json'],
    });
    const result = assessWithUnclearedHolds(fixture([hold.noticeKey]));
    expect(result).toMatchObject({
      passed: true,
      admitted: [],
      held: [
        {
          requiredNotices: [hold.noticeKey],
          missingNotices: [],
          reason: expect.stringContaining(hold.id),
        },
      ],
      failures: [],
    });
    for (const enforced of heldNotices.filter((item) =>
      item.notices.includes(hold.noticeKey),
    ))
      expect(result.held[0]?.reason).toContain(enforced.id);
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
        externalKey: 'fixture/notice-278',
        reason:
          'Accepted assessment no longer matches current content — re-review required.',
      },
    ],
    failures: [],
  });
});

it('preserves literal dates, punctuation, duplicate contributors and unresolved editorial markup', () => {
  const copyrightYears = [
    2013, 2013, 2013, 2013, 2014, 2014, 2014, 2014, 2014, 2015, 2015, 2015,
    2012, 2012, 2015,
  ];
  for (const [index, code] of keys.entries()) {
    expect(section15Registry[code]!.notice.endsWith('.')).toBe(true);
    expect(section15Registry[code]!.notice).toContain(
      `© ${copyrightYears[index]},`,
    );
  }
  expect(section15Registry[keys[0]!]!.title).toContain("Queen's Revenge");
  expect(section15Registry[keys[2]!]!.title).toContain('Demon’s Heresy');
  expect(
    section15Registry[keys[6]!]!.notice.match(/Amber E\. Scott/g),
  ).toHaveLength(2);
  expect(section15Registry[keys[8]!]!.notice).toContain('© 2014, Paizo Inc.;');
  expect(section15Registry[keys[10]!]!.notice).toContain(
    'Authors: Sean K Reynolds, with',
  );
  expect(section15Registry[keys[11]!]!.notice).toContain('Stephanie Lorée');
  const code = keys[13]!;
  expect(section15Registry[code]!.title).toBe(
    'Pathfinder Campaign Setting: Artifacts &amp; Legends</b>',
  );
  expect(section15Registry[code]!.notice).toBe(
    'Pathfinder Campaign Setting: Artifacts &amp; Legends</b> © 2012, Paizo Publishing, LLC; Author: F. Wesley Schneider.',
  );
  const page = buildLegalPageData({
    registry: section15Registry,
    resources: legalResources,
    permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
    requiredNotices: [code],
  });
  expect(
    page.permanentNoticeSuperset.find(
      (notice) => notice.id === `registry:${code}`,
    )?.text,
  ).toBe(section15Registry[code]!.notice);
  expect(
    resolveNotice({
      registry: section15Registry,
      code: 'Pathfinder Campaign Setting: Artifacts & Legends',
    }),
  ).toBeUndefined();
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
        externalKey: 'fixture/notice-278',
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
        externalKey: 'fixture/notice-278',
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
        externalKey: 'fixture/notice-278',
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
