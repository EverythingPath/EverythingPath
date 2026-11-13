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
import review from '../../scripts/catalog/legal/spells-517.json';
import { reviewedCuration as curation } from '../../scripts/catalog/reviewed-curation-data';
import { importCatalog } from '../../scripts/catalog/import';
import { buildAssessmentBinding } from '../../scripts/catalog/admission';
import {
  sourceDescription,
  upstreamRecord,
} from '../../scripts/catalog/records';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import { calculateCharacterSheetProjections } from '../../src/lib/character-sheet';
import provenance from '../fixtures/spells-517/provenance.json';
import preview from '../fixtures/spells-517/preview.json';
import { recordedSpellSheet, spellFixture } from '../fixtures/spells-517/sheet';
import { assessWithUnclearedHolds } from './uncleared-holds';
import {
  classListAssessment,
  expectWaveCl6InventoryRow,
  isWaveCl6Row,
} from './launch-reassessment';

const keys = review.candidates.map((row) => row.externalKey);
// Wave CL6 (#517, #519 and #520) re-assesses the batch's 15 class-list-only
// Spells in place; the other 85 keep their whole-content holds.
const relaunched = review.candidates.filter((row) => isWaveCl6Row(row));
const whole = (row: { externalKey: string }) =>
  `spells-517-whole-content-${row.externalKey.split('/')[1]}`;
// A wave CL6 row keeps its whole-content hold and missing-evidence statement
// in its history (expectWaveCl6InventoryRow replays it); every other row is
// still held on it.
function expectHoldState(candidate: (typeof review.candidates)[number]) {
  if (isWaveCl6Row(candidate)) {
    const [history] = candidate.assessmentHistory ?? [];
    expect(history?.holdIds, candidate.name).toEqual([whole(candidate)]);
    expect(history?.missingEvidence?.length).toBeGreaterThan(0);
    expect(candidate.holdIds).toEqual([]);
    expect(candidate.noticeRequirementsComplete).toBe(true);
    return;
  }
  expect(candidate.noticeRequirementsComplete).toBe(false);
  expect(candidate.holdIds.length).toBeGreaterThan(0);
  expect(candidate.missingEvidence?.length).toBeGreaterThan(0);
}
const EARLIER = {
  reviewedBy: 'Sol (AI curator) for the owner',
  reviewedOn: '2026-10-07',
};
const fixtureRoot = resolve('tests/fixtures/spells-517');
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

it('accounts for exactly the 100 ticket Spells with pinned source bytes and individual whole-content holds', async () => {
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  // Ordered exact-review-inventory keys in issue #517, joined by LF.
  expect(sha256(keys.join('\n'))).toBe(
    '2c1e7fb1757ec29d1032b5b597ea9132edee1dda947594d7cb34e92b2eac2287',
  );
  expect(provenance.rawSources.map((row) => row.externalKey)).toEqual(keys);
  expect(await readdir(join(inputs.systemPath, 'packs/spells'))).toHaveLength(
    100,
  );
  expect(provenance.dependencies).toHaveLength(28);
  expect(await readdir(join(inputs.systemPath, 'packs/classes'))).toHaveLength(
    28,
  );
  expect(
    provenance.dependencies.some((row) => keys.includes(row.externalKey)),
  ).toBe(false);
  const assessments = reviewedAdmission.assessments.filter((row) =>
    keys.includes(row.externalKey),
  );
  expect(assessments).toHaveLength(100);
  expect(new Set(assessments.map((row) => row.externalKey)).size).toBe(100);
  expect(
    review.candidates.filter((row) => row.disposition === 'held'),
  ).toHaveLength(85);
  expect(relaunched).toHaveLength(15);
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
    const mechanics = candidate.mechanicsReview;
    expect(mechanics.descriptionReview).toBe(
      'complete-full-description-and-all-actions',
    );
    expect(mechanics.descriptionRecord).toMatchObject({
      kind: 'description',
      target: 'description',
      textSha256: candidate.descriptionSha256,
      status: 'checked',
    });
    expect(mechanics.requiredRecords).toEqual([]);
    expect(mechanics.recordedSpellModifiers).toBe(0);
    expect(mechanics.manualRules.length).toBeGreaterThan(0);
    for (const [field, value] of Object.entries(mechanics.metadata)) {
      expect(value, `${candidate.name}: ${field}`).toEqual(
        record.system[field] ?? null,
      );
    }
    const descriptionRecord = curation.records.find(
      (row) =>
        row.externalKey === candidate.externalKey && row.kind === 'description',
    );
    expect(descriptionRecord?.textSha256).toBe(candidate.descriptionSha256);
    expect(descriptionRecord?.outputs).toHaveLength(
      mechanics.descriptionRecord.outputCount,
    );
    expectHoldState(candidate);
    const assessment = assessments.find(
      (row) => row.externalKey === candidate.externalKey,
    );
    expect(assessment).toMatchObject({
      ...classListAssessment(candidate, EARLIER),
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

it('reproduces the reviewed Spell preview without admitting class context or running Spell Effects', async () => {
  const artifact = await importCatalog(inputs);
  expect(artifact.catalog.entries).toEqual(preview.entries);
  expect(
    artifact.catalog.entries.map((entry) => entry.externalKey).sort(),
  ).toEqual([...keys].sort());
  expect(artifact.curation.passed).toBe(true);
  expect(artifact.curation.summary).toMatchObject({
    required: 0,
    checked: 0,
    missing: 0,
    descriptions: { candidates: 100, checked: 100, drafted: 0 },
  });
  expect(artifact.curation.unresolvedMechanics).toEqual([]);
  expect(artifact.curation.unresolvedDescriptions).toHaveLength(28);
  for (const row of artifact.curation.unresolvedDescriptions) {
    expect(
      review.candidates.find(
        (candidate) => candidate.externalKey === row.externalKey,
      )?.mechanicsReview.outstanding.length,
    ).toBeGreaterThan(0);
  }
  const batchRecords = curation.records.filter((row) =>
    keys.includes(row.externalKey),
  );
  expect(batchRecords).toHaveLength(100);
  for (const record of batchRecords) {
    expect(record.kind).toBe('description');
    expect(record.status).toBe('checked');
    expect(record.outputs.every((output) => output.kind === 'note')).toBe(true);
  }
  for (const entry of artifact.catalog.entries) {
    expect(entry.detail.kind).toBe('spell');
    expect(entry.modifiers, entry.name).toEqual([]);
    expect(entry.sourceKey, entry.name).toBeUndefined();
    const candidate = review.candidates.find(
      (row) => row.externalKey === entry.externalKey,
    );
    if (!candidate)
      throw new Error(`Missing reviewed Spell: ${entry.externalKey}`);
    const raw = z
      .object({
        system: z.object({
          sources: z.array(
            z.object({
              id: z.string().optional(),
              name: z.string().optional(),
              pages: z.string(),
            }),
          ),
        }),
      })
      .parse(
        parse(
          await readFile(
            join(inputs.systemPath, candidate.source.path),
            'utf8',
          ),
        ),
      );
    expect(entry.sources).toEqual(
      raw.system.sources.map((source) => ({
        book: source.id ?? source.name,
        pages: source.pages,
      })),
    );
  }
  const gate = assessWithUnclearedHolds({ artifact, ...reviewedAdmission });
  expect(gate.admitted).toEqual([]);
  expect(
    [
      ...new Set(
        [...gate.held, ...gate.failures, ...gate.dependentOmissions].map(
          (row) => row.externalKey,
        ),
      ),
    ].sort(),
  ).toEqual([...keys].sort());
  const divine = artifact.catalog.entries.find(
    (row) => row.name === 'Divine Favor',
  );
  const assessment = reviewedAdmission.assessments.find(
    (row) => row.externalKey === divine?.externalKey,
  );
  if (!divine || !assessment)
    throw new Error('Missing source-bound Divine Favor');
  expect(gate.held).toContainEqual(
    expect.objectContaining({ externalKey: divine.externalKey }),
  );
  expect(assessment).toMatchObject(
    buildAssessmentBinding({
      entry: divine,
      artifact,
      ...reviewedAdmission,
      requiredNotices: assessment.requiredNotices,
      evidenceIds: Object.keys(assessment.evidenceFingerprints),
    }),
  );
});

it('pins Divine Favor’s capped luck, Blur’s miss chance, Protection from Energy’s absorption and Virtue’s temporary HP as effect prose', () => {
  const divine = spellFixture('Divine Favor');
  expect(divine.externalKey).toBe('pf1/21bxbzdaawjrnvyo');
  expect(divine.sources).toEqual([{ book: 'PZO1110', pages: '273' }]);
  expect(divine.detail).toMatchObject({
    school: 'evo',
    levels: { cleric: 1, inquisitor: 1, oracle: 1, paladin: 1, warpriest: 1 },
    grantedLevels: { domain: { Nobility: 1 }, subDomain: { Archon: 1 } },
  });
  expect(divine.description).toContain('+1 luck');
  expect(divine.description).toContain('every three caster levels');
  expect(divine.description).toContain('maximum +3');
  expect(divine.description).toContain("doesn't apply to spell damage");
  expect(
    review.candidates
      .find((row) => row.externalKey === divine.externalKey)
      ?.mechanicsReview.outstanding.join(' '),
  ).toContain('weapon-only damage scope');
  const blur = spellFixture('Blur');
  expect(blur.externalKey).toBe('pf1/18kryvj2dfuymk9d');
  expect(blur.sources).toEqual([{ book: 'PZO1110', pages: '251' }]);
  expect(blur.detail).toMatchObject({
    school: 'ill',
    subschools: ['glamer'],
    levels: { wizard: 2, bard: 2, summonerUnchained: 2 },
    grantedLevels: { bloodline: { Destined: 2, Protean: 2 } },
  });
  expect(blur.description).toContain('20% miss chance');
  const protection = spellFixture('Protection from Energy');
  expect(protection.externalKey).toBe('pf1/1vh2ewwvzvxunoxk');
  expect(protection.sources).toEqual([{ book: 'PZO1110', pages: '327' }]);
  expect(protection.detail).toMatchObject({
    school: 'abj',
    levels: { wizard: 3, cleric: 3, ranger: 2, hunter: 2 },
    grantedLevels: { domain: { Luck: 3, Protection: 3 } },
  });
  expect(protection.description).toContain('12 points per caster level');
  expect(protection.description).toContain(
    'maximum of 120 points at 10th level',
  );
  expect(protection.description).toContain('does not stack with');
  const virtue = spellFixture('Virtue');
  expect(virtue.externalKey).toBe('pf1/22x4iooz3c3vqof9');
  expect(virtue.sources).toEqual([{ book: 'PZO1110', pages: '365' }]);
  expect(virtue.detail).toMatchObject({
    school: 'trs',
    levels: { cleric: 0, druid: 0, paladin: 1 },
  });
  expect(virtue.description).toContain('1 temporary hit point');
  expect(
    review.candidates
      .find((row) => row.externalKey === virtue.externalKey)
      ?.mechanicsReview.outstanding.join(' '),
  ).toContain('never be treated as an increase to maximum hit points');
});

it('keeps shared grapple, mind-affecting, fear and death Situations on reference Notes without applying running bonuses', () => {
  const bouncy = spellFixture('Bouncy Body');
  for (const target of ['cmb', 'cmd']) {
    expect(bouncy.situationalNotes).toContainEqual(
      expect.objectContaining({
        target,
        situation: 'grapple',
        text: expect.stringContaining('+2 circumstance'),
      }),
    );
  }
  const rite = spellFixture('Rite of Centered Mind');
  expect(rite.situationalNotes).toContainEqual(
    expect.objectContaining({
      target: 'saves',
      situation: 'mindAffecting',
      text: expect.stringContaining('+1 resistance'),
    }),
  );
  expect(rite.situationalNotes).toContainEqual(
    expect.objectContaining({
      target: 'saves',
      situation: 'fear',
      text: expect.stringContaining('+2 resistance'),
    }),
  );
  const blessing = spellFixture('Blessing of Courage and Life');
  for (const situation of ['fear', 'death']) {
    expect(blessing.situationalNotes).toContainEqual(
      expect.objectContaining({
        target: 'saves',
        situation,
        text: expect.stringContaining('+2 morale'),
      }),
    );
  }
  const result = calculateCharacterSheetProjections(
    recordedSpellSheet('Blessing of Courage and Life', 'cleric'),
    { situations: ['fear', 'death'] },
  );
  for (const projection of [result.current, result.permanent]) {
    expect(projection.derivedStatistics.fortitude.total).toBe(0);
    expect(projection.derivedStatistics.reflex.total).toBe(0);
    expect(projection.derivedStatistics.will.total).toBe(0);
  }
});

it('preserves custom and malformed source citations without inventing publication aliases', () => {
  const cases = [
    ['Penumbra', 'Paizo Blog - Ultimate Cantrips', ''],
    ['Soothing Word', 'GameMastery Condition Cards', ''],
    ['Languid Venom', 'Languid Venom', '218'],
  ] as const;
  for (const [name, book, pages] of cases) {
    expect(spellFixture(name).sources).toEqual([{ book, pages }]);
    const candidate = review.candidates.find((row) => row.name === name);
    expect(candidate).toMatchObject({
      disposition: 'held',
      assessmentStatus: 'unresolved',
      noticeRequirementsComplete: false,
      requiredNotices: expect.arrayContaining([book]),
    });
    expect(candidate?.noticeHoldIds.length).toBeGreaterThan(0);
  }
  expect(
    review.candidates.find((row) => row.name === 'Languid Venom')
      ?.proseSourceCitations,
  ).toContainEqual(expect.objectContaining({ book: 'PZO1110', pages: '558' }));
});

it.each([
  ['Divine Favor', 'cleric', 1],
  ['Blur', 'wizard', 2],
  ['Protection from Energy', 'ranger', 2],
  ['Virtue', 'cleric', 0],
] as const)(
  'recording %s preserves its level without applying a running effect',
  (name, classTag, level) => {
    expect(spellFixture(name).modifiers).toEqual([]);
    const result = calculateCharacterSheetProjections(
      recordedSpellSheet(name, classTag),
    );
    for (const projection of [result.current, result.permanent]) {
      expect(projection.abilities.strength.score).toBe(10);
      expect(projection.breakdowns['attack.melee'].total).toBe(0);
      expect(projection.breakdowns['damage.melee'].total).toBe(0);
      expect(projection.derivedStatistics.fortitude.total).toBe(0);
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

it('exercises confirmed permission only in memory while keeping shipping assessments unresolved and notice-chain holds enforced', async () => {
  const artifact = await importCatalog(inputs);
  const examples = artifact.catalog.entries.filter((row) =>
    ['Divine Favor', 'Wrathful Mantle'].includes(row.name),
  );
  expect(examples).toHaveLength(2);
  // This deliberate fixture permission exercises admission control. It is not
  // evidence of a completed real-content comparison and is never persisted.
  const evidence = {
    'fixture-only': {
      content:
        'Test-only permission for isolated admission behavior; shipping content remains unresolved.',
    },
  };
  const apgKey =
    'pf1-content/notice/7d75468ec859d3452bcef8458792e6ef19c7aafcf9cbaf2f759fdf4bc923b2a2';
  const apgNotice = reviewedAdmission.registry[apgKey];
  if (!apgNotice) throw new Error('Missing reviewed APG compilation notice');
  // The shipping Registry has no APG product-code alias. Add it only to this
  // in-memory fixture so the accepted notice binding reaches the hold check.
  // The notice-hold clearance's drafted PRD record for PZO1115 (2026-10-30)
  // claims the code too; it stands aside so the alias resolves.
  const { PZO1115: _drafted, ...committedRegistry } =
    reviewedAdmission.registry;
  const registry = {
    ...committedRegistry,
    [apgKey]: { ...apgNotice, aliases: ['PZO1115'] },
  };
  const assessments = examples.map((entry) => {
    const shipping = reviewedAdmission.assessments.find(
      (row) => row.externalKey === entry.externalKey,
    );
    if (!shipping) throw new Error(`Missing assessment: ${entry.externalKey}`);
    return {
      ...shipping,
      status: 'confirmed' as const,
      rationale: 'Fixture-only confirmed permission; never shipping coverage.',
      ...buildAssessmentBinding({
        entry,
        artifact,
        evidence,
        registry,
        requiredNotices: shipping.requiredNotices,
        evidenceIds: ['fixture-only'],
      }),
    };
  });
  const gate = assessWithUnclearedHolds({
    artifact,
    ...reviewedAdmission,
    evidence,
    assessments,
    registry,
  });
  expect(gate.admitted).toContainEqual(
    expect.objectContaining({ externalKey: 'pf1/21bxbzdaawjrnvyo' }),
  );
  const mantle = spellFixture('Wrathful Mantle');
  expect(gate.held).toContainEqual(
    expect.objectContaining({
      externalKey: mantle.externalKey,
      reason: expect.stringContaining('Notice holds:'),
    }),
  );
  for (const entry of examples) {
    expect(
      reviewedAdmission.assessments.find(
        (row) => row.externalKey === entry.externalKey,
      )?.status,
    ).toBe('unresolved');
  }
  expect(
    assessWithUnclearedHolds({ artifact, ...reviewedAdmission }).admitted,
  ).toEqual([]);
});

it('invalidates the exact checked description if Blur’s source miss chance changes', async () => {
  const work = resolve('.scratch/spells-517-test-work');
  await mkdir(work, { recursive: true });
  const root = await mkdtemp(join(work, 'changed-description-'));
  temporary.push(root);
  await cp(fixtureRoot, root, { recursive: true });
  const sourcePath = join(root, 'pf1/packs/spells/blur.18kryvj2dfuymk9d.yaml');
  const raw = await readFile(sourcePath, 'utf8');
  expect(raw).toContain('20% miss chance');
  await writeFile(
    sourcePath,
    raw.replace('20% miss chance', '30% miss chance'),
  );
  const artifact = await importCatalog({
    ...inputs,
    systemPath: join(root, 'pf1'),
    contentPath: join(root, 'pf1-content'),
  });
  expect(artifact.curation.stale).toContainEqual(
    expect.objectContaining({
      externalKey: 'pf1/18kryvj2dfuymk9d',
      kind: 'description',
    }),
  );
  expect(
    artifact.curation.applied.some(
      (row) => row.externalKey === 'pf1/18kryvj2dfuymk9d',
    ),
  ).toBe(false);
  expect(
    artifact.catalog.entries.find(
      (row) => row.externalKey === 'pf1/18kryvj2dfuymk9d',
    )?.modifiers,
  ).toEqual([]);
  expect(
    assessWithUnclearedHolds({ artifact, ...reviewedAdmission }).admitted,
  ).toEqual([]);
});

// Wave CL6 (#517, #519 and #520): the batch's 15 class-list-only Spells, each
// with its exact required notices.
const WAVE_CL6_ROWS = [
  ['Campfire Wall', ['PZO1115', 'PZO1110', 'PZO1131']],
  ['Ear-Piercing Scream', ['PZO1117', 'PZO1110', 'PZO1131']],
  ['Aspect of the Stag', ['PZO1115', 'PZO1110', 'PZO1131']],
  ['Pain Strike, Mass', ['PZO1115', 'PZO1110', 'PZO1131']],
  ['Antipathy', ['PZO1110', 'PZO1131']],
  ['Ball Lightning', ['PZO1115', 'PZO1110', 'PZO1131']],
  ['Locate Weakness', ['PZO1118', 'PZO1110', 'PZO1131']],
  ['Snake Staff', ['PZO1115', 'PZO1110', 'PZO1112', 'PZO1131']],
  ['Burning Gaze', ['PZO1115', 'PZO1110', 'PZO1131']],
  ['Nap Stack', ['PZO1115', 'PZO1110', 'PZO1131']],
  ['Virtue', ['PZO1110', 'PZO1131']],
  ['Mending', ['PZO1110', 'PZO1131']],
  ['Summon Monster II', ['PZO1110', 'PZO1112', 'PZO1131']],
  ['Blessing of Courage and Life', ['PZO1115', 'PZO1110', 'PZO1131']],
  ['Bloodhound', ['PZO1115', 'PZO1110', 'PZO1112', 'PZO1131']],
] as const;

it.each(WAVE_CL6_ROWS)(
  're-assesses %s in place against the literal pinned PCGen rows (wave CL6)',
  async (name, requiredNotices) => {
    const row = review.candidates.find((item) => item.name === name);
    if (!row) throw new Error(`Missing ${name}`);
    await expectWaveCl6InventoryRow(row, {
      batch: 517,
      launch: (review as { launchReassessment?: unknown }).launchReassessment,
      requiredNotices: [...requiredNotices],
    });
  },
);

it('records wave CL6 in place: 15 admitted, the other 85 Spells keep their holds', () => {
  expect(relaunched.map((row) => row.name)).toEqual(
    WAVE_CL6_ROWS.map(([name]) => name),
  );
  expect(
    (review as { launchReassessment?: unknown }).launchReassessment,
  ).toMatchObject({
    admittedKeys: relaunched.map((row) => row.externalKey),
    dependentlyOmittedKeys: [],
    namedHolds: {},
  });
  expect(review.summary).toMatchObject({
    total: 100,
    admitted: 15,
    held: 85,
    wholeContentHolds: 85,
  });
  for (const row of review.candidates.filter((item) => !isWaveCl6Row(item)))
    expect(row.holdIds, row.name).toContain(whole(row));
  const lr = (name: string) =>
    review.candidates.find((row) => row.name === name)?.launchReview as
      | { notes: string[]; metadata: { readings: string } }
      | undefined;
  // Snake Staff: PCGen's Bestiary pointer is a recorded wording difference,
  // and its Bestiary snakes and templates require PZO1112.
  expect(lr('Snake Staff')?.notes[0]).toContain(
    'page 255 of the Pathfinder Bestiary',
  );
  // Antipathy: PCGen's [D] with no Foundry dismiss flag, and Foundry's extra
  // emotion descriptor, are named.
  expect(lr('Antipathy')?.metadata.readings).toContain('Dismissal: PCGen');
  expect(lr('Antipathy')?.metadata.readings).toContain(
    'Descriptors: Foundry also lists emotion',
  );
  // Summon Monster II: PCGen's Summoner's Charm variable is named.
  expect(lr('Summon Monster II')?.metadata.readings).toContain(
    'ConjurationSummonersCharmBonus',
  );
});
