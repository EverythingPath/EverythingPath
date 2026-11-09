// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
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
import {
  review,
  preview,
  provenance,
  originals,
} from '../fixtures/feats-352/data';
import {
  findCommittedBatchOwnershipProblems,
  bindSnapshotToCurrentNotices,
} from './batch-ownership';
import { reviewedFeatSheet } from '../fixtures/feats-352/sheet';
import { expectAutomaticSkillFocus } from './skill-focus-assertions';

const fixtureRoot = resolve('tests/fixtures/feats-352');
const inputs = {
  systemPath: join(fixtureRoot, 'pf1'),
  contentPath: join(fixtureRoot, 'pf1-content'),
  remaps: [],
  curation: reviewedCuration,
  candidateKeys: provenance.candidates.map((row) => row.externalKey),
};
const sha256 = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
function candidate(name: string) {
  const row = review.candidates.find((row) => row.name === name);
  if (!row) throw new Error(`Missing review for ${name}`);
  return row;
}
function entry(name: string) {
  const row = preview.entries.find((row) => row.name === name);
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
function situation(name: string, index = 0) {
  const scope = modifiers(name)[index]?.condition?.situation;
  if (typeof scope !== 'object' || !('local' in scope))
    throw new Error('Missing local Situation');
  return { ...scope, sheetEntryId: entry(name).externalKey };
}

it('accounts for the exact 100 pinned feats with whole descriptions, independent mechanics gaps and current content bindings', async () => {
  const keys = inputs.candidateKeys;
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(sha256(keys.join('\n'))).toBe(provenance.candidateKeysSha256);
  expect(review.candidates.map((row) => row.externalKey)).toEqual(keys);
  expect(preview.entries.map((row) => row.externalKey)).toEqual(keys);
  expect(review.counts).toEqual({
    total: 100,
    admitted: 3,
    held: 97,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 0,
    recordLevel35Holds: 0,
  });
  for (const c of review.candidates) {
    const bytes = await readFile(
      join(inputs.contentPath, c.source.path),
      'utf8',
    );
    const raw = upstreamRecord.parse(parse(bytes));
    expect(raw.type, c.name).toBe('feat');
    expect(sha256(bytes), c.name).toBe(c.source.sha256);
    expect(`pf1-content/${raw._id}`).toBe(c.externalKey);
    expect(sourceDescription(raw)).toBe(c.mechanicsReview.descriptionText);
    expect(sha256(sourceDescription(raw))).toBe(c.descriptionSha256);
    expect(c.mechanicsReview.mappedFacts).toMatchObject({
      modifiers: entry(c.name).modifiers,
      sources: entry(c.name).sources,
      prerequisites: entry(c.name).prerequisites ?? [],
      proficiencies: [],
    });
    expect(c.mechanicsReview.curationRecords).toEqual(
      reviewedCuration.records.filter(
        (row) => row.externalKey === c.externalKey,
      ),
    );
    expect(c.mechanicsReview.outstandingCalculations).not.toEqual([]);
    const admitted = c.disposition === 'admitted';
    expect(c.holdIds).toEqual(
      admitted ? [] : [`feats-352-whole-content-${raw._id}`],
    );
    expect(c.noticeRequirementsComplete).toBe(admitted);
    expect(
      reviewedAdmission.assessments.find(
        (row) => row.externalKey === c.externalKey,
      ),
    ).toMatchObject({
      status: admitted ? 'confirmed' : 'unresolved',
      requiredNotices: c.requiredNotices,
      // #724 re-bound the admitted Skill Focus assessments.
      reviewedBy: c.name.startsWith('Skill Focus (')
        ? 'Opus (AI curator) for the owner'
        : 'Sol (AI curator) for the owner',
      reviewedOn: c.name.startsWith('Skill Focus (')
        ? '2026-10-14'
        : '2026-10-11',
    });
  }
});

it('replays every reviewed output and all selected admission bindings through the public importer', async () => {
  const artifact = await importCatalog(inputs);
  expect(artifact.curation.passed).toBe(true);
  expect(artifact.curation.summary.required).toBe(0);
  expect(artifact.curation.summary.descriptions.checked).toBe(100);
  expect(artifact.curation.unresolvedMechanics).toEqual([]);
  expect(artifact.curation.unresolvedDescriptions).toHaveLength(100);
  for (const row of artifact.catalog.entries) {
    expect(row.modifiers).toEqual(entry(row.name).modifiers);
    expect(row.situationalNotes).toEqual(entry(row.name).situationalNotes);
  }
  // The raw roots are portable. Their complete-source prerequisite identities
  // are frozen separately, because unrelated lookup records are not in this fixture.
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
  expect(gate.admitted.map((row) => row.externalKey)).toEqual(
    review.candidates
      .filter((c) => c.disposition === 'admitted')
      .map((c) => c.externalKey),
  );
  expect(gate.held).toHaveLength(97);
  expect(gate.dependentOmissions).toEqual([]);
  for (const row of bound.catalog.entries) {
    const c = candidate(row.name);
    const binding = buildAssessmentBinding({
      entry: row,
      artifact: bound,
      ...reviewedAdmission,
      evidence: { [c.evidenceId]: reviewedAdmission.evidence[c.evidenceId]! },
      requiredNotices: c.requiredNotices,
      evidenceIds: [c.evidenceId],
    });
    expect(binding, c.name).toEqual(
      bindSnapshotToCurrentNotices(c.currentBinding),
    );
    expect(
      reviewedAdmission.assessments.find(
        (c) => c.externalKey === row.externalKey,
      ),
    ).toMatchObject(binding);
  }
});

it('pins permitted PCGen rows and enforces each recorded complete-chain hold without adding aliases', async () => {
  for (const c of review.candidates) {
    for (const lead of [c.comparison, ...c.additionalComparisonLeads].filter(
      (row) => row !== null,
    )) {
      const bytes = await readFile(
        join(fixtureRoot, 'comparison-sources', lead.path),
        'utf8',
      );
      expect(sha256(bytes)).toBe(lead.comparisonFileSha256);
      expect(bytes.split('\n')[lead.line - 1]).toBe(lead.literalRow);
      expect(sha256(lead.literalRow)).toBe(lead.comparisonLineSha256);
    }
    for (const dependency of c.inheritedRuleNotices)
      expect(c.requiredNotices).toContain(dependency.book);
  }
  for (const notice of review.noticeRequirements) {
    if (notice.holdId) {
      const hold = heldNotices.find((row) => row.id === notice.holdId);
      expect(hold).toBeDefined();
      expect(hold?.notices).toEqual(
        expect.arrayContaining([notice.book, ...notice.registryKeys]),
      );
    }
  }
});

it('verifies full literal source identity and distinguishes governing, forward-pointer and audit-only bodies', async () => {
  for (const c of review.candidates) {
    for (const body of [
      ...c.inheritedRuleSourceEvidence,
      ...c.auditOnlySourceEvidence,
    ]) {
      const bytes = await readFile(join(fixtureRoot, body.fixturePath), 'utf8');
      const raw = upstreamRecord.parse(parse(bytes));
      expect(sha256(bytes)).toBe(body.sha256);
      expect(raw._id).toBe(body.sourceIdentity.id);
      expect(raw.name).toBe(body.sourceIdentity.name);
      expect(raw.type).toBe(body.sourceIdentity.type);
      expect(sourceDescription(raw)).toBe(body.description);
      expect(sha256(body.description)).toBe(body.descriptionSha256);
      expect(body.relationship.root).toBe(c.externalKey);
      expect(body.relationship.rule).toBe(body.externalKey);
      for (const [field, recorded] of Object.entries(
        body.sourceIdentity,
      ).filter(([field]) =>
        [
          'subType',
          'associations',
          'tags',
          'description',
          'sources',
          'source',
        ].includes(field),
      )) {
        const expected = z
          .object({ present: z.boolean(), value: z.unknown().optional() })
          .parse(recorded);
        const values = raw.system;
        expect(Object.hasOwn(values, field)).toBe(expected.present);
        if (expected.present) expect(values[field]).toEqual(expected.value);
      }
    }
  }
  const leadership = candidate('Torchbearer').inheritedRuleSourceEvidence.find(
    (row) => row.name === 'Leadership',
  );
  expect(leadership?.sourceIdentity.type).toBe('feat');
  expect(leadership?.externalKey).toBe('pf1/R3a1OV18RwDJftvq');
  const familiar = candidate('Greater School Familiar');
  expect(
    familiar.inheritedRuleSourceEvidence.find(
      (row) => row.name === 'School Familiar',
    ),
  ).toMatchObject({
    bodyRole: 'partial-governing-body',
    completeGoverningBody: false,
  });
  expect(
    familiar.missingGoverningRules.some((row) =>
      row.rule.includes('greater school power'),
    ),
  ).toBe(true);
  for (const name of ['True Deception', 'Targeted Blow', 'Ranged Study']) {
    for (const body of candidate(name).inheritedRuleSourceEvidence.filter(
      (row) =>
        row.sourceIdentity.type === 'feat' &&
        row.sourceIdentity.subType.value === 'classFeat',
    ))
      expect(body.sourceIdentity.associations.present).toBe(true);
  }
});

it.each([
  ['Skill Focus (Survival)', 'skill.sur', 'Survival', 'WIS'],
  ['Skill Focus (Ride)', 'skill.rid', 'Ride', 'DEX'],
  ['Skill Focus (Swim)', 'skill.swm', 'Swim', 'STR'],
] as const)(
  // #724: the rank threshold is automatic, read from the skill's own ranks.
  'resolves %s from its own ranks, with same-Source copies and a complete CRB choice comparison',
  async (name, target, skill, ability) => {
    const rows = modifiers(name);
    expectAutomaticSkillFocus({ modifiers: rows, target });
    const c = candidate(name);
    expect(c.requiredNotices).toEqual(['PZO1110']);
    expect(c.comparison?.completeDirectComparison).toBe(true);
    const tokens = c.comparison?.literalRow.split('\t');
    expect(tokens).toEqual(
      expect.arrayContaining([
        'CHOOSE:SKILL|TYPE=Base',
        'MULT:YES',
        'STACK:NO',
      ]),
    );
    const skillEvidence = c.inheritedRuleComparisonEvidence[0];
    expect(skillEvidence).toBeDefined();
    if (!skillEvidence) throw new Error('Missing skill comparison');
    const skillBytes = await readFile(
      join(fixtureRoot, skillEvidence.fixturePath),
      'utf8',
    );
    expect(sha256(skillBytes)).toBe(skillEvidence.sha256);
    const line = skillBytes
      .split('\n')
      .find((row) => row.startsWith(`${skill}\t`));
    expect(line).toContain(`KEYSTAT:${ability}`);
    const projected = calculateCharacterSheetProjections(
      reviewedFeatSheet(name),
    );
    // No ranks and the skill's ability at 10: Skill Focus's +3 alone.
    expect(projected.current.breakdowns[target].total).toBe(3);
    expect(projected.permanent.breakdowns[target].total).toBe(3);
  },
);

it('keeps the Swim Shark Shaman proxy outside the complete ordinary CRB admission', () => {
  const c = candidate('Skill Focus (Swim)');
  expect(
    c.additionalComparisonLeads.some((lead) =>
      lead.literalRow.includes('TYPE:SharkShamanBonus'),
    ),
  ).toBe(true);
  expect(c.requiredNotices).not.toContain('PZO1117');
  expect(c.comparison?.literalRow).toContain('TYPE:General');
});

it('resolves base and scoped numeric benefits without granting recipient or replacement mechanics', () => {
  expect(resolveSheet(modifiers('Warrior Priest')).init.total).toBe(1);
  expect(resolveSheet(modifiers('Warrior Priest')).concentration.total).toBe(0);
  expect(
    resolveSheet(modifiers('Warrior Priest'), {
      situations: [situation('Warrior Priest', 1)],
    }).concentration.total,
  ).toBe(2);
  expect(resolveSheet(modifiers("Scavenger's Eye"))['skill.apr'].total).toBe(2);
  expect(
    resolveSheet(modifiers("Scavenger's Eye"), {
      situations: [situation("Scavenger's Eye", 1)],
    })['skill.apr'].total,
  ).toBe(4);
  expect(resolveSheet(modifiers('Fey Friend'))['skill.blf'].total).toBe(0);
  expect(
    resolveSheet(modifiers('Fey Friend'), {
      situations: [situation('Fey Friend')],
    })['skill.blf'].total,
  ).toBe(2);
  expect(
    resolveSheet(modifiers('Fury of the Tainted'))['save.fort'].total,
  ).toBe(0);
  expect(
    resolveSheet(modifiers('Fury of the Tainted'), {
      situations: [situation('Fury of the Tainted')],
    })['save.fort'].total,
  ).toBe(4);
  for (const name of [
    'Glorious Blaze',
    'Stable Gallop',
    'Flaying Critical',
    'Dwarven Hatred Style',
    'Improved Punishing Step',
    'Ancestral Weapon Mastery',
  ])
    expect(entry(name).modifiers).toEqual([]);
  expect(
    candidate('Ancestral Weapon Mastery').mechanicsReview.proficiencyReview
      .outstandingFacts,
  ).not.toEqual([]);
});

it('retains governing substitutions, every literal contradiction and missing framework without invented values', () => {
  const notes = (name: string) =>
    entry(name)
      .situationalNotes?.map((row) => row.text)
      .join('\n') ?? '';
  expect(notes('Unconquerable Resolve')).toContain('disappear after 1 minute');
  expect(notes('Unconquerable Resolve')).toContain('persist for 24 hours');
  expect(
    candidate('Unconquerable Resolve').mechanicsReview
      .outstandingCalculations[0],
  ).toContain('contradicts');
  expect(notes('Lingering Breath')).toContain('1d6 x--');
  expect(notes('Improved Weapon of the Chosen')).toContain('swift action');
  expect(notes('Improved Weapon of the Chosen')).toContain('all attacks');
  expect(notes('Flickering Step')).toContain('After using this spell');
  expect(notes('True Deception')).toContain(
    'Do not grant vigilante identities',
  );
  expect(notes('Targeted Blow')).toContain('instead of firearm/fullround/grit');
  expect(notes('Targeted Blow')).toContain('DC 20 Fly');
  expect(notes('Peacemaker')).not.toContain('A euphoric tranquility');
  expect(
    candidate('Hinder').missingGoverningRules.some((row) =>
      row.rule.includes('Blood Hex'),
    ),
  ).toBe(true);
  expect(candidate('Healing Potion').mechanicsReview.descriptionText).toContain(
    'twice the cost',
  );
  for (const c of review.candidates) {
    expect(c.mechanicsReview.outstandingCalculations).not.toEqual([]);
    for (const output of reviewedCuration.records
      .filter((row) => row.externalKey === c.externalKey)
      .flatMap((row) => row.outputs))
      if (output.kind === 'note')
        expect(output.text.length).toBeLessThanOrEqual(4096);
  }
});

it('keeps its own description records, assessments, evidence and holds as recorded', () => {
  expect(
    findCommittedBatchOwnershipProblems('scripts/catalog/legal/feats-352.json'),
  ).toEqual([]);
});
it('keeps its whole-history preservation manifest on disk until the #744 cleanup', () => {
  // #749 retired this manifest's checks; the file itself stays as recorded.
  expect(originals.assessments).toHaveLength(3931);
});

it('checks its candidates against the protected historical context it recorded', async () => {
  const read = async (path: string): Promise<unknown> =>
    JSON.parse(await readFile(path, 'utf8'));
  const protectedContext = z.object({
    seedKeys: z.array(z.string()),
    closureKeys: z.array(z.string()),
    definitions: z.record(z.string(), z.string()),
  });
  const currentProtection = protectedContext.parse(
    await read('tests/fixtures/feats-352/protected-context.json'),
  );
  const protectedSeeds = new Set(currentProtection.seedKeys);
  for (const family of [
    'feats-350',
    'feats-351',
    'spells-530',
    'spells-531',
    'spells-532',
  ]) {
    const prior = protectedContext.parse(
      await read(`tests/fixtures/${family}/protected-context.json`),
    );
    for (const key of [
      ...prior.seedKeys,
      ...prior.closureKeys,
      ...Object.keys(prior.definitions),
    ]) {
      expect(protectedSeeds.has(key), `${family} complete context ${key}`).toBe(
        true,
      );
    }
  }
  expect(
    review.candidates.filter((row) =>
      currentProtection.closureKeys.includes(row.externalKey),
    ),
  ).toEqual([]);
});
