// @vitest-environment node
import { createHash } from 'node:crypto';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { beforeAll, expect, it } from 'vitest';
import { parse } from 'yaml';
import review from '../../scripts/catalog/legal/spells-525.json';
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
import { calculateCharacterSheetProjections } from '../../src/lib/character-sheet';
import provenance from '../fixtures/spells-525/provenance.json';
import preview from '../fixtures/spells-525/preview.json';
import bindingPreview from '../fixtures/spells-525/binding-preview.json';
import { recordedSpellSheet, spellFixture } from '../fixtures/spells-525/sheet';

const keys = review.candidates.map((row) => row.externalKey);
const root = resolve('tests/fixtures/spells-525');
const inputs = {
  systemPath: join(root, 'pf1'),
  contentPath: join(root, 'pf1-content'),
  remaps: [],
  curation: reviewedCuration,
};
const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');
let bounded: Awaited<ReturnType<typeof importCatalog>>;
let fullContext: Awaited<ReturnType<typeof importCatalog>>;
beforeAll(async () => {
  bounded = await importCatalog({ ...inputs, candidateKeys: keys });
  fullContext = await importCatalog({
    ...inputs,
    candidateKeys: bindingPreview.entries.map((row) => row.externalKey),
  });
});

it('reconciles exactly the ticket inventory and all pinned source bytes', async () => {
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(sha256(keys.join('\n'))).toBe(
    '4c21e6c0a461e098727154e32db09688f1baf48e280e32c2e8770fe8cc700bc0',
  );
  expect(sha256(keys.join('\n'))).toBe(provenance.orderedTicketKeysSha256);
  expect(provenance.rawSources.map((row) => row.externalKey)).toEqual(keys);
  expect(review.summary).toMatchObject({
    rawCandidates: 100,
    admitted: 0,
    held: 100,
    dependentOmissions: 0,
    unsupportedProseOnly: 0,
    excluded: 0,
  });
  expect(
    review.candidates.every(
      (row) => row.kind === 'spell' && row.disposition === 'held',
    ),
  ).toBe(true);
  for (const row of [...provenance.rawSources, ...provenance.dependencies]) {
    const sourceRoot = row.externalKey.startsWith('pf1-content/')
      ? inputs.contentPath
      : inputs.systemPath;
    expect(
      sha256(await readFile(join(sourceRoot, row.path), 'utf8')),
      row.path,
    ).toBe(row.sha256);
  }
});

it('checks complete descriptions and all action metadata independently of attribution', async () => {
  for (const row of review.candidates) {
    const raw = upstreamRecord.parse(
      parse(await readFile(join(inputs.systemPath, row.source.path), 'utf8')),
    );
    expect(raw.type).toBe('spell');
    expect(sha256(sourceDescription(raw))).toBe(row.descriptionSha256);
    expect(row.mechanicsReview.metadata.actions).toEqual(raw.system.actions);
    expect(row.citedSources).toEqual(raw.system.sources);
    const record = reviewedCuration.records.find(
      (record) =>
        record.externalKey === row.externalKey && record.kind === 'description',
    );
    expect(record).toMatchObject({
      status: 'checked',
      text: sourceDescription(raw),
      textSha256: row.descriptionSha256,
      reviewedBy: 'Sol (AI curator) for the owner',
      reviewedOn: '2026-10-08',
    });
    expect(record?.outputs.every((output) => output.kind === 'note')).toBe(
      true,
    );
    expect(
      record?.diagnostics
        .filter((item) => item.kind === 'unresolved')
        .map((item) => item.text),
    ).toEqual(row.mechanicsReview.descriptionRecord.unresolved);
    const assessment = reviewedAdmission.assessments.find(
      (item) => item.externalKey === row.externalKey,
    );
    expect(assessment).toMatchObject({
      status: 'unresolved',
      requiredNotices: row.requiredNotices,
      reviewedBy: 'Sol (AI curator) for the owner',
      reviewedOn: '2026-10-08',
    });
    expect(reviewedAdmission.evidence[row.evidenceId]?.content).toContain(
      row.source.sha256,
    );
    expect(reviewedAdmission.evidence[row.evidenceId]?.content).toContain(
      row.source.location,
    );
    expect(row.holdIds).toContain(`spells-525-whole-content-${raw._id}`);
    expect(row.noticeRequirementsComplete).toBe(false);
  }
});

it('preserves covered inherited context while retaining the pending undead condition', () => {
  const covered = review.candidates.filter(
    (row) => row.mechanicsReview.descriptionRecord.coveredByDescription,
  );
  expect(covered.map((row) => row.name).sort()).toEqual([
    'Detect Undead',
    'Hallucinatory Terrain',
    'Nondetection',
    'Prestidigitation',
    'Violent Misfire',
  ]);
  for (const row of covered) {
    expect(row.mechanicsReview.descriptionRecord.outputCount).toBe(0);
    expect(row.mechanicsReview.descriptionRecord.unresolved).toEqual([]);
  }
  expect(
    covered.find((row) => row.name === 'Detect Undead')?.mechanicsReview
      .outstanding,
  ).toEqual(['Conditional stunned integration.']);
});

it('replays bounded extraction and distinguishes 60 prose diagnostics from 61 inventory gaps', () => {
  expect(bounded.catalog.entries).toEqual(preview.entries);
  expect(bounded.comparison.summary).toMatchObject({
    upstreamRecords: 100,
    admitted: 100,
    excluded: 0,
    unassigned: 0,
  });
  expect(bounded.curation.passed).toBe(true);
  expect(bounded.curation.summary).toMatchObject({
    required: 0,
    missing: 0,
    descriptions: { candidates: 100, checked: 100, drafted: 0 },
  });
  expect(bounded.curation.unresolvedMechanics).toEqual([]);
  expect(
    bounded.curation.unresolvedDescriptions
      .map((row) => row.externalKey)
      .sort(),
  ).toEqual(
    review.candidates
      .filter((row) => row.mechanicsReview.descriptionRecord.unresolved.length)
      .map((row) => row.externalKey)
      .sort(),
  );
  expect(bounded.curation.unresolvedDescriptions).toHaveLength(60);
  expect(
    bounded.catalog.entries.every((entry) => entry.modifiers.length === 0),
  ).toBe(true);
  const gate = assessCatalogAdmission({
    artifact: bounded,
    ...reviewedAdmission,
  });
  expect(gate.admitted).toEqual([]);
  expect(gate.held).toHaveLength(preview.admissionCounts.held);
  expect(gate.failures).toHaveLength(preview.admissionCounts.failures);
  expect(
    [
      ...new Set(
        [...gate.held, ...gate.failures, ...gate.dependentOmissions].map(
          (row) => row.externalKey,
        ),
      ),
    ].sort(),
  ).toEqual([...keys].sort());
  expect(
    gate.failures.every((row) =>
      row.reason.startsWith('Broken structure or reference:'),
    ),
  ).toBe(true);
});

it('replays complete-context entries and every exact full-source assessment binding', () => {
  const sorted = (entries: { externalKey: string }[]) =>
    [...entries].sort((a, b) => a.externalKey.localeCompare(b.externalKey));
  expect(sorted(fullContext.catalog.entries)).toEqual(
    sorted(bindingPreview.entries),
  );
  expect(fullContext.catalog.resources).toEqual(bindingPreview.resources);
  expect(fullContext.catalog.remaps).toEqual(bindingPreview.remaps);
  for (const key of keys) {
    const entry = fullContext.catalog.entries.find(
      (row) => row.externalKey === key,
    );
    const assessment = reviewedAdmission.assessments.find(
      (row) => row.externalKey === key,
    );
    if (!entry || !assessment)
      throw new Error(`Missing full-context Spell ${key}`);
    expect(assessment, entry.name).toMatchObject(
      buildAssessmentBinding({
        entry,
        artifact: fullContext,
        ...reviewedAdmission,
        requiredNotices: assessment.requiredNotices,
        evidenceIds: Object.keys(assessment.evidenceFingerprints),
      }),
    );
  }
  const gate = assessCatalogAdmission({
    artifact: fullContext,
    ...reviewedAdmission,
  });
  expect(gate.admitted.filter((row) => keys.includes(row.externalKey))).toEqual(
    [],
  );
  expect(
    gate.held.filter((row) => keys.includes(row.externalKey)),
  ).toHaveLength(bindingPreview.admissionCounts.held);
  expect(
    gate.failures.filter((row) => keys.includes(row.externalKey)),
  ).toHaveLength(bindingPreview.admissionCounts.failures);
});

it('invalidates Mighty Strength whole-content binding when inherited Bull’s Strength changes', () => {
  const artifact = structuredClone(fullContext);
  const rootSpell = artifact.catalog.entries.find(
    (row) => row.name === 'Mighty Strength',
  );
  const inherited = artifact.catalog.entries.find(
    (row) => row.name === "Bull's Strength",
  );
  const assessment = reviewedAdmission.assessments.find(
    (row) => row.externalKey === rootSpell?.externalKey,
  );
  if (!rootSpell || !inherited || !assessment)
    throw new Error('Missing inherited Bull’s Strength');
  inherited.description += ' Changed inherited ability bonus.';
  expect(
    buildAssessmentBinding({
      entry: rootSpell,
      artifact,
      ...reviewedAdmission,
      requiredNotices: assessment.requiredNotices,
      evidenceIds: Object.keys(assessment.evidenceFingerprints),
    }).contentFingerprint,
  ).not.toBe(assessment.contentFingerprint);
});

it('enforces every complete-chain hold without clearing previously reviewed notices', () => {
  expect(review.noticeRequirements).toHaveLength(55);
  expect(review.noticeRequirements.filter((row) => row.holdId)).toHaveLength(
    54,
  );
  for (const requirement of review.noticeRequirements) {
    if (!requirement.holdId) continue;
    const hold = heldNotices.find((row) => row.id === requirement.holdId);
    expect(hold).toMatchObject({
      notices: expect.arrayContaining([
        requirement.book,
        ...requirement.registryKeys,
      ]),
      evidence: expect.arrayContaining([
        'scripts/catalog/legal/spells-525.json',
      ]),
    });
  }
  for (const row of review.candidates) {
    expect(row.requiredNotices).toEqual(
      expect.arrayContaining(row.inheritedRuleNotices.map((item) => item.book)),
    );
    for (const evidence of row.inheritedNoticeReview)
      expect(sha256(evidence.evidence)).toBe(evidence.evidenceSha256);
  }
});

it.each([
  ['Ki Leech', 'PZO1115', 'hungry ghost monk'],
  ['Polypurpose Panacea', 'PZO1114', 'GameMastery Guide'],
  ['Imbue Army Special Ability', 'PZO1125', 'Ultimate'],
  ["Crafter's Nightmare", 'PZO1132', 'Occult Adventures'],
  ["Crafter's Nightmare", 'PZO1125', 'Ultimate Campaign'],
  ['Fear the Sun', 'PZO1112', 'universal monster rule'],
  ['Summon Monster IV', 'PZO1112', 'celestial template'],
] as const)(
  '%s requires the %s notice for the named inherited rule',
  (name, book, phrase) => {
    const row = review.candidates.find((row) => row.name === name);
    expect(row?.requiredNotices).toContain(book);
    expect(
      row?.inheritedNoticeReview.some(
        (item) => item.book === book && item.evidence.includes(phrase),
      ),
    ).toBe(true);
  },
);

it.each([
  [
    'Mighty Strength',
    'cleric',
    4,
    'PZO9408',
    '22',
    '+8 enhancement bonus to Strength',
  ],
  ['Shock Shield', 'wizard', 1, 'PZO1118', '243', '+2'],
  [
    'Unliving Rage',
    'wizard',
    3,
    'PZO1129',
    '198',
    '+2 profane bonus to Strength and Charisma',
  ],
  [
    'Sense Vitals',
    'wizard',
    2,
    'PZO9459',
    '31',
    'maximum of +5d6 at 15th level',
  ],
  [
    "Owl's Wisdom",
    'wizard',
    2,
    'PZO1110',
    '318',
    '+4 enhancement bonus to Wisdom',
  ],
] as const)(
  '%s preserves real numbers and levels without granting a running effect',
  (name, classTag, level, book, pages, phrase) => {
    const spell = spellFixture(name);
    expect(spell.detail.levels[classTag]).toBe(level);
    expect(spell.sources).toContainEqual({ book, pages });
    expect(spell.description.replace(/<[^>]+>/g, '')).toContain(phrase);
    expect(spell.modifiers).toEqual([]);
    const input = recordedSpellSheet(name, classTag);
    const baseline = calculateCharacterSheetProjections({
      ...input,
      entries: input.entries.filter((entry) => entry.kind !== 'spell'),
    });
    const actual = calculateCharacterSheetProjections(input);
    for (const projection of ['current', 'permanent'] as const) {
      expect(actual[projection].abilities).toEqual(
        baseline[projection].abilities,
      );
      expect(actual[projection].derivedStatistics).toEqual(
        baseline[projection].derivedStatistics,
      );
      expect(actual[projection].proficiencies).toEqual(
        baseline[projection].proficiencies,
      );
      expect(actual[projection].spellEffects).toEqual([]);
      expect(
        actual[projection].spellCollections.spellsWithoutSpellcasting,
      ).toContainEqual(
        expect.objectContaining({
          name,
          spellLevel: level,
          ruleIdentity: spell.externalKey,
        }),
      );
    }
  },
);

it('holds Crown of Glory’s literal record-level 3.5 tag while retaining its stable identity', async () => {
  const row = review.candidates.find((row) => row.name === 'Crown of Glory');
  if (!row) throw new Error('Missing Crown of Glory');
  const raw = upstreamRecord.parse(
    parse(await readFile(join(inputs.systemPath, row.source.path), 'utf8')),
  );
  expect(raw.system.tags).toEqual(['3.5']);
  expect(row.disposition).toBe('held');
  expect(row.holdIds).toContain(
    'spells-525-record-3.5-policy-av7YbbrWBVgNp2hP',
  );
  expect(row.missingEvidence).toMatch(
    /record-level 3\.5 tag: held, never excluded/,
  );
  expect(
    bounded.catalog.entries.find((item) => item.externalKey === row.externalKey)
      ?.name,
  ).toBe('Crown of Glory');
});

it('preserves Hellfire Ray ray-count and Violent Misfire damage-cap disagreements', () => {
  const ray = review.candidates.find((row) => row.name === 'Hellfire Ray');
  const misfire = review.candidates.find(
    (row) => row.name === 'Violent Misfire',
  );
  expect(ray?.mechanicsReview.metadata.actions[0]).toMatchObject({
    extraAttacks: { formula: { count: 'max(1, floor(((@cl + 1) / 4) - 3))' } },
  });
  expect(ray?.mechanicsReview.manualRules).toContain(
    'maximum of three rays at 19th level',
  );
  expect(ray?.mechanicsReview.discrepancies.join(' ')).toContain(
    'extra ray at CL11',
  );
  expect(misfire?.mechanicsReview.metadata.actions[0]).toMatchObject({
    damage: { parts: [{ formula: '(floor(@cl/2))d6' }] },
  });
  expect(misfire?.mechanicsReview.manualRules).toContain('maximum 10d6');
  expect(misfire?.mechanicsReview.discrepancies.join(' ')).toContain('omits');
});

it('uses shared Situations for Linebreaker, Blade Lash and Tower of Iron Will without applying them unconditionally', () => {
  for (const [name, situation] of [
    ['Linebreaker', 'charging'],
    ['Linebreaker', 'bullRush'],
    ['Linebreaker', 'overrun'],
    ['Blade Lash', 'trip'],
    ['Tower of Iron Will V', 'mindAffecting'],
  ] as const) {
    const spell = spellFixture(name);
    expect(
      spell.situationalNotes?.some((row) => row.situation === situation),
    ).toBe(true);
    expect(spell.modifiers).toEqual([]);
  }
  const linebreaker = spellFixture('Linebreaker');
  expect(linebreaker.description).toBe(
    '<p>You gain a +20 foot bonus to your base speed when charging and a +2 bonus on combat maneuver checks made to bull rush or overrun.</p>',
  );
  expect(linebreaker.situationalNotes).toEqual([
    {
      text: 'Gain +20 feet to base speed when charging. Gain +2 on combat maneuver checks made to bull rush or overrun.',
    },
    {
      situation: 'bullRush',
      text: '+2 on bull rush combat maneuver checks while Linebreaker runs.',
    },
    {
      situation: 'overrun',
      text: '+2 on overrun combat maneuver checks while Linebreaker runs.',
    },
    {
      situation: 'charging',
      text: 'While Linebreaker runs, gain +20 feet to base speed when charging.',
    },
  ]);
  const row = review.candidates.find((item) => item.name === 'Linebreaker');
  expect(row?.mechanicsReview.sharedSituations).toEqual([
    'bullRush',
    'overrun',
    'charging',
  ]);
  expect(row?.mechanicsReview.localSituations).toEqual([]);
  expect(row?.mechanicsReview.proseOnlyMechanics).toEqual([
    'Gain +20 feet to base speed when charging.',
    'Gain +2 on combat maneuver checks made to bull rush or overrun.',
  ]);
  expect(row?.mechanicsReview.descriptionRecord.rationale).toContain(
    'Gain +20 feet to base speed when charging. Gain +2 on combat maneuver checks made to bull rush or overrun.',
  );
  expect(
    reviewedCuration.situations.find((item) => item.key === 'charging'),
  ).toMatchObject({
    label: 'when charging',
    aliases: ['when charging', 'while charging'],
    reviewedBy: 'Sol (AI curator) for the owner',
    reviewedOn: '2026-10-08',
  });
  const input = recordedSpellSheet('Linebreaker', 'ranger');
  for (const situations of [
    [],
    ['charging'],
    ['bullRush'],
    ['overrun'],
  ] as const) {
    const baseline = calculateCharacterSheetProjections(
      {
        ...input,
        entries: input.entries.filter((entry) => entry.kind !== 'spell'),
      },
      { situations },
    );
    const actual = calculateCharacterSheetProjections(input, { situations });
    for (const projection of ['current', 'permanent'] as const) {
      expect(actual[projection].derivedStatistics).toEqual(
        baseline[projection].derivedStatistics,
      );
      expect(actual[projection].spellEffects).toEqual([]);
    }
  }
});

it('retains descriptor/action-note gaps and all 16 complete PCGen CRB comparisons as evidence', () => {
  expect(
    review.metadataImportGaps.find(
      (row) => row.field === 'system.descriptors vs imported system.types',
    )?.candidateCount,
  ).toBe(32);
  const compared = review.candidates.filter((row) => row.comparison);
  expect(compared).toHaveLength(16);
  expect(
    compared.filter(
      (row) => row.comparison?.descriptionMatchesAfterPresentationNormalization,
    ),
  ).toHaveLength(12);
  for (const row of compared) {
    if (!row.comparison) throw new Error('Missing comparison');
    expect(sha256(row.comparison.text)).toBe(row.comparison.lineSha256);
    expect(row.comparison.text).toContain('.MOD');
    expect(row.assessmentStatus).toBe('unresolved');
  }
});

it('invalidates checked Owl’s Wisdom prose after a real numeric change', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'spells-525-change-'));
  try {
    await cp(root, temporary, { recursive: true });
    const row = review.candidates.find((row) => row.name === "Owl's Wisdom");
    if (!row) throw new Error('Missing Owl’s Wisdom');
    const path = join(temporary, 'pf1', row.source.path);
    const raw = await readFile(path, 'utf8');
    expect(raw).toMatch(/\+4\s+enhancement/);
    await writeFile(path, raw.replace('+4', '+5'));
    const changed = await importCatalog({
      ...inputs,
      systemPath: join(temporary, 'pf1'),
      contentPath: join(temporary, 'pf1-content'),
      candidateKeys: keys,
    });
    expect(changed.curation.stale).toContainEqual(
      expect.objectContaining({
        externalKey: row.externalKey,
        kind: 'description',
      }),
    );
    expect(
      changed.curation.applied.some(
        (record) => record.externalKey === row.externalKey,
      ),
    ).toBe(false);
    expect(
      assessCatalogAdmission({ artifact: changed, ...reviewedAdmission })
        .admitted,
    ).toEqual([]);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
