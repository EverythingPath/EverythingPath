// @vitest-environment node
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import review from '../../scripts/catalog/legal/feats-336.json';
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
  calculateCharacterSheetProjections,
  modifierTargets,
  resolveSheet,
} from '../../src/lib/character-sheet';
import provenance from '../fixtures/feats-336/provenance.json';
import preview from '../fixtures/feats-336/preview.json';
import { heldFeatSheet } from '../fixtures/feats-336/sheet';

const fixtureRoot = resolve('tests/fixtures/feats-336');
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

function localSituation(name: string, target: string) {
  const situation = modifiers(name).find((row) => row.target === target)
    ?.condition?.situation;
  if (typeof situation !== 'object' || !('local' in situation))
    throw new Error(`Missing local Situation: ${name}, ${target}`);
  return { ...situation, sheetEntryId: entry(name).externalKey };
}

it('preserves exactly the 100 ticket keys and byte-for-byte pinned pf1-content evidence', async () => {
  const keys = provenance.candidates.map((candidate) => candidate.externalKey);
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(sha256(keys.join('\n'))).toBe(
    'da28bd5d78d261b6feb354973968dc683054ba34f0f6e5d9782c4fb693d7ae7b',
  );
  expect(review.candidates.map((candidate) => candidate.externalKey)).toEqual(
    keys,
  );
  expect(
    review.candidates.filter((row) => row.disposition === 'held'),
  ).toHaveLength(97);
  expect(
    review.candidates.filter(
      (row) => row.disposition === 'explicitly-unsupported/prose-only',
    ),
  ).toHaveLength(3);
  for (const candidate of review.candidates) {
    const source = provenance.candidates.find(
      (row) => row.externalKey === candidate.externalKey,
    );
    expect(candidate.source.repo).toBe('pf1-content');
    expect(candidate.source.path).toBe(source?.source.path);
    expect(candidate.source.sha256).toBe(source?.source.sha256);
    expect(candidate.descriptionSha256).toBe(source?.descriptionSha256);
    const raw = await readFile(
      join(inputs.contentPath, candidate.source.path),
      'utf8',
    );
    expect(sha256(raw), candidate.name).toBe(candidate.source.sha256);
    const record = upstreamRecord.parse(parse(raw));
    expect(`pf1-content/${record._id}`).toBe(candidate.externalKey);
    expect(sha256(sourceDescription(record))).toBe(candidate.descriptionSha256);
    const assessment = reviewedAdmission.assessments.find(
      (row) => row.externalKey === candidate.externalKey,
    );
    expect(assessment).toMatchObject({
      status: candidate.assessmentStatus,
      reviewedBy: 'Sol (AI curator) for the owner',
      reviewedOn: '2026-10-08',
      requiredNotices: candidate.requiredNotices,
    });
    expect(assessment?.evidenceFingerprints).toHaveProperty(
      candidate.evidenceId,
    );
    const evidence = reviewedAdmission.evidence[candidate.evidenceId]?.content;
    expect(evidence).toContain(candidate.source.sha256);
    expect(evidence).toContain(candidate.source.location);
    expect(candidate.holdIds.length).toBeGreaterThan(0);
    expect(candidate.missingEvidence.length).toBeGreaterThan(0);
    expect(candidate.noticeRequirementsComplete).toBe(false);
    expect(entry(candidate.name).detail.repeatable).toBe('unreviewed');
    expect(candidate.mechanicsReview.sourceEvidence.sha256).toBe(
      candidate.source.sha256,
    );
  }
});

it('reproduces the reviewed numeric and note output with no missing required records from reduced fixtures', async () => {
  const artifact = await importCatalog(inputs);
  expect(artifact.catalog.entries).toHaveLength(100);
  const demonstrated = (row: {
    externalKey: string;
    name: string;
    modifiers: unknown;
    sources?: unknown;
    situationalNotes?: unknown;
    grantsSlots?: unknown;
  }) => ({
    externalKey: row.externalKey,
    name: row.name,
    modifiers: row.modifiers,
    sources: row.sources,
    situationalNotes: row.situationalNotes,
    grantsSlots: row.grantsSlots,
  });
  // Complete-checkout link and prerequisite resolution is preserved in the
  // preview; absent dependencies in reduced evidence are not filled in.
  expect(preview.entries.map(demonstrated)).toEqual(
    artifact.catalog.entries.map(demonstrated),
  );
  expect(artifact.curation.passed).toBe(true);
  expect(artifact.curation.summary).toMatchObject({
    required: 2,
    checked: 2,
    drafted: 0,
    missing: 0,
    descriptions: { candidates: 100, checked: 100, drafted: 0 },
  });
  expect(artifact.curation.summary.descriptions.drafted).toBe(0);
  expect(artifact.curation.summary.descriptions.checked).toBe(
    artifact.curation.summary.descriptions.candidates,
  );
  expect(artifact.curation.unresolvedMechanics).toEqual([]);
  for (const record of curation.records.filter((row) =>
    provenance.candidates.some(
      (candidate) => candidate.externalKey === row.externalKey,
    ),
  )) {
    expect(record.status).toBe('checked');
    expect(record.outputs).not.toContainEqual(
      expect.objectContaining({
        text: 'Review required: replace this placeholder with readable rules text or structured outputs.',
      }),
    );
  }
});

it('admits none of the real definitions and binds Sea Legs to its actual reviewed body', async () => {
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
  expect(gate.admitted).toEqual([]);
  const reported = new Set(
    [...gate.held, ...gate.failures, ...gate.dependentOmissions].map(
      (row) => row.externalKey,
    ),
  );
  for (const candidate of provenance.candidates)
    expect(reported.has(candidate.externalKey), candidate.externalKey).toBe(
      true,
    );
  const bound = catalogArtifact.catalog.entries.find(
    (row) => row.name === 'Sea Legs',
  );
  if (!bound) throw new Error('Missing Sea Legs body');
  expect(gate.held).toContainEqual(
    expect.objectContaining({ externalKey: bound.externalKey }),
  );
  const assessment = reviewedAdmission.assessments.find(
    (row) => row.externalKey === bound.externalKey,
  );
  if (!assessment) throw new Error('Missing Sea Legs assessment');
  const binding = buildAssessmentBinding({
    entry: bound,
    artifact: catalogArtifact,
    ...reviewedAdmission,
    requiredNotices: assessment.requiredNotices,
    evidenceIds: Object.keys(assessment.evidenceFingerprints),
  });
  expect(assessment).toMatchObject(binding);
  const changedBinding = buildAssessmentBinding({
    entry: { ...bound, description: `${bound.description}<p>Changed.</p>` },
    artifact: catalogArtifact,
    ...reviewedAdmission,
    requiredNotices: assessment.requiredNotices,
    evidenceIds: Object.keys(assessment.evidenceFingerprints),
  });
  expect(changedBinding.contentFingerprint).not.toBe(
    binding.contentFingerprint,
  );
});

it('applies Sea Legs +2 to all three named skills once in both public projections', () => {
  expect(entry('Sea Legs').description).toContain(
    'You gain a +2 bonus on Acrobatics, Climb, and Swim checks.',
  );
  const input = heldFeatSheet('Sea Legs');
  for (const projection of Object.values(
    calculateCharacterSheetProjections(input),
  )) {
    for (const target of ['skill.acr', 'skill.clm', 'skill.swm'] as const)
      expect(projection.breakdowns[target].total).toBe(2);
    expect(projection.breakdowns['skill.ste'].total).toBe(0);
  }
  const data = modifiers('Sea Legs');
  const copy = data.map((row) => ({
    ...row,
    sheetEntryId: 'sea-legs-copy',
    catalogEntryId: 'sea-legs-copy',
  }));
  for (const target of ['skill.acr', 'skill.clm', 'skill.swm'] as const)
    expect(resolveSheet([...data, ...copy])[target].total).toBe(2);
  const inactive = calculateCharacterSheetProjections({
    ...input,
    entries: input.entries.map((row) =>
      row.kind === 'feat' ? { ...row, active: false } : row,
    ),
  });
  for (const projection of Object.values(inactive))
    expect(projection.breakdowns['skill.acr'].total).toBe(0);
});

it('keeps Advanced Defensive Combat Training +4 on defensive CMD only', () => {
  expect(entry('Advanced Defensive Combat Training').description).toContain(
    'You gain a +4 bonus to your CMD.',
  );
  const data = modifiers('Advanced Defensive Combat Training');
  expect(resolveSheet(data).cmd.total).toBe(4);
  expect(resolveSheet(data).cmb.total).toBe(0);
  expect(resolveSheet(data)['ac.other'].total).toBe(0);
  for (const projection of Object.values(
    calculateCharacterSheetProjections(
      heldFeatSheet('Advanced Defensive Combat Training'),
    ),
  )) {
    expect(projection.derivedStatistics.cmd.total).toBe(14);
    expect(projection.derivedStatistics.cmb.total).toBe(0);
  }
});

it('limits Greater Uncivilized Tactics +2 to its offensive custom maneuver', () => {
  const feat = entry('Greater Uncivilized Tactics');
  expect(feat.description).toContain(
    'You gain a +2 bonus on checks to use Uncivilized Tactics.',
  );
  expect(feat.description).toContain(
    'stacks with the bonus granted by Improved Uncivilized Tactics',
  );
  const data = modifiers(feat.name);
  const situation = localSituation(feat.name, 'cmb');
  expect(situation.local).toMatch(
    /Uncivilized Tactics combat maneuver checks/i,
  );
  expect(resolveSheet(data).cmb.total).toBe(0);
  expect(resolveSheet(data, { situations: [situation] }).cmb.total).toBe(2);
  expect(resolveSheet(data, { situations: [situation] }).cmd.total).toBe(0);
  expect(resolveSheet(data, { situations: ['grapple'] }).cmb.total).toBe(0);
  expect(
    resolveSheet(data, {
      situations: [{ ...situation, sheetEntryId: 'another-feat' }],
    }).cmb.total,
  ).toBe(0);
});

it('limits Reach Defense +2 dodge to attacks of opportunity from nonadjacent opponents', () => {
  expect(entry('Reach Defense').description).toContain(
    '+2 dodge bonus to Armor Class against attacks of opportunity from opponents that are not adjacent to you',
  );
  const data = modifiers('Reach Defense');
  const situation = localSituation('Reach Defense', 'ac');
  expect(situation.local).toMatch(/attacks of opportunity/i);
  expect(situation.local).toMatch(/nonadjacent/i);
  expect(resolveSheet(data)['ac.other'].total).toBe(0);
  expect(
    resolveSheet(data, { situations: [situation] })['ac.other'].total,
  ).toBe(2);
  expect(
    resolveSheet(data, { situations: ['within30ft'] })['ac.other'].total,
  ).toBe(0);
  expect(
    resolveSheet(data, {
      situations: [{ ...situation, sheetEntryId: 'another-feat' }],
    })['ac.other'].total,
  ).toBe(0);
  const copied = data.map((row) => ({
    ...row,
    sheetEntryId: 'reach-defense-copy',
    catalogEntryId: 'reach-defense-copy',
  }));
  expect(
    resolveSheet([...data, ...copied], {
      situations: [
        situation,
        { ...situation, sheetEntryId: 'reach-defense-copy' },
      ],
    })['ac.other'].total,
  ).toBe(2);
  const projections = calculateCharacterSheetProjections(
    heldFeatSheet('Reach Defense'),
    {
      situations: [{ ...situation, sheetEntryId: 'feat-row' }],
    },
  );
  for (const projection of Object.values(projections)) {
    expect(projection.derivedStatistics.ac.total).toBe(12);
    expect(projection.derivedStatistics.touchAc.total).toBe(12);
    expect(projection.derivedStatistics.flatFootedAc.total).toBe(10);
  }
});

it('applies Focused Phantom +4 concentration once for its adjacent-or-consciousness condition', () => {
  expect(entry('Focused Phantom').description).toContain(
    'adjacent to your phantom or your phantom is within your consciousness',
  );
  expect(entry('Focused Phantom').description).toContain(
    '+4 bonus on concentration checks',
  );
  const data = modifiers('Focused Phantom');
  const situation = localSituation('Focused Phantom', 'concentration');
  expect(situation.local).toMatch(/adjacent.*or.*consciousness/i);
  expect(data.filter((row) => row.target === 'concentration')).toHaveLength(1);
  expect(resolveSheet(data).concentration.total).toBe(0);
  expect(
    resolveSheet(data, { situations: [situation, situation] }).concentration
      .total,
  ).toBe(4);
  expect(
    resolveSheet(data, { situations: ['spells'] }).concentration.total,
  ).toBe(0);
  expect(
    resolveSheet(data, { situations: [situation] }).casterLevel.total,
  ).toBe(0);
  expect(
    resolveSheet(data, {
      situations: [{ ...situation, sheetEntryId: 'another-feat' }],
    }).concentration.total,
  ).toBe(0);
});

it.each([
  [0, 2],
  [9, 2],
  [10, 4],
  [19, 4],
  [20, 4],
])(
  'uses Casual Illusionist level %i bonus +%i only while gnome magic remains unused',
  (level, bonus) => {
    expect(entry('Casual Illusionist').description).toContain(
      'At 10th level, these bonuses increase to +4.',
    );
    const data = modifiers('Casual Illusionist');
    const situation = localSituation('Casual Illusionist', 'skill.blf');
    expect(situation.local).toMatch(/gnome magic.*unused/i);
    for (const target of ['skill.blf', 'skill.dis', 'skill.slt'] as const) {
      expect(resolveSheet(data, { level })[target].total).toBe(0);
      expect(
        resolveSheet(data, { level, situations: [situation] })[target].total,
      ).toBe(bonus);
      expect(
        resolveSheet(data, {
          level,
          situations: [{ ...situation, sheetEntryId: 'another-feat' }],
        })[target].total,
      ).toBe(0);
      expect(
        resolveSheet(data, { level, situations: ['spells'] })[target].total,
      ).toBe(0);
    }
    expect(
      resolveSheet(data, { level, situations: [situation] })['skill.ste'].total,
    ).toBe(0);
    const copy = data.map((row) => ({
      ...row,
      sheetEntryId: 'illusionist-copy',
      catalogEntryId: 'illusionist-copy',
    }));
    expect(
      resolveSheet([...data, ...copy], {
        level,
        situations: [
          situation,
          { ...situation, sheetEntryId: 'illusionist-copy' },
        ],
      })['skill.blf'].total,
    ).toBe(bonus);
  },
);

it('applies Persuasive Bribery +2 Diplomacy once to bribery or conjured-creature bargaining', () => {
  const data = modifiers('Persuasive Bribery');
  const situation = localSituation('Persuasive Bribery', 'skill.dip');
  expect(situation.local).toMatch(/brib.*or.*conjured/i);
  expect(data.filter((row) => row.target === 'skill.dip')).toHaveLength(1);
  expect(resolveSheet(data)['skill.dip'].total).toBe(0);
  expect(
    resolveSheet(data, { situations: [situation, situation] })['skill.dip']
      .total,
  ).toBe(2);
  expect(
    resolveSheet(data, { situations: [situation] })['ability.cha'].total,
  ).toBe(0);
  expect(
    resolveSheet(data, { situations: ['spells'] })['skill.dip'].total,
  ).toBe(0);
  expect(
    resolveSheet(data, {
      situations: [{ ...situation, sheetEntryId: 'another-feat' }],
    })['skill.dip'].total,
  ).toBe(0);
  expect(entry('Persuasive Bribery').situationalNotes).toContainEqual(
    expect.objectContaining({
      text: expect.stringMatching(/Charisma checks/i),
    }),
  );
});

it('preserves source prerequisite clauses while reporting unsupported and incorrectly grouped atoms as outstanding', () => {
  const counter = importedCatalogEntrySchema.parse(entry('Counter Reflexes'));
  expect(counter.prerequisiteText).toContain(
    'base attack bonus +9, brawler level 6th, or monk level 6th',
  );
  expect(counter.prerequisites).toContainEqual({
    anyOf: [
      { bab: 9, kind: 'bab' },
      { classLevel: 'pf1/iDlGMIezGuqqt8Us', min: 6, kind: 'classLevel' },
      { classLevel: 'pf1/W8dxwZ1CZiwLKsqr', min: 6, kind: 'classLevel' },
    ],
  });
  const silent = importedCatalogEntrySchema.parse(entry('Silent Kill'));
  expect(silent.prerequisiteText).toContain(
    'assassinate advanced slayer talent or ninja master trick',
  );
  expect(silent.prerequisites).toContainEqual({
    unchecked: 'assassinate advanced slayer talent or ninja master trick',
    kind: 'unchecked',
  });
  const warleader = importedCatalogEntrySchema.parse(entry("Warleader's Rage"));
  expect(warleader.prerequisiteText).toContain('non-lawful');
  expect(warleader.prerequisites).toContainEqual({
    unchecked: 'non-lawful',
    kind: 'unchecked',
  });
  const seaLegs = importedCatalogEntrySchema.parse(entry('Sea Legs'));
  expect(seaLegs.prerequisites).toContainEqual({
    unchecked: 'Profession (sailor) 5 ranks',
    kind: 'unchecked',
  });
  for (const [name, gap] of [
    ['Counter Reflexes', /alternative|conjunction|\bOR\b/i],
    ['Silent Kill', /assassinate|advanced.*slayer|ninja.*master/i],
    ["Warleader's Rage", /non-lawful|alignment/i],
    ['Sea Legs', /Profession|sailor/i],
  ] as const) {
    const candidate = review.candidates.find((row) => row.name === name);
    expect(candidate?.mechanicsReview.mappedFacts.prerequisiteText).toBe(
      entry(name).prerequisiteText,
    );
    expect(
      candidate?.mechanicsReview.outstandingMechanics.join(' '),
      name,
    ).toMatch(gap);
  }
});

it('keeps the three Mythic definitions prose-only without activating their mechanics', () => {
  for (const name of [
    'Elemental Channel (Mythic)',
    'Combat Reflexes (Mythic)',
    'Deceitful (Mythic)',
  ]) {
    const feat = entry(name);
    expect(feat.modifiers).toEqual([]);
    expect(feat.description).toMatch(/mythic power/i);
    expect(review.candidates.find((row) => row.name === name)).toMatchObject({
      disposition: 'explicitly-unsupported/prose-only',
      assessmentStatus: 'unresolved',
    });
  }
});

it('leaves Aberration-Bane Caster favored-enemy calculations outstanding despite complete required-note bindings', () => {
  const feat = entry('Aberration-Bane Caster');
  expect(feat.description).toMatch(
    /half of your favored enemy bonus against aberrations/i,
  );
  expect(modifiers(feat.name)).toEqual([]);
  expect(resolveSheet(modifiers(feat.name)).spellDC.total).toBe(0);
  expect(
    resolveSheet(modifiers(feat.name), { situations: ['spellResistance'] })
      .casterLevel.total,
  ).toBe(0);
  expect(feat.situationalNotes).toContainEqual(
    expect.objectContaining({
      text: expect.stringMatching(/aberrations.*favored[- ]enemy/i),
    }),
  );
  const required = curation.records.filter(
    (row) => row.externalKey === feat.externalKey && row.kind === 'note',
  );
  expect(required).toHaveLength(2);
  expect(required.every((row) => row.status === 'checked')).toBe(true);
  expect(
    review.candidates
      .find((row) => row.name === feat.name)
      ?.mechanicsReview.outstandingMechanics.join(' '),
  ).toMatch(/favored.enemy/i);
});

it("preserves first-attack timing for Sword's Shadow and target-turn timing for Raking Claws", () => {
  const sword = entry("Sword's Shadow");
  expect(sword.description).toContain(
    'successfully damage an enemy with the first attack of a full attack',
  );
  const swordNotes = sword.situationalNotes?.map((row) => row.text).join(' ');
  expect(swordNotes).toMatch(/first attack.*full attack/i);
  expect(swordNotes).not.toMatch(/first hit/i);
  expect(swordNotes).toMatch(/immediate[- ]action/i);
  expect(swordNotes).toMatch(/next attack/i);
  const claws = entry('Raking Claws');
  expect(claws.description).toContain('at the start of his turn each round');
  const clawNotes = claws.situationalNotes?.map((row) => row.text).join(' ');
  expect(clawNotes).toMatch(/1d6.*bleed/i);
  expect(clawNotes).toMatch(
    /start of (?:the |its |his )?(?:target|opponent)[’']s turn/i,
  );
  expect(clawNotes).toMatch(/DC 15.*Heal.*magical healing/i);
  expect(claws.modifiers).toEqual([]);
});

it('caps only the Saddle Shrieker mount bonus while its rider penalty continues to increase', () => {
  const saddle = entry('Saddle Shrieker');
  expect(saddle.description).toContain(
    "this penalty increases by -1 and the bonus to your mount's attack and damage increases by +1 to a maximum of +5",
  );
  const notes = saddle.situationalNotes?.map((row) => row.text).join(' ');
  expect(notes).toMatch(/your penalty increases by [-−]1/i);
  expect(notes).toMatch(/only the mount[’']s bonus capped at \+5/i);
  expect(notes).toMatch(/BAB \+4.*each \+4/i);
  expect(
    modifiers(saddle.name)
      .map((row) => row.target)
      .sort(),
  ).toEqual(['attack', 'cmb']);
  expect(
    review.candidates
      .find((row) => row.name === saddle.name)
      ?.mechanicsReview.outstandingMechanics.join(' '),
  ).toMatch(/mount/i);
});

it.each([
  [0, -1],
  [3, -1],
  [4, -2],
  [16, -5],
  [19, -5],
  [20, -6],
  [24, -7],
])(
  'applies Saddle Shrieker rider penalty %i BAB → %i without capping at the mount bonus',
  (bab, penalty) => {
    const data = modifiers('Saddle Shrieker');
    const situation = localSituation('Saddle Shrieker', 'attack');
    expect(situation.local).toMatch(
      /choosing Saddle Shrieker before attacking/i,
    );
    const rider = [
      ...data,
      {
        target: 'bab' as const,
        bonusType: 'base' as const,
        value: bab,
        sheetEntryId: 'fixture-bab',
        catalogEntryId: 'fixture-bab',
        entryName: 'Fixture BAB',
        source: 'fixture-bab',
        builtIn: false,
      },
    ];
    for (const target of ['attack.melee', 'attack.ranged', 'cmb'] as const) {
      expect(resolveSheet(rider)[target].total).toBe(0);
      expect(
        resolveSheet(rider, { situations: [situation] })[target].total,
      ).toBe(penalty);
      expect(
        resolveSheet(rider, { situations: ['mounted'] })[target].total,
      ).toBe(0);
      expect(
        resolveSheet(rider, {
          situations: [{ ...situation, sheetEntryId: 'another-feat' }],
        })[target].total,
      ).toBe(0);
    }
    expect(
      resolveSheet(rider, { situations: [situation] })['damage.melee'].total,
    ).toBe(0);
    expect(
      resolveSheet(rider, { situations: [situation] })['damage.ranged'].total,
    ).toBe(0);
  },
);
