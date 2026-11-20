'use client';
import { useConvexAuth } from 'convex/react';
import { zid } from 'convex-helpers/server/zod4';
import type { Id } from '../../../convex/_generated/dataModel';
import type { CampaignWeek } from '~/components/campaign-home/use-campaign-week';
import { campaignPath, type HistorySelection } from '~/lib/campaign-routes';
import { FinishedWeeksLayout } from './finished-weeks-view';
import { HistoricalRecordView } from './record-view';
import { useFinishedWeeks } from './use-finished-weeks';

// The selection is owned by the route so the address, reload and browser
// history carry the chosen week, record and audit page.
function HistoryBrowser({
  campaignId,
  selection,
  select,
  campaignWeek,
  deleted,
}: {
  campaignId: Id<'campaign'>;
  selection: HistorySelection;
  select: (selection: HistorySelection) => void;
  campaignWeek: CampaignWeek;
  deleted: boolean;
}) {
  const weekHref = campaignPath(campaignId, 'week');
  const view = useFinishedWeeks({
    campaignId,
    selection,
    select,
    campaignWeek,
    campaignHref: { week: weekHref, setup: campaignPath(campaignId, 'setup') },
  });
  return (
    <FinishedWeeksLayout
      view={view}
      returnHref={weekHref}
      deleted={deleted}
      // Keyed by week: a different week starts with its own Show all state.
      renderRecord={(pane) => (
        <HistoricalRecordView key={pane.week} record={pane.record} />
      )}
    />
  );
}

export function CanonicalHistoryScreen({
  campaign,
  selection,
  select,
  campaignWeek,
  deleted = false,
}: {
  campaign: string | null;
  selection: HistorySelection;
  select: (selection: HistorySelection) => void;
  campaignWeek: CampaignWeek;
  /**
   * The campaign was deleted (#710): its finished weeks stay readable, but
   * nothing leads to a week, setup, correction or History Rewrite.
   */
  deleted?: boolean;
}) {
  const auth = useConvexAuth();
  const parsed = zid('campaign').safeParse(campaign);
  if (auth.isLoading)
    return (
      <p role="status" className="p-6">
        Loading history…
      </p>
    );
  if (!auth.isAuthenticated || !parsed.success)
    return (
      <p role="alert" className="p-6">
        Campaign history is unavailable.
      </p>
    );
  return (
    <HistoryBrowser
      key={parsed.data}
      campaignId={parsed.data}
      selection={selection}
      select={select}
      campaignWeek={campaignWeek}
      deleted={deleted}
    />
  );
}
