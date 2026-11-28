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

export type MigrationMaintenance = MigrationNotice & {
  readOnly: boolean;
  /**
   * The Ruleset Version client-side Weekly previews use: the one
   * `initialMigration:clientStatus` reported while this tab was ready (#413
   * F6c). Absent before then (and from hosts without the migration client),
   * which previews read as the current version. The server's own review and
   * Confirmation choose theirs independently.
   */
  rulesetVersion?: number;
};

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
  // The version changes only with a notice: a tab's first `ready` sets it.
  return {
    ...notice,
    readOnly: notice.kind !== 'ready',
    rulesetVersion: session.getRulesetVersion(),
  };
}
