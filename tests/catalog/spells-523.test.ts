// @vitest-environment node
import { createHash } from 'node:crypto';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import review from '../../scripts/catalog/legal/spells-523.json';
import { reviewedCuration as curation } from '../../scripts/catalog/reviewed-curation-data';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
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
import {
  appliedRemapSchema,
  importedCatalogEntrySchema,
  importedSpellDetailSchema,
} from '../../src/lib/catalog/imported-entry-schema';
import { calculateCharacterSheetProjections } from '../../src/lib/character-sheet';
import provenance from '../fixtures/spells-523/provenance.json';
import preview from '../fixtures/spells-523/preview.json';
import bindingPreview from '../fixtures/spells-523/binding-preview.json';
import { recordedSpellSheet, spellFixture } from '../fixtures/spells-523/sheet';

const keys = review.candidates.map((row) => row.externalKey);
const fixtureRoot = resolve('tests/fixtures/spells-523');
const inputs = {
  systemPath: join(fixtureRoot, 'pf1'),
  contentPath: join(fixtureRoot, 'pf1-content'),
  candidateKeys: keys,
  remaps: [],
  curation,
};
const sha256 = (text: string) =>
  createHash('sha256').update(text).digest('hex');
const temporary: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporary
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});
function candidate(name: string) {
  const row = review.candidates.find((row) => row.name === name);
  if (!row) throw new Error(`Missing reviewed Spell: ${name}`);
  return row;
}
function boundArtifact() {
  const spellSchema = importedCatalogEntrySchema.extend({
    detail: importedSpellDetailSchema,
  });
  return {
    catalog: {
      entries: z.array(spellSchema).parse(bindingPreview.entries),
      resources: z.array(spellSchema).parse(bindingPreview.resources),
      remaps: z.array(appliedRemapSchema).parse(bindingPreview.remaps),
    },
    comparison: { records: [], packs: [] },
  };
}

it('pins all 100 exact ticket roots, source bytes, actions and individual reviews', async () => {
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(sha256(keys.join('\n'))).toBe(
    '8721bfcfcba71de1af41fa24a22a95ced032470e258c60eaff71a80cf404293d',
  );
  expect(
    review.candidates.filter((row) => row.disposition === 'held'),
  ).toHaveLength(100);
  expect(
    review.candidates.filter((row) => row.disposition === 'excluded'),
  ).toHaveLength(0);
  expect(provenance.rawSources.map((row) => row.externalKey)).toEqual(keys);
  expect(preview.candidateKeys).toEqual(keys);
  expect(await readdir(join(inputs.systemPath, 'packs/spells'))).toHaveLength(
    100,
  );
  expect(
    provenance.dependencies.some((row) => keys.includes(row.externalKey)),
  ).toBe(false);
  const assessments = reviewedAdmission.assessments.filter((row) =>
    keys.includes(row.externalKey),
  );
  expect(assessments).toHaveLength(100);
  expect(new Set(assessments.map((row) => row.externalKey)).size).toBe(100);
  for (const source of [...provenance.rawSources, ...provenance.dependencies]) {
    expect(
      sha256(await readFile(join(inputs.systemPath, source.path), 'utf8')),
      source.path,
    ).toBe(source.sha256);
  }
  for (const row of review.candidates) {
    const text = await readFile(
      join(inputs.systemPath, row.source.path),
      'utf8',
    );
    const raw = upstreamRecord.parse(parse(text));
    expect(sha256(text), row.name).toBe(row.source.sha256);
    expect(`pf1/${raw._id}`).toBe(row.externalKey);
    expect(raw.type).toBe('spell');
    expect(sha256(sourceDescription(raw))).toBe(row.descriptionSha256);
    expect(row.noticeRequirementsComplete).toBe(false);
    expect(row.holdIds.length).toBeGreaterThan(0);
    expect(row.missingEvidence.length).toBeGreaterThan(0);
    expect(row.mechanicsReview.descriptionReview).toBe(
      'complete-full-description-and-all-actions',
    );
    expect(row.mechanicsReview.requiredRecords).toEqual([]);
    expect(row.mechanicsReview.recordedSpellModifiers).toBe(0);
    for (const [field, value] of Object.entries(row.mechanicsReview.metadata)) {
      expect(value, `${row.name}: ${field}`).toEqual(raw.system[field] ?? null);
    }
    const record = curation.records.find(
      (record) =>
        record.externalKey === row.externalKey && record.kind === 'description',
    );
    expect(record, row.name).toMatchObject({
      textSha256: row.descriptionSha256,
      status: 'checked',
    });
    expect(record?.outputs).toHaveLength(
      row.mechanicsReview.descriptionRecord.outputCount,
    );
    const assessment = assessments.find(
      (assessment) => assessment.externalKey === row.externalKey,
    );
    expect(assessment).toMatchObject({
      status: 'unresolved',
      reviewedBy: 'Sol (AI curator) for the owner',
      reviewedOn: '2026-10-08',
      requiredNotices: row.requiredNotices,
    });
    expect(assessment?.evidenceFingerprints).toHaveProperty(row.evidenceId);
    expect(reviewedAdmission.evidence[row.evidenceId]?.content).toContain(
      row.source.sha256,
    );
    expect(reviewedAdmission.evidence[row.evidenceId]?.content).toContain(
      row.source.location,
    );
    for (const holdId of row.noticeHoldIds) {
      expect(heldNotices, holdId).toContainEqual(
        expect.objectContaining({
          id: holdId,
          evidence: expect.arrayContaining([
            'scripts/catalog/legal/spells-523.json',
          ]),
        }),
      );
    }
  }
});

it('holds both record-level 3.5 tags under the owner policy and preserves Ego Whip V missing direct source', async () => {
  for (const name of ['Bolt of Glory', 'Reveal True Shape']) {
    const row = candidate(name);
    expect(row.disposition).toBe('held');
    expect(row).not.toHaveProperty('exclusionReason');
    expect(row).toHaveProperty(
      'tagPolicyHold',
      expect.objectContaining({
        tag: '3.5',
        ownerPolicyIssues: [521, 522],
        reason: expect.stringContaining(
          "owner's policy (2026-10-08) holds record-level 3.5 tags and never excludes them",
        ),
      }),
    );
    expect(row.holdIds).toContain(
      `spells-523-record-3.5-tag-${row.externalKey.split('/')[1]}`,
    );
    expect(row.missingEvidence).toContain('record-level 3.5 tag');
    expect(reviewedAdmission.evidence[row.evidenceId]?.content).toContain(
      "owner's policy (2026-10-08) holds record-level 3.5 tags and never excludes them",
    );
    const raw = upstreamRecord.parse(
      parse(await readFile(join(inputs.systemPath, row.source.path), 'utf8')),
    );
    expect(raw.system.tags).toContain('3.5');
    expect(
      reviewedAdmission.assessments.find(
        (assessment) => assessment.externalKey === row.externalKey,
      )?.status,
    ).toBe('unresolved');
    expect(spellFixture(row.name).modifiers).toEqual([]);
  }
  const whip = candidate('Ego Whip V');
  const raw = upstreamRecord.parse(
    parse(await readFile(join(inputs.systemPath, whip.source.path), 'utf8')),
  );
  expect(raw.system.sources).toBeUndefined();
  expect(spellFixture(whip.name).sources).toEqual([]);
  expect(whip.requiredNotices).toContain('PZO1132');
  expect(String(whip.missingEvidence)).toMatch(/publication origins/i);
});

it.each([
  ['Murderous Crow', 'PZO1112', 'celestial'],
  ['Murderous Crow', 'PZO1116', 'entropic'],
  ['Murderous Crow', 'PZO1115', 'Improved Steal'],
  ['Invoke Deity', 'PZO1116', 'shining childB2'],
  ['Invoke Deity', 'PZO1137', 'VoidB6'],
  ['Detect Demon', 'PZO9225', 'detect evil'],
  ['Detect Demon', 'PZO1121', 'tiefling'],
  ['Absolution', 'PZO1125', 'Ultimate Campaign'],
  ['Protection from Good, Communal', 'PZO1110', 'Protection from Good'],
] as const)(
  '%s retains inherited %s notice and literal rule evidence',
  async (name, notice, wording) => {
    const row = candidate(name);
    const raw = upstreamRecord.parse(
      parse(await readFile(join(inputs.systemPath, row.source.path), 'utf8')),
    );
    expect(
      sourceDescription(raw)
        .replace(/<[^>]*>/g, '')
        .toLowerCase(),
    ).toContain(wording.toLowerCase());
    expect(row.requiredNotices).toContain(notice);
    expect(
      reviewedAdmission.assessments.find(
        (assessment) => assessment.externalKey === row.externalKey,
      )?.requiredNotices,
    ).toContain(notice);
  },
);

it('replays every full-context binding and reopens content, notice and evidence changes', () => {
  const artifact = boundArtifact();
  expect(bindingPreview.candidateKeys).toEqual(keys);
  expect([...bindingPreview.rootKeys].sort()).toEqual([...keys].sort());
  for (const key of keys) {
    const entry = artifact.catalog.entries.find(
      (row) => row.externalKey === key,
    );
    const assessment = reviewedAdmission.assessments.find(
      (row) => row.externalKey === key,
    );
    if (!entry || !assessment) throw new Error(`Missing binding: ${key}`);
    expect(assessment, entry.name).toMatchObject(
      buildAssessmentBinding({
        entry,
        artifact,
        ...reviewedAdmission,
        requiredNotices: assessment.requiredNotices,
        evidenceIds: Object.keys(assessment.evidenceFingerprints),
      }),
    );
  }
  const entry = artifact.catalog.entries.find(
    (row) => row.name === 'Thought Shield II',
  );
  const assessment = reviewedAdmission.assessments.find(
    (row) => row.externalKey === entry?.externalKey,
  );
  if (!entry || !assessment)
    throw new Error('Missing Thought Shield II binding');
  const args = {
    entry,
    artifact,
    ...reviewedAdmission,
    requiredNotices: assessment.requiredNotices,
    evidenceIds: Object.keys(assessment.evidenceFingerprints),
  };
  const changed = structuredClone(artifact);
  const inherited = changed.catalog.entries.find(
    (row) => row.name === 'Thought Shield I',
  );
  const root = changed.catalog.entries.find(
    (row) => row.externalKey === entry.externalKey,
  );
  if (!inherited || !root)
    throw new Error('Missing inherited thought-shield context');
  inherited.description = inherited.description.replace(
    '+4 circumstance',
    '+5 circumstance',
  );
  expect(
    buildAssessmentBinding({ ...args, artifact: changed, entry: root })
      .contentFingerprint,
  ).not.toBe(assessment.contentFingerprint);
  const registry = structuredClone(reviewedAdmission.registry);
  const crb = registry.CRB;
  if (!crb) throw new Error('Missing CRB notice');
  crb.notice += ' Changed notice.';
  expect(
    buildAssessmentBinding({ ...args, registry }).noticeFingerprints.PZO1110,
  ).not.toBe(assessment.noticeFingerprints.PZO1110);
  const evidence = structuredClone(reviewedAdmission.evidence);
  const evidenceId = candidate('Thought Shield II').evidenceId;
  const record = evidence[evidenceId];
  if (!record) throw new Error('Missing review evidence');
  record.content += ' Changed evidence.';
  expect(
    buildAssessmentBinding({ ...args, evidence }).evidenceFingerprints[
      evidenceId
    ],
  ).not.toBe(assessment.evidenceFingerprints[evidenceId]);
});

it('reproduces the isolated import with Sources and independently outstanding description mechanics', async () => {
  const artifact = await importCatalog(inputs);
  expect(artifact.catalog.entries).toEqual(preview.entries);
  expect(artifact.comparison.summary).toMatchObject({
    upstreamRecords: 100,
    admitted: 100,
    excluded: 0,
    unassigned: 0,
  });
  expect(artifact.curation.passed).toBe(true);
  expect(artifact.curation.summary).toMatchObject({
    required: 0,
    checked: 0,
    missing: 0,
    descriptions: { candidates: 100, checked: 100, drafted: 0 },
  });
  expect(artifact.curation.unresolvedMechanics).toEqual([]);
  const outstanding = review.candidates.filter(
    (row) => row.mechanicsReview.outstanding.length > 0,
  );
  expect(
    artifact.curation.unresolvedDescriptions
      .map((row) => row.externalKey)
      .sort(),
  ).toEqual(outstanding.map((row) => row.externalKey).sort());
  for (const row of artifact.curation.unresolvedDescriptions) {
    const expected = outstanding.find(
      (candidate) => candidate.externalKey === row.externalKey,
    );
    expect(
      row.diagnostics
        .filter((diagnostic) => diagnostic.kind === 'unresolved')
        .map((diagnostic) => diagnostic.text)
        .sort(),
    ).toEqual([...(expected?.mechanicsReview.outstanding ?? [])].sort());
  }
  for (const entry of artifact.catalog.entries) {
    expect(entry.detail.kind).toBe('spell');
    expect(entry.modifiers, entry.name).toEqual([]);
    expect(entry.sourceKey, entry.name).toBeUndefined();
    const raw = upstreamRecord.parse(
      parse(
        await readFile(
          join(inputs.systemPath, candidate(entry.name).source.path),
          'utf8',
        ),
      ),
    );
    const sources = z
      .array(
        z.object({
          id: z.string().optional(),
          name: z.string().optional(),
          pages: z.union([z.string(), z.number()]),
        }),
      )
      .parse(raw.system.sources ?? []);
    expect(entry.sources).toEqual(
      sources.map((source) => ({
        book: source.id ?? source.name,
        pages: String(source.pages),
      })),
    );
  }
  expect(
    assessCatalogAdmission({ artifact, ...reviewedAdmission }).admitted,
  ).toEqual([]);
});

it.each([
  ['Hostile Levitation', 'bullRush', '-4'],
  ['Hostile Levitation', 'drag', '-4'],
  ['Hostile Levitation', 'reposition', '-4'],
  ['Thought Worm IV', 'mindAffecting', '-6'],
  ['Thought Shield II', 'mindAffecting', '+6'],
] as const)(
  '%s reuses shared %s on scope-preserving Notes',
  (name, situation, value) => {
    expect(curation.situations.some((row) => row.key === situation)).toBe(true);
    expect(spellFixture(name).situationalNotes).toContainEqual(
      expect.objectContaining({
        situation,
        text: expect.stringContaining(value),
      }),
    );
    expect(spellFixture(name).modifiers).toEqual([]);
  },
);

it('pins inherited save modes, unarmed damage, action drain, and source-specific omissions', () => {
  expect(spellFixture('Thought Worm IV').description).toContain('-6');
  expect(
    candidate('Thought Worm IV').mechanicsReview.outstanding.join(' '),
  ).toMatch(/caster/i);
  expect(spellFixture('Stone Fist').description).toContain('1d6');
  expect(spellFixture('Stone Fist').description).toContain(
    '1d4 if you are Small',
  );
  expect(candidate('Stone Fist').mechanicsReview.outstanding.join(' ')).toMatch(
    /unarmed/i,
  );
  expect(
    candidate('Polar Ray').mechanicsReview.metadata.actions,
  ).toContainEqual(
    expect.objectContaining({
      notes: { effect: ['[[1d4]] Dexterity Drain'] },
      damage: { parts: [{ formula: '(min(25, @cl))d6', types: ['cold'] }] },
    }),
  );
  expect(candidate('Polar Ray').mechanicsReview.outstanding.join(' ')).toMatch(
    /drain/i,
  );
  expect(spellFixture('Angelic Aspect').detail.levels).toMatchObject({
    oracle: 5,
    paladin: 3,
    wizard: 5,
  });
  expect(spellFixture('Protection from Good, Communal').description).toContain(
    '1-minute intervals',
  );
  expect(
    candidate(
      'Spellcasting Contract, Greater',
    ).mechanicsReview.outstanding.join(' '),
  ).toMatch(/profane/i);
});

it.each([
  ['Suppress Charms and Compulsions', 'oracle', 2],
  ['Angelic Aspect', 'oracle', 5],
  ['Hostile Levitation', 'wizard', 3],
  ['Polar Ray', 'wizard', 8],
  ['Stone Fist', 'wizard', 1],
] as const)(
  'the public resolver records %s on the %s list without inventing a running effect',
  (name, classTag, level) => {
    const projections = calculateCharacterSheetProjections(
      recordedSpellSheet(name, classTag),
    );
    for (const projection of [projections.current, projections.permanent]) {
      expect(projection.abilities.strength.score).toBe(10);
      expect(projection.abilities.dexterity.score).toBe(10);
      expect(projection.abilities.intelligence.score).toBe(10);
      expect(projection.breakdowns['attack.melee'].total).toBe(0);
      expect(projection.derivedStatistics.will.total).toBe(0);
      expect(projection.spellEffects).toEqual([]);
      expect(
        projection.spellCollections.spellsWithoutSpellcasting,
      ).toContainEqual(
        expect.objectContaining({
          entryId: 'spell-row',
          spellLevel: level,
          explicitLevel: level,
        }),
      );
    }
  },
);

it('invalidates a checked true save bonus after a changed source value', async () => {
  const work = resolve('.scratch/curation-523/test-work');
  await mkdir(work, { recursive: true });
  const root = await mkdtemp(join(work, 'changed-description-'));
  temporary.push(root);
  await cp(fixtureRoot, root, { recursive: true });
  const row = candidate('Suppress Charms and Compulsions');
  const sourcePath = join(root, 'pf1', row.source.path);
  const raw = await readFile(sourcePath, 'utf8');
  expect(raw).toMatch(/\+4\s+morale/);
  await writeFile(sourcePath, raw.replace(/\+4(\s+morale)/, '+5$1'));
  const artifact = await importCatalog({
    ...inputs,
    systemPath: join(root, 'pf1'),
    contentPath: join(root, 'pf1-content'),
  });
  expect(artifact.curation.stale).toContainEqual(
    expect.objectContaining({
      externalKey: row.externalKey,
      kind: 'description',
    }),
  );
  expect(
    artifact.curation.applied.some(
      (binding) => binding.externalKey === row.externalKey,
    ),
  ).toBe(false);
  expect(
    assessCatalogAdmission({ artifact, ...reviewedAdmission }).admitted,
  ).toEqual([]);
});

it.each([
  [
    'Stone Fist',
    '24025ffe72e812f015460b79169a30ad58bc68f221c71614bf4cb95f8f223cbf',
  ],
  [
    'Hostile Levitation',
    'fe556baf4c18b3c493f1fab361ef387723cfacd436fdc9150fc9ac073f6c87e6',
  ],
  [
    'Ego Whip V',
    '0bcbaf45534973a42e3c5bdd3d7e413e8f8cc7795f03f09848f9496d20aea172',
  ],
  [
    'Murderous Crow',
    '375ed0d7186c6c7f3faac86f24234dc92453d1fbb6a7a669d22dabf17963308d',
  ],
  [
    'Polar Ray',
    'd6bcfcb17321c21275287708dbc4f2ea0430cd99ae9f01b7275043a6356422b0',
  ],
  [
    'Angelic Aspect',
    '594905362a4afdbbd3ef7f7b1d38828a76314836edf6900c0846c1baa9cc0516',
  ],
] as const)(
  '%s retains its independently reviewed pinned bytes',
  async (name, hash) => {
    const row = candidate(name);
    expect(
      sha256(await readFile(join(inputs.systemPath, row.source.path), 'utf8')),
    ).toBe(hash);
  },
);
