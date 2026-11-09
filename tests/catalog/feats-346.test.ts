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
} from '../fixtures/feats-346/data';
import { findCommittedBatchOwnershipProblems } from './batch-ownership';
import { reviewedFeatSheet } from '../fixtures/feats-346/sheet';
import { expectAutomaticSkillFocus } from './skill-focus-assertions';

const fixtureRoot = resolve('tests/fixtures/feats-346');
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
      admitted ? [] : [`feats-346-whole-content-${raw._id}`],
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
  expect(gate.admitted.map((row) => row.externalKey)).toEqual([
    'pf1-content/MMZxRlkELezwGDlL',
  ]);
  expect(gate.held).toHaveLength(99);
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
  for (const n of review.noticeRequirements) {
    if (!n.holdId) continue;
    expect(heldNotices.find((h) => h.id === n.holdId)).toMatchObject({
      notices: expect.arrayContaining([n.book, ...n.registryKeys]),
      evidence: ['scripts/catalog/legal/feats-346.json'],
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
  expect(required('Summon Plant Ally')).toEqual(
    expect.arrayContaining(['PZO1112', 'PZO1116', 'PZO1120', 'PZO1127']),
  );
  expect(required('Expansive Trap Ability')).toEqual(
    expect.arrayContaining(['PZO1117', 'PZO9430']),
  );
  expect(required('Traditional Weapons')).toContain('PZO9272');
  expect(required('Legendary Influence')).toContain('PZO1132');
  expect(required('War Blessing')).toContain('PZO1129');
  expect(required('Wilding')).toEqual(
    expect.arrayContaining(['PZO1110', 'PZO1115', 'PZO1129']),
  );
});

it('keeps its own description records, assessments, evidence and holds as recorded', () => {
  expect(
    findCommittedBatchOwnershipProblems('scripts/catalog/legal/feats-346.json'),
  ).toEqual([]);
});
it('keeps its whole-history preservation manifest on disk until the #744 cleanup', () => {
  // #749 retired this manifest's checks; the file itself stays as recorded.
  expect(originals.assessments).toHaveLength(2733);
});

it('admits the complete Heal comparison while recording its discarded unsupported source formula', () => {
  expect(
    review.candidates
      .filter((row) => row.disposition === 'admitted')
      .map((row) => row.name),
  ).toEqual(['Skill Focus (Heal)']);
  const admitted = review.candidates.find(
    (row) => row.disposition === 'admitted',
  );
  expect(admitted?.comparison?.completeDirectComparison).toBe(true);
  expect(admitted?.requiredNotices).toEqual(['PZO1110']);
  expect(preview.entries.every((row) => row.sources.length === 0)).toBe(true);
  expect(admitted?.mechanicsReview.rawMechanics.changes[0]?.formula).toBe(
    'ifelse(gte(@skills.hea.rank,10),6,3)',
  );
  // #724: one automatic rank Modifier replaces the two rank Situations.
  expect(entry('Skill Focus (Heal)').modifiers.map((row) => row.value)).toEqual(
    [{ formula: '3 + 3 * min(1, floor(@skillRanks.hea / 10))' }],
  );
});

// #724: the rank threshold is automatic, read from the skill's recorded ranks.
it('gives Skill Focus (Heal) +3, or +6 at 10 ranks, without a Situation or a stacking same-Source copy', () => {
  const data = modifiers('Skill Focus (Heal)');
  expectAutomaticSkillFocus({ modifiers: data, target: 'skill.hea' });
  // No ranks: Skill Focus's +3.
  for (const projection of Object.values(
    calculateCharacterSheetProjections(reviewedFeatSheet('Skill Focus (Heal)')),
  ))
    expect(projection.breakdowns['skill.hea'].total).toBe(3);
});

it('resolves exact lunar saves, different maneuver scopes and armor-versus-shield changes', () => {
  const moon = modifiers('Moontouched');
  expect(resolveSheet(moon)['save.fort'].total).toBe(0);
  const lit = resolveSheet(moon, { situations: [situation('Moontouched')] });
  expect([
    lit['save.fort'].total,
    lit['save.ref'].total,
    lit['save.will'].total,
  ]).toEqual([2, 2, -2]);
  const blow = modifiers('Improved Awesome Blow');
  expect(
    resolveSheet(blow, { situations: [situation('Improved Awesome Blow')] }).cmb
      .total,
  ).toBe(2);
  expect(resolveSheet(blow, { situations: ['bullRush'] }).cmb.total).toBe(0);
  const stance = resolveSheet(modifiers("Kraggodan's Stance"), {
    situations: [situation("Kraggodan's Stance")],
  });
  expect(stance['ac.armor'].total).toBe(1);
  expect(stance['ac.shield'].total).toBe(1);
  for (const { score, bonus } of [
    { score: 18, bonus: 4 },
    { score: 8, bonus: 0 },
  ]) {
    const sheet = reviewedFeatSheet('Osyluth Guile');
    const charisma = sheet.catalogEntries[0]?.modifiers.find(
      (row) => row.target === 'ability.cha',
    );
    if (!charisma) throw new Error('Missing base Charisma');
    charisma.value = score;
    const selected = {
      ...situation('Osyluth Guile'),
      sheetEntryId: 'feat-row',
    };
    expect(
      calculateCharacterSheetProjections(sheet).current.breakdowns['ac.other']
        .total,
    ).toBe(0);
    expect(
      calculateCharacterSheetProjections(sheet, { situations: [selected] })
        .current.breakdowns['ac.other'].total,
    ).toBe(bonus);
  }

  const negative = modifiers('Necromantic Affinity');
  expect(
    resolveSheet(negative, { situations: ['negativeEnergy'] })['save.will']
      .total,
  ).toBe(2);
  expect(
    resolveSheet(negative, {
      situations: ['negativeEnergy', situation('Necromantic Affinity', 1)],
    })['save.will'].total,
  ).toBe(2);
  expect(
    resolveSheet(negative, { situations: ['death'] })['save.will'].total,
  ).toBe(0);
});

it('keeps recipient, replacement, per-hit, caster-duration and Story completion rules out of ordinary totals', () => {
  for (const name of [
    'Ready for Battle',
    'Blood Feast',
    'Pushing Assault',
    'Shadow Caster',
    'Jabbing Style',
    'Rending Claws',
    'Wilding',
    'War Blessing',
  ])
    expect(entry(name).modifiers, name).toEqual([]);
  const nation = modifiers('Nation Builder');
  expect(resolveSheet(nation).init.total).toBe(0);
  const complete = resolveSheet(nation, {
    situations: [situation('Nation Builder', 6)],
  });
  expect([
    complete.init.total,
    complete['attack.melee'].total,
    complete['save.will'].total,
  ]).toEqual([2, 2, 2]);
  expect(
    entry('Nation Builder').situationalNotes?.some((note) =>
      note.text.includes('Completion Benefit'),
    ),
  ).toBe(true);
  expect(
    resolveSheet(modifiers('Traditional Weapons'), {
      situations: [situation('Traditional Weapons')],
    }).cmb.total,
  ).toBe(2);
});

it('reimports the fixture from only its reviewable file inventory, including the empty pack marker', async () => {
  const { mkdtemp, mkdir, copyFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const parent = tmpdir();
  const isolated = await mkdtemp(join(parent, 'feats-346-tracked-only-'));
  try {
    const files = [
      'pf1/public/system.json',
      'pf1/packs/.gitkeep',
      'pf1-content/module.json',
      ...review.candidates.map((row) => `pf1-content/${row.source.path}`),
    ];
    for (const file of files) {
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
