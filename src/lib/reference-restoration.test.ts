import { expect, test } from 'vitest';
import { acceptedCampaignSetup } from '../../tests/rules/accepted-campaign';
import { createWeeklyDraft } from './weekly-draft';
import { stagedReferences } from './correction-staged-choices';
import {
  holdsIdentity,
  missingIdentities,
  missingOfKind,
  noCapturedFacts,
  rememberFacts,
  restorableKinds,
  restoredRow,
} from './reference-restoration';

function openWeek() {
  const { state } = acceptedCampaignSetup('officer');
  const snapshot = structuredClone(state.militiaSnapshot);
  const patrol = snapshot.roster.teams[0]!;
  snapshot.roster.teams.push(
    { ...patrol, teamId: 'scouts', name: 'Scouts', status: 'active' },
    { ...patrol, teamId: 'guards', name: 'Guards', status: 'active' },
  );
  const draft = createWeeklyDraft({
    draftId: 'week',
    week: state.week,
    context: state.context,
    slotIds: ['one', 'two', 'three'],
  });
  draft.activity.slots[0]!.choice = {
    choiceId: 'drill',
    actionId: 'drill_militia',
    teamId: 'scouts',
  };
  draft.activity.slots[2]!.choice = {
    choiceId: 'gold',
    actionId: 'earn_gold',
    teamId: 'guards',
  };
  draft.upkeep.teamDecisions = [{ teamId: 'scouts', decision: 'leave' }];
  return { draft, snapshot };
}

const withoutTeams = (
  snapshot: ReturnType<typeof openWeek>['snapshot'],
  ...removed: string[]
) => ({
  ...snapshot,
  roster: {
    ...snapshot.roster,
    teams: snapshot.roster.teams.filter(
      (team) => !removed.includes(team.teamId),
    ),
  },
});

test('each missing team is listed once with every choice that uses it', () => {
  const { draft, snapshot } = openWeek();
  const removed = withoutTeams(snapshot, 'scouts', 'guards');
  const missing = missingIdentities(
    stagedReferences(draft, removed),
    noCapturedFacts,
    removed,
  );
  expect(
    missing.map(({ kind, id, neededBy, captured }) => ({
      kind,
      id,
      neededBy: neededBy.map((reference) => reference.key),
      captured,
    })),
  ).toEqual([
    {
      kind: 'team',
      id: 'scouts',
      neededBy: ['upkeepTeam:scouts', 'activitySlot:one'],
      captured: null,
    },
    {
      kind: 'team',
      id: 'guards',
      neededBy: ['activitySlot:three'],
      captured: null,
    },
  ]);
});

test('facts this device saw accepted are reused; otherwise the restored row keeps only its identity', () => {
  const { draft, snapshot } = openWeek();
  const scouts = snapshot.roster.teams[1]!;
  const seen = rememberFacts(noCapturedFacts, snapshot);
  const removed = withoutTeams(snapshot, 'scouts', 'guards');
  // A later accepted militia without the teams does not forget them.
  const captured = rememberFacts(seen, removed);
  const [withFacts] = missingIdentities(
    stagedReferences(draft, removed),
    captured,
    removed,
  );
  expect(restoredRow(withFacts!)).toEqual(scouts);

  // After a reload (nothing seen) the name, type and condition are entered
  // again; nothing is invented.
  const [blank] = missingIdentities(
    stagedReferences(draft, removed),
    rememberFacts(noCapturedFacts, removed),
    removed,
  );
  expect(restoredRow(blank!)).toEqual({
    teamId: 'scouts',
    name: '',
    teamType: undefined,
    status: undefined,
    rewardCapExempt: false,
    managerCharacterId: null,
    notes: '',
  });
});

test('a missing settlement restores with its identity and unrecorded facts', () => {
  const { draft, snapshot } = openWeek();
  draft.activity.operatingSettlementId = 'town';
  // Orders carried into the week need Town, so a correction could not have
  // removed it; an older week's source is enough to show the restoration.
  draft.context = { ...draft.context, orders: [] };
  const removed = { ...snapshot, settlements: [] };
  const [town] = missingIdentities(
    stagedReferences(draft, removed),
    noCapturedFacts,
    removed,
  );
  expect(town).toMatchObject({ kind: 'settlement', id: 'town' });
  expect(restoredRow(town!)).toEqual({
    settlementId: 'town',
    name: '',
    reputation: null,
    secured: null,
    occupied: null,
    temporaryReputationShift: null,
    refugeActivatedWeek: null,
    refugeActiveUntilWeek: null,
  });
});

test('restorable kinds belong to their section and a restored identity is recognised', () => {
  expect(restorableKinds('teams')).toEqual(['team']);
  expect(restorableKinds('settlements')).toEqual(['settlement']);
  expect(restorableKinds('values')).toEqual([]);
  const { snapshot } = openWeek();
  expect(holdsIdentity('team', snapshot.roster.teams, 'scouts')).toBe(true);
  expect(holdsIdentity('team', snapshot.roster.teams, 'lost')).toBe(false);
});

// Items and caches (#177): a Secure Cache retrieval uses a cache that holds
// a ring, and a rolled event targets a gem.
function openAssetWeek() {
  const { draft, snapshot } = openWeek();
  const economy = snapshot.economy!;
  const ring = {
    itemId: 'ring',
    name: 'Ring',
    valueCopper: 500,
    weight: 0.1,
    location: 'cache' as const,
    identified: true,
  };
  const gem = {
    itemId: 'gem',
    name: 'Gem',
    valueCopper: 200,
    weight: 0.5,
    location: 'held' as const,
  };
  const mill = {
    cacheId: 'mill',
    cacheClass: 'minor' as const,
    location: 'Old Mill',
    secure: true,
    extradimensional: false,
    itemIds: ['ring'],
    status: 'hidden' as const,
    returnActivityWeek: null,
  };
  economy.items.push(ring, gem);
  economy.caches.push(mill);
  draft.activity.slots[1]!.choice = {
    choiceId: 'fetch',
    actionId: 'secure_cache',
    mode: 'retrieve',
    cacheId: 'mill',
  };
  draft.event.occurrences = [
    {
      eventId: 'rolled',
      origin: { kind: 'rolled' },
      eventType: 'theft',
      targets: [{ kind: 'item', itemId: 'gem' }],
    },
  ];
  return { draft, snapshot, ring, gem, mill };
}
type AssetSnapshot = ReturnType<typeof openAssetWeek>['snapshot'];
const withoutAssets = (
  snapshot: AssetSnapshot,
  items: string[],
  caches: string[],
): AssetSnapshot => ({
  ...snapshot,
  economy: {
    ...snapshot.economy!,
    items: snapshot.economy!.items.filter(
      (item) => !items.includes(item.itemId),
    ),
    caches: snapshot.economy!.caches.filter(
      (cache) => !caches.includes(cache.cacheId),
    ),
  },
});

test('missing items and caches are listed with the choices that use them; items a cache holds are restored first', () => {
  const { draft, snapshot, ring, gem, mill } = openAssetWeek();
  const seen = rememberFacts(noCapturedFacts, snapshot);
  const removed = withoutAssets(snapshot, ['ring', 'gem'], ['mill']);
  const missing = missingIdentities(
    stagedReferences(draft, removed),
    rememberFacts(seen, removed),
    removed,
  );
  expect(
    missing.map(({ kind, id, neededBy, captured, requires, requiredBy }) => ({
      kind,
      id,
      neededBy: neededBy.map((reference) => reference.key),
      captured,
      requires,
      requiredBy,
    })),
  ).toEqual([
    {
      kind: 'cache',
      id: 'mill',
      neededBy: ['activitySlot:two'],
      captured: mill,
      requires: [{ kind: 'item', id: 'ring' }],
      requiredBy: [],
    },
    {
      kind: 'item',
      id: 'gem',
      neededBy: ['event:rolled'],
      captured: gem,
      requires: [],
      requiredBy: [],
    },
    {
      kind: 'item',
      id: 'ring',
      neededBy: [],
      captured: ring,
      requires: [],
      requiredBy: [{ kind: 'cache', id: 'mill' }],
    },
  ]);
  expect(restoredRow(missingOfKind(missing, 'cache').at(0)!)).toEqual(mill);

  // Once the items are back, the cache needs nothing first.
  const itemsBack = withoutAssets(snapshot, [], ['mill']);
  const [cache, ...rest] = missingIdentities(
    stagedReferences(draft, itemsBack),
    rememberFacts(seen, removed),
    itemsBack,
  );
  expect(cache).toMatchObject({ kind: 'cache', id: 'mill', requires: [] });
  expect(rest).toEqual([]);
});

test('after a reload, a missing item or cache keeps only its identity and needs its facts entered again', () => {
  const { draft, snapshot } = openAssetWeek();
  const removed = withoutAssets(snapshot, ['ring', 'gem'], ['mill']);
  const missing = missingIdentities(
    stagedReferences(draft, removed),
    rememberFacts(noCapturedFacts, removed),
    removed,
  );
  // Nothing captured: no contents to restore first, and no item the week
  // does not itself use.
  expect(missing.map(({ kind, id, requires }) => [kind, id, requires])).toEqual(
    [
      ['cache', 'mill', []],
      ['item', 'gem', []],
    ],
  );
  expect(restoredRow(missingOfKind(missing, 'cache').at(0)!)).toEqual({
    cacheId: 'mill',
    cacheClass: undefined,
    location: '',
    secure: undefined,
    extradimensional: undefined,
    itemIds: [],
    status: undefined,
    returnActivityWeek: null,
  });
  expect(restoredRow(missingOfKind(missing, 'item').at(0)!)).toEqual({
    itemId: 'gem',
    name: '',
    valueCopper: undefined,
    weight: undefined,
    location: undefined,
  });
});

test('items and caches restore through their own sections', () => {
  expect(restorableKinds('items')).toEqual(['item']);
  expect(restorableKinds('caches')).toEqual(['cache']);
  expect(restorableKinds('orders')).toEqual([]);
});
