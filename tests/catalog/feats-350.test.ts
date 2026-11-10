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
} from '../fixtures/feats-350/data';
import {
  findCommittedBatchOwnershipProblems,
  bindSnapshotToCurrentNotices,
} from './batch-ownership';
import { reviewedFeatSheet } from '../fixtures/feats-350/sheet';

import { preview as previousPreview } from '../fixtures/feats-349/data';
import { expectAutomaticSkillFocus } from './skill-focus-assertions';

const fixtureRoot = resolve('tests/fixtures/feats-350');
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
      admitted ? [] : [`feats-350-whole-content-${raw._id}`],
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
        : '2026-10-10',
    });
  }
});

it('reproduces reviewed outputs and binds admission to whole imported bodies', async () => {
  const artifact = await importCatalog(inputs);
  expect(artifact.curation.passed).toBe(true);
  expect(artifact.curation.summary.required).toBe(0);
  expect(artifact.curation.summary.descriptions.checked).toBe(100);
  expect(artifact.curation.unresolvedMechanics).toEqual([]);
  // #724 resolved the admitted Skill Focus records' rank diagnostics.
  expect(artifact.curation.unresolvedDescriptions).toHaveLength(99);
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
    entry('Skill Focus (Knowledge [Engineering])').externalKey,
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
    findCommittedBatchOwnershipProblems('scripts/catalog/legal/feats-350.json'),
  ).toEqual([]);
});
it('keeps its whole-history preservation manifest on disk until the #744 cleanup', () => {
  // #749 retired this manifest's checks; the file itself stays as recorded.
  expect(originals.assessments).toHaveLength(3531);
});

it('reconstructs the fixture from reviewable files with portable temporary storage', async () => {
  const { mkdtemp, mkdir, copyFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const isolated = await mkdtemp(join(tmpdir(), 'feats-350-tracked-only-'));
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
        c.name === 'Skill Focus (Knowledge [Engineering])',
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
      expect(hold?.evidence).toContain('scripts/catalog/legal/feats-350.json');
    }
  }
  expect(matched).toBe(86);
  const focus = review.candidates.find(
    (row) => row.name === 'Skill Focus (Knowledge [Engineering])',
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
        line.startsWith('Knowledge (Engineering)\t') &&
        line.includes('TYPE:Intelligence.Knowledge.Base'),
    );
  expect(base).toContain('KEYSTAT:INT');
  expect(focus.requiredNotices).toEqual(['PZO1110']);
});

it('keeps source publication minima separate from inherited rules and literal special cases', () => {
  const required = (name: string) =>
    review.candidates.find((row) => row.name === name)?.requiredNotices;
  expect(required('Arcane Shield (Mythic)')).toEqual(
    expect.arrayContaining(['PZO1126', 'PZO1115', 'PZO1110']),
  );
  expect(required('Planar Wild Shape')).toContain('PZO1112');
  expect(required('Serpentine Compression')).toContain('PZO1116');
  expect(required('Grow Plant Creature')).toEqual(
    expect.arrayContaining(['PZO1112', 'PZO1116', 'PZO1110']),
  );
  expect(required('Consumption')).toEqual(
    expect.arrayContaining(['PZO1115', 'PZO1117', 'PZO1129', 'PZO1132']),
  );
  for (const row of review.candidates) {
    if (row.mechanicsReview.descriptionText.includes('Combat Trick'))
      expect(row.requiredNotices).toContain('PZO1131');
    if (row.mechanicsReview.descriptionText.includes('Completion Benefit'))
      expect(row.requiredNotices).toContain('PZO1125');
  }
});

// #724: the rank threshold is automatic, read from each skill's own ranks.
it("gives Engineering +3, or +6 at 10 ranks, without a Situation, a stacking copy or another skill's ranks", () => {
  const name = 'Skill Focus (Knowledge [Engineering])',
    rows = modifiers(name);
  expectAutomaticSkillFocus({ modifiers: rows, target: 'skill.ken' });
  const other = previousPreview.entries.find(
    (row) => row.name === 'Skill Focus (Linguistics)',
  );
  if (!other) throw new Error('Missing admitted Linguistics');
  const otherRows = other.modifiers.map((raw) => ({
    ...outputSchema.options[0]
      .omit({ kind: true })
      .extend({ target: z.enum(modifierTargets) })
      .parse(raw),
    sheetEntryId: 'linguistics',
    catalogEntryId: other.externalKey,
    source: other.externalKey,
    entryName: other.name,
    builtIn: false,
  }));
  const different = resolveSheet([...rows, ...otherRows], {
    skillRanks: { 'skill.lin': 10 },
  });
  expect(different['skill.ken'].total).toBe(3);
  expect(different['skill.lin'].total).toBe(6);
  // No ranks and Intelligence 10: Skill Focus's +3 alone.
  expect(
    calculateCharacterSheetProjections(reviewedFeatSheet(name)).current
      .breakdowns['skill.ken'].total,
  ).toBe(3);
});

it('pins real conditional values without changing normal totals or recipient statistics', () => {
  for (const [name, target, value] of [
    ['Citystep', 'skill.ste', 5],
    ['Stone Shroud', 'skill.ste', 4],
    ['Secret Signs', 'skill.blf', 4],
    ['Canny Tumble', 'attack.melee', 2],
    ['Merciless Magic', 'spellDC', 1],
    ['Signature Strike Style', 'skill.per', 2],
  ] as const) {
    expect(resolveSheet(modifiers(name))[target].total).toBe(0);
    expect(
      resolveSheet(modifiers(name), { situations: [situation(name)] })[target]
        .total,
    ).toBe(value);
  }
  expect(entry('Lifeless Gaze').modifiers[0]).toMatchObject({
    target: 'skill.blf',
    bonusType: 'insight',
    value: 2,
  });
  expect(resolveSheet(modifiers('Lifeless Gaze'))['skill.blf'].total).toBe(2);
  for (const name of [
    'Camouflaged Trap',
    'Fanged Crown Massacre',
    'Extend the Bulwark',
    'Gruesome Shapechanger',
  ])
    expect(entry(name).modifiers).toEqual([]);
});

it('keeps replacement baselines, SLA tables, ritual values and whole action rules readable', () => {
  for (const name of [
    'Barracuda Style',
    'Improved Studied Combatant',
    'Horn of the Criosphinx',
    'Finesse Shot',
    "Erastil's Blessing",
    'Got Your Back',
    'Feral Combat Training',
    'Climbing Vine',
  ])
    expect(entry(name).modifiers, name).toEqual([]);
  expect(entry('Grow Plant Creature').description).toContain('43,750');
  expect(entry('Grow Plant Creature').description).toContain('DC 32');
  expect(entry('Lingering Spell-Like Ability').description).toContain('20th');
  expect(entry('Barracuda Style').description).toContain('half damage');
  expect(entry('Got Your Back').situationalNotes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        text: expect.stringContaining('3 stamina points'),
      }),
    ]),
  );
});

it('records the complete historical context union before optional outputs are added', async () => {
  const context = z
    .object({
      base: z.string(),
      sources: z.array(
        z.object({
          path: z.string(),
          sha256: z.string(),
          keys: z.array(z.string()),
        }),
      ),
      seedKeys: z.array(z.string()),
      closureKeys: z.array(z.string()),
      definitions: z.record(z.string(), z.string()),
      protectedRoots: z.array(z.string()),
    })
    .parse(
      JSON.parse(
        await readFile(join(fixtureRoot, 'protected-context.json'), 'utf8'),
      ),
    );
  expect(context.base).toBe('5baa77b8e1df81a2561ae7101001b3dfb141e86d');
  expect(
    [...new Set(context.sources.flatMap((row) => row.keys))].sort(),
  ).toEqual(context.seedKeys);
  expect(context.sources).toHaveLength(281);
  expect(context.seedKeys).toHaveLength(3953);
  expect(context.closureKeys).toHaveLength(5218);
  expect(Object.keys(context.definitions)).toHaveLength(5166);
  expect(context.protectedRoots).toEqual([]);
  // The sources are other batches' inventories and fixtures; those are
  // theirs to change, so only the recorded union is checked here (#749).
  for (const row of review.candidates)
    expect(context.closureKeys).not.toContain(row.externalKey);
});
