import { expect, test } from 'vitest';
import { detectRemoteSheetChange } from './character-sheet-changes';

test('warning comparison ignores presentation order and leaves its inputs intact', () => {
  const expectedOperations = new Map([['one', { value: true }]]);
  expect(
    detectRemoteSheetChange({
      previous: { one: false, two: false },
      next: { two: false, one: false },
      expectedOperations,
      isOwnOperation: false,
    }),
  ).toEqual({ changed: false, hasRemoteChange: false, acknowledged: [] });
  expect(expectedOperations.size).toBe(1);
});

test('own acceptance coalesced with remote metadata is acknowledged without a warning notice', () => {
  const expectedOperations = new Map([['one', { value: true }]]);
  expect(
    detectRemoteSheetChange({
      previous: { one: false },
      next: { one: true },
      expectedOperations,
      isOwnOperation: false,
    }),
  ).toEqual({ changed: true, hasRemoteChange: false, acknowledged: ['one'] });
  expect(expectedOperations.size).toBe(1);
});

test('a remote acceptance coalesced with a local save still announces the change', () => {
  expect(
    detectRemoteSheetChange({
      previous: { one: false },
      next: { one: true },
      expectedOperations: new Map(),
      isOwnOperation: true,
    }),
  ).toEqual({ changed: true, hasRemoteChange: true, acknowledged: [] });
});

test.each([true, false])(
  'changed warning facts belong to their operation session (own: %s)',
  (isOwnOperation) => {
    expect(
      detectRemoteSheetChange({
        previous: { oldFacts: true },
        next: { newFacts: false },
        expectedOperations: new Map(),
        isOwnOperation,
      }),
    ).toEqual({
      changed: true,
      hasRemoteChange: !isOwnOperation,
      acknowledged: [],
    });
  },
);

test('the first loaded warnings do not announce another player', () => {
  expect(
    detectRemoteSheetChange({
      previous: null,
      next: { one: true },
      expectedOperations: new Map(),
      isOwnOperation: false,
    }).hasRemoteChange,
  ).toBe(false);
});

test('sheet list comparisons announce remote changes and ignore local echoes', () => {
  for (const isOwnOperation of [false, true]) {
    expect(
      detectRemoteSheetChange({
        previous: { adjustments: 'old modifier list' },
        next: { adjustments: 'new modifier list' },
        expectedOperations: new Map(),
        isOwnOperation,
      }),
    ).toEqual({
      changed: true,
      hasRemoteChange: !isOwnOperation,
      acknowledged: [],
    });
  }
});
