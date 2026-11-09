// @vitest-environment node
import { recordedPrerequisiteFacts } from './prerequisite-audit-739';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { importCatalog } from '../../scripts/catalog/import';
import {
  upstreamRecord,
  sourceDescription,
} from '../../scripts/catalog/records';
import { buildAssessmentBinding } from '../../scripts/catalog/admission';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import remaps from '../../scripts/catalog/reviewed-remaps.json';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import { outputSchema } from '../../src/lib/catalog/curation-output-schema';
import {
  modifierTargets,
  resolveSheet,
  calculateCharacterSheetProjections,
} from '../../src/lib/character-sheet';
import {
  review,
  preview,
  pinnedFiles,
  pinnedSha256,
} from '../fixtures/feats-359/data';
import { reviewedFeatSheet } from '../fixtures/feats-359/sheet';
import { materializePinnedTree, readPinned } from './pinned-sources';
import { bindSnapshotToCurrentNotices } from './batch-ownership';
import { expectAutomaticSkillFocus } from './skill-focus-assertions';
import { assessWithUnclearedHolds } from './uncleared-holds';

const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
function entry(name: string) {
  const row = preview.entries.find((row) => row.name === name);
  if (!row) throw new Error(`Missing ${name}`);
  if (row.detail.kind !== 'feat') throw new Error('Expected feat');
  return { ...row, detail: row.detail };
}
function candidate(name: string) {
  const row = review.candidates.find((row) => row.name === name);
  if (!row) throw new Error(`Missing review of ${name}`);
  return row;
}
function modifiers(name: string, sheetEntryId = entry(name).externalKey) {
  const row = entry(name);
  return row.modifiers.map((raw) => ({
    ...outputSchema.options[0]
      .omit({ kind: true })
      .extend({ target: z.enum(modifierTargets) })
      .parse(raw),
    sheetEntryId,
    catalogEntryId: row.externalKey,
    source: row.externalKey,
    entryName: row.name,
    builtIn: false,
  }));
}
function situation(
  name: string,
  index = 0,
  sheetEntryId = entry(name).externalKey,
) {
  const scope = modifiers(name)[index]?.condition?.situation;
  if (typeof scope !== 'object' || !('local' in scope))
    throw new Error('Expected local Situation');
  return { ...scope, sheetEntryId };
}
// An unrelated entry's bonus of the given type, for stacking checks.
function other(
  row: ReturnType<typeof modifiers>[number],
  value: number,
  source = 'other-entry',
) {
  return {
    ...row,
    sheetEntryId: source,
    catalogEntryId: source,
    source,
    entryName: source,
    value,
    condition: undefined,
  };
}

const noRow = [
  'Page',
  "Musketeer's Sidestep",
  'Flensing Strike',
  'Triple-Baron',
  'Perturbing Stare',
  'Heavenly Bane',
  'Cleansing Burst',
  'Signature Strike Taunt',
  'Cerberus Snare',
  'Chain Mastery',
  'Vishkanya Perfume',
  'Vaporous Potion',
  'Improved Roar',
  'Esoteric Conjuration',
  "Dawn's Blessing",
  'Twin Fang Lunge',
  'Pattern Message',
  'Opportunistic Grappler',
  'Improved Death-Stealing',
  'Lector Priest',
  'Fetid Breath',
  'Damned Disciple',
  'Unusual Heritage (Fetchling)',
  'Cloak of Stone',
];

// #724: the rank threshold is automatic, read from Profession's recorded ranks.
it("resolves the admitted Skill Focus (Profession) from the chosen Profession's ranks only, without stacking copies", () => {
  const name = 'Skill Focus (Profession)';
  const rows = modifiers(name);
  expectAutomaticSkillFocus({ modifiers: rows, target: 'skill.pro' });
  expect(
    resolveSheet(rows, { skillRanks: { 'skill.pro': 10, 'skill.prf': 10 } })[
      'skill.prf'
    ].total,
  ).toBe(0);
  expect(candidate(name)).toMatchObject({
    disposition: 'admitted',
    assessmentStatus: 'confirmed',
    requiredNotices: ['PZO1110'],
    holdIds: [],
    noticeHoldIds: [],
  });
  const [record] = candidate(name).mechanicsReview.curationRecords;
  expect(record?.diagnostics).toEqual([]);
  // No ranks and Wisdom 10: Skill Focus's +3 alone.
  expect(
    calculateCharacterSheetProjections(reviewedFeatSheet(name)).current
      .breakdowns['skill.pro'].total,
  ).toBe(3);
});

it('applies Possessed Hand penalties and insight bonuses at their published scope without stacking insight', () => {
  const rows = modifiers('Possessed Hand');
  const base = resolveSheet(rows);
  expect([
    base.concentration.total,
    base['skill.dev'].total,
    base['skill.slt'].total,
    base['attack.melee'].total,
    base['damage.melee'].total,
  ]).toEqual([-2, 1, 1, 0, 0]);
  const hand = resolveSheet(rows, {
    situations: [situation('Possessed Hand', 1)],
  });
  expect([
    hand['attack.melee'].total,
    hand['attack.ranged'].total,
    hand['damage.melee'].total,
  ]).toEqual([1, 1, 1]);
  // Insight bonuses do not stack: another entry's +2 replaces the +1.
  const dev = rows.find((row) => row.target === 'skill.dev');
  if (!dev) throw new Error('Missing Disable Device bonus');
  expect(resolveSheet([...rows, other(dev, 2)])['skill.dev'].total).toBe(2);
  expect(
    calculateCharacterSheetProjections(reviewedFeatSheet('Possessed Hand'))
      .current.breakdowns.concentration.total,
  ).toBe(-2);
});

it("uses the shared mindAffecting Situation for Eagle's Resolve and keeps its morale bonuses on the source Situation", () => {
  const rows = modifiers("Eagle's Resolve");
  expect(rows[0]?.condition?.situation).toBe('mindAffecting');
  expect(resolveSheet(rows)['save.will'].total).toBe(0);
  const mind = resolveSheet(rows, { situations: ['mindAffecting'] });
  expect([
    mind['save.fort'].total,
    mind['save.ref'].total,
    mind['save.will'].total,
    mind['attack.melee'].total,
  ]).toEqual([1, 1, 1, 0]);
  const both = resolveSheet(rows, {
    situations: ['mindAffecting', situation("Eagle's Resolve", 1)],
  });
  expect([
    both['save.will'].total,
    both['attack.melee'].total,
    both['damage.ranged'].total,
  ]).toEqual([3, 2, 2]);
  // Another morale bonus does not stack with the +2.
  const morale = rows[1];
  if (!morale) throw new Error('Missing morale bonus');
  expect(
    resolveSheet([...rows, other(morale, 2)], {
      situations: [situation("Eagle's Resolve", 1)],
    })['attack.melee'].total,
  ).toBe(2);
});

it('resolves holder-scoped combat, save and skill bonuses only in their Situations', () => {
  const hunter = modifiers('Improved Beast Hunter');
  expect(resolveSheet(hunter).cmb.total).toBe(0);
  const animals = resolveSheet(hunter, {
    situations: [situation('Improved Beast Hunter')],
  });
  expect([
    animals.cmb.total,
    animals.cmd.total,
    animals['save.ref'].total,
    animals['save.will'].total,
  ]).toEqual([4, 4, 2, 0]);
  const resilience = modifiers('Fiendish Resilience');
  const evasion = resolveSheet(
    [...resilience, other(resilience[0]!, 2, 'competence-item')],
    { situations: [situation('Fiendish Resilience')] },
  );
  expect(evasion['save.ref'].total).toBe(4);
  const spirit = modifiers('Elven Spirit');
  expect(spirit.map((row) => [row.target, row.bonusType])).toEqual([
    ['casterLevel', 'racial'],
    ['skill.spl', 'racial'],
  ]);
  expect(
    resolveSheet(spirit, { situations: [situation('Elven Spirit', 1)] })[
      'skill.spl'
    ].total,
  ).toBe(2);
  expect(
    resolveSheet(spirit, {
      situations: [situation('Elven Spirit', 0, 'another-holder')],
    }).casterLevel.total,
  ).toBe(0);
  const leap = modifiers('Leapfrog');
  const next = resolveSheet(leap, { situations: [situation('Leapfrog')] });
  expect(
    ['skill.acr', 'skill.clm', 'skill.fly', 'skill.rid', 'skill.swm'].map(
      (target) => next[target as 'skill.acr'].total,
    ),
  ).toEqual([4, 4, 4, 4, 4]);
  const haruspicy = modifiers('Haruspicy');
  const ritual = resolveSheet(haruspicy, {
    situations: [situation('Haruspicy', 0)],
  });
  expect([ritual['skill.kre'].total, ritual.casterLevel.total]).toEqual([2, 0]);
  const spell = resolveSheet(haruspicy, {
    situations: [situation('Haruspicy', 1)],
  });
  expect([spell['skill.kre'].total, spell.casterLevel.total]).toEqual([0, 1]);
  const persona = resolveSheet(modifiers('Convincing Persona'), {
    situations: [situation('Convincing Persona', 0)],
  });
  expect([persona['skill.blf'].total, persona['skill.dis'].total]).toEqual([
    5, 0,
  ]);
});

it('adds Acrobatic (Mythic) as the increment only and keeps Stunning Assault penalties behind its option', () => {
  const mythic = modifiers('Acrobatic (Mythic)');
  const base = resolveSheet(mythic);
  expect([base['skill.acr'].total, base['skill.fly'].total]).toEqual([2, 2]);
  // Acrobatic's own +2 comes from its own entry and stacks (untyped).
  expect(
    resolveSheet([...mythic, other(mythic[0]!, 2, 'acrobatic')])['skill.acr']
      .total,
  ).toBe(4);
  const assault = modifiers('Stunning Assault');
  expect(
    assault.map((row) => [row.target, row.value, row.condition?.option]),
  ).toEqual([
    ['attack.melee', -5, true],
    ['cmb', -5, true],
  ]);
});

it('keeps recipient, target, dice, resource, choice and mythic-tier bodies off holder totals', () => {
  for (const name of [
    'Gray Maiden Initiate',
    'Feral Grace',
    'Seeds of Doubt',
    'Cleansing Burst',
    'Covering Shield',
    'Bravery in Action',
    'Stunning Fist Adept',
    'Two-Weapon Fighting (Mythic)',
    'Eschew Materials (Mythic)',
    'Step of the Flighty Fey',
    'Savage Surge',
    'Adept Champion',
  ]) {
    expect(modifiers(name), name).toEqual([]);
    expect(entry(name).situationalNotes?.[0]?.text, name).toBeTruthy();
    expect(
      candidate(name).mechanicsReview.outstandingCalculations.length +
        candidate(name).mechanicsReview.proseOnlyRules.length,
      name,
    ).toBeGreaterThan(0);
  }
  // #724: each Skill Focus has one automatic Modifier instead of two.
  expect(preview.entries.flatMap((row) => row.modifiers)).toHaveLength(44);
  expect(
    preview.entries.filter((row) => row.modifiers.length > 0),
  ).toHaveLength(25);
});

it('records inherited-rule notices, alternate versions and enforced notice holds without inventing attribution', () => {
  for (const name of [
    'Sundering Strike',
    'Savage Surge',
    'Greater Shield Specialization',
    'Tiger Claws',
    "Faerie's Strike",
    'Fortified Armor Training',
    'Spectacular Exit',
    'Slashing Grace',
    'Cushioning Armor',
    'Covering Shield',
    'Monastic Legacy',
    'Stunning Assault',
  ]) {
    expect(candidate(name).requiredNotices, name).toContain('PZO1131');
    expect(candidate(name).inheritedRuleComparisonEvidence, name).toHaveLength(
      1,
    );
  }
  for (const name of ['Savage Surge', 'Spectacular Exit'])
    expect(candidate(name).requiredNotices).toEqual([
      'PZO9268',
      'PZO9463',
      'PZO1131',
      'PZO1118',
      'PZO1110',
    ]);
  expect(candidate('Covering Shield').requiredNotices).toEqual([
    'PZO9434',
    'PZO9467',
    'PZO1131',
    'PZO1110',
  ]);
  for (const name of [
    'Acrobatic (Mythic)',
    'Eschew Materials (Mythic)',
    'Two-Weapon Fighting (Mythic)',
  ]) {
    expect(candidate(name).comparison?.book, name).toBe('PZO1126');
    expect(candidate(name).requiredNotices, name).toEqual([
      'PZO1126',
      'PZO1110',
    ]);
  }
  for (const [name, root, rejected] of [
    ["Eagle's Resolve", 'PZO1138', 'PZO9279'],
    ['Umbral Scion', 'PZO1121', 'PZO9015'],
  ] as const) {
    expect(candidate(name).comparison?.book, name).toBe(root);
    expect(candidate(name).rejectedRootComparisonEvidence, name).toEqual([
      expect.objectContaining({ book: rejected, appliesToRootBody: false }),
    ]);
    expect(candidate(name).requiredNotices, name).not.toContain(rejected);
  }
  for (const [name, book] of [
    ['Ace Disarm', 'PZO9452'],
    ['Gray Maiden Initiate', 'PZO1117'],
    ['Stunning Fist Adept', 'PZO1118'],
    ['Altitude Affinity', 'PZO1110'],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  expect(candidate('Squire').comparison?.book).toBe('PZO9426');
  expect(candidate('Hinderance Dismissal').comparison?.literalRow).toMatch(
    /^Hindrance Dismissal\t/,
  );
  expect(
    candidate('Fiendish Resilience').additionalComparisonLeads.map(
      (row) => row.line,
    ),
  ).toEqual([16, 17]);
  for (const name of noRow) {
    expect(candidate(name).comparison, name).toBeNull();
    expect(candidate(name).inheritedRuleUnresolvedOrigins[0], name).toContain(
      'no PCGen row at the pin',
    );
  }
  expect(review.candidates.filter((row) => !row.comparison)).toHaveLength(
    noRow.length,
  );
  const held = new Map(heldNotices.map((row) => [row.id, row.notices]));
  for (const requirement of review.noticeRequirements) {
    if (requirement.book === 'PZO1110') {
      expect(requirement.holdId).toBeNull();
      continue;
    }
    expect(held.get(requirement.holdId ?? ''), requirement.book).toEqual([
      requirement.book,
      ...requirement.registryKeys,
    ]);
    for (const key of requirement.candidates)
      expect(
        review.candidates.find((row) => row.externalKey === key)?.noticeHoldIds,
      ).toContain(requirement.holdId);
  }
  for (const row of review.candidates)
    if (row.disposition === 'held')
      expect(row.holdIds, row.name).toEqual([
        `feats-359-whole-content-${row.externalKey.split('/')[1]}`,
      ]);
});

it('retains recorded parser findings and checks current bounded or advisory clauses', () => {
  const kinds = (name: string) =>
    entry(name).prerequisites?.map((atom) =>
      'kind' in atom ? atom.kind : 'anyOf',
    );
  expect(kinds('Convincing Persona')).toEqual(['unchecked']);
  expect(kinds('Endure Pain')).toEqual(['unchecked']);
  expect(kinds('Altitude Affinity')).toEqual(['feat']);
  for (const [name, gap] of [
    ['Convincing Persona', 'mapped conjunctively'],
    ['Endure Pain', 'garbled'],
    ['Ace Disarm', 'page reference'],
    ['Greater Elemental Focus', 'kineticist'],
    ['Improved Beast Hunter', 'class feature named Knowledge'],
    ['Cushioning Armor', 'magus Heavy Armor'],
    ['Altitude Affinity', 'Endurance stays unchecked'],
    ['Stunning Fist Adept', 'Stunning Fist stays unchecked'],
    ['Devil Sense', 'loses detect evil'],
  ] as const)
    expect(
      recordedPrerequisiteFacts({
        batch: 'feats-359',
        candidate: candidate(name),
      }),
      name,
    ).toEqual(expect.arrayContaining([expect.stringContaining(gap)]));
  for (const name of [
    'Skill Focus (Profession)',
    'Skilled Rager',
    'Greater Shield Specialization',
    'Fiendish Resilience',
    'Slow Faller',
    'Extra Vested Power',
  ])
    expect(
      candidate(name).mechanicsReview.prerequisiteReview.repeatability,
      name,
    ).toContain('Special');
});

it('pins all 100 complete bodies, checked bindings and literal PCGen evidence in the shared store', async () => {
  expect(review.candidates).toHaveLength(100);
  expect(new Set(review.candidates.map((row) => row.externalKey)).size).toBe(
    100,
  );
  expect(review.counts).toMatchObject({
    admitted: 1,
    held: 99,
    dependentlyOmitted: 0,
    excluded: 0,
    recordLevel35Holds: 0,
  });
  expect(preview.entries).toHaveLength(100);
  for (const row of review.candidates) {
    const bytes = await readPinned(row.source.repo, row.source.path);
    expect(sha(bytes), row.externalKey).toBe(row.source.sha256);
    const raw = upstreamRecord.parse(parse(bytes));
    expect(raw._id).toBe(row.externalKey.split('/')[1]);
    expect(raw.name).toBe(row.name);
    expect(raw.system).toEqual(row.sourceFields);
    expect(row.sourceFields.tags).not.toContain('3.5');
    const description = sourceDescription(raw);
    expect(sha(description)).toBe(row.descriptionSha256);
    expect(description).toBe(row.mechanicsReview.descriptionText);
    const [record, ...rest] = row.mechanicsReview.curationRecords;
    const isSkillFocus = row.name === 'Skill Focus (Profession)';
    expect(rest).toEqual([]);
    expect(record).toMatchObject({
      kind: 'description',
      target: 'description',
      text: description,
      textSha256: sha(description),
      status: 'checked',
      // #724 re-reviewed the Skill Focus records' rank Modifiers on 2026-10-14.
      reviewedBy: 'Opus (AI curator) for the owner',
      reviewedOn: isSkillFocus ? '2026-10-14' : '2026-10-12',
    });
    expect(
      reviewedCuration.records.find(
        (current) =>
          current.externalKey === row.externalKey &&
          current.kind === record?.kind &&
          current.target === record.target &&
          current.textSha256 === record.textSha256,
      ),
    ).toEqual(record);
    expect(entry(row.name).sources).toEqual([]);
    expect(row.mechanicsReview.prerequisiteReview.normalizedAtoms).toEqual(
      entry(row.name).prerequisites ?? [],
    );
  }
  const files = new Map(
    review.comparisonSources.pcgenFiles.map((file) => [file.path, file.sha256]),
  );
  for (const [path, digest] of files) {
    const bytes = await readFile(`tests/fixtures/pinned/pcgen/${path}`);
    expect(sha(bytes), path).toBe(digest);
  }
  for (const row of review.candidates) {
    for (const comparison of [
      row.comparison,
      ...row.additionalComparisonLeads,
      ...row.rejectedRootComparisonEvidence,
      ...row.inheritedRuleComparisonEvidence,
    ]) {
      if (!comparison) continue;
      expect(files.get(comparison.path)).toBe(comparison.comparisonFileSha256);
      const lines = (
        await readFile(`tests/fixtures/pinned/pcgen/${comparison.path}`, 'utf8')
      ).split(/\r?\n/);
      expect(lines[comparison.line - 1]).toBe(comparison.literalRow);
      expect(sha(comparison.literalRow)).toBe(comparison.comparisonLineSha256);
      const { path, line, text, sha256 } = comparison.publicationAnchor;
      expect(files.get(path)).toBe(sha256);
      const publication = await readFile(
        `tests/fixtures/pinned/pcgen/${path}`,
        'utf8',
      );
      expect(publication.split(/\r?\n/)[line - 1]?.split('\t')[0]).toBe(text);
    }
  }
  // The admitted body equals the CRB Skill Focus benefit row exactly.
  const row = candidate('Skill Focus (Profession)');
  expect(row.comparison?.literalRow).toContain(
    'BENEFIT:You get a +3 bonus on all checks involving the chosen skill. If you have 10 or more ranks in that skill, this bonus increases to +6.',
  );
  expect(row.mechanicsReview.descriptionText).toContain(
    '<strong>Benefits</strong>: You get a +3 bonus on all checks involving the chosen skill. If you have 10 or more ranks in that skill, this bonus increases to +6.',
  );
  expect(row.inheritedRuleComparisonEvidence[0]?.literalRow).toMatch(
    /^Profession \(Architect\)\t.*TYPE:Wisdom\.Profession\.Base/,
  );
});

it('reextracts source-bound mechanics from a clean shared fixture tree and enforces current content and notice holds', async () => {
  const tree = await materializePinnedTree(pinnedFiles, {
    sha256: pinnedSha256,
  });
  try {
    const artifact = await importCatalog({
      ...tree,
      remaps,
      curation: reviewedCuration,
      candidateKeys: review.candidates.map((row) => row.externalKey),
    });
    expect(artifact.curation.passed).toBe(true);
    expect(artifact.curation.missing).toEqual([]);
    expect(artifact.curation.stale).toEqual([]);
    expect(artifact.curation.summary).toMatchObject({
      required: 0,
      checked: 0,
      descriptions: { candidates: 100, checked: 100 },
    });
    for (const row of artifact.catalog.entries) {
      const saved = entry(row.name);
      expect({
        description: row.description,
        modifiers: row.modifiers,
        situationalNotes: row.situationalNotes,
        sources: row.sources,
      }).toEqual({
        description: saved.description,
        modifiers: saved.modifiers,
        situationalNotes: saved.situationalNotes,
        sources: saved.sources,
      });
    }
    // The reduced tree cannot reproduce every whole-corpus prerequisite
    // identity; gate the full-source snapshot after reproducing its mechanics.
    const authoritative = {
      ...artifact,
      catalog: {
        ...artifact.catalog,
        entries: preview.entries.map((row) => {
          if (row.detail.kind !== 'feat') throw new Error('Expected feat');
          return { ...row, detail: row.detail };
        }),
      },
    };
    const gate = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
    });
    expect(gate.admitted.map((row) => row.name)).toEqual([
      'Skill Focus (Profession)',
    ]);
    expect(gate.held).toHaveLength(99);
    expect(gate.dependentOmissions).toEqual([]);
    expect(gate.failures).toEqual([]);
    for (const row of review.candidates) {
      const assessment = reviewedAdmission.assessments.find(
        (a) => a.externalKey === row.externalKey,
      );
      expect(assessment).toMatchObject({
        status: row.assessmentStatus,
        ...bindSnapshotToCurrentNotices(row.currentBinding),
        requiredNotices: row.requiredNotices,
      });
      expect(
        buildAssessmentBinding({
          artifact: authoritative,
          entry: entry(row.name),
          requiredNotices: row.requiredNotices,
          evidenceIds: [row.evidenceId],
          ...reviewedAdmission,
        }),
      ).toEqual(bindSnapshotToCurrentNotices(row.currentBinding));
    }
    // A changed admitted body invalidates its binding and is no longer admitted.
    const profession = entry('Skill Focus (Profession)');
    const edited = assessWithUnclearedHolds({
      artifact: {
        ...authoritative,
        catalog: {
          ...authoritative.catalog,
          entries: authoritative.catalog.entries.map((row) =>
            row.externalKey === profession.externalKey
              ? { ...row, modifiers: row.modifiers.slice(1) }
              : row,
          ),
        },
      },
      ...reviewedAdmission,
    });
    expect(edited.admitted).toEqual([]);
    // Confirming a held body still holds it on its held notices.
    const hand = candidate('Possessed Hand');
    const confirmed = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
      assessments: reviewedAdmission.assessments.map((row) =>
        row.externalKey === hand.externalKey
          ? { ...row, status: 'confirmed' as const }
          : row,
      ),
    });
    expect(
      confirmed.held.find((row) => row.externalKey === hand.externalKey)
        ?.reason,
    ).toMatch(/Notice holds|Missing or unreviewed required notices/);
    expect(confirmed.admitted).toHaveLength(1);
  } finally {
    await tree.dispose();
  }
});
