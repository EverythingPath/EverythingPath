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
} from '../fixtures/feats-353/data';
import {
  findCommittedBatchOwnershipProblems,
  bindSnapshotToCurrentNotices,
} from './batch-ownership';
import { reviewedFeatSheet } from '../fixtures/feats-353/sheet';

it('resolves reviewed fixed and manually scoped values without another recipient’s benefits', () => {
  expect(resolveSheet(modifiers('Ironhide'))['ac.natural'].total).toBe(1);
  const ghost = modifiers('Ghost Whisperer');
  expect(resolveSheet(ghost)['skill.blf'].total).toBe(0);
  expect(
    resolveSheet(ghost, { situations: [situation('Ghost Whisperer')] })[
      'skill.blf'
    ].total,
  ).toBe(2);
  expect(
    resolveSheet(ghost, {
      situations: [
        { ...situation('Ghost Whisperer'), sheetEntryId: 'another-holder' },
      ],
    })['skill.blf'].total,
  ).toBe(0);
  const hunter = modifiers('Artifact Hunter');
  const copy = hunter.map((row) => ({
    ...row,
    sheetEntryId: 'copy',
    catalogEntryId: 'copy',
  }));
  expect(
    resolveSheet([...hunter, ...copy], {
      situations: [
        situation('Artifact Hunter'),
        { ...situation('Artifact Hunter', 1), sheetEntryId: 'copy' },
      ],
    })['skill.umd'].total,
  ).toBe(4);
  expect(
    resolveSheet(hunter, { situations: [situation('Artifact Hunter')] })[
      'skill.umd'
    ].total,
  ).toBe(2);
  expect(modifiers('Clarifying Channel')).toEqual([]);
  expect(modifiers('Lead from the Back')).toEqual([]);
  expect(modifiers('Brutal Grappler')).toEqual([]);
  expect(modifiers('Demonic Nemesis').map((row) => row.target)).toEqual([
    'damage',
  ]);
  for (const name of ['Taunt', 'Dragon Roar', 'Gory Finish']) {
    expect(
      reviewedCuration.records
        .filter((row) => row.externalKey === candidate(name).externalKey)
        .flatMap((row) => row.outputs)
        .some((row) => row.kind === 'note' && row.situation === 'fear'),
    ).toBe(false);
  }
  expect(
    calculateCharacterSheetProjections(reviewedFeatSheet('Ironhide')).current
      .breakdowns['ac.natural'].total,
  ).toBe(1);
});

it('retains missing governing rules, correct class owners and protected contexts independently of legal holds', () => {
  const shifter = candidate('Chimeric Master').inheritedRuleSourceEvidence.find(
    (row) => row.name === 'Greater Chimeric Aspect',
  );
  expect(shifter?.sourceIdentity.associations).toEqual({
    present: true,
    value: { classes: ['Shifter'] },
  });
  const stalwart = candidate(
    'Focused Dragon Expertise',
  ).inheritedRuleSourceEvidence.find((row) => row.name === 'Stalwart');
  expect(stalwart?.sourceIdentity.associations).toEqual({
    present: true,
    value: { classes: ['Inquisitor'] },
  });
  const familiar = candidate('School Familiar');
  expect(
    familiar.missingGoverningRules.some((row) =>
      row.rule.includes('greater powers'),
    ),
  ).toBe(true);
  expect(familiar.mechanicsReview.curationRecords).toMatchObject([
    { outputs: [], diagnostics: [] },
  ]);
  expect(familiar.mechanicsReview.outstandingCalculations).not.toEqual([]);
  expect(
    candidate('Soul-Powered Magic').mechanicsReview.descriptionText,
  ).toContain('resurrection, and can restore');
  expect(modifiers('Incorporeal Intuition').map((row) => row.target)).toEqual([
    'skill.kre',
  ]);
  expect(
    candidate('Expert Trainer').additionalComparisonLeads.some((row) =>
      row.literalRow.includes('Cavalier ~ Expert Trainer'),
    ),
  ).toBe(true);
  expect(candidate('Ironhide').disposition).toBe('held');
  expect(candidate('Ironhide').mechanicsReview.outstandingCalculations).toEqual(
    [],
  );
});

const fixtureRoot = resolve('tests/fixtures/feats-353');
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
    admitted: 0,
    held: 100,
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
    expect(c.mechanicsReview.outstandingCalculations.length).toBe(
      c.name === 'Ironhide' ? 0 : 1,
    );
    const admitted = c.disposition === 'admitted';
    expect(c.holdIds).toEqual(
      admitted ? [] : [`feats-353-whole-content-${raw._id}`],
    );
    expect(c.noticeRequirementsComplete).toBe(admitted);
    expect(
      reviewedAdmission.assessments.find(
        (row) => row.externalKey === c.externalKey,
      ),
    ).toMatchObject({
      status: admitted ? 'confirmed' : 'unresolved',
      requiredNotices: c.requiredNotices,
      reviewedBy: 'Sol (AI curator) for the owner',
      reviewedOn: '2026-10-11',
    });
  }
});

it('replays every reviewed output and all selected admission bindings through the public importer', async () => {
  const artifact = await importCatalog(inputs);
  expect(artifact.curation.passed).toBe(true);
  expect(artifact.curation.summary.required).toBe(0);
  expect(artifact.curation.summary.descriptions.checked).toBe(100);
  expect(artifact.curation.unresolvedMechanics).toEqual([]);
  expect(artifact.curation.unresolvedDescriptions).toHaveLength(90);
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
  expect(gate.held).toHaveLength(100);
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
});

it('keeps its own description records, assessments, evidence and holds as recorded', () => {
  expect(
    findCommittedBatchOwnershipProblems('scripts/catalog/legal/feats-353.json'),
  ).toEqual([]);
});
it('keeps its whole-history preservation manifest on disk until the #744 cleanup', () => {
  // #749 retired this manifest's checks; the file itself stays as recorded.
  expect(originals.assessments).toHaveLength(4131);
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
    await read('tests/fixtures/feats-353/protected-context.json'),
  );
  const protectedSeeds = new Set(currentProtection.seedKeys);
  for (const family of [
    'feats-352',
    'feats-351',
    'feats-350',
    'feats-351',
    'spells-530',
    'spells-531',
    'spells-533',
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
  const protectedCandidates = review.candidates.filter((row) =>
    currentProtection.closureKeys.includes(row.externalKey),
  );
  expect(protectedCandidates.map((row) => row.externalKey).sort()).toEqual(
    [
      'pf1-content/Zu2Gk9aejJSM5oPY',
      'pf1-content/aVBMwlLYUuZmnSDQ',
      'pf1-content/amlpvIlENbz6HGJf',
      'pf1-content/auoxkZdAB3hRkX7b',
      'pf1-content/b4NrtJVllcOQgmzF',
      'pf1-content/b9XUeZqIXLKk00yn',
      'pf1-content/bQ7B1IVdAB0K2rdW',
      'pf1-content/bQsl5HM7wPOPtsD5',
      'pf1-content/bXJjoBOKsn9yuXRc',
    ].sort(),
  );
  for (const row of protectedCandidates) {
    expect(row.mechanicsReview.curationRecords).toMatchObject([
      { outputs: [], diagnostics: [] },
    ]);
    expect(row.mechanicsReview.outstandingCalculations).not.toEqual([]);
  }
});
