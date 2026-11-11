import { createHash } from 'node:crypto';
import {
  appendFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { runCapturedProcess } from '../../scripts/catalog/process';
import { appendConditionResources } from '../../scripts/catalog/conditions';
import { formatCatalogData } from '../../scripts/catalog/data-files';
import { importCatalog } from '../../scripts/catalog/import';
import { dirname, join, resolve } from 'node:path';
// @vitest-environment node
import { expect, test } from 'vitest';
import { buildConditionCatalogArtifact } from '../../scripts/catalog/conditions';
import {
  assessCatalogAdmission,
  buildAssessmentBinding,
  computeFingerprint,
} from '../../scripts/catalog/admission';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';

test('unchanged condition bindings preserve their reviewed provenance while release resources follow current files', async () => {
  const artifact = await buildConditionCatalogArtifact();
  const calculator = artifact.catalog.localResources.find(
    (resource) => resource.path === 'src/lib/character-sheet.ts',
  );
  expect(calculator?.sha256).not.toBe(
    'f3d4064fbecee5cc5a2326f32197fa98aac890c4c46d5461669c6e39fca28d67',
  );
  for (const resource of artifact.catalog.localResources) {
    expect(resource.sha256).toBe(
      createHash('sha256')
        .update(await readFile(resource.path))
        .digest('hex'),
    );
  }
  for (const entry of artifact.catalog.entries) {
    const assessment = reviewedAdmission.assessments.find(
      (candidate) => candidate.externalKey === entry.externalKey,
    );
    if (!assessment) throw new Error(`Missing assessment for ${entry.name}`);
    expect(assessment).toMatchObject(
      buildAssessmentBinding({
        artifact,
        entry,
        requiredNotices: assessment.requiredNotices,
        evidenceIds: Object.keys(assessment.evidenceFingerprints),
        ...reviewedAdmission,
      }),
    );
  }
  expect(
    assessCatalogAdmission({ artifact, ...reviewedAdmission }).held,
  ).toEqual([]);
  const reviewedResources = structuredClone(artifact);
  const reviewedCalculator = reviewedResources.catalog.localResources.find(
    (resource) => resource.path === 'src/lib/character-sheet.ts',
  );
  if (!reviewedCalculator) throw new Error('Missing calculator resource');
  reviewedCalculator.sha256 =
    'f3d4064fbecee5cc5a2326f32197fa98aac890c4c46d5461669c6e39fca28d67';
  expect(computeFingerprint(artifact)).not.toBe(
    computeFingerprint(reviewedResources),
  );
  expect(
    assessCatalogAdmission({
      artifact: reviewedResources,
      ...reviewedAdmission,
    }),
  ).toEqual(assessCatalogAdmission({ artifact, ...reviewedAdmission }));
});

test('all 34 locally authored condition candidates pass the ordinary attribution and notice admission gate', async () => {
  const artifact = await buildConditionCatalogArtifact();
  const report = assessCatalogAdmission({ artifact, ...reviewedAdmission });
  expect(report.failures).toEqual([]);
  expect(report.held).toEqual([]);
  expect(report.admitted).toHaveLength(34);
  expect(report.requiredNotices).toEqual(['CRB']);
  expect(
    artifact.catalog.localResources.map((resource) => resource.path),
  ).toEqual([
    'src/lib/catalog/data/reviewed-conditions.json',
    'docs/ai/pf1-core-rules/pf1-crb-conditions.md',
    'src/lib/character-sheet-conditions.ts',
    'src/lib/character-sheet.ts',
  ]);
});

test.each([{ school: 'evocation' }, { castingClass: 'wizard' }])(
  'adding a spellcasting restriction %j to a condition Modifier reopens review',
  async (restriction) => {
    const artifact = await buildConditionCatalogArtifact();
    const dazzled = artifact.catalog.entries.find(
      (entry) => entry.name === 'Dazzled',
    );
    const assessment = reviewedAdmission.assessments.find(
      (candidate) => candidate.externalKey === dazzled?.externalKey,
    );
    if (!dazzled || !assessment) throw new Error('Missing Dazzled');
    dazzled.modifiers = dazzled.modifiers.map((modifier) => ({
      ...modifier,
      condition: { ...modifier.condition, ...restriction },
    }));
    const binding = buildAssessmentBinding({
      artifact,
      entry: dazzled,
      requiredNotices: assessment.requiredNotices,
      evidenceIds: Object.keys(assessment.evidenceFingerprints),
      ...reviewedAdmission,
    });
    expect(binding.contentFingerprint).not.toBe(assessment.contentFingerprint);
    const report = assessCatalogAdmission({ artifact, ...reviewedAdmission });
    expect(report.admitted).toHaveLength(33);
    expect(report.held).toEqual([
      expect.objectContaining({
        name: 'Dazzled',
        reason: expect.stringContaining('no longer matches current content'),
      }),
    ]);
  },
);

test('absent optional spellcasting restrictions preserve condition admission when represented as undefined', async () => {
  const artifact = await buildConditionCatalogArtifact();
  const dazzled = artifact.catalog.entries.find(
    (entry) => entry.name === 'Dazzled',
  );
  if (!dazzled) throw new Error('Missing Dazzled');
  if (!dazzled.modifiers.some((modifier) => modifier.condition))
    throw new Error('Missing conditional Dazzled Modifier');
  dazzled.modifiers = dazzled.modifiers.map((modifier) =>
    modifier.condition
      ? {
          ...modifier,
          condition: {
            ...modifier.condition,
            school: undefined,
            castingClass: undefined,
          },
        }
      : modifier,
  );
  const report = assessCatalogAdmission({ artifact, ...reviewedAdmission });
  expect(report.held).toEqual([]);
  expect(report.admitted).toHaveLength(34);
});

test('edited condition definitions and lost notices reopen attribution rather than receiving fresh approvals', async () => {
  const artifact = await buildConditionCatalogArtifact();
  const blinded = artifact.catalog.entries.find(
    (entry) => entry.name === 'Blinded',
  );
  if (!blinded) throw new Error('Missing Blinded');
  blinded.modifiers = [{ target: 'ac', bonusType: 'untyped', value: -7 }];
  const changed = assessCatalogAdmission({ artifact, ...reviewedAdmission });
  expect(changed.held).toContainEqual(
    expect.objectContaining({
      name: 'Blinded',
      reason: expect.stringContaining('no longer matches current content'),
    }),
  );
  expect(changed.admitted).toHaveLength(33);
  const { CRB: _crb, ...registry } = reviewedAdmission.registry;
  const missing = assessCatalogAdmission({
    artifact: await buildConditionCatalogArtifact(),
    ...reviewedAdmission,
    registry,
  });
  expect(missing.admitted).toEqual([]);
  expect(missing.held).toHaveLength(34);
});

test('local candidates are genuinely inventoried and metadata changes are content-bound', async () => {
  const artifact = await buildConditionCatalogArtifact();
  artifact.comparison.records = artifact.comparison.records.filter(
    (entry) => entry.name !== 'Panicked',
  );
  const missing = assessCatalogAdmission({ artifact, ...reviewedAdmission });
  expect(missing.failures).toContainEqual(
    expect.objectContaining({
      externalKey: 'local/crb-condition/panicked',
      reason: 'Unaccounted candidate: absent from import inventory.',
    }),
  );
  const panicked = artifact.catalog.entries.find(
    (entry) => entry.name === 'Panicked',
  );
  if (panicked?.detail.kind !== 'condition')
    throw new Error('Missing Panicked');
  panicked.detail.unmodeled = [];
  artifact.comparison.records = (
    await buildConditionCatalogArtifact()
  ).comparison.records;
  expect(
    assessCatalogAdmission({ artifact, ...reviewedAdmission }).held,
  ).toContainEqual(
    expect.objectContaining({
      name: 'Panicked',
      reason: expect.stringContaining('no longer matches current content'),
    }),
  );
  const modified = assessCatalogAdmission({
    artifact: await buildConditionCatalogArtifact(),
    ...reviewedAdmission,
    evidence: {
      ...reviewedAdmission.evidence,
      'crb-conditions-311': { content: 'Changed supporting corpus' },
    },
  });
  expect(modified.held).toHaveLength(34);
  const changed = await buildConditionCatalogArtifact();
  const first = changed.catalog.entries[0];
  if (first?.detail.kind !== 'condition') throw new Error('Missing condition');
  first.detail.deniesDexterityBonus = true;
  expect(
    assessCatalogAdmission({ artifact: changed, ...reviewedAdmission }).held,
  ).toContainEqual(expect.objectContaining({ name: 'Bleed' }));
});

test('the public offline condition command reproduces the committed admission report', async () => {
  const result = runCapturedProcess({
    command: process.execPath,
    args: ['--import', 'tsx', 'scripts/catalog-conditions.ts'],
  });
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
  const committed = JSON.parse(
    await readFile('docs/catalog-import/conditions-admission.json', 'utf8'),
  );
  expect(JSON.parse(result.stdout)).toEqual(committed);
});

test('editing the conditions resolver reopens all 34 assessments and changes the release fingerprint', async () => {
  const root = await mkdtemp(join(tmpdir(), 'condition-resolver-review-'));
  try {
    for (const path of [
      'package.json',
      'scripts/catalog-conditions.ts',
      'scripts/catalog/conditions.ts',
      'scripts/catalog/admission.ts',
      'scripts/catalog/legal/held-notices.json',
      // The gate reads the owner's notice-hold clearance (2026-10-30).
      'scripts/catalog/legal/notice-clearances.ts',
      'scripts/catalog/legal/notice-clearances.json',
      'scripts/catalog/legal/known-notice-holds.json',
      // #716 P10a: the gate reads the Section 15 confirmations.
      'scripts/catalog/legal/section15-confirmations.ts',
      'scripts/catalog/legal/section15-confirmations-716.json',
      'scripts/catalog/inventory.ts',
      'scripts/catalog/prd-identity.ts',
      'scripts/catalog/review-receipts.ts',
      'src/lib/catalog',
      'src/lib/character-sheet-conditions.ts',
      'src/lib/character-sheet.ts',
      'docs/ai/pf1-core-rules/pf1-crb-conditions.md',
    ]) {
      const destination = join(root, path);
      await mkdir(dirname(destination), { recursive: true });
      await cp(resolve(path), destination, { recursive: true });
    }
    // The full-data CLI is checked above. This isolated resolver edit needs
    // the conditions' evidence and every conclusion referenced by the copied
    // assessments, without compiling the unrelated corpus in each child.
    const artifact = await buildConditionCatalogArtifact();
    const conditionKeys = new Set(
      artifact.catalog.entries.map((entry) => entry.externalKey),
    );
    const evidenceIds = new Set(
      reviewedAdmission.assessments
        .filter((assessment) => conditionKeys.has(assessment.externalKey))
        .flatMap((assessment) => Object.keys(assessment.evidenceFingerprints)),
    );
    for (const assessment of reviewedAdmission.assessments) {
      if (assessment.conclusionRef)
        evidenceIds.add(assessment.conclusionRef.evidenceId);
    }
    const evidence = Object.fromEntries(
      [...evidenceIds].map((id) => [id, reviewedAdmission.evidence[id]]),
    );
    const evidencePath = join(
      root,
      'src/lib/catalog/data/attribution-evidence.json',
    );
    await writeFile(evidencePath, formatCatalogData('evidence', evidence));
    await symlink(resolve('node_modules'), join(root, 'node_modules'));
    const args = [
      '--import',
      fileURLToPath(import.meta.resolve('tsx')),
      'scripts/catalog-conditions.ts',
    ];
    const baseline = runCapturedProcess({
      command: process.execPath,
      args,
      cwd: root,
    });
    expect(baseline.stderr).toBe('');
    expect(baseline.status).toBe(0);
    const before = JSON.parse(baseline.stdout);
    expect(before.admission.admitted).toHaveLength(34);
    expect(before.admission.held).toEqual([]);
    expect(before).toEqual(
      JSON.parse(
        await readFile('docs/catalog-import/conditions-admission.json', 'utf8'),
      ),
    );

    const reference = reviewedAdmission.assessments.find(
      (assessment) =>
        !conditionKeys.has(assessment.externalKey) && assessment.conclusionRef,
    )?.conclusionRef;
    if (!reference) throw new Error('Missing unrelated conclusion reference');
    const referenced = evidence[reference.evidenceId];
    if (!referenced?.conclusion) throw new Error('Missing referenced evidence');
    for (const replacement of [
      undefined,
      {
        ...referenced,
        conclusion: {
          ...referenced.conclusion,
          externalKey: 'local/crb-condition/bleed',
        },
      },
    ]) {
      const edited = { ...evidence, [reference.evidenceId]: replacement };
      if (!replacement) delete edited[reference.evidenceId];
      await writeFile(evidencePath, formatCatalogData('evidence', edited));
      const invalid = runCapturedProcess({
        command: process.execPath,
        args,
        cwd: root,
      });
      expect(invalid.status).not.toBe(0);
      expect(invalid.stdout).toBe('');
      expect(invalid.stderr).toContain(
        'Missing or mismatched diagnostic conclusion reference.',
      );
    }
    await writeFile(evidencePath, formatCatalogData('evidence', evidence));

    await appendFile(
      join(root, 'src/lib/character-sheet-conditions.ts'),
      '\n// Resolver source changed after attribution review.\n',
    );
    const changed = runCapturedProcess({
      command: process.execPath,
      args,
      cwd: root,
    });
    expect(changed.stderr).toBe('');
    const after = JSON.parse(changed.stdout);
    expect(after.admission.admitted).toEqual([]);
    expect(after.admission.held).toHaveLength(34);
    for (const held of after.admission.held) {
      expect(held.reason).toContain('no longer matches current content');
    }
    expect(changed.status).toBe(1);
    expect(
      computeFingerprint({
        ...artifact,
        catalog: { ...artifact.catalog, localResources: after.localResources },
      }),
    ).not.toBe(
      computeFingerprint({
        ...artifact,
        catalog: { ...artifact.catalog, localResources: before.localResources },
      }),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('release preparation explicitly appends local definitions, inventory and fingerprint resources to upstream extraction', async () => {
  const upstream = await importCatalog({
    systemPath: resolve('tests/fixtures/catalog/pf1'),
    contentPath: resolve('tests/fixtures/catalog/pf1-content'),
    remaps: [],
  });
  const complete = await appendConditionResources(upstream);
  expect(
    complete.catalog.entries.filter(
      (entry) => entry.detail.kind === 'condition',
    ),
  ).toHaveLength(34);
  expect(
    complete.comparison.records.filter((entry) => entry.repo === 'local'),
  ).toHaveLength(34);
  expect(complete.catalog.localResources).toHaveLength(4);
  expect(
    assessCatalogAdmission({
      artifact: complete,
      ...reviewedAdmission,
    }).admitted.filter((entry) =>
      entry.externalKey.startsWith('local/crb-condition/'),
    ),
  ).toHaveLength(34);
  await expect(appendConditionResources(complete)).rejects.toThrow(
    'already present',
  );
});
