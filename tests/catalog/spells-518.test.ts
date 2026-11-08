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
import review from '../../scripts/catalog/legal/spells-518.json';
import { reviewedCuration as curation } from '../../scripts/catalog/reviewed-curation-data';
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
import { calculateCharacterSheetProjections } from '../../src/lib/character-sheet';
import provenance from '../fixtures/spells-518/provenance.json';
import preview from '../fixtures/spells-518/preview.json';
import { recordedSpellSheet, spellFixture } from '../fixtures/spells-518/sheet';

const keys = review.candidates.map((row) => row.externalKey);
const fixtureRoot = resolve('tests/fixtures/spells-518');
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

it('accounts for the exact 100 ticket keys, source bytes, complete description bindings and individual unresolved assessments', async () => {
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(sha256(keys.join('\n'))).toBe(
    '0516b291dbd20d9f516d40d0c1e2856c3b089a681d40b982e49093ab6ff5712f',
  );
  expect(provenance.rawSources.map((row) => row.externalKey)).toEqual(keys);
  expect(await readdir(join(inputs.systemPath, 'packs/spells'))).toHaveLength(
    100,
  );
  expect(provenance.dependencies).toHaveLength(28);
  expect(
    review.candidates.filter(
      (row) =>
        Array.isArray(row.mechanicsReview.metadata.descriptors) &&
        row.mechanicsReview.metadata.descriptors.length > 0,
    ),
  ).toHaveLength(39);
  expect(
    review.candidates.filter(
      (row) =>
        Array.isArray(row.mechanicsReview.metadata.subschool) &&
        row.mechanicsReview.metadata.subschool.length > 0,
    ),
  ).toHaveLength(37);
  expect(
    provenance.dependencies.some((row) => keys.includes(row.externalKey)),
  ).toBe(false);
  const assessments = reviewedAdmission.assessments.filter((row) =>
    keys.includes(row.externalKey),
  );
  expect(assessments).toHaveLength(100);
  expect(new Set(assessments.map((row) => row.externalKey)).size).toBe(100);
  for (const candidate of review.candidates) {
    const raw = await readFile(
      join(inputs.systemPath, candidate.source.path),
      'utf8',
    );
    expect(sha256(raw), candidate.name).toBe(candidate.source.sha256);
    const record = upstreamRecord.parse(parse(raw));
    expect(record.type).toBe('spell');
    expect(`pf1/${record._id}`).toBe(candidate.externalKey);
    expect(sha256(sourceDescription(record))).toBe(candidate.descriptionSha256);
    expect(candidate.disposition).toBe('held');
    expect(candidate.noticeRequirementsComplete).toBe(false);
    expect(candidate.holdIds.length).toBeGreaterThan(0);
    expect(candidate.missingEvidence.length).toBeGreaterThan(0);
    expect(candidate.mechanicsReview.descriptionReview).toBe(
      'complete-full-description-and-all-actions',
    );
    expect(candidate.mechanicsReview.requiredRecords).toEqual([]);
    expect(candidate.mechanicsReview.recordedSpellModifiers).toBe(0);
    for (const [field, value] of Object.entries(
      candidate.mechanicsReview.metadata,
    )) {
      expect(value, `${candidate.name}: ${field}`).toEqual(
        record.system[field] ?? null,
      );
    }
    const description = curation.records.find(
      (row) =>
        row.externalKey === candidate.externalKey && row.kind === 'description',
    );
    expect(description).toMatchObject({
      textSha256: candidate.descriptionSha256,
      status: 'checked',
    });
    expect(description?.outputs).toHaveLength(
      candidate.mechanicsReview.descriptionRecord.outputCount,
    );
    const assessment = assessments.find(
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
    expect(reviewedAdmission.evidence[candidate.evidenceId]?.content).toContain(
      candidate.source.sha256,
    );
    expect(reviewedAdmission.evidence[candidate.evidenceId]?.content).toContain(
      candidate.source.location,
    );
  }
  for (const source of [...provenance.rawSources, ...provenance.dependencies]) {
    expect(
      sha256(await readFile(join(inputs.systemPath, source.path), 'utf8')),
      source.path,
    ).toBe(source.sha256);
  }
});

it('reproduces held-only catalog preview with every complete description reviewed and no recorded Spell modifiers', async () => {
  const artifact = await importCatalog(inputs);
  expect(artifact.catalog.entries).toEqual(preview.entries);
  expect(artifact.catalog.entries.map((row) => row.externalKey).sort()).toEqual(
    [...keys].sort(),
  );
  expect(artifact.curation.passed).toBe(true);
  expect(artifact.curation.summary).toMatchObject({
    required: 0,
    checked: 0,
    missing: 0,
    descriptions: { candidates: 100, checked: 100, drafted: 0 },
  });
  expect(artifact.curation.unresolvedMechanics).toEqual([]);
  for (const row of artifact.curation.unresolvedDescriptions) {
    expect(
      review.candidates.find(
        (candidate) => candidate.externalKey === row.externalKey,
      )?.mechanicsReview.outstanding.length,
    ).toBeGreaterThan(0);
  }
  for (const entry of artifact.catalog.entries) {
    expect(entry.detail.kind).toBe('spell');
    expect(entry.modifiers, entry.name).toEqual([]);
    expect(entry.sourceKey, entry.name).toBeUndefined();
    const source = provenance.rawSources.find(
      (row) => row.externalKey === entry.externalKey,
    );
    if (!source) throw new Error(`Missing raw Spell ${entry.externalKey}`);
    const raw = upstreamRecord.parse(
      parse(await readFile(join(inputs.systemPath, source.path), 'utf8')),
    );
    const sources = z
      .array(
        z.object({
          id: z.string().optional(),
          name: z.string().optional(),
          pages: z.union([z.string(), z.number()]),
        }),
      )
      .parse(raw.system.sources);
    expect(entry.sources).toEqual(
      sources.map((row) => ({
        book: row.id ?? row.name,
        pages: String(row.pages),
      })),
    );
  }
  const gate = assessCatalogAdmission({ artifact, ...reviewedAdmission });
  expect(gate.admitted).toEqual([]);
  const bane = artifact.catalog.entries.find((row) => row.name === 'Bane');
  const assessment = reviewedAdmission.assessments.find(
    (row) => row.externalKey === bane?.externalKey,
  );
  if (!bane || !assessment)
    throw new Error('Missing source-bound Bane assessment');
  expect(assessment).toMatchObject(
    buildAssessmentBinding({
      entry: bane,
      artifact,
      ...reviewedAdmission,
      requiredNotices: assessment.requiredNotices,
      evidenceIds: Object.keys(assessment.evidenceFingerprints),
    }),
  );

  expect(
    [
      ...new Set(
        [...gate.held, ...gate.failures, ...gate.dependentOmissions].map(
          (row) => row.externalKey,
        ),
      ),
    ].sort(),
  ).toEqual([...keys].sort());
});

it('pins real size adjustments and target-dependent Shocking Grasp damage as separately outstanding effect/combat facts', () => {
  const reduce = spellFixture('Reduce Person');
  expect(reduce.externalKey).toBe('pf1/2y9e1l6zso9tdg0a');
  expect(reduce.sources).toEqual([{ book: 'PZO1110', pages: '330' }]);
  expect(reduce.detail.levels).toMatchObject({
    wizard: 1,
    alchemist: 1,
    psychic: 1,
  });
  expect(reduce.description).toContain('+2 size bonus to Dexterity');
  expect(reduce.description).toContain('-2 size penalty to Strength');
  expect(reduce.description).toContain('minimum of 1');
  expect(reduce.description).toContain('+1 bonus on attack rolls and AC');
  const growth = spellFixture('Animal Growth');
  expect(growth.detail.levels).toMatchObject({
    wizard: 5,
    druid: 5,
    hunter: 4,
  });
  expect(growth.detail.grantedLevels).toEqual({ domain: { Scalykind: 5 } });
  expect(growth.description).toContain('+8 size bonus to Strength');
  expect(growth.description).toContain('+4 size bonus to Constitution');
  expect(growth.description).toContain('natural armor bonus increases by 2');
  const shock = spellFixture('Shocking Grasp');
  expect(shock.sources).toEqual([{ book: 'PZO1110', pages: '343' }]);
  expect(shock.detail).toMatchObject({
    school: 'evo',
    // #738 imports the descriptors the pinned record publishes.
    descriptors: ['electricity'],
    levels: { wizard: 1, magus: 1 },
    grantedLevels: { bloodline: { Djinni: 1, Stormborn: 1 } },
  });
  expect(shock.description).toContain('maximum 5d6');
  expect(shock.description).toContain('+3 bonus on attack rolls');
  expect(shock.description).toContain('wearing metal armor');
  expect(shock.modifiers).toEqual([]);
  expect(
    review.candidates.find((row) => row.externalKey === shock.externalKey)
      ?.mechanicsReview.metadata.descriptors,
  ).toEqual(['electricity']);
});

it('uses shared fear and mind-affecting Situations on reference Notes while preserving linked definitions', () => {
  const bane = spellFixture('Bane');
  expect(bane.detail).toMatchObject({
    school: 'enc',
    descriptors: ['fear', 'mindAffecting'],
    levels: { cleric: 1, oracle: 1 },
    grantedLevels: { subDomain: { Curse: 1 } },
  });
  expect(bane.situationalNotes).toContainEqual(
    expect.objectContaining({
      target: 'saves',
      situation: 'fear',
      text: expect.stringContaining('−1'),
    }),
  );
  const shield = spellFixture('Thought Shield V');
  expect(shield.detail.levels).toEqual({ psychic: 6 });
  expect(shield.description).toContain('2p265l26tq5xh0f6');
  expect(shield.situationalNotes).toContainEqual(
    expect.objectContaining({ situation: 'mindAffecting' }),
  );
  const sheet = calculateCharacterSheetProjections(
    recordedSpellSheet('Bane', 'oracle'),
    { situations: ['fear'] },
  );
  for (const projection of [sheet.current, sheet.permanent]) {
    expect(projection.breakdowns['attack.melee'].total).toBe(0);
    expect(projection.derivedStatistics.will.total).toBe(0);
    expect(projection.spellEffects).toEqual([]);
  }
});

it('keeps Thought Worm III’s failed-save all-caster penalty separate from its successful-save caster-only scope', () => {
  const worm = spellFixture('Thought Worm III');
  expect(worm.detail.levels).toEqual({ psychic: 4 });
  expect(worm.description).toContain('thought worm II');
  expect(worm.description).toContain('-2 penalty');
  expect(worm.situationalNotes).toContainEqual(
    expect.objectContaining({
      target: 'save.will',
      situation: 'mindAffecting',
      text: expect.stringContaining('−4 Will against all mind-affecting'),
    }),
  );
  expect(worm.situationalNotes).toContainEqual(
    expect.objectContaining({
      target: 'save.will',
      situation: {
        local:
          "vs. this Thought Worm caster's mind-affecting spells and effects",
      },
      text: expect.stringContaining('−2 Will applies only against this caster'),
    }),
  );
  const reviewRow = review.candidates.find(
    (row) => row.externalKey === worm.externalKey,
  );
  expect(
    reviewRow?.mechanicsReview.inheritedRuleEvidence.map((row) => row.name),
  ).toEqual(['Thought Worm I', 'Thought Worm II']);
  expect(reviewRow?.linkedKeys).toContain('pf1/mrtqusfmpohlprve');
  const projections = calculateCharacterSheetProjections(
    recordedSpellSheet('Thought Worm III', 'psychic'),
    { situations: ['mindAffecting'] },
  );
  expect(projections.current.derivedStatistics.will.total).toBe(0);
  expect(projections.permanent.derivedStatistics.will.total).toBe(0);
});

it('preserves Drench’s custom blog identity and URL without inventing a publication-code alias', () => {
  const drench = spellFixture('Drench');
  expect(drench.sources).toEqual([
    { book: 'Paizo Blog - Ultimate Cantrips', pages: '' },
  ]);
  expect(drench.unsupported).toContainEqual(
    expect.objectContaining({
      field: 'sources',
      value: expect.objectContaining({
        name: 'Paizo Blog - Ultimate Cantrips',
        date: '2011-05-24',
        url: 'https://paizo.com/community/blog/v5748dyo5lc7e&page=2?Ultimate-Cantrips',
        pages: '',
      }),
    }),
  );
  const candidate = review.candidates.find(
    (row) => row.externalKey === drench.externalKey,
  );
  expect(candidate).toMatchObject({
    disposition: 'held',
    assessmentStatus: 'unresolved',
    requiredNotices: expect.arrayContaining(['Paizo Blog - Ultimate Cantrips']),
  });
  expect(candidate?.noticeHoldIds.length).toBeGreaterThan(0);
});

it.each([
  ['Bane', 'oracle', 1],
  ['Command', 'oracle', 1],
  ['Reduce Person', 'wizard', 1],
  ['Shocking Grasp', 'wizard', 1],
  ['Animal Growth', 'hunter', 4],
] as const)(
  'recording %s preserves its real class level without applying a running effect',
  (name, classTag, level) => {
    const result = calculateCharacterSheetProjections(
      recordedSpellSheet(name, classTag),
    );
    for (const projection of [result.current, result.permanent]) {
      expect(projection.abilities.strength.score).toBe(10);
      expect(projection.abilities.dexterity.score).toBe(10);
      expect(projection.abilities.constitution.score).toBe(10);
      expect(projection.breakdowns['attack.melee'].total).toBe(0);
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

it('invalidates the checked full-description binding if Shocking Grasp’s source damage cap changes', async () => {
  const work = resolve('.scratch/curation-518/test-work');
  await mkdir(work, { recursive: true });
  const root = await mkdtemp(join(work, 'changed-description-'));
  temporary.push(root);
  await cp(fixtureRoot, root, { recursive: true });
  const sourcePath = join(
    root,
    'pf1/packs/spells/shocking-grasp.33pe0bge7b7aq3io.yaml',
  );
  const raw = await readFile(sourcePath, 'utf8');
  expect(raw).toContain('maximum 5d6');
  await writeFile(sourcePath, raw.replace('maximum 5d6', 'maximum 6d6'));
  const artifact = await importCatalog({
    ...inputs,
    systemPath: join(root, 'pf1'),
    contentPath: join(root, 'pf1-content'),
  });
  expect(artifact.curation.stale).toContainEqual(
    expect.objectContaining({
      externalKey: 'pf1/33pe0bge7b7aq3io',
      kind: 'description',
    }),
  );
  expect(
    artifact.curation.applied.some(
      (row) => row.externalKey === 'pf1/33pe0bge7b7aq3io',
    ),
  ).toBe(false);
  expect(
    assessCatalogAdmission({ artifact, ...reviewedAdmission }).admitted,
  ).toEqual([]);
});
