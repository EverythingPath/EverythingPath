// @vitest-environment node
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import review from '../../scripts/catalog/legal/feats-341.json';
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
import provenance from '../fixtures/feats-341/provenance.json';
import preview from '../fixtures/feats-341/preview.json';
import { reviewedFeatSheet } from '../fixtures/feats-341/sheet';

const fixtureRoot = resolve('tests/fixtures/feats-341');
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

it('pins exactly the 100 ticket keys and byte-for-byte source evidence', async () => {
  expect(provenance.sourceCommit).toBe(
    '02f4ab0d92e0d64f9eb2d127f42fd809cb23db7d',
  );
  const keys = provenance.candidates.map((row) => row.externalKey);
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(sha256(keys.join('\n'))).toBe(
    '35fe3f1c54345ca048742f7612f8c7d41cb46b41129fbb06ed2979d0bb1522d1',
  );
  expect(review.candidates.map((row) => row.externalKey)).toEqual(keys);
  expect(preview.entries.map((row) => row.externalKey)).toEqual(keys);
  expect(
    review.candidates.filter((row) => row.disposition === 'held'),
  ).toHaveLength(100);
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
      status: 'unresolved',
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
    const mechanics = candidate.mechanicsReview;
    expect(mechanics.sourceEvidence.sha256).toBe(candidate.source.sha256);
    expect(mechanics.descriptionText).toBe(sourceDescription(record));
    expect(mechanics.ruleIdentity).toBe(candidate.externalKey);
    for (const field of [
      'sources',
      'detail',
      'modifiers',
      'situationalNotes',
    ] as const)
      expect(mechanics.mappedFacts[field], candidate.name).toEqual(
        entry(candidate.name)[field],
      );
    expect(mechanics.mappedFacts.prerequisites).toEqual(
      entry(candidate.name).prerequisites ?? [],
    );
    expect(mechanics.mappedFacts.prerequisiteText).toBe(
      entry(candidate.name).prerequisiteText ?? '',
    );
    expect(mechanics.curationRecords).toEqual(
      curation.records.filter(
        (row) => row.externalKey === candidate.externalKey,
      ),
    );
    expect(mechanics.completeCalculation).toBe(
      mechanics.outstandingCalculations.length === 0,
    );
  }
});

it('reproduces checked output with reduced sources without inventing absent prerequisite bodies', async () => {
  const artifact = await importCatalog(inputs);
  expect(artifact.catalog.entries).toHaveLength(100);
  const demonstrated = (row: {
    externalKey: string;
    name: string;
    description: string;
    modifiers: unknown;
    sources?: unknown;
    situationalNotes?: unknown;
    grantsSlots?: unknown;
  }) => ({
    externalKey: row.externalKey,
    name: row.name,
    description: row.description,
    modifiers: row.modifiers,
    sources: row.sources,
    situationalNotes: row.situationalNotes,
    grantsSlots: row.grantsSlots,
  });
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

it('keeps all real reviewed bodies held and invalidates changed numeric content', async () => {
  const artifact = await importCatalog(inputs);
  const boundArtifact = {
    ...artifact,
    catalog: {
      ...artifact.catalog,
      entries: preview.entries.map((raw) => {
        const row = importedCatalogEntrySchema.parse(raw);
        if (row.detail.kind !== 'feat')
          throw new Error('Expected feat fixture');
        return { ...row, detail: row.detail };
      }),
    },
  };
  const gate = assessCatalogAdmission({
    artifact: boundArtifact,
    ...reviewedAdmission,
  });
  expect(gate.admitted).toEqual([]);
  expect(gate.failures).toEqual([]);
  expect(gate.dependentOmissions).toEqual([]);
  expect(gate.held.map((row) => row.externalKey).sort()).toEqual(
    provenance.candidates.map((row) => row.externalKey).sort(),
  );
  for (const row of boundArtifact.catalog.entries) {
    const assessment = reviewedAdmission.assessments.find(
      (candidate) => candidate.externalKey === row.externalKey,
    );
    if (!assessment) throw new Error(`Missing assessment: ${row.externalKey}`);
    const binding = buildAssessmentBinding({
      entry: row,
      artifact: boundArtifact,
      ...reviewedAdmission,
      requiredNotices: assessment.requiredNotices,
      evidenceIds: Object.keys(assessment.evidenceFingerprints),
    });
    expect(assessment).toMatchObject(binding);
    if (row.name === 'Stealthy (Mythic)') {
      const changed = buildAssessmentBinding({
        entry: {
          ...row,
          modifiers: row.modifiers.map((modifier) =>
            typeof modifier.value === 'number'
              ? { ...modifier, value: modifier.value + 1 }
              : modifier,
          ),
        },
        artifact: boundArtifact,
        ...reviewedAdmission,
        requiredNotices: assessment.requiredNotices,
        evidenceIds: Object.keys(assessment.evidenceFingerprints),
      });
      expect(changed.contentFingerprint).not.toBe(binding.contentFingerprint);
    }
  }
});

it('enforces named notice holds and inherited-rule minima', () => {
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
        'scripts/catalog/legal/feats-341.json',
      ]),
    });
  }
  expect(review.inheritedNoticeAudit.descriptionsReviewed).toBe(100);
  expect(review.inheritedNoticeAudit.supportingRuleSnapshots).toBe(33);
  expect(review.inheritedNoticeAudit.supportingRuleSnapshots).toBe(
    review.candidates.reduce(
      (count, candidate) =>
        count + candidate.inheritedRuleSourceEvidence.length,
      0,
    ),
  );
  expect(review.inheritedNoticeAudit.candidateKeys).toEqual(
    review.candidates.map((row) => row.externalKey),
  );
  for (const candidate of review.candidates) {
    for (const inherited of candidate.inheritedRuleNotices)
      expect(candidate.requiredNotices, candidate.name).toContain(
        inherited.book,
      );
    if (candidate.mechanicsReview.descriptionText.includes('Combat Trick'))
      expect(candidate.requiredNotices, candidate.name).toContain('PZO1131');
    if (
      candidate.mechanicsReview.descriptionText.includes('Completion Benefit')
    ) {
      expect(candidate.requiredNotices, candidate.name).toContain('PZO1125');
      expect(candidate.noticeHoldIds, candidate.name).toContain(
        'feats-341-notice-PZO1125-complete-chain',
      );
    }
  }
  for (const [name, notices] of [
    ['Remote Bomb', ['PZO1115', 'PZO1117']],
    ['Sleep Venom', ['PZO1121', 'PZO1110']],
    ['Draconic Aspect', ['PZO1121']],
    ['Heavenly Radiance', ['PZO1121', 'PZO1115', 'PZO1110']],
    ['Eerily Centered', ['PZO9480', 'PZO1110']],
    ['First General of the East', ['PZO1133', 'PZO1110']],
  ] as const)
    expect(
      review.candidates.find((row) => row.name === name)?.requiredNotices,
      name,
    ).toEqual(expect.arrayContaining([...notices]));
  expect(
    review.candidates.find((row) => row.name === 'First General of the East')
      ?.noticeHoldIds,
  ).toContain('feats-341-notice-PZO1133-complete-chain');
  expect(
    review.candidates.find((row) => row.name === 'Natural Jouster')
      ?.requiredNotices,
  ).toEqual(['PZO1110']);
});

it('pins the Shabti race source required by First General of the East', async () => {
  const candidate = review.candidates.find(
    (row) => row.name === 'First General of the East',
  );
  const evidence = candidate?.inheritedRuleSourceEvidence.find(
    (row) => row.name === 'Shabti',
  );
  if (!evidence || !('citedSources' in evidence))
    throw new Error('Missing pinned Shabti source citation');
  const raw = await readFile(
    join(fixtureRoot, 'supporting-sources/shabti.H6tsZqHiaTOcFSOn.yaml'),
    'utf8',
  );
  expect(sha256(raw)).toBe(evidence.sha256);
  expect(evidence.citedSources).toEqual([{ id: 'PZO1133', pages: '227' }]);
  expect(upstreamRecord.parse(parse(raw)).system.sources).toEqual(
    evidence.citedSources,
  );
  expect(candidate?.mechanicsReview.descriptionText).toContain(
    'Character level 5th, shabti.',
  );
});

it('preserves supported prerequisite facts and leaves unsupported feature requirements readable', () => {
  expect(entry('Acupuncture Specialist').prerequisites).toContainEqual({
    kind: 'skillRanks',
    skillRanks: 'skill.hea',
    min: 5,
  });
  expect(entry('Body Control').prerequisites).toContainEqual({
    kind: 'ability',
    ability: 'wisdom',
    min: 11,
  });
  expect(entry('Careful Speaker').prerequisites).toContainEqual({
    kind: 'ability',
    ability: 'wisdom',
    min: 13,
  });
  expect(entry('Spider Climber').prerequisites).toContainEqual({
    kind: 'characterLevel',
    characterLevel: 3,
  });
  expect(entry('Forester').prerequisiteText).toMatch(
    /favored terrain.*forest/i,
  );
});

it('pins the ordinary Stealthy body that establishes +2/+4 baseline amounts', async () => {
  const raw = await readFile(
    join(fixtureRoot, 'supporting-sources/stealthy.f5FPqAYWlKj3zCIY.yaml'),
    'utf8',
  );
  expect(sha256(raw)).toBe(
    '6b0d65c2bfbf8e5160b8e3d43d3267580fa48797ae6f4867a507c8821abb2b03',
  );
  const record = upstreamRecord.parse(parse(raw));
  expect(record._id).toBe('f5FPqAYWlKj3zCIY');
  expect(sourceDescription(record)).toMatch(
    /\+2 bonus.*10 or more ranks.*\+4/s,
  );
});

it('adds only the Mythic Stealthy +2 increment to ordinary +2/+4 bonuses and suppresses same-Source copies', () => {
  const data = modifiers('Stealthy (Mythic)');
  for (const baseValue of [2, 4]) {
    const ordinary: InputSourcedModifier[] = (
      ['skill.esc', 'skill.ste'] as const
    ).map((target) => ({
      target,
      value: baseValue,
      bonusType: 'untyped',
      sheetEntryId: 'ordinary-stealthy',
      catalogEntryId: 'pf1/f5FPqAYWlKj3zCIY',
      source: 'pf1/f5FPqAYWlKj3zCIY',
      entryName: 'Stealthy',
      builtIn: false,
    }));
    const copy = data.map((row) => ({
      ...row,
      sheetEntryId: 'copied-stealth',
      catalogEntryId: 'copied-stealth',
    }));
    for (const target of ['skill.esc', 'skill.ste'] as const) {
      expect(resolveSheet(data)[target].total).toBe(2);
      expect(resolveSheet([...ordinary, ...data])[target].total).toBe(
        baseValue + 2,
      );
      expect(resolveSheet([...ordinary, ...data, ...copy])[target].total).toBe(
        baseValue + 2,
      );
    }
  }
});

it('limits Crane Style +1 dodge AC to its style and defensive circumstance', () => {
  const data = modifiers('Crane Style');
  const defensive = localSituation('Crane Style', 'ac.other');
  expect(defensive.local).toMatch(/Crane Style/i);
  expect(defensive.local).toMatch(/fighting defensively.*total defense/i);
  expect(resolveSheet(data)['ac.other'].total).toBe(0);
  expect(
    resolveSheet(data, { situations: [defensive] })['ac.other'].total,
  ).toBe(1);
  expect(
    resolveSheet(data, { situations: ['fighting-defensively'] })['ac.other']
      .total,
  ).toBe(0);
  expect(
    resolveSheet(data, {
      situations: [{ ...defensive, sheetEntryId: 'other' }],
    })['ac.other'].total,
  ).toBe(0);
});

it('limits Spider Climber +4 saves to web effects', () => {
  const data = modifiers('Spider Climber');
  const webs = localSituation('Spider Climber', 'saves');
  expect(webs.local).toMatch(/web/i);
  for (const target of ['save.fort', 'save.ref', 'save.will'] as const) {
    expect(resolveSheet(data)[target].total).toBe(0);
    expect(resolveSheet(data, { situations: [webs] })[target].total).toBe(4);
    expect(resolveSheet(data, { situations: ['poison'] })[target].total).toBe(
      0,
    );
    expect(
      resolveSheet(data, { situations: [{ ...webs, sheetEntryId: 'other' }] })[
        target
      ].total,
    ).toBe(0);
  }
});

it('adds Champion of Tyranny +2 against chaotic or good foes and +4 against chaotic good', () => {
  const data = modifiers('Champion of Tyranny');
  expect(resolveSheet(data)['damage.melee'].total).toBe(0);
  expect(
    resolveSheet(data, { situations: ['chaoticCreatures'] })['damage.melee']
      .total,
  ).toBe(2);
  expect(
    resolveSheet(data, { situations: ['goodCreatures'] })['damage.melee'].total,
  ).toBe(2);
  expect(
    resolveSheet(data, {
      situations: ['chaoticCreatures', 'goodCreatures'],
    })['damage.melee'].total,
  ).toBe(4);
  const copy = data.map((row) => ({
    ...row,
    sheetEntryId: 'copied-champion',
    catalogEntryId: 'copied-champion',
  }));
  expect(
    resolveSheet([...data, ...copy], {
      situations: ['chaoticCreatures', 'goodCreatures'],
    })['damage.melee'].total,
  ).toBe(4);
});

it('limits Body Control saves to meditation and the listed harms without overlapping bonuses', () => {
  const data = modifiers('Body Control');
  const situations = data.map((row) => row.condition?.situation);
  expect(situations.length).toBeGreaterThan(0);
  const local = situations.map((situation) => {
    if (typeof situation !== 'object' || !('local' in situation))
      throw new Error('Missing meditation-qualified Body Control Situation');
    expect(situation.local).toMatch(/meditat/i);
    return { ...situation, sheetEntryId: entry('Body Control').externalKey };
  });
  expect(resolveSheet(data)['save.fort'].total).toBe(0);
  for (const situation of local)
    expect(
      resolveSheet(data, { situations: [situation] })['save.fort'].total,
    ).toBe(1);
  expect(resolveSheet(data, { situations: local })['save.fort'].total).toBe(1);
  expect(
    resolveSheet(data, { situations: ['poison', 'disease'] })['save.fort']
      .total,
  ).toBe(0);
  expect(
    resolveSheet(data, {
      situations: local.map((situation) => ({
        ...situation,
        sheetEntryId: 'other',
      })),
    })['save.fort'].total,
  ).toBe(0);
});

it('limits Forester +1 Reflex to adjacency to at least two trees', () => {
  const data = modifiers('Forester');
  const trees = localSituation('Forester', 'save.ref');
  expect(trees.local).toMatch(/two|2/i);
  expect(resolveSheet(data)['save.ref'].total).toBe(0);
  expect(resolveSheet(data, { situations: [trees] })['save.ref'].total).toBe(1);
  expect(resolveSheet(data, { situations: ['cover'] })['save.ref'].total).toBe(
    0,
  );
  expect(
    resolveSheet(data, {
      situations: [{ ...trees, sheetEntryId: 'other' }],
    })['save.ref'].total,
  ).toBe(0);
});

it('retains unsupported cover and spell-resistance calculations as readable rules', () => {
  const forester = review.candidates.find((row) => row.name === 'Forester');
  const disbelief = review.candidates.find(
    (row) => row.name === 'Focused Disbelief',
  );
  expect(forester?.mechanicsReview.outstandingCalculations.join(' ')).toMatch(
    /cover/i,
  );
  expect(disbelief?.mechanicsReview.outstandingCalculations.join(' ')).toMatch(
    /spell resistance|SR/i,
  );
  expect(entry('Forester').description).toMatch(/\+1 cover.*\+2 cover/i);
  expect(entry('Focused Disbelief').description).toMatch(
    /11 \+ your character level/i,
  );
  expect(
    modifiers('Forester').filter((row) => row.target === 'ac.other'),
  ).toEqual([]);
});

it('agrees with public sheet projections for the real reviewed bodies', () => {
  const stealth = calculateCharacterSheetProjections(
    reviewedFeatSheet('Stealthy (Mythic)'),
  );
  expect(stealth.current.breakdowns['skill.esc'].total).toBe(2);
  expect(stealth.current.breakdowns['skill.ste'].total).toBe(2);
  const crane = reviewedFeatSheet('Crane Style');
  const defensive = localSituation('Crane Style', 'ac.other');
  expect(
    calculateCharacterSheetProjections(crane).current.breakdowns['ac.other']
      .total,
  ).toBe(0);
  expect(
    calculateCharacterSheetProjections(crane, {
      situations: [{ ...defensive, sheetEntryId: 'feat-row' }],
    }).current.breakdowns['ac.other'].total,
  ).toBe(1);
});
