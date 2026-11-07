import { ConvexError } from 'convex/values';
import { findMigrationWriteRejection } from './migration-write-rejection';
import { migrationWriteMessages } from './migration-write-messages';

type Status = {
  status: 'ready' | 'maintenance' | 'reload_required';
  epoch: number;
};
export type MigrationNotice = {
  kind: 'loading' | 'ready' | 'maintenance' | 'reload_required' | 'unavailable';
  message: string;
};
const notices: Record<MigrationNotice['kind'], MigrationNotice> = {
  loading: {
    kind: 'loading',
    message: migrationWriteMessages.loading,
  },
  ready: { kind: 'ready', message: '' },
  maintenance: {
    kind: 'maintenance',
    message: migrationWriteMessages.maintenance,
  },
  reload_required: {
    kind: 'reload_required',
    message: migrationWriteMessages.reload_required,
  },
  unavailable: {
    kind: 'unavailable',
    message: migrationWriteMessages.unavailable,
  },
};

// One session per loaded client, never per route or sign-in. No commands are
// retained here: rejected writes must be explicitly re-entered after a reload.
export function createMigrationSession() {
  let epoch: number | undefined;
  let reloadRequired = false;
  let notice = notices.loading;
  const listeners = new Set<() => void>();
  function publish(kind: MigrationNotice['kind']) {
    if (notice === notices[kind]) return;
    notice = notices[kind];
    for (const listener of listeners) listener();
  }
  return {
    getSnapshot: () => notice,
    getServerSnapshot: () => notices.loading,
    subscribe(this: void, listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    observe(status: Status) {
      epoch ??= status.epoch;
      publish(
        status.status === 'maintenance'
          ? 'maintenance'
          : reloadRequired ||
              status.epoch !== epoch ||
              status.status === 'reload_required'
            ? 'reload_required'
            : 'ready',
      );
    },
    unavailable() {
      publish('unavailable');
    },
    async write<Args extends object, Result>(
      send: (args: Args & { writeEpoch: number }) => Promise<Result>,
      args: Args,
    ): Promise<Result> {
      if (notice.kind !== 'ready' || epoch === undefined) {
        throw new ConvexError({
          code:
            notice.kind === 'maintenance'
              ? 'MAINTENANCE'
              : notice.kind === 'reload_required'
                ? 'RELOAD_REQUIRED'
                : notice.kind === 'unavailable'
                  ? 'EDITING_STATUS_UNAVAILABLE'
                  : 'EDITING_STATUS_LOADING',
          message: notice.message,
        });
      }
      try {
        return await send({ ...args, writeEpoch: epoch });
      } catch (error) {
        const rejection = findMigrationWriteRejection(error);
        if (rejection) {
          reloadRequired ||= rejection === 'reload_required';
          publish(rejection);
        }
        throw error;
      }
    },
  };
}
