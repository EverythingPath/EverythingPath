import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, test } from 'vitest';
import type { ReactNode } from 'react';
import { createWeeklyDraft } from '~/lib/weekly-draft';
import { createMemoryDraftAuthority } from '~/lib/memory-draft-persistence';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import type { WorkspaceGateway } from './gateway';
import {
  WeeklyDraftWorkspaceProvider,
  useWeeklyDraftWorkspace,
} from './use-weekly-draft-workspace';
import { useEventEdits } from './use-event-edits';
type Team = { teamId: string; teamType: 'patrons'; name: string };
function fixture(teams: Team[] = []) {
  const draft = createWeeklyDraft({
    draftId: 'workspace',
    week: 4,
    slotIds: ['left'],
    context: {
      firstMilitiaWeek: false,
      startDay: 21,
      uneventfulCarry: false,
      carriedEvents: [],
      queuedEffects: [],
      orders: [],
      lastBuyoffWeek: null,
    },
  });
  draft.event.chanceRoll = {
    diceTotal: 100,
    diceCount: 1,
    sides: 100,
    provenance: { kind: 'table' },
    modifiers: [],
  };
  const source = workspaceSourceSchema.parse({
    key: {
      campaignId: 'campaign',
      militiaId: 'militia',
      draftId: draft.draftId,
    },
    week: draft.week,
    sourceRevision: 0,
    snapshot: {
      rank: 2,
      training: 14,
      treasuryCopper: 5000,
      notoriety: 0,
      focus: 'Loyalty',
      roster: {
        people: [{ characterId: 'pc', kind: 'pc', hitDice: 2 }],
        teams: teams.map((team) => ({
          ...team,
          status: 'active' as const,
          managerCharacterId: null,
          rewardCapExempt: false,
          notes: '',
        })),
        officers: [],
      },
      characters: [
        {
          characterId: 'pc',
          level: 2,
          strength: 10,
          dexterity: 10,
          constitution: 10,
          intelligence: 10,
          wisdom: 10,
          charisma: 10,
          isActive: true,
        },
      ],
      settlements: [],
      bonuses: [],
    },
    people: [],
  });
  const authority = createMemoryDraftAuthority(draft, source.snapshot);
  const gateway: WorkspaceGateway = {
    subscribe(next) {
      next(source);
      return () => undefined;
    },
    transport() {
      return authority.transport;
    },
  };
  return { gateway, authority, source };
}
function renderWorkspace(gateway: WorkspaceGateway | null) {
  return renderHook(() => useWeeklyDraftWorkspace(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <WeeklyDraftWorkspaceProvider gateway={gateway}>
        {children}
      </WeeklyDraftWorkspaceProvider>
    ),
  });
}
function roll(field: 'check' | 'training', value: number) {
  return {
    kind: 'upkeep_roll' as const,
    field,
    roll: {
      diceTotal: value,
      diceCount: 1,
      sides: field === 'check' ? 20 : 6,
      provenance: { kind: 'table' as const },
      modifiers: [],
    },
  };
}
test('[rules.P81.workspace] only ready exposes semantic operations and derived Upkeep facts', async () => {
  const unavailable = renderWorkspace(null);
  expect(unavailable.result.current).toEqual({ status: 'unavailable' });
  unavailable.unmount();
  const { gateway } = fixture();
  const screen = renderWorkspace(gateway);
  await waitFor(() => expect(screen.result.current.status).toBe('ready'));
  let view = screen.result.current;
  if (view.status !== 'ready' || view.phaseView.phase !== 'upkeep')
    throw new Error('Expected Upkeep');
  expect(view.phaseView.rolls[0]).toMatchObject({
    field: 'check',
    recorded: null,
    modifier: 3,
    dc: 10,
  });
  expect(view.canConfirm).toBe(false);
  await act(async () => {
    if (view.status === 'ready') await view.edit(roll('check', 10));
  });
  view = screen.result.current;
  if (view.status !== 'ready') throw new Error('Expected ready');
  await act(async () => {
    if (view.status === 'ready') await view.edit(roll('training', 3));
  });
  await waitFor(() =>
    expect(
      screen.result.current.status === 'ready' &&
        screen.result.current.canConfirm,
      JSON.stringify(screen.result.current),
    ).toBe(true),
  );
  const ready = screen.result.current;
  if (ready.status !== 'ready' || ready.phaseView.phase !== 'upkeep')
    throw new Error('Expected Upkeep');
  expect(ready.phaseView.after.training).toBe(11);
  expect(ready.phaseView.minimumTreasuryCopper).toBe(2000);
  expect(ready).not.toHaveProperty('draft');
  expect(ready).not.toHaveProperty('revision');
  expect(ready).not.toHaveProperty('flush');
  act(() => ready.viewPhase('summary'));
  expect(
    screen.result.current.status === 'ready' &&
      screen.result.current.phaseView.phase,
  ).toBe('summary');
  screen.unmount();
});

test('[rules.P81.recovery] players navigate independently while a pending edit fails and restores the accepted value', async () => {
  const { gateway, authority } = fixture();
  let release!: () => void;
  const held = new Promise<void>((done) => {
    release = done;
  });
  const first = renderWorkspace({
    ...gateway,
    transport: () => ({
      ...authority.transport,
      async send(operation) {
        await held;
        return authority.transport.send(operation);
      },
    }),
  });
  const second = renderWorkspace(gateway);
  await waitFor(() => expect(first.result.current.status).toBe('ready'));
  await waitFor(() => expect(second.result.current.status).toBe('ready'));
  const initial = first.result.current;
  if (initial.status !== 'ready') throw new Error('Expected ready');
  let pending!: Promise<'accepted' | 'failed'>;
  act(() => {
    pending = initial.edit(roll('check', 10));
  });
  expect(
    first.result.current.status === 'ready' && first.result.current.feedback,
  ).toBe('pending');
  act(() => initial.viewPhase('summary'));
  expect(
    first.result.current.status === 'ready' &&
      first.result.current.phaseView.phase,
  ).toBe('summary');
  expect(
    second.result.current.status === 'ready' &&
      second.result.current.phaseView.phase,
  ).toBe('upkeep');
  const other = second.result.current;
  if (other.status !== 'ready') throw new Error('Expected ready');
  await act(() => other.edit(roll('check', 12)));
  await act(async () => {
    release();
    expect(await pending).toBe('failed');
  });
  expect(
    first.result.current.status === 'ready' && first.result.current.feedback,
  ).toBe('failed');
  act(() => initial.viewPhase('upkeep'));
  const recovered = first.result.current;
  if (recovered.status !== 'ready' || recovered.phaseView.phase !== 'upkeep')
    throw new Error('Expected Upkeep');
  expect(recovered.phaseView.rolls[0]?.recorded).toMatchObject({
    diceTotal: 12,
  });
  first.unmount();
  second.unmount();
});

test('[rules.P85.rereview] rejected Confirmation requires an explicit review of the updated accepted week', async () => {
  const { gateway, authority, source } = fixture();
  let receive!: (value: typeof source) => void;
  const screen = renderWorkspace({
    ...gateway,
    subscribe(next) {
      receive = next;
      next(source);
      return () => undefined;
    },
  });
  const current = () => {
    const state = screen.result.current;
    if (state.status !== 'ready') throw new Error('Expected ready Workspace');
    return state;
  };
  await waitFor(() => expect(screen.result.current.status).toBe('ready'));
  await act(() => current().edit(roll('check', 20)));
  await act(() => current().edit(roll('training', 1)));
  await waitFor(() => expect(current().canConfirm).toBe(true));
  act(() => current().viewPhase('summary'));
  authority.changeSource('treasury');
  await act(async () => expect(await current().confirm()).toBe('failed'));
  act(() => current().viewPhase('summary'));
  expect(current()).toMatchObject({
    reviewRequired: true,
    forecastPending: true,
  });
  act(() =>
    receive({
      ...source,
      sourceRevision: 1,
      snapshot: { ...source.snapshot, treasuryCopper: 5007 },
    }),
  );
  await waitFor(() => expect(current().forecastPending).toBe(false));
  expect(current()).toMatchObject({ reviewRequired: true, canConfirm: false });
  await act(async () => expect(await current().confirm()).toBe('failed'));
  expect(current().phaseView).toMatchObject({
    phase: 'summary',
    outcome: { militiaSnapshot: { treasuryCopper: 5007 } },
  });
  // Showing Review & confirm again is not the explicit review.
  act(() => current().viewPhase('upkeep'));
  act(() => current().viewPhase('summary'));
  expect(current()).toMatchObject({ reviewRequired: true, canConfirm: false });
  act(() => current().reviewUpdatedWeek());
  expect(current()).toMatchObject({ reviewRequired: false, canConfirm: true });
  await act(async () => expect(await current().confirm()).toBe('accepted'));
  screen.unmount();
});

test('[rules.P85.failed-save] failed edits require re-review and pending work cannot acknowledge the updated week', async () => {
  const { gateway, authority } = fixture();
  let held: Promise<void> | null = null;
  let release!: () => void;
  const screen = renderWorkspace({
    ...gateway,
    transport: () => ({
      ...authority.transport,
      async send(operation) {
        if (held) await held;
        return authority.transport.send(operation);
      },
    }),
  });
  const other = renderWorkspace(gateway);
  const current = () => {
    const state = screen.result.current;
    if (state.status !== 'ready') throw new Error('Expected ready Workspace');
    return state;
  };
  await waitFor(() => expect(screen.result.current.status).toBe('ready'));
  await act(() => current().edit(roll('check', 20)));
  await act(() => current().edit(roll('training', 1)));
  await waitFor(() => expect(current().canConfirm).toBe(true));
  held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let saving!: Promise<'accepted' | 'failed'>;
  act(() => {
    saving = current().edit(roll('check', 18));
  });
  await act(async () => {
    const competing = other.result.current;
    if (competing.status !== 'ready')
      throw new Error('Expected other Workspace');
    await competing.edit(roll('check', 16));
    release();
    expect(await saving).toBe('failed');
  });
  await waitFor(() => expect(current().forecastPending).toBe(false));
  expect(current()).toMatchObject({ reviewRequired: true, canConfirm: false });
  held = new Promise<void>((resolve) => {
    release = resolve;
  });
  act(() => {
    saving = current().edit(roll('training', 2));
    current().viewPhase('summary');
  });
  expect(current()).toMatchObject({
    reviewRequired: true,
    canConfirm: false,
    pendingWork: true,
  });
  await act(async () => {
    release();
    expect(await saving).toBe('accepted');
  });
  await waitFor(() => expect(current().forecastPending).toBe(false));
  expect(current()).toMatchObject({ reviewRequired: true, canConfirm: false });
  act(() => current().viewPhase('summary'));
  expect(current()).toMatchObject({ reviewRequired: false, canConfirm: true });
  screen.unmount();
  other.unmount();
});

test('[rules.P81.states] loading, failed and unavailable never expose editing and a later available source recovers', async () => {
  const { gateway, source } = fixture();
  let next!: (value: typeof source | null) => void;
  let failed!: () => void;
  const screen = renderWorkspace({
    ...gateway,
    subscribe(receive, onFailure) {
      next = receive;
      failed = onFailure;
      return () => undefined;
    },
  });
  expect(screen.result.current).toEqual({ status: 'loading' });
  act(() => failed());
  expect(screen.result.current).toEqual({ status: 'failed' });
  act(() => next(source));
  await waitFor(() => expect(screen.result.current.status).toBe('ready'));
  const ready = screen.result.current;
  if (ready.status !== 'ready') throw new Error('Expected ready');
  act(() => ready.viewPhase('persistent'));
  expect(
    screen.result.current.status === 'ready' &&
      screen.result.current.phaseView.phase,
  ).toBe('upkeep');
  act(() => next(null));
  expect(screen.result.current).toEqual({ status: 'unavailable' });
  screen.unmount();
});

import { persistentEventFixture } from '../../../tests/rules/persistent-event-fixture';
test('[rules.P81.eligibility] carried-event eligibility remains enabled after ending, and new current-week events cannot enable it', async () => {
  const { draft, snapshot } = persistentEventFixture('double_agent');
  const source = workspaceSourceSchema.parse({
    key: {
      campaignId: 'campaign',
      militiaId: 'militia',
      draftId: draft.draftId,
    },
    week: draft.week,
    sourceRevision: 0,
    snapshot,
    people: [],
  });
  const authority = createMemoryDraftAuthority(draft, snapshot);
  const screen = renderWorkspace({
    subscribe(next) {
      next(source);
      return () => undefined;
    },
    transport() {
      return authority.transport;
    },
  });
  await waitFor(() => expect(screen.result.current.status).toBe('ready'));
  const ready = screen.result.current;
  if (ready.status !== 'ready') throw new Error('Expected ready');
  await act(async () => {
    await ready.edit({
      kind: 'persistent_decision',
      decision: {
        kind: 'end',
        eventId: 'carried',
        acknowledgement: {
          acknowledgementId: 'ending',
          subjectId: 'carried',
          outcome: 'The spy was exposed',
        },
      },
    });
  });
  act(() => ready.viewPhase('persistent'));
  expect(
    screen.result.current.status === 'ready' &&
      screen.result.current.phaseView.phase,
  ).toBe('persistent');
  screen.unmount();
  const fresh = renderWorkspace(fixture().gateway);
  await waitFor(() => expect(fresh.result.current.status).toBe('ready'));
  const current = fresh.result.current;
  if (current.status !== 'ready') throw new Error('Expected ready');
  await act(async () => {
    await current.edit({
      kind: 'event_tree',
      occurrences: [
        {
          eventId: 'new-event',
          origin: { kind: 'rolled' },
          eventType: 'low_morale',
        },
      ],
    });
  });
  act(() => current.viewPhase('persistent'));
  expect(
    fresh.result.current.status === 'ready' &&
      fresh.result.current.phaseView.phase,
  ).toBe('upkeep');
  fresh.unmount();
});

test('[rules.P82.workspace] Activity exposes complete choices and retained extra slots through shared movement', async () => {
  const { gateway } = fixture();
  const first = renderWorkspace(gateway);
  const second = renderWorkspace(gateway);
  await waitFor(() => expect(first.result.current.status).toBe('ready'));
  await act(async () => {
    if (first.result.current.status !== 'ready') throw Error('not ready');
    first.result.current.viewPhase('activity');
    await first.result.current.edit({ kind: 'add_slot', slotId: 'middle' });
    await first.result.current.edit({ kind: 'add_slot', slotId: 'right' });
    await first.result.current.edit({
      kind: 'stage',
      slotId: 'left',
      choice: {
        choiceId: 'drill',
        actionId: 'drill_militia',
        costCopper: 0,
        rolls: {
          check: {
            diceTotal: 10,
            diceCount: 1,
            sides: 20,
            provenance: { kind: 'table' },
            modifiers: [],
          },
        },
      },
    });
    await first.result.current.edit({
      kind: 'move',
      fromSlotId: 'left',
      toSlotId: 'right',
      choiceId: 'drill',
    });
  });
  await waitFor(() => {
    const state = first.result.current;
    if (state.status !== 'ready' || state.phaseView.phase !== 'activity')
      throw Error('not activity');
    expect(state.phaseView.slots[0]?.choice).toBeNull();
    expect(state.phaseView.slots[2]?.choice).toMatchObject({
      choiceId: 'drill',
      costCopper: 0,
      rolls: { check: { diceTotal: 10, diceCount: 1 } },
    });
    expect(state.phaseView.slots[2]?.overAllowance).toBe(true);
    expect(
      second.result.current.status === 'ready' &&
        second.result.current.phaseView.phase,
    ).toBe('upkeep');
  });
});

test('[rules.P82.declared-references] incomplete staged creations remain named choices for later actions', async () => {
  const { gateway } = fixture();
  const workspace = renderWorkspace(gateway);
  await waitFor(() => expect(workspace.result.current.status).toBe('ready'));
  await act(async () => {
    const state = workspace.result.current;
    if (state.status !== 'ready') throw new Error('Expected Workspace');
    state.viewPhase('activity');
    await state.edit({
      kind: 'stage',
      slotId: 'left',
      choice: {
        choiceId: 'recruits',
        actionId: 'recruit_team',
        teamType: 'patrons',
      },
    });
    await state.edit({ kind: 'add_slot', slotId: 'market' });
    await state.edit({
      kind: 'stage',
      slotId: 'market',
      choice: {
        choiceId: 'purchase',
        actionId: 'broker_market',
        purchases: [
          { itemId: 'potion', priceCopper: 123, name: 'Healing potion' },
        ],
      },
    });
    await state.edit({ kind: 'add_slot', slotId: 'cache' });
    await state.edit({
      kind: 'stage',
      slotId: 'cache',
      choice: {
        choiceId: 'cache-choice',
        actionId: 'secure_cache',
        mode: 'place',
        cacheId: 'mill',
        location: 'Under the mill',
      },
    });
    await state.edit({ kind: 'add_slot', slotId: 'events' });
    await state.edit({
      kind: 'stage',
      slotId: 'events',
      choice: {
        choiceId: 'guarantee',
        actionId: 'guarantee_event',
        candidates: [
          {
            eventId: 'rivalry',
            eventType: 'rivalry',
            origin: { kind: 'rolled' },
          },
        ],
      },
    });
  });
  await waitFor(() => {
    const state = workspace.result.current;
    if (state.status !== 'ready' || state.phaseView.phase !== 'activity')
      throw new Error('Expected Activity');
    expect(state.phaseView.teams).toContainEqual(
      expect.objectContaining({
        value: 'recruit:recruits',
        label: 'Recruit Team · Slot 1',
      }),
    );
    expect(state.phaseView.items).toContainEqual({
      value: 'potion',
      label: 'Healing potion',
    });
    expect(state.phaseView.caches).toContainEqual({
      value: 'mill',
      label: 'Under the mill',
    });
    expect(state.phaseView.events).toContainEqual({
      value: 'rivalry',
      // A current-week candidate goes by its Event label.
      label: 'Event 1A · Rivalry',
    });
  });
});

test('[rules.P83.workspace] Event occurrences and required branches recompute after shared upstream edits', async () => {
  const { gateway } = fixture();
  const player = renderWorkspace(gateway);
  await waitFor(() => expect(player.result.current.status).toBe('ready'));
  const ready = () => {
    const value = player.result.current;
    if (value.status !== 'ready') throw new Error('Expected ready');
    return value;
  };
  const percentile = (value: number) => ({
    diceTotal: value,
    diceCount: 1,
    sides: 100,
    provenance: { kind: 'table' as const },
    modifiers: [],
  });
  const settled = () =>
    waitFor(() => {
      expect(ready().pendingWork).toBe(false);
      expect(ready().eventPreparation?.status).toBe('idle');
    });
  await act(async () => {
    ready().viewPhase('event');
    await ready().edit({ kind: 'event_chance', roll: percentile(1) });
  });
  // A triggered chance roll prepares its blank root without any other edit.
  await settled();
  const root = 'workspace:rolled:1';
  await act(async () => {
    await ready().edit({
      kind: 'event_occurrence',
      occurrence: {
        eventId: root,
        origin: { kind: 'rolled' },
        tableRoll: percentile(50),
      },
    });
  });
  await settled();
  expect(ready().phaseView).toMatchObject({
    phase: 'event',
    chance: 10,
    options: {
      eventId: expect.arrayContaining([
        { value: root, label: 'Event 1 · Roll Twice' },
      ]),
    },
    rolled: {
      blocks: [
        {
          eventId: root,
          status: 'two_more',
          // Its children's open rolls belong to their own blocks.
          issues: [],
          children: [
            { eventId: `${root}/twice/1`, status: 'awaiting_roll' },
            { eventId: `${root}/twice/2`, status: 'awaiting_roll' },
          ],
        },
      ],
    },
    requirements: expect.arrayContaining([
      `${root}/twice/1:table:1d100`,
      `${root}/twice/2:table:1d100`,
    ]),
  });
  await act(async () => {
    await ready().edit({
      kind: 'event_occurrence',
      occurrence: {
        eventId: root,
        origin: { kind: 'rolled' },
        tableRoll: percentile(45),
      },
    });
  });
  await settled();
  expect(ready().phaseView).toMatchObject({
    phase: 'event',
    rolled: {
      blocks: [
        {
          eventId: root,
          item: { resolvedType: 'all_is_calm' },
          children: [],
          hidden: [
            { eventId: `${root}/twice/1`, status: 'not_used' },
            { eventId: `${root}/twice/2`, status: 'not_used' },
          ],
        },
      ],
    },
  });
  expect(ready().phaseView.requirements).not.toContain(
    `${root}/twice/1:table:1d100`,
  );
});

test('[rules.P84.workspace] carried instances retain targets and order while buyoff stages an ending and shared cooldown', async () => {
  const { draft, snapshot } = persistentEventFixture('double_agent');
  draft.context = {
    ...draft.context,
    carriedEvents: [
      ...draft.context.carriedEvents,
      { ...draft.context.carriedEvents[0]!, eventId: 'second', order: 1 },
    ],
  };
  snapshot.treasuryCopper = 100000;
  const source = workspaceSourceSchema.parse({
    key: {
      campaignId: 'campaign',
      militiaId: 'militia',
      draftId: draft.draftId,
    },
    week: draft.week,
    sourceRevision: 0,
    snapshot,
    people: [],
  });
  const authority = createMemoryDraftAuthority(draft, snapshot);
  const gateway: WorkspaceGateway = {
    subscribe(next) {
      next(source);
      return () => undefined;
    },
    transport: () => authority.transport,
  };
  const first = renderWorkspace(gateway);
  const second = renderWorkspace(gateway);
  await waitFor(() => expect(first.result.current.status).toBe('ready'));
  const ready = () => {
    const state = first.result.current;
    if (state.status !== 'ready') throw Error('Expected ready');
    return state;
  };
  act(() => ready().viewPhase('persistent'));
  expect(ready().phaseView).toMatchObject({
    phase: 'persistent',
    firstBuyoff: true,
    nextBuyoffWeek: 2,
    events: [
      { eventId: 'carried', startedWeek: 1, order: 0, ended: false },
      { eventId: 'second', order: 1 },
    ],
  });
  await act(() =>
    ready().edit({
      kind: 'persistent_decision',
      decision: { kind: 'buyoff', eventId: 'carried' },
    }),
  );
  expect(ready().phaseView).toMatchObject({
    phase: 'persistent',
    nextBuyoffWeek: 6,
    events: [
      { eventId: 'carried', ended: true, decision: { kind: 'buyoff' } },
      { eventId: 'second', ended: false },
    ],
  });
  await act(() =>
    ready().edit({
      kind: 'persistent_decision',
      decision: { kind: 'buyoff', eventId: 'second' },
    }),
  );
  expect(ready().phaseView).toMatchObject({
    events: [
      { ended: true },
      {
        ended: false,
        exceptions: expect.arrayContaining([
          expect.objectContaining({
            ruleId: 'buyoff-cooldown',
            subjectId: 'second',
          }),
        ]),
      },
    ],
  });
  act(() => {
    const state = second.result.current;
    if (state.status === 'ready') state.viewPhase('persistent');
  });
  await waitFor(() =>
    expect(
      second.result.current.status === 'ready' &&
        second.result.current.phaseView,
    ).toEqual(ready().phaseView),
  );
  await act(() =>
    ready().edit({ kind: 'clear_persistent_decision', eventId: 'carried' }),
  );
  expect(ready().phaseView).toMatchObject({
    events: [{ ended: false }, { ended: true }],
  });
  first.unmount();
  second.unmount();
});

test('[rules.P85.summary] Summary exposes ordered adjudication and complete named baseline and final facts', async () => {
  const { gateway, source } = fixture();
  source.people = [{ characterId: 'pc', name: 'Nora' }];
  const hook = renderWorkspace(gateway);
  await waitFor(() => expect(hook.result.current.status).toBe('ready'));
  const workspace = hook.result.current;
  if (workspace.status !== 'ready') throw new Error('Expected Workspace');
  await act(() =>
    workspace.edit({
      kind: 'table_adjustments',
      adjustments: [
        {
          adjustmentId: 'grant',
          kind: 'militia_value',
          field: 'treasuryCopper',
          operation: 'add',
          value: 125,
          reason: 'Village reward',
        },
        {
          adjustmentId: 'set',
          kind: 'militia_value',
          field: 'treasuryCopper',
          operation: 'set',
          value: 6125,
          reason: 'Table correction',
        },
      ],
    }),
  );
  act(() => workspace.viewPhase('summary'));
  const current = hook.result.current;
  if (current.status !== 'ready' || current.phaseView.phase !== 'summary')
    throw new Error('Expected Summary');
  expect(current.phaseView.adjustments.map((item) => item.reason)).toEqual([
    'Village reward',
    'Table correction',
  ]);
  expect(current.phaseView.baseline?.militiaSnapshot.treasuryCopper).toBe(5000);
  expect(current.phaseView.outcome?.militiaSnapshot.treasuryCopper).toBe(6125);
  expect(current.phaseView.people).toEqual([
    { characterId: 'pc', name: 'Nora' },
  ]);
  hook.unmount();
});

test('[rules.P85.event-identity] ending the first event leaves later event names stable in both Summary outcomes', async () => {
  const { draft, snapshot } = persistentEventFixture('theft');
  draft.context = {
    ...draft.context,
    carriedEvents: [
      ...draft.context.carriedEvents,
      { ...draft.context.carriedEvents[0]!, eventId: 'second', order: 1 },
    ],
  };
  const source = workspaceSourceSchema.parse({
    key: {
      campaignId: 'campaign',
      militiaId: 'militia',
      draftId: draft.draftId,
    },
    week: draft.week,
    sourceRevision: 0,
    snapshot,
    people: [],
  });
  const authority = createMemoryDraftAuthority(draft, snapshot);
  const hook = renderWorkspace({
    subscribe(next) {
      next(source);
      return () => undefined;
    },
    transport: () => authority.transport,
  });
  await waitFor(() => expect(hook.result.current.status).toBe('ready'));
  const workspace = hook.result.current;
  if (workspace.status !== 'ready') throw new Error('Expected Workspace');
  await act(() =>
    workspace.edit({
      kind: 'table_adjustments',
      adjustments: [
        {
          adjustmentId: 'ending',
          kind: 'event_end',
          eventId: 'carried',
          reason: 'Captured the thief',
        },
      ],
    }),
  );
  act(() => workspace.viewPhase('summary'));
  const current = hook.result.current;
  if (current.status !== 'ready' || current.phaseView.phase !== 'summary')
    throw new Error('Expected Summary');
  expect(current.phaseView.options.eventId).toContainEqual({
    value: 'second',
    label: 'Theft · Event 2',
  });
  expect(
    current.phaseView.baseline?.context.carriedEvents.map(
      (item) => item.eventId,
    ),
  ).toEqual(['carried', 'second']);
  expect(
    current.phaseView.outcome?.context.carriedEvents.map(
      (item) => item.eventId,
    ),
  ).toEqual(['second']);
  hook.unmount();
});

test('[setup.navigation] setup opens the requested local phase without moving another player', async () => {
  const { gateway } = fixture();
  const first = renderWorkspace({ ...gateway, initialPhase: 'event' });
  const second = renderWorkspace(gateway);
  await waitFor(() =>
    expect(first.result.current).toMatchObject({
      status: 'ready',
      phaseView: { phase: 'event' },
    }),
  );
  await waitFor(() =>
    expect(second.result.current).toMatchObject({
      status: 'ready',
      phaseView: { phase: 'upkeep' },
    }),
  );
  first.unmount();
  second.unmount();
  const unavailablePhase = renderWorkspace({
    ...gateway,
    initialPhase: 'persistent',
  });
  await waitFor(() =>
    expect(unavailablePhase.result.current).toMatchObject({
      status: 'ready',
      phaseView: { phase: 'upkeep' },
    }),
  );
});

test('[rules.F04.workspace-hard-cap] an extra-slot choice stays shared but blocks confirmation despite an old exception until moved within the allowance', async () => {
  const { gateway } = fixture();
  const first = renderWorkspace(gateway);
  const second = renderWorkspace(gateway);
  function current() {
    const state = first.result.current;
    if (state.status !== 'ready') throw new Error('Expected ready Workspace');
    return state;
  }
  await waitFor(() => expect(first.result.current.status).toBe('ready'));
  await act(async () => {
    await current().edit(roll('check', 10));
    await current().edit(roll('training', 1));
    await current().edit({ kind: 'add_slot', slotId: 'middle' });
    await current().edit({ kind: 'add_slot', slotId: 'extra' });
    await current().edit({
      kind: 'stage',
      slotId: 'extra',
      choice: { choiceId: 'quiet', actionId: 'lie_low' },
    });
    await current().edit({
      kind: 'rules_exception',
      exception: {
        exceptionId: 'old-capacity',
        subjectId: 'quiet',
        ruleId: 'action-capacity',
        reason: 'Previously permitted extra day',
      },
    });
    current().viewPhase('activity');
  });
  await waitFor(() => {
    const state = current();
    expect(state.forecastPending).toBe(false);
    expect(state.canConfirm).toBe(false);
    if (state.phaseView.phase !== 'activity')
      throw new Error('Expected Activity');
    expect(state.phaseView.ready).toBe(false);
    expect(state.phaseView.slots[2]?.choice?.choiceId).toBe('quiet');
    expect(state.phaseView.slots[2]?.overAllowance).toBe(true);
    expect(state.phaseView.slots[2]?.exceptions).toEqual([]);
    expect(state.phaseView.requirements).toContain('quiet:action-capacity');
  });
  await act(async () => {
    const state = second.result.current;
    if (state.status !== 'ready') throw new Error('Expected second Workspace');
    state.viewPhase('activity');
  });
  await waitFor(() => {
    const state = second.result.current;
    if (state.status !== 'ready' || state.phaseView.phase !== 'activity')
      throw new Error('Expected Activity');
    expect(state.phaseView.slots[2]?.choice?.choiceId).toBe('quiet');
    expect(state.canConfirm).toBe(false);
  });
  await act(async () => {
    await current().edit({
      kind: 'move',
      fromSlotId: 'extra',
      toSlotId: 'left',
      choiceId: 'quiet',
    });
  });
  await waitFor(() => expect(current().forecastPending).toBe(false));
  await act(async () => current().viewPhase('summary'));
  await waitFor(() => expect(current().canConfirm).toBe(true));
});

// #164's two-device Sickness step, through the Event view's own edit builder:
// each device saves the whole occurrence it sees, changing a different field.
// Whichever save lands second was built on a revision its occurrence has since
// moved past, so it fails visibly instead of writing its stale field back.
test('a stale whole-occurrence save fails on its device and never reverts the other device’s field', async () => {
  const { gateway } = fixture([
    { teamId: 'scouts', teamType: 'patrons', name: 'Scouts' },
  ]);
  const player = renderWorkspace(gateway);
  const gm = renderWorkspace(gateway);
  type Device = typeof player;
  const ready = (device: Device) => {
    const value = device.result.current;
    if (value.status !== 'ready') throw new Error('Expected ready');
    return value;
  };
  const view = (device: Device) => {
    const value = ready(device).phaseView;
    if (value.phase !== 'event') throw new Error('Expected Event');
    return value;
  };
  // The edits a click on this device would use right now.
  const builders: { unmount: () => void }[] = [];
  const edits = (device: Device) => {
    const builder = renderHook(() =>
      useEventEdits(view(device), ready(device).edit),
    );
    builders.push(builder);
    return builder.result.current;
  };
  const percentile = (value: number) => ({
    diceTotal: value,
    diceCount: 1,
    sides: 100,
    provenance: { kind: 'table' as const },
    modifiers: [],
  });
  const root = 'workspace:rolled:1';
  const occurrence = (device: Device) =>
    view(device).rolled.blocks[0]!.item.occurrence;
  const settled = () =>
    waitFor(() => {
      for (const device of [player, gm]) {
        expect(ready(device).pendingWork).toBe(false);
        expect(ready(device).eventPreparation?.status).toBe('idle');
      }
    });
  await waitFor(() => expect(gm.result.current.status).toBe('ready'));
  await waitFor(() => expect(player.result.current.status).toBe('ready'));
  act(() => {
    ready(player).viewPhase('event');
    ready(gm).viewPhase('event');
  });
  await act(() =>
    ready(player).edit({ kind: 'event_chance', roll: percentile(1) }),
  );
  await settled();
  let gmEdits = edits(gm);
  act(() => void gmEdits.setTableRoll(root, percentile(90)));
  await settled();
  let playerEdits = edits(player);
  act(() => void playerEdits.setTargets(root, 'team', ['scouts']));
  await settled();
  expect(occurrence(gm)).toMatchObject({
    tableRoll: { diceTotal: 90, diceCount: 1 },
    targets: [{ kind: 'team', teamId: 'scouts' }],
  });

  // The incident's order: both edits start from the same view; the player's
  // clear lands first, then the GM's table roll.
  playerEdits = edits(player);
  gmEdits = edits(gm);
  act(() => {
    playerEdits.setTargets(root, 'team', []);
    gmEdits.setTableRoll(root, percentile(45));
  });
  await settled();
  for (const device of [player, gm])
    expect(occurrence(device)).toEqual({
      eventId: root,
      origin: { kind: 'rolled' },
      tableRoll: percentile(90),
    });
  expect(ready(player).feedback).toBe('saved');
  expect(ready(gm).feedback).toBe('failed');

  // The reverse order: the table roll lands first, and the player's team
  // choice, built before seeing it, cannot bring 90 back.
  playerEdits = edits(player);
  gmEdits = edits(gm);
  act(() => {
    gmEdits.setTableRoll(root, percentile(45));
    playerEdits.setTargets(root, 'team', ['scouts']);
  });
  await settled();
  for (const device of [player, gm])
    expect(occurrence(device)).toEqual({
      eventId: root,
      origin: { kind: 'rolled' },
      tableRoll: percentile(45),
    });
  expect(ready(gm).feedback).toBe('saved');
  expect(ready(player).feedback).toBe('failed');
  for (const builder of builders) builder.unmount();
  player.unmount();
  gm.unmount();
});
