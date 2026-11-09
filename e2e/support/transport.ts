import type { Page } from '@playwright/test';
import { convexWebSocketOrigin } from '../../src/lib/local-convex-url';

type Frame = string | Buffer;
type Fault = {
  type: 'Mutation' | 'MutationResponse';
  drop: boolean;
  observed: boolean;
  requestId?: number;
  queued: (() => void)[];
};
type ProtocolMessage = {
  type?: unknown;
  requestId?: unknown;
  modifications?: unknown;
};
type DraftKey = { campaignId: string; militiaId: string; draftId: string };
type Connection = { valid: boolean };
type HydrationHold = {
  key: DraftKey;
  connection: Connection;
  observed: boolean;
  failure: string | null;
  queued: (() => void)[];
};

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function requestsSuccessorTargets(message: ProtocolMessage, key: DraftKey) {
  if (
    message.type !== 'ModifyQuerySet' ||
    !Array.isArray(message.modifications)
  )
    return false;
  return message.modifications.some((value: unknown) => {
    const change = object(value);
    if (
      change?.type !== 'Add' ||
      change.udfPath !== 'canonicalDraftPersistence:targets' ||
      !Array.isArray(change.args)
    )
      return false;
    const args = object(change.args[0]);
    return (
      args?.campaignId === key.campaignId &&
      args.militiaId === key.militiaId &&
      typeof args.draftId === 'string' &&
      args.draftId !== key.draftId
    );
  });
}

function parseFrame(frame: Frame): ProtocolMessage {
  try {
    const parsed: unknown = JSON.parse(frame.toString());
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    // Non-protocol frames pass through unchanged.
  }
  return {};
}

function observeRequest(
  active: Fault,
  direction: Fault['type'],
  message: ProtocolMessage,
) {
  if (
    active.type === 'MutationResponse' &&
    direction === 'Mutation' &&
    message.type === 'Mutation' &&
    active.requestId === undefined &&
    typeof message.requestId === 'number'
  )
    active.requestId = message.requestId;
}

function matchesFault(active: Fault, message: ProtocolMessage) {
  return (
    message.type === active.type &&
    (active.type === 'Mutation' ||
      (active.requestId !== undefined &&
        message.requestId === active.requestId))
  );
}

function interceptFrame(
  active: Fault,
  message: ProtocolMessage,
  send: () => void,
) {
  if (active.observed && !active.drop) {
    active.queued.push(send);
    return true;
  }
  if (!active.observed && matchesFault(active, message)) {
    active.observed = true;
    if (!active.drop) active.queued.push(send);
    return true;
  }
  return false;
}

/** Timing only: every delivered frame is unchanged and every write runs in Convex. */
export async function controlTransport(page: Page, convexUrl: string) {
  let fault: Fault | undefined;
  let hydration: HydrationHold | undefined;
  const connections = new Set<Connection>();
  function failHydration() {
    if (!hydration) return;
    hydration.failure =
      'The Convex connection changed during the successor hydration hold.';
    hydration.connection.valid = false;
    hydration.observed = false;
    hydration.queued = [];
  }
  function requireIdle() {
    if (fault || hydration)
      throw new Error('Finish the active transport control first');
  }
  const origin = convexWebSocketOrigin(convexUrl);
  await page.routeWebSocket(
    (url) => url.origin === origin,
    (socket) => {
      const connection = { valid: true };
      if (hydration) failHydration();
      connections.add(connection);
      const server = socket.connectToServer();
      function closed() {
        if (!connections.delete(connection)) return false;
        if (hydration?.connection === connection) failHydration();
        return true;
      }
      socket.onClose((code, reason) => {
        if (closed()) return server.close({ code, reason });
      });
      server.onClose((code, reason) => {
        if (closed()) return socket.close({ code, reason });
      });
      function queueForHydration(frame: Frame, send: (frame: Frame) => void) {
        const hold = hydration;
        if (hold?.connection !== connection || hold.failure) return false;
        if (
          !hold.observed &&
          !requestsSuccessorTargets(parseFrame(frame), hold.key)
        )
          return false;
        hold.observed = true;
        hold.queued.push(() => send(frame));
        return true;
      }
      const forward = (
        frame: Frame,
        direction: 'Mutation' | 'MutationResponse',
        send: (frame: Frame) => void,
      ) => {
        // After a failed hold, its missing query-set versions can never be
        // followed by later frames on the obsolete socket.
        if (direction === 'Mutation' && !connection.valid) return;
        if (direction === 'Mutation' && queueForHydration(frame, send)) return;
        const active = fault;
        if (active) {
          const message = parseFrame(frame);
          observeRequest(active, direction, message);
          if (
            active.type === direction &&
            interceptFrame(active, message, () => send(frame))
          )
            return;
        }
        send(frame);
      };
      socket.onMessage((frame) =>
        forward(frame, 'Mutation', (message) => server.send(message)),
      );
      server.onMessage((frame) =>
        forward(frame, 'MutationResponse', (message) => socket.send(message)),
      );
    },
  );
  return {
    // Pause required successor hydration after its source arrives. Incoming
    // commit Transitions keep flowing so mutation promises can still settle.
    holdSuccessorHydration(key: DraftKey) {
      requireIdle();
      const live = [...connections].filter((connection) => connection.valid);
      const connection = live[0];
      if (live.length !== 1 || !connection)
        throw new Error(
          'Expected one connected Convex socket before holding successor hydration.',
        );
      const hold: HydrationHold = {
        key: { ...key },
        connection,
        observed: false,
        failure: null,
        queued: [],
      };
      hydration = hold;
      return {
        observed: () => hold.observed,
        failure: () => hold.failure,
        release: () => {
          if (hydration !== hold) return;
          hydration = undefined;
          for (const send of hold.queued.splice(0)) send();
        },
      };
    },
    next(mode: 'delay-request' | 'delay-response' | 'drop-acknowledgement') {
      requireIdle();
      const active: Fault = {
        type: mode === 'delay-request' ? 'Mutation' : 'MutationResponse',
        drop: mode === 'drop-acknowledgement',
        observed: false,
        queued: [],
      };
      fault = active;
      return {
        observed: () => active.observed,
        release: () => {
          if (fault !== active) return;
          fault = undefined;
          for (const send of active.queued.splice(0)) send();
        },
      };
    },
  };
}
