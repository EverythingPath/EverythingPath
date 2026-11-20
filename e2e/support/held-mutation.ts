import type { Page } from '@playwright/test';
import { z } from 'zod';

const mutationHeader = z.object({
  type: z.literal('Mutation'),
  udfPath: z.string(),
});
const querySetChange = z.object({
  type: z.literal('ModifyQuerySet'),
  modifications: z.array(
    z.union([
      z.object({
        type: z.literal('Add'),
        queryId: z.number(),
        udfPath: z.string(),
      }),
      z.object({ type: z.literal('Remove'), queryId: z.number() }),
    ]),
  ),
});
const transition = z.object({
  type: z.literal('Transition'),
  modifications: z.array(
    z.object({ type: z.string(), queryId: z.number() }).passthrough(),
  ),
});
const HISTORY_READ = 'canonicalHistory:read';

// Keep real authentication, queries and server responses flowing while a user
// edit remains in flight. No provider message is written to an artifact.
// While `failHistory(true)` is set, every history read the page subscribes
// to fails at the client (its server answer is replaced by a query failure),
// so the reference panel's local failure and retry can be exercised against
// the real server; other queries and every mutation keep flowing.
export async function controlNextDraftEdit(page: Page, convexUrl: string) {
  let armed = false;
  let release: (() => void) | undefined;
  let captured: (() => void) | undefined;
  let failingHistory = false;
  const failedQueries = new Set<number>();
  await page.routeWebSocket(
    (url) => url.hostname === new URL(convexUrl).hostname,
    (socket) => {
      const server = socket.connectToServer();
      server.onMessage((message) => {
        let value: unknown;
        try {
          value = JSON.parse(message.toString()) as unknown;
        } catch {
          socket.send(message);
          return;
        }
        if (failedQueries.size === 0 || !transition.safeParse(value).success) {
          socket.send(message);
          return;
        }
        const raw = value as { modifications: Record<string, unknown>[] };
        raw.modifications = raw.modifications.map((modification) =>
          modification.type === 'QueryUpdated' &&
          failedQueries.has(modification.queryId as number)
            ? {
                type: 'QueryFailed',
                queryId: modification.queryId,
                errorMessage: 'Recent weeks are unavailable (test)',
                logLines: [],
                journal: null,
              }
            : modification,
        );
        socket.send(JSON.stringify(raw));
      });
      socket.onMessage((message) => {
        let value: unknown;
        try {
          value = JSON.parse(message.toString()) as unknown;
        } catch {
          server.send(message);
          return;
        }
        const change = querySetChange.safeParse(value);
        if (change.success)
          for (const modification of change.data.modifications) {
            if (modification.type === 'Remove')
              failedQueries.delete(modification.queryId);
            else if (failingHistory && modification.udfPath === HISTORY_READ)
              failedQueries.add(modification.queryId);
          }
        const header = mutationHeader.safeParse(value);
        if (
          armed &&
          header.success &&
          header.data.udfPath === 'canonicalDraftPersistence:edit'
        ) {
          armed = false;
          release = () => server.send(message);
          captured?.();
        } else server.send(message);
      });
    },
  );
  return {
    failHistory(failing: boolean) {
      failingHistory = failing;
      if (!failing) failedQueries.clear();
    },
    hold() {
      if (armed || release) throw new Error('An edit is already held');
      armed = true;
      return new Promise<void>((resolve) => {
        captured = resolve;
      });
    },
    release() {
      release?.();
      release = undefined;
      captured = undefined;
      armed = false;
    },
  };
}
