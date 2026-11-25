import { expect, test } from 'vitest';
import { changedPhases } from './changed-phases';

test('target ownership distinguishes event candidates, persistent decisions and shared adjudication in display order', () => {
  expect(
    changedPhases([
      ['exception', 'choice'],
      ['upkeep', 'rolls', 'attrition'],
      ['slot', 'one', 'choice', 'candidates', 'event', 'persistentDecision'],
      ['slot', 'one', 'choice', 'candidates', 'event'],
      ['slot', 'one', 'choice', 'acknowledgements'],
      ['slot', 'two'],
      ['event', 'chanceRoll'],
      ['persistent', 'carried'],
      ['tableAdjustments'],
      ['acknowledgement', 'outcome'],
    ]),
  ).toEqual(['upkeep', 'activity', 'event', 'persistent', 'summary']);
  expect(changedPhases([['slot', 'one', 'choice', 'candidates']])).toEqual([
    'event',
  ]);
  expect(
    changedPhases([['event', 'tree', 'one', 'persistentDecision']]),
  ).toEqual(['persistent']);
  expect(
    changedPhases([['slot', 'one', 'choice', 'acknowledgements']]),
  ).toEqual(['summary']);
  expect(changedPhases([['unknown'], ['receipt', 'order'], []])).toEqual([]);
});
