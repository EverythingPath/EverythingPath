// @vitest-environment node
import { expect, it } from 'vitest';
import {
  describeIncrementParent,
  expectIncrementParentFacts,
  LEVELS,
  scheduleValues,
} from './class-abilities-596';

// #628, MVP launch subset (#617 wave B): Challenge (Cavalier), Sneak Attack
// (Slayer) and Bloodline Feat (Sorcerer), each admitted with its schedule
// increments. Bonus Feat (MNK) stays remaining acceptance (dependently
// omitted on held linked entries).
const challenge = describeIncrementParent({
  batch: 628,
  key: 'pf1/WNi2SBF6Z2zhBMCl',
  name: 'Challenge (CAV)',
  books: ['PZO1115'],
  classes: ['pf1/u1ed3H9xtYQXTP5v'],
  prdExact: true,
});
const sneak = describeIncrementParent({
  batch: 628,
  key: 'pf1/Wl3FUflcmvQP0PaQ',
  name: 'Sneak Attack (SLA)',
  books: ['PZO1129'],
  classes: ['pf1/cOY76lMUkupH534m'],
  prdExact: false,
});
const feat = describeIncrementParent({
  batch: 628,
  key: 'pf1/W1KWAZxUNxfCv8rG',
  name: 'Bloodline Feat (SOR)',
  books: ['PZO1110'],
  classes: ['pf1/AoWSbnuTSGIxmv61'],
  prdExact: true,
});

it('adds no Challenge Note, requires PZO1131 for its Unchained action metadata and gives one more use every three levels', () => {
  expectIncrementParentFacts({ ...challenge, notes: 'none' });
  expect(challenge.entry.sources).toEqual([]);
  expect(challenge.candidate.requiredNotices).toEqual(['PZO1115', 'PZO1131']);
  expect(scheduleValues(challenge.candidate)).toEqual(
    LEVELS.map((level) => 1 + Math.floor((level - 1) / 3)),
  );
});

it('adds no Sneak Attack Note, requires PZO1131 for its Unchained action metadata and adds 1d6 every three levels', () => {
  expectIncrementParentFacts({ ...sneak, notes: 'none' });
  expect(sneak.candidate.requiredNotices).toEqual(['PZO1129', 'PZO1131']);
  expect(scheduleValues(sneak.candidate)).toEqual(
    LEVELS.map((level) => Math.floor(level / 3)),
  );
});

it("adds no Bloodline Feat Note, leaves Foundry's bonusFeats change unmapped and gives a feat at 7th, 13th and 19th", () => {
  expectIncrementParentFacts({
    ...feat,
    notes: 'none',
    unmappedTargets: ['bonusFeats'],
  });
  expect(scheduleValues(feat.candidate)).toEqual(
    LEVELS.map((level) => (level < 7 ? 0 : 1 + Math.floor((level - 7) / 6))),
  );
  expect(feat.inventory.launchSubset.remainingAcceptance).toContain(
    'pf1/VjHjPja5QABBgRvR',
  );
});
