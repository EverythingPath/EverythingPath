// @vitest-environment node
import { expect, it } from 'vitest';
import {
  historySchema,
  recurringFailures,
  summarizeNightly,
} from './nightly-history';

it('requires recurrence across distinct runs and only reports failures still present', () => {
  expect(recurringFailures([{ failures: ['a', 'a'] }])).toEqual([]);
  expect(recurringFailures([{ failures: ['a'] }, { failures: ['a'] }])).toEqual(
    ['a'],
  );
  expect(
    recurringFailures([
      { failures: [] },
      { failures: ['a'] },
      { failures: ['a'] },
    ]),
  ).toEqual([]);
});
it('counts intermittent recurrence in twenty runs, excluding the twenty-first', () => {
  const passing = Array.from({ length: 18 }, () => ({ failures: [] }));
  expect(
    recurringFailures([{ failures: ['a'] }, ...passing, { failures: ['a'] }]),
  ).toEqual(['a']);
  expect(
    recurringFailures([
      { failures: ['a'] },
      ...passing,
      { failures: [] },
      { failures: ['a'] },
    ]),
  ).toEqual([]);
  expect(recurringFailures([{ failures: ['a'] }, { failures: ['b'] }])).toEqual(
    [],
  );
});
it('keeps setup and malformed reports actionable', () => {
  expect(summarizeNightly(null)).toEqual({ failures: ['infrastructure'] });
  expect(
    summarizeNightly({ status: 'passed', tests: [] }).failures,
  ).not.toEqual([]);
});

it('distinguishes failing steps within one journey and keeps a retry pass red', () => {
  const report = {
    status: 'failed',
    errors: 0,
    tests: [
      {
        file: 'access.spec.ts',
        project: 'chromium-phone',
        title:
          'organization members can open their campaign and outsiders cannot',
        expectedStatus: 'passed',
        tags: [],
        annotations: [],
        results: [
          { status: 'failed', retry: 0 },
          { status: 'passed', retry: 1 },
        ],
      },
    ],
    evidence: [
      {
        project: 'chromium-phone',
        journey:
          'organization members can open their campaign and outsiders cannot',
        retry: 0,
        failureIdentity: 'a'.repeat(20),
      },
    ],
  };
  const first = summarizeNightly(report);
  const key = first.failures.find((failure) =>
    failure.endsWith(':aaaaaaaaaaaaaaaaaaaa'),
  )!;
  expect(key).toBeDefined();
  report.evidence[0]!.failureIdentity = 'b'.repeat(20);
  const otherStep = summarizeNightly(report);
  expect(recurringFailures([otherStep, first])).not.toContain(key);
  expect(recurringFailures([first, first])).toContain(key);
});

it('accepts retired historical keys while rejecting malformed failure identities', () => {
  const retired = `${'f'.repeat(20)}:not-run`;
  expect(historySchema.parse({ failures: [retired] })).toEqual({
    failures: [retired],
  });
  for (const key of ['unknown', `${retired}:extra`, `${'f'.repeat(20)}:bad`]) {
    expect(historySchema.safeParse({ failures: [key] }).success).toBe(false);
  }
});
