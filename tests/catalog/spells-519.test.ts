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
import review from '../../scripts/catalog/legal/spells-519.json';
import { reviewedCuration as curation } from '../../scripts/catalog/reviewed-curation-data';
import { importCatalog } from '../../scripts/catalog/import';
import { buildAssessmentBinding } from '../../scripts/catalog/admission';
import {
  sourceDescription,
  upstreamRecord,
} from '../../scripts/catalog/records';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import { withFullBindingContext738 } from './full-binding-context-738';
import { calculateCharacterSheetProjections } from '../../src/lib/character-sheet';
import provenance from '../fixtures/spells-519/provenance.json';
import preview from '../fixtures/spells-519/preview.json';
import { recordedSpellSheet, spellFixture } from '../fixtures/spells-519/sheet';
import { assessWithUnclearedHolds } from './uncleared-holds';

const keys = review.candidates.map((row) => row.externalKey);
const fixtureRoot = resolve('tests/fixtures/spells-519');
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

it('accounts for exactly the ticket100 pinned records, excluding only the school folder and retaining99 individual whole-content holds', async () => {
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(sha256(keys.join('\n'))).toBe(
    'c3fa1c30c53d905c84b5084e396574ce8c82bcf43f6c754001093fb750134ecf',
  );
  expect(provenance.rawSources.map((row) => row.externalKey)).toEqual(keys);
  expect(await readdir(join(inputs.systemPath, 'packs/spells'))).toHaveLength(
    100,
  );
  expect(provenance.dependencies).toHaveLength(28);
  const assessments = reviewedAdmission.assessments.filter((row) =>
    keys.includes(row.externalKey),
  );
  expect(assessments).toHaveLength(99);
  for (const candidate of review.candidates) {
    const raw = await readFile(
      join(inputs.systemPath, candidate.source.path),
      'utf8',
    );
    expect(sha256(raw), candidate.name).toBe(candidate.source.sha256);
    const record = upstreamRecord.parse(parse(raw));
    expect(`pf1/${record._id}`).toBe(candidate.externalKey);
    if (candidate.kind === 'folder') {
      expect(candidate).toMatchObject({
        externalKey: 'pf1/4NHp2XrrZ02oHYog',
        name: 'Abjuration',
        disposition: 'excluded',
      });
      expect(
        assessments.some((row) => row.externalKey === candidate.externalKey),
      ).toBe(false);
      continue;
    }
    expect(record.type).toBe('spell');
    expect(candidate.disposition).toBe('held');
    expect(sha256(sourceDescription(record))).toBe(candidate.descriptionSha256);
    expect(candidate.mechanicsReview?.descriptionReview).toBe(
      'complete-full-description-and-all-actions',
    );
    for (const [field, value] of Object.entries(
      candidate.mechanicsReview?.metadata ?? {},
    ))
      expect(value, `${candidate.name}: ${field}`).toEqual(
        record.system[field] ?? null,
      );
    expect(candidate.mechanicsReview?.requiredRecords).toEqual([]);
    expect(candidate.mechanicsReview?.recordedSpellModifiers).toBe(0);
    const assessment = assessments.find(
      (row) => row.externalKey === candidate.externalKey,
    );
    expect(assessment).toMatchObject({
      status: 'unresolved',
      reviewedBy: 'Sol (AI curator) for the owner',
      reviewedOn: '2026-10-08',
      requiredNotices: candidate.requiredNotices,
    });
    expect(candidate.noticeRequirementsComplete).toBe(false);
    expect(
      reviewedAdmission.evidence[candidate.evidenceId ?? '']?.content,
    ).toContain(candidate.source.sha256);
    expect(
      reviewedAdmission.evidence[candidate.evidenceId ?? '']?.content,
    ).toContain(candidate.source.location);
  }
  for (const source of [...provenance.rawSources, ...provenance.dependencies])
    expect(
      sha256(await readFile(join(inputs.systemPath, source.path), 'utf8')),
      source.path,
    ).toBe(source.sha256);
});

it('reproduces the checked99-description preview without admitting context, changing Spell stats or losing exact Source metadata', async () => {
  const artifact = await importCatalog(inputs);
  expect(artifact.catalog.entries).toEqual(preview.entries);
  expect(artifact.catalog.entries).toHaveLength(99);
  expect(artifact.curation.passed).toBe(true);
  expect(artifact.curation.summary).toMatchObject({
    required: 0,
    checked: 0,
    missing: 0,
    descriptions: { candidates: 99, checked: 99, drafted: 0 },
  });
  expect(artifact.curation.unresolvedMechanics).toEqual([]);
  expect(artifact.curation.unresolvedDescriptions).toHaveLength(
    review.mechanicsSummary.outstandingCandidates,
  );
  const batch = curation.records.filter((row) =>
    keys.includes(row.externalKey),
  );
  expect(batch).toHaveLength(99);
  for (const row of batch) {
    expect(row.kind).toBe('description');
    expect(row.status).toBe('checked');
    expect(row.outputs.every((output) => output.kind === 'note')).toBe(true);
  }
  for (const entry of artifact.catalog.entries) {
    expect(entry.detail.kind).toBe('spell');
    expect(entry.modifiers, entry.name).toEqual([]);
    expect(entry.sourceKey).toBeUndefined();
    const candidate = review.candidates.find(
      (row) => row.externalKey === entry.externalKey,
    );
    if (candidate?.kind !== 'spell') throw new Error('Missing reviewed Spell');
    expect(entry.sources).toEqual(candidate.importedSources);
    const assessment = reviewedAdmission.assessments.find(
      (row) => row.externalKey === entry.externalKey,
    );
    if (!assessment) throw new Error('Missing assessment');
    expect(assessment).toMatchObject(
      buildAssessmentBinding({
        ...withFullBindingContext738({ entry, artifact }),
        ...reviewedAdmission,
        requiredNotices: assessment.requiredNotices,
        evidenceIds: Object.keys(assessment.evidenceFingerprints),
      }),
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
  ).toEqual(
    review.candidates
      .filter((row) => row.kind === 'spell')
      .map((row) => row.externalKey)
      .sort(),
  );
});

it('pins Magic Missile, False Life, Spider Climb and Spell Resistance to source numbers without activating running effects', () => {
  const missile = spellFixture('Magic Missile');
  expect(missile.externalKey).toBe('pf1/49yc9dpr4kvgki2s');
  expect(missile.sources).toEqual([{ book: 'PZO1110', pages: '309' }]);
  expect(missile.detail).toMatchObject({
    school: 'evo',
    levels: { wizard: 1 },
  });
  expect(missile.description).toContain('1d4+1');
  expect(missile.description).toContain(
    'maximum of five missiles at 9th level',
  );
  const falseLife = spellFixture('False Life');
  expect(falseLife.description).toContain(
    '1d10 + 1 per caster level (maximum +10)',
  );
  expect(
    review.candidates.find((row) => row.name === falseLife.name)
      ?.mechanicsReview?.outstanding,
  ).toEqual([]);
  expect(falseLife.modifiers).toEqual([]);
  const climb = spellFixture('Spider Climb');
  expect(climb.description).toContain(
    'climb speed of 20 feet and a +8 racial bonus',
  );
  const resistance = spellFixture('Spell Resistance');
  expect(resistance.description).toContain('12 + your caster level');
  for (const [name, classTag, level] of [
    ['Magic Missile', 'wizard', 1],
    ['False Life', 'wizard', 2],
    ['Spider Climb', 'wizard', 2],
    ['Spell Resistance', 'cleric', 5],
  ] as const) {
    const result = calculateCharacterSheetProjections(
      recordedSpellSheet(name, classTag),
    );
    for (const projection of [result.current, result.permanent]) {
      expect(projection.abilities.strength.score).toBe(10);
      expect(projection.breakdowns['attack.melee'].total).toBe(0);
      expect(projection.breakdowns['damage.melee'].total).toBe(0);
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
  }
});

it('preserves shared Situations and inherited numeric boundaries without applying any reference Note as a Modifier', () => {
  expect(spellFixture('Contagious Zeal').situationalNotes).toContainEqual(
    expect.objectContaining({
      target: 'saves',
      situation: 'fear',
      text: expect.stringContaining('+4 morale'),
    }),
  );
  for (const situation of ['overrun', 'trip'])
    expect(spellFixture('Phantom Limb').situationalNotes).toContainEqual(
      expect.objectContaining({
        target: 'cmd',
        situation,
        text: expect.stringContaining('+4 CMD'),
      }),
    );
  for (const situation of [
    'bullRush',
    'grapple',
    'overrun',
    'reposition',
    'trip',
  ])
    expect(spellFixture('Titanic Anchoring').situationalNotes).toContainEqual(
      expect.objectContaining({
        target: 'cmd',
        situation,
        text: expect.stringContaining('+10 CMD'),
      }),
    );
  expect(
    review.candidates
      .find((row) => row.name === 'Mental Barrier IV')
      ?.mechanicsReview?.outstanding.join(' '),
  ).toContain('+8 shield');
  expect(
    review.candidates
      .find((row) => row.name === 'Spellcasting Contract')
      ?.mechanicsReview?.discrepancies.join(' '),
  ).toContain('AC/saves/checks');
  expect(
    review.candidates
      .find((row) => row.name === 'Shared Wrath')
      ?.mechanicsReview?.outstanding.join(' '),
  ).toContain('CL12 Improved Critical');
  const result = calculateCharacterSheetProjections(
    recordedSpellSheet('Contagious Zeal', 'cleric'),
    { situations: ['fear'] },
  );
  expect(result.current.derivedStatistics.will.total).toBe(0);
  expect(result.permanent.derivedStatistics.will.total).toBe(0);
});

it('uses fixture-only admission permission in memory and still enforces the complete APG notice-chain hold', async () => {
  const artifact = await importCatalog(inputs);
  const examples = artifact.catalog.entries.filter((entry) =>
    ['Magic Missile', "Crafter's Fortune"].includes(entry.name),
  );
  expect(examples).toHaveLength(2);
  const evidence = {
    fixture: {
      content:
        'Fixture-only permission, never shipping evidence or real-content review.',
    },
  };
  const apgKey =
    'pf1-content/notice/7d75468ec859d3452bcef8458792e6ef19c7aafcf9cbaf2f759fdf4bc923b2a2';
  const notice = reviewedAdmission.registry[apgKey];
  if (!notice) throw new Error('Missing APG notice');
  // The notice-hold clearance's drafted PRD record for PZO1115 (2026-10-30)
  // claims the code too; it stands aside so the alias resolves.
  const { PZO1115: _drafted, ...committedRegistry } =
    reviewedAdmission.registry;
  const registry = {
    ...committedRegistry,
    [apgKey]: { ...notice, aliases: ['PZO1115'] },
  };
  const assessments = examples.map((entry) => {
    const shipping = reviewedAdmission.assessments.find(
      (row) => row.externalKey === entry.externalKey,
    );
    if (!shipping) throw new Error('Missing held assessment');
    return {
      ...shipping,
      status: 'confirmed' as const,
      rationale: 'Fixture-only in-memory admission test.',
      ...buildAssessmentBinding({
        entry,
        artifact,
        evidence,
        registry,
        requiredNotices: shipping.requiredNotices,
        evidenceIds: ['fixture'],
      }),
    };
  });
  const gate = assessWithUnclearedHolds({
    artifact,
    ...reviewedAdmission,
    evidence,
    registry,
    assessments,
  });
  expect(gate.admitted).toContainEqual(
    expect.objectContaining({ externalKey: 'pf1/49yc9dpr4kvgki2s' }),
  );
  expect(gate.held).toContainEqual(
    expect.objectContaining({
      externalKey: 'pf1/4k32l03rzxgyifkx',
      reason: expect.stringContaining('Notice holds:'),
    }),
  );
  expect(
    reviewedAdmission.assessments
      .filter((row) => keys.includes(row.externalKey))
      .every((row) => row.status === 'unresolved'),
  ).toBe(true);
});

it('invalidates checked source-bound description when Magic Missile damage changes', async () => {
  const work = resolve('.scratch/spells-519-test-work');
  await mkdir(work, { recursive: true });
  const root = await mkdtemp(join(work, 'changed-source-'));
  temporary.push(root);
  await cp(fixtureRoot, root, { recursive: true });
  const path = join(
    root,
    'pf1/packs/spells/magic-missile.49yc9dpr4kvgki2s.yaml',
  );
  const raw = await readFile(path, 'utf8');
  expect(raw).toContain('1d4+1');
  await writeFile(path, raw.replaceAll('1d4+1', '1d4+2'));
  const artifact = await importCatalog({
    ...inputs,
    systemPath: join(root, 'pf1'),
    contentPath: join(root, 'pf1-content'),
  });
  expect(artifact.curation.stale).toContainEqual(
    expect.objectContaining({
      externalKey: 'pf1/49yc9dpr4kvgki2s',
      kind: 'description',
    }),
  );
  expect(
    artifact.curation.applied.some(
      (row) => row.externalKey === 'pf1/49yc9dpr4kvgki2s',
    ),
  ).toBe(false);
  expect(
    assessWithUnclearedHolds({ artifact, ...reviewedAdmission }).admitted,
  ).toEqual([]);
});

it('retains Greater Hex Glyph’s DC16 Spellcraft rule and keeps its rules JournalEntryPage link as text (#738)', async () => {
  const artifact = await importCatalog(inputs);
  const hex = artifact.catalog.entries.find(
    (entry) => entry.externalKey === 'pf1/4fm4md4eux7sw6o0',
  );
  if (!hex) throw new Error('Missing Greater Hex Glyph');
  expect(hex.sources).toEqual([{ book: 'PZO1129', pages: '184' }]);
  expect(hex.description).toContain('DC 16');
  expect(hex.description).toContain('Spellcraft');
  // #738: the Spellcraft journal page link is no broken reference; the
  // bounded import still strips its links to Spells outside the selection.
  expect(hex.unsupported).not.toContainEqual(
    expect.objectContaining({
      value:
        'Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.VRD7jxiIAxKPt6EF',
    }),
  );
  expect(
    assessWithUnclearedHolds({ artifact, ...reviewedAdmission }).failures,
  ).toContainEqual({
    externalKey: hex.externalKey,
    reason: 'Broken structure or reference: unresolved imported reference.',
  });
  expect(
    review.candidates.find((entry) => entry.externalKey === hex.externalKey),
  ).toMatchObject({
    disposition: 'held',
    referenceReview: {
      status: 'unresolved-importer-reference',
      independentOfLegalDisposition: true,
    },
  });
});
