import { act, renderHook } from '@testing-library/react';
import { ConvexReactClient } from 'convex/react';
import type * as ConvexReact from 'convex/react';
import { makeFunctionReference } from 'convex/server';
import { expect, test, vi } from 'vitest';
import { MigrationConvexClient } from '../lib/migration-convex-client';
import { SHEET_CLIENT_CONTRACT } from '../lib/client-compatibility';
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

type ClientStatus = Parameters<
  MigrationConvexClient['maintenance']['observe']
>[0];
const sheetReady = (epoch: number): ClientStatus => ({
  status: 'ready',
  epoch,
  authority: 'sheet',
  rulesetVersion: 10,
});

/** A loaded tab whose status subscription the test drives. */
function loadTab(initial: ClientStatus) {
  let status = initial;
  let update: (() => void) | undefined;
  const watch = vi
    .spyOn(ConvexReactClient.prototype, 'watchQuery')
    .mockReturnValue({
      localQueryResult: () => status,
      journal: () => undefined,
      onUpdate: (callback) => {
        update = callback;
        return () => undefined;
      },
    });
  const tab = new MigrationConvexClient('https://unused.convex.cloud');
  tab.startMaintenance();
  const args = watch.mock.calls[0]?.[1];
  watch.mockRestore();
  return {
    tab,
    args,
    next(value: ClientStatus) {
      status = value;
      act(() => update?.());
    },
  };
}

function renderTab(tab: MigrationConvexClient) {
  client = tab;
  return renderHook(() => {
    const { rulesetVersion, ...maintenance } = useInitialMigrationMaintenance();
    return { maintenance, rulesetVersion };
  });
}

const save = makeFunctionReference<'mutation', { name: string }, string>(
  'example:save',
);

test('under legacy authority a tab is ready, writes at its epoch and previews under Ruleset Version 9', async () => {
  const send = vi
    .spyOn(ConvexReactClient.prototype, 'mutation')
    .mockResolvedValue('saved');
  const { tab } = loadTab({
    status: 'ready',
    epoch: 3,
    authority: 'legacy',
    rulesetVersion: 9,
  });
  try {
    const rendered = renderTab(tab);
    expect(rendered.result.current).toMatchObject({
      maintenance: { kind: 'ready', readOnly: false },
      rulesetVersion: 9,
    });
    await expect(tab.mutation(save, { name: 'Legacy' })).resolves.toBe('saved');
    expect(send).toHaveBeenCalledWith(
      save,
      { name: 'Legacy', writeEpoch: 3 },
      undefined,
    );
    rendered.unmount();
  } finally {
    send.mockRestore();
    await tab.close();
  }
});

test('under sheet authority after reopening a compatible tab writes and previews under Ruleset Version 10, and a tab from before reopening cannot write', async () => {
  const send = vi
    .spyOn(ConvexReactClient.prototype, 'mutation')
    .mockResolvedValue('saved');
  // Loaded while the gate was closed for activation and publication.
  const old = loadTab({ status: 'maintenance', epoch: 1 });
  const fresh = loadTab(sheetReady(2));
  try {
    expect(fresh.args).toEqual({ clientContract: SHEET_CLIENT_CONTRACT });
    const before = renderTab(old.tab);
    old.next(sheetReady(2));
    expect(before.result.current.maintenance).toMatchObject({
      kind: 'reload_required',
      readOnly: true,
    });
    expect(before.result.current.rulesetVersion).toBeUndefined();
    await expect(old.tab.mutation(save, { name: 'Old tab' })).rejects.toThrow(
      'Reload',
    );
    before.unmount();

    const after = renderTab(fresh.tab);
    expect(after.result.current).toMatchObject({
      maintenance: { kind: 'ready', readOnly: false },
      rulesetVersion: 10,
    });
    await expect(fresh.tab.mutation(save, { name: 'Fresh tab' })).resolves.toBe(
      'saved',
    );
    expect(send).toHaveBeenCalledExactlyOnceWith(
      save,
      { name: 'Fresh tab', writeEpoch: 2 },
      undefined,
    );
    // Closing for repair keeps the version while the tab is read-only.
    fresh.next({ status: 'maintenance', epoch: 3 });
    expect(after.result.current).toMatchObject({
      maintenance: { kind: 'maintenance', readOnly: true },
      rulesetVersion: 10,
    });
    after.unmount();
  } finally {
    send.mockRestore();
    await old.tab.close();
    await fresh.tab.close();
  }
});

test('a tab the server finds incompatible under sheet authority is told to reload and cannot write', async () => {
  const send = vi.spyOn(ConvexReactClient.prototype, 'mutation');
  const { tab } = loadTab({
    status: 'reload_required',
    epoch: 2,
    reason: 'client_contract',
  });
  try {
    const rendered = renderTab(tab);
    expect(rendered.result.current.maintenance).toEqual({
      kind: 'reload_required',
      readOnly: true,
      message:
        'This page is out of date. Reload to keep editing; unsaved changes will be discarded.',
    });
    await expect(tab.mutation(save, { name: 'Stale' })).rejects.toThrow(
      'Reload',
    );
    expect(send).not.toHaveBeenCalled();
    rendered.unmount();
  } finally {
    send.mockRestore();
    await tab.close();
  }
});
