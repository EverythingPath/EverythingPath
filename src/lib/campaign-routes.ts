import type { MilitiaEntryKey } from './militia-correction-sections';

export const CAMPAIGN_SECTIONS = {
  home: { label: 'Home', area: 'campaign' },
  characters: { label: 'Characters', area: 'campaign' },
  week: { label: 'Week', area: 'militia' },
  history: { label: 'Finished weeks', area: 'militia' },
  militia: { label: 'Militia', area: 'militia' },
  officers: { label: 'Characters & officers', area: 'militia' },
  setup: { label: 'Setup', area: 'militia' },
} as const;
export type CampaignSection = keyof typeof CAMPAIGN_SECTIONS;
export const PERSONAL_ORGANIZATION = '__personal';

export function isMilitiaSection(section: CampaignSection) {
  return CAMPAIGN_SECTIONS[section].area === 'militia';
}

// Dynamic segments may arrive percent-encoded; a malformed encoding keeps the
// raw value, which the campaign gate then reports as unavailable.
export function decodeRouteSegment(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function campaignPath(
  campaignId: string,
  section: CampaignSection = 'home',
): string {
  const base = `/campaigns/${encodeURIComponent(campaignId)}`;
  return section === 'home' ? base : `${base}/${section}`;
}

export type OriginOrganization =
  | { kind: 'unrecorded' }
  | { kind: 'personal' }
  | { kind: 'organization'; id: string };

export type CharacterSheetOrigin = {
  href: string;
  organization: OriginOrganization;
};

export type NavigationLocation =
  | { kind: 'characters' | 'campaigns' }
  | { kind: 'character-sheet'; characterId: string }
  | { kind: 'campaign'; campaignId: string; section: CampaignSection };

const campaignRoute = new RegExp(
  `^/campaigns/([^/]+)(?:/(${Object.keys(CAMPAIGN_SECTIONS)
    .filter((section) => section !== 'home')
    .join('|')}))?$`,
);

export function resolveNavigationLocation(
  href: string,
): NavigationLocation | undefined {
  // URL construction never accepts a second host, backslash or fragment.
  if (!href.startsWith('/') || href.includes('\\') || href.includes('#'))
    return undefined;
  const [pathname] = href.split('?');
  if (pathname === '/characters') return { kind: 'characters' };
  if (pathname === '/campaigns') return { kind: 'campaigns' };
  // A sheet's Spells page belongs to the sheet: same Character, same origin.
  const sheet = pathname?.match(/^\/characters\/([^/]+)(?:\/spells)?$/);
  if (sheet?.[1])
    return {
      kind: 'character-sheet',
      characterId: decodeRouteSegment(sheet[1]),
    };
  const match = pathname?.match(campaignRoute);
  if (!match?.[1]) return undefined;
  return {
    kind: 'campaign',
    campaignId: decodeRouteSegment(match[1]),
    // Safe cast: campaignRoute only captures CAMPAIGN_SECTIONS keys.
    section: (match[2] ?? 'home') as CampaignSection,
  };
}

function isCharacterSheetOrigin(href: string) {
  const location = resolveNavigationLocation(href);
  return location !== undefined && location.kind !== 'character-sheet';
}

/** Only recognized app pages may become a sheet's origin or Back target. */
export function parseCharacterSheetOrigin(
  params: Pick<URLSearchParams, 'get'>,
): CharacterSheetOrigin | undefined {
  const href = params.get('from');
  if (!href || !isCharacterSheetOrigin(href)) return undefined;
  const organizationId = params.get('organizationId');
  let organization: OriginOrganization = { kind: 'unrecorded' };
  if (organizationId === '') organization = { kind: 'personal' };
  else if (organizationId !== null)
    organization = { kind: 'organization', id: organizationId };
  return { href, organization };
}

export function readCharacterSheetOrigin(
  params: string | { toString(): string } | null | undefined,
) {
  return parseCharacterSheetOrigin(new URLSearchParams(params?.toString()));
}

export type BackLink = {
  href: string;
  label: (typeof CAMPAIGN_SECTIONS)[CampaignSection]['label'] | 'Campaigns';
};

export function resolveCharacterSheetBack(
  origin?: CharacterSheetOrigin,
): BackLink {
  const location = origin && resolveNavigationLocation(origin.href);
  if (!origin || !location || location.kind === 'character-sheet')
    return { href: '/characters', label: 'Characters' };
  if (location.kind === 'campaign')
    return {
      href: origin.href,
      label: CAMPAIGN_SECTIONS[location.section].label,
    };
  return {
    href: origin.href,
    label: location.kind === 'campaigns' ? 'Campaigns' : 'Characters',
  };
}

function originParams(origin?: CharacterSheetOrigin) {
  const params = new URLSearchParams();
  if (origin && isCharacterSheetOrigin(origin.href)) {
    params.set('from', origin.href);
    if (origin.organization.kind === 'organization')
      params.set('organizationId', origin.organization.id);
    else if (origin.organization.kind === 'personal')
      params.set('organizationId', '');
  }
  return params;
}

/** Every sheet is independent of campaign membership; its origin is navigation only. */
export function characterSheetPath(
  characterId: string,
  origin?: CharacterSheetOrigin,
): string {
  const query = originParams(origin).toString();
  return `/characters/${encodeURIComponent(characterId)}${query ? `?${query}` : ''}`;
}

/** The sheet's Spells page keeps the sheet's origin and may open one Spellcasting. */
export function characterSpellsPath(
  characterId: string,
  origin?: CharacterSheetOrigin,
  spellcastingId?: string,
): string {
  const params = originParams(origin);
  if (spellcastingId) params.set('spellcasting', spellcastingId);
  const query = params.toString();
  return `/characters/${encodeURIComponent(characterId)}/spells${query ? `?${query}` : ''}`;
}

export function characterCreatePath(
  campaignId?: string,
  organization: OriginOrganization = { kind: 'unrecorded' },
): string {
  const params = new URLSearchParams();
  if (campaignId) {
    params.set('campaignId', campaignId);
    params.set('from', campaignPath(campaignId, 'characters'));
  } else {
    params.set('from', '/characters');
  }
  if (organization.kind === 'organization')
    params.set('organizationId', organization.id);
  else if (organization.kind === 'personal') params.set('organizationId', '');
  const query = params.toString();
  return `/characters/new${query ? `?${query}` : ''}`;
}

/** Changing organization preserves the independent Characters area and sheet origin. */
export function organizationSwitchPath(pathname: string, searchParams = '') {
  const location = resolveNavigationLocation(pathname);
  if (location?.kind === 'characters' || location?.kind === 'character-sheet')
    return `${pathname}${searchParams ? `?${searchParams}` : ''}`;
  return '/campaigns';
}

/** Militia, optionally with one page entry selected (`?section=teams`). */
export function militiaPath(
  campaignId: string,
  entry?: MilitiaEntryKey,
): string {
  const path = campaignPath(campaignId, 'militia');
  return entry ? `${path}?section=${encodeURIComponent(entry)}` : path;
}

export type PhaseView =
  | 'upkeep'
  | 'activity'
  | 'event'
  | 'persistent'
  | 'summary';

export function normalizePhase(value: string | null | undefined): PhaseView {
  switch (value) {
    case 'activity':
    case 'event':
    case 'persistent':
    case 'summary':
      return value;
    default:
      return 'upkeep';
  }
}

export function weekPath(campaignId: string, phase?: string | null): string {
  return `${campaignPath(campaignId, 'week')}?phase=${normalizePhase(phase)}`;
}

export type HistorySelection = {
  week?: number;
  recordId?: string;
  beforeSequence?: number;
};

type SearchParams = Pick<URLSearchParams, 'get'>;

function parseHistoryNumber(value: string | null): number | undefined {
  if (value === null || !/^\d+$/.test(value)) return undefined;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : undefined;
}

export function parseHistorySelection(params: SearchParams): HistorySelection {
  const selection: HistorySelection = {};
  const week = parseHistoryNumber(params.get('week'));
  const recordId = params.get('recordId');
  const beforeSequence = parseHistoryNumber(params.get('beforeSequence'));
  if (week !== undefined) selection.week = week;
  if (recordId) selection.recordId = recordId;
  if (beforeSequence !== undefined) selection.beforeSequence = beforeSequence;
  return selection;
}

export function historyPath(
  campaignId: string,
  selection: HistorySelection = {},
): string {
  const params = new URLSearchParams();
  if (selection.week !== undefined) params.set('week', String(selection.week));
  if (selection.recordId) params.set('recordId', selection.recordId);
  if (selection.beforeSequence !== undefined) {
    params.set('beforeSequence', String(selection.beforeSequence));
  }
  const query = params.toString();
  return `${campaignPath(campaignId, 'history')}${query ? `?${query}` : ''}`;
}
