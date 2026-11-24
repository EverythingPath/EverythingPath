'use client';
import { useId } from 'react';
import { ChevronRight, History, Users } from 'lucide-react';
import type { Doc } from '@convex/_generated/dataModel';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/skeleton';
import { campaignPath } from '~/lib/campaign-routes';
import { cn } from '~/lib/utils';
import { CampaignDeletionBanner } from './campaign-deletion-banner';
import { DeleteCampaignControl } from './delete-campaign-control';
import type { RecentWeek } from './recent-weeks';
import { useCampaignDeletion } from './use-campaign-deletion';
import {
  useCampaignHomeContent,
  type CampaignHomeContentState,
  type ContinueWeek,
  type RecentHistory,
} from './use-campaign-home-content';

const action = 'min-h-11 md:min-h-9';
const card = 'gap-3 p-4';
const heading =
  'text-muted-foreground text-sm font-medium tracking-wide uppercase';
const continueButton = 'max-md:min-h-11 max-md:w-full';

// A short failure line with its retry, used for every local failure.
function RetryNote({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <p role="status" className="text-muted-foreground text-sm">
        {message}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={action}
        onClick={retry}
      >
        Try again
      </Button>
    </div>
  );
}

// Layout-shaped placeholder while the militia facts are not known yet: a
// Continue-sized block, a militia card and a recent-weeks card.
function HomeSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton aria-hidden className="h-10 w-52 max-w-full max-md:w-full" />
      <Skeleton aria-hidden className="h-28 w-full" />
      <Skeleton aria-hidden className="h-56 w-full" />
      <p role="status" className="sr-only">
        Loading militia…
      </p>
    </div>
  );
}

function ContinueButton({ target }: { target: ContinueWeek }) {
  const label = `Continue week ${target.week}`;
  if (target.kind === 'ready') {
    return (
      <Button asChild size="lg" className={continueButton}>
        <GuardedLink href={target.href}>
          {label} <ChevronRight aria-hidden />
        </GuardedLink>
      </Button>
    );
  }
  return (
    <div className="space-y-2">
      <Button type="button" size="lg" disabled className={continueButton}>
        {label} <ChevronRight aria-hidden />
      </Button>
      {target.kind === 'loading' ? (
        <p role="status" className="text-muted-foreground text-sm">
          Checking where the week continues…
        </p>
      ) : (
        <RetryNote
          message="The week could not be loaded."
          retry={target.retry}
        />
      )}
    </div>
  );
}

function MilitiaCard({
  campaignId,
  summary,
}: {
  campaignId: string;
  summary: string[];
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <Card className={card}>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h3 id={headingId} className={heading}>
            Militia
          </h3>
          <Button asChild variant="ghost" size="sm" className={action}>
            <GuardedLink href={campaignPath(campaignId, 'militia')}>
              Open militia
            </GuardedLink>
          </Button>
        </div>
        <p className="[overflow-wrap:anywhere]">{summary.join(' · ')}</p>
      </Card>
    </section>
  );
}

function RecentWeekRow({ week }: { week: RecentWeek }) {
  return (
    <li>
      <GuardedLink
        href={week.href}
        className="focus-visible:ring-ring/50 hover:bg-foreground/5 flex min-h-11 items-start gap-3 rounded-md px-2 py-2 outline-none focus-visible:ring-[3px]"
      >
        <History
          aria-hidden
          className="text-muted-foreground mt-0.5 size-4 shrink-0"
        />
        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium">Week {week.week}</span>
            {week.badge ? (
              <Badge variant="secondary">{week.badge}</Badge>
            ) : null}
          </span>
          <span className="text-muted-foreground block text-sm [overflow-wrap:anywhere]">
            {week.headlines.join(' · ')}
          </span>
        </span>
      </GuardedLink>
    </li>
  );
}

function RecentWeeksBody({ recent }: { recent: RecentHistory }) {
  switch (recent.kind) {
    case 'loading':
      return (
        <div className="space-y-2">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} aria-hidden className="h-11 w-full" />
          ))}
          <p role="status" className="sr-only">
            Loading finished weeks…
          </p>
        </div>
      );
    case 'failed':
      return (
        <RetryNote
          message="Finished weeks could not be loaded."
          retry={recent.retry}
        />
      );
    case 'ready':
      if (recent.weeks.length === 0)
        return <p className="text-muted-foreground">No finished weeks yet.</p>;
      return (
        <ul className="-mx-2 space-y-1">
          {recent.weeks.map((week) => (
            <RecentWeekRow key={week.week} week={week} />
          ))}
        </ul>
      );
  }
}

function RecentWeeksCard({
  campaignId,
  recent,
}: {
  campaignId: string;
  recent: RecentHistory;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <Card className={card}>
        <h3 id={headingId} className={heading}>
          Recent finished weeks
        </h3>
        <RecentWeeksBody recent={recent} />
        <div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className={cn(action, '-ml-2')}
          >
            <GuardedLink href={campaignPath(campaignId, 'history')}>
              All finished weeks
            </GuardedLink>
          </Button>
        </div>
      </Card>
    </section>
  );
}

function CharactersLink({ campaignId }: { campaignId: string }) {
  return (
    <Button asChild variant="outline" className={cn(action, 'max-md:w-full')}>
      <GuardedLink href={campaignPath(campaignId, 'officers')}>
        <Users aria-hidden /> Characters &amp; officers
      </GuardedLink>
    </Button>
  );
}

function HomeBody({
  campaignId,
  content,
}: {
  campaignId: string;
  content: CampaignHomeContentState;
}) {
  switch (content.kind) {
    case 'loading':
      return <HomeSkeleton />;
    case 'failed':
      return (
        <div className="space-y-4">
          <Card className={card}>
            <RetryNote
              message="The militia could not be loaded. Please try again."
              retry={content.retry}
            />
          </Card>
          <CharactersLink campaignId={campaignId} />
        </div>
      );
    case 'no_militia':
      return (
        <div className="flex flex-wrap gap-2">
          <Button asChild className={action}>
            <GuardedLink href={campaignPath(campaignId, 'setup')}>
              Set up militia
            </GuardedLink>
          </Button>
          <Button asChild variant="outline" className={action}>
            <GuardedLink href={campaignPath(campaignId, 'characters')}>
              Characters
            </GuardedLink>
          </Button>
        </div>
      );
    case 'militia':
      return (
        <div className="space-y-4">
          <ContinueButton target={content.continueWeek} />
          <MilitiaCard campaignId={campaignId} summary={content.summary} />
          <RecentWeeksCard campaignId={campaignId} recent={content.recent} />
          <CharactersLink campaignId={campaignId} />
        </div>
      );
  }
}

// The selected campaign's home content below its header: Continue week, the
// militia summary, the latest finished weeks and Characters & officers. A
// campaign without a militia offers only Set up militia and Characters.
// While the campaign is being deleted (#710) a banner leads; a prepared
// campaign that isn't closes with Delete campaign.
export function CampaignHomeContent({
  campaign,
}: {
  campaign: Doc<'campaign'>;
}) {
  const content = useCampaignHomeContent(campaign._id);
  const campaignDeletion = useCampaignDeletion({
    campaignId: campaign._id,
    organizationId: campaign.organizationId,
  });
  const campaignId = campaign._id;
  const charactersHref = campaignPath(campaignId, 'characters');
  // Null is "no deletion was requested"; undefined is still loading.
  const offersDeletion =
    campaign.e2eFixture !== undefined && campaignDeletion.deletion === null;
  return (
    <div className="space-y-4">
      <CampaignDeletionBanner
        campaignDeletion={campaignDeletion}
        assignHref={charactersHref}
      />
      <HomeBody campaignId={campaignId} content={content} />
      {offersDeletion ? (
        <DeleteCampaignControl
          campaignName={campaign.name}
          campaignDeletion={campaignDeletion}
          charactersHref={charactersHref}
        />
      ) : null}
    </div>
  );
}
