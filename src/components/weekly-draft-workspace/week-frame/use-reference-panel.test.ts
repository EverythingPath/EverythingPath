import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { useReferencePanel } from './use-reference-panel';

const useRecentHistory = vi.fn();
vi.mock('~/components/historical-week/use-recent-history', () => ({
  useRecentHistory: (...args: unknown[]) => useRecentHistory(...args),
}));

let wide = true;
beforeEach(() => {
  window.localStorage.clear();
  useRecentHistory.mockImplementation(() => ({
    status: 'idle',
    weeks: [],
    retry: () => undefined,
  }));
  window.matchMedia = ((query: string) => ({
    matches: query.includes('min-width') ? wide : false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
});

test('the panel opens by default and remembers a closed preference in this browser only', () => {
  const first = renderHook(() => useReferencePanel('campaign'));
  expect(first.result.current.open).toBe(true);
  act(() => first.result.current.setOpen(false));
  expect(first.result.current.open).toBe(false);
  expect(window.localStorage.getItem('week-reference-panel')).toBe('closed');
  first.unmount();
  // A fresh mount (reload) reads the remembered preference.
  const second = renderHook(() => useReferencePanel('campaign'));
  expect(second.result.current.open).toBe(false);
  act(() => second.result.current.setOpen(true));
  expect(window.localStorage.getItem('week-reference-panel')).toBe('open');
});

test('recent history reads only while a History tab is actually shown', () => {
  const enabled = () => useRecentHistory.mock.lastCall?.[1];
  const { result } = renderHook(() => useReferencePanel('campaign'));
  expect(useRecentHistory).toHaveBeenLastCalledWith('campaign', false);
  act(() => result.current.setTab('history'));
  expect(enabled()).toBe(true);
  // Closing the docked panel stops the reading; the phone sheet is closed.
  act(() => result.current.setOpen(false));
  expect(enabled()).toBe(false);
  act(() => result.current.setSheetOpen(true));
  // Wide layout: the sheet is not the surface in use.
  expect(enabled()).toBe(false);
  act(() => result.current.setTab('militia'));
  act(() => result.current.setOpen(true));
  expect(enabled()).toBe(false);
});

test('on the phone layout the sheet decides whether History reads', () => {
  wide = false;
  try {
    const enabled = () => useRecentHistory.mock.lastCall?.[1];
    const { result } = renderHook(() => useReferencePanel('campaign'));
    act(() => result.current.setTab('history'));
    expect(enabled()).toBe(false);
    act(() => result.current.setSheetOpen(true));
    expect(enabled()).toBe(true);
    act(() => result.current.setSheetOpen(false));
    expect(enabled()).toBe(false);
  } finally {
    wide = true;
  }
});

test('an unknown campaign keeps every link and reader off', () => {
  const { result } = renderHook(() => useReferencePanel(null));
  expect(result.current.campaignId).toBeNull();
  act(() => result.current.setTab('history'));
  expect(useRecentHistory.mock.lastCall?.[1]).toBe(false);
});

test('a browser that refuses storage still opens and closes the panel for this visit', () => {
  const storage = window.localStorage;
  const denied = {
    getItem: () => {
      throw new Error('denied');
    },
    setItem: () => {
      throw new Error('denied');
    },
  };
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: denied,
  });
  try {
    const { result } = renderHook(() => useReferencePanel('campaign'));
    expect(result.current.open).toBe(true);
    act(() => result.current.setOpen(false));
    expect(result.current.open).toBe(false);
    act(() => result.current.setOpen(true));
    expect(result.current.open).toBe(true);
    act(() => result.current.setOpen(false));
    expect(result.current.open).toBe(false);
  } finally {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: storage,
    });
    // The visit's choice is forgotten with a storage change from elsewhere.
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'week-reference-panel' }),
      );
    });
  }
});

test('a storage change from another tab is read again', () => {
  const { result } = renderHook(() => useReferencePanel('campaign'));
  act(() => result.current.setOpen(false));
  expect(result.current.open).toBe(false);
  window.localStorage.setItem('week-reference-panel', 'open');
  act(() => {
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'week-reference-panel' }),
    );
  });
  expect(result.current.open).toBe(true);
});
