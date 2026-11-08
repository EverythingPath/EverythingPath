// @vitest-environment node
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import review from '../../scripts/catalog/legal/inherited-notices-281.json';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import {
  buildAssessmentBinding,
  computeFingerprint,
  type AdmissionSource,
} from '../../scripts/catalog/admission';
import type { PreviewEntry } from '../../scripts/catalog/map';
import type {
  AttributionAssessment,
  Section15Registry,
} from '../../src/lib/catalog/admission-schema';
import { buildLegalPageData } from '../../src/lib/catalog/legal-page-data';
import { resolveNotice } from '../../src/lib/catalog/resolve-notice';
import {
  legalResources,
  section15Registry,
} from '../../src/lib/catalog/section15-registry-data';
import { assessWithUnclearedHolds } from './uncleared-holds';

const hashes = [
  '5745e0c3c42a55138c2973104a4149b46c931b9e4ba1600ab8346f70cfec9173',
  'd2b873cf831ba3c7c3cb32382b76c84272367a10150bbc31ce0c95e3fb6dca3d',
  '30238fa25c9ba8b1e7fec7a435fbb4bad0b8d2d84135902c70d6feae8d712821',
  'c0b739c83c3a3aa4090e7231829e88150de1a8cbaf1232f7e5a76158463b49ae',
  'ef08a5d9ee07976fd585d6ff9ad7e3039f706ed58ec1a0adef0d2f94bff5c91b',
  '17ce5c7c7705713b6c40cec90dfde825f3ad2b8f3f1fbf6a80d4add5a0844571',
  'c3d847a54c162b5fed7bdb0b0a55f07b5f16dabebeb881daa2f13dabeb6af593',
  '857906abc70834d2490df408cfc67511c1d2df25136772d6092756796bd34058',
  '702eaf4af27e37ab3075ebdb62d22d52feda270c96570c6c7a708fb19ef44ec4',
  '8b0b2d9d59b78f9ec5a78bff71b4eae5b534e59677dddd694354cdc96fe9cdc6',
  '6a15b793791afba200fdef38181f022785f153db244d9fa49077c3185de6ca71',
  'ce8df2e65f71d26e7db49e2b488486fc33375cca69f5a4ea83aad6c17ed7a9e9',
  '967a54f6ad5fda8531e11036582e8aaea41f370305be1ca9da0a6b965c683725',
  '7c34edff6f94287604fbda75522efb0eba6e52f7ca887461111c7851677920d6',
  'e844418aa58455bedbdb2ccd2efe694cce5e6d3da1bdab0838ea021cf1eb1646',
];
const keys = hashes.map((hash) => `pf1-content/notice/${hash}`);
const reviewer = 'Sol (AI curator) for the owner';

function sha256(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

function fixture(
  requiredNotices = keys,
  externalKey = 'fixture/notice-281',
  registry: Section15Registry = section15Registry,
) {
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
        registry,
        requiredNotices,
        evidenceIds: ['fixture'],
      }),
      requiredNotices,
      rationale: 'Fixture-only assessment; not evidence for a Catalog Entry.',
      reviewedBy: 'Fixture reviewer',
      reviewedOn: '2026-10-08',
    },
  ];
  return { artifact, evidence, assessments, registry };
}

function acceptedFixture(externalKey = 'fixture/notice-281') {
  const code = 'fixture/accepted-notice';
  const registry = structuredClone(section15Registry);
  registry[code] = {
    title: 'Synthetic accepted notice',
    notice: 'Synthetic fixture notice only; no imported content is covered.',
    checkedAgainst: 'prd',
    checkedOn: '2026-10-08',
    aliases: [],
    reviewStatus: 'reviewed',
    provenance: ['Synthetic accepted notice for gate behavior only.'],
  };
  return fixture([code], externalKey, registry);
}

it('locates all 15 complete verbatim notices by their exact immutable source hashes', () => {
  expect(review.blocks.map((block) => block.key)).toEqual(keys);
  expect(new Set(keys).size).toBe(15);
  expect(review.blocks).toHaveLength(15);
  for (const block of review.blocks)
    expect(block).toMatchObject({
      source: 'pf1-content',
      disposition: 'reviewed-notice',
    });
  expect(review.blocks.map((block) => block.line)).toEqual([
    293, 294, 295, 296, 297, 298, 299, 300, 301, 302, 303, 304, 305, 306, 307,
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
      expect(block.keySha256).toBe(block.key.split('/').at(-1));
      const physicalLine = lines[block.line - 1]!;
      expect(sha256(physicalLine)).toBe(block.textSha256);
      expect(sha256(physicalLine)).toBe(block.keySha256);
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
          externalKey: 'fixture/notice-281',
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
        externalKey: 'fixture/notice-281',
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
  const input = acceptedFixture();
  expect(assessWithUnclearedHolds(input)).toMatchObject({
    passed: true,
    admitted: [
      {
        externalKey: 'fixture/notice-281',
        requiredNotices: ['fixture/accepted-notice'],
      },
    ],
    held: [],
    failures: [],
  });
});

it('keeps unrelated assessed content admitted without upgrading unassessed content or requiring held-only notices', () => {
  const code = 'fixture/accepted-notice';
  const unrelated = acceptedFixture('fixture/unrelated');
  const unassessed = acceptedFixture('fixture/unassessed');
  const affected = fixture(keys, 'fixture/notice-281', unrelated.registry);
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
        externalKey: 'fixture/notice-281',
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
    registry: unrelated.registry,
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

it.each(['notice', 'provenance', 'checkedOn', 'missing-binding'] as const)(
  'reopens a fixture assessment when its notice %s changes',
  (change) => {
    const input = fixture();
    const code = keys[0]!;
    const registry = structuredClone(section15Registry);
    if (change === 'notice')
      registry[code]!.notice += ' Fixture-only changed notice.';
    else if (change === 'provenance')
      registry[code]!.provenance.push('Fixture-only changed evidence.');
    else if (change === 'checkedOn') registry[code]!.checkedOn = '2026-10-09';
    else delete input.assessments[0]!.noticeFingerprints[code];
    expect(assessWithUnclearedHolds({ ...input, registry })).toMatchObject({
      passed: true,
      admitted: [],
      held: [
        {
          externalKey: 'fixture/notice-281',
          missingNotices: [],
          reason: expect.stringContaining('Notice bindings require re-review:'),
        },
      ],
      failures: [],
    });
  },
);

it('retains both conflicting Rival Guide author lists without merging identities or granting a book alias', () => {
  const first = section15Registry[keys[4]!]!;
  const second = section15Registry[keys[5]!]!;
  expect(first.title).toBe('Pathfinder Campaign Setting: Rival Guide');
  expect(first.notice.startsWith(`${first.title}. © 2011`)).toBe(true);
  expect(second.notice.startsWith(`${second.title}. © 2011`)).toBe(true);
  expect(second.title).toBe(first.title);
  expect(first).not.toBe(second);
  expect(first.notice).not.toBe(second.notice);
  expect(first.notice).toContain(
    'LLC. Authors: Brian Cortijo, Adam Daigle, Tim Hitchcock, Brandon Hodge, Colin McComb, Jason Nelson, Amber Scott, Neil Spicer, and Todd Stewart.',
  );
  expect(second.notice).toContain(
    'LLC; Authors: Brandon Hodge, Colin McComb, and Jason Nelson.',
  );
  expect(first.aliases).toEqual([]);
  expect(second.aliases).toEqual([]);
  expect(
    resolveNotice({ registry: section15Registry, code: first.title }),
  ).toBeUndefined();
  for (const code of keys.slice(4, 6)) {
    expect(review.holds).toContainEqual(
      expect.objectContaining({
        id: `notice-281-rival-guide-authors-${code.split('/').at(-1)}`,
        noticeKey: code,
        status: 'held',
      }),
    );
  }
  const page = buildLegalPageData({
    registry: section15Registry,
    resources: legalResources,
    permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
    requiredNotices: keys.slice(4, 6),
  });
  expect(
    page.permanentNoticeSuperset
      .filter((notice) => notice.id.startsWith('registry:'))
      .map((notice) => notice.text),
  ).toEqual(expect.arrayContaining([first.notice, second.notice]));
  expect(
    page.permanentNoticeSuperset.filter((notice) =>
      notice.id.startsWith('registry:'),
    ),
  ).toHaveLength(2);
});

it('preserves title punctuation, update labels, author spelling and literal copyright years', () => {
  const years = [
    2016, 2011, 2012, 2016, 2011, 2011, 2014, 2017, 2015, 2016, 2011, 2013,
    2011, 2014, 2008,
  ];
  for (const [index, code] of keys.entries())
    expect(section15Registry[code]!.notice).toContain(
      `${index === 14 ? 'Copyright' : '©'} ${years[index]}`,
    );
  expect(
    section15Registry[keys[1]!]!.notice.startsWith(
      'Pathfinder Campaign Setting: Pathfinder Society Field Guide. © 2011',
    ),
  ).toBe(true);
  expect(section15Registry[keys[8]!]!.title).toBe(
    'Pathfinder Campaign Setting: Technology Guide Update 1.0',
  );
  expect(section15Registry[keys[10]!]!.notice).toContain(
    'Leandra Christine Schneider',
  );
  expect(
    section15Registry[keys[14]!]!.notice.match(/Mike McArtor/g),
  ).toHaveLength(2);
  expect(
    section15Registry[keys[14]!]!.notice.endsWith('Jeremy Walker, JD Wiker.'),
  ).toBe(true);
});

it('keeps full book chains and pre-existing unreviewed seeds outstanding', () => {
  expect(
    review.holds
      .filter((hold) => hold.id.startsWith('notice-281-complete-chain-'))
      .map((hold) => hold.noticeKey),
  ).toEqual(keys);
  expect(new Set(review.holds.map((hold) => hold.id)).size).toBe(17);
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
        externalKey: 'fixture/notice-281',
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
      held: [{ externalKey: 'fixture/notice-281', missingNotices: [code] }],
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
      evidence: ['scripts/catalog/legal/inherited-notices-281.json'],
    });
    const alias = `fixture/held-alias/${hold.id}`;
    const registry = structuredClone(section15Registry);
    registry[hold.noticeKey]!.aliases.push(alias);
    for (const code of [hold.noticeKey, alias]) {
      const result = assessWithUnclearedHolds(
        fixture([code], undefined, registry),
      );
      expect(result).toMatchObject({
        passed: true,
        admitted: [],
        held: [
          {
            requiredNotices: [code],
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
    }
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
        externalKey: 'fixture/notice-281',
        reason:
          'Accepted assessment no longer matches current content — re-review required.',
      },
    ],
    failures: [],
  });
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
        externalKey: 'fixture/notice-281',
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
        externalKey: 'fixture/notice-281',
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
        externalKey: 'fixture/notice-281',
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
