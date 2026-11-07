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
} from '../fixtures/spells-540/data';
import { recordedSpellSheet, spellFixture } from '../fixtures/spells-540/sheet';
import { materializePinnedTree, readPinned } from './pinned-sources';
import { bindSnapshotToCurrentNotices } from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';

const REVIEWER = 'Opus (AI curator) for the owner';
const REVIEWED_ON = '2026-10-13';
const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
const keys = review.candidates.map((row) => row.externalKey);
const noticeHold = (code: string) => `spells-540-notice-${code}-complete-chain`;
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
    recordsWithNotes: 77,
    protectedRoots: 23,
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
      reviewedOn: REVIEWED_ON,
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
    expect(row.holdIds).toEqual([
      `spells-540-whole-content-${row.externalKey.split('/')[1]}`,
    ]);

    for (const body of row.inheritedRuleSourceEvidence) {
      const support = await readPinned('pf1', body.path);
      expect(sha(support), body.path).toBe(body.sha256);
      const supported = upstreamRecord.parse(parse(support.toString()));
      expect(`pf1/${supported._id}`).toBe(body.externalKey);
      expect(supported.system.sources).toEqual(body.sources);
      expect(sha(sourceDescription(supported))).toBe(body.descriptionSha256);
    }
    for (const linked of row.linkedContentReview) {
      if (!linked.path || !linked.sha256) continue;
      const bytes = await readPinned('pf1', linked.path);
      expect(sha(bytes), linked.path).toBe(linked.sha256);
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
  expect(held).toHaveLength(49);
  for (const requirement of held)
    expect(holds.get(requirement.holdId ?? '')).toEqual([requirement.book]);
  // Faiths of Purity keeps its existing, unreviewed Registry notice and is held.
  expect(
    review.noticeRequirements.find((row) => row.book === 'PZO9416'),
  ).toMatchObject({
    registryKeys: ['PZO9416'],
    holdId: noticeHold('PZO9416'),
  });
  expect(
    held.filter((row) => row.registryKeys.length).map((row) => row.book),
  ).toEqual(['PZO9416']);
  // Origins without a pinned source stay inside the whole-content hold.
  for (const name of [
    'Visualization of the Mind',
    'Amplify Stench',
    'Twisted Futures',
    'Contact High',
    'Rune of Jandelay',
    'Mischievous Shadow',
  ]) {
    const row = candidate(name);
    expect(row.unverifiedOrigins, name).toHaveLength(1);
    expect(row.holdReason, name).toContain(
      `Unverified origins: ${row.unverifiedOrigins[0]}.`,
    );
  }
  expect(
    review.candidates.filter((row) => row.unverifiedOrigins.length),
  ).toHaveLength(6);
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
  expect(rootComparisons).toBe(94);
  expect(
    review.candidates
      .filter((row) => !row.comparison)
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Celestial Companion',
    'Glimpse of the Akashic',
    'Positive Pulse, Greater',
    'Rune of Jandelay',
    'Scourge of the Horsemen',
    'Summon Meladaemon',
  ]);
  // Further cited publications keep their own PCGen rows.
  const books = (name: string) =>
    [
      candidate(name).comparison,
      ...candidate(name).additionalComparisonLeads,
    ].map((row) => row?.book);
  expect(books('Ghost Wolf')).toEqual(['PZO1121', 'PZO9413']);
  expect(books('Mask from Divination')).toEqual(['PZO1138', 'PZO9465']);
  expect(books('Covetous Aura')).toEqual(['PZO1002', 'PZO9226']);
  expect(books('Tap Inner Beauty')).toEqual(['PZO9267', 'PZO9416']);
  // PCGen's variant names for "X, Greater" and "X, Mass" rows.
  expect(candidate('Polymorph, Greater').comparison?.literalRow).toMatch(
    /^Polymorph \(Greater\)\t/,
  );
  expect(
    candidate('Inflict Serious Wounds, Mass').comparison?.literalRow,
  ).toMatch(/^Inflict Serious Wounds \(Mass\)\t/);
  const pages = Object.fromEntries(
    review.candidates
      .filter((row) =>
        row.mechanicsReview.sourceDiscrepancies.some((text) =>
          text.startsWith('PCGen '),
        ),
      )
      .map((row) => [row.name, row.mechanicsReview.sourceDiscrepancies]),
  );
  expect(pages).toEqual({
    'Ghost Wolf': [
      'PCGen arg_spells.lst:40 cites p.59; the pinned source cites 58.',
    ],
    'Mask from Divination': [
      'PCGen ag_spells.lst:27 cites p.115; the pinned source cites 125.',
    ],
    'Amplify Elixir': [
      'PCGen apg_spells.lst:22 cites p.202; the pinned source cites 201.',
    ],
    'Polymorph, Greater': [
      'PCGen cr_spells.lst:448 cites p.323; the pinned source cites 324.',
    ],
  });
  expect(
    review.candidates.filter(
      (row) => row.mechanicsReview.sourceDiscrepancies.length,
    ),
  ).toHaveLength(8);
  // PCGen Bestiary race rows name the publication of depended-on creatures.
  const creatures = new Map<string, string>();
  for (const row of review.candidates)
    for (const bestiary of row.inheritedRuleComparisons) {
      const lines = files.get(bestiary.path)?.split('\n') ?? [];
      expect(lines[bestiary.line - 1]).toBe(bestiary.literalRow);
      expect(bestiary.literalRow.split('\t')[0]).toBe(bestiary.name);
      expect(sha(bestiary.literalRow)).toBe(bestiary.comparisonLineSha256);
      const title = { PZO1112: 'Bestiary', PZO1116: 'Bestiary 2' }[
        bestiary.book
      ];
      expect(title, bestiary.name).toBeDefined();
      expect(
        files.get(bestiary.path)?.split('\n')[
          bestiary.publicationAnchor.line - 1
        ],
      ).toContain(`SOURCELONG:${title}\t`);
      expect(bestiary.literalRow).toContain(
        `\tSOURCEPAGE:${bestiary.sourcePage}\t`,
      );
      expect(row.requiredNotices).toContain(bestiary.book);
      creatures.set(bestiary.name, `${bestiary.book} ${bestiary.sourcePage}`);
    }
  expect(Object.fromEntries(creatures)).toEqual({
    'Ant (Army/Swarm)': 'PZO1112 p.16',
    'Black Pudding': 'PZO1112 p.35',
    'Centipede Swarm': 'PZO1112 p.43',
    Cyclops: 'PZO1112 p.52',
    'Daemon (Meladaemon)': 'PZO1116 p.69',
    'Gremlin (Pugwampi)': 'PZO1116 p.144',
  });
});

it('records the inherited-rule notices of governing bodies, cited creatures and class rules', () => {
  const requires = (name: string) => candidate(name).requiredNotices;
  const governing = (name: string) =>
    candidate(name).inheritedRuleSourceEvidence.map((body) => body.name);
  const cited = (name: string) =>
    candidate(name).inheritedRuleCitations.map((row) => row.name);
  for (const name of ['Whip of Ants', 'Rain of Frogs', 'Conjure Black Pudding'])
    expect(requires(name), name).toContain('PZO1112');
  expect(requires('Summon Meladaemon')).toContain('PZO1116');
  expect(governing('Summon Meladaemon')).toEqual(['Summon Monster I']);
  // A governing body's own links are kept for the fixture closure.
  expect(governing('Whip of Ants')).toEqual([
    'Whip of Spiders',
    'Summon Swarm',
  ]);
  expect(governing('Baleful Polymorph')).toEqual([
    'Beast Shape III',
    'Beast Shape II',
    'Beast Shape I',
  ]);
  expect(governing('Polymorph, Greater')).toHaveLength(12);
  expect(requires('Twisted Futures')).toEqual([
    'CRB',
    'PZO1110',
    'PZO1112',
    'PZO1115',
    'PZO1116',
    'PZO1129',
    'PZO1131',
    'PZO9453',
  ]);
  expect(governing('Twisted Futures')).toEqual(['Ill Omen']);
  expect(cited('Twisted Futures')).toEqual(['Swashbuckler']);
  expect(requires('Targeted Bomb Admixture')).toContain('PZO1115');
  expect(cited('Targeted Bomb Admixture')).toEqual(['Alchemist']);
  expect(requires('Life Conduit, Greater')).toContain('PZO1115');
  expect(cited('Life Conduit, Greater')).toEqual(['Summoner']);
  expect(requires('Blood Salvation')).toContain('PZO1129');
  expect(cited('Blood Salvation')).toEqual(['Bloodrager']);
  expect(requires("Sun's Disdain")).toContain('PZO1121');
  expect(cited("Sun's Disdain")).toEqual(['Light Blindness']);
  expect(requires('Sea Stallion')).toContain('PZO1112');
  expect(cited('Sea Stallion')).toEqual(['Amphibious']);
  expect(requires('Peerless Integrity')).toContain('PZO1118');
  expect(governing('Peerless Integrity')).toEqual(['See Alignment']);
  expect(requires('Instant Portrait')).toContain('PZO1115');
  expect(governing('Instant Portrait')).toEqual(['Enter Image']);
  expect(requires('Assume Appearance, Greater')).toContain('PZO1117');
  expect(governing('Assume Appearance, Greater')).toEqual([
    'Assume Appearance',
    'Vocal Alteration',
    'Misdirection',
  ]);
  expect(
    candidate('Assume Appearance, Greater').linkedContentReview.map(
      (row) => row.name,
    ),
  ).toEqual(['Speak with Dead']);
  expect(governing('Time Shudder')).toEqual(['Haste', 'Slow']);
  // The mass inflict link is labelled "mass cure light wounds".
  expect(governing('Inflict Moderate Wounds, Mass')).toEqual([
    'Inflict Light Wounds, Mass',
  ]);
  expect(
    review.metadataImportGaps.find(
      (row) => row.externalKey === candidate('Sheet Lightning').externalKey,
    ),
  ).toMatchObject({ published: ['electricity'], imported: [] });
  expect(review.metadataImportGaps).toHaveLength(37);
  expect(review.referenceImportGaps).toEqual([]);
});

it('records Spells without changing holder statistics and surfaces only their readable Notes', () => {
  for (const [name, tag] of [
    ['Tap Inner Beauty', 'cleric'],
    ['Psychic Leech', 'wizard'],
    ['Visualization of the Mind', 'cleric'],
    ['Scent Trail', 'druid'],
    ["Aroden's Magic Army", 'wizard'],
    ['Celestial Companion', 'druid'],
    ['Music of the Spheres', 'cleric'],
    ['Shield', 'wizard'],
  ] as const) {
    const result = calculateCharacterSheetProjections(
      recordedSpellSheet(name, tag),
    );
    for (const projection of [result.current, result.permanent]) {
      expect(projection.abilities.strength.score, name).toBe(10);
      expect(projection.abilities.dexterity.score, name).toBe(10);
      expect(projection.abilities.charisma.score, name).toBe(10);
      expect(projection.breakdowns['ac.armor'].total, name).toBe(0);
      expect(projection.breakdowns['ac.shield'].total, name).toBe(0);
      expect(projection.breakdowns['ac.other'].total, name).toBe(0);
      expect(projection.breakdowns['save.fort'].total, name).toBe(0);
      expect(projection.breakdowns['save.will'].total, name).toBe(0);
      expect(projection.breakdowns['skill.dip'].total, name).toBe(0);
      expect(projection.breakdowns['skill.sur'].total, name).toBe(0);
      expect(projection.spellEffects, name).toEqual([]);
    }
  }
  const beauty = calculateCharacterSheetProjections(
    recordedSpellSheet('Tap Inner Beauty', 'cleric'),
  ).current;
  expect(beauty.entryNotes).toHaveLength(1);
  expect(beauty.entryNotes[0]).not.toHaveProperty('situation');
  expect(spellFixture('Tap Inner Beauty').situationalNotes).toEqual([
    {
      text: 'This spell allows you to tap into the natural beauty of your soul and let it shine from your eyes and your speech. While the spell is active, you gain a +2 insight bonus on all Charisma ability checks and Charisma-based skill checks.',
    },
  ]);
  // An unlabelled link reads as the linked Spell's name.
  expect(spellFixture('Summon Meladaemon').situationalNotes).toEqual([
    {
      text: 'This spell functions like summon monster I, except it summons a single meladaemon.',
    },
  ]);
  // List items read as separate lines.
  expect(spellFixture('Blood Biography').situationalNotes?.[0]?.text).toContain(
    '(a wall, a piece of paper, and so on).\nWho are you? (The name by which the creature is most commonly known)\nWhat are you?',
  );
  // Protected roots keep their earlier-batch fingerprints: no Notes at all.
  expect(spellFixture('Shield').situationalNotes).toBeUndefined();
  expect(
    calculateCharacterSheetProjections(recordedSpellSheet('Shield', 'wizard'))
      .current.entryNotes,
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
        reviewedOn: REVIEWED_ON,
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
    const flameArrow = candidate('Flame Arrow');
    expect(flameArrow.requiredNotices).toEqual(['CRB', 'PZO1110', 'PZO1131']);
    const confirmed = assessWithUnclearedHolds({
      artifact: linked,
      ...reviewedAdmission,
      assessments: reviewedAdmission.assessments.map((row) =>
        row.externalKey === flameArrow.externalKey
          ? {
              ...row,
              status: 'confirmed' as const,
              ...buildAssessmentBinding({
                artifact: linked,
                entry: spellFixture('Flame Arrow'),
                requiredNotices: flameArrow.requiredNotices,
                evidenceIds: [flameArrow.evidenceId],
                ...reviewedAdmission,
              }),
            }
          : row,
      ),
    });
    // PZO1131 is reviewed (2026-10-30): its uncleared chain holds hold it.
    expect(
      confirmed.held.find((row) => row.externalKey === flameArrow.externalKey)
        ?.reason,
    ).toMatch(/^Notice holds: PZO1131 \(/);
    expect(
      confirmed.admitted.some(
        (row) => row.externalKey === flameArrow.externalKey,
      ),
    ).toBe(false);
  } finally {
    await tree.dispose();
  }
});
