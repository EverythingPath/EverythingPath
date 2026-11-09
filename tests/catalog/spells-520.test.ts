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
import review from '../../scripts/catalog/legal/spells-520.json';
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
import { withFullBindingContext738 } from './full-binding-context-738';
import {
  appliedRemapSchema,
  importedCatalogEntrySchema,
  importedSpellDetailSchema,
} from '../../src/lib/catalog/imported-entry-schema';
import { calculateCharacterSheetProjections } from '../../src/lib/character-sheet';
import provenance from '../fixtures/spells-520/provenance.json';
import preview from '../fixtures/spells-520/preview.json';
import bindingPreview from '../fixtures/spells-520/binding-preview.json';
import { recordedSpellSheet, spellFixture } from '../fixtures/spells-520/sheet';

const keys = review.candidates.map((row) => row.externalKey);
const folderKey = 'pf1/5817mpDMdZrVJXp7';
const spellKeys = keys.filter((key) => key !== folderKey);
const fixtureRoot = resolve('tests/fixtures/spells-520');
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

it.each([
  ['Umbral Infusion', 'PZO1112', 'advanced creature simple template'],
  ['Naga Shape I', 'PZO1110', 'beast shape II'],
  ["Mad Sultan's Melody", 'PZO1110', 'fascinate bardic performance'],
  ['Spirit Call', 'PZO1129', 'spirit magic list'],
  ['Lightning Lash Bomb Admixture', 'PZO1115', 'all bombs'],
  ['Instant Armor', 'PZO1110', 'armor typical of its type'],
  ['Dust Form', 'PZO1112', 'considered incorporeal'],
  ['Bless Army', 'PZO1125', 'OM and Morale checks'],
  ['Sealed Life', 'PZO1115', "summoner's life link"],
  ['Analyze Aura', 'PZO1118', 'grit pool'],
  ['Bullet Ward', 'PZO1118', 'firearm attacks'],
  ['Swallow Your Fear', 'PZO1110', 'confused condition'],
  ['Air Bubble', 'PZO1110', 'every 5 feet of water'],
  ['Summon Giant Ally II', 'PZO1112', 'fire, frost'],
  ['Summon Giant Ally II', 'PZO1116', 'marsh'],
  ['Summon Giant Ally II', 'PZO1127', 'river, slag'],
  [
    'Summon Giant Ally II',
    'pf1-content/notice/b840ae33b9e70cfac2d8606381d06e4d1d147ee00e1ddc24edc2daf84ec77078',
    'desert',
  ],
] as const)(
  '%s requires %s for its literal inherited rule',
  async (name, notice, wording) => {
    const candidate = review.candidates.find((row) => row.name === name);
    if (!candidate) throw new Error(`Missing source-bound Spell ${name}`);
    const raw = upstreamRecord.parse(
      parse(
        await readFile(join(inputs.systemPath, candidate.source.path), 'utf8'),
      ),
    );
    expect(
      sourceDescription(raw)
        .replace(/<[^>]*>/g, '')
        .toLowerCase(),
    ).toContain(wording.toLowerCase());
    expect(candidate.requiredNotices).toContain(notice);
    expect(
      reviewedAdmission.assessments.find(
        (assessment) => assessment.externalKey === candidate.externalKey,
      )?.requiredNotices,
    ).toContain(notice);
  },
);

it('replays all 99 full-context content, mapping, evidence and notice bindings from the fresh source preview', () => {
  const spellEntrySchema = importedCatalogEntrySchema.extend({
    detail: importedSpellDetailSchema,
  });
  const artifact = {
    catalog: {
      entries: z.array(spellEntrySchema).parse(bindingPreview.entries),
      resources: z.array(spellEntrySchema).parse(bindingPreview.resources),
      remaps: z.array(appliedRemapSchema).parse(bindingPreview.remaps),
    },
    comparison: { records: [], packs: [] },
  };
  expect(bindingPreview.candidateKeys).toEqual(keys);
  expect(bindingPreview.rootKeys).toHaveLength(99);
  for (const key of bindingPreview.rootKeys) {
    const entry = artifact.catalog.entries.find(
      (row) => row.externalKey === key,
    );
    const assessment = reviewedAdmission.assessments.find(
      (row) => row.externalKey === key,
    );
    if (!entry || !assessment)
      throw new Error(`Missing full-context Spell ${key}`);
    expect(assessment, entry.name).toMatchObject(
      buildAssessmentBinding({
        ...withFullBindingContext738({ entry, artifact }),
        ...reviewedAdmission,
        requiredNotices: assessment.requiredNotices,
        evidenceIds: Object.keys(assessment.evidenceFingerprints),
      }),
    );
  }
  const changed = structuredClone(artifact);
  const harm = changed.catalog.entries.find((row) => row.name === 'Harm');
  const heal = changed.catalog.entries.find((row) => row.name === 'Heal');
  const assessment = reviewedAdmission.assessments.find(
    (row) => row.externalKey === heal?.externalKey,
  );
  if (!harm || !heal || !assessment)
    throw new Error('Missing inherited Heal/Harm context');
  harm.description = harm.description.replace('less than 1', 'less than 2');
  expect(
    buildAssessmentBinding({
      entry: heal,
      artifact: changed,
      ...reviewedAdmission,
      requiredNotices: assessment.requiredNotices,
      evidenceIds: Object.keys(assessment.evidenceFingerprints),
    }).contentFingerprint,
  ).not.toBe(assessment.contentFingerprint);
});

it('pins all 100 ticket identities and raw source bytes, with 99 individually bound held Spells', async () => {
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(sha256(keys.join('\n'))).toBe(
    '93bed041f3f3954e206f759445524f9e3cb1f28fa1811b5cd50581dadd7b5c39',
  );
  expect(provenance.rawSources.map((row) => row.externalKey)).toEqual(keys);
  expect(preview.candidateKeys).toEqual(keys);
  expect(await readdir(join(inputs.systemPath, 'packs/spells'))).toHaveLength(
    100,
  );
  expect(provenance.dependencies).toHaveLength(28);
  expect(
    provenance.dependencies.some((row) => keys.includes(row.externalKey)),
  ).toBe(false);
  expect(
    review.candidates.filter(
      (row) => row.mechanicsReview.metadata.descriptors?.length,
    ),
  ).toHaveLength(51);
  expect(
    review.candidates.filter(
      (row) => row.mechanicsReview.metadata.subschool?.length,
    ),
  ).toHaveLength(42);
  const assessments = reviewedAdmission.assessments.filter((row) =>
    keys.includes(row.externalKey),
  );
  expect(assessments).toHaveLength(99);
  expect(new Set(assessments.map((row) => row.externalKey)).size).toBe(99);
  for (const source of [...provenance.rawSources, ...provenance.dependencies]) {
    expect(
      sha256(await readFile(join(inputs.systemPath, source.path), 'utf8')),
      source.path,
    ).toBe(source.sha256);
  }
  for (const candidate of review.candidates) {
    const raw = await readFile(
      join(inputs.systemPath, candidate.source.path),
      'utf8',
    );
    expect(sha256(raw), candidate.name).toBe(candidate.source.sha256);
    const record = upstreamRecord.parse(parse(raw));
    expect(`pf1/${record._id}`).toBe(candidate.externalKey);
    if (candidate.externalKey === folderKey) {
      expect(record._key).toBe('!folders!5817mpDMdZrVJXp7');
      expect(record.type).toBe('Item');
      expect(record.system).toEqual({});
      expect(candidate.disposition).toBe('excluded');
      expect(candidate.requiredNotices).toEqual([]);
      expect(candidate.holdIds).toEqual([]);
      expect(candidate.exclusionReason).toContain('not a Spell definition');
      expect(assessments.some((row) => row.externalKey === folderKey)).toBe(
        false,
      );
      expect(
        curation.records.some((row) => row.externalKey === folderKey),
      ).toBe(false);
      continue;
    }
    if (!candidate.evidenceId || !candidate.mechanicsReview.descriptionRecord)
      throw new Error(`Missing individual Spell review: ${candidate.name}`);
    expect(record.type).toBe('spell');
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
});

it('reproduces the held-only catalog preview, excludes the folder and keeps calculations separate from legal holds', async () => {
  const artifact = await importCatalog(inputs);
  expect(artifact.catalog.entries).toEqual(preview.entries);
  expect(artifact.comparison.summary).toMatchObject({
    upstreamRecords: 100,
    admitted: 99,
    excluded: 1,
    unassigned: 0,
  });
  expect(artifact.comparison.records).toContainEqual(
    expect.objectContaining({
      externalKey: folderKey,
      status: 'excluded',
      reason: 'Foundry folder metadata is not catalog content.',
    }),
  );
  expect(artifact.catalog.entries.map((row) => row.externalKey).sort()).toEqual(
    [...spellKeys].sort(),
  );
  expect(artifact.curation.passed).toBe(true);
  expect(artifact.curation.summary).toMatchObject({
    required: 0,
    checked: 0,
    missing: 0,
    descriptions: { candidates: 99, checked: 99, drafted: 0 },
  });
  expect(artifact.curation.unresolvedMechanics).toEqual([]);
  expect(artifact.curation.unresolvedDescriptions).toHaveLength(36);
  const outstanding = review.candidates.filter(
    (candidate) => candidate.mechanicsReview.outstanding.length > 0,
  );
  expect(outstanding).toHaveLength(36);
  expect(
    outstanding.reduce(
      (total, candidate) =>
        total + candidate.mechanicsReview.outstanding.length,
      0,
    ),
  ).toBe(40);
  expect(
    artifact.curation.unresolvedDescriptions
      .map((row) => row.externalKey)
      .sort(),
  ).toEqual(outstanding.map((candidate) => candidate.externalKey).sort());
  expect(
    artifact.curation.unresolvedDescriptions.reduce(
      (total, row) =>
        total +
        row.diagnostics.filter((diagnostic) => diagnostic.kind === 'unresolved')
          .length,
      0,
    ),
  ).toBe(40);
  for (const row of artifact.curation.unresolvedDescriptions) {
    const candidate = outstanding.find(
      (candidate) => candidate.externalKey === row.externalKey,
    );
    expect(
      row.diagnostics
        .filter((diagnostic) => diagnostic.kind === 'unresolved')
        .map((diagnostic) => diagnostic.text)
        .sort(),
    ).toEqual(
      candidate?.mechanicsReview.outstanding.map((item) => item.reason).sort(),
    );
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
  expect(
    [
      ...new Set(
        [...gate.held, ...gate.failures, ...gate.dependentOmissions].map(
          (row) => row.externalKey,
        ),
      ),
    ].sort(),
  ).toEqual([...spellKeys].sort());
  const scoop = artifact.catalog.entries.find((row) => row.name === 'Scoop');
  const assessment = reviewedAdmission.assessments.find(
    (row) => row.externalKey === scoop?.externalKey,
  );
  if (!scoop || !assessment)
    throw new Error('Missing source-bound Scoop assessment');
  expect(assessment).toMatchObject(
    buildAssessmentBinding({
      entry: scoop,
      artifact,
      ...reviewedAdmission,
      requiredNotices: assessment.requiredNotices,
      evidenceIds: Object.keys(assessment.evidenceFingerprints),
    }),
  );
  const heal = artifact.catalog.entries.find((row) => row.name === 'Heal');
  const healAssessment = reviewedAdmission.assessments.find(
    (row) => row.externalKey === heal?.externalKey,
  );
  if (!heal || !healAssessment)
    throw new Error('Missing source-bound Heal assessment');
  // The shared assessment binds the full extraction, including Harm. This
  // reduced fixture keeps the root but cannot reproduce that linked closure.
  expect(healAssessment.contentFingerprint).not.toBe(
    buildAssessmentBinding({
      entry: heal,
      artifact,
      ...reviewedAdmission,
      requiredNotices: healAssessment.requiredNotices,
      evidenceIds: Object.keys(healAssessment.evidenceFingerprints),
    }).contentFingerprint,
  );
});

it('pins actual Keen Senses and Effortless Armor rules without applying their running effects', () => {
  const senses = spellFixture('Keen Senses');
  expect(senses.externalKey).toBe('pf1/54x9nw6ni4rpphcn');
  expect(senses.sources).toEqual([{ book: 'PZO1115', pages: '230' }]);
  expect(senses.detail.levels).toMatchObject({
    alchemist: 1,
    druid: 1,
    hunter: 1,
    ranger: 1,
  });
  expect(senses.description).toContain('+2 competence bonus on Perception');
  expect(senses.description).toContain('low-light vision');
  const armor = spellFixture('Effortless Armor');
  expect(armor.externalKey).toBe('pf1/5kaozniy9sjydygq');
  expect(armor.sources).toEqual([{ book: 'PZO1118', pages: '228' }]);
  expect(armor.detail.levels).toMatchObject({
    cleric: 2,
    oracle: 2,
    paladin: 2,
  });
  expect(armor.description).toContain('no longer reduces your speed');
  expect(armor.description).toContain(
    '1 + 1 per five caster levels (maximum 5)',
  );
  expect(armor.modifiers).toEqual([]);
});

it('preserves Heal’s positive-energy action and exclusions as procedure rather than ability restoration', () => {
  const heal = spellFixture('Heal');
  expect(heal.sources).toEqual([{ book: 'PZO1110', pages: '294' }]);
  expect(heal.detail.levels).toMatchObject({
    oracle: 6,
    cleric: 6,
    druid: 7,
    adept: 5,
  });
  expect(heal.detail.grantedLevels).toEqual({ domain: { Healing: 6 } });
  expect(heal.description).toContain('maximum of 150 points at 15th level');
  expect(heal.description).toContain('does not remove negative levels');
  expect(heal.description).toContain('permanently drained ability score');
  const candidate = review.candidates.find(
    (row) => row.externalKey === heal.externalKey,
  );
  expect(candidate?.mechanicsReview.metadata.actions).toContainEqual(
    expect.objectContaining({
      actionType: 'heal',
      damage: {
        parts: [{ formula: 'min(150, @cl * 10)', types: ['positive'] }],
      },
    }),
  );
});

it('retains Ego Whip IV’s inherited rule link, numeric penalty and real descriptor evidence', () => {
  const whip = spellFixture('Ego Whip IV');
  expect(whip.detail.levels).toEqual({ psychic: 6 });
  expect(whip.description).toContain('ego whip I');
  expect(whip.description).toContain('-8 penalty');
  expect(whip.description).toContain('staggered for 1d8 rounds');
  // #738 imports the descriptors the review recorded as lost.
  expect(whip.detail.descriptors).toEqual(['emotion', 'mindAffecting']);
  const candidate = review.candidates.find(
    (row) => row.externalKey === whip.externalKey,
  );
  expect(candidate?.rawReferences).toContain('pf1/z6xg1ckozmmx2s3q');
  expect(candidate?.mechanicsReview.metadata.descriptors).toEqual([
    'emotion',
    'mindAffecting',
  ]);
  expect(
    candidate?.mechanicsReview.inheritedRuleEvidence.map((row) => row.name),
  ).toContain('Ego Whip I');
  const inherited = candidate?.mechanicsReview.inheritedRuleEvidence.find(
    (row) => row.name === 'Ego Whip I',
  );
  expect(inherited?.externalKey).toBe('pf1/z6xg1ckozmmx2s3q');
  expect(inherited?.rawDescription).toContain(
    'Choose Intelligence, Wisdom, or Charisma.',
  );
  expect(inherited?.rawDescription).toContain(
    'A successful Will save negates the staggered effect',
  );
  expect(inherited?.rawDescription).toContain(
    'duration of the penalty to 1 round',
  );
  expect(candidate?.mechanicsReview.outstanding.length).toBeGreaterThan(0);
});

it('keeps Scoop’s custom blog citation and Interplanetary Teleport’s three minimum source identities', () => {
  const scoop = spellFixture('Scoop');
  expect(scoop.sources).toEqual([
    { book: 'Paizo Blog - Ultimate Cantrips', pages: '' },
  ]);
  expect(scoop.detail.levels).toMatchObject({
    wizard: 0,
    sorcerer: 0,
    arcanist: 0,
  });
  expect(scoop.description).toContain('up to 1 pint');
  expect(scoop.description).toContain('up to 5 pounds');
  expect(scoop.description).toContain('rare cantrips');
  expect(scoop.unsupported).toContainEqual(
    expect.objectContaining({
      field: 'sources',
      value: expect.objectContaining({
        name: 'Paizo Blog - Ultimate Cantrips',
        date: '2011-05-24',
        pages: '',
        url: 'https://paizo.com/community/blog/v5748dyo5lc7e&page=2?Ultimate-Cantrips',
      }),
    }),
  );
  const teleport = spellFixture('Interplanetary Teleport');
  expect(teleport.sources).toEqual([
    { book: 'PZO1117', pages: '225' },
    { book: 'PZO9014', pages: '54' },
    { book: 'PZO9226', pages: '295' },
  ]);
  expect(teleport.detail.levels).toMatchObject({ oracle: 9, wizard: 9 });
  expect(teleport.detail.grantedLevels).toEqual({ domain: { Void: 9 } });
  expect(
    review.candidates.find((row) => row.externalKey === teleport.externalKey)
      ?.requiredNotices,
  ).toEqual(expect.arrayContaining(['PZO1117', 'PZO9014', 'PZO9226']));
});

it('uses the shared fear, enchantment and disarm Situations on reference Notes without activating Spell Effects', () => {
  const fear = spellFixture('Swallow Your Fear');
  expect(fear.situationalNotes).toContainEqual(
    expect.objectContaining({
      situation: 'fear',
      text: expect.stringContaining(
        'only while the subject suffers a fear effect',
      ),
    }),
  );
  const duty = spellFixture('Litany of Duty');
  expect(duty.sources).toEqual([{ book: 'PZO9488', pages: '13' }]);
  expect(duty.situationalNotes).toContainEqual(
    expect.objectContaining({
      target: 'saves',
      situation: 'enchantment',
      text: expect.stringContaining(
        '+2 against enchantment effects for 1 round',
      ),
    }),
  );
  const blade = spellFixture('Dazzling Blade, Mass');
  expect(blade.situationalNotes).toContainEqual(
    expect.objectContaining({
      target: 'cmb',
      situation: 'disarm',
      text: expect.stringContaining('maximum +5'),
    }),
  );
  for (const [name, classTag] of [
    ['Swallow Your Fear', 'oracle'],
    ['Litany of Duty', 'paladin'],
    ['Dazzling Blade, Mass', 'wizard'],
  ] as const) {
    const projections = calculateCharacterSheetProjections(
      recordedSpellSheet(name, classTag),
      { situations: ['fear', 'enchantment', 'disarm'] },
    );
    for (const projection of [projections.current, projections.permanent]) {
      expect(projection.abilities.strength.score).toBe(10);
      expect(projection.abilities.constitution.score).toBe(10);
      expect(projection.derivedStatistics.will.total).toBe(0);
      expect(projection.breakdowns['attack.melee'].total).toBe(0);
      expect(projection.spellEffects).toEqual([]);
    }
  }
});

it.each([
  ['Keen Senses', 'hunter', 1],
  ['Effortless Armor', 'oracle', 2],
  ['Heal', 'oracle', 6],
  ['Ego Whip IV', 'psychic', 6],
  ['Scoop', 'wizard', 0],
  ["Badger's Ferocity", 'wizard', 2],
] as const)(
  'the public resolver retains %s at its real level without running effects',
  (name, classTag, level) => {
    const result = calculateCharacterSheetProjections(
      recordedSpellSheet(name, classTag),
    );
    for (const projection of [result.current, result.permanent]) {
      expect(projection.abilities.strength.score).toBe(10);
      expect(projection.abilities.dexterity.score).toBe(10);
      expect(projection.abilities.constitution.score).toBe(10);
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

it('invalidates Heal’s checked description binding when its actual healing cap changes', async () => {
  const work = resolve('.scratch/curation-520/test-work');
  await mkdir(work, { recursive: true });
  const root = await mkdtemp(join(work, 'changed-description-'));
  temporary.push(root);
  await cp(fixtureRoot, root, { recursive: true });
  const sourcePath = join(root, 'pf1/packs/spells/heal.4re1j2w8wkvsvnsi.yaml');
  const raw = await readFile(sourcePath, 'utf8');
  expect(raw).toContain('maximum of 150');
  await writeFile(sourcePath, raw.replace('maximum of 150', 'maximum of 160'));
  const artifact = await importCatalog({
    ...inputs,
    systemPath: join(root, 'pf1'),
    contentPath: join(root, 'pf1-content'),
  });
  expect(artifact.curation.stale).toContainEqual(
    expect.objectContaining({
      externalKey: 'pf1/4re1j2w8wkvsvnsi',
      kind: 'description',
    }),
  );
  expect(
    artifact.curation.applied.some(
      (row) => row.externalKey === 'pf1/4re1j2w8wkvsvnsi',
    ),
  ).toBe(false);
  expect(
    assessCatalogAdmission({ artifact, ...reviewedAdmission }).admitted,
  ).toEqual([]);
});
