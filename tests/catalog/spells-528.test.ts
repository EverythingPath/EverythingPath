// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { beforeAll, expect, it } from 'vitest';
import { parse } from 'yaml';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { importCatalog } from '../../scripts/catalog/import';
import { buildAssessmentBinding } from '../../scripts/catalog/admission';
import {
  sourceDescription,
  upstreamRecord,
} from '../../scripts/catalog/records';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import { calculateCharacterSheetProjections } from '../../src/lib/character-sheet';
import {
  review,
  spells,
  preview,
  bindingPreview,
  provenance,
  preserved,
  bibliography,
} from '../fixtures/spells-528/data';
import { recordedSpellSheet, spellFixture } from '../fixtures/spells-528/sheet';
import {
  findCommittedBatchOwnershipProblems,
  findRecordedBindingProblems,
  findCitedNoticeProblems,
} from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';
const root = resolve('tests/fixtures/spells-528');
const keys = review.candidates.map((row) => row.externalKey);
const hash = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex');
const inputs = {
  systemPath: join(root, 'pf1'),
  contentPath: join(root, 'pf1-content'),
  remaps: bindingPreview.remaps,
  curation: reviewedCuration,
};
let bounded: Awaited<ReturnType<typeof importCatalog>>;
let complete: Awaited<ReturnType<typeof importCatalog>>;
beforeAll(async () => {
  bounded = await importCatalog({ ...inputs, candidateKeys: keys });
  complete = await importCatalog({
    ...inputs,
    candidateKeys: bindingPreview.entries.map((row) => row.externalKey),
  });
});
it('reconciles 100 exact ticket keys, 99 held Spells and a folder without excluding the 3.5 Spell', async () => {
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(hash(keys.join('\n'))).toBe(
    '3b45ea4cf1b8b8a2d141886d0675c6e7f10139a6f1d54bcc8a6b79f713219ea6',
  );
  expect(provenance.orderedTicketKeysSha256).toBe(hash(keys.join('\n')));
  expect(review.summary).toMatchObject({
    rawCandidates: 100,
    spellDefinitions: 99,
    held: 99,
    admitted: 0,
    excluded: 1,
    dependentOmissions: 0,
    recordLevel35Holds: 1,
  });
  expect(
    review.candidates.find((row) => row.externalKey === 'pf1/eZeI98zuA6EzppaG'),
  ).toMatchObject({
    name: 'Divination',
    kind: 'folder',
    rawType: 'Item',
    rawKey: '!folders!eZeI98zuA6EzppaG',
    disposition: 'excluded',
  });
  expect(spells.find((row) => row.name === 'Shield Speech')?.holdIds).toContain(
    'spells-528-Shield-Speech-record-level3.5tag',
  );
  for (const row of [...provenance.rawSources, ...provenance.dependencies])
    expect(
      hash(await readFile(join(inputs.systemPath, row.path))),
      row.path,
    ).toBe(row.sha256);
  for (const row of provenance.manifests)
    expect(
      hash(
        await readFile(
          join(
            row.repo === 'pf1' ? inputs.systemPath : inputs.contentPath,
            row.path,
          ),
        ),
      ),
    ).toBe(row.sha256);
  for (const row of provenance.comparisonFiles)
    expect(hash(await readFile(join(root, row.path)))).toBe(row.sha256);
});
it('binds all 99 complete descriptions and action metadata with no ordinary Spell Modifiers', async () => {
  for (const row of spells) {
    const raw = upstreamRecord.parse(
      parse(await readFile(join(inputs.systemPath, row.source.path), 'utf8')),
    );
    expect(raw.type).toBe('spell');
    expect(hash(sourceDescription(raw))).toBe(row.descriptionSha256);
    expect(row.citedSources).toEqual(raw.system.sources);
    expect(row.learnedAt).toEqual(raw.system.learnedAt);
    expect(row.mechanicsReview.metadata.actions).toEqual(raw.system.actions);
    const record = reviewedCuration.records.find(
      (item) =>
        item.externalKey === row.externalKey && item.kind === 'description',
    );
    expect(record).toMatchObject({
      status: 'checked',
      text: sourceDescription(raw),
      reviewedBy: 'Sol (AI curator) for the owner',
      reviewedOn: '2026-10-09',
    });
    expect(record?.outputs.every((item) => item.kind === 'note')).toBe(true);
    expect(
      record?.diagnostics
        .filter((item) => item.kind === 'unresolved')
        .map((item) => item.text),
    ).toEqual(row.mechanicsReview.descriptionRecord.unresolved);
    expect(row.noticeRequirementsComplete).toBe(false);
    expect(row.holdIds).toContain(`spells-528-whole-content-${raw._id}`);
    expect(reviewedAdmission.evidence[row.evidenceId]?.content).toContain(
      row.source.sha256,
    );
  }
});
it('reproduces bounded output and complete-context admission, keeping required coverage separate from missing effects', () => {
  expect(bounded.catalog.entries).toEqual(preview.entries);
  expect(bounded.curation.passed).toBe(true);
  expect(bounded.curation.summary.required).toBe(0);
  expect(bounded.curation.summary.missing).toBe(0);
  expect(bounded.curation.summary.descriptions.checked).toBe(99);
  expect(bounded.curation.unresolvedMechanics).toEqual([]);
  expect(bounded.curation.unresolvedDescriptions.length).toBeGreaterThan(0);
  const byKey = (rows: { externalKey: string }[]) =>
    [...rows].sort((a, b) => a.externalKey.localeCompare(b.externalKey));
  expect(byKey(complete.catalog.entries)).toEqual(
    byKey(bindingPreview.entries),
  );
  expect(complete.catalog.resources).toEqual(bindingPreview.resources);
  const boundedGate = assessWithUnclearedHolds({
    artifact: bounded,
    ...reviewedAdmission,
  });
  expect(boundedGate.admitted).toEqual([]);
  expect(boundedGate.failures.length).toBe(preview.admissionCounts.failures);
  expect(
    boundedGate.failures.every((row) =>
      row.reason.startsWith('Broken structure or reference:'),
    ),
  ).toBe(true);
  const gate = assessWithUnclearedHolds({
    artifact: complete,
    ...reviewedAdmission,
  });
  expect(gate.failures).toEqual([]);
  expect(gate.admitted).toEqual([]);
  expect(
    gate.held.filter((row) => keys.includes(row.externalKey)),
  ).toHaveLength(99);
});
it('validates individual current assessment bindings and notice dependencies, with the tag hold named in admission', () => {
  for (const row of spells) {
    const entry = complete.catalog.entries.find(
      (item) => item.externalKey === row.externalKey,
    );
    const assessment = reviewedAdmission.assessments.find(
      (item) => item.externalKey === row.externalKey,
    );
    if (!entry || !assessment) throw new Error(`Missing ${row.externalKey}`);
    expect(assessment).toMatchObject({
      status: 'unresolved',
      requiredNotices: row.requiredNotices,
      ...buildAssessmentBinding({
        entry,
        artifact: complete,
        ...reviewedAdmission,
        requiredNotices: row.requiredNotices,
        evidenceIds: [row.evidenceId],
      }),
    });
    for (const dep of row.inheritedRuleNotices)
      expect(row.requiredNotices).toContain(dep.book);
    for (const dep of row.inheritedNoticeReview) {
      expect(hash(dep.evidence)).toBe(dep.evidenceSha256);
      expect(row.requiredNotices).toContain(dep.book);
    }
  }
  const gate = assessWithUnclearedHolds({
    artifact: complete,
    ...reviewedAdmission,
  });
  expect(
    gate.held.find((row) => row.externalKey === 'pf1/ecfp8vGjgZevbTJi')?.reason,
  ).toContain('record-level3.5tag');
});
it('keeps every live assessment current with its complete-context binding and recorded content snapshot', () => {
  expect(spells).toHaveLength(99);
  for (const row of spells) {
    const assessment = reviewedAdmission.assessments.find(
      (item) => item.externalKey === row.externalKey,
    );
    const entry = complete.catalog.entries.find(
      (item) => item.externalKey === row.externalKey,
    );
    if (!assessment || !entry) throw new Error(`Missing ${row.externalKey}`);
    expect(
      Object.keys(assessment.evidenceFingerprints),
      row.externalKey,
    ).toEqual([row.evidenceId]);
    expect(assessment.requiredNotices, row.externalKey).toEqual(
      row.requiredNotices,
    );
    const current = buildAssessmentBinding({
      entry,
      artifact: complete,
      ...reviewedAdmission,
      requiredNotices: row.requiredNotices,
      evidenceIds: [row.evidenceId],
    });
    expect(assessment, row.externalKey).toMatchObject(current);
    expect(
      findRecordedBindingProblems({
        recorded: row.binding,
        current,
        evidenceId: row.evidenceId,
      }),
      row.externalKey,
    ).toEqual([]);
  }
});
it('binds every inherited quote to the exact complete pinned source body', async () => {
  const sources = new Map<string, { file: Buffer; description: string }>();
  for (const row of spells.flatMap((item) => item.inheritedNoticeReview)) {
    const path = new URL(row.sourceLocation).pathname.slice(
      new URL(row.sourceLocation).pathname.indexOf('/packs/') + 1,
    );
    let source = sources.get(path);
    if (source === undefined) {
      const file = await readFile(join(inputs.systemPath, path));
      source = {
        file,
        description: sourceDescription(
          upstreamRecord.parse(parse(file.toString())),
        ),
      };
      sources.set(path, source);
    }
    expect(hash(source.file), path).toBe(row.sourceFileSha256);
    expect(hash(source.description), path).toBe(row.sourceDescriptionSha256);
    expect(source.description, path).toContain(row.evidence);
  }
});
it('enforces exact known Registry identities including APG without approving complete chains', () => {
  const apg =
    'pf1-content/notice/7d75468ec859d3452bcef8458792e6ef19c7aafcf9cbaf2f759fdf4bc923b2a2';
  expect(
    review.noticeRequirements.find((row) => row.book === 'PZO1115')
      ?.registryKeys,
  ).toContain(apg);
  for (const row of review.noticeRequirements) {
    if (row.book === 'PZO1110') {
      expect(row.holdId).toBeNull();
      expect(row.registryKeys).toEqual(['CRB']);
    } else
      expect(heldNotices.find((item) => item.id === row.holdId)).toMatchObject({
        notices: [row.book, ...row.registryKeys],
        evidence: ['scripts/catalog/legal/spells-528.json'],
      });
    for (const notice of row.registryIdentityEvidence)
      expect(findCitedNoticeProblems(notice), notice.key).toEqual([]);
  }
});
it.each([
  ['Spawn Calling', ['PZO1110', 'PZO1112', 'PZO1116', 'PZO1120']],
  [
    'Draconic Ally',
    ['PZO1110', 'PZO1112', 'PZO1116', 'PZO1120', 'PZO1127', 'PZO1133'],
  ],
  ['Purify Body', ['PZO1110', 'PZO1115', 'PZO1129']],
  ['Slowing Mud', ['PZO1110', 'PZO1115']],
  ['Imbue with Addiction', ['PZO1110']],
  ['Wither Limb', ['PZO1110']],
  ['Distressing Tone', ['PZO1110']],
] as const)('retains the supported inherited minima for %s', (name, books) => {
  const row = spells.find((item) => item.name === name);
  for (const book of books) expect(row?.requiredNotices).toContain(book);
  expect(row?.fullContentReview.unresolvedOrigins.length).toBeGreaterThan(0);
});
it('pins advanced and entropic templates to their actual PCGen publication declarations', async () => {
  const lines = (
    await readFile(join(root, 'comparison/ce_templates.lst'), 'utf8')
  ).split('\n');
  expect(lines[1029]).toMatch(/^SOURCELONG:Bestiary\tSOURCESHORT:B1/);
  expect(lines[1035]).toContain('SOURCEPAGE:p.294');
  expect(lines[1058]).toMatch(/^SOURCELONG:Bestiary 2\tSOURCESHORT:B2/);
  expect(lines[1065]).toContain('SOURCEPAGE:p.292');
  for (const row of review.inheritedRuleIdentityEvidence.pcgenRows) {
    const text = (await readFile(join(root, row.source), 'utf8')).split('\n')[
      row.line - 1
    ];
    expect(text).toBe(row.text);
    expect(hash(text ?? '')).toBe(row.textSha256);
  }
});
it('requires and enforces literal Bestiary 5 without substituting Bestiary 6', async () => {
  expect(bibliography.source).toEqual(provenance.bibliography);
  for (const quote of bibliography.quotes)
    expect(hash(quote.text)).toBe(quote.sha256);
  expect(bibliography.quotes.find((row) => row.line === 163)?.text).toBe(
    '      _id: "PZO1133",\n      name: "Bestiary 5",',
  );
  expect(bibliography.quotes.find((row) => row.line === 172)?.text).toBe(
    '      _id: "PZO1137",\n      name: "Bestiary 6",',
  );
  const ally = spells.find((row) => row.name === 'Draconic Ally');
  const body = ally?.fullContentReview.linkedContentReview.find(
    (row) => row.name === 'Form of the Alien Dragon I',
  )?.descriptionText;
  expect(body).toContain('Pathfinder RPG Bestiary 5 pg. 297');
  expect(body).toContain('Bestiary 5 90');
  expect(ally?.inheritedNoticeReview).toContainEqual(
    expect.objectContaining({ book: 'PZO1133', evidence: 'Bestiary 5' }),
  );
  expect(ally?.requiredNotices).not.toContain('PZO1137');
  expect(ally?.inheritedRuleNotices.map((row) => row.book)).not.toContain(
    'PZO1137',
  );
  expect(review.noticeRequirements).toHaveLength(50);
  expect(review.noticeRequirements.filter((row) => row.holdId)).toHaveLength(
    49,
  );
  expect(
    heldNotices.some(
      (row) => row.id === 'spells-528-notice-PZO1137-complete-chain',
    ),
  ).toBe(false);
  const entry = complete.catalog.entries.find(
    (row) => row.name === 'Glitterdust',
  );
  const assessment = reviewedAdmission.assessments.find(
    (row) => row.externalKey === entry?.externalKey,
  );
  if (!entry || !assessment) throw new Error('Missing Glitterdust');
  const notice = review.noticeRequirements.find(
    (row) => row.book === 'PZO1133',
  );
  if (!notice) throw new Error('Missing Bestiary 5');
  for (const requiredNotice of [notice.book, ...notice.registryKeys]) {
    const requiredNotices = ['PZO1110', requiredNotice];
    const binding = buildAssessmentBinding({
      entry,
      artifact: complete,
      ...reviewedAdmission,
      requiredNotices,
      evidenceIds: Object.keys(assessment.evidenceFingerprints),
    });
    const gate = assessWithUnclearedHolds({
      artifact: complete,
      ...reviewedAdmission,
      assessments: [
        { ...assessment, ...binding, status: 'confirmed', requiredNotices },
      ],
    });
    expect(gate.admitted).toEqual([]);
    const held = gate.held.find((row) => row.externalKey === entry.externalKey);
    if (requiredNotice === notice.book) {
      expect(held?.reason).toMatch(/^Notice holds: PZO1133 \(/);
      expect(held?.missingNotices).toEqual([]);
    } else
      expect(held?.reason).toContain(
        'spells-528-notice-PZO1133-complete-chain',
      );
  }
});
it('classifies generic CRB anchors separately from specific rule comparisons while retaining literal evidence', async () => {
  const groups = spells
    .flatMap((row) => row.inheritedNoticeReview)
    .filter((row) =>
      row.comparisonEvidence.some((item) => item.role === 'publication-anchor'),
    );
  const anchors = groups
    .flatMap((row) => row.comparisonEvidence)
    .filter((row) => row.role === 'publication-anchor');
  expect(groups).toHaveLength(230);
  expect(anchors).toHaveLength(683);
  expect(new Set(anchors.map((row) => `${row.source}:${row.line}`)).size).toBe(
    5,
  );
  expect(
    review.inheritedRuleIdentityEvidence.comparisonEvidenceSummary,
  ).toEqual({
    genericQuoteGroups: 230,
    publicationAnchorOccurrences: 683,
    distinctPublicationAnchorRows: 5,
    directSameSpellMetadataComparisons: 20,
  });
  const files = new Map<string, string>();
  for (const row of anchors) {
    let file = files.get(row.source);
    if (file === undefined) {
      file = await readFile(join(root, row.source), 'utf8');
      files.set(row.source, file);
    }
    expect(hash(file)).toBe(row.fileSha256);
    expect(file.split('\n')[row.line - 1]).toBe(row.text);
    expect(hash(row.text)).toBe(row.textSha256);
  }
  const invisible = groups.find((row) => row.evidence === 'invisible');
  expect(invisible?.comparisonEvidence).toContainEqual(
    expect.objectContaining({
      role: 'publication-anchor',
      text: expect.stringMatching(/^Deflect Arrows\t/),
    }),
  );
  const mastery = anchors.find((row) => row.rule === 'Arcane Armor Training\t');
  expect(mastery?.text).toMatch(/^Arcane Armor Mastery\t/);
  expect(review.correctionReview.affectedEvidenceKeys).toHaveLength(71);
});
it('keeps Death Ward and Tower of Iron Will I mechanics gaps independent of the preserved empty diagnostics', () => {
  for (const name of ['Death Ward', 'Tower of Iron Will I']) {
    const row = spells.find((item) => item.name === name);
    expect(row?.mechanicsReview.outstanding.length).toBeGreaterThan(0);
    expect(row?.mechanicsReview.descriptionRecord.unresolved).toEqual([]);
    expect(
      reviewedCuration.records.find(
        (item) =>
          item.externalKey === row?.externalKey && item.kind === 'description',
      ),
    ).toMatchObject({
      outputs: [],
      diagnostics: [],
    });
  }
  expect(review.mechanicsSummary.rootsWithOutstandingMechanics).toBe(40);
  expect(bounded.curation.unresolvedDescriptions).toHaveLength(38);
});
it('keeps weapon, selected-mode and inherited running effects outstanding while preserving real numeric rules', () => {
  expect(
    spells.find((row) => row.name === 'Emblem of Greed')?.fullContentReview
      .descriptionText,
  ).toContain('caster level 17th');
  expect(
    spells.find((row) => row.name === 'Glitterdust')?.fullContentReview
      .descriptionText,
  ).toContain('-40 penalty on Stealth');
  expect(
    spells.find((row) => row.name === 'Negative Reaction')?.fullContentReview
      .descriptionText,
  ).toContain('-10 penalty');
  expect(
    spells
      .find((row) => row.name === 'Slowing Mud')
      ?.fullContentReview.linkedContentReview.find((row) => row.name === 'Slow')
      ?.descriptionText,
  ).toContain('-1 penalty on attack rolls, AC, and Reflex saves');
  expect(
    spells.find((row) => row.name === 'Spawn Calling')?.mechanicsReview
      .discrepancies,
  ).toContain(
    'Action standard activation versus prose week-long ritual; full ritual retained.',
  );
  expect(
    spells.find((row) => row.name === 'Spontaneous Immolation')?.mechanicsReview
      .metadata.actions,
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        save: {
          description: 'Fortitude half and Reflex (see description)',
          type: 'ref',
        },
      }),
    ]),
  );
  expect(review.mechanicsSummary.rootsWithOutstandingMechanics).toBe(40);
});
it('reuses shared Situations and limits Unbreakable Heart to its exact narrower rule', () => {
  expect(
    spells.find((row) => row.name === 'Thought Shield III')?.mechanicsReview
      .sharedSituations,
  ).toEqual(['mindAffecting']);
  expect(
    spells.find((row) => row.name === 'Remove Fear')?.mechanicsReview
      .sharedSituations,
  ).toEqual(['fear']);
  expect(
    spells.find((row) => row.name === 'Unbreakable Heart')?.mechanicsReview
      .localSituations,
  ).toEqual(['Negative-emotion or ally-harm mind-affecting effects']);
});
it('keeps its own description records, assessments, evidence and holds as recorded', () => {
  expect(
    findCommittedBatchOwnershipProblems(
      'scripts/catalog/legal/spells-528.json',
    ),
  ).toEqual([]);
  for (const key of preserved.keys)
    expect(
      reviewedCuration.records.find(
        (row) => row.externalKey === key && row.kind === 'description',
      ),
    ).toMatchObject({ outputs: [], diagnostics: [] });
});
it.each([
  ['Glitterdust', 'wizard'],
  ['Negative Reaction', 'wizard'],
  ['Emblem of Greed', 'wizard'],
  ['Remove Fear', 'cleric'],
] as const)(
  'recording %s leaves current and permanent base statistics unchanged',
  (name, classTag) => {
    const sheet = calculateCharacterSheetProjections(
      recordedSpellSheet(name, classTag),
    );
    for (const projection of [sheet.current, sheet.permanent]) {
      expect(projection.abilities.strength.score).toBe(10);
      expect(projection.abilities.charisma.score).toBe(10);
      expect(projection.derivedStatistics.will.total).toBe(0);
    }
    expect(spellFixture(name).modifiers).toEqual([]);
  },
);

it('a confirmed test assessment still cannot bypass the exact held APG notice', () => {
  const entry = complete.catalog.entries.find(
    (row) => row.name === 'Glitterdust',
  );
  const assessment = reviewedAdmission.assessments.find(
    (row) => row.externalKey === entry?.externalKey,
  );
  if (!entry || !assessment) throw new Error('Missing Glitterdust');
  const requiredNotices = [
    'PZO1110',
    'pf1-content/notice/7d75468ec859d3452bcef8458792e6ef19c7aafcf9cbaf2f759fdf4bc923b2a2',
  ];
  const binding = buildAssessmentBinding({
    entry,
    artifact: complete,
    ...reviewedAdmission,
    requiredNotices,
    evidenceIds: Object.keys(assessment.evidenceFingerprints),
  });
  const gate = assessWithUnclearedHolds({
    artifact: complete,
    ...reviewedAdmission,
    assessments: [
      { ...assessment, ...binding, status: 'confirmed', requiredNotices },
    ],
  });
  expect(gate.admitted).toEqual([]);
  expect(
    gate.held.find((row) => row.externalKey === entry.externalKey)?.reason,
  ).toContain('spells-528-notice-PZO1115-complete-chain');
});
