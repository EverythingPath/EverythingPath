'use client';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { WorkspaceGateway } from './gateway';
import { createWorkspace } from './store';
import type { WeeklyDraftWorkspace } from './types';

export type WorkspaceController = {
  store: ReturnType<typeof createWorkspace>;
  retry: () => void;
};
const ControllerContext = createContext<WorkspaceController | null>(null);
const SnapshotContext = createContext<WeeklyDraftWorkspace>({
  status: 'unavailable',
});

// One provider owns one Workspace store for one gateway identity: one source
// subscription, one persistence transport per draft and one local Phase View.
// Every consumer below reads the same snapshot; nobody creates a second store.
export function WeeklyDraftWorkspaceProvider({
  gateway,
  retry,
  children,
}: {
  gateway: WorkspaceGateway | null;
  retry?: () => void;
  children: ReactNode;
}) {
  const store = useMemo(() => createWorkspace(gateway), [gateway]);
  useEffect(() => store.start(), [store]);
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  const controller = useMemo(
    () => ({ store, retry: retry ?? (() => undefined) }),
    [store, retry],
  );
  return (
    <ControllerContext.Provider value={controller}>
      <SnapshotContext.Provider value={snapshot}>
        {children}
      </SnapshotContext.Provider>
    </ControllerContext.Provider>
  );
}

export function useWeeklyDraftWorkspace(): WeeklyDraftWorkspace {
  return useContext(SnapshotContext);
}

// Null outside any Workspace owner (for example the campaign list).
export function useWorkspaceController(): WorkspaceController | null {
  return useContext(ControllerContext);
}
