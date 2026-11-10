import { expect, test } from 'vitest';
import {
  describeClass,
  listAlternatives,
  ordinal,
} from './character-sheet-spell-labels';

test.each([
  [0, '0th'],
  [1, '1st'],
  [2, '2nd'],
  [3, '3rd'],
  [4, '4th'],
  [9, '9th'],
  [11, '11th'],
  [12, '12th'],
  [13, '13th'],
  [21, '21st'],
  [22, '22nd'],
  [111, '111th'],
])('ordinal %i reads %s', (level, expected) => {
  expect(ordinal(level)).toBe(expected);
});

test.each([
  [[], ''],
  [['bite'], 'bite'],
  [['bite', 'sting'], 'bite or sting'],
  [['angel', 'archon', 'azata'], 'angel, archon or azata'],
])('alternatives %j read %s', (names, expected) => {
  expect(listAlternatives(names)).toBe(expected);
});

test('a class reads its own name, else its tag in words', () => {
  const names: Record<string, string> = { summoner: 'Summoner (sheet)' };
  const find = (classTag: string) => names[classTag] ?? null;
  expect(describeClass('summoner', find)).toBe('Summoner (sheet)');
  expect(describeClass('wizard', find)).toBe('Wizard');
  expect(describeClass('mysticTheurge', find)).toBe('Mystic theurge');
  expect(describeClass('summonerUnchained', find)).toBe('Unchained summoner');
});
