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
} from '../fixtures/spells-543/data';
import { recordedSpellSheet, spellFixture } from '../fixtures/spells-543/sheet';
import { materializePinnedTree, readPinned } from './pinned-sources';
import { bindSnapshotToCurrentNotices } from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';

const REVIEWER = 'Opus (AI curator) for the owner';
const REVIEWED_ON = '2026-10-13';
const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
const keys = review.candidates.map((row) => row.externalKey);
const noticeHold = (code: string) => `spells-543-notice-${code}-complete-chain`;
// Inventory order.
const journalLinked = ['Wing Thorns', 'Knell of the Depths', 'Slick Walls'];
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
    recordLevel35Holds: 1,
  });
  expect(review.mechanicsSummary).toMatchObject({
    checkedDescriptionRecords: 100,
    recordsWithNotes: 81,
    protectedRoots: 19,
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
    // A record-level 3.5 tag is held under its own named hold, never excluded.
    const tags = (raw.system.tags ?? []) as string[];
    expect(row.recordLevelTags ?? [], row.name).toEqual(
      tags.filter((tag) => tag === '3.5'),
    );
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
    for (const body of [
      ...row.inheritedRuleSourceEvidence,
      ...row.linkedContentReview,
    ])
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
    const id = row.externalKey.split('/')[1];
    expect(row.holdIds).toEqual([
      `spells-543-whole-content-${id}`,
      ...(row.recordLevelTags ? [`spells-543-record-level-3.5-tag-${id}`] : []),
    ]);
    expect(row.holdReason.startsWith(`${row.holdIds.join('; ')}: `)).toBe(true);

    for (const body of [
      ...row.inheritedRuleSourceEvidence,
      ...row.linkedContentReview,
    ]) {
      const support = await readPinned('pf1', body.path ?? '');
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
  // Only Sympathetic Wounds carries the record-level 3.5 tag.
  expect(
    review.candidates
      .filter((row) => row.recordLevelTags)
      .map((row) => [row.name, row.recordLevelTags]),
  ).toEqual([['Sympathetic Wounds', ['3.5']]]);
  expect(candidate('Sympathetic Wounds').holdReason).toContain(
    'record-level 3.5 tag',
  );
  const crb = review.noticeRequirements.find((row) => row.book === 'PZO1110');
  expect(crb).toMatchObject({ registryKeys: ['CRB'], holdId: null });
  const held = review.noticeRequirements.filter((row) => row.holdId !== null);
  expect(held).toHaveLength(48);
  for (const requirement of held)
    expect(holds.get(requirement.holdId ?? '')).toEqual([requirement.book]);
  // Only Occult Mysteries has a Registry identity, and it is unreviewed; the
  // Registry itself is unchanged.
  expect(
    held
      .filter((row) => row.registryKeys.length)
      .map((row) => [row.book, row.registryKeys, row.status]),
  ).toEqual([['PZO9269', ['PZO9269'], 'held-notice-chain']]);
  expect(reviewedAdmission.registry.PZO9269?.reviewStatus).toBe('unreviewed');
  // Origins without a pinned source stay inside the whole-content hold.
  const unverified = review.candidates.filter(
    (row) => row.unverifiedOrigins.length,
  );
  expect(unverified.map((row) => row.name)).toEqual(['Destroy Robot']);
  expect(candidate('Destroy Robot').holdReason).toContain(
    `Unverified origins: ${candidate('Destroy Robot').unverifiedOrigins[0]}.`,
  );
  // Roots fingerprinted by earlier batches' fixtures keep empty records.
  expect(
    review.candidates
      .filter((row) => row.mechanicsReview.protectedHistoricalContext)
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Acid Pit',
    'Age Resistance, Lesser',
    'Animal Aspect',
    'Beast Shape III',
    'Bless',
    'Cloak of Shade',
    'Command Plants',
    'Create Demiplane',
    'Dream Scan',
    'Feast on Fear',
    'Find Traps',
    'Globe of Invulnerability',
    'Heroism',
    'Howling Agony',
    'Icicle Dagger',
    'Stone Tell',
    'Summon Swarm',
    'Threefold Aspect',
    'Touch of Gracelessness',
  ]);
  // Granted domain, subdomain and bloodline levels name the hold.
  expect(candidate('Beast Shape III').holdReason).toContain(
    'granted levels (domain: Animal; subDomain: Saurian)',
  );
});

it('keeps the literal PCGen rows, publication anchors and recorded discrepancies', async () => {
  const files = new Map<string, string>();
  for (const file of review.comparisonSources.pcgenFiles) {
    const bytes = await readFile(`tests/fixtures/pinned/pcgen/${file.path}`);
    expect(sha(bytes), file.path).toBe(file.sha256);
    files.set(file.path, bytes.toString());
  }
  let rootComparisons = 0;
  const pageMismatches: string[] = [];
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
      const cited = row.citedSources.find(
        (source) => source.id === comparison.book,
      );
      expect(comparison.pageMatchesCitation, row.name).toBe(
        comparison.sourcePage.replace(/^p\./, '') === String(cited?.pages),
      );
      if (!comparison.pageMatchesCitation) {
        pageMismatches.push(`${row.name} ${comparison.sourcePage}`);
        // A PCGen page that disagrees with the pinned citation is recorded.
        expect(
          row.mechanicsReview.sourceDiscrepancies.some((text) =>
            text.startsWith(`PCGen gives ${comparison.sourcePage} `),
          ),
          row.name,
        ).toBe(true);
      }
    }
    if (row.comparison) rootComparisons += 1;
  }
  expect(rootComparisons).toBe(91);
  expect(pageMismatches.sort()).toEqual([
    'Acid Pit p.201',
    'Create Demiplane p.213',
    'Sky Steed p.23',
  ]);
  expect(
    review.candidates
      .filter((row) => !row.comparison)
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Grasp',
    'Knell of the Depths',
    'Numerological Resistance',
    'Open the Dead Roads',
    'Pinecone Bomb',
    'Planar Aegis',
    'Righteous Condemnation',
    'Sympathetic Wounds',
    'Unleash Pandemonium',
  ]);
  // Further cited publications keep their own PCGen rows.
  const books = (name: string) =>
    [
      candidate(name).comparison,
      ...candidate(name).additionalComparisonLeads,
    ].map((row) => row?.book);
  expect(books('Read Weather')).toEqual(['PZO9267', 'PZO9418']);
  expect(books('Sky Steed')).toEqual(['PZO1140', 'PZO9429']);
  expect(books("Enemy's Heart")).toEqual(['PZO1121', 'PZO9413']);
  // PCGen's variant name for "X, Mass" and "X, Lesser" rows.
  expect(candidate('Cacophonous Call, Mass').comparison?.literalRow).toMatch(
    /^Cacophonous Call \(Mass\)\t/,
  );
  // Blood of the Moon declares its publication in the dataset's .pcc file.
  expect(
    candidate('Accursed Glare').comparison?.publicationAnchor,
  ).toMatchObject({
    path: 'data/pathfinder/paizo/player_companion/blood_of_the_moon/_blood_of_the_moon.pcc',
    text: 'SOURCELONG:Pathfinder Player Companion: Blood of the Moon',
  });
  expect(
    review.candidates
      .filter((row) => row.mechanicsReview.sourceDiscrepancies.length)
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Acid Pit',
    'Age Resistance, Lesser',
    'Create Demiplane',
    'Ectoplasmic Hand',
    'Ill Omen',
    'Knell of the Depths',
    'Matchmaker',
    'Resinous Skin',
    'Sky Steed',
    'Slick Walls',
    'Stay the Hand',
    'Steal Size',
    'Threefold Aspect',
    'Wall of Ectoplasm',
    'Wing Thorns',
  ]);
  // Ill Omen's Mythic Adventures citation is only PCGen's mythic augmentation
  // row, in a listed and hashed PCGen file.
  expect(
    candidate('Ill Omen').mechanicsReview.sourceDiscrepancies[0],
  ).toContain('ma_spells.lst:152, "Ill Omen.MOD"');
  expect(
    files
      .get(
        'data/pathfinder/paizo/roleplaying_game/mythic_adventures/ma_spells.lst',
      )
      ?.split('\n')[151],
  ).toMatch(/^Ill Omen\.MOD\t/);
  // The pinned Ectoplasmic Hand body stops mid-sentence; nothing is supplied.
  expect(
    candidate('Ectoplasmic Hand').mechanicsReview.curationRecords[0]?.text,
  ).toMatch(/This action doesn't<\/p>$/);
  // PCGen Bestiary race rows name the publication of depended-on creatures.
  const creatures = new Map<string, string>();
  for (const row of review.candidates)
    for (const bestiary of row.inheritedRuleComparisons) {
      const lines = files.get(bestiary.path)?.split('\n') ?? [];
      expect(lines[bestiary.line - 1]).toBe(bestiary.literalRow);
      expect(bestiary.literalRow.split('\t')[0]).toBe(bestiary.name);
      expect(sha(bestiary.literalRow)).toBe(bestiary.comparisonLineSha256);
      expect(
        files.get(bestiary.path)?.split('\n')[
          bestiary.publicationAnchor.line - 1
        ],
      ).toContain('SOURCELONG:Bestiary\t');
      expect(bestiary.literalRow).toContain(
        `\tSOURCEPAGE:${bestiary.sourcePage}\t`,
      );
      expect(row.requiredNotices).toContain(bestiary.book);
      creatures.set(bestiary.name, `${bestiary.book} ${bestiary.sourcePage}`);
    }
  expect(Object.fromEntries(creatures)).toEqual({
    'Bat Swarm': 'PZO1112 p.30',
    'Rat Swarm': 'PZO1112 p.232',
    'Spider Swarm': 'PZO1112 p.258',
  });
});

it('records the inherited-rule notices of governing bodies, cited creatures, monster rules and class rules', () => {
  const requires = (name: string) => candidate(name).requiredNotices;
  const governing = (name: string) =>
    candidate(name).inheritedRuleSourceEvidence.map((body) => body.name);
  const cited = (name: string) =>
    candidate(name).inheritedRuleCitations.map((row) => row.name);
  // Explicit Planar Adventures and GameMastery Guide citations.
  expect(requires('Planar Aegis')).toEqual([
    'CRB',
    'PZO1110',
    'PZO1131',
    'PZO1141',
    'PZO9492',
  ]);
  expect(requires('Create Demiplane')).toEqual([
    'CRB',
    'PZO1110',
    'PZO1114',
    'PZO1117',
    'PZO1131',
  ]);
  expect(governing('Create Demiplane')).toEqual(['Create Demiplane, Lesser']);
  // Governing bodies; Beast Shape II brings Beast Shape I as its closure.
  expect(governing('Riding Possession')).toEqual(['Possession']);
  expect(governing('Acid Pit')).toEqual(['Create Pit']);
  expect(governing('Sympathetic Wounds')).toEqual(['Shield Other']);
  expect(governing('Beast Shape III')).toEqual([
    'Beast Shape II',
    'Beast Shape I',
  ]);
  expect(
    candidate('Beast Shape III').inheritedRuleSourceEvidence.map(
      (body) => body.role.split(':')[0],
    ),
  ).toEqual(['governing-body', 'governing-body closure']);
  // Flesh puppet's zombie, explicitly cited as Bestiary 288.
  expect(governing('Flesh Puppet Horde')).toEqual(['Flesh Puppet']);
  expect(cited('Flesh Puppet Horde')).toEqual(['Zombie']);
  expect(requires('Flesh Puppet Horde')).toContain('PZO1112');
  // Summoned Bestiary swarms.
  expect(requires('Summon Swarm')).toEqual([
    'CRB',
    'PZO1110',
    'PZO1112',
    'PZO1131',
  ]);
  // APG class rules and maneuvers.
  expect(cited('Bestow Auras')).toEqual(['Antipaladin']);
  expect(requires('Bestow Auras')).toContain('PZO1115');
  expect(cited('Barrow Haze')).toEqual(['Witch']);
  expect(requires('Barrow Haze')).toContain('PZO1115');
  expect(requires('Ectoplasmic Hand')).toContain('PZO1115');
  // An incidental link is reviewed and its book required.
  expect(
    candidate('Slick Walls').linkedContentReview.map((row) => row.name),
  ).toEqual(['Create Pit']);
  expect(requires('Slick Walls')).toContain('PZO1115');
  // Androids are sourced only to Bestiary 5; robots and cyborgs stay unverified.
  expect(cited('Destroy Robot')).toEqual(['Android']);
  expect(requires('Destroy Robot')).toContain('PZO1133');
  // Universal monster rules granted by the form cite their pinned records:
  // darkvision to Bestiary 4 and jet to Bestiary 2 as their earliest books.
  expect(requires('Beast Shape III')).toEqual([
    'CRB',
    'PZO1110',
    'PZO1112',
    'PZO1116',
    'PZO1127',
    'PZO1131',
  ]);
  expect(
    candidate('Beast Shape III').inheritedRuleCitations.map(
      (row) => `${row.name.split(' (')[0]} ${row.book}`,
    ),
  ).toEqual([
    'Blindsense PZO1112',
    'Constrict PZO1112',
    'Darkvision PZO1127',
    'Ferocity PZO1112',
    'Grab PZO1112',
    'Jet PZO1116',
    'Low-Light Vision PZO1112',
    'Poison PZO1112',
    'Pounce PZO1112',
    'Rake PZO1112',
    'Scent PZO1112',
    'Trample PZO1112',
    'Trip PZO1112',
    'Web PZO1112',
  ]);
  expect(
    heldNotices.find(
      (hold) => hold.id === 'spells-543-notice-PZO1141-complete-chain',
    ),
  ).toEqual({
    id: 'spells-543-notice-PZO1141-complete-chain',
    notices: ['PZO1141'],
    evidence: ['scripts/catalog/legal/spells-543.json'],
  });
  // Importer gaps (#719/#720): lost descriptors and stripped journal links.
  expect(
    review.metadataImportGaps.find(
      (row) =>
        row.externalKey === candidate('Align Weapon, Communal').externalKey,
    ),
  ).toMatchObject({ published: ['see text'], imported: [] });
  expect(review.metadataImportGaps).toHaveLength(45);
  expect(review.referenceImportGaps).toEqual(
    journalLinked.map((name) => ({
      externalKey: candidate(name).externalKey,
      field: 'description.link',
    })),
  );
});

it('records Spells without changing holder statistics and surfaces only their readable Notes', () => {
  for (const [name, tag] of [
    ['Heroism', 'wizard'],
    ['Threefold Aspect', 'druid'],
    ['Resinous Skin', 'wizard'],
    ['Forced Quiet', 'wizard'],
    ['Find Traps', 'cleric'],
    ['Bless', 'cleric'],
    ["Eagle's Splendor, Mass", 'wizard'],
    ['Animal Aspect', 'wizard'],
    ['Haunting Choir', 'bard'],
  ] as const) {
    const result = calculateCharacterSheetProjections(
      recordedSpellSheet(name, tag),
    );
    for (const projection of [result.current, result.permanent]) {
      for (const ability of [
        'strength',
        'dexterity',
        'constitution',
        'intelligence',
        'wisdom',
        'charisma',
      ] as const)
        expect(projection.abilities[ability].score, name).toBe(10);
      expect(projection.breakdowns['ac.armor'].total, name).toBe(0);
      expect(projection.breakdowns['ac.natural'].total, name).toBe(0);
      expect(projection.breakdowns['ac.other'].total, name).toBe(0);
      expect(projection.breakdowns.cmb.total, name).toBe(0);
      expect(projection.breakdowns['save.fort'].total, name).toBe(0);
      expect(projection.breakdowns['save.will'].total, name).toBe(0);
      expect(projection.breakdowns['skill.acr'].total, name).toBe(0);
      expect(projection.breakdowns['skill.clm'].total, name).toBe(0);
      expect(projection.breakdowns['skill.per'].total, name).toBe(0);
      expect(projection.breakdowns['skill.ste'].total, name).toBe(0);
      expect(projection.spellEffects, name).toEqual([]);
    }
  }
  const quiet = calculateCharacterSheetProjections(
    recordedSpellSheet('Forced Quiet', 'wizard'),
  ).current;
  expect(quiet.entryNotes).toHaveLength(1);
  expect(quiet.entryNotes[0]).not.toHaveProperty('situation');
  expect(spellFixture('Forced Quiet').situationalNotes).toEqual([
    {
      text: 'With a gesture, you muffle sound around the target, making it unable to yell or otherwise make loud noises. This does not affect spellcasting by the target. The target can still use sonic effects, but the DC of these effects decreases by 2. The target gains a +2 bonus on saving throws against sonic effects. The target gains a +4 circumstance bonus on Stealth checks.',
    },
  ]);
  // Table rows read as "cell | cell" lines.
  expect(spellFixture('Salvage').situationalNotes?.[0]?.text).toContain(
    'depending on its size.\nSize | Duration\nRaft | 1 minute\nRowboat | 1 minute\n',
  );
  // Link labels read as text, including stripped journal links.
  expect(spellFixture('Slick Walls').situationalNotes?.[0]?.text).toContain(
    'The DC of all Climb checks for the affected surfaces increases by twice your caster level (maximum +20).',
  );
  expect(
    spellFixture('Riding Possession').situationalNotes?.[0]?.text,
  ).toContain(
    'This functions as possession, except the host is still in full control',
  );
  // Protected roots keep their earlier-batch fingerprints: no Notes at all.
  expect(spellFixture('Heroism').situationalNotes).toBeUndefined();
  expect(
    calculateCharacterSheetProjections(recordedSpellSheet('Heroism', 'wizard'))
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

    // With every governing body present, only the journal-link gaps fail and none is admitted.
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
    // #738 keeps the roots' rules journal links as text: no root fails.
    expect(gate.failures.filter((row) => ours.has(row.externalKey))).toEqual(
      [],
    );
    expect(gate.held.filter((row) => ours.has(row.externalKey))).toHaveLength(
      100,
    );
    // Confirming one root still holds it on the unreviewed Unchained notice.
    const doom = candidate('Doom');
    expect(doom.requiredNotices).toEqual(['CRB', 'PZO1110', 'PZO1131']);
    const confirmed = assessWithUnclearedHolds({
      artifact: linked,
      ...reviewedAdmission,
      assessments: reviewedAdmission.assessments.map((row) =>
        row.externalKey === doom.externalKey
          ? {
              ...row,
              status: 'confirmed' as const,
              ...buildAssessmentBinding({
                artifact: linked,
                entry: spellFixture('Doom'),
                requiredNotices: doom.requiredNotices,
                evidenceIds: [doom.evidenceId],
                ...reviewedAdmission,
              }),
            }
          : row,
      ),
    });
    // PZO1131 is reviewed (2026-10-30): its uncleared chain holds hold it.
    expect(
      confirmed.held.find((row) => row.externalKey === doom.externalKey)
        ?.reason,
    ).toMatch(/^Notice holds: PZO1131 \(/);
    expect(
      confirmed.admitted.some((row) => row.externalKey === doom.externalKey),
    ).toBe(false);
  } finally {
    await tree.dispose();
  }
});
