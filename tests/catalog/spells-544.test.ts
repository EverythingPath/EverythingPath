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
  linkedContext,
  pinnedFiles,
  pinnedSha256,
} from '../fixtures/spells-544/data';
import { recordedSpellSheet, spellFixture } from '../fixtures/spells-544/sheet';
import { materializePinnedTree, readPinned } from './pinned-sources';
import { bindSnapshotToCurrentNotices } from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';
import {
  expectGrantedLevelsBounded,
  expectLaunchOutcome,
  expectPinnedPcgenRows,
} from './launch-reassessment';

const REVIEWER = 'Opus (AI curator) for the owner';
const REVIEWED_ON = '2026-10-13';
const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
const keys = review.candidates.map((row) => row.externalKey);
const noticeHold = (code: string) => `spells-544-notice-${code}-complete-chain`;
function candidate(name: string) {
  const row = review.candidates.find((row) => row.name === name);
  if (!row) throw new Error(`Missing review of ${name}`);
  return row;
}
// A launch row re-assessed by #544 whole-content wave 2 keeps its reviewed
// holds and rationale as history.
function recorded(row: (typeof review.candidates)[number]) {
  const history = row.assessmentHistory?.[0];
  return history ?? { ...row, rationale: row.holdReason ?? '' };
}
// The latest review date of a launch row: the waves 1-2 correction's when it
// corrected the row, else the launch re-assessment's, else the batch's.
function reviewedOnOf(
  reassessed: (typeof review.candidates)[number]['launchReview'],
) {
  return (
    reassessed?.corrections?.at(-1)?.reviewedOn ??
    reassessed?.reviewedOn ??
    REVIEWED_ON
  );
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
    // #516 whole-content wave 3 (option B): Summon Nature's Ally IX admitted.
    // The waves 1-2 correction (2026-11-06) holds four rows at the gate, and
    // Cat's Grace, Mass follows its held Cat's Grace (option B).
    admitted: 29,
    held: 65,
    dependentlyOmitted: 6,
    unsupportedProseOnly: 0,
    excluded: 0,
    recordLevel35Holds: 2,
  });
  expect(review.mechanicsSummary).toMatchObject({
    checkedDescriptionRecords: 100,
    recordsWithNotes: 80,
    protectedRoots: 20,
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
    const raw = upstreamRecord.parse(parse(bytes));
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
    for (const body of row.inheritedRuleSourceEvidence)
      expect(
        body.sources.some((source) => row.requiredNotices.includes(source.id)),
        `${row.name} <- ${body.name}`,
      ).toBe(true);
    expect(row.linkedContentReview).toEqual([]);
    // The holds the original review recorded for its notices (the waves 1-2
    // correction adds mapping books later, without batch holds).
    const original = recorded(row).requiredNotices ?? row.requiredNotices;
    expect(recorded(row).noticeHoldIds).toEqual(
      original
        .filter((code) => code !== 'CRB' && code !== 'PZO1110')
        .map(noticeHold),
    );
    for (const code of original.slice(1))
      if (code !== 'PZO1110')
        expect(holds.get(noticeHold(code)), code).toEqual([code]);
    const id = row.externalKey.split('/')[1];
    const history = recorded(row);
    expect(history.holdIds).toEqual([
      `spells-544-whole-content-${id}`,
      ...(row.recordLevelTags ? [`spells-544-record-level-3.5-tag-${id}`] : []),
    ]);
    expect(
      history.rationale.startsWith(`${history.holdIds.join('; ')}: `),
    ).toBe(true);

    for (const body of row.inheritedRuleSourceEvidence) {
      const support = await readPinned('pf1', body.path);
      expect(sha(support), body.path).toBe(body.sha256);
      const supported = upstreamRecord.parse(parse(support));
      expect(`pf1/${supported._id}`).toBe(body.externalKey);
      expect(supported.name).toBe(body.name);
      expect(supported.system.sources).toEqual(body.sources);
      expect(sha(sourceDescription(supported))).toBe(body.descriptionSha256);
    }
    for (const cited of row.inheritedRuleCitations) {
      const text = await readPinned(cited.repo, cited.path);
      expect(sha(text), cited.path).toBe(cited.sha256);
      expect(text.split('\n')[cited.line - 1]).toContain(cited.literalQuote);
      expect(row.requiredNotices).toContain(cited.book);
    }
  }
  // Flesh to Ooze and Sand Whirlwind carry the record-level 3.5 tag.
  expect(
    review.candidates
      .filter((row) => row.recordLevelTags)
      .map((row) => [row.name, row.recordLevelTags]),
  ).toEqual([
    ['Flesh to Ooze', ['3.5']],
    ['Sand Whirlwind', ['3.5']],
  ]);
  for (const name of ['Flesh to Ooze', 'Sand Whirlwind'])
    expect(candidate(name).holdReason).toContain('record-level 3.5 tag');
  const crb = review.noticeRequirements.find((row) => row.book === 'PZO1110');
  expect(crb).toMatchObject({ registryKeys: ['CRB'], holdId: null });
  const held = review.noticeRequirements.filter((row) => row.holdId !== null);
  expect(held).toHaveLength(42);
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
  expect(unverified.map((row) => row.name)).toEqual([
    'Polymorph Familiar',
    'Monstrous Physique II',
    'Thanatotic Fury',
  ]);
  for (const row of unverified)
    expect(recorded(row).rationale).toContain(
      `Unverified origins: ${row.unverifiedOrigins[0]}.`,
    );
  // Roots fingerprinted by earlier batches' fixtures keep empty records.
  expect(
    review.candidates
      .filter((row) => row.mechanicsReview.protectedHistoricalContext)
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Black Tentacles',
    'Calcific Touch',
    'Compassionate Ally',
    'Cure Light Wounds',
    'Detect Thoughts',
    'Energy Siege Shot',
    'Euphoric Tranquility',
    'Interposing Hand',
    'Invisibility Purge',
    'Make Whole',
    'Meteor Swarm',
    'Monstrous Physique II',
    'Psychic Crush IV',
    'Purify Food and Drink',
    'Sand Whirlwind',
    'Shield of Faith',
    "Summon Nature's Ally IX",
    'Trap the Soul',
    'True Strike',
    'Wind Wall',
  ]);
  // Granted domain, subdomain and bloodline levels name the hold.
  expect(recorded(candidate('Wail of the Banshee')).rationale).toContain(
    'granted levels (bloodline: Ghoul, Maestro; domain: Death, Repose)',
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
    expect(row.additionalComparisonLeads).toEqual([]);
  }
  expect(rootComparisons).toBe(89);
  expect(pageMismatches.sort()).toEqual([
    'Familiar Figment p.22',
    "Old Salt's Curse p.79",
  ]);
  expect(
    review.candidates
      .filter((row) => !row.comparison)
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Amnesia',
    'Cleromancy',
    'Dousing Rain',
    'Flesh to Ooze',
    'Greater Reversion',
    'Infuse Self',
    'Rock Whip',
    'Summon Ship',
    'Thanatotic Fury',
    'Thunderous Footfalls',
    'Vermicious Assumption',
  ]);
  // Rows come only from the cited publication, not from reprints or mythic files.
  expect(candidate("Summon Nature's Ally IX").comparison).toMatchObject({
    path: 'data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_spells.lst',
    book: 'PZO1110',
    sourcePage: 'p.354',
  });
  expect(candidate('Planetary Adaptation, Mass').comparison).toMatchObject({
    book: 'PZO9449',
    sourcePage: 'p.29',
  });
  // Channel the Gift's second publication (PZO9202) has no PCGen row.
  expect(candidate('Channel the Gift').comparison?.book).toBe('PZO9267');
  // PCGen's variant name for "X, Mass" rows.
  expect(candidate("Cat's Grace, Mass").comparison?.literalRow).toMatch(
    /^Cat's Grace \(Mass\)\t/,
  );
  expect(
    review.candidates
      .filter((row) => row.mechanicsReview.sourceDiscrepancies.length)
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Echolocation',
    'Energy Siege Shot',
    'Euphoric Tranquility',
    'Familiar Figment',
    'Infuse Self',
    'Intellect Fortress III',
    'Monstrous Physique II',
    "Old Salt's Curse",
    'Planetary Adaptation, Mass',
    'Sand Whirlwind',
    'Sonic Thrust',
    'Transmute Potion to Poison',
    'Veil of Positive Energy',
    'Wail of the Banshee',
  ]);
  // PCGen race rows name the publication and page of depended-on creatures.
  const creatures = new Map<string, string>();
  for (const row of review.candidates)
    for (const creature of row.inheritedRuleComparisons) {
      const lines = files.get(creature.path)?.split('\n') ?? [];
      expect(lines[creature.line - 1]).toBe(creature.literalRow);
      expect(creature.literalRow.split('\t')[0]).toBe(creature.name);
      expect(sha(creature.literalRow)).toBe(creature.comparisonLineSha256);
      expect(
        files
          .get(creature.publicationAnchor.path)
          ?.split('\n')
          [creature.publicationAnchor.line - 1]?.split('\t'),
      ).toContain(creature.publicationAnchor.text);
      expect(creature.literalRow).toContain(
        `\tSOURCEPAGE:${creature.sourcePage}\t`,
      );
      expect(row.requiredNotices).toContain(creature.book);
      creatures.set(
        creature.name,
        `${creature.book} ${creature.sourcePage} ${creature.publicationAnchor.text}`,
      );
    }
  expect(Object.fromEntries(creatures)).toEqual({
    'Gray Ooze': 'PZO1112 p.166 SOURCELONG:Bestiary',
    'Gelatinous Cube': 'PZO1112 p.138 SOURCELONG:Bestiary',
    'Ochre Jelly': 'PZO1112 p.218 SOURCELONG:Bestiary',
    'Black Pudding': 'PZO1112 p.35 SOURCELONG:Bestiary',
    'Devil (Belier)': 'PZO1116 p.85 SOURCELONG:Bestiary 2',
    'Demon (Vermlek)':
      'PZO9225 p.54 SOURCELONG:Lords of Chaos, Book of the Damned, Volume 2',
  });
});

it('records the inherited-rule notices of governing bodies, cited creatures, monster rules and class rules', () => {
  const requires = (name: string) => candidate(name).requiredNotices;
  const governing = (name: string) =>
    candidate(name).inheritedRuleSourceEvidence.map((body) => body.name);
  const cited = (name: string) =>
    candidate(name).inheritedRuleCitations.map(
      (row) => `${row.name.split(' (Universal')[0]} ${row.book}`,
    );
  // Linked and unlinked governing bodies, with their closures.
  expect(governing('Overland Flight')).toEqual(['Fly']);
  expect(governing('Web Bolt')).toEqual(['Web']);
  expect(governing('Epidemic')).toEqual(['Contagion']);
  expect(governing("Summon Nature's Ally IX")).toEqual([
    "Summon Nature's Ally I",
  ]);
  expect(requires("Summon Nature's Ally IX")).toEqual([
    'CRB',
    'PZO1110',
    'PZO1131',
  ]);
  expect(governing('Polymorph Familiar')).toEqual([
    'Beast Shape I',
    'Beast Shape II',
    'Beast Shape III',
    'Beast Shape IV',
  ]);
  // The body names intellect fortress II but links the Intellect Fortress I record.
  expect(governing('Intellect Fortress III')).toEqual([
    'Intellect Fortress II',
    'Intellect Fortress I',
  ]);
  expect(
    candidate('Intellect Fortress III').inheritedRuleSourceEvidence.map(
      (body) => body.role.split(':')[0],
    ),
  ).toEqual(['governing-body', 'governing-body closure']);
  expect(
    candidate('Intellect Fortress III').mechanicsReview.curationRecords[0]
      ?.text,
  ).toContain(
    '@UUID[Compendium.pf1.spells.Item.twthnjx7cnvfzez2]{intellect fortress II}',
  );
  expect(governing('Planetary Adaptation, Mass')).toEqual([
    'Planetary Adaptation',
    'Planar Adaptation',
  ]);
  expect(requires('Planetary Adaptation, Mass')).toContain('PZO1115');
  // Greater false resurrection: a young belier devil (Bestiary 2 85, 292) and
  // the possession rules of the governing false resurrection.
  expect(governing('False Resurrection, Greater')).toEqual([
    'False Resurrection',
    'True Resurrection',
    'Resurrection',
    'Possession',
    'Raise Dead',
  ]);
  expect(requires('False Resurrection, Greater')).toEqual([
    'CRB',
    'PZO1110',
    'PZO1112',
    'PZO1116',
    'PZO1131',
    'PZO1132',
    'PZO1134',
  ]);
  expect(cited('False Resurrection, Greater')).toEqual([
    'Young (quick) PZO1112',
    'Young (rebuild) PZO1112',
  ]);
  // Explicit citations of other books.
  expect(requires('Arcane Cannon')).toContain('PZO1115');
  expect(requires('Vermicious Assumption')).toEqual([
    'CRB',
    'PZO1110',
    'PZO1131',
    'PZO9074',
    'PZO9225',
  ]);
  // Class rules: the summoner's eidolon.
  expect(cited('Life Conduit')).toEqual(['Summoner PZO1115']);
  // Monster rules the spells grant or apply.
  expect(cited('Echolocation')).toEqual(['Blindsight PZO1112']);
  expect(cited('Follow Aura')).toEqual(['Scent PZO1112']);
  expect(cited('Phantasmal Reminder')).toEqual(['Telepathy PZO1112']);
  expect(cited('Thanatotic Fury')).toEqual(['Damage Reduction PZO1112']);
  expect(cited('Restore Corpse')).toEqual([
    'Skeleton PZO1112',
    'Zombie PZO1112',
  ]);
  expect(cited('Flesh to Ooze')).toEqual(['Split PZO1116']);
  expect(requires('Flesh to Ooze')).toEqual([
    'CRB',
    'PZO1110',
    'PZO1112',
    'PZO1116',
    'PZO1131',
    'PZO9210',
  ]);
  // Polymorph forms: darkvision to Bestiary 4 and jet to Bestiary 2 as their
  // earliest books, as for Beast Shape III in #543.
  expect(requires('Polymorph Familiar')).toEqual([
    'CRB',
    'PZO1110',
    'PZO1112',
    'PZO1116',
    'PZO1127',
    'PZO1129',
    'PZO1131',
  ]);
  expect(cited('Polymorph Familiar')).toEqual([
    'Blindsense PZO1112',
    'Breath Weapon PZO1112',
    'Constrict PZO1112',
    'Darkvision PZO1127',
    'Ferocity PZO1112',
    'Grab PZO1112',
    'Jet PZO1116',
    'Low-Light Vision PZO1112',
    'Poison PZO1112',
    'Pounce PZO1112',
    'Rake PZO1112',
    'Rend PZO1112',
    'Scent PZO1112',
    'Trample PZO1112',
    'Tremorsense PZO1112',
    'Trip PZO1112',
    'Web PZO1112',
  ]);
  expect(requires('Monstrous Physique II')).toEqual([
    'CRB',
    'PZO1110',
    'PZO1112',
    'PZO1116',
    'PZO1117',
    'PZO1127',
    'PZO1131',
  ]);
  // Infuse Self: explicit B2/B3/B5 markers and the pinned race records.
  expect(requires('Infuse Self')).toEqual([
    'CRB',
    'PZO1110',
    'PZO1112',
    'PZO1116',
    'PZO1120',
    'PZO1127',
    'PZO1131',
    'PZO1133',
    'PZO1141',
    'PZO9280',
  ]);
  expect(cited('Infuse Self')).toEqual([
    'Aasimar PZO9280',
    'Aphorite PZO1141',
    'Darkvision PZO1127',
    'Duskwalker PZO1141',
    'Fetchling PZO9280',
    'Ganzi PZO1141',
    'Ifrit PZO9280',
    'Low-Light Vision PZO1112',
    'Oread PZO9280',
    'Shabti PZO1133',
    'Suli PZO9280',
    'Sylph PZO9280',
    'Tiefling PZO9280',
    'Undine PZO9280',
  ]);
  expect(
    heldNotices.find(
      (hold) => hold.id === 'spells-544-notice-PZO9225-complete-chain',
    ),
  ).toEqual({
    id: 'spells-544-notice-PZO9225-complete-chain',
    notices: ['PZO9225'],
    evidence: ['scripts/catalog/legal/spells-544.json'],
  });
  // Importer gaps (#719/#720): lost descriptors; no journal links.
  expect(
    review.metadataImportGaps.find(
      (row) => row.externalKey === candidate('Follow Aura').externalKey,
    ),
  ).toMatchObject({
    published: ['chaotic, evil, good, or lawful'],
    imported: [],
  });
  expect(review.metadataImportGaps).toHaveLength(48);
  expect(review.referenceImportGaps).toEqual([]);
});

it('records Spells without changing holder statistics and surfaces only their readable Notes', () => {
  for (const [name, tag] of [
    ['Shield of Faith', 'cleric'],
    ['Veil of Positive Energy', 'paladin'],
    ['Forest Friend', 'druid'],
    ['Enticing Adulation', 'wizard'],
    ["Cat's Grace, Mass", 'wizard'],
    ['Grand Destiny', 'wizard'],
    ['True Strike', 'wizard'],
    ['Batrachian Surge', 'druid'],
    ['Monstrous Physique II', 'wizard'],
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
  const friend = calculateCharacterSheetProjections(
    recordedSpellSheet('Forest Friend', 'druid'),
  ).current;
  expect(friend.entryNotes).toHaveLength(1);
  expect(friend.entryNotes[0]).not.toHaveProperty('situation');
  expect(spellFixture('Forest Friend').situationalNotes).toEqual([
    {
      text: 'While subject to this spell, the targets find that forested areas become helpful instead of hindering. The targets suffer no hindrances to movement and suffer no penalties on Acrobatics and Stealth checks from undergrowth in forested terrain. Furthermore, forested overgrowth imposes a miss chance 10% lower than normal. When moving in and among trees, those subject to the spell gain a +5 circumstance bonus on Acrobatics checks and Climb checks. Rangers in their favored terrain can also add their favored terrain bonus on such Acrobatics and Climb checks.',
    },
  ]);
  // Table rows read as "cell | cell" lines.
  expect(spellFixture('Summon Ship').situationalNotes?.[0]?.text).toContain(
    'Caster Level | Ship Type | Focus Cost\n7th | Keelboat | 300 gp\n',
  );
  // Link labels read as text, including a link whose label names another record.
  expect(
    spellFixture('Intellect Fortress III').situationalNotes?.[0]?.text,
  ).toMatch(/^This spell functions as intellect fortress II, but creatures/);
  // The pinned body keeps its typo verbatim.
  expect(
    spellFixture('Veil of Positive Energy').situationalNotes?.[0]?.text,
  ).toContain('+2 sacred bonus to AC and a+2 sacred bonus on saves');
  // Protected roots keep their earlier-batch fingerprints: no Notes at all.
  expect(spellFixture('Shield of Faith').situationalNotes).toBeUndefined();
  expect(
    calculateCharacterSheetProjections(
      recordedSpellSheet('Shield of Faith', 'cleric'),
    ).current.entryNotes,
  ).toEqual([]);
});

it('reextracts every root from a clean shared fixture tree and admits only the confirmed launch rows once their bodies are present', async () => {
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
    // #544 whole-content wave 2 binds six launch roots on their full-preview
    // closures, which include the spells their bodies link.
    const withLinks = {
      ...bounded,
      catalog: {
        ...bounded.catalog,
        entries: [...preview.entries, ...linkedContext.entries],
      },
    };
    for (const row of review.candidates) {
      const assessment = reviewedAdmission.assessments.find(
        (current) => current.externalKey === row.externalKey,
      );
      const reassessed = row.launchReview;
      expect(assessment).toMatchObject({
        status: row.assessmentStatus,
        ...bindSnapshotToCurrentNotices(row.currentBinding),
        requiredNotices: row.requiredNotices,
        rationale: row.rationale ?? row.holdReason,
        reviewedBy: reassessed?.reviewedBy ?? REVIEWER,
        reviewedOn: reviewedOnOf(reassessed),
      });
      expect(
        buildAssessmentBinding({
          ...withFullBindingContext738({
            artifact: linkedContext.rootKeys.includes(row.externalKey)
              ? withLinks
              : bounded,
            entry: spellFixture(row.name),
          }),
          requiredNotices: row.requiredNotices,
          evidenceIds: [row.evidenceId],
          ...reviewedAdmission,
        }),
      ).toEqual(bindSnapshotToCurrentNotices(row.currentBinding));
    }

    // With every governing body present, no root fails. #544 whole-content
    // wave 2: the admitted launch rows pass and the rest stay held.
    const linked = await importCatalog({
      ...tree,
      remaps,
      curation: reviewedCuration,
    });
    const gate = assessCatalogAdmission({
      artifact: linked,
      ...reviewedAdmission,
    });
    const ours = (rows: { externalKey: string }[]) =>
      rows
        .map((row) => row.externalKey)
        .filter((key) => keys.includes(key))
        .sort();
    const launch = review.launchReassessment;
    expect(ours(gate.admitted)).toEqual([...launch.admittedKeys].sort());
    expect(ours(gate.dependentOmissions)).toEqual(
      [...launch.dependentlyOmittedKeys].sort(),
    );
    expect(ours(gate.failures)).toEqual([]);
    expect(ours(gate.held)).toHaveLength(65);
    // Confirming one root still holds it on the unreviewed Unchained notice.
    const weapon = candidate('Disrupting Weapon');
    expect(weapon.requiredNotices).toEqual(['CRB', 'PZO1110', 'PZO1131']);
    const confirmed = assessWithUnclearedHolds({
      artifact: linked,
      ...reviewedAdmission,
      assessments: reviewedAdmission.assessments.map((row) =>
        row.externalKey === weapon.externalKey
          ? {
              ...row,
              status: 'confirmed' as const,
              ...buildAssessmentBinding({
                artifact: linked,
                entry: spellFixture('Disrupting Weapon'),
                requiredNotices: weapon.requiredNotices,
                evidenceIds: [weapon.evidenceId],
                ...reviewedAdmission,
              }),
            }
          : row,
      ),
    });
    // PZO1131 is reviewed (2026-10-30): its uncleared chain holds hold it.
    expect(
      confirmed.held.find((row) => row.externalKey === weapon.externalKey)
        ?.reason,
    ).toMatch(/^Notice holds: PZO1131 \(/);
    expect(
      confirmed.admitted.some((row) => row.externalKey === weapon.externalKey),
    ).toBe(false);
  } finally {
    await tree.dispose();
  }
});

function launchRow(name: string) {
  const row = candidate(name);
  if (!row.launchReview) throw new Error(`No launch review of ${name}`);
  return { row, pcgen: row.launchReview.pcgen };
}

it('pins the launch re-assessment of the 42 launch rows to the literal pinned PCGen rows (#544 whole-content wave 2)', async () => {
  const launch = review.launchReassessment;
  const assessed = review.candidates.filter((row) => row.launchReview);
  expect(assessed).toHaveLength(42);
  // #516 whole-content wave 3 admits Summon Nature's Ally I, so Summon
  // Nature's Ally IX moves from omitted to admitted (option B).
  // The waves 1-2 correction holds four at the gate and moves Cat's Grace,
  // Mass to omitted.
  expect(launch.admittedKeys).toHaveLength(29);
  expect(launch.dependentlyOmittedKeys).toHaveLength(6);
  expect(launch.admittedKeys).toContain('pf1/x6y3kyvxf8s31jhy');
  expect(Object.keys(launch.namedHolds)).toHaveLength(3);
  expect(Object.keys(launch.noticeHeldKeys)).toHaveLength(4);
  let corrected = 0;
  for (const row of assessed) {
    if (!row.launchReview) throw new Error(row.name);
    await expectPinnedPcgenRows(row, row.launchReview);
    expectLaunchOutcome(row, { batch: 544, launch });
    if (!row.launchReview.metadata.grantedLevelEvidence) continue;
    await expectGrantedLevelsBounded(row, row.launchReview, 544);
    corrected++;
  }
  expect(corrected).toBe(9);
  // The batch's other 58 candidates keep their earlier review and holds.
  for (const row of review.candidates.filter((r) => !r.launchReview)) {
    expect(row.disposition, row.name).toBe('held');
    expect(row.assessmentStatus, row.name).toBe('unresolved');
    expect(row.holdIds, row.name).toContain(
      `spells-544-whole-content-${row.externalKey.split('/')[1]}`,
    );
  }
  // A Core Rulebook spell, admitted on its .MOD full-description row.
  const cure = launchRow('Cure Light Wounds');
  expect(cure.row.disposition).toBe('admitted');
  expect(cure.pcgen).toMatchObject({
    path: 'data/pathfinder/paizo/roleplaying_game/core_rulebook/cr_spells.lst',
    line: 888,
    textMatches: true,
    baseRow: { line: 126 },
  });
  expect(cure.pcgen.literalRow).toMatch(/^Cure Light Wounds\.MOD\t/);
  // An Advanced Race Guide spell: the base row's single DESC is the full body.
  const blaze = launchRow('Blood Blaze');
  expect(blaze.row.disposition).toBe('admitted');
  expect(blaze.pcgen).toMatchObject({
    path: 'data/pathfinder/paizo/roleplaying_game/advanced_race_guide/arg_spells.lst',
    line: 121,
    textMatches: true,
    baseRow: { line: 121 },
  });
  expect(blaze.pcgen.literalRow).not.toContain('PRERULE');
  // Confirmed, but omitted while the spell its body links is held.
  const animal = launchRow('Reduce Animal');
  expect(animal.row.disposition).toBe('dependently-omitted');
  expect(animal.pcgen.wordDifferences).toEqual([
    { pinned: 'chapter 6', pcgen: 'equipment' },
  ]);
  expect(spellFixture('Reduce Animal').description).toContain(
    'catalog:pf1/2y9e1l6zso9tdg0a',
  );
  // Named holds: a wording conflict and a body whose sidebar is missing.
  const whole = launchRow('Make Whole');
  expect(whole.row.holdIds).toEqual([
    'spells-544-owner-owed-content-x23pz2agjub1eh89',
  ]);
  expect(whole.pcgen.wordDifferences).toEqual([
    { pinned: 'an object or', pcgen: 'a' },
  ]);
  expect(whole.pcgen.literalRow).toContain(
    'when cast on a construct creature [maximum 5d6]',
  );
  const poison = launchRow('Transmute Potion to Poison');
  expect(poison.row.disposition).toBe('held');
  expect(poison.pcgen).toMatchObject({ line: 2094, baseRow: { line: 249 } });
  expect(poison.pcgen.literalRow).toContain(
    'Transmute Potion to Poison.MOD\tDESC:',
  );
  expect(poison.pcgen.wordDifferences).toHaveLength(1);
  expect(poison.pcgen.wordDifferences[0]?.pinned).toBe('');
  // A matching body whose granted abilities' origins no source bounds.
  const physique = launchRow('Monstrous Physique II');
  expect(physique.row.holdIds).toEqual([
    'spells-544-unbounded-origins-xpwa181h8eghfew2',
  ]);
  expect(physique.pcgen).toMatchObject({ line: 147, textMatches: true });
});

it("bounds the corrected rows' bloodline and subdomain mappings by pinned PCGen rows, holding the unnoticed ones at the gate (waves 1-2 correction)", () => {
  const launch = review.launchReassessment;
  const grant = (name: string, mapping: string) => {
    const found = launchRow(
      name,
    ).row.launchReview?.metadata.grantedLevelEvidence?.find(
      (g) => g.mapping === mapping,
    );
    if (!found) throw new Error(`${name} ${mapping}`);
    return {
      ...found,
      rows: (found.pcgen ?? []).map(
        (r) => `${r.path.split('/').pop()}:${r.line}`,
      ),
    };
  };
  const meteor = launchRow('Meteor Swarm').row;
  expect(meteor).toMatchObject({
    disposition: 'held',
    assessmentStatus: 'confirmed',
  });
  expect(meteor.requiredNotices).toEqual([
    'CRB',
    'PZO1110',
    'PZO1115',
    'PZO1131',
    'PZO9267',
    'PZO9413',
  ]);
  expect(grant('Meteor Swarm', 'bloodline.Orc 9').rows).toEqual([
    'oog_abilities_class.lst:12',
    'oog_abilities_class.lst:7',
  ]);
  expect(grant('Meteor Swarm', 'subDomain.Stars 9')).toMatchObject({
    book: 'PZO9267',
    page: '227',
    rows: ['isg_domains.lst:22'],
  });
  expect(launch.noticeHeldKeys[meteor.externalKey]).toMatch(/^PZO9413 /);
  for (const name of ['True Strike', 'Trap the Soul', 'Overwhelming Presence'])
    expect(
      launch.noticeHeldKeys[launchRow(name).row.externalKey],
      name,
    ).toMatch(/^PZO9443 /);
  const wail = launchRow('Wail of the Banshee').row;
  expect(wail.disposition).toBe('admitted');
  expect(wail.requiredNotices).toEqual(
    expect.arrayContaining(['PZO1117', 'PZO1130']),
  );
  expect(grant('Wail of the Banshee', 'bloodline.Ghoul 9')).toMatchObject({
    book: 'PZO1130',
    page: '80',
    rows: ['mc_abilities_class.lst:136', 'mc_abilities_class.lst:130'],
  });
  const flight = launchRow('Overland Flight').row;
  expect(flight.disposition).toBe('admitted');
  expect(grant('Overland Flight', 'domain.Void 5')).toMatchObject({
    book: 'PZO9226',
    page: '217',
    rows: ['iswg_domains.lst:7'],
  });
  // Option B: Cat's Grace, Mass follows its held Cat's Grace (#536).
  const mass = launchRow("Cat's Grace, Mass").row;
  expect(mass.disposition).toBe('dependently-omitted');
  expect(launch.dependentlyOmittedKeys).toContain(mass.externalKey);
});
