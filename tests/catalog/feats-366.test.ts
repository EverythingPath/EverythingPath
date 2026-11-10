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
import {
  assessCatalogAdmission,
  buildAssessmentBinding,
} from '../../scripts/catalog/admission';
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
} from '../fixtures/feats-366/data';
import { reviewedFeatSheet } from '../fixtures/feats-366/sheet';
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
// Resolve one local Situation for every Modifier of an entry.
function all(name: string, sheetEntryId = entry(name).externalKey) {
  return modifiers(name).map((_, index) =>
    situation(name, index, sheetEntryId),
  );
}

const skillFocus = [
  ['Skill Focus (Sleight of Hand)', 'skill.slt', 'Sleight of Hand', 98],
  ['Skill Focus (Knowledge [History])', 'skill.khi', 'Knowledge (history)', 47],
] as const;
const admittedNames: string[] = skillFocus.map(([name]) => name);
const noRow = [
  'Tempting Bargain',
  'Cerberus Style',
  'Extra Croaking',
  'Sheltering Stubborness',
  'Magic Trick',
  "Collector's Boon",
  'Elemental Knowledge',
  'Servant in the House of Truth',
  'Covering Fire (VC)',
  'Swift Swimmer',
];
// Supporting bodies in earlier batch fixtures: their checked description
// records stay empty so those fixtures keep their fingerprints.
const protectedRoots = [
  'Mantis Style',
  'Armor Focus',
  'Dimensional Dervish',
  'Cerberus Style',
  'Voice of the Sibyl',
  'Empty Quiver Flexibility',
];

// #724: the rank threshold is automatic, read from the skill's recorded ranks.
it('resolves both admitted Skill Focus from their own skill ranks, without stacking copies', () => {
  for (const [name, target, label, line] of skillFocus) {
    const rows = modifiers(name);
    expectAutomaticSkillFocus({ modifiers: rows, target });
    expect(candidate(name)).toMatchObject({
      disposition: 'admitted',
      assessmentStatus: 'confirmed',
      requiredNotices: ['PZO1110'],
      holdIds: [],
      noticeHoldIds: [],
      noticeRequirementsComplete: true,
    });
    expect(candidate(name).comparison).toMatchObject({
      book: 'PZO1110',
      line: 156,
      completeDirectComparison: true,
      evidenceRole: 'complete-root-comparison',
    });
    expect(candidate(name).comparison?.literalRow).toContain(
      'BENEFIT:You get a +3 bonus on all checks involving the chosen skill. If you have 10 or more ranks in that skill, this bonus increases to +6.',
    );
    expect(candidate(name).comparison?.literalRow).toMatch(
      /STACK:NO\tMULT:YES\tCHOOSE:SKILL\|TYPE=Base/,
    );
    const [anchor] = candidate(name).inheritedRuleComparisonEvidence;
    expect(anchor).toMatchObject({ line, book: 'PZO1110' });
    expect(anchor?.literalRow.split('\t')[0]).toBe(
      label.replace('(history)', '(History)'),
    );
    expect(anchor?.literalRow).toMatch(/\tTYPE:[\w.]+\.Base\t/);
    const [record] = candidate(name).mechanicsReview.curationRecords;
    expect(record?.diagnostics).toEqual([]);
    expect(entry(name).unsupported).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'changes' })]),
    );
    // No ranks and the skill's ability at 10: Skill Focus's +3 alone.
    expect(
      calculateCharacterSheetProjections(reviewedFeatSheet(name)).current
        .breakdowns[target].total,
    ).toBe(3);
  }
});

it('applies the held manual Situations only when chosen and keeps typed bonuses to their stacking rules', () => {
  // Storm Survivor: exclusive rank branches per skill, and the save bonus.
  const storm = modifiers('Storm Survivor');
  expect(storm.map((row) => [row.target, row.bonusType, row.value])).toEqual([
    ['skill.per', 'circumstance', 2],
    ['skill.per', 'circumstance', 4],
    ['skill.sur', 'circumstance', 2],
    ['skill.sur', 'circumstance', 4],
    ['saves', 'circumstance', 2],
  ]);
  expect(situation('Storm Survivor', 1).local).toBe(
    'in a storm, with at least 10 Perception ranks',
  );
  const calm = resolveSheet(storm);
  expect([
    calm['skill.per'].total,
    calm['skill.sur'].total,
    calm['save.fort'].total,
  ]).toEqual([0, 0, 0]);
  const veteran = resolveSheet(storm, {
    situations: [1, 2, 4].map((index) => situation('Storm Survivor', index)),
  });
  expect([
    veteran['skill.per'].total,
    veteran['skill.sur'].total,
    veteran['save.fort'].total,
    veteran['save.ref'].total,
    veteran['save.will'].total,
  ]).toEqual([4, 2, 2, 2, 2]);
  // Circumstance bonuses from different sources stack.
  expect(
    resolveSheet([...storm, other(storm[0]!, 3)], {
      situations: [situation('Storm Survivor')],
    })['skill.per'].total,
  ).toBe(5);
  // Sacred bonuses do not stack with another sacred bonus.
  const grace = modifiers('Reward of Grace');
  const graced = resolveSheet(grace, { situations: all('Reward of Grace') });
  expect([graced['attack.melee'].total, graced['attack.ranged'].total]).toEqual(
    [1, 1],
  );
  expect(
    resolveSheet([...grace, other(grace[0]!, 2)], {
      situations: all('Reward of Grace'),
    })['attack.melee'].total,
  ).toBe(2);
  for (const [name, target, value] of [
    ['Reward of Grace', 'attack.melee', 1],
    ['Staggering Blow', 'attack.melee', -2],
    ['Staggering Blow', 'attack.ranged', -2],
    ['Boar Ferocity', 'skill.int', 2],
    ['Smell Fear', 'skill.per', 4],
  ] as const) {
    const rows = modifiers(name);
    expect(resolveSheet(rows)[target].total, name).toBe(0);
    expect(
      resolveSheet(rows, { situations: all(name) })[target].total,
      name,
    ).toBe(value);
  }
  // No reviewed body changes an unconditional holder total.
  for (const name of [
    'Storm Survivor',
    'Reward of Grace',
    'Staggering Blow',
    'Boar Ferocity',
    'Smell Fear',
  ] as const)
    expect(
      Object.entries(
        calculateCharacterSheetProjections(reviewedFeatSheet(name)).current
          .breakdowns,
      )
        .filter(([, row]) => row.total !== 0 && row.total !== 10)
        .map(([target, row]) => [target, row.total]),
      name,
    ).toEqual([]);
  const sheet = reviewedFeatSheet('Smell Fear');
  expect(
    calculateCharacterSheetProjections(sheet, {
      situations: all('Smell Fear', 'feat-row'),
    }).current.breakdowns['skill.per'].total,
  ).toBe(4);
  // #724: each Skill Focus has one automatic Modifier instead of two.
  expect(preview.entries.flatMap((row) => row.modifiers)).toHaveLength(11);
  expect(
    preview.entries.filter((row) => row.modifiers.length > 0),
  ).toHaveLength(7);
});

it('keeps protected supporting bodies empty and the remaining bodies readable with outstanding calculations', () => {
  for (const name of protectedRoots) {
    const [record] = candidate(name).mechanicsReview.curationRecords;
    expect(record, name).toMatchObject({ outputs: [], diagnostics: [] });
    expect(record?.rationale, name).toContain('supporting body');
    expect(entry(name).modifiers, name).toEqual([]);
    expect(entry(name).situationalNotes, name).toBeUndefined();
    expect(candidate(name).disposition, name).toBe('held');
  }
  for (const row of review.candidates) {
    expect(
      row.mechanicsReview.outstandingCalculations.length,
      row.name,
    ).toBeGreaterThan(0);
    if (!protectedRoots.includes(row.name))
      expect(entry(row.name).situationalNotes?.[0]?.text, row.name).toBe(
        row.mechanicsReview.curationRecords[0]?.outputs.at(-1)?.kind === 'note'
          ? (
              row.mechanicsReview.curationRecords[0].outputs.at(-1) as {
                text: string;
              }
            ).text
          : undefined,
      );
  }
  for (const name of [
    'Center of Power',
    'Elf-Magic Defense',
    'Tempting Bargain',
    'Studied Spell',
    'Supernatural Spy',
    'Shield Slam (Mythic)',
    'Magic Trick',
    'Elemental Knowledge',
    'Swift Swimmer',
    'Deadly Dealer',
  ])
    expect(modifiers(name), name).toEqual([]);
  expect(
    preview.entries.flatMap((row) =>
      row.modifiers.filter((modifier) => modifier.target === 'hp'),
    ),
  ).toEqual([]);
});

it('records inherited-rule notices, alternate versions and enforced notice holds without inventing attribution', () => {
  const tricks = [
    ['Mantis Style', 'PZO1131'],
    ['Cavalry Formation', 'PZO1131'],
    ['Improved Feint Partner', 'PZO1131'],
    ['Efreeti Stance', 'PZO1131'],
    ['Armor Focus', 'PZO9467'],
    ['Jabbing Master', 'PZO1131'],
    ['Boar Ferocity', 'PZO1131'],
    ['Mounted Shield', 'PZO1131'],
    ['Lucky Strike', 'PZO1131'],
  ] as const;
  for (const [name, book] of tricks) {
    expect(candidate(name).requiredNotices, name).toContain('PZO1131');
    expect(candidate(name).requiredNotices, name).toContain(book);
    expect(entry(name).description, name).toContain('Combat Trick');
    const trick = candidate(name).inheritedRuleComparisonEvidence.find((row) =>
      row.literalRow.includes('KEY:Combat Trick ~ '),
    );
    expect(trick, name).toMatchObject({
      evidenceRole: 'inherited-rule-comparison',
      appliesToRootBody: false,
      book,
    });
    expect(trick?.literalRow, name).toContain(`KEY:Combat Trick ~ ${name}\t`);
  }
  // Every stamina body is a Combat Trick.
  expect(
    review.candidates
      .filter((row) =>
        JSON.stringify(row.sourceFields.description).includes('stamina'),
      )
      .map((row) => row.name)
      .sort(),
  ).toEqual(tricks.map(([name]) => name).sort());
  for (const [name, base] of [
    ['Shield Slam (Mythic)', null],
    ['Improved Stonecunning (Mythic)', 'PZO1115'],
    ['Charge Through (Mythic)', 'PZO1115'],
    ['Deflect Arrows (Mythic)', null],
  ] as const) {
    expect(candidate(name).requiredNotices, name).toContain('PZO1126');
    expect(candidate(name).comparison?.literalRow, name).toContain(
      'KEY:Mythic Feat Output ~ ',
    );
    const rows = candidate(name).inheritedRuleComparisonEvidence;
    expect(
      rows.map((row) => row.book),
      name,
    ).toEqual(base ? [base] : []);
    if (base) {
      expect(candidate(name).requiredNotices, name).toContain(base);
      expect(rows[0]?.literalRow.split('\t')[0], name).toBe(
        name.replace(' (Mythic)', ''),
      );
    }
  }
  // Story feat rules and their backgrounds come from Ultimate Campaign.
  expect(candidate('Supernatural Spy').requiredNotices).toEqual([
    'PZO9469',
    'PZO1125',
    'PZO1115',
    'PZO1117',
    'PZO1129',
    'PZO1110',
  ]);
  for (const [name, book] of [
    ['Center of Power', 'PZO1125'],
    ['Extended Combat Meditation', 'PZO9436'],
    ['Tempting Bargain', 'PZO1131'],
    ['Cavalry Formation', 'PZO1115'],
    ['Improved Feint Partner', 'PZO1115'],
    ['Efreeti Stance', 'PZO1115'],
    ['Efreeti Stance', 'PZO1118'],
    ['Studied Spell', 'PZO1112'],
    ['Staggering Blow', 'PZO1112'],
    ['Enrage Opponent', 'PZO1129'],
    ['Improved Duck and Cover', 'PZO1115'],
    ['Boar Ferocity', 'PZO1118'],
    ['Cerberus Style', 'PZO1118'],
    ['Infused Spell Cartridges', 'PZO1118'],
    ['Extra Croaking', 'PZO1121'],
    ['Extra Croaking', 'PZO1112'],
    ['Sinister Reputation', 'PZO1134'],
    ['Sinister Reputation', 'PZO1114'],
    ['Wild Speaker', 'PZO9480'],
    ['Magic Trick', 'PZO1115'],
    ['Magic Trick', 'PZO1112'],
    ['Smell Fear', 'PZO1112'],
    ['Elemental Knowledge', 'PZO1132'],
    ['Baneful Judgment', 'PZO1115'],
    ['Improved Learn Ranger Trap', 'PZO1117'],
    ['Lucky Strike', 'PZO1121'],
    ['Covering Fire (VC)', 'PZO1115'],
    ['Covering Fire (VC)', 'PZO1118'],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  // Pinned pf1-content racial trait records name the books of the traits
  // these bodies extend.
  for (const [name, path, book] of [
    [
      'Extra Croaking',
      'src/pf-racial-traits/Terrifying_Croak_DmLTYUPxopWDWieS.yaml',
      'PZO1121',
    ],
    [
      'Wild Speaker',
      'src/pf-racial-traits/Bleachling_ojx2bxS8iepYliML.yaml',
      'PZO9480',
    ],
    [
      'Lucky Strike',
      'src/pf-racial-traits/Adaptable_Luck_a95VioTuysgFg9EZ.yaml',
      'PZO1121',
    ],
  ] as const)
    expect(
      candidate(name).inheritedRuleNotices.find((row) =>
        row.location.endsWith(path),
      )?.book,
      name,
    ).toBe(book);
  // Meditation feats are traced through the Faiths & Philosophies row.
  const [meditation] = candidate(
    'Extended Combat Meditation',
  ).inheritedRuleComparisonEvidence;
  expect(meditation).toMatchObject({
    book: 'PZO9436',
    appliesToRootBody: false,
  });
  expect(meditation?.literalRow.split('\t')[0]).toBe('Combat Meditation');
  // The earlier Varisia printing supports Deadly Dealer but is not required.
  expect(candidate('Deadly Dealer').comparison?.book).toBe('PZO9446');
  expect(
    candidate('Deadly Dealer').additionalComparisonLeads.map((row) => row.book),
  ).toEqual(['PZO9425']);
  expect(candidate('Deadly Dealer').requiredNotices).not.toContain('PZO9425');
  // The same-name Ranged Tactics Toolbox row is a different feat.
  expect(
    candidate('Covering Fire (VC)').mechanicsReview.sourceDiscrepancies.join(
      ' ',
    ),
  ).toContain('different feat');
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
      ...requirement.registryKeys.filter((key) => key !== requirement.book),
    ]);
    for (const key of requirement.candidates)
      expect(
        review.candidates.find((row) => row.externalKey === key)?.noticeHoldIds,
      ).toContain(requirement.holdId);
  }
  for (const row of review.candidates) {
    expect(row.requiredNotices.at(-1), row.name).toBe('PZO1110');
    expect(row.holdIds, row.name).toEqual(
      admittedNames.includes(row.name)
        ? []
        : [`feats-366-whole-content-${row.externalKey.split('/')[1]}`],
    );
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices
        .filter((book) => book !== 'PZO1110')
        .map((book) => `feats-366-notice-${book}-complete-chain`),
    );
  }
});

it('retains recorded parser findings and checks current bounded or advisory clauses', () => {
  const kinds = (name: string) =>
    entry(name).prerequisites?.map((atom) =>
      'kind' in atom ? atom.kind : 'anyOf',
    );
  expect(kinds('Jabbing Master')).toEqual([
    'feat',
    'feat',
    'feat',
    'feat',
    'feat',
    'feat',
    'anyOf',
  ]);
  expect(kinds('Fight On')).toEqual(['ability', 'anyOf']);
  expect(kinds('Supernatural Spy')).toEqual(['unchecked']);
  expect(entry('Magic Trick').prerequisites).toBeUndefined();
  for (const [name, gap] of [
    ['Jabbing Master', 'not as alternatives'],
    ['Fight On', 'not as alternatives'],
    ['Supernatural Spy', 'not as the published alternatives'],
    ['Mantis Style', 'pinned Stunning Fist records exist'],
    ['Cavalry Formation', 'both a feat and a class ability'],
    ['Mounted Shield', 'both a feat and a class ability'],
    ['Deflect Arrows (Mythic)', 'both a feat and a class ability'],
    ['Empty Quiver Flexibility', 'pinned Weapon Focus feat exists'],
    ['Lucky Strike', 'named Adaptable Luck'],
    ['Magic Trick', 'maps to no prerequisite atom'],
  ] as const)
    expect(
      recordedPrerequisiteFacts({
        batch: 'feats-366',
        candidate: candidate(name),
      }),
      name,
    ).toEqual(expect.arrayContaining([expect.stringContaining(gap)]));
  expect(
    review.candidates
      .filter((row) =>
        row.mechanicsReview.prerequisiteReview.repeatability.includes(
          'Special allowing multiple selections',
        ),
      )
      .map((row) => row.name)
      .sort(),
  ).toEqual([...admittedNames, 'Armor Focus', 'Magic Trick'].sort());
});

it('pins all 51 complete bodies, checked bindings and literal PCGen evidence in the shared store', async () => {
  expect(review.candidates).toHaveLength(51);
  expect(new Set(review.candidates.map((row) => row.externalKey)).size).toBe(
    51,
  );
  expect(review.counts).toEqual({
    total: 51,
    admitted: 2,
    held: 49,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 0,
    recordLevel35Holds: 0,
  });
  expect(preview.entries).toHaveLength(51);
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
    const isSkillFocus = admittedNames.includes(row.name);
    expect(rest).toHaveLength(0);
    expect(record).toMatchObject({
      kind: 'description',
      target: 'description',
      text: description,
      textSha256: sha(description),
      status: 'checked',
      diagnostics: [],
      // #724 re-reviewed the Skill Focus records' rank Modifiers on 2026-10-14.
      reviewedBy: 'Opus (AI curator) for the owner',
      reviewedOn: isSkillFocus ? '2026-10-14' : '2026-10-13',
    });
    for (const reviewed of row.mechanicsReview.curationRecords)
      expect(
        reviewedCuration.records.find(
          (current) =>
            current.externalKey === row.externalKey &&
            current.kind === reviewed.kind &&
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
  // The Storm Survivor body equals its Ultimate Wilderness benefit.
  expect(candidate('Storm Survivor').comparison?.literalRow).toContain(
    'BENEFIT:When you are in a storm of any type, you gain a +2 circumstance bonus on Perception checks, Survival checks, and saving throws regarding adverse effects from the storm itself. If you have 10 or more ranks in one of these skills, this bonus increases to +4.',
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
      descriptions: { candidates: 51, checked: 51 },
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
    const gate = assessCatalogAdmission({
      artifact: authoritative,
      ...reviewedAdmission,
    });
    expect(gate.admitted.map((row) => row.name).sort()).toEqual(
      [...admittedNames].sort(),
    );
    expect(gate.held).toHaveLength(49);
    expect(gate.dependentOmissions).toEqual([]);
    expect(gate.failures).toEqual([]);
    for (const row of gate.held)
      expect(row.reason, row.name).toMatch(/^feats-366-whole-content-/);
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
    const confirm = (...names: string[]) => {
      const keys = names.map((name) => candidate(name).externalKey);
      return assessWithUnclearedHolds({
        artifact: authoritative,
        ...reviewedAdmission,
        assessments: reviewedAdmission.assessments.map((row) =>
          keys.includes(row.externalKey)
            ? { ...row, status: 'confirmed' as const }
            : row,
        ),
      });
    };
    // A changed admitted body invalidates its binding and is no longer admitted.
    const focus = entry(skillFocus[0][0]);
    const edited = assessCatalogAdmission({
      artifact: {
        ...authoritative,
        catalog: {
          ...authoritative.catalog,
          entries: authoritative.catalog.entries.map((row) =>
            row.externalKey === focus.externalKey
              ? { ...row, modifiers: row.modifiers.slice(1) }
              : row,
          ),
        },
      },
      ...reviewedAdmission,
    });
    expect(edited.admitted.map((row) => row.name)).toEqual([skillFocus[1][0]]);
    // Confirming a held body still holds it on its held notices.
    const boar = confirm('Boar Ferocity');
    expect(boar.admitted.map((row) => row.name).sort()).toEqual(
      [...admittedNames].sort(),
    );
    expect(
      boar.held.find((row) => row.name === 'Boar Ferocity')?.reason,
    ).toMatch(/Notice holds|Missing or unreviewed required notices/);
    // A no-row body that needs only the reviewed CRB notice is kept out only
    // by its unresolved whole-content assessment.
    expect(candidate('Swift Swimmer').requiredNotices).toEqual(['PZO1110']);
    expect(
      confirm('Swift Swimmer')
        .admitted.map((row) => row.name)
        .sort(),
    ).toEqual(['Swift Swimmer', ...admittedNames].sort());
  } finally {
    await tree.dispose();
  }
});
