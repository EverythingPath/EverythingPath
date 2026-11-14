import { renderHook } from '@testing-library/react';
import type { FunctionReference } from 'convex/server';
import { beforeEach, expect, test, vi } from 'vitest';
import { api } from '@convex/_generated/api';
import { convexNames } from '../../../tests/convex-names';
import { useCharacterCreationRoute } from './use-character-creation-route';

const state = vi.hoisted(() => ({
  params: '' as string,
  user: {} as { characterSheetDemo?: true } | null | undefined,
  authority: 'legacy' as 'legacy' | 'sheet' | undefined,
  campaigns: {
    state: 'ready',
    campaigns: [{ _id: 'alpha' }],
  } as
    | { state: 'ready'; campaigns: { _id: string; e2eFixture?: string }[] }
    | undefined,
}));
const nameOf = convexNames({
  user: api.user.getMe,
  authority: api.characterSheet.authority,
});
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(state.params),
}));
vi.mock('@clerk/nextjs', () => ({
  useOrganization: () => ({ organization: { id: 'org' } }),
}));
vi.mock('../../lib/sharedQueries', () => ({
  useCampaignQuery: () => ({ data: state.campaigns, error: null }),
}));
vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: true }),
  useQuery: (query: FunctionReference<'query'>) => {
    switch (nameOf(query)) {
      case 'user':
        return state.user;
      case 'authority':
        return state.authority;
    }
  },
}));

beforeEach(() => {
  state.params = '';
  state.user = {};
  state.authority = 'legacy';
  state.campaigns = { state: 'ready', campaigns: [{ _id: 'alpha' }] };
});

test.each([
  ['legacy', {}, false],
  ['legacy', { characterSheetDemo: true as const }, true],
  ['sheet', {}, true],
] as const)(
  'private creation under %s authority for %j is available: %s',
  (authority, user, available) => {
    state.authority = authority;
    state.user = user;
    expect(
      renderHook(() => useCharacterCreationRoute()).result.current,
    ).toMatchObject({
      loading: false,
      available,
    });
  },
);

test.each([
  ['legacy', undefined, false],
  ['legacy', 'characterSheet', true],
  ['sheet', undefined, true],
] as const)(
  'campaign creation under %s authority with fixture marker %s is available: %s',
  (authority, e2eFixture, available) => {
    state.params = 'campaignId=alpha';
    state.authority = authority;
    state.campaigns = {
      state: 'ready',
      campaigns: [{ _id: 'alpha', ...(e2eFixture && { e2eFixture }) }],
    };
    expect(
      renderHook(() => useCharacterCreationRoute()).result.current,
    ).toMatchObject({
      loading: false,
      available,
      organizationId: 'org',
    });
  },
);

test('the route waits for the authority and never opens a campaign the player cannot see', () => {
  state.authority = undefined;
  expect(
    renderHook(() => useCharacterCreationRoute()).result.current,
  ).toMatchObject({
    loading: true,
    available: false,
  });
  state.authority = 'sheet';
  state.params = 'campaignId=elsewhere';
  expect(
    renderHook(() => useCharacterCreationRoute()).result.current,
  ).toMatchObject({
    loading: false,
    available: false,
  });
});
