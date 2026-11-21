// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { connectAs, type ConnectablePage } from './roll-compatibility';

// The real helper is exercised against a page whose Clerk session becomes
// ready only when the test releases it, and a client factory that records
// when the client is created and what its auth callback is.
function readyLaterPage(token: string) {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  let sessionReady = false;
  const page = {
    waitForFunction: vi.fn(async () => {
      await ready;
      sessionReady = true;
      return {} as never;
    }),
    evaluate: vi.fn(async (_fn: unknown, skipCache?: unknown) =>
      sessionReady
        ? `${token}:${skipCache === true ? 'fresh' : 'cached'}`
        : null,
    ),
  };
  return {
    page: page as unknown as ConnectablePage,
    calls: page,
    release: () => {
      release();
    },
  };
}

describe('authenticated compatibility client ordering', () => {
  it('creates and configures the client only after the page session is ready, then fetches a real token', async () => {
    const { page, calls, release } = readyLaterPage('jwt');
    const clients: { setAuth: ReturnType<typeof vi.fn> }[] = [];
    const connecting = connectAs(page, 'https://convex.test', () => {
      const client = { setAuth: vi.fn() };
      clients.push(client);
      return client;
    });
    await Promise.resolve();
    expect(calls.waitForFunction).toHaveBeenCalledTimes(1);
    expect(clients).toHaveLength(0);
    expect(calls.evaluate).not.toHaveBeenCalled();
    release();
    const client = await connecting;
    expect(clients).toEqual([client]);
    expect(client.setAuth).toHaveBeenCalledTimes(1);
    const fetchToken = client.setAuth.mock.calls[0]![0] as (args: {
      forceRefreshToken: boolean;
    }) => Promise<string | null>;
    await expect(fetchToken({ forceRefreshToken: false })).resolves.toBe(
      'jwt:cached',
    );
    await expect(fetchToken({ forceRefreshToken: true })).resolves.toBe(
      'jwt:fresh',
    );
  });
});
