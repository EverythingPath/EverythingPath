import { ConvexError } from 'convex/values';

export function findMigrationWriteRejection(error: unknown) {
  if (!(error instanceof ConvexError)) return null;
  const data: unknown = error.data;
  if (typeof data !== 'object' || data === null || !('code' in data))
    return null;
  if (data.code === 'MAINTENANCE') return 'maintenance';
  if (data.code === 'RELOAD_REQUIRED') return 'reload_required';
  if (data.code === 'EDITING_STATUS_LOADING') return 'loading';
  if (data.code === 'EDITING_STATUS_UNAVAILABLE') return 'unavailable';
  return null;
}
