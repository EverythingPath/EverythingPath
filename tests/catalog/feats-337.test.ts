// @vitest-environment node
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import review from '../../scripts/catalog/legal/feats-337.json';
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
} from '../../src/lib/character-sheet';
import provenance from '../fixtures/feats-337/provenance.json';
import preview from '../fixtures/feats-337/preview.json';
import { heldFeatSheet } from '../fixtures/feats-337/sheet';

const fixtureRoot = resolve('tests/fixtures/feats-337');
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

it('preserves exactly the 100 ticket keys and byte-for-byte pinned pf1-content evidence', async () => {
  const keys = provenance.candidates.map((candidate) => candidate.externalKey);
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(sha256(keys.join('\n'))).toBe(
    'b23f18e2866a7c266539424b9170ffc4b2c0395883c44a4abdffa36c03a1efbf',
  );
  expect(review.candidates.map((candidate) => candidate.externalKey)).toEqual(
    keys,
  );
  expect(
    review.candidates.filter((row) => row.disposition === 'held'),
  ).toHaveLength(100);
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
      .filter((row) => row.disposition === 'supported/admitted')
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
    const { mappingFingerprint, evidenceFingerprints, noticeFingerprints } =
      buildAssessmentBinding({
        entry: row,
        artifact: catalogArtifact,
        ...reviewedAdmission,
        requiredNotices: assessment.requiredNotices,
        evidenceIds: Object.keys(assessment.evidenceFingerprints),
      });
    expect(assessment).toMatchObject({
      mappingFingerprint,
      evidenceFingerprints,
      noticeFingerprints,
    });
  }
  // This entry has no external references; its content closure needs no
  // invented out-of-batch rule bodies to reproduce the final binding.
  const scarred = catalogArtifact.catalog.entries.find(
    (row) => row.name === 'Scarred Legion',
  );
  const assessment = reviewedAdmission.assessments.find(
    (row) => row.externalKey === scarred?.externalKey,
  );
  if (!scarred || !assessment)
    throw new Error('Missing bound Scarred Legion fixture');
  const binding = buildAssessmentBinding({
    entry: scarred,
    artifact: catalogArtifact,
    ...reviewedAdmission,
    requiredNotices: assessment.requiredNotices,
    evidenceIds: Object.keys(assessment.evidenceFingerprints),
  });
  expect(assessment).toMatchObject(binding);
  const changed = buildAssessmentBinding({
    entry: {
      ...scarred,
      modifiers: scarred.modifiers.map((row) =>
        typeof row.value === 'number' ? { ...row, value: row.value + 1 } : row,
      ),
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
        'scripts/catalog/legal/feats-337.json',
      ]),
    });
  }
  for (const candidate of review.candidates) {
    expect(candidate.assessmentStatus).toBe('unresolved');
    expect(candidate.noticeRequirementsComplete).toBe(false);
  }
  const combatTricks = review.candidates.filter((candidate) =>
    candidate.mechanicsReview.descriptionText.includes('Combat Trick'),
  );
  expect(combatTricks).toHaveLength(18);
  for (const candidate of combatTricks) {
    expect(candidate.requiredNotices, candidate.name).toContain('PZO1131');
    expect(candidate.noticeHoldIds, candidate.name).toContain(
      'feats-337-notice-PZO1131-complete-chain',
    );
  }
});

it('applies Scarred Legion Intimidate +2 ordinarily while restricting morale Will +2 to its adjacent ally or charge circumstance', () => {
  const data = modifiers('Scarred Legion');
  const adjacent = localSituation('Scarred Legion', 'save.will');
  expect(adjacent.local).toMatch(/adjacent.*ally/i);
  expect(adjacent.local).toMatch(/charg/i);
  expect(resolveSheet(data)['skill.int'].total).toBe(2);
  expect(resolveSheet(data)['save.will'].total).toBe(0);
  expect(
    resolveSheet(data, { situations: [adjacent] })['save.will'].total,
  ).toBe(2);
  expect(
    resolveSheet(data, { situations: ['charging'] })['save.will'].total,
  ).toBe(0);
  expect(
    resolveSheet(data, {
      situations: [{ ...adjacent, sheetEntryId: 'other' }],
    })['save.will'].total,
  ).toBe(0);
  for (const projection of Object.values(
    calculateCharacterSheetProjections(heldFeatSheet('Scarred Legion')),
  )) {
    expect(projection.breakdowns['skill.int'].total).toBe(2);
    expect(projection.derivedStatistics.will.total).toBe(2);
  }
  for (const projection of Object.values(
    calculateCharacterSheetProjections(heldFeatSheet('Scarred Legion'), {
      situations: [{ ...adjacent, sheetEntryId: 'feat-row' }],
    }),
  ))
    expect(projection.derivedStatistics.will.total).toBe(4);
});

it('keeps Snake Sidewind defensive trip CMD +4 distinct from offensive trip and avoiding prone', () => {
  const data = modifiers('Snake Sidewind');
  const prone = localSituation('Snake Sidewind', 'skill.acr');
  expect(prone.local).toMatch(/avoid.*knocked prone/i);
  const defensiveTrip = localSituation('Snake Sidewind', 'cmd');
  expect(defensiveTrip.local).toMatch(/against trip combat maneuvers/i);
  expect(resolveSheet(data).cmd.total).toBe(0);
  expect(resolveSheet(data, { situations: [defensiveTrip] }).cmd.total).toBe(4);
  expect(resolveSheet(data, { situations: ['trip'] }).cmd.total).toBe(0);
  expect(
    resolveSheet(data, { situations: ['bullRush', 'spells'] }).cmd.total,
  ).toBe(0);
  expect(resolveSheet(data)['skill.acr'].total).toBe(0);
  expect(resolveSheet(data, { situations: [prone] })['skill.acr'].total).toBe(
    4,
  );
  for (const target of ['save.fort', 'save.ref', 'save.will'] as const) {
    expect(resolveSheet(data)[target].total).toBe(0);
    expect(resolveSheet(data, { situations: ['trip'] })[target].total).toBe(0);
    expect(resolveSheet(data, { situations: [prone] })[target].total).toBe(4);
  }
  expect(
    resolveSheet(data, { situations: [{ ...prone, sheetEntryId: 'other' }] })[
      'skill.acr'
    ].total,
  ).toBe(0);
});

it('limits Shadow Dodge +3 dodge AC to movement, lighting and sight conditions without claiming automatic detection', () => {
  const data = modifiers('Shadow Dodge');
  const shadow = localSituation('Shadow Dodge', 'ac.other');
  expect(shadow.local).toMatch(/speed/i);
  expect(shadow.local).toMatch(/normal.*dim|dim.*normal/i);
  expect(shadow.local).toMatch(/sight/i);
  expect(shadow.local).toMatch(/true seeing/i);
  expect(resolveSheet(data)['ac.other'].total).toBe(0);
  expect(resolveSheet(data, { situations: [shadow] })['ac.other'].total).toBe(
    3,
  );
  expect(
    resolveSheet(data, { situations: ['charging'] })['ac.other'].total,
  ).toBe(0);
  expect(
    resolveSheet(data, { situations: [{ ...shadow, sheetEntryId: 'other' }] })[
      'ac.other'
    ].total,
  ).toBe(0);
  const candidate = review.candidates.find(
    (row) => row.name === 'Shadow Dodge',
  );
  expect(candidate?.mechanicsReview.completeCalculation).toBe(false);
  expect(candidate?.mechanicsReview.outstandingMechanics.join(' ')).toMatch(
    /repeatability/i,
  );
});

it('preserves Drunken Brawler one-hour Reflex -2 after its Fortitude and Will +2 bonuses can end', () => {
  const data = modifiers('Drunken Brawler');
  const bonuses = localSituation('Drunken Brawler', 'save.fort');
  const penalty = localSituation('Drunken Brawler', 'save.ref');
  expect(bonuses.local).toMatch(
    /hour.*temporary hit points|temporary hit points.*hour/i,
  );
  expect(penalty.local).toMatch(/hour/i);
  expect(penalty.local).not.toMatch(/until.*temporary hit points/i);
  for (const target of ['save.fort', 'save.ref', 'save.will'] as const)
    expect(resolveSheet(data)[target].total).toBe(0);
  const drinking = resolveSheet(data, { situations: [bonuses, penalty] });
  expect(drinking['save.fort'].total).toBe(2);
  expect(drinking['save.will'].total).toBe(2);
  expect(drinking['save.ref'].total).toBe(-2);
  const lostTemporaryHp = resolveSheet(data, { situations: [penalty] });
  expect(lostTemporaryHp['save.fort'].total).toBe(0);
  expect(lostTemporaryHp['save.will'].total).toBe(0);
  expect(lostTemporaryHp['save.ref'].total).toBe(-2);
  const copy = data.map((row) => ({
    ...row,
    sheetEntryId: 'copied-brawler',
    catalogEntryId: 'copied-brawler',
  }));
  const copied = resolveSheet([...data, ...copy], {
    situations: [
      bonuses,
      penalty,
      { ...bonuses, sheetEntryId: 'copied-brawler' },
      { ...penalty, sheetEntryId: 'copied-brawler' },
    ],
  });
  expect(copied['save.fort'].total).toBe(2);
  expect(copied['save.will'].total).toBe(2);
  expect(copied['save.ref'].total).toBe(-2);
});

it.each([
  {
    name: 'Marid Coldsnap',
    bab: 13,
    classLevel: 'pf1/W8dxwZ1CZiwLKsqr',
    min: 11,
  },
  { name: 'Linnorm Wrath', bab: 9, classLevel: 'pf1/W8dxwZ1CZiwLKsqr', min: 9 },
  {
    name: 'Guarded Charge',
    bab: 6,
    classLevel: 'pf1/WLqBCT5DqmGAx8Wd',
    min: 4,
  },
])(
  'preserves the source BAB-or-class-level prerequisite alternatives for $name',
  ({ name, bab, classLevel, min }) => {
    const feat = importedCatalogEntrySchema.parse(entry(name));
    expect(feat.prerequisites).toContainEqual({
      anyOf: [
        { bab, kind: 'bab' },
        { classLevel, min, kind: 'classLevel' },
      ],
    });
    expect(feat.prerequisiteText).toContain(`base attack bonus +${bab} or`);
  },
);

it('retains source-evidenced armor and divine-class prerequisite gaps as outstanding instead of asserting complete eligibility', () => {
  for (const { name, clause, gap } of [
    {
      name: 'Poised Bearing',
      clause: 'proficiency with medium or heavy armor',
      gap: /proficiency|Heavy Armor|class.feature/i,
    },
    {
      name: 'Divine Expression',
      clause: 'cleric or oracle level 1st',
      gap: /cleric|alternative|class.level/i,
    },
  ]) {
    const feat = importedCatalogEntrySchema.parse(entry(name));
    const candidate = review.candidates.find((row) => row.name === name);
    expect(feat.prerequisiteText).toContain(clause);
    expect(candidate?.mechanicsReview.mappedFacts.prerequisites).toEqual(
      feat.prerequisites,
    );
    expect(candidate?.mechanicsReview.outstandingMechanics.join(' ')).toMatch(
      gap,
    );
    expect(candidate?.mechanicsReview.completeCalculation).toBe(false);
  }
  expect(entry('Poised Bearing').prerequisites).toContainEqual({
    unchecked: 'proficiency with medium or heavy armor',
    kind: 'unchecked',
  });
  expect(entry('Divine Expression').prerequisites).toContainEqual({
    anyOf: [
      { classLevel: 'pf1/SjFqQceVeVBzBwgn', min: 1, kind: 'classLevel' },
      { classLevel: 'pf1/5S0u8yFcP861wgd1', min: 1, kind: 'classLevel' },
    ],
  });
});

it('keeps Cockatrice Strike source BAB +16 and Lore missing rank/subskill calculations without guessed substitutions', async () => {
  const cockatrice = importedCatalogEntrySchema.parse(
    entry('Cockatrice Strike'),
  );
  expect(cockatrice.prerequisiteText).toContain('base attack bonus +16');
  expect(cockatrice.prerequisites).toContainEqual({ bab: 16, kind: 'bab' });
  expect(cockatrice.prerequisites).not.toContainEqual({ bab: 14, kind: 'bab' });
  const cockatriceReview = review.candidates.find(
    (row) => row.name === 'Cockatrice Strike',
  );
  expect(cockatriceReview?.comparison?.comparisonTags).toContain(
    'PRETOTALAB:14',
  );
  const lore = importedCatalogEntrySchema.parse(entry('Skill Focus (Lore)'));
  const raw = upstreamRecord.parse(
    parse(
      await readFile(
        join(
          inputs.contentPath,
          'src/pf-feats/Skill_Focus__Lore__6Unilb6yyaehF9fv.yaml',
        ),
        'utf8',
      ),
    ),
  );
  expect(raw.system.changes).toEqual([
    {
      _id: 't1ujoxfe',
      formula: 'ifelse(gte(@skills.lor.subskills.lor1.rank,10),6,3)',
      target: 'skill.lor',
      type: 'untyped',
    },
  ]);
  expect(lore.modifiers).toEqual([]);
  const loreReview = review.candidates.find(
    (row) => row.name === 'Skill Focus (Lore)',
  );
  expect(loreReview?.mechanicsReview.completeCalculation).toBe(false);
  expect(loreReview?.mechanicsReview.outstandingMechanics.join(' ')).toMatch(
    /Lore|subskill|rank/i,
  );
});

it('adds Champion of Destruction damage against lawful and good creatures within one entry while suppressing same-Source copies', () => {
  const data = modifiers('Champion of Destruction');
  const good = localSituation('Champion of Destruction', 'damage');
  expect(good.local).toMatch(/against good creatures/i);
  expect(data.filter((row) => row.target === 'damage')).toHaveLength(2);
  for (const modifier of data.filter((row) => row.target === 'damage'))
    expect(modifier).toMatchObject({
      value: 2,
      bonusType: 'untyped',
      stacksWithinEntry: true,
    });
  expect(resolveSheet(data)['damage.melee'].total).toBe(0);
  expect(
    resolveSheet(data, { situations: ['lawfulCreatures'] })['damage.melee']
      .total,
  ).toBe(2);
  expect(resolveSheet(data, { situations: [good] })['damage.melee'].total).toBe(
    2,
  );
  expect(
    resolveSheet(data, { situations: ['lawfulCreatures', good] })[
      'damage.melee'
    ].total,
  ).toBe(4);
  const copy = data.map((row) => ({
    ...row,
    sheetEntryId: 'copied-champion',
    catalogEntryId: 'copied-champion',
  }));
  expect(
    resolveSheet([...data, ...copy], {
      situations: [
        'lawfulCreatures',
        good,
        { ...good, sheetEntryId: 'copied-champion' },
      ],
    })['damage.melee'].total,
  ).toBe(4);
});

it('keeps Deny the Reaper Heal rank tiers at +2 or +4 and does not add both when selected together', () => {
  const data = modifiers('Deny the Reaper');
  const tiers = data.filter((row) => row.target === 'skill.hea');
  expect(tiers.map((row) => row.value).sort()).toEqual([2, 4]);
  const situations = tiers.map((row) => {
    const situation = row.condition?.situation;
    if (typeof situation !== 'object' || !('local' in situation))
      throw new Error('Missing Heal rank Situation');
    expect(row.stacksWithinEntry).not.toBe(true);
    expect(situation.local).toMatch(/10.*ranks.*Heal/i);
    return {
      ...situation,
      sheetEntryId: entry('Deny the Reaper').externalKey,
      value: row.value,
    };
  });
  expect(resolveSheet(data)['skill.hea'].total).toBe(0);
  for (const situation of situations)
    expect(
      resolveSheet(data, { situations: [situation] })['skill.hea'].total,
    ).toBe(situation.value);
  expect(resolveSheet(data, { situations })['skill.hea'].total).toBe(4);
  const candidate = review.candidates.find(
    (row) => row.name === 'Deny the Reaper',
  );
  expect(candidate?.mechanicsReview.completeCalculation).toBe(false);
  expect(candidate?.mechanicsReview.outstandingMechanics.join(' ')).toMatch(
    /rank/i,
  );
});
