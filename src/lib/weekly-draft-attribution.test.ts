import { afterEach, expect, test } from 'vitest';
import { upkeepFixture, roll } from '../../tests/rules/upkeep-fixture';
import { createMemoryDraftAuthority } from './memory-draft-persistence';
import { createDraftPersistence } from './weekly-draft-persistence';
import type { WeeklyDraftEdit } from './weekly-draft-contract';
import {
  DraftRejected,
  DraftTransportFailure,
  type DraftObservation,
  type DraftReceipt,
  type DraftTransport,
} from './weekly-draft-persistence-contract';

const dispose: (() => void)[] = [];
afterEach(() => {
  for (const stop of dispose.splice(0)) stop();
});
function fixture(
  wrap: (transport: DraftTransport) => DraftTransport = (value) => value,
) {
  const { draft, snapshot } = upkeepFixture();
  draft.context = { ...draft.context, firstMilitiaWeek: true };
  draft.event.chanceRoll = roll(100, 100);
  const authority = createMemoryDraftAuthority(draft, snapshot);
  const persistence = createDraftPersistence(wrap(authority.transport));
  dispose.push(() => persistence.dispose());
  let operation = 0;
  const remote = async (edit: WeeklyDraftEdit) => {
    const current = await authority.transport.read();
    return authority.transport.send({
      draftId: draft.draftId,
      operationId: `remote-${++operation}`,
      baseRevision: current.revision,
      edit,
    });
  };
  return { persistence, authority, remote };
}

test('only new remote accepted targets are announced, never the initial observation', async () => {
  const { persistence, remote } = fixture();
  await persistence.ready;
  expect(persistence.getSnapshot().remoteChange).toBeNull();
  await remote({ kind: 'event_chance', roll: roll(100, 50) });
  expect(persistence.getSnapshot().remoteChange).toEqual({
    sequence: 1,
    targets: [['event', 'chanceRoll']],
  });
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('a local subscription arriving before its receipt never announces another player', async () => {
  const committed = deferred();
  const response = deferred();
  const { persistence } = fixture((transport) => ({
    ...transport,
    async send(operation) {
      const receipt = await transport.send(operation);
      committed.resolve();
      await response.promise;
      return receipt;
    },
  }));
  await persistence.ready;
  const saving = persistence.edit({
    kind: 'event_chance',
    roll: roll(100, 30),
  });
  await committed.promise;
  try {
    expect(persistence.getSnapshot().observation?.revision).toBe(1);
    expect(persistence.getSnapshot().remoteChange).toBeNull();
  } finally {
    response.resolve();
  }
  expect(await saving).toBe('accepted');
  expect(persistence.getSnapshot().remoteChange).toBeNull();
});

function heldSubscriptions() {
  let latest: DraftObservation | undefined;
  let deliver: ((value: DraftObservation) => void) | undefined;
  return {
    wrap(this: void, transport: DraftTransport): DraftTransport {
      return {
        ...transport,
        subscribe(next, failed) {
          deliver = next;
          return transport.subscribe((value) => {
            latest = value;
            if (value.revision === 0) next(value);
          }, failed);
        },
      };
    },
    flush() {
      deliver!(latest!);
    },
  };
}

test('a local receipt arriving before subscription is not announced twice or attributed remotely', async () => {
  const held = heldSubscriptions();
  const { persistence } = fixture(held.wrap);
  await persistence.ready;
  expect(
    await persistence.edit({ kind: 'event_chance', roll: roll(100, 40) }),
  ).toBe('accepted');
  expect(persistence.getSnapshot().remoteChange).toBeNull();
  held.flush();
  expect(persistence.getSnapshot().remoteChange).toBeNull();
});

test('coalesced remote revisions retain every evidenced target and suppress repeated snapshots', async () => {
  const held = heldSubscriptions();
  const { persistence, remote } = fixture(held.wrap);
  await persistence.ready;
  await remote({ kind: 'upkeep_roll', field: 'check', roll: roll(20, 10) });
  await remote({ kind: 'event_chance', roll: roll(100, 50) });
  held.flush();
  expect(persistence.getSnapshot().remoteChange).toEqual({
    sequence: 1,
    targets: [
      ['upkeep', 'rolls', 'check'],
      ['event', 'chanceRoll'],
    ],
  });
  held.flush();
  expect(persistence.getSnapshot().remoteChange?.sequence).toBe(1);
});

test('remote disjoint writes remain visible during an own held receipt and overlapping evidence resolves afterwards', async () => {
  const committed = deferred();
  const response = deferred();
  const { persistence, remote } = fixture((transport) => ({
    ...transport,
    async send(operation) {
      const receipt = await transport.send(operation);
      committed.resolve();
      await response.promise;
      return receipt;
    },
  }));
  await persistence.ready;
  const saving = persistence.edit({
    kind: 'event_chance',
    roll: roll(100, 30),
  });
  await committed.promise;
  try {
    await remote({ kind: 'upkeep_roll', field: 'check', roll: roll(20, 10) });
    expect(persistence.getSnapshot().remoteChange).toEqual({
      sequence: 1,
      targets: [['upkeep', 'rolls', 'check']],
    });
    await remote({ kind: 'event_chance', roll: roll(100, 45) });
    expect(persistence.getSnapshot().remoteChange?.sequence).toBe(1);
  } finally {
    response.resolve();
  }
  expect(await saving).toBe('accepted');
  expect(persistence.getSnapshot().observation?.revision).toBe(3);
  expect(persistence.getSnapshot().remoteChange).toEqual({
    sequence: 2,
    targets: [['event', 'chanceRoll']],
  });
});

test('a hydrated own receipt can contain a newer observation with remote targets', async () => {
  const held = heldSubscriptions();
  const committed = deferred();
  const response = deferred();
  const { persistence, remote } = fixture((transport) => ({
    ...held.wrap(transport),
    async send(operation) {
      const receipt = await transport.send(operation);
      committed.resolve();
      await response.promise;
      return { ...receipt, observation: await transport.read() };
    },
  }));
  await persistence.ready;
  const saving = persistence.edit({
    kind: 'event_chance',
    roll: roll(100, 30),
  });
  await committed.promise;
  try {
    await remote({ kind: 'upkeep_roll', field: 'check', roll: roll(20, 10) });
    await remote({ kind: 'event_chance', roll: roll(100, 45) });
  } finally {
    response.resolve();
  }
  expect(await saving).toBe('accepted');
  expect(persistence.getSnapshot().remoteChange).toEqual({
    sequence: 1,
    targets: [
      ['event', 'chanceRoll'],
      ['upkeep', 'rolls', 'check'],
    ],
  });
  held.flush();
  expect(persistence.getSnapshot().remoteChange?.sequence).toBe(1);
});

test('an indeterminate failed acknowledgement never becomes a remote edit during later recovery', async () => {
  let first = true;
  const { persistence, remote } = fixture((transport) => ({
    ...transport,
    async send(operation) {
      const receipt = await transport.send(operation);
      if (first) {
        first = false;
        throw new Error('Response lost after commit');
      }
      return receipt;
    },
  }));
  await persistence.ready;
  expect(
    await persistence.edit({ kind: 'event_chance', roll: roll(100, 30) }),
  ).toBe('failed');
  expect(persistence.getSnapshot().remoteChange).toBeNull();
  expect(
    await persistence.edit({ kind: 'event_chance', roll: roll(100, 40) }),
  ).toBe('accepted');
  expect(persistence.getSnapshot().remoteChange).toBeNull();
  await remote({ kind: 'upkeep_roll', field: 'check', roll: roll(20, 10) });
  expect(persistence.getSnapshot().remoteChange).toEqual({
    sequence: 1,
    targets: [['upkeep', 'rolls', 'check']],
  });
});

test('closure clears remote feedback and a late own receipt cannot revive it', async () => {
  const committed = deferred();
  const response = deferred();
  const { persistence, authority, remote } = fixture((transport) => ({
    ...transport,
    async send(operation) {
      const receipt = await transport.send(operation);
      committed.resolve();
      await response.promise;
      return receipt;
    },
  }));
  await persistence.ready;
  await remote({ kind: 'upkeep_roll', field: 'check', roll: roll(20, 10) });
  const saving = persistence.edit({
    kind: 'event_chance',
    roll: roll(100, 30),
  });
  await committed.promise;
  try {
    await remote({ kind: 'event_chance', roll: roll(100, 40) });
    authority.close();
    expect(persistence.getSnapshot().observation?.status).toBe('closed');
    expect(persistence.getSnapshot().remoteChange).toBeNull();
  } finally {
    response.resolve();
  }
  await saving;
  expect(persistence.getSnapshot().remoteChange).toBeNull();
});

test('a definitive first-attempt rejection does not hide subsequent remote edits to the same target', async () => {
  const { persistence, remote } = fixture((transport) => ({
    ...transport,
    async send() {
      throw new DraftRejected('Operation rejected');
    },
  }));
  await persistence.ready;
  expect(
    await persistence.edit({ kind: 'event_chance', roll: roll(100, 30) }),
  ).toBe('failed');
  await remote({ kind: 'event_chance', roll: roll(100, 40) });
  expect(persistence.getSnapshot().remoteChange).toEqual({
    sequence: 1,
    targets: [['event', 'chanceRoll']],
  });
});

test('safe maintenance detail accompanies failure and clears at the next edit, never exposing ordinary errors', async () => {
  let failure: Error | null = new DraftRejected('Operation rejected', {
    maintenance: true,
  });
  const response = deferred();
  const { persistence } = fixture((transport) => ({
    ...transport,
    async send(operation) {
      if (failure) throw failure;
      await response.promise;
      return transport.send(operation);
    },
  }));
  await persistence.ready;
  expect(persistence.getSnapshot().failureReason).toBeNull();
  expect(
    await persistence.edit({ kind: 'event_chance', roll: roll(100, 30) }),
  ).toBe('failed');
  expect(persistence.getSnapshot().failureReason).toBe(
    'Editing is paused for maintenance. Saved information remains available.',
  );
  failure = null;
  const saving = persistence.edit({
    kind: 'event_chance',
    roll: roll(100, 40),
  });
  try {
    expect(persistence.getSnapshot().failureReason).toBeNull();
  } finally {
    response.resolve();
  }
  expect(await saving).toBe('accepted');
  expect(persistence.getSnapshot().failureReason).toBeNull();
  for (const error of [
    new Error(
      'Editing is paused for maintenance. Saved information remains available.',
    ),
    new DraftRejected('Private internal id secret'),
  ]) {
    failure = error;
    expect(
      await persistence.edit({ kind: 'event_chance', roll: roll(100, 50) }),
    ).toBe('failed');
    expect(persistence.getSnapshot().failureReason).toBeNull();
  }
});

test('a failed Confirmation exposes the safe maintenance reason without claiming success', async () => {
  const { persistence } = fixture((transport) => ({
    ...transport,
    async confirm() {
      throw new DraftRejected('Operation rejected', { maintenance: true });
    },
  }));
  await persistence.ready;
  const review = await persistence.preview();
  expect(review?.status).toBe('ready');
  expect(await persistence.confirm(review!)).toBe('failed');
  expect(persistence.getSnapshot()).toMatchObject({
    confirming: false,
    confirmation: null,
    failureReason:
      'Editing is paused for maintenance. Saved information remains available.',
    observation: { status: 'open' },
  });
});

test('one receipt reconciles observed deferred and newly hydrated remote targets in a single consumable batch', async () => {
  const held = heldSubscriptions();
  const committed = deferred();
  const response = deferred();
  const { persistence, remote } = fixture((transport) => ({
    ...held.wrap(transport),
    async send(operation) {
      const receipt = await transport.send(operation);
      committed.resolve();
      await response.promise;
      return { ...receipt, observation: await transport.read() };
    },
  }));
  await persistence.ready;
  const changes: unknown[] = [];
  persistence.subscribe(() => {
    changes.push(persistence.getSnapshot().remoteChange);
  });
  const saving = persistence.edit({
    kind: 'event_chance',
    roll: roll(100, 30),
  });
  await committed.promise;
  try {
    await remote({ kind: 'event_chance', roll: roll(100, 40) });
    held.flush();
    expect(persistence.getSnapshot().remoteChange).toBeNull();
    await remote({ kind: 'upkeep_roll', field: 'check', roll: roll(20, 10) });
  } finally {
    response.resolve();
  }
  expect(await saving).toBe('accepted');
  const expected = {
    sequence: 1,
    targets: [
      ['event', 'chanceRoll'],
      ['upkeep', 'rolls', 'check'],
    ],
  };
  expect(persistence.getSnapshot().remoteChange).toEqual(expected);
  expect(changes.filter(Boolean)).toContainEqual(expected);
});

test.each(['operation', 'draft', 'future revision', 'old revision'])(
  'a receipt with the wrong %s cannot attribute an own write or leave dispatch unresolved',
  async (invalid) => {
    let damage = true;
    const { persistence, remote } = fixture((transport) => ({
      ...transport,
      async send(operation) {
        const receipt: DraftReceipt = await transport.send(operation);
        if (!damage) return receipt;
        damage = false;
        if (invalid === 'operation') receipt.operationId = 'unrelated';
        if (invalid === 'draft')
          receipt.observation = {
            ...receipt.observation,
            draftId: 'other',
            status: 'closed',
            draft: null,
          };
        if (invalid === 'future revision')
          receipt.acceptedRevision = receipt.observation.revision + 1;
        if (invalid === 'old revision')
          receipt.acceptedRevision = operation.baseRevision;
        return receipt;
      },
    }));
    await persistence.ready;
    expect(
      await persistence.edit({ kind: 'event_chance', roll: roll(100, 30) }),
    ).toBe('failed');
    expect(persistence.getSnapshot().remoteChange).toBeNull();
    expect(
      await persistence.edit({ kind: 'event_chance', roll: roll(100, 40) }),
    ).toBe('accepted');
    expect(persistence.getSnapshot().remoteChange).toBeNull();
    await remote({ kind: 'upkeep_roll', field: 'check', roll: roll(20, 10) });
    expect(persistence.getSnapshot().remoteChange).toEqual({
      sequence: 1,
      targets: [['upkeep', 'rolls', 'check']],
    });
  },
);

test('a dropped acknowledgement retry uses one own revision and never announces it remotely', async () => {
  let attempts = 0;
  const { persistence, authority } = fixture((transport) => ({
    ...transport,
    async send(operation) {
      const receipt = await transport.send(operation);
      if (++attempts === 1)
        throw new DraftTransportFailure('Acknowledgement dropped');
      return receipt;
    },
  }));
  await persistence.ready;
  expect(
    await persistence.edit({ kind: 'event_chance', roll: roll(100, 30) }),
  ).toBe('accepted');
  expect(attempts).toBe(2);
  expect((await authority.transport.read()).revision).toBe(1);
  expect(persistence.getSnapshot().remoteChange).toBeNull();
});

test('a rejection after an uncertain retry cannot prove an earlier attempt never committed', async () => {
  let attempts = 0;
  const { persistence, remote } = fixture((transport) => ({
    ...transport,
    async send(operation) {
      if (++attempts > 1) throw new DraftRejected('No longer available');
      await transport.send(operation);
      throw new DraftTransportFailure('Acknowledgement dropped');
    },
  }));
  await persistence.ready;
  expect(
    await persistence.edit({ kind: 'event_chance', roll: roll(100, 30) }),
  ).toBe('failed');
  expect(persistence.getSnapshot().remoteChange).toBeNull();
  await remote({ kind: 'event_chance', roll: roll(100, 40) });
  expect(persistence.getSnapshot().remoteChange).toBeNull();
  await remote({ kind: 'upkeep_roll', field: 'check', roll: roll(20, 10) });
  expect(persistence.getSnapshot().remoteChange).toEqual({
    sequence: 1,
    targets: [['upkeep', 'rolls', 'check']],
  });
});

test('a queued same-target conflict remains rejected and does not hide the remote cause', async () => {
  const committed = deferred();
  const response = deferred();
  const { persistence, remote } = fixture((transport) => ({
    ...transport,
    async send(operation) {
      const receipt = await transport.send(operation);
      committed.resolve();
      await response.promise;
      return receipt;
    },
  }));
  await persistence.ready;
  const first = persistence.edit({ kind: 'event_chance', roll: roll(100, 30) });
  const queued = persistence.edit({
    kind: 'event_chance',
    roll: roll(100, 40),
  });
  await committed.promise;
  try {
    await remote({ kind: 'event_chance', roll: roll(100, 50) });
  } finally {
    response.resolve();
  }
  expect(await first).toBe('accepted');
  expect(await queued).toBe('failed');
  const savedRoll =
    persistence.getSnapshot().observation?.draft?.event.chanceRoll;
  expect(savedRoll).toMatchObject({ diceTotal: 50, diceCount: 1 });
  expect(persistence.getSnapshot().remoteChange).toEqual({
    sequence: 1,
    targets: [['event', 'chanceRoll']],
  });
  await remote({ kind: 'event_chance', roll: roll(100, 60) });
  expect(persistence.getSnapshot().remoteChange?.sequence).toBe(2);
});

test('old target metadata at initial load and malformed paths are not announced; published evidence is isolated', async () => {
  const { persistence, remote } = fixture((transport) => {
    const withMetadata = (value: DraftObservation): DraftObservation => ({
      ...value,
      targetRevisions: [
        ...value.targetRevisions,
        { target: '["old"]', revision: 0 },
        { target: 'not JSON', revision: value.revision },
        { target: '[7]', revision: value.revision },
        { target: '[]', revision: value.revision },
      ],
    });
    return {
      ...transport,
      async read() {
        return withMetadata(await transport.read());
      },
      subscribe(next, failed) {
        return transport.subscribe(
          (value) => next(withMetadata(value)),
          failed,
        );
      },
    };
  });
  await persistence.ready;
  expect(persistence.getSnapshot().remoteChange).toBeNull();
  await remote({ kind: 'event_chance', roll: roll(100, 30) });
  const evidence = persistence.getSnapshot().remoteChange!;
  evidence.sequence = 90;
  Object.assign(evidence.targets[0]!, { 0: 'mutated' });
  expect(persistence.getSnapshot().remoteChange).toEqual({
    sequence: 1,
    targets: [['event', 'chanceRoll']],
  });
  persistence.dispose();
  await remote({ kind: 'event_chance', roll: roll(100, 40) });
  expect(persistence.getSnapshot().remoteChange).toBeNull();
});

test('loading an already edited draft establishes a baseline without replaying its history', async () => {
  const { draft, snapshot } = upkeepFixture();
  const authority = createMemoryDraftAuthority(draft, snapshot);
  await authority.transport.send({
    draftId: draft.draftId,
    operationId: 'earlier-edit',
    baseRevision: 0,
    edit: { kind: 'event_chance', roll: roll(100, 20) },
  });
  const persistence = createDraftPersistence(authority.transport);
  dispose.push(() => persistence.dispose());
  await persistence.ready;
  expect(persistence.getSnapshot().observation?.revision).toBe(1);
  expect(persistence.getSnapshot().remoteChange).toBeNull();
  await authority.transport.send({
    draftId: draft.draftId,
    operationId: 'later-edit',
    baseRevision: 1,
    edit: { kind: 'upkeep_roll', field: 'check', roll: roll(20, 10) },
  });
  expect(persistence.getSnapshot().remoteChange).toEqual({
    sequence: 1,
    targets: [['upkeep', 'rolls', 'check']],
  });
});

test('a queued malformed receipt does not retain an earlier operation’s maintenance detail', async () => {
  let attempts = 0;
  const { persistence } = fixture((transport) => ({
    ...transport,
    async send(operation) {
      if (++attempts === 1)
        throw new DraftRejected('Operation rejected', { maintenance: true });
      return { ...(await transport.send(operation)), operationId: 'wrong' };
    },
  }));
  await persistence.ready;
  const first = persistence.edit({ kind: 'event_chance', roll: roll(100, 30) });
  const second = persistence.edit({
    kind: 'event_chance',
    roll: roll(100, 40),
  });
  expect(await first).toBe('failed');
  expect(await second).toBe('failed');
  expect(persistence.getSnapshot().failureReason).toBeNull();
});
