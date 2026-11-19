import {
  CAMPAIGN_SECTIONS,
  PERSONAL_ORGANIZATION,
  campaignPath,
  isMilitiaSection,
  readCharacterSheetOrigin,
  resolveNavigationLocation,
  type CampaignSection,
  type NavigationLocation,
} from './campaign-routes';

export type NavigationCampaign = {
  id: string;
  name: string;
  hasMilitia: boolean | 'loading';
};
export type NavigationMemory = {
  campaigns?: Record<string, string>;
  militia?: Record<string, string>;
};
export type NavigationLink = {
  key: CampaignSection | 'campaigns';
  label: string;
  href: string;
  active: boolean;
};
export type PhoneTab = 'campaign' | 'militia' | 'characters' | 'more';
export type PhoneNavigationTab = {
  key: PhoneTab;
  label: string;
  href: string | null;
  active: boolean;
  unavailable: boolean;
};
export type AppNavigationInput = {
  pathname: string;
  searchParams?: string;
  organizationId?: string;
  campaign?: NavigationCampaign;
  campaigns: NavigationCampaign[];
  week?: number;
};

/** Remember only real campaign page visits, never a sheet's borrowed origin. */
export function rememberNavigation(
  memory: NavigationMemory,
  input: Pick<
    AppNavigationInput,
    'pathname' | 'searchParams' | 'organizationId'
  >,
): NavigationMemory {
  const location = resolveNavigationLocation(input.pathname);
  if (location?.kind !== 'campaign') return memory;
  const org = input.organizationId ?? PERSONAL_ORGANIZATION;
  const href = `${input.pathname}${input.searchParams ? `?${input.searchParams}` : ''}`;
  const militiaChanged =
    isMilitiaSection(location.section) &&
    memory.militia?.[location.campaignId] !== href;
  if (memory.campaigns?.[org] === location.campaignId && !militiaChanged)
    return memory;
  return {
    campaigns: { ...memory.campaigns, [org]: location.campaignId },
    militia: militiaChanged
      ? { ...memory.militia, [location.campaignId]: href }
      : memory.militia,
  };
}

function resolveActiveTab(
  location: NavigationLocation | undefined,
  campaign: NavigationCampaign | undefined,
): PhoneTab {
  if (location?.kind === 'campaign')
    return campaign &&
      isMilitiaSection(location.section) &&
      campaign.hasMilitia !== false
      ? 'militia'
      : 'campaign';
  return location?.kind === 'campaigns' ? 'campaign' : 'characters';
}

function buildSectionLinks(
  campaign: NavigationCampaign | undefined,
  location: NavigationLocation | undefined,
  activeTab: PhoneTab,
  week: number | undefined,
) {
  // Safe cast: CAMPAIGN_SECTIONS is keyed by exactly the CampaignSection
  // values.
  const pages: NavigationLink[] = campaign
    ? (Object.keys(CAMPAIGN_SECTIONS) as CampaignSection[]).map((key) => ({
        key,
        label:
          key === 'week' && week !== undefined
            ? `Week ${week}`
            : CAMPAIGN_SECTIONS[key].label,
        href: campaignPath(campaign.id, key),
        active: location?.kind === 'campaign' && location.section === key,
      }))
    : [];
  const campaignPages = pages.filter(
    ({ key }) => key !== 'campaigns' && !isMilitiaSection(key),
  );
  const militiaPages = pages.filter(
    ({ key }) => key !== 'campaigns' && isMilitiaSection(key),
  );
  const sectionLinks: NavigationLink[] = campaign
    ? [
        ...campaignPages,
        ...pages
          .filter(
            ({ key }) => key === 'militia' && campaign.hasMilitia !== false,
          )
          .map((link) => ({ ...link, active: activeTab === 'militia' })),
      ]
    : [
        {
          key: 'campaigns',
          label: 'Campaigns',
          href: '/campaigns',
          active: activeTab === 'campaign',
        },
        {
          key: 'characters',
          label: CAMPAIGN_SECTIONS.characters.label,
          href: '/characters',
          active: activeTab === 'characters',
        },
      ];
  return { campaignPages, militiaPages, sectionLinks };
}

function buildPhoneTabs(
  selectedCampaign: NavigationCampaign | undefined,
  activeTab: PhoneTab,
  militiaHref: string | null,
): PhoneNavigationTab[] {
  return [
    {
      key: 'campaign',
      label: 'Campaign',
      href: selectedCampaign ? campaignPath(selectedCampaign.id) : '/campaigns',
      active: activeTab === 'campaign',
      unavailable: false,
    },
    {
      key: 'militia',
      label: CAMPAIGN_SECTIONS.militia.label,
      href: militiaHref,
      active: activeTab === 'militia' && militiaHref !== null,
      unavailable: militiaHref === null,
    },
    {
      key: 'characters',
      label: CAMPAIGN_SECTIONS.characters.label,
      href: '/characters',
      active: activeTab === 'characters',
      unavailable: false,
    },
    {
      key: 'more',
      label: 'More',
      href: null,
      active: false,
      unavailable: false,
    },
  ];
}

export function buildAppNavigation(
  input: AppNavigationInput & { memory?: NavigationMemory },
) {
  const { pathname, campaigns, week, memory = {} } = input;
  const isSheet =
    resolveNavigationLocation(pathname)?.kind === 'character-sheet';
  const origin = isSheet
    ? readCharacterSheetOrigin(input.searchParams)
    : undefined;
  const location = resolveNavigationLocation(origin?.href ?? pathname);
  let campaign: NavigationCampaign | undefined;
  if (location?.kind === 'campaign')
    campaign =
      input.campaign?.id === location.campaignId
        ? input.campaign
        : campaigns.find((item) => item.id === location.campaignId);
  const remembered = campaigns.find(
    (item) =>
      item.id ===
      memory.campaigns?.[input.organizationId ?? PERSONAL_ORGANIZATION],
  );
  const selectedCampaign = campaign ?? remembered;
  const activeTab = resolveActiveTab(location, campaign);
  const { campaignPages, militiaPages, sectionLinks } = buildSectionLinks(
    campaign,
    location,
    activeTab,
    week,
  );
  const militiaHref =
    selectedCampaign && selectedCampaign.hasMilitia !== false
      ? rememberedMilitiaPath(selectedCampaign.id, memory)
      : null;
  let pageStrip: NavigationLink[] = [];
  if (activeTab === 'militia') pageStrip = militiaPages;
  else if (activeTab === 'campaign') pageStrip = campaignPages;
  return {
    campaign,
    campaigns,
    placeLabel:
      campaign?.name ??
      (activeTab === 'characters' ? 'Characters' : 'Campaigns'),
    sectionLinks,
    militiaPages,
    phoneTabs: buildPhoneTabs(selectedCampaign, activeTab, militiaHref),
    activeTab,
    isSheet,
    pageStrip,
    militiaLoading: selectedCampaign?.hasMilitia === 'loading',
    militiaRailExpandedOnDesktop:
      !campaign || pathname !== campaignPath(campaign.id, 'week'),
    showMilitiaRail:
      !isSheet &&
      activeTab === 'militia' &&
      campaign !== undefined &&
      campaign.hasMilitia !== false,
    militiaUnavailable: militiaHref
      ? null
      : {
          title: 'No militia',
          message: selectedCampaign
            ? 'This campaign has no militia.'
            : 'Choose a campaign with a militia to open its pages.',
          switchHref: '/campaigns',
        },
  };
}

function rememberedMilitiaPath(campaignId: string, memory: NavigationMemory) {
  const href = memory.militia?.[campaignId];
  const location = href && resolveNavigationLocation(href);
  return location &&
    location.kind === 'campaign' &&
    location.campaignId === campaignId &&
    isMilitiaSection(location.section)
    ? href
    : campaignPath(campaignId, 'week');
}
