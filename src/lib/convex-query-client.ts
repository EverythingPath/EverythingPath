import { ConvexQueryClient } from '@convex-dev/react-query';
import { QueryClient, type QueryFunction } from '@tanstack/react-query';
import type { ConvexReactClient } from 'convex/react';

function toError(reason: unknown) {
  return reason instanceof Error ? reason : new Error(String(reason));
}

async function withRetryDeadline(
  result: Promise<unknown>,
  signal: AbortSignal,
  error: Error,
) {
  let abort: () => void = () => undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    abort = () => reject(toError(signal.reason));
    timeout = setTimeout(() => reject(error), 10_000);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
  try {
    return await Promise.race([result, deadline]);
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', abort);
  }
}

function restartFailedSubscription(
  adapter: ConvexQueryClient,
  hash: string,
  signal: AbortSignal,
  error: Error,
) {
  const subscription = adapter.subscriptions[hash];
  if (!subscription) return Promise.reject(error);
  subscription.unsubscribe();
  const result = new Promise<unknown>((resolve, reject) => {
    subscription.unsubscribe = subscription.watch.onUpdate(() => {
      if (adapter.subscriptions[hash] !== subscription) return;
      adapter.onUpdateQueryKeyHash(hash);
      try {
        const value: unknown = subscription.watch.localQueryResult();
        if (value !== undefined) resolve(value);
      } catch (reason) {
        reject(toError(reason));
      }
    });
  });
  // Another subscriber can retain the failed token, preventing a new server
  // response. Bound the retry while preserving the lifetime live subscription.
  return withRetryDeadline(result, signal, error);
}

function retryQueryFunction(
  adapter: ConvexQueryClient,
): QueryFunction<unknown> {
  const queryFn: QueryFunction<unknown> = adapter.queryFn();
  const hashQueryKey = adapter.hashFn();
  return (context) => {
    const hash = hashQueryKey(context.queryKey);
    const subscription = adapter.subscriptions[hash];
    const failureCount = adapter.queryClient.getQueryState(
      context.queryKey,
    )?.errorUpdateCount;
    if (!subscription || !failureCount) return queryFn(context);
    try {
      subscription.watch.localQueryResult();
    } catch (error) {
      return restartFailedSubscription(
        adapter,
        hash,
        context.signal,
        toError(error),
      );
    }
    return queryFn(context);
  };
}

export function createQueryClient(convex: ConvexReactClient) {
  const adapter = new ConvexQueryClient(convex);
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: adapter.hashFn(),
        queryFn: retryQueryFunction(adapter),
        // Keep live results through short trips between campaign screens.
        gcTime: 60_000,
        // Convex retries connection failures. Query errors are surfaced to
        // the caller, which can offer an explicit retry when appropriate.
        retry: false,
      },
    },
  });
  adapter.connect(client);
  return client;
}
