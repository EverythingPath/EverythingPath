'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import type { CampaignWeek } from '~/components/campaign-home/use-campaign-week';
import { historyPath, parseHistorySelection } from '~/lib/campaign-routes';
import { CanonicalHistoryScreen } from './screen';

// Week, record and audit paging live in the address so reload and browser
// Back/Forward return to the same record within the same campaign. Shared by
// a live campaign's history page and a deleted campaign's (#710).
export function HistoryHost({
  campaignId,
  campaignWeek,
  deleted = false,
}: {
  campaignId: string;
  /** The open week drives only the in-progress line and empty-state links. */
  campaignWeek: CampaignWeek;
  deleted?: boolean;
}) {
  const params = useSearchParams();
  const router = useRouter();
  return (
    <CanonicalHistoryScreen
      campaign={campaignId}
      selection={parseHistorySelection(params)}
      select={(next) => router.push(historyPath(campaignId, next))}
      campaignWeek={campaignWeek}
      deleted={deleted}
    />
  );
}
