// @vitest-environment node
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import review from '../../scripts/catalog/legal/inherited-notices-280.json';
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
  '6c433b350764d01147e81ccae454c230072faa889b45a2bb40b18b09b8519d24',
  '2cf187d8ee06bcafe68c2b64c4c3898ecb7e84b9f201e9cd89308d21d632fec5',
  '072a665d99814fbe62110c67aec9b38a741175aff12ff6405c22e9e2feefb668',
  '596ab229b011c01ad4c2f963dc99b539973ee2d39d0caceac69418dd3e6b2e14',
  '6f57ede4a9dfbb759482f9880e2c545851b43146ce1077c682062b8ba8077c7b',
  'e870a5e7f296392be9db00299d2e92539db046fc0cad02c6d9d8d36424f30c6f',
  '9234bebbfeed709c64f70c12c17ae18f16b41d61970a18d01d99fb59d5604d07',
  'd59b8a895cfbc7806f018ecd79940f8aa498fd27cb73d56780891ca89e07b955',
  '658bcecd623a64c9c2b150bfa49a190b51d2b99b052a633493a25a93638c078b',
  '66d1e441821e7dc19356527e588912b9327f2e2028995f8f7d3459981459cf98',
  'c71414f6ea1d6100b8ccb1673439dd481ace41f11719f58ff10bd65d0f6d0336',
  '93741e21d25ecfb4bcddbc4a7327b9930270dc095024b353d3a2fe5248f1f0f2',
  '7da6fc0fb447cd40742ecedfe25750c86f062b7aa5c0cc457ed0d622d0bff22d',
  'd176e960db083ad2c6f1bee6a786ccb0b1e4d6d4c1b294f0a5bd91774c29c19b',
  'd5e5de6bfc6ff29a5528b9e813a027cc5782993044938dea69f1fd317af63ee8',
];
const keys = hashes.map((hash) => `pf1-content/notice/${hash}`);
const reviewer = 'Sol (AI curator) for the owner';

function sha256(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

function fixture(requiredNotices = keys, externalKey = 'fixture/notice-280') {
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

it('locates all 15 complete verbatim notices and distinguishes the normalized ticket suffix from raw source hashes', () => {
  expect(review.blocks.map((block) => block.key)).toEqual(keys);
  expect(new Set(keys).size).toBe(15);
  expect(review.inventoryOccurrences).toEqual(
    keys.map((key, index) => ({
      occurrence: index + 1,
      key,
      line: index + 278,
      registryKey: key,
      disposition: 'reviewed-notice',
      duplicateOccurrenceOf: null,
    })),
  );
  expect(review.blocks.map((block) => block.line)).toEqual([
    278, 279, 280, 281, 282, 283, 284, 285, 286, 287, 288, 289, 290, 291, 292,
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
    if (repo === 'pf1-content') {
      expect(
        original.split('\n').some((line) => sha256(line) === hashes[12]),
      ).toBe(false);
    }
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
      expect(
        sha256(block.line === 290 ? physicalLine.slice(0, -1) : physicalLine),
      ).toBe(block.keySha256);
      expect(
        lines.filter((line) => sha256(line) === block.textSha256),
      ).toHaveLength(1);
      expect(notice.notice).toBe(physicalLine.trimEnd());
      expect(sha256(notice.notice)).toBe(block.keySha256);
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
          externalKey: 'fixture/notice-280',
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
        externalKey: 'fixture/notice-280',
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
    admitted: [{ externalKey: 'fixture/notice-280', requiredNotices: [code] }],
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
        externalKey: 'fixture/notice-280',
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
        externalKey: 'fixture/notice-280',
        reason: expect.stringContaining('Notice bindings require re-review:'),
      },
    ],
  });
});

it('keeps full book chains and pre-existing unreviewed seeds outstanding', () => {
  expect(
    review.holds
      .filter((hold) => hold.id.startsWith('notice-280-complete-chain-'))
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
        externalKey: 'fixture/notice-280',
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
      held: [{ externalKey: 'fixture/notice-280', missingNotices: [code] }],
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
      evidence: ['scripts/catalog/legal/inherited-notices-280.json'],
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
        externalKey: 'fixture/notice-280',
        reason:
          'Accepted assessment no longer matches current content — re-review required.',
      },
    ],
    failures: [],
  });
});

it('preserves literal years, publisher spelling, spacing, title periods and missing terminal periods', () => {
  const copyrightYears = [
    2013, 2015, 2012, 2011, 2010, 2011, 2012, 2014, 2010, 2013, 2014, 2015,
    2014, 2015, 2014,
  ];
  for (const [index, code] of keys.entries()) {
    expect(section15Registry[code]!.notice).toContain(
      `${index === 4 || index === 8 ? 'Copyright' : '©'} ${copyrightYears[index]}`,
    );
  }
  expect(section15Registry[keys[1]!]!.notice).toContain(
    'Rob McCreary,  Jessica Price',
  );
  expect(section15Registry[keys[4]!]!.title).toBe(
    'Pathfinder Campaign Setting: Lords of Chaos: Book of the Damned, Vol. 2.',
  );
  expect(
    section15Registry[keys[4]!]!.notice.endsWith('Author: James Jacobs'),
  ).toBe(true);
  expect(section15Registry[keys[5]!]!.title).toBe(
    'Pathfinder Campaign Setting: Lost Cities of Golarion.',
  );
  expect(section15Registry[keys[5]!]!.notice).toContain(
    '© 2011, Paizo Publishing, LLC. Authors:',
  );
  expect(section15Registry[keys[5]!]!.notice.endsWith('and Russ Taylor')).toBe(
    true,
  );
  expect(section15Registry[keys[8]!]!.notice).toContain(
    'Copyright 2010, Paizo Publushing, LLC; Authors:',
  );
  expect(section15Registry[keys[11]!]!.notice).toContain('Joe Homes');
  expect(section15Registry[keys[14]!]!.notice).toContain('Jonathan H. Keith');
});

it('stores the Occult Mysteries notice trimmed so its hash is the ticket key, keeping the raw-line hash and the complete-chain hold', () => {
  const block = review.blocks[12]!;
  const notice = section15Registry[keys[12]!]!;
  expect(block).toMatchObject({
    line: 290,
    textSha256:
      '75497a028ee2f7090b17cf09a7613cc0e5a892a2d25422188d948a4f7e319428',
    keySha256: hashes[12],
  });
  expect(notice.notice).toBe(notice.notice.trim());
  expect(sha256(notice.notice)).toBe(block.keySha256);
  expect(sha256(`${notice.notice} `)).toBe(block.textSha256);
  expect(block.textSha256).not.toBe(block.keySha256);
  expect(notice.provenance).toContain(
    `pf1-content/OGL.txt:290; tag 11.4.0; commit 02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d; file sha256:10bcdc68296b48cc250f38e49de09c9a73645163d7ac7f76e77346a755c35cdc; line sha256:${block.textSha256}`,
  );
  expect(notice.notice).toBe(section15Registry.PZO9269!.notice);
  expect(section15Registry.PZO9269!.provenance.join(' ')).toContain(
    `sha256:${block.textSha256}`,
  );
  expect(section15Registry.PZO9269).toMatchObject({
    checkedOn: '2026-10-02',
    reviewStatus: 'unreviewed',
    aliases: [],
  });
  expect(
    resolveNotice({
      registry: section15Registry,
      code: `pf1-content/notice/${block.textSha256}`,
    }),
  ).toBeUndefined();
  const released = 'notice-280-occult-mysteries-key-normalization';
  expect(review.holds.map((hold) => hold.id)).not.toContain(released);
  expect(heldNotices.map((hold) => hold.id)).not.toContain(released);
  expect(
    heldNotices
      .filter((hold) => hold.notices.includes(block.key))
      .map((hold) => hold.id),
  ).toEqual([`notice-280-complete-chain-${hashes[12]}`]);
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
        externalKey: 'fixture/notice-280',
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
        externalKey: 'fixture/notice-280',
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
        externalKey: 'fixture/notice-280',
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
