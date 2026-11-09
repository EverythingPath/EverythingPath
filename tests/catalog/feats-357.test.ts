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
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
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
} from '../fixtures/feats-357/data';
import { reviewedFeatSheet } from '../fixtures/feats-357/sheet';
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
function modifiers(name: string, sheetEntryId = entry(name).externalKey) {
  const row = entry(name);
  return row.modifiers.map((raw) => ({
    ...outputSchema.options[0]
      .omit({ kind: true })
      .extend({ target: z.enum(modifierTargets) })
      .parse(raw),
    sheetEntryId,
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

it('adds the Shielded Caster shield increments within the entry, scoped to its holder and nonstacking with other competence bonuses', () => {
  const rows = modifiers('Shielded Caster');
  expect(resolveSheet(rows).concentration.total).toBe(0);
  const base = situation('Shielded Caster');
  expect(resolveSheet(rows, { situations: [base] }).concentration.total).toBe(
    4,
  );
  expect(
    resolveSheet(rows, {
      situations: [base, situation('Shielded Caster', 1)],
    }).concentration.total,
  ).toBe(5);
  expect(
    resolveSheet(rows, {
      situations: [base, situation('Shielded Caster', 2)],
    }).concentration.total,
  ).toBe(6);
  expect(
    resolveSheet(rows, {
      situations: [situation('Shielded Caster', 0, 'other-holder')],
    }).concentration.total,
  ).toBe(0);
  const item = {
    ...rows[0]!,
    sheetEntryId: 'item',
    catalogEntryId: 'item',
    source: 'item',
    value: 3,
    condition: undefined,
  };
  expect(
    resolveSheet([...rows, item], {
      situations: [base, situation('Shielded Caster', 1)],
    }).concentration.total,
  ).toBe(5);
  expect(resolveSheet([...rows, item]).concentration.total).toBe(3);
});

it('doubles the Swamp Dweller Swim rank branch only in marshy terrain', () => {
  const rows = modifiers('Swamp Dweller');
  expect(resolveSheet(rows)['skill.swm'].total).toBe(0);
  expect(
    resolveSheet(rows, { situations: [situation('Swamp Dweller', 0)] })[
      'skill.swm'
    ].total,
  ).toBe(2);
  expect(
    resolveSheet(rows, {
      situations: [
        situation('Swamp Dweller', 0),
        situation('Swamp Dweller', 2),
      ],
    })['skill.swm'].total,
  ).toBe(4);
  expect(
    resolveSheet(rows, {
      situations: [
        situation('Swamp Dweller', 1),
        situation('Swamp Dweller', 3),
      ],
    })['skill.swm'].total,
  ).toBe(8);
  expect(
    candidate('Swamp Dweller').mechanicsReview.outstandingCalculations,
  ).toEqual(
    expect.arrayContaining([
      expect.stringContaining('Automatic rank counting'),
    ]),
  );
});

it('keeps Swamper climb and swim always on, its Acrobatics balance-only, and stops when inactive', () => {
  const rows = modifiers('Swamper');
  const plain = resolveSheet(rows);
  expect(plain['skill.clm'].total).toBe(2);
  expect(plain['skill.swm'].total).toBe(2);
  expect(plain['skill.acr'].total).toBe(0);
  expect(
    resolveSheet(rows, { situations: [situation('Swamper', 2)] })['skill.acr']
      .total,
  ).toBe(2);
  const sheet = reviewedFeatSheet('Swamper');
  expect(
    calculateCharacterSheetProjections(sheet).current.breakdowns['skill.clm']
      .total,
  ).toBe(2);
  sheet.entries = sheet.entries.map((row) =>
    row.kind === 'feat' ? { ...row, active: false } : row,
  );
  expect(
    calculateCharacterSheetProjections(sheet).current.breakdowns['skill.clm']
      .total,
  ).toBe(0);
});

it('resolves the Reckless Rage penalties with one Power Attack damage branch at a time', () => {
  const rows = modifiers('Reckless Rage');
  expect(resolveSheet(rows)['damage.melee'].total).toBe(0);
  const penalties = [
    situation('Reckless Rage', 0),
    situation('Reckless Rage', 1),
  ];
  for (const [index, damage] of [
    [2, 2],
    [3, 3],
    [4, 1],
  ] as const) {
    const totals = resolveSheet(rows, {
      situations: [...penalties, situation('Reckless Rage', index)],
    });
    expect(totals['damage.melee'].total).toBe(damage);
    expect(totals['attack.melee'].total).toBe(-1);
    expect(totals.cmb.total).toBe(-1);
    expect(totals['attack.ranged'].total).toBe(0);
  }
  // Every branch applies while raging or using raging song, like the penalties.
  const labels = rows.map((row) => {
    const scope = row.condition?.situation;
    if (typeof scope !== 'object' || !('local' in scope))
      throw new Error('Expected local Situation');
    return scope.local;
  });
  for (const label of labels)
    expect(label).toContain('while raging or using raging song');
  // Power Attack's +50% case covers two-handed weapons, one-handed weapons in
  // two hands and 1-1/2-Strength primary natural weapons; +2 excludes them.
  const [, , normal, increased, halved] = labels;
  expect(increased).toEqual(
    expect.stringContaining('a one-handed weapon wielded in two hands'),
  );
  expect(increased).toContain(
    'a primary natural weapon that adds 1-1/2 times Strength',
  );
  expect(increased).toContain('a two-handed weapon');
  expect(normal).toContain('does not add 1-1/2 times Strength');
  expect(normal).not.toContain('two hands');
  expect(halved).toContain('off-hand weapon or secondary natural weapon');
  const naturalOneAndHalf = resolveSheet(rows, {
    situations: [...penalties, situation('Reckless Rage', 3)],
  });
  expect(naturalOneAndHalf['damage.melee'].total).toBe(3);
  expect(
    resolveSheet(rows, {
      situations: [...penalties, situation('Reckless Rage', 3, 'other-holder')],
    })['damage.melee'].total,
  ).toBe(0);
});

it('uses shared Situations only where their scope matches', () => {
  const pbs = resolveSheet(modifiers('Point-Blank Shot (Mythic)'), {
    situations: ['within30ft'],
  });
  expect(pbs['attack.ranged'].total).toBe(1);
  expect(pbs['damage.ranged'].total).toBe(1);
  expect(pbs['attack.melee'].total).toBe(0);
  expect(
    resolveSheet(modifiers('Point-Blank Shot (Mythic)'))['attack.ranged'].total,
  ).toBe(0);
  const fey = resolveSheet(modifiers('Fey Foundling'), {
    situations: ['death'],
  });
  expect([
    fey['save.fort'].total,
    fey['save.ref'].total,
    fey['save.will'].total,
  ]).toEqual([2, 2, 2]);
  expect(
    resolveSheet(modifiers('Fey Foundling'), { situations: ['fear'] })[
      'save.will'
    ].total,
  ).toBe(0);
  expect(
    resolveSheet(modifiers('Deadhand Initiate'), { situations: ['fear'] })[
      'save.will'
    ].total,
  ).toBe(0);
  expect(
    resolveSheet(modifiers('Deadhand Initiate'), {
      situations: [situation('Deadhand Initiate')],
    })['save.will'].total,
  ).toBe(2);
});

it('keeps each Tribal Scars following and Masked Symbol concept to its own Situation', () => {
  const scars = modifiers('Tribal Scars');
  const bearpelt = resolveSheet(scars, {
    situations: [situation('Tribal Scars', 0), situation('Tribal Scars', 1)],
  });
  expect(bearpelt['save.fort'].total).toBe(1);
  expect(bearpelt['skill.int'].total).toBe(2);
  expect(bearpelt['save.ref'].total).toBe(0);
  expect(bearpelt.cmb.total).toBe(0);
  const greattusk = resolveSheet(scars, {
    situations: [situation('Tribal Scars', 2), situation('Tribal Scars', 3)],
  });
  expect(greattusk.cmb.total).toBe(2);
  expect(greattusk['skill.rid'].total).toBe(2);
  expect(greattusk['save.fort'].total).toBe(0);
  const symbol = modifiers('Masked Symbol');
  const fear = resolveSheet(symbol, {
    situations: [situation('Masked Symbol', 2)],
  });
  expect(fear['skill.int'].total).toBe(3);
  expect(fear['skill.dip'].total).toBe(0);
  expect(
    resolveSheet(symbol, { situations: [situation('Masked Symbol', 3)] })[
      'skill.dip'
    ].total,
  ).toBe(3);
});

it('keeps recipient effects, dice, uses and the Survivor stabilize note off holder totals', () => {
  for (const name of [
    'Esoteric Abjuration',
    'Stance of the Xorn',
    'Basic Harmony',
    'Babble-Peddler',
    'Moonlight Summons',
    'Spider Summoner',
    'Kinslayer',
    'Elemental Strike',
    'Mighty Bite',
    'Sap Adept',
    'Swarm Scatter',
  ]) {
    expect(modifiers(name), name).toEqual([]);
    expect(entry(name).situationalNotes?.[0]?.text, name).toBeTruthy();
  }
  const survivor = entry('Survivor');
  expect(survivor.modifiers).toEqual([]);
  expect(survivor.situationalNotes).toEqual(
    expect.arrayContaining([
      { text: '+5 on Constitution checks made to stabilize while dying.' },
    ]),
  );
  expect(
    candidate('Survivor').mechanicsReview.curationRecords.map(
      (row) => row.kind,
    ),
  ).toEqual(['description', 'note']);
});

it('records inherited-rule notices, alternate versions and named content holds without inventing attribution', () => {
  for (const name of [
    'Wounded Paw Gambit',
    'Tripping Strike',
    'Blazing Aura (Ifrit)',
    'Elven Battle Training',
    'Net and Trident',
    'Enfilading Fire',
    'Sap Adept',
    'Artful Dodge',
  ]) {
    expect(candidate(name).requiredNotices, name).toContain('PZO1131');
    expect(candidate(name).inheritedRuleComparisonEvidence, name).toHaveLength(
      1,
    );
  }
  expect(
    candidate('Artful Dodge').inheritedRuleComparisonEvidence[0]?.book,
  ).toBe('PZO9467');
  expect(candidate('Artful Dodge').requiredNotices).toContain('PZO9467');
  for (const name of ['Object of Legend', 'Infiltrator', 'Eldritch Researcher'])
    expect(candidate(name).requiredNotices, name).toContain('PZO1125');
  for (const name of [
    'Lucky Halfling (Mythic)',
    'Point-Blank Shot (Mythic)',
    'Mounted Combat (Mythic)',
    'Spell Mastery (Mythic)',
  ])
    expect(candidate(name).requiredNotices, name).toContain('PZO1126');
  for (const [name, root, rejected] of [
    ['Sahir-Afiyun', 'PZO9462', 'PZO9208'],
    ['Mounted Onslaught', 'PZO1138', 'PZO9214'],
    ['River Raider', 'PZO1140', 'PZO9448'],
  ] as const) {
    expect(candidate(name).comparison?.book, name).toBe(root);
    expect(candidate(name).rejectedRootComparisonEvidence, name).toEqual([
      expect.objectContaining({ book: rejected, appliesToRootBody: false }),
    ]);
    expect(candidate(name).requiredNotices, name).not.toContain(rejected);
  }
  expect(candidate('Dorn-Dergar Master').requiredNotices).toEqual(
    expect.arrayContaining(['PZO9481', 'PZO9408']),
  );
  for (const [name, hold] of [
    ['Spider Summoner', 'feats-357-spider-summoner-creature-origins'],
    ['Sahir-Afiyun', 'feats-357-sahir-afiyun-pesh-rules-origin'],
    ['Monstrous Companion', 'feats-357-monstrous-companion-creature-origins'],
  ] as const)
    expect(candidate(name).holdIds, name).toContain(hold);
  const held = new Map(heldNotices.map((row) => [row.id, row.notices]));
  for (const requirement of review.noticeRequirements) {
    if (requirement.book === 'PZO1110') {
      expect(requirement.holdId).toBeNull();
      continue;
    }
    expect(held.get(requirement.holdId ?? ''), requirement.book).toEqual([
      requirement.book,
      ...requirement.registryKeys,
    ]);
    for (const key of requirement.candidates)
      expect(
        review.candidates.find((row) => row.externalKey === key)?.noticeHoldIds,
      ).toContain(requirement.holdId);
  }
});

it('retains recorded parser findings and checks current bounded or advisory clauses', () => {
  const kinds = (name: string) =>
    entry(name).prerequisites?.map((atom) =>
      'kind' in atom ? atom.kind : 'anyOf',
    );
  expect(kinds('Elemental Strike')).toEqual(['anyOf']);
  expect(kinds('Bull-Catcher Wrangler')).toEqual([
    'ability',
    'feat',
    'feat',
    'feat',
    'feat',
    'anyOf',
  ]);
  expect(kinds('Flumefire Rage')).toEqual(['ability', 'anyOf']);
  for (const [name, gap] of [
    ['Elemental Strike', 'three conjunctive race atoms'],
    ['Bull-Catcher Wrangler', 'BAB 12 AND'],
    ['Flumefire Rage', 'conjunctively'],
    ['Manipulative Presence', 'Intelligence 19 threshold is lost'],
    ['Reflexive Interception', 'describe the companion itself'],
    ['Demonic Possession', 'medium spirit'],
    ['One Mind', 'Vudrani ethnicity is dropped'],
    ['Pursuit of Glory', 'Ulfen ethnicity is dropped'],
  ] as const)
    expect(
      recordedPrerequisiteFacts({
        batch: 'feats-357',
        candidate: candidate(name),
      }),
      name,
    ).toEqual(expect.arrayContaining([expect.stringContaining(gap)]));
  for (const name of [
    'Sahir-Afiyun',
    'Demonic Possession',
    'Rapid Focus Shift',
    'Practiced Tactician',
  ])
    expect(
      candidate(name).mechanicsReview.prerequisiteReview.repeatability,
      name,
    ).toContain('Special');
});

it('pins all 100 complete bodies, checked bindings and literal PCGen evidence in the shared store', async () => {
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
  expect(preview.entries.flatMap((row) => row.modifiers)).toHaveLength(59);
  for (const row of review.candidates) {
    const bytes = await readPinned(row.source.repo, row.source.path);
    expect(sha(bytes), row.externalKey).toBe(row.source.sha256);
    const raw = upstreamRecord.parse(parse(bytes));
    expect(raw._id).toBe(row.externalKey.split('/')[1]);
    expect(raw.name).toBe(row.name);
    expect(raw.system).toEqual(row.sourceFields);
    expect(row.sourceFields.tags).not.toContain('3.5');
    const description = sourceDescription(raw);
    expect(sha(description)).toBe(row.descriptionSha256);
    expect(description).toBe(row.mechanicsReview.descriptionText);
    const [record, ...rest] = row.mechanicsReview.curationRecords;
    expect(record).toMatchObject({
      kind: 'description',
      target: 'description',
      text: description,
      textSha256: sha(description),
      status: 'checked',
      reviewedBy: 'Opus (AI curator) for the owner',
      reviewedOn: '2026-10-12',
    });
    for (const reviewed of [record, ...rest])
      expect(
        reviewedCuration.records.find(
          (current) =>
            current.externalKey === row.externalKey &&
            current.kind === reviewed?.kind,
        ),
      ).toEqual(reviewed);
    expect(entry(row.name).sources).toEqual([]);
    expect(row.mechanicsReview.prerequisiteReview.normalizedAtoms).toEqual(
      entry(row.name).prerequisites ?? [],
    );
  }
  const files = new Map(
    review.comparisonSources.pcgenFiles.map((file) => [file.path, file.sha256]),
  );
  for (const [path, digest] of files) {
    const bytes = await readFile(`tests/fixtures/pinned/pcgen/${path}`);
    expect(sha(bytes), path).toBe(digest);
  }
  for (const row of review.candidates) {
    for (const comparison of [
      row.comparison,
      ...row.additionalComparisonLeads,
      ...row.rejectedRootComparisonEvidence,
      ...row.inheritedRuleComparisonEvidence,
    ]) {
      if (!comparison) continue;
      expect(files.get(comparison.path)).toBe(comparison.comparisonFileSha256);
      const lines = (
        await readFile(`tests/fixtures/pinned/pcgen/${comparison.path}`, 'utf8')
      ).split(/\r?\n/);
      expect(lines[comparison.line - 1]).toBe(comparison.literalRow);
      expect(sha(comparison.literalRow)).toBe(comparison.comparisonLineSha256);
      const { path, line, text, sha256 } = comparison.publicationAnchor;
      expect(files.get(path)).toBe(sha256);
      const publication = await readFile(
        `tests/fixtures/pinned/pcgen/${path}`,
        'utf8',
      );
      expect(publication.split(/\r?\n/)[line - 1]?.split('\t')[0]).toBe(text);
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
    expect(artifact.curation.summary).toMatchObject({
      required: 1,
      checked: 1,
      descriptions: { candidates: 100, checked: 100 },
    });
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
    // The reduced tree cannot reproduce every whole-corpus prerequisite
    // collision; gate the full-source snapshot after reproducing its mechanics.
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
    const swamper = candidate('Swamper');
    const allConfirmed = reviewedAdmission.assessments.map((row) =>
      row.externalKey === swamper.externalKey
        ? { ...row, status: 'confirmed' as const }
        : row,
    );
    const confirmed = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
      assessments: allConfirmed,
    });
    // PZO1140's checked PCGen block counts for every candidate (#716
    // decision 5, extended 2026-10-30), so its uncleared chain holds hold.
    expect(
      confirmed.held.find((row) => row.externalKey === swamper.externalKey)
        ?.reason,
    ).toMatch(/^Notice holds: pcgen:PZO1140 \(/);
    const registryKeys = review.noticeRequirements.find(
      (row) => row.book === 'PZO1140',
    )?.registryKeys;
    if (!registryKeys?.length)
      throw new Error('Missing Ultimate Wilderness notice identity');
    const requiredNotices = ['PZO1110', ...registryKeys];
    const binding = buildAssessmentBinding({
      artifact: authoritative,
      entry: entry('Swamper'),
      requiredNotices,
      evidenceIds: [swamper.evidenceId],
      ...reviewedAdmission,
    });
    const heldIdentity = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
      assessments: allConfirmed.map((row) =>
        row.externalKey === swamper.externalKey
          ? { ...row, ...binding, requiredNotices }
          : row,
      ),
    });
    expect(
      heldIdentity.held.find((row) => row.externalKey === swamper.externalKey)
        ?.reason,
    ).toContain('Notice holds');
    expect(heldIdentity.admitted).toEqual([]);
  } finally {
    await tree.dispose();
  }
});
