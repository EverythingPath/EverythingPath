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
} from '../fixtures/feats-362/data';
import { reviewedFeatSheet } from '../fixtures/feats-362/sheet';
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
  ['Skill Focus (Disguise)', 'skill.dis', 'Disguise', 37],
  [
    'Skill Focus (Knowledge [Geography])',
    'skill.kge',
    'Knowledge (geography)',
    46,
  ],
] as const;
const noRow = [
  'Vindictive Fall',
  'Voracious Blade',
  'Extended Scrying',
  'Savage Critical',
  'Demonic Style',
  'Ghost Hunting Team',
  'Stygian Spell',
  'Pao-Lung Self-Improvement',
  'Urdefhan Bladebreaker',
  'Greater Blood Frenzy',
  'Position of Strength',
  'Extra Hail of Arrows',
  'Deceitful Incompetence',
  'Dangerous Tail',
  'Eyes of the Purge',
  'Dreamwalker',
  'Gloomstorm',
  'Battering Ram',
];
const admittedNames = skillFocus.map(([name]) => name).sort();

// #724: the rank threshold is automatic, read from the skill's recorded ranks.
it('resolves the admitted Skill Focus (Disguise) and (Knowledge [Geography]) from their own skill ranks, without stacking copies', () => {
  for (const [name, target, skill, line] of skillFocus) {
    const rows = modifiers(name);
    expectAutomaticSkillFocus({ modifiers: rows, target });
    expect(candidate(name), name).toMatchObject({
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
      skill.replace('geography', 'Geography'),
    );
    expect(anchor?.literalRow).toMatch(/\tTYPE:\w+(\.Knowledge)?\.Base\t/);
    const [record] = candidate(name).mechanicsReview.curationRecords;
    expect(record?.diagnostics).toEqual([]);
    expect(entry(name).unsupported).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'changes' })]),
    );
    // No ranks and the skill's ability at 10: Skill Focus's +3 alone.
    expect(
      calculateCharacterSheetProjections(reviewedFeatSheet(name)).current
        .breakdowns[target].total,
      name,
    ).toBe(3);
  }
});

it('keeps exclusive rank, spending and size branches to the strongest applicable bonus', () => {
  const read = modifiers('Stone Read');
  expect(read.map((row) => [row.target, row.value])).toEqual([
    ['skill.per', 3],
    ['skill.per', 6],
  ]);
  expect(situation('Stone Read').local).toContain(
    'fewer than 10 ranks in Knowledge (dungeoneering)',
  );
  expect(resolveSheet(read)['skill.per'].total).toBe(0);
  expect(
    resolveSheet(read, { situations: [situation('Stone Read')] })['skill.per']
      .total,
  ).toBe(3);
  expect(
    resolveSheet(read, {
      situations: [situation('Stone Read'), situation('Stone Read', 1)],
    })['skill.per'].total,
  ).toBe(6);
  const psychic = modifiers('Psychic Combatant');
  expect(psychic.map((row) => [row.target, row.value])).toEqual([
    ['saves', 1],
    ['saves', 2],
  ]);
  const spent = resolveSheet(psychic, {
    situations: [
      situation('Psychic Combatant'),
      situation('Psychic Combatant', 1),
    ],
  });
  expect([
    spent['save.fort'].total,
    spent['save.ref'].total,
    spent['save.will'].total,
  ]).toEqual([2, 2, 2]);
  const wings = modifiers('Dragonfly Wings');
  expect(wings.map((row) => [row.target, row.value])).toEqual([
    ['attack.melee', 1],
    ['attack.melee', 2],
  ]);
  // The +1 is only the increment over Dragonfly Style's own +1.
  expect(situation('Dragonfly Wings').local).toContain(
    "increment over Dragonfly Style's +1",
  );
  expect(
    resolveSheet(wings, { situations: [situation('Dragonfly Wings', 1)] })[
      'attack.melee'
    ].total,
  ).toBe(2);
  expect(
    resolveSheet(wings, { situations: [situation('Dragonfly Wings', 1)] })[
      'attack.ranged'
    ].total,
  ).toBe(0);
  const porcupine = modifiers('Porcupine Defense');
  expect(porcupine.map((row) => [row.target, row.value])).toEqual([
    ['attack', 2],
    ['cmd', 2],
  ]);
  const provoked = resolveSheet(porcupine, {
    situations: [situation('Porcupine Defense')],
  });
  expect([
    provoked['attack.melee'].total,
    provoked['attack.ranged'].total,
    provoked.cmd.total,
  ]).toEqual([2, 2, 0]);
  expect(
    resolveSheet(porcupine, { situations: [situation('Porcupine Defense', 1)] })
      .cmd.total,
  ).toBe(2);
  expect(
    calculateCharacterSheetProjections(reviewedFeatSheet('Stone Read')).current
      .breakdowns['skill.per'].total,
  ).toBe(0);
});

it('uses the shared fear Situation, keeps narrower bonuses local and adds imported and note-bound Uncanny Alertness bonuses once', () => {
  const stoic = modifiers('Stoic');
  expect(stoic[0]?.condition?.situation).toBe('fear');
  expect(resolveSheet(stoic)['save.will'].total).toBe(0);
  const afraid = resolveSheet(stoic, { situations: ['fear'] });
  expect([
    afraid['save.fort'].total,
    afraid['save.ref'].total,
    afraid['save.will'].total,
  ]).toEqual([1, 1, 1]);
  expect(
    calculateCharacterSheetProjections(reviewedFeatSheet('Stoic'), {
      situations: ['fear'],
    }).current.breakdowns['save.will'].total,
  ).toBe(1);
  // The shared Situations do not carry these bodies' narrower scopes.
  for (const [name, shared, target] of [
    ['Urdefhan Bladebreaker', 'sunder', 'cmb'],
    ['Net Maneuvering', 'disarm', 'cmb'],
    ['Janni Tempest', 'trip', 'cmb'],
    ['Janni Tempest', 'bullRush', 'cmb'],
    ['Demonic Style', 'charging', 'attack.melee'],
  ] as const) {
    const rows = modifiers(name);
    expect(resolveSheet(rows, { situations: [shared] })[target].total).toBe(0);
    expect(
      resolveSheet(rows, { situations: [situation(name)] })[target].total,
      name,
    ).toBeGreaterThan(0);
  }
  expect(modifiers('Urdefhan Bladebreaker')[0]?.bonusType).toBe('circumstance');
  const demonic = resolveSheet(modifiers('Demonic Style'), {
    situations: [situation('Demonic Style'), situation('Demonic Style', 1)],
  });
  expect([
    demonic['attack.melee'].total,
    demonic['damage.melee'].total,
  ]).toEqual([1, 2]);
  const alert = modifiers('Uncanny Alertness');
  expect(
    alert.map((row) => [row.target, row.value, row.condition?.situation]),
  ).toEqual([
    ['skill.per', 1, undefined],
    ['skill.sen', 1, undefined],
    ['saves', 2, { local: 'saving throws against sleep and charm effects' }],
  ]);
  // Alertness's own +2 from another entry stacks with the untyped +1.
  expect(
    resolveSheet([...alert, other(alert[0]!, 2, 'alertness')])['skill.per']
      .total,
  ).toBe(3);
  expect(
    resolveSheet(alert, { situations: [situation('Uncanny Alertness', 2)] })[
      'save.will'
    ].total,
  ).toBe(2);
  const [description, note, ...rest] =
    candidate('Uncanny Alertness').mechanicsReview.curationRecords;
  expect(rest).toEqual([]);
  expect(description?.outputs.map((output) => output.kind)).toEqual(['note']);
  expect(note).toMatchObject({
    kind: 'note',
    target: 'allSavingThrows',
    text: '+[[2]] vs sleep and charm effects',
    status: 'checked',
    diagnostics: [],
  });
  const projected = calculateCharacterSheetProjections(
    reviewedFeatSheet('Uncanny Alertness'),
  ).current.breakdowns;
  expect([
    projected['skill.per'].total,
    projected['skill.sen'].total,
    projected['save.will'].total,
  ]).toEqual([1, 1, 0]);
});

it('routes penalties and typed bonuses to their published scope', () => {
  const ranged = resolveSheet(modifiers('Overwatch Style'), {
    situations: [situation('Overwatch Style')],
  });
  expect([ranged['attack.ranged'].total, ranged['attack.melee'].total]).toEqual(
    [-2, 0],
  );
  const stab = resolveSheet(modifiers('Stabbing Shot'), {
    situations: [situation('Stabbing Shot')],
  });
  expect([stab['attack.melee'].total, stab['attack.ranged'].total]).toEqual([
    -2, -2,
  ]);
  expect(
    resolveSheet(modifiers('Octopus Thrash'), {
      situations: [situation('Octopus Thrash')],
    }).cmb.total,
  ).toBe(-5);
  expect(
    resolveSheet(modifiers('Neckbreaker'), {
      situations: [situation('Neckbreaker')],
    })['attack.melee'].total,
  ).toBe(-5);
  expect(
    resolveSheet(modifiers('Aldori Style Aegis'), {
      situations: [situation('Aldori Style Aegis')],
    })['ac.other'].total,
  ).toBe(-2);
  const guardian = modifiers('Guardian of the Wild');
  // Dodge bonuses from different sources stack.
  expect(
    resolveSheet([...guardian, other(guardian[0]!, 1)], {
      situations: [situation('Guardian of the Wild')],
    })['ac.other'].total,
  ).toBe(3);
  const dervish = modifiers('Flame Blade Dervish');
  expect(dervish[0]?.bonusType).toBe('competence');
  // A larger competence bonus from another source replaces, not adds.
  expect(
    resolveSheet([...dervish, other(dervish[0]!, 5)], {
      situations: [situation('Flame Blade Dervish')],
    })['skill.acr'].total,
  ).toBe(5);
  const swimmer = modifiers('Master Swimmer');
  expect(swimmer.map((row) => [row.target, row.bonusType, row.value])).toEqual([
    ['skill.swm', 'racial', 2],
  ]);
  // Racial bonuses stack in the resolver, so the +2 (instead of +8) is kept to
  // characters whose only swim speed comes from this feat.
  expect(situation('Master Swimmer').local).toContain('your only swim speed');
  expect(resolveSheet(swimmer)['skill.swm'].total).toBe(0);
  expect(
    resolveSheet(swimmer, { situations: [situation('Master Swimmer')] })[
      'skill.swm'
    ].total,
  ).toBe(2);
  expect(
    calculateCharacterSheetProjections(reviewedFeatSheet('Master Swimmer'))
      .current.breakdowns['skill.swm'].total,
  ).toBe(0);
  expect(
    resolveSheet(modifiers('Blood Drinker'), {
      situations: [situation('Blood Drinker')],
    })['save.fort'].total,
  ).toBe(1);
  for (const [name, target, value] of [
    ['Team Pickpocketing', 'skill.slt', 4],
    ['Druidic Decoder', 'skill.lin', 5],
    ['Blistering Feint', 'skill.blf', 2],
    ['Position of Strength', 'skill.int', 4],
    ['Mantis Wisdom', 'attack.melee', 2],
    ['Improved Back to Back', 'ac.other', 2],
  ] as const) {
    const rows = modifiers(name);
    expect(resolveSheet(rows)[target].total, name).toBe(0);
    expect(
      resolveSheet(rows, { situations: [situation(name)] })[target].total,
      name,
    ).toBe(value);
  }
  const planes = resolveSheet(modifiers('Outer Planes Traveler'), {
    situations: [situation('Outer Planes Traveler')],
  });
  expect(planes['save.ref'].total).toBe(2);
});

it('keeps choice, resource, metamagic, mythic-tier and recipient bodies off holder totals', () => {
  for (const name of [
    "Mother's Gift",
    'Focused Aberration Expertise',
    'Foebane Magic',
    'Raging Vitality',
    'Deceitful Incompetence',
    'Improved Reposition (Mythic)',
    'Improved Dirty Trick (Mythic)',
    'Saving Shield (Mythic)',
    'Expanded Phrenic Pool',
    'Thundering Spell',
    'Burning Amplification',
    'Pao-Lung Self-Improvement',
    'Godless Healing',
    "Skald's Vigor",
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
  expect(preview.entries.flatMap((row) => row.modifiers)).toHaveLength(35);
  expect(
    preview.entries.filter((row) => row.modifiers.length > 0),
  ).toHaveLength(28);
  expect(
    preview.entries.flatMap((row) =>
      row.modifiers.filter((modifier) =>
        ['casterLevel', 'spellDC', 'hp'].includes(modifier.target),
      ),
    ),
  ).toEqual([]);
  // The sanitizer joins table cells; the reviewed Note keeps them readable.
  expect(entry('Outer Planes Traveler').situationalNotes?.[0]?.text).toContain(
    '\nPlane | Alignment | Descriptor\nHeaven | LG | Light\n',
  );
});

it('records inherited-rule notices, alternate versions and enforced notice holds without inventing attribution', () => {
  const tricks = [
    'Stabbing Shot',
    'Second Chance',
    'Ferocious Tenacity',
    'Blistering Feint',
    'Neckbreaker',
    'Net Adept',
    "Butterfly's Sting",
    'Quick Reposition',
    'Tandem Trip',
    'Revelation Strike',
    'Janni Tempest',
    'Mantis Wisdom',
    'Porcupine Defense',
    'Net Maneuvering',
  ];
  for (const name of tricks) {
    expect(candidate(name).requiredNotices, name).toContain('PZO1131');
    expect(entry(name).description, name).toContain('stamina');
    const trick = candidate(name).inheritedRuleComparisonEvidence.find((row) =>
      row.literalRow.includes('KEY:Combat Trick ~ '),
    );
    expect(trick, name).toMatchObject({
      evidenceRole: 'inherited-rule-comparison',
      appliesToRootBody: false,
    });
    expect(trick?.literalRow, name).toContain(`KEY:Combat Trick ~ ${name}`);
  }
  expect(
    review.candidates.filter(
      (row) =>
        row.sourceFields.description !== undefined &&
        JSON.stringify(row.sourceFields.description).includes('stamina'),
    ),
  ).toHaveLength(tricks.length);
  // PCGen files these two tricks under other books, which are required too.
  expect(candidate("Butterfly's Sting").requiredNotices).toEqual([
    'PZO9267',
    'PZO9463',
    'PZO1131',
    'PZO1110',
  ]);
  expect(candidate('Porcupine Defense').requiredNotices).toEqual([
    'PZO9434',
    'PZO9467',
    'PZO1131',
    'PZO1110',
  ]);
  for (const [name, base] of [
    ['Improved Reposition (Mythic)', 'PZO1115'],
    ['Improved Dirty Trick (Mythic)', 'PZO1115'],
    ['Saving Shield (Mythic)', 'PZO1115'],
    ['Fire Music (Mythic)', 'PZO1117'],
    ['Quick Draw (Mythic)', null],
    ['Vital Strike (Mythic)', null],
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
    if (base) expect(candidate(name).requiredNotices, name).toContain(base);
  }
  for (const [name, book] of [
    ['Channel Force', 'PZO1112'],
    ['Quick Reposition', 'PZO1115'],
    ['Aldori Style Aegis', 'PZO1129'],
    ['Recruits', 'PZO1125'],
    ['Ghost Hunting Team', 'PZO1141'],
    ['Greater Blood Frenzy', 'PZO9482'],
    ['Greater Blood Frenzy', 'PZO1112'],
    ['Voracious Blade', 'PZO1123'],
    ['Urdefhan Bladebreaker', 'PZO1123'],
    ['Disconcerting Stare', 'PZO1132'],
    ['Demonic Style', 'PZO1129'],
    ['Battering Ram', 'PZO1118'],
    ['Overwatch Style', 'PZO1118'],
    ['Flexible Shadow Jump', 'PZO1118'],
    ['Eerie Sense', 'PZO1114'],
    ['Blinding Flash', 'PZO1112'],
    ['Jinx Alchemy', 'PZO1115'],
    ['Revelation Strike', 'PZO1115'],
    ['Janni Tempest', 'PZO1115'],
    ['Net Maneuvering', 'PZO1115'],
    ['Greater Serpent Lash', 'PZO1115'],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  // Pinned pf1 records name the books of these inherited racial and weapon rules.
  for (const [name, path] of [
    ['Ghost Hunting Team', 'packs/races/duskwalker.HKRRq2tdZVEGlmHG.yaml'],
    ['Greater Blood Frenzy', 'packs/races/sahuagin.TbZmYyDUxRn9baWy.yaml'],
    [
      'Voracious Blade',
      'packs/weapons-and-ammo/rhoka-sword.4gxX2chWtbQNT2wP.yaml',
    ],
  ] as const)
    expect(
      candidate(name).inheritedRuleNotices.some((row) =>
        row.location.endsWith(path),
      ),
      name,
    ).toBe(true);
  // Rejected versions' books are not required; the body follows the root.
  for (const [name, root, rejected] of [
    ['Ferocious Tenacity', 'PZO1121', ['PZO9413']],
    ['Stone Read', 'PZO9267', ['PZO9416']],
    ["Butterfly's Sting", 'PZO9267', ['PZO9416']],
  ] as const) {
    expect(candidate(name).comparison?.book, name).toBe(root);
    expect(
      candidate(name).rejectedRootComparisonEvidence.map((row) => row.book),
      name,
    ).toEqual(rejected);
    for (const book of rejected)
      expect(candidate(name).requiredNotices, name).not.toContain(book);
  }
  expect(candidate('Ferocious Tenacity').comparison?.literalRow).toContain(
    'BENEFIT:Once per day when raging',
  );
  // Both Foebane Magic rows support the body, so both books are required.
  expect(candidate('Foebane Magic').requiredNotices).toEqual([
    'PZO1140',
    'PZO9456',
    'PZO1110',
  ]);
  expect(
    candidate('Foebane Magic').additionalComparisonLeads[0]?.literalRow,
  ).toContain(
    'PRETEXT:Ability to cast 1st-level spells, favored enemy class feature.',
  );
  expect(
    candidate('Focused Aberration Expertise').comparison?.literalRow,
  ).toMatch(/^Focused Aberration Expertise \(Fortitude\)\t/);
  expect(
    candidate('Focused Aberration Expertise').additionalComparisonLeads.map(
      (row) => row.literalRow.split('\t')[0],
    ),
  ).toEqual(['Focused Aberration Expertise (Will)']);
  for (const name of noRow) {
    expect(candidate(name).comparison, name).toBeNull();
    expect(candidate(name).inheritedRuleUnresolvedOrigins[0], name).toContain(
      'no PCGen row at the pin',
    );
  }
  expect(review.candidates.filter((row) => !row.comparison)).toHaveLength(
    noRow.length,
  );
  expect(candidate('Expanded Phrenic Pool').requiredNotices).toEqual([
    'PZO1132',
  ]);
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
  for (const row of review.candidates) {
    expect(row.holdIds, row.name).toEqual(
      row.name.startsWith('Skill Focus')
        ? []
        : [`feats-362-whole-content-${row.externalKey.split('/')[1]}`],
    );
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices
        .filter((book) => book !== 'PZO1110')
        .map((book) => `feats-362-notice-${book}-complete-chain`),
    );
  }
});

it('retains recorded parser findings and checks current bounded or advisory clauses', () => {
  const kinds = (name: string) =>
    entry(name).prerequisites?.map((atom) =>
      'kind' in atom ? atom.kind : 'anyOf',
    );
  expect(kinds('Uncanny Alertness')).toEqual(['feat']);
  expect(kinds('Neckbreaker')).toEqual([
    'feat',
    'feat',
    'feat',
    'feat',
    'feat',
    'feat',
    'skillRanks',
  ]);
  expect(kinds('Voracious Blade')).toEqual(['feat', 'bab', 'unchecked']);
  expect(kinds('Flame Blade Dervish')).toEqual(['unchecked']);
  expect(kinds('Owl Dive')).toEqual([
    'ability',
    'feat',
    'feat',
    'feat',
    'anyOf',
    'skillRanks',
    'skillRanks',
    'skillRanks',
  ]);
  for (const [name, gap] of [
    ['Uncanny Alertness', 'pinned Alertness feat exists'],
    ['Aldori Style Aegis', 'pinned Alertness feat exists'],
    ['Aldori Style Aegis', 'without the weapon choice'],
    ['Neckbreaker', '"Jawbreaker" and "Stunning Fist"'],
    ['Stone-Handed', 'pinned Stunning Fist feat exists'],
    ['Mantis Wisdom', 'pinned Stunning Fist feat exists'],
    ['Voracious Blade', 'without the rhoka sword choice'],
    ['Flame Blade Dervish', 'loses its flame blade scope'],
    ['Eyes of the Purge', 'loses its detect magic scope'],
    ['Outer Planes Traveler', 'split at "or"'],
    ['Foebane Magic', "single class's Favored Enemy"],
    ['Second Chance', 'waiver of the Intelligence 13 prerequisite'],
    ['Quick Reposition', 'waiver of the Intelligence 13 prerequisite'],
    ['Demonic Obedience', '"3 ranks in Knowledge (planes)"'],
    ['Pao-Lung Self-Improvement', 'Pao- Lung'],
  ] as const)
    expect(
      recordedPrerequisiteFacts({
        batch: 'feats-362',
        candidate: candidate(name),
      }),
      name,
    ).toEqual(expect.arrayContaining([expect.stringContaining(gap)]));
  for (const name of [
    'Extra Hail of Arrows',
    'Godless Healing',
    "Mother's Gift",
    'Revelation Strike',
    'Skill Focus (Disguise)',
    'Skill Focus (Knowledge [Geography])',
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
    admitted: 2,
    held: 98,
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
    const isSkillFocus = row.name.startsWith('Skill Focus');
    expect(rest).toHaveLength(row.name === 'Uncanny Alertness' ? 1 : 0);
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
  // The Stoic body equals its Inner Sea World Guide benefit.
  expect(candidate('Stoic').comparison?.literalRow).toContain(
    'You gain a +1 bonus on all saving throws against fear effects. If you successfully save against any fear effect, you are immune to further fear effects from that source for 24 hours.',
  );
  expect(candidate('Stoic').mechanicsReview.descriptionText).toContain(
    '<strong>Benefits</strong>: You gain a +1 bonus on all saving throws against fear effects.',
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
      required: 1,
      checked: 1,
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
    expect(gate.admitted.map((row) => row.name).sort()).toEqual(admittedNames);
    expect(gate.held).toHaveLength(98);
    expect(gate.dependentOmissions).toEqual([]);
    expect(gate.failures).toEqual([]);
    for (const row of gate.held)
      expect(row.reason, row.name).toMatch(/^feats-362-whole-content-/);
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
    const disguise = entry('Skill Focus (Disguise)');
    const edited = assessWithUnclearedHolds({
      artifact: {
        ...authoritative,
        catalog: {
          ...authoritative.catalog,
          entries: authoritative.catalog.entries.map((row) =>
            row.externalKey === disguise.externalKey
              ? { ...row, modifiers: row.modifiers.slice(1) }
              : row,
          ),
        },
      },
      ...reviewedAdmission,
    });
    expect(edited.admitted.map((row) => row.name).sort()).toEqual(
      admittedNames.filter((name) => name !== disguise.name),
    );
    // Confirming a held body still holds it on its held notices.
    const stoic = confirm('Stoic');
    expect(stoic.admitted.map((row) => row.name).sort()).toEqual(admittedNames);
    expect(stoic.held.find((row) => row.name === 'Stoic')?.reason).toMatch(
      /Notice holds|Missing or unreviewed required notices/,
    );
    // A no-row body that needs only the reviewed CRB notice is kept out only
    // by its unresolved whole-content assessment; the admitted bodies stay.
    expect(candidate('Vindictive Fall').requiredNotices).toEqual(['PZO1110']);
    expect(
      confirm('Vindictive Fall')
        .admitted.map((row) => row.name)
        .sort(),
    ).toEqual([...admittedNames, 'Vindictive Fall'].sort());
  } finally {
    await tree.dispose();
  }
});
