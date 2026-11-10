// @vitest-environment node
import { expect, it } from 'vitest';
import {
  describeIncrementParent,
  expectIncrementParentFacts,
  LEVELS,
  scheduleValues,
} from './class-abilities-596';

// #612, MVP launch subset (#605 wave C): Bloodrager Bloodline, admitted with
// its five bloodline-power increments.
const bloodline = describeIncrementParent({
  batch: 612,
  key: 'pf1/Aq9rx7oWgv7A7kiV',
  name: 'Bloodrager Bloodline',
  books: ['PZO1129'],
  classes: ['pf1/E27lMw9YNOAjS009'],
  prdExact: false,
});

it('adds no Note and gives a bloodline power at 1st, 4th and every 4 levels after', () => {
  expectIncrementParentFacts({ ...bloodline, notes: 'none' });
  expect(scheduleValues(bloodline.candidate)).toEqual(
    LEVELS.map((level) => 1 + Math.floor(level / 4)),
  );
});
