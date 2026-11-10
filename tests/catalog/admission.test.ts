// @vitest-environment node
import { expect, it, vi } from 'vitest';
import * as noticeResolver from '../../src/lib/catalog/resolve-notice';
import {
  assessCatalogAdmission,
  buildAssessmentBinding,
  computeFingerprint,
} from '../../scripts/catalog/admission';
import type {
  AttributionAssessment,
  AttributionEvidence,
  Section15Registry,
} from '../../src/lib/catalog/admission-schema';
import type { PreviewEntry } from '../../scripts/catalog/map';
import type { CurationRecord } from '../../scripts/catalog/curation';
import { section15Registry } from '../../src/lib/catalog/section15-registry-data';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import {
  committedNoticeClearances,
  knownNoticeHoldReason,
} from '../../scripts/catalog/legal/notice-clearances';

function entry(externalKey = 'pf1/feat'): PreviewEntry {
  return {
    externalKey,
    upstreamKey: externalKey,
    pack: 'feats',
    name: 'Reviewed feat',
    description: '<p>Fixture content.</p>',
    detail: { kind: 'feat', featTypes: [], repeatable: 'unreviewed' },
    sources: [],
    modifiers: [],
    unsupported: [],
  };
}

function fixture(entries = [entry()]) {
  const summary = {
    upstreamRecords: entries.length,
    admitted: entries.length,
    excluded: 0,
    unassigned: 0,
    byKind: {},
  };
  const artifact = {
    curation: {
      passed: true,
      missing: [],
      applied: [],
      stale: [],
      unused: [],
      unresolvedMechanics: [],
      unresolvedDescriptions: [],
      summary: {
        required: 0,
        drafted: 0,
        checked: 0,
        missing: 0,
        descriptions: { candidates: 0, drafted: 0, checked: 0 },
      },
    },
    catalog: {
      purpose: 'preview',
      releaseAdmission: 'not-evaluated',
      remaps: [],
      inputs: [],
      summary,
      entries,
      resources: [] as PreviewEntry[],
    },
    unsupported: {
      purpose: 'preview',
      summary: { entries: 0, issues: 0 },
      entries: [],
    },
    comparison: {
      coverageComplete: true,
      summary,
      packs: [],
      records: entries.map((item) => ({
        repo: 'pf1' as const,
        pack: item.pack,
        path: `${item.externalKey}.yaml`,
        externalKey: item.upstreamKey,
        name: item.name,
        status: 'admitted' as const,
        reason: 'In scope',
      })),
    },
  };
  const registry = {
    BOOK: {
      title: 'Fixture book',
      notice: 'Fixture copyright notice.',
      checkedAgainst: 'printed' as const,
      checkedOn: '2026-10-02',
      aliases: [] as string[],
      reviewStatus: 'reviewed' as const,
      provenance: ['Fixture printed book'],
    },
  };
  const evidence: AttributionEvidence = {
    comparison: {
      content: 'Whole fixture content compared with fixture book.',
    },
  };
  const assessments: AttributionAssessment[] = entries.map((item) => ({
    externalKey: item.externalKey,
    status: 'confirmed',
    ...buildAssessmentBinding({
      entry: item,
      artifact,
      evidence,
      registry,
      requiredNotices: ['BOOK'],
      evidenceIds: ['comparison'],
    }),
    requiredNotices: ['BOOK'],
    rationale: 'The complete definition matches the fixture book.',
    reviewedBy: 'Fixture reviewer',
    reviewedOn: '2026-10-02',
  }));
  return { artifact, registry, evidence, assessments };
}

it('reports curation diagnostic text in the admission failure', () => {
  const input = fixture();
  const record: CurationRecord = {
    externalKey: 'pf1/feat',
    kind: 'note',
    target: '',
    text: 'Needs review',
    textSha256: '0'.repeat(64),
    status: 'drafted',
    outputs: [],
    rationale: 'Fixture awaiting review.',
    diagnostics: [
      { kind: 'review', text: 'Review the remaining circumstance.' },
      { kind: 'unresolved', text: 'Unsupported target.' },
    ],
    seedBindings: [],
  };
  const artifact = {
    ...input.artifact,
    curation: {
      ...input.artifact.curation,
      passed: false,
      unresolvedMechanics: [record],
    },
  };
  expect(
    assessCatalogAdmission({ ...input, artifact }).failures,
  ).toContainEqual({
    externalKey: 'pf1/feat',
    reason:
      'Unresolved curation mechanics: Review the remaining circumstance. Unsupported target.',
  });
});

function reviewedPair() {
  const unrelated = entry('pf1/unrelated');
  const original = fixture([entry(), unrelated]);
  const unrelatedAssessment = original.assessments[1];
  if (!unrelatedAssessment) throw new Error('Fixture assessment missing');
  const evidence: AttributionEvidence = {
    ...original.evidence,
    unrelated: { content: 'Independent whole-content comparison.' },
  };
  const input = {
    ...original,
    registry: {
      ...original.registry,
      OTHER: { ...original.registry.BOOK },
    },
    evidence,
  };
  input.assessments[1] = {
    ...unrelatedAssessment,
    requiredNotices: ['OTHER'],
    ...buildAssessmentBinding({
      entry: unrelated,
      artifact: input.artifact,
      evidence: input.evidence,
      registry: input.registry,
      requiredNotices: ['OTHER'],
      evidenceIds: ['unrelated'],
    }),
  };
  return input;
}

it('admits a definition with a current content review and its reviewed notices', () => {
  const result = assessCatalogAdmission(fixture());
  expect(result.passed).toBe(true);
  expect(result.admitted).toEqual([
    expect.objectContaining({
      externalKey: 'pf1/feat',
      name: 'Reviewed feat',
      requiredNotices: ['BOOK'],
    }),
  ]);
  expect(result.failures).toEqual([]);
});

it('holds changed accepted content while admitting an unrelated reviewed definition', () => {
  const input = fixture([entry(), entry('pf1/unrelated')]);
  input.artifact.catalog.entries[0]!.description = 'Changed content';
  expect(assessCatalogAdmission(input)).toMatchObject({
    passed: true,
    admitted: [{ externalKey: 'pf1/unrelated' }],
    held: [
      {
        externalKey: 'pf1/feat',
        reason:
          'Accepted assessment no longer matches current content — re-review required.',
        requiredNotices: ['BOOK'],
        missingNotices: [],
        evidence: ['comparison'],
      },
    ],
    failures: [],
  });
});

it('reports an intentional unresolved assessment without failing unrelated admission', () => {
  const input = fixture([entry(), entry('pf1/unresolved')]);
  input.assessments[1]!.status = 'unresolved';
  input.assessments[1]!.rationale =
    'Whole-content comparison is still missing.';
  input.assessments[1]!.requiredNotices = ['MISSING'];
  input.assessments[1]!.noticeFingerprints = {};
  const result = assessCatalogAdmission(input);
  expect(result.passed).toBe(true);
  expect(result.admitted.map((row) => row.externalKey)).toEqual(['pf1/feat']);
  expect(result.held).toEqual([
    expect.objectContaining({
      externalKey: 'pf1/unresolved',
      reason: 'Whole-content comparison is still missing.',
      missingNotices: ['MISSING'],
    }),
  ]);
});

it.each([{ books: [] }, { books: ['MISSING'] }])(
  'holds an inventoried definition without an Attribution Assessment for sources $books',
  ({ books }) => {
    const candidate = entry('pf1/new-unsourced-feat');
    candidate.sources = books.map((book) => ({ book }));
    const input = fixture([entry(), candidate]);
    input.assessments = input.assessments.slice(0, 1);
    const result = assessCatalogAdmission(input);
    expect(result.passed).toBe(true);
    expect(result.admitted.map((row) => row.externalKey)).toEqual(['pf1/feat']);
    expect(result.held).toEqual([
      {
        externalKey: 'pf1/new-unsourced-feat',
        name: 'Reviewed feat',
        reason: 'missing Attribution Assessment',
        requiredNotices: books,
        missingNotices: books,
        evidence: [],
      },
    ]);
    expect(result.failures).toEqual([]);
  },
);

it('holds an otherwise reviewed definition with no identified source notices', () => {
  const input = fixture();
  const assessment = input.assessments[0];
  if (!assessment) throw new Error('Fixture assessment missing');
  assessment.requiredNotices = [];
  assessment.noticeFingerprints = {};
  expect(assessCatalogAdmission(input)).toMatchObject({
    passed: true,
    admitted: [],
    held: [
      {
        externalKey: 'pf1/feat',
        reason:
          'Missing source notice attribution: no sources or required notices identified — re-review required.',
        requiredNotices: [],
        missingNotices: [],
        evidence: ['comparison'],
      },
    ],
    failures: [],
  });
});

it.each(['content', 'mapping'])(
  'keeps an unresolved definition held when its %s changes',
  (change) => {
    const input = fixture();
    const assessment = input.assessments[0];
    const candidate = input.artifact.catalog.entries[0];
    const record = input.artifact.comparison.records[0];
    if (!assessment || !candidate || !record)
      throw new Error('Fixture missing');
    assessment.status = 'unresolved';
    if (change === 'content') candidate.description = 'New unreviewed content';
    else {
      candidate.upstreamKey = 'pf1/new';
      record.externalKey = 'pf1/new';
    }
    expect(assessCatalogAdmission(input)).toMatchObject({
      passed: true,
      admitted: [],
      held: [{ externalKey: 'pf1/feat', reason: assessment.rationale }],
      failures: [],
    });
  },
);

const acceptedReviewGaps: {
  problem: string;
  change: (input: ReturnType<typeof reviewedPair>) => void;
  reason: string;
  missingNotices?: string[];
  evidence?: string[];
}[] = [
  {
    problem: 'changed content',
    change: (input) => {
      input.artifact.catalog.entries[0]!.description = 'Changed';
    },
    reason:
      'Accepted assessment no longer matches current content — re-review required.',
  },
  {
    problem: 'changed mapping',
    change: (input) => {
      input.assessments[0]!.mappingFingerprint = '0'.repeat(64);
    },
    reason:
      'Accepted assessment no longer matches current identity mapping — re-review required.',
  },
  {
    problem: 'changed evidence',
    change: (input) => {
      input.evidence.comparison!.content = 'Corrected comparison';
    },
    reason: 'Attribution evidence requires re-review: comparison (changed).',
  },
  {
    problem: 'absent evidence',
    change: (input) => {
      delete input.evidence.comparison;
    },
    reason: 'Attribution evidence requires re-review: comparison (missing).',
  },
  {
    problem: 'blank evidence',
    change: (input) => {
      input.evidence.comparison!.content = ' ';
    },
    reason: 'Attribution evidence requires re-review: comparison (missing).',
  },
  {
    problem: 'revoked evidence',
    change: (input) => {
      input.evidence.comparison!.revoked = true;
    },
    reason: 'Attribution evidence requires re-review: comparison (revoked).',
  },
  {
    problem: 'no bound evidence',
    change: (input) => {
      input.assessments[0]!.evidenceFingerprints = {};
    },
    reason:
      'Accepted assessment has no attribution evidence — re-review required.',
    evidence: [],
  },
  {
    problem: 'changed notice text',
    change: (input) => {
      input.registry.BOOK.notice = 'Corrected notice';
    },
    reason: 'Notice bindings require re-review: BOOK (changed).',
  },
  {
    problem: 'absent notice binding',
    change: (input) => {
      input.assessments[0]!.noticeFingerprints = {};
    },
    reason: 'Notice bindings require re-review: BOOK (missing).',
  },
  {
    problem: 'missing required notice',
    change: (input) => {
      input.assessments[0]!.requiredNotices = ['ABSENT'];
    },
    reason: 'Missing or unreviewed required notices: ABSENT.',
    missingNotices: ['ABSENT'],
  },
  {
    problem: 'blank notice text',
    change: (input) => {
      input.registry.BOOK.notice = ' ';
    },
    reason: 'Missing or unreviewed required notices: BOOK.',
    missingNotices: ['BOOK'],
  },
  {
    problem: 'unreviewed notice',
    change: (input) => {
      Object.assign(input.registry.BOOK, {
        reviewStatus: 'unreviewed',
        checkedAgainst: 'unreviewed',
      });
    },
    reason: 'Missing or unreviewed required notices: BOOK.',
    missingNotices: ['BOOK'],
  },
  {
    problem: 'notice without review provenance',
    change: (input) => {
      input.registry.BOOK.provenance = [];
    },
    reason: 'Missing or unreviewed required notices: BOOK.',
    missingNotices: ['BOOK'],
  },
];

it.each(
  (['confirmed', 'reviewed-coverage'] as const).flatMap((status) =>
    acceptedReviewGaps.map((gap) => ({ ...gap, status })),
  ),
)(
  'holds $status attribution with $problem without failing unrelated admission',
  ({
    status,
    change,
    reason,
    missingNotices = [],
    evidence = ['comparison'],
  }) => {
    const input = reviewedPair();
    input.assessments[0]!.status = status;
    change(input);
    const result = assessCatalogAdmission(input);
    expect(result).toMatchObject({
      passed: true,
      admitted: [{ externalKey: 'pf1/unrelated' }],
      held: [{ externalKey: 'pf1/feat', reason, missingNotices, evidence }],
      requiredNotices: ['OTHER'],
      failures: [],
    });
  },
);

it('fails a candidate absent from the import inventory', () => {
  const input = fixture();
  input.artifact.comparison.records = [];
  expect(assessCatalogAdmission(input)).toMatchObject({
    passed: false,
    admitted: [],
    failures: [
      {
        externalKey: 'pf1/feat',
        reason: expect.stringMatching(/unaccounted/i),
      },
    ],
  });
});

it('reports mapping, content and evidence review gaps together while preserving unrelated admission and missing notices', () => {
  const input = reviewedPair();
  input.artifact.catalog.entries[0]!.upstreamKey = 'pf1/new';
  input.artifact.comparison.records[0]!.externalKey = 'pf1/new';
  input.artifact.catalog.entries[0]!.description = 'Changed content';
  input.evidence.comparison!.revoked = true;
  input.assessments[0]!.requiredNotices = ['ABSENT'];
  expect(assessCatalogAdmission(input)).toMatchObject({
    passed: true,
    admitted: [{ externalKey: 'pf1/unrelated' }],
    held: [
      {
        externalKey: 'pf1/feat',
        reason:
          'Accepted assessment no longer matches current identity mapping — re-review required. ' +
          'Accepted assessment no longer matches current content — re-review required. ' +
          'Attribution evidence requires re-review: comparison (revoked).',
        requiredNotices: ['ABSENT'],
        missingNotices: ['ABSENT'],
        evidence: ['comparison'],
      },
    ],
    requiredNotices: ['OTHER'],
    failures: [],
  });
});

it.each(
  (['content', 'mapping'] as const).flatMap((changedPart) =>
    (['missing', 'changed', 'revoked'] as const).map((evidenceGap) => ({
      changedPart,
      evidenceGap,
    })),
  ),
)(
  'reports $evidenceGap evidence and missing notices alongside changed $changedPart',
  ({ changedPart, evidenceGap }) => {
    const input = reviewedPair();
    if (changedPart === 'content')
      input.artifact.catalog.entries[0]!.description = 'Changed content';
    else {
      input.assessments[0]!.mappingFingerprint = '0'.repeat(64);
    }
    if (evidenceGap === 'missing') delete input.evidence.comparison;
    else if (evidenceGap === 'changed')
      input.evidence.comparison!.content = 'Corrected comparison';
    else input.evidence.comparison!.revoked = true;
    input.assessments[0]!.requiredNotices = ['ABSENT'];
    expect(assessCatalogAdmission(input)).toMatchObject({
      passed: true,
      admitted: [{ externalKey: 'pf1/unrelated' }],
      held: [
        {
          externalKey: 'pf1/feat',
          reason:
            (changedPart === 'content'
              ? 'Accepted assessment no longer matches current content — re-review required. '
              : 'Accepted assessment no longer matches current identity mapping — re-review required. ') +
            `Attribution evidence requires re-review: comparison (${evidenceGap}).`,
          requiredNotices: ['ABSENT'],
          missingNotices: ['ABSENT'],
          evidence: ['comparison'],
        },
      ],
      failures: [],
    });
  },
);

it('omits parents and resources transitively when their referenced definition is held', () => {
  const feature = entry('pf1/feature');
  const parent = {
    ...entry('pf1/parent'),
    description: '<a href="catalog:pf1/feature">Feature</a>',
  };
  const resource = {
    ...entry('pf1/resource'),
    description: '<a href="catalog:pf1/parent">Parent</a>',
  };
  const input = fixture([feature, parent, resource]);
  input.artifact.catalog.resources.push(input.artifact.catalog.entries.pop()!);
  input.assessments[0]!.status = 'unresolved';
  const result = assessCatalogAdmission(input);
  expect(result.passed).toBe(true);
  expect(result.admitted).toEqual([]);
  expect(result.held.map((row) => row.externalKey)).toEqual(['pf1/feature']);
  expect(
    result.dependentOmissions.map((row) => row.externalKey).sort(),
  ).toEqual(['pf1/parent', 'pf1/resource']);
});

it('fails an admitted definition whose required notice becomes unavailable and omits its dependents', () => {
  const feature = entry('pf1/feature');
  const parent = {
    ...entry('pf1/parent'),
    description: '<a href="catalog:pf1/feature">Feature</a>',
  };
  const resource = {
    ...entry('pf1/resource'),
    description: '<a href="catalog:pf1/parent">Parent</a>',
  };
  const input = {
    ...fixture([feature, parent, resource, entry('pf1/unrelated')]),
    registry: {
      ...fixture([]).registry,
      OTHER: { ...fixture([]).registry.BOOK },
    },
  };
  for (const assessment of input.assessments.slice(1)) {
    const candidate = input.artifact.catalog.entries.find(
      (item) => item.externalKey === assessment.externalKey,
    );
    if (!candidate) throw new Error('Fixture entry missing');
    assessment.requiredNotices = ['OTHER'];
    Object.assign(
      assessment,
      buildAssessmentBinding({
        entry: candidate,
        artifact: input.artifact,
        evidence: input.evidence,
        registry: input.registry,
        requiredNotices: ['OTHER'],
        evidenceIds: ['comparison'],
      }),
    );
  }
  input.artifact.catalog.resources.push(
    input.artifact.catalog.entries.splice(2, 1)[0]!,
  );
  const resolveNotice = noticeResolver.resolveNotice;
  let bookResolved = false;
  const resolver = vi
    .spyOn(noticeResolver, 'resolveNotice')
    .mockImplementation((args) => {
      if (args.code !== 'BOOK') return resolveNotice(args);
      if (bookResolved) return undefined;
      bookResolved = true;
      return resolveNotice(args);
    });
  try {
    const result = assessCatalogAdmission(input);
    expect(result).toMatchObject({
      passed: false,
      admitted: [{ externalKey: 'pf1/unrelated' }],
      held: [],
      requiredNotices: ['OTHER'],
      failures: [
        {
          externalKey: 'pf1/feature',
          reason:
            'Admitted candidate is missing reviewed required notices: BOOK.',
        },
      ],
    });
    expect(
      result.dependentOmissions.map((row) => ({
        externalKey: row.externalKey,
        reason: row.reason,
      })),
    ).toEqual([
      { externalKey: 'pf1/parent', reason: 'Dependent omission: pf1/feature.' },
      {
        externalKey: 'pf1/resource',
        reason: 'Dependent omission: pf1/parent.',
      },
    ]);
  } finally {
    resolver.mockRestore();
  }
});

it('resolves cyclic dependencies and preserves transitive omission order when a dependency becomes held', () => {
  const first = entry('pf1/first');
  const second = entry('pf1/second');
  const dependency = entry('pf1/dependency');
  first.description =
    '<a href="catalog:pf1/second">Second</a><a href="catalog:pf1/dependency">Dependency</a>';
  second.description = '<a href="catalog:pf1/first">First</a>';
  const input = fixture([first, second, dependency]);
  expect(
    assessCatalogAdmission(input).admitted.map((row) => row.externalKey),
  ).toEqual(['pf1/first', 'pf1/second', 'pf1/dependency']);
  const assessment = input.assessments[2];
  if (!assessment) throw new Error('Fixture assessment missing');
  assessment.status = 'unresolved';
  const result = assessCatalogAdmission(input);
  expect(result.passed).toBe(true);
  expect(result.admitted).toEqual([]);
  expect(
    result.dependentOmissions.map((row) => ({
      key: row.externalKey,
      reason: row.reason,
    })),
  ).toEqual([
    { key: 'pf1/first', reason: 'Dependent omission: pf1/dependency.' },
    { key: 'pf1/second', reason: 'Dependent omission: pf1/first.' },
  ]);
});

it('reopens a whole-content comparison when referenced content changes at its stable identity', () => {
  const input = fixture([
    entry(),
    {
      ...entry('pf1/parent'),
      description: '<a href="catalog:pf1/feat">Feat</a>',
    },
  ]);
  input.artifact.catalog.entries[0]!.description = 'Changed linked definition';
  const result = assessCatalogAdmission(input);
  expect(result).toMatchObject({
    passed: true,
    admitted: [],
    held: [
      { externalKey: 'pf1/feat' },
      {
        externalKey: 'pf1/parent',
        reason:
          'Accepted assessment no longer matches current content — re-review required.',
      },
    ],
    failures: [],
  });
});

it.each(['revoked evidence', 'missing notice binding'])(
  'omits dependent parents and resources transitively when their child has %s',
  (problem) => {
    const feature = entry('pf1/feature');
    const parent = {
      ...entry('pf1/parent'),
      description: '<a href="catalog:pf1/feature">Feature</a>',
    };
    const resource = {
      ...entry('pf1/resource'),
      description: '<a href="catalog:pf1/parent">Parent</a>',
    };
    const input = fixture([feature, parent, resource]);
    input.evidence.parents = { content: 'Independent parent comparisons.' };
    for (const assessment of input.assessments.slice(1)) {
      const candidate = input.artifact.catalog.entries.find(
        (item) => item.externalKey === assessment.externalKey,
      );
      if (!candidate) throw new Error('Fixture entry missing');
      Object.assign(
        assessment,
        buildAssessmentBinding({
          entry: candidate,
          artifact: input.artifact,
          evidence: input.evidence,
          registry: input.registry,
          requiredNotices: ['BOOK'],
          evidenceIds: ['parents'],
        }),
      );
    }
    input.artifact.catalog.resources.push(
      input.artifact.catalog.entries.pop()!,
    );
    if (problem === 'revoked evidence')
      input.evidence.comparison!.revoked = true;
    else input.assessments[0]!.noticeFingerprints = {};
    const result = assessCatalogAdmission(input);
    expect(result).toMatchObject({
      passed: true,
      admitted: [],
      held: [{ externalKey: 'pf1/feature' }],
      failures: [],
    });
    expect(
      result.dependentOmissions.map((row) => row.externalKey).sort(),
    ).toEqual(['pf1/parent', 'pf1/resource']);
  },
);

it.each(['content', 'evidence', 'notice'])(
  'admits the same stable identity after re-review of changed %s',
  (change) => {
    const input = fixture();
    if (change === 'content')
      input.artifact.catalog.entries[0]!.description = 'Corrected content';
    else if (change === 'evidence')
      input.evidence.comparison!.content = 'Corrected comparison';
    else input.registry.BOOK.notice = 'Corrected notice';
    expect(assessCatalogAdmission(input)).toMatchObject({
      passed: true,
      admitted: [],
      held: [{ externalKey: 'pf1/feat' }],
      failures: [],
    });
    Object.assign(
      input.assessments[0]!,
      buildAssessmentBinding({
        entry: input.artifact.catalog.entries[0]!,
        artifact: input.artifact,
        evidence: input.evidence,
        registry: input.registry,
        requiredNotices: ['BOOK'],
        evidenceIds: ['comparison'],
      }),
    );
    expect(assessCatalogAdmission(input)).toMatchObject({
      passed: true,
      admitted: [{ externalKey: 'pf1/feat' }],
      held: [],
      failures: [],
    });
  },
);

it.each([
  [
    'duplicate identity',
    (input: ReturnType<typeof fixture>) => {
      input.artifact.catalog.resources.push(input.artifact.catalog.entries[0]!);
    },
  ],
  [
    'broken link',
    (input: ReturnType<typeof fixture>) => {
      input.artifact.catalog.entries[0]!.description =
        '<a href="catalog:pf1/absent">Absent</a>';
    },
  ],
  [
    'lost feature reference',
    (input: ReturnType<typeof fixture>) => {
      input.artifact.catalog.entries[0]!.unsupported.push({
        field: 'links.classAssociations',
        reason: 'Missing or out-of-scope feature reference.',
      });
    },
  ],
  [
    'omitted inventory record',
    (input: ReturnType<typeof fixture>) => {
      input.artifact.catalog.entries = [];
    },
  ],
])('fails %s even when its assessment is an intentional hold', (_, change) => {
  const input = fixture();
  input.assessments[0]!.status = 'unresolved';
  change(input);
  const result = assessCatalogAdmission(input);
  expect(result.passed).toBe(false);
  expect(
    result.failures.some((failure) =>
      /broken|duplicate|unaccounted/i.test(failure.reason),
    ),
  ).toBe(true);
});

function retainedInput() {
  return {
    ...fixture([]),
    retainedUses: [
      {
        useId: 'saved-copy',
        externalKey: 'pf1/withdrawn',
        name: 'Existing edited copy',
        characterId: 'character-one',
        definitionFingerprint: 'last-usable-definition',
        admittedRelease: 1,
        requiredNotices: ['UNAVAILABLE'],
      },
    ],
    retainedExceptions: [
      {
        useId: 'saved-copy',
        externalKey: 'pf1/withdrawn',
        definitionFingerprint: 'last-usable-definition',
        reason: 'Attribution revoked; existing copy preserved.',
        requiredNotices: ['UNAVAILABLE'],
      },
    ],
  };
}

it('reports retained copies absent from the candidate without implying their missing notice is supplied', () => {
  const result = assessCatalogAdmission(retainedInput());
  expect(result.passed).toBe(true);
  expect(result.retainedExceptions).toEqual([
    expect.objectContaining({
      externalKey: 'pf1/withdrawn',
      useId: 'saved-copy',
      characterId: 'character-one',
      definitionFingerprint: 'last-usable-definition',
      missingNotices: ['UNAVAILABLE'],
    }),
  ]);
  expect(result.requiredNotices).toEqual(['UNAVAILABLE']);
  expect(result.admitted).toEqual([]);
});

it.each([
  [
    'unreported existing use',
    (input: ReturnType<typeof retainedInput>) => {
      input.retainedExceptions = [];
    },
  ],
  [
    'invented previous admission',
    (input: ReturnType<typeof retainedInput>) => {
      input.retainedUses = [];
    },
  ],
  [
    'held revision replacing last usable definition',
    (input: ReturnType<typeof retainedInput>) => {
      input.retainedExceptions[0]!.definitionFingerprint = 'held-revision';
    },
  ],
  [
    'lost retained notice obligation',
    (input: ReturnType<typeof retainedInput>) => {
      input.retainedExceptions[0]!.requiredNotices = [];
    },
  ],
])('fails a retained exception with %s', (_, change) => {
  const input = retainedInput();
  change(input);
  const result = assessCatalogAdmission(input);
  expect(result.passed).toBe(false);
  expect(result.failures).toContainEqual(
    expect.objectContaining({
      externalKey: 'pf1/withdrawn',
      reason: expect.stringMatching(/retained/i),
    }),
  );
});

it('invalidates notice evidence through aliases and shared revoked evidence', () => {
  const input = fixture([entry(), entry('pf1/second')]);
  input.registry.BOOK.aliases = ['OLD_CODE'];
  input.assessments = input.artifact.catalog.entries.map((item) => ({
    ...input.assessments[0]!,
    externalKey: item.externalKey,
    requiredNotices: ['OLD_CODE'],
    ...buildAssessmentBinding({
      entry: item,
      artifact: input.artifact,
      evidence: input.evidence,
      registry: input.registry,
      requiredNotices: ['OLD_CODE'],
      evidenceIds: ['comparison'],
    }),
  }));
  expect(assessCatalogAdmission(input).passed).toBe(true);
  input.registry.BOOK.notice = 'Corrected canonical notice';
  expect(assessCatalogAdmission(input)).toMatchObject({
    passed: true,
    admitted: [],
    held: [
      { reason: 'Notice bindings require re-review: OLD_CODE (changed).' },
      { reason: 'Notice bindings require re-review: OLD_CODE (changed).' },
    ],
    failures: [],
  });
  input.evidence = {
    comparison: {
      content: 'Whole fixture content compared with fixture book.',
      revoked: true,
    },
  };
  expect(assessCatalogAdmission(input).held.map((row) => row.reason)).toEqual([
    'Attribution evidence requires re-review: comparison (revoked).',
    'Attribution evidence requires re-review: comparison (revoked).',
  ]);
  expect(assessCatalogAdmission(input).failures).toEqual([]);
});

it('carries explicit importer attribution holds without fabricating a review', () => {
  const input = fixture();
  input.artifact.catalog.entries[0]!.unsupported.push({
    field: 'attribution',
    reason: 'Known notice/evidence hold (#227/#241).',
  });
  input.artifact.catalog.entries[0]!.sources = [{ book: 'MISSING' }];
  input.assessments = [];
  const result = assessCatalogAdmission(input);
  expect(result.passed).toBe(true);
  expect(result.held).toEqual([
    expect.objectContaining({
      externalKey: 'pf1/feat',
      reason: 'Known notice/evidence hold (#227/#241).',
      missingNotices: ['MISSING'],
    }),
  ]);
});

it('lifts the importer’s known-notice mark only while the clearance names every source group', () => {
  const input = fixture();
  input.artifact.catalog.entries[0]!.unsupported.push({
    field: 'attribution',
    reason: knownNoticeHoldReason,
  });
  reassess(input, 'pf1/feat', ['BOOK']);
  // The committed clearance names every group: the assessment decides.
  expect(assessCatalogAdmission(input)).toMatchObject({
    admitted: [{ externalKey: 'pf1/feat' }],
    held: [],
  });
  // The mark doesn't name its group, so one group in force keeps it holding.
  const [, ...others] = committedNoticeClearances.cleared.knownNoticeHolds;
  expect(
    assessCatalogAdmission({ ...input, clearedImporterHolds: others }),
  ).toMatchObject({
    admitted: [],
    held: [{ externalKey: 'pf1/feat', reason: knownNoticeHoldReason }],
  });
});

it('requires actual reviewed notice provenance, not a reviewed status alone', () => {
  const input = fixture();
  input.registry.BOOK.provenance = [];
  input.assessments[0] = {
    ...input.assessments[0]!,
    ...buildAssessmentBinding({
      entry: input.artifact.catalog.entries[0]!,
      artifact: input.artifact,
      evidence: input.evidence,
      registry: input.registry,
      requiredNotices: ['BOOK'],
      evidenceIds: ['comparison'],
    }),
  };
  const result = assessCatalogAdmission(input);
  expect(result).toMatchObject({
    passed: true,
    admitted: [],
    held: [
      {
        reason: 'Missing or unreviewed required notices: BOOK.',
        missingNotices: ['BOOK'],
      },
    ],
    failures: [],
  });
});

it('accounts for a last usable candidate body as a retained exception without new admission', () => {
  const input = {
    ...fixture(),
    retainedUses: retainedInput().retainedUses,
    retainedExceptions: retainedInput().retainedExceptions,
  };
  input.assessments = [];
  const body = input.artifact.catalog.entries[0]!;
  input.retainedUses[0] = {
    ...input.retainedUses[0]!,
    externalKey: body.externalKey,
    definitionFingerprint: computeFingerprint(body),
  };
  input.retainedExceptions[0] = {
    ...input.retainedExceptions[0]!,
    externalKey: body.externalKey,
    definitionFingerprint: computeFingerprint(body),
  };
  const result = assessCatalogAdmission(input);
  expect(result.passed).toBe(true);
  expect(result.admitted).toEqual([]);
  expect(result.retainedExceptions).toHaveLength(1);
  body.description = 'A held revision cannot replace the saved body.';
  expect(assessCatalogAdmission(input)).toMatchObject({
    passed: true,
    admitted: [],
    held: [
      {
        externalKey: body.externalKey,
        reason: 'missing Attribution Assessment',
      },
    ],
    retainedExceptions: [
      { definitionFingerprint: input.retainedUses[0]?.definitionFingerprint },
    ],
    failures: [],
  });
});

const advancedRaceGuideNotice =
  'pf1-content/notice/457075cca66db294b4beb065fd7edbe6c2b85823dca6d9b070d95688b536ac1e';
const advancedPlayersGuideNotice =
  'pf1-content/notice/7d75468ec859d3452bcef8458792e6ef19c7aafcf9cbaf2f759fdf4bc923b2a2';

function withReviewedNotices(
  input: ReturnType<typeof fixture>,
  notices: Record<string, string[]>,
) {
  const registry: Section15Registry = { ...input.registry };
  for (const [code, aliases] of Object.entries(notices)) {
    const notice = section15Registry[code];
    if (!notice) throw new Error(`Missing registry notice ${code}`);
    registry[code] = { ...notice, aliases };
  }
  return { ...input, registry };
}

function reassess(
  input: ReturnType<typeof withReviewedNotices>,
  externalKey: string,
  requiredNotices: string[],
) {
  input.assessments = input.assessments.map((assessment) => {
    if (assessment.externalKey !== externalKey) return assessment;
    const candidate = input.artifact.catalog.entries.find(
      (item) => item.externalKey === externalKey,
    );
    if (!candidate) throw new Error(`Missing candidate ${externalKey}`);
    return {
      ...assessment,
      requiredNotices,
      ...buildAssessmentBinding({
        entry: candidate,
        artifact: input.artifact,
        evidence: input.evidence,
        registry: input.registry,
        requiredNotices,
        evidenceIds: ['comparison'],
      }),
    };
  });
}

function heldNoticeInputs() {
  const input = withReviewedNotices(
    fixture([entry(), entry('pf1/arg-feat'), entry('pf1/apg-feat')]),
    {
      [advancedRaceGuideNotice]: [],
      [advancedPlayersGuideNotice]: ['PZO1115'],
    },
  );
  reassess(input, 'pf1/arg-feat', [advancedRaceGuideNotice]);
  reassess(input, 'pf1/apg-feat', ['PZO1115']);
  return input;
}
const holdIdsOn = (notice: string) =>
  heldNotices
    .filter((hold) => hold.notices.includes(notice))
    .map((hold) => hold.id);

it('refuses a reviewed definition requiring a batch-held notice chain and names the hold', () => {
  // The committed clearance clears every hold (owner, 2026-10-30); with none
  // cleared, a recorded hold still holds.
  const result = assessCatalogAdmission({
    ...heldNoticeInputs(),
    clearedHoldIds: [],
  });
  expect(result).toMatchObject({
    passed: true,
    admitted: [{ externalKey: 'pf1/feat', requiredNotices: ['BOOK'] }],
    held: [
      {
        externalKey: 'pf1/arg-feat',
        reason: expect.stringContaining(
          `Notice holds: ${advancedRaceGuideNotice}`,
        ),
        missingNotices: [],
      },
      {
        externalKey: 'pf1/apg-feat',
        reason: expect.stringContaining('Notice holds: PZO1115'),
        missingNotices: [],
      },
    ],
    requiredNotices: ['BOOK'],
    failures: [],
  });
  const requiredHolds: [string, string][] = [
    ['pf1/arg-feat', advancedRaceGuideNotice],
    ['pf1/apg-feat', 'PZO1115'],
  ];
  for (const [externalKey, notice] of requiredHolds) {
    const held = result.held.find((row) => row.externalKey === externalKey);
    const recorded = heldNotices.filter((hold) =>
      hold.notices.includes(notice),
    );
    expect(recorded.length).toBeGreaterThan(0);
    for (const hold of recorded) expect(held?.reason).toContain(hold.id);
  }
});

it('admits a reviewed definition whose notice holds are cleared, as the committed clearance clears them', () => {
  const cleared = new Set(committedNoticeClearances.cleared.heldNotices);
  for (const notice of [advancedRaceGuideNotice, 'PZO1115']) {
    expect(holdIdsOn(notice).length).toBeGreaterThan(0);
    for (const id of holdIdsOn(notice)) expect(cleared.has(id), id).toBe(true);
  }
  const result = assessCatalogAdmission(heldNoticeInputs());
  expect(result).toMatchObject({
    passed: true,
    admitted: [
      { externalKey: 'pf1/feat', requiredNotices: ['BOOK'] },
      {
        externalKey: 'pf1/arg-feat',
        requiredNotices: [advancedRaceGuideNotice],
      },
      { externalKey: 'pf1/apg-feat', requiredNotices: ['PZO1115'] },
    ],
    held: [],
    failures: [],
  });
  expect(result.requiredNotices).toEqual(
    ['BOOK', 'PZO1115', advancedRaceGuideNotice].sort(),
  );
});

it('keeps an uncleared hold holding beside cleared ones', () => {
  const [uncleared, ...others] = holdIdsOn('PZO1115');
  expect(uncleared).toBeDefined();
  const result = assessCatalogAdmission({
    ...heldNoticeInputs(),
    clearedHoldIds: committedNoticeClearances.cleared.heldNotices.filter(
      (id) => id !== uncleared,
    ),
  });
  expect(result.admitted.map(({ externalKey }) => externalKey)).toEqual([
    'pf1/feat',
    'pf1/arg-feat',
  ]);
  const [held] = result.held;
  expect(held).toMatchObject({
    externalKey: 'pf1/apg-feat',
    reason: `Notice holds: PZO1115 (${uncleared}).`,
    missingNotices: [],
  });
  for (const id of others) expect(held?.reason).not.toContain(id);
});

it('holds a cleared notice without a reviewed Registry identity as missing', () => {
  const advancedPlayersGuide = {
    title: "Pathfinder Roleplaying Game Advanced Player's Guide",
    notice:
      "Pathfinder Roleplaying Game Advanced Player's Guide. © 2010, Paizo Publishing, LLC; Author: Jason Bulmahn",
    checkedAgainst: 'prd' as const,
    checkedOn: '2026-10-30',
    aliases: [],
    provenance: ['http://paizo.com/pathfinderRPG/prd/openGameLicense.html'],
  };
  const registries: Section15Registry[] = [
    // No identity at all, or a drafted one: either way it is missing.
    {},
    { PZO1115: { ...advancedPlayersGuide, reviewStatus: 'unreviewed' } },
  ];
  for (const registry of registries) {
    const input = fixture([entry(), entry('pf1/apg-feat')]);
    const withRegistry = {
      ...input,
      registry: { ...input.registry, ...registry },
    };
    reassess(withRegistry, 'pf1/apg-feat', ['PZO1115']);
    expect(holdIdsOn('PZO1115').length).toBeGreaterThan(0);
    expect(assessCatalogAdmission(withRegistry)).toMatchObject({
      passed: true,
      admitted: [{ externalKey: 'pf1/feat' }],
      held: [
        {
          externalKey: 'pf1/apg-feat',
          reason: 'Missing or unreviewed required notices: PZO1115.',
          missingNotices: ['PZO1115'],
        },
      ],
    });
  }
});

it('keeps the reviewed, unheld Core Rulebook notice admissible beside its held compilation variant', () => {
  const input = withReviewedNotices(fixture(), { CRB: ['PZO1110'] });
  reassess(input, 'pf1/feat', ['PZO1110']);
  expect(assessCatalogAdmission(input)).toMatchObject({
    passed: true,
    admitted: [{ externalKey: 'pf1/feat', requiredNotices: ['PZO1110'] }],
    held: [],
  });
});
