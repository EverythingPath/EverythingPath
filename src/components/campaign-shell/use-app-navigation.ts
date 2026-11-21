'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { z } from 'zod';
import {
  buildAppNavigation,
  rememberNavigation,
  type AppNavigationInput,
  type NavigationMemory,
} from '~/lib/app-navigation';

const STORAGE_KEY = 'keep-navigation';
const memorySchema = z.object({
  campaigns: z.record(z.string(), z.string()).optional(),
  militia: z.record(z.string(), z.string()).optional(),
});
const empty: NavigationMemory = {};
let memory: NavigationMemory = empty;
let hydrated = false;
const subscribers = new Set<() => void>();

function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const saved: unknown = JSON.parse(
      sessionStorage.getItem(STORAGE_KEY) ?? '{}',
    );
    const parsed = memorySchema.safeParse(saved);
    if (parsed.success) memory = parsed.data;
  } catch {
    // Navigation remains usable when browser storage is unavailable.
  }
}

function subscribe(onChange: () => void) {
  hydrate();
  subscribers.add(onChange);
  return () => {
    subscribers.delete(onChange);
  };
}

export function useNavigationMemory() {
  return useSyncExternalStore(
    subscribe,
    () => memory,
    () => empty,
  );
}

export function useAppNavigation(input: AppNavigationInput) {
  const saved = useNavigationMemory();
  const { pathname, searchParams, organizationId } = input;
  useEffect(() => {
    const next = rememberNavigation(memory, {
      pathname,
      searchParams,
      organizationId,
    });
    if (next === memory) return;
    memory = next;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
    } catch {
      // Navigation remains usable when browser storage is unavailable.
    }
    for (const subscriber of subscribers) subscriber();
  }, [pathname, searchParams, organizationId]);
  return buildAppNavigation({ ...input, memory: saved });
}
