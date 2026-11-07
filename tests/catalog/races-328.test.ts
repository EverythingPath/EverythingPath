// @vitest-environment node
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import review from '../../scripts/catalog/legal/races-328.json';
import { reviewedCuration as curation } from '../../scripts/catalog/reviewed-curation-data';
import { importCatalog } from '../../scripts/catalog/import';
import {
  applyCuration,
  collectDescriptionInputs,
  parseCuration,
} from '../../scripts/catalog/curation';
import { mapEntry } from '../../scripts/catalog/map';
import { reviewedDescriptionCorrections } from '../../scripts/catalog/reviewed-description-corrections';
import type { LoadedRecord } from '../../scripts/catalog/records';
import {
  assessCatalogAdmission,
  buildAssessmentBinding,
} from '../../scripts/catalog/admission';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import { outputSchema } from '../../src/lib/catalog/curation-output-schema';
import {
  resolveAssessmentRationale,
  resolveDiagnosticConclusion,
} from '../../src/lib/catalog/diagnostic-conclusions';
import {
  abilityKeys,
  calculateCharacterSheet,
  calculateCharacterSheetProjections,
  resolveSheet,
  targetStage,
} from '../../src/lib/character-sheet';
import { satisfiesRacialPrerequisite } from '../../src/lib/character-sheet-racial';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import provenance from '../fixtures/races-328/provenance.json';
import preview from '../fixtures/races-328/preview.json';
import {
  heldRaceDefinition,
  heldRaceExamples,
  heldRaceSheet,
} from '../fixtures/races-328/sheet';
import admittedClosures from '../fixtures/races-328/admitted.json';
import s4bClosures from '../fixtures/races-328/s4b.json';
import {
  grantedTraitRow,
  raceSheet,
  sheetDefinition,
} from '../fixtures/racial-traits-719/sheet';

const fixtureRoot = resolve('tests/fixtures/races-328');
const inputs = {
  systemPath: join(fixtureRoot, 'pf1'),
  contentPath: join(fixtureRoot, 'pf1-content'),
  remaps: [],
  curation,
};
const temporary: string[] = [];
const sha256 = (text: string) =>
  createHash('sha256').update(text).digest('hex');

afterEach(async () => {
  await Promise.all(
    temporary
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

it('disposes of the exact 82 ticket identities without treating Foundry folders as races', () => {
  const keys = review.candidates.map((candidate) => candidate.externalKey);
  expect(keys).toHaveLength(82);
  expect(new Set(keys).size).toBe(82);
  // SHA-256 of the ordered exact-review-inventory keys in issue #328, joined by LF.
  expect(sha256(keys.join('\n'))).toBe(
    'c09ac54a7577fa58ecf82f0bf756840f7aa0eacc589c4fc7cf86d99aaf6fe43b',
  );
  expect(
    review.candidates
      .filter((candidate) => candidate.disposition === 'excluded')
      .map((candidate) => candidate.externalKey),
  ).toEqual(['pf1/CWHsfTdEmZohUkw1', 'pf1/RWSoA7Fj9yqo0y9U']);
  expect(
    review.candidates.filter((candidate) => candidate.disposition === 'held'),
  ).toHaveLength(73);
  // #328 S4-A confirms the core races Human, Dwarf and Half-Orc. Human is
  // dependently omitted while Languages (Human) stays held (fix round 1).
  // S4-B confirms Gnome and Halfling, dependently omitted on the records
  // their bodies link. Step B confirms Elf and Half-Elf once the reviewed
  // description corrections import PCGen's male base weight: the Half-Elf is
  // admitted and the Elf omitted on its six held weapons.
  expect(
    review.candidates
      .filter((candidate) => candidate.disposition === 'admitted')
      .map((candidate) => candidate.name)
      .sort(),
  ).toEqual(['Dwarf', 'Half-Elf', 'Half-Orc']);
  expect(
    review.candidates
      .filter((candidate) => candidate.disposition === 'dependently-omitted')
      .map((candidate) => candidate.name)
      .sort(),
  ).toEqual(['Elf', 'Gnome', 'Halfling', 'Human']);
  const assessments = reviewedAdmission.assessments.filter((assessment) =>
    keys.includes(assessment.externalKey),
  );
  expect(assessments).toHaveLength(80);
  expect(
    new Set(assessments.map((assessment) => assessment.externalKey)).size,
  ).toBe(80);
  for (const candidate of review.candidates.filter(
    (row) => row.disposition === 'held',
  )) {
    const assessment = assessments.find(
      (row) => row.externalKey === candidate.externalKey,
    );
    // #740 preserves the original review independently of the author-drafted
    // extraction reassessment; neither constitutes whole-body approval.
    const original =
      'assessmentHistory' in candidate
        ? candidate.assessmentHistory?.at(-1)
        : assessment;
    // No held race has a launch review: Step B confirmed the last two that
    // did (Elf and Half-Elf).
    expect('launchReview' in candidate).toBe(false);
    expect(original).toMatchObject({
      status: 'unresolved',
      reviewedBy: 'Astra (AI curator) for the owner',
      reviewedOn: '2026-10-07',
      requiredNotices: candidate.requiredNotices,
    });
    expect(assessment).toMatchObject({
      status: 'unresolved',
      requiredNotices: candidate.requiredNotices,
    });
    expect(candidate.noticeRequirementsComplete).toBe(false);
    expect(candidate.holdIds?.length).toBeGreaterThan(0);
    expect(candidate.evidenceId).toBeDefined();
    if (!candidate.evidenceId) throw new Error('Missing individual evidence');
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
  for (const candidate of review.candidates.filter(
    (row) =>
      row.disposition === 'admitted' ||
      row.disposition === 'dependently-omitted',
  )) {
    const assessment = assessments.find(
      (row) => row.externalKey === candidate.externalKey,
    );
    // The launch review confirms the whole body; the original review and its
    // holds stay in the history.
    expect(candidate.assessmentHistory?.at(-1)).toMatchObject({
      status: 'unresolved',
      reviewedBy: 'Astra (AI curator) for the owner',
      reviewedOn: '2026-10-07',
      requiredNotices: ['PZO1110'],
    });
    expect(candidate.requiredNotices).toEqual([
      'PZO1110',
      'PZO1121',
      'PZO9280',
    ]);
    expect(assessment).toMatchObject({
      status: 'confirmed',
      reviewedBy: 'Sol (AI curator) for the owner',
      reviewedOn: '2026-11-01',
      requiredNotices: candidate.requiredNotices,
      rationale: candidate.rationale,
    });
    expect(assessment).not.toHaveProperty('conclusionRef');
    expect(candidate.noticeRequirementsComplete).toBe(true);
    expect(candidate.holdIds).toEqual([]);
    if (!candidate.evidenceId) throw new Error('Missing individual evidence');
    expect(Object.keys(assessment?.evidenceFingerprints ?? {}).sort()).toEqual(
      [
        candidate.evidenceId,
        `race-740-extraction-${candidate.externalKey.slice(4)}`,
      ].sort(),
    );
    const content = reviewedAdmission.evidence[candidate.evidenceId]?.content;
    expect(content).toContain(candidate.source.sha256);
    expect(content).toContain(candidate.source.location);
    expect(content).toContain('ageHeightWeight.html');
    expect(content).toContain('_biosettings.lst');
  }
});

it('shares a Situation only across distinct races and keeps Strix light conditions separate from Syrinx night conditions', () => {
  const data = parseCuration(curation);
  for (const situation of data.situations) {
    const users = data.records.filter(
      (record) =>
        review.candidates.some(
          (candidate) => candidate.externalKey === record.externalKey,
        ) &&
        record.outputs.some((output) =>
          output.kind === 'itemAbility'
            ? output.damageDice?.some(
                (dice) => dice.situation === situation.key,
              )
            : output.condition?.situation === situation.key ||
              (output.kind === 'note' && output.situation === situation.key),
        ),
    );
    if (users.length === 0) continue;
    expect(
      new Set(users.map((record) => record.externalKey)).size,
      situation.key,
    ).toBeGreaterThanOrEqual(2);
  }
  const corrected = [
    { externalKey: 'pf1/MF8vCjLIGTmJl3Mo', local: 'in dim light or darkness' },
    { externalKey: 'pf1/ryBQiQNP6ZrkwZCy', local: 'at night' },
  ];
  expect(
    data.records
      .filter(
        (record) =>
          record.kind === 'note' &&
          corrected.some((race) => race.externalKey === record.externalKey) &&
          ['skill.per', 'skill.ste'].includes(record.target),
      )
      .map(({ externalKey, target, outputs }) => ({
        externalKey,
        target,
        outputs,
      })),
  ).toEqual(
    corrected.flatMap(({ externalKey, local }) =>
      ['skill.per', 'skill.ste'].map((target) => ({
        externalKey,
        target,
        outputs: [
          {
            kind: 'modifier',
            target,
            bonusType: 'racial',
            value: 2,
            condition: { situation: { local } },
          },
        ],
      })),
    ),
  );
});

it.each([
  { name: 'Changeling', key: 'pf1/9FBT6uqlRgaw9gug', armor: 1 },
  { name: 'Grindylow', key: 'pf1/Lt4ZP5GCinGvTfnF', armor: 2 },
  { name: 'Cecaelia', key: 'pf1/NhEPoXIZWOOunSH7', armor: 2 },
  { name: 'Nagaji', key: 'pf1/ZVzH0qb1Tqety6fU', armor: 1 },
  { name: 'Ghoran', key: 'pf1/2mWMyKiPWk6Y8cNx', armor: 2 },
])(
  'supplies $name natural armor from its bound prose without duplicating raw changes',
  ({ name, key, armor }) => {
    const data = parseCuration(curation);
    const record = data.records.find(
      (row) => row.externalKey === key && row.kind === 'description',
    );
    const candidate = review.candidates.find((row) => row.externalKey === key);
    if (!record || !candidate) throw new Error(`Missing reviewed race: ${key}`);
    expect(record).toMatchObject({
      status: 'checked',
      reviewedBy: 'Sol (AI curator) for the owner',
      reviewedOn: '2026-10-07',
      textSha256: candidate.descriptionSha256,
    });
    expect(sha256(record.text)).toBe(candidate.descriptionSha256);
    // Relevant raw changes from the pinned YAML paths in each inventory source:
    // Changeling/Cecaelia lines 22–25, Grindylow/Nagaji lines 26–29,
    // Ghoran lines 22–29. Other source facts are outside this focused seam.
    const id = key.slice(4);
    const source: LoadedRecord = {
      repo: 'pf1',
      pack: 'races',
      path: candidate.source.path,
      record: {
        _id: id,
        _key: `!items!${id}`,
        name,
        type: 'race',
        system: {
          description: { value: record.text },
          changes: [
            { target: 'nac', formula: String(armor), type: 'base' },
            ...(name === 'Ghoran'
              ? [{ target: 'skill.esc', formula: '-2', type: 'untyped' }]
              : []),
          ],
        },
      },
    };
    const entry = mapEntry({
      source,
      kind: 'race',
      resolveKey: (key) => key,
      lookup: new Map(),
      spellClassTags: new Set(),
    });
    expect(
      entry.modifiers.filter((row) => row.target === 'ac.natural'),
    ).toEqual([]);
    applyCuration({
      inputs: collectDescriptionInputs({
        source,
        externalKey: key,
        kind: 'race',
      }),
      seeds: [],
      data,
      entries: [entry],
    });
    const naturalArmor = {
      target: 'ac.natural',
      bonusType: 'naturalArmor',
      value: armor,
    };
    expect(
      entry.modifiers.filter((row) => row.target === 'ac.natural'),
    ).toEqual([naturalArmor]);
    expect(candidate.mechanicsReview?.mappedFacts?.modifiers).toContainEqual(
      naturalArmor,
    );
    expect(targetStage('ac.natural')).toBe(5);

    if (name === 'Ghoran') {
      const situation = {
        local:
          'to escape a grapple against a creature with a bite attack and grab',
      };
      // #720: the raw Escape Artist −2 is conditional in the source, so it is
      // reported and contributes nothing; the note states it.
      expect(
        entry.modifiers.filter((row) => row.target.startsWith('skill.')),
      ).toEqual([]);
      expect(entry.unsupported).toContainEqual(
        expect.objectContaining({
          field: 'changes',
          value: { target: 'skill.esc', formula: '-2', type: 'untyped' },
        }),
      );
      expect(entry.situationalNotes).toEqual([
        {
          target: 'skill.esc',
          situation,
          text: 'Delicious: Take a −2 penalty on Escape Artist checks to escape a grapple against a creature that has a bite attack with the grab ability.',
        },
      ]);
      expect(record.diagnostics).toContainEqual({
        kind: 'unresolved',
        text: expect.stringContaining(
          'conditional Escape Artist calculation remains unresolved',
        ),
      });
      const cmb = entry.modifiers
        .filter((row) => row.target === 'cmb')
        .map((row) => ({
          ...outputSchema.options[0]
            .omit({ kind: true })
            .extend({ target: z.literal('cmb') })
            .parse(row),
          sheetEntryId: key,
          entryName: name,
          source: key,
          builtIn: false,
        }));
      expect(cmb).toHaveLength(1);
      expect(targetStage('cmb')).toBe(5);
      expect(resolveSheet(cmb).cmb.total).toBe(0);
      expect(
        resolveSheet(cmb, {
          situations: [{ ...situation, sheetEntryId: key }],
        }).cmb.total,
      ).toBe(-2);
    }
  },
);

it('reproduces the held preview from byte-bound raw sources without inventing sources or racial HD', async () => {
  const artifact = await importCatalog(inputs);
  expect(artifact.catalog.entries).toEqual(preview.entries);
  for (const source of provenance.rawSources) {
    const text = await readFile(join(inputs.systemPath, source.path), 'utf8');
    expect(sha256(text)).toBe(source.sha256);
    expect(
      review.candidates.find((row) => row.externalKey === source.externalKey)
        ?.source,
    ).toMatchObject({
      path: source.path,
      sha256: source.sha256,
    });
    const raw = parse(text);
    const entry = artifact.catalog.entries.find(
      (row) => row.externalKey === source.externalKey,
    );
    expect(entry?.sources).toEqual(
      raw.system.sources.map((source: { id: string; pages: string }) => ({
        book: source.id,
        pages: source.pages,
      })),
    );
    expect(entry?.detail).toMatchObject({ kind: 'race', racialHitDice: 0 });
    expect(
      new Set(entry?.modifiers.map((modifier) => JSON.stringify(modifier)))
        .size,
    ).toBe(entry?.modifiers.length);
  }
});

it('keeps representative content unadmitted and binds its current extraction separately from missing attribution', async () => {
  const artifact = await importCatalog(inputs);
  const gate = assessCatalogAdmission({ artifact, ...reviewedAdmission });
  expect(gate.admitted).toEqual([]);
  expect(
    [
      ...new Set(
        [...gate.held, ...gate.failures].map((row) => row.externalKey),
      ),
    ].sort(),
  ).toEqual(artifact.catalog.entries.map((entry) => entry.externalKey).sort());
  // #738 keeps the Dwarf's rules journal links as text; the Halfling still
  // fails on a stripped catalog link.
  expect(gate.failures).toEqual([
    {
      externalKey: 'pf1/Hf31mrYb3uucNyLO',
      reason: 'Broken structure or reference: unresolved imported reference.',
    },
  ]);
  // #721: each race's reviewed ability score trait takes the race's
  // unresolved #328 assessment, so it is held with the race's rationale and
  // required notices.
  const abilityTraits = artifact.catalog.entries.filter((entry) =>
    entry.externalKey.startsWith('local/race-ability-scores/'),
  );
  const notices: Record<string, string[]> = {
    'pf1/Gy4jOckBEwMjByga': ['PZO9482'], // Gillman
    // Halfling: #328 S4-B adds the Advanced Race Guide and Inner Sea Races.
    'pf1/Hf31mrYb3uucNyLO': [
      'PZO1110',
      'PZO1121',
      'pcgen:PZO9280',
      'pf1-content/notice/2cf187d8ee06bcafe68c2b64c4c3898ecb7e84b9f201e9cd89308d21d632fec5',
    ],
    'pf1/ITHs6VCRdSQUsoen': ['PZO1112'], // Gnoll
    'pf1/LU6Rgor1wTS5cCRN': ['PZO1121'], // Lizardfolk
    'pf1/gZxiUYLYsGqQYwGZ': ['PZO1121'], // Ogre
    // Dwarf: #328 S4-A adds the Advanced Race Guide and Inner Sea Races.
    'pf1/nEltI9y37rKJTeWo': [
      'PZO1110',
      'PZO1121',
      'pcgen:PZO9280',
      'pf1-content/notice/2cf187d8ee06bcafe68c2b64c4c3898ecb7e84b9f201e9cd89308d21d632fec5',
    ],
  };
  expect(abilityTraits.map((entry) => entry.upstreamKey).sort()).toEqual(
    Object.keys(notices).sort(),
  );
  for (const entry of abilityTraits) {
    const assessment = reviewedAdmission.assessments.find(
      (row) => row.externalKey === entry.upstreamKey,
    );
    if (!assessment) throw new Error('Missing owning race assessment');
    expect(
      gate.held.find((row) => row.externalKey === entry.externalKey),
    ).toMatchObject({
      // The Dwarf's (S4-A) and Halfling's (S4-B) confirmed #328
      // assessments bind their full-corpus closures; this fixture lacks
      // their racial traits, so the binding is stale here and the trait is
      // held for re-review, never admitted.
      reason:
        assessment.status === 'confirmed'
          ? 'Accepted assessment no longer matches current content — re-review required.'
          : resolveAssessmentRationale({
              assessment,
              evidence: reviewedAdmission.evidence,
            }),
      requiredNotices: notices[entry.upstreamKey],
    });
  }
  for (const entry of artifact.catalog.entries) {
    if (abilityTraits.includes(entry)) continue;
    const assessment = reviewedAdmission.assessments.find(
      (row) => row.externalKey === entry.externalKey,
    );
    if (!assessment)
      throw new Error(`Missing assessment for ${entry.externalKey}`);
    const binding = buildAssessmentBinding({
      entry,
      artifact,
      ...reviewedAdmission,
      requiredNotices: assessment.requiredNotices,
      evidenceIds: Object.keys(assessment.evidenceFingerprints),
    });
    const candidate = review.candidates.find(
      (row) => row.externalKey === entry.externalKey,
    );
    if (candidate?.linkedKeys?.length) {
      // Halfling's source links a weapon outside this small fixture. A subset
      // of that content closure cannot stand in for the full source binding.
      expect(binding.contentFingerprint).not.toBe(
        assessment.contentFingerprint,
      );
      expect(
        candidate.linkedKeys.some(
          (key) =>
            !artifact.catalog.entries.some((row) => row.externalKey === key),
        ),
      ).toBe(true);
    } else {
      // #719 adds the race's Racial Trait Grants to its definition, so every
      // #328 content binding is stale until the held race is re-assessed.
      // The identity mapping, evidence and notice bindings still match.
      const { contentFingerprint, ...unchanged } = binding;
      expect(contentFingerprint).not.toBe(assessment.contentFingerprint);
      expect(assessment).toMatchObject(unchanged);
    }
    const changed = {
      ...entry,
      description: `${entry.description}<p>Changed fixture content.</p>`,
    };
    expect(
      buildAssessmentBinding({
        entry: changed,
        artifact: {
          ...artifact,
          catalog: {
            ...artifact.catalog,
            entries: artifact.catalog.entries.map((row) =>
              row.externalKey === entry.externalKey ? changed : row,
            ),
          },
        },
        ...reviewedAdmission,
        requiredNotices: assessment.requiredNotices,
        evidenceIds: Object.keys(assessment.evidenceFingerprints),
      }).contentFingerprint,
    ).not.toBe(assessment.contentFingerprint);
  }
});

it.each(heldRaceExamples)(
  'resolves $name extracted abilities once in current and permanent isolated sheets',
  ({ key, scores }) => {
    const entry = preview.entries.find((row) => row.externalKey === key);
    expect(heldRaceDefinition(key).modifiers).toEqual(entry?.modifiers);
    const result = calculateCharacterSheetProjections(heldRaceSheet(key));
    for (const projection of [result.current, result.permanent]) {
      expect(
        abilityKeys.map((ability) => projection.abilities[ability].score),
      ).toEqual(scores);
      expect(projection).toMatchObject({
        level: 0,
        racialHitDice: 0,
        hitDice: 0,
      });
      expect(
        projection.resolvedEntries.filter(
          (row) => row.entry.kind === 'race' && row.counting,
        ),
      ).toHaveLength(1);
    }
  },
);

function savingThrowModifiers(name: string) {
  const entry = preview.entries.find((entry) => entry.name === name);
  if (!entry) throw new Error(`Missing held race: ${name}`);
  return entry.modifiers
    .filter((modifier) => modifier.target === 'saves')
    .map((raw) => ({
      ...outputSchema.options[0]
        .omit({ kind: true })
        .extend({ target: z.literal('saves') })
        .parse(raw),
      sheetEntryId: entry.externalKey,
      entryName: entry.name,
      source: entry.externalKey,
      builtIn: false,
    }));
}

it('applies the reviewed Gillman enchantment bonus and aboleth penalty only in their own situations', () => {
  const modifiers = savingThrowModifiers('Gillman');
  expect(resolveSheet(modifiers)['save.will'].total).toBe(0);
  for (const [local, total] of [
    ['vs. enchantment spells and effects from non-aboleth sources', 2],
    ['vs. enchantment spells and effects from aboleth sources', -2],
  ] as const) {
    const result = resolveSheet(modifiers, {
      situations: [{ local, sheetEntryId: 'pf1/Gy4jOckBEwMjByga' }],
    });
    expect(
      (['save.fort', 'save.ref', 'save.will'] as const).map(
        (target) => result[target].total,
      ),
    ).toEqual([total, total, total]);
  }
});

it('stacks Halfling Fearless with Halfling Luck, but counts overlapping Dwarf Hardy situations once', () => {
  const halfling = savingThrowModifiers('Halfling');
  expect(resolveSheet(halfling)['save.will'].total).toBe(1);
  expect(
    resolveSheet(halfling, { situations: ['fear'] })['save.will'].total,
  ).toBe(3);
  const dwarf = savingThrowModifiers('Dwarf');
  expect(resolveSheet(dwarf)['save.will'].total).toBe(0);
  expect(
    resolveSheet(dwarf, { situations: ['poison', 'spells', 'spellLike'] })[
      'save.will'
    ].total,
  ).toBe(2);
});

it('invalidates the reviewed Dwarf note when its exact source changes, even while attribution stays held', async () => {
  const work = resolve('.scratch/curation-328/test-work');
  await mkdir(work, { recursive: true });
  const root = await mkdtemp(join(work, 'changed-note-'));
  temporary.push(root);
  await cp(fixtureRoot, root, { recursive: true });
  const path = join(root, 'pf1/packs/races/dwarf.nEltI9y37rKJTeWo.yaml');
  const raw = await readFile(path, 'utf8');
  expect(raw).toContain('+[[4]] Dodge vs Giants');
  await writeFile(
    path,
    raw.replace('+[[4]] Dodge vs Giants', '+[[5]] Dodge vs Giants'),
  );
  const artifact = await importCatalog({
    ...inputs,
    systemPath: join(root, 'pf1'),
    contentPath: join(root, 'pf1-content'),
  });
  expect(artifact.curation.passed).toBe(false);
  expect(artifact.curation.missing).toContainEqual(
    expect.objectContaining({
      externalKey: 'pf1/nEltI9y37rKJTeWo',
      kind: 'note',
      target: 'ac',
      text: '+[[5]] Dodge vs Giants',
    }),
  );
  expect(artifact.curation.stale).toContainEqual(
    expect.objectContaining({
      externalKey: 'pf1/nEltI9y37rKJTeWo',
      kind: 'note',
      target: 'ac',
    }),
  );
  const gate = assessCatalogAdmission({ artifact, ...reviewedAdmission });
  expect(gate.admitted).toEqual([]);
  expect(gate.failures).toContainEqual(
    expect.objectContaining({
      externalKey: 'pf1/nEltI9y37rKJTeWo',
      reason: expect.stringContaining('Missing curation record'),
    }),
  );
});

it('reassesses the core races and targeted source corrections as drafts while keeping the complete original inventory and review history', () => {
  const reassessed = review.candidates.filter(
    (candidate) => 'reassessment' in candidate,
  );
  expect(reassessed.map((candidate) => candidate.name).sort()).toEqual([
    'Aasimar',
    'Dwarf',
    'Elf',
    'Gnome',
    'Half-Elf',
    'Half-Orc',
    'Halfling',
    'Human',
    'Svirfneblin',
    'Tiefling',
  ]);
  for (const candidate of reassessed) {
    if (
      !('reassessment' in candidate) ||
      !candidate.reassessment ||
      !('currentBinding' in candidate)
    )
      throw new Error('Missing draft reassessment');
    const current = reviewedAdmission.assessments.find(
      (row) => row.externalKey === candidate.externalKey,
    );
    expect(candidate.reassessment).toMatchObject({
      issue: 740,
      status: 'drafted',
      sourceSha256: candidate.source.sha256,
    });
    expect(candidate.reassessment.closureDefinitions).toBeGreaterThan(1);
    expect(current).toMatchObject(candidate.currentBinding);
    // #328 S4-A confirms Human, Dwarf and Half-Orc with the drafted
    // reassessment as input; the others stay unresolved drafts.
    expect(current?.status).toBe(
      candidate.disposition === 'held' ? 'unresolved' : 'confirmed',
    );
    expect(current?.rationale).toContain(candidate.rationale);
    const original = candidate.assessmentHistory?.at(-1);
    expect(original?.reviewedBy).toBe('Astra (AI curator) for the owner');
    expect(original?.evidenceFingerprints).toHaveProperty(candidate.evidenceId);
    expect(current?.evidenceFingerprints).toHaveProperty(
      candidate.reassessment.evidenceId,
    );
    for (const proposal of candidate.reassessment.diagnosticProposals)
      expect(proposal.status).toBe('drafted');
  }
  const tiefling = reassessed.find((row) => row.name === 'Tiefling');
  const aasimar = reassessed.find((row) => row.name === 'Aasimar');
  if (
    !tiefling?.reassessment?.conclusionRef ||
    !aasimar?.reassessment?.conclusionRef
  )
    throw new Error('Missing diagnostic reference');
  expect(
    resolveDiagnosticConclusion({
      reference: tiefling.reassessment.conclusionRef,
      evidence: reviewedAdmission.evidence,
    }).join(' '),
  ).toContain(
    'conditional calculation is not implemented: concrete launch hold',
  );
  expect(
    resolveDiagnosticConclusion({
      reference: aasimar.reassessment.conclusionRef,
      evidence: reviewedAdmission.evidence,
    }).join(' '),
  ).toContain('native ability prose is truncated');
});

// #328 S4-A: Human, Dwarf and Half-Orc with their standard Racial Trait
// Grants and the Dwarf's ability score trait. admitted.json holds the three
// races' full-corpus content closures (25 entries) and their import
// inventory records, from the curated full-corpus preview.
const human = 'pf1/e6IaBxKgMxy1yKlr';
const dwarf = 'pf1/nEltI9y37rKJTeWo';
const halfOrc = 'pf1/dCAXgdA6Db1Z3ccz';
const admittedEntries = admittedClosures.entries.map((row) =>
  importedCatalogEntrySchema.parse(row),
);
const admittedEntry = (key: string) => {
  const found = admittedEntries.find((row) => row.externalKey === key);
  if (!found) throw new Error(`Missing admitted entry ${key}`);
  return found;
};

it('admits Dwarf and Half-Orc, omits Human while Languages (Human) is held, and grants every standard trait the Advanced Race Guide lists, counting the Dwarf race notes once', () => {
  const artifact = {
    catalog: { entries: admittedEntries },
    comparison: { records: admittedClosures.comparisonRecords, packs: [] },
  } as unknown as Parameters<typeof assessCatalogAdmission>[0]['artifact'];
  const gate = assessCatalogAdmission({ artifact, ...reviewedAdmission });
  expect(gate.failures).toEqual([]);
  // Fix round 1: Languages (Human) stays held on its ethnic-language
  // sentences, so Human is dependently omitted; the other 23 are admitted.
  const languages = 'pf1-content/eNIYJNbM6UL7OdyE';
  expect(gate.held.map((row) => row.externalKey)).toEqual([languages]);
  expect(gate.held[0]?.reason).toContain('and their ethnic language');
  expect(
    gate.dependentOmissions.map(({ externalKey, reason }) => ({
      externalKey,
      reason,
    })),
  ).toEqual([
    { externalKey: human, reason: `Dependent omission: ${languages}.` },
  ]);
  expect(gate.admitted.map((row) => row.externalKey).sort()).toEqual(
    admittedEntries
      .map((row) => row.externalKey)
      .filter((key) => key !== human && key !== languages)
      .sort(),
  );
  expect(gate.admitted).toHaveLength(23);
  // The Grants are the ARG trait lists (advancedRaceGuide/coreRaces/
  // humans.html:359-364, dwarves.html:360-371, halfOrcs.html:367-375) less
  // size and speed, which the race itself carries.
  const grants = (race: string) =>
    (admittedEntry(race).detail.kind === 'race'
      ? ((admittedEntry(race).detail as { racialTraits?: string[] })
          .racialTraits ?? [])
      : []
    )
      .map((key) => admittedEntry(key).name)
      .sort();
  expect(grants(human)).toEqual([
    '+2 to One Ability Score (Human)',
    'Bonus Feat (Human)',
    'Languages (Human)',
    'Skilled (Human)',
  ]);
  expect(grants(dwarf)).toEqual([
    'Ability Score Modifiers (Dwarf)',
    'Darkvision (Dwarf)',
    'Defensive Training (Dwarf)',
    'Greed (Dwarf)',
    'Hardy',
    'Hatred (Dwarf)',
    'Languages (Dwarf)',
    'Slow and Steady (Dwarf)',
    'Stability (Dwarf)',
    'Stonecunning (Dwarf)',
    'Weapon Familiarity (Dwarf)',
  ]);
  expect(grants(halfOrc)).toEqual([
    '+2 to One Ability Score (Half-Orc)',
    'Darkvision (Half-Orc)',
    'Intimidating',
    'Languages (Half-Orc)',
    'Orc Blood',
    'Orc Ferocity',
    'Weapon Familiarity (Half-Orc)',
  ]);
  for (const race of [human, dwarf, halfOrc]) {
    expect(admittedEntry(race).detail).toMatchObject({
      kind: 'race',
      size: 'medium',
      racialHitDice: 0,
    });
    // Each race's confirmed assessment binds exactly this closure.
    const candidate = review.candidates.find((row) => row.externalKey === race);
    if (!candidate || !('currentBinding' in candidate))
      throw new Error('Missing admitted race');
    const assessment = reviewedAdmission.assessments.find(
      (row) => row.externalKey === race,
    );
    if (!assessment) throw new Error('Missing race assessment');
    expect(
      buildAssessmentBinding({
        artifact,
        // The committed row is the full-corpus preview's own output.
        entry: admittedEntry(race) as never,
        ...reviewedAdmission,
        requiredNotices: assessment.requiredNotices,
        evidenceIds: Object.keys(assessment.evidenceFingerprints),
      }),
    ).toEqual({
      contentFingerprint: assessment.contentFingerprint,
      mappingFingerprint: assessment.mappingFingerprint,
      evidenceFingerprints: assessment.evidenceFingerprints,
      noticeFingerprints: assessment.noticeFingerprints,
    });
    expect(candidate.currentBinding?.contentFingerprint).toBe(
      assessment.contentFingerprint,
    );
  }
  // The Dwarf race carries no Modifier: its checked note records are
  // re-homed onto the traits (dodge vs giants, saves vs poison and spells,
  // attack vs orc and goblinoid humanoids, CMD, Appraise), so each bonus is
  // counted once, on its trait.
  expect(admittedEntry(dwarf).modifiers).toEqual([]);
  const targets = admittedEntries
    .filter((row) => row.externalKey !== dwarf)
    .flatMap((row) =>
      (
        admittedEntry(dwarf).detail as { racialTraits?: string[] }
      ).racialTraits?.includes(row.externalKey)
        ? row.modifiers.map((modifier) => JSON.stringify(modifier))
        : [],
    );
  expect(new Set(targets).size).toBe(targets.length);
});

it('resolves the admitted Human, Dwarf and Half-Orc on isolated sheets', () => {
  const definitions = admittedEntries.map((row) => sheetDefinition(row));
  const sheet = (race: string, choice?: string, trait?: string) =>
    calculateCharacterSheet(
      raceSheet({
        race,
        definitions,
        entries:
          choice && trait ? [grantedTraitRow({ race, trait, choice })] : [],
      }),
    );
  const scores = (result: ReturnType<typeof calculateCharacterSheet>) =>
    abilityKeys.map((ability) => result.abilities[ability].score);
  // Dwarf: +2 Con, +2 Wis, -2 Cha through its ability score trait.
  const dwarfSheet = sheet(dwarf);
  expect(scores(dwarfSheet)).toEqual([10, 10, 12, 10, 12, 8]);
  expect(
    dwarfSheet.racial.proficiencies
      .map((grant) => ('baseType' in grant ? grant.baseType : ''))
      .sort(),
  ).toEqual(['Battle Axe', 'Heavy Pick', 'Warhammer']);
  // Human and Half-Orc: the +2 is the player's choice, from the trait.
  for (const [race, trait] of [
    [human, 'pf1-content/BFszTUJLlDS1ZDB8'],
    [halfOrc, 'pf1-content/VHmuEYXmx81Q5EmC'],
  ] as const) {
    expect(scores(sheet(race))).toEqual([10, 10, 10, 10, 10, 10]);
    expect(scores(sheet(race, 'charisma', trait))).toEqual([
      10, 10, 10, 10, 10, 12,
    ]);
  }
  // Human: one bonus feat slot at 1st level and one extra rank per level.
  const humanSheet = sheet(human);
  expect(
    humanSheet.selectionRules.slots.filter((slot) =>
      slot.id.includes('pf1-content/uAJ9hLZYdH2JX7J8'),
    ),
  ).toMatchObject([{ kind: 'feat', count: 1 }]);
  expect(humanSheet.racial.bonusSkillRanksPerLevel).toBe(1);
  // Half-Orc: counts as human and orc (Orc Blood); greataxe and falchion.
  const halfOrcSheet = sheet(halfOrc);
  expect(halfOrcSheet.racial.countsAsRaces).toEqual(
    [halfOrc, human, 'pf1/JOuAdPAOTat7d5v6'].sort(),
  );
  expect(
    satisfiesRacialPrerequisite(halfOrcSheet.racial, { race: [human] }),
  ).toBe(true);
  expect(
    halfOrcSheet.racial.proficiencies
      .map((grant) => ('baseType' in grant ? grant.baseType : ''))
      .sort(),
  ).toEqual(['Falchion', 'Greataxe']);
  expect(
    halfOrcSheet.breakdowns['skill.int'].total -
      sheet(human).breakdowns['skill.int'].total,
  ).toBe(2);
});

// #328 S4-B: Half-Elf, Elf, Gnome and Halfling. s4b.json holds the four
// races' full-corpus content closures (their traits, local ability score
// traits and the records their bodies link) and their import records, from
// the curated full-corpus preview. Step B refreshed the Elf and Half-Elf
// entries, whose descriptions carry the reviewed male weight corrections.
const halfElf = 'pf1/cCepRrfH5SalFfT4';
const elf = 'pf1/NgIhxRI0axrf3fcO';
const gnome = 'pf1/efwHEwjvL9Z94MJI';
const halfling = 'pf1/Hf31mrYb3uucNyLO';
const s4bEntries = s4bClosures.entries.map((row) =>
  importedCatalogEntrySchema.parse(row),
);
const s4bEntry = (key: string) => {
  const found = s4bEntries.find((row) => row.externalKey === key);
  if (!found) throw new Error(`Missing S4-B entry ${key}`);
  return found;
};
const s4bGrants = (race: string) =>
  ((s4bEntry(race).detail as { racialTraits?: string[] }).racialTraits ?? [])
    .map((key) => s4bEntry(key).name)
    .sort();
const cantrips = [
  'pf1/a6isom7wx0nmhwfp',
  'pf1/ct9fhh8uawn8e4md',
  'pf1/mtxqp85izkb20djq',
  'pf1/zymaptg3vmnvfvxl',
];
const sling = 'pf1/cJV7OBm9KiF2WWiu';
const elfWeapons = [
  'pf1/Ata6ajiY9wuAnBLB',
  'pf1/GGS4thGbUH5eKndT',
  'pf1/LA6TC5679iOXDNwq',
  'pf1/PqJih70EG2A1XNGf',
  'pf1/msTiRxZVnecbPCA8',
  'pf1/zWRlna42PMJVX6un',
];

it('admits the Half-Elf and the 30 standard traits, and omits Elf, Gnome and Halfling on the records their bodies link', () => {
  const artifact = {
    catalog: { entries: s4bEntries },
    comparison: { records: s4bClosures.comparisonRecords, packs: [] },
  } as unknown as Parameters<typeof assessCatalogAdmission>[0]['artifact'];
  const gate = assessCatalogAdmission({ artifact, ...reviewedAdmission });
  expect(gate.failures).toEqual([]);
  const elfAbilities = `local/race-ability-scores/${elf}`;
  expect(gate.held.map((row) => row.externalKey).sort()).toEqual(
    [sling, ...cantrips, ...elfWeapons].sort(),
  );
  // Step B: the imported male rows carry PCGen's base weight.
  expect(s4bEntry(elf).description).toContain(
    '<td>100 lbs.</td><td><p>+(2d8×3 lbs.)<br>(106 – 148 lbs.)</p></td>',
  );
  expect(s4bEntry(halfElf).description).toContain(
    '<td>110 lbs.</td><td><p>+(2d8×5 lbs.)<br>(120 – 190 lbs.)</p></td>',
  );
  const omitted = Object.fromEntries(
    gate.dependentOmissions.map(({ externalKey, reason }) => [
      externalKey,
      reason,
    ]),
  );
  const cantripReason = `Dependent omission: ${cantrips.join(', ')}.`;
  expect(omitted).toEqual({
    [elf]: `Dependent omission: ${elfWeapons.join(', ')}.`,
    [elfAbilities]: `Dependent omission: ${elf}.`,
    [gnome]: cantripReason,
    'pf1-content/MiPbhGqPRX7H4C7a': cantripReason,
    [`local/race-ability-scores/${gnome}`]: `Dependent omission: ${gnome}.`,
    [halfling]: `Dependent omission: ${sling}.`,
    [`local/race-ability-scores/${halfling}`]: `Dependent omission: ${halfling}.`,
  });
  const traits = [halfElf, elf, gnome, halfling].flatMap(
    (race) =>
      (s4bEntry(race).detail as { racialTraits?: string[] }).racialTraits ?? [],
  );
  expect(gate.admitted.map((row) => row.externalKey).sort()).toEqual(
    [
      ...traits.filter(
        (key) =>
          !key.startsWith('local/') && key !== 'pf1-content/MiPbhGqPRX7H4C7a',
      ),
      'pf1/7zJTztNW7hdaqjKc',
      halfElf,
    ].sort(),
  );
  expect(gate.admitted).toHaveLength(32);
  // The Grants are the ARG trait lists less size and speed, which the race
  // itself carries.
  expect(s4bGrants(halfElf)).toEqual([
    '+2 to One Ability Score (Half-Elf)',
    'Adaptability',
    'Elf Blood',
    'Elven Immunities (Half-Elf)',
    'Keen Senses (Half-Elf)',
    'Languages (Half-Elf)',
    'Low-Light Vision (Half-Elf)',
    'Multitalented',
  ]);
  expect(s4bGrants(elf)).toEqual([
    'Ability Score Modifiers (Elf)',
    'Elven Immunities (Elf)',
    'Elven Magic (Elf)',
    'Keen Senses (Elf)',
    'Languages (Elf)',
    'Low-Light Vision (Elf)',
    'Weapon Familiarity (Elf)',
  ]);
  expect(s4bGrants(gnome)).toEqual([
    'Ability Score Modifiers (Gnome)',
    'Defensive Training (Gnome)',
    'Gnome Magic (Gnome)',
    'Hatred (Gnome)',
    'Illusion Resistance',
    'Keen Senses (Gnome)',
    'Languages (Gnome)',
    'Low-Light Vision (Gnome)',
    'Obsessive',
    'Slow Speed (Gnome)',
    'Weapon Familiarity (Gnome)',
  ]);
  expect(s4bGrants(halfling)).toEqual([
    'Ability Score Modifiers (Halfling)',
    'Fearless (Halfling)',
    'Halfling Luck',
    'Keen Senses (Halfling)',
    'Languages (Halfling)',
    'Slow Speed (Halfling)',
    'Sure-Footed',
    'Weapon Familiarity (Halfling)',
  ]);
  for (const race of [halfElf, elf, gnome, halfling]) {
    expect(s4bEntry(race).detail).toMatchObject({
      kind: 'race',
      size: race === gnome || race === halfling ? 'small' : 'medium',
      racialHitDice: 0,
    });
    // The race carries no Modifier: its checked note records are re-homed
    // onto its traits, so each bonus counts once, on its trait.
    expect(s4bEntry(race).modifiers).toEqual([]);
    const candidate = review.candidates.find((row) => row.externalKey === race);
    const assessment = reviewedAdmission.assessments.find(
      (row) => row.externalKey === race,
    );
    if (!candidate || !('currentBinding' in candidate) || !assessment)
      throw new Error('Missing S4-B race');
    expect(
      buildAssessmentBinding({
        artifact,
        entry: s4bEntry(race) as never,
        ...reviewedAdmission,
        requiredNotices: assessment.requiredNotices,
        evidenceIds: Object.keys(assessment.evidenceFingerprints),
      }),
    ).toEqual({
      contentFingerprint: assessment.contentFingerprint,
      mappingFingerprint: assessment.mappingFingerprint,
      evidenceFingerprints: assessment.evidenceFingerprints,
      noticeFingerprints: assessment.noticeFingerprints,
    });
    expect(candidate.currentBinding?.contentFingerprint).toBe(
      assessment.contentFingerprint,
    );
    expect(assessment.requiredNotices).toEqual([
      'PZO1110',
      'PZO1121',
      'PZO9280',
    ]);
    // Confirmed races drop their #740 conclusion.
    expect(assessment.status).toBe('confirmed');
    expect(assessment).not.toHaveProperty('conclusionRef');
    const modifiers = (
      (s4bEntry(race).detail as { racialTraits?: string[] }).racialTraits ?? []
    ).flatMap((key) =>
      s4bEntry(key).modifiers.map((modifier) =>
        JSON.stringify({ key, modifier }),
      ),
    );
    expect(new Set(modifiers).size).toBe(modifiers.length);
  }
});

it('records each S4-B race body comparison: ages from the supplement, height and weight from PCGen, and the 28 derived ranges', () => {
  const ranges: string[] = [];
  for (const race of [halfElf, elf, gnome, halfling]) {
    const candidate = review.candidates.find((row) => row.externalKey === race);
    if (!candidate || !('launchReview' in candidate) || !candidate.launchReview)
      throw new Error('Missing S4-B launch review');
    const body = (
      candidate.launchReview as unknown as {
        body: {
          startingAge: { supplement: { role: string } };
          heightAndWeight: {
            cells: {
              cell: string;
              foundry: string;
              pcgen: string;
              matches: boolean;
              imported?: string;
            }[];
          };
          derivedRanges: {
            values: {
              range: string;
              matchesBody: boolean;
              imported?: { range: string; baseWeightUsed: number };
            }[];
          };
        };
      }
    ).body;
    const { correction } = candidate.launchReview as unknown as {
      correction?: {
        table: string;
        descriptionSha256: string;
        rows: { from: string; to: string }[];
        importedRow: string;
        supersedesHold: { id: string };
      };
    };
    expect(body.startingAge.supplement.role).toBe('ageTables');
    expect(body.derivedRanges.values).toHaveLength(7);
    for (const value of body.derivedRanges.values) {
      expect(value.matchesBody).toBe(true);
      ranges.push(value.range);
    }
    expect(
      body.heightAndWeight.cells
        .filter((cell) => !cell.matches)
        .map(({ cell, foundry, pcgen }) => [cell, foundry, pcgen]),
    ).toEqual(
      race === elf
        ? [['Male base weight', '110 lbs.', '100 lbs.']]
        : race === halfElf
          ? [['Male base weight', '100 lbs.', '110 lbs.']]
          : [],
    );
    // Step B: the reviewed corrections import PCGen's value for the one
    // conflicting cell and the male weight range recomputed from it.
    expect(
      body.heightAndWeight.cells
        .filter((cell) => !cell.matches)
        .every((cell) => cell.imported === cell.pcgen),
    ).toBe(true);
    const imported = body.derivedRanges.values.flatMap((value) =>
      value.imported ? [[value.range, value.imported.range]] : [],
    );
    expect(imported).toEqual(
      race === elf
        ? [['(116 – 158 lbs.)', '(106 – 148 lbs.)']]
        : race === halfElf
          ? [['(110 – 180 lbs.)', '(120 – 190 lbs.)']]
          : [],
    );
    if (race === elf || race === halfElf) {
      expect(correction).toMatchObject({
        table: 'scripts/catalog/reviewed-description-corrections.ts',
        descriptionSha256: candidate.descriptionSha256,
        supersedesHold: { id: `race-328-whole-content-${race.slice(4)}` },
      });
      expect(correction?.rows).toEqual(
        reviewedDescriptionCorrections
          .filter((row) => row.externalKey === race)
          .map(({ from, to }) => ({ from, to })),
      );
    } else expect(correction).toBeUndefined();
    expect(candidate.disposition).toBe(
      race === halfElf ? 'admitted' : 'dependently-omitted',
    );
  }
  expect(ranges).toHaveLength(28);
  // 12 age and 16 height and weight ranges, each Foundry's arithmetic from
  // its own base values, including the two male weight rows Step B corrects.
  expect(ranges).toContain('(116 – 158 lbs.)');
  expect(ranges).toContain('(110 – 180 lbs.)');
});

it('resolves the S4-B races and their traits on isolated sheets', () => {
  // The sheet adapters cover races and racial traits; the linked weapons,
  // spells and feat stay out of these isolated sheets.
  const definitions = s4bEntries
    .filter((row) => ['race', 'racialTrait'].includes(row.detail.kind))
    .map((row) => sheetDefinition(row));
  const sheet = (race: string, choice?: string, trait?: string) =>
    calculateCharacterSheet(
      raceSheet({
        race,
        definitions,
        entries:
          choice && trait ? [grantedTraitRow({ race, trait, choice })] : [],
      }),
    );
  const scores = (result: ReturnType<typeof calculateCharacterSheet>) =>
    abilityKeys.map((ability) => result.abilities[ability].score);
  // Str, Dex, Con, Int, Wis, Cha.
  expect(scores(sheet(elf))).toEqual([10, 12, 8, 12, 10, 10]);
  expect(scores(sheet(gnome))).toEqual([8, 10, 12, 10, 10, 12]);
  expect(scores(sheet(halfling))).toEqual([8, 12, 10, 10, 10, 12]);
  expect(scores(sheet(halfElf))).toEqual([10, 10, 10, 10, 10, 10]);
  expect(
    scores(sheet(halfElf, 'charisma', 'pf1-content/orOAYDkNl4pqYWA4')),
  ).toEqual([10, 10, 10, 10, 10, 12]);
  // Half-Elf: Elf Blood, Multitalented and Adaptability's Skill Focus slot.
  const halfElfSheet = sheet(halfElf);
  expect(halfElfSheet.racial.countsAsRaces).toEqual(
    [halfElf, elf, 'pf1/e6IaBxKgMxy1yKlr'].sort(),
  );
  expect(
    satisfiesRacialPrerequisite(halfElfSheet.racial, { race: [elf] }),
  ).toBe(true);
  expect(halfElfSheet.racial.favoredClassCount).toBe(2);
  expect(
    halfElfSheet.selectionRules.slots.filter((slot) =>
      slot.id.includes('pf1-content/wZZzaSmiF8hTuRo7'),
    ),
  ).toMatchObject([{ kind: 'feat', count: 1 }]);
  // Keen Senses: +2 racial Perception on each race (Wisdom 10 throughout).
  for (const race of [halfElf, elf, gnome, halfling])
    expect(sheet(race).breakdowns['skill.per'].total, race).toBe(2);
  // Sure-Footed: +2 Acrobatics and Climb.
  expect(
    sheet(halfling).breakdowns['skill.clm'].total -
      sheet(gnome).breakdowns['skill.clm'].total,
  ).toBe(2);
  // Weapon Familiarity: four Elf bows, longsword and rapier where a pinned
  // base type exists; the Halfling sling.
  const bases = (result: ReturnType<typeof calculateCharacterSheet>) =>
    result.racial.proficiencies
      .map((grant) => ('baseType' in grant ? grant.baseType : ''))
      .sort();
  expect(bases(sheet(elf))).toEqual([
    'Longbow',
    'Longsword',
    'Rapier',
    'Shortbow',
  ]);
  expect(bases(sheet(halfling))).toEqual(['Sling']);
  expect(bases(sheet(gnome))).toEqual([]);
  // Gnome and Halfling are Small; Elf and Half-Elf Medium.
  expect(sheet(gnome).racial.size).toBe('small');
  expect(sheet(halfling).racial.size).toBe('small');
  expect(sheet(elf).racial.size).toBe('medium');
  // Halfling Luck +1 on every save; Obsessive gives no default skill bonus.
  expect(
    sheet(halfling).breakdowns['save.will'].total -
      sheet(gnome).breakdowns['save.will'].total,
  ).toBe(1);
  const obsessive = s4bEntry('pf1-content/LcZE7cPw87DMzJYl');
  expect(obsessive.modifiers).toEqual([]);
});

it('stacks Fearless with Halfling Luck across the two S4-B trait entries and keeps the Gnome bonuses in their situations', () => {
  const sourced = (keys: string[]) =>
    keys.flatMap((key) =>
      s4bEntry(key).modifiers.flatMap((raw) => {
        const modifier = outputSchema.options[0]
          .omit({ kind: true })
          .parse(raw);
        // The ability choice resolves on the sheet, not here.
        if (modifier.target === 'ability.$choice') return [];
        return [
          {
            ...modifier,
            target: modifier.target,
            sheetEntryId: key,
            entryName: s4bEntry(key).name,
            source: key,
            builtIn: false,
          },
        ];
      }),
    );
  const luck = sourced([
    'pf1-content/HVI7FNwj2ng10qtj',
    'pf1-content/qoCLqjadKmJEN9R7',
  ]);
  expect(resolveSheet(luck)['save.will'].total).toBe(1);
  expect(resolveSheet(luck, { situations: ['fear'] })['save.will'].total).toBe(
    3,
  );
  const gnomeDefence = sourced([
    'pf1-content/IQ5vHUbNbGqVaVV5',
    'pf1-content/YHwpeek5IHtcZNDF',
  ]);
  expect(resolveSheet(gnomeDefence)['ac.other'].total).toBe(0);
  expect(
    resolveSheet(gnomeDefence, { situations: ['giants'] })['ac.other'].total,
  ).toBe(4);
  expect(resolveSheet(gnomeDefence)['save.will'].total).toBe(0);
  expect(
    resolveSheet(gnomeDefence, { situations: ['illusions'] })['save.will']
      .total,
  ).toBe(2);
  // Hatred: +1 attack only against the two named humanoid subtypes.
  expect(
    s4bEntry('pf1-content/FD2SILZXcIMjauvr').modifiers.map(
      (modifier) => modifier.condition,
    ),
  ).toEqual([
    { situation: { local: 'vs. humanoids of the reptilian subtype' } },
    { situation: { local: 'vs. humanoids of the goblinoid subtype' } },
  ]);
  // Gnome Magic: +1 to illusion spell DCs, per school.
  expect(s4bEntry('pf1-content/MiPbhGqPRX7H4C7a').modifiers).toEqual([
    {
      target: 'spellDC',
      bonusType: 'untyped',
      value: 1,
      condition: { school: 'illusion' },
    },
  ]);
});
