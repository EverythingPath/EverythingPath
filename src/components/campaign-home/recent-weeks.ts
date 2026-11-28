import {
  finishedWeekProvenance,
  rowHeadlines,
} from '~/components/historical-week/finished-week-headline-text';
import type {
  FinishedWeek,
  FinishedWeekListing,
} from '~/components/historical-week/finished-week-index';
import { historyPath } from '~/lib/campaign-routes';

export type RecentWeek = {
  week: number;
  href: string;
  badge: 'Corrected' | 'From setup' | null;
  headlines: string[];
};

export const RECENT_WEEK_LIMIT = 3;

// The home words an uncorrected reconstruction From setup; Finished weeks
// says Reconstructed on purpose.
const badges = { corrected: 'Corrected', reconstructed: 'From setup' } as const;
function provenanceBadge(row: FinishedWeek) {
  const provenance = finishedWeekProvenance(row);
  return provenance ? badges[provenance] : null;
}

/**
 * Up to three latest finished weeks, latest first as listed, with the same
 * recorded headlines as the Finished weeks index.
 */
export function recentWeeks(
  campaignId: string,
  list: FinishedWeekListing,
): RecentWeek[] {
  return list.weeks.slice(0, RECENT_WEEK_LIMIT).map((row) => ({
    week: row.week,
    href: historyPath(campaignId, { week: row.week }),
    badge: provenanceBadge(row),
    headlines: rowHeadlines(row),
  }));
}
