import { act, renderHook } from '@testing-library/react';
import { ConvexReactClient } from 'convex/react';
import type * as ConvexReact from 'convex/react';
import { makeFunctionReference } from 'convex/server';
import { expect, test, vi } from 'vitest';
import { MigrationConvexClient } from '~/lib/migration-convex-client';
import { useInitialMigrationMaintenance } from './use-initial-migration-maintenance';

let client: ConvexReactClient;
vi.mock('convex/react', async (original) => ({
  ...(await original<typeof ConvexReact>()),
  useConvex: () => client,
}));

test('a host without editing-status support explains why saving is unavailable', async () => {
  client = new ConvexReactClient('https://unused.convex.cloud');
  const rendered = renderHook(useInitialMigrationMaintenance);
  expect(rendered.result.current).toEqual({
    kind: 'unavailable',
    readOnly: true,
    message:
      'Editing availability could not be checked. Saved information remains available. Reload to try again.',
  });
  rendered.unmount();
  await client.close();
});

test('subscribed maintenance survives hook remount and reauthentication with the original epoch', async () => {
  let status: { status: 'ready' | 'maintenance'; epoch: number } = {
    status: 'ready',
    epoch: 8,
  };
  let update: (() => void) | undefined;
  const stop = vi.fn();
  const watch = vi
    .spyOn(ConvexReactClient.prototype, 'watchQuery')
    .mockReturnValue({
      localQueryResult: () => status,
      journal: () => undefined,
      onUpdate: (callback) => {
        update = callback;
        return stop;
      },
    });
  const send = vi
    .spyOn(ConvexReactClient.prototype, 'mutation')
    .mockResolvedValue('saved');
  const setAuth = vi
    .spyOn(ConvexReactClient.prototype, 'setAuth')
    .mockImplementation(() => undefined);
  const clearAuth = vi
    .spyOn(ConvexReactClient.prototype, 'clearAuth')
    .mockImplementation(() => undefined);
  client = new MigrationConvexClient('https://unused.convex.cloud');
  const mutation = makeFunctionReference<'mutation', { name: string }, string>(
    'example:save',
  );
  try {
    const first = renderHook(useInitialMigrationMaintenance);
    expect(first.result.current.kind).toBe('loading');
    act(() => {
      client.setAuth(async () => 'token');
    });
    expect(first.result.current.readOnly).toBe(false);
    await expect(client.mutation(mutation, { name: 'Before' })).resolves.toBe(
      'saved',
    );
    expect(send).toHaveBeenCalledWith(
      mutation,
      { name: 'Before', writeEpoch: 8 },
      undefined,
    );
    act(() => {
      status = { status: 'maintenance', epoch: 9 };
      update?.();
    });
    expect(first.result.current.kind).toBe('maintenance');
    first.unmount();
    client.clearAuth();
    status = { status: 'ready', epoch: 10 };
    update?.();
    client.setAuth(async () => 'new-token');
    const next = renderHook(useInitialMigrationMaintenance);
    expect(next.result.current.kind).toBe('reload_required');
    await expect(client.mutation(mutation, { name: 'Stale' })).rejects.toThrow(
      'Reload',
    );
    expect(send).toHaveBeenCalledTimes(1);
    next.unmount();
  } finally {
    await client.close();
    expect(stop).toHaveBeenCalledTimes(1);
    send.mockRestore();
    watch.mockRestore();
    setAuth.mockRestore();
    clearAuth.mockRestore();
  }
});
