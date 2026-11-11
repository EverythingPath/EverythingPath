import { ConvexReactClient } from 'convex/react';

type Modification =
  | { type: 'Add'; queryId: number; args: [{ id: string }] }
  | { type: 'Remove'; queryId: number };

/** A local transport; query caching and subscription lifetimes belong to Convex. */
export function convexWebSocketFixture() {
  const values = new Map<string, string | null | Error>();
  let version = { querySet: 0, identity: 0, ts: 'AAAAAAAAAAA=' };
  let paused = false;
  const pending: (() => void)[] = [];
  const activeQueries = new Map<
    number,
    Extract<Modification, { type: 'Add' }>
  >();
  let pushUpdates: () => void = () => undefined;

  class Socket {
    onopen: (() => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;

    constructor() {
      pushUpdates = () => this.transition([...activeQueries.values()]);
      queueMicrotask(() => this.onopen?.());
    }

    send(data: string) {
      const message = JSON.parse(data) as {
        type: string;
        newVersion: number;
        modifications: Modification[];
      };
      if (message.type !== 'ModifyQuerySet') return;
      for (const modification of message.modifications) {
        if (modification.type === 'Remove')
          activeQueries.delete(modification.queryId);
        else activeQueries.set(modification.queryId, modification);
      }
      this.transition(message.modifications, message.newVersion);
    }

    transition(modifications: Modification[], querySet = version.querySet) {
      const startVersion = version;
      version = { ...version, querySet };
      const transition = {
        type: 'Transition',
        startVersion,
        endVersion: version,
        modifications: modifications.map((modification) => {
          const { queryId } = modification;
          if (modification.type === 'Remove')
            return { type: 'QueryRemoved', queryId };
          const value = values.get(modification.args[0].id);
          return value instanceof Error
            ? {
                type: 'QueryFailed',
                queryId,
                errorMessage: value.message,
                errorData: value.message,
                logLines: [],
                journal: null,
              }
            : {
                type: 'QueryUpdated',
                queryId,
                value,
                logLines: [],
                journal: null,
              };
        }),
      };
      const deliver = () =>
        this.onmessage?.({ data: JSON.stringify(transition) });
      if (paused) pending.push(deliver);
      else queueMicrotask(deliver);
    }

    close() {
      queueMicrotask(() => this.onclose?.());
    }
  }

  const convex = new ConvexReactClient('https://unused.convex.cloud', {
    webSocketConstructor: Socket as unknown as typeof WebSocket,
    unsavedChangesWarning: false,
    logger: false,
  });
  return {
    convex,
    values,
    push() {
      pushUpdates();
    },
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
      for (const deliver of pending.splice(0)) deliver();
    },
  };
}
