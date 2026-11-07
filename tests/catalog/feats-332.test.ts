// @vitest-environment node
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import review from '../../scripts/catalog/legal/feats-332.json';
import { reviewedCuration as curation } from '../../scripts/catalog/reviewed-curation-data';
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
import { outputSchema } from '../../src/lib/catalog/curation-output-schema';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheetProjections,
  modifierTargets,
  resolveSheet,
} from '../../src/lib/character-sheet';
import provenance from '../fixtures/feats-332/provenance.json';
import preview from '../fixtures/feats-332/preview.json';
import { featFixtureSheet } from '../fixtures/feats-332/sheet';

const fixtureRoot = resolve('tests/fixtures/feats-332');
const inputs = {
  systemPath: join(fixtureRoot, 'pf1'),
  contentPath: join(fixtureRoot, 'pf1-content'),
  remaps: [],
  curation,
};
const sha256 = (text: string) =>
  createHash('sha256').update(text).digest('hex');

function entry(name: string) {
  const result = preview.entries.find((row) => row.name === name);
  if (!result) throw new Error(`Missing feat: ${name}`);
  return result;
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

function sheetWithFeat(name: string) {
  const input = featFixtureSheet();
  const feat = importedCatalogEntrySchema.parse(entry(name));
  return {
    ...input,
    catalogEntries: input.catalogEntries.map((row) =>
      row._id === 'feat'
        ? {
            _id: row._id,
            name: feat.name,
            ruleIdentity: feat.externalKey,
            modifiers: modifiers(name),
            prerequisites: feat.prerequisites,
            detail: { kind: 'feat' as const },
          }
        : row,
    ),
  };
}

function agileSheet(strength: number, dexterity: number) {
  const input = sheetWithFeat('Agile Maneuvers');
  return {
    ...input,
    catalogEntries: input.catalogEntries.map((row) =>
      row._id === 'base'
        ? {
            ...row,
            modifiers: abilityKeys.map((ability) => ({
              target: abilityTargets[ability],
              bonusType: 'base' as const,
              value:
                ability === 'strength'
                  ? strength
                  : ability === 'dexterity'
                    ? dexterity
                    : 10,
            })),
          }
        : row,
    ),
  };
}

it('preserves exactly the 100 ticket keys and byte-for-byte pinned source evidence', async () => {
  const keys = provenance.candidates.map((candidate) => candidate.externalKey);
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(sha256(keys.join('\n'))).toBe(
    'b7953593a6e6c0413785f2814e59caad22e31d8279a839f34e12ee653e06e5e0',
  );
  expect(review.candidates.map((candidate) => candidate.externalKey)).toEqual(
    keys,
  );
  expect(
    review.candidates.filter((row) => row.disposition === 'supported/admitted'),
  ).toHaveLength(20);
  expect(
    review.candidates.filter(
      (row) => row.disposition === 'dependently-omitted',
    ),
  ).toHaveLength(1);
  expect(
    review.candidates.filter((row) => row.disposition === 'held'),
  ).toHaveLength(79);
  for (const candidate of review.candidates) {
    const source = provenance.candidates.find(
      (row) => row.externalKey === candidate.externalKey,
    );
    expect(candidate.source).toEqual(source?.source);
    expect(candidate.descriptionSha256).toBe(source?.descriptionSha256);
    const raw = await readFile(
      join(inputs.systemPath, candidate.source.path),
      'utf8',
    );
    expect(sha256(raw), candidate.name).toBe(candidate.source.sha256);
    const record = upstreamRecord.parse(parse(raw));
    expect(`pf1/${record._id}`).toBe(candidate.externalKey);
    expect(sha256(sourceDescription(record))).toBe(candidate.descriptionSha256);
    const assessment = reviewedAdmission.assessments.find(
      (row) => row.externalKey === candidate.externalKey,
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
    if (candidate.disposition === 'held') {
      expect(candidate.holdIds.length).toBeGreaterThan(0);
      expect(candidate.missingEvidence.length).toBeGreaterThan(0);
      expect(candidate.noticeRequirementsComplete).toBe(false);
    } else {
      expect(candidate.requiredNotices).toEqual(['PZO1110']);
      expect(evidence).toContain('PCGen');
      expect(evidence).toContain(candidate.comparison?.comparisonLineSha256);
    }
    expect(entry(candidate.name).detail.repeatable).toBe('unreviewed');
    expect(candidate.mechanicsReview.sourceEvidence.sha256).toBe(
      candidate.source.sha256,
    );
    expect(candidate.mechanicsReview.completeCalculation).toBe(false);
    expect(
      candidate.mechanicsReview.outstandingMechanics.length,
    ).toBeGreaterThan(0);
  }
});

it('reproduces source-derived numeric outputs and checked records from reduced fixtures', async () => {
  const artifact = await importCatalog(inputs);
  expect(artifact.catalog.entries).toHaveLength(100);
  const demonstrated = (row: {
    externalKey: string;
    name: string;
    modifiers: unknown;
    sources?: unknown;
    situationalNotes?: unknown;
  }) => ({
    externalKey: row.externalKey,
    name: row.name,
    modifiers: row.modifiers,
    sources: row.sources,
    situationalNotes: row.situationalNotes,
  });
  // The complete-checkout preview includes out-of-batch prerequisite/link facts.
  // The reduced fixtures reproduce all numerical and curated note output.
  expect(preview.entries.map(demonstrated)).toEqual(
    artifact.catalog.entries.map(demonstrated),
  );
  expect(artifact.curation.passed).toBe(true);
  expect(artifact.curation.summary).toMatchObject({
    required: 31,
    checked: 31,
    drafted: 0,
    missing: 0,
    descriptions: { candidates: 46, checked: 46, drafted: 0 },
  });
  expect(artifact.curation.summary.drafted).toBe(0);
  expect(artifact.curation.summary.missing).toBe(0);
  expect(artifact.curation.summary.checked).toBe(
    artifact.curation.summary.required,
  );
  expect(artifact.curation.summary.descriptions.checked).toBe(
    artifact.curation.summary.descriptions.candidates,
  );
  expect(artifact.curation.unresolvedMechanics).toEqual([]);
  expect(artifact.curation.unresolvedDescriptions).toHaveLength(20);
  for (const gap of artifact.curation.unresolvedDescriptions) {
    expect(gap.status).toBe('checked');
    expect(gap.diagnostics).toContainEqual(
      expect.objectContaining({ kind: 'unresolved' }),
    );
    expect(gap.outputs).not.toContainEqual(
      expect.objectContaining({
        text: 'Review required: replace this placeholder with readable rules text or structured outputs.',
      }),
    );
  }
});

it('binds admitted comparisons to their reviewed bodies and reopens a changed benefit', async () => {
  const artifact = await importCatalog(inputs);
  const catalogArtifact = {
    ...artifact,
    catalog: {
      ...artifact.catalog,
      entries: preview.entries.map((raw) => {
        const row = importedCatalogEntrySchema.parse(raw);
        if (row.detail.kind !== 'feat')
          throw new Error(`Unexpected definition: ${row.externalKey}`);
        return { ...row, detail: row.detail };
      }),
    },
  };
  const gate = assessCatalogAdmission({
    artifact: catalogArtifact,
    ...reviewedAdmission,
  });
  const greatFortitude = entry('Great Fortitude');
  expect(gate.admitted).toContainEqual(
    expect.objectContaining({ externalKey: greatFortitude.externalKey }),
  );
  const assessment = reviewedAdmission.assessments.find(
    (row) => row.externalKey === greatFortitude.externalKey,
  );
  if (!assessment) throw new Error('Missing Great Fortitude assessment');
  const bound = catalogArtifact.catalog.entries.find(
    (row) => row.externalKey === greatFortitude.externalKey,
  );
  if (!bound) throw new Error('Missing Great Fortitude body');
  expect(assessment).toMatchObject(
    buildAssessmentBinding({
      entry: bound,
      artifact: catalogArtifact,
      ...reviewedAdmission,
      requiredNotices: assessment.requiredNotices,
      evidenceIds: Object.keys(assessment.evidenceFingerprints),
    }),
  );
  const changed = {
    ...bound,
    description: `${bound.description}<p>Changed benefit.</p>`,
  };
  const changedArtifact = {
    ...catalogArtifact,
    catalog: {
      ...catalogArtifact.catalog,
      entries: catalogArtifact.catalog.entries.map((row) =>
        row.externalKey === bound.externalKey ? changed : row,
      ),
    },
  };
  const changedGate = assessCatalogAdmission({
    artifact: changedArtifact,
    ...reviewedAdmission,
  });
  expect(changedGate.admitted).not.toContainEqual(
    expect.objectContaining({ externalKey: bound.externalKey }),
  );
  expect(changedGate.held).toContainEqual(
    expect.objectContaining({ externalKey: bound.externalKey }),
  );
});

it('adds Great Fortitude +2 once to both public projections and leaves Reflex and Will alone', () => {
  const result = calculateCharacterSheetProjections(featFixtureSheet());
  for (const projection of [result.current, result.permanent]) {
    expect(projection.derivedStatistics.fortitude.total).toBe(4); // Constitution 14 contributes +2; the feat contributes +2.
    expect(projection.derivedStatistics.reflex.total).toBe(0);
    expect(projection.derivedStatistics.will.total).toBe(0);
    expect(projection.derivedStatistics.fortitude.applied).toContainEqual(
      expect.objectContaining({ source: 'pf1/fVRnBIHR4Jq6btvm', value: 2 }),
    );
  }
  const data = modifiers('Great Fortitude');
  const copied = data.map((row) => ({
    ...row,
    sheetEntryId: 'catalog-copy',
    catalogEntryId: 'catalog-copy',
  }));
  expect(resolveSheet([...data, ...copied])['save.fort'].total).toBe(2);
  expect(
    resolveSheet([...data, ...modifiers('Iron Will')])['save.will'].total,
  ).toBe(2);
});

it.each([
  ['Grapple', 'grapple'],
  ['Trip', 'trip'],
  ['Overrun', 'overrun'],
  ['Sunder', 'sunder'],
])(
  'stacks Improved and Greater %s offense separately from its defensive Situation',
  (maneuver, offensive) => {
    const data = [
      ...modifiers(`Improved ${maneuver}`),
      ...modifiers(`Greater ${maneuver}`),
    ];
    expect(resolveSheet(data).cmb.total).toBe(0);
    expect(resolveSheet(data).cmd.total).toBe(0);
    const attacking = resolveSheet(data, { situations: [offensive] });
    expect(attacking.cmb.total).toBe(4);
    expect(attacking.cmd.total).toBe(0);
    const defensive = {
      local: `against a ${offensive} combat maneuver`,
      sheetEntryId: entry(`Improved ${maneuver}`).externalKey,
    };
    const defending = resolveSheet(data, { situations: [defensive] });
    expect(defending.cmb.total).toBe(0);
    expect(defending.cmd.total).toBe(2);
    const combined = resolveSheet(data, { situations: [offensive, defensive] });
    expect(combined.cmb.total).toBe(4);
    expect(combined.cmd.total).toBe(2);
  },
);

it('applies Combat Casting +4 only to its entry-local concentration Situation', () => {
  const data = modifiers('Combat Casting');
  const situation = data.find((row) => row.target === 'concentration')
    ?.condition?.situation;
  if (typeof situation !== 'object' || !('local' in situation))
    throw new Error('Missing local Combat Casting Situation');
  expect(resolveSheet(data).concentration.total).toBe(0);
  const selected = {
    ...situation,
    sheetEntryId: entry('Combat Casting').externalKey,
  };
  expect(
    resolveSheet(data, { situations: [selected] }).concentration.total,
  ).toBe(4);
  expect(
    resolveSheet(data, {
      situations: [{ ...selected, sheetEntryId: 'unrelated-row' }],
    }).concentration.total,
  ).toBe(0);
  expect(
    resolveSheet(data, { situations: [situation.local] }).concentration.total,
  ).toBe(0);
  expect(
    resolveSheet(data, { situations: [selected] })['save.fort'].total,
  ).toBe(0);
});

it('limits Run +4 to a running jump and Spell Penetration +2 to overcoming spell resistance', () => {
  const run = modifiers('Run');
  const situation = run.find((row) => row.target === 'skill.acr')?.condition
    ?.situation;
  if (typeof situation !== 'object' || !('local' in situation))
    throw new Error('Missing local running-jump Situation');
  expect(resolveSheet(run)['skill.acr'].total).toBe(0);
  expect(
    resolveSheet(run, {
      situations: [{ ...situation, sheetEntryId: entry('Run').externalKey }],
    })['skill.acr'].total,
  ).toBe(4);
  expect(
    resolveSheet(run, { situations: ['charging'] })['skill.acr'].total,
  ).toBe(0);
  const penetration = modifiers('Spell Penetration');
  expect(resolveSheet(penetration).casterLevel.total).toBe(0);
  expect(
    resolveSheet(penetration, { situations: ['spellResistance'] }).casterLevel
      .total,
  ).toBe(2);
  expect(
    resolveSheet(penetration, { situations: ['spells'] }).casterLevel.total,
  ).toBe(0);
});

it('preserves typed prerequisites and proficiency requirements without inventing missing grants', () => {
  const cleave = importedCatalogEntrySchema.parse(entry('Cleave'));
  expect(cleave.prerequisites).toEqual([
    { ability: 'strength', min: 13, kind: 'ability' },
    { feat: 'pf1/FUW5mIXHNBBIQ1Sq', kind: 'feat' },
    { bab: 1, kind: 'bab' },
  ]);
  const deadlyStroke = importedCatalogEntrySchema.parse(entry('Deadly Stroke'));
  expect(deadlyStroke.prerequisites).toContainEqual({
    proficiency: { choice: true },
    kind: 'proficiency',
  });
  expect(deadlyStroke.prerequisites).toContainEqual({ bab: 11, kind: 'bab' });
  const medium = importedCatalogEntrySchema.parse(
    entry('Armor Proficiency, Medium'),
  );
  expect(medium.prerequisites).toEqual([
    { proficiency: { category: 'light' }, kind: 'proficiency' },
  ]);
  expect(entry('Armor Proficiency, Medium')).not.toHaveProperty(
    'proficiencies',
  );
  const result = calculateCharacterSheetProjections(
    sheetWithFeat('Armor Proficiency, Medium'),
  );
  for (const projection of [result.current, result.permanent]) {
    expect(projection.proficiencies.grants).toEqual([]);
    expect(projection.prerequisites).toContainEqual(
      expect.objectContaining({
        view: 'current',
        clause: { proficiency: { category: 'light' }, kind: 'proficiency' },
        met: false,
      }),
    );
    expect(projection.resolvedEntries).toContainEqual(
      expect.objectContaining({
        counting: true,
        entry: expect.objectContaining({ kind: 'feat' }),
      }),
    );
  }
  const reviewed = review.candidates.find(
    (row) => row.name === 'Armor Proficiency, Medium',
  );
  expect(reviewed?.mechanicsReview.outstandingMechanics.join(' ')).toMatch(
    /proficien/i,
  );
});

it('leaves unsupported rank-dependent skill calculations outstanding instead of applying unconditional substitute bonuses', () => {
  for (const name of ['Animal Affinity', 'Stealthy', 'Acrobatic', 'Athletic']) {
    expect(modifiers(name), name).toEqual([]);
    const reviewed = review.candidates.find((row) => row.name === name);
    expect(
      reviewed?.mechanicsReview.outstandingMechanics.join(' '),
      name,
    ).toMatch(/rank|formula|skill/i);
  }
  expect(
    modifiers('Combat Reflexes').filter((row) =>
      row.target.startsWith('attack'),
    ),
  ).toEqual([]);
  expect(resolveSheet(modifiers('Arcane Armor Mastery')).spellDC.total).toBe(0);
});

it.each([
  [18, 10, 0],
  [14, 14, 2],
  [10, 18, 4],
])(
  'replaces Strength %i with Dexterity %i for Agile Maneuvers CMB %i only in its selected size Situation',
  (strength, dexterity, expected) => {
    const input = agileSheet(strength, dexterity);
    const ordinary = calculateCharacterSheetProjections(input);
    expect(ordinary.current.derivedStatistics.cmb.total).toBe(
      Math.floor((strength - 10) / 2),
    );
    const situations = [
      {
        local: 'Small or larger (baseline CMB uses Strength)',
        sheetEntryId: 'feat-row',
      },
    ];
    const result = calculateCharacterSheetProjections(input, { situations });
    for (const projection of [result.current, result.permanent])
      expect(projection.derivedStatistics.cmb.total).toBe(expected);
    const small = calculateCharacterSheetProjections(input, {
      size: 'small',
      situations,
    });
    for (const projection of [small.current, small.permanent])
      expect(projection.derivedStatistics.cmb.total).toBe(expected - 1);
  },
);

it.each([
  ['tiny', 0],
  ['diminutive', -2],
  ['fine', -6],
] as const)(
  'does not add Agile Maneuvers substitution twice at %s size',
  (size, expected) => {
    const input = agileSheet(10, 14);
    const baseline = calculateCharacterSheetProjections(
      {
        ...input,
        entries: input.entries.map((row) =>
          row.kind === 'feat' ? { ...row, active: false } : row,
        ),
      },
      { size },
    );
    const selected = calculateCharacterSheetProjections(input, { size });
    for (const projection of [
      baseline.current,
      baseline.permanent,
      selected.current,
      selected.permanent,
    ])
      expect(projection.derivedStatistics.cmb.total).toBe(expected);
    const reviewed = review.candidates.find(
      (row) => row.name === 'Agile Maneuvers',
    );
    expect(reviewed?.mechanicsReview.outstandingMechanics.join(' ')).toMatch(
      /size/i,
    );
  },
);
