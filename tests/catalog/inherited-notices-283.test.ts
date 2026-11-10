// @vitest-environment node
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import review from '../../scripts/catalog/legal/inherited-notices-283.json';
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
  reviewedAdmission,
} from '../../src/lib/catalog/reviewed-data';
import { section15Registry } from '../../src/lib/catalog/section15-registry-data';
import { assessWithUnclearedHolds } from './uncleared-holds';

const hashes = [
  'f47b35b25033ace64f5c3b93bc0f99800e01052331858d73f2204ec90b1d7cba',
  '4c3226cd7dcc4f0ded0b8c5446549a84ba9f81512451a21158794e6b1ab9467a',
  'c2298dee2c61114e319fbf2753fe4483eb48eae73449ecac0697978c04f197d9',
  'b2470bd2414513b46ee9976822d3b740a5222c8d23a95a263b5a95426ae5ad5e',
  'b5cc277d179f5b05eb2be1b3c2e8dbe04327dd033de684a842b31ece5ab73243',
  '7c5ca52690626965a48283f1ba1121db663fd5aab941f1183d72cc0a59b5e6a3',
  'cc61730b1819541562bbce0668dec6dc4640ef366411d3710759aa0f530c38a5',
  'fef36dc57305b34b623e4adc90c457fcec01e933970ca38c7c5d246c43fd34b8',
  '412e4027c4cb1c877079829c6eb836aedc71f84deb2c8e19e6d76061fad4ed4d',
  'd9646cc8202c2ee29af49978fe24e2cf8609184db03f7073e7ca3e73dceee702',
  '8b0799f7fe8578ce9ceeb4eafd644a4d495ef34e2aace2793c6628ff3dde36f0',
  'bc7e3c118a26b5270489778329f2161f8ba50bbbb35f813bdbc129b9c0f77665',
  '2916a1247be1d3f953d52e24c373a9ce7fc136877ef258f899aaca88ce839a8c',
  '9167ad4a3185cac7229d2475f741391e3e3e013abd06cffed9230fb92923c4fb',
  '4c3e42c83dde7e2520b560964d63429794d244af2c3ebf435048aa519e116eef',
];
const keys = hashes.map((hash) => `pf1-content/notice/${hash}`);
const reviewer = 'Sol (AI curator) for the owner';

function sha256(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

function fixture(requiredNotices = keys, externalKey = 'fixture/notice-283') {
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

it('locates all 15 complete verbatim notices against the independent immutable inventory', () => {
  expect(review.blocks.map((block) => block.key)).toEqual(keys);
  expect(new Set(keys).size).toBe(15);
  expect(review.inventoryOccurrences).toEqual(
    keys.map((key, index) => ({
      occurrence: index + 1,
      key,
      line: index + 323,
      registryKey: key,
      disposition: 'reviewed-notice',
      duplicateOccurrenceOf: null,
    })),
  );
  expect(review.blocks.map((block) => block.line)).toEqual([
    323, 324, 325, 326, 327, 328, 329, 330, 331, 332, 333, 334, 335, 336, 337,
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
          externalKey: 'fixture/notice-283',
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
        externalKey: 'fixture/notice-283',
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
    admitted: [{ externalKey: 'fixture/notice-283', requiredNotices: [code] }],
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
        externalKey: 'fixture/notice-283',
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
        externalKey: 'fixture/notice-283',
        reason: expect.stringContaining('Notice bindings require re-review:'),
      },
    ],
  });
});

it('keeps full book chains and pre-existing unreviewed seeds outstanding', () => {
  expect(
    review.holds
      .filter((hold) => hold.id.startsWith('notice-283-complete-chain-'))
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
        externalKey: 'fixture/notice-283',
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
      held: [{ externalKey: 'fixture/notice-283', missingNotices: [code] }],
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
      evidence: ['scripts/catalog/legal/inherited-notices-283.json'],
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
        externalKey: 'fixture/notice-283',
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
        externalKey: 'fixture/notice-283',
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
        externalKey: 'fixture/notice-283',
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
        externalKey: 'fixture/notice-283',
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

it('retains literal dates, names and punctuation without inventing corrections or aliases', () => {
  const years = [
    2010, 2010, 2009, 2009, 2008, 2010, 2009, 2010, 2008, 2009, 2010, 2008,
    2009, 2008, 2008,
  ];
  for (const [index, code] of keys.entries()) {
    const notice = section15Registry[code]!;
    expect(notice.notice).toContain(
      `Copyright ${years[index]}, Paizo Publishing, LLC`,
    );
    expect(notice.aliases).toEqual([]);
  }
  expect(section15Registry[keys[0]!]!.title).toBe(
    'Pathfinder Companion: Adventurer’s Armory',
  );
  expect(section15Registry[keys[1]!]!.notice).toContain(
    'Authors:Jonathan Keith, Hal Maclean, Colin Moulder-McComb',
  );
  expect(section15Registry[keys[4]!]!.notice).toContain(
    'Elves of Golarion, Copyright 2008, Paizo Publishing, LLC; Authors Jeff Quick',
  );
  expect(section15Registry[keys[6]!]!.title).toBe(
    'Pathfinder Companion: Legacy of Fire Player’s Guide',
  );
  expect(section15Registry[keys[8]!]!.notice).toContain(
    'Osirion, Land of Pharaohs, Copyright 2008',
  );
  expect(section15Registry[keys[11]!]!.title).toBe(
    'Pathfinder Companion: Second Darkness Player’s Guide',
  );
  expect(section15Registry[keys[13]!]!.notice).toContain(
    'LLC. Author: Stephen S. Greer.',
  );
  expect(section15Registry[keys[14]!]!.notice).toContain(
    'LLC. Author: Anson Caralya.',
  );
  expect(review.holds).toHaveLength(15);
});

it('leaves earlier Registry seeds unchanged and creates no content assessment or retained exception', () => {
  const seedHashes = {
    CRB: 'd52764e5110e0ce04b68e84dc7d90a9823abf9817eb5ed85a470e5b1fe8ed03c',
    PZO9419: '7e0658ece474e04c5d6a19d632df7b455382f0a3ff32cb35e2e9015a2d854713',
    PZO9416: 'd5c16441231713cd563300c6538b849a79e157fcff1a961651412d10aae00ddc',
    PZO1137: '87b4c46ec0d17fe7801a750918f5aa1cbc93b1930a27e9fe6a0a2a0d63be9f50',
    PZO9269: '40a6e70ba8686e3e75629d580e9004a6f232abba4fc5a2483e157718051e6292',
  };
  for (const [code, hash] of Object.entries(seedHashes))
    expect(sha256(JSON.stringify(section15Registry[code]))).toBe(hash);
  expect(
    reviewedAdmission.assessments.filter((assessment) =>
      assessment.requiredNotices.some((code) => keys.includes(code)),
    ),
  ).toEqual([]);
  expect(review.retainedExceptions).toEqual([]);
});
