import { describe, expect, test } from 'vitest';
import type { FinishedWeekHeadlineFact } from '~/lib/finished-week-headlines';
import {
  headlineText,
  recordedOutcomeAvailable,
  rowHeadlines,
} from './finished-week-headline-text';

const fact = (
  patch: Partial<FinishedWeekHeadlineFact> = {},
): FinishedWeekHeadlineFact => ({
  key: 'treasury',
  label: 'Treasury',
  before: 44_000,
  final: 58_507,
  beforeRecorded: true,
  finalRecorded: true,
  unit: 'gp',
  ...patch,
});
const text = (patch: Partial<FinishedWeekHeadlineFact>) =>
  fact({ unit: 'text', ...patch });

describe('headline text', () => {
  test('treasury changes are signed and copper-exact in gp', () => {
    expect(headlineText(fact())).toBe('Treasury +145.07 gp');
    expect(headlineText(fact({ before: 600, final: 545 }))).toBe(
      'Treasury −0.55 gp',
    );
  });

  test('numeric changes are signed deltas', () => {
    expect(
      headlineText(
        fact({
          key: 'training',
          label: 'Training',
          unit: 'number',
          before: 12,
          final: 9,
        }),
      ),
    ).toBe('Training −3');
    expect(
      headlineText(
        fact({
          key: 'rank',
          label: 'Rank',
          unit: 'number',
          before: 3,
          final: 4,
        }),
      ),
    ).toBe('Rank +1');
  });

  test('an unrecorded starting value shows only the recorded outcome, never a delta from zero', () => {
    expect(headlineText(fact({ before: null, beforeRecorded: false }))).toBe(
      'Treasury now 585.07 gp',
    );
    expect(
      headlineText(
        fact({
          key: 'rank',
          label: 'Rank',
          unit: 'number',
          before: null,
          final: 8,
          beforeRecorded: false,
        }),
      ),
    ).toBe('Rank now 8');
    expect(
      headlineText(
        text({
          key: 'focus',
          label: 'Focus',
          before: null,
          beforeRecorded: false,
          final: 'loyalty',
        }),
      ),
    ).toBe('Focus now Loyalty');
  });

  test('subjects are added, removed or changed by their record-local label', () => {
    const team = { key: 'team:t1', label: 'Scouts' };
    expect(headlineText(text({ ...team, before: null, final: 'active' }))).toBe(
      'Scouts added: Active',
    );
    expect(headlineText(text({ ...team, before: 'active', final: null }))).toBe(
      'Scouts removed',
    );
    expect(
      headlineText(text({ ...team, before: 'active', final: 'disabled' })),
    ).toBe('Scouts: Active → Disabled');
    expect(
      headlineText(
        text({
          key: 'settlement:s',
          label: 'Phaendar',
          before: 'Friendly',
          final: null,
        }),
      ),
    ).toBe('Phaendar removed');
  });

  test('persistent events read as their table names', () => {
    expect(
      headlineText(
        text({
          key: 'event:e',
          label: 'Persistent event 1',
          before: null,
          final: 'sickness',
        }),
      ),
    ).toBe('Persistent event 1 added: Sickness');
  });

  test('a militia text value without a starting value reads as none, not added', () => {
    expect(
      headlineText(
        text({ key: 'focus', label: 'Focus', before: null, final: 'arcane' }),
      ),
    ).toBe('Focus: None → Arcane');
  });

  test('a fact without a recorded outcome is not shown', () => {
    expect(
      headlineText(fact({ finalRecorded: false, final: null })),
    ).toBeNull();
  });
});

describe('row headlines', () => {
  test('rows show at most two headlines, or say a recorded outcome is available', () => {
    expect(rowHeadlines({ headlineFacts: [] })).toEqual([
      recordedOutcomeAvailable,
    ]);
    expect(recordedOutcomeAvailable).toBe('Recorded outcome available');
    const training = fact({
      key: 'training',
      label: 'Training',
      unit: 'number',
      before: 1,
      final: 2,
    });
    expect(
      rowHeadlines({ headlineFacts: [fact(), training, fact({ key: 'x' })] }),
    ).toEqual(['Treasury +145.07 gp', 'Training +1']);
  });

  test('only recorded outcomes count; none recorded reads Recorded outcome available', () => {
    expect(
      rowHeadlines({
        headlineFacts: [fact({ finalRecorded: false, final: null })],
      }),
    ).toEqual([recordedOutcomeAvailable]);
  });
});
