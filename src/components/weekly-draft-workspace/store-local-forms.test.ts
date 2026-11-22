import { expect, test } from 'vitest';
import { createMemoryDraftAuthority } from '~/lib/memory-draft-persistence';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import { upkeepFixture, roll } from '../../../tests/rules/upkeep-fixture';
import type { WorkspaceGateway } from './gateway';
import { createWorkspace } from './store';

// The Confirm guard for this device's open or locally invalid Summary forms
// (Table Adjustments and Rules Exception reasons).

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
  const gateway: WorkspaceGateway = {
    subscribe(next) {
      next(source);
      return () => undefined;
    },
    transport: () => authority.transport,
  };
  return { gateway, authority, source };
}

function ready(workspace: ReturnType<typeof createWorkspace>) {
  const snapshot = workspace.getSnapshot();
  if (snapshot.status !== 'ready') throw new Error('Expected ready Workspace');
  return snapshot;
}

const needsReason = 'Table Adjustment “Treasury +5 gp” needs a reason.';

test('an open local Summary form disables only this device’s Confirm with its reason and a local Required decision', async () => {
  const current = fixture();
  const device = createWorkspace(current.gateway);
  const other = createWorkspace(current.gateway);
  const stops = [device.start(), other.start()];
  try {
    await expect.poll(() => ready(device).canConfirm).toBe(true);
    await expect.poll(() => ready(other).canConfirm).toBe(true);
    let publications = 0;
    const stopListening = device.subscribe(() => publications++);
    device.setLocalForm('adjustment:first', { message: needsReason });
    // Registering the same message again publishes nothing new.
    device.setLocalForm('adjustment:first', { message: needsReason });
    expect(publications).toBe(1);
    stopListening();
    const blocked = ready(device);
    expect(blocked.canConfirm).toBe(false);
    expect(blocked.confirmationDisabledReason).toBe(
      'Save or cancel your unsaved change first.',
    );
    expect(blocked.localForms).toEqual([
      { id: 'adjustment:first', message: needsReason },
    ]);
    expect(
      blocked.phases.find((item) => item.phase === 'summary'),
    ).toMatchObject({
      ready: false,
      requirements: [{ id: 'local:adjustment:first', message: needsReason }],
    });
    // Local form state is neither pending work nor shared.
    expect(device.getPendingWork()).toBe(false);
    expect(blocked.pendingWork).toBe(false);
    expect(await blocked.confirm()).toBe('failed');
    expect(ready(other).canConfirm).toBe(true);
    expect(ready(other).localForms).toEqual([]);
    device.keepLocalValues('adjustment:first', { reason: '' });
    device.setLocalForm('adjustment:first', null);
    // Withdrawing a form drops its kept input with it.
    expect(device.readLocalValues('adjustment:first')).toBeUndefined();
    expect(ready(device).canConfirm).toBe(true);
    expect(ready(device).confirmationDisabledReason).toBeNull();
    expect(ready(device).localForms).toEqual([]);
  } finally {
    stops.forEach((stop) => stop());
  }
});

test('another player’s Confirmation resets this device’s local forms with the successor', async () => {
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
  const confirmer = createWorkspace(gateway);
  const editor = createWorkspace(gateway);
  const stops = [confirmer.start(), editor.start()];
  try {
    await expect.poll(() => ready(confirmer).canConfirm).toBe(true);
    await expect.poll(() => ready(editor).canConfirm).toBe(true);
    editor.setLocalForm('new-adjustment', {
      message: 'New Table Adjustment: save or cancel it.',
    });
    editor.keepLocalValues('new-adjustment', { reason: 'Half typed' });
    expect(editor.readLocalValues('new-adjustment')).toEqual({
      reason: 'Half typed',
    });
    expect(ready(editor).canConfirm).toBe(false);
    // This device's unfinished form never blocks the other device.
    expect(await ready(confirmer).confirm()).toBe('accepted');
    for (const receive of sources) receive(next.source);
    await expect.poll(() => ready(editor).week).toBe(41);
    await expect.poll(() => ready(editor).canConfirm).toBe(true);
    expect(ready(editor).localForms).toEqual([]);
    // No input typed against the closed week reaches the successor.
    expect(editor.readLocalValues('new-adjustment')).toBeUndefined();
    expect(
      ready(editor).phases.find((item) => item.phase === 'summary')!
        .requirements,
    ).toEqual([]);
    // A late unregistration from the closed week's form is harmless.
    editor.setLocalForm('new-adjustment', null);
    expect(ready(editor).canConfirm).toBe(true);
  } finally {
    stops.forEach((stop) => stop());
  }
});
