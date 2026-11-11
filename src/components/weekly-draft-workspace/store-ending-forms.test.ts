import { expect, test } from 'vitest';
import { createMemoryDraftAuthority } from '~/lib/memory-draft-persistence';
import { createDraftPersistence } from '~/lib/weekly-draft-persistence';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import type { StagedActionChoice } from '~/lib/weekly-draft-facts';
import { settlementFixture } from '../../../tests/rules/settlement-fixture';
import { roll } from '../../../tests/rules/upkeep-fixture';
import type { WorkspaceGateway } from './gateway';
import { endingFormBasis, endingFormId } from './persistent-ending-guard';
import { createWorkspace } from './store';

// A held Persistent table ending belongs to the decision it was typed
// against. The store drops it as soon as its event no longer offers that
// decision, so Confirm is never held by a form nobody can meaningfully save.

// A carried Theft and a Reduce Danger whose check has not succeeded yet.
function fixture() {
  const { draft, snapshot, choice } = settlementFixture('reduce_danger');
  const succeeded = structuredClone(choice) as StagedActionChoice;
  if (!('rolls' in choice)) throw new Error('fixture');
  choice.rolls = { check: roll(20, 1) };
  draft.context = {
    ...draft.context,
    persistentPhaseEligible: true,
    carriedEvents: [
      {
        eventId: 'carried',
        eventType: 'theft',
        startedWeek: draft.week - 1,
        order: 0,
        targets: [],
      },
    ],
  };
  draft.persistent.decisions = [{ kind: 'buyoff', eventId: 'carried' }];
  const source = workspaceSourceSchema.parse({
    key: { campaignId: 'campaign', militiaId: 'militia', draftId: 'draft' },
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
  return {
    gateway,
    source,
    slotId: draft.activity.slots[0]!.slotId,
    succeeded,
  };
}
function ready(workspace: ReturnType<typeof createWorkspace>) {
  const snapshot = workspace.getSnapshot();
  if (snapshot.status !== 'ready') throw new Error('Expected ready Workspace');
  return snapshot;
}
const buyoff = endingFormBasis({ kind: 'buyoff', eventId: 'carried' });
const held = {
  message: 'Theft · Event 1 ending needs a reason.',
  phase: 'persistent' as const,
  basis: buyoff,
};

test('[PER-06.guard-remote-end] an ending held while Activity ends its event elsewhere is dropped with its input, and Confirm is no longer held by it', async () => {
  const week = fixture();
  const device = createWorkspace(week.gateway);
  const stop = device.start();
  try {
    await expect.poll(() => ready(device).status).toBe('ready');
    const id = endingFormId('carried');
    device.setLocalForm(id, held);
    device.keepLocalValues(id, { outcome: 'The thieves fled', reason: '' });
    expect(ready(device).localForms).toEqual([{ id, ...held }]);
    expect(device.readLocalValues(id)).toEqual({
      outcome: 'The thieves fled',
      reason: '',
    });
    // Another player's Reduce Danger succeeds: Activity ends the Theft.
    const other = createDraftPersistence(week.gateway.transport(week.source));
    await other.ready;
    expect(
      await other.edit({
        kind: 'detail',
        slotId: week.slotId,
        choiceId: week.succeeded.choiceId,
        choice: week.succeeded,
      }),
    ).toBe('accepted');
    await expect.poll(() => ready(device).localForms).toEqual([]);
    expect(device.readLocalValues(id)).toBeUndefined();
    expect(ready(device).confirmationDisabledReason).not.toMatch(
      /unsaved change/,
    );
    other.dispose();
  } finally {
    stop();
  }
});

test('[PER-06.guard-remote-decision] an ending held against one saved decision is dropped when another player changes that decision, and kept while it still applies', async () => {
  const week = fixture();
  const device = createWorkspace(week.gateway);
  const stop = device.start();
  try {
    await expect.poll(() => ready(device).status).toBe('ready');
    const id = endingFormId('carried');
    device.setLocalForm(id, held);
    const other = createDraftPersistence(week.gateway.transport(week.source));
    await other.ready;
    // An unrelated edit leaves the held ending in place.
    expect(
      await other.edit({ kind: 'event_chance', roll: roll(100, 99) }),
    ).toBe('accepted');
    await expect.poll(() => ready(device).phases.length).toBeGreaterThan(0);
    expect(ready(device).localForms).toEqual([{ id, ...held }]);
    expect(
      await other.edit({
        kind: 'persistent_decision',
        decision: { kind: 'unattempted', eventId: 'carried' },
      }),
    ).toBe('accepted');
    await expect.poll(() => ready(device).localForms).toEqual([]);
    other.dispose();
  } finally {
    stop();
  }
});

test('[PER-06.guard-not-carried] an ending for an event this week does not carry is never held', async () => {
  const week = fixture();
  const device = createWorkspace(week.gateway);
  const stop = device.start();
  try {
    await expect.poll(() => ready(device).status).toBe('ready');
    device.setLocalForm(endingFormId('gone'), {
      ...held,
      basis: endingFormBasis(null),
    });
    expect(ready(device).localForms).toEqual([]);
  } finally {
    stop();
  }
});
