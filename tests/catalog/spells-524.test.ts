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
import review from '../../scripts/catalog/legal/spells-524.json';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
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
import {
  appliedRemapSchema,
  importedCatalogEntrySchema,
} from '../../src/lib/catalog/imported-entry-schema';
import { calculateCharacterSheetProjections } from '../../src/lib/character-sheet';
import provenance from '../fixtures/spells-524/provenance.json';
import preview from '../fixtures/spells-524/preview.json';
import bindingPreview from '../fixtures/spells-524/binding-preview.json';
import { recordedSpellSheet, spellFixture } from '../fixtures/spells-524/sheet';

const keys = review.candidates.map((row) => row.externalKey);
type Candidate = (typeof review.candidates)[number];
type RetainedSpell = Candidate & {
  mechanicsReview: NonNullable<Candidate['mechanicsReview']>;
  requiredNotices: string[];
  holdIds: string[];
  descriptionSha256: string;
  evidenceId: string;
};
const spells = review.candidates.filter(
  (row): row is RetainedSpell => row.kind === 'spell',
);
const folders = review.candidates.filter(
  (row) => row.disposition === 'excluded',
);
const fixtureRoot = resolve('tests/fixtures/spells-524');
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

it('pins all 100 exact ticket identities and raw bytes, including the four excluded folders', async () => {
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  const digest =
    '34c21370b9171afaf5f55ba88d4586286626ae12d9b26c0956c0dbd7c06a3908';
  expect(sha256(keys.join('\n'))).toBe(digest);
  expect(provenance.orderedTicketKeysSha256).toBe(digest);
  expect(provenance.rawSources.map((row) => row.externalKey)).toEqual(keys);
  expect(preview.candidateKeys).toEqual(keys);
  expect(spells).toHaveLength(96);
  expect(folders.map((row) => row.externalKey)).toEqual([
    'pf1/9hBqwSiT8GIHl0Ht',
    'pf1/EmIafjKl7hvbinLh',
    'pf1/Ix6Dc5gXEobiIHKD',
    'pf1/NE0tEwSvcr71GnPC',
  ]);
  expect(await readdir(join(inputs.systemPath, 'packs/spells'))).toHaveLength(
    100 +
      provenance.dependencies.filter((row) =>
        row.path.startsWith('packs/spells/'),
      ).length,
  );
  for (const source of [...provenance.rawSources, ...provenance.dependencies]) {
    const sourceRoot = source.externalKey.startsWith('pf1-content/')
      ? inputs.contentPath
      : inputs.systemPath;
    expect(
      sha256(await readFile(join(sourceRoot, source.path), 'utf8')),
      source.path,
    ).toBe(source.sha256);
  }
  for (const candidate of review.candidates) {
    const text = await readFile(
      join(inputs.systemPath, candidate.source.path),
      'utf8',
    );
    const raw = upstreamRecord.parse(parse(text));
    expect(`pf1/${raw._id}`).toBe(candidate.externalKey);
    expect(sha256(text), candidate.name).toBe(candidate.source.sha256);
    if (candidate.disposition === 'excluded') {
      expect(raw._key).toBe(`!folders!${raw._id}`);
      expect(raw.type).toBe('Item');
      expect(raw.system).toEqual({});
      expect(
        preview.entries.some(
          (entry) => entry.externalKey === candidate.externalKey,
        ),
      ).toBe(false);
    } else {
      expect(raw.type).toBe('spell');
      expect(sha256(sourceDescription(raw))).toBe(candidate.descriptionSha256);
    }
  }
});

it('binds every retained Spell to its full prose, all structured metadata and independently unresolved attribution', async () => {
  const assessments = reviewedAdmission.assessments.filter((row) =>
    keys.includes(row.externalKey),
  );
  expect(assessments).toHaveLength(96);
  expect(new Set(assessments.map((row) => row.externalKey)).size).toBe(96);
  for (const candidate of spells) {
    const raw = upstreamRecord.parse(
      parse(
        await readFile(join(inputs.systemPath, candidate.source.path), 'utf8'),
      ),
    );
    expect(candidate.noticeRequirementsComplete).toBe(false);
    expect(candidate.holdIds.length).toBeGreaterThan(0);
    expect(candidate.mechanicsReview.descriptionReview).toBe(
      'complete-full-description-and-all-actions',
    );
    for (const [field, value] of Object.entries(
      candidate.mechanicsReview.metadata,
    ))
      expect(value, `${candidate.name}: ${field}`).toEqual(
        raw.system[field] ?? null,
      );
    const record = curation.records.find(
      (row) =>
        row.externalKey === candidate.externalKey && row.kind === 'description',
    );
    expect(record, candidate.name).toMatchObject({
      status: 'checked',
      textSha256: candidate.descriptionSha256,
      reviewedBy: 'Sol (AI curator) for the owner',
      reviewedOn: '2026-10-08',
    });
    expect(record?.outputs).toHaveLength(
      candidate.mechanicsReview.descriptionRecord.outputCount,
    );
    expect(record?.outputs.every((row) => row.kind === 'note')).toBe(true);
    const assessment = assessments.find(
      (row) => row.externalKey === candidate.externalKey,
    );
    expect(assessment).toMatchObject({
      status: 'unresolved',
      requiredNotices: candidate.requiredNotices,
      reviewedBy: 'Sol (AI curator) for the owner',
      reviewedOn: '2026-10-08',
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

it('replays the public importer with complete curation while recording running mechanics separately', async () => {
  const artifact = await importCatalog(inputs);
  expect(artifact.catalog.entries).toEqual(preview.entries);
  expect(artifact.comparison.summary).toMatchObject({
    upstreamRecords: 100,
    admitted: 96,
    excluded: 4,
    unassigned: 0,
  });
  expect(artifact.curation.passed).toBe(true);
  expect(artifact.curation.summary).toMatchObject({
    required: 0,
    missing: 0,
    descriptions: { candidates: 96, checked: 96, drafted: 0 },
  });
  expect(artifact.curation.unresolvedMechanics).toEqual([]);
  const outstanding = spells.filter(
    (row) => row.mechanicsReview.outstanding.length > 0,
  );
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
    expect(entry.modifiers).toEqual([]);
    const source = provenance.rawSources.find(
      (row) => row.externalKey === entry.externalKey,
    );
    if (!source) throw new Error('Missing raw source');
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
  expect(gate.passed).toBe(false);
  expect(gate.admitted).toEqual([]);
  // #738 keeps rules journal links as text: two roots fail no more.
  expect(gate.held).toHaveLength(63);
  expect(gate.failures).toHaveLength(33);
  expect(
    [
      ...new Set(
        [...gate.held, ...gate.failures, ...gate.dependentOmissions].map(
          (row) => row.externalKey,
        ),
      ),
    ].sort(),
  ).toEqual(spells.map((row) => row.externalKey).sort());
  for (const failure of gate.failures)
    expect(failure.reason).toMatch(/^Broken structure or reference:/);
});

it('replays all full-context legal bindings and invalidates an inherited Fire Shield change', async () => {
  const artifact = await importCatalog({
    ...inputs,
    // #721: a race's reviewed ability score trait comes with its race and is
    // not itself a candidate key.
    candidateKeys: bindingPreview.entries
      .map((row) => row.externalKey)
      .filter((key) => !key.startsWith('local/race-ability-scores/')),
  });
  const byExternalKey = (
    left: { externalKey: string },
    right: { externalKey: string },
  ) => left.externalKey.localeCompare(right.externalKey);
  expect([...artifact.catalog.entries].sort(byExternalKey)).toEqual(
    z
      .array(importedCatalogEntrySchema)
      .parse(bindingPreview.entries)
      .sort(byExternalKey),
  );
  expect(artifact.catalog.resources).toEqual(
    z.array(importedCatalogEntrySchema).parse(bindingPreview.resources),
  );
  expect(artifact.catalog.remaps).toEqual(
    z.array(appliedRemapSchema).parse(bindingPreview.remaps),
  );
  expect(bindingPreview.rootKeys).toEqual(spells.map((row) => row.externalKey));
  const gate = assessCatalogAdmission({ artifact, ...reviewedAdmission });
  expect(
    gate.held.filter((row) => keys.includes(row.externalKey)),
  ).toHaveLength(95);
  // #738 keeps Skim's, Revealing Light's, Waft's, Fey Blight's, Grasping
  // Vine's and Veil of Ash's rules journal links as text.
  expect(
    gate.failures
      .filter((row) => keys.includes(row.externalKey))
      .map(
        (row) =>
          artifact.catalog.entries.find(
            (entry) => entry.externalKey === row.externalKey,
          )?.name,
      )
      .sort(),
  ).toEqual(['Forced Mutation']);
  expect(gate.admitted.filter((row) => keys.includes(row.externalKey))).toEqual(
    [],
  );
  expect(
    [
      ...new Set(
        [...gate.held, ...gate.failures, ...gate.dependentOmissions].map(
          (row) => row.externalKey,
        ),
      ),
    ]
      .filter((key) => keys.includes(key))
      .sort(),
  ).toEqual(spells.map((row) => row.externalKey).sort());
  for (const key of bindingPreview.rootKeys) {
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
  const mist = changed.catalog.entries.find(
    (row) => row.name === 'Vitriolic Mist',
  );
  const shield = changed.catalog.entries.find(
    (row) => row.name === 'Fire Shield',
  );
  const assessment = reviewedAdmission.assessments.find(
    (row) => row.externalKey === mist?.externalKey,
  );
  if (!mist || !shield || !assessment)
    throw new Error('Missing inherited Fire Shield context');
  shield.description += ' Changed inherited protection.';
  expect(
    buildAssessmentBinding({
      entry: mist,
      artifact: changed,
      ...reviewedAdmission,
      requiredNotices: assessment.requiredNotices,
      evidenceIds: Object.keys(assessment.evidenceFingerprints),
    }).contentFingerprint,
  ).not.toBe(assessment.contentFingerprint);
});

it('enforces each individually recorded notice-chain hold', () => {
  for (const requirement of review.noticeRequirements) {
    if (!requirement.holdId) continue;
    const enforced = heldNotices.find((row) => row.id === requirement.holdId);
    expect(enforced, requirement.book).toBeDefined();
    expect(enforced?.notices).toEqual(
      expect.arrayContaining([requirement.book, ...requirement.registryKeys]),
    );
    expect(enforced?.evidence).toContain(
      'scripts/catalog/legal/spells-524.json',
    );
  }
});

it.each([
  ['Wooden Phalanx', 'PZO1112', 'advanced template'],
  ['Vitriolic Mist', 'PZO1110', 'fire shield'],
  ['Fey Boon', 'PZO1132', "kineticist's"],
] as const)(
  '%s includes the %s notice for its inherited rule',
  async (name, notice, wording) => {
    const candidate = spells.find((row) => row.name === name);
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
        (row) => row.externalKey === candidate.externalKey,
      )?.requiredNotices,
    ).toContain(notice);
  },
);

it.each([
  [
    'Transformation',
    'wizard',
    6,
    'PZO1110',
    '360-361',
    '+4 enhancement bonus to Strength, Dexterity, and Constitution',
  ],
  [
    'Gird Ally',
    'wizard',
    2,
    'PZO9458',
    '22',
    'maximum +4 deflection bonus at 18th level',
  ],
  ['Natural Rhythm', 'druid', 2, 'PZO1115', '233', 'maximum +5 bonus'],
  ['Wooden Wing Shield', 'magus', 5, 'PZO1140', '14', '+4 shield bonus to AC'],
] as const)(
  '%s preserves actual levels and numbers without granting its running Spell Effect',
  (name, classTag, level, book, pages, wording) => {
    const spell = spellFixture(name);
    expect(spell.detail.levels[classTag]).toBe(level);
    expect(spell.sources).toContainEqual({ book, pages });
    expect(spell.description).toContain(wording);
    expect(spell.modifiers).toEqual([]);
    expect(
      spells.find((row) => row.name === name)?.mechanicsReview.outstanding
        .length,
    ).toBeGreaterThan(0);
    const input = recordedSpellSheet(name, classTag);
    const baseline = calculateCharacterSheetProjections({
      ...input,
      entries: input.entries.filter((entry) => entry.kind !== 'spell'),
    });
    const projections = calculateCharacterSheetProjections(input);
    for (const key of ['current', 'permanent'] as const) {
      const projection = projections[key];
      expect(projection.abilities).toEqual(baseline[key].abilities);
      expect(projection.derivedStatistics).toEqual(
        baseline[key].derivedStatistics,
      );
      expect(projection.proficiencies).toEqual(baseline[key].proficiencies);
      expect(projection.spellEffects).toEqual([]);
      expect(
        projection.spellCollections.spellsWithoutSpellcasting,
      ).toContainEqual(
        expect.objectContaining({
          entryId: 'spell-row',
          catalogEntryId: spell.externalKey,
          ruleIdentity: spell.externalKey,
          name,
          school: spell.detail.school,
          description: spell.description,
          classEntryId: null,
          spellLevel: level,
          explicitLevel: level,
        }),
      );
    }
  },
);

it('invalidates checked Transformation prose on numeric drift', async () => {
  const work = resolve('.scratch/curation-524/tmp/test-work');
  await mkdir(work, { recursive: true });
  const root = await mkdtemp(join(work, 'changed-description-'));
  temporary.push(root);
  await cp(fixtureRoot, root, { recursive: true });
  const row = spells.find((row) => row.name === 'Transformation');
  if (!row) throw new Error('Missing Transformation');
  const path = join(root, 'pf1', row.source.path);
  const raw = await readFile(path, 'utf8');
  expect(raw).toContain('+4 enhancement');
  await writeFile(path, raw.replace('+4 enhancement', '+5 enhancement'));
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
      (record) => record.externalKey === row.externalKey,
    ),
  ).toBe(false);
  expect(
    assessCatalogAdmission({ artifact, ...reviewedAdmission }).admitted,
  ).toEqual([]);
});

it('keeps Fey Boon Norn bonuses and Leprechaun limited SLAs exact and readable without invented luck', () => {
  const spell = spellFixture('Fey Boon');
  expect(spell.description).toContain(
    '+2 insight bonus to AC and on saving throws',
  );
  expect(spell.description).toContain('This boon has a duration of 9 months.');
  expect(spell.description).toContain('spell-like abilities three times each');
  for (const name of [
    'Dancing Lights',
    'Disguise Self',
    'Ghost Sound',
    'Major Image',
    'Ventriloquism',
  ])
    expect(spell.description).toContain(name);
  expect(spell.description).toContain(
    'Their caster level is equal to your Hit Dice.',
  );
  expect(spell.description).toContain(
    'expended all the spell-like abilities or after 1 week, whichever is sooner',
  );
  const record = curation.records.find(
    (row) =>
      row.externalKey === spell.externalKey && row.kind === 'description',
  );
  const readable = [
    spell.description,
    ...(record?.outputs.flatMap((output) =>
      output.kind === 'note' ? [output.text] : [],
    ) ?? []),
  ].join(' ');
  expect(readable).not.toMatch(/\+2 luck|once per hour|hourly/i);
  expect(spell.modifiers).toEqual([]);
});

it.each([
  ['Black Spot', 'death', /-4 penalty on saving throws against death effects/],
  ['Fey Blight', 'spells', /-5 penalty on saving throws against spells/],
  [
    'Fey Boon',
    'forests',
    /\+10-foot bonus to your land speed while in forest terrain/,
  ],
] as const)(
  '%s reuses the shared %s Situation while retaining the narrower rule',
  (name, situation, wording) => {
    expect(curation.situations.some((row) => row.key === situation)).toBe(true);
    const notes = spellFixture(name).situationalNotes?.filter(
      (note) => note.situation === situation,
    );
    expect(notes?.length).toBeGreaterThan(0);
    expect(notes?.map((note) => note.text).join(' ')).toMatch(wording);
  },
);

it.each([
  [
    'Transformation',
    '4aa3e6c5ba639b3ceeab8a1003a72cfc96d73835be3bdc0dc528a33ad591e4a9',
  ],
  [
    'Gird Ally',
    '0dfe8be6336be9425e0d565626e1c117858bb5f45a37f5f2e8ea557457534260',
  ],
] as const)(
  '%s retains independently checked pinned source bytes',
  async (name, expected) => {
    const row = spells.find((candidate) => candidate.name === name);
    if (!row) throw new Error(`Missing ${name}`);
    expect(
      sha256(await readFile(join(inputs.systemPath, row.source.path), 'utf8')),
    ).toBe(expected);
  },
);

it('holds all ten literal record-level 3.5 tags under the owner policy', async () => {
  const tagged: string[] = [];
  for (const candidate of spells) {
    const raw = upstreamRecord.parse(
      parse(
        await readFile(join(inputs.systemPath, candidate.source.path), 'utf8'),
      ),
    );
    if (!Array.isArray(raw.system.tags) || !raw.system.tags.includes('3.5'))
      continue;
    tagged.push(candidate.name);
    expect(candidate.disposition).toBe('held');
    expect(candidate.missingEvidence).toMatch(/record-level 3\.5.*policy/i);
    expect(candidate.holdIds).toContain(
      `spells-524-record-3.5-policy-${raw._id}`,
    );
    expect(
      reviewedAdmission.assessments.find(
        (row) => row.externalKey === candidate.externalKey,
      )?.status,
    ).toBe('unresolved');
  }
  expect(tagged).toEqual([
    'Impede Speech',
    'Sign of the Dawnflower',
    'Traveling Dream',
    'Hardening',
    'Veil of Ash',
    'Admonishing Ray',
    'Water Shield',
    'Apparent Master',
    'Bolts of Bedevilment',
    'Enhanced Diplomacy',
  ]);
  expect(review.metadataImportGaps).toContainEqual(
    expect.objectContaining({
      field: 'system.tags record-level scope',
      candidateCount: 10,
      externalKeys: spells
        .filter((row) => tagged.includes(row.name))
        .map((row) => row.externalKey),
    }),
  );
});

it('retains the exact descriptor and action-note evidence for importer gaps', async () => {
  const descriptorNames: string[] = [];
  const actionNotes: { name: string; notes: string[] }[] = [];
  for (const candidate of spells) {
    const raw = upstreamRecord.parse(
      parse(
        await readFile(join(inputs.systemPath, candidate.source.path), 'utf8'),
      ),
    );
    const descriptors = z
      .array(z.string())
      .optional()
      .parse(raw.system.descriptors);
    if (descriptors?.length) {
      descriptorNames.push(candidate.name);
      // #738 imports them as published.
      expect(spellFixture(candidate.name).detail.descriptors).toEqual(
        descriptors,
      );
    }
    const actions = z
      .array(
        z.object({
          notes: z
            .object({
              effect: z.array(z.string()).optional(),
              footer: z.array(z.string()).optional(),
            })
            .optional(),
        }),
      )
      .parse(raw.system.actions ?? []);
    const notes = actions.flatMap((action) => [
      ...(action.notes?.effect ?? []),
      ...(action.notes?.footer ?? []),
    ]);
    if (notes.length) actionNotes.push({ name: candidate.name, notes });
  }
  expect(descriptorNames).toHaveLength(40);
  expect(actionNotes).toEqual([
    {
      name: 'Shackle',
      notes: [
        'Disable Device DC: [[15 + @cl + @ablMod]]',
        'Disable Device DC: [[15 + @cl + @ablMod]]',
      ],
    },
    {
      name: 'Bolts of Bedevilment',
      notes: [
        '<b>Save Fail Effect</b> @UUID[Compendium.pf1.pf1e-rules.NSqfXaj4MevUR2uJ.JournalEntryPage.2A6Gk60pLDKR2zT0]{Dazed} for [[1d3]] rounds',
      ],
    },
  ]);
});
