'use client';
import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { recordDate } from '~/components/historical-week/finished-week-index';
import { FinishedWeeksSkeleton } from '~/components/historical-week/finished-weeks-view';
import { RecordTime } from '~/components/historical-week/record-time';
import { HistoryHost } from '~/components/historical-week/history-host';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/skeleton';
import { campaignPath } from '~/lib/campaign-routes';
import { GuardedLink } from './navigation-guard';
import { OrganizationControl } from './shell-frame';
import { BackToCampaigns, StateCard } from './state-card';
import {
  useDeletedCampaign,
  type DeletedCampaign,
} from './use-deleted-campaign';

// A deleted campaign (#710): its name and when, Back to campaigns, and on
// its history route the finished weeks read-only. No rail, Week, Militia or
// Characters, and nothing that starts a week, correction or History Rewrite.
function DeletedCampaignState({
  deletion,
  history,
}: {
  deletion: DeletedCampaign;
  /** The reader is on the campaign's history route. */
  history: boolean;
}) {
  const historyHref = campaignPath(deletion.campaignId, 'history');
  const header = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-muted-foreground text-xs tracking-widest uppercase">
          Deleted campaign
        </p>
        <h1 className="text-xl [overflow-wrap:anywhere]">
          {deletion.campaignName}
        </h1>
        {deletion.deletedAt !== null ? (
          <p className="text-muted-foreground text-sm">
            Deleted <RecordTime date={recordDate(deletion.deletedAt)} />
          </p>
        ) : null}
      </div>
      <BackToCampaigns />
    </div>
  );
  if (history && deletion.hasHistory)
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="border-foreground/15 border-b px-4 py-3 md:px-6">
          {header}
        </header>
        <Suspense fallback={<FinishedWeeksSkeleton />}>
          {/* A deleted campaign has no open week; its read would only fail. */}
          <HistoryHost
            campaignId={deletion.campaignId}
            campaignWeek={{ kind: 'failed' }}
            deleted
          />
        </Suspense>
      </div>
    );
  return (
    <main className="mx-auto w-full max-w-2xl p-4 md:p-6">
      <Card className="gap-4 p-6">
        {header}
        {deletion.hasHistory ? (
          <Button
            asChild
            variant="ghost"
            className="min-h-11 self-start md:min-h-9"
          >
            <GuardedLink href={historyHref}>Finished weeks</GuardedLink>
          </Button>
        ) : (
          <p className="text-muted-foreground text-sm">No finished weeks.</p>
        )}
      </Card>
    </main>
  );
}

// A campaign id that isn't in the active organization's list: a deleted
// campaign keeps its finished weeks; any other reads as unavailable, so
// nothing is disclosed.
export function UnavailableCampaign({
  campaignId,
  organizationName,
}: {
  campaignId: string;
  organizationName: string;
}) {
  const deleted = useDeletedCampaign(campaignId);
  const pathname = usePathname();
  switch (deleted.kind) {
    case 'loading':
      return (
        <main className="mx-auto w-full max-w-6xl p-4 md:p-6">
          <p role="status" className="sr-only">
            Loading campaign…
          </p>
          <Skeleton aria-hidden className="mb-4 h-8 w-64" />
          <Skeleton aria-hidden className="h-40 w-full" />
        </main>
      );
    case 'none':
      return (
        <StateCard
          title={`This campaign isn't available in ${organizationName}.`}
        >
          <OrganizationControl />
          <BackToCampaigns />
        </StateCard>
      );
    case 'deleted':
      return (
        <DeletedCampaignState
          deletion={deleted.deletion}
          history={pathname === campaignPath(campaignId, 'history')}
        />
      );
  }
}
