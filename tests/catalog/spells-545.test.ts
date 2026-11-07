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
} from '../fixtures/spells-545/data';
import { recordedSpellSheet, spellFixture } from '../fixtures/spells-545/sheet';
import { materializePinnedTree, readPinned } from './pinned-sources';
import { bindSnapshotToCurrentNotices } from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';

const REVIEWER = 'Opus (AI curator) for the owner';
const REVIEWED_ON = '2026-10-13';
const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
const keys = review.candidates.map((row) => row.externalKey);
const noticeHold = (code: string) => `spells-545-notice-${code}-complete-chain`;
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
    recordsWithNotes: 83,
    protectedRoots: 17,
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
    // No root carries a record-level 3.5 tag.
    expect((raw.system.tags ?? []) as string[], row.name).not.toContain('3.5');
    expect(row.recordLevelTags).toBeUndefined();
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
    expect(row.noticeHoldIds).toEqual(
      row.requiredNotices
        .filter((code) => code !== 'CRB' && code !== 'PZO1110')
        .map(noticeHold),
    );
    for (const code of row.requiredNotices.slice(1))
      if (code !== 'PZO1110')
        expect(holds.get(noticeHold(code)), code).toEqual([code]);
    const id = row.externalKey.split('/')[1];
    expect(row.holdIds).toEqual([`spells-545-whole-content-${id}`]);
    expect(row.holdReason.startsWith(`${row.holdIds.join('; ')}: `)).toBe(true);

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
  const crb = review.noticeRequirements.find((row) => row.book === 'PZO1110');
  expect(crb).toMatchObject({ registryKeys: ['CRB'], holdId: null });
  const held = review.noticeRequirements.filter((row) => row.holdId !== null);
  expect(held).toHaveLength(57);
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
    'Teleport Structure',
    'Elemental Body II',
    'Blood in the Water',
    'Tactical Insight',
    'Antitech Field',
  ]);
  for (const row of unverified)
    expect(row.holdReason).toContain(
      `Unverified origins: ${row.unverifiedOrigins[0]}.`,
    );
  // Roots fingerprinted by earlier batches' fixtures, and Greater Heroism, the
  // governing body inside #536 Greater Hollow Heroism's stored binding, keep
  // empty records.
  expect(
    review.candidates
      .filter((row) => row.mechanicsReview.protectedHistoricalContext)
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Calm Spirit',
    'Ego Whip I',
    'Elemental Body II',
    'Eyebite',
    'Giant Form II',
    'Heroism, Greater',
    'Hex Glyph',
    'Hold Animal',
    'Know Direction',
    'Lighten Object',
    'Magic Circle against Good',
    'Planar Binding, Lesser',
    'Plant Shape I',
    'Sanctuary',
    'Serenity',
    'Speak with Haunt',
    'Symbol of Weakness',
  ]);
  expect(record(candidate('Heroism, Greater').externalKey).rationale).toContain(
    'Greater Hollow Heroism (pf1/nyafit6oz90jqakn)',
  );
  // Granted domain, subdomain and bloodline levels name the hold.
  expect(candidate('Eyebite').holdReason).toContain(
    'granted levels (bloodline: Accursed, Pestilence; domain: Scalykind; subDomain: Curse)',
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
  expect(rootComparisons).toBe(93);
  expect(pageMismatches.sort()).toEqual([
    'Burning Arc p.27',
    'Ja Noi Aspect p.67',
    'Merge with Familiar p.232',
    'Rune Trace p.61',
    'Vex Giant p.62',
  ]);
  // Further cited publications with their own PCGen rows are kept as leads.
  expect(
    review.candidates
      .filter((row) => row.additionalComparisonLeads.length)
      .map((row) => [
        row.name,
        row.additionalComparisonLeads.map((lead) => lead.book),
      ]),
  ).toEqual([
    ['Lighten Object', ['PZO9418']],
    ['Codespeak', ['PZO9401', 'PZO9462']],
    ['Merge with Familiar', ['PZO9454']],
    ['Lose the Trail', ['PZO9420']],
  ]);
  expect(
    review.candidates
      .filter((row) => !row.comparison)
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Bloody Tears and Jagged Smile',
    'Drain Construct',
    'Flame Steed',
    'Frosty Aura',
    'Litany of the Red Crusader',
    "Rival's Weald",
    'Scintillating Wall',
  ]);
  // Rows come only from the cited publication: the PCGen row keyed under
  // another display name, the "X (Giant)" variant and an adventure-path
  // chapter title.
  expect(candidate('Burning Arc').comparison).toMatchObject({
    book: 'PZO9417',
    sourcePage: 'p.27',
  });
  expect(candidate('Burning Arc').comparison?.literalRow).toMatch(
    /^Burning Arc \(Keleshite\)\t/,
  );
  expect(
    candidate('Invisibility Bubble, Giant').comparison?.literalRow,
  ).toMatch(/^Invisibility Bubble \(Giant\)\t/);
  expect(candidate('Ja Noi Aspect').comparison).toMatchObject({
    book: 'PZO90115',
    publicationAnchor: {
      text: 'SOURCELONG:Ironfang Invasion, Chapter 1 - Trail of the Hunted',
    },
  });
  expect(candidate('Waters of Lamashtu').comparison).toMatchObject({
    book: 'PZO9226',
    sourcePage: 'p.297',
  });
  expect(
    review.candidates
      .filter((row) => row.mechanicsReview.sourceDiscrepancies.length)
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Burning Arc',
    'Chains of Fire',
    'Grave Words',
    'Ja Noi Aspect',
    'Massacre',
    'Merge with Familiar',
    'Repair Undead, Mass',
    'Resilient Reservoir',
    'Rune Trace',
    'Spiritual Squire',
    'Summon Genie',
    'Vex Giant',
    'Wreath of Blades',
  ]);
  expect(
    candidate('Massacre').mechanicsReview.sourceDiscrepancies[0],
  ).toContain('"the final square of the 60-foot line"');
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
    'Animated Object (Medium)': 'PZO1112 p.14 SOURCELONG:Bestiary',
    'Genie (Djinni)': 'PZO1112 p.139 SOURCELONG:Bestiary',
    'Genie (Janni)': 'PZO1112 p.141 SOURCELONG:Bestiary',
    'Genie (Efreeti)': 'PZO1112 p.140 SOURCELONG:Bestiary',
    'Genie (Marid)': 'PZO1112 p.142 SOURCELONG:Bestiary',
    'Genie (Shaitan)': 'PZO1112 p.143 SOURCELONG:Bestiary',
    Shark: 'PZO1112 p.247 SOURCELONG:Bestiary',
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
  expect(governing('Daze Monster')).toEqual(['Daze']);
  expect(governing('Healing Warmth')).toEqual(['Protection from Energy']);
  expect(governing('Euphoric Cloud')).toEqual(['Fog Cloud']);
  expect(governing('Phantasmal Web')).toEqual(['Web']);
  expect(governing('Possession Trap')).toEqual(['Magic Jar']);
  expect(governing('Waters of Lamashtu')).toEqual(['Curse Water']);
  expect(governing('Flame Steed')).toEqual(['Phantom Steed', 'Obscuring Mist']);
  expect(governing('Magic Circle against Good')).toEqual([
    'Magic Circle against Evil',
    'Protection from Good',
    'Protection from Evil',
  ]);
  expect(
    candidate('Magic Circle against Good').inheritedRuleSourceEvidence.map(
      (body) => body.role.split(':')[0],
    ),
  ).toEqual(['governing-body', 'governing-body', 'governing-body closure']);
  expect(governing('Summon Genie')).toEqual([
    'Summon Genie, Lesser',
    'Summon Monster I',
  ]);
  expect(requires('Summon Genie')).toEqual([
    'CRB',
    'PZO1110',
    'PZO1112',
    'PZO1131',
    'PZO9441',
  ]);
  // The governing warding weapon is cited to page 48; the pinned record says 248.
  expect(governing('Wreath of Blades')).toEqual(['Warding Weapon']);
  expect(requires('Wreath of Blades')).toEqual([
    'CRB',
    'PZO1110',
    'PZO1118',
    'PZO1131',
  ]);
  // Polymorph forms: darkvision to Bestiary 4 and earth glide to Bestiary 2 as
  // their earliest books, as for Elemental Body IV in #542.
  expect(governing('Giant Form II')).toEqual(['Giant Form I']);
  expect(requires('Giant Form II')).toEqual([
    'CRB',
    'PZO1110',
    'PZO1112',
    'PZO1127',
    'PZO1131',
  ]);
  expect(cited('Giant Form II')).toEqual([
    'Darkvision PZO1127',
    'Low-Light Vision PZO1112',
    'Regeneration PZO1112',
    'Rend PZO1112',
    'Rock Catching PZO1112',
    'Rock Throwing PZO1112',
  ]);
  expect(governing('Elemental Body II')).toEqual(['Elemental Body I']);
  expect(requires('Elemental Body II')).toEqual([
    'CRB',
    'PZO1110',
    'PZO1112',
    'PZO1116',
    'PZO1127',
    'PZO1131',
  ]);
  expect(cited('Plant Shape I')).toEqual([
    'Constrict PZO1112',
    'Darkvision PZO1127',
    'Grab PZO1112',
    'Low-Light Vision PZO1112',
    'Poison PZO1112',
  ]);
  // A young animated object with the swarm subtype.
  expect(requires('Raging Rubble')).toEqual([
    'CRB',
    'PZO1110',
    'PZO1112',
    'PZO1121',
    'PZO1131',
  ]);
  expect(cited('Raging Rubble')).toEqual([
    'Distraction PZO1112',
    'Swarm Attack PZO1112',
    'Young (quick) PZO1112',
    'Young (rebuild) PZO1112',
  ]);
  // Monster rules the spells grant or apply.
  expect(cited('Ja Noi Aspect')).toEqual(['Fast Healing PZO1112']);
  expect(cited('Night Blindness')).toEqual(['See in Darkness PZO1116']);
  expect(cited('Stench of Prey')).toEqual([
    'Scent PZO1112',
    'Unnatural Aura PZO1116',
  ]);
  expect(requires('Frosty Aura')).toContain('PZO1112');
  // Class rules: hexes and the shaman's spirit animal.
  expect(cited('Hex Glyph')).toEqual(['Shaman PZO1129', 'Witch PZO1115']);
  expect(governing('Hex Glyph')).toEqual(['Glyph of Warding']);
  expect(cited('Merge with Familiar')).toEqual(['Shaman PZO1129']);
  expect(requires('Prehensile Pilfer')).toContain('PZO1115');
  // Explicit and batch-internal citations of other books.
  expect(requires('Speak with Haunt')).toContain('PZO1114');
  expect(requires('Calm Spirit')).toEqual([
    'CRB',
    'PZO1110',
    'PZO1114',
    'PZO1131',
    'PZO1132',
    'PZO9269',
  ]);
  expect(requires('Renovation')).toContain('PZO1125');
  expect(requires('Summon Laborers')).toEqual([
    'CRB',
    'PZO1110',
    'PZO1116',
    'PZO1125',
    'PZO1131',
    'PZO9458',
  ]);
  expect(cited('Summon Laborers')).toEqual(['Petitioner PZO1116']);
  expect(cited('Antitech Field')).toEqual(['Android PZO1133']);
  expect(
    heldNotices.find(
      (hold) => hold.id === 'spells-545-notice-PZO1114-complete-chain',
    ),
  ).toEqual({
    id: 'spells-545-notice-PZO1114-complete-chain',
    notices: ['PZO1114'],
    evidence: ['scripts/catalog/legal/spells-545.json'],
  });
  // Importer gaps (#719/#720): lost descriptors; no journal links.
  expect(
    review.metadataImportGaps.find(
      (row) => row.externalKey === candidate('Massacre').externalKey,
    ),
  ).toMatchObject({
    published: ['death'],
    imported: [],
  });
  expect(review.metadataImportGaps).toHaveLength(36);
  expect(review.referenceImportGaps).toEqual([]);
});

it('records Spells without changing holder statistics and surfaces only their readable Notes', () => {
  for (const [name, tag] of [
    ['Aspect of the Falcon', 'ranger'],
    ['Heart of the Mammoth', 'wizard'],
    ['Geniekind', 'wizard'],
    ['Heroism, Greater', 'wizard'],
    ['Blend', 'wizard'],
    ['Tears to Wine', 'wizard'],
    ['Shining Cord', 'magus'],
    ['Vex Giant', 'ranger'],
    ['Giant Form II', 'wizard'],
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
      expect(projection.breakdowns['skill.per'].total, name).toBe(0);
      expect(projection.breakdowns['skill.ste'].total, name).toBe(0);
      expect(projection.breakdowns['skill.dip'].total, name).toBe(0);
      expect(projection.spellEffects, name).toEqual([]);
    }
  }
  const blend = calculateCharacterSheetProjections(
    recordedSpellSheet('Blend', 'wizard'),
  ).current;
  expect(blend.entryNotes).toHaveLength(1);
  expect(blend.entryNotes[0]).not.toHaveProperty('situation');
  expect(spellFixture('Blend').situationalNotes).toEqual([
    {
      text: 'You draw upon your elven link to the wilderness to change the coloration of yourself and your equipment to match that of your surroundings. This grants you a +4 circumstance bonus on Stealth checks and allows you to make Stealth checks without cover or concealment, but only while you move no more than half your base speed or less. If you move more than half your base speed on your turn, you gain no benefit from this spell until the start of your next turn. If you make an attack, this spell ends (as invisibility).',
    },
  ]);
  // Link labels read as text.
  expect(spellFixture('Daze Monster').situationalNotes?.[0]?.text).toBe(
    'This spell functions like daze, but it can affect any one living creature of any type. Creatures of 7 or more HD are not affected.',
  );
  // The pinned bodies keep their typos verbatim.
  expect(
    spellFixture('Resilient Reservoir').situationalNotes?.[0]?.text,
  ).toContain('the spell automatically release the remaining magic');
  expect(spellFixture('Grave Words').situationalNotes?.[0]?.text).toContain(
    'grave words b y a ny caster',
  );
  // Protected roots keep their earlier-batch fingerprints: no Notes at all.
  expect(spellFixture('Giant Form II').situationalNotes).toBeUndefined();
  expect(
    calculateCharacterSheetProjections(
      recordedSpellSheet('Giant Form II', 'wizard'),
    ).current.entryNotes,
  ).toEqual([]);
});

it('reextracts every root from a clean shared fixture tree and holds all 100 once their bodies are present', async () => {
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
    const barrier = candidate('Blade Barrier');
    expect(barrier.requiredNotices).toEqual(['CRB', 'PZO1110', 'PZO1131']);
    const confirmed = assessWithUnclearedHolds({
      artifact: linked,
      ...reviewedAdmission,
      assessments: reviewedAdmission.assessments.map((row) =>
        row.externalKey === barrier.externalKey
          ? {
              ...row,
              status: 'confirmed' as const,
              ...buildAssessmentBinding({
                artifact: linked,
                entry: spellFixture('Blade Barrier'),
                requiredNotices: barrier.requiredNotices,
                evidenceIds: [barrier.evidenceId],
                ...reviewedAdmission,
              }),
            }
          : row,
      ),
    });
    // PZO1131 is reviewed (2026-10-30): its uncleared chain holds hold it.
    expect(
      confirmed.held.find((row) => row.externalKey === barrier.externalKey)
        ?.reason,
    ).toMatch(/^Notice holds: PZO1131 \(/);
    expect(
      confirmed.admitted.some((row) => row.externalKey === barrier.externalKey),
    ).toBe(false);
  } finally {
    await tree.dispose();
  }
});
