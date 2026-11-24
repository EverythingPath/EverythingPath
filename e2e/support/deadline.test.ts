// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  browserStopReserveMs,
  computeRunDeadline,
  getRemainingMs,
  outerDeadlineReserveMs,
  parseTimeOptions,
  readRunClock,
} from './deadline';

describe('one run deadline', () => {
  const startedAt = Date.parse('2026-10-15T06:20:32.650Z');

  it('keeps the 17.5-minute budget when no budget is given', () => {
    // Run 1 (#729): runner start 06:20:32.65, deadline 06:38:02.65 UTC.
    expect(computeRunDeadline({ startedAt })).toEqual({
      deadline: Date.parse('2026-10-15T06:38:02.650Z'),
      browserStopAt: Date.parse('2026-10-15T06:37:02.650Z'),
    });
  });

  it('derives the browser stop from the same deadline, a reserve earlier', () => {
    const { deadline, browserStopAt } = computeRunDeadline({
      startedAt,
      budgetMinutes: 40,
    });
    expect(deadline).toBe(Date.parse('2026-10-15T07:00:32.650Z'));
    expect(deadline - browserStopAt).toBe(browserStopReserveMs);
    expect(browserStopReserveMs).toBe(60_000);
  });

  it('ends early enough to finish before an outer supervisor interrupts it', () => {
    // CI's job started 06:19:00; its workflow interrupts the runner at 06:36:30.
    const outerDeadlineAt = Date.parse('2026-10-15T06:36:30.000Z');
    expect(computeRunDeadline({ startedAt, outerDeadlineAt })).toEqual({
      deadline: Date.parse('2026-10-15T06:36:00.000Z'),
      browserStopAt: Date.parse('2026-10-15T06:35:00.000Z'),
    });
    expect(outerDeadlineReserveMs).toBe(30_000);
  });

  it('counts down to an absolute time and refuses one that has passed', () => {
    expect(getRemainingMs({ until: startedAt + 1_500, now: startedAt })).toBe(
      1_500,
    );
    expect(() => getRemainingMs({ until: startedAt, now: startedAt })).toThrow(
      'time budget',
    );
    expect(() =>
      getRemainingMs({ until: startedAt - 1, now: startedAt }),
    ).toThrow('time budget');
  });
});

describe('the stored clock', () => {
  const run = {
    deadline: Date.parse('2026-10-15T07:00:32.650Z'),
    browserStopAt: Date.parse('2026-10-15T06:59:32.650Z'),
  };

  it('gives Playwright and its server the time left until the stored times', () => {
    // Playwright loads its config 72 s after the runner started (run 1).
    const now = Date.parse('2026-10-15T06:21:44.650Z');
    expect(readRunClock({ run, now })).toEqual({
      globalTimeoutMs: run.browserStopAt - now,
      serverLifetimeMs: run.deadline - now,
    });
  });

  it('never turns a passed time into no limit at all', () => {
    // Playwright reads a global timeout of 0 as unlimited.
    expect(readRunClock({ run, now: run.deadline + 5 })).toEqual({
      globalTimeoutMs: 1,
      serverLifetimeMs: 1,
    });
  });

  it('refuses a run file without the runner clock', () => {
    expect(() => readRunClock({ run: {} })).toThrow('pnpm test:e2e');
    expect(() => readRunClock({ run: { deadline: run.deadline } })).toThrow(
      'pnpm test:e2e',
    );
  });
});

// The trusted-GitHub preflight's conditions (preflight.ts).
const trustedCI = {
  CI: 'true',
  GITHUB_ACTIONS: 'true',
  GITHUB_EVENT_NAME: 'schedule',
  GITHUB_ACTOR: 'AndreasUnunger',
  GITHUB_SHA: 'a'.repeat(40),
  E2E_REVIEWED_SHA: 'a'.repeat(40),
};

describe('the time options', () => {
  it.each([
    [undefined, 17.5],
    ['40', 40],
    ['17.5', 17.5],
    ['5', 5],
    ['120', 120],
  ])('accepts a budget of %s minutes', (value, minutes) => {
    expect(parseTimeOptions({ budgetMinutes: value })).toEqual({
      budgetMinutes: minutes,
    });
  });

  it.each(['', '0', '4.9', '121', '-5', '40m', '1e2', ' 40', 'NaN', '0x20'])(
    'refuses a budget of %j',
    (value) => {
      expect(() => parseTimeOptions({ budgetMinutes: value })).toThrow(
        'E2E budget must be between 5 and 120 minutes',
      );
    },
  );

  it('accepts an outer deadline in epoch seconds from trusted CI', () => {
    expect(
      parseTimeOptions({
        outerDeadlineEpoch: '1792045590',
        environment: trustedCI,
      }),
    ).toEqual({ outerDeadlineAt: 1_792_045_590_000 });
  });

  it.each([
    ['a local run', {}],
    ['CI without GitHub Actions', { ...trustedCI, GITHUB_ACTIONS: undefined }],
    [
      'an unreviewed commit',
      { ...trustedCI, E2E_REVIEWED_SHA: 'b'.repeat(40) },
    ],
    ['a bot', { ...trustedCI, GITHUB_ACTOR: 'renovate[bot]' }],
    ['GitHub Actions without CI', { ...trustedCI, CI: undefined }],
  ])(
    'refuses an outer deadline in %s, where the local budget applies',
    (_label, environment) => {
      expect(() =>
        parseTimeOptions({ outerDeadlineEpoch: '1792045590', environment }),
      ).toThrow('--outer-deadline-epoch is only for trusted GitHub CI');
    },
  );

  it.each(['', '0', '1792045590.5', '1792045590000', 'soon', '-1792045590'])(
    'refuses an outer deadline of %j',
    (value) => {
      expect(() =>
        parseTimeOptions({ outerDeadlineEpoch: value, environment: trustedCI }),
      ).toThrow('E2E outer deadline must be whole epoch seconds');
    },
  );

  it('refuses a budget together with an outer deadline', () => {
    expect(() =>
      parseTimeOptions({
        budgetMinutes: '40',
        outerDeadlineEpoch: '1792045590',
      }),
    ).toThrow('Use --budget-minutes or --outer-deadline-epoch, not both');
  });
});
