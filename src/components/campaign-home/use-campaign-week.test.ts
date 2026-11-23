import { expect, test } from 'vitest';
import { campaignWeek } from './use-campaign-week';

test('loading and failure are never "Not set up"', () => {
  expect(campaignWeek({})).toEqual({ kind: 'loading' });
  expect(campaignWeek({ error: new Error('x') })).toEqual({ kind: 'failed' });
});

test('no workspace is Not set up; a workspace gives its open week', () => {
  expect(campaignWeek({ data: null })).toEqual({ kind: 'not_set_up' });
  expect(campaignWeek({ data: { week: 14 } })).toEqual({
    kind: 'week',
    week: 14,
  });
});
