import type { FunctionReturnType } from 'convex/server';
import type { api } from '../../../convex/_generated/api';

/** One selected record with its week's newest (or requested) audit page. */
export type HistoryRead = NonNullable<
  FunctionReturnType<typeof api.canonicalHistory.read>
>;
export type AuditRow = HistoryRead['audit'][number];
