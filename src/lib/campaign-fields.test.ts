import { ConvexError } from 'convex/values';
import { describe, expect, test } from 'vitest';
import {
  campaignHeaderSchema,
  createCampaignSchema,
  formatInGameDate,
  parseInGameDate,
  savedHeaderValues,
} from './campaign-fields';
import { classifyWriteFailure } from './write-outcome';

function nameError(name: string) {
  const result = createCampaignSchema.safeParse({ name, description: '' });
  return result.success ? null : result.error.issues[0]?.message;
}

describe('campaign creation fields', () => {
  test('distinguishes a missing, short and long name', () => {
    expect(nameError('')).toBe('Enter a name.');
    expect(nameError('   ')).toBe('Enter a name.');
    expect(nameError('A')).toBe('Name must be at least 2 characters.');
    expect(nameError('x'.repeat(51))).toBe(
      'Name must be 50 characters or fewer.',
    );
  });

  test('accepts 2 and 50 characters and a multiline optional description', () => {
    expect(nameError('Ab')).toBeNull();
    expect(nameError('x'.repeat(50))).toBeNull();
    expect(
      createCampaignSchema.parse({
        name: '  Second Table ',
        description: 'Line one\nLine two',
      }),
    ).toEqual({ name: 'Second Table', description: 'Line one\nLine two' });
  });
});

describe('in-game date', () => {
  test('reads the stored date-only value in the fantasy calendar', () => {
    expect(formatInGameDate('2017-03-12')).toBe('12 Pharast 4717');
    expect(formatInGameDate('2026-01-01')).toBe('1 Abadius 4726');
    expect(formatInGameDate('2025-12-31')).toBe('31 Kuthona 4725');
    expect(formatInGameDate('2024-02-29')).toBe('29 Calistril 4724');
    expect(formatInGameDate('2024-03-01')).toBe('1 Pharast 4724');
  });

  test('a missing or unreadable date is no date, never a fabricated one', () => {
    expect(formatInGameDate(undefined)).toBeNull();
    expect(formatInGameDate('')).toBeNull();
    expect(formatInGameDate('12 Pharast 4717')).toBeNull();
    expect(parseInGameDate('2025-02-29')).toBeNull();
    expect(parseInGameDate('2026-13-01')).toBeNull();
    expect(parseInGameDate('2026-03-22')?.toISOString()).toBe(
      '2026-03-22T00:00:00.000Z',
    );
  });

  test('the header accepts an empty or a valid date-only value', () => {
    expect(
      campaignHeaderSchema.safeParse({ description: '', inGameDate: '' })
        .success,
    ).toBe(true);
    expect(
      campaignHeaderSchema.safeParse({
        description: '',
        inGameDate: '2026-02-30',
      }).success,
    ).toBe(false);
    expect(savedHeaderValues({ description: 'd' })).toEqual({
      description: 'd',
      inGameDate: '',
    });
  });
});

describe('write outcomes', () => {
  test('only a server refusal is a definite failure', () => {
    expect(
      classifyWriteFailure(new ConvexError('Campaign editing is paused')),
    ).toEqual({ kind: 'rejected', message: 'Campaign editing is paused' });
    expect(classifyWriteFailure(new ConvexError({ code: 1 }))).toEqual({
      kind: 'rejected',
      message: null,
    });
    expect(
      classifyWriteFailure(new Error('ConvexClient has already been closed.')),
    ).toEqual({ kind: 'unknown' });
  });
});

test('structured maintenance refusals expose only safe actionable copy', () => {
  expect(
    classifyWriteFailure(
      new ConvexError({ code: 'RELOAD_REQUIRED', message: 'secret' }),
    ),
  ).toEqual({
    kind: 'rejected',
    message:
      'This page is out of date. Reload to keep editing; unsaved changes will be discarded.',
  });
  expect(
    classifyWriteFailure(
      new ConvexError({ code: 'MAINTENANCE', message: 'secret' }),
    ),
  ).toEqual({
    kind: 'rejected',
    message:
      'Editing is paused for maintenance. Saved information remains available.',
  });
  expect(
    classifyWriteFailure(
      new ConvexError({ code: 'UNKNOWN', message: 'secret' }),
    ),
  ).toEqual({ kind: 'rejected', message: null });
});
