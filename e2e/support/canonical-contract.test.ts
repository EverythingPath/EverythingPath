// @vitest-environment node
import { expect, it, vi } from 'vitest';
import {
  reserveTokenPages,
  type JourneyPage,
  type TokenPage,
} from './canonical-contract';

type Role = 'gm' | 'player' | 'outsider';

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

// Lets every pending callback run, however many awaits deep.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

// Each role's context opens a token page whose session the test signs in
// when it chooses, or never. A closed page ends its pending wait the way
// Playwright does. Events record the order across all roles.
function roles({ manual = false } = {}) {
  const events: string[] = [];
  const player = (role: Role) => {
    const signedIn = deferred<{ never: true }>();
    // A page closed before its wait began leaves no rejection unhandled.
    signedIn.promise.catch(() => undefined);
    const opened = deferred();
    if (!manual) {
      signedIn.resolve({ never: true });
      opened.resolve();
    }
    const tokenPage = {
      goto: vi.fn(async (path: string) => {
        events.push(`${role} token page opens ${path}`);
        return null;
      }),
      waitForFunction: vi.fn(async () => {
        await signedIn.promise;
        events.push(`${role} token page has a session`);
        return {} as never;
      }),
      evaluate: vi.fn(
        async (_fn: unknown, skipCache?: unknown) =>
          `${role}:${skipCache === true ? 'fresh' : 'cached'}`,
      ),
      close: vi.fn(async () => {
        events.push(`${role} token page closed`);
        signedIn.reject(
          new Error('Target page, context or browser has been closed'),
        );
      }),
    };
    const journey = {
      context: () => ({
        newPage: vi.fn(async () => {
          await opened.promise;
          return tokenPage as unknown as TokenPage;
        }),
      }),
      // A journey page is navigated by the test; its document can vanish
      // while a token request is in flight.
      evaluate: vi.fn(async () => {
        throw new Error('Execution context was destroyed');
      }),
    };
    return {
      tokenPage,
      journey: journey as JourneyPage & typeof journey,
      signIn: () => signedIn.resolve({ never: true }),
      failSignIn: (error: Error) => signedIn.reject(error),
      open: () => opened.resolve(),
    };
  };
  const all = {
    gm: player('gm'),
    player: player('player'),
    outsider: player('outsider'),
  };
  return {
    events,
    ...all,
    players: {
      gm: all.gm.journey,
      player: all.player.journey,
      outsider: all.outsider.journey,
    },
  };
}

it('opens every role token page at once and gives no client before every session is signed in', async () => {
  const setup = roles({ manual: true });
  for (const role of ['gm', 'player', 'outsider'] as const) setup[role].open();
  let ready = false;
  const reserving = reserveTokenPages(setup.players).then((authenticate) => {
    ready = true;
    return authenticate;
  });
  await settle();
  // All three loads overlap: none waits for another role's session.
  expect(setup.events).toEqual([
    'gm token page opens /campaigns',
    'player token page opens /campaigns',
    'outsider token page opens /campaigns',
  ]);
  setup.outsider.signIn();
  setup.player.signIn();
  await settle();
  expect(ready).toBe(false);
  setup.gm.signIn();
  const authenticate = await reserving;
  // Each role's client reads its token from its own context's token page.
  for (const role of ['gm', 'player', 'outsider'] as const) {
    const client = authenticate(setup.players[role], () => {
      setup.events.push(`${role} client created`);
      return { setAuth: vi.fn() };
    });
    const fetchToken = client.setAuth.mock.calls[0]![0] as (args: {
      forceRefreshToken: boolean;
    }) => Promise<string | null>;
    await expect(fetchToken({ forceRefreshToken: false })).resolves.toBe(
      `${role}:cached`,
    );
  }
  expect(setup.events.slice(3)).toEqual([
    'outsider token page has a session',
    'player token page has a session',
    'gm token page has a session',
    'gm client created',
    'player client created',
    'outsider client created',
  ]);
  for (const role of ['gm', 'player', 'outsider'] as const)
    expect(setup[role].tokenPage.close).not.toHaveBeenCalled();
});

it('on a failed sign-in, settles every other start and closes every token page before reporting it', async () => {
  const setup = roles({ manual: true });
  setup.gm.open();
  setup.player.open();
  let outcome: unknown = 'pending';
  const reserving = reserveTokenPages(setup.players).catch((error) => {
    outcome = error;
  });
  await settle();
  // The player's session never comes; the outsider's page is still opening.
  setup.gm.failSignIn(new Error('gm sign-in failed'));
  await settle();
  // The outsider's start has not settled, so the failure is not reported yet.
  expect(outcome).toBe('pending');
  expect(setup.player.tokenPage.close).toHaveBeenCalledTimes(1);
  setup.outsider.open();
  await reserving;
  expect(outcome).toEqual(new Error('gm sign-in failed'));
  for (const role of ['gm', 'player', 'outsider'] as const)
    expect(setup[role].tokenPage.close).toHaveBeenCalledTimes(1);
  // A page that opened after the failure never loads.
  expect(setup.outsider.tokenPage.goto).not.toHaveBeenCalled();
  expect(setup.events.at(-1)).toBe('outsider token page closed');
});

it('reads tokens from the reserved page, never from the navigating journey page', async () => {
  const { gm, players } = roles();
  const authenticate = await reserveTokenPages(players);
  const client = authenticate(players.gm, () => ({ setAuth: vi.fn() }));
  const fetchToken = client.setAuth.mock.calls[0]![0] as (args: {
    forceRefreshToken: boolean;
  }) => Promise<string | null>;
  await expect(fetchToken({ forceRefreshToken: false })).resolves.toBe(
    'gm:cached',
  );
  await expect(fetchToken({ forceRefreshToken: true })).resolves.toBe(
    'gm:fresh',
  );
  expect(gm.journey.evaluate).not.toHaveBeenCalled();
  expect(gm.tokenPage.goto).toHaveBeenCalledTimes(1);
});

it('refuses a page it did not reserve a token page for', async () => {
  const { players } = roles();
  const authenticate = await reserveTokenPages(players);
  const stranger = roles().players.gm;
  expect(() => authenticate(stranger, () => ({ setAuth: vi.fn() }))).toThrow(
    'No token page for this player',
  );
});
