// @vitest-environment node
import { expect, it } from 'vitest';
import {
  describeIncrementParent,
  expectIncrementParentFacts,
  LEVELS,
  scheduleValues,
  WAVE_F1_REVIEWED_ON,
} from './class-abilities-596';

// #633, MVP launch subset (#631 wave F1): Summon Monster, admitted with its
// nine increments once its linked summon monster I, summon monster IX and
// gate are.
const summon = describeIncrementParent({
  batch: 633,
  key: 'pf1/caNEmbCtoHA7NYtZ',
  name: 'Summon Monster',
  books: ['PZO1115'],
  classes: ['pf1/BrnHPJ2EVSQSyNQ8'],
  prdExact: false,
  reviewedOn: WAVE_F1_REVIEWED_ON,
});

it('adds no Summon Monster Note, requires the Spells’ books (PZO1110, PZO1112) and PZO1131, and raises the spell level every odd level to gate at 19th', () => {
  expectIncrementParentFacts({ ...summon, notes: 'none' });
  // Fix round 1: the Bestiary templates of the summon monster spells it
  // casts (summon monster I's PZO1112).
  expect(summon.candidate.requiredNotices).toEqual([
    'PZO1110',
    'PZO1112',
    'PZO1115',
    'PZO1131',
  ]);
  expect(summon.closure.map((row) => row.name).sort()).toEqual([
    'Gate',
    'Summon Monster I',
    'Summon Monster IX',
  ]);
  expect(scheduleValues(summon.candidate)).toEqual(
    LEVELS.map((level) => Math.min(10, Math.ceil(level / 2))),
  );
  expect(
    summon.increments.find(
      (row) => row.externalKey === 'everythingpath/summoner-summon-monster-19',
    )?.name,
  ).toBe('Gate');
});
