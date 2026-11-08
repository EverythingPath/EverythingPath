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
} from '../fixtures/feats-364/data';
import { reviewedFeatSheet } from '../fixtures/feats-364/sheet';
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
// The isolated sheet with one ability score changed from its base 10.
function withAbility(
  sheet: ReturnType<typeof reviewedFeatSheet>,
  target: string,
  value: number,
) {
  return {
    ...sheet,
    catalogEntries: sheet.catalogEntries.map((row) =>
      row._id === 'base'
        ? {
            ...row,
            modifiers: row.modifiers.map((modifier) =>
              modifier.target === target ? { ...modifier, value } : modifier,
            ),
          }
        : row,
    ),
  };
}

const skillFocus = [
  ['Skill Focus (Escape Artist)', 'skill.esc', 'Escape Artist', 38],
  ['Skill Focus (Appraise)', 'skill.apr', 'Appraise', 8],
  [
    'Skill Focus (Knowledge [Religion])',
    'skill.kre',
    'Knowledge (religion)',
    52,
  ],
] as const;
const noRow = [
  'Psychovore Style',
  'Censoring Critical',
  'Improved Stellar Wanderer',
  'Greater Weapon Shift',
  'Lantern Glare',
  'Chance Death',
  'Spark of the Uncanny',
  'Earthtouched',
  'Deft Shootist',
  'Primal Strike',
  'Skyseeker Thrash',
  'Searing Distraction',
  "Golem's Conviction",
  'Extra Death Vow',
  'Electric Eel Style',
  'Powerful Tongue',
  'Toxic Spray',
  'Hammer Throw',
  'Iomedaean Sword Oath',
];
const admittedNames = skillFocus.map(([name]) => name).sort();
// Resolve one local Situation for every Modifier of an entry.
function all(name: string, sheetEntryId = entry(name).externalKey) {
  return modifiers(name).map((_, index) =>
    situation(name, index, sheetEntryId),
  );
}

// #724: the rank threshold is automatic, read from the skill's recorded ranks.
it('resolves the admitted Skill Focus (Escape Artist), (Appraise) and (Knowledge [Religion]) from their own skill ranks, without stacking copies', () => {
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
      skill.replace('religion', 'Religion'),
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
      name,
    ).toBe(3);
  }
});

it('keeps exclusive rank and attitude branches to the strongest bonus and typed bonuses to their stacking rules', () => {
  const psychovore = modifiers('Psychovore Style');
  expect(
    psychovore.map((row) => [row.target, row.bonusType, row.value]),
  ).toEqual([
    ['ac.other', 'dodge', 1],
    ['ac.other', 'dodge', 2],
    ['ac.other', 'dodge', 3],
  ]);
  expect(resolveSheet(psychovore)['ac.other'].total).toBe(0);
  expect(
    resolveSheet(psychovore, {
      situations: [situation('Psychovore Style', 1)],
    })['ac.other'].total,
  ).toBe(2);
  // Exclusive rank branches give only the strongest; dodge bonuses from
  // different sources stack.
  expect(
    resolveSheet([...psychovore, other(psychovore[0]!, 1)], {
      situations: all('Psychovore Style'),
    })['ac.other'].total,
  ).toBe(4);
  const ghost = resolveSheet(modifiers('Ghost Guide'), {
    situations: all('Ghost Guide'),
  });
  expect([ghost['skill.dip'].total, ghost['skill.sen'].total]).toEqual([4, 4]);
  const below = resolveSheet(modifiers('Ghost Guide'), {
    situations: [situation('Ghost Guide'), situation('Ghost Guide', 2)],
  });
  expect([below['skill.dip'].total, below['skill.sen'].total]).toEqual([2, 2]);
  expect(
    resolveSheet(modifiers('Ironclad Logic'), {
      situations: all('Ironclad Logic'),
    })['skill.dip'].total,
  ).toBe(8);
  // Focused Discipline's saves use the shared fear Situation; its morale
  // bonuses do not stack with another morale bonus.
  const focused = modifiers('Focused Discipline');
  expect(focused[0]?.condition?.situation).toBe('fear');
  expect(resolveSheet(focused)['save.will'].total).toBe(0);
  const fear = resolveSheet(focused, { situations: ['fear'] });
  expect([
    fear['save.fort'].total,
    fear['save.ref'].total,
    fear['save.will'].total,
    fear['attack.melee'].total,
  ]).toEqual([2, 2, 2, 0]);
  const resisted = resolveSheet([...focused, other(focused[1]!, 3)], {
    situations: [situation('Focused Discipline', 1)],
  });
  expect([
    resisted['attack.melee'].total,
    resisted['attack.ranged'].total,
  ]).toEqual([3, 3]);
  const unresisted = resolveSheet(focused, {
    situations: [situation('Focused Discipline', 1)],
  });
  expect([
    unresisted['attack.melee'].total,
    unresisted['damage.ranged'].total,
    unresisted.cmb.total,
  ]).toEqual([2, 2, 2]);
  const rage = modifiers('Sympathetic Rage');
  expect(rage.map((row) => [row.target, row.bonusType, row.value])).toEqual([
    ['ability.str', 'morale', 2],
    ['ability.con', 'morale', 2],
    ['save.will', 'morale', 2],
    ['ac', 'untyped', -2],
  ]);
  expect(situation('Sympathetic Rage', 3)).toEqual(
    situation('Sympathetic Rage'),
  );
  const raging = resolveSheet(rage, {
    situations: [situation('Sympathetic Rage')],
  });
  expect([
    raging['ability.str'].total,
    raging['ability.con'].total,
    raging['save.will'].total,
    raging['ac.other'].total,
  ]).toEqual([2, 2, 2, -2]);
  // A real rage's +4 morale bonus replaces, not adds to, the weaker one.
  expect(
    resolveSheet([...rage, other(rage[0]!, 4)], {
      situations: [situation('Sympathetic Rage')],
    })['ability.str'].total,
  ).toBe(4);
  const scars = modifiers('Nightmare Scars');
  expect(resolveSheet(scars)['skill.int'].total).toBe(2);
  const favored = resolveSheet(scars, {
    situations: [situation('Nightmare Scars')],
  });
  expect([favored['skill.dip'].total, favored['skill.han'].total]).toEqual([
    2, 2,
  ]);
  const disfavored = resolveSheet(scars, {
    situations: [situation('Nightmare Scars', 2)],
  });
  expect([
    disfavored['skill.dip'].total,
    disfavored['skill.han'].total,
  ]).toEqual([-2, -2]);
  const ozem = modifiers('Legacy of Ozem');
  expect(ozem.map((row) => [row.target, row.bonusType, row.value])).toEqual([
    ['damage', 'sacred', 1],
  ]);
  expect(
    resolveSheet([...ozem, other(ozem[0]!, 2)], {
      situations: [situation('Legacy of Ozem')],
    })['damage.melee'].total,
  ).toBe(2);
  // Fascinated by the Mundane's own benefit is unconditional; Diplomacy
  // joins it only after the goal.
  const fascinated = modifiers('Fascinated by the Mundane');
  const always = resolveSheet(fascinated);
  expect(
    [
      'skill.blf',
      'skill.dis',
      'skill.han',
      'skill.int',
      'skill.prf',
      'skill.umd',
      'skill.dip',
    ].map((target) => always[target as 'skill.blf'].total),
  ).toEqual([2, 2, 2, 2, 2, 2, 0]);
  expect(
    resolveSheet(fascinated, {
      situations: [situation('Fascinated by the Mundane', 6)],
    })['skill.dip'].total,
  ).toBe(2);
  for (const [name, target, value] of [
    ['Iconoclast', 'skill.int', 5],
    ['Shield Snag', 'skill.clm', 4],
    ['Ancient Draconic', 'casterLevel', 1],
    ['Earthtouched', 'casterLevel', 1],
    ['Scorching Weapons', 'save.ref', 2],
    ['Patient Strike', 'attack.ranged', 2],
    ['Black Powder Spectacle', 'skill.int', 4],
    ['Black Powder Spectacle', 'skill.prf', 4],
    ['Wings of the Androsphinx', 'ac.other', 2],
    ['Spring-Heeled Style', 'attack.melee', 2],
    ['Cruelty', 'damage.ranged', 2],
    ['Electric Eel Style', 'cmb', 4],
    ['Shrewd Tactician', 'skill.sen', 3],
  ] as const) {
    const rows = modifiers(name);
    expect(resolveSheet(rows)[target].total, name).toBe(0);
    expect(
      resolveSheet(rows, { situations: all(name) })[target].total,
      name,
    ).toBe(value);
  }
  for (const name of [
    'Nightmare Scars',
    'Sympathetic Rage',
    'Focused Discipline',
    'Psychovore Style',
  ] as const)
    expect(
      Object.entries(
        calculateCharacterSheetProjections(reviewedFeatSheet(name)).current
          .breakdowns,
      )
        .filter(([, row]) => row.total !== 0 && row.total !== 10)
        .map(([target, row]) => [target, row.total]),
      name,
    ).toEqual(name === 'Nightmare Scars' ? [['skill.int', 2]] : []);
});

it("adds Monkey Style's Wisdom bonus to Acrobatics and Intimidate Animals' Wisdom modifier only under its Situation", () => {
  const [acrobatics] = entry('Monkey Style').modifiers;
  expect(acrobatics).toMatchObject({
    target: 'skill.acr',
    value: { formula: 'max(0, @ability.wis.mod)' },
  });
  expect(acrobatics?.condition).toBeUndefined();
  const wise = withAbility(
    reviewedFeatSheet('Monkey Style'),
    'ability.wis',
    14,
  );
  expect(
    calculateCharacterSheetProjections(wise).current.breakdowns['skill.acr']
      .total,
  ).toBe(2);
  // A Wisdom penalty is not a bonus: the formula floors at 0.
  const foolish = withAbility(
    reviewedFeatSheet('Monkey Style'),
    'ability.wis',
    8,
  );
  expect(
    calculateCharacterSheetProjections(foolish).current.breakdowns['skill.acr']
      .total,
  ).toBe(0);
  const animals = withAbility(
    reviewedFeatSheet('Intimidate Animals'),
    'ability.wis',
    16,
  );
  expect(
    calculateCharacterSheetProjections(animals).current.breakdowns['skill.int']
      .total,
  ).toBe(0);
  expect(
    calculateCharacterSheetProjections(animals, {
      situations: [situation('Intimidate Animals', 0, 'feat-row')],
    }).current.breakdowns['skill.int'].total,
  ).toBe(3);
});

it('keeps resource, mythic-tier, replacement, recipient and scaling bodies off holder totals', () => {
  for (const name of [
    'Psychic Virtuoso',
    'Twin Thunders',
    'Censoring Critical',
    'Pesh Healing',
    'Gnome Trickster (Mythic)',
    'Hymn Singer',
    'Death from Above',
    'Distance Thrower',
    'Arcane Shield',
    'Primal Ancestry',
    'Improved Stalwart',
    'Skyseeker Thrash',
    'Spiritual Training',
    'Blighted Critical',
    'Bless Equipment',
    'Augment Summoning (Mythic)',
  ]) {
    expect(modifiers(name), name).toEqual([]);
    expect(entry(name).situationalNotes?.[0]?.text, name).toBeTruthy();
    expect(
      candidate(name).mechanicsReview.outstandingCalculations.length,
      name,
    ).toBeGreaterThan(0);
  }
  expect(
    candidate('Death from Above').mechanicsReview.outstandingCalculations[0],
  ).toContain('replaces, rather than adds to');
  // #724: each Skill Focus has one automatic Modifier instead of two.
  expect(preview.entries.flatMap((row) => row.modifiers)).toHaveLength(49);
  expect(
    preview.entries.filter((row) => row.modifiers.length > 0),
  ).toHaveLength(25);
  expect(
    preview.entries.flatMap((row) =>
      row.modifiers.filter((modifier) =>
        ['spellDC', 'hp'].includes(modifier.target),
      ),
    ),
  ).toEqual([]);
  // Line breaks and labelled paragraphs stay readable in the reviewed Notes.
  expect(entry('Spring-Heeled Style').situationalNotes?.[0]?.text).toContain(
    'Pathfinder Society\nThe Spring Heeled Style feat',
  );
});

it('records inherited-rule notices, alternate versions and enforced notice holds without inventing attribution', () => {
  const tricks = [
    ['Twin Thunders', 'PZO1131'],
    ['Deathless Master', 'PZO1131'],
    ['Shield Snag', 'PZO9467'],
    ['Shaitan Earthblast', 'PZO1131'],
    ['Greater Rending Fury', 'PZO1131'],
    ['Distance Thrower', 'PZO1131'],
    ['Focused Discipline', 'PZO9463'],
    ['Sympathetic Rage', 'PZO1131'],
    ['Tangle Feet', 'PZO1131'],
    ['Scorching Weapons', 'PZO1131'],
    ['Black Powder Spectacle', 'PZO9463'],
    ['Monkey Style', 'PZO1131'],
    ['Death from Above', 'PZO1131'],
    ['Killing Flourish', 'PZO1131'],
    ['Performance Weapon Mastery', 'PZO1131'],
    ['Panther Claw', 'PZO1131'],
    ['Shadow Strike', 'PZO1131'],
    ['Squash Flat', 'PZO9463'],
    ['Shrewd Tactician', 'PZO9463'],
    ['Panther Style', 'PZO1131'],
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
  // Every stamina body is a trick; Distance Thrower's trick spends none and
  // differs from the PCGen trick row, which is recorded.
  expect(
    review.candidates
      .filter((row) =>
        JSON.stringify(row.sourceFields.description).includes('stamina'),
      )
      .map((row) => row.name)
      .sort(),
  ).toEqual(
    tricks
      .map(([name]) => name)
      .filter((name) => name !== 'Distance Thrower')
      .sort(),
  );
  expect(
    candidate('Distance Thrower').mechanicsReview.sourceDiscrepancies[0],
  ).toContain('spends no stamina points');
  expect(candidate('Focused Discipline').requiredNotices).toEqual([
    'PZO9226',
    'PZO1131',
    'PZO9463',
    'PZO1110',
  ]);
  for (const [name, base] of [
    ['Gnome Trickster (Mythic)', 'PZO1115'],
    ['Elemental Fist (Mythic)', 'PZO1115'],
    ['Eagle Eyes (Mythic)', 'PZO1115'],
    ['Augment Summoning (Mythic)', null],
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
  for (const [name, book] of [
    ['Fascinated by the Mundane', 'PZO1125'],
    ['Ghost Guide', 'PZO1125'],
    ['Ghost Guide', 'PZO1114'],
    ['Shaitan Earthblast', 'PZO1115'],
    ['Electric Eel Style', 'PZO1115'],
    ['Electric Eel Style', 'PZO1118'],
    ['Wings of the Androsphinx', 'PZO1115'],
    ['Golden League Tattoos', 'PZO9421'],
    ['Golden League Tattoos', 'PZO1134'],
    ['Call Out', 'PZO1118'],
    ['Twin Thunders', 'PZO1112'],
    ['Eclipse Strike', 'PZO1115'],
    ['Eclipse Strike', 'PZO1112'],
    ['Knotted Nets', 'PZO1115'],
    ['Hammer Guards the Anvil', 'PZO1115'],
    ['Totem Beast', 'PZO1129'],
    ['Vanguard Hustle', 'PZO1118'],
    ['Vanguard Hustle', 'PZO1115'],
    ['Black Powder Spectacle', 'PZO1118'],
    ['Deft Shootist', 'PZO1118'],
    ['Maximized Spellstrike', 'PZO1117'],
    ['Absorb Spirit', 'PZO1132'],
    ['Subconscious Ursurpation', 'PZO1132'],
    ['Pesh Healing', 'PZO1114'],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  // Pinned pf1 spell and race records name the books of the rules these
  // bodies use.
  for (const [name, path, book] of [
    [
      'Ghost Guide',
      'packs/spells/call-spirit.k0ihiqhfppkchs1j.yaml',
      'PZO1132',
    ],
    [
      'Ghost Guide',
      'packs/spells/speak-with-haunt.ykb7nby9eovw8jyo.yaml',
      'PZO1129',
    ],
    [
      'Gnome Trickster (Mythic)',
      'packs/spells/vanish.c11olzqztodz5o5x.yaml',
      'PZO1115',
    ],
    [
      'Spiritual Training',
      'packs/spells/possession.4mw83czf7b62rar3.yaml',
      'PZO1132',
    ],
    ['Inner Light', 'packs/races/ghoran.2mWMyKiPWk6Y8cNx.yaml', 'PZO1140'],
    [
      'Extra Light and Dark',
      'packs/races/wayang.Vaf5bV3wpk24pVt2.yaml',
      'PZO9280',
    ],
  ] as const) {
    expect(
      candidate(name).inheritedRuleNotices.find((row) =>
        row.location.endsWith(path),
      )?.book,
      name,
    ).toBe(book);
    expect(candidate(name).requiredNotices, name).toContain(book);
  }
  // Rejected versions' books are not required; the body follows the root.
  for (const [name, root, rejected] of [
    ['Pesh Healing', 'PZO9462', 'PZO9208'],
    ['Inner Light', 'PZO1140', 'PZO9424'],
    ['Sympathetic Rage', 'PZO1121', 'PZO9413'],
    ['Extra Spontaneous Spell Mastery', 'PZO1138', 'PZO9465'],
    ['Squash Flat', 'PZO9267', 'PZO9420'],
  ] as const) {
    expect(candidate(name).comparison?.book, name).toBe(root);
    expect(
      candidate(name).rejectedRootComparisonEvidence.map((row) => row.book),
      name,
    ).toEqual([rejected]);
    expect(candidate(name).requiredNotices, name).not.toContain(rejected);
  }
  expect(candidate('Pesh Healing').comparison?.literalRow).toContain(
    'Temporary hit points gained from additional doses of pesh do not stack.',
  );
  expect(candidate('Sympathetic Rage').comparison?.literalRow).toContain(
    'You cannot use this feat if you are fatigued.',
  );
  expect(candidate('Subconscious Ursurpation').comparison?.literalRow).toMatch(
    /^Subconscious Usurpation\t/,
  );
  expect(candidate('Small But Deadly').comparison?.literalRow).toMatch(
    /^Small but Deadly\t/,
  );
  // Third-party rows of the same name are named, not used as evidence.
  for (const name of ['Arcane Shield', 'Extra Light and Dark'])
    expect(
      candidate(name).mechanicsReview.sourceDiscrepancies.join(' '),
      name,
    ).toContain('not a Paizo publication');
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
      row.name.startsWith('Skill Focus')
        ? []
        : [`feats-364-whole-content-${row.externalKey.split('/')[1]}`],
    );
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices
        .filter((book) => book !== 'PZO1110')
        .map((book) => `feats-364-notice-${book}-complete-chain`),
    );
  }
});

it('retains recorded parser findings and checks current bounded or advisory clauses', () => {
  const kinds = (name: string) =>
    entry(name).prerequisites?.map((atom) =>
      'kind' in atom ? atom.kind : 'anyOf',
    );
  expect(kinds('Lantern Glare')).toEqual([
    'feat',
    'feat',
    'feat',
    'feat',
    'alignment',
    'unchecked',
  ]);
  expect(kinds('Improved Stalwart')).toEqual(['feat', 'feat', 'feat', 'bab']);
  expect(kinds('Tangle Feet')).toEqual([
    'feat',
    'feat',
    'unchecked',
    'race',
    'unchecked',
  ]);
  expect(kinds('Toxic Spray')).toEqual(['feat', 'feat', 'race']);
  expect(kinds('Fascinated by the Mundane')).toEqual(['unchecked']);
  for (const [name, gap] of [
    ['Lantern Glare', 'unrelated class ability named Good'],
    ['Improved Stalwart', 'inquisitor Stalwart class feature'],
    ['Improved Stalwart', 'pinned Endurance feat exists'],
    ['Deathless Master', 'pinned Endurance feat exists'],
    ['Tangle Feet', 'Underfoot racial trait'],
    ['Small But Deadly', 'Natural Weapon class ability'],
    ['Deft Shootist', 'pinned Amateur Gunslinger feat'],
    ['Toxic Spray', 'pinned Spit Venom feat'],
    ['Shrewd Tactician', 'pinned Alertness feat exists'],
    ['Resilient Armor', 'without the armor or shield choice'],
    ['Vanguard Hustle', 'split at "or"'],
    ['Fascinated by the Mundane', 'split at commas'],
    ['Esoteric Advantage', 'one unchecked clause'],
    ['Primal Ancestry', '"member of the Primordial Ones"'],
  ] as const)
    expect(
      recordedPrerequisiteFacts({
        batch: 'feats-364',
        candidate: candidate(name),
      }),
      name,
    ).toEqual(expect.arrayContaining([expect.stringContaining(gap)]));
  for (const name of [
    'Extra Spontaneous Spell Mastery',
    'Extra Light and Dark',
    'Skill Focus (Escape Artist)',
    'Skill Focus (Appraise)',
    'Skill Focus (Knowledge [Religion])',
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
    const isSkillFocus = row.name.startsWith('Skill Focus');
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
  // The Iconoclast body equals its Faiths & Philosophies benefit.
  expect(candidate('Iconoclast').comparison?.literalRow).toContain(
    'BENEFIT:When you succeed at a sunder combat maneuver against a holy or unholy symbol, you can attempt an Intimidate check to demoralize as a free action.',
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
    expect(gate.admitted.map((row) => row.name).sort()).toEqual(admittedNames);
    expect(gate.held).toHaveLength(97);
    expect(gate.dependentOmissions).toEqual([]);
    expect(gate.failures).toEqual([]);
    for (const row of gate.held)
      expect(row.reason, row.name).toMatch(/^feats-364-whole-content-/);
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
    const escape = entry('Skill Focus (Escape Artist)');
    const edited = assessWithUnclearedHolds({
      artifact: {
        ...authoritative,
        catalog: {
          ...authoritative.catalog,
          entries: authoritative.catalog.entries.map((row) =>
            row.externalKey === escape.externalKey
              ? { ...row, modifiers: row.modifiers.slice(1) }
              : row,
          ),
        },
      },
      ...reviewedAdmission,
    });
    expect(edited.admitted.map((row) => row.name).sort()).toEqual(
      admittedNames.filter((name) => name !== escape.name),
    );
    // Confirming a held body still holds it on its held notices.
    const scars = confirm('Nightmare Scars');
    expect(scars.admitted.map((row) => row.name).sort()).toEqual(admittedNames);
    expect(
      scars.held.find((row) => row.name === 'Nightmare Scars')?.reason,
    ).toMatch(/Notice holds|Missing or unreviewed required notices/);
    // A no-row body that needs only the reviewed CRB notice is kept out only
    // by its unresolved whole-content assessment; the admitted bodies stay.
    expect(candidate('Hammer Throw').requiredNotices).toEqual(['PZO1110']);
    expect(
      confirm('Hammer Throw')
        .admitted.map((row) => row.name)
        .sort(),
    ).toEqual([...admittedNames, 'Hammer Throw'].sort());
  } finally {
    await tree.dispose();
  }
});
