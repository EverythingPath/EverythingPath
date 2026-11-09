// @vitest-environment node
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import review from '../../scripts/catalog/legal/feats-338.json';
import { reviewedCuration as curation } from '../../scripts/catalog/reviewed-curation-data';
import { importCatalog } from '../../scripts/catalog/import';
import {
  assessCatalogAdmission,
  buildAssessmentBinding,
} from '../../scripts/catalog/admission';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
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
  type InputSourcedModifier,
} from '../../src/lib/character-sheet';
import provenance from '../fixtures/feats-338/provenance.json';
import preview from '../fixtures/feats-338/preview.json';
import { reviewedFeatSheet } from '../fixtures/feats-338/sheet';
import { expectAutomaticSkillFocus } from './skill-focus-assertions';

const fixtureRoot = resolve('tests/fixtures/feats-338');
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
  const situation = modifiers(name).find(
    (row) =>
      row.target === target && typeof row.condition?.situation === 'object',
  )?.condition?.situation;
  if (typeof situation !== 'object' || !('local' in situation))
    throw new Error(`Missing local Situation: ${name}, ${target}`);
  return { ...situation, sheetEntryId: entry(name).externalKey };
}

it('uses registered shared Situations and keeps distinct compound circumstances local', () => {
  const registered = new Set(curation.situations.map((row) => row.key));
  for (const feat of preview.entries) {
    const parsed = importedCatalogEntrySchema.parse(feat);
    for (const situation of [
      ...parsed.modifiers.map((row) => row.condition?.situation),
      ...(parsed.situationalNotes ?? []).flatMap((row) => [
        row.situation,
        row.condition?.situation,
      ]),
    ]) {
      if (typeof situation === 'string')
        expect(registered.has(situation), feat.name).toBe(true);
    }
  }
  for (const modifier of modifiers('Pure Faith'))
    expect(modifier.condition?.situation).toBe('poison');
  expect(localSituation('Shrouded in Mystery', 'save.will').local).toMatch(
    /humanoid.*mind.affecting|mind.affecting.*humanoid/i,
  );
});

it('preserves exactly the 100 ticket keys and byte-for-byte pinned pf1-content evidence', async () => {
  expect(provenance.sourceCommit).toBe(
    '02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d',
  );
  const keys = provenance.candidates.map((candidate) => candidate.externalKey);
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(sha256(keys.join('\n'))).toBe(
    '2933f6ad6cd8ee5781b1372a74e846bc81fd47ffe4f3951cae84a2984201ba55',
  );
  expect(review.candidates.map((candidate) => candidate.externalKey)).toEqual(
    keys,
  );
  expect(
    review.candidates.filter((row) => row.disposition === 'held'),
  ).toHaveLength(99);
  expect(
    review.candidates
      .filter((row) => row.disposition === 'admitted')
      .map((row) => row.name),
  ).toEqual(['Skill Focus (Intimidate)']);
  expect(preview.entries.map((candidate) => candidate.externalKey)).toEqual(
    keys,
  );
  for (const candidate of review.candidates) {
    const source = provenance.candidates.find(
      (row) => row.externalKey === candidate.externalKey,
    );
    expect(candidate.source).toEqual(source?.source);
    expect(candidate.descriptionSha256).toBe(source?.descriptionSha256);
    const raw = await readFile(
      join(inputs.contentPath, candidate.source.path),
      'utf8',
    );
    expect(sha256(raw), candidate.name).toBe(candidate.source.sha256);
    const record = upstreamRecord.parse(parse(raw));
    expect(`pf1-content/${record._id}`).toBe(candidate.externalKey);
    expect(record.name).toBe(candidate.name);
    expect(sha256(sourceDescription(record))).toBe(candidate.descriptionSha256);
    const assessment = reviewedAdmission.assessments.find(
      (row) => row.externalKey === candidate.externalKey,
    );
    // #724 re-bound the admitted Skill Focus assessment.
    const isSkillFocus = candidate.name.startsWith('Skill Focus (');
    expect(assessment).toMatchObject({
      status: candidate.assessmentStatus,
      reviewedBy: isSkillFocus
        ? 'Opus (AI curator) for the owner'
        : 'Sol (AI curator) for the owner',
      reviewedOn: isSkillFocus ? '2026-10-14' : '2026-10-08',
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
    }
    expect(entry(candidate.name).detail.repeatable).toBe('unreviewed');
    expect(candidate.mechanicsReview.sourceEvidence.sha256).toBe(
      candidate.source.sha256,
    );
    expect(candidate.mechanicsReview.mappedFacts.prerequisiteText).toBe(
      entry(candidate.name).prerequisiteText,
    );
    expect(candidate.mechanicsReview.mappedFacts.prerequisites).toEqual(
      entry(candidate.name).prerequisites,
    );
    for (const field of [
      'sources',
      'detail',
      'modifiers',
      'situationalNotes',
    ] as const)
      expect(
        candidate.mechanicsReview.mappedFacts[field],
        candidate.name,
      ).toEqual(entry(candidate.name)[field]);
    expect(candidate.mechanicsReview.descriptionText).toBe(
      sourceDescription(record),
    );
    expect(candidate.mechanicsReview.ruleIdentity).toBe(candidate.externalKey);
    expect(candidate.mechanicsReview.curationRecords).toEqual(
      curation.records.filter(
        (row) => row.externalKey === candidate.externalKey,
      ),
    );
    expect(candidate.mechanicsReview.completeCalculation).toBe(
      candidate.mechanicsReview.outstandingCalculations.length === 0,
    );
    expect(candidate.mechanicsReview.outstandingMechanics.join(' ')).toMatch(
      /repeatability/i,
    );
  }
});

it('reproduces reviewed numeric and note output without fabricating absent fixture dependencies', async () => {
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
  // Complete-checkout prerequisites and links remain in the preview. Reduced
  // source fixtures intentionally do not invent absent linked rule bodies.
  expect(preview.entries.map(demonstrated)).toEqual(
    artifact.catalog.entries.map(demonstrated),
  );
  expect(artifact.curation.passed).toBe(true);
  expect(artifact.curation.summary.drafted).toBe(0);
  expect(artifact.curation.summary.missing).toBe(0);
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

it('accounts for every candidate while preserving attribution holds on the real reviewed bodies', async () => {
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
  expect(gate.admitted.map((row) => row.externalKey)).toEqual(
    review.candidates
      .filter((row) => row.disposition === 'admitted')
      .map((row) => row.externalKey),
  );
  const reported = new Set(
    [
      ...gate.admitted,
      ...gate.held,
      ...gate.failures,
      ...gate.dependentOmissions,
    ].map((row) => row.externalKey),
  );
  for (const candidate of provenance.candidates)
    expect(reported.has(candidate.externalKey), candidate.externalKey).toBe(
      true,
    );
  for (const candidate of review.candidates.filter(
    (row) => row.disposition === 'held',
  ))
    expect(
      gate.admitted.some((row) => row.externalKey === candidate.externalKey),
    ).toBe(false);
  for (const row of catalogArtifact.catalog.entries) {
    const assessment = reviewedAdmission.assessments.find(
      (candidate) => candidate.externalKey === row.externalKey,
    );
    if (!assessment) throw new Error(`Missing assessment: ${row.externalKey}`);
    const {
      contentFingerprint,
      mappingFingerprint,
      evidenceFingerprints,
      noticeFingerprints,
    } = buildAssessmentBinding({
      entry: row,
      artifact: catalogArtifact,
      ...reviewedAdmission,
      requiredNotices: assessment.requiredNotices,
      evidenceIds: Object.keys(assessment.evidenceFingerprints),
    });
    expect(assessment).toMatchObject({
      contentFingerprint,
      mappingFingerprint,
      evidenceFingerprints,
      noticeFingerprints,
    });
  }
  // This entry has no external references; its content closure needs no
  // invented out-of-batch rule bodies to reproduce the final binding.
  const focus = catalogArtifact.catalog.entries.find(
    (row) => row.name === 'Skill Focus (Intimidate)',
  );
  const assessment = reviewedAdmission.assessments.find(
    (row) => row.externalKey === focus?.externalKey,
  );
  if (!focus || !assessment)
    throw new Error('Missing bound Skill Focus Intimidate fixture');
  const binding = buildAssessmentBinding({
    entry: focus,
    artifact: catalogArtifact,
    ...reviewedAdmission,
    requiredNotices: assessment.requiredNotices,
    evidenceIds: Object.keys(assessment.evidenceFingerprints),
  });
  expect(assessment).toMatchObject(binding);
  const changed = buildAssessmentBinding({
    entry: {
      ...focus,
      // #724: the rank Modifier is a formula; changing it changes the body.
      modifiers: focus.modifiers.map((row) => ({
        ...row,
        bonusType: 'competence' as const,
      })),
    },
    artifact: catalogArtifact,
    ...reviewedAdmission,
    requiredNotices: assessment.requiredNotices,
    evidenceIds: Object.keys(assessment.evidenceFingerprints),
  });
  expect(changed.contentFingerprint).not.toBe(binding.contentFingerprint);
});

it('enforces batch notice-chain holds without treating publication minima as complete attribution', () => {
  for (const requirement of review.noticeRequirements) {
    if (!requirement.holdId) continue;
    expect(
      heldNotices.find((hold) => hold.id === requirement.holdId),
    ).toMatchObject({
      notices: expect.arrayContaining([
        requirement.book,
        ...requirement.registryKeys,
      ]),
      evidence: expect.arrayContaining([
        'scripts/catalog/legal/feats-338.json',
      ]),
    });
  }
  for (const candidate of review.candidates) {
    if (candidate.disposition === 'held') {
      expect(candidate.assessmentStatus).toBe('unresolved');
      expect(candidate.noticeRequirementsComplete).toBe(false);
    } else {
      expect(candidate.assessmentStatus).toBe('confirmed');
      expect(candidate.noticeRequirementsComplete).toBe(true);
    }
  }
  const combatTricks = review.candidates.filter((candidate) =>
    candidate.mechanicsReview.descriptionText.includes('Combat Trick'),
  );
  expect(combatTricks).toHaveLength(11);
  for (const candidate of combatTricks) {
    expect(candidate.requiredNotices, candidate.name).toContain('PZO1131');
    expect(candidate.noticeHoldIds, candidate.name).toContain(
      'feats-338-notice-PZO1131-complete-chain',
    );
  }
  for (const [name, notice] of [
    ['Nightmare Chains', 'PZO1112'],
    ['Corpse Companion', 'PZO1112'],
    ['Lifebound', 'PZO1115'],
    ['Raging Concentration', 'PZO1129'],
    ['Agent of Fear', 'PZO1134'],
    ["Figment's Fluidity", 'PZO1115'],
    ['Shapeshifter Foil', 'PZO1110'],
    ['Improved Drow Nobility', 'PZO1121'],
    ['Improved Shadowy Resistance', 'PZO1121'],
    ['Improved Fiendish Sorcery', 'PZO1121'],
    ['Triton Portal', 'PZO1121'],
    ['Triton Portal', 'PZO1112'],
    ['Blood Frenzy Style', 'PZO1118'],
    ['Owl Style', 'PZO1112'],
    ['Summon Good Monster', 'PZO1116'],
    ['Summon Good Monster', 'PZO1120'],
    ['Piercing Spell', 'PZO1110'],
    ['Feint Defender', 'PZO1110'],
    ['Skyseeker Impact', 'PZO1110'],
    ['Disarming Strike', 'PZO1110'],
    ['Piercing Gambit', 'PZO1110'],
    ['Linnorm Style', 'PZO1110'],
    ['Apocalyptic Spell', 'PZO1110'],
    ['Improved Day Job', 'PZO1110'],
    ['Spell Drinker', 'PZO1110'],
    ['Multiweapon Fighting', 'PZO1110'],
  ]) {
    const candidate = review.candidates.find((row) => row.name === name);
    expect(candidate?.requiredNotices, name).toContain(notice);
    if (notice !== 'PZO1110')
      expect(candidate?.noticeHoldIds, name).toContain(
        `feats-338-notice-${notice}-complete-chain`,
      );
  }
  expect(review.inheritedNoticeAudit.candidateKeys).toEqual(
    review.candidates.map((candidate) => candidate.externalKey),
  );
  for (const candidate of review.candidates)
    for (const inherited of candidate.inheritedRuleNotices)
      expect(candidate.requiredNotices, candidate.name).toContain(
        inherited.book,
      );
});

it('applies Rubble Skirmisher CMB and CMD +2 only in naturally occurring difficult terrain', () => {
  const data = modifiers('Rubble Skirmisher');
  const terrain = localSituation('Rubble Skirmisher', 'cmb');
  expect(terrain.local).toMatch(/naturally occurring difficult terrain/i);
  for (const target of ['cmb', 'cmd'] as const) {
    expect(data.find((row) => row.target === target)).toMatchObject({
      bonusType: 'circumstance',
      value: 2,
    });
    expect(resolveSheet(data)[target].total).toBe(0);
    expect(resolveSheet(data, { situations: [terrain] })[target].total).toBe(2);
    expect(
      resolveSheet(data, { situations: ['difficultTerrain'] })[target].total,
    ).toBe(0);
    expect(
      resolveSheet(data, {
        situations: [{ ...terrain, sheetEntryId: 'other' }],
      })[target].total,
    ).toBe(0);
  }
  const copy = data.map((row) => ({
    ...row,
    sheetEntryId: 'copied-rubble',
    catalogEntryId: 'copied-rubble',
  }));
  const result = resolveSheet([...data, ...copy], {
    situations: [terrain, { ...terrain, sheetEntryId: 'copied-rubble' }],
  });
  expect(result.cmb.total).toBe(2);
  expect(result.cmd.total).toBe(2);
});

it('applies Pure Faith sacred +4 to poison saves through the shared Situation and suppresses same-Source copies', () => {
  const data = modifiers('Pure Faith');
  const copy = data.map((row) => ({
    ...row,
    sheetEntryId: 'copied-pure-faith',
    catalogEntryId: 'copied-pure-faith',
  }));
  expect(data).toContainEqual(
    expect.objectContaining({
      target: 'saves',
      bonusType: 'sacred',
      value: 4,
      condition: { situation: 'poison' },
    }),
  );
  for (const target of ['save.fort', 'save.ref', 'save.will'] as const) {
    expect(resolveSheet(data)[target].total).toBe(0);
    expect(resolveSheet(data, { situations: ['poison'] })[target].total).toBe(
      4,
    );
    expect(
      resolveSheet(data, { situations: ['disease', 'fear'] })[target].total,
    ).toBe(0);
    expect(
      resolveSheet([...data, ...copy], { situations: ['poison'] })[target]
        .total,
    ).toBe(4);
  }
});

it('applies Blood Frenzy Style Strength and Constitution +2 and AC -2 only in its entered stance', () => {
  const data = modifiers('Blood Frenzy Style');
  const stance = localSituation('Blood Frenzy Style', 'ability.str');
  expect(stance.local).toMatch(
    /immediate action.*damage|damage.*immediate action/i,
  );
  for (const [target, value] of [
    ['ability.str', 2],
    ['ability.con', 2],
    ['ac.other', -2],
  ] as const) {
    expect(resolveSheet(data)[target].total).toBe(0);
    expect(resolveSheet(data, { situations: [stance] })[target].total).toBe(
      value,
    );
    expect(resolveSheet(data, { situations: ['charging'] })[target].total).toBe(
      0,
    );
    expect(
      resolveSheet(data, {
        situations: [{ ...stance, sheetEntryId: 'other' }],
      })[target].total,
    ).toBe(0);
  }
});

it('keeps Shrouded in Mystery Bluff +3 and mind-affecting Will +2 restricted to other-race humanoids', () => {
  const data = modifiers('Shrouded in Mystery');
  const bluff = localSituation('Shrouded in Mystery', 'skill.blf');
  const will = localSituation('Shrouded in Mystery', 'save.will');
  for (const situation of [bluff, will]) {
    expect(situation.local).toMatch(/humanoid/i);
    expect(situation.local).toMatch(/race.*other|other.*race/i);
  }
  expect(will.local).toMatch(/mind.affecting/i);
  expect(resolveSheet(data)['skill.blf'].total).toBe(0);
  expect(resolveSheet(data)['save.will'].total).toBe(0);
  expect(resolveSheet(data, { situations: [bluff] })['skill.blf'].total).toBe(
    3,
  );
  expect(resolveSheet(data, { situations: [bluff] })['save.will'].total).toBe(
    0,
  );
  expect(resolveSheet(data, { situations: [will] })['save.will'].total).toBe(2);
  expect(
    resolveSheet(data, { situations: ['mindAffecting'] })['save.will'].total,
  ).toBe(0);
});

// #724: the rank threshold is automatic, read from Intimidate's recorded ranks.
it('gives Skill Focus Intimidate +3, or +6 at 10 Intimidate ranks, without a Situation or a stacking same-Source copy', () => {
  const data = modifiers('Skill Focus (Intimidate)');
  expectAutomaticSkillFocus({ modifiers: data, target: 'skill.int' });
  const candidate = review.candidates.find(
    (row) => row.name === 'Skill Focus (Intimidate)',
  );
  expect(candidate?.requiredNotices).toEqual(['PZO1110']);
  // No ranks and Charisma 10: Skill Focus's +3 alone.
  for (const projection of Object.values(
    calculateCharacterSheetProjections(
      reviewedFeatSheet('Skill Focus (Intimidate)'),
    ),
  ))
    expect(projection.breakdowns['skill.int'].total).toBe(3);
});

it('uses Snapping Turtle Shell shield AC +2 while keeping enemy critical confirmation penalties off the owner attacks', () => {
  const data = modifiers('Snapping Turtle Shell');
  const style = localSituation('Snapping Turtle Shell', 'ac.shield');
  expect(style.local).toMatch(/Snapping Turtle Style/i);
  expect(resolveSheet(data)['ac.shield'].total).toBe(0);
  expect(resolveSheet(data, { situations: [style] })['ac.shield'].total).toBe(
    2,
  );
  expect(data.some((row) => row.target.startsWith('attack'))).toBe(false);
  expect(
    entry('Snapping Turtle Shell')
      .situationalNotes.map((row) => row.text)
      .join(' '),
  ).toMatch(/enemies.*-4.*critical/i);
});

it('preserves Snapping Turtle Shell BAB-or-monk prerequisites as alternatives rather than requiring both', () => {
  const feat = importedCatalogEntrySchema.parse(entry('Snapping Turtle Shell'));
  expect(feat.prerequisiteText).toContain(
    'base attack bonus +5 or monk level 5th',
  );
  expect(feat.prerequisites).toContainEqual({
    anyOf: [
      { kind: 'bab', bab: 5 },
      { kind: 'classLevel', classLevel: 'pf1/W8dxwZ1CZiwLKsqr', min: 5 },
    ],
  });
});

it.each([
  { hitDice: 0, bonus: 1 },
  { hitDice: 4, bonus: 1 },
  { hitDice: 5, bonus: 2 },
  { hitDice: 20, bonus: 5 },
])(
  'calculates Mindful Meditation Will +$bonus at $hitDice Hit Dice only within its 24-hour effect circumstance',
  ({ hitDice, bonus }) => {
    const data = modifiers('Mindful Meditation');
    const meditation = localSituation('Mindful Meditation', 'save.will');
    expect(meditation.local).toMatch(/24 hours/i);
    for (const effect of ['charm', 'compulsion', 'emotion', 'fear'])
      expect(meditation.local).toContain(effect);
    expect(resolveSheet(data, { hitDice })['save.will'].total).toBe(0);
    expect(
      resolveSheet(data, { hitDice, situations: [meditation] })['save.will']
        .total,
    ).toBe(bonus);
    expect(
      resolveSheet(data, { hitDice, situations: ['fear'] })['save.will'].total,
    ).toBe(0);
    expect(
      resolveSheet(data, {
        hitDice,
        situations: [{ ...meditation, sheetEntryId: 'other' }],
      })['save.will'].total,
    ).toBe(0);
  },
);

it('keeps confirmation-only and primary/off-hand mechanics out of broad attack targets without an enforceable attack filter', () => {
  for (const name of ['Greater Beast Hunter', 'Multiweapon Fighting']) {
    expect(modifiers(name).some((row) => row.target.startsWith('attack'))).toBe(
      false,
    );
    const candidate = review.candidates.find((row) => row.name === name);
    expect(candidate?.mechanicsReview.completeCalculation).toBe(false);
    expect(
      candidate?.mechanicsReview.outstandingCalculations.join(' '),
    ).toMatch(/critical|confirmation|hand|attack/i);
  }
});

it('pins the supporting Hardy, Mobility and Sisterhood Style sources used for inherited bonus calculations', async () => {
  for (const name of [
    'Living Fortress',
    'Mobility (Mythic)',
    'Sisterhood Dedication',
  ]) {
    const candidate = review.candidates.find((row) => row.name === name);
    if (!candidate?.mechanicsReview.supportingSourceEvidence?.length)
      throw new Error(`Missing inherited bonus source: ${name}`);
    for (const source of candidate.mechanicsReview.supportingSourceEvidence) {
      const raw = await readFile(join(fixtureRoot, source.fixturePath), 'utf8');
      expect(sha256(raw), name).toBe(source.sha256);
    }
  }
});

it('replaces Hardy +2 with Living Fortress +4 only for its defensive spell circumstance and leaves poison at +2', () => {
  const data = modifiers('Living Fortress');
  const fortress = localSituation('Living Fortress', 'saves');
  expect(fortress.local).toMatch(/fighting defensively/i);
  expect(fortress.local).toMatch(/adjacent.*ally/i);
  expect(fortress.local).toMatch(/spells.*spell.like/i);
  const hardy: InputSourcedModifier[] = ['spells', 'poison'].map(
    (situation) => ({
      target: 'saves',
      bonusType: 'racial',
      value: 2,
      condition: { situation },
      sheetEntryId: 'hardy-row',
      catalogEntryId: 'pf1/nEltI9y37rKJTeWo',
      entryName: 'Hardy source example',
      source: 'pf1/nEltI9y37rKJTeWo',
      builtIn: false,
    }),
  );
  for (const target of ['save.fort', 'save.ref', 'save.will'] as const) {
    expect(
      resolveSheet([...hardy, ...data], { situations: ['spells'] })[target]
        .total,
    ).toBe(2);
    expect(
      resolveSheet([...hardy, ...data], { situations: ['spells', fortress] })[
        target
      ].total,
    ).toBe(4);
    expect(
      resolveSheet([...hardy, ...data], {
        situations: ['poison', 'fightingDefensively'],
      })[target].total,
    ).toBe(2);
  }
});

it('adds Mobility Mythic +2 to the pinned ordinary Mobility +4 without making its final bonus +10', () => {
  const data = modifiers('Mobility (Mythic)');
  const movement = localSituation('Mobility (Mythic)', 'ac');
  expect(movement.local).toMatch(/attacks of opportunity.*movement/i);
  const ordinary: InputSourcedModifier = {
    target: 'ac',
    bonusType: 'dodge',
    value: 4,
    sheetEntryId: 'ordinary-mobility-row',
    catalogEntryId: 'pf1/R7L4SlGRlnThqFrP',
    entryName: 'Ordinary Mobility source example',
    source: 'pf1/R7L4SlGRlnThqFrP',
    builtIn: false,
  };
  expect(resolveSheet([ordinary, ...data])['ac.other'].total).toBe(4);
  expect(
    resolveSheet([ordinary, ...data], { situations: [movement] })['ac.other']
      .total,
  ).toBe(6);
});

it('increases Sisterhood Style Reflex and Will +1 to +2 without adding a Fortitude benefit', () => {
  const data = modifiers('Sisterhood Dedication');
  const style = localSituation('Sisterhood Dedication', 'save.ref');
  expect(style.local).toMatch(/longsword.*light or heavy shield/i);
  const ordinary: InputSourcedModifier[] = (
    ['save.ref', 'save.will'] as const
  ).map((target) => ({
    target,
    bonusType: 'untyped',
    value: 1,
    sheetEntryId: 'sisterhood-style-row',
    catalogEntryId: 'pf1-content/Zu2Gk9aejJSM5oPY',
    entryName: 'Sisterhood Style source example',
    source: 'pf1-content/Zu2Gk9aejJSM5oPY',
    builtIn: false,
  }));
  for (const target of ['save.ref', 'save.will'] as const) {
    expect(resolveSheet([...ordinary, ...data])[target].total).toBe(1);
    expect(
      resolveSheet([...ordinary, ...data], { situations: [style] })[target]
        .total,
    ).toBe(2);
  }
  expect(
    resolveSheet([...ordinary, ...data], { situations: [style] })['save.fort']
      .total,
  ).toBe(0);
});
