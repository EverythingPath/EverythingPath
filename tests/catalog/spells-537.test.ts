// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { importCatalog } from '../../scripts/catalog/import';
import {
  sourceDescription,
  upstreamRecord,
} from '../../scripts/catalog/records';
import {
  assessCatalogAdmission,
  buildAssessmentBinding,
} from '../../scripts/catalog/admission';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import remaps from '../../scripts/catalog/reviewed-remaps.json';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import { withFullBindingContext738 } from './full-binding-context-738';
import { calculateCharacterSheetProjections } from '../../src/lib/character-sheet';
import {
  review,
  preview,
  pinnedFiles,
  pinnedSha256,
} from '../fixtures/spells-537/data';
import { recordedSpellSheet, spellFixture } from '../fixtures/spells-537/sheet';
import { materializePinnedTree, readPinned } from './pinned-sources';
import { bindSnapshotToCurrentNotices } from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';

const REVIEWER = 'Opus (AI curator) for the owner';
const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
const keys = review.candidates.map((row) => row.externalKey);
function candidate(name: string) {
  const row = review.candidates.find((row) => row.name === name);
  if (!row) throw new Error(`Missing review of ${name}`);
  return row;
}
function record(externalKey: string) {
  const row = reviewedCuration.records.find(
    (current) =>
      current.externalKey === externalKey && current.kind === 'description',
  );
  if (!row) throw new Error(`Missing description record for ${externalKey}`);
  return row;
}

it('pins all 100 complete roots, checked description records and notice holds', async () => {
  expect(review.candidates).toHaveLength(100);
  expect(new Set(keys).size).toBe(100);
  expect(review.counts).toMatchObject({
    total: 100,
    admitted: 0,
    held: 100,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 0,
    recordLevel35Holds: 0,
  });
  expect(review.mechanicsSummary).toMatchObject({
    checkedDescriptionRecords: 100,
    recordsWithNotes: 81,
    protectedRoots: 19,
    sharedSituationNotes: 5,
    passiveModifiers: 0,
  });
  expect(preview.entries.map((row) => row.externalKey).sort()).toEqual(
    [...keys].sort(),
  );
  const holds = new Map(heldNotices.map((hold) => [hold.id, hold.notices]));
  for (const row of review.candidates) {
    const bytes = await readPinned(row.source.repo, row.source.path);
    expect(sha(bytes), row.name).toBe(row.source.sha256);
    const raw = upstreamRecord.parse(parse(bytes.toString()));
    expect(`pf1/${raw._id}`).toBe(row.externalKey);
    expect(raw.name).toBe(row.name);
    expect(raw.type).toBe('spell');
    expect(raw.system.sources).toEqual(row.citedSources);
    expect(raw.system.learnedAt).toEqual(row.learnedAt);
    const description = sourceDescription(raw);
    expect(sha(description)).toBe(row.descriptionSha256);

    const reviewed = record(row.externalKey);
    expect(row.mechanicsReview.curationRecords).toEqual([reviewed]);
    expect(reviewed).toMatchObject({
      kind: 'description',
      target: 'description',
      text: description,
      textSha256: sha(description),
      status: 'checked',
      reviewedBy: REVIEWER,
      reviewedOn: '2026-10-12',
    });
    expect(reviewed.outputs.every((output) => output.kind === 'note')).toBe(
      true,
    );
    if (row.mechanicsReview.protectedHistoricalContext) {
      expect(reviewed.outputs).toEqual([]);
      expect(reviewed.diagnostics).toEqual([]);
    } else {
      expect(reviewed.outputs[0]).toMatchObject({ kind: 'note' });
      expect(reviewed.diagnostics).toEqual([
        {
          kind: 'unresolved',
          text: row.mechanicsReview.outstandingCalculations[0],
        },
      ]);
    }
    expect(row.mechanicsReview.outstandingCalculations).toHaveLength(1);

    // Own books, CRB spell rules, Unchained action metadata and inherited rules.
    expect(row.requiredNotices[0]).toBe('CRB');
    expect(row.requiredNotices).toEqual(
      expect.arrayContaining(['PZO1110', 'PZO1131']),
    );
    for (const book of [
      ...row.citedSources.map((source) => source.id),
      ...row.inheritedRuleNotices.map((rule) => rule.book),
    ])
      expect(row.requiredNotices, row.name).toContain(book);
    for (const body of row.inheritedRuleSourceEvidence)
      expect(
        body.sources.some((source) => row.requiredNotices.includes(source.id)),
        `${row.name} <- ${body.name}`,
      ).toBe(true);
    expect(row.noticeHoldIds).toEqual(
      row.requiredNotices
        .filter((code) => code !== 'CRB' && code !== 'PZO1110')
        .map((code) => `spells-537-notice-${code}-complete-chain`),
    );
    for (const id of row.noticeHoldIds)
      expect(holds.get(id), id).toEqual([id.split('-')[3]]);
    expect(row.holdIds).toEqual([
      `spells-537-whole-content-${row.externalKey.split('/')[1]}`,
    ]);

    for (const body of [
      ...row.inheritedRuleSourceEvidence,
      ...row.linkedContentReview,
    ]) {
      if (!body.path) continue;
      const support = await readPinned('pf1', body.path);
      expect(sha(support), body.path).toBe(body.sha256);
      // The Spellcraft link is a journal page; its file is the rules journal.
      if (!body.descriptionSha256) continue;
      const supported = upstreamRecord.parse(parse(support.toString()));
      expect(`pf1/${supported._id}`).toBe(body.externalKey);
      expect(sha(sourceDescription(supported))).toBe(body.descriptionSha256);
    }
  }
  const crb = review.noticeRequirements.find((row) => row.book === 'PZO1110');
  expect(crb).toMatchObject({ registryKeys: ['CRB'], holdId: null });
  expect(
    review.noticeRequirements.filter((row) => row.holdId !== null),
  ).toHaveLength(51);
});

it('keeps the literal PCGen rows, publication anchors and recorded discrepancies', async () => {
  const files = new Map<string, string>();
  for (const file of review.comparisonSources.pcgenFiles) {
    const bytes = await readFile(`tests/fixtures/pinned/pcgen/${file.path}`);
    expect(sha(bytes), file.path).toBe(file.sha256);
    files.set(file.path, bytes.toString());
  }
  let rootComparisons = 0;
  for (const row of review.candidates) {
    for (const comparison of [
      row.comparison,
      ...row.additionalComparisonLeads,
    ]) {
      if (!comparison) continue;
      const lines = files.get(comparison.path)?.split(/\r?\n/) ?? [];
      expect(lines[comparison.line - 1]).toBe(comparison.literalRow);
      expect(sha(comparison.literalRow)).toBe(comparison.comparisonLineSha256);
      const anchor = lines[comparison.publicationAnchor.line - 1] ?? '';
      expect(anchor.split('\t')).toContain(comparison.publicationAnchor.text);
    }
    if (row.comparison) {
      rootComparisons += 1;
      expect(row.comparison.appliesToRootBody).toBe(true);
      expect(row.citedSources.map((source) => source.id)).toContain(
        row.comparison.book,
      );
    }
  }
  expect(rootComparisons).toBe(87);
  // Row-level publication override: Mummy's Mask #4 is PZO9082.
  expect(candidate('Bestow Curse, Greater').comparison).toMatchObject({
    book: 'PZO9082',
    publicationAnchor: { text: 'SOURCELONG:Secrets of the Sphinx' },
  });
  // The 2009 Book of the Damned row is a variant lead, not PZO1139 evidence.
  const vision = candidate('Vision of Hell');
  expect(vision.comparison?.book).toBe('PZO1117');
  expect(vision.additionalComparisonLeads).toMatchObject([
    { book: null, appliesToRootBody: false },
  ]);
  expect(vision.mechanicsReview.sourceDiscrepancies.join(' ')).toContain(
    'Princes of Darkness, Book of the Damned, Volume 1',
  );
  expect(
    candidate('Glyph of Warding, Greater').mechanicsReview.sourceDiscrepancies,
  ).toEqual([
    expect.stringMatching(
      /at least 400 gp, but its structured material fields .*materials\.gpValue 200.*powdered diamond worth 200 gp.* say 200 gp/,
    ),
  ]);
  // Both conflicting values stay as pinned: 400 gp in the body, 200 gp in materials.
  const glyph = candidate('Glyph of Warding, Greater');
  const glyphRaw = upstreamRecord.parse(
    parse((await readPinned('pf1', glyph.source.path)).toString()),
  );
  expect(sourceDescription(glyphRaw)).toContain(
    'powdered diamond worth at least 400 gp',
  );
  expect(glyphRaw.system.materials).toEqual({
    gpValue: 200,
    value: 'powdered diamond worth 200 gp',
  });
  const ironskin = candidate('Ironskin');
  expect(ironskin.comparison?.descriptionComparison).toMatch(
    /^differs-in-scaling-clause: /,
  );
  expect(ironskin.mechanicsReview.sourceDiscrepancies).toEqual([
    expect.stringContaining('above 4th; PCGen mc_spells.lst:17 says above 3rd'),
  ]);
  expect(candidate('Path of the Winds').comparison).toMatchObject({
    sourcePage: 'p.161',
    pageMatchesCitation: false,
  });
});

it('records the inherited-rule notices of governing bodies, cited creatures and maneuvers', () => {
  const requires = (name: string) => candidate(name).requiredNotices;
  expect(requires('Implanted Projection')).toContain('PZO1132');
  expect(requires('Sacramental Seal')).toContain('PZO1132');
  expect(requires('Appearance of Life, Greater')).toContain('PZO1135');
  expect(requires('Ant Haul, Communal')).toContain('PZO1115');
  expect(requires('Pernicious Pranksters')).toContain('PZO1115');
  expect(requires('Blood Transcription')).toContain('PZO1115');
  expect(requires("Alaznist's Jinx")).toContain('PZO1117');
  expect(requires('Cloak of Shadows')).toContain('PZO1116');
  expect(requires('Naga Shape III')).toEqual(
    expect.arrayContaining(['PZO1112', 'PZO1116', 'PZO9473']),
  );
  for (const name of [
    "Calistria's Guardian Wasps",
    'Abyssal Vermin',
    'Grim Stalker',
    'Giant Vermin',
    'Elemental Swarm',
    'Elemental Body I',
    'Monstrous Physique III',
  ])
    expect(requires(name), name).toContain('PZO1112');
  // Linked removal spells are references, not inherited rule bodies.
  const curse = candidate('Bestow Curse, Greater');
  expect(curse.inheritedRuleSourceEvidence).toEqual([]);
  expect(curse.linkedContentReview.map((row) => row.name).sort()).toEqual([
    'Abeyance',
    'Break Enchantment',
    'Limited Wish',
    'Miracle',
    'Remove Curse',
    'Wish',
  ]);
  expect(
    review.metadataImportGaps.find(
      (row) =>
        row.externalKey === candidate('Implanted Projection').externalKey,
    ),
  ).toMatchObject({ published: ['emotion', 'mindAffecting'], imported: [] });
  expect(review.metadataImportGaps).toHaveLength(52);
});

it('records Spells without changing holder statistics and surfaces only their scoped Notes', () => {
  for (const [name, tag] of [
    ['Ironskin', 'druid'],
    ['Oath of Peace', 'paladin'],
    ['Aspect of the Nightingale', 'bard'],
    ['Cloak of Shadows', 'bard'],
    ["Zephyr's Fleetness", 'ranger'],
    ['Ape Walk', 'druid'],
    ["Heroes' Feast", 'cleric'],
    ['Invisibility', 'wizard'],
  ] as const) {
    const result = calculateCharacterSheetProjections(
      recordedSpellSheet(name, tag),
    );
    for (const projection of [result.current, result.permanent]) {
      expect(projection.abilities.strength.score, name).toBe(10);
      expect(projection.breakdowns['ac.natural'].total, name).toBe(0);
      expect(projection.breakdowns['ac.other'].total, name).toBe(0);
      expect(projection.breakdowns['save.will'].total, name).toBe(0);
      expect(projection.breakdowns['skill.ste'].total, name).toBe(0);
      expect(projection.breakdowns['skill.clm'].total, name).toBe(0);
      expect(projection.breakdowns['skill.dip'].total, name).toBe(0);
      expect(projection.spellEffects, name).toEqual([]);
    }
  }
  const feast = calculateCharacterSheetProjections(
    recordedSpellSheet("Heroes' Feast", 'cleric'),
  ).current;
  expect(feast.entryNotes.map((note) => note.situation ?? null).sort()).toEqual(
    [null, 'fear', 'poison'].sort(),
  );
  expect(spellFixture("Heroes' Feast").situationalNotes).toContainEqual({
    situation: 'poison',
    text: "Only for a creature that partook of this Heroes' Feast (12 hours): +4 morale bonus on saving throws against poison.",
  });
  expect(spellFixture('Discordant Blast').situationalNotes).toContainEqual(
    expect.objectContaining({ situation: 'bullRush' }),
  );
  expect(spellFixture('Vision of Hell').situationalNotes).toContainEqual(
    expect.objectContaining({ situation: 'fear' }),
  );
  // Protected roots keep their earlier-batch fingerprints: no Notes at all.
  expect(spellFixture('Invisibility').situationalNotes).toBeUndefined();
  expect(
    calculateCharacterSheetProjections(
      recordedSpellSheet('Invisibility', 'wizard'),
    ).current.entryNotes,
  ).toEqual([]);
});

it('reextracts every root from a clean shared fixture tree and holds every root', async () => {
  const tree = await materializePinnedTree(pinnedFiles, {
    sha256: pinnedSha256,
  });
  try {
    const artifact = await importCatalog({
      ...tree,
      remaps,
      curation: reviewedCuration,
      candidateKeys: keys,
    });
    expect(artifact.curation.passed).toBe(true);
    expect(artifact.curation.missing).toEqual([]);
    expect(artifact.curation.stale).toEqual([]);
    expect(artifact.curation.summary.descriptions).toMatchObject({
      candidates: 100,
      checked: 100,
    });
    expect(artifact.catalog.entries).toHaveLength(100);
    for (const row of artifact.catalog.entries) {
      const saved = spellFixture(row.name);
      expect({
        description: row.description,
        detail: row.detail,
        modifiers: row.modifiers,
        situationalNotes: row.situationalNotes,
        sources: row.sources,
        unsupported: row.unsupported,
      }).toEqual({
        description: saved.description,
        detail: saved.detail,
        modifiers: saved.modifiers,
        situationalNotes: saved.situationalNotes,
        sources: saved.sources,
        unsupported: saved.unsupported,
      });
    }
    // #738 supplies full context for the affected bindings; extraction stays bounded.
    const bounded = {
      ...artifact,
      catalog: { ...artifact.catalog, entries: preview.entries },
    };
    for (const row of review.candidates) {
      const assessment = reviewedAdmission.assessments.find(
        (current) => current.externalKey === row.externalKey,
      );
      expect(assessment).toMatchObject({
        status: 'unresolved',
        ...bindSnapshotToCurrentNotices(row.currentBinding),
        requiredNotices: row.requiredNotices,
        rationale: row.holdReason,
        reviewedBy: REVIEWER,
      });
      expect(
        buildAssessmentBinding({
          ...withFullBindingContext738({
            artifact: bounded,
            entry: spellFixture(row.name),
          }),
          requiredNotices: row.requiredNotices,
          evidenceIds: [row.evidenceId],
          ...reviewedAdmission,
        }),
      ).toEqual(bindSnapshotToCurrentNotices(row.currentBinding));
    }

    // With every linked body present, no root fails and none is admitted.
    const linked = await importCatalog({
      ...tree,
      remaps,
      curation: reviewedCuration,
    });
    const gate = assessCatalogAdmission({
      artifact: linked,
      ...reviewedAdmission,
    });
    const ours = new Set(keys);
    expect(gate.admitted.filter((row) => ours.has(row.externalKey))).toEqual(
      [],
    );
    // #738 keeps the root's rules journal link as text: no root fails.
    expect(gate.failures.filter((row) => ours.has(row.externalKey))).toEqual(
      [],
    );
    expect(review.referenceImportGaps).toMatchObject([
      {
        externalKey: candidate('Glyph of Warding, Greater').externalKey,
        field: 'description.link',
      },
    ]);
    expect(gate.held.filter((row) => ours.has(row.externalKey))).toHaveLength(
      100,
    );
    // Confirming one root still holds it on the unreviewed Unchained notice.
    const feast = candidate("Heroes' Feast");
    const confirmed = assessWithUnclearedHolds({
      artifact: linked,
      ...reviewedAdmission,
      assessments: reviewedAdmission.assessments.map((row) =>
        row.externalKey === feast.externalKey
          ? {
              ...row,
              status: 'confirmed' as const,
              ...buildAssessmentBinding({
                artifact: linked,
                entry: spellFixture("Heroes' Feast"),
                requiredNotices: feast.requiredNotices,
                evidenceIds: [feast.evidenceId],
                ...reviewedAdmission,
              }),
            }
          : row,
      ),
    });
    // PZO1131 is reviewed (2026-10-30): its uncleared chain holds hold it.
    expect(
      confirmed.held.find((row) => row.externalKey === feast.externalKey)
        ?.reason,
    ).toMatch(/^Notice holds: PZO1131 \(/);
    expect(
      confirmed.admitted.some((row) => row.externalKey === feast.externalKey),
    ).toBe(false);
  } finally {
    await tree.dispose();
  }
});
