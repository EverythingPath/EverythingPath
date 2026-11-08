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
} from '../fixtures/spells-538/data';
import { recordedSpellSheet, spellFixture } from '../fixtures/spells-538/sheet';
import { materializePinnedTree, readPinned } from './pinned-sources';
import { bindSnapshotToCurrentNotices } from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';

const REVIEWER = 'Opus (AI curator) for the owner';
const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
const keys = review.candidates.map((row) => row.externalKey);
const noticeHold = (code: string) => `spells-538-notice-${code}-complete-chain`;
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
  expect(review.counts).toEqual({
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
    recordsWithNotes: 76,
    protectedRoots: 24,
    sharedSituationNotes: 0,
    localSituationNotes: 0,
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
    if (row.mechanicsReview.protectedHistoricalContext) {
      expect(reviewed.outputs).toEqual([]);
      expect(reviewed.diagnostics).toEqual([]);
    } else {
      // One readable Note of the whole description, no Situation.
      expect(reviewed.outputs).toEqual([
        { kind: 'note', text: expect.any(String) },
      ]);
      expect(reviewed.diagnostics).toEqual([
        {
          kind: 'unresolved',
          text: row.mechanicsReview.outstandingCalculations[0],
        },
      ]);
    }
    expect(row.mechanicsReview.outstandingCalculations).toHaveLength(1);
    expect(row.mechanicsReview.sharedSituations).toEqual([]);

    // Own books, CRB spell rules, Unchained action metadata and inherited rules.
    expect(row.requiredNotices[0]).toBe('CRB');
    expect(row.requiredNotices).toEqual(
      expect.arrayContaining(['PZO1110', 'PZO1131']),
    );
    const actions = raw.system.actions as
      | { activation?: { unchained?: unknown } }[]
      | undefined;
    expect(
      actions?.some((action) => Boolean(action.activation?.unchained)),
      row.name,
    ).toBe(true);
    for (const source of row.citedSources)
      if (typeof source.id === 'string')
        expect(row.requiredNotices, row.name).toContain(source.id);
    for (const rule of row.inheritedRuleNotices)
      expect(row.requiredNotices, row.name).toContain(rule.book);
    for (const body of row.inheritedRuleSourceEvidence)
      expect(
        body.sources.some((source) => row.requiredNotices.includes(source.id)),
        `${row.name} <- ${body.name}`,
      ).toBe(true);
    expect(row.noticeHoldIds).toEqual(
      row.requiredNotices
        .filter((code) => code !== 'CRB' && code !== 'PZO1110')
        .map(noticeHold),
    );
    for (const code of row.requiredNotices.slice(1))
      if (code !== 'PZO1110')
        expect(holds.get(noticeHold(code)), code).toEqual([code]);
    expect(row.holdIds[0]).toBe(
      `spells-538-whole-content-${row.externalKey.split('/')[1]}`,
    );

    for (const body of row.inheritedRuleSourceEvidence) {
      const support = await readPinned('pf1', body.path);
      expect(sha(support), body.path).toBe(body.sha256);
      const supported = upstreamRecord.parse(parse(support.toString()));
      expect(`pf1/${supported._id}`).toBe(body.externalKey);
      expect(supported.system.sources).toEqual(body.sources);
      expect(sha(sourceDescription(supported))).toBe(body.descriptionSha256);
    }
    for (const cited of row.inheritedRuleCitations) {
      const bytes = await readPinned(cited.repo, cited.path);
      expect(sha(bytes), cited.path).toBe(cited.sha256);
      expect(bytes.toString().split('\n')[cited.line - 1]).toContain(
        cited.literalQuote,
      );
      expect(row.requiredNotices).toContain(cited.book);
    }
  }
  const crb = review.noticeRequirements.find((row) => row.book === 'PZO1110');
  expect(crb).toMatchObject({ registryKeys: ['CRB'], holdId: null });
  const held = review.noticeRequirements.filter((row) => row.holdId !== null);
  expect(held).toHaveLength(44);
  for (const requirement of held)
    expect(holds.get(requirement.holdId ?? '')).toEqual([requirement.book]);
  // The blog-only root keeps a specific origin hold and no backfilled book code.
  const root = candidate('Root');
  expect(root.citedSources).toEqual([
    expect.objectContaining({ name: 'Paizo Blog - Ultimate Cantrips' }),
  ]);
  expect(root.requiredNotices).toEqual(['CRB', 'PZO1110', 'PZO1131']);
  expect(root.holdIds).toEqual([
    'spells-538-whole-content-qdiec9pwx6jclgla',
    'spells-538-Root-blog-origin',
  ]);
});

it('keeps the literal PCGen rows, publication anchors and recorded page discrepancies', async () => {
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
      const lines = files.get(comparison.path)?.split('\n') ?? [];
      expect(lines[comparison.line - 1]).toBe(comparison.literalRow);
      expect(sha(comparison.literalRow)).toBe(comparison.comparisonLineSha256);
      // Some files declare their publication in the dataset's .pcc file.
      const anchor =
        files.get(comparison.publicationAnchor.path)?.split('\n')[
          comparison.publicationAnchor.line - 1
        ] ?? '';
      expect(anchor.split('\t')).toContain(comparison.publicationAnchor.text);
      expect(row.citedSources.map((source) => source.id)).toContain(
        comparison.book,
      );
      expect(comparison.appliesToRootBody).toBe(true);
    }
    if (row.comparison) rootComparisons += 1;
  }
  expect(rootComparisons).toBe(95);
  expect(
    review.candidates
      .filter((row) => !row.comparison)
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Entomb',
    'Peasant Armaments',
    'Root',
    'Soul Transfer',
    'Summon Cacodaemon',
  ]);
  // Two cited publications have their own PCGen rows.
  const infernal = candidate('Infernal Healing');
  expect(
    [infernal.comparison, ...infernal.additionalComparisonLeads].map(
      (row) => row?.book,
    ),
  ).toEqual(['PZO9000-18E', 'PZO9226']);
  expect(candidate("Cheetah's Sprint").comparison).toMatchObject({
    sourcePage: 'p.31',
    pageMatchesCitation: false,
  });
  expect(
    candidate("Cheetah's Sprint").mechanicsReview.sourceDiscrepancies,
  ).toEqual([
    'PCGen hotw_spells.lst:11 cites p.31; the pinned source cites 30.',
  ]);
  expect(candidate('Ablative Sphere').comparison).toMatchObject({
    path: 'data/pathfinder/paizo/player_companion/humans_of_golarion/hog_spells.lst',
    sourcePage: 'p.27',
    pageMatchesCitation: false,
    publicationAnchor: {
      text: 'SOURCELONG:Pathfinder Player Companion: Humans of Golarion',
    },
  });
  expect(
    review.candidates.filter(
      (row) => row.mechanicsReview.sourceDiscrepancies.length,
    ),
  ).toHaveLength(2);
});

it('records the inherited-rule notices of governing bodies, cited creatures, templates and class rules', () => {
  const requires = (name: string) => candidate(name).requiredNotices;
  const governing = (name: string) =>
    candidate(name).inheritedRuleSourceEvidence.map((body) => body.name);
  expect(requires('Aquatic Cavalry')).toContain('PZO1116');
  expect(requires('Soul Transfer')).toContain('PZO1116');
  expect(governing('Soul Transfer')).toEqual(['Trap the Soul']);
  expect(requires('Summon Cacodaemon')).toContain('PZO1116');
  expect(governing('Summon Cacodaemon')).toEqual(['Summon Monster I']);
  expect(requires('Summon Minor Monster')).toContain('PZO1112');
  expect(
    candidate('Summon Minor Monster').inheritedRuleCitations.map(
      (row) => row.name,
    ),
  ).toEqual(['Celestial', 'Fiendish']);
  for (const name of [
    'Animate Plants',
    'Twine Double',
    'Draconic Suppression',
    'Ice Body',
    'Fey Form I',
  ])
    expect(requires(name), name).toContain('PZO1112');
  expect(requires('Ignoble Form')).toContain('PZO1121');
  expect(requires('Build Trust')).toContain('PZO1125');
  expect(requires('Prosperous Room')).toContain('PZO1125');
  expect(requires('Runic Overload')).toContain('PZO9229');
  for (const name of [
    'Hex Ward',
    'Strangling Hair',
    'Majestic Image',
    'Life Conduit, Improved',
  ])
    expect(requires(name), name).toContain('PZO1115');
  expect(requires('Line in the Sand')).toContain('PZO1117');
  expect(requires("Dahak's Release")).toEqual(
    expect.arrayContaining(['PZO1115', 'PZO1129', 'PZO9470']),
  );
  expect(governing("Dahak's Release")).toEqual(['Confusion', 'Rage']);
  // A governing body's own governing body is kept for the fixture closure.
  expect(governing('Charm Monster, Mass')).toEqual([
    'Charm Monster',
    'Charm Person',
  ]);
  expect(governing('Mind Thrust VI')).toEqual([
    'Mind Thrust IV',
    'Mind Thrust I',
  ]);
  expect(
    review.metadataImportGaps.find(
      (row) => row.externalKey === candidate('Sadomasochism').externalKey,
    ),
  ).toMatchObject({ published: ['pain'], imported: [] });
  expect(review.metadataImportGaps).toHaveLength(42);
  expect(review.referenceImportGaps).toEqual([]);
});

it('records Spells without changing holder statistics and surfaces only their readable Notes', () => {
  for (const [name, tag] of [
    ['Aldori Alacrity', 'bard'],
    ['Expeditious Retreat', 'wizard'],
    ['Extreme Flexibility', 'wizard'],
    ['Fiery Body', 'wizard'],
    ['Root', 'wizard'],
    ['Divide Mind', 'psychic'],
    ['Hex Ward', 'witch'],
    ['Displacement', 'wizard'],
  ] as const) {
    const result = calculateCharacterSheetProjections(
      recordedSpellSheet(name, tag),
    );
    for (const projection of [result.current, result.permanent]) {
      expect(projection.abilities.dexterity.score, name).toBe(10);
      expect(projection.breakdowns['ac.natural'].total, name).toBe(0);
      expect(projection.breakdowns['ac.other'].total, name).toBe(0);
      expect(projection.breakdowns['save.will'].total, name).toBe(0);
      expect(projection.breakdowns['skill.esc'].total, name).toBe(0);
      expect(projection.breakdowns['skill.acr'].total, name).toBe(0);
      expect(projection.spellEffects, name).toEqual([]);
    }
  }
  const alacrity = calculateCharacterSheetProjections(
    recordedSpellSheet('Aldori Alacrity', 'bard'),
  ).current;
  expect(alacrity.entryNotes).toHaveLength(1);
  expect(alacrity.entryNotes[0]).not.toHaveProperty('situation');
  expect(spellFixture('Aldori Alacrity').situationalNotes).toEqual([
    {
      text: "This spell's energy quickens your steps, allowing fancy footwork. You gain a +10-foot enhancement bonus to your speed and a +1 dodge bonus to your AC. These bonuses do not stack with those granted by haste or similar effects. While under the effects of Aldori alacrity, you can take 5-foot steps in difficult terrain.",
    },
  ]);
  // Inline rolls and table cells read as plain text.
  expect(spellFixture('Cleansing Fire').situationalNotes?.[0]?.text).toContain(
    'The flames deal 2d6 points of fire damage',
  );
  expect(spellFixture("Dahak's Release").situationalNotes?.[0]?.text).toContain(
    '\n1-25 Target attacks the creature nearest to it.\n',
  );
  // Protected roots keep their earlier-batch fingerprints: no Notes at all.
  expect(spellFixture('Displacement').situationalNotes).toBeUndefined();
  expect(
    calculateCharacterSheetProjections(
      recordedSpellSheet('Displacement', 'wizard'),
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
        reviewedOn: '2026-10-12',
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

    // With every governing body present, no root fails and none is admitted.
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
    expect(gate.failures.filter((row) => ours.has(row.externalKey))).toEqual(
      [],
    );
    expect(gate.held.filter((row) => ours.has(row.externalKey))).toHaveLength(
      100,
    );
    // Confirming one root still holds it on the unreviewed Unchained notice.
    const retreat = candidate('Expeditious Retreat');
    expect(retreat.requiredNotices).toEqual(['CRB', 'PZO1110', 'PZO1131']);
    const confirmed = assessWithUnclearedHolds({
      artifact: linked,
      ...reviewedAdmission,
      assessments: reviewedAdmission.assessments.map((row) =>
        row.externalKey === retreat.externalKey
          ? {
              ...row,
              status: 'confirmed' as const,
              ...buildAssessmentBinding({
                artifact: linked,
                entry: spellFixture('Expeditious Retreat'),
                requiredNotices: retreat.requiredNotices,
                evidenceIds: [retreat.evidenceId],
                ...reviewedAdmission,
              }),
            }
          : row,
      ),
    });
    // PZO1131 is reviewed (2026-10-30): its uncleared chain holds hold it.
    expect(
      confirmed.held.find((row) => row.externalKey === retreat.externalKey)
        ?.reason,
    ).toMatch(/^Notice holds: PZO1131 \(/);
    expect(
      confirmed.admitted.some((row) => row.externalKey === retreat.externalKey),
    ).toBe(false);
  } finally {
    await tree.dispose();
  }
});
