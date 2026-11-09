// Browser Back/Forward adapter for the installed App Router (Next 16.1),
// which has no traversal blocker: it handles `popstate` immediately. This
// module indexes same-document history entries, and when a guard reports
// pending work it stops the traversal before Next sees it, restores the
// accepted entry, lets the player decide, and replays the exact traversal on
// Leave. Stay and Leave therefore keep the real history direction; nothing is
// pushed or duplicated. Entries not indexed by this adapter (created before
// it was installed in this document) cannot be reconciled and pass through.
const KEY = '__epHistory';
const INSTALLED = '__epHistoryInstalled';

type Marker = { id: string; position: number };
export type TraversalIntent = {
  delta: number;
  url: string;
  commit: () => void;
};
export type TraversalGuard = {
  shouldBlock: () => boolean;
  onBlocked: (intent: TraversalIntent) => void;
};

let guard: TraversalGuard | null = null;
let current: Marker = { id: 'unindexed', position: 0 };
let accepted: Marker = current;
let restoring: { target: Marker; url: string; delta: number } | null = null;
let permit: string | null = null;
let deferredReplace: [unknown, string, string | URL | null | undefined] | null =
  null;

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readMarker(state: unknown): Marker | null {
  if (!state || typeof state !== 'object') return null;
  // Safe cast: state is a non-null object (checked above); a missing key reads
  // undefined.
  const marker = (state as Record<string, unknown>)[KEY];
  if (!marker || typeof marker !== 'object') return null;
  // Safe cast: marker is a non-null object (checked above); both fields are
  // type-checked below.
  const { id, position } = marker as Record<string, unknown>;
  return typeof id === 'string' && typeof position === 'number'
    ? { id, position }
    : null;
}

function stamp(data: unknown, marker: Marker): Record<string, unknown> {
  const base =
    // Safe cast: data is a non-null object here; only its own fields are
    // spread.
    data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  return { ...base, [KEY]: marker };
}

export function registerTraversalGuard(next: TraversalGuard): () => void {
  guard = next;
  return () => {
    if (guard === next) guard = null;
  };
}

export function installBrowserHistory(): void {
  if (typeof window === 'undefined') return;
  const windowObject: unknown = window;
  // Safe cast: a single install flag on window, read and written only here.
  const globalFlags = windowObject as Record<string, unknown>;
  if (globalFlags[INSTALLED]) return;
  globalFlags[INSTALLED] = true;
  const history = window.history;
  const originalPush = history.pushState.bind(history);
  const originalReplace = history.replaceState.bind(history);

  const seeded = readMarker(history.state);
  if (seeded) current = seeded;
  else {
    current = { id: newId(), position: 0 };
    originalReplace(stamp(history.state, current), '', window.location.href);
  }
  accepted = current;

  history.pushState = function pushState(data, unused, url) {
    const next = { id: newId(), position: current.position + 1 };
    originalPush(stamp(data, next), unused, url);
    current = next;
    accepted = next;
  };
  history.replaceState = function replaceState(data, unused, url) {
    if (restoring) {
      // The document is briefly on the blocked entry; apply once back home.
      deferredReplace = [data, unused, url];
      return;
    }
    originalReplace(stamp(data, current), unused, url);
  };

  const onPop = (event: PopStateEvent) => {
    const marker = readMarker(event.state);
    if (permit !== null) {
      if (marker?.id !== permit) {
        event.stopImmediatePropagation();
        return;
      }
      permit = null;
      current = marker;
      accepted = marker;
      return;
    }
    if (restoring) {
      event.stopImmediatePropagation();
      if (!marker) return;
      current = marker;
      if (marker.id !== accepted.id) {
        history.go(accepted.position - marker.position);
        return;
      }
      const blocked = restoring;
      restoring = null;
      if (deferredReplace) {
        const [data, unused, url] = deferredReplace;
        deferredReplace = null;
        originalReplace(stamp(data, current), unused, url);
      }
      guard?.onBlocked({
        delta: blocked.delta,
        url: blocked.url,
        commit: () => {
          permit = blocked.target.id;
          history.go(blocked.delta);
        },
      });
      return;
    }
    if (!marker) return;
    const delta = marker.position - accepted.position;
    if (delta !== 0 && guard?.shouldBlock()) {
      event.stopImmediatePropagation();
      restoring = { target: marker, url: window.location.href, delta };
      current = marker;
      history.go(-delta);
      return;
    }
    current = marker;
    accepted = marker;
  };
  window.addEventListener('popstate', onPop, true);
}

// Test seam: forget module state without touching the installed wrappers.
export function resetBrowserHistoryForTests() {
  guard = null;
  restoring = null;
  permit = null;
  deferredReplace = null;
  if (typeof window !== 'undefined') {
    const marker = readMarker(window.history.state);
    if (marker) {
      current = marker;
      accepted = marker;
    }
  }
}
