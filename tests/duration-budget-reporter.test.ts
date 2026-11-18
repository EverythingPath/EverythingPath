import { expect, test } from 'vitest';
import { formatDurationBudget } from './duration-budget-reporter';

test('only tests that took at least half their timeout are listed, the closest to timing out first', () => {
  expect(
    formatDurationBudget([
      { file: 'convex/a.test.ts', name: 'quick', duration: 500, timeout: 5000 },
      {
        file: 'convex/a.test.ts',
        name: 'close',
        duration: 4600,
        timeout: 5000,
      },
      {
        file: 'src/b.test.tsx',
        name: 'half',
        duration: 10_000,
        timeout: 20_000,
      },
      {
        file: 'src/b.test.tsx',
        name: 'long but allowed',
        duration: 9000,
        timeout: 60_000,
      },
      { file: 'src/b.test.tsx', name: 'unmeasured', duration: 9000 },
    ]),
  ).toBe(
    [
      'Duration budget: 2 tests took at least half their timeout.',
      '   92%  convex/a.test.ts > close (4600 of 5000 ms)',
      '   50%  src/b.test.tsx > half (10000 of 20000 ms)',
    ].join('\n'),
  );
});

test('the summary shows the ten closest to timing out and counts the rest', () => {
  const tests = Array.from({ length: 12 }, (_, index) => ({
    file: 'a.test.ts',
    name: `test ${index}`,
    duration: 2500 + index * 100,
    timeout: 5000,
  }));
  const lines = formatDurationBudget(tests).split('\n');
  expect(lines[0]).toBe(
    'Duration budget: 12 tests took at least half their timeout.',
  );
  expect(lines[1]).toBe('   72%  a.test.ts > test 11 (3600 of 5000 ms)');
  expect(lines.slice(-1)).toEqual(['  … and 2 more']);
  expect(lines).toHaveLength(12);
});

test('nothing is reported when every test stays within budget', () => {
  expect(
    formatDurationBudget([
      { file: 'a.test.ts', name: 'a', duration: 2499, timeout: 5000 },
    ]),
  ).toBe('');
});

test('each test records its own timeout for the budget', ({ task }) => {
  expect(task.meta.timeout).toBe(task.timeout);
});
