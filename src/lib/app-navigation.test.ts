import { expect, test } from 'vitest';
import { buildAppNavigation, rememberNavigation } from './app-navigation';

const campaign = { id: 'alpha', name: 'Ironfang', hasMilitia: true };
const campaigns = [
  campaign,
  { id: 'beta', name: 'Kingmaker', hasMilitia: true },
];

test('the Week rail starts collapsed on desktop', () => {
  const view = buildAppNavigation({
    pathname: '/campaigns/alpha/week',
    campaign,
    campaigns,
  });
  expect(view.militiaRailExpandedOnDesktop).toBe(false);
});

test.each(['history', 'militia', 'officers', 'setup'])(
  'the %s rail starts expanded on desktop',
  (section) => {
    const view = buildAppNavigation({
      pathname: `/campaigns/alpha/${section}`,
      campaign,
      campaigns,
    });
    expect(view.militiaRailExpandedOnDesktop).toBe(true);
  },
);

test('a sheet borrowing a Week origin does not inherit the bounded Week rail default', () => {
  const view = buildAppNavigation({
    pathname: '/characters/hero',
    searchParams: 'from=%2Fcampaigns%2Falpha%2Fweek',
    campaign,
    campaigns,
  });
  expect(view.militiaRailExpandedOnDesktop).toBe(true);
  expect(view.showMilitiaRail).toBe(false);
});

test('retains fixed phone tabs and returns to the last militia page in the selected campaign', () => {
  const memory = rememberNavigation(
    {},
    { pathname: '/campaigns/alpha/officers', organizationId: 'org' },
  );
  const view = buildAppNavigation({
    pathname: '/campaigns/alpha/characters',
    campaign,
    campaigns,
    organizationId: 'org',
    memory,
  });
  expect(view.phoneTabs.map(({ key }) => key)).toEqual([
    'campaign',
    'militia',
    'characters',
    'more',
  ]);
  expect(view.phoneTabs.find(({ key }) => key === 'militia')?.href).toBe(
    '/campaigns/alpha/officers',
  );
  expect(view.activeTab).toBe('campaign');
  expect(view.pageStrip.map(({ label }) => label)).toEqual([
    'Home',
    'Characters',
  ]);
});

test('keeps militia selection isolated per campaign and last campaigns isolated per organization', () => {
  let memory = rememberNavigation(
    {},
    {
      pathname: '/campaigns/alpha/militia',
      searchParams: 'section=teams',
      organizationId: 'org',
    },
  );
  memory = rememberNavigation(memory, {
    pathname: '/campaigns/beta/history',
    searchParams: 'week=4',
    organizationId: 'other',
  });
  const own = buildAppNavigation({
    pathname: '/characters',
    campaigns,
    organizationId: 'org',
    memory,
  });
  expect(own.phoneTabs[0]?.href).toBe('/campaigns/alpha');
  expect(own.phoneTabs[1]?.href).toBe('/campaigns/alpha/militia?section=teams');
  const other = buildAppNavigation({
    pathname: '/characters',
    campaigns,
    organizationId: 'other',
    memory,
  });
  expect(other.phoneTabs[0]?.href).toBe('/campaigns/beta');
  expect(other.phoneTabs[1]?.href).toBe('/campaigns/beta/history?week=4');
  const revoked = buildAppNavigation({
    pathname: '/characters',
    campaigns: [],
    organizationId: 'org',
    memory,
  });
  expect(revoked.phoneTabs[0]?.href).toBe('/campaigns');
  expect(revoked.phoneTabs[1]?.href).toBeNull();
});

test('retains the origin page strip and section when a sheet opens without its militia rail', () => {
  const view = buildAppNavigation({
    pathname: '/characters/hero',
    searchParams: 'from=%2Fcampaigns%2Falpha%2Fofficers',
    campaign,
    campaigns,
    week: 12,
  });
  expect(view.activeTab).toBe('militia');
  expect(view.sectionLinks.find(({ key }) => key === 'militia')?.active).toBe(
    true,
  );
  expect(view.pageStrip.map(({ label }) => label)).toEqual([
    'Week 12',
    'Finished weeks',
    'Militia',
    'Characters & officers',
    'Setup',
  ]);
  expect(view.pageStrip.find(({ key }) => key === 'officers')?.active).toBe(
    true,
  );
  expect(view.showMilitiaRail).toBe(false);
  const global = buildAppNavigation({
    pathname: '/characters/hero',
    campaign,
    campaigns,
  });
  expect(global.pageStrip).toEqual([]);
  expect(global.campaign).toBeUndefined();
  expect(global.activeTab).toBe('characters');
});

test('keeps an absent militia tab available for its explanation and suppresses the desktop section', () => {
  const noMilitia = { ...campaign, hasMilitia: false };
  const view = buildAppNavigation({
    pathname: '/campaigns/alpha',
    campaign: noMilitia,
    campaigns: [noMilitia],
  });
  expect(view.phoneTabs[1]).toMatchObject({
    label: 'Militia',
    href: null,
    unavailable: true,
  });
  expect(view.militiaUnavailable).toEqual({
    title: 'No militia',
    message: 'This campaign has no militia.',
    switchHref: '/campaigns',
  });
  expect(view.sectionLinks.map(({ label }) => label)).toEqual([
    'Home',
    'Characters',
  ]);
});

test('shows campaign pages on militia routes before a militia is created', () => {
  const noMilitia = { ...campaign, hasMilitia: false };
  for (const section of ['setup', 'officers']) {
    const view = buildAppNavigation({
      pathname: `/campaigns/alpha/${section}`,
      campaign: noMilitia,
      campaigns: [noMilitia],
    });
    expect(view.activeTab).toBe('campaign');
    expect(view.pageStrip.map(({ label }) => label)).toEqual([
      'Home',
      'Characters',
    ]);
    expect(view.phoneTabs[1]).toMatchObject({
      active: false,
      unavailable: true,
    });
    expect(view.showMilitiaRail).toBe(false);
  }
});

test('keeps militia navigation available while its existence is loading', () => {
  const loading = { ...campaign, hasMilitia: 'loading' as const };
  const view = buildAppNavigation({
    pathname: '/campaigns/alpha/officers',
    campaign: loading,
    campaigns: [loading],
  });
  expect(view.activeTab).toBe('militia');
  expect(view.showMilitiaRail).toBe(true);
  expect(view.militiaLoading).toBe(true);
  expect(view.militiaUnavailable).toBeNull();
  expect(view.phoneTabs[1]).toMatchObject({
    active: true,
    unavailable: false,
  });
});

test('keeps an unavailable campaign origin on an available phone tab', () => {
  const view = buildAppNavigation({
    pathname: '/characters/hero',
    searchParams: 'from=%2Fcampaigns%2Fmissing%2Fofficers',
    campaigns: [],
  });
  expect(view.activeTab).toBe('campaign');
  expect(
    view.phoneTabs.filter(({ active }) => active).map(({ key }) => key),
  ).toEqual(['campaign']);
  expect(view.phoneTabs[1]).toMatchObject({ active: false, unavailable: true });
  expect(view.pageStrip).toEqual([]);
  expect(view.showMilitiaRail).toBe(false);
});

test('discards forged remembered destinations rather than opening another campaign or host', () => {
  for (const href of [
    'https://evil.test',
    '/campaigns/beta/history',
    '/campaigns/alpha/characters',
  ]) {
    const view = buildAppNavigation({
      pathname: '/campaigns/alpha',
      campaign,
      campaigns,
      memory: { militia: { alpha: href } },
    });
    expect(view.phoneTabs[1]?.href).toBe('/campaigns/alpha/week');
  }
});
