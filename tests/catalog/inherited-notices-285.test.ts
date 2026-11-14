// @vitest-environment node
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import review from '../../scripts/catalog/legal/inherited-notices-285.json';
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
  'ac8a797c8ef46e8c17a531c31815f3702a087883ef1342c093b2b318818447ce',
  'a28cb619eac8f029f634d9e71c7bb3b5e43d3a8f6bd62d48ade36ef22911cf14',
  'c3ce39636b507994df8657814f5f624eb77f3b2b2b05929106d3a01174aa95e5',
  '0d533c8c1bda63f24d18623acbcb2084e46697708d8126a10ba66bba82b0e19b',
  '69db97f44df558d297b96b716c1f5aa6e69bf13d8f1a8145d16c187e5f4a569f',
  '384dbf60ccac586cc41c02acb58cf6a029417798dc182b6eb32957c4d2796114',
  '5b7ce2bf125ec7980d9a34720f5ee2056d9c6a9b2e06dd7f30d2ec25485d084f',
  '16385407e773cab473144e3bd39bff64ede3f962e743454ce7d476b52a8f6743',
  'c42e787d65b633b92b1affdfc7c750d9e9eb7086967cc329942bac14c87f5d7a',
  '3e1fd411267c5858404e95e79c102383c19d3666bfc0428d7207f758bceb9482',
  '42054efa723992232068f9ebb0f06fa969ff32c21d594b05098465f11cdbed09',
  'fd035b2177f0114d81601d71c7fef7ede6b8be75ccf64076266f0dee5e5fb27d',
  '158fc051b031a64421dad85f4027aa66cde1d2849adddcd05ac52fffc90469af',
  '5dd26bfb1c3096fa8d5e1c3110c5475d79fb23d72153cc76e67dc77102d887a8',
  'eb6d9efe0c87ac83dbeb76ce99b1564dc8a3d63fbe935280773981c169d94ad6',
];
const keys = hashes.map((hash) => `pf1-content/notice/${hash}`);
const reviewer = 'Sol (AI curator) for the owner';

function sha256(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

function fixture(
  requiredNotices = keys,
  externalKey = 'fixture/notice-285',
  registry = section15Registry,
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

it('locates the exact immutable inventory in committed pinned upstream bytes', () => {
  expect(review.blocks.map((block) => block.key)).toEqual(keys);
  expect(new Set(keys).size).toBe(15);
  expect(review.inventoryOccurrences).toEqual(
    keys.map((key, index) => ({
      occurrence: index + 1,
      key,
      line: index + 353,
      registryKey: key,
      disposition: 'reviewed-notice',
      duplicateOccurrenceOf: null,
    })),
  );
  expect(review.reviewedBy).toBe(reviewer);
  expect(review.reviewedOn).toBe('2026-10-08');
  for (const [repo, source] of Object.entries(review.sources)) {
    const upstream = legalResources.upstreamNotices.find(
      (notice) => notice.id === source.legalResourceId,
    )!;
    const original = legalResources.ogl.text + upstream.text;
    expect(sha256(original)).toBe(source.fileSha256);
    const lines = original.split('\n');
    for (const block of review.blocks) {
      if (repo === 'pf1') {
        expect(lines.some((line) => sha256(line) === block.textSha256)).toBe(
          false,
        );
        continue;
      }
      const notice = resolveNotice({
        registry: section15Registry,
        code: block.key,
      })!;
      expect(block).toMatchObject({
        source: 'pf1-content',
        kind: 'complete-notice',
        joinedWith: [],
        registryKey: block.key,
      });
      expect(block.line).toBe(keys.indexOf(block.key) + 353);
      expect(sha256(lines[block.line - 1]!)).toBe(block.textSha256);
      expect(block.textSha256).toBe(block.key.split('/').at(-1));
      expect(block.keySha256).toBe(block.textSha256);
      expect(
        lines.filter((line) => sha256(line) === block.textSha256),
      ).toHaveLength(1);
      expect(notice.notice).toBe(lines[block.line - 1]);
      expect(notice).toMatchObject({
        checkedAgainst: 'pf1-content',
        checkedOn: '2026-10-08',
        reviewStatus: 'reviewed',
        aliases: [],
      });
      expect(notice.provenance).toEqual(
        expect.arrayContaining([
          `Reviewed by ${reviewer} on 2026-10-08.`,
          `${source.url}#L${block.line}`,
          `pf1-content/OGL.txt:${block.line}; tag ${source.tag}; commit ${source.commit}; file sha256:${source.fileSha256}; line sha256:${block.textSha256}`,
        ]),
      );
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
          externalKey: 'fixture/notice-285',
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
        externalKey: 'fixture/notice-285',
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

it('admits unrelated assessed content while holding unassessed and batch-dependent entries', () => {
  const affected = fixture();
  const unrelated = fixture(['CRB'], 'fixture/unrelated');
  const unassessed = fixture(['CRB'], 'fixture/unassessed');
  const inputs = [affected, unrelated, unassessed];
  const result = assessWithUnclearedHolds({
    ...affected,
    artifact: {
      catalog: {
        entries: inputs.flatMap((input) => input.artifact.catalog.entries),
      },
      comparison: {
        packs: [],
        records: inputs.flatMap((input) => input.artifact.comparison.records),
      },
    },
    assessments: [...affected.assessments, ...unrelated.assessments],
  });
  expect(result.passed).toBe(true);
  expect(result.admitted.map((row) => row.externalKey)).toEqual([
    'fixture/unrelated',
  ]);
  expect(result.held.map((row) => row.externalKey)).toEqual([
    'fixture/notice-285',
    'fixture/unassessed',
  ]);
  expect(result.held[0]?.reason).toMatch(/^Notice holds: /);
  expect(result.held[1]?.reason).toBe('missing Attribution Assessment');
  expect(result.requiredNotices).toEqual(['CRB']);
  expect(result.failures).toEqual([]);
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
        externalKey: 'fixture/notice-285',
        reason: expect.stringContaining('Notice bindings require re-review:'),
      },
    ],
  });
});

it('keeps every full-book chain held without inventing title aliases', () => {
  expect(
    review.holds
      .filter((hold) => hold.id.startsWith('notice-285-complete-chain-'))
      .map((hold) => hold.noticeKey),
  ).toEqual(keys);
  expect(new Set(review.holds.map((hold) => hold.id)).size).toBe(18);
  for (const hold of review.holds) {
    expect(hold.status).toBe('held');
    expect(
      resolveNotice({ registry: section15Registry, code: hold.title }),
    ).toBeUndefined();
  }
  const requiredNotices = [...new Set(review.holds.map((hold) => hold.title))];
  expect(
    buildLegalPageData({
      registry: section15Registry,
      resources: legalResources,
      permanentNoticeSuperset: legalResources.permanentNoticeSuperset,
      requiredNotices,
    }).outstandingNotices,
  ).toEqual(
    requiredNotices
      .sort()
      .map((code) => ({ code, title: code, reason: 'missing' })),
  );
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
      held: [{ externalKey: 'fixture/notice-285', missingNotices: [code] }],
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
      notices: expect.arrayContaining([
        hold.noticeKey,
        ...(hold.relatedNoticeKeys ?? []),
      ]),
      evidence: ['scripts/catalog/legal/inherited-notices-285.json'],
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
        externalKey: 'fixture/notice-285',
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
        externalKey: 'fixture/notice-285',
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
        externalKey: 'fixture/notice-285',
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

it('retains literal dates, publisher wording and apostrophe variants without merging', () => {
  const years = [
    2010, 2013, 2013, 2014, 2010, 2011, 2012, 2012, 2010, 2011, 2017, 2016,
    2016, 2014, 2012,
  ];
  for (const [index, code] of keys.entries()) {
    const publisher = [3, 10, 11, 12].includes(index)
      ? 'Paizo Inc.'
      : 'Paizo Publishing, LLC';
    expect(section15Registry[code]!.notice).toContain(
      `© ${years[index]}, ${publisher};`,
    );
    expect(section15Registry[code]!.aliases).toEqual([]);
  }
  const straight = section15Registry[keys[1]!]!;
  const curly = section15Registry[keys[2]!]!;
  expect(straight.title).toBe("Pathfinder Module: The Dragon's Demand");
  expect(curly.title).toBe('Pathfinder Module: The Dragon’s Demand');
  expect(straight.notice.replace("Dragon's", 'Dragon’s')).toBe(curly.notice);
  expect(straight).not.toBe(curly);
  expect(
    review.holds
      .filter((hold) => hold.id.includes('dragons-demand-variant-'))
      .map((hold) => hold.noticeKey),
  ).toEqual([keys[1], keys[2]]);
  expect(review.holds).toHaveLength(18);
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

it('holds the out-of-batch Emerald Spire sibling without creating a Registry record', () => {
  const sibling =
    'pf1-content/notice/3f61d498de986d3fca03e8df628b9dbdbf14d808b06b84d7750d230568b0e65b';
  const hold = heldNotices.find(
    (item) => item.id === 'notice-285-emerald-spire-variant-comparison',
  );
  expect(hold?.notices).toEqual([keys[3], sibling]);
  expect(review.blocks.map((block) => block.key)).not.toContain(sibling);
  expect(section15Registry[sibling]?.provenance ?? []).not.toContain(
    'scripts/catalog/legal/inherited-notices-285.json',
  );
  const upstream = legalResources.upstreamNotices.find(
    (notice) => notice.id === 'pf1-content',
  )!;
  const line = (legalResources.ogl.text + upstream.text).split('\n')[344]!;
  expect(sha256(line)).toBe(sibling.split('/').at(-1));
  expect(line).toContain('Emerald Spire, © 2014, Paizo Publishing, LLC;');
  expect(line).toContain('Nick Logue');
  expect(line).toContain('James Sutter.');
  expect(section15Registry[keys[3]!]!.notice).toContain('Nicolas Logue');
  expect(section15Registry[keys[3]!]!.notice).toContain('James L. Sutter.');
  // A later independent notice review cannot silently lift this reconciliation hold.
  const registry = structuredClone(section15Registry);
  registry[sibling] = {
    ...registry[keys[3]!]!,
    title: 'Pathfinder Module: Emerald Spire',
    notice: line,
    provenance: ['Synthetic later-reviewed sibling for gate behavior only.'],
  };
  const result = assessWithUnclearedHolds(
    fixture([sibling], 'fixture/later-reviewed-sibling', registry),
  );
  expect(result.passed).toBe(true);
  expect(result.admitted).toEqual([]);
  expect(result.held[0]?.missingNotices).toEqual([]);
  expect(result.held[0]?.reason).toContain(
    'notice-285-emerald-spire-variant-comparison',
  );
});
