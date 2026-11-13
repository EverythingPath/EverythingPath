// @vitest-environment node
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import review from '../../scripts/catalog/legal/feats-330.json';
import { reviewedCuration as curation } from '../../scripts/catalog/reviewed-curation-data';
import { importCatalog } from '../../scripts/catalog/import';
import { buildAssessmentBinding } from '../../scripts/catalog/admission';
import {
  sourceDescription,
  upstreamRecord,
} from '../../scripts/catalog/records';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import { outputSchema } from '../../src/lib/catalog/curation-output-schema';
import {
  calculateCharacterSheetProjections,
  modifierTargets,
  resolveSheet,
} from '../../src/lib/character-sheet';
import preview from '../fixtures/feats-330/preview.json';
import { featFixtureSheet } from '../fixtures/feats-330/sheet';
import {
  expectFeatLaunchReview,
  expectFw1FeatLaunchReview,
  comparedLine,
  expectedNotices,
  reviewOf,
  isSkillPairRow,
  isWaveF1Row,
  isWaveF2Row,
  isWaveFw1Row,
  isWaveFw2aRow,
  expectFw2aFeatLaunchReview,
} from './launch-reassessment';
import { expectAutomaticSkillPair } from './skill-focus-assertions';
import { assessBatchAdmission } from './batch-admission';

const fixtureRoot = resolve('tests/fixtures/feats-330');
const inputs = {
  systemPath: join(fixtureRoot, 'pf1'),
  contentPath: join(fixtureRoot, 'pf1-content'),
  remaps: [],
  curation,
};
const sha256 = (text: string) =>
  createHash('sha256').update(text).digest('hex');

it('reviews exactly the 100 pinned ticket keys, with content-bound individual comparison and named holds', async () => {
  const keys = review.candidates.map((candidate) => candidate.externalKey);
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(sha256(keys.join('\n'))).toBe(
    '6376ab734b22633bd4c0b8dedaa3fe547d651dc0e3e0b8f920db590467a332f6',
  );
  expect(
    review.candidates.filter((row) => row.disposition === 'supported/admitted'),
  ).toHaveLength(33);
  expect(
    review.candidates.filter((row) => row.disposition === 'held'),
  ).toHaveLength(67);
  for (const candidate of review.candidates) {
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
    // #631 wave F1 and #628 wave F2 re-assessed four each in place (S-04);
    // feat wave FW1 re-assessed 16 and re-bound the two skill-pair feats;
    // feat wave FW2a re-assessed Craft Construct.
    expect(assessment).toMatchObject({
      status: candidate.assessmentStatus,
      ...reviewOf(candidate, {
        reviewedBy: 'Sol (AI curator) for the owner',
        reviewedOn: '2026-10-07',
      }),
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
      // An appended Combat Trick or retained Unchained action metadata adds
      // PZO1131 (Point-Blank Shot in wave F1; Improved Disarm and Deflect
      // Arrows in wave F2).
      expect(candidate.requiredNotices).toEqual(
        expectedNotices(
          candidate,
          ['Point-Blank Shot', 'Improved Disarm', 'Deflect Arrows'].includes(
            candidate.name,
          )
            ? ['PZO1110', 'PZO1131']
            : ['PZO1110'],
        ),
      );
      expect(evidence).toContain('PCGen');
      expect(evidence).toContain(
        comparedLine(candidate, candidate.comparison?.comparisonLineSha256),
      );
    }
    // Admission does not certify the importer's omitted choice facts.
    expect(candidate.mechanicsReview.mappedFacts.detail.repeatable).toBe(
      'unreviewed',
    );
    expect(
      candidate.mechanicsReview.outstandingMechanics.length,
    ).toBeGreaterThan(0);
  }
});

it('passes all required-note and separate-description reviews and admits the complete comparisons in an isolated catalog', async () => {
  const artifact = await importCatalog(inputs);
  expect(artifact.catalog.entries).toHaveLength(100);
  expect(artifact.curation.passed).toBe(true);
  expect(artifact.curation.summary).toMatchObject({
    required: 16,
    checked: 16,
    drafted: 0,
    missing: 0,
    descriptions: { candidates: 52, checked: 52, drafted: 0 },
  });
  expect(artifact.curation.unresolvedMechanics).toEqual([]);
  expect(artifact.curation.unresolvedDescriptions).toEqual([]);
  const gate = assessBatchAdmission({ artifact, ...reviewedAdmission });
  // Improved Disarm (wave F2) links Combat Expertise, a reviewed definition
  // outside this exact selection; the full gate owns its admission. So do the
  // nine feats feat wave FW1 admits whose links lie outside it, and Craft
  // Construct (feat wave FW2a), whose two item-creation links do.
  const outside = [
    'Craft Construct',
    'Improved Disarm',
    'Acrobatic Steps',
    'Great Cleave',
    'Greater Disarm',
    'Greater Feint',
    'Greater Spell Penetration',
    'Improved Great Fortitude',
    'Stand Still',
    'Unseat',
    'Wind Stance',
  ];
  const boundedAdmitted = review.candidates.filter(
    (row) =>
      row.disposition === 'supported/admitted' && !outside.includes(row.name),
  );
  for (const row of review.candidates.filter(({ name }) =>
    outside.includes(name),
  ))
    expect(gate.failures, row.name).toContainEqual(
      expect.objectContaining({ externalKey: row.externalKey }),
    );
  expect(gate.admitted.map((row) => row.externalKey).sort()).toEqual(
    boundedAdmitted.map((row) => row.externalKey).sort(),
  );
  expect(gate.admitted).toHaveLength(22);
  for (const candidate of boundedAdmitted) {
    const entry = artifact.catalog.entries.find(
      (row) => row.externalKey === candidate.externalKey,
    );
    const assessment = reviewedAdmission.assessments.find(
      (row) => row.externalKey === candidate.externalKey,
    );
    if (!entry || !assessment) throw new Error('Missing reviewed feat');
    expect(assessment).toMatchObject(
      buildAssessmentBinding({
        entry,
        artifact,
        ...reviewedAdmission,
        requiredNotices: assessment.requiredNotices,
        evidenceIds: Object.keys(assessment.evidenceFingerprints),
      }),
    );
    const changed = {
      ...entry,
      description: `${entry.description}<p>Changed benefit.</p>`,
    };
    expect(
      buildAssessmentBinding({
        entry: changed,
        artifact: {
          ...artifact,
          catalog: {
            ...artifact.catalog,
            entries: artifact.catalog.entries.map((row) =>
              row.externalKey === entry.externalKey ? changed : row,
            ),
          },
        },
        ...reviewedAdmission,
        requiredNotices: assessment.requiredNotices,
        evidenceIds: Object.keys(assessment.evidenceFingerprints),
      }).contentFingerprint,
    ).not.toBe(assessment.contentFingerprint);
  }
});

function modifiers(name: string) {
  const entry = preview.entries.find((row) => row.name === name);
  if (!entry) throw new Error(`Missing feat: ${name}`);
  return entry.modifiers.map((raw) => ({
    ...outputSchema.options[0]
      .omit({ kind: true })
      .extend({ target: z.enum(modifierTargets) })
      .parse(raw),
    sheetEntryId: entry.externalKey,
    catalogEntryId: entry.externalKey,
    entryName: entry.name,
    source: entry.externalKey,
    builtIn: false,
  }));
}

it('adds Lightning Reflexes +2 exactly once in current and permanent public projections', () => {
  const result = calculateCharacterSheetProjections(
    featFixtureSheet('Lightning Reflexes'),
  );
  for (const projection of [result.current, result.permanent]) {
    expect(projection.derivedStatistics.reflex.total).toBe(4); // Dex 14 (+2), feat +2.
    expect(projection.derivedStatistics.fortitude.total).toBe(0);
    expect(projection.derivedStatistics.will.total).toBe(0);
    expect(
      projection.resolvedEntries.filter(
        (row) => row.entry.kind === 'feat' && row.counting,
      ),
    ).toHaveLength(1);
    expect(projection.derivedStatistics.reflex.applied).toContainEqual(
      expect.objectContaining({ source: 'pf1/0bZf3SDkvVOe2ujH', value: 2 }),
    );
  }
});

it('keeps Point-Blank Shot ranged-only and conditional on the existing within30ft Situation', () => {
  const data = modifiers('Point-Blank Shot');
  expect(resolveSheet(data)['attack.ranged'].total).toBe(0);
  expect(resolveSheet(data)['damage.ranged'].total).toBe(0);
  const close = resolveSheet(data, { situations: ['within30ft'] });
  expect(close['attack.ranged'].total).toBe(1);
  expect(close['damage.ranged'].total).toBe(1);
  expect(close['attack.melee'].total).toBe(0);
  expect(close['damage.melee'].total).toBe(0);
});

it('stacks the +2 Improved and +2 Greater Disarm checks without confusing defensive CMD', () => {
  const data = [
    ...modifiers('Improved Disarm'),
    ...modifiers('Greater Disarm'),
  ];
  expect(resolveSheet(data).cmb.total).toBe(0);
  const attacking = resolveSheet(data, { situations: ['disarm'] });
  expect(attacking.cmb.total).toBe(4);
  expect(attacking.cmd.total).toBe(0);
  const defending = resolveSheet(data, {
    situations: [{ local: 'vs. disarm', sheetEntryId: 'pf1/711B9WNFgpdDKKf2' }],
  });
  expect(defending.cmd.total).toBe(2);
  expect(defending.cmb.total).toBe(0);
});

it('stacks Improved and Greater Reposition only in offensive reposition checks', () => {
  const data = [
    ...modifiers('Improved Reposition'),
    ...modifiers('Greater Reposition'),
  ];
  const result = resolveSheet(data, { situations: ['reposition'] });
  expect(result.cmb.total).toBe(4);
  expect(result.cmd.total).toBe(0);
  expect(resolveSheet(data).cmb.total).toBe(0);
});

it('limits Greater Spell Penetration to overcoming spell resistance rather than unconditional caster level', () => {
  const data = modifiers('Greater Spell Penetration');
  expect(resolveSheet(data).casterLevel.total).toBe(0);
  expect(
    resolveSheet(data, { situations: ['spellResistance'] }).casterLevel.total,
  ).toBe(2);
  expect(resolveSheet(data, { situations: ['spells'] }).casterLevel.total).toBe(
    0,
  );
});

it.each([
  [0, 3],
  [1, 3],
  [3, 3],
  [4, 4],
  [8, 8],
])(
  'uses actual %i Hit Dice for Toughness +%i HP including zero class levels',
  (hitDice, hp) => {
    expect(
      resolveSheet(
        [
          ...modifiers('Toughness'),
          {
            target: 'ability.con',
            bonusType: 'base',
            value: 10,
            sheetEntryId: 'base',
            entryName: 'Base',
            source: 'base',
            builtIn: false,
          },
        ],
        { level: 0, hitDice },
      ).hp.total,
    ).toBe(hp);
  },
);

it('keeps arcane armor spell failure, equipment-dependent formulas and chosen skill/proficiency gaps separate from valid statistics', () => {
  expect(modifiers('Arcane Armor Training')).toEqual([]);
  expect(modifiers('Fleet')).toEqual([]);
  expect(modifiers('Shield Focus')).toEqual([]);
  expect(modifiers('Skill Focus')).toEqual([]);
  const arcane = preview.entries.find(
    (row) => row.name === 'Arcane Armor Training',
  );
  expect(arcane?.situationalNotes).toContainEqual({
    text: expect.stringContaining('10 percentage points'),
  });
  expect(resolveSheet(modifiers('Arcane Armor Training')).spellDC.total).toBe(
    0,
  );
  const heavy = review.candidates.find(
    (row) => row.name === 'Armor Proficiency, Heavy',
  );
  expect(heavy?.mechanicsReview.rawProficiencies.armorProf).toEqual(['hvy']);
  expect(heavy?.mechanicsReview.outstandingMechanics.join(' ')).toContain(
    'not materialized',
  );
});

it('applies the skill-pair feats +2, or +4 with 10 or more ranks, on each skill from its own recorded ranks (rank-modifiers slice 2, #777)', () => {
  expectAutomaticSkillPair({
    modifiers: modifiers('Magical Aptitude'),
    targets: ['skill.spl', 'skill.umd'],
  });
  // Self-Sufficient's .ranks changes import the formula through their
  // reviewed replacements (R5(a)); no raw change stays unsupported.
  expectAutomaticSkillPair({
    modifiers: modifiers('Self-Sufficient'),
    targets: ['skill.hea', 'skill.sur'],
  });
  const selfSufficient = preview.entries.find(
    (row) => row.name === 'Self-Sufficient',
  );
  expect(
    selfSufficient?.unsupported?.filter(({ field }) => field === 'changes'),
  ).toEqual([]);
  for (const name of ['Magical Aptitude', 'Self-Sufficient']) {
    const row = review.candidates.find((candidate) => candidate.name === name);
    expect(row && isSkillPairRow(row), name).toBe(true);
  }
});

it('re-assesses the 16 Source-prerequisites feats in place, admitting 12 and holding 4 on named owner content holds (feat wave FW1)', async () => {
  const relaunched = review.candidates.filter((row) => isWaveFw1Row(row));
  expect(relaunched.map((row) => row.name).sort()).toEqual([
    'Acrobatic Steps',
    'Far Shot',
    'Great Cleave',
    'Greater Disarm',
    'Greater Drag',
    'Greater Feint',
    'Greater Reposition',
    'Greater Spell Penetration',
    'Improved Great Fortitude',
    'Improved Ki Throw',
    'Improved Reposition',
    'Stand Still',
    'Stunning Fist',
    'Trample',
    'Unseat',
    'Wind Stance',
  ]);
  expect(
    relaunched
      .filter((row) => row.disposition === 'held')
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Greater Drag',
    'Greater Reposition',
    'Improved Ki Throw',
    'Improved Reposition',
  ]);
  for (const row of relaunched) await expectFw1FeatLaunchReview(row, 330);
});

it('re-assesses the four feats wave F1 links in place under S-04 (#631 wave F1)', async () => {
  const relaunched = review.candidates.filter((row) => isWaveF1Row(row));
  expect(relaunched.map((row) => row.name)).toEqual([
    'Improved Unarmed Strike',
    'Improved Two-Weapon Fighting',
    'Point-Blank Shot',
    'Two-Weapon Fighting',
  ]);
  for (const row of relaunched) await expectFeatLaunchReview(row, 330);
});

it('re-assesses the four feats Bonus Feat (MNK) links in place under S-04 (#628 wave F2)', async () => {
  const relaunched = review.candidates.filter((row) => isWaveF2Row(row));
  expect(relaunched.map((row) => row.name).sort()).toEqual([
    'Deflect Arrows',
    'Improved Disarm',
    'Power Attack',
    'Scorpion Style',
  ]);
  for (const row of relaunched) await expectFeatLaunchReview(row, 330);
});

it('re-assesses Craft Construct in place and admits it, every section reproduced by PCGen (feat wave FW2a)', async () => {
  const relaunched = review.candidates.filter((row) => isWaveFw2aRow(row));
  expect(relaunched.map((row) => [row.name, row.disposition])).toEqual([
    ['Craft Construct', 'supported/admitted'],
  ]);
  for (const row of relaunched) await expectFw2aFeatLaunchReview(row, 330);
});
