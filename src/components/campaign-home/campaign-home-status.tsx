'use client';
import {
  FailedLoadCard,
  reloadPage,
} from '~/components/campaign-shell/failed-load';
import {
  OrganizationControl,
  SignIn,
} from '~/components/campaign-shell/shell-frame';
import { StateCard } from '~/components/campaign-shell/state-card';
import { Skeleton } from '~/components/ui/skeleton';
import type { HomeList } from './home-state';

// Shaped like the ready screen: the index column with three rows and, from
// tablet width, the pane beside it; the phone shows the single column.
export function CampaignHomeSkeleton() {
  return (
    <main className="mx-auto grid w-full max-w-[90rem] flex-1 grid-cols-1 md:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[26rem_minmax(0,1fr)]">
      <p role="status" className="sr-only">
        Loading campaigns…
      </p>
      <div
        aria-hidden
        className="border-foreground/15 space-y-4 px-4 py-3 md:border-r"
      >
        <Skeleton className="h-7 w-32" />
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
      <div aria-hidden className="hidden space-y-4 p-6 md:block">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-full max-w-prose" />
        <Skeleton className="h-5 w-2/3 max-w-prose" />
        <Skeleton className="mt-8 h-24 w-full max-w-3xl" />
      </div>
    </main>
  );
}

export function CampaignHomeStatus({
  list,
  requested,
  retry,
}: {
  list: Exclude<HomeList, { kind: 'ready' }>;
  requested: string | null;
  retry: () => void;
}) {
  switch (list.kind) {
    case 'resolving':
      return <CampaignHomeSkeleton />;
    case 'signed_out':
      return (
        <StateCard
          title={
            requested
              ? 'Sign in to open this campaign.'
              : 'Sign in to see your campaigns.'
          }
        >
          <SignIn />
        </StateCard>
      );
    case 'no_organization':
      return (
        <StateCard title="Choose an organization to see its campaigns.">
          <OrganizationControl />
        </StateCard>
      );
    // A member watching when access ends, as when the organization is
    // deleted (#710), learns it is gone; no recovery, no request for access
    // and no name are offered. Otherwise access was never theirs.
    case 'no_access':
      return (
        <StateCard
          title={
            list.hadAccess
              ? 'This organization is no longer available.'
              : "You don't have access to this organization's campaigns."
          }
        >
          <OrganizationControl />
        </StateCard>
      );
    case 'failed':
      return (
        <main className="mx-auto w-full max-w-2xl p-4 md:p-6">
          <FailedLoadCard
            noun="Campaigns"
            hint="Please try again."
            retry={retry}
          />
        </main>
      );
    case 'unreachable':
      return (
        <main className="mx-auto w-full max-w-2xl p-4 md:p-6">
          <FailedLoadCard
            noun="Campaigns"
            hint="Check your connection and try again."
            retry={reloadPage}
          />
        </main>
      );
    default:
      return list satisfies never;
  }
}
