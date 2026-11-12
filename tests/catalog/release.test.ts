// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildCatalogRelease } from '../../scripts/catalog/release';
import { cleaveReleases, cleaveVerification } from './cleave-release-fixture';
import type { ReleaseVerification } from '../../scripts/catalog/release-verification';
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
    // Unresolved curation mechanics never refuse the release (#227 slice 4);
    // the changed content's attribution hold still holds the definition.
    const broken = {
      ...artifact,
      curation: {
        ...artifact.curation,
        passed: false,
        unresolvedMechanics: [
          {
            externalKey: entry.externalKey,
            kind: 'note' as const,
            target: '',
            text: 'Needs review',
            textSha256: '0'.repeat(64),
            status: 'drafted' as const,
            outputs: [],
            rationale: 'Fixture awaiting review.',
            diagnostics: [
              { kind: 'unresolved' as const, text: 'Unsupported target.' },
            ],
            seedBindings: [],
          },
        ],
      },
    };
    const fourth = await createCatalogRelease({
      ...options,
      artifact: broken,
      previous: third,
      releaseNumber: 4,
    });
    expect(
      fourth.batches.flat().filter((row) => row.kind === 'definition'),
    ).toEqual([]);
    expect(
      fourth.batches.flat().find((row) => row.key === 'holds:pf1/FixtureFeat')
        ?.payload,
    ).toMatchObject({ reason: expect.stringContaining('current content') });
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

it('a rollback rechecks revoked attribution and keeps retained exceptions and notices until a checked re-review', async () => {
  const {
    createCatalogRelease,
    computeFingerprint,
    entry,
    assess,
    comparison,
    original,
    options,
    row,
  } = await cleaveReleases();
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
  // #227: an unresolved assessment would fall back to Cleave's declared
  // book, but the revoked comparison it names still holds it.
  const [confirmed] = original.assessments;
  if (!confirmed) throw new Error('Missing the original assessment');
  const unresolvedRollback = await createCatalogRelease({
    ...options,
    attribution: {
      ...original,
      assessments: [{ ...confirmed, status: 'unresolved' as const }],
    },
    previous: second,
    releaseNumber: 3,
  });
  expect(row(unresolvedRollback, entry.externalKey)).toBeUndefined();
  expect(row(unresolvedRollback, 'holds')).toMatchObject({
    revokedEvidence: ['comparison'],
  });

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

it('a rollback that drops the revoked record or the assessment still holds the definition until a re-review admits it (#411, #227)', async () => {
  const {
    createCatalogRelease,
    entry,
    assess,
    comparison,
    original,
    options,
    row,
  } = await cleaveReleases();
  const [confirmed] = original.assessments;
  if (!confirmed) throw new Error('Missing the original assessment');
  const first = await createCatalogRelease({
    ...options,
    attribution: original,
    releaseNumber: 1,
  });
  const noAssessment = { ...original, assessments: [] };
  // Before any revocation, no assessment falls back to Cleave's declared book.
  const beforeRevocation = await createCatalogRelease({
    ...options,
    attribution: noAssessment,
    previous: first,
    releaseNumber: 2,
  });
  expect(row(beforeRevocation, entry.externalKey)).toMatchObject({
    name: 'Cleave',
  });

  // Release 2 revokes the comparison and records it for Cleave.
  const revoked = await createCatalogRelease({
    ...options,
    attribution: assess(
      { comparison: { ...comparison, revoked: true } },
      'comparison',
    ),
    previous: first,
    releaseNumber: 2,
  });
  const held = {
    reason: 'Attribution evidence requires re-review: comparison (revoked).',
    evidence: ['comparison'],
  };
  expect(row(revoked, `holds:${entry.externalKey}`)).toMatchObject(held);

  // Release 3 rolls back with the record omitted under an unresolved
  // assessment, or with no assessment: both still hold Cleave.
  const withoutRecord = await createCatalogRelease({
    ...options,
    attribution: {
      ...original,
      evidence: {},
      assessments: [{ ...confirmed, status: 'unresolved' as const }],
    },
    previous: revoked,
    releaseNumber: 3,
  });
  const withoutAssessment = await createCatalogRelease({
    ...options,
    attribution: noAssessment,
    previous: revoked,
    releaseNumber: 3,
  });
  for (const rollback of [withoutRecord, withoutAssessment]) {
    expect(row(rollback, entry.externalKey)).toBeUndefined();
    expect(row(rollback, `holds:${entry.externalKey}`)).toMatchObject(held);
  }
  // Its held row names the comparison again, so release 4 holds it too.
  const again = await createCatalogRelease({
    ...options,
    attribution: noAssessment,
    previous: withoutAssessment,
    releaseNumber: 4,
  });
  expect(row(again, entry.externalKey)).toBeUndefined();

  // Release 5: a checked re-review on new evidence admits Cleave and records
  // no revocation for it, so release 6 with no assessment falls back to its
  // declared book again.
  const rereview = {
    content: 'CRB p. 119 Cleave re-reviewed against the printed page.',
  };
  const restored = await createCatalogRelease({
    ...options,
    attribution: assess({ comparison, rereview }, 'rereview'),
    previous: again,
    releaseNumber: 5,
  });
  expect(row(restored, entry.externalKey)).toMatchObject({ name: 'Cleave' });
  expect(row(restored, `holds:${entry.externalKey}`)).toBeUndefined();
  expect(row(restored, 'holds')).toMatchObject({
    revokedEvidence: ['comparison'],
  });
  const afterRereview = await createCatalogRelease({
    ...options,
    attribution: noAssessment,
    previous: restored,
    releaseNumber: 6,
  });
  expect(row(afterRereview, entry.externalKey)).toMatchObject({
    name: 'Cleave',
  });
});

it('builds a release that admits a definition with a missing curation record, labelled unverified, beside the rest (#227 slice 4)', async () => {
  const { importCatalog } = await import('../../scripts/catalog/import');
  const { createCatalogRelease } =
    await import('../../scripts/catalog/release');
  const { reviewedCuration } =
    await import('../../scripts/catalog/reviewed-curation-data');
  const { reviewedAdmission, legalResources } =
    await import('../../src/lib/catalog/reviewed-data');
  const { materializePinnedTree } = await import('./pinned-sources');
  const { readFile, writeFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const { parse, stringify } = await import('yaml');
  // Core Rulebook pp. 117 and 122 (PZO1110), as pinned.
  const alertnessPath = 'packs/feats/alertness.Q1cY8r0Pvb66pMG0.yaml';
  const tree = await materializePinnedTree([
    `pf1/${alertnessPath}`,
    'pf1/packs/feats/dodge.JreaiTHdyWFNj3Tb.yaml',
  ]);
  try {
    const options = {
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
      releaseNumber: 1,
    };
    const inputs = {
      systemPath: tree.systemPath,
      contentPath: tree.contentPath,
      remaps: [],
      curation: reviewedCuration,
    };
    const definitions = (release: { batches: ReleaseRow[][] }) =>
      release.batches
        .flat()
        .filter((row) => row.kind === 'definition')
        .map((row) => row.key)
        .sort();
    const clean = await importCatalog(inputs);
    expect(clean.curation.passed).toBe(true);
    expect(
      definitions(await createCatalogRelease({ ...options, artifact: clean })),
    ).toEqual(['pf1/JreaiTHdyWFNj3Tb', 'pf1/Q1cY8r0Pvb66pMG0']);

    // An unrecorded context note on Alertness: no curation record covers it.
    const file = join(tree.systemPath, alertnessPath);
    const record = parse(await readFile(file, 'utf8'));
    record.system.contextNotes = [
      { target: 'skill.per', text: '+[[2]] on Perception to notice traps' },
    ];
    await writeFile(file, stringify(record));
    const artifact = await importCatalog(inputs);
    expect(artifact.curation.passed).toBe(false);
    expect(artifact.curation.missing).toEqual([
      expect.objectContaining({
        externalKey: 'pf1/Q1cY8r0Pvb66pMG0',
        kind: 'note',
      }),
    ]);
    const release = await createCatalogRelease({ ...options, artifact });
    expect(definitions(release)).toEqual([
      'pf1/JreaiTHdyWFNj3Tb',
      'pf1/Q1cY8r0Pvb66pMG0',
    ]);
    const rows = release.batches.flat();
    expect(
      rows.find((row) => row.key === 'holds:pf1/Q1cY8r0Pvb66pMG0'),
    ).toBeUndefined();
    const labelOf = (key: string) =>
      (
        rows.find((row) => row.kind === 'definition' && row.key === key)
          ?.payload as { verification?: unknown }
      ).verification;
    expect(labelOf('pf1/Q1cY8r0Pvb66pMG0')).toEqual({
      state: 'unverified',
      reasons: ['no verification projection', 'no curation record'],
    });
    expect(labelOf('pf1/JreaiTHdyWFNj3Tb')).toEqual({
      state: 'unverified',
      reasons: ['no verification projection'],
    });
    // The curation report lists the record and passes the release's gate, as
    // the Convex release validator requires.
    expect(rows.find((row) => row.key === 'curation')?.payload).toMatchObject({
      gatePassed: true,
      passed: true,
      summary: expect.objectContaining({ missing: 1 }),
    });
    expect(
      rows.find((row) => row.key === 'curation:missing:0')?.payload,
    ).toMatchObject({ externalKey: 'pf1/Q1cY8r0Pvb66pMG0' });
  } finally {
    await tree.dispose();
  }
});

/**
 * #411's revocation ledger over Cleave: each step's release inputs. `retain`
 * reports the unchanged body as a Character's existing retained use, `omit`
 * drops the candidate, and both, like `restore-bare`, supply no assessment
 * and no evidence; `re-review` is a checked re-review on new evidence.
 */
const ledgerSteps = [
  'admit',
  'revoke',
  'retain',
  'omit',
  'restore-bare',
  're-review',
] as const;
type LedgerStep = (typeof ledgerSteps)[number] | 'revoke-retain';

async function revocationLedgerChains() {
  const cleave = await cleaveReleases();
  const {
    createCatalogRelease,
    computeFingerprint,
    entry,
    artifact,
    registry,
    assess,
    comparison,
    original,
    options,
    row,
  } = cleave;
  const use = {
    useId: 'vessa-cleave-copy',
    externalKey: entry.externalKey,
    name: 'Cleave (Ironfang drill)',
    characterId: 'vessa',
    definitionFingerprint: computeFingerprint(entry),
    admittedRelease: 1,
    requiredNotices: ['CRB'],
  };
  const retained = {
    retainedUses: [use],
    retainedExceptions: [
      {
        useId: use.useId,
        externalKey: use.externalKey,
        definitionFingerprint: use.definitionFingerprint,
        reason: 'Attribution evidence revoked; the existing copy is kept.',
        requiredNotices: ['CRB'],
      },
    ],
  };
  const bare = { evidence: {}, registry, assessments: [] };
  const revoked = assess(
    { comparison: { ...comparison, revoked: true } },
    'comparison',
  );
  const none = {
    upstreamRecords: 0,
    admitted: 0,
    excluded: 0,
    unassigned: 0,
    byKind: {},
  };
  const omitted = {
    ...artifact,
    catalog: { ...artifact.catalog, entries: [], summary: none },
    comparison: { ...artifact.comparison, records: [], summary: none },
  };
  const inputs = {
    admit: { attribution: original, artifact },
    revoke: { attribution: revoked, artifact },
    'revoke-retain': { attribution: { ...revoked, ...retained }, artifact },
    retain: { attribution: { ...bare, ...retained }, artifact },
    omit: { attribution: bare, artifact: omitted },
    'restore-bare': { attribution: bare, artifact },
    're-review': {
      attribution: assess(
        {
          rereview: {
            content: 'CRB p. 119 Cleave re-reviewed against the printed page.',
          },
        },
        'rereview',
      ),
      artifact,
    },
  } satisfies Record<LedgerStep, unknown>;
  type Release = Awaited<ReturnType<typeof createCatalogRelease>>;
  const release = (step: LedgerStep, previous?: Release) =>
    createCatalogRelease({
      ...options,
      ...inputs[step],
      previous,
      releaseNumber: (previous?.manifest.releaseNumber ?? 0) + 1,
    });
  const chain = async (steps: readonly LedgerStep[]) => {
    const releases: Release[] = [];
    for (const step of steps)
      releases.push(await release(step, releases.at(-1)));
    return releases;
  };
  const published = (release: Release) =>
    row(release, entry.externalKey) !== undefined;
  const holds = (release: Release) =>
    row(release, 'holds') as {
      revokedEvidence: string[];
      revocations: { externalKey: string; evidence: string[] }[];
    };
  const outstanding = [
    { externalKey: entry.externalKey, evidence: ['comparison'] },
  ];
  return { ...cleave, release, chain, published, holds, outstanding };
}

it('a revocation holds the key through a retained use or an omitted candidate until a checked re-review (#411)', async () => {
  const { chain, published, holds, outstanding } =
    await revocationLedgerChains();
  // The review's three chains: a retained use declared at revocation, one
  // introduced after an ordinary held release, and an omitted candidate,
  // then a release with no assessment and no evidence.
  for (const steps of [
    ['admit', 'revoke-retain', 'retain', 'restore-bare'],
    ['admit', 'revoke', 'retain', 'restore-bare'],
    ['admit', 'revoke', 'omit', 'restore-bare'],
  ] as const) {
    const releases = await chain(steps);
    expect(releases.map(published), steps.join(' → ')).toEqual([
      true,
      false,
      false,
      false,
    ]);
    for (const release of releases.slice(1))
      expect(holds(release), steps.join(' → ')).toMatchObject({
        revokedEvidence: ['comparison'],
        revocations: outstanding,
      });
  }
  // Chains of five mixing them.
  for (const steps of [
    ['admit', 'revoke', 'retain', 'omit', 'restore-bare'],
    ['admit', 'revoke', 'omit', 'retain', 'restore-bare'],
    ['admit', 'revoke-retain', 'omit', 'restore-bare', 'restore-bare'],
    ['admit', 'revoke', 'restore-bare', 'retain', 'restore-bare'],
    ['admit', 'retain', 'revoke', 'omit', 'restore-bare'],
  ] as const) {
    const releases = await chain(steps);
    expect(published(releases[4]!), steps.join(' → ')).toBe(false);
    expect(holds(releases[4]!).revocations, steps.join(' → ')).toEqual(
      outstanding,
    );
  }
});

it('a rollback to the release before the revocation still holds the key, and a checked re-review lifts it for later fallbacks (#411, #241)', async () => {
  const { release, chain, published, holds, outstanding } =
    await revocationLedgerChains();
  // Releases 1-2 admit Cleave (2 on its declared book); 3 revokes it.
  const [, beforeRevocation, revocation] = await chain([
    'admit',
    'restore-bare',
    'revoke',
  ]);
  expect(published(beforeRevocation!)).toBe(true);
  expect(holds(beforeRevocation!).revocations).toEqual([]);
  // Release 4 rolls back to release 2's inputs, or release 1's.
  for (const step of ['restore-bare', 'admit'] as const) {
    const rollback = await release(step, revocation);
    expect(published(rollback), step).toBe(false);
    expect(holds(rollback).revocations, step).toEqual(outstanding);
  }

  // A checked re-review after a retained use lifts the revocation, so a
  // later fallback and an omitted-then-restored candidate are admitted.
  const releases = await chain([
    'admit',
    'revoke',
    'retain',
    're-review',
    'restore-bare',
    'omit',
    'restore-bare',
  ]);
  expect(releases.map(published)).toEqual([
    true,
    false,
    false,
    true,
    true,
    false,
    true,
  ]);
  expect(releases.map((release) => holds(release).revocations)).toEqual([
    [],
    outstanding,
    outstanding,
    [],
    [],
    [],
    [],
  ]);
  for (const release of releases.slice(1))
    expect(holds(release).revokedEvidence).toEqual(['comparison']);
});

it('seeds the revocation ledger once from a base release that carries none (#411)', async () => {
  const { release, published, holds, outstanding } =
    await revocationLedgerChains();
  const { releaseInputCategories } =
    await import('../../src/lib/catalog/release-schema');
  // A base from before the ledger: release 2's rows without `revocations`.
  const withoutLedger = async (base: Awaited<ReturnType<typeof release>>) =>
    buildCatalogRelease({
      releaseNumber: base.manifest.releaseNumber,
      compatibility: base.manifest.compatibility,
      inputs: Object.fromEntries(
        releaseInputCategories.map((category) => [category, null]),
      ) as Record<(typeof releaseInputCategories)[number], unknown>,
      rows: base.batches.flat().map((row) => {
        if (row.key !== 'holds' || row.kind !== 'report') return row;
        const { revocations, ...payload } = row.payload as Record<
          string,
          ReleaseRow['payload']
        >;
        expect(revocations).toBeDefined();
        return { ...row, payload };
      }),
    });
  const first = await release('admit');
  const revoked = await withoutLedger(await release('revoke', first));
  // Its `holds:pf1/Cleave` row names the revoked comparison: the seed.
  const seeded = await release('restore-bare', revoked);
  expect(published(seeded)).toBe(false);
  expect(holds(seeded).revocations).toEqual(outstanding);
  // The seeded ledger carries through a retained use, unlike the held rows.
  const retainedRelease = await release('retain', seeded);
  const after = await release('restore-bare', retainedRelease);
  expect(published(after)).toBe(false);
  expect(holds(after).revocations).toEqual(outstanding);
  // A base without a ledger or held rows seeds an empty one.
  const clean = await release(
    'restore-bare',
    await withoutLedger(await release('restore-bare', first)),
  );
  expect(published(clean)).toBe(true);
  expect(holds(clean).revocations).toEqual([]);
});

it('binds the revocation ledger into the release fingerprint (#411)', async () => {
  const { chain } = await revocationLedgerChains();
  const { validateCatalogReleaseArtifact } =
    await import('../../src/lib/catalog/release-schema');
  const [, revoked] = await chain(['admit', 'revoke']);
  const tampered = {
    ...revoked!,
    batches: revoked!.batches.map((batch) =>
      batch.map((row) =>
        row.kind === 'report' && row.key === 'holds'
          ? { ...row, payload: { ...(row.payload as object), revocations: [] } }
          : row,
      ),
    ),
  };
  await expect(validateCatalogReleaseArtifact(tampered)).rejects.toThrow(
    'output fingerprint mismatch',
  );
});

/**
 * The ledger's model: Cleave is admitted in a release exactly when that
 * release's own inputs admit it and no revocation is outstanding. A retained
 * use needs a body an earlier release published (`refused` otherwise).
 */
type LedgerState = {
  everRevoked: boolean;
  everPublished: boolean;
  outstanding: boolean;
  admitted: boolean;
};

const ledgerTransitions: Record<
  LedgerStep,
  (state: LedgerState) => Partial<LedgerState>
> = {
  // Its comparison is revoked once any release revoked it.
  admit: ({ everRevoked, outstanding }) => ({
    outstanding: outstanding || everRevoked,
    admitted: !(outstanding || everRevoked),
  }),
  revoke: () => ({ everRevoked: true, outstanding: true, admitted: false }),
  'revoke-retain': () => ({
    everRevoked: true,
    outstanding: true,
    admitted: false,
  }),
  retain: () => ({ admitted: false }),
  omit: () => ({ admitted: false }),
  'restore-bare': ({ outstanding }) => ({ admitted: !outstanding }),
  're-review': () => ({ outstanding: false, admitted: true }),
};

function expectedLedgerState(steps: readonly LedgerStep[]) {
  let state: LedgerState = {
    everRevoked: false,
    everPublished: false,
    outstanding: false,
    admitted: false,
  };
  for (const step of steps) {
    if (step === 'retain' && !state.everPublished)
      return { refused: true as const };
    state = { ...state, ...ledgerTransitions[step](state) };
    state.everPublished ||= state.admitted;
  }
  return { refused: false as const, ...state };
}

/** The review's three chains (`a revocation holds the key …` above). */
const reviewedLedgerChains = [
  ['admit', 'revoke-retain', 'retain', 'restore-bare'],
  ['admit', 'revoke', 'retain', 'restore-bare'],
  ['admit', 'revoke', 'omit', 'restore-bare'],
] as const satisfies readonly (readonly LedgerStep[])[];

it('admits the key in the last release only if no revocation is outstanding, for every sequence of up to four steps and the review chains’ fifth steps (#411)', async () => {
  const { release, published, holds, outstanding } =
    await revocationLedgerChains();
  type Release = Awaited<ReturnType<typeof release>>;
  let built = 0;
  let refused = 0;
  /** Builds `step` after `previous` and checks it against the model, or its refusal. */
  const check = async (sequence: readonly LedgerStep[], previous?: Release) => {
    const step = sequence.at(-1);
    if (!step) throw new Error('An empty sequence.');
    const expected = expectedLedgerState(sequence);
    const label = sequence.join(' → ');
    if (expected.refused) {
      await expect(release(step, previous), label).rejects.toThrow(
        'Missing last usable retained definition: pf1/Cleave.',
      );
      return undefined;
    }
    const current = await release(step, previous);
    expect(published(current), label).toBe(expected.admitted);
    expect(holds(current).revocations, label).toEqual(
      expected.outstanding ? outstanding : [],
    );
    expect(holds(current).revokedEvidence, label).toEqual(
      expected.everRevoked ? ['comparison'] : [],
    );
    if (published(current)) expect(expected.outstanding, label).toBe(false);
    built++;
    return current;
  };
  // Depth first, so each prefix's release is built once and is the last
  // release of its own sequence. A mistake in the ledger shows within four
  // steps: admit, revoke, a retained use or omission, and a fallback.
  const visit = async (steps: LedgerStep[], previous?: Release) => {
    if (steps.length === 4) return;
    for (const step of ledgerSteps) {
      const sequence = [...steps, step];
      const current = await check(sequence, previous);
      if (!current) {
        // It and every sequence it starts: 6⁰ + … + 6^(4 - length).
        refused += (6 ** (5 - sequence.length) - 1) / 5;
        continue;
      }
      await visit(sequence, current);
    }
  };
  await visit([]);
  // 6 + 6² + 6³ + 6⁴ sequences, each built or refused: a refused one
  // retains Cleave before any release published it.
  expect({ built, refused }).toEqual({ built: 1145, refused: 409 });
  // Each review chain, then every fifth step after it.
  built = 0;
  for (const chain of reviewedLedgerChains) {
    let previous: Release | undefined;
    for (let length = 1; length <= chain.length; length++)
      previous = await check(chain.slice(0, length), previous);
    for (const step of ledgerSteps) await check([...chain, step], previous);
  }
  expect(built).toBe(3 * 4 + 3 * 6);
}, 600_000);

describe('the verified/unverified label (#227 slice 4)', () => {
  const sourceBody = 'Source body mechanics';
  /** Cleave's released label, with Cleave's inventory row and projection. */
  async function cleaveLabel(
    projection: Parameters<typeof cleaveVerification>[0],
  ) {
    const { createCatalogRelease, entry, artifact, original, options, row } =
      await cleaveReleases();
    const release = await createCatalogRelease({
      ...options,
      attribution: original,
      artifact,
      releaseNumber: 1,
      verification: await cleaveVerification(projection),
    });
    return (row(release, entry.externalKey) as { verification?: unknown })
      .verification;
  }

  it('labels a definition verified when its structure is verified and no mechanism is outstanding', async () => {
    await expect(cleaveLabel({})).resolves.toEqual({ state: 'verified' });
  });

  it('labels a definition whose only outstanding mechanism is a recorded prose case verified (owner 2026-11-11 §3)', async () => {
    await expect(
      cleaveLabel({
        mechanisms: [{ name: sourceBody, status: 'outstanding' }],
        projected: {
          prose: [{ mechanism: sourceBody, category: 'attack-feat-text' }],
        },
      }),
    ).resolves.toEqual({ state: 'verified' });
  });

  it('labels a definition with an unproven mechanism unverified', async () => {
    await expect(
      cleaveLabel({
        mechanisms: [
          { name: sourceBody, status: 'outstanding' },
          { name: 'Reused grant', status: 'reused' },
        ],
      }),
    ).resolves.toEqual({
      state: 'unverified',
      reasons: ['unproven mechanism'],
    });
    // A mechanism the projection proves no longer counts.
    await expect(
      cleaveLabel({
        mechanisms: [{ name: sourceBody, status: 'outstanding' }],
        projected: { mechanisms: [sourceBody] },
      }),
    ).resolves.toEqual({ state: 'verified' });
  });

  it('labels a definition outside the launch inventory, or one whose structure or body the projection did not verify, unverified', async () => {
    await expect(cleaveLabel({ inInventory: false })).resolves.toEqual({
      state: 'unverified',
      reasons: ['outside the launch inventory'],
    });
    await expect(
      cleaveLabel({ projected: { verified: ['admission'], evidence: [] } }),
    ).resolves.toEqual({
      state: 'unverified',
      reasons: ['structure not verified'],
    });
    await expect(
      cleaveLabel({
        projected: { evidence: [`entry:sha256:${'0'.repeat(64)}`] },
      }),
    ).resolves.toEqual({
      state: 'unverified',
      reasons: ['definition differs from the verified one'],
    });
  });

  it('labels every definition unverified from a stale projection, or without one, never verified', async () => {
    const { statusVerification } = await import('../../scripts/mvp-status');
    const { launchVerificationSchema } =
      await import('../../scripts/catalog/launch-verification');
    const document = launchVerificationSchema.parse({
      version: 1,
      scopeVersion: 'campaign-mvp-v1',
      binding: {
        launchScopeIdentity: `sha256:${'1'.repeat(64)}`,
        calculationIdentity: `sha256:${'2'.repeat(64)}`,
        proofsSha256: '3'.repeat(64),
        gate: {
          extractionFingerprint: '4'.repeat(64),
          reviewedInputsFingerprint: '5'.repeat(64),
          legalResourcesFingerprint: '6'.repeat(64),
          upstream: [],
        },
        inputs: {},
        packages: {
          parsers: { dependencyVersions: {}, resolutionSha256: '9'.repeat(64) },
          imports: {},
        },
      },
      rows: [],
    });
    // The calculation identity moved since the projection was written.
    const status = await statusVerification(document, {
      scopeVersion: 'campaign-mvp-v1',
      launchScopeIdentity: document.binding.launchScopeIdentity,
      calculationIdentity: `sha256:${'8'.repeat(64)}`,
      proofsSha256: document.binding.proofsSha256,
      proofs: { registry: [], sha256Of: () => undefined },
      proseCases: [],
      sha256Of: () => Promise.resolve(undefined),
      packages: () => Promise.resolve(document.binding.packages),
    });
    expect(status.stale).toEqual(['the calculation identity changed']);
    // A stale projection gives its rows to nobody, even a verified row.
    await expect(cleaveLabel({ stale: status.stale })).resolves.toEqual({
      state: 'unverified',
      reasons: ['verification projection stale'],
    });
    const { createCatalogRelease, entry, artifact, original, options, row } =
      await cleaveReleases();
    const unlabelled = await createCatalogRelease({
      ...options,
      attribution: original,
      artifact,
      releaseNumber: 1,
    });
    expect(row(unlabelled, entry.externalKey)).toMatchObject({
      verification: {
        state: 'unverified',
        reasons: ['no verification projection'],
      },
    });
  });

  /**
   * The spec review's sequence (#227 slice 4 r1): Cleave released at
   * release 1, then held from release 2 by its revoked comparison while a
   * Character's copy keeps its last usable body, each release built under
   * its own verification. Returns each release's Cleave body: the live
   * definition, else the retained one.
   */
  async function retainedCleave(
    verifications: readonly (ReleaseVerification | undefined)[],
  ) {
    const {
      createCatalogRelease,
      computeFingerprint,
      entry,
      assess,
      comparison,
      original,
      options,
      row,
    } = await cleaveReleases();
    const use = {
      useId: 'vessa-cleave-copy',
      externalKey: entry.externalKey,
      name: 'Cleave (Ironfang drill)',
      characterId: 'vessa',
      definitionFingerprint: computeFingerprint(entry),
      admittedRelease: 1,
      requiredNotices: ['CRB'],
    };
    const held = {
      ...assess({ comparison: { ...comparison, revoked: true } }, 'comparison'),
      retainedUses: [use],
      retainedExceptions: [
        {
          useId: use.useId,
          externalKey: use.externalKey,
          definitionFingerprint: use.definitionFingerprint,
          reason: 'Attribution evidence revoked; the existing copy is kept.',
          requiredNotices: ['CRB'],
        },
      ],
    };
    const bodies: unknown[] = [];
    const retirements: unknown[] = [];
    let previous: Awaited<ReturnType<typeof createCatalogRelease>> | undefined;
    for (const [index, verification] of verifications.entries()) {
      previous = await createCatalogRelease({
        ...options,
        attribution: index === 0 ? original : held,
        previous,
        releaseNumber: index + 1,
        verification,
      });
      const retirement = row(previous, `retirement:${entry.externalKey}`);
      retirements.push(retirement);
      bodies.push(
        row(previous, entry.externalKey) ??
          (retirement as { lastUsableDefinition?: unknown } | undefined)
            ?.lastUsableDefinition,
      );
    }
    return { bodies, retirements, fingerprint: use.definitionFingerprint };
  }
  const labelled = (body: unknown, verification: unknown) => ({
    ...(body as object),
    verification,
  });

  it('relabels a retained definition released verified unverified when the projection is stale or absent at the next build, keeping its body and binding', async () => {
    const verified = await cleaveVerification();
    for (const [next, reasons] of [
      [
        await cleaveVerification({
          stale: ['the calculation identity changed'],
        }),
        ['verification projection stale'],
      ],
      [undefined, ['no verification projection']],
    ] as const) {
      const {
        bodies: [released, retained],
        retirements: [, retirement],
        fingerprint,
      } = await retainedCleave([verified, next]);
      expect(released).toMatchObject({ verification: { state: 'verified' } });
      // Only the label changes: the body and its retained binding stay.
      expect(retained).toEqual(
        labelled(released, { state: 'unverified', reasons }),
      );
      expect(retirement).toMatchObject({ definitionFingerprint: fingerprint });
    }
  });

  it('relabels a retained definition released unverified verified once the projection proves it, at every later build', async () => {
    const stale = await cleaveVerification({
      stale: ['the calculation identity changed'],
    });
    const {
      bodies: [released, proven, staleAgain],
      retirements,
      fingerprint,
    } = await retainedCleave([stale, await cleaveVerification(), stale]);
    expect(released).toMatchObject({
      verification: {
        state: 'unverified',
        reasons: ['verification projection stale'],
      },
    });
    expect(proven).toEqual(labelled(released, { state: 'verified' }));
    // Release 3 relabels the body release 2 retained.
    expect(staleAgain).toEqual(released);
    for (const retirement of retirements.slice(1))
      expect(retirement).toMatchObject({ definitionFingerprint: fingerprint });
  });
});
