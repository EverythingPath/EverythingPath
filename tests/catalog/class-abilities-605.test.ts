// @vitest-environment node
import { expect, it } from 'vitest';
import {
  describeIncrementParent,
  expectIncrementParentFacts,
  LEVELS,
  scheduleValues,
  WAVE_F1_REVIEWED_ON,
} from './class-abilities-596';

// #605, MVP launch subset (#605 wave C): Smite Evil, Inspire Competence and
// Ki Pool, admitted with their six, four and three increments. Wave F1 adds
// Bonus Feats (WIZ) and its three increments once its linked Spell Mastery
// (feats-331) is admitted.
const smite = describeIncrementParent({
  batch: 605,
  key: 'pf1/2TsDfK0SKC8IGVx4',
  name: 'Smite Evil',
  books: ['PZO1110'],
  classes: ['pf1/ohptcds1d5oG6Bjh'],
  prdExact: false,
});
const competence = describeIncrementParent({
  batch: 605,
  key: 'pf1/2M56kfIOws5yYtxq',
  name: 'Inspire Competence',
  books: ['PZO1110'],
  classes: ['pf1/6GjOjO6r3R06fLwE'],
  prdExact: false,
});
const kiPool = describeIncrementParent({
  batch: 605,
  key: 'pf1/2Og23i3rRXu5QQlg',
  name: 'Ki Pool',
  books: ['PZO1110'],
  classes: ['pf1/W8dxwZ1CZiwLKsqr'],
  prdExact: false,
});

it('adds no Smite Evil Note, requires PZO1131 for its action, and adds a use at 4th and every three levels', () => {
  expectIncrementParentFacts({ ...smite, notes: 'none' });
  expect(smite.entry.sources).toEqual([]);
  expect(smite.candidate.requiredNotices).toEqual(['PZO1110', 'PZO1131']);
  expect(scheduleValues(smite.candidate)).toEqual(
    LEVELS.map((level) => 1 + Math.floor((level - 1) / 3)),
  );
});

it('adds no Inspire Competence Note and raises the bonus from +2 at 3rd by 1 every four levels', () => {
  expectIncrementParentFacts({ ...competence, notes: 'none' });
  expect(scheduleValues(competence.candidate)).toEqual(
    LEVELS.map((level) => (level < 3 ? 0 : 2 + Math.floor((level - 3) / 4))),
  );
});

it('adds no Ki Pool Note, requires PZO1131 for its action, and adds ki strike steps at 4th, 7th, 10th and 16th', () => {
  expectIncrementParentFacts({ ...kiPool, notes: 'none' });
  expect(kiPool.candidate.requiredNotices).toEqual(['PZO1110', 'PZO1131']);
  expect(scheduleValues(kiPool.candidate)).toEqual(
    LEVELS.map((level) =>
      level < 4 ? 0 : [4, 7, 10, 16].filter((step) => level >= step).length,
    ),
  );
});

const wizard = describeIncrementParent({
  batch: 605,
  key: 'pf1/2h3lI574tmVjOalQ',
  name: 'Bonus Feats (WIZ)',
  books: ['PZO1110'],
  classes: ['pf1/0c4lYDywj6bQ0i8r'],
  prdExact: false,
  reviewedOn: WAVE_F1_REVIEWED_ON,
});

it('adds no Bonus Feats (WIZ) Note, requires PZO1117 for its arcane discovery option, and gives a feat every five levels', () => {
  expectIncrementParentFacts({
    ...wizard,
    notes: 'none',
    unmappedTargets: ['bonusFeats'],
  });
  expect(wizard.candidate.requiredNotices).toEqual(['PZO1110', 'PZO1117']);
  expect(wizard.closure.map((row) => row.name)).toEqual(['Spell Mastery']);
  expect(scheduleValues(wizard.candidate)).toEqual(
    LEVELS.map((level) => Math.floor(level / 5)),
  );
});
