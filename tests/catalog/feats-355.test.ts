// @vitest-environment node
import { recordedPrerequisiteFacts } from './prerequisite-audit-739';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { importCatalog } from '../../scripts/catalog/import';
import {
  sourceDescription,
  upstreamRecord,
} from '../../scripts/catalog/records';
import { assessCatalogAdmission } from '../../scripts/catalog/admission';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import { outputSchema } from '../../src/lib/catalog/curation-output-schema';
import {
  modifierTargets,
  resolveSheet,
  calculateCharacterSheetProjections,
} from '../../src/lib/character-sheet';
import {
  review,
  preview,
  provenance,
  originals,
} from '../fixtures/feats-355/data';
import {
  findCommittedBatchOwnershipProblems,
  bindSnapshotToCurrentNotices,
} from './batch-ownership';
import { reviewedFeatSheet } from '../fixtures/feats-355/sheet';
import { expectAutomaticSkillFocus } from './skill-focus-assertions';

const root = resolve('tests/fixtures/feats-355');
const sha = (bytes: string | Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');
function entry(name: string) {
  const row = preview.entries.find((row) => row.name === name);
  if (!row) throw new Error(`Missing ${name}`);
  return row;
}
function candidate(name: string) {
  const row = review.candidates.find((row) => row.name === name);
  if (!row) throw new Error(`Missing ${name}`);
  return row;
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
function situation(
  name: string,
  index = 0,
  sheetEntryId = entry(name).externalKey,
) {
  const scope = modifiers(name)[index]?.condition?.situation;
  if (typeof scope !== 'object' || !('local' in scope))
    throw new Error('Missing local Situation');
  return { ...scope, sheetEntryId };
}

// #724: the rank threshold is automatic, read from the skill's recorded ranks.
it('gives Skill Focus (Climb) +3, or +6 at 10 ranks, without a Situation or a stacking same-Source copy', () => {
  const data = modifiers('Skill Focus (Climb)');
  expectAutomaticSkillFocus({ modifiers: data, target: 'skill.clm' });
  expect(
    resolveSheet(data, { skillRanks: { 'skill.clm': 10, 'skill.swm': 10 } })[
      'skill.swm'
    ].total,
  ).toBe(0);
  // No ranks: Skill Focus's +3.
  for (const projection of Object.values(
    calculateCharacterSheetProjections(
      reviewedFeatSheet('Skill Focus (Climb)'),
    ),
  ))
    expect(projection.breakdowns['skill.clm'].total).toBe(3);
});

it('keeps lawful and ingested-poison scopes exact and does not apply recipient benefits to the holder', () => {
  const prankster = modifiers('Imperial Prankster');
  expect(resolveSheet(prankster).cmb.total).toBe(0);
  expect(
    resolveSheet(prankster, { situations: ['lawfulCreatures'] }).cmb.total,
  ).toBe(2);
  expect(
    resolveSheet(prankster, {
      situations: ['lawfulCreatures', situation('Imperial Prankster', 1)],
    }).cmb.total,
  ).toBe(4);
  const carrion = modifiers('Carrion Feeder');
  expect(
    resolveSheet(carrion, { situations: ['poison'] })['save.fort'].total,
  ).toBe(0);
  expect(
    resolveSheet(carrion, { situations: [situation('Carrion Feeder', 1)] })[
      'save.fort'
    ].total,
  ).toBe(2);
  expect(
    resolveSheet(carrion, { situations: [situation('Carrion Feeder', 2)] })[
      'skill.sur'
    ].total,
  ).toBe(2);
  for (const name of [
    'Shared Manipulation',
    'Foment the Blood',
    'Harrying Partners',
    'Punch Through',
    'Weapon Trick',
  ])
    expect(modifiers(name)).toEqual([]);
});

it('selects rank branches independently for each Prosperity and Fey Insight skill', () => {
  const prosperity = modifiers('Prosperity and Pride');
  const mixed = resolveSheet(prosperity, {
    situations: [
      situation('Prosperity and Pride', 1),
      situation('Prosperity and Pride', 2),
    ],
  });
  expect(mixed['skill.apr'].total).toBe(4);
  expect(mixed['skill.dip'].total).toBe(2);
  expect(
    resolveSheet(prosperity, {
      situations: [situation('Prosperity and Pride', 1)],
    })['skill.dip'].total,
  ).toBe(0);
  const fey = modifiers('Fey Insight');
  const feyMixed = resolveSheet(fey, {
    situations: [
      situation('Fey Insight', 1),
      situation('Fey Insight', 2),
      situation('Fey Insight', 4),
    ],
  });
  expect(feyMixed['skill.blf'].total).toBe(4);
  expect(feyMixed['skill.dip'].total).toBe(2);
  expect(feyMixed['skill.sen'].total).toBe(2);
  expect(
    resolveSheet(fey, { situations: [situation('Fey Insight', 1)] })[
      'skill.sen'
    ].total,
  ).toBe(0);
});

it('rejects the Wizard Change Shape proxy and preserves the named universal-rule gap', () => {
  const row = candidate('Eidolon Mount');
  expect(
    row.inheritedRuleSourceEvidence.some((r) => r.name === 'Change Shape'),
  ).toBe(false);
  const rejected = row.auditOnlySourceEvidence.find(
    (r) => r.name === 'Change Shape',
  );
  expect(rejected?.bodyRole).toBe('rejected-lead');
  expect(rejected?.role).toContain('Wizard');
  expect(rejected?.completeGoverningBody).toBe(false);
  expect(row.disposition).toBe('held');
});

it('accounts for exactly the ordered 100 pinned feats with complete text, records, facts and content-bound assessments', async () => {
  const keys = provenance.candidates.map((row) => row.externalKey);
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(sha(keys.join('\n'))).toBe(provenance.candidateKeysSha256);
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
  for (const c of review.candidates) {
    const bytes = await readFile(
      join(root, 'pf1-content', c.source.path),
      'utf8',
    );
    const raw = upstreamRecord.parse(parse(bytes));
    expect(raw.type).toBe('feat');
    expect(`pf1-content/${raw._id}`).toBe(c.externalKey);
    expect(sha(bytes)).toBe(c.source.sha256);
    expect(sourceDescription(raw)).toBe(c.mechanicsReview.descriptionText);
    expect(sha(sourceDescription(raw))).toBe(c.descriptionSha256);
    expect(c.mechanicsReview.curationRecords).toEqual(
      reviewedCuration.records.filter((r) => r.externalKey === c.externalKey),
    );
    expect(c.mechanicsReview.outstandingCalculations.length).toBeGreaterThan(0);
    expect(c.mechanicsReview.mappedFacts).toMatchObject({
      modifiers: entry(c.name).modifiers,
      sources: entry(c.name).sources,
      prerequisites: entry(c.name).prerequisites ?? [],
      proficiencies: [],
    });
    const assessment = reviewedAdmission.assessments.find(
      (a) => a.externalKey === c.externalKey,
    );
    expect(assessment).toMatchObject({
      ...bindSnapshotToCurrentNotices(c.currentBinding),
      requiredNotices: c.requiredNotices,
      // #724 re-bound the admitted Skill Focus assessments.
      reviewedBy: c.name.startsWith('Skill Focus (')
        ? 'Opus (AI curator) for the owner'
        : review.reviewedBy,
      reviewedOn: c.name.startsWith('Skill Focus (')
        ? '2026-10-14'
        : review.reviewedOn,
      status: c.disposition === 'admitted' ? 'confirmed' : 'unresolved',
    });
    expect(c.holdIds).toEqual(
      c.disposition === 'admitted'
        ? []
        : [`feats-355-whole-content-${raw._id}`],
    );
    const evidence = reviewedAdmission.evidence[c.evidenceId];
    if (!evidence) throw new Error('Missing evidence');
    const mirror = z
      .object({
        mechanicsReview: z.unknown(),
        requiredNotices: z.array(z.string()),
        inheritedRuleSourceEvidence: z.unknown(),
        auditOnlySourceEvidence: z.unknown(),
      })
      .parse(JSON.parse(evidence.content));
    expect(mirror.requiredNotices).toEqual(c.requiredNotices);
    const originalAtoms = z
      .object({
        prerequisiteReview: z.object({ normalizedAtoms: z.array(z.unknown()) }),
      })
      .parse(mirror.mechanicsReview).prerequisiteReview.normalizedAtoms;
    // The evidence is an immutable author-time report. Compare its original
    // parser values while keeping every independent mechanics assertion.
    expect(mirror.mechanicsReview).toMatchObject({
      ...c.mechanicsReview,
      mappedFacts: {
        ...c.mechanicsReview.mappedFacts,
        prerequisites: originalAtoms,
      },
      prerequisiteReview: {
        ...c.mechanicsReview.prerequisiteReview,
        normalizedAtoms: originalAtoms,
        outstandingFacts: recordedPrerequisiteFacts({
          batch: 'feats-355',
          candidate: c,
        }),
      },
    });
    for (const r of [
      ...c.inheritedRuleSourceEvidence,
      ...c.auditOnlySourceEvidence,
    ]) {
      expect(sha(await readFile(join(root, r.fixturePath)))).toBe(r.sha256);
      expect(sha(r.description)).toBe(r.descriptionSha256);
      expect(r.role).toBe(r.relationship.reason);
      expect(r.role).toBe(r.relationshipAudit.relationshipBasis);
      expect(r.bodyRole).toBe(r.relationshipAudit.bodyRole);
    }
  }
});

it('pins the actual Mythic feat rows and independently recomputes the complete CRB Skill Focus benefit comparison', async () => {
  for (const name of [
    'Knockout Artist (Mythic)',
    'Detect Expertise (Mythic)',
  ]) {
    const c = candidate(name);
    expect(c.comparison?.literalRow).toContain('CATEGORY:Mythic Feat');
    expect(c.comparison?.appliesToRootBody).toBe(true);
    expect(c.requiredNotices).toContain('PZO1126');
  }
  const focus = candidate('Skill Focus (Climb)');
  const compare = focus.comparison;
  if (!compare?.componentComparison)
    throw new Error('Missing complete comparison');
  const bytes = await readFile(
    join(root, 'comparison-sources', compare.path),
    'utf8',
  );
  expect(sha(bytes)).toBe(compare.comparisonFileSha256);
  expect(bytes.split('\n')[compare.line - 1]).toBe(compare.literalRow);
  expect(compare.componentComparison.benefit.upstreamText).toBe(
    compare.literalRow
      .split('\t')
      .find((v) => v.startsWith('BENEFIT:'))
      ?.slice(8),
  );
  expect(compare.componentComparison.benefit.comparisonText).toBe(
    compare.componentComparison.benefit.upstreamText,
  );
  expect(focus.disposition).toBe('admitted');
  expect(focus.requiredNotices).toEqual(['PZO1110']);
  expect(candidate('Weapon Trick').mechanicsReview.descriptionText).toContain(
    'Martial Arts Handbook pg. 14',
  );
  expect(candidate('Weapon Trick').requiredNotices).toContain('PZO9493');
  expect(candidate('Agonizing Obedience').requiredNotices).toContain('PZO1117');
  expect(
    candidate('Planar Infusion').mechanicsReview.descriptionText,
  ).toContain('maximum CL 20th');
});

it('reproduces selected mechanics and the one-admission gate without claiming missing lookup inputs were imported', async () => {
  const artifact = await importCatalog({
    systemPath: join(root, 'pf1'),
    contentPath: join(root, 'pf1-content'),
    remaps: [],
    curation: reviewedCuration,
    candidateKeys: provenance.candidates.map((row) => row.externalKey),
  });
  for (const row of artifact.catalog.entries) {
    const complete = entry(row.name);
    expect({
      description: row.description,
      detail: row.detail,
      sources: row.sources,
      modifiers: row.modifiers,
      situationalNotes: row.situationalNotes,
    }).toEqual({
      description: complete.description,
      detail: complete.detail,
      sources: complete.sources,
      modifiers: complete.modifiers,
      situationalNotes: complete.situationalNotes,
    });
  }
  const gate = assessCatalogAdmission({
    artifact: {
      ...artifact,
      catalog: {
        ...artifact.catalog,
        entries: preview.entries.map((row) => {
          if (row.detail.kind !== 'feat') throw new Error('Expected feat');
          return { ...row, detail: row.detail };
        }),
      },
    },
    ...reviewedAdmission,
  });
  expect(gate.admitted.map((row) => row.externalKey)).toEqual([
    entry('Skill Focus (Climb)').externalKey,
  ]);
  expect(gate.held).toHaveLength(99);
  expect(gate.failures).toEqual([]);
  expect(artifact.curation.passed).toBe(true);
});

it('keeps its own description records, assessments, evidence and holds as recorded', () => {
  expect(
    findCommittedBatchOwnershipProblems('scripts/catalog/legal/feats-355.json'),
  ).toEqual([]);
});
it('keeps its whole-history preservation manifest on disk until the #744 cleanup', () => {
  // #749 retired this manifest's checks; the file itself stays as recorded.
  expect(originals.assessments).toHaveLength(4531);
});
