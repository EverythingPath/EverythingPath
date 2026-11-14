import type { CaseKey } from '../fixtures/catalog';
import { credentialKey, sanitizeEvidence } from './redaction';

// What a failed journey keeps besides its assertion: every role's page and
// what that page says about its state, and the server's view of the case.
// Run 2 kept only the watching member's page, so a failure on the owner's
// sheet could not be seen (#729).

export type PageState = {
  headings: string[];
  alerts: string[];
  statuses: string[];
  regions: string[];
  regionErrors: string[];
  dialogs: string[];
};

/**
 * The application path a page shows, or null for a page with nothing safe to
 * keep: blank, the provider's or the sign-in pages, which can show an
 * account's address.
 */
export function evidencePagePath(url: string, baseURL: string) {
  let page: URL;
  try {
    page = new URL(url);
  } catch {
    return null;
  }
  if (page.origin !== new URL(baseURL).origin) return null;
  if (/^\/sign-(?:in|up)(?:\/|$)/.test(page.pathname)) return null;
  return page.pathname;
}

/**
 * Clerk's components (the user button, its popover and the profile modals)
 * and the app's own account block can show an account's email: screenshots
 * mask them and the page reading leaves them out.
 */
export const accountSurfaces =
  '[class^="cl-"], [class*=" cl-"], [data-account-surface]';

/**
 * Read in the page by `page.evaluate`, so it is self-contained; `excluded`
 * is `accountSurfaces`. Only what is visible counts: hidden and aria-hidden
 * content is left out. Text is kept whole: it is sanitized before it is
 * bounded, so no cut credential escapes the redaction.
 */
export function collectPageState(excluded: string): PageState {
  const errorText =
    /could not|couldn['’]t|can['’]t|cannot|isn['’]t available|wasn['’]t|not saved|failed|error|unavailable|try again|not found/i;
  const textOf = (element: Element) => {
    const copy = element.cloneNode(true);
    if (!(copy instanceof Element)) return '';
    for (const surface of copy.querySelectorAll(excluded)) surface.remove();
    return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
  };
  const isVisible = (element: Element) => {
    if (element.closest(excluded)) return false;
    for (
      let current: Element | null = element;
      current;
      current = current.parentElement
    ) {
      if (
        current.hasAttribute('hidden') ||
        current.getAttribute('aria-hidden') === 'true'
      )
        return false;
      const style = getComputedStyle(current);
      if (style.display === 'none' || style.visibility === 'hidden')
        return false;
    }
    return true;
  };
  const nameOf = (element: Element) => {
    const label = element.getAttribute('aria-label')?.trim();
    if (label) return label;
    const ids = element.getAttribute('aria-labelledby')?.split(/\s+/) ?? [];
    return ids
      .map((id) => document.getElementById(id))
      .filter((labelElement) => labelElement !== null)
      .map(textOf)
      .join(' ')
      .trim();
  };
  const visibleTexts = (selector: string) => [
    ...new Set(
      [...document.querySelectorAll(selector)]
        .filter(isVisible)
        .map(textOf)
        .filter(Boolean),
    ),
  ];
  const regions = [
    ...document.querySelectorAll(
      '[role=region], section[aria-label], section[aria-labelledby]',
    ),
  ]
    .filter(isVisible)
    .map((element) => ({ element, name: nameOf(element) }))
    .filter(({ name }) => name);
  const regionErrors = regions.flatMap(({ element, name }) =>
    [
      ...element.querySelectorAll(
        'p, li, span, [role=alert], [class*="text-destructive"]',
      ),
    ]
      .filter(isVisible)
      .filter(
        (child) =>
          (child.getAttribute('class') ?? '').includes('text-destructive') ||
          errorText.test(textOf(child)),
      )
      .map((child) => `${name}: ${textOf(child)}`),
  );
  return {
    headings: visibleTexts('h1').slice(0, 20),
    alerts: visibleTexts('[role=alert]').slice(0, 20),
    statuses: visibleTexts('[role=status]').slice(0, 20),
    regions: regions.map(({ name }) => name).slice(0, 40),
    regionErrors: [...new Set(regionErrors)].slice(0, 20),
    // A dialog's body says what it asks or why it failed.
    dialogs: [...document.querySelectorAll('[role=dialog], [role=alertdialog]')]
      .filter(isVisible)
      .map((dialog) =>
        [nameOf(dialog), textOf(dialog)].filter(Boolean).join(': '),
      )
      .filter(Boolean)
      .slice(0, 5),
  };
}

/** A page path with its document IDs shown as [id], then sanitized. */
function describePath(path: string) {
  return sanitizeEvidence(
    path.replace(/\/[A-Za-z0-9_-]{20,}(?=\/|$)/g, '/[id]'),
  );
}

function list(items: string[]) {
  return (
    items.map((item) => sanitizeEvidence(item).slice(0, 300)).join(' / ') ||
    'none'
  );
}

/** One role page's state, as the failed attempt's observation. */
export function describePageState({
  role,
  index,
  path,
  state,
}: {
  role: string;
  index: number;
  path: string | null;
  state: PageState | null;
}) {
  if (path === null) return `${role} page ${index}: no application page open`;
  if (state === null)
    return `${role} page ${index} (${describePath(path)}): page state could not be read`;
  return [
    `${role} page ${index} (${describePath(path)}): heading: ${list(state.headings)}`,
    `alerts: ${list(state.alerts)}`,
    `statuses: ${list(state.statuses)}`,
    `regions: ${list(state.regions)}`,
    `region errors: ${list(state.regionErrors)}`,
    `dialogs: ${list(state.dialogs)}`,
  ]
    .join(' | ')
    .slice(0, 4_000);
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') return sanitizeEvidence(value).slice(0, 1_000);
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        credentialKey.test(key) ? '[redacted]' : sanitizeValue(entry),
      ]),
    );
  return value;
}

/** The server's view of a failed journey's case, as an observation. */
export function describeServerState(value: unknown) {
  return `server: ${JSON.stringify(sanitizeValue(value))}`.slice(0, 12_000);
}

/** A page as the evidence reads it; Playwright's `Page` is one. */
export type EvidencePage = {
  url: () => string;
  evaluate: (
    collect: (excluded: string) => PageState,
    excluded: string,
  ) => Promise<PageState>;
};

// Each capture gets a few seconds, so a stalled page can't use up the
// teardown.
const captureTimeoutMs = 5_000;

function within<T>(promise: Promise<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise.catch(() => null),
    new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), captureTimeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * A role page's observation, and its path when the page may be kept as a
 * screenshot.
 */
export async function observePage({
  role,
  index,
  page,
  baseURL,
}: {
  role: string;
  index: number;
  page: EvidencePage;
  baseURL: string;
}) {
  const path = evidencePagePath(page.url(), baseURL);
  const state =
    path === null
      ? null
      : await within(page.evaluate(collectPageState, accountSurfaces));
  return { path, description: describePageState({ role, index, path, state }) };
}

/** A full-page screenshot with the account surfaces masked, or null. */
export async function captureScreenshot<Mask>(page: {
  locator: (selector: string) => Mask;
  screenshot: (options: {
    fullPage: boolean;
    mask: Mask[];
    timeout: number;
  }) => Promise<Uint8Array>;
}) {
  return await page
    .screenshot({
      fullPage: true,
      mask: [page.locator(accountSurfaces)],
      timeout: captureTimeoutMs,
    })
    .catch(() => null);
}

/**
 * A failed attempt's evidence for one role: the server's view first, so a
 * stalled page can't cost it, then each page's observation and screenshot.
 */
export async function recordPageEvidence<Page extends EvidencePage>({
  role,
  pages,
  baseURL,
  observeServer,
  annotate,
  savePage,
}: {
  role: string;
  pages: Page[];
  baseURL: string;
  observeServer: () => Promise<void>;
  annotate: (description: string) => void;
  savePage: (index: number, page: Page) => Promise<boolean>;
}) {
  await observeServer();
  for (const [index, page] of pages.entries()) {
    const { path, description } = await observePage({
      role,
      index,
      page,
      baseURL,
    });
    annotate(description);
    if (path !== null && !(await savePage(index, page)))
      annotate(`${role} page ${index}: screenshot failed`);
  }
}

// The journeys whose failures need the server's view of their moves: their
// Characters move through scheduled, bounded steps the page can't show.
const serverInspectedCases: readonly CaseKey[] = [
  'characterMove',
  'membershipLoss',
];

// The inspection runs the Convex CLI. A stalled one gives way after this,
// well inside the shutdown reserve (`browserStopReserveMs`), so the page
// captures and the shutdown still run.
const serverInspectionTimeoutMs = 20_000;

/** The server's view of a failed attempt's case, or null when not needed. */
export async function observeServerState({
  caseKey,
  failed,
  inspect,
}: {
  caseKey: CaseKey;
  failed: boolean;
  inspect: () => Promise<unknown>;
}) {
  if (!failed || !serverInspectedCases.includes(caseKey)) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stalled = new Promise<string>((resolve) => {
    timer = setTimeout(
      () =>
        resolve(
          describeServerState('the case inspection did not finish within 20 s'),
        ),
      serverInspectionTimeoutMs,
    );
  });
  // The inspection's own error can carry service output, so only its
  // failure is kept.
  const inspected = inspect().then(describeServerState, () =>
    describeServerState('the case inspection failed'),
  );
  return await Promise.race([inspected, stalled]).finally(() =>
    clearTimeout(timer),
  );
}
