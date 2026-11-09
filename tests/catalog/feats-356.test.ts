// @vitest-environment node
import { recordedPrerequisiteFacts } from './prerequisite-audit-739';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { importCatalog } from '../../scripts/catalog/import';
import {
  upstreamRecord,
  sourceDescription,
} from '../../scripts/catalog/records';
import { buildAssessmentBinding } from '../../scripts/catalog/admission';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import remaps from '../../scripts/catalog/reviewed-remaps.json';
import { outputSchema } from '../../src/lib/catalog/curation-output-schema';
import {
  modifierTargets,
  resolveSheet,
  calculateCharacterSheetProjections,
} from '../../src/lib/character-sheet';
import {
  review,
  preview,
  pinnedFiles,
  pinnedSha256,
} from '../fixtures/feats-356/data';
import { reviewedFeatSheet } from '../fixtures/feats-356/sheet';
import { materializePinnedTree, readPinned } from './pinned-sources';
import { bindSnapshotToCurrentNotices } from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';

const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
function entry(name: string) {
  const row = preview.entries.find((row) => row.name === name);
  if (!row) throw new Error(`Missing ${name}`);
  if (row.detail.kind !== 'feat') throw new Error('Expected feat');
  return { ...row, detail: row.detail };
}
function candidate(name: string) {
  const row = review.candidates.find((row) => row.name === name);
  if (!row) throw new Error(`Missing review of ${name}`);
  return row;
}
function modifiers(name: string) {
  const row = entry(name);
  return row.modifiers.map((raw) => ({
    ...outputSchema.options[0]
      .omit({ kind: true })
      .extend({ target: z.enum(modifierTargets) })
      .parse(raw),
    sheetEntryId: row.externalKey,
    catalogEntryId: row.externalKey,
    source: row.externalKey,
    entryName: row.name,
    builtIn: false,
  }));
}
function situation(
  name: string,
  index = 0,
  sheetEntryId = entry(name).externalKey,
) {
  const scope = modifiers(name)[index]?.condition?.situation;
  if (typeof scope !== 'object' || !('local' in scope))
    throw new Error('Expected local Situation');
  return { ...scope, sheetEntryId };
}

it('resolves Cornugon shield branches, ordinary shield stacking, copies and inactive state', () => {
  const rows = modifiers('Cornugon Shield');
  expect(resolveSheet(rows)['ac.other'].total).toBe(0);
  expect(
    resolveSheet(rows, { situations: [situation('Cornugon Shield')] })[
      'ac.other'
    ].total,
  ).toBe(1);
  expect(
    resolveSheet(rows, { situations: [situation('Cornugon Shield', 1)] })[
      'ac.other'
    ].total,
  ).toBe(2);
  const copied = rows.map((row) => ({
    ...row,
    sheetEntryId: 'copy',
    catalogEntryId: 'copy',
  }));
  const shield = {
    ...rows[0]!,
    sheetEntryId: 'shield',
    source: 'shield',
    value: 3,
    condition: undefined,
  };
  expect(
    resolveSheet([...rows, ...copied], {
      situations: [
        situation('Cornugon Shield'),
        situation('Cornugon Shield', 1, 'copy'),
      ],
    })['ac.other'].total,
  ).toBe(2);
  expect(
    resolveSheet([...rows, shield], {
      situations: [situation('Cornugon Shield', 1)],
    })['ac.other'].total,
  ).toBe(3);
  const sheet = reviewedFeatSheet('Cornugon Shield');
  expect(
    calculateCharacterSheetProjections(sheet).current.breakdowns['ac.other']
      .total,
  ).toBe(0);
  sheet.entries = sheet.entries.map((row) =>
    row.kind === 'feat' ? { ...row, active: false } : row,
  );
  expect(
    calculateCharacterSheetProjections(sheet, {
      situations: [situation('Cornugon Shield', 1, 'feat-row')],
    }).current.breakdowns['ac.other'].total,
  ).toBe(0);
});

it('keeps each Shingle Runner skill rank branch independent and scoped to its holder', () => {
  const rows = modifiers('Shingle Runner');
  expect(resolveSheet(rows)['skill.acr'].total).toBe(0);
  const mixed = resolveSheet(rows, {
    situations: [
      situation('Shingle Runner', 1),
      situation('Shingle Runner', 2),
    ],
  });
  expect(mixed['skill.acr'].total).toBe(4);
  expect(mixed['skill.clm'].total).toBe(2);
  expect(mixed['skill.swm'].total).toBe(0);
  expect(
    resolveSheet(rows, {
      situations: [situation('Shingle Runner', 1, 'other')],
    })['skill.acr'].total,
  ).toBe(0);
  expect(
    candidate('Shingle Runner').rejectedRootComparisonEvidence[0]
      ?.appliesToRootBody,
  ).toBe(false);
  expect(
    candidate('Shingle Runner').mechanicsReview.outstandingCalculations,
  ).toEqual(
    expect.arrayContaining([
      expect.stringContaining('Automatic rank counting'),
    ]),
  );
});

it('adds the Hard-Headed stamina increment only to the named saves and leaves helmet bonuses separate', () => {
  const rows = modifiers('Hard-Headed');
  const saved = resolveSheet(rows, {
    situations: [situation('Hard-Headed', 2), situation('Hard-Headed', 4)],
  });
  expect(saved['save.fort'].total).toBe(4);
  expect(saved['save.ref'].total).toBe(4);
  expect(saved['save.will'].total).toBe(4);
  expect(saved.cmb.total).toBe(0);
  expect(saved['attack.melee'].total).toBe(0);
  expect(
    resolveSheet(rows, { situations: ['fear', 'poison'] })['save.will'].total,
  ).toBe(0);
  expect(
    resolveSheet(rows, {
      situations: [situation('Hard-Headed', 0), situation('Hard-Headed', 1)],
    }).cmb.total,
  ).toBe(1);
});

it('stacks the additional Draconic Paragon bonus with Glide without broadening sleep to fear or paralysis', () => {
  const glide = modifiers('Draconic Glide');
  const paragon = modifiers('Draconic Paragon');
  const sleep = resolveSheet([...glide, ...paragon], {
    situations: [situation('Draconic Glide'), situation('Draconic Paragon')],
  });
  expect(sleep['save.will'].total).toBe(4);
  expect(
    resolveSheet(glide, { situations: [situation('Draconic Glide', 1)] })[
      'save.fort'
    ].total,
  ).toBe(2);
  expect(
    resolveSheet([...glide, ...paragon], { situations: ['fear'] })['save.will']
      .total,
  ).toBe(0);
});

it('resolves the Risky Striker AC penalty at BAB thresholds without applying its damage to all attacks', () => {
  const rows = modifiers('Risky Striker');
  for (const [bab, penalty] of [
    [1, -1],
    [3, -1],
    [4, -2],
    [8, -3],
    [12, -4],
    [20, -6],
  ]) {
    const base = {
      ...rows[0]!,
      target: 'bab' as const,
      bonusType: 'base' as const,
      value: bab!,
      condition: undefined,
      source: 'class-bab',
    };
    const totals = resolveSheet([...rows, base], {
      situations: [situation('Risky Striker')],
    });
    expect(totals['ac.other'].total).toBe(penalty);
    expect(totals['damage.melee'].total).toBe(0);
  }
});

it('keeps recipient effects, spell-specific dice and restated companion end states off holder totals', () => {
  for (const name of [
    'Studied Expertise',
    'Telepathic Distraction',
    'Eldritch Aid',
    'Blissful Spell',
    'Summon Neutral Monster',
    'Favored Animal Focus',
    "Poisoner's Channel",
    'Devotion against the Unnatural',
    'Storm Warrior',
    'Deadly Horns',
  ]) {
    expect(modifiers(name), name).toEqual([]);
    expect(entry(name).situationalNotes?.[0]?.text, name).toBeTruthy();
  }
  expect(modifiers('Skill Focus (Artistry)')).toEqual([]);
  expect(candidate('Skill Focus (Artistry)').requiredNotices).toEqual(
    expect.arrayContaining(['PZO1110', 'PZO1131']),
  );
});

it('uses exact narrower circumstances for Underfoot, Juke, Pack Intimidation and Deadly Troupe', () => {
  expect(
    resolveSheet(modifiers('Underfoot (APG)'), {
      situations: [situation('Underfoot (APG)', 1)],
    })['ac.other'].total,
  ).toBe(2);
  expect(
    resolveSheet(modifiers('Juke'), { situations: ['charging'] })['ac.other']
      .total,
  ).toBe(0);
  expect(
    resolveSheet(modifiers('Juke'), { situations: [situation('Juke')] })[
      'ac.other'
    ].total,
  ).toBe(4);
  expect(
    resolveSheet(modifiers('Pack Intimidation'), {
      situations: [situation('Pack Intimidation', 2)],
    })['skill.int'].total,
  ).toBe(6);
  expect(
    resolveSheet(modifiers('Deadly Troupe'), {
      situations: [
        situation('Deadly Troupe', 3),
        situation('Deadly Troupe', 4),
      ],
    }).cmb.total,
  ).toBe(2);
  expect(
    resolveSheet(modifiers('Deadly Troupe'), {
      situations: ['steal', 'dirtyTrick'],
    }).cmb.total,
  ).toBe(0);
});

it('retains named source/version and prerequisite mismatches without fixing importer facts or inventing attribution', () => {
  expect(candidate('Divine Interference').requiredNotices).toEqual(
    expect.arrayContaining(['PZO1117', 'PZO9463', 'PZO9472', 'PZO1129']),
  );
  expect(candidate('Divine Interference').holdIds).toContain(
    'feats-356-divine-interference-appended-fighting-technique',
  );
  expect(candidate('Summon Neutral Monster').holdIds).toContain(
    'feats-356-summon-neutral-full-list-template-origins',
  );
  expect(
    candidate(
      'Improved Bestial Transformation',
    ).inheritedRuleSourceEvidence.some(
      (row) => row.externalKey === 'pf1-content/WmUlJBvLdZFAUIcY',
    ),
  ).toBe(true);
  expect(
    candidate(
      'Improved Bestial Transformation',
    ).inheritedRuleSourceEvidence.some(
      (row) => row.externalKey === 'pf1/A3KJJHMNlAjUzcx6',
    ),
  ).toBe(false);
  for (const [name, gap] of [
    ['Juke', 'Sidestep class feature'],
    ['Expert Explorer', '5-rank threshold'],
    ['Summon Neutral Monster', 'one anyOf'],
    ['Hidden Presence', '17 threshold'],
  ]) {
    expect(
      recordedPrerequisiteFacts({
        batch: 'feats-356',
        candidate: candidate(name!),
      }),
    ).toEqual(expect.arrayContaining([expect.stringContaining(gap!)]));
  }
});

it('pins all 100 complete bodies, checked description bindings and literal PCGen evidence in the shared store', async () => {
  expect(review.candidates).toHaveLength(100);
  expect(new Set(review.candidates.map((row) => row.externalKey)).size).toBe(
    100,
  );
  expect(review.counts).toMatchObject({
    admitted: 0,
    held: 100,
    excluded: 0,
    recordLevel35Holds: 0,
  });
  expect(preview.entries).toHaveLength(100);
  expect(preview.entries.flatMap((row) => row.modifiers)).toHaveLength(55);
  for (const row of review.candidates) {
    const bytes = await readPinned(row.source.repo, row.source.path);
    expect(sha(bytes), row.externalKey).toBe(row.source.sha256);
    const raw = upstreamRecord.parse(parse(bytes));
    expect(raw._id).toBe(row.externalKey.split('/')[1]);
    expect(raw.name).toBe(row.name);
    expect(raw.system).toEqual(row.sourceFields);
    const description = sourceDescription(raw);
    expect(sha(description)).toBe(row.descriptionSha256);
    expect(description).toBe(row.mechanicsReview.descriptionText);
    expect(row.mechanicsReview.curationRecords).toHaveLength(1);
    const record = row.mechanicsReview.curationRecords[0]!;
    expect(record).toMatchObject({
      kind: 'description',
      target: 'description',
      text: description,
      textSha256: sha(description),
      status: 'checked',
      reviewedBy: 'Sol (AI curator) for the owner',
      reviewedOn: '2026-10-12',
    });
    expect(
      reviewedCuration.records.find(
        (current) => current.externalKey === row.externalKey,
      ),
    ).toEqual(record);
    expect(entry(row.name).sources).toEqual([]);
    expect(row.mechanicsReview.prerequisiteReview.normalizedAtoms).toEqual(
      entry(row.name).prerequisites ?? [],
    );
    for (const supporting of row.inheritedRuleSourceEvidence) {
      const support = await readPinned(supporting.repo, supporting.path);
      expect(sha(support)).toBe(supporting.sha256);
      expect(sourceDescription(upstreamRecord.parse(parse(support)))).toBe(
        supporting.description,
      );
      expect(sha(supporting.description)).toBe(supporting.descriptionSha256);
    }
  }
  for (const file of review.comparisonSources.pcgenFiles) {
    const bytes = await readFile(
      `tests/fixtures/pinned/pcgen/${file.path}`,
      'utf8',
    );
    expect(sha(bytes), file.path).toBe(file.sha256);
  }
  for (const row of review.candidates) {
    for (const comparison of [
      row.comparison,
      ...row.additionalComparisonLeads,
      ...row.rejectedRootComparisonEvidence,
      ...row.inheritedRuleComparisonEvidence,
    ]) {
      if (!comparison) continue;
      const bytes = await readFile(
        `tests/fixtures/pinned/pcgen/${comparison.path}`,
        'utf8',
      );
      expect(bytes.split(/\r?\n/)[comparison.line - 1]).toBe(
        comparison.literalRow,
      );
      if (comparison.publicationAnchor) {
        const { path, line, text } = comparison.publicationAnchor;
        const publication = await readFile(
          `tests/fixtures/pinned/pcgen/${path}`,
          'utf8',
        );
        expect(publication.split(/\r?\n/)[line - 1]?.split('\t')[0]).toBe(text);
      }
    }
  }
});

it('reextracts source-bound mechanics from a clean shared fixture tree and enforces current content and notice holds', async () => {
  const tree = await materializePinnedTree(pinnedFiles, {
    sha256: pinnedSha256,
  });
  try {
    const artifact = await importCatalog({
      ...tree,
      remaps,
      curation: reviewedCuration,
      candidateKeys: review.candidates.map((row) => row.externalKey),
    });
    expect(artifact.curation.passed).toBe(true);
    expect(artifact.curation.missing).toEqual([]);
    expect(artifact.curation.stale).toEqual([]);
    expect(artifact.curation.summary.descriptions.checked).toBe(100);
    for (const row of artifact.catalog.entries) {
      const saved = entry(row.name);
      expect({
        description: row.description,
        modifiers: row.modifiers,
        situationalNotes: row.situationalNotes,
        sources: row.sources,
      }).toEqual({
        description: saved.description,
        modifiers: saved.modifiers,
        situationalNotes: saved.situationalNotes,
        sources: saved.sources,
      });
    }
    // The reduced tree cannot reproduce every whole-corpus name collision.
    // Gate the full-source snapshot after independently reproducing its mechanics.
    const authoritative = {
      ...artifact,
      catalog: {
        ...artifact.catalog,
        entries: preview.entries.map((row) => {
          if (row.detail.kind !== 'feat') throw new Error('Expected feat');
          return { ...row, detail: row.detail };
        }),
      },
    };
    const gate = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
    });
    expect(gate.admitted).toEqual([]);
    expect(gate.held).toHaveLength(100);
    expect(gate.dependentOmissions).toEqual([]);
    expect(gate.failures).toEqual([]);
    for (const row of review.candidates) {
      const assessment = reviewedAdmission.assessments.find(
        (a) => a.externalKey === row.externalKey,
      );
      expect(assessment).toMatchObject({
        status: 'unresolved',
        ...bindSnapshotToCurrentNotices(row.currentBinding),
        requiredNotices: row.requiredNotices,
      });
      expect(
        buildAssessmentBinding({
          artifact: authoritative,
          entry: entry(row.name),
          requiredNotices: row.requiredNotices,
          evidenceIds: [row.evidenceId],
          ...reviewedAdmission,
        }),
      ).toEqual(bindSnapshotToCurrentNotices(row.currentBinding));
    }
    const cornugon = candidate('Cornugon Shield');
    const allConfirmed = reviewedAdmission.assessments.map((row) =>
      row.externalKey === cornugon.externalKey
        ? { ...row, status: 'confirmed' as const }
        : row,
    );
    const confirmed = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
      assessments: allConfirmed,
    });
    expect(
      confirmed.held.find((row) => row.externalKey === cornugon.externalKey)
        ?.reason,
      // Since PZO9407's PCGen confirmation was reviewed (2026-10-31), the bare
      // code resolves to its reviewed `pcgen:` block, so the chain hold, not a
      // missing notice, holds it.
    ).toContain('Notice holds: pcgen:PZO9407 (');
    const registryKeys = review.noticeRequirements.find(
      (row) => row.book === 'PZO9407',
    )?.registryKeys;
    if (!registryKeys?.length)
      throw new Error('Missing Cornugon notice identity');
    const requiredNotices = ['PZO1110', ...registryKeys];
    const binding = buildAssessmentBinding({
      artifact: authoritative,
      entry: entry('Cornugon Shield'),
      requiredNotices,
      evidenceIds: [cornugon.evidenceId],
      ...reviewedAdmission,
    });
    const concreteIdentity = allConfirmed.map((row) =>
      row.externalKey === cornugon.externalKey
        ? { ...row, ...binding, requiredNotices }
        : row,
    );
    const heldIdentity = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
      assessments: concreteIdentity,
    });
    expect(
      heldIdentity.held.find((row) => row.externalKey === cornugon.externalKey)
        ?.reason,
    ).toContain('Notice holds');
    expect(confirmed.admitted).toEqual([]);
  } finally {
    await tree.dispose();
  }
});
