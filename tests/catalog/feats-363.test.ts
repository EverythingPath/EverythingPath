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
} from '../fixtures/feats-363/data';
import { reviewedFeatSheet } from '../fixtures/feats-363/sheet';
import { materializePinnedTree, readPinned } from './pinned-sources';
import { bindSnapshotToCurrentNotices } from './batch-ownership';
import { expectAutomaticSkillFocus } from './skill-focus-assertions';

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
  ['Skill Focus (Use Magic Device)', 'skill.umd', 'Use Magic Device', 103],
  ['Skill Focus (Diplomacy)', 'skill.dip', 'Diplomacy', 35],
  ['Skill Focus (Knowledge [Planes])', 'skill.kpl', 'Knowledge (planes)', 51],
] as const;
const noRow = [
  'Hellknight Aegis',
  'Trade Initiative',
  'Gate Breaker',
  'Signature Strike Triumph',
  'Unspoken Bond',
  'Deliberate Death',
  'Peace of Mind',
  'Turbulent Takeoff',
  'Consume Undeath',
  'Assisted Ascension',
  'Malleable Form',
  'Noxious Touch',
  'Old as Dust',
];
const admittedNames = skillFocus.map(([name]) => name).sort();
// Resolve one local Situation for every Modifier of an entry.
function all(name: string, sheetEntryId = entry(name).externalKey) {
  return modifiers(name).map((_, index) =>
    situation(name, index, sheetEntryId),
  );
}

// #724: the rank threshold is automatic, read from the skill's recorded ranks.
it('resolves the admitted Skill Focus (Use Magic Device), (Diplomacy) and (Knowledge [Planes]) from their own skill ranks, without stacking copies', () => {
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
      skill.replace('planes', 'Planes'),
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

it('keeps exclusive duel, cold and visibility branches to the strongest bonus and typed bonuses to their stacking rules', () => {
  const aldori = modifiers('Aldori Dueling Disciple');
  expect(aldori.map((row) => [row.target, row.bonusType, row.value])).toEqual([
    ['skill.int', 'morale', 2],
    ['skill.int', 'morale', 4],
  ]);
  expect(situation('Aldori Dueling Disciple', 1).local).toContain(
    'participating in a duel',
  );
  expect(resolveSheet(aldori)['skill.int'].total).toBe(0);
  expect(
    resolveSheet(aldori, { situations: all('Aldori Dueling Disciple') })[
      'skill.int'
    ].total,
  ).toBe(4);
  // Morale bonuses from different sources do not stack.
  expect(
    resolveSheet([...aldori, other(aldori[0]!, 3)], {
      situations: [situation('Aldori Dueling Disciple')],
    })['skill.int'].total,
  ).toBe(3);
  const cold = modifiers('Cold Celerity');
  expect(cold.map((row) => [row.target, row.value])).toEqual([
    ['init', 2],
    ['attack', 1],
    ['attack', 1],
  ]);
  const freezing = resolveSheet(cold, { situations: all('Cold Celerity') });
  expect([
    freezing.init.total,
    freezing['attack.melee'].total,
    freezing['attack.ranged'].total,
  ]).toEqual([2, 1, 1]);
  const burned = resolveSheet(cold, {
    situations: [situation('Cold Celerity', 2)],
  });
  expect([burned.init.total, burned['attack.melee'].total]).toEqual([0, 1]);
  const mark = resolveSheet(modifiers("Lamashtu's Mark"), {
    situations: [situation("Lamashtu's Mark")],
  });
  expect([mark['skill.int'].total, mark['skill.dip'].total]).toEqual([2, -2]);
  expect(situation("Lamashtu's Mark", 1)).toEqual(situation("Lamashtu's Mark"));
  const kyton = modifiers('Kyton Shield');
  expect(kyton.map((row) => [row.target, row.bonusType, row.value])).toEqual([
    ['ac.shield', 'shield', 1],
  ]);
  // A real shield's bonus replaces, not adds to, the feat's shield bonus.
  expect(
    resolveSheet([...kyton, other(kyton[0]!, 2)], {
      situations: [situation('Kyton Shield')],
    })['ac.shield'].total,
  ).toBe(2);
  const kirin = modifiers('Kirin Style');
  expect(kirin.map((row) => [row.target, row.bonusType, row.value])).toEqual([
    ['saves', 'untyped', 2],
    ['ac.other', 'dodge', 2],
  ]);
  const identified = resolveSheet([...kirin, other(kirin[1]!, 1)], {
    situations: all('Kirin Style'),
  });
  // Dodge bonuses from different sources stack.
  expect([
    identified['save.fort'].total,
    identified['save.ref'].total,
    identified['save.will'].total,
    identified['ac.other'].total,
  ]).toEqual([2, 2, 2, 3]);
  const fox = modifiers('Fox Shape');
  expect(fox.map((row) => [row.target, row.bonusType, row.value])).toEqual([
    ['skill.dis', 'racial', 10],
  ]);
  expect(
    resolveSheet(fox, { situations: [situation('Fox Shape')] })['skill.dis']
      .total,
  ).toBe(10);
  const aware = resolveSheet(modifiers('Dimensional Awareness'), {
    situations: [situation('Dimensional Awareness')],
  });
  expect([aware['attack.melee'].total, aware['attack.ranged'].total]).toEqual([
    2, 2,
  ]);
  const dolphin = resolveSheet(modifiers('Dolphin Style'), {
    situations: [situation('Dolphin Style')],
  });
  expect([
    dolphin['attack.melee'].total,
    dolphin['attack.ranged'].total,
  ]).toEqual([1, 0]);
  const lore = resolveSheet(modifiers('Exploit Lore'), {
    situations: all('Exploit Lore'),
  });
  expect([
    lore['attack.melee'].total,
    lore['attack.ranged'].total,
    lore['damage.melee'].total,
    lore['damage.ranged'].total,
  ]).toEqual([2, 2, 2, 2]);
  const reckless = resolveSheet(modifiers('Reckless Moves'), {
    situations: all('Reckless Moves'),
  });
  expect([
    reckless['skill.acr'].total,
    reckless['skill.clm'].total,
    reckless['skill.ste'].total,
  ]).toEqual([4, 4, 4]);
  const ledge = resolveSheet(modifiers('Ledge Walker'), {
    situations: all('Ledge Walker'),
  });
  expect([
    ledge['skill.clm'].total,
    ledge['save.fort'].total,
    ledge['save.ref'].total,
    ledge['save.will'].total,
    ledge.cmd.total,
  ]).toEqual([4, 4, 4, 4, 0]);
  for (const [name, target, value] of [
    ['Delectable Feint', 'skill.blf', 2],
    ['Passing Trick', 'skill.blf', 2],
    ['Assisted Ascension', 'skill.clm', 5],
    ['Sociable', 'skill.dip', 2],
    ['Brewmaster', 'skill.crf', 2],
    ['Brewmaster', 'skill.pro', 2],
  ] as const) {
    const rows = modifiers(name);
    expect(resolveSheet(rows)[target].total, name).toBe(0);
    expect(
      resolveSheet(rows, { situations: all(name) })[target].total,
      name,
    ).toBe(value);
  }
  for (const name of [
    "Lamashtu's Mark",
    'Aldori Dueling Disciple',
    'Kyton Shield',
    'Cold Celerity',
  ] as const)
    expect(
      Object.values(
        calculateCharacterSheetProjections(reviewedFeatSheet(name)).current
          .breakdowns,
      ).every((row) => row.total === 0 || row.total === 10),
      name,
    ).toBe(true);
});

it("adds Gate Breaker's Strength modifier to object damage only under its Situation", () => {
  const [damage] = entry('Gate Breaker').modifiers;
  expect(damage).toMatchObject({
    target: 'damage',
    value: { formula: '@ability.str.mod' },
  });
  const sheet = reviewedFeatSheet('Gate Breaker');
  const strong = {
    ...sheet,
    catalogEntries: sheet.catalogEntries.map((row) =>
      row._id === 'base'
        ? {
            ...row,
            modifiers: row.modifiers.map((modifier) =>
              modifier.target === 'ability.str'
                ? { ...modifier, value: 14 }
                : modifier,
            ),
          }
        : row,
    ),
  };
  const scope = situation('Gate Breaker', 0, 'feat-row');
  expect(
    calculateCharacterSheetProjections(strong).current.breakdowns[
      'damage.melee'
    ].total,
  ).toBe(0);
  const projected = calculateCharacterSheetProjections(strong, {
    situations: [scope],
  }).current.breakdowns;
  expect([
    projected['damage.melee'].total,
    projected['damage.ranged'].total,
  ]).toEqual([2, 2]);
});

it('keeps choice, resource, metamagic, mythic-tier, recipient and cover bodies off holder totals', () => {
  for (const name of [
    'Courage in Numbers',
    'Duck and Cover',
    'Channel Smite (Mythic)',
    'Tripping Staff (Mythic)',
    'Improved Familiar (Mythic)',
    'Malleable Form',
    'Witty Feint',
    'One with the Land',
    'Unbound Bravery',
    'Skilled Driver',
    "Murderer's Circle",
    'Second Wind',
    'Burning Spell',
    'Sickening Spell',
    'Concilator',
    'Banner of Doom',
  ]) {
    expect(modifiers(name), name).toEqual([]);
    expect(entry(name).situationalNotes?.[0]?.text, name).toBeTruthy();
    expect(
      candidate(name).mechanicsReview.outstandingCalculations.length,
      name,
    ).toBeGreaterThan(0);
  }
  expect(
    candidate('Duck and Cover').mechanicsReview.outstandingCalculations[0],
  ).toContain('Cover bonus type is absent');
  // #724: each Skill Focus has one automatic Modifier instead of two.
  expect(preview.entries.flatMap((row) => row.modifiers)).toHaveLength(30);
  expect(
    preview.entries.filter((row) => row.modifiers.length > 0),
  ).toHaveLength(20);
  expect(
    preview.entries.flatMap((row) =>
      row.modifiers.filter((modifier) =>
        ['casterLevel', 'spellDC', 'hp'].includes(modifier.target),
      ),
    ),
  ).toEqual([]);
  // Line breaks and labelled paragraphs stay readable in the reviewed Notes.
  expect(entry('Shield Brace').situationalNotes?.[0]?.text).toContain(
    '(See page 19.)\nPathfinder Society\nWhen using the Shield Brace feat',
  );
});

it('records inherited-rule notices, alternate versions and enforced notice holds without inventing attribution', () => {
  const tricks = [
    ['Deadly Finish', 'PZO1131'],
    ['Gruesome Slaughter', 'PZO1131'],
    ['Secured Armor', 'PZO9467'],
    ['Adder Strike', 'PZO1131'],
    ['Gang Up', 'PZO1131'],
    ['Kirin Style', 'PZO1131'],
    ['Passing Trick', 'PZO1131'],
    ['Trick Riding', 'PZO1131'],
    ['Shield Brace', 'PZO9467'],
    ['Snap Shot', 'PZO1131'],
    ['Counterpunch', 'PZO1131'],
    ['Barroom Brawler', 'PZO1131'],
    ['Aldori Dueling Disciple', 'PZO9463'],
    ['Cushioning Shield', 'PZO9467'],
  ] as const;
  for (const [name, book] of tricks) {
    expect(candidate(name).requiredNotices, name).toContain('PZO1131');
    expect(candidate(name).requiredNotices, name).toContain(book);
    expect(entry(name).description, name).toContain('stamina');
    const trick = candidate(name).inheritedRuleComparisonEvidence.find((row) =>
      row.literalRow.includes('KEY:Combat Trick ~ '),
    );
    expect(trick, name).toMatchObject({
      evidenceRole: 'inherited-rule-comparison',
      appliesToRootBody: false,
      book,
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
  // PCGen files Aldori Dueling Disciple's trick under Weapon Master's Handbook.
  expect(candidate('Aldori Dueling Disciple').requiredNotices).toEqual([
    'PZO1138',
    'PZO9463',
    'PZO1131',
    'PZO1110',
  ]);
  for (const [name, base] of [
    ['Channel Smite (Mythic)', null],
    ['Improved Familiar (Mythic)', null],
    ['Deadly Stroke (Mythic)', null],
    ['Tripping Staff (Mythic)', 'PZO1117'],
    ['Strong Comeback (Mythic)', 'PZO1118'],
    ['Accursed Hex (Mythic)', 'PZO1117'],
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
    ['Fox Shape', 'PZO1120'],
    ['Tactical Reposition', 'PZO1115'],
    ['Concilator', 'PZO1134'],
    ['Concilator', 'PZO1125'],
    ["Lamashtu's Mark", 'PZO1002'],
    ["Lamashtu's Mark", 'PZO1112'],
    ['Consume Undeath', 'PZO1112'],
    ['Kinetic Counter', 'PZO1132'],
    ['Fatiguing Stare', 'PZO1132'],
    ['Ascetic Strike', 'PZO1129'],
    ['Ascetic Strike', 'PZO1118'],
    ['Barroom Brawler', 'PZO1129'],
    ['Banner of Doom', 'PZO1115'],
    ['Exploit Lore', 'PZO1115'],
    ['Deft Catcher', 'PZO1115'],
    ['Totemic Initiate', 'PZO1115'],
    ['Cloak and Dagger Subterfuge', 'PZO1115'],
    ['Illusive Gnome Style', 'PZO1118'],
    ['Dolphin Style', 'PZO1118'],
    ['Cudgeler Style', 'PZO1118'],
    ['Kyton Shield', 'PZO1118'],
    ['Tatzlwyrm Rake', 'PZO1118'],
    ['Recall Ammunition', 'PZO1118'],
    ['Second Wind', 'PZO1118'],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  // Pinned pf1 race records name the books of the racial rules these bodies extend.
  for (const [name, path, book] of [
    ['Fox Shape', 'packs/races/kitsune.GAoJIy6ycj3OovQT.yaml', 'PZO9280'],
    ['Noxious Touch', 'packs/races/grippli.MSLlV9YnompTd6xp.yaml', 'PZO9280'],
  ] as const) {
    expect(
      candidate(name).inheritedRuleNotices.find((row) =>
        row.location.endsWith(path),
      )?.book,
      name,
    ).toBe(book);
    expect(candidate(name).requiredNotices, name).toContain(book);
  }
  expect(
    candidate('Consume Undeath').inheritedRuleComparisonEvidence[0]?.literalRow,
  ).toMatch(/^Death-Stealing Gaze\tKEY:Nabasu ~ Death-Stealing Gaze\t/);
  // Rejected versions' books are not required; the body follows the root.
  for (const [name, root, rejected] of [
    ['Reject Poison', 'PZO9267', 'PZO9420'],
    ['Branch Pounce', 'PZO1140', 'PZO9456'],
    ['Cold Celerity', 'PZO1138', 'PZO9428'],
    ['Aldori Dueling Disciple', 'PZO1138', 'PZO9268'],
  ] as const) {
    expect(candidate(name).comparison?.book, name).toBe(root);
    expect(
      candidate(name).rejectedRootComparisonEvidence.map((row) => row.book),
      name,
    ).toEqual([rejected]);
    expect(candidate(name).requiredNotices, name).not.toContain(rejected);
  }
  expect(candidate('Cold Celerity').comparison?.literalRow).toContain(
    'you gain the bonus on attack rolls for 1 round after any round in which you take cold damage',
  );
  expect(candidate('Spirit Rebuke').comparison?.literalRow.split('\t')[0]).toBe(
    'Spirit Rebuke (Fey)',
  );
  expect(
    candidate('Spirit Rebuke').additionalComparisonLeads.map(
      (row) => row.literalRow.split('\t')[0],
    ),
  ).toEqual(['Spirit Rebuke (Undead)', 'Spirit Rebuke (Outsiders)']);
  expect(candidate('Concilator').comparison?.literalRow).toMatch(
    /^Conciliator\t/,
  );
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
        : [`feats-363-whole-content-${row.externalKey.split('/')[1]}`],
    );
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices
        .filter((book) => book !== 'PZO1110')
        .map((book) => `feats-363-notice-${book}-complete-chain`),
    );
  }
});

it('retains recorded parser findings and checks current bounded or advisory clauses', () => {
  const kinds = (name: string) =>
    entry(name).prerequisites?.map((atom) =>
      'kind' in atom ? atom.kind : 'anyOf',
    );
  expect(kinds('Secured Armor')).toEqual([
    'anyOf',
    'classFeature',
    'unchecked',
  ]);
  expect(kinds('Kinetic Counter')).toEqual(['unchecked', 'unchecked']);
  expect(kinds('Counterpunch')).toEqual([
    'ability',
    'feat',
    'feat',
    'feat',
    'anyOf',
  ]);
  expect(kinds('Monster Spotter')).toEqual(['unchecked', 'unchecked']);
  expect(kinds('Ledge Walker')).toEqual(['ability', 'race', 'unchecked']);
  for (const [name, gap] of [
    ['Secured Armor', 'magus Heavy Armor class feature'],
    ['Kinetic Counter', 'three unchecked fragments'],
    ['Heroic Leader', 'split at commas'],
    ['Shield Brace', 'split at commas'],
    ['Passing Trick', 'split at "or"'],
    ['Monster Spotter', 'without the Knowledge choice'],
    ['Counterpunch', 'without the unarmed strike choice'],
    ['Unbound Bravery', "fighter's Bravery only"],
    ['Gang Up', 'waiver of the Intelligence 13 prerequisite'],
    ['Wheeling Charge', 'pinned Mounted Combat feat exists'],
    ['Trick Riding', 'pinned Mounted Combat feat exists'],
    ['Cold Celerity', 'pinned Endurance feat exists'],
    ['Second Wind', 'pinned Endurance feat exists'],
    ['Ascetic Strike', '"Weapon Focus with the chosen weapon"'],
    ['Cloak and Dagger Subterfuge', '"Weapon Focus with the chosen weapon"'],
    ['Brewmaster', '"Craft (alchemy) 1 rank"'],
  ] as const)
    expect(
      recordedPrerequisiteFacts({
        batch: 'feats-363',
        candidate: candidate(name),
      }),
      name,
    ).toEqual(expect.arrayContaining([expect.stringContaining(gap)]));
  for (const name of [
    'Additional Affiliations',
    'Spirit Rebuke',
    'Unfettered Familiar',
    'Skill Focus (Use Magic Device)',
    'Skill Focus (Diplomacy)',
    'Skill Focus (Knowledge [Planes])',
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
  // The Gang Up body equals its Advanced Player's Guide benefit.
  expect(candidate('Gang Up').comparison?.literalRow).toContain(
    'BENEFIT:You are considered to be flanking an opponent if at least two of your allies are threatening that opponent, regardless of your actual positioning.',
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
    const gate = assessCatalogAdmission({
      artifact: authoritative,
      ...reviewedAdmission,
    });
    expect(gate.admitted.map((row) => row.name).sort()).toEqual(admittedNames);
    expect(gate.held).toHaveLength(97);
    expect(gate.dependentOmissions).toEqual([]);
    expect(gate.failures).toEqual([]);
    for (const row of gate.held)
      expect(row.reason, row.name).toMatch(/^feats-363-whole-content-/);
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
      return assessCatalogAdmission({
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
    const device = entry('Skill Focus (Use Magic Device)');
    const edited = assessCatalogAdmission({
      artifact: {
        ...authoritative,
        catalog: {
          ...authoritative.catalog,
          entries: authoritative.catalog.entries.map((row) =>
            row.externalKey === device.externalKey
              ? { ...row, modifiers: row.modifiers.slice(1) }
              : row,
          ),
        },
      },
      ...reviewedAdmission,
    });
    expect(edited.admitted.map((row) => row.name).sort()).toEqual(
      admittedNames.filter((name) => name !== device.name),
    );
    // Confirming a held body still holds it on its held notices.
    const mark = confirm("Lamashtu's Mark");
    expect(mark.admitted.map((row) => row.name).sort()).toEqual(admittedNames);
    expect(
      mark.held.find((row) => row.name === "Lamashtu's Mark")?.reason,
    ).toMatch(/Notice holds|Missing or unreviewed required notices/);
    // A no-row body that needs only the reviewed CRB notice is kept out only
    // by its unresolved whole-content assessment; the admitted bodies stay.
    expect(candidate('Gate Breaker').requiredNotices).toEqual(['PZO1110']);
    expect(
      confirm('Gate Breaker')
        .admitted.map((row) => row.name)
        .sort(),
    ).toEqual([...admittedNames, 'Gate Breaker'].sort());
  } finally {
    await tree.dispose();
  }
});
