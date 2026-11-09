// @vitest-environment node
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import review from '../../scripts/catalog/legal/inherited-notices-277.json';
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
  '40e8b9aa3002527f04beffb017202b96ac475464df79c7196e10dfc505cb3564',
  'de25ec378b743612864b12206a5a00e5f90dccfc4354bac078d376401e47bffb',
  '2b0b734297bc0887e81a5d722dc362a873d4223d40e49bcd884e777864279cc0',
  'cc0d5bad4b0ea4acc5d082c8de74c1a5d5b1e32c5b96e9b1595676cf063c896b',
  '7bc3133e47788188ceff6d338ebc7330257a1ede3552bb6c6240e5a4d3f62192',
  '94fef81e7bfc329be1e973d60c0bf11ec5d535d5804e483a9b38f5163904f2fe',
  '2526440edcebd2bc34bf0e7351c0e0e0a9712152d42397d3d42bb1867aef8f1d',
  '92c503f23726bf2d9023f502cc5a5d2fa800c334eadd21ea2bdfcedacb7afdbc',
  '055ba424cde3a1216b9dae15d7f9cc35d84142c1814c62ac9657626a2a60f22f',
  '4c65444b5d32f505638e0d75614111726f2e897fef2545d7624247de67077b1c',
  '8762fe3adced7279e6d0e6f4b611b7a8440772200adf3aa67bafa8a9458a86e3',
  'c90100d8b6aa3139720830f4a97cf4003581a19a3414bc2ba98cb0309df994ae',
  '46998674f7e9abd34371ed3973632405e9073ad6812fcfddc5413a731b64f2c9',
  '0ce5e09f239d1d36d0ad488745029bfcdb7901069dca1054cb9f91fea0eab9e7',
  '77d60d286f71771817a07038d755c1a66f130428e4e069af1cbe38429b2141d5',
];
const keys = hashes.map((hash) => `pf1-content/notice/${hash}`);
const reviewer = 'Sol (AI curator) for the owner';

function sha256(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

function fixture(requiredNotices = keys) {
  const entry: PreviewEntry = {
    externalKey: 'fixture/notice-277',
    upstreamKey: 'fixture/notice-277',
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
          path: 'notice-277.yaml',
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
    233, 234, 235, 236, 237, 238, 239, 240, 241, 242, 243, 244, 245, 246, 247,
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
          externalKey: 'fixture/notice-277',
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
        externalKey: 'fixture/notice-277',
        requiredNotices: [...keys].sort(),
        missingNotices: [],
        reason: expect.stringMatching(/^Notice holds: /),
      },
    ],
    failures: [],
  });
  for (const hold of review.holds.filter((hold) =>
    keys.includes(hold.noticeKey),
  )) {
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
    admitted: [{ externalKey: 'fixture/notice-277', requiredNotices: [code] }],
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
        externalKey: 'fixture/notice-277',
        reason: expect.stringContaining('Notice bindings require re-review:'),
      },
    ],
  });
});

it('keeps full book chains and pre-existing unreviewed seeds outstanding', () => {
  expect(
    review.holds
      .filter((hold) => hold.id.startsWith('notice-277-complete-chain-'))
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
        externalKey: 'fixture/notice-277',
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
      held: [{ externalKey: 'fixture/notice-277', missingNotices: [code] }],
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
    expect(holds[0]?.id).toBe(`notice-277-complete-chain-${block.textSha256}`);
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

it('reopens the content comparison after the synthetic definition changes', () => {
  const input = fixture();
  input.artifact.catalog.entries[0]!.description += ' Changed content.';
  expect(assessWithUnclearedHolds(input)).toMatchObject({
    passed: true,
    admitted: [],
    held: [
      {
        externalKey: 'fixture/notice-277',
        reason:
          'Accepted assessment no longer matches current content — re-review required.',
      },
    ],
    failures: [],
  });
});

it('preserves literal title punctuation, copyright dates and contributor wording', () => {
  for (const [index, key] of keys.entries()) {
    const notice = section15Registry[key]!.notice;
    expect(notice.endsWith('.')).toBe(true);
    expect(notice).toContain(
      `© ${index < 6 ? 2011 : index < 14 ? 2012 : 2013}, Paizo Publishing, LLC;`,
    );
    expect(notice).toContain(index < 3 ? '. © ' : ' © ');
    if (index >= 3) expect(notice).not.toContain('. © ');
    expect(notice).toContain(index === 10 ? '; Authors:' : '; Author:');
  }
  expect(section15Registry[keys[10]!]!.notice).toBe(
    'Pathfinder Adventure Path #60: From Hell’s Heart © 2012, Paizo Publishing, LLC; Authors: Jason Nelson and Rob McCreary.',
  );
  expect(section15Registry[keys[12]!]!.title).toBe(
    'Pathfinder Adventure Path #62: Curse of the Lady’s Light',
  );
  expect(section15Registry[keys[14]!]!.title).toBe(
    'Pathfinder Adventure Path #71: Rasputin Must Die!',
  );
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
        externalKey: 'fixture/notice-277',
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
        externalKey: 'fixture/notice-277',
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
        externalKey: 'fixture/notice-277',
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
