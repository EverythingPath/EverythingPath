import { expect, test } from 'vitest';
import {
  decodeTargetChoice,
  encodeTargetChoice,
  isSameTargetChoice,
  noTarget,
  toTargetChoice,
  type TargetChoice,
} from './spell-effect-target-choice';

test.each<TargetChoice>([
  noTarget,
  { kind: 'part', entry: 'sword-row', end: null },
  { kind: 'part', entry: 'hammer-row', end: 'otherEnd' },
  { kind: 'part', entry: 'shield-row', end: 'bash' },
  { kind: 'part', entry: 'unarmed', end: null },
])('a target choice survives the select value: %o', (choice) => {
  const decoded = decodeTargetChoice(encodeTargetChoice(choice));
  expect(decoded).toEqual(choice);
  expect(decoded && isSameTargetChoice(decoded, choice)).toBe(true);
});

test('a value no choice encodes decodes to nothing', () => {
  for (const value of ['', '|', 'sword-row', 'sword-row|grip'])
    expect(decodeTargetChoice(value)).toBeNull();
});

test('a recorded target is a part choice; none is no target', () => {
  expect(toTargetChoice(null)).toEqual(noTarget);
  const sword = toTargetChoice({ entry: 'sword-row', end: null });
  expect(sword).toEqual({ kind: 'part', entry: 'sword-row', end: null });
  expect(isSameTargetChoice(sword, noTarget)).toBe(false);
  expect(
    isSameTargetChoice(sword, {
      kind: 'part',
      entry: 'sword-row',
      end: 'bash',
    }),
  ).toBe(false);
});
