'use client';
import { useCallback, useSyncExternalStore } from 'react';

// Server rendering and browsers without matchMedia start in the tablet
// layout: wide panes, with desktop-only pickers kept in their sheets.
const breakpoints = {
  wide: { query: '(min-width: 768px)', fallback: true },
  desktop: { query: '(min-width: 1280px)', fallback: false },
};

function mediaQuery(query: string) {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function'
    ? window.matchMedia(query)
    : null;
}

export function useBreakpoint(name: keyof typeof breakpoints) {
  const { query, fallback } = breakpoints[name];
  const subscribe = useCallback(
    (listener: () => void) => {
      const media = mediaQuery(query);
      media?.addEventListener('change', listener);
      return () => media?.removeEventListener('change', listener);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => mediaQuery(query)?.matches ?? fallback,
    () => fallback,
  );
}
