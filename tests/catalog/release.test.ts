// @vitest-environment node
import { expect, it } from 'vitest';
import { buildCatalogRelease } from '../../scripts/catalog/release';
import {
  MAX_RELEASE_BATCH_BYTES,
  MAX_RELEASE_BATCH_ROWS,
  releaseByteCount,
  releaseFingerprint,
  releaseInputCategories,
  type ReleaseRow,
} from '../../src/lib/catalog/release-schema';

it('binds a manually numbered release to normalized inputs and bounded immutable output', async () => {
  const inputs = {
    upstream: 'upstream',
    remaps: 'remaps',
    curation: 'curation',
    localData: 'localData',
    parsers: 'parsers',
    sanitizers: 'sanitizers',
    ruleResources: 'ruleResources',
    legal: 'legal',
    attribution: 'attribution',
  };
  const release = await buildCatalogRelease({
    releaseNumber: 1,
    compatibility: { schema: 'sheet-v1', calculation: 'facts-v1' },
    inputs,
    rows: [
      {
        kind: 'definition',
        key: 'pf1/feat',
        payload: { name: 'Fixture feat' },
      },
    ],
  });
  expect(release.manifest.releaseNumber).toBe(1);
  expect(release.manifest.inputs.upstream).toMatch(/^[a-f0-9]{64}$/);
  expect(release.manifest.outputFingerprint).toBe(
    await releaseFingerprint(release.manifest.batches),
  );
  expect(
    await buildCatalogRelease({
      releaseNumber: 1,
      compatibility: { schema: 'sheet-v1', calculation: 'facts-v1' },
      inputs,
      rows: release.batches.flat(),
    }),
  ).toEqual(release);
});

it('refuses independently tampered output before any operator command runs', async () => {
  const { validateCatalogReleaseArtifact } =
    await import('../../src/lib/catalog/release-schema');
  const release = await buildCatalogRelease({
    releaseNumber: 1,
    compatibility: { schema: 'sheet-v1', calculation: 'facts-v1' },
    inputs: {
      upstream: [],
      remaps: [],
      curation: [],
      localData: [],
      parsers: [],
      sanitizers: [],
      ruleResources: [],
      legal: [],
      attribution: [],
    },
    rows: [
      {
        kind: 'definition',
        key: 'pf1/feat',
        payload: { name: 'Reviewed feat' },
      },
    ],
  });
  release.batches[0]![0]!.payload = { name: 'Tampered feat' };
  await expect(validateCatalogReleaseArtifact(release)).rejects.toThrow(
    'output fingerprint mismatch',
  );
});

it('holds changed accepted content and carries every previously shipped notice version', async () => {
  const { importCatalog } = await import('../../scripts/catalog/import');
  const { createCatalogRelease } =
    await import('../../scripts/catalog/release');
  const { buildAssessmentBinding } =
    await import('../../scripts/catalog/admission');
  const { legalResources } =
    await import('../../src/lib/catalog/reviewed-data');
  const { mkdir, mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const root = await mkdtemp(join(tmpdir(), 'release-admission-'));
  try {
    const system = join(root, 'system');
    const content = join(root, 'content');
    await mkdir(join(system, 'public'), { recursive: true });
    await mkdir(join(system, 'packs/feats'), { recursive: true });
    await mkdir(join(content, 'src'), { recursive: true });
    await writeFile(
      join(system, 'public/system.json'),
      JSON.stringify({ version: '11.11', packs: [{ name: 'feats' }] }),
    );
    await writeFile(
      join(content, 'module.json'),
      JSON.stringify({ version: '11.4.0', packs: [] }),
    );
    await writeFile(
      join(system, 'packs/feats/fixture.yaml'),
      JSON.stringify({
        _id: 'FixtureFeat',
        _key: '!items!FixtureFeat',
        name: 'Fixture feat',
        type: 'feat',
        system: {},
      }),
    );
    const artifact = await importCatalog({
      systemPath: system,
      contentPath: content,
      remaps: [],
    });
    const entry = artifact.catalog.entries[0]!;
    const evidence = {
      review: { content: 'Synthetic whole-content comparison' },
    };
    const registry = {
      BOOK: {
        title: 'Fixture book',
        notice: 'Old printed notice',
        checkedAgainst: 'printed' as const,
        checkedOn: '2026-10-03',
        aliases: [],
        reviewStatus: 'reviewed' as const,
        provenance: ['Synthetic print'],
      },
    };
    const attribution = {
      evidence,
      registry,
      assessments: [
        {
          externalKey: entry.externalKey,
          status: 'confirmed' as const,
          ...buildAssessmentBinding({
            entry,
            artifact,
            evidence,
            registry,
            requiredNotices: ['BOOK'],
            evidenceIds: ['review'],
          }),
          requiredNotices: ['BOOK'],
          rationale: 'Synthetic review',
          reviewedBy: 'Fixture',
          reviewedOn: '2026-10-03',
        },
      ],
    };
    const options = {
      artifact,
      attribution,
      legalResources,
      inputValues: {
        remaps: [],
        curation: [],
        localData: [],
        parsers: 'test-parser',
        sanitizers: 'test-sanitizer',
        ruleResources: [],
      },
      compatibility: { schema: 'sheet-v1', calculation: 'facts-v1' },
    };
    const prior = await createCatalogRelease({ ...options, releaseNumber: 1 });
    entry.description = '<p>Changed after acceptance</p>';
    registry.BOOK.notice = 'New corrected notice';
    const next = await createCatalogRelease({
      ...options,
      previous: prior,
      releaseNumber: 2,
    });
    expect(
      next.batches.flat().filter((row) => row.kind === 'definition'),
    ).toEqual([]);
    expect(
      next.batches.flat().find((row) => row.key === 'holds:pf1/FixtureFeat')
        ?.payload,
    ).toMatchObject({ reason: expect.stringContaining('current content') });
    expect(
      next.batches.flat().find((row) => row.key === 'permanentNoticeSuperset')
        ?.payload,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: 'Old printed notice' }),
      ]),
    );
    expect(
      next.batches
        .flat()
        .find((row) => row.key === 'retirement:pf1/FixtureFeat')?.payload,
    ).toMatchObject({
      state: 'held',
      lastUsableDefinition: expect.objectContaining({ description: '' }),
    });
    const third = await createCatalogRelease({
      ...options,
      previous: next,
      releaseNumber: 3,
    });
    expect(
      third.batches.flat().filter((row) => row.kind === 'definition'),
    ).toEqual([]);
    expect(
      third.batches
        .flat()
        .find((row) => row.key === 'retirement:pf1/FixtureFeat')?.payload,
    ).toMatchObject({
      state: 'held',
      lastUsableDefinition: expect.objectContaining({ description: '' }),
    });
    const broken = {
      ...artifact,
      curation: { ...artifact.curation, passed: false },
    };
    await expect(
      createCatalogRelease({ ...options, artifact: broken, releaseNumber: 4 }),
    ).rejects.toThrow('gates failed');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it.each(releaseInputCategories)(
  'changing %s binds a different artifact without relying on application code',
  async (category) => {
    const inputs = {
      upstream: { version: 1 },
      remaps: { version: 1 },
      curation: { version: 1 },
      localData: { version: 1 },
      parsers: { version: 1 },
      sanitizers: { version: 1 },
      ruleResources: { version: 1 },
      legal: { version: 1 },
      attribution: { version: 1 },
    };
    const options = {
      releaseNumber: 1,
      compatibility: { schema: 'sheet-v1', calculation: 'facts-v1' },
      inputs,
      rows: [{ kind: 'definition' as const, key: 'feat', payload: {} }],
    };
    const original = await buildCatalogRelease(options);
    const changed = await buildCatalogRelease({
      ...options,
      inputs: { ...inputs, [category]: { version: 2 } },
    });
    expect(changed.manifest.inputs[category]).not.toBe(
      original.manifest.inputs[category],
    );
    expect(changed.manifest.artifactFingerprint).not.toBe(
      original.manifest.artifactFingerprint,
    );
    expect(changed.manifest.outputFingerprint).toBe(
      original.manifest.outputFingerprint,
    );
    const withUnrelatedInput = {
      ...inputs,
      unrelatedApplication: 'new navbar',
    };
    expect(
      await buildCatalogRelease({
        ...options,
        inputs: withUnrelatedInput,
      }),
    ).toEqual(original);
  },
);

it('splits batches at row and UTF-8 byte limits and rejects one oversized record', async () => {
  const inputs = {
    upstream: [],
    remaps: [],
    curation: [],
    localData: [],
    parsers: [],
    sanitizers: [],
    ruleResources: [],
    legal: [],
    attribution: [],
  };
  const options = {
    releaseNumber: 1,
    compatibility: { schema: 's', calculation: 'c' },
    inputs,
  };
  const release = await buildCatalogRelease({
    ...options,
    rows: [
      { kind: 'report', key: 'a', payload: 'é'.repeat(150000) },
      { kind: 'report', key: 'b', payload: 'é'.repeat(150000) },
    ],
  });
  expect(release.batches.map((batch) => batch.length)).toEqual([1, 1]);
  await expect(
    buildCatalogRelease({
      ...options,
      rows: [{ kind: 'report', key: 'too-big', payload: 'é'.repeat(260000) }],
    }),
  ).rejects.toThrow('exceeds byte limit');
});

it('fills a batch to exactly the byte limit and starts the next one a byte later', async () => {
  const options = {
    releaseNumber: 1,
    compatibility: { schema: 's', calculation: 'c' },
    inputs: {
      upstream: [],
      remaps: [],
      curation: [],
      localData: [],
      parsers: [],
      sanitizers: [],
      ruleResources: [],
      legal: [],
      attribution: [],
    },
  };
  const row = (key: string, payload: string): ReleaseRow => ({
    kind: 'report',
    key,
    payload,
  });
  // Three rows and their two separating commas fill the batch exactly.
  const wide = 'é'.repeat(1000);
  const fill =
    MAX_RELEASE_BATCH_BYTES -
    releaseByteCount([row('a', wide), row('b', wide), row('c', '')]);
  const third = row('c', 'x'.repeat(fill));
  const exact = [row('a', wide), row('b', wide), third];
  expect(releaseByteCount(exact)).toBe(MAX_RELEASE_BATCH_BYTES);
  const fits = await buildCatalogRelease({
    ...options,
    rows: [...exact, row('d', '')],
  });
  expect(fits.batches.map((batch) => batch.length)).toEqual([3, 1]);
  expect(fits.manifest.batches.map(({ byteCount }) => byteCount)).toEqual(
    fits.batches.map((batch) => releaseByteCount(batch)),
  );
  expect(fits.manifest.batches[0]?.byteCount).toBe(MAX_RELEASE_BATCH_BYTES);
  const over = await buildCatalogRelease({
    ...options,
    rows: [row('a', wide), row('b', `${wide}x`), third],
  });
  expect(over.batches.map((batch) => batch.length)).toEqual([2, 1]);
  const rows = Array.from({ length: MAX_RELEASE_BATCH_ROWS + 1 }, (_, i) =>
    row(`r${String(i).padStart(3, '0')}`, ''),
  );
  const counted = await buildCatalogRelease({ ...options, rows });
  expect(counted.batches.map((batch) => batch.length)).toEqual([
    MAX_RELEASE_BATCH_ROWS,
    1,
  ]);
});

it('uses standard SHA-256, including multi-block and UTF-8 values', async () => {
  const { createHash } = await import('node:crypto');
  const { canonicalReleaseJson } =
    await import('../../src/lib/catalog/release-schema');
  for (const value of [
    '',
    'abc',
    'é'.repeat(500),
    { b: [1, true, null], a: 'text' },
  ]) {
    expect(await releaseFingerprint(value)).toBe(
      createHash('sha256').update(canonicalReleaseJson(value)).digest('hex'),
    );
  }
});

it('fingerprints the importer dependency graph and actual authored resources while excluding application modules', async () => {
  const { catalogImplementationInputs } =
    await import('../../scripts/catalog/release-inputs');
  const input = await catalogImplementationInputs();
  expect(input.parsers.files).toHaveProperty('scripts/catalog/map.ts');
  expect(input.parsers.files).toHaveProperty(
    'scripts/catalog/reviewed-item-ability-policies.json',
  );
  expect(input.parsers.files).toHaveProperty(
    'scripts/catalog/rules-journal-targets.json',
  );
  expect(
    Object.keys(input.parsers.files).some(
      (path) =>
        path.startsWith('src/app/') || path.startsWith('src/components/'),
    ),
  ).toBe(false);
  // #770: a release scope reads the launch inventory at run time, so neither
  // the committed manifest nor the inventory modules enter this fingerprint.
  expect(
    Object.keys(input.parsers.files).filter((path) =>
      /\/scopes\/|launch-inventory|release-scope/.test(path),
    ),
  ).toEqual([]);
  expect(input.ruleResources.representativeClassCatalog.definitions).toEqual(
    expect.arrayContaining([expect.objectContaining({ name: 'Fighter' })]),
  );
  expect(
    input.ruleResources.representativeArchetypeCatalog.definitions,
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: 'Archer' }),
      expect.objectContaining({ name: 'Scout' }),
    ]),
  );
  expect(
    input.ruleResources.representativeClassCatalog.featureSchedules.fighter,
  ).toHaveLength(26);
  expect(input.ruleResources.castingTables).toMatchObject({
    definitions: {
      version: 1,
      tables: {
        'prepared-full': {
          rows: expect.arrayContaining([
            {
              spellsPerDay: [
                3,
                1,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
              ],
            },
          ]),
        },
      },
      classes: { wizard: { ability: 'intelligence', record: 'book' } },
    },
  });
  expect(input.ruleResources.castingTables?.source).toContain(
    '"prepared-full"',
  );
});

it('reports authored resource changes without retiring still-present resources and retains removed resources', async () => {
  const { importCatalog } = await import('../../scripts/catalog/import');
  const { createCatalogRelease } =
    await import('../../scripts/catalog/release');
  const { reviewedAdmission, legalResources } =
    await import('../../src/lib/catalog/reviewed-data');
  const artifact = await importCatalog({
    systemPath: 'tests/fixtures/catalog-release/pf1',
    contentPath: 'tests/fixtures/catalog-release/pf1-content',
    remaps: [],
  });
  const options = {
    artifact,
    attribution: reviewedAdmission,
    legalResources,
    inputValues: {
      remaps: [],
      curation: [],
      localData: [],
      parsers: 'fixture-parser',
      sanitizers: 'fixture-sanitizer',
      ruleResources: [],
    },
    compatibility: { schema: 's', calculation: 'c' },
  };
  const authoredResources = [
    { key: 'builtin:casting-fixture', payload: { values: [1] } },
  ];
  const first = await createCatalogRelease({
    ...options,
    releaseNumber: 1,
    authoredResources,
  });
  const same = await createCatalogRelease({
    ...options,
    releaseNumber: 2,
    previous: first,
    authoredResources,
  });
  expect(
    same.batches
      .flat()
      .find((row) => row.key === 'resources:builtin:casting-fixture')?.payload,
  ).toMatchObject({ state: 'unchanged' });
  expect(
    same.batches
      .flat()
      .find((row) => row.key === 'retirement:builtin:casting-fixture'),
  ).toBeUndefined();
  const changed = await createCatalogRelease({
    ...options,
    releaseNumber: 3,
    previous: same,
    authoredResources: [
      { key: 'builtin:casting-fixture', payload: { values: [2] } },
    ],
  });
  expect(
    changed.batches
      .flat()
      .find((row) => row.key === 'resources:builtin:casting-fixture')?.payload,
  ).toMatchObject({ state: 'changed' });
  expect(
    changed.batches
      .flat()
      .find((row) => row.key === 'retirement:builtin:casting-fixture'),
  ).toBeUndefined();
  const removed = await createCatalogRelease({
    ...options,
    releaseNumber: 4,
    previous: changed,
  });
  expect(
    removed.batches
      .flat()
      .find((row) => row.key === 'retirement:builtin:casting-fixture')?.payload,
  ).toMatchObject({
    kind: 'resource',
    state: 'retired',
    lastUsableDefinition: { values: [2] },
  });
});

it('rejects one stable catalog identity shared by a definition and resource within or across batches', async () => {
  const inputs = {
    upstream: [],
    remaps: [],
    curation: [],
    localData: [],
    parsers: [],
    sanitizers: [],
    ruleResources: [],
    legal: [],
    attribution: [],
  };
  const options = {
    releaseNumber: 1,
    compatibility: { schema: 's', calculation: 'c' },
    inputs,
  };
  const definition: ReleaseRow = {
    kind: 'definition',
    key: 'shared-key',
    payload: {},
  };
  const resource: ReleaseRow = {
    kind: 'resource',
    key: 'shared-key',
    payload: {},
  };
  await expect(
    buildCatalogRelease({ ...options, rows: [definition, resource] }),
  ).rejects.toThrow('Duplicate release row');
  await expect(
    buildCatalogRelease({
      ...options,
      rows: [
        definition,
        ...Array.from(
          { length: 100 },
          (_, index): ReleaseRow => ({
            kind: 'definition',
            key: `other-${index}`,
            payload: {},
          }),
        ),
        resource,
      ],
    }),
  ).rejects.toThrow('Duplicate release row');
});

it('requires a new identity for accepted kind changes, including after an intervening retirement', async () => {
  const { importCatalog } = await import('../../scripts/catalog/import');
  const { createCatalogRelease } =
    await import('../../scripts/catalog/release');
  const { buildAssessmentBinding } =
    await import('../../scripts/catalog/admission');
  const { legalResources } =
    await import('../../src/lib/catalog/reviewed-data');
  const artifact = await importCatalog({
    systemPath: 'tests/fixtures/catalog-release/pf1',
    contentPath: 'tests/fixtures/catalog-release/pf1-content',
    remaps: [],
  });
  const entry = artifact.catalog.entries[0]!;
  const evidence = {
    comparison: { content: 'Synthetic whole-content comparison' },
  };
  const registry = {
    BOOK: {
      title: 'Fixture',
      notice: 'Fixture notice',
      checkedAgainst: 'printed' as const,
      checkedOn: '2026-10-03',
      aliases: [],
      reviewStatus: 'reviewed' as const,
      provenance: ['Synthetic fixture'],
    },
  };
  const accepted = () => ({
    evidence,
    registry,
    assessments: [
      {
        externalKey: entry.externalKey,
        status: 'confirmed' as const,
        ...buildAssessmentBinding({
          entry,
          artifact,
          evidence,
          registry,
          requiredNotices: ['BOOK'],
          evidenceIds: ['comparison'],
        }),
        requiredNotices: ['BOOK'],
        rationale: 'Synthetic comparison',
        reviewedBy: 'Fixture',
        reviewedOn: '2026-10-03',
      },
    ],
  });
  const options = {
    artifact,
    legalResources,
    inputValues: {
      remaps: [],
      curation: [],
      localData: [],
      parsers: 'p',
      sanitizers: 's',
      ruleResources: [],
    },
    compatibility: { schema: 's', calculation: 'c' },
  };
  const first = await createCatalogRelease({
    ...options,
    attribution: accepted(),
    releaseNumber: 1,
  });
  const retired = await createCatalogRelease({
    ...options,
    attribution: { evidence, registry, assessments: [] },
    previous: first,
    releaseNumber: 2,
  });
  entry.detail = { kind: 'item', consumable: false, price: 0, weight: 0 };
  await expect(
    createCatalogRelease({
      ...options,
      attribution: accepted(),
      previous: first,
      releaseNumber: 2,
    }),
  ).rejects.toThrow('changed kind; use a new stable identity');
  await expect(
    createCatalogRelease({
      ...options,
      attribution: accepted(),
      previous: retired,
      releaseNumber: 3,
    }),
  ).rejects.toThrow('changed kind; use a new stable identity');
});

it('digests only the supplied UTF-8 byte view asynchronously', async () => {
  const { sha256 } = await import('../../src/lib/catalog/release-sha256');
  const bytes = new TextEncoder().encode('xabcx');
  await expect(sha256(bytes.subarray(1, 4))).resolves.toBe(
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
});

// #411: CRB p. 119 Cleave, as an in-memory import of one admitted record.
function cleaveImport() {
  const entry = {
    externalKey: 'pf1/Cleave',
    upstreamKey: 'pf1/Cleave',
    pack: 'feats',
    name: 'Cleave',
    description: '<p>You can strike two adjacent foes with a single swing.</p>',
    detail: {
      kind: 'feat' as const,
      featTypes: ['combat'],
      repeatable: 'no' as const,
    },
    prerequisiteText: 'Str 13, Power Attack, base attack bonus +1.',
    sources: [{ book: 'CRB', pages: '119' }],
    modifiers: [],
    unsupported: [],
  };
  const summary = {
    upstreamRecords: 1,
    admitted: 1,
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
      purpose: 'preview' as const,
      releaseAdmission: 'not-evaluated' as const,
      remaps: [],
      inputs: [],
      summary,
      entries: [entry],
      resources: [],
    },
    unsupported: {
      purpose: 'preview' as const,
      summary: { entries: 0, issues: 0 },
      entries: [],
    },
    comparison: {
      coverageComplete: true,
      summary,
      packs: [],
      records: [
        {
          repo: 'pf1' as const,
          pack: 'feats',
          path: 'packs/feats/cleave.yaml',
          externalKey: entry.upstreamKey,
          name: entry.name,
          status: 'admitted' as const,
          reason: 'In scope',
        },
      ],
    },
  };
  return { entry, artifact };
}

it('a rollback rechecks revoked attribution and keeps retained exceptions and notices until a checked re-review', async () => {
  const { createCatalogRelease } =
    await import('../../scripts/catalog/release');
  const { buildAssessmentBinding, computeFingerprint } =
    await import('../../scripts/catalog/admission');
  const { legalResources, section15Registry } =
    await import('../../src/lib/catalog/section15-registry-data');
  const { entry, artifact } = cleaveImport();
  const crb = section15Registry.CRB;
  if (!crb) throw new Error('Missing CRB notice');
  const registry = { CRB: crb };
  const assess = (
    evidence: Record<string, { content: string; revoked?: boolean }>,
    evidenceId: string,
  ) => ({
    evidence,
    registry,
    assessments: [
      {
        externalKey: entry.externalKey,
        status: 'confirmed' as const,
        ...buildAssessmentBinding({
          entry,
          artifact,
          evidence,
          registry,
          requiredNotices: ['CRB'],
          evidenceIds: [evidenceId],
        }),
        requiredNotices: ['CRB'],
        rationale: 'The whole definition matches CRB p. 119.',
        reviewedBy: 'Catalog reviewer',
        reviewedOn: '2026-10-07',
      },
    ],
  });
  const comparison = {
    content: 'CRB p. 119 Cleave compared with the imported text.',
  };
  const original = assess({ comparison }, 'comparison');
  const options = {
    artifact,
    legalResources,
    inputValues: {
      remaps: [],
      curation: [],
      localData: [],
      parsers: 'test-parser',
      sanitizers: 'test-sanitizer',
      ruleResources: [],
    },
    compatibility: { schema: 'sheet-v1', calculation: 'facts-v1' },
  };
  const rows = (release: { batches: ReleaseRow[][] }) => release.batches.flat();
  const row = (release: { batches: ReleaseRow[][] }, key: string) =>
    rows(release).find((candidate) => candidate.key === key)?.payload;

  const first = await createCatalogRelease({
    ...options,
    attribution: original,
    releaseNumber: 1,
  });
  expect(row(first, entry.externalKey)).toMatchObject({ name: 'Cleave' });

  // Release 2: the comparison is revoked; a Character's edited copy keeps
  // the last usable body as a reported retained exception.
  const use = {
    useId: 'vessa-cleave-copy',
    externalKey: entry.externalKey,
    name: 'Cleave (Ironfang drill)',
    characterId: 'vessa',
    definitionFingerprint: computeFingerprint(entry),
    admittedRelease: 1,
    requiredNotices: ['CRB'],
  };
  const exception = {
    useId: use.useId,
    externalKey: use.externalKey,
    definitionFingerprint: use.definitionFingerprint,
    reason: 'Attribution evidence revoked; the existing copy is kept.',
    requiredNotices: ['CRB'],
  };
  const second = await createCatalogRelease({
    ...options,
    attribution: {
      ...assess({ comparison: { ...comparison, revoked: true } }, 'comparison'),
      retainedUses: [use],
      retainedExceptions: [exception],
    },
    previous: first,
    releaseNumber: 2,
  });
  expect(row(second, entry.externalKey)).toBeUndefined();
  expect(row(second, 'holds')).toMatchObject({
    retainedExceptions: 1,
    revokedEvidence: ['comparison'],
  });

  // Release 3 rolls back with release 1's attribution: the revocation and
  // the retained exception still hold, and the notice stays published.
  const rollback = await createCatalogRelease({
    ...options,
    attribution: original,
    previous: second,
    releaseNumber: 3,
  });
  expect(row(rollback, entry.externalKey)).toBeUndefined();
  expect(row(rollback, `retirement:${entry.externalKey}`)).toMatchObject({
    lastUsableDefinition: expect.objectContaining({ name: 'Cleave' }),
  });
  expect(row(rollback, `holds:retained:${use.useId}`)).toMatchObject({
    externalKey: entry.externalKey,
    reason: exception.reason,
  });
  expect(row(rollback, 'holds')).toMatchObject({
    retainedExceptions: 1,
    revokedEvidence: ['comparison'],
  });
  expect(row(rollback, 'permanentNoticeSuperset')).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: 'registry:CRB' })]),
  );

  // Release 4: a new reviewed comparison admits Cleave again under its
  // stable identity and clears the exception.
  const restored = await createCatalogRelease({
    ...options,
    attribution: assess(
      {
        comparison: { ...comparison, revoked: true },
        rereview: {
          content: 'CRB p. 119 Cleave re-reviewed against the printed page.',
        },
      },
      'rereview',
    ),
    previous: rollback,
    releaseNumber: 4,
  });
  expect(row(restored, entry.externalKey)).toMatchObject({ name: 'Cleave' });
  expect(row(restored, `holds:retained:${use.useId}`)).toBeUndefined();
  expect(row(restored, `retirement:${entry.externalKey}`)).toBeUndefined();
  expect(row(restored, 'holds')).toMatchObject({
    retainedExceptions: 0,
    revokedEvidence: ['comparison'],
  });
});
