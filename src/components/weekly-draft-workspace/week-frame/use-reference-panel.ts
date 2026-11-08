'use client';
import { useCallback, useState, useSyncExternalStore } from 'react';
import { zid } from 'convex-helpers/server/zod4';
import type { Id } from '@convex/_generated/dataModel';
import { useBreakpoint } from '~/components/use-breakpoint';
import {
  useRecentHistory,
  type RecentHistory,
} from '~/components/historical-week/use-recent-history';

export type ReferenceTab = 'militia' | 'officers' | 'history';

// The docked panel's open/closed preference is this player's own, kept in
// this browser the way the retired sidebar's was; it is never shared through
// the campaign. The store below lets every reader see one change at once.
const PREFERENCE_KEY = 'week-reference-panel';
const listeners = new Set<() => void>();
// The value chosen during this visit. It answers reads once set, so a
// browser that refuses storage still opens and closes the panel; a storage
// event from another tab clears it so that tab's choice is read again.
let visit: boolean | null = null;
function readPreference(): boolean {
  if (visit !== null) return visit;
  try {
    return window.localStorage.getItem(PREFERENCE_KEY) !== 'closed';
  } catch {
    return true;
  }
}
function writePreference(open: boolean) {
  visit = open;
  try {
    window.localStorage.setItem(PREFERENCE_KEY, open ? 'open' : 'closed');
  } catch {
    // Remembered for this visit only.
  }
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  const external = (event: StorageEvent) => {
    if (event.key !== null && event.key !== PREFERENCE_KEY) return;
    visit = null;
    listener();
  };
  window.addEventListener('storage', external);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', external);
  };
}

export function useReferencePanelPreference() {
  const open = useSyncExternalStore(subscribe, readPreference, () => true);
  const setOpen = useCallback((next: boolean) => writePreference(next), []);
  return [open, setOpen] as const;
}

export type ReferencePanel = {
  /** Docked panel preference (tablet/desktop). */
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Phone sheet, open only while the player reads it. */
  sheetOpen: boolean;
  setSheetOpen: (open: boolean) => void;
  tab: ReferenceTab;
  setTab: (tab: ReferenceTab) => void;
  /** Null when the campaign is unknown; links and History then stay off. */
  campaignId: Id<'campaign'> | null;
  history: RecentHistory;
};

/**
 * One owner for the reference surfaces: the docked panel and the phone
 * sheet share a tab and one recent-history reader, which reads only while
 * a History tab is actually shown.
 */
export function useReferencePanel(campaignId: string | null): ReferencePanel {
  const [open, setOpen] = useReferencePanelPreference();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tab, setTab] = useState<ReferenceTab>('militia');
  const parsed = zid('campaign').safeParse(campaignId);
  const verified = parsed.success ? parsed.data : null;
  const shown = useBreakpoint('wide') ? open : sheetOpen;
  const history = useRecentHistory(
    // Safe cast: the query is disabled while verified is null, so the empty id
    // is never sent.
    verified ?? ('' as Id<'campaign'>),
    verified !== null && shown && tab === 'history',
  );
  return {
    open,
    setOpen,
    sheetOpen,
    setSheetOpen,
    tab,
    setTab,
    campaignId: verified,
    history,
  };
}
