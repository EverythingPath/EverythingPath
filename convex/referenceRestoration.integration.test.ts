// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';
import { seedAcceptedCampaign } from './lib/acceptedCampaignFixture';
import {
  closedCorrection,
  correctionReducer,
  planSectionSave,
  type AcceptedMilitia,
} from '../src/components/militia-corrections/correction-lifecycle';
import {
  correctionImpact,
  stagedReferences,
} from '../src/lib/correction-staged-choices';
import {
  mergeSection,
  sectionValue,
  type MilitiaSectionKey,
  type SectionValue,
} from '../src/lib/militia-correction-sections';
import {
  holdsIdentity,
  missingIdentities,
  noCapturedFacts,
  rememberFacts,
  missingOfKind,
  restoredRow,
  type CapturedFacts,
} from '../src/lib/reference-restoration';
import { weeklyDraftSchema } from '../src/lib/weekly-draft-contract';
import type { DraftOperation } from '../src/lib/weekly-draft-persistence-contract';

// Reference restoration (#176, LEDG-13) through the real ledger and draft
// APIs on two devices: a correction removes two teams that staged choices
// use; the whole-draft check refuses every draft edit until both exist
// again; each device restores one under its identity through an ordinary
// reasoned Teams correction, one from facts it saw and one, as after a
// reload, from facts entered again; then the choices are repaired and the
// intended removal is made as a new correction. Items and caches (#177)
// recover the same way, alongside teams and settlements, with the items a
// cache holds restored before it.

const modules = import.meta.glob('./**/*.ts');

async function fixture() {
  const t = convexTest(schema, modules);
  const player = t.withIdentity({ tokenIdentifier: 'test|player' });
  const gm = t.withIdentity({ tokenIdentifier: 'test|gm' });
  const seeded = await player.run((ctx) => seedAcceptedCampaign(ctx));
  const scope = {
    campaignId: seeded.key.campaignId,
    militiaId: seeded.key.militiaId,
  };
  return { t, player, gm, scope, draftId: seeded.key.draftId };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
type Client = Fixture['player'];
type Snapshot = AcceptedMilitia['state']['militiaSnapshot'];
type Team = Snapshot['roster']['teams'][number];

// One device: what it has observed and its edits through the public APIs.
function device(client: Client, { scope, draftId }: Fixture) {
  let seen: CapturedFacts = noCapturedFacts;
  let operation = 0;
  const key = { ...scope, draftId };
  const read = async (): Promise<AcceptedMilitia> => {
    const ledger = await client.query(api.canonicalLedger.read, scope);
    seen = rememberFacts(seen, ledger.state.militiaSnapshot);
    return { ...ledger, draftId };
  };
  const observe = async () => {
    const observation = await client.query(
      api.canonicalDraftPersistence.observe,
      key,
    );
    return {
      revision: observation.revision,
      draft: weeklyDraftSchema.parse(observation.draft),
    };
  };
  const edit = async (intent: DraftOperation['edit']) => {
    const { revision } = await observe();
    return client.mutation(api.canonicalDraftPersistence.edit, {
      ...scope,
      operation: {
        draftId,
        operationId: `${draftId}:${++operation}:${intent.kind}`,
        baseRevision: revision,
        edit: intent,
      },
    });
  };
  // Opens a section correction on the militia this device has observed.
  const open = (section: MilitiaSectionKey, accepted: AcceptedMilitia) =>
    correctionReducer(closedCorrection, {
      type: 'open',
      target: { kind: 'section', section },
      accepted,
    });
  async function correct<K extends MilitiaSectionKey>(
    correction: ReturnType<typeof open>,
    section: K,
    yours: (latest: SectionValue<K>) => SectionValue<K>,
    reason: string,
  ) {
    const latest = await read();
    const plan = planSectionSave(
      correction,
      latest,
      section,
      yours(sectionValue(section, latest.state.militiaSnapshot)),
    );
    if (plan.kind === 'send')
      await client.mutation(api.canonicalLedger.save, {
        ...scope,
        expectedRevision: plan.attempt.expectedRevision,
        snapshot: plan.snapshot,
        reason,
      });
    return plan;
  }
  return {
    read,
    observe,
    edit,
    open,
    correct,
    captured: () => seen,
  };
}

const team = (teamId: string, name: string): Team => ({
  teamId,
  name,
  teamType: 'defenders',
  status: 'active',
  rewardCapExempt: false,
  managerCharacterId: null,
  notes: `${name} notes`,
});
const scouts = team('scouts', 'Scouts');
const guards = team('guards', 'Guards');
const refused = 'Invalid draft entity reference';

test('two staged teams removed by a correction are restored under their identities on two devices, then removed as intended', async () => {
  const setup = await fixture();
  const player = device(setup.player, setup);
  const gm = device(setup.gm, setup);

  // Two removable teams, each used by a staged Activity slot.
  const adding = player.open('teams', await player.read());
  await player.correct(
    adding,
    'teams',
    (teams) => [...teams, scouts, guards],
    'Recruited scouts and guards',
  );
  for (const slotId of ['one', 'two'])
    await player.edit({ kind: 'add_slot', slotId });
  await player.edit({
    kind: 'stage',
    slotId: 'one',
    choice: { choiceId: 'drill', actionId: 'drill_militia', teamId: 'scouts' },
  });
  await gm.edit({
    kind: 'stage',
    slotId: 'two',
    choice: { choiceId: 'gold', actionId: 'earn_gold', teamId: 'guards' },
  });

  // The GM removes both: the preflight names both slots, against the live
  // draft and the candidate as both sources.
  const opened = await gm.read();
  await player.read();
  const removing = gm.open('teams', opened);
  const removeBoth = (teams: Team[]) =>
    teams.filter((item) => !['scouts', 'guards'].includes(item.teamId));
  const { draft } = await gm.observe();
  const candidate = mergeSection(
    'teams',
    opened.state.militiaSnapshot,
    removeBoth(sectionValue('teams', opened.state.militiaSnapshot)),
  );
  expect(
    correctionImpact(draft, opened.state.militiaSnapshot, candidate).added.map(
      ({ key, missing }) => [key, missing],
    ),
  ).toEqual([
    ['activitySlot:one', [{ kind: 'team', id: 'scouts' }]],
    ['activitySlot:two', [{ kind: 'team', id: 'guards' }]],
  ]);
  expect(
    (await gm.correct(removing, 'teams', removeBoth, 'Both teams disbanded'))
      .kind,
  ).toBe('send');

  // Both devices now see both choices without their team.
  for (const current of [player, gm]) {
    const latest = await current.read();
    const references = stagedReferences(
      (await current.observe()).draft,
      latest.state.militiaSnapshot,
    );
    expect(references.map((reference) => reference.key)).toEqual([
      'activitySlot:one',
      'activitySlot:two',
    ]);
  }
  const preview = await setup.player.query(
    api.canonicalDraftPersistence.preview,
    { ...setup.scope, draftId: setup.draftId },
  );
  expect(preview.status).toBe('incomplete');
  expect(preview.requirements).toEqual(
    expect.arrayContaining(['drill:team:reference', 'gold:team:reference']),
  );

  // An unrelated edit and a one-slot clear both leave an orphan: refused.
  const before = (await player.observe()).revision;
  await expect(
    player.edit({ kind: 'upkeep_settlement', settlementId: 'town' }),
  ).rejects.toThrow(refused);
  await expect(
    player.edit({ kind: 'clear', slotId: 'one', choiceId: 'drill' }),
  ).rejects.toThrow(refused);
  expect((await player.observe()).revision).toBe(before);

  // The player saw both teams before the removal; the GM's device, as after
  // a reload, knows none of their facts.
  const playerSource = (await player.read()).state.militiaSnapshot;
  const playerMissing = missingIdentities(
    stagedReferences((await player.observe()).draft, playerSource),
    player.captured(),
    playerSource,
  );
  expect(playerMissing.map(({ id, captured }) => [id, captured])).toEqual([
    ['scouts', scouts],
    ['guards', guards],
  ]);
  const gmSource = (await gm.read()).state.militiaSnapshot;
  const reloaded = missingIdentities(
    stagedReferences((await gm.observe()).draft, gmSource),
    noCapturedFacts,
    gmSource,
  );
  expect(reloaded.map(({ id, captured }) => [id, captured])).toEqual([
    ['scouts', null],
    ['guards', null],
  ]);

  // Both open a Teams correction. The player restores Scouts from its
  // captured facts first.
  const playerRestoring = player.open('teams', await player.read());
  const gmRestoring = gm.open('teams', await gm.read());
  expect(
    (
      await player.correct(
        playerRestoring,
        'teams',
        (teams) => [
          ...teams,
          restoredRow(missingOfKind(playerMissing, 'team').at(0)!),
        ],
        'Scouts were removed by mistake',
      )
    ).kind,
  ).toBe('send');

  // The GM's Teams correction is now a conflict: it starts again from the
  // newest Teams, where Scouts already exists, and restores only Guards,
  // entering its facts (nothing is invented).
  const blank = restoredRow(missingOfKind(reloaded, 'team').at(1)!);
  expect(blank).toMatchObject({ teamId: 'guards', name: '' });
  expect(
    await gm.correct(
      gmRestoring,
      'teams',
      (teams) => [...teams, { ...blank, ...team('guards', 'Gate guards') }],
      'Guards were removed by mistake',
    ),
  ).toEqual({ kind: 'conflict' });
  const latest = await gm.read();
  const restarted = correctionReducer(gmRestoring, {
    type: 'restart',
    accepted: latest,
  });
  const still = missingIdentities(
    stagedReferences((await gm.observe()).draft, latest.state.militiaSnapshot),
    noCapturedFacts,
    latest.state.militiaSnapshot,
  );
  expect(still.map(({ id }) => id)).toEqual(['guards']);
  expect(
    holdsIdentity('team', latest.state.militiaSnapshot.roster.teams, 'scouts'),
  ).toBe(true);
  expect(
    (
      await gm.correct(
        restarted,
        'teams',
        (teams) => [...teams, { ...blank, ...team('guards', 'Gate guards') }],
        'Guards were removed by mistake',
      )
    ).kind,
  ).toBe('send');

  // Every reference exists again: the choices are repaired through normal
  // operations, then the intended removal is a new reviewed correction.
  const restored = await player.read();
  expect(
    restored.state.militiaSnapshot.roster.teams.map((item) => item.teamId),
  ).toEqual(['patrol', 'scouts', 'guards']);
  expect(
    stagedReferences(
      (await player.observe()).draft,
      restored.state.militiaSnapshot,
    ),
  ).toEqual([]);
  await player.edit({ kind: 'clear', slotId: 'one', choiceId: 'drill' });
  await gm.edit({ kind: 'clear', slotId: 'two', choiceId: 'gold' });
  const intended = player.open('teams', await player.read());
  const { draft: repaired } = await player.observe();
  const final = await player.read();
  expect(
    correctionImpact(
      repaired,
      final.state.militiaSnapshot,
      mergeSection(
        'teams',
        final.state.militiaSnapshot,
        removeBoth(sectionValue('teams', final.state.militiaSnapshot)),
      ),
    ).added,
  ).toEqual([]);
  await player.correct(intended, 'teams', removeBoth, 'Both teams disbanded');
  expect(
    (await gm.read()).state.militiaSnapshot.roster.teams.map(
      (item) => item.teamId,
    ),
  ).toEqual(['patrol']);
  // The week is editable again.
  await gm.edit({ kind: 'upkeep_settlement', settlementId: 'town' });

  const reasons = await setup.t.run((ctx) =>
    ctx.db
      .query('canonicalSourceCorrection')
      .collect()
      .then((rows) => rows.map((row) => row.reason)),
  );
  expect(reasons).toEqual([
    'Recruited scouts and guards',
    'Both teams disbanded',
    'Scouts were removed by mistake',
    'Guards were removed by mistake',
    'Both teams disbanded',
  ]);
});

test('a settlement an Activity and an Event choice use is restored from entered facts, and a settlement an order needs cannot be removed', async () => {
  const setup = await fixture();
  const player = device(setup.player, setup);
  const gm = device(setup.gm, setup);
  const teilwood = {
    settlementId: 'teilwood',
    name: 'Teilwood',
    reputation: 'Friendly' as const,
    secured: true,
    occupied: false,
    temporaryReputationShift: 0,
    refugeActivatedWeek: null,
    refugeActiveUntilWeek: null,
  };
  await player.correct(
    player.open('settlements', await player.read()),
    'settlements',
    (towns) => [...towns, teilwood],
    'Teilwood joined',
  );
  await player.edit({ kind: 'operating_settlement', settlementId: 'teilwood' });
  await gm.edit({
    kind: 'event_tree',
    occurrences: [
      {
        eventId: 'rolled',
        origin: { kind: 'rolled' },
        eventType: 'theft',
        targets: [{ kind: 'settlement', settlementId: 'teilwood' }],
      },
    ],
  });

  // Town is needed by an order: removing it is refused outright.
  await expect(
    gm.correct(
      gm.open('settlements', await gm.read()),
      'settlements',
      (towns) => towns.filter((town) => town.settlementId !== 'town'),
      'Town is gone',
    ),
  ).rejects.toThrow('Unknown referenced entity');

  await gm.correct(
    gm.open('settlements', await gm.read()),
    'settlements',
    (towns) => towns.filter((town) => town.settlementId !== 'teilwood'),
    'Teilwood fell',
  );
  const { draft } = await player.observe();
  const latest = await player.read();
  expect(
    stagedReferences(draft, latest.state.militiaSnapshot).map(
      ({ key, phase }) => [key, phase],
    ),
  ).toEqual([
    ['operatingSettlement', 'activity'],
    ['event:rolled', 'event'],
  ]);
  // Clearing the operating settlement alone leaves the Event orphaned.
  await expect(
    player.edit({ kind: 'operating_settlement', settlementId: null }),
  ).rejects.toThrow(refused);

  // After a reload: restored from entered facts, unrecorded facts left
  // unrecorded.
  const missing = missingIdentities(
    stagedReferences(draft, latest.state.militiaSnapshot),
    noCapturedFacts,
    latest.state.militiaSnapshot,
  );
  expect(missing).toMatchObject([{ kind: 'settlement', id: 'teilwood' }]);
  await player.correct(
    player.open('settlements', latest),
    'settlements',
    (towns) => [
      ...towns,
      {
        ...restoredRow(missingOfKind(missing, 'settlement').at(0)!),
        name: 'Teilwood',
      },
    ],
    'Teilwood still stands',
  );
  const restored = (await gm.read()).state.militiaSnapshot.settlements.at(-1);
  expect(restored).toEqual({
    settlementId: 'teilwood',
    name: 'Teilwood',
    reputation: null,
    secured: null,
    occupied: null,
    temporaryReputationShift: null,
    refugeActivatedWeek: null,
    refugeActiveUntilWeek: null,
  });
  await player.edit({ kind: 'operating_settlement', settlementId: null });
  await gm.edit({ kind: 'event_tree', occurrences: [] });
  await gm.correct(
    gm.open('settlements', await gm.read()),
    'settlements',
    (towns) => towns.filter((town) => town.settlementId !== 'teilwood'),
    'Teilwood fell',
  );
  expect(
    stagedReferences(
      (await gm.observe()).draft,
      (await gm.read()).state.militiaSnapshot,
    ),
  ).toEqual([]);
});

type Economy = NonNullable<Snapshot['economy']>;
type Item = Economy['items'][number];
type Cache = Economy['caches'][number];

test('mixed team, settlement, item and cache orphans are restored across separate corrections after a reload, items before the cache that holds them', async () => {
  const setup = await fixture();
  const player = device(setup.player, setup);
  const gm = device(setup.gm, setup);
  const teilwood = {
    settlementId: 'teilwood',
    name: 'Teilwood',
    reputation: 'Friendly' as const,
    secured: true,
    occupied: false,
    temporaryReputationShift: 0,
    refugeActivatedWeek: null,
    refugeActiveUntilWeek: null,
  };
  const ring: Item = {
    itemId: 'ring',
    name: 'Ring',
    valueCopper: 500,
    weight: 0.25,
    location: 'cache',
    identified: true,
  };
  const gem: Item = {
    itemId: 'gem',
    name: 'Gem',
    valueCopper: 200,
    weight: 0.5,
    location: 'held',
  };
  const mill: Cache = {
    cacheId: 'mill',
    cacheClass: 'minor',
    location: 'Old Mill',
    secure: true,
    extradimensional: false,
    itemIds: ['ring'],
    status: 'hidden',
    returnActivityWeek: null,
  };

  // Each source is added by its own correction.
  const add = async <K extends MilitiaSectionKey>(
    section: K,
    rows: (latest: SectionValue<K>) => SectionValue<K>,
    reason: string,
  ) =>
    expect(
      (
        await player.correct(
          player.open(section, await player.read()),
          section,
          rows,
          reason,
        )
      ).kind,
    ).toBe('send');
  await add('teams', (teams) => [...teams, scouts], 'Scouts joined');
  await add('settlements', (towns) => [...towns, teilwood], 'Teilwood joined');
  await add('items', (items) => [...items, ring, gem], 'Found a ring and gem');
  await add('caches', (caches) => [...caches, mill], 'Hid the ring');

  // The week uses all four kinds: Scouts drill, the Old Mill cache is
  // retrieved, and a rolled theft targets Teilwood and the gem.
  for (const slotId of ['one', 'two'])
    await player.edit({ kind: 'add_slot', slotId });
  await player.edit({
    kind: 'stage',
    slotId: 'one',
    choice: { choiceId: 'drill', actionId: 'drill_militia', teamId: 'scouts' },
  });
  await gm.edit({
    kind: 'stage',
    slotId: 'two',
    choice: {
      choiceId: 'fetch',
      actionId: 'secure_cache',
      mode: 'retrieve',
      cacheId: 'mill',
    },
  });
  await gm.edit({
    kind: 'event_tree',
    occurrences: [
      {
        eventId: 'rolled',
        origin: { kind: 'rolled' },
        eventType: 'theft',
        targets: [
          { kind: 'settlement', settlementId: 'teilwood' },
          { kind: 'item', itemId: 'gem' },
        ],
      },
    ],
  });
  await player.read();

  // The ring cannot go while the cache holds it.
  const withoutItems = (items: Item[]) =>
    items.filter((item) => !['ring', 'gem'].includes(item.itemId));
  await expect(
    gm.correct(
      gm.open('items', await gm.read()),
      'items',
      withoutItems,
      'Sold the ring and gem',
    ),
  ).rejects.toThrow('Unknown referenced entity');

  // The GM removes each source by its own correction; each preflight names
  // the choices it newly affects.
  const remove = async <K extends MilitiaSectionKey>(
    section: K,
    rows: (latest: SectionValue<K>) => SectionValue<K>,
    reason: string,
  ) => {
    const opened = await gm.read();
    const { draft } = await gm.observe();
    const source = opened.state.militiaSnapshot;
    const impact = correctionImpact(
      draft,
      source,
      mergeSection(section, source, rows(sectionValue(section, source))),
    );
    await gm.correct(gm.open(section, opened), section, rows, reason);
    return impact.added.map(({ key, missing }) => [key, missing]);
  };
  const withoutMill = (caches: Cache[]) =>
    caches.filter((cache) => cache.cacheId !== 'mill');
  expect(await remove('caches', withoutMill, 'The mill burned')).toEqual([
    ['activitySlot:two', [{ kind: 'cache', id: 'mill' }]],
  ]);
  expect(await remove('items', withoutItems, 'Sold the ring and gem')).toEqual([
    ['event:rolled', [{ kind: 'item', id: 'gem' }]],
  ]);
  expect(
    await remove(
      'teams',
      (teams) => teams.filter((item) => item.teamId !== 'scouts'),
      'Scouts disbanded',
    ),
  ).toEqual([['activitySlot:one', [{ kind: 'team', id: 'scouts' }]]]);
  expect(
    await remove(
      'settlements',
      (towns) => towns.filter((town) => town.settlementId !== 'teilwood'),
      'Teilwood fell',
    ),
  ).toEqual([['event:rolled', [{ kind: 'settlement', id: 'teilwood' }]]]);

  // Every choice is orphaned; Confirmation is blocked and every draft edit,
  // including clearing one choice while others remain, is refused.
  const preview = () =>
    setup.player.query(api.canonicalDraftPersistence.preview, {
      ...setup.scope,
      draftId: setup.draftId,
    });
  expect((await preview()).requirements).toEqual(
    expect.arrayContaining([
      'drill:team:reference',
      'fetch:cache:reference',
      'event:rolled:item:reference',
      'event:rolled:settlement:reference',
    ]),
  );
  const revision = (await player.observe()).revision;
  await expect(
    player.edit({ kind: 'upkeep_settlement', settlementId: 'town' }),
  ).rejects.toThrow(refused);
  await expect(
    player.edit({ kind: 'clear', slotId: 'two', choiceId: 'fetch' }),
  ).rejects.toThrow(refused);
  await expect(
    gm.edit({ kind: 'event_tree', occurrences: [] }),
  ).rejects.toThrow(refused);
  expect((await player.observe()).revision).toBe(revision);

  // What a device lists as missing, from what it has seen.
  const missingOn = async (on: ReturnType<typeof device>) => {
    const source = (await on.read()).state.militiaSnapshot;
    return missingIdentities(
      stagedReferences((await on.observe()).draft, source),
      on.captured(),
      source,
    );
  };
  // The player saw everything: the cache holds the ring, so the ring is
  // restored before it.
  const seen = await missingOn(player);
  expect(
    seen.map(({ kind, id, captured, requires }) => [
      kind,
      id,
      captured !== null,
      requires,
    ]),
  ).toEqual([
    ['team', 'scouts', true, []],
    ['cache', 'mill', true, [{ kind: 'item', id: 'ring' }]],
    ['settlement', 'teilwood', true, []],
    ['item', 'gem', true, []],
    ['item', 'ring', true, []],
  ]);
  await expect(
    player.correct(
      player.open('caches', await player.read()),
      'caches',
      (caches) => [...caches, restoredRow(missingOfKind(seen, 'cache').at(0)!)],
      'The mill still stands',
    ),
  ).rejects.toThrow('Unknown referenced entity');
  await player.correct(
    player.open('items', await player.read()),
    'items',
    (items) => [...items, ...missingOfKind(seen, 'item').map(restoredRow)],
    'The ring and gem were never sold',
  );

  // Another device after a reload has seen none of the removed facts. The
  // items already exist again, so it lists only the rest, and enters their
  // facts: nothing is invented.
  const reloaded = device(setup.gm, setup);
  const afterReload = await missingOn(reloaded);
  expect(
    afterReload.map(({ kind, id, captured, requires }) => [
      kind,
      id,
      captured,
      requires,
    ]),
  ).toEqual([
    ['team', 'scouts', null, []],
    ['cache', 'mill', null, []],
    ['settlement', 'teilwood', null, []],
  ]);
  const blankMill = restoredRow(missingOfKind(afterReload, 'cache').at(0)!);
  expect(blankMill).toMatchObject({
    cacheId: 'mill',
    location: '',
    itemIds: [],
  });
  await reloaded.correct(
    reloaded.open('caches', await reloaded.read()),
    'caches',
    (caches) => [
      ...caches,
      {
        ...blankMill,
        location: 'Old Mill',
        cacheClass: 'minor',
        secure: true,
        extradimensional: false,
        status: 'hidden',
        itemIds: ['ring'],
      },
    ],
    'The mill still stands',
  );
  await reloaded.correct(
    reloaded.open('settlements', await reloaded.read()),
    'settlements',
    (towns) => [
      ...towns,
      {
        ...restoredRow(missingOfKind(afterReload, 'settlement').at(0)!),
        name: 'Teilwood',
      },
    ],
    'Teilwood still stands',
  );
  await player.correct(
    player.open('teams', await player.read()),
    'teams',
    (teams) => [...teams, restoredRow(missingOfKind(seen, 'team').at(0)!)],
    'Scouts were removed by mistake',
  );

  // Every reference exists again, under the same identities.
  const restored = (await gm.read()).state.militiaSnapshot;
  expect(
    restored.economy?.items.filter((item) => item.itemId !== 'sword'),
  ).toEqual([gem, ring]);
  expect(restored.economy?.caches.at(-1)).toEqual(mill);
  expect(await missingOn(gm)).toEqual([]);
  expect(
    (await preview()).requirements.filter((key) => key.endsWith(':reference')),
  ).toEqual([]);

  // The choices are repaired through normal operations, then each intended
  // removal is a new reviewed correction.
  await player.edit({ kind: 'clear', slotId: 'one', choiceId: 'drill' });
  await gm.edit({ kind: 'clear', slotId: 'two', choiceId: 'fetch' });
  await gm.edit({ kind: 'event_tree', occurrences: [] });
  expect(await remove('caches', withoutMill, 'The mill burned')).toEqual([]);
  expect(await remove('items', withoutItems, 'Sold the ring and gem')).toEqual(
    [],
  );
  expect(
    await remove(
      'teams',
      (teams) => teams.filter((item) => item.teamId !== 'scouts'),
      'Scouts disbanded',
    ),
  ).toEqual([]);
  expect(
    await remove(
      'settlements',
      (towns) => towns.filter((town) => town.settlementId !== 'teilwood'),
      'Teilwood fell',
    ),
  ).toEqual([]);
  expect(await missingOn(player)).toEqual([]);
  // The week is editable again.
  await gm.edit({ kind: 'upkeep_settlement', settlementId: 'town' });
});
