import { expect, test } from 'vitest';
import { createWeeklyDraft } from './weekly-draft';
import { createMemoryDraftAuthority } from './memory-draft-persistence';
import { createDraftPersistence } from './weekly-draft-persistence';
import type { WeeklyDraftEdit } from './weekly-draft-contract';

function authority() {
  const draft = createWeeklyDraft({
    draftId: 'week-one',
    week: 1,
    slotIds: ['left', 'right'],
    context: {
      firstMilitiaWeek: true,
      startDay: 0,
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
  return createMemoryDraftAuthority(draft, {
    rank: 1,
    training: 0,
    treasuryCopper: 100,
    notoriety: 0,
    focus: 'Loyalty',
    roster: { people: [], teams: [], officers: [] },
    characters: [],
    settlements: [],
    bonuses: [],
  });
}
test('[rules.P80.history] accepted review confirms once, closes its identity and starts an empty fixed-context week', async () => {
  const server = authority();
  const workspace = createDraftPersistence(server.transport);
  await workspace.ready;
  const review = await workspace.preview();
  expect(review?.status).toBe('ready');
  expect(await workspace.confirm(review!)).toBe('accepted');
  const result = workspace.getSnapshot().confirmation;
  expect(result?.record.source.week).toBe(1);
  expect(result?.successor).toMatchObject({
    week: 2,
    revision: 0,
    context: { firstMilitiaWeek: false, startDay: 7, uneventfulCarry: false },
    activity: {
      slots: [
        { slotId: 'left', choice: null },
        { slotId: 'right', choice: null },
      ],
    },
  });
  expect(workspace.getSnapshot().observation?.status).toBe('closed');
  expect(await workspace.confirm(review!)).toBe('failed');
  workspace.dispose();
});

test('[rules.ACT-19.confirmation] removing an added empty extra slot confirms exactly like a week that never had it', async () => {
  async function confirmWith(edits: WeeklyDraftEdit[]) {
    const server = authority();
    const client = createDraftPersistence(server.transport);
    await client.ready;
    for (const edit of edits) expect(await client.edit(edit)).toBe('accepted');
    const review = await client.preview();
    expect(await client.confirm(review!)).toBe('accepted');
    const { record, successor } = client.getSnapshot().confirmation!;
    client.dispose();
    return {
      baselinePlan: record.baselinePlan,
      finalPlan: record.finalPlan,
      finalOutcome: record.finalOutcome,
      warnings: record.warnings,
      successorContext: record.successorContext,
      successorSlots: successor.activity.slots,
    };
  }
  const plain = await confirmWith([]);
  expect(
    await confirmWith([
      { kind: 'add_slot', slotId: 'spare' },
      { kind: 'remove_slot', slotId: 'spare' },
    ]),
  ).toEqual(plain);
});

test('[rules.P80.barrier] Confirmation waits for an earlier edit, pauses new edits and never substitutes the flushed review', async () => {
  const server = authority();
  let release!: () => void;
  let entered!: () => void;
  const held = new Promise<void>((done) => {
    release = done;
  });
  const started = new Promise<void>((done) => {
    entered = done;
  });
  const workspace = createDraftPersistence({
    ...server.transport,
    async send(operation) {
      entered();
      await held;
      return server.transport.send(operation);
    },
  });
  await workspace.ready;
  const review = (await workspace.preview())!;
  const edit = workspace.edit({
    kind: 'event_chance',
    roll: {
      diceTotal: 99,
      diceCount: 1,
      sides: 100,
      provenance: { kind: 'table' },
      modifiers: [],
    },
  });
  await started;
  expect(await workspace.preview()).toBeNull();
  const confirmation = workspace.confirm(review);
  expect(workspace.getSnapshot().confirming).toBe(true);
  expect(await workspace.edit({ kind: 'event_chance', roll: null })).toBe(
    'failed',
  );
  release();
  expect(await edit).toBe('accepted');
  expect(await confirmation).toBe('failed');
  expect(workspace.getSnapshot().observation).toMatchObject({
    status: 'open',
    revision: 1,
  });
  expect(await workspace.confirm((await workspace.preview())!)).toBe(
    'accepted',
  );
  workspace.dispose();
});

import { runConfirmationContract } from '../../tests/persistence/confirmation-contracts';
test('[rules.P80.contract] memory adapter satisfies the shared exact Confirmation contract', async () => {
  await runConfirmationContract(async () => {
    const draft = createWeeklyDraft({
      draftId: 'contract-week',
      week: 1,
      slotIds: ['left', 'right', 'extra'],
      context: {
        firstMilitiaWeek: true,
        startDay: 0,
        uneventfulCarry: false,
        carriedEvents: [],
        queuedEffects: [],
        orders: [],
        lastBuyoffWeek: null,
      },
    });
    const server = createMemoryDraftAuthority(draft, {
      rank: 1,
      training: 0,
      treasuryCopper: 100,
      notoriety: 0,
      focus: 'Loyalty',
      roster: { people: [], teams: [], officers: [] },
      characters: [],
      settlements: [],
      bonuses: [],
    });
    return {
      first: server.transport,
      second: server.transport,
      changeSource: async (change) => server.changeSource(change),
      blockSuccessor: async (operationId) =>
        server.reserveDraftIdentity(`next:${operationId}`),
      inspect: async () => server.inspect(),
      dispose: async () => {
        server.close();
      },
    };
  });
});

test('[rules.P80.review-integrity] a caller-mutated forecast cannot alter the retained accepted review or immutable receipt', async () => {
  const server = authority();
  const workspace = createDraftPersistence(server.transport);
  await workspace.ready;
  const changed = (await workspace.preview())!;
  changed.outcome!.militiaSnapshot.treasuryCopper = 999;
  expect(await workspace.confirm(changed)).toBe('failed');
  expect(workspace.getSnapshot().observation?.status).toBe('open');
  const review = (await workspace.preview())!;
  expect(await workspace.confirm(review)).toBe('accepted');
  workspace.getSnapshot().confirmation!.record.sourceMilitiaSnapshot.treasuryCopper = 999;
  expect(
    workspace.getSnapshot().confirmation!.record.sourceMilitiaSnapshot
      .treasuryCopper,
  ).toBe(100);
  const stored = server.inspect();
  stored.records[0]!.sourceMilitiaSnapshot.treasuryCopper = 888;
  expect(
    server.inspect().records[0]!.sourceMilitiaSnapshot.treasuryCopper,
  ).toBe(100);
  workspace.dispose();
});
