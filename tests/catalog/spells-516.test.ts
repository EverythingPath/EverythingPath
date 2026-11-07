// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { afterEach, beforeAll, expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import keys from '../../scripts/catalog/spells-516-candidates.json';
import { reviewedCuration as curation } from '../../scripts/catalog/reviewed-curation-data';
import mechanics from '../../docs/catalog-import/spells-516-mechanics.json';
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
import provenance from '../fixtures/spells-516/provenance.json';
import preview from '../fixtures/spells-516/preview.json';
import { linkedContext, review } from '../fixtures/spells-516/data';
import { recordedSpellSheet, spellFixture } from '../fixtures/spells-516/sheet';
import {
  expectLaunchOutcome,
  expectPinnedPcgenRows,
} from './launch-reassessment';

const fixtureRoot = resolve('tests/fixtures/spells-516');
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
type Row = (typeof review.candidates)[number];
type Artifact = Awaited<ReturnType<typeof importCatalog>>;
const launch = review.launchReassessment;
const launchRows = review.candidates.filter((row) => row.launchReview);
const earlierRows = review.candidates.filter((row) => !row.launchReview);
const row = (name: string) => {
  const found = review.candidates.find((candidate) => candidate.name === name);
  if (!found?.launchReview) throw new Error(`No launch review of ${name}`);
  return { row: found, review: found.launchReview };
};
const ours = (rows: { externalKey: string }[]) =>
  rows
    .map((current) => current.externalKey)
    .filter((key) => keys.includes(key))
    .sort();
const sorted = (list: string[]) => [...list].sort();
let artifact: Artifact;
beforeAll(async () => {
  artifact = await importCatalog(inputs);
});

/** The bounded fixture with each link-bearing root on its full-preview closure. */
function withLinks(bounded: Artifact): Artifact {
  const replaced = new Set(linkedContext.entries.map((e) => e.externalKey));
  return {
    ...bounded,
    catalog: {
      ...bounded.catalog,
      entries: [
        ...bounded.catalog.entries.filter((e) => !replaced.has(e.externalKey)),
        ...linkedContext.entries,
      ],
    },
  };
}

/** The recorded binding of a launch row, replayed on its own closure. */
function replayBinding(candidate: Row) {
  const linked = linkedContext.rootKeys.includes(candidate.externalKey);
  const context = linked ? withLinks(artifact) : artifact;
  const entry = context.catalog.entries.find(
    (current) => current.externalKey === candidate.externalKey,
  );
  if (!entry) throw new Error(`Missing entry ${candidate.name}`);
  const binding = buildAssessmentBinding({
    entry,
    artifact: context,
    ...reviewedAdmission,
    requiredNotices: candidate.requiredNotices,
    evidenceIds: [candidate.evidenceId],
  });
  return {
    binding,
    recorded: {
      contentFingerprint: binding.contentFingerprint,
      mappingFingerprint: binding.mappingFingerprint,
      evidenceFingerprint: binding.evidenceFingerprints[candidate.evidenceId],
      noticeFingerprints: binding.noticeFingerprints,
    },
  };
}

/** The granted levels the PCGen base row lists, as `<group>.<Name> <level>`. */
function baseRowGrants(literalRow: string) {
  const token = literalRow
    .split('\t')
    .find((cell) => cell.startsWith('DOMAINS:'));
  return (token?.slice('DOMAINS:'.length).split('|') ?? []).flatMap((group) => {
    const [names = '', level = ''] = group.split('=');
    return names.split(',').map((name) => `domain.${name.trim()} ${level}`);
  });
}

/**
 * Fix round 1: every granted-level mapping outside learnedAt.class is listed
 * by the PCGen base row or bounded by literal pinned PCGen rows whose book the
 * record requires; an unbounded one keeps the record on a named hold.
 */
function expectGrantedLevelsBounded(candidate: Row) {
  const review = candidate.launchReview;
  if (!review) throw new Error(candidate.name);
  const listed = new Set(baseRowGrants(review.pcgen.baseRow.literalRow));
  const evidence = review.metadata.grantedLevelEvidence ?? [];
  const grants = Object.entries(candidate.learnedAt)
    .filter(([group]) => group !== 'class')
    .flatMap(([group, rows]) =>
      Object.entries(rows).map(([name, level]) => `${group}.${name} ${level}`),
    )
    .filter((grant) => !listed.has(grant));
  expect(evidence.map((entry) => entry.mapping).sort(), candidate.name).toEqual(
    grants.sort(),
  );
  for (const entry of evidence) {
    if (entry.status === 'unbounded') {
      expect(candidate.assessmentStatus, candidate.name).toBe('unresolved');
      expect(candidate.holdIds[0], candidate.name).toMatch(
        /^spells-516-unbounded-mapping-/,
      );
      continue;
    }
    expect(candidate.requiredNotices, entry.mapping).toContain(entry.book);
    for (const cited of entry.pcgen ?? []) {
      const bytes = readFileSync(
        join('tests/fixtures/pinned/pcgen', cited.path),
      );
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(
        cited.fileSha256,
      );
      expect(bytes.toString().split('\n')[cited.line - 1]).toBe(
        cited.literalRow,
      );
      expect(sha256(cited.literalRow)).toBe(cited.lineSha256);
    }
  }
}

/** A row the wave left alone keeps its 2026-10-07 review. */
function expectEarlierReview(candidate: Row) {
  expect(candidate.disposition, candidate.name).toBe('held');
  expect(candidate.noticeRequirementsComplete, candidate.name).toBe(false);
  expect(candidate.holdIds.length, candidate.name).toBeGreaterThan(0);
  expect(candidate.missingEvidence?.length, candidate.name).toBeGreaterThan(0);
  expect(
    reviewedAdmission.assessments.find(
      (assessment) => assessment.externalKey === candidate.externalKey,
    ),
  ).toMatchObject({
    status: 'unresolved',
    reviewedBy: 'Sol (AI curator) for the owner',
    reviewedOn: '2026-10-07',
    requiredNotices: candidate.requiredNotices,
  });
}

it('accounts exactly the 100 ticket identities with bound source bytes, keeping the 62 rows the launch wave left on their whole-content holds', async () => {
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(sha256(keys.join('\n'))).toBe(
    '21f434bc2e11c7d82738ff4c2307a55046927e2dd5ca85ec14f2c4175082b507',
  );
  expect(review.candidates.map((candidate) => candidate.externalKey)).toEqual(
    keys,
  );
  expect(
    mechanics.candidates.map((candidate) => candidate.externalKey),
  ).toEqual(keys);
  expect(
    reviewedAdmission.assessments.filter((assessment) =>
      keys.includes(assessment.externalKey),
    ),
  ).toHaveLength(100);
  // #516 whole-content wave 3 (with fix rounds 1 and 2): 29 admitted, 6
  // dependently omitted, and three held launch rows (one named hold, two on a
  // notice with no Registry record).
  expect(launchRows).toHaveLength(38);
  expect(
    review.candidates.filter((candidate) => candidate.disposition === 'held'),
  ).toHaveLength(65);
  for (const candidate of review.candidates) {
    const raw = await readFile(
      join(inputs.systemPath, candidate.source.path),
      'utf8',
    );
    expect(sha256(raw), candidate.name).toBe(candidate.source.sha256);
    const record = upstreamRecord.parse(parse(raw));
    expect(`pf1/${record._id}`).toBe(candidate.externalKey);
    expect(sha256(sourceDescription(record))).toBe(candidate.descriptionSha256);
    expect(
      mechanics.candidates.find(
        (current) => current.externalKey === candidate.externalKey,
      ),
    ).toMatchObject({
      fileSha256: candidate.source.sha256,
      descriptionSha256: candidate.descriptionSha256,
      review: { description: 'checked' },
    });
    if (!candidate.launchReview) expectEarlierReview(candidate);
    const assessment = reviewedAdmission.assessments.find(
      (current) => current.externalKey === candidate.externalKey,
    );
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
    ).toBe(source.sha256);
  }
  expect(provenance.dependencies).toHaveLength(28);
});

/** Each entry cites exactly its pinned source's books and pages. */
async function expectSourceCitations(
  entry: Artifact['catalog']['entries'][number],
) {
  const candidate = review.candidates.find(
    (current) => current.externalKey === entry.externalKey,
  );
  if (!candidate)
    throw new Error(`Missing reviewed Spell: ${entry.externalKey}`);
  const raw = z
    .object({
      system: z.object({
        sources: z.array(z.object({ id: z.string(), pages: z.string() })),
      }),
    })
    .parse(
      parse(
        await readFile(join(inputs.systemPath, candidate.source.path), 'utf8'),
      ),
    );
  expect(entry.sources).toEqual(
    raw.system.sources.map((source) => ({
      book: source.id,
      pages: source.pages,
    })),
  );
}

it('reproduces all reviewed Spells and admits only the confirmed launch rows without importing running Spell Effects', async () => {
  expect(artifact.catalog.entries).toEqual(preview.entries);
  expect(
    artifact.catalog.entries.map((entry) => entry.externalKey).sort(),
  ).toEqual([...keys].sort());
  expect(artifact.curation.passed).toBe(true);
  expect(artifact.curation.summary).toMatchObject({
    required: 0,
    checked: 0,
    missing: 0,
    descriptions: { candidates: 44, checked: 44, drafted: 0 },
  });
  expect(artifact.curation.unresolvedMechanics).toEqual([]);
  expect(artifact.curation.unresolvedDescriptions).toHaveLength(14);
  for (const record of artifact.curation.unresolvedDescriptions) {
    expect(
      mechanics.candidates.find((row) => row.externalKey === record.externalKey)
        ?.outstandingCalculations.length,
    ).toBeGreaterThan(0);
  }
  for (const entry of artifact.catalog.entries) {
    expect(entry.detail.kind).toBe('spell');
    expect(entry.modifiers, entry.name).toEqual([]);
    expect(entry.sourceKey, entry.name).toBeUndefined();
    await expectSourceCitations(entry);
  }
  // Bounded, the six link-bearing roots lose their links and their bindings,
  // so only the 29 admitted launch rows pass.
  const bounded = assessCatalogAdmission({ artifact, ...reviewedAdmission });
  expect(ours(bounded.admitted)).toEqual(sorted(launch.admittedKeys));
  expect(ours([...bounded.held, ...bounded.failures])).toEqual(
    sorted(keys.filter((key) => !launch.admittedKeys.includes(key))),
  );
  // With their linked spells present, the six are dependently omitted.
  const linked = assessCatalogAdmission({
    artifact: withLinks(artifact),
    ...reviewedAdmission,
  });
  expect(ours(linked.admitted)).toEqual(sorted(launch.admittedKeys));
  expect(ours(linked.dependentOmissions)).toEqual(
    sorted(launch.dependentlyOmittedKeys),
  );
  // Only rows the wave left alone fail on links outside the fixture.
  expect(
    ours(linked.failures).filter((key) =>
      launchRows.some((candidate) => candidate.externalKey === key),
    ),
  ).toEqual([]);
  expect(
    linked.held.find((held) => held.externalKey === 'pf1/13pilcgm2oydyogv')
      ?.reason,
  ).toBe('Missing or unreviewed required notices: PZO1139.');
  // Every launch row's recorded binding replays, the six roots on their
  // full-preview closures; the earlier rows keep their 2026-10-07 binding.
  for (const candidate of launchRows) {
    const { binding, recorded } = replayBinding(candidate);
    expect(candidate.binding, candidate.name).toEqual(recorded);
    expect(
      reviewedAdmission.assessments.find(
        (assessment) => assessment.externalKey === candidate.externalKey,
      ),
      candidate.name,
    ).toMatchObject({
      ...binding,
      status: candidate.assessmentStatus,
      requiredNotices: candidate.requiredNotices,
      rationale: candidate.rationale,
      reviewedBy: 'Opus (AI curator) for the owner',
      reviewedOn: '2026-11-04',
    });
  }
  expect(
    review.candidates.find((row) => row.externalKey === 'pf1/05i5rxwim12hwktu')
      ?.comparison?.completeDirectComparison,
  ).toBe(false);
});

it('pins Bull’s Strength’s class and grant levels separately from the +4 running effect described in its prose', () => {
  const bull = spellFixture("Bull's Strength");
  expect(bull.externalKey).toBe('pf1/05i5rxwim12hwktu');
  expect(bull.sources).toEqual([{ book: 'PZO1110', pages: '251' }]);
  expect(bull.detail.levels).toMatchObject({
    wizard: 2,
    cleric: 2,
    druid: 2,
    paladin: 2,
    alchemist: 2,
    summonerUnchained: 2,
  });
  expect(bull.detail.grantedLevels).toEqual({
    bloodline: { Abyssal: 2, Orc: 2 },
    domain: { Strength: 2 },
    subDomain: { Rage: 2 },
  });
  expect(bull.detail.school).toBe('trs');
  expect(bull.description).toContain('+4 enhancement bonus');
  expect(bull.modifiers).toEqual([]);
  expect(
    mechanics.candidates
      .find((row) => row.externalKey === bull.externalKey)
      ?.outstandingCalculations.join(' '),
  ).toContain('outside this batch');
  const result = calculateCharacterSheetProjections(
    recordedSpellSheet("Bull's Strength"),
  );
  for (const projection of [result.current, result.permanent]) {
    expect(projection.abilities.strength.score).toBe(10);
    expect(projection.breakdowns['attack.melee'].total).toBe(0);
    expect(
      projection.spellCollections.spellsWithoutSpellcasting,
    ).toContainEqual(
      expect.objectContaining({
        entryId: 'spell-row',
        spellLevel: 2,
        explicitLevel: 2,
      }),
    );
  }
});

it('keeps Protection from Spells’ +8 and Divine Power’s capped scaling as effect prose rather than unconditional bonuses', () => {
  const protection = spellFixture('Protection from Spells');
  expect(protection.detail).toMatchObject({
    school: 'abj',
    levels: { wizard: 8, summoner: 6 },
    grantedLevels: { domain: { Magic: 8 } },
  });
  expect(protection.sources).toEqual([{ book: 'PZO1110', pages: '328' }]);
  expect(protection.modifiers).toEqual([]);
  expect(protection.situationalNotes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        target: 'saves',
        situation: 'spells',
        text: expect.stringContaining('+8'),
      }),
      expect.objectContaining({
        target: 'saves',
        situation: 'spellLike',
        text: expect.stringContaining('+8'),
      }),
    ]),
  );
  const recordedProtection = calculateCharacterSheetProjections(
    recordedSpellSheet('Protection from Spells'),
    { situations: ['spells', 'spellLike'] },
  );
  for (const projection of [
    recordedProtection.current,
    recordedProtection.permanent,
  ]) {
    expect(projection.derivedStatistics.fortitude.total).toBe(0);
    expect(projection.derivedStatistics.reflex.total).toBe(0);
    expect(projection.derivedStatistics.will.total).toBe(0);
  }
  const divine = spellFixture('Divine Power');
  expect(divine.detail.levels).toMatchObject({
    cleric: 4,
    oracle: 4,
    warpriest: 4,
  });
  expect(divine.description).toContain('every three caster levels');
  expect(divine.description).toContain('maximum +6');
  expect(divine.modifiers).toEqual([]);
  const batchRecords = curation.records.filter((record) =>
    keys.includes(record.externalKey),
  );
  expect(batchRecords).toHaveLength(44);
  for (const record of batchRecords) {
    expect(record.kind).toBe('description');
    expect(record.status).toBe('checked');
    expect(record.outputs.every((output) => output.kind === 'note')).toBe(true);
  }
});

it('invalidates the exact checked description when the source bonus text changes', async () => {
  const work = resolve('.scratch/spells-516-test-work');
  await mkdir(work, { recursive: true });
  const root = await mkdtemp(join(work, 'changed-description-'));
  temporary.push(root);
  await cp(fixtureRoot, root, { recursive: true });
  const sourcePath = join(
    root,
    'pf1/packs/spells/protection-from-spells.0kppkhsencd6tzvh.yaml',
  );
  const raw = await readFile(sourcePath, 'utf8');
  expect(raw).toContain('+8 resistance bonus');
  await writeFile(
    sourcePath,
    raw.replace('+8 resistance bonus', '+9 resistance bonus'),
  );
  const changed = await importCatalog({
    ...inputs,
    systemPath: join(root, 'pf1'),
    contentPath: join(root, 'pf1-content'),
  });
  expect(changed.curation.stale).toContainEqual(
    expect.objectContaining({
      externalKey: 'pf1/0kppkhsencd6tzvh',
      kind: 'description',
    }),
  );
  expect(changed.curation.summary.descriptions.checked).toBe(43);
  expect(
    changed.curation.applied.some(
      (record) => record.externalKey === 'pf1/0kppkhsencd6tzvh',
    ),
  ).toBe(false);
  expect(
    changed.catalog.entries.find(
      (entry) => entry.externalKey === 'pf1/0kppkhsencd6tzvh',
    )?.modifiers,
  ).toEqual([]);
  // Protection from Spells is an admitted launch row: the changed body
  // invalidates its binding, and only it leaves the admitted rows.
  expect(launch.admittedKeys).toContain('pf1/0kppkhsencd6tzvh');
  expect(
    ours(
      assessCatalogAdmission({ artifact: changed, ...reviewedAdmission })
        .admitted,
    ),
  ).toEqual(
    sorted(launch.admittedKeys.filter((key) => key !== 'pf1/0kppkhsencd6tzvh')),
  );
});

it('pins the launch re-assessment of the 38 launch rows to the literal pinned PCGen rows (#516 whole-content wave 3)', async () => {
  expect(launch.admittedKeys).toHaveLength(29);
  expect(launch.dependentlyOmittedKeys).toHaveLength(6);
  // Fix round 2: Bull's Strength joins Disfiguring Touch as a confirmed row
  // the gate holds on a notice with no Registry record.
  expect(launch.noticeHeldKeys).toEqual({
    'pf1/13pilcgm2oydyogv': expect.stringContaining('PZO1139'),
    'pf1/05i5rxwim12hwktu': expect.stringContaining('PZO9413'),
  });
  expect(launch.namedHolds).toEqual({
    'pf1/0s8w9wfs3ygc21wh': 'spells-516-owner-owed-content-0s8w9wfs3ygc21wh',
  });
  for (const candidate of launchRows) {
    if (!candidate.launchReview) throw new Error(candidate.name);
    await expectPinnedPcgenRows(candidate, candidate.launchReview, {
      pcgenBooks: [candidate.citedSources[0]?.id ?? ''],
    });
    expectLaunchOutcome(candidate, { batch: 516, launch });
    // Every root requires PZO1110 for the core action rules (fix round 1),
    // and every body carries Unchained action costs, so each requires PZO1131.
    expect(candidate.requiredNotices, candidate.name).toContain('PZO1110');
    expect(candidate.requiredNotices, candidate.name).toContain('PZO1131');
    expect(candidate.inheritedRuleNotices?.at(-1)?.book, candidate.name).toBe(
      'PZO1131',
    );
    expectGrantedLevelsBounded(candidate);
    expect(Object.keys(candidate.launchReview.noticeChain)).toEqual(
      candidate.requiredNotices,
    );
  }
  for (const candidate of earlierRows) expectEarlierReview(candidate);
});

it('pins the real values of a CRB, a UC and an ARG body, an omission and both held launch rows (#516 whole-content wave 3)', () => {
  const summon = row("Summon Nature's Ally I");
  expect(summon.row.disposition).toBe('admitted');
  expect(summon.review.pcgen).toMatchObject({
    path: 'data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_spells.lst',
    line: 1344,
    baseRow: { line: 594 },
    wordDifferences: [
      { pinned: '2', pcgen: '6' },
      { pinned: '', pcgen: 'chart not included' },
    ],
  });
  expect(summon.review.notes[0]).toContain('Table 10-2');
  const unerring = row('Unerring Weapon');
  expect(unerring.review.pcgen).toMatchObject({
    path: 'data/pathfinder/paizo/roleplaying_game/ultimate_combat/uc_spells.lst',
    line: 145,
    baseRow: { line: 145 },
    textMatches: true,
  });
  expect(unerring.review.pcgen.literalRow).toMatch(
    /^Unerring Weapon\t.*DESC:[^\t]*\|PRERULE:1,DisplayFullSpell/,
  );
  const trail = row('Fire Trail');
  expect(trail.review.pcgen).toMatchObject({
    path: 'data/pathfinder/paizo/roleplaying_game/advanced_race_guide/arg_spells.lst',
    line: 94,
    baseRow: { line: 94 },
    textMatches: true,
  });
  expect(trail.review.pcgen.literalRow).not.toContain('PRERULE');
  const sleep = row('Symbol of Sleep');
  expect(sleep.row.disposition).toBe('dependently-omitted');
  expect(sleep.row.linkedKeys).toEqual(['pf1/g0x2fnktg1553wv1']);
  expect(sleep.review.pcgen.wordDifferences).toEqual([
    { pinned: 'x', pcgen: '' },
  ]);
  const inhalation = row('Absorbing Inhalation');
  expect(inhalation.row.missingEvidence).toMatch(
    /^spells-516-owner-owed-content-0s8w9wfs3ygc21wh: /,
  );
  expect(inhalation.review.pcgen.wordDifferences).toContainEqual({
    pinned: 'and automatically fail any saving throw to resist it',
    pcgen: '',
  });
  const touch = row('Disfiguring Touch');
  expect(touch.row).toMatchObject({
    disposition: 'held',
    assessmentStatus: 'confirmed',
    noticeRequirementsComplete: false,
    noticeHoldIds: [
      'spells-516-notice-PZO1117-complete-chain',
      'spells-516-notice-PZO1139-complete-chain',
    ],
  });
  expect(touch.review.books).toEqual({ PZO1117: '217', PZO1139: '48' });
  expect(touch.review.noticeChain.PZO1139).toContain('owner-owed');
  expect(reviewedAdmission.registry.PZO1139).toBeUndefined();
});

/** A launch row's granted-level evidence, each with its cited PCGen rows. */
function grantsOf(name: string) {
  return (row(name).review.metadata.grantedLevelEvidence ?? []).map(
    (grant) => ({ ...grant, rows: grant.pcgen ?? [] }),
  );
}

it('bounds Bull’s Strength’s Orc and Animal Trance’s Scalykind mappings with the PCGen pin, holding Bull’s Strength at the gate and admitting Animal Trance on its #716 confirmation (#516 wave 3 fix round 2)', () => {
  const gateHeld = {
    disposition: 'held',
    assessmentStatus: 'confirmed',
    holdIds: [],
    noticeRequirementsComplete: false,
  };
  expect(row("Bull's Strength").row).toMatchObject({
    ...gateHeld,
    requiredNotices: ['PZO1110', 'PZO1115', 'PZO1131', 'PZO9413'],
  });
  const [rage, abyssal, orc] = grantsOf("Bull's Strength");
  expect(
    [rage, abyssal, orc].map((g) => [g?.mapping, g?.status, g?.book]),
  ).toEqual([
    ['subDomain.Rage 2', 'bounded', 'PZO1115'],
    ['bloodline.Abyssal 2', 'bounded', 'PZO1110'],
    ['bloodline.Orc 2', 'bounded', 'PZO9413'],
  ]);
  expect(rage?.rows.map((r) => [r.path.split('/').at(-1), r.line])).toEqual([
    ['apg_spells.lst', 1206],
    ['apg_domains.lst', 60],
  ]);
  expect(orc?.rows[0]).toMatchObject({
    path: 'data/pathfinder/paizo/player_companion/orcs_of_golarion/oog_abilities_class.lst',
    line: 12,
  });
  expect(orc?.rows[0]?.literalRow).toContain(
    "SPELLKNOWN:CLASS|Sorcerer=2|Bull's Strength",
  );
  expect(row("Bull's Strength").review.noticeChain.PZO9413).toContain(
    'owner-owed',
  );
  // PZO9226 has no code-keyed Registry record, but its checked #716 Section 15
  // confirmation covers the book, so the gate admits Animal Trance.
  expect(row('Animal Trance').row).toMatchObject({
    disposition: 'admitted',
    assessmentStatus: 'confirmed',
    holdIds: [],
    noticeHoldIds: [],
    requiredNotices: ['PZO1110', 'PZO1131', 'PZO9226'],
  });
  expect(row('Animal Trance').review.noticeChain.PZO9226).toContain(
    '#716 Section 15 confirmation',
  );
  const [scalykind] = grantsOf('Animal Trance');
  expect(scalykind).toMatchObject({
    mapping: 'domain.Scalykind 2',
    book: 'PZO9226',
    page: '216',
  });
  expect(scalykind?.rows[0]?.literalRow).toContain('Scalykind=2|Animal Trance');
  // Neither code is a Registry key or alias; no notice text is written.
  for (const code of ['PZO9413', 'PZO9226'])
    expect(reviewedAdmission.registry[code]).toBeUndefined();
});

it('bounds the other granted levels with pinned PCGen rows and requires PZO1110 on every root (#516 wave 3 fix round 1)', () => {
  const ventriloquism = row('Ventriloquism');
  expect(ventriloquism.row.disposition).toBe('admitted');
  expect(ventriloquism.row.requiredNotices).toEqual([
    'PZO1110',
    'PZO1117',
    'PZO1131',
  ]);
  expect(grantsOf('Ventriloquism')[0]?.rows[0]?.literalRow).toContain(
    'SPELLKNOWN:CLASS|Sorcerer=1|Ventriloquism',
  );
  // S-03 covers learnedAt.class only.
  for (const candidate of launchRows)
    expect(
      row(candidate.name).review.metadata.levelsDecidedOnOwnEvidence.every(
        (x) => x.startsWith('class.'),
      ),
      candidate.name,
    ).toBe(true);
  const grove = row('Grove of Respite');
  expect(grove.row.requiredNotices).toEqual(['PZO1110', 'PZO1115', 'PZO1131']);
  expect(grove.review.noticeChain.PZO1110).toContain(
    'tiny hut, goodberry and alarm',
  );
});
