// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import review from '../../scripts/catalog/legal/racial-hd-329.json';
import { reviewedCuration as curation } from '../../scripts/catalog/reviewed-curation-data';
import { importCatalog } from '../../scripts/catalog/import';
import { assessCatalogAdmission } from '../../scripts/catalog/admission';
import {
  sourceDescription,
  upstreamRecord,
} from '../../scripts/catalog/records';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import { calculateCharacterSheetProjections } from '../../src/lib/character-sheet';
import { creatureTypeProgressionSeeds } from '../../src/lib/character-sheet-creature-types';
import { racialHdSheet } from '../fixtures/racial-hd-329/sheet';

const fixtureRoot = resolve('tests/fixtures/racial-hd-329');
const inputs = {
  systemPath: join(fixtureRoot, 'pf1'),
  contentPath: join(fixtureRoot, 'pf1-content'),
  remaps: [],
  curation,
};
const sha256 = (text: string) =>
  createHash('sha256').update(text).digest('hex');

it('binds the exact 13 held supporting resources to pinned YAML bytes and individual evidence', async () => {
  const keys = review.candidates.map((candidate) => candidate.externalKey);
  expect(keys).toHaveLength(13);
  expect(new Set(keys).size).toBe(13);
  // Ordered ticket inventory, joined by LF; not a count of selectable entries.
  expect(sha256(keys.join('\n'))).toBe(
    '5017ba552b047673ec235ca38a1a85abc8c53d540b607acba0bd9a60a07a993b',
  );
  const artifact = await importCatalog(inputs);
  expect(artifact.catalog.entries).toEqual([]);
  expect(artifact.catalog.resources).toHaveLength(13);
  expect(artifact.catalog.resources.map((row) => row.externalKey)).toEqual(
    keys,
  );
  for (const candidate of review.candidates) {
    expect(candidate.disposition).toBe('held');
    expect(candidate.noticeRequirementsComplete).toBe(false);
    expect(candidate.holdIds.length).toBeGreaterThan(0);
    const raw = await readFile(
      join(inputs.systemPath, candidate.source.path),
      'utf8',
    );
    expect(sha256(raw), candidate.name).toBe(candidate.source.sha256);
    const record = upstreamRecord.parse(parse(raw));
    expect(`pf1/${record._id}`).toBe(candidate.externalKey);
    expect(record.type).toBe('class');
    expect(sha256(sourceDescription(record))).toBe(candidate.descriptionSha256);
    const resource = artifact.catalog.resources.find(
      (row) => row.externalKey === candidate.externalKey,
    );
    if (resource?.detail.kind !== 'creatureType')
      throw new Error(
        `Missing creature-type resource: ${candidate.externalKey}`,
      );
    const { modifiers, sources, ...detail } =
      candidate.mechanicsReview.mappedFacts;
    expect(resource).toMatchObject({ detail, sources, modifiers });
    const seed = creatureTypeProgressionSeeds.find(
      (row) => row.sourceKey === candidate.externalKey,
    );
    if (!seed)
      throw new Error(`Missing reviewed seed: ${candidate.externalKey}`);
    expect(resource.detail).toEqual({
      kind: 'creatureType',
      tag: seed.creatureType,
      hitDie: seed.progression.hitDie,
      bab: seed.progression.bab,
      saves: seed.progression.saves,
      skillRanksPerHitDie: seed.progression.skillRanksPerHitDie,
      // #720: class skills import as runtime skill keys.
      classSkills: seed.progression.classSkills
        .map((key) => `skill.${key}`)
        .sort(),
    });
    expect(candidate.mechanicsReview.sourceProgression).toEqual({
      hitDie: resource.detail.hitDie,
      bab: resource.detail.bab,
      saves: resource.detail.saves,
      skillRanksPerHitDie: resource.detail.skillRanksPerHitDie,
      classSkills: resource.detail.classSkills,
    });
    const assessment = reviewedAdmission.assessments.find(
      (row) => row.externalKey === candidate.externalKey,
    );
    expect(assessment).toMatchObject({
      status: 'unresolved',
      reviewedBy: 'Sol (AI curator) for the owner',
      reviewedOn: '2026-10-07',
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
});

it('preserves explicit source metadata and keeps the isolated extraction unadmitted', async () => {
  const artifact = await importCatalog(inputs);
  expect(
    artifact.catalog.resources
      .filter((row) => row.sources.length)
      .map((row) => ({
        key: row.externalKey,
        sources: row.sources,
      })),
  ).toEqual([
    {
      key: 'pf1/cV7yHt8i5YCV0ZTd',
      sources: [{ book: 'PZO1112', pages: '309' }],
    },
  ]);
  expect(artifact.curation.passed).toBe(true);
  const gate = assessCatalogAdmission({ artifact, ...reviewedAdmission });
  expect(gate.admitted).toEqual([]);
  expect(
    [
      ...new Set(
        [...gate.held, ...gate.failures].map((row) => row.externalKey),
      ),
    ].sort(),
  ).toEqual(review.candidates.map((row) => row.externalKey));
  // Supplements are outside this exact-source fixture. No accepted content
  // closure is manufactured for the test, even where extraction drops links.
});

// Three fixed racial HD, base scores 10, HP/ranks explicitly recorded by the
// player. These values follow the pinned type features, not Class Level rows.
it.each([
  ['aberration', 2, 1, 1, 3, 12],
  ['animal', 2, 3, 3, 1, 6],
  ['construct', 3, 1, 1, 1, 6],
  ['dragon', 3, 3, 3, 3, 18],
  ['fey', 1, 1, 3, 3, 18],
  ['humanoid', 2, 1, 3, 1, 6],
  ['magicalBeast', 3, 3, 3, 1, 6],
  ['monstrousHumanoid', 3, 1, 3, 3, 12],
  ['ooze', 2, 1, 1, 1, 6],
  ['outsider', 3, 1, 3, 3, 18],
  ['plant', 2, 3, 1, 1, 6],
  ['undead', 2, 1, 1, 3, 12],
  ['vermin', 2, 3, 1, 1, 6],
] as const)(
  'resolves the source-bound %s seed in both public projections',
  (type, bab, fort, ref, will, ranks) => {
    const input = racialHdSheet(type);
    expect(input.entries.some((row) => row.kind === 'classLevel')).toBe(false);
    const result = calculateCharacterSheetProjections(input);
    for (const projection of [result.current, result.permanent]) {
      expect(projection).toMatchObject({
        level: 0,
        racialHitDice: 3,
        hitDice: 3,
        hp: 7,
        budgets: { generalFeats: 2, skillRankCap: 3, racialSkillRanks: ranks },
        derivedStatistics: {
          bab: { total: bab },
          fortitude: { total: fort },
          reflex: { total: ref },
          will: { total: will },
        },
      });
    }
  },
);
