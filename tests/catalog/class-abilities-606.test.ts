// @vitest-environment node
import { expect, it } from 'vitest';
import {
  describeIncrementParent,
  expectIncrementParentFacts,
  formulaAt,
  LEVELS,
  recordModifiers,
  scheduleValues,
  WAVE_E_REVIEWED_ON,
} from './class-abilities-596';

// #606, MVP launch subset (#619 wave E, contextNotes): Poison Resistance,
// admitted with its four Alchemist and Investigator increments. Its Foundry
// note has a checked note record.
const poison = describeIncrementParent({
  batch: 606,
  key: 'pf1/2qcz39w9O2Qlms0Q',
  name: 'Poison Resistance',
  books: ['PZO1115', 'PZO1129'],
  classes: ['pf1/JcaqlAawhf14q1lq', 'pf1/s27zdYVFenYBVtfu'],
  prdExact: false,
  reviewedOn: WAVE_E_REVIEWED_ON,
  noteRecords: 1,
});

const FORMULA =
  'min(6, floor((max(@classLevel.alchemist, @classLevel.investigator) + 1) / 3) * 2)';

it('applies +2 at 2nd, +4 at 5th and +6 at 8th on all saves vs. poison, for the higher of its two classes', () => {
  const modifiers = [
    {
      target: 'saves',
      bonusType: 'untyped',
      value: { formula: FORMULA },
      condition: { situation: 'poison' },
    },
  ];
  expect(recordModifiers(poison.candidate)).toEqual(modifiers);
  expectIncrementParentFacts({ ...poison, notes: 'none', modifiers });
  const schedule = scheduleValues(poison.candidate);
  expect(schedule).toEqual(
    LEVELS.map((level) =>
      level < 2 ? 0 : Math.min(6, Math.floor((level + 1) / 3) * 2),
    ),
  );
  for (const level of LEVELS) {
    expect(formulaAt(FORMULA, { alchemist: level })).toBe(schedule[level - 1]);
    expect(formulaAt(FORMULA, { investigator: level })).toBe(
      schedule[level - 1],
    );
  }
  // The two classes' bonuses don't stack: the higher level counts.
  expect(formulaAt(FORMULA, { alchemist: 5, investigator: 2 })).toBe(4);
});
