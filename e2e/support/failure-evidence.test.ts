import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  accountSurfaces,
  captureScreenshot,
  collectPageState,
  describePageState,
  describeServerState,
  evidencePagePath,
  observePage,
  observeServerState,
  recordPageEvidence,
  type EvidencePage,
  type PageState,
} from './failure-evidence';
import { sanitizeAndCap, sanitizeEvidence } from './redaction';

// Run 2 kept only the watching member's screenshot, so the two move failures
// could not be settled (#729): a failed journey now keeps every role's page
// and what each page says about its state, and the server's view of the case.
describe('failure evidence', () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.useRealTimers();
  });

  const base = 'http://127.0.0.1:49123';
  // A page as the evidence reads it: its state is collected from this
  // document, or the read stalls or fails.
  function fakePage(
    url: string,
    read: 'document' | 'stall' | 'fail' = 'document',
  ): EvidencePage {
    return {
      url: () => url,
      evaluate: async (collect, excluded) => {
        if (read === 'stall') return new Promise<PageState>(() => undefined);
        if (read === 'fail')
          throw new Error('Target page, context or browser has been closed');
        return collect(excluded);
      },
    };
  }
  // A JWT-shaped value, as a session cookie or provider error could carry.
  const jwt =
    'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEyMyJ9.c2lnbmF0dXJlLXZhbHVl';

  it('keeps every application page, whatever its path, and no sign-in or provider page', () => {
    expect(
      evidencePagePath(`${base}/characters/k57abc?tab=spells#x`, base),
    ).toBe('/characters/k57abc');
    expect(evidencePagePath(`${base}/campaigns/k1/characters`, base)).toBe(
      '/campaigns/k1/characters',
    );
    expect(evidencePagePath(`${base}/`, base)).toBe('/');
    expect(evidencePagePath(`${base}/sign-in/factor-one`, base)).toBeNull();
    expect(evidencePagePath(`${base}/sign-up`, base)).toBeNull();
    expect(
      evidencePagePath('https://clerk.example.dev/sign-in', base),
    ).toBeNull();
    expect(evidencePagePath('about:blank', base)).toBeNull();
  });

  it('reads the visible headings, alerts, statuses, dialogs with their text and region errors of a page', () => {
    document.body.innerHTML = `
      <main>
        <h1>E2E character-move-character</h1>
        <p role="status">Scores saved.</p>
        <p role="status"></p>
        <div hidden><p role="alert">A hidden alert</p></div>
        <p role="alert" aria-hidden="true">An aria-hidden alert</p>
        <p role="alert" style="display: none">An undisplayed alert</p>
        <div>
          <p role="alert">Campaign choices or move progress could not be loaded. Try again.</p>
        </div>
        <section aria-label="Ability scores"><p>Strength 14</p></section>
        <section aria-labelledby="spells-title">
          <h2 id="spells-title">Spellbook</h2>
          <p>Breeze</p>
          <p class="text-destructive">Breeze wasn't recorded.</p>
        </section>
        <div role="region" aria-label="Move progress">
          <span>Move</span><span>Preserving homebrew for 2 Characters…</span>
          <p>The move could not be saved. Try again.</p>
        </div>
        <div role="dialog" aria-label="Take E2E character-move-character out of E2E campaign?">
          <p>The Companion moving with it is removed from the militia roster.</p>
          <p role="alert">The move could not be saved. Try again.</p>
        </div>
      </main>`;
    expect(collectPageState(accountSurfaces)).toEqual({
      headings: ['E2E character-move-character'],
      alerts: [
        'Campaign choices or move progress could not be loaded. Try again.',
        'The move could not be saved. Try again.',
      ],
      statuses: ['Scores saved.'],
      regions: ['Ability scores', 'Spellbook', 'Move progress'],
      regionErrors: [
        "Spellbook: Breeze wasn't recorded.",
        'Move progress: The move could not be saved. Try again.',
      ],
      dialogs: [
        'Take E2E character-move-character out of E2E campaign?: The Companion moving with it is removed from the militia roster. The move could not be saved. Try again.',
      ],
    });
  });

  it('reads nothing from Clerk or account surfaces, and leaves long text whole for sanitizing', () => {
    const long = `${'x'.repeat(290)} ${jwt}`;
    document.body.innerHTML = `
      <div class="cl-userButtonPopoverCard" role="dialog" aria-label="Account">
        <p role="status">player@example.com</p>
      </div>
      <div class="flex cl-modalContent"><h1>Profile details</h1></div>
      <div data-account-surface><p role="alert">E2E player</p></div>
      <p role="alert">${long}</p>`;
    const state = collectPageState(accountSurfaces);
    expect(state).toEqual({
      headings: [],
      alerts: [long],
      statuses: [],
      regions: [],
      regionErrors: [],
      dialogs: [],
    });
    expect(
      describePageState({ role: 'gm', index: 0, path: '/', state }),
    ).not.toContain('eyJ');
  });

  it('masks Clerk and account surfaces, and nothing else, in a bounded screenshot', async () => {
    document.body.innerHTML = `
      <button class="cl-userButtonTrigger">avatar</button>
      <div class="flex cl-userButtonPopoverCard">player@example.com</div>
      <div data-account-surface>E2E player</div>
      <p class="line-clamp-2 decl-x">Breeze</p>`;
    expect(
      [...document.querySelectorAll(accountSurfaces)].map(
        (element) => element.textContent,
      ),
    ).toEqual(['avatar', 'player@example.com', 'E2E player']);
    const calls: unknown[] = [];
    const bytes = new Uint8Array([1]);
    expect(
      await captureScreenshot({
        locator: (selector: string) => `locator(${selector})`,
        screenshot: async (options) => {
          calls.push(options);
          return bytes;
        },
      }),
    ).toBe(bytes);
    expect(calls).toEqual([
      {
        fullPage: true,
        mask: [`locator(${accountSurfaces})`],
        timeout: 5_000,
      },
    ]);
    expect(
      await captureScreenshot({
        locator: (selector: string) => selector,
        screenshot: () => Promise.reject(new Error('Timeout 5000ms exceeded')),
      }),
    ).toBeNull();
  });

  it('describes a page with its role and path, sanitized before it is bounded', () => {
    const description = describePageState({
      role: 'gm',
      index: 0,
      path: '/characters/k57abc',
      state: {
        headings: ['E2E character-move-character'],
        alerts: ['Signed in as player@example.com'],
        statuses: ['token=opaque-session-value'],
        regions: ['Move progress'],
        regionErrors: [
          'Move progress: see https://example.convex.cloud/api?key=secret',
        ],
        dialogs: [],
      },
    });
    expect(description).toBe(
      'gm page 0 (/characters/k57abc): heading: E2E character-move-character | alerts: Signed in as [redacted-email] | statuses: token=[redacted] | regions: Move progress | region errors: Move progress: see [redacted-url] | dialogs: none',
    );
    expect(
      describePageState({
        role: 'player',
        index: 1,
        path: null,
        state: null,
      }),
    ).toBe('player page 1: no application page open');
    // Long opaque runs are redacted, so document IDs in a path show as [id]
    // and the route stays readable.
    expect(
      describePageState({
        role: 'gm',
        index: 0,
        path: `/campaigns/${'k5'.repeat(16)}/characters`,
        state: null,
      }),
    ).toBe(
      'gm page 0 (/campaigns/[id]/characters): page state could not be read',
    );
    const bounded = describePageState({
      role: 'gm',
      index: 0,
      path: '/',
      state: {
        ...emptyState,
        // A token cut by the bound would no longer look like a whole JWT.
        alerts: [`${'x'.repeat(295)}${jwt}`, 'y'.repeat(20_000)],
      },
    });
    expect(bounded.length).toBeLessThanOrEqual(4_000);
    expect(bounded).not.toContain('eyJ');
  });

  it('observes every role page, reading the state only of application pages, within a bound', async () => {
    document.body.innerHTML =
      '<h1>Characters</h1><p role="alert">Move not found</p>';
    expect(
      await observePage({
        role: 'gm',
        index: 0,
        page: fakePage(`${base}/characters/k57abc`),
        baseURL: base,
      }),
    ).toEqual({
      path: '/characters/k57abc',
      description:
        'gm page 0 (/characters/k57abc): heading: Characters | alerts: Move not found | statuses: none | regions: none | region errors: none | dialogs: none',
    });
    expect(
      await observePage({
        role: 'outsider',
        index: 0,
        page: fakePage('about:blank'),
        baseURL: base,
      }),
    ).toEqual({
      path: null,
      description: 'outsider page 0: no application page open',
    });
    expect(
      await observePage({
        role: 'player',
        index: 1,
        page: fakePage(`${base}/characters`, 'fail'),
        baseURL: base,
      }),
    ).toEqual({
      path: '/characters',
      description: 'player page 1 (/characters): page state could not be read',
    });
    vi.useFakeTimers();
    const stalled = observePage({
      role: 'gm',
      index: 2,
      page: fakePage(`${base}/characters`, 'stall'),
      baseURL: base,
    });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(await stalled).toEqual({
      path: '/characters',
      description: 'gm page 2 (/characters): page state could not be read',
    });
  });

  it('records the server view before any page, so a stalled capture cannot cost it', async () => {
    const order: string[] = [];
    const annotations: string[] = [];
    await recordPageEvidence({
      role: 'gm',
      pages: [
        fakePage(`${base}/characters/k57abc`, 'fail'),
        fakePage('about:blank'),
      ],
      baseURL: base,
      observeServer: async () => {
        order.push('server');
      },
      annotate: (description) => {
        order.push('page');
        annotations.push(description);
      },
      savePage: async (index) => {
        order.push(`screenshot ${index}`);
        return false;
      },
    });
    expect(order).toEqual(['server', 'page', 'screenshot 0', 'page', 'page']);
    expect(annotations).toEqual([
      'gm page 0 (/characters/k57abc): page state could not be read',
      'gm page 0: screenshot failed',
      'gm page 1: no application page open',
    ]);
  });

  it('gives the server inspection 20 s, then captures the pages, so a stalled inspection costs neither', async () => {
    vi.useFakeTimers();
    const order: string[] = [];
    const recorded = recordPageEvidence({
      role: 'gm',
      pages: [fakePage('about:blank')],
      baseURL: base,
      observeServer: async () => {
        const description = await observeServerState({
          caseKey: 'characterMove',
          failed: true,
          inspect: () => new Promise(() => undefined),
        });
        order.push(description ?? 'none');
      },
      annotate: (description) => order.push(description),
      savePage: async () => true,
    });
    await vi.advanceTimersByTimeAsync(19_999);
    expect(order).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    await recorded;
    expect(order).toEqual([
      'server: "the case inspection did not finish within 20 s"',
      'gm page 0: no application page open',
    ]);
  });

  it('inspects the server only for a failed move or membership-loss attempt', async () => {
    let inspections = 0;
    const inspect = async () => {
      inspections += 1;
      return { departure: null };
    };
    expect(
      await observeServerState({
        caseKey: 'characterMove',
        failed: false,
        inspect,
      }),
    ).toBeNull();
    expect(
      await observeServerState({
        caseKey: 'sheetClasses',
        failed: true,
        inspect,
      }),
    ).toBeNull();
    expect(inspections).toBe(0);
    expect(
      await observeServerState({
        caseKey: 'membershipLoss',
        failed: true,
        inspect,
      }),
    ).toBe('server: {"departure":null}');
    expect(
      await observeServerState({
        caseKey: 'characterMove',
        failed: true,
        inspect: () =>
          Promise.reject(new Error('Server Error token=opaque-session-value')),
      }),
    ).toBe('server: "the case inspection failed"');
  });

  it('describes the server view of a case without secrets, whatever form they take in lastFailure', () => {
    const description = describeServerState({
      writeGate: {
        present: false,
        closed: false,
        authority: 'legacy',
        epoch: 0,
      },
      departure: {
        state: 'returning',
        failures: [
          {
            lastFailure:
              'Error: https://clerk.example.dev|user_abc for player@example.com eyJa.b.c',
          },
          { lastFailure: '{"code":"X","token":"opaque-json-token"}' },
          { lastFailure: '{"message":"m","secret": "opaque-json-secret"}' },
          { lastFailure: '{"apiKey":"opaque-json-key","x":1}' },
          { lastFailure: '{"authorization":"Bearer opaque-json-bearer"}' },
          { lastFailure: '{\\"sessionToken\\":\\"opaque-escaped\\"}' },
          // The product keeps 500 characters of a failure, so a JWT at its
          // end arrives cut.
          { lastFailure: `${'x'.repeat(470)} ${jwt.slice(0, 29)}` },
        ],
      },
      token: 'opaque-field-token',
    });
    expect(description).toMatch(/^server: \{"writeGate"/);
    expect(description).toContain('"state":"returning"');
    expect(description).toContain('{\\"code\\":\\"X\\",[redacted]');
    expect(description).not.toMatch(/example\.com|clerk\.example|eyJ|opaque-/);
  });

  it('redacts from a credential key to the end of the text in every form, keeping what comes before', () => {
    // Fails closed by design: no value is parsed, so no escaping, cut value
    // or malformed string can leave part of a credential behind.
    const levels = (value: unknown) => {
      const plain = JSON.stringify(value);
      const once = JSON.stringify(plain);
      return [plain, once, JSON.stringify(once)];
    };
    for (const text of levels({ code: 'X', password: 'alpha"omega', y: 2 }))
      expect(sanitizeEvidence(`Error: ${text} end`)).toBe(
        `Error: ${text.slice(0, text.search(/\\*"password/))}[redacted]`,
      );
    for (const [text, kept] of [
      // Review rounds 9 to 11.
      [String.raw`{\"password\":\"alpha\\\"omega`, '{'],
      [String.raw`{\"password\":\"alpha\\\"omega\",\"x\":1}`, '{'],
      [String.raw`{\"password\":\"alpha\\"beta\"omega`, '{'],
      [String.raw`{\"token\":\"\u12\",\"x\":\"omega\"}`, '{'],
      [`{"token":"a\nb","x":"omega"}`, '{'],
      // The earlier adversarial table.
      [String.raw`{"token":"a\qb","x":"omega"}`, '{'],
      [String.raw`{\"token\":\"a"b\",\"x\":\"omega\"}`, '{'],
      [String.raw`{\"token\":\"a\\"b\",\"x\":\"omega\"}`, '{'],
      [String.raw`{\"token\":\"a\\\\"b\",\"x\":\"omega\"}`, '{'],
      [String.raw`{\"token\":\"a\qb\",\"x\":\"omega\"}`, '{'],
      [String.raw`{\\\"token\\\":\\\"a\"b\\\",\\\"x\\\":1}`, '{'],
      [String.raw`{\\"token\\":\\"alpha\"omega`, '{'],
      // Cut inside the value, any case, single quotes, mixed forms.
      ['{"code":"X","token":"opaque-cut\\', '{"code":"X",'],
      [
        String.raw`{\"code\":\"X\",\"secret\":\"opaque-cut-val`,
        String.raw`{\"code\":\"X\",`,
      ],
      ['{"Password":"a","ACCESS_TOKEN":"b","x":"omega"}', '{'],
      ["{ 'apiKey': 'omega' }", '{ '],
      [
        `${JSON.stringify({ code: 'X' })} and ${JSON.stringify(JSON.stringify({ secret: 'r"s' }))} omega`,
        `${JSON.stringify({ code: 'X' })} and "{`,
      ],
    ])
      expect(sanitizeEvidence(`${text} omega`)).toBe(`${kept}[redacted]`);
    expect(
      sanitizeEvidence('{"refresh_token": "abc", "password":"p", "name":"n"}'),
    ).toBe('{[redacted]');
  });

  it('finds credential keys written with escapes, and redacts from them to the end', () => {
    // Escapes are built, so the inputs carry them whatever edits the file.
    const u = (hex: string) => `\\u${hex}`;
    const x = (hex: string) => `\\x${hex}`;
    for (const [text, kept] of [
      // Review round 12.
      [`Error {"pass${u('0077')}ord":"alpha"} omega`, 'Error {'],
      [`{"code":"X","${u('0074')}oken":"alpha"}`, '{"code":"X",'],
      [`{\\"pass\\${u('0077')}ord\\":\\"alpha\\"}`, '{'],
      [`{"${x('74')}oken":"alpha"}`, '{'],
      [`{"to\\\\\\ken":"alpha"}`, '{'],
      [`{'se${u('0063')}ret': 'alpha'}`, '{'],
      [`pass${u('0077')}ord=alpha omega`, ''],
    ] satisfies [string, string][])
      expect(sanitizeEvidence(text)).toBe(`${kept}[redacted]`);
    expect(`pass${u('0077')}ord`).toHaveLength(13);
    // Escapes elsewhere change nothing.
    expect(sanitizeEvidence(`{"name":"caf${u('00e9')}"}`)).toBe(
      `{"name":"caf${u('00e9')}"}`,
    );
  });

  it('redacts opaque values after a credential keyword, and long opaque runs anywhere, but keeps prose', () => {
    for (const [text, safe] of [
      ['token alpha', 'token alpha'],
      ['the session token expired', 'the session token expired'],
      ['token expired', 'token expired'],
      ['token 9f8a7b6c', 'token [redacted]'],
      ['Token  abc.def-ghi', 'Token  [redacted]'],
      ['secret abcdefghijklmnop', 'secret [redacted]'],
      ['api key abcdefg', 'api key abcdefg'],
      ['ACCESS_TOKEN q1w2e3r4t5 rejected', 'ACCESS_TOKEN [redacted] rejected'],
      [
        `failed with ${'Ab3'.repeat(11)} at step 2`,
        'failed with [redacted] at step 2',
      ],
      [`${'a'.repeat(31)} kept`, `${'a'.repeat(31)} kept`],
    ] satisfies [string, string][])
      expect(sanitizeEvidence(text)).toBe(safe);
  });

  it('removes emails, URLs, whole and partial JWTs and the known secrets from page text', () => {
    expect(
      sanitizeEvidence(
        'mail a.b+c@example.co.uk at http://localhost:3000/x?y=1 or sk_test_abc',
      ),
    ).toBe('mail [redacted-email] at [redacted-url] or [redacted-key]');
    expect(sanitizeEvidence(`cookie ${jwt.slice(0, 40)}`)).toBe(
      'cookie [redacted-jwt]',
    );
    expect(sanitizeEvidence(`a ${jwt} b`)).toBe('a [redacted-jwt] b');
    // The server's cap comes after sanitizing, so it can't cut a credential
    // out of the redaction's reach.
    expect(sanitizeAndCap(`ab ${jwt}`, 10)).toBe('ab [redact');
    expect(sanitizeAndCap('é'.repeat(3), 5)).toBe('éé');
  });
});

const emptyState = {
  headings: [],
  alerts: [],
  statuses: [],
  regions: [],
  regionErrors: [],
  dialogs: [],
};
