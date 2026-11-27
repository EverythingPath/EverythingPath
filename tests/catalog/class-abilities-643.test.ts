// @vitest-environment node
import { expect, it } from 'vitest';
import {
  describeIncrementParent,
  expectIncrementParentFacts,
  LEVELS,
  scheduleValues,
} from './class-abilities-596';

// #643, MVP launch subset (#631 wave A): Bloodline Spells (SOR) and
// Judgment, admitted with their eight and six increments.
const bloodline = describeIncrementParent({
  batch: 643,
  key: 'pf1/qlQxKPARGGdOgNWm',
  name: 'Bloodline Spells (SOR)',
  books: ['PZO1110'],
  classes: ['pf1/AoWSbnuTSGIxmv61'],
  prdExact: false,
});
const judgment = describeIncrementParent({
  batch: 643,
  key: 'pf1/qI4IouTn4uvDPSXv',
  name: 'Judgment',
  books: ['PZO1115'],
  classes: ['pf1/Fv3FbmXptuDRiL5y'],
  prdExact: true,
});

it('adds no Bloodline Spells Note, since races and racial traits reach it, and adds a spell known at 3rd and every odd level', () => {
  expectIncrementParentFacts({ ...bloodline, notes: 'none' });
  expect(scheduleValues(bloodline.candidate)).toEqual(
    LEVELS.map((level) => (level < 3 ? 0 : Math.floor((level - 1) / 2))),
  );
  // PCGen has no grant row: the bloodline bonus-spell record and its flags.
  expect(bloodline.candidate.comparison.literalRow).toMatch(
    /^Aberrant Bloodline ~ Bonus Spells\t/,
  );
});

it('adds no Judgment Note, requires PZO1131 for its action, and adds a use every three levels', () => {
  expectIncrementParentFacts({ ...judgment, notes: 'none' });
  expect(judgment.entry.sources).toEqual([]);
  expect(judgment.candidate.requiredNotices).toEqual(['PZO1115', 'PZO1131']);
  expect(scheduleValues(judgment.candidate)).toEqual(
    LEVELS.map((level) => 1 + Math.floor((level - 1) / 3)),
  );
});
