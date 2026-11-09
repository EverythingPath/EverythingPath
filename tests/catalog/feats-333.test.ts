// @vitest-environment node
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { parse, stringify } from 'yaml';
import review from '../../scripts/catalog/legal/feats-333.json';
import { reviewedCuration as curation } from '../../scripts/catalog/reviewed-curation-data';
import {
  importCatalog,
  draftCatalogCuration,
} from '../../scripts/catalog/import';
import {
  assessCatalogAdmission,
  buildAssessmentBinding,
} from '../../scripts/catalog/admission';
import {
  sourceDescription,
  upstreamRecord,
} from '../../scripts/catalog/records';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import { outputSchema } from '../../src/lib/catalog/curation-output-schema';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import {
  calculateCharacterSheetProjections,
  modifierTargets,
  resolveSheet,
} from '../../src/lib/character-sheet';
import provenance from '../fixtures/feats-333/provenance.json';
import preview from '../fixtures/feats-333/preview.json';
import { featFixtureSheet } from '../fixtures/feats-333/sheet';

const inputs = {
  systemPath: resolve('tests/fixtures/feats-333/pf1'),
  contentPath: resolve('tests/fixtures/feats-333/pf1-content'),
  remaps: [],
  curation,
};
const sha256 = (text: string) =>
  createHash('sha256').update(text).digest('hex');
function entry(name: string) {
  const row = preview.entries.find((row) => row.name === name);
  if (!row) throw new Error(`Missing feat: ${name}`);
  return row;
}
function modifiers(name: string) {
  const feat = entry(name);
  return feat.modifiers.map((raw) => ({
    ...outputSchema.options[0]
      .omit({ kind: true })
      .extend({ target: z.enum(modifierTargets) })
      .parse(raw),
    sheetEntryId: feat.externalKey,
    catalogEntryId: feat.externalKey,
    entryName: feat.name,
    source: feat.externalKey,
    builtIn: false,
  }));
}

it('accounts for the exact 13 source keys with reviewed content-bound evidence and independent mechanics scope', async () => {
  const keys = provenance.candidates.map((c) => c.externalKey);
  expect(keys).toHaveLength(13);
  expect(new Set(keys).size).toBe(13);
  expect(sha256(keys.join('\n'))).toBe(
    '7f95d07273213ba6407a0423e3e6cc6df23ff67f9db00361363ab52e36b7432e',
  );
  expect(review.candidates.map((c) => c.externalKey)).toEqual(keys);
  expect(
    review.candidates.filter((c) => c.disposition === 'supported/admitted'),
  ).toHaveLength(1);
  expect(
    review.candidates.filter((c) => c.disposition === 'held'),
  ).toHaveLength(11);
  expect(
    review.candidates.filter((c) => c.disposition === 'dependently-omitted'),
  ).toHaveLength(1);
  for (const candidate of review.candidates) {
    const source = provenance.candidates.find(
      (c) => c.externalKey === candidate.externalKey,
    );
    expect(candidate.source).toEqual(source?.source);
    const raw = await readFile(
      join(inputs.systemPath, candidate.source.path),
      'utf8',
    );
    expect(sha256(raw), candidate.name).toBe(candidate.source.sha256);
    const parsed = upstreamRecord.parse(parse(raw));
    expect(`pf1/${parsed._id}`).toBe(candidate.externalKey);
    expect(sha256(sourceDescription(parsed))).toBe(candidate.descriptionSha256);
    const assessment = reviewedAdmission.assessments.find(
      (a) => a.externalKey === candidate.externalKey,
    );
    expect(assessment).toMatchObject({
      status: candidate.assessmentStatus,
      reviewedBy: 'Sol (AI curator) for the owner',
      reviewedOn: '2026-10-07',
      requiredNotices: candidate.requiredNotices,
    });
    expect(assessment?.evidenceFingerprints).toHaveProperty(
      candidate.evidenceId,
    );
    const evidence = reviewedAdmission.evidence[candidate.evidenceId]?.content;
    expect(evidence).toContain(candidate.source.sha256);
    expect(evidence).toContain(candidate.source.location);
    expect(candidate.mechanicsReview.ruleIdentity).toBe(candidate.externalKey);
    expect(candidate.mechanicsReview.descriptionReviewed).toBe(true);
    expect(candidate.mechanicsReview.requiredRecords).toBe(0);
    expect(candidate.mechanicsReview.outstandingMechanics.join(' ')).toContain(
      'repeatable',
    );
    expect(entry(candidate.name).detail.repeatable).toBe('unreviewed');
    if (candidate.disposition === 'held') {
      expect(candidate.holdIds).toHaveLength(1);
      expect(candidate.missingEvidence).not.toBe('');
      expect(candidate.noticeRequirementsComplete).toBe(false);
    } else {
      expect(candidate.requiredNotices).toEqual(['PZO1110']);
      expect(evidence).toContain(candidate.comparison?.comparisonLineSha256);
      expect(candidate.comparison?.completeDirectComparison).toBe(true);
    }
  }
});

it('reproduces all numeric and readable note output with 13 checked descriptions and zero required mechanics', async () => {
  const artifact = await importCatalog(inputs);
  const facts = (row: {
    externalKey: string;
    modifiers: unknown;
    sources?: unknown;
    situationalNotes?: unknown;
  }) => ({
    externalKey: row.externalKey,
    modifiers: row.modifiers,
    sources: row.sources,
    situationalNotes: row.situationalNotes,
  });
  expect(artifact.catalog.entries).toHaveLength(13);
  expect(artifact.catalog.entries.map(facts)).toEqual(
    preview.entries.map(facts),
  );
  expect(artifact.curation.summary).toMatchObject({
    required: 0,
    checked: 0,
    drafted: 0,
    missing: 0,
    descriptions: { candidates: 13, checked: 13, drafted: 0 },
  });
  expect(artifact.curation.passed).toBe(true);
  expect(artifact.curation.stale).toEqual([]);
  expect(artifact.curation.unresolvedMechanics).toEqual([]);
  const descriptions = curation.records.filter((r) =>
    provenance.candidates.some((c) => c.externalKey === r.externalKey),
  );
  expect(descriptions).toHaveLength(13);
  expect(descriptions.every((r) => r.status === 'checked')).toBe(true);
  expect(
    artifact.catalog.entries.every(
      (e) => (e.situationalNotes?.length ?? 0) > 0,
    ),
  ).toBe(true);
});

it('applies explicit Lunge description review outside the scanner predicate and invalidates changed source text', async () => {
  const unrevised = await draftCatalogCuration({
    ...inputs,
    curation: { records: [] },
    descriptions: true,
  });
  expect(unrevised.added).toHaveLength(6);
  expect(
    unrevised.added.some((r) => r.externalKey === entry('Lunge').externalKey),
  ).toBe(false);
  const scratchRoot = resolve('.scratch/curation-333');
  await mkdir(scratchRoot, { recursive: true });
  const root = await mkdtemp(join(scratchRoot, 'changed-lunge-'));
  try {
    await cp(resolve('tests/fixtures/feats-333/pf1'), join(root, 'pf1'), {
      recursive: true,
    });
    await cp(
      resolve('tests/fixtures/feats-333/pf1-content'),
      join(root, 'pf1-content'),
      { recursive: true },
    );
    const paths = {
      ...inputs,
      systemPath: join(root, 'pf1'),
      contentPath: join(root, 'pf1-content'),
    };
    const before = await importCatalog(paths);
    expect(
      before.catalog.entries.find((r) => r.name === 'Lunge')?.modifiers,
    ).toEqual(entry('Lunge').modifiers);
    const source = provenance.candidates.find(
      (c) => c.externalKey === entry('Lunge').externalKey,
    );
    if (!source) throw new Error('Missing Lunge source');
    const filename = join(paths.systemPath, source.source.path);
    const raw = upstreamRecord.parse(parse(await readFile(filename, 'utf8')));
    raw.system.description = {
      ...z.record(z.string(), z.unknown()).parse(raw.system.description),
      value: sourceDescription(raw).replace('-2 penalty', '-3 penalty'),
    };
    await writeFile(filename, stringify(raw));
    const changed = await importCatalog(paths);
    expect(
      changed.catalog.entries.find((r) => r.name === 'Lunge')?.modifiers,
    ).toEqual([]);
    expect(changed.curation.stale).toContainEqual(
      expect.objectContaining({
        externalKey: entry('Lunge').externalKey,
        kind: 'description',
      }),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('keeps admitted Lunge bindings current and reopens attribution on a changed Modifier', async () => {
  const artifact = await importCatalog(inputs);
  const lunge = artifact.catalog.entries.find((r) => r.name === 'Lunge');
  const assessment = reviewedAdmission.assessments.find(
    (a) => a.externalKey === lunge?.externalKey,
  );
  if (!lunge || !assessment) throw new Error('Missing Lunge attribution');
  expect(assessment).toMatchObject(
    buildAssessmentBinding({
      entry: lunge,
      artifact,
      ...reviewedAdmission,
      requiredNotices: assessment.requiredNotices,
      evidenceIds: Object.keys(assessment.evidenceFingerprints),
    }),
  );
  expect(
    assessCatalogAdmission({ artifact, ...reviewedAdmission }).admitted,
  ).toContainEqual(expect.objectContaining({ externalKey: lunge.externalKey }));
  const changed = {
    ...artifact,
    catalog: {
      ...artifact.catalog,
      entries: artifact.catalog.entries.map((r) =>
        r.externalKey === lunge.externalKey
          ? {
              ...r,
              modifiers: [
                {
                  target: 'ac' as const,
                  bonusType: 'untyped' as const,
                  value: -3,
                  condition: { option: true as const },
                },
              ],
            }
          : r,
      ),
    },
  };
  const gate = assessCatalogAdmission({
    artifact: changed,
    ...reviewedAdmission,
  });
  expect(gate.admitted).not.toContainEqual(
    expect.objectContaining({ externalKey: lunge.externalKey }),
  );
  expect(gate.held).toContainEqual(
    expect.objectContaining({ externalKey: lunge.externalKey }),
  );
});

it('keeps Lunge AC unchanged ordinarily and applies exactly −2 in its Routine Option Situation in both projections', () => {
  const input = featFixtureSheet();
  const ordinary = calculateCharacterSheetProjections(input);
  const selected = calculateCharacterSheetProjections(input, {
    situations: [{ option: 'feat' }],
  });
  for (const projection of [ordinary.current, ordinary.permanent]) {
    expect(projection.derivedStatistics.ac.total).toBe(12);
    expect(projection.derivedStatistics.ac.conditional).toContainEqual(
      expect.objectContaining({ source: 'pf1/xq2TFr7bsYBBHOi5', value: -2 }),
    );
  }
  for (const projection of [selected.current, selected.permanent]) {
    expect(projection.derivedStatistics.ac.total).toBe(10);
    expect(
      projection.derivedStatistics.ac.applied.filter(
        (r) => r.source === 'pf1/xq2TFr7bsYBBHOi5',
      ),
    ).toHaveLength(1);
    expect(projection.derivedStatistics.touchAc.total).toBe(10);
    expect(projection.derivedStatistics.flatFootedAc.total).toBe(8);
    expect(projection.derivedStatistics.cmb.total).toBe(0);
  }
  const copied = {
    ...input,
    entries: [
      ...input.entries,
      {
        _id: 'copy-row',
        kind: 'feat' as const,
        active: true,
        catalogEntryId: 'copy',
        state: { kind: 'feat' as const },
      },
    ],
    catalogEntries: [
      ...input.catalogEntries,
      { ...input.catalogEntries[1]!, _id: 'copy' },
    ],
  };
  const result = calculateCharacterSheetProjections(copied, {
    situations: [{ option: 'feat' }, { option: 'copy' }],
  });
  expect(result.current.derivedStatistics.ac.total).toBe(10);
  const inactive = calculateCharacterSheetProjections(
    {
      ...input,
      entries: input.entries.map((row) =>
        row.kind === 'feat' ? { ...row, active: false } : row,
      ),
    },
    { situations: [{ option: 'feat' }] },
  );
  expect(inactive.current.derivedStatistics.ac.total).toBe(12);
});

it('applies Paired Opportunists +4 circumstance only in its exact entry-scoped attack-of-opportunity Situation', () => {
  const rows = modifiers('Paired Opportunists');
  const situation = rows[0]?.condition?.situation;
  if (typeof situation !== 'object' || !('local' in situation))
    throw new Error('Missing precise local circumstance');
  expect(situation.local).toContain('both you and an adjacent ally');
  expect(resolveSheet(rows)['attack.melee'].total).toBe(0);
  expect(resolveSheet(rows)['attack.ranged'].total).toBe(0);
  const options = {
    situations: [
      { ...situation, sheetEntryId: entry('Paired Opportunists').externalKey },
    ],
  };
  const selected = resolveSheet(rows, options);
  expect(selected['attack.melee'].total).toBe(4);
  expect(selected['attack.ranged'].total).toBe(4);
  expect(selected['damage.melee'].total).toBe(0);
  expect(
    resolveSheet(rows, {
      situations: [{ ...situation, sheetEntryId: 'other' }],
    })['attack.melee'].total,
  ).toBe(0);
  expect(
    resolveSheet(
      [
        ...rows,
        ...rows.map((r) => ({
          ...r,
          sheetEntryId: 'copy',
          catalogEntryId: 'copy',
        })),
      ],
      {
        situations: [
          ...options.situations,
          { ...situation, sheetEntryId: 'copy' },
        ],
      },
    )['attack.melee'].total,
  ).toBe(4);
});

it('retains real prerequisites, the unimported simple proficiency and explicitly prose-only rules without substitute bonuses', () => {
  expect(
    importedCatalogEntrySchema.parse(entry('Lunge')).prerequisites,
  ).toEqual([{ bab: 6, kind: 'bab' }]);
  expect(
    importedCatalogEntrySchema.parse(entry('Shield Master')).prerequisites,
  ).toContainEqual({
    proficiency: { category: 'shield' },
    kind: 'proficiency',
  });
  expect(
    importedCatalogEntrySchema.parse(entry('Spellbreaker')).prerequisites,
  ).toContainEqual({
    classLevel: 'pf1/WLqBCT5DqmGAx8Wd',
    min: 10,
    kind: 'classLevel',
  });
  expect(
    importedCatalogEntrySchema.parse(entry('Improvised Weapon Mastery'))
      .prerequisites,
  ).toContainEqual({
    anyOf: [
      { feat: 'pf1/bZ1YdzkT8NtRIEJ4', kind: 'feat' },
      { feat: 'pf1/gGfXQq0IZrxdcZDx', kind: 'feat' },
    ],
  });
  const simple = review.candidates.find(
    (c) => c.name === 'Simple Weapon Proficiency',
  );
  expect(simple?.mechanicsReview.sourceFacts.proficiencies.weaponProf).toEqual([
    'simple',
  ]);
  expect(entry('Simple Weapon Proficiency')).not.toHaveProperty(
    'proficiencies',
  );
  for (const name of [
    'Signature Skill',
    'Signature Skill (Perception)',
    'Signature Skill (Craft)',
    'Pinpoint Targeting',
    'Improvised Weapon Mastery',
  ]) {
    expect(modifiers(name)).toEqual([]);
    expect(
      review.candidates.find((c) => c.name === name)?.mechanicsReview
        .explicitlyProseOnly.length,
    ).toBeGreaterThan(0);
  }
  const greater = review.candidates.find(
    (c) => c.name === 'Greater Vital Strike',
  );
  expect(greater?.linkedContentReview.map((r) => r.name)).toEqual([
    'Vital Strike',
    'Improved Vital Strike',
  ]);
  expect(greater?.linkedContentReview.every((r) => r.completeComparison)).toBe(
    true,
  );
  expect(
    reviewedAdmission.assessments.find(
      (a) => a.externalKey === 'pf1/DorPGQ2mifJbMKH8',
    )?.status,
  ).toBe('unresolved');
});
