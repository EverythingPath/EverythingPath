'use client';
import { Suspense } from 'react';
import { useCampaign } from '~/components/campaign-shell/campaign-context';
import { useCampaignWeek } from '~/components/campaign-home/use-campaign-week';
import { FinishedWeeksSkeleton } from '~/components/historical-week/finished-weeks-view';
import { HistoryHost } from '~/components/historical-week/history-host';

function LiveCampaignHistory() {
  const { campaign } = useCampaign();
  const campaignWeek = useCampaignWeek(campaign._id);
  return <HistoryHost campaignId={campaign._id} campaignWeek={campaignWeek} />;
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<FinishedWeeksSkeleton />}>
      <LiveCampaignHistory />
    </Suspense>
  );
}
