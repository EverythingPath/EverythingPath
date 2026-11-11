import { expect, test } from 'vitest';
import { DraftRejected } from '~/lib/weekly-draft-persistence-contract';
import type { WeeklyDraft, WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import { createWorkspace } from './store';
import { workspaceFixture } from './workspace-test-fixture';
import type { WorkspaceGateway } from './gateway';
import { EVENT_PREPARATION_ATTEMPTS } from './event-preparation';

const percentile = (value: number) => ({
  diceTotal: value,
  diceCount: 1,
  sides: 100,
  provenance: { kind: 'table' as const },
  modifiers: [],
});
function ready(workspace: ReturnType<typeof createWorkspace>) {
  const snapshot = workspace.getSnapshot();
  if (snapshot.status !== 'ready') throw new Error('Expected ready Workspace');
  return snapshot;
}
function eventFacts(workspace: ReturnType<typeof createWorkspace>) {
  ready(workspace).viewPhase('event');
  const view = ready(workspace).phaseView;
  if (view.phase !== 'event') throw new Error('Expected Event');
  return view;
}
function accepted(fixture: ReturnType<typeof workspaceFixture>) {
  return fixture.authority.inspect().openDrafts[0] as WeeklyDraft;
}
const settled = (workspace: ReturnType<typeof createWorkspace>) =>
  expect
    .poll(() => {
      const state = ready(workspace);
      return !state.pendingWork && state.eventPreparation?.status === 'idle';
    })
    .toBe(true);
function start(gateway: WorkspaceGateway) {
  const workspace = createWorkspace(gateway);
  const stop = workspace.start();
  return { workspace, stop };
}

test('[EVT-03.converge] two devices observing a triggered chance roll converge on one prepared root', async () => {
  const fixture = workspaceFixture();
  const a = start(fixture.gateway);
  const b = start(fixture.gateway);
  try {
    await expect.poll(() => a.workspace.getSnapshot().status).toBe('ready');
    await expect.poll(() => b.workspace.getSnapshot().status).toBe('ready');
    expect(
      await ready(a.workspace).edit({
        kind: 'event_chance',
        roll: percentile(1),
      }),
    ).toBe('accepted');
    await settled(a.workspace);
    await settled(b.workspace);
    expect(accepted(fixture).event.occurrences).toEqual([
      { eventId: 'workspace:rolled:1', origin: { kind: 'rolled' } },
    ]);
    for (const device of [a.workspace, b.workspace]) {
      expect(ready(device).feedback).not.toBe('failed');
      expect(eventFacts(device).rolled.blocks).toMatchObject([
        { eventId: 'workspace:rolled:1', saved: true, status: 'awaiting_roll' },
      ]);
    }
  } finally {
    a.stop();
    b.stop();
  }
});

test('[EVT-13.converge] independent leaf rolls from two devices survive the prepared Roll Twice children', async () => {
  const fixture = workspaceFixture();
  const a = start(fixture.gateway);
  const b = start(fixture.gateway);
  try {
    await expect.poll(() => b.workspace.getSnapshot().status).toBe('ready');
    await ready(a.workspace).edit({
      kind: 'event_chance',
      roll: percentile(1),
    });
    await settled(a.workspace);
    await settled(b.workspace);
    await ready(b.workspace).edit({
      kind: 'event_occurrence',
      occurrence: {
        eventId: 'workspace:rolled:1',
        origin: { kind: 'rolled' },
        tableRoll: percentile(50),
      },
    });
    await settled(a.workspace);
    await settled(b.workspace);
    const children = [
      'workspace:rolled:1/twice/1',
      'workspace:rolled:1/twice/2',
    ];
    expect(accepted(fixture).event.occurrences.map((e) => e.eventId)).toEqual([
      'workspace:rolled:1',
      ...children,
    ]);
    await Promise.all([
      ready(a.workspace).edit({
        kind: 'event_occurrence',
        occurrence: {
          eventId: children[0]!,
          origin: { kind: 'roll_twice', parentEventId: 'workspace:rolled:1' },
          tableRoll: percentile(45),
        },
      }),
      ready(b.workspace).edit({
        kind: 'event_occurrence',
        occurrence: {
          eventId: children[1]!,
          origin: { kind: 'roll_twice', parentEventId: 'workspace:rolled:1' },
          tableRoll: percentile(82),
        },
      }),
    ]);
    await settled(a.workspace);
    await settled(b.workspace);
    expect(
      accepted(fixture).event.occurrences.map((e) =>
        'diceTotal' in (e.tableRoll ?? {}) ? e.tableRoll : null,
      ),
    ).toEqual([percentile(50), percentile(45), percentile(82)]);
    // Moving the parent away from Roll Twice hides the children and keeps them.
    await ready(a.workspace).edit({
      kind: 'event_occurrence',
      occurrence: {
        eventId: 'workspace:rolled:1',
        origin: { kind: 'rolled' },
        tableRoll: percentile(10),
      },
    });
    await settled(a.workspace);
    const [root] = eventFacts(a.workspace).rolled.blocks;
    expect(root!.children).toEqual([]);
    expect(root!.hidden.map((block) => block.eventId)).toEqual(children);
    expect(accepted(fixture).event.occurrences).toHaveLength(3);
  } finally {
    a.stop();
    b.stop();
  }
});

test('[EVT-03.pending] a prepared position shows as a stable blank but accepts no edit until it is saved', async () => {
  const fixture = workspaceFixture();
  const a = start(fixture.gateway);
  try {
    await expect.poll(() => a.workspace.getSnapshot().status).toBe('ready');
    const release = fixture.hold();
    const saving = ready(a.workspace).edit({
      kind: 'event_chance',
      roll: percentile(1),
    });
    const [blank] = eventFacts(a.workspace).rolled.blocks;
    expect(blank).toMatchObject({
      eventId: 'workspace:rolled:1',
      saved: false,
      status: 'preparing',
    });
    expect(eventFacts(a.workspace).preparation).toBe('preparing');
    release();
    await saving;
    await settled(a.workspace);
    expect(eventFacts(a.workspace).rolled.blocks[0]).toMatchObject({
      eventId: 'workspace:rolled:1',
      saved: true,
    });
  } finally {
    a.stop();
  }
});

test('[EVT-03.bounded] a preparation that keeps failing stops after bounded fresh attempts and offers retry', async () => {
  const fixture = workspaceFixture();
  const sent: { operationId: string; edit: WeeklyDraftEdit }[] = [];
  const gateway: WorkspaceGateway = {
    ...fixture.gateway,
    transport: () => ({
      ...fixture.authority.transport,
      async send(operation) {
        if (operation.edit.kind === 'event_tree') {
          sent.push(operation);
          throw new DraftRejected('Target changed');
        }
        return fixture.authority.transport.send(operation);
      },
    }),
  };
  const a = start(gateway);
  try {
    await expect.poll(() => a.workspace.getSnapshot().status).toBe('ready');
    await ready(a.workspace).edit({
      kind: 'event_chance',
      roll: percentile(1),
    });
    await expect
      .poll(() => ready(a.workspace).eventPreparation?.status)
      .toBe('failed');
    expect(sent).toHaveLength(EVENT_PREPARATION_ATTEMPTS);
    // Each attempt is a fresh operation computed from the refreshed draft.
    expect(new Set(sent.map((entry) => entry.operationId)).size).toBe(
      EVENT_PREPARATION_ATTEMPTS,
    );
    expect(ready(a.workspace).feedback).toBe('failed');
    expect(eventFacts(a.workspace).preparation).toBe('failed');
    expect(
      ready(a.workspace).phases.find((p) => p.phase === 'event')!.ready,
    ).toBe(false);
    ready(a.workspace).eventPreparation!.retry();
    await expect.poll(() => sent.length).toBe(EVENT_PREPARATION_ATTEMPTS * 2);
  } finally {
    a.stop();
  }
});

test('[EVT-06.stale] a candidate preparation for a replaced choice never writes stale candidates into the new choice', async () => {
  const fixture = workspaceFixture();
  const a = start(fixture.gateway);
  const b = start(fixture.gateway);
  try {
    await expect.poll(() => b.workspace.getSnapshot().status).toBe('ready');
    const release = fixture.hold();
    // A stages a guarantee; while its candidate preparation waits, B replaces it.
    const staging = ready(a.workspace).edit({
      kind: 'stage',
      slotId: 'left',
      choice: { choiceId: 'first', actionId: 'guarantee_event' },
    });
    release();
    await staging;
    await ready(b.workspace).edit({
      kind: 'replace',
      slotId: 'left',
      choiceId: 'first',
      choice: { choiceId: 'second', actionId: 'guarantee_event' },
    });
    await settled(a.workspace);
    await settled(b.workspace);
    const choice = accepted(fixture).activity.slots[0]!.choice!;
    expect(choice.choiceId).toBe('second');
    expect('candidates' in choice && choice.candidates).toEqual([
      { eventId: 'workspace:candidate:second:1', origin: { kind: 'rolled' } },
      { eventId: 'workspace:candidate:second:2', origin: { kind: 'rolled' } },
    ]);
  } finally {
    a.stop();
    b.stop();
  }
});

test('[EVT-03.successor] preparation belongs to its draft: a closed week receives no preparation', async () => {
  const fixture = workspaceFixture();
  const a = start(fixture.gateway);
  try {
    await expect.poll(() => a.workspace.getSnapshot().status).toBe('ready');
    fixture.authority.close();
    await expect.poll(() => ready(a.workspace).editingDisabled).toBe(true);
    expect(
      await ready(a.workspace).edit({
        kind: 'event_chance',
        roll: percentile(1),
      }),
    ).toBe('failed');
    expect(fixture.authority.inspect().openDrafts).toEqual([]);
  } finally {
    a.stop();
  }
});
