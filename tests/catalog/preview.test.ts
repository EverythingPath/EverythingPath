// @vitest-environment node
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { runCapturedProcess } from '../../scripts/catalog/process';
import { importCatalog } from '../../scripts/catalog/import';
import { runCatalogPreviewCommand } from '../../scripts/catalog/preview';
import { buildAssessmentBinding } from '../../scripts/catalog/admission';
import {
  reviewedAdmissionSchema,
  type Section15Registry,
} from '../../src/lib/catalog/admission-schema';

const script = resolve('scripts/catalog-preview.ts');
const fixtures = resolve('tests/fixtures/catalog');
const loader = fileURLToPath(import.meta.resolve('tsx'));
const temporary: string[] = [];

async function createWorkspace() {
  const root = await mkdtemp(join(tmpdir(), 'catalog-preview-'));
  temporary.push(root);
  return root;
}

async function createAdmissionFixture() {
  const root = await createWorkspace();
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
  const entry = artifact.catalog.entries[0];
  if (!entry) throw new Error('Fixture entry missing');
  const reviewed = {
    assessments: [
      {
        externalKey: entry.externalKey,
        status: 'unresolved',
        ...buildAssessmentBinding({
          entry,
          artifact,
          evidence: {},
          registry: {},
          requiredNotices: [],
          evidenceIds: [],
        }),
        requiredNotices: [],
        rationale: 'Synthetic fixture awaits content comparison.',
        reviewedBy: 'CLI fixture reviewer',
        reviewedOn: '2026-10-02',
      },
    ],
    evidence: {},
    registry: {},
  };
  const attribution = join(root, 'attribution.json');
  await writeFile(attribution, JSON.stringify(reviewed));
  return {
    root,
    artifact,
    reviewed,
    attribution,
    args: [
      '--system',
      system,
      '--content',
      content,
      '--allow-unverified-checkouts',
      '--attribution',
      attribution,
    ],
  };
}

function runPreview({
  args,
  cwd = process.cwd(),
}: {
  args: string[];
  cwd?: string;
}) {
  return runCapturedProcess({
    command: process.execPath,
    args: ['--import', loader, script, ...args],
    cwd,
  });
}

function getInputArgs() {
  return [
    '--system',
    join(fixtures, 'pf1'),
    '--content',
    join(fixtures, 'pf1-content'),
  ];
}

afterEach(async () => {
  await Promise.all(
    temporary
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

it('reports held candidates separately from inventory failures and extracted definitions', async () => {
  const root = await createWorkspace();
  const output = join(root, 'preview');
  const attribution = join(root, 'attribution.json');
  await writeFile(
    attribution,
    JSON.stringify({ assessments: [], evidence: {}, registry: {} }),
  );
  const result = runPreview({
    args: [
      ...getInputArgs(),
      '--allow-unverified-checkouts',
      '--attribution',
      attribution,
      '--out',
      output,
    ],
  });
  expect(result.stderr).toContain('Catalog admission failed');
  expect(result.status).toBe(1);
  expect(await readdir(output)).toEqual([
    'admission.json',
    'catalog.json',
    'comparison.json',
    'curation.json',
    'unsupported.json',
  ]);
  const catalog = JSON.parse(
    await readFile(join(output, 'catalog.json'), 'utf8'),
  );
  expect(catalog.entries).toContainEqual(
    expect.objectContaining({
      externalKey: 'pf1/e6IaBxKgMxy1yKlr',
      name: 'Human',
    }),
  );
  expect(catalog.purpose).toBe('preview');
  expect(catalog.releaseAdmission).toBe('not-evaluated');
  const admission = JSON.parse(
    await readFile(join(output, 'admission.json'), 'utf8'),
  );
  expect(admission.passed).toBe(false);
  expect(admission.admitted).toEqual([]);
  expect(admission.held).toContainEqual(
    expect.objectContaining({
      externalKey: 'pf1/e6IaBxKgMxy1yKlr',
      reason: 'missing Attribution Assessment',
      evidence: [],
    }),
  );
  expect(admission.inputVerification).toEqual({ status: 'unverified' });
  expect(admission.inputs).toEqual(catalog.inputs);
  expect(admission.extractionFingerprint).toMatch(/^[a-f0-9]{64}$/);
  expect(admission.reviewedInputsFingerprint).toMatch(/^[a-f0-9]{64}$/);
  for (const report of ['comparison', 'unsupported']) {
    expect(
      JSON.parse(await readFile(join(output, `${report}.json`), 'utf8')),
    ).toBeDefined();
  }
  expect(result.stdout).toContain(output);
  // S3: the Fighter's reviewed schedule adds its four Bravery increments.
  expect(result.stdout).toContain('Wrote 45 catalog entries and 20 resources');
});

it('requires exact pinned Git checkouts unless unverified input is explicitly requested', async () => {
  const root = await createWorkspace();
  const output = join(root, 'preview');
  const strict = runPreview({ args: [...getInputArgs(), '--out', output] });
  expect(strict.status).not.toBe(0);
  expect(strict.stderr).toContain('checkout');
  expect(await readdir(root)).toEqual([]);
  const unverified = runPreview({
    args: [...getInputArgs(), '--allow-unverified-checkouts', '--out', output],
  });
  expect(unverified.status).toBe(1);
  expect(unverified.stderr).toContain('Catalog admission failed');
  const catalog = JSON.parse(
    await readFile(join(output, 'catalog.json'), 'utf8'),
  );
  expect(catalog.inputVerification).toEqual({ status: 'unverified' });
});

it('succeeds with individually reviewed holds and writes repeatable admission reports', async () => {
  const { root, args } = await createAdmissionFixture();
  const output = join(root, 'preview');
  const result = runPreview({ args: [...args, '--out', output] });
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
  const original = await readFile(join(output, 'admission.json'), 'utf8');
  expect(JSON.parse(original)).toMatchObject({
    passed: true,
    admitted: [],
    held: [{ externalKey: 'pf1/FixtureFeat', name: 'Fixture feat' }],
    failures: [],
  });
  expect(result.stdout).toContain('0 admitted, 1 held');
  expect(runPreview({ args: [...args, '--out', output] }).status).toBe(0);
  expect(await readFile(join(output, 'admission.json'), 'utf8')).toBe(original);
});

it('reports legal resource provenance and outstanding retained notices without failing named holds', async () => {
  const { root, args, attribution, reviewed } = await createAdmissionFixture();
  await writeFile(
    attribution,
    JSON.stringify({
      ...reviewed,
      retainedUses: [
        {
          useId: 'previous-selection',
          externalKey: 'pf1/OldFeat',
          name: 'Old feat',
          characterId: 'character-one',
          definitionFingerprint: 'old-definition',
          admittedRelease: 1,
          requiredNotices: ['MISSING-BOOK'],
        },
      ],
      retainedExceptions: [
        {
          useId: 'previous-selection',
          externalKey: 'pf1/OldFeat',
          definitionFingerprint: 'old-definition',
          reason: 'Previously admitted; notice review remains outstanding.',
          requiredNotices: ['MISSING-BOOK'],
        },
      ],
    }),
  );
  const output = join(root, 'preview');
  const result = runPreview({ args: [...args, '--out', output] });
  expect(result.status).toBe(0);
  const admission = JSON.parse(
    await readFile(join(output, 'admission.json'), 'utf8'),
  );
  expect(admission.legalResourcesFingerprint).toMatch(/^[a-f0-9]{64}$/);
  expect(admission.outstandingNotices).toEqual([
    { code: 'MISSING-BOOK', title: 'MISSING-BOOK', reason: 'missing' },
  ]);
  expect(admission.outstandingResources).toEqual([]);
});

const acceptedReviewGaps: { problem: string; reason: string }[] = [
  {
    problem: 'stale content',
    reason:
      'Accepted assessment no longer matches current content — re-review required.',
  },
  {
    problem: 'stale mapping',
    reason:
      'Accepted assessment no longer matches current identity mapping — re-review required.',
  },
  {
    problem: 'changed evidence',
    reason: 'Attribution evidence requires re-review: comparison (changed).',
  },
  {
    problem: 'absent evidence',
    reason: 'Attribution evidence requires re-review: comparison (missing).',
  },
  {
    problem: 'revoked evidence',
    reason: 'Attribution evidence requires re-review: comparison (revoked).',
  },
  {
    problem: 'changed notice',
    reason: 'Notice bindings require re-review: FIXTURE (changed).',
  },
  {
    problem: 'missing notice binding',
    reason: 'Notice bindings require re-review: FIXTURE (missing).',
  },
  {
    problem: 'missing notice',
    reason: 'Missing or unreviewed required notices: FIXTURE.',
  },
  {
    problem: 'unreviewed notice',
    reason: 'Missing or unreviewed required notices: FIXTURE.',
  },
];

it.each(
  (['confirmed', 'reviewed-coverage'] as const).flatMap((status) =>
    acceptedReviewGaps.map((gap) => ({ ...gap, status })),
  ),
)(
  'succeeds with an individual hold for $status attribution with $problem',
  async ({ status, problem, reason }) => {
    const { root, args, attribution, reviewed, artifact } =
      await createAdmissionFixture();
    const entry = artifact.catalog.entries[0];
    if (!entry) throw new Error('Fixture entry missing');
    const evidence = {
      comparison: { content: 'Synthetic comparison for CLI testing only.' },
    };
    const registry = {
      FIXTURE: {
        title: 'Fixture book',
        notice: 'Fixture copyright notice.',
        reviewStatus: 'reviewed',
        checkedAgainst: 'printed',
        checkedOn: '2026-10-03',
        provenance: ['Synthetic notice provenance for CLI testing only.'],
        aliases: [],
      },
    } satisfies Section15Registry;
    const accepted = reviewedAdmissionSchema.parse({
      ...reviewed,
      evidence,
      registry,
      assessments: [
        {
          ...reviewed.assessments[0],
          status,
          requiredNotices: ['FIXTURE'],
          ...buildAssessmentBinding({
            entry,
            artifact,
            evidence,
            registry,
            requiredNotices: ['FIXTURE'],
            evidenceIds: ['comparison'],
          }),
        },
      ],
    });
    await writeFile(attribution, JSON.stringify(accepted));
    // The matrix runs in-process through the command the executable forwards
    // to; the other cases cover its process, exit, streams and help. Each row
    // runs twice on changed input, so state cached between calls would show.
    const baseline = join(root, 'accepted');
    expect(
      (
        await runCatalogPreviewCommand({
          args: [...args, '--out', baseline],
          cwd: root,
        })
      ).status,
    ).toBe(0);
    expect(
      JSON.parse(await readFile(join(baseline, 'admission.json'), 'utf8')),
    ).toMatchObject({
      admitted: [{ externalKey: 'pf1/FixtureFeat' }],
      held: [],
      failures: [],
    });
    const assessment = accepted.assessments[0];
    const comparison = accepted.evidence.comparison;
    const notice = accepted.registry.FIXTURE;
    if (!assessment || !comparison || !notice)
      throw new Error('Accepted fixture review missing');
    if (problem === 'stale content')
      assessment.contentFingerprint = '0'.repeat(64);
    else if (problem === 'stale mapping')
      assessment.mappingFingerprint = '0'.repeat(64);
    else if (problem === 'changed evidence')
      comparison.content = 'Corrected fixture comparison.';
    else if (problem === 'absent evidence') delete accepted.evidence.comparison;
    else if (problem === 'revoked evidence') comparison.revoked = true;
    else if (problem === 'changed notice')
      notice.notice = 'Corrected fixture notice.';
    else if (problem === 'missing notice binding')
      assessment.noticeFingerprints = {};
    else if (problem === 'missing notice') accepted.registry = {};
    else if (problem === 'unreviewed notice') {
      notice.reviewStatus = 'unreviewed';
      notice.checkedAgainst = 'unreviewed';
    }
    await writeFile(attribution, JSON.stringify(accepted));
    const output = join(root, 'preview');
    const result = await runCatalogPreviewCommand({
      args: [...args, '--out', output],
      cwd: root,
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('0 admitted, 1 held');
    const admission = JSON.parse(
      await readFile(join(output, 'admission.json'), 'utf8'),
    );
    expect(admission.passed).toBe(true);
    expect(admission.admitted).toEqual([]);
    expect(admission.held).toEqual([
      {
        externalKey: 'pf1/FixtureFeat',
        name: 'Fixture feat',
        reason,
        requiredNotices: ['FIXTURE'],
        missingNotices: ['missing notice', 'unreviewed notice'].includes(
          problem,
        )
          ? ['FIXTURE']
          : [],
        evidence: ['comparison'],
      },
    ]);
    expect(admission.failures).toEqual([]);
    expect(admission.requiredNotices).toEqual([]);
    expect(
      JSON.parse(await readFile(join(output, 'catalog.json'), 'utf8')).entries,
    ).toHaveLength(1);
  },
);

it.each(['missing inputs', 'invalid review metadata'])(
  'rejects malformed reviewed inputs (%s) without writing reports',
  async (problem) => {
    const { root, args, attribution, reviewed } =
      await createAdmissionFixture();
    const malformed =
      problem === 'missing inputs'
        ? { assessments: [] }
        : {
            ...reviewed,
            assessments: reviewed.assessments.map((assessment) => ({
              ...assessment,
              reviewedBy: '',
              reviewedOn: '2026-02-30',
            })),
          };
    await writeFile(attribution, JSON.stringify(malformed));
    const output = join(root, 'preview');
    const result = runPreview({ args: [...args, '--out', output] });
    expect(result.status).toBe(1);
    expect(result.stderr).not.toBe('');
    await expect(readdir(output)).rejects.toMatchObject({ code: 'ENOENT' });
  },
);

it.each(
  [
    [],
    ['--system', join(fixtures, 'pf1')],
    [...getInputArgs(), '--unknown'],
    [...getInputArgs(), '--out'],
    [...getInputArgs(), '--out', ''],
    [...getInputArgs(), '--system'],
    [...getInputArgs(), 'unexpected-positional'],
    [
      '--system',
      '/missing/catalog-checkout',
      '--content',
      join(fixtures, 'pf1-content'),
    ],
  ].map((args) => ({ args })),
)(
  'rejects invalid arguments or missing checkouts without output: $args',
  async ({ args }) => {
    const root = await createWorkspace();
    const result = runPreview({
      args: ['--allow-unverified-checkouts', ...args],
      cwd: root,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).not.toBe('');
    expect(await readdir(root)).toEqual([]);
  },
);

it.each([
  'source',
  'source-symlink',
  'source-parent',
  'populated-directory',
  'report-symlink',
])(
  'refuses unsafe output destinations without changing input or unrelated files: %s',
  async (destination) => {
    const root = await createWorkspace();
    const sources = join(root, 'sources');
    await cp(fixtures, sources, { recursive: true });
    const human = join(sources, 'pf1/packs/races/human.e6IaBxKgMxy1yKlr.yaml');
    const originalHuman = await readFile(human, 'utf8');
    let output = join(root, 'output');
    if (destination === 'source')
      output = join(sources, 'pf1', 'generated', 'preview');
    if (destination === 'source-symlink') {
      await symlink(join(sources, 'pf1-content'), join(root, 'source-alias'));
      output = join(root, 'source-alias', 'generated', 'preview');
    }
    if (destination === 'source-parent') output = root;
    if (destination === 'populated-directory') {
      await mkdir(output);
      await writeFile(join(output, 'notes.txt'), 'keep these notes');
    }
    if (destination === 'report-symlink') {
      await mkdir(output);
      await symlink(human, join(output, 'catalog.json'));
    }
    const result = runPreview({
      args: [
        '--system',
        join(sources, 'pf1'),
        '--content',
        join(sources, 'pf1-content'),
        '--allow-unverified-checkouts',
        '--out',
        output,
      ],
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/output/i);
    expect(await readFile(human, 'utf8')).toBe(originalHuman);
    if (destination === 'populated-directory') {
      expect(await readdir(output)).toEqual(['notes.txt']);
      expect(await readFile(join(output, 'notes.txt'), 'utf8')).toBe(
        'keep these notes',
      );
    }
    await expect(
      readFile(join(output, 'unsupported.json')),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  },
);

it('uses the default output directory and preserves prior reports when a later import fails', async () => {
  const root = await createWorkspace();
  const sources = join(root, 'sources');
  await cp(fixtures, sources, { recursive: true });
  const args = [
    '--system',
    join(sources, 'pf1'),
    '--content',
    join(sources, 'pf1-content'),
    '--allow-unverified-checkouts',
  ];
  expect(runPreview({ args, cwd: root }).status).toBe(1);
  const output = join(root, '.catalog-preview');
  const names = await readdir(output);
  const original = await Promise.all(
    names.map((name) => readFile(join(output, name), 'utf8')),
  );
  // One process above covers the CLI entry; the later runs stay in-process.
  const rerun = (extra: string[] = []) =>
    runCatalogPreviewCommand({ args: [...args, ...extra], cwd: root });
  expect((await rerun()).status).toBe(1);
  const manifestPath = join(sources, 'pf1-content/module.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  await writeFile(
    manifestPath,
    JSON.stringify({ ...manifest, version: '12.0.0' }),
  );
  const failed = await rerun();
  expect(failed.status).not.toBe(0);
  expect(failed.stderr).toContain('major');
  expect(
    await Promise.all(
      names.map((name) => readFile(join(output, name), 'utf8')),
    ),
  ).toEqual(original);
  const absent = join(root, 'failed-output');
  expect((await rerun(['--out', absent])).status).not.toBe(0);
  await expect(readdir(absent)).rejects.toMatchObject({ code: 'ENOENT' });
});

it('describes required paths and the unverified override without importing or writing', async () => {
  const root = await createWorkspace();
  const help = runPreview({ args: ['--help'], cwd: root });
  expect(help.status).toBe(0);
  expect(help.stderr).toBe('');
  expect(help.stdout).toContain('--system PATH --content PATH');
  expect(help.stdout).toContain('--allow-unverified-checkouts');
  expect(await readdir(root)).toEqual([]);
});
