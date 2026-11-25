import { act, renderHook, waitFor } from '@testing-library/react';
import { convexQuery } from '@convex-dev/react-query';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { makeFunctionReference } from 'convex/server';
import { StrictMode, useLayoutEffect, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { queryCacheFixture } from '../../tests/convex-query-cache';
import { convexWebSocketFixture } from '../../tests/convex-websocket';
import { createQueryClient } from './convex-query-client';

const query = makeFunctionReference<'query', { id: string }, string>(
  'example:read',
);
const values = new Map<string, string | null | Error>();
let cache: ReturnType<typeof queryCacheFixture>;
beforeEach(() => {
  values.clear();
  cache = queryCacheFixture((_name, args) => {
    const value = values.get(String(args.id));
    if (value instanceof Error) throw value;
    return value;
  });
});
afterEach(() => {
  cache.client.clear();
  vi.useRealTimers();
});

test('multiple readers share a live subscription and reopening sees updates received while unmounted', async () => {
  values.set('first', 'Original');
  const useRead = () => useQuery(convexQuery(query, { id: 'first' }));
  const first = renderHook(useRead, { wrapper: cache.wrapper });
  const second = renderHook(useRead, { wrapper: cache.wrapper });
  await waitFor(() => expect(second.result.current.data).toBe('Original'));
  expect(cache.opened).toHaveLength(1);
  first.unmount();
  second.unmount();
  values.set('first', 'Updated while away');
  act(() => cache.push());
  const returning = renderHook(useRead, { wrapper: cache.wrapper });
  expect(returning.result.current.data).toBe('Updated while away');
  expect(returning.result.current.isPending).toBe(false);
  expect(cache.opened).toHaveLength(1);
  expect(cache.reads).toHaveLength(1);
});

test('idle subscriptions expire after one minute and an expired selection starts loading again', async () => {
  values.set('first', 'Original');
  const useRead = () => useQuery(convexQuery(query, { id: 'first' }));
  const view = renderHook(useRead, { wrapper: cache.wrapper });
  await waitFor(() => expect(view.result.current.data).toBe('Original'));
  vi.useFakeTimers();
  view.unmount();
  act(() => {
    vi.advanceTimersByTime(59_999);
  });
  expect(cache.live.size).toBe(1);
  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(cache.live.size).toBe(0);
  vi.useRealTimers();
  values.delete('first');
  const returning = renderHook(useRead, { wrapper: cache.wrapper });
  expect(returning.result.current.isPending).toBe(true);
  expect(returning.result.current.data).toBeUndefined();
  values.set('first', 'Current');
  act(() => cache.push());
  await waitFor(() => expect(returning.result.current.data).toBe('Current'));
  expect(cache.opened).toHaveLength(2);
});

test('a late callback during selection cleanup only updates its own cached query', async () => {
  values.set('first', 'Original');
  const view = renderHook(
    ({ id }) => {
      const result = useQuery(convexQuery(query, { id }));
      useLayoutEffect(() => {
        if (id === 'second') {
          values.set('first', 'Late old selection');
          cache.opened[0]!.update();
        }
      }, [id]);
      return result;
    },
    { initialProps: { id: 'first' }, wrapper: cache.wrapper },
  );
  await waitFor(() => expect(view.result.current.data).toBe('Original'));
  view.rerender({ id: 'second' });
  expect(view.result.current.isPending).toBe(true);
  expect(view.result.current.data).toBeUndefined();
  values.set('second', 'New selection');
  act(() => cache.push());
  await waitFor(() => expect(view.result.current.data).toBe('New selection'));
  view.rerender({ id: 'first' });
  expect(view.result.current.data).toBe('Late old selection');
});

test.each(['Recovered', null])(
  'explicit retry recovers a cached Convex failure with %s for every reader',
  async (recovered) => {
    const server = convexWebSocketFixture();
    const client = createQueryClient(server.convex);
    const args = { id: 'first' };
    server.values.set('first', new Error('unavailable'));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const useRead = () => useQuery(convexQuery(query, args));
    const first = renderHook(useRead, { wrapper });
    const second = renderHook(useRead, { wrapper });
    try {
      await waitFor(() => expect(first.result.current.isError).toBe(true));
      await act(async () => {
        await first.result.current.refetch();
      });
      expect(first.result.current.isError).toBe(true);
      server.values.set('first', recovered);
      // Changing the server alone leaves the real client's failed result cached.
      expect(() => server.convex.query(query, args)).toThrow('unavailable');
      await act(async () => {
        await first.result.current.refetch();
      });
      await waitFor(() => expect(first.result.current.data).toBe(recovered));
      expect(second.result.current.data).toBe(recovered);
      expect(first.result.current.isSuccess).toBe(true);
      expect(second.result.current.isSuccess).toBe(true);
    } finally {
      first.unmount();
      second.unmount();
      client.clear();
      await server.convex.close();
    }
  },
);

test('removing a query cancels its pending retry and a new reader can recover', async () => {
  const server = convexWebSocketFixture();
  const client = createQueryClient(server.convex);
  server.values.set('first', new Error('unavailable'));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const useRead = () => useQuery(convexQuery(query, { id: 'first' }));
  const first = renderHook(useRead, { wrapper });
  try {
    await waitFor(() => expect(first.result.current.isError).toBe(true));
    server.values.set('first', 'Recovered');
    server.pause();
    let retry: ReturnType<typeof first.result.current.refetch>;
    act(() => {
      retry = first.result.current.refetch();
    });
    await waitFor(() => expect(first.result.current.isFetching).toBe(true));
    first.unmount();
    client.clear();
    await retry!;
    act(() => server.resume());
    const second = renderHook(useRead, { wrapper });
    try {
      await waitFor(() => expect(second.result.current.data).toBe('Recovered'));
    } finally {
      second.unmount();
    }
  } finally {
    first.unmount();
    client.clear();
    await server.convex.close();
  }
});

test('retry settles while another Convex subscriber retains a failure and live updates still recover', async () => {
  const server = convexWebSocketFixture();
  const client = createQueryClient(server.convex);
  const args = { id: 'first' };
  server.values.set('first', new Error('unavailable'));
  const watch = server.convex.watchQuery(query, args);
  const stopWatching = watch.onUpdate(() => undefined);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const reader = renderHook(() => useQuery(convexQuery(query, args)), {
    wrapper,
  });
  try {
    await waitFor(() => expect(reader.result.current.isError).toBe(true));
    server.values.set('first', 'Recovered');
    vi.useFakeTimers();
    const settled = vi.fn();
    act(() => {
      void reader.result.current.refetch().then(settled);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(settled).toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    vi.useRealTimers();
    expect(reader.result.current.isFetching).toBe(false);
    expect(reader.result.current.error?.message).toContain('unavailable');
    act(() => server.push());
    await waitFor(() => expect(reader.result.current.data).toBe('Recovered'));
    expect(watch.localQueryResult()).toBe('Recovered');
  } finally {
    reader.unmount();
    client.clear();
    stopWatching();
    await server.convex.close();
  }
});

test.each(['Recovered', null])(
  'an initial query error recovers from a live update containing %s',
  async (recovered) => {
    values.set('first', new Error('unavailable'));
    const { result } = renderHook(
      () => useQuery(convexQuery(query, { id: 'first' })),
      { wrapper: cache.wrapper },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    values.set('first', recovered);
    act(() => cache.push());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(recovered);
    expect(cache.reads).toHaveLength(1);
    expect(cache.opened).toHaveLength(1);
  },
);

test('Strict Mode shares one subscription through its effect restart', async () => {
  values.set('first', 'Original');
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <StrictMode>
        <cache.wrapper>{children}</cache.wrapper>
      </StrictMode>
    );
  }
  const view = renderHook(() => useQuery(convexQuery(query, { id: 'first' })), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(view.result.current.data).toBe('Original'));
  expect(cache.opened).toHaveLength(1);
  view.unmount();
  cache.client.clear();
  expect(cache.live.size).toBe(0);
});
