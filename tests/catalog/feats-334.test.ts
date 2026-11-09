// @vitest-environment node
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import review from '../../scripts/catalog/legal/feats-334.json';
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
import provenance from '../fixtures/feats-334/provenance.json';
import preview from '../fixtures/feats-334/preview.json';
import { heldFeatSheet } from '../fixtures/feats-334/sheet';

const fixtureRoot = resolve('tests/fixtures/feats-334');
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
    '630002ac9200d13e28956762984a9e5809b3f29dcf429dd0fb5999bbcd818aa2',
  );
  expect(review.candidates.map((candidate) => candidate.externalKey)).toEqual(
    keys,
  );
  expect(review.candidates.every((row) => row.disposition === 'held')).toBe(
    true,
  );
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
      status: 'unresolved',
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
    required: 0,
    checked: 0,
    drafted: 0,
    missing: 0,
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

it('admits none of the held real definitions and binds Storm-Lashed to its actual reviewed body', async () => {
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
    (row) => row.name === 'Storm-Lashed',
  );
  if (!bound) throw new Error('Missing Storm-Lashed body');
  expect(gate.held).toContainEqual(
    expect.objectContaining({ externalKey: bound.externalKey }),
  );
  const assessment = reviewedAdmission.assessments.find(
    (row) => row.externalKey === bound.externalKey,
  );
  if (!assessment) throw new Error('Missing Storm-Lashed assessment');
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

it('limits Storm-Lashed +2 saves to electricity descriptor or damage and keeps weather replacement penalties out of additive totals', () => {
  const data = modifiers('Storm-Lashed');
  const situation = localSituation('Storm-Lashed', 'saves');
  expect(situation.local).toMatch(/electricity/i);
  expect(situation.local).toMatch(/descriptor|damage/i);
  for (const target of ['save.fort', 'save.ref', 'save.will'] as const) {
    expect(resolveSheet(data)[target].total).toBe(0);
    expect(resolveSheet(data, { situations: [situation] })[target].total).toBe(
      2,
    );
    expect(
      resolveSheet(data, {
        situations: [{ ...situation, sheetEntryId: 'other-entry' }],
      })[target].total,
    ).toBe(0);
    expect(resolveSheet(data, { situations: ['spells'] })[target].total).toBe(
      0,
    );
  }
  expect(resolveSheet(data)['skill.per'].total).toBe(0);
  expect(entry('Storm-Lashed').situationalNotes).toContainEqual(
    expect.objectContaining({
      text: expect.stringMatching(/[-−]2.*Perception/i),
    }),
  );
  const input = heldFeatSheet('Storm-Lashed');
  const ordinary = calculateCharacterSheetProjections(input);
  const conditional = calculateCharacterSheetProjections(input, {
    situations: [{ ...situation, sheetEntryId: 'feat-row' }],
  });
  for (const projection of [ordinary.current, ordinary.permanent])
    expect(projection.derivedStatistics.fortitude.total).toBe(2);
  for (const projection of [conditional.current, conditional.permanent]) {
    expect(projection.derivedStatistics.fortitude.total).toBe(4);
    expect(projection.derivedStatistics.reflex.total).toBe(2);
    expect(projection.derivedStatistics.will.total).toBe(2);
  }
  const copied = data.map((row) => ({
    ...row,
    sheetEntryId: 'copy-row',
    catalogEntryId: 'copy',
  }));
  expect(
    resolveSheet([...data, ...copied], {
      situations: [situation, { ...situation, sheetEntryId: 'copy-row' }],
    })['save.fort'].total,
  ).toBe(2);
});

it.each(['bull rush', 'grapple', 'overrun', 'reposition', 'trip'])(
  'uses Feline Grace +2 CMD only against %s and never for the offensive maneuver',
  (maneuver) => {
    const data = modifiers('Feline Grace');
    const situation = {
      local: `vs. ${maneuver}`,
      sheetEntryId: entry('Feline Grace').externalKey,
    };
    expect(resolveSheet(data).cmd.total).toBe(0);
    expect(resolveSheet(data, { situations: [situation] }).cmd.total).toBe(2);
    expect(resolveSheet(data, { situations: [situation] }).cmb.total).toBe(0);
    const shared = maneuver === 'bull rush' ? 'bullRush' : maneuver;
    expect(resolveSheet(data, { situations: [shared] }).cmd.total).toBe(0);
    expect(
      resolveSheet(data, {
        situations: [{ ...situation, sheetEntryId: 'another-feat' }],
      }).cmd.total,
    ).toBe(0);
    expect(
      resolveSheet(data, {
        situations: [
          situation,
          { local: 'vs. grapple', sheetEntryId: situation.sheetEntryId },
        ],
      }).cmd.total,
    ).toBe(2);
  },
);

it('limits Flame Heart caster level and Elemental Focus DC to their chosen Situations without inventing unconditional levels or energy choices', () => {
  const fire = modifiers('Flame Heart');
  const fireSituation = localSituation('Flame Heart', 'casterLevel');
  expect(fireSituation.local).toBe(
    'when casting spells with the fire descriptor',
  );
  expect(resolveSheet(fire).casterLevel.total).toBe(0);
  expect(
    resolveSheet(fire, { situations: [fireSituation] }).casterLevel.total,
  ).toBe(1);
  expect(resolveSheet(fire, { situations: ['spells'] }).casterLevel.total).toBe(
    0,
  );
  expect(entry('Flame Heart').situationalNotes).toContainEqual(
    expect.objectContaining({
      text: expect.stringContaining('fire resistance 5'),
    }),
  );
  const elemental = modifiers('Elemental Focus');
  const chosenEnergy = localSituation('Elemental Focus', 'spellDC');
  expect(chosenEnergy.local).toBe(
    'for damaging spells of your chosen energy type: acid, cold, electricity, or fire',
  );
  expect(resolveSheet(elemental).spellDC.total).toBe(0);
  expect(
    resolveSheet(elemental, { situations: [chosenEnergy] }).spellDC.total,
  ).toBe(1);
  const copy = elemental.map((row) => ({
    ...row,
    sheetEntryId: 'elemental-copy',
    catalogEntryId: 'elemental-copy',
  }));
  expect(
    resolveSheet([...elemental, ...copy], {
      situations: [
        chosenEnergy,
        { ...chosenEnergy, sheetEntryId: 'elemental-copy' },
      ],
    }).spellDC.total,
  ).toBe(1);
  expect(
    resolveSheet(elemental, { situations: ['spells'] }).spellDC.total,
  ).toBe(0);
  expect(entry('Elemental Focus').detail.repeatable).toBe('unreviewed');
  expect(entry('Elemental Focus').situationalNotes).toContainEqual(
    expect.objectContaining({ text: expect.stringMatching(/do not stack/) }),
  );
});

it('grants the actual Additional Traits two-slot allowance in both projections while its definition remains held', () => {
  const additional = importedCatalogEntrySchema.parse(
    entry('Additional Traits'),
  );
  expect(additional.detail).toMatchObject({ additionalTraits: true });
  expect(additional.grantsSlots).toEqual([{ kind: 'trait', count: 2 }]);
  const input = heldFeatSheet('Additional Traits');
  const selected = calculateCharacterSheetProjections(input);
  for (const projection of [selected.current, selected.permanent])
    expect(projection.selectionRules.slots).toContainEqual(
      expect.objectContaining({
        kind: 'trait',
        count: 2,
        grantedBy: { kind: 'entry', entryId: 'feat-row' },
      }),
    );
  const inactive = calculateCharacterSheetProjections({
    ...input,
    entries: input.entries.map((row) =>
      row.kind === 'feat' ? { ...row, active: false } : row,
    ),
  });
  for (const projection of [inactive.current, inactive.permanent])
    expect(
      projection.selectionRules.slots.filter((slot) => slot.grantedBy),
    ).toEqual([]);
  expect(
    review.candidates.find((row) => row.name === 'Additional Traits'),
  ).toMatchObject({ disposition: 'held' });
});

it('preserves real feat prerequisites and leaves rank-dependent Explorer calculations outstanding', () => {
  const feline = importedCatalogEntrySchema.parse(entry('Feline Grace'));
  expect(feline.prerequisites).toContainEqual({
    ability: 'dexterity',
    min: 13,
    kind: 'ability',
  });
  expect(feline.prerequisiteText).toMatch(/catfolk/i);
  const abeyance = importedCatalogEntrySchema.parse(entry('Abeyance'));
  expect(abeyance.prerequisites).toContainEqual({
    ability: 'intelligence',
    min: 13,
    kind: 'ability',
  });
  expect(abeyance.prerequisites).toContainEqual({
    skillRanks: 'skill.spl',
    min: 5,
    kind: 'skillRanks',
  });
  expect(modifiers('Explorer')).toEqual([]);
  const explorer = review.candidates.find((row) => row.name === 'Explorer');
  expect(explorer?.mechanicsReview.outstandingMechanics.join(' ')).toMatch(
    /rank|formula|skill/i,
  );
  expect(entry('Explorer').description).toMatch(/\+2/);
  expect(entry('Explorer').description).toMatch(/\+4/);
  const jumper = importedCatalogEntrySchema.parse(entry('Jumper'));
  expect(jumper.prerequisites).toContainEqual({
    skillRanks: 'skill.acr',
    min: 1,
    kind: 'skillRanks',
  });
  expect(jumper.prerequisites).toContainEqual({
    unchecked: 'creature type other than humanoid or outsider',
    kind: 'unchecked',
  });
  // The source excludes both creature types despite its Human tag. Keep the
  // unresolved exclusion together so neither fragment can qualify alone.
  expect(jumper.description).toMatch(
    /creature type other than humanoid or outsider/,
  );
  const jumperReview = review.candidates.find((row) => row.name === 'Jumper');
  expect(jumperReview?.mechanicsReview.outstandingMechanics.join(' ')).toMatch(
    /creature|humanoid|outsider/i,
  );
});

it('binds the #334 follow-up +5, +2 and +4 only to their exact source conditions', () => {
  const wary = modifiers('Wary Smuggler');
  const conceal = localSituation('Wary Smuggler', 'skill.slt');
  expect(conceal.local).toMatch(/small, non-weapon/);
  expect(conceal.local).toMatch(/animal or vehicle/);
  expect(resolveSheet(wary)['skill.slt'].total).toBe(0);
  expect(resolveSheet(wary, { situations: [conceal] })['skill.slt'].total).toBe(
    5,
  );
  expect(
    resolveSheet(wary, { situations: [{ ...conceal, sheetEntryId: 'other' }] })[
      'skill.slt'
    ].total,
  ).toBe(0);
  expect(resolveSheet(wary, { situations: [conceal] })['skill.ste'].total).toBe(
    0,
  );
  expect(entry('Wary Smuggler').situationalNotes).toContainEqual(
    expect.objectContaining({ text: expect.stringMatching(/urban.*take 10/) }),
  );
  const oath = modifiers('Oath of the Unbound');
  const escape = localSituation('Oath of the Unbound', 'cmb');
  const entangle = localSituation('Oath of the Unbound', 'saves');
  expect(escape.local).toBe('to break free of a grapple or pin');
  expect(entangle.local).toMatch(/entangle or slow/);
  expect(resolveSheet(oath).cmb.total).toBe(0);
  expect(resolveSheet(oath, { situations: [escape] }).cmb.total).toBe(2);
  expect(resolveSheet(oath, { situations: ['grapple'] }).cmb.total).toBe(0);
  expect(resolveSheet(oath, { situations: [entangle] }).cmb.total).toBe(0);
  expect(resolveSheet(oath)['ability.str'].total).toBe(0);
  const desert = modifiers('Desert Dweller');
  const glare = localSituation('Desert Dweller', 'saves');
  expect(glare.local).toMatch(/blinded or dazzled by glare/);
  expect(glare.local).toMatch(/desert mirage/);
  expect(resolveSheet(desert)['ability.con'].total).toBe(0);
  for (const target of ['save.fort', 'save.ref', 'save.will'] as const) {
    expect(resolveSheet(oath)[target].total).toBe(0);
    expect(resolveSheet(oath, { situations: [entangle] })[target].total).toBe(
      2,
    );
    expect(resolveSheet(oath, { situations: ['spells'] })[target].total).toBe(
      0,
    );
    expect(resolveSheet(desert)[target].total).toBe(0);
    expect(resolveSheet(desert, { situations: [glare] })[target].total).toBe(4);
    expect(
      resolveSheet(desert, { situations: ['illusions'] })[target].total,
    ).toBe(0);
    expect(
      resolveSheet(desert, {
        situations: [{ ...glare, sheetEntryId: 'other' }],
      })[target].total,
    ).toBe(0);
  }
  for (const name of [
    'Wary Smuggler',
    'Oath of the Unbound',
    'Desert Dweller',
  ]) {
    expect(
      review.candidates.find((row) => row.name === name)?.mechanicsReview
        .descriptionPass,
    ).toBe(true);
    expect(
      review.candidates
        .find((row) => row.name === name)
        ?.mechanicsReview.outstandingMechanics.join(' '),
    ).not.toMatch(/no eligible|no.*binding/);
  }
  expect(
    review.candidates
      .find((row) => row.name === 'Oath of the Unbound')
      ?.mechanicsReview.outstandingMechanics.join(' '),
  ).toMatch(/Strength checks/);
  expect(
    review.candidates
      .find((row) => row.name === 'Desert Dweller')
      ?.mechanicsReview.outstandingMechanics.join(' '),
  ).toMatch(/Constitution checks/);
});
