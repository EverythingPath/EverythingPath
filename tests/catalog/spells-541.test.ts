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
import { withWaveF2BindingContext } from './wave-f2-binding-context';
import { calculateCharacterSheetProjections } from '../../src/lib/character-sheet';
import {
  review,
  preview,
  pinnedFiles,
  pinnedSha256,
} from '../fixtures/spells-541/data';
import { recordedSpellSheet, spellFixture } from '../fixtures/spells-541/sheet';
import { materializePinnedTree, readPinned } from './pinned-sources';
import { bindSnapshotToCurrentNotices } from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';
import {
  expectWaveCl2Spell,
  expectWaveCl5Spell,
  expectWaveCl6Spell,
  expectWaveCl7Spell,
  expectWaveF2Spell,
  isWaveCl2Row,
  isWaveCl5Row,
  isWaveCl6Row,
  isWaveCl7Row,
  isWaveF2Row,
} from './launch-reassessment';

const REVIEWER = 'Opus (AI curator) for the owner';
const REVIEWED_ON = '2026-10-13';
// Wave CL5 keeps Detect Evil held on a named content hold: its closing
// aura-power table is in no permitted pinned source.
const DETECT_EVIL_HOLD = 'spells-541-owner-owed-content-tr7m97npkbgm4wp7';
// Wave CL6 keeps Fester held on a named content hold: PCGen has only its
// one-line summary, and its one full-row record carries another spell's text.
const FESTER_HOLD = 'spells-541-owner-owed-content-thnav06t8k8ox78j';
const ownerOwed = (row: { externalKey: string }) =>
  `spells-541-owner-owed-content-${row.externalKey.split('/')[1]}`;
const relaunchedAdmitted = (row: {
  launchReview?: unknown;
  disposition: string;
}) => Boolean(row.launchReview) && row.disposition === 'admitted';
const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
const keys = review.candidates.map((row) => row.externalKey);
const noticeHold = (code: string) => `spells-541-notice-${code}-complete-chain`;
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
    // #628 wave F2 admits Beast Shape I, which Wild Shape links; wave CL2
    // Ghostbane Dirge, which Ghostbane Dirge, Mass reaches; wave CL7 the
    // batch's 14 class-list-only Spells and Move Earth, which Earth Glide
    // reaches.
    admitted: 17,
    held: 83,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 0,
    recordLevel35Holds: 0,
  });
  expect(review.mechanicsSummary).toMatchObject({
    checkedDescriptionRecords: 100,
    recordsWithNotes: 69,
    protectedRoots: 31,
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
    // A wave F2 row is confirmed and cites its cleared holds in its notice
    // chain instead (launchReview.noticeChain); wave CL5's named hold keeps
    // its cleared chain holds recorded (they hold nothing).
    expect(row.noticeHoldIds).toEqual(
      relaunchedAdmitted(row)
        ? []
        : row.requiredNotices
            .filter((code) => code !== 'CRB' && code !== 'PZO1110')
            .map(noticeHold),
    );
    for (const code of row.requiredNotices.slice(1))
      if (code !== 'PZO1110' && !row.launchReview)
        expect(holds.get(noticeHold(code)), code).toEqual([code]);
    expect(row.holdIds).toEqual(
      relaunchedAdmitted(row)
        ? []
        : row.launchReview
          ? [ownerOwed(row)]
          : [`spells-541-whole-content-${row.externalKey.split('/')[1]}`],
    );

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
  expect(held).toHaveLength(54);
  for (const requirement of held)
    expect(holds.get(requirement.holdId ?? '')).toEqual([requirement.book]);
  // No held code has a Registry identity; the Registry is unchanged.
  expect(held.filter((row) => row.registryKeys.length)).toEqual([]);
  // Origins without a pinned source stay inside the whole-content hold.
  for (const name of [
    'Summon Minor Ally',
    'Fey Form IV',
    'Form of the Exotic Dragon I',
    'Project Weakness',
    'See Beyond',
  ]) {
    const row = candidate(name);
    expect(row.unverifiedOrigins, name).toHaveLength(1);
    expect(row.holdReason, name).toContain(
      `Unverified origins: ${row.unverifiedOrigins[0]}.`,
    );
  }
  expect(
    review.candidates.filter((row) => row.unverifiedOrigins.length),
  ).toHaveLength(5);
  // Roots used by earlier batch fixtures keep empty records.
  expect(
    review.candidates
      .filter((row) => row.mechanicsReview.protectedHistoricalContext)
      .map((row) => row.name),
  ).toEqual(
    expect.arrayContaining(['Resurrection', 'Beast Shape I', 'Mage Armor']),
  );
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
  expect(rootComparisons).toBe(96);
  expect(
    review.candidates
      .filter((row) => !row.comparison)
      .map((row) => row.name)
      .sort(),
  ).toEqual(['Inhibiting Patterns', 'Reveal Mirage', 'Rotgut', 'Yellow Sign']);
  // Further cited publications keep their own PCGen rows.
  const books = (name: string) =>
    [
      candidate(name).comparison,
      ...candidate(name).additionalComparisonLeads,
    ].map((row) => row?.book);
  expect(books('Mark of Blood')).toEqual(['PZO1138', 'PZO9221']);
  expect(books('Recorporeal Incarnation')).toEqual(['PZO9292', 'PZO9016']);
  expect(books('Sea Steed')).toEqual(['PZO1140', 'PZO9429']);
  // PCGen's variant names for "X, Greater", "X, Lesser" and "X, Mass" rows.
  expect(candidate('Detect Magic, Greater').comparison?.literalRow).toMatch(
    /^Detect Magic \(Greater\)\t/,
  );
  expect(candidate('Confusion, Lesser').comparison?.literalRow).toMatch(
    /^Confusion \(Lesser\)\t/,
  );
  expect(candidate('Hold Person, Mass').comparison?.literalRow).toMatch(
    /^Hold Person \(Mass\)\t/,
  );
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
    'Deadly Juggernaut': [
      'PCGen uc_spells.lst:31 cites p.226; the pinned source cites 227.',
    ],
    'Sea Steed': [
      'PCGen anar_spells.lst:13 cites p.23; the pinned source cites 25.',
    ],
  });
  // PCGen writes See Beyond's page without the "p." prefix; it still matches.
  expect(candidate('See Beyond').comparison).toMatchObject({
    sourcePage: '13',
    pageMatchesCitation: true,
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
      const title = {
        PZO1112: 'Bestiary',
        PZO1127: 'Bestiary 4',
        PZO9213: 'Princes of Darkness, Book of the Damned, Volume 1',
      }[bestiary.book];
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
    'Eagle (Giant)': 'PZO1112 p.118',
    Zombie: 'PZO1112 p.288',
    Vampire: 'PZO1112 p.270',
    Hastur: 'PZO1127 p.140',
    'Devil, Lesser Host (Gaav)': 'PZO9213 p.58',
    'Devil, Greater Host (Magaav)': 'PZO9213 p.58',
  });
});

it('records the inherited-rule notices of governing bodies, cited creatures, monster rules and class rules', () => {
  const requires = (name: string) => candidate(name).requiredNotices;
  const governing = (name: string) =>
    candidate(name).inheritedRuleSourceEvidence.map((body) => body.name);
  const cited = (name: string) =>
    candidate(name).inheritedRuleCitations.map((row) => row.name);
  const linked = (name: string) =>
    candidate(name).linkedContentReview.map((row) => row.name);
  // Explicit Bestiary, Bestiary 4, Princes of Darkness, Occult Adventures and GameMastery Guide citations.
  for (const name of [
    'Eagle Aerie',
    'Flesh Puppet',
    'Project Weakness',
    'Magnetic Field',
    'Dragon Turtle Shell',
  ])
    expect(requires(name), name).toContain('PZO1112');
  expect(requires('Yellow Sign')).toContain('PZO1127');
  expect(requires('Summon Infernal Host')).toEqual([
    'CRB',
    'PZO1110',
    'PZO1131',
    'PZO9213',
    'PZO9232',
  ]);
  expect(governing('Summon Infernal Host')).toEqual([
    'Summon Monster V',
    'Summon Monster I',
  ]);
  expect(requires('Reveal Emotions')).toContain('PZO1132');
  expect(requires('Rotgut')).toEqual([
    'CRB',
    'PZO1110',
    'PZO1114',
    'PZO1131',
    'PZO1136',
  ]);
  expect(cited('Dragon Turtle Shell')).toEqual(['Improved Natural Attack']);
  // Class features named by the text cite their class records.
  expect(requires('Arcane Disruption')).toEqual([
    'CRB',
    'PZO1110',
    'PZO1115',
    'PZO1117',
    'PZO1126',
    'PZO1129',
    'PZO1131',
    'PZO9451',
  ]);
  expect(cited('Arcane Disruption')).toEqual(['Arcanist', 'Magus', 'Witch']);
  expect(cited('Imbue Hex')).toEqual(['Witch', 'Shaman']);
  expect(requires('Pilfering Hand')).toContain('PZO1115');
  // Universal monster rules granted by forms cite their monster-ability records.
  expect(cited('Sea Steed')).toEqual(['Amphibious']);
  expect(cited('Beast Shape I')).toEqual([
    'Scent',
    'Darkvision',
    'Low-Light Vision',
  ]);
  expect(cited('Form of the Exotic Dragon I')).toEqual([
    'Breath Weapon',
    'Darkvision',
  ]);
  expect(cited('Angelic Aspect, Greater')).toEqual([
    'Darkvision',
    'Low-Light Vision',
  ]);
  // Darkvision's pinned record cites Bestiary 5, 4 and 6 (PZO1127, the earliest, is required); low-light vision cites the Bestiary.
  for (const name of [
    'Beast Shape I',
    'Form of the Exotic Dragon I',
    'Angelic Aspect, Greater',
  ])
    expect(requires(name), name).toEqual(
      expect.arrayContaining(['PZO1112', 'PZO1127']),
    );
  // Fey Form IV: monster-ability records plus the Universal Monster Rules journal,
  // which sources blood rage, compression, see in darkness, sound mimicry and
  // undersized weapons to Bestiary 2 and all-around vision to Bestiary 4.
  expect(requires('Fey Form IV')).toEqual([
    'CRB',
    'PZO1110',
    'PZO1112',
    'PZO1116',
    'PZO1127',
    'PZO1131',
    'PZO1140',
  ]);
  expect(cited('Fey Form IV')).toHaveLength(14);
  expect(
    candidate('Fey Form IV')
      .inheritedRuleCitations.filter((row) =>
        row.path.startsWith('packs/rules/universal-monster-rules-umr.'),
      )
      .map((row) => `${row.name.split(' (')[0]} ${row.literalQuote}`),
  ).toEqual([
    'All-Around Vision @Source[PZO1127;pages=290]',
    'Blood Rage @Source[PZO1116;pages=294]',
    'Compression @Source[PZO1116;pages=295]',
    'See in Darkness @Source[PZO1116;pages=301]',
    'Sound Mimicry @Source[PZO1116;pages=301]',
    'Undersized Weapons @Source[PZO1116;pages=303]',
  ]);
  expect(
    heldNotices.find(
      (hold) => hold.id === 'spells-541-notice-PZO1116-complete-chain',
    ),
  ).toEqual({
    id: 'spells-541-notice-PZO1116-complete-chain',
    notices: ['PZO1116'],
    evidence: ['scripts/catalog/legal/spells-541.json'],
  });
  expect(governing('Fey Form IV')).toEqual([
    'Fey Form III',
    'Fey Form II',
    'Fey Form I',
  ]);
  // Named and linked bodies.
  expect(requires("Shapechanger's Gift")).toContain('PZO1117');
  expect(governing("Shapechanger's Gift")).toEqual(['Monstrous Physique I']);
  expect(requires('Carve Passage')).toContain('PZO1115');
  expect(governing('Carve Passage')).toEqual(['Expeditious Excavation']);
  expect(governing('Angelic Aspect, Greater')).toEqual([
    'Angelic Aspect, Lesser',
    'Magic Circle against Evil',
    'Globe of Invulnerability, Lesser',
    'Tongues',
    'Protection from Evil',
  ]);
  expect(governing('Mental Barrier V')).toEqual([
    'Mental Barrier III',
    'Mental Barrier I',
  ]);
  expect(governing('Detect Magic, Greater')).toEqual([
    'Detect Magic',
    'Magic Aura, Greater',
    'Magic Aura',
    'Arcane Sight',
  ]);
  expect(governing('Earth Glide')).toEqual([]);
  expect(linked('Earth Glide')).toEqual(['Move Earth']);
  // The mass cure link is labelled "mass cure light wounds".
  expect(governing('Cure Moderate Wounds, Mass')).toEqual([
    'Cure Light Wounds, Mass',
  ]);
  expect(
    review.metadataImportGaps.find(
      (row) => row.externalKey === candidate('Frost Fall').externalKey,
    ),
  ).toMatchObject({ published: ['cold'], imported: [] });
  expect(review.metadataImportGaps).toHaveLength(42);
  // Importer gap (#719/#720): two rules-journal skill links are stripped.
  expect(review.referenceImportGaps).toEqual([
    {
      externalKey: candidate('Detect Magic, Greater').externalKey,
      field: 'description.link',
    },
    {
      externalKey: candidate('Detect Magic, Greater').externalKey,
      field: 'description.link',
    },
  ]);
});

it('records Spells without changing holder statistics and surfaces only their readable Notes', () => {
  for (const [name, tag] of [
    ['True Appraisal', 'cleric'],
    ['Channel Vigor', 'cleric'],
    ['Deadly Juggernaut', 'cleric'],
    ['Bestow Grace', 'paladin'],
    ['Aspect of the Bear', 'druid'],
    ['See Beyond', 'wizard'],
    ['Heroic Invocation', 'wizard'],
    ['Mage Armor', 'wizard'],
  ] as const) {
    const result = calculateCharacterSheetProjections(
      recordedSpellSheet(name, tag),
    );
    for (const projection of [result.current, result.permanent]) {
      expect(projection.abilities.strength.score, name).toBe(10);
      expect(projection.abilities.constitution.score, name).toBe(10);
      expect(projection.abilities.charisma.score, name).toBe(10);
      expect(projection.breakdowns['ac.armor'].total, name).toBe(0);
      expect(projection.breakdowns['ac.natural'].total, name).toBe(0);
      expect(projection.breakdowns['ac.other'].total, name).toBe(0);
      expect(projection.breakdowns.cmb.total, name).toBe(0);
      expect(projection.breakdowns['save.fort'].total, name).toBe(0);
      expect(projection.breakdowns['save.will'].total, name).toBe(0);
      expect(projection.breakdowns['skill.apr'].total, name).toBe(0);
      expect(projection.breakdowns['skill.per'].total, name).toBe(0);
      expect(projection.spellEffects, name).toEqual([]);
    }
  }
  const appraisal = calculateCharacterSheetProjections(
    recordedSpellSheet('True Appraisal', 'cleric'),
  ).current;
  expect(appraisal.entryNotes).toHaveLength(1);
  expect(appraisal.entryNotes[0]).not.toHaveProperty('situation');
  expect(spellFixture('True Appraisal').situationalNotes).toEqual([
    {
      text: "You gain temporary insight into the value of objects. You gain a +5 competence bonus on Appraise checks, can attempt an Appraise check to determine an object's value as a move action, and can take 10 on an Appraise check even if stress or distractions would normally prevent you from doing so. You know if you fail an Appraise check, and you never determine a wildly inaccurate price.",
    },
  ]);
  // An unlabelled link reads as the linked Spell's name.
  expect(spellFixture('Summon Minor Ally').situationalNotes?.[0]?.text).toMatch(
    /^This spell functions as summon nature's ally I, except you can summon 1d3 Tiny/,
  );
  expect(
    spellFixture('Summon Infernal Host').situationalNotes?.[0]?.text,
  ).toMatch(/^This spell functions as summon monster V, save that/);
  // Paragraphs read as separate lines.
  expect(spellFixture('Channel Vigor').situationalNotes?.[0]?.text).toContain(
    'only one channel vigor spell at a time.\nLimbs: You gain the benefits of a haste spell.\nMind: You gain a +4 competence bonus',
  );
  // Protected roots keep their earlier-batch fingerprints: no Notes at all.
  expect(spellFixture('Mage Armor').situationalNotes).toBeUndefined();
  expect(
    calculateCharacterSheetProjections(
      recordedSpellSheet('Mage Armor', 'wizard'),
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
        status: row.assessmentStatus,
        ...bindSnapshotToCurrentNotices(row.currentBinding),
        requiredNotices: row.requiredNotices,
        rationale: row.launchReview
          ? expect.stringContaining(
              `spells-541-whole-content-${row.externalKey.split('/')[1]}`,
            )
          : row.holdReason,
        reviewedBy: REVIEWER,
        reviewedOn: row.launchReview?.reviewedOn ?? REVIEWED_ON,
      });
      // Wave CL7's rows bind against their full-corpus closure, as the gate
      // does (expectWaveCl7Spell replays it).
      if (isWaveCl7Row(row)) continue;
      expect(
        buildAssessmentBinding({
          // Wave F2's rows bind against the full-corpus closure, as the gate does.
          ...withWaveF2BindingContext(
            withFullBindingContext738({
              artifact: bounded,
              entry: spellFixture(row.name),
            }),
          ),
          requiredNotices: row.requiredNotices,
          evidenceIds: [row.evidenceId],
          ...reviewedAdmission,
        }),
      ).toEqual(bindSnapshotToCurrentNotices(row.currentBinding));
    }

    // With every governing body present, only the journal-link gap fails and only wave F2's rows admit.
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
    // Wave F2's, CL2's and CL7's rows admit; every other root holds, Detect
    // Evil and Fester on waves CL5's and CL6's named holds.
    const relaunched = review.candidates
      .filter((row) => relaunchedAdmitted(row))
      .map((row) => row.externalKey);
    expect(
      gate.admitted
        .filter((row) => ours.has(row.externalKey))
        .map((row) => row.externalKey),
    ).toEqual(relaunched);
    // #738 keeps the root's rules journal link as text: no root fails.
    expect(gate.failures.filter((row) => ours.has(row.externalKey))).toEqual(
      [],
    );
    expect(gate.held.filter((row) => ours.has(row.externalKey))).toHaveLength(
      100 - relaunched.length,
    );
    // Confirming one root still holds it on the unreviewed Unchained notice.
    const openClose = candidate('Open/Close');
    expect(openClose.requiredNotices).toEqual(['CRB', 'PZO1110', 'PZO1131']);
    const confirmed = assessWithUnclearedHolds({
      artifact: linked,
      ...reviewedAdmission,
      assessments: reviewedAdmission.assessments.map((row) =>
        row.externalKey === openClose.externalKey
          ? {
              ...row,
              status: 'confirmed' as const,
              ...buildAssessmentBinding({
                artifact: linked,
                entry: spellFixture('Open/Close'),
                requiredNotices: openClose.requiredNotices,
                evidenceIds: [openClose.evidenceId],
                ...reviewedAdmission,
              }),
            }
          : row,
      ),
    });
    // PZO1131 is reviewed (2026-10-30): its uncleared chain holds hold it.
    expect(
      confirmed.held.find((row) => row.externalKey === openClose.externalKey)
        ?.reason,
    ).toMatch(/^Notice holds: PZO1131 \(/);
    expect(
      confirmed.admitted.some(
        (row) => row.externalKey === openClose.externalKey,
      ),
    ).toBe(false);
  } finally {
    await tree.dispose();
  }
});

it('re-assesses Beast Shape I, which Wild Shape links, in place against the literal pinned PCGen rows (#628 wave F2)', async () => {
  const launch = review.launchReassessment;
  if (!launch) throw new Error('launchReassessment');
  const assessed = review.candidates.filter((row) => isWaveF2Row(row));
  expect(assessed.map((row) => row.name)).toEqual(['Beast Shape I']);
  expect(launch).toMatchObject({
    // Waves CL2 and CL7 add their rows after wave F2's (laterRuns).
    admittedKeys: [
      ...assessed.map((row) => row.externalKey),
      ...review.candidates
        .filter((row) => isWaveCl2Row(row))
        .map((row) => row.externalKey),
      ...review.candidates
        .filter((row) => isWaveCl7Row(row))
        .map((row) => row.externalKey),
    ],
    dependentlyOmittedKeys: [],
    namedHolds: {},
  });
  // The Fur subdomain is the Advanced Player's Guide's (PZO1115).
  await expectWaveF2Spell(candidate('Beast Shape I'), {
    batch: 541,
    launch,
    requiredNotices: [
      'CRB',
      'PZO1110',
      'PZO1112',
      'PZO1115',
      'PZO1127',
      'PZO1131',
    ],
  });
});

it('re-assesses Ghostbane Dirge, which Ghostbane Dirge, Mass reaches, in place against the literal pinned PCGen rows (wave CL2)', async () => {
  const launch = review.launchReassessment;
  if (!launch) throw new Error('launchReassessment');
  expect(
    review.candidates.filter((row) => isWaveCl2Row(row)).map((row) => row.name),
  ).toEqual(['Ghostbane Dirge']);
  await expectWaveCl2Spell(candidate('Ghostbane Dirge'), {
    batch: 541,
    launch,
    requiredNotices: ['CRB', 'PZO1110', 'PZO1115', 'PZO1131'],
  });
});

it('re-assesses Detect Evil, which Detect Good reaches, in place and keeps it held on a named content hold (wave CL5)', async () => {
  const launch = review.launchReassessment;
  if (!launch) throw new Error('launchReassessment');
  const row = candidate('Detect Evil');
  expect(
    review.candidates
      .filter((item) => isWaveCl5Row(item))
      .map((item) => item.name),
  ).toEqual(['Detect Evil']);
  expect(launch.namedHolds).toMatchObject({
    [row.externalKey]: DETECT_EVIL_HOLD,
  });
  await expectWaveCl5Spell(row, {
    batch: 541,
    launch,
    requiredNotices: ['CRB', 'PZO1110', 'PZO1131'],
  });
  expect(row).toMatchObject({
    disposition: 'held',
    assessmentStatus: 'unresolved',
    holdIds: [DETECT_EVIL_HOLD],
  });
  // PCGen's full row says "see the table below" but carries no table: the
  // prose matches, and the aura-power table is the recorded, owed difference.
  expect(row.launchReview?.pcgen.wordDifferences).toHaveLength(2);
  expect(row.launchReview?.outstanding).toEqual([
    expect.stringContaining('aura-power table'),
  ]);
});

it('re-assesses Fester, which Fester, Mass reaches, in place and keeps it held on a named content hold (wave CL6)', async () => {
  const launch = review.launchReassessment;
  if (!launch) throw new Error('launchReassessment');
  const row = candidate('Fester');
  expect(
    review.candidates
      .filter((item) => isWaveCl6Row(item))
      .map((item) => item.name),
  ).toEqual(['Fester']);
  expect(launch.namedHolds).toMatchObject({
    [row.externalKey]: FESTER_HOLD,
  });
  await expectWaveCl6Spell(row, {
    batch: 541,
    launch,
    requiredNotices: ['CRB', 'PZO1110', 'PZO1115', 'PZO1131'],
  });
  expect(row).toMatchObject({
    disposition: 'held',
    assessmentStatus: 'unresolved',
    holdIds: [FESTER_HOLD],
  });
  // PCGen's only DESC of its own is the one-line summary; its glued
  // "Fester.MOD" record (apg_spells.lst:1944) carries feather step, mass's
  // text, and the commented-out row (:1770) has none.
  expect(row.launchReview?.pcgen.line).toBe(110);
  expect(row.launchReview?.additionalPcgen?.map((entry) => entry.line)).toEqual(
    [1944, 1770],
  );
  expect(row.launchReview?.additionalPcgen?.[0]?.literalRow).toContain(
    'Fester.MOD\tDESC:As feather step, except this spell affects multiple creatures.',
  );
  expect(row.launchReview?.outstanding).toEqual([
    expect.stringContaining('the complete body'),
  ]);
});

// Wave CL7 (#521, #528 and #541): the batch's 14 class-list-only Spells and
// Move Earth, which Earth Glide reaches, each with its exact required notices.
const WAVE_CL7_ROWS = [
  ['Spike Growth', ['CRB', 'PZO1110', 'PZO1131']],
  ['Cure Moderate Wounds, Mass', ['CRB', 'PZO1110', 'PZO1131']],
  ['Vortex', ['CRB', 'PZO1110', 'PZO1115', 'PZO1131']],
  ['Touch of the Sea', ['CRB', 'PZO1110', 'PZO1115', 'PZO1131']],
  ['Bestow Grace', ['CRB', 'PZO1110', 'PZO1115', 'PZO1131']],
  ['Darkness', ['CRB', 'PZO1110', 'PZO1131', 'PZO1127', 'PZO1112']],
  ['Earth Glide', ['CRB', 'PZO1110', 'PZO1121', 'PZO1131']],
  ['Unhallow', ['CRB', 'PZO1110', 'PZO1131']],
  ["Summon Nature's Ally III", ['CRB', 'PZO1110', 'PZO1131']],
  [
    'Resurgent Transformation',
    ['CRB', 'PZO1110', 'PZO1115', 'PZO1131', 'PZO1112'],
  ],
  ['Hold Person, Mass', ['CRB', 'PZO1110', 'PZO1131']],
  ['Aspect of the Bear', ['CRB', 'PZO1110', 'PZO1115', 'PZO1131']],
  ['Open/Close', ['CRB', 'PZO1110', 'PZO1131']],
  ['Passwall', ['CRB', 'PZO1110', 'PZO1131']],
  ['Move Earth', ['CRB', 'PZO1110', 'PZO1131', 'PZO1130', 'PZO1112']],
] as const;

it.each(WAVE_CL7_ROWS)(
  're-assesses %s in place against the literal pinned PCGen rows (wave CL7)',
  async (name, requiredNotices) => {
    const launch = review.launchReassessment;
    if (!launch) throw new Error('launchReassessment');
    await expectWaveCl7Spell(candidate(name), {
      batch: 541,
      launch,
      requiredNotices: [...requiredNotices],
    });
  },
);

it("records wave CL7 in place, with the monster rules Darkness and Resurgent Transformation name and Move Earth's Ghoul bloodline", () => {
  const wave = review.candidates.filter((row) => isWaveCl7Row(row));
  expect(wave.map((row) => row.name)).toEqual(
    WAVE_CL7_ROWS.map(([name]) => name),
  );
  expect(wave.every((row) => row.disposition === 'admitted')).toBe(true);
  const review_ = (name: string) => candidate(name).launchReview;
  // Darkness: darkvision (PZO1127, the pinned record's earliest book) and
  // light sensitivity (PZO1112); Resurgent Transformation: damage reduction.
  expect(
    candidate('Darkness').inheritedRuleNotices.map((rule) => rule.book),
  ).toEqual(expect.arrayContaining(['PZO1127', 'PZO1112']));
  expect(
    candidate('Resurgent Transformation').inheritedRuleCitations.map(
      (cite) => cite.literalQuote,
    ),
  ).toEqual(['@Source[PZO1112;pages=299]']);
  // Move Earth's Ghoul bloodline is Monster Codex's (PZO1130); it stays unmet
  // on its granted level.
  expect(
    review_('Move Earth')?.metadata.grantedLevelEvidence?.map((entry) => [
      entry.mapping,
      entry.book,
    ]),
  ).toEqual([['bloodline.Ghoul 6', 'PZO1130']]);
  expect(review_('Move Earth')?.metadata.readings).toContain(
    'CASTTIME:see text',
  );
  expect(review_('Cure Moderate Wounds, Mass')?.metadata.readings).toContain(
    'RANGE:Touch',
  );
});
