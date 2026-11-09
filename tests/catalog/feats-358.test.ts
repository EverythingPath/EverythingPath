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
} from '../fixtures/feats-358/data';
import { reviewedFeatSheet } from '../fixtures/feats-358/sheet';
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

const skillFocus = [
  ['Skill Focus (Spellcraft)', 'skill.spl'],
  ['Skill Focus (Sense Motive)', 'skill.sen'],
  ['Skill Focus (Perform)', 'skill.prf'],
] as const;

// #724: the rank threshold is automatic, read from the skill's recorded ranks.
it('resolves each admitted Skill Focus from its own skill ranks and for that skill only, without stacking copies', () => {
  for (const [name, target] of skillFocus) {
    const rows = modifiers(name);
    expectAutomaticSkillFocus({ modifiers: rows, target });
    expect(
      resolveSheet(rows, { skillRanks: { [target]: 10, 'skill.clm': 10 } })[
        'skill.clm'
      ].total,
    ).toBe(0);
    expect(candidate(name).disposition).toBe('admitted');
  }
  // No ranks and Charisma 10: Skill Focus's +3 alone.
  expect(
    calculateCharacterSheetProjections(
      reviewedFeatSheet('Skill Focus (Perform)'),
    ).current.breakdowns['skill.prf'].total,
  ).toBe(3);
});

it('applies the Discerning Eye and Zealous Mind required notes once, at the published scope', () => {
  const eye = modifiers('Discerning Eye');
  const illusions = resolveSheet(eye, { situations: ['illusions'] });
  expect([
    illusions['save.fort'].total,
    illusions['save.ref'].total,
    illusions['save.will'].total,
  ]).toEqual([2, 2, 2]);
  expect(
    resolveSheet(eye, { situations: ['enchantment'] })['save.will'].total,
  ).toBe(0);
  expect(
    resolveSheet(eye, {
      situations: [{ ...situation('Discerning Eye', 1), sheetEntryId: 'x' }],
    })['skill.lin'].total,
  ).toBe(0);
  expect(
    resolveSheet(eye, { situations: [situation('Discerning Eye', 1)] })[
      'skill.lin'
    ].total,
  ).toBe(2);
  expect(resolveSheet(eye)['skill.lin'].total).toBe(0);
  const records = candidate('Discerning Eye').mechanicsReview.curationRecords;
  expect(records.map((row) => [row.kind, row.target])).toEqual([
    ['description', 'description'],
    ['note', 'allSavingThrows'],
    ['note', 'skill.lin'],
  ]);
  expect(
    records[0]?.outputs.filter((output) => output.kind === 'modifier'),
  ).toEqual([]);
  const zealous = modifiers('Zealous Mind');
  expect(zealous).toHaveLength(1);
  expect(resolveSheet(zealous)['save.will'].total).toBe(0);
  const breakFree = resolveSheet(zealous, {
    situations: [situation('Zealous Mind')],
  });
  expect([breakFree['save.fort'].total, breakFree['save.will'].total]).toEqual([
    2, 2,
  ]);
  expect(
    candidate('Zealous Mind').mechanicsReview.curationRecords.map(
      (row) => row.kind,
    ),
  ).toEqual(['description', 'note']);
});

it('keeps the Prophet Completion Benefit exclusive and its sacred and profane bonuses on separate Situations', () => {
  const rows = modifiers('Prophet');
  expect(rows.map((row) => [row.target, row.bonusType, row.value])).toEqual([
    ['ac', 'sacred', 1],
    ['ac', 'sacred', 2],
    ['saves', 'sacred', 2],
    ['ac', 'profane', 1],
    ['ac', 'profane', 2],
    ['saves', 'profane', 2],
  ]);
  // The aggregate AC target lands on the other-bonus AC leaf.
  expect(resolveSheet(rows)['ac.other'].total).toBe(0);
  const before = resolveSheet(rows, { situations: [situation('Prophet', 0)] });
  expect(before['ac.other'].total).toBe(1);
  expect(before['save.will'].total).toBe(0);
  const after = resolveSheet(rows, {
    situations: [situation('Prophet', 1), situation('Prophet', 2)],
  });
  expect(after['ac.other'].total).toBe(2);
  expect(after['save.ref'].total).toBe(2);
  // Before and after are exclusive; the sacred +2 replaces the +1.
  expect(
    resolveSheet(rows, {
      situations: [situation('Prophet', 0), situation('Prophet', 1)],
    })['ac.other'].total,
  ).toBe(2);
  expect(
    resolveSheet(rows, {
      situations: [situation('Prophet', 4), situation('Prophet', 5)],
    })['save.fort'].total,
  ).toBe(2);
  expect(
    resolveSheet(rows, { situations: [situation('Prophet', 3, 'other')] })[
      'ac.other'
    ].total,
  ).toBe(0);
});

it('resolves typed holder bonuses without stacking same-type bonuses from other entries', () => {
  const allied = modifiers('Allied Spellcaster');
  expect(
    resolveSheet(allied, { situations: [situation('Allied Spellcaster', 0)] })
      .casterLevel.total,
  ).toBe(2);
  expect(
    resolveSheet(allied, { situations: [situation('Allied Spellcaster', 1)] })
      .casterLevel.total,
  ).toBe(4);
  expect(
    resolveSheet([...allied, other(allied[0]!, 3)], {
      situations: [situation('Allied Spellcaster', 0)],
    }).casterLevel.total,
  ).toBe(3);
  expect(resolveSheet(allied).casterLevel.total).toBe(0);
  const stone = modifiers('Echoes of Stone');
  expect(
    resolveSheet(stone, { situations: [situation('Echoes of Stone', 0)] })[
      'skill.per'
    ].total,
  ).toBe(4);
  expect(
    resolveSheet(stone, {
      situations: [situation('Echoes of Stone', 0, 'another-holder')],
    })['skill.per'].total,
  ).toBe(0);
  expect(
    resolveSheet(stone, { situations: [situation('Echoes of Stone', 1)] })[
      'skill.sur'
    ].total,
  ).toBe(4);
  const swings = modifiers('Shield of Swings');
  const swung = resolveSheet([...swings, other(swings[0]!, 2, 'buckler')], {
    situations: [
      situation('Shield of Swings', 0),
      situation('Shield of Swings', 1),
    ],
  });
  // Shield bonuses do not stack: the +4 replaces a +2 buckler.
  expect(swung['ac.shield'].total).toBe(4);
  expect(swung.cmd.total - resolveSheet(swings).cmd.total).toBe(4);
});

it('adds Persuasive (Mythic) as the increment only and keeps Criminal Reputation rank branches per skill', () => {
  const mythic = modifiers('Persuasive (Mythic)');
  const base = resolveSheet(mythic);
  expect([base['skill.dip'].total, base['skill.int'].total]).toEqual([2, 2]);
  // The base Persuasive bonus comes from its own entry and stacks (untyped).
  expect(
    resolveSheet([...mythic, other(mythic[0]!, 2, 'persuasive')])['skill.dip']
      .total,
  ).toBe(4);
  const criminal = modifiers('Criminal Reputation');
  expect(resolveSheet(criminal)['skill.dip'].total).toBe(0);
  const low = resolveSheet(criminal, {
    situations: [situation('Criminal Reputation', 0)],
  });
  expect([low['skill.dip'].total, low['skill.int'].total]).toEqual([2, 0]);
  const high = resolveSheet(criminal, {
    situations: [
      situation('Criminal Reputation', 1),
      situation('Criminal Reputation', 2),
    ],
  });
  expect([high['skill.dip'].total, high['skill.int'].total]).toEqual([4, 2]);
});

it('keeps recipient, target, dice, resource and mythic-tier bodies off holder totals', () => {
  for (const name of [
    'Knocking Blows',
    'Bolster Undead',
    'Starlight Summons',
    'Command Plants',
    'Tag-Team Interrogation',
    'Venomous Stare',
    'Fighting Frenzy',
    'Kirin Strike',
    'Focused Ooze Expertise',
    'Weapon Specialization (Mythic)',
    'Improved Drag (Mythic)',
    'Siege Commander',
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
  expect(preview.entries.flatMap((row) => row.modifiers)).toHaveLength(52);
  expect(
    preview.entries.filter((row) => row.modifiers.length > 0),
  ).toHaveLength(33);
});

it('records inherited-rule notices, alternate versions and enforced notice holds without inventing attribution', () => {
  for (const name of [
    'Cloven Helm',
    'Knocking Blows',
    'Greater Ray Shield',
    'Shield of Swings',
    'Kirin Strike',
    'Dented Helm',
    'Unfolding Wind Strike',
    'Lookout',
    'Improved Impaling Critical',
    'Siege Commander',
  ]) {
    expect(candidate(name).requiredNotices, name).toContain('PZO1131');
    expect(candidate(name).inheritedRuleComparisonEvidence, name).toHaveLength(
      1,
    );
  }
  for (const name of ['Knocking Blows', 'Greater Ray Shield'])
    expect(candidate(name).inheritedRuleComparisonEvidence[0]?.book).toBe(
      'PZO9467',
    );
  expect(candidate('Unfolding Wind Strike').requiredNotices).toEqual([
    'PZO1138',
    'PZO9463',
    'PZO1131',
    'PZO1110',
  ]);
  for (const name of [
    'Weapon Specialization (Mythic)',
    'Cleave (Mythic)',
    'Arcane Blast (Mythic)',
    'Mounted Archery (Mythic)',
    'Persuasive (Mythic)',
    'Improved Drag (Mythic)',
    'Penetrating Strike (Mythic)',
  ]) {
    expect(candidate(name).comparison?.book, name).toBe('PZO1126');
    expect(candidate(name).requiredNotices, name).toContain('PZO1126');
  }
  for (const name of ['Prophet', 'Crisis of Conscience'])
    expect(candidate(name).requiredNotices, name).toContain('PZO1125');
  for (const [name, root, rejected] of [
    ['Scion of the Land', 'PZO1140', 'PZO9456'],
    ['Waterway Caster', 'PZO1140', 'PZO9448'],
    ['Unfolding Wind Strike', 'PZO1138', 'PZO9268'],
    ['Nimble Natural Summons', 'PZO9267', 'PZO9416'],
    ['Spider Step', 'PZO1115', 'PZO1121'],
  ] as const) {
    expect(candidate(name).comparison?.book, name).toBe(root);
    expect(candidate(name).rejectedRootComparisonEvidence, name).toEqual([
      expect.objectContaining({ book: rejected, appliesToRootBody: false }),
    ]);
    expect(candidate(name).requiredNotices, name).not.toContain(rejected);
  }
  for (const [name, book] of [
    ['Aberrant Tumor', 'PZO1117'],
    ['Righteous Orator', 'PZO1134'],
    ['Ritual Hex', 'PZO1132'],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  for (const name of [
    'Planar Sensitivity',
    'Damned Soldier',
    'Bonded Mind',
    'Stunning Croak',
    'Overseer of the House of Truth',
    'Friendly Face',
    'Improved Balor Whip',
    'Improved Weapon Shift',
    "Shoki's Argument",
    'Willing Death',
    'Aversion Tolerance',
  ]) {
    expect(candidate(name).comparison, name).toBeNull();
    expect(candidate(name).inheritedRuleUnresolvedOrigins[0], name).toContain(
      'no PCGen row at the pin',
    );
  }
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
  for (const [name] of skillFocus)
    expect(candidate(name)).toMatchObject({
      requiredNotices: ['PZO1110'],
      holdIds: [],
      noticeHoldIds: [],
      assessmentStatus: 'confirmed',
    });
});

it('retains recorded parser findings and checks current bounded or advisory clauses', () => {
  const kinds = (name: string) =>
    entry(name).prerequisites?.map((atom) =>
      'kind' in atom ? atom.kind : 'anyOf',
    );
  expect(kinds('Crisis of Conscience')).toEqual(['alignment', 'unchecked']);
  expect(kinds('Distant Spell Link')).toEqual(['anyOf', 'unchecked']);
  expect(kinds('Deny Death')).toEqual(['unchecked', 'feat']);
  for (const [name, gap] of [
    ['Crisis of Conscience', 'unsatisfiable together'],
    ['Distant Spell Link', 'mapped conjunctively'],
    ['Wolf Rider', 'broader than published'],
    ['Deny Death', 'Endurance stays unchecked'],
    ['Improved Precise Strike', 'Precise Strike stays unchecked'],
    ['Friendly Face', 'wrong character'],
    ['Aberrant Tumor', 'sorcerer Aberrant Bloodline'],
  ] as const)
    expect(
      recordedPrerequisiteFacts({
        batch: 'feats-358',
        candidate: candidate(name),
      }),
      name,
    ).toEqual(expect.arrayContaining([expect.stringContaining(gap)]));
  for (const name of [
    'Weapon Specialization (Mythic)',
    'Precocious Youth',
    'Armor Adept',
    'Planar Hunter',
    'Skill Focus (Perform)',
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
    admitted: 3,
    held: 97,
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
    // #724 re-reviewed the Skill Focus records' rank Modifiers on 2026-10-14.
    const isSkillFocus = skillFocus.some(([name]) => name === row.name);
    expect(record).toMatchObject({
      kind: 'description',
      target: 'description',
      text: description,
      textSha256: sha(description),
      status: 'checked',
      reviewedBy: 'Opus (AI curator) for the owner',
      reviewedOn: isSkillFocus ? '2026-10-14' : '2026-10-12',
    });
    for (const reviewed of [record, ...rest])
      expect(
        reviewedCuration.records.find(
          (current) =>
            current.externalKey === row.externalKey &&
            current.kind === reviewed?.kind &&
            current.target === reviewed.target &&
            current.textSha256 === reviewed.textSha256,
        ),
      ).toEqual(reviewed);
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
  // The admitted bodies equal the CRB Skill Focus benefit row exactly.
  for (const [name] of skillFocus) {
    const row = candidate(name);
    expect(row.comparison?.literalRow).toContain(
      'BENEFIT:You get a +3 bonus on all checks involving the chosen skill. If you have 10 or more ranks in that skill, this bonus increases to +6.',
    );
    expect(row.mechanicsReview.descriptionText).toContain(
      '<strong>Benefits</strong>: You get a +3 bonus on all checks involving the chosen skill. If you have 10 or more ranks in that skill, this bonus increases to +6.',
    );
  }
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
      required: 3,
      checked: 3,
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
    expect(gate.admitted.map((row) => row.name).sort()).toEqual([
      'Skill Focus (Perform)',
      'Skill Focus (Sense Motive)',
      'Skill Focus (Spellcraft)',
    ]);
    expect(gate.held).toHaveLength(96);
    expect(gate.dependentOmissions).toEqual([]);
    // The body links a module outside the pinned checkouts (#719/#720).
    expect(gate.failures).toEqual([
      {
        externalKey: entry('Aberrant Tumor').externalKey,
        reason: 'Broken structure or reference: unresolved imported reference.',
      },
    ]);
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
    const perform = entry('Skill Focus (Perform)');
    const edited = assessWithUnclearedHolds({
      artifact: {
        ...authoritative,
        catalog: {
          ...authoritative.catalog,
          entries: authoritative.catalog.entries.map((row) =>
            row.externalKey === perform.externalKey
              ? { ...row, modifiers: row.modifiers.slice(1) }
              : row,
          ),
        },
      },
      ...reviewedAdmission,
    });
    expect(edited.admitted.map((row) => row.name)).not.toContain(
      'Skill Focus (Perform)',
    );
    // Confirming a held body still holds it on its unreviewed and held notices.
    const stone = candidate('Echoes of Stone');
    const allConfirmed = reviewedAdmission.assessments.map((row) =>
      row.externalKey === stone.externalKey
        ? { ...row, status: 'confirmed' as const }
        : row,
    );
    const confirmed = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
      assessments: allConfirmed,
    });
    expect(
      confirmed.held.find((row) => row.externalKey === stone.externalKey)
        ?.reason,
    ).toContain('Notice holds: PZO1121 (');
    const registryKeys = review.noticeRequirements.find(
      (row) => row.book === 'PZO1121',
    )?.registryKeys;
    if (!registryKeys?.length)
      throw new Error('Missing Advanced Race Guide notice identity');
    const requiredNotices = ['PZO1110', ...registryKeys];
    const binding = buildAssessmentBinding({
      artifact: authoritative,
      entry: entry('Echoes of Stone'),
      requiredNotices,
      evidenceIds: [stone.evidenceId],
      ...reviewedAdmission,
    });
    const heldIdentity = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
      assessments: allConfirmed.map((row) =>
        row.externalKey === stone.externalKey
          ? { ...row, ...binding, requiredNotices }
          : row,
      ),
    });
    expect(
      heldIdentity.held.find((row) => row.externalKey === stone.externalKey)
        ?.reason,
    ).toContain('Notice holds');
    expect(heldIdentity.admitted).toHaveLength(3);
  } finally {
    await tree.dispose();
  }
});
