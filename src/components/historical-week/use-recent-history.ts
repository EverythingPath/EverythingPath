'use client';

import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import type { HistoryRead } from './history-read';

export type RecentHistory = {
  status: 'idle' | 'loading' | 'failed' | 'ready';
  weeks: HistoryRead[];
  retry: () => void;
};

export function useRecentHistory(
  campaignId: Id<'campaign'>,
  enabled: boolean,
): RecentHistory {
  const latest = useQuery(
    convexQuery(api.canonicalHistory.read, enabled ? { campaignId } : 'skip'),
  );
  const previousWeek = latest.isSuccess ? latest.data?.previousWeek : null;
  const previous = useQuery(
    convexQuery(
      api.canonicalHistory.read,
      enabled && previousWeek != null
        ? { campaignId, week: previousWeek }
        : 'skip',
    ),
  );
  const oldestWeek = previous.isSuccess ? previous.data?.previousWeek : null;
  const oldest = useQuery(
    convexQuery(
      api.canonicalHistory.read,
      enabled && oldestWeek != null ? { campaignId, week: oldestWeek } : 'skip',
    ),
  );
  const results = [latest];
  if (previousWeek != null) results.push(previous);
  if (oldestWeek != null) results.push(oldest);
  const retry = () => {
    for (const result of results) {
      if (result.isError) void result.refetch();
    }
  };
  if (!enabled) return { status: 'idle', weeks: [], retry };
  if (results.some((result) => result.isError))
    return { status: 'failed', weeks: [], retry };
  if (results.some((result) => result.isPending))
    return { status: 'loading', weeks: [], retry };
  return {
    status: 'ready',
    weeks: results.flatMap((result) => (result.data ? [result.data] : [])),
    retry,
  };
}
