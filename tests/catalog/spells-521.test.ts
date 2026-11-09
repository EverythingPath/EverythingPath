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
import review from '../../scripts/catalog/legal/spells-521.json';
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
import provenance from '../fixtures/spells-521/provenance.json';
import preview from '../fixtures/spells-521/preview.json';
import bindingPreview from '../fixtures/spells-521/binding-preview.json';
import { recordedSpellSheet, spellFixture } from '../fixtures/spells-521/sheet';

const keys = review.candidates.map((row) => row.externalKey);
const fixtureRoot = resolve('tests/fixtures/spells-521');
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

it('pins the exact 100 ticket identities, all fixture bytes and individual legal and prose reviews', async () => {
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(
    review.candidates.filter((row) => row.disposition === 'held'),
  ).toHaveLength(100);
  expect(sha256(keys.join('\n'))).toBe(
    '250644a05b180e38d1fff643a2a659a1788dda3c833fa9f8815895d020a3306a',
  );
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
  for (const candidate of review.candidates) {
    const text = await readFile(
      join(inputs.systemPath, candidate.source.path),
      'utf8',
    );
    const raw = upstreamRecord.parse(parse(text));
    expect(sha256(text), candidate.name).toBe(candidate.source.sha256);
    expect(`pf1/${raw._id}`).toBe(candidate.externalKey);
    expect(raw.type).toBe('spell');
    expect(sha256(sourceDescription(raw))).toBe(candidate.descriptionSha256);
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
        raw.system[field] ?? null,
      );
    }
    const record = curation.records.find(
      (row) =>
        row.externalKey === candidate.externalKey && row.kind === 'description',
    );
    expect(record, candidate.name).toMatchObject({
      textSha256: candidate.descriptionSha256,
      status: 'checked',
    });
    expect(record?.outputs).toHaveLength(
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

it('holds Blacklight for its record-level 3.5 tag under the owner policy, never excluding it', async () => {
  const blacklight = review.candidates.find(
    (row) => row.externalKey === 'pf1/6s2Mrf0bRBHKArPe',
  );
  if (!blacklight) throw new Error('Missing Blacklight');
  const raw = upstreamRecord.parse(
    parse(
      await readFile(join(inputs.systemPath, blacklight.source.path), 'utf8'),
    ),
  );
  expect(raw.system.tags).toContain('3.5');
  expect(raw.system.sources).toEqual([{ id: 'PZO1111', pages: '206' }]);
  expect(blacklight.disposition).toBe('held');
  expect(blacklight).not.toHaveProperty('exclusionReason');
  const holdId = 'spells-521-record-3.5-tag-6s2Mrf0bRBHKArPe';
  expect(blacklight).toHaveProperty('tagPolicyHold', {
    id: holdId,
    tag: '3.5',
    reason: expect.stringContaining(
      "owner's policy (2026-10-08) holds record-level 3.5 tags and never excludes them",
    ),
    ownerPolicyIssues: [521, 522],
  });
  expect(blacklight.holdIds).toEqual([
    'spells-521-whole-content-6s2Mrf0bRBHKArPe',
    holdId,
  ]);
  expect(blacklight.missingEvidence).toContain('record-level 3.5 tag');
  expect(reviewedAdmission.evidence[blacklight.evidenceId]?.content).toContain(
    `Specific tag-policy hold ${holdId}.`,
  );
  expect(
    reviewedAdmission.assessments.find(
      (row) => row.externalKey === blacklight.externalKey,
    )?.status,
  ).toBe('unresolved');
  expect(review.summary).toMatchObject({ held: 100, excluded: 0 });
  expect(spellFixture('Blacklight').modifiers).toEqual([]);
});

it('keeps Fair is Foul’s source-bound table penalties outstanding independently of its reference failure and attribution hold', async () => {
  const candidate = review.candidates.find(
    (row) => row.name === 'Fair is Foul',
  );
  if (!candidate) throw new Error('Missing Fair is Foul');
  const path = 'supporting/arcane-malignancies.Vm8ccE6qchTx2Trn.yaml';
  const raw = await readFile(join(fixtureRoot, path), 'utf8');
  const hash =
    '478ca088c98b7e7ae269bc720e6a080ce46aaae0b3597c3777da8892dd29b900';
  expect(sha256(raw)).toBe(hash);
  const table = z
    .object({
      _id: z.string(),
      name: z.string(),
      formula: z.string(),
      results: z.array(
        z.object({
          _id: z.string(),
          range: z.tuple([z.number(), z.number()]),
          text: z.string(),
        }),
      ),
    })
    .parse(parse(raw));
  expect(table).toMatchObject({
    _id: 'Vm8ccE6qchTx2Trn',
    name: 'Arcane Malignancies',
    formula: '1d100',
  });
  const toes = table.results.find((row) => row._id === '1L0YKX6tnMvS7cYK');
  expect(toes?.range).toEqual([1, 2]);
  expect(toes?.text).toContain('–2 penalty');
  for (const skill of ['{Acrobatics}', '{Climb}', '{Perform (dance)}'])
    expect(toes?.text).toContain(skill);
  const fingers = table.results.find((row) => row._id === 'QdgBIpYNZadJmZcb');
  expect(fingers?.range).toEqual([5, 7]);
  expect(fingers?.text).toContain('–2 penalty');
  for (const skill of ['{Craft}', '{Disable Device}', '{Sleight of Hand}'])
    expect(fingers?.text).toContain(skill);
  const linked = candidate.mechanicsReview.linkedInputReview?.find(
    (row) => row.name === 'Arcane Malignancies',
  );
  expect(linked).toMatchObject({
    path: 'packs/roll-tables/arcane-malignancies.Vm8ccE6qchTx2Trn.yaml',
    sha256: hash,
    fixturePath: path,
    location: expect.stringContaining(
      '/blob/418761d2e16a6037c0156bb4a241f7cea5a2986d/packs/roll-tables/',
    ),
  });
  for (const result of [toes, fingers]) {
    if (!result) throw new Error('Missing source table result');
    const evidence = linked?.results.find((row) => row.id === result._id);
    expect(evidence).toMatchObject({
      range: result.range,
      text: result.text,
      textSha256: sha256(result.text),
      disposition: 'supported-character-statistics-outstanding',
      sourceLocation: expect.stringContaining(
        'arcane-malignancies.Vm8ccE6qchTx2Trn.yaml#L',
      ),
    });
  }
  const outstanding = candidate.mechanicsReview.outstanding.join(' ');
  expect(outstanding).toContain('Acrobatics');
  expect(outstanding).toContain('Disable Device');
  expect(outstanding).toMatch(/[-−–]2/);
  expect(candidate.referenceFailures).toContainEqual(
    expect.objectContaining({
      field: 'description.link',
      value: 'Compendium.pf1.roll-tables.Vm8ccE6qchTx2Trn',
    }),
  );
  expect(candidate.disposition).toBe('held');
  expect(candidate.holdIds.length).toBeGreaterThan(0);
  expect(candidate.requiredNotices).toEqual(
    expect.arrayContaining(['PZO9485', 'PZO1110', 'PZO1115']),
  );
  expect(
    reviewedAdmission.assessments.find(
      (row) => row.externalKey === candidate.externalKey,
    )?.status,
  ).toBe('unresolved');
  expect(spellFixture('Fair is Foul').modifiers).toEqual([]);
  const projection = calculateCharacterSheetProjections(
    recordedSpellSheet('Fair is Foul', 'oracle'),
  );
  expect(projection.current.spellEffects).toEqual([]);
});

it.each([
  ['Allegro', 'PZO1110', 'haste'],
  ['Divine Arrow', 'PZO1110', 'lay on hands'],
  ['Shadow Bomb Admixture', 'PZO1115', 'all bombs'],
  ["Aram Zey's Focus", 'PZO1110', 'trapfinding'],
  ['Blood Scent', 'PZO1112', 'scent universal monster ability'],
  ['Thoughtsense', 'PZO1112', 'blindsight ability'],
  ['Claim Identity', 'PZO1110', 'alter self'],
  ['Summon Ancestral Guardian', 'PZO1110', 'spiritual weapon'],
  ['Scorching Ash Form', 'PZO1112', 'fire subtype'],
  ['Protection from Evil, Communal', 'PZO1110', 'protection from evil'],
  ['Searching Shadows', 'PZO1115', 'steal combat maneuver'],
  ['Celestial Healing', 'PZO1112', 'fast healing 1'],
  ['Etheric Shards', 'PZO1115', 'drag'],
] as const)(
  '%s binds the inherited %s notice to literal rule text',
  async (name, notice, wording) => {
    const candidate = review.candidates.find((row) => row.name === name);
    if (!candidate) throw new Error(`Missing Spell ${name}`);
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
        (row) => row.externalKey === candidate.externalKey,
      )?.requiredNotices,
    ).toContain(notice);
  },
);

it.each([
  [
    'Fireball',
    '45d864ca72e166e5aad993a79ce809fb9202ece21c1da800af371a2d7e25ca5f',
  ],
  [
    'Paragon Surge',
    '362032aac02009d0bd7785f5a8955aed2002186e8bf039af378e2a7d42c0fefc',
  ],
  [
    'Searching Shadows',
    '6f4117441c10d936540eb441c1ddb8ea8b5621faa1efec27beea330a33c75c15',
  ],
  [
    'Thorn Javelin',
    '03c2d7925cc385ed81fe26d40cd1cb0e2ec8f370403a7f1e07bc5914ac5cc42b',
  ],
  [
    'Touch of Idiocy',
    'c654ec05da056d9e5b97484a654b9a48b2d70b0316868095cfda4295a51556f3',
  ],
  [
    'Tree Shape',
    'd25691a10e5582815c53a78ee3035e4337594e3867f287b11ee475ba0cf51c54',
  ],
  [
    'Umbral Infusion, Mass',
    'eac81377a8d8eb0a478af76bf6a2480fde0d3904155e74fbda3c982c3b7e0779',
  ],
] as const)(
  '%s has the independently inspected pinned-checkout bytes',
  async (name, hash) => {
    const candidate = review.candidates.find((row) => row.name === name);
    if (!candidate) throw new Error(`Missing Spell ${name}`);
    expect(
      sha256(
        await readFile(join(inputs.systemPath, candidate.source.path), 'utf8'),
      ),
    ).toBe(hash);
  },
);

it('replays every full-context assessment binding and detects an inherited-rule change', () => {
  const spellSchema = importedCatalogEntrySchema.extend({
    detail: importedSpellDetailSchema,
  });
  const artifact = {
    catalog: {
      entries: z.array(spellSchema).parse(bindingPreview.entries),
      resources: z.array(spellSchema).parse(bindingPreview.resources),
      remaps: z.array(appliedRemapSchema).parse(bindingPreview.remaps),
    },
    comparison: { records: [], packs: [] },
  };
  expect(bindingPreview.candidateKeys).toEqual(keys);
  expect(bindingPreview.rootKeys).toHaveLength(100);
  expect([...bindingPreview.rootKeys].sort()).toEqual([...keys].sort());
  for (const key of keys) {
    const entry = artifact.catalog.entries.find(
      (row) => row.externalKey === key,
    );
    const assessment = reviewedAdmission.assessments.find(
      (row) => row.externalKey === key,
    );
    if (!entry || !assessment) throw new Error(`Missing bound Spell ${key}`);
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
  const changed = structuredClone(artifact);
  const mass = changed.catalog.entries.find(
    (row) => row.name === 'Umbral Infusion, Mass',
  );
  const parent = changed.catalog.entries.find(
    (row) => row.name === 'Umbral Infusion',
  );
  const assessment = reviewedAdmission.assessments.find(
    (row) => row.externalKey === mass?.externalKey,
  );
  if (!mass || !parent || !assessment)
    throw new Error('Missing inherited Umbral Infusion context');
  expect(parent.description).toContain('advanced creature simple template');
  expect(assessment.requiredNotices).toContain('PZO1112');
  parent.description = parent.description.replace(
    'advanced creature simple template',
    'different creature simple template',
  );
  expect(
    buildAssessmentBinding({
      entry: mass,
      artifact: changed,
      ...reviewedAdmission,
      requiredNotices: assessment.requiredNotices,
      evidenceIds: Object.keys(assessment.evidenceFingerprints),
    }).contentFingerprint,
  ).not.toBe(assessment.contentFingerprint);
});

it('reproduces the held-only preview with all Sources and separate outstanding calculation diagnostics', async () => {
  const artifact = await importCatalog(inputs);
  expect(artifact.catalog.entries).toEqual(preview.entries);
  expect(artifact.comparison.summary).toMatchObject({
    upstreamRecords: 100,
    admitted: 100,
    excluded: 0,
    unassigned: 0,
  });
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
  expect(
    artifact.catalog.entries.reduce(
      (count, row) => count + (row.situationalNotes?.length ?? 0),
      0,
    ),
  ).toBe(109);
  const outstanding = review.candidates.filter(
    (row) => row.mechanicsReview.outstanding.length > 0,
  );
  expect(outstanding).toHaveLength(51);
  expect(
    artifact.curation.unresolvedDescriptions
      .map((row) => row.externalKey)
      .sort(),
  ).toEqual(outstanding.map((row) => row.externalKey).sort());
  for (const row of artifact.curation.unresolvedDescriptions) {
    const candidate = outstanding.find(
      (candidate) => candidate.externalKey === row.externalKey,
    );
    expect(
      row.diagnostics
        .filter((diagnostic) => diagnostic.kind === 'unresolved')
        .map((diagnostic) => diagnostic.text)
        .sort(),
    ).toEqual([...(candidate?.mechanicsReview.outstanding ?? [])].sort());
  }
  for (const entry of artifact.catalog.entries) {
    expect(entry.detail.kind).toBe('spell');
    expect(entry.modifiers, entry.name).toEqual([]);
    expect(entry.sourceKey, entry.name).toBeUndefined();
    const source = provenance.rawSources.find(
      (row) => row.externalKey === entry.externalKey,
    );
    if (!source) throw new Error(`Missing Spell fixture ${entry.externalKey}`);
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
  ).toEqual([...keys].sort());
});

it.each([
  ['Ascension', /mythic/i],
  ['Speak with Plane', /plane/i],
  ['Summon Ancestral Guardian', /attack|weapon/i],
  ['Symbol of Striking', /attack|weapon/i],
] as const)(
  '%s retains its unpromised external procedure as prose rather than a promised calculation',
  (name, wording) => {
    const candidate = review.candidates.find((row) => row.name === name);
    if (!candidate) throw new Error(`Missing Spell ${name}`);
    expect(candidate.mechanicsReview.outstanding).toEqual([]);
    expect(candidate.mechanicsReview.proseOnlyMechanics.join(' ')).toMatch(
      wording,
    );
    expect(spellFixture(name).situationalNotes?.length).toBeGreaterThan(0);
    expect(spellFixture(name).modifiers).toEqual([]);
  },
);

it('registers every batch notice hold independently of unresolved content assessments', () => {
  for (const requirement of review.noticeRequirements) {
    if (!requirement.holdId) continue;
    const enforced = heldNotices.find((row) => row.id === requirement.holdId);
    expect(enforced, requirement.book).toBeDefined();
    expect(enforced?.notices).toEqual(
      expect.arrayContaining([requirement.book, ...requirement.registryKeys]),
    );
    expect(enforced?.evidence).toContain(
      'scripts/catalog/legal/spells-521.json',
    );
  }
});

it('keeps Thorn Javelin’s temporary weapon proficiency outstanding without granting it from a recorded Spell', () => {
  const thorn = spellFixture('Thorn Javelin');
  expect(thorn.description).toContain('you are proficient in its use');
  expect(thorn.description).toContain('sickened for 1 round');
  expect(thorn.modifiers).toEqual([]);
  const reviewRow = review.candidates.find(
    (row) => row.name === 'Thorn Javelin',
  );
  expect(reviewRow?.mechanicsReview.outstanding.join(' ')).toMatch(
    /proficien/i,
  );
  const result = calculateCharacterSheetProjections(
    recordedSpellSheet('Thorn Javelin', 'druid'),
  );
  expect(result.current.proficiencies).toEqual(result.permanent.proficiencies);
  expect(result.current.proficiencies.grants).toEqual([]);
  expect(result.current.proficiencies.added).toEqual([]);
  expect(result.current.spellEffects).toEqual([]);
});

it.each([
  ['Sure Casting', 'spellResistance', 'caster level'],
  ['Wrath', 'spellResistance', 'designated enemy'],
  ['Searching Shadows', 'disarm', 'disarm'],
  ['Searching Shadows', 'steal', 'steal'],
  ['Bloodstone Mirror', 'mindAffecting', 'mind-affecting'],
  ['Magic Circle against Law', 'lawfulCreatures', 'lawful'],
] as const)(
  '%s reuses shared %s on readable reference Notes',
  (name, situation, wording) => {
    expect(curation.situations.some((row) => row.key === situation)).toBe(true);
    expect(spellFixture(name).situationalNotes).toContainEqual(
      expect.objectContaining({
        situation,
        text: expect.stringContaining(wording),
      }),
    );
    expect(spellFixture(name).modifiers).toEqual([]);
  },
);

it('pins real Paragon Surge and Tree Shape ability changes as separate running effects', () => {
  const surge = spellFixture('Paragon Surge');
  expect(surge.externalKey).toBe('pf1/5v3j49r4mdq9rbx6');
  expect(surge.detail.levels).toMatchObject({ oracle: 3, wizard: 3, magus: 4 });
  expect(surge.description).toContain(
    '+2 enhancement bonus to Dexterity and Intelligence',
  );
  expect(surge.description).toContain('any one feat');
  expect(surge.modifiers).toEqual([]);
  const tree = spellFixture('Tree Shape');
  expect(tree.externalKey).toBe('pf1/6ho3wsspkqkhypt0');
  expect(tree.sources).toEqual([{ book: 'PZO1110', pages: '362' }]);
  expect(tree.detail.levels).toMatchObject({ druid: 2, ranger: 3 });
  expect(tree.description).toContain('+10 natural armor bonus');
  expect(tree.description).toContain('effective Dexterity score of 0');
  expect(tree.modifiers).toEqual([]);
  for (const name of ['Paragon Surge', 'Tree Shape']) {
    expect(
      review.candidates.find((row) => row.name === name)?.mechanicsReview
        .outstanding.length,
    ).toBeGreaterThan(0);
  }
});

it('pins Fireball’s capped damage and Touch of Idiocy’s raw action notes without treating them as ordinary Spell Modifiers', () => {
  const fireball = spellFixture('Fireball');
  expect(fireball.externalKey).toBe('pf1/6oq1wcryviik9ice');
  expect(fireball.sources).toEqual([{ book: 'PZO1110', pages: '283' }]);
  expect(fireball.detail.levels).toMatchObject({
    wizard: 3,
    magus: 3,
    bloodrager: 3,
  });
  expect(fireball.detail.grantedLevels).toMatchObject({
    domain: { Fire: 3 },
    bloodline: { Efreeti: 3 },
  });
  expect(fireball.description).toContain('maximum 10d6');
  expect(
    review.candidates.find((row) => row.name === 'Fireball')?.mechanicsReview
      .metadata.actions,
  ).toContainEqual(
    expect.objectContaining({
      damage: { parts: [{ formula: '(min(10, @cl))d6', types: ['fire'] }] },
      save: { description: 'Reflex half', type: 'ref' },
      duration: { units: 'inst' },
    }),
  );
  const idiocy = spellFixture('Touch of Idiocy');
  expect(idiocy.description).toContain('1d6 penalty');
  expect(idiocy.description).toContain(
    "can't reduce any of these scores below 1",
  );
  expect(
    review.candidates.find((row) => row.name === 'Touch of Idiocy')
      ?.mechanicsReview.metadata.actions,
  ).toContainEqual(
    expect.objectContaining({
      notes: {
        effect: [
          '[[1d6]] Int Penalty',
          '[[1d6]] Wis Penalty',
          '[[1d6]] Cha Penalty',
        ],
      },
      duration: { units: 'minute', value: '10 * @cl' },
    }),
  );
  expect(fireball.modifiers).toEqual([]);
  expect(idiocy.modifiers).toEqual([]);
  expect(
    review.candidates.find((row) => row.name === 'Touch of Idiocy')
      ?.mechanicsReview.outstanding.length,
  ).toBeGreaterThan(0);
  const idiocyOutstanding = review.candidates
    .find((row) => row.name === 'Touch of Idiocy')
    ?.mechanicsReview.outstanding.join(' ');
  expect(idiocyOutstanding).toContain('one rolled');
  expect(idiocyOutstanding).toContain('minimum score of 1');
  expect(idiocyOutstanding).toContain('not independent rolls');
});

it.each([
  ['Paragon Surge', 'oracle', 3],
  ['Tree Shape', 'druid', 2],
  ['True Skill', 'wizard', 1],
  ['Fireball', 'wizard', 3],
  ['Touch of Idiocy', 'wizard', 2],
  ['Wrath', 'inquisitor', 1],
] as const)(
  'the public resolver records %s on its %s list without inventing its running effect',
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

it('invalidates a checked real ability-bonus description after a numeric source change', async () => {
  const work = resolve('.scratch/curation-521/test-work');
  await mkdir(work, { recursive: true });
  const root = await mkdtemp(join(work, 'changed-description-'));
  temporary.push(root);
  await cp(fixtureRoot, root, { recursive: true });
  const candidate = review.candidates.find(
    (row) => row.name === 'Paragon Surge',
  );
  if (!candidate) throw new Error('Missing Paragon Surge');
  const sourcePath = join(root, 'pf1', candidate.source.path);
  const raw = await readFile(sourcePath, 'utf8');
  expect(raw).toMatch(/\+2\s+enhancement/);
  await writeFile(sourcePath, raw.replace(/\+2(\s+enhancement)/, '+3$1'));
  const artifact = await importCatalog({
    ...inputs,
    systemPath: join(root, 'pf1'),
    contentPath: join(root, 'pf1-content'),
  });
  expect(artifact.curation.stale).toContainEqual(
    expect.objectContaining({
      externalKey: candidate.externalKey,
      kind: 'description',
    }),
  );
  expect(
    artifact.curation.applied.some(
      (row) => row.externalKey === candidate.externalKey,
    ),
  ).toBe(false);
  expect(
    assessCatalogAdmission({ artifact, ...reviewedAdmission }).admitted,
  ).toEqual([]);
});
