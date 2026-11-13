import { expect, test } from 'vitest';
import { DraftRejected } from '~/lib/weekly-draft-persistence-contract';
import { createMemoryDraftAuthority } from '~/lib/memory-draft-persistence';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import { upkeepFixture, roll } from '../../../tests/rules/upkeep-fixture';
import type { WorkspaceGateway } from './gateway';
import { createWorkspace } from './store';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function fixture(draftId = 'week-40', week?: number) {
  const { draft, snapshot } = upkeepFixture();
  draft.draftId = draftId;
  if (week !== undefined) draft.week = week;
  draft.context = { ...draft.context, firstMilitiaWeek: true };
  draft.event.chanceRoll = roll(100, 100);
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
  let receive!: Parameters<WorkspaceGateway['subscribe']>[0];
  let fail!: Parameters<WorkspaceGateway['subscribe']>[1];
  const gateway: WorkspaceGateway = {
    subscribe(next, failed) {
      receive = next;
      fail = failed;
      next(source);
      return () => undefined;
    },
    transport: () => authority.transport,
  };
  return {
    gateway,
    authority,
    source,
    receive: (next: typeof source | null) => receive(next),
    fail: () => fail(),
  };
}

function ready(workspace: ReturnType<typeof createWorkspace>) {
  const snapshot = workspace.getSnapshot();
  if (snapshot.status !== 'ready') throw new Error('Expected ready Workspace');
  return snapshot;
}

test('Confirmation retains the reviewed week read-only through closure and its response', async () => {
  const { gateway, authority } = fixture();
  const response = deferred();
  const workspace = createWorkspace({
    ...gateway,
    transport: () => ({
      ...authority.transport,
      async confirm(operation) {
        const receipt = await authority.transport.confirm(operation);
        await response.promise;
        return receipt;
      },
    }),
  });
  const stop = workspace.start();
  try {
    await expect.poll(() => ready(workspace).canConfirm).toBe(true);
    const observed: boolean[] = [];
    workspace.subscribe(() => observed.push(workspace.getPendingWork()));
    const confirming = ready(workspace).confirm();
    expect(workspace.getPendingWork()).toBe(true);
    await expect.poll(() => ready(workspace).editingDisabled).toBe(true);
    expect(workspace.getPendingWork()).toBe(true);
    expect(observed).not.toContain(false);
    response.resolve();
    expect(await confirming).toBe('accepted');
    expect(ready(workspace).editingDisabled).toBe(true);
    expect(ready(workspace).feedback).toBe('confirming');
    expect(
      await ready(workspace).edit({ kind: 'event_chance', roll: null }),
    ).toBe('failed');
    expect(workspace.getPendingWork()).toBe(false);
    expect(observed.at(-1)).toBe(false);
  } finally {
    response.resolve();
    stop();
  }
});

test('a disappearing source keeps Confirmation protected and notifies subscribers when it settles', async () => {
  const fixtureState = fixture();
  const response = deferred();
  const workspace = createWorkspace({
    ...fixtureState.gateway,
    transport: () => ({
      ...fixtureState.authority.transport,
      async confirm(operation) {
        const receipt =
          await fixtureState.authority.transport.confirm(operation);
        await response.promise;
        return receipt;
      },
    }),
  });
  const stop = workspace.start();
  try {
    await expect.poll(() => ready(workspace).canConfirm).toBe(true);
    const confirming = ready(workspace).confirm();
    await expect.poll(() => ready(workspace).editingDisabled).toBe(true);
    fixtureState.receive(null);
    expect(workspace.getSnapshot()).toEqual({ status: 'unavailable' });
    expect(workspace.getPendingWork()).toBe(true);
    const observed: boolean[] = [];
    workspace.subscribe(() => observed.push(workspace.getPendingWork()));
    response.resolve();
    expect(await confirming).toBe('accepted');
    expect(workspace.getSnapshot()).toEqual({ status: 'unavailable' });
    expect(workspace.getPendingWork()).toBe(false);
    expect(observed.at(-1)).toBe(false);
  } finally {
    response.resolve();
    stop();
  }
});

test('an authoritative successor clears old Confirmation protection without letting its late response clear a new edit', async () => {
  const current = fixture();
  const successor = fixture('successor');
  const confirmationResponse = deferred();
  const editResponse = deferred();
  const workspace = createWorkspace({
    ...current.gateway,
    transport: (source) =>
      source.key.draftId === current.source.key.draftId
        ? {
            ...current.authority.transport,
            async confirm(operation) {
              const receipt =
                await current.authority.transport.confirm(operation);
              await confirmationResponse.promise;
              return receipt;
            },
          }
        : {
            ...successor.authority.transport,
            async send(operation) {
              const receipt =
                await successor.authority.transport.send(operation);
              await editResponse.promise;
              return receipt;
            },
          },
  });
  const stop = workspace.start();
  try {
    await expect.poll(() => ready(workspace).canConfirm).toBe(true);
    const confirming = ready(workspace).confirm();
    await expect.poll(() => ready(workspace).editingDisabled).toBe(true);
    current.receive(successor.source);
    expect(workspace.getPendingWork()).toBe(false);
    await expect.poll(() => ready(workspace).canConfirm).toBe(true);
    const saving = ready(workspace).edit({
      kind: 'event_chance',
      roll: roll(100, 99),
    });
    expect(workspace.getPendingWork()).toBe(true);
    confirmationResponse.resolve();
    expect(await confirming).toBe('accepted');
    expect(workspace.getPendingWork()).toBe(true);
    editResponse.resolve();
    expect(await saving).toBe('accepted');
    expect(workspace.getPendingWork()).toBe(false);
  } finally {
    confirmationResponse.resolve();
    editResponse.resolve();
    stop();
  }
});

test('a delayed edit stays protected through source failure, disappearance and recovery of the same draft', async () => {
  const current = fixture();
  const response = deferred();
  const workspace = createWorkspace({
    ...current.gateway,
    transport: () => ({
      ...current.authority.transport,
      async send(operation) {
        const receipt = await current.authority.transport.send(operation);
        await response.promise;
        return receipt;
      },
    }),
  });
  const stop = workspace.start();
  try {
    await expect.poll(() => ready(workspace).canConfirm).toBe(true);
    const saving = ready(workspace).edit({
      kind: 'event_chance',
      roll: roll(100, 99),
    });
    expect(workspace.getPendingWork()).toBe(true);
    await expect.poll(() => ready(workspace).phaseView.phase).toBe('upkeep');
    current.fail();
    expect(workspace.getSnapshot()).toEqual({ status: 'failed' });
    expect(workspace.getPendingWork()).toBe(true);
    current.receive(null);
    expect(workspace.getSnapshot()).toEqual({ status: 'unavailable' });
    expect(workspace.getPendingWork()).toBe(true);
    current.receive(current.source);
    await expect.poll(() => workspace.getSnapshot().status).toBe('ready');
    expect(ready(workspace).pendingWork).toBe(true);
    const observed: boolean[] = [];
    workspace.subscribe(() => observed.push(workspace.getPendingWork()));
    response.resolve();
    expect(await saving).toBe('accepted');
    expect(workspace.getPendingWork()).toBe(false);
    expect(observed.at(-1)).toBe(false);
    expect(ready(workspace).pendingWork).toBe(false);
    await expect.poll(() => ready(workspace).canConfirm).toBe(true);
  } finally {
    response.resolve();
    stop();
  }
});

test('Confirmation that is not ready does not create unobservable pending work', async () => {
  const { gateway } = fixture();
  const workspace = createWorkspace(gateway);
  const stop = workspace.start();
  try {
    await expect.poll(() => ready(workspace).canConfirm).toBe(true);
    await ready(workspace).edit({ kind: 'event_chance', roll: null });
    await expect.poll(() => ready(workspace).forecastPending).toBe(false);
    expect(ready(workspace).canConfirm).toBe(false);
    const confirming = ready(workspace).confirm();
    expect(workspace.getPendingWork()).toBe(false);
    expect(await confirming).toBe('failed');
  } finally {
    stop();
  }
});

test('all phase decisions follow optimistic edits and rollback while navigation preserves pending work', async () => {
  const { gateway, authority } = fixture();
  const response = deferred();
  const workspace = createWorkspace({
    ...gateway,
    transport: () => ({
      ...authority.transport,
      async send() {
        await response.promise;
        throw new Error('The edit was rejected.');
      },
    }),
  });
  const stop = workspace.start();
  try {
    await expect.poll(() => ready(workspace).canConfirm).toBe(true);
    expect(ready(workspace).confirmationDisabledReason).toBeNull();
    expect(ready(workspace).referenceFacts.after?.treasuryCopper).toBe(3000);
    const saving = ready(workspace).edit({ kind: 'event_chance', roll: null });
    const optimistic = ready(workspace);
    expect(optimistic.referenceFacts.after).toBeNull();
    expect(optimistic.referenceFacts.now.treasuryCopper).toBe(3000);
    expect(optimistic.phaseView.phase).toBe('upkeep');
    expect(
      optimistic.phases.find((item) => item.phase === 'event')!.requirements,
    ).toHaveLength(1);
    expect(
      optimistic.phases.find((item) => item.phase === 'summary')!.requirements,
    ).toHaveLength(1);
    expect(optimistic.confirmationDisabledReason).toBe(
      'Review will be ready when your changes are saved.',
    );
    optimistic.viewPhase('event');
    expect(ready(workspace).navigation).toEqual({
      previous: 'activity',
      next: 'summary',
    });
    ready(workspace).viewPhase('summary');
    expect(ready(workspace).pendingWork).toBe(true);
    expect(ready(workspace).canConfirm).toBe(false);
    response.resolve();
    expect(await saving).toBe('failed');
    await expect.poll(() => ready(workspace).forecastPending).toBe(false);
    const restored = ready(workspace);
    expect(restored.referenceFacts.after?.treasuryCopper).toBe(3000);
    expect(restored.phaseView.phase).toBe('summary');
    expect(
      restored.phases.find((item) => item.phase === 'event')!.requirements,
    ).toEqual([]);
    expect(
      restored.phases.find((item) => item.phase === 'summary')!.requirements,
    ).toEqual([]);
    expect(restored.reviewRequired).toBe(true);
    expect(restored.canConfirm).toBe(false);
    expect(restored.confirmationDisabledReason).toBe(
      'Review the updated week before confirming.',
    );
    restored.viewPhase('summary');
    expect(ready(workspace).canConfirm).toBe(true);
    expect(ready(workspace).confirmationDisabledReason).toBeNull();
  } finally {
    response.resolve();
    stop();
  }
});

test('accepted remote edits refresh every phase without changing either player’s Phase View', async () => {
  const { gateway } = fixture();
  const observer = createWorkspace(gateway);
  const editor = createWorkspace(gateway);
  const stopObserver = observer.start();
  const stopEditor = editor.start();
  try {
    await expect.poll(() => ready(observer).canConfirm).toBe(true);
    await expect.poll(() => ready(editor).canConfirm).toBe(true);
    ready(observer).viewPhase('activity');
    ready(editor).viewPhase('event');
    await ready(editor).edit({ kind: 'event_chance', roll: null });
    await expect.poll(() => ready(observer).forecastPending).toBe(false);
    const state = ready(observer);
    expect(state.remoteChange).toEqual({ sequence: 1, phases: ['event'] });
    expect(ready(editor).remoteChange).toBeNull();
    expect(state.referenceFacts.after).toBeNull();
    expect(state.phaseView.phase).toBe('activity');
    expect(ready(editor).phaseView.phase).toBe('event');
    expect(
      state.phases.map((item) => [item.phase, item.requirements.length]),
    ).toEqual([
      ['upkeep', 0],
      ['activity', 0],
      ['event', 1],
      ['persistent', 1],
      ['summary', 1],
    ]);
    expect(state.canConfirm).toBe(false);
    expect(state.confirmationDisabledReason).toBe('1 decision left');
    await ready(editor).edit({ kind: 'event_chance', roll: roll(100, 101) });
    await expect.poll(() => ready(observer).canConfirm).toBe(true);
    const warned = ready(observer);
    expect(warned.referenceFacts.after?.treasuryCopper).toBe(3000);
    expect(warned.phaseView.phase).toBe('activity');
    expect(warned.phases.find((item) => item.phase === 'event')).toMatchObject({
      ready: true,
      requirements: [],
      warnings: [
        { id: 'event:chance:roll-range', message: expect.any(String) },
      ],
    });
    expect(
      warned.phases.find((item) => item.phase === 'summary')!.warnings,
    ).toHaveLength(1);
    expect(warned.confirmationDisabledReason).toBeNull();
  } finally {
    stopObserver();
    stopEditor();
  }
});

test('an ineligible Persistent deep link normalizes to Upkeep without navigation writes', async () => {
  const { gateway, authority } = fixture();
  const sent: unknown[] = [];
  const workspace = createWorkspace({
    ...gateway,
    initialPhase: 'persistent',
    transport: () => ({
      ...authority.transport,
      send(operation) {
        sent.push(operation);
        return authority.transport.send(operation);
      },
    }),
  });
  const stop = workspace.start();
  try {
    await expect.poll(() => ready(workspace).canConfirm).toBe(true);
    expect(ready(workspace).phaseView.phase).toBe('upkeep');
    expect(ready(workspace).navigation.previous).toBeNull();
    ready(workspace).viewPhase('persistent');
    expect(ready(workspace).phaseView.phase).toBe('upkeep');
    ready(workspace).viewPhase('summary');
    expect(ready(workspace).navigation.next).toBeNull();
    ready(workspace).viewPhase('event');
    expect(ready(workspace).navigation.next).toBe('summary');
    expect(sent).toEqual([]);
  } finally {
    stop();
  }
});

test('a source-first handoff retains all old phase views and facts until the successor is usable, once', async () => {
  const current = fixture();
  const successor = fixture('successor');
  current.source.setupNotes = 'Old setup';
  successor.source.setupNotes = 'New setup';
  successor.source.snapshot.treasuryCopper = 98765;
  const hydration = deferred();
  const workspace = createWorkspace({
    ...current.gateway,
    transport: (source) =>
      source.key.draftId === current.source.key.draftId
        ? current.authority.transport
        : {
            ...successor.authority.transport,
            subscribe: () => () => undefined,
            async read() {
              await hydration.promise;
              return successor.authority.transport.read();
            },
          },
  });
  const stop = workspace.start();
  try {
    await expect.poll(() => ready(workspace).canConfirm).toBe(true);
    const old = ready(workspace);
    old.viewPhase('summary');
    const summary = ready(workspace).phaseView;
    current.receive(successor.source);
    expect(ready(workspace)).toMatchObject({
      setupNotes: 'Old setup',
      editingDisabled: true,
      confirmedWeek: null,
      canConfirm: false,
    });
    expect(ready(workspace).referenceFacts).toEqual(old.referenceFacts);
    expect(ready(workspace).phaseView).toEqual(summary);
    ready(workspace).viewPhase('upkeep');
    expect(ready(workspace).phaseView).toEqual(old.phaseView);
    expect(await old.edit({ kind: 'event_chance', roll: null })).toBe('failed');
    expect(await old.confirm()).toBe('failed');
    hydration.resolve();
    await expect.poll(() => ready(workspace).editingDisabled).toBe(false);
    expect(ready(workspace)).toMatchObject({
      setupNotes: 'New setup',
      phaseView: { phase: 'upkeep' },
      confirmedWeek: { week: old.week },
    });
    expect(ready(workspace).referenceFacts.now.treasuryCopper).toBe(98765);
    const notice = ready(workspace).confirmedWeek;
    expect(await old.edit({ kind: 'event_chance', roll: null })).toBe('failed');
    expect(await old.confirm()).toBe('failed');
    current.receive(successor.source);
    await ready(workspace).edit({ kind: 'event_chance', roll: roll(100, 98) });
    expect(ready(workspace).confirmedWeek).toEqual(notice);
    ready(workspace).dismissConfirmedWeek();
    current.receive(successor.source);
    expect(ready(workspace).confirmedWeek).toBeNull();
  } finally {
    hydration.resolve();
    stop();
  }
});

test('observer closure discards unaccepted optimistic values and retains a truthful failed edit', async () => {
  const current = fixture();
  const response = deferred();
  const workspace = createWorkspace({
    ...current.gateway,
    transport: () => ({
      ...current.authority.transport,
      async send() {
        await response.promise;
        throw new Error('rejected');
      },
    }),
  });
  const stop = workspace.start();
  try {
    await expect.poll(() => ready(workspace).canConfirm).toBe(true);
    const original = ready(workspace);
    const saving = original.edit({ kind: 'event_chance', roll: null });
    expect(ready(workspace).referenceFacts.after).toBeNull();
    const preview = await current.authority.transport.preview();
    await current.authority.transport.confirm({
      operationId: 'remote-confirm',
      reviewed: preview.reviewed,
    });
    expect(ready(workspace).editingDisabled).toBe(true);
    expect(ready(workspace).referenceFacts).toEqual(original.referenceFacts);
    expect(ready(workspace).confirmationDisabledReason).toBe(
      'Opening the next week…',
    );
    response.resolve();
    expect(await saving).toBe('failed');
    expect(ready(workspace).feedback).toBe('failed');
    expect(ready(workspace).referenceFacts).toEqual(original.referenceFacts);
  } finally {
    response.resolve();
    stop();
  }
});

test('unhydrated source replacements keep the original retained identity and ignore source regressions', async () => {
  const current = fixture();
  const intermediate = fixture('middle');
  const successor = fixture('next');
  current.source.sourceRevision = 3;
  intermediate.source.sourceRevision = 4;
  successor.source.sourceRevision = 5;
  const hydration = deferred();
  const workspace = createWorkspace({
    ...current.gateway,
    transport: (source) => {
      if (source.key.draftId === current.source.key.draftId)
        return current.authority.transport;
      const authority =
        source.key.draftId === 'middle'
          ? intermediate.authority
          : successor.authority;
      return {
        ...authority.transport,
        subscribe: () => () => undefined,
        async read() {
          await hydration.promise;
          return authority.transport.read();
        },
      };
    },
  });
  const stop = workspace.start();
  try {
    await expect.poll(() => workspace.getSnapshot().status).toBe('ready');
    const original = ready(workspace);
    current.receive(intermediate.source);
    current.receive(successor.source);
    current.receive(current.source);
    expect(ready(workspace).editingDisabled).toBe(true);
    hydration.resolve();
    await expect.poll(() => ready(workspace).editingDisabled).toBe(false);
    expect(ready(workspace).confirmedWeek).toEqual({
      transitionId: 'week-40:next',
      week: original.week,
    });
  } finally {
    hydration.resolve();
    stop();
  }
});

test.each(['campaign', 'militia', 'unavailable', 'failed'] as const)(
  'a %s boundary clears old facts, feedback and notices while old callbacks stay isolated',
  async (boundary) => {
    const current = fixture();
    const successor = fixture('next');
    const workspace = createWorkspace({
      ...current.gateway,
      transport: (source) =>
        source.key.draftId === 'next'
          ? successor.authority.transport
          : current.authority.transport,
    });
    const stop = workspace.start();
    try {
      await expect.poll(() => ready(workspace).canConfirm).toBe(true);
      current.receive(successor.source);
      await expect.poll(() => ready(workspace).canConfirm).toBe(true);
      const old = ready(workspace);
      expect(old.confirmedWeek).not.toBeNull();
      if (boundary === 'unavailable') current.receive(null);
      else if (boundary === 'failed') current.fail();
      else
        current.receive({
          ...successor.source,
          key: {
            ...successor.source.key,
            [boundary === 'campaign' ? 'campaignId' : 'militiaId']: 'other',
          },
        });
      expect(await old.edit({ kind: 'event_chance', roll: null })).toBe(
        'failed',
      );
      expect(await old.confirm()).toBe('failed');
      if (boundary === 'unavailable' || boundary === 'failed') {
        expect(workspace.getSnapshot()).toEqual({ status: boundary });
        current.receive(successor.source);
      }
      await expect.poll(() => ready(workspace).forecastPending).toBe(false);
      expect(ready(workspace)).toMatchObject({
        confirmedWeek: null,
        remoteChange: null,
        feedback: 'idle',
        editingDisabled: false,
      });
    } finally {
      stop();
    }
  },
);

test('the caller and an observing device each publish one confirmed-week notice only when the next week is usable', async () => {
  const current = fixture('old', 40);
  const next = fixture('next', 41);
  const sources: Parameters<WorkspaceGateway['subscribe']>[0][] = [];
  const gateway: WorkspaceGateway = {
    subscribe(receive) {
      sources.push(receive);
      receive(current.source);
      return () => undefined;
    },
    transport: (source) =>
      source.key.draftId === 'old'
        ? current.authority.transport
        : next.authority.transport,
  };
  const caller = createWorkspace(gateway);
  const observer = createWorkspace(gateway);
  const stops = [caller.start(), observer.start()];
  try {
    await expect.poll(() => ready(caller).canConfirm).toBe(true);
    await expect.poll(() => ready(observer).canConfirm).toBe(true);
    ready(caller).viewPhase('summary');
    ready(observer).viewPhase('event');
    expect(await ready(caller).confirm()).toBe('accepted');
    expect(ready(caller)).toMatchObject({
      week: 40,
      feedback: 'confirming',
      editingDisabled: true,
      confirmedWeek: null,
    });
    expect(ready(observer)).toMatchObject({
      week: 40,
      phaseView: { phase: 'event' },
      editingDisabled: true,
      confirmedWeek: null,
      remoteChange: null,
    });
    for (const receive of sources) receive(next.source);
    for (const workspace of [caller, observer]) {
      await expect.poll(() => ready(workspace).canConfirm).toBe(true);
      expect(ready(workspace)).toMatchObject({
        week: 41,
        phaseView: { phase: 'upkeep' },
        editingDisabled: false,
        confirmedWeek: { transitionId: 'old:next', week: 40 },
      });
      ready(workspace).dismissConfirmedWeek();
    }
    for (const receive of sources) receive(next.source);
    expect(ready(caller).confirmedWeek).toBeNull();
    expect(ready(observer).confirmedWeek).toBeNull();
  } finally {
    stops.forEach((stop) => stop());
  }
});

test('source-only corrections refresh facts and require a matching review without inventing a remote phase', async () => {
  const current = fixture();
  const workspace = createWorkspace(current.gateway);
  const stop = workspace.start();
  try {
    await expect.poll(() => ready(workspace).canConfirm).toBe(true);
    current.authority.changeSource('treasury');
    const changed = current.authority.inspect();
    current.receive({
      ...current.source,
      sourceRevision: changed.sourceRevision,
      snapshot: changed.snapshot,
    });
    expect(ready(workspace).canConfirm).toBe(false);
    expect(ready(workspace).referenceFacts.now.treasuryCopper).toBe(3007);
    expect(ready(workspace).remoteChange).toBeNull();
    expect(ready(workspace).confirmedWeek).toBeNull();
    await expect.poll(() => ready(workspace).canConfirm).toBe(true);
    current.receive(current.source);
    expect(ready(workspace).referenceFacts.now.treasuryCopper).toBe(3007);
    expect(ready(workspace).canConfirm).toBe(true);
  } finally {
    stop();
  }
});

test('a rejected concurrent confirmer still receives the winning same-scope transition', async () => {
  const current = fixture('old', 40);
  const next = fixture('next', 41);
  const sources: Parameters<WorkspaceGateway['subscribe']>[0][] = [];
  const gateway: WorkspaceGateway = {
    subscribe(receive) {
      sources.push(receive);
      receive(current.source);
      return () => undefined;
    },
    transport: (source) =>
      source.key.draftId === 'old'
        ? current.authority.transport
        : next.authority.transport,
  };
  const first = createWorkspace(gateway);
  const second = createWorkspace(gateway);
  const stops = [first.start(), second.start()];
  try {
    await expect.poll(() => ready(first).canConfirm).toBe(true);
    await expect.poll(() => ready(second).canConfirm).toBe(true);
    const results = await Promise.all([
      ready(first).confirm(),
      ready(second).confirm(),
    ]);
    expect(results.sort()).toEqual(['accepted', 'failed']);
    for (const receive of sources) receive(next.source);
    for (const workspace of [first, second]) {
      await expect.poll(() => ready(workspace).canConfirm).toBe(true);
      expect(ready(workspace)).toMatchObject({
        confirmedWeek: { week: 40 },
        feedback: 'idle',
        editingDisabled: false,
      });
    }
  } finally {
    stops.forEach((stop) => stop());
  }
});

test('a superseded preview failure cannot erase successor facts or its notice', async () => {
  const current = fixture('old', 40);
  const next = fixture('next', 41);
  const previewResponse = deferred();
  const workspace = createWorkspace({
    ...current.gateway,
    transport: (source) =>
      source.key.draftId === 'old'
        ? {
            ...current.authority.transport,
            async preview() {
              await previewResponse.promise;
              throw new Error('old preview failed');
            },
          }
        : next.authority.transport,
  });
  const stop = workspace.start();
  try {
    await expect.poll(() => workspace.getSnapshot().status).toBe('ready');
    current.receive(next.source);
    await expect.poll(() => ready(workspace).canConfirm).toBe(true);
    const facts = ready(workspace).referenceFacts;
    previewResponse.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(ready(workspace).referenceFacts).toEqual(facts);
    expect(ready(workspace).confirmedWeek?.week).toBe(40);
  } finally {
    previewResponse.resolve();
    stop();
  }
});

test('safe maintenance failure remains readable and clears on the next accepted save', async () => {
  const current = fixture();
  let paused = true;
  const workspace = createWorkspace({
    ...current.gateway,
    transport: () => ({
      ...current.authority.transport,
      async send(operation) {
        if (paused)
          throw new DraftRejected('Operation rejected', { maintenance: true });
        return current.authority.transport.send(operation);
      },
    }),
  });
  const stop = workspace.start();
  try {
    await expect.poll(() => ready(workspace).canConfirm).toBe(true);
    expect(
      await ready(workspace).edit({ kind: 'event_chance', roll: null }),
    ).toBe('failed');
    expect(ready(workspace)).toMatchObject({
      feedback: 'failed',
      failureReason:
        'Editing is paused for maintenance. Saved information remains available.',
      reviewRequired: true,
      editingDisabled: false,
    });
    paused = false;
    expect(
      await ready(workspace).edit({
        kind: 'event_chance',
        roll: roll(100, 100),
      }),
    ).toBe('accepted');
    expect(ready(workspace)).toMatchObject({
      feedback: 'saved',
      failureReason: null,
      reviewRequired: true,
    });
  } finally {
    stop();
  }
});
