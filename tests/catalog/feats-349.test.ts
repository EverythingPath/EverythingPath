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
} from '../fixtures/feats-349/data';
import {
  findCommittedBatchOwnershipProblems,
  bindSnapshotToCurrentNotices,
} from './batch-ownership';
import { reviewedFeatSheet } from '../fixtures/feats-349/sheet';
import { expectAutomaticSkillFocus } from './skill-focus-assertions';

const fixtureRoot = resolve('tests/fixtures/feats-349');
const inputs = {
  systemPath: join(fixtureRoot, 'pf1'),
  contentPath: join(fixtureRoot, 'pf1-content'),
  remaps: [],
  curation: reviewedCuration,
  candidateKeys: provenance.candidates.map((row) => row.externalKey),
};
const sha256 = (text: string | Uint8Array) =>
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

it('reconciles the exact 100-key inventory with byte-exact full descriptions, current inventory bindings and reviewed facts', async () => {
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
      admitted ? [] : [`feats-349-whole-content-${raw._id}`],
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
    entry('Skill Focus (Linguistics)').externalKey,
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
    expect(binding, c.name).toEqual(
      bindSnapshotToCurrentNotices(c.currentBinding),
    );
    const live = reviewedAdmission.assessments.find(
      (row) => row.externalKey === c.externalKey,
    );
    expect(live, c.name).toMatchObject(binding);
    expect(live?.requiredNotices, c.name).toEqual(c.requiredNotices);
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

it('keeps its own description records, assessments, evidence and holds as recorded', () => {
  expect(
    findCommittedBatchOwnershipProblems('scripts/catalog/legal/feats-349.json'),
  ).toEqual([]);
});
it('keeps its whole-history preservation manifest on disk until the #744 cleanup', () => {
  // #749 retired this manifest's checks; the file itself stays as recorded.
  expect(originals.assessments).toHaveLength(3332);
});

it('reconstructs the fixture from reviewable files with portable temporary storage', async () => {
  const { mkdtemp, mkdir, copyFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const isolated = await mkdtemp(join(tmpdir(), 'feats-349-tracked-only-'));
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

it('pins literal partial comparisons and the complete CRB Skill Focus benefit/choice bound', async () => {
  let matched = 0;
  for (const c of review.candidates) {
    if (c.comparison) matched++;
    for (const lead of [c.comparison, ...c.additionalComparisonLeads]) {
      if (!lead) continue;
      const bytes = await readFile(
        join(fixtureRoot, 'comparison-sources', lead.path),
        'utf8',
      );
      const line = bytes.split('\n')[lead.line - 1];
      expect(sha256(bytes), c.name).toBe(lead.comparisonFileSha256);
      expect(line, c.name).toBe(lead.literalRow);
      expect(sha256(lead.literalRow)).toBe(lead.comparisonLineSha256);
      expect(lead.completeDirectComparison).toBe(
        c.name === 'Skill Focus (Linguistics)',
      );
    }
    for (const support of c.inheritedRuleSourceEvidence) {
      const bytes = await readFile(
        join(fixtureRoot, support.fixturePath),
        'utf8',
      );
      expect(sha256(bytes)).toBe(support.sha256);
      expect(sourceDescription(upstreamRecord.parse(parse(bytes)))).toBe(
        support.description,
      );
    }
    for (const dep of c.inheritedRuleNotices)
      expect(c.requiredNotices, c.name).toContain(dep.book);
    for (const id of c.noticeHoldIds) {
      const hold = heldNotices.find((row) => row.id === id);
      expect(hold?.evidence).toContain('scripts/catalog/legal/feats-349.json');
    }
  }
  expect(matched).toBe(85);
  const focus = review.candidates.find(
    (row) => row.name === 'Skill Focus (Linguistics)',
  );
  if (!focus?.comparison) throw new Error('Missing Skill Focus');
  const benefit = /<strong>Benefits<\/strong>:\s*([^<]+)/.exec(
    focus.mechanicsReview.descriptionText,
  )?.[1];
  const comparison = focus.comparison.literalRow
    .split('\t')
    .find((row) => row.startsWith('BENEFIT:'))
    ?.slice(8);
  // Independently recompute the direct positive body equality, not its stored flag.
  expect(benefit).toBe(comparison);
  expect(benefit).toBe(
    'You get a +3 bonus on all checks involving the chosen skill. If you have 10 or more ranks in that skill, this bonus increases to +6.',
  );
  expect(focus.comparison.literalRow.split('\t')).toEqual(
    expect.arrayContaining(['CHOOSE:SKILL|TYPE=Base', 'MULT:YES', 'STACK:NO']),
  );
  const skills = await readFile(
    join(
      fixtureRoot,
      'comparison-sources/data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_skills.lst',
    ),
    'utf8',
  );
  const base = skills
    .split('\n')
    .find(
      (line) =>
        line.startsWith('Linguistics\t') &&
        line.includes('TYPE:Intelligence.Base'),
    );
  expect(base).toContain('KEYSTAT:INT');
  expect(focus.requiredNotices).toEqual(['PZO1110']);
});

it('retains exact inherited publication minima and shared recipient Situation semantics', () => {
  const required = (name: string) =>
    review.candidates.find((row) => row.name === name)?.requiredNotices;
  expect(required('Reactive Arcane Shield')).toContain('PZO1115');
  expect(required('Reactive Arcane Shield')).not.toContain('PZO1117');
  expect(required('Orc Fury Style')).toContain('PZO1121');
  expect(required('Spirit Oni Master')).toContain('PZO1120');
  for (const name of ['Powerful Wings', 'Fling'])
    expect(required(name)).toContain('PZO1112');
  for (const name of ['Blinded Competence', 'Improved Dark Sight'])
    expect(required(name)).toEqual(
      expect.arrayContaining([
        'PZO1112',
        'PZO1116',
        'PZO1120',
        'PZO1127',
        'PZO1133',
        'PZO1137',
      ]),
    );
  for (const c of review.candidates) {
    if (c.mechanicsReview.descriptionText.includes('Combat Trick'))
      expect(c.requiredNotices).toContain('PZO1131');
    if (c.mechanicsReview.descriptionText.includes('Completion Benefit'))
      expect(c.requiredNotices).toContain('PZO1125');
  }
  const leadership = entry('Practiced Leadership');
  expect(leadership.modifiers).toEqual([]);
  expect(leadership.situationalNotes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        target: 'save.will',
        situation: 'enchantment',
        text: expect.stringContaining('cohort gains a +4 morale bonus'),
      }),
    ]),
  );
});

// #724: the rank threshold is automatic, read from the skill's recorded ranks.
it('gives Skill Focus (Linguistics) +3, or +6 at 10 ranks, without a Situation or a stacking same-Source copy', () => {
  const data = modifiers('Skill Focus (Linguistics)');
  expectAutomaticSkillFocus({ modifiers: data, target: 'skill.lin' });
  // No ranks: Skill Focus's +3.
  for (const projection of Object.values(
    calculateCharacterSheetProjections(
      reviewedFeatSheet('Skill Focus (Linguistics)'),
    ),
  ))
    expect(projection.breakdowns['skill.lin'].total).toBe(3);
});

it('pins the retry and opposed-Perception numbers without inserting Normal or recipient penalties', () => {
  expect(resolveSheet(modifiers('Confabulist'))['skill.blf'].total).toBe(0);
  expect(
    resolveSheet(modifiers('Confabulist'), {
      situations: [situation('Confabulist')],
    })['skill.blf'].total,
  ).toBe(-5);
  for (const [index, value] of [
    [0, 2],
    [1, 10],
  ])
    expect(
      resolveSheet(modifiers('Tenacious Hunter'), {
        situations: [situation('Tenacious Hunter', index)],
      })['skill.per'].total,
    ).toBe(value);
  const expressionless = resolveSheet(modifiers('Expressionless'), {
    situations: [situation('Expressionless')],
  });
  expect(expressionless['skill.blf'].total).toBe(2);
  expect(expressionless['skill.dip'].total).toBe(0);
  expect(expressionless['skill.sen'].total).toBe(0);
});

it('pins conditional spell DC, dragon saves, crafting and next-attack focus values', () => {
  for (const [name, target, value] of [
    ['Spell Bane', 'spellDC', 2],
    ['Dragonheart', 'save.fort', 1],
    ['Demon Grafter', 'skill.hea', 2],
    ['Natural Poison Harvester', 'skill.crf', 2],
    ['Strike True', 'attack.melee', 4],
    ['Hellcat Stealth', 'skill.ste', -10],
  ] as const) {
    const rows = modifiers(name);
    expect(resolveSheet(rows)[target].total).toBe(0);
    expect(
      resolveSheet(rows, { situations: [situation(name)] })[target].total,
    ).toBe(value);
  }
  expect(resolveSheet(modifiers('Dispel Synergy'))['save.will'].total).toBe(0);
  expect(
    resolveSheet(modifiers('Advanced Ranger Trap'))['skill.per'].total,
  ).toBe(0);
  expect(
    resolveSheet(modifiers('Natural Poison Harvester'), {
      situations: [situation('Natural Poison Harvester')],
    }).spellDC.total,
  ).toBe(0);
});

it('keeps stamina alternatives, location scope and rank thresholds exact', () => {
  const stalker = modifiers('Moonlight Stalker');
  for (const [index, value] of [
    [0, 2],
    [2, 4],
  ]) {
    const attack = resolveSheet(stalker, {
      situations: [situation('Moonlight Stalker', index)],
    });
    expect(attack['attack.melee'].total).toBe(value);
    expect(attack['damage.melee'].total).toBe(value);
  }
  const corsair = modifiers('Corsair of Taldor');
  expect(
    resolveSheet(corsair, { situations: [situation('Corsair of Taldor')] }).init
      .total,
  ).toBe(2);
  expect(
    resolveSheet(corsair, { situations: [situation('Corsair of Taldor')] })[
      'damage.melee'
    ].total,
  ).toBe(0);
  expect(
    resolveSheet(corsair, { situations: [situation('Corsair of Taldor', 1)] })[
      'damage.melee'
    ].total,
  ).toBe(1);
  for (const [index, value] of [
    [0, 2],
    [1, 4],
  ])
    expect(
      resolveSheet(modifiers('Light Gravity Acclimation'), {
        situations: [situation('Light Gravity Acclimation', index)],
      })['skill.acr'].total,
    ).toBe(value);
});

it('adds no replacement baselines or imaginary engine behavior', () => {
  for (const name of [
    'Earth Child Style',
    'Combat Rhythm',
    'Improved Mounted Archery',
    'Aquadynamic Focus',
    'Octopus Focus',
    'Focused Plant Expertise',
    'Improved Wilding Strike',
  ])
    expect(entry(name).modifiers, name).toEqual([]);
  expect(entry('Earth Child Style').description).toContain('increases to +6');
  expect(entry('Improved Mounted Archery').description).toContain(
    'reduced to -2',
  );
  expect(entry('Improved Wilding Strike').description).toContain(
    '1d8 (or 1d6 if you are Small)',
  );
  const projection = calculateCharacterSheetProjections(
    reviewedFeatSheet('Earth Child Style'),
  ).current;
  expect(projection.breakdowns['ac.other'].total).toBe(0);
  expect(projection.breakdowns['damage.melee'].total).toBe(0);
});
