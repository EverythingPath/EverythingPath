// @vitest-environment node
import { expect, it } from 'vitest';
import {
  describeIncrementParent,
  expectIncrementParentFacts,
  LEVELS,
  scheduleValues,
} from './class-abilities-596';

// #631, MVP launch subset (#631 wave A): Mystery and Slayer Talents, each
// admitted with its nine increments. Unarmed Strike stays remaining
// acceptance (dependently omitted on held linked entries).
const mystery = describeIncrementParent({
  batch: 631,
  key: 'pf1/ZhQM4K4dqStS6qRn',
  name: 'Mystery',
  books: ['PZO1115'],
  classes: ['pf1/5S0u8yFcP861wgd1'],
  prdExact: true,
});
const talents = describeIncrementParent({
  batch: 631,
  key: 'pf1/Zn9ecDCXShBK4vj8',
  name: 'Slayer Talents',
  books: ['PZO1129'],
  classes: ['pf1/cOY76lMUkupH534m'],
  prdExact: false,
});

it('adds no Mystery Note and gives a mystery spell at every even level to 18th', () => {
  expectIncrementParentFacts({ ...mystery, notes: 'none' });
  expect(mystery.entry.sources).toEqual([]);
  expect(scheduleValues(mystery.candidate)).toEqual(
    LEVELS.map((level) => Math.min(Math.floor(level / 2), 9)),
  );
});

it('adds no Slayer Talents Note, since Extra Slayer Talent (#332) reaches it, and gives a talent at every even level', () => {
  expectIncrementParentFacts({ ...talents, notes: 'none' });
  expect(scheduleValues(talents.candidate)).toEqual(
    LEVELS.map((level) => Math.floor(level / 2)),
  );
  expect(talents.inventory.launchSubset.remainingAcceptance).toContain(
    'pf1/a4SPdPuOFdmfJdHN',
  );
});
