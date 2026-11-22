// @vitest-environment node
import type { Page, WebSocketRoute } from '@playwright/test';
import { expect, test, vi } from 'vitest';
import { controlTransport } from './transport';

async function transport(convexUrl = 'https://preview.convex.cloud') {
  const page = { routeWebSocket: vi.fn<Page['routeWebSocket']>() };
  const control = await controlTransport(page as unknown as Page, convexUrl);
  const [matches, connect] = page.routeWebSocket.mock.calls[0]!;
  if (typeof matches !== 'function') throw new Error('Expected URL predicate');
  async function connection() {
    const server = {
      send: vi.fn<WebSocketRoute['send']>(),
      onMessage: vi.fn<WebSocketRoute['onMessage']>(),
      onClose: vi.fn<WebSocketRoute['onClose']>(),
      close: vi.fn<WebSocketRoute['close']>(),
    };
    const socket = {
      send: vi.fn<WebSocketRoute['send']>(),
      onMessage: vi.fn<WebSocketRoute['onMessage']>(),
      onClose: vi.fn<WebSocketRoute['onClose']>(),
      close: vi.fn<WebSocketRoute['close']>(),
      connectToServer: () => server as unknown as WebSocketRoute,
    };
    await connect(socket as unknown as WebSocketRoute);
    return {
      request: socket.onMessage.mock.calls[0]![0],
      response: server.onMessage.mock.calls[0]![0],
      toServer: server.send,
      toClient: socket.send,
      closeServer: () => server.onClose.mock.calls[0]![0](1001, 'restart'),
      closeClient: () => socket.onClose.mock.calls[0]![0](1000, 'leaving'),
      serverClosed: server.close,
      clientClosed: socket.close,
    };
  }
  return {
    ...control,
    matches,
    ...(await connection()),
    reconnect: connection,
  };
}

const mutation = (requestId: number) =>
  JSON.stringify({ type: 'Mutation', requestId });
const response = (requestId: number) =>
  JSON.stringify({ type: 'MutationResponse', requestId });

test('local fault injection intercepts only the bound ws origin', async () => {
  const wire = await transport('http://127.0.0.1:3210');
  expect(wire.matches(new URL('ws://127.0.0.1:3210/api/sync'))).toBe(true);
  expect(wire.matches(new URL('ws://127.0.0.1:3212/api/sync'))).toBe(false);
  expect(wire.matches(new URL('wss://127.0.0.1:3210/api/sync'))).toBe(false);
  const fault = wire.next('delay-request');
  wire.request(mutation(10));
  expect(fault.observed()).toBe(true);
  expect(wire.toServer).not.toHaveBeenCalled();
  fault.release();
  expect(wire.toServer).toHaveBeenCalledWith(mutation(10));
});

test('only the configured secure host is intercepted and ordinary frames pass unchanged', async () => {
  const wire = await transport();
  expect(wire.matches(new URL('wss://preview.convex.cloud/api/sync'))).toBe(
    true,
  );
  expect(wire.matches(new URL('wss://other.convex.cloud/api/sync'))).toBe(
    false,
  );
  expect(wire.matches(new URL('ws://preview.convex.cloud/api/sync'))).toBe(
    false,
  );
  const binary = Buffer.from('not JSON');
  wire.request(binary);
  wire.response('null');
  expect(wire.toServer).toHaveBeenCalledWith(binary);
  expect(wire.toClient).toHaveBeenCalledWith('null');
});

test('delaying a request queues subsequent outgoing frames in order and release is idempotent', async () => {
  const wire = await transport();
  const fault = wire.next('delay-request');
  wire.request('null');
  expect(fault.observed()).toBe(false);
  wire.request(mutation(1));
  wire.request('later frame');
  wire.response(response(0));
  expect(fault.observed()).toBe(true);
  expect(wire.toServer.mock.calls).toEqual([['null']]);
  expect(wire.toClient).toHaveBeenCalledWith(response(0));
  fault.release();
  fault.release();
  expect(wire.toServer.mock.calls).toEqual([
    ['null'],
    [mutation(1)],
    ['later frame'],
  ]);
});

test('delaying a response matches the first outgoing request and preserves incoming order', async () => {
  const wire = await transport();
  const fault = wire.next('delay-response');
  wire.response(response(1));
  wire.request(mutation(1));
  wire.request(mutation(2));
  wire.response(response(0));
  wire.response(response(2));
  expect(fault.observed()).toBe(false);
  wire.response(response(1));
  const binary = Buffer.from('later frame');
  wire.response(binary);
  expect(fault.observed()).toBe(true);
  expect(wire.toClient.mock.calls).toEqual([
    [response(1)],
    [response(0)],
    [response(2)],
  ]);
  fault.release();
  expect(wire.toClient.mock.calls).toEqual([
    [response(1)],
    [response(0)],
    [response(2)],
    [response(1)],
    [binary],
  ]);
  expect(wire.toServer.mock.calls).toEqual([[mutation(1)], [mutation(2)]]);
});

test('dropping an acknowledgement drops only the first matched response and never the write', async () => {
  const wire = await transport();
  const fault = wire.next('drop-acknowledgement');
  wire.request(mutation(1));
  wire.response(response(0));
  expect(fault.observed()).toBe(false);
  wire.response(response(1));
  expect(fault.observed()).toBe(true);
  wire.response(response(1));
  wire.response('later frame');
  fault.release();
  expect(wire.toServer.mock.calls).toEqual([[mutation(1)]]);
  expect(wire.toClient.mock.calls).toEqual([
    [response(0)],
    [response(1)],
    ['later frame'],
  ]);
});

test('only one fault can be armed and an old release cannot clear a new fault', async () => {
  const wire = await transport();
  const first = wire.next('delay-request');
  expect(() => wire.next('delay-response')).toThrow(
    'Finish the active transport control first',
  );
  first.release();
  const second = wire.next('delay-request');
  first.release();
  wire.request(mutation(1));
  expect(second.observed()).toBe(true);
  expect(wire.toServer).not.toHaveBeenCalled();
  second.release();
  expect(wire.toServer).toHaveBeenCalledWith(mutation(1));
});

const oldKey = { campaignId: 'campaign', militiaId: 'militia', draftId: 'old' };
const successorKey = { ...oldKey, draftId: 'next' };
const querySet = (
  args: unknown,
  udfPath = 'canonicalDraftPersistence:targets',
) =>
  JSON.stringify({
    type: 'ModifyQuerySet',
    baseVersion: 3,
    newVersion: 4,
    modifications: [
      { type: 'Remove', queryId: 2 },
      { type: 'Add', queryId: 3, udfPath, args: [args] },
    ],
  });

test('successor hydration holds entire outbound frames in order while closure, commit and receipt frames pass unchanged', async () => {
  const wire = await transport();
  const hold = wire.holdSuccessorHydration(oldKey);
  const start = Buffer.from(querySet(successorKey));
  const later = JSON.stringify({
    type: 'ModifyQuerySet',
    baseVersion: 4,
    newVersion: 5,
    modifications: [{ type: 'Remove', queryId: 3 }],
  });
  wire.request(start);
  wire.request(later);
  wire.request(mutation(5));
  const inbound = [
    JSON.stringify({
      type: 'Transition',
      startVersion: { querySet: 3 },
      endVersion: { querySet: 3 },
      modifications: [
        {
          type: 'QueryUpdated',
          queryId: 1,
          value: { draftId: 'old', status: 'closed' },
        },
      ],
    }),
    Buffer.from(
      JSON.stringify({ type: 'TransitionChunk', chunk: 'unchanged' }),
    ),
    response(4),
  ];
  for (const frame of inbound) wire.response(frame);
  expect(hold.observed()).toBe(true);
  expect(hold.failure()).toBeNull();
  expect(wire.toServer).not.toHaveBeenCalled();
  expect(wire.toClient.mock.calls).toEqual(inbound.map((frame) => [frame]));
  hold.release();
  hold.release();
  expect(wire.toServer.mock.calls).toEqual([[start], [later], [mutation(5)]]);
  expect(wire.toServer.mock.calls[0]![0]).toBe(start);
});

test('only a new draft targets request in the exact campaign and militia starts the hydration hold', async () => {
  const wire = await transport();
  const hold = wire.holdSuccessorHydration(oldKey);
  const unrelated = [
    querySet(oldKey),
    querySet({ ...successorKey, campaignId: 'other' }),
    querySet({ ...successorKey, militiaId: 'other' }),
    querySet(successorKey, 'canonicalDraftPersistence:observe'),
    querySet(successorKey, 'other:targets'),
    querySet({ ...successorKey, draftId: 7 }),
    querySet(null),
    JSON.stringify({
      type: 'ModifyQuerySet',
      modifications: [null, { type: 'Remove', args: [successorKey] }],
    }),
    JSON.stringify({ type: 'ModifyQuerySet', modifications: { type: 'Add' } }),
  ];
  for (const frame of unrelated) wire.request(frame);
  expect(hold.observed()).toBe(false);
  expect(wire.toServer.mock.calls).toEqual(unrelated.map((frame) => [frame]));
  wire.request(querySet(successorKey));
  expect(hold.observed()).toBe(true);
  expect(wire.toServer).toHaveBeenCalledTimes(unrelated.length);
  hold.release();
});

test.each(['server', 'client'] as const)(
  'a %s disconnect invalidates the hold and never replays its frames into the replacement connection',
  async (side) => {
    const wire = await transport();
    const hold = wire.holdSuccessorHydration(oldKey);
    wire.request(querySet(successorKey));
    expect(hold.observed()).toBe(true);
    if (side === 'server') wire.closeServer();
    else wire.closeClient();
    expect(hold.failure()).toBe(
      'The Convex connection changed during the successor hydration hold.',
    );
    expect(hold.observed()).toBe(false);
    if (side === 'server')
      expect(wire.clientClosed).toHaveBeenCalledWith({
        code: 1001,
        reason: 'restart',
      });
    else
      expect(wire.serverClosed).toHaveBeenCalledWith({
        code: 1000,
        reason: 'leaving',
      });
    const replacement = await wire.reconnect();
    const restarted = JSON.stringify({
      type: 'ModifyQuerySet',
      baseVersion: 0,
      newVersion: 1,
      modifications: [],
    });
    replacement.request(restarted);
    hold.release();
    hold.release();
    expect(wire.toServer).not.toHaveBeenCalled();
    expect(replacement.toServer.mock.calls).toEqual([[restarted]]);
    const fresh = wire.holdSuccessorHydration(oldKey);
    replacement.request(querySet(successorKey));
    expect(fresh.observed()).toBe(true);
    hold.release();
    expect(replacement.toServer.mock.calls).toEqual([[restarted]]);
    fresh.release();
    expect(replacement.toServer.mock.calls).toEqual([
      [restarted],
      [querySet(successorKey)],
    ]);
  },
);

test('a replacement socket invalidates an armed hold even before its successor request arrives', async () => {
  const wire = await transport();
  const hold = wire.holdSuccessorHydration(oldKey);
  const replacement = await wire.reconnect();
  expect(hold.failure()).not.toBeNull();
  expect(hold.observed()).toBe(false);
  replacement.request(querySet(successorKey));
  expect(replacement.toServer.mock.calls).toEqual([[querySet(successorKey)]]);
  hold.release();
});

test('hydration and mutation controls cannot overlap and a completed release cannot clear a later control', async () => {
  const wire = await transport();
  const hold = wire.holdSuccessorHydration(oldKey);
  expect(() => wire.next('delay-request')).toThrow(
    'Finish the active transport control first',
  );
  expect(() => wire.holdSuccessorHydration(oldKey)).toThrow(
    'Finish the active transport control first',
  );
  hold.release();
  const mutationHold = wire.next('delay-request');
  expect(() => wire.holdSuccessorHydration(oldKey)).toThrow(
    'Finish the active transport control first',
  );
  hold.release();
  wire.request(mutation(8));
  expect(wire.toServer).not.toHaveBeenCalled();
  mutationHold.release();
  expect(wire.toServer.mock.calls).toEqual([[mutation(8)]]);
});

test('a reconnect never forwards the tail of a withheld query-set chain on the obsolete socket', async () => {
  const wire = await transport();
  const hold = wire.holdSuccessorHydration(oldKey);
  wire.request(querySet(successorKey));
  const replacement = await wire.reconnect();
  wire.request(
    JSON.stringify({
      type: 'ModifyQuerySet',
      baseVersion: 4,
      newVersion: 5,
      modifications: [],
    }),
  );
  replacement.request('fresh socket frame');
  hold.release();
  expect(hold.failure()).not.toBeNull();
  expect(wire.toServer).not.toHaveBeenCalled();
  expect(replacement.toServer.mock.calls).toEqual([['fresh socket frame']]);
});
