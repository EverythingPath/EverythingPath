// @vitest-environment node
import { recordedPrerequisiteFacts } from './prerequisite-audit-739';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import review from '../../scripts/catalog/legal/feats-343.json';
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
  resolveSheet,
  calculateCharacterSheetProjections,
} from '../../src/lib/character-sheet';
import preview from '../fixtures/feats-343/preview.json';
import provenance from '../fixtures/feats-343/provenance.json';
import originalAssessmentIdentities from '../fixtures/feats-343/original-assessment-identities.json';
import { reviewedFeatSheet } from '../fixtures/feats-343/sheet';
import { findCommittedBatchOwnershipProblems } from './batch-ownership';
import { expectAutomaticSkillFocus } from './skill-focus-assertions';

const fixtureRoot = resolve('tests/fixtures/feats-343');
const inputs = {
  systemPath: join(fixtureRoot, 'pf1'),
  contentPath: join(fixtureRoot, 'pf1-content'),
  remaps: [],
  curation: reviewedCuration,
};
const sha256 = (text: string) =>
  createHash('sha256').update(text).digest('hex');
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

it('retains Truth-Seeker’s explicit APG dependency and unresolved quest-table book', async () => {
  const candidate = review.candidates.find(
    (row) => row.name === 'Truth-Seeker',
  );
  if (!candidate) throw new Error('Missing Truth-Seeker review');
  expect(candidate.requiredNotices).toEqual([
    'PZO9433',
    'PZO1110',
    'PZO1125',
    'PZO1115',
  ]);
  expect(candidate.inheritedRuleNotices).toContainEqual(
    expect.objectContaining({ book: 'PZO1115' }),
  );
  const source = candidate.inheritedRuleSourceEvidence.find(
    (row) => row.name === 'Skeptic (APG)',
  );
  if (!source) throw new Error('Missing Skeptic APG evidence');
  const text = await readFile(join(fixtureRoot, source.fixturePath), 'utf8');
  expect(text.split('\n')[2]).toContain("SOURCELONG:Advanced Player's Guide");
  const row = text.split('\n')[50];
  expect(row).toContain('KEY:Trait ~ Skeptic');
  expect(row).toContain('SOURCEPAGE:p.329');
  expect(row).toContain(
    '+2 trait bonus on all saving throws against illusions',
  );
  expect(candidate.noticeHoldIds).toContain(
    'feats-343-notice-PZO1115-complete-chain',
  );
  const table = candidate.questTableNoticeReview;
  if (!table) throw new Error('Missing quest-table notice review');
  expect(table.status).toBe('unresolved-book-identification');
  expect(table.pageReferences).toEqual([
    174, 91, 130, 211, 212, 94, 212, 145, 169, 177, 179, 198,
  ]);
  expect(candidate.holdIds).toContain(table.holdId);
  expect(candidate.disposition).toBe('held');
  expect(candidate.noticeRequirementsComplete).toBe(false);
  const evidence = JSON.parse(
    reviewedAdmission.evidence[candidate.evidenceId]!.content,
  );
  expect(evidence.inheritedRuleSourceEvidence).toEqual(
    candidate.inheritedRuleSourceEvidence,
  );
  expect(evidence.questTableNoticeReview).toEqual(table);
  expect(evidence.requiredNotices).toEqual(candidate.requiredNotices);
});

it('keeps its own description records, assessments, evidence and holds as recorded', () => {
  expect(
    findCommittedBatchOwnershipProblems('scripts/catalog/legal/feats-343.json'),
  ).toEqual([]);
});

it('keeps its whole-history assessment baseline on disk until the #744 cleanup', () => {
  // #749 retired this baseline's checks; the file itself stays as recorded.
  expect(originalAssessmentIdentities.externalKeys).toHaveLength(2334);
});

it('accounts for exactly the ticket keys, raw bytes, checked descriptions and mapped facts', async () => {
  const keys = provenance.candidates.map((row) => row.externalKey);
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(sha256(keys.join('\n'))).toBe(
    'dd0c84e63c4d6df2f9334a8ddbc7fa1aa60b50745ac9fe9c873b8a8dd647163f',
  );
  expect(provenance.candidateKeysSha256).toBe(
    'dd0c84e63c4d6df2f9334a8ddbc7fa1aa60b50745ac9fe9c873b8a8dd647163f',
  );
  expect(review.candidates.map((row) => row.externalKey)).toEqual(keys);
  expect(preview.entries.map((row) => row.externalKey)).toEqual(keys);
  expect(review.counts).toEqual({
    total: 100,
    admitted: 1,
    held: 99,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 0,
    recordLevel35Holds: 0,
  });
  for (const candidate of review.candidates) {
    const bytes = await readFile(
      join(inputs.contentPath, candidate.source.path),
      'utf8',
    );
    expect(sha256(bytes), candidate.name).toBe(candidate.source.sha256);
    const raw = upstreamRecord.parse(parse(bytes));
    expect(`pf1-content/${raw._id}`).toBe(candidate.externalKey);
    expect(sourceDescription(raw)).toBe(
      candidate.mechanicsReview.descriptionText,
    );
    expect(sha256(sourceDescription(raw))).toBe(candidate.descriptionSha256);
    expect(candidate.mechanicsReview.mappedFacts.modifiers).toEqual(
      entry(candidate.name).modifiers,
    );
    expect(candidate.mechanicsReview.mappedFacts.sources).toEqual([]);
    expect(candidate.mechanicsReview.mappedFacts.prerequisites).toEqual(
      entry(candidate.name).prerequisites ?? [],
    );
    expect(candidate.mechanicsReview.curationRecords).toEqual(
      reviewedCuration.records.filter(
        (row) => row.externalKey === candidate.externalKey,
      ),
    );
    expect(candidate.mechanicsReview.outstandingCalculations).not.toEqual([]);
    expect(candidate.mechanicsReview.completeCalculation).toBe(false);
    expect(
      reviewedAdmission.assessments.find(
        (row) => row.externalKey === candidate.externalKey,
      ),
    ).toMatchObject({
      status: candidate.assessmentStatus,
      requiredNotices: candidate.requiredNotices,
      // #724 re-bound the admitted Skill Focus assessments.
      reviewedBy: candidate.name.startsWith('Skill Focus (')
        ? 'Opus (AI curator) for the owner'
        : 'Sol (AI curator) for the owner',
      reviewedOn: candidate.name.startsWith('Skill Focus (')
        ? '2026-10-14'
        : '2026-10-08',
    });
    expect(reviewedAdmission.evidence[candidate.evidenceId]?.content).toContain(
      candidate.source.sha256,
    );
    if (candidate.disposition === 'held')
      expect(candidate.holdIds).toEqual([`feats-343-whole-content-${raw._id}`]);
  }
});

it('reproduces reduced mechanics and admits only the current complete-source CRB comparison', async () => {
  const artifact = await importCatalog(inputs);
  expect(artifact.curation.passed).toBe(true);
  expect(artifact.curation.summary.required).toBe(0);
  expect(artifact.curation.summary.descriptions.checked).toBe(100);
  expect(artifact.curation.summary.descriptions.drafted).toBe(0);
  expect(artifact.curation.unresolvedMechanics).toEqual([]);
  expect(artifact.curation.unresolvedDescriptions).toHaveLength(100);
  for (const row of artifact.catalog.entries) {
    expect(row.modifiers).toEqual(entry(row.name).modifiers);
    expect(row.situationalNotes).toEqual(entry(row.name).situationalNotes);
  }
  // Complete-source bodies retain the actual out-of-batch prerequisite keys.
  // The reduced extraction neither invents those definitions nor proves release attribution.
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
  expect(gate.admitted.map((row) => row.name)).toEqual([
    'Skill Focus (Knowledge [Nobility])',
  ]);
  expect(gate.held).toHaveLength(99);
  expect(gate.dependentOmissions).toEqual([]);
  for (const row of bound.catalog.entries) {
    const candidate = review.candidates.find(
      (c) => c.externalKey === row.externalKey,
    );
    if (!candidate) throw new Error('Missing review');
    expect(
      reviewedAdmission.assessments.find(
        (c) => c.externalKey === row.externalKey,
      ),
    ).toMatchObject(
      buildAssessmentBinding({
        entry: row,
        artifact: bound,
        ...reviewedAdmission,
        requiredNotices: candidate.requiredNotices,
        evidenceIds: [candidate.evidenceId],
      }),
    );
  }
  const accepted = bound.catalog.entries.find((row) =>
    row.name.includes('Nobility'),
  );
  if (!accepted) throw new Error('Missing accepted example');
  const changed = {
    ...bound,
    catalog: {
      ...bound.catalog,
      entries: bound.catalog.entries.map((row) =>
        row === accepted
          ? { ...row, description: row.description + ' changed' }
          : row,
      ),
    },
  };
  expect(
    assessCatalogAdmission({ artifact: changed, ...reviewedAdmission })
      .admitted,
  ).toEqual([]);
  const evidence = {
    ...reviewedAdmission.evidence,
    'feats-343-IGlL6mwZTu6RScYr': {
      content: 'revoked comparison',
      revoked: true,
    },
  };
  expect(
    assessCatalogAdmission({ artifact: bound, ...reviewedAdmission, evidence })
      .admitted,
  ).toEqual([]);
});

it('enforces inherited books, notice-chain holds and hashes every comparison snapshot', async () => {
  for (const candidate of review.candidates) {
    for (const dependency of candidate.inheritedRuleNotices)
      expect(candidate.requiredNotices, candidate.name).toContain(
        dependency.book,
      );
    if (candidate.mechanicsReview.descriptionText.includes('Combat Trick'))
      expect(candidate.requiredNotices).toContain('PZO1131');
    if (candidate.name.includes('Mythic'))
      expect(candidate.requiredNotices).toContain('PZO1126');
    if (
      candidate.mechanicsReview.descriptionText.includes('Completion Benefit')
    )
      expect(candidate.requiredNotices).toContain('PZO1125');
    for (const source of candidate.inheritedRuleSourceEvidence)
      expect(
        sha256(await readFile(join(fixtureRoot, source.fixturePath), 'utf8')),
      ).toBe(source.sha256);
  }
  for (const notice of review.noticeRequirements) {
    if (!notice.holdId) continue;
    expect(heldNotices.find((hold) => hold.id === notice.holdId)).toMatchObject(
      {
        notices: expect.arrayContaining([notice.book, ...notice.registryKeys]),
        evidence: ['scripts/catalog/legal/feats-343.json'],
      },
    );
  }
  for (const source of review.comparisonSources.pcgenFiles)
    expect(
      sha256(
        await readFile(
          join(fixtureRoot, 'comparison-sources', source.path),
          'utf8',
        ),
      ),
    ).toBe(source.sha256);
  const required = (name: string) =>
    review.candidates.find((row) => row.name === name)?.requiredNotices;
  expect(required("Spirit's Gift")).toEqual(
    expect.arrayContaining(['PZO1129', 'PZO1110']),
  );
  expect(required('Implant Bomb')).toEqual(
    expect.arrayContaining(['PZO1115', 'PZO1110']),
  );
  expect(required('Expanded Enhance Arrows')).toEqual(
    expect.arrayContaining(['PZO1123', 'PZO1110']),
  );
  expect(required('Venomous Spray')).toContain('PZO1116');
  expect(required('Assured Destruction')).toContain('PZO1116');
  expect(required('Pinpoint Jab')).toContain('PZO1129');
});

// #724: the rank threshold is automatic, read from the skill's recorded ranks.
it('gives Skill Focus (Knowledge [Nobility]) +3, or +6 at 10 ranks, without a Situation or a stacking same-Source copy', () => {
  const data = modifiers('Skill Focus (Knowledge [Nobility])');
  expectAutomaticSkillFocus({ modifiers: data, target: 'skill.kno' });
});

it('retains Steel Soul’s +4 replacement as outstanding rather than adding to Hardy', () => {
  expect(entry('Steel Soul').modifiers).toEqual([]);
  const candidate = review.candidates.find((row) => row.name === 'Steel Soul');
  expect(candidate?.mechanicsReview.descriptionText).toContain(
    '+4 racial bonus',
  );
  expect(candidate?.mechanicsReview.descriptionText).toContain(
    'replaces the normal bonus',
  );
  expect(
    candidate?.mechanicsReview.outstandingCalculations.join(' '),
  ).toContain('would yield +6 with Hardy');
});

it('calculates Dragonfly Style Wisdom on Acrobatics through the public sheet boundary', () => {
  const input = reviewedFeatSheet('Dragonfly Style');
  const result = calculateCharacterSheetProjections(input);
  expect(result.current.breakdowns['skill.acr'].total).toBe(2);
  expect(result.permanent.breakdowns['skill.acr'].total).toBe(2);
  expect(result.current.breakdowns['attack.melee'].total).toBe(0);
  const local = situation('Dragonfly Style', 1);
  expect(
    resolveSheet(modifiers('Dragonfly Style'), { situations: [local] })[
      'attack.melee'
    ].total,
  ).toBe(1);
});

it('keeps rank and giant-type scopes manual while shared giant dodge AC remains exact', () => {
  for (const name of [
    'Truth-Seeker',
    'Forward from Beneath',
    'Embrace of the Dark Fey',
  ]) {
    const target =
      name === 'Truth-Seeker'
        ? 'skill.khi'
        : name === 'Forward from Beneath'
          ? 'skill.dis'
          : 'skill.int';
    const rows = modifiers(name);
    expect(resolveSheet(rows)[target].total).toBe(0);
    expect(
      resolveSheet(rows, { situations: [situation(name, 2)] })[target].total,
    ).toBe(2);
    expect(
      resolveSheet(rows, { situations: [situation(name, 4)] })[target].total,
    ).toBe(4);
  }
  expect(
    resolveSheet(modifiers('Giant Vendetta'), { situations: ['giants'] })[
      'ac.other'
    ].total,
  ).toBe(1);
  expect(
    resolveSheet(modifiers('Giant Vendetta'), { situations: ['giants'] }).init
      .total,
  ).toBe(0);
  expect(
    resolveSheet(modifiers('Harrowed'), { situations: ['enchantment'] })[
      'save.will'
    ].total,
  ).toBe(1);
  expect(
    resolveSheet(modifiers('Harrowed'), { situations: ['fear'] })['save.will']
      .total,
  ).toBe(0);
});

it('keeps replacement end values and unmodeled dice out of additive modifiers', () => {
  for (const name of [
    'Prone Shooter',
    "Musketeer's Dodge",
    'Kobold Confidence',
    'Assured Destruction',
    'Wilding Stride',
    "Serren's Masterstroke",
    'Poppet Familiar',
  ])
    expect(entry(name).modifiers).toEqual([]);
  expect(entry('Prone Shooter').situationalNotes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        text: expect.stringContaining('reduced to -2'),
      }),
    ]),
  );
  expect(entry("Serren's Masterstroke").situationalNotes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ text: expect.stringContaining('+4d6') }),
    ]),
  );
  const focus = review.candidates.find((row) => row.name.includes('Nobility'));
  expect(focus?.mechanicsReview.rawMechanics.changes).toEqual([
    {
      _id: '068ryn6g',
      formula: 'ifelse(gte(@skills.kno.rank,10),6,3)',
      target: 'skill.kno',
      type: 'untyped',
    },
  ]);
});

it('records supported prerequisite facts and names parser/proficiency gaps separately from holds', () => {
  expect(entry('Prone Shooter').prerequisites).toContainEqual({
    kind: 'bab',
    bab: 1,
  });
  expect(entry('Pinpoint Jab').prerequisites).toContainEqual({
    kind: 'bab',
    bab: 6,
  });
  for (const name of [
    'Huntmaster',
    'Tool Optimizer',
    'Theurgy',
    'Bull-Catcher Toss',
    "Musketeer's Dodge",
  ]) {
    const candidate = review.candidates.find((row) => row.name === name);
    if (!candidate) throw new Error(`Missing prerequisite review for ${name}`);
    expect(
      recordedPrerequisiteFacts({ batch: 'feats-343', candidate }),
    ).not.toEqual([]);
  }
  expect(
    review.candidates.find((row) => row.name === "Musketeer's Dodge")
      ?.mechanicsReview.proficiencyReview.grants,
  ).toEqual([]);
  for (const row of preview.entries) {
    expect(row.sources).toEqual([]);
    expect(row.detail.repeatable).toBe('unreviewed');
  }
});
