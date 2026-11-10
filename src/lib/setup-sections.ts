// The Setup steps, shared with Militia corrections. Keys are stable; labels
// are the user-facing step names.
export const SETUP_SECTIONS = {
  startingPoint: 'Starting point',
  week: 'Week',
  people: 'People & officers',
  teams: 'Teams',
  settlements: 'Settlements',
  characterConditions: 'Character conditions',
  assets: 'Assets',
  carriedEffects: 'Carried effects',
  review: 'Review & start',
} as const;
export type SetupSectionKey = keyof typeof SETUP_SECTIONS;
export const SETUP_ASSET_SUBSECTIONS = [
  'items',
  'caches',
  'orders',
  'marketplaces',
] as const;
export type SetupAssetSubsection = (typeof SETUP_ASSET_SUBSECTIONS)[number];
export const SETUP_CARRIED_SUBSECTIONS = [
  'events',
  'queuedEffects',
  'bonuses',
  'skillBenefits',
  'marketDayBenefits',
] as const;
export type SetupCarriedSubsection = (typeof SETUP_CARRIED_SUBSECTIONS)[number];
export type SetupLocation =
  | { section: Exclude<SetupSectionKey, 'assets' | 'carriedEffects'> }
  | { section: 'assets'; subsection?: SetupAssetSubsection }
  | { section: 'carriedEffects'; subsection?: SetupCarriedSubsection };

// A message for one step. `field` is the dotted form path of the control or
// list entry that the message concerns, when there is one.
export type SetupSectionMessage = SetupLocation & {
  message: string;
  field?: string;
};

type Path = readonly PropertyKey[];
const startingPointValues = new Set([
  'focus',
  'rank',
  'training',
  'treasuryCopper',
  'notoriety',
]);
const weekContext = new Set([
  'firstMilitiaWeek',
  'startDay',
  'uneventfulCarry',
  'operatedSettlementIds',
  'lastBuyoffWeek',
]);
const assetLists: Record<string, SetupAssetSubsection> = {
  items: 'items',
  caches: 'caches',
  orders: 'orders',
  markets: 'marketplaces',
};

function snapshotLocation([key, list]: Path): SetupLocation | undefined {
  if (typeof key !== 'string') return undefined;
  if (startingPointValues.has(key)) return { section: 'startingPoint' };
  switch (key) {
    case 'roster':
      return { section: list === 'teams' ? 'teams' : 'people' };
    case 'characters':
      return { section: 'people' };
    case 'settlements':
      return { section: 'settlements' };
    case 'characterActions':
      return { section: 'characterConditions' };
    case 'economy': {
      const subsection =
        typeof list === 'string' ? assetLists[list] : undefined;
      return subsection
        ? { section: 'assets', subsection }
        : { section: 'assets' };
    }
    case 'bonuses':
      return { section: 'carriedEffects', subsection: 'bonuses' };
    case 'eventBenefits':
      return list === 'skills'
        ? { section: 'carriedEffects', subsection: 'skillBenefits' }
        : list === 'markets'
          ? { section: 'carriedEffects', subsection: 'marketDayBenefits' }
          : { section: 'carriedEffects' };
  }
  return undefined;
}
function contextLocation([key]: Path): SetupLocation | undefined {
  if (typeof key !== 'string') return undefined;
  if (weekContext.has(key)) return { section: 'week' };
  switch (key) {
    case 'carriedEvents':
      return { section: 'carriedEffects', subsection: 'events' };
    case 'queuedEffects':
      return { section: 'carriedEffects', subsection: 'queuedEffects' };
    case 'orders':
      return { section: 'assets', subsection: 'orders' };
  }
  return undefined;
}

// The step (and subsection) that owns a Setup form path. Root and
// cross-section paths return undefined.
export function setupLocationForPath(path: Path): SetupLocation | undefined {
  const [key, part, ...rest] = path;
  switch (key) {
    case 'mode':
      return { section: 'startingPoint' };
    case 'phase':
      return { section: 'week' };
    case 'notes':
      return { section: 'review' };
    case 'state':
      if (part === 'week') return { section: 'week' };
      if (part === 'militiaSnapshot') return snapshotLocation(rest);
      if (part === 'context') return contextLocation(rest);
  }
  return undefined;
}
