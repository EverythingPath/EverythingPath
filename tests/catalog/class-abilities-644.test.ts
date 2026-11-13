// @vitest-environment node
import { expect, it } from 'vitest';
import {
  describeIncrementParent,
  expectIncrementParentFacts,
  LEVELS,
  scheduleValues,
  WAVE_F2_REVIEWED_ON,
} from './class-abilities-596';

// #644, MVP launch subset (#628 wave F2): Wild Shape, admitted with its eight
// increments once the ten shape Spells it functions as are.
const wildShape = describeIncrementParent({
  batch: 644,
  key: 'pf1/sJdBOE9lwz5XAkUi',
  name: 'Wild Shape',
  books: ['PZO1110'],
  classes: ['pf1/7eZQP0MzeO2svmVF'],
  prdExact: false,
  reviewedOn: WAVE_F2_REVIEWED_ON,
});

it('adds no Wild Shape Note, requires the shape Spells’ monster-ability books (PZO1112, PZO1116, PZO1127) and PZO1131, and gives one more use every two levels to at will at 20th', () => {
  expectIncrementParentFacts({ ...wildShape, notes: 'none' });
  // The beast shape, elemental body and plant shape forms it functions as
  // grant Bestiary, Bestiary 2 and Bestiary 4 monster abilities; its own
  // action keeps Unchained action metadata.
  expect(wildShape.candidate.requiredNotices).toEqual([
    'PZO1110',
    'PZO1112',
    'PZO1116',
    'PZO1127',
    'PZO1131',
  ]);
  expect(wildShape.closure.map((row) => row.name).sort()).toEqual([
    'Beast Shape I',
    'Beast Shape II',
    'Beast Shape III',
    'Elemental Body I',
    'Elemental Body II',
    'Elemental Body III',
    'Elemental Body IV',
    'Plant Shape I',
    'Plant Shape II',
    'Plant Shape III',
  ]);
  // 9 stands for at will (20th level).
  expect(scheduleValues(wildShape.candidate)).toEqual(
    LEVELS.map((level) =>
      level < 4
        ? 0
        : level === 20
          ? 9
          : Math.min(Math.floor((level - 2) / 2), 8),
    ),
  );
  expect(wildShape.increments.map((row) => row.name)).toEqual([
    'Wild Shape (4/day)',
    'Wild Shape (5/day)',
    'Wild Shape (6/day)',
    'Wild Shape (7/day)',
    'Wild Shape (8/day)',
    'Wild Shape (at will)',
    'Wild Shape (2/day)',
    'Wild Shape (3/day)',
  ]);
});
