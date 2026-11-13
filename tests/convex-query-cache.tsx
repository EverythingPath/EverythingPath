import {
  QueryClientProvider,
  QueryErrorResetBoundary,
  notifyManager,
} from '@tanstack/react-query';
import { ConvexReactClient } from 'convex/react';
import { getFunctionName, type FunctionReference } from 'convex/server';
import { convexToJson, type Value } from 'convex/values';
import type { ReactNode } from 'react';
import { createQueryClient } from '~/lib/convex-query-client';

type Request = { name: string; args: Record<string, unknown> };
type Subscription = Request & { update: () => void };

/** Real query cache and Convex adapter, with an in-memory reactive backend. */
export function queryCacheFixture(
  resolve: (name: string, args: Record<string, unknown>) => unknown,
) {
  const live = new Set<Subscription>();
  const opened: Subscription[] = [];
  const reads: Request[] = [];
  const subscriptions = new Map<
    string,
    {
      subscription: Subscription;
      listeners: Set<() => void>;
    }
  >();
  const convex = {
    watchQuery(
      query: FunctionReference<'query'>,
      args: Record<string, Value | undefined>,
    ) {
      const name = getFunctionName(query);
      const key = `${name}:${JSON.stringify(convexToJson(args))}`;
      return {
        localQueryResult: () => resolve(name, args),
        onUpdate(update: () => void) {
          let shared = subscriptions.get(key);
          if (!shared) {
            const listeners = new Set<() => void>();
            const subscription = {
              name,
              args,
              update: () => {
                // Convex notifies only when a result or error is available.
                try {
                  if (resolve(name, args) === undefined) return;
                } catch {
                  // Each listener reads the error through localQueryResult.
                }
                for (const listener of [...listeners]) listener();
              },
            };
            shared = { subscription, listeners };
            subscriptions.set(key, shared);
            live.add(subscription);
            opened.push(subscription);
          }
          const { subscription, listeners } = shared;
          listeners.add(update);
          return () => {
            listeners.delete(update);
            if (listeners.size === 0) {
              live.delete(subscription);
              subscriptions.delete(key);
            }
          };
        },
      };
    },
    query(
      query: FunctionReference<'query'>,
      args: Record<string, Value | undefined>,
    ) {
      const name = getFunctionName(query);
      reads.push({ name, args });
      return ConvexReactClient.prototype.query.call(convex, query, args);
    },
  } as unknown as ConvexReactClient;
  const client = createQueryClient(convex);
  return {
    client,
    convex,
    live,
    opened,
    reads,
    push() {
      notifyManager.batch(() => {
        for (const subscription of [...live]) subscription.update();
      });
    },
    observed(): Request[] {
      return client
        .getQueryCache()
        .getAll()
        .filter(
          (query) =>
            query.getObserversCount() > 0 && query.queryKey[2] !== 'skip',
        )
        .map((query) => ({
          name: query.queryKey[1] as string,
          args: query.queryKey[2] as Record<string, unknown>,
        }));
    },
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <QueryErrorResetBoundary>{children}</QueryErrorResetBoundary>
      </QueryClientProvider>
    ),
  };
}
