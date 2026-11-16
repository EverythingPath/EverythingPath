import { expect, test } from 'vitest';
import { describeModifier } from './modifier-labels';

test('describes the Skill Focus rank threshold in words, not as its formula', () => {
  // CRB p. 134: +3, or +6 with 10 or more ranks in the chosen skill (#724).
  expect(
    describeModifier({
      target: 'skill.spl',
      bonusType: 'untyped',
      value: { formula: '3 + 3 * min(1, floor(@skillRanks.spl / 10))' },
    }),
  ).toBe('+3 to Spellcraft; +6 with 10 or more ranks');
  expect(
    describeModifier({
      target: 'skill.prf',
      bonusType: 'untyped',
      value: { formula: '3 + 3 * min(1, floor(@skillRanks.prf / 10))' },
    }),
  ).toBe('+3 to Perform; +6 with 10 or more ranks');
});

test("keeps other formulas, and a threshold on another skill's ranks, as written", () => {
  expect(
    describeModifier({
      target: 'skill.clm',
      bonusType: 'untyped',
      value: { formula: '3 + 3 * min(1, floor(@skillRanks.spl / 10))' },
    }),
  ).toBe('3 + 3 * min(1, floor(@skillRanks.spl / 10)) to Climb');
  expect(
    describeModifier({
      target: 'skill.int',
      bonusType: 'untyped',
      value: { formula: '@ability.str.mod' },
    }),
  ).toBe('@ability.str.mod to Intimidate');
  expect(
    describeModifier({ target: 'init', bonusType: 'untyped', value: 4 }),
  ).toBe('+4 to Initiative');
});
