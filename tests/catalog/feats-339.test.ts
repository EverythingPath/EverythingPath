// @vitest-environment node
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import review from '../../scripts/catalog/legal/feats-339.json';
import { reviewedCuration as curation } from '../../scripts/catalog/reviewed-curation-data';
import { importCatalog } from '../../scripts/catalog/import';
import { buildAssessmentBinding } from '../../scripts/catalog/admission';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import {
  sourceDescription,
  upstreamRecord,
} from '../../scripts/catalog/records';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import { outputSchema } from '../../src/lib/catalog/curation-output-schema';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import {
  prerequisiteSheet,
  selectedFeat,
} from '../../src/lib/character-sheet-prerequisite-fixture';
import {
  calculateCharacterSheetProjections,
  modifierTargets,
  resolveSheet,
  type InputSourcedModifier,
} from '../../src/lib/character-sheet';
import provenance from '../fixtures/feats-339/provenance.json';
import preview from '../fixtures/feats-339/preview.json';
import { reviewedFeatSheet } from '../fixtures/feats-339/sheet';
import { expectAutomaticSkillFocus } from './skill-focus-assertions';
import { assessWithUnclearedHolds } from './uncleared-holds';

const fixtureRoot = resolve('tests/fixtures/feats-339');
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
});

it('preserves exactly the 100 ticket keys and byte-for-byte pinned pf1-content evidence', async () => {
  expect(provenance.sourceCommit).toBe(
    '02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d',
  );
  const keys = provenance.candidates.map((candidate) => candidate.externalKey);
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(sha256(keys.join('\n'))).toBe(
    'a9701b71b607a934c89aa4c1d36fc4ba9fcdb8fa68b9257368f885b466aa5031',
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
  ).toEqual(['Skill Focus (Perception)']);
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
  const gate = assessWithUnclearedHolds({
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
    (row) => row.name === 'Skill Focus (Perception)',
  );
  const assessment = reviewedAdmission.assessments.find(
    (row) => row.externalKey === focus?.externalKey,
  );
  if (!focus || !assessment)
    throw new Error('Missing bound Skill Focus Perception fixture');
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
  const summoning = catalogArtifact.catalog.entries.find(
    (row) => row.name === 'Versatile Summon Monster',
  );
  const summoningAssessment = reviewedAdmission.assessments.find(
    (row) => row.externalKey === summoning?.externalKey,
  );
  if (!summoning || !summoningAssessment)
    throw new Error('Missing held Versatile Summon Monster fixture');
  // Test-only accepted assessment proves a registered notice-chain hold still
  // prevents admission even when every content and evidence binding is current.
  // The real reviewed notices exist under their content hashes. Test-only
  // aliases let this branch reach notice-hold enforcement, independently of
  // the separate missing-book-code registration blocker.
  const requiredNotices = summoningAssessment.requiredNotices;
  // The drafted PRD records of the notice-hold clearance (2026-10-30) claim
  // these codes too; they stand aside so the aliases resolve.
  const fixtureRegistry = Object.fromEntries(
    Object.entries(reviewedAdmission.registry)
      .filter(([key]) => !requiredNotices.includes(key))
      .map(([key, notice]) => {
        const book = review.noticeRequirements.find(
          (requirement) =>
            requiredNotices.includes(requirement.book) &&
            requirement.registryKeys.includes(key),
        )?.book;
        return [
          key,
          book && !notice.aliases.includes(book)
            ? { ...notice, aliases: [...notice.aliases, book] }
            : notice,
        ];
      }),
  );
  const confirmedBinding = buildAssessmentBinding({
    entry: summoning,
    artifact: catalogArtifact,
    ...reviewedAdmission,
    registry: fixtureRegistry,
    requiredNotices: summoningAssessment.requiredNotices,
    evidenceIds: Object.keys(summoningAssessment.evidenceFingerprints),
  });
  const noticeHeld = assessWithUnclearedHolds({
    artifact: catalogArtifact,
    ...reviewedAdmission,
    registry: fixtureRegistry,
    assessments: reviewedAdmission.assessments.map((row) =>
      row.externalKey === summoning.externalKey
        ? { ...row, ...confirmedBinding, status: 'confirmed' }
        : row,
    ),
  });
  expect(
    noticeHeld.held.find((row) => row.externalKey === summoning.externalKey),
  ).toMatchObject({ reason: expect.stringContaining('Notice holds:') });
});

it('enforces every named notice-chain hold independently of numeric completeness', () => {
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
        'scripts/catalog/legal/feats-339.json',
      ]),
    });
  }
  for (const candidate of review.candidates) {
    expect(candidate.assessmentStatus).toBe(
      candidate.disposition === 'held' ? 'unresolved' : 'confirmed',
    );
    expect(candidate.noticeRequirementsComplete).toBe(
      candidate.disposition !== 'held',
    );
    if (candidate.mechanicsReview.descriptionText.includes('Combat Trick'))
      expect(candidate.requiredNotices, candidate.name).toContain('PZO1131');
  }
  // The expanded Standing Tall defenses depend on the CRB condition rules.
  expect(
    review.candidates.find((row) => row.name === 'Standing Tall')
      ?.requiredNotices,
  ).toContain('PZO1110');
  for (const [name, book, sourceFile, sourceLine] of [
    ["Mascot's Affection", 'PZO9454', 'ff_abilities_companion.lst', 24],
    ['Wolf Trip', 'PZO9439', 'botm_feats.lst', 20],
    ['Linnorm Vengeance', 'PZO9470', 'lod_feats.lst', 15],
  ] as const) {
    const candidate = review.candidates.find((row) => row.name === name);
    expect(candidate?.requiredNotices, name).toContain(book);
    expect(candidate?.noticeHoldIds, name).toContain(
      `feats-339-notice-${book}-complete-chain`,
    );
    expect(candidate?.inheritedRuleNotices, name).toContainEqual(
      expect.objectContaining({
        book,
        location: expect.stringContaining(`${sourceFile}#L${sourceLine}`),
      }),
    );
    const lead = candidate?.additionalComparisonLeads.find(
      (row) => row.book === book,
    );
    expect(lead?.comparisonLineSha256, name).toBe(
      sha256(lead?.literalRow ?? ''),
    );
  }
  const battlePlanner = review.candidates.find(
    (row) => row.name === 'Battle Planner',
  );
  expect(battlePlanner?.requiredNotices).toEqual(['PZO1110']);
  expect(battlePlanner?.additionalComparisonLeads).toContainEqual(
    expect.objectContaining({
      book: 'PZO1110',
      comparisonLocation: expect.stringContaining(
        'cr_abilities_class.lst#L3057',
      ),
      literalRow: expect.stringContaining(
        'Pathfinder Chronicler ~ Inspire Action',
      ),
    }),
  );
});

// #724: the rank threshold is automatic, read from the skill's recorded ranks.
it('gives Skill Focus (Perception) +3, or +6 at 10 ranks, without a Situation or a stacking same-Source copy', () => {
  const data = modifiers('Skill Focus (Perception)');
  expectAutomaticSkillFocus({ modifiers: data, target: 'skill.per' });
  // No ranks: its ability modifier and Skill Focus's +3.
  for (const projection of Object.values(
    calculateCharacterSheetProjections(
      reviewedFeatSheet('Skill Focus (Perception)'),
    ),
  ))
    expect(projection.breakdowns['skill.per'].total).toBe(5);
});

it('restricts Solo Maneuvers CMB and CMD +1 to the sole-threatening circumstance', () => {
  const data = modifiers('Solo Maneuvers');
  for (const target of ['cmb', 'cmd'] as const) {
    const solo = localSituation('Solo Maneuvers', target);
    expect(solo.local).toMatch(/only.*threatening|sole.*threatening/i);
    expect(resolveSheet(data)[target].total).toBe(0);
    expect(resolveSheet(data, { situations: [solo] })[target].total).toBe(1);
    expect(resolveSheet(data, { situations: ['trip'] })[target].total).toBe(0);
    expect(
      resolveSheet(data, { situations: [{ ...solo, sheetEntryId: 'other' }] })[
        target
      ].total,
    ).toBe(0);
  }
});

it('keeps Wolf Trip +2 specific to a style-enabled attack-of-opportunity trip', () => {
  const data = modifiers('Wolf Trip');
  const trip = localSituation('Wolf Trip', 'cmb');
  expect(trip.local).toMatch(/Wolf Style/);
  expect(trip.local).toMatch(/trip/i);
  expect(trip.local).toMatch(/attack of opportunity/i);
  expect(resolveSheet(data).cmb.total).toBe(0);
  expect(resolveSheet(data, { situations: [trip] }).cmb.total).toBe(2);
  for (const situations of [['trip'], ['grapple'], ['trip', 'grapple']])
    expect(resolveSheet(data, { situations }).cmb.total).toBe(0);
});

it('does not grant Standing Tall timed or completed-story defenses for broad shared Situations', () => {
  const data = modifiers('Standing Tall');
  const mind = data.find((row) => {
    const situation = row.condition?.situation;
    return (
      typeof situation === 'object' &&
      'local' in situation &&
      /mind-affecting/i.test(situation.local)
    );
  })?.condition?.situation;
  const completed = data.find((row) => {
    const situation = row.condition?.situation;
    return (
      typeof situation === 'object' &&
      'local' in situation &&
      /poison/i.test(situation.local)
    );
  })?.condition?.situation;
  if (
    typeof mind !== 'object' ||
    !('local' in mind) ||
    typeof completed !== 'object' ||
    !('local' in completed)
  )
    throw new Error('Missing Standing Tall gated circumstances');
  expect(mind.local).toMatch(/1.minute/i);
  expect(completed.local).toMatch(/1.minute/i);
  expect(completed.local).toMatch(/complet/i);
  for (const target of ['save.fort', 'save.ref', 'save.will'] as const) {
    expect(resolveSheet(data)[target].total).toBe(0);
    expect(
      resolveSheet(data, { situations: ['mindAffecting', 'poison'] })[target]
        .total,
    ).toBe(0);
    for (const situation of [mind, completed])
      expect(
        resolveSheet(data, {
          situations: [
            { ...situation, sheetEntryId: entry('Standing Tall').externalKey },
          ],
        })[target].total,
      ).toBe(2);
    expect(
      resolveSheet(data, {
        situations: [
          { ...mind, sheetEntryId: entry('Standing Tall').externalKey },
          { ...completed, sheetEntryId: entry('Standing Tall').externalKey },
        ],
      })[target].total,
    ).toBe(2);
  }
  const notes =
    importedCatalogEntrySchema.parse(entry('Standing Tall')).situationalNotes ??
    [];
  expect(notes.some((note) => note.situation === 'mindAffecting')).toBe(true);
  expect(notes.some((note) => note.situation === 'poison')).toBe(true);
});

it('stacks Vengeance completed-story saves +1 with its chosen-foe +1 while copies remain one Source', () => {
  const data = modifiers('Vengeance');
  const situations = data.flatMap((row) => {
    const situation = row.condition?.situation;
    return typeof situation === 'object' && 'local' in situation
      ? [{ ...situation, sheetEntryId: entry('Vengeance').externalKey }]
      : [];
  });
  const foe = situations.find((situation) =>
    /chosen foe|chosen enemy/i.test(situation.local),
  );
  const completion = situations.find((situation) =>
    /complet/i.test(situation.local),
  );
  if (!foe || !completion) throw new Error('Missing Vengeance circumstances');
  for (const target of ['save.fort', 'save.ref', 'save.will'] as const) {
    expect(resolveSheet(data)[target].total).toBe(0);
    expect(resolveSheet(data, { situations: [foe] })[target].total).toBe(1);
    expect(resolveSheet(data, { situations: [completion] })[target].total).toBe(
      1,
    );
    expect(
      resolveSheet(data, { situations: [foe, completion] })[target].total,
    ).toBe(2);
    const copy = data.map((row) => ({
      ...row,
      sheetEntryId: 'vengeance-copy',
      catalogEntryId: 'vengeance-copy',
    }));
    expect(
      resolveSheet([...data, ...copy], {
        situations: [
          foe,
          completion,
          { ...foe, sheetEntryId: 'vengeance-copy' },
          { ...completion, sheetEntryId: 'vengeance-copy' },
        ],
      })[target].total,
    ).toBe(2);
  }
  const stacking = data.filter((row) => row.stacksWithinEntry);
  expect(stacking).toHaveLength(1);
  expect(stacking[0]).toMatchObject({ target: 'saves', value: 1 });
});
it.each([
  [
    'Skill Focus (Perception)',
    '6dedf3ae1fc704956ba7ae0bcdbf036e16214e154d96eb9cd0074309991f2b62',
  ],
  [
    'Solo Maneuvers',
    '562ede2788ca31e6e7567e549d75567939b8475ded47d7bcd3ce149440bbdb47',
  ],
  [
    'Wolf Trip',
    '045982a3ac60235d5db28ce843f0aaac92150097c8f0192d0bc7e4c70b55075c',
  ],
  [
    'Standing Tall',
    '36ba1908de3854aecc3219cfa36d9b614aeabb54453e51f5a2f350fe45d43a7b',
  ],
  [
    'Vengeance',
    'cb4737b96ca8948a28b3bf1f84601beebd2462721e450a877285ceda250b3f2b',
  ],
  [
    'Coordinated Maneuvers',
    'ae1c3102af52c551c1edd01d0a63e9c473372e33e684200037cf6980ae37dc07',
  ],
  [
    'Raging Throw',
    '18aa40ef379b30bf1e1ebeecf960872eb48a388962fd153cb06e5622138f7127',
  ],
  [
    'Death or Glory',
    '2ce64631d77ecbd8347be7ad5ba9b5bd3c2f09d90a6080098ffaeb56c14f9345',
  ],
  [
    'Fire Music',
    '51b4bf21b42070ead1c7a43943b384247016c4d34e039532f02a34d6f06eaaa2',
  ],
  [
    'Skaveling Companion',
    '3cbaa2d41741bc2b879a134c70b19f3915cc7f9eb12dffb2fe710b96572d8dd0',
  ],
])('pins independently inspected %s rule bytes', async (name, expectedHash) => {
  const candidate = review.candidates.find((row) => row.name === name);
  if (!candidate)
    throw new Error(`Missing independently reviewed feat: ${name}`);
  expect(
    sha256(
      await readFile(join(inputs.contentPath, candidate.source.path), 'utf8'),
    ),
  ).toBe(expectedHash);
});

it('keeps summoned creature and undead companion statistics off the feat owner', () => {
  for (const name of ['Fire Music', 'Skaveling Companion']) {
    expect(
      modifiers(name).some(
        (row) =>
          row.target.startsWith('ability.') ||
          row.target.startsWith('ac.') ||
          row.target === 'saves',
      ),
      name,
    ).toBe(false);
    expect(entry(name).situationalNotes.length, name).toBeGreaterThan(0);
    expect(
      review.candidates.find((row) => row.name === name)?.mechanicsReview
        .completeCalculation,
    ).toBe(false);
  }
});

it.each([
  { constitution: 12, survivalRanks: 0, met: [false, false] },
  { constitution: 12, survivalRanks: 1, met: [false, true] },
  { constitution: 13, survivalRanks: 0, met: [true, false] },
  { constitution: 13, survivalRanks: 1, met: [true, true] },
])(
  'checks Rugged Northerner prerequisites at Constitution $constitution and $survivalRanks Survival ranks',
  ({ constitution, survivalRanks, met }) => {
    const feat = importedCatalogEntrySchema.parse(entry('Rugged Northerner'));
    expect(feat.prerequisiteText).toBe('Con 13, Survival 1 rank');
    const input = prerequisiteSheet(
      [selectedFeat('rugged')],
      [
        {
          _id: 'rugged',
          name: feat.name,
          ruleIdentity: feat.externalKey,
          modifiers: [],
          detail: { kind: 'feat' },
          prerequisites: feat.prerequisites,
        },
      ],
    );
    const projections = calculateCharacterSheetProjections({
      ...input,
      entries: input.entries.map((row) =>
        row.kind === 'classLevel'
          ? {
              ...row,
              state: { ...row.state, skillRanks: { sur: survivalRanks } },
            }
          : row,
      ),
      catalogEntries: input.catalogEntries.map((row) =>
        row._id === 'base'
          ? {
              ...row,
              modifiers: row.modifiers.map((modifier) =>
                modifier.target === 'ability.con'
                  ? { ...modifier, value: constitution }
                  : modifier,
              ),
            }
          : row,
      ),
    });
    for (const projection of Object.values(projections))
      for (const view of ['current', 'recorded'] as const)
        expect(
          projection.prerequisites
            .filter(
              (check) => check.entryId === 'rugged' && check.view === view,
            )
            .map((check) => check.met),
        ).toEqual(met);
  },
);

it('leaves Inspiring Talent allied ancestral-arms proficiency outstanding without granting it to the feat owner', () => {
  const feat = importedCatalogEntrySchema.parse(entry('Inspiring Talent'));
  expect(feat.description).toContain('within 30 feet of an ally');
  expect(feat.description).toContain('weapon proficiency');
  expect(feat.description).toContain('ancestral arms racial trait');
  expect(feat.proficiencies ?? []).toEqual([]);
  const base = reviewedFeatSheet('Solo Maneuvers');
  const projections = calculateCharacterSheetProjections({
    ...base,
    catalogEntries: base.catalogEntries.map((row) =>
      row._id === 'feat'
        ? {
            _id: row._id,
            name: feat.name,
            ruleIdentity: feat.externalKey,
            modifiers: [],
            detail: { kind: 'feat' },
            proficiencies: feat.proficiencies,
          }
        : row,
    ),
  });
  for (const projection of Object.values(projections))
    expect(projection.proficiencies.grants).toEqual([]);
  expect(
    review.candidates
      .find((candidate) => candidate.name === feat.name)
      ?.mechanicsReview.outstandingCalculations.join(' '),
  ).toMatch(/ancestral.arms proficiencies.*conditional copying grants/i);
});

it.each([
  {
    name: "Lion's Heart",
    sourceHash:
      'b77e15e73c019f85e00c63bca8d4e68c3837040e6aea46425957d93a7c9d669f',
    ruleText: 'You ignore penalties from ability damage to that ability',
    calculation: /ability.damage/i,
  },
  {
    name: 'Owl Swoop',
    sourceHash:
      '2dd0d3fd8f9fa9afd93712492fe1b37f09073b08a68319a586c0a815ab85b8d6',
    ruleText:
      'you can use your base attack bonus in place of your ranks in Acrobatics',
    calculation: /BAB.*Acrobatics ranks/i,
  },
])(
  'keeps $name modeled-stat calculations unresolved instead of declaring its description fully calculated',
  async ({ name, sourceHash, ruleText, calculation }) => {
    const candidate = review.candidates.find((row) => row.name === name);
    if (!candidate) throw new Error(`Missing reviewed feat: ${name}`);
    const raw = await readFile(
      join(inputs.contentPath, candidate.source.path),
      'utf8',
    );
    expect(sha256(raw)).toBe(sourceHash);
    expect(sourceDescription(upstreamRecord.parse(parse(raw)))).toContain(
      ruleText,
    );
    expect(candidate.mechanicsReview.completeCalculation).toBe(false);
    expect(candidate.mechanicsReview.outstandingCalculations.join(' ')).toMatch(
      calculation,
    );
    const description = curation.records.find(
      (record) =>
        record.externalKey === candidate.externalKey &&
        record.kind === 'description',
    );
    expect(description?.diagnostics).toContainEqual({
      kind: 'unresolved',
      text: expect.stringMatching(calculation),
    });
  },
);

it('replaces Coordinated Maneuvers adjacent-ally +2 with escape-grapple +4 instead of adding the alternatives', () => {
  const data = modifiers('Coordinated Maneuvers');
  const situations = data.flatMap((row) => {
    const situation = row.condition?.situation;
    return row.target === 'cmb' &&
      typeof situation === 'object' &&
      'local' in situation
      ? [
          {
            ...situation,
            sheetEntryId: entry('Coordinated Maneuvers').externalKey,
            value: row.value,
          },
        ]
      : [];
  });
  const ordinary = situations.find(
    (row) => row.value === 2 && !/stamina/i.test(row.local),
  );
  const escape = situations.find((row) => row.value === 4);
  if (!ordinary || !escape)
    throw new Error('Missing coordinated maneuver alternatives');
  for (const situation of [ordinary, escape]) {
    expect(situation.local).toMatch(/adjacent.*ally/i);
    expect(situation.local).toMatch(
      /same feat|also has.*feat|also has Coordinated Maneuvers/i,
    );
  }
  expect(escape.local).toMatch(/break.*grapple|escap.*grapple/i);
  expect(resolveSheet(data).cmb.total).toBe(0);
  expect(resolveSheet(data, { situations: [ordinary] }).cmb.total).toBe(2);
  expect(resolveSheet(data, { situations: [escape] }).cmb.total).toBe(4);
  expect(resolveSheet(data, { situations: [ordinary, escape] }).cmb.total).toBe(
    4,
  );
  expect(resolveSheet(data, { situations: ['grapple'] }).cmb.total).toBe(0);
  const stamina = situations.find((row) => /1 stamina/i.test(row.local));
  if (!stamina) throw new Error('Missing paid stamina addition');
  expect(
    resolveSheet(data, { situations: [ordinary, stamina] }).cmb.total,
  ).toBe(4);
  expect(resolveSheet(data, { situations: [escape, stamina] }).cmb.total).toBe(
    6,
  );
  expect(
    resolveSheet(data, { situations: [ordinary, escape, stamina] }).cmb.total,
  ).toBe(6);
});

it.each([
  { constitution: 8, bonus: 0 },
  { constitution: 10, bonus: 0 },
  { constitution: 12, bonus: 1 },
  { constitution: 18, bonus: 4 },
])(
  'uses Constitution bonus $bonus for Raging Throw at Constitution $constitution only for its paid raging bull rush',
  ({ constitution, bonus }) => {
    const data = modifiers('Raging Throw');
    const paid = localSituation('Raging Throw', 'cmb');
    expect(paid.local).toMatch(/rag/i);
    expect(paid.local).toMatch(/bull rush/i);
    expect(paid.local).toMatch(/spend|paid|additional round/i);
    const constitutionBase: InputSourcedModifier = {
      target: 'ability.con',
      bonusType: 'base',
      value: constitution,
      sheetEntryId: 'constitution-base',
      catalogEntryId: 'constitution-base',
      entryName: 'Base Constitution',
      source: 'constitution-base',
      builtIn: true,
    };
    expect(resolveSheet([...data, constitutionBase]).cmb.total).toBe(0);
    expect(
      resolveSheet([...data, constitutionBase], { situations: ['bullRush'] })
        .cmb.total,
    ).toBe(0);
    expect(
      resolveSheet([...data, constitutionBase], { situations: [paid] }).cmb
        .total,
    ).toBe(bonus);
  },
);

it.each([
  { bab: 6, bonus: 4 },
  { bab: 10, bonus: 4 },
  { bab: 11, bonus: 5 },
  { bab: 15, bonus: 5 },
  { bab: 16, bonus: 6 },
  { bab: 19, bonus: 6 },
  { bab: 20, bonus: 7 },
])(
  'scales Death or Glory attack and damage +$bonus at BAB $bab, keeping confirmation as a separate unmodeled quantity',
  ({ bab, bonus }) => {
    const data = modifiers('Death or Glory');
    const attack = localSituation('Death or Glory', 'attack.melee');
    const damage = localSituation('Death or Glory', 'damage.melee');
    expect(attack.local).toMatch(/Large/i);
    expect(attack.local).toMatch(/Death or Glory/i);
    const baseBab: InputSourcedModifier = {
      target: 'bab',
      bonusType: 'base',
      value: bab,
      sheetEntryId: 'bab-base',
      catalogEntryId: 'bab-base',
      entryName: 'Base attack bonus',
      source: 'bab-base',
      builtIn: true,
    };
    for (const target of ['attack.melee', 'damage.melee'] as const) {
      expect(resolveSheet([...data, baseBab])[target].total).toBe(0);
      expect(
        resolveSheet([...data, baseBab], { situations: [attack, damage] })[
          target
        ].total,
      ).toBe(bonus);
    }
    expect(
      resolveSheet([...data, baseBab], { situations: [attack, damage] })[
        'attack.ranged'
      ].total,
    ).toBe(0);
    expect(
      entry('Death or Glory')
        .situationalNotes.map((row) => row.text)
        .join(' '),
    ).toMatch(/critical confirmation/i);
    expect(
      review.candidates
        .find((row) => row.name === 'Death or Glory')
        ?.mechanicsReview.intentionalProseScopes.join(' '),
    ).toMatch(/confirmation/i);
  },
);
it.each([
  ['Versatile Summon Monster', ['PZO1110', 'PZO1112', 'PZO1116']],
  ['Familiar Link', ['PZO1110', 'PZO1115', 'PZO1129']],
  ['Intrusive Presence', ['PZO1110', 'PZO1115', 'PZO1132']],
  ['Lucky Healer', ['PZO1110', 'PZO1121']],
  ['Shadow Walker', ['PZO1110', 'PZO1121']],
  ["Stalker's Focus", ['PZO1129']],
  ['Skaveling Companion', ['PZO1110', 'PZO1116']],
  ['Joined Wings', ['PZO1110', 'PZO1129']],
  ['Stock-Striker Sweep', ['PZO1118']],
  ['Versatile Jinx', ['PZO9415']],
  ['Personal Chronicler', ['PZO1110', 'PZO1117', 'PZO1127', 'PZO9047']],
  ['Binding Throw', ['PZO1110', 'PZO1115', 'PZO1118', 'PZO1131']],
  ['Dirty Disarm', ['PZO1110', 'PZO1115']],
  ['Rat Catcher', ['PZO1110', 'PZO1112']],
  ['Fire Music', ['PZO1110', 'PZO1112', 'PZO1117']],
  ['Piranha Strike', ['PZO1110', 'PZO1112']],
  ['Daggermark Lore', ['PZO1110', 'PZO1129', 'PZO9445', 'PZO9217E']],
  ['Intimidating Confidence', ['PZO1110', 'PZO1117', 'PZO1121']],
])(
  'retains independently verified inherited-rule notice minima for %s without lifting the whole-content hold',
  (name, requiredNotices) => {
    const candidate = review.candidates.find((row) => row.name === name);
    expect(candidate?.requiredNotices, name).toEqual(
      expect.arrayContaining(requiredNotices),
    );
    expect(candidate?.disposition, name).toBe('held');
    expect(candidate?.noticeRequirementsComplete, name).toBe(false);
    expect(candidate?.missingEvidence.length, name).toBeGreaterThan(0);
  },
);
it('keeps Skaveling Companion notices grounded in the pinned Bestiary 2 rule identity', () => {
  const candidate = review.candidates.find(
    (row) => row.name === 'Skaveling Companion',
  );
  expect(candidate?.mechanicsReview.descriptionText).toContain('Bestiary 2 42');
  expect(candidate?.requiredNotices).toContain('PZO1116');
  expect(candidate?.requiredNotices).not.toContain('PZO1121');
});
it('adds Hunter of Dahak +2 to every inherited favored-enemy check and weapon roll only against metallic dragons', () => {
  const data = modifiers('Hunter of Dahak');
  expect(data.map((row) => row.target).sort()).toEqual(
    [
      'attack',
      'damage',
      'skill.blf',
      'skill.kar',
      'skill.kdu',
      'skill.ken',
      'skill.kge',
      'skill.khi',
      'skill.klo',
      'skill.kna',
      'skill.kno',
      'skill.kpl',
      'skill.kre',
      'skill.per',
      'skill.sen',
      'skill.sur',
    ].sort(),
  );
  const skill = localSituation('Hunter of Dahak', 'skill.per');
  const weapon = localSituation('Hunter of Dahak', 'attack');
  expect(skill.local).toMatch(/metallic dragons/i);
  expect(skill.local).toMatch(/favored enemy.*applies/i);
  expect(weapon.local).toMatch(/weapon/i);
  for (const target of [
    'skill.blf',
    'skill.kar',
    'skill.kdu',
    'skill.ken',
    'skill.kge',
    'skill.khi',
    'skill.klo',
    'skill.kna',
    'skill.kno',
    'skill.kpl',
    'skill.kre',
    'skill.per',
    'skill.sen',
    'skill.sur',
  ] as const) {
    expect(resolveSheet(data)[target].total).toBe(0);
    expect(resolveSheet(data, { situations: [skill] })[target].total).toBe(2);
  }
  for (const target of [
    'attack.melee',
    'attack.ranged',
    'damage.melee',
    'damage.ranged',
  ] as const) {
    expect(resolveSheet(data)[target].total).toBe(0);
    expect(resolveSheet(data, { situations: [skill] })[target].total).toBe(0);
    expect(resolveSheet(data, { situations: [weapon] })[target].total).toBe(2);
  }
  expect(resolveSheet(data, { situations: [skill, weapon] }).cmb.total).toBe(0);
  const ordinaryFavoredEnemy: InputSourcedModifier = {
    target: 'skill.per',
    bonusType: 'untyped',
    value: 2,
    sheetEntryId: 'favored-enemy-row',
    catalogEntryId: 'pf1/XmALhWqXdN9yOmtd',
    entryName: 'Favored Enemy source example',
    source: 'pf1/XmALhWqXdN9yOmtd',
    builtIn: false,
  };
  expect(
    resolveSheet([ordinaryFavoredEnemy, ...data], { situations: [skill] })[
      'skill.per'
    ].total,
  ).toBe(4);
});
it('pins the actual inherited Favored Enemy weapon and skill rule used by Hunter of Dahak', async () => {
  const supporting = review.candidates.find(
    (row) => row.name === 'Hunter of Dahak',
  )?.mechanicsReview.supportingSourceEvidence;
  expect(supporting).toHaveLength(1);
  if (!supporting?.[0]) throw new Error('Missing Favored Enemy evidence');
  expect(supporting[0].sha256).toBe(
    'e71815343be31435703e794203f4534d4847f479846e732994562563292dbe20',
  );
  const raw = await readFile(supporting[0].fixturePath, 'utf8');
  expect(sha256(raw)).toBe(supporting[0].sha256);
  expect(sourceDescription(upstreamRecord.parse(parse(raw)))).toContain(
    'he gets a +2 bonus on weapon attack and damage rolls against them',
  );
});
