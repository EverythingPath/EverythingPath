import { ConvexReactClient } from 'convex/react';
import { expect, test, vi } from 'vitest';
import { MigrationConvexClient } from './migration-convex-client';

test('constructing a client before authentication does not connect', async () => {
  vi.stubGlobal(
    'WebSocket',
    class {
      constructor() {
        throw new Error('Connected before authentication was configured');
      }
    },
  );
  let client: MigrationConvexClient | undefined;
  try {
    client = new MigrationConvexClient('https://unused.convex.cloud');
    expect(client.maintenance.getSnapshot().kind).toBe('loading');
  } finally {
    await client?.close();
    vi.unstubAllGlobals();
  }
});

test('auth setup enables editing and preserves authentication and refresh callbacks', async () => {
  let configured = false;
  const setAuth = vi
    .spyOn(ConvexReactClient.prototype, 'setAuth')
    .mockImplementation((_fetchToken, onChange, onRefreshChange) => {
      configured = true;
      onChange?.(true);
      onRefreshChange?.(true);
      onRefreshChange?.(false);
    });
  const watch = vi
    .spyOn(ConvexReactClient.prototype, 'watchQuery')
    .mockReturnValue({
      localQueryResult: () => {
        if (!configured) throw new Error('Authentication is not configured');
        return { status: 'ready', epoch: 8 };
      },
      journal: () => undefined,
      onUpdate: () => () => undefined,
    });
  const client = new MigrationConvexClient('https://unused.convex.cloud');
  const authentication = vi.fn();
  const refresh = vi.fn();
  try {
    client.setAuth(async () => 'token', authentication, refresh);
    expect(client.maintenance.getSnapshot().kind).toBe('ready');
    expect(authentication).toHaveBeenCalledWith(true);
    expect(refresh.mock.calls).toEqual([[true], [false]]);
  } finally {
    await client.close();
    setAuth.mockRestore();
    watch.mockRestore();
  }
});
