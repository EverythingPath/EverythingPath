'use client';
import type { CSSProperties } from 'react';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import type { Doc, Id } from '@convex/_generated/dataModel';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';
import { campaignPath } from '~/lib/campaign-routes';
import { cn } from '~/lib/utils';
import { CampaignHomePane } from './campaign-home-pane';
import { DeletedCampaignsGroup } from './deleted-campaigns-group';
import type { Organization } from './home-state';
import { OrganizationDeletionBanner } from './organization-deletion-banner';
import { useCampaignHomeDeletions } from './use-campaign-home-deletions';
import { useCampaignWeek } from './use-campaign-week';
import type { CampaignHomeSelection } from './use-campaign-home';

const organizationDeletingReason = 'This organization is being deleted.';

// Layout. One DOM order serves every width: index heading, rows, the pane,
// more rows, the ghost row, the live region. The `<nav>` and `<ul>` are
// `display: contents`, so the heading, every row and the pane are items of
// one grid on `<main>`.
//   Phone: a single column. `order` puts the pane right after the selected
//   row (rows up to it are 1, the pane 2, the rest 3) and the ghost row at
//   the top while creating; with nothing selected the pane follows the
//   heading.
//   Tablet and desktop: the index items take column 1, one row each, and
//   the pane sits in column 2 spanning every row plus a final `1fr` row that
//   absorbs its extra height, so the index rows keep their natural height.
//   `--index-rows` counts the column-1 items for that template. The pane is
//   mounted exactly once either way.
const indexItem = 'md:col-start-1';
const row =
  'block min-h-11 border-l-4 border-transparent px-4 py-2.5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset';
const currentRow = 'border-primary bg-primary/10';
const phoneDivider = 'max-md:border-b max-md:border-foreground/15';

function WeekLabel({ campaignId }: { campaignId: Id<'campaign'> }) {
  const week = useCampaignWeek(campaignId);
  switch (week.kind) {
    case 'loading':
      return (
        <span className="block pt-1">
          <Skeleton aria-hidden className="h-3.5 w-16" />
          <span className="sr-only">Loading week</span>
        </span>
      );
    case 'failed':
      return <span className="block text-sm">Week unavailable</span>;
    case 'not_set_up':
      return <span className="block text-sm">Not set up</span>;
    case 'week':
      return <span className="block text-sm">Week {week.week}</span>;
  }
}

// Its own component so the week subscription lives as long as the row.
function CampaignRow({
  campaign,
  current,
  onChoose,
}: {
  campaign: Doc<'campaign'>;
  current: boolean;
  onChoose: () => void;
}) {
  return (
    <GuardedLink
      href={campaignPath(campaign._id)}
      onClick={onChoose}
      aria-current={current ? 'page' : undefined}
      className={cn(row, 'hover:bg-foreground/5', current && currentRow)}
    >
      <span className="flex items-start gap-2">
        <span className="min-w-0 flex-1">
          <span className="block [overflow-wrap:anywhere]">
            {campaign.name}
          </span>
          <span className="text-muted-foreground block">
            <WeekLabel campaignId={campaign._id} />
            {campaign.description !== '' ? (
              <span className="hidden truncate pt-0.5 text-xs xl:block">
                {campaign.description}
              </span>
            ) : null}
          </span>
        </span>
        {/* Phone: the selected row is the expanded one, its home below it. */}
        {current ? (
          <ChevronUp aria-hidden className="mt-1 size-4 shrink-0 md:hidden" />
        ) : (
          <ChevronDown
            aria-hidden
            className="text-muted-foreground mt-1 size-4 shrink-0 md:hidden"
          />
        )}
      </span>
    </GuardedLink>
  );
}

export function CampaignHomeView({
  organization,
  campaigns,
  home,
}: {
  organization: Organization;
  campaigns: Doc<'campaign'>[];
  home: CampaignHomeSelection;
}) {
  const {
    organizationDeletion,
    isAdmin,
    isDeleting: deleting,
    deleted,
  } = useCampaignHomeDeletions(organization.id);
  const selectedIndex = campaigns.findIndex(
    (campaign) => campaign._id === home.selectedId,
  );
  const empty = campaigns.length === 0 && home.ghost === null;
  // Heading, rows, ghost or empty row, deleted group, live region.
  const indexRows =
    1 +
    campaigns.length +
    (home.ghost ? 1 : 0) +
    (empty ? 1 : 0) +
    (deleted.rows.length ? 1 : 0) +
    1;
  return (
    <>
      <OrganizationDeletionBanner
        organizationDeletion={organizationDeletion}
        isAdmin={isAdmin}
      />
      <main
        // Safe cast: CSSProperties has no custom properties; --index-rows is a
        // number React writes as is.
        style={{ '--index-rows': indexRows } as CSSProperties}
        className="mx-auto grid w-full max-w-[90rem] flex-1 grid-cols-1 content-start md:grid-cols-[20rem_minmax(0,1fr)] md:grid-rows-[repeat(var(--index-rows),auto)_minmax(0,1fr)] xl:grid-cols-[26rem_minmax(0,1fr)]"
      >
        <div
          className={cn(
            indexItem,
            phoneDivider,
            'flex items-center justify-between gap-3 px-4 py-2 md:py-3',
          )}
        >
          <h1 className="text-2xl md:text-lg">Campaigns</h1>
          <Button
            type="button"
            variant="ghost"
            aria-label="New campaign"
            title={deleting ? organizationDeletingReason : undefined}
            disabled={deleting}
            className="max-md:bg-background max-md:min-h-11 max-md:border md:size-9 md:px-0"
            onClick={home.startCreate}
          >
            <Plus />
            <span className="md:hidden">New</span>
          </Button>
        </div>
        <nav aria-label="Campaigns" className="contents">
          <ul role="list" className="contents">
            {campaigns.map((campaign, index) => (
              <li
                key={campaign._id}
                className={cn(
                  indexItem,
                  phoneDivider,
                  selectedIndex >= 0 && index <= selectedIndex
                    ? 'order-1'
                    : 'order-3',
                )}
              >
                <CampaignRow
                  campaign={campaign}
                  current={campaign._id === home.selectedId}
                  onChoose={home.choose}
                />
              </li>
            ))}
            {home.ghost && (
              <li
                aria-current="true"
                className={cn(
                  indexItem,
                  phoneDivider,
                  row,
                  currentRow,
                  'max-md:order-1 md:order-4',
                )}
              >
                {home.ghost.kind === 'new' ? (
                  <span className="block italic">New campaign</span>
                ) : (
                  <>
                    <span className="block [overflow-wrap:anywhere]">
                      {home.ghost.name}
                    </span>
                    <span className="text-muted-foreground block text-sm">
                      Opening…
                    </span>
                  </>
                )}
              </li>
            )}
            {empty && (
              <li
                className={cn(
                  indexItem,
                  'text-muted-foreground order-3 px-4 py-3',
                )}
              >
                No campaigns yet
              </li>
            )}
          </ul>
        </nav>
        {deleted.rows.length ? (
          <DeletedCampaignsGroup
            {...deleted}
            className={cn(indexItem, phoneDivider, 'order-4')}
          />
        ) : null}
        <div
          className={cn(
            phoneDivider,
            // Spanning every row, the pane's left edge is the index divider.
            'md:border-foreground/15 order-2 min-w-0 p-4 md:order-none md:col-start-2 md:[grid-row:1/-1] md:border-l md:p-6',
          )}
        >
          <CampaignHomePane
            organization={organization}
            home={home}
            createBlockedReason={deleting ? organizationDeletingReason : null}
          />
        </div>
        <p
          role="status"
          aria-live="polite"
          className={cn(
            indexItem,
            'text-muted-foreground order-5 px-4 py-2 text-xs',
          )}
        >
          {home.announcement}
        </p>
      </main>
    </>
  );
}
