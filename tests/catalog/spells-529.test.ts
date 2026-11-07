// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFile, mkdir, copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { beforeAll, expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { importCatalog } from '../../scripts/catalog/import';
import {
  buildAssessmentBinding,
  computeFingerprint,
} from '../../scripts/catalog/admission';
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
} from '../fixtures/spells-529/data';
import { recordedSpellSheet, spellFixture } from '../fixtures/spells-529/sheet';
import {
  findCommittedBatchOwnershipProblems,
  findRecordedBindingProblems,
  findCitedNoticeProblems,
} from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';
const root = resolve('tests/fixtures/spells-529');
const keys = spells.map((row) => row.externalKey);
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
it('reconciles exactly the 100 ticket Spell keys, holding rather than excluding Torrent of Elemental Rage', async () => {
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(hash(keys.join('\n'))).toBe(provenance.orderedTicketKeysSha256);
  expect(hash(keys.join('\n'))).toBe(
    '6fa59bc3039d6d5fea8bb02c19bd449f35cbd2216c8f1c4d148559e37e435d2e',
  );
  expect(review.summary).toEqual({
    rawCandidates: 100,
    spellDefinitions: 100,
    held: 100,
    admitted: 0,
    excluded: 0,
    dependentOmissions: 0,
    unsupportedProseOnly: 0,
    recordLevel35Holds: 1,
  });
  const tagged = spells.find((row) => row.name === 'Torrent of Elemental Rage');
  expect(tagged?.externalKey).toBe('pf1/fsHGAXTXiuvWHE9w');
  expect(tagged?.holdIds).toContain(
    'spells-529-Torrent-of-Elemental-Rage-record-level3.5tag',
  );
  const raw = upstreamRecord.parse(
    parse(await readFile(join(root, 'pf1', tagged?.source.path ?? ''), 'utf8')),
  );
  expect(raw.system.tags).toEqual(['3.5']);
  expect(
    bounded.comparison.records.find(
      (row) => row.externalKey === tagged?.externalKey,
    )?.status,
  ).toBe('admitted');
});
it('binds every complete raw description, action, source and class level independently of importer output', async () => {
  for (const row of spells) {
    const raw = upstreamRecord.parse(
      parse(await readFile(join(inputs.systemPath, row.source.path), 'utf8')),
    );
    expect(raw.type).toBe('spell');
    expect(hash(sourceDescription(raw)), row.name).toBe(row.descriptionSha256);
    expect(row.fullContentReview.descriptionText, row.name).toBe(
      sourceDescription(raw),
    );
    expect(row.citedSources, row.name).toEqual(raw.system.sources);
    expect(row.learnedAt, row.name).toEqual(raw.system.learnedAt);
    expect(row.mechanicsReview.metadata.actions, row.name).toEqual(
      raw.system.actions,
    );
    expect(row.descriptorReview.published, row.name).toEqual(
      raw.system.descriptors ?? [],
    );
    const entry = bounded.catalog.entries.find(
      (item) => item.externalKey === row.externalKey,
    );
    expect(entry?.detail.kind).toBe('spell');
    if (entry?.detail.kind !== 'spell') throw new Error(row.name);
    // #738 imports the published descriptors; `imported` records what the
    // importer read when this batch was reviewed.
    expect(entry.detail.descriptors, row.name).toEqual(
      row.descriptorReview.published,
    );
    expect(entry.detail.levels, row.name).toEqual(
      z
        .object({ class: z.record(z.string(), z.number()) })
        .parse(raw.system.learnedAt).class,
    );
    expect(entry.modifiers).toEqual([]);
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
    expect(row.holdIds).toContain(`spells-529-whole-content-${raw._id}`);
    expect(row.noticeRequirementsComplete).toBe(false);
    expect(row.fullContentReview.unresolvedOrigins.length).toBeGreaterThan(0);
    expect(reviewedAdmission.evidence[row.evidenceId]?.content).toContain(
      row.source.sha256,
    );
  }
});
it('replays the exact selected fixture and complete context without hiding resource or metadata mismatches', () => {
  const byKey = (rows: { externalKey: string }[]) =>
    [...rows].sort((a, b) => a.externalKey.localeCompare(b.externalKey));
  expect(computeFingerprint(byKey(bounded.catalog.entries))).toBe(
    computeFingerprint(byKey(preview.entries)),
  );
  expect(computeFingerprint(byKey(complete.catalog.entries))).toBe(
    computeFingerprint(byKey(bindingPreview.entries)),
  );
  expect(computeFingerprint(complete.catalog.resources)).toBe(
    computeFingerprint(bindingPreview.resources),
  );
  expect(bounded.curation.passed).toBe(true);
  expect(bounded.curation.summary.required).toBe(0);
  expect(bounded.curation.summary.missing).toBe(0);
  expect(bounded.curation.summary.descriptions.checked).toBe(100);
  expect(bounded.curation.unresolvedMechanics).toEqual([]);
  expect(bounded.curation.unresolvedDescriptions).toHaveLength(
    review.mechanicsSummary.optionalUnresolvedDescriptions ?? -1,
  );
  const gate = assessWithUnclearedHolds({
    artifact: complete,
    ...reviewedAdmission,
  });
  expect(gate.failures).toEqual([]);
  expect(gate.admitted).toEqual([]);
  expect(
    gate.held.filter((row) => keys.includes(row.externalKey)),
  ).toHaveLength(100);
  const selectedGate = assessWithUnclearedHolds({
    artifact: bounded,
    ...reviewedAdmission,
  });
  expect(selectedGate.admitted).toEqual([]);
  expect(selectedGate.failures).toHaveLength(
    preview.admissionCounts.failures ?? -1,
  );
  expect(
    selectedGate.failures.every((row) =>
      row.reason.startsWith('Broken structure or reference:'),
    ),
  ).toBe(true);
  expect(
    gate.held.find((row) => row.externalKey === 'pf1/fsHGAXTXiuvWHE9w')?.reason,
  ).toContain('record-level3.5tag');
});
it('keeps all 100 live assessments equal to independently recomputed complete bindings and their recorded content snapshots', () => {
  for (const row of spells) {
    const assessment = reviewedAdmission.assessments.find(
      (item) => item.externalKey === row.externalKey,
    );
    const entry = complete.catalog.entries.find(
      (item) => item.externalKey === row.externalKey,
    );
    if (!assessment || !entry) throw new Error(row.name);
    const current = buildAssessmentBinding({
      entry,
      artifact: complete,
      ...reviewedAdmission,
      requiredNotices: row.requiredNotices,
      evidenceIds: [row.evidenceId],
    });
    expect(assessment).toMatchObject({
      status: 'unresolved',
      requiredNotices: row.requiredNotices,
      ...current,
    });
    expect(
      findRecordedBindingProblems({
        recorded: row.binding,
        current,
        evidenceId: row.evidenceId,
      }),
      row.name,
    ).toEqual([]);
    for (const dep of row.inheritedRuleNotices)
      expect(row.requiredNotices).toContain(dep.book);
  }
});
it('pins every inherited excerpt/body and PCGen declaration at its proper evidentiary layer', async () => {
  const files = new Map<string, Buffer>();
  for (const row of spells.flatMap((item) => item.inheritedNoticeReview)) {
    const p = new URL(row.sourceLocation).pathname.split('/packs/')[1];
    if (!p) throw new Error(row.sourceLocation);
    const path = join(inputs.systemPath, 'packs', p);
    const file = files.get(path) ?? (await readFile(path));
    files.set(path, file);
    const description = sourceDescription(
      upstreamRecord.parse(parse(file.toString())),
    );
    expect(hash(file), path).toBe(row.sourceFileSha256);
    expect(hash(description), path).toBe(row.sourceDescriptionSha256);
    expect(hash(row.evidence), path).toBe(row.evidenceSha256);
    expect(description, path).toContain(row.evidence);
  }
  for (const row of review.inheritedRuleIdentityEvidence.pcgenRows) {
    const file = await readFile(join(root, row.source));
    const lines = file.toString().split('\n');
    expect(hash(file)).toBe(row.fileSha256);
    expect(lines[row.line - 1]).toBe(row.text);
    expect(hash(row.text)).toBe(row.textSha256);
    if (row.publicationDeclaration) {
      expect(lines[row.publicationDeclaration.line - 1]).toBe(
        row.publicationDeclaration.text,
      );
      expect(hash(row.publicationDeclaration.text)).toBe(
        row.publicationDeclaration.textSha256,
      );
    }
    if (row.role === 'publication-anchor')
      expect(row.text).toMatch(/^SOURCELONG:/);
  }
  for (const quote of bibliography.quotes)
    expect(hash(quote.text)).toBe(quote.sha256);
});
it('verifies byte-identical pinned inputs and exact notice hold coverage without modifying earlier notices', async () => {
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
  for (const row of review.noticeRequirements) {
    if (row.book === 'PZO1110') {
      expect(row.holdId).toBeNull();
      expect(row.registryKeys).toEqual(['CRB']);
    } else
      expect(heldNotices.find((item) => item.id === row.holdId)).toEqual({
        id: row.holdId,
        notices: [row.book, ...row.registryKeys],
        evidence: ['scripts/catalog/legal/spells-529.json'],
      });
    for (const notice of row.registryIdentityEvidence)
      expect(findCitedNoticeProblems(notice), notice.key).toEqual([]);
  }
  expect(
    review.noticeRequirements.find((row) => row.book === 'PZO1115')
      ?.registryKeys,
  ).toContain(
    'pf1-content/notice/7d75468ec859d3452bcef8458792e6ef19c7aafcf9cbaf2f759fdf4bc923b2a2',
  );
});
it.each([
  ['Summon Kami', ['PZO1110', 'PZO1120']],
  ['Summon Accuser', ['PZO1110', 'PZO1116']],
  ['Summon Elder Worm', ['PZO1110', 'PZO1112']],
  ['Harrowing, Greater', ['PZO1110', 'PZO1112', 'PZO9226']],
  ['Cave Fangs', ['PZO1110', 'PZO1129']],
  ['Restore Eidolon', ['PZO1110', 'PZO1115']],
  ['Golden Guise', ['PZO1123']],
  ['Form of the Alien Dragon I', ['PZO1110', 'PZO1127', 'PZO1133']],
  ['Form of the Alien Dragon III', ['PZO1110', 'PZO1127', 'PZO1133']],
] as const)('retains exact supported notice minima for %s', (name, books) => {
  const row = spells.find((item) => item.name === name);
  for (const book of books) expect(row?.requiredNotices).toContain(book);
});
it('preserves the literal summoning, healing, dragon and item formulas instead of substituting nearby rules', () => {
  const row = (name: string) => spells.find((item) => item.name === name);
  expect(
    row('Summon Kami')?.fullContentReview.linkedContentReview.map(
      (item) => item.name,
    ),
  ).toContain("Summon Nature's Ally V");
  expect(
    row('Summon Elder Worm')?.fullContentReview.linkedContentReview.map(
      (item) => item.name,
    ),
  ).toContain("Summon Nature's Ally VIII");
  expect(row('Form of the Alien Dragon I')?.requiredNotices).not.toContain(
    'PZO1137',
  );
  expect(bibliography.quotes).toContainEqual(
    expect.objectContaining({
      text: '      _id: "PZO1133",\n      name: "Bestiary 5",',
    }),
  );
  expect(
    row('Make Whole, Greater')?.fullContentReview.descriptionText,
  ).toContain('1d6 points of damage plus 1 point per level');
  expect(
    row('Make Whole, Greater')?.fullContentReview.descriptionText,
  ).toContain('maximum 10d6+10');
  expect(row('Make Whole, Greater')?.mechanicsReview.outstanding).toContain(
    'Greater Make Whole construct healing formula is ambiguous: literal 1d6 + 1/level versus maximum 10d6+10. No inferred repair formula.',
  );
  expect(row('Magic Stone')?.fullContentReview.descriptionText).toContain(
    "including the spell's enhancement bonus",
  );
  expect(
    row('Bladed Dash, Greater')?.mechanicsReview.outstanding.join(' '),
  ).toContain('Intelligence/Charisma');
  expect(
    row('Eldritch Conduit')?.mechanicsReview.outstanding.join(' '),
  ).toContain('-20 Stealth');
});
it.each([
  ['Acute Senses', '+30 (the maximum) at caster level 16th'],
  ["Nereid's Grace", 'maximum +6 at 18th level'],
  ['Blood Rage', 'maximum +10 Strength, -5 AC'],
  ['Glue Seal', '-10 circumstance penalty'],
  ['Fog Cloud', '50% miss chance'],
  ['Form of the Alien Dragon III', '+10 size bonus to your Strength'],
  ['Visualization of the Body', '+4 dodge bonus'],
] as const)(
  'pins real numeric rules and keeps %s effects independent of collection state',
  (name, text) => {
    const row = spells.find((item) => item.name === name);
    expect(row?.fullContentReview.descriptionText).toContain(text);
    expect(spellFixture(name).modifiers).toEqual([]);
  },
);
it.each([
  ['Acute Senses', 'alchemist'],
  ['Blood Rage', 'sorcerer'],
  ['Unholy Aura', 'cleric'],
  ['Fog Cloud', 'wizard'],
] as const)(
  'recording %s preserves current and permanent base totals',
  (name, classTag) => {
    const sheet = calculateCharacterSheetProjections(
      recordedSpellSheet(name, classTag),
    );
    for (const projection of [sheet.current, sheet.permanent]) {
      expect(projection.abilities.strength.score).toBe(10);
      expect(projection.abilities.charisma.score).toBe(10);
      expect(projection.derivedStatistics.will.total).toBe(0);
    }
  },
);
it('uses shared Situations only on separately scoped Notes without implying their engine implementation', () => {
  expect(
    spells.find((row) => row.name === 'Form of the Alien Dragon I')
      ?.mechanicsReview.sharedSituations,
  ).toContain('mindAffecting');
  expect(
    spells.find((row) => row.name === 'Dispel Law')?.mechanicsReview
      .sharedSituations,
  ).toContain('lawfulCreatures');
  const record = reviewedCuration.records.find(
    (row) =>
      row.externalKey === 'pf1/g3d29t4amz91ewy5' && row.kind === 'description',
  );
  expect(record?.outputs).toContainEqual({
    kind: 'note',
    target: 'saves',
    situation: 'mindAffecting',
    text: 'Nightmare dragon form gives +4 on saves versus mind-affecting effects.',
  });
});
it('keeps its own description records, assessments, evidence and holds as recorded', () => {
  expect(
    findCommittedBatchOwnershipProblems(
      'scripts/catalog/legal/spells-529.json',
    ),
  ).toEqual([]);
  for (const key of preserved.keys)
    expect(
      reviewedCuration.records.find(
        (row) => row.externalKey === key && row.kind === 'description',
      ),
    ).toMatchObject({ outputs: [], diagnostics: [] });
});
it('reconstructs a portable fixture using only enumerated published files and tracked empty-directory markers', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'spells-529-fixture-'));
  try {
    for (const repo of ['pf1', 'pf1-content']) {
      const manifest = provenance.manifests.find((row) => row.repo === repo);
      if (!manifest) throw new Error(repo);
      const data = z
        .object({ packs: z.array(z.object({ name: z.string() })) })
        .parse(
          JSON.parse(await readFile(join(root, repo, manifest.path), 'utf8')),
        );
      for (const pack of data.packs) {
        const base = repo === 'pf1' ? 'packs' : 'src';
        const dir = join(scratch, repo, base, pack.name);
        await mkdir(dir, { recursive: true });
        if (
          ![...provenance.rawSources, ...provenance.dependencies].some(
            (row) =>
              repo === 'pf1' && row.path.startsWith(`packs/${pack.name}/`),
          )
        )
          await copyFile(
            join(root, repo, base, pack.name, '.gitkeep'),
            join(dir, '.gitkeep'),
          );
      }
    }
    for (const row of [
      ...provenance.rawSources,
      ...provenance.dependencies,
      ...provenance.manifests,
    ]) {
      const repo = 'repo' in row ? row.repo : 'pf1';
      const target = join(scratch, repo, row.path);
      await mkdir(join(target, '..'), { recursive: true });
      await copyFile(join(root, repo, row.path), target);
    }
    const replay = await importCatalog({
      ...inputs,
      systemPath: join(scratch, 'pf1'),
      contentPath: join(scratch, 'pf1-content'),
      candidateKeys: bindingPreview.entries.map((row) => row.externalKey),
    });
    expect(computeFingerprint(replay.catalog.entries)).toBe(
      computeFingerprint(complete.catalog.entries),
    );
    expect(computeFingerprint(replay.catalog.resources)).toBe(
      computeFingerprint(complete.catalog.resources),
    );
    expect(
      assessWithUnclearedHolds({ artifact: replay, ...reviewedAdmission })
        .failures,
    ).toEqual([]);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

it('a confirmed test assessment cannot bypass the exact held APG notice', () => {
  const entry = complete.catalog.entries.find(
    (row) => row.name === 'Fog Cloud',
  );
  const assessment = reviewedAdmission.assessments.find(
    (row) => row.externalKey === entry?.externalKey,
  );
  if (!entry || !assessment) throw new Error('Missing Fog Cloud');
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
  ).toContain('spells-529-notice-PZO1115-complete-chain');
});

it('compares the complete positive PCGen DisplayFullSpell branch separately from metadata summaries', async () => {
  let count = 0;
  for (const row of spells) {
    const comparison = row.fullContentReview.directComparison;
    if (!comparison) continue;
    const file = await readFile(join(root, comparison.source));
    const lines = file.toString().split('\n');
    expect(hash(file)).toBe(comparison.fileSha256);
    expect(lines[comparison.line - 1]).toBe(comparison.text);
    expect(hash(comparison.text)).toBe(comparison.lineSha256);
    if (!comparison.fullDescription) continue;
    const body = comparison.fullDescription;
    expect(lines[body.line - 1]).toBe(body.text);
    expect(hash(body.text)).toBe(body.lineSha256);
    expect(body.text).toMatch(/\.MOD\t/);
    expect(body.text).toContain('|PRERULE:1,DisplayFullSpell');
    expect(body.text).not.toContain('|!PRERULE:1,DisplayFullSpell');
    count++;
  }
  expect(count).toBe(24);
});
