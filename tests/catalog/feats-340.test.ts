// @vitest-environment node
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import review from '../../scripts/catalog/legal/feats-340.json';
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
import provenance from '../fixtures/feats-340/provenance.json';
import preview from '../fixtures/feats-340/preview.json';
import { reviewedFeatSheet } from '../fixtures/feats-340/sheet';
import { expectAutomaticSkillFocus } from './skill-focus-assertions';

const fixtureRoot = resolve('tests/fixtures/feats-340');
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
  expect(provenance.sourceCommit).toBe(
    '02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d',
  );
  const keys = provenance.candidates.map((candidate) => candidate.externalKey);
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(sha256(keys.join('\n'))).toBe(
    '88e6d477ae1d88034494e7f7d5ebfad43fcf29753eead2d6fdb92c8cb6fc2431',
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
  ).toEqual(['Skill Focus (Knowledge [Local])']);
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
    (row) => row.name === 'Skill Focus (Knowledge [Local])',
  );
  const assessment = reviewedAdmission.assessments.find(
    (row) => row.externalKey === focus?.externalKey,
  );
  if (!focus || !assessment)
    throw new Error('Missing bound Skill Focus Knowledge Local fixture');
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

it('enforces every batch notice hold and records inherited notices as minima', () => {
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
        'scripts/catalog/legal/feats-340.json',
      ]),
    });
  }
  expect(review.inheritedNoticeAudit.candidateKeys).toEqual(
    review.candidates.map((candidate) => candidate.externalKey),
  );
  for (const candidate of review.candidates) {
    for (const inherited of candidate.inheritedRuleNotices)
      expect(candidate.requiredNotices, candidate.name).toContain(
        inherited.book,
      );
    if (candidate.mechanicsReview.descriptionText.includes('Combat Trick'))
      expect(candidate.requiredNotices, candidate.name).toContain('PZO1131');
    expect(candidate.noticeRequirementsComplete).toBe(
      candidate.disposition === 'admitted',
    );
  }
  for (const name of ['Half-Drow Paragon', 'Armor of the Pit'])
    expect(
      review.candidates.find((row) => row.name === name)?.requiredNotices,
      name,
    ).toContain('PZO1121');
  expect(
    review.candidates.find((row) => row.name === 'Raging Blood')
      ?.requiredNotices,
  ).toContain('PZO1129');
});

// #724: the rank threshold is automatic, read from the skill's recorded ranks.
it('gives Skill Focus (Knowledge [Local]) +3, or +6 at 10 ranks, without a Situation or a stacking same-Source copy', () => {
  const data = modifiers('Skill Focus (Knowledge [Local])');
  expectAutomaticSkillFocus({ modifiers: data, target: 'skill.klo' });
});

it('limits Horse Whisperer +2 to handling and riding horses', () => {
  const data = modifiers('Horse Whisperer');
  for (const target of ['skill.han', 'skill.rid'] as const) {
    const horses = localSituation('Horse Whisperer', target);
    expect(horses.local).toMatch(/horses/i);
    expect(resolveSheet(data)[target].total).toBe(0);
    expect(resolveSheet(data, { situations: [horses] })[target].total).toBe(2);
    expect(resolveSheet(data, { situations: ['charging'] })[target].total).toBe(
      0,
    );
    expect(
      resolveSheet(data, {
        situations: [{ ...horses, sheetEntryId: 'other' }],
      })[target].total,
    ).toBe(0);
  }
});

it('adds Bear Hug damage +2 only against the grappled foe', () => {
  const data = modifiers('Bear Hug');
  const grapple = localSituation('Bear Hug', 'damage');
  expect(grapple.local).toMatch(/grappl/i);
  expect(resolveSheet(data)['damage.melee'].total).toBe(0);
  expect(
    resolveSheet(data, { situations: [grapple] })['damage.melee'].total,
  ).toBe(2);
  expect(
    resolveSheet(data, { situations: ['grappled'] })['damage.melee'].total,
  ).toBe(0);
  expect(
    resolveSheet(data, { situations: [{ ...grapple, sheetEntryId: 'other' }] })[
      'damage.melee'
    ].total,
  ).toBe(0);
});

it('keeps Ironguts saves restricted to nausea, sickening and ingested poison and foraging to self', () => {
  const data = modifiers('Ironguts');
  const save = localSituation('Ironguts', 'saves');
  const food = localSituation('Ironguts', 'skill.sur');
  expect(save.local).toMatch(/ingest/i);
  expect(save.local).toMatch(/nauseat|sicken/i);
  expect(food.local).toMatch(/yourself|self|alone|only/i);
  for (const target of ['save.fort', 'save.ref', 'save.will'] as const) {
    expect(resolveSheet(data)[target].total).toBe(0);
    expect(resolveSheet(data, { situations: [save] })[target].total).toBe(2);
    expect(
      resolveSheet(data, { situations: ['poison', 'disease'] })[target].total,
    ).toBe(0);
  }
  expect(resolveSheet(data)['skill.sur'].total).toBe(0);
  expect(resolveSheet(data, { situations: [food] })['skill.sur'].total).toBe(2);
});

it('pins the ordinary Alertness and Dodge bodies used to calculate incremental bonuses', async () => {
  for (const [name, hash] of [
    [
      'alertness.Q1cY8r0Pvb66pMG0.yaml',
      '3b758a6d290ed992539d97beb03ed7e3c09a76aa222b1fe31859b0c9a30c94a1',
    ],
    [
      'dodge.JreaiTHdyWFNj3Tb.yaml',
      '40937a5acedc7c6690c29c4a97fd670201aa6a7d4f2544e4a1ccf6aa7932dc8e',
    ],
  ] as const)
    expect(
      sha256(
        await readFile(join(fixtureRoot, 'supporting-sources', name), 'utf8'),
      ),
    ).toBe(hash);
});

it('adds the Mythic Alertness +2 increment to ordinary Alertness +2 or +4', () => {
  const data = modifiers('Alertness (Mythic)');
  for (const baseValue of [2, 4]) {
    const ordinary: InputSourcedModifier[] = (
      ['skill.per', 'skill.sen'] as const
    ).map((target) => ({
      target,
      value: baseValue,
      bonusType: 'untyped',
      sheetEntryId: 'ordinary-alertness',
      catalogEntryId: 'pf1/Q1cY8r0Pvb66pMG0',
      source: 'pf1/Q1cY8r0Pvb66pMG0',
      entryName: 'Alertness',
      builtIn: false,
    }));
    const result = resolveSheet([...ordinary, ...data]);
    expect(result['skill.per'].total).toBe(baseValue + 2);
    expect(result['skill.sen'].total).toBe(baseValue + 2);
  }
});

it('agrees with the public sheet projection for reviewed Knowledge Local and isolated horse Situations', () => {
  // #724: no Situation; with no ranks and Intelligence 10, Skill Focus's +3.
  const focus = reviewedFeatSheet('Skill Focus (Knowledge [Local])');
  expect(
    calculateCharacterSheetProjections(focus).current.breakdowns['skill.klo']
      .total,
  ).toBe(3);
  const horse = reviewedFeatSheet('Horse Whisperer');
  const circumstance = localSituation('Horse Whisperer', 'skill.han');
  expect(
    calculateCharacterSheetProjections(horse).current.breakdowns['skill.han']
      .total,
  ).toBe(0);
  expect(
    calculateCharacterSheetProjections(horse, {
      situations: [{ local: circumstance.local, sheetEntryId: 'feat-row' }],
    }).current.breakdowns['skill.han'].total,
  ).toBe(2);
});

it('increases ordinary Dodge +1 to +2 and adds the +10 expenditure only against its selected attack', () => {
  const data = modifiers('Dodge (Mythic)');
  const attack = localSituation('Dodge (Mythic)', 'ac');
  expect(attack.local).toMatch(/one attack/i);
  expect(attack.local).toMatch(/mythic power/i);
  const ordinary: InputSourcedModifier = {
    target: 'ac',
    bonusType: 'dodge',
    value: 1,
    sheetEntryId: 'ordinary-dodge',
    catalogEntryId: 'pf1/JreaiTHdyWFNj3Tb',
    source: 'pf1/JreaiTHdyWFNj3Tb',
    entryName: 'Dodge',
    builtIn: false,
  };
  expect(resolveSheet([ordinary, ...data])['ac.other'].total).toBe(2);
  expect(
    resolveSheet([ordinary, ...data], { situations: [attack] })['ac.other']
      .total,
  ).toBe(12);
  expect(
    resolveSheet([ordinary, ...data], { situations: ['charging'] })['ac.other']
      .total,
  ).toBe(2);
  expect(
    resolveSheet([ordinary, ...data], {
      situations: [{ ...attack, sheetEntryId: 'other' }],
    })['ac.other'].total,
  ).toBe(2);
});

it('uses registered shared Situations and keeps narrower compound circumstances local', () => {
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
  expect(localSituation('Ironguts', 'saves').local).toMatch(
    /ingested poisons/i,
  );
  expect(localSituation('Horse Whisperer', 'skill.han').local).toMatch(
    /horses/i,
  );
});

it('uses Snapping Turtle Style shield +1 or stamina +2 without adding the alternatives', () => {
  const data = modifiers('Snapping Turtle Style');
  const scopes = data
    .filter((row) => row.target === 'ac.shield')
    .map((row) => {
      const situation = row.condition?.situation;
      if (typeof situation !== 'object' || !('local' in situation))
        throw new Error('Missing Snapping Turtle stance Situation');
      expect(situation.local).toMatch(/at least one hand free/i);
      return {
        ...situation,
        sheetEntryId: entry('Snapping Turtle Style').externalKey,
      };
    });
  expect(scopes).toHaveLength(2);
  const stamina = scopes.find((scope) => /stamina/i.test(scope.local));
  const ordinary = scopes.find((scope) => !/stamina/i.test(scope.local));
  if (!stamina || !ordinary) throw new Error('Missing shield alternatives');
  expect(resolveSheet(data)['ac.shield'].total).toBe(0);
  expect(
    resolveSheet(data, { situations: [ordinary] })['ac.shield'].total,
  ).toBe(1);
  expect(resolveSheet(data, { situations: [stamina] })['ac.shield'].total).toBe(
    2,
  );
  expect(resolveSheet(data, { situations: scopes })['ac.shield'].total).toBe(2);
  expect(
    resolveSheet(data, { situations: ['charging'] })['ac.shield'].total,
  ).toBe(0);
});

it('uses Mythic Leap +5 or +10 with ordinary Predator Leap and never adds a fabricated base bonus', async () => {
  const raw = await readFile(
    join(
      fixtureRoot,
      'supporting-sources',
      'aspect-of-the-beast.dPLj98GIzbwcoOjn.yaml',
    ),
    'utf8',
  );
  expect(sha256(raw)).toBe(
    '2af33693525db20aa1def7be923644d1d2a44c2dc09f6e0238ad84be670c858b',
  );
  const description = sourceDescription(upstreamRecord.parse(parse(raw)));
  expect(description).toMatch(/Predator's.*Leap/);
  expect(description).toContain(
    'You can make a running jump without needing to run 10 feet before you jump.',
  );
  expect(description).not.toMatch(/\+4/);
  const data = modifiers('Aspect of the Beast (Mythic)');
  const leaps = data.filter((row) => row.target === 'skill.acr');
  expect(leaps.map((row) => row.value)).toEqual([5, 10]);
  const scopes = leaps.map((row) => {
    const situation = row.condition?.situation;
    if (typeof situation !== 'object' || !('local' in situation))
      throw new Error('Missing Mythic Leap Situation');
    return {
      ...situation,
      sheetEntryId: entry('Aspect of the Beast (Mythic)').externalKey,
    };
  });
  const [ordinary, predator] = scopes;
  if (!ordinary || !predator) throw new Error('Missing leap alternatives');
  expect(resolveSheet(data)['skill.acr'].total).toBe(0);
  expect(
    resolveSheet(data, { situations: [ordinary] })['skill.acr'].total,
  ).toBe(5);
  expect(
    resolveSheet(data, { situations: [predator] })['skill.acr'].total,
  ).toBe(10);
  expect(resolveSheet(data, { situations: scopes })['skill.acr'].total).toBe(
    10,
  );
});
