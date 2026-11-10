// @vitest-environment node
import { createHash } from 'node:crypto';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { beforeAll, expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import review from '../../scripts/catalog/legal/spells-526.json';
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
import provenance from '../fixtures/spells-526/provenance.json';
import preview from '../fixtures/spells-526/preview.json';
import bindingPreview from '../fixtures/spells-526/binding-preview.json';
import { recordedSpellSheet, spellFixture } from '../fixtures/spells-526/sheet';
import { expectWaveCl5InventoryRow, isWaveCl5Row } from './launch-reassessment';

const keys = review.candidates.map((row) => row.externalKey);
const spells = review.candidates.filter((row) => row.kind === 'spell');
const root = resolve('tests/fixtures/spells-526');
// Wave CL5 (#526, #535 and #546) re-assesses the batch's 15 class-list-only
// Spells in place.
const relaunched = spells.filter((row) => isWaveCl5Row(row));
const whole = (row: { externalKey: string }) =>
  `spells-526-whole-content-${row.externalKey.split('/')[1]}`;
// A wave CL5 row keeps its whole-content hold in its history; every other
// Spell is still held on it.
function expectHoldState(row: (typeof spells)[number]) {
  if (isWaveCl5Row(row)) {
    expect(row.assessmentHistory?.[0]?.holdIds).toEqual([whole(row)]);
    expect(row.holdIds).toEqual([]);
    expect(row.noticeRequirementsComplete).toBe(true);
  } else {
    expect(row.noticeRequirementsComplete).toBe(false);
    expect(row.holdIds).toContain(whole(row));
  }
}
// In the bounded preview, Symbol of Fear and Vanish link Symbol of Death and
// Invisibility outside the selection, so the gate admits the other 13.
const boundedAdmitted = relaunched
  .filter((row) => !['Symbol of Fear', 'Vanish'].includes(row.name))
  .map((row) => row.externalKey)
  .sort();
const inputs = {
  systemPath: join(root, 'pf1'),
  contentPath: join(root, 'pf1-content'),
  remaps: bindingPreview.remaps,
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

it('reconciles 100 pinned keys as 99 Spells and one excluded folder', async () => {
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(sha256(keys.join('\n'))).toBe(provenance.orderedTicketKeysSha256);
  expect(provenance.rawSources.map((row) => row.externalKey)).toEqual(keys);
  // Wave CL5 admits the batch's 15 class-list-only Spells.
  expect(review.summary).toMatchObject({
    rawCandidates: 100,
    admitted: 15,
    held: 84,
    dependentOmissions: 0,
    unsupportedProseOnly: 0,
    excluded: 1,
    recordLevel35Holds: 0,
  });
  expect(spells).toHaveLength(99);
  const folder = review.candidates.find((row) => row.kind === 'folder');
  expect(folder).toMatchObject({
    externalKey: 'pf1/bpvgbh1VDSwajuKr',
    name: 'Universal',
    disposition: 'excluded',
    contractReason: expect.stringContaining('Folder'),
  });
  expect(
    bounded.catalog.entries.some(
      (row) => row.externalKey === folder?.externalKey,
    ),
  ).toBe(false);
  for (const row of [...provenance.rawSources, ...provenance.dependencies]) {
    expect(
      sha256(await readFile(join(inputs.systemPath, row.path), 'utf8')),
      row.path,
    ).toBe(row.sha256);
  }
  for (const row of provenance.manifests) {
    const source = row.repo === 'pf1' ? inputs.systemPath : inputs.contentPath;
    expect(sha256(await readFile(join(source, row.path), 'utf8'))).toBe(
      row.sha256,
    );
  }
});

it('binds every complete description, action, class list and raw source without adding recorded-Spell Modifiers', async () => {
  for (const row of spells) {
    const raw = upstreamRecord.parse(
      parse(await readFile(join(inputs.systemPath, row.source.path), 'utf8')),
    );
    expect(raw.type).toBe('spell');
    expect(sha256(sourceDescription(raw))).toBe(row.descriptionSha256);
    expect(row.mechanicsReview?.metadata.actions).toEqual(raw.system.actions);
    expect(row.citedSources).toEqual(raw.system.sources);
    expect(row.learnedAt).toEqual(raw.system.learnedAt);
    const record = reviewedCuration.records.find(
      (item) =>
        item.externalKey === row.externalKey && item.kind === 'description',
    );
    expect(record).toMatchObject({
      status: 'checked',
      text: sourceDescription(raw),
      textSha256: row.descriptionSha256,
      reviewedBy: 'Sol (AI curator) for the owner',
      reviewedOn: [
        'Boiling Blood',
        'Planned Assault',
        'Anchored Step',
      ].includes(row.name)
        ? '2026-10-09'
        : '2026-10-08',
    });
    expect(record?.outputs.every((item) => item.kind === 'note')).toBe(true);
    expect(
      record?.diagnostics
        .filter((item) => item.kind === 'unresolved')
        .map((item) => item.text),
    ).toEqual(row.mechanicsReview?.descriptionRecord.unresolved);
    expectHoldState(row);
    expect(reviewedAdmission.evidence[row.evidenceId ?? '']?.content).toContain(
      row.source.sha256,
    );
  }
  expect(
    bounded.catalog.entries.every((entry) => entry.modifiers.length === 0),
  ).toBe(true);
});

it('replays the bounded preview with complete prose review and separate outstanding running mechanics', () => {
  expect(bounded.catalog.entries).toEqual(preview.entries);
  expect(bounded.comparison.summary).toMatchObject({
    upstreamRecords: 100,
    admitted: 99,
    excluded: 1,
    unassigned: 0,
  });
  expect(bounded.curation.passed).toBe(true);
  expect(bounded.curation.summary).toMatchObject({
    required: 0,
    missing: 0,
    descriptions: { candidates: 99, checked: 99, drafted: 0 },
  });
  expect(bounded.curation.unresolvedMechanics).toEqual([]);
  expect(bounded.curation.unresolvedDescriptions).toHaveLength(
    review.mechanicsSummary.outstandingDescriptionsInCurationReport,
  );
  expect(
    spells.filter((row) => row.mechanicsReview?.outstanding.length),
  ).toHaveLength(68);
  const gate = assessCatalogAdmission({
    artifact: bounded,
    ...reviewedAdmission,
  });
  // The committed preview predates wave CL5: its 13 admitted rows were held.
  // Symbol of Fear and Vanish still fail on their links outside the selection.
  expect(gate.admitted.map((row) => row.externalKey).sort()).toEqual(
    boundedAdmitted,
  );
  expect(gate.held).toHaveLength(preview.admissionCounts.held - 13);
  expect(gate.failures).toHaveLength(preview.admissionCounts.failures);
  expect(
    gate.failures.every((row) =>
      row.reason.startsWith('Broken structure or reference:'),
    ),
  ).toBe(true);
  expect(
    [
      ...new Set(
        [
          ...gate.admitted,
          ...gate.held,
          ...gate.failures,
          ...gate.dependentOmissions,
        ].map((row) => row.externalKey),
      ),
    ].sort(),
  ).toEqual(spells.map((row) => row.externalKey).sort());
});

it('replays full-source closure and validates the 84 whole-content assessment bindings', () => {
  const sorted = (entries: { externalKey: string }[]) =>
    [...entries].sort((a, b) => a.externalKey.localeCompare(b.externalKey));
  expect(sorted(fullContext.catalog.entries)).toEqual(
    sorted(bindingPreview.entries),
  );
  expect(fullContext.catalog.resources).toEqual(bindingPreview.resources);
  for (const row of spells) {
    const entry = fullContext.catalog.entries.find(
      (item) => item.externalKey === row.externalKey,
    );
    const assessment = reviewedAdmission.assessments.find(
      (item) => item.externalKey === row.externalKey,
    );
    if (!entry || !assessment)
      throw new Error(`Missing full-context Spell ${row.externalKey}`);
    // Wave CL5's rows bind against their full-corpus closure, as the gate
    // does (expectWaveCl5InventoryRow replays them).
    if (isWaveCl5Row(row)) continue;
    expect(assessment).toMatchObject({
      status: 'unresolved',
      requiredNotices: row.requiredNotices,
      reviewedBy: 'Sol (AI curator) for the owner',
      reviewedOn: row.reviewedOn,
    });
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
  // With their closures present, wave CL5's 15 rows are admitted.
  expect(
    gate.admitted
      .filter((row) => keys.includes(row.externalKey))
      .map((row) => row.externalKey)
      .sort(),
  ).toEqual(relaunched.map((row) => row.externalKey).sort());
  expect(
    gate.held.filter((row) => keys.includes(row.externalKey)),
  ).toHaveLength(bindingPreview.admissionCounts.held - 15);
  expect(
    gate.failures.filter((row) => keys.includes(row.externalKey)),
  ).toHaveLength(bindingPreview.admissionCounts.failures);
});

it('enforces every notice-chain hold and recorded inherited notice, preserving existing registry identities', () => {
  expect(review.noticeRequirements).toHaveLength(43);
  expect(review.noticeRequirements.filter((row) => row.holdId)).toHaveLength(
    42,
  );
  for (const requirement of review.noticeRequirements) {
    if (!requirement.holdId) continue;
    expect(
      heldNotices.find((row) => row.id === requirement.holdId),
    ).toMatchObject({
      notices: expect.arrayContaining([
        requirement.book,
        ...requirement.registryKeys,
      ]),
      evidence: expect.arrayContaining([
        'scripts/catalog/legal/spells-526.json',
      ]),
    });
  }
  for (const row of spells) {
    expect(row.requiredNotices).toEqual(
      expect.arrayContaining(
        row.inheritedRuleNotices?.map((item) => item.book) ?? [],
      ),
    );
    for (const inherited of row.inheritedNoticeReview ?? [])
      expect(sha256(inherited.evidence)).toBe(inherited.evidenceSha256);
  }
});

it.each([
  ['Sense Spirit Magic', 'PZO1129', 'primary spirit'],
  ['Bouncing Bomb Admixture', 'PZO1115', 'next bomb'],
  ['Undetectable Trap', 'PZO1117', 'ranger traps'],
  ['Summon Lesser Demon', 'PZO1120', 'Bestiary 3'],
  ['Summon Lesser Demon', 'PZO9225', 'Lords of Chaos'],
  ['Shambler', 'PZO1112', 'advanced template'],
  ['Spirit-Bound Blade', 'PZO1123', 'mimetic'],
  ['Alleviate Addiction', 'PZO1114', 'addictions'],
] as const)('%s includes inherited %s rule evidence', (name, book, phrase) => {
  const row = spells.find((row) => row.name === name);
  expect(row?.requiredNotices).toContain(book);
  expect(
    row?.inheritedNoticeReview?.some(
      (item) => item.book === book && item.evidence.includes(phrase),
    ),
  ).toBe(true);
});

it.each([
  ['Dissolution', 'miracle', 'wish'],
  ['Deathwine', 'detect magic', 'cure serious wounds'],
  ['Halfling Vengeance, Mass', 'sneak attack', 'attacks of opportunity'],
] as const)(
  '%s retains its observed inherited CRB minima',
  (name, first, second) => {
    const row = spells.find((item) => item.name === name);
    const assessment = reviewedAdmission.assessments.find(
      (item) => item.externalKey === row?.externalKey,
    );
    expect(row?.inheritedRuleNotices).toContainEqual(
      expect.objectContaining({ book: 'PZO1110' }),
    );
    expect(assessment?.requiredNotices).toContain('PZO1110');
    const quotes = row?.inheritedNoticeReview
      ?.filter((item) => item.book === 'PZO1110')
      .map((item) => item.evidence)
      .join(' ');
    expect(quotes).toContain(first);
    expect(quotes).toContain(second);
    expect(row?.disposition).toBe('held');
    expect(assessment?.status).toBe('unresolved');
    if (name === 'Halfling Vengeance, Mass') {
      expect(quotes).toContain('is flanked by the target');
      expect(
        row?.inheritedNoticeReview?.filter((item) => item.book === 'PZO1110'),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sourceLocation: expect.stringContaining(
              'halfling-vengeance.2js46u3c4e2oxvyl.yaml',
            ),
          }),
        ]),
      );
    }
  },
);

it('checks the consistency audit against exact pinned descriptions and PCGen CRB evidence', async () => {
  // The batch's own review recorded 110; wave CL5 adds 19 (below).
  expect(review.mechanicsSummary.inheritedNoticeDependencies).toBe(110);
  expect(review.reviewFixRound1).toMatchObject({
    addedInheritedDependencies: 19,
    addedRequiredCrbNotices: 17,
    reviewedBy: 'Sol (AI curator) for the owner',
    reviewedOn: '2026-10-09',
  });
  expect(review.reviewFixRound1.affectedDependencyKeys).toHaveLength(19);
  expect(
    spells.reduce(
      (total, row) => total + (row.inheritedRuleNotices?.length ?? 0),
      0,
    ),
    // Wave CL5 adds 19: PZO1131 on its 15 rows, PZO1110 on Marid's Mastery,
    // Evolution Surge, Lesser and Boiling Blood, and PZO1112 on Steal Breath.
  ).toBe(129);
  for (const key of review.reviewFixRound1.affectedDependencyKeys) {
    const row = spells.find((item) => item.externalKey === key);
    expect(row?.requiredNotices).toContain('PZO1110');
    for (const item of row?.inheritedNoticeReview ?? []) {
      if (!('originEvidence' in item)) continue;
      const path = item.sourceLocation
        .split('/418761d2e16a6037c0156bb4a241f7cea5a2986d/')[1]
        ?.split('#')[0];
      if (!path) throw new Error(`Missing pinned quote location: ${key}`);
      const raw = upstreamRecord.parse(
        parse(await readFile(join(inputs.systemPath, path), 'utf8')),
      );
      expect(sourceDescription(raw)).toContain(item.evidence);
      const origins = z
        .array(
          z.object({
            sourceLocation: z.string(),
            rowSha256: z.string(),
            evidenceKey: z.string(),
          }),
        )
        .parse(item.originEvidence);
      for (const origin of origins) {
        const retained = Object.values(review.inheritedCrbRuleEvidence).find(
          (record) => record.rowSha256 === origin.rowSha256,
        );
        expect(retained?.source).toContain(
          '/25523dbcf10e86c280fc0f447167ea43d67419d3/',
        );
        expect(retained?.source).toContain('/core_rulebook/');
        expect(sha256(retained?.text ?? '')).toBe(origin.rowSha256);
      }
    }
  }
  const crb = review.noticeRequirements.find((row) => row.book === 'PZO1110');
  expect(crb).toMatchObject({
    status: 'existing-reviewed-notice',
    holdId: null,
  });
});

it('shows readable Note spacing and both literal Planned Assault disagreements', () => {
  const note = (name: string) => spellFixture(name).situationalNotes?.[0]?.text;
  expect(note('Boiling Blood')).toBe(
    'Failed Fort causes 1 fire damage/round if blood present; orc-subtype target instead gains +2 morale Strength and no fire damage.',
  );
  expect(note('Anchored Step')).toContain('speed -10 feet minimum 5');
  expect(note('Planned Assault')).toContain('After 1 minute');
  expect(note('Planned Assault')).toContain('+4 at CL 10, +6 at CL 15');
  expect(note('Planned Assault')).toContain('for 1 hour');
  expect(note('Planned Assault')).toContain('all actions rather than checks');
  const spell = spellFixture('Planned Assault');
  const evidence = review.reviewFixRound1.plannedAssaultEvidence;
  expect(spell.description).toContain(evidence.mainRuleQuote);
  expect(spell.description).toContain(evidence.exampleQuote);
  const row = spells.find((item) => item.name === spell.name);
  expect(row?.mechanicsReview?.discrepancies.join(' ')).toContain('"checks"');
  expect(row?.mechanicsReview?.discrepancies.join(' ')).toContain(
    '"all actions"',
  );
  expect(row?.disposition).toBe('held');
});

it('invalidates Greater Magic Fang’s binding when its inherited Magic Fang changes', () => {
  const artifact = structuredClone(fullContext);
  const spell = artifact.catalog.entries.find(
    (row) => row.name === 'Magic Fang, Greater',
  );
  const inherited = artifact.catalog.entries.find(
    (row) => row.name === 'Magic Fang',
  );
  const assessment = reviewedAdmission.assessments.find(
    (row) => row.externalKey === spell?.externalKey,
  );
  if (!spell || !inherited || !assessment)
    throw new Error('Missing Magic Fang closure');
  inherited.description += ' Changed inherited enhancement.';
  expect(
    buildAssessmentBinding({
      entry: spell,
      artifact,
      ...reviewedAdmission,
      requiredNotices: assessment.requiredNotices,
      evidenceIds: Object.keys(assessment.evidenceFingerprints),
    }).contentFingerprint,
  ).not.toBe(assessment.contentFingerprint);
});

it.each([
  ['Perceive Cues', 'alchemist', 2, 'PZO1115', '235', '+5 competence bonus'],
  ['Mind Blank', 'wizard', 8, 'PZO1110', '313', '+8 resistance bonus'],
  ['Anchored Step', 'wizard', 3, 'PZO1129', '173', 'minimum of 5 feet'],
  [
    'Boiling Blood',
    'wizard',
    2,
    'PZO1117',
    '209',
    '+2 morale bonus to Strength',
  ],
] as const)(
  '%s preserves literal rules and recorded level through the public resolver',
  (name, classTag, level, book, pages, phrase) => {
    const spell = spellFixture(name);
    expect(spell.detail.levels[classTag]).toBe(level);
    expect(spell.sources).toContainEqual({ book, pages });
    expect(spell.description.replace(/<[^>]+>/g, '')).toContain(phrase);
    const input = recordedSpellSheet(name, classTag);
    const actual = calculateCharacterSheetProjections(input);
    const baseline = calculateCharacterSheetProjections({
      ...input,
      entries: input.entries.filter((row) => row.kind !== 'spell'),
    });
    for (const projection of ['current', 'permanent'] as const) {
      expect(actual[projection].abilities).toEqual(
        baseline[projection].abilities,
      );
      expect(actual[projection].derivedStatistics).toEqual(
        baseline[projection].derivedStatistics,
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

it('uses shared Situations and preserves the ground gate rather than implying unconditional CMD', () => {
  const spell = spellFixture('Anchored Step');
  for (const key of ['bullRushGround', 'tripGround', 'overrun', 'reposition'])
    expect(
      spell.situationalNotes?.some(
        (row) => row.situation === key && row.text.includes('touching ground'),
      ),
    ).toBe(true);
  expect(spell.modifiers).toEqual([]);
  const positive = spellFixture('Positive Pulse');
  expect(positive.situationalNotes?.map((row) => row.situation)).toEqual([
    undefined,
    'death',
    'negativeEnergy',
    { local: 'vs. energy drain' },
    { local: 'vs. haunts' },
  ]);
});

it('preserves 7 source disagreements without silently fixing dice, bonus types or range', () => {
  const byName = (name: string) =>
    spells.find((row) => row.name === name)?.mechanicsReview;
  expect(
    spells.filter((row) => row.mechanicsReview?.discrepancies.length),
  ).toHaveLength(7);
  expect(byName('Dissolution')?.manualRules).toContain('1d0');
  expect(byName('Planned Assault')?.discrepancies.join(' ')).toContain(
    'sacred',
  );
  expect(
    byName('Spellcasting Contract, Lesser')?.discrepancies.join(' '),
  ).toContain('example');
  expect(byName("Dragon's Breath")?.metadata.actions?.[1]).toMatchObject({
    range: { value: '30' },
    measureTemplate: { size: '30', type: 'ray' },
  });
  expect(byName("Dragon's Breath")?.manualRules).toContain('60-foot line');
  expect(byName('Litany of Thunder')?.manualRules).toContain(
    'until the condition is removed',
  );
});

it('keeps nine previously landed inherited-context entries byte-equivalent at extraction', () => {
  const covered = spells.filter(
    (row) => row.mechanicsReview?.descriptionRecord.coveredByDescription,
  );
  expect(covered).toHaveLength(9);
  expect(
    covered.filter((row) => row.mechanicsReview?.outstanding.length),
  ).toHaveLength(6);
  for (const row of covered)
    expect(row.mechanicsReview?.descriptionRecord).toMatchObject({
      outputCount: 0,
      unresolved: [],
    });
});

it('retains all 23 literal PCGen comparisons, with partial equality separate from admission', () => {
  const compared = spells.filter((row) => row.comparison);
  expect(compared).toHaveLength(23);
  expect(
    compared.filter(
      (row) => row.comparison?.descriptionMatchesAfterPresentationNormalization,
    ),
  ).toHaveLength(18);
  for (const row of compared) {
    if (!row.comparison) throw new Error('Missing comparison');
    expect(sha256(row.comparison.text)).toBe(row.comparison.lineSha256);
    expect(row.comparison.description.length).toBeGreaterThan(0);
    // Partial equality never admitted a row; wave CL5's whole-body
    // re-assessment confirms its own.
    expect(row.assessmentStatus).toBe(
      isWaveCl5Row(row) ? 'confirmed' : 'unresolved',
    );
  }
});

it('invalidates Perceive Cues checked prose after a real numeric change', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'spells-526-change-'));
  try {
    await cp(root, temporary, { recursive: true });
    const row = spells.find((row) => row.name === 'Perceive Cues');
    if (!row) throw new Error('Missing Perceive Cues');
    const path = join(temporary, 'pf1', row.source.path);
    await writeFile(path, (await readFile(path, 'utf8')).replace('+5', '+6'));
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
    // The stale row is no longer admitted; wave CL5's other rows still are.
    expect(
      assessCatalogAdmission({ artifact: changed, ...reviewedAdmission })
        .admitted.map((item) => item.externalKey)
        .sort(),
    ).toEqual(boundedAdmitted.filter((key) => key !== row.externalKey));
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

// Wave CL5 (#526, #535 and #546): the batch's 15 class-list-only Spells, each
// with its exact required notices.
const WAVE_CL5_ROWS = [
  ['Mount', ['PZO1110', 'PZO1112', 'PZO1131']],
  ["Marid's Mastery", ['PZO1121', 'PZO1110', 'PZO1131']],
  ['Feather Step', ['PZO1115', 'PZO1110', 'PZO1131']],
  ['Steal Breath', ['PZO1121', 'PZO1110', 'PZO1112', 'PZO1131']],
  ['Twilight Knife', ['PZO1115', 'PZO1110', 'PZO1131']],
  ['Perceive Cues', ['PZO1115', 'PZO1110', 'PZO1131']],
  ['Symbol of Fear', ['PZO1110', 'PZO1131']],
  ['Simulacrum', ['PZO1110', 'PZO1131']],
  ['Curse Water', ['PZO1110', 'PZO1131']],
  ['Vanish', ['PZO1115', 'PZO1110', 'PZO1131']],
  ['Sequester', ['PZO1110', 'PZO1131']],
  ['Planar Ally, Lesser', ['PZO1110', 'PZO1131']],
  ['Evolution Surge, Lesser', ['PZO1115', 'PZO1110', 'PZO1131']],
  ['Boiling Blood', ['PZO1117', 'PZO1112', 'PZO1110', 'PZO1131']],
  ['Cast Out', ['PZO1115', 'PZO1112', 'PZO1110', 'PZO1131']],
] as const;

it.each(WAVE_CL5_ROWS)(
  're-assesses %s in place against the literal pinned PCGen rows (wave CL5)',
  async (name, requiredNotices) => {
    const row = review.candidates.find((item) => item.name === name);
    if (row?.citedSources === undefined) throw new Error(`Missing ${name}`);
    await expectWaveCl5InventoryRow(row, {
      batch: 526,
      launch: review.launchReassessment,
      requiredNotices: [...requiredNotices],
    });
  },
);

it('records wave CL5 in place: 15 admitted, the other 84 Spells keep their holds', () => {
  expect(relaunched.map((row) => row.name)).toEqual(
    WAVE_CL5_ROWS.map(([name]) => name),
  );
  expect(review.launchReassessment).toMatchObject({
    admittedKeys: relaunched.map((row) => row.externalKey),
    dependentlyOmittedKeys: [],
    namedHolds: {},
  });
  for (const row of spells.filter((item) => !isWaveCl5Row(item)))
    expect(row.holdIds, row.name).toContain(whole(row));
  const readings = (name: string) =>
    review.candidates.find((row) => row.name === name)?.launchReview as
      | { notes: string[]; metadata: { readings: string } }
      | undefined;
  // Mount: Foundry's Bestiary pointer is a recorded wording difference.
  expect(readings('Mount')?.notes[0]).toContain(
    'see the Pathfinder RPG Bestiary',
  );
  // Steal Breath suppresses breath weapons: the Bestiary rule's book.
  expect(readings('Steal Breath')?.notes.join(' ')).toContain('breath weapon');
  // Boiling Blood: Foundry's dismiss flag with no PCGen [D] is named.
  expect(readings('Boiling Blood')?.metadata.readings).toContain(
    "Dismissal: Foundry's duration carries the dismiss flag",
  );
});

type Cl5Metadata = {
  readings: string;
  fields: Record<string, { pinned: unknown }>;
};
function cl5Metadata(name: string) {
  const row = review.candidates.find((item) => item.name === name);
  if (row === undefined) throw new Error(`Missing ${name}`);
  return (row.launchReview as unknown as { metadata: Cl5Metadata }).metadata;
}

// readings-fix (CL5 review r1 #1): each retained non-notational metadata
// difference is named; the pinned fields stay.
it.each([
  [
    'Steal Breath',
    [
      'Target: Foundry "one living creature", PCGen\'s base row TARGETAREA:One creature',
      "Duration: Foundry 1 round (see text), PCGen's base row DURATION:(CASTERLEVEL) rounds",
    ],
  ],
  [
    'Sequester',
    [
      "Spell resistance: PCGen's base row SPELLRES:No or yes (object) against Foundry's single no",
      "Dismissal: PCGen's base row DURATION:(CASTERLEVEL) days [D]",
    ],
  ],
  [
    'Symbol of Fear',
    [
      "Descriptors: Foundry also lists emotion, which PCGen's base row DESCRIPTOR:Fear|Mind-Affecting does not",
      "Casting time: Foundry 10 minutes (activation type minute, cost 10); PCGen's base row has no CASTTIME tag",
    ],
  ],
])(
  'names the retained metadata differences of %s (readings-fix)',
  (name, parts) => {
    const { readings } = cl5Metadata(name);
    for (const part of parts) expect(readings).toContain(part);
    expect(readings).toContain('The fields not named above agree');
  },
);

it('keeps the pinned fields the readings-fix readings name', () => {
  expect(cl5Metadata('Steal Breath').fields.duration?.pinned).toBe(
    '{"units": "spec", "value": "1 round (see text)"}',
  );
  expect(cl5Metadata('Sequester').fields.spellResistance?.pinned).toBe('no');
});
