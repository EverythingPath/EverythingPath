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
import {
  review,
  preview,
  provenance,
  originals,
} from '../fixtures/feats-345/data';
import { findCommittedBatchOwnershipProblems } from './batch-ownership';
import { reviewedFeatSheet } from '../fixtures/feats-345/sheet';
import { expectAutomaticSkillFocus } from './skill-focus-assertions';

const fixtureRoot = resolve('tests/fixtures/feats-345');
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
    admitted: 1,
    held: 99,
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
      admitted ? [] : [`feats-345-whole-content-${raw._id}`],
    );
    expect(c.noticeRequirementsComplete).toBe(admitted);
    expect(
      reviewedAdmission.assessments.find(
        (row) => row.externalKey === c.externalKey,
      ),
    ).toMatchObject({
      status: admitted ? 'confirmed' : 'unresolved',
      requiredNotices: c.requiredNotices,
      // #724 re-bound the admitted Skill Focus assessments.
      reviewedBy: c.name.startsWith('Skill Focus (')
        ? 'Opus (AI curator) for the owner'
        : 'Sol (AI curator) for the owner',
      reviewedOn: c.name.startsWith('Skill Focus (')
        ? '2026-10-14'
        : '2026-10-09',
    });
  }
});

it('reproduces mechanics and admits only the completely compared CRB feat', async () => {
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
  expect(gate.admitted.map((row) => row.externalKey)).toEqual([
    'pf1-content/LmV6WT0Dv5FZO4Qy',
  ]);
  expect(gate.held).toHaveLength(99);
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
    for (const support of [
      ...c.inheritedRuleSourceEvidence,
      ...c.inheritedRuleComparisonEvidence,
    ])
      expect(
        sha256(await readFile(join(fixtureRoot, support.fixturePath), 'utf8')),
      ).toBe(support.sha256);
  }
  for (const n of review.noticeRequirements) {
    if (!n.holdId) continue;
    expect(heldNotices.find((h) => h.id === n.holdId)).toMatchObject({
      notices: expect.arrayContaining([n.book, ...n.registryKeys]),
      evidence: ['scripts/catalog/legal/feats-345.json'],
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
  expect(required("Versatile Summon Nature's Ally")).toContain('PZO9458');
  expect(required('Child of Two Worlds')).toEqual(
    expect.arrayContaining(['PZO1134', 'PZO1125', 'PZO1112']),
  );
  expect(required('Marid Spirit')).toEqual(
    expect.arrayContaining(['PZO1115', 'PZO1118', 'PZO1131']),
  );
  expect(required('Djinni Spin')).toEqual(
    expect.arrayContaining(['PZO1115', 'PZO1118', 'PZO1131']),
  );
  expect(required('Masked Renown')).toContain('PZO1134');
  expect(required('Champion of Malevolence')).toContain('PZO1115');
  expect(required('Traumatic Spell-Like Ability')).toContain('PZO1110');
  expect(required('Wolf Savage')).toContain('PZO9439');
  expect(required('Arcane Insight')).toContain('PZO1115');
});

it('keeps its own description records, assessments, evidence and holds as recorded', () => {
  expect(
    findCommittedBatchOwnershipProblems('scripts/catalog/legal/feats-345.json'),
  ).toEqual([]);
});
it('keeps its whole-history preservation manifest on disk until the #744 cleanup', () => {
  // #749 retired this manifest's checks; the file itself stays as recorded.
  expect(originals.assessments).toHaveLength(2534);
});

it('compares all admitted clauses, invalidates changed content and preserves upstream Sources', () => {
  const admitted = review.candidates.filter(
    (row) => row.disposition === 'admitted',
  );
  expect(admitted.map((row) => row.name)).toEqual([
    'Skill Focus (Knowledge [Dungeoneering])',
  ]);
  expect(admitted[0]?.comparison?.completeDirectComparison).toBe(true);
  expect(admitted[0]?.requiredNotices).toEqual(['PZO1110']);
  expect(entry('Hamatulatsu').sources).toEqual([
    { book: 'PZO9226', pages: '287' },
    { book: 'PZO1111', pages: '83' },
  ]);
  expect(preview.entries.filter((row) => row.sources.length > 0)).toHaveLength(
    1,
  );
});

// #724: the rank threshold is automatic, read from the skill's recorded ranks.
it('gives Skill Focus (Knowledge [Dungeoneering]) +3, or +6 at 10 ranks, without a Situation or a stacking same-Source copy', () => {
  const data = modifiers('Skill Focus (Knowledge [Dungeoneering])');
  expectAutomaticSkillFocus({ modifiers: data, target: 'skill.kdu' });
  // No ranks: Skill Focus's +3.
  for (const projection of Object.values(
    calculateCharacterSheetProjections(
      reviewedFeatSheet('Skill Focus (Knowledge [Dungeoneering])'),
    ),
  ))
    expect(projection.breakdowns['skill.kdu'].total).toBe(3);
});

it('keeps shared grapple, fear and alignment Situations exact and non-stacking within one Source', () => {
  expect(resolveSheet(modifiers('Sinuous Vines')).cmb.total).toBe(0);
  expect(
    resolveSheet(modifiers('Sinuous Vines'), { situations: ['grapple'] }).cmb
      .total,
  ).toBe(2);
  expect(
    resolveSheet(modifiers('Sinuous Vines'), { situations: ['trip'] }).cmb
      .total,
  ).toBe(0);
  const steed = modifiers('Valiant Steed');
  const emotion = situation('Valiant Steed', 1);
  expect(resolveSheet(steed, { situations: ['fear'] })['save.will'].total).toBe(
    4,
  );
  expect(
    resolveSheet(steed, { situations: [emotion] })['save.will'].total,
  ).toBe(4);
  expect(
    resolveSheet(steed, { situations: ['fear', emotion] })['save.will'].total,
  ).toBe(4);
  expect(
    resolveSheet(steed, { situations: ['mindAffecting'] })['save.will'].total,
  ).toBe(0);
  expect(
    resolveSheet(modifiers('Champion of Malevolence'), {
      situations: ['goodCreatures'],
    })['damage.melee'].total,
  ).toBe(2);
  expect(
    resolveSheet(modifiers('Champion of Malevolence'), {
      situations: ['lawfulCreatures'],
    })['damage.melee'].total,
  ).toBe(0);
});

it('preserves distinct maneuver/target, replacement and recipient restrictions', () => {
  expect(
    resolveSheet(modifiers('Disorienting Maneuver'), {
      situations: [situation('Disorienting Maneuver')],
    })['attack.melee'].total,
  ).toBe(2);
  expect(
    resolveSheet(modifiers('Disorienting Maneuver'), {
      situations: [situation('Disorienting Maneuver', 1)],
    }).cmb.total,
  ).toBe(4);
  expect(
    resolveSheet(modifiers('Animal Disguise'), {
      situations: [situation('Animal Disguise')],
    })['skill.dis'].total,
  ).toBe(2);
  expect(
    resolveSheet(modifiers('Low Profile'), {
      situations: [situation('Low Profile')],
    })['ac.other'].total,
  ).toBe(1);
  expect(
    resolveSheet(modifiers('Ancestral Enmity'), {
      situations: [situation('Ancestral Enmity')],
    })['attack.melee'].total,
  ).toBe(2);
  expect(
    resolveSheet(modifiers('Ancestral Enmity'), {
      situations: [situation('Ancestral Enmity')],
    })['attack.ranged'].total,
  ).toBe(0);
  for (const name of [
    'Covering Defense',
    'Crashing Wave Buffet',
    'Master Performer',
    'Merciless Beating',
    'Combat Distraction',
    'Archon Diversion',
    'Long-Nose Form',
    'Punishing Step',
  ])
    expect(
      entry(name).modifiers.some(
        (row) =>
          row.target === 'cmd' ||
          row.target === 'ability.str' ||
          row.target === 'ac.other' ||
          row.value === -1 ||
          row.value === -2,
      ),
      name,
    ).toBe(false);
  expect(
    resolveSheet(modifiers('Wilding Senses'), {
      situations: [situation('Wilding Senses'), situation('Wilding Senses', 3)],
    })['skill.per'].total,
  ).toBe(8);
});
