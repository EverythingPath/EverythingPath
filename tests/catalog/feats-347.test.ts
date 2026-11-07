// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
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
import {
  review,
  preview,
  provenance,
  originals,
} from '../fixtures/feats-347/data';
import { findCommittedBatchOwnershipProblems } from './batch-ownership';
import { reviewedFeatSheet } from '../fixtures/feats-347/sheet';

const fixtureRoot = resolve('tests/fixtures/feats-347');
const inputs = {
  systemPath: join(fixtureRoot, 'pf1'),
  contentPath: join(fixtureRoot, 'pf1-content'),
  remaps: [],
  curation: reviewedCuration,
  candidateKeys: provenance.candidates.map((row) => row.externalKey),
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
    throw new Error('Missing exact local Situation');
  return { ...scope, sheetEntryId: entry(name).externalKey };
}

it('reconciles the exact 100-key inventory with byte-exact full descriptions and reviewed facts', async () => {
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
      sources: entry(c.name).sources,
      prerequisites: entry(c.name).prerequisites ?? [],
      proficiencies: [],
    });
    expect(c.mechanicsReview.curationRecords).toEqual(
      reviewedCuration.records.filter(
        (row) => row.externalKey === c.externalKey,
      ),
    );
    expect(c.mechanicsReview.outstandingCalculations).not.toEqual([]);
    const admitted = c.disposition === 'admitted';
    expect(c.holdIds).toEqual(
      admitted ? [] : [`feats-347-whole-content-${raw._id}`],
    );
    expect(c.noticeRequirementsComplete).toBe(admitted);
    expect(
      reviewedAdmission.assessments.find(
        (row) => row.externalKey === c.externalKey,
      ),
    ).toMatchObject({
      status: admitted ? 'confirmed' : 'unresolved',
      requiredNotices: c.requiredNotices,
      reviewedBy: 'Sol (AI curator) for the owner',
      reviewedOn: '2026-10-09',
    });
  }
});

it('reproduces reviewed outputs and binds admission to whole imported bodies', async () => {
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
  // The bounded fixture has no unrelated lookup records. Freeze the complete-source
  // prerequisite identities; fixture-only absence is not an attribution decision.
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
    const context = {
      entry: row,
      artifact: bound,
      ...reviewedAdmission,
      evidence: { [c.evidenceId]: reviewedAdmission.evidence[c.evidenceId]! },
      requiredNotices: c.requiredNotices,
      evidenceIds: [c.evidenceId],
    };
    const binding = buildAssessmentBinding(context);
    expect(
      reviewedAdmission.assessments.find(
        (c) => c.externalKey === row.externalKey,
      ),
    ).toMatchObject(binding);
    expect(
      buildAssessmentBinding({
        ...context,
        entry: { ...row, description: row.description + ' changed' },
      }).contentFingerprint,
    ).not.toBe(binding.contentFingerprint);
  }
});

it('enforces the inherited notice minima and verifies all permitted comparison bytes', async () => {
  for (const c of review.candidates) {
    for (const dep of c.inheritedRuleNotices)
      expect(c.requiredNotices, c.name).toContain(dep.book);
    if (c.mechanicsReview.descriptionText.includes('Combat Trick'))
      expect(c.requiredNotices).toContain('PZO1131');
    if (c.name.includes('Mythic'))
      expect(c.requiredNotices).toContain('PZO1126');
    if (c.mechanicsReview.descriptionText.includes('Completion Benefit'))
      expect(c.requiredNotices).toContain('PZO1125');
    for (const support of [
      ...c.inheritedRuleSourceEvidence,
      ...c.inheritedRuleComparisonEvidence,
    ])
      expect(
        sha256(await readFile(join(fixtureRoot, support.fixturePath), 'utf8')),
      ).toBe(support.sha256);
  }
  expect(
    review.candidates.find((c) => c.name === 'Scurrying Swarmer')
      ?.inheritedRuleSourceEvidence[0]?.description,
  ).toContain('Race</strong>: Ratfolk');
  for (const n of review.noticeRequirements) {
    if (!n.holdId) continue;
    expect(heldNotices.find((h) => h.id === n.holdId)).toMatchObject({
      notices: expect.arrayContaining([n.book, ...n.registryKeys]),
      evidence: ['scripts/catalog/legal/feats-347.json'],
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
  expect(required('Repast of Heroes')).toEqual(
    expect.arrayContaining([
      'PZO1110',
      'PZO1140',
      'PZO9280',
      'PZO1133',
      'PZO9251',
    ]),
  );
  expect(required('Scurrying Swarmer')).toEqual(
    expect.arrayContaining(['PZO1121', 'PZO9280', 'PZO1120']),
  );
  expect(required('Channel Spirit')).toContain('PZO1132');
  expect(required('Divine Fighting Technique')).toEqual(
    expect.arrayContaining([
      'PZO1110',
      'PZO1115',
      'PZO1118',
      'PZO1129',
      'PZO9463',
      'PZO9472',
    ]),
  );
  expect(required('Expanded Metakinesis')).toEqual(
    expect.arrayContaining(['PZO1115', 'PZO1117', 'PZO1132']),
  );
});

it('keeps its own description records, assessments, evidence and holds as recorded', () => {
  expect(
    findCommittedBatchOwnershipProblems('scripts/catalog/legal/feats-347.json'),
  ).toEqual([]);
});
it('keeps its whole-history preservation manifest on disk until the #744 cleanup', () => {
  // #749 retired this manifest's checks; the file itself stays as recorded.
  expect(originals.assessments).toHaveLength(2933);
});

it('uses the shared mind-affecting Situation and keeps grapple-escape checks narrow', () => {
  const rows = modifiers('Free Spirit');
  expect(resolveSheet(rows)['save.will'].total).toBe(0);
  const affected = resolveSheet(rows, { situations: ['mindAffecting'] });
  expect([
    affected['save.fort'].total,
    affected['save.ref'].total,
    affected['save.will'].total,
  ]).toEqual([2, 2, 2]);
  expect(
    resolveSheet(rows, { situations: ['enchantment'] })['save.will'].total,
  ).toBe(0);
  expect(resolveSheet(rows, { situations: ['grapple'] }).cmb.total).toBe(0);
  const escape = situation('Free Spirit', 3);
  const escaped = resolveSheet(rows, { situations: [escape] });
  expect([escaped.cmb.total, escaped['skill.esc'].total]).toEqual([2, 2]);
  expect(
    resolveSheet(rows, { situations: [{ ...escape, sheetEntryId: 'foreign' }] })
      .cmb.total,
  ).toBe(0);
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
      { situations: ['mindAffecting'] },
    )['save.will'].total,
  ).toBe(2);
});

it('resolves selected Story completion targets without combining doubled and ordinary branches', () => {
  const rows = modifiers('Enemy Cult');
  expect(resolveSheet(rows)['save.will'].total).toBe(0);
  const evil = resolveSheet(rows, {
    situations: [situation('Enemy Cult'), situation('Enemy Cult', 3)],
  });
  expect([evil['save.will'].total, evil['ac.other'].total]).toEqual([2, 2]);
  const summoned = resolveSheet(rows, {
    situations: [situation('Enemy Cult', 4), situation('Enemy Cult', 7)],
  });
  expect([summoned['save.will'].total, summoned['ac.other'].total]).toEqual([
    4, 4,
  ]);
  expect(
    resolveSheet(rows, { situations: ['evilCreatures'] })['save.will'].total,
  ).toBe(0);
  expect(
    calculateCharacterSheetProjections(reviewedFeatSheet('Enemy Cult')).current
      .breakdowns['save.will'].total,
  ).toBe(0);
});

it('adds Shield Wall to an existing shield bonus and scopes Style and Dervish maneuvers', () => {
  const wall = modifiers('Shield Wall');
  const base = {
    ...wall[0]!,
    bonusType: 'shield' as const,
    value: 5,
    condition: undefined,
    sheetEntryId: 'shield',
    catalogEntryId: 'shield',
    source: 'shield',
  };
  expect(resolveSheet([base, ...wall])['ac.shield'].total).toBe(5);
  expect(
    resolveSheet([base, ...wall], { situations: [situation('Shield Wall')] })[
      'ac.shield'
    ].total,
  ).toBe(6);
  expect(
    resolveSheet([base, ...wall], {
      situations: [situation('Shield Wall', 1)],
    })['ac.shield'].total,
  ).toBe(7);
  expect(
    resolveSheet([base, ...wall], {
      situations: [situation('Shield Wall'), situation('Shield Wall', 1)],
    })['ac.shield'].total,
  ).toBe(7);
  const tiger = modifiers('Tiger Style');
  expect(
    resolveSheet(tiger, { situations: ['bullRush', 'overrun', 'trip'] }).cmd
      .total,
  ).toBe(0);
  expect(
    resolveSheet(tiger, { situations: [situation('Tiger Style')] }).cmd.total,
  ).toBe(2);
  const dervish = modifiers('Dimensional Maneuvers');
  expect(resolveSheet(dervish, { situations: ['reposition'] }).cmb.total).toBe(
    0,
  );
  expect(
    resolveSheet(dervish, {
      situations: [situation('Dimensional Maneuvers', 2)],
    }).cmb.total,
  ).toBe(4);
});

it('retains the exact chosen penalties and keeps recipient/replacement rules out of ordinary totals', () => {
  const daze = resolveSheet(modifiers('Dazing Assault'), {
    situations: [situation('Dazing Assault')],
  });
  expect([
    daze['attack.melee'].total,
    daze.cmb.total,
    daze['attack.ranged'].total,
  ]).toEqual([-5, -5, 0]);
  expect(
    resolveSheet(modifiers('Sincere Flattery'), {
      situations: [situation('Sincere Flattery')],
    })['skill.crf'].total,
  ).toBe(4);
  expect(
    resolveSheet(modifiers('Sincere Flattery'), {
      situations: [situation('Sincere Flattery', 1)],
    })['skill.crf'].total,
  ).toBe(8);
  for (const name of [
    'Lead by Example',
    'Broken Wing Gambit',
    'Kobold Sniper',
    'Diva Strike',
    'Hefty Brute',
    'Pinch Time',
    'Painful Cures',
    'Divine Fighting Technique',
    'Channel Spirit',
    'Longshanks',
    'Dispel Focus',
    'Group Deliver Touch Spells',
  ])
    expect(entry(name).modifiers, name).toEqual([]);
  expect(entry('Group Deliver Touch Spells').description).toContain(
    'share spells ability',
  );
  expect(entry('Divine Fighting Technique').description).toContain(
    'Zon-Kuthon',
  );
});

it('reconstructs the fixture from reviewable files with portable temporary storage', async () => {
  const { mkdtemp, mkdir, copyFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const isolated = await mkdtemp(join(tmpdir(), 'feats-347-tracked-only-'));
  try {
    for (const file of [
      'pf1/public/system.json',
      'pf1/packs/.gitkeep',
      'pf1-content/module.json',
      ...review.candidates.map((row) => `pf1-content/${row.source.path}`),
    ]) {
      await mkdir(dirname(join(isolated, file)), { recursive: true });
      await copyFile(join(fixtureRoot, file), join(isolated, file));
    }
    const artifact = await importCatalog({
      ...inputs,
      systemPath: join(isolated, 'pf1'),
      contentPath: join(isolated, 'pf1-content'),
    });
    expect(artifact.catalog.entries.map((row) => row.externalKey)).toEqual(
      provenance.candidates.map((row) => row.externalKey),
    );
    expect(artifact.curation.summary.descriptions.checked).toBe(100);
    expect(artifact.curation.passed).toBe(true);
  } finally {
    await rm(isolated, { recursive: true, force: true });
  }
});
