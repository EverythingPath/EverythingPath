'use client';

import { convexQuery } from '@convex-dev/react-query';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { ConvexError } from 'convex/values';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import type { CampaignWeek } from '~/components/campaign-home/use-campaign-week';
import { historyPath, type HistorySelection } from '~/lib/campaign-routes';
import { rowHeadlines } from './finished-week-headline-text';
import { provenanceLabels, recordDate, rowMarker } from './finished-week-index';
import type {
  FinishedWeeksView,
  IndexItemView,
  IndexView,
  PaneView,
  WeekLink,
} from './finished-weeks-types';
import type { HistoryRead } from './history-read';
import { useAuditTrail } from './use-audit-trail';
import { useListingWindows, type ListingWindows } from './use-listing-windows';

type HrefFor = (selection: HistorySelection) => string;

function toIndexView(
  windows: ListingWindows,
  shownWeek: number | null,
  hrefFor: HrefFor,
): IndexView {
  const { newest } = windows;
  if (!newest?.isSuccess)
    return newest?.isError
      ? { status: 'failed', retry: windows.retry }
      : { status: 'loading' };
  return {
    status: 'ready',
    items: windows.items.map((item): IndexItemView => {
      if (item.kind === 'earlier')
        return {
          kind: 'earlier',
          beforeWeek: item.beforeWeek,
          status: windows.windowStatus(item.beforeWeek),
          load: () => windows.loadEarlier(item.beforeWeek),
        };
      const isLatest = item.row.week === windows.latestRow?.week;
      return {
        kind: 'week',
        week: item.row.week,
        href: hrefFor({ week: item.row.week }),
        isSelected: item.row.week === shownWeek,
        isLatest,
        date: recordDate(item.row.createdAt),
        headlines: rowHeadlines(item.row),
        marker: rowMarker(item.row),
        onNavigate: isLatest ? windows.restoreNewest : undefined,
      };
    }),
  };
}

// The pane when there is no record to show.
function toMissingPane(
  detail: UseQueryResult<HistoryRead | null>,
  selection: HistorySelection,
  hrefFor: HrefFor,
  retry: () => void,
): PaneView | null {
  if (detail.isPending) return { status: 'loading' };
  if (detail.isError) {
    const effective = {
      label: 'Show the effective record',
      href: hrefFor({ week: selection.week }),
    };
    // The server refuses a linked entry from another week or campaign; it is
    // never replaced by another entry.
    if (detail.error instanceof ConvexError && selection.recordId !== undefined)
      return {
        status: 'unavailable',
        message: "This entry isn't available.",
        action: effective,
      };
    return {
      status: 'failed',
      retry,
      effectiveHref: selection.recordId === undefined ? null : effective.href,
    };
  }
  if (detail.data === null)
    return {
      status: 'unavailable',
      message: `Week ${selection.week} has no finished record.`,
      action: { label: 'Show the latest finished week', href: hrefFor({}) },
    };
  return null;
}

/**
 * Finished weeks for one campaign: the oldest-first index built from bounded
 * listing windows, the selected immutable record, and its paged audit entries.
 * Mount it keyed by campaign so no state or late result crosses campaigns.
 * Selection lives in the address; the entries disclosure is local.
 */
export function useFinishedWeeks({
  campaignId,
  selection,
  select,
  campaignWeek,
  campaignHref,
}: {
  campaignId: Id<'campaign'>;
  selection: HistorySelection;
  select: (selection: HistorySelection) => void;
  campaignWeek: CampaignWeek;
  campaignHref: { week: string; setup: string };
}): FinishedWeeksView {
  // A campaign without a militia has no history; its reads would only fail.
  const isEnabled = campaignWeek.kind !== 'not_set_up';
  const windows = useListingWindows({
    campaignId,
    isEnabled,
    explicitWeek: selection.week,
  });
  // The selected record. Its audit page is read separately (useAuditTrail).
  const detailArgs = {
    campaignId,
    week: selection.week,
    recordId: selection.recordId,
  };
  const detail = useQuery(
    convexQuery(api.canonicalHistory.read, isEnabled ? detailArgs : 'skip'),
  );
  const read = detail.isSuccess ? (detail.data ?? undefined) : undefined;
  const shownWeek =
    selection.week ?? read?.week ?? windows.latestRow?.week ?? null;
  const { audit, earlierEntry } = useAuditTrail({
    campaignId,
    isEnabled,
    selection,
    select,
    shownWeek,
    read,
    effectiveRow: windows.rowFor(read?.week),
  });

  if (!isEnabled)
    return { status: 'no-militia', setupHref: campaignHref.setup };
  const { newest } = windows;
  const retryRead = () => {
    void detail.refetch();
  };
  if (detail.isError && newest?.isError)
    // Until the open week is known, a failure may only mean "no militia yet".
    return campaignWeek.kind === 'loading'
      ? { status: 'loading' }
      : {
          status: 'failed',
          retry: () => {
            windows.retry();
            retryRead();
          },
        };
  if (detail.isPending && newest?.isPending) return { status: 'loading' };
  const hasNoWeeks =
    (newest?.isSuccess === true && newest.data.weeks.length === 0) ||
    (detail.isSuccess && !read && selection.week === undefined);
  const openWeek = campaignWeek.kind === 'week' ? campaignWeek.week : null;
  if (hasNoWeeks)
    return { status: 'empty', openWeek, weekHref: campaignHref.week };

  const hrefFor: HrefFor = (next) => historyPath(campaignId, next);
  const weekLink = (week: number | null): WeekLink =>
    week === null ? null : { week, href: hrefFor({ week }) };
  const pane: PaneView = read
    ? {
        status: 'ready',
        pane: {
          week: read.week,
          record: read.record,
          provenance: provenanceLabels[read.record.provenance],
          date: recordDate(read.createdAt),
          rulesetVersion: read.record.rulesetVersion,
          earlierEntry,
          previous: weekLink(read.previousWeek),
          next: weekLink(read.nextWeek),
          audit,
        },
      }
    : (toMissingPane(detail, selection, hrefFor, retryRead) ?? {
        status: 'loading',
      });
  return {
    status: 'ready',
    index: toIndexView(windows, shownWeek, hrefFor),
    pane,
    inProgressWeek: openWeek,
  };
}
