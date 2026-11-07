// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import review from '../../scripts/catalog/legal/feats-342.json';
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
  builtIn,
  resolveSheet,
  calculateCharacterSheetProjections,
} from '../../src/lib/character-sheet';
import preview from '../fixtures/feats-342/preview.json';
import provenance from '../fixtures/feats-342/provenance.json';
import { reviewedFeatSheet } from '../fixtures/feats-342/sheet';
import { expectAutomaticSkillFocus } from './skill-focus-assertions';

const fixtureRoot = resolve('tests/fixtures/feats-342');
const inputs = {
  systemPath: join(fixtureRoot, 'pf1'),
  contentPath: join(fixtureRoot, 'pf1-content'),
  remaps: [],
  curation: reviewedCuration,
};
const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');
function entry(name: string) {
  const found = preview.entries.find((row) => row.name === name);
  if (!found) throw new Error(`Missing feat ${name}`);
  return found;
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
function situation(name: string, value: number) {
  const found = modifiers(name).find((row) => row.value === value)?.condition
    ?.situation;
  if (typeof found !== 'object' || !('local' in found))
    throw new Error('Missing local Situation');
  return { ...found, sheetEntryId: entry(name).externalKey };
}

it('accounts for exactly the 100 ticket keys, source bytes and complete mechanical records', async () => {
  const keys = provenance.candidates.map((row) => row.externalKey);
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(sha256(keys.join('\n'))).toBe(
    'aa926bab4c697295fee06b30cccd2f20ec7e782522fefbe3e51b5a6ee34600eb',
  );
  expect(review.candidates.map((row) => row.externalKey)).toEqual(keys);
  expect(preview.entries.map((row) => row.externalKey)).toEqual(keys);
  expect(review.counts).toMatchObject({
    total: 100,
    admitted: 2,
    held: 98,
    excluded: 0,
    unsupportedProseOnly: 0,
  });
  for (const candidate of review.candidates) {
    const raw = await readFile(
      join(inputs.contentPath, candidate.source.path),
      'utf8',
    );
    expect(sha256(raw), candidate.name).toBe(candidate.source.sha256);
    const source = upstreamRecord.parse(parse(raw));
    expect(source.name).toBe(candidate.name);
    expect(`pf1-content/${source._id}`).toBe(candidate.externalKey);
    expect(sha256(sourceDescription(source))).toBe(candidate.descriptionSha256);
    expect(candidate.mechanicsReview.descriptionText).toBe(
      sourceDescription(source),
    );
    expect(candidate.mechanicsReview.mappedFacts.sources).toEqual(
      entry(candidate.name).sources,
    );
    expect(candidate.mechanicsReview.mappedFacts.modifiers).toEqual(
      entry(candidate.name).modifiers,
    );
    expect(candidate.mechanicsReview.mappedFacts.prerequisites).toEqual(
      entry(candidate.name).prerequisites ?? [],
    );
    expect(candidate.mechanicsReview.curationRecords).toEqual(
      reviewedCuration.records.filter(
        (row) => row.externalKey === candidate.externalKey,
      ),
    );
    expect(candidate.mechanicsReview.completeCalculation).toBe(
      candidate.mechanicsReview.outstandingCalculations.length === 0,
    );
    const assessment = reviewedAdmission.assessments.find(
      (row) => row.externalKey === candidate.externalKey,
    );
    expect(assessment).toMatchObject({
      status: candidate.assessmentStatus,
      // #724 re-bound the admitted Skill Focus assessments.
      reviewedBy: candidate.name.startsWith('Skill Focus (')
        ? 'Opus (AI curator) for the owner'
        : 'Sol (AI curator) for the owner',
      reviewedOn: candidate.name.startsWith('Skill Focus (')
        ? '2026-10-14'
        : '2026-10-08',
      requiredNotices: candidate.requiredNotices,
    });
    expect(reviewedAdmission.evidence[candidate.evidenceId]?.content).toContain(
      candidate.source.sha256,
    );
    if (candidate.disposition === 'held')
      expect(candidate.holdIds).toHaveLength(1);
  }
});

it('reproduces the reduced import, checked prose pass and current complete-source attribution bindings', async () => {
  const artifact = await importCatalog(inputs);
  expect(artifact.curation.passed).toBe(true);
  expect(artifact.curation.summary.required).toBe(0);
  expect(artifact.curation.summary.missing).toBe(0);
  expect(artifact.curation.summary.descriptions.checked).toBe(100);
  expect(artifact.curation.summary.descriptions.drafted).toBe(0);
  expect(artifact.curation.unresolvedMechanics).toEqual([]);
  for (const row of artifact.catalog.entries) {
    const full = entry(row.name);
    expect(row.modifiers).toEqual(full.modifiers);
    expect(row.situationalNotes).toEqual(full.situationalNotes);
    expect(row.sources).toEqual([]);
  }
  // Reduced sources cannot resolve prerequisite bodies outside this batch.
  // Bind/admit only the committed full-source normalized bodies.
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
  expect(gate.admitted.map((row) => row.name).sort()).toEqual([
    'Skill Focus (Disable Device)',
    'Skill Focus (Handle Animal)',
  ]);
  expect(gate.held).toHaveLength(98);
  expect(gate.dependentOmissions).toEqual([]);
  for (const row of bound.catalog.entries) {
    const candidate = review.candidates.find(
      (c) => c.externalKey === row.externalKey,
    );
    if (!candidate) throw new Error('Missing review');
    const binding = buildAssessmentBinding({
      entry: row,
      artifact: bound,
      ...reviewedAdmission,
      requiredNotices: candidate.requiredNotices,
      evidenceIds: [candidate.evidenceId],
    });
    expect(
      reviewedAdmission.assessments.find(
        (c) => c.externalKey === row.externalKey,
      ),
    ).toMatchObject(binding);
    if (row.name === 'Skill Focus (Handle Animal)') {
      const changed = buildAssessmentBinding({
        entry: { ...row, description: row.description + ' changed' },
        artifact: bound,
        ...reviewedAdmission,
        requiredNotices: candidate.requiredNotices,
        evidenceIds: [candidate.evidenceId],
      });
      expect(changed.contentFingerprint).not.toBe(binding.contentFingerprint);
    }
  }
});

it('enforces all inherited notice minima, Combat Tricks and literal supporting snapshots', async () => {
  expect(review.inheritedNoticeAudit.descriptionsReviewed).toBe(100);
  expect(review.inheritedNoticeAudit.recordLevel35Tags).toEqual([]);
  for (const candidate of review.candidates) {
    for (const inherited of candidate.inheritedRuleNotices)
      expect(candidate.requiredNotices, candidate.name).toContain(
        inherited.book,
      );
    if (candidate.mechanicsReview.descriptionText.includes('Combat Trick'))
      expect(candidate.requiredNotices).toContain('PZO1131');
    for (const source of candidate.inheritedRuleSourceEvidence) {
      const text = await readFile(
        join(fixtureRoot, source.fixturePath),
        'utf8',
      );
      expect(sha256(text)).toBe(source.sha256);
    }
  }
  for (const notice of review.noticeRequirements) {
    if (!notice.holdId) continue;
    expect(heldNotices.find((hold) => hold.id === notice.holdId)).toMatchObject(
      {
        notices: expect.arrayContaining([notice.book, ...notice.registryKeys]),
        evidence: expect.arrayContaining([
          'scripts/catalog/legal/feats-342.json',
        ]),
      },
    );
  }
  expect(
    review.candidates.find((row) => row.name === 'Shatterspell')
      ?.requiredNotices,
  ).toEqual(expect.arrayContaining(['PZO1118', 'PZO1131']));
  expect(
    review.candidates.find((row) => row.name === 'Wyvaran Spellcasting')
      ?.requiredNotices,
  ).toEqual(
    expect.arrayContaining(['PZO1110', 'PZO9226', 'PZO9267', 'PZO9280']),
  );
  expect(
    review.candidates.find((row) => row.name === 'Strange Yield')
      ?.requiredNotices,
  ).toEqual(expect.arrayContaining(['PZO1123', 'PZO1140']));
});

// #724: the rank threshold is automatic, read from the skill's recorded ranks.
it.each([
  ['Skill Focus (Handle Animal)', 'skill.han'],
  ['Skill Focus (Disable Device)', 'skill.dev'],
] as const)(
  'gives %s +3, or +6 at 10 ranks, without a Situation or a stacking same-Source copy',
  (name, target) => {
    expectAutomaticSkillFocus({ modifiers: modifiers(name), target });
  },
);

it('uses shared trip and complete local hanging Situations for Tree Hanger CMD', () => {
  const data = modifiers('Tree Hanger');
  expect(resolveSheet(data).cmd.total).toBe(0);
  expect(resolveSheet(data, { situations: ['trip'] }).cmd.total).toBe(2);
  expect(
    resolveSheet(data, { situations: ['bullRush', 'drag', 'reposition'] }).cmd
      .total,
  ).toBe(0);
  for (const row of data.filter(
    (row) => typeof row.condition?.situation === 'object',
  )) {
    const local = row.condition?.situation;
    if (!local || typeof local !== 'object' || !('local' in local))
      throw new Error('Missing hanging Situation');
    expect(local.local).toMatch(/hanging by the tail/);
    expect(
      resolveSheet(data, {
        situations: [
          { ...local, sheetEntryId: entry('Tree Hanger').externalKey },
        ],
      }).cmd.total,
    ).toBe(2);
  }
});

it('pins Snake Style ordinary Sense Motive and Jackal Heritage mind-affecting saves', () => {
  expect(resolveSheet(modifiers('Snake Style'))['skill.sen'].total).toBe(2);
  const jackal = modifiers('Jackal Heritage');
  expect(resolveSheet(jackal)['skill.per'].total).toBe(2);
  expect(resolveSheet(jackal)['save.will'].total).toBe(0);
  for (const target of ['save.fort', 'save.ref', 'save.will'] as const)
    expect(
      resolveSheet(jackal, { situations: ['mindAffecting'] })[target].total,
    ).toBe(2);
});

it('limits Crane Wing to its full defense circumstance and Stock-Striker to its prone maneuver', () => {
  const crane = modifiers('Crane Wing');
  const defensive = situation('Crane Wing', 4);
  expect(defensive.local).toMatch(/aware.*not flat-footed/);
  expect(defensive.local).toMatch(/beginning of your next turn/);
  expect(resolveSheet(crane)['ac.other'].total).toBe(0);
  expect(
    resolveSheet(crane, { situations: [defensive] })['ac.other'].total,
  ).toBe(4);
  expect(
    resolveSheet(crane, { situations: ['fighting-defensively'] })['ac.other']
      .total,
  ).toBe(0);
  const stock = modifiers('Stock-Striker Style');
  for (const row of stock.filter((row) => row.target === 'cmb')) {
    const local = row.condition?.situation;
    if (typeof local !== 'object' || !('local' in local))
      throw new Error('Missing pistol-whip Situation');
    expect(local.local).toMatch(/knock the target prone/);
    expect(resolveSheet(stock).cmb.total).toBe(0);
    expect(
      resolveSheet(stock, {
        situations: [
          { ...local, sheetEntryId: entry('Stock-Striker Style').externalKey },
        ],
      }).cmb.total,
    ).toBe(row.value);
  }
});

it('calculates the reviewed BAB and level schedules only in their complete Situations', () => {
  for (const [name, target] of [
    ['Cunning Killer', 'damage.melee'],
    ['Intense Blows', 'cmd'],
  ] as const) {
    const data = modifiers(name);
    const local = data[0]?.condition?.situation;
    if (typeof local !== 'object' || !('local' in local))
      throw new Error('Missing complete Situation');
    for (let bab = 0; bab <= 20; bab++) {
      const baseline = builtIn({
        target: 'bab',
        id: 'bab',
        name: 'BAB',
        value: bab,
      });
      const rows = [...data, baseline];
      expect(resolveSheet(rows)[target].total).toBe(0);
      const expected =
        name === 'Cunning Killer'
          ? Math.min(4, 1 + Math.floor(bab / 6))
          : 1 + Math.floor(bab / 4);
      expect(
        resolveSheet(rows, {
          situations: [{ ...local, sheetEntryId: entry(name).externalKey }],
        })[target].total,
      ).toBe(expected);
    }
  }
  const data = modifiers('Strength in Defeat');
  const local = data[0]?.condition?.situation;
  if (typeof local !== 'object' || !('local' in local))
    throw new Error('Missing HP Situation');
  for (let level = 1; level <= 20; level++) {
    expect(resolveSheet(data, { level })['attack.melee'].total).toBe(0);
    expect(
      resolveSheet(data, {
        level,
        situations: [
          { ...local, sheetEntryId: entry('Strength in Defeat').externalKey },
        ],
      })['attack.melee'].total,
    ).toBe(level >= 15 ? 3 : level >= 8 ? 2 : 1);
  }
});

it('reports contradictory Bag of Bones and Ability Mastery raw grants without guessing corrections', () => {
  const bones = review.candidates.find((row) => row.name === 'Bag of Bones');
  expect(bones?.mechanicsReview.descriptionText).toMatch(
    /\+5 competence.*increases to \+4/,
  );
  expect(entry('Bag of Bones').modifiers).toEqual([]);
  expect(bones?.mechanicsReview.outstandingCalculations.join(' ')).toMatch(
    /contradictory/,
  );
  const mastery = review.candidates.find(
    (row) => row.name === 'Ability Mastery',
  );
  expect(mastery?.mechanicsReview.outstandingCalculations.join(' ')).toMatch(
    /Raw unconditional.*Strength contradicts/,
  );
  expect(entry('Ability Mastery').modifiers).toContainEqual(
    expect.objectContaining({
      target: 'ability.str',
      value: 2,
      bonusType: 'enhancement',
    }),
  );
});

it('preserves supported prerequisite thresholds and names the uncorrected alternatives', () => {
  expect(entry('Confusing Stare').prerequisites).toContainEqual({
    kind: 'classLevel',
    classLevel: 'pf1/fLU25FvuRWMCSxPP',
    min: 7,
  });
  expect(entry('Cartogramancer').prerequisites).toContainEqual({
    kind: 'skillRanks',
    skillRanks: 'skill.kge',
    min: 10,
  });
  expect(entry('Shatterspell').prerequisites).toContainEqual({
    kind: 'classLevel',
    classLevel: 'pf1/WLqBCT5DqmGAx8Wd',
    min: 10,
  });
  expect(entry('Redistributed Might').prerequisites).toContainEqual({
    kind: 'proficiency',
    proficiency: { baseType: 'Aldori dueling sword' },
  });
  expect(
    review.candidates.find((row) => row.name === 'Redistributed Might')
      ?.mechanicsReview.proficiencyFacts,
  ).toEqual([]);
  for (const name of [
    'Elemental Jaunt',
    'Jabbing Dancer',
    'Diplomatic Ruse',
    'Ritual Mask',
  ])
    expect(
      review.candidates.find((row) => row.name === name)?.mechanicsReview
        .prerequisiteCorrectionsNeeded.length,
    ).toBeGreaterThan(0);
});

it('feeds real reviewed bodies through the public current/permanent sheet resolver', () => {
  const projections = calculateCharacterSheetProjections(
    reviewedFeatSheet('Skill Focus (Handle Animal)'),
  );
  // #724: no ranks and Charisma 10, so Skill Focus's +3 applies at once.
  expect(projections.current.breakdowns['skill.han'].total).toBe(3);
  expect(projections.permanent.breakdowns['skill.han'].total).toBe(3);
  expect(projections.current.breakdowns['skill.han'].conditional).toEqual([]);
});
