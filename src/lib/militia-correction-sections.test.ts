import { describe, expect, test } from 'vitest';
import { acceptedCampaignSetup } from '../../tests/rules/accepted-campaign';
import { militiaSnapshotSchema } from './canonical-weekly-source';
import {
  MILITIA_SECTION_KEYS,
  mergeSection,
  militiaEntryForLocation,
  parseMilitiaEntry,
  sectionKey,
  sectionValue,
  type MilitiaSectionKey,
} from './militia-correction-sections';
import { militiaPath } from './campaign-routes';

test('a Militia address selects a page entry by its key; anything else selects none', () => {
  expect(militiaPath('c 1', 'teams')).toBe(
    '/campaigns/c%201/militia?section=teams',
  );
  expect(militiaPath('c1')).toBe('/campaigns/c1/militia');
  expect(parseMilitiaEntry('teams')).toBe('teams');
  // The retired People & officers fallback's address opens the page's
  // default entry: roster and officers are corrected on Characters & officers.
  expect(parseMilitiaEntry('people')).toBeUndefined();
  expect(parseMilitiaEntry('carriedBenefits')).toBe('carriedBenefits');
  for (const value of [null, '', 'toString', 'ledger'])
    expect(parseMilitiaEntry(value)).toBeUndefined();
});

const snapshot = () => acceptedCampaignSetup('officer').state.militiaSnapshot;

// A change that is structurally valid for each section.
const edits: {
  [K in MilitiaSectionKey]: (
    value: ReturnType<typeof sectionValue<K>>,
  ) => ReturnType<typeof sectionValue<K>>;
} = {
  values: (value) => ({ ...value, treasuryCopper: value.treasuryCopper + 1 }),
  teams: (teams) => teams.map((team) => ({ ...team, notes: 'Found' })),
  settlements: (towns) => towns.map((town) => ({ ...town, secured: false })),
  characterConditions: () => [
    {
      characterId: 'officer',
      status: 'hidden',
      location: { kind: 'headquarters' },
      directRescueRequired: false,
      capture: null,
    },
  ],
  items: (items) => items.map((item) => ({ ...item, weight: 3 })),
  caches: (caches) => caches.map((cache) => ({ ...cache, secure: false })),
  orders: (orders) => orders.map((order) => ({ ...order, deliveryDays: 2.5 })),
  marketplaces: () => [
    {
      marketId: 'fair',
      source: 'market_day',
      settlementId: 'town',
      availableWeek: 9,
      expiresWeek: 10,
      availability: null,
      availabilityPercent: null,
      salePercent: null,
      contraband: false,
    },
  ],
  carriedBenefits: (benefits) => ({
    ...benefits,
    markets: [
      {
        benefitId: 'fair-day',
        sourceEventIds: [],
        settlementIds: ['town'],
        discountPercent: 5,
        startsWeek: 9,
        endsWeek: 10,
      },
    ],
  }),
};

function edit<K extends MilitiaSectionKey>(key: K, base = snapshot()) {
  return edits[key](sectionValue(key, base));
}

describe('section merge', () => {
  test.each(MILITIA_SECTION_KEYS)(
    '%s replaces only its own facts in the latest snapshot',
    (key) => {
      const latest = snapshot();
      const value = edit(key, latest);
      const merged = mergeSection(key, latest, value);
      expect(militiaSnapshotSchema.safeParse(merged).success).toBe(true);
      expect(sectionValue(key, merged)).toEqual(value);
      for (const other of MILITIA_SECTION_KEYS.filter((x) => x !== key))
        expect(sectionKey(other, merged)).toBe(sectionKey(other, latest));
      expect(merged.characters).toBe(latest.characters);
      expect(merged.bonuses).toBe(latest.bonuses);
      expect(merged.roster.people).toBe(latest.roster.people);
      expect(merged.roster.officers).toBe(latest.roster.officers);
    },
  );

  test('an Items correction keeps caches, orders and markets another player changed meanwhile', () => {
    const opened = snapshot();
    const items = edit('items', opened);
    const latest = mergeSection(
      'orders',
      mergeSection('caches', opened, edit('caches', opened)),
      edit('orders', opened),
    );
    const merged = mergeSection('items', latest, items);
    expect(merged.economy?.items).toEqual(items);
    expect(merged.economy?.caches).toEqual(latest.economy?.caches);
    expect(merged.economy?.orders).toEqual(latest.economy?.orders);
    expect(merged.economy?.orders[0]?.deliveryDays).toBe(2.5);
  });

  test('a Teams correction keeps roster people and officer roles', () => {
    const latest = snapshot();
    latest.roster.officers = [
      ...latest.roster.officers,
      { role: 'marshal', characterId: 'officer' },
    ];
    const merged = mergeSection('teams', latest, edit('teams', latest));
    expect(merged.roster.officers).toEqual(latest.roster.officers);
    expect(merged.roster.people).toEqual(latest.roster.people);
  });

  test('a Values correction keeps a character record edited after the correction opened', () => {
    const opened = snapshot();
    const values = edit('values', opened);
    const latest = snapshot();
    latest.characters = [{ ...latest.characters[0]!, charisma: 20 }];
    const merged = mergeSection('values', latest, values);
    expect(merged.characters[0]?.charisma).toBe(20);
    expect(merged.treasuryCopper).toBe(opened.treasuryCopper + 1);
  });

  test('absent optional containers stay absent unless the correction adds to them', () => {
    const latest = snapshot();
    delete latest.economy;
    delete latest.characterActions;
    delete latest.eventBenefits;
    expect(sectionValue('items', latest)).toEqual([]);
    expect(mergeSection('items', latest, [])).toBe(latest);
    expect(mergeSection('characterConditions', latest, [])).toBe(latest);
    expect(
      mergeSection('carriedBenefits', latest, { skills: [], markets: [] }),
    ).toBe(latest);
    const withMarket = mergeSection(
      'marketplaces',
      latest,
      edit('marketplaces', latest),
    );
    expect(withMarket.economy).toEqual({
      items: [],
      caches: [],
      orders: [],
      markets: edit('marketplaces', latest),
    });
  });
});

describe('section identity', () => {
  test('a change to any row of the section changes its identity; key order does not', () => {
    const base = snapshot();
    const reordered = militiaSnapshotSchema.parse(
      JSON.parse(JSON.stringify(base)),
    );
    expect(sectionKey('teams', reordered)).toBe(sectionKey('teams', base));
    const changed = mergeSection('teams', base, edit('teams', base));
    expect(sectionKey('teams', changed)).not.toBe(sectionKey('teams', base));
    expect(sectionKey('values', changed)).toBe(sectionKey('values', base));
  });
});

describe('warning locations', () => {
  test.each([
    [
      { section: 'startingPoint', field: 'state.militiaSnapshot.rank' },
      'values',
    ],
    [{ section: 'startingPoint', field: 'mode' }, null],
    [{ section: 'teams' }, 'teams'],
    [{ section: 'people' }, null],
    [{ section: 'week', field: 'phase' }, 'weekCarried'],
    [{ section: 'assets', subsection: 'caches' }, 'caches'],
    [{ section: 'assets', subsection: 'marketplaces' }, 'marketplaces'],
    [
      { section: 'carriedEffects', subsection: 'skillBenefits' },
      'carriedBenefits',
    ],
    [{ section: 'carriedEffects', subsection: 'queuedEffects' }, 'weekCarried'],
    [{ section: 'review' }, null],
  ] as const)('%o belongs to %s', (location, entry) => {
    expect(militiaEntryForLocation(location)).toBe(entry);
  });
});
