// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import {
  reviewedScheduleSlots,
  scheduleSlotRules,
} from '../../scripts/catalog/pcgen/schedule-slots';
import {
  bodyParagraphs,
  describeIncrementParent,
  describeLaunchFeature,
  expectIncrementParentFacts,
  LEVELS,
  prdText,
  formulaAt,
  recordModifiers,
  RUN_B_REVIEWED_ON,
  scheduleValues,
  WAVE_E_REVIEWED_ON,
} from './class-abilities-596';

// #613, MVP launch subset (#596 run B): Bonus Feats, admitted. Its ten
// everythingpath/fighter-bonus-feats-N increments take its assessment
// through attributionFrom.
const { candidate, entry } = describeLaunchFeature({
  batch: 613,
  name: 'Bonus Feats (FGT)',
  disposition: 'admitted',
  reviewedOn: RUN_B_REVIEWED_ON,
});

const SLOT = { kind: 'feat', count: 1, featTypes: ['Combat'] };
const INCREMENTS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20].map(
  (level) => `everythingpath/fighter-bonus-feats-${level}`,
);

it("gives the 1st-level acquisition one Combat feat slot, from the reviewed slot rule, and leaves Foundry's bonusFeats change unmapped", () => {
  expect(entry.grantsSlots).toEqual([SLOT]);
  expect(reviewedScheduleSlots().get(candidate.externalKey)).toEqual(SLOT);
  expect(
    scheduleSlotRules.find((rule) => rule.className === 'Fighter'),
  ).toEqual({
    className: 'Fighter',
    feature: 'bonus-feats',
    featTypes: ['Combat'],
    printed: 'coreRulebook/classes/fighter.html:380',
  });
  // Foundry's own count contributes nothing, so no slot is doubled.
  expect(entry.modifiers).toEqual([]);
  expect(entry.unsupported).toContainEqual({
    field: 'changes',
    reason:
      'Unmapped target, bonus type, formula or calculation-stage dependency; contributes nothing.',
    value: {
      target: 'bonusFeats',
      formula: '1 + floor(@class.level / 2)',
      type: 'untyped',
    },
  });
});

it('admits the ten increments with Bonus Feats, each with its own Combat slot, so a 20th-level Fighter has 11', () => {
  // The Fighter's committed full-corpus closure (classes-596) holds them.
  const { closure } = JSON.parse(
    readFileSync('tests/fixtures/classes-596/preview.json', 'utf8'),
  ) as {
    closure: {
      externalKey: string;
      upstreamKey: string;
      attributionFrom?: string;
      grantsSlots?: unknown[];
      detail: { parentFeature?: string };
    }[];
  };
  const increments = closure.filter(
    (row) => row.attributionFrom === candidate.externalKey,
  );
  expect(increments.map((row) => row.externalKey)).toEqual(
    expect.arrayContaining(INCREMENTS),
  );
  expect(increments).toHaveLength(10);
  for (const row of increments) {
    expect(row.upstreamKey).toBe(candidate.externalKey);
    expect(row.detail.parentFeature).toBe(candidate.externalKey);
    expect(row.grantsSlots).toEqual([SLOT]);
  }
  // Bonus feats by level: 1 + floor(level / 2), one more at 1st and each even level.
  const schedule = candidate.mechanicsReview.classFeatureReview.schedule;
  expect(schedule.map((row) => row.value)).toEqual(
    schedule.map((row) => 1 + Math.floor(row.level / 2)),
  );
  expect(
    schedule
      .filter((row, index) => row.value !== (schedule[index - 1]?.value ?? 0))
      .map((row) => row.level),
  ).toEqual([1, ...INCREMENTS.map((key) => Number(key.split('-').at(-1)))]);
  expect(schedule.at(-1)?.value).toBe(1 + increments.length);
  // PCGen grants the same count: BONUS:ABILITYPOOL|Fighter Bonus Feat|FighterLvl/2+1.
  expect(candidate.comparison.literalRow).toContain(
    'BONUS:ABILITYPOOL|Fighter Bonus Feat|FighterLvl/2+1',
  );
});

it('states the retraining rule as a Note and checks both paragraphs against the PRD', () => {
  const paragraphs = bodyParagraphs(candidate.mechanicsReview.descriptionText);
  const prd = candidate.prdComparison.lines.map((row) =>
    prdText(row.text).replace(/^Bonus Feats: /, ''),
  );
  expect(paragraphs[0]?.replace('Combat Feats', 'combat feats')).toBe(
    prd[0]?.replaceAll('&quot;', '"'),
  );
  expect(paragraphs[1]).toBe(prd[1]);
  // The first paragraph is the slots; retraining stays prose.
  expect(entry.situationalNotes?.map((note) => note.text)).toEqual([
    paragraphs[1],
  ]);
  expect(
    candidate.mechanicsReview.outstandingCalculations.map((row) => row.owner),
  ).toEqual(['#716', '#313']);
});

// #631 wave A adds Fast Movement (MNK), admitted with its ten monk and
// unchained monk increments.
const fast = describeIncrementParent({
  batch: 613,
  key: 'pf1/CK5L0YJDENqBxLqv',
  name: 'Fast Movement (MNK)',
  books: ['PZO1110', 'PZO1131'],
  classes: ['pf1/W8dxwZ1CZiwLKsqr', 'pf1/5mQIOIw4hDhlREPo'],
  prdExact: false,
});

it('adds no Fast Movement Note, its table being the increments, and leaves the landSpeed change unmapped', () => {
  expectIncrementParentFacts({
    ...fast,
    notes: 'none',
    unmappedTargets: ['landSpeed'],
  });
  expect(scheduleValues(fast.candidate)).toEqual(
    LEVELS.map((level) => 10 * Math.floor(level / 3)),
  );
});

// #619 wave E (contextNotes) adds Trap Sense, admitted with its fifteen
// barbarian, rogue and investigator increments; its two Foundry notes have
// checked note records.
const trap = describeIncrementParent({
  batch: 613,
  key: 'pf1/BoEkMviJrW0PKmhj',
  name: 'Trap Sense',
  books: ['PZO1110', 'PZO1129'],
  classes: [
    'pf1/g3pq7xWWdUVYw6ai',
    'pf1/24b0LaabeAlUx5gN',
    'pf1/s27zdYVFenYBVtfu',
  ],
  prdExact: false,
  reviewedOn: WAVE_E_REVIEWED_ON,
  noteRecords: 2,
});

const TRAP_FORMULA =
  'floor(@classLevel.barbarian / 3) + floor(@classLevel.rogue / 3) + floor(@classLevel.investigator / 3)';

it('applies its Reflex and dodge AC bonuses vs. traps, +1 at 3rd to +6 at 18th, stacking across its classes', () => {
  const situation = { local: 'vs. traps' };
  const modifiers = [
    {
      target: 'save.ref',
      bonusType: 'untyped',
      value: { formula: TRAP_FORMULA },
      condition: { situation },
    },
    {
      target: 'ac',
      bonusType: 'dodge',
      value: { formula: TRAP_FORMULA },
      condition: { situation },
    },
  ];
  expect(recordModifiers(trap.candidate)).toEqual(modifiers);
  expectIncrementParentFacts({ ...trap, notes: 'none', modifiers });
  const schedule = scheduleValues(trap.candidate);
  expect(schedule).toEqual(LEVELS.map((level) => Math.floor(level / 3)));
  for (const level of LEVELS)
    for (const tag of ['barbarian', 'rogue', 'investigator'])
      expect(formulaAt(TRAP_FORMULA, { [tag]: level })).toBe(
        schedule[level - 1],
      );
  // "Trap sense bonuses gained from multiple classes stack."
  expect(trap.candidate.mechanicsReview.descriptionText).toContain(
    'Trap sense bonuses gained from multiple classes stack.',
  );
  expect(formulaAt(TRAP_FORMULA, { barbarian: 6, rogue: 4 })).toBe(3);
  // The Unchained classes (danger sense) add nothing.
  expect(
    formulaAt(TRAP_FORMULA, { barbarianUnchained: 9, rogueUnchained: 9 }),
  ).toBe(0);
});
