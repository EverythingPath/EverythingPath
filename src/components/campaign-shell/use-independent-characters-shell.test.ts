import { renderHook } from '@testing-library/react';
import type { Doc, Id } from '@convex/_generated/dataModel';
import { beforeEach, expect, test, vi } from 'vitest';
import { useIndependentCharactersShell } from './use-independent-characters-shell';
import { convexNames } from '../../../tests/convex-names';
import type { FunctionReference } from 'convex/server';
import { api } from '@convex/_generated/api';

const state = vi.hoisted(() => ({
  organizationId: 'origin',
  readFailed: false,
}));
const campaigns: Doc<'campaign'>[] = [
  {
    _id: 'alpha' as Id<'campaign'>,
    _creationTime: 0,
    name: 'Ironfang',
    description: '',
    ownerId: 'owner',
    organizationId: 'origin',
  },
  {
    _id: 'beta' as Id<'campaign'>,
    _creationTime: 0,
    name: 'Kingmaker',
    description: '',
    ownerId: 'owner',
    organizationId: 'other',
  },
];
const nameOf = convexNames({
  sheet: api.characterSheet.read,
});
vi.mock('@convex-dev/react-query', () => ({
  convexQuery: (query: FunctionReference<'query'>, args: unknown) => ({
    name: nameOf(query),
    args,
  }),
}));
vi.mock('@tanstack/react-query', () => ({
  useQuery: () =>
    state.readFailed
      ? { error: new Error('Character not available') }
      : {
          data: {
            campaign: {
              campaignId: 'alpha',
              campaignName: 'Ironfang',
              organizationId: 'origin',
            },
          },
        },
}));
vi.mock('@clerk/nextjs', () => ({
  useOrganization: () => ({ organization: { id: state.organizationId } }),
}));
vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: true }),
  useQuery: (
    query: FunctionReference<'query'>,
    args: { organizationId?: string } | 'skip',
  ) => {
    const name = nameOf(query);
    if (args === 'skip') return undefined;
    if (name === 'sheet' && state.readFailed)
      throw new Error('Character not available');
    return name === 'sheet'
      ? {
          campaign: {
            campaignId: 'alpha',
            campaignName: 'Ironfang',
            organizationId: 'origin',
          },
        }
      : [
          {
            campaignId: args.organizationId === 'origin' ? 'alpha' : 'beta',
            hasMilitia: true,
            week: 12,
          },
        ];
  },
}));
vi.mock('~/lib/sharedQueries', () => ({
  useCampaignQuery: (organizationId: string, enabled: boolean) => ({
    data:
      enabled && (!state.readFailed || organizationId !== 'origin')
        ? {
            state: 'ready',
            campaigns: campaigns.filter(
              (item) => item.organizationId === organizationId,
            ),
          }
        : undefined,
  }),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/characters/hero',
  useSearchParams: () =>
    new URLSearchParams(
      'from=%2Fcampaigns%2Falpha%2Fofficers&organizationId=origin',
    ),
}));

beforeEach(() => {
  state.organizationId = 'origin';
  state.readFailed = false;
});

test('retains authorized sheet origin context across a manual organization switch while the picker follows the active organization', () => {
  const view = renderHook(() => useIndependentCharactersShell());
  expect(view.result.current.nav.campaign?.name).toBe('Ironfang');
  expect(
    view.result.current.nav.pageStrip.find(({ key }) => key === 'officers')
      ?.active,
  ).toBe(true);
  state.organizationId = 'other';
  view.rerender();
  expect(view.result.current.nav.campaign?.name).toBe('Ironfang');
  expect(view.result.current.nav.campaign?.hasMilitia).toBe(true);
  expect(view.result.current.nav.campaigns.map(({ name }) => name)).toEqual([
    'Kingmaker',
  ]);
  expect(
    view.result.current.nav.pageStrip.find(({ key }) => key === 'officers')
      ?.active,
  ).toBe(true);
});

test('an inaccessible sheet with its complete campaign-origin URL keeps a usable non-disclosing shell', () => {
  state.organizationId = 'outsider';
  state.readFailed = true;
  const view = renderHook(() => useIndependentCharactersShell());
  expect(view.result.current.nav.campaign).toBeUndefined();
  expect(
    view.result.current.nav.sectionLinks.map(({ label }) => label),
  ).toEqual(['Campaigns', 'Characters']);
  expect(view.result.current.nav.phoneTabs.map(({ label }) => label)).toEqual([
    'Campaign',
    'Militia',
    'Characters',
    'More',
  ]);
  expect(view.result.current.origin?.href).toBe('/campaigns/alpha/officers');
});
