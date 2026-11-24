import { renderHook } from '@testing-library/react';
import type { Doc, Id } from '@convex/_generated/dataModel';
import { beforeEach, expect, test, vi } from 'vitest';
import { useCampaignShellNavigation } from './use-campaign-shell-navigation';

const state = vi.hoisted(() => ({
  pathname: '/campaigns/alpha/officers',
  searchParams: '',
  contexts: undefined as
    | { campaignId: string; hasMilitia: boolean; week?: number }[]
    | undefined,
  originContexts: undefined as
    | { campaignId: string; hasMilitia: boolean; week?: number }[]
    | undefined,
}));
const campaign: Doc<'campaign'> = {
  _id: 'alpha' as Id<'campaign'>,
  _creationTime: 0,
  name: 'Ironfang',
  description: '',
  ownerId: 'owner',
  organizationId: 'origin',
};
vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: true }),
  useQuery: (_: unknown, args: { organizationId: string } | 'skip') => {
    if (args === 'skip') return undefined;
    return args.organizationId === 'origin'
      ? state.originContexts
      : state.contexts;
  },
}));
vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
  useSearchParams: () => new URLSearchParams(state.searchParams),
}));
beforeEach(() => {
  state.pathname = '/campaigns/alpha/officers';
  state.searchParams = '';
  state.contexts = undefined;
  state.originContexts = undefined;
});

test('keeps campaign militia pages available until the metadata resolves', () => {
  const view = renderHook(() =>
    useCampaignShellNavigation({
      campaign,
      campaigns: [campaign],
      organizationId: 'origin',
    }),
  );
  expect(view.result.current.campaigns[0]?.hasMilitia).toBe('loading');
  expect(view.result.current.campaign?.hasMilitia).toBe('loading');
  expect(view.result.current.militiaLoading).toBe(true);
  expect(view.result.current.militiaUnavailable).toBeNull();
  expect(view.result.current.showMilitiaRail).toBe(true);
  state.originContexts = [{ campaignId: 'alpha', hasMilitia: false }];
  view.rerender();
  expect(view.result.current.militiaLoading).toBe(false);
  expect(view.result.current.showMilitiaRail).toBe(false);
  expect(view.result.current.pageStrip.map(({ label }) => label)).toEqual([
    'Home',
    'Characters',
  ]);
});

test('keeps a sheet origin loading independently of the active organization metadata', () => {
  state.pathname = '/characters/hero';
  state.searchParams =
    'from=%2Fcampaigns%2Falpha%2Fofficers&organizationId=origin';
  state.contexts = [];
  const view = renderHook(() =>
    useCampaignShellNavigation({
      campaign,
      campaigns: [],
      organizationId: 'other',
    }),
  );
  expect(view.result.current.campaign?.hasMilitia).toBe('loading');
  expect(view.result.current.militiaLoading).toBe(true);
  expect(view.result.current.militiaUnavailable).toBeNull();
  expect(view.result.current.phoneTabs[1]?.unavailable).toBe(false);
  expect(view.result.current.showMilitiaRail).toBe(false);
  state.originContexts = [{ campaignId: 'alpha', hasMilitia: true, week: 7 }];
  view.rerender();
  expect(view.result.current.campaign?.hasMilitia).toBe(true);
  expect(view.result.current.militiaLoading).toBe(false);
  expect(view.result.current.pageStrip[0]?.label).toBe('Week 7');
});
