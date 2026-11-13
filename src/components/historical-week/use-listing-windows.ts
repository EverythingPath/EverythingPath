'use client';

import { useState } from 'react';
import { convexQuery } from '@convex-dev/react-query';
import {
  useQueries,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import {
  buildWeekIndex,
  isWeekCovered,
  type FinishedWeek,
  type FinishedWeekListing,
  type ListWindow,
  type WeekIndexItem,
} from './finished-week-index';

/** An older window's control: not requested, loading, or failed. */
export type WindowStatus = 'idle' | 'loading' | 'failed';

export type ListingWindows = {
  /** The newest page, which also decides empty, failed and loading states. */
  newest: UseQueryResult<FinishedWeekListing> | undefined;
  latestRow: FinishedWeek | null;
  items: WeekIndexItem[];
  /** The listing row for a week, from any loaded window or its own read. */
  rowFor: (week: number | undefined) => FinishedWeek | null;
  windowStatus: (beforeWeek: number) => WindowStatus;
  /** Loads the page before `beforeWeek`, or reads it again after a failure. */
  loadEarlier: (beforeWeek: number) => void;
  retry: () => void;
  /** Called when the latest row is chosen: drops every older window. */
  restoreNewest: () => void;
};

/**
 * The bounded listing windows behind the Finished weeks index: the newest page
 * always; older pages on request; and, for a directly linked week outside
 * them, only the window ending at that week (never every page in between).
 */
export function useListingWindows({
  campaignId,
  isEnabled,
  explicitWeek,
}: {
  campaignId: Id<'campaign'>;
  isEnabled: boolean;
  explicitWeek: number | undefined;
}): ListingWindows {
  const [anchors, setAnchors] = useState<number[]>([]);
  // The latest row's link navigates asynchronously; windows are dropped once
  // the address actually shows that week, so the old deep link can't re-add
  // its window in between.
  const [restoring, setRestoring] = useState<{
    week: number;
    from: number | undefined;
  } | null>(null);

  const allAnchors = [null, ...anchors];
  const results = useQueries({
    queries: isEnabled
      ? allAnchors.map((beforeWeek) =>
          convexQuery(
            api.canonicalHistory.list,
            beforeWeek === null ? { campaignId } : { campaignId, beforeWeek },
          ),
        )
      : [],
  });
  const resultFor = (beforeWeek: number | null) =>
    results[allAnchors.indexOf(beforeWeek)];
  const newest = resultFor(null);
  const windows: ListWindow[] = allAnchors.flatMap((beforeWeek) => {
    const result = resultFor(beforeWeek);
    return result?.isSuccess ? [{ beforeWeek, listing: result.data }] : [];
  });
  const loadedRows = windows.flatMap(({ listing }) => listing.weeks);
  const latestRow = newest?.isSuccess ? (newest.data.weeks[0] ?? null) : null;

  if (restoring && explicitWeek !== restoring.from) {
    setRestoring(null);
    // Only arriving at the latest week drops the windows; any other
    // navigation in between keeps them.
    if (explicitWeek === restoring.week) setAnchors([]);
  }
  const isSettled = allAnchors.every(
    (beforeWeek) => !resultFor(beforeWeek)?.isPending,
  );
  const needsDeepWindow =
    isEnabled &&
    restoring === null &&
    explicitWeek !== undefined &&
    newest?.isSuccess &&
    isSettled &&
    !isWeekCovered(windows, explicitWeek) &&
    !anchors.includes(explicitWeek + 1);
  if (needsDeepWindow) setAnchors([...anchors, explicitWeek + 1]);

  // A linked week outside every loaded window is shown at once from its own
  // one-row read while its window loads.
  const isListed = loadedRows.some((row) => row.week === explicitWeek);
  const selected = useQuery(
    convexQuery(
      api.canonicalHistory.list,
      isEnabled && explicitWeek !== undefined && !isListed
        ? { campaignId, selectedWeek: explicitWeek, limit: 1 }
        : 'skip',
    ),
  );
  const pinned = selected.isSuccess ? selected.data.selected : null;

  const retry = () => {
    for (const result of results) {
      if (result.isError) void result.refetch();
    }
    if (selected.isError) void selected.refetch();
  };

  return {
    newest,
    latestRow,
    items: buildWeekIndex(windows, pinned),
    rowFor: (week) =>
      loadedRows.find((row) => row.week === week) ??
      (pinned?.week === week ? pinned : null),
    windowStatus: (beforeWeek) => {
      if (!anchors.includes(beforeWeek)) return 'idle';
      const result = resultFor(beforeWeek);
      return result?.isSuccess
        ? 'idle'
        : result?.isError
          ? 'failed'
          : 'loading';
    },
    loadEarlier: (beforeWeek) =>
      anchors.includes(beforeWeek)
        ? retry()
        : setAnchors((current) => [...current, beforeWeek]),
    retry,
    restoreNewest: () => {
      if (!latestRow) return;
      if (explicitWeek === latestRow.week) setAnchors([]);
      else setRestoring({ week: latestRow.week, from: explicitWeek });
    },
  };
}
