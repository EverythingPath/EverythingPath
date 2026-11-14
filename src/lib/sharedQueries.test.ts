import { afterEach, beforeEach, expect, test } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { zid } from 'convex-helpers/server/zod4';
import { queryCacheFixture } from '../../tests/convex-query-cache';
import { useCampaignQuery, useCharacterLedgerQuery } from './sharedQueries';

const campaignId = zid('campaign').parse('campaign');
let cache: ReturnType<typeof queryCacheFixture>;
beforeEach(() => {
  cache = queryCacheFixture(() => []);
});
afterEach(() => cache.client.clear());

test('campaigns can load without an organization', async () => {
  const { result } = renderHook(() => useCampaignQuery(undefined), {
    wrapper: cache.wrapper,
  });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(cache.opened.map(({ args }) => args)).toEqual([
    { organizationId: undefined },
  ]);
});

test('a disabled campaign query creates no subscription and enabling it starts one', async () => {
  const view = renderHook(({ enabled }) => useCampaignQuery('org', enabled), {
    initialProps: { enabled: false },
    wrapper: cache.wrapper,
  });
  expect(cache.opened).toHaveLength(0);
  view.rerender({ enabled: true });
  await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
  expect(cache.opened.map(({ args }) => args)).toEqual([
    { organizationId: 'org' },
  ]);
});

test.each([
  { campaign: undefined, org: 'org', enabled: true },
  { campaign: campaignId, org: undefined, enabled: true },
  { campaign: campaignId, org: 'org', enabled: false },
])(
  'a guarded ledger query starts no subscription: %j',
  ({ campaign, org, enabled }) => {
    renderHook(() => useCharacterLedgerQuery(campaign, org, enabled), {
      wrapper: cache.wrapper,
    });
    expect(cache.opened).toHaveLength(0);
  },
);

test('character ledger queries keep organization scope and inactive selection', async () => {
  const { result } = renderHook(
    () => useCharacterLedgerQuery(campaignId, 'org', true, true),
    { wrapper: cache.wrapper },
  );
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(cache.opened.map(({ args }) => args)).toEqual([
    {
      campaignId,
      organizationId: 'org',
      includeInactive: true,
    },
  ]);
});
