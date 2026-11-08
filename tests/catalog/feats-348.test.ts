// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
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
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import { outputSchema } from '../../src/lib/catalog/curation-output-schema';
import {
  modifierTargets,
  resolveSheet,
  calculateCharacterSheetProjections,
} from '../../src/lib/character-sheet';
import {
  review,
  preview,
  provenance,
  originals,
} from '../fixtures/feats-348/data';
import {
  findCommittedBatchOwnershipProblems,
  bindSnapshotToCurrentNotices,
} from './batch-ownership';
import { reviewedFeatSheet } from '../fixtures/feats-348/sheet';

const fixtureRoot = resolve('tests/fixtures/feats-348');
const inputs = {
  systemPath: join(fixtureRoot, 'pf1'),
  contentPath: join(fixtureRoot, 'pf1-content'),
  remaps: [],
  curation: reviewedCuration,
  candidateKeys: provenance.candidates.map((row) => row.externalKey),
};
const sha256 = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
function entry(name: string) {
  const row = preview.entries.find((row) => row.name === name);
  if (!row) throw new Error(`Missing ${name}`);
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
function situation(name: string, index = 0) {
  const scope = modifiers(name)[index]?.condition?.situation;
  if (typeof scope !== 'object' || !('local' in scope))
    throw new Error('Missing exact local Situation');
  return { ...scope, sheetEntryId: entry(name).externalKey };
}

it('reconciles the exact 100-key inventory with byte-exact full descriptions, current inventory bindings and reviewed facts', async () => {
  const keys = provenance.candidates.map((row) => row.externalKey);
  expect(keys).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(sha256(keys.join('\n'))).toBe(provenance.candidateKeysSha256);
  expect(review.candidates.map((row) => row.externalKey)).toEqual(keys);
  expect(preview.entries.map((row) => row.externalKey)).toEqual(keys);
  expect(review.counts).toEqual({
    total: 100,
    admitted: 0,
    held: 100,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 0,
    recordLevel35Holds: 0,
  });
  for (const c of review.candidates) {
    const bytes = await readFile(
      join(inputs.contentPath, c.source.path),
      'utf8',
    );
    const raw = upstreamRecord.parse(parse(bytes));
    expect(sha256(bytes), c.name).toBe(c.source.sha256);
    expect(`pf1-content/${raw._id}`).toBe(c.externalKey);
    expect(sourceDescription(raw)).toBe(c.mechanicsReview.descriptionText);
    expect(sha256(sourceDescription(raw))).toBe(c.descriptionSha256);
    expect(c.mechanicsReview.mappedFacts).toMatchObject({
      modifiers: entry(c.name).modifiers,
      sources: entry(c.name).sources,
      prerequisites: entry(c.name).prerequisites ?? [],
      proficiencies: [],
    });
    for (const record of reviewedCuration.records.filter(
      (row) => row.externalKey === c.externalKey,
    ))
      expect(record.rationale).not.toContain(
        'ordinary charging AC penalty is not duplicated',
      );
    expect(c.mechanicsReview.curationRecords).toEqual(
      reviewedCuration.records.filter(
        (row) => row.externalKey === c.externalKey,
      ),
    );
    expect(c.mechanicsReview.outstandingCalculations).not.toEqual([]);
    const admitted = c.disposition === 'admitted';
    expect(c.holdIds).toEqual(
      admitted ? [] : [`feats-348-whole-content-${raw._id}`],
    );
    expect(c.noticeRequirementsComplete).toBe(admitted);
    expect(
      reviewedAdmission.assessments.find(
        (row) => row.externalKey === c.externalKey,
      ),
    ).toMatchObject({
      status: admitted ? 'confirmed' : 'unresolved',
      requiredNotices: c.requiredNotices,
      reviewedBy: 'Sol (AI curator) for the owner',
      reviewedOn: '2026-10-09',
    });
  }
});

it('reproduces reviewed outputs and binds admission to whole imported bodies', async () => {
  const artifact = await importCatalog(inputs);
  expect(artifact.curation.passed).toBe(true);
  expect(artifact.curation.summary.required).toBe(0);
  expect(artifact.curation.summary.descriptions.checked).toBe(100);
  expect(artifact.curation.unresolvedMechanics).toEqual([]);
  expect(artifact.curation.unresolvedDescriptions).toHaveLength(100);
  for (const row of artifact.catalog.entries) {
    expect(row.modifiers).toEqual(entry(row.name).modifiers);
    expect(row.situationalNotes).toEqual(entry(row.name).situationalNotes);
  }
  // The bounded fixture has no unrelated lookup records. Freeze the complete-source
  // prerequisite identities; fixture-only absence is not an attribution decision.
  const bound = {
    ...artifact,
    catalog: {
      ...artifact.catalog,
      entries: preview.entries.map((raw) => {
        const row = importedCatalogEntrySchema.parse(raw);
        if (row.detail.kind !== 'feat') throw new Error('Expected feat');
        return { ...row, detail: row.detail };
      }),
    },
  };
  const gate = assessCatalogAdmission({
    artifact: bound,
    ...reviewedAdmission,
  });
  expect(gate.failures).toEqual([]);
  expect(gate.admitted).toEqual([]);
  expect(gate.held).toHaveLength(100);
  expect(gate.dependentOmissions).toEqual([]);
  for (const row of bound.catalog.entries) {
    const c = review.candidates.find((c) => c.externalKey === row.externalKey);
    if (!c) throw new Error('Missing review');
    const context = {
      entry: row,
      artifact: bound,
      ...reviewedAdmission,
      evidence: { [c.evidenceId]: reviewedAdmission.evidence[c.evidenceId]! },
      requiredNotices: c.requiredNotices,
      evidenceIds: [c.evidenceId],
    };
    const binding = buildAssessmentBinding(context);
    expect(binding, c.name).toEqual(
      bindSnapshotToCurrentNotices(c.currentBinding),
    );
    const live = reviewedAdmission.assessments.find(
      (row) => row.externalKey === c.externalKey,
    );
    expect(live, c.name).toMatchObject(binding);
    expect(live?.requiredNotices, c.name).toEqual(c.requiredNotices);
    expect(
      reviewedAdmission.assessments.find(
        (c) => c.externalKey === row.externalKey,
      ),
    ).toMatchObject(binding);
    expect(
      buildAssessmentBinding({
        ...context,
        entry: { ...row, description: row.description + ' changed' },
      }).contentFingerprint,
    ).not.toBe(binding.contentFingerprint);
  }
});

it('enforces observed inherited notice minima and byte-exact PCGen comparisons', async () => {
  for (const c of review.candidates) {
    for (const dep of c.inheritedRuleNotices)
      expect(c.requiredNotices, c.name).toContain(dep.book);
    if (c.mechanicsReview.descriptionText.includes('Combat Trick'))
      expect(c.requiredNotices, c.name).toContain('PZO1131');
    if (c.name.includes('Mythic'))
      expect(c.requiredNotices, c.name).toContain('PZO1126');
    if (c.mechanicsReview.descriptionText.includes('Completion Benefit'))
      expect(c.requiredNotices, c.name).toContain('PZO1125');
    for (const lead of [c.comparison, ...c.additionalComparisonLeads]) {
      if (!lead) continue;
      const bytes = await readFile(
        join(fixtureRoot, 'comparison-sources', lead.path),
        'utf8',
      );
      const line = bytes.split('\n')[lead.line - 1];
      expect(line, c.name).toBe(lead.literalRow);
      expect(line?.split('\t')[0]?.trim(), c.name).toBe(c.name);
      expect(sha256(lead.literalRow)).toBe(lead.comparisonLineSha256);
      expect(sha256(bytes)).toBe(lead.comparisonFileSha256);
    }
    for (const support of c.inheritedRuleSourceEvidence)
      expect(
        sha256(await readFile(join(fixtureRoot, support.fixturePath), 'utf8')),
      ).toBe(support.sha256);
  }
  for (const n of review.noticeRequirements) {
    if (!n.holdId) continue;
    expect(heldNotices.find((h) => h.id === n.holdId)).toMatchObject({
      notices: expect.arrayContaining([n.book, ...n.registryKeys]),
      evidence: ['scripts/catalog/legal/feats-348.json'],
    });
  }
  for (const source of review.comparisonSources.pcgenFiles)
    expect(
      sha256(
        await readFile(
          join(fixtureRoot, 'comparison-sources', source.path),
          'utf8',
        ),
      ),
    ).toBe(source.sha256);
  const required = (name: string) =>
    review.candidates.find((c) => c.name === name)?.requiredNotices;
  expect(required('Freeze in Place')).toEqual(
    expect.arrayContaining([
      'PZO1116',
      'PZO1120',
      'PZO1127',
      'PZO1133',
      'PZO1137',
    ]),
  );
  expect(required('Engulf Horror')).toEqual(
    expect.arrayContaining(['PZO1116', 'PZO1120', 'PZO1127', 'PZO1133']),
  );
  expect(required('Engulf Horror')).not.toContain('PZO1112');
  const engulf = review.candidates.find((c) => c.name === 'Engulf Horror');
  expect(engulf?.inheritedRuleUnresolvedOrigins).toEqual([
    expect.objectContaining({
      rule: 'Smother',
      holdId: 'feats-348-whole-content-QgAJccNR8SCwbnrR',
      reason: expect.stringContaining('no source metadata'),
    }),
  ]);
  expect(required('Rat Stack')).toEqual(
    expect.arrayContaining(['PZO1121', 'PZO9280', 'PZO1120']),
  );
  expect(required('Guardian of Tradition')).toEqual(
    expect.arrayContaining(['PZO1117', 'PZO9283', 'PZO1140']),
  );
  expect(required('Armor Material Expertise')).toEqual(
    expect.arrayContaining(['PZO9061', 'PZO1123', 'PZO1131', 'PZO1110']),
  );
  expect(required('Hellknights Obedience')).toContain('PZO9293');
  expect(required('Extra Crystalline Dust')).toContain('PZO1141');
  expect(required('Mindfulness Mastery')).toEqual(
    expect.arrayContaining(['PZO9473', 'PZO9436']),
  );
});

it('keeps its own description records, assessments, evidence and holds as recorded', () => {
  expect(
    findCommittedBatchOwnershipProblems('scripts/catalog/legal/feats-348.json'),
  ).toEqual([]);
});
it('keeps its whole-history preservation manifest on disk until the #744 cleanup', () => {
  // #749 retired this manifest's checks; the file itself stays as recorded.
  expect(originals.assessments).toHaveLength(3132);
});

it('reconstructs the fixture from reviewable files with portable temporary storage', async () => {
  const { mkdtemp, mkdir, copyFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const isolated = await mkdtemp(join(tmpdir(), 'feats-348-tracked-only-'));
  try {
    for (const file of [
      'pf1/public/system.json',
      'pf1/packs/.gitkeep',
      'pf1-content/module.json',
      ...review.candidates.map((row) => `pf1-content/${row.source.path}`),
    ]) {
      await mkdir(dirname(join(isolated, file)), { recursive: true });
      await copyFile(join(fixtureRoot, file), join(isolated, file));
    }
    const artifact = await importCatalog({
      ...inputs,
      systemPath: join(isolated, 'pf1'),
      contentPath: join(isolated, 'pf1-content'),
    });
    expect(artifact.catalog.entries.map((row) => row.externalKey)).toEqual(
      provenance.candidates.map((row) => row.externalKey),
    );
    expect(artifact.curation.summary.descriptions.checked).toBe(100);
    expect(artifact.curation.passed).toBe(true);
  } finally {
    await rm(isolated, { recursive: true, force: true });
  }
});

it('resolves balance and falling saves only in their exact local scopes, with nonstacking copies', () => {
  const rows = modifiers('Sure-Footed');
  expect(resolveSheet(rows)['skill.acr'].total).toBe(0);
  expect(resolveSheet(rows)['save.ref'].total).toBe(0);
  expect(
    resolveSheet(rows, { situations: [situation('Sure-Footed')] })['skill.acr']
      .total,
  ).toBe(2);
  expect(
    resolveSheet(rows, { situations: [situation('Sure-Footed', 1)] })[
      'save.ref'
    ].total,
  ).toBe(2);
  expect(
    resolveSheet(rows, { situations: ['charging'] })['save.ref'].total,
  ).toBe(0);
  expect(
    resolveSheet(rows, {
      situations: [{ ...situation('Sure-Footed'), sheetEntryId: 'foreign' }],
    })['skill.acr'].total,
  ).toBe(0);
  const copies = rows.map((row) => ({
    ...row,
    sheetEntryId: 'copy',
    catalogEntryId: 'copy',
  }));
  expect(
    resolveSheet([...rows, ...copies], {
      situations: [
        situation('Sure-Footed'),
        { ...situation('Sure-Footed'), sheetEntryId: 'copy' },
      ],
    })['skill.acr'].total,
  ).toBe(2);
  expect(
    calculateCharacterSheetProjections(reviewedFeatSheet('Sure-Footed')).current
      .breakdowns['skill.acr'].total,
  ).toBe(0);
});

it('keeps secret messages, measured foes and holy-water Heal tasks narrower than ordinary skills', () => {
  expect(resolveSheet(modifiers('Secret Language'))['skill.blf'].total).toBe(0);
  expect(
    resolveSheet(modifiers('Secret Language'), {
      situations: [situation('Secret Language')],
    })['skill.blf'].total,
  ).toBe(5);
  const measured = resolveSheet(modifiers('Measure Foe'), {
    situations: [situation('Measure Foe', 1)],
  });
  expect([
    measured['attack.melee'].total,
    measured['attack.ranged'].total,
    measured['ac.other'].total,
  ]).toEqual([1, 1, 1]);
  expect(
    resolveSheet(modifiers('Measure Foe'), {
      situations: [situation('Measure Foe')],
    })['skill.sen'].total,
  ).toBe(-10);
  const water = modifiers('Holy Water Assault');
  expect(
    resolveSheet(water, { situations: ['poison'] })['skill.hea'].total,
  ).toBe(0);
  expect(
    resolveSheet(water, { situations: [situation('Holy Water Assault', 2)] })[
      'skill.hea'
    ].total,
  ).toBe(4);
  expect(resolveSheet(modifiers('Derro Magister'))['skill.hea'].total).toBe(4);
});

it('preserves exact spell-DC alternatives and the selected regeneration tradeoff', () => {
  const favored = modifiers('Favored Enemy Spellcasting');
  expect(resolveSheet(favored).spellDC.total).toBe(0);
  expect(
    resolveSheet(favored, {
      situations: [situation('Favored Enemy Spellcasting')],
    }).spellDC.total,
  ).toBe(1);
  expect(
    resolveSheet(favored, {
      situations: [situation('Favored Enemy Spellcasting', 1)],
    }).spellDC.total,
  ).toBe(2);
  expect(
    resolveSheet(favored, {
      situations: [
        situation('Favored Enemy Spellcasting'),
        situation('Favored Enemy Spellcasting', 1),
      ],
    }).spellDC.total,
  ).toBe(2);
  expect(
    resolveSheet(modifiers('Witch Knife (Mythic)'), {
      situations: [situation('Witch Knife (Mythic)')],
    }).spellDC.total,
  ).toBe(1);
  expect(
    resolveSheet(modifiers('Regenerate Muscles'))['ability.str'].total,
  ).toBe(0);
  expect(
    resolveSheet(modifiers('Regenerate Muscles'), {
      situations: [situation('Regenerate Muscles')],
    })['ability.str'].total,
  ).toBe(2);
  const projected = calculateCharacterSheetProjections(
    reviewedFeatSheet('Regenerate Muscles'),
  );
  expect(projected.current.breakdowns['ability.str'].total).toBe(10);
  expect(projected.permanent.breakdowns['ability.str'].total).toBe(10);
});

it('applies no-rank Improvisation only to the selected skill and preserves replacement rules as Notes', () => {
  const rows = modifiers('Improvisation');
  const index = rows.findIndex((row) => row.target === 'skill.per');
  const selected = resolveSheet(rows, {
    situations: [situation('Improvisation', index)],
  });
  expect(selected['skill.per'].total).toBe(2);
  expect(selected['skill.ste'].total).toBe(0);
  expect(resolveSheet(rows)['skill.per'].total).toBe(0);
  for (const name of [
    'Improved Improvisation',
    'Improved Stonecunning',
    'Sure Grasp',
    'Ferocious Feint',
    'Draconic Heritage',
    'Draconic Manifestation',
    'Armor Material Expertise',
    'Hellknights Obedience',
    'Ambuscading Spell',
    'Lastwall Phalanx',
  ])
    expect(entry(name).modifiers, name).toEqual([]);
  expect(entry('Hellknights Obedience').description).toContain(
    'Performing a Reckoning',
  );
  expect(entry("Marksman's Utility").description).toContain("Marksman's Deed");
  expect(entry('Draconic Heritage').description).toContain('Linnorm');
});

it('keeps both restated Charging Hurler baselines manual while preserving its complete charge permission', () => {
  const hurler = entry('Charging Hurler');
  expect(hurler.modifiers).toEqual([]);
  for (const situations of [[], ['charging']]) {
    const selected = resolveSheet(modifiers('Charging Hurler'), { situations });
    expect(selected['attack.ranged'].total).toBe(0);
    expect(selected['attack.melee'].total).toBe(0);
    expect(selected['ac.other'].total).toBe(0);
  }
  const candidate = review.candidates.find((c) => c.name === 'Charging Hurler');
  if (!candidate) throw new Error('Missing Charging Hurler review');
  // Full source equality is independently pinned for every candidate above.
  expect(hurler.description).toBe(candidate.mechanicsReview.descriptionText);
  const readable = hurler.situationalNotes?.map((note) => note.text).join(' ');
  for (const phrase of [
    'You can use the charge rules to make a thrown weapon attack',
    'must only move closer to your opponent',
    'within 30 feet',
    'gaining the +2 bonus on the attack roll',
    'taking a -2 penalty to your AC until the start of your next turn',
    'spend 2 stamina points',
    'within 50 feet',
  ])
    expect(readable).toContain(phrase);
  expect(candidate.mechanicsReview.outstandingCalculations.join(' ')).toContain(
    'Permission to throw during a charge',
  );
  expect(candidate.mechanicsReview.outstandingCalculations.join(' ')).toContain(
    'shared charging Situation is a label and applies neither',
  );
  expect(
    resolveSheet(modifiers('Master Sniper'), {
      situations: [situation('Master Sniper')],
    })['attack.ranged'].total,
  ).toBe(-2);
  expect(
    resolveSheet(modifiers('Bull-Catcher Style'), {
      situations: ['grapple', 'charging'],
    }).cmb.total,
  ).toBe(0);
  expect(
    resolveSheet(modifiers('Bull-Catcher Style'), {
      situations: [situation('Bull-Catcher Style')],
    }).cmb.total,
  ).toBe(2);
  expect(
    resolveSheet(modifiers('Bull-Catcher Style'), {
      situations: [
        { ...situation('Bull-Catcher Style'), sheetEntryId: 'foreign' },
      ],
    }).cmb.total,
  ).toBe(0);
});

it('adds Sisterhood Rampart to the existing shield bonus only in its Style/Shield Wall scope', () => {
  const rows = modifiers('Sisterhood Rampart');
  const existing = {
    ...rows[0]!,
    value: 5,
    bonusType: 'shield' as const,
    condition: undefined,
    source: 'equipped-shield',
    sheetEntryId: 'equipped-shield',
    catalogEntryId: 'equipped-shield',
  };
  expect(resolveSheet([existing, ...rows])['ac.shield'].total).toBe(5);
  expect(
    resolveSheet([existing, ...rows], {
      situations: [situation('Sisterhood Rampart')],
    })['ac.shield'].total,
  ).toBe(6);
  expect(
    resolveSheet([existing, ...rows], { situations: ['bullRush'] }).cmd.total,
  ).toBe(0);
});

it('records Rat Stack as three participants or four with Tunnel Rat without changing its source body', () => {
  const candidate = review.candidates.find((c) => c.name === 'Rat Stack');
  if (!candidate) throw new Error('Missing Rat Stack review');
  expect(entry('Rat Stack').description).toBe(
    candidate.mechanicsReview.descriptionText,
  );
  expect(entry('Rat Stack').description).toContain('up to two other creatures');
  expect(entry('Rat Stack').description).toContain(
    'up to four creatures can share',
  );
  expect(candidate.mechanicsReview.outstandingCalculations).toEqual([
    'Same-square limit of three or four creatures with Tunnel Rat and same-feat participation remains manual.',
  ]);
  expect(entry('Rat Stack').modifiers).toEqual([]);
});
