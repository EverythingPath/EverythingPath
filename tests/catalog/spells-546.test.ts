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
import { buildAssessmentBinding } from '../../scripts/catalog/admission';
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
} from '../fixtures/spells-546/data';
import { recordedSpellSheet, spellFixture } from '../fixtures/spells-546/sheet';
import { materializePinnedTree, readPinned } from './pinned-sources';
import { bindSnapshotToCurrentNotices } from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';

const REVIEWER = 'Opus (AI curator) for the owner';
const REVIEWED_ON = '2026-10-13';
const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
const keys = review.candidates.map((row) => row.externalKey);
const noticeHold = (code: string) => `spells-546-notice-${code}-complete-chain`;
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

it('pins all 38 complete roots, checked description records and notice holds', async () => {
  expect(review.candidates).toHaveLength(38);
  expect(new Set(keys).size).toBe(38);
  expect(review.counts).toEqual({
    total: 38,
    admitted: 0,
    held: 38,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 0,
    recordLevel35Holds: 0,
  });
  expect(review.mechanicsSummary).toMatchObject({
    checkedDescriptionRecords: 38,
    recordsWithNotes: 27,
    protectedRoots: 11,
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
    expect(row.holdIds).toEqual([`spells-546-whole-content-${id}`]);
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
  expect(held).toHaveLength(25);
  for (const requirement of held)
    expect(holds.get(requirement.holdId ?? '')).toEqual([requirement.book]);
  // None of the held codes has a Registry identity.
  expect(held.filter((row) => row.registryKeys.length)).toEqual([]);
  // PZO1131 has no reviewed identity: only the notice-hold clearance's PRD
  // record (2026-10-30), counted once its review is recorded.
  expect([undefined, 'prd']).toContain(
    reviewedAdmission.registry.PZO1131?.checkedAgainst,
  );
  // Origins without a pinned source stay inside the whole-content hold.
  const unverified = review.candidates.filter(
    (row) => row.unverifiedOrigins.length,
  );
  expect(unverified.map((row) => row.name)).toEqual([
    'Detect Metal',
    'Magic Boulder',
  ]);
  for (const row of unverified)
    expect(row.holdReason).toContain(
      `Unverified origins: ${row.unverifiedOrigins[0]}.`,
    );
  // Roots fingerprinted by earlier batches' fixtures, and Align Weapon, the
  // governing body inside #543 Align Weapon, Communal's stored binding, keep
  // empty records.
  expect(
    review.candidates
      .filter((row) => row.mechanicsReview.protectedHistoricalContext)
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Align Weapon',
    'Consecrate',
    'Crushing Despair',
    'Dancing Lights',
    'Life Pact',
    'Magic Weapon, Greater',
    "Nature's Exile",
    'Phantom Steed',
    'Suggestion',
    'Synesthesia',
    'Telepathic Bond',
  ]);
  expect(record(candidate('Align Weapon').externalKey).rationale).toContain(
    'Align Weapon, Communal (pf1/w9nstnema8nk0p3h)',
  );
  // Granted domain, subdomain and bloodline levels name the hold.
  expect(candidate('Suggestion').holdReason).toContain(
    'granted levels (bloodline: Infernal, Maestro, Rakshasa; domain: Charm; subDomain: Corruption, Devil, Innuendo)',
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
      const cited = row.citedSources.find(
        (source) => source.id === comparison.book,
      );
      // Every PCGen page agrees with the pinned citation in this batch.
      expect(comparison.pageMatchesCitation, row.name).toBe(true);
      expect(comparison.sourcePage.replace(/^p\./, '')).toBe(
        String(cited?.pages),
      );
    }
    if (row.comparison) rootComparisons += 1;
  }
  expect(rootComparisons).toBe(35);
  expect(
    review.candidates.filter((row) => row.additionalComparisonLeads.length),
  ).toEqual([]);
  expect(
    review.candidates
      .filter((row) => !row.comparison)
      .map((row) => row.name)
      .sort(),
  ).toEqual(['Hold Fey', 'Lightning Lash', "Signifer's Rally"]);
  // The Anniversary Edition dataset is titled as the Adventure Path in PCGen,
  // as for Covetous Aura in #540.
  expect(candidate('Sign of Wrath').comparison).toMatchObject({
    book: 'PZO1002',
    sourcePage: 'p.419',
    publicationAnchor: {
      text: 'SOURCELONG:Rise of the Runelords Adventure Path',
    },
  });
  expect(
    review.candidates
      .filter((row) => row.mechanicsReview.sourceDiscrepancies.length)
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Binding Earth, Mass',
    'Divine Vessel',
    'Sign of Wrath',
    'Wall of Clockwork',
  ]);
  expect(
    candidate('Wall of Clockwork').mechanicsReview.sourceDiscrepancies[0],
  ).toContain('"If an attacker an attack roll of a natural 20"');
  // PCGen race rows name the publication and page of the vomited swarms,
  // matching the body's own Bestiary page citations.
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
    'Spider Swarm': 'PZO1112 p.258 SOURCELONG:Bestiary',
    'Wasp Swarm': 'PZO1112 p.275 SOURCELONG:Bestiary',
    'Ant (Army/Swarm)': 'PZO1112 p.16 SOURCELONG:Bestiary',
  });
  expect(spellFixture('Vomit Swarm').description).toContain(
    'swarm of spiders (<i>Bestiary</i>, page 258)',
  );
});

it('records the inherited-rule notices of governing bodies, cited creatures and monster rules', () => {
  const requires = (name: string) => candidate(name).requiredNotices;
  const governing = (name: string) =>
    candidate(name).inheritedRuleSourceEvidence.map((body) => body.name);
  const cited = (name: string) =>
    candidate(name).inheritedRuleCitations.map(
      (row) => `${row.name.split(' (Universal')[0]} ${row.book}`,
    );
  // Linked and unlinked governing bodies.
  expect(governing('Spiral Descent')).toEqual(['Spiral Ascent']);
  expect(governing('Binding Earth, Mass')).toEqual(['Binding Earth']);
  expect(governing('Astral Projection, Lesser')).toEqual(['Astral Projection']);
  expect(governing('True Prognostication')).toEqual(['Divination']);
  expect(governing('Magic Weapon, Greater')).toEqual(['Magic Weapon']);
  expect(governing('Phantom Steed')).toEqual(['Water Walk', 'Air Walk']);
  expect(governing('Lightning Lash')).toEqual(['Flame Strike']);
  expect(governing("Signifer's Rally")).toEqual(['Teleport']);
  expect(governing('Hold Fey')).toEqual(['Hold Person']);
  expect(governing('Magic Boulder')).toEqual(['Magic Stone']);
  // Greater shadow transmutation mimics greater polymorph, whose linked forms
  // are kept as closure, as for Polymorph, Greater in #540.
  const shadow = candidate('Shadow Transmutation, Greater');
  expect(
    shadow.inheritedRuleSourceEvidence.map(
      (body) => `${body.name}: ${body.role.split(':')[0]}`,
    ),
  ).toEqual([
    'Shadow Transmutation: governing-body',
    'Polymorph, Greater: governing-body',
    'Polymorph: governing-body closure',
    'Beast Shape IV: governing-body closure',
    'Elemental Body III: governing-body closure',
    'Alter Self: governing-body closure',
    'Plant Shape II: governing-body closure',
    'Form of the Dragon I: governing-body closure',
    'Beast Shape III: governing-body closure',
    'Beast Shape II: governing-body closure',
    'Beast Shape I: governing-body closure',
    'Elemental Body II: governing-body closure',
    'Elemental Body I: governing-body closure',
    'Plant Shape I: governing-body closure',
  ]);
  // The other spells shadow transmutation still mimics keep their books.
  expect(requires('Shadow Transmutation, Greater')).toEqual([
    'CRB',
    'PZO1110',
    'PZO1112',
    'PZO1115',
    'PZO1117',
    'PZO1121',
    'PZO1129',
    'PZO1131',
    'PZO9466',
  ]);
  expect(cited('Shadow Transmutation, Greater')).toEqual([
    'Anthropomorphic Animal PZO1117',
    'Fins to Feet PZO1121',
    'Long Arm PZO1129',
    'Low-Light Vision PZO1112',
    'Stone Fist PZO1115',
  ]);
  // Monster rules the spells grant, defeat or use.
  expect(requires('Divine Vessel')).toEqual([
    'CRB',
    'PZO1110',
    'PZO1112',
    'PZO1115',
    'PZO1116',
    'PZO1127',
    'PZO1131',
  ]);
  expect(cited('Divine Vessel')).toEqual([
    'Blindsense PZO1112',
    'Damage Reduction PZO1112',
    'Darkvision PZO1127',
    'Low-Light Vision PZO1112',
    'Resistance PZO1112',
    'See in Darkness PZO1116',
    'Spell Resistance PZO1112',
  ]);
  expect(cited('Hide from Animals')).toEqual([
    'Blindsense PZO1112',
    'Blindsight PZO1112',
    'Scent PZO1112',
    'Tremorsense PZO1112',
  ]);
  expect(requires('Hide from Animals')).toEqual([
    'CRB',
    'PZO1110',
    'PZO1112',
    'PZO1131',
  ]);
  // Earth glide, applied through binding earth, to Bestiary 2 as its earliest
  // book, as in #545.
  expect(cited('Binding Earth, Mass')).toEqual(['Earth Glide PZO1116']);
  expect(requires('Binding Earth, Mass')).toEqual([
    'CRB',
    'PZO1110',
    'PZO1116',
    'PZO1121',
    'PZO1131',
  ]);
  expect(cited('Magic Boulder')).toEqual(['Rock Throwing PZO1112']);
  expect(requires('Vomit Swarm')).toEqual([
    'CRB',
    'PZO1110',
    'PZO1112',
    'PZO1115',
    'PZO1131',
  ]);
  // Two cited publications, both required.
  expect(requires('Sign of Wrath')).toEqual([
    'CRB',
    'PZO1002',
    'PZO1110',
    'PZO1131',
    'PZO9005',
  ]);
  expect(requires('Bleed Glory')).toContain('PZO1126');
  expect(
    heldNotices.find(
      (hold) => hold.id === 'spells-546-notice-PZO9005-complete-chain',
    ),
  ).toEqual({
    id: 'spells-546-notice-PZO9005-complete-chain',
    notices: ['PZO9005'],
    evidence: ['scripts/catalog/legal/spells-546.json'],
  });
  // Importer gaps (#719/#720): lost descriptors; no journal links.
  expect(
    review.metadataImportGaps.find(
      (row) => row.externalKey === candidate('Divine Vessel').externalKey,
    ),
  ).toMatchObject({
    published: ['chaotic, evil, good, or lawful'],
    imported: [],
  });
  expect(review.metadataImportGaps).toHaveLength(21);
  expect(review.referenceImportGaps).toEqual([]);
});

it('records Spells without changing holder statistics and surfaces only their readable Notes', () => {
  for (const [name, tag] of [
    ['Divine Vessel', 'oracle'],
    ['Tactical Acumen', 'wizard'],
    ['Siphon Might', 'wizard'],
    ['Shroud of Innocuity', 'wizard'],
    ['Wall of Clockwork', 'wizard'],
    ['Curse of the Outcast', 'witch'],
    ['Storm Sight', 'wizard'],
    ['Crushing Despair', 'wizard'],
    ['Magic Weapon, Greater', 'wizard'],
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
      expect(projection.breakdowns['save.ref'].total, name).toBe(0);
      expect(projection.breakdowns['save.will'].total, name).toBe(0);
      expect(projection.breakdowns['skill.per'].total, name).toBe(0);
      expect(projection.breakdowns['skill.dip'].total, name).toBe(0);
      expect(projection.spellEffects, name).toEqual([]);
    }
  }
  const acumen = calculateCharacterSheetProjections(
    recordedSpellSheet('Tactical Acumen', 'wizard'),
  ).current;
  expect(acumen.entryNotes).toHaveLength(1);
  expect(acumen.entryNotes[0]).not.toHaveProperty('situation');
  expect(spellFixture('Tactical Acumen').situationalNotes).toEqual([
    {
      text: 'Tactical acumen grants you and your allies a mastery of battlefield tactics. Whenever you would gain a bonus on attack rolls or to AC due to battlefield position, such as flanking, higher ground, or cover, you gain an additional +1 insight bonus. This bonus increases by +1 for every five caster levels above 5th you possess (maximum +4).',
    },
  ]);
  // Link labels read as text.
  expect(spellFixture('Spiral Descent').situationalNotes?.[0]?.text).toBe(
    'This spell functions as spiral ascent, except the destination and direction of travel is downward from your current location.',
  );
  // The pinned bodies keep their typos verbatim.
  expect(
    spellFixture('Wall of Clockwork').situationalNotes?.[0]?.text,
  ).toContain('If an attacker an attack roll of a natural 20');
  // Protected roots keep their earlier-batch fingerprints: no Notes at all.
  expect(spellFixture('Align Weapon').situationalNotes).toBeUndefined();
  expect(
    calculateCharacterSheetProjections(
      recordedSpellSheet('Magic Weapon, Greater', 'wizard'),
    ).current.entryNotes,
  ).toEqual([]);
});

it('reextracts every root from a clean shared fixture tree and holds all 38 once their bodies are present', async () => {
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
      candidates: 38,
      checked: 38,
    });
    expect(artifact.catalog.entries).toHaveLength(38);
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
    const gate = assessWithUnclearedHolds({
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
      38,
    );
    // Confirming one Core Rulebook root still holds it on the unreviewed
    // Unchained notice.
    const sculpt = candidate('Sculpt Sound');
    expect(sculpt.requiredNotices).toEqual(['CRB', 'PZO1110', 'PZO1131']);
    const confirmed = assessWithUnclearedHolds({
      artifact: linked,
      ...reviewedAdmission,
      assessments: reviewedAdmission.assessments.map((row) =>
        row.externalKey === sculpt.externalKey
          ? {
              ...row,
              status: 'confirmed' as const,
              ...buildAssessmentBinding({
                artifact: linked,
                entry: spellFixture('Sculpt Sound'),
                requiredNotices: sculpt.requiredNotices,
                evidenceIds: [sculpt.evidenceId],
                ...reviewedAdmission,
              }),
            }
          : row,
      ),
    });
    // PZO1131's PRD record is reviewed (2026-10-30), so the batch's uncleared
    // PZO1131 chain hold holds it.
    expect(
      confirmed.held.find((row) => row.externalKey === sculpt.externalKey)
        ?.reason,
    ).toMatch(
      /^Notice holds: PZO1131 \(.*\bspells-546-notice-PZO1131-complete-chain\b/,
    );
    expect(
      confirmed.admitted.some((row) => row.externalKey === sculpt.externalKey),
    ).toBe(false);
  } finally {
    await tree.dispose();
  }
});
