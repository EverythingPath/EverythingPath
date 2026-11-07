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
  assessCatalogAdmission,
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
  bibliography,
  snapshot,
} from '../fixtures/spells-530/data';
import { recordedSpellSheet, spellFixture } from '../fixtures/spells-530/sheet';
import {
  findCommittedBatchOwnershipProblems,
  findRecordedBindingProblems,
  findCitedNoticeProblems,
} from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';
import {
  expectLaunchOutcome,
  expectPinnedPcgenRows,
} from './launch-reassessment';
const root = resolve('tests/fixtures/spells-530');
const keys = review.candidates.map((row) => row.externalKey);
const hash = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex');
const inputs = {
  systemPath: join(root, 'pf1'),
  contentPath: join(root, 'pf1-content'),
  remaps: bindingPreview.remaps,
  candidateKeys: bindingPreview.entries.map((row) => row.externalKey),
  curation: reviewedCuration,
};
let bounded: Awaited<ReturnType<typeof importCatalog>>;
let complete: Awaited<ReturnType<typeof importCatalog>>;
beforeAll(async () => {
  bounded = await importCatalog({ ...inputs, candidateKeys: keys });
  complete = await importCatalog(inputs);
});
it('accounts for exactly 100 keys, excluding the !folders! record and holding the literal 3.5 record', async () => {
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(hash(keys.join('\n'))).toBe(provenance.orderedTicketKeysSha256);
  expect(provenance.orderedTicketKeysSha256).toBe(
    'e0433f2949f18f830e37698963ec19f339efe4cbe54d6857d0621f91a1be5f20',
  );
  expect(spells).toHaveLength(99);
  expect(review.summary).toEqual({
    rawCandidates: 100,
    spellDefinitions: 99,
    // #516 whole-content wave 3 admits Scrying, the batch's one launch row.
    held: 98,
    admitted: 1,
    excluded: 1,
    dependentOmissions: 0,
    unsupportedProseOnly: 0,
    recordLevel35Holds: 1,
  });
  const folder = review.candidates.find((row) => row.kind === 'folder');
  expect(folder?.externalKey).toBe('pf1/gb3ao0esijDaJx1q');
  const rawFolder = upstreamRecord.parse(
    parse(
      await readFile(
        join(inputs.systemPath, folder?.source.path ?? ''),
        'utf8',
      ),
    ),
  );
  expect(rawFolder).toMatchObject({
    _key: '!folders!gb3ao0esijDaJx1q',
    type: 'Item',
    name: 'Illusion',
  });
  expect(
    bounded.comparison.records.find(
      (row) => row.externalKey === folder?.externalKey,
    )?.status,
  ).toBe('excluded');
  expect(
    bounded.catalog.entries.some(
      (row) => row.externalKey === folder?.externalKey,
    ),
  ).toBe(false);
  const tagged = spells.find((row) => row.name === "Drunkard's Breath");
  expect(tagged?.externalKey).toBe('pf1/h9JemJZJl9jJWZX5');
  expect(tagged?.holdIds).toContain(
    'spells-530-Drunkards-Breath-record-level3.5tag',
  );
  const raw = upstreamRecord.parse(
    parse(
      await readFile(
        join(inputs.systemPath, tagged?.source.path ?? ''),
        'utf8',
      ),
    ),
  );
  expect(raw.system.tags).toEqual(['3.5']);
  expect(
    bounded.comparison.records.find(
      (row) => row.externalKey === tagged?.externalKey,
    )?.status,
  ).toBe('admitted');
});
it('independently binds every literal root body, class level map, citation and action metadata', async () => {
  for (const row of spells) {
    const raw = upstreamRecord.parse(
      parse(await readFile(join(inputs.systemPath, row.source.path), 'utf8')),
    );
    expect(raw.type).toBe('spell');
    expect(hash(sourceDescription(raw)), row.name).toBe(row.descriptionSha256);
    expect(row.fullContentReview.descriptionText).toBe(sourceDescription(raw));
    expect(row.citedSources).toEqual(raw.system.sources);
    expect(row.learnedAt).toEqual(raw.system.learnedAt);
    expect(row.mechanicsReview.metadata.actions).toEqual(raw.system.actions);
    expect(row.descriptorReview.published).toEqual(
      raw.system.descriptors ?? [],
    );
    const entry = bounded.catalog.entries.find(
      (item) => item.externalKey === row.externalKey,
    );
    if (entry?.detail.kind !== 'spell') throw new Error(row.name);
    expect(entry.detail.levels).toEqual(
      z
        .object({ class: z.record(z.string(), z.number()) })
        .parse(raw.system.learnedAt).class,
    );
    // #738 imports the published descriptors; `imported` records what the
    // importer read when this batch was reviewed.
    expect(entry.detail.descriptors).toEqual(row.descriptorReview.published);
    expect(entry.modifiers).toEqual([]);
    const record = reviewedCuration.records.find(
      (item) =>
        item.externalKey === row.externalKey && item.kind === 'description',
    );
    expect(record).toMatchObject({
      status: 'checked',
      text: sourceDescription(raw),
      reviewedBy: 'Sol (AI curator) for the owner',
      reviewedOn: '2026-10-10',
    });
    expect(record?.outputs.every((item) => item.kind === 'note')).toBe(true);
    expect(record?.outputs).toEqual(
      row.mechanicsReview.protectedHistoricalContext
        ? []
        : row.mechanicsReview.reviewedOptionalOutputs,
    );
    expect(
      record?.diagnostics
        .filter((item) => item.kind === 'unresolved')
        .map((item) => item.text),
    ).toEqual(row.mechanicsReview.descriptionRecord.unresolved);
    expect(row.mechanicsReview.descriptionRecord.unresolved).toEqual(
      row.mechanicsReview.protectedHistoricalContext
        ? []
        : row.mechanicsReview.outstanding,
    );
    // A re-assessed launch row keeps its earlier hold in its history.
    expect(row.assessmentHistory?.[0]?.holdIds ?? row.holdIds).toContain(
      `spells-530-whole-content-${raw._id}`,
    );
    expect(reviewedAdmission.evidence[row.evidenceId]?.content).toContain(
      row.source.sha256,
    );
    expect(
      record?.outputs
        .map((item) => (item.kind === 'note' ? item.text : ''))
        .join('\n'),
    ).not.toMatch(/notice hold|whole-content|Review required:|spells-530-/i);
  }
});
it('uses the 49 pinned class records only as lookup context for the 250 Spell definitions', async () => {
  expect(provenance.classContext).toHaveLength(49);
  expect(new Set(provenance.classContext.map((row) => row.tag)).size).toBe(49);
  for (const row of provenance.classContext) {
    const raw = upstreamRecord.parse(
      parse(await readFile(join(root, row.repo, row.path), 'utf8')),
    );
    expect(raw.type).toBe('class');
    expect(raw.system.tag).toBe(row.tag);
    expect(
      complete.catalog.entries.some(
        (entry) => entry.externalKey === row.externalKey,
      ),
    ).toBe(false);
  }
  expect(complete.catalog.entries).toHaveLength(250);
  expect(
    complete.catalog.entries.every((entry) => entry.detail.kind === 'spell'),
  ).toBe(true);
});
it('protects the complete historical context union, including held dependency roots', () => {
  const protection = z
    .object({
      sources: z.array(
        z.object({
          path: z.string(),
          sha256: z.string(),
          keys: z.array(z.string()),
        }),
      ),
      seedKeys: z.array(z.string()),
      closureKeys: z.array(z.string()),
      protectedRoots: z.array(z.string()),
      definitions: z.record(z.string(), z.string()),
    })
    .parse(snapshot('protected-context.json'));
  // The protected roots come from other batches' inventories and fixtures as
  // they were at this batch's base; those files are theirs to change (#749).
  expect(
    [...new Set(protection.sources.flatMap((source) => source.keys))].sort(),
  ).toEqual(protection.seedKeys);
  expect(protection.sources).toHaveLength(158);
  expect(protection.seedKeys).toHaveLength(3839);
  expect(protection.closureKeys).toHaveLength(5117);
  expect(Object.keys(protection.definitions)).toHaveLength(5066);
  expect(protection.protectedRoots).toHaveLength(23);
  expect(
    spells
      .filter((row) => protection.closureKeys.includes(row.externalKey))
      .map((row) => row.externalKey)
      .sort(),
  ).toEqual(protection.protectedRoots);
  for (const key of protection.protectedRoots) {
    const record = reviewedCuration.records.find(
      (row) => row.externalKey === key && row.kind === 'description',
    );
    expect(record, key).toMatchObject({ outputs: [], diagnostics: [] });
    expect(
      spells.find((row) => row.externalKey === key)?.fullContentReview
        .descriptionText,
    ).toBe(record?.text);
  }
  let checked = 0;
  for (const entry of complete.catalog.entries) {
    const original = protection.definitions[entry.externalKey];
    if (!original) continue;
    expect(computeFingerprint(entry), entry.externalKey).toBe(original);
    checked++;
  }
  expect(checked).toBe(150);
});
it('replays selected and closed-context artifacts and accounts for selection-only reference failures', () => {
  const ordered = (rows: { externalKey: string }[]) =>
    [...rows].sort((a, b) => a.externalKey.localeCompare(b.externalKey));
  expect(computeFingerprint(ordered(bounded.catalog.entries))).toBe(
    computeFingerprint(ordered(preview.entries)),
  );
  expect(computeFingerprint(ordered(complete.catalog.entries))).toBe(
    computeFingerprint(ordered(bindingPreview.entries)),
  );
  expect(computeFingerprint(complete.catalog.resources)).toBe(
    computeFingerprint(bindingPreview.resources),
  );
  expect(bounded.curation.passed).toBe(true);
  expect(bounded.curation.summary.required).toBe(0);
  expect(bounded.curation.summary.missing).toBe(0);
  expect(bounded.curation.summary.descriptions.checked).toBe(99);
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
  ).toHaveLength(99);
  const selected = assessWithUnclearedHolds({
    artifact: bounded,
    ...reviewedAdmission,
  });
  expect(selected.admitted).toEqual([]);
  expect(selected.failures).toHaveLength(
    preview.admissionCounts.failures ?? -1,
  );
  expect(
    selected.failures.every((row) =>
      row.reason.startsWith('Broken structure or reference:'),
    ),
  ).toBe(true);
});
it('compares every current inventory binding to the live assessment and independently recomputed complete closure', () => {
  for (const row of spells) {
    const assessment = reviewedAdmission.assessments.find(
      (item) => item.externalKey === row.externalKey,
    );
    const entry = complete.catalog.entries.find(
      (item) => item.externalKey === row.externalKey,
    );
    if (!entry || !assessment) throw new Error(row.name);
    const current = buildAssessmentBinding({
      entry,
      artifact: complete,
      ...reviewedAdmission,
      requiredNotices: row.requiredNotices,
      evidenceIds: [row.evidenceId],
    });
    expect(assessment).toMatchObject({
      status: row.assessmentStatus,
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
it('requires the core and monster minima found inside inherited bodies', () => {
  for (const [name, book, term] of [
    ['Tower of Iron Will II', 'PZO1110', /spell resistance/i],
    [
      'Elemental Body III',
      'PZO1112',
      /earth glide|whirlwind|vortex|darkvision/i,
    ],
  ] as const) {
    const row = spells.find((item) => item.name === name);
    expect(row?.requiredNotices).toContain(book);
    expect(
      row?.inheritedNoticeReview.some(
        (item) =>
          item.book === book &&
          item.scope === 'referenced-body' &&
          term.test(item.evidence),
      ),
    ).toBe(true);
  }
});
it('pins complete inherited bodies and keeps metadata/book/term minima at their stated evidence layer', async () => {
  for (const row of spells.flatMap((item) => item.inheritedNoticeReview)) {
    const p = new URL(row.sourceLocation).pathname.split('/packs/')[1];
    if (!p) throw new Error(row.sourceLocation);
    const file = await readFile(join(inputs.systemPath, 'packs', p));
    expect(hash(file)).toBe(row.sourceFileSha256);
    const raw = upstreamRecord.parse(parse(file.toString()));
    if (row.role === 'action-metadata-minimum') {
      const actions = z
        .array(
          z.object({
            activation: z.object({ unchained: z.unknown().optional() }),
          }),
        )
        .parse(raw.system.actions);
      expect(JSON.parse(row.evidence)).toEqual(
        actions.flatMap((a) =>
          a.activation.unchained === undefined ? [] : [a.activation.unchained],
        ),
      );
    } else {
      expect(hash(sourceDescription(raw))).toBe(row.sourceDescriptionSha256);
      expect(sourceDescription(raw)).toContain(row.evidence);
      expect(hash(row.evidence)).toBe(row.evidenceSha256);
      if (row.role === 'complete-referenced-spell-body')
        expect(row.evidence).toBe(sourceDescription(raw));
    }
  }
  for (const row of [
    ...provenance.rawSources,
    ...provenance.dependencies,
    ...provenance.classContext,
  ]) {
    const repo = z
      .enum(['pf1', 'pf1-content'])
      .parse('repo' in row ? row.repo : 'pf1');
    expect(hash(await readFile(join(root, repo, row.path)))).toBe(row.sha256);
  }
  for (const row of provenance.comparisonFiles)
    expect(hash(await readFile(join(root, row.path)))).toBe(row.sha256);
  for (const quote of bibliography.quotes) {
    expect(hash(quote.text)).toBe(quote.sha256);
    expect(quote.text.split('\n')).toHaveLength(quote.endLine - quote.line + 1);
    expect(quote.text).toMatch(/_id: "[^"]+",\n +name: "/);
  }
});
it('independently recomputes complete positive DisplayFullSpell equality instead of trusting saved booleans', async () => {
  let count = 0;
  let matches = 0;
  const normalize = (text: string) =>
    text
      .replace(/&amp;/g, '&')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();
  const readable = (text: string) =>
    text.replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, '$1').replace(/<[^>]*>/g, ' ');
  for (const row of spells) {
    const comparison = row.fullContentReview.directComparison;
    if (!comparison) continue;
    const bytes = await readFile(join(root, comparison.source));
    const lines = bytes.toString().split('\n');
    expect(hash(bytes)).toBe(comparison.fileSha256);
    expect(lines[comparison.line - 1]).toBe(comparison.text);
    expect(hash(comparison.text)).toBe(comparison.lineSha256);
    const body = comparison.fullDescription;
    if (!body) throw new Error(row.name + ' missing complete comparison');
    expect(lines[body.line - 1]).toBe(body.text);
    expect(hash(body.text)).toBe(body.lineSha256);
    expect(body.text).toContain('|PRERULE:1,DisplayFullSpell');
    expect(body.text).not.toContain('|!PRERULE:1,DisplayFullSpell');
    const compared = body.text.split('DESC:')[1]?.split('|PRERULE:')[0];
    if (!compared) throw new Error(row.name);
    const equal =
      normalize(readable(row.fullContentReview.descriptionText)) ===
      normalize(compared);
    expect(body.normalizedEqual, row.name).toBe(equal);
    count++;
    if (equal) matches++;
  }
  expect(count).toBe(19);
  expect(matches).toBe(16);
});
it('enforces every known notice identity and never treats a publication anchor as complete-chain approval', () => {
  for (const row of review.noticeRequirements) {
    if (row.book === 'PZO1110') {
      expect(row.holdId).toBeNull();
      expect(row.registryKeys).toEqual(['CRB']);
    } else
      expect(heldNotices.find((item) => item.id === row.holdId)).toEqual({
        id: row.holdId,
        notices: [row.book, ...row.registryKeys],
        evidence: ['scripts/catalog/legal/spells-530.json'],
      });
    for (const notice of row.registryIdentityEvidence)
      expect(findCitedNoticeProblems(notice), notice.key).toEqual([]);
  }
  const entry = complete.catalog.entries.find((r) => r.name === 'Resistance');
  const assessment = reviewedAdmission.assessments.find(
    (r) => r.externalKey === entry?.externalKey,
  );
  if (!entry || !assessment) throw new Error('Resistance');
  for (const [notice, reason] of [
    ['PZO1115', 'Notice holds: PZO1115 ('],
    [
      'pf1-content/notice/7d75468ec859d3452bcef8458792e6ef19c7aafcf9cbaf2f759fdf4bc923b2a2',
      'spells-529-notice-PZO1115-complete-chain',
    ],
  ] as const) {
    const requiredNotices = ['PZO1110', notice];
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
      gate.held.find((r) => r.externalKey === entry.externalKey)?.reason,
    ).toContain(reason);
  }
});
it('holds every required book without promoting title-associated printing variants to aliases', () => {
  const raw = z
    .object({
      noticeRequirements: z.array(
        z.object({
          book: z.string(),
          registryKeys: z.array(z.string()),
          observedRegistryTitleAssociations: z.array(
            z.object({ key: z.string() }),
          ),
        }),
      ),
    })
    .parse(snapshot('../../../scripts/catalog/legal/spells-530.json'));
  for (const row of raw.noticeRequirements)
    for (const key of row.registryKeys) {
      const record = reviewedAdmission.registry[key];
      expect(key === row.book || record?.aliases?.includes(row.book), key).toBe(
        true,
      );
    }
  const combat = raw.noticeRequirements.find((row) => row.book === 'PZO1118');
  expect(combat?.registryKeys).toEqual([]);
  expect(combat?.observedRegistryTitleAssociations).toHaveLength(2);
  const touch = spells.find((row) => row.name === 'Mutagenic Touch');
  expect(touch?.requiredNotices).toContain('PZO1118');
  expect(touch?.requiredNotices).toContain('PZO1115');
  for (const association of combat?.observedRegistryTitleAssociations ?? [])
    expect(touch?.requiredNotices).not.toContain(association.key);
  expect(touch?.noticeHoldIds).toContain(
    'spells-530-notice-PZO1118-complete-chain',
  );
});
it.each([
  ['Resistance', '+1 resistance bonus'],
  ['Ooze Form II', '+8 size bonus'],
  ['Legendary Proportions', '+6 size bonus'],
  ['Atavism', '+4 bonus to AC and CMD'],
  ['Mental Barrier II', '+6'],
  ['Wall of Lava', '20d6'],
  ['Fungal Blisters', '1d6+1'],
  ['Ceremony', 'Scalykind:'],
  ['Power Word Blind', '201 or more'],
  ['Vomit Twin', '10 + 1/2 your caster level'],
])(
  'preserves published %s values without granting passive bonuses',
  (name, text) => {
    const row = spells.find((r) => r.name === name);
    if (!row) throw new Error(name);
    expect(row.mechanicsReview.manualRule).toContain(text);
    expect(
      row.mechanicsReview.reviewedOptionalOutputs
        .map((r) => (r.kind === 'note' ? r.text : ''))
        .join('\n'),
    ).toContain(text);
    const calculated = calculateCharacterSheetProjections(
      recordedSpellSheet(
        name,
        Object.keys(spellFixture(name).detail.levels)[0] ?? 'wizard',
      ),
    );
    for (const view of [calculated.current, calculated.permanent]) {
      expect(view.abilities.strength.score).toBe(10);
      expect(view.abilities.constitution.score).toBe(10);
    }
  },
);
it('scopes only the applicable save clauses with shared Situations and keeps each complete Note within the sheet limit', () => {
  for (const [name, key] of [
    ['Enchantment Foil', 'enchantment'],
    ['Thought Shield I', 'mindAffecting'],
  ] as const) {
    const spell = spells.find((row) => row.name === name);
    if (!spell) throw new Error(name);
    expect(
      spell.mechanicsReview.reviewedOptionalOutputs.filter(
        (row) => row.kind === 'note' && row.situation === key,
      ),
    ).toHaveLength(1);
    expect(
      spell.mechanicsReview.reviewedOptionalOutputs.some(
        (row) => row.kind === 'modifier',
      ),
    ).toBe(false);
  }
  const batchKeys = new Set(keys);
  for (const record of reviewedCuration.records.filter((row) =>
    batchKeys.has(row.externalKey),
  ))
    for (const note of record.outputs)
      if (note.kind === 'note')
        expect(note.text.length).toBeLessThanOrEqual(4096);
});
it('retains source contradictions without choosing a damage or duration correction in player Notes', () => {
  const fungal = spells.find((r) => r.name === 'Fungal Blisters');
  const flame = spells.find((r) => r.name === 'Flame Strike');
  const candle = spells.find((r) => r.name === 'Death Candle');
  expect(fungal?.mechanicsReview.discrepancies.join(' ')).toContain(
    'd2 versus d6',
  );
  expect(flame?.mechanicsReview.discrepancies.join(' ')).toContain('only fire');
  expect(candle?.mechanicsReview.discrepancies.join(' ')).toContain(
    'rounds equal to slain creature HD',
  );
});
it('keeps its own description records, assessments, evidence and holds as recorded', () => {
  expect(
    findCommittedBatchOwnershipProblems(
      'scripts/catalog/legal/spells-530.json',
    ),
  ).toEqual([]);
});
it('reconstructs the exact fixture from declared published inputs and empty directory markers on any machine', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'spells-530-fixture-'));
  try {
    for (const repo of ['pf1', 'pf1-content']) {
      const manifest = provenance.manifests.find((r) => r.repo === repo);
      if (!manifest) throw new Error(repo);
      const data = z
        .object({ packs: z.array(z.object({ name: z.string() })) })
        .parse(
          JSON.parse(await readFile(join(root, repo, manifest.path), 'utf8')),
        );
      for (const pack of data.packs) {
        const dir = join(
          scratch,
          repo,
          repo === 'pf1' ? 'packs' : 'src',
          pack.name,
        );
        await mkdir(dir, { recursive: true });
        if (
          ![
            ...provenance.rawSources,
            ...provenance.dependencies,
            ...provenance.classContext,
          ].some(
            (r) => repo === 'pf1' && r.path.startsWith(`packs/${pack.name}/`),
          )
        )
          await copyFile(
            join(
              root,
              repo,
              repo === 'pf1' ? 'packs' : 'src',
              pack.name,
              '.gitkeep',
            ),
            join(dir, '.gitkeep'),
          );
      }
    }
    for (const row of [
      ...provenance.rawSources,
      ...provenance.dependencies,
      ...provenance.classContext,
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

it('pins the launch re-assessment of Scrying to the literal pinned PCGen rows (#516 whole-content wave 3)', async () => {
  const launch = review.launchReassessment;
  const assessed = spells.filter((row) => row.launchReview);
  expect(assessed.map((row) => row.name)).toEqual(['Scrying']);
  expect(launch).toMatchObject({
    admittedKeys: ['pf1/g66w32kdup1f43bp'],
    dependentlyOmittedKeys: [],
    namedHolds: {},
  });
  const [scrying] = assessed;
  if (!scrying?.launchReview) throw new Error('Scrying');
  await expectPinnedPcgenRows(scrying, scrying.launchReview);
  expectLaunchOutcome(scrying, { batch: 530, launch });
  expect(scrying.launchReview.pcgen).toMatchObject({
    path: 'data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_spells.lst',
    line: 1267,
    baseRow: { line: 517 },
  });
  expect(scrying.launchReview.pcgen.literalRow).toMatch(/^Scrying\.MOD\t/);
  // The one difference is the footnote's place: Foundry keeps it under the
  // Knowledge table, PCGen after the Connection table.
  const footnote =
    'you must have some sort of connection see below to a creature of which you have no knowledge';
  expect(scrying.launchReview.pcgen.wordDifferences).toEqual([
    { pinned: footnote, pcgen: '' },
    { pinned: '', pcgen: footnote },
  ]);
  // The actions' Unchained action costs keep PZO1131 required.
  expect(scrying.requiredNotices).toEqual([
    'CRB',
    'PZO1110',
    'PZO1112',
    'PZO1131',
  ]);
  expect(Object.keys(scrying.launchReview.noticeChain)).toEqual(
    scrying.requiredNotices,
  );
  // With the owner's notice clearances the gate admits it.
  const gate = assessCatalogAdmission({
    artifact: complete,
    ...reviewedAdmission,
  });
  expect(
    gate.admitted.map((r) => r.externalKey).filter((key) => keys.includes(key)),
  ).toEqual(launch.admittedKeys);
  // The batch's other 98 spells keep their earlier review and holds.
  for (const row of spells.filter((r) => !r.launchReview)) {
    expect(row.disposition, row.name).toBe('held');
    expect(row.assessmentStatus, row.name).toBe('unresolved');
  }
});
