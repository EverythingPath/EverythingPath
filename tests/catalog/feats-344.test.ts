// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { importCatalog } from '../../scripts/catalog/import';
import {
  assessCatalogAdmission,
  buildAssessmentBinding,
} from '../../scripts/catalog/admission';
import {
  sourceDescription,
  upstreamRecord,
} from '../../scripts/catalog/records';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import { outputSchema } from '../../src/lib/catalog/curation-output-schema';
import {
  modifierTargets,
  resolveSheet,
  calculateCharacterSheetProjections,
} from '../../src/lib/character-sheet';
import { review, preview, provenance } from '../fixtures/feats-344/data';
import { reviewedFeatSheet } from '../fixtures/feats-344/sheet';

const fixtureRoot = resolve('tests/fixtures/feats-344');
const inputs = {
  systemPath: join(fixtureRoot, 'pf1'),
  contentPath: join(fixtureRoot, 'pf1-content'),
  remaps: [],
  curation: reviewedCuration,
};
const sha256 = (text: string) =>
  createHash('sha256').update(text).digest('hex');
function entry(name: string) {
  const row = preview.entries.find((row) => row.name === name);
  if (!row) throw new Error(`Missing ${name}`);
  return row;
}
function modifiers(name: string) {
  const row = entry(name);
  return row.modifiers.map((raw) => ({
    ...outputSchema.options[0]
      .omit({ kind: true })
      .extend({ target: z.enum(modifierTargets) })
      .parse(raw),
    sheetEntryId: row.externalKey,
    catalogEntryId: row.externalKey,
    source: row.externalKey,
    entryName: row.name,
    builtIn: false,
  }));
}
function situation(name: string, index = 0) {
  const scope = modifiers(name)[index]?.condition?.situation;
  if (typeof scope !== 'object' || !('local' in scope))
    throw new Error('Missing local Situation');
  return { ...scope, sheetEntryId: entry(name).externalKey };
}

it('accounts for 100 exact ticket keys, byte-exact sources and reviewed facts', async () => {
  const keys = provenance.candidates.map((row) => row.externalKey);
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(sha256(keys.join('\n'))).toBe(provenance.candidateKeysSha256);
  expect(review.candidates.map((row) => row.externalKey)).toEqual(keys);
  expect(preview.entries.map((row) => row.externalKey)).toEqual(keys);
  expect(review.counts).toEqual({
    total: 100,
    admitted: 0,
    held: 100,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 0,
    recordLevel35Holds: 0,
  });
  for (const c of review.candidates) {
    const bytes = await readFile(
      join(inputs.contentPath, c.source.path),
      'utf8',
    );
    const raw = upstreamRecord.parse(parse(bytes));
    expect(sha256(bytes), c.name).toBe(c.source.sha256);
    expect(`pf1-content/${raw._id}`).toBe(c.externalKey);
    expect(sourceDescription(raw)).toBe(c.mechanicsReview.descriptionText);
    expect(sha256(sourceDescription(raw))).toBe(c.descriptionSha256);
    expect(c.mechanicsReview.mappedFacts).toMatchObject({
      modifiers: entry(c.name).modifiers,
      sources: [],
      prerequisites: entry(c.name).prerequisites ?? [],
      proficiencies: [],
    });
    expect(c.mechanicsReview.curationRecords).toEqual(
      reviewedCuration.records.filter(
        (row) => row.externalKey === c.externalKey,
      ),
    );
    expect(c.mechanicsReview.outstandingCalculations).not.toEqual([]);
    expect(c.holdIds).toEqual([`feats-344-whole-content-${raw._id}`]);
    expect(c.noticeRequirementsComplete).toBe(false);
    expect(
      reviewedAdmission.assessments.find(
        (row) => row.externalKey === c.externalKey,
      ),
    ).toMatchObject({
      status: 'unresolved',
      requiredNotices: c.requiredNotices,
      reviewedBy: 'Sol (AI curator) for the owner',
      reviewedOn: '2026-10-09',
    });
  }
});

it('reproduces reviewed mechanics and holds every content-bound candidate without admission failures', async () => {
  const artifact = await importCatalog(inputs);
  expect(artifact.curation.passed).toBe(true);
  expect(artifact.curation.summary.required).toBe(0);
  expect(artifact.curation.summary.descriptions.checked).toBe(100);
  expect(artifact.curation.unresolvedMechanics).toEqual([]);
  expect(artifact.curation.unresolvedDescriptions).toHaveLength(100);
  for (const row of artifact.catalog.entries) {
    expect(row.modifiers).toEqual(entry(row.name).modifiers);
    expect(row.situationalNotes).toEqual(entry(row.name).situationalNotes);
  }
  // Full-source bodies keep actual out-of-batch prerequisite identities. Reduced
  // extraction alone is no publication or attribution certificate.
  const bound = {
    ...artifact,
    catalog: {
      ...artifact.catalog,
      entries: preview.entries.map((raw) => {
        const row = importedCatalogEntrySchema.parse(raw);
        if (row.detail.kind !== 'feat') throw new Error('Expected feat');
        return { ...row, detail: row.detail };
      }),
    },
  };
  const gate = assessCatalogAdmission({
    artifact: bound,
    ...reviewedAdmission,
  });
  expect(gate.failures).toEqual([]);
  expect(gate.admitted).toEqual([]);
  expect(gate.held).toHaveLength(100);
  expect(gate.dependentOmissions).toEqual([]);
  for (const row of bound.catalog.entries) {
    const c = review.candidates.find((c) => c.externalKey === row.externalKey);
    if (!c) throw new Error('Missing review');
    const binding = buildAssessmentBinding({
      entry: row,
      artifact: bound,
      ...reviewedAdmission,
      requiredNotices: c.requiredNotices,
      evidenceIds: [c.evidenceId],
    });
    expect(
      reviewedAdmission.assessments.find(
        (c) => c.externalKey === row.externalKey,
      ),
    ).toMatchObject(binding);
    expect(
      buildAssessmentBinding({
        entry: { ...row, description: row.description + ' changed' },
        artifact: bound,
        ...reviewedAdmission,
        requiredNotices: c.requiredNotices,
        evidenceIds: [c.evidenceId],
      }).contentFingerprint,
    ).not.toBe(binding.contentFingerprint);
  }
});

it('enforces inherited rule minima and verifies all comparison/supporting evidence bytes', async () => {
  for (const c of review.candidates) {
    for (const dep of c.inheritedRuleNotices)
      expect(c.requiredNotices, c.name).toContain(dep.book);
    if (c.mechanicsReview.descriptionText.includes('Combat Trick'))
      expect(c.requiredNotices).toContain('PZO1131');
    if (c.name.includes('Mythic'))
      expect(c.requiredNotices).toContain('PZO1126');
    if (c.mechanicsReview.descriptionText.includes('Completion Benefit'))
      expect(c.requiredNotices).toContain('PZO1125');
    for (const support of c.inheritedRuleSourceEvidence)
      expect(
        sha256(await readFile(join(fixtureRoot, support.fixturePath), 'utf8')),
      ).toBe(support.sha256);
  }
  for (const n of review.noticeRequirements) {
    if (!n.holdId) continue;
    expect(heldNotices.find((h) => h.id === n.holdId)).toMatchObject({
      notices: expect.arrayContaining([n.book, ...n.registryKeys]),
      evidence: ['scripts/catalog/legal/feats-344.json'],
    });
  }
  for (const source of review.comparisonSources.pcgenFiles)
    expect(
      sha256(
        await readFile(
          join(fixtureRoot, 'comparison-sources', source.path),
          'utf8',
        ),
      ),
    ).toBe(source.sha256);
  const required = (name: string) =>
    review.candidates.find((c) => c.name === name)?.requiredNotices;
  expect(required('Djinni Spirit')).toEqual(
    expect.arrayContaining(['PZO1115', 'PZO1118', 'PZO1131']),
  );
  expect(required('Phantom Fighter')).toEqual(
    expect.arrayContaining(['PZO1132', 'PZO1115', 'PZO1110']),
  );
  expect(required('Evolved Companion')).toContain('PZO1115');
  expect(required('Rallying Blow')).toContain('PZO1112');
  expect(required('Bred Commander')).toContain('PZO1125');
  expect(required('Last Rites')).toEqual(
    expect.arrayContaining(['PZO1114', 'PZO1121']),
  );
  expect(required('Rapid Recovery')).toContain('PZO9449');
});

it('calculates exact scoped AC, disguise and attack values without same-Source duplication', () => {
  const name = 'Defended Movement',
    rows = modifiers(name),
    low = situation(name),
    high = situation(name, 1);
  expect(resolveSheet(rows)['ac.other'].total).toBe(0);
  expect(resolveSheet(rows, { situations: [low] })['ac.other'].total).toBe(2);
  expect(
    resolveSheet(rows, { situations: [low, high] })['ac.other'].total,
  ).toBe(4);
  expect(
    resolveSheet(
      [
        ...rows,
        ...rows.map((row) => ({
          ...row,
          sheetEntryId: 'copy',
          catalogEntryId: 'copy',
        })),
      ],
      { situations: [high, { ...high, sheetEntryId: 'copy' }] },
    )['ac.other'].total,
  ).toBe(4);
  expect(
    resolveSheet(rows, { situations: [{ ...low, sheetEntryId: 'other' }] })[
      'ac.other'
    ].total,
  ).toBe(0);
  expect(
    resolveSheet(modifiers('Pass For Human'), {
      situations: [situation('Pass For Human')],
    })['skill.dis'].total,
  ).toBe(10);
  const thrown = resolveSheet(modifiers('Throw Anything (Mythic)'), {
    situations: [situation('Throw Anything (Mythic)')],
  });
  expect(thrown['attack.ranged'].total).toBe(2);
  expect(thrown['attack.melee'].total).toBe(0);
  const volley = calculateCharacterSheetProjections(
    reviewedFeatSheet('Opening Volley'),
  );
  expect(volley.current.breakdowns['attack.melee'].total).toBe(0);
  expect(volley.permanent.breakdowns['attack.melee'].total).toBe(0);
  expect(
    resolveSheet(modifiers('Opening Volley'), {
      situations: [situation('Opening Volley')],
    })['attack.melee'].total,
  ).toBe(4);
  expect(
    resolveSheet(modifiers('Volley Fire'), {
      situations: [situation('Volley Fire'), situation('Volley Fire', 3)],
    })['attack.ranged'].total,
  ).toBe(4);
});

it('keeps recipient effects, replacement penalties and unsupported grants off bearer totals', () => {
  for (const name of [
    'Intoxicating Flattery',
    'Robust Stench',
    'Lighting the Way',
    'Cranial Adjustment',
    'Grand Master Performer',
    'Bolster Jinx',
    'Motivating Display',
    'Marcher-Lord of the Cerulean Abyss',
    'Hamatula Grasp',
    'Rapid Grappler',
    'Sprightly Armor',
    'Evolved Companion',
    'Phantom Fighter',
    'Balor Whip',
  ])
    expect(entry(name).modifiers, name).toEqual([]);
  expect(
    resolveSheet(modifiers('Directed Disarm'), {
      situations: [
        situation('Directed Disarm'),
        situation('Directed Disarm', 1),
      ],
    })['attack.ranged'].total,
  ).toBe(-8);
  expect(
    resolveSheet(modifiers('Tail Weapon'), {
      situations: [situation('Tail Weapon')],
    })['skill.acr'].total,
  ).toBe(2);
  expect(resolveSheet(modifiers('Tail Weapon')).cmd.total).toBe(0);
  expect(
    review.candidates.find((row) => row.name === 'Improvisational Focus')
      ?.mechanicsReview.proficiencyReview.outstandingFacts,
  ).not.toEqual([]);
  expect(entry('Undead Master (Mythic)').situationalNotes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        text: expect.stringContaining('tripled rather than doubled'),
      }),
    ]),
  );
  for (const row of preview.entries) expect(row.sources).toEqual([]);
});
