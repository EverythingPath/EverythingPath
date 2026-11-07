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
} from '../fixtures/spells-542/data';
import { recordedSpellSheet, spellFixture } from '../fixtures/spells-542/sheet';
import { materializePinnedTree, readPinned } from './pinned-sources';
import { bindSnapshotToCurrentNotices } from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';

const REVIEWER = 'Opus (AI curator) for the owner';
const REVIEWED_ON = '2026-10-13';
const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
const keys = review.candidates.map((row) => row.externalKey);
const noticeHold = (code: string) => `spells-542-notice-${code}-complete-chain`;
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
    // No record-level 3.5 tag.
    expect(raw.system.tags ?? [], row.name).not.toContain('3.5');
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
      `spells-542-whole-content-${row.externalKey.split('/')[1]}`,
    ]);

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
  expect(held).toHaveLength(50);
  for (const requirement of held)
    expect(holds.get(requirement.holdId ?? '')).toEqual([requirement.book]);
  // No held code has a Registry identity; the Registry is unchanged.
  expect(held.filter((row) => row.registryKeys.length)).toEqual([]);
  // Origins without a pinned source stay inside the whole-content hold.
  const unverified = review.candidates.filter(
    (row) => row.unverifiedOrigins.length,
  );
  expect(unverified.map((row) => row.name).sort()).toEqual([
    'Cold Iron Fetters',
    'Elemental Body IV',
    'Quieting Weapons',
    'Rite of Bodily Purity',
    'Vermin Shape I',
  ]);
  for (const row of unverified) {
    expect(row.unverifiedOrigins, row.name).toHaveLength(1);
    expect(row.holdReason, row.name).toContain(
      `Unverified origins: ${row.unverifiedOrigins[0]}.`,
    );
  }
  expect(candidate('Rite of Bodily Purity').unverifiedOrigins[0]).toMatch(
    /^meditative descriptor/,
  );
  // Roots fingerprinted by earlier batches' fixtures keep empty records.
  expect(
    review.candidates
      .filter((row) => row.mechanicsReview.protectedHistoricalContext)
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    "Bear's Endurance",
    'Bilocation',
    'Bladed Dash',
    'Compel Tongue',
    'Delusional Pride',
    'Detect Magic',
    'Elemental Body IV',
    'Enthrall',
    'Fleeting Memory',
    'Gate',
    'Gentle Breeze',
    'Gentle Repose',
    'Locate Creature',
    'Ooze Form I',
    'Poison',
    'Ray of Exhaustion',
    'Sunbeam',
    'Vermin Shape I',
    'Whispering Wind',
  ]);
  // Granted domain, subdomain and bloodline levels name the hold.
  expect(candidate('Elemental Body IV').holdReason).toContain(
    'granted levels (bloodline: Elemental; domain: Air, Earth, Fire, Water)',
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
      expect(comparison.pageMatchesCitation, row.name).toBe(true);
    }
    if (row.comparison) rootComparisons += 1;
  }
  expect(rootComparisons).toBe(93);
  expect(
    review.candidates
      .filter((row) => !row.comparison)
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Aggravate Affliction',
    'Anywhere but Here',
    'Covetous Urge',
    'Keyhole',
    'Locate Portal',
    'Mind Maze',
    'Word of Beckoning',
  ]);
  // Further cited publications keep their own PCGen rows.
  const books = (name: string) =>
    [
      candidate(name).comparison,
      ...candidate(name).additionalComparisonLeads,
    ].map((row) => row?.book);
  expect(books('Callback')).toEqual(['PZO1140', 'PZO9454']);
  expect(books('Vermin Shape I')).toEqual(['PZO1117', 'PZO9225', 'PZO9226']);
  expect(books('Teleport Trap')).toEqual(['PZO9226', 'PZO9211']);
  expect(books('Buoyancy')).toEqual(['PZO1129', 'PZO9422']);
  // Lords of Chaos is anchored by its dataset title.
  expect(
    candidate('Vermin Shape I').additionalComparisonLeads[0]?.publicationAnchor
      .text,
  ).toBe('SOURCELONG:Lords of Chaos, Book of the Damned, Volume 2');
  // PCGen's variant name for an "X, Mass" row.
  expect(candidate("Sun's Disdain, Mass").comparison?.literalRow).toMatch(
    /^Sun's Disdain \(Mass\)\t/,
  );
  // PCGen writes Isolate's page without the "p." prefix; it still matches.
  expect(candidate('Isolate').comparison).toMatchObject({
    sourcePage: '21',
    pageMatchesCitation: true,
  });
  // No PCGen page disagrees with a pinned citation in this batch.
  expect(
    review.candidates.filter((row) =>
      row.mechanicsReview.sourceDiscrepancies.some((text) =>
        text.startsWith('PCGen '),
      ),
    ),
  ).toEqual([]);
  expect(
    review.candidates
      .filter((row) => row.mechanicsReview.sourceDiscrepancies.length)
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Aggravate Affliction',
    'Burrow',
    'Expend',
    'Inveigle Monster',
    'Irradiate',
    'Oath of Justice',
    'Ooze Form I',
    'Planar Refuge',
  ]);
  // Burrow's Mythic Adventures citation is only PCGen's mythic augmentation row.
  expect(candidate('Burrow').mechanicsReview.sourceDiscrepancies[0]).toContain(
    'ma_spells.lst:44, "Burrow.MOD"',
  );
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
    'Centipede Swarm': 'PZO1112 p.43',
  });
});

it('records the inherited-rule notices of governing bodies, cited creatures, monster rules and class rules', () => {
  const requires = (name: string) => candidate(name).requiredNotices;
  const governing = (name: string) =>
    candidate(name).inheritedRuleSourceEvidence.map((body) => body.name);
  const cited = (name: string) =>
    candidate(name).inheritedRuleCitations.map((row) => row.name);
  // Explicit Bestiary, Ultimate Intrigue, APG, ARG and GameMastery Guide citations.
  expect(requires('Whip of Centipedes')).toEqual([
    'CRB',
    'PZO1110',
    'PZO1112',
    'PZO1129',
    'PZO1131',
  ]);
  expect(governing('Whip of Centipedes')).toEqual([
    'Whip of Spiders',
    'Summon Swarm',
  ]);
  expect(requires('Strong Jaw')).toContain('PZO1112');
  expect(requires('Stone Throwing')).toContain('PZO1112');
  expect(requires('Commune with Texts')).toContain('PZO1134');
  expect(requires('Covetous Urge')).toContain('PZO1115');
  expect(requires('Sweat Poison')).toContain('PZO1121');
  expect(requires('Planar Refuge')).toContain('PZO1114');
  // Governing bodies carry their own notices and inherited rules.
  expect(requires("Sun's Disdain, Mass")).toContain('PZO1121');
  expect(governing("Sun's Disdain, Mass")).toEqual(["Sun's Disdain"]);
  expect(cited("Sun's Disdain, Mass")).toEqual(['Light Blindness']);
  expect(requires('Roaming Pit')).toContain('PZO1115');
  expect(governing('Roaming Pit')).toEqual(['Create Pit']);
  expect(requires('Compel Tongue')).toContain('PZO1115');
  expect(governing('Compel Tongue')).toEqual(['Share Language']);
  expect(governing('Versatile Weapon')).toEqual([
    'Magic Weapon, Greater',
    'Magic Weapon',
  ]);
  // A named-rule body and the body it links to.
  expect(requires('Watchful Animal')).toContain('PZO1134');
  expect(
    candidate('Watchful Animal').inheritedRuleSourceEvidence.map((body) => [
      body.name,
      body.role.split(':')[0],
    ]),
  ).toEqual([
    ['Insect Spies, Greater', 'named-rule'],
    ['Insect Spies', 'governing-body closure'],
  ]);
  // Class, template and weapon records named by the text.
  expect(cited('Jolting Portent')).toEqual(['Oracle']);
  expect(requires('Jolting Portent')).toContain('PZO1115');
  expect(cited('Wake of Light')).toEqual(['Celestial', 'Fiendish']);
  expect(requires('Wake of Light')).toContain('PZO1112');
  expect(cited('Quieting Weapons')).toEqual(['Pistol']);
  expect(requires('Quieting Weapons')).toContain('PZO1123');
  for (const name of ['Bilocation', 'Ghost Whip'])
    expect(requires(name), name).toContain('PZO1115');
  // Universal monster rules granted by forms cite their pinned records.
  expect(requires('Vermin Shape I')).toEqual([
    'CRB',
    'PZO1110',
    'PZO1112',
    'PZO1117',
    'PZO1127',
    'PZO1131',
    'PZO9225',
    'PZO9226',
  ]);
  expect(cited('Vermin Shape I')).toEqual([
    'Scent',
    'Low-Light Vision',
    'Darkvision',
  ]);
  expect(cited('Ooze Form I')).toEqual([
    'Blindsense',
    'Constrict (Universal Monster Rules journal)',
  ]);
  expect(cited('Sonic Form')).toEqual([
    'Incorporeal (Universal Monster Rules journal)',
  ]);
  expect(requires('Sonic Form')).toContain('PZO1112');
  // Elemental Body IV inherits elemental body I's abilities: the journal
  // sources earth glide to Bestiary 2 as its earliest listed book.
  expect(requires('Elemental Body IV')).toEqual([
    'CRB',
    'PZO1110',
    'PZO1112',
    'PZO1116',
    'PZO1127',
    'PZO1131',
  ]);
  expect(governing('Elemental Body IV')).toEqual([
    'Elemental Body III',
    'Elemental Body I',
    'Elemental Body II',
  ]);
  expect(
    candidate('Elemental Body IV')
      .inheritedRuleCitations.filter((row) =>
        row.path.startsWith('packs/rules/universal-monster-rules-umr.'),
      )
      .map((row) => `${row.name.split(' (')[0]} ${row.literalQuote}`),
  ).toEqual([
    'Burn @Source[PZO1112;pages=298]',
    'Push @Source[PZO1112;pages=303]',
    'Whirlwind @Source[PZO1112;pages=306]',
    'Earth Glide @Source[PZO1116;pages=296]',
  ]);
  expect(
    candidate('Stone Throwing').inheritedRuleCitations.map(
      (row) => `${row.name.split(' (')[0]} ${row.literalQuote}`,
    ),
  ).toEqual([
    'Rock Catching @Source[PZO1112;pages=303]',
    'Rock Throwing @Source[PZO1112;pages=303]',
  ]);
  expect(
    heldNotices.find(
      (hold) => hold.id === 'spells-542-notice-PZO1116-complete-chain',
    ),
  ).toEqual({
    id: 'spells-542-notice-PZO1116-complete-chain',
    notices: ['PZO1116'],
    evidence: ['scripts/catalog/legal/spells-542.json'],
  });
  // Importer gaps (#719/#720): lost descriptors and a stripped journal link.
  expect(
    review.metadataImportGaps.find(
      (row) => row.externalKey === candidate('Hellmouth Lash').externalKey,
    ),
  ).toMatchObject({ published: ['acid, electricity, or fire'], imported: [] });
  expect(review.metadataImportGaps).toHaveLength(36);
  expect(review.referenceImportGaps).toEqual([
    {
      externalKey: candidate('Irradiate').externalKey,
      field: 'description.link',
    },
  ]);
});

it('records Spells without changing holder statistics and surfaces only their readable Notes', () => {
  for (const [name, tag] of [
    ["Bomber's Eye", 'alchemist'],
    ['Bone Fists', 'cleric'],
    ['Rite of Bodily Purity', 'cleric'],
    ['Stalwart Resolve', 'cleric'],
    ['Wild Instinct', 'druid'],
    ['Bullet Shield', 'wizard'],
    ['Foresight', 'wizard'],
    ["Bear's Endurance", 'wizard'],
    ['Delusional Pride', 'wizard'],
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
  const bomber = calculateCharacterSheetProjections(
    recordedSpellSheet("Bomber's Eye", 'alchemist'),
  ).current;
  expect(bomber.entryNotes).toHaveLength(1);
  expect(bomber.entryNotes[0]).not.toHaveProperty('situation');
  expect(spellFixture("Bomber's Eye").situationalNotes).toEqual([
    {
      text: 'This extract allows you to throw weapons farther and more accurately. While this extract is in effect, increase the range of any thrown weapon by 10 feet. In addition, you receive a +1 insight bonus on attack rolls made with thrown weapons.',
    },
  ]);
  // Table rows read as "cell | cell" lines, without the inline roll.
  expect(spellFixture('Spell Turning').situationalNotes?.[0]?.text).toContain(
    'Roll randomly to determine the result.\nd% | Effect\n01-70 | Spell drains away without effect.\n',
  );
  expect(spellFixture('Irradiate').situationalNotes?.[0]?.text).toContain(
    '\nCaster Level | Radiation Level\n6th or lower | Low\n',
  );
  // Link labels read as text; paragraphs read as separate lines.
  expect(spellFixture('Oath of Justice').situationalNotes?.[0]?.text).toContain(
    'Dwarves of Golarion.\nThis spell seals a solemn vow between two creatures.',
  );
  expect(spellFixture('Inveigle Monster').situationalNotes?.[0]?.text).toBe(
    'This spell functions as inveigle person except as noted above.',
  );
  // Protected roots keep their earlier-batch fingerprints: no Notes at all.
  expect(spellFixture("Bear's Endurance").situationalNotes).toBeUndefined();
  expect(
    calculateCharacterSheetProjections(
      recordedSpellSheet("Bear's Endurance", 'wizard'),
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

    // With every governing body present, only the journal-link gap fails and none is admitted.
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
    expect(gate.held.filter((row) => ours.has(row.externalKey))).toHaveLength(
      100,
    );
    // Confirming one root still holds it on the unreviewed Unchained notice.
    const foresight = candidate('Foresight');
    expect(foresight.requiredNotices).toEqual(['CRB', 'PZO1110', 'PZO1131']);
    const confirmed = assessWithUnclearedHolds({
      artifact: linked,
      ...reviewedAdmission,
      assessments: reviewedAdmission.assessments.map((row) =>
        row.externalKey === foresight.externalKey
          ? {
              ...row,
              status: 'confirmed' as const,
              ...buildAssessmentBinding({
                artifact: linked,
                entry: spellFixture('Foresight'),
                requiredNotices: foresight.requiredNotices,
                evidenceIds: [foresight.evidenceId],
                ...reviewedAdmission,
              }),
            }
          : row,
      ),
    });
    // PZO1131 is reviewed (2026-10-30): its uncleared chain holds hold it.
    expect(
      confirmed.held.find((row) => row.externalKey === foresight.externalKey)
        ?.reason,
    ).toMatch(/^Notice holds: PZO1131 \(/);
    expect(
      confirmed.admitted.some(
        (row) => row.externalKey === foresight.externalKey,
      ),
    ).toBe(false);
  } finally {
    await tree.dispose();
  }
});
