// @vitest-environment node
import { expect, it } from 'vitest';
import {
  describeIncrementParent,
  expectIncrementParentFacts,
  LEVELS,
  scheduleValues,
} from './class-abilities-596';

// #629, MVP launch subset (#617 wave B): Discovery (Alchemist) and Favored
// Enemy (Ranger), each admitted with its schedule increments.
const discovery = describeIncrementParent({
  batch: 629,
  key: 'pf1/Xcim6WFtAtxJxnmA',
  name: 'Discovery',
  books: ['PZO1115'],
  classes: ['pf1/JcaqlAawhf14q1lq'],
  prdExact: false,
});
const enemy = describeIncrementParent({
  batch: 629,
  key: 'pf1/XmALhWqXdN9yOmtd',
  name: 'Favored Enemy',
  books: ['PZO1110'],
  classes: ['pf1/w3wjj6s3N69BsMc3'],
  prdExact: true,
});

it('adds no Discovery Note and gives a discovery at every even level to 18th', () => {
  expectIncrementParentFacts({ ...discovery, notes: 'none' });
  expect(scheduleValues(discovery.candidate)).toEqual(
    LEVELS.map((level) => Math.min(Math.floor(level / 2), 9)),
  );
});

it('adds no Favored Enemy Note and gives a favored enemy at 1st and every five levels', () => {
  expectIncrementParentFacts({ ...enemy, notes: 'none' });
  expect(scheduleValues(enemy.candidate)).toEqual(
    LEVELS.map((level) => 1 + Math.floor(level / 5)),
  );
});
