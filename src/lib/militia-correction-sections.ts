import {
  weeklySourceKey,
  type CanonicalWeekState,
} from './canonical-weekly-source';
import type { SetupSectionMessage } from './setup-sections';

type Snapshot = CanonicalWeekState['militiaSnapshot'];
type Economy = NonNullable<Snapshot['economy']>;
type Benefits = NonNullable<Snapshot['eventBenefits']>;

// The nine sections a Militia Correction changes one at a time, in page
// order. Keys are stable; labels are the user-facing section names.
export const MILITIA_SECTIONS = {
  values: 'Values',
  teams: 'Teams',
  settlements: 'Settlements',
  characterConditions: 'Character conditions',
  items: 'Items',
  caches: 'Caches',
  orders: 'Orders',
  marketplaces: 'Marketplaces',
  carriedBenefits: 'Carried benefits',
} as const;
export type MilitiaSectionKey = keyof typeof MILITIA_SECTIONS;
// Safe cast: MILITIA_SECTIONS is keyed by exactly the MilitiaSectionKey values.
export const MILITIA_SECTION_KEYS = Object.keys(
  MILITIA_SECTIONS,
) as MilitiaSectionKey[];

// Every Militia page entry: the nine sections and the read-only Week &
// carried effects view. Roster people and officer roles are corrected on
// Characters & officers.
export type MilitiaEntryKey = MilitiaSectionKey | 'weekCarried';
export const MILITIA_ENTRY_LABELS: Record<MilitiaEntryKey, string> = {
  ...MILITIA_SECTIONS,
  weekCarried: 'Week & carried effects',
};

/** The page entry an address names (`?section=teams`), if any. */
export function parseMilitiaEntry(
  value: string | null | undefined,
): MilitiaEntryKey | undefined {
  // Safe cast: the cast branch only runs when MILITIA_ENTRY_LABELS owns value.
  return value && Object.hasOwn(MILITIA_ENTRY_LABELS, value)
    ? (value as MilitiaEntryKey)
    : undefined;
}

export type SectionValues = {
  values: Pick<
    Snapshot,
    'focus' | 'rank' | 'training' | 'treasuryCopper' | 'notoriety'
  >;
  teams: Snapshot['roster']['teams'];
  settlements: Snapshot['settlements'];
  characterConditions: NonNullable<Snapshot['characterActions']>['people'];
  items: Economy['items'];
  caches: Economy['caches'];
  orders: Economy['orders'];
  marketplaces: Economy['markets'];
  carriedBenefits: Pick<Benefits, 'skills' | 'markets'>;
};
export type SectionValue<K extends MilitiaSectionKey = MilitiaSectionKey> =
  SectionValues[K];

const economyLists = {
  items: 'items',
  caches: 'caches',
  orders: 'orders',
  marketplaces: 'markets',
} as const;
type EconomySection = keyof typeof economyLists;
const isEconomySection = (key: MilitiaSectionKey): key is EconomySection =>
  key in economyLists;

// Exactly the snapshot facts a section correction replaces. An absent
// optional container reads as empty.
export function sectionValue<K extends MilitiaSectionKey>(
  key: K,
  snapshot: Snapshot,
): SectionValue<K>;
export function sectionValue(
  key: MilitiaSectionKey,
  snapshot: Snapshot,
): SectionValue {
  if (isEconomySection(key)) return snapshot.economy?.[economyLists[key]] ?? [];
  switch (key) {
    case 'values': {
      const { focus, rank, training, treasuryCopper, notoriety } = snapshot;
      return { focus, rank, training, treasuryCopper, notoriety };
    }
    case 'teams':
      return snapshot.roster.teams;
    case 'settlements':
      return snapshot.settlements;
    case 'characterConditions':
      return snapshot.characterActions?.people ?? [];
    case 'carriedBenefits':
      return {
        skills: snapshot.eventBenefits?.skills ?? [],
        markets: snapshot.eventBenefits?.markets ?? [],
      };
  }
}

// Stable structural identity of a section, for comparing the value captured
// at Correct with the latest accepted one. Any change to the section, even
// to another row, is a change.
export function sectionKey(key: MilitiaSectionKey, snapshot: Snapshot): string {
  return weeklySourceKey(sectionValue(key, snapshot));
}

const isEmpty = (value: SectionValue) =>
  Array.isArray(value) && value.length === 0;

// Replaces only the edited section in the latest accepted snapshot. Every
// sibling list of a shared container (roster, economy, character actions,
// event benefits), the character records, one-use bonuses and all other
// facts stay exactly as they are in `latest`. An absent optional container
// stays absent when the correction leaves it empty.
export function mergeSection<K extends MilitiaSectionKey>(
  key: K,
  latest: Snapshot,
  value: SectionValue<K>,
): Snapshot;
export function mergeSection(
  key: MilitiaSectionKey,
  latest: Snapshot,
  value: SectionValue,
): Snapshot {
  if (isEconomySection(key)) {
    if (!latest.economy && isEmpty(value)) return latest;
    const economy: Economy = latest.economy ?? {
      items: [],
      caches: [],
      orders: [],
      markets: [],
    };
    return {
      ...latest,
      economy: { ...economy, [economyLists[key]]: value },
    };
  }
  switch (key) {
    case 'values':
      // Safe cast: the overload ties value to key, here the values section.
      return { ...latest, ...(value as SectionValues['values']) };
    case 'teams':
      return {
        ...latest,
        roster: {
          ...latest.roster,
          // Safe cast: the overload ties value to key, here the teams section.
          teams: value as SectionValues['teams'],
        },
      };
    case 'settlements':
      // Safe cast: the overload ties value to key, here the settlements
      // section.
      return { ...latest, settlements: value as SectionValues['settlements'] };
    case 'characterConditions':
      if (!latest.characterActions && isEmpty(value)) return latest;
      return {
        ...latest,
        characterActions: {
          ...latest.characterActions,
          // Safe cast: the overload ties value to key, here the
          // characterConditions section.
          people: value as SectionValues['characterConditions'],
        },
      };
    case 'carriedBenefits': {
      // Safe cast: the overload ties value to key, here the carriedBenefits
      // section.
      const benefits = value as SectionValues['carriedBenefits'];
      if (
        !latest.eventBenefits &&
        benefits.skills.length === 0 &&
        benefits.markets.length === 0
      )
        return latest;
      return {
        ...latest,
        eventBenefits: {
          ...latest.eventBenefits,
          skills: benefits.skills,
          markets: benefits.markets,
        },
      };
    }
  }
}

const valueFields = new Set([
  'focus',
  'rank',
  'training',
  'treasuryCopper',
  'notoriety',
]);

// The Militia page entry that owns a Setup location, so Setup's typed rules
// warnings and validation errors land on the right section. People and
// officers are corrected on Characters & officers; week context, carried
// events, queued effects and one-use bonuses are read-only here.
export function militiaEntryForLocation(
  message: Pick<SetupSectionMessage, 'section' | 'field'> & {
    subsection?: string;
  },
): MilitiaEntryKey | null {
  switch (message.section) {
    case 'startingPoint': {
      const field = message.field?.split('.').at(-1);
      return field && valueFields.has(field) ? 'values' : null;
    }
    case 'teams':
    case 'settlements':
    case 'characterConditions':
      return message.section;
    case 'week':
      return 'weekCarried';
    case 'assets':
      switch (message.subsection) {
        case 'items':
        case 'caches':
        case 'orders':
        case 'marketplaces':
          return message.subsection;
      }
      return null;
    case 'carriedEffects':
      return message.subsection === 'skillBenefits' ||
        message.subsection === 'marketDayBenefits'
        ? 'carriedBenefits'
        : 'weekCarried';
  }
  return null;
}
