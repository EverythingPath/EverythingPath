'use client';
import { useEffect } from 'react';
import { installBrowserHistory } from './browser-history';

// Mounted once in the root layout, below the App Router, so its wrappers are
// in place before any navigation and before Next patches history on mount.
export function BrowserHistoryAdapter() {
  useEffect(() => {
    installBrowserHistory();
  }, []);
  return null;
}
