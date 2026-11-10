'use client';

import { useSyncExternalStore } from 'react';
import { useConvex } from 'convex/react';
import { MigrationConvexClient } from '~/lib/migration-convex-client';
import {
  createMigrationSession,
  type MigrationNotice,
} from '~/lib/initial-migration-client';

// Hosts without the migration client cannot check whether editing is safe.
const unsupportedClientSession = createMigrationSession();
unsupportedClientSession.unavailable();

export type MigrationMaintenance = MigrationNotice & { readOnly: boolean };

export function useInitialMigrationMaintenance(): MigrationMaintenance {
  const client = useConvex();
  const session =
    client instanceof MigrationConvexClient
      ? client.maintenance
      : unsupportedClientSession;
  const notice = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session === unsupportedClientSession
      ? session.getSnapshot
      : session.getServerSnapshot,
  );
  return { ...notice, readOnly: notice.kind !== 'ready' };
}
